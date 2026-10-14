// 质感：帛底、漆底、颗粒、暗角、暖光。全部预渲染进离屏画布，按尺寸缓存。
// 「看起来精致的最便宜来源」：所有画面最后都过 finish()。

import { PAL } from './palette';
import { type C2D, clamp, deviceScale, rgba, rng, mix } from './util';

// ---- 缓存 ----

const store = new Map<string, HTMLCanvasElement>();
const MAX = 96;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/**
 * 取（或画）一张缓存贴图：key 相同就复用。w/h 为 CSS 像素，内部按 dpr 放大。
 * draw 收到的上下文已缩放到 CSS 像素。
 */
export function cached(key: string, w: number, h: number, dpr: number, draw: (g: C2D, w: number, h: number) => void): HTMLCanvasElement {
  const k = `${key}|${Math.round(w)}x${Math.round(h)}@${dpr}`;
  let c = store.get(k);
  if (c) {
    // 最近用过的挪到末尾（简易 LRU）
    store.delete(k);
    store.set(k, c);
    return c;
  }
  c = makeCanvas(w * dpr, h * dpr);
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  draw(g, w, h);
  store.set(k, c);
  if (store.size > MAX) store.delete(store.keys().next().value!);
  return c;
}

/** 把一张缓存贴图画到 CSS 像素矩形里 */
export function blit(ctx: C2D, c: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  ctx.drawImage(c, x, y, w, h);
}

export function clearPaintCache() {
  store.clear();
}

// ---- 颗粒（帛纹 / 漆面） ----

export type GrainKind = 'silk' | 'lacquer';
const TILE = 256;
const tiles: Partial<Record<GrainKind, HTMLCanvasElement>> = {};

function grainTile(kind: GrainKind): HTMLCanvasElement {
  const ex = tiles[kind];
  if (ex) return ex;
  const c = makeCanvas(TILE, TILE);
  const g = c.getContext('2d')!;
  const r = rng(kind === 'silk' ? 11 : 23);
  const img = g.createImageData(TILE, TILE);
  const d = img.data;
  for (let i = 0; i < TILE * TILE; i++) {
    const v = r();
    const o = i * 4;
    if (kind === 'silk') {
      if (v < 0.22) {
        d[o] = 40; d[o + 1] = 26; d[o + 2] = 14; d[o + 3] = 6 + r() * 16;
      } else if (v > 0.84) {
        d[o] = 255; d[o + 1] = 246; d[o + 2] = 222; d[o + 3] = 6 + r() * 14;
      }
    } else {
      if (v < 0.18) {
        d[o] = 0; d[o + 1] = 0; d[o + 2] = 0; d[o + 3] = 18 + r() * 30;
      } else if (v > 0.93) {
        d[o] = 214; d[o + 1] = 170; d[o + 2] = 100; d[o + 3] = 6 + r() * 16;
      }
    }
  }
  g.putImageData(img, 0, 0);
  // 帛的经纬：细横线、细竖线；漆面：刷痕
  if (kind === 'silk') {
    for (let i = 0; i < 70; i++) {
      const y = r() * TILE;
      g.fillStyle = r() < 0.5 ? 'rgba(60,40,20,0.035)' : 'rgba(255,248,230,0.04)';
      g.fillRect(0, y, TILE, 1);
    }
    for (let i = 0; i < 40; i++) {
      const x = r() * TILE;
      g.fillStyle = 'rgba(60,40,20,0.035)';
      g.fillRect(x, 0, 1, TILE);
    }
  } else {
    for (let i = 0; i < 40; i++) {
      const y = r() * TILE;
      g.fillStyle = r() < 0.6 ? 'rgba(0,0,0,0.06)' : 'rgba(120,80,50,0.04)';
      g.fillRect(0, y, TILE, 0.6 + r() * 1.2);
    }
  }
  tiles[kind] = c;
  return c;
}

