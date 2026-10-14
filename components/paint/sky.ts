// 天：白热的帛色昼、黄昏、黑漆夜（心宿与荧惑）、黎明。太阳是一枚朱红漆圆；
// 「假云」是只有线、不带雨的云纹。

import { PAL, TONE } from './palette';
import { cloudBand, cloudScroll } from './ornament';
import { cached, glow, lacquerGround, silkGround } from './texture';
import { type C2D, TAU, clamp, deviceScale, mix, rgba, rng } from './util';

export type DayPart = 'noon' | 'dusk' | 'night' | 'dawn';
export type SkySeason = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SkyOpts {
  part?: DayPart;
  season?: SkySeason;
  t?: number;
  /** 荧惑的显眼程度 0..1（0 几乎看不见） */
  omen?: number;
  /** 地平线在高度的几成（默认 0.74） */
  horizon?: number;
  /** 太阳位置（0..1 比例），不给按时辰 */
  sun?: { x: number; y: number };
  /** 假云多少 0..1 */
  clouds?: number;
  /** 热度 0..1：白热的光晕与热浪 */
  heat?: number;
}

export interface SkyInfo {
  sun: { x: number; y: number; r: number };
  /** 心宿二（大火） */
  xin: { x: number; y: number };
  yinghuo: { x: number; y: number };
  horizonY: number;
}

const SEASON_WASH: Record<SkySeason, [string, number]> = {
  spring: [TONE.bronzeLight, 0.1],
  summer: ['#fff6dc', 0.12],
  autumn: [PAL.ochre, 0.14],
  winter: ['#8f8c86', 0.2],
};

