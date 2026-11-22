import { MathUtils, Object3D, Quaternion, SkinnedMesh, Vector3 } from 'three';
import { getWalkableFloorY, NOOK_PADS, SLIDE } from './layout.ts';
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
    return { bones,thigh,shin,foot,hand,sign,save:bones.map(()=>new Quaternion()),solve:makeLegSolver(thigh,shin,foot),
      reach:makeLegSolver(arm,elbow,hand),
      sole:probes.soles.filter(j=>sign*shoes.geometry.attributes.position.getX(j)>0) };
  });
  const p=new Vector3(), end=new Vector3(), target=new Vector3(), forward=new Vector3(), right=new Vector3();
  const pole=new Vector3(), rotation=new Quaternion();
  const hip=new Vector3();
  function kneePole(l: typeof feet[number], ankle: Vector3, mattress: boolean) {
    if(mattress) {
      // A fixed forward pole becomes parallel to a tucked shin and can
      // flip the knee across the other leg. Bend in the hip/ankle plane.
      l.thigh.getWorldPosition(hip);
      pole.subVectors(ankle,hip).cross(right).normalize().addScaledVector(right,0.22*l.sign);
    } else {
      pole.copy(forward).addScaledVector(right,0.12*l.sign); pole.y=0.46;
    }
    return pole;
  }
  const spine=model.getObjectByName('Spine')!, savedSpine=new Quaternion(), basis=new Quaternion();
  const ease=MathUtils.smoothstep;
  function fold(angle: number) {
    savedSpine.copy(spine.quaternion);
    spine.parent!.getWorldQuaternion(basis).invert();
    p.copy(right).applyQuaternion(basis).normalize();
    spine.quaternion.premultiply(rotation.setFromAxisAngle(p,angle));
  }
  const faceDown=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2-0.06), palm=new Quaternion();
  let active=false;
  function lowest(m: SkinnedMesh, indices: number[]) {
    let y=Infinity;
    for (const i of indices) y=Math.min(y,m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld).y);
    return y;
  }
  function restore() {
    if (!active) return;
    spine.quaternion.copy(savedSpine);
    for(const l of feet) l.bones.forEach((b,i)=>b.quaternion.copy(l.save[i]));
    model.position.y=0; active=false;
  }
  function fit(player: Object3D, use: SeatUse) {
    const w=use.weight, s=use.site;
    if(w<=0) return;
    active=true; player.updateMatrixWorld(true); player.getWorldDirection(forward); right.set(forward.z,0,-forward.x);
    fold((s.kind==='bed'?0.20:0.38)*ease(use.rise,0,0.27)*(1-ease(use.rise,0.38,0.86)));
    const baseGap=lowest(pants,probes.seat)-player.position.y;
    // During the descent preserve the standing hip height, only remove the seated clip's residual gap.
    model.position.y-=Math.max(-0.075,Math.min(0.075,baseGap))*w;
    player.updateMatrixWorld(true);
    for(const l of feet) {
      l.bones.forEach((b,i)=>l.save[i].copy(b.quaternion));
      l.foot.getWorldPosition(end); l.foot.getWorldQuaternion(rotation);
      const ankle=end.y-lowest(shoes,l.sole);
      target.copy(player.position).addScaledVector(forward,s.toeReach-0.018*l.sign).addScaledVector(right,0.15*l.sign);
      if (use.rise>0) {
        target.x+=s.x-player.position.x;
        target.z+=s.z-player.position.z;
      }
      target.y=s.feetY+ankle;
      if (s.kind==='bed') {
        if (use.rise>0) {
          const delay=l.sign>0?0:0.12;
          const step=ease(use.rise,0.22+delay,0.66+delay);
          target.x=MathUtils.lerp(target.x,use.exit.x-0.04*l.sign,step);
          target.y=MathUtils.lerp(s.feetY,use.exit.y,step)+ankle+0.05*Math.sin(Math.PI*step);
        } else {
          const floor=getWalkableFloorY(target.x,target.z,player.position.y);
          target.y=MathUtils.lerp(Math.min(floor,s.feetY),s.feetY,ease(use.t,0.30,0.63))+ankle;
        }
      }
      end.lerp(target,w);
      l.solve(end,rotation,kneePole(l,end,s.kind==='bed'));
    }
    // Bending the thighs changes the skinned seat of the trousers slightly.
    player.updateMatrixWorld(true);
    const adjust=Math.max(-0.035,Math.min(0.035,player.position.y-lowest(pants,probes.seat)))*w*w;
    if(Math.abs(adjust)>0.0004) {
      model.position.y+=adjust;
      for(const l of feet) {
        l.foot.getWorldPosition(target); target.y-=adjust;
        l.solve(target,l.foot.getWorldQuaternion(rotation),kneePole(l,target,s.kind==='bed'));
      }
    }
    // Soft seats keep the hands parked on the knees; hard seats borrow that pose
    // only while lowering or rising, the way people steady themselves mid-squat.
    const brace=(s.kind==='bed' || s.kind==='bag') ? w : use.rise>0
      ? ease(use.rise,0,0.18)*(1-ease(use.rise,0.45,0.80)) : w*(1-ease(use.t,0.82,1));
    if(brace>0) {
      for(const l of feet) {
        if(s.kind==='bed') {
          // Support the trunk from the mattress, independently of the knees.
          target.copy(player.position).addScaledVector(right,0.24*l.sign).addScaledVector(forward,0.07);
          target.y=player.position.y+0.065;
        } else {
          l.shin.getWorldPosition(target);
          target.y+=s.kind==='bag' ? 0.084 : 0.095;
          target.addScaledVector(forward,-0.064).addScaledVector(right,0.008*l.sign);
        }
        l.hand.getWorldPosition(end).lerp(target,brace);
        palm.copy(player.quaternion).multiply(faceDown);
        l.hand.getWorldQuaternion(rotation).slerp(palm,brace);
        pole.copy(right).multiplyScalar(0.72*l.sign).addScaledVector(forward,-0.55);pole.y=-0.57;
        l.reach(end,rotation,pole);
      }
    }
  }
  // Pushing up off a low seat: palms press down beside the hips while the torso rises.
  function push(player: Object3D, phase: number) {
    if(phase<=0 || phase>=1) return;
    active=true; player.updateMatrixWorld(true);
    player.getWorldDirection(forward); right.set(forward.z,0,-forward.x);
    fold(0.49*ease(phase,0,0.31)*(1-ease(phase,0.44,0.94)));
    for(const l of feet) {
      l.bones.forEach((b,i)=>l.save[i].copy(b.quaternion));
      // Tuck one heel first, then carry the hips over the planted feet.
      const delay=l.sign>0 ? 0 : 0.09;
      const plant=ease(phase,delay,0.30+delay)*(1-ease(phase,0.70,1));
      l.foot.getWorldPosition(end); l.foot.getWorldQuaternion(rotation);
      target.set(SLIDE.centerX-0.13*l.sign,player.position.y+end.y-lowest(shoes,l.sole),
        SLIDE.landingZ-0.05*l.sign);
      end.lerp(target,plant);
      pole.copy(forward).addScaledVector(right,0.14*l.sign); pole.y=0.45;
      l.solve(end,rotation,pole);
      const w=ease(phase,0,0.22)*(1-ease(phase,0.34,0.68));
      l.hand.getWorldPosition(end);
      target.copy(player.position).addScaledVector(forward,0.05).addScaledVector(right,0.235*l.sign);
      target.y=player.position.y+0.10;
      target.z=SLIDE.landingZ+0.34-0.05;
      end.lerp(target,w);
      palm.copy(player.quaternion).multiply(faceDown);
      l.hand.getWorldQuaternion(rotation).slerp(palm,w);
      pole.copy(right).multiplyScalar(0.68*l.sign).addScaledVector(forward,-0.42); pole.y=-0.55;
      l.reach(end,rotation,pole);
    }
  }
  return {fit,restore,push};
}

