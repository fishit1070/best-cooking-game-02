// customers.js — the night, its customers and scoring: orders, patience, payment and grades.

import { PROTEINS, GLAZES, judgeSkewer } from './skewers.js';

/** Length of one night, in seconds (dusk → midnight). */
export const DAY_LENGTH = 240;

/** Maximum number of customers waiting at the stall at once. */
const MAX_WAITING = 5;

/**
 * Letter-grade thresholds on total earnings (plain price units, the
 * same units the HUD renders as Rp thousands):
 *   S — earnings >= 300   A — earnings >= 200
 *   B — earnings >= 120   C — anything below 120
 * A strong night serves roughly 35–45 plates at ~20–28 per plate, so
 * 300 marks an exceptional night and 120 a modest but completed one.
 */
const GRADE_THRESHOLDS = [
  { grade: 'S', min: 300 },
  { grade: 'A', min: 200 },
  { grade: 'B', min: 120 },
];

function gradeFor(earnings) {
  for (const entry of GRADE_THRESHOLDS) {
    if (earnings >= entry.min) return entry.grade;
  }
  return 'C';
}

/**
 * Create a deterministic mulberry32-style generator from a seed.
 * The returned function produces numbers in [0, 1).
 */
export function createRng(seed) {
  let state = (seed >>> 0) || 1;
  return function rng() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Create a fresh night. `rng` is accepted for a uniform call shape. */
export function createNight(rng) {
  void rng;
  return {
    t: 0,
    customers: [],
    nextSpawn: 1.5,
    earnings: 0,
    served: 0,
    lost: 0,
    combo: 0,
    bestCombo: 0,
    over: false,
    grade: null,
  };
}

/**
 * Build a random order. Protein is weighted — chicken most common,
 * then lamb, then prawn, with tofu least common. Glaze is weighted
 * towards peanut. Count is an integer from 2 to 5 skewers.
 */
export function makeOrder(rng) {
  const proteinRoll = rng();
  let protein;
  if (proteinRoll < 0.45) protein = 'chicken';
  else if (proteinRoll < 0.7) protein = 'lamb';
  else if (proteinRoll < 0.9) protein = 'prawn';
  else protein = 'tofu';

  // Sanity: the weighted ids must exist in the food model.
  if (!PROTEINS.some((entry) => entry.id === protein)) protein = PROTEINS[0].id;

  const count = 2 + Math.floor(rng() * 4);

  const glazeRoll = rng();
  let glaze;
  if (glazeRoll < 0.5) glaze = 'peanut';
  else if (glazeRoll < 0.8) glaze = 'spicy-sweet';
  else glaze = 'soy';
  if (!GLAZES.some((entry) => entry.id === glaze)) glaze = GLAZES[0].id;

  return { protein, count, glaze };
}

/**
 * Add a new waiting customer, if fewer than 5 are already waiting.
 * Patience is 45..70 seconds and `face` is an integer 1..3 picking
 * which customer portrait the renderer draws.
 * Returns the new customer, or null when the queue is full.
 */
export function spawnCustomer(night, rng) {
  if (night.customers.length >= MAX_WAITING) return null;
  const patience = 45 + rng() * 25;
  const customer = {
    order: makeOrder(rng),
    patience,
    patienceMax: patience,
    face: 1 + Math.floor(rng() * 3),
    mood: 'happy',
  };
  night.customers.push(customer);
  return customer;
}

/** True during either rush window. */
function inRush(t) {
  return (t >= 60 && t <= 90) || (t >= 150 && t <= 185);
}

/**
 * Spawn interval at time `t`: it shrinks linearly from ~7s at dusk to
 * ~3.5s at midnight, and is ~40% shorter during a rush window.
 */
function spawnInterval(t) {
  const progress = Math.min(1, Math.max(0, t / DAY_LENGTH));
  const base = 7 - 3.5 * progress;
  return inRush(t) ? base * 0.6 : base;
}

/**
 * Advance the night by `dt` seconds: move the clock, spawn customers
 * on the shrinking timer, decay patience (25% faster in a rush), send
 * impatient customers away, and close the night at DAY_LENGTH with a
 * letter grade.
 */
export function updateNight(night, dt, rng) {
  if (night.over) return;
  night.t += dt;

  // Spawning.
  night.nextSpawn -= dt;
  while (night.nextSpawn <= 0) {
    spawnCustomer(night, rng);
    night.nextSpawn += spawnInterval(night.t);
  }

  // Patience.
  const decay = inRush(night.t) ? dt * 1.25 : dt;
  for (let i = night.customers.length - 1; i >= 0; i -= 1) {
    const customer = night.customers[i];
    customer.patience -= decay;
    const fraction = customer.patienceMax > 0 ? customer.patience / customer.patienceMax : 0;
    customer.mood = fraction > 0.5 ? 'happy' : fraction > 0.25 ? 'impatient' : 'angry';
    if (customer.patience <= 0) {
      night.customers.splice(i, 1);
      night.lost += 1;
      night.combo = 0;
    }
  }

  // End of the night.
  if (night.t >= DAY_LENGTH) {
    night.over = true;
    night.grade = gradeFor(night.earnings);
  }
}

const QUALITY_FACTOR = { perfect: 1.0, good: 0.85, raw: 0.4, burnt: 0.15 };

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Serve a plate to a customer. The caller must already have checked
 * plateMatches(plate, customer.order).
 *
 * Payment is the sum over skewers of (protein price + glaze add),
 * each scaled by that skewer's quality factor (perfect 1.0, good
 * 0.85, raw 0.4, burnt 0.15). When every skewer is perfect the sum is
 * multiplied by (1 + 0.1 * min(combo, 10)) using the combo before
 * this serve, and the combo then increments. Serving any burnt
 * skewer resets the combo to 0. A speed tip of 0..3, scaled by the
 * customer's remaining patience fraction, is added on top.
 *
 * Updates earnings / served / bestCombo, removes the customer, and
 * returns {paid, tip, quality}, where `quality` is the plate's
 * overall verdict: 'perfect' if every skewer is perfect, else
 * 'burnt' if any is burnt, else 'raw' if any is raw, else 'good'.
 */
