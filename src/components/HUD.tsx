import { useRef, useState } from 'react';
import { CAMERA_PRESETS } from '../scene/cameraPresets';
import { Icon, RoomMark } from './Marks';
import type { PlayerInput, ViewMode } from '../scene/PlayerController';
import { TouchPad } from './TouchPad';
import type { DaylightMode } from '../daylight';

interface HUDProps {
  input: PlayerInput;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isDay: boolean; daylightMode: DaylightMode; onDaylightModeChange: (mode: DaylightMode) => void;
  ledOn: boolean; onToggleLed: () => void;
  spotlightsOn: boolean; onToggleSpotlights: () => void;
  bloomEnabled: boolean; onToggleBloom: () => void;
  screenOn: boolean; onToggleScreen: () => void;
  fps: number;
  locationLabel: string;
  interactionPrompt: string | null;
  onInteract?: () => void;
}

const sections = ['Navigasi', 'Kamera', 'Suasana'] as const;
const hintsKey = 'antikode-playground.show-walk-hints';
const walkingViews = [['third-person', 'Di belakang karakter'], ['first-person', 'Dari mata karakter']] as const;
const shortcuts = [['W A S D', 'Berjalan'], ['Shift', 'Berlari sambil berjalan'], ['Spasi', 'Melompat'], ['E', 'Berinteraksi'], ['Drag', 'Melihat sekitar'], ['Gulir', 'Zoom kamera karakter']];
const gestures = [['Joystick', 'Geser untuk berjalan; dorong ke tepi untuk berlari.'], ['Usap', 'Lihat sekitar dengan satu jari.'], ['Cubit', 'Atur jarak kamera karakter dengan dua jari.']];

