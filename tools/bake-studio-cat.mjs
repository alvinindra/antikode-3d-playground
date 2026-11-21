// Offline only: turn the procedural cat and its IK performances into a portable, ordinary GLB.
import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Animal, buildAnimalData } from 'procedural-animals';
import cat from 'procedural-animals/species/cat';
import { combCoat, strandPixels } from './cat-coat.mjs';

const d = await buildAnimalData(cat, { seed: 23, quality: 'medium', variant: 'calico', worker: false,
  overrides: { size: 1, warps: [], eye: 'green', pinkNose: true, longhair: false } });
const actor = () => new Animal(cat, d, { quality: 'low' });
const template = actor(), bind = template.render.skeleton.bind, inverses = bind.map(m => m.clone().invert());
const parent = d.bones.map(b => d.bones.findIndex(p => p.name === b.parent));
const root = new T.Group(), bones = d.bones.map(b => Object.assign(new T.Bone(), { name: b.name }));
root.name = 'Studio_cat_rig';
const v = new T.Vector3(), n = new T.Vector3(), m = new T.Matrix4();
const { smoothstep, lerp, clamp } = T.MathUtils;
const color = hex => new T.Color(hex);
const fur = color('#e8e5dc'), ash = color('#55514c'), biscuit = color('#bf9b75'), pink = color('#dfb3a9');
const yellow = color('#f6c52b'), green = color('#68a147'), seam = color('#47834a');
const pos = d.pos.slice(), rgb = new Uint8Array(d.nV * 3), uv = [], support = [], fans = { whiskerL: [], whiskerR: [] };
const c = new T.Color(), detail = new T.Color();
function vestEdge(y,z) {
  const rear = z + 0.094 - 0.014 * (1-smoothstep(y, 0.125, 0.23));
  const collar = 0.139 - z - 0.48 * (y-0.205);
  const sleeve = Math.hypot((z-0.069)/0.054, (y-0.113)/0.044)*0.044 - 0.044;
  return Math.min(rear, collar, sleeve, y-0.102);
}
for (let i = 0; i < d.nV; i++) {
  v.fromArray(d.pos, i * 3); n.fromArray(d.nrm, i * 3);
  const { x, y, z } = v, b = d.bones[d.skinIndex[4*i]].name;
  const hair = d.coat[4*i+2], fade = d.coat[4*i+3], mat = d.tint[4*i+3];
  const wave = Math.sin(435*x + 95*z) * Math.sin(190*z - 57*y);
  c.copy(fur).multiplyScalar(0.96 + 0.022 * wave + 0.035 * n.y);
  const crown = smoothstep(y, 0.249, 0.263);
  if (z > 0.121 && crown) {
    const patch = Math.hypot((x-0.013)/0.027, (z-0.166)/0.038) + 0.08 * wave;
    c.lerp(biscuit, (1-smoothstep(patch, 0.92, 1.08))*crown);
    c.lerp(ash, (1-smoothstep(patch + 12*x, 0.78, 1.03))*crown);
    c.lerp(ash, (1-smoothstep(Math.hypot((x+0.023)/0.008, (z-0.186)/0.016), 0.8, 1.12))*crown);
  }
  if (b.startsWith('ear')) c.lerp(pink, smoothstep(n.z + Math.sign(x)*0.32*n.x, 0.22, 0.85)*0.91);
  if (b.startsWith('tail')) c.lerp(biscuit, smoothstep(+b.slice(4), 5, 9)*0.82);
  if (mat > 0.03) c.lerp(detail.fromArray(d.tint, i*4), Math.min(1, mat));
  if (b in fans) { c.set('#b9b1a0'); fans[b].push(i); }
  if (d.coat[4*i+1] < 0 && z > 0.175 && y < 0.252) c.lerp(ash, 0.78);

  // Cut the vest in bind space. Collar, armholes and hem deform with the same weights as the coat.
  const edge = vestEdge(y,z);
  const cloth = smoothstep(edge, -0.001, 0.002);
  const band = 1 - smoothstep(edge, 0.006, 0.009);
  const fold = Math.sin(210*z + 35*y + 16*Math.sin(21*x))*0.00085 + Math.cos(102*z-32*x)*0.0006;
  const thickness = cloth * (0.0035 + fold + 0.0018 * band);
  uv.push(clamp((z+0.23)/0.50,0.001,0.999),clamp(1-y/0.37,0.001,0.999));
  c.lerp(detail.setRGB(1,1,1).multiplyScalar(0.96+18*fold), cloth);
  const sink = d.seamSink * clamp((0.5-fade)/0.4, 0, 1)**2;
  v.addScaledVector(n, thickness + Math.min(0.004, hair*0.32)*(1-cloth) - sink);
  v.toArray(pos, i*3);
  for (const [k, q] of [c.r, c.g, c.b].entries()) rgb[3*i+k] = Math.round(255*clamp(q, 0, 1));
  if ((y < 0.022 || i%21 === 0) && !b.startsWith('whisker') && fade >= 0.1) support.push(i);
}
const index = [];
for (let i=0; i<d.index.length; i+=3) {
  const tri = d.index.subarray(i, i+3);
  if (tri.some(j => d.coat[4*j+3] >= 0.1)) index.push(...tri);
}
const geo = new T.BufferGeometry();
geo.setAttribute('position', new T.BufferAttribute(pos, 3));
geo.setAttribute('normal', new T.BufferAttribute(d.nrm, 3));
geo.setAttribute('color', new T.Uint8BufferAttribute(rgb, 3, true));
geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(d.skinIndex, 4));
geo.setAttribute('skinWeight', new T.Float32BufferAttribute(d.skinWeight, 4));
geo.setIndex(index);
const skin = new T.SkinnedMesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 }));
skin.name = 'Shorthaired_calico_in_knit_vest';
root.add(skin);
bones.forEach((b, i) => {
  const p = parent[i];
  if (p < 0) m.copy(bind[i]); else m.multiplyMatrices(inverses[p], bind[i]);
  m.decompose(b.position, b.quaternion, b.scale);
  (p < 0 ? root : bones[p]).add(b);
});
root.updateMatrixWorld(true);
skin.bind(new T.Skeleton(bones, inverses), new T.Matrix4());
root.add(combCoat(d,skin,vestEdge));
const head = bones.find(b => b.name === 'head');
const headInv = inverses[bones.indexOf(head)], eyeNames=[];

