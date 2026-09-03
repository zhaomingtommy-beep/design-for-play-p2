import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../constants.js';
import {
  ROLL_TUNE,
  makeTorsoTextures,
  Heightfield,
  Torso,
  playVoidDeath,
  synthThud,
  synthBuzz,
} from './torso.js';

/**
 * L2-1 「切除」 — THE UPGRADE, level one of three.
 *
 * Four acts, one scene (docs/chapter2-redesign.md §3):
 *   WALK  humanoid baseline, neon rooftop into the clinic (~20s)
 *   CS    the amputation cutscene — HUD abilities burn out one by one,
 *         explosion, the prosthetic is blown down into the dark
 *   ROLL1 collapse slopes with falling debris → floor hole
 *   SHAFT elevator-shaft freefall, beams to graze, body-bag cushion
 *   RAMP  the long downhill, full speed, ending at the cold metal glow
 *
 * Death = void only (design §3.3); gore sequence from torso.js; respawn at
 * the current act's start.
 */

// ------------------------------------------------------------------- layout

const WALK = {
  ground: 500,
  end: 2700, // door x — triggers the cutscene
  boxes: [
    { x0: 900, x1: 980, top: 460 },
    { x0: 1500, x1: 1590, top: 445 },
    { x0: 2050, x1: 2130, top: 465 },
  ],
  terminals: [
    {
      x: 500,
      lines: ['CONSENT FORM 88-C', 'subject waives claim', 'to original limbs.'],
    },
    {
      x: 1300,
      lines: ['AI bridge status: READY.', 'The AI is looking forward', 'to meeting you.'],
    },
  ],
};

const OR = { tableX: 3200, tableY: 462, roomL: 2850, roomR: 3750 };

const ROLL1 = {
  contour: [
    { x: 0, y: 1500 },
    { x: 350, y: 1500 }, // spawn pad
    { x: 900, y: 1740 }, // collapse slope 24°
    { x: 1150, y: 1785 }, // run-in keeps feeding speed into the bump
    { x: 1210, y: 1747 }, // debris bump — hop
    { x: 1270, y: 1785 },
    { x: 1700, y: 2050 }, // steeper
    { x: 1800, y: 2120 },
    // PIT 1900–2040: hop or die
    { x: 2100, y: 2130 },
    { x: 2600, y: 2290 }, // 25° runout
    { x: 2860, y: 2300 },
    // FLOOR HOLE 2870–3050: the way down — exits to the shaft
  ],
  gaps: [
    { from: 1900, to: 2040 },
    { from: 2870, to: 3050, exit: true },
  ],
  killY: 2750,
  spawn: { x: 120, y: 1500 - ROLL_TUNE.radius },
  exitX: 2870,
};

const SHAFT = {
  wallL: 4200,
  wallR: 4600,
  top: 2350,
  cushionY: 5000,
  beams: [
    { x0: 4200, x1: 4470, y: 2780 },
    { x0: 4330, x1: 4600, y: 3140 },
    { x0: 4200, x1: 4440, y: 3520 },
    { x0: 4360, x1: 4600, y: 3900 },
    { x0: 4200, x1: 4460, y: 4300 },
    { x0: 4340, x1: 4600, y: 4640 },
  ],
};

const RAMP = {
  contour: [
    { x: 5400, y: 5150 },
    { x: 5700, y: 5180 },
    { x: 6300, y: 5480 }, // 28° — speed comes back
    { x: 6900, y: 5730 },
    { x: 7050, y: 5760 },
    { x: 7110, y: 5722 }, // rubble bump — hop
    { x: 7170, y: 5760 },
    // 280px of runway after the bump — a fast bump-hop lands ~7360, safe;
    // then the pit is its own deliberate jump.
    // PIT 7450–7590: hop or die
    { x: 7650, y: 5800 },
    { x: 8100, y: 5910 }, // long runout
    { x: 8600, y: 5940 }, // flattens — the glow is near
    { x: 9050, y: 5940 },
  ],
  gaps: [{ from: 7450, to: 7590 }],
  killY: 6450,
  spawn: { x: 5430, y: 5150 - ROLL_TUNE.radius },
  worldEnd: 9000,
  prostheticX: 8780,
  endTriggerX: 8350,
};

const PROMPTS = [
  { key: 'SPACE', label: 'SPACE — jump' },
  { key: 'A', label: 'A — left' },
  { key: 'D', label: 'D — right' },
  { key: 'E', label: 'E — interact' },
];

export default class Level21Scene extends Phaser.Scene {
  constructor() {
    super('Level21');
  }

  create() {
    this.phase = 'WALK';
    makeTorsoTextures(this);
    this.buildTextures();
    this.buildSkyline();
    this.buildWalkWorld();
    this.buildHumanoid();
    this.buildPromptChips();
    this.buildOrSet();

    this.keys = this.input.keyboard.addKeys({
      left: 'LEFT',
      right: 'RIGHT',
      a: 'A',
      d: 'D',
      jump: 'SPACE',
      e: 'E',
      enter: 'ENTER',
    });
    this.input.keyboard.addCapture(['SPACE', 'LEFT', 'RIGHT']);

    this.cameras.main.setBounds(0, 0, WALK.end + 200, GAME_H);
    this.cameras.main.startFollow(this.figure, true, 0.12, 0.12);
    this.cameras.main.setFollowOffset(0, 40);
    // From the menu: the lens dives out of the skyline onto the rooftop.
    this.cameras.main.setZoom(1.7);
    this.tweens.add({ targets: this.cameras.main, zoom: 1, duration: 800, ease: 'Quad.easeOut' });

    this.hint = this.add
      .text(GAME_W / 2, GAME_H - 22, '', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '12px',
        color: '#5d6a78',
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(60);
  }

  // --------------------------------------------------------------- textures

  buildTextures() {
    const g = this.make.graphics({ add: false });

    // Humanoid: dark silhouette body parts with a cold rim — limbs are
    // separate textures because the cutscene takes them one by one.
    const BODY = 0x232b36;
    const RIM = 0x7fd4e8;
    g.fillStyle(BODY, 1);
    g.fillRoundedRect(0, 0, 14, 26, 4);
    g.lineStyle(1, RIM, 0.5);
    g.lineBetween(1, 3, 1, 23);
    g.generateTexture('ch2-hu-body', 14, 26);
    g.clear();

    g.fillStyle(BODY, 1);
    g.fillCircle(6, 6, 6);
    g.fillStyle(0x9fd8e8, 0.9); // one calm eye — the AI is already watching
    g.fillCircle(8, 5, 1.4);
    g.generateTexture('ch2-hu-head', 12, 12);
    g.clear();

    g.fillStyle(BODY, 1);
    g.fillRoundedRect(0, 0, 5, 16, 2);
    g.lineStyle(1, RIM, 0.4);
    g.lineBetween(1, 1, 1, 14);
    g.generateTexture('ch2-hu-arm', 5, 16);
    g.clear();

    g.fillStyle(BODY, 1);
    g.fillRoundedRect(0, 0, 6, 18, 2);
    g.lineStyle(1, RIM, 0.4);
    g.lineBetween(1, 1, 1, 16);
    g.generateTexture('ch2-hu-leg', 6, 18);
    g.clear();

    // Falling debris chunk: jagged concrete with rebar shadow.
    g.fillStyle(0x2a2f38, 1);
    g.beginPath();
    g.moveTo(1, 4);
    g.lineTo(6, 0);
    g.lineTo(14, 2);
    g.lineTo(18, 8);
    g.lineTo(15, 14);
    g.lineTo(4, 13);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, 0x4a5563, 0.8);
    g.lineBetween(3, 5, 12, 4);
    g.generateTexture('ch2-chunk', 18, 14);
    g.clear();

    // Shaft crossbeam.
    g.fillStyle(0x1d232c, 1);
    g.fillRect(0, 0, 64, 10);
    g.lineStyle(1, 0x46525f, 1);
    g.lineBetween(0, 1, 64, 1);
    g.generateTexture('ch2-beam', 64, 10);
    g.clear();

    // Body bag: the soft thing that saves you at the shaft bottom.
    g.fillStyle(0x22261f, 1);
    g.fillRoundedRect(0, 0, 46, 16, 7);
    g.fillStyle(0x333930, 0.8);
    g.fillRoundedRect(3, 2, 40, 5, 3);
    g.lineStyle(1, 0x4a5244, 0.7);
    g.lineBetween(10, 1, 10, 15); // zipper
    g.generateTexture('ch2-bag', 46, 16);
    g.clear();

    // The prosthetic: angular cold metal, AI-core glow at its heart.
    g.fillStyle(0x39424e, 1);
    g.beginPath();
    g.moveTo(4, 2);
    g.lineTo(22, 0);
    g.lineTo(30, 12);
    g.lineTo(26, 34);
    g.lineTo(10, 40);
    g.lineTo(0, 26);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.5, 0x9fd8e8, 0.9);
    g.lineBetween(6, 6, 20, 4);
    g.lineBetween(4, 24, 12, 36);
    g.fillStyle(0x9fd8e8, 1);
    g.fillCircle(15, 18, 4);
    g.fillStyle(0xd8f4fc, 1);
    g.fillCircle(15, 18, 1.8);
    g.generateTexture('ch2-prosthetic', 30, 40);
    g.clear();

