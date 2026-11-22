import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getWalkableFloorY, ROOM } from './layout';
import { getSceneMaterials } from './materials';
import { createTreadFooting } from './treadFooting';
import { createSeatContact } from './surfaceContact';
import { createPetPose } from './petContact';
import type { PetInteraction } from './petInteraction';
import { createSeatedPose } from './seatedPose';
import type { SeatUse } from './seating';

export type CharacterPose = 'idle' | 'walk' | 'run' | 'jump' | 'slide' | 'lounge' | 'dance';

export interface CharacterAnimState {
  pose: CharacterPose;
  strideWeight: number;
  distance: number;
  terrain: number;
  seat: number;
  visible: boolean;
  sitting: SeatUse | null;
}

interface RealisticCharacterProps {
  animRef: React.RefObject<CharacterAnimState>;
  pet: PetInteraction;
}

const MODEL_URL = `${import.meta.env.BASE_URL}models/studio-visitor.glb?v=ca5859b8`;
const SCALE = 0.95;

export function RealisticCharacter({ animRef, pet }: RealisticCharacterProps) {
  const gltf = useGLTF(MODEL_URL);
  const contacts = useRef<(THREE.Mesh | null)[]>([]);
  const seatContact = useRef<THREE.Mesh>(null);
  const footPosition = useRef(new THREE.Vector3());
  const model = useMemo(() => {
    const copy = clone(gltf.scene);
    copy.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false;
      }
    });
    return copy;
  }, [gltf.scene]);
  const feet = useMemo(() => ['LeftFoot', 'RightFoot'].map(name => model.getObjectByName(name)!), [model]);
  const footing = useMemo(() => createTreadFooting(model, SCALE), [model]);
  const fitSeat = useMemo(() => createSeatContact(model), [model]);
  const petPose = useMemo(() => createPetPose(model), [model]);
  const seatPose = useMemo(() => createSeatedPose(model), [model]);
  const firstPersonPet = useRef(false);
  const playback = useRef<{
    mixer: THREE.AnimationMixer;
    actions: THREE.AnimationAction[];
    weights: number[];
    idle: THREE.AnimationAction;
    walk: THREE.AnimationAction;
    run: THREE.AnimationAction;
    phase: number;
  } | null>(null);

  useLayoutEffect(() => {
    const mixer = new THREE.AnimationMixer(model);
    const actions = gltf.animations.map(clip =>
      mixer.clipAction(clip).setEffectiveWeight(clip.name === 'idle' ? 1 : 0).play()
    );
    const walk = actions.find(action => action.getClip().name === 'walk')!;
    const run = actions.find(action => action.getClip().name === 'run')!;
    walk.paused = run.paused = true;
    const idle = actions.find(action => action.getClip().name === 'idle')!;
    playback.current = { mixer, actions, weights: actions.map(a => a.weight), idle, walk, run, phase: 0.24 };
    mixer.update(0);
    return () => {
      playback.current = null;
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
    };
  }, [model, gltf.animations]);

  useFrame((_, rawDelta) => {
    const p = playback.current;
    if (!p) return;
    const { pose, visible, distance, terrain, seat, sitting } = animRef.current;
    const ownBody = !visible && pet.weight>0;
    model.visible = visible || ownBody;
    if (ownBody!==firstPersonPet.current) {
      model.traverse(n=>{
        if (n instanceof THREE.Mesh) n.visible=!ownBody || n.name==='Wolf3D_Body' || n.name.startsWith('Wolf3D_Outfit_');
      });
      firstPersonPet.current=ownBody;
    }
    const dt = Math.min(rawDelta, 0.05);
    const blend = 1 - Math.exp(-18 * dt);
    const moving = pose === 'walk' || pose === 'run';
    const speed = distance / Math.max(dt, 0.0001);
    const motion = THREE.MathUtils.smoothstep(speed, 0.025, 1.0);
    const run = THREE.MathUtils.smoothstep(speed,
      THREE.MathUtils.lerp(1.55, 1.05, terrain), THREE.MathUtils.lerp(3, 1.42, terrain)) * (1 - 0.82 * terrain);
    let neutralWeight = 0;
    p.actions.forEach((action, i) => {
      const name = action.getClip().name;
      const goal = moving ? (name === 'walk' ? motion * (1 - run) : name === 'run' ? motion * run : name === 'idle' ? 1 - motion : 0)
        : Number(name === (pose === 'slide' || sitting ? 'idle' : pose));
      p.weights[i] = THREE.MathUtils.lerp(p.weights[i], goal, blend);
      action.weight = name === 'slide' ? seat : sitting && name === 'lounge' ? sitting.weight
        : p.weights[i] * (1 - seat) * (1 - (sitting?.weight ?? 0));
      if (name === 'walk' || name === 'run' || name === 'dance') {
        const safe = action.weight * animRef.current.strideWeight;
        neutralWeight += action.weight - safe;
        action.weight = safe;
      }
      action.enabled = action.weight > 0.00001;
    });
    if (neutralWeight) {
      p.idle.enabled = true;
      p.idle.weight += neutralWeight;
    }
    // Both captures start on the same heel strike. Share their phase even mid-transition.
    const stride = gltf.scene.userData.strideMeters as { walk: number; run: number };
    const runMix = p.run.weight / Math.max(0.0001, p.walk.weight + p.run.weight);
    const metresPerCycle = THREE.MathUtils.lerp(THREE.MathUtils.lerp(stride.walk, stride.run, runMix) * SCALE,
      ROOM.tierDepth, terrain);
    if (pose === 'idle' && p.walk.weight + p.run.weight < 0.0002) p.phase = 0.24;
    p.phase = (p.phase + distance / metresPerCycle) % 1;
    const player = model.parent;
    if (!player) return;
    const headingZ = Math.cos(player.rotation.y);
    if (terrain > 0 && distance && Math.abs(headingZ) > 0.8) {
      const firstCenter = ROOM.stairsStartZ + ROOM.tierDepth / 4;
      const aligned = (player.position.z - firstCenter) / (ROOM.tierDepth * Math.sign(headingZ)) + 0.79;
      const error = THREE.MathUtils.euclideanModulo(aligned - p.phase + 0.5, 1) - 0.5;
      const catchUp = 0.35 * terrain * distance / metresPerCycle;
      p.phase = THREE.MathUtils.euclideanModulo(p.phase + THREE.MathUtils.clamp(error, -catchUp, catchUp), 1);
    }
    p.walk.time = p.phase * p.walk.getClip().duration;
    p.run.time = p.phase * p.run.getClip().duration;
    petPose.restore();
    seatPose.restore();
    footing.restore();
    p.mixer.update(dt);
    const onFoot = visible && (moving || pose === 'idle');
    footing.fit(player, onFoot ? terrain : 0, p.phase, p.walk.weight + p.run.weight, dt, onFoot ? 1 - runMix : -1);
    if (visible && pose === 'slide') fitSeat(player);
    if (visible && sitting) seatPose.fit(player,sitting);
    if (model.visible && pet.weight>0) petPose.fit(player,pet);
    if (seatContact.current) seatContact.current.visible = visible && seat > 0.995;
    feet.forEach((foot, i) => {
      const patch = contacts.current[i];
      if (!patch) return;
      patch.visible = visible && pose !== 'slide' && pose !== 'lounge';
      if (!patch.visible) return;
      const v = foot.getWorldPosition(footPosition.current);
      const floor = getWalkableFloorY(v.x, v.z, player.position.y);
      const contact = 1 - THREE.MathUtils.smoothstep(v.y - floor, 0.13, 0.3);
      player.worldToLocal(v);
      patch.position.set(v.x, floor - player.position.y + 0.002, v.z + 0.035);
      patch.scale.set(0.29 * contact, 0.43 * contact, 1);
    });
  });

  return <>
    <primitive object={model} name="studio-visitor" scale={SCALE} dispose={null} />
    <mesh ref={seatContact} visible={false} position-y={0.002} rotation-x={-Math.PI / 2}
      scale={[0.5, 0.45, 1]} material={getSceneMaterials().contactShade}><planeGeometry /></mesh>
    {feet.map((foot, i) => (
      <mesh key={foot.name} ref={node => { contacts.current[i] = node; }}
        rotation-x={-Math.PI / 2} material={getSceneMaterials().contactShade}>
        <planeGeometry />
      </mesh>
    ))}
  </>;
}

useGLTF.preload(MODEL_URL);
