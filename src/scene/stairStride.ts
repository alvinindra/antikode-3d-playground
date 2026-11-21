import { MathUtils, Vector3 } from 'three';
import { getTreadSupportY, ROOM } from './layout.ts';

const { smoothstep, lerp, euclideanModulo } = MathUtils;
const cycle = ROOM.tierDepth, station = cycle / 2;
const floor = (x: number, z: number) => getTreadSupportY(x, z, ROOM.mezzanineY, 0.11);

// One footfall per small block, two per wide tread. Following the same curve
// backwards lets the downhill heel clear the same nosing as the uphill toe.
export function stairFootfall(out: Vector3, cx: number, cz: number, forward: Vector3, travelAxis: Vector3,
  leg: number, phase: number, axial: number) {
  const u = euclideanModulo(phase + leg * 0.5 + 0.25, 1);
  const across = smoothstep(u, 0.25, 0.75);
  const fromX = cx - forward.x * cycle * u, fromZ = cz - forward.z * cycle * u;
  const toX = fromX + forward.x * cycle, toZ = fromZ + forward.z * cycle;
  const acrossLift = Math.sin(Math.PI * across) ** 2;
  out.set(lerp(fromX, toX, across), lerp(floor(fromX, fromZ), floor(toX, toZ), across) + 0.075 * acrossLift,
    lerp(fromZ, toZ, across));
  if (axial === 0) return acrossLift;

  const origin = ROOM.stairsStartZ + station * (0.5 + leg);
  const t = euclideanModulo((cz - origin) / cycle, 1);
  const az = cz - t * cycle, swing = MathUtils.smoothstep(t, 0.16, 0.84);
  const dx = travelAxis.x / travelAxis.z, ax = cx + (az - cz) * dx;
  const a = floor(ax, az), b = floor(ax + dx * station, az + station), c = floor(ax + dx * cycle, az + cycle);
  const advance = smoothstep(swing, 0.18, 0.98);
  const z = az + advance * cycle;
  const lift = lerp(0.055, 0.028, smoothstep(Math.max(b-a, c-b), 0.24, 0.45));
  const air = Math.sin(Math.PI * swing) ** 2;
  const y = a + (b - a) * smoothstep(swing, 0, 0.28) + (c - b) * smoothstep(swing, 0.26, 0.58) + air * lift;
  out.x = lerp(out.x, cx + (z - cz) * dx, axial);
  out.z = lerp(out.z, z, axial);
  out.y = lerp(out.y, y, axial);
  return lerp(acrossLift, air, axial);
}
