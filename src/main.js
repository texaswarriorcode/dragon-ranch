import './style.css';
import { Game } from './game.js';

const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');

const game = new Game(canvas, uiRoot);
game.start();

// Expose for headless testing
window.__dragonRanch = game;
