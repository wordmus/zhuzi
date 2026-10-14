// 三幅样张：夜门、暗室、东郊旱景。既是画廊里的示范，也是各幕的起手构图。
// 都是纯函数式的「给 ctx、宽高、时间，画一帧」；状态（姿势过渡）放在传进来的 cast 里。

import { makeFigure, type Figure } from './figure';
import { bronzeBand, cloudBand, drawGlyph } from './ornament';
import { PAL, TONE } from './palette';
import { altar, cracks, gate, hills, house, jar, loessGround, milletStalks, road, sheTree, well } from './props-land';
import { door, earCup, eave, lampTree, lowTable, mat, screen, ticket, wallWithWindow } from './props-room';
import { sky } from './sky';
import { finish, glow, lacquerGround } from './texture';
import { type C2D, clamp, lerp, rgba, rng } from './util';

// ============================================================
// 一、夜门
// ============================================================

export interface DoorSceneState {
  hover?: number;
  open?: number;
  omen?: number;
}

/** 夜：黑漆天、金线云、夯土墙、木门与铺首、小窗里一点灯。返回门的位置（热区） */
export function sceneDoor(ctx: C2D, w: number, h: number, t: number, st: DoorSceneState = {}) {
  sky(ctx, w, h, { part: 'night', t, omen: st.omen ?? 0.25, horizon: 0.56, clouds: 0.9 });
  const gy = h * 0.86;
  loessGround(ctx, 0, gy, w, h - gy, { night: true, seed: 6 });
  const narrow = w < h;
  const wallH = Math.min(h * 0.46, w * (narrow ? 0.9 : 0.62));
  const win = wallWithWindow(ctx, w / 2, gy, w * 1.06, wallH, { t, wx: narrow ? 0.3 : 0.24, wy: 0.66, ww: wallH * 0.16 });
  // 墙顶的一点冷光（夜天映在夯土上）
  const cg = ctx.createLinearGradient(0, gy - wallH, 0, gy - wallH * 0.5);
  cg.addColorStop(0, rgba('#5a6070', 0.16));
  cg.addColorStop(1, rgba('#5a6070', 0));
  ctx.fillStyle = cg;
  ctx.fillRect(0, gy - wallH, w, wallH * 0.5);
  const dh = wallH * 0.8;
  const dw = dh * 0.64;
  const d = door(ctx, w / 2, gy, dw, dh, { hover: st.hover ?? 0, open: st.open ?? 0, t });
  eave(ctx, w / 2, gy - dh - dh * 0.06, dw * 1.5);
  // 窗光落在地上
  glow(ctx, win.window.x, gy + (h - gy) * 0.2, wallH * 0.45, '#c9803a', 0.18);
  // 墙根的枯草
  const r = rng(3);
  ctx.strokeStyle = rgba('#5a4630', 0.8);
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const x = r() * w;
    if (Math.abs(x - w / 2) < dw * 0.7) continue;
    for (let k = 0; k < 4; k++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 1.1 + Math.sin(t * 0.8 + i) * 0.04;
      const L = 4 + r() * 10;
      ctx.beginPath();
      ctx.moveTo(x, gy + 1);
      ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.4, gy + Math.sin(a) * L * 0.6, x + Math.cos(a) * L, gy + Math.sin(a) * L);
      ctx.stroke();
    }
  }
  finish(ctx, w, h, { ground: 'lacquer', vignette: 0.7 });
  return { door: { x: w / 2 - dw / 2, y: gy - dh, w: dw, h: dh }, knockers: d.knockers };
}

// ============================================================
// 二、暗室：灯树、导师、矮案、耳杯、票根
// ============================================================

export interface RoomCast {
  mentor: Figure;
}
export function makeRoomCast(): RoomCast {
  return { mentor: makeFigure('mentor', { pose: 'sit-write', facing: -1, onDark: true }) };
}

export interface RoomSceneState {
  /** 每盏灯 0..1（自上而下 15 盏），或一个数 */
  lit?: number | number[];
  /** 导师纸上那一笔的进度 0..1 */
  write?: number;
  ticketGlow?: number;
  ticketLift?: number;
  /** 票根在案面上的位置 0（导师手边）..1（推到你面前） */
  ticketPush?: number;
}

