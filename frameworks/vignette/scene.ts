import { makeRoomCast } from '../../components/paint/samples';
import { lampTree, lowTable, bambooSlips, door, wallWithWindow, mat, screen, ticket as paintTicket } from '../../components/paint/props-room';
import { bronzeBand, cloudBand } from '../../components/paint/ornament';
import { PAL } from '../../components/paint/palette';
import { lacquerGround, glow } from '../../components/paint/texture';
import { flame } from '../../components/paint/light';
import { type C2D, rgba } from '../../components/paint/util';
import type { Figure } from '../../components/paint/figure';

export interface ReturnSceneState {
  t: number;
  revisiting: boolean;
  doorOpen: number;
  ticketX?: number;
  ticketY?: number;
  ticketW?: number;
  ticketLift?: number;
  ticketGlow?: number;
  ticketOpacity?: number;
  seal?: number;
  nameEntry?: boolean;
  showSlips?: boolean;
  cornerTicket?: number;
  lampDim?: boolean;
  lampX?: number;
}

export interface ReturnLayout {
  ticket: { x: number; y: number; w: number; h: number };
  mentor: { x: number; y: number };
  door: { x: number; y: number; w: number; h: number };
  seatLamp: { x: number; y: number; r: number };
  nameField: { x: number; y: number; w: number; h: number };
  pen: { x: number; y: number; w: number; h: number };
}

export function drawSeat(ctx: C2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.fillStyle = '#24170f';
  ctx.strokeStyle = rgba(PAL.gold, 0.46);
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.55, y - s * 0.62);
  ctx.lineTo(x - s * 0.48, y - s * 1.48);
  ctx.quadraticCurveTo(x, y - s * 1.68, x + s * 0.48, y - s * 1.48);
  ctx.lineTo(x + s * 0.55, y - s * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3a2418';
  ctx.fillRect(x - s * 0.62, y - s * 0.7, s * 1.24, s * 0.15);
  ctx.fillRect(x - s * 0.5, y - s * 0.58, s * 0.1, s * 0.55);
  ctx.fillRect(x + s * 0.4, y - s * 0.58, s * 0.1, s * 0.55);
  ctx.restore();
}

export function drawSmallLamp(ctx: C2D, x: number, y: number, s: number, t: number, dim = false) {
  const k = dim ? 0.14 : 0.82 + Math.sin(t * 1.4) * 0.08;
  glow(ctx, x, y - s * 0.58, s * 1.2, PAL.millet, k * 0.42);
  ctx.save();
  ctx.fillStyle = PAL.bronze;
  ctx.strokeStyle = rgba(PAL.gold, 0.68);
  ctx.lineWidth = Math.max(0.8, s * 0.025);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.24, y);
  ctx.lineTo(x - s * 0.18, y - s * 0.18);
  ctx.lineTo(x + s * 0.18, y - s * 0.18);
  ctx.lineTo(x + s * 0.24, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(x - s * 0.035, y - s * 0.18, s * 0.07, -s * 0.35);
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.29, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  if (!dim) flame(ctx, x, y - s * 0.5, s * 0.26, t, k, { seed: 19, halo: false });
  return { x, y: y - s * 0.52, r: s * 0.65 };
}

