import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../../constants.js';
import { makeTorsoTextures } from './torso.js';

/**
 * L2-2 「拼接」 — stub. The chapter flows here straight from L2-1's ending;
 * this scene holds the exact story beat (torso beside the prosthetic, in
 * the underground dark) until the full level is built.
 */
export default class Level22Scene extends Phaser.Scene {
  constructor() {
    super('Level22');
  }

  create() {
    makeTorsoTextures(this);

    // Underground dark.
    const g = this.add.graphics().setDepth(0);
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      g.fillStyle(Phaser.Display.Color.GetColor(4 + 4 * t, 5 + 5 * t, 8 + 6 * t), 1);
      g.fillRect(0, (GAME_H / 40) * i, GAME_W, GAME_H / 40 + 1);
    }
    // Rubble floor.
    g.fillStyle(0x11151d, 1);
    g.fillRect(0, 470, GAME_W, GAME_H - 470);
    const rim = this.add.graphics().setDepth(1);
    rim.lineStyle(2, 0x3a4a5c, 1);
    rim.lineBetween(0, 470, GAME_W, 470);

    // The torso, where L2-1 left it.
    this.add.image(GAME_W / 2 - 90, 452, 'ch2-blob').setDepth(3);

    // The prosthetic, still glowing, still waiting.
    this.add.image(GAME_W / 2 + 40, 440, 'ch2-prosthetic').setDepth(3);
    const glow = this.add
      .image(GAME_W / 2 + 40, 440, 'ch2-mote')
      .setScale(14)
      .setTint(0x9fd8e8)
      .setAlpha(0.25)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(2);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.14, to: 0.34 },
      scale: { from: 11, to: 16 },
      duration: 1300,
      yoyo: true,
      repeat: -1,
    });

    this.add
      .text(GAME_W / 2, 150, 'L2-2 · 拼接', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '30px',
        color: '#c9d6e2',
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.add
      .text(GAME_W / 2, 200, 'the metal is willing. the flesh is still deciding.', {
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

    this.cameras.main.fadeIn(700, 0, 0, 0);
    this.keys = this.input.keyboard.addKeys({ enter: 'ENTER' });
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.enter)) {
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
    }
  }
}