export function serveCustomer(night, customer, plate) {
  const proteinPrice = (id) => {
    const protein = PROTEINS.find((entry) => entry.id === id);
    return protein ? protein.price : 0;
  };
  const glazeEntry = GLAZES.find((entry) => entry.id === plate.glaze);
  const glazeAdd = glazeEntry ? glazeEntry.add : 0;

  const qualities = plate.skewers.map((skewer) => judgeSkewer(skewer));
  const allPerfect = qualities.length > 0 && qualities.every((q) => q === 'perfect');
  const anyBurnt = qualities.some((q) => q === 'burnt');
  const anyRaw = qualities.some((q) => q === 'raw');

  let subtotal = 0;
  plate.skewers.forEach((skewer, i) => {
    subtotal += (proteinPrice(skewer.protein) + glazeAdd) * QUALITY_FACTOR[qualities[i]];
  });

  if (allPerfect) {
    subtotal *= 1 + 0.1 * Math.min(night.combo, 10);
    night.combo += 1;
    if (night.combo > night.bestCombo) night.bestCombo = night.combo;
  } else if (anyBurnt) {
    night.combo = 0;
  }

  const patienceFraction =
    customer.patienceMax > 0
      ? Math.min(1, Math.max(0, customer.patience / customer.patienceMax))
      : 0;
  const tip = roundMoney(3 * patienceFraction);
  const paid = roundMoney(subtotal + tip);

  night.earnings = roundMoney(night.earnings + paid);
  night.served += 1;

  const index = night.customers.indexOf(customer);
  if (index !== -1) night.customers.splice(index, 1);

  const quality = allPerfect ? 'perfect' : anyBurnt ? 'burnt' : anyRaw ? 'raw' : 'good';
  return { paid, tip, quality };
}
