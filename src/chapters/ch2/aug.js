import Phaser from 'phaser';
import { Heightfield } from './torso.js';

/**
 * Chapter 2 L2-2 shared kit — the augmented body and the things that hunt it.
 *
 *   makeAugTextures   metal-limbed player parts, cyberpsycho parts, shards,
 *                     anchor rings, gibs — all procedural, no assets
 *   AugPlayer         metal humanoid on a Heightfield: walk, chain-jump
 *                     (no double jump), SHIFT rush, slash attack,
 *                     web-swing grapple arm
 *   Psycho            surgical-failure enemy: twitchy dashes, windup lunge,
 *                     3 hits to kill, drops shards that feed the parasite
 */

export const AUG_TUNE = {
  walkSpeed: 260,
  airAccel: 1200,
  airMax: 300,
  gravity: 1900,
  jumpVelocity: -760, // restored, not a moon jump — big gaps belong to the arm
  halfH: 30,
  stepSnap: 18, // max ground rise the legs walk over without jumping
  slashCooldown: 300,
  slashReach: 58,
  slashArc: 46, // vertical half-extent of the slash hitbox
  hitstopMs: 110,
  killHitstopMs: 200,
  invulnMs: 1200,
  knockback: 340,
  hitPopVy: -170, // hits lift the body off the ground
  killLaunchVy: -330,
  armReach: 380, // auto-aim grapple — Spider-Man range, not a handshake
  armExtendMs: 120,
  swingPump: 980, // tangential accel from A/D while swinging
  swingReel: 260, // the winch zips him up into the arc, Spider-Man style
  swingReleaseBoost: 1.14,
  swingJumpKick: 140, // extra upward kick when releasing with SPACE
  dashSpeed: 950, // SHIFT — rush
  dashMs: 180,
  dashCooldownMs: 700,
  lives: 3,
};

// ------------------------------------------------------------------ textures

