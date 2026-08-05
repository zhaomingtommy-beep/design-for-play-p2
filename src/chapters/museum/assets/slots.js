// MINIATURE GALLERY — replaceable asset slots.
//
// Every visual layer in the slice is produced through one of the slots below.
// A slot is a named contract: role, source, status, and a painter that fills a
// generated Phaser texture. The scene never draws a layer directly, so any
// slot can later be re-pointed at a finished Jason/Codex export without
// touching scene code. All current painters are original graphite / vellum /
// paper blockout — no downloaded imagery is used as a final background.
//
// Provenance for every slot lives in assets/ASSET_SLOTS.md (runtime import
// contract, SHARED_ASSET_AND_VOICE_HANDOFF §4).

import { PAL } from '../levelData.js';

function key(id) {
  return `mg:${id}`;
}

// -- tiny painter helpers (graphite line on vellum) ------------------------

function grain(g, w, h, n, alpha, color = PAL.graphite) {
  // Deterministic speckle: fixed LCG so the paper grain never reshuffles
  // between runs (visual determinism matches the logic determinism).
  let seed = 2215;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  g.fillStyle(color, alpha);
  for (let i = 0; i < n; i += 1) {
    g.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), 1, 1);
  }
}

// -- texture slots -----------------------------------------------------------
// Each entry: { id, role, w, h, paint(g, w, h) } — painted once into a
// generated texture named `mg:<id>`.

