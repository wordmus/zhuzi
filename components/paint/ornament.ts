// 纹饰与笔：毛笔笔画、云纹、菱纹、蟠螭、青铜边框、画出来的字（旱、禾）、朱印。

import { PAL, TONE } from './palette';
import { cached } from './texture';
import { type C2D, type Pt, TAU, clamp, deviceScale, easeOut, lerp, rgba, rng, sampleSpline, span } from './util';

// ============================================================
// 笔：变宽的带子
// ============================================================

/** 沿折线铺一条变宽带子。widthAt(u) 给出 u∈[0,1] 处的宽度；只画到 progress */
export function ribbon(ctx: C2D, pts: Pt[], widthAt: (u: number) => number, progress = 1) {
  const n = pts.length;
  if (n < 2 || progress <= 0) return;
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  const L = cum[n - 1]!;
  if (L <= 0) return;
  const end = L * clamp(progress);
  const left: Pt[] = [];
  const right: Pt[] = [];
  let last: Pt | null = null;
  let lastN: Pt = { x: 0, y: -1 };
  for (let i = 0; i < n; i++) {
    let p = pts[i]!;
    let stop = false;
    if (cum[i]! > end) {
      const a = pts[i - 1]!;
      const k = (end - cum[i - 1]!) / Math.max(1e-6, cum[i]! - cum[i - 1]!);
      p = { x: lerp(a.x, p.x, k), y: lerp(a.y, p.y, k) };
      stop = true;
    }
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(n - 1, i + 1)]!;
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d > 1e-6) {
      dx /= d;
      dy /= d;
      lastN = { x: -dy, y: dx };
    }
    const u = (stop ? end : cum[i]!) / L;
    const w = widthAt(u) / 2;
    left.push({ x: p.x + lastN.x * w, y: p.y + lastN.y * w });
    right.push({ x: p.x - lastN.x * w, y: p.y - lastN.y * w });
    last = p;
    if (stop) break;
  }
  ctx.beginPath();
  ctx.moveTo(left[0]!.x, left[0]!.y);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i]!.x, left[i]!.y);
  // 笔头圆
  if (last) {
    const wEnd = widthAt(end / L) / 2;
    const r0 = right[right.length - 1]!;
    ctx.lineTo(r0.x, r0.y);
    ctx.arc(last.x, last.y, Math.max(0.01, wEnd), Math.atan2(r0.y - last.y, r0.x - last.x), Math.atan2(r0.y - last.y, r0.x - last.x) + Math.PI, true);
  }
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i]!.x, right[i]!.y);
  const w0 = widthAt(0) / 2;
  ctx.arc(pts[0]!.x, pts[0]!.y, Math.max(0.01, w0), Math.atan2(right[0]!.y - pts[0]!.y, right[0]!.x - pts[0]!.x), Math.atan2(right[0]!.y - pts[0]!.y, right[0]!.x - pts[0]!.x) + Math.PI);
  ctx.closePath();
  ctx.fill();
}

export type BrushProfile = 'brush' | 'needle' | 'even' | 'cloud' | 'press';

function profile(kind: BrushProfile): (u: number) => number {
  switch (kind) {
    case 'even':
      return () => 1;
    case 'cloud':
      return (u) => 0.18 + 0.82 * Math.sin(Math.PI * Math.pow(u, 0.8)) ** 0.7 * (1 - u * 0.45);
    case 'needle':
      return (u) => (u < 0.08 ? 0.95 + 0.25 * Math.sin((u / 0.08) * Math.PI) : 1 - Math.pow(span(u, 0.55, 1), 1.4) * 0.92);
    case 'press':
      return (u) => (u < 0.08 ? 0.95 + 0.25 * Math.sin((u / 0.08) * Math.PI) : u > 0.85 ? 0.9 + 0.3 * Math.sin(span(u, 0.85, 1) * Math.PI) : 0.88);
    default:
      // 起笔顿、行笔略细、收笔回锋
      return (u) => (u < 0.1 ? 0.9 + 0.3 * Math.sin((u / 0.1) * Math.PI) : u > 0.82 ? 0.85 * (1 - span(u, 0.82, 1) * 0.55) : 0.85 + 0.05 * Math.sin(u * 9));
  }
}

