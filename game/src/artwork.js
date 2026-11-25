// artwork.js — painting loader: loads the game's painted artwork slots and draws them cover-fit, hard or feather-edged, with graceful fallbacks when a painting is missing.

/** Map of artwork slot name to its file path inside the game folder. */
export const ARTWORK = {
  backdrop: 'assets/backdrop.jpg',
  grill: 'assets/grill.jpg',
  platter: 'assets/platter.jpg',
  cust1: 'assets/cust-1.jpg',
  cust2: 'assets/cust-2.jpg',
  cust3: 'assets/cust-3.jpg',
};

/**
 * Start loading every artwork slot as an Image.
 * Returns a promise that ALWAYS resolves (a failed load settles just like a
 * successful one) to an object mapping slot name to the loaded Image, or to
 * null for any slot whose painting could not be loaded.
 */
export function loadArtwork() {
  const entries = Object.entries(ARTWORK).map(([slot, path]) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve([slot, img]);
      img.onerror = () => resolve([slot, null]);
      img.src = path;
    });
  });
  return Promise.all(entries).then((pairs) => Object.fromEntries(pairs));
}

/** Source rect for a cover-fit draw: the centred crop of the image that fills (w, h) without distortion. */
function coverSource(img, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih || w <= 0 || h <= 0) return null;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
}

/** Draw an image cover-fit (crop to fill, no distortion) into the rect (x, y, w, h). No-op when img is null. */
export function drawArtworkCover(ctx, img, x, y, w, h) {
  if (!img) return;
  const src = coverSource(img, w, h);
  if (!src) return;
  ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, x, y, w, h);
}

// Cache of edge-fade alpha masks, one per (w, h, feather) combination, plus
// a single reusable scratch canvas the feathered draw is composited through.
// An edge-fade mask is fully opaque in the interior and fades linearly to
// fully transparent at each of the four edges, so no part of the rect —
// corners included — keeps a crisp rectangular edge.
const maskCache = new Map();
let scratchCanvas = null;

const DEFAULT_FEATHER = 0.14;
const MAX_FEATHER = 0.45;

function featherMask(w, h, feather) {
  const frac = Math.max(0, Math.min(MAX_FEATHER, feather));
  const key = `${w}x${h}@${frac}`;
  let mask = maskCache.get(key);
  if (mask) return mask;
  mask = document.createElement('canvas');
  mask.width = Math.max(1, Math.round(w));
  mask.height = Math.max(1, Math.round(h));
  const mctx = mask.getContext('2d');
  const mw = mask.width;
  const mh = mask.height;
  // Start fully opaque everywhere.
  mctx.globalCompositeOperation = 'source-over';
  mctx.fillStyle = 'rgba(0,0,0,1)';
  mctx.fillRect(0, 0, mw, mh);
  // Punch one linear fade per edge with destination-out: alpha is erased
  // fully at the edge itself and not at all once the feather band ends.
  // The band is a fraction of the smaller dimension, the same on all four
  // edges, so corners are faded along both axes.
  const band = frac * Math.min(mw, mh);
  if (band > 0) {
    mctx.globalCompositeOperation = 'destination-out';
    const edges = [
      // [gradient start, gradient end, fill rect]
      [[0, 0], [0, band], [0, 0, mw, band]], // top
      [[0, mh], [0, mh - band], [0, mh - band, mw, band]], // bottom
      [[0, 0], [band, 0], [0, 0, band, mh]], // left
      [[mw, 0], [mw - band, 0], [mw - band, 0, band, mh]], // right
    ];
    for (const [[gx0, gy0], [gx1, gy1], [fx, fy, fw, fh]] of edges) {
      const gradient = mctx.createLinearGradient(gx0, gy0, gx1, gy1);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      mctx.fillStyle = gradient;
      mctx.fillRect(fx, fy, fw, fh);
    }
    mctx.globalCompositeOperation = 'source-over';
  }
  maskCache.set(key, mask);
  return mask;
}

/**
 * Draw an image cover-fit into the rect (x, y, w, h) with soft feathered
 * edges, so the painting melts into the scene instead of sitting in a hard
 * rectangle. No-op when img is null.
 * The optional trailing `feather` is the width of the edge-fade band as a
 * fraction (0..0.45) of the rect's smaller dimension; it defaults to about
 * 0.14. Pass a larger value for a wider, softer melt.
 */
export function drawArtworkFeathered(ctx, img, x, y, w, h, feather = DEFAULT_FEATHER) {
  if (!img) return;
  const src = coverSource(img, w, h);
  if (!src) return;
  if (!scratchCanvas) scratchCanvas = document.createElement('canvas');
  const sw = Math.max(1, Math.round(w));
  const sh = Math.max(1, Math.round(h));
  if (scratchCanvas.width !== sw || scratchCanvas.height !== sh) {
    scratchCanvas.width = sw;
    scratchCanvas.height = sh;
  }
  const sctx = scratchCanvas.getContext('2d');
  sctx.save();
  sctx.globalCompositeOperation = 'source-over';
  sctx.clearRect(0, 0, sw, sh);
  sctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, 0, 0, sw, sh);
  sctx.globalCompositeOperation = 'destination-in';
  sctx.drawImage(featherMask(sw, sh, feather), 0, 0);
  sctx.restore();
  ctx.drawImage(scratchCanvas, x, y, w, h);
}
