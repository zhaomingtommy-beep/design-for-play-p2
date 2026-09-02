import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../constants.js';

/**
 * L2-1 torso-rolling feel prototype (?proto=roll).
 *
 * Arcade physics has no rotated-rectangle collision, so slopes are faked with
 * an ANALYTIC HEIGHTFIELD: the ground is a piecewise-linear contour y = h(x)
 * and the torso is a custom kinematic body projected onto it each frame.
 * Arcade is only used as the render/camera host — no physics bodies at all.
 *
 * Feel targets (from docs/chapter2-redesign.md §3.3):
 *   - A/D or arrows roll, Space hops (no cooldown, chain on landing, NO
 *     double jump)
 *   - downhill acceleration should read "hard to stop" within 3 seconds
 *   - high speed cap, heavy inertia, near-zero jump agency
 */

// Tuning — everything worth touching lives here.
const TUNE = {
  radius: 15,
  gravity: 1900,
  rollAccel: 480, // input push along the slope tangent — a torso, not a runner
  slopePull: 1700, // how hard gravity drags you down a slope
  groundFriction: 0.45, // fraction of speed bled per second while rolling
  airDrag: 0.06,
  airControl: 300,
  hopVelocity: -470, // shoulder hop: clears a debris bump, never a platform
  maxRoll: 640, // downhill terminal velocity — heavy, not a cannonball
  maxPush: 300, // soft cap for torso-power rolling on gentle ground
  maxAir: 800,
  wallSlope: 0.62, // |t.y| above this = a face too steep to roll up: it is a wall
  landSnap: 10, // max px the contour may fall away per frame before takeoff
  camZoomSlow: 1.08,
  camZoomFast: 0.9,
};

// The collapse route: mostly downhill (y grows downward). The two "spikes"
// are debris bumps with >50° faces — a torso cannot roll up them, they must
// be hopped. The small pit at 2000–2090 is a hop check; the big gap at
// 3050–3350 needs real speed.
const CONTOUR = [
  { x: 0, y: 320 },
  { x: 350, y: 320 }, // flat spawn pad
  { x: 900, y: 470 }, // first ramp: gentle
  { x: 1150, y: 480 }, // brief flat
  { x: 1180, y: 480 },
  { x: 1210, y: 442 }, // bump 1: steep face up
  { x: 1240, y: 480 }, // steep face down
  { x: 1700, y: 620 }, // steeper
  { x: 1750, y: 700 }, // drop ledge — becomes airborne
  { x: 1990, y: 778 },
  // PIT 2000–2140: too wide to roll at torso speed — hop it or die
  { x: 2150, y: 780 },
  { x: 2480, y: 780 },
  { x: 2510, y: 742 }, // bump 2
  { x: 2540, y: 780 },
  { x: 2950, y: 905 }, // long fast runout
  // GAP 3050–3350: fall in and you die
  { x: 3350, y: 940 },
  { x: 3900, y: 980 }, // landing flats
  { x: 4600, y: 980 },
];
const GAPS = [
  { from: 2000, to: 2140 },
  { from: 3050, to: 3350 },
];
const KILL_Y = 1250;
const SPAWN = { x: 120, y: 290 };
const WORLD_END = 4620;

export default class RollProtoScene extends Phaser.Scene {
  constructor() {
    super('RollProto');
  }

  create() {
    this.buildTextures();
    this.buildWorld();
    this.buildPlayer();
    this.buildCamera();
    this.buildHud();

    this.keys = this.input.keyboard.addKeys({
      left: 'LEFT',
      right: 'RIGHT',
      a: 'A',
      d: 'D',
      jump: 'SPACE',
      restart: 'R',
    });
    this.input.keyboard.addCapture(['SPACE', 'LEFT', 'RIGHT']);
  }

  // -------------------------------------------------------------- heightfield

  /** Ground surface y at x, or null when x is inside a gap. */
  groundAt(x) {
    for (const g of GAPS) if (x >= g.from && x <= g.to) return null;
    if (x <= CONTOUR[0].x) return CONTOUR[0].y;
    for (let i = 0; i < CONTOUR.length - 1; i++) {
      const a = CONTOUR[i];
      const b = CONTOUR[i + 1];
      if (x >= a.x && x <= b.x) {
        const t = (x - a.x) / (b.x - a.x);
        return Phaser.Math.Linear(a.y, b.y, t);
      }
    }
    return CONTOUR[CONTOUR.length - 1].y;
  }

  /** Unit tangent of the contour at x (pointing +x, y grows downhill). */
  tangentAt(x) {
    const e = 2;
    const y0 = this.groundAt(x - e) ?? this.groundAt(x);
    const y1 = this.groundAt(x + e) ?? this.groundAt(x);
    const dx = 2 * e;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  // ------------------------------------------------------------------- build

  buildTextures() {
    // Torso: a lumpy rolling body — ribcage blob + head stump + cold AI core.
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x39414e, 1);
    g.fillCircle(16, 16, 14);
    g.fillStyle(0x2b313c, 1);
    g.fillCircle(22, 9, 6); // shoulder mass
    g.fillStyle(0x9fd8e8, 1); // AI core — the only light on the body
    g.fillCircle(12, 14, 3);
    g.generateTexture('proto-torso', 32, 32);
    g.clear();

    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('proto-mote', 8, 8);
    g.destroy();
  }

