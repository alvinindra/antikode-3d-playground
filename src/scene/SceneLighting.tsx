import { Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { ROOM } from './layout';

interface SceneLightingProps {
  isDay: boolean;
  ledOn: boolean;
  spotlightsOn: boolean;
  bloomEnabled: boolean;
}

export function SceneLighting({
  isDay,
  ledOn,
  spotlightsOn,
  bloomEnabled,
}: SceneLightingProps) {
  return (
    <>
      <color attach="background" args={[isDay ? '#b8c8d8' : '#0b0c10']} />
      <fog attach="fog" args={[isDay ? '#cfd9e3' : '#0f1014', 24, 52]} />

      {/* Studio PBR image-based environment baked once (frames={1} -> 0ms per-frame cost!) */}
      <Environment resolution={256} frames={1} environmentIntensity={isDay ? 0.72 : 0.36}>
        <Lightformer
          form="rect"
          intensity={isDay ? 2.4 : 0.85}
          color={isDay ? '#e6f2ff' : '#ffd8a8'}
          position={[8, 4.5, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[16, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={isDay ? 1.4 : 1.1}
          color="#ffcf96"
          position={[0, 7.5, -2]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[12, 14, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.95}
          color="#ffb766"
          position={[0, 2.6, -7]}
          scale={[12, 3.5, 1]}
        />
        <Lightformer
          form="ring"
          intensity={0.65}
          color="#c9d6e8"
          position={[-8, 3.5, 4]}
          rotation={[0, Math.PI / 2, 0]}
          scale={5}
        />
      </Environment>

      {/* Base ambient bounce — keeps raw concrete, oak & steel readable */}
      <hemisphereLight
        args={[
          isDay ? '#eef5fc' : '#b1bac6',
          isDay ? '#8d8170' : '#70645b',
          isDay ? 1.1 : 0.57,
        ]}
      />

      {/* Primary overhead / daylight shadow-casting key light */}
      <directionalLight
        position={isDay ? [10, 8.5, -1.5] : [-2, 6.6, 1.2]}
        intensity={isDay ? 2.1 : spotlightsOn ? 1.0 : 0.25}
        color={isDay ? '#fff8ee' : '#ffead3'}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
        shadow-camera-left={-11}
        shadow-camera-right={10}
        shadow-camera-top={12}
        shadow-camera-bottom={-10}
        shadow-camera-near={1}
        shadow-camera-far={24}
      />

      {/* === ARCHITECTURAL TRACK SPOTLIGHT WASHES (Non-shadowed for 60+ FPS!) === */}
      {spotlightsOn && (
        <>
          {/* Warm gallery wall wash above the 2 blue abstract paintings */}
          <pointLight
            position={[ROOM.leftWallX + 1.15, 4.35, -3.45]}
            color="#ffdba8"
            intensity={12}
            distance={8.5}
            decay={2}
          />

          {/* Gallery accent wash on the colorful abstract painting on the right concrete wall */}
          <pointLight
            position={[ROOM.rightWallX - 1.35, 3.25, -3.5]}
            color="#ffe5c4"
            intensity={9.5}
            distance={7.5}
            decay={2}
          />

          {/* Central playground turf & auditorium fill wash */}
          <pointLight
            position={[0.2, 5.4, -2.5]}
            color="#ffdfb3"
            intensity={15}
            distance={14}
            decay={2}
          />

          {/* Auditorium seating & wooden slide warm overhead wash */}
          <pointLight
            position={[1.0, 5.5, 2.8]}
            color="#ffddb0"
            intensity={16.5}
            distance={14}
            decay={2}
          />

          {/* Grazing spotlight above the oak-framed TV on dark plaster wall (Photo 3!) */}
          <pointLight
            position={[ROOM.nookWallX - 0.85, 2.85, 7.55]}
            color="#ffdfb8"
            intensity={7.5}
            distance={5.5}
            decay={2}
          />

          {/* Gallery corridor ambient fill */}
          <pointLight
            position={[-9.15, 3.7, 3.6]}
            color="#e8d6be"
            intensity={11}
            distance={12}
            decay={2}
          />

          {/* Subtle ceiling uplight bounce so ribbed ceiling panels & black steel trusses shine */}
          <pointLight
            position={[-0.8, 5.0, -1.0]}
            color="#d8c3a5"
            intensity={8.5}
            distance={13}
            decay={2}
          />
        </>
      )}

      {/* === WARM ARCHITECTURAL LED COVE & STAIR BOUNCE LIGHTS === */}
      {ledOn && (
        <>
          {/* Balanced dual warm cove washes along the focal white oak wall */}
          <pointLight
            position={[-2.6, 3.05, ROOM.focalFrontZ + 1.85]}
            color="#ffb563"
            intensity={7.2}
            distance={10}
            decay={2}
          />
          <pointLight
            position={[2.2, 3.05, ROOM.focalFrontZ + 1.85]}
            color="#ffb563"
            intensity={7.2}
            distance={10}
            decay={2}
          />
          {/* Smooth elevated auditorium warm golden wash */}
          <pointLight
            position={[0.2, 2.85, 1.35]}
            color="#ffaf52"
            intensity={8.0}
            distance={10.5}
            decay={2}
          />
          {/* Mezzanine cool-neutral linear LED workspace glow */}
          <pointLight
            position={[1.8, ROOM.mezzanineY + 1.5, 9.0]}
            color="#eef2f8"
            intensity={10}
            distance={9}
            decay={2}
          />
        </>
      )}

      {/* Selective Mipmap Bloom — only glowing LEDs, bulbs & spotlight lenses bloom! */}
      {bloomEnabled && (
        <EffectComposer multisampling={2}>
          <Bloom
            mipmapBlur
            luminanceThreshold={1.0}
            luminanceSmoothing={0.18}
            intensity={0.4}
            radius={0.6}
          />
        </EffectComposer>
      )}
    </>
  );
}
