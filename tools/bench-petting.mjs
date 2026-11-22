import { readFile } from 'node:fs/promises';
import { AnimationMixer, Group, MeshBasicMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CAT_SCALE } from '../src/scene/catRoutine.ts';
import { createFurContact, createPetPose } from '../src/scene/petContact.ts';
import { createPetInteraction } from '../src/scene/petInteraction.ts';

const loader=new GLTFLoader().register(()=>({name:'headless',loadMaterial:async()=>new MeshBasicMaterial()}));
async function rig(name,scale) {
  const bytes=await readFile(new URL(`../public/models/studio-${name}.glb`,import.meta.url));
  const {scene,animations}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
  const root=new Group(), mixer=new AnimationMixer(scene);
  root.add(scene); scene.scale.setScalar(scale);
  mixer.clipAction(animations.find(c=>c.name==='idle')).play();
  return {scene,root,mixer};
}
const cat=await rig('cat',CAT_SCALE), human=await rig('visitor',0.95);
const fur=createFurContact(cat.scene), pose=createPetPose(human.scene), pet=createPetInteraction();
human.root.position.z=-0.56; human.root.rotation.y=0.3;
pet.weight=1; pet.surface=fur.heightAt;
const samples=[[],[],[]];
for(let i=0;i<900;i++) {
  pose.restore(); human.mixer.update(1/60); cat.mixer.update(1/60);
  human.root.updateMatrixWorld(true); cat.root.updateMatrixWorld(true);
  pet.stroke=(1-Math.cos(i*2*Math.PI/105))/2;
  const start=performance.now();
  fur(pet.stroke,pet.contact);
  const middle=performance.now();
  pose.fit(human.root,pet);
  const end=performance.now();
  if(i>=180) {
    samples[0].push(middle-start); samples[1].push(end-middle); samples[2].push(end-start);
  }
}
for(const [i,name] of ['Fur','Hand/IK','Total'].entries()) {
  const times=samples[i].sort((a,b)=>a-b);
  console.log(`${name}: median ${times[times.length/2].toFixed(2)} ms, p95 ${times[Math.floor(times.length*0.95)].toFixed(2)} ms`);
}
