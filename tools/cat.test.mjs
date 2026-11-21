import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AnimationMixer, MeshBasicMaterial, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { blocksCatFootprint, createCatRoutine } from '../src/scene/catRoutine.ts';
import { getWalkableFloorY, hitsBeanbag, ROOM } from '../src/scene/layout.ts';

const bytes = await readFile(new URL('../public/models/studio-cat.glb', import.meta.url));
const loader = new GLTFLoader().register(() => ({ name: 'headless-material', loadMaterial: async () => new MeshBasicMaterial() }));
const { animations, scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '');
const clips = Object.fromEntries(animations.map(clip => [clip.name, clip]));
const timings = Object.fromEntries(animations.map(clip => [clip.name, clip.duration]));
const visitor = { x: -0.35, y: ROOM.turfY, z: -3.4 };
const separation = (a,b) => Math.hypot(a.x-b.x, a.z-b.z);
function routine(seed) {
  return createCatRoutine(timings, () => ((seed = (Math.imul(seed,1664525)+1013904223) >>> 0) / 4294967296));
}

test('the cat visits multiple stops, washes, sleeps and wakes without leaving the clear turf', () => {
  for (const hz of [30, 120]) for (const seed of [23, 64]) {
    const { state, update } = routine(seed), seen = new Set();
    let walked = 0, xmin = state.x, xmax = state.x;
    for (let i=0; i<120*hz; i++) {
      const before = { ...state };
      update(1/hz, visitor); seen.add(state.mode);
      const step = separation(state,before);
      assert.ok(step <= 0.61/hz && Math.abs(step-state.distance) < 1e-10);
      if (before.mode !== 'walk') assert.equal(step,0);
      assert.equal(hitsBeanbag(state.x,state.z,0.42),false);
      assert.equal(getWalkableFloorY(state.x,state.z,0),ROOM.turfY);
      assert.ok(separation(state,visitor) >= 0.78);
      walked += step; xmin = Math.min(xmin,state.x); xmax = Math.max(xmax,state.x);
    }
    assert.ok(walked>10 && xmax-xmin>1.6);
    assert.deepEqual(seen,new Set(['walk','idle','groom','settle','sleep','wake']));
  }
});

test('a visitor in the route is avoided; approaching a sleeping cat wakes it without trapping the player', () => {
  const { state, update } = routine(19), person = { x: -0.25, z: -2.39, y: ROOM.turfY };
  let slept = false;
  for (let i=0; i<60*100; i++) {
    update(1/60,person);
    assert.ok(separation(state,person) >= 0.78);
    if (state.mode==='sleep') { slept = true; break; }
  }
  assert.ok(slept);
  person.x=state.x; person.z=state.z-0.62;
  update(1/60,person); assert.equal(state.mode,'wake');
  const body = { ...state, y: ROOM.turfY }, at = { x: state.x, z: state.z-0.55 };
  assert.equal(blocksCatFootprint(body,at.x,ROOM.turfY,at.z+0.04,at),true);
  assert.equal(blocksCatFootprint(body,at.x,ROOM.turfY,at.z-0.04,at),false);
  assert.equal(blocksCatFootprint(body,at.x,1.0,at.z+0.04,at),false);
  for (let i=0;i<60*7;i++) update(1/60, person);
  assert.ok(separation(state,person)>1);
});

test('posed skin stays grounded, the washing paw meets the tongue, and sleep closes both eyes', () => {
  const mix = new AnimationMixer(scene), mesh = scene.getObjectByName('Shorthaired_calico_in_knit_vest');
  const { skinIndex } = mesh.geometry.attributes, bones = mesh.skeleton.bones;
  const head = scene.getObjectByName('head'), tongue = scene.getObjectByName('Tongue');
  const eyes = ['Eyelids','Sage_eye_L','Sage_eye_R'].map(n => scene.getObjectByName(n));
  const paw = [], points = [...new Set(mesh.geometry.index.array)];
  for (const i of points) {
    if (/^(metacarpus|fpaw)L$/.test(bones[skinIndex.getX(i)].name)) paw.push(i);
  }
  const v = new Vector3(), tip = new Vector3();
  const sample = t => { mix.setTime(t); scene.updateMatrixWorld(true); };
  const play = name => { mix.stopAllAction(); mix.clipAction(clips[name]).reset().play(); };
  const stride = scene.getObjectByName('Studio_cat_rig').userData.strideMeters;
  assert.ok(stride > 0.25 && stride < 0.5);
  for (const [clip, times] of [['walk',[0,0.13,0.32,0.55]], ['groom',[0.7,1.96,3.35]], ['settle',[1.6,3.1]], ['sleep',[0.3,1.1,3.4]], ['wake',[0.3,1.8]]]) {
    play(clip);
    for (const t of times) {
      sample(t);
      let low = Infinity;
      for (const i of points) low = Math.min(low,mesh.getVertexPosition(i,v).y);
      assert.ok(Math.abs(low)<0.0035, `${clip} at ${t}: floor gap ${low}`);
      if (clip==='sleep') {
        assert.ok(head.getWorldPosition(v).y<0.10);
        assert.ok(eyes.every(eye=>eye.morphTargetInfluences[0]>0.98));
      }
    }
  }
  play('groom');
  let contacts = 0;
  for (let i=0; i<=48; i++) {
    sample(1.5+i/48);
    tongue.localToWorld(tip.set(0,0,1));
    if (paw.some(j=>mesh.getVertexPosition(j,v).distanceTo(tip)<0.007)) contacts++;
  }
  assert.ok(contacts>=5, `only ${contacts} grooming samples reach the tongue`);
});
