// input.js — pointer control: turns canvas clicks (in 1280×720 space) into game actions on the shared state.

import { LAYOUT } from './render.js';
import { PROTEINS, GLAZES, makeSkewer, createPlate, plateAdd, plateGlaze, plateMatches } from './skewers.js';
import { flipSkewer, takeSkewer, placeSkewer } from './grill.js';
import { serveCustomer } from './customers.js';

const HAND_MAX = 4;

/** Show a toast slip: sets the message and its on-screen lifetime in seconds. */
export function setToast(state, text) {
  state.toast = text;
  state.toastT = 2.2;
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function clickTray(state, index) {
  const protein = PROTEINS[index];
  if (!protein) return;
  if (state.hand.length >= HAND_MAX) {
    setToast(state, 'Hands full — grill them first');
    return;
  }
  state.hand.push(makeSkewer(protein.id));
  setToast(state, `Skewered ${protein.name}`);
}

function clickGrillSlot(state, index) {
  const grill = state.grill;
  const skewer = grill.slots[index];

  if (skewer) {
    if (!skewer.flipped) {
      if (flipSkewer(grill, index)) {
        setToast(state, skewer.flipQuality >= 1 ? 'Perfect flip!' : 'Flipped');
      }
      return;
    }
    // Already flipped: take it off the grill and onto the plate.
    const taken = takeSkewer(grill, index);
    if (!taken) return;
    if (!plateAdd(state.plate, taken)) {
      grill.slots[index] = taken;
      setToast(state, 'Plate full');
    }
    return;
  }

  // Empty slot: grill one skewer from the hand, if any.
  if (state.hand.length > 0) {
    const next = state.hand.shift();
    if (placeSkewer(grill, next) === -1) state.hand.unshift(next);
  }
}

function clickGlaze(state, index) {
  const glaze = GLAZES[index];
  if (!glaze) return;
  if (state.plate.skewers.length === 0) {
    setToast(state, 'Plate needs skewers first');
    return;
  }
  if (state.plate.glaze !== null) {
    setToast(state, 'Already glazed');
    return;
  }
  if (plateGlaze(state.plate, glaze.id)) {
    setToast(state, `${glaze.name} glaze on`);
  }
}

function clickCustomer(state, index) {
  const customer = state.night.customers[index];
  if (!customer) return;
  if (!plateMatches(state.plate, customer.order)) {
    setToast(state, "That plate isn't their order");
    return;
  }
  const slot = LAYOUT.customers[index];
  const summary = serveCustomer(state.night, customer, state.plate);
  state.lastServe = summary;
  state.fx.push({
    x: slot.x + slot.w / 2,
    y: slot.y,
    text: `+Rp ${summary.paid}k`,
    life: 1,
  });
  state.plate = createPlate();
  setToast(state, summary.quality === 'perfect' ? 'Perfect plate!' : 'Served');
}

function clickBin(state) {
  if (state.plate.skewers.length > 0 || state.plate.glaze !== null) {
    state.plate = createPlate();
    setToast(state, 'Plate binned');
    return;
  }
  if (state.hand.length > 0) {
    state.hand = [];
    setToast(state, 'Prep cleared');
  }
}

/**
 * Handle one click at canvas coordinates (x, y). Mutates `state`:
 * trays skewer into the hand, grill slots place / flip / take skewers,
 * glaze bowls glaze the plate, customers serve a matching plate, and
 * the bin discards the plate (or clears the hand's prep).
 */
export function handleClick(state, x, y) {
  for (let i = 0; i < LAYOUT.trays.length; i += 1) {
    if (pointInRect(x, y, LAYOUT.trays[i])) {
      clickTray(state, i);
      return;
    }
  }
  for (let i = 0; i < LAYOUT.grillSlots.length; i += 1) {
    if (pointInRect(x, y, LAYOUT.grillSlots[i])) {
      clickGrillSlot(state, i);
      return;
    }
  }
  for (let i = 0; i < LAYOUT.glazes.length; i += 1) {
    if (pointInRect(x, y, LAYOUT.glazes[i])) {
      clickGlaze(state, i);
      return;
    }
  }
  for (let i = 0; i < LAYOUT.customers.length; i += 1) {
    if (pointInRect(x, y, LAYOUT.customers[i])) {
      clickCustomer(state, i);
      return;
    }
  }
  if (pointInRect(x, y, LAYOUT.bin)) {
    clickBin(state);
  }
}
