import * as THREE from 'three';

function createSeededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export interface ProceduralTextureSet {
  contactMap: THREE.CanvasTexture;
  concreteMap: THREE.CanvasTexture;
  concreteBump: THREE.CanvasTexture;
  darkPlasterMap: THREE.CanvasTexture;
  darkPlasterBump: THREE.CanvasTexture;
  polishedFloorMap: THREE.CanvasTexture;
  oakMap: THREE.CanvasTexture;
  oakBump: THREE.CanvasTexture;
  turfMap: THREE.CanvasTexture;
  turfBump: THREE.CanvasTexture;
  ceilingDeckMap: THREE.CanvasTexture;
  fabricMap: THREE.CanvasTexture;
  beanbagFabricMap: THREE.CanvasTexture;
  carpetMap: THREE.CanvasTexture;
  paintingLeftMap: THREE.CanvasTexture;
  paintingRightMap: THREE.CanvasTexture;
  rightWallArtMap: THREE.CanvasTexture;
  ledWallScreenMap: THREE.CanvasTexture;
  galleryPrintAMap: THREE.CanvasTexture;
  galleryPrintBMap: THREE.CanvasTexture;
  mezzanineTimelineMap: THREE.CanvasTexture;
  exteriorDayMap: THREE.CanvasTexture;
  exteriorNightMap: THREE.CanvasTexture;
  gardenDayMap: THREE.CanvasTexture;
  gardenNightMap: THREE.CanvasTexture;
}

let cachedTextures: ProceduralTextureSet | null = null;

function contactMap(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(64, 64);
  const shade = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  shade.addColorStop(0, 'rgba(22,19,16,0.53)');
  shade.addColorStop(0.55, 'rgba(22,19,16,0.33)');
  shade.addColorStop(1, 'rgba(22,19,16,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function generatePlasterTextures(
  baseRgb: [number, number, number],
  variance: number,
  seed: number,
  repeatX: number,
  repeatY: number,
  size = 1024
): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const [canvas, ctx] = makeCanvas(size, size);
  const [bumpCanvas, bumpCtx] = makeCanvas(size, size);
  const rand = createSeededRandom(seed);

  ctx.fillStyle = `rgb(${baseRgb[0]}, ${baseRgb[1]}, ${baseRgb[2]})`;
  ctx.fillRect(0, 0, size, size);

  bumpCtx.fillStyle = 'rgb(128, 128, 128)';
  bumpCtx.fillRect(0, 0, size, size);

  // Layered Venetian / microcement trowel clouds
  for (let i = 0; i < 360; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = (size / 512) * (24 + rand() * 115);
    const delta = (rand() - 0.5) * variance * 2;
    const cr = Math.min(255, Math.max(0, Math.round(baseRgb[0] + delta)));
    const cg = Math.min(255, Math.max(0, Math.round(baseRgb[1] + delta * 0.97)));
    const cb = Math.min(255, Math.max(0, Math.round(baseRgb[2] + delta * 0.92)));

    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, `rgba(${cr},${cg},${cb},0.20)`);
    grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    const bv = Math.min(255, Math.max(0, Math.round(128 + delta * 1.35)));
    const bGrad = bumpCtx.createRadialGradient(x, y, 2, x, y, r);
    bGrad.addColorStop(0, `rgba(${bv},${bv},${bv},0.22)`);
    bGrad.addColorStop(1, `rgba(${bv},${bv},${bv},0)`);
    bumpCtx.fillStyle = bGrad;
    bumpCtx.beginPath();
    bumpCtx.arc(x, y, r, 0, Math.PI * 2);
    bumpCtx.fill();
  }

  // Subtle trowel sweep strokes
  for (let i = 0; i < 95; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 60 + rand() * 180;
    const ang = rand() * Math.PI * 2;
    ctx.strokeStyle =
      rand() > 0.5 ? 'rgba(255,248,236,0.035)' : 'rgba(20,18,16,0.045)';
    ctx.lineWidth = 10 + rand() * 24;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(ang + 0.3) * len * 0.5,
      y + Math.sin(ang + 0.3) * len * 0.5,
      x + Math.cos(ang) * len,
      y + Math.sin(ang) * len
    );
    ctx.stroke();
  }

  // Fine mineral grain speckles
  for (let i = 0; i < 7500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const alpha = 0.025 + rand() * 0.055;
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,250,240,${alpha})` : `rgba(18,16,14,${alpha})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  return {
    map: configureTexture(canvas, repeatX, repeatY, true),
    bump: configureTexture(bumpCanvas, repeatX, repeatY, false),
  };
}

function generateWhiteOakTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 1024;
  const [canvas, ctx] = makeCanvas(size, size);
  const [bumpCanvas, bumpCtx] = makeCanvas(size, size);
  const rand = createSeededRandom(4021);

  ctx.fillStyle = '#b48a59';
  ctx.fillRect(0, 0, size, size);
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, size, size);

  const plankCount = 8;
  const plankH = size / plankCount;

  for (let p = 0; p < plankCount; p++) {
    const y0 = p * plankH;
    const toneShift = (rand() - 0.5) * 16;
    const r = Math.round(186 + toneShift);
    const g = Math.round(158 + toneShift * 0.8);
    const b = Math.round(126 + toneShift * 0.65);

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, y0, size, plankH);

    // Rich natural white oak grain fibers + occasional cathedral grain waves
    for (let s = 0; s < 95; s++) {
      const sy = y0 + rand() * plankH;
      const dark = rand() > 0.4;
      const alpha = 0.035 + rand() * 0.085;
      ctx.strokeStyle = dark
        ? `rgba(74, 46, 20, ${alpha})`
        : `rgba(232, 198, 148, ${alpha * 0.78})`;
      ctx.lineWidth = 0.8 + rand() * 2.4;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      const waveAmp = 1.5 + rand() * 5.2;
      const waveFreq = 0.005 + rand() * 0.012;
      const phase = rand() * Math.PI * 2;
      for (let x = 0; x <= size; x += 24) {
        ctx.lineTo(x, sy + Math.sin(x * waveFreq + phase) * waveAmp);
      }
      ctx.stroke();

      bumpCtx.strokeStyle = dark
        ? `rgba(92,92,92,${alpha * 1.35})`
        : `rgba(164,164,164,${alpha})`;
      bumpCtx.lineWidth = 1.2;
      bumpCtx.beginPath();
      bumpCtx.moveTo(0, sy);
      bumpCtx.lineTo(size, sy);
      bumpCtx.stroke();
    }

    // Subtle matte plank seam
    ctx.fillStyle = 'rgba(54, 34, 16, 0.24)';
    ctx.fillRect(0, y0, size, 1.8);
    const joint = ((p * 0.382 + 0.16) % 1) * size;
    ctx.fillStyle = 'rgba(58, 44, 35, 0.40)';
    ctx.fillRect(joint, y0 + 1, 1.6, plankH - 1);
    bumpCtx.fillStyle = 'rgba(42, 42, 42, 0.55)';
    bumpCtx.fillRect(0, y0, size, 2.2);
  }

  return {
    map: configureTexture(canvas, 2, 2, true),
    bump: configureTexture(bumpCanvas, 2, 2, false),
  };
}

function microcementMap(): THREE.CanvasTexture {
  const size = 512, [canvas, ctx] = makeCanvas(size, size), rand = createSeededRandom(303);
  const layers = [4, 12, 36].map(n => ({ n, noise: Array.from({ length: n * n }, rand) }));
  const sample = ({ n, noise }: typeof layers[number], x: number, y: number) => {
    const u = x * n / size, v = y * n / size, i = Math.floor(u), j = Math.floor(v);
    const s = THREE.MathUtils.smoothstep(u - i, 0, 1), t = THREE.MathUtils.smoothstep(v - j, 0, 1);
    const at = (a: number, b: number) => noise[(b % n) * n + a % n];
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(i, j), at(i + 1, j), s),
      THREE.MathUtils.lerp(at(i, j + 1), at(i + 1, j + 1), s), t) - 0.5;
  };
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, grey = 169 + 23 * sample(layers[0], x, y) +
      13 * sample(layers[1], x, y) + 7 * sample(layers[2], x, y) + (rand() - 0.5) * 9;
    image.data[i] = grey + 1; image.data[i + 1] = grey; image.data[i + 2] = grey - 1; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return configureTexture(canvas, 4, 4);
}

function generateTurfTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 1024;
  const [canvas, ctx] = makeCanvas(size, size);
  const [bumpCanvas, bumpCtx] = makeCanvas(size, size);
  const rand = createSeededRandom(8812);

  ctx.fillStyle = '#486345';
  ctx.fillRect(0, 0, size, size);
  bumpCtx.fillStyle = '#606060';
  bumpCtx.fillRect(0, 0, size, size);

  // Subtle checkerboard carpet-tile sheen (visible in real Antikode photos!)
  const tile = size / 4;
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      ctx.fillStyle =
        (tx + ty) % 2 === 0 ? 'rgba(92,126,56,0.11)' : 'rgba(28,44,20,0.09)';
      ctx.fillRect(tx * tile, ty * tile, tile, tile);
    }
  }

  // Dense multi-tone artificial grass fibers
  for (let i = 0; i < 65000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const v = rand();
    const nap = (Math.floor(x / tile) + Math.floor(y / tile)) % 2 ? 1 : -1;
    if (v < 0.34) {
      ctx.strokeStyle = 'rgba(40, 63, 39, 0.82)';
    } else if (v < 0.76) {
      ctx.strokeStyle = 'rgba(79, 108, 67, 0.80)';
    } else {
      ctx.strokeStyle = 'rgba(117, 143, 91, 0.65)';
    }
    const dx = (0.5 + rand() * 2.6) * nap, dy = 1.6 + rand() * 3.7;
    const w = 0.8 + rand() * 1.25;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y - dy);
    ctx.stroke();
    const bv = Math.round(90 + v * 110);
    bumpCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bumpCtx.fillRect(x, y, w, dy);
  }

  return {
    map: configureTexture(canvas, 5, 4, true),
    bump: configureTexture(bumpCanvas, 5, 4, false),
  };
}

function generateCeilingDeckTexture(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);

  ctx.fillStyle = '#8b8a85';
  ctx.fillRect(0, 0, size, size);

  const panelCount = 6;
  const step = size / panelCount;
  for (let i = 0; i < panelCount; i++) {
    const x = i * step;
    const grad = ctx.createLinearGradient(x, 0, x + step, 0);
    grad.addColorStop(0, '#6c6b66');
    grad.addColorStop(0.14, '#96948e');
    grad.addColorStop(0.5, '#a4a29c');
    grad.addColorStop(0.86, '#8d8b85');
    grad.addColorStop(1, '#666560');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, step, size);

    ctx.fillStyle = 'rgba(26,26,26,0.45)';
    ctx.fillRect(x, 0, 2, size);
  }

  return configureTexture(canvas, 6, 4, true);
}

function generateFabricTexture(baseHex: string, seed: number): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);
  const rand = createSeededRandom(seed);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  // Soft fabric mottling & woven linen texture
  for (let i = 0; i < 90; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 20 + rand() * 75;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, rand() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.045)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let y = 0; y < size; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.032)' : 'rgba(0,0,0,0.045)';
    ctx.fillRect(0, y, size, 1.4);
  }
  for (let x = 0; x < size; x += 3) {
    ctx.fillStyle = x % 6 === 0 ? 'rgba(255,255,255,0.024)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(x, 0, 1.4, size);
  }

  return configureTexture(canvas, 4, 4, true);
}

