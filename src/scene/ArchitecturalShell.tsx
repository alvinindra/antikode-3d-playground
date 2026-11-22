import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { FOYER, getRoofY, ROOM, ROOF_SLOPE } from './layout';
import { getSceneMaterials } from './materials';
import { GalleryEntrance } from './GalleryEntrance';

interface ArchitecturalShellProps {
  isDay: boolean;
  spotlightsOn: boolean;
  ledOn: boolean;
}

const FRAME_Z_POSITIONS = [-7.85, -4.1, -0.35, 3.4, 7.15, 10.65];

export function ArchitecturalShell({
  isDay,
  spotlightsOn,
  ledOn,
}: ArchitecturalShellProps) {
  const mat = useMemo(() => getSceneMaterials(), []);
  const spotHousingRef = useRef<THREE.InstancedMesh>(null);
  const spotLensRef = useRef<THREE.InstancedMesh>(null);

  const roofAngle = Math.atan(ROOF_SLOPE);
  const roofWidth = ROOM.rightWallX - ROOM.galleryMinX + 0.6;
  const roofSpanLength = roofWidth / Math.cos(roofAngle);
  const roofCenterX = (ROOM.galleryMinX + ROOM.rightWallX) * 0.5;
  const roofCenterY = getRoofY(roofCenterX);
  const hallDepth = ROOM.mezzanineEndZ - ROOM.focalBackZ + 0.4;
  const hallCenterZ = (ROOM.focalBackZ + ROOM.mezzanineEndZ) * 0.5;
  const galleryWall = useMemo(() => {
    // A single concrete face from the art rail over the opening, stopping before the balcony.
    const section = new THREE.Shape();
    section.moveTo(ROOM.focalBackZ, 0);
    section.lineTo(ROOM.doorwayStartZ, 0);
    section.lineTo(ROOM.doorwayStartZ, FOYER.hallHeadY);
    section.lineTo(ROOM.doorwayEndZ + 0.22, FOYER.hallHeadY);
    section.lineTo(ROOM.doorwayEndZ + 0.22, ROOM.roofLeftY + 0.1);
    section.lineTo(ROOM.focalBackZ, ROOM.roofLeftY + 0.1);
    section.closePath();
    const geo = new THREE.ExtrudeGeometry(section, { depth: 0.28, bevelEnabled: false });
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 8, uv.getY(i) / 7);
    return geo;
  }, []);

  // Compute purlin positions across the full sloped roof
  const purlins = useMemo(() => {
    const items: Array<{ x: number; y: number }> = [];
    const count = 10;
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const x = THREE.MathUtils.lerp(ROOM.galleryMinX + 0.4, ROOM.rightWallX - 0.15, t);
      items.push({ x, y: getRoofY(x) - 0.08 });
    }
    return items;
  }, []);

  // Compute track spotlight head transforms (dual heads along 3 longitudinal rails)
  const spotlightPositions = useMemo(() => {
    const list: Array<{ x: number; y: number; z: number; rotX: number; rotZ: number }> = [];
    const railXs = [-4.2, -0.4, 3.2];
    const railZs = [-5.8, -2.2, 1.5, 5.2, 8.6];
    for (const rx of railXs) {
      const ry = getRoofY(rx) - 0.46;
      for (const rz of railZs) {
        list.push({ x: rx - 0.14, y: ry, z: rz, rotX: 0.12, rotZ: 0.08 });
        list.push({ x: rx + 0.14, y: ry, z: rz, rotX: -0.1, rotZ: -0.08 });
      }
    }
    return list;
  }, []);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    if (spotHousingRef.current && spotLensRef.current) {
      spotlightPositions.forEach((p, idx) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.rotX, 0, p.rotZ);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        spotHousingRef.current!.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(p.x, p.y - 0.095, p.z);
        dummy.updateMatrix();
        spotLensRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      spotHousingRef.current.instanceMatrix.needsUpdate = true;
      spotLensRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [spotlightPositions]);

  // Cross-bracing tension rods between rafters (signature Photo 1 detail)
  const bracingCables = useMemo(() => {
    const segs: Array<{ pos: [number, number, number]; length: number; quat: THREE.Quaternion }> = [];
    const bays: Array<[number, number]> = [
      [-7.85, -4.1],
      [-4.1, -0.35],
      [-0.35, 3.4],
      [3.4, 7.15],
    ];
    const xPairs: Array<[number, number]> = [
      [-5.6, -1.2],
      [-1.2, 3.4],
    ];
    const up = new THREE.Vector3(0, 1, 0);

    for (const [z0, z1] of bays) {
      for (const [x0, x1] of xPairs) {
        const pA = new THREE.Vector3(x0, getRoofY(x0) - 0.24, z0);
        const pB = new THREE.Vector3(x1, getRoofY(x1) - 0.24, z1);
        const pC = new THREE.Vector3(x1, getRoofY(x1) - 0.24, z0);
        const pD = new THREE.Vector3(x0, getRoofY(x0) - 0.24, z1);

        for (const [s, e] of [
          [pA, pB],
          [pC, pD],
        ]) {
          const dir = new THREE.Vector3().subVectors(e, s);
          const length = dir.length();
          const mid = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5);
          const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize());
          segs.push({ pos: [mid.x, mid.y, mid.z], length, quat });
        }
      }
    }
    return segs;
  }, []);

  // Trapezoidal gable wall shape above the focal oak wall (Z = -8.0)
  const frontGableGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(ROOM.leftWallX, 4.55);
    shape.lineTo(ROOM.rightWallX, 4.55);
    shape.lineTo(ROOM.rightWallX, getRoofY(ROOM.rightWallX) + 0.15);
    shape.lineTo(ROOM.leftWallX, getRoofY(ROOM.leftWallX) + 0.15);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);

  return (
    <group name="architectural-shell">
      {/* === GROUND FLOOR: POLISHED CONCRETE === */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[roofCenterX, 0, hallCenterZ]}
        material={mat.concreteFloor}
        receiveShadow
      >
        <planeGeometry args={[roofWidth, hallDepth]} />
      </mesh>

      {/* === ARTIFICIAL GREEN TURF CARPET === */}
      <mesh
        position={[
          (ROOM.turfLeftX + ROOM.rightWallX) * 0.5,
          ROOM.turfY * 0.5,
          (ROOM.turfStartZ + ROOM.turfEndZ) * 0.5,
        ]}
        material={mat.turf}
        userData={{ collision: 'terrain' }}
        receiveShadow
      >
        <boxGeometry
          args={[
            ROOM.rightWallX - ROOM.turfLeftX - 0.04,
            ROOM.turfY,
            ROOM.turfEndZ - ROOM.turfStartZ,
          ]}
        />
      </mesh>

      <mesh name="hall-entrance-reveal" position-x={ROOM.leftWallX} rotation-y={-Math.PI / 2}
        geometry={galleryWall} material={mat.entryConcrete} userData={{ collision: 'faces' }} castShadow receiveShadow />
      <mesh position={[ROOM.leftWallX - 0.14, ROOM.roofLeftY - 0.21,
        (ROOM.doorwayEndZ + 0.22 + ROOM.mezzanineEndZ) / 2]} material={mat.darkPlaster} receiveShadow>
        <boxGeometry args={[0.28, 0.54, ROOM.mezzanineEndZ - ROOM.doorwayEndZ - 0.22]} />
      </mesh>
      <mesh name="hall-entrance-post" position={[ROOM.leftWallX - 0.08, FOYER.hallHeadY / 2, ROOM.doorwayEndZ + 0.11]}
        material={mat.blackSteel} castShadow receiveShadow>
        <boxGeometry args={[0.17, FOYER.hallHeadY, 0.22]} />
      </mesh>

      <GalleryEntrance isDay={isDay} ledOn={ledOn} />

      {/* === RIGHT CONCRETE WALL WITH PANORAMIC CLERESTORY WINDOWS === */}
      {/* Lower solid concrete wall */}
      <mesh
        position={[ROOM.rightWallX + 0.14, 1.325, hallCenterZ]}
        material={mat.concreteWall}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[0.28, 2.65, hallDepth]} />
      </mesh>
      {/* Upper concrete header above windows */}
      <mesh
        position={[ROOM.rightWallX + 0.14, 5.15, hallCenterZ]}
        material={mat.concreteWall}
      >
        <boxGeometry args={[0.28, 0.85, hallDepth]} />
      </mesh>
      {/* Window sill & head black aluminum frames */}
      <mesh position={[ROOM.rightWallX + 0.04, 2.67, hallCenterZ]} material={mat.blackSteel}>
        <boxGeometry args={[0.14, 0.06, hallDepth]} />
      </mesh>
      <mesh position={[ROOM.rightWallX + 0.04, 4.74, hallCenterZ]} material={mat.blackSteel}>
        <boxGeometry args={[0.14, 0.06, hallDepth]} />
      </mesh>
      {/* Window glass pane */}
      <mesh
        position={[ROOM.rightWallX + 0.08, 3.7, hallCenterZ]}
        rotation={[0, -Math.PI / 2, 0]}
        material={mat.windowGlass}
      >
        <planeGeometry args={[hallDepth, 2.06]} />
      </mesh>
      {/* Vertical thin silicone glass seams (frameless panoramic butt-joint glazing) */}
      {[-5.2, -2.55, 2.5, 6.4].map((mz) => (
        <mesh key={mz} position={[ROOM.rightWallX + 0.07, 3.7, mz]} material={mat.blackSteel}>
          <boxGeometry args={[0.025, 2.08, 0.022]} />
        </mesh>
      ))}
      {/* Exterior daylight / twilight skyline + tropical trees backdrop outside windows */}
      <mesh
        position={[ROOM.rightWallX + 0.72, 3.7, hallCenterZ]}
        rotation={[0, -Math.PI / 2, 0]}
        material={isDay ? mat.exteriorDay : mat.exteriorNight}
      >
        <planeGeometry args={[hallDepth + 6, 5.4]} />
      </mesh>

      {/* === FRONT GABLE CONCRETE WALL ABOVE FOCAL WOOD PARTITION === */}
      <mesh position={[0, 0, ROOM.focalBackZ + 0.08]} geometry={frontGableGeo} material={mat.concreteWall} />

      {/* === BACK WALL BEHIND MEZZANINE === */}
      <mesh
        position={[roofCenterX, ROOM.roofLeftY * 0.5, ROOM.mezzanineEndZ + 0.15]}
        material={mat.darkPlaster}
      >
        <boxGeometry args={[roofWidth, ROOM.roofLeftY + 1.0, 0.3]} />
      </mesh>

      {/* === MEZZANINE WORKSPACE BACKDROP (visible above amphitheater in Photo 2) === */}
      <group name="mezzanine-workspace">
        {/* Mezzanine floor slab (dark textured carpet on top, dark concrete soffit underneath) */}
        <mesh
          position={[
            (ROOM.nookWallX + ROOM.rightWallX) * 0.5,
            ROOM.mezzanineY - 0.14,
            (ROOM.stairsEndZ + ROOM.mezzanineEndZ) * 0.5,
          ]}
          material={mat.mezzanineCarpet}
          userData={{ collision: 'terrain' }}
          receiveShadow
        >
          <boxGeometry
            args={[
              ROOM.rightWallX - ROOM.nookWallX + 0.1,
              0.28,
              ROOM.mezzanineEndZ - ROOM.stairsEndZ,
            ]}
          />
        </mesh>

        {/* Mezzanine angled dark acoustic soffit/fascia overhead (Photo 2 upper left) */}
        <mesh
          position={[1.8, 5.35, ROOM.stairsEndZ + 0.25]}
          rotation={[0, 0, -0.08]}
          material={mat.darkPlaster}
        >
          <boxGeometry args={[8.4, 0.85, 0.18]} />
        </mesh>

        {/* Glass office partition on mezzanine (Z = 8.2) + subtle timeline graphic */}
        <mesh position={[1.2, ROOM.mezzanineY + 1.15, 8.2]} material={mat.glassRailing}>
          <boxGeometry args={[8.8, 2.3, 0.04]} />
        </mesh>
        <mesh
          position={[1.4, ROOM.mezzanineY + 1.38, 8.17]}
          rotation={[0, Math.PI, 0]}
          material={mat.mezzanineTimelineGlass}
        >
          <planeGeometry args={[6.4, 2.2]} />
        </mesh>
        {[-3.1, -0.5, 2.2, 4.9].map((gx) => (
          <mesh key={gx} position={[gx, ROOM.mezzanineY + 1.15, 8.2]} material={mat.blackSteel}>
            <boxGeometry args={[0.05, 2.3, 0.06]} />
          </mesh>
        ))}

        {/* Mezzanine conference table & minimalist dark chairs */}
        <mesh position={[1.6, ROOM.mezzanineY + 0.74, 9.35]} material={mat.whiteOakDark}>
          <boxGeometry args={[4.4, 0.06, 1.25]} />
        </mesh>
        {[0.05, 3.15].map(x => (
          <mesh key={x} position={[x, ROOM.mezzanineY + 0.355, 9.35]} material={mat.blackSteel}>
            <boxGeometry args={[0.06, 0.71, 0.98]} />
          </mesh>
        ))}
        {[0.1, 1.1, 2.1, 3.1].map((cx) => (
          <group key={cx} position={[cx, ROOM.mezzanineY, 8.6]}>
            <mesh position={[0, 0.45, 0]} material={mat.blackSteel}>
              <boxGeometry args={[0.48, 0.06, 0.46]} />
            </mesh>
            <mesh position={[0, 0.78, -0.2]} material={mat.blackSteel}>
              <boxGeometry args={[0.46, 0.62, 0.06]} />
            </mesh>
            {[-0.19, 0.19].map(x => (
              <mesh key={x} position={[x, 0.21, 0]} material={mat.blackSteel}>
                <boxGeometry args={[0.024, 0.42, 0.39]} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Two iconic suspended linear LED light bars in the mezzanine office (Photo 2!) */}
        {ledOn && (
          <>
            <mesh position={[1.8, ROOM.mezzanineY + 1.85, 8.75]} material={mat.coolLinearLed}>
              <boxGeometry args={[4.8, 0.045, 0.045]} />
            </mesh>
            <mesh position={[1.8, ROOM.mezzanineY + 1.62, 9.85]} material={mat.coolLinearLed}>
              <boxGeometry args={[4.8, 0.045, 0.045]} />
            </mesh>
          </>
        )}

        {/* Adjacent open-office mezzanine balcony visible on right side of Photo 2 */}
        <group position={[-7.6, ROOM.mezzanineY, 7.6]}>
          <mesh position={[0, -0.14, 0]} material={mat.darkPlaster}>
            <boxGeometry args={[5.8, 0.28, 6.2]} />
          </mesh>
          {/* Steel safety railing along balcony front */}
          <mesh position={[0, 1.0, -3.05]} material={mat.blackSteel}>
            <boxGeometry args={[5.8, 0.04, 0.04]} />
          </mesh>
          {[-2.8, -1.4, 0, 1.4, 2.8].map((rx) => (
            <mesh key={rx} position={[rx, 0.5, -3.05]} material={mat.blackSteel}>
              <boxGeometry args={[0.035, 1.0, 0.035]} />
            </mesh>
          ))}
          <mesh position={[0, 0.5, -3.05]} material={mat.glassRailing}>
            <boxGeometry args={[5.7, 0.96, 0.02]} />
          </mesh>
        </group>
      </group>

      {/* === EXPOSED SLOPED INDUSTRIAL STEEL ROOF === */}
      {/* Ribbed insulated metal ceiling deck */}
      <mesh
        position={[roofCenterX, roofCenterY + 0.06, hallCenterZ]}
        rotation={[Math.PI / 2, roofAngle, 0]}
        material={mat.ceilingDeck}
      >
        <planeGeometry args={[roofSpanLength, hallDepth]} />
      </mesh>

      {/* Longitudinal steel purlins under ceiling deck */}
      {purlins.map((p, i) => (
        <mesh
          key={i}
          position={[p.x, p.y, hallCenterZ]}
          rotation={[0, 0, roofAngle]}
          material={mat.blackSteel}
        >
          <boxGeometry args={[0.09, 0.14, hallDepth]} />
        </mesh>
      ))}

      {/* Longitudinal perimeter eaves steel beams supporting all rafters cleanly */}
      <mesh position={[ROOM.leftWallX + 0.12, ROOM.roofLeftY - 0.28, hallCenterZ]} material={mat.blackSteel}>
        <boxGeometry args={[0.24, 0.3, hallDepth]} />
      </mesh>
      <mesh position={[ROOM.rightWallX - 0.12, ROOM.roofRightY - 0.28, hallCenterZ]} material={mat.blackSteel}>
        <boxGeometry args={[0.24, 0.3, hallDepth]} />
      </mesh>

      {/* Heavy black steel I-beam portal frames (columns ONLY at structural bays — never intersecting paintings/shoe rack!) */}
      {FRAME_Z_POSITIONS.map((fz) => {
        const showLeftColumn = fz < -6.5 || fz > 9.5;
        const showRightColumn = fz < -6.5 || (fz > -1.2 && fz < 0.8) || fz > 6.5;
        return (
          <group key={fz} position={[0, 0, fz]}>
            {/* Left structural column at X = -6.4 */}
            {showLeftColumn && (
              <mesh position={[ROOM.leftWallX + 0.12, ROOM.roofLeftY * 0.5, 0]} material={mat.blackSteel}>
                <boxGeometry args={[0.24, ROOM.roofLeftY, 0.22]} />
              </mesh>
            )}
            {/* Right structural column at X = +5.8 */}
            {showRightColumn && (
              <mesh position={[ROOM.rightWallX - 0.12, ROOM.roofRightY * 0.5, 0]} material={mat.blackSteel}>
                <boxGeometry args={[0.24, ROOM.roofRightY, 0.22]} />
              </mesh>
            )}
            {/* Sloped main I-beam rafter web */}
            <mesh
              position={[roofCenterX, roofCenterY - 0.26, 0]}
              rotation={[0, 0, roofAngle]}
              material={mat.blackSteel}
            >
              <boxGeometry args={[roofSpanLength, 0.34, 0.14]} />
            </mesh>
            {/* Bottom flange of I-beam for crisp architectural silhouette */}
            <mesh
              position={[roofCenterX, roofCenterY - 0.43, 0]}
              rotation={[0, 0, roofAngle]}
              material={mat.blackSteel}
            >
              <boxGeometry args={[roofSpanLength, 0.04, 0.26]} />
            </mesh>
          </group>
        );
      })}

      {/* Diagonal tension cross-bracing rods between roof rafters */}
      {bracingCables.map((seg, i) => (
        <mesh key={i} position={seg.pos} quaternion={seg.quat} material={mat.blackSteel}>
          <cylinderGeometry args={[0.012, 0.012, seg.length, 6]} />
        </mesh>
      ))}

      {/* Longitudinal black lighting tracks */}
      {[-4.2, -0.4, 3.2].map((rx) => (
        <mesh
          key={rx}
          position={[rx, getRoofY(rx) - 0.38, hallCenterZ]}
          material={mat.blackSteel}
        >
          <boxGeometry args={[0.06, 0.05, hallDepth - 1.2]} />
        </mesh>
      ))}

      {/* Instanced dual-head ceiling track spotlights */}
      <instancedMesh
        ref={spotHousingRef}
        args={[undefined, undefined, spotlightPositions.length]}
        material={mat.blackSteel}
      >
        <cylinderGeometry args={[0.048, 0.054, 0.18, 18]} />
      </instancedMesh>
      <instancedMesh
        ref={spotLensRef}
        args={[undefined, undefined, spotlightPositions.length]}
        material={spotlightsOn ? mat.spotLens : mat.blackSteel}
      >
        <cylinderGeometry args={[0.04, 0.04, 0.018, 18]} />
      </instancedMesh>
    </group>
  );
}