/**
 * 毛笔一笔：points 为笔画骨架（≥2 点，3 点以上自动平滑），width 为笔宽，progress 0..1 可做「正在写」的动画。
 * opts.corner=true：骨架是折线（横折），不平滑。
 */
export function brushStroke(ctx: C2D, points: Pt[], width: number, color: string = TONE.ink, progress = 1, opts: { profile?: BrushProfile; corner?: boolean; bleed?: number } = {}) {
  if (progress <= 0 || points.length < 2) return;
  const pts = opts.corner || points.length < 3 ? densify(points, width * 0.6) : sampleSpline(points, 10);
  const prof = profile(opts.profile ?? 'brush');
  ctx.save();
  const bleed = opts.bleed ?? 0.16;
  if (bleed > 0) {
    ctx.fillStyle = rgba(color, bleed);
    ribbon(ctx, pts, (u) => prof(u) * width * 1.28, progress);
  }
  ctx.fillStyle = color;
  ribbon(ctx, pts, (u) => prof(u) * width, progress);
  ctx.restore();
}

function densify(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const k = Math.max(1, Math.ceil(d / Math.max(0.5, step)));
    for (let j = 1; j <= k; j++) out.push({ x: lerp(a.x, b.x, j / k), y: lerp(a.y, b.y, j / k) });
  }
  return out;
}

// ============================================================
// 云纹
// ============================================================

/** 一枚云纹的骨架（单位尺寸约 2×1，中心在原点）：尾端反卷、S 形的身、头上大卷 */
function cloudSkeleton(seed: number): { main: Pt[]; hook: Pt[] } {
  const r = rng(seed * 31 + 7);
  const hr = 0.27 + r() * 0.07;
  const hc = { x: 0.58, y: -0.06 - r() * 0.06 };
  const tr = 0.12 + r() * 0.04;
  const tc = { x: -0.86, y: 0.16 + r() * 0.06 };
  const main: Pt[] = [];
  // 尾卷：由内向外，收在顶上向右走
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    const a = -Math.PI / 2 - (1 - k) * TAU * 0.85;
    const rr = tr * (0.25 + 0.75 * k);
    main.push({ x: tc.x + Math.cos(a) * rr, y: tc.y + Math.sin(a) * rr });
  }
  // 身：S 形
  main.push({ x: -0.55, y: tc.y - tr * 0.9 + 0.02 }, { x: -0.22, y: 0.18 + r() * 0.06 }, { x: 0.18, y: 0.3 }, { x: hc.x - hr * 0.25, y: hc.y + hr * 1.02 });
  // 头卷：由外向内 1.5 圈
  for (let i = 0; i <= 18; i++) {
    const k = i / 18;
    const a = Math.PI / 2 - k * TAU * 1.45;
    const rr = hr * Math.exp(-k * 1.25);
    main.push({ x: hc.x + Math.cos(a) * rr, y: hc.y + Math.sin(a) * rr });
  }
  // 身上挑起的一个小钩（像火苗）
  const hx = -0.3 + r() * 0.12;
  const hook: Pt[] = [
    { x: hx - 0.04, y: 0.16 },
    { x: hx + 0.02, y: -0.06 },
    { x: hx + 0.14, y: -0.2 },
    { x: hx + 0.26, y: -0.16 },
    { x: hx + 0.24, y: -0.06 },
    { x: hx + 0.15, y: -0.08 },
  ];
  return { main, hook };
}

/**
 * 一枚云纹（金线）。(x,y) 为中心，size 为宽度的一半；progress 可做「描出来」的动画。
 * flip=-1 左右翻转；rotate 弧度。
 */