// The eyelids cover the cornea, rather than scaling the eye flat when the cat sleeps.
const lidPos = [], shut = [], lidColor = [], lidIndices = [];
for (const eye of d.eyes) {
  const basis = new T.Matrix4().makeBasis(...[eye.x, eye.y, eye.z].map(a => new T.Vector3(...a)));
  basis.setPosition(...eye.c).premultiply(headInv);
  const r = eye.spec.r, iris = new T.SphereGeometry(r, 48, 32).rotateX(Math.PI/2), colors = [];
  const lime = color('#a9b579'), olive = color('#5b704b'), dark = color('#211e17');
  for (let i=0; i<iris.attributes.normal.count; i++) {
    n.fromBufferAttribute(iris.attributes.normal, i);
    const radial = Math.hypot(n.x, n.y), stria = Math.sin(53*Math.atan2(n.x,n.y) + 3*radial);
    c.copy(lime).lerp(olive, clamp(0.17+0.13*stria+0.54*smoothstep(radial,0.41,0.71),0,1));
    c.lerp(dark, 1-smoothstep(Math.hypot(n.x/0.155, n.y/0.61),0.90,1.06));
    c.lerp(dark, smoothstep(radial,0.65,0.77));
    c.lerp(fur, 0.85*(1-smoothstep(Math.hypot(n.x+0.19,n.y-0.29),0.045,0.105)));
    colors.push(c.r,c.g,c.b);
  }
  iris.setAttribute('color',new T.Float32BufferAttribute(colors,3)); iris.applyMatrix4(basis);
  const recessed=iris.attributes.position.clone();
  for(let i=0;i<recessed.count;i++){
    v.fromBufferAttribute(recessed,i).addScaledVector(n.set(0,0,-1).transformDirection(basis),0.0038);
    recessed.setXYZ(i,v.x,v.y,v.z);
  }
  iris.morphAttributes.position=[recessed];
  const globe = new T.Mesh(iris, new T.MeshStandardMaterial({vertexColors:true,roughness:0.23}));
  globe.name = `Sage_eye_${eye.side > 0 ? 'L' : 'R'}`; head.add(globe); eyeNames.push(globe.name);
  for (const upper of [true,false]) {
    const start = lidPos.length/3, cols = 32, rows = 8;
    for (let row=0; row<=rows; row++) for (let col=0; col<=cols; col++) {
      const a = 2*Math.PI*col/cols, t = row/rows, seamLat = -0.08 + 0.20*Math.sin(a)**2;
      const polar = upper ? 1.57 : -1.57;
      const point = (lat, arr) => {
        v.set(Math.cos(lat)*Math.sin(a), Math.sin(lat), Math.cos(lat)*Math.cos(a))
          .multiplyScalar(r + (upper ? 0.00038 : 0.00025));
        if (arr===shut) v.z-=0.0025*Math.max(0,Math.cos(a))**2;
        v.applyMatrix4(basis);
        arr.push(v.x,v.y,v.z);
      };
      point(lerp(upper ? 0.71 : -0.57, polar, t), lidPos); point(lerp(seamLat, polar, t), shut);
      c.copy(fur).lerp(ash, (upper ? 0.83 : 0.65)*(1-smoothstep(t,0,0.15))); lidColor.push(c.r,c.g,c.b);
      if (row<rows && col<cols) {
        const k = start+row*(cols+1)+col, j=k+cols+1;
        lidIndices.push(...(upper ? [k,k+1,j,k+1,j+1,j] : [k,j,k+1,k+1,j,j+1]));
      }
    }
  }
}
const lg = new T.BufferGeometry();
lg.setAttribute('position',new T.Float32BufferAttribute(lidPos,3));
lg.setAttribute('color',new T.Float32BufferAttribute(lidColor,3));
lg.morphAttributes.position = [new T.Float32BufferAttribute(shut,3)];
lg.setIndex(lidIndices); lg.computeVertexNormals();
const lids = new T.Mesh(lg,new T.MeshStandardMaterial({vertexColors:true,roughness:0.94}));
lids.name = 'Eyelids'; head.add(lids);
const tongue = new T.Mesh(new T.SphereGeometry(1,16,10),new T.MeshStandardMaterial({color:'#da8d91',roughness:0.74}));
tongue.name='Tongue'; head.add(tongue);
const tongueAt = (lick) => v.set(0,0.210-0.004*lick,0.196+0.018*lick).applyMatrix4(headInv).toArray();
tongue.position.fromArray(tongueAt(0));
tongue.quaternion.setFromRotationMatrix(headInv).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),0.38));
tongue.scale.set(0.004,0.0017,0.009);