export function drawReturnScene(ctx: C2D, w: number, h: number, mentor: Figure, st: ReturnSceneState): ReturnLayout {
  const t = st.t;
  const narrow = w < h * 0.9;
  lacquerGround(ctx, 0, 0, w, h, { tone: 'black', sheen: 0.48, seed: 18 });
  cloudBand(ctx, 0, h * 0.04, w, h * 0.09, { color: PAL.gold, alpha: 0.15, seed: 8, size: Math.min(h * 0.05, 30), drift: t * 1.5 });
  bronzeBand(ctx, 0, h * 0.15, w, Math.max(8, h * 0.02), { pattern: 'lozenge', base: PAL.lacquer2, line: PAL.gold });

  const floorY = h * 0.7;
  const floor = ctx.createLinearGradient(0, floorY, 0, h);
  floor.addColorStop(0, '#20140e');
  floor.addColorStop(1, '#342117');
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = rgba(PAL.gold, 0.16);
  ctx.fillRect(0, floorY, w, 1);

  wallWithWindow(ctx, w * 0.53, floorY, w * 1.04, h * 0.48, {
    t,
    wx: narrow ? 0.3 : 0.31,
    wy: 0.65,
    ww: Math.min(h * 0.1, w * 0.12),
    night: true,
    glow: 0.74,
    seed: 6,
  });

  const lampH = Math.min(h * 0.6, w * (narrow ? 0.7 : 0.4));
  const mainLampX = narrow ? w * 0.22 : w * 0.2;
  const lampLevels = Array.from({ length: 15 }, (_, i) => (i < 8 ? 0.22 : 0.09));
  lampTree(ctx, mainLampX, floorY + h * 0.02, lampH, { lit: lampLevels, t });

  const ms = Math.min(h * 0.62, w * (narrow ? 0.95 : 0.5));
  const mx = narrow ? w * 0.7 : w * 0.64;
  const my = floorY + h * 0.08;
  screen(ctx, mx + ms * 0.07, my - ms * 0.08, ms * 0.92, ms * 0.65, { lit: 0.72 });
  mat(ctx, mx - ms * 0.04, my + ms * 0.06, ms * 0.7, ms * 0.08, { lit: 0.65 });
  glow(ctx, mx - ms * 0.18, my - ms * 0.3, ms * 0.68, '#d98c3c', 0.16);
  mentor.draw(ctx, mx, my, ms, t);

  const tw = ms * 0.6;
  const tableX = mx - ms * 0.4;
  const tab = lowTable(ctx, tableX, my + ms * 0.05, tw, { lit: 0.74, height: 0.36 });
  const maxTicket = Math.min(w * 0.17, h * 0.19);
  const ticketW = Math.max(25, Math.min(maxTicket, st.ticketW ?? maxTicket * 0.78));
  const tx = st.ticketX ?? tableX + tw * 0.05;
  const ty = st.ticketY ?? tab.top + 2;
  const tk = (() => {
    ctx.save();
    ctx.globalAlpha = st.ticketOpacity ?? 1;
    const painted = paintTicket(ctx, tx, ty, ticketW, { lift: st.ticketLift ?? 0, glow: st.ticketGlow ?? 0.18, seal: st.seal ?? 0, glyph: '旱', flat: 0, t, write: 1 });
    ctx.restore();
    return painted;
  })();

  if (st.showSlips) bambooSlips(ctx, tableX + tw * 0.36, tab.top + 7, Math.min(h * 0.15, tw * 0.3), { open: 0.58, marks: true, n: 9 });

  const seatX = w * 0.17;
  const seatY = h * 0.94;
  const seatS = Math.min(h * 0.17, w * 0.18);
  drawSeat(ctx, seatX, seatY, seatS);
  const lampX = w * (st.lampX ?? 0.48);
  const sideLamp = drawSmallLamp(ctx, lampX, seatY - seatS * 0.08, seatS * 0.82, t, st.lampDim ?? false);

  const doorW = Math.min(h * 0.3, w * 0.26);
  const doorH = Math.min(h * 0.5, w * 0.42);
  const doorX = w * (narrow ? 0.84 : 0.9);
  const doorY = floorY + h * 0.01;
  door(ctx, doorX, doorY, doorW, doorH, { open: st.doorOpen, t, night: true });

  const fieldW = Math.min(w * 0.36, 330);
  const fieldH = Math.max(40, Math.min(h * 0.07, 62));
  const field = { x: w * 0.49 - fieldW / 2, y: h * 0.885 - fieldH / 2, w: fieldW, h: fieldH };
  if (st.nameEntry) {
    ctx.save();
    ctx.fillStyle = PAL.silk;
    ctx.fillRect(field.x, field.y, field.w, field.h);
    ctx.strokeStyle = PAL.cinnabar;
    ctx.lineWidth = 2;
    ctx.strokeRect(field.x + 3, field.y + 3, field.w - 6, field.h - 6);
    ctx.strokeStyle = rgba(PAL.gold, 0.75);
    ctx.lineWidth = 0.7;
    ctx.strokeRect(field.x + 7, field.y + 7, field.w - 14, field.h - 14);
    ctx.restore();
  }
  const pen = { x: field.x + field.w + 8, y: field.y + field.h * 0.28, w: Math.min(h * 0.17, 70), h: field.h * 0.46 };
  if (st.nameEntry) {
    ctx.save();
    ctx.translate(pen.x + pen.w * 0.5, pen.y + pen.h * 0.5);
    ctx.rotate(-0.42);
    ctx.strokeStyle = PAL.cinnabar;
    ctx.lineWidth = Math.max(2, pen.h * 0.14);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-pen.w * 0.38, 0);
    ctx.lineTo(pen.w * 0.22, 0);
    ctx.stroke();
    ctx.fillStyle = PAL.lacquer2;
    ctx.beginPath();
    ctx.moveTo(pen.w * 0.22, -pen.h * 0.13);
    ctx.lineTo(pen.w * 0.5, 0);
    ctx.lineTo(pen.w * 0.22, pen.h * 0.13);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const cornerW = Math.max(18, Math.min(w * 0.055, h * 0.075));
  const corner = { x: w * 0.88, y: h * 0.84, w: cornerW };
  ctx.save();
  ctx.globalAlpha = st.cornerTicket ?? 0;
  paintTicket(ctx, corner.x, corner.y, corner.w, { lift: 0, glow: 0.1, seal: st.seal ?? 0, glyph: '旱', flat: 0, t, write: 1 });
  ctx.restore();

  return {
    ticket: tk,
    mentor: { x: mx, y: my - ms * 0.35 },
    door: { x: doorX - doorW * 0.5, y: doorY - doorH, w: doorW, h: doorH },
    seatLamp: sideLamp,
    nameField: field,
    pen,
  };
}

export function makeMentor() {
  return makeRoomCast().mentor;
}

export function updateMentorLook(mentor: Figure, look: boolean) {
  mentor.setPose(look ? 'sit-look' : 'sit-write', 520);
}