export function cloudScroll(ctx: C2D, x: number, y: number, size: number, opts: { color?: string; width?: number; progress?: number; flip?: 1 | -1; seed?: number; rotate?: number; alpha?: number } = {}) {
  const color = opts.color ?? PAL.gold;
  const progress = opts.progress ?? 1;
  const seed = opts.seed ?? 1;
  const lw = opts.width ?? 0.09;
  const flip = opts.flip ?? 1;
  const dpr = deviceScale(ctx);
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.translate(x, y);
  if (opts.rotate) ctx.rotate(opts.rotate);
  ctx.scale(size * flip, size);
  if (progress >= 1 && size * dpr < 160) {
    // 完整的云纹走贴图
    const px = Math.max(8, Math.round(size));
    const c = cached(`cloud:${seed}:${color}:${lw}`, px * 2.4, px * 1.2, dpr, (g, w, h) => {
      g.translate(w / 2, h / 2);
      g.scale(px, px);
      drawCloud(g, seed, color, lw, 1);
    });
    ctx.drawImage(c, -1.2, -0.6, 2.4, 1.2);
  } else {
    drawCloud(ctx, seed, color, lw, progress);
  }
  ctx.restore();
}

function drawCloud(ctx: C2D, seed: number, color: string, lw: number, progress: number) {
  const { main, hook } = cloudSkeleton(seed);
  ctx.fillStyle = color;
  const m = sampleSpline(main, 5);
  ribbon(ctx, m, (u) => lw * (0.22 + 0.78 * Math.sin(Math.PI * clamp(u * 1.15 - 0.05)) ** 0.7), progress);
  if (progress > 0.5) ribbon(ctx, sampleSpline(hook, 6), (u) => lw * 0.75 * (1 - u * 0.75), span(progress, 0.5, 1));
}

/**
 * 云纹带：在矩形里铺满流动的云纹（可横向漂移 drift 像素，自动循环）。
 * 适合夜空、漆面装饰、边框里衬。
 */
export function cloudBand(ctx: C2D, x: number, y: number, w: number, h: number, opts: { color?: string; alpha?: number; seed?: number; drift?: number; density?: number; size?: number } = {}) {
  const color = opts.color ?? PAL.gold;
  const seed = opts.seed ?? 1;
  const density = opts.density ?? 1;
  const size = opts.size ?? Math.min(h * 0.32, 60);
  const dpr = deviceScale(ctx);
  const c = cached(`cband:${seed}:${color}:${density}:${Math.round(size)}`, w, h, dpr, (g) => {
    const r = rng(seed * 17 + 3);
    const n = Math.max(2, Math.round(((w * h) / (size * size * 9)) * density));
    for (let i = 0; i < n; i++) {
      const cx = r() * w;
      const cy = size * 0.6 + r() * Math.max(1, h - size * 1.2);
      const s = size * (0.55 + r() * 0.6);
      const f = r() < 0.5 ? 1 : -1;
      const sd = Math.floor(r() * 50);
      for (const ox of [0, -w, w]) cloudScroll(g, cx + ox, cy, s, { color, seed: sd, flip: f as 1 | -1, width: 0.09 });
    }
  });
  const d = (((opts.drift ?? 0) % w) + w) % w;
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(c, x + d, y, w, h);
  ctx.drawImage(c, x + d - w, y, w, h);
  ctx.restore();
}

// ============================================================
// 青铜纹带与边框
// ============================================================

export type BandPattern = 'lozenge' | 'panchi' | 'cloud';

/** 一条纹带（横向）：菱纹 / 蟠螭 / 云纹，青铜底金线 */
export function bronzeBand(ctx: C2D, x: number, y: number, w: number, h: number, opts: { pattern?: BandPattern; base?: string; line?: string; seed?: number } = {}) {
  const pattern = opts.pattern ?? 'lozenge';
  const base = opts.base ?? TONE.bronzeDark;
  const line = opts.line ?? PAL.gold;
  const dpr = deviceScale(ctx);
  const c = cached(`band:${pattern}:${base}:${line}:${opts.seed ?? 0}`, w, h, dpr, (g) => paintBand(g, w, h, pattern, base, line, opts.seed ?? 0));
  ctx.drawImage(c, x, y, w, h);
}

