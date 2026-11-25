// hud.js — stall-object HUD: the string of night-progress light bulbs, the chalk price board, toast slips and the night-over results board.

import { DAY_LENGTH } from './customers.js';

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
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

function formatMoney(value) {
  return String(Math.round(value * 100) / 100);
}

/** Draw a small flame glyph (shapes only, no emoji) centred at (cx, cy), `size` tall. */
function drawFlame(ctx, cx, cy, size) {
  ctx.save();
  ctx.translate(cx, cy);
  // Outer flame.
  ctx.fillStyle = '#e86a1e';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.6);
  ctx.bezierCurveTo(size * 0.45, -size * 0.1, size * 0.38, size * 0.35, 0, size * 0.55);
  ctx.bezierCurveTo(-size * 0.38, size * 0.35, -size * 0.45, -size * 0.1, 0, -size * 0.6);
  ctx.fill();
  // Inner flame.
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.18);
  ctx.bezierCurveTo(size * 0.24, size * 0.08, size * 0.2, size * 0.3, 0, size * 0.44);
  ctx.bezierCurveTo(-size * 0.2, size * 0.3, -size * 0.24, size * 0.08, 0, -size * 0.18);
  ctx.fill();
  ctx.restore();
}

/** String of 24 bulbs across the top: the lit fraction is the night's progress; a crescent moon caps the sky end. */
function drawBulbString(ctx, night) {
  const progress = clamp01(night.t / DAY_LENGTH);
  const count = 24;
  const x0 = 24;
  const x1 = 1216;
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    points.push({ x: x0 + (x1 - x0) * t, y: 10 + Math.sin(t * Math.PI) * 8 });
  }
  // Wire.
  ctx.strokeStyle = 'rgba(10,10,18,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();

  const litCount = progress * count;
  points.forEach((p, i) => {
    const lit = i < litCount;
    // Short drop cord.
    ctx.strokeStyle = 'rgba(10,10,18,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y + 5);
    ctx.stroke();
    if (lit) {
      const glow = ctx.createRadialGradient(p.x, p.y + 10, 1, p.x, p.y + 10, 13);
      glow.addColorStop(0, 'rgba(255,215,130,0.75)');
      glow.addColorStop(1, 'rgba(255,190,80,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(p.x - 13, p.y - 3, 26, 26);
      ctx.fillStyle = '#ffd98a';
    } else {
      ctx.fillStyle = '#3a3f55';
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y + 10, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Crescent moon at the sky (right) end of the string, brightening near midnight.
  const mx = 1246;
  const my = 22;
  const bright = 0.35 + 0.65 * progress;
  ctx.save();
  ctx.globalAlpha = bright;
  const moonGlow = ctx.createRadialGradient(mx, my, 2, mx, my, 24);
  moonGlow.addColorStop(0, 'rgba(240,240,210,0.5)');
  moonGlow.addColorStop(1, 'rgba(240,240,210,0)');
  ctx.fillStyle = moonGlow;
  ctx.fillRect(mx - 24, my - 24, 48, 48);
  ctx.fillStyle = '#f2ecd8';
  ctx.beginPath();
  ctx.arc(mx, my, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#131a36';
  ctx.beginPath();
  ctx.arc(mx + 5, my - 3, 8.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Chalkboard price board standing on the counter between the hand board and the plate. */
function drawPriceBoard(ctx, night) {
  const board = { x: 580, y: 428, w: 300, h: 84 };
  // Wooden frame and legs.
  ctx.fillStyle = '#6b4426';
  roundRectPath(ctx, board.x - 5, board.y - 5, board.w + 10, board.h + 10, 8);
  ctx.fill();
  ctx.fillStyle = '#4a2f1a';
  ctx.fillRect(board.x + 18, board.y + board.h + 3, 10, 8);
  ctx.fillRect(board.x + board.w - 28, board.y + board.h + 3, 10, 8);
  // Chalk surface.
  ctx.fillStyle = '#20291f';
  roundRectPath(ctx, board.x, board.y, board.w, board.h, 5);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f2ecd8';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(
    `Rp ${formatMoney(night.earnings)}k   Served ${night.served}   Lost ${night.lost}`,
    board.x + 16,
    board.y + 32,
  );
  ctx.font = 'bold 19px serif';
  ctx.fillStyle = '#ffd98a';
  const comboText = `Combo ×${night.combo}`;
  ctx.fillText(comboText, board.x + 16, board.y + 64);
  if (night.combo >= 3) {
    const textWidth = ctx.measureText(comboText).width;
    const pulse = 1 + 0.18 * Math.sin(Date.now() * 0.01);
    const size = Math.min(34, (15 + night.combo * 1.6) * pulse);
    drawFlame(ctx, board.x + 30 + textWidth + 12, board.y + 58, size);
  }
}

/** Paper-slip toast pinned at the top centre. */
function drawToast(ctx, toast) {
  ctx.font = 'bold 16px sans-serif';
  const textWidth = ctx.measureText(toast).width;
  const w = textWidth + 36;
  const x = 640 - w / 2;
  const y = 30;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#f7ecd2';
  roundRectPath(ctx, x, y, w, 32, 4);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#8a6a42';
  ctx.lineWidth = 1;
  roundRectPath(ctx, x, y, w, 32, 4);
  ctx.stroke();
  // Pin.
  ctx.fillStyle = '#d93b2b';
  ctx.beginPath();
  ctx.arc(640, y + 5, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b1a10';
  ctx.textAlign = 'center';
  ctx.fillText(toast, 640, y + 24);
}

/** Full-frame results overlay shown when the night is over. */
function drawResults(ctx, night) {
  ctx.fillStyle = 'rgba(4,6,16,0.68)';
  ctx.fillRect(0, 0, 1280, 720);

  const board = { x: 340, y: 168, w: 600, h: 384 };
  // Hanging ropes.
  ctx.strokeStyle = '#8a6a42';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(board.x + 60, 0);
  ctx.lineTo(board.x + 90, board.y);
  ctx.moveTo(board.x + board.w - 60, 0);
  ctx.lineTo(board.x + board.w - 90, board.y);
  ctx.stroke();
  // Board.
  ctx.fillStyle = '#6b4426';
  roundRectPath(ctx, board.x - 8, board.y - 8, board.w + 16, board.h + 16, 12);
  ctx.fill();
  ctx.fillStyle = '#20291f';
  roundRectPath(ctx, board.x, board.y, board.w, board.h, 8);
  ctx.fill();

  const cx = board.x + board.w / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 52px serif';
  ctx.fillText('NIGHT OVER', cx, board.y + 78);

  ctx.fillStyle = '#f2ecd8';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`Earnings  Rp ${formatMoney(night.earnings)}k`, cx, board.y + 138);
  ctx.font = '20px sans-serif';
  ctx.fillText(`Served ${night.served}      Lost ${night.lost}`, cx, board.y + 180);
  ctx.fillText(`Best Combo ×${night.bestCombo}`, cx, board.y + 218);

  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 96px serif';
  ctx.fillText(night.grade || '-', cx, board.y + 330);
  ctx.fillStyle = '#f2ecd8';
  ctx.font = '15px sans-serif';
  ctx.fillText('GRADE', cx, board.y + 356);
}

/** Draw the stall-object HUD over the scene: bulb string, price board, toast and (when over) results. */
export function drawHud(ctx, state) {
  const night = state.night;
  drawBulbString(ctx, night);
  drawPriceBoard(ctx, night);
  if (state.toast) drawToast(ctx, state.toast);
  if (night.over) drawResults(ctx, night);
}
