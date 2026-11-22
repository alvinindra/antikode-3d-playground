import * as THREE from 'three';
import { getProceduralTextures } from './textures';

export interface SceneMaterials {
  concreteWall: THREE.MeshStandardMaterial;
  concreteFloor: THREE.MeshStandardMaterial;
  darkPlaster: THREE.MeshStandardMaterial;
  whiteOak: THREE.MeshStandardMaterial;
  whiteOakDark: THREE.MeshStandardMaterial;
  turf: THREE.MeshStandardMaterial;
  blackSteel: THREE.MeshStandardMaterial;
  brushedMetal: THREE.MeshStandardMaterial;
  ceilingDeck: THREE.MeshStandardMaterial;
  matteScreen: THREE.MeshStandardMaterial;
  ledWallActive: THREE.MeshStandardMaterial;
  darkDoor: THREE.MeshStandardMaterial;
  darkFabric: THREE.MeshStandardMaterial;
  beanbagGrey: THREE.MeshStandardMaterial;
  beanbagTaupe: THREE.MeshStandardMaterial;
  beanbagEspresso: THREE.MeshStandardMaterial;
  seamThread: THREE.MeshStandardMaterial;
  contactShade: THREE.MeshBasicMaterial;
  mezzanineCarpet: THREE.MeshStandardMaterial;
  glassRailing: THREE.MeshStandardMaterial;
  windowGlass: THREE.MeshStandardMaterial;
  mezzanineTimelineGlass: THREE.MeshBasicMaterial;
  warmLed: THREE.MeshBasicMaterial;
  treadLed: THREE.MeshBasicMaterial;
  coolLinearLed: THREE.MeshBasicMaterial;
  spotLens: THREE.MeshBasicMaterial;
  lampBulb: THREE.MeshStandardMaterial;
  redSaberGlow: THREE.MeshBasicMaterial;
  foliage: THREE.MeshStandardMaterial;
  foliageLight: THREE.MeshStandardMaterial;
  eucalyptusLeaf: THREE.MeshStandardMaterial;
  ceramicCream: THREE.MeshStandardMaterial;
  ceramicCharcoal: THREE.MeshStandardMaterial;
  ceramicCobalt: THREE.MeshStandardMaterial;
  paintingLeft: THREE.MeshStandardMaterial;
  paintingRight: THREE.MeshStandardMaterial;
  rightWallArt: THREE.MeshStandardMaterial;
  galleryPrintA: THREE.MeshStandardMaterial;
  galleryPrintB: THREE.MeshStandardMaterial;
  exteriorDay: THREE.MeshBasicMaterial;
  exteriorNight: THREE.MeshBasicMaterial;
  gardenDay: THREE.MeshBasicMaterial;
  gardenNight: THREE.MeshBasicMaterial;
  entryGlass: THREE.MeshStandardMaterial;
  entryPlaster: THREE.MeshStandardMaterial;
  entryConcrete: THREE.MeshStandardMaterial;
  loungeCarpet: THREE.MeshStandardMaterial;
  bentOak: THREE.MeshStandardMaterial;
}

let cachedMaterials: SceneMaterials | null = null;

