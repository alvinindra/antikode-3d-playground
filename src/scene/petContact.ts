import { Bone, MathUtils, Matrix4, Object3D, Quaternion, SkinnedMesh, Vector3 } from 'three';
import { makeLegSolver } from './legIK.ts';
import type { PetInteraction } from './petInteraction.ts';

// The two contact meshes have immutable bind positions (no position morphs).
// Cache joint/weight lookups and compute world skinning matrices once per pose,
// rather than multiplying the same matrices for every vertex influence.
function makeSkinSampler(mesh: SkinnedMesh, source: number[]) {
  const { position, skinIndex, skinWeight }=mesh.geometry.attributes;
  const { bones, boneInverses }=mesh.skeleton;
  const base=source.map(i=>new Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.bindMatrix));
  const offsets=new Uint32Array(source.length+1), joints:number[]=[], weights:number[]=[];
  const matrices=bones.map(()=>new Matrix4()), used=new Set<number>(), toWorld=new Matrix4();
  source.forEach((id,i)=>{
    offsets[i]=joints.length;
    for(let k=0;k<4;k++) {
      const w=skinWeight.getComponent(id,k);
      if(!w) continue;
      const j=skinIndex.getComponent(id,k);
      used.add(j); joints.push(j); weights.push(w);
    }
  });
  offsets[source.length]=joints.length;
  return {
    update() {
      toWorld.multiplyMatrices(mesh.matrixWorld,mesh.bindMatrixInverse);
      for(const j of used) matrices[j].multiplyMatrices(bones[j].matrixWorld,boneInverses[j]);
    },
    read(i: number,out: Vector3) {
      const {x,y,z}=base[i];
      let ox=0, oy=0, oz=0;
      for(let k=offsets[i];k<offsets[i+1];k++) {
        const m=matrices[joints[k]].elements, w=weights[k];
        ox+=w*(m[0]*x+m[4]*y+m[8]*z+m[12]);
        oy+=w*(m[1]*x+m[5]*y+m[9]*z+m[13]);
        oz+=w*(m[2]*x+m[6]*y+m[10]*z+m[14]);
      }
      return out.set(ox,oy,oz).applyMatrix4(toWorld);
    }
  };
}

