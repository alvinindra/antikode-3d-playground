import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { getSceneMaterials } from './materials';

function createSeededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

let cachedLeafGeo: THREE.BufferGeometry | null = null;
function getLeafGeometry(): THREE.BufferGeometry {
  if (cachedLeafGeo) return cachedLeafGeo;
  // Smooth organic tapered botanical leaf blade with gentle longitudinal arch
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.032, 0.028, 0.038, 0.075, 0, 0.125);
  shape.bezierCurveTo(-0.038, 0.075, -0.032, 0.028, 0, 0);

  const geo = new THREE.ShapeGeometry(shape, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Slight cup across width + natural downward droop along blade
    const cup = Math.abs(x) * 0.22;
    const droop = -(y * y) * 1.4;
    pos.setZ(i, cup + droop);
  }
  geo.computeVertexNormals();
  cachedLeafGeo = geo;
  return geo;
}

/**
 * Smooth multi-stem potted botanical plant (eucalyptus / fern / leafy studio plant)
 * rendered with instanced curved leaves (1 draw call for all leaves, zero blocky shapes).
 */
export function BotanicalPlant({
  position,
  scale = 1,
  seed = 101,
  style = 'eucalyptus',
}: {
  position: [number, number, number];
  scale?: number;
  seed?: number;
  style?: 'eucalyptus' | 'fern' | 'compact';
}) {
  const mat = useMemo(() => getSceneMaterials(), []);
  const leafGeo = useMemo(() => getLeafGeometry(), []);
  const leavesRef = useRef<THREE.InstancedMesh>(null);

  const leafCount = style === 'compact' ? 32 : 46;

  const stems = useMemo(() => {
    const rand = createSeededRand(seed);
    const count = style === 'compact' ? 4 : 6;
    return Array.from({ length: count }, (_, i) => {
      const ang = (i / count) * Math.PI * 2 + rand() * 0.4;
      const tilt = style === 'fern' ? 0.42 + rand() * 0.35 : 0.18 + rand() * 0.32;
      const height = (style === 'compact' ? 0.16 : 0.28) + rand() * 0.14;
      return { ang, tilt, height };
    });
  }, [seed, style]);

  useEffect(() => {
    if (!leavesRef.current) return;
    const rand = createSeededRand(seed + 77);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < leafCount; i++) {
      const stem = stems[i % stems.length];
      const frac = 0.28 + (i / leafCount) * 0.78;
      const radius = Math.sin(stem.tilt) * stem.height * frac;
      const y = 0.12 + Math.cos(stem.tilt) * stem.height * frac;
      const sideJitter = (rand() - 0.5) * 0.06;

      dummy.position.set(
        Math.cos(stem.ang) * radius + sideJitter,
        y,
        Math.sin(stem.ang) * radius + (rand() - 0.5) * 0.06
      );
      dummy.rotation.set(
        0.55 + rand() * 0.85,
        stem.ang + (rand() - 0.5) * 1.4,
        (rand() - 0.5) * 0.5
      );
      const s = (style === 'compact' ? 0.52 : 0.72) + rand() * 0.35;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      leavesRef.current.setMatrixAt(i, dummy.matrix);
    }
    leavesRef.current.instanceMatrix.needsUpdate = true;
  }, [leafCount, seed, stems, style]);

  const leafMaterial =
    style === 'eucalyptus'
      ? mat.eucalyptusLeaf
      : style === 'fern'
        ? mat.foliageLight
        : mat.foliage;

  return (
    <group position={position} scale={scale}>
      {/* Smooth tapered ceramic planter */}
      <mesh position={[0, 0.075, 0]} material={mat.ceramicCharcoal} castShadow receiveShadow>
        <cylinderGeometry args={[0.078, 0.058, 0.15, 24]} />
      </mesh>
      {/* Subtle dark soil bed */}
      <mesh position={[0, 0.146, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.072, 20]} />
        <meshStandardMaterial color="#1f1b18" roughness={1} />
      </mesh>
      {/* Slender curved stems */}
      {stems.map((s, idx) => (
        <mesh
          key={idx}
          position={[
            Math.cos(s.ang) * Math.sin(s.tilt) * s.height * 0.45,
            0.13 + Math.cos(s.tilt) * s.height * 0.45,
            Math.sin(s.ang) * Math.sin(s.tilt) * s.height * 0.45,
          ]}
          rotation={[Math.sin(s.ang) * s.tilt, 0, -Math.cos(s.ang) * s.tilt]}
          material={mat.foliage}
        >
          <cylinderGeometry args={[0.004, 0.006, s.height, 8]} />
        </mesh>
      ))}
      {/* Instanced organic leaves */}
      <instancedMesh
        ref={leavesRef}
        args={[leafGeo, leafMaterial, leafCount]}
        castShadow
      />
    </group>
  );
}

/**
 * Lush multi-branch potted indoor Ficus tree beside the Cozy Nook (Photo 3),
 * using 160 instanced curved botanical leaves (1 single draw call, zero blocky blobs!).
 */
