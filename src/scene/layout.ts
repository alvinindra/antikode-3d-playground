import * as THREE from 'three';

export const ROOM = {
  // X bounds of the primary playground hall
  leftWallX: -6.4,
  rightWallX: 5.8,
  // Extended gallery/corridor to the left of the amphitheater (visible in Photo 3)
  galleryMinX: -10.8,
  // Z bounds
  focalBackZ: -8.0,
  focalFrontZ: -7.2,
  turfStartZ: -7.1,
  turfEndZ: -0.2,
  turfY: 0.024,
  // Stepping auditorium & slide
  stairsStartZ: -0.2,
  stairsEndZ: 5.5,
  mezzanineEndZ: 10.8,
  // Heights
  mezzanineY: 3.15,
  roofLeftY: 7.45,
  roofRightY: 5.45,
  // Lateral divisions
  nookWallX: -3.8,
  turfLeftX: -3.65,
  slideLeftX: 4.2,
  slideRightX: 5.65,
  // Auditorium tiers (6 wide benches + mezzanine landing = 7 rises of 0.45m)
  tierCount: 6,
  tierDepth: 0.95,
  tierHeight: 0.45,
  // Doorway in left concrete wall
  doorwayStartZ: -0.45,
  doorwayEndZ: 2.35,
  // Nook under stairs
  nookStartZ: 0.85,
  nookDividerZ: 3.15,
  nookEndZ: 5.35,
  nookDepth: 1.55,
  // Landing mat at bottom of slide
  matMinX: 4.18,
  matMaxX: 5.68,
  matMinZ: -2.35,
  matMaxZ: -0.2,
  matHeight: 0.32,
} as const;

export const NOOK_PADS = { x: ROOM.nookWallX + 0.78, z: [4.06, 4.89], width: 1.42, depth: 0.81, top: 0.34 };
export const GALLERY_CHAIRS = [0, 1].map(i => ({ x: -8.3 + 1.15*i, z: 1.3 + 0.25*i, yaw: -0.35*i, top: 0.43 }));

export interface BeanbagSpec {
  x: number;
  z: number;
  yaw: number;
  scale: [number, number, number];
  fabric: 'beanbagGrey' | 'beanbagTaupe' | 'beanbagEspresso';
  seed: number;
}

export const TURF_BEANBAGS: BeanbagSpec[] = [
  { x: 0.72, z: -0.87, yaw: -0.34, scale: [0.85, 0.85, 0.9], fabric: 'beanbagEspresso', seed: 11 },
  { x: 1.94, z: -0.99, yaw: 0.31, scale: [1.04, 1.03, 1.02], fabric: 'beanbagGrey', seed: 23 },
  { x: 3.35, z: -0.91, yaw: -0.48, scale: [0.99, 0.93, 1.03], fabric: 'beanbagTaupe', seed: 37 },
  { x: 1.35, z: -2.09, yaw: -0.98, scale: [1.02, 0.78, 1.04], fabric: 'beanbagTaupe', seed: 51 },
  { x: 3.03, z: -2.16, yaw: 1.08, scale: [0.94, 1.04, 0.96], fabric: 'beanbagGrey', seed: 64 },
];

export function hitsBeanbag(x: number, z: number, radius: number): boolean {
  return TURF_BEANBAGS.some(bag => {
    const dx = x - bag.x, dz = z - bag.z;
    if (Math.abs(dx) > 0.7 + radius || Math.abs(dz) > 0.7 + radius) return false;
    const c = Math.cos(bag.yaw), s = Math.sin(bag.yaw);
    const u = (c * dx - s * dz) / (0.56 * bag.scale[0] + radius);
    const v = (s * dx + c * dz) / (0.53 * bag.scale[2] + radius);
    return u * u + v * v < 1;
  });
}

export const ROOF_SLOPE =
  (ROOM.roofRightY - ROOM.roofLeftY) / (ROOM.rightWallX - ROOM.leftWallX);

export function getRoofY(x: number): number {
  return ROOM.roofLeftY + (x - ROOM.leftWallX) * ROOF_SLOPE;
}

export const SLIDE = {
  centerX: (ROOM.slideLeftX + ROOM.slideRightX) / 2,
  topZ: ROOM.stairsEndZ,
  bottomZ: ROOM.stairsStartZ,
  landingZ: ROOM.stairsStartZ - 1.05,
  grade: (ROOM.mezzanineY - ROOM.matHeight) / (ROOM.stairsEndZ - ROOM.stairsStartZ),
  cheekWidth: 0.085,
} as const;

