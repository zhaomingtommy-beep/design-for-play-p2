// MINIATURE GALLERY — pure logic model. No Phaser imports, no timers, no
// randomness, no Date. Everything advances through update(dtMs, input), so
// any run is fully determined by its input stream.
//
// Causal language, per the shared chapter contract:
//   source       — the punched ticket (evidence)
//   relationship — which display case the ticket is placed into
//   result       — the glass diorama physically rebuilds, and the museum makes
//                  that interpretation real: CASE A opens a walkable route,
//                  CASE B seals it as an error. Both results are complete and
//                  readable; the wrong one is revocable in place (take the
//                  ticket back) with no level reset.

import { GALLERY, RECON, TUNING } from '../levelData.js';

function freshState() {
  return {
    phase: 'explore', // explore | inspect | complete
    room: 'gallery', // gallery | reconstruction
    player: { x: GALLERY.spawn.x, y: GALLERY.spawn.y, facing: 1 },
    ticket: {
      where: 'pedestal', // pedestal | held | caseA | caseB
      rotDeg: 0, // inspection rotation; front = 0
      markRevealed: false,
    },
    cases: {
      // buildState: empty | building | active | dissolving
      // progress: 0 collapsed .. 1 fully rebuilt interpretation
      A: { occupant: null, interpretation: null, buildState: 'empty', progress: 0 },
      B: { occupant: null, interpretation: null, buildState: 'empty', progress: 0 },
    },
    route: {
      open: false, // walkable only when the door has fully travelled
      doorProgress: 0, // 0 closed grate .. 1 open doorway
      sealed: false, // the ERROR interpretation's physical verdict
    },
    complete: false,
    resets: 0,
    elapsedMs: 0,
  };
}

const IDLE_INPUT = { moveX: 0, moveY: 0, rotate: 0, interact: false, back: false };

