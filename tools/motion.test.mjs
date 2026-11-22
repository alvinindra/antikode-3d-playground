import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AnimationMixer, Box3, Group, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { getSlideYAtZ, getTreadSupportY, getWalkableFloorY, ROOM, SLIDE, stairInfluence, travelBaseY, WALK_STEP } from '../src/scene/layout.ts';
import { beginSlide, sampleRide } from '../src/scene/slideRide.ts';
import { createSeatContact } from '../src/scene/surfaceContact.ts';
import { createSeatedPose } from '../src/scene/seatedPose.ts';
import { createTreadFooting } from '../src/scene/treadFooting.ts';

const data = await readFile(new URL('../public/models/studio-visitor.glb', import.meta.url));
const loader = new GLTFLoader().register(() => ({ name: 'headless-material', loadMaterial: async () => new MeshBasicMaterial() }));
const asset = await loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.length), '');
function visitor() {
  const model = clone(asset.scene), player = new Group(), mixer = new AnimationMixer(model);
  const footing = createTreadFooting(model, 0.95), contact = createSeatContact(model);
  model.scale.setScalar(0.95); player.add(model);
  const mesh = n => model.getObjectByName(n);
  const action = n => mixer.clipAction(asset.animations.find(a => a.name === n)).play();
  return { player, model, mixer, action, footing, contact, mesh, shoes: mesh('Wolf3D_Outfit_Footwear'), pants: mesh('Wolf3D_Outfit_Bottom') };
}

// Check the complete deformed mesh independently of the runtime's sparse contact probes.
function clearance(mesh, floor, seatOnly = false) {
  let min = Infinity;
  const a = mesh.geometry.attributes.position, p = new Vector3();
  for (let i = 0; i < a.count; i++) if (!seatOnly || a.getY(i) > 0.78) {
    mesh.getVertexPosition(i, p).applyMatrix4(mesh.matrixWorld);
    min = Math.min(min, p.y - floor(p));
  }
  return min;
}

test('idle fingertips stay outside the trousers and the thumbs face forward', () => {
  const v = visitor(), ray = new Raycaster();
  v.action('idle');
  for (let i = 0; i < 10; i++) {
    v.mixer.update(0.4); v.player.updateMatrixWorld(true);
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
      const hand = part => v.mesh(side + 'Hand' + part).getWorldPosition(new Vector3());
      assert.ok(hand('Index1').z > hand('Pinky1').z + 0.045);
      for (const finger of ['Thumb3', 'Index4', 'Middle4', 'Ring4', 'Pinky4']) {
        const tip = hand(finger);
        ray.set(new Vector3(sign, tip.y, tip.z), new Vector3(-sign, 0, 0));
        const hit = ray.intersectObject(v.pants, false)[0];
        assert.ok(!hit || (tip.x - hit.point.x) * sign > 0.003, `${side} ${finger} intersects jeans`);
      }
    }
  }
});

test('walking keeps the eyes level and the crown close to standing height throughout the stride', () => {
  const v=visitor(), idle=v.action('idle'), p=new Vector3();
  const eyes=['LeftEye','RightEye'].map(v.mesh), head=v.mesh('Head');
  v.mixer.update(0);
  const standing=head.getWorldPosition(p).y;
  idle.stop();
  const walk=v.action('walk');
  for(let i=0;i<96;i++) {
    v.mixer.setTime(walk.getClip().duration*i/96);
    const axis=eyes[0].getWorldPosition(new Vector3()).sub(eyes[1].getWorldPosition(p)).normalize();
    assert.ok(Math.abs(axis.y)<Math.sin(3*Math.PI/180),'walk tilts the eye line');
    assert.ok(standing-head.getWorldPosition(p).y<0.035,'walk loses standing height');
  }
});

test('flat walk loops without a knee snap or a gap below the supporting sole', () => {
  const v = visitor(), walk = v.action('walk'), knees = [v.mesh('LeftLeg'), v.mesh('RightLeg')];
  const before = knees.map(b => b.quaternion.clone());
  v.player.position.set(-1.3, ROOM.turfY, -4.0);
  for (let i = 0; i < 150; i++) {
    v.footing.restore(); v.mixer.update(1 / 60); v.footing.fit(v.player, 0, 0, 1, 1 / 60); v.player.updateMatrixWorld(true);
    assert.ok(Math.abs(clearance(v.shoes, () => ROOM.turfY)) < 0.004);
    knees.forEach((b, j) => {
      if (i) assert.ok(b.quaternion.angleTo(before[j]) < 0.18, `walk knee spike at ${walk.time}`);
      before[j].copy(b.quaternion);
    });
  }
});

