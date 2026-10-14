// 画具画廊：/dev/paint.html。每样东西一格，会动；上面三幅样张。
// ?t=3.5 冻结时间（截图用）；?only=scenes|cells 只看一部分。

import * as P from '../components/paint';
import type { Figure, FigureKind, PoseName } from '../components/paint';

const q = new URLSearchParams(location.search);
const frozen = q.has('t') ? Number(q.get('t')) : null;
const only = q.get('only');
const app = document.getElementById('app')!;

type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;
interface Cell {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  draw: DrawFn;
  visible: boolean;
  w: number;
  h: number;
}
const cells: Cell[] = [];
const io = new IntersectionObserver((es) => {
  for (const e of es) {
    const c = cells.find((x) => x.canvas === e.target);
    if (c) c.visible = e.isIntersecting;
  }
});

function add(parent: HTMLElement, cls: string, cap: string, draw: DrawFn, aspect?: number) {
  const box = document.createElement('div');
  box.className = cls;
  const canvas = document.createElement('canvas');
  if (aspect) canvas.style.aspectRatio = String(aspect);
  box.appendChild(canvas);
  const c = document.createElement('div');
  c.className = 'cap';
  c.innerHTML = cap;
  box.appendChild(c);
  parent.appendChild(box);
  const cell: Cell = { canvas, ctx: canvas.getContext('2d')!, draw, visible: true, w: 0, h: 0 };
  cells.push(cell);
  io.observe(canvas);
}

function section(title: string, cls: string) {
  const h = document.createElement('h2');
  h.textContent = title;
  app.appendChild(h);
  const d = document.createElement('div');
  d.className = cls;
  app.appendChild(d);
  return d;
}

const cyc = (t: number, period: number) => 0.5 - 0.5 * Math.cos((t / period) * Math.PI * 2);
const silkBg: DrawFn = (ctx, w, h) => P.silkGround(ctx, 0, 0, w, h);
const lacBg: DrawFn = (ctx, w, h) => P.lacquerGround(ctx, 0, 0, w, h);

// ============================================================
// 样张
// ============================================================

const narrow = innerWidth < 700;
if (only !== 'cells') {
  const sc = section('样张', 'scenes');
  add(sc, 'scene', '一 · 夜门：<code>sceneDoor()</code>', (ctx, w, h, t) => {
    P.sceneDoor(ctx, w, h, t, { hover: cyc(t, 6) * 0.9, omen: 0.35 });
  }, narrow ? 390 / 600 : 16 / 8);
  const room = P.makeRoomCast();
  add(sc, 'scene', '二 · 暗室：<code>sceneRoom()</code>', (ctx, w, h, t) => {
    const lit = Array.from({ length: 15 }, (_, i) => P.clamp((t * 0.8) % 14 - (14 - i) * 0.5 + 4));
    P.sceneRoom(ctx, w, h, t, room, { lit: lit.map((v, i) => (i >= 7 ? 1 : v * 0)) });
  }, narrow ? 390 / 600 : 16 / 8);
  const fr = P.makeFriezeCast();
  add(sc, 'scene', '三 · 东郊正午：<code>sceneFrieze()</code>', (ctx, w, h, t) => {
    P.sceneFrieze(ctx, w, h, t, fr, { cam: cyc(t, 40), crack: 0.65, wither: 0.7, jar: 0.28, crowd: 0.35 });
  }, narrow ? 390 / 520 : 16 / 7);
}

// ============================================================
// 每样东西
// ============================================================

