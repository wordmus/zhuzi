import { CONCEPT_NAME, type Layer, type MindSnapshot, type Response, type Seed, type Trait, type Weights } from '../../engine/types';
import { bronzeMirror, flame, seedGlyph, sprout, weightIcon } from '../paint';
import { cached, glow } from '../paint/texture';
import { PAL, TONE } from '../paint/palette';
import { clamp, easeOut, rgba, rng, TAU } from '../paint/util';

export type HeartLayout = {
  cx: number;
  cy: number;
  r: number;
  ri: number;
  approach: { x: number; y: number; r: number }[];
  weights: Record<Trait, { x: number; y: number; r: number; minY: number; maxY: number }>;
  go: { x: number; y: number; r: number };
  close: { x: number; y: number; r: number };
  write: { x: number; y: number; r: number };
  editor: { x: number; y: number; w: number; h: number };
};

const TRAITS: Trait[] = ['qing', 'li', 'ming'];
const LAYERS: Layer[] = ['unit', 'module', 'mind'];
const WEIGHT_X = [-0.42, 0, 0.42] as const;
const APPROACH_X = [-0.5, 0, 0.5] as const;

export function heartLayout(width: number, height: number, anchor: { x: number; y: number } | null): HeartLayout {
  const r = Math.max(90, Math.min(width * 0.49, height * 0.37, 300));
  const ri = r * 0.72;
  const ax = anchor?.x ?? width * 0.5;
  const ay = anchor?.y ?? height * 0.5;
  const cx = width <= r * 2 + 16 ? width * 0.5 : clamp(ax, r + 8, width - r - 8);
  const cy = height <= r * 2 + 16 ? height * 0.5 : clamp(ay - r * 0.54, r + 8, height - r - 8);
  const approachY = cy - ri * 0.49;
  const approach = APPROACH_X.map((x) => ({ x: cx + x * ri, y: approachY, r: 23 }));
  const minY = cy + ri * 0.29;
  const maxY = cy + ri * 0.57;
  const weights = Object.fromEntries(TRAITS.map((trait, i) => [trait, {
    x: cx + WEIGHT_X[i]! * ri,
    y: (minY + maxY) / 2,
    r: 24,
    minY,
    maxY,
  }])) as HeartLayout['weights'];
  return {
    cx, cy, r, ri, approach, weights,
    go: { x: cx + ri * 0.68, y: cy + ri * 0.07, r: 23 },
    close: { x: cx + r * 0.68, y: cy - r * 0.62, r: 23 },
    write: { x: cx - ri * 0.83, y: cy + ri * 0.6, r: 23 },
    editor: { x: cx - ri * 0.61, y: cy + ri * 0.39, w: ri * 1.22, h: 52 },
  };
}

export function weightY(ri: number, value: number): number {
  return ri * (0.29 + clamp(value) * 0.28);
}

export function paintHeart(ctx: CanvasRenderingContext2D, layout: HeartLayout, state: {
  t: number;
  open: number;
  advanced: boolean;
  canGo: boolean;
  canWrite: boolean;
  weights: Weights | null;
  ghost: Weights | null;
  seeds: Seed[];
  seedProgress: (seed: Seed) => number;
  sproutProgress: (seed: Seed) => number;
  lamps: MindSnapshot['lamps'] | null;
  lampPulse: Partial<Record<Layer, number>>;
  pressure: number;
  selectedApproach: number;
  approachAvailable: boolean[];
  approachFocus: boolean;
  weightFocus: Trait | null;
  writing: boolean;
  goPressed: boolean;
  response: Response | null;
  error: { predicted: Response; actual: Response; progress: number } | null;
}) {
  const { cx, cy, r, ri } = layout;
  ctx.save();
  ctx.globalAlpha *= state.open;
  bronzeMirror(ctx, cx, cy, r, { open: 1, t: state.t }, (g, innerR) => {
    drawDuskField(g, innerR, state.pressure, state.t);
    if (state.advanced) drawSeeds(g, innerR, state.seeds, state.seedProgress, state.sproutProgress, state.t);
    if (state.approachAvailable.some(Boolean)) drawApproaches(g, innerR, state.selectedApproach, state.approachAvailable, state.approachFocus, state.t);
    drawLordAndBalance(g, innerR, state.weights, state.ghost, state.weightFocus, state.t, state.response, state.error, state.advanced);
    drawGoToken(g, innerR, state.canGo, state.t, state.error !== null, state.goPressed);
    if (state.advanced) drawLamps(g, innerR, state.lamps, state.lampPulse, state.t);
  });
  if (state.canWrite) drawWriter(ctx, cx - ri * 0.83, cy + ri * 0.6, ri, state.writing, state.t);
  drawMirrorClasp(ctx, cx, cy, r, state.t);
  if (state.writing) {
    drawWritingStrip(ctx, layout.editor, state.t);
    drawEditorSeal(ctx, layout.editor.x + layout.editor.w + 14, layout.editor.y + layout.editor.h / 2);
  }
  ctx.restore();
}