function paintBand(g: C2D, w: number, h: number, pattern: BandPattern, base: string, line: string, seed: number) {
  const r = rng(seed + 99);
  // 青铜底：微斑驳
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < (w * h) / 60; i++) {
    g.fillStyle = r() < 0.5 ? rgba(TONE.patina, 0.08 + r() * 0.1) : rgba('#000000', 0.12);
    const s = 0.6 + r() * 2;
    g.fillRect(r() * w, r() * h, s, s);
  }
  const lw = Math.max(0.7, h * 0.045);
  g.strokeStyle = line;
  g.fillStyle = line;
  g.lineWidth = lw;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // 上下边线
  g.globalAlpha = 0.9;
  g.fillRect(0, lw * 0.8, w, lw);
  g.fillRect(0, h - lw * 1.8, w, lw);
  const top = lw * 2.6;
  const bot = h - lw * 2.6;
  const mid = (top + bot) / 2;
  const bh = bot - top;
  if (pattern === 'lozenge') {
    // 菱纹：连续的大菱形套小菱形，中间折线相连
    const cw = bh * 1.9;
    for (let cx = cw / 2 - ((w % cw) / 2); cx < w + cw; cx += cw) {
      g.beginPath();
      g.moveTo(cx - cw / 2, mid);
      g.lineTo(cx, top);
      g.lineTo(cx + cw / 2, mid);
      g.lineTo(cx, bot);
      g.closePath();
      g.stroke();
      g.beginPath();
      g.moveTo(cx - cw * 0.22, mid);
      g.lineTo(cx, mid - bh * 0.24);
      g.lineTo(cx + cw * 0.22, mid);
      g.lineTo(cx, mid + bh * 0.24);
      g.closePath();
      g.stroke();
      g.beginPath();
      g.arc(cx, mid, lw * 0.9, 0, TAU);
      g.fill();
      // 半菱的折角
      g.beginPath();
      g.moveTo(cx + cw * 0.5 - cw * 0.12, top);
      g.lineTo(cx + cw * 0.5, mid - bh * 0.18);
      g.lineTo(cx + cw * 0.5 + cw * 0.12, top);
      g.moveTo(cx + cw * 0.5 - cw * 0.12, bot);
      g.lineTo(cx + cw * 0.5, mid + bh * 0.18);
      g.lineTo(cx + cw * 0.5 + cw * 0.12, bot);
      g.stroke();
    }
  } else if (pattern === 'panchi') {
    // 蟠螭：S 形卷曲两两相交，正反交替
    const cw = bh * 1.5;
    let i = 0;
    for (let cx = cw / 2; cx < w + cw; cx += cw, i++) {
      const f = i % 2 ? 1 : -1;
      g.save();
      g.translate(cx, mid);
      g.scale(f, 1);
      g.beginPath();
      const s = bh * 0.42;
      // S 曲线
      g.moveTo(-cw * 0.55, s * 0.6);
      g.bezierCurveTo(-cw * 0.2, s * 1.2, -cw * 0.1, -s * 1.2, cw * 0.3, -s * 0.5);
      g.stroke();
      // 两端卷
      g.beginPath();
      g.arc(cw * 0.3, -s * 0.15, s * 0.35, -Math.PI / 2, Math.PI * 0.9);
      g.stroke();
      g.beginPath();
      g.arc(-cw * 0.45, s * 0.25, s * 0.3, Math.PI * 0.5, Math.PI * 1.9);
      g.stroke();
      // 螭眼
      g.beginPath();
      g.arc(cw * 0.05, -s * 0.05, lw * 0.9, 0, TAU);
      g.fill();
      // 鳞点
      g.globalAlpha = 0.55;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(-cw * 0.25 + k * cw * 0.18, s * (0.75 - k * 0.5), lw * 0.5, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 0.9;
      g.restore();
    }
  } else {
    const n = Math.max(2, Math.round(w / (bh * 2.2)));
    for (let k = 0; k < n; k++) {
      const cx = ((k + 0.5) / n) * w;
      cloudScroll(g, cx, mid, bh * 0.75, { color: line, seed: k % 7, flip: k % 2 ? 1 : -1, width: 0.09 });
    }
  }
  g.globalAlpha = 1;
}

/**
 * 青铜边框：四边纹带 + 金线 + 四角涡纹。(x,y,w,h) 为外框；band 为纹带宽。
 */
