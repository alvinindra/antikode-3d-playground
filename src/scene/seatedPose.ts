import { Object3D, Quaternion, SkinnedMesh, Vector3 } from 'three';
import { makeLegSolver } from './legIK.ts';
import type { SeatUse } from './seating.ts';

// The lounge clip supplies the relaxed upper body. Fit the trousers and both soles
// independently: a mattress supports all three, a bench supports the shoes one tread lower.
export function createSeatedPose(model: Object3D) {
  const mesh=(name: string)=>model.getObjectByName(name) as SkinnedMesh;
  const pants=mesh('Wolf3D_Outfit_Bottom'), shoes=mesh('Wolf3D_Outfit_Footwear');
  const probes=model.userData.contacts as {seat:number[]; soles:number[]};
  const feet=['Left','Right'].map((s,i)=>{
    const bones=['UpLeg','Leg','Foot'].map(n=>model.getObjectByName(s+n)!);
    const [thigh,shin,foot]=bones, sign=i?-1:1;
    const [arm,elbow,hand]=['Arm','ForeArm','Hand'].map(n=>model.getObjectByName(s+n)!);
    bones.push(arm,elbow,hand);
    return { bones,shin,foot,hand,sign,save:bones.map(()=>new Quaternion()),solve:makeLegSolver(thigh,shin,foot),
      reach:makeLegSolver(arm,elbow,hand),
      sole:probes.soles.filter(j=>sign*shoes.geometry.attributes.position.getX(j)>0) };
  });
  const p=new Vector3(), end=new Vector3(), target=new Vector3(), forward=new Vector3(), right=new Vector3();
  const pole=new Vector3(), rotation=new Quaternion();
  const faceDown=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2-0.06), palm=new Quaternion();
  let active=false;
  function lowest(m: SkinnedMesh, indices: number[]) {
    let y=Infinity;
    for (const i of indices) y=Math.min(y,m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld).y);
    return y;
  }
  function restore() {
    if (!active) return;
    for(const l of feet) l.bones.forEach((b,i)=>b.quaternion.copy(l.save[i]));
    model.position.y=0; active=false;
  }
  function fit(player: Object3D, use: SeatUse) {
    const w=use.weight, s=use.site;
    if(w<=0) return;
    active=true; player.updateMatrixWorld(true); player.getWorldDirection(forward); right.set(forward.z,0,-forward.x);
    const baseGap=lowest(pants,probes.seat)-player.position.y;
    // During the descent preserve the standing hip height, only remove the seated clip's residual gap.
    model.position.y-=Math.max(-0.075,Math.min(0.075,baseGap))*w;
    player.updateMatrixWorld(true);
    for(const l of feet) {
      l.bones.forEach((b,i)=>l.save[i].copy(b.quaternion));
      l.foot.getWorldPosition(end); l.foot.getWorldQuaternion(rotation);
      const ankle=end.y-lowest(shoes,l.sole);
      target.copy(player.position).addScaledVector(forward,s.toeReach-0.018*l.sign).addScaledVector(right,0.15*l.sign);
      target.y=s.feetY+ankle;
      end.lerp(target,w);
      pole.copy(forward).addScaledVector(right,0.12*l.sign); pole.y=0.46;
      l.solve(end,rotation,pole);
    }
    // Bending the thighs changes the skinned seat of the trousers slightly.
    player.updateMatrixWorld(true);
    const adjust=Math.max(-0.035,Math.min(0.035,player.position.y-lowest(pants,probes.seat)))*w*w;
    if(Math.abs(adjust)>0.0004) {
      model.position.y+=adjust;
      for(const l of feet) {
        l.foot.getWorldPosition(target); target.y-=adjust;
        pole.copy(forward).addScaledVector(right,0.12*l.sign); pole.y=0.46;
        l.solve(target,l.foot.getWorldQuaternion(rotation),pole);
      }
    }
    if(s.kind==='bed' || s.kind==='bag') {
      for(const l of feet) {
        l.shin.getWorldPosition(target);
        target.y+=s.kind==='bed' ? 0.075 : 0.084;
        target.addScaledVector(forward,-0.064).addScaledVector(right,0.008*l.sign);
        l.hand.getWorldPosition(end).lerp(target,w);
        palm.copy(player.quaternion).multiply(faceDown);
        l.hand.getWorldQuaternion(rotation).slerp(palm,w);
        pole.copy(right).multiplyScalar(0.72*l.sign).addScaledVector(forward,-0.55);pole.y=-0.57;
        l.reach(end,rotation,pole);
      }
    }
  }
  return {fit,restore};
}
