import { useMemo } from 'react';
import * as THREE from 'three';
import { FOYER, GALLERY_CHAIRS, ROOM } from './layout';
import { getSceneMaterials } from './materials';

// Deform both faces of a thin blank. BoxGeometry keeps the veneer rim's
// vertices separate, so recomputing normals smooths the bowl but not the cut edge.
function chairShell(back: boolean, pad: boolean) {
  const geo = new THREE.BoxGeometry(2, pad ? 0.026 : 0.018, 2, 26, 1, 18);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), v = p.getZ(i), thickness = p.getY(i);
    const x = u * (1 - 0.19 * v ** 6) * (pad ? 0.94 : 1);
    const t = v * (1 - 0.16 * u ** 6) * (pad ? 0.94 : 1);
    const padding = pad ? 0.023 + 0.011 * (1 - u * u) * (1 - v * v) : 0;
    if (back) {
      p.setXYZ(i, x * 0.354, 0.25 - 0.24 * t - 0.025 * x * x,
        -0.32 + 0.123 * t + 0.105 * x * x + thickness + padding);
    } else {
      p.setXYZ(i, x * 0.475, -0.047 + 0.174 * Math.abs(x) ** 2.6 + 0.041 * t * t
        + 0.023 * t + thickness + padding, t * 0.34);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function bentLegs(top: number) {
  const arch = new THREE.Shape();
  arch.moveTo(-0.455, 0);
  arch.bezierCurveTo(-0.39, 0.18, -0.37, top, -0.20, top - 0.025);
  arch.quadraticCurveTo(0, top - 0.052, 0.20, top - 0.025);
  arch.bezierCurveTo(0.37, top, 0.39, 0.18, 0.455, 0);
  arch.lineTo(0.429, 0);
  arch.bezierCurveTo(0.35, 0.18, 0.34, top - 0.035, 0.19, top - 0.059);
  arch.quadraticCurveTo(0, top - 0.084, -0.19, top - 0.059);
  arch.bezierCurveTo(-0.34, top - 0.035, -0.35, 0.18, -0.429, 0);
  arch.closePath();
  const bend = { depth: 0.078, bevelEnabled: false, curveSegments: 12 };
  const front = new THREE.ExtrudeGeometry(arch, bend);
  const p = front.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + 0.12 + 0.15 * (1 - p.getY(i) / top));
  front.computeVertexNormals();

  // The third leg bends forward under the shell; its spine also carries the separate backrest.
  const spine = new THREE.Shape();
  spine.moveTo(-0.49, 0); spine.lineTo(-0.455, 0);
  spine.quadraticCurveTo(-0.32, top - 0.09, -0.11, top - 0.055);
  spine.lineTo(-0.11, top - 0.03); spine.lineTo(-0.255, top);
  spine.lineTo(-0.36, top + 0.3); spine.lineTo(-0.395, top + 0.3);
  spine.quadraticCurveTo(-0.27, top, -0.34, 0.24); spine.closePath();
  const rear = new THREE.ExtrudeGeometry(spine, { ...bend, depth: 0.104 });
  rear.rotateY(-Math.PI / 2).translate(0.052, 0, 0);
  return { front, rear };
}

function tableTop() {
  const x = 0.50, z = 0.31, r = 0.095;
  const s = new THREE.Shape();
  s.moveTo(-x + r, -z); s.lineTo(x - r, -z); s.quadraticCurveTo(x, -z, x, -z + r);
  s.lineTo(x, z - r); s.quadraticCurveTo(x, z, x - r, z);
  s.lineTo(-x + r, z); s.quadraticCurveTo(-x, z, -x, z - r);
  s.lineTo(-x, -z + r); s.quadraticCurveTo(-x, -z, -x + r, -z);
  return new THREE.ExtrudeGeometry(s, { depth: 0.032, bevelThickness: 0.004, bevelSize: 0.004,
    bevelSegments: 2, curveSegments: 8 }).rotateX(-Math.PI / 2);
}

