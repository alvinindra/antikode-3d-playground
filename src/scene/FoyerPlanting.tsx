import { useMemo } from 'react';
import * as THREE from 'three';
import { getSceneMaterials } from './materials';

type Species = 'sedge' | 'papyrus' | 'palm' | 'broadleaf';

// Batch the stems, folded blades and leaf midribs of each pot into one static mesh.
function foliage(species: Species, seed: number) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const rand = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
  const vertex = (x: number, y: number, z: number, color: THREE.Color, light: number) => {
    positions.push(x, y, z); colors.push(color.r * light, color.g * light, color.b * light);
    return positions.length / 3 - 1;
  };
  const stemColor = new THREE.Color(species === 'palm' ? '#94896a' : '#849153');
  function stem(x: number, y: number, z: number, dx: number, dy: number, dz: number, radius: number) {
    const base = positions.length / 3;
    for (let i = 0; i < 5; i++) {
      const a = i * 2 * Math.PI / 5, px = Math.cos(a) * radius, pz = Math.sin(a) * radius;
      vertex(x + px, y, z + pz, stemColor, 0.68);
      vertex(x + dx + px * 0.55, y + dy, z + dz + pz * 0.55, stemColor, 1);
      const n = base + (i + 1) % 5 * 2, k = base + i * 2;
      indices.push(k, k + 1, n, n, k + 1, n + 1);
    }
  }
  function blade(x: number, y: number, z: number, a: number, reach: number, rise: number,
    arch: number, width: number, color: THREE.Color) {
    const c = Math.cos(a), s = Math.sin(a), base = positions.length / 3, rows = 8;
    const broad = species === 'broadleaf';
    const ribs = broad ? [-1, -0.11, 0, 0.11, 1] : [-1, 0, 1];
    for (let j = 0; j <= rows; j++) {
      const t = j / rows, w = width * (0.018 + Math.sin(Math.PI * t) ** 0.78);
      const cy = y + rise * t + arch * Math.sin(Math.PI * t);
      for (let k = 0; k < ribs.length; k++) {
        const f = ribs[k];
        vertex(x + c * reach * t - s * w * f, cy + w * (1 - Math.abs(f)) * 0.38,
          z + s * reach * t + c * w * f, color,
          (0.57 + 0.42 * t) * (f === 0 ? (broad ? 2.3 : 1.2) : (f < 0 ? 0.94 : 0.77)));
        if (j && k) {
          const b = base + j * ribs.length + k, p = b - ribs.length;
          indices.push(p - 1, b - 1, p, p, b - 1, b);
        }
      }
    }
  }
  const green = new THREE.Color(), olive = new THREE.Color('#a5a75d'), dark = new THREE.Color('#475c36');
  const tint = () => green.copy(dark).lerp(olive, rand() * 0.84);
  const tau = Math.PI * 2;
  if (species === 'papyrus' || species === 'sedge') {
    for (let i = 0; i < (species === 'papyrus' ? 62 : 110); i++) {
      const a = rand() * tau, r = rand() * 0.085;
      blade(Math.cos(a) * r, 0, Math.sin(a) * r, a, 0.06 + rand() * 0.23, 0.2 + rand() * 0.42,
        0.05 + rand() * 0.08, 0.004 + rand() * 0.007, tint());
    }
    if (species === 'papyrus') for (let i = 0; i < 16; i++) {
      const a = rand() * tau, x = Math.cos(a) * rand() * 0.40, z = Math.sin(a) * rand() * 0.23, h = 0.53 + rand() * 0.96;
      stem(x * 0.22, 0, z * 0.22, x * 0.78, h, z * 0.78, 0.006);
      for (let k = 0; k < 11; k++) blade(x, h, z, a + k * tau / 11, 0.12 + rand() * 0.18,
        -0.04 - rand() * 0.19, 0.05 + rand() * 0.07, 0.006 + rand() * 0.007, tint());
    }
  } else if (species === 'palm') {
    for (let i = 0; i < 13; i++) {
      const a = i * 2.4, c = Math.cos(a), s = Math.sin(a), h = 0.32 + rand() * 0.6, reach = 0.22 + rand() * 0.12;
      stem(0, 0, 0, c * 0.05, h, s * 0.05, 0.007);
      for (let j = 1; j <= 12; j++) {
        const t = j / 12, r = 0.05 + t * reach, y = h + 0.13 * Math.sin(t * 2.6);
        const prev = (j - 1) / 12, py = h + 0.13 * Math.sin(prev * 2.6);
        stem(c * (r - reach / 12), py, s * (r - reach / 12), c * reach / 12, y - py, s * reach / 12, 0.0034);
        for (const side of [-1, 1]) blade(c * r, y, s * r, a + side * 0.87, 0.032 + 0.12 * Math.sin(Math.PI * t),
          -0.025, 0.021, 0.0085, tint());
      }
    }
  } else {
    const leaf = new THREE.Color('#729b4c');
    for (let i = 0; i < 32; i++) {
      const a = i * 2.4, h = 0.09 + rand() * 0.53, x = Math.cos(a) * 0.065, z = Math.sin(a) * 0.065;
      stem(0, 0, 0, x, h, z, 0.007);
      blade(x, h, z, a, 0.17 + rand() * 0.15, 0.14 - rand() * 0.30, 0.13,
        0.072 + rand() * 0.041, green.copy(leaf).lerp(dark, rand() * 0.64));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

function Pot({ at, h, r, species, seed }: { at: [number, number, number]; h: number; r: number; species: Species; seed: number }) {
  const mat = getSceneMaterials();
  const geo = useMemo(() => foliage(species, seed), [species, seed]);
  return <group position={at}>
    <mesh position-y={h / 2} material={species === 'palm' ? mat.ceramicCream : mat.ceramicCharcoal}
      userData={{ collision: 'round' }} castShadow receiveShadow>
      <cylinderGeometry args={[r, r * 0.78, h, 28]} />
    </mesh>
    {species === 'palm' && <mesh position-y={h * 0.24} material={mat.bentOak}>
      <cylinderGeometry args={[r * 0.90, r * 0.79, h * 0.47, 28]} />
    </mesh>}
    <mesh position-y={h + 0.001} rotation-x={-Math.PI / 2} material={mat.darkPlaster}><circleGeometry args={[r * 0.94, 28]} /></mesh>
    <mesh position-y={h} geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.78} />
    </mesh>
  </group>;
}

export function FoyerPlanting() {
  return <>
    <Pot at={[0.34, 0, 1.12]} h={0.34} r={0.15} species="palm" seed={251} />
    <Pot at={[0.77, 0.15, 0.49]} h={0.21} r={0.13} species="sedge" seed={46} />
    <Pot at={[1.52, 0.15, 0.39]} h={0.26} r={0.17} species="papyrus" seed={761} />
    <Pot at={[2.15, 0.15, 0.52]} h={0.19} r={0.13} species="sedge" seed={890} />
    <Pot at={[3.87, 0, 0.20]} h={0.51} r={0.23} species="broadleaf" seed={59} />
  </>;
}
