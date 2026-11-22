import { MathUtils } from 'three';
import { getRidePitch, getSlideYAtZ, SLIDE } from './layout.ts';

const ENTRY_SPEED = 1.65, ACCELERATION = 2.75, STAND_SECONDS = 1.30;
const SEATED_STOP = SLIDE.landingZ+0.34;

export function beginSlide(x: number, y: number, z: number, yaw: number) {
  const startZ = MathUtils.clamp(z, SLIDE.topZ - 0.6, SLIDE.topZ);
  const mount = Math.max(0.32, Math.hypot(x - SLIDE.centerX, z - startZ) / 2.2);
  const exitSpeed = Math.sqrt(ENTRY_SPEED ** 2 + 2 * ACCELERATION * (startZ - SLIDE.bottomZ));
  const incline = (exitSpeed - ENTRY_SPEED) / ACCELERATION;
  const runout = 2 * (SLIDE.bottomZ - SEATED_STOP) / exitSpeed;
  return { x, y, z, yaw, startZ, mount, incline, runout, time: 0 };
}

export function sampleRide(ride: ReturnType<typeof beginSlide>) {
  const { time, mount, incline, runout } = ride;
  const entry = MathUtils.smoothstep(time, 0, mount);
  const along = MathUtils.clamp(time - mount, 0, incline);
  const brake = MathUtils.clamp((time - mount - incline) / runout, 0, 1);
  const stand = MathUtils.clamp((time - mount - incline - runout)/STAND_SECONDS, 0, 1);
  // The seated clip starts unloading as soon as the heels draw back.
  const seat = entry * (1 - 0.12*MathUtils.smoothstep(stand,0,0.30) - 0.88*MathUtils.smoothstep(stand,0.26,0.94));
  const z = MathUtils.lerp(ride.z, ride.startZ, entry) - ENTRY_SPEED * along - ACCELERATION * along * along / 2
    + (SEATED_STOP - SLIDE.bottomZ) * brake * (2 - brake)
    + (SLIDE.landingZ - SEATED_STOP) * MathUtils.smoothstep(stand,0.20,0.87);
  const turn = Math.PI - ride.yaw;
  return {
    x: MathUtils.lerp(ride.x, SLIDE.centerX, entry), z,
    y: MathUtils.lerp(ride.y, getSlideYAtZ(z), entry),
    yaw: ride.yaw + Math.atan2(Math.sin(turn), Math.cos(turn)) * entry,
    pitch: getRidePitch(z) * seat, seat, stand,
    done: stand === 1,
  };
}