// Lower the pelvis while keeping the ankles on their sampled walking stride.
// This layer is applied last and undone first, including during a mattress rise.
export function createNookCrouch(model: Object3D) {
  const hips=model.getObjectByName('Hips')!, spine=model.getObjectByName('Spine')!;
  const home=new Vector3(), spineQ=new Quaternion(), pole=new Vector3(), at=new Vector3(), axis=new Vector3(), q=new Quaternion();
  const shoes=model.getObjectByName('Wolf3D_Outfit_Footwear') as SkinnedMesh;
  const lateral=new Vector3(), bend=new Vector3();
  const legs=['Left','Right'].map(side=>{
    const [a,b,end]=['UpLeg','Leg','Foot'].map(n=>model.getObjectByName(side+n)!);
    const sign=side==='Left'?1:-1;
    const sole=(model.userData.contacts.soles as number[]).filter(i=>sign*shoes.geometry.attributes.position.getX(i)>0);
    return {a,b,end,sign,sole,aq:new Quaternion(),bq:new Quaternion(),eq:new Quaternion(),
      anchor:new Vector3(),orientation:new Quaternion(),solve:makeLegSolver(a,b,end)};
  });
  let active=false;
  return {
    fit(player:Object3D,w:number) {
      if(w<=0) return;
      active=true;
      home.copy(hips.position); spineQ.copy(spine.quaternion);
      player.updateMatrixWorld(true);
      const standingSurface=getWalkableFloorY(player.position.x,player.position.z,player.position.y);
      for(const l of legs) {
        l.aq.copy(l.a.quaternion); l.bq.copy(l.b.quaternion); l.eq.copy(l.end.quaternion);
        l.end.getWorldPosition(l.anchor); l.end.getWorldQuaternion(l.orientation);
        // Pin the sole, not the ankle from the idle/lounge crossfade: that
        // intermediate pose can already be underneath the upholstered surface.
        let lift=0;
        for(const i of l.sole) {
          shoes.getVertexPosition(i,at).applyMatrix4(shoes.matrixWorld);
          const surface=Math.min(NOOK_PADS.top,Math.max(standingSurface,getWalkableFloorY(at.x,at.z,player.position.y)));
          lift=Math.max(lift,surface-at.y);
        }
        l.anchor.y+=lift;
      }
      player.getWorldDirection(pole);
      hips.getWorldPosition(at);
      // The lounge clip already lowers the hips. Only supply the remaining
      // crouch; stacking a full squat onto that clip folds the knees up.
      const drop=Math.min(0.46*w,Math.max(0,at.y-player.position.y-0.46));
      at.addScaledVector(pole,-0.085*drop/0.46); at.y-=drop;
      hips.position.copy(hips.parent!.worldToLocal(at));
      lateral.set(pole.z,0,-pole.x);
      axis.copy(lateral).applyQuaternion(spine.parent!.getWorldQuaternion(q).invert());
      spine.quaternion.premultiply(q.setFromAxisAngle(axis.normalize(),0.52*w));
      for(const l of legs) {
        l.a.getWorldPosition(at);
        bend.subVectors(l.anchor,at).cross(lateral).normalize().addScaledVector(lateral,0.22*l.sign);
        l.solve(l.anchor,l.orientation,bend);
      }
    },
    restore() {
      if(!active) return;
      hips.position.copy(home); spine.quaternion.copy(spineQ);
      for(const l of legs) {l.a.quaternion.copy(l.aq);l.b.quaternion.copy(l.bq);l.end.quaternion.copy(l.eq);}
      active=false;
    },
  };
}