function generateAbstractPaintingTexture(seed: number): THREE.CanvasTexture {
  const size = 768;
  const [canvas, ctx] = makeCanvas(size, size);
  const rand = createSeededRandom(seed);

  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#1e243d');
  bg.addColorStop(0.5, '#333b60');
  bg.addColorStop(1, '#171c32');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Sculptural sweeping impasto palette-knife waves (Photos 1 & 2 left wall)
  for (let i = 0; i < 140; i++) {
    const startX = -80 + rand() * (size + 160);
    const startY = -80 + rand() * (size + 160);
    const cp1x = startX + (rand() - 0.3) * 320;
    const cp1y = startY + (rand() - 0.5) * 320;
    const endX = startX + 160 + rand() * 320;
    const endY = startY + (rand() - 0.5) * 300;

    const shade = rand();
    ctx.strokeStyle =
      shade < 0.35
        ? `rgba(12, 16, 30, ${0.48 + rand() * 0.35})`
        : shade < 0.72
          ? `rgba(82, 92, 144, ${0.38 + rand() * 0.35})`
          : `rgba(168, 176, 218, ${0.24 + rand() * 0.32})`;
    ctx.lineWidth = 4 + rand() * 20;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(cp1x, cp1y, endX, endY);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates the vibrant, expressive multi-color abstract canvas mounted on the
 * right concrete wall above the dark landing mat (visible in real photos).
 */
function generateRightWallAbstractArt(): THREE.CanvasTexture {
  const w = 1024;
  const h = 680;
  const [canvas, ctx] = makeCanvas(w, h);
  const rand = createSeededRandom(9201);

  // Warm cream/off-white raw canvas base with dark urban edge shading
  ctx.fillStyle = '#ece6da';
  ctx.fillRect(0, 0, w, h);

  // Dark expressive structural corner washes
  const cornerColors = [
    { x: 90, y: 580, r: 280, c: 'rgba(18, 20, 26, 0.85)' },
    { x: 930, y: 120, r: 260, c: 'rgba(16, 18, 24, 0.82)' },
    { x: 890, y: 560, r: 290, c: 'rgba(22, 24, 30, 0.78)' },
  ];
  for (const cc of cornerColors) {
    const g = ctx.createRadialGradient(cc.x, cc.y, 10, cc.x, cc.y, cc.r);
    g.addColorStop(0, cc.c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // Bold expressive color shapes (coral, golden yellow, cyan-blue, magenta, charcoal)
  const palette = [
    '#e8453c',
    '#f2c52c',
    '#2988c9',
    '#e45c8a',
    '#1b1d24',
    '#f5efe2',
    '#ea7e2b',
    '#3cb8b8',
  ];

  // Layered geometric & organic collage blocks
  for (let i = 0; i < 65; i++) {
    ctx.save();
    ctx.translate(80 + rand() * (w - 160), 60 + rand() * (h - 120));
    ctx.rotate((rand() - 0.5) * 1.8);
    ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
    ctx.globalAlpha = 0.45 + rand() * 0.5;
    if (rand() > 0.45) {
      ctx.fillRect(-40 - rand() * 90, -14 - rand() * 40, 80 + rand() * 180, 22 + rand() * 75);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 18 + rand() * 68, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Signature sweeping bold yellow & cyan kinetic arcs across center
  ctx.globalAlpha = 0.94;
  ctx.strokeStyle = '#f4c825';
  ctx.lineWidth = 26;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(220, 420);
  ctx.quadraticCurveTo(510, 140, 810, 290);
  ctx.stroke();

  ctx.strokeStyle = '#2588d0';
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.moveTo(140, 270);
  ctx.quadraticCurveTo(460, 460, 860, 190);
  ctx.stroke();

  ctx.strokeStyle = '#e53d38';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(260, 560);
  ctx.quadraticCurveTo(440, 320, 670, 120);
  ctx.stroke();

  // Dynamic paint splatters & thin ink gestures
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
    ctx.globalAlpha = 0.6 + rand() * 0.4;
    ctx.beginPath();
    ctx.arc(40 + rand() * (w - 80), 40 + rand() * (h - 80), 2 + rand() * 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle cream rectangular typography plaque in center-left (like real painting!)
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#f3eee4';
  ctx.fillRect(365, 315, 250, 46);
  ctx.fillStyle = '#333';
  ctx.globalAlpha = 0.55;
  ctx.fillRect(390, 336, 195, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates the crisp 3x3 modular LED video wall presentation slide ("A Glimpse of Antikode").
 */
function generateLedWallScreenTexture(): THREE.CanvasTexture {
  const w = 1536;
  const h = 640;
  const [canvas, ctx] = makeCanvas(w, h);

  // Deep obsidian-to-midnight studio gradient (exact vibe of Antikode photo!)
  const bg = ctx.createLinearGradient(0, h, w * 0.85, 0);
  bg.addColorStop(0, '#102944');
  bg.addColorStop(0.28, '#0c1522');
  bg.addColorStop(0.65, '#121316');
  bg.addColorStop(1, '#16171a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle soft blue radial glow bottom-left
  const glow = ctx.createRadialGradient(w * 0.14, h * 0.92, 10, w * 0.14, h * 0.92, 420);
  glow.addColorStop(0, 'rgba(38, 108, 175, 0.36)');
  glow.addColorStop(1, 'rgba(10, 14, 22, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Top small wordmark
  ctx.fillStyle = 'rgba(235, 238, 244, 0.85)';
  ctx.font = '600 18px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('A N T I K O D E', w * 0.5, 118);

  // Editorial serif hero headline
  ctx.fillStyle = '#f2f4f8';
  ctx.font = 'italic 400 34px Georgia, "Times New Roman", serif';
  ctx.fillText('A', w * 0.365, 286);

  ctx.font = '400 84px Georgia, "Times New Roman", serif';
  ctx.fillText('Glimpse', w * 0.495, 304);

  ctx.font = 'italic 400 36px Georgia, "Times New Roman", serif';
  ctx.fillText('of', w * 0.425, 370);

  ctx.font = '400 84px Georgia, "Times New Roman", serif';
  ctx.fillText('Antikode', w * 0.565, 388);

  // Subtle bottom corner caption
  ctx.fillStyle = 'rgba(210, 218, 228, 0.45)';
  ctx.font = '500 12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ANTIKODE PLAYGROUND · JAKARTA', 42, h - 26);
  ctx.textAlign = 'right';
  ctx.fillText('INTERACTIVE 3D REPLICA', w - 42, h - 26);

  // Crisp 3x3 modular LED video wall panel seams
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = 3;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo((w / 3) * i, 0);
    ctx.lineTo((w / 3) * i, h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, (h / 3) * i);
    ctx.lineTo(w, (h / 3) * i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function generateGalleryPrintTexture(variant: 'A' | 'B'): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);

  // Wide gallery white mat
  ctx.fillStyle = '#f2efe9';
  ctx.fillRect(0, 0, size, size);

  if (variant === 'A') {
    ctx.fillStyle = '#202630';
    ctx.fillRect(36, 36, size - 72, size - 72);
    ctx.fillStyle = '#d9a45b';
    ctx.beginPath();
    ctx.arc(128, 128, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2efe9';
    ctx.fillRect(62, 140, 132, 16);
  } else {
    ctx.fillStyle = '#181a1f';
    ctx.fillRect(34, 34, size - 68, size - 68);
    ctx.fillStyle = '#f0c93a';
    ctx.font = '800 32px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DESIGN', 128, 118);
    ctx.fillStyle = '#e8e5de';
    ctx.font = '600 22px Inter, sans-serif';
    ctx.fillText('PLAYGROUND', 128, 152);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function generateMezzanineTimelineTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 384;
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.clearRect(0, 0, w, h);

  // Subtle architectural glass timeline graphic (seen in photo 27612294!)
  ctx.strokeStyle = 'rgba(240, 244, 248, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 180);
  ctx.lineTo(w - 40, 180);
  ctx.stroke();

  ctx.fillStyle = 'rgba(240, 244, 248, 0.42)';
  ctx.font = '600 18px Inter, sans-serif';
  ctx.fillText('10 Years of Antikode', 52, 120);

  const years = ['2015', '2017', '2019', '2021', '2023', '2025'];
  years.forEach((yr, i) => {
    const x = 140 + i * 145;
    ctx.beginPath();
    ctx.arc(x, 180, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeRect(x - 28, 112, 56, 38);
    ctx.font = '500 13px Inter, sans-serif';
    ctx.fillText(yr, x - 14, 206);
    ctx.fillRect(x - 26, 220, 62, 4);
    ctx.fillRect(x - 26, 232, 46, 3);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function generateExteriorBackdrop(isDay: boolean): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const [canvas, ctx] = makeCanvas(w, h);
  const rand = createSeededRandom(isDay ? 511 : 512);

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  if (isDay) {
    sky.addColorStop(0, '#a6ccf0');
    sky.addColorStop(0.55, '#d8ebfa');
    sky.addColorStop(1, '#eef5fa');
  } else {
    sky.addColorStop(0, '#070e1c');
    sky.addColorStop(0.65, '#0e1b30');
    sky.addColorStop(1, '#162033');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Subtle distant building rooflines (Jakarta neighborhood skyline seen outside window)
  ctx.fillStyle = isDay ? '#8c9eb0' : '#0b1220';
  for (let i = 0; i < 14; i++) {
    const bx = i * 82 - 20;
    const bw = 58 + rand() * 44;
    const bh = 70 + rand() * 85;
    ctx.fillRect(bx, h - bh, bw, bh);
  }

  // Tropical tree canopy silhouettes outside the clerestory windows
  for (let i = 0; i < 28; i++) {
    const tx = rand() * w;
    const ty = h - 45 - rand() * 145;
    const tr = 42 + rand() * 68;
    ctx.fillStyle = isDay
      ? `rgba(${68 + Math.round(rand() * 24)}, ${96 + Math.round(rand() * 26)}, ${78 + Math.round(rand() * 22)}, 0.72)`
      : `rgba(8, 16, 24, 0.88)`;
    ctx.beginPath();
    ctx.arc(tx, ty, tr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tiny warm distant night window lights in night mode
  if (!isDay) {
    for (let i = 0; i < 36; i++) {
      ctx.fillStyle = 'rgba(255, 212, 138, 0.45)';
      ctx.fillRect(rand() * w, h - 20 - rand() * 90, 4, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// A garden at eye level, rather than the roofline seen through the hall clerestory.
function gardenView(day: boolean): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(1024, 512);
  const rand = createSeededRandom(823);
  const sky = ctx.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, day ? '#bccacc' : '#243346');
  sky.addColorStop(0.66, day ? '#e2e4d9' : '#526172');
  sky.addColorStop(1, day ? '#a4aa93' : '#414b4d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = day ? '#a6aa9d' : '#343f46';
  ctx.fillRect(0, 342, 1024, 170);
  for (let i = 0; i < 14; i++) {
    const y = 290 + rand() * 60;
    ctx.fillStyle = day ? '#a8aba4' : '#39424d';
    ctx.fillRect(i * 80 - 18, y, 74 + rand() * 50, 55);
    ctx.fillStyle = day ? '#bfc2b8' : '#505963';
    ctx.fillRect(i * 80 - 21, y - 4, 100, 5);
  }

  const leaves = day ? ['#687761', '#758368', '#849073', '#929c82'] : ['#202e35', '#27373b', '#304143', '#374949'];
  function branch(x: number, y: number, length: number, angle: number, level: number) {
    const tx = x + Math.sin(angle) * length, ty = y - Math.cos(angle) * length;
    ctx.strokeStyle = day ? '#62685a' : '#28343a';
    ctx.lineWidth = 0.55 + level * level * 0.21;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
    if (level > 0) {
      branch(tx, ty, length * (0.6 + rand() * 0.2), angle - 0.2 - rand() * 0.58, level - 1);
      branch(tx, ty, length * (0.6 + rand() * 0.2), angle + 0.2 + rand() * 0.58, level - 1);
    } else {
      for (let i = 0; i < 75; i++) {
        const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * length * 1.5;
        ctx.fillStyle = leaves[Math.floor(rand() * leaves.length)];
        ctx.beginPath();
        ctx.ellipse(tx + Math.cos(a) * r, ty + Math.sin(a) * r * 0.72, 1.4 + rand() * 4, 1 + rand() * 2.5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  for (let i = 0; i < 9; i++) branch(i * 144 - 42, 415, 59 + rand() * 63, (rand() - 0.5) * 0.4, 5);
  ctx.fillStyle = day ? '#65705a' : '#293434';
  ctx.fillRect(0, 399, 1024, 113);
  for (let i = 0; i < 18000; i++) {
    const x = rand() * 1024, y = 388 + 6 * Math.sin(x * 0.017) + rand() * 128;
    ctx.fillStyle = leaves[i % leaves.length];
    ctx.globalAlpha = 0.28 + rand() * 0.35;
    ctx.beginPath(); ctx.ellipse(x, y, 1 + rand() * 2.7, 0.6 + rand() * 1.5, rand() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function getProceduralTextures(): ProceduralTextureSet {
  if (cachedTextures) return cachedTextures;

  const concrete = generatePlasterTextures([148, 143, 134], 24, 101, 3, 2, 1024);
  const darkPlaster = generatePlasterTextures([56, 55, 54], 16, 202, 3, 2, 1024);
  const oak = generateWhiteOakTextures();
  const turf = generateTurfTextures();

  cachedTextures = {
    contactMap: contactMap(),
    concreteMap: concrete.map,
    concreteBump: concrete.bump,
    darkPlasterMap: darkPlaster.map,
    darkPlasterBump: darkPlaster.bump,
    polishedFloorMap: microcementMap(),
    oakMap: oak.map,
    oakBump: oak.bump,
    turfMap: turf.map,
    turfBump: turf.bump,
    ceilingDeckMap: generateCeilingDeckTexture(),
    fabricMap: generateFabricTexture('#3b3c40', 505),
    beanbagFabricMap: generateFabricTexture('#d2cec8', 525),
    carpetMap: generateFabricTexture('#2c2d31', 606),
    paintingLeftMap: generateAbstractPaintingTexture(701),
    paintingRightMap: generateAbstractPaintingTexture(709),
    rightWallArtMap: generateRightWallAbstractArt(),
    ledWallScreenMap: generateLedWallScreenTexture(),
    galleryPrintAMap: generateGalleryPrintTexture('A'),
    galleryPrintBMap: generateGalleryPrintTexture('B'),
    mezzanineTimelineMap: generateMezzanineTimelineTexture(),
    exteriorDayMap: generateExteriorBackdrop(true),
    exteriorNightMap: generateExteriorBackdrop(false),
    gardenDayMap: gardenView(true),
    gardenNightMap: gardenView(false),
  };

  return cachedTextures;
}
