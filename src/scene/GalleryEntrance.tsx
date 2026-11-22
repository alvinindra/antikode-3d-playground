import type { Material } from 'three';
import { FoyerPlanting } from './FoyerPlanting';
import { GalleryFurnishings } from './GalleryFurnishings';
import { FOYER, getRoofY, ROOM } from './layout';
import { getSceneMaterials } from './materials';

type V3 = [number, number, number];
const width = ROOM.leftWallX - 0.28 - ROOM.galleryMinX;
const length = FOYER.endZ - FOYER.doorZ;
const recess = FOYER.doorZ - FOYER.outerZ;
const lid = FOYER.rooflightY;

function Block({ at, size, mat }: { at: V3; size: V3; mat: Material }) {
  return <mesh position={at} material={mat} castShadow={!mat.transparent} receiveShadow><boxGeometry args={size} /></mesh>;
}

function GardenGlazing({ isDay }: { isDay: boolean }) {
  const m = getSceneMaterials(), roof = getRoofY(ROOM.galleryMinX) + 0.15;
  const first = ROOM.focalBackZ - FOYER.doorZ, last = ROOM.mezzanineEndZ - FOYER.doorZ;
  const start = 1.36, windowEnd = length + 3.2;
  return <group name="garden-glazing">
    {[[first, -recess], [windowEnd, last]].map(([a, b]) =>
      <Block key={a} at={[-0.14, roof / 2, (a + b) / 2]} size={[0.28, roof, b - a]} mat={m.darkPlaster} />)}
    <Block at={[-0.14, (roof + lid) / 2, (windowEnd - recess) / 2]} size={[0.28, roof - lid, windowEnd + recess]} mat={m.concreteWall} />
    <Block at={[-0.14, lid / 2, start - 0.20]} size={[0.28, lid, 0.4]} mat={m.concreteWall} />
    <Block at={[-0.14, 0.04, (windowEnd - recess) / 2]} size={[0.28, 0.08, windowEnd + recess]} mat={m.entryPlaster} />
    <Block at={[-0.08, lid / 2, (windowEnd - recess) / 2]} size={[0.014, lid, windowEnd + recess]} mat={m.entryGlass} />
    {[start, (length + start) / 2, length, (length + windowEnd) / 2, windowEnd - 0.03, -recess + 0.03].map(z =>
      <Block key={z} at={[-0.065, lid / 2, z]} size={[0.074, lid, 0.048]} mat={m.blackSteel} />)}
    {[0.09, 2.12, lid - 0.04].map(y =>
      <Block key={y} at={[-0.065, y, (start + windowEnd) / 2]} size={[0.074, 0.038, windowEnd - start]} mat={m.blackSteel} />)}
    <mesh position={[-2.7, 1.68, windowEnd / 2]} rotation-y={Math.PI / 2} material={isDay ? m.gardenDay : m.gardenNight}>
      <planeGeometry args={[windowEnd + 12, 6.1]} />
    </mesh>
  </group>;
}

