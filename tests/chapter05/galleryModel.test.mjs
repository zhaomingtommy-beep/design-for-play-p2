// MINIATURE GALLERY — focused tests for the pure logic model.
// No Phaser: the whole slice is driven through update(dtMs, input), exactly
// the way MuseumScene drives it, so these tests cover the real player rules:
// inspect/rotate/reveal, both placements, the reversible wrong result, the
// opened route, and reset determinism.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGalleryModel, describeState } from '../../src/chapters/museum/model/galleryModel.js';
import { GALLERY, RECON, TUNING } from '../../src/chapters/museum/levelData.js';

const DT = 16; // fixed step: deterministic input streams

function step(m, ms, input = {}) {
  let t = 0;
  while (t < ms) {
    m.update(DT, input);
    t += DT;
  }
}

function tap(m, input = { interact: true }) {
  m.update(DT, input);
  m.update(DT, {});
}

function walkToX(m, x, maxMs = 30000) {
  let t = 0;
  while (Math.abs(m.snapshot().player.x - x) > 3 && t < maxMs) {
    const dir = m.snapshot().player.x < x ? 1 : -1;
    m.update(DT, { moveX: dir });
    t += DT;
  }
  assert.ok(t < maxMs, `walkToX(${x}) timed out at ${m.snapshot().player.x}`);
}

function walkToY(m, y, maxMs = 10000) {
  let t = 0;
  while (Math.abs(m.snapshot().player.y - y) > 3 && t < maxMs) {
    const dir = m.snapshot().player.y < y ? 1 : -1;
    m.update(DT, { moveY: dir });
    t += DT;
  }
}

function goTo(m, x, y) {
  walkToY(m, y);
  walkToX(m, x);
}

// Walk to the pedestal, examine, rotate into the lamplight, take the ticket.
function acquireTicket(m) {
  goTo(m, GALLERY.pedestal.x, GALLERY.pedestal.y);
  tap(m); // [E] examine
  assert.equal(m.snapshot().phase, 'inspect');
  step(m, 1400, { rotate: 1 }); // turn until the lamp burns through
  assert.equal(m.snapshot().ticket.markRevealed, true);
  tap(m); // [E] pocket
  assert.equal(m.snapshot().ticket.where, 'held');
  assert.equal(m.snapshot().phase, 'explore');
}

function placeIn(m, caseId) {
  const c = GALLERY.cases[caseId];
  goTo(m, c.x, c.y);
  tap(m); // [E] place
  const s = m.snapshot();
  assert.equal(s.ticket.where, `case${caseId}`);
  assert.equal(s.cases[caseId].buildState, 'building');
  step(m, TUNING.rebuildMs + 100);
  assert.equal(m.snapshot().cases[caseId].buildState, 'active');
}

test('inspect: the hidden mark appears only after rotating into the lamplight', () => {
  const m = createGalleryModel();
  goTo(m, GALLERY.pedestal.x, GALLERY.pedestal.y);
  tap(m);
  assert.equal(m.snapshot().phase, 'inspect');

  // Rubbing before the angle is right: explicit non-result, ticket stays.
  tap(m);
  const events = m.drainEvents();
  assert.ok(events.some((e) => e.type === 'rub-blank'));
  assert.equal(m.snapshot().ticket.where, 'pedestal');
  assert.equal(m.snapshot().ticket.markRevealed, false);

  // Turning the ticket advances rotation deterministically.
  const before = m.snapshot().ticket.rotDeg;
  step(m, 200, { rotate: 1 });
  const after = m.snapshot().ticket.rotDeg;
  assert.ok(after > before, 'rotation accumulates');

  // Inside the lamp window the mark burns through — once, permanently.
  step(m, 1400, { rotate: 1 });
  assert.equal(m.snapshot().ticket.markRevealed, true);
  assert.ok(m.drainEvents().some((e) => e.type === 'mark-revealed'));

  // [Q] puts it back; [E] after reveal pockets it.
  tap(m, { back: true });
  assert.equal(m.snapshot().phase, 'explore');
  tap(m);
  step(m, 100, { rotate: 1 });
  tap(m);
  assert.equal(m.snapshot().ticket.where, 'held');
});

test('bounds: the route door is a real collider while no interpretation holds', () => {
  const m = createGalleryModel();
  step(m, 6000, { moveX: 1 });
  assert.ok(m.snapshot().player.x <= GALLERY.doorX - 14 + 0.001);
  assert.equal(m.snapshot().room, 'gallery');
});

test('placement A (THE DEPARTURE): rebuild opens a short walkable route to completion', () => {
  const m = createGalleryModel();
  acquireTicket(m);
  placeIn(m, 'A');

  const built = m.snapshot();
  assert.equal(built.cases.A.interpretation, 'departure');
  assert.equal(built.route.sealed, false);

  // The door travels, then the route exists.
  step(m, TUNING.doorMs + 100);
  assert.equal(m.snapshot().route.open, true);
  const types = m.drainEvents().map((e) => e.type);
  assert.ok(types.includes('rebuild-complete'));
  assert.ok(types.includes('door-open'));

  // Walk through the doorway: hard cut into the reconstruction view.
  step(m, 3000, { moveX: 1 });
  assert.equal(m.snapshot().room, 'reconstruction');

  // The route is short and walkable: the witness mark completes the slice.
  walkToX(m, RECON.endX + 5);
  const done = m.snapshot();
  assert.equal(done.complete, true);
  assert.equal(done.phase, 'complete');
  assert.ok(m.drainEvents().some((e) => e.type === 'slice-complete'));

  // describeState (the render_game_to_text contract) agrees with the model.
  const d = describeState(m.snapshot(), m.availableAction());
  assert.equal(d.complete, true);
  assert.equal(d.prompt, 'complete');
  assert.equal(d.route.open, true);
});