function drawDuskField(ctx: CanvasRenderingContext2D, ri: number, pressure: number, t: number) {
  const dpr = 1.5;
  const bg = cached(`heart-dusk-${Math.round(ri)}`, ri * 2, ri * 2, dpr, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, TONE.bronzeDark);
    sky.addColorStop(0.48, PAL.bronze);
    sky.addColorStop(0.49, TONE.loessLight);
    sky.addColorStop(1, PAL.umber);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    // 远山和晚田纹理固定进贴图，避免逐帧铺纹。
    g.fillStyle = rgba(TONE.bronzeDark, 0.72);
    g.beginPath();
    g.moveTo(0, h * 0.52);
    g.quadraticCurveTo(w * 0.24, h * 0.4, w * 0.5, h * 0.51);
    g.quadraticCurveTo(w * 0.76, h * 0.38, w, h * 0.49);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
    g.fill();
    g.strokeStyle = rgba(TONE.goldLight, 0.17);
    g.lineWidth = Math.max(0.6, ri * 0.004);
    for (let i = 0; i < 7; i++) {
      const y = h * (0.61 + i * 0.055);
      g.beginPath();
      g.moveTo(w * 0.06, y);
      g.quadraticCurveTo(w * 0.5, y - h * 0.07, w * 0.94, y + h * 0.025);
      g.stroke();
    }
    const random = rng(37);
    for (let i = 0; i < Math.min(180, Math.round(ri * 0.9)); i++) {
      const x = random() * w;
      const y = h * (0.5 + random() * 0.49);
      g.fillStyle = random() > 0.5 ? rgba(TONE.goldLight, 0.12) : rgba(PAL.lacquer, 0.12);
      g.fillRect(x, y, 0.7 + random() * 1.1, 0.7 + random() * 1.1);
    }
  });
  ctx.drawImage(bg, -ri, -ri, ri * 2, ri * 2);
  // 暮日和旱地的裂痕只按世界压力略有变化，不出现任何数值。
  const sunX = -ri * 0.48;
  const sunY = -ri * 0.36;
  glow(ctx, sunX, sunY, ri * 0.43, PAL.millet, 0.2 + Math.sin(t * 0.45) * 0.025);
  ctx.fillStyle = rgba(PAL.cinnabar, 0.72);
  ctx.beginPath();
  ctx.arc(sunX, sunY, ri * 0.11, 0, TAU);
  ctx.fill();
  if (pressure > 0.28) {
    ctx.strokeStyle = rgba(PAL.umber, 0.22 + pressure * 0.22);
    ctx.lineWidth = Math.max(0.8, ri * 0.009);
    for (let i = 0; i < 3; i++) {
      const x = ri * (0.24 + i * 0.19);
      const y = ri * (0.53 + (i % 2) * 0.09);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - ri * 0.045, y + ri * 0.08);
      ctx.lineTo(x + ri * 0.02, y + ri * 0.12);
      ctx.stroke();
    }
  }
}

function drawSeeds(ctx: CanvasRenderingContext2D, ri: number, seeds: Seed[], progress: (seed: Seed) => number, sproutProgress: (seed: Seed) => number, t: number) {
  const visible = seeds;
  const n = Math.max(1, visible.length);
  const radius = Math.max(3.5, Math.min(ri * 0.075, ri * 0.75 / (n + 1)));
  for (let i = 0; i < visible.length; i++) {
    const seed = visible[i]!;
    const x = n === 1 ? 0 : (-0.72 + 1.44 * i / (n - 1)) * ri;
    const y = -ri * (0.82 - 0.1 * Math.pow(x / (ri * 0.72), 2));
    const fall = easeOut(progress(seed));
    const sy = y - ri * 0.16 * (1 - fall);
    const sprouted = seed.sprouted;
    if (sprouted) {
      sprout(ctx, x, sy + ri * 0.045, ri * (n > 9 ? 0.08 : 0.14), { grow: sproutProgress(seed), t, glow: seed.strength * 0.65 });
    } else {
      const symbol = CONCEPT_NAME[seed.concept];
      seedGlyph(ctx, x, sy, radius, { lit: seed.strength * (seed.blockedBy ? 0.28 : 0.9), t, text: n <= 9 ? symbol : undefined });
    }
  }
}