export function bronzeBorder(ctx: C2D, x: number, y: number, w: number, h: number, opts: { band?: number; pattern?: BandPattern; base?: string; line?: string } = {}) {
  const band = opts.band ?? Math.max(10, Math.min(w, h) * 0.045);
  const pattern = opts.pattern ?? 'lozenge';
  const base = opts.base ?? TONE.bronzeDark;
  const line = opts.line ?? PAL.gold;
  const dpr = deviceScale(ctx);
  const c = cached(`border:${pattern}:${base}:${line}:${Math.round(band)}`, w, h, dpr, (g) => {
    // 横带
    bronzeBand(g, 0, 0, w, band, { pattern, base, line });
    bronzeBand(g, 0, h - band, w, band, { pattern, base, line, seed: 1 });
    // 竖带：旋转画
    for (const [sx, sd] of [[0, 2], [w - band, 3]] as const) {
      g.save();
      g.translate(sx + band, band);
      g.rotate(Math.PI / 2);
      bronzeBand(g, 0, 0, h - band * 2, band, { pattern, base, line, seed: sd });
      g.restore();
    }
    // 角：方块 + 涡纹
    for (const [cx, cy] of [[0, 0], [w - band, 0], [0, h - band], [w - band, h - band]] as const) {
      g.fillStyle = base;
      g.fillRect(cx, cy, band, band);
      g.strokeStyle = line;
      g.lineWidth = Math.max(0.8, band * 0.06);
      g.strokeRect(cx + band * 0.12, cy + band * 0.12, band * 0.76, band * 0.76);
      g.beginPath();
      const m = band / 2;
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * TAU * 1.5;
        const rr = band * 0.3 * (1 - i / 30);
        if (i === 0) g.moveTo(cx + m + Math.cos(a) * rr, cy + m + Math.sin(a) * rr);
        else g.lineTo(cx + m + Math.cos(a) * rr, cy + m + Math.sin(a) * rr);
      }
      g.stroke();
    }
    // 内外金线
    g.strokeStyle = rgba(line, 0.85);
    g.lineWidth = Math.max(0.7, band * 0.05);
    g.strokeRect(band + 2.5, band + 2.5, w - band * 2 - 5, h - band * 2 - 5);
    g.lineWidth = Math.max(0.6, band * 0.035);
    g.strokeRect(0.6, 0.6, w - 1.2, h - 1.2);
  });
  ctx.drawImage(c, x, y, w, h);
}

// ============================================================
// 画出来的字：旱、禾（篆意 / 毛笔），不依赖字体
// ============================================================

interface GlyphStroke {
  pts: [number, number][];
  corner?: boolean;
  prof?: BrushProfile;
}
type GlyphDef = { brush: GlyphStroke[]; seal: GlyphStroke[] };

