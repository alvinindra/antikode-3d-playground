import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import type { PlayerInput } from '../scene/PlayerController';

export function TouchPad({ input }: { input: PlayerInput }) {
  const pad = useRef<HTMLDivElement>(null);
  const finger = useRef<number | null>(null);
  const reset = useCallback(() => {
    input.x = input.forward = 0;
    finger.current = null;
    pad.current?.style.removeProperty('--dx');
    pad.current?.style.removeProperty('--dy');
  }, [input]);

  useEffect(() => {
    window.addEventListener('blur', reset);
    window.addEventListener('resize', reset);
    document.addEventListener('visibilitychange', reset);
    return () => {
      window.removeEventListener('blur', reset);
      window.removeEventListener('resize', reset);
      document.removeEventListener('visibilitychange', reset);
      reset();
    };
  }, [reset]);

  function move(e: PointerEvent<HTMLDivElement>) {
    if (finger.current !== e.pointerId) return;
    const el = e.currentTarget, box = el.getBoundingClientRect();
    const radius = box.width * 0.35;
    const dx = e.clientX - box.left - box.width / 2, dy = e.clientY - box.top - box.height / 2;
    const length = Math.hypot(dx,dy), scale = Math.max(radius,length);
    input.x = length < radius * 0.12 ? 0 : dx / scale;
    input.forward = length < radius * 0.12 ? 0 : -dy / scale;
    el.style.setProperty('--dx', `${radius*dx/scale}px`);
    el.style.setProperty('--dy', `${radius*dy/scale}px`);
  }
  function end(e: PointerEvent<HTMLDivElement>) {
    if (finger.current === e.pointerId) reset();
  }
  return <div className="touch-deck">
    <div ref={pad} className="stick" role="group" aria-label="Joystick jalan dan lari"
      onPointerDown={e => {
        if (finger.current !== null || e.button !== 0) return;
        finger.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
      <span className="stick-thumb" />
    </div>
    <button className="jump" onClick={() => input.command?.('Space')}>
      <span aria-hidden="true">&#8593;</span>Lompat
    </button>
  </div>;
}
