// grill.js — the charcoal grill: slots, heat, flipping and ember particles.

import { PROTEINS } from './skewers.js';

export const GRILL_SLOTS = 8;

/**
 * Heat multipliers for the 8 slots, laid out as two rows of four:
 *
 *   back row:   [0] 0.75   [1] 1.0    [2] 1.0    [3] 0.75
 *   front row:  [4] 0.75   [5] 1.35   [6] 1.35   [7] 0.75
 *
 * The two middle slots of the front row sit directly over the hottest
 * coals (×1.35), the four corner slots are coolest (×0.75), and the
 * remaining back-middle slots are neutral (×1.0).
 */
const SLOT_HEAT = [0.75, 1.0, 1.0, 0.75, 0.75, 1.35, 1.35, 0.75];

/** Heat multiplier for a slot index (×1.0 for out-of-range indices). */
export function slotHeat(index) {
  if (index < 0 || index >= SLOT_HEAT.length) return 1.0;
  return SLOT_HEAT[index];
}

/**
 * Create an empty grill: 8 free slots plus an empty ember particle
 * pool. Embers are plain {x, y, life} objects (plus a rise speed) for
 * the renderer to draw; they are spawned by updateGrill.
 */
export function createGrill() {
  return { slots: new Array(GRILL_SLOTS).fill(null), embers: [] };
}

/**
 * Place a skewer into the first free slot.
 * Returns the slot index used, or -1 when the grill is full.
 */
export function placeSkewer(grill, skewer) {
  if (!skewer) return -1;
  const index = grill.slots.indexOf(null);
  if (index === -1) return -1;
  grill.slots[index] = skewer;
  return index;
}

/**
 * Flip the skewer in a slot, exactly once. Flipping inside the golden
 * window (doneness 35..70) earns flipQuality 1; flipping earlier or
 * later earns 0.6. Returns whether the flip happened.
 */
export function flipSkewer(grill, index) {
  const skewer = grill.slots[index];
  if (!skewer || skewer.flipped) return false;
  skewer.flipped = true;
  skewer.flipQuality = skewer.doneness >= 35 && skewer.doneness <= 70 ? 1 : 0.6;
  return true;
}

/** Remove and return the skewer in a slot, or null if it is empty. */
export function takeSkewer(grill, index) {
  const skewer = grill.slots[index];
  if (!skewer) return null;
  grill.slots[index] = null;
  return skewer;
}

function cookSecondsFor(skewer) {
  const protein = PROTEINS.find((entry) => entry.id === skewer.protein);
  return protein ? protein.cookSeconds : 9;
}

/**
 * Advance the grill by `dt` seconds.
 *
 * Each occupied skewer gains doneness at
 *   dt * (100 / protein.cookSeconds) * slotHeat(index),
 * capped at 130, and its state is refreshed: 'raw' below 55,
 * 'cooking' from 55 to 115, and 'burnt' above 115.
 *
 * Embers are also maintained: live embers drift upward and fade, dead
 * ones are removed, and new ones are spawned over the coals using the
 * passed `rng` (a function returning [0,1)) for jitter — no other
 * source of randomness is used.
 */
export function updateGrill(grill, dt, rng) {
  for (let index = 0; index < grill.slots.length; index += 1) {
    const skewer = grill.slots[index];
    if (!skewer) continue;
    const gain = dt * (100 / cookSecondsFor(skewer)) * slotHeat(index);
    skewer.doneness = Math.min(130, skewer.doneness + gain);
    if (skewer.doneness > 115) skewer.state = 'burnt';
    else if (skewer.doneness >= 55) skewer.state = 'cooking';
    else skewer.state = 'raw';
  }

  // Update existing embers: rise, drift slightly, and burn out.
  for (const ember of grill.embers) {
    ember.y -= (ember.vy ?? 12) * dt;
    ember.x += (rng() - 0.5) * 4 * dt;
    ember.life -= dt;
  }
  grill.embers = grill.embers.filter((ember) => ember.life > 0);

  // Spawn fresh embers, keeping the pool small enough to draw cheaply.
  const MAX_EMBERS = 28;
  if (grill.embers.length < MAX_EMBERS && rng() < 0.7) {
    grill.embers.push({
      x: 20 + rng() * 60,
      y: 92 + rng() * 6,
      life: 0.8 + rng() * 1.4,
      vy: 10 + rng() * 14,
    });
  }
}