export function GalleryFurnishings({ ledOn }: { ledOn: boolean }) {
  const mat = getSceneMaterials();
  const geo = useMemo(() => ({
    seat: chairShell(false, false), seatPad: chairShell(false, true),
    back: chairShell(true, false), backPad: chairShell(true, true),
    ...bentLegs(GALLERY_CHAIRS[0].top), table: tableTop(),
    shade: new THREE.LatheGeometry([[0.145, 0], [0.143, 0.024], [0.112, 0.08],
      [0.071, 0.12], [0.054, 0.13], [0.05, 0.181], [0.027, 0.187]]
      .map(([x, y]) => new THREE.Vector2(x, y)), 32),
  }), []);
  return <>
    {GALLERY_CHAIRS.map((c, i) => <group key={i} name={`gallery-chair-${i}`}
      position={[c.x - ROOM.galleryMinX, 0, c.z - FOYER.doorZ]} rotation-y={c.yaw}>
      <group position-y={c.top}>
        <mesh geometry={geo.seat} material={mat.bentOak} castShadow receiveShadow />
        <mesh geometry={geo.seatPad} material={mat.darkFabric} castShadow receiveShadow />
        <mesh geometry={geo.back} material={mat.bentOak} castShadow receiveShadow />
        <mesh geometry={geo.backPad} material={mat.darkFabric} castShadow receiveShadow />
      </group>
      <mesh geometry={geo.front} material={mat.bentOak} castShadow receiveShadow />
      <mesh geometry={geo.rear} material={mat.bentOak} castShadow receiveShadow />
      <mesh position-y={0.005} rotation-x={-Math.PI / 2} material={mat.contactShade} userData={{ collision: 'terrain' }}>
        <planeGeometry args={[1.1, 1.03]} />
      </mesh>
    </group>)}

    <group name="foyer-coffee-table" position={[1.36, 0, 1.77]}>
      <mesh position-y={0.36} geometry={geo.table} material={mat.bentOak} castShadow receiveShadow />
      {[-0.415, 0.415].flatMap(x => [-0.224, 0.224].map(z =>
        <mesh key={`${x}/${z}`} position={[x, 0.18, z]} material={mat.bentOak} castShadow>
          <cylinderGeometry args={[0.016, 0.013, 0.36, 12]} />
        </mesh>))}
      {[-0.415, 0.415].map(x => <mesh key={x} position={[x, 0.142, 0]} material={mat.bentOak}>
        <boxGeometry args={[0.024, 0.025, 0.48]} />
      </mesh>)}
      {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[0, 0.161, (i - 4) * 0.055]} material={mat.bentOak}>
        <boxGeometry args={[0.85, 0.016, 0.022]} />
      </mesh>)}
      <mesh position={[0.06, 0.405, -0.046]} material={mat.ceramicCharcoal}><cylinderGeometry args={[0.064, 0.059, 0.014, 24]} /></mesh>
      <mesh position={[0.06, 0.437, -0.046]} material={mat.ceramicCream}><cylinderGeometry args={[0.022, 0.031, 0.052, 20]} /></mesh>
    </group>

    <group name="foyer-reading-lamp" position={[0.34, 0, 1.58]}>
      <mesh position-y={0.022} material={mat.blackSteel}><cylinderGeometry args={[0.13, 0.155, 0.04, 28]} /></mesh>
      <mesh position-y={0.87} material={mat.blackSteel}><cylinderGeometry args={[0.012, 0.014, 1.70, 10]} /></mesh>
      <group position={[0.065, 1.62, 0.045]} rotation={[-0.45, 0, 0.53]}>
        <mesh geometry={geo.shade} material={mat.blackSteel} castShadow />
        <mesh rotation-x={Math.PI / 2} material={ledOn ? mat.warmLed : mat.ceramicCream}><circleGeometry args={[0.14, 32]} /></mesh>
      </group>
      <pointLight position={[0.15, 1.56, 0.10]} intensity={ledOn ? 2.0 : 0} color="#ffcb91" distance={3.6} />
    </group>
  </>;
}