  buildWorld() {
    // Night-lab gradient.
    const sky = this.add.graphics().setScrollFactor(0).setDepth(0);
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      sky.fillStyle(Phaser.Display.Color.GetColor(6 + 14 * t, 10 + 12 * t, 20 + 18 * t), 1);
      sky.fillRect(0, (GAME_H / 40) * i, GAME_W, GAME_H / 40 + 1);
    }

    // Ground fill: contour polyline closed along the bottom, gap-aware.
    const g = this.add.graphics().setDepth(2);
    const rim = this.add.graphics().setDepth(3);
    let pen = null;
    const flush = () => {
      if (!pen) return;
      g.lineTo(pen.x, GAME_H * 3);
      g.lineTo(pen.startX, GAME_H * 3);
      g.closePath();
      g.fillPath();
      pen = null;
    };
    for (let x = 0; x <= 4800; x += 8) {
      const y = this.groundAt(x);
      if (y === null) {
        flush();
        continue;
      }
      if (!pen) {
        pen = { startX: x, x };
        g.fillStyle(0x11151d, 1);
        g.beginPath();
        g.moveTo(x, y);
      } else {
        g.lineTo(x, y);
        pen.x = x;
      }
      // Surface rim light — the only edge cue, per the value-ramp rule.
      rim.lineStyle(2, 0x3a4a5c, 1);
      rim.lineBetween(x - 8, this.groundAt(x - 8) ?? y, x, y);
    }
    flush();