export function makeAugTextures(scene) {
  if (scene.textures.exists('ch2-aug-body')) return;
  const g = scene.make.graphics({ add: false });

  const STEEL = 0x39424e;
  const STEEL_HI = 0x5d6a78;
  const SEAM = 0x9fd8e8;

  // Augmented body: gunmetal torso with cold seams and the AI core.
  g.fillStyle(STEEL, 1);
  g.fillRoundedRect(0, 0, 16, 26, 4);
  g.fillStyle(STEEL_HI, 0.7);
  g.fillRoundedRect(2, 2, 5, 22, 2);
  g.lineStyle(1, SEAM, 0.85);
  g.lineBetween(3, 6, 13, 6);
  g.lineBetween(3, 14, 13, 14);
  g.fillStyle(SEAM, 1);
  g.fillCircle(8, 10, 2.4); // the core, now in a metal chest
  g.generateTexture('ch2-aug-body', 16, 26);
  g.clear();

  g.fillStyle(STEEL, 1);
  g.fillCircle(6, 6, 6);
  g.lineStyle(1, SEAM, 0.7);
  g.beginPath();
  g.arc(6, 6, 4.5, Math.PI * 0.8, Math.PI * 1.6);
  g.strokePath();
  g.fillStyle(SEAM, 1);
  g.fillCircle(8, 5, 1.6); // one calm eye
  g.generateTexture('ch2-aug-head', 12, 12);
  g.clear();

  g.fillStyle(STEEL, 1);
  g.fillRoundedRect(0, 0, 5, 18, 2);
  g.lineStyle(1, SEAM, 0.6);
  g.lineBetween(1, 2, 1, 16);
  g.fillStyle(STEEL_HI, 1);
  g.fillRect(0, 8, 5, 2); // joint band
  g.generateTexture('ch2-aug-arm', 5, 18);
  g.clear();

  g.fillStyle(STEEL, 1);
  g.fillRoundedRect(0, 0, 6, 20, 2);
  g.lineStyle(1, SEAM, 0.6);
  g.lineBetween(1, 2, 1, 18);
  g.fillStyle(STEEL_HI, 1);
  g.fillRect(0, 9, 6, 2);
  g.generateTexture('ch2-aug-leg', 6, 20);
  g.clear();

  // Cyberpsycho: patchwork of flesh and rejects, one red eye.
  const FLESH = 0x8a736c;
  const FLESH_LO = 0x4d3c38;
  g.fillStyle(FLESH, 1);
  g.fillRoundedRect(0, 0, 16, 26, 4);
  g.fillStyle(STEEL, 1);
  g.fillRect(8, 0, 8, 13); // metal plate graft, right chest
  g.fillRect(0, 16, 7, 10); // left hip
  g.lineStyle(1, FLESH_LO, 0.8);
  g.lineBetween(8, 2, 8, 11); // graft seam
  g.lineStyle(1, STEEL_HI, 0.5);
  g.lineBetween(9, 2, 14, 2);
  g.generateTexture('ch2-psy-body', 16, 26);
  g.clear();

  g.fillStyle(FLESH, 1);
  g.fillCircle(6, 6, 6);
  g.fillStyle(STEEL, 1);
  g.fillCircle(8, 5, 3.5); // metal skullcap
  g.fillStyle(0xff2d3c, 1); // the red eye
  g.fillCircle(7, 6, 1.6);
  g.generateTexture('ch2-psy-head', 12, 12);
  g.clear();

  g.fillStyle(FLESH, 1);
  g.fillRoundedRect(0, 0, 6, 19, 2);
  g.fillStyle(STEEL, 1);
  g.fillRect(0, 10, 6, 9); // metal forearm / shin graft
  g.lineStyle(1, FLESH_LO, 0.7);
  g.lineBetween(1, 2, 1, 9);
  g.generateTexture('ch2-psy-limb', 6, 19);
  g.clear();

  // Metal shard: feeds the parasite.
  g.fillStyle(STEEL_HI, 1);
  g.beginPath();
  g.moveTo(0, 3);
  g.lineTo(5, 0);
  g.lineTo(8, 4);
  g.lineTo(6, 8);
  g.lineTo(1, 7);
  g.closePath();
  g.fillPath();
  g.lineStyle(1, SEAM, 0.5);
  g.lineBetween(2, 3, 6, 4);
  g.generateTexture('ch2-shard', 8, 8);
  g.clear();

  // Anchor ring: the fixed glow the arm grabs.
  g.lineStyle(3, SEAM, 1);
  g.strokeCircle(12, 12, 9);
  g.lineStyle(1.5, 0xd8f4fc, 0.9);
  g.strokeCircle(12, 12, 6);
  g.fillStyle(SEAM, 0.35);
  g.fillCircle(12, 12, 5);
  g.generateTexture('ch2-anchor', 24, 24);
  g.clear();

  // Gib: flesh-metal chunk for kills.
  g.fillStyle(FLESH, 1);
  g.beginPath();
  g.moveTo(1, 2);
  g.lineTo(7, 0);
  g.lineTo(10, 5);
  g.lineTo(6, 10);
  g.lineTo(0, 7);
  g.closePath();
  g.fillPath();
  g.fillStyle(STEEL, 1);
  g.fillRect(4, 3, 5, 4);
  g.fillStyle(0x6e1f24, 0.8);
  g.fillCircle(3, 6, 2);
  g.generateTexture('ch2-gib', 10, 10);
  g.clear();

  // Metal arm (the extendable one): segmented bar.
  g.fillStyle(STEEL, 1);
  g.fillRect(0, 0, 24, 5);
  g.lineStyle(1, SEAM, 0.7);
  g.lineBetween(2, 1, 22, 1);
  g.fillStyle(STEEL_HI, 1);
  g.fillRect(20, 0, 4, 5); // claw end
  g.generateTexture('ch2-extarm', 24, 5);
  g.clear();

  // Ernest's prototype emitter — salvaged from what's left of him.
  g.fillStyle(STEEL, 1);
  g.fillRoundedRect(0, 4, 26, 7, 2); // receiver
  g.fillRect(20, 2, 10, 4); // barrel shroud
  g.fillStyle(STEEL_HI, 1);
  g.fillRect(28, 3, 3, 5); // muzzle
  g.fillStyle(SEAM, 1);
  g.fillRect(6, 11, 5, 7); // grip
  g.fillStyle(0x9fd8e8, 1);
  g.fillRect(12, 5, 8, 3); // the cell, still warm
  g.generateTexture('ch2-lasergun', 31, 18);
  g.destroy();
}

