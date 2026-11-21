// Offline asset tool. Inputs and their licenses are listed in public/models/CREDITS.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { AnimationMixer, Euler, MathUtils, Quaternion, Vector3 } from 'three';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeLegSolver } from '../src/scene/legIK.ts';

const [modelPath, walkPath, runPath] = process.argv.slice(2);
if (!runPath) throw new Error('Usage: node tools/bake-visitor.mjs PreviewMesh.glb 07_01.bvh 09_01.bvh');
const input = readFileSync(modelPath);
const end = 20 + input.readUInt32LE(12);
const doc = JSON.parse(input.subarray(20, end));
const binary = input.subarray(end + 8, end + 8 + doc.buffers[0].byteLength);
const padded = n => Math.ceil(n / 4) * 4;

function pack(json, bin) {
  const text = Buffer.from(JSON.stringify(json));
  const out = Buffer.alloc(28 + padded(text.length) + padded(bin.length));
  out.write('glTF'); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(padded(text.length), 12); out.write('JSON', 16);
  out.fill(0x20, 20, 20 + padded(text.length)); text.copy(out, 20);
  const offset = 20 + padded(text.length);
  out.writeUInt32LE(padded(bin.length), offset); out.write('BIN\0', offset + 4); bin.copy(out, offset + 8);
  return out;
}

// No image decoder is needed to retarget bones or measure the skinned shoe soles.
const geometryOnly = { ...doc, materials: doc.materials.map(() => ({})), images: [], textures: [] };
const bytes = pack(geometryOnly, binary);
const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '');
const bone = name => scene.getObjectByName(name);
const wp = obj => obj.getWorldPosition(new Vector3());
const wq = obj => obj.getWorldQuaternion(new Quaternion());
const dir = (a, b) => wp(b).sub(wp(a)).normalize();
const localize = (obj, world) => obj.quaternion.copy(wq(obj.parent).invert().multiply(world));
const sides = ['Left', 'Right'];
const names = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', ...sides.flatMap(side =>
  ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase'].map(part => side + part))];
const rest = Object.fromEntries(names.map(n => [n, bone(n).quaternion.clone()]));
const bindWorld = Object.fromEntries(names.map(n => [n, wq(bone(n))]));
const hips = bone('Hips'), bindHips = hips.position.clone();
const up = new Vector3(0, 1, 0);
const shoes = bone('Wolf3D_Outfit_Footwear');
const point = new Vector3();
const pants = bone('Wolf3D_Outfit_Bottom');
const soleProbes = new Set(), seatProbes = new Set();
function soleHeight() {
  scene.updateMatrixWorld(true);
  let low = Infinity;
  let index = 0;
  for (let i = 0; i < shoes.geometry.attributes.position.count; i++) {
    const y = shoes.getVertexPosition(i, point).y;
    if (y < low) { low = y; index = i; }
  }
  soleProbes.add(index);
  return low;
}
function reset() {
  hips.position.copy(bindHips);
  for (const n of names) bone(n).quaternion.copy(rest[n]);
}
function snapshot() {
  return { hips: hips.position.clone(), rotations: names.map(n => bone(n).quaternion.clone()) };
}

function applyFrame(frame) {
  hips.position.copy(frame.hips);
  names.forEach((n, j) => bone(n).quaternion.copy(frame.rotations[j]));
}

// Replace the existing shirt image in the BIN chunk. Its UVs, sampler, normal
// map and skin weights stay intact, and the unused original logo isn't shipped.
const shirt = doc.materials.find(m => m.name === 'Wolf3D_Outfit_Top').pbrMetallicRoughness;
const shirtImage = doc.images[doc.textures[shirt.baseColorTexture.index].source];
const imageView = doc.bufferViews[shirtImage.bufferView];
const albedo = readFileSync(new URL('./artwork/anti-crew-basecolor.jpg', import.meta.url));
const tail = imageView.byteOffset + padded(imageView.byteLength);
const delta = padded(albedo.length) - padded(imageView.byteLength);
const chunks = [binary.subarray(0, imageView.byteOffset), albedo,
  Buffer.alloc(padded(albedo.length) - albedo.length), binary.subarray(tail)];
