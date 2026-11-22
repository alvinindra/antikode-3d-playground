import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROOM, type BeanbagSpec } from './layout';
import { getSceneMaterials } from './materials';
import { compressBag } from './seating';

// Each meridian runs under the sack, over a panel of its slouched back, then into the seat.
function meridian(angle: number, seed: number) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const skew = Math.sin(seed) * 0.075;
  const back = (1 + Math.sin(angle + skew * 3)) * 0.5;
  const crest = 0.31 + (0.37 + 0.055 * Math.cos(seed)) * back ** 1.6 + 0.058 * c * c;
  function ring(rx: number, rz: number, y: number, cx: number, cz: number, t: number, gather: number) {
    const pleat = (0.5 + 0.5 * Math.cos(7 * angle + seed + 4.2 * t + 1.35 * Math.sin(2 * angle - 2 * t))) ** 5;
    const lobe = Math.sin(3 * angle + seed * 0.63 + t) * 0.045 + Math.cos(5 * angle - seed) * 0.028;
    const fullness = 1 + gather * (lobe - 0.105 * pleat);
    return new THREE.Vector3(cx + rx * c * fullness, y + gather * (lobe * 0.52 - 0.061 * pleat), cz + rz * s * fullness);
  }
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.002, 0),
    ring(0.38, 0.36, 0.005, 0, 0, 0, 0),
    ring(0.53, 0.49, 0.08, 0, 0, 0.18, 0.45),
    ring(0.58, 0.54, 0.19 + back * 0.045, 0, 0, 0.34, 0.75),
    ring(0.54, 0.49, crest * 0.77, skew * 0.5, 0.01, 0.5, 0.75),
    ring(0.43, 0.42, crest, skew * back * 1.8, -0.04 * back, 0.62, 0.40),
    ring(0.31, 0.28, 0.26 + 0.17 * back, skew * 1.5, -0.035, 0.73, 1.18),
    ring(0.19, 0.16, 0.218 + 0.05 * back, skew, -0.065, 0.86, 0.62),
    new THREE.Vector3(skew, 0.193, -0.095),
  ], false, 'catmullrom', 0.36);
}

function sewChair(seed: number) {
  const columns = 80, rows = 32;
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], colors: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3(), tangent = new THREE.Vector3(), n = new THREE.Vector3();
  const left = new THREE.Vector3(), right = new THREE.Vector3();
  for (let col = 0; col <= columns; col++) {
    const angle = col / columns * Math.PI * 2;
    const profile = meridian(angle, seed);
    const prev = meridian(angle - 0.001, seed), next = meridian(angle + 0.001, seed);
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      profile.getPoint(t, p);
      positions.push(p.x, Math.max(0.001, p.y), p.z);
      if (row === 0 || row === rows) n.set(0, row === 0 ? -1 : 1, 0);
      else n.crossVectors(profile.getTangent(t, tangent), next.getPoint(t, right).sub(prev.getPoint(t, left))).normalize();
      normals.push(n.x, n.y, n.z);
      uvs.push(col / columns, t);
      const shade = 0.75 + 0.25 * THREE.MathUtils.smoothstep(p.y, 0, 0.25) - 0.12 * t ** 6;
      colors.push(shade, shade, shade);
      if (row < rows && col < columns) {
        const a = col * (rows + 1) + row, b = a + rows + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const cloth = new THREE.BufferGeometry();
  cloth.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  cloth.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  cloth.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  cloth.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  cloth.setIndex(indices);

  const welts = [-2.65, -0.47, 0.95].map(angle => {
    const profile = meridian(angle + 0.12 * Math.sin(seed), seed);
    const path = Array.from({ length: 31 }, (_, i) => profile.getPoint(0.19 + i / 30 * 0.68));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 36, 0.0032, 5, false);
  });
  const seams = mergeGeometries(welts);
  welts.forEach(g => g.dispose());
  for (const g of [cloth,seams]) {
    const pos=g.attributes.position.clone();
    for(let i=0;i<pos.count;i++) pos.setY(i,compressBag(pos.getX(i),pos.getY(i),pos.getZ(i)));
    g.morphAttributes.position=[pos];
    const loaded=g.clone(); loaded.setAttribute('position',pos); loaded.computeVertexNormals();
    g.morphAttributes.normal=[loaded.attributes.normal.clone()]; loaded.dispose();
  }
  return { cloth, seams };
}

export function BeanbagChair({ bag }: { bag: BeanbagSpec }) {
  const { cloth, seams } = useMemo(() => sewChair(bag.seed), [bag.seed]);
  const mat = getSceneMaterials();
  return (
    <group name={`beanbag-${bag.seed}`} position={[bag.x, ROOM.turfY, bag.z]} rotation-y={bag.yaw} scale={bag.scale}>
      <mesh material={mat.contactShade} userData={{ collision: 'terrain' }} rotation-x={-Math.PI / 2} position-y={0.002} scale={[1.4, 1.32, 1]}>
        <planeGeometry />
      </mesh>
      <mesh args={[cloth,mat[bag.fabric]]} userData={{ collision: 'round' }} castShadow receiveShadow />
      <mesh args={[seams,mat.seamThread]} userData={{ collision: 'round' }} />
    </group>
  );
}
