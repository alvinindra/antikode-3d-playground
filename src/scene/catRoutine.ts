import { MathUtils } from 'three';
import { getWalkableFloorY, hitsBeanbag, ROOM } from './layout.ts';

export type CatMode = 'walk' | 'idle' | 'groom' | 'settle' | 'sleep' | 'wake';
type Point = { x: number; z: number };
type Occupant = Point & { y: number };
type Timings = Record<'groom' | 'settle' | 'wake', number>;
export const CAT_SCALE = 1.17;
export const CAT_START = { x: -1.34, z: -1.64 };
const STOPS = [
  { x: 0.04, z: -2.38 }, { x: -1.83, z: -1.32 }, { x: -2.5, z: -2.55 },
  { x: 2.92, z: -3.67 }, { x: -0.84, z: -2.03 }, { x: 1.12, z: -3.73 },
  { x: -2.23, z: -4.63 }, { x: 2.33, z: -4.85 }, { x: -0.35, z: -5.62 },
];
const RESTS = ['groom', 'settle', 'idle', 'groom', 'idle', 'settle'] as const;
const dist = (a: Point, b: Point) => Math.hypot(a.x-b.x, a.z-b.z);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function catCanOccupy(x: number, z: number) {
  const margin = 0.44;
  return x >= ROOM.turfLeftX + margin && x <= ROOM.matMinX - margin &&
    z >= ROOM.turfStartZ + margin && z <= ROOM.stairsStartZ - margin - 0.48 &&
    getWalkableFloorY(x,z,0) === ROOM.turfY && !hitsBeanbag(x,z,margin);
}

// Test the whole swept path; two clear endpoints can still straddle a bean bag or the player.
function passage(from: Point, to: Point, visitor: Point | null) {
  const count = Math.max(1, Math.ceil(dist(from,to)/0.10));
  const keepAway = visitor ? Math.min(0.82,dist(from,visitor)) : 0;
  for (let j=1;j<=count;j++) {
    const x=MathUtils.lerp(from.x,to.x,j/count), z=MathUtils.lerp(from.z,to.z,j/count);
    if (!catCanOccupy(x,z) || (visitor && Math.hypot(x-visitor.x,z-visitor.z) < keepAway-0.001)) return false;
  }
  return true;
}

export function blocksCatFootprint(cat: Occupant | undefined, x: number, y: number, z: number, from: Point) {
  if (!cat || y > cat.y+0.37) return false;
  const next = Math.hypot(x-cat.x,z-cat.z);
  return next < 0.54 && next < dist(cat,from);
}

export function createCatRoutine(timings: Timings, random: () => number = Math.random) {
  const state = { ...CAT_START, yaw: Math.atan2(STOPS[0].x-CAT_START.x,STOPS[0].z-CAT_START.z),
    mode: 'walk' as CatMode, age: 0, speed: 0, distance: 0 };
  let target = STOPS[0], activity = 0, duration = Infinity, cruise = 0.47, blocked = 0, greeted = false;
  let sidestep = false;
  function enter(mode: CatMode, seconds: number) {
    state.mode=mode; state.age=0; duration=seconds; state.speed=0; blocked=0;
  }
  function depart(visitor: Point | null) {
    const quiet = RESTS[activity % RESTS.length] === 'settle';
    const candidates = STOPS.filter(p => dist(p,state)>1 && (!visitor || dist(p,visitor)>1.08) && passage(state,p,visitor));
    const sheltered = quiet ? candidates.filter(p => p.z > -3.72) : [];
    const choices = sheltered.length ? sheltered : candidates;
    sidestep=false;
    // A person can be between the cat and every regular destination. Step aside first.
    if (!choices.length && visitor) {
      const away=Math.atan2(state.x-visitor.x,state.z-visitor.z);
      for (const offset of [0,0.72,-0.72,1.44,-1.44]) {
        const beside={x:state.x+0.90*Math.sin(away+offset), z:state.z+0.90*Math.cos(away+offset)};
        if (passage(state,beside,visitor)) { choices.push(beside); sidestep=true; break; }
      }
    }
    if (!choices.length) { enter('idle',0.7); return; }
    target=choices[Math.floor(random()*choices.length)];
    cruise=0.43+0.16*random();
    enter('walk',Infinity);
  }
  function arrive(visitor: Point | null) {
    if (sidestep || (visitor && dist(visitor,state)<0.89)) { depart(visitor); return; }
    const mode=RESTS[activity++ % RESTS.length];
    enter(mode, mode==='idle' ? 1.5+random()*2.0 : timings[mode]);
  }
  function update(dt: number, player: Occupant | null, beingPetted = false) {
    dt=MathUtils.clamp(dt,0,0.05);
    const visitor=player && player.y < ROOM.turfY+0.55 ? player : null;
    state.age+=dt; state.distance=0;
    if (beingPetted) {
      if (!greeted && state.mode!=='sleep' && state.mode!=='settle') enter('idle',1);
      greeted=true;
      if (state.mode==='settle' && state.age>=duration) enter('sleep',14);
      return;
    }
    if (greeted) {
      greeted=false;
      if (state.mode==='idle' || state.mode==='sleep') duration=state.age+1.2;
    }
    if (state.mode!=='walk') {
      const tooClose=visitor && dist(state,visitor)<0.77;
      if (state.age>=duration || (tooClose && (state.mode==='sleep' || (state.mode==='idle' && state.age>0.28)))) {
        if (state.mode==='settle') enter('sleep',10+random()*9);
        else if (state.mode==='sleep') enter('wake',timings.wake);
        else depart(visitor);
      }
      return;
    }
    const d=dist(state,target);
    if (d<0.045 && state.speed<0.13) { arrive(visitor); return; }
    const angle=wrap(Math.atan2(target.x-state.x,target.z-state.z)-state.yaw);
    state.yaw=wrap(state.yaw+MathUtils.clamp(angle,-2.7*dt,2.7*dt));
    const desired=cruise*Math.max(0,Math.cos(angle)) * MathUtils.smoothstep(d,0.018,0.35);
    state.speed+=MathUtils.clamp(desired-state.speed,-1.8*dt,1.25*dt);
    const step=Math.min(d,state.speed*dt);
    const x=state.x+Math.sin(state.yaw)*step, z=state.z+Math.cos(state.yaw)*step;
    if (!catCanOccupy(x,z) || (visitor && Math.hypot(x-visitor.x,z-visitor.z)<Math.min(0.79,dist(state,visitor))-0.00001)) {
      state.speed=0; blocked+=dt;
      if (blocked>0.16) depart(visitor);
      return;
    }
    blocked=0; state.x=x; state.z=z; state.distance=step;
  }
  return { state, update };
}
