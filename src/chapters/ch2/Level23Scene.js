import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../constants.js';
import { makeTorsoTextures } from './torso.js';

/**
 * L2-3 「过载」 — stub. The ascent elevator from L2-2 arrives here; holds
 * the pre-dawn surface beat until the full level is built.
 */
export default class Level23Scene extends Phaser.Scene {
  constructor() {
    super('Level23');
  }

  create() {
    makeTorsoTextures(this);

    // Pre-dawn surface: lead grey, cold blue, one warm light far away (§7).
    const sky = this.add.graphics().setDepth(0);
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      sky.fillStyle(Phaser.Display.Color.GetColor(14 + 14 * t, 16 + 14 * t, 24 + 16 * t), 1);
      sky.fillRect(0, (GAME_H / 40) * i, GAME_W, GAME_H / 40 + 1);
    }
    // Ruined skyline silhouettes.
    const far = this.add.graphics().setDepth(1);
    let x = -30;
    let seed = 41;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    while (x < GAME_W + 60) {
      const w = 60 + rnd() * 100;
      const h = 90 + rnd() * 180;
      far.fillStyle(0x11151d, 1);
      far.fillRect(x, 470 - h, w, h);
      // broken tops
      if (rnd() < 0.6) far.fillTriangle(x + w * 0.3, 470 - h, x + w * 0.7, 470 - h, x + w * 0.5, 470 - h - 20 - rnd() * 20);
      x += w + 10 + rnd() * 40;
    }
    // Ground.
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x14181f, 1);
    g.fillRect(0, 470, GAME_W, GAME_H - 470);
    const rim = this.add.graphics().setDepth(3);
    rim.lineStyle(2, 0x3a4a5c, 1);
    rim.lineBetween(0, 470, GAME_W, 470);

    // The warm door far away — the only warm light in the level (§7).
    const door = this.add
      .image(GAME_W - 120, 430, 'ch2-mote')
      .setScale(10, 14)
      .setTint(0xffb46b)
      .setAlpha(0.2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(2);
    this.tweens.add({ targets: door, alpha: 0.36, duration: 1900, yoyo: true, repeat: -1 });

    this.add
      .text(GAME_W / 2, 150, 'L2-3 · 过载', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '30px',
        color: '#c9d6e2',
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.add
      .text(GAME_W / 2, 200, 'the metal remembers everything it touched.', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '13px',
        color: '#5d6a78',
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.add
      .text(GAME_W / 2, GAME_H - 60, '— in development —\nENTER — menu', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '12px',
        color: '#4a545f',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(5);

    // One take from L2-2: the ascent's dawn light recedes from the frame.
    const veil = this.add
      .rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x8a94b0, 1)
      .setScrollFactor(0)
      .setDepth(100)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: veil, alpha: 0, duration: 900, onComplete: () => veil.destroy() });

    // The parasite's count carries over — a whisper, not a report card.
    const shards = this.registry.get('ch2.shards');
    if (shards !== undefined) {
      const toast = this.add
        .text(GAME_W / 2, 240, `${shards} shards. it is still hungry.`, {
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '12px',
          color: '#5d6a78',
        })
        .setOrigin(0.5)
        .setDepth(5)
        .setAlpha(0);
      this.tweens.add({
        targets: toast,
        alpha: 0.9,
        duration: 900,
        delay: 1200,
        onComplete: () => this.tweens.add({ targets: toast, alpha: 0, duration: 1200, delay: 2600 }),
      });
    }

    this.keys = this.input.keyboard.addKeys({ enter: 'ENTER' });
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.enter)) {
      this.scene.start('Menu');
    }
  }
}