// ------------------------------------------------------------------ aug player

export class AugPlayer {
  /** feet-origin metal humanoid on a Heightfield. */
  constructor(scene, spawn, field) {
    this.scene = scene;
    this.field = field;
    this.p = {
      x: spawn.x,
      y: spawn.y, // feet y
      vx: 0,
      vy: 0,
      grounded: true,
      facing: 1,
      dead: false,
    };
    this.lives = AUG_TUNE.lives;
    this.invulnUntil = 0;
    this.slashReadyAt = 0;
    this.dashReadyAt = 0;
    this.dashUntil = 0;
    this.shards = 0; // absorbed metal — the parasite's growth counter

    this.fig = scene.add.container(this.p.x, this.p.y).setDepth(5);
    this.parts = {
      body: scene.add.image(0, -32, 'ch2-aug-body'),
      head: scene.add.image(1, -52, 'ch2-aug-head'),
      armL: scene.add.image(-10, -44, 'ch2-aug-arm').setOrigin(0.5, 0.08),
      armR: scene.add.image(10, -44, 'ch2-aug-arm').setOrigin(0.5, 0.08),
      legL: scene.add.image(-4, -20, 'ch2-aug-leg').setOrigin(0.5, 0.05),
      legR: scene.add.image(4, -20, 'ch2-aug-leg').setOrigin(0.5, 0.05),
    };
    this.fig.add(Object.values(this.parts));

    // The extendable arm — hidden until E.
    this.arm = scene.add.image(0, 0, 'ch2-extarm').setOrigin(0, 0.5).setDepth(6).setVisible(false);

    // Absorbed shards ride the body (stage visuals attach here).
    this.shardLayer = scene.add.container(0, 0);
    this.fig.add(this.shardLayer);

    this.coreGlow = scene.add
      .image(this.p.x, this.p.y - 32, 'ch2-mote')
      .setScale(5)
      .setTint(0x9fd8e8)
      .setAlpha(0.25)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4);

