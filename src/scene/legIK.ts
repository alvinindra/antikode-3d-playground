import { MathUtils, Object3D, Quaternion, Vector3 } from 'three';

// Solve in world space so the same leg works on the unscaled bake rig and on the live avatar.
export function makeLegSolver(thigh: Object3D, shin: Object3D, foot: Object3D) {
  const h = new Vector3(), k = new Vector3(), a = new Vector3(), direction = new Vector3(), bend = new Vector3();
  const from = new Vector3(), to = new Vector3(), world = new Quaternion(), parent = new Quaternion();
  function aim(b: Object3D, origin: Vector3, oldEnd: Vector3, newEnd: Vector3) {
    world.setFromUnitVectors(from.subVectors(oldEnd, origin).normalize(), to.subVectors(newEnd, origin).normalize())
      .multiply(b.getWorldQuaternion(parent));
    b.quaternion.copy(b.parent!.getWorldQuaternion(parent).invert().multiply(world));
  }
  return (target: Vector3, rotation: Quaternion, pole: Vector3, softReach = 0) => {
    thigh.getWorldPosition(h); shin.getWorldPosition(k); foot.getWorldPosition(a);
    const upper = h.distanceTo(k), lower = k.distanceTo(a);
    direction.subVectors(target, h);
    const maximum = upper + lower - 0.001;
    const distance = direction.length();
    let reach = MathUtils.clamp(distance, Math.abs(upper - lower) + 0.001, maximum);
    if (softReach > 0 && distance > maximum - softReach) {
      reach = maximum - softReach * Math.exp(-(distance - maximum + softReach) / softReach);
      const horizontal = direction.x ** 2 + direction.z ** 2;
      if (direction.y < 0 && horizontal < reach * reach) direction.y = -Math.sqrt(reach * reach - horizontal);
    }
    direction.normalize();
    const along = (upper * upper + reach * reach - lower * lower) / (2 * reach);
    bend.copy(pole).projectOnPlane(direction).normalize().multiplyScalar(Math.sqrt(Math.max(0, upper * upper - along * along)))
      .add(h).addScaledVector(direction, along);
    aim(thigh, h, k, bend);
    shin.getWorldPosition(k); foot.getWorldPosition(a);
    bend.copy(h).addScaledVector(direction, reach);
    aim(shin, k, a, bend);
    foot.quaternion.copy(shin.getWorldQuaternion(parent).invert().multiply(rotation));
  };
}