for (const view of doc.bufferViews) if (view.byteOffset >= tail) view.byteOffset += delta;
imageView.byteLength = albedo.length;
shirtImage.name = 'Anti Crew - black cotton';
shirtImage.mimeType = 'image/jpeg';
shirt.roughnessFactor = 0.94;
let length = binary.length + delta;
function floats(values, type, count, range) {
  const bytes = Buffer.from(new Float32Array(values).buffer);
  const pad = (4 - length % 4) % 4;
  chunks.push(Buffer.alloc(pad), bytes);
  const bufferView = doc.bufferViews.push({ buffer: 0, byteOffset: length + pad, byteLength: bytes.length }) - 1;
  length += pad + bytes.length;
  return doc.accessors.push({ bufferView, componentType: 5126, type, count, ...range }) - 1;
}
doc.animations = [];
function clip(name, duration, frames) {
  const times = frames.map((_, i) => duration * i / (frames.length - 1));
  const input = floats(times, 'SCALAR', times.length, { min: [0], max: [Math.fround(duration)] });
  const samplers = [], channels = [];
  function track(n, path, values) {
    const output = floats(values, path === 'rotation' ? 'VEC4' : 'VEC3', times.length);
    const sampler = samplers.push({ input, output, interpolation: 'LINEAR' }) - 1;
    channels.push({ sampler, target: { node: doc.nodes.findIndex(node => node.name === n), path } });
  }
  track('Hips', 'translation', frames.flatMap(f => f.hips.toArray()));
  names.forEach((n, j) => {
    const values = [];
    for (const f of frames) {
      const q = f.rotations[j];
      const sign = values.length && q.dot(new Quaternion().fromArray(values, values.length - 4)) < 0 ? -1 : 1;
      values.push(...q.toArray().map(v => sign * v));
    }
    track(n, 'rotation', values);
  });
  doc.animations.push({ name, samplers, channels });
}

