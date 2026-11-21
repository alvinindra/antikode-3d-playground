import * as THREE from 'three';
import { getWalkableFloorY } from './layout.ts';

// These are extremal vertices of the actual trousers and shoes, selected when baking the GLB.
export function createSeatContact(model: THREE.Object3D) {
  const { seat, soles } = model.userData.contacts as { seat: number[]; soles: number[] };
  const parts = [
    { mesh: model.getObjectByName('Wolf3D_Outfit_Footwear') as THREE.SkinnedMesh, indices: soles },
    { mesh: model.getObjectByName('Wolf3D_Outfit_Bottom') as THREE.SkinnedMesh, indices: seat },
  ];
  const v = new THREE.Vector3(), q = new THREE.Quaternion();
  return (player: THREE.Object3D) => {
    player.updateMatrixWorld(true);
    let gap = Infinity;
    for (const { mesh, indices } of parts) {
      for (const i of indices) {
        mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
        const ground = getWalkableFloorY(v.x, v.z, player.position.y);
        gap = Math.min(gap, v.y - ground);
      }
    }
    model.position.add(v.set(0, -gap, 0).applyQuaternion(q.copy(player.quaternion).invert()));
  };
}