function Rooflight({ isDay, ledOn }: { isDay: boolean; ledOn: boolean }) {
  const m = getSceneMaterials(), slot = 1.12, returnX = width - 0.31;
  const underside = FOYER.ceilingY, join = ROOM.doorwayEndZ - FOYER.doorZ;
  return <group name="foyer-rooflight">
    {/* Step down behind the hall jamb to meet the balcony, not in front of the rooflight. */}
    <Block at={[width / 2, underside + 0.14, (length + join) / 2]} size={[width, 0.28, length - join]} mat={m.entryPlaster} />
    <Block at={[width / 2, (lid + 0.16 + underside) / 2, join - 0.06]} size={[width, lid + 0.16 - underside, 0.12]} mat={m.entryPlaster} />
    <Block at={[width / 2, lid + 0.08, (join - 0.12 + slot) / 2]} size={[width, 0.16, join - 0.12 - slot]} mat={m.entryPlaster} />
    <Block at={[width / 2, lid - 0.075, slot + 0.07]} size={[width, 0.15, 0.14]} mat={m.entryPlaster} />
    <Block at={[returnX / 2, lid + 0.085, -recess / 2]} size={[returnX, 0.17, recess]} mat={m.entryPlaster} />
    {/* Frosted upper lites sit behind the clear lower sash; the slot turns the corner of the portal. */}
    {[[0, width, 0, slot], [returnX, width, -recess, 0]].map(([x0, x1, z0, z1]) =>
      <group key={z0} position={[(x0 + x1) / 2, lid, (z0 + z1) / 2]}>
        <mesh position-y={0.032} rotation-x={Math.PI / 2}>
          <planeGeometry args={[x1 - x0 + 0.055, z1 - z0 + 0.055]} />
          <meshBasicMaterial color={isDay ? '#e7eeec' : '#74889a'} />
        </mesh>
        <Block at={[0, -0.012, 0]} size={[x1 - x0, 0.018, z1 - z0]} mat={m.entryGlass} />
      </group>)}
    {[0, slot].map(z => <Block key={z} at={[width / 2, lid - 0.036, z]} size={[width, 0.072, 0.049]} mat={m.blackSteel} />)}
    {Array.from({ length: 8 }, (_, i) => <Block key={i} at={[0.025 + (width - 0.05) * i / 7, lid - 0.034, slot / 2]}
      size={[0.034, 0.064, slot]} mat={m.blackSteel} />)}
    {[-0.6, -1.24, -1.88].map(z => <Block key={z} at={[(width + returnX) / 2, lid - 0.034, z]}
      size={[width - returnX, 0.064, 0.034]} mat={m.blackSteel} />)}
    <Block at={[returnX, lid - 0.048, -recess / 2]} size={[0.024, 0.025, recess]} mat={ledOn ? m.warmLed : m.blackSteel} />
    <pointLight position={[1.70, lid + 0.60, 0.72]} intensity={isDay ? 16 : ledOn ? 7.2 : 0.8}
      color={isDay ? '#f1f6f3' : '#f2dfbf'} distance={6.5} />
  </group>;
}

function GlassEntry({ ledOn }: { ledOn: boolean }) {
  const m = getSceneMaterials(), head = 2.48, hinge = 2.14, start = 0.46, end = width - 0.31;
  const cove = [[0.58, 0.42], [1.82, 0.42], [2.59, 0.78], [width - 0.16, 0.78]];
  return <group name="glass-entry">
    <Block at={[width / 2, lid / 2, -recess - 0.14]} size={[width + 0.28, lid, 0.28]} mat={m.entryPlaster} />
    <Block at={[(start + hinge) / 2, head / 2, -0.12]} size={[hinge - start, head, 0.24]} mat={m.entryPlaster} />
    <Block at={[(start + end) / 2, (lid + head) / 2, -0.12]} size={[end - start, lid - head, 0.24]} mat={m.entryPlaster} />
    <Block at={[end - 0.06, (lid + head) / 2, -(recess + 0.24) / 2]} size={[0.12, lid - head, recess - 0.24]} mat={m.entryPlaster} />
    <Block at={[start, lid / 2, -recess / 2]} size={[0.12, lid, recess]} mat={m.concreteWall} />
    <Block at={[start / 2, lid / 2, -0.13]} size={[start, lid, 0.016]} mat={m.entryGlass} />
    <Block at={[width - 0.02, head / 2, -recess / 2]} size={[0.012, head, recess]} mat={m.entryGlass} />
    <Block at={[(end + hinge) / 2, head - 0.017, -0.08]} size={[end - hinge, 0.034, 0.06]} mat={m.blackSteel} />

    {/* The pivot leaf opens into the vestibule. The concrete opening onto the turf has no leaf. */}
    <group name="entry-pivot-leaf" position={[hinge + 0.02, 0, -0.09]} rotation-y={1.0}>
      <Block at={[0.525, head / 2, 0]} size={[1.05, head - 0.032, 0.014]} mat={m.entryGlass} />
      {[0.043, head - 0.044].map(y => <Block key={y} at={[0.083, y, 0]} size={[0.16, 0.066, 0.023]} mat={m.brushedMetal} />)}
      {[-0.067, 0.067].map(z => <Block key={z} at={[0.966, 1.25, z]} size={[0.033, 1.32, 0.038]} mat={m.blackSteel} />)}
      {[0.68, 1.82].map(y => <Block key={y} at={[0.966, y, 0]} size={[0.031, 0.031, 0.134]} mat={m.blackSteel} />)}
    </group>

    {cove.slice(1).map(([x, y], i) => {
      const [px, py] = cove[i], span = Math.hypot(x - px, y - py);
      return <group key={x} position={[(x + px) / 2, (y + py) / 2, -recess + 0.10]} rotation-z={Math.atan2(y - py, x - px)}>
        <Block at={[0, 0, 0]} size={[span, 0.065, 0.2]} mat={m.darkPlaster} />
        <Block at={[0, -0.032, 0.075]} size={[span, 0.012, 0.034]} mat={ledOn ? m.treadLed : m.blackSteel} />
      </group>;
    })}
    <Block at={[1.28, 0.16, -recess + 0.29]} size={[1.48, 0.32, 0.58]} mat={m.entryPlaster} />
    <Block at={[1.37, 0.36, -recess + 0.34]} size={[1.66, 0.08, 0.68]} mat={m.darkPlaster} />
    <pointLight position={[2.49, 0.54, -recess + 0.29]} color="#ffbd80" intensity={ledOn ? 0.85 : 0} distance={2.7} />
  </group>;
}

