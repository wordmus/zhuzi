// 心象里的东西：铜镜、四季转盘、小田伯的秤（情/利/名三砝码）、竹券、念头的种子与芽。

import { cloudScroll, ribbon } from './ornament';
import { PAL, TONE } from './palette';
import { cached, glow } from './texture';
import { type C2D, type Pt, TAU, clamp, deviceScale, easeOut, lerp, mix, rgba, rng, sampleSpline, span } from './util';

const SERIF = '"Noto Serif SC","Songti SC","STSong","SimSun",serif';

// ============================================================
// 铜镜
// ============================================================

/**
 * 铜镜：蟠螭纹镜缘、铜绿。(x,y) 中心，r 外半径；open 0..1 浮现（放大+淡入）。
 * inner(ctx, ri) 在镜面里作画：原点在镜心，已裁成圆，ri 为镜面半径。
 */
export function bronzeMirror(ctx: C2D, x: number, y: number, r: number, opts: { open?: number; t?: number } = {}, inner?: (ctx: C2D, ri: number) => void) {
  const open = clamp(opts.open ?? 1);
  if (open <= 0) return;
  const k = easeOut(open);
  const t = opts.t ?? 0;
  const ri = r * 0.72;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(lerp(0.6, 1, k), lerp(0.6, 1, k));
  ctx.globalAlpha *= clamp(open * 1.6);
  glow(ctx, 0, 0, r * 1.8, PAL.millet, 0.18 * k);
  // 镜面
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, ri, 0, TAU);
  ctx.clip();
  const g = ctx.createRadialGradient(-ri * 0.3, -ri * 0.4, 0, 0, 0, ri);
  g.addColorStop(0, '#3a4a40');
  g.addColorStop(1, '#141a16');
  ctx.fillStyle = g;
  ctx.fillRect(-ri, -ri, ri * 2, ri * 2);
  if (inner) {
    ctx.save();
    // 镜里的东西从中心「洇」开
    ctx.beginPath();
    ctx.arc(0, 0, ri * easeOut(span(open, 0.3, 1)), 0, TAU);
    ctx.clip();
    inner(ctx, ri);
    ctx.restore();
  }
  // 镜面的一道光
  ctx.globalCompositeOperation = 'lighter';
  const sh = ctx.createLinearGradient(-ri, -ri, ri, ri);
  const p = 0.3 + Math.sin(t * 0.3) * 0.05;
  sh.addColorStop(0, rgba('#ffffff', 0));
  sh.addColorStop(p, rgba('#f6e6c0', 0.1));
  sh.addColorStop(p + 0.08, rgba('#ffffff', 0));
  ctx.fillStyle = sh;
  ctx.fillRect(-ri, -ri, ri * 2, ri * 2);
  ctx.restore();
  // 镜缘（缓存）
  const dpr = deviceScale(ctx);
  const c = cached('mirror-rim', 200, 200, Math.max(dpr, (r * dpr) / 100), (g2) => paintRim(g2, 100, 100, 100));
  ctx.drawImage(c, -r, -r, r * 2, r * 2);
  ctx.restore();
}

function paintRim(g: C2D, cx: number, cy: number, r: number) {
  const rnd = rng(71);
  g.translate(cx, cy);
  // 外缘：宽素缘，铜色
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.arc(0, 0, r * 0.72, 0, TAU, true);
  const gr = g.createLinearGradient(0, -r, 0, r);
  gr.addColorStop(0, TONE.bronzeLight);
  gr.addColorStop(0.5, PAL.bronze);
  gr.addColorStop(1, TONE.bronzeDark);
  g.fillStyle = gr;
  g.fill('evenodd');
  // 铜锈斑
  for (let i = 0; i < 160; i++) {
    const a = rnd() * TAU;
    const rr = lerp(r * 0.73, r * 0.99, rnd());
    g.fillStyle = rnd() < 0.6 ? rgba(TONE.patina, 0.25 + rnd() * 0.3) : rgba('#000000', 0.18);
    g.beginPath();
    g.arc(Math.cos(a) * rr, Math.sin(a) * rr, 0.5 + rnd() * 2, 0, TAU);
    g.fill();
  }
  // 纹带：蟠螭（沿圆周排一圈卷）
  g.strokeStyle = rgba(PAL.gold, 0.9);
  g.lineWidth = 1;
  for (const rr of [r * 0.97, r * 0.86, r * 0.74]) {
    g.beginPath();
    g.arc(0, 0, rr, 0, TAU);
    g.stroke();
  }
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    g.save();
    g.rotate(a);
    g.translate(0, -r * 0.8);
    cloudScroll(g, 0, 0, r * 0.075, { color: PAL.gold, seed: i % 4, flip: i % 2 ? 1 : -1, width: 0.12 });
    g.restore();
  }
  // 外圈小菱
  g.fillStyle = rgba(PAL.gold, 0.8);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    g.save();
    g.rotate(a);
    g.translate(0, -r * 0.915);
    g.beginPath();
    g.moveTo(0, -r * 0.03);
    g.lineTo(r * 0.018, 0);
    g.lineTo(0, r * 0.03);
    g.lineTo(-r * 0.018, 0);
    g.closePath();
    g.fill();
    g.restore();
  }
}