    this.walkPhase = 0;
    this.armState = null; // null | {phase:'extend'|'pull', ...}
  }

  get hurt() {
    return this.scene.time.now < this.invulnUntil;
  }

  setVisible(v) {
    this.fig.setVisible(v);
    this.coreGlow.setVisible(v);
  }

  /**
   * Platformer step. input: {left,right,jump,dash}. Returns 'land' on
   * touchdown, 'dash' on the frame a rush starts, 'dashing' mid-rush.
   * Jump: grounded only, chain on landing, NO double jump (design §0.5).
   * Rush: SHIFT burst — horizontal, gravity suspended, short cooldown.
   */
  step(dt, input, { worldEnd = Infinity } = {}) {
    const p = this.p;
    const T = AUG_TUNE;
    const now = this.scene.time.now;

    if (input.dash && now >= this.dashReadyAt && !p.dead) {
      this.dashReadyAt = now + T.dashCooldownMs;
      this.dashUntil = now + T.dashMs;
      p.dashDir = input.left && !input.right ? -1 : input.right && !input.left ? 1 : p.facing;
      p.grounded = false;
      p.vy = 0;
    }
    if (now < this.dashUntil) {
      p.facing = p.dashDir;
      p.vx = p.dashDir * T.dashSpeed;
      p.vy = 0;
      p.x = Math.min(p.x + p.vx * dt, worldEnd);
      return 'dashing';
    }

    if (p.grounded) {
      let dir = 0;
      if (input.left && !input.right) dir = -1;
      else if (input.right && !input.left) dir = 1;
      p.vx = dir * T.walkSpeed;
      if (dir !== 0) p.facing = dir;

      if (input.jump) {
        p.grounded = false;
        p.vy = T.jumpVelocity;
        p.y -= 2;
        return null;
      }

      const nx = p.x + p.vx * dt;
      const gy = this.field.groundAt(nx);
      const gyCur = this.field.groundAt(p.x);
      if (gy === null) {
        // walked off an edge
        p.grounded = false;
        p.vy = 0;
        p.x = nx;
        return null;
      }
      if (gyCur !== null && gy < gyCur - T.stepSnap && dir !== 0) {
        return null; // a wall of rubble — jump it
      }
      p.x = Math.min(nx, worldEnd);
      p.y = gy;
      return null;
    }

    // airborne
    p.vy += T.gravity * dt;
    if (input.left && !input.right) {
      p.vx = Math.max(p.vx - T.airAccel * dt, -T.airMax);
      p.facing = -1;
    } else if (input.right && !input.left) {
      p.vx = Math.min(p.vx + T.airAccel * dt, T.airMax);
      p.facing = 1;
    }
    p.x = Math.min(p.x + p.vx * dt, worldEnd);
    p.y += p.vy * dt;

    const gy = this.field.groundAt(p.x);
    if (gy !== null && p.y >= gy && p.vy > 0) {
      p.y = gy;
      p.vy = 0;
      p.grounded = true;
      p.vx = 0;
      return 'land';
    }
    return null;
  }

  /** Walk cycle / pose. Pure visuals. */
  animate(dt) {
    const p = this.p;
    const now = this.scene.time.now;
    const moving = p.grounded && p.vx !== 0;
    this.walkPhase += Math.abs(p.vx) * dt * 0.05;
    if (now < this.dashUntil) {
      // rush: body leans hard, limbs swept back
      this.parts.legL.setRotation(0.85);
      this.parts.legR.setRotation(-0.7);
      this.parts.armL.setRotation(0.7);
      this.parts.armR.setRotation(0.9);
    } else if (moving) {
      const sw = Math.sin(this.walkPhase) * 0.6;
      this.parts.legL.setRotation(sw);
      this.parts.legR.setRotation(-sw);
      this.parts.armL.setRotation(-sw * 0.7);
      this.parts.armR.setRotation(sw * 0.7);
    } else if (!p.grounded) {
      this.parts.legL.setRotation(0.35);
      this.parts.legR.setRotation(-0.25);
      this.parts.armL.setRotation(-0.4);
      this.parts.armR.setRotation(0.5);
    } else {
      ['legL', 'legR', 'armL', 'armR'].forEach((k) => this.parts[k].setRotation(0));
    }
    this.fig.setPosition(p.x, p.y);
    this.fig.setScale(p.facing, 1);
    this.coreGlow.setPosition(p.x, p.y - 32);
    // hurt blink
    this.fig.setAlpha(this.hurt && Math.floor(this.scene.time.now / 90) % 2 === 0 ? 0.35 : 1);
  }

  /** Attach one absorbed shard to the body. Returns the new count. */
  absorb() {
    this.shards++;
    const a = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 10;
    const s = this.scene.add.image(Math.cos(a) * r, -34 + Math.sin(a) * r * 1.4, 'ch2-shard');
    s.setRotation(Math.random() * 6).setScale(0.9);
    this.shardLayer.add(s);
    return this.shards;
  }
}

// ---------------------------------------------------------------------- psycho

