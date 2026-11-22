import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AnimationMixer, Group, MeshBasicMaterial, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GALLERY_CHAIRS, getWalkableFloorY, hitsBeanbag, NOOK_PADS, ROOM, TURF_BEANBAGS } from '../src/scene/layout.ts';
import { advanceSeat, nearbySeat, takeSeat } from '../src/scene/seating.ts';
import { createNookCrouch, createSeatedPose } from '../src/scene/seatedPose.ts';
import { meshHeight } from './mesh-height.mjs';

const approach=[];
for(const b of TURF_BEANBAGS) {
  for(let i=0;i<60;i++) {
    const p=new Vector3(b.x+0.93*Math.sin(i*Math.PI/30),ROOM.turfY,b.z+0.93*Math.cos(i*Math.PI/30));
    if(!hitsBeanbag(p.x,p.z,0.28)&&p.z<ROOM.turfEndZ&&nearbySeat(p)?.id===`beanbag-${b.seed}`) {approach.push(p);break;}
  }
}
for(const z of NOOK_PADS.z) approach.push(new Vector3(ROOM.nookWallX-0.6,0,z));
for(const c of GALLERY_CHAIRS) approach.push(new Vector3(c.x+0.9,0,c.z));
for(let i=0;i<ROOM.tierCount;i++) approach.push(new Vector3(-1,(i+1)*ROOM.tierHeight,ROOM.stairsStartZ+(i+0.30)*ROOM.tierDepth));

test('all seats release the visitor in front, facing away regardless of approach yaw',()=>{
  assert.equal(new Set(approach.map(p=>nearbySeat(p)?.id)).size,15);
  for(const from of approach) {
    const s=nearbySeat(from),use=takeSeat(s,from,0.45),p=from.clone();
    let old=p.clone();
    for(let i=0;i<105;i++) {advanceSeat(use,p,1/60);assert.ok(p.distanceTo(old)<0.045);old.copy(p);}
    assert.ok(p.distanceTo(new Vector3(s.x,s.y,s.z))<0.0001);
    if(s.kind==='bed') assert.equal(s.z,from.z);
    use.leaving=true;
    let previous=0;
    for(let i=0;i<105;i++) {
      const yaw=advanceSeat(use,p,1/60);
      assert.ok(Math.cos(yaw-s.yaw)>0.999999);
      const forward=(p.x-s.x)*Math.sin(yaw)+(p.z-s.z)*Math.cos(yaw);
      assert.ok(forward>=previous-1e-8 && p.distanceTo(old)<0.045,s.id);
      previous=forward; old.copy(p);
    }
    assert.ok(previous>(s.kind==='bed'?0.35:s.toeReach));
    assert.equal(p.y,getWalkableFloorY(p.x,p.z,s.feetY));
    assert.equal(use.weight,0);
  }
  assert.equal(nearbySeat(new Vector3(-1,0,-5)),null);
  assert.equal(nearbySeat(new Vector3(ROOM.nookWallX-0.6,2.4,NOOK_PADS.z[0])),null);
});

async function loadVisitor() {
  const loader=new GLTFLoader().register(()=>({name:'headless',loadMaterial:async()=>new MeshBasicMaterial()}));
  const bytes=await readFile(new URL('../public/models/studio-visitor.glb',import.meta.url));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
}