if (only !== 'scenes') {
  // ---- 底与光 ----
  const g1 = section('底 · 光 · 纹', 'grid');
  add(g1, 'cell', '色板 <code>PAL</code>', (ctx, w, h) => {
    P.lacquerGround(ctx, 0, 0, w, h);
    const keys = Object.keys(P.PAL) as P.PalName[];
    const cw = w / 4;
    const ch = h / 3;
    keys.forEach((k, i) => {
      const x = (i % 4) * cw;
      const y = Math.floor(i / 4) * ch;
      ctx.fillStyle = P.PAL[k];
      ctx.fillRect(x + 6, y + 6, cw - 12, ch - 26);
      ctx.fillStyle = P.PAL.silk;
      ctx.font = '11px ui-monospace, Menlo, monospace';
      ctx.fillText(k, x + 8, y + ch - 8);
    });
  });
  add(g1, 'cell', '帛底 <code>silkGround() + grain()</code>', (ctx, w, h) => {
    P.silkGround(ctx, 0, 0, w, h);
    P.finish(ctx, w, h, { ground: 'silk' });
  });
  add(g1, 'cell', '漆底 <code>lacquerGround() + finish()</code>', (ctx, w, h) => {
    P.lacquerGround(ctx, 0, 0, w, h, { sheen: 0.8 });
    P.finish(ctx, w, h);
  });
  add(g1, 'cell', '灯焰 <code>flame()</code> · <code>glow()</code>', (ctx, w, h, t) => {
    lacBg(ctx, w, h, t);
    [0.25, 0.6, 1].forEach((k, i) => {
      const x = w * (0.25 + i * 0.25);
      P.flame(ctx, x, h * 0.62, 26, t, k, { seed: i });
      ctx.fillStyle = P.TONE.bronzeDark;
      ctx.beginPath();
      ctx.ellipse(x, h * 0.64, 16, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    P.glow(ctx, w * 0.5, h * 0.2, 40, P.PAL.cinnabar, 0.6 + 0.3 * Math.sin(t * 2));
    P.finish(ctx, w, h);
  });
  add(g1, 'cell', '云纹 <code>cloudScroll()</code> · <code>cloudBand()</code>', (ctx, w, h, t) => {
    lacBg(ctx, w, h, t);
    P.cloudBand(ctx, 0, h * 0.55, w, h * 0.45, { alpha: 0.5, drift: t * 10, seed: 3 });
    for (let i = 0; i < 3; i++) P.cloudScroll(ctx, w * (0.2 + i * 0.3), h * 0.28, 34, { progress: Math.min(1, ((t * 0.4 + i * 0.2) % 1.4)), seed: i + 1, flip: i % 2 ? -1 : 1 });
    P.finish(ctx, w, h);
  });
  add(g1, 'cell', '纹带与边框 <code>bronzeBorder()</code> · <code>bronzeBand()</code>', (ctx, w, h) => {
    lacBg(ctx, w, h, 0);
    P.bronzeBorder(ctx, 10, 10, w - 20, h - 20, { pattern: 'lozenge', band: 16 });
    P.bronzeBand(ctx, 40, h * 0.36, w - 80, 22, { pattern: 'panchi' });
    P.bronzeBand(ctx, 40, h * 0.56, w - 80, 22, { pattern: 'cloud' });
    P.finish(ctx, w, h);
  });
  add(g1, 'cell', '毛笔 <code>brushStroke()</code>', (ctx, w, h, t) => {
    silkBg(ctx, w, h, t);
    const p = (t * 0.35) % 1.3;
    P.brushStroke(ctx, [{ x: w * 0.12, y: h * 0.3 }, { x: w * 0.5, y: h * 0.24 }, { x: w * 0.88, y: h * 0.3 }], 12, P.TONE.ink, p * 1.5);
    P.brushStroke(ctx, [{ x: w * 0.2, y: h * 0.45 }, { x: w * 0.35, y: h * 0.7 }, { x: w * 0.5, y: h * 0.86 }], 10, P.TONE.ink, p * 1.5 - 0.5, { profile: 'needle' });
    P.brushStroke(ctx, [{ x: w * 0.6, y: h * 0.48 }, { x: w * 0.8, y: h * 0.82 }], 11, P.PAL.cinnabar, p * 1.5 - 0.7, { profile: 'press' });
    P.finish(ctx, w, h, { ground: 'silk' });
  });
  add(g1, 'cell', '「旱」<code>drawGlyphHan()</code> 毛笔 / 篆意', (ctx, w, h, t) => {
    silkBg(ctx, w, h, t);
    const s = Math.min(w * 0.4, h * 0.75);
    P.drawGlyphHan(ctx, w * 0.28, h * 0.5, s, { progress: (t * 0.3) % 1.25 });
    P.drawGlyphHan(ctx, w * 0.72, h * 0.5, s, { style: 'seal', color: P.PAL.cinnabar });
    P.finish(ctx, w, h, { ground: 'silk' });
  });
  add(g1, 'cell', '朱印 <code>seal()</code> 落印', (ctx, w, h, t) => {
    silkBg(ctx, w, h, t);
    const s = Math.min(h * 0.5, w * 0.28);
    P.seal(ctx, w * 0.3, h * 0.5, s, { progress: (t * 0.4) % 1.3 });
    P.seal(ctx, w * 0.72, h * 0.5, s * 0.8, { glyph: '禾', style: 'zhuwen', angle: 0.06 });
    P.finish(ctx, w, h, { ground: 'silk' });
  });

  // ---- 天 ----
  const g2 = section('天', 'grid');
  for (const part of ['noon', 'dusk', 'night', 'dawn'] as const) {
    add(g2, 'cell', `${{ noon: '午', dusk: '昏', night: '夜（荧惑守心）', dawn: '晨' }[part]} <code>sky({part:'${part}'})</code>`, (ctx, w, h, t) => {
      P.sky(ctx, w, h, { part, t, omen: part === 'night' ? cyc(t, 8) : 0, season: part === 'dawn' ? 'autumn' : 'summer' });
      P.loessGround(ctx, 0, h * 0.74, w, h * 0.26, { night: part === 'night' });
      P.finish(ctx, w, h, { ground: part === 'night' ? 'lacquer' : 'silk' });
    });
  }

  // ---- 门与屋里 ----
  const g3 = section('门 · 屋里', 'grid');
  add(g3, 'cell', '门 <code>door({open, hover, knock})</code>', (ctx, w, h, t) => {
    lacBg(ctx, w, h, t);
    P.wall(ctx, w / 2, h * 0.92, w, h * 0.7, { night: true });
    const k = t % 8;
    P.door(ctx, w / 2, h * 0.92, h * 0.42, h * 0.62, { t, hover: P.clamp(k / 2), open: P.clamp((k - 3) / 2) * (k < 7 ? 1 : 1 - (k - 7)), knock: Math.max(0, 1 - ((t * 1.3) % 2)) * (k < 2 ? 1 : 0) });
    P.finish(ctx, w, h);
  });
  add(g3, 'cell', '墙与窗 <code>wallWithWindow()</code>', (ctx, w, h, t) => {
    P.sky(ctx, w, h, { part: 'night', t, horizon: 0.5 });
    P.wallWithWindow(ctx, w / 2, h, w, h * 0.65, { t, wx: 0, wy: 0.6, ww: h * 0.18 });
    P.finish(ctx, w, h);
  });
  add(g3, 'cell tall', '十五连盏灯 <code>lampTree({lit})</code>', (ctx, w, h, t) => {
    lacBg(ctx, w, h, t);
    const k = (t * 3) % 22;
    const lit = Array.from({ length: 15 }, (_, i) => P.clamp(k - (14 - i)));
    P.lampTree(ctx, w / 2, h * 0.95, h * 0.82, { lit, t });
    P.finish(ctx, w, h);
  });
  add(g3, 'cell tall', '矮案 · 耳杯 · 席 <code>lowTable() earCup() mat()</code>', (ctx, w, h, t) => {
    lacBg(ctx, w, h, t);
    P.mat(ctx, w / 2, h * 0.85, w * 0.9, h * 0.1);
    const tb = P.lowTable(ctx, w / 2, h * 0.8, w * 0.8, { lit: 0.6 });
    P.earCup(ctx, w * 0.62, tb.top + 3, w * 0.16, { t });
    P.ticket(ctx, w * 0.35, tb.top + 2, w * 0.07, { flat: 1, t });
    P.flame(ctx, w * 0.2, h * 0.3, 18, t, 1);
    P.finish(ctx, w, h);
  });
  add(g3, 'cell tall', '票根 <code>ticket({lift, glow, seal})</code>', (ctx, w, h, t) => {
    lacBg(ctx, w, h, t);
    const k = cyc(t, 5);
    P.ticket(ctx, w * 0.3, h * 0.5, h * 0.3, { lift: k, glow: k, t });
    P.ticket(ctx, w * 0.7, h * 0.5, h * 0.3, { seal: (t * 0.35) % 1.3, angle: 0.04, t, write: P.clamp((t * 0.3) % 1.3) });
    P.finish(ctx, w, h);
  });
  add(g3, 'cell', '竹简 <code>bambooSlips({open})</code>', (ctx, w, h, t) => {
    lacBg(ctx, w, h, t);
    P.bambooSlips(ctx, w * 0.5, h * 0.85, h * 0.6, { open: cyc(t, 6) });
    P.finish(ctx, w, h);
  });
  add(g3, 'cell', '铺首 <code>pushou()</code>', (ctx, w, h, t) => {
    lacBg(ctx, w, h, t);
    P.pushou(ctx, w * 0.35, h * 0.38, h * 0.16, { swing: Math.sin(t * 6) * 0.3 * Math.max(0, Math.sin(t)) });
    P.pushou(ctx, w * 0.68, h * 0.38, h * 0.12, { lit: cyc(t, 3) });
    P.finish(ctx, w, h);
  });

  // ---- 东郊 ----
  const g4 = section('东郊', 'grid');
  const day = (fn: DrawFn): DrawFn => (ctx, w, h, t) => {
    P.sky(ctx, w, h, { part: 'noon', t, horizon: 0.55, clouds: 0.3, sun: { x: 0.86, y: 0.16 } });
    P.loessGround(ctx, 0, h * 0.55, w, h * 0.45);
    fn(ctx, w, h, t);
    P.finish(ctx, w, h, { ground: 'silk' });
  };
  add(g4, 'cell', '茅屋 · 粟瓮 <code>house() jar({fill})</code>', day((ctx, w, h, t) => {
    P.house(ctx, w * 0.4, h * 0.9, h * 0.6, { t, smoke: cyc(t, 8), lit: 0 });
    P.jar(ctx, w * 0.82, h * 0.9, h * 0.32, { fill: cyc(t, 6) });
  }));
  add(g4, 'cell', '粟瓮三档 <code>jar({fill})</code>', day((ctx, w, h) => {
    [0.9, 0.45, 0.08].forEach((f, i) => P.jar(ctx, w * (0.22 + i * 0.28), h * 0.9, h * 0.4, { fill: f }));
  }));
  add(g4, 'cell', '井与桔槔 <code>well({dip})</code>', day((ctx, w, h, t) => {
    P.well(ctx, w * 0.45, h * 0.9, h * 0.7, { dip: cyc(t, 4), t });
  }));
  add(g4, 'cell', '社树 <code>sheTree({wither})</code>', day((ctx, w, h, t) => {
    P.sheTree(ctx, w * 0.5, h * 0.92, h * 0.85, { t, wither: cyc(t, 10) });
  }));
  add(g4, 'cell', '社坛 <code>altar({grow})</code>', day((ctx, w, h, t) => {
    P.sheTree(ctx, w * 0.3, h * 0.92, h * 0.8, { t, wither: 0.3 });
    P.altar(ctx, w * 0.68, h * 0.92, h * 0.6, { grow: P.clamp(((t * 0.2) % 1.3)), t });
  }));
  add(g4, 'cell', '田伯家 <code>gate({knock, open, crowd})</code>', day((ctx, w, h, t) => {
    const k = t % 10;
    P.gate(ctx, w * 0.5, h * 0.92, h * 0.78, { t, knock: k < 3 ? Math.max(0, 1 - (k % 1) * 2) : 0, open: P.clamp((k - 4) / 1.5), crowd: P.clamp((k - 5) / 4) });
  }));
  add(g4, 'cell', '往莒的路 <code>road()</code> · <code>willow()</code>', day((ctx, w, h, t) => {
    P.road(ctx, w * 0.42, h, w * 0.9, h * 0.45, { t });
  }));
  add(g4, 'cell', '粟 <code>milletStalks({wither})</code>', day((ctx, w, h, t) => {
    P.milletStalks(ctx, w * 0.5, h * 0.92, w * 0.9, h * 0.5, { wither: cyc(t, 8), t });
  }));
  add(g4, 'cell', '田缝 <code>cracks({amount})</code>', day((ctx, w, h, t) => {
    P.cracks(ctx, w * 0.04, h * 0.6, w * 0.92, h * 0.36, { amount: cyc(t, 8), seed: 3 });
  }));

  // ---- 心象 ----
  const g5 = section('心象', 'grid');
  const heartBg: DrawFn = (ctx, w, h) => {
    P.lacquerGround(ctx, 0, 0, w, h, { tone: 'brown' });
  };
  add(g5, 'cell tall', '铜镜 <code>bronzeMirror({open}, inner)</code>', (ctx, w, h, t) => {
    heartBg(ctx, w, h, t);
    P.bronzeMirror(ctx, w / 2, h / 2, Math.min(w, h) * 0.42, { open: P.clamp((t * 0.3) % 1.4), t }, (g, r) => {
      g.save();
      g.translate(-r, -r);
      P.sky(g, r * 2, r * 2, { part: 'dusk', t, horizon: 0.55, clouds: 0.4 });
      P.loessGround(g, 0, r * 1.1, r * 2, r * 0.9, { seed: 5 });
      P.cracks(g, r * 0.2, r * 1.2, r * 1.6, r * 0.5, { amount: 0.5, seed: 2 });
      P.seedGlyph(g, r * 0.7, r * 0.9, r * 0.08, { lit: 1, t });
      P.seedGlyph(g, r * 1.3, r * 1.0, r * 0.07, { lit: 0, t });
      g.restore();
    });
    P.finish(ctx, w, h);
  });
  add(g5, 'cell tall', '四季转盘 <code>seasonDial()</code>', (ctx, w, h, t) => {
    heartBg(ctx, w, h, t);
    const k = (t * 0.15) % 4;
    P.seasonDial(ctx, w / 2, h / 2, Math.min(w, h) * 0.36, { season: Math.floor(k), progress: k % 1 });
    P.finish(ctx, w, h);
  });
  add(g5, 'cell tall', '小田伯的秤 <code>scale({weights, ghost})</code>', (ctx, w, h, t) => {
    heartBg(ctx, w, h, t);
    const weights = { qing: cyc(t, 7), li: 0.3 + 0.5 * cyc(t + 2, 9), ming: 0.8 - 0.6 * cyc(t, 11) };
    P.scale(ctx, w * 0.5, h * 0.9, Math.min(w * 0.9, h), { weights, ghost: { qing: 0.6, li: 0.6, ming: 0.2 }, t, hot: Math.floor(t / 3) % 3 === 0 ? 'qing' : null });
    P.finish(ctx, w, h);
  });
  add(g5, 'cell', '竹券 <code>tally({split})</code>', (ctx, w, h, t) => {
    heartBg(ctx, w, h, t);
    P.tally(ctx, w / 2, h / 2, w * 0.75, { split: P.clamp(((t * 0.4) % 1.6) - 0.3) });
    P.finish(ctx, w, h);
  });
  add(g5, 'cell', '种子 · 芽 <code>seedGlyph() sprout()</code>', (ctx, w, h, t) => {
    heartBg(ctx, w, h, t);
    P.seedGlyph(ctx, w * 0.2, h * 0.45, h * 0.14, { lit: 1, t, text: '社' });
    P.seedGlyph(ctx, w * 0.45, h * 0.45, h * 0.14, { lit: 0, t, text: '走' });
    P.sprout(ctx, w * 0.75, h * 0.8, h * 0.6, { grow: P.clamp((t * 0.3) % 1.4), t });
    P.finish(ctx, w, h);
  });

  // ---- 人物 ----
  const g6 = section('人物 · 80 像素也认得出', 'grid');
  const kinds: FigureKind[] = ['he', 'wife', 'child', 'mother', 'tianbo', 'mentor', 'ji', 'neighbor', 'traveler'];
  const names = ['禾', '桑', '小石', '母', '田伯', '导师', '季', '乡邻', '行人'];
  const lineupDay = kinds.map((k, i) => P.makeFigure(k, { pose: 'stand', facing: i % 2 ? -1 : 1 }));
  const lineupNight = kinds.map((k, i) => P.makeFigure(k, { pose: 'stand', facing: i % 2 ? -1 : 1, onDark: true }));
  const lineup = (figs: Figure[], dark: boolean): DrawFn => (ctx, w, h, t) => {
    if (dark) P.lacquerGround(ctx, 0, 0, w, h);
    else P.silkGround(ctx, 0, 0, w, h);
    const step = w / figs.length;
    figs.forEach((f, i) => {
      const x = step * (i + 0.5);
      if (dark) P.glow(ctx, x, h * 0.55, 60, P.PAL.millet, 0.12);
      f.draw(ctx, x, h * 0.78, 80, t);
      ctx.fillStyle = dark ? P.PAL.silkDim : P.TONE.ink;
      ctx.font = '12px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.fillText(names[i]!, x, h * 0.92);
    });
    P.finish(ctx, w, h, { ground: dark ? 'lacquer' : 'silk' });
  };
  add(g6, 'cell wide', '九种人 · 帛底 <code>makeFigure(kind)</code>', lineup(lineupDay, false));
  add(g6, 'cell wide', '九种人 · 漆底 <code>{onDark:true}</code>', lineup(lineupNight, true));

  const poseCast: [PoseName, FigureKind][] = [
    ['stand', 'he'], ['walk', 'he'], ['kneel', 'he'], ['kneel-touch', 'he'], ['look-up', 'he'], ['bow', 'he'], ['beg', 'he'],
    ['sit-write', 'mentor'], ['sit-look', 'mentor'], ['push', 'mentor'], ['stamp', 'mentor'], ['reach', 'he'], ['carry', 'he'],
    ['point', 'neighbor'], ['shake-head', 'tianbo'], ['nod', 'tianbo'], ['slump', 'wife'], ['sit', 'child'], ['open-gate', 'tianbo'], ['turn', 'he'],
  ];
  const poseFigs = poseCast.map(([p, k]) => {
    const f = P.makeFigure(k, { pose: p === 'push' || p === 'stamp' ? 'sit-write' : p });
    if (p === 'push' || p === 'stamp') f.setPose(p, 0);
    return f;
  });
  add(g6, 'cell wide tall', '二十种姿势 <code>setPose(name, ms)</code>', (ctx, w, h, t) => {
    P.silkGround(ctx, 0, 0, w, h);
    const cols = w < 700 ? 5 : 10;
    const rows = Math.ceil(poseFigs.length / cols);
    const cw = w / cols;
    const rh = h / rows;
    poseFigs.forEach((f, i) => {
      const x = cw * ((i % cols) + 0.5);
      const y = rh * (Math.floor(i / cols) + 1) - 26;
      f.draw(ctx, x, y, Math.min(rh * 0.6, cw * 0.95), t);
      ctx.fillStyle = P.TONE.ink;
      ctx.font = '11px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(poseCast[i]![0], x, y + 16);
    });
    P.finish(ctx, w, h, { ground: 'silk' });
  });

  // 过渡与视线
  const walker = P.makeFigure('he', { pose: 'walk' });
  const seq: [PoseName, number][] = [['walk', 3], ['stand', 1], ['look-up', 1.6], ['kneel', 1.4], ['kneel-touch', 2], ['kneel', 1], ['stand', 1], ['point', 1.2], ['shake-head', 1.6], ['walk', 0]];
  let seqI = -1;
  let seqT = 0;
  add(g6, 'cell wide', '平滑过渡 · 视线 <code>setPose()</code> <code>setGaze()</code>', (ctx, w, h, t) => {
    P.sky(ctx, w, h, { part: 'dusk', t, horizon: 0.82, clouds: 0.3 });
    P.loessGround(ctx, 0, h * 0.82, w, h * 0.18);
    if (seqI < 0 || t - seqT > seq[seqI]![1]) {
      seqI = (seqI + 1) % (seq.length - 1);
      seqT = t;
      walker.setPose(seq[seqI]![0], 500);
      walker.setGaze(seq[seqI]![0] === 'stand' ? 0.6 : seq[seqI]![0] === 'kneel' ? -0.5 : null);
    }
    const loopT = seq.slice(0, seq.length - 1).reduce((a, s) => a + s[1], 0);
    const lt = t % loopT;
    const x = w * 0.15 + Math.min(lt, 3) * w * 0.1;
    walker.draw(ctx, x, h * 0.88, h * 0.62, t);
    P.finish(ctx, w, h, { ground: 'silk' });
  });

  // 性能：十人 + 整卷横幅
  const crowd = Array.from({ length: 10 }, (_, i) => P.makeFigure(kinds[i % kinds.length]!, { pose: i % 2 ? 'walk' : 'stand', seed: i, facing: i % 3 ? 1 : -1 }));
  const fr2 = P.makeFriezeCast();
  add(g6, 'cell wide', '十人 + 整卷横幅（帧率见右上）', (ctx, w, h, t) => {
    P.sceneFrieze(ctx, w, h, t, fr2, { cam: cyc(t, 20), crowd: 1, gateOpen: 1, altar: 1 });
    crowd.forEach((f, i) => f.draw(ctx, w * (0.05 + i * 0.095), h * 0.86, h * 0.2, t));
  });
}

// ============================================================
// 帧循环
// ============================================================

const fpsEl = document.getElementById('fps')!;
let last = performance.now();
const times: number[] = [];
function frame(now: number) {
  const dt = now - last;
  last = now;
  times.push(dt);
  if (times.length > 120) times.shift();
  const t = frozen ?? now / 1000;
  const dpr = Math.min(2, devicePixelRatio || 1);
  for (const c of cells) {
    if (!c.visible) continue;
    const r = c.canvas.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (w < 2 || h < 2) continue;
    if (w !== c.w || h !== c.h) {
      c.canvas.width = Math.round(w * dpr);
      c.canvas.height = Math.round(h * dpr);
      c.w = w;
      c.h = h;
    }
    const ctx = c.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    try {
      c.draw(ctx, w, h, t);
    } catch (err) {
      console.error(err);
    }
  }
  if (times.length > 30) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    fpsEl.textContent = `${(1000 / avg).toFixed(0)} fps`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(window as any).__paintReady = true;
