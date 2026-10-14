// 门与屋里的物件：夯土墙、木门与铺首、小窗的灯、十五连盏灯、漆案、耳杯、票根、竹简。
// 约定：立在地上的东西 (x,y) 为底边中点；平放/悬浮的小物 (x,y) 为中心。

import { flame } from './light';
import { cloudScroll, drawGlyph, seal } from './ornament';
import { PAL, TONE } from './palette';
import { cached, glow } from './texture';
import { type C2D, type Pt, TAU, clamp, deviceScale, easeOut, flicker, lerp, mix, rgba, rng } from './util';

// ============================================================
// 铺首（青铜兽面衔环）
// ============================================================

/** 铺首：兽面衔环。(x,y) 为兽面中心，r 为兽面半宽；swing 为环的摆角（弧度）；lit 0..1 被光照到 */
export function pushou(ctx: C2D, x: number, y: number, r: number, opts: { swing?: number; lit?: number } = {}) {
  const lit = clamp(opts.lit ?? 0);
  const gold = rgba(mix(PAL.gold, TONE.goldLight, lit), 0.75 + lit * 0.25);
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // 兽面：上宽、两角外卷、下收成鼻
  ctx.beginPath();
  ctx.moveTo(-r * 1.05, -r * 0.75);
  ctx.quadraticCurveTo(0, -r * 1.05, r * 1.05, -r * 0.75);
  ctx.quadraticCurveTo(r * 1.0, r * 0.1, r * 0.45, r * 0.55);
  ctx.quadraticCurveTo(r * 0.2, r * 0.75, 0, r * 0.95);
  ctx.quadraticCurveTo(-r * 0.2, r * 0.75, -r * 0.45, r * 0.55);
  ctx.quadraticCurveTo(-r * 1.0, r * 0.1, -r * 1.05, -r * 0.75);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, mix('#3c5246', '#7a6a3a', lit * 0.6));
  g.addColorStop(1, '#151d18');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = gold;
  ctx.lineWidth = Math.max(0.6, r * 0.06);
  ctx.stroke();
  // 两角：涡卷
  for (const s of [-1, 1]) {
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const k = i / 20;
      const a = s > 0 ? -Math.PI * 0.9 + k * TAU * 1.1 : -Math.PI * 0.1 - k * TAU * 1.1;
      const rr = r * 0.32 * (1 - k * 0.75);
      const px = s * r * 0.52 + Math.cos(a) * rr;
      const py = -r * 0.42 + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // 目：凸起的圆，墨瞳
    ctx.fillStyle = '#0d120f';
    ctx.beginPath();
    ctx.arc(s * r * 0.36, r * 0.05, r * 0.15, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(s * r * 0.36 + r * 0.03, r * 0.02, r * 0.04, 0, TAU);
    ctx.fill();
  }
  // 鼻梁：一列小菱
  ctx.fillStyle = gold;
  for (let i = 0; i < 3; i++) {
    const yy = -r * 0.55 + i * r * 0.28;
    ctx.beginPath();
    ctx.moveTo(0, yy - r * 0.09);
    ctx.lineTo(r * 0.06, yy);
    ctx.lineTo(0, yy + r * 0.09);
    ctx.lineTo(-r * 0.06, yy);
    ctx.closePath();
    ctx.fill();
  }
  // 环：从鼻下衔出
  ctx.translate(0, r * 0.8);
  ctx.rotate(opts.swing ?? 0);
  ctx.strokeStyle = mix('#5b6e5c', PAL.gold, 0.45 + lit * 0.4);
  ctx.lineWidth = Math.max(1, r * 0.17);
  ctx.beginPath();
  ctx.arc(0, r * 0.68, r * 0.66, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = rgba(TONE.goldLight, 0.35 + lit * 0.4);
  ctx.lineWidth = Math.max(0.5, r * 0.04);
  ctx.beginPath();
  ctx.arc(0, r * 0.68, r * 0.7, -Math.PI * 0.9, -Math.PI * 0.3);
  ctx.stroke();
  ctx.restore();
}

// ============================================================
// 墙、门、窗
// ============================================================

/** 夯土墙。(x,y) 底边中点；night=true 为夜色。顶上一溜瓦檐 */
export function wall(ctx: C2D, x: number, y: number, w: number, h: number, opts: { night?: boolean; seed?: number; coping?: boolean } = {}) {
  const night = opts.night ?? false;
  const seed = opts.seed ?? 1;
  const dpr = deviceScale(ctx);
  const cap = opts.coping === false ? 0 : Math.min(h * 0.12, 26);
  const c = cached(`wall:${night}:${seed}:${cap}`, w, h + cap, dpr, (g) => {
    const r = rng(seed);
    const base = night ? TONE.wallNight : PAL.loess;
    g.fillStyle = base;
    g.fillRect(0, cap, w, h);
    // 夯层
    let yy = cap + h * 0.05;
    while (yy < cap + h) {
      const lh = h * (0.07 + r() * 0.03);
      g.fillStyle = rgba(night ? '#000000' : PAL.umber, 0.1 + r() * 0.08);
      g.fillRect(0, yy, w, 1.2);
      g.fillStyle = rgba(night ? '#5a4232' : TONE.loessLight, 0.14);
      g.fillRect(0, yy + 1.2, w, 1);
      // 层内斑驳
      for (let i = 0; i < w / 14; i++) {
        g.fillStyle = rgba(r() < 0.5 ? '#000000' : night ? '#4a3628' : TONE.loessLight, 0.05 + r() * 0.06);
        g.fillRect(r() * w, yy + r() * lh, 6 + r() * 30, 1 + r() * 3);
      }
      // 版筑留下的小孔
      if (r() < 0.5) {
        for (let xx = r() * 60; xx < w; xx += 70 + r() * 50) {
          g.fillStyle = rgba('#000000', 0.25);
          g.beginPath();
          g.arc(xx, yy + lh * 0.5, 1.6, 0, TAU);
          g.fill();
        }
      }
      yy += lh;
    }
    // 下沿的潮痕
    const gr = g.createLinearGradient(0, cap + h * 0.75, 0, cap + h);
    gr.addColorStop(0, rgba('#000000', 0));
    gr.addColorStop(1, rgba('#000000', night ? 0.35 : 0.18));
    g.fillStyle = gr;
    g.fillRect(0, cap + h * 0.75, w, h * 0.25);
    if (cap > 0) {
      // 瓦檐：黑漆瓦顶，一道道瓦垄，檐下投一条影
      const sh = g.createLinearGradient(0, cap, 0, cap + cap * 0.9);
      sh.addColorStop(0, rgba('#000000', 0.45));
      sh.addColorStop(1, rgba('#000000', 0));
      g.fillStyle = sh;
      g.fillRect(0, cap, w, cap * 0.9);
      g.fillStyle = night ? '#0b0807' : PAL.lacquer2;
      g.beginPath();
      g.moveTo(-4, cap + 1);
      g.lineTo(w + 4, cap + 1);
      g.lineTo(w + 4, cap * 0.5);
      g.lineTo(-4, cap * 0.5);
      g.closePath();
      g.fill();
      g.strokeStyle = night ? 'rgba(90,70,50,0.35)' : rgba(PAL.umber, 0.8);
      g.lineWidth = 1;
      for (let xx = 2; xx < w; xx += Math.max(5, cap * 0.32)) {
        g.beginPath();
        g.moveTo(xx, cap + 1);
        g.lineTo(xx, cap * 0.55);
        g.stroke();
      }
      g.strokeStyle = rgba(PAL.gold, night ? 0.22 : 0.3);
      g.beginPath();
      g.moveTo(0, cap + 0.5);
      g.lineTo(w, cap + 0.5);
      g.stroke();
      g.fillStyle = night ? '#050403' : PAL.lacquer;
      g.fillRect(0, cap * 0.45, w, cap * 0.16);
    }
  });
  ctx.drawImage(c, x - w / 2, y - h - cap, w, h + cap);
}

/**
 * 墙上开小窗：窗里一盏灯在动。window 为窗中心相对墙的位置（wx: -0.5..0.5，wy: 0..1 自下而上），ww 为窗宽。
 * glow 0..1：窗里的光。
 */
export function wallWithWindow(ctx: C2D, x: number, y: number, w: number, h: number, opts: { t?: number; glow?: number; wx?: number; wy?: number; ww?: number; night?: boolean; seed?: number } = {}) {
  wall(ctx, x, y, w, h, { night: opts.night ?? true, seed: opts.seed });
  const ww = opts.ww ?? Math.min(w, h) * 0.16;
  const cx = x + (opts.wx ?? 0.3) * w;
  const cy = y - (opts.wy ?? 0.62) * h;
  windowLight(ctx, cx, cy, ww, { t: opts.t ?? 0, glow: opts.glow ?? 1 });
  return { window: { x: cx, y: cy, w: ww, h: ww * 0.8 } };
}

/** 直棂窗：窗里暖光与一点灯焰。(x,y) 窗中心 */
export function windowLight(ctx: C2D, x: number, y: number, w: number, opts: { t?: number; glow?: number } = {}) {
  const t = opts.t ?? 0;
  const k = clamp(opts.glow ?? 1);
  const h = w * 0.8;
  const f = flicker(t, 3);
  ctx.save();
  // 窗洞
  ctx.fillStyle = '#0a0705';
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  // 屋里的光
  const g = ctx.createRadialGradient(x - w * 0.1, y + h * 0.2, 0, x, y, w * 0.8);
  g.addColorStop(0, rgba('#f2c46e', (0.85 + f * 0.1) * k));
  g.addColorStop(0.5, rgba('#c9752f', 0.55 * k));
  g.addColorStop(1, rgba('#5a2a14', 0.4 * k));
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  flame(ctx, x - w * 0.12, y + h * 0.3, h * 0.32, t, k, { seed: 3, halo: false });
  // 棂
  ctx.fillStyle = '#20150e';
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const bx = x - w / 2 + (i / n) * w;
    ctx.fillRect(bx - w * 0.035, y - h / 2, w * 0.07, h);
  }
  ctx.strokeStyle = '#20150e';
  ctx.lineWidth = w * 0.09;
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  ctx.restore();
  // 窗外的光晕
  glow(ctx, x, y, w * 2.6, PAL.millet, (0.35 + f * 0.06) * k);
  glow(ctx, x, y + h * 0.8, w * 1.6, '#e08a3a', 0.12 * k);
}