export function getSlideYAtZ(z: number): number {
  return ROOM.matHeight + (THREE.MathUtils.clamp(z, SLIDE.bottomZ, SLIDE.topZ) - SLIDE.bottomZ) * SLIDE.grade;
}

// The seat stays on the surface; the heels meet the flat mat before the seat does.
export function getRidePitch(z: number): number {
  const heelSpan = 0.94;
  return Math.atan2(getSlideYAtZ(z) - getSlideYAtZ(z - heelSpan), heelSpan);
}

/**
 * Computes the auditorium sloped underside height at a given Z
 * (used for the dark triangular side wall and under-stairs nook ceiling).
 */
export function getStairsSlopeY(z: number): number {
  const t = (z - ROOM.stairsStartZ) / (ROOM.stairsEndZ - ROOM.stairsStartZ);
  return THREE.MathUtils.clamp(t, 0, 1) * ROOM.mezzanineY;
}

export interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  beneathTiers?: boolean;
}

export function getTierTopY(z: number): number {
  return THREE.MathUtils.clamp(1 + Math.floor((z - ROOM.stairsStartZ) / ROOM.tierDepth),
    0, ROOM.tierCount + 1) * ROOM.tierHeight;
}

export const WALK_STEP = { minX: ROOM.nookWallX + 0.08, width: 0.94, depth: ROOM.tierDepth / 2 };
const inHalfStepLane = (x: number) => x >= WALK_STEP.minX && x <= WALK_STEP.minX + WALK_STEP.width;

export function nextRiserZ(x: number, height: number): number {
  if (x < ROOM.nookWallX - 0.05 || x >= ROOM.slideLeftX || height >= ROOM.mezzanineY) return Infinity;
  const half = inHalfStepLane(x);
  const first = ROOM.stairsStartZ - (half ? WALK_STEP.depth : 0);
  return first + Math.max(0, Math.floor(height / (half ? ROOM.tierHeight / 2 : ROOM.tierHeight)))
    * (half ? WALK_STEP.depth : ROOM.tierDepth);
}

export const SOLID_OBSTACLES: AABB[] = [
  // Left wall segment before doorway
  {
    minX: ROOM.leftWallX - 0.35,
    maxX: ROOM.leftWallX + 0.05,
    minY: 0,
    maxY: 8.0,
    minZ: ROOM.focalBackZ,
    maxZ: ROOM.doorwayStartZ,
  },
  // Right outer wall
  {
    minX: ROOM.rightWallX - 0.05,
    maxX: ROOM.rightWallX + 0.4,
    minY: 0,
    maxY: 8.0,
    minZ: ROOM.focalBackZ,
    maxZ: ROOM.mezzanineEndZ + 0.5,
  },
  // Focal oak partition wall
  {
    minX: ROOM.leftWallX - 0.4,
    maxX: ROOM.rightWallX + 0.4,
    minY: 0,
    maxY: 8.0,
    minZ: ROOM.focalBackZ - 0.4,
    maxZ: ROOM.focalFrontZ + 0.08,
  },
  // Back wall behind mezzanine
  {
    minX: ROOM.galleryMinX - 0.4,
    maxX: ROOM.rightWallX + 0.4,
    minY: 0,
    maxY: 8.0,
    minZ: ROOM.mezzanineEndZ - 0.1,
    maxZ: ROOM.mezzanineEndZ + 0.5,
  },
  // Far-left boundary of open gallery corridor
  {
    minX: ROOM.galleryMinX - 0.4,
    maxX: ROOM.galleryMinX + 0.05,
    minY: 0,
    maxY: 8.0,
    minZ: ROOM.doorwayStartZ - 0.5,
    maxZ: ROOM.mezzanineEndZ + 0.5,
  },
  // Front wall closing the side gallery near doorwayStartZ
  {
    minX: ROOM.galleryMinX - 0.4,
    maxX: ROOM.leftWallX,
    minY: 0,
    maxY: 8.0,
    minZ: ROOM.doorwayStartZ - 0.6,
    maxZ: ROOM.doorwayStartZ - 0.15,
  },
  // Solid dark concrete wall under mezzanine (to the right of the nook, Z = 5.35..9.3)
  {
    beneathTiers: true,
    minX: ROOM.nookWallX - 0.06,
    maxX: ROOM.rightWallX,
    minY: 0,
    maxY: ROOM.mezzanineY - 0.05,
    minZ: ROOM.nookEndZ,
    maxZ: ROOM.mezzanineEndZ,
  },
  // Solid lower-front triangle under stairs before nook (Z = -0.2..3.15)
  {
    beneathTiers: true,
    minX: ROOM.nookWallX - 0.06,
    maxX: ROOM.nookWallX + 0.08,
    minY: 0,
    maxY: 1.8,
    minZ: ROOM.stairsStartZ,
    maxZ: ROOM.nookDividerZ,
  },
  // Nook inner back wall (so player inside nook cannot walk underneath the concrete stairs)
  {
    beneathTiers: true,
    minX: ROOM.nookWallX + ROOM.nookDepth - 0.1,
    maxX: ROOM.nookWallX + ROOM.nookDepth + 0.3,
    minY: 0,
    maxY: ROOM.mezzanineY - 0.05,
    minZ: ROOM.nookDividerZ,
    maxZ: ROOM.nookEndZ,
  },
];