/** 屋里：远处的连盏灯、矮案后执笔的导师、冒热气的耳杯、案上的票根 */
export function sceneRoom(ctx: C2D, w: number, h: number, t: number, cast: RoomCast, st: RoomSceneState = {}) {
  const narrow = w < h * 0.9;
  lacquerGround(ctx, 0, 0, w, h, { tone: 'black', sheen: 0.4, seed: 12 });
  const floorY = h * 0.7;
  // 墙上的漆绘：一道金云纹带、一道菱纹
  cloudBand(ctx, 0, h * 0.06, w, h * 0.12, { color: PAL.gold, alpha: 0.16, seed: 8, size: Math.min(h * 0.05, 34), drift: t * 2 });
  ctx.save();
  ctx.globalAlpha = 0.5;
  bronzeBand(ctx, 0, h * 0.2, w, Math.max(8, h * 0.022), { pattern: 'lozenge', base: PAL.lacquer2, line: PAL.gold });
  ctx.restore();
  // 地：暖黑漆木
  const fg = ctx.createLinearGradient(0, floorY, 0, h);
  fg.addColorStop(0, '#1d130e');
  fg.addColorStop(1, '#2a1a12');
  ctx.fillStyle = fg;
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = rgba(PAL.gold, 0.14);
  ctx.fillRect(0, floorY, w, 1);

  // 灯树（远处）
  const treeH = Math.min(h * 0.6, w * (narrow ? 0.7 : 0.4));
  const tx = narrow ? w * 0.22 : w * 0.2;
  lampTree(ctx, tx, floorY + h * 0.02, treeH, { lit: st.lit ?? 0.5, t });
  const litAmt = typeof st.lit === 'number' ? st.lit : st.lit ? st.lit.reduce((a, b) => a + b, 0) / st.lit.length : 0.5;

  // 导师、屏风、席、案
  const ms = Math.min(h * 0.62, w * (narrow ? 0.95 : 0.5));
  const mx = narrow ? w * 0.7 : w * 0.64;
  const my = floorY + h * 0.08;
  screen(ctx, mx + ms * 0.08, my - ms * 0.05, ms * 0.95, ms * 0.62, { lit: litAmt });
  mat(ctx, mx - ms * 0.05, my + ms * 0.04, ms * 0.72, ms * 0.08, { lit: litAmt });
  glow(ctx, mx - ms * 0.2, my - ms * 0.3, ms * 0.7, '#d98c3c', 0.15 + litAmt * 0.15);
  cast.mentor.draw(ctx, mx, my, ms, t);
  const tw = ms * 0.6;
  const tableX = mx - ms * 0.4;
  const tab = lowTable(ctx, tableX, my + ms * 0.05, tw, { lit: litAmt, height: 0.36 });
  // 案上：纸（在笔下）、耳杯、票根
  const hand = cast.mentor.anchors.hand;
  const paperX = hand.x > 0 ? clamp(hand.x, tableX - tw * 0.4, tableX + tw * 0.4) : tableX + tw * 0.15;
  ctx.save();
  ctx.translate(paperX, tab.top + 2);
  ctx.scale(1, 0.32);
  ctx.fillStyle = PAL.silk;
  ctx.fillRect(-tw * 0.13, -tw * 0.1, tw * 0.26, tw * 0.2);
  drawGlyph(ctx, '禾', 0, 0, tw * 0.16, { progress: st.write ?? (t * 0.25) % 1.2, color: TONE.ink });
  ctx.restore();
  earCup(ctx, tableX + tw * 0.36, tab.top + 3, tw * 0.12, { t, steam: 1 });
  const push = clamp(st.ticketPush ?? 0.6);
  const tkx = lerp(tableX + tw * 0.05, tableX - tw * 0.3, push);
  const tk = ticket(ctx, tkx, tab.top + 2 - (st.ticketLift ?? 0) * tw * 0.12, tw * 0.1, { flat: 1 - (st.ticketLift ?? 0), lift: st.ticketLift ?? 0, glow: st.ticketGlow ?? 0.25 + Math.sin(t * 1.6) * 0.1, t });
  // 灯照在案上
  glow(ctx, tableX, tab.top, tw * 0.8, PAL.millet, 0.1 + litAmt * 0.12);
  finish(ctx, w, h, { ground: 'lacquer', vignette: 0.75 });
  return { ticket: tk, table: tab, mentor: cast.mentor.anchors };
}

// ============================================================
// 三、东郊·正午·旱：一卷横幅
// ============================================================

export interface FriezeCast {
  he: Figure;
  wife: Figure;
  child: Figure;
  neighbor: Figure;
  neighbor2: Figure;
  tianbo: Figure;
  traveler: Figure;
  mother: Figure;
}
export function makeFriezeCast(): FriezeCast {
  return {
    he: makeFigure('he', { pose: 'kneel-touch', facing: 1 }),
    wife: makeFigure('wife', { pose: 'stand', facing: 1 }),
    child: makeFigure('child', { pose: 'sit', facing: 1 }),
    mother: makeFigure('mother', { pose: 'slump', facing: 1 }),
    neighbor: makeFigure('neighbor', { pose: 'stand', facing: 1 }),
    neighbor2: makeFigure('neighbor', { pose: 'point', facing: -1, robe: '#7a5f45', seed: 5 }),
    tianbo: makeFigure('tianbo', { pose: 'open-gate', facing: -1 }),
    traveler: makeFigure('traveler', { pose: 'walk', facing: 1 }),
  };
}

export interface FriezeState {
  /** 镜头在横幅上的位置 0..1（横幅比画面宽时才用） */
  cam?: number;
  crack?: number;
  wither?: number;
  jar?: number;
  crowd?: number;
  altar?: number;
  gateOpen?: number;
  dip?: number;
  /** 地名在横幅上的位置（0..1）可被读出用来对齐热区 */
}

export const FRIEZE_PLACES = { home: 0.08, field: 0.27, well: 0.45, altar: 0.6, gate: 0.77, road: 0.92 } as const;