export function HUD(p: HUDProps) {
  const panel = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showHints, setShowHints] = useState(() => {
    try { return localStorage.getItem(hintsKey) !== 'false'; }
    catch { return true; }
  });
  const toggleHints = () => {
    const next = !showHints;
    setShowHints(next);
    try { localStorage.setItem(hintsKey, String(next)); }
    catch { /* Keep the session preference if storage is unavailable. */ }
  };
  const [section, setSection] = useState<typeof sections[number]>('Navigasi');
  const open = () => { panel.current?.showModal(); setMenuOpen(true); };
  const close = () => panel.current?.close();
  const lighting: [string,boolean,() => void][] = [
    ['LED hangat',p.ledOn,p.onToggleLed],
    ['Lampu sorot',p.spotlightsOn,p.onToggleSpotlights], ['Pendar cahaya',p.bloomEnabled,p.onToggleBloom],
    ['Layar LED',p.screenOn,p.onToggleScreen],
  ];
  const camera = CAMERA_PRESETS.find(v => v.id === p.viewMode);
  const chooseCamera = (mode: ViewMode) => { p.onViewModeChange(mode); close(); };
  return <>
    <span className="fps-readout">{p.fps} FPS</span>
    <div className="hud">
      <header className="hud-bar">
        <div className="station"><RoomMark /><div><span className="mono">{camera ? 'Sudut kamera' : 'Lokasi saat ini'}</span>
          <strong>{camera?.label ?? p.locationLabel}</strong></div></div>
        <div className="hud-tools"><span className="day-chip"><Icon name={p.isDay ? 'sun' : 'moon'} />{p.isDay ? 'Siang' : 'Malam'}</span>
          <button className="menu-trigger" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={open}>
            <Icon name="menu" />Menu ruang
          </button></div>
      </header>
      {!menuOpen && <>
        <TouchPad input={p.input} />
        {showHints && <div className="walk-hints keyboard-only"><kbd>WASD</kbd> Jalan <span /> <Icon name="mouse" /> Drag untuk melihat</div>}
        {p.interactionPrompt && <div className="prompt">
          {p.onInteract ? <button onClick={p.onInteract} aria-keyshortcuts="E"><kbd className="keyboard-only">E</kbd>{p.interactionPrompt}</button>
            : <span role="status">{p.interactionPrompt}</span>}
        </div>}
      </>}
    </div>
    <dialog className="guide" ref={panel} aria-labelledby="guide-title" onClose={() => setMenuOpen(false)}
      onClick={e => { if (e.target === panel.current) close(); }}>
      <div className="guide-inner">
        <header className="guide-head">
          <div className="mono"><i />Antikode Playground</div>
          <h2 id="guide-title">Menu ruang<b>.</b></h2>
          <button className="close-guide" aria-label="Tutup menu" onClick={close}><Icon name="close" /></button>
        </header>
        <div className="section-picker" role="group" aria-label="Bagian menu">
          {sections.map((s, i) => <button key={s} aria-pressed={section === s} onClick={() => setSection(s)}>
            <small aria-hidden="true">0{i + 1}</small>{s}</button>)}
        </div>
        <div className="guide-content">
          {section === 'Navigasi' && <section>
            <h3>Bergerak di ruang</h3>
            <dl className="controls keyboard-only">{shortcuts.map(([key, action]) =>
              <div key={key}><dt>{action}</dt><dd><kbd>{key}</kbd></dd></div>)}</dl>
            <div className="light-list keyboard-only">
              <button role="switch" aria-checked={showHints} onClick={toggleHints}>Tampilkan petunjuk WASD dan drag<i /></button>
            </div>
            <dl className="gestures touch-only">{gestures.map(([key, action]) =>
              <div key={key}><dt>{key}</dt><dd>{action}</dd></div>)}</dl>
            <p className="guide-note">Dekati kucing, kursi, atau perosotan. Pilih aksi yang muncul untuk berinteraksi.</p>
            <div className="quick-actions">
              {([['KeyF','Menari / berhenti'],['KeyR','Reset posisi']] as const).map(([key,label]) =>
                <button key={key} onClick={() => { close(); p.input.command?.(key); }}>{label}<kbd className="keyboard-only">{key.slice(3)}</kbd></button>)}</div>
          </section>}
          {section === 'Kamera' && <section>
            <h3>Saat berjalan</h3><div className="camera-list">
              {walkingViews.map(([id, label]) => <button key={id} aria-pressed={p.viewMode === id} onClick={() => chooseCamera(id)}>
                {label}{p.viewMode === id && <Icon name="check" />}</button>)}</div>
            <h3>Sudut tetap</h3><div className="shots">
              {CAMERA_PRESETS.map(({id, label}, i) => <button key={id} aria-pressed={p.viewMode === id} onClick={() => chooseCamera(id)}>
                <small className="mono">0{i + 1}</small>{label}</button>)}</div>
            <p className="guide-note">Mulai berjalan untuk kembali ke kamera karakter.</p>
          </section>}
          {section === 'Suasana' && <section>
            <h3>Waktu di ruang</h3>
            <div className="time-options" role="group" aria-label="Mode waktu">
              {([['auto','Otomatis'],['day','Siang'],['night','Malam']] as const).map(([mode,label]) =>
                <button key={mode} aria-pressed={mode === p.daylightMode} onClick={() => p.onDaylightModeChange(mode)}>{label}</button>)}
            </div>
            <p className="guide-note">{p.daylightMode === 'auto' ? `Saat ini ${p.isDay ? 'siang' : 'malam'}, mengikuti jam perangkatmu.` : 'Pilih Otomatis untuk mengikuti jam perangkatmu.'}</p>
            <h3>Pencahayaan</h3><div className="light-list">
              {lighting.map(([label, active, toggle]) => <button key={label} role="switch" aria-checked={active} onClick={toggle}>{label}<i /></button>)}
            </div>
          </section>}
        </div>
        <footer className="guide-foot">
          <button onClick={close}>Kembali ke ruang<Icon name="arrow" /></button>
        </footer>
      </div>
    </dialog>
  </>;
}