test('a level walk has a smooth pelvis and head through heel strikes, the loop seam and the turf edge', () => {
  const v = visitor(), walk = v.action('walk'), dt = 1 / 75;
  v.player.rotation.y = Math.PI / 2;
  walk.paused = true;
  const tracks = ['Hips', 'Head'].map(n => ({ bone: v.mesh(n), heights: [], previousY: null, velocity: null }));
  for (let i = 0; i < 225; i++) {
    const x = -5 + i * 1.5 * dt, z = -5.8;
    const floor = getWalkableFloorY(x, z, 0);
    const base = travelBaseY(x, z, floor, 0);
    v.player.position.set(x, base, z);
    v.footing.restore();
    walk.time = ((0.18 + i * dt * 1.5 / (v.model.userData.strideMeters.walk * 0.95)) % 1) * walk.getClip().duration;
    v.mixer.update(dt); v.footing.fit(v.player, 0, 0, 1, dt); v.player.updateMatrixWorld(true);
    for (const t of tracks) {
      const y = t.bone.getWorldPosition(new Vector3()).y;
      if (t.previousY !== null) {
        const velocity = (y - t.previousY) / dt;
        assert.ok(Math.abs(velocity) < 0.40, `${t.bone.name} vertical jolt`);
        if (t.velocity !== null) assert.ok(Math.abs(velocity - t.velocity) / dt < 13, `${t.bone.name} heel-strike impulse`);
        t.velocity = velocity;
      }
      t.heights.push(y - base); t.previousY = y;
    }
  }
  for (const t of tracks) assert.ok(Math.max(...t.heights) - Math.min(...t.heights) < 0.03);
});

test('the sneakers do not cross through each other during a passing step', () => {
  for (const gait of ['walk', 'run']) {
    const v = visitor(), action = v.action(gait), a = v.shoes.geometry.attributes.position, p = new Vector3();
    for (let i = 0; i < 96; i++) {
      v.mixer.setTime(action.getClip().duration * i / 96); v.player.updateMatrixWorld(true);
      const left = new Box3(), right = new Box3();
      for (let j = 0; j < a.count; j++) (a.getX(j) > 0 ? left : right).expandByPoint(v.shoes.getVertexPosition(j, p));
      assert.ok(!left.intersectsBox(right), `${gait} shoes overlap at phase ${i}/96`);
    }
  }
});

test('the seat follows the straight board onto the mat without a position discontinuity', () => {
  for (const startZ of [SLIDE.topZ + 0.57, SLIDE.topZ - 0.08]) {
    const v = visitor(), stand = v.action('idle'), sit = v.action('slide');
    const recovery=createSeatedPose(v.model);
    const ride = beginSlide(SLIDE.centerX, getSlideYAtZ(startZ), startZ, 0.7);
    const last = new Vector3(ride.x, ride.y, ride.z);
    const floor = p => getSlideYAtZ(p.z);
    let onWood = 0, onMat = 0;
    for (let i = 0; i < 300; i++) {
      ride.time = i / 60;
      const s = sampleRide(ride);
      v.player.position.set(s.x, s.y, s.z); v.player.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
      assert.ok(v.player.position.distanceTo(last) < 0.12, 'teleport during mount or runout');
      if (s.stand>0) assert.ok(s.z<=last.z+1e-8,'rocked backwards while standing up');
      last.copy(v.player.position);
      recovery.restore(); v.model.position.set(0, 0, 0);
      stand.weight = 1 - s.seat; sit.weight = s.seat; v.mixer.update(1 / 60);
      v.contact(v.player);
      if (s.stand>0 && !s.done) { recovery.push(v.player,s.stand); v.contact(v.player); }
      v.player.updateMatrixWorld(true);
      const seat = clearance(v.pants, floor, true), soles = clearance(v.shoes, floor);
      assert.ok(Math.abs(Math.min(seat, soles)) < 0.005, 'rider unsupported or inside surface');
      if (s.seat === 1) {
        assert.ok(Math.abs(seat) < 0.004, 'feet are supporting a hovering seat');
        if (s.z > SLIDE.bottomZ) onWood++; else onMat++;
      }
      if (s.done) break;
    }
    assert.ok(onWood > 55 && onMat > 8);
    assert.ok(Math.abs(last.z - SLIDE.landingZ) < 1e-8);
  }
});

