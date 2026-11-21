# Antikode 3D Playground

Auditorium 3D interaktif yang dibuat dengan React dan Three.js. Jelajahi tribun
kayu, gunakan perosotan, duduk di bean bag atau kasur Cozy Nook, dan elus kucing
yang berkeliaran di area rumput.

## Menjalankan proyek

Gunakan Node.js 24 dan npm. Model dan tekstur sudah tersedia di repositori;
tidak perlu membuat ulang aset untuk menjalankan aplikasi.

```sh
npm ci
npm run dev
```

Buka alamat yang ditampilkan Vite. Gunakan `WASD` untuk berjalan, `Shift` untuk
berlari, dan `Space` untuk melompat. Dekati kucing, tempat duduk, atau perosotan
dan tekan `E` saat petunjuk muncul. Tekan `V` untuk mengganti sudut pandang.

## Verifikasi

```sh
npm run test:motion
npm run build
npm run preview
```

Asal model, lisensi, dan cara membuat ulang aset tercantum di
[kredit model](public/models/CREDITS.md).
