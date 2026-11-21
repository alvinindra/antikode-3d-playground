import { MathUtils, Vector3 } from 'three';
import { GALLERY_CHAIRS, getWalkableFloorY, NOOK_PADS, ROOM, TURF_BEANBAGS, WALK_STEP } from './layout.ts';

export type SeatSite = {
  id: string; kind: 'bag' | 'tier' | 'chair' | 'bed'; label: string;
  x: number; z: number; y: number; yaw: number; feetY: number; toeReach: number;
};
const { clamp, smoothstep, lerp } = MathUtils;

// Loaded cushion height in the bean bag's local coordinates. The front yields below the thighs;
// the back and sewn outer perimeter retain their silhouette.
export function loadedBagTop(x: number, z: number) {
  return 0.161 + 0.095*x*x + 0.23*(z+0.08)**2 + 0.34*smoothstep(z,0.08,0.42);
}
export function compressBag(x: number,y: number,z: number) {
  const extent = Math.hypot(x/0.49,(z+0.07)/0.64);
  return lerp(y,Math.min(y,loadedBagTop(x,z)),1-smoothstep(extent,0.80,1.24));
}
const bags: SeatSite[]=TURF_BEANBAGS.map(b=>{
  const x=b.x-0.08*Math.sin(b.yaw)*b.scale[2], z=b.z-0.08*Math.cos(b.yaw)*b.scale[2];
  let yaw=b.yaw+Math.PI, best=-Infinity;
  for(const offset of [0,-0.32,0.32,-0.62,0.62,-0.94,0.94]) {
    const a=b.yaw+Math.PI+offset;
    let space=Infinity;
    for(const reach of [0.53,0.78,0.94]) for(const side of [-0.21,0.21]) {
      const fx=x+Math.sin(a)*reach+Math.cos(a)*side, fz=z+Math.cos(a)*reach-Math.sin(a)*side;
      for(const other of TURF_BEANBAGS) if(other!==b) space=Math.min(space,Math.hypot(fx-other.x,fz-other.z)-0.58);
      if(getWalkableFloorY(fx,fz,ROOM.turfY)!==ROOM.turfY) space=-1;
    }
    const score=Math.min(space,0.17)-Math.abs(offset)*0.06;
    if(score>best){best=score; yaw=a;}
  }
  return { id:`beanbag-${b.seed}`,kind:'bag',label:'bean bag',x,z,y:ROOM.turfY+0.164*b.scale[1],
    yaw,feetY:ROOM.turfY,toeReach:0.60*b.scale[2]+0.075 };
});
const beds: SeatSite[]=NOOK_PADS.z.map((z,i)=>({id:`mattress-${i}`,kind:'bed',label:'kasur Cozy Nook',
  x:NOOK_PADS.x+0.27,z,y:NOOK_PADS.top,yaw:-Math.PI/2,feetY:NOOK_PADS.top,toeReach:0.64}));
const chairs: SeatSite[]=GALLERY_CHAIRS.map((c,i)=>({id:`gallery-chair-${i}`,kind:'chair',label:'kursi kayu',
  x:c.x,z:c.z,y:c.top,yaw:c.yaw,feetY:0,toeReach:0.48}));

export function nearbySeat(p: Vector3): SeatSite | null {
  let nearest: SeatSite | null=null, best=Infinity;
  const offer=(s: SeatSite,d: number,limit: number)=>{ if(d<=limit && d<best){best=d;nearest=s;} };
  if (p.y<0.54) {
    for (const s of beds) if (p.x<=NOOK_PADS.x+0.22 && Math.abs(p.z-s.z)<=0.61) {
      offer(s,Math.hypot(p.x-(ROOM.nookWallX+0.04),p.z-s.z),1.10);
    }
    for (const s of chairs) {
      const dx=p.x-s.x,dz=p.z-s.z;
      if (dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw)>-0.13) offer(s,Math.hypot(dx,dz),1.02);
    }
    for (const s of bags) {
      if (p.z < ROOM.stairsStartZ+0.16 && p.x<ROOM.matMinX-0.12) offer(s,Math.hypot(p.x-s.x,p.z-s.z),1.20);
    }
  }
  // Pick a spot along the actual plank, not a fixed marker in the middle of the hall.
  if (p.x>WALK_STEP.minX+WALK_STEP.width+0.30 && p.x<ROOM.slideLeftX-0.28) {
    const i=clamp(Math.round((p.z-ROOM.stairsStartZ-0.10)/ROOM.tierDepth),0,ROOM.tierCount-1);
    const edge=ROOM.stairsStartZ+i*ROOM.tierDepth, y=(i+1)*ROOM.tierHeight;
    const x=p.x, z=edge+0.24, feetY=getWalkableFloorY(x,edge-0.24,y);
    if (Math.abs(p.y-y)<0.07 || Math.abs(p.y-feetY)<0.07) {
      const blocked = i===0 && TURF_BEANBAGS.some(b=>Math.hypot(b.x-x,b.z-(edge-0.39))<0.82);
      if(!blocked) offer({id:`oak-tier-${i}`,kind:'tier',label:'bangku kayu',x,y,z,yaw:Math.PI,feetY,toeReach:0.47},Math.abs(p.z-z),0.86);
    }
  }
  return nearest;
}

export function takeSeat(site: SeatSite, from: Vector3, yaw: number) {
  return {site,from:from.clone(),entryY:from.y,yaw,t:0,weight:0,leaving:false,
    duration:Math.max(0.72,Math.hypot(from.x-site.x,from.z-site.z)/1.25),morphs:[] as number[][]};
}
export type SeatUse=ReturnType<typeof takeSeat>;
export function advanceSeat(use: SeatUse, p: Vector3, dt: number) {
  use.t=clamp(use.t+(use.leaving?-1:1)*dt/use.duration,0,1);
  const t=smoothstep(use.t,0,1), {site,from}=use;
  use.weight=smoothstep(use.t,0.04,1);
  p.set(lerp(from.x,site.x,t),lerp(from.y,site.y,t),lerp(from.z,site.z,t));
  for(const morph of use.morphs) morph[0]=use.weight;
  return use.yaw+t*Math.atan2(Math.sin(site.yaw-use.yaw),Math.cos(site.yaw-use.yaw));
}