export const TEXTURE_SLOTS = [
  {
    id: 'butch',
    role: 'character',
    w: 26,
    h: 46,
    paint(g, w, h) {
      // Graphite paper-doll silhouette: coat, head, brass ticket-pocket pin.
      g.fillStyle(PAL.graphite, 1);
      g.fillRect(7, 14, 12, 26); // coat body
      g.fillRect(8, 40, 4, 6); // legs
      g.fillRect(14, 40, 4, 6);
      g.fillStyle(PAL.ivory, 1);
      g.fillRect(8, 3, 10, 10); // head
      g.fillStyle(PAL.graphite, 1);
      g.fillRect(6, 0, 14, 4); // hat brim
      g.fillRect(9, -2, 8, 3); // hat top (clipped ok)
      g.fillStyle(PAL.brass, 1);
      g.fillRect(15, 18, 3, 3); // pocket pin
      g.lineStyle(1, PAL.ink, 0.6);
      g.strokeRect(7.5, 14.5, 12, 26);
    },
  },
  {
    id: 'ticket',
    role: 'interaction',
    w: 22,
    h: 12,
    paint(g) {
      g.fillStyle(PAL.ivory, 1);
      g.fillRect(0, 0, 22, 12);
      g.lineStyle(1, PAL.graphite, 1);
      g.strokeRect(0.5, 0.5, 21, 11);
      g.fillStyle(PAL.graphite, 1);
      g.fillRect(3, 3, 10, 2); // printed line
      g.fillRect(3, 7, 7, 1);
      g.fillStyle(PAL.ink, 1);
      g.fillCircle(17, 4, 1.6); // first punch
      g.fillCircle(17, 8, 1.6);
    },
  },
  {
    id: 'ticket-big',
    role: 'interaction',
    w: 220,
    h: 120,
    paint(g) {
      // Inspect-mode close-up. The hidden second punch row is NOT painted
      // here; it is a separate layer so the reveal is a real state change.
      g.fillStyle(PAL.ivory, 1);
      g.fillRect(0, 0, 220, 120);
      g.fillStyle(PAL.vellum, 1);
      g.fillRect(0, 0, 220, 26);
      g.lineStyle(2, PAL.graphite, 1);
      g.strokeRect(1, 1, 218, 118);
      g.lineStyle(1, PAL.graphiteSoft, 1);
      g.lineBetween(150, 6, 150, 114); // perforation
      g.fillStyle(PAL.graphite, 1);
      g.fillRect(16, 12, 96, 6); // printed station line
      g.fillRect(16, 44, 70, 3);
      g.fillRect(16, 54, 52, 3);
      g.fillStyle(PAL.ink, 1);
      for (const [x, y] of [
        [176, 30],
        [176, 52],
        [176, 74],
        [196, 41],
      ]) {
        g.fillCircle(x, y, 5); // the known punches
      }
      g.fillStyle(PAL.brass, 0.9);
      g.fillRect(16, 88, 60, 10); // archive stamp block
      grain(g, 220, 120, 260, 0.08);
    },
  },
  {
    id: 'ticket-mark',
    role: 'interaction',
    w: 220,
    h: 120,
    paint(g) {
      // The hidden mark: a second punch pattern + a second station line,
      // drawn in evidence-cyan graphite dust.
      g.fillStyle(PAL.cyan, 0.95);
      for (const [x, y] of [
        [186, 30],
        [186, 63],
        [196, 74],
        [176, 85],
        [166, 41],
      ]) {
        g.fillCircle(x, y, 4);
      }
      g.fillStyle(PAL.cyan, 0.8);
      g.fillRect(16, 66, 84, 3); // the second station, burned through
      g.lineStyle(1, PAL.cyan, 0.9);
      g.strokeCircle(186, 56, 34);
    },
  },
  {
    id: 'pedestal',
    role: 'interaction',
    w: 56,
    h: 74,
    paint(g) {
      g.fillStyle(PAL.vellum, 1);
      g.fillRect(8, 10, 40, 60);
      g.fillStyle(PAL.paperShadow, 1);
      g.fillRect(8, 10, 40, 8);
      g.fillRect(4, 66, 48, 8);
      g.lineStyle(1, PAL.graphite, 1);
      g.strokeRect(8.5, 10.5, 39, 59);
      g.strokeRect(4.5, 66.5, 47, 7);
      grain(g, 56, 74, 60, 0.1);
    },
  },
  {
    id: 'mini-slab',
    role: 'landmark',
    w: 96,
    h: 14,
    paint(g) {
      g.fillStyle(PAL.vellum, 1);
      g.fillRect(0, 0, 96, 14);
      g.lineStyle(1, PAL.graphite, 1);
      g.strokeRect(0.5, 0.5, 95, 13);
      grain(g, 96, 14, 40, 0.12);
    },
  },
  {
    id: 'mini-pillar',
    role: 'landmark',
    w: 10,
    h: 44,
    paint(g) {
      g.fillStyle(PAL.paperShadow, 1);
      g.fillRect(0, 0, 10, 44);
      g.lineStyle(1, PAL.graphite, 1);
      g.strokeRect(0.5, 0.5, 9, 43);
    },
  },
  {
    id: 'mini-bridge',
    role: 'landmark',
    w: 64,
    h: 8,
    paint(g) {
      g.fillStyle(PAL.ivory, 1);
      g.fillRect(0, 0, 64, 8);
      g.lineStyle(1, PAL.brass, 1);
      g.strokeRect(0.5, 0.5, 63, 7);
      g.lineBetween(0, 7, 64, 1);
    },
  },
  {
    id: 'mini-wall',
    role: 'landmark',
    w: 70,
    h: 52,
    paint(g) {
      // The ERROR verdict made physical: a bricked-over slab.
      g.fillStyle(PAL.graphiteSoft, 1);
      g.fillRect(0, 0, 70, 52);
      g.lineStyle(1, PAL.ink, 1);
      for (let y = 0; y <= 52; y += 10) g.lineBetween(0, y, 70, y);
      for (let i = 0; i < 5; i += 1) {
        const off = i % 2 ? 0 : 17;
        for (let x = off; x <= 70; x += 35) g.lineBetween(x, i * 10, x, i * 10 + 10);
      }
      g.lineStyle(2, PAL.red, 1);
      g.lineBetween(4, 4, 66, 48);
      g.lineBetween(66, 4, 4, 48);
    },
  },
  {
    id: 'mini-door',
    role: 'landmark',
    w: 26,
    h: 40,
    paint(g) {
      g.fillStyle(PAL.graphite, 1);
      g.fillRect(0, 0, 26, 40);
      g.fillStyle(PAL.cyan, 0.9);
      g.fillRect(9, 6, 8, 28); // lit doorway slit
      g.lineStyle(1, PAL.brass, 1);
      g.strokeRect(0.5, 0.5, 25, 39);
    },
  },
  {
    id: 'mini-rubble',
    role: 'landmark',
    w: 90,
    h: 26,
    paint(g) {
      g.fillStyle(PAL.paperShadow, 1);
      g.fillRect(6, 12, 22, 12);
      g.fillRect(34, 6, 18, 18);
      g.fillRect(58, 14, 26, 10);
      g.lineStyle(1, PAL.graphite, 0.8);
      g.strokeRect(6.5, 12.5, 21, 11);
      g.strokeRect(34.5, 6.5, 17, 17);
      g.strokeRect(58.5, 14.5, 25, 9);
    },
  },
  {
    id: 'grate',
    role: 'interaction',
    w: 64,
    h: 118,
    paint(g) {
      g.fillStyle(PAL.graphite, 0.92);
      g.fillRect(0, 0, 64, 118);
      g.lineStyle(3, PAL.graphiteSoft, 1);
      for (let x = 8; x < 64; x += 14) g.lineBetween(x, 0, x, 118);
      g.lineStyle(2, PAL.brass, 1);
      g.strokeRect(1, 1, 62, 116);
    },
  },
  {
    id: 'seal-plate',
    role: 'interaction',
    w: 70,
    h: 26,
    paint(g) {
      g.fillStyle(PAL.graphite, 1);
      g.fillRect(0, 0, 70, 26);
      g.lineStyle(2, PAL.red, 1);
      g.strokeRect(1, 1, 68, 24);
      g.lineBetween(6, 13, 64, 13);
      g.fillStyle(PAL.red, 1);
      g.fillCircle(12, 13, 4);
      g.fillCircle(58, 13, 4);
    },
  },
  {
    id: 'witness-post',
    role: 'landmark',
    w: 30,
    h: 64,
    paint(g) {
      g.fillStyle(PAL.brass, 1);
      g.fillRect(12, 10, 6, 54);
      g.fillStyle(PAL.ivory, 1);
      g.fillRect(2, 0, 26, 16);
      g.lineStyle(1, PAL.graphite, 1);
      g.strokeRect(2.5, 0.5, 25, 15);
      g.fillStyle(PAL.cyan, 1);
      g.fillCircle(15, 8, 4);
    },
  },
  {
    id: 'mini-train',
    role: 'landmark',
    w: 120,
    h: 34,
    paint(g) {
      // Paper train silhouette waiting at the remembered platform.
      g.fillStyle(PAL.graphite, 1);
      g.fillRect(4, 10, 88, 20);
      g.fillRect(92, 16, 24, 14);
      g.fillStyle(PAL.ivory, 0.9);
      for (let x = 12; x < 84; x += 16) g.fillRect(x, 14, 9, 7);
      g.fillStyle(PAL.ink, 1);
      g.fillCircle(22, 31, 4);
      g.fillCircle(50, 31, 4);
      g.fillCircle(78, 31, 4);
      g.fillStyle(PAL.cyan, 0.9);
      g.fillRect(4, 8, 88, 2); // the one lit line: this route exists
    },
  },
];

export function textureKey(id) {
  return key(id);
}

// Generate every slot texture once. Safe to call again on scene restart:
// existing keys are skipped.
export function ensureSlotTextures(scene) {
  for (const slot of TEXTURE_SLOTS) {
    const k = key(slot.id);
    if (scene.textures.exists(k)) continue;
    const g = scene.add.graphics();
    g.clear();
    slot.paint(g, slot.w, slot.h);
    g.generateTexture(k, slot.w, slot.h);
    g.destroy();
  }
}