const GLYPHS: Record<string, GlyphDef> = {
  旱: {
    brush: [
      { pts: [[0.3, 0.08], [0.305, 0.44]], prof: 'press' },
      { pts: [[0.3, 0.08], [0.7, 0.075], [0.69, 0.44]], corner: true, prof: 'press' },
      { pts: [[0.32, 0.255], [0.67, 0.25]], prof: 'brush' },
      { pts: [[0.32, 0.425], [0.67, 0.42]], prof: 'brush' },
      { pts: [[0.26, 0.565], [0.74, 0.555]], prof: 'brush' },
      { pts: [[0.08, 0.745], [0.5, 0.73], [0.92, 0.735]], prof: 'brush' },
      { pts: [[0.5, 0.56], [0.5, 0.99]], prof: 'needle' },
    ],
    seal: [
      { pts: [[0.29, 0.44], [0.29, 0.12], [0.31, 0.075], [0.36, 0.06], [0.64, 0.06], [0.69, 0.075], [0.71, 0.12], [0.71, 0.44]] },
      { pts: [[0.29, 0.44], [0.71, 0.44]], corner: true },
      { pts: [[0.29, 0.25], [0.71, 0.25]], corner: true },
      { pts: [[0.22, 0.5], [0.26, 0.6], [0.37, 0.655], [0.5, 0.665], [0.63, 0.655], [0.74, 0.6], [0.78, 0.5]] },
      { pts: [[0.2, 0.79], [0.8, 0.79]], corner: true },
      { pts: [[0.5, 0.665], [0.5, 0.97]], corner: true },
    ],
  },
  禾: {
    brush: [
      { pts: [[0.66, 0.06], [0.52, 0.13], [0.36, 0.17]], prof: 'needle' },
      { pts: [[0.18, 0.37], [0.82, 0.355]], prof: 'brush' },
      { pts: [[0.5, 0.16], [0.5, 0.98]], prof: 'press' },
      { pts: [[0.48, 0.4], [0.36, 0.58], [0.14, 0.76]], prof: 'needle' },
      { pts: [[0.53, 0.42], [0.68, 0.56], [0.86, 0.68]], prof: 'press' },
    ],
    seal: [
      { pts: [[0.5, 0.97], [0.5, 0.3], [0.48, 0.16], [0.4, 0.08], [0.3, 0.1]] },
      { pts: [[0.5, 0.3], [0.36, 0.36], [0.22, 0.34]] },
      { pts: [[0.5, 0.3], [0.64, 0.36], [0.78, 0.34]] },
      { pts: [[0.5, 0.5], [0.34, 0.64], [0.2, 0.68]] },
      { pts: [[0.5, 0.5], [0.66, 0.64], [0.8, 0.68]] },
    ],
  },
};

/** 可画的字 */
export const GLYPH_CHARS = Object.keys(GLYPHS);

/**
 * 画一个字。(x,y) 为字框中心，size 为字框边长。style：'brush' 毛笔楷意 / 'seal' 篆意等粗。
 * progress 0..1 按笔顺写出来。
 */
export function drawGlyph(ctx: C2D, ch: string, x: number, y: number, size: number, opts: { color?: string; progress?: number; style?: 'brush' | 'seal'; weight?: number } = {}) {
  const def = GLYPHS[ch];
  if (!def) return;
  const style = opts.style ?? 'brush';
  const strokes = def[style];
  const color = opts.color ?? TONE.ink;
  const progress = clamp(opts.progress ?? 1);
  const weight = opts.weight ?? 1;
  // 按笔画长度分配进度
  const lens = strokes.map((s) => {
    let l = 0;
    for (let i = 1; i < s.pts.length; i++) l += Math.hypot(s.pts[i]![0] - s.pts[i - 1]![0], s.pts[i]![1] - s.pts[i - 1]![1]);
    return l + 0.12; // 笔与笔之间的停顿
  });
  const total = lens.reduce((a, b) => a + b, 0);
  let acc = 0;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  for (let i = 0; i < strokes.length; i++) {
    const s = strokes[i]!;
    const p = clamp((progress * total - acc) / (lens[i]! - 0.12));
    acc += lens[i]!;
    if (p <= 0) break;
    const pts = s.pts.map(([px, py]) => ({ x: px * size, y: py * size }));
    if (style === 'seal') {
      brushStroke(ctx, pts, size * 0.075 * weight, color, p, { profile: 'even', corner: s.corner, bleed: 0.1 });
    } else {
      brushStroke(ctx, pts, size * 0.1 * weight, color, p, { profile: s.prof ?? 'brush', corner: s.corner, bleed: 0.18 });
    }
  }
  ctx.restore();
}

/** 「旱」字：drawGlyph 的简写 */
export function drawGlyphHan(ctx: C2D, x: number, y: number, size: number, opts: { color?: string; progress?: number; style?: 'brush' | 'seal'; weight?: number } = {}) {
  drawGlyph(ctx, '旱', x, y, size, opts);
}

// ============================================================
// 朱印
// ============================================================

