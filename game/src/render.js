// render.js — scene renderer: draws the whole satay stall scene (backdrop, customers, grill, prep counter and floating score texts) from the game state.

import { PROTEINS, GLAZES, judgeSkewer } from './skewers.js';
import { GRILL_SLOTS, slotHeat } from './grill.js';
import { DAY_LENGTH } from './customers.js';
import { drawArtworkCover, drawArtworkFeathered } from './artwork.js';

/** Screen layout: every interactive rect of the scene, shared with input handling. */
export const LAYOUT = {
  customers: Array.from({ length: 5 }, (_, i) => ({ x: 30 + i * 250, y: 26, w: 220, h: 196 })),
  grillSlots: Array.from({ length: GRILL_SLOTS }, (_, i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    return { x: 300 + col * 118, y: row === 0 ? 268 : 356, w: 104, h: 76 };
  }),
  trays: Array.from({ length: 4 }, (_, i) => ({ x: 36 + i * 128, y: 540, w: 116, h: 96 })),
  glazes: Array.from({ length: 3 }, (_, i) => ({ x: 580 + i * 104, y: 540, w: 92, h: 96 })),
  plate: { x: 916, y: 516, w: 200, h: 128 },
  bin: { x: 1140, y: 540, w: 104, h: 96 },
  hand: { x: 36, y: 428, w: 220, h: 84 },
};

const GRILL_HERO = { x: 262, y: 238, w: 560, h: 268 };
const GOLDEN = '#d98a2b';
const BURNT = '#17120e';

function proteinById(id) {
  return PROTEINS.find((entry) => entry.id === id) || PROTEINS[0];
}

function glazeById(id) {
  return GLAZES.find((entry) => entry.id === id) || null;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const mix = ca.map((v, i) => Math.round(v + (cb[i] - v) * clamp01(t)));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}

/** Parse a '#rrggbb' hex string or an 'rgb(r,g,b)' string into [r, g, b] components. */
function parseRgbColor(color) {
  if (!color) return [0, 0, 0];
  if (color[0] === '#') return hexToRgb(color);
  const parts = color.match(/\d+(\.\d+)?/g);
  if (!parts || parts.length < 3) return [0, 0, 0];
  return parts.slice(0, 3).map((v) => Math.round(Number(v)));
}

/** Mix [r, g, b] components toward a target [r, g, b] by t (0..1). */
function mixRgb(rgb, target, t) {
  return rgb.map((v, i) => Math.round(v + (target[i] - v) * clamp01(t)));
}

