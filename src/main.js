import Phaser from 'phaser';
import { GAME_W, GAME_H, GRAVITY } from './constants.js';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import HudScene from './scenes/HudScene.js';
import RollProtoScene from './scenes/RollProtoScene.js';
import MenuScene from './scenes/MenuScene.js';
import Level21Scene from './chapters/ch2/Level21Scene.js';
import Level22Scene from './chapters/ch2/Level22Scene.js';

// Dev shortcuts:
//   ?proto=roll  boots the L2-1 torso-rolling feel prototype
//   ?ch2=1       boots the Chapter 2 flow: menu → L2-1 → L2-2 → L2-3
const proto = new URLSearchParams(window.location.search).get('proto');
const ch2 = new URLSearchParams(window.location.search).get('ch2');
const scenes =
  proto === 'roll'
    ? [RollProtoScene]
    : ch2
      ? [MenuScene, Level21Scene, Level22Scene]
      : [BootScene, GameScene, HudScene];

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
