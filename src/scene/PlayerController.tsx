import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  CAMERA_PRESETS,
  FOYER,
  getRoofY,
  getWalkableFloorY,
  INTERACTION_ZONES,
  nookDuck,
  ROOM,
  stairInfluence,
  travelBaseY,
} from './layout';
import { CharacterAnimState, RealisticCharacter } from './RealisticCharacter';
import { beginSlide, sampleRide } from './slideRide';
import { StudioCat } from './StudioCat';
import { blocksCatFootprint } from './catRoutine';
import { advancePet, beginPet, createPetInteraction, petSpot, releasePet } from './petInteraction';
import { advanceSeat, frontExit, nearbySeat, takeSeat, type SeatUse } from './seating';
import { buildRoomContacts, outsideWalkableVolume } from './roomContacts';

export type ViewMode = 'third-person' | 'first-person' | (typeof CAMERA_PRESETS)[number]['id'];

export interface PlayerInput {
  x: number;
  forward: number;
  command?: (code: 'KeyE' | 'KeyF' | 'KeyR' | 'Space') => void;
}

export interface PlayerHudCallbackState {
  prompt: string | null;
  locationLabel: string;
  actionable: boolean;
}

interface PlayerControllerProps {
  staticRoom: RefObject<THREE.Group | null>;
  roomRevision: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onHudUpdate: (info: PlayerHudCallbackState) => void;
  onFpsSample: (fps: number) => void;
  input: PlayerInput;
}

const GRAVITY = -18.5;
const JUMP_VELOCITY = 6.2;
const WALK_SPEED = 1.5;
const RUN_SPEED = 3.65;
const MAX_STEP_UP = 0.56;

function nearbyAction(p: THREE.Vector3, cat: THREE.Group | null, scratch: THREE.Vector3, room: ReturnType<typeof buildRoomContacts> | null) {
  const zone=INTERACTION_ZONES.slideTop;
  if (Math.hypot(p.x-zone.x,p.z-zone.z)<zone.radius && Math.abs(p.y-ROOM.mezzanineY)<0.7 &&
      room?.clearApproach(p, scratch.set(zone.x, ROOM.mezzanineY, ROOM.stairsEndZ), 'slide')) return 'slide';
  const site=nearbySeat(p);
  if (cat?.userData.activity && petSpot(p,cat.position,scratch) && room?.clearApproach(p,scratch) &&
    (!site || Math.hypot(p.x-cat.position.x,p.z-cat.position.z)<Math.hypot(p.x-site.x,p.z-site.z))) return 'cat';
  return site && room?.clearApproach(p,site,site.id) ? site : null;
}

function getLocationLabel(x: number, y: number, z: number): string {
  if (y >= ROOM.mezzanineY - 0.15 && z >= ROOM.stairsEndZ - 0.3) {
    return 'Mezzanine Deck';
  }
  if (
    x >= ROOM.nookWallX - 0.15 &&
    x <= ROOM.nookWallX + ROOM.nookDepth + 0.1 &&
    z >= ROOM.nookDividerZ &&
    z <= ROOM.nookEndZ &&
    y < 1.5
  ) {
    return 'Cozy Under-Stairs Nook';
  }
  if (x >= ROOM.slideLeftX && x <= ROOM.slideRightX && z >= ROOM.stairsStartZ && z <= ROOM.stairsEndZ) {
    return 'Wooden Slide';
  }
  if (x >= ROOM.nookWallX && x <= ROOM.slideLeftX && z >= ROOM.stairsStartZ && z < ROOM.stairsEndZ) {
    return 'Stepping Auditorium';
  }
  if (x >= ROOM.turfLeftX && z >= ROOM.turfStartZ && z <= ROOM.turfEndZ) {
    return 'Playground Turf';
  }
  if (x < ROOM.leftWallX && z < FOYER.endZ) return 'Entrance Galeri';
  if (x < ROOM.nookWallX && z >= 0.5) {
    return 'Nook Gallery Corridor';
  }
  return 'Concrete Walkway';
}

