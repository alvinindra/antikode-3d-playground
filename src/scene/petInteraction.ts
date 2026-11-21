import { MathUtils, Vector3 } from 'three';
import { getWalkableFloorY, hitsBeanbag, ROOM } from './layout.ts';

export function createPetInteraction() {
  return { phase: 'off' as 'off' | 'approach' | 'stroke' | 'release', time: 0, weight: 0,
    releaseWeight: 0, distance: 0, sleeping: false, yaw: 0, stroke: 0,
    stance: new Vector3(), contact: new Vector3(), surface: null as null | ((x: number, z: number) => number) };
}
export type PetInteraction = ReturnType<typeof createPetInteraction>;
const clamp = MathUtils.clamp, ease = MathUtils.smoothstep;

export function petSpot(from: Vector3, cat: Vector3 | undefined, out: Vector3) {
  if (!cat || Math.abs(from.y-cat.y)>0.08) return false;
  const dx = from.x-cat.x, dz = from.z-cat.z, d = Math.hypot(dx,dz);
  if (d>1.32 || d<0.01) return false;
  out.set(cat.x+0.56*dx/d,ROOM.turfY,cat.z+0.56*dz/d);
  const steps = Math.ceil(Math.abs(d-0.56)/0.09)+1;
  for (let i=1;i<=steps;i++) {
    const x = MathUtils.lerp(from.x,out.x,i/steps), z = MathUtils.lerp(from.z,out.z,i/steps);
    if (hitsBeanbag(x,z,0.28) || getWalkableFloorY(x,z,from.y)!==ROOM.turfY) return false;
  }
  return true;
}

export function beginPet(p: PetInteraction, from: Vector3, cat: Vector3, sleeping: boolean) {
  if (p.phase!=='off' || !petSpot(from,cat,p.stance)) return false;
  p.phase='approach'; p.time=p.weight=p.distance=p.stroke=0; p.sleeping=sleeping;
  p.yaw=Math.atan2(cat.x-from.x,cat.z-from.z)+0.30;
  p.contact.copy(cat); p.contact.y+=sleeping?0.16:0.28;
  return true;
}
export function releasePet(p: PetInteraction) {
  if (p.phase==='off' || p.phase==='release') return;
  p.releaseWeight=p.weight; p.time=0; p.phase=p.weight>0 ? 'release' : 'off';
}
export function advancePet(p: PetInteraction, pos: Vector3, yaw: number, dt: number) {
  p.distance=0; p.time+=dt;
  if (p.phase==='approach') {
    const dx=p.stance.x-pos.x, dz=p.stance.z-pos.z, d=Math.hypot(dx,dz);
    p.distance=Math.min(d,dt*Math.min(1.15,0.22+4*d)*Math.min(1,0.24+6*p.time));
    if (d) { pos.x+=dx*p.distance/d; pos.z+=dz*p.distance/d; }
    const turn=Math.atan2(Math.sin(p.yaw-yaw),Math.cos(p.yaw-yaw));
    yaw+=clamp(turn,-4.2*dt,4.2*dt);
    if (d<0.006 && Math.abs(turn)<0.035) { p.phase='stroke'; p.time=0; }
  } else if (p.phase==='stroke') {
    p.weight=ease(p.time,0,0.82);
    p.stroke=(1-Math.cos(Math.max(0,p.time-0.72)*2*Math.PI/(p.sleeping?2.25:1.75)))/2;
    if (p.time>=4.5) releasePet(p);
  } else if (p.phase==='release') {
    p.weight=p.releaseWeight*(1-ease(p.time,0,0.56));
    if (p.weight===0) p.phase='off';
  }
  return yaw;
}
