import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../constants.js';
import { Heightfield, playVoidDeath, synthThud, synthBuzz, makeTorsoTextures } from './torso.js';
import { AUG_TUNE, PSY_TUNE, makeAugTextures, AugPlayer, Psycho } from './aug.js';

/**
 * L2-2 「拼接」 — THE UPGRADE, level two of three (docs/chapter2-redesign.md §4).
 *
 * Flow: ATTACH cutscene (the prosthetic takes the torso, jump comes back
 * stronger) → PLAY: learn the grapple arm on a flat anchor, learn it under
 * pressure in the patrol zone, then the combined gauntlet (pit + anchor +
 * psychos) — with the Ernest corridor as the emotional valley in the middle.
 *
 * Metal absorption is always on: shards fly to the body and stay. Killing
 * feeds the parasite. 5 psychos + Ernest. Player has 3 lives; contact = 1.
 * Death = gore, respawn at this level's start. The chapter flows on to L2-3.
 */

// ------------------------------------------------------------------- layout

const L2 = {
  ground: 500,
  killY: 780,
  spawn: { x: 120, y: 500 },
  worldEnd: 6000,
  elevatorX: 5850,

  contour: [
    { x: 0, y: 500 },
    { x: 700, y: 505 },
    { x: 940, y: 505 },
    // GAP A 950–1230: too wide for the jump — the arm teaches itself here
    { x: 1240, y: 505 },
    { x: 1680, y: 505 },
    { x: 1730, y: 468 }, // small rubble bump — a hop, not a wall
    { x: 1780, y: 505 },
    { x: 2500, y: 500 },
    // Ernest corridor: dead flat, dead quiet
    { x: 3450, y: 500 },
    // PIT B 3500–3820: swing
    { x: 3830, y: 505 },
    { x: 4390, y: 505 },
    // PIT C 4400–4720: swing
    { x: 4730, y: 505 },
    { x: 4940, y: 505 },
    // CHASM D 4950–5600: three-ring web-swing chain
    { x: 5610, y: 505 },
    { x: 6000, y: 505 },
  ],
  gaps: [
    { from: 950, to: 1230 },
    { from: 3500, to: 3820 },
    { from: 4400, to: 4720 },
    { from: 4950, to: 5600 },
  ],

  anchors: [
    { x: 1090, y: 330 }, // teaching: high over gap A — jump can't make it
    { x: 2000, y: 350 }, // optional: swing into the patrol zone
    { x: 3660, y: 330 }, // pit B
    { x: 4560, y: 330 }, // pit C
    { x: 5100, y: 340 }, // chasm ring 1
    { x: 5270, y: 318 }, // chasm ring 2
    { x: 5440, y: 340 }, // chasm ring 3
  ],

  psychos: [
    { x: 1500 },
    { x: 1950 },
    { x: 2300 },
    { x: 4050 },
    { x: 4300 },
    { x: 4800 },
  ],

  shardSpots: [
    [620, 470], [760, 465], [900, 470],
    [1300, 470], [1500, 465], [1750, 470], [2100, 465], [2350, 470],
    [3900, 470], [4150, 465], [4350, 470],
    [4750, 470], [4900, 465],
    [5650, 470], [5800, 465],
  ],

  absorbStages: { half: 12, shoulders: 22 }, // §5.1: scattered → half-covered → shoulder mound

  ernest: { triggerX: 2550, spawnX: 3300, stopDist: 150, exitX: 3560 },
};

const POEM = [
  'Two roads diverged in a wood, and I—',
  'I took the one less traveled by,',
  'And that has made all the difference.',
];

export default class Level22Scene extends Phaser.Scene {
  constructor() {
    super('Level22');
  }