const sourceNames = { Spine: 'LowerBack', Spine1: 'Spine', Spine2: 'Spine1', Neck: 'Neck1' };
const distal = { Arm: 'ForeArm', ForeArm: 'Hand', UpLeg: 'Leg', Leg: 'Foot' };
function locomotion(name, path, first, last) {
  reset();
  const { skeleton, clip: capture } = new BVHLoader().parse(readFileSync(path, 'utf8'));
  const src = n => skeleton.getBoneByName(sourceNames[n] ?? n);
  const mixer = new AnimationMixer(src('Hips'));
  mixer.clipAction(capture).play();
  mixer.setTime(0); // The conversion's calibration T-pose, never part of the loop.
  const offsets = {};
  for (const n of names) {
    let align = new Quaternion();
    const limb = n.match(/^(Left|Right)(Arm|ForeArm|UpLeg|Leg|Hand)$/);
    if (limb) {
      const [side, part] = limb.slice(1);
      const a = part === 'Hand' ? side + 'ForeArm' : n;
      const b = part === 'Hand' ? n : side + distal[part];
      align.setFromUnitVectors(dir(bone(a), bone(b)), dir(src(a), src(b)));
    }
    offsets[n] = wq(src(n)).invert().multiply(align).multiply(bindWorld[n]);
  }
  const legLength = lookup => lookup('LeftLeg').position.length() + lookup('LeftFoot').position.length();
  const scale = legLength(bone) / legLength(src);
  const frameTime = capture.tracks[0].times[1];
  const rootAt = f => { mixer.setTime(f * frameTime); return wp(src('Hips')); };
  const start = rootAt(first), finish = rootAt(last);
  const travel = finish.clone().sub(start);
  const heading = new Quaternion().setFromAxisAngle(up, -Math.atan2(travel.x, travel.z));
  const duration = (last - first) * frameTime;
  const stride = Math.hypot(travel.x, travel.z) * scale;
  const count = Math.round(duration * 40);
  const frames = [];
  for (let i = 0; i <= count; ++i) {
    const t = i / count;
    const p = rootAt(MathUtils.lerp(first, last, t));
    hips.position.copy(p.sub(start).multiplyScalar(scale).applyQuaternion(heading)).add(bindHips);
    hips.position.z -= stride * t; // Remove forward travel, retain the captured pelvic sway.
    for (const n of names) localize(bone(n), heading.clone().multiply(wq(src(n))).multiply(offsets[n]));
    // The BVH head joint and this head mesh have different neutral sight lines.
    const gaze = new Vector3(0, 0, 1).applyQuaternion(wq(bone('Head')));
    const right = new Vector3(gaze.z, 0, -gaze.x).normalize();
    const pitch = Math.asin(gaze.y) * 0.82;
    for (const [n, share] of [['Neck', 0.4], ['Head', 0.6]]) {
      localize(bone(n), new Quaternion().setFromAxisAngle(right, pitch * share).multiply(wq(bone(n))));
    }
    frames.push(snapshot());
  }
  const drift = frames[0].hips.clone().sub(frames[count].hips);
  const correction = frames[0].rotations.map((q, j) => q.clone().multiply(frames[count].rotations[j].clone().invert()));
  frames.forEach((frame, i) => {
    // Remove endpoint drift without slowing the last footfall to a stop.
    const blend = MathUtils.smoothstep(i / count, 0.84, 1);
    frame.hips.addScaledVector(drift, blend);
    frame.rotations.forEach((q, j) => q.premultiply(new Quaternion().slerp(correction[j], blend)));
  });
  // Denoise the capture across the loop boundary too. Use one quaternion hemisphere per window.
  const kernel = [1, 6, 15, 20, 15, 6, 1];
  const clean = frames.slice(0, count).map((f, i) => {
    const neighbours = kernel.map((_, j) => frames[(i + count + j - 3) % count]);
    const hips = new Vector3();
    neighbours.forEach((v, j) => hips.addScaledVector(v.hips, kernel[j] / 64));
    const rotations = f.rotations.map((center, k) => {
      const sum = [0, 0, 0, 0];
      neighbours.forEach((v, j) => {
        const w = kernel[j] * (center.dot(v.rotations[k]) >= 0 ? 1 : -1);
        v.rotations[k].toArray().forEach((component, c) => { sum[c] += w * component; });
      });
      return new Quaternion().fromArray(sum).normalize();
    });
    return { hips, rotations };
  });
  const lateralAxis = new Vector3(0, 0, 1);
  const grounds = clean.map(f => {
    applyFrame(f);
    // The capture's heel tracks are narrower than these sneakers. Open the hips
    // a few degrees while retaining the captured heel strike and toe-off rotations.
    for (const [i, side] of sides.entries()) {
      const sign = i ? -1 : 1;
      const thigh = bone(side + 'UpLeg'), foot = bone(side + 'Foot'), arm = bone(side + 'Arm');
      const shoeRotation = wq(foot);
      localize(thigh, new Quaternion().setFromAxisAngle(lateralAxis, sign * (name === 'walk' ? 0.077 : 0.052)).multiply(wq(thigh)));
      localize(foot, shoeRotation);
      localize(arm, new Quaternion().setFromAxisAngle(lateralAxis, sign * 0.045).multiply(wq(arm)));
    }
    f.rotations = snapshot().rotations;
    return soleHeight();
  });
  const floor = [...grounds].sort((a, b) => a - b)[Math.floor(count * 0.2)];
  clean.forEach((f, i) => { f.hips.y -= name === 'walk' ? grounds[i] : Math.min(grounds[i], floor); });
  if (name === 'walk') {
    // Heel/toe changes belong in the legs, not in the head trajectory. Keep the
    // low-frequency weight transfer and the original planted shoe transforms.
    const mean = clean.reduce((s, f) => s + f.hips.y / count, 0);
    const phase = i => 4 * Math.PI * i / count;
    const c = clean.reduce((s, f, i) => s + 2 * (f.hips.y - mean) * Math.cos(phase(i)) / count, 0);
    const s = clean.reduce((a, f, i) => a + 2 * (f.hips.y - mean) * Math.sin(phase(i)) / count, 0);
    const gain = Math.min(1, 0.010 / Math.max(0.001, Math.hypot(c, s)));
    const wave = clean.map((_, i) => gain * (c * Math.cos(phase(i)) + s * Math.sin(phase(i))));
    const legs = sides.map(side => {
      const chain = ['UpLeg', 'Leg', 'Foot'].map(n => bone(side + n));
      return { chain, solve: makeLegSolver(...chain) };
    });
    const targets = clean.map(f => {
      applyFrame(f);
      scene.updateMatrixWorld(true);
      const clearance = [Infinity, Infinity], attr = shoes.geometry.attributes.position;
      for (let j = 0; j < attr.count; j++) {
        const foot = attr.getX(j) > 0 ? 0 : 1;
        clearance[foot] = Math.min(clearance[foot], shoes.getVertexPosition(j, point).y);
      }
      return legs.map(({chain: [thigh, shin, foot]}, j) => {
        const h = wp(thigh), k = wp(shin), a = wp(foot), axis = a.clone().sub(h).normalize();
        const captured = k.sub(h).projectOnPlane(axis);
        const pole = new Vector3(j ? -0.09 : 0.09, 0, 1).projectOnPlane(axis).normalize();
        // A nearly straight captured knee has no reliable bend plane.
        const confidence = MathUtils.smoothstep(captured.length(), 0.055, 0.18);
        if (captured.dot(pole) > 0) pole.lerp(captured.normalize(), confidence);
        return { a, h, rotation: wq(foot), pole, lift: clearance[j] };
      });
    });
    let center = mean;
    targets.forEach((pair, i) => {
      const lifts = pair.map((_, side) => kernel.reduce((sum, k, j) => sum + k * targets[(i+count+j-3)%count][side].lift / 64, 0));
      const plant = Math.min(...lifts);
      pair.forEach(({a, h, lift}, side) => {
        a.y += lifts[side] - plant - lift;
        const [, shin, foot] = legs[side].chain, length = shin.position.length() + foot.position.length() - 0.011;
        const dy = Math.sqrt(Math.max(0, length ** 2 - (h.x-a.x)**2 - (h.z-a.z)**2));
        center = Math.min(center, clean[i].hips.y + a.y + dy - h.y - wave[i]);
      });
    });
    clean.forEach((f, i) => {
      f.hips.y = center + wave[i];
      applyFrame(f);
      legs.forEach((leg, j) => {
        const { a, rotation, pole } = targets[i][j];
        leg.solve(a, rotation, pole);
      });
      f.rotations = snapshot().rotations;
    });
  }
  clip(name, duration, [...clean, clean[0]]);
  return stride;
}