/** 画满整块天。返回太阳、心宿、荧惑的位置，给镜头和视线用 */
export function sky(ctx: C2D, w: number, h: number, opts: SkyOpts = {}): SkyInfo {
  const part = opts.part ?? 'noon';
  const season = opts.season ?? 'summer';
  const t = opts.t ?? 0;
  const hz = h * (opts.horizon ?? 0.74);
  const clouds = opts.clouds ?? 0.6;
  const heat = opts.heat ?? (part === 'noon' ? 1 : 0.3);
  const m = Math.min(w, h);
  const sunPos = opts.sun ?? (part === 'noon' ? { x: 0.74, y: 0.2 } : part === 'dusk' ? { x: 0.8, y: (opts.horizon ?? 0.74) - 0.08 } : { x: 0.18, y: (opts.horizon ?? 0.74) - 0.06 });
  const sun = { x: sunPos.x * w, y: sunPos.y * h, r: m * (part === 'noon' ? 0.055 : 0.075) };
  const xin = { x: w * 0.7, y: h * 0.2 };
  const yinghuo = { x: xin.x + m * 0.035, y: xin.y - m * 0.05 };
  const info: SkyInfo = { sun, xin, yinghuo, horizonY: hz };

  if (part === 'night') {
    nightSky(ctx, w, h, hz, t, opts.omen ?? 0, clouds, xin, yinghuo);
    return info;
  }

  // 昼：帛底 + 时辰的色
  silkGround(ctx, 0, 0, w, h, { seed: 7 });
  const dpr = deviceScale(ctx);
  const wash = cached(`skywash:${part}`, 64, 128, dpr, (g, ww, hh) => {
    const gr = g.createLinearGradient(0, 0, 0, hh);
    if (part === 'noon') {
      gr.addColorStop(0, rgba('#d9c597', 0.35));
      gr.addColorStop(0.55, rgba('#fbf3df', 0.25));
      gr.addColorStop(1, rgba('#fff8e6', 0.5));
    } else if (part === 'dusk') {
      gr.addColorStop(0, rgba(PAL.umber, 0.45));
      gr.addColorStop(0.45, rgba(PAL.ochre, 0.45));
      gr.addColorStop(0.85, rgba(PAL.cinnabar, 0.45));
      gr.addColorStop(1, rgba(PAL.millet, 0.5));
    } else {
      gr.addColorStop(0, rgba('#6f7480', 0.4));
      gr.addColorStop(0.6, rgba(PAL.silkDim, 0.25));
      gr.addColorStop(1, rgba('#f4e2c0', 0.45));
    }
    g.fillStyle = gr;
    g.fillRect(0, 0, ww, hh);
  });
  ctx.drawImage(wash, 0, 0, w, h);
  const [wc, wa] = SEASON_WASH[season];
  ctx.fillStyle = rgba(wc, wa);
  ctx.fillRect(0, 0, w, h);

  // 白热：太阳周围一大片发白
  if (heat > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(sun.x, sun.y, sun.r, sun.x, sun.y, m * 0.9);
    gr.addColorStop(0, rgba('#fff2d0', 0.38 * heat));
    gr.addColorStop(0.4, rgba('#f6e2b4', 0.12 * heat));
    gr.addColorStop(1, rgba('#f6e2b4', 0));
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // 假云：只有线
  if (clouds > 0) {
    const col = part === 'dusk' ? PAL.cinnabar : part === 'dawn' ? '#7d7466' : PAL.ochre;
    cloudBand(ctx, 0, h * 0.04, w, hz * 0.55, { color: col, alpha: 0.4 * clamp(clouds), seed: 4, drift: t * 6, size: Math.min(72, m * 0.1), density: 0.4 * clamp(clouds) + 0.15 });
  }

  sunDisk(ctx, sun.x, sun.y, sun.r, { t, heat, part });

  // 地平线的热霾
  const gr = ctx.createLinearGradient(0, hz - m * 0.12, 0, hz);
  gr.addColorStop(0, rgba('#fbf1d8', 0));
  gr.addColorStop(1, rgba(part === 'dusk' ? PAL.millet : '#fbf1d8', 0.45 * (0.4 + heat * 0.6)));
  ctx.fillStyle = gr;
  ctx.fillRect(0, hz - m * 0.12, w, m * 0.12 + 1);
  return info;
}

/** 太阳：一枚朱红漆圆，细金边；热时有一圈圈热浪 */
export function sunDisk(ctx: C2D, x: number, y: number, r: number, opts: { t?: number; heat?: number; part?: DayPart } = {}) {
  const t = opts.t ?? 0;
  const heat = opts.heat ?? 1;
  const part = opts.part ?? 'noon';
  glow(ctx, x, y, r * 4, part === 'noon' ? '#f3d9a0' : PAL.cinnabar, 0.35 + heat * 0.25);
  // 热浪：慢慢外扩的细环
  if (heat > 0.05) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.12 + i / 3) % 1;
      ctx.strokeStyle = rgba(PAL.cinnabar, (1 - k) * 0.22 * heat);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, r * (1.25 + k * 1.6), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  const col = part === 'dawn' ? mix(PAL.cinnabar, PAL.silk, 0.25) : part === 'dusk' ? '#a32f1e' : PAL.cinnabar;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, mix(col, '#e36a45', 0.4));
  g.addColorStop(1, col);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(PAL.gold, 0.8);
  ctx.lineWidth = Math.max(0.8, r * 0.035);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.86, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function nightSky(ctx: C2D, w: number, h: number, hz: number, t: number, omen: number, clouds: number, xin: { x: number; y: number }, yh: { x: number; y: number }) {
  const dpr = deviceScale(ctx);
  const base = cached('night', w, h, dpr, (g) => {
    lacquerGround(g, 0, 0, w, h, { tone: 'black', sheen: 0, seed: 9 });
    const gr = g.createLinearGradient(0, 0, 0, hz);
    gr.addColorStop(0, rgba(PAL.night, 0.95));
    gr.addColorStop(0.7, rgba(PAL.night, 0.55));
    gr.addColorStop(1, rgba(PAL.lacquer2, 0.6));
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    // 静止的星
    const r = rng(77);
    const n = Math.round((w * hz) / 2600);
    for (let i = 0; i < n; i++) {
      const x = r() * w;
      const y = r() * hz * 0.95;
      const s = 0.35 + Math.pow(r(), 3) * 1.3;
      g.fillStyle = rgba(r() < 0.7 ? '#efe1c2' : PAL.millet, 0.25 + r() * 0.55);
      g.beginPath();
      g.arc(x, y, s, 0, TAU);
      g.fill();
    }
  });
  ctx.drawImage(base, 0, 0, w, h);

  // 闪的星
  const r = rng(5);
  for (let i = 0; i < 26; i++) {
    const x = r() * w;
    const y = r() * hz * 0.85;
    const ph = r() * TAU;
    const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * (0.6 + r() * 1.2) + ph));
    ctx.fillStyle = rgba('#f5e6c4', a);
    ctx.beginPath();
    ctx.arc(x, y, 0.9, 0, TAU);
    ctx.fill();
  }

  // 心宿三星：中间大火偏红
  const m = Math.min(w, h);
  const s = m * 0.03;
  const xs = [
    { x: xin.x - s * 1.3, y: xin.y + s * 0.5, r: 1.2, c: '#f2dfb6' },
    { x: xin.x, y: xin.y, r: 2, c: '#e8945a' },
    { x: xin.x + s * 1.25, y: xin.y + s * 0.65, r: 1.15, c: '#f2dfb6' },
  ];
  for (const st of xs) {
    glow(ctx, st.x, st.y, st.r * 7, st.c, 0.45);
    ctx.fillStyle = st.c;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, TAU);
    ctx.fill();
  }
  // 荧惑：暗红，慢慢地「呼吸」；omen 越大越显
  const pulse = 0.8 + 0.2 * Math.sin(t * 0.9);
  const k = 0.25 + omen * 0.75;
  glow(ctx, yh.x, yh.y, (6 + omen * 18) * pulse, PAL.cinnabar, 0.5 * k);
  ctx.fillStyle = rgba('#d24a2c', 0.55 + 0.45 * k);
  ctx.beginPath();
  ctx.arc(yh.x, yh.y, 1.1 + omen * 1.4, 0, TAU);
  ctx.fill();

  // 金线的夜云
  if (clouds > 0) cloudBand(ctx, 0, h * 0.03, w, hz * 0.6, { color: PAL.gold, alpha: 0.3 * clamp(clouds), seed: 2, drift: t * 3, size: Math.min(76, m * 0.1), density: 0.35 });
  // 地平线上一线暖黑
  const gr = ctx.createLinearGradient(0, hz - m * 0.1, 0, hz);
  gr.addColorStop(0, rgba(PAL.lacquer2, 0));
  gr.addColorStop(1, rgba('#3a2418', 0.5));
  ctx.fillStyle = gr;
  ctx.fillRect(0, hz - m * 0.1, w, m * 0.1);
}

/** 单独画一颗星（带光） */
export function star(ctx: C2D, x: number, y: number, r: number, color = '#f2dfb6', glowAmt = 0.4) {
  glow(ctx, x, y, r * 7, color, glowAmt);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** 一朵飘着的假云（金/赭线），给场景单独摆放 */
export function falseCloud(ctx: C2D, x: number, y: number, size: number, opts: { color?: string; seed?: number; alpha?: number; t?: number } = {}) {
  const t = opts.t ?? 0;
  cloudScroll(ctx, x + Math.sin(t * 0.2 + (opts.seed ?? 0)) * size * 0.1, y, size, { color: opts.color ?? PAL.ochre, seed: opts.seed ?? 3, alpha: opts.alpha ?? 0.6, width: 0.06 });
}