// ============================================================
// 四季转盘
// ============================================================

const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
const SEASON_CH = ['春', '夏', '秋', '冬'];
const SEASON_TINT = [TONE.patina, PAL.cinnabar, PAL.ochre, '#55524c'];

/**
 * 四季转盘：青铜圆盘，指针走。(x,y) 中心，r 半径；season 当前季；progress 0..1 季内进度。
 */
export function seasonDial(ctx: C2D, x: number, y: number, r: number, opts: { season?: (typeof SEASONS)[number] | number; progress?: number; t?: number } = {}) {
  const si = typeof opts.season === 'number' ? opts.season : SEASONS.indexOf(opts.season ?? 'spring');
  const prog = clamp(opts.progress ?? 0);
  ctx.save();
  ctx.translate(x, y);
  // 盘
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 0, 0, 0, r);
  g.addColorStop(0, TONE.bronzeLight);
  g.addColorStop(1, TONE.bronzeDark);
  ctx.fillStyle = g;
  ctx.fill();
  // 四象限：当季亮一点
  for (let i = 0; i < 4; i++) {
    const a0 = -Math.PI * 0.75 + i * (Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r * 0.84, a0, a0 + Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = rgba(SEASON_TINT[i]!, i === si ? 0.55 : 0.16);
    ctx.fill();
  }
  ctx.strokeStyle = rgba(PAL.gold, 0.8);
  ctx.lineWidth = Math.max(0.8, r * 0.025);
  for (const rr of [r * 0.97, r * 0.84]) {
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, TAU);
    ctx.stroke();
  }
  // 刻度
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI * 0.75 + (i / 12) * TAU;
    const major = i % 3 === 0;
    ctx.lineWidth = major ? Math.max(0.8, r * 0.03) : Math.max(0.5, r * 0.015);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * (major ? 0.68 : 0.76), Math.sin(a) * r * (major ? 0.68 : 0.76));
    ctx.lineTo(Math.cos(a) * r * 0.84, Math.sin(a) * r * 0.84);
    ctx.stroke();
  }
  // 字
  ctx.font = `600 ${Math.round(r * 0.3)}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + i * (Math.PI / 2);
    ctx.fillStyle = i === si ? TONE.goldLight : rgba(PAL.gold, 0.45);
    ctx.fillText(SEASON_CH[i]!, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5 + r * 0.02);
  }
  // 指针：司南勺的样子
  const a = -Math.PI * 0.75 + (si + prog) * (Math.PI / 2);
  ctx.rotate(a);
  ctx.fillStyle = PAL.gold;
  ctx.beginPath();
  ctx.moveTo(r * 0.8, 0);
  ctx.lineTo(r * 0.1, -r * 0.045);
  ctx.lineTo(r * 0.1, r * 0.045);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-r * 0.06, 0, r * 0.15, r * 0.11, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = TONE.bronzeDark;
  ctx.beginPath();
  ctx.arc(-r * 0.06, 0, r * 0.05, 0, TAU);
  ctx.fill();
  ctx.restore();
  return { angle: a };
}

// ============================================================
// 小田伯的秤
// ============================================================

export interface Weights3 {
  qing: number;
  li: number;
  ming: number;
}
export type WeightKey = keyof Weights3;
const WKEYS: WeightKey[] = ['qing', 'li', 'ming'];

/** 砝码上的图：情 = 握着的手；利 = 一袋粟；名 = 一圈小人 */
export function weightIcon(ctx: C2D, key: WeightKey, x: number, y: number, r: number, color: string = PAL.gold) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(0.7, r * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (key === 'qing') {
    // 两只手相握
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.scale(s, 1);
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, r * 0.25);
      ctx.lineTo(-r * 0.35, r * 0.05);
      ctx.quadraticCurveTo(r * 0.1, -r * 0.15, r * 0.35, r * 0.05);
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.02, r * 0.35, r * 0.28, 0, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, -r * 0.3);
    ctx.lineTo(-r * 0.15, r * 0.24);
    ctx.moveTo(r * 0.1, -r * 0.3);
    ctx.lineTo(r * 0.1, r * 0.24);
    ctx.stroke();
  } else if (key === 'li') {
    // 粟袋：束口
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.45);
    ctx.quadraticCurveTo(-r * 0.75, -r * 0.1, -r * 0.55, r * 0.45);
    ctx.quadraticCurveTo(0, r * 0.65, r * 0.55, r * 0.45);
    ctx.quadraticCurveTo(r * 0.75, -r * 0.1, r * 0.2, -r * 0.45);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.45);
    ctx.lineTo(-r * 0.35, -r * 0.72);
    ctx.moveTo(r * 0.2, -r * 0.45);
    ctx.lineTo(r * 0.35, -r * 0.72);
    ctx.stroke();
    for (const [px, py] of [[-0.2, 0.15], [0.15, 0.05], [0, 0.35], [0.28, 0.32], [-0.3, 0.38]] as const) {
      ctx.beginPath();
      ctx.arc(px * r, py * r, r * 0.06, 0, TAU);
      ctx.fill();
    }
  } else {
    // 一圈小人
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU - Math.PI / 2;
      const px = Math.cos(a) * r * 0.62;
      const py = Math.sin(a) * r * 0.62;
      ctx.beginPath();
      ctx.arc(px, py - r * 0.1, r * 0.1, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px - r * 0.1, py + r * 0.16);
      ctx.lineTo(px, py - r * 0.01);
      ctx.lineTo(px + r * 0.1, py + r * 0.16);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * 小田伯的秤：青铜小衡，长臂上挂三枚砝码（情、利、名），位置与大小表示「禾以为田伯有多在乎」。
 * (x,y) 底座中点，s 宽。weights 各 0..1；ghost 为上一次的权重（淡痕）；hot 高亮其中一枚（正在拖）。
 * 返回各砝码的位置，给拖拽热区；value(key, px) 把横坐标换回权重。
 */
export function scale(ctx: C2D, x: number, y: number, s: number, opts: { weights: Weights3; ghost?: Weights3 | null; t?: number; hot?: WeightKey | null }) {
  const t = opts.t ?? 0;
  const w = opts.weights;
  const sum = w.qing + w.li + w.ming;
  const tilt = clamp((sum - 1.5) * 0.12, -0.18, 0.18) + Math.sin(t * 1.3) * 0.006;
  const px = x - s * 0.28;
  const py = y - s * 0.62;
  const arm = s * 0.72;
  const back = s * 0.2;
  const v = { x: Math.cos(tilt), y: Math.sin(tilt) };
  const along = (d: number): Pt => ({ x: px + v.x * d, y: py + v.y * d });
  const posOf = (val: number) => s * 0.1 + clamp(val) * (arm - s * 0.14);
  const drops: Record<WeightKey, number> = { qing: s * 0.16, li: s * 0.3, ming: s * 0.44 };
  ctx.save();
  ctx.lineCap = 'round';
  // 底座与立柱
  ctx.fillStyle = TONE.bronzeDark;
  ctx.beginPath();
  ctx.moveTo(px - s * 0.12, y);
  ctx.quadraticCurveTo(px - s * 0.08, y - s * 0.05, px - s * 0.02, y - s * 0.06);
  ctx.lineTo(px + s * 0.02, y - s * 0.06);
  ctx.quadraticCurveTo(px + s * 0.08, y - s * 0.05, px + s * 0.12, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = TONE.bronzeDark;
  ctx.lineWidth = s * 0.022;
  ctx.beginPath();
  ctx.moveTo(px, y - s * 0.05);
  ctx.lineTo(px, py);
  ctx.stroke();
  ctx.strokeStyle = rgba(PAL.gold, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  // 横杆
  const a0 = along(-back);
  const a1 = along(arm);
  ctx.strokeStyle = PAL.bronze;
  ctx.lineWidth = s * 0.018;
  ctx.beginPath();
  ctx.moveTo(a0.x, a0.y);
  ctx.lineTo(a1.x, a1.y);
  ctx.stroke();
  ctx.strokeStyle = rgba(PAL.gold, 0.7);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(a0.x, a0.y - s * 0.006);
  ctx.lineTo(a1.x, a1.y - s * 0.006);
  ctx.stroke();
  // 刻度
  for (let i = 0; i <= 10; i++) {
    const p = along(posOf(i / 10));
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y + (i % 5 ? s * 0.012 : s * 0.025));
    ctx.stroke();
  }
  // 支点
  ctx.fillStyle = PAL.gold;
  ctx.beginPath();
  ctx.arc(px, py, s * 0.018, 0, TAU);
  ctx.fill();
  // 短臂上的秤盘（压着的配重）
  ctx.strokeStyle = rgba(PAL.gold, 0.6);
  ctx.beginPath();
  ctx.moveTo(a0.x, a0.y);
  ctx.lineTo(a0.x - s * 0.04, a0.y + s * 0.12);
  ctx.moveTo(a0.x, a0.y);
  ctx.lineTo(a0.x + s * 0.04, a0.y + s * 0.12);
  ctx.stroke();
  ctx.fillStyle = TONE.bronzeDark;
  ctx.beginPath();
  ctx.ellipse(a0.x, a0.y + s * 0.125, s * 0.06, s * 0.014, 0, 0, TAU);
  ctx.fill();
  // 改稿留痕：旧位置
  if (opts.ghost) {
    for (const key of WKEYS) {
      const g = opts.ghost[key];
      if (Math.abs(g - w[key]) < 0.01) continue;
      const p = along(posOf(g));
      const rr = s * 0.04 * (0.75 + g * 0.6);
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = rgba(PAL.gold, 0.35);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y + drops[key]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(p.x, p.y + drops[key] + rr, rr, 0, TAU);
      ctx.stroke();
      // 一道痕：从旧到新
      const q = along(posOf(w[key]));
      ctx.strokeStyle = rgba(PAL.cinnabar, 0.4);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + drops[key] + rr);
      ctx.lineTo(q.x, q.y + drops[key] + rr);
      ctx.stroke();
    }
  }
  // 砝码
  const out = {} as Record<WeightKey, { x: number; y: number; r: number }>;
  for (const key of WKEYS) {
    const val = w[key];
    const p = along(posOf(val));
    const sway = Math.sin(t * 1.6 + WKEYS.indexOf(key)) * s * 0.004;
    const rr = s * 0.04 * (0.75 + val * 0.6);
    const cy = p.y + drops[key] + rr;
    const cx = p.x + sway;
    ctx.strokeStyle = rgba(PAL.gold, 0.75);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(cx, cy - rr);
    ctx.stroke();
    const hot = opts.hot === key;
    if (hot) glow(ctx, cx, cy, rr * 3, PAL.millet, 0.5);
    // 铜砝码：钟形
    ctx.beginPath();
    ctx.moveTo(cx - rr * 0.55, cy - rr * 0.9);
    ctx.quadraticCurveTo(cx - rr * 1.15, cy, cx - rr * 1.05, cy + rr * 0.85);
    ctx.lineTo(cx + rr * 1.05, cy + rr * 0.85);
    ctx.quadraticCurveTo(cx + rr * 1.15, cy, cx + rr * 0.55, cy - rr * 0.9);
    ctx.closePath();
    const g = ctx.createLinearGradient(cx - rr, cy, cx + rr, cy);
    g.addColorStop(0, TONE.bronzeLight);
    g.addColorStop(1, TONE.bronzeDark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = rgba(PAL.gold, hot ? 1 : 0.7);
    ctx.stroke();
    weightIcon(ctx, key, cx, cy + rr * 0.05, rr * 0.62, hot ? TONE.goldLight : PAL.gold);
    out[key] = { x: cx, y: cy, r: rr * 1.2 };
  }
  ctx.restore();
  return {
    weights: out,
    pivot: { x: px, y: py },
    /** 把横坐标（屏幕）换回 0..1 的权重 */
    value: (screenX: number) => clamp((screenX - px - s * 0.1) / (arm - s * 0.14)),
  };
}
/** scale 的别名（避免与变量名冲突） */
export const balance = scale;

// ============================================================
// 竹券
// ============================================================

/**
 * 竹券：一片刻齿的竹，掰成两半。(x,y) 中心，s 长；split 0..1。
 */
export function tally(ctx: C2D, x: number, y: number, s: number, opts: { split?: number; t?: number; angle?: number } = {}) {
  const split = clamp(opts.split ?? 0);
  const h = s * 0.15;
  const k = easeOut(split);
  // 断口：锯齿
  const r = rng(5);
  const cut: Pt[] = [];
  for (let i = 0; i <= 8; i++) cut.push({ x: (r() - 0.5) * s * 0.05, y: -h / 2 + (i / 8) * h });
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(opts.angle ?? 0);
  for (const side of [-1, 1] as const) {
    ctx.save();
    ctx.translate(side * s * 0.12 * k, k * s * 0.03);
    ctx.rotate(side * 0.16 * k);
    ctx.beginPath();
    if (side < 0) {
      ctx.moveTo(-s / 2, -h / 2);
      for (const p of cut) ctx.lineTo(p.x, p.y);
      ctx.lineTo(-s / 2, h / 2);
    } else {
      ctx.moveTo(s / 2, -h / 2);
      for (const p of cut) ctx.lineTo(p.x, p.y);
      ctx.lineTo(s / 2, h / 2);
    }
    ctx.closePath();
    ctx.clip();
    // 竹面
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, mix(TONE.bamboo, '#f0d9a0', 0.35));
    g.addColorStop(0.6, TONE.bamboo);
    g.addColorStop(1, TONE.bambooDark);
    ctx.fillStyle = g;
    ctx.fillRect(-s / 2, -h / 2, s, h);
    // 竹纤维
    ctx.strokeStyle = rgba(TONE.bambooDark, 0.35);
    ctx.lineWidth = 0.6;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(-s / 2, -h / 2 + (i / 6) * h);
      ctx.lineTo(s / 2, -h / 2 + (i / 6) * h);
      ctx.stroke();
    }
    // 竹节
    ctx.fillStyle = rgba(TONE.bambooDark, 0.6);
    ctx.fillRect(-s * 0.3, -h / 2, s * 0.012, h);
    ctx.fillRect(s * 0.32, -h / 2, s * 0.012, h);
    // 字迹
    ctx.fillStyle = rgba(TONE.ink, 0.75);
    for (let i = 0; i < 9; i++) {
      const px = -s * 0.42 + i * s * 0.1;
      if (Math.abs(px) < s * 0.03) continue;
      ctx.fillRect(px, -h * 0.12, s * 0.035, h * 0.08);
      ctx.fillRect(px + s * 0.01, h * 0.06, s * 0.02, h * 0.07);
    }
    ctx.restore();
  }
  // 刻齿（上沿三角缺口，跨过断口）
  ctx.fillStyle = PAL.lacquer;
  for (let i = -3; i <= 3; i++) {
    const side = i < 0 ? -1 : i > 0 ? 1 : 0;
    const ox = side * s * 0.12 * k;
    const px = i * s * 0.06 + ox;
    const py = -h / 2 + k * s * 0.03 + side * i * 0.01 * k;
    ctx.beginPath();
    ctx.moveTo(px - s * 0.012, py - 0.5);
    ctx.lineTo(px + s * 0.012, py - 0.5);
    ctx.lineTo(px, py + h * 0.22);
    ctx.closePath();
    ctx.globalAlpha = 0.85;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // 竹屑
  if (split > 0 && split < 0.7) {
    const q = span(split, 0, 0.7);
    const rr = rng(9);
    ctx.fillStyle = rgba(mix(TONE.bamboo, '#f4e2b0', 0.4), 1 - q);
    for (let i = 0; i < 9; i++) {
      const a = rr() * TAU;
      const d = q * s * (0.08 + rr() * 0.15);
      ctx.save();
      ctx.translate(Math.cos(a) * d, Math.sin(a) * d - q * s * 0.02);
      ctx.rotate(a);
      ctx.fillRect(-s * 0.012, -0.6, s * 0.024, 1.2);
      ctx.restore();
    }
  }
  ctx.restore();
}

// ============================================================
// 念头：种子与芽
// ============================================================

/**
 * 一颗念头的种子。(x,y) 中心，r 半高。lit 0..1：亮的是正在想的，暗的是被挡下的。text 可写一个概念字（天、社…）。
 */
export function seedGlyph(ctx: C2D, x: number, y: number, r: number, opts: { lit?: number; t?: number; text?: string; angle?: number } = {}) {
  const lit = clamp(opts.lit ?? 1);
  const t = opts.t ?? 0;
  const pulse = 1 + Math.sin(t * 2.2 + x * 0.05) * 0.06 * lit;
  if (lit > 0) glow(ctx, x, y, r * 4.2 * pulse, PAL.millet, 0.55 * lit);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(opts.angle ?? -0.3);
  ctx.scale(pulse, pulse);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(r * 0.75, -r * 0.55, r * 0.7, r * 0.6, 0, r);
  ctx.bezierCurveTo(-r * 0.7, r * 0.6, -r * 0.75, -r * 0.55, 0, -r);
  ctx.closePath();
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, mix(PAL.umber, '#f2d48a', lit));
  g.addColorStop(1, mix('#1a120c', PAL.ochre, lit));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(PAL.gold, 0.35 + 0.6 * lit);
  ctx.lineWidth = Math.max(0.7, r * 0.08);
  ctx.stroke();
  // 种脐的一道线
  ctx.strokeStyle = rgba(lit > 0.5 ? '#fff4d0' : PAL.gold, 0.35 + lit * 0.5);
  ctx.lineWidth = Math.max(0.5, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.7);
  ctx.quadraticCurveTo(r * 0.18, 0, 0, r * 0.7);
  ctx.stroke();
  ctx.restore();
  if (opts.text) {
    ctx.save();
    ctx.font = `600 ${Math.round(r * 0.95)}px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = lit > 0.5 ? TONE.ink : rgba(PAL.gold, 0.6);
    ctx.fillText(opts.text, x, y + r * 0.05);
    ctx.restore();
  }
}

