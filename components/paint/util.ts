// 画具的小工具：随机、噪声、插值、平滑路径、颜色。不碰 DOM 以外的东西。

export type C2D = CanvasRenderingContext2D;
export interface Pt {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;
export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t: number) => Math.pow(clamp(t), 3);
export const easeInOut = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
/** 区间映射：t 在 [a,b] 之间时 0→1 */
export const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

/** 整数哈希 → 0..1 */
export function hash(n: number): number {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
export const hash2 = (a: number, b: number) => hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663));

/** 可复现的随机数（mulberry32） */
export function rng(seed: number): () => number {
  let s = (seed | 0) + 0x6d2b79f5;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 一维值噪声 → -1..1，平滑 */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i + seed * 1013) * 2 - 1;
  const b = hash(i + 1 + seed * 1013) * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
/** 灯焰、风这类「活」的抖动：几层噪声叠加 */
export function flicker(t: number, seed = 0): number {
  return noise1(t * 3.1, seed) * 0.55 + noise1(t * 7.3, seed + 7) * 0.3 + noise1(t * 17, seed + 13) * 0.15;
}

export const dir = (a: number): Pt => ({ x: Math.sin(a), y: Math.cos(a) });
export const add = (p: Pt, q: Pt, k = 1): Pt => ({ x: p.x + q.x * k, y: p.y + q.y * k });
export const lerpPt = (p: Pt, q: Pt, t: number): Pt => ({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) });
export const rot = (p: Pt, a: number): Pt => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};

/** 过点的平滑闭合/开放路径（中点二次曲线：拐角圆润，像毛笔走过） */
export function smoothPath(ctx: C2D, pts: Pt[], closed = true) {
  const n = pts.length;
  if (n < 2) return;
  if (!closed) {
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < n - 1; i++) {
      const p = pts[i]!;
      const q = pts[i + 1]!;
      ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
    }
    ctx.lineTo(pts[n - 1]!.x, pts[n - 1]!.y);
    return;
  }
  const m0 = lerpPt(pts[n - 1]!, pts[0]!, 0.5);
  ctx.moveTo(m0.x, m0.y);
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % n]!;
    ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
  }
  ctx.closePath();
}

/** Catmull-Rom 采样成折线（给笔画、云纹用） */
export function sampleSpline(pts: Pt[], perSeg = 8): Pt[] {
  if (pts.length < 3) return pts.slice();
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

// ---- 颜色 ----

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

/** 两色相混：t=0 为 a，t=1 为 b */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  return toHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
}
/** 带透明度 */
export function rgba(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${clamp(a)})`;
}
export const shade = (hex: string, k: number) => (k < 0 ? mix(hex, '#000000', -k) : mix(hex, '#ffffff', k));

/** save → 平移 → 缩放 → fn → restore */
export function withXf(ctx: C2D, x: number, y: number, s: number, fn: () => void, rotate = 0, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  if (rotate) ctx.rotate(rotate);
  ctx.scale(s * flip, s);
  fn();
  ctx.restore();
}

/** 当前上下文的设备像素比（缓存贴图按它渲染，保证清晰） */
export function deviceScale(ctx: C2D): number {
  const m = ctx.getTransform();
  const k = Math.hypot(m.a, m.b);
  return clamp(Math.round(k * 4) / 4 || 1, 1, 3);
}
