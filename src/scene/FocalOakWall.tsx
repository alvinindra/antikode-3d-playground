import { useMemo } from 'react';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ROOM } from './layout';
import { getSceneMaterials } from './materials';
import {
  AudioRackStack,
  BotanicalPlant,
  PASpeaker,
  SculpturalFigurine,
  SneakerPair,
} from './BotanicalProps';

interface FocalOakWallProps {
  ledOn: boolean;
  screenOn: boolean;
}

function FramedShelfPrint({
  position,
  variant = 'A',
}: {
  position: [number, number, number];
  variant?: 'A' | 'B';
}) {
  const mat = useMemo(() => getSceneMaterials(), []);
  return (
    <group position={position} rotation={[-0.08, 0, 0]}>
      <mesh material={mat.blackSteel} castShadow>
        <boxGeometry args={[0.34, 0.42, 0.024]} />
      </mesh>
      <mesh position={[0, 0, 0.013]} material={variant === 'A' ? mat.galleryPrintA : mat.galleryPrintB}>
        <planeGeometry args={[0.3, 0.38]} />
      </mesh>
    </group>
  );
}

export function FocalOakWall({ ledOn, screenOn }: FocalOakWallProps) {
  const mat = useMemo(() => getSceneMaterials(), []);

  const wallWidth = ROOM.rightWallX - ROOM.leftWallX; // 12.2m
  const wallCenterX = (ROOM.leftWallX + ROOM.rightWallX) * 0.5; // -0.3m
  const frontZ = ROOM.focalFrontZ; // -7.2
  const backZ = ROOM.focalBackZ; // -8.0
  const depth = frontZ - backZ; // 0.8m
  const midZ = (frontZ + backZ) * 0.5;

  // Raised architectural oak batten grid on upper bulkhead (exact match to d78e4e7e & 55c116de!)
  const bulkheadBattensX = useMemo(() => {
    const xs: number[] = [];
    for (let x = ROOM.leftWallX + 0.65; x < ROOM.rightWallX - 0.35; x += 0.64) {
      xs.push(x);
    }
    return xs;
  }, []);

  // Rounded geometries for smooth close-up silhouettes
  const shoeShelfGeo = useMemo(() => new RoundedBoxGeometry(0.42, 0.032, 3.16, 3, 0.008), []);
  const switcherGeo = useMemo(() => new RoundedBoxGeometry(0.62, 0.085, 0.28, 3, 0.01), []);
  const floorBoxGeo = useMemo(() => new RoundedBoxGeometry(0.56, 0.17, 0.24, 3, 0.02), []);
  const rightArtCanvasGeo = useMemo(() => new RoundedBoxGeometry(0.06, 1.62, 2.52, 3, 0.012), []);

  // Asymmetric 2x4 oak shelving coordinates: inner bay wider (0.82m), outer bay narrower (0.48m)
  // Left bay: X = -4.35 .. -3.05 (outer: -4.35..-3.87, inner: -3.87..-3.05)
  // Right bay: X = +2.65 .. +3.95 (inner: +2.65..+3.47, outer: +3.47..+3.95)
  const shelfYLevels = [0.34, 0.96, 1.58, 2.2, 2.86];

  return (
    <group name="focal-oak-wall">
      {/* === SOLID BACKING PARTITION (concealing meeting rooms / phone booths / ducting) === */}
      <mesh position={[wallCenterX, 2.32, backZ + 0.12]} material={mat.whiteOakDark} receiveShadow>
        <boxGeometry args={[wallWidth, 4.64, 0.24]} />
      </mesh>

      {/* === UPPER NATURAL WHITE OAK BULKHEAD WITH ARCHITECTURAL BATTEN GRID === */}
      <mesh position={[wallCenterX, 3.92, midZ]} material={mat.whiteOak} castShadow receiveShadow>
        <boxGeometry args={[wallWidth, 1.44, depth]} />
      </mesh>
      {/* Two signature horizontal architectural batten bands at bottom of bulkhead (photo d78e4e7e) */}
      {[3.24, 3.52, 3.74].map((by) => (
        <mesh key={by} position={[wallCenterX, by, frontZ + 0.012]} material={mat.whiteOakDark}>
          <boxGeometry args={[wallWidth, 0.026, 0.026]} />
        </mesh>
      ))}
      {/* Crisp raised vertical oak batten ribs */}
      {bulkheadBattensX.map((sx) => (
        <mesh key={sx} position={[sx, 3.92, frontZ + 0.01]} material={mat.whiteOakDark}>
          <boxGeometry args={[0.024, 1.42, 0.02]} />
        </mesh>
      ))}

      {/* Dark recessed horizontal ducting/AC shadow channel + continuous warm LED cove strip */}
      <mesh position={[wallCenterX, 3.09, midZ - 0.08]} material={mat.blackSteel}>
        <boxGeometry args={[wallWidth, 0.24, depth - 0.16]} />
      </mesh>
      {ledOn && (
        <>
          <mesh position={[wallCenterX, 3.2, frontZ - 0.04]} material={mat.warmLed}>
            <boxGeometry args={[wallWidth - 0.08, 0.028, 0.032]} />
          </mesh>
          <mesh position={[wallCenterX, 2.95, frontZ - 0.04]} material={mat.warmLed}>
            <boxGeometry args={[wallWidth - 0.08, 0.022, 0.026]} />
          </mesh>
        </>
      )}

      {/* === FAR-LEFT OAK CABINET COLUMN (X = -6.4 .. -5.45) === */}
      <mesh position={[-5.925, 1.62, midZ]} material={mat.whiteOak} receiveShadow>
        <boxGeometry args={[0.95, 2.72, depth]} />
      </mesh>
      {[0.94, 1.56, 2.18].map((ry) => (
        <mesh key={ry} position={[-5.925, ry, frontZ + 0.008]} material={mat.whiteOakDark}>
          <boxGeometry args={[0.95, 0.024, 0.018]} />
        </mesh>
      ))}

      {/* === DARK CONCEALED MEETING ROOM DOOR (X = -5.45 .. -4.35) === */}
      <mesh position={[-4.9, 1.47, frontZ - 0.18]} material={mat.darkDoor} receiveShadow>
        <boxGeometry args={[1.08, 2.94, 0.08]} />
      </mesh>
      <mesh position={[-4.46, 1.18, frontZ - 0.11]} material={mat.blackSteel}>
        <boxGeometry args={[0.025, 0.42, 0.04]} />
      </mesh>

      {/* === LEFT ASYMMETRIC 2x4 ILLUMINATED OAK DISPLAY SHELVING (X = -4.35 .. -3.05) === */}
      <group name="left-oak-shelves">
        {[-4.34, -3.87, -3.06].map((vx) => (
          <mesh key={vx} position={[vx, 1.62, midZ + 0.08]} material={mat.whiteOak}>
            <boxGeometry args={[0.048, 2.72, depth - 0.16]} />
          </mesh>
        ))}
        {shelfYLevels.map((sy, rIdx) => (
          <group key={sy}>
            <mesh position={[-3.7, sy, midZ + 0.08]} material={mat.whiteOak}>
              <boxGeometry args={[1.32, 0.045, depth - 0.16]} />
            </mesh>
            {ledOn && rIdx > 0 && (
              <mesh position={[-3.7, sy - 0.028, frontZ - 0.14]} material={mat.warmLed}>
                <boxGeometry args={[1.22, 0.02, 0.024]} />
              </mesh>
            )}
          </group>
        ))}

        {/* Curated items matching photo 55c116de (left shelf bay) */}
        {/* Row 3 (top): PA speaker + framed print in inner wide bay, trailing eucalyptus in outer bay */}
        <PASpeaker position={[-3.46, 2.39, frontZ - 0.24]} />
        <FramedShelfPrint position={[-3.46, 2.52, frontZ - 0.42]} variant="A" />
        <BotanicalPlant position={[-4.1, 2.22, frontZ - 0.25]} scale={1.1} seed={201} style="eucalyptus" />

        {/* Row 2: Framed print + ceramic vessels */}
        <FramedShelfPrint position={[-3.42, 1.82, frontZ - 0.36]} variant="A" />
        <mesh position={[-4.1, 1.72, frontZ - 0.24]} material={mat.ceramicCream} castShadow>
          <cylinderGeometry args={[0.055, 0.072, 0.24, 24]} />
        </mesh>

        {/* Row 1: Stacked design books & compact plant */}
        <group position={[-3.46, 0.99, frontZ - 0.25]}>
          <mesh position={[-0.08, 0.03, 0]} material={mat.ceramicCharcoal}>
            <boxGeometry args={[0.26, 0.055, 0.19]} />
          </mesh>
          <mesh position={[-0.06, 0.075, 0]} rotation={[0, 0.08, 0]} material={mat.ceramicCream}>
            <boxGeometry args={[0.23, 0.04, 0.17]} />
          </mesh>
          <mesh position={[0.16, 0.1, 0]} material={mat.ceramicCobalt} castShadow>
            <sphereGeometry args={[0.085, 20, 16]} />
          </mesh>
        </group>
        <BotanicalPlant position={[-4.1, 0.98, frontZ - 0.24]} scale={0.78} seed={209} style="compact" />

        {/* Row 0 (bottom): Framed graphic print + ceramic planter */}
        <FramedShelfPrint position={[-3.46, 0.58, frontZ - 0.26]} variant="B" />
        <BotanicalPlant position={[-4.1, 0.36, frontZ - 0.24]} scale={0.82} seed={214} style="compact" />
      </group>

      {/* === CENTER RECESSED 3x3 MODULAR LED VIDEO WALL & OAK SURROUND (X = -3.05 .. +2.65) === */}
      <group name="center-media-screen">
        {/* Top horizontal oak lintel */}
        <mesh position={[-0.2, 2.9, midZ]} material={mat.whiteOak}>
          <boxGeometry args={[5.72, 0.16, depth]} />
        </mesh>
        {/* Bottom oak bench/ledge */}
        <mesh position={[-0.2, 0.36, midZ + 0.04]} material={mat.whiteOak} receiveShadow>
          <boxGeometry args={[5.72, 0.14, depth + 0.08]} />
        </mesh>
        {/* Recessed dark concrete plinth beneath oak ledge */}
        <mesh position={[-0.2, 0.14, midZ - 0.08]} material={mat.darkPlaster} receiveShadow>
          <boxGeometry args={[8.35, 0.28, depth - 0.18]} />
        </mesh>
        {/* Warm LED strips along ledge & top screen recess */}
        {ledOn && (
          <>
            <mesh position={[-0.2, 0.28, frontZ - 0.02]} material={mat.warmLed}>
              <boxGeometry args={[5.68, 0.024, 0.028]} />
            </mesh>
            <mesh position={[-0.2, 2.81, frontZ - 0.12]} material={mat.warmLed}>
              <boxGeometry args={[5.52, 0.022, 0.026]} />
            </mesh>
          </>
        )}

        {/* Main 3x3 LED Video Wall display panel */}
        <mesh
          position={[-0.2, 1.63, frontZ - 0.24]}
          material={screenOn ? mat.ledWallActive : mat.matteScreen}
          receiveShadow
        >
          <boxGeometry args={[5.36, 2.26, 0.08]} />
        </mesh>
        {/* Subtle 3x3 seam grid when matte off */}
        {!screenOn && (
          <>
            {[-1.09, 0.69].map((gx) => (
              <mesh key={gx} position={[gx, 1.63, frontZ - 0.195]} material={mat.blackSteel}>
                <boxGeometry args={[0.015, 2.26, 0.008]} />
              </mesh>
            ))}
            {[1.25, 2.0].map((gy) => (
              <mesh key={gy} position={[-0.2, gy, frontZ - 0.195]} material={mat.blackSteel}>
                <boxGeometry args={[5.36, 0.015, 0.008]} />
              </mesh>
            ))}
          </>
        )}

        {/* Pro video/audio switcher console sitting on the right side of the oak ledge (photo f3b67f68!) */}
        <group position={[2.1, 0.47, frontZ - 0.12]}>
          <mesh geometry={switcherGeo} material={mat.blackSteel} castShadow />
          <mesh position={[-0.2, 0.004, 0.142]}>
            <planeGeometry args={[0.1, 0.042]} />
            <meshBasicMaterial color="#6ca6df" />
          </mesh>
          {[-0.02, 0.04, 0.1, 0.16, 0.22].map((bx) => (
            <mesh key={bx} position={[bx, 0.004, 0.142]} material={mat.ceramicCream}>
              <circleGeometry args={[0.009, 10]} />
            </mesh>
          ))}
        </group>
      </group>

      {/* === RIGHT ASYMMETRIC 2x4 ILLUMINATED OAK DISPLAY SHELVING (X = +2.65 .. +3.95) === */}
      <group name="right-oak-shelves">
        {[2.66, 3.47, 3.94].map((vx) => (
          <mesh key={vx} position={[vx, 1.62, midZ + 0.08]} material={mat.whiteOak}>
            <boxGeometry args={[0.048, 2.72, depth - 0.16]} />
          </mesh>
        ))}
        {shelfYLevels.map((sy, rIdx) => (
          <group key={sy}>
            <mesh position={[3.3, sy, midZ + 0.08]} material={mat.whiteOak}>
              <boxGeometry args={[1.32, 0.045, depth - 0.16]} />
            </mesh>
            {ledOn && rIdx > 0 && (
              <mesh position={[3.3, sy - 0.028, frontZ - 0.14]} material={mat.warmLed}>
                <boxGeometry args={[1.22, 0.02, 0.024]} />
              </mesh>
            )}
          </group>
        ))}

        {/* EXACT real-world items from close-up photos f3b67f68 & d78e4e7e! */}
        {/* Row 3 (top): PA Speaker in inner wide bay + lush trailing eucalyptus plant in outer bay */}
        <PASpeaker position={[3.06, 2.39, frontZ - 0.24]} />
        <BotanicalPlant position={[3.71, 2.22, frontZ - 0.25]} scale={1.12} seed={305} style="eucalyptus" />

        {/* Row 2: Matte black Darth Vader sculptural figurine + matte black hourglass ceramic vase */}
        <SculpturalFigurine position={[3.06, 1.6, frontZ - 0.25]} />
        <group position={[3.71, 1.6, frontZ - 0.25]}>
          <mesh position={[0, 0.055, 0]} material={mat.ceramicCharcoal} castShadow>
            <cylinderGeometry args={[0.042, 0.062, 0.11, 24]} />
          </mesh>
          <mesh position={[0, 0.16, 0]} material={mat.ceramicCharcoal} castShadow>
            <cylinderGeometry args={[0.064, 0.04, 0.11, 24]} />
          </mesh>
        </group>

        {/* Row 1: Standing hardcover book + cobalt teardrop ceramic vase */}
        <group position={[3.06, 0.99, frontZ - 0.25]}>
          {/* Upright hardcover book */}
          <mesh position={[-0.18, 0.13, 0]} rotation={[0, 0.05, 0]} material={mat.ceramicCobalt} castShadow>
            <boxGeometry args={[0.18, 0.26, 0.045]} />
          </mesh>
          {/* Cobalt conical/teardrop vase */}
          <mesh position={[0.16, 0.09, 0.02]} material={mat.ceramicCobalt} castShadow>
            <coneGeometry args={[0.09, 0.18, 24]} />
          </mesh>
          <mesh position={[0.16, 0.18, 0.02]} material={mat.ceramicCobalt}>
            <cylinderGeometry args={[0.028, 0.036, 0.06, 20]} />
          </mesh>
        </group>
        {/* Tiny sculptural collectibles in outer niche */}
        <mesh position={[3.66, 1.05, frontZ - 0.25]} material={mat.whiteOakDark}>
          <sphereGeometry args={[0.04, 16, 16]} />
        </mesh>
        <mesh position={[3.78, 1.04, frontZ - 0.23]} material={mat.ceramicCream}>
          <cylinderGeometry args={[0.025, 0.032, 0.075, 16]} />
        </mesh>

        {/* Row 0 (bottom): Pro AV Amplifier + Wireless Mic Receiver with V-antennas + compact bush plant */}
        <AudioRackStack position={[3.06, 0.36, frontZ - 0.22]} />
        <BotanicalPlant position={[3.71, 0.36, frontZ - 0.24]} scale={0.76} seed={318} style="compact" />

        {/* Floor wireless receiver & cable box resting on the green turf right in front (photo f3b67f68!) */}
        <group position={[3.06, 0.11, frontZ + 0.32]}>
          <mesh geometry={floorBoxGeo} material={mat.blackSteel} castShadow receiveShadow />
          <mesh position={[-0.08, 0.11, 0]} material={mat.ceramicCharcoal}>
            <boxGeometry args={[0.3, 0.055, 0.16]} />
          </mesh>
          <mesh position={[-0.14, 0.21, -0.02]} rotation={[0, 0, -0.25]} material={mat.blackSteel}>
            <cylinderGeometry args={[0.004, 0.006, 0.18, 8]} />
          </mesh>
          <mesh position={[-0.02, 0.21, -0.02]} rotation={[0, 0, 0.25]} material={mat.blackSteel}>
            <cylinderGeometry args={[0.004, 0.006, 0.18, 8]} />
          </mesh>
        </group>
      </group>

      {/* === FAR-RIGHT OAK CABINETRY (X = +3.95 .. +5.80) === */}
      <mesh position={[4.875, 1.62, midZ]} material={mat.whiteOak} receiveShadow>
        <boxGeometry args={[1.85, 2.72, depth]} />
      </mesh>
      {[0.94, 1.56, 2.18].map((ry) => (
        <mesh key={ry} position={[4.875, ry, frontZ + 0.008]} material={mat.whiteOakDark}>
          <boxGeometry args={[1.85, 0.024, 0.018]} />
        </mesh>
      ))}
      <mesh position={[4.88, 1.62, frontZ + 0.008]} material={mat.whiteOakDark}>
        <boxGeometry args={[0.02, 2.72, 0.018]} />
      </mesh>

      {/* === RIGHT CONCRETE WALL: VIBRANT COLORFUL ABSTRACT CANVAS (PHOTOS 1ee78024 & 55c116de!) === */}
      <group position={[ROOM.rightWallX - 0.04, 1.58, -3.45]}>
        <mesh geometry={rightArtCanvasGeo} material={mat.blackSteel} castShadow receiveShadow />
        <mesh
          position={[-0.032, 0, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          material={mat.rightWallArt}
        >
          <planeGeometry args={[2.46, 1.56]} />
        </mesh>
      </group>

      {/* === LEFT WALL GALLERY: TWO ABSTRACT PAINTINGS + SLATTED OAK SHOE RACK WITH SNEAKERS === */}
      <group name="left-wall-gallery">
        {/* Painting 1 (unobstructed!) */}
        <group position={[ROOM.leftWallX + 0.04, 1.72, -4.25]}>
          <mesh material={mat.blackSteel} castShadow>
            <boxGeometry args={[0.06, 1.28, 1.28]} />
          </mesh>
          <mesh position={[0.032, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={mat.paintingLeft}>
            <planeGeometry args={[1.14, 1.14]} />
          </mesh>
        </group>

        {/* Painting 2 (unobstructed!) */}
        <group position={[ROOM.leftWallX + 0.04, 1.72, -2.68]}>
          <mesh material={mat.blackSteel} castShadow>
            <boxGeometry args={[0.06, 1.28, 1.28]} />
          </mesh>
          <mesh position={[0.032, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={mat.paintingRight}>
            <planeGeometry args={[1.14, 1.14]} />
          </mesh>
        </group>

        {/* Low 3-tier rounded natural oak shoe rack + neatly arranged sneakers (photo 55c116de!) */}
        <group position={[ROOM.leftWallX + 0.23, 0, -3.48]}>
          {[0.14, 0.36, 0.58].map((sy) => (
            <mesh key={sy} position={[0, sy, 0]} geometry={shoeShelfGeo} material={mat.whiteOak} castShadow receiveShadow />
          ))}
          {[-1.54, -0.77, 0, 0.77, 1.54].map((lz) => (
            <group key={lz}>
              <mesh position={[-0.17, 0.31, lz]} material={mat.whiteOakDark}>
                <cylinderGeometry args={[0.02, 0.02, 0.62, 12]} />
              </mesh>
              <mesh position={[0.17, 0.31, lz]} material={mat.whiteOakDark}>
                <cylinderGeometry args={[0.02, 0.02, 0.62, 12]} />
              </mesh>
            </group>
          ))}
          {/* Neatly lined sneakers on the rack */}
          <SneakerPair position={[0.02, 0.596, -1.18]} color="#ece8df" rotationY={Math.PI / 2} />
          <SneakerPair position={[0.02, 0.596, -0.38]} color="#2b2d33" rotationY={Math.PI / 2} />
          <SneakerPair position={[0.02, 0.596, 0.42]} color="#c9b498" rotationY={Math.PI / 2} />
          <SneakerPair position={[0.02, 0.596, 1.16]} color="#3d546e" rotationY={Math.PI / 2} />
          <SneakerPair position={[0.02, 0.376, -1.12]} color="#2f3238" rotationY={Math.PI / 2} />
          <SneakerPair position={[0.02, 0.376, 0.34]} color="#e6e1d8" rotationY={Math.PI / 2} />
          <SneakerPair position={[0.02, 0.156, -0.42]} color="#5c4c40" rotationY={Math.PI / 2} />
          <SneakerPair position={[0.02, 0.156, 1.12]} color="#e8e4dc" rotationY={Math.PI / 2} />
        </group>
      </group>

      {/* Subtle warm shelf interior fill lights */}
      {ledOn && (
        <>
          <pointLight
            position={[-3.7, 1.65, frontZ + 0.38]}
            color="#ffba6b"
            intensity={2.8}
            distance={4.8}
            decay={2}
          />
          <pointLight
            position={[3.3, 1.65, frontZ + 0.38]}
            color="#ffba6b"
            intensity={2.8}
            distance={4.8}
            decay={2}
          />
        </>
      )}
    </group>
  );
}