    // Terminal screen.
    g.fillStyle(0x0a0f0c, 1);
    g.fillRoundedRect(0, 0, 34, 44, 3);
    g.fillStyle(0x12261a, 1);
    g.fillRect(3, 3, 28, 30);
    g.lineStyle(1, 0x2fbf71, 0.8);
    for (let i = 0; i < 4; i++) g.lineBetween(5, 8 + i * 6, 5 + 18 + (i % 2) * 6, 8 + i * 6);
    g.generateTexture('ch2-terminal', 34, 44);
    g.destroy();
  }

  // --------------------------------------------------- walk act: neon world

  buildSkyline() {
    // Night gradient.
    const sky = this.add.graphics().setScrollFactor(0).setDepth(0);
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      sky.fillStyle(Phaser.Display.Color.GetColor(10 + 8 * t, 8 + 10 * t, 26 + 14 * t), 1);
      sky.fillRect(0, (GAME_H / 40) * i, GAME_W, GAME_H / 40 + 1);
    }

    // Far towers with lit windows — parallax 0.15.
    const far = this.add.graphics().setScrollFactor(0.15).setDepth(1);
    let x = -60;
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    while (x < 3600) {
      const w = 90 + rnd() * 140;
      const h = 180 + rnd() * 240;
      far.fillStyle(0x0c1020, 1);
      far.fillRect(x, 500 - h, w, h);
      for (let wy = 500 - h + 12; wy < 490; wy += 16) {
        for (let wx = x + 8; wx < x + w - 8; wx += 14) {
          if (rnd() < 0.22) {
            const neon = rnd();
            far.fillStyle(neon < 0.12 ? 0xff2d78 : neon < 0.3 ? 0x27e0f5 : 0x3a4a66, 0.9);
            far.fillRect(wx, wy, 5, 7);
          }
        }
      }
      x += w + 20 + rnd() * 60;
    }

    // Clinic sign — where he is walking to.
    const sign = this.add
      .text(2380, 250, 'NEW BODY\nCLINIC', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '30px',
        color: '#27e0f5',
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0.55)
      .setDepth(1)
      .setAlpha(0.85);
    this.tweens.add({
      targets: sign,
      alpha: { from: 0.85, to: 0.35 },
      duration: 90,
      yoyo: true,
      repeat: -1,
      repeatDelay: 2400,
    });

    // Rain.
    this.add
      .particles(0, 0, 'ch2-mote', {
        x: { min: -20, max: GAME_W + 20 },
        y: { min: -40, max: -10 },
        speedY: { min: 520, max: 760 },
        speedX: { min: -60, max: -30 },
        scaleX: 0.16,
        scaleY: { min: 1.6, max: 3 },
        alpha: { start: 0.28, end: 0.1 },
        lifespan: 1400,
        frequency: 26,
        tint: 0x6a7f96,
      })
      .setScrollFactor(0)
      .setDepth(40);
  }

  buildWalkWorld() {
    const g = this.add.graphics().setDepth(2);
    // Rooftop slab.
    g.fillStyle(0x11151d, 1);
    g.fillRect(-100, WALK.ground, WALK.end + 500, GAME_H - WALK.ground + 60);
    const rim = this.add.graphics().setDepth(3);
    rim.lineStyle(2, 0x3a4a5c, 1);
    rim.lineBetween(-100, WALK.ground, WALK.end + 500, WALK.ground);

    // AC units to hop — the last easy jumps of his life.
    WALK.boxes.forEach((b) => {
      g.fillStyle(0x181d26, 1);
      g.fillRect(b.x0, b.top, b.x1 - b.x0, WALK.ground - b.top);
      rim.lineStyle(2, 0x3a4a5c, 1);
      rim.lineBetween(b.x0, b.top, b.x1, b.top);
      rim.lineStyle(1, 0x2a3442, 1);
      rim.lineBetween(b.x0 + 6, b.top + 8, b.x1 - 6, b.top + 8);
    });

    // Terminals with pre-op consent text.
    this.terminalsDone = new Set();
    WALK.terminals.forEach((t, i) => {
      this.add.image(t.x, WALK.ground - 22, 'ch2-terminal').setDepth(3);
      const txt = this.add
        .text(t.x, WALK.ground - 120, '', {
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '12px',
          color: '#2fbf71',
          align: 'center',
        })
        .setOrigin(0.5, 1)
        .setDepth(3)
        .setAlpha(0);
      t.txt = txt;
      t.idx = i;
    });

    // Clinic door: cold light spilling out.
    const doorX = WALK.end - 60;
    g.fillStyle(0x0d1118, 1);
    g.fillRect(doorX, WALK.ground - 130, 90, 130);
    rim.lineStyle(2, 0x27e0f5, 0.9);
    rim.strokeRect(doorX, WALK.ground - 130, 90, 130);
    const spill = this.add
      .image(doorX + 45, WALK.ground - 60, 'ch2-mote')
      .setScale(16, 9)
      .setTint(0x27e0f5)
      .setAlpha(0.12)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(2);
    this.tweens.add({ targets: spill, alpha: 0.22, duration: 1600, yoyo: true, repeat: -1 });
    this.add
      .text(doorX + 45, WALK.ground - 152, 'SURGERY →', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '12px',
        color: '#27e0f5',
      })
      .setOrigin(0.5, 1)
      .setDepth(3);
  }

  walkGroundAt(x) {
    let y = WALK.ground;
    for (const b of WALK.boxes) if (x >= b.x0 && x <= b.x1) y = Math.min(y, b.top);
    return y;
  }

  buildHumanoid() {
    // Origin at the feet. Parts are separate so the cutscene can take them.
    this.figure = this.add.container(120, WALK.ground).setDepth(5);
    this.parts = {
      body: this.add.image(0, -31, 'ch2-hu-body'),
      head: this.add.image(1, -50, 'ch2-hu-head'),
      armL: this.add.image(-9, -42, 'ch2-hu-arm').setOrigin(0.5, 0.1),
      armR: this.add.image(9, -42, 'ch2-hu-arm').setOrigin(0.5, 0.1),
      legL: this.add.image(-4, -18, 'ch2-hu-leg').setOrigin(0.5, 0.05),
      legR: this.add.image(4, -18, 'ch2-hu-leg').setOrigin(0.5, 0.05),
    };
    this.figure.add(Object.values(this.parts));
    this.walker = { x: 120, y: WALK.ground, vy: 0, grounded: true, facing: 1, phase: 0 };
  }

  buildPromptChips() {
    // The abilities the player currently owns. The cutscene burns them out.
    this.chips = PROMPTS.map((p, i) => {
      const txt = this.add
        .text(14, 12 + i * 20, p.label, {
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '12px',
          color: '#7f8b99',
        })
        .setScrollFactor(0)
        .setDepth(60);
      return { txt, lit: true };
    });
  }

  flashChip(i) {
    const c = this.chips[i];
    if (!c || !c.lit) return;
    c.txt.setColor('#c9e8f2');
    this.time.delayedCall(120, () => c.lit && c.txt.setColor('#7f8b99'));
  }

  burnChip(i) {
    const c = this.chips[i];
    if (!c || !c.lit) return;
    c.lit = false;
    c.txt.setColor('#3a3f46');
    c.txt.setText(c.txt.text + '  ✕');
    const b = c.txt.getBounds();
    this.add
      .particles(b.right - 8, b.centerY, 'ch2-mote', {
        speed: { min: 30, max: 120 },
        lifespan: 420,
        quantity: 10,
        scale: { min: 0.3, max: 0.8 },
        tint: [0xff5a3c, 0xffa23c],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setScrollFactor(0)
      .setDepth(61)
      .explode(10);
    synthBuzz(this, { freq: 90, dur: 0.25, gain: 0.1 });
  }

  // ------------------------------------------------------------ OR set (CS)

  buildOrSet() {
    // The operating room lives far right of the rooftop; the camera only
    // visits during the cutscene.
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x0b0e14, 1);
    g.fillRect(OR.roomL, 140, OR.roomR - OR.roomL, 460);
    // Tiled back wall, surgical greenwhite, mostly dark.
    g.lineStyle(1, 0x161c26, 1);
    for (let x = OR.roomL; x < OR.roomR; x += 46) g.lineBetween(x, 140, x, 600);
    for (let y = 140; y < 600; y += 46) g.lineBetween(OR.roomL, y, OR.roomR, y);
    // Glass tanks with organ silhouettes — procedural, per §3.1.
    [2960, 3060, 3540, 3640].forEach((tx, i) => {
      g.fillStyle(0x0e1a1c, 0.9);
      g.fillRoundedRect(tx, 220, 54, 150, 8);
      g.fillStyle(0x27443e, 0.55);
      if (i % 2 === 0) g.fillEllipse(tx + 27, 290, 22, 34);
      else g.fillCircle(tx + 27, 285, 13);
    });

    // Table.
    g.fillStyle(0x1a212c, 1);
    g.fillRect(OR.tableX - 95, OR.tableY, 190, 14);
    g.fillRect(OR.tableX - 8, OR.tableY + 14, 16, 60);
    const rim = this.add.graphics().setDepth(3);
    rim.lineStyle(2, 0x46525f, 1);
    rim.lineBetween(OR.tableX - 95, OR.tableY, OR.tableX + 95, OR.tableY);

    // Surgical light cone above the table.
    this.orLight = this.add
      .image(OR.tableX, 300, 'ch2-mote')
      .setScale(26, 20)
      .setTint(0xbfe8f0)
      .setAlpha(0.0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4);

    // Robotic arm from the ceiling: two segments, hidden until the cuts.
    this.arm = this.add.container(OR.tableX, 140).setDepth(4).setAlpha(0);
    const seg1 = this.add.image(0, 60, 'ch2-beam').setScale(0.4, 12).setTint(0x39424e);
    const seg2 = this.add.image(0, 150, 'ch2-beam').setScale(0.28, 8).setTint(0x39424e);
    const claw = this.add.image(0, 208, 'ch2-mote').setScale(2.6).setTint(0xff5a3c);
    this.arm.add([seg1, seg2, claw]);

    // The prosthetic waiting on a side tray — the thing the explosion steals.
    this.orProsthetic = this.add.image(OR.tableX + 220, OR.tableY - 18, 'ch2-prosthetic').setDepth(3);
    this.add
      .image(OR.tableX + 220, OR.tableY - 18, 'ch2-mote')
      .setScale(7)
      .setTint(0x9fd8e8)
      .setAlpha(0.25)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(2);

    // Lying figure on the table: same parts, rearranged horizontally,
    // spread across the table so the silhouette reads at a glance.
    this.lying = this.add.container(OR.tableX, OR.tableY - 10).setDepth(5).setVisible(false);
    this.lyingParts = {
      body: this.add.image(0, 0, 'ch2-hu-body').setRotation(Math.PI / 2),
      head: this.add.image(-32, -1, 'ch2-hu-head'),
      armL: this.add.image(-4, -12, 'ch2-hu-arm').setRotation(Math.PI / 2 + 0.18).setOrigin(0.5, 0.1),
      armR: this.add.image(4, 10, 'ch2-hu-arm').setRotation(Math.PI / 2 - 0.14).setOrigin(0.5, 0.1),
      legL: this.add.image(30, -4, 'ch2-hu-leg').setRotation(Math.PI / 2 + 0.08).setOrigin(0.5, 0.05),
      legR: this.add.image(31, 6, 'ch2-hu-leg').setRotation(Math.PI / 2 - 0.06).setOrigin(0.5, 0.05),
    };
    this.lying.add(Object.values(this.lyingParts));

    // Blood pool spreading across the table, grows with every cut.
    this.csPool = this.add
      .rectangle(OR.tableX, OR.tableY - 4, 0, 7, 0x5c1216, 0.85)
      .setDepth(4);

    // Blood-shadow splashes at table height — the blood belongs to the
    // body, not the ceiling (was y=300: a streak floating mid-air).
    this.splashes = [-70, -25, 30, 75].map((dx) =>
      this.add
        .image(OR.tableX + dx, OR.tableY - 22, 'ch2-mote')
        .setScale(9, 5)
        .setTint(0x6e1f24)
        .setAlpha(0)
        .setDepth(3),
    );

    // Cutscene overlay text.
    this.csText = this.add
      .text(GAME_W / 2, 90, '', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '15px',
        color: '#9fb4c4',
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(62);

    // Letterbox bars (scaleY-driven: Rectangle height is not tween-safe).
    this.barT = this.add.rectangle(0, 0, GAME_W, 56, 0x000000).setOrigin(0, 0).setScale(1, 0).setScrollFactor(0).setDepth(55);
    this.barB = this.add
      .rectangle(0, GAME_H, GAME_W, 56, 0x000000)
      .setOrigin(0, 1)
      .setScale(1, 0)
      .setScrollFactor(0)
      .setDepth(55);
  }

  // -------------------------------------------------------------- walk update

  updateWalk(dt) {
    const w = this.walker;
    const k = this.keys;
    const left = k.left.isDown || k.a.isDown;
    const right = k.right.isDown || k.d.isDown;

    const SPEED = 240;
    let vx = 0;
    if (left && !right) vx = -SPEED;
    else if (right && !left) vx = SPEED;
    if (vx !== 0) {
      w.facing = Math.sign(vx);
      this.flashChip(vx < 0 ? 1 : 2);
    }

    // Horizontal move, blocked by box walls rising more than a step.
    const nx = w.x + vx * dt;
    const gCur = this.walkGroundAt(w.x);
    const gNew = this.walkGroundAt(nx);
    if (w.grounded && gNew < gCur - 12) {
      // wall
    } else {
      w.x = Phaser.Math.Clamp(nx, 40, WALK.end);
    }

    // Jump — the baseline that is about to be taken away.
    if (w.grounded && Phaser.Input.Keyboard.JustDown(k.jump)) {
      w.vy = -730;
      w.grounded = false;
      this.flashChip(0);
    }

    if (!w.grounded) {
      w.vy += 1900 * dt;
      w.y += w.vy * dt;
      const gy = this.walkGroundAt(w.x);
      if (w.vy > 0 && w.y >= gy) {
        w.y = gy;
        w.vy = 0;
        w.grounded = true;
      }
    } else {
      w.y = this.walkGroundAt(w.x);
    }

    // Walk cycle.
    w.phase += Math.abs(vx) * dt * 0.045;
    const sw = w.grounded && vx !== 0 ? Math.sin(w.phase) * 0.55 : 0;
    this.parts.legL.setRotation(sw);
    this.parts.legR.setRotation(-sw);
    this.parts.armL.setRotation(-sw * 0.8);
    this.parts.armR.setRotation(sw * 0.8);
    this.figure.setPosition(w.x, w.y);
    this.figure.setScale(w.facing, 1);

    // Terminals type their consent text as he passes.
    WALK.terminals.forEach((t, i) => {
      if (!this.terminalsDone.has(i) && Math.abs(w.x - t.x) < 210) {
        this.terminalsDone.add(i);
        this.typeText(t.txt, t.lines.join('\n'), 26);
      }
    });

    // The door.
    if (w.x >= WALK.end - 110) this.startCutscene();
  }

  typeText(txt, full, cps = 30) {
    txt.setAlpha(1);
    txt.setText('');
    let i = 0;
    const timer = this.time.addEvent({
      delay: 1000 / cps,
      repeat: full.length - 1,
      callback: () => {
        i++;
        txt.setText(full.slice(0, i));
      },
    });
    return timer;
  }

  // ---------------------------------------------------------------- cutscene

  startCutscene() {
    this.phase = 'CS_PAN';
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.setBounds(0, 0, OR.roomR, GAME_H);
    // He walks through the door ahead of the lens; the camera slides in
    // after him. The room was always there — no black, one take.
    this.figure.setVisible(false);
    cam.pan(OR.tableX, 400, 850, 'Cubic.easeInOut', true, () => {
      this.lying.setVisible(true);
      cam.setBounds(OR.roomL, 0, OR.roomR - OR.roomL, GAME_H);
      cam.centerOn(OR.tableX, 400);
      this.tweens.add({ targets: cam, zoom: 1.25, duration: 500 });
      this.csStart = this.time.now + 500;
      this.csBeat = 0;
      this.phase = 'CS';
      this.hint.setText('SPACE — skip');
      this.buildCsBeats();
    });
  }

  buildCsBeats() {
    const cutLimb = (i) => {
      const names = ['legR', 'legL', 'armR', 'armL'];
      // Arm descends, the saw sings, the wall takes the blood — the camera
      // never shows the cut itself (design §3.2).
      this.tweens.add({
        targets: this.arm,
        alpha: 1,
        y: 140 + 150,
        duration: 650,
        ease: 'Quad.easeIn',
        onComplete: () => {
          synthBuzz(this, { freq: 150 + i * 25, dur: 0.7, gain: 0.18 });
          this.cameras.main.flash(160, 120, 10, 12);
          const part = this.lyingParts[names[i]];
          part.setVisible(false);
          // The severed limb drops off the table and stays on the floor.
          const drop = this.add
            .image(this.lying.x + part.x, this.lying.y + part.y, part.texture.key)
            .setOrigin(part.originX, part.originY)
            .setRotation(part.rotation)
            .setDepth(6);
          this.tweens.add({
            targets: drop,
            y: 588,
            rotation: part.rotation + 2.1,
            duration: 620,
            ease: 'Quad.easeIn',
            onComplete: () => this.tweens.add({ targets: drop, alpha: 0.55, duration: 1200 }),
          });
          // The pool spreads with every cut.
          this.csPool.setSize(56 + i * 34, 7);
          this.splashes[i].setAlpha(0.85);
          this.tweens.add({ targets: this.splashes[i], alpha: 0.4, duration: 900 });
          this.add
            .particles(this.lying.x, this.lying.y, 'ch2-mote', {
              speed: { min: 40, max: 180 },
              lifespan: 500,
              quantity: 16,
              scale: { min: 0.4, max: 1.1 },
              tint: [0x8e1f24, 0x5c1216],
              blendMode: Phaser.BlendModes.ADD,
              emitting: false,
            })
            .setDepth(6)
            .explode(16);
          // The UI loses the ability with the limb — jump first, then left,
          // then right, then interact.
          this.burnChip(i);
          this.tweens.add({ targets: this.arm, y: 140, alpha: 0, duration: 700, delay: 500 });
        },
      });
    };

    this.csBeats = [
      {
        at: 600,
        fn: () => {
          this.tweens.add({
            targets: [this.barT, this.barB],
            scaleY: 1,
            duration: 900,
            ease: 'Quad.easeOut',
          });
          this.tweens.add({ targets: this.orLight, alpha: 0.16, duration: 1200 });
        },
      },
      { at: 1400, fn: () => this.typeText(this.csText, 'AI bridge status: READY.', 24) },
      { at: 3400, fn: () => this.typeText(this.csText, 'ANESTHETIC: declined by subject.', 24) },
      { at: 5200, fn: () => cutLimb(0) },
      { at: 9200, fn: () => cutLimb(1) },
      { at: 13200, fn: () => cutLimb(2) },
      { at: 17200, fn: () => cutLimb(3) },
      {
        at: 21200,
        fn: () => this.typeText(this.csText, 'AI bridge: CONNECTED.\n\nHello.', 20),
      },
      { at: 24800, fn: () => this.csExplosion() },
      { at: 27600, fn: () => this.csRumble() },
      { at: 30600, fn: () => this.csFloorDrops() },
    ];
  }

  updateCs() {
    const t = this.time.now - this.csStart;
    if (this.csSkipped) return;
    // Grace window: a Space still registering from the walk-in must not
    // skip the cutscene by accident.
    if (t > 800 && Phaser.Input.Keyboard.JustDown(this.keys.jump)) {
      this.skipCutscene();
      return;
    }
    while (this.csBeat < this.csBeats.length && t >= this.csBeats[this.csBeat].at) {
      this.csBeats[this.csBeat].fn();
      this.csBeat++;
    }
  }

  csExplosion() {
    // White light, low boom, the table flips — and the prosthetic is blown
    // out of the building, down toward L2-2.
    this.cameras.main.flash(420, 255, 255, 255);
    synthThud(this, { freq: 60, gain: 0.85, dur: 1.0 });
    this.cameras.main.shake(700, 0.02);
    this.csText.setText('');
    this.orLight.setAlpha(0);

    this.tweens.add({
      targets: this.lying,
      rotation: -0.35,
      x: this.lying.x - 40,
      y: this.lying.y + 26,
      duration: 800,
      ease: 'Quad.easeOut',
    });

    // The cold thing arcs away into the dark.
    const px = this.orProsthetic.x;
    const py = this.orProsthetic.y;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1400,
      ease: 'Quad.easeIn',
      onUpdate: (tw) => {
        const u = tw.getValue();
        this.orProsthetic.setPosition(px + 900 * u, py - 260 * u + 900 * u * u);
        this.orProsthetic.setRotation(u * 9);
        this.orProsthetic.setAlpha(1 - u * 0.6);
      },
      onComplete: () => this.orProsthetic.setVisible(false),
    });

    // Debris burst.
    this.add
      .particles(OR.tableX, OR.tableY, 'ch2-chunk', {
        speed: { min: 120, max: 480 },
        angle: { min: 200, max: 340 },
        gravityY: 1400,
        lifespan: 1400,
        quantity: 14,
        rotate: { min: -360, max: 360 },
        emitting: false,
      })
      .setDepth(6)
      .explode(14);
  }

  csRumble() {
    this.cameras.main.shake(2400, 0.004);
    synthThud(this, { freq: 45, gain: 0.4, dur: 1.6 });
    // Dust from the ceiling.
    this.add.particles(0, 0, 'ch2-mote', {
      x: { min: OR.roomL, max: OR.roomR },
      y: { min: 150, max: 200 },
      speedY: { min: 30, max: 90 },
      lifespan: 2200,
      quantity: 2,
      frequency: 90,
      scale: { min: 0.3, max: 0.9 },
      alpha: { start: 0.4, end: 0 },
      tint: 0x5d6a78,
    });
  }

  csFloorDrops() {
    // The floor gives way; what is left of him falls — and the camera falls
    // with him, straight through the collapse, into the roll. One take.
    this.tweens.add({
      targets: this.lying,
      y: this.lying.y + 500,
      rotation: -1.2,
      duration: 900,
      ease: 'Quad.easeIn',
    });
    this.dropToRoll1(1000);
  }

  skipCutscene() {
    this.csSkipped = true;
    this.tweens.killAll();
    this.dropToRoll1(650);
  }

  /** Camera falls from the OR into the collapse route — no black. */
  dropToRoll1(panMs) {
    const cam = this.cameras.main;
    cam.shake(panMs, 0.005);
    synthThud(this, { freq: 50, gain: 0.45, dur: 1.1 });
    // The world tears upward past the lens — we are falling.
    const streaks = this.add
      .particles(0, 0, 'ch2-mote', {
        x: { min: 0, max: GAME_W },
        y: { min: -20, max: GAME_H + 20 },
        speedY: { min: -1400, max: -700 },
        speedX: { min: -60, max: 60 },
        lifespan: { min: 250, max: 600 },
        quantity: 3,
        frequency: 45,
        scale: { min: 0.3, max: 0.9 },
        alpha: { start: 0.5, end: 0 },
        tint: [0x3a4a5c, 0x5d6a78, 0x8e1f24],
        blendMode: Phaser.BlendModes.ADD,
        emitting: true,
      })
      .setScrollFactor(0)
      .setDepth(85);
    cam.pan(444, 1628, panMs, 'Cubic.easeIn', true, () => {
      streaks.destroy();
      this.setupRoll1();
    });
  }

  // ------------------------------------------------------------- roll acts

  /** Shared setup for the torso-rolling acts. */
  enterRollPhase(field, spawn, camBounds, hintText) {
    this.rollField = field;
    this.rollSpawn = spawn;
    if (!this.torso) this.torso = new Torso(this, spawn);
    else this.torso.reset(spawn);
    this.torso.setVisible(true);
    this.deathFxStarted = false;

    const cam = this.cameras.main;
    cam.stopFollow();
    cam.setBounds(camBounds.x, camBounds.y, camBounds.w, camBounds.h);
    // Keep whatever zoom the transition carried in; updateRoll lerps it
    // to the speed-based target from the first frame — no snap, no fade.
    cam.startFollow(this.torso.blob, true, 0.1, 0.1);
    cam.setFollowOffset(0, 60);
    this.hint.setText(hintText);
  }

  setupRoll1() {
    this.phase = 'ROLL1';
    // Cut the cutscene dressing loose.
    [this.barT, this.barB].forEach((b) => b.setScale(1, 0));
    this.csText.setText('');
    this.arm.setVisible(false);
    this.lying.setVisible(false);
    this.orLight.setAlpha(0);
    this.chips.forEach((c, i) => c.lit && this.burnChip(i));
    this.hint.setText('');

    const field = new Heightfield(ROLL1.contour, ROLL1.gaps);
    field.draw(this, { maxX: 2900, bottom: 2850 });
    this.buildRoll1Backdrop();

    // Falling ceiling debris: bounce + blood, never lethal (design §3.3).
    this.chunks = [];
    this.chunkTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.spawnChunk(),
    });

    this.enterRollPhase(field, ROLL1.spawn, { x: 0, y: 1350, w: 3150, h: 1500 },
      'A/D — roll · SPACE — shoulder hop · the fall is the only way out');
  }

  buildRoll1Backdrop() {
    // Collapsing tower interior: tilted floor slabs, emergency red wash.
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x080a10, 1);
    g.fillRect(0, 1300, 3150, 1600);
    g.lineStyle(3, 0x141a24, 1);
    for (let i = 0; i < 9; i++) {
      const x = 150 + i * 340;
      g.lineBetween(x, 1350 + (i % 3) * 120, x + 260, 1390 + (i % 3) * 120);
    }
    const alarm = this.add
      .rectangle(1575, 1420, 3150, 300, 0x5c1216, 0.05)
      .setDepth(1);
    this.tweens.add({ targets: alarm, alpha: 0.6, duration: 700, yoyo: true, repeat: -1 });
    // Dust.
    this.add.particles(0, 0, 'ch2-mote', {
      x: { min: -40, max: GAME_W + 40 },
      y: { min: -30, max: GAME_H },
      lifespan: 1500,
      speedX: { min: -220, max: -100 },
      speedY: { min: 40, max: 110 },
      scale: { min: 0.2, max: 0.6 },
      alpha: { start: 0.4, end: 0 },
      quantity: 1,
      frequency: 70,
      blendMode: Phaser.BlendModes.ADD,
    })
      .setScrollFactor(0)
      .setDepth(6);
  }

  spawnChunk() {
    if (this.phase !== 'ROLL1' || !this.torso || this.torso.p.dead) return;
    if (this.chunks.length >= 5) return; // never bury the player in debris
    const cam = this.cameras.main;
    const x = cam.scrollX + Phaser.Math.Between(100, GAME_W - 60);
    const y = cam.scrollY - 30;
    const img = this.add.image(x, y, 'ch2-chunk').setDepth(4).setRotation(Math.random() * 6);
    this.chunks.push({ img, vy: Phaser.Math.Between(40, 160), rot: Phaser.Math.FloatBetween(-3, 3) });
  }

  updateChunks(dt) {
    const p = this.torso.p;
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const c = this.chunks[i];
      c.vy += 1900 * dt;
      c.img.y += c.vy * dt;
      c.img.rotation += c.rot * dt;
      const gy = this.rollField.groundAt(c.img.x);
      // Hit the torso: a bonk, blood, squash — then the chunk shatters.
      // It knocks speed OFF, never reverses it: a reversal on the slope
      // pinned the torso in place and soft-locked the fall (bug).
      if (!p.dead && Phaser.Math.Distance.Between(c.img.x, c.img.y, p.x, p.y) < ROLL_TUNE.radius + 11) {
        if (p.grounded) p.speed *= 0.55;
        else {
          p.vx *= 0.6;
          p.vy = Math.min(p.vy, -140);
        }
        this.torso.squash(-7);
        this.cameras.main.shake(120, 0.004);
        this.bloodBurst(p.x, p.y, 20);
        synthThud(this, { freq: 120, gain: 0.3, dur: 0.25 });
        this.shatterChunk(c);
        this.chunks.splice(i, 1);
        continue;
      }
      // Hit the ground: small splat, gone.
      if (gy !== null && c.img.y > gy + 8) {
        this.shatterChunk(c);
        this.chunks.splice(i, 1);
      }
    }
  }

  shatterChunk(c) {
    this.add
      .particles(c.img.x, c.img.y, 'ch2-mote', {
        speed: { min: 60, max: 200 },
        lifespan: 400,
        quantity: 8,
        scale: { min: 0.3, max: 0.7 },
        tint: 0x4a5563,
        emitting: false,
      })
      .setDepth(6)
      .explode(8);
    c.img.destroy();
  }

  bloodBurst(x, y, n) {
    this.add
      .particles(x, y, 'ch2-mote', {
        speed: { min: 60, max: 260 },
        lifespan: { min: 300, max: 700 },
        quantity: n,
        scale: { min: 0.4, max: 1.2 },
        tint: [0x8e1f24, 0x5c1216, 0xb03036],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(6)
      .explode(n);
  }

  // --------------------------------------------------------------- shaft act

  setupShaft() {
    this.phase = 'SHAFT';
    this.chunkTimer.remove();
    this.chunks.forEach((c) => c.img.destroy());
    this.chunks = [];

    // Shaft walls and beams.
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x07090e, 1);
    g.fillRect(SHAFT.wallL - 220, SHAFT.top - 400, (SHAFT.wallR - SHAFT.wallL) + 440, SHAFT.cushionY - SHAFT.top + 700);
    g.fillStyle(0x10141c, 1);
    g.fillRect(SHAFT.wallL - 40, SHAFT.top - 400, 40, SHAFT.cushionY - SHAFT.top + 700);
    g.fillRect(SHAFT.wallR, SHAFT.top - 400, 40, SHAFT.cushionY - SHAFT.top + 700);
    const rim = this.add.graphics().setDepth(2);
    rim.lineStyle(2, 0x3a4a5c, 1);
    rim.lineBetween(SHAFT.wallL, SHAFT.top - 400, SHAFT.wallL, SHAFT.cushionY + 100);
    rim.lineBetween(SHAFT.wallR, SHAFT.top - 400, SHAFT.wallR, SHAFT.cushionY + 100);
    // Cable lines down the shaft.
    rim.lineStyle(1, 0x1d2632, 1);
    [4360, 4440, 4520].forEach((x) => rim.lineBetween(x, SHAFT.top - 400, x, SHAFT.cushionY));

    SHAFT.beams.forEach((b) => {
      const w = b.x1 - b.x0;
      this.add
        .image((b.x0 + b.x1) / 2, b.y, 'ch2-beam')
        .setScale(w / 64, 1)
        .setDepth(2);
    });

    // The soft landing: body bags. Dark, and it saves his life — §3.3.
    for (let row = 0; row < 3; row++) {
      const count = 8 - row * 2;
      for (let i = 0; i < count; i++) {
        this.add
          .image(SHAFT.wallL + 40 + i * 48 + row * 22, SHAFT.cushionY + 8 - row * 14, 'ch2-bag')
          .setRotation((Math.random() - 0.5) * 0.3)
          .setDepth(2);
      }
    }

    // Put the torso at the shaft mouth, falling.
    const p = this.torso.p;
    p.x = (SHAFT.wallL + SHAFT.wallR) / 2;
    p.y = SHAFT.top - 120;
    p.vx = Phaser.Math.Clamp(p.vx, -200, 200);
    p.vy = 60;
    p.grounded = false;
    p.dead = false;
    this.shaftLanded = false;

    const cam = this.cameras.main;
    cam.stopFollow();
    cam.setBounds(SHAFT.wallL - 220, SHAFT.top - 400, (SHAFT.wallR - SHAFT.wallL) + 440, SHAFT.cushionY - SHAFT.top + 700);
    cam.startFollow(this.torso.blob, true, 0.08, 0.12);
    cam.setFollowOffset(0, -60);
    this.hint.setText('A/D — steer the fall · the beams slow you down');
  }

  updateShaft(dt) {
    const p = this.torso.p;
    const k = this.keys;
    const T = ROLL_TUNE;
    const prevY = p.y;

    p.vy = Math.min(p.vy + T.gravity * dt, 1150);
    if ((k.left.isDown || k.a.isDown) && !(k.right.isDown || k.d.isDown)) p.vx -= 520 * dt;
    else if ((k.right.isDown || k.d.isDown) && !(k.left.isDown || k.a.isDown)) p.vx += 520 * dt;
    p.vx *= Math.max(0, 1 - 1.6 * dt);
    p.vx = Phaser.Math.Clamp(p.vx, -380, 380);

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Walls.
    if (p.x < SHAFT.wallL + T.radius) {
      p.x = SHAFT.wallL + T.radius;
      if (p.vx < -60) this.shaftGraze(p.x, p.y);
      p.vx = Math.abs(p.vx) * 0.3;
    } else if (p.x > SHAFT.wallR - T.radius) {
      p.x = SHAFT.wallR - T.radius;
      if (p.vx > 60) this.shaftGraze(p.x, p.y);
      p.vx = -Math.abs(p.vx) * 0.3;
    }

    // Beams: crossing one on the way down = a graze, sparks, speed bled.
    // The push is always toward the beam's FREE end (the side not bolted to
    // a wall) so a slow torso slides off the tip instead of balancing on it
    // forever; feeble contact slips off instead of bouncing.
    for (const b of SHAFT.beams) {
      if (
        prevY + T.radius <= b.y &&
        p.y + T.radius >= b.y &&
        p.x >= b.x0 - 6 &&
        p.x <= b.x1 + 6 &&
        p.vy > 0
      ) {
        const freeDir = b.x0 <= SHAFT.wallL + 1 ? 1 : -1;
        if (p.vy > 110) {
          p.y = b.y - T.radius;
          p.vy = -p.vy * 0.16;
          p.vx += freeDir * 140;
          this.shaftGraze(p.x, b.y - 4);
          this.torso.squash(-5);
          synthThud(this, { freq: 140, gain: 0.22, dur: 0.2 });
        } else {
          // Too slow to bounce — roll off the free end.
          p.vx += freeDir * 90;
        }
      }
    }

    // The cushion.
    if (!this.shaftLanded && p.y + T.radius >= SHAFT.cushionY) {
      p.y = SHAFT.cushionY - T.radius;
      p.vy = 0;
      p.vx = 0;
      p.grounded = true;
      this.shaftLanded = true;
      this.torso.squash(-9);
      this.cameras.main.shake(200, 0.006);
      synthThud(this, { freq: 70, gain: 0.5, dur: 0.6 });
      // Dust off the bags.
      this.add
        .particles(p.x, SHAFT.cushionY, 'ch2-mote', {
          speed: { min: 40, max: 160 },
          lifespan: 800,
          quantity: 18,
          scale: { min: 0.4, max: 1 },
          tint: 0x4a5244,
          emitting: false,
        })
        .setDepth(6)
        .explode(18);
      // A beat in the dark, then the torso rolls on — the camera tears
      // right after it, out of the shaft, into the ruins. One take.
      this.time.delayedCall(900, () => {
        const cam = this.cameras.main;
        cam.stopFollow();
        synthBuzz(this, { freq: 120, dur: 0.6, gain: 0.12 });
        const streaks = this.add
          .particles(0, 0, 'ch2-mote', {
            x: { min: 0, max: GAME_W },
            y: { min: 0, max: GAME_H },
            speedX: { min: -1600, max: -900 },
            speedY: 0,
            lifespan: { min: 200, max: 420 },
            quantity: 3,
            frequency: 40,
            scale: { min: 0.3, max: 0.8 },
            alpha: { start: 0.5, end: 0 },
            tint: [0x3a4a5c, 0x5d6a78],
            blendMode: Phaser.BlendModes.ADD,
            emitting: true,
          })
          .setScrollFactor(0)
          .setDepth(85);
        cam.pan(5794, 5228, 750, 'Cubic.easeInOut', true, () => {
          streaks.destroy();
          this.setupRamp();
        });
      });
    }

    this.torso.updateFlesh(dt);
  }

  shaftGraze(x, y) {
    this.add
      .particles(x, y, 'ch2-mote', {
        speed: { min: 80, max: 260 },
        lifespan: 350,
        quantity: 12,
        scale: { min: 0.3, max: 0.7 },
        tint: [0xffc46b, 0xff8a3c, 0xd8f4fc],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(6)
      .explode(12);
  }

  // ---------------------------------------------------------------- ramp act

  setupRamp() {
    this.phase = 'RAMP';

    const field = new Heightfield(RAMP.contour, RAMP.gaps);
    field.draw(this, { maxX: RAMP.worldEnd + 50, bottom: 6550 });
    this.buildRampBackdrop();

    this.enterRollPhase(field, RAMP.spawn, { x: 5350, y: 4950, w: 3800, h: 1700 },
      'A/D — roll · SPACE — hop · do not stop');
    this.torso.p.speed = 220; // carried out of the shaft
    this.endStarted = false;
  }

  buildRampBackdrop() {
    // Underground ruins: crushed slabs, and far right — the cold glow.
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x06080c, 1);
    g.fillRect(5350, 4900, 3800, 1800);
    g.lineStyle(4, 0x11161f, 1);
    for (let i = 0; i < 12; i++) {
      const x = 5450 + i * 300;
      g.lineBetween(x, 5000 + (i % 4) * 160, x + 200, 5040 + (i % 4) * 160);
    }
    // Scattered limb silhouettes half-buried in the ruins — L2-2's theme
    // leaking into the end of L2-1.
    g.fillStyle(0x14181f, 1);
    [6000, 6600, 7700, 8300].forEach((x, i) => {
      g.fillEllipse(x, 5010 + (i % 2) * 60, 40, 12);
      g.fillEllipse(x + 26, 5004 + (i % 2) * 60, 14, 10);
    });

    // The prosthetic, jammed in the rubble, glowing cold.
    const px = RAMP.prostheticX;
    const py = 5940 - 14;
    g.fillStyle(0x181d26, 1);
    g.fillTriangle(px - 60, 5940, px + 60, 5940, px + 10, 5940 - 46);
    this.prosthetic = this.add.image(px, py - 12, 'ch2-prosthetic').setDepth(3);
    this.prostheticGlow = this.add
      .image(px, py - 12, 'ch2-mote')
      .setScale(12)
      .setTint(0x9fd8e8)
      .setAlpha(0.2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(2);
    this.tweens.add({
      targets: this.prostheticGlow,
      alpha: { from: 0.12, to: 0.3 },
      scale: { from: 10, to: 14 },
      duration: 1300,
      yoyo: true,
      repeat: -1,
    });
  }

  updateEnd(dt) {
    // Input is gone. The torso rolls itself the last meters to the glow.
    const p = this.torso.p;
    const stopX = RAMP.prostheticX - 70;
    if (!p.grounded) {
      // Crossed the trigger mid-hop: land first, then keep rolling.
      this.torso.stepAirborne(dt, { left: false, right: false, jump: false }, this.rollField, { worldEnd: RAMP.worldEnd });
    } else if (p.grounded) {
      const dist = stopX - p.x;
      if (dist > 4) {
        p.speed = Phaser.Math.Linear(p.speed, Math.max(40, dist * 1.6), 0.08);
        const t = this.rollField.tangentAt(p.x);
        p.x += p.speed * t.x * dt;
        p.y = this.rollField.groundAt(p.x) - ROLL_TUNE.radius;
      } else {
        p.speed = 0;
        if (!this.endSettled) {
          this.endSettled = true;
          this.endSequence();
        }
      }
    }
    this.torso.updateFlesh(dt);
  }

  endSequence() {
    // The cold light notices him — then it takes the whole frame. It never
    // goes black: the glow IS the cut. L2-2 opens inside the same light.
    this.tweens.add({
      targets: this.prostheticGlow,
      alpha: 0.65,
      scale: 22,
      duration: 1600,
      ease: 'Quad.easeInOut',
    });
    synthThud(this, { freq: 50, gain: 0.25, dur: 1.4 });
    this.time.delayedCall(1700, () => {
      const veil = this.add
        .rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x9fd8e8, 0)
        .setScrollFactor(0)
        .setDepth(100)
        .setBlendMode(Phaser.BlendModes.ADD);
      synthBuzz(this, { freq: 200, dur: 1.4, gain: 0.1 });
      this.tweens.add({
        targets: veil,
        alpha: 1,
        duration: 1400,
        ease: 'Quad.easeIn',
        onComplete: () => this.scene.start('Level22'),
      });
    });
  }

  // ------------------------------------------------------------ death & update

  startDeath() {
    this.deathFxStarted = true;
    this.deathAt = this.time.now;
  }

  updateDeath(dt) {
    this.torso.updateDead(dt, this.rollField);
    if (this.time.now - this.deathAt > 450) {
      playVoidDeath(this, () => {
        this.torso.reset(this.rollSpawn);
        this.deathFxStarted = false;
        const cam = this.cameras.main;
        cam.setZoom(ROLL_TUNE.camZoomSlow);
        cam.startFollow(this.torso.blob, true, 0.1, 0.1);
        cam.setFollowOffset(0, 60);
        cam.flash(140, 159, 216, 232); // the body re-forms in a cold blink
      }, { panTo: { x: this.rollSpawn.x, y: this.rollSpawn.y } });
      this.deathAt = this.time.now + 999999; // fire once
    }
  }

  updateRoll(dt, worldEnd, killY) {
    const p = this.torso.p;
    if (p.dead) {
      this.updateDeath(dt);
      return;
    }

    const k = this.keys;
    const input = {
      left: k.left.isDown || k.a.isDown,
      right: k.right.isDown || k.d.isDown,
      jump: Phaser.Input.Keyboard.JustDown(k.jump),
    };

    let ev = null;
    if (p.grounded) ev = this.torso.stepGrounded(dt, input, this.rollField, { worldEnd });
    else ev = this.torso.stepAirborne(dt, input, this.rollField, { worldEnd });

    if (ev === 'bonk') {
      this.cameras.main.shake(60, 0.002);
      synthThud(this, { freq: 110, gain: 0.2, dur: 0.2 });
    } else if (ev === 'land') {
      this.cameras.main.shake(90, 0.003);
      // Meat meets concrete: a heavy slap of grit and blood-fleck.
      this.add
        .particles(p.x, p.y - 4, 'ch2-mote', {
          speed: { min: 40, max: 160 },
          angle: { min: 200, max: 340 },
          lifespan: { min: 250, max: 550 },
          quantity: 10,
          scale: { min: 0.4, max: 1 },
          tint: [0x4a5563, 0x5c1216],
          emitting: false,
        })
        .setDepth(2)
        .explode(10);
    } else if (ev === 'slam') {
      this.startDeath();
      return;
    }

    this.torso.updateFlesh(dt);

    // Rolling drags meat across concrete — a grit trail behind the contact.
    if (p.grounded && Math.abs(p.speed) > 80) {
      this.rollDustAcc = (this.rollDustAcc || 0) + dt;
      if (this.rollDustAcc > 0.09) {
        this.rollDustAcc = 0;
        this.add
          .particles(p.x - Math.sign(p.speed) * 14, p.y - 6, 'ch2-mote', {
            speed: { min: 30, max: 110 },
            angle: { min: 200, max: 340 },
            lifespan: { min: 250, max: 500 },
            quantity: 3,
            scale: { min: 0.3, max: 0.8 },
            tint: [0x4a5563, 0x5c1216],
            emitting: false,
          })
          .setDepth(2)
          .explode(3);
      }
    }

    if (p.y > killY) {
      p.dead = true;
      this.startDeath();
      return;
    }

    // Camera breathes out with speed.
    const sp = Math.abs(p.grounded ? p.speed : p.vx);
    const cam = this.cameras.main;
    const targetZoom = Phaser.Math.Linear(
      ROLL_TUNE.camZoomSlow,
      ROLL_TUNE.camZoomFast,
      Phaser.Math.Clamp(sp / ROLL_TUNE.maxRoll, 0, 1),
    );
    cam.setZoom(Phaser.Math.Linear(cam.zoom, targetZoom, 0.04));
  }

  update(_, deltaMs) {
    const dt = Math.min(deltaMs, 50) / 1000;

    switch (this.phase) {
      case 'WALK':
        this.updateWalk(dt);
        break;
      case 'CS':
        this.updateCs();
        break;
      case 'ROLL1': {
        this.updateRoll(dt, 3120, ROLL1.killY);
        this.updateChunks(dt);
        // The floor hole: fall past its lip and the shaft takes over.
        const p = this.torso.p;
        if (!p.dead && p.x > ROLL1.exitX && p.y > 2360) this.setupShaft();
        break;
      }
      case 'SHAFT':
        this.updateShaft(dt);
        break;
      case 'RAMP':
        this.updateRoll(dt, RAMP.worldEnd, RAMP.killY);
        if (!this.endStarted && !this.torso.p.dead && this.torso.p.x > RAMP.endTriggerX) {
          this.endStarted = true;
          this.phase = 'END';
          this.hint.setText('');
        }
        break;
      case 'END':
        this.updateEnd(dt);
        break;
    }
  }
}