const patterns = new WeakMap<C2D, Map<string, CanvasPattern>>();
function grainPattern(ctx: C2D, kind: GrainKind): CanvasPattern | null {
  const dpr = deviceScale(ctx);
  let m = patterns.get(ctx);
  if (!m) patterns.set(ctx, (m = new Map()));
  const key = `${kind}@${dpr}`;
  let p = m.get(key);
  if (!p) {
    p = ctx.createPattern(grainTile(kind), 'repeat') ?? undefined;
    if (!p) return null;
    p.setTransform(new DOMMatrix().scale(1 / dpr, 1 / dpr));
    m.set(key, p);
  }
  return p;
}

/** 细颗粒：帛纹或漆面。amount 0..1（默认 1） */
export function grain(ctx: C2D, x: number, y: number, w: number, h: number, opts: { kind?: GrainKind; amount?: number } = {}) {
  const p = grainPattern(ctx, opts.kind ?? 'silk');
  if (!p) return;
  ctx.save();
  ctx.globalAlpha = clamp(opts.amount ?? 1);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = p;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// ---- 底 ----

/** 帛（绢）底：白昼。tone 改底色（默认帛），age 0..1 边缘的旧黄 */
export function silkGround(ctx: C2D, x: number, y: number, w: number, h: number, opts: { tone?: string; age?: number; seed?: number } = {}) {
  const tone = opts.tone ?? PAL.silk;
  const age = opts.age ?? 0.6;
  const seed = opts.seed ?? 3;
  const dpr = deviceScale(ctx);
  const c = cached(`silk:${tone}:${age}:${seed}`, w, h, dpr, (g) => {
    const r = rng(seed);
    g.fillStyle = tone;
    g.fillRect(0, 0, w, h);
    // 帛面不匀：大块淡渍
    for (let i = 0; i < 26; i++) {
      const cx = r() * w;
      const cy = r() * h;
      const rad = (0.12 + r() * 0.3) * Math.max(w, h);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const col = r() < 0.65 ? PAL.silkDim : '#f3e9cf';
      gr.addColorStop(0, rgba(col, 0.1 + r() * 0.1));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
    // 经纬
    for (let yy = 0; yy < h; yy += 2 + r() * 3) {
      g.fillStyle = r() < 0.5 ? 'rgba(90,64,30,0.035)' : 'rgba(255,250,235,0.05)';
      g.fillRect(0, yy, w, 0.7);
    }
    for (let xx = 0; xx < w; xx += 3 + r() * 5) {
      g.fillStyle = 'rgba(90,64,30,0.022)';
      g.fillRect(xx, 0, 0.7, h);
    }
    // 边缘旧黄
    const e = Math.min(w, h) * 0.22;
    const edge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, rgba(mix(PAL.silkDim, PAL.ochre, 0.35), 0.4 * age));
      gr.addColorStop(1, rgba(PAL.silkDim, 0));
      g.fillStyle = gr;
      g.fillRect(rx, ry, rw, rh);
    };
    edge(0, 0, 0, e, 0, 0, w, e);
    edge(0, h, 0, h - e, 0, h - e, w, e);
    edge(0, 0, e, 0, 0, 0, e, h);
    edge(w, 0, w - e, 0, w - e, 0, e, h);
  });
  ctx.drawImage(c, x, y, w, h);
}

