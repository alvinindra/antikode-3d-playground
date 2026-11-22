import { Bone, MathUtils, Matrix4, Object3D, Quaternion, SkinnedMesh, Vector3 } from 'three';
import { getTreadSupportY, getWalkableFloorY, nextRiserZ, standingFootZ, ROOM } from './layout.ts';
import { makeLegSolver } from './legIK.ts';
import { stairFootfall } from './stairStride.ts';

export function createTreadFooting(model: Object3D, scale: number) {
  const shoes = model.getObjectByName('Wolf3D_Outfit_Footwear') as SkinnedMesh;
  const hips = model.getObjectByName('Hips')!, spine = model.getObjectByName('Spine1')!;
  const bind = (b: Object3D) => new Matrix4().copy(shoes.skeleton.boneInverses[shoes.skeleton.bones.indexOf(b as Bone)]).invert();
  const restHeight = new Vector3().setFromMatrixPosition(bind(hips)).y * scale;
  const legs = ['Left', 'Right'].map((side, i) => {
    const [thigh, shin, foot, toe] = ['UpLeg', 'Leg', 'Foot', 'ToeBase'].map(n => model.getObjectByName(side + n)!);
    const matrix = bind(foot), origin = new Vector3().setFromMatrixPosition(matrix);
    const sole: Vector3[] = [];
    const attr = shoes.geometry.attributes.position, sign = i ? -1 : 1;
    const vertices = Array.from({length: attr.count}, (_, j) => j).filter(j => sign * attr.getX(j) > 0);
    for (const j of model.userData.contacts.soles as number[]) if (sign * attr.getX(j) > 0) {
      sole.push(new Vector3().fromBufferAttribute(attr, j).applyMatrix4(shoes.bindMatrix).sub(origin).multiplyScalar(scale));
    }
    const midSole = (Math.max(...sole.map(p => p.z)) + Math.min(...sole.map(p => p.z))) / 2;
    const heightAt = (angle: number) => {
      const s = Math.sin(angle), c = Math.cos(angle);
      let height = -Infinity;
      for (const point of sole) height = Math.max(height, point.z * s - point.y * c);
      return height;
    };
    const roll = Array.from({ length: 21 }, (_, j) => heightAt(0.04 * j));
    const length = (shin.position.length() + foot.position.length()) * scale;
    return { thigh, shin, foot, toe, sign, sole, vertices, heightAt, roll, length, midSole, bindRotation: new Quaternion().setFromRotationMatrix(matrix),
      restToe: toe.quaternion.clone(), solve: makeLegSolver(thigh, shin, foot),
      bones: [thigh, shin, foot, toe], saved: Array.from({length: 4}, () => new Quaternion()),
      rotation: new Quaternion(), goal: new Vector3(), captured: new Vector3(), idle: new Vector3(), last: new Vector3(), ready: false };
  });
  const hip = new Vector3(), at = new Vector3(), forward = new Vector3(), right = new Vector3(), pole = new Vector3();
  const quaternion = new Quaternion(), parent = new Quaternion(), spinePose = new Quaternion(), xAxis = new Vector3(1, 0, 0);
  const previous = new Vector3(), travelAxis = new Vector3();
  let adjusted = false, tracking = false, effort = 0, idleFloor = 0, idleOffset = 0, idleVelocity = 0;
  function levelFeet(player: Object3D, load: number) {
    player.updateMatrixWorld(true);
    const gaps = [Infinity, Infinity], attr = shoes.geometry.attributes.position;
    for (const j of model.userData.contacts.soles as number[]) {
      const i = attr.getX(j) > 0 ? 0 : 1;
      shoes.getVertexPosition(j, at).applyMatrix4(shoes.matrixWorld);
      const floor = getWalkableFloorY(at.x, at.z, player.position.y);
      const plane = Math.abs(floor - player.position.y) <= ROOM.turfY + 0.0001 ? floor : player.position.y;
      gaps[i] = Math.min(gaps[i], at.y - plane);
    }
    const gap = Math.min(...gaps), dy = MathUtils.clamp(-gap * (gap > 0 ? load : 1), -0.085, 0.085);
    if (Math.abs(dy) < 0.00015) return;
    adjusted = true;
    spinePose.copy(spine.quaternion);
    for (const [i, leg] of legs.entries()) {
      leg.bones.forEach((b, i) => leg.saved[i].copy(b.quaternion));
      leg.thigh.getWorldPosition(hip); leg.shin.getWorldPosition(pole); leg.foot.getWorldPosition(leg.goal);
      pole.sub(hip).projectOnPlane(at.subVectors(leg.goal, hip).normalize());
      if (pole.lengthSq() < 0.00001) player.getWorldDirection(pole);
      const correction = dy < 0 ? dy * (1 - MathUtils.smoothstep(gaps[i]-gap, 0.01, 0.05)) : Math.max(0, -gaps[i]);
      leg.goal.y += correction;
      leg.solve(leg.goal, leg.foot.getWorldQuaternion(leg.rotation), pole);
    }
  }
  return {
    restore() {
      model.position.set(0, 0, 0);
      if (!adjusted) return;
      spine.quaternion.copy(spinePose);
      for (const leg of legs) leg.bones.forEach((b, i) => b.quaternion.copy(leg.saved[i]));
      adjusted = false;
    },
    fit(player: Object3D, terrain: number, phase: number, moving: number, dt: number, levelLoad = 1) {
      if (terrain <= 0.001) {
        idleVelocity = idleOffset = effort = 0;
        tracking = false;
        for (const leg of legs) leg.ready = false;
        if (levelLoad >= 0) levelFeet(player, levelLoad);
        return;
      }
      adjusted = true;
      const p = player.position;
      player.getWorldDirection(forward); right.set(forward.z, 0, -forward.x);
      const starting = !tracking;
      if (starting) { previous.copy(p); travelAxis.copy(forward); tracking = true; }
      at.subVectors(p, previous); at.y = 0; previous.copy(p);
      const distance = at.length();
      if (distance > 0.00001) {
        at.divideScalar(distance);
        // A reversal along Z is still the same line of steps. Do not switch to
        // a sideways gait just because the shoulders rotate through 90 degrees.
        if (at.dot(travelAxis) < 0) at.negate();
        travelAxis.lerp(at, 1 - Math.exp(-10 * dt)).normalize();
      }
      const speed = distance / Math.max(dt, 0.0001);
      effort = MathUtils.damp(effort, moving * MathUtils.smoothstep(speed, 0.02, 0.75), 12, dt);
      moving = effort;
      const axial = MathUtils.smoothstep(Math.abs(travelAxis.z), 0.48, 0.88);
      const transfer = 0.035 + 0.055 * Math.max(0, -forward.z);
      const base = getTreadSupportY(p.x, p.z - transfer * axial, ROOM.mezzanineY, 0.40);
      const parking = starting || speed < 0.09 || moving > 0.975;
      if (parking) idleFloor = getWalkableFloorY(p.x, p.z, ROOM.mezzanineY);
      const parkedHeight = (idleFloor - base) * (1 - moving);
      const error = idleOffset - parkedHeight, impulse = idleVelocity + 11 * error, decay = Math.exp(-11 * dt);
      idleOffset = parkedHeight + (error + impulse * dt) * decay;
      idleVelocity = (idleVelocity - 11 * impulse * dt) * decay;
      // The body follows the transfer of weight, never the lowest vertex of a swinging shoe.
      const body = base + idleOffset + restHeight - 0.012 - 0.020 * moving;
      hips.getWorldPosition(hip);
      const dy = (body - hip.y) * terrain;
      for (const [i, leg] of legs.entries()) {
        leg.bones.forEach((b, n) => leg.saved[n].copy(b.quaternion));
        leg.foot.getWorldPosition(leg.captured); leg.foot.getWorldQuaternion(leg.rotation);
        const cx = p.x + right.x * leg.sign * 0.098 + forward.x * leg.midSole;
        const cz = p.z + right.z * leg.sign * 0.098 + forward.z * leg.midSole;
        const swing = stairFootfall(leg.goal, cx, cz, forward, travelAxis, i, phase, axial);
        const parked = standingFootZ(p.z, cx, cz);
        at.set(cx, getWalkableFloorY(cx, parked, ROOM.mezzanineY), parked);
        if (!leg.ready) leg.idle.copy(at);
        else if (parking || Math.hypot(leg.idle.x - cx, leg.idle.z - cz) > 0.38) leg.idle.lerp(at, 1 - Math.exp(-18 * dt));
        leg.goal.lerp(leg.idle, 1 - moving);
        const airborne = MathUtils.smoothstep(swing * moving, 0.04, 0.35);
        leg.goal.y = MathUtils.lerp(getWalkableFloorY(leg.goal.x, leg.goal.z, ROOM.mezzanineY), leg.goal.y, airborne);
        const along = (leg.goal.x - cx) * forward.x + (leg.goal.z - cz) * forward.z;
        const landingPitch = forward.z < 0 ? 0.24 * axial : -0.065;
        let pitch = moving * (0.35 * MathUtils.smoothstep(-along, 0.05, 0.28) + landingPitch * MathUtils.smoothstep(along, 0.08, 0.26));
        leg.goal.addScaledVector(forward, -leg.midSole);
        // When the pelvis transfers to the upper step, roll off the ball of the
        // lower foot instead of dragging the hips down to reach a flat heel.
        leg.thigh.getWorldPosition(at);
        const horizontal = (at.x - leg.goal.x) ** 2 + (at.z - leg.goal.z) ** 2;
        const reach = leg.length - 0.004 - 0.03 * moving;
        const required = at.y + dy - leg.goal.y - Math.sqrt(Math.max(0.01, reach * reach - horizontal));
        if (required > leg.heightAt(pitch)) {
          let j = 1;
          while (j < leg.roll.length - 1 && leg.roll[j] < required) j++;
          const amount = MathUtils.clamp((required - leg.roll[j-1]) / Math.max(0.0001, leg.roll[j] - leg.roll[j-1]), 0, 1);
          pitch = Math.max(pitch, 0.04 * (j - 1 + amount));
        }
        const cos = Math.cos(pitch), sin = Math.sin(pitch);
        let back = Infinity, front = -Infinity;
        for (const v of leg.sole) {
          const end = v.z * cos + v.y * sin;
          back = Math.min(back, end); front = Math.max(front, end);
        }
        // A tipped sneaker has a different footprint. Keep its centre, not its
        // ankle, on the chosen tread so a raised heel cannot catch the next riser.
        leg.goal.addScaledVector(forward, leg.midSole - (front + back) * 0.5);
        leg.goal.y += leg.heightAt(pitch);
        // A turning sneaker can overhang a riser even when its ankle is clear.
        // Ease the clearance into the swing before the sole reaches that edge.
        const margin = 0.001 + 0.042 * swing * moving;
        let support = -Infinity;
        for (const v of leg.sole) {
          const z = v.z * cos + v.y * sin;
          const xWorld = leg.goal.x + right.x * v.x + forward.x * z;
          const zWorld = leg.goal.z + right.z * v.x + forward.z * z;
          const ground = getTreadSupportY(xWorld, zWorld + margin, ROOM.mezzanineY, margin);
          support = Math.max(support, ground - (v.y * cos - v.z * sin));
        }
        leg.goal.y = support + Math.max(0, leg.goal.y - support) * airborne;
        leg.goal.lerp(leg.captured, 1 - terrain);
        leg.rotation.slerp(quaternion.copy(player.quaternion).multiply(parent.setFromAxisAngle(xAxis, pitch)).multiply(leg.bindRotation), terrain);
        if (leg.ready && distance < 0.4) {
          // An unexpected stop can move the chosen foothold across a vertical face.
          // Lift before moving over it and lower after clearing it, not in one frame.
          const rise = leg.goal.y - leg.last.y;
          at.subVectors(leg.goal, leg.last); at.y = 0;
          at.clampLength(0, 6.4 * dt);
          if (rise > 6.4 * dt) at.multiplyScalar(Math.max(0, 1 - (rise - 6.4 * dt) / 0.09));
          leg.goal.copy(leg.last).add(at);
          leg.goal.y += MathUtils.clamp(rise, -3.8 * dt, 6.4 * dt);
        }
        leg.last.copy(leg.goal); leg.ready = true;
      }
      const parkedCenter = (legs[0].idle.z + legs[1].idle.z - forward.z * (legs[0].midSole + legs[1].midSole)) * 0.5;
      const settleZ = MathUtils.clamp(parkedCenter - p.z, -0.22, 0.22) * (1 - moving) * terrain;
      model.position.set(right.z * settleZ, dy, forward.z * settleZ);
      spinePose.copy(spine.quaternion);
      quaternion.setFromAxisAngle(right, moving * terrain * axial * (forward.z > 0 ? 0.115 : 0.035))
        .multiply(spine.getWorldQuaternion(parent));
      spine.quaternion.copy(spine.parent!.getWorldQuaternion(parent).invert().multiply(quaternion));
      for (const leg of legs) {
        pole.copy(forward).addScaledVector(right, leg.sign * 0.09);
        leg.solve(leg.goal, leg.rotation, pole, (0.004 + 0.041 * moving) * terrain);
        leg.toe.quaternion.slerp(leg.restToe, terrain);
      }
      if (terrain < 0.99) return;
      player.updateMatrixWorld(true);
      for (const leg of legs) {
        const g = leg.goal;
        const low = getWalkableFloorY(g.x, g.z - 0.29, ROOM.mezzanineY);
        const high = getWalkableFloorY(g.x, g.z + 0.29, ROOM.mezzanineY);
        if (low === high && moving > 0.98) continue;
        let lift = 0, back = 0, leadingZ = -Infinity, leadingY = 0, leadingX = 0;
        // The heel collar is partly skinned to the shin. At a vertical corner
        // resolve the smaller overlap: move a grazing heel back a few mm
        // rather than raising the boot (or the body) by the height of a riser.
        for (const j of leg.vertices) {
          shoes.getVertexPosition(j, at).applyMatrix4(shoes.matrixWorld);
          if (at.z > leadingZ) { leadingZ=at.z; leadingY=at.y; leadingX=at.x; }
          const penetration = getWalkableFloorY(at.x, at.z, ROOM.mezzanineY) - at.y;
          if (penetration < 0.001) continue;
          const depth = at.z - nextRiserZ(at.x, at.y + 0.001);
          if (depth >= 0 && depth < penetration && depth < 0.10) back = Math.max(back, depth);
          else lift = Math.max(lift, penetration);
        }
        // During a pivot the side of the shoe can miss its supporting tread
        // by less than a millimetre. Seat that edge just inside the nosing.
        const upper=getWalkableFloorY(leadingX,leadingZ+0.002,ROOM.mezzanineY);
        const inset=!back && !lift && leadingY>=upper && leadingY-upper<0.05 &&
          upper>getWalkableFloorY(leadingX,leadingZ,ROOM.mezzanineY) ? 0.003 : 0;
        if (lift || back || inset) {
          leg.foot.getWorldPosition(g);
          g.z += back ? -(1.3 * back + 0.006) : inset;
          g.y += lift + 0.001;
          pole.copy(forward).addScaledVector(right, leg.sign * 0.09);
          leg.solve(g, leg.rotation, pole);
        }
      }
    },
  };
}
