// CHAPTER 5 — THE MUSEUM OF ONE ANSWER · MINIATURE GALLERY
// Standalone entry. Isolated from the main game boot: own config, own scene,
// own text hook. Shares nothing with src/main.js and never imports it.

import Phaser from 'phaser';
import { MuseumScene } from './MuseumScene.js';
import { VIEW } from './levelData.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW.w,
  height: VIEW.h,
  backgroundColor: '#e9e2d0',
  scene: [MuseumScene],
};

const game = new Phaser.Game(config);
window.game = game;

window.render_game_to_text = () => {
  const scene = game.scene.getScene('MuseumGallery');
  if (!scene || !scene.renderToText) {
    return JSON.stringify({ chapter: 'chapter05-museum', booting: true });
  }
  return JSON.stringify(scene.renderToText());
};
