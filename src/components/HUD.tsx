import { useRef, useState } from 'react';
import { CAMERA_PRESETS } from '../scene/layout';
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

const cameras: [ViewMode,string][] = [
  ['third-person','Karakter 3P'], ['first-person','Orang pertama'],
  ...CAMERA_PRESETS.map(({id,label}): [ViewMode,string] => [id,label.split(' · ')[1]]),
];

export function HUD(p: HUDProps) {
  const panel = useRef<HTMLDialogElement>(null);
  const [open,setOpen] = useState(false);
  const lighting: [string,boolean,() => void][] = [
    ['LED hangat',p.ledOn,p.onToggleLed],
    ['Spotlight',p.spotlightsOn,p.onToggleSpotlights], ['Bloom',p.bloomEnabled,p.onToggleBloom],
    ['Layar LED',p.screenOn,p.onToggleScreen],
  ];
  return <div className="hud">
    <header className="hud-bar">
      <div className="station">
        <div className="eyebrow">Playground / Auditorium 3D</div>
        <strong>{p.locationLabel}</strong>
      </div>
      <div className="instrument"><span>{p.fps} FPS</span>
        <button aria-haspopup="dialog" aria-expanded={open} onClick={() => {
          panel.current?.showModal(); setOpen(true);
        }}>Info <b aria-hidden="true">+</b></button>
      </div>
    </header>
    {!open && <>
      <TouchPad input={p.input} />
      {p.interactionPrompt && <div className="prompt">
        {p.onInteract ? <button onClick={p.onInteract} aria-keyshortcuts="E">
          <kbd className="keyboard-only">E</kbd>{p.interactionPrompt}
        </button> : <span role="status">{p.interactionPrompt}</span>}
      </div>}
    </>}
    <dialog className="guide" ref={panel} aria-labelledby="guide-title" onClose={() => setOpen(false)}
      onClick={e => { if(e.target===panel.current) panel.current.close(); }}>
      <div className="guide-inner">
        <header><div><div className="eyebrow">Playground / Manual 01</div><h1 id="guide-title">Panduan ruang</h1></div>
          <button className="close-guide" aria-label="Tutup info" onClick={() => panel.current?.close()}>&times;</button>
        </header>
        <section><h2><small>01</small> Navigasi</h2>
          <p className="touch-only">Geser joystick untuk berjalan; dorong sampai tepi untuk berlari. Usap ruang untuk melihat sekitar. Cubit dengan dua jari untuk mengatur jarak kamera orang ketiga.</p>
          <p className="keyboard-only"><kbd>WASD</kbd> Jalan &nbsp; <kbd>Shift</kbd> Lari &nbsp; <kbd>Space</kbd> Lompat &nbsp; <kbd>E</kbd> Interaksi. Seret untuk melihat sekitar, gulir untuk zoom.</p>
          <p>Di dekat kucing, kursi, atau perosotan, pilih aksi yang muncul di layar.</p>
          <div className="guide-choices">{([['KeyF','Menari / berhenti'],['KeyR','Reset posisi']] as const).map(([key,label]) =>
            <button key={key} onClick={() => {panel.current?.close(); p.input.command?.(key);}}>{label}</button>)}</div>
        </section>
        <section><h2><small>02</small> Kamera</h2><div className="guide-choices">
          {cameras.map(([id,label]) => <button key={id} aria-pressed={p.viewMode===id}
            onClick={() => { p.onViewModeChange(id); panel.current?.close(); }}>{label}</button>)}
        </div></section>
        <section><h2><small>03</small> Suasana</h2>
          <p>Saat ini: {p.isDay ? 'siang' : 'malam'}. Mode otomatis mengikuti jam perangkatmu.</p>
          <div className="guide-choices" role="group" aria-label="Mode waktu">
            {([['auto','Otomatis'],['day','Siang'],['night','Malam']] as const).map(([mode,label]) =>
              <button key={mode} aria-pressed={mode===p.daylightMode} onClick={() => p.onDaylightModeChange(mode)}>{label}</button>)}
          </div>
          <div className="guide-choices lighting">
          {lighting.map(([label,active,toggle]) => <button key={label} aria-pressed={active} onClick={toggle}>{label}</button>)}
        </div></section>
      </div>
    </dialog>
  </div>;
}