// Sample the visible dorsal skin, not a bone centre. The same samples follow a curled, breathing cat.
export function createFurContact(model: Object3D) {
  const mesh=model.getObjectByName('Shorthaired_calico_in_knit_vest') as SkinnedMesh;
  const a=mesh.geometry.attributes.position, v=new Vector3(), tmp=new Vector3();
  // Spatial bins accelerate vertical intersections, not a dilated height map: a
  // fingertip beside the ear must not be lifted to the height of the ear tip.
  const gridSize=80, cell=0.009, bins=Array.from({length:gridSize**2},()=>[] as number[]);
  const counts=new Uint32Array(bins.length);
  const chosen=new Map<string,number>(), joints=mesh.geometry.attributes.skinIndex;
  const source:number[]=[], mapped=new Int32Array(a.count), tris:number[]=[];
  for (let i=0;i<a.count;i++) {
    if (mesh.skeleton.bones[joints.getX(i)].name.startsWith('whisker')) { mapped[i]=-1; continue; }
    const key=[a.getX(i),a.getY(i),a.getZ(i)].map(p=>Math.round(p/0.0045)).join(',');
    if (!chosen.has(key)) { chosen.set(key,source.length); source.push(i); }
    mapped[i]=chosen.get(key)!;
  }
  const idx=mesh.geometry.index!.array;
  for(let i=0;i<idx.length;i+=3) {
    const x=mapped[idx[i]], y=mapped[idx[i+1]], z=mapped[idx[i+2]];
    if(x>=0 && y>=0 && z>=0 && x!==y && y!==z && z!==x) tris.push(x,y,z);
  }
  const vertices=source.map(()=>new Vector3()), projected=new Float64Array(tris.length*3);
  const sampler=makeSkinSampler(mesh,source);
  let left=0, back=0;
  function updateSurface(center: Vector3) {
    left=center.x-gridSize*cell/2; back=center.z-gridSize*cell/2;
    counts.fill(0);
    sampler.update();
    for(let i=0;i<source.length;i++) sampler.read(i,vertices[i]);
    for(let i=0;i<tris.length;i+=3) {
      const A=vertices[tris[i]], B=vertices[tris[i+1]], C=vertices[tris[i+2]], k=i*3;
      const u=B.x-A.x, v=B.z-A.z, s=C.x-A.x, t=C.z-A.z, det=u*t-v*s;
      if(Math.abs(det)<1e-10) continue;
      projected[k]=A.x; projected[k+1]=A.z; projected[k+2]=A.y;
      projected[k+3]=t/det; projected[k+4]=-s/det; projected[k+5]=-v/det; projected[k+6]=u/det;
      projected[k+7]=B.y-A.y; projected[k+8]=C.y-A.y;
      const minX=Math.max(0,Math.floor((Math.min(A.x,B.x,C.x)-left)/cell));
      const maxX=Math.min(gridSize-1,Math.floor((Math.max(A.x,B.x,C.x)-left)/cell));
      const minZ=Math.max(0,Math.floor((Math.min(A.z,B.z,C.z)-back)/cell));
      const maxZ=Math.min(gridSize-1,Math.floor((Math.max(A.z,B.z,C.z)-back)/cell));
      for(let z=minZ;z<=maxZ;z++) for(let x=minX;x<=maxX;x++) {
        const bin=z*gridSize+x;
        bins[bin][counts[bin]++]=k;
      }
    }
  }
  function heightAt(x: number,z: number) {
    const ix=Math.floor((x-left)/cell), iz=Math.floor((z-back)/cell);
    if (ix<0 || iz<0 || ix>=gridSize || iz>=gridSize) return -Infinity;
    let h=-Infinity;
    const bin=iz*gridSize+ix, entries=bins[bin];
    for(let i=0;i<counts[bin];i++) {
      const k=entries[i];
      const dx=x-projected[k], dz=z-projected[k+1];
      const b=dx*projected[k+3]+dz*projected[k+4], c=dx*projected[k+5]+dz*projected[k+6];
      if(b>=0 && c>=0 && b+c<=1) h=Math.max(h,projected[k+2]+b*projected[k+7]+c*projected[k+8]);
    }
    return h;
  }
  const rows=Array.from({length:9},(_,j)=>{
    const z=0.088-j*0.017;
    return [-0.032,0,0.032].map(x=>{
      let best=Infinity, index=0;
      for (let i=0;i<a.count;i++) {
        const score=(a.getX(i)-x)**2 + (a.getZ(i)-z)**2 + (a.getY(i)-0.272)**2*0.65;
        if (score<best) { best=score; index=i; }
      }
      return index;
    });
  });
  const dorsal=(row: number,out: Vector3)=>{
    out.y=-Infinity;
    for (const i of rows[row]) {
      mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);
      if (v.y>out.y) out.copy(v);
    }
    return out;
  };
  return Object.assign((stroke: number, out: Vector3)=>{
    const t=stroke*(rows.length-1), i=Math.floor(t);
    dorsal(i,out).lerp(dorsal(Math.min(i+1,rows.length-1),tmp),t-i);
    updateSurface(out);
    out.y=Math.max(out.y,heightAt(out.x,out.z));
    return out;
  }, { heightAt });
}