/** 漆底：夜、屋内。tone 'black' | 'brown'；sheen 0..1 上方的一抹漆光 */
export function lacquerGround(ctx: C2D, x: number, y: number, w: number, h: number, opts: { tone?: 'black' | 'brown'; sheen?: number; seed?: number } = {}) {
  const tone = opts.tone ?? 'black';
  const sheen = opts.sheen ?? 0.5;
  const seed = opts.seed ?? 5;
  const dpr = deviceScale(ctx);
  const c = cached(`lacq:${tone}:${sheen}:${seed}`, w, h, dpr, (g) => {
    const r = rng(seed);
    const base = tone === 'black' ? PAL.lacquer : PAL.lacquer2;
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    // 刷痕：横向长笔，暖黑与更黑交替
    for (let i = 0; i < 90; i++) {
      const yy = r() * h;
      const hh = 2 + r() * 14;
      const xx = -w * 0.2 + r() * w * 0.6;
      const ww = w * (0.4 + r() * 0.9);
      const gr = g.createLinearGradient(xx, 0, xx + ww, 0);
      const col = r() < 0.55 ? PAL.lacquer2 : '#000000';
      const a = col === '#000000' ? 0.12 : 0.1;
      gr.addColorStop(0, rgba(col, 0));
      gr.addColorStop(0.3, rgba(col, a));
      gr.addColorStop(0.7, rgba(col, a));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(xx, yy, ww, hh);
    }
    if (sheen > 0) {
      const gr = g.createRadialGradient(w * 0.5, -h * 0.1, 0, w * 0.5, -h * 0.1, Math.max(w, h) * 0.9);
      gr.addColorStop(0, rgba('#5a3a26', 0.28 * sheen));
      gr.addColorStop(1, rgba('#5a3a26', 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
  });
  ctx.drawImage(c, x, y, w, h);
}

/** 暗角：边缘压暗。strength 0..1 */
export function vignette(ctx: C2D, x: number, y: number, w: number, h: number, opts: { strength?: number; color?: string } = {}) {
  const strength = opts.strength ?? 0.55;
  const color = opts.color ?? PAL.lacquer;
  if (strength <= 0) return;
  // 贴图用小尺寸，拉伸足够平滑
  const vw = 256;
  const vh = Math.max(64, Math.round((256 * h) / Math.max(1, w)));
  const c = cached(`vig:${color}`, vw, vh, 1, (g) => {
    g.save();
    g.translate(vw / 2, vh / 2);
    g.scale(1, vh / vw);
    const gr = g.createRadialGradient(0, 0, vw * 0.28, 0, 0, vw * 0.78);
    gr.addColorStop(0, rgba(color, 0));
    gr.addColorStop(0.55, rgba(color, 0.35));
    gr.addColorStop(1, rgba(color, 1));
    g.fillStyle = gr;
    g.fillRect(-vw, -vw, vw * 2, vw * 2);
    g.restore();
  });
  ctx.save();
  ctx.globalAlpha = clamp(strength);
  ctx.drawImage(c, x, y, w, h);
  ctx.restore();
}

// ---- 光 ----

const glowSprites = new Map<string, HTMLCanvasElement>();
function glowSprite(color: string): HTMLCanvasElement {
  let c = glowSprites.get(color);
  if (c) return c;
  const S = 128;
  c = makeCanvas(S, S);
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  // 指数式衰减：中心亮，边缘极柔
  const stops = [0, 0.08, 0.2, 0.38, 0.6, 0.8, 1];
  for (const s of stops) gr.addColorStop(s, rgba(color, Math.exp(-s * 4.2) * (1 - s)));
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  glowSprites.set(color, c);
  return c;
}

/** 暖光：加法混合的柔光圈。r 为半径（CSS 像素），intensity 0..1+ */
export function glow(ctx: C2D, x: number, y: number, r: number, color: string = PAL.millet, intensity = 1) {
  if (intensity <= 0 || r <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clamp(intensity, 0, 1);
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  if (intensity > 1) {
    ctx.globalAlpha = clamp(intensity - 1);
    ctx.drawImage(glowSprite(color), x - r * 0.6, y - r * 0.6, r * 1.2, r * 1.2);
  }
  ctx.restore();
}

/** 统一收尾：颗粒 + 暗角。每帧最后调用一次 */
export function finish(ctx: C2D, w: number, h: number, opts: { ground?: GrainKind; grain?: number; vignette?: number; vignetteColor?: string } = {}) {
  const kind = opts.ground ?? 'lacquer';
  vignette(ctx, 0, 0, w, h, {
    strength: opts.vignette ?? (kind === 'silk' ? 0.32 : 0.6),
    color: opts.vignetteColor ?? (kind === 'silk' ? '#6b4a2a' : PAL.lacquer),
  });
  grain(ctx, 0, 0, w, h, { kind, amount: opts.grain ?? 1 });
}
