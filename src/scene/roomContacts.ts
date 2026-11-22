import { Box3, Group, InstancedMesh, Matrix4, Mesh, Object3D, Triangle, Vector3 } from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import { getTierTopY, SOLID_OBSTACLES } from './layout.ts';

// Standing envelope includes the shoulders and shoes, not just the pelvis.
export const BODY_RADIUS = 0.38, BODY_HEIGHT = 1.80;
const SKIN = 0.005, CELL = 2;
type Solid = { bounds: Box3; box: OBB; seat?: string; faces?: Triangle[]; round?: {x: number; z: number; radius: number} };

export function outsideWalkableVolume(x: number, y: number, z: number): boolean {
  for (const box of SOLID_OBSTACLES) {
    if (x + BODY_RADIUS > box.minX && x - BODY_RADIUS < box.maxX &&
      z + BODY_RADIUS > box.minZ && z - BODY_RADIUS < box.maxZ && y + BODY_HEIGHT > box.minY &&
      y + 0.15 < (box.beneathTiers ? Math.min(box.maxY, getTierTopY(z)) : box.maxY)) return true;
  }
  return false;
}

/** Bake only the static room. Walkable profiles and scripted seat contacts have their own solver. */
export function buildRoomContacts(root: Group) {
  const buckets = new Map<number, Solid[]>();
  const key = (x: number, z: number) => x * 65536 + z;
  const coord = (v: number) => Math.floor(v / CELL);
  root.updateWorldMatrix(true, true);
  function add(mesh: Mesh, matrix: Matrix4, seat?: string) {
    const g = mesh.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const local = g.boundingBox!;
    if (local.isEmpty()) return;
    const bounds = local.clone().applyMatrix4(matrix);
    const box = new OBB().fromBox3(local).applyMatrix4(matrix);
    local.getCenter(box.center).applyMatrix4(matrix);
    const solid: Solid = { bounds, box, seat };
    if (mesh.userData.collision === 'round') {
      const p = new Vector3(), origin = new Vector3().setFromMatrixPosition(matrix);
      let radius = 0;
      for (let i=0; i<g.attributes.position.count; i++) {
        p.fromBufferAttribute(g.attributes.position,i).applyMatrix4(matrix);
        radius = Math.max(radius, Math.hypot(p.x-origin.x,p.z-origin.z));
      }
      solid.round = {x: origin.x, z: origin.z, radius};
    }
    // A bounding box would fill the triangular opening, or the air above a chute cheek.
    if (mesh.userData.collision === 'faces') {
      const pos = g.attributes.position, index = g.index;
      const vertex = (i: number) => new Vector3().fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(matrix);
      solid.faces = [];
      for (let i = 0; i < (index?.count ?? pos.count); i += 3)
        solid.faces.push(new Triangle(vertex(i), vertex(i + 1), vertex(i + 2)));
    }
    for (let x = coord(bounds.min.x); x <= coord(bounds.max.x); x++)
      for (let z = coord(bounds.min.z); z <= coord(bounds.max.z); z++) {
        const k = key(x, z), bucket = buckets.get(k);
        if (bucket) bucket.push(solid); else buckets.set(k, [solid]);
      }
  }
  const local = new Matrix4(), world = new Matrix4();
  function visit(obj: Object3D, seat?: string) {
    if (obj.userData.collision === 'terrain') return;
    if (/^(beanbag-|gallery-chair-)/.test(obj.name)) seat = obj.name;
    if (obj.userData.seat) seat = obj.userData.seat;
    if (obj instanceof InstancedMesh) {
      for (let i = 0; i < obj.count; i++) {
        obj.getMatrixAt(i, local); add(obj, world.multiplyMatrices(obj.matrixWorld, local), seat);
      }
    } else if (obj instanceof Mesh) add(obj, obj.matrixWorld, seat);
    for (const child of obj.children) visit(child, seat);
  }
  visit(root);
  const body = new Box3();
  function blocked(x: number, y: number, z: number, ignoreSeat?: string, height = BODY_HEIGHT,
    halfX = BODY_RADIUS, halfZ = BODY_RADIUS) {
    body.min.set(x - halfX, y + SKIN, z - halfZ);
    body.max.set(x + halfX, y + height, z + halfZ);
    // Statics are in every cell they touch. No scene traversal or allocations per probe.
    for (let i = coord(body.min.x); i <= coord(body.max.x); i++)
      for (let j = coord(body.min.z); j <= coord(body.max.z); j++) {
        const bucket = buckets.get(key(i,j));
        if (!bucket) continue;
        for (const solid of bucket) {
          if (ignoreSeat && solid.seat === ignoreSeat) continue;
          const b = solid.bounds;
          if (!body.intersectsBox(b)) continue;
          const dx = Math.max(0, b.min.x-x, x-b.max.x), dz = Math.max(0, b.min.z-z, z-b.max.z);
          if (dx*dx/(halfX*halfX) + dz*dz/(halfZ*halfZ) > 1 || !solid.box.intersectsBox3(body)) continue;
          if (solid.round && Math.hypot(x-solid.round.x,z-solid.round.z) > solid.round.radius+Math.max(halfX,halfZ)) continue;
          if (!solid.faces) return true;
          for (const face of solid.faces) if (body.intersectsTriangle(face)) return true;
        }
      }
    return false;
  }
  function vertical(x: number, z: number, from: number, to: number) {
    // Stop at the first contact, even if an entire thin shelf fits between frames.
    const steps = Math.ceil(Math.abs(to - from) / 0.12);
    let clear = from;
    for (let i = 1; i <= steps; i++) {
      let hit = from + (to - from) * i / steps;
      if (blocked(x, hit, z)) {
        for (let j = 0; j < 9; j++) {
          const mid = (clear + hit) / 2;
          if (blocked(x, mid, z)) hit = mid; else clear = mid;
        }
        return clear;
      }
      clear = hit;
    }
    return to;
  }
  function clearApproach(from: Vector3, to: {x: number; y: number; z: number}, seat?: string) {
    const dx = to.x-from.x, dy = to.y-from.y, dz = to.z-from.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx,dy,dz)/0.09));
    for (let i=1; i<=steps; i++) {
      const t = i/steps;
      const tuck = seat ? t : 0, radius = BODY_RADIUS - 0.10*tuck;
      if (blocked(from.x+dx*t, from.y+dy*t, from.z+dz*t, seat, BODY_HEIGHT-0.86*tuck, radius, radius)) return false;
    }
    return true;
  }
  function strideWeight(p: Vector3, yaw: number) {
    // The baked running shoe can reach 0.75 m in front of or behind the root.
    const dx = 0.40*Math.sin(yaw), dz = 0.40*Math.cos(yaw);
    for (let t=1; t>0; t-=0.25) {
      if (!blocked(p.x+dx*t,p.y,p.z+dz*t) && !blocked(p.x-dx*t,p.y,p.z-dz*t)) return t;
    }
    return 0;
  }
  return { blocked, vertical, clearApproach, strideWeight };
}
