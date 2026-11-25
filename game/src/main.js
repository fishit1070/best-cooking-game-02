// main.js — game bootstrap: builds the shared state, wires pointer input, runs the frame loop and stages fixed scenes for screenshots.

import { createRng, createNight, updateNight } from './customers.js';
import { createGrill, updateGrill } from './grill.js';
import { makeSkewer, createPlate, plateAdd, plateGlaze } from './skewers.js';
import { loadArtwork } from './artwork.js';
import { drawScene } from './render.js';
import { drawHud } from './hud.js';
import { handleClick } from './input.js';

const WIDTH = 1280;
const HEIGHT = 720;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const rng = createRng(20261125);

const state = {
  night: createNight(rng),
  grill: createGrill(),
  plate: createPlate(),
  hand: [],
  fx: [],
  toast: null,
  toastT: 0,
  lastServe: null,
};
window.__EMBERLINE_STATE = state;

// Artwork loads in the background; the renderer falls back to painted
// code-drawn art for any slot that is still null.
let art = {};
let artSettled = false;
const artPromise = loadArtwork().then((loaded) => {
  art = loaded || {};
  artSettled = true;
  return art;
});
void artPromise;

// --- Screenshot staging -------------------------------------------------

function stagedCustomer(face, protein, count, glaze, patience, patienceMax) {
  const fraction = patienceMax > 0 ? patience / patienceMax : 0;
  return {
    order: { protein, count, glaze },
    patience,
    patienceMax,
    face,
    mood: fraction > 0.5 ? 'happy' : fraction > 0.25 ? 'impatient' : 'angry',
  };
}

function stagedGrillSkewer(slotIndex, protein, doneness, flipped, flipQuality) {
  const skewer = makeSkewer(protein);
  skewer.doneness = doneness;
  skewer.flipped = flipped;
  skewer.flipQuality = flipQuality;
  skewer.state = doneness > 115 ? 'burnt' : doneness >= 55 ? 'cooking' : 'raw';
  state.grill.slots[slotIndex] = skewer;
  return skewer;
}

function stagedPlateSkewer(protein, doneness, flipQuality) {
  const skewer = makeSkewer(protein);
  skewer.doneness = doneness;
  skewer.flipped = true;
  skewer.flipQuality = flipQuality;
  skewer.state = doneness > 115 ? 'burnt' : doneness >= 55 ? 'cooking' : 'raw';
  plateAdd(state.plate, skewer);
  return skewer;
}

function stageCover() {
  const night = state.night;
  night.t = 18;
  night.earnings = 46;
  night.served = 5;
  night.combo = 2;
  night.customers = [
    stagedCustomer(1, 'chicken', 3, 'peanut', 58, 60),
    stagedCustomer(2, 'lamb', 4, 'spicy-sweet', 49, 55),
    stagedCustomer(3, 'prawn', 2, 'soy', 40, 50),
  ];
  stagedGrillSkewer(0, 'chicken', 62, false, 0);
  stagedGrillSkewer(1, 'lamb', 84, true, 1);
  stagedGrillSkewer(2, 'prawn', 30, false, 0);
  stagedGrillSkewer(5, 'tofu', 48, true, 0.6);
  stagedPlateSkewer('chicken', 88, 1);
  stagedPlateSkewer('chicken', 88, 1);
  plateGlaze(state.plate, 'peanut');
  state.hand = [makeSkewer('chicken'), makeSkewer('lamb')];
}

function stageGrill() {
  const night = state.night;
  night.t = 95;
  night.earnings = 128;
  night.served = 14;
  night.combo = 4;
  night.customers = [
    stagedCustomer(1, 'chicken', 3, 'peanut', 52, 60),
    stagedCustomer(2, 'lamb', 4, 'spicy-sweet', 48, 55),
    stagedCustomer(3, 'prawn', 2, 'soy', 44, 50),
    stagedCustomer(1, 'tofu', 5, 'peanut', 55, 65),
  ];
  stagedGrillSkewer(0, 'chicken', 38, false, 0);
  stagedGrillSkewer(1, 'lamb', 66, true, 1);
  stagedGrillSkewer(2, 'prawn', 92, true, 1);
  stagedGrillSkewer(3, 'chicken', 118, true, 0.6);
  stagedGrillSkewer(4, 'tofu', 55, false, 0);
  stagedGrillSkewer(5, 'lamb', 80, true, 1);
  state.hand = [makeSkewer('chicken'), makeSkewer('lamb'), makeSkewer('prawn')];
}

function stageRush() {
  const night = state.night;
  night.t = 168;
  night.earnings = 236;
  night.served = 26;
  night.lost = 1;
  night.combo = 7;
  night.bestCombo = 7;
  night.customers = [
    stagedCustomer(1, 'chicken', 4, 'peanut', 54, 60),
    stagedCustomer(2, 'lamb', 3, 'spicy-sweet', 55 * 0.22, 55),
    stagedCustomer(3, 'prawn', 2, 'soy', 45, 50),
    stagedCustomer(1, 'chicken', 5, 'spicy-sweet', 65 * 0.27, 65),
    stagedCustomer(2, 'tofu', 3, 'peanut', 50, 58),
  ];
  stagedGrillSkewer(0, 'chicken', 48, false, 0);
  stagedGrillSkewer(1, 'lamb', 62, false, 0);
  stagedGrillSkewer(2, 'prawn', 88, true, 1);
  stagedGrillSkewer(3, 'chicken', 95, true, 1);
  stagedGrillSkewer(4, 'tofu', 112, true, 0.6);
  stagedGrillSkewer(5, 'lamb', 30, false, 0);
  stagedGrillSkewer(6, 'chicken', 78, true, 1);
  stagedGrillSkewer(7, 'prawn', 55, true, 0.6);
  stagedPlateSkewer('lamb', 90, 1);
  stagedPlateSkewer('lamb', 90, 1);
  stagedPlateSkewer('lamb', 90, 1);
  plateGlaze(state.plate, 'spicy-sweet');
  state.fx = [{ x: 640, y: 200, text: '+Rp 27k', life: 0.8 }];
  state.hand = [makeSkewer('chicken')];
}

function stageResults() {
  const night = state.night;
  night.t = 240;
  night.over = true;
  night.earnings = 312;
  night.served = 34;
  night.lost = 3;
  night.bestCombo = 9;
  night.grade = 'S';
  night.customers = [];
  state.lastServe = { paid: 27, tip: 3, quality: 'perfect' };
}

const STAGERS = {
  cover: stageCover,
  grill: stageGrill,
  rush: stageRush,
  results: stageResults,
};

const sceneName = new URLSearchParams(location.search).get('scene');
const stager = sceneName ? STAGERS[sceneName] : undefined;
const frozen = typeof stager === 'function';
if (frozen) stager();

// --- Input ---------------------------------------------------------------

canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
  const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
  handleClick(state, x, y);
});

// --- Frame loop ------------------------------------------------------------

let lastTime = performance.now();
let shotFrames = 0;

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (!frozen) {
    updateNight(state.night, dt, rng);
    updateGrill(state.grill, dt, rng);

    for (const fx of state.fx) {
      fx.life -= dt / 1.4;
      fx.y -= dt * 30;
    }
    state.fx = state.fx.filter((fx) => fx.life > 0);

    if (state.toastT > 0) {
      state.toastT -= dt;
      if (state.toastT <= 0) {
        state.toastT = 0;
        state.toast = null;
      }
    }
  }

  drawScene(ctx, state, art);
  drawHud(ctx, state);

  if (frozen && artSettled) {
    shotFrames += 1;
    if (shotFrames >= 3) window.__SHOT_READY = true;
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
