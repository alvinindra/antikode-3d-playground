import { memo, Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { ArchitecturalShell } from './ArchitecturalShell';
import { FocalOakWall } from './FocalOakWall';
import { AuditoriumAndNook } from './AuditoriumAndNook';
import { PlayerController, type PlayerInput, type PlayerHudCallbackState, type ViewMode } from './PlayerController';
import { SceneLighting } from './SceneLighting';

interface RoomProps {
  isDay: boolean;
  ledOn: boolean;
  spotlightsOn: boolean;
  bloomEnabled: boolean;
  screenOn: boolean;
  input: PlayerInput;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onHudUpdate: (state: PlayerHudCallbackState) => void;
  onFpsSample: (fps: number) => void;
  onProgress: (percent: number) => void;
  onFrame: () => void;
}

function FirstFrame({ onFrame }: Pick<RoomProps, 'onFrame'>) {
  const seen = useRef(false);
  useFrame(() => {
    if (!seen.current) {
      seen.current = true;
      onFrame();
    }
  });
  return null;
}

export default memo(function RoomScene(p: RoomProps) {
  const staticRoom = useRef<THREE.Group>(null);
  const { active, loaded, total } = useProgress();
  const { onProgress } = p;
  useEffect(() => {
    onProgress(total ? (active ? Math.min(99, Math.round(loaded / total * 100)) : 100) : 0);
  }, [active, loaded, total, onProgress]);

  return <Canvas shadows="percentage" dpr={[1, 1.5]}
    camera={{ fov: 58, near: 0.1, far: 80, position: [-0.35, 2.2, -6.5] }}
    gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08 }}>
    <Suspense fallback={null}>
      <SceneLighting isDay={p.isDay} ledOn={p.ledOn} spotlightsOn={p.spotlightsOn} bloomEnabled={p.bloomEnabled} />
      <group ref={staticRoom}>
        <ArchitecturalShell isDay={p.isDay} spotlightsOn={p.spotlightsOn} ledOn={p.ledOn} />
        <FocalOakWall ledOn={p.ledOn} screenOn={p.screenOn} />
        <AuditoriumAndNook ledOn={p.ledOn} />
      </group>
      <PlayerController staticRoom={staticRoom} roomRevision={Number(p.ledOn) + 2 * Number(p.screenOn)}
        viewMode={p.viewMode} onViewModeChange={p.onViewModeChange} onHudUpdate={p.onHudUpdate}
        onFpsSample={p.onFpsSample} input={p.input} />
      <FirstFrame onFrame={p.onFrame} />
    </Suspense>
  </Canvas>;
});
