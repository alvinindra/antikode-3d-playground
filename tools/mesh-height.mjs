import { Vector3 } from 'three';

// Independent vertical intersections with the posed triangles, not the runtime contact probes.
export function meshHeight(mesh) {
  const a=mesh.geometry.attributes, indices=mesh.geometry.index.array;
  const vertices=Array.from({length:a.position.count},(_,i)=>mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));
  const bins=new Map(), cell=0.021, tile=v=>Math.floor(v/cell), key=(x,z)=>x*10000+z;
  for (let i=0;i<indices.length;i+=3) {
    const A=vertices[indices[i]], B=vertices[indices[i+1]], C=vertices[indices[i+2]];
    const u=B.x-A.x,v=B.z-A.z,s=C.x-A.x,t=C.z-A.z, det=u*t-s*v;
    if(Math.abs(det)<1e-11) continue;
    const tri={A,B,C,u,v,s,t,det};
    for(let ix=tile(Math.min(A.x,B.x,C.x));ix<=tile(Math.max(A.x,B.x,C.x));ix++)
      for(let iz=tile(Math.min(A.z,B.z,C.z));iz<=tile(Math.max(A.z,B.z,C.z));iz++) {
        const k=key(ix,iz); if(!bins.has(k)) bins.set(k,[]); bins.get(k).push(tri);
      }
  }
  return (x,z)=>{
    let height=-Infinity;
    for(const {A,B,C,u,v,s,t,det} of bins.get(key(tile(x),tile(z)))??[]) {
      const dx=x-A.x,dz=z-A.z, w=(dx*t-s*dz)/det, b=(u*dz-dx*v)/det;
      if(w>=0&&b>=0&&w+b<=1) height=Math.max(height,A.y+w*(B.y-A.y)+b*(C.y-A.y));
    }
    return height;
  };
}