const stride = { walk: locomotion('walk', walkPath, 121, 250), run: locomotion('run', runPath, 35, 123) };
// The smaller gameplay poses are authored on this rig in model space, not guessed local Euler axes.
function aim(n, child, x, y, z) {
  const q = new Quaternion().setFromUnitVectors(dir(bone(n), bone(child)), new Vector3(x, y, z).normalize());
  localize(bone(n), q.multiply(wq(bone(n))));
}

function relaxWrist(side, k) {
  const hand = side + 'Hand';
  aim(hand, hand + 'Middle1', 0.035 * k, -1, 0.13);
  const axis = dir(bone(hand), bone(hand + 'Middle1'));
  const knuckles = dir(bone(hand + 'Pinky1'), bone(hand + 'Index1')).projectOnPlane(axis).normalize();
  const thumbForward = new Vector3(-0.13 * k, 0, 1).projectOnPlane(axis).normalize();
  const twist = Math.atan2(axis.dot(knuckles.clone().cross(thumbForward)), knuckles.dot(thumbForward));
  localize(bone(hand), new Quaternion().setFromAxisAngle(axis, twist).multiply(wq(bone(hand))));
}

function centerOnSeat() {
  scene.updateMatrixWorld(true);
  const contact = [];
  const a = pants.geometry.attributes.position;
  for (let i = 0; i < a.count; i++) {
    if (a.getY(i) > 0.78) contact.push(pants.getVertexPosition(i, new Vector3()));
  }
  const low = Math.min(...contact.map(v => v.y));
  const patch = contact.filter(v => v.y < low + 0.018);
  const center = patch.reduce((v, p) => v.add(p), new Vector3()).divideScalar(patch.length);
  hips.position.x -= center.x;
  hips.position.z -= center.z;
  hips.position.y -= low;
}

// Keep only surface extrema, not every vertex of both skinned meshes, for runtime contact tests.
function collectContact(mesh, indices) {
  const vertices = [];
  const a = mesh.geometry.attributes.position;
  for (let i = 0; i < a.count; i++) if (mesh === shoes || a.getY(i) > 0.78) {
    vertices.push({ i, v: mesh.getVertexPosition(i, new Vector3()) });
  }
  for (const side of [-1, 1]) for (const sx of [-0.4, 0, 0.4]) for (const sz of [-0.5, -0.25, 0, 0.25, 0.5]) {
    let low = Infinity, pick = -1;
    for (const { i, v } of vertices) {
      const h = v.y + sx * v.x + sz * v.z;
      if (a.getX(i) * side >= 0 && h < low) { low = h; pick = i; }
    }
    if (pick >= 0) indices.add(pick);
  }
}