/**
 * Returns the walkable floor height at (x, z) given the character's current Y
 * so we seamlessly distinguish between walking ON TOP of the auditorium/mezzanine
 * vs walking INSIDE the cozy under-stairs nook on the ground floor!
 */
export function getWalkableFloorY(x: number, z: number, currentY: number): number {
  // 1. Landing cushion at bottom of slide
  if (
    x >= ROOM.matMinX &&
    x <= ROOM.matMaxX &&
    z >= ROOM.matMinZ &&
    z <= ROOM.matMaxZ
  ) {
    return ROOM.matHeight;
  }

  // 2. Inside the cozy under-stairs nook (ground level, low Y)
  const insideNookXZ =
    x >= ROOM.nookWallX - 0.05 &&
    x <= ROOM.nookWallX + ROOM.nookDepth &&
    z >= ROOM.nookDividerZ &&
    z <= ROOM.nookEndZ;

  if (insideNookXZ && currentY < 1.6) {
    // Low mattress / oak platform inside the nook
    if (Math.abs(x-NOOK_PADS.x) <= NOOK_PADS.width/2 && NOOK_PADS.z.some(c => Math.abs(z-c)<=NOOK_PADS.depth/2)) return NOOK_PADS.top;
    return Math.abs(z-3.4)<=0.24 ? 0.29 : 0.16;
  }

  // 3. Mezzanine upper deck (Z >= stairsEndZ, X >= nookWallX)
  if (z >= ROOM.stairsEndZ && x >= ROOM.nookWallX - 0.1) {
    return ROOM.mezzanineY;
  }

  // The small oak blocks project in FRONT of their risers, including the first one on the turf.
  const nextTier = Math.ceil((z - ROOM.stairsStartZ) / ROOM.tierDepth);
  const toRiser = ROOM.stairsStartZ + nextTier * ROOM.tierDepth - z;
  if (inHalfStepLane(x) &&
      nextTier >= 0 && nextTier <= ROOM.tierCount && toRiser > 0 && toRiser <= WALK_STEP.depth) {
    return (nextTier + 0.5) * ROOM.tierHeight;
  }

  // 4. Stepping auditorium tiers (X from nookWallX to slideLeftX)
  if (
    z >= ROOM.stairsStartZ &&
    z < ROOM.stairsEndZ &&
    x >= ROOM.nookWallX - 0.05 &&
    x <= ROOM.slideLeftX
  ) {
    return getTierTopY(z);
  }

  // 5. Slide chute surface
  if (
    z >= ROOM.stairsStartZ &&
    z < ROOM.stairsEndZ &&
    x > ROOM.slideLeftX &&
    x <= ROOM.slideRightX
  ) {
    return getSlideYAtZ(z);
  }

  // 6. Green artificial turf
  if (
    x >= ROOM.turfLeftX &&
    x <= ROOM.rightWallX &&
    z >= ROOM.turfStartZ &&
    z <= ROOM.turfEndZ
  ) {
    return ROOM.turfY;
  }

  // 7. Ground concrete floor
  return 0;
}

export function stairInfluence(x: number, z: number, playerY: number): number {
  if (x < ROOM.nookWallX || x >= ROOM.slideLeftX || playerY < getTierTopY(z) - 0.58) return 0;
  return THREE.MathUtils.smoothstep(z, ROOM.stairsStartZ - 1.18, ROOM.stairsStartZ - 0.45) *
    (1 - THREE.MathUtils.smoothstep(z, ROOM.stairsEndZ + 0.05, ROOM.stairsEndZ + 0.8));
}