export function PlayerController({
  staticRoom,
  roomRevision,
  viewMode,
  onViewModeChange,
  onHudUpdate,
  onFpsSample,
  input,
}: PlayerControllerProps) {
  const { camera, gl, scene } = useThree();
  const presetView = CAMERA_PRESETS.find(p => p.id === viewMode);
  const entryPhoto = viewMode === 'entrance' || viewMode === 'entrance-hall';
  const contacts = useRef<ReturnType<typeof buildRoomContacts> | null>(null);
  useEffect(() => {
    if (staticRoom.current) contacts.current = buildRoomContacts(staticRoom.current);
  }, [staticRoom, roomRevision]);

  const playerGroupRef = useRef<THREE.Group>(null);
  const catGroupRef = useRef<THREE.Group>(null);
  const pet = useMemo(createPetInteraction, []);
  const spare = useMemo(() => new THREE.Vector3(), []);
  const animRef = useRef<CharacterAnimState>({
    pose: 'idle',
    strideWeight: 1,
    distance: 0,
    terrain: 0,
    seat: 0,
    pushUp: 0,
    visible: true,
    sitting: null,
  });

  // Character simulation state (all in refs for zero React re-renders per frame)
  const posRef = useRef(new THREE.Vector3(-0.35, ROOM.turfY, -3.4));
  const velocityRef = useRef(new THREE.Vector2());
  const velYRef = useRef(0);
  const jumpPressed = useRef(false);
  const groundedRef = useRef(true);
  const facingYawRef = useRef(0); // 0 = facing +Z (looking at auditorium)
  const rideRef = useRef<ReturnType<typeof beginSlide> | null>(null);
  const sittingRef = useRef<SeatUse | null>(null);
  const isDancingRef = useRef(false);

  // Camera orbit state
  const camYawRef = useRef(0.12); // behind character looking toward auditorium
  const camPitchRef = useRef(0.24);
  const camDistRef = useRef(3.6);
  const camPosSmoothRef = useRef(new THREE.Vector3(-0.35, 2.2, -6.5));
  const camLookSmoothRef = useRef(new THREE.Vector3(-0.35, 1.3, -2.0));
  const camTargets = useRef({ position: new THREE.Vector3(), lookAt: new THREE.Vector3() });

  // Input keys
  const keysRef = useRef<Record<string, boolean>>({});
  const lastHudPromptRef = useRef<string | null>(null);
  const lastHudLocationRef = useRef<string>('');
  const fpsFramesRef = useRef(0);
  const fpsAccumRef = useRef(0);
  const slowSamplesRef = useRef(0);
  const petDprRef = useRef<number | null>(null);

  // Keyboard & mouse listeners
  useEffect(() => {
    const dom = gl.domElement;
    dom.tabIndex = 0;
    dom.setAttribute('aria-label', 'Jelajahi auditorium 3D');

    const interact = () => {
      if (pet.phase!=='off') { releasePet(pet); return; }
      if (sittingRef.current) { sittingRef.current.leaving=true; return; }
      if (!groundedRef.current || rideRef.current) return;
      const p=posRef.current, cat=catGroupRef.current, choice=nearbyAction(p,cat,spare,contacts.current);
      if (!choice) return;
      if (choice==='cat') {
        const mode=cat!.userData.activity;
        if (!beginPet(pet,p,cat!.position,mode==='sleep' || mode==='settle')) return;
      } else if (choice==='slide') {
        rideRef.current=beginSlide(p.x,p.y,p.z,facingYawRef.current);
      } else {
        const exit=frontExit(choice,point=>!outsideWalkableVolume(point.x,point.y,point.z) &&
          !contacts.current?.blocked(point.x,point.y,point.z) && !!contacts.current?.clearApproach(point,choice,choice.id));
        if (!exit) return;
        const sitting=takeSeat(choice,p,facingYawRef.current,exit);
        sitting.entryY=playerGroupRef.current?.position.y ?? p.y;
        if(choice.kind==='bag') scene.getObjectByName(choice.id)?.traverse(n=>{
          if(n instanceof THREE.Mesh && n.morphTargetInfluences?.length) sitting.morphs.push(n.morphTargetInfluences);
        });
        sittingRef.current=sitting;
        if(choice.kind==='bed' || choice.kind==='tier') {
          camYawRef.current=viewMode==='first-person' ? choice.yaw : choice.yaw+Math.PI+(choice.kind==='tier'?0.32:0.04);
          camPitchRef.current=0.17;
        }
      }
      velocityRef.current.set(0,0); velYRef.current=0; jumpPressed.current=false; isDancingRef.current=false;
      if (viewMode!=='third-person' && viewMode!=='first-person') onViewModeChange('third-person');
    };
    const command = (code: string) => {
      const preset = /^Digit[1-9]$/.test(code) ? CAMERA_PRESETS[Number(code.slice(5)) - 1] : undefined;
      if (preset || /^(Key[WASDF]|Arrow(Up|Down|Left|Right)|Space)$/.test(code)) releasePet(pet);
      if (sittingRef.current && /^(Key[WASD]|Arrow(Up|Down|Left|Right)|Space)$/.test(code)) sittingRef.current.leaving=true;

      if (code === 'Space') jumpPressed.current = true;
      else if (preset) onViewModeChange(preset.id);
      else if (code === 'KeyV') {
        onViewModeChange(viewMode === 'first-person' ? 'third-person' : 'first-person');
      } else if (code === 'KeyF') {
        if (!rideRef.current && !sittingRef.current && groundedRef.current) {
          isDancingRef.current = !isDancingRef.current;
        }
      } else if (code === 'KeyR') {
        // Quick teleport back to playground center
        pet.phase='off'; pet.weight=0;
        posRef.current.set(-0.35, ROOM.turfY, -3.4);
        velocityRef.current.set(0, 0);
        velYRef.current = 0;
        jumpPressed.current = false;
        groundedRef.current = true;
        facingYawRef.current = 0;
        camYawRef.current = 0.12;
        camPitchRef.current = 0.24;
        camDistRef.current = 3.6;
        rideRef.current = null;
        for(const m of sittingRef.current?.morphs ?? []) m[0]=0;
        sittingRef.current = null;
        isDancingRef.current = false;
        onViewModeChange('third-person');
      } else if (code === 'KeyE') {
        interact();
      }

      // Pressing movement keys while on a photo preset smoothly returns to playable third-person
      if (
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
          code
        )
      ) {
        if (viewMode !== 'third-person' && viewMode !== 'first-person') {
          onViewModeChange('third-person');
        }
      }
    };
    input.command=command;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]') || e.ctrlKey || e.metaKey || e.altKey ||
        (e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.matches('input, textarea, select')))) return;
      if (e.code === 'Space' && e.target instanceof HTMLButtonElement) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      keysRef.current[e.code] = true;
      if (/^(Key[WASD]|Arrow)/.test(e.code) && e.target instanceof HTMLButtonElement) dom.focus({preventScroll:true});
      command(e.code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    const pointers = new Map<number, {x:number; y:number}>();
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || pointers.size >= 2) return;
      dom.focus({ preventScroll: true });
      dom.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (document.pointerLockElement === dom) {
        camYawRef.current -= e.movementX * 0.0026;
        camPitchRef.current = THREE.MathUtils.clamp(
          camPitchRef.current + e.movementY * 0.0024,
          -0.42,
          0.95
        );
        return;
      }
      const last=pointers.get(e.pointerId);
      if (!last) return;
      const dx=e.clientX-last.x, dy=e.clientY-last.y;
      last.x=e.clientX; last.y=e.clientY;
      if(pointers.size===2) {
        for(const other of pointers.values()) if(other!==last) {
          const x=last.x-other.x, y=last.y-other.y;
          const before=Math.hypot(x-dx,y-dy), after=Math.hypot(x,y);
          if(before>4 && after>4) camDistRef.current=THREE.MathUtils.clamp(camDistRef.current*before/after,1.8,6.5);
        }
        return;
      }

      camYawRef.current -= dx * 0.0055;
      camPitchRef.current = THREE.MathUtils.clamp(
        camPitchRef.current + dy * 0.0045,
        -0.42,
        0.95
      );
    };

    const handlePointerUp = (e: PointerEvent) => { pointers.delete(e.pointerId); };

    const clearInput = () => {
      releasePet(pet);
      keysRef.current = {};
      velocityRef.current.set(0, 0);
      jumpPressed.current = false;
      pointers.clear();
      input.x=input.forward=0;
    };
    const onVisibilityChange = () => { if (document.hidden) clearInput(); };

    const handleWheel = (e: WheelEvent) => {
      camDistRef.current = THREE.MathUtils.clamp(camDistRef.current + e.deltaY * 0.0022, 1.8, 6.5);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearInput);
    document.addEventListener('visibilitychange', onVisibilityChange);
    dom.addEventListener('pointerdown', handlePointerDown);
    dom.addEventListener('lostpointercapture', handlePointerUp);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    dom.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      input.command=undefined;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearInput);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      dom.removeEventListener('pointerdown', handlePointerDown);
      dom.removeEventListener('lostpointercapture', handlePointerUp);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      dom.removeEventListener('wheel', handleWheel);
    };
  }, [gl, scene, viewMode, onViewModeChange, input, pet, spare]);

  useFrame(({ viewport, setDpr }, rawDelta) => {
    if (!contacts.current) return;
    const dt = Math.min(rawDelta, 0.05);

    // Sample FPS every 0.5s without spamming React state
    fpsFramesRef.current += 1;
    fpsAccumRef.current += rawDelta;
    if (fpsAccumRef.current >= 0.5) {
      const fps = Math.round(fpsFramesRef.current / fpsAccumRef.current);
      onFpsSample(fps);
      slowSamplesRef.current = !document.hidden && fps < 28 ? slowSamplesRef.current + 1 : 0;
      fpsFramesRef.current = 0;
      fpsAccumRef.current = 0;
    }
    // Scale only the 3D close-up, not the HUD. Latch until release so render
    // targets aren't repeatedly reallocated near the frame-rate threshold.
    if (pet.phase !== 'off' && slowSamplesRef.current >= 2 && petDprRef.current === null) {
      petDprRef.current = viewport.dpr;
      setDpr(Math.min(viewport.dpr, 0.75));
    } else if (pet.phase === 'off' && petDprRef.current !== null) {
      setDpr(petDprRef.current);
      petDprRef.current = null;
    }

    const keys = keysRef.current;
    const pos = posRef.current;
    let pose: CharacterAnimState['pose'] = 'idle';
    let distance = 0;
    let tilt = 0;
    let seat = 0;
    let pushUp = 0;
    const jump = jumpPressed.current;
    jumpPressed.current = false;

    if (input.x || input.forward) {
      releasePet(pet);
      if (sittingRef.current) sittingRef.current.leaving=true;
      if (viewMode!=='first-person' && viewMode!=='third-person') onViewModeChange('third-person');
    }
    if (rideRef.current) {
      rideRef.current.time += dt;
      const ride = sampleRide(rideRef.current);
      pos.set(ride.x, ride.y, ride.z);
      facingYawRef.current = ride.yaw;
      tilt = ride.pitch;
      seat = ride.seat;
      pushUp = ride.done ? 0 : ride.stand;
      pose = ride.done ? 'idle' : 'slide';
      if (ride.done) {
        rideRef.current = null;
        velYRef.current = 0;
        groundedRef.current = true;
      }
    }
    else if (sittingRef.current) {
      pose = 'lounge';
      const use=sittingRef.current;
      const px=pos.x, pz=pos.z;
      facingYawRef.current=advanceSeat(use,pos,dt);
      tilt=use.lean;
      const step=Math.hypot(pos.x-px,pos.z-pz);
      if((use.rise>0 ? use.rise>0.74 : use.weight<0.55) && step>0.04*dt) { pose='walk'; distance=step; }
      if(use.rise===1) { sittingRef.current=null; pose='idle'; distance=0; }
    }
    else if (pet.phase!=='off') {
      facingYawRef.current=advancePet(pet,pos,facingYawRef.current,dt);
      distance=pet.distance;
      pose=distance>0.015*dt ? 'walk' : 'idle';
    }
    // === 3. FREE WALKING / RUNNING / JUMPING / STAIRS ===
    else {
      const forwardInput =
        (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + input.forward;
      const rightInput =
        (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + input.x;
      const sprinting = Boolean(keys.ShiftLeft || keys.ShiftRight || Math.hypot(input.x,input.forward)>0.88);

      // Forward direction derived from camera yaw on XZ plane
      const camForwardX = Math.sin(camYawRef.current);
      const camForwardZ = Math.cos(camYawRef.current);
      const camRightX = -camForwardZ;
      const camRightZ = camForwardX;

      const moveX = camForwardX * forwardInput + camRightX * rightInput;
      const moveZ = camForwardZ * forwardInput + camRightZ * rightInput;
      const moveLen = Math.hypot(moveX, moveZ);
      const velocity = velocityRef.current;
      const onSteps = groundedRef.current ? stairInfluence(pos.x, pos.z, pos.y) * Math.abs(moveZ) / Math.max(1, moveLen) : 0;
      const targetSpeed = THREE.MathUtils.lerp(sprinting ? RUN_SPEED : WALK_SPEED, sprinting ? 1.42 : 1.05, onSteps) / Math.max(1, moveLen);
      const dvX = moveX * targetSpeed - velocity.x;
      const dvZ = moveZ * targetSpeed - velocity.y;
      const accel = moveLen ? 11 : 21;
      const fraction = Math.min(1, accel * dt / Math.max(0.00001, Math.hypot(dvX, dvZ)));
      velocity.x += dvX * fraction;
      velocity.y += dvZ * fraction;
      if (moveLen) isDancingRef.current = false;
      const startX = pos.x, startZ = pos.z;
      if (velocity.lengthSq() > 0.000001) {
        const stepX = velocity.x * dt;
        const stepZ = velocity.y * dt;

        // Try X and Z axes separately for smooth wall sliding
        const nextX = pos.x + stepX;
        const floorAtNextX = getWalkableFloorY(nextX, pos.z, pos.y);
        if (
          floorAtNextX <= pos.y + MAX_STEP_UP &&
          !outsideWalkableVolume(nextX, Math.max(pos.y, floorAtNextX), pos.z) &&
          !contacts.current?.blocked(nextX, Math.max(pos.y, floorAtNextX), pos.z) &&
          !blocksCatFootprint(catGroupRef.current?.position, nextX, pos.y, pos.z, pos)
        ) {
          pos.x = nextX;
        } else velocity.x = 0;

        const nextZ = pos.z + stepZ;
        const floorAtNextZ = getWalkableFloorY(pos.x, nextZ, pos.y);
        if (
          floorAtNextZ <= pos.y + MAX_STEP_UP &&
          !outsideWalkableVolume(pos.x, Math.max(pos.y, floorAtNextZ), nextZ) &&
          !contacts.current?.blocked(pos.x, Math.max(pos.y, floorAtNextZ), nextZ) &&
          !blocksCatFootprint(catGroupRef.current?.position, pos.x, pos.y, nextZ, pos)
        ) {
          pos.z = nextZ;
        } else velocity.y = 0;

        const dx = pos.x - startX, dz = pos.z - startZ;
        distance = Math.hypot(dx, dz);
        if (distance > 0.015 * dt) {
          const diff = Math.atan2(dx, dz) - facingYawRef.current;
          const turn = Math.atan2(Math.sin(diff), Math.cos(diff)) * (1 - Math.exp(-18 * dt));
          const maxTurn = THREE.MathUtils.lerp(9, 6.5, onSteps) * dt;
          facingYawRef.current += THREE.MathUtils.clamp(turn, -maxTurn, maxTurn);
          pose = distance > (WALK_SPEED + 0.45) * dt ? 'run' : 'walk';
        }
      }

      // Auto-trigger smooth wooden slide if walking into the top lip of the slide
      if (
        !jump && groundedRef.current && velocity.y < 0 && pos.x > ROOM.slideLeftX + 0.15 &&
        pos.x < ROOM.slideRightX - 0.15 &&
        pos.z < ROOM.stairsEndZ - 0.05 &&
        pos.z > ROOM.stairsEndZ - 0.85 &&
        pos.y > ROOM.mezzanineY - 0.45
      ) {
        rideRef.current = beginSlide(pos.x, getWalkableFloorY(pos.x, pos.z, pos.y), pos.z, facingYawRef.current);
        velocity.set(0, 0);
        isDancingRef.current = false;
      }

      // Jump
      if (jump && groundedRef.current) {
        velYRef.current = JUMP_VELOCITY;
        groundedRef.current = false;
      }

      const groundY = getWalkableFloorY(pos.x, pos.z, pos.y);
      if (groundedRef.current && pos.y - groundY <= MAX_STEP_UP &&
          (contacts.current?.vertical(pos.x,pos.z,pos.y,groundY) ?? groundY) === groundY) {
        pos.y = groundY;
        velYRef.current = 0;
      } else {
        velYRef.current += GRAVITY * dt;
        const to = Math.max(groundY, pos.y + velYRef.current * dt);
        pos.y = contacts.current?.vertical(pos.x, pos.z, pos.y, to) ?? to;
        groundedRef.current = pos.y === groundY || (velYRef.current < 0 && pos.y !== to);
        if (groundedRef.current || pos.y !== to) velYRef.current = 0;
      }

      if (!groundedRef.current) {
        pose = 'jump';
        isDancingRef.current = false;
      } else if (isDancingRef.current && pose === 'idle') {
        pose = 'dance';
      }
    }

    const sitting=sittingRef.current;
    const terrain = groundedRef.current && !rideRef.current && !sitting ? stairInfluence(pos.x, pos.z, pos.y) : 0;
    let bodyY=pos.y;
    if (sitting && !sitting.rise) bodyY+=(sitting.entryY-sitting.from.y)*(1-sitting.weight);
    else if (groundedRef.current && !rideRef.current) {
      const standingY=travelBaseY(pos.x,pos.z,pos.y,sitting ? stairInfluence(pos.x,pos.z,pos.y) : terrain);
      bodyY=sitting ? THREE.MathUtils.lerp(pos.y,standingY,THREE.MathUtils.smoothstep(sitting.rise,0.8,1)) : standingY;
    }
    if (playerGroupRef.current) {
      playerGroupRef.current.position.set(pos.x, bodyY, pos.z);
      playerGroupRef.current.rotation.set(tilt, facingYawRef.current, 0, 'YXZ');
    }

    const showCharacter = viewMode !== 'first-person';
    animRef.current.pose = pose;
    animRef.current.strideWeight = !sitting && !rideRef.current && contacts.current
      ? contacts.current.strideWeight(pos,facingYawRef.current) : 1;
    animRef.current.distance = pose === 'walk' || pose === 'run' ? distance : 0;
    animRef.current.terrain = terrain;
    animRef.current.seat = seat;
    animRef.current.pushUp = pushUp;
    animRef.current.visible = showCharacter;
    animRef.current.sitting = sitting;

    // === 4. CAMERA CONTROLLER (Third-Person / First-Person / Photo Presets) ===
    const { position: desiredCamPos, lookAt: desiredLookAt } = camTargets.current;
    const seated = sitting?.weight ?? seat;
    let desiredFov = 56;

    if (viewMode === 'third-person') {
      const targetY = bodyY + THREE.MathUtils.lerp(1.32, 0.68, seated);
      desiredLookAt.set(pos.x, targetY, pos.z);

      const dist = camDistRef.current;
      const horiz = Math.cos(camPitchRef.current) * dist;
      const vert = Math.sin(camPitchRef.current) * dist;

      desiredCamPos.set(
        pos.x - Math.sin(camYawRef.current) * horiz,
        targetY + vert,
        pos.z - Math.cos(camYawRef.current) * horiz
      );

      // Clamp camera cleanly inside architectural walls & sloped roof
      const inGallery = pos.x < ROOM.leftWallX;
      const minWallX = inGallery || pos.z > ROOM.doorwayStartZ - 0.1 ? ROOM.galleryMinX + 0.35 : ROOM.leftWallX + 0.35;
      desiredCamPos.x = THREE.MathUtils.clamp(desiredCamPos.x, minWallX, ROOM.rightWallX - 0.35);
      desiredCamPos.z = THREE.MathUtils.clamp(
        desiredCamPos.z,
        (inGallery ? FOYER.outerZ : ROOM.focalFrontZ) + 0.35,
        ROOM.mezzanineEndZ - 0.35
      );
      const underSoffit = inGallery && pos.z < FOYER.endZ && pos.y < FOYER.ceilingY;
      const roofLimit = underSoffit ? FOYER.ceilingY - 0.16 : getRoofY(desiredCamPos.x) - 0.65;
      const aboveTread = terrain && desiredCamPos.x >= ROOM.nookWallX && desiredCamPos.x < ROOM.slideLeftX;
      const cameraFloor = aboveTread ? getWalkableFloorY(desiredCamPos.x, desiredCamPos.z, ROOM.mezzanineY) + 0.26 : 0.45;
      desiredCamPos.y = THREE.MathUtils.clamp(desiredCamPos.y, cameraFloor, roofLimit);
      desiredFov = 58;
    } else if (viewMode === 'first-person') {
      const eyeY = bodyY + THREE.MathUtils.lerp(1.63-0.50*nookDuck(pos.x,pos.y,pos.z), 0.82, seated);
      desiredCamPos.set(pos.x, eyeY, pos.z);
      desiredLookAt.set(
        pos.x + Math.sin(camYawRef.current) * Math.cos(camPitchRef.current),
        eyeY - Math.sin(camPitchRef.current),
        pos.z + Math.cos(camYawRef.current) * Math.cos(camPitchRef.current)
      );
      desiredFov = 68;
    } else {
      const preset = presetView ?? CAMERA_PRESETS[0];
      desiredCamPos.set(...preset.position);
      desiredLookAt.set(...preset.target);
      desiredFov = preset.fov;
      if (preset.portrait && viewport.aspect < 1.2) {
        // On a phone, look past the chairs toward the door instead of cropping both out.
        const mix = 1 - THREE.MathUtils.smoothstep(viewport.aspect, 0.60, 1.2);
        desiredCamPos.lerp(spare.set(...preset.portrait.position), mix);
        desiredLookAt.lerp(spare.set(...preset.portrait.target), mix);
        desiredFov = THREE.MathUtils.lerp(desiredFov, preset.portrait.fov, mix);
      }
    }

    if (pet.weight>0 && (viewMode==='third-person' || viewMode==='first-person')) {
      const sn=Math.sin(pet.yaw), cs=Math.cos(pet.yaw);
      if (viewMode==='first-person') {
        // Look over the working forearm, clear of the near plane and the sleeve as the elbow folds.
        desiredCamPos.lerp(spare.set(pos.x+0.42*sn-0.10*cs,bodyY+(pet.sleeping?0.62:0.655),
          pos.z+0.42*cs+0.10*sn),pet.weight);
        desiredLookAt.lerp(spare.set(pos.x+0.64*sn-0.14*cs,bodyY+(pet.sleeping?0.105:0.18),
          pos.z+0.64*cs+0.14*sn),pet.weight);
      } else {
        desiredLookAt.lerp(spare.copy(pos).lerp(pet.contact,0.55).setY(bodyY+0.52),pet.weight);
        spare.set(pos.x-1.52*cs+0.65*sn,bodyY+0.93,pos.z+1.52*sn+0.65*cs);
        spare.z=THREE.MathUtils.clamp(spare.z,ROOM.focalFrontZ+0.35,ROOM.stairsStartZ-0.22);
        desiredCamPos.lerp(spare,pet.weight);
      }
    }
    const camSmooth = viewMode === 'first-person' ? Math.min(1, dt * 22) : Math.min(1, dt * 7.5);
    camPosSmoothRef.current.lerp(desiredCamPos, camSmooth);
    camLookSmoothRef.current.lerp(desiredLookAt, camSmooth);

    camera.position.copy(camPosSmoothRef.current);
    camera.lookAt(camLookSmoothRef.current);

    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - desiredFov) > 0.05) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, desiredFov, Math.min(1, dt * 6));
      camera.updateProjectionMatrix();
    }

    // === 5. CONTEXTUAL INTERACTION PROMPTS & LOCATION LABEL ===
    let nextPrompt: string | null = null;
    let actionable=false;
    if (sitting) {
      actionable=!sitting.leaving;
      nextPrompt=actionable ? `Bangun dari ${sitting.site.label}` : null;
    } else if (rideRef.current) {
      nextPrompt = 'Meluncur turun di perosotan kayu...';
    } else if (pet.phase!=='off') {
      actionable=pet.phase!=='release';
      nextPrompt=actionable ? 'Selesai mengelus' : null;
    } else if (groundedRef.current) {
      const choice=nearbyAction(pos,catGroupRef.current,spare,contacts.current);
      actionable=!!choice;
      if(choice==='cat') nextPrompt='Elus kucing';
      else if(choice==='slide') nextPrompt='Naik perosotan';
      else if(choice) nextPrompt=`Duduk di ${choice.label}`;
    }

    if (entryPhoto) { nextPrompt = null; actionable = false; }
    const locationLabel = entryPhoto && presetView ? presetView.label.split(' · ')[1] : getLocationLabel(pos.x, pos.y, pos.z);
    if (
      nextPrompt !== lastHudPromptRef.current ||
      locationLabel !== lastHudLocationRef.current
    ) {
      lastHudPromptRef.current = nextPrompt;
      lastHudLocationRef.current = locationLabel;
      onHudUpdate({ prompt: nextPrompt, locationLabel, actionable });
    }
  }, -1);

  return (
    <>
      <group name="player" ref={playerGroupRef} visible={!entryPhoto}>
        <Suspense fallback={null}>
          <RealisticCharacter animRef={animRef} pet={pet} />
        </Suspense>
      </group>
      <Suspense fallback={null}>
        <StudioCat body={catGroupRef} player={playerGroupRef} pet={pet} />
      </Suspense>
    </>
  );
}