const anchors = {};
for (const [name, duration] of [['idle', 4], ['jump', 1], ['lounge', 4], ['slide', 1], ['dance', 1.4]]) {
  const frames = [];
  const seated = name === 'slide' || name === 'lounge';
  for (let i = 0; i <= 24; ++i) {
    reset();
    const phase = Math.PI * 2 * i / 24, wave = Math.sin(phase);
    const dance = name === 'dance', jump = name === 'jump';
    const idle = name === 'idle', slide = name === 'slide';
    const roll = dance ? wave * 0.09 : idle ? 0.016 + 0.007 * wave : 0;
    hips.quaternion.premultiply(new Quaternion().setFromEuler(new Euler(0, dance ? wave * 0.13 : 0, roll)));
    bone('Spine1').rotateX(seated ? -0.17 : 0.015 + wave * 0.013);
    bone('Spine2').rotateZ(-roll * 1.3);
    bone('Head').rotateY(wave * (dance ? 0.13 : 0.045));
    bone('Head').rotateX(seated ? 0.14 : 0);
    if (seated) hips.position.y = name === 'slide' ? 0.17 : 0.125;
    if (dance) hips.position.x += 0.065 * wave;
    if (idle) hips.position.x += 0.012 + 0.004 * wave;
    for (const [idx, side] of sides.entries()) {
      const k = idx === 0 ? 1 : -1;
      const aimPart = (a, b, x, y, z) => aim(side + a, side + b, k * x, y, z);
      aimPart('Arm', 'ForeArm', dance ? 0.62 : seated ? 0.28 : idle ? 0.265 + 0.012 * k : 0.14, -1,
        dance ? 0.42 + k * wave * 0.55 : jump ? -0.46 * k : seated ? 0.55 : -0.12 + 0.025 * wave);
      aimPart('ForeArm', 'Hand', dance ? -0.4 : idle ? 0.035 : -0.07, dance ? 0.36 + k * wave * 0.3 : seated ? -0.55 : -1,
        dance || seated ? 1 : jump ? 0.72 : 0.35 + 0.045 * k);
      if (idle) relaxWrist(side, k);
      aimPart('UpLeg', 'Leg', seated ? 0.16 : 0.06, slide ? 0.36 : seated ? 0.17 : -1,
        seated ? 1 : jump ? 0.65 + k * 0.45 : dance ? 0.24 + k * wave * 0.16 : 0.08 + k * 0.025);
      aimPart('Leg', 'Foot', seated ? 0.03 : -0.02, slide ? -0.22 : seated ? -0.26 : -1,
        seated ? 1 : jump ? -0.85 : dance ? -0.3 - k * wave * 0.2 : -0.10);
      const footRest = bindWorld[side + 'Foot'];
      localize(bone(side + 'Foot'), slide ? new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.22).multiply(footRest) : footRest);
    }
    if (slide) centerOnSeat();
    if (!seated && !jump) hips.position.y -= soleHeight();
    frames.push(snapshot());
  }
  clip(name, duration, frames);
  if (name === 'idle' || name === 'slide') anchors[name] = frames[0];
}
for (let i = 0; i <= 16; i++) {
  const t = i / 16;
  applyFrame({
    hips: anchors.idle.hips.clone().lerp(anchors.slide.hips, t),
    rotations: anchors.idle.rotations.map((q, j) => q.clone().slerp(anchors.slide.rotations[j], t)),
  });
  scene.updateMatrixWorld(true);
  collectContact(pants, seatProbes);
  collectContact(shoes, soleProbes);
}

// The captures have no finger markers. Relax the open bind-pose hands around the palm axis.
reset();
for (const side of sides) {
  const hand = side + 'Hand';
  const across = dir(bone(hand + 'Index1'), bone(hand + 'Pinky1')).multiplyScalar(side === 'Left' ? 1 : -1);
  for (const [f, finger] of ['Index', 'Middle', 'Ring', 'Pinky'].entries()) {
    for (const [j, bend] of [0.10, 0.19, 0.10].entries()) {
      const joint = bone(hand + finger + (j + 1));
      joint.rotateOnAxis(across.clone().applyQuaternion(wq(joint).invert()), bend + 0.035 * f);
      doc.nodes.find(n => n.name === joint.name).rotation = joint.quaternion.toArray();
    }
  }
}

doc.scenes[0].extras = { strideMeters: stride, contacts: { seat: [...seatProbes], soles: [...soleProbes] } };
doc.buffers[0].byteLength = length;
writeFileSync(new URL('../public/models/studio-visitor.glb', import.meta.url), pack(doc, Buffer.concat(chunks)));
console.log('Baked studio visitor; metres per stride:', stride);
