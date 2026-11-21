import { MathUtils } from 'three';
import { getRidePitch, getSlideYAtZ, SLIDE } from './layout.ts';

const ENTRY_SPEED = 1.65, ACCELERATION = 2.75, STAND_SECONDS = 0.4;

export function beginSlide(x: number, y: number, z: number, yaw: number) {
  const startZ = MathUtils.clamp(z, SLIDE.topZ - 0.6, SLIDE.topZ);
  const mount = Math.max(0.32, Math.hypot(x - SLIDE.centerX, z - startZ) / 2.2);
  const exitSpeed = Math.sqrt(ENTRY_SPEED ** 2 + 2 * ACCELERATION * (startZ - SLIDE.bottomZ));
  const incline = (exitSpeed - ENTRY_SPEED) / ACCELERATION;
  const runout = 2 * (SLIDE.bottomZ - SLIDE.landingZ) / exitSpeed;
  return { x, y, z, yaw, startZ, mount, incline, runout, time: 0 };
}

export function sampleRide(ride: ReturnType<typeof beginSlide>) {
  const { time, mount, incline, runout } = ride;
  const entry = MathUtils.smoothstep(time, 0, mount);
  const along = MathUtils.clamp(time - mount, 0, incline);
  const brake = MathUtils.clamp((time - mount - incline) / runout, 0, 1);
  const stand = MathUtils.smoothstep(time - mount - incline - runout, 0, STAND_SECONDS);
  const seat = entry * (1 - stand);
  const z = MathUtils.lerp(ride.z, ride.startZ, entry) - ENTRY_SPEED * along - ACCELERATION * along * along / 2
    + (SLIDE.landingZ - SLIDE.bottomZ) * brake * (2 - brake);
  const turn = Math.PI - ride.yaw;
  return {
    x: MathUtils.lerp(ride.x, SLIDE.centerX, entry), z,
    y: MathUtils.lerp(ride.y, getSlideYAtZ(z), entry),
    yaw: ride.yaw + Math.atan2(Math.sin(turn), Math.cos(turn)) * entry,
    pitch: getRidePitch(z) * seat, seat,
    done: stand === 1,
  };
}
