// 东郊的东西：黄土地、田缝、粟、茅屋、粟瓮、井与桔槔、社树与社坛、田伯家的门楼、往莒的路与柳。
// 约定：立在地上的东西 (x,y) 为底边中点；铺开的区域 (x,y,w,h) 为左上角。

import { makeFigure, type Figure, type FigureKind } from './figure';
import { ribbon } from './ornament';
import { PAL, TONE } from './palette';
import { door, wall } from './props-room';
import { cached, glow } from './texture';
import { type C2D, type Pt, TAU, clamp, deviceScale, easeOut, hash, lerp, mix, noise1, rgba, rng, sampleSpline, span } from './util';

// ============================================================
// 地
// ============================================================

/** 黄土地：一条横带（左上角 x,y）。night 为夜色 */
export function loessGround(ctx: C2D, x: number, y: number, w: number, h: number, opts: { seed?: number; night?: boolean; tone?: string } = {}) {
  const seed = opts.seed ?? 2;
  const base = opts.tone ?? (opts.night ? TONE.wallNight : PAL.loess);
  const dpr = deviceScale(ctx);
  const c = cached(`loess:${seed}:${base}`, w, h, dpr, (g) => {
    const r = rng(seed);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, mix(base, '#f0dcb0', 0.18));
    gr.addColorStop(0.35, base);
    gr.addColorStop(1, mix(base, PAL.umber, 0.35));
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    // 土的横纹
    for (let i = 0; i < h * 1.2; i++) {
      const yy = Math.pow(r(), 0.8) * h;
      const ww = 20 + r() * w * 0.25;
      g.fillStyle = rgba(r() < 0.5 ? TONE.loessDark : TONE.loessLight, 0.08 + r() * 0.12);
      g.fillRect(r() * w - 10, yy, ww, 0.6 + r() * 1.6 * (yy / h + 0.3));
    }
    // 碎石
    for (let i = 0; i < w / 6; i++) {
      const yy = r() * h;
      g.fillStyle = rgba(r() < 0.6 ? PAL.umber : TONE.loessLight, 0.25 + r() * 0.3);
      g.beginPath();
      g.ellipse(r() * w, yy, 0.6 + r() * 1.6 * (yy / h + 0.4), 0.4 + r() * 0.8, 0, 0, TAU);
      g.fill();
    }
    // 地平线：一道细墨线（横幅的地线）
    g.fillStyle = rgba(PAL.umber, 0.5);
    g.fillRect(0, 0, w, 1.2);
  });
  ctx.drawImage(c, x, y, w, h);
}

// ============================================================
// 田缝
// ============================================================

interface CrackEdge {
  pts: Pt[];
  birth: number;
  main: boolean;
  v: number;
}
const crackGeo = new Map<string, CrackEdge[]>();

function crackNetwork(seed: number, aspect: number, ox: number, oy: number): CrackEdge[] {
  const key = `${seed}:${aspect.toFixed(2)}:${ox.toFixed(2)}:${oy.toFixed(2)}`;
  const ex = crackGeo.get(key);
  if (ex) return ex;
  const r = rng(seed * 7 + 1);
  const cols = Math.max(4, Math.round(5 * aspect));
  const rows = 5;
  const P: Pt[][] = [];
  for (let j = 0; j <= rows; j++) {
    const row: Pt[] = [];
    for (let i = 0; i <= cols; i++) {
      const jx = i === 0 || i === cols ? 0 : (r() - 0.5) * 0.7;
      const jy = j === 0 || j === rows ? 0 : (r() - 0.5) * 0.7;
      row.push({ x: (i + jx) / cols, y: (j + jy) / rows });
    }
    P.push(row);
  }
  const edges: CrackEdge[] = [];
  const wavy = (a: Pt, b: Pt): Pt[] => {
    const out: Pt[] = [a];
    const n = 4;
    for (let k = 1; k < n; k++) {
      const u = k / n;
      const nx = -(b.y - a.y);
      const ny = b.x - a.x;
      const j = (r() - 0.5) * 0.35;
      out.push({ x: lerp(a.x, b.x, u) + nx * j, y: lerp(a.y, b.y, u) + ny * j });
    }
    out.push(b);
    return out;
  };
  const birthOf = (a: Pt, b: Pt) => {
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const d = Math.hypot((m.x - ox) * aspect, m.y - oy) / Math.hypot(aspect, 1);
    return clamp(d * 1.25 + (r() - 0.5) * 0.25, 0, 0.95);
  };
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const a = P[j]![i]!;
      if (i < cols && j > 0 && j < rows && r() > 0.12) {
        const b = P[j]![i + 1]!;
        edges.push({ pts: wavy(a, b), birth: birthOf(a, b), main: false, v: a.y });
      }
      if (j < rows && i > 0 && i < cols && r() > 0.25) {
        const b = P[j + 1]![i]!;
        edges.push({ pts: wavy(a, b), birth: birthOf(a, b), main: false, v: a.y });
      }
    }
  }
  // 一道主缝：从起点向两边斜着裂开
  for (const s of [-1, 1]) {
    const pts: Pt[] = [{ x: ox, y: oy }];
    let x = ox;
    let y = oy;
    let a = s > 0 ? 0.25 : Math.PI + 0.25;
    for (let k = 0; k < 9; k++) {
      a += (r() - 0.5) * 0.7;
      x += (Math.cos(a) * 0.12) / aspect;
      y += Math.sin(a) * 0.08;
      pts.push({ x: clamp(x), y: clamp(y) });
    }
    edges.push({ pts, birth: 0, main: true, v: oy });
  }
  edges.sort((p, q) => p.birth - q.birth);
  crackGeo.set(key, edges);
  return edges;
}

/**
 * 田缝：黄土里的裂缝网，随 amount 0..1 从 origin 向外长、变宽。区域左上角 (x,y)。
 * origin 为起裂处（区域内 0..1 比例，默认禾手按着的地方）。
 */