function normInput(input) {
  const i = input || {};
  return {
    moveX: Math.max(-1, Math.min(1, Number(i.moveX) || 0)),
    moveY: Math.max(-1, Math.min(1, Number(i.moveY) || 0)),
    rotate: Math.max(-1, Math.min(1, Number(i.rotate) || 0)),
    interact: i.interact === true,
    back: i.back === true,
  };
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

export function createGalleryModel() {
  let state = freshState();
  let events = [];
  let prev = { interact: false, back: false };

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  // What would E do right now? Shared by the scene (prompts), the tests, and
  // describeState(), so the visible prompt can never drift from the logic.
  function availableAction(s = state) {
    if (s.phase !== 'explore' || s.room !== 'gallery') return null;
    const p = s.player;
    const cands = [];
    if (s.ticket.where === 'pedestal') {
      cands.push({
        kind: 'examine',
        d: dist(p.x, p.y, GALLERY.pedestal.x, GALLERY.pedestal.y),
      });
    }
    for (const id of ['A', 'B']) {
      const c = GALLERY.cases[id];
      const cs = s.cases[id];
      const d = dist(p.x, p.y, c.x, c.y);
      if (s.ticket.where === 'held' && cs.buildState === 'empty') {
        cands.push({ kind: 'place', caseId: id, d });
      } else if (cs.occupant === 'ticket' && cs.buildState === 'active') {
        cands.push({ kind: 'withdraw', caseId: id, d });
      }
    }
    const inRange = cands.filter((c) => c.d <= TUNING.interactRange);
    if (!inRange.length) return null;
    inRange.sort((a, b) => a.d - b.d);
    const best = inRange[0];
    return best.kind === 'examine'
      ? { kind: 'examine' }
      : { kind: best.kind, caseId: best.caseId };
  }

  function applyRebuildEffects(caseId) {
    if (caseId === 'A') {
      // The DEPARTURE interpretation makes the route real: the door travels.
      events.push({ type: 'door-opening' });
    } else {
      // The ERROR interpretation makes its verdict real: the route seals.
      if (!state.route.sealed) {
        state.route.sealed = true;
        events.push({ type: 'route-sealed' });
      }
    }
  }

  function clearRebuildEffects(caseId) {
    if (caseId === 'B' && state.route.sealed) {
      state.route.sealed = false;
      events.push({ type: 'route-unsealed' });
    }
  }

  function stepCases(dtMs) {
    for (const id of ['A', 'B']) {
      const c = state.cases[id];
      if (c.buildState === 'building') {
        c.progress = Math.min(1, c.progress + dtMs / TUNING.rebuildMs);
        if (c.progress >= 1) {
          c.buildState = 'active';
          events.push({ type: 'rebuild-complete', caseId: id, interpretation: c.interpretation });
          applyRebuildEffects(id);
        }
      } else if (c.buildState === 'dissolving') {
        c.progress = Math.max(0, c.progress - dtMs / TUNING.dissolveMs);
        if (c.progress <= 0) {
          c.buildState = 'empty';
          c.interpretation = null;
          events.push({ type: 'case-empty', caseId: id });
        }
      }
    }
  }

  function stepDoor(dtMs) {
    const aActive = state.cases.A.buildState === 'active';
    const target = aActive ? 1 : 0;
    const before = state.route.doorProgress;
    if (before < target) {
      state.route.doorProgress = Math.min(1, before + dtMs / TUNING.doorMs);
    } else if (before > target) {
      state.route.doorProgress = Math.max(0, before - dtMs / TUNING.doorMs);
    }
    const now = state.route.doorProgress;
    if (!state.route.open && now >= 1) {
      state.route.open = true;
      events.push({ type: 'door-open' });
    } else if (state.route.open && now < 1) {
      state.route.open = false;
      events.push({ type: 'door-closed' });
    }
  }

  function stepInspect(dtMs, input, pressed) {
    const t = state.ticket;
    if (input.rotate !== 0) {
      t.rotDeg = ((t.rotDeg + input.rotate * TUNING.rotateSpeed * dtMs) % 360 + 360) % 360;
    }
    const [lo, hi] = TUNING.markWindowDeg;
    if (!t.markRevealed && t.rotDeg >= lo && t.rotDeg <= hi) {
      t.markRevealed = true;
      events.push({ type: 'mark-revealed' });
    }
    if (pressed.interact) {
      if (t.markRevealed) {
        t.where = 'held';
        state.phase = 'explore';
        events.push({ type: 'ticket-taken' });
      } else {
        // Rubbing the vellum before the angle is right: visible attempt,
        // explicit non-result. Never a silent failure.
        events.push({ type: 'rub-blank' });
      }
    }
    if (pressed.back) {
      state.phase = 'explore';
      events.push({ type: 'inspect-exit' });
    }
  }

  function stepGallery(dtMs, input, pressed) {
    const p = state.player;
    p.x += input.moveX * TUNING.walkSpeed * dtMs;
    p.y += input.moveY * TUNING.depthSpeed * dtMs;
    if (input.moveX !== 0) p.facing = input.moveX > 0 ? 1 : -1;
    p.y = Math.max(GALLERY.floorTop, Math.min(GALLERY.floorBottom, p.y));
    // The door line is a physical collider while the route is closed.
    const xMax = state.route.open ? GALLERY.doorX + 60 : GALLERY.doorX - 14;
    p.x = Math.max(GALLERY.xMin, Math.min(xMax, p.x));
    if (state.route.open && p.x >= GALLERY.doorX) {
      state.room = 'reconstruction';
      p.x = RECON.enterX;
      p.y = RECON.spawnY;
      p.facing = 1;
      events.push({ type: 'room-enter', room: 'reconstruction' });
      return;
    }
    if (pressed.interact) {
      const action = availableAction();
      if (!action) {
        events.push({ type: 'interact-nothing' });
      } else if (action.kind === 'examine') {
        state.phase = 'inspect';
        events.push({ type: 'inspect-start' });
      } else if (action.kind === 'place') {
        const cs = state.cases[action.caseId];
        cs.occupant = 'ticket';
        cs.interpretation = GALLERY.cases[action.caseId].interpretation;
        cs.buildState = 'building';
        cs.progress = 0;
        state.ticket.where = `case${action.caseId}`;
        state.ticket.rotDeg = 0;
        events.push({ type: 'ticket-placed', caseId: action.caseId, interpretation: cs.interpretation });
        events.push({ type: 'rebuild-start', caseId: action.caseId });
      } else if (action.kind === 'withdraw') {
        const cs = state.cases[action.caseId];
        cs.occupant = null;
        cs.buildState = 'dissolving';
        state.ticket.where = 'held';
        events.push({ type: 'ticket-withdrawn', caseId: action.caseId, interpretation: cs.interpretation });
        clearRebuildEffects(action.caseId);
      }
    }
  }

  function stepReconstruction(dtMs, input) {
    const p = state.player;
    p.x += input.moveX * TUNING.walkSpeed * dtMs;
    p.y += input.moveY * TUNING.depthSpeed * dtMs;
    if (input.moveX !== 0) p.facing = input.moveX > 0 ? 1 : -1;
    p.y = Math.max(RECON.floorTop, Math.min(RECON.floorBottom, p.y));
    p.x = Math.max(RECON.exitX - 20, Math.min(RECON.xMax, p.x));
    if (p.x <= RECON.exitX && input.moveX < 0) {
      state.room = 'gallery';
      p.x = GALLERY.doorX - 24;
      p.y = Math.max(GALLERY.floorTop, Math.min(GALLERY.floorBottom, p.y));
      p.facing = -1;
      events.push({ type: 'room-exit', room: 'gallery' });
      return;
    }
    if (!state.complete && p.x >= RECON.endX) {
      state.complete = true;
      state.phase = 'complete';
      events.push({ type: 'slice-complete' });
    }
  }

  return {
    update(dtMs, rawInput) {
      const dt = Number(dtMs);
      if (!Number.isFinite(dt) || dt < 0) return;
      const input = normInput(rawInput || IDLE_INPUT);
      const pressed = {
        interact: input.interact && !prev.interact,
        back: input.back && !prev.back,
      };
      state.elapsedMs += dt;
      if (state.phase !== 'complete') {
        if (state.phase === 'inspect') {
          stepInspect(dt, input, pressed);
        } else if (state.room === 'gallery') {
          stepGallery(dt, input, pressed);
        } else {
          stepReconstruction(dt, input);
        }
      }
      stepCases(dt);
      stepDoor(dt);
      prev = { interact: input.interact, back: input.back };
    },

    snapshot() {
      return clone(state);
    },

    availableAction() {
      return availableAction(state);
    },

    drainEvents() {
      return events.splice(0, events.length);
    },

    reset() {
      const resets = state.resets + 1;
      state = freshState();
      state.resets = resets;
      prev = { interact: false, back: false };
      events.push({ type: 'reset', resets });
    },
  };
}

// Read-only, JSON-safe text-state contract. MuseumScene.renderToText() returns
// exactly this; tests assert against it without touching Phaser.
export function describeState(state, action) {
  const s = state;
  const ca = s.cases.A;
  const cb = s.cases.B;
  let prompt = null;
  if (s.phase === 'inspect') {
    prompt = s.ticket.markRevealed ? 'inspect-take' : 'inspect-turn';
  } else if (s.phase === 'complete') {
    prompt = 'complete';
  } else if (action) {
    prompt =
      action.kind === 'examine'
        ? 'examine-ticket'
        : action.kind === 'place'
          ? `place-${action.caseId}`
          : `withdraw-${action.caseId}`;
  }
  return {
    chapter: 'chapter05-museum',
    slice: 'miniature-gallery',
    phase: s.phase,
    room: s.room,
    player: { x: Math.round(s.player.x), y: Math.round(s.player.y), facing: s.player.facing },
    ticket: {
      where: s.ticket.where,
      rotDeg: Math.round(s.ticket.rotDeg),
      markRevealed: s.ticket.markRevealed,
    },
    caseA: { occupant: ca.occupant, interpretation: ca.interpretation, buildState: ca.buildState, progress: Number(ca.progress.toFixed(3)) },
    caseB: { occupant: cb.occupant, interpretation: cb.interpretation, buildState: cb.buildState, progress: Number(cb.progress.toFixed(3)) },
    route: {
      open: s.route.open,
      doorProgress: Number(s.route.doorProgress.toFixed(3)),
      sealed: s.route.sealed,
    },
    complete: s.complete,
    resets: s.resets,
    prompt,
  };
}