/** 芽：从土里拱出、展开两片叶。(x,y) 土面，s 高；grow 0..1 */
export function sprout(ctx: C2D, x: number, y: number, s: number, opts: { grow?: number; t?: number; glow?: number } = {}) {
  const grow = clamp(opts.grow ?? 1);
  if (grow <= 0) return;
  const t = opts.t ?? 0;
  const stem = easeOut(span(grow, 0, 0.6));
  const leaves = easeOut(span(grow, 0.4, 1));
  const sway = Math.sin(t * 1.5) * 0.06;
  ctx.save();
  // 土包
  ctx.fillStyle = mix(PAL.loess, PAL.umber, 0.4);
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.28, s * 0.07, 0, Math.PI, TAU);
  ctx.fill();
  const top = { x: x + Math.sin(sway) * s * 0.6 * stem, y: y - s * 0.65 * stem };
  if ((opts.glow ?? 0.6) > 0) glow(ctx, top.x, top.y, s * 0.7, PAL.millet, (opts.glow ?? 0.6) * grow * 0.6);
  ctx.strokeStyle = TONE.leaf;
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - s * 0.06, y - s * 0.35 * stem, top.x, top.y);
  ctx.stroke();
  if (leaves > 0) {
    ctx.fillStyle = mix(TONE.leaf, '#a9b26a', 0.35);
    for (const side of [-1, 1]) {
      const L = s * 0.36 * leaves;
      const pts = sampleSpline(
        [
          top,
          { x: top.x + side * L * 0.5, y: top.y - L * 0.45 },
          { x: top.x + side * L, y: top.y - L * 0.2 + Math.sin(t * 2 + side) * s * 0.01 },
        ],
        6,
      );
      ribbon(ctx, pts, (u) => s * 0.16 * Math.sin(Math.PI * Math.min(1, u * 1.05 + 0.02)) * leaves);
    }
    ctx.strokeStyle = rgba(PAL.gold, 0.6 * leaves);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(top.x - s * 0.3 * leaves, top.y - s * 0.08 * leaves);
    ctx.quadraticCurveTo(top.x, top.y - s * 0.15 * leaves, top.x + s * 0.3 * leaves, top.y - s * 0.08 * leaves);
    ctx.stroke();
  }
  ctx.restore();
}