    // Rubble wall closing the prototype route.
    const wallY = this.groundAt(WORLD_END);
    g.fillStyle(0x181d26, 1);
    g.fillRect(WORLD_END, wallY - 130, 90, 130);
    rim.lineStyle(2, 0x3a4a5c, 1);
    rim.lineBetween(WORLD_END, wallY - 130, WORLD_END, wallY);
    this.add
      .text(WORLD_END - 14, wallY - 160, 'END OF PROTOTYPE', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '12px',
        color: '#4a545f',
      })
      .setOrigin(1, 0)
      .setDepth(4);

    // Falling-debris streaks for speed sensation.
    this.debris = this.add.particles(0, 0, 'proto-mote', {
      x: { min: -40, max: GAME_W + 40 },
      y: { min: -30, max: GAME_H },
      lifespan: 1400,
      speedX: { min: -260, max: -120 },
      speedY: { min: 40, max: 120 },
      scale: { min: 0.2, max: 0.7 },
      alpha: { start: 0.5, end: 0 },
      quantity: 1,
      frequency: 60,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.debris.setScrollFactor(0).setDepth(6);
  }

  buildPlayer() {
    this.p = {
      x: SPAWN.x,
      y: SPAWN.y,
      vx: 0,
      vy: 0,
      speed: 0, // signed speed along the tangent while grounded
      grounded: true,
      angle: 0,
    };
    this.torso = this.add.image(this.p.x, this.p.y, 'proto-torso').setDepth(5);
    this.coreLight = this.add
      .image(this.p.x, this.p.y, 'proto-mote')
      .setScale(6)
      .setTint(0x9fd8e8)
      .setAlpha(0.3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4);
  }

  buildCamera() {
    this.cameras.main.setBounds(0, 0, 4800, KILL_Y + 200);
    this.cameras.main.startFollow(this.torso, true, 0.1, 0.1);
    this.cameras.main.setFollowOffset(0, 60);
  }

  buildHud() {
    this.hud = this.add
      .text(12, 10, '', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '12px',
        color: '#7f8b99',
      })
      .setScrollFactor(0)
      .setDepth(10);
    this.add
      .text(GAME_W - 12, 10, 'ROLL PROTOTYPE — A/D or ←/→ roll · SPACE hop · fall = die', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '11px',
        color: '#4a545f',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(10);
  }

  // ------------------------------------------------------------------ update

  update(_, deltaMs) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.restart)) {
      this.scene.restart();
      return;
    }
    const dt = Math.min(deltaMs, 50) / 1000;
    const p = this.p;
    const k = this.keys;
    const left = k.left.isDown || k.a.isDown;
    const right = k.right.isDown || k.d.isDown;
    const jump = Phaser.Input.Keyboard.JustDown(k.jump);

    if (p.grounded) this.stepGrounded(dt, { left, right, jump });
    else this.stepAirborne(dt, { left, right, jump });

    // Rolling spin: angular velocity from surface speed.
    const spinV = p.grounded ? p.speed : p.vx;
    p.angle += (spinV / TUNE.radius) * dt;

    this.torso.setPosition(p.x, p.y).setRotation(p.angle);
    this.coreLight.setPosition(p.x, p.y);

    // Camera breathes out with speed.
    const sp = Math.abs(p.grounded ? p.speed : p.vx);
    const targetZoom = Phaser.Math.Linear(
      TUNE.camZoomSlow,
      TUNE.camZoomFast,
      Phaser.Math.Clamp(sp / TUNE.maxRoll, 0, 1),
    );
    this.cameras.main.setZoom(Phaser.Math.Linear(this.cameras.main.zoom, targetZoom, 0.04));

    // Falling into the void = death. Prototype keeps the gore minimal but the
    // rule (red pulse, restart at sub-level start) is the shipped one.
    if (p.y > KILL_Y) this.die();

    this.hud.setText(
      `speed ${Math.round(sp)} px/s  ${p.grounded ? 'GROUND' : 'AIR'}  x ${Math.round(p.x)}`,
    );
  }

  stepGrounded(dt, input) {
    const p = this.p;
    const t = this.tangentAt(p.x);

    // Gravity along the slope (t.y > 0 going downhill) + input push.
    p.speed += TUNE.slopePull * t.y * t.x * dt * 2;
    if (input.left && !input.right) p.speed -= TUNE.rollAccel * dt;
    else if (input.right && !input.left) p.speed += TUNE.rollAccel * dt;

    // Rolling resistance: multiplicative so high speed bleeds hardest, but a
    // steep enough slope always wins — that is the "cannot stop" feel.
    p.speed *= Math.max(0, 1 - TUNE.groundFriction * dt);

    // Two-speed feel: leg power alone tops out at maxPush; only gravity on a
    // real slope may carry you beyond it. Excess speed on gentle ground is
    // bled off smoothly, not clamped, so downhill momentum survives the flats
    // for a beat instead of dying at the slope's foot.
    const cap = Math.abs(t.y) > 0.18 ? TUNE.maxRoll : TUNE.maxPush;
    const over = Math.abs(p.speed) - cap;
    if (over > 0) p.speed -= Math.sign(p.speed) * over * 3 * dt;
    p.speed = Phaser.Math.Clamp(p.speed, -TUNE.maxRoll, TUNE.maxRoll);

    // A face steeper than wallSlope in the direction of travel is not a slope
    // to a limbless torso — it is a wall. Bonk and bounce back; this is what
    // makes debris bumps mandatory hops instead of speed bumps.
    if (p.speed !== 0 && -t.y * Math.sign(p.speed) > TUNE.wallSlope) {
      p.speed = -p.speed * 0.22;
      this.cameras.main.shake(60, 0.002);
      return;
    }

    let nx = p.x + p.speed * t.x * dt;

    // End of the collapse route: a wall of rubble. The prototype stops here.
    if (nx >= WORLD_END - TUNE.radius) {
      nx = WORLD_END - TUNE.radius;
      p.speed = 0;
    }
    const gy = this.groundAt(nx);

    // Shoulder hop: grounded only, no cooldown, no double jump.
    if (input.jump) {
      p.grounded = false;
      p.vx = p.speed * t.x;
      p.vy = TUNE.hopVelocity;
      p.y -= 2;
      return;
    }

    if (gy === null || gy - TUNE.radius > p.y + TUNE.landSnap) {
      // Contour fell away: lip of a drop or a gap — go ballistic.
      p.grounded = false;
      p.vx = p.speed * t.x;
      p.vy = Math.max(0, p.speed * t.y);
      p.x = nx;
      p.y += Math.max(0, p.speed * t.y) * dt;
      return;
    }

    p.x = nx;
    p.y = gy - TUNE.radius;
  }

  stepAirborne(dt, input) {
    const p = this.p;
    p.vy += TUNE.gravity * dt;
    if (input.left && !input.right) p.vx -= TUNE.airControl * dt;
    else if (input.right && !input.left) p.vx += TUNE.airControl * dt;
    p.vx *= Math.max(0, 1 - TUNE.airDrag * dt);
    p.vx = Phaser.Math.Clamp(p.vx, -TUNE.maxAir, TUNE.maxAir);
    p.vy = Math.min(p.vy, TUNE.maxAir * 1.4);

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x > WORLD_END - TUNE.radius) {
      p.x = WORLD_END - TUNE.radius;
      p.vx = 0;
    }

    const gy = this.groundAt(p.x);
    if (gy !== null && p.y + TUNE.radius >= gy && p.vy > 0) {
      // Land: project velocity onto the slope tangent. Steep landings keep
      // most of the speed — momentum is the whole point of this form.
      const t = this.tangentAt(p.x);
      p.speed = p.vx * t.x + p.vy * t.y;
      p.grounded = true;
      p.y = gy - TUNE.radius;
      this.cameras.main.shake(90, 0.003);
    }
  }

  die() {
    const p = this.p;
    this.cameras.main.flash(160, 140, 20, 26);
    this.add
      .particles(p.x, KILL_Y - 40, 'proto-mote', {
        speed: { min: 60, max: 300 },
        angle: { min: 200, max: 340 },
        lifespan: 700,
        quantity: 26,
        scale: { min: 0.4, max: 1.4 },
        tint: 0x8e1f24,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(7)
      .explode(26);
    p.x = SPAWN.x;
    p.y = SPAWN.y;
    p.vx = 0;
    p.vy = 0;
    p.speed = 0;
    p.grounded = true;
  }
}