const FPS=30, dt=1/FPS, animations=[];
const joint=Object.fromEntries(bones.map((b,i)=>[b.name,i]));
// Retarget the washing paw to THIS muzzle. Reach with the two long bones; turn the
// short paw palm-in without shortening the forearm or pulling the planted legs up.
function washPaw(ws, t) {
  const weight=smoothstep(t,0.85,1.52)*(1-smoothstep(t,6.02,6.77));
  if (!weight) return;
  const {humerusL:u,radiusL:l,metacarpusL:w,fpawL:p}=joint;
  const pt=i=>new T.Vector3().setFromMatrixPosition(ws[i]);
  const shoulder=pt(u), elbow=pt(l), wrist=pt(w);
  const wipe=Math.sin(Math.PI*clamp(((t-1.4)%2.6-1.30)/1.30,0,1))**2;
  const target=new T.Vector3(0.003,0.208,0.224).lerp(new T.Vector3(0.032,0.251,0.199),wipe)
    .applyMatrix4(headInv).applyMatrix4(ws[joint.head]);
  const handDelta=new T.Quaternion().setFromEuler(new T.Euler(-1.18-wipe*0.25,0.16,0.17,'YXZ'));
  const restWrist=new T.Vector3().setFromMatrixPosition(bind[w]);
  const padOffset=new T.Vector3(0.027,0.015,0.063).sub(restWrist).applyQuaternion(handDelta);
  const goal=wrist.clone().lerp(target.sub(padOffset),weight);
  const dir=goal.clone().sub(shoulder).normalize(), a=elbow.distanceTo(shoulder), b=wrist.distanceTo(elbow);
  const reach=clamp(shoulder.distanceTo(goal),Math.abs(a-b)+0.001,a+b-0.001);
  const along=(a*a+reach*reach-b*b)/(2*reach);
  const pole=elbow.clone().sub(shoulder).projectOnPlane(dir).normalize().lerp(
    new T.Vector3(0.42,-1,-0.62).projectOnPlane(dir).normalize(),weight).normalize();
  const newElbow=shoulder.clone().addScaledVector(dir,along).addScaledVector(pole,Math.sqrt(Math.max(0,a*a-along*along)));
  function aim(i,oldStart,oldEnd,start,end) {
    const q=new T.Quaternion().setFromUnitVectors(oldEnd.clone().sub(oldStart).normalize(),end.clone().sub(start).normalize());
    ws[i]=new T.Matrix4().makeRotationFromQuaternion(q).multiply(ws[i]).setPosition(start);
  }
  aim(u,shoulder,elbow,shoulder,newElbow); aim(l,elbow,wrist,newElbow,goal);
  const rotation=new T.Matrix4().extractRotation(ws[w].clone().multiply(inverses[w]));
  const bend=new T.Quaternion().setFromRotationMatrix(rotation)
    .slerp(handDelta,weight);
  const hand=new T.Matrix4().makeRotationFromQuaternion(bend);
  const base=restWrist.clone().applyQuaternion(bend);
  hand.setPosition(goal.clone().sub(base));
  ws[w]=new T.Matrix4().multiplyMatrices(hand,bind[w]);
  ws[p]=new T.Matrix4().multiplyMatrices(hand,bind[p]);
}
function frame(a, blink, lick, washTime=-1) {
  const ws = a.render.skeleton.bones.map(b => b.matrixWorld);
  if(washTime>=0) washPaw(ws,washTime);
  const skinMatrices = ws.map((w,i) => new T.Matrix4().multiplyMatrices(w,inverses[i]).elements);
  let floor=Infinity;
  for (const j of support) {
    let y=0;
    for (let k=0; k<4; k++) {
      const weight=d.skinWeight[4*j+k]; if (!weight) continue;
      const e=skinMatrices[d.skinIndex[4*j+k]];
      y+=weight*(e[1]*pos[j*3]+e[5]*pos[j*3+1]+e[9]*pos[j*3+2]+e[13]);
    }
    floor=Math.min(floor,y);
  }
  // Whiskers are not load-bearing. Fold the lower fan away from the turf when the cheek rests on it.
  const headDelta=new T.Matrix4().multiplyMatrices(ws[joint.head],headInv);
  for (const [name,vertices] of Object.entries(fans)) {
    const i=joint[name], fan=new T.Matrix4().multiplyMatrices(headDelta,bind[i]);
    const pivot=new T.Vector3().setFromMatrixPosition(fan), low=new T.Vector3(0,Infinity,0);
    for(let k=0;k<vertices.length;k+=4) {
      v.fromArray(pos,3*vertices[k]).applyMatrix4(headDelta);
      if(v.y<low.y) low.copy(v);
    }
    if(low.y<floor+0.002 && pivot.y>floor) {
      const dir=low.sub(pivot), elevation=clamp((floor+0.003-pivot.y)/dir.length(),-0.98,0.98);
      const aim=new T.Vector3(dir.x,0,dir.z).normalize().multiplyScalar(Math.sqrt(1-elevation**2)); aim.y=elevation;
      fan.premultiply(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(dir.normalize(),aim))).setPosition(pivot);
    }
    ws[i]=fan;
  }
  return { pose:ws.map((w,i)=>{
    if (parent[i]<0) {
      m.copy(w); m.elements[12]-=a.position.x; m.elements[14]-=a.position.z; m.elements[13]-=floor;
    } else m.copy(ws[parent[i]]).invert().multiply(w);
    const p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();m.decompose(p,q,s);
    return {p,q,s};
  }), blink: Math.max(blink,a.state.eyelid || 0), lick };
}
function clip(name, list, seamFrames=0) {
  const time=list.map((_,i)=>i*dt), tracks=[];
  list.forEach((f,i)=>{
    const t=seamFrames ? smoothstep(i,list.length-1-seamFrames,list.length-1) : 0;
    if (!t) return;
    f.pose.forEach(({p,q,s},k)=>{const first=list[0].pose[k];p.lerp(first.p,t);q.slerp(first.q,t);s.lerp(first.s,t);});
    f.blink=lerp(f.blink,list[0].blink,t);
  });
  bones.forEach((b,k)=>{
    const loc=[], rot=[], sc=[];
    list.forEach((f,i)=>{
      const {p,q,s}=f.pose[k];
      if (i && q.dot(list[i-1].pose[k].q)<0) q.set(-q.x,-q.y,-q.z,-q.w);
      loc.push(...p.toArray()); rot.push(...q.toArray()); sc.push(...s.toArray());
    });
    tracks.push(new T.VectorKeyframeTrack(b.name+'.position',time,loc),
      new T.QuaternionKeyframeTrack(b.name+'.quaternion',time,rot),new T.VectorKeyframeTrack(b.name+'.scale',time,sc));
  });
  for(const name of ['Eyelids',...eyeNames]) tracks.push(new T.NumberKeyframeTrack(name+'.morphTargetInfluences[0]',time,list.map(f=>f.blink)));
  tracks.push(new T.VectorKeyframeTrack('Tongue.position',time,list.flatMap(f=>tongueAt(f.lick))));
  animations.push(new T.AnimationClip(name,-1,tracks).optimize());
}
const warm = (a, steps=30) => { for(let i=0;i<steps;i++) a.update(dt); };
function record(a,name,seconds,loop=false){
  const samples=[];
  for(let i=0;i<=Math.round(seconds*FPS);i++){
    const t=i*dt;
    if(i) a.update(dt);
    const lick=name==='groom' && t>1.4 && t<seconds-1.2 && (t-1.4)%2.6<1.3 ? Math.max(0,Math.sin(2*Math.PI*3.2*t)) : 0;
    const blink=name==='idle' ? 1-smoothstep(Math.abs(t-1.72),0.025,0.13) : 0;
    samples.push(frame(a,blink,lick,name==='groom'?t:-1));
  }
  clip(name,samples,loop?9:0);
}
warm(template); record(template,'idle',3.6,true);
const walking=actor(); walking.move({speed:0.53,heading:0}); warm(walking,110);
function nextStride(a,onFrame){
  for(let i=0;i<100;i++){const before=a.motion.phase;a.update(dt);onFrame?.();if(a.motion.phase<before)return;}
  throw Error('No complete walk cycle');
}
nextStride(walking);
const z=walking.position.z, stride=[frame(walking,0,0)];
nextStride(walking,()=>stride.push(frame(walking,0,0)));
root.userData.strideMeters=walking.position.z-z; clip('walk',stride,3);
const washing=actor();warm(washing);washing.play('groom',{duration:7.2,side:1});record(washing,'groom',7.3);
const napping=actor();warm(napping);napping.play('sleep');record(napping,'settle',3.8);record(napping,'sleep',3.8,true);
napping.play('stand');record(napping,'wake',2.3);
for(const a of [template,walking,washing,napping]) a.dispose();