test('mattress transitions keep knees apart and soles above both pads and their seam',async()=>{
  const {scene:model,animations}=await loadVisitor(),group=new Group();
  group.add(model);model.scale.setScalar(0.95);
  const mixer=new AnimationMixer(model),sit=createSeatedPose(model),duck=createNookCrouch(model);
  const idle=mixer.clipAction(animations.find(c=>c.name==='idle')).play();
  const lounge=mixer.clipAction(animations.find(c=>c.name==='lounge')).play();
  const knees=['LeftLeg','RightLeg'].map(n=>model.getObjectByName(n));
  const shoes=model.getObjectByName('Wolf3D_Outfit_Footwear'),v=new Vector3();
  for(const z of NOOK_PADS.z) {
    const from=new Vector3(NOOK_PADS.x-0.24,NOOK_PADS.top,z),use=takeSeat(nearbySeat(from),from,-Math.PI/2);
    group.position.copy(from);
    for(const leaving of [false,true]) {
      use.leaving=leaving;
      do {
        duck.restore();sit.restore();
        group.rotation.y=advanceSeat(use,group.position,1/60);
        lounge.weight=use.weight;idle.weight=1-use.weight;mixer.update(1/60);
        sit.fit(group,use);duck.fit(group,1-use.weight);group.updateMatrixWorld(true);
        const [left,right]=knees.map(b=>group.worldToLocal(b.getWorldPosition(v)).x);
        assert.ok(left>0.04 && right< -0.04,`knees crossed at ${use.t}/${use.rise}: ${left},${right}`);
        for(const side of ['Left','Right']) {
          const y=part=>model.getObjectByName(side+part).getWorldPosition(v).y;
          const shoulder=y('Arm'),handGap=shoulder-y('Hand'),kneeGap=shoulder-y('Leg');
          assert.ok(handGap>0.18 && kneeGap>0.21,
            `${side} crowded chest at ${use.t}/${use.rise}: wrist ${handGap}, knee ${kneeGap}`);
        }
        for(const i of model.userData.contacts.soles) {
          shoes.getVertexPosition(i,v).applyMatrix4(shoes.matrixWorld);
          assert.ok(v.y>=getWalkableFloorY(v.x,v.z,group.position.y)-0.012,`shoe inside pad at ${use.t}/${use.rise}: ${v.toArray()}`);
        }
      } while((leaving?use.rise:use.t)<1);
    }
  }
  const seam=(NOOK_PADS.z[0]+NOOK_PADS.z[1])/2;
  assert.equal(getWalkableFloorY(NOOK_PADS.x,seam,NOOK_PADS.top),NOOK_PADS.top);
});

test('seated trousers and both shoe soles meet their respective supports, inside the chosen mattress or in front of the bench',async()=>{
  const {scene:model,animations}=await loadVisitor();
  const group=new Group();group.add(model);model.scale.setScalar(0.95);
  const mixer=new AnimationMixer(model), fit=createSeatedPose(model);
  mixer.clipAction(animations.find(c=>c.name==='lounge')).play();mixer.update(0.6);
  const pants=model.getObjectByName('Wolf3D_Outfit_Bottom'), shoes=model.getObjectByName('Wolf3D_Outfit_Footwear'), v=new Vector3();
  for(const from of approach) {
    const s=nearbySeat(from), use=takeSeat(s,from,0.45);use.weight=1;
    group.position.set(s.x,s.y,s.z);group.rotation.y=s.yaw;fit.fit(group,use);group.updateMatrixWorld(true);
    const gaps=[Infinity,Infinity,Infinity];
    for (const [m,k] of [[pants,0],[shoes,1]]) {
      const a=m.geometry.attributes.position;
      for(let i=0;i<a.count;i++) {
        if(!k&&a.getY(i)<0.78) continue;
        m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld);
        if(s.kind==='bed') {
          assert.ok(Math.abs(v.z-s.z)<NOOK_PADS.depth/2 && Math.abs(v.x-NOOK_PADS.x)<NOOK_PADS.width/2,
            `${s.id} leaves mattress at ${v.toArray()}`);
        }
        const h=!k ? s.y : getWalkableFloorY(v.x,v.z,s.feetY);
        const side=k&&a.getX(i)<0?2:k;
        gaps[side]=Math.min(gaps[side],v.y-h);
      }
    }
    for(const g of gaps) assert.ok(Math.abs(g)<0.012,`${s.id} gaps ${gaps}`);
    if(s.kind==='bag' || s.kind==='bed') {
      const body=model.getObjectByName('Wolf3D_Body'), top=meshHeight(pants), contact=[Infinity,Infinity];
      for(let i=0;i<body.geometry.attributes.position.count;i++) {
        const name=body.skeleton.bones[body.geometry.attributes.skinIndex.getX(i)].name;
        if (!name.includes('Hand')) continue;
        body.getVertexPosition(i,v).applyMatrix4(body.matrixWorld);
        const side=Number(name.startsWith('Right'));
        contact[side]=Math.min(contact[side],v.y-(s.kind==='bed'?s.y:top(v.x,v.z)));
      }
      assert.ok(contact.every(g=>g>=-0.003 && g<0.018),`${s.id} hands vs support: ${contact}`);
    }
    fit.restore();
  }
});