  create() {
    this.phase = 'ATTACH';
    makeTorsoTextures(this);
    makeAugTextures(this);

    this.field = new Heightfield(L2.contour, L2.gaps);
    this.buildBackdrop();
    this.field.draw(this, { maxX: L2.worldEnd + 50, bottom: 800, fill: 0x0e1219 });
    this.buildDecor();
    this.buildAnchors();
    this.buildShards();
    this.buildElevator();

    this.psychos = [];
    this.hitstopUntil = 0;
    this.slow = 1; // kill slow-mo factor (real-time, independent of Phaser clock)
    this.ePrev = false;
    this.ernestState = 'idle'; // idle|approach|speak|leave|done
    this.ernestDone = this.registry.get('ch2.ernest') !== undefined;

    this.keys = this.input.keyboard.addKeys({
      left: 'LEFT',
      right: 'RIGHT',
      a: 'A',
      d: 'D',
      jump: 'SPACE',
      j: 'J',
      e: 'E',
      shift: 'SHIFT',
      enter: 'ENTER',
    });
    this.input.keyboard.addCapture(['SPACE', 'LEFT', 'RIGHT']);
    this.input.on('pointerdown', () => { this.pointerSlash = true; });

    this.cameras.main.setBounds(0, 0, L2.worldEnd + 200, 800);

    this.hint = this.add
      .text(GAME_W / 2, GAME_H - 22, '', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '12px',
        color: '#5d6a78',
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(60);

    this.buildAttachSite();
    // One take from L2-1: the prosthetic's cold glow fills the frame, then
    // recedes into the chamber — no black, the light IS the cut.
    const veil = this.add
      .rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x9fd8e8, 1)
      .setScrollFactor(0)
      .setDepth(100)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: veil, alpha: 0, duration: 750, onComplete: () => veil.destroy() });
  }

  // ---------------------------------------------------------------- backdrop

  buildBackdrop() {
    // Underground dark, rust and green (SOMA palette, §7).
    const sky = this.add.graphics().setScrollFactor(0).setDepth(0);
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      sky.fillStyle(Phaser.Display.Color.GetColor(8 + 6 * t, 10 + 5 * t, 10 + 5 * t), 1);
      sky.fillRect(0, (GAME_H / 40) * i, GAME_W, GAME_H / 40 + 1);
    }

    // Pipe forest — parallax verticals.
    const pipes = this.add.graphics().setScrollFactor(0.35).setDepth(1);
    let x = -40;
    let seed = 29;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    while (x < 8000) {
      const w = 14 + rnd() * 30;
      pipes.fillStyle(rnd() < 0.3 ? 0x14201c : 0x10161d, 1);
      pipes.fillRect(x, 60 + rnd() * 120, w, 700);
      if (rnd() < 0.35) {
        pipes.fillStyle(0x1d2a26, 1);
        pipes.fillRect(x - 6, 200 + rnd() * 200, w + 12, 10); // flange
      }
      x += w + 30 + rnd() * 90;
    }

    // Emergency red washes.
    [1400, 3600, 5300].forEach((rx) => {
      const r = this.add
        .rectangle(rx, 300, 700, 420, 0x5c1216, 0.05)
        .setDepth(1);
      this.tweens.add({ targets: r, alpha: 0.55, duration: 900, yoyo: true, repeat: -1 });
    });
  }

  buildDecor() {
    const g = this.add.graphics().setDepth(2);

    // Culture pods with floating bodies (§4.5) — silhouettes, occasional bubbles.
    [800, 1750, 2950, 4050, 4900].forEach((px, i) => {
      g.fillStyle(0x0e1a16, 0.95);
      g.fillRoundedRect(px, 240, 60, 200, 10);
      g.fillStyle(0x1d3a2e, 0.6);
      g.fillRoundedRect(px + 5, 245, 50, 190, 8);
      // the thing inside
      g.fillStyle(0x27443e, 0.75);
      g.fillEllipse(px + 30, 330, 22, 34); // torso
      g.fillCircle(px + 30, 296, 10); // head
      g.fillEllipse(px + 18, 352, 8, 22); // limbs adrift
      g.fillEllipse(px + 42, 350, 8, 22);
      this.add
        .particles(px + 30, 420, 'ch2-mote', {
          speedY: { min: -40, max: -18 },
          speedX: { min: -4, max: 4 },
          lifespan: 2600,
          quantity: 1,
          frequency: 1400 + i * 300,
          scale: { min: 0.2, max: 0.5 },
          alpha: { start: 0.5, end: 0 },
          tint: 0x3fbf8e,
        })
        .setDepth(2);
    });

    // Limb piles as terrain dressing.
    [1150, 2350, 3850, 4650].forEach((lx) => {
      const gy = this.field.groundAt(lx) ?? 505;
      g.fillStyle(0x241d1b, 1);
      g.fillEllipse(lx, gy - 6, 70, 18);
      g.fillEllipse(lx - 20, gy - 12, 30, 12);
      g.fillEllipse(lx + 22, gy - 10, 26, 10);
      g.fillStyle(0x3a2e2a, 0.8);
      g.fillEllipse(lx - 8, gy - 14, 18, 7); // a pale forearm on top
    });

    // Conveyor hooks with dangling arms (decor anim).
    [2050, 3350, 4550].forEach((hx, i) => {
      const arm = this.add.image(hx, 150, 'ch2-psy-limb').setOrigin(0.5, 0).setDepth(2).setAlpha(0.7);
      this.add.graphics().lineStyle(1, 0x2a3442, 1).setDepth(2).lineBetween(hx, 60, hx, 150);
      this.tweens.add({
        targets: arm,
        rotation: 0.35,
        duration: 2200 + i * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  buildAnchors() {
    this.anchorImgs = L2.anchors.map((a) => {
      const img = this.add.image(a.x, a.y, 'ch2-anchor').setDepth(3);
      const glow = this.add
        .image(a.x, a.y, 'ch2-mote')
        .setScale(5)
        .setTint(0x9fd8e8)
        .setAlpha(0.18)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(2);
      this.tweens.add({ targets: glow, alpha: 0.34, duration: 1100, yoyo: true, repeat: -1 });
      return img;
    });
  }

  buildShards() {
    this.shards = L2.shardSpots.map(([x, y]) => this.spawnShard(x, y, true));
  }

  spawnShard(x, y, idle = false) {
    const img = this.add.image(x, y, 'ch2-shard').setDepth(3);
    const s = { img, x, y, vx: 0, vy: 0, state: idle ? 'idle' : 'fall' };
    if (idle) this.tweens.add({ targets: img, y: y - 4, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return s;
  }

  buildElevator() {
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x0d1118, 1);
    g.fillRect(L2.elevatorX, 340, 110, 170);
    const rim = this.add.graphics().setDepth(3);
    rim.lineStyle(2, 0x9fd8e8, 0.9);
    rim.strokeRect(L2.elevatorX, 340, 110, 170);
    const spill = this.add
      .image(L2.elevatorX + 55, 420, 'ch2-mote')
      .setScale(18, 12)
      .setTint(0x9fd8e8)
      .setAlpha(0.12)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(2);
    this.tweens.add({ targets: spill, alpha: 0.26, duration: 1700, yoyo: true, repeat: -1 });
    this.add
      .text(L2.elevatorX + 55, 318, 'ASCENT →', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '12px',
        color: '#9fd8e8',
      })
      .setOrigin(0.5, 1)
      .setDepth(3);
  }

  buildLivesHud() {
    this.lifeImgs = [];
    for (let i = 0; i < AUG_TUNE.lives; i++) {
      const img = this.add
        .image(GAME_W - 20 - i * 22, 20, 'ch2-aug-body')
        .setScale(0.65)
        .setScrollFactor(0)
        .setDepth(60);
      this.lifeImgs.push(img);
    }
  }

  refreshLivesHud() {
    this.lifeImgs.forEach((img, i) => img.setAlpha(i < this.player.lives ? 1 : 0.15));
  }

  // --------------------------------------------------------- attach cutscene

  buildAttachSite() {
    // The torso rolls in from the left; the prosthetic waits where L2-1 ended.
    this.siteBlob = this.add.image(60, L2.ground - 15, 'ch2-blob').setDepth(5);
    this.siteProsthetic = this.add.image(360, L2.ground - 20, 'ch2-prosthetic').setDepth(4);
    this.siteGlow = this.add
      .image(360, L2.ground - 20, 'ch2-mote')
      .setScale(10)
      .setTint(0x9fd8e8)
      .setAlpha(0.25)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(3);
    this.tweens.add({ targets: this.siteGlow, alpha: 0.4, duration: 1100, yoyo: true, repeat: -1 });

    this.cameras.main.centerOn(260, 380);
    this.attachT0 = this.time.now + 600;
    this.attachStep = 0;
    this.hint.setText('');
  }

  updateAttach() {
    const t = this.time.now - this.attachT0;
    const b = this.siteBlob;
    if (this.attachStep === 0 && t > 0) {
      // The torso rolls itself the last meters — no input, no limbs.
      this.tweens.add({
        targets: b,
        x: 330,
        rotation: 4,
        duration: 1800,
        ease: 'Quad.easeOut',
      });
      this.attachStep = 1;
    } else if (this.attachStep === 1 && t > 2100) {
      // The metal unfolds and takes the body. Four rivets, four limbs.
      this.siteGlow.setAlpha(0.6);
      synthBuzz(this, { freq: 320, dur: 0.12, gain: 0.12 });
      this.attachStep = 2;
      this.attachRivets = 0;
      this.attachRivetAt = t;
    } else if (this.attachStep === 2) {
      const n = Math.floor((t - this.attachRivetAt) / 450);
      if (n > this.attachRivets && this.attachRivets < 4) {
        this.attachRivets++;
        synthBuzz(this, { freq: 180 + n * 40, dur: 0.1, gain: 0.14 });
        this.cameras.main.shake(60, 0.002);
        this.add
          .particles(360, L2.ground - 30, 'ch2-mote', {
            speed: { min: 60, max: 180 },
            lifespan: 350,
            quantity: 8,
            scale: { min: 0.3, max: 0.7 },
            tint: [0x9fd8e8, 0xd8f4fc],
            blendMode: Phaser.BlendModes.ADD,
            emitting: false,
          })
          .setDepth(6)
          .explode(8);
      }
      if (this.attachRivets >= 4 && t - this.attachRivetAt > 2100) {
        this.attachStep = 3;
        // Metal stands where flesh lay.
        this.siteBlob.setVisible(false);
        this.siteProsthetic.setVisible(false);
        this.siteGlow.setVisible(false);
        this.player = new AugPlayer(this, { x: 355, y: this.field.groundAt(355) }, this.field);
        this.cameras.main.startFollow(this.player.fig, true, 0.1, 0.1);
        this.cameras.main.setFollowOffset(0, 60);
        this.buildLivesHud();
        synthThud(this, { freq: 90, gain: 0.4, dur: 0.4 });
        this.cameras.main.flash(200, 159, 216, 232);
        this.attachStep = 4;
        this.attachDoneAt = t;
      }
    } else if (this.attachStep === 4 && t - this.attachDoneAt > 900) {
      this.phase = 'PLAY';
      this.hint.setText('A/D — move · SPACE — jump (restored) · SHIFT — rush · J / LMB — slash · E — swing');
      this.spawnPsychos();
    }
  }

  spawnPsychos() {
    this.psychos.forEach((p) => p.destroy());
    this.psychos = L2.psychos.map((cfg) => new Psycho(this, cfg.x, this.field));
  }

  // ------------------------------------------------------------------- play

  readInput() {
    const k = this.keys;
    // E needs a true single-frame edge: JustDown's 50ms window spans ~3
    // frames, which would attach → detach → re-attach in one press.
    const eDown = k.e.isDown;
    const arm = eDown && !this.ePrev;
    this.ePrev = eDown;
    return {
      left: k.left.isDown || k.a.isDown,
      right: k.right.isDown || k.d.isDown,
      jump: Phaser.Input.Keyboard.JustDown(k.jump),
      slash: Phaser.Input.Keyboard.JustDown(k.j) || this.consumePointerSlash(),
      arm,
      dash: Phaser.Input.Keyboard.JustDown(k.shift),
    };
  }

  consumePointerSlash() {
    const v = this.pointerSlash;
    this.pointerSlash = false;
    return !!v;
  }

  updatePlay(dt, now) {
    const p = this.player.p;

    // Hitstop: the world holds its breath (design §4.3 — 70ms per hit).
    if (now < this.hitstopUntil) return;

    const input = this.ernestState === 'speak'
      ? { left: false, right: false, jump: false, slash: false, arm: false }
      : this.readInput();

    // Grapple arm overrides normal movement while active.
    if (this.armState) {
      this.updateArm(dt, now, input);
    } else {
      const wasDashing = now < this.player.dashUntil;
      const ev = this.player.step(dt, input, { worldEnd: L2.worldEnd });
      if (ev === 'land') {
        synthThud(this, { freq: 130, gain: 0.18, dur: 0.15 });
        this.dustPuff(p.x, p.y);
      } else if (ev === 'dashing' && !wasDashing) {
        this.dashFx(p);
      }
      if (input.slash) this.trySlash(now);
      if (input.arm) this.startArm(now);
    }
    this.player.animate(dt);

    // Psychos.
    for (const psy of this.psychos) {
      if (!psy.alive) continue;
      const contact = psy.step(dt, p, now);
      if (contact && !this.player.hurt && !p.dead && this.ernestState !== 'speak') {
        this.hurtPlayer(psy);
      }
    }

    // Ernest.
    this.updateErnest(dt, now, input);

    // Shard magnetism — the parasite feeds.
    this.updateShards(dt);

    // Void death.
    if (p.y > L2.killY && !p.dead) {
      p.dead = true;
      playVoidDeath(this, () => this.whipBack(() => this.respawn()));
    }

    // The elevator out.
    if (p.x > L2.elevatorX - 30 && this.phase === 'PLAY') this.startEnd();
  }

  dustPuff(x, y) {
    this.add
      .particles(x, y - 2, 'ch2-mote', {
        speed: { min: 30, max: 90 },
        lifespan: 350,
        quantity: 6,
        scale: { min: 0.3, max: 0.6 },
        tint: 0x4a5563,
        emitting: false,
      })
      .setDepth(6)
      .explode(6);
  }

  /** SHIFT rush: whoosh, speed lines, a cold smear behind the body. */
  dashFx(p) {
    synthBuzz(this, { freq: 620, dur: 0.16, gain: 0.1 });
    this.add
      .particles(p.x, p.y - 32, 'ch2-mote', {
        speed: { min: 200, max: 420 },
        angle: p.dashDir > 0 ? { min: 160, max: 200 } : { min: -20, max: 20 },
        lifespan: { min: 150, max: 320 },
        quantity: 14,
        scale: { min: 0.4, max: 1 },
        tint: [0x9fd8e8, 0xd8f4fc, 0x5d6a78],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(6)
      .explode(14);
    this.cameras.main.shake(70, 0.0018);
  }

  // ------------------------------------------------------------------- slash

  trySlash(now) {
    if (now < this.player.slashReadyAt) return;
    this.player.slashReadyAt = now + AUG_TUNE.slashCooldown;
    const p = this.player.p;
    const fx = p.facing;

    // Attack momentum: the body commits to the cut.
    if (p.grounded) p.x += fx * 12;
    else p.vx += fx * 130;

    // Slash flash.
    const arc = this.add
      .rectangle(p.x + fx * 34, p.y - 34, 52, 8, 0xd8f4fc, 0.85)
      .setDepth(7)
      .setRotation(fx * 0.5);
    this.tweens.add({
      targets: arc,
      alpha: 0,
      scaleX: 1.6,
      duration: 110,
      onComplete: () => arc.destroy(),
    });
    synthBuzz(this, { freq: 900, dur: 0.08, gain: 0.07 }); // the cut through air

    const targets = [...this.psychos.filter((s) => s.alive)];
    if (this.ernest && this.ernest.alive) targets.push(this.ernest);

    let anyKill = false;
    let anyHit = false;
    for (const t of targets) {
      const dx = (t.p.x - p.x) * fx;
      const dy = Math.abs((t.p.y - 30) - (p.y - 34));
      if (dx > 0 && dx < AUG_TUNE.slashReach + 16 && dy < AUG_TUNE.slashArc) {
        const res = t.takeHit(p.x);
        anyHit = true;
        this.slashFeedback(t, res === 'dead');
        if (res === 'dead') {
          anyKill = true;
          this.onPsychoDead(t);
        }
      }
    }
    if (anyKill) {
      this.hitstopUntil = now + AUG_TUNE.killHitstopMs;
      // Slow-mo punch after the freeze: the world drags, the gore doesn't.
      this.slow = 0.35;
      setTimeout(() => {
        this.slow = 1;
      }, 150);
      // Zoom punch.
      this.tweens.add({
        targets: this.cameras.main,
        zoom: 1.06,
        duration: 80,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    } else if (anyHit) {
      this.hitstopUntil = now + AUG_TUNE.hitstopMs;
    }
  }

  /** Every slash that lands: the full feedback chain (design §4.3). */
  slashFeedback(target, killed) {
    const { x, y } = { x: target.p.x, y: target.p.y - 32 };
    this.cameras.main.shake(killed ? 190 : 90, killed ? 0.011 : 0.005);
    // Impact flash — a white-hot point where the blade met.
    const flash = this.add
      .image(x, y, 'ch2-mote')
      .setScale(killed ? 16 : 9)
      .setTint(0xd8f4fc)
      .setAlpha(0.8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(8);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: killed ? 26 : 14,
      duration: killed ? 220 : 140,
      onComplete: () => flash.destroy(),
    });
    // Metal tear: sawtooth sweep down + a low body thud on the kill.
    synthBuzz(this, { freq: killed ? 700 : 520, dur: killed ? 0.5 : 0.22, gain: killed ? 0.22 : 0.16 });
    if (killed) synthThud(this, { freq: 60, gain: 0.4, dur: 0.5 });
    // Blood AND sparks — flesh and metal in one body.
    this.add
      .particles(x, y, 'ch2-mote', {
        speed: { min: 100, max: killed ? 460 : 320 },
        lifespan: { min: 300, max: killed ? 900 : 700 },
        quantity: killed ? 44 : 22,
        scale: { min: 0.4, max: killed ? 1.7 : 1.2 },
        tint: [0x8e1f24, 0x5c1216, 0xffc46b, 0xff8a3c],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(6)
      .explode(killed ? 44 : 22);
    // Killing feeds the parasite: the body drops shards.
    const drops = killed ? 2 : 1;
    for (let i = 0; i < drops; i++) {
      const s = this.spawnShard(x, y, false);
      s.vx = Phaser.Math.Between(-140, 140);
      s.vy = Phaser.Math.Between(-260, -120);
      this.shards.push(s);
    }
  }

  onPsychoDead(t) {
    // Third hit: the body comes apart — a gout of gibs, the corpse flung.
    this.add
      .particles(t.p.x, t.p.y - 30, 'ch2-gib', {
        speed: { min: 100, max: 420 },
        angle: { min: 200, max: 340 },
        gravityY: 1500,
        lifespan: 1400,
        quantity: 14,
        rotate: { min: -400, max: 400 },
        emitting: false,
      })
      .setDepth(6)
      .explode(14);
    synthThud(this, { freq: 80, gain: 0.35, dur: 0.35 });
    const dir = Math.sign(t.p.x - (t.lastHitFrom ?? this.player.p.x)) || 1;
    this.tweens.add({
      targets: t.fig,
      x: t.p.x + dir * 170,
      y: t.p.y - 90,
      rotation: dir * 2.6,
      alpha: 0,
      duration: 320,
      ease: 'Quad.easeOut',
      onComplete: () => t.fig.setVisible(false),
    });
    if (t === this.ernest) {
      // The world does not comment (design §4.4). It only remembers.
      this.registry.set('ch2.ernest', 'killed');
      this.ernestState = 'done';
      this.ernestDone = true;
      if (this.ernest.glowImg) {
        this.tweens.add({ targets: this.ernest.glowImg, alpha: 0, duration: 800 });
      }
    }
    if (t.glowImg) t.glowImg.setVisible(false);
  }

  // ------------------------------------------------------------- grapple arm

  /**
   * E — web-swing, not a winch (design §4.2, Spider-Man feel):
   * the claw auto-aims the nearest anchor in a generous radius; the rope
   * catches, momentum becomes a pendulum; A/D pumps the swing; the rope
   * reels in slowly so speed builds; SPACE releases with a kick, E drops.
   * Short-range E on a psycho still yanks it in.
   */
  startArm(now) {
    const p = this.player.p;
    const sx = p.x;
    const sy = p.y - 40;

    // Nearest anchor in reach — but motion matters: an anchor ahead of the
    // swing wins over the one behind, so chains flow forward (Spider-Man
    // never re-grabs the web he just left).
    let anchor = null;
    let anchorScore = Infinity;
    let anchorDist = 0;
    const mvx = Math.abs(p.vx) > 60 ? Math.sign(p.vx) : p.facing;
    for (const a of L2.anchors) {
      const d = Phaser.Math.Distance.Between(sx, sy, a.x, a.y);
      if (d >= AUG_TUNE.armReach) continue;
      const ahead = (a.x - sx) * mvx;
      const score = d - Math.max(0, ahead) * 1.5;
      if (score < anchorScore) {
        anchor = a;
        anchorScore = score;
        anchorDist = d;
      }
    }

    if (anchor) {
      this.armState = {
        phase: 'swing',
        anchor,
        ropeLen: Math.max(80, anchorDist),
        // The winch pulls him up INTO the swing — Spider-Man zip, then arc.
        minLen: Math.max(70, anchorDist * 0.45),
        t0: now,
      };
      p.grounded = false;
      p.vy = Math.min(p.vy, -280); // he hops into the swing
      synthBuzz(this, { freq: 340, dur: 0.1, gain: 0.1 }); // the claw bites
      this.add
        .particles(anchor.x, anchor.y, 'ch2-mote', {
          speed: { min: 40, max: 140 },
          lifespan: 250,
          quantity: 8,
          scale: { min: 0.3, max: 0.6 },
          tint: [0x9fd8e8, 0xd8f4fc],
          blendMode: Phaser.BlendModes.ADD,
          emitting: false,
        })
        .setDepth(6)
        .explode(8);
      return;
    }

    // No anchor — is there meat in arm's length?
    const prey = this.psychos.find(
      (s) => s.alive && Math.abs(s.p.x - p.x) < 170 && Math.abs(s.p.y - p.y) < 50,
    );
    if (prey) {
      prey.yankTo(p.x + Math.sign(prey.p.x - p.x || p.facing) * 42);
      this.add
        .particles(prey.p.x, prey.p.y - 32, 'ch2-mote', {
          speed: { min: 60, max: 200 },
          lifespan: 300,
          quantity: 10,
          scale: { min: 0.3, max: 0.7 },
          tint: [0xffc46b, 0x9fd8e8],
          blendMode: Phaser.BlendModes.ADD,
          emitting: false,
        })
        .setDepth(6)
        .explode(10);
      synthBuzz(this, { freq: 220, dur: 0.18, gain: 0.12 });
      return;
    }

    // Whiff: the arm shoots out and comes back empty.
    this.armState = { phase: 'whiff', t0: now, dir: p.facing };
    synthBuzz(this, { freq: 260, dur: 0.12, gain: 0.08 });
  }

  updateArm(dt, now, input) {
    const p = this.player.p;
    const st = this.armState;
    const arm = this.player.arm;
    const T = AUG_TUNE;
    arm.setVisible(true);

    if (st.phase === 'swing') {
      const a = st.anchor;

      // Release: SPACE flings with a kick, E just lets go.
      if (input.jump || input.arm) {
        p.vx *= T.swingReleaseBoost;
        p.vy *= T.swingReleaseBoost;
        if (input.jump) p.vy -= T.swingJumpKick;
        synthBuzz(this, { freq: 500, dur: 0.1, gain: 0.09 });
        this.armState = null;
        arm.setVisible(false);
        return;
      }

      // Pendulum: gravity, optional A/D pump along the tangent.
      p.vy += T.gravity * dt;
      let rx = p.x - a.x;
      let ry = p.y - 40 - a.y;
      let dist = Math.hypot(rx, ry) || 1;
      let pump = 0;
      if (input.left && !input.right) pump = -1;
      else if (input.right && !input.left) pump = 1;
      if (pump !== 0) {
        let tx = -ry / dist;
        let ty = rx / dist;
        if (tx * pump < 0) {
          tx = -tx;
          ty = -ty;
        }
        // Pump only feeds the swing, never brakes it — holding a direction
        // builds energy rhythm-free, like a web-swing should.
        const tv = p.vx * tx + p.vy * ty;
        if (tv > -60) {
          p.vx += tx * T.swingPump * dt;
          p.vy += ty * T.swingPump * dt;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // The rope winches in fast — the zip that lifts him into the arc.
      st.ropeLen = Math.max(st.minLen, st.ropeLen - T.swingReel * dt);

      // Rope constraint: clamp to the circle, kill outward radial velocity.
      rx = p.x - a.x;
      ry = p.y - 40 - a.y;
      dist = Math.hypot(rx, ry) || 1;
      if (dist > st.ropeLen) {
        const nx = rx / dist;
        const ny = ry / dist;
        p.x = a.x + nx * st.ropeLen;
        p.y = a.y + ny * st.ropeLen + 40;
        const vr = p.vx * nx + p.vy * ny;
        if (vr > 0) {
          p.vx -= vr * nx;
          p.vy -= vr * ny;
        }
      }
      p.x = Math.min(p.x, L2.worldEnd);

      // Touch down mid-swing: the run continues on foot. Grace window at
      // the catch — the zip needs a beat to lift him off the floor.
      const gy = this.field.groundAt(p.x);
      if (now - st.t0 > 320 && gy !== null && p.y >= gy && p.vy > 0) {
        p.y = gy;
        p.vy = 0;
        p.grounded = true;
        p.vx = 0;
        this.armState = null;
        arm.setVisible(false);
        synthThud(this, { freq: 130, gain: 0.18, dur: 0.15 });
        this.dustPuff(p.x, p.y);
        return;
      }

      // Draw the arm shoulder → anchor.
      arm.setPosition(p.x, p.y - 40);
      arm.setRotation(Math.atan2(a.y - (p.y - 40), a.x - p.x));
      arm.setFlipY(false);
      arm.setScale(dist / 24, 1);
      return;
    }

    if (st.phase === 'whiff') {
      const u = Math.min(1, (now - st.t0) / 220);
      const len = u < 0.5 ? u * 2 * 150 : (1 - u) * 2 * 150; // out, then back
      arm.setPosition(p.x, p.y - 40);
      arm.setRotation(st.dir < 0 ? Math.PI : 0);
      arm.setScale(Math.max(0.1, len) / 24, 1);
      if (u >= 1) {
        this.armState = null;
        arm.setVisible(false);
      }
    }
  }

  // ------------------------------------------------------------ shards feed

  updateShards(dt) {
    const p = this.player.p;
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      if (s.state === 'fall') {
        s.vy += 1500 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const gy = this.field.groundAt(s.x);
        if (gy !== null && s.y >= gy - 4) {
          s.y = gy - 4;
          s.state = 'idle';
        }
        s.img.setPosition(s.x, s.y);
        s.img.rotation += 3 * dt;
      }
      const dx = p.x - s.x;
      const dy = p.y - 34 - s.y;
      const dist = Math.hypot(dx, dy);
      if (s.state === 'idle' && dist < 130) s.state = 'fly';
      if (s.state === 'fly') {
        const sp = 420 + (130 - Math.min(dist, 130)) * 6;
        s.x += (dx / dist) * sp * dt;
        s.y += (dy / dist) * sp * dt;
        s.img.setPosition(s.x, s.y);
        s.img.rotation += 8 * dt;
        if (dist < 14) {
          s.img.destroy();
          this.shards.splice(i, 1);
          this.absorbShard();
        }
      }
    }
  }

  absorbShard() {
    const n = this.player.absorb();
    synthBuzz(this, { freq: 300 + n * 12, dur: 0.06, gain: 0.06 });
    this.add
      .particles(this.player.p.x, this.player.p.y - 34, 'ch2-mote', {
        speed: { min: 20, max: 80 },
        lifespan: 300,
        quantity: 4,
        scale: { min: 0.3, max: 0.6 },
        tint: 0x9fd8e8,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(6)
      .explode(4);
    // Growth stages (§5.1): scattered → half-covered → shoulder mound.
    if (n === L2.absorbStages.half || n === L2.absorbStages.shoulders) {
      const cluster = n === L2.absorbStages.half ? 6 : 5;
      for (let i = 0; i < cluster; i++) {
        const sx = n === L2.absorbStages.half ? -6 - Math.random() * 6 : -8 + Math.random() * 10;
        const sy = n === L2.absorbStages.half
          ? -44 + Math.random() * 22
          : -56 + Math.random() * 10; // shoulder mound
        const sh = this.add.image(sx, sy, 'ch2-shard');
        sh.setRotation(Math.random() * 6).setScale(1.1);
        this.player.shardLayer.add(sh);
      }
      synthThud(this, { freq: 110, gain: 0.2, dur: 0.3 });
      this.cameras.main.shake(80, 0.002);
    }
  }

  // ------------------------------------------------------------ hurt & death

  hurtPlayer(psy) {
    const p = this.player.p;
    this.player.lives--;
    this.refreshLivesHud();
    this.player.invulnUntil = this.time.now + AUG_TUNE.invulnMs;
    p.vx = (p.x < psy.p.x ? -1 : 1) * 320;
    p.vy = -260;
    p.grounded = false;
    this.cameras.main.flash(150, 140, 20, 26);
    synthBuzz(this, { freq: 200, dur: 0.3, gain: 0.16 });
    this.add
      .particles(p.x, p.y - 32, 'ch2-mote', {
        speed: { min: 80, max: 280 },
        lifespan: { min: 300, max: 600 },
        quantity: 16,
        scale: { min: 0.4, max: 1 },
        tint: [0x8e1f24, 0xb03036],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(6)
      .explode(16);

    if (this.player.lives <= 0) {
      p.dead = true;
      // Death by psycho (design §6): the thing is on top of him, the screen
      // pulses red, a metal arm flies past the lens — then the camera WHIPS
      // back to the section start. No black. The take never breaks.
      this.cameras.main.flash(400, 160, 20, 26);
      synthBuzz(this, { freq: 90, dur: 0.8, gain: 0.2 });
      const armImg = this.add
        .image(-40, 120, 'ch2-aug-arm')
        .setScale(3)
        .setRotation(0.8)
        .setScrollFactor(0)
        .setDepth(80);
      this.tweens.add({
        targets: armImg,
        x: GAME_W + 60,
        y: 300,
        rotation: 5,
        duration: 900,
        ease: 'Quad.easeIn',
      });
      this.add
        .particles(p.x, p.y - 30, 'ch2-mote', {
          speed: { min: 100, max: 400 },
          lifespan: { min: 400, max: 900 },
          quantity: 40,
          scale: { min: 0.5, max: 1.6 },
          tint: [0x8e1f24, 0x5c1216, 0xb03036],
          blendMode: Phaser.BlendModes.ADD,
          emitting: false,
        })
        .setDepth(6)
        .explode(40);
      this.time.delayedCall(650, () => this.whipBack(() => this.respawn()));
    }
  }

  /**
   * One-take respawn: the camera tears back to the spawn point at speed —
   * streaks, a whoosh, a hard shake on arrival. Never a black frame.
   */
  whipBack(onArrive) {
    const cam = this.cameras.main;
    cam.stopFollow();
    const sx = L2.spawn.x + GAME_W / 2 - 200;
    const sy = 420;
    synthBuzz(this, { freq: 140, dur: 0.55, gain: 0.14 });
    // Speed lines against the pan direction.
    const streaks = this.add
      .particles(0, 0, 'ch2-mote', {
        x: { min: 0, max: GAME_W },
        y: { min: 0, max: GAME_H },
        speedX: { min: 900, max: 1600 },
        speedY: 0,
        lifespan: { min: 200, max: 420 },
        quantity: 3,
        frequency: 40,
        scale: { min: 0.3, max: 0.8 },
        alpha: { start: 0.5, end: 0 },
        tint: [0x3a4a5c, 0x5d6a78, 0x9fd8e8],
        blendMode: Phaser.BlendModes.ADD,
        emitting: true,
      })
      .setScrollFactor(0)
      .setDepth(85);
    cam.pan(sx, sy, 620, 'Cubic.easeInOut', true, () => {
      streaks.stop();
      this.time.delayedCall(300, () => streaks.destroy());
      cam.shake(120, 0.004);
      onArrive();
    });
  }

  respawn() {
    const p = this.player.p;
    p.x = L2.spawn.x;
    p.y = this.field.groundAt(L2.spawn.x);
    p.vx = 0;
    p.vy = 0;
    p.grounded = true;
    p.dead = false;
    this.player.lives = AUG_TUNE.lives;
    this.player.invulnUntil = this.time.now + 1500;
    this.refreshLivesHud();
    this.armState = null;
    this.player.arm.setVisible(false);
    // The world resets; what the parasite took, it keeps (shards stay).
    this.spawnPsychos();
    if (!this.ernestDone && this.ernestState !== 'idle') {
      // Ernest event rewinds if it never concluded.
      if (this.ernest) this.ernest.destroy();
      this.ernest = null;
      this.ernestState = 'idle';
      if (this.poemBox) this.poemBox.destroy(true);
    }
    const cam = this.cameras.main;
    cam.centerOn(p.x, 380);
    cam.startFollow(this.player.fig, true, 0.1, 0.1);
    cam.setFollowOffset(0, 60);
    // The body re-forms in a cold blink.
    cam.flash(140, 159, 216, 232);
    synthThud(this, { freq: 100, gain: 0.25, dur: 0.3 });
  }

  // ------------------------------------------------------------------ ernest

  updateErnest(dt, now, input) {
    const E = L2.ernest;
    const p = this.player.p;

    if (this.ernestState === 'idle') {
      if (p.x > E.triggerX && !this.ernestDone) {
        // A cold glow, hopping closer out of the dark — the only light in
        // the corridor (design §4.4).
        this.ernest = new Psycho(this, E.spawnX, this.field, {
          tint: 0xa8d4dc,
          oneLegged: true,
          glow: true,
        });
        this.ernestState = 'approach';
        this.ernestHopAt = 0;
      }
      return;
    }

    if (!this.ernest || !this.ernest.alive) return;
    const ep = this.ernest.p;

    if (this.ernestState === 'approach') {
      // Clumsy but relentless: hop — fall — get up — hop.
      if (ep.grounded) {
        if (now >= this.ernestHopAt) {
          ep.grounded = false;
          ep.vy = -340;
          ep.vx = (p.x < ep.x ? -1 : 1) * 120;
          this.ernestHopAt = now + Phaser.Math.Between(480, 760);
          this.ernestStumble = Math.random() < 0.3;
        }
      } else {
        ep.vy += AUG_TUNE.gravity * dt;
        ep.x += ep.vx * dt;
        ep.y += ep.vy * dt;
        const gy = this.field.groundAt(ep.x);
        if (gy !== null && ep.y >= gy && ep.vy > 0) {
          ep.y = gy;
          ep.vy = 0;
          ep.grounded = true;
          ep.vx = 0;
          if (this.ernestStumble) {
            // falls over, takes a moment, gets back up
            this.ernest.fig.setRotation(-Math.PI / 2 * this.ernest.facing);
            this.ernestHopAt = now + 750;
            synthThud(this, { freq: 100, gain: 0.12, dur: 0.2 });
            this.time.delayedCall(700, () => {
              if (this.ernest && this.ernest.alive) this.ernest.fig.setRotation(0);
            });
          }
        }
      }
      this.ernest.facing = p.x < ep.x ? -1 : 1;
      this.ernest.animate(dt, now);
      // He reaches him — and just stops.
      if (Math.abs(p.x - ep.x) < E.stopDist && ep.grounded) {
        this.ernestState = 'speak';
        this.ernest.facing = p.x < ep.x ? -1 : 1;
        this.ernest.fig.setScale(this.ernest.facing, 1);
        this.ernest.parts.head.setRotation(-0.3 * this.ernest.facing); // looks up
        this.showPoem(now);
      }
      return;
    }

    if (this.ernestState === 'leave') {
      if (ep.grounded && now >= this.ernestHopAt) {
        ep.grounded = false;
        ep.vy = -320;
        ep.vx = 150;
        this.ernestHopAt = now + Phaser.Math.Between(420, 600);
      } else if (!ep.grounded) {
        ep.vy += AUG_TUNE.gravity * dt;
        ep.x += ep.vx * dt;
        ep.y += ep.vy * dt;
        const gy = this.field.groundAt(ep.x);
        if (gy !== null && ep.y >= gy && ep.vy > 0) {
          ep.y = gy;
          ep.vy = 0;
          ep.grounded = true;
          ep.vx = 0;
        }
      }
      // The dark takes him back, a few pixels of alpha at a time.
      if (ep.x > 3400) this.ernest.fig.setAlpha(Math.max(0, 1 - (ep.x - 3400) / 160));
      if (this.ernest.glowImg) {
        this.ernest.glowImg.setAlpha(Math.max(0, 0.3 - (ep.x - 3400) / 500));
        this.ernest.glowImg.setPosition(ep.x, ep.y - 32);
      }
      this.ernest.animate(dt, now);
      if (ep.x > E.exitX) {
        this.ernest.destroy();
        this.ernestState = 'done';
        this.ernestDone = true;
        this.registry.set('ch2.ernest', 'spared');
        // Seconds later, far away: one muffled thump, one flash — out.
        this.time.delayedCall(2200, () => {
          synthThud(this, { freq: 40, gain: 0.3, dur: 1.2 });
          const flash = this.add
            .image(E.exitX + 80, 470, 'ch2-mote')
            .setScale(20)
            .setTint(0x9fd8e8)
            .setAlpha(0)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(3);
          this.tweens.add({
            targets: flash,
            alpha: 0.5,
            duration: 120,
            yoyo: true,
            onComplete: () => flash.destroy(),
          });
        });
      }
    }
  }

  showPoem(now) {
    // Third-person quote box: no speaker name, no role line (design §4.4).
    // The signature at the bottom-right is the only way his name is known.
    const box = this.add.container(GAME_W / 2, GAME_H - 190).setDepth(70).setScrollFactor(0);
    this.poemBox = box;
    const bg = this.add.rectangle(0, 0, 680, 168, 0x05070c, 0.92).setStrokeStyle(1, 0x3a4a5c, 0.8);
    const t1 = this.add
      .text(-320, -64, '', { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '14px', color: '#9fb4c4', fontStyle: 'italic' })
      .setOrigin(0, 0);
    const t2 = this.add
      .text(-320, -34, '', { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '14px', color: '#9fb4c4', fontStyle: 'italic' })
      .setOrigin(0, 0);
    const t3 = this.add
      .text(-320, -4, '', { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '14px', color: '#9fb4c4', fontStyle: 'italic' })
      .setOrigin(0, 0);
    const sig = this.add
      .text(320, 46, '—— Ernest', { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '14px', color: '#7f8b99', fontStyle: 'italic' })
      .setOrigin(1, 0)
      .setAlpha(0);
    box.add([bg, t1, t2, t3, sig]);
    box.setAlpha(0);
    this.tweens.add({ targets: box, alpha: 1, duration: 500 });

    // Lines surface one by one.
    const lines = [t1, t2, t3];
    let li = 0;
    const typeNext = () => {
      if (li >= POEM.length) {
        this.tweens.add({ targets: sig, alpha: 1, duration: 700 });
        this.time.delayedCall(3400, () => {
          this.tweens.add({
            targets: box,
            alpha: 0,
            duration: 700,
            onComplete: () => box.destroy(true),
          });
          if (this.ernest && this.ernest.alive) {
            this.ernest.parts.head.setRotation(0);
            this.ernest.facing = 1; // turns back the way he came
            this.ernest.fig.setScale(1, 1);
            this.ernestHopAt = this.time.now + 400;
            this.ernestState = 'leave';
          } else {
            this.ernestState = 'done';
          }
        });
        return;
      }
      const txt = lines[li];
      const full = POEM[li];
      li++;
      let ci = 0;
      const timer = this.time.addEvent({
        delay: 34,
        repeat: full.length - 1,
        callback: () => {
          ci++;
          txt.setText(full.slice(0, ci));
          if (ci >= full.length) this.time.delayedCall(420, typeNext);
        },
      });
    };
    this.time.delayedCall(600, typeNext);
  }

  // --------------------------------------------------------------------- end

  startEnd() {
    this.phase = 'END';
    const p = this.player.p;
    this.hint.setText('');
    this.registry.set('ch2.shards', this.player.shards);
    // He walks into the light; the metal carries him the last steps.
    this.tweens.add({
      targets: p,
      x: L2.elevatorX + 55,
      duration: 900,
      ease: 'Quad.easeOut',
      onUpdate: () => this.player.animate(1 / 60),
    });
    this.time.delayedCall(1100, () => this.riseToLevel23());
  }

  /**
   * One take up the shaft: the lift rises, pre-dawn light bleeds in from
   * above and swallows the frame — L2-3 opens inside the same light.
   */
  riseToLevel23() {
    if (this.advancing) return;
    this.advancing = true;
    const p = this.player.p;
    const cam = this.cameras.main;
    synthThud(this, { freq: 55, gain: 0.3, dur: 1.6 });
    cam.shake(1600, 0.002);
    // Cables and shaft walls streak past, downward.
    const streaks = this.add
      .particles(0, 0, 'ch2-mote', {
        x: { min: 0, max: GAME_W },
        y: { min: -20, max: GAME_H },
        speedY: { min: 500, max: 900 },
        speedX: 0,
        lifespan: { min: 300, max: 700 },
        quantity: 2,
        frequency: 60,
        scale: { min: 0.3, max: 0.7 },
        alpha: { start: 0.4, end: 0 },
        tint: [0x3a4a5c, 0x5d6a78],
        blendMode: Phaser.BlendModes.ADD,
        emitting: true,
      })
      .setScrollFactor(0)
      .setDepth(85);
    // The light from the surface grows — warm grey, not cold.
    const dawn = this.add
      .rectangle(GAME_W / 2, 0, GAME_W, GAME_H, 0x8a94b0, 0)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(90)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: dawn, alpha: 0.95, duration: 1500, ease: 'Quad.easeIn' });
    cam.pan(p.x, 260, 1500, 'Quad.easeIn', true, () => {
      streaks.destroy();
      this.scene.start('Level23');
    });
  }

  // ------------------------------------------------------------------ update

  update(_, deltaMs) {
    const dt = (Math.min(deltaMs, 50) / 1000) * this.slow;
    const now = this.time.now;

    switch (this.phase) {
      case 'ATTACH':
        this.updateAttach();
        break;
      case 'PLAY':
        this.updatePlay(dt, now);
        break;
    }
  }
}
