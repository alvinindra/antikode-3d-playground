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
  x:NOOK_PADS.x+0.37,z,y:NOOK_PADS.top,yaw:-Math.PI/2,feetY:NOOK_PADS.top,toeReach:0.78}));
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

export function frontExit(site: SeatSite, clear: (p: Vector3) => boolean) {
  const p=new Vector3();
  if(site.kind==='bed') {
    // Stand on the same pad if the sloping roof clears the head. Otherwise
    // step straight down off its lip, never sideways across the other bed.
    for(const x of [NOOK_PADS.x-0.24,NOOK_PADS.x-0.43,ROOM.nookWallX-0.24,ROOM.nookWallX-0.44,ROOM.nookWallX-0.60]) {
      p.set(x,getWalkableFloorY(x,site.z,site.feetY),site.z);
      if(clear(p)) return p;
    }
    return null;
  }
  const reach=site.kind==='bag' ? site.toeReach+0.30 : site.toeReach+0.20;
  // A round bag in a tight cluster may only be accessible from the side.
  // Pick that orientation before sitting, never by turning during the rise.
  const steps=site.kind==='bag'?24:6;
  let nextTread: Vector3 | null=null;
  for (let i=0;i<=steps*2;i++) for (const extra of [0,0.15,-0.12,0.32,0.52]) {
    const yaw=site.yaw+Math.ceil(i/2)*(i%2?1:-1)*Math.PI/24;
    p.set(site.x+Math.sin(yaw)*(reach+extra),0,site.z+Math.cos(yaw)*(reach+extra));
    p.y=getWalkableFloorY(p.x,p.z,site.feetY);
    if (!clear(p)) continue;
    if(site.kind==='bag' && p.y>site.feetY+0.04) {
      if (!nextTread && p.y-site.feetY<=ROOM.tierHeight) nextTread=p.clone();
    } else return p;
  }
  return nextTread;
}

export function takeSeat(site: SeatSite, from: Vector3, yaw: number, exit=frontExit(site,()=>true)!) {
  if (site.kind==='bag') site={...site,yaw:Math.atan2(exit.x-site.x,exit.z-site.z)};
  // The apron is where a person stands in front of the seat before lowering the hips
  // back onto it. Routing through it keeps the legs out of the bench face.
  // A bag's apron is just past its front edge, where the feet land once seated.
  const reach=site.kind==='bed' ? 0.42 : site.kind==='bag' ? site.toeReach+0.07 : 0.32;
  const apron={x:site.x+Math.sin(site.yaw)*reach,z:site.z+Math.cos(site.yaw)*reach};
  const path=Math.hypot(from.x-apron.x,from.z-apron.z)+reach;
  return {site,from:from.clone(),entryY:from.y,yaw,t:0,weight:0,lean:0,leaving:false,rise:0,exit,
    apron,duration:Math.min(1.7,Math.max(0.95,path/1.0)),morphs:[] as number[][]};
}
export type SeatUse=ReturnType<typeof takeSeat>;
export function advanceSeat(use: SeatUse, p: Vector3, dt: number) {
  const {site,from,apron}=use;
  // A request during entry is queued until the hips are supported. Never replay
  // the approach backwards or inherit the heading the visitor approached from.
  if (use.leaving && use.t===1) {
    use.rise=clamp(use.rise+dt/(site.kind==='bed'?1.65:1.25),0,1);
    const bed=site.kind==='bed', r=use.rise, lift=smoothstep(r,bed?0.05:0.21,bed?0.87:0.88);
    const transfer=bed ? smoothstep(r,0.20,0.94)
      : 0.30*smoothstep(r,0.05,0.44)+0.70*smoothstep(r,0.24,1);
    p.set(lerp(site.x,use.exit.x,transfer),lerp(site.y,use.exit.y,bed?smoothstep(r,0.44,0.82):lift),lerp(site.z,use.exit.z,transfer));
    use.weight=1-lift;
    use.lean=0;
    for (const morph of use.morphs) morph[0]=1-smoothstep(r,0.22,0.58);
    return site.yaw;
  }
  use.t=clamp(use.t+dt/use.duration,0,1);
  const t=use.t;
  if(site.kind==='bed') {
    // Sit on the lip before scooting under the sloped lining, not after
    // walking upright into it. Keep the approach in the selected pad's lane.
    const align=smoothstep(t,0,0.52), scoot=smoothstep(t,0.36,1);
    const lip=clamp(from.x,NOOK_PADS.x-NOOK_PADS.width/2+0.08,site.x);
    p.set(lerp(lerp(from.x,lip,align),site.x,scoot),lerp(from.y,site.y,smoothstep(t,0.12,0.58)),lerp(from.z,site.z,align));
    use.weight=smoothstep(t,0.10,0.60);
    return use.yaw+smoothstep(t,0,0.48)*Math.atan2(Math.sin(site.yaw-use.yaw),Math.cos(site.yaw-use.yaw));
  }
  const approach=smoothstep(t,0,0.62), back=smoothstep(t,0.48,1), drop=smoothstep(t,0.55,1);
  use.weight=smoothstep(t,0.34,1);
  const dip=0.024*Math.sin(Math.PI*smoothstep(t,0.80,1));
  p.set(lerp(lerp(from.x,apron.x,approach),site.x,back),lerp(from.y,site.y,drop)-dip,
    lerp(lerp(from.z,apron.z,approach),site.z,back));
  // The torso tips forward mid-transition, the way people counterbalance a squat.
  use.lean=0.12*Math.sin(Math.PI*smoothstep(t,0.45,0.97));
  for(const morph of use.morphs) morph[0]=use.weight;
  return use.yaw+smoothstep(t,0,0.6)*Math.atan2(Math.sin(site.yaw-use.yaw),Math.cos(site.yaw-use.yaw));
}
