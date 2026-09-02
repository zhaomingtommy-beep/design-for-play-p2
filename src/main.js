import Phaser from 'phaser';
import { GAME_W, GAME_H, GRAVITY } from './constants.js';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import HudScene from './scenes/HudScene.js';
import RollProtoScene from './scenes/RollProtoScene.js';

// Dev shortcut: ?proto=roll boots straight into the L2-1 torso-rolling feel
// prototype, skipping the panorama-heavy main game entirely.
const proto = new URLSearchParams(window.location.search).get('proto');
const scenes = proto === 'roll' ? [RollProtoScene] : [BootScene, GameScene, HudScene];

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#03050a',
  render: {
    antialias: true,
    roundPixels: true,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: GRAVITY },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: scenes,
};

const game = new Phaser.Game(config);

// Handy in the devtools console:
//   game.scene.getScene('Game').player
//   game.scene.getScene('Game').physics.world.drawDebug = true
window.game = game;

export default game;