test('a downhill run plants on both stair lanes at 30, 60 and 120 Hz', () => {
  for (const hz of [30, 60, 120]) for (const x of [-0.35, WALK_STEP.minX + WALK_STEP.width / 2]) {
    const v = visitor(), run = v.action('run'), knees = [v.mesh('LeftLeg'), v.mesh('RightLeg')];
    const last = knees.map(() => new Vector3());
    const floor = p => getWalkableFloorY(p.x, p.z, ROOM.mezzanineY);
    v.player.rotation.y = Math.PI;
    run.paused = true;
    for (let i = 0; i < 4.25 * hz; i++) {
      const z = 6.55 - 1.88 * i / hz, support = getWalkableFloorY(x, z, ROOM.mezzanineY);
      const terrain = stairInfluence(x, z, support), y = getTreadSupportY(x, z, support, 0.48);
      const phase = (0.31 + 1.88 * i / (hz * ROOM.tierDepth)) % 1;
      v.player.position.set(x, support + terrain * (y - support), z);
      v.footing.restore(); run.time = phase * run.getClip().duration; v.mixer.update(1 / hz);
      v.footing.fit(v.player, terrain, phase, 1, 1 / hz);
      v.player.updateMatrixWorld(true);
      knees.forEach((b, j) => {
        const p = b.getWorldPosition(new Vector3());
        if (i) assert.ok(p.distanceTo(last[j]) * hz < 13, `knee pop: x=${x} z=${z} hz=${hz}`);
        last[j].copy(p);
      });
      if (z > ROOM.stairsStartZ && z < ROOM.stairsEndZ && i % 3 === 0) {
        const gap = clearance(v.shoes, floor);
        assert.ok(gap > -0.018 && gap < 0.05, `lost tread contact: ${gap} m at z=${z}`);
      }
    }
  }
});

test('climbing, turning around and stopping at a nosing never leave a foot stretched behind the hips', () => {
  const dt = 1 / 75;
  for (const x of [-0.35, WALK_STEP.minX + WALK_STEP.width / 2]) {
    const v = visitor(), walk = v.action('walk'), idle = v.action('idle');
    const legs = ['Left', 'Right'].map(s => ({ hip: v.mesh(s+'UpLeg'), knee: v.mesh(s+'Leg'), foot: v.mesh(s+'Foot') }));
    const feet = legs.map(() => new Vector3());
    let z = ROOM.stairsStartZ - 0.85, yaw = 0, phase = 0.24, weight = 0, count = 0;
    walk.paused = true;
    const floor = p => getWalkableFloorY(p.x, p.z, ROOM.mezzanineY);
    function step(speed, facing) {
      z += speed * dt;
      yaw += Math.sign(facing-yaw) * Math.min(Math.abs(facing-yaw), 6.5 * dt);
      v.player.rotation.y = yaw;
      const ground = floor({x, z}), terrain = stairInfluence(x, z, ground);
      v.player.position.set(x, travelBaseY(x, z, ground, terrain), z);
      weight += ((speed ? 1 : 0) - weight) * (1 - Math.exp(-18 * dt));
      phase = (phase + Math.abs(speed) * dt / ROOM.tierDepth) % 1;
      v.footing.restore(); walk.time = phase * walk.getClip().duration;
      walk.weight = weight; idle.weight = 1 - weight;
      v.mixer.update(dt); v.footing.fit(v.player, terrain, phase, weight, dt);
      v.player.updateMatrixWorld(true);
      const hips = v.mesh('Hips').getWorldPosition(new Vector3());
      for (const [i, leg] of legs.entries()) {
        const foot = leg.foot.getWorldPosition(new Vector3());
        if (count && terrain === 1) {
          assert.ok(Math.hypot(foot.x-hips.x, foot.z-hips.z) < 0.50, 'trailing foot left behind');
          assert.ok(foot.distanceTo(feet[i]) < 11 * dt, `${leg.foot.name} jumped ${foot.distanceTo(feet[i])} m at ${x}, ${z} (yaw ${yaw})`);
          const thigh = leg.hip.getWorldPosition(new Vector3()).sub(leg.knee.getWorldPosition(new Vector3()));
          if (x < -2.8) assert.ok(thigh.y > 0.085, 'sitting posture on a walking step');
        }
        feet[i].copy(foot);
      }
      if (terrain === 1) {
        assert.ok(Math.hypot(feet[0].x-feet[1].x, feet[0].z-feet[1].z) < 0.65, 'split stance');
        if (count % 3 === 0) {
          const gap = clearance(v.shoes, floor);
          assert.ok(gap > -0.018 && gap < 0.055, `lost support at ${z}: ${gap}`);
        }
      }
      count++;
    }
    while (z < 2.9) step(1.42, 0);
    while (z > 1.69) step(-1.15, Math.PI);
    for (let i = 0; i < 105; i++) step(0, Math.PI);
    for (const f of feet) assert.ok(Math.abs(f.y - floor({x, z}) - 0.12) < 0.023, 'idle on wrong tread');
    while (z < 5.98) step(1.05, 0);
  }
});