function sealImpression(ctx: C2D, glyph: string, size: number, color: string, style: 'baiwen' | 'zhuwen', seed: number): HTMLCanvasElement {
  const dpr = deviceScale(ctx);
  return cached(`seal:${glyph}:${color}:${style}:${seed}`, size * 1.1, size * 1.1, dpr, (g, w) => {
    const r = rng(seed * 13 + glyph.charCodeAt(0));
    const o = (w - size) / 2;
    g.translate(o, o);
    // 不齐的边：沿四边抖动
    const edge = (inset: number, amp: number) => {
      const pts: Pt[] = [];
      const n = 14;
      const side = size - inset * 2;
      for (let s = 0; s < 4; s++) {
        for (let i = 0; i < n; i++) {
          const k = i / n;
          const j = (r() - 0.5) * amp;
          const p = s === 0 ? { x: k * side, y: j } : s === 1 ? { x: side + j, y: k * side } : s === 2 ? { x: side - k * side, y: side + j } : { x: j, y: side - k * side };
          pts.push({ x: p.x + inset, y: p.y + inset });
        }
      }
      g.beginPath();
      g.moveTo(pts[0]!.x, pts[0]!.y);
      for (const p of pts) g.lineTo(p.x, p.y);
      g.closePath();
    };
    if (style === 'baiwen') {
      edge(0, size * 0.025);
      g.fillStyle = color;
      g.fill();
      g.globalCompositeOperation = 'destination-out';
      drawGlyph(g, glyph, size / 2, size / 2, size * 0.78, { style: 'seal', color: '#000000', weight: 1.35 });
    } else {
      g.lineWidth = size * 0.07;
      g.strokeStyle = color;
      edge(size * 0.04, size * 0.02);
      g.stroke();
      drawGlyph(g, glyph, size / 2, size / 2, size * 0.74, { style: 'seal', color, weight: 1.2 });
      g.globalCompositeOperation = 'destination-out';
    }
    // 印泥不匀：小斑
    for (let i = 0; i < 46; i++) {
      g.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.6})`;
      g.beginPath();
      g.arc(r() * size, r() * size, size * (0.004 + r() * 0.014), 0, TAU);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  });
}

/**
 * 朱印。(x,y) 为印中心；size 为边长；glyph 为印文（'旱' / '禾'）。
 * progress：0 无 → 0.4 印落下 → 0.5 压实 → 1 印泥沉稳。不传则直接是印好的样子。
 */
export function seal(ctx: C2D, x: number, y: number, size: number, opts: { glyph?: string; progress?: number; angle?: number; color?: string; style?: 'baiwen' | 'zhuwen'; seed?: number } = {}) {
  const p = clamp(opts.progress ?? 1);
  if (p <= 0) return;
  const color = opts.color ?? PAL.cinnabar;
  const img = sealImpression(ctx, opts.glyph ?? '旱', size, color, opts.style ?? 'baiwen', opts.seed ?? 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(opts.angle ?? -0.04);
  if (p < 0.42) {
    // 悬着的印：影子越来越实
    const k = p / 0.42;
    const lift = (1 - easeOut(k)) * size * 0.5;
    ctx.fillStyle = rgba('#3a1a10', 0.1 + 0.22 * k);
    const sr = size * 0.55 * (1 + lift / size);
    ctx.beginPath();
    ctx.roundRect(size * 0.05 - sr, size * 0.06 - sr, sr * 2, sr * 2, sr * 0.25);
    ctx.fill();
    ctx.globalAlpha = 0.25 + 0.35 * k;
    const s = 1 + lift / size * 0.6;
    ctx.drawImage(img, (-size * 1.1 * s) / 2, (-size * 1.1 * s) / 2 - lift, size * 1.1 * s, size * 1.1 * s);
  } else {
    const k = span(p, 0.42, 0.56);
    const settle = span(p, 0.56, 1);
    const squash = 1 + (1 - k) * 0.05;
    ctx.globalAlpha = 0.75 + 0.25 * settle;
    ctx.drawImage(img, (-size * 1.1 * squash) / 2, (-size * 1.1 * squash) / 2, size * 1.1 * squash, size * 1.1 * squash);
    if (settle < 1) {
      // 落印一瞬的暖光
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - settle) * 0.5;
      ctx.strokeStyle = PAL.millet;
      ctx.lineWidth = 2;
      const rr = size * (0.6 + settle * 0.5);
      ctx.strokeRect(-rr, -rr, rr * 2, rr * 2);
    }
  }
  ctx.restore();
}
