import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AnimationMixer, Group, MeshBasicMaterial, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCatRoutine, CAT_SCALE } from '../src/scene/catRoutine.ts';
import { createFurContact, createPetPose } from '../src/scene/petContact.ts';
import { beginPet, advancePet, createPetInteraction, petSpot, releasePet } from '../src/scene/petInteraction.ts';
import { ROOM } from '../src/scene/layout.ts';
import { meshHeight } from './mesh-height.mjs';

const at = (x,z,y=ROOM.turfY) => new Vector3(x,y,z);
test('petting uses a reachable approach, cannot stack, and finishes or cancels without a position jump', () => {
  const pos=at(-1,-4.1), cat=at(-1,-3), p=createPetInteraction();
  assert.equal(petSpot(at(-1,-5),cat,p.stance),false);
  assert.equal(petSpot(at(-1,-4,0.7),cat,p.stance),false);
  assert.equal(petSpot(at(2.5,-2.53),at(2.5,-3.25),p.stance),false);
  assert.ok(beginPet(p,pos,cat,false)); assert.equal(beginPet(p,pos,cat,false),false);
  let yaw=Math.PI;
  for (let i=0;i<132;i++) {
    const previous=pos.clone(); yaw=advancePet(p,pos,yaw,1/60);
    assert.ok(pos.distanceTo(previous)<=1.16/60);
  }
  assert.equal(p.weight,1); assert.ok(Math.abs(pos.distanceTo(cat)-0.56)<0.007);
  releasePet(p);
  for (let i=0;i<40;i++) { const previous=p.weight; advancePet(p,pos,yaw,1/60); assert.ok(p.weight<=previous); }
  assert.equal(p.phase,'off');
  assert.ok(beginPet(p,pos,cat,true));
  for (let i=0;i<420;i++) yaw=advancePet(p,pos,yaw,1/60);
  assert.equal(p.phase,'off'); assert.equal(p.weight,0);
});

test('a sleeping cat stays curled during a stroke; an awake cat waits and then resumes wandering', () => {
  const { state, update }=createCatRoutine({groom:7.3,settle:3.8,wake:2.3},()=>0.35);
  const check=(mode)=>{
    const anchor=at(state.x,state.z), visitor=at(state.x,state.z-0.56);
    for (let i=0;i<420;i++) { update(1/60,visitor,true); assert.equal(state.mode,mode); assert.equal(state.distance,0); }
    assert.equal(state.x,anchor.x); assert.equal(state.z,anchor.z);
    for (let i=0;i<420;i++) update(1/60,visitor);
    assert.ok(anchor.distanceTo(at(state.x,state.z))>0.4);
  };
  check('idle');
  for (let i=0; i<6000 && state.mode!=='sleep';i++) update(1/60,null);
  assert.equal(state.mode,'sleep'); check('sleep');
});

test('palm and all five fingers clear the posed cat throughout contact from eight sides, awake and curled up', async () => {
  const loader=new GLTFLoader().register(()=>({name:'headless',loadMaterial:async()=>new MeshBasicMaterial()}));
  async function rig(id,scale) {
    const b=await readFile(new URL(`../public/models/studio-${id}.glb`,import.meta.url));
    const {scene,animations}=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'');
    const root=new Group(), mixer=new AnimationMixer(scene); root.add(scene); scene.scale.setScalar(scale);
    return {root, scene, play(name) {mixer.stopAllAction(); mixer.clipAction(animations.find(c=>c.name===name)).play();mixer.setTime(0.62);} };
  }
  const cat=await rig('cat',CAT_SCALE), human=await rig('visitor',0.95), p=createPetInteraction();
  const contact=createFurContact(cat.scene), pose=createPetPose(human.scene), v=new Vector3();
  const body=human.scene.getObjectByName('Wolf3D_Body'), shoes=human.scene.getObjectByName('Wolf3D_Outfit_Footwear');
  const hand=[];
  for (let i=0;i<body.geometry.attributes.position.count;i++) {
    if (body.skeleton.bones[body.geometry.attributes.skinIndex.getX(i)].name.startsWith('RightHand')) hand.push(i);
  }
  cat.root.position.copy(at(1,-4)); human.play('idle');
  for (const clip of ['idle','sleep']) {
    cat.play(clip); cat.root.updateMatrixWorld(true);
    const surface=meshHeight(cat.scene.getObjectByName('Shorthaired_calico_in_knit_vest'));
    for (const angle of Array.from({length:8},(_,i)=>i*Math.PI/4)) {
      human.root.position.copy(cat.root.position).add(at(-0.56*Math.sin(angle),-0.56*Math.cos(angle),0));
      human.root.rotation.y=angle+0.3; human.root.updateMatrixWorld(true);
      const wrist=human.scene.getObjectByName('RightHand'), before=wrist.getWorldPosition(new Vector3());
      for (const [t,weight] of [[0,0.72],[0,0.9],[0,1],[0.25,1],[0.5,1],[0.75,1],[1,1],[1,0.8]]) {
        p.weight=weight; contact(t,p.contact); p.surface=contact.heightAt;
        pose.fit(human.root,p); human.root.updateMatrixWorld(true);
        let gap=Infinity;
        for (const i of hand) {
          body.getVertexPosition(i,v).applyMatrix4(body.matrixWorld);
          gap=Math.min(gap,v.y-surface(v.x,v.z));
        }
        assert.ok(gap>=-0.001,`${clip} yaw ${angle} stroke ${t} weight ${weight}: hand penetrates ${-gap} m`);
        if (weight===1) assert.ok(gap<0.018,`${clip} yaw ${angle} stroke ${t}: hand floats ${gap} m`);
        let low=Infinity;
        for (const i of human.scene.userData.contacts.soles) low=Math.min(low,shoes.getVertexPosition(i,v).applyMatrix4(shoes.matrixWorld).y);
        assert.ok(Math.abs(low-ROOM.turfY)<0.012,`shoe ${low}`);
        pose.restore(); assert.ok(wrist.getWorldPosition(v).distanceTo(before)<1e-5);
      }
    }
  }
});