export function cracks(ctx: C2D, x: number, y: number, w: number, h: number, opts: { amount?: number; seed?: number; origin?: { x: number; y: number }; width?: number } = {}) {
  const amount = clamp(opts.amount ?? 0.5);
  if (amount <= 0) return;
  const o = opts.origin ?? { x: 0.45, y: 0.45 };
  const edges = crackNetwork(opts.seed ?? 1, w / Math.max(1, h), o.x, o.y);
  const maxW = opts.width ?? Math.max(1.4, h * 0.05);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const e of edges) {
    const grow = clamp((amount - e.birth * 0.9) / 0.18);
    if (grow <= 0) continue;
    const persp = 0.45 + 0.55 * e.v;
    const wd = maxW * persp * (e.main ? 1.5 : 1) * (0.35 + 0.65 * clamp((amount - e.birth) * 2.2));
    const pts = e.pts.map((p) => ({ x: x + p.x * w, y: y + p.y * h }));
    // 裂口阴影
    ctx.fillStyle = PAL.umber;
    ribbon(ctx, pts, (u) => wd * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, 0.1 + u * 0.9))), grow);
    // 下沿受光的土唇
    ctx.strokeStyle = rgba(TONE.loessLight, 0.55);
    ctx.lineWidth = Math.max(0.5, wd * 0.25);
    ctx.beginPath();
    const n = Math.max(2, Math.ceil(pts.length * grow));
    for (let i = 0; i < n; i++) {
      const p = pts[i]!;
      if (i === 0) ctx.moveTo(p.x, p.y + wd * 0.55);
      else ctx.lineTo(p.x, p.y + wd * 0.55);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ============================================================
// 粟
// ============================================================

/**
 * 一行粟。(x,y) 底边中点；w 行宽，h 株高。wither 0..1 枯（变黄、垂头、折），wind 为时间 t。
 */
export function milletStalks(ctx: C2D, x: number, y: number, w: number, h: number, opts: { wither?: number; t?: number; seed?: number; n?: number } = {}) {
  const wither = clamp(opts.wither ?? 0);
  const t = opts.t ?? 0;
  const seed = opts.seed ?? 1;
  const n = opts.n ?? Math.max(3, Math.round(w / (h * 0.16)));
  const r = rng(seed * 3 + 5);
  const stemCol = mix(mix(TONE.leaf, TONE.straw, clamp(wither * 1.4)), PAL.umber, clamp(wither - 0.6) * 0.8);
  const headCol = mix(PAL.millet, TONE.straw, wither);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const bx = x - w / 2 + ((i + 0.5) / n) * w + (r() - 0.5) * (w / n) * 0.6;
    const hh = h * (0.75 + r() * 0.25) * (1 - wither * 0.2);
    const sway = noise1(t * 0.6 + i * 0.37, seed) * 0.09 * (1 - wither * 0.5) + (r() - 0.5) * 0.12;
    const broken = wither > 0.55 && r() < (wither - 0.55) * 1.6;
    const front = r() < 0.5;
    const col = front ? stemCol : mix(stemCol, PAL.umber, 0.25);
    // 茎：二次曲线
    const bend = sway + wither * 0.15;
    const midX = bx + Math.sin(bend) * hh * 0.5;
    const midY = y - hh * 0.55;
    let tipX = bx + Math.sin(bend * 2) * hh;
    let tipY = y - hh * Math.cos(bend);
    if (broken) {
      // 折在半腰：上半截垂下来（跪着）
      tipX = midX + hh * 0.35;
      tipY = midY + hh * 0.12;
    }
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(0.8, h * 0.024);
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.stroke();
    // 叶
    ctx.fillStyle = col;
    for (let k = 0; k < 3; k++) {
      const u = 0.25 + k * 0.2;
      const lx = lerp(bx, midX, u * 1.4);
      const ly = lerp(y, midY, u * 1.4);
      const side = (k + i) % 2 ? 1 : -1;
      const droop = 0.3 + wither * 0.9;
      const L = h * (0.32 - k * 0.04) * (1 - wither * 0.25);
      const pts = sampleSpline(
        [
          { x: lx, y: ly },
          { x: lx + side * L * 0.45, y: ly - L * (0.35 - droop * 0.3) },
          { x: lx + side * L * 0.85, y: ly - L * (0.2 - droop * 0.55) + Math.sin(t * 1.3 + i + k) * L * 0.03 },
        ],
        5,
      );
      ribbon(ctx, pts, (q) => Math.max(0.5, h * 0.045 * Math.sin(Math.PI * Math.min(1, q * 1.1 + 0.05)) * (1 - wither * 0.4)));
    }
    // 穗：沿一条下垂的弧排小粒
    const headLen = h * 0.24 * (1 - wither * 0.45);
    const hang = 0.9 + wither * 1.2 + sway * 2;
    ctx.fillStyle = headCol;
    const g = Math.max(4, Math.round(9 * (1 - wither * 0.4)));
    for (let k = 0; k < g; k++) {
      const u = k / (g - 1);
      const a = -Math.PI / 2 + hang * u * 1.1 + (broken ? 1.2 : 0);
      const px = tipX + Math.cos(a) * headLen * u * 0.9 + headLen * 0.1 * u;
      const py = tipY + Math.sin(a) * headLen * u * 0.6 + headLen * u * u * 0.6;
      const rr = h * 0.036 * (1 - u * 0.4) * (1 - wither * 0.4);
      ctx.beginPath();
      ctx.ellipse(px, py, rr * 1.2, rr * 0.9, a, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ============================================================
// 茅屋与粟瓮
// ============================================================

/**
 * 茅屋：夯土墙、厚茅顶。(x,y) 底边中点，s 宽。
 * door 0..1 门开；lit 0..1 屋里有光（黄昏/夜）；smoke 0..1 炊烟（有粮才有）。
 */
export function house(ctx: C2D, x: number, y: number, s: number, opts: { t?: number; door?: number; lit?: number; smoke?: number; night?: boolean } = {}) {
  const t = opts.t ?? 0;
  const wallH = s * 0.4;
  const roofH = s * 0.36;
  const dpr = deviceScale(ctx);
  const night = opts.night ?? false;
  const c = cached(`house:${night}`, s * 1.3, wallH + roofH + 4, dpr, (g, cw) => {
    g.translate(cw / 2, wallH + roofH + 2);
    // 墙
    const wcol = night ? TONE.wallNight : mix(PAL.loess, PAL.ochre, 0.15);
    g.fillStyle = wcol;
    g.fillRect(-s * 0.45, -wallH, s * 0.9, wallH);
    const r = rng(8);
    for (let yy = -wallH + 6; yy < 0; yy += wallH * 0.14) {
      g.fillStyle = rgba(PAL.umber, 0.18);
      g.fillRect(-s * 0.45, yy, s * 0.9, 1);
      for (let k = 0; k < 6; k++) {
        g.fillStyle = rgba(r() < 0.5 ? TONE.loessLight : PAL.umber, 0.1);
        g.fillRect(-s * 0.45 + r() * s * 0.85, yy + r() * wallH * 0.12, 8 + r() * 20, 1.5);
      }
    }
    g.strokeStyle = rgba(TONE.ink, 0.6);
    g.lineWidth = 1;
    g.strokeRect(-s * 0.45, -wallH, s * 0.9, wallH);
    // 窗
    g.fillStyle = '#1a120c';
    g.fillRect(-s * 0.3, -wallH * 0.72, s * 0.13, wallH * 0.26);
    g.fillStyle = mix(wcol, '#000000', 0.4);
    for (let k = 1; k < 4; k++) g.fillRect(-s * 0.3 + (k * s * 0.13) / 4 - 0.8, -wallH * 0.72, 1.6, wallH * 0.26);
    // 茅顶：厚、圆、檐下平切
    g.beginPath();
    g.moveTo(-s * 0.6, -wallH + s * 0.02);
    g.quadraticCurveTo(-s * 0.55, -wallH - roofH * 0.55, -s * 0.12, -wallH - roofH * 0.95);
    g.quadraticCurveTo(0, -wallH - roofH * 1.02, s * 0.12, -wallH - roofH * 0.95);
    g.quadraticCurveTo(s * 0.55, -wallH - roofH * 0.55, s * 0.6, -wallH + s * 0.02);
    g.quadraticCurveTo(0, -wallH - s * 0.03, -s * 0.6, -wallH + s * 0.02);
    g.closePath();
    g.fillStyle = night ? '#3a2c1c' : TONE.straw;
    g.fill();
    g.save();
    g.clip();
    // 草茎
    for (let k = 0; k < 160; k++) {
      const u = r() * 2 - 1;
      const x0 = u * s * 0.15;
      const x1 = u * s * 0.62;
      g.strokeStyle = rgba(r() < 0.5 ? PAL.umber : '#e8d29a', night ? 0.15 : 0.22 + r() * 0.2);
      g.lineWidth = 0.6 + r() * 0.6;
      g.beginPath();
      g.moveTo(x0, -wallH - roofH);
      g.quadraticCurveTo(lerp(x0, x1, 0.5) + u * s * 0.05, -wallH - roofH * 0.45, x1, -wallH + s * 0.02);
      g.stroke();
    }
    // 檐下的阴影
    const gr = g.createLinearGradient(0, -wallH - roofH * 0.2, 0, -wallH);
    gr.addColorStop(0, rgba(PAL.umber, 0));
    gr.addColorStop(1, rgba(PAL.umber, 0.45));
    g.fillStyle = gr;
    g.fillRect(-s, -wallH - roofH * 0.2, s * 2, roofH * 0.25);
    g.restore();
    g.strokeStyle = rgba(TONE.ink, 0.7);
    g.lineWidth = 1;
    g.stroke();
    // 压顶的草绳
    g.strokeStyle = rgba(PAL.umber, 0.75);
    g.lineWidth = 2;
    for (const u of [-0.32, 0, 0.32]) {
      g.beginPath();
      g.moveTo(u * s * 0.3, -wallH - roofH * 0.97);
      g.quadraticCurveTo(u * s * 0.9, -wallH - roofH * 0.5, u * s * 1.6, -wallH + s * 0.01);
      g.stroke();
    }
  });
  ctx.drawImage(c, x - s * 0.65, y - wallH - roofH - 2, s * 1.3, wallH + roofH + 4);
  // 门：开着的门洞，屋里的光
  const dx = x + s * 0.12;
  const dw = s * 0.18;
  const dh = wallH * 0.74;
  const lit = clamp(opts.lit ?? 0);
  ctx.fillStyle = '#120b07';
  ctx.fillRect(dx, y - dh, dw, dh);
  if (lit > 0) {
    ctx.fillStyle = rgba('#d98c3c', 0.75 * lit);
    ctx.fillRect(dx, y - dh, dw, dh);
    glow(ctx, dx + dw / 2, y - dh * 0.4, dw * 2, PAL.millet, 0.4 * lit);
  }
  const op = clamp(opts.door ?? 0.4);
  ctx.fillStyle = night ? '#24180f' : '#5a3d26';
  ctx.fillRect(dx + dw * op * 0.85, y - dh, dw * (1 - op * 0.85), dh);
  ctx.strokeStyle = rgba(TONE.ink, 0.7);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(dx, y - dh, dw, dh);
  // 炊烟
  const sm = clamp(opts.smoke ?? 0);
  if (sm > 0) {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.12 + i / 3) % 1;
      ctx.strokeStyle = rgba(night ? '#6a5a48' : '#8b7f6c', Math.sin(ph * Math.PI) * 0.35 * sm);
      ctx.lineWidth = s * 0.02 * (1 + ph);
      ctx.beginPath();
      for (let k = 0; k <= 10; k++) {
        const u = k / 10;
        const xx = x - s * 0.18 + Math.sin(u * 4 + t * 0.8 + i) * s * 0.03 + u * s * 0.15 * (0.5 + ph);
        const yy = y - wallH - roofH * 0.8 - u * s * 0.5 * (0.3 + ph);
        if (k === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  return { door: { x: dx + dw / 2, y: y - dh / 2, w: dw, h: dh }, top: y - wallH - roofH };
}

function jarPath(g: C2D, s: number, k = 1) {
  const W = s * 0.5 * k;
  g.beginPath();
  g.moveTo(-W * 0.42, -s * 0.97 * k);
  g.quadraticCurveTo(-W * 0.36, -s * 0.88 * k, -W * 0.5, -s * 0.84 * k);
  g.bezierCurveTo(-W * 1.15, -s * 0.72 * k, -W * 1.05, -s * 0.2 * k, -W * 0.55, 0);
  g.lineTo(W * 0.55, 0);
  g.bezierCurveTo(W * 1.05, -s * 0.2 * k, W * 1.15, -s * 0.72 * k, W * 0.5, -s * 0.84 * k);
  g.quadraticCurveTo(W * 0.36, -s * 0.88 * k, W * 0.42, -s * 0.97 * k);
  g.closePath();
}

/**
 * 粟瓮：陶瓮，剖开一扇看粟的高低。(x,y) 底边中点，s 高；fill 0..1。
 */
export function jar(ctx: C2D, x: number, y: number, s: number, opts: { fill?: number; night?: boolean } = {}) {
  const fill = clamp(opts.fill ?? 0.5);
  const clay = opts.night ? '#4a3020' : '#9a643a';
  ctx.save();
  ctx.translate(x, y);
  // 瓮身
  jarPath(ctx, s);
  const g = ctx.createLinearGradient(-s * 0.5, 0, s * 0.5, 0);
  g.addColorStop(0, mix(clay, '#000000', 0.3));
  g.addColorStop(0.45, clay);
  g.addColorStop(1, mix(clay, '#000000', 0.4));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(TONE.ink, 0.8);
  ctx.lineWidth = Math.max(0.8, s * 0.012);
  ctx.stroke();
  // 剖面：瓮里
  ctx.save();
  ctx.translate(0, -s * 0.06);
  jarPath(ctx, s, 0.86);
  ctx.restore();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#21150d';
  ctx.fillRect(-s, -s, s * 2, s);
  const inner = s * 0.8;
  const top = -s * 0.06 - inner * fill;
  if (fill > 0) {
    ctx.fillStyle = PAL.millet;
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.lineTo(-s, top + s * 0.03);
    ctx.quadraticCurveTo(0, top - s * 0.05, s, top + s * 0.03);
    ctx.lineTo(s, 0);
    ctx.closePath();
    ctx.fill();
    // 粟粒
    const r = rng(17);
    ctx.fillStyle = rgba(TONE.ochreDark, 0.5);
    for (let i = 0; i < 90; i++) {
      const px = (r() - 0.5) * s * 0.9;
      const py = top + r() * (inner * fill + s * 0.05);
      ctx.beginPath();
      ctx.arc(px, py, s * 0.007, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = rgba('#fff2c0', 0.35);
    ctx.fillRect(-s, top - s * 0.01, s * 2, s * 0.012);
  }
  ctx.restore();
  // 剖面的边：陶壁厚度
  ctx.save();
  ctx.translate(0, -s * 0.06);
  jarPath(ctx, s, 0.86);
  ctx.restore();
  ctx.strokeStyle = mix(clay, '#e0b080', 0.3);
  ctx.lineWidth = Math.max(0.8, s * 0.014);
  ctx.stroke();
  // 绳纹带
  ctx.strokeStyle = rgba(TONE.ink, 0.35);
  ctx.lineWidth = Math.max(0.5, s * 0.008);
  for (let i = -6; i <= 6; i++) {
    const xx = i * s * 0.07;
    ctx.beginPath();
    ctx.moveTo(xx - s * 0.02, -s * 0.86);
    ctx.lineTo(xx + s * 0.02, -s * 0.8);
    ctx.stroke();
  }
  // 口沿
  ctx.fillStyle = mix(clay, '#000000', 0.15);
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.97, s * 0.22, s * 0.035, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#140c07';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.97, s * 0.17, s * 0.022, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  return { top: y - s, level: y - s * 0.06 - s * 0.8 * fill };
}

// ============================================================
// 井与桔槔
// ============================================================

/** 井与桔槔。(x,y) 为井口底边中点；s 为立柱高；dip 0..1 把桶放下去 */
export function well(ctx: C2D, x: number, y: number, s: number, opts: { dip?: number; t?: number; night?: boolean } = {}) {
  const dip = clamp(opts.dip ?? 0);
  const wood = opts.night ? '#2a1c12' : '#6b4a2e';
  const woodDark = opts.night ? '#160e09' : '#4a321f';
  const cw = s * 0.42;
  const ch = s * 0.17;
  const postX = x + s * 0.32;
  const P = { x: postX, y: y - s * 0.9 };
  const th = lerp(0.36, -0.2, easeOut(dip));
  const v = { x: Math.cos(th), y: Math.sin(th) };
  const a = s * 0.72;
  const b = s * 0.45;
  const L = { x: P.x - v.x * a, y: P.y - v.y * a };
  const R = { x: P.x + v.x * b, y: P.y + v.y * b };
  ctx.save();
  ctx.lineCap = 'round';
  // 立柱（上端分叉）
  ctx.strokeStyle = wood;
  ctx.lineWidth = s * 0.045;
  ctx.beginPath();
  ctx.moveTo(postX, y);
  ctx.lineTo(postX, P.y + s * 0.06);
  ctx.stroke();
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.moveTo(postX, P.y + s * 0.07);
  ctx.lineTo(postX - s * 0.04, P.y - s * 0.03);
  ctx.moveTo(postX, P.y + s * 0.07);
  ctx.lineTo(postX + s * 0.04, P.y - s * 0.03);
  ctx.stroke();
  // 横杆
  ctx.strokeStyle = woodDark;
  ctx.lineWidth = s * 0.022;
  ctx.beginPath();
  ctx.moveTo(L.x, L.y);
  ctx.lineTo(R.x, R.y);
  ctx.stroke();
  // 坠石
  ctx.fillStyle = opts.night ? '#2c2824' : '#7c7264';
  ctx.beginPath();
  ctx.ellipse(R.x + s * 0.02, R.y + s * 0.05, s * 0.07, s * 0.055, 0.3, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(TONE.ink, 0.6);
  ctx.lineWidth = 1;
  ctx.stroke();
  // 绳与桶
  const rope = s * 0.5;
  const bucket = { x: L.x, y: L.y + rope };
  ctx.strokeStyle = rgba(PAL.umber, 0.9);
  ctx.lineWidth = Math.max(0.7, s * 0.007);
  ctx.beginPath();
  ctx.moveTo(L.x, L.y);
  ctx.lineTo(bucket.x, bucket.y);
  ctx.stroke();
  ctx.fillStyle = woodDark;
  ctx.beginPath();
  ctx.moveTo(bucket.x - s * 0.05, bucket.y);
  ctx.lineTo(bucket.x + s * 0.05, bucket.y);
  ctx.lineTo(bucket.x + s * 0.04, bucket.y + s * 0.09);
  ctx.lineTo(bucket.x - s * 0.04, bucket.y + s * 0.09);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = PAL.umber;
  ctx.beginPath();
  ctx.arc(bucket.x, bucket.y, s * 0.045, Math.PI, TAU);
  ctx.stroke();
  // 井口：交叠的木框（井字）
  ctx.fillStyle = '#0f0a07';
  ctx.beginPath();
  ctx.ellipse(x, y - ch, cw * 0.42, ch * 0.18, 0, 0, TAU);
  ctx.fill();
  for (let k = 0; k < 3; k++) {
    const yy = y - ch + (k * ch) / 3;
    ctx.fillStyle = k % 2 ? woodDark : wood;
    ctx.fillRect(x - cw / 2 - (k % 2 ? s * 0.03 : 0), yy, cw + (k % 2 ? s * 0.06 : 0), ch / 3 - 0.8);
    ctx.fillStyle = rgba('#000000', 0.25);
    ctx.fillRect(x - cw / 2, yy + ch / 3 - 2, cw, 1.2);
    // 木头端头
    ctx.fillStyle = mix(wood, '#e0b080', 0.2);
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + sd * (cw / 2 + (k % 2 ? s * 0.03 : 0)), yy + ch / 6, s * 0.012, ch / 6 - 0.6, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  return { bucket, curb: { x, y: y - ch } };
}

// ============================================================
// 社树、社坛
// ============================================================

/** 社树：老树，枝如云团。(x,y) 根部中点，s 高；wither 0..1 叶子少而黄 */
export function sheTree(ctx: C2D, x: number, y: number, s: number, opts: { t?: number; wither?: number; night?: boolean } = {}) {
  const t = opts.t ?? 0;
  const wither = clamp(opts.wither ?? 0);
  const night = opts.night ?? false;
  const bark = night ? '#1c130d' : '#4a3424';
  ctx.save();
  // 干：粗、扭、带根
  ctx.fillStyle = bark;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.17, y);
  ctx.quadraticCurveTo(x - s * 0.08, y - s * 0.03, x - s * 0.07, y - s * 0.12);
  ctx.bezierCurveTo(x - s * 0.1, y - s * 0.3, x - s * 0.02, y - s * 0.38, x - s * 0.08, y - s * 0.5);
  ctx.lineTo(x - s * 0.02, y - s * 0.52);
  ctx.quadraticCurveTo(x + s * 0.02, y - s * 0.42, x + s * 0.03, y - s * 0.5);
  ctx.lineTo(x + s * 0.09, y - s * 0.49);
  ctx.bezierCurveTo(x + s * 0.05, y - s * 0.35, x + s * 0.1, y - s * 0.25, x + s * 0.07, y - s * 0.12);
  ctx.quadraticCurveTo(x + s * 0.08, y - s * 0.03, x + s * 0.19, y);
  ctx.closePath();
  ctx.fill();
  // 树皮纹与树洞
  ctx.strokeStyle = rgba('#000000', 0.35);
  ctx.lineWidth = Math.max(0.6, s * 0.006);
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.05 + k * s * 0.03, y - s * 0.02);
    ctx.bezierCurveTo(x - s * 0.08 + k * s * 0.03, y - s * 0.2, x + k * s * 0.02, y - s * 0.3, x - s * 0.02 + k * s * 0.02, y - s * 0.46);
    ctx.stroke();
  }
  ctx.fillStyle = '#0d0806';
  ctx.beginPath();
  ctx.ellipse(x + s * 0.005, y - s * 0.2, s * 0.022, s * 0.045, 0.1, 0, TAU);
  ctx.fill();
  // 系在树上的朱绳
  ctx.strokeStyle = PAL.cinnabar;
  ctx.lineWidth = Math.max(1, s * 0.01);
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.3, s * 0.085, s * 0.018, 0.05, 0.1, Math.PI - 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + s * 0.03, y - s * 0.285);
  ctx.quadraticCurveTo(x + s * 0.05 + Math.sin(t * 1.4) * s * 0.01, y - s * 0.24, x + s * 0.04, y - s * 0.2);
  ctx.stroke();
  // 枝
  ctx.strokeStyle = bark;
  ctx.lineCap = 'round';
  const branches: [number, number, number, number][] = [
    [-0.05, -0.5, -0.32, -0.72],
    [0.06, -0.49, 0.34, -0.7],
    [0, -0.5, -0.05, -0.88],
    [-0.15, -0.62, -0.42, -0.6],
    [0.2, -0.6, 0.45, -0.58],
  ];
  for (const [ax, ay, bx, by] of branches) {
    ctx.lineWidth = s * 0.028;
    ctx.beginPath();
    ctx.moveTo(x + ax * s, y + ay * s);
    ctx.quadraticCurveTo(x + (ax + bx) * 0.5 * s, y + (ay + by) * 0.5 * s - s * 0.06, x + bx * s, y + by * s);
    ctx.stroke();
  }
  // 冠：一团团云状的叶
  const r = rng(29);
  const leaf = mix(night ? '#141b17' : '#28352d', '#6b5532', wither * 0.8);
  const leafHi = mix(night ? '#1f2a23' : '#3a4b3f', '#8a6c3c', wither * 0.7);
  const blobs: [number, number, number][] = [
    [-0.32, -0.74, 0.15], [0.33, -0.72, 0.15], [-0.05, -0.9, 0.17], [-0.2, -0.86, 0.13], [0.15, -0.88, 0.14],
    [-0.44, -0.62, 0.11], [0.46, -0.6, 0.11], [0.02, -0.72, 0.13], [-0.16, -0.68, 0.1], [0.2, -0.7, 0.1],
  ];
  for (let i = 0; i < blobs.length; i++) {
    if (hash(i * 13 + 5) < wither * 0.6) continue;
    const [bx, by, br] = blobs[i]!;
    const sw = noise1(t * 0.35 + i * 0.7, 3) * s * 0.008;
    const cx = x + bx * s + sw;
    const cy = y + by * s;
    const rr = br * s * (1 - wither * 0.25);
    scallop(ctx, cx, cy, rr, leaf, r);
    scallop(ctx, cx - rr * 0.15, cy - rr * 0.2, rr * 0.62, leafHi, r);
    // 叶脉金点
    // 叶：细金/帛色的小人字笔，漆画里画叶的样子
    ctx.strokeStyle = rgba(night ? PAL.gold : PAL.silkDim, night ? 0.25 : 0.55);
    ctx.lineWidth = Math.max(0.5, s * 0.0035);
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = r() * TAU;
      const d = Math.sqrt(r()) * 0.6;
      const lx = cx + Math.cos(a) * rr * d;
      const ly = cy + Math.sin(a) * rr * d * 0.7;
      const ls = s * 0.012;
      ctx.moveTo(lx - ls, ly + ls * 0.7);
      ctx.lineTo(lx, ly);
      ctx.lineTo(lx + ls, ly + ls * 0.7);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function scallop(ctx: C2D, cx: number, cy: number, r: number, color: string, rnd: () => number) {
  const n = 7;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r * 0.72;
    if (i === 0) ctx.moveTo(px, py);
    else {
      const am = ((i - 0.5) / n) * TAU;
      ctx.quadraticCurveTo(cx + Math.cos(am) * r * (1.3 + rnd() * 0.08), cy + Math.sin(am) * r * 0.72 * 1.3, px, py);
    }
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * 社坛：从地里隆起的土台，立杆挂彩缯。(x,y) 底边中点，s 宽；grow 0..1。
 */
export function altar(ctx: C2D, x: number, y: number, s: number, opts: { grow?: number; t?: number } = {}) {
  const grow = clamp(opts.grow ?? 1);
  if (grow <= 0) return;
  const t = opts.t ?? 0;
  const g1 = easeOut(span(grow, 0, 0.5));
  const g1b = easeOut(span(grow, 0.2, 0.6));
  const g2 = easeOut(span(grow, 0.45, 0.85));
  const g3 = easeOut(span(grow, 0.7, 1));
  const h1 = s * 0.14 * g1;
  const h2 = s * 0.1 * g1b;
  ctx.save();
  const tier = (w: number, base: number, h: number) => {
    if (h <= 0.3) return;
    ctx.fillStyle = mix(PAL.loess, PAL.umber, 0.25);
    ctx.fillRect(x - w / 2, base - h, w, h);
    ctx.fillStyle = TONE.loessLight;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, base - h);
    ctx.lineTo(x - w / 2 + h * 0.4, base - h - h * 0.25);
    ctx.lineTo(x + w / 2 - h * 0.4, base - h - h * 0.25);
    ctx.lineTo(x + w / 2, base - h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(PAL.umber, 0.3);
    for (let yy = base - h + 3; yy < base; yy += 4) ctx.fillRect(x - w / 2, yy, w, 0.8);
    ctx.strokeStyle = rgba(TONE.ink, 0.5);
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x - w / 2, base - h, w, h);
  };
  tier(s, y, h1);
  tier(s * 0.6, y - h1, h2);
  const topY = y - h1 - h2;
  // 社主：一块立石
  if (g2 > 0) {
    ctx.fillStyle = '#7a7266';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.12 - s * 0.04, topY);
    ctx.quadraticCurveTo(x + s * 0.11, topY - s * 0.2 * g2, x + s * 0.13 + s * 0.04, topY);
    ctx.closePath();
    ctx.fill();
  }
  // 杆与彩缯
  if (g2 > 0) {
    const ph = s * 0.85 * g2;
    ctx.strokeStyle = '#4a3220';
    ctx.lineWidth = Math.max(1.2, s * 0.018);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.05, topY);
    ctx.lineTo(x - s * 0.05, topY - ph);
    ctx.stroke();
    if (g3 > 0) {
      const cols = [PAL.cinnabar, PAL.millet, PAL.silk, PAL.ochre];
      for (let i = 0; i < cols.length; i++) {
        const sx = x - s * 0.05;
        const sy = topY - ph + i * s * 0.035;
        const len = s * (0.32 - i * 0.03) * g3;
        const pts: Pt[] = [];
        for (let k = 0; k <= 8; k++) {
          const u = k / 8;
          pts.push({ x: sx + u * len, y: sy + Math.sin(u * 5 - t * 4 + i) * s * 0.025 * u + u * len * 0.15 });
        }
        ctx.fillStyle = cols[i]!;
        ribbon(ctx, pts, (u) => s * 0.03 * (1 - u * 0.4));
      }
    }
  }
  ctx.restore();
  return { top: topY };
}

// ============================================================
// 田伯家的门楼
// ============================================================

const crowdFigs: Figure[] = [];
function crowdFig(i: number): Figure {
  if (!crowdFigs[i]) {
    const kinds: FigureKind[] = ['neighbor', 'neighbor', 'wife', 'child', 'neighbor', 'mother', 'neighbor', 'neighbor'];
    const robes = [undefined, '#7a5f45', undefined, undefined, '#957452', undefined, '#6d5a48', '#8a6a45'];
    const f = makeFigure(kinds[i % kinds.length]!, { seed: i * 3.1, robe: robes[i % robes.length], pose: i % 3 === 1 ? 'look-up' : 'stand' });
    crowdFigs[i] = f;
  }
  return crowdFigs[i]!;
}

/**
 * 田伯家：高墙、门楼、双扇门与铜铺首。(x,y) 门底中点，s 门楼全高。
 * open 0..1 门开；knock 0..1 叩门的震动（叩一下给 1，自己衰减）；crowd 0..1 门口聚来的乡邻；light 门缝的光。
 */
export function gate(ctx: C2D, x: number, y: number, s: number, opts: { open?: number; knock?: number; crowd?: number; t?: number; hover?: number; night?: boolean; walls?: boolean } = {}) {
  const t = opts.t ?? 0;
  const night = opts.night ?? false;
  const dw = s * 0.44;
  const dh = s * 0.5;
  const wallH = s * 0.46;
  const wallW = s * 0.9;
  if (opts.walls !== false) {
    wall(ctx, x - dw / 2 - wallW / 2, y, wallW, wallH, { night, seed: 3 });
    wall(ctx, x + dw / 2 + wallW / 2, y, wallW, wallH, { night, seed: 4 });
  }
  // 门楼身
  const body = mix(night ? TONE.wallNight : PAL.loess, PAL.umber, 0.12);
  ctx.fillStyle = body;
  ctx.fillRect(x - dw / 2 - s * 0.08, y - s * 0.7, dw + s * 0.16, s * 0.7);
  ctx.strokeStyle = rgba(TONE.ink, 0.5);
  ctx.lineWidth = 1;
  ctx.strokeRect(x - dw / 2 - s * 0.08, y - s * 0.7, dw + s * 0.16, s * 0.7);
  // 朱柱
  ctx.fillStyle = night ? '#3a140d' : TONE.cinnabarDark;
  ctx.fillRect(x - dw / 2 - s * 0.06, y - s * 0.68, s * 0.05, s * 0.68);
  ctx.fillRect(x + dw / 2 + s * 0.01, y - s * 0.68, s * 0.05, s * 0.68);
  // 门
  const res = door(ctx, x, y, dw, dh, { open: opts.open, hover: opts.hover, knock: opts.knock, t, night });
  // 门额
  ctx.fillStyle = PAL.lacquer2;
  ctx.fillRect(x - dw * 0.3, y - dh - s * 0.12, dw * 0.6, s * 0.08);
  ctx.strokeStyle = rgba(PAL.gold, 0.6);
  ctx.lineWidth = 0.9;
  ctx.strokeRect(x - dw * 0.3 + 2, y - dh - s * 0.12 + 2, dw * 0.6 - 4, s * 0.08 - 4);
  // 斗拱
  ctx.fillStyle = PAL.lacquer2;
  for (const sd of [-1, 1]) {
    const bx = x + sd * (dw / 2 + s * 0.03);
    ctx.fillRect(bx - s * 0.05, y - s * 0.76, s * 0.1, s * 0.03);
    ctx.fillRect(bx - s * 0.025, y - s * 0.73, s * 0.05, s * 0.04);
  }
  // 屋顶：黑瓦、檐角上翘、正脊两端起翘
  const ry = y - s * 0.76;
  const ew = dw / 2 + s * 0.42;
  ctx.fillStyle = night ? '#0c0908' : PAL.lacquer2;
  ctx.beginPath();
  ctx.moveTo(x - ew, ry - s * 0.06);
  ctx.quadraticCurveTo(x - ew * 0.7, ry + s * 0.01, x - ew * 0.3, ry);
  ctx.lineTo(x + ew * 0.3, ry);
  ctx.quadraticCurveTo(x + ew * 0.7, ry + s * 0.01, x + ew, ry - s * 0.06);
  ctx.quadraticCurveTo(x + ew * 0.6, ry - s * 0.08, x + ew * 0.45, ry - s * 0.2);
  ctx.lineTo(x - ew * 0.45, ry - s * 0.2);
  ctx.quadraticCurveTo(x - ew * 0.6, ry - s * 0.08, x - ew, ry - s * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = rgba(night ? '#3a2a20' : '#5a3d2b', 0.8);
  ctx.lineWidth = 1;
  for (let k = -12; k <= 12; k++) {
    ctx.beginPath();
    ctx.moveTo(x + k * ew * 0.06, ry - s * 0.2);
    ctx.lineTo(x + k * ew * 0.09, ry + 2);
    ctx.stroke();
  }
  ctx.restore();
  // 正脊
  ctx.fillStyle = night ? '#060403' : PAL.lacquer;
  ctx.beginPath();
  ctx.moveTo(x - ew * 0.5, ry - s * 0.19);
  ctx.lineTo(x + ew * 0.5, ry - s * 0.19);
  ctx.lineTo(x + ew * 0.56, ry - s * 0.27);
  ctx.quadraticCurveTo(x + ew * 0.5, ry - s * 0.23, x + ew * 0.46, ry - s * 0.235);
  ctx.lineTo(x - ew * 0.46, ry - s * 0.235);
  ctx.quadraticCurveTo(x - ew * 0.5, ry - s * 0.23, x - ew * 0.56, ry - s * 0.27);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(PAL.gold, 0.5);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x - ew, ry - s * 0.06);
  ctx.quadraticCurveTo(x - ew * 0.7, ry + s * 0.01, x - ew * 0.3, ry);
  ctx.lineTo(x + ew * 0.3, ry);
  ctx.quadraticCurveTo(x + ew * 0.7, ry + s * 0.01, x + ew, ry - s * 0.06);
  ctx.stroke();
  // 门口的人
  const crowd = clamp(opts.crowd ?? 0);
  if (crowd > 0) {
    const spots = [-0.62, 0.62, -0.82, 0.86, -1.02, 1.08, -0.46, 0.48];
    for (let i = 0; i < spots.length; i++) {
      const k = clamp(crowd * spots.length - i);
      if (k <= 0) break;
      const f = crowdFig(i);
      f.facing = spots[i]! < 0 ? 1 : -1;
      f.onDark = night;
      ctx.save();
      ctx.globalAlpha *= k;
      f.draw(ctx, x + spots[i]! * s + (1 - k) * spots[i]! * s * 0.3, y + s * 0.02, s * 0.42, t);
      ctx.restore();
    }
  }
  return { ...res, top: ry - s * 0.27 };
}

// ============================================================
// 路、柳、远山
// ============================================================

/** 柳：短干，长枝垂下，随风。(x,y) 根部中点，s 高 */
export function willow(ctx: C2D, x: number, y: number, s: number, opts: { t?: number; wither?: number; night?: boolean } = {}) {
  const t = opts.t ?? 0;
  const wither = clamp(opts.wither ?? 0);
  const bark = opts.night ? '#1c130d' : '#4a3424';
  ctx.save();
  ctx.fillStyle = bark;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.06, y);
  ctx.quadraticCurveTo(x - s * 0.02, y - s * 0.3, x - s * 0.05, y - s * 0.55);
  ctx.lineTo(x + s * 0.04, y - s * 0.56);
  ctx.quadraticCurveTo(x + s * 0.03, y - s * 0.3, x + s * 0.07, y);
  ctx.closePath();
  ctx.fill();
  // 冠顶的枝杈
  ctx.strokeStyle = bark;
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.02;
  const tops: Pt[] = [];
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.32;
    const ex = x + Math.cos(a) * s * 0.3;
    const ey = y - s * 0.55 + Math.sin(a) * s * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.55);
    ctx.quadraticCurveTo((x + ex) / 2, ey - s * 0.02, ex, ey);
    ctx.stroke();
    tops.push({ x: ex, y: ey });
  }
  // 垂枝
  const col = mix(opts.night ? '#2a3a30' : '#6c7d4e', TONE.straw, wither);
  ctx.strokeStyle = rgba(col, 0.85);
  ctx.lineWidth = Math.max(0.6, s * 0.006);
  const r = rng(61);
  for (let i = 0; i < 46; i++) {
    const o = tops[i % tops.length]!;
    const ox = o.x + (r() - 0.5) * s * 0.2;
    const oy = o.y + r() * s * 0.08;
    const len = s * (0.35 + r() * 0.4) * (1 - wither * 0.3);
    const sw = noise1(t * 0.5 + i * 0.15, 4) * s * 0.06;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.quadraticCurveTo(ox + (ox - x) * 0.25, oy + len * 0.2, ox + (ox - x) * 0.15 + sw, oy + len);
    ctx.stroke();
  }
  ctx.restore();
}

/** 远山：地平线上的几道淡影。(x,y) 为左端地平线，w 宽，h 最高 */
export function hills(ctx: C2D, x: number, y: number, w: number, h: number, opts: { seed?: number; color?: string; alpha?: number } = {}) {
  const seed = opts.seed ?? 4;
  const col = opts.color ?? mix(PAL.silkDim, PAL.bronze, 0.25);
  for (let layer = 0; layer < 2; layer++) {
    const a = (opts.alpha ?? 0.6) * (layer ? 0.75 : 0.4);
    ctx.fillStyle = rgba(layer ? mix(col, PAL.umber, 0.25) : col, a);
    ctx.beginPath();
    ctx.moveTo(x, y);
    const n = Math.max(12, Math.round(w / 8));
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const env = Math.sin(Math.PI * u) ** 0.6;
      const v = 0.55 + 0.3 * noise1(u * 5 + layer * 9, seed) + 0.15 * noise1(u * 17, seed + 3);
      ctx.lineTo(x + u * w, y - h * env * v * (layer ? 0.55 : 1));
    }
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * 往莒的路：从脚下宽处收向地平线的消失点，路边一棵柳。(x,y) 为路在近处的中点，w 区域宽，h 到地平线的高。
 * 返回消失点。
 */
export function road(ctx: C2D, x: number, y: number, w: number, h: number, opts: { t?: number; willow?: boolean; night?: boolean; wither?: number } = {}) {
  const t = opts.t ?? 0;
  const vp = { x: x + w * 0.42, y: y - h };
  hills(ctx, vp.x - w * 0.35, vp.y + 1, w * 0.6, h * 0.35, { seed: 9, alpha: opts.night ? 0.35 : 0.55, color: opts.night ? '#1d1a1a' : undefined });
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - w * 0.22, y);
  ctx.bezierCurveTo(x - w * 0.05, y - h * 0.45, vp.x - w * 0.25, vp.y + h * 0.15, vp.x - 1.5, vp.y);
  ctx.lineTo(vp.x + 1.5, vp.y);
  ctx.bezierCurveTo(vp.x - w * 0.12, vp.y + h * 0.2, x + w * 0.18, y - h * 0.4, x + w * 0.12, y);
  ctx.closePath();
  ctx.fillStyle = opts.night ? '#3a2b20' : mix(PAL.loess, PAL.silk, 0.35);
  ctx.fill();
  // 车辙
  ctx.strokeStyle = rgba(PAL.umber, 0.3);
  ctx.lineWidth = 1;
  for (const k of [0.35, 0.65]) {
    ctx.beginPath();
    ctx.moveTo(lerp(x - w * 0.22, x + w * 0.12, k), y);
    ctx.bezierCurveTo(lerp(x - w * 0.05, x + w * 0.18, k), y - h * 0.43, lerp(vp.x - w * 0.25, vp.x - w * 0.12, k), vp.y + h * 0.17, vp.x, vp.y);
    ctx.stroke();
  }
  ctx.restore();
  if (opts.willow !== false) willow(ctx, x - w * 0.3, y - h * 0.08, h * 1.25, { t, night: opts.night, wither: opts.wither });
  return { vanish: vp };
}
