interface CameraShot {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

interface CameraPreset extends CameraShot {
  id: 'photo1' | 'photo2' | 'photo3' | 'overview' | 'entrance' | 'entrance-hall';
  label: string;
  portrait?: CameraShot;
}

export const CAMERA_PRESETS: CameraPreset[] = [
  { id: 'photo1', label: 'Dari atas tribun', position: [-0.25, 4.7, 6.85], target: [-0.25, 2.0, -7.2], fov: 64 },
  { id: 'photo2', label: 'Rumput & perosotan', position: [0.25, 1.55, -5.35], target: [-0.35, 1.9, 3.6], fov: 64 },
  { id: 'photo3', label: 'Cozy Nook', position: [-8.75, 1.68, 4.9], target: [-3.2, 1.65, 4.85], fov: 60 },
  { id: 'overview', label: 'Mezzanine', position: [4.6, 4.45, 7.1], target: [-1.2, 1.4, -2.5], fov: 58 },
  {
    id: 'entrance', label: 'Galeri dari lounge', position: [-7.19, 1.32, 5.26], target: [-9.68, 1.18, 0.65], fov: 54,
    portrait: { position: [-9.32, 1.44, 6.24], target: [-8.53, 1.33, 0.44], fov: 63 },
  },
  {
    id: 'entrance-hall', label: 'Galeri dari tribun', position: [-0.40, 1.53, -3.65], target: [-6.4, 1.40, 1.18], fov: 43,
    portrait: { position: [-0.40, 1.52, -4.04], target: [-6.4, 1.36, 1.05], fov: 55 },
  },
];
