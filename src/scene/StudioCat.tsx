import { useLayoutEffect, useMemo, type RefObject } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createCatRoutine, CAT_SCALE, CAT_START, type CatMode } from './catRoutine';
import { ROOM } from './layout';
import { getSceneMaterials } from './materials';
import { createFurContact } from './petContact';
import type { PetInteraction } from './petInteraction';

const URL = `${import.meta.env.BASE_URL}models/studio-cat.glb?v=6b036541`;
type GroupRef = RefObject<THREE.Group | null>;

// The coat bake emits 24 indices per two-sided lock. Keep one whole lock
// out of four across the coat, sharing the same skinning and vertex buffers.
function sparseCoat(full: THREE.BufferGeometry) {
  const index=full.getIndex()!;
  const indices:number[]=[];
  for(let i=0;i<index.count;i+=4*24) {
    for(let k=0;k<24;k++) indices.push(index.getX(i+k));
  }
  const sparse=new THREE.BufferGeometry();
  for(const [name,attr] of Object.entries(full.attributes)) sparse.setAttribute(name,attr);
  sparse.setIndex(indices);
  return sparse;
}

export function StudioCat({ body, player, pet }: { body: GroupRef; player: GroupRef; pet: PetInteraction }) {
  const { scene, animations } = useGLTF(URL);
  const cat = useMemo(() => {
    const model = clone(scene);
    model.traverse(node => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = node.receiveShadow = true;
        if (node.name === 'Combed_guard_hairs') {
          node.castShadow = false;
          (node.material as THREE.MeshStandardMaterial).alphaToCoverage = true;
        }
        if (node instanceof THREE.SkinnedMesh) node.frustumCulled = false;
      }
    });
    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries(animations.map(clip => [clip.name, mixer.clipAction(clip)])) as Record<CatMode, THREE.AnimationAction>;
    const brain = createCatRoutine({ groom: actions.groom.getClip().duration, settle: actions.settle.getClip().duration,
      wake: actions.wake.getClip().duration });
    const stride = model.getObjectByName('Studio_cat_rig')!.userData.strideMeters * CAT_SCALE;
    const coat=model.getObjectByName('Combed_guard_hairs') as THREE.SkinnedMesh;
    const head = model.getObjectByName('head')!;
    const eyes = ['Eyelids','Sage_eye_L','Sage_eye_R'].map(n=>(model.getObjectByName(n) as THREE.Mesh).morphTargetInfluences!);
    return { model, mixer, actions: Object.entries(actions), brain, stride, phase: 0, clock: 0,
      coat, fullCoat:coat.geometry, sparseCoat:sparseCoat(coat.geometry), slowTime:0,
      fur: createFurContact(model), head, headQ: new THREE.Quaternion(), eyes, blink: [0,0,0], leaned: false };
  }, [scene, animations]);

  useLayoutEffect(() => {
    for (const [name,a] of cat.actions) {
      a.reset().play(); a.paused=true; a.weight=name==='idle'?1:0;
    }
    return () => {
      cat.mixer.stopAllAction();
      cat.coat.geometry=cat.fullCoat;
      cat.sparseCoat.dispose();
    };
  }, [cat]);

  useFrame((_, delta) => {
    if (!body.current) return;
    const dt=Math.min(0.05,delta);
    const held = pet.phase!=='off';
    // Ignore single-frame hitches; once reduced, keep the coat stable for this interaction.
    if (held) {
      cat.slowTime=delta>1/30 ? cat.slowTime+dt : 0;
      if(cat.slowTime>=0.15) cat.coat.geometry=cat.sparseCoat;
    } else {
      cat.slowTime=0;
      cat.coat.geometry=cat.fullCoat;
    }
    cat.brain.update(dt,player.current?.position ?? null,held);
    const s=cat.brain.state, root=body.current;
    root.position.set(s.x,ROOM.turfY,s.z); root.rotation.y=s.yaw;
    root.userData.activity=s.mode; root.userData.beingPetted=held;
    cat.phase=(cat.phase+s.distance/cat.stride)%1; cat.clock+=dt;
    const walking=s.mode==='walk' ? THREE.MathUtils.smoothstep(s.speed,0.02,0.29) : 0;
    for (const [name,a] of cat.actions) {
      const duration=a.getClip().duration;
      const target=name==='walk' ? walking : name==='idle' && s.mode==='walk' ? 1-walking : Number(name===s.mode);
      a.weight=THREE.MathUtils.damp(a.weight,target,14,dt);
      a.enabled=a.weight>0.00001;
      if (name==='walk') a.time=cat.phase*duration;
      else if (name==='idle') a.time=cat.clock%duration;
      else if (name===s.mode) a.time=name==='sleep' ? s.age%duration : Math.min(s.age,duration);
    }
    if (cat.leaned) {
      cat.head.quaternion.copy(cat.headQ);
      cat.eyes.forEach((eye,i)=>{eye[0]=cat.blink[i];});
      cat.leaned=false;
    }
    cat.mixer.update(0);
    if (held) {
      if (s.mode==='idle' && pet.weight>0) {
        cat.leaned=true;
        cat.headQ.copy(cat.head.quaternion);
        const side=player.current ? Math.sign((player.current.position.x-s.x)*Math.cos(s.yaw) -
          (player.current.position.z-s.z)*Math.sin(s.yaw)) : 1;
        cat.head.rotateX(-pet.weight*(0.16+0.13*pet.stroke));
        cat.head.rotateY(-side*0.20*pet.weight);
        cat.eyes.forEach((eye,i)=>{
          cat.blink[i]=eye[0];
          eye[0]=THREE.MathUtils.lerp(eye[0],0.60+0.36*pet.stroke,pet.weight);
        });
      }
      if (pet.weight>0) {
        root.updateMatrixWorld(true);
        cat.fur(pet.stroke,pet.contact);
        pet.surface=cat.fur.heightAt;
      }
    }
  }, -0.5);
  return <group ref={body} name="studio-cat" position={[CAT_START.x,ROOM.turfY,CAT_START.z]}>
    <mesh position={[0,0.001,0]} rotation-x={-Math.PI/2} scale={[0.34,0.67,1]} material={getSceneMaterials().contactShade}>
      <planeGeometry />
    </mesh>
    <primitive object={cat.model} scale={CAT_SCALE} dispose={null} />
  </group>;
}