function drawApproaches(ctx: CanvasRenderingContext2D, ri: number, selected: number, availableList: boolean[], focus: boolean, t: number) {
  const y = -ri * 0.49;
  for (let i = 0; i < 3; i++) {
    const x = APPROACH_X[i]! * ri;
    const available = availableList[i] ?? false;
    const chosen = i === selected;
    const pulse = focus && chosen ? 0.5 + 0.5 * Math.sin(t * 2.5) : 0;
    ctx.save();
    ctx.globalAlpha *= available ? 1 : 0.32;
    if (chosen) glow(ctx, x, y, ri * (0.25 + pulse * 0.04), PAL.millet, 0.28 + pulse * 0.2);
    ctx.fillStyle = chosen ? TONE.bambooDark : TONE.bronzeDark;
    ctx.strokeStyle = chosen ? TONE.goldLight : rgba(PAL.gold, 0.62);
    ctx.lineWidth = chosen ? 1.7 : 1;
    ctx.beginPath();
    ctx.arc(x, y, ri * 0.115, 0, TAU);
    ctx.fill();
    ctx.stroke();
    weightIcon(ctx, (['qing', 'li', 'ming'] as const)[i]!, x, y, ri * 0.072, chosen ? TONE.goldLight : PAL.gold);
    if (chosen && focus) {
      ctx.strokeStyle = rgba(TONE.goldLight, 0.5 + pulse * 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, ri * (0.17 + pulse * 0.025), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawLordAndBalance(ctx: CanvasRenderingContext2D, ri: number, weights: Weights | null, ghost: Weights | null, hot: Trait | null, t: number, response: Response | null, error: { predicted: Response; actual: Response; progress: number } | null, advanced: boolean) {
  if (!advanced) {
    drawLittleLord(ctx, 0, ri * 0.04, ri * 0.27, response, false, t);
    return;
  }
  const tilt = weights ? clamp((weights.qing - weights.ming) * 0.18, -0.16, 0.16) + Math.sin(t * 1.1) * 0.004 : 0;
  ctx.save();
  ctx.translate(0, ri * 0.16);
  ctx.rotate(tilt);
  ctx.strokeStyle = rgba(PAL.gold, 0.82);
  ctx.lineWidth = Math.max(1, ri * 0.018);
  ctx.beginPath();
  ctx.moveTo(-ri * 0.63, 0);
  ctx.lineTo(ri * 0.63, 0);
  ctx.stroke();
  ctx.strokeStyle = rgba(PAL.bronze, 0.9);
  ctx.lineWidth = Math.max(2, ri * 0.028);
  ctx.beginPath();
  ctx.moveTo(0, -ri * 0.02);
  ctx.lineTo(0, ri * 0.16);
  ctx.stroke();
  ctx.fillStyle = TONE.bronzeDark;
  ctx.beginPath();
  ctx.moveTo(-ri * 0.1, ri * 0.17);
  ctx.quadraticCurveTo(0, ri * 0.12, ri * 0.1, ri * 0.17);
  ctx.lineTo(ri * 0.15, ri * 0.21);
  ctx.lineTo(-ri * 0.15, ri * 0.21);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (error) {
    drawLittleLord(ctx, -ri * 0.18, ri * 0.03, ri * 0.125, error.predicted, true, t);
    drawLittleLord(ctx, ri * 0.2, ri * 0.03, ri * 0.125, error.actual, false, t);
  } else {
    drawLittleLord(ctx, -ri * 0.02, ri * 0.06, ri * 0.15, response, false, t);
  }

  for (let i = 0; i < 3; i++) {
    const trait = TRAITS[i]!;
    const x = WEIGHT_X[i]! * ri;
    const anchorY = ri * 0.16;
    if (!weights) {
      const emptyY = ri * 0.46;
      ctx.strokeStyle = rgba(PAL.gold, 0.42);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, anchorY + ri * 0.015);
      ctx.lineTo(x, emptyY - ri * 0.045);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, emptyY, ri * 0.1, ri * 0.035, 0, 0, TAU);
      ctx.stroke();
      continue;
    }
    const currentValue = weights[trait];
    const y = weightY(ri, currentValue);
    ctx.strokeStyle = rgba(PAL.gold, 0.76);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, anchorY + ri * 0.015);
    ctx.lineTo(x, y - ri * 0.09);
    ctx.stroke();
    if (ghost && Math.abs(ghost[trait] - currentValue) > 0.02) {
      const oldY = weightY(ri, ghost[trait]);
      ctx.save();
      ctx.globalAlpha *= 0.58;
      ctx.strokeStyle = rgba(PAL.cinnabar, 0.82);
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(x - ri * 0.1, oldY);
      ctx.lineTo(x + ri * 0.1, oldY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x, oldY, ri * 0.12, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    const radius = ri * (0.112 + currentValue * 0.035);
    const isHot = hot === trait;
    if (isHot) glow(ctx, x, y, radius * 2.2, PAL.millet, 0.45);
    ctx.fillStyle = isHot ? TONE.bronzeLight : PAL.bronze;
    ctx.strokeStyle = isHot ? TONE.goldLight : rgba(PAL.gold, 0.8);
    ctx.lineWidth = isHot ? 1.6 : 1;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
    ctx.stroke();
    weightIcon(ctx, trait, x, y, radius * 0.72, isHot ? TONE.goldLight : PAL.gold);
  }
}

function drawLittleLord(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, response: Response | null, ghost: boolean, t: number) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 1.2) * s * 0.015);
  ctx.globalAlpha *= ghost ? 0.35 : 0.96;
  const robe = ghost ? TONE.loessDark : PAL.cinnabar;
  ctx.fillStyle = robe;
  ctx.strokeStyle = ghost ? rgba(PAL.gold, 0.52) : rgba(PAL.lacquer, 0.86);
  ctx.lineWidth = Math.max(0.8, s * 0.07);
  // 冠与头
  ctx.fillStyle = TONE.skin;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.65, s * 0.24, s * 0.28, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = ghost ? TONE.loessDark : TONE.bronzeDark;
  ctx.beginPath();
  ctx.moveTo(-s * 0.37, -s * 0.83);
  ctx.quadraticCurveTo(0, -s * 1.18, s * 0.36, -s * 0.82);
  ctx.lineTo(s * 0.24, -s * 0.76);
  ctx.lineTo(-s * 0.26, -s * 0.76);
  ctx.closePath();
  ctx.fill();
  // 长衣
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-s * 0.18, -s * 0.42);
  ctx.quadraticCurveTo(-s * 0.39, -s * 0.1, -s * 0.42, s * 0.55);
  ctx.quadraticCurveTo(0, s * 0.72, s * 0.42, s * 0.55);
  ctx.quadraticCurveTo(s * 0.32, -s * 0.08, s * 0.18, -s * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.1;
  ctx.strokeStyle = robe;
  ctx.beginPath();
  if (response === 'give') {
    ctx.moveTo(-s * 0.18, -s * 0.25); ctx.lineTo(-s * 0.58, -s * 0.05);
    ctx.moveTo(s * 0.18, -s * 0.25); ctx.lineTo(s * 0.58, -s * 0.05);
  } else if (response === 'lend') {
    ctx.moveTo(s * 0.12, -s * 0.24); ctx.lineTo(s * 0.54, -s * 0.05);
    ctx.moveTo(-s * 0.15, -s * 0.24); ctx.lineTo(-s * 0.25, s * 0.13);
  } else if (response === 'buy-land') {
    ctx.moveTo(s * 0.16, -s * 0.25); ctx.lineTo(s * 0.5, s * 0.05);
    ctx.moveTo(-s * 0.16, -s * 0.24); ctx.lineTo(-s * 0.28, s * 0.14);
  } else if (response === 'refuse') {
    ctx.moveTo(-s * 0.18, -s * 0.21); ctx.lineTo(s * 0.22, s * 0.02);
    ctx.moveTo(s * 0.18, -s * 0.21); ctx.lineTo(-s * 0.22, s * 0.02);
  } else {
    ctx.moveTo(-s * 0.18, -s * 0.24); ctx.lineTo(-s * 0.43, s * 0.04);
    ctx.moveTo(s * 0.18, -s * 0.24); ctx.lineTo(s * 0.43, s * 0.04);
  }
  ctx.stroke();
  ctx.restore();
}