export const PSY_TUNE = {
  hp: 3,
  dashSpeed: 180, // twitchy dash bursts; averages ~90px/s with the pauses
  pauseMs: [300, 750],
  dashMs: [200, 420],
  aggroRange: 420,
  lungeRange: 95,
  lungeWindupMs: 400, // red flash warning — the read window (design §4.3)
  lungeSpeed: 520,
  lungeMs: 260,
  staggerMs: 350,
  armPullStaggerMs: 600,
  halfH: 30,
};

export class Psycho {
  constructor(scene, x, field, { tint = null, oneLegged = false, glow = false } = {}) {
    this.scene = scene;
    this.field = field;
    this.hp = PSY_TUNE.hp;
    this.alive = true;
    this.state = 'pause'; // pause|dash|windup|lunge|stagger
    this.stateUntil = scene.time.now + Phaser.Math.Between(...PSY_TUNE.pauseMs);
    this.facing = -1;
    this.oneLegged = oneLegged;

    const gy = field.groundAt(x);
    this.p = { x, y: gy ?? 500, vx: 0, vy: 0, grounded: true };

    this.fig = scene.add.container(this.p.x, this.p.y).setDepth(5);
    this.parts = {
      body: scene.add.image(0, -32, 'ch2-psy-body'),
      head: scene.add.image(1, -52, 'ch2-psy-head'),
      armL: scene.add.image(-10, -44, 'ch2-psy-limb').setOrigin(0.5, 0.08),
      armR: scene.add.image(10, -44, 'ch2-psy-limb').setOrigin(0.5, 0.08),
      legL: scene.add.image(-4, -20, 'ch2-psy-limb').setOrigin(0.5, 0.05),
    };
    if (!oneLegged) {
      this.parts.legR = scene.add.image(4, -20, 'ch2-psy-limb').setOrigin(0.5, 0.05);
    }
    this.fig.add(Object.values(this.parts));
    if (tint) Object.values(this.parts).forEach((img) => img.setTint(tint));

    if (glow) {
      this.glowImg = scene.add
        .image(this.p.x, this.p.y - 32, 'ch2-mote')
        .setScale(9)
        .setTint(0x9fd8e8)
        .setAlpha(0.3)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(4);
    }
    this.walkPhase = Math.random() * 6;
  }

  /** Take one slash hit. Returns 'dead' | 'hit'. */
  takeHit(fromX) {
    if (!this.alive) return 'dead';
    this.hp--;
    this.lastHitFrom = fromX;
    this.p.vx = (this.p.x < fromX ? -1 : 1) * AUG_TUNE.knockback;
    this.p.vy = AUG_TUNE.hitPopVy; // the blow lifts it off the floor
    this.p.grounded = false;
    this.state = 'stagger';
    this.stateUntil = this.scene.time.now + PSY_TUNE.staggerMs;
    Object.values(this.parts).forEach((img) => img.setTintFill(0xffffff));
    this.scene.time.delayedCall(90, () => {
      if (this.alive) Object.values(this.parts).forEach((img) => img.clearTint());
    });
    if (this.hp <= 0) {
      this.alive = false;
      this.p.vx *= 1.6;
      this.p.vy = AUG_TUNE.killLaunchVy;
      return 'dead';
    }
    return 'hit';
  }

  /** Grappled by the extendable arm: dragged in, longer stagger. */
  yankTo(x) {
    if (!this.alive) return;
    this.p.x = x;
    this.p.vx = 0;
    this.state = 'stagger';
    this.stateUntil = this.scene.time.now + PSY_TUNE.armPullStaggerMs;
  }

