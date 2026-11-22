import { afterAll, beforeAll, expect, mock, test } from 'bun:test';
import { act, createRoot, extend } from '@react-three/fiber/dist/react-three-fiber.esm.js';
import * as THREE from 'three';
import { buildRoomContacts, BODY_HEIGHT, BODY_RADIUS, outsideWalkableVolume } from '../src/scene/roomContacts';
import { FOYER, GALLERY_CHAIRS, getWalkableFloorY, NOOK_PADS, ROOM, TURF_BEANBAGS, WALK_STEP } from '../src/scene/layout';
import { nearbySeat } from '../src/scene/seating';
import { beginSlide, sampleRide } from '../src/scene/slideRide';

// Mount the production furniture and architecture; only pixels and canvas text are stubbed.
const material = new THREE.MeshBasicMaterial();
mock.module('../src/scene/materials', () => ({ getSceneMaterials: () => new Proxy({}, { get: () => material }) }));
const { ArchitecturalShell } = await import('../src/scene/ArchitecturalShell');
const { AuditoriumAndNook } = await import('../src/scene/AuditoriumAndNook');
const { FocalOakWall } = await import('../src/scene/FocalOakWall');
const scene = new THREE.Scene(), canvas = {};
let room: ReturnType<typeof buildRoomContacts>;
let root: ReturnType<typeof createRoot>;
const globals = { document: globalThis.document, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    measureText: () => ({ actualBoundingBoxAscent: 70, actualBoundingBoxDescent: 14 }), fillText() {},
  }) }) };
  extend(THREE);
  root = createRoot(canvas);
  await root.configure({ scene, size: { width: 32, height: 32, top: 0, left: 0 }, dpr: 1, frameloop: 'never',
    gl: { render() {}, setSize() {}, setPixelRatio() {} } });
  await act(async () => { root.render(<group><ArchitecturalShell isDay={false} ledOn spotlightsOn />
    <FocalOakWall screenOn ledOn /><AuditoriumAndNook ledOn /></group>); });
  room = buildRoomContacts(scene.children[0] as THREE.Group);
});
afterAll(async () => {
  if (root) await act(async () => { root.unmount(); });
  globalThis.document = globals.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = globals.act;
});

test('the actual credit frame stops a running approach at both ends and in the middle', () => {
  // At the near corner the ficus also projects in front of the frame.
  for (const z of [6.87, 7.55, 8.44]) {
    let x = -5.9;
    while (x < -3 && !room.blocked(x + 3.65 / 20, 0, z)) x += 3.65 / 20;
    expect(x + BODY_RADIUS).toBeLessThanOrEqual(ROOM.nookWallX - 0.15);
    expect(x, `approach z=${z}`).toBeGreaterThan(-4.54);
  }
});

test('standing solids include the pier, artwork, ficus, chairs, glass and equipment case', () => {
  const chair = GALLERY_CHAIRS[0];
  for (const [name, x, y, z] of [
    ['door pier', -6.53, 0, 2.53], ['right canvas', 5.65, 0, -3.45],
    ['ficus', -4.35, 0, 5.85],
    ['gallery chair back', chair.x - 0.32 * Math.sin(chair.yaw), chair.top + 0.25, chair.z - 0.32 * Math.cos(chair.yaw)],
    ['meeting glass', 0, ROOM.mezzanineY, 8.12], ['equipment case', 3.06, 0, ROOM.focalFrontZ + 0.32],
  ] as const) expect(room.blocked(x,y,z), name).toBe(true);
});

test('the hall and vestibule connect around the open glass leaf without walking through glass', () => {
  const at = (x: number, z: number) => new THREE.Vector3(ROOM.galleryMinX + x, 0, FOYER.doorZ + z);
  const path = [at(5.2, 1.3), at(3.05, 1.3), at(3.05, -0.23), at(3.26, -0.58), at(3.38, -1.4)];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    expect(room.clearApproach(a, b), `obstruction on entry segment ${i}`).toBe(true);
    const steps = Math.ceil(a.distanceTo(b) / 0.08);
    for (let j = 0; j <= steps; j++) {
      const p = new THREE.Vector3().lerpVectors(a, b, j / steps);
      expect(outsideWalkableVolume(p.x, 0, p.z), 'obsolete perimeter inside the vestibule').toBe(false);
    }
  }
  const pane = scene.getObjectByName('entry-pivot-leaf')!.localToWorld(new THREE.Vector3(0.55, 0, 0));
  expect(room.blocked(pane.x, 0, pane.z), 'glass leaf').toBe(true);
  expect(room.blocked(ROOM.galleryMinX, 0, 2.0), 'garden window').toBe(true);
});

