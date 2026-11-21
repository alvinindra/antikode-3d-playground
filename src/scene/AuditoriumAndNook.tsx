import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { getSlideYAtZ, getStairsSlopeY, NOOK_PADS, ROOM, SLIDE, TURF_BEANBAGS, WALK_STEP } from './layout';
import { getSceneMaterials } from './materials';
import { BotanicalPlant, FicusTree, StepCushion } from './BotanicalProps';
import { BeanbagChair } from './BeanbagChair';

interface AuditoriumAndNookProps {
  ledOn: boolean;
}

// Keep board widths in metres: a thin riser should not show as many planks as a whole floor.
function oakBoardUVs(geo: THREE.BufferGeometry, tier: number) {
  const { position, normal, uv } = geo.attributes;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const across = Math.abs(normal.getY(i)) > 0.6 ? z + tier * ROOM.tierDepth : y + tier * ROOM.tierHeight;
    uv.setXY(i, (x + 0.41 * tier) / 5.2, across / 3.1);
  }
  return geo;
}

// The chute and its two cheeks are straight-cut boards with plumb ends at the deck and mat.
function slidePanel(width: number, cheek = false): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const low = getSlideYAtZ(SLIDE.bottomZ), high = getSlideYAtZ(SLIDE.topZ);
  const lip = cheek ? 0.20 : 0;
  shape.moveTo(SLIDE.bottomZ, low + lip);
  shape.lineTo(SLIDE.topZ, high + lip);
  shape.lineTo(SLIDE.topZ, cheek ? 0 : high - 0.09);
  shape.lineTo(SLIDE.bottomZ, cheek ? 0 : low - 0.09);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2, 0, 0);
  const { position, normal, uv } = geo.attributes;
  for (let i = 0; i < position.count; i++) {
    const z = position.getZ(i), y = position.getY(i), x = position.getX(i);
    const side = Math.abs(normal.getX(i)) > 0.7, end = Math.abs(normal.getZ(i)) > 0.9;
    uv.setXY(i, (end ? x : z - SLIDE.bottomZ) / 4.7, (end ? y : side ? y - getSlideYAtZ(z) : x) / 2.5);
  }
  return geo;
}

/**
 * Builds the iconic dark charcoal plastered concrete triangular side wall
 * with the clean triangular cozy nook opening carved out (Photo 3).
 */
function buildDarkSideWallGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(ROOM.stairsStartZ, 0);
  shape.lineTo(ROOM.stairsStartZ, 0.14);
  shape.lineTo(ROOM.stairsEndZ, ROOM.mezzanineY);
  shape.lineTo(9.2, ROOM.mezzanineY);
  shape.lineTo(9.2, 0);
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(ROOM.nookStartZ, 0.06);
  hole.lineTo(ROOM.nookEndZ, 0.06);
  hole.lineTo(ROOM.nookEndZ, getStairsSlopeY(ROOM.nookEndZ) - 0.42);
  hole.closePath();
  shape.holes.push(hole);

  const wallThickness = 0.16;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: wallThickness,
    bevelEnabled: false,
  });
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds the triangular oak back wall inside the cozy under-stairs nook so it stays
 * strictly beneath the sloped auditorium steps and never pokes through.
 */
