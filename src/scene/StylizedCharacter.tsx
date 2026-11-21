import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type CharacterPose = 'idle' | 'walk' | 'run' | 'jump' | 'slide' | 'lounge';

export interface CharacterAnimState {
  pose: CharacterPose;
  speedRatio: number; // 0..1
  visible: boolean;
}

interface StylizedCharacterProps {
  animRef: React.RefObject<CharacterAnimState>;
}

/**
 * Clean architectural stylized human (~1.72m tall) with smooth articulated limbs,
 * wearing minimalist warm-stone / charcoal studio attire that complements the interior.
 */
export function StylizedCharacter({ animRef }: StylizedCharacterProps) {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftShinRef = useRef<THREE.Group>(null);
  const rightShinRef = useRef<THREE.Group>(null);

  const cycleRef = useRef(0);

  const mats = useMemo(() => {
    return {
      skin: new THREE.MeshStandardMaterial({
        color: '#e6c8ae',
        roughness: 0.65,
        metalness: 0.02,
      }),
      hair: new THREE.MeshStandardMaterial({
        color: '#232022',
        roughness: 0.78,
        metalness: 0.04,
      }),
      sweater: new THREE.MeshStandardMaterial({
        color: '#e8e2d5',
        roughness: 0.85,
        metalness: 0.0,
      }),
      trousers: new THREE.MeshStandardMaterial({
        color: '#2c3038',
        roughness: 0.82,
        metalness: 0.02,
      }),
      shoes: new THREE.MeshStandardMaterial({
        color: '#f2efe9',
        roughness: 0.55,
        metalness: 0.05,
      }),
      accent: new THREE.MeshStandardMaterial({
        color: '#b48752',
        roughness: 0.5,
        metalness: 0.1,
      }),
    };
  }, []);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const state = animRef.current;
    if (!state || !rootRef.current || !bodyRef.current) return;

    rootRef.current.visible = state.visible;
    if (!state.visible) return;

    const lerpRate = Math.min(1, dt * 12);
    const pose = state.pose;

    let bodyY = 0;
    let bodyPitch = 0;
    let headPitch = 0;
    let lLegX = 0;
    let rLegX = 0;
    let lShinX = 0;
    let rShinX = 0;
    let lArmX = 0;
    let rArmX = 0;
    let lArmZ = 0.08;
    let rArmZ = -0.08;
    let lForearmX = -0.12;
    let rForearmX = -0.12;

    if (pose === 'walk' || pose === 'run') {
      const freq = pose === 'run' ? 11.5 : 7.6;
      const amp = pose === 'run' ? 0.82 : 0.48;
      cycleRef.current += dt * freq;
      const s = Math.sin(cycleRef.current);
      const c = Math.cos(cycleRef.current);

      bodyY = Math.abs(c) * (pose === 'run' ? 0.065 : 0.03);
      bodyPitch = pose === 'run' ? 0.14 : 0.04;

      lLegX = s * amp;
      rLegX = -s * amp;
      lShinX = Math.max(0, -c) * (pose === 'run' ? 0.95 : 0.45);
      rShinX = Math.max(0, c) * (pose === 'run' ? 0.95 : 0.45);

      lArmX = -s * amp * 0.85;
      rArmX = s * amp * 0.85;
      lForearmX = pose === 'run' ? -0.9 : -0.28;
      rForearmX = pose === 'run' ? -0.9 : -0.28;
    } else if (pose === 'jump') {
      bodyY = 0.04;
      bodyPitch = 0.08;
      lLegX = -0.45;
      rLegX = 0.25;
      lShinX = 0.65;
      rShinX = 0.4;
      lArmX = -0.7;
      rArmX = -0.5;
      lArmZ = 0.35;
      rArmZ = -0.35;
    } else if (pose === 'slide') {
      // Fun seated-back sliding posture with legs forward and arms out for balance
      bodyY = -0.52;
      bodyPitch = -0.42;
      headPitch = 0.28;
      lLegX = -1.18;
      rLegX = -1.12;
      lShinX = 0.22;
      rShinX = 0.28;
      lArmX = -0.45;
      rArmX = -0.45;
      lArmZ = 0.65;
      rArmZ = -0.65;
      lForearmX = -0.3;
      rForearmX = -0.3;
    } else if (pose === 'lounge') {
      // Relaxed seated posture in the cozy nook
      cycleRef.current += dt * 1.4;
      bodyY = -0.48 + Math.sin(cycleRef.current) * 0.006;
      bodyPitch = -0.2;
      headPitch = 0.08;
      lLegX = -1.42;
      rLegX = -1.36;
      lShinX = 0.35;
      rShinX = 0.45;
      lArmX = -0.25;
      rArmX = -0.25;
      lArmZ = 0.22;
      rArmZ = -0.22;
      lForearmX = -0.55;
      rForearmX = -0.55;
    } else {
      // Gentle natural idle breathing
      cycleRef.current += dt * 2.1;
      const breath = Math.sin(cycleRef.current);
      bodyY = breath * 0.008;
      lArmZ = 0.07 + breath * 0.015;
      rArmZ = -0.07 - breath * 0.015;
    }

    bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, bodyY, lerpRate);
    bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, bodyPitch, lerpRate);
    if (headRef.current) {
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, headPitch, lerpRate);
    }

    if (leftLegRef.current && rightLegRef.current) {
      leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, lLegX, lerpRate);
      rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, rLegX, lerpRate);
    }
    if (leftShinRef.current && rightShinRef.current) {
      leftShinRef.current.rotation.x = THREE.MathUtils.lerp(leftShinRef.current.rotation.x, lShinX, lerpRate);
      rightShinRef.current.rotation.x = THREE.MathUtils.lerp(rightShinRef.current.rotation.x, rShinX, lerpRate);
    }
    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, lArmX, lerpRate);
      rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, rArmX, lerpRate);
      leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, lArmZ, lerpRate);
      rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, rArmZ, lerpRate);
    }
    if (leftForearmRef.current && rightForearmRef.current) {
      leftForearmRef.current.rotation.x = THREE.MathUtils.lerp(
        leftForearmRef.current.rotation.x,
        lForearmX,
        lerpRate
      );
      rightForearmRef.current.rotation.x = THREE.MathUtils.lerp(
        rightForearmRef.current.rotation.x,
        rForearmX,
        lerpRate
      );
    }
  });

  return (
    <group ref={rootRef} name="stylized-player">
      {/* Subtle grounded contact shadow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[0.28, 18]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.32} depthWrite={false} />
      </mesh>

      <group ref={bodyRef}>
        {/* Pelvis / waist */}
        <mesh position={[0, 0.88, 0]} material={mats.trousers} castShadow>
          <capsuleGeometry args={[0.135, 0.08, 6, 12]} />
        </mesh>

        {/* Minimalist belt accent */}
        <mesh position={[0, 0.94, 0]} material={mats.accent}>
          <cylinderGeometry args={[0.145, 0.142, 0.035, 14]} />
        </mesh>

        {/* Torso / oversized minimalist studio sweater */}
        <mesh position={[0, 1.18, 0]} material={mats.sweater} castShadow>
          <capsuleGeometry args={[0.165, 0.28, 8, 14]} />
        </mesh>

        {/* Neck */}
        <mesh position={[0, 1.44, 0]} material={mats.skin}>
          <cylinderGeometry args={[0.048, 0.055, 0.09, 10]} />
        </mesh>

        {/* Head & stylized hair cap */}
        <group ref={headRef} position={[0, 1.57, 0]}>
          <mesh material={mats.skin} castShadow>
            <sphereGeometry args={[0.118, 16, 16]} />
          </mesh>
          {/* Sculpted minimalist hair cap */}
          <mesh position={[0, 0.032, -0.015]} material={mats.hair} castShadow>
            <sphereGeometry args={[0.123, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
          </mesh>
          {/* Minimalist dot eyes (facing +Z local forward) */}
          <mesh position={[-0.04, 0.01, 0.108]} material={mats.hair}>
            <sphereGeometry args={[0.012, 8, 8]} />
          </mesh>
          <mesh position={[0.04, 0.01, 0.108]} material={mats.hair}>
            <sphereGeometry args={[0.012, 8, 8]} />
          </mesh>
        </group>

        {/* Left Arm */}
        <group ref={leftArmRef} position={[-0.22, 1.34, 0]}>
          <mesh position={[0, -0.14, 0]} material={mats.sweater} castShadow>
            <capsuleGeometry args={[0.052, 0.22, 6, 10]} />
          </mesh>
          <group ref={leftForearmRef} position={[0, -0.29, 0]}>
            <mesh position={[0, -0.12, 0]} material={mats.sweater} castShadow>
              <capsuleGeometry args={[0.044, 0.18, 6, 10]} />
            </mesh>
            <mesh position={[0, -0.25, 0]} material={mats.skin}>
              <sphereGeometry args={[0.042, 10, 10]} />
            </mesh>
          </group>
        </group>

        {/* Right Arm */}
        <group ref={rightArmRef} position={[0.22, 1.34, 0]}>
          <mesh position={[0, -0.14, 0]} material={mats.sweater} castShadow>
            <capsuleGeometry args={[0.052, 0.22, 6, 10]} />
          </mesh>
          <group ref={rightForearmRef} position={[0, -0.29, 0]}>
            <mesh position={[0, -0.12, 0]} material={mats.sweater} castShadow>
              <capsuleGeometry args={[0.044, 0.18, 6, 10]} />
            </mesh>
            <mesh position={[0, -0.25, 0]} material={mats.skin}>
              <sphereGeometry args={[0.042, 10, 10]} />
            </mesh>
          </group>
        </group>

        {/* Left Leg */}
        <group ref={leftLegRef} position={[-0.095, 0.84, 0]}>
          <mesh position={[0, -0.21, 0]} material={mats.trousers} castShadow>
            <capsuleGeometry args={[0.068, 0.3, 6, 10]} />
          </mesh>
          <group ref={leftShinRef} position={[0, -0.42, 0]}>
            <mesh position={[0, -0.19, 0]} material={mats.trousers} castShadow>
              <capsuleGeometry args={[0.056, 0.28, 6, 10]} />
            </mesh>
            <mesh position={[0, -0.37, 0.045]} material={mats.shoes} castShadow>
              <boxGeometry args={[0.095, 0.085, 0.21]} />
            </mesh>
          </group>
        </group>

        {/* Right Leg */}
        <group ref={rightLegRef} position={[0.095, 0.84, 0]}>
          <mesh position={[0, -0.21, 0]} material={mats.trousers} castShadow>
            <capsuleGeometry args={[0.068, 0.3, 6, 10]} />
          </mesh>
          <group ref={rightShinRef} position={[0, -0.42, 0]}>
            <mesh position={[0, -0.19, 0]} material={mats.trousers} castShadow>
              <capsuleGeometry args={[0.056, 0.28, 6, 10]} />
            </mesh>
            <mesh position={[0, -0.37, 0.045]} material={mats.shoes} castShadow>
              <boxGeometry args={[0.095, 0.085, 0.21]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
