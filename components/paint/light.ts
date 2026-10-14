// 灯焰：会呼吸的一点火。夜里一切亮处都是暖光，缓慢闪烁。

import { PAL, TONE } from './palette';
import { glow } from './texture';
import { type C2D, clamp, flicker, rgba } from './util';

function tear(ctx: C2D, w: number, h: number, tip: number) {
  ctx.beginPath();
  ctx.moveTo(0, w * 0.25);
  ctx.bezierCurveTo(-w * 1.05, w * 0.1, -w * 0.75, -h * 0.5, tip, -h);
  ctx.bezierCurveTo(w * 0.75, -h * 0.5, w * 1.05, w * 0.1, 0, w * 0.25);
  ctx.closePath();
}

/**
 * 灯焰。(x,y) 为灯芯；size 为焰高（CSS 像素）；intensity 0..1（0 = 灭）。
 * seed 让多盏灯各自闪烁；halo=false 时不画大光晕（自己另画）。
 */
export function flame(ctx: C2D, x: number, y: number, size: number, t: number, intensity = 1, opts: { seed?: number; halo?: boolean; wind?: number } = {}) {
  const k = clamp(intensity);
  if (k <= 0.01) return;
  const seed = opts.seed ?? 0;
  const f = flicker(t, seed);
  const f2 = flicker(t * 1.7 + 3, seed + 5);
  const h = size * (0.55 + 0.45 * k) * (1 + f * 0.13);
  const w = h * 0.3;
  const tip = (f2 * 0.16 + (opts.wind ?? 0)) * h;
  if (opts.halo !== false) {
    glow(ctx, x, y - h * 0.45, size * 4.2, PAL.millet, 0.42 * k * (1 + f * 0.12));
    glow(ctx, x, y - h * 0.4, size * 1.6, '#e08a3a', 0.5 * k);
  }
  ctx.save();
  ctx.translate(x, y);
  // 外焰：朱 → 粟
  tear(ctx, w, h, tip);
  const g = ctx.createLinearGradient(0, 0, 0, -h);
  g.addColorStop(0, rgba(PAL.cinnabar, 0.95 * k));
  g.addColorStop(0.35, rgba('#e4892f', 0.95 * k));
  g.addColorStop(1, rgba(PAL.millet, 0.75 * k));
  ctx.fillStyle = g;
  ctx.fill();
  // 焰心
  ctx.scale(0.55, 0.62);
  tear(ctx, w, h, tip * 0.7);
  ctx.fillStyle = rgba(TONE.flameCore, 0.92 * k);
  ctx.fill();
  ctx.restore();
}
