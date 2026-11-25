// skewers.js — the food model: proteins, glazes, skewers, judging and plates.

/**
 * Proteins available at the stall.
 * `price` is a plain number (rendered by the HUD as Rp thousands) and
 * `cookSeconds` is the nominal time to reach doneness 100 on a ×1.0 slot.
 * Colours are warm food tones used by the renderer for the raw protein.
 */
export const PROTEINS = [
  { id: 'chicken', name: 'Chicken', price: 4, cookSeconds: 9, color: '#e8a04c' },
  { id: 'lamb', name: 'Lamb', price: 6, cookSeconds: 11, color: '#b5502f' },
  { id: 'prawn', name: 'Prawn', price: 7, cookSeconds: 6, color: '#f07f5f' },
  { id: 'tofu', name: 'Tofu', price: 3, cookSeconds: 7, color: '#f2dfae' },
];

/**
 * Glazes brushed on a whole plate. `add` is the per-skewer price added
 * (a plain number, in the same units as protein prices).
 */
export const GLAZES = [
  { id: 'peanut', name: 'Peanut', add: 2, color: '#c98a3d' },
  { id: 'spicy-sweet', name: 'Spicy Sweet', add: 2, color: '#d93b2b' },
  { id: 'soy', name: 'Soy', add: 1, color: '#6b3a22' },
];

/** Look up a glaze definition by id, or return undefined. */
function glazeById(glazeId) {
  return GLAZES.find((glaze) => glaze.id === glazeId);
}

/**
 * Create a fresh, raw skewer for the given protein id.
 * The skewer's `protein` field stores the protein id, so it can be
 * compared directly against an order's `protein` field.
 */
export function makeSkewer(proteinId) {
  return {
    protein: proteinId,
    doneness: 0,
    flipped: false,
    flipQuality: 0,
    state: 'raw',
  };
}

/**
 * Judge a skewer on the 0..130 doneness scale.
 * - doneness > 115          → 'burnt'
 * - doneness < 55           → 'raw'
 * - flipped, flipQuality >= 1 and doneness in 75..100 → 'perfect'
 * - anything else           → 'good'
 */
export function judgeSkewer(skewer) {
  if (skewer.doneness > 115) return 'burnt';
  if (skewer.doneness < 55) return 'raw';
  if (
    skewer.flipped &&
    skewer.flipQuality >= 1 &&
    skewer.doneness >= 75 &&
    skewer.doneness <= 100
  ) {
    return 'perfect';
  }
  return 'good';
}

/** Create an empty plate: no skewers and no glaze yet. */
export function createPlate() {
  return { skewers: [], glaze: null };
}

/**
 * Add a skewer to a plate. A plate holds at most 6 skewers.
 * Returns true on success, false when the plate is already full.
 */
export function plateAdd(plate, skewer) {
  if (!skewer || plate.skewers.length >= 6) return false;
  plate.skewers.push(skewer);
  return true;
}

/**
 * Apply a glaze to a plate, by glaze id. Only allowed when the plate
 * is non-empty and has not been glazed yet.
 * Returns true on success, false otherwise.
 */
export function plateGlaze(plate, glazeId) {
  if (plate.skewers.length === 0) return false;
  if (plate.glaze !== null) return false;
  if (!glazeById(glazeId)) return false;
  plate.glaze = glazeId;
  return true;
}

/**
 * True when the plate exactly fulfils an order: every skewer shares
 * the order's protein, the skewer count equals the order's count,
 * and the plate's glaze equals the order's glaze.
 */
export function plateMatches(plate, order) {
  if (!plate || !order) return false;
  if (plate.skewers.length !== order.count) return false;
  if (plate.glaze !== order.glaze) return false;
  return plate.skewers.every((skewer) => skewer.protein === order.protein);
}