function buildNookBackWallGeometry(): THREE.BufferGeometry {
  const topY = getStairsSlopeY(ROOM.nookEndZ) - 0.42;
  const shape = new THREE.Shape();
  shape.moveTo(ROOM.nookStartZ, 0.06);
  shape.lineTo(ROOM.nookEndZ, 0.06);
  shape.lineTo(ROOM.nookEndZ, topY);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.06,
    bevelEnabled: false,
  });
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export function AuditoriumAndNook({ ledOn }: AuditoriumAndNookProps) {
  const mat = useMemo(() => getSceneMaterials(), []);

  const stairLeftX = WALK_STEP.minX;
  const stairRightX = ROOM.slideLeftX; // 4.2
  const stairWidth = stairRightX - stairLeftX; // 7.92m
  const stairCenterX = (stairLeftX + stairRightX) * 0.5;

  const slideWidth = ROOM.slideRightX - ROOM.slideLeftX; // 1.45m

  const slideBedGeo = useMemo(() => slidePanel(slideWidth - 2 * SLIDE.cheekWidth + 0.002), [slideWidth]);
  const slideCurbGeo = useMemo(() => slidePanel(SLIDE.cheekWidth, true), []);
  const darkSideWallGeo = useMemo(() => buildDarkSideWallGeometry(), []);
  const nookBackWallGeo = useMemo(() => buildNookBackWallGeometry(), []);

  // Smooth chamfered RoundedBox geometries (eliminates razor-sharp CG edges!)
  const tierBoards = useMemo(() => Array.from({ length: ROOM.tierCount }, (_, i) => ({
    tread: oakBoardUVs(new RoundedBoxGeometry(stairWidth, 0.066, ROOM.tierDepth + 0.04, 3, 0.014), i),
    riser: oakBoardUVs(new THREE.BoxGeometry(stairWidth, ROOM.tierHeight - 0.05, 0.05), i),
  })), [stairWidth]);
  const stepCap = 0.028;
  const walkBoards = useMemo(() => Array.from({ length: ROOM.tierCount + 1 }, (_, i) => ({
    body: oakBoardUVs(new THREE.BoxGeometry(WALK_STEP.width, ROOM.tierHeight / 2 - stepCap, WALK_STEP.depth + 0.02), i),
    cap: oakBoardUVs(new RoundedBoxGeometry(WALK_STEP.width + 0.009, stepCap, WALK_STEP.depth + 0.038, 2, 0.004), i),
  })), []);
  const landingPadGeo = useMemo(
    () =>
      new RoundedBoxGeometry(
        ROOM.matMaxX - ROOM.matMinX,
        0.16,
        ROOM.matMaxZ - ROOM.matMinZ,
        4,
        0.04
      ),
    []
  );
  const landingEndPadGeo = useMemo(() => new RoundedBoxGeometry(0.42, 0.16, 0.48, 4, 0.038), []);
  const nookMattressGeo = useMemo(() => new RoundedBoxGeometry(NOOK_PADS.width, 0.18, NOOK_PADS.depth, 4, 0.045), []);
  const tvFrameGeo = useMemo(() => new RoundedBoxGeometry(0.06, 1.12, 1.84, 3, 0.014), []);

  // Precompute the 6 wide auditorium tiers
  const tiers = useMemo(() => {
    return Array.from({ length: ROOM.tierCount }, (_, i) => {
      const zFront = ROOM.stairsStartZ + i * ROOM.tierDepth;
      const topY = (i + 1) * ROOM.tierHeight;
      return { index: i, zFront, topY };
    });
  }, []);

  const railingSlopeAngle = Math.atan2(ROOM.mezzanineY - 0.38, ROOM.stairsEndZ - 0.5);
  const railingSlopeLen = Math.hypot(ROOM.stairsEndZ - 0.5, ROOM.mezzanineY - 0.38);

  const nookTopLeftY = getStairsSlopeY(ROOM.nookStartZ) - 0.42;
  const nookTopRightY = getStairsSlopeY(ROOM.nookEndZ) - 0.42;
  const nookSlopeLen = Math.hypot(ROOM.nookEndZ - ROOM.nookStartZ, nookTopRightY - nookTopLeftY);
  const nookSlopeAngle = Math.atan2(nookTopRightY - nookTopLeftY, ROOM.nookEndZ - ROOM.nookStartZ);

  return (
    <group name="auditorium-and-nook">
      {/* === 6-TIER NATURAL WHITE OAK STEPPING AUDITORIUM (~100 PERSON SCALE) === */}
      <group name="stepping-tiers">
        {tiers.map((tier) => {
          const zCenter = tier.zFront + ROOM.tierDepth * 0.5;
          const treadY = tier.topY - 0.033;
          const riserY = tier.topY - ROOM.tierHeight * 0.5 - 0.03;

          return (
            <group key={tier.index}>
              {/* Smoothly beveled horizontal oak bench tread */}
              <mesh
                position={[stairCenterX, treadY, zCenter - 0.015]}
                geometry={tierBoards[tier.index].tread}
                material={mat.whiteOak}
                castShadow
                receiveShadow
              />

              {/* Vertical recessed oak riser */}
              <mesh
                position={[stairCenterX, riserY, tier.zFront + 0.04]}
                geometry={tierBoards[tier.index].riser}
                material={mat.whiteOakDark}
                receiveShadow
              />

              {/* Recessed warm LED strip tucked beneath EVERY bench nosing */}
              {ledOn && (
                <mesh
                  position={[stairCenterX, tier.topY - 0.095, tier.zFront + 0.008]}
                  material={mat.treadLed}
                >
                  <boxGeometry args={[stairWidth - 0.06, 0.014, 0.018]} />
                </mesh>
              )}

            </group>
          );
        })}

        {walkBoards.map(({ body, cap }, i) => (
          <group key={i} name={`oak-half-step-${i}`} position={[
            WALK_STEP.minX + WALK_STEP.width / 2, (i + 0.5) * ROOM.tierHeight,
            ROOM.stairsStartZ + i * ROOM.tierDepth - WALK_STEP.depth / 2 + 0.01,
          ]}>
            <mesh geometry={body} position-y={-(ROOM.tierHeight / 2 + stepCap) / 2}
              material={mat.whiteOakDark} castShadow receiveShadow />
            <mesh geometry={cap} position={[0.0045, -stepCap / 2, -0.009]}
              material={mat.whiteOak} castShadow receiveShadow />
          </group>
        ))}

        {/* Top 7th riser + LED nosing lip transitioning to Mezzanine floor */}
        <mesh
          position={[stairCenterX, ROOM.mezzanineY - 0.029, ROOM.stairsEndZ + 0.04]}
          material={mat.whiteOak}
          receiveShadow
        >
          <boxGeometry args={[stairWidth, 0.064, 0.16]} />
        </mesh>
        <mesh
          position={[stairCenterX, ROOM.mezzanineY - 0.24, ROOM.stairsEndZ]}
          material={mat.whiteOakDark}
        >
          <boxGeometry args={[stairWidth, ROOM.tierHeight - 0.05, 0.05]} />
        </mesh>
        {ledOn && (
          <>
            <mesh
              position={[stairCenterX, ROOM.mezzanineY - 0.095, ROOM.stairsEndZ - 0.028]}
              material={mat.treadLed}
            >
              <boxGeometry args={[stairWidth - 0.06, 0.014, 0.018]} />
            </mesh>
            <mesh
              position={[stairCenterX, 0.04, ROOM.stairsStartZ - 0.01]}
              material={mat.treadLed}
            >
              <boxGeometry args={[stairWidth - 0.04, 0.022, 0.024]} />
            </mesh>
          </>
        )}

        {/* Solid structural enclosure underneath tiers behind the nook */}
        <mesh
          position={[0.75, ROOM.mezzanineY * 0.5 - 0.1, ROOM.stairsEndZ + 0.13]}
          material={mat.darkPlaster}
        >
          <boxGeometry args={[6.9, ROOM.mezzanineY - 0.2, 0.12]} />
        </mesh>
      </group>

      <group name="turf-beanbags">
        {TURF_BEANBAGS.map(bag => <BeanbagChair key={bag.seed} bag={bag} />)}
      </group>

      <group name="wooden-slide">
        <mesh
          name="slide-bed" position={[SLIDE.centerX, 0, 0]}
          geometry={slideBedGeo}
          material={mat.whiteOak}
          castShadow
          receiveShadow
        />
        <mesh
          position={[ROOM.slideLeftX + SLIDE.cheekWidth / 2, 0, 0]}
          geometry={slideCurbGeo}
          material={mat.whiteOak}
          castShadow
          receiveShadow
        />
        <mesh
          position={[ROOM.slideRightX - SLIDE.cheekWidth / 2, 0, 0]}
          geometry={slideCurbGeo}
          material={mat.whiteOak}
          castShadow
          receiveShadow
        />
        {/* Dark charcoal rounded landing bench + iconic L-corner projection (photo 1ee78024!) */}
        <group
          position={[
            (ROOM.matMinX + ROOM.matMaxX) * 0.5,
            0,
            (ROOM.matMinZ + ROOM.matMaxZ) * 0.5,
          ]}
        >
          <mesh position={[0, 0.09, 0]} material={mat.whiteOakDark}>
            <boxGeometry
              args={[
                ROOM.matMaxX - ROOM.matMinX - 0.1,
                0.18,
                ROOM.matMaxZ - ROOM.matMinZ - 0.1,
              ]}
            />
          </mesh>
          <mesh
            position={[0, ROOM.matHeight - 0.08, 0]}
            geometry={landingPadGeo}
            material={mat.darkFabric}
            castShadow
            receiveShadow
          />
          {/* Subtle L-shaped end cushion block on the turf-facing far corner */}
          <mesh
            position={[-0.78, ROOM.matHeight - 0.11, -0.82]}
            geometry={landingEndPadGeo}
            material={mat.darkFabric}
            castShadow
            receiveShadow
          />
        </group>
      </group>

      {/* === DARK CHARCOAL CONCRETE TRIANGULAR SIDE WALL (PHOTO 3) === */}
      <mesh
        position={[ROOM.nookWallX + 0.08, 0, 0]}
        geometry={darkSideWallGeo}
        material={mat.darkPlaster}
        castShadow
        receiveShadow
      />

      {/* === BLACK STEEL & CLEAR GLASS DIAGONAL BALUSTRADE === */}
      <group name="glass-balustrade" position={[ROOM.nookWallX, 0, 0]}>
        <mesh
          position={[
            0,
            (0.38 + ROOM.mezzanineY) * 0.5 + 1.02,
            (0.5 + ROOM.stairsEndZ) * 0.5,
          ]}
          rotation={[-railingSlopeAngle, 0, 0]}
          material={mat.blackSteel}
        >
          <boxGeometry args={[0.045, 0.045, railingSlopeLen + 0.08]} />
        </mesh>
        {[0.5, 2.15, 3.85, ROOM.stairsEndZ].map((pz) => {
          const baseY = getStairsSlopeY(pz);
          return (
            <mesh key={pz} position={[0, baseY + 0.52, pz]} material={mat.blackSteel}>
              <boxGeometry args={[0.045, 1.04, 0.045]} />
            </mesh>
          );
        })}
        <mesh
          position={[
            0,
            (0.38 + ROOM.mezzanineY) * 0.5 + 0.5,
            (0.5 + ROOM.stairsEndZ) * 0.5,
          ]}
          rotation={[-railingSlopeAngle, 0, 0]}
          material={mat.glassRailing}
        >
          <boxGeometry args={[0.02, 0.96, railingSlopeLen]} />
        </mesh>

        {/* Horizontal mezzanine balustrade continuation */}
        <mesh position={[0, ROOM.mezzanineY + 1.02, 7.35]} material={mat.blackSteel}>
          <boxGeometry args={[0.045, 0.045, 3.7]} />
        </mesh>
        {[7.35, 9.15].map((pz) => (
          <mesh key={pz} position={[0, ROOM.mezzanineY + 0.52, pz]} material={mat.blackSteel}>
            <boxGeometry args={[0.045, 1.04, 0.045]} />
          </mesh>
        ))}
        <mesh position={[0, ROOM.mezzanineY + 0.5, 7.35]} material={mat.glassRailing}>
          <boxGeometry args={[0.02, 0.96, 3.65]} />
        </mesh>
      </group>

      {/* === COZY RECESSED TRIANGULAR WHITE OAK NOOK UNDER STAIRS (PHOTO 3 HERO!) === */}
      <group name="cozy-understairs-nook">
        {/* Oak floor plinth inside nook */}
        <mesh
          position={[
            ROOM.nookWallX + ROOM.nookDepth * 0.5 - 0.04,
            0.09,
            (ROOM.nookStartZ + ROOM.nookEndZ) * 0.5,
          ]}
          material={mat.whiteOak}
          receiveShadow
        >
          <boxGeometry args={[ROOM.nookDepth + 0.12, 0.14, ROOM.nookEndZ - ROOM.nookStartZ + 0.08]} />
        </mesh>

        {/* Triangular oak back wall inside nook (strictly beneath stairs slope) */}
        <mesh
          position={[ROOM.nookWallX + ROOM.nookDepth + 0.03, 0, 0]}
          geometry={nookBackWallGeo}
          material={mat.whiteOak}
          receiveShadow
        />

        {/* Oak right vertical side panel of nook */}
        <mesh
          position={[
            ROOM.nookWallX + ROOM.nookDepth * 0.5 - 0.04,
            (0.08 + nookTopRightY) * 0.5,
            ROOM.nookEndZ - 0.03,
          ]}
          material={mat.whiteOak}
          receiveShadow
        >
          <boxGeometry args={[ROOM.nookDepth + 0.1, nookTopRightY - 0.08, 0.06]} />
        </mesh>

        {/* Sloped oak ceiling lining inside nook */}
        <mesh
          position={[
            ROOM.nookWallX + ROOM.nookDepth * 0.5 - 0.04,
            (nookTopLeftY + nookTopRightY) * 0.5 - 0.03,
            (ROOM.nookStartZ + ROOM.nookEndZ) * 0.5,
          ]}
          rotation={[-nookSlopeAngle, 0, 0]}
          material={mat.whiteOak}
        >
          <boxGeometry args={[ROOM.nookDepth + 0.12, 0.055, nookSlopeLen - 0.04]} />
        </mesh>

        {/* --- LEFT TRIANGULAR CUBBY SHELVES (Z = 0.85 .. 3.15) --- */}
        <mesh
          position={[ROOM.nookWallX + ROOM.nookDepth * 0.5, 0.75, ROOM.nookDividerZ]}
          material={mat.whiteOak}
        >
          <boxGeometry args={[ROOM.nookDepth, 1.24, 0.055]} />
        </mesh>
        <mesh
          position={[ROOM.nookWallX + ROOM.nookDepth * 0.5, 0.44, 2.08]}
          material={mat.whiteOak}
        >
          <boxGeometry args={[ROOM.nookDepth, 0.62, 0.05]} />
        </mesh>
        <mesh
          position={[ROOM.nookWallX + ROOM.nookDepth * 0.5, 0.68, 2.62]}
          material={mat.whiteOak}
        >
          <boxGeometry args={[ROOM.nookDepth, 0.045, 1.06]} />
        </mesh>

        {/* Stacked art books & lush botanical ferns inside the triangular cubbies */}
        <group position={[ROOM.nookWallX + 0.32, 0.16, 1.62]}>
          <mesh position={[0, 0.03, 0]} material={mat.ceramicCharcoal}>
            <boxGeometry args={[0.28, 0.06, 0.36]} />
          </mesh>
          <mesh position={[0, 0.08, 0.02]} material={mat.ceramicCream}>
            <boxGeometry args={[0.24, 0.04, 0.31]} />
          </mesh>
          <mesh position={[0.02, 0.16, 0.36]} rotation={[0.14, 0, 0]} material={mat.ceramicCream}>
            <boxGeometry args={[0.24, 0.28, 0.05]} />
          </mesh>
        </group>

        <BotanicalPlant position={[ROOM.nookWallX + 0.34, 0.16, 2.46]} scale={0.95} seed={401} style="fern" />
        <group position={[ROOM.nookWallX + 0.34, 0.16, 2.88]}>
          <mesh position={[0, 0.035, 0]} material={mat.ceramicCharcoal}>
            <boxGeometry args={[0.28, 0.065, 0.34]} />
          </mesh>
          <mesh position={[0, 0.085, 0]} material={mat.ceramicCream}>
            <boxGeometry args={[0.25, 0.04, 0.3]} />
          </mesh>
        </group>

        <BotanicalPlant position={[ROOM.nookWallX + 0.32, 0.71, 2.86]} scale={0.78} seed={412} style="fern" />
        <StepCushion position={[ROOM.nookWallX + 0.85, 0.23, 2.68]} rotationY={0.04} />
        <StepCushion position={[ROOM.nookWallX + 0.86, 0.37, 2.69]} rotationY={-0.05} />

        {/* --- RIGHT LOUNGE ALCOVE: OAK LEDGE + TWIN MATTRESS + BOLSTERS + LAMPS --- */}
        <mesh
          position={[ROOM.nookWallX + ROOM.nookDepth * 0.5, 0.22, 3.4]}
          material={mat.whiteOak}
          receiveShadow
        >
          <boxGeometry args={[ROOM.nookDepth - 0.06, 0.14, 0.48]} />
        </mesh>

        {/* Smooth frosted warm glass orb table lamp */}
        <group position={[ROOM.nookWallX + 0.95, 0.36, 3.45]}>
          {ledOn && <pointLight name="nook-table-glow" color="#ffe0b7" intensity={0.15} distance={1.65} decay={2} />}
          <mesh position={[0, -0.04, 0]} material={mat.blackSteel}>
            <cylinderGeometry args={[0.05, 0.06, 0.06, 20]} />
          </mesh>
          <mesh material={ledOn ? mat.lampBulb : mat.ceramicCream}>
            <sphereGeometry args={[0.075, 24, 24]} />
          </mesh>
        </group>

        {/* Smooth rounded twin dark-charcoal upholstered mattresses */}
        {NOOK_PADS.z.map((z,i)=><mesh key={z} name={`mattress-${i}`} position={[NOOK_PADS.x,NOOK_PADS.top-0.09,z]}
          geometry={nookMattressGeo} material={mat.darkFabric} castShadow receiveShadow />)}

        {/* Smooth rounded cylindrical bolster pillows with soft hemispherical end-caps */}
        {NOOK_PADS.z.map((bz) => (
          <mesh
            key={bz}
            position={[ROOM.nookWallX + 1.32, 0.45, bz]}
            rotation={[Math.PI / 2, 0, 0]}
            material={mat.darkFabric}
            castShadow
          >
            <capsuleGeometry args={[0.115, 0.56, 12, 24]} />
          </mesh>
        ))}

        {/* Warm ribbed-glass wall sconce mounted on the right oak panel */}
        <group position={[ROOM.nookWallX + 0.66, 1.18, ROOM.nookEndZ - 0.1]}>
          {ledOn && <pointLight name="nook-sconce-glow" position={[0,0,-0.01]} color="#ffe4c2" intensity={0.26} distance={2.1} decay={2} />}
          <mesh position={[0, 0, 0.03]} material={mat.blackSteel}>
            <cylinderGeometry args={[0.05, 0.05, 0.04, 20]} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={ledOn ? mat.lampBulb : mat.ceramicCream}>
            <cylinderGeometry args={[0.095, 0.095, 0.08, 28]} />
          </mesh>
        </group>

      </group>

      {/* === RIGHT OF NOOK: LUSH 165-LEAF POTTED FICUS TREE & OAK-FRAMED TV === */}
      <FicusTree position={[ROOM.nookWallX - 0.42, 0, 5.85]} />

      <group position={[ROOM.nookWallX - 0.11, 1.72, 7.55]}>
        <mesh geometry={tvFrameGeo} material={mat.whiteOak} castShadow />
        <mesh position={[-0.032, 0, 0]} material={mat.matteScreen}>
          <boxGeometry args={[0.015, 1.04, 1.76]} />
        </mesh>
      </group>
    </group>
  );
}
