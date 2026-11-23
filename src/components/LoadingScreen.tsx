import { RoomMark } from './Marks';

export function LoadingScreen({ percent, failed }: { percent: number; failed: boolean }) {
  return <main className="loader">
    <div className="loader-content">
      <RoomMark />
      <h1 role="status">{failed ? 'Gagal memuat' : 'Memuat'}<br />Antikode Playground</h1>
      {failed ? <>
        <p>Periksa koneksi dan pastikan WebGL aktif di browsermu.</p>
        <button onClick={() => window.location.reload()}>Coba lagi</button>
      </> : <div className="load-progress">
        <progress aria-label="Pemuatan aset Antikode Playground" value={percent} max={100} />
        <span className="mono" aria-hidden="true">{percent}%</span>
      </div>}
    </div>
  </main>;
}