/**
 * 木门（双扇、向里开）。(x,y) 底边中点；w,h 门框外廓。
 * open 0..1 门扇转开（屋里的暖光出来）；hover 0..1 门缝透光；knock 0..1 环的摆动。
 * 返回铺首位置（给可交互的热区）。
 */
export function door(ctx: C2D, x: number, y: number, w: number, h: number, opts: { open?: number; hover?: number; t?: number; knock?: number; night?: boolean } = {}) {
  const open = easeOut(clamp(opts.open ?? 0));
  const hover = clamp(opts.hover ?? 0);
  const t = opts.t ?? 0;
  const post = w * 0.09;
  const lintel = h * 0.08;
  const x0 = x - w / 2 + post;
  const iw = w - post * 2;
  const top = y - h + lintel;
  const ih = h - lintel - h * 0.02;
  const light = Math.max(open, hover * 0.28);

  // 门洞里：屋内的暖光
  ctx.save();
  ctx.fillStyle = '#0b0705';
  ctx.fillRect(x0, top, iw, ih);
  if (light > 0) {
    const g = ctx.createRadialGradient(x, y - ih * 0.35, 0, x, y - ih * 0.35, ih * 0.9);
    g.addColorStop(0, rgba('#f6d08a', 0.95 * light));
    g.addColorStop(0.45, rgba('#c97a34', 0.7 * light));
    g.addColorStop(1, rgba('#3a1a0c', 0.6 * light));
    ctx.fillStyle = g;
    ctx.fillRect(x0, top, iw, ih);
  }
  ctx.restore();

  // 门扇：绕门轴向里转，远边变短
  const ang = open * 1.35;
  const shake = (opts.knock ?? 0) * Math.sin(t * 40) * w * 0.004;
  for (const side of [-1, 1] as const) {
    const hingeX = side < 0 ? x0 : x0 + iw;
    const lw = (iw / 2) * Math.cos(ang) + (side < 0 ? -1 : 1) * 0 - hover * w * 0.012 * (1 - open);
    const persp = 1 - Math.sin(ang) * 0.1;
    const fx = hingeX - side * lw + shake;
    const fyTop = top + (ih * (1 - persp)) / 2;
    const fyBot = top + ih - (ih * (1 - persp)) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(hingeX, top);
    ctx.lineTo(fx, fyTop);
    ctx.lineTo(fx, fyBot);
    ctx.lineTo(hingeX, top + ih);
    ctx.closePath();
    const shadeK = 0.15 + open * 0.35;
    ctx.fillStyle = mix('#3b2417', '#120b07', shadeK);
    ctx.fill();
    ctx.clip();
    // 木板竖纹
    const n = 4;
    for (let i = 1; i < n; i++) {
      const px = lerp(hingeX, fx, i / n);
      ctx.fillStyle = rgba('#000000', 0.35);
      ctx.fillRect(px - 0.6, top, 1.2, ih);
    }
    // 横带与门钉
    for (const ky of [0.18, 0.82]) {
      ctx.fillStyle = rgba('#000000', 0.3);
      ctx.fillRect(Math.min(hingeX, fx), top + ih * ky - ih * 0.02, Math.abs(fx - hingeX), ih * 0.04);
      for (let i = 0; i < 4; i++) {
        const px = lerp(hingeX, fx, (i + 0.5) / 4);
        ctx.fillStyle = rgba(PAL.gold, 0.55);
        ctx.beginPath();
        ctx.arc(px, top + ih * ky, Math.max(0.8, w * 0.009), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    // 门缝的光边
    ctx.strokeStyle = rgba('#e9b86a', 0.2 + hover * 0.4 + open * 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(fx, fyTop);
    ctx.lineTo(fx, fyBot);
    ctx.stroke();
    // 铺首：跟着门扇走
    if (open < 0.85) {
      const mx = lerp(hingeX, fx, 0.78);
      ctx.save();
      ctx.translate(mx, top + ih * 0.5);
      ctx.scale(Math.max(0.25, Math.cos(ang)), 1);
      pushou(ctx, 0, 0, w * 0.055, { swing: (opts.knock ?? 0) * Math.sin(t * 9) * 0.35, lit: hover * 0.6 });
      ctx.restore();
    }
  }

  // 门缝透光（悬停时）
  if (hover > 0 && open < 0.2) {
    const g = ctx.createLinearGradient(x - 3, 0, x + 3, 0);
    g.addColorStop(0, rgba('#f4c67a', 0));
    g.addColorStop(0.5, rgba('#f8d590', 0.9 * hover));
    g.addColorStop(1, rgba('#f4c67a', 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - 3, top, 6, ih);
    glow(ctx, x, y - ih * 0.45, ih * 0.5, PAL.millet, 0.35 * hover);
  }

  // 门框、门楣、门槛
  ctx.fillStyle = opts.night === false ? '#4a2c1b' : '#2a1a10';
  ctx.fillRect(x - w / 2, y - h, post, h);
  ctx.fillRect(x + w / 2 - post, y - h, post, h);
  ctx.fillRect(x - w / 2 - post * 0.4, y - h - lintel * 0.2, w + post * 0.8, lintel);
  ctx.fillRect(x - w / 2, y - h * 0.025, w, h * 0.025);
  ctx.strokeStyle = rgba(PAL.gold, 0.32);
  ctx.lineWidth = 0.8;
  ctx.strokeRect(x - w / 2 - post * 0.4 + 2, y - h - lintel * 0.2 + 2, w + post * 0.8 - 4, lintel - 4);
  cloudScroll(ctx, x, y - h + lintel * 0.3, lintel * 0.42, { color: PAL.gold, alpha: 0.45, seed: 5 });
  // 地上的光
  if (light > 0) glow(ctx, x, y, iw * 1.1, '#e0a050', 0.35 * light);
  return {
    knockers: [
      { x: x0 + iw * 0.5 - (iw / 2) * 0.22, y: top + ih * 0.5, r: w * 0.07 },
      { x: x0 + iw * 0.5 + (iw / 2) * 0.22, y: top + ih * 0.5, r: w * 0.07 },
    ],
    opening: { x: x0, y: top, w: iw, h: ih },
  };
}

// ============================================================
// 十五连盏灯
// ============================================================

export interface LampSpot {
  x: number;
  y: number;
}

/** 灯树上每盏灯的位置（大致自上而下）。(x,y) 底座中点，h 全高 */
const LAMP_SPOTS: [number, number][] = [
  [0, 0.985], [-0.14, 0.885], [0.16, 0.855], [-0.3, 0.765], [0.31, 0.725], [-0.19, 0.655], [0.21, 0.615], [-0.41, 0.585],
  [0.42, 0.545], [-0.3, 0.465], [0.3, 0.435], [-0.47, 0.405], [0.48, 0.365], [-0.36, 0.3], [0.37, 0.28],
];
export function lampTreeLamps(x: number, y: number, h: number, n = 15): LampSpot[] {
  return LAMP_SPOTS.slice(0, n).map(([u, v]) => ({ x: x + u * h, y: y - v * h }));
}

/**
 * 十五连盏灯：青铜灯树（中山王墓那一棵的意思：枝如龙、枝上有鸟有猴）。
 * (x,y) 底座中点；h 全高；lit 每盏 0..1（数组或统一值），编号见 lampTreeLamps。返回每盏灯的屏幕位置。
 */
export function lampTree(ctx: C2D, x: number, y: number, h: number, opts: { lit?: number | number[]; t?: number; n?: number } = {}) {
  const n = opts.n ?? 15;
  const t = opts.t ?? 0;
  const lamps = lampTreeLamps(0, 0, h, n);
  const litAt = (i: number) => clamp(typeof opts.lit === 'number' ? opts.lit : (opts.lit?.[i] ?? 0));
  const total = lamps.reduce((a, _, i) => a + litAt(i), 0) / n;
  const dpr = deviceScale(ctx);
  const pad = h * 0.56;
  // 铜树本身静止：缓存
  const c = cached(`lamptree2:${n}`, pad * 2, h * 1.08, dpr, (g, cw) => {
    g.translate(cw / 2, h * 1.04);
    paintLampTree(g, h, lamps);
  });
  ctx.drawImage(c, x - pad, y - h * 1.04, pad * 2, h * 1.08);
  // 亮着的灯把附近的铜照暖
  for (let i = 0; i < lamps.length; i++) {
    const k = litAt(i);
    if (k > 0) glow(ctx, x + lamps[i]!.x, y + lamps[i]!.y + h * 0.03, h * 0.1, '#c9803a', 0.35 * k);
  }
  for (let i = 0; i < lamps.length; i++) {
    const L = lamps[i]!;
    const k = litAt(i);
    if (k <= 0) continue;
    flame(ctx, x + L.x, y + L.y - h * 0.008, h * 0.045, t, k, { seed: i * 7 + 1 });
  }
  if (total > 0) glow(ctx, x, y - h * 0.6, h * 0.85, PAL.millet, total * 0.22);
  return lamps.map((L) => ({ x: x + L.x, y: y + L.y }));
}

function paintLampTree(g: C2D, h: number, lamps: LampSpot[]) {
  const dark = '#18201b';
  const mid = '#26332b';
  const line = rgba(PAL.gold, 0.4);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // 枝：从主干 S 形弯出去，像龙身，托住灯盏
  const branchEnds: { u: number; v: number; bx: number; by: number }[] = [];
  for (const L of lamps) {
    if (Math.abs(L.x) < 1) continue;
    const u = L.x;
    const by = L.y + h * (0.1 + Math.abs(u) / h * 0.12);
    branchEnds.push({ u, v: L.y, bx: 0, by });
    const c1 = { x: u * 0.3, y: by - h * 0.07 };
    const c2 = { x: u * 0.7, y: L.y + h * 0.07 };
    for (const [col, lw] of [[dark, h * 0.014], [mid, h * 0.007]] as const) {
      g.strokeStyle = col;
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(0, by);
      g.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, u, L.y + h * 0.012);
      g.stroke();
    }
    g.strokeStyle = line;
    g.lineWidth = Math.max(0.6, h * 0.0022);
    g.beginPath();
    g.moveTo(0, by - h * 0.004);
    g.bezierCurveTo(c1.x, c1.y - h * 0.004, c2.x, c2.y - h * 0.004, u, L.y + h * 0.006);
    g.stroke();
  }
  // 主干：细长，略收
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(-h * 0.02, -h * 0.07);
  g.quadraticCurveTo(-h * 0.01, -h * 0.55, -h * 0.005, -h * 0.98);
  g.lineTo(h * 0.005, -h * 0.98);
  g.quadraticCurveTo(h * 0.01, -h * 0.55, h * 0.02, -h * 0.07);
  g.closePath();
  g.fill();
  // 盘在干上的龙：一道金线绕上去
  g.strokeStyle = rgba(PAL.gold, 0.45);
  g.lineWidth = Math.max(0.7, h * 0.003);
  g.beginPath();
  for (let i = 0; i <= 80; i++) {
    const k = i / 80;
    const yy = -h * (0.1 + k * 0.5);
    const xx = Math.sin(k * Math.PI * 7) * h * (0.018 - k * 0.008);
    if (i === 0) g.moveTo(xx, yy);
    else g.lineTo(xx, yy);
  }
  g.stroke();
  g.fillStyle = rgba(PAL.gold, 0.6);
  g.beginPath();
  g.arc(h * 0.01, -h * 0.6, h * 0.005, 0, TAU);
  g.fill();
  // 底座：圆座，三只虎足，金卷
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(-h * 0.19, -h * 0.01);
  g.bezierCurveTo(-h * 0.17, -h * 0.07, -h * 0.07, -h * 0.095, -h * 0.025, -h * 0.1);
  g.lineTo(h * 0.025, -h * 0.1);
  g.bezierCurveTo(h * 0.07, -h * 0.095, h * 0.17, -h * 0.07, h * 0.19, -h * 0.01);
  g.closePath();
  g.fill();
  g.strokeStyle = line;
  g.lineWidth = Math.max(0.6, h * 0.0025);
  g.stroke();
  g.beginPath();
  g.ellipse(0, -h * 0.045, h * 0.13, h * 0.012, 0, Math.PI, TAU);
  g.stroke();
  for (const s of [-1, 1]) cloudScroll(g, s * h * 0.085, -h * 0.03, h * 0.035, { color: PAL.gold, alpha: 0.45, flip: s as 1 | -1, seed: 9, width: 0.11 });
  for (const s of [-1, 0, 1]) {
    g.fillStyle = dark;
    g.beginPath();
    g.ellipse(s * h * 0.15, -h * 0.006, h * 0.032, h * 0.012, 0, 0, TAU);
    g.fill();
  }
  // 灯盏：浅盘
  for (const L of lamps) {
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(L.x - h * 0.032, L.y);
    g.quadraticCurveTo(L.x, L.y + h * 0.028, L.x + h * 0.032, L.y);
    g.closePath();
    g.fill();
    g.strokeStyle = rgba(PAL.gold, 0.55);
    g.lineWidth = Math.max(0.6, h * 0.0028);
    g.beginPath();
    g.moveTo(L.x - h * 0.032, L.y);
    g.lineTo(L.x + h * 0.032, L.y);
    g.stroke();
  }
  // 枝上的小鸟、挂着的小猴
  const bird = (bx: number, by: number, s: number, f: number) => {
    g.save();
    g.translate(bx, by);
    g.scale(f, 1);
    g.fillStyle = dark;
    g.beginPath();
    g.ellipse(0, 0, s, s * 0.48, -0.25, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(s * 0.9, -s * 0.5, s * 0.36, 0, TAU);
    g.fill();
    g.beginPath();
    g.moveTo(s * 1.2, -s * 0.5);
    g.lineTo(s * 1.65, -s * 0.38);
    g.lineTo(s * 1.2, -s * 0.36);
    g.fill();
    g.beginPath();
    g.moveTo(-s * 0.7, 0);
    g.lineTo(-s * 1.9, -s * 0.6);
    g.lineTo(-s * 1.5, s * 0.25);
    g.fill();
    g.strokeStyle = line;
    g.lineWidth = Math.max(0.5, s * 0.12);
    g.beginPath();
    g.arc(0, 0, s * 0.55, -2.6, -0.4);
    g.stroke();
    g.restore();
  };
  bird(h * 0.24, -h * 0.66, h * 0.017, -1);
  bird(-h * 0.1, -h * 0.85, h * 0.014, 1);
  bird(-h * 0.33, -h * 0.47, h * 0.015, 1);
  // 猴：一手挂枝
  const mx = h * 0.34;
  const my = -h * 0.505;
  g.strokeStyle = dark;
  g.lineWidth = Math.max(1, h * 0.005);
  g.beginPath();
  g.moveTo(mx, my);
  g.lineTo(mx - h * 0.004, my + h * 0.03);
  g.stroke();
  g.fillStyle = dark;
  g.beginPath();
  g.ellipse(mx - h * 0.004, my + h * 0.045, h * 0.01, h * 0.017, 0.2, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(mx + h * 0.004, my + h * 0.024, h * 0.008, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(mx - h * 0.01, my + h * 0.06);
  g.quadraticCurveTo(mx - h * 0.03, my + h * 0.08, mx - h * 0.02, my + h * 0.1);
  g.stroke();
}

// ============================================================
// 漆案、耳杯、热气、席
// ============================================================

/** 矮漆案。(x,y) 底边中点，w 宽；height 为高/宽比（默认 0.2）。返回案面的 y（放东西用） */
export function lowTable(ctx: C2D, x: number, y: number, w: number, opts: { lit?: number; height?: number } = {}) {
  const h = w * (opts.height ?? 0.2);
  const top = y - h;
  const th = w * 0.035;
  const depth = w * 0.07;
  const lit = opts.lit ?? 0.3;
  ctx.save();
  // 蹄足
  ctx.fillStyle = '#0d0907';
  for (const s of [-1, 1]) {
    for (const back of [0, 1]) {
      const lx = x + s * (w * 0.42 - back * w * 0.03);
      ctx.globalAlpha = back ? 0.7 : 1;
      ctx.beginPath();
      ctx.moveTo(lx - w * 0.012, top + th);
      ctx.quadraticCurveTo(lx - w * 0.02 * s, y - h * 0.3, lx + w * 0.006 * s, y - (back ? depth * 0.5 : 0));
      ctx.lineTo(lx + w * 0.03 * s, y - (back ? depth * 0.5 : 0));
      ctx.quadraticCurveTo(lx + w * 0.008 * s, y - h * 0.3, lx + w * 0.014, top + th);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // 案面（略见顶面）
  ctx.fillStyle = mix(PAL.lacquer2, '#5a3424', lit * 0.5);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, top);
  ctx.lineTo(x - w / 2 + depth * 0.6, top - depth);
  ctx.lineTo(x + w / 2 - depth * 0.6, top - depth);
  ctx.lineTo(x + w / 2, top);
  ctx.closePath();
  ctx.fill();
  // 顶面朱线
  ctx.strokeStyle = rgba(PAL.cinnabar, 0.75);
  ctx.lineWidth = Math.max(0.8, w * 0.004);
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + depth * 0.5, top - depth * 0.2);
  ctx.lineTo(x - w / 2 + depth * 0.9, top - depth * 0.8);
  ctx.lineTo(x + w / 2 - depth * 0.9, top - depth * 0.8);
  ctx.lineTo(x + w / 2 - depth * 0.5, top - depth * 0.2);
  ctx.closePath();
  ctx.stroke();
  // 正面：黑漆，朱带，金云纹
  ctx.fillStyle = PAL.lacquer;
  ctx.fillRect(x - w / 2, top, w, th);
  ctx.fillStyle = PAL.cinnabar;
  ctx.fillRect(x - w / 2, top + th * 0.18, w, th * 0.14);
  ctx.fillRect(x - w / 2, top + th * 0.7, w, th * 0.12);
  const n = Math.max(3, Math.round(w / (th * 3.2)));
  for (let i = 0; i < n; i++) {
    cloudScroll(ctx, x - w / 2 + ((i + 0.5) / n) * w, top + th * 0.5, th * 0.6, { color: PAL.gold, seed: i % 5, flip: i % 2 ? 1 : -1, alpha: 0.8, width: 0.1 });
  }
  // 案沿的光
  ctx.strokeStyle = rgba(PAL.gold, 0.25 + lit * 0.3);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, top);
  ctx.lineTo(x + w / 2, top);
  ctx.stroke();
  ctx.restore();
  return { top: top - depth * 0.45, front: top, left: x - w / 2, right: x + w / 2, depth };
}

/** 热气：几缕往上散的帛色烟。(x,y) 起点，s 高 */
export function steam(ctx: C2D, x: number, y: number, s: number, t: number, intensity = 1) {
  if (intensity <= 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.35 + i / 3) % 1;
    const a = Math.sin(ph * Math.PI) * 0.35 * intensity;
    if (a <= 0.01) continue;
    ctx.strokeStyle = rgba(PAL.silk, a);
    ctx.lineWidth = Math.max(0.8, s * 0.06 * (1 - ph * 0.5));
    ctx.beginPath();
    const ox = (i - 1) * s * 0.12;
    for (let k = 0; k <= 12; k++) {
      const u = k / 12;
      const yy = y - u * s * (0.4 + ph * 0.8);
      const xx = x + ox + Math.sin(u * 5 + t * 1.6 + i * 2) * s * 0.08 * (0.4 + u);
      if (k === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** 耳杯：外黑内朱，两耳。(x,y) 底边中点，s 宽。steam 0..1 */
export function earCup(ctx: C2D, x: number, y: number, s: number, opts: { t?: number; steam?: number } = {}) {
  const h = s * 0.32;
  ctx.save();
  // 耳
  ctx.fillStyle = PAL.lacquer;
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + sd * s * 0.47, y - h * 0.92, s * 0.14, s * 0.05, sd * 0.15, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(PAL.cinnabar, 0.8);
    ctx.lineWidth = Math.max(0.6, s * 0.012);
    ctx.stroke();
  }
  // 杯身
  ctx.beginPath();
  ctx.moveTo(x - s * 0.42, y - h);
  ctx.quadraticCurveTo(x - s * 0.38, y, x - s * 0.18, y);
  ctx.lineTo(x + s * 0.18, y);
  ctx.quadraticCurveTo(x + s * 0.38, y, x + s * 0.42, y - h);
  ctx.closePath();
  ctx.fillStyle = PAL.lacquer;
  ctx.fill();
  ctx.strokeStyle = rgba(PAL.cinnabar, 0.9);
  ctx.lineWidth = Math.max(0.6, s * 0.014);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.36, y - h * 0.62);
  ctx.quadraticCurveTo(x, y - h * 0.48, x + s * 0.36, y - h * 0.62);
  ctx.stroke();
  // 口：内朱
  ctx.fillStyle = PAL.cinnabar;
  ctx.beginPath();
  ctx.ellipse(x, y - h, s * 0.42, s * 0.07, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = mix(PAL.cinnabar, '#3a1208', 0.5);
  ctx.beginPath();
  ctx.ellipse(x, y - h + s * 0.012, s * 0.33, s * 0.045, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(PAL.gold, 0.5);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(x, y - h, s * 0.42, s * 0.07, 0, Math.PI, TAU);
  ctx.stroke();
  ctx.restore();
  if ((opts.steam ?? 1) > 0) steam(ctx, x, y - h - s * 0.04, s * 1.3, opts.t ?? 0, opts.steam ?? 1);
}

/** 席：铺在地上的竹席（夜里很暗），(x,y) 底边中点 */
export function mat(ctx: C2D, x: number, y: number, w: number, d: number, opts: { lit?: number } = {}) {
  const lit = opts.lit ?? 0.3;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2 + d * 0.8, y - d);
  ctx.lineTo(x + w / 2 - d * 0.8, y - d);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  ctx.fillStyle = mix('#2a1c12', '#5a4128', lit * 0.5);
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = rgba('#000000', 0.25);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 40; i++) {
    const yy = y - (i / 40) * d;
    ctx.beginPath();
    ctx.moveTo(x - w, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(PAL.cinnabar, 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 6, y - 3);
  ctx.lineTo(x + w / 2 - 6, y - 3);
  ctx.stroke();
  ctx.restore();
}

/** 小门罩：门楣上一段黑瓦檐。(x,y) 檐下沿中点，w 宽 */
export function eave(ctx: C2D, x: number, y: number, w: number, opts: { night?: boolean } = {}) {
  const h = w * 0.16;
  const night = opts.night ?? true;
  ctx.save();
  ctx.fillStyle = night ? '#0a0706' : PAL.lacquer2;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - w * 0.04, y - h * 0.25);
  ctx.quadraticCurveTo(x - w * 0.3, y + h * 0.05, x - w * 0.2, y);
  ctx.lineTo(x + w * 0.2, y);
  ctx.quadraticCurveTo(x + w * 0.3, y + h * 0.05, x + w / 2 + w * 0.04, y - h * 0.25);
  ctx.lineTo(x + w * 0.34, y - h);
  ctx.lineTo(x - w * 0.34, y - h);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = night ? 'rgba(110,85,60,0.35)' : rgba(PAL.umber, 0.8);
  ctx.lineWidth = 1;
  for (let k = -10; k <= 10; k++) {
    ctx.beginPath();
    ctx.moveTo(x + k * w * 0.034, y - h);
    ctx.lineTo(x + k * w * 0.05, y + 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = night ? '#050403' : PAL.lacquer;
  ctx.fillRect(x - w * 0.37, y - h * 1.12, w * 0.74, h * 0.16);
  ctx.strokeStyle = rgba(PAL.gold, 0.35);
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - w * 0.04, y - h * 0.25);
  ctx.quadraticCurveTo(x - w * 0.3, y + h * 0.05, x - w * 0.2, y);
  ctx.lineTo(x + w * 0.2, y);
  ctx.quadraticCurveTo(x + w * 0.3, y + h * 0.05, x + w / 2 + w * 0.04, y - h * 0.25);
  ctx.stroke();
  ctx.restore();
}

/** 漆屏风：三扇黑漆，朱边，金云纹。(x,y) 底边中点，w 宽，h 高；lit 0..1 被灯照到 */
export function screen(ctx: C2D, x: number, y: number, w: number, h: number, opts: { lit?: number; panels?: number } = {}) {
  const n = opts.panels ?? 3;
  const lit = clamp(opts.lit ?? 0.3);
  const pw = w / n;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const px = x - w / 2 + i * pw;
    // 折扇的明暗交替
    ctx.fillStyle = mix(i % 2 ? '#0e0a08' : '#18110d', '#3a2418', lit * 0.35);
    ctx.fillRect(px + 1, y - h, pw - 2, h * 0.94);
    ctx.strokeStyle = rgba(PAL.cinnabar, 0.55 + lit * 0.2);
    ctx.lineWidth = Math.max(1, pw * 0.025);
    ctx.strokeRect(px + pw * 0.06, y - h + pw * 0.06, pw * 0.88, h * 0.94 - pw * 0.12);
    ctx.strokeStyle = rgba(PAL.gold, 0.2 + lit * 0.25);
    ctx.lineWidth = Math.max(0.6, pw * 0.008);
    ctx.strokeRect(px + pw * 0.11, y - h + pw * 0.11, pw * 0.78, h * 0.94 - pw * 0.22);
    for (let k = 0; k < 3; k++) {
      cloudScroll(ctx, px + pw / 2, y - h + (h * 0.94) * (0.24 + k * 0.26), pw * 0.26, { color: PAL.gold, alpha: 0.18 + lit * 0.3, seed: i * 3 + k, flip: (k + i) % 2 ? 1 : -1, width: 0.1 });
    }
  }
  // 座
  ctx.fillStyle = '#0a0706';
  for (let i = 0; i <= n; i++) {
    const px = x - w / 2 + i * pw;
    ctx.fillRect(px - pw * 0.08, y - h * 0.07, pw * 0.16, h * 0.07);
  }
  ctx.restore();
}

// ============================================================
// 票根
// ============================================================

/**
 * 票根：帛条、朱边、一个画出来的「旱」。(x,y) 中心，w 宽（高约 2.4w）。
 * lift 0..1 抬起（影子拉开），glow 0..1 金光，write 0..1 字写出来，seal 0..1 盖印动画，angle 弧度。
 */
export function ticket(ctx: C2D, x: number, y: number, w: number, opts: { lift?: number; glow?: number; angle?: number; t?: number; write?: number; seal?: number; glyph?: string; flat?: number } = {}) {
  const h = w * 2.4;
  const lift = clamp(opts.lift ?? 0);
  const gl = clamp(opts.glow ?? 0);
  const t = opts.t ?? 0;
  const hover = Math.sin(t * 2.2) * lift * w * 0.02;
  const dy = -lift * w * 0.25 + hover;
  // 影子
  ctx.save();
  ctx.translate(x + lift * w * 0.08, y + lift * w * 0.12);
  ctx.rotate(opts.angle ?? 0);
  ctx.scale(1, 1 - clamp(opts.flat ?? 0) * 0.55);
  ctx.fillStyle = rgba('#000000', 0.3 - lift * 0.12);
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.fill();
  ctx.restore();
  if (gl > 0) glow(ctx, x, y + dy, h * 0.9, PAL.millet, gl * 0.55);
  ctx.save();
  ctx.translate(x, y + dy);
  ctx.rotate(opts.angle ?? 0);
  ctx.scale(1, 1 - clamp(opts.flat ?? 0) * 0.55);
  // 帛
  const dpr = deviceScale(ctx);
  const c = cached('ticket', 100, 240, dpr, (g) => {
    const r = rng(41);
    g.fillStyle = PAL.silk;
    g.beginPath();
    // 毛边
    g.moveTo(0, 0);
    for (let i = 0; i <= 10; i++) g.lineTo(i * 10, (r() - 0.5) * 1.6);
    for (let i = 0; i <= 24; i++) g.lineTo(100 + (r() - 0.5) * 1.2, i * 10);
    for (let i = 10; i >= 0; i--) g.lineTo(i * 10, 240 + (r() - 0.5) * 1.6);
    for (let i = 24; i >= 0; i--) g.lineTo((r() - 0.5) * 1.2, i * 10);
    g.closePath();
    g.fill();
    g.save();
    g.clip();
    for (let yy = 0; yy < 240; yy += 1.6 + r() * 1.5) {
      g.fillStyle = rgba(PAL.silkDim, 0.18);
      g.fillRect(0, yy, 100, 0.5);
    }
    const gr = g.createLinearGradient(0, 0, 100, 240);
    gr.addColorStop(0, rgba('#fff8e8', 0.25));
    gr.addColorStop(1, rgba(PAL.silkDim, 0.35));
    g.fillStyle = gr;
    g.fillRect(0, 0, 100, 240);
    g.restore();
    // 朱边：粗细两道
    g.strokeStyle = PAL.cinnabar;
    g.lineWidth = 4.2;
    g.strokeRect(7, 7, 86, 226);
    g.lineWidth = 1.2;
    g.strokeRect(13.5, 13.5, 73, 213);
    // 顶端系绳孔
    g.fillStyle = PAL.umber;
    g.beginPath();
    g.arc(50, 22, 2.6, 0, TAU);
    g.fill();
  });
  ctx.drawImage(c, -w / 2, -h / 2, w, h);
  drawGlyph(ctx, opts.glyph ?? '旱', 0, -h * 0.08, w * 0.72, { color: TONE.ink, progress: opts.write ?? 1, style: 'brush' });
  if ((opts.seal ?? 0) > 0) seal(ctx, w * 0.12, h * 0.33, w * 0.32, { glyph: opts.glyph ?? '旱', progress: opts.seal, angle: 0.05 });
  if (gl > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(TONE.goldLight, 0.5 * gl);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
  return { x, y: y + dy, w, h };
}

// ============================================================
// 竹简
// ============================================================

/**
 * 一捆竹简（编绳两道）。(x,y) 底边中点，s 宽。open 0..1 摊开；marks=false 不画字迹。
 * 季的视角：毛坯，未盖印。
 */
export function bambooSlips(ctx: C2D, x: number, y: number, s: number, opts: { open?: number; marks?: boolean; n?: number } = {}) {
  const n = opts.n ?? 11;
  const open = easeOut(clamp(opts.open ?? 0));
  const sh = s * 0.95;
  const sw = s / n;
  const r = rng(13);
  ctx.save();
  const spread = lerp(0.42, 1.05, open);
  const span = s * spread;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1) - 0.5;
    const curl = (1 - open) * Math.cos(u * Math.PI) * s * 0.06;
    pts.push({ x: x + u * span, y: y - curl });
  }
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const wv = sw * 0.92;
    const hh = lerp(sh * 0.86, sh, open);
    const sk = (r() - 0.5) * 0.04;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(sk * (1 - open));
    ctx.fillStyle = i % 2 ? TONE.bamboo : mix(TONE.bamboo, TONE.bambooDark, 0.18);
    ctx.fillRect(-wv / 2, -hh, wv, hh);
    ctx.fillStyle = rgba(TONE.bambooDark, 0.6);
    ctx.fillRect(wv / 2 - 0.8, -hh, 0.8, hh);
    if (opts.marks !== false && open > 0.3) {
      ctx.fillStyle = rgba(TONE.ink, 0.65 * open);
      for (let k = 0; k < 7; k++) {
        if (r() < 0.25) continue;
        ctx.fillRect(-wv * 0.25, -hh + hh * (0.12 + k * 0.11), wv * 0.5, hh * 0.04);
      }
    }
    ctx.restore();
  }
  // 编绳
  ctx.strokeStyle = PAL.cinnabar;
  ctx.lineWidth = Math.max(0.8, s * 0.012);
  for (const k of [0.25, 0.75]) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = pts[i]!;
      const hh = lerp(sh * 0.86, sh, open);
      const yy = p.y - hh * k;
      if (i === 0) ctx.moveTo(p.x - sw, yy);
      ctx.lineTo(p.x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}