/**
 * 东郊横幅：家、田、井、社树、田伯家、路口。h 决定一切尺度；横幅世界宽 = max(w, h*2.7)。
 * 返回世界宽与各地在屏幕上的 x，给镜头与热区。
 */
export function sceneFrieze(ctx: C2D, w: number, h: number, t: number, cast: FriezeCast, st: FriezeState = {}) {
  const W = Math.max(w, h * 2.7);
  const cam = (W - w) * clamp(st.cam ?? 0.5);
  const band = Math.max(8, h * 0.032);
  const hz = h * 0.56;
  const gy = h * 0.83;
  const wither = st.wither ?? 0.7;
  // 天不随镜头走（远），太阳略随
  const info = sky(ctx, w, h, { part: 'noon', t, horizon: hz / h, sun: { x: 0.44 - (cam / W) * 0.15, y: 0.2 }, clouds: 0.75 });
  ctx.save();
  ctx.translate(-cam, 0);
  const X = (u: number) => u * W;
  hills(ctx, 0, hz + 1, W, h * 0.07, { seed: 2, alpha: 0.5 });
  loessGround(ctx, 0, hz, W, h - hz, { seed: 3 });
  // 远处的田垄：几道细线收向地平线
  ctx.strokeStyle = rgba(PAL.umber, 0.16);
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const yy = hz + (gy - hz) * (0.15 + i * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(W, yy);
    ctx.stroke();
  }
  const s = h; // 尺度
  // 路口（最远处先画）
  road(ctx, X(FRIEZE_PLACES.road) - s * 0.05, gy, s * 0.55, gy - hz, { t, wither: wither * 0.6 });
  cast.traveler.draw(ctx, X(FRIEZE_PLACES.road) + s * 0.1, hz + (gy - hz) * 0.32, s * 0.09, t);
  // 社树与社坛
  sheTree(ctx, X(FRIEZE_PLACES.altar), gy - s * 0.02, s * 0.62, { t, wither: wither * 0.5 });
  altar(ctx, X(FRIEZE_PLACES.altar) + s * 0.16, gy, s * 0.22, { grow: st.altar ?? 0, t });
  // 田伯家
  const gx = X(FRIEZE_PLACES.gate);
  const g = gate(ctx, gx, gy, s * 0.5, { t, open: st.gateOpen ?? 0, crowd: st.crowd ?? 0 });
  if ((st.gateOpen ?? 0) > 0.3) cast.tianbo.draw(ctx, gx, gy - 1, s * 0.25, t);
  // 井
  well(ctx, X(FRIEZE_PLACES.well), gy, s * 0.4, { dip: st.dip ?? 0.5 + 0.5 * Math.sin(t * 0.5), t });
  cast.neighbor.draw(ctx, X(FRIEZE_PLACES.well) + s * 0.2, gy, s * 0.24, t);
  cast.neighbor2.draw(ctx, X(FRIEZE_PLACES.well) - s * 0.14, gy + s * 0.01, s * 0.235, t);
  // 家
  const hx = X(FRIEZE_PLACES.home);
  house(ctx, hx, gy, s * 0.36, { t, smoke: clamp(1 - wither), door: 0.6 });
  jar(ctx, hx + s * 0.25, gy, s * 0.13, { fill: st.jar ?? 0.3 });
  cast.mother.draw(ctx, hx - s * 0.17, gy, s * 0.24, t);
  cast.wife.draw(ctx, hx + s * 0.15, gy, s * 0.24, t);
  cast.child.draw(ctx, hx + s * 0.36, gy + s * 0.01, s * 0.24, t);
  // 田：枯粟、田缝、跪着的禾
  const fx = X(FRIEZE_PLACES.field);
  milletStalks(ctx, fx - s * 0.05, gy - s * 0.035, s * 0.55, s * 0.17, { wither, t, seed: 2 });
  cracks(ctx, fx - s * 0.32, gy - s * 0.02, s * 0.62, s * 0.11, { amount: st.crack ?? 0.6, seed: 4, origin: { x: 0.62, y: 0.3 } });
  milletStalks(ctx, fx - s * 0.28, gy + s * 0.07, s * 0.16, s * 0.12, { wither: Math.min(1, wither + 0.15), t, seed: 7 });
  cast.he.draw(ctx, fx + s * 0.03, gy + s * 0.025, s * 0.25, t);
  ctx.restore();
  // 漆奁的上下纹带
  bronzeBand(ctx, 0, 0, w, band, { pattern: 'lozenge', base: PAL.lacquer2, line: PAL.gold });
  bronzeBand(ctx, 0, h - band * 1.4, w, band * 1.4, { pattern: 'panchi', base: PAL.lacquer2, line: PAL.gold, seed: 2 });
  finish(ctx, w, h, { ground: 'silk', vignette: 0.3 });
  const at = (u: number) => X(u) - cam;
  return {
    worldW: W,
    cam,
    sun: info.sun,
    places: Object.fromEntries(Object.entries(FRIEZE_PLACES).map(([k, u]) => [k, at(u)])) as Record<keyof typeof FRIEZE_PLACES, number>,
    ground: gy,
    gate: g,
    he: cast.he.anchors,
  };
}