function drawGoToken(ctx: CanvasRenderingContext2D, ri: number, shown: boolean, t: number, error: boolean, pressed: boolean) {
  if (!shown) return;
  const x = ri * 0.68;
  const y = ri * 0.07;
  const p = 0.5 + 0.5 * Math.sin(t * 2.1);
  glow(ctx, x, y, ri * 0.28, PAL.millet, pressed ? 0.72 : error ? 0.44 : 0.22 + p * 0.12);
  ctx.fillStyle = TONE.bronzeDark;
  ctx.strokeStyle = TONE.goldLight;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(x, y, ri * 0.14, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = rgba(PAL.gold, 0.8);
  ctx.lineWidth = ri * 0.018;
  ctx.strokeRect(x - ri * 0.047, y - ri * 0.058, ri * 0.094, ri * 0.116);
  ctx.fillStyle = PAL.cinnabar;
  ctx.beginPath();
  ctx.arc(x + ri * 0.085, y + ri * 0.04, ri * 0.025, 0, TAU);
  ctx.fill();
}

function drawLamps(ctx: CanvasRenderingContext2D, ri: number, lamps: MindSnapshot['lamps'] | null, pulse: Partial<Record<Layer, number>>, t: number) {
  const xs = [-0.42, 0, 0.42];
  for (let i = 0; i < 3; i++) {
    const layer = LAYERS[i]!;
    const x = xs[i]! * ri;
    const y = ri * 0.82;
    const active = clamp((lamps?.[layer] ?? 0) * 0.62 + (pulse[layer] ?? 0));
    ctx.fillStyle = TONE.bronzeDark;
    ctx.strokeStyle = rgba(PAL.gold, 0.78);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y + ri * 0.035, ri * 0.095, ri * 0.03, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(x - ri * 0.018, y - ri * 0.1, ri * 0.036, ri * 0.13);
    ctx.beginPath();
    ctx.moveTo(x - ri * 0.13, y - ri * 0.085);
    ctx.quadraticCurveTo(x, y - ri * 0.01, x + ri * 0.13, y - ri * 0.085);
    ctx.stroke();
    flame(ctx, x, y - ri * 0.11, ri * 0.085, t, active, { seed: i + 1, halo: active > 0.05 });
  }
}

function drawWriter(ctx: CanvasRenderingContext2D, x: number, y: number, ri: number, writing: boolean, t: number) {
  if (writing) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.7 + Math.sin(t * 1.2) * 0.015);
  ctx.strokeStyle = TONE.goldLight;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-ri * 0.13, ri * 0.05);
  ctx.lineTo(ri * 0.14, -ri * 0.08);
  ctx.stroke();
  ctx.fillStyle = PAL.cinnabar;
  ctx.beginPath();
  ctx.moveTo(ri * 0.14, -ri * 0.08);
  ctx.lineTo(ri * 0.18, -ri * 0.14);
  ctx.lineTo(ri * 0.1, -ri * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMirrorClasp(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number) {
  const x = cx + r * 0.68;
  const y = cy - r * 0.62;
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.5);
  ctx.save();
  glow(ctx, x, y, r * 0.14, PAL.gold, 0.1 + pulse * 0.04);
  ctx.fillStyle = TONE.bronzeDark;
  ctx.strokeStyle = rgba(TONE.goldLight, 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.065, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r * 0.018, y - r * 0.028);
  ctx.lineTo(x + r * 0.018, y + r * 0.028);
  ctx.moveTo(x + r * 0.018, y - r * 0.028);
  ctx.lineTo(x - r * 0.018, y + r * 0.028);
  ctx.stroke();
  ctx.restore();
}