/** Format [r, g, b] components as a CSS colour, with optional alpha. */
function rgbCss(rgb, alpha = 1) {
  return alpha >= 1
    ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    : `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

/** Colour of a protein chunk at a given doneness: raw colour, to golden brown, to near-black when burnt. */
function chunkColor(rawColor, doneness) {
  if (doneness > 100) return lerpColor(GOLDEN, BURNT, (doneness - 100) / 30);
  return lerpColor(rawColor, GOLDEN, doneness / 100);
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/**
 * Draw one skewer centred at (cx, cy), `length` long, rotated by `angle`.
 * Chunks take their colour from the skewer's doneness; flipped skewers get
 * soft, irregular dark sear stripes across the chunks, and well-done
 * skewers pick up small char blotches on the chunk edges.
 * The optional `options.glazeColor` ('#rrggbb') overlays a translucent
 * glaze sheen so a sauced skewer reads as glazed.
 * Chunk rendering is a pure function of the skewer (plus options): every
 * position, width and alpha below is derived deterministically from the
 * chunk index and doneness — no randomness.
 */
function drawSkewer(ctx, skewer, cx, cy, length, angle = 0, options = {}) {
  const protein = proteinById(skewer.protein);
  const baseRgb = parseRgbColor(chunkColor(protein.color, skewer.doneness));
  const lightRgb = mixRgb(baseRgb, [255, 235, 205], 0.38);
  const darkRgb = mixRgb(baseRgb, [18, 8, 3], 0.38);
  const glazeRgb = options && options.glazeColor ? parseRgbColor(options.glazeColor) : null;
  const doneness = skewer.doneness;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Tapered bamboo stick: warm wood body narrowing to a point at the
  // right end, with a lighter highlight line along its top edge.
  const stickGrad = ctx.createLinearGradient(0, -3, 0, 3);
  stickGrad.addColorStop(0, '#dcb47c');
  stickGrad.addColorStop(0.55, '#c9a06a');
  stickGrad.addColorStop(1, '#96683a');
  ctx.fillStyle = stickGrad;
  ctx.beginPath();
  ctx.moveTo(-length / 2, -2.4);
  ctx.lineTo(length / 2 - 9, -1.3);
  ctx.lineTo(length / 2, 0);
  ctx.lineTo(length / 2 - 9, 1.3);
  ctx.lineTo(-length / 2, 2.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,232,185,0.75)';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-length / 2 + 2, -1.5);
  ctx.lineTo(length / 2 - 11, -0.8);
  ctx.stroke();

  // Four plump protein chunks, each shaded with a linear gradient
  // (lighter top-left, base colour mid, darker bottom edge).
  const chunkW = length / 6.2;
  const chunkH = 24;
  // Deterministic char-blotch anchors per chunk: [x offset (fraction of
  // chunkW), y offset (fraction of chunkH), radius (fraction of chunkW)].
  const charSpots = [
    [[-0.34, -0.32, 0.16], [0.36, 0.3, 0.13]],
    [[0.3, -0.36, 0.15], [-0.38, 0.26, 0.12]],
    [[-0.3, 0.34, 0.14], [0.38, -0.28, 0.16]],
    [[0.34, 0.32, 0.15], [-0.36, -0.3, 0.13]],
  ];
  const charT = clamp01((doneness - 60) / 50);
  for (let i = 0; i < 4; i += 1) {
    const cxChunk = -length / 2 + length * 0.2 + i * (length * 0.19);
    const chunkX = cxChunk - chunkW / 2;
    const chunkY = -chunkH / 2;
    const grad = ctx.createLinearGradient(chunkX, chunkY, cxChunk + chunkW / 2, chunkY + chunkH);
    grad.addColorStop(0, rgbCss(lightRgb));
    grad.addColorStop(0.45, rgbCss(baseRgb));
    grad.addColorStop(1, rgbCss(darkRgb));
    ctx.fillStyle = grad;
    roundRectPath(ctx, chunkX, chunkY, chunkW, chunkH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,30,10,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Everything else on this chunk is clipped to its rounded shape.
    ctx.save();
    roundRectPath(ctx, chunkX, chunkY, chunkW, chunkH, 8);
    ctx.clip();

    // Darker shade arc hugging the bottom edge.
    ctx.fillStyle = 'rgba(35,14,2,0.28)';
    ctx.beginPath();
    ctx.ellipse(cxChunk, chunkY + chunkH + 2, chunkW * 0.62, 7, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Sear stripes on the flipped side: soft and irregular, with width,
    // alpha and slant varying deterministically per stripe and chunk.
    if (skewer.flipped) {
      const stripeWidths = [2.1, 3.4, 2.5];
      const stripeAlphas = [0.5, 0.68, 0.45];
      const stripeSlants = [4, 6.5, 3.5];
      ctx.lineCap = 'round';
      for (let s = -1; s <= 1; s += 1) {
        const k = s + 1;
        const wobble = ((i * 3 + k * 5) % 3) - 1;
        ctx.strokeStyle = `rgba(38,17,5,${stripeAlphas[k]})`;
        ctx.lineWidth = stripeWidths[k];
        ctx.beginPath();
        ctx.moveTo(cxChunk + s * 7 + wobble - stripeSlants[k] / 2, chunkY + chunkH - 1);
        ctx.lineTo(cxChunk + s * 7 - wobble + stripeSlants[k] / 2, chunkY + 1);
        ctx.stroke();
      }
    }

    // Char blotches creeping in on the chunk edges past doneness ~60.
    if (charT > 0) {
      for (let b = 0; b < charSpots[i].length; b += 1) {
        const [fx, fy, fr] = charSpots[i][b];
        ctx.fillStyle = `rgba(16,8,3,${0.3 + 0.45 * charT})`;
        ctx.beginPath();
        ctx.ellipse(
          cxChunk + fx * chunkW,
          fy * chunkH,
          fr * chunkW * (0.7 + 0.5 * charT),
          fr * chunkW * 0.62 * (0.7 + 0.5 * charT),
          fx * 0.8,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    // Glaze sheen: a translucent glaze-coloured wash across the chunk,
    // a soft glossy band, and a drip highlight near the bottom edge.
    if (glazeRgb) {
      ctx.fillStyle = rgbCss(glazeRgb, 0.3);
      ctx.fillRect(chunkX, chunkY, chunkW, chunkH);
      ctx.fillStyle = rgbCss(mixRgb(glazeRgb, [255, 255, 255], 0.45), 0.4);
      ctx.beginPath();
      ctx.ellipse(cxChunk - chunkW * 0.08, chunkY + chunkH * 0.3, chunkW * 0.52, 3.4, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgbCss(mixRgb(glazeRgb, [255, 255, 255], 0.6), 0.55);
      ctx.beginPath();
      ctx.ellipse(cxChunk + (i % 2 === 0 ? -2 : 2.5), chunkY + chunkH - 3.5, 1.8, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft top-left gloss highlight (over glaze too, so it stays shiny).
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(cxChunk - chunkW * 0.22, chunkY + chunkH * 0.26, chunkW * 0.26, 3.6, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
  ctx.restore();
}

/** The code-painted backdrop used when the backdrop painting is missing. */
function drawFallbackBackdrop(ctx, state) {
  const sky = ctx.createLinearGradient(0, 0, 0, 720);
  sky.addColorStop(0, '#0a0f2a');
  sky.addColorStop(0.45, '#1b2347');
  sky.addColorStop(0.75, '#33203a');
  sky.addColorStop(1, '#17100c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1280, 720);

  // Distant rooftops.
  ctx.fillStyle = '#0d1230';
  ctx.fillRect(0, 330, 210, 110);
  ctx.fillRect(1050, 320, 230, 120);
  ctx.fillRect(880, 348, 120, 92);

  // Stall awning silhouette: a striped canopy band across the top.
  ctx.fillStyle = '#5d1f1a';
  ctx.fillRect(0, 0, 1280, 46);
  for (let i = 0; i < 16; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? '#7a2b20' : '#e8d9b0';
    ctx.beginPath();
    ctx.moveTo(i * 80, 46);
    ctx.lineTo(i * 80 + 40, 66);
    ctx.lineTo(i * 80 + 80, 46);
    ctx.closePath();
    ctx.fill();
  }

  // String lights sagging under the awning.
  ctx.strokeStyle = 'rgba(20,16,30,0.9)';
  ctx.lineWidth = 2;
  for (let s = 0; s < 3; s += 1) {
    const y0 = 66 + s * 8;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.quadraticCurveTo(640, y0 + 34, 1280, y0);
    ctx.stroke();
    for (let i = 0; i <= 20; i += 1) {
      const t = i / 20;
      const bx = t * 1280;
      const by = y0 + Math.sin(t * Math.PI) * 17 + 4;
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.arc(bx, by, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Dark counter band along the bottom.
  const counter = ctx.createLinearGradient(0, 508, 0, 720);
  counter.addColorStop(0, '#3a2317');
  counter.addColorStop(0.08, '#241610');
  counter.addColorStop(1, '#120b06');
  ctx.fillStyle = counter;
  ctx.fillRect(0, 508, 1280, 212);
  void state;
}

/** Fallback customer figure used when a portrait painting is missing. */
function drawFallbackCustomer(ctx, face, x, y, w, h) {
  const shirts = ['#b03a2e', '#2471a3', '#1e8449'];
  const shirt = shirts[(face - 1 + shirts.length) % shirts.length];
  ctx.save();
  ctx.fillStyle = '#2a1c34';
  roundRectPath(ctx, x, y, w, h, 18);
  ctx.fill();
  // Shoulders / shirt: a wide half-ellipse rising into the lower third
  // of the (taller) head-and-shoulders rect, so it still reads as a
  // torso under the head rather than a disc at the bottom.
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 1.02, w * 0.44, h * 0.42, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // Head, centred in the upper-middle of the rect.
  ctx.fillStyle = '#e8b07e';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.42, w * 0.2, 0, Math.PI * 2);
  ctx.fill();
  // Hair cap.
  ctx.fillStyle = '#241611';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.36, w * 0.2, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCustomer(ctx, state, art, customer, slot) {
  const fraction = customer.patienceMax > 0 ? clamp01(customer.patience / customer.patienceMax) : 0;
  const impatient = fraction < 0.3;
  const now = Date.now();
  const shakeX = impatient ? Math.sin(now * 0.03) * 2.5 : 0;
  const shakeY = impatient ? Math.cos(now * 0.037) * 1.2 : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Portrait: big head-and-shoulders, low in the slot, feathered so its
  // edges melt into the backdrop instead of reading as a photo card.
  // Its lower part is covered by the counter ledge drawn in drawScene.
  const portrait = { x: slot.x + 42, y: slot.y + 46, w: 136, h: 122 };
  const img = art ? art[`cust${customer.face}`] : null;
  if (img) drawArtworkFeathered(ctx, img, portrait.x, portrait.y, portrait.w, portrait.h, 0.18);
  else drawFallbackCustomer(ctx, customer.face, portrait.x, portrait.y, portrait.w, portrait.h);

  // Speech bubble with the order, at the TOP of the slot above the
  // head. Its bottom (~slot.y + 56) overlaps only the top ~10px of the
  // portrait rect (hair / background), never the face.
  const bubble = { x: slot.x + 10, y: slot.y, w: 200, h: 56 };
  ctx.fillStyle = '#f7ecd2';
  roundRectPath(ctx, bubble.x, bubble.y, bubble.w, bubble.h, 12);
  ctx.fill();
  ctx.strokeStyle = impatient ? '#d93b2b' : '#8a6a42';
  ctx.lineWidth = impatient ? 3 : 1.5;
  ctx.stroke();
  // Bubble tail on the bottom edge, pointing down at the portrait.
  ctx.fillStyle = '#f7ecd2';
  ctx.beginPath();
  ctx.moveTo(slot.x + 100, bubble.y + bubble.h - 2);
  ctx.lineTo(slot.x + 112, bubble.y + bubble.h + 8);
  ctx.lineTo(slot.x + 124, bubble.y + bubble.h - 2);
  ctx.closePath();
  ctx.fill();

  const protein = proteinById(customer.order.protein);
  const glaze = glazeById(customer.order.glaze);
  // Protein chunk icon.
  ctx.fillStyle = protein.color;
  roundRectPath(ctx, bubble.x + 12, bubble.y + 10, 18, 18, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,10,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Order text: count x protein on line 1, glaze on line 2.
  ctx.fillStyle = '#2b1a10';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`${customer.order.count}× ${protein.name}`, bubble.x + 40, bubble.y + 25);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#5a4030';
  ctx.fillText(glaze ? glaze.name : 'No glaze', bubble.x + 40, bubble.y + 46);

  ctx.restore();
  void state;
}

/**
 * One continuous wooden counter ledge spanning the full canvas width,
 * drawn after all customers so the portraits' lower third sits behind
 * it and the customers read as standing behind the stall counter.
 * Ledge top y = 176, height 34 (176..210); the grill starts at y 238.
 */
function drawCounterLedge(ctx) {
  const top = 176;
  const height = 34;

  // Soft shadow cast onto the backdrop just above the ledge top edge.
  const shadow = ctx.createLinearGradient(0, top - 16, 0, top);
  shadow.addColorStop(0, 'rgba(0,0,0,0)');
  shadow.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = shadow;
  ctx.fillRect(0, top - 16, 1280, 16);

  // Warm brown plank body.
  const wood = ctx.createLinearGradient(0, top, 0, top + height);
  wood.addColorStop(0, '#8a5a2e');
  wood.addColorStop(0.3, '#7c4b26');
  wood.addColorStop(1, '#5d371c');
  ctx.fillStyle = wood;
  ctx.fillRect(0, top, 1280, height);

  // Darker front face below the top plank band.
  ctx.fillStyle = 'rgba(43,24,10,0.55)';
  ctx.fillRect(0, top + 14, 1280, height - 14);

  // Lighter highlight line along the top edge.
  ctx.fillStyle = '#e0aa66';
  ctx.fillRect(0, top, 1280, 3);

  // Subtle vertical plank seams.
  ctx.strokeStyle = 'rgba(30,16,5,0.35)';
  ctx.lineWidth = 2;
  for (let x = 160; x < 1280; x += 160) {
    ctx.beginPath();
    ctx.moveTo(x, top + 3);
    ctx.lineTo(x, top + height);
    ctx.stroke();
  }
}

/**
 * Patience bar for one customer, drawn onto the counter ledge front
 * (after the ledge, so it sits on the wood). Not shaken with the
 * portrait/bubble — it stays fixed to the ledge.
 */
function drawCustomerPatienceBar(ctx, customer, slot) {
  const fraction = customer.patienceMax > 0 ? clamp01(customer.patience / customer.patienceMax) : 0;
  const bar = { x: slot.x + 10, y: 188, w: 200, h: 10 };
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRectPath(ctx, bar.x, bar.y, bar.w, bar.h, 5);
  ctx.fill();
  const barColor = fraction > 0.5 ? '#3fbf5a' : fraction > 0.25 ? '#e8a33d' : '#d93b2b';
  if (fraction > 0) {
    ctx.fillStyle = barColor;
    roundRectPath(ctx, bar.x + 1.5, bar.y + 1.5, (bar.w - 3) * fraction, bar.h - 3, 4);
    ctx.fill();
  }
}

/** Code-drawn charcoal grill used when the grill painting is missing. */
function drawFallbackGrill(ctx) {
  const { x, y, w, h } = GRILL_HERO;
  ctx.fillStyle = '#191008';
  roundRectPath(ctx, x, y, w, h, 22);
  ctx.fill();
  ctx.strokeStyle = '#4a2f1a';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Charcoal trough.
  ctx.fillStyle = '#0b0705';
  roundRectPath(ctx, x + 22, y + 30, w - 44, h - 60, 16);
  ctx.fill();
  // Glowing coals, tinted by each slot's heat.
  for (let i = 0; i < GRILL_SLOTS; i += 1) {
    const slot = LAYOUT.grillSlots[i];
    const heat = slotHeat(i);
    const cx = slot.x + slot.w / 2;
    const cy = slot.y + slot.h / 2;
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 52);
    const hot = heat >= 1.3 ? '255,110,30' : heat >= 1 ? '255,140,50' : '230,90,40';
    glow.addColorStop(0, `rgba(${hot},${0.5 + heat * 0.2})`);
    glow.addColorStop(1, 'rgba(120,30,5,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 52, cy - 40, 104, 80);
    for (let c = 0; c < 5; c += 1) {
      const ox = ((i * 37 + c * 23) % 60) - 30;
      const oy = ((i * 19 + c * 13) % 26) - 13;
      ctx.fillStyle = c % 2 === 0 ? '#2e2018' : '#59301c';
      ctx.beginPath();
      ctx.ellipse(cx + ox, cy + oy, 9, 6, c, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,${120 + Math.round(heat * 40)},40,0.55)`;
      ctx.beginPath();
      ctx.ellipse(cx + ox, cy + oy - 1, 4, 2.4, c, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Grate lines.
  ctx.strokeStyle = 'rgba(160,160,170,0.5)';
  ctx.lineWidth = 3;
  for (let r = 0; r < 5; r += 1) {
    const gy = y + 52 + r * 42;
    ctx.beginPath();
    ctx.moveTo(x + 28, gy);
    ctx.lineTo(x + w - 28, gy);
    ctx.stroke();
  }
}

/**
 * The pit the grill painting sits IN: a warm ember glow spilling beyond
 * the hero rect onto the backdrop, under a dark charcoal bed slightly
 * larger than the painting, so the feathered painting melts into a
 * physical grill pit instead of reading as a pasted rectangle.
 * Drawn only when the grill painting is present.
 */
function drawGrillPitBed(ctx) {
  const cx = GRILL_HERO.x + GRILL_HERO.w / 2;
  const cy = GRILL_HERO.y + GRILL_HERO.h / 2;

  // Ember-orange glow spilling well beyond the hero rect.
  const spill = ctx.createRadialGradient(cx, cy, 30, cx, cy, 360);
  spill.addColorStop(0, 'rgba(255,122,34,0.34)');
  spill.addColorStop(0.55, 'rgba(255,102,28,0.16)');
  spill.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = spill;
  ctx.fillRect(cx - 360, cy - 360, 720, 720);

  // Charcoal-black bed: an ellipse slightly larger than the hero rect,
  // but centred noticeably below the hero centre and squashed
  // vertically, so the darkness pools under and around the grill like
  // a real charcoal pit shadow instead of forming a uniform dark box
  // behind the whole painting. The centre is softer than before and
  // the radial falloff ends earlier, so the top of the bed fades out
  // sooner and the painting's own smoke and top edge meet the
  // backdrop's night sky rather than a black wall.
  const bedW = GRILL_HERO.w + 96;
  const bedH = GRILL_HERO.h + 76;
  const bedCy = cy + 45;
  ctx.save();
  ctx.translate(cx, bedCy);
  ctx.scale(1, (bedH / bedW) * 0.78);
  const bed = ctx.createRadialGradient(0, 0, bedW * 0.18, 0, 0, bedW / 2);
  bed.addColorStop(0, 'rgba(7,4,2,0.82)');
  bed.addColorStop(0.5, 'rgba(9,5,3,0.66)');
  bed.addColorStop(0.72, 'rgba(11,6,3,0.26)');
  bed.addColorStop(1, 'rgba(12,7,3,0)');
  ctx.fillStyle = bed;
  ctx.beginPath();
  ctx.arc(0, 0, bedW / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Scene-level smoke blending above the grill: a few very soft, large
 * white-blue puffs straddling the painting's top edge at fixed,
 * deterministic positions across its width, so smoke from the
 * painting visually continues into the backdrop. Alphas stay very
 * low so the puffs never wash out the customers or bubbles above.
 * Drawn only when the grill painting is present.
 */
function drawGrillSmokeBlend(ctx) {
  const top = GRILL_HERO.y;
  const cx = GRILL_HERO.x + GRILL_HERO.w / 2;
  // [x offset from hero centre, y offset from hero top, radius, alpha]
  const puffs = [
    [-190, -14, 68, 0.07],
    [-64, -30, 108, 0.09],
    [72, -22, 88, 0.06],
    [196, -10, 62, 0.08],
  ];
  ctx.save();
  for (const [dx, dy, radius, alpha] of puffs) {
    const px = cx + dx;
    const py = top + dy;
    const puff = ctx.createRadialGradient(px, py, radius * 0.12, px, py, radius);
    puff.addColorStop(0, `rgba(205,220,235,${alpha})`);
    puff.addColorStop(0.55, `rgba(198,214,232,${alpha * 0.45})`);
    puff.addColorStop(1, 'rgba(195,212,230,0)');
    ctx.fillStyle = puff;
    ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
  }
  ctx.restore();
}

/**
 * Dark metal grate bars running horizontally across the grill, in two
 * row bands aligned with the grill slot rows. Drawn over the grill
 * painting and under the skewers, so skewers read as lying on the bars.
 * Drawn only when the grill painting is present.
 */
function drawGrillGrate(ctx) {
  const x0 = 288;
  const x1 = 788;
  const rowTops = [LAYOUT.grillSlots[0].y, LAYOUT.grillSlots[4].y];
  const barOffsets = [12, 29, 46, 63];
  ctx.lineCap = 'round';
  for (const rowTop of rowTops) {
    for (const offset of barOffsets) {
      const gy = rowTop + offset;
      // Bar body: near-black metal.
      ctx.strokeStyle = 'rgba(16,13,11,0.92)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x0, gy);
      ctx.lineTo(x1, gy);
      ctx.stroke();
      // Thin lighter highlight along the bar's top edge.
      ctx.strokeStyle = 'rgba(205,205,215,0.38)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x0, gy - 2.4);
      ctx.lineTo(x1, gy - 2.4);
      ctx.stroke();
    }
  }
}

function drawGrillSkewer(ctx, skewer, slot, index) {
  const cx = slot.x + slot.w / 2;
  const cy = slot.y + slot.h / 2 - 6;
  const now = Date.now();

  const isPerfectReady = skewer.flipped && skewer.doneness >= 75 && skewer.doneness <= 100;
  if (isPerfectReady) {
    const pulse = 0.55 + 0.25 * Math.sin(now * 0.006 + index);
    const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 62);
    glow.addColorStop(0, `rgba(255,205,90,${0.5 * pulse + 0.25})`);
    glow.addColorStop(1, 'rgba(255,180,60,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 62, cy - 46, 124, 92);
  }

  drawSkewer(ctx, skewer, cx, cy, 92, 0);

  // Smoke wisps rising from a cooking skewer.
  if (skewer.doneness > 15) {
    ctx.save();
    for (let s = 0; s < 3; s += 1) {
      const phase = ((now * 0.0006 + index * 0.23 + s / 3) % 1);
      const sx = cx - 22 + s * 22 + Math.sin(now * 0.002 + s * 2 + index) * 4;
      const sy = cy - 18 - phase * 44;
      ctx.fillStyle = `rgba(220,220,225,${0.28 * (1 - phase)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 4 + phase * 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Doneness meter under the slot.
  const meter = { x: slot.x + 6, y: slot.y + slot.h - 11, w: slot.w - 12, h: 7 };
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRectPath(ctx, meter.x, meter.y, meter.w, meter.h, 3.5);
  ctx.fill();
  const fillFraction = clamp01(skewer.doneness / 100);
  const meterColor = skewer.doneness > 115
    ? '#d93b2b'
    : skewer.doneness >= 55
      ? '#e8a33d'
      : '#e8dcc0';
  if (fillFraction > 0) {
    ctx.fillStyle = meterColor;
    roundRectPath(ctx, meter.x + 1, meter.y + 1, (meter.w - 2) * fillFraction, meter.h - 2, 3);
    ctx.fill();
  }

  // Pulsing FLIP! tag inside the golden window.
  if (!skewer.flipped && skewer.doneness >= 35 && skewer.doneness <= 70) {
    const pulse = 1 + 0.12 * Math.sin(now * 0.012 + index);
    ctx.save();
    ctx.translate(cx, slot.y - 4);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffd94d';
    roundRectPath(ctx, -30, -13, 60, 24, 8);
    ctx.fill();
    ctx.strokeStyle = '#8a5a10';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#3a2405';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FLIP!', 0, 5);
    ctx.restore();
  }
}

function drawNameTag(ctx, cx, y, text) {
  ctx.font = 'bold 13px sans-serif';
  const w = ctx.measureText(text).width + 18;
  ctx.fillStyle = '#f7ecd2';
  roundRectPath(ctx, cx - w / 2, y, w, 22, 6);
  ctx.fill();
  ctx.strokeStyle = '#8a6a42';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#2b1a10';
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, y + 16);
}

/** Deterministic pseudo-random in 0..1 from an integer index (integer hash, no Math.random). */
function detRand(index) {
  let s = (Math.imul(index + 1, 2654435761) >>> 0);
  s ^= s >>> 15;
  s = Math.imul(s, 2246822519) >>> 0;
  s ^= s >>> 13;
  return (s >>> 0) / 4294967296;
}

/** Soft contact shadow: a flat dark ellipse with radial-gradient falloff, drawn under an item. */
function drawContactShadow(ctx, cx, cy, rx, ry) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const grad = ctx.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
  grad.addColorStop(0, 'rgba(5,2,0,0.5)');
  grad.addColorStop(0.65, 'rgba(5,2,0,0.28)');
  grad.addColorStop(1, 'rgba(5,2,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Rich painted-wood prep-counter surface (y 508..720), identical on every frame. */
function drawWoodCounterSurface(ctx) {
  // (a) Warm dark-brown base: lighter at the top where stall light hits.
  const base = ctx.createLinearGradient(0, 508, 0, 720);
  base.addColorStop(0, 'rgba(96,58,32,0.97)');
  base.addColorStop(0.18, 'rgba(82,48,27,0.97)');
  base.addColorStop(0.55, 'rgba(62,36,20,0.98)');
  base.addColorStop(1, 'rgba(34,20,11,0.98)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 508, 1280, 212);

  // (e) Warm light pool under the grill/plate side (right of centre).
  const pool = ctx.createRadialGradient(1016, 618, 20, 1016, 618, 340);
  pool.addColorStop(0, 'rgba(255,166,64,0.20)');
  pool.addColorStop(0.55, 'rgba(255,140,50,0.09)');
  pool.addColorStop(1, 'rgba(255,130,40,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(640, 508, 640, 212);

  // (c) Wood-grain streaks: thin, slightly wavy horizontal strokes whose
  // y, length, shade and alpha all come from detRand(streak index).
  ctx.lineCap = 'round';
  for (let i = 0; i < 110; i += 1) {
    const y = 516 + detRand(i * 4) * 196;
    const x0 = detRand(i * 4 + 1) * 1180;
    const len = 60 + detRand(i * 4 + 2) * 260;
    const light = detRand(i * 4 + 3) > 0.5;
    const alpha = 0.05 + detRand(i * 7 + 2) * 0.1;
    ctx.strokeStyle = light ? `rgba(214,150,84,${alpha})` : `rgba(16,8,3,${alpha + 0.03})`;
    ctx.lineWidth = 0.8 + detRand(i * 5 + 1) * 1.4;
    const wob = (detRand(i * 6 + 3) - 0.5) * 3;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo(x0 + len / 2, y + wob, x0 + len, y);
    ctx.stroke();
  }

  // (d) Subtle knots: concentric dark ellipses at fixed spots clear of items.
  const knots = [[548, 686], [896, 700], [70, 700]];
  for (const [kx, ky] of knots) {
    for (let r = 3; r >= 1; r -= 1) {
      ctx.strokeStyle = `rgba(20,10,4,${0.1 + (3 - r) * 0.07})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(kx, ky, r * 5.5, r * 2.8, 0.15, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(18,9,3,0.35)';
    ctx.beginPath();
    ctx.ellipse(kx, ky, 2.6, 1.4, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // (b) Horizontal plank seams every ~50px: dark line + 1px lighter line beneath.
  for (let y = 558; y < 720; y += 50) {
    ctx.fillStyle = 'rgba(12,6,2,0.55)';
    ctx.fillRect(0, y, 1280, 2);
    ctx.fillStyle = 'rgba(226,164,96,0.20)';
    ctx.fillRect(0, y + 2, 1280, 1);
  }

  // (f) Counter front edge: lighter wood strip with a bright 1px top highlight.
  const edge = ctx.createLinearGradient(0, 508, 0, 512);
  edge.addColorStop(0, '#a06c38');
  edge.addColorStop(1, '#7c4f27');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 508, 1280, 4);
  ctx.fillStyle = 'rgba(255,214,150,0.85)';
  ctx.fillRect(0, 508, 1280, 1);
}

function drawPrepCounter(ctx, state, art) {
  // Counter surface: painted wood with grain, plank seams and a light pool.
  drawWoodCounterSurface(ctx);

  // Protein trays.
  PROTEINS.forEach((protein, i) => {
    const tray = LAYOUT.trays[i];
    const cx = tray.x + tray.w / 2;
    // Grounding contact shadow first, so the tray sits on the wood.
    drawContactShadow(ctx, cx, tray.y + 76, tray.w / 2 + 8, 13);
    // Woven tray.
    ctx.fillStyle = '#a87c48';
    ctx.beginPath();
    ctx.ellipse(cx, tray.y + 44, tray.w / 2 - 4, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5527';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Inner shadow arc along the inside bottom of the tray.
    ctx.strokeStyle = 'rgba(52,30,8,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, tray.y + 44, tray.w / 2 - 9, 25, 0, 0.35, Math.PI - 0.35);
    ctx.stroke();
    // Rim light arc on the top-left rim.
    ctx.strokeStyle = 'rgba(255,222,160,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, tray.y + 44, tray.w / 2 - 5, 29, 0, Math.PI * 1.05, Math.PI * 1.65);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90,58,24,0.6)';
    ctx.lineWidth = 1;
    for (let l = -2; l <= 2; l += 1) {
      ctx.beginPath();
      ctx.ellipse(cx, tray.y + 44 + l * 9, tray.w / 2 - 8, 20 - Math.abs(l) * 3, 0, 0.15, Math.PI - 0.15);
      ctx.stroke();
    }
    // Chunks of the protein.
    for (let c = 0; c < 6; c += 1) {
      const ox = ((c * 41 + i * 17) % 72) - 36;
      const oy = ((c * 23 + i * 11) % 22) - 11;
      ctx.fillStyle = protein.color;
      roundRectPath(ctx, cx + ox - 11, tray.y + 40 + oy - 9, 22, 18, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,30,10,0.4)';
      ctx.stroke();
    }
    drawNameTag(ctx, cx, tray.y + 70, `${protein.name} · ${protein.price}`);
  });

  // Hand prep board.
  const hand = LAYOUT.hand;
  drawContactShadow(ctx, hand.x + hand.w / 2, hand.y + hand.h + 4, hand.w / 2 + 10, 12);
  ctx.fillStyle = '#8a5f33';
  roundRectPath(ctx, hand.x, hand.y, hand.w, hand.h, 10);
  ctx.fill();
  ctx.strokeStyle = '#5d3c1c';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(70,44,18,0.5)';
  ctx.lineWidth = 1;
  for (let l = 1; l < 4; l += 1) {
    ctx.beginPath();
    ctx.moveTo(hand.x + 8, hand.y + l * 21);
    ctx.lineTo(hand.x + hand.w - 8, hand.y + l * 21);
    ctx.stroke();
  }
  if (state.hand.length === 0) {
    ctx.fillStyle = '#f2dfae';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('tap a tray', hand.x + hand.w / 2, hand.y + hand.h / 2 + 5);
  } else {
    state.hand.forEach((skewer, i) => {
      const y = hand.y + 16 + i * 18;
      drawSkewer(ctx, skewer, hand.x + hand.w / 2, y, 170, 0);
    });
  }

  // Glaze bowls.
  GLAZES.forEach((glaze, i) => {
    const rect = LAYOUT.glazes[i];
    const cx = rect.x + rect.w / 2;
    // Grounding contact shadow first, so the bowl sits on the wood.
    drawContactShadow(ctx, cx, rect.y + 68, 46, 10);
    // Bowl.
    ctx.fillStyle = '#31435c';
    ctx.beginPath();
    ctx.ellipse(cx, rect.y + 40, 38, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c2838';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Outer rim ring: lighter stroke around the bowl ellipse.
    ctx.strokeStyle = 'rgba(196,220,245,0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(cx, rect.y + 40, 39.5, 27.5, 0, Math.PI * 0.95, Math.PI * 1.95);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(230,240,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, rect.y + 40, 39.5, 27.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Sauce surface.
    ctx.fillStyle = glaze.color;
    ctx.beginPath();
    ctx.ellipse(cx, rect.y + 34, 31, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(cx - 9, rect.y + 30, 10, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    drawNameTag(ctx, cx, rect.y + 70, glaze.name);
  });

  drawPlate(ctx, state, art);
  drawBin(ctx);
}

function drawPlate(ctx, state, art) {
  const plate = LAYOUT.plate;
  const cx = plate.x + plate.w / 2;
  const cy = plate.y + plate.h / 2 - 6;

  const showPainting = state.plate.skewers.length === 0 && state.lastServe && !state.night.over ? art.platter : null;
  if (showPainting) {
    // Served platter painting: inset from the plate zone, clipped to a
    // rounded rect with a soft dark shadow underneath, so it sits on the
    // counter instead of floating as a hard-edged rectangle. Never drawn
    // once the night is over — the results board owns that scene.
    const inset = 6;
    const px = plate.x + inset;
    const py = plate.y + inset;
    const pw = plate.w - inset * 2;
    const ph = plate.h - inset * 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRectPath(ctx, px, py, pw, ph, 24);
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRectPath(ctx, px, py, pw, ph, 24);
    ctx.clip();
    drawArtworkCover(ctx, showPainting, px, py, pw, ph);
    ctx.restore();
  } else {
    // Woven platter: grounding contact shadow first, so it sits on the wood.
    drawContactShadow(ctx, cx, cy + 48, 100, 14);
    ctx.fillStyle = '#b78d52';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 92, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5527';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#cfa763';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 74, 35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Skewers fanned on the platter.
  const skewers = state.plate.skewers;
  const plateGlaze = state.plate.glaze ? glazeById(state.plate.glaze) : null;
  skewers.forEach((skewer, i) => {
    const spread = skewers.length > 1 ? (i / (skewers.length - 1) - 0.5) : 0;
    drawSkewer(
      ctx,
      skewer,
      cx,
      cy + spread * 14,
      138,
      spread * 0.55,
      plateGlaze ? { glazeColor: plateGlaze.color } : undefined,
    );
  });

  // Glossy sheen when the plate is glazed.
  if (skewers.length > 0 && state.plate.glaze) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,240,200,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx - 12, cy - 8, 58, 20, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Glaze label.
  const glaze = state.plate.glaze ? glazeById(state.plate.glaze) : null;
  const countText = skewers.length > 0 ? ` x${skewers.length}` : '';
  drawNameTag(ctx, cx, plate.y + plate.h - 20, `${glaze ? glaze.name : 'no glaze'}${countText}`);
}

function drawBin(ctx) {
  const bin = LAYOUT.bin;
  const cx = bin.x + bin.w / 2;
  // Grounding contact shadow first, so the bin sits on the wood.
  drawContactShadow(ctx, cx, bin.y + bin.h - 2, bin.w / 2 + 8, 11);
  // Dark bucket with vertical side shading: lighter at the left edge,
  // darker at the right.
  const binGrad = ctx.createLinearGradient(bin.x, 0, bin.x + bin.w, 0);
  binGrad.addColorStop(0, '#3d4149');
  binGrad.addColorStop(0.35, '#26292f');
  binGrad.addColorStop(1, '#14161a');
  ctx.fillStyle = binGrad;
  ctx.beginPath();
  ctx.moveTo(bin.x + 10, bin.y + 14);
  ctx.lineTo(bin.x + bin.w - 10, bin.y + 14);
  ctx.lineTo(bin.x + bin.w - 20, bin.y + bin.h - 6);
  ctx.lineTo(bin.x + 20, bin.y + bin.h - 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0e0f12';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#3a3e46';
  roundRectPath(ctx, bin.x + 4, bin.y + 4, bin.w - 8, 14, 6);
  ctx.fill();
  ctx.fillStyle = '#e8dcc0';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BIN', cx, bin.y + 58);
}

/** Draw the whole scene for the current game state. `art` is the map returned by loadArtwork(). */
export function drawScene(ctx, state, art) {
  const safeArt = art || {};
  const progress = clamp01(state.night.t / DAY_LENGTH);

  // 1. Backdrop, night darkening and grill glow.
  if (safeArt.backdrop) drawArtworkCover(ctx, safeArt.backdrop, 0, 0, 1280, 720);
  else drawFallbackBackdrop(ctx, state);
  ctx.fillStyle = `rgba(3,5,20,${0.04 + 0.34 * progress})`;
  ctx.fillRect(0, 0, 1280, 720);
  const glow = ctx.createRadialGradient(542, 372, 30, 542, 372, 360);
  glow.addColorStop(0, 'rgba(255,150,50,0.26)');
  glow.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(180, 60, 760, 560);

  // 2. Customers, then the continuous counter ledge over their lower
  // third, then their patience bars on the ledge front.
  const visibleCustomers = state.night.customers.slice(0, LAYOUT.customers.length);
  visibleCustomers.forEach((customer, i) => {
    drawCustomer(ctx, state, safeArt, customer, LAYOUT.customers[i]);
  });
  drawCounterLedge(ctx);
  visibleCustomers.forEach((customer, i) => {
    drawCustomerPatienceBar(ctx, customer, LAYOUT.customers[i]);
  });

  // 3. Grill painting / fallback, then its skewers and embers.
  // The painting sits in a charcoal pit bed with an ember glow spilling
  // onto the backdrop, is drawn with a wide feather so its edges melt
  // into the bed, and gets a metal grate over it before the skewers.
  if (safeArt.grill) {
    drawGrillPitBed(ctx);
    drawArtworkFeathered(ctx, safeArt.grill, GRILL_HERO.x, GRILL_HERO.y, GRILL_HERO.w, GRILL_HERO.h, 0.32);
    drawGrillGrate(ctx);
    drawGrillSmokeBlend(ctx);
  } else drawFallbackGrill(ctx);
  state.grill.slots.forEach((skewer, i) => {
    if (skewer) drawGrillSkewer(ctx, skewer, LAYOUT.grillSlots[i], i);
  });
  // Ember sparks rising from the coals (ember x/y are 0..100 grill-local coords).
  for (const ember of state.grill.embers) {
    const ex = GRILL_HERO.x + (ember.x / 100) * GRILL_HERO.w;
    const ey = GRILL_HERO.y + (ember.y / 100) * GRILL_HERO.h;
    const alpha = clamp01(ember.life);
    ctx.fillStyle = `rgba(255,${150 + Math.round(60 * alpha)},50,${0.85 * alpha})`;
    ctx.beginPath();
    ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Prep counter: trays, hand board, glaze bowls, plate and bin.
  drawPrepCounter(ctx, state, safeArt);

  // 5. Floating score texts.
  ctx.textAlign = 'center';
  for (const fx of state.fx) {
    const alpha = clamp01(fx.life);
    const rise = (1 - alpha) * 36;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 22px sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(30,15,5,0.85)';
    ctx.strokeText(fx.text, fx.x, fx.y - rise);
    ctx.fillStyle = '#ffd94d';
    ctx.fillText(fx.text, fx.x, fx.y - rise);
    ctx.restore();
  }
}
