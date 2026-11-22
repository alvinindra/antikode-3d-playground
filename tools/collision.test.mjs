import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import * as layout from '../src/scene/layout.ts';
import { buildRoomContacts } from '../src/scene/roomContacts.ts';

test('the corridor-facing edge of the credit sign stops the visitor before the wall', () => {
  const room = new Group(), sign = new Group();
  sign.position.set(layout.ROOM.nookWallX - 0.11, 1.72, 7.55);
  sign.add(new Mesh(new BoxGeometry(0.06, 1.12, 1.84)));
  room.add(sign);
  const p = new Vector3(sign.position.x - 0.34, 0, sign.position.z);
  const hit = buildRoomContacts(room).blocked(p.x, p.y, p.z);
  assert.ok(hit, 'the avatar shoulder already intersects the mounted frame');
});

test('a seat approach may touch its own cushion but not cross a different solid', () => {
  const root = new Group(), chair = new Group();
  chair.name = 'gallery-chair-0';
  chair.add(new Mesh(new BoxGeometry(0.75, 0.4, 0.72)));
  root.add(chair);
  const start = new Vector3(0,0,1.5), end = new Vector3(0,0.2,0);
  assert.equal(buildRoomContacts(root).clearApproach(start,end,chair.name), true);
  const screen = new Mesh(new BoxGeometry(1,2,0.02));
  screen.position.set(0,1,0.79); root.add(screen);
  assert.equal(buildRoomContacts(root).clearApproach(start,end,chair.name), false);
});