function PlantedBench() {
  const m = getSceneMaterials();
  return <group name="planted-oak-bench">
    <Block at={[1.46, 0.07, 0.46]} size={[2.06, 0.14, 0.78]} mat={m.darkPlaster} />
    <Block at={[1.46, 0.14, 0.46]} size={[2.02, 0.02, 0.74]} mat={m.concreteWall} />
    <Block at={[2.46, 0.29, 0.47]} size={[0.12, 0.58, 0.96]} mat={m.entryPlaster} />
    {[[0.57, 0.42, 0.12], [1.08, 0.57, 0.18], [1.30, 0.68, 0.097], [1.87, 0.55, 0.14], [2.25, 0.25, 0.09]].map(([x, z, r], i) =>
      <mesh key={x} position={[x, 0.16 + r * 0.32, z]} rotation={[0.14 * i, 1.4 * i, 0.2 * i]}
        scale={[r, r * (i === 1 ? 1.3 : 0.72), r * 0.82]} material={m.concreteWall} castShadow><icosahedronGeometry args={[1, 1]} /></mesh>)}
    {[0.77, 2.05].map(x => <Block key={x} at={[x, 0.21, 0.99]} size={[0.093, 0.42, 0.29]} mat={m.bentOak} />)}
    <Block at={[1.38, 0.445, 1.00]} size={[2.37, 0.058, 0.37]} mat={m.bentOak} />
  </group>;
}

export function GalleryEntrance({ isDay, ledOn }: { isDay: boolean; ledOn: boolean }) {
  const m = getSceneMaterials();
  // Local +X runs from the garden window to the auditorium; +Z runs from the glass entry to the balcony.
  return <group name="gallery-entrance" position={[ROOM.galleryMinX, 0, FOYER.doorZ]}>
    <mesh position={[1.27, 0.003, length / 2]} rotation-x={-Math.PI / 2}
      material={m.loungeCarpet} receiveShadow userData={{ collision: 'terrain' }}>
      <planeGeometry args={[2.54, length]} />
    </mesh>
    <GardenGlazing isDay={isDay} />
    <Rooflight isDay={isDay} ledOn={ledOn} />
    <GlassEntry ledOn={ledOn} />
    <PlantedBench />
    <FoyerPlanting />
    <GalleryFurnishings ledOn={ledOn} />
  </group>;
}