function drawEditorSeal(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = TONE.bronzeDark;
  ctx.strokeStyle = TONE.goldLight;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 4);
  ctx.lineTo(x + 4, y + 4);
  ctx.moveTo(x + 4, y - 4);
  ctx.lineTo(x - 4, y + 4);
  ctx.stroke();
  ctx.restore();
}

function drawWritingStrip(ctx: CanvasRenderingContext2D, strip: HeartLayout['editor'], t: number) {
  const { x, y, w, h } = strip;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, PAL.silk);
  g.addColorStop(0.5, PAL.silkDim);
  g.addColorStop(1, TONE.loessLight);
  ctx.save();
  ctx.shadowColor = rgba(PAL.lacquer, 0.55);
  ctx.shadowBlur = 8;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x + 5, y);
  ctx.quadraticCurveTo(x + w * 0.5, y - 3 - Math.sin(t) * 0.5, x + w - 5, y);
  ctx.lineTo(x + w, y + h);
  ctx.quadraticCurveTo(x + w * 0.5, y + h + 2, x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(PAL.gold, 0.82);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

export const approachName: Record<'qing' | 'li' | 'ming', string> = { qing: '叙旧情', li: '押田地', ming: '请乡邻' };
export const traitName: Record<Trait, string> = { qing: '情', li: '利', ming: '名' };
export const circle = (x: number, y: number, r: number) => ({ kind: 'circle' as const, x, y, r });
export const lerpWeights = (a: Weights, b: Weights, t: number): Weights => ({
  qing: a.qing + (b.qing - a.qing) * t,
  li: a.li + (b.li - a.li) * t,
  ming: a.ming + (b.ming - a.ming) * t,
});