  /**
   * AI step. Returns 'lunge-hit' when its body connects with the target
   * point during a lunge, 'touch' on any other contact, null otherwise.
   */
  step(dt, target, now) {
    if (!this.alive) return null;
    const p = this.p;
    const dx = target.x - p.x;
    const dist = Math.abs(dx);

    if (this.state === 'stagger' || this.state === 'windup') {
      if (now >= this.stateUntil) {
        if (this.state === 'windup') {
          this.state = 'lunge';
          this.stateUntil = now + PSY_TUNE.lungeMs;
          p.vx = this.facing * PSY_TUNE.lungeSpeed;
        } else {
          this.state = 'pause';
          this.stateUntil = now + Phaser.Math.Between(...PSY_TUNE.pauseMs);
          p.vx = 0;
        }
      }
      if (this.state === 'windup') {
        // red flash warning
        this.fig.setAlpha(Math.floor(now / 70) % 2 === 0 ? 1 : 0.4);
      }
    } else if (this.state === 'lunge') {
      if (now >= this.stateUntil || p.grounded === false) {
        this.state = 'pause';
        this.stateUntil = now + Phaser.Math.Between(...PSY_TUNE.pauseMs);
        p.vx = 0;
      }
    } else if (dist < PSY_TUNE.aggroRange) {
      this.facing = dx < 0 ? -1 : 1;
      if (dist < PSY_TUNE.lungeRange && this.state !== 'windup') {
        this.state = 'windup';
        this.stateUntil = now + PSY_TUNE.lungeWindupMs;
        p.vx = 0;
      } else if (this.state === 'pause' && now >= this.stateUntil) {
        this.state = 'dash';
        this.stateUntil = now + Phaser.Math.Between(...PSY_TUNE.dashMs);
        p.vx = this.facing * PSY_TUNE.dashSpeed;
      } else if (this.state === 'dash' && now >= this.stateUntil) {
        this.state = 'pause';
        this.stateUntil = now + Phaser.Math.Between(...PSY_TUNE.pauseMs);
        p.vx = 0;
      }
    }

    // integrate (ground-hugging; falls off ledges)
    if (p.grounded) {
      const nx = p.x + p.vx * dt;
      const gy = this.field.groundAt(nx);
      const gyCur = this.field.groundAt(p.x);
      if (gy === null || (gyCur !== null && gy < gyCur - AUG_TUNE.stepSnap)) {
        p.vx = 0; // psychos stop at ledges and walls
      } else {
        p.x = nx;
        p.y = gy;
      }
    } else {
      p.vy += AUG_TUNE.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const gy = this.field.groundAt(p.x);
      if (gy !== null && p.y >= gy && p.vy > 0) {
        p.y = gy;
        p.vy = 0;
        p.grounded = true;
      }
    }

    this.animate(dt, now);

    // contact check
    const touching =
      Math.abs(target.x - p.x) < 22 && Math.abs(target.y - p.y) < PSY_TUNE.halfH + AUG_TUNE.halfH - 20;
    if (!touching) return null;
    return this.state === 'lunge' ? 'lunge-hit' : 'touch';
  }

  animate(dt, now) {
    const p = this.p;
    const moving = p.grounded && p.vx !== 0;
    this.walkPhase += Math.abs(p.vx) * dt * 0.07;
    if (moving) {
      // twitchy, wrong-looking stride: uneven swing, occasional shiver
      const sw = Math.sin(this.walkPhase) * 0.7;
      const twitch = Math.floor(now / 130) % 5 === 0 ? 0.25 : 0;
      this.parts.legL.setRotation(sw + twitch);
      if (this.parts.legR) this.parts.legR.setRotation(-sw + twitch);
      this.parts.armL.setRotation(-sw * 0.9);
      this.parts.armR.setRotation(sw * 0.9 + twitch);
      this.parts.head.setRotation(twitch * 0.8);
    }
    if (this.state !== 'windup') this.fig.setAlpha(1);
    this.fig.setPosition(p.x, p.y);
    this.fig.setScale(this.facing, 1);
    if (this.glowImg) this.glowImg.setPosition(p.x, p.y - 32);
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.fig);
    this.fig.destroy();
    if (this.glowImg) this.glowImg.destroy();
  }
}
