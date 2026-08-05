// MINIATURE GALLERY — Phaser presentation for the pure gallery model.
// All rules live in model/galleryModel.js; this scene only translates model
// state into paper, glass and graphite, and keyboard into model input.
// Fixed camera throughout: the gallery and the reconstruction are two
// separate 960×600 diorama compositions, joined by a hard cut.

import Phaser from 'phaser';
import { VIEW, PAL, GALLERY, RECON, STRINGS } from './levelData.js';
import { createGalleryModel, describeState } from './model/galleryModel.js';
import { ensureSlotTextures, textureKey } from './assets/slots.js';

const FONT = 'Courier New, monospace';

function css(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function easeOut(p) {
  return 1 - Math.pow(1 - p, 3);
}

// Per-case diorama piece layouts, in scene coordinates relative to the case
// center. `from` is the collapsed scatter, `to` is the rebuilt position.
function caseLayout(cx) {
  return {
    departure: [
      { key: 'mini-slab', from: { x: cx - 30, y: 470 }, to: { x: cx, y: 428 } },
      { key: 'mini-pillar', from: { x: cx - 60, y: 480 }, to: { x: cx - 38, y: 400 } },
      { key: 'mini-pillar', from: { x: cx + 55, y: 478 }, to: { x: cx + 38, y: 400 } },
      { key: 'mini-bridge', from: { x: cx + 10, y: 486 }, to: { x: cx + 40, y: 417 } },
      { key: 'mini-door', from: { x: cx + 74, y: 484 }, to: { x: cx + 64, y: 402 } },
    ],
    error: [
      { key: 'mini-slab', from: { x: cx - 30, y: 470 }, to: { x: cx, y: 428 } },
      { key: 'mini-wall', from: { x: cx + 20, y: 490 }, to: { x: cx + 10, y: 396 } },
    ],
  };
}

export class MuseumScene extends Phaser.Scene {
  constructor() {
    super('MuseumGallery');
  }

  create() {
    this.model = createGalleryModel();
    ensureSlotTextures(this);

    this.buildGalleryRoom();
    this.buildReconstructionRoom();
    this.buildActor();
    this.buildOverlays();

    this.keys = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      e: Phaser.Input.Keyboard.KeyCodes.E,
      q: Phaser.Input.Keyboard.KeyCodes.Q,
    });
    this.input.keyboard.on('keydown-R', () => {
      this.model.reset();
      this.setCaption(null);
      this.cameras.main.flash(120, 233, 226, 208);
    });

    this.captionUntil = 0;
    this.syncFromModel(0);
  }

  // ---------------------------------------------------------------- rooms

  buildGalleryRoom() {
    const root = this.add.container(0, 0);
    this.galleryRoot = root;

    // Paper wall + vellum floor band (background layer, replaceable slot).
    const g = this.add.graphics();
    g.fillStyle(PAL.ivory, 1);
    g.fillRect(0, 0, VIEW.w, VIEW.h);
    g.fillStyle(PAL.vellum, 1);
    g.fillRect(0, GALLERY.floorTop - 20, VIEW.w, VIEW.h - GALLERY.floorTop + 20);
    g.lineStyle(1, PAL.paperShadow, 0.8);
    for (let y = GALLERY.floorTop + 6; y < VIEW.h; y += 22) {
      g.lineBetween(0, y, VIEW.w, y + 6);
    }
    g.lineStyle(2, PAL.graphite, 1);
    g.lineBetween(0, GALLERY.floorTop - 20, VIEW.w, GALLERY.floorTop - 20);
    // Wall panels: graphite archive frames.
    g.lineStyle(1, PAL.graphiteSoft, 0.7);
    for (const x of [40, 300, 620, 900]) {
      g.strokeRect(x, 60, 220, 300);
    }
    root.add(g);

    // Title + the museum's own plaque (the chapter's core sentence, in-world).
    root.add(this.add.text(40, 24, STRINGS.title, {
      fontFamily: FONT, fontSize: '20px', color: css(PAL.graphite), fontStyle: 'bold',
    }));
    root.add(this.add.text(40, 50, STRINGS.slice, {
      fontFamily: FONT, fontSize: '12px', color: css(PAL.brass), letterSpacing: 4,
    }));
    root.add(this.add.text(VIEW.w / 2, 92, STRINGS.plaque, {
      fontFamily: FONT, fontSize: '12px', color: css(PAL.graphiteSoft), fontStyle: 'italic',
    }).setOrigin(0.5, 0));

    // Pedestal + ticket (source).
    this.pedestal = this.add.image(GALLERY.pedestal.x, GALLERY.pedestal.y - 30, textureKey('pedestal')).setOrigin(0.5, 0);
    this.ticketSprite = this.add.image(GALLERY.pedestal.x, GALLERY.pedestal.y - 44, textureKey('ticket'));
    root.add([this.pedestal, this.ticketSprite]);
    root.add(this.add.text(GALLERY.pedestal.x, GALLERY.pedestal.y + 52, STRINGS.pedestalLabel, {
      fontFamily: FONT, fontSize: '10px', color: css(PAL.graphiteSoft),
    }).setOrigin(0.5, 0));
    this.heldTicket = this.add.image(0, 0, textureKey('ticket')).setVisible(false);
    root.add(this.heldTicket);

    // Two display contexts (relationship): glass cases + labels + miniatures.
    this.caseViews = {};
    for (const id of ['A', 'B']) {
      const c = GALLERY.cases[id];
      const boxW = 170;
      const boxH = 150;
      const top = c.y - boxH;
      const gg = this.add.graphics();
      gg.lineStyle(2, PAL.brass, 1);
      gg.strokeRect(c.x - boxW / 2, top, boxW, boxH);
      gg.fillStyle(PAL.glass, 0.14);
      gg.fillRect(c.x - boxW / 2, top, boxW, boxH);
      gg.lineStyle(1, 0xffffff, 0.5);
      gg.lineBetween(c.x - boxW / 2 + 12, top + boxH - 16, c.x + boxW / 2 - 30, top + 18);
      gg.fillStyle(PAL.paperShadow, 1);
      gg.fillRect(c.x - boxW / 2 - 8, c.y, boxW + 16, 10);
      gg.lineStyle(1, PAL.graphite, 1);
      gg.strokeRect(c.x - boxW / 2 - 8.5, c.y + 0.5, boxW + 16, 9);
      root.add(gg);

      const glow = this.add.rectangle(c.x, top + boxH / 2, boxW - 4, boxH - 4, PAL.amber, 0);
      const thread = this.add.graphics();
      const rubble = this.add.image(c.x, 432, textureKey('mini-rubble'));
      const layout = caseLayout(c.x);
      const pieces = { departure: [], error: [] };
      for (const interp of ['departure', 'error']) {
        for (const p of layout[interp]) {
          const img = this.add.image(p.from.x, p.from.y, textureKey(p.key)).setAlpha(0);
          pieces[interp].push({ img, ...p });
        }
      }
      const mount = this.add.image(c.x - 60, 352, textureKey('ticket')).setAlpha(0);
      root.add([glow, thread, rubble, mount]);
      for (const interp of ['departure', 'error']) {
        root.add(pieces[interp].map((p) => p.img));
      }

      root.add(this.add
        .text(c.x, c.y + 16, id === 'A' ? STRINGS.caseALabel : STRINGS.caseBLabel, {
          fontFamily: FONT, fontSize: '11px', color: css(PAL.graphite), fontStyle: 'bold',
        })
        .setOrigin(0.5, 0));
      root.add(this.add
        .text(c.x, c.y + 30, id === 'A' ? STRINGS.caseASub : STRINGS.caseBSub, {
          fontFamily: FONT, fontSize: '10px', color: css(PAL.graphiteSoft), fontStyle: 'italic',
        })
        .setOrigin(0.5, 0));

      this.caseViews[id] = { glow, thread, rubble, pieces, mount, cx: c.x, top, boxW, boxH };
    }

    // Route door (result): right wall, grate, seal, plaque.
    const dx = GALLERY.doorX;
    const dg = this.add.graphics();
    dg.fillStyle(PAL.graphite, 1);
    dg.fillRect(dx - 6, GALLERY.floorTop - 130, 70, 148);
    root.add(dg);
    this.doorGlow = this.add.rectangle(dx + 29, GALLERY.floorTop - 56, 56, 116, PAL.cyan, 0);
    this.grate = this.add.image(dx + 29, GALLERY.floorTop - 56, textureKey('grate')).setOrigin(0.5, 0.5);
    this.grateBaseY = GALLERY.floorTop - 56;
    this.seal = this.add.image(dx + 29, GALLERY.floorTop - 60, textureKey('seal-plate')).setAlpha(0);
    this.doorPlaque = this.add
      .text(dx - 40, GALLERY.floorTop - 160, STRINGS.doorPlaqueClosed, {
        fontFamily: FONT, fontSize: '10px', color: css(PAL.red),
      })
      .setOrigin(1, 0);
    root.add([this.doorGlow, this.grate, this.seal, this.doorPlaque]);
  }

  buildReconstructionRoom() {
    const root = this.add.container(0, 0).setVisible(false);
    const g = this.add.graphics();
    g.fillStyle(PAL.ivory, 1);
    g.fillRect(0, 0, VIEW.w, VIEW.h);
    g.fillStyle(PAL.vellum, 1);
    g.fillRect(0, RECON.floorTop - 20, VIEW.w, VIEW.h - RECON.floorTop + 20);
    g.lineStyle(1, PAL.paperShadow, 0.8);
    for (let y = RECON.floorTop + 6; y < VIEW.h; y += 22) {
      g.lineBetween(0, y, VIEW.w, y + 6);
    }
    g.lineStyle(2, PAL.graphite, 1);
    g.lineBetween(0, RECON.floorTop - 20, VIEW.w, RECON.floorTop - 20);
    // The way back.
    g.fillStyle(PAL.graphite, 1);
    g.fillRect(40, RECON.floorTop - 110, 56, 128);
    g.fillStyle(PAL.cyan, 0.25);
    g.fillRect(46, RECON.floorTop - 104, 44, 118);
    root.add(g);

    root.add(this.add
      .text(VIEW.w / 2, 60, STRINGS.reconPlaque, {
        fontFamily: FONT, fontSize: '14px', color: css(PAL.graphite), fontStyle: 'bold', letterSpacing: 3,
      })
      .setOrigin(0.5, 0));

    // source → relationship → result, drawn across the room: the framed
    // ticket on the wall, the cyan thread, the platform it makes real.
    root.add(this.add.image(150, 260, textureKey('ticket-big')).setScale(0.55));
    const thread = this.add.graphics();
    thread.lineStyle(2, PAL.cyan, 0.9);
    thread.lineBetween(150, 292, 300, 470);
    thread.lineBetween(300, 478, 700, 478);
    root.add(thread);

    root.add(this.add.image(420, 496, textureKey('mini-slab')).setScale(6.8, 1.6));
    root.add(this.add.image(310, 470, textureKey('mini-train')));
    root.add(this.add.image(RECON.endX + 20, 470, textureKey('witness-post')));
    root.add(this.add
      .text(RECON.endX + 20, 540, 'WITNESS MARK', {
        fontFamily: FONT, fontSize: '10px', color: css(PAL.brass), letterSpacing: 2,
      })
      .setOrigin(0.5, 0));

    this.reconRoot = root;
  }

  buildActor() {
    this.butch = this.add.image(GALLERY.spawn.x, GALLERY.spawn.y, textureKey('butch')).setOrigin(0.5, 1);
  }

  buildOverlays() {
    // Inspect close-up.
    const insp = this.add.container(0, 0).setVisible(false).setDepth(90);
    const dim = this.add.rectangle(VIEW.w / 2, VIEW.h / 2, VIEW.w, VIEW.h, PAL.ink, 0.88);
    const lamp = this.add.triangle(480, 130, 0, 0, -150, 240, 150, 240, PAL.ivory, 0.1);
    const big = this.add.image(480, 300, textureKey('ticket-big')).setScale(1.6);
    const mark = this.add.image(480, 300, textureKey('ticket-mark')).setScale(1.6).setAlpha(0);
    const caption = this.add
      .text(480, 470, '', {
        fontFamily: FONT, fontSize: '13px', color: css(PAL.ivory),
        align: 'center', wordWrap: { width: 700 },
      })
      .setOrigin(0.5, 0);
    insp.add([dim, lamp, big, mark, caption]);
    this.inspectView = { root: insp, big, mark, caption };

    // Completion plaque.
    const comp = this.add.container(0, 0).setVisible(false).setDepth(95);
    const cdim = this.add.rectangle(VIEW.w / 2, VIEW.h / 2, VIEW.w, VIEW.h, PAL.ivory, 0.55);
    const plaqueG = this.add.graphics();
    plaqueG.fillStyle(PAL.ivory, 1);
    plaqueG.fillRect(230, 230, 500, 140);
    plaqueG.lineStyle(2, PAL.brass, 1);
    plaqueG.strokeRect(230, 230, 500, 140);
    plaqueG.lineStyle(1, PAL.graphite, 1);
    plaqueG.strokeRect(236, 236, 488, 128);
    const line1 = this.add
      .text(480, 268, STRINGS.completeLine, {
        fontFamily: FONT, fontSize: '15px', color: css(PAL.graphite), fontStyle: 'bold',
        align: 'center', wordWrap: { width: 460 },
      })
      .setOrigin(0.5, 0);
    const line2 = this.add
      .text(480, 330, STRINGS.completeReset, {
        fontFamily: FONT, fontSize: '11px', color: css(PAL.brass),
      })
      .setOrigin(0.5, 0);
    comp.add([cdim, plaqueG, line1, line2]);
    this.completeView = comp;

    // HUD: controls line, context prompt, transient caption.
    this.add.text(12, VIEW.h - 22, STRINGS.controls, {
      fontFamily: FONT, fontSize: '10px', color: css(PAL.graphiteSoft),
    });
    this.promptText = this.add
      .text(VIEW.w - 12, VIEW.h - 24, '', {
        fontFamily: FONT, fontSize: '13px', color: css(PAL.graphite), fontStyle: 'bold',
      })
      .setOrigin(1, 0);
    this.captionText = this.add
      .text(VIEW.w / 2, VIEW.h - 52, '', {
        fontFamily: FONT, fontSize: '12px', color: css(PAL.ink), fontStyle: 'italic',
        align: 'center', wordWrap: { width: 800 },
      })
      .setOrigin(0.5, 0);

    this.flashRect = this.add.rectangle(VIEW.w / 2, VIEW.h / 2, VIEW.w, VIEW.h, PAL.cyan, 0).setDepth(100);
  }

  // -------------------------------------------------------------- feedback

  flash(color) {
    this.flashRect.setFillStyle(color, 0.22);
    this.tweens.killTweensOf(this.flashRect);
    this.flashRect.alpha = 0.22;
    this.tweens.add({ targets: this.flashRect, alpha: 0, duration: 450 });
  }

  setCaption(text, ms = 3400) {
    this.captionText.setText(text || '');
    this.captionUntil = text ? this.time.now + ms : 0;
  }

  handleEvents(events) {
    for (const ev of events) {
      switch (ev.type) {
        case 'inspect-start':
          this.flash(PAL.amber);
          break;
        case 'rub-blank':
          this.inspectView.caption.setText(STRINGS.rubBlank);
          this.flash(PAL.amber);
          break;
        case 'mark-revealed':
          this.inspectView.caption.setText(STRINGS.markFound);
          this.flash(PAL.cyan);
          break;
        case 'ticket-taken':
          this.setCaption(STRINGS.markFound);
          break;
        case 'ticket-placed':
          this.flash(PAL.amber);
          this.setCaption(ev.caseId === 'A' ? STRINGS.placedA : STRINGS.placedB);
          break;
        case 'rebuild-complete':
          this.flash(ev.caseId === 'A' ? PAL.cyan : PAL.red);
          break;
        case 'route-sealed':
          this.flash(PAL.red);
          this.setCaption(STRINGS.sealedNote, 4200);
          break;
        case 'route-unsealed':
          this.setCaption(STRINGS.unsealedNote);
          break;
        case 'ticket-withdrawn':
          this.setCaption(STRINGS.withdrawn);
          break;
        case 'door-open':
          this.flash(PAL.cyan);
          this.setCaption(STRINGS.doorOpenNote, 4200);
          break;
        case 'room-enter':
        case 'room-exit':
          this.cameras.main.flash(160, 233, 226, 208);
          break;
        case 'slice-complete':
          this.flash(PAL.cyan);
          break;
        default:
          break;
      }
    }
  }

  // ------------------------------------------------------------ per-frame

  readInput() {
    const k = this.keys;
    const left = k.left.isDown || k.a.isDown;
    const right = k.right.isDown || k.d.isDown;
    const up = k.up.isDown || k.w.isDown;
    const down = k.down.isDown || k.s.isDown;
    const moveX = (right ? 1 : 0) - (left ? 1 : 0);
    const inspecting = this.model.snapshot().phase === 'inspect';
    return {
      moveX: inspecting ? 0 : moveX,
      moveY: inspecting ? 0 : (down ? 1 : 0) - (up ? 1 : 0),
      rotate: inspecting ? moveX : 0,
      interact: k.e.isDown,
      back: k.q.isDown,
    };
  }

  update(time, delta) {
    this.model.update(delta, this.readInput());
    this.handleEvents(this.model.drainEvents());
    if (this.captionUntil && time > this.captionUntil) {
      this.captionText.setText('');
      this.captionUntil = 0;
    }
    this.syncFromModel(time);
  }

  syncFromModel(time) {
    const s = this.model.snapshot();
    const action = this.model.availableAction();

    // Actor: position, depth scale, facing, and which room is on stage.
    this.butch.setPosition(s.player.x, s.player.y);
    const inGallery = s.room === 'gallery';
    const floorTop = inGallery ? GALLERY.floorTop : RECON.floorTop;
    const floorBottom = inGallery ? GALLERY.floorBottom : RECON.floorBottom;
    const depth = (s.player.y - floorTop) / Math.max(1, floorBottom - floorTop);
    this.butch.setScale(0.85 + depth * 0.35);
    this.butch.setFlipX(s.player.facing < 0);
    this.galleryRoot.setVisible(inGallery);
    this.reconRoot.setVisible(!inGallery);

    // Ticket location: pedestal / hand / case mount.
    this.ticketSprite.setVisible(s.ticket.where === 'pedestal');
    this.heldTicket.setVisible(s.ticket.where === 'held');
    if (s.ticket.where === 'held') {
      this.heldTicket.setPosition(s.player.x + s.player.facing * 14, s.player.y - 34);
    }

    // Glass cases: rebuild both interpretations from pure progress.
    for (const id of ['A', 'B']) {
      const cs = s.cases[id];
      const v = this.caseViews[id];
      const interp = cs.interpretation || (id === 'A' ? 'departure' : 'error');
      const p = easeOut(cs.progress);
      v.rubble.setAlpha(Math.max(0, 1 - cs.progress * 1.6));
      for (const pieceList of Object.values(v.pieces)) {
        for (const piece of pieceList) piece.img.setAlpha(0);
      }
      if (cs.buildState !== 'empty') {
        for (const piece of v.pieces[interp]) {
          piece.img.setPosition(
            piece.from.x + (piece.to.x - piece.from.x) * p,
            piece.from.y + (piece.to.y - piece.from.y) * p,
          );
          piece.img.setAlpha(Math.min(1, Math.max(0, (cs.progress - 0.12) / 0.5)));
        }
      }
      v.mount.setAlpha(cs.occupant === 'ticket' ? 1 : 0);

      // source → relationship → result thread: amber while the signal
      // travels, cyan/red once the interpretation holds.
      v.thread.clear();
      if (cs.buildState === 'building') {
        const pulse = 0.45 + 0.35 * Math.sin(time / 90);
        v.thread.lineStyle(2, PAL.amber, pulse);
        v.thread.lineBetween(v.cx - 60, 352, v.cx, 420);
      } else if (cs.buildState === 'active') {
        v.thread.lineStyle(2, interp === 'departure' ? PAL.cyan : PAL.red, 0.9);
        v.thread.lineBetween(v.cx - 60, 352, v.cx, 420);
      }
      const glowColor =
        cs.buildState === 'building' ? PAL.amber : interp === 'departure' ? PAL.cyan : PAL.red;
      const glowAlpha = cs.buildState === 'empty' ? 0 : cs.buildState === 'building' ? 0.1 : 0.14;
      v.glow.setFillStyle(glowColor, glowAlpha);
    }

    // Route door: grate travel, glow, seal, plaque.
    this.grate.y = this.grateBaseY - s.route.doorProgress * 122;
    this.doorGlow.setFillStyle(PAL.cyan, s.route.doorProgress * 0.4);
    this.seal.setAlpha(s.route.sealed ? 1 : 0);
    if (s.route.sealed) {
      this.doorPlaque.setText(STRINGS.doorPlaqueClosed).setColor(css(PAL.red));
    } else if (s.route.open) {
      this.doorPlaque.setText(STRINGS.doorPlaqueOpen).setColor(css(PAL.cyan));
    } else {
      this.doorPlaque.setText(STRINGS.doorPlaqueClosed).setColor(css(PAL.graphiteSoft));
    }

    // Inspect overlay.
    const inspecting = s.phase === 'inspect';
    this.inspectView.root.setVisible(inspecting);
    if (inspecting) {
      const rad = Phaser.Math.DegToRad(s.ticket.rotDeg);
      this.inspectView.big.setRotation(rad);
      this.inspectView.mark.setRotation(rad);
      const revealed = s.ticket.markRevealed;
      this.inspectView.mark.setAlpha(revealed ? 0.85 + 0.15 * Math.sin(time / 160) : 0);
    }

    // Completion.
    this.completeView.setVisible(s.phase === 'complete');

    // Context prompt from the shared contract.
    const d = describeState(s, action);
    const promptMap = {
      'examine-ticket': STRINGS.promptExamine,
      'place-A': STRINGS.promptPlaceA,
      'place-B': STRINGS.promptPlaceB,
      'withdraw-A': STRINGS.promptWithdrawA,
      'withdraw-B': STRINGS.promptWithdrawB,
      'inspect-turn': STRINGS.promptInspectTurn,
      'inspect-take': STRINGS.promptInspectTake,
      complete: '',
    };
    this.promptText.setText(d.prompt ? promptMap[d.prompt] || '' : '');
  }

  renderToText() {
    return describeState(this.model.snapshot(), this.model.availableAction());
  }
}