// Integrate the rises rather than switching to a new interpolation at the nearest edge.
// A pelvis can span two half steps; a shoe only spans one nosing.
export function getTreadSupportY(x: number, z: number, playerY: number, span: number): number {
  if (!stairInfluence(x, z, playerY)) return getWalkableFloorY(x, z, playerY);
  const base = x < ROOM.turfLeftX ? 0 : ROOM.turfY;
  const half = 1 - THREE.MathUtils.smoothstep(x, WALK_STEP.minX + WALK_STEP.width - span * 0.5,
    WALK_STEP.minX + WALK_STEP.width + span * 0.5);
  let y = base;
  for (let i = 0; i <= ROOM.tierCount; i++) {
    const front = ROOM.stairsStartZ + i * ROOM.tierDepth;
    if (z < front - WALK_STEP.depth - span) break;
    const fullRise = ROOM.tierHeight - (i === 0 ? base : 0);
    const halfRise = half * (ROOM.tierHeight / 2 - (i === 0 ? base : 0));
    y += (fullRise - halfRise) * THREE.MathUtils.smoothstep(z, front - span, front + span);
    y += halfRise * THREE.MathUtils.smoothstep(z, front - WALK_STEP.depth - span, front - WALK_STEP.depth + span);
  }
  return y;
}

export function travelBaseY(x: number, z: number, floor: number, terrain: number): number {
  let base = floor;
  if (floor === 0 || floor === ROOM.turfY) {
    const edge = 0.13, ease = THREE.MathUtils.smoothstep;
    base = ROOM.turfY * ease(x, ROOM.turfLeftX - edge, ROOM.turfLeftX + edge)
      * ease(z, ROOM.turfStartZ - edge, ROOM.turfStartZ + edge)
      * (1 - ease(z, ROOM.turfEndZ - edge, ROOM.turfEndZ + edge));
  }
  return terrain ? THREE.MathUtils.lerp(base, getTreadSupportY(x, z, floor, 0.48), terrain) : base;
}

// When stopping on a nosing, bring both shoes onto the tread supporting the body.
// Choosing the tread from the toe position can put both feet on the next level.
export function standingFootZ(z: number, x: number, targetZ: number): number {
  if (x < ROOM.nookWallX || x >= ROOM.slideLeftX) return targetZ;
  const depth = inHalfStepLane(x) ? WALK_STEP.depth : ROOM.tierDepth;
  const first = inHalfStepLane(x) ? ROOM.stairsStartZ - depth : ROOM.stairsStartZ;
  const margin = Math.min(0.22, depth * 0.42);
  if (z < first) return Math.min(targetZ, first - margin);
  if (z >= ROOM.stairsEndZ) return Math.max(targetZ, ROOM.stairsEndZ + margin);
  const edge = first + Math.floor((z - first) / depth) * depth;
  return THREE.MathUtils.clamp(targetZ, edge + margin, edge + depth - margin);
}

export interface CameraPreset {
  id: 'photo1' | 'photo2' | 'photo3' | 'overview';
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'photo1',
    label: 'Sudut 1 · Top Auditorium',
    position: [-0.25, 4.7, 6.85],
    target: [-0.25, 2.0, -7.2],
    fov: 64,
  },
  {
    id: 'photo2',
    label: 'Sudut 2 · Turf & Slide',
    position: [0.25, 1.55, -5.35],
    target: [-0.35, 1.9, 3.6],
    fov: 64,
  },
  {
    id: 'photo3',
    label: 'Sudut 3 · Cozy Nook',
    position: [-8.75, 1.68, 4.9],
    target: [-3.2, 1.65, 4.85],
    fov: 60,
  },
  {
    id: 'overview',
    label: 'Sudut 4 · Mezzanine',
    position: [4.6, 4.45, 7.1],
    target: [-1.2, 1.4, -2.5],
    fov: 58,
  },
];

export const INTERACTION_ZONES = {
  slideTop: {
    x: (ROOM.slideLeftX + ROOM.slideRightX) * 0.5,
    y: ROOM.mezzanineY,
    z: ROOM.stairsEndZ + 0.55,
    radius: 1.25,
  },
} as const;