export function createPetPose(model: Object3D) {
  const bone=(n: string)=>model.getObjectByName(n)!;
  const hips=bone('Hips'), spine=bone('Spine'), chest=bone('Spine1'), neck=bone('Neck');
  const chain=(side: string, names: string[])=>{
    const [a,b,end]=names.map(n=>bone(side+n));
    return { a,b,end,solve:makeLegSolver(a,b,end), at:new Vector3(), q:new Quaternion() };
  };
  const legs=['Left','Right'].map(s=>chain(s,['UpLeg','Leg','Foot']));
  const arms=['Left','Right'].map(s=>chain(s,['Arm','ForeArm','Hand']));
  const touched=[hips,spine,chest,neck,...[...legs,...arms].flatMap(l=>[l.a,l.b,l.end])];
  const saved=touched.map(b=>b.quaternion.clone()), home=new Vector3();
  const forward=new Vector3(), side=new Vector3(), pole=new Vector3(), at=new Vector3(), desired=new Vector3();
  const q=new Quaternion(), palm=new Quaternion(), world=new Quaternion(), inverse=new Quaternion();
  const restBend=new Vector3(), line=new Vector3();
  const axis=new Vector3(1,0,0);
  const down=new Quaternion().setFromAxisAngle(axis,Math.PI/2+0.06);
  // Right-hand local +Y runs from the wrist to the knuckles, +Z is the palm surface.
  const pad=new Vector3(), expected=new Vector3(0.009,0.075,0.019);
  const skin=bone('Wolf3D_Body') as SkinnedMesh, attrs=skin.geometry.attributes;
  const wrist=skin.skeleton.bones.indexOf(arms[1].end as Bone);
  const fingers=skin.skeleton.bones.filter(b=>/^RightHand(Thumb|Index|Middle|Ring|Pinky)[123]$/.test(b.name)).map(b=>{
    const bi=skin.skeleton.bones.indexOf(b), pi=skin.skeleton.bones.indexOf(b.parent as Bone);
    const rest=new Matrix4().multiplyMatrices(skin.skeleton.boneInverses[pi],skin.skeleton.boneInverses[bi].clone().invert());
    return { bone:b, rest:new Quaternion().setFromRotationMatrix(rest) };
  });
  const handSamples:number[]=[];
  for (const f of fingers) { touched.push(f.bone); saved.push(new Quaternion()); }
  let nearest=Infinity;
  for (let i=0;i<attrs.position.count;i++) {
    if (skin.skeleton.bones[attrs.skinIndex.getX(i)].name.startsWith('RightHand')) handSamples.push(i);
    if (attrs.skinIndex.getX(i)!==wrist || attrs.skinWeight.getX(i)<0.97) continue;
    at.fromBufferAttribute(attrs.position,i).applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[wrist]);
    const score=at.distanceToSquared(expected);
    if (score<nearest) { nearest=score; pad.copy(at); }
  }
  const hand=makeSkinSampler(skin,handSamples);
  let applied=false;
  function restore() {
    if (!applied) return;
    hips.position.copy(home);
    touched.forEach((b,i)=>b.quaternion.copy(saved[i]));
    applied=false;
  }
  function fit(player: Object3D, pet: PetInteraction) {
    const w=pet.weight;
    if (!w) return;
    applied=true; home.copy(hips.position); touched.forEach((b,i)=>saved[i].copy(b.quaternion));
    player.getWorldQuaternion(world); player.getWorldDirection(forward); side.set(forward.z,0,-forward.x);
    const scale=model.scale.y;
    const low=MathUtils.smoothstep(0.28-pet.contact.y+player.position.y,0,0.16);
    for (const l of legs) { l.end.getWorldPosition(l.at); l.end.getWorldQuaternion(l.q); }
    hips.position.y-=(0.62+0.045*low)*w/scale; hips.position.z-=0.052*w/scale;
    function lean(b: Object3D, angle: number) {
      q.setFromAxisAngle(side,angle*w).multiply(b.getWorldQuaternion(palm));
      b.quaternion.copy(b.parent!.getWorldQuaternion(inverse).invert().multiply(q));
    }
    lean(hips,0.77+0.08*low); lean(spine,0.20+0.13*low); lean(chest,0.11); lean(neck,-0.14-0.08*low);
    for (const f of fingers) f.bone.quaternion.slerp(f.rest,w*0.93);
    function easePole(l: ReturnType<typeof chain>) {
      l.a.getWorldPosition(at); l.b.getWorldPosition(restBend); l.end.getWorldPosition(line);
      restBend.sub(at).projectOnPlane(line.sub(at).normalize());
      if (restBend.lengthSq()>1e-7) pole.lerp(restBend.normalize(),1-MathUtils.smoothstep(w,0,0.44));
    }
    for (const [i,l] of legs.entries()) {
      pole.copy(forward).addScaledVector(side,i?-0.56:0.56);
      easePole(l);
      l.solve(l.at,l.q,pole);
    }
    for (const [i,arm] of arms.entries()) {
      arm.end.getWorldQuaternion(q); arm.end.getWorldPosition(arm.at);
      if (i===1) {
        desired.copy(pet.contact);
        desired.y+=0.16*Math.sin(Math.PI*w);
        palm.copy(world).multiply(down);
      } else {
        legs[0].b.getWorldPosition(desired);
        desired.y+=0.046; desired.addScaledVector(forward,-0.020);
        palm.copy(world).multiply(down);
      }
      desired.sub(at.copy(pad).multiplyScalar(scale).applyQuaternion(palm));
      arm.at.lerp(desired,w); arm.q.copy(q).slerp(palm,w);
      pole.copy(side).multiplyScalar(i?-0.85:0.75).addScaledVector(forward,-0.45); pole.y=-0.52;
      easePole(arm);
      arm.solve(arm.at,arm.q,pole);
      if (i===1 && pet.surface) {
        // A correctly placed wrist still lets a curved finger pass through a shoulder or ear.
        // Lift the IK target by the deepest signed contact over the actual deformed hand.
        for (let pass=0;pass<3;pass++) {
          skin.updateWorldMatrix(true,false);
          arm.a.updateWorldMatrix(true,true);
          hand.update();
          let lift=0;
          for (let j=0;j<handSamples.length;j++) {
            hand.read(j,at);
            lift=Math.max(lift,pet.surface(at.x,at.z)+0.004-at.y);
          }
          if (lift<0.0005) break;
          arm.at.y+=lift;
          arm.solve(arm.at,arm.q,pole);
        }
      }
    }
  }
  return { fit,restore };
}
