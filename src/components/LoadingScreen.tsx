import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';

export function LoadingScreen() {
  const { active, progress } = useProgress();
  const done = !active && progress >= 100;
  const [hidden, setHidden] = useState(false);

  // Keep the veil through the fade, then unmount so it never intercepts input.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setHidden(true), 650);
    return () => clearTimeout(t);
  }, [done]);

  if (hidden) return null;
  return (
    <div className={`loader${done ? ' done' : ''}`} role="status" aria-live="polite">
      <div className="loader-card">
        <div className="eyebrow">Playground / Auditorium 3D</div>
        <strong>Memuat ruang…</strong>
        <div className="loader-track">
          <div className="loader-fill" style={{ width: `${Math.round(progress)}%` }} />
        </div>
        <span className="loader-pct">{Math.round(progress)}%</span>
      </div>
    </div>
  );
}
