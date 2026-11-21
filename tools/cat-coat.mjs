import * as T from 'three';

// Comb small, overlapping locks over exposed fur only. The root uses the same
// barycentric bone weights as the skin below it, including at moving joints.
export function combCoat(d, skin, vestEdge) {
  const g = skin.geometry, a = g.attributes, indices = g.index.array;
  const pos = [], normal = [], uv = [], colors = [], joints = [], weights = [], faces = [];
  const pa = new T.Vector3(), pb = pa.clone(), pc = pa.clone(), root = pa.clone(), n = pa.clone();
  const comb = pa.clone(), side = pa.clone(), s = pa.clone(), p = pa.clone(), shade = new T.Color();
  let seed = 327;
  const rand = () => (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296;
  for (let f = 0; f < indices.length; f += 3) {
    const ids = [indices[f], indices[f+1], indices[f+2]];
    pa.fromBufferAttribute(a.position, ids[0]); pb.fromBufferAttribute(a.position, ids[1]); pc.fromBufferAttribute(a.position, ids[2]);
    const area = s.subVectors(pb, pa).cross(p.subVectors(pc, pa)).length() / 2;
    const count = Math.floor(area * 94000 + rand());
    for (let j = 0; j < count; j++) {
      const u = Math.sqrt(rand()), v = rand(), w = [1-u, u*(1-v), u*v];
      const hair = ids.reduce((sum,k,i) => sum + d.coat[k*4+2]*w[i], 0);
      root.copy(pa).multiplyScalar(w[0]).addScaledVector(pb,w[1]).addScaledVector(pc,w[2]);
      if (hair < 0.0018 || root.y < 0.006 || vestEdge(root.y,root.z) > -0.003 ||
          ids.some(k => d.tint[k*4+3] > 0.25 || d.coat[k*4+3] < 0.23)) continue;
      n.set(0,0,0); comb.set(0,0,0); shade.setRGB(0,0,0);
      const mix = new Map();
      ids.forEach((k,i) => {
        n.addScaledVector(s.fromBufferAttribute(a.normal,k),w[i]); comb.addScaledVector(s.fromArray(d.comb,3*k),w[i]);
        shade.r += a.color.getX(k)*w[i]; shade.g += a.color.getY(k)*w[i]; shade.b += a.color.getZ(k)*w[i];
        for (let c=0;c<4;c++) {
          const b = d.skinIndex[k*4+c];
          mix.set(b,(mix.get(b)||0)+w[i]*d.skinWeight[k*4+c]);
        }
      });
      n.normalize(); comb.projectOnPlane(n);
      if (comb.lengthSq()<0.01) comb.set(0,-0.45,-1).projectOnPlane(n);
      comb.normalize(); side.crossVectors(comb,n).normalize();
      comb.addScaledVector(side,(rand()-0.5)*0.55).normalize();
      const len=T.MathUtils.clamp(hair,0.0045,0.016)*(0.80+0.45*rand());
      const width=len*(0.21+0.10*rand()), lift=len*(0.29+0.22*rand());
      const bones=[...mix].sort((a,b)=>b[1]-a[1]).slice(0,4), sum=bones.reduce((s,b)=>s+b[1],0);
      const offset=pos.length/3, variation=0.91+0.12*rand();
      for (const t of [0,0.5,1]) for (const sign of [-1,1]) {
        p.copy(root).addScaledVector(n,-0.0008+lift*t*(1.6-0.6*t)).addScaledVector(comb,len*t)
          .addScaledVector(side,width*sign*(1-0.24*t));
        pos.push(...p.toArray()); normal.push(...n.toArray()); uv.push((sign+1)/2,1-t);
        for (const c of [shade.r,shade.g,shade.b]) colors.push(Math.round(255*Math.min(1,c*variation*(0.86+0.18*t))));
        for(let k=0;k<4;k++){ joints.push(bones[k]?.[0]||0); weights.push((bones[k]?.[1]||0)/sum); }
      }
      for(const k of [0,2]) {
        const b=offset+k;
        // Same fur normals on the reverse face; backface lighting must not blacken the silhouette.
        faces.push(b,b+1,b+2,b+2,b+1,b+3,b+2,b+1,b,b+3,b+1,b+2);
      }
    }
  }
  const coat = new T.BufferGeometry();
  coat.setAttribute('position',new T.Float32BufferAttribute(pos,3)); coat.setAttribute('normal',new T.Float32BufferAttribute(normal,3));
  coat.setAttribute('uv',new T.Float32BufferAttribute(uv,2)); coat.setAttribute('color',new T.Uint8BufferAttribute(colors,3,true));
  coat.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4)); coat.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  coat.setIndex(faces);
  const material = new T.MeshStandardMaterial({ name:'Brushed short fur',vertexColors:true,roughness:1,alphaTest:0.32 });
  const mesh = new T.SkinnedMesh(coat,material);
  mesh.name='Combed_guard_hairs'; mesh.bind(skin.skeleton,skin.bindMatrix);
  return mesh;
}

export function strandPixels(size=128) {
  const pixels=Buffer.alloc(size*(4*size+1));
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const t=1-(y+0.5)/size, u=(x+0.5)/size;
    let ink=0;
    for(let i=0;i<16;i++) {
      const h=0.53+0.47*Math.abs(Math.cos(i*13.17)), r=(i+0.5)/16;
      const centre=0.5+(r-0.5)*(0.98-0.60*t)+0.064*Math.sin(i*9.17+1.6*t)*t;
      const width=(0.017+0.006*Math.sin(i*5)**2)*(1-0.74*t/h);
      if(t<h) ink=Math.max(ink,(1-T.MathUtils.smoothstep(Math.abs(u-centre),width*0.42,width))*Math.min(1,(h-t)*26));
    }
    const k=y*(4*size+1)+1+4*x;
    pixels[k]=pixels[k+1]=pixels[k+2]=Math.round(240+15*t); pixels[k+3]=Math.round(255*ink);
  }
  return pixels;
}