// GLTFExporter uses the browser FileReader API even for a texture-free binary in Node.
globalThis.FileReader ??= class { async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend?.();} };
const glb=await new GLTFExporter().parseAsync(root,{binary:true,animations,onlyVisible:false,
  copyright:'Cat sculpt and motion adapted from Majid Manzarpour / procedural-animals (MIT).'});
// Store the ribbing and fine coat grain in a mipmapped albedo, independent of mesh density.
function wardrobeTexture() {
  const size=1024, scan=Buffer.alloc(size*(size*3+1));
  const wool=color('#ffffff');
  let seed=23;
  for(let j=0;j<size;j++) for(let i=0;i<size;i++) {
    const z=(i+.5)/size*.50-.23, y=(1-(j+.5)/size)*.37;
    const e=vestEdge(y,z), band=1-smoothstep(e,.007,.009);
    const rib=Math.sin(7000*(z+.31*y));
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    detail.copy(yellow).lerp(green,band).lerp(seam,0.38*(1-smoothstep(Math.abs(e-.008),.0002,.001)));
    c.copy(wool).lerp(detail,smoothstep(e,-.0005,.0005))
      .multiplyScalar(.98+.020*(seed/4294967296-.5)+.021*Math.sin(i*.24 + 1.7*Math.sin(j*.22)+j*.93)+band*.016*rib)
      .convertLinearToSRGB();
    const k=j*(1+size*3)+1+i*3;
    scan[k]=clamp(Math.round(c.r*255),0,255); scan[k+1]=clamp(Math.round(c.g*255),0,255); scan[k+2]=clamp(Math.round(c.b*255),0,255);
  }
  return png(size,scan,2);
}
function png(size,scan,type) {
  const header=Buffer.alloc(13);
  header.writeUInt32BE(size); header.writeUInt32BE(size,4); header[8]=8; header[9]=type;
  function chunk(id,bytes){const out=Buffer.alloc(bytes.length+12);out.writeUInt32BE(bytes.length);out.write(id,4);bytes.copy(out,8);
    out.writeUInt32BE(crc32(out.subarray(4,-4)),out.length-4);return out;}
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
}
const source=Buffer.from(glb), end=20+source.readUInt32LE(12), doc=JSON.parse(source.subarray(20,end));
let bytes=source.subarray(end+8);
doc.images=[]; doc.textures=[];
for (const [name,image] of [['Woven_jersey_and_coat',wardrobeTexture()],['Combed short strands',png(128,strandPixels(),6)]]) {
  const bufferView=doc.bufferViews.push({buffer:0,byteOffset:bytes.length,byteLength:image.length})-1;
  doc.textures.push({source:doc.images.push({name,bufferView,mimeType:'image/png'})-1});
  bytes=Buffer.concat([bytes,image,Buffer.alloc((4-image.length%4)%4)]);
}
doc.materials[0].pbrMetallicRoughness.baseColorTexture={index:0};
doc.materials.find(m=>m.name==='Brushed short fur').pbrMetallicRoughness.baseColorTexture={index:1};
doc.buffers[0].byteLength=bytes.length;
const text=Buffer.from(JSON.stringify(doc)), size=Math.ceil(text.length/4)*4;
const out=Buffer.alloc(28+size+bytes.length,0x20);
source.copy(out,0,0,20);out.writeUInt32LE(out.length,8);out.writeUInt32LE(size,12);text.copy(out,20);
out.writeUInt32LE(bytes.length,20+size);out.write('BIN\0',24+size);bytes.copy(out,28+size);
writeFileSync(new URL('../public/models/studio-cat.glb',import.meta.url),out);
console.log(`Baked ${d.nV} cat vertices, ${animations.length} clips; stride ${root.userData.strideMeters.toFixed(3)} m; ${(out.length/1048576).toFixed(2)} MiB.`);