export function getSceneMaterials(): SceneMaterials {
  if (cachedMaterials) return cachedMaterials;

  const tex = getProceduralTextures();
  // The furniture is moulded from a single veneer, not a grid of floorboards.
  const veneer = tex.oakMap.clone();
  veneer.repeat.set(0.8, 0.07);
  veneer.offset.set(0.03, 0.15);

  cachedMaterials = {
    concreteWall: new THREE.MeshStandardMaterial({
      map: tex.concreteMap,
      bumpMap: tex.concreteBump,
      bumpScale: 0.018,
      roughness: 0.86,
      metalness: 0.04,
      color: '#d4cec4',
    }),
    concreteFloor: new THREE.MeshStandardMaterial({
      map: tex.polishedFloorMap,
      roughness: 0.63,
      metalness: 0.02,
      color: '#d1d2cf',
    }),
    darkPlaster: new THREE.MeshStandardMaterial({
      map: tex.darkPlasterMap,
      bumpMap: tex.darkPlasterBump,
      bumpScale: 0.022,
      roughness: 0.84,
      metalness: 0.06,
      color: '#5a5958',
    }),
    whiteOak: new THREE.MeshStandardMaterial({
      map: tex.oakMap,
      bumpMap: tex.oakBump,
      bumpScale: 0.012,
      roughness: 0.68,
      metalness: 0.02,
      color: '#f1e6d7',
    }),
    whiteOakDark: new THREE.MeshStandardMaterial({
      map: tex.oakMap,
      bumpMap: tex.oakBump,
      bumpScale: 0.012,
      roughness: 0.74,
      metalness: 0.02,
      color: '#d7c5b3',
    }),
    turf: new THREE.MeshStandardMaterial({
      map: tex.turfMap,
      bumpMap: tex.turfBump,
      bumpScale: 0.012,
      roughness: 0.96,
      metalness: 0.0,
      color: '#d0ddc7',
    }),
    blackSteel: new THREE.MeshStandardMaterial({
      color: '#191a1d',
      roughness: 0.42,
      metalness: 0.78,
    }),
    brushedMetal: new THREE.MeshStandardMaterial({
      color: '#6f747d',
      roughness: 0.34,
      metalness: 0.85,
    }),
    ceilingDeck: new THREE.MeshStandardMaterial({
      map: tex.ceilingDeckMap,
      roughness: 0.72,
      metalness: 0.25,
      color: '#a8a59e',
    }),
    matteScreen: new THREE.MeshStandardMaterial({
      color: '#161515',
      roughness: 0.78,
      metalness: 0.12,
    }),
    ledWallActive: new THREE.MeshStandardMaterial({
      map: tex.ledWallScreenMap,
      emissiveMap: tex.ledWallScreenMap,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.62,
      roughness: 0.48,
      metalness: 0.1,
    }),
    darkDoor: new THREE.MeshStandardMaterial({
      color: '#242324',
      roughness: 0.65,
      metalness: 0.1,
    }),
    darkFabric: new THREE.MeshStandardMaterial({
      map: tex.fabricMap,
      roughness: 0.92,
      metalness: 0.0,
      color: '#46464b',
    }),
    beanbagGrey: new THREE.MeshStandardMaterial({
      map: tex.beanbagFabricMap,
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.0,
      color: '#8c9092',
    }),
    beanbagTaupe: new THREE.MeshStandardMaterial({
      map: tex.beanbagFabricMap,
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.0,
      color: '#a49a8d',
    }),
    beanbagEspresso: new THREE.MeshStandardMaterial({
      map: tex.beanbagFabricMap,
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.0,
      color: '#776457',
    }),
    seamThread: new THREE.MeshStandardMaterial({ color: '#685e54', roughness: 0.96 }),
    contactShade: new THREE.MeshBasicMaterial({
      map: tex.contactMap, transparent: true, depthWrite: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -1,
    }),
    mezzanineCarpet: new THREE.MeshStandardMaterial({
      map: tex.carpetMap,
      roughness: 0.94,
      metalness: 0.0,
      color: '#34363b',
    }),
    glassRailing: new THREE.MeshStandardMaterial({
      color: '#9bb4c4',
      transparent: true,
      opacity: 0.17,
      roughness: 0.45,
      metalness: 0.15,
      depthWrite: false,
    }),
    windowGlass: new THREE.MeshStandardMaterial({
      color: '#1b2b42',
      transparent: true,
      opacity: 0.22,
      roughness: 0.42,
      metalness: 0.12,
      depthWrite: false,
    }),
    mezzanineTimelineGlass: new THREE.MeshBasicMaterial({
      map: tex.mezzanineTimelineMap,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
    // Selective bloom emissive materials (RGB > 1 with toneMapped: false)
    warmLed: new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.35, 1.52, 0.72),
      toneMapped: false,
    }),
    treadLed: new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.5, 0.92, 0.44),
      toneMapped: false,
    }),
    coolLinearLed: new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.05, 2.0, 1.86),
      toneMapped: false,
    }),
    spotLens: new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.75, 2.3, 1.6),
      toneMapped: false,
    }),
    lampBulb: new THREE.MeshStandardMaterial({ color: '#e8d7b7', emissive: '#ffd5a3',
      emissiveIntensity: 0.56, roughness: 0.72 }),
    redSaberGlow: new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.4, 0.28, 0.22),
      toneMapped: false,
    }),
    foliage: new THREE.MeshStandardMaterial({
      color: '#2d4e27',
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
    foliageLight: new THREE.MeshStandardMaterial({
      color: '#436c35',
      roughness: 0.68,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
    eucalyptusLeaf: new THREE.MeshStandardMaterial({
      color: '#5b7862',
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
    ceramicCream: new THREE.MeshStandardMaterial({
      color: '#e0d8ca',
      roughness: 0.5,
      metalness: 0.04,
    }),
    ceramicCharcoal: new THREE.MeshStandardMaterial({
      color: '#26272b',
      roughness: 0.55,
      metalness: 0.1,
    }),
    ceramicCobalt: new THREE.MeshStandardMaterial({
      color: '#2c4668',
      roughness: 0.36,
      metalness: 0.08,
    }),
    paintingLeft: new THREE.MeshStandardMaterial({
      map: tex.paintingLeftMap,
      roughness: 0.68,
      metalness: 0.05,
    }),
    paintingRight: new THREE.MeshStandardMaterial({
      map: tex.paintingRightMap,
      roughness: 0.68,
      metalness: 0.05,
    }),
    rightWallArt: new THREE.MeshStandardMaterial({
      map: tex.rightWallArtMap,
      roughness: 0.64,
      metalness: 0.03,
    }),
    galleryPrintA: new THREE.MeshStandardMaterial({
      map: tex.galleryPrintAMap,
      roughness: 0.58,
      metalness: 0.02,
    }),
    galleryPrintB: new THREE.MeshStandardMaterial({
      map: tex.galleryPrintBMap,
      roughness: 0.58,
      metalness: 0.02,
    }),
    exteriorDay: new THREE.MeshBasicMaterial({
      map: tex.exteriorDayMap,
    }),
    exteriorNight: new THREE.MeshBasicMaterial({
      map: tex.exteriorNightMap,
    }),
    gardenDay: new THREE.MeshBasicMaterial({ map: tex.gardenDayMap }),
    gardenNight: new THREE.MeshBasicMaterial({ map: tex.gardenNightMap, color: '#99adc5' }),
    entryGlass: new THREE.MeshPhysicalMaterial({
      color: '#b6c7be', transparent: true, opacity: 0.10, roughness: 0.22,
      metalness: 0, specularIntensity: 0.32, depthWrite: false,
    }),
    entryPlaster: new THREE.MeshStandardMaterial({
      map: tex.polishedFloorMap, color: '#777c81', roughness: 0.9,
    }),
    entryConcrete: new THREE.MeshStandardMaterial({
      map: tex.polishedFloorMap, color: '#ccc7be', roughness: 0.9,
    }),
    loungeCarpet: new THREE.MeshStandardMaterial({ map: tex.beanbagFabricMap, color: '#484949', roughness: 1 }),
    bentOak: new THREE.MeshStandardMaterial({ map: veneer, color: '#f2d4a6', roughness: 0.49 }),
  };

  return cachedMaterials;
}