test('the doorway, both stair lanes and the open deck are still traversable', () => {
  for (let x=-7.8;x<-5.4;x+=0.05) expect(room.blocked(x,0,0.28), `door x=${x}`).toBe(false);
  for (const x of [-1, WALK_STEP.minX + WALK_STEP.width/2]) {
    let y = 0;
    for (let z=-1.4;z<6.7;z+=0.0475) {
      y = getWalkableFloorY(x,z,y);
      expect(room.blocked(x,y,z), `stair x=${x} y=${y} z=${z}`).toBe(false);
    }
  }
});

test('a stride into the sign shortens before contact; a parallel stride stays free', () => {
  const p = new THREE.Vector3(-4.4, 0, 7.6);
  expect(room.blocked(p.x,p.y,p.z)).toBe(false);
  expect(room.strideWeight(p, Math.PI/2)).toBeLessThan(0.5);
  expect(room.strideWeight(p, 0)).toBe(1);
});

test('jumping under the gallery balcony hits its underside, not an invisible floor-wide ceiling', () => {
  const top = room.vertical(-8.1, 6.1, 0, 1.8);
  expect(top + BODY_HEIGHT).toBeCloseTo(ROOM.mezzanineY - 0.28, 2);
  expect(room.vertical(-5.4, 1, 0, 1.1)).toBe(1.1);
});

test('a diagonal push slides along the glass without crossing it, and the slide lane remains open', () => {
  let x = -2, z = 7.05;
  for (let i=0; i<36; i++) {
    if (!room.blocked(x+0.075, ROOM.mezzanineY, z)) x+=0.075;
    if (!room.blocked(x, ROOM.mezzanineY, z+0.075)) z+=0.075;
  }
  expect(x).toBeGreaterThan(0.5);
  expect(z+BODY_RADIUS).toBeLessThan(8.18);
  const lane = (ROOM.slideLeftX+ROOM.slideRightX)/2;
  const from = new THREE.Vector3(lane, ROOM.mezzanineY, ROOM.stairsEndZ+1.2);
  const ride = beginSlide(from.x, from.y, from.z, Math.PI);
  expect(room.clearApproach(from, {x:lane, y:from.y, z:ride.startZ}, 'slide')).toBe(true);
  for (let i=0; i<360; i++) {
    ride.time=i/60;
    const p=sampleRide(ride);
    expect(room.blocked(p.x,p.y,p.z,undefined,BODY_HEIGHT-0.86*p.seat), `slide z=${p.z}`).toBe(false);
    if (p.done) break;
  }
});

test('each interactive chair, beanbag and mattress retains a clear approach', () => {
  const sites = [
    ...GALLERY_CHAIRS.map((p,i) => ({ ...p, id:`gallery-chair-${i}`})),
    ...TURF_BEANBAGS.map(p => ({ ...p, id:`beanbag-${p.seed}`})),
    ...NOOK_PADS.z.map((z,i) => ({ x:NOOK_PADS.x, z, id:`mattress-${i}` })),
  ];
  for (const s of sites) {
    let found = false;
    for (let r=0.65; r<1.83 && !found; r+=0.10) for (let i=0;i<64 && !found;i++) {
      const x=s.x+r*Math.cos(i*Math.PI/32), z=s.z+r*Math.sin(i*Math.PI/32);
      const p=new THREE.Vector3(x,getWalkableFloorY(x,z,0),z), site=nearbySeat(p);
      found = site?.id===s.id && !room.blocked(x,p.y,z) && room.clearApproach(p,site,s.id);
    }
    expect(found, s.id).toBe(true);
  }
});