export function FicusTree({ position }: { position: [number, number, number] }) {
  const mat = useMemo(() => getSceneMaterials(), []);
  const leafGeo = useMemo(() => getLeafGeometry(), []);
  const leavesRef = useRef<THREE.InstancedMesh>(null);
  const leafCount = 165;

  useEffect(() => {
    if (!leavesRef.current) return;
    const rand = createSeededRand(904);
    const dummy = new THREE.Object3D();

    // Cluster centers matching a natural bushy indoor ficus silhouette
    const clusters = [
      { cx: 0, cy: 1.08, cz: 0, r: 0.34 },
      { cx: 0.16, cy: 0.88, cz: 0.12, r: 0.25 },
      { cx: -0.15, cy: 0.92, cz: -0.1, r: 0.26 },
      { cx: 0.06, cy: 1.36, cz: -0.05, r: 0.22 },
      { cx: -0.08, cy: 0.72, cz: 0.14, r: 0.2 },
    ];

    for (let i = 0; i < leafCount; i++) {
      const c = clusters[i % clusters.length];
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const rad = c.r * (0.42 + rand() * 0.65);

      const x = c.cx + rad * Math.sin(phi) * Math.cos(theta);
      const y = c.cy + rad * Math.cos(phi) * 0.9;
      const z = c.cz + rad * Math.sin(phi) * Math.sin(theta);

      dummy.position.set(x, y, z);
      dummy.rotation.set(
        0.35 + rand() * 1.25,
        theta + (rand() - 0.5) * 0.8,
        (rand() - 0.5) * 0.7
      );
      const s = 0.82 + rand() * 0.55;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      leavesRef.current.setMatrixAt(i, dummy.matrix);
    }
    leavesRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <group position={position}>
      {/* Smooth matte charcoal tapered planter */}
      <mesh position={[0, 0.22, 0]} material={mat.ceramicCharcoal} castShadow receiveShadow>
        <cylinderGeometry args={[0.215, 0.155, 0.44, 28]} />
      </mesh>
      <mesh position={[0, 0.436, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 24]} />
        <meshStandardMaterial color="#1f1a17" roughness={1} />
      </mesh>
      {/* Main natural wood trunk & secondary branches */}
      <mesh position={[0, 0.72, 0]} material={mat.whiteOakDark} castShadow>
        <cylinderGeometry args={[0.026, 0.044, 0.72, 12]} />
      </mesh>
      <mesh position={[0.08, 0.86, 0.06]} rotation={[0.3, 0, -0.45]} material={mat.whiteOakDark}>
        <cylinderGeometry args={[0.012, 0.022, 0.36, 10]} />
      </mesh>
      <mesh position={[-0.08, 0.9, -0.05]} rotation={[-0.25, 0, 0.42]} material={mat.whiteOakDark}>
        <cylinderGeometry args={[0.012, 0.022, 0.38, 10]} />
      </mesh>
      <mesh position={[0.03, 1.15, -0.02]} rotation={[-0.1, 0, -0.15]} material={mat.whiteOakDark}>
        <cylinderGeometry args={[0.01, 0.018, 0.35, 10]} />
      </mesh>
      {/* 165 smooth instanced ficus leaves */}
      <instancedMesh ref={leavesRef} args={[leafGeo, mat.foliage, leafCount]} castShadow />
    </group>
  );
}

/**
 * Plump soft square floor pillow stacked along the auditorium tiers (photo 27612294).
 */
export function StepCushion({
  position,
  rotationY = 0,
}: {
  position: [number, number, number];
  rotationY?: number;
}) {
  const mat = useMemo(() => getSceneMaterials(), []);

  const geo = useMemo(() => {
    const g = new RoundedBoxGeometry(0.58, 0.13, 0.52, 5, 0.055);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const puff = Math.cos(x * 4.2) * Math.cos(z * 4.6) * 0.024;
      pos.setY(i, y + (y > 0 ? puff : -puff * 0.25));
    }
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh
      position={position}
      rotation={[0, rotationY, 0]}
      geometry={geo}
      material={mat.darkFabric}
      castShadow
      receiveShadow
    />
  );
}

/**
 * Realistic black beveled PA / Karaoke speaker cabinet (visible on top oak shelves in f3b67f68).
 */
export function PASpeaker({ position }: { position: [number, number, number] }) {
  const mat = useMemo(() => getSceneMaterials(), []);
  const bodyGeo = useMemo(() => new RoundedBoxGeometry(0.62, 0.34, 0.3, 4, 0.03), []);

  return (
    <group position={position}>
      <mesh geometry={bodyGeo} material={mat.ceramicCharcoal} castShadow receiveShadow />
      {/* Front center perforated acoustic grille */}
      <mesh position={[0, 0, 0.146]} material={mat.blackSteel}>
        <boxGeometry args={[0.34, 0.27, 0.018]} />
      </mesh>
      {/* Angled left & right tweeter side facets */}
      <mesh position={[-0.22, 0, 0.138]} rotation={[0, -0.24, 0]} material={mat.brushedMetal}>
        <boxGeometry args={[0.14, 0.26, 0.018]} />
      </mesh>
      <mesh position={[0.22, 0, 0.138]} rotation={[0, 0.24, 0]} material={mat.brushedMetal}>
        <boxGeometry args={[0.14, 0.26, 0.018]} />
      </mesh>
      {/* Center silver brand badge */}
      <mesh position={[0, 0, 0.158]} material={mat.ceramicCream}>
        <boxGeometry args={[0.048, 0.048, 0.008]} />
      </mesh>
    </group>
  );
}

/**
 * Pro AV amplifier + wireless microphone receiver with twin V-antennas (exact match to f3b67f68).
 */
export function AudioRackStack({ position }: { position: [number, number, number] }) {
  const mat = useMemo(() => getSceneMaterials(), []);
  const ampGeo = useMemo(() => new RoundedBoxGeometry(0.58, 0.15, 0.34, 3, 0.015), []);
  const recGeo = useMemo(() => new RoundedBoxGeometry(0.54, 0.06, 0.26, 3, 0.01), []);

  return (
    <group position={position}>
      {/* Main AV amplifier */}
      <mesh position={[0, 0.075, 0]} geometry={ampGeo} material={mat.blackSteel} castShadow />
      {/* Rotary volume knobs */}
      <mesh position={[-0.22, 0.078, 0.172]} rotation={[Math.PI / 2, 0, 0]} material={mat.brushedMetal}>
        <cylinderGeometry args={[0.028, 0.028, 0.02, 18]} />
      </mesh>
      <mesh position={[0.22, 0.078, 0.172]} rotation={[Math.PI / 2, 0, 0]} material={mat.brushedMetal}>
        <cylinderGeometry args={[0.028, 0.028, 0.02, 18]} />
      </mesh>
      {/* Subtle blue-white OLED display strip */}
      <mesh position={[0, 0.088, 0.172]}>
        <planeGeometry args={[0.18, 0.042]} />
        <meshBasicMaterial color="#7bb4e8" />
      </mesh>

      {/* Wireless mic receiver stacked on top */}
      <mesh position={[0, 0.18, 0.01]} geometry={recGeo} material={mat.ceramicCharcoal} />
      {/* Twin angled V-antennas */}
      <mesh position={[-0.1, 0.28, -0.04]} rotation={[0, 0, -0.22]} material={mat.blackSteel}>
        <cylinderGeometry args={[0.005, 0.007, 0.2, 8]} />
      </mesh>
      <mesh position={[0.1, 0.28, -0.04]} rotation={[0, 0, 0.22]} material={mat.blackSteel}>
        <cylinderGeometry args={[0.005, 0.007, 0.2, 8]} />
      </mesh>
    </group>
  );
}

/**
 * Iconic matte black sculptural Darth Vader collectible figurine on the right oak shelf (f3b67f68).
 */
export function SculpturalFigurine({ position }: { position: [number, number, number] }) {
  const mat = useMemo(() => getSceneMaterials(), []);

  return (
    <group position={position}>
      {/* Flowing sculpted cloak */}
      <mesh position={[0, 0.17, 0]} material={mat.blackSteel} castShadow>
        <coneGeometry args={[0.115, 0.34, 20]} />
      </mesh>
      {/* Shoulders & chest armor */}
      <mesh position={[0, 0.27, 0.01]} material={mat.ceramicCharcoal} castShadow>
        <sphereGeometry args={[0.068, 16, 14]} />
      </mesh>
      {/* Iconic flared helmet */}
      <mesh position={[0, 0.355, 0.01]} material={mat.blackSteel} castShadow>
        <coneGeometry args={[0.056, 0.095, 16]} />
      </mesh>
      <mesh position={[0, 0.385, 0.01]} material={mat.blackSteel}>
        <sphereGeometry args={[0.042, 16, 14]} />
      </mesh>
      {/* Thin glowing crimson saber accent */}
      <mesh position={[-0.088, 0.27, 0.04]} rotation={[0, 0, 0.36]} material={mat.redSaberGlow}>
        <cylinderGeometry args={[0.0045, 0.0045, 0.22, 8]} />
      </mesh>
    </group>
  );
}

/**
 * Smooth minimalist sneaker pair for the slatted white oak shoe rack (seen in 55c116de).
 */
export function SneakerPair({
  position,
  color = '#eae6df',
  rotationY = 0,
}: {
  position: [number, number, number];
  color?: string;
  rotationY?: number;
}) {
  const upperGeo = useMemo(() => new RoundedBoxGeometry(0.11, 0.075, 0.24, 3, 0.025), []);
  const soleGeo = useMemo(() => new RoundedBoxGeometry(0.116, 0.026, 0.255, 3, 0.01), []);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[-0.07, 0.07].map((ox) => (
        <group key={ox} position={[ox, 0, 0]}>
          <mesh position={[0, 0.013, 0]} geometry={soleGeo}>
            <meshStandardMaterial color="#f2f0ec" roughness={0.65} />
          </mesh>
          <mesh position={[0, 0.056, -0.01]} geometry={upperGeo} castShadow>
            <meshStandardMaterial color={color} roughness={0.78} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
