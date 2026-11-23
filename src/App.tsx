import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PlayerHudCallbackState, ViewMode, PlayerInput } from './scene/PlayerController';
import { HUD } from './components/HUD';
import { LoadingScreen } from './components/LoadingScreen';
import { isLocalDay, type DaylightMode } from './daylight';

const RoomScene = lazy(() => import('./scene/RoomScene'));

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('third-person');
  const [daylightMode, setDaylightMode] = useState<DaylightMode>('auto');
  const [localDay, setLocalDay] = useState(isLocalDay);
  const isDay = daylightMode === 'auto' ? localDay : daylightMode === 'day';
  useEffect(() => {
    let timer: number;
    function sync() {
      window.clearTimeout(timer);
      const now = new Date();
      setLocalDay(isLocalDay(now));
      timer = window.setTimeout(sync, 60000 - now.getTime() % 60000);
    }
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pageshow', sync);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pageshow', sync);
    };
  }, []);
  const [ledOn, setLedOn] = useState(true);
  const [spotlightsOn, setSpotlightsOn] = useState(true);
  const [bloomEnabled, setBloomEnabled] = useState(true);
  const [screenOn, setScreenOn] = useState(true);
  const [fps, setFps] = useState(0);
  const [entered, setEntered] = useState(false);
  const [percent, setPercent] = useState(0);
  const [hasFrame, setHasFrame] = useState(false);
  const [failed, setFailed] = useState(false);
  const ready = percent === 100 && hasFrame && !failed;
  const input = useRef<PlayerInput>({ x: 0, forward: 0, blocked: true });
  const sceneRoot = useRef<HTMLDivElement>(null);
  const [hudState, setHudState] = useState<PlayerHudCallbackState>({
    prompt: null,
    locationLabel: 'Playground Turf',
    actionable: false,
  });

  const firstFrame = useCallback(() => setHasFrame(true), []);
  useEffect(() => {
    if (ready) {
      input.current.blocked = false;
      setEntered(true);
    }
  }, [ready]);
  useEffect(() => {
    if (entered) sceneRoot.current?.querySelector('canvas')?.focus({ preventScroll: true });
  }, [entered]);

  return (
    <div className="playground">
      <div className="scene-root" ref={sceneRoot} inert={!entered}>
        <SceneBoundary onError={() => { setFailed(true); setEntered(false); }}>
          <Suspense fallback={null}>
            <RoomScene viewMode={viewMode} onViewModeChange={setViewMode} isDay={isDay}
              ledOn={ledOn} spotlightsOn={spotlightsOn} bloomEnabled={bloomEnabled} screenOn={screenOn}
              input={input.current} onProgress={setPercent} onFrame={firstFrame}
              onHudUpdate={setHudState} onFpsSample={setFps} />
          </Suspense>
        </SceneBoundary>
      </div>
      {!entered ? <LoadingScreen percent={percent} failed={failed} /> : <HUD
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isDay={isDay}
        daylightMode={daylightMode}
        onDaylightModeChange={setDaylightMode}
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
      />}
    </div>
  );
}

export default App;
