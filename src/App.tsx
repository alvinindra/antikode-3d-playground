import { useCallback, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { ArchitecturalShell } from './scene/ArchitecturalShell';
import { FocalOakWall } from './scene/FocalOakWall';
import { AuditoriumAndNook } from './scene/AuditoriumAndNook';
import { PlayerController, PlayerHudCallbackState, ViewMode, type PlayerInput } from './scene/PlayerController';
import { SceneLighting } from './scene/SceneLighting';
import { HUD } from './components/HUD';

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('third-person');
  const [isDay, setIsDay] = useState(false);
  const [ledOn, setLedOn] = useState(true);
  const [spotlightsOn, setSpotlightsOn] = useState(true);
  const [bloomEnabled, setBloomEnabled] = useState(true);
  const [screenOn, setScreenOn] = useState(true);
  const [fps, setFps] = useState(60);
  const input = useRef<PlayerInput>({x:0,forward:0});
  const staticRoom = useRef<THREE.Group>(null);
  const [hudState, setHudState] = useState<PlayerHudCallbackState>({
    prompt: null,
    locationLabel: 'Playground Turf',
    actionable: false,
  });

  const handleHudUpdate = useCallback((info: PlayerHudCallbackState) => {
    setHudState(info);
  }, []);

  const handleFpsSample = useCallback((sampledFps: number) => {
    setFps(sampledFps);
  }, []);

  // HUD samples change several times during a stroke, not the auditorium.
  const scene = useMemo(() => (
      <Canvas
        shadows="percentage"
        dpr={[1, 1.5]}
        camera={{ fov: 58, near: 0.1, far: 80, position: [-0.35, 2.2, -6.5] }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
      >
        <SceneLighting
          isDay={isDay}
          ledOn={ledOn}
          spotlightsOn={spotlightsOn}
          bloomEnabled={bloomEnabled}
        />

        <group ref={staticRoom}>
          <ArchitecturalShell isDay={isDay} spotlightsOn={spotlightsOn} ledOn={ledOn} />
          <FocalOakWall ledOn={ledOn} screenOn={screenOn} />
          <AuditoriumAndNook ledOn={ledOn} />
        </group>

        <PlayerController
          staticRoom={staticRoom}
          roomRevision={Number(ledOn) + 2 * Number(screenOn)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onHudUpdate={handleHudUpdate}
          onFpsSample={handleFpsSample}
          input={input.current}
        />
      </Canvas>
  ), [viewMode, isDay, ledOn, spotlightsOn, bloomEnabled, screenOn, handleHudUpdate, handleFpsSample]);

  return (
    <div className="playground">
      {scene}
      <HUD
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isDay={isDay}
        onToggleDay={() => setIsDay((d) => !d)}
        ledOn={ledOn}
        onToggleLed={() => setLedOn((v) => !v)}
        spotlightsOn={spotlightsOn}
        onToggleSpotlights={() => setSpotlightsOn((v) => !v)}
        bloomEnabled={bloomEnabled}
        onToggleBloom={() => setBloomEnabled((v) => !v)}
        screenOn={screenOn}
        onToggleScreen={() => setScreenOn((v) => !v)}
        fps={fps}
        locationLabel={hudState.locationLabel}
        interactionPrompt={hudState.prompt}
        input={input.current}
        onInteract={hudState.actionable ? () => input.current.command?.('KeyE') : undefined}
      />
    </div>
  );
}

export default App;
