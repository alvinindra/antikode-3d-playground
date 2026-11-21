import { useState } from 'react';
import { CAMERA_PRESETS } from '../scene/layout';
import { ViewMode } from '../scene/PlayerController';

interface HUDProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isDay: boolean;
  onToggleDay: () => void;
  ledOn: boolean;
  onToggleLed: () => void;
  spotlightsOn: boolean;
  onToggleSpotlights: () => void;
  bloomEnabled: boolean;
  onToggleBloom: () => void;
  screenOn: boolean;
  onToggleScreen: () => void;
  fps: number;
  locationLabel: string;
  interactionPrompt: string | null;
  onInteract?: () => void;
}

const pillBase: React.CSSProperties = {
  background: 'rgba(15, 16, 20, 0.72)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '10px',
  color: '#f2eee6',
};

export function HUD({
  viewMode,
  onViewModeChange,
  isDay,
  onToggleDay,
  ledOn,
  onToggleLed,
  spotlightsOn,
  onToggleSpotlights,
  bloomEnabled,
  onToggleBloom,
  screenOn,
  onToggleScreen,
  fps,
  locationLabel,
  interactionPrompt,
  onInteract,
}: HUDProps) {
  const [showHelp, setShowHelp] = useState(() => !window.matchMedia('(max-width: 640px)').matches);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 11px',
    borderRadius: '7px',
    border: active
      ? '1px solid rgba(235, 178, 106, 0.85)'
      : '1px solid rgba(255, 255, 255, 0.1)',
    background: active ? 'rgba(218, 152, 74, 0.28)' : 'rgba(255, 255, 255, 0.05)',
    color: active ? '#ffdfb3' : '#d6d2c9',
    fontSize: '12px',
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  });

  const fpsColor = fps >= 55 ? '#8fe09b' : fps >= 35 ? '#f0cf7b' : '#f0877b';
  const Prompt = onInteract ? 'button' : 'div';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px',
      }}
    >
      {/* === TOP BAR === */}
      <div className="hud-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        {/* Title + Zone + FPS */}
        <div style={{ ...pillBase, padding: '10px 14px', pointerEvents: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.02em' }}>
              PLAYGROUND AUDITORIUM 3D
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.08)',
                color: fpsColor,
              }}
            >
              {fps} FPS
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#b7b1a5', marginTop: '3px' }}>
            Area: <strong style={{ color: '#e9d6ba' }}>{locationLabel}</strong>
          </div>
        </div>

        {/* Lighting & Visual Controls */}
        <div
          style={{
            ...pillBase,
            padding: '8px',
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            pointerEvents: 'auto',
          }}
        >
          <button style={btnStyle(!isDay)} onClick={onToggleDay}>
            {isDay ? 'Siang' : 'Malam'}
          </button>
          <button style={btnStyle(ledOn)} onClick={onToggleLed}>
            LED Hangat
          </button>
          <button style={btnStyle(spotlightsOn)} onClick={onToggleSpotlights}>
            Spotlight
          </button>
          <button style={btnStyle(bloomEnabled)} onClick={onToggleBloom}>
            Bloom
          </button>
          <button style={btnStyle(screenOn)} onClick={onToggleScreen}>
            Layar LED
          </button>
          <button style={btnStyle(showHelp)} onClick={() => setShowHelp((s) => !s)}>
            {showHelp ? 'Tutup Info' : 'Kontrol'}
          </button>
        </div>
      </div>

      {/* === CENTER INTERACTION PROMPT === */}
      {interactionPrompt && (
        <div style={{ alignSelf: 'center', marginTop: 'auto', marginBottom: '12px' }}>
          <Prompt
            onClick={onInteract}
            aria-keyshortcuts={onInteract ? 'E' : undefined}
            style={{
              ...pillBase,
              padding: '9px 18px',
              pointerEvents: onInteract ? 'auto' : 'none',
              cursor: onInteract ? 'pointer' : undefined,
              borderColor: 'rgba(238, 182, 108, 0.6)',
              background: 'rgba(26, 20, 14, 0.82)',
              fontSize: '13px',
              fontWeight: 600,
              color: '#ffe4be',
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            }}
          >
            {interactionPrompt}
          </Prompt>
        </div>
      )}

      {/* === BOTTOM BAR === */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {/* Controls Legend */}
        {showHelp ? (
          <div style={{ ...pillBase, padding: '10px 14px', fontSize: '11.5px', lineHeight: 1.65, pointerEvents: 'auto' }}>
            <div style={{ color: '#e9d6ba', fontWeight: 600, marginBottom: '2px' }}>Navigasi Karakter</div>
            <div>
              <kbd style={kbdStyle}>WASD</kbd> Jalan &nbsp;
              <kbd style={kbdStyle}>Shift</kbd> Lari &nbsp;
              <kbd style={kbdStyle}>Space</kbd> Lompat &nbsp;
              <kbd style={kbdStyle}>E</kbd> Duduk / Elus / Perosotan &nbsp;
              <kbd style={kbdStyle}>F</kbd> Dance
            </div>
            <div>
              <kbd style={kbdStyle}>Drag Mouse</kbd> Putar Kamera &nbsp;
              <kbd style={kbdStyle}>Scroll</kbd> Zoom &nbsp;
              <kbd style={kbdStyle}>V</kbd> 1st/3rd Person &nbsp;
              <kbd style={kbdStyle}>R</kbd> Reset
            </div>
          </div>
        ) : (
          <div />
        )}

        {/* Camera Mode & Photo Angle Presets */}
        <div
          style={{
            ...pillBase,
            padding: '8px',
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            pointerEvents: 'auto',
          }}
        >
          <button
            style={btnStyle(viewMode === 'third-person')}
            onClick={() => onViewModeChange('third-person')}
          >
            Karakter 3P
          </button>
          <button
            style={btnStyle(viewMode === 'first-person')}
            onClick={() => onViewModeChange('first-person')}
          >
            First-Person
          </button>
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.14)', margin: '2px 2px' }} />
          {CAMERA_PRESETS.map((preset, idx) => (
            <button
              key={preset.id}
              style={btnStyle(viewMode === preset.id)}
              onClick={() => onViewModeChange(preset.id)}
            >
              [{idx + 1}] {preset.label.split(' · ')[1]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 5px',
  borderRadius: '4px',
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.16)',
  fontSize: '10.5px',
  fontFamily: 'inherit',
  color: '#fff',
};
