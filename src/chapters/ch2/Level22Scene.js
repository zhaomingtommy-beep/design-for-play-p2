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
  worldEnd: 5720,
  elevatorX: 5600,

  contour: [
    { x: 0, y: 500 },
    { x: 700, y: 505 },
    { x: 950, y: 505 },
    { x: 1000, y: 445 }, // rubble wall — first anchor teaches the pull
    { x: 1050, y: 505 },
    { x: 1240, y: 505 },
    // GAP 1250–1410: anchor mid-air
    { x: 1420, y: 505 },
    { x: 2500, y: 500 },
    // Ernest corridor: dead flat, dead quiet
    { x: 3450, y: 500 },
    // PIT 3500–3680: anchor pull
    { x: 3690, y: 505 },
    { x: 4380, y: 505 },
    // PIT 4400–4600: anchor pull
    { x: 4610, y: 505 },
    { x: 4930, y: 505 },
    // CHASM 4950–5450: three-ring chain
    { x: 5460, y: 505 },
    { x: 5720, y: 505 },
  ],
  gaps: [
    { from: 1250, to: 1410 },
    { from: 3500, to: 3680 },
    { from: 4400, to: 4600 },
    { from: 4950, to: 5450 },
  ],

  anchors: [
    { x: 1030, y: 455 }, // teaching: over the rubble wall, grabbable standing
    { x: 1330, y: 445 }, // over the first gap
    { x: 3590, y: 465 }, // pit 1
    { x: 4500, y: 465 }, // pit 2
    { x: 5080, y: 450 }, // chasm ring 1
    { x: 5210, y: 440 }, // chasm ring 2
    { x: 5340, y: 450 }, // chasm ring 3
  ],

  psychos: [
    { x: 1900 },
    { x: 2250 },
    { x: 3900 },
    { x: 4200 },
    { x: 4750 },
  ],

  shardSpots: [
    [620, 470], [760, 465], [900, 470], [1120, 470],
    [1500, 470], [1650, 465], [1800, 470], [2100, 465],
    [2400, 470], [2600, 465], [3750, 470], [4100, 465],
    [4300, 470], [4680, 465], [5500, 470],
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
    this.cameras.main.fadeIn(700, 0, 0, 0);
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
      this.hint.setText('A/D — move · SPACE — jump (restored, stronger) · J / LMB — slash · E — grapple arm');
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
    return {
      left: k.left.isDown || k.a.isDown,
      right: k.right.isDown || k.d.isDown,
      jump: Phaser.Input.Keyboard.JustDown(k.jump),
      slash: Phaser.Input.Keyboard.JustDown(k.j) || this.consumePointerSlash(),
      arm: Phaser.Input.Keyboard.JustDown(k.e),
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
      const ev = this.player.step(dt, input, { worldEnd: L2.worldEnd });
      if (ev === 'land') {
        synthThud(this, { freq: 130, gain: 0.18, dur: 0.15 });
        this.dustPuff(p.x, p.y);
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
      playVoidDeath(this, () => this.respawn());
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

  // ------------------------------------------------------------------- slash

  trySlash(now) {
    if (now < this.player.slashReadyAt) return;
    this.player.slashReadyAt = now + AUG_TUNE.slashCooldown;
    const p = this.player.p;
    const fx = p.facing;

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
    if (anyKill) this.hitstopUntil = now + AUG_TUNE.killHitstopMs;
    else if (anyHit) this.hitstopUntil = now + AUG_TUNE.hitstopMs;
  }

  /** Every slash that lands: the full feedback chain (design §4.3). */
  slashFeedback(target, killed) {
    const { x, y } = { x: target.p.x, y: target.p.y - 32 };
    this.cameras.main.shake(killed ? 140 : 70, killed ? 0.006 : 0.003);
    // Metal tear: sawtooth sweep down.
    synthBuzz(this, { freq: killed ? 700 : 520, dur: killed ? 0.4 : 0.22, gain: 0.16 });
    // Blood AND sparks — flesh and metal in one body.
    this.add
      .particles(x, y, 'ch2-mote', {
        speed: { min: 80, max: 300 },
        lifespan: { min: 300, max: 700 },
        quantity: killed ? 26 : 14,
        scale: { min: 0.4, max: 1.2 },
        tint: [0x8e1f24, 0x5c1216, 0xffc46b, 0xff8a3c],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(6)
      .explode(killed ? 26 : 14);
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
    // Third hit: the body comes apart — a gout of gibs.
    this.add
      .particles(t.p.x, t.p.y - 30, 'ch2-gib', {
        speed: { min: 100, max: 380 },
        angle: { min: 200, max: 340 },
        gravityY: 1500,
        lifespan: 1300,
        quantity: 9,
        rotate: { min: -400, max: 400 },
        emitting: false,
      })
      .setDepth(6)
      .explode(9);
    synthThud(this, { freq: 80, gain: 0.35, dur: 0.35 });
    if (t === this.ernest) {
      // The world does not comment (design §4.4). It only remembers.
      this.registry.set('ch2.ernest', 'killed');
      this.ernestState = 'done';
      this.ernestDone = true;
      if (this.ernest.glowImg) {
        this.tweens.add({ targets: this.ernest.glowImg, alpha: 0, duration: 800 });
      }
    }
    t.fig.setVisible(false);
    if (t.glowImg) t.glowImg.setVisible(false);
  }

  // ------------------------------------------------------------- grapple arm

  startArm(now) {
    const p = this.player.p;
    this.armState = { phase: 'extend', t0: now, dir: p.facing };
    const arm = this.player.arm;
    arm.setVisible(true);
    arm.setPosition(p.x, p.y - 40);
    arm.setScale(0.1, 1);
    arm.setFlipX(p.facing < 0);
    synthBuzz(this, { freq: 260, dur: 0.12, gain: 0.08 });
  }

  updateArm(dt, now, input) {
    const p = this.player.p;
    const st = this.armState;
    const arm = this.player.arm;

    if (st.phase === 'extend') {
      const u = Math.min(1, (now - st.t0) / AUG_TUNE.armExtendMs);
      arm.setScale((u * AUG_TUNE.armReach) / 24, 1);
      arm.setPosition(p.x, p.y - 40);
      if (u >= 1) {
        // What did the claw find?
        const tipX = p.x + st.dir * AUG_TUNE.armReach;
        const tipY = p.y - 40;
        const anchor = L2.anchors.find((a) => Phaser.Math.Distance.Between(tipX, tipY, a.x, a.y) < 30);
        const prey = this.psychos.find(
          (s) => s.alive && (s.p.x - p.x) * st.dir > 0 && Math.abs(s.p.x - p.x) < AUG_TUNE.armReach + 14 && Math.abs(s.p.y - p.y) < 44,
        );
        if (anchor) {
          st.phase = 'pull';
          st.anchor = anchor;
          p.grounded = false;
          synthBuzz(this, { freq: 180, dur: 0.15, gain: 0.12 });
        } else if (prey) {
          prey.yankTo(p.x + st.dir * 42);
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
          this.armState = null;
          arm.setVisible(false);
        } else {
          st.phase = 'retract';
          st.t0 = now;
        }
      }
      return;
    }

    if (st.phase === 'pull') {
      const a = st.anchor;
      const dx = a.x - p.x;
      const dy = a.y - (p.y - 40);
      const dist = Math.hypot(dx, dy);
      // 甩跳: release mid-pull with a jump (design §4.2, expert move).
      if (input.jump) {
        p.vx = st.dir * 380;
        p.vy = -700;
        p.grounded = false;
        this.armState = null;
        arm.setVisible(false);
        return;
      }
      if (dist < 16) {
        p.vx = st.dir * 350;
        p.vy = -120;
        p.grounded = false;
        this.armState = null;
        arm.setVisible(false);
        return;
      }
      const stepLen = Math.min(dist, AUG_TUNE.pullSpeed * dt);
      p.x += (dx / dist) * stepLen;
      p.y += (dy / dist) * stepLen;
      // Keep the arm drawn shoulder → anchor.
      const len = Math.hypot(a.x - p.x, a.y - (p.y - 40));
      arm.setPosition(p.x, p.y - 40);
      arm.setScale(len / 24, 1);
      arm.setRotation(Math.atan2(a.y - (p.y - 40), a.x - p.x) * (st.dir < 0 ? 0 : 1));
      if (st.dir < 0) arm.setRotation(Math.atan2((p.y - 40) - a.y, p.x - a.x) + Math.PI);
      return;
    }

    if (st.phase === 'retract') {
      const u = Math.min(1, (now - st.t0) / 100);
      arm.setScale(((1 - u) * AUG_TUNE.armReach) / 24, 1);
      arm.setPosition(p.x, p.y - 40);
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
      // pulses red, a metal arm flies past the lens.
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
      this.time.delayedCall(700, () => {
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.respawn();
          this.cameras.main.fadeIn(420, 0, 0, 0);
        });
      });
    }
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
    this.cameras.main.centerOn(p.x, 380);
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
    // He walks into the light; the metal carries him the last steps.
    this.tweens.add({
      targets: p,
      x: L2.elevatorX + 55,
      duration: 900,
      ease: 'Quad.easeOut',
      onUpdate: () => this.player.animate(1 / 60),
    });
    this.time.delayedCall(1100, () => {
      this.cameras.main.fadeOut(1200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.showEndCard();
      });
    });
  }

  showEndCard() {
    const t1 = this.add
      .text(GAME_W / 2, GAME_H / 2 - 40, 'L2-2 · 拼接', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '30px',
        color: '#c9d6e2',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(70);
    const t2 = this.add
      .text(GAME_W / 2, GAME_H / 2 + 8, `COMPLETE — ${this.player.shards} shards absorbed. it is still hungry.`, {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '13px',
        color: '#5d6a78',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(70);
    const t3 = this.add
      .text(GAME_W / 2, GAME_H / 2 + 90, 'L2-3 · 过载', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '13px',
        color: '#7f8b99',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(70);
    [t1, t2, t3].forEach((t) => t.setAlpha(0));
    this.tweens.add({ targets: [t1, t2, t3], alpha: 1, duration: 900 });
    this.cameras.main.fadeIn(800, 0, 0, 0);
    this.phase = 'DONE';
    this.time.delayedCall(3400, () => this.advanceToLevel23());
  }

  advanceToLevel23() {
    if (this.advancing) return;
    this.advancing = true;
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Level23'));
  }

  // ------------------------------------------------------------------ update

  update(_, deltaMs) {
    const dt = Math.min(deltaMs, 50) / 1000;
    const now = this.time.now;

    switch (this.phase) {
      case 'ATTACH':
        this.updateAttach();
        break;
      case 'PLAY':
        this.updatePlay(dt, now);
        break;
      case 'DONE':
        if (Phaser.Input.Keyboard.JustDown(this.keys.enter)) this.advanceToLevel23();
        break;
    }
  }
}