test('placement B (THE ERROR LEDGER): a complete, readable wrong result — never silent', () => {
  const m = createGalleryModel();
  acquireTicket(m);
  placeIn(m, 'B');

  const s = m.snapshot();
  assert.equal(s.cases.B.interpretation, 'error');
  assert.equal(s.route.sealed, true, 'the verdict physically seals the route');
  assert.equal(s.route.open, false);
  const types = m.drainEvents().map((e) => e.type);
  assert.ok(types.includes('rebuild-complete'));
  assert.ok(types.includes('route-sealed'), 'the failure is announced, not silent');

  // The seal is physical: the door line still blocks, the slice cannot
  // complete through this interpretation.
  step(m, TUNING.doorMs + 200);
  step(m, 3000, { moveX: 1 });
  const blocked = m.snapshot();
  assert.equal(blocked.room, 'gallery');
  assert.equal(blocked.complete, false);
  assert.ok(blocked.player.x <= GALLERY.doorX - 14 + 0.001);
});

test('wrong result is revocable in place: withdraw from B, then A opens the route', () => {
  const m = createGalleryModel();
  acquireTicket(m);
  placeIn(m, 'B');
  step(m, TUNING.doorMs + 100);
  assert.equal(m.snapshot().route.sealed, true);

  // Take the ticket back at the same case — no reset, no replay.
  const c = GALLERY.cases.B;
  goTo(m, c.x, c.y);
  tap(m); // [E] take back
  assert.equal(m.snapshot().ticket.where, 'held');
  assert.equal(m.snapshot().route.sealed, false, 'the seal lifts immediately');
  step(m, TUNING.dissolveMs + 100);
  const cleared = m.snapshot();
  assert.equal(cleared.cases.B.buildState, 'empty');
  assert.equal(cleared.cases.B.interpretation, null);
  assert.equal(cleared.cases.B.occupant, null);
  assert.ok(m.drainEvents().some((e) => e.type === 'route-unsealed'));

  // The same ticket, correctly framed, still opens and completes the route.
  placeIn(m, 'A');
  step(m, TUNING.doorMs + 100);
  assert.equal(m.snapshot().route.open, true);
  step(m, 3000, { moveX: 1 });
  assert.equal(m.snapshot().room, 'reconstruction');
  walkToX(m, RECON.endX + 5);
  assert.equal(m.snapshot().complete, true);
});

test('withdrawing from A closes the route again (reversible both ways)', () => {
  const m = createGalleryModel();
  acquireTicket(m);
  placeIn(m, 'A');
  step(m, TUNING.doorMs + 100);
  assert.equal(m.snapshot().route.open, true);

  const c = GALLERY.cases.A;
  goTo(m, c.x, c.y);
  tap(m);
  step(m, TUNING.doorMs + 200);
  const s = m.snapshot();
  assert.equal(s.route.open, false);
  assert.equal(s.route.doorProgress, 0);
  assert.ok(m.drainEvents().some((e) => e.type === 'door-closed'));
});

test('ten resets return the identical fresh state', () => {
  const m = createGalleryModel();
  acquireTicket(m);
  placeIn(m, 'B'); // dirty the state: placement, seal, walked distance
  const fresh = createGalleryModel().snapshot();
  for (let i = 1; i <= 10; i += 1) {
    m.reset();
    assert.deepEqual(m.snapshot(), { ...fresh, resets: i }, `reset #${i}`);
  }
});

test('reset replay equivalence: the full correct route replays identically', () => {
  const playCorrectRoute = (m) => {
    acquireTicket(m);
    placeIn(m, 'A');
    step(m, TUNING.doorMs + 100);
    step(m, 3000, { moveX: 1 });
    walkToX(m, RECON.endX + 5);
    return m.snapshot();
  };
  const m = createGalleryModel();
  const first = playCorrectRoute(m);
  m.reset();
  const replay = playCorrectRoute(m);
  assert.deepEqual(replay, { ...first, resets: 1 });
});

test('snapshot is plain JSON and describeState is a stable text contract', () => {
  const m = createGalleryModel();
  const roundTrip = JSON.parse(JSON.stringify(m.snapshot()));
  assert.deepEqual(roundTrip, m.snapshot());

  const d = describeState(m.snapshot(), m.availableAction());
  assert.equal(d.chapter, 'chapter05-museum');
  assert.equal(d.slice, 'miniature-gallery');
  assert.equal(d.phase, 'explore');
  assert.equal(d.room, 'gallery');
  assert.equal(d.ticket.where, 'pedestal');
  assert.equal(d.caseA.buildState, 'empty');
  assert.equal(d.caseB.buildState, 'empty');
  assert.equal(d.route.open, false);
  assert.equal(d.route.sealed, false);
  assert.equal(d.complete, false);
  JSON.parse(JSON.stringify(d)); // must not throw
});

test('the player cannot skip the inspection beat', () => {
  const m = createGalleryModel();
  // E at a case with empty hands: nothing to place, explicit non-result.
  const c = GALLERY.cases.A;
  goTo(m, c.x, c.y);
  tap(m);
  assert.equal(m.snapshot().cases.A.occupant, null);
  assert.ok(m.drainEvents().some((e) => e.type === 'interact-nothing'));
  // The ticket cannot leave the pedestal without the mark being seen.
  goTo(m, GALLERY.pedestal.x, GALLERY.pedestal.y);
  tap(m); // examine
  tap(m, { back: true }); // put it back without turning
  assert.equal(m.snapshot().ticket.where, 'pedestal');
  assert.equal(m.snapshot().ticket.markRevealed, false);
});
