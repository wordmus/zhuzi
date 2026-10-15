import type { Ctx, Framework } from '../../app/context';
import { PAL } from '../../components/paint/palette';
import { cracks, loessGround, milletStalks } from '../../components/paint/props-land';
import { finish } from '../../components/paint/texture';
import { sky } from '../../components/paint/sky';
import { makeFigure } from '../../components/paint/figure';
import { clamp, easeOut, lerp } from '../../components/paint/util';
import type { Affordance } from '../../engine/affordance';

interface Dot {
  u: number;
  v: number;
  r: number;
  delay: number;
  color: string;
  kind: 'wall' | 'city' | 'river' | 'field';
}

function makeDots(ctx: Ctx): Dot[] {
  const rng = ctx.rng.fork('reveal-city-dots');
  const dots: Dot[] = [];
  const add = (u: number, v: number, kind: Dot['kind']) => {
    dots.push({
      u,
      v,
      kind,
      r: 0.65 + rng.next() * 1.45,
      delay: rng.next() * 0.34,
      color: kind === 'river' ? (rng.next() < 0.55 ? PAL.bronze : PAL.gold) : kind === 'field' ? (rng.next() < 0.5 ? PAL.ochre : PAL.gold) : (rng.next() < 0.18 ? PAL.cinnabar : PAL.gold),
    });
  };

  // 临淄的城墙：一圈紧密的金点，东面开着一处河道。
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2;
    const u = 0.36 + Math.cos(a) * 0.235;
    const v = 0.47 + Math.sin(a) * 0.25;
    if (u > 0.52 && v > 0.36 && v < 0.58) continue;
    add(u + (rng.next() - 0.5) * 0.008, v + (rng.next() - 0.5) * 0.008, 'wall');
  }
  // 城中巷道与屋顶的稠密点阵。
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 13; col++) {
      if (rng.next() < 0.12) continue;
      const u = 0.18 + col * 0.028 + (rng.next() - 0.5) * 0.009;
      const v = 0.27 + row * 0.045 + (rng.next() - 0.5) * 0.014;
      if (u > 0.46 && row > 3 && row < 6) continue;
      add(u, v, 'city');
    }
  }
  // 淄水：一道弯过城外的青铜点带。
  for (let i = 0; i < 170; i++) {
    const p = i / 169;
    const u = 0.02 + p * 0.98;
    const v = 0.39 + 0.08 * Math.sin(p * Math.PI * 1.45 + 0.2) + 0.035 * Math.sin(p * Math.PI * 3.2);
    add(u, v + (rng.next() - 0.5) * 0.045, 'river');
  }
  // 东郊稀田：被河流隔开的几道方格，焦点只落在这一片。
  for (let row = 0; row < 7; row++) {
    const v = 0.49 + row * 0.048;
    for (let col = 0; col < 7; col++) {
      const u = 0.66 + col * 0.043;
      for (let k = 0; k < 7; k++) {
        const along = (k + rng.next() * 0.6) / 7;
        add(u + along * 0.026, v + (rng.next() - 0.5) * 0.008, 'field');
      }
      for (let k = 0; k < 4; k++) add(u + (rng.next() - 0.5) * 0.009, v + (k / 4) * 0.034, 'field');
    }
  }
  // 城门外零落的田点让城与东郊之间有一段路。
  for (let i = 0; i < 52; i++) add(0.59 + rng.next() * 0.08, 0.48 + rng.next() * 0.28, 'field');
  return dots;
}

function pulseFocus(a: Affordance, t: number, reduced: boolean, hovered: boolean) {
  a.el.dataset.pulse = 'breath';
  a.el.setAttribute('aria-current', 'true');
  const wave = reduced ? 0.42 : 0.25 + 0.23 * (1 + Math.sin(t * 2.5));
  const boost = hovered ? 0.3 : 0;
  a.el.style.borderRadius = '50%';
  a.el.style.boxShadow = `0 0 ${10 + wave * 20}px rgba(230,200,120,${0.2 + wave + boost}), inset 0 0 0 1px rgba(230,200,120,${0.2 + wave * 0.4})`;
  a.el.style.opacity = String(0.52 + wave * 0.35 + boost * 0.2);
}

function copyCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement('canvas');
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext('2d')!.drawImage(source, 0, 0);
  return copy;
}

export const reveal: Framework = {
  async run(act, ctx) {
    const { stage, aff, audio, lines } = ctx;
    stage.removeLayer('vignette');
    stage.removeLayer('reveal');
    const layer = stage.layer('reveal', 20);
    const he = makeFigure('he', { pose: 'kneel-touch', facing: 1 });
    const dots = makeDots(ctx);
    const source = ctx.handoff.frame instanceof HTMLCanvasElement ? ctx.handoff.frame : null;
    const ticket = ctx.handoff.ticket as { x: number; y: number; w: number } | undefined;
    const motion = stage.reducedMotion ? 0.25 : 1;
    const started = performance.now();
    const eastPoint = () => ({ x: stage.width * 0.82, y: stage.height * 0.62 });
    const focusShape = () => {
      const p = eastPoint();
      return { kind: 'circle' as const, x: p.x, y: p.y, r: Math.max(38, Math.min(stage.width, stage.height) * 0.13) };
    };
    let active = false;
    let developedAt = 0;
    let completed = false;
    let focusPoint = eastPoint();
    let focusUnit = { u: 0.82, v: 0.62 };
    let resolveRun!: () => void;
    const done = new Promise<void>((resolve) => (resolveRun = resolve));
    const focus = aff.add({
      id: 'east-suburb',
      label: '看向东郊',
      shape: focusShape(),
      key: 'Enter',
      represents: '看向唯一呼吸的东郊',
      onHover(on) {
        if (on) audio.sfx('shimmer', { gain: 0.12 });
      },
      onActivate() {
        beginDevelopment();
      },
    });
    focus.el.dataset.pulse = 'breath';
    focus.el.setAttribute('aria-current', 'true');

    const beginDevelopment = () => {
      if (active) return;
      active = true;
      developedAt = performance.now();
      const pointer = stage.pointer;
      focusUnit = pointer.inside
        ? { u: clamp(pointer.gx / Math.max(1, stage.width), 0.69, 0.94), v: clamp(pointer.gy / Math.max(1, stage.height), 0.49, 0.79) }
        : { u: 0.82, v: 0.62 };
      focusPoint = { x: focusUnit.u * stage.width, y: focusUnit.v * stage.height };
      focus.setEnabled(false);
      audio.unlock();
      audio.sfx('develop');
    };

    const sourceU = (ticket?.x ?? stage.width * 0.52) / Math.max(1, stage.width);
    const sourceV = (ticket?.y ?? stage.height * 0.7) / Math.max(1, stage.height);
    const ticketOrigin = { u: sourceU, v: sourceV };
    const drawField = (c: CanvasRenderingContext2D, w: number, h: number, time: number, progress: number) => {
      if (progress <= 0) return;
      const radius = Math.hypot(w, h) * (0.08 + progress * 0.92);
      c.save();
      c.beginPath();
      c.arc(focusPoint.x, focusPoint.y, radius, 0, Math.PI * 2);
      c.clip();
      sky(c, w, h, { part: 'noon', t: time, horizon: 0.54, sun: { x: 0.84, y: 0.15 }, clouds: 0.72 });
      const groundY = h * 0.52;
      loessGround(c, 0, groundY, w, h - groundY, { seed: 3 });
      const soil = c.createLinearGradient(0, groundY, 0, h);
      soil.addColorStop(0, 'rgba(185,149,104,0.16)');
      soil.addColorStop(1, 'rgba(59,42,30,0.16)');
      c.fillStyle = soil;
      c.fillRect(0, groundY, w, h - groundY);
      milletStalks(c, w * 0.16, h * 0.83, w * 0.2, h * 0.16, { wither: 0.84, t: time, seed: 2, n: 14 });
      milletStalks(c, w * 0.86, h * 0.84, w * 0.2, h * 0.17, { wither: 0.88, t: time, seed: 7, n: 15 });
      cracks(c, w * 0.2, h * 0.57, w * 0.62, h * 0.28, { amount: 0.72, seed: 4, origin: { x: 0.55, y: 0.32 } });
      he.draw(c, w * 0.52, h * 0.9, Math.min(h * 0.4, w * 0.29), time);
      finish(c, w, h, { ground: 'silk', vignette: 0.24 });
      c.restore();
    };

    const offResize = stage.onResize(() => focus.setShape(focusShape()));
    const offFrame = stage.onFrame(() => {
      const w = stage.width;
      const h = stage.height;
      const minDim = Math.min(w, h);
      const now = performance.now();
      const elapsed = (now - started) / 1000;
      const dissolve = easeOut(clamp(elapsed / (1.55 * motion)));
      const develop = active ? easeOut(clamp((now - developedAt) / (1.75 * motion))) : 0;
      const gaze = stage.pointer.inside ? { x: stage.pointer.gx, y: stage.pointer.gy } : eastPoint();
      focusPoint = { x: focusUnit.u * w, y: focusUnit.v * h };
      pulseFocus(focus, stage.time, stage.reducedMotion, focus.hovering);
      if (!active && focus.currentHoverMs >= 800) beginDevelopment();

      layer.clear();
      const c = layer.ctx;
      c.fillStyle = PAL.lacquer;
      c.fillRect(0, 0, w, h);
      if (source && dissolve < 1) {
        c.save();
        c.globalAlpha = 1 - dissolve;
        c.drawImage(source, 0, 0, w, h);
        c.restore();
      }

      const mapAlpha = active ? 1 - develop * 0.82 : 1;
      if (mapAlpha > 0.01) {
        const originU = ticketOrigin.u;
        const originV = ticketOrigin.v;
        const converge = active ? 1 - develop * 0.62 : 0;
        for (const dot of dots) {
          const revealDot = clamp(dissolve * 1.45 - dot.delay);
          if (revealDot <= 0) continue;
          let u = lerp(originU, dot.u, dissolve);
          let v = lerp(originV, dot.v, dissolve);
          const dx = gaze.x / w - u;
          const dy = gaze.y / h - v;
          const distance = Math.hypot(dx * w, dy * h) / Math.max(1, minDim);
          const gather = Math.max(0, 1 - distance / 0.22) * (stage.pointer.inside ? 0.08 : 0.025);
          u += dx * gather;
          v += dy * gather;
          if (active) {
            const ex = focusPoint.x / w;
            const ey = focusPoint.y / h;
            if (Math.hypot((u - ex) * w, (v - ey) * h) < minDim * 0.17) {
              u = lerp(u, ex, converge);
              v = lerp(v, ey, converge);
            }
          }
          const alpha = revealDot * mapAlpha * (dot.kind === 'field' ? 0.78 : 0.9);
          c.globalAlpha = alpha;
          c.fillStyle = dot.color;
          c.beginPath();
          c.arc(u * w, v * h, Math.max(0.7, minDim * 0.00155 * dot.r), 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      }

      const region = eastPoint();
      const breath = stage.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(stage.time * 1.55);
      const regionR = minDim * (0.095 + breath * 0.016);
      const halo = c.createRadialGradient(region.x, region.y, 0, region.x, region.y, regionR * 1.65);
      halo.addColorStop(0, `rgba(201,162,74,${0.13 + breath * 0.1})`);
      halo.addColorStop(0.58, `rgba(201,162,74,${0.07 + breath * 0.05})`);
      halo.addColorStop(1, 'rgba(201,162,74,0)');
      c.fillStyle = halo;
      c.beginPath();
      c.arc(region.x, region.y, regionR * 1.65, 0, Math.PI * 2);
      c.fill();

      if (active) {
        drawField(c, w, h, stage.time, develop);
        if (develop >= 1 && !completed) {
          completed = true;
          focus.setEnabled(false);
          lines.clear();
          ctx.handoff.frame = copyCanvas(layer.canvas);
          ctx.handoff.reveal = { focus: 'east-suburb', x: focusPoint.x, y: focusPoint.y };
          audio.sfx('soil', { gain: 0.3 });
          audio.ambience('field-summer', 0.18, 700);
          resolveRun();
        }
      }
    });

    try {
      await done;
    } finally {
      offFrame();
      offResize();
      focus.remove();
      lines.clear();
    }
    return { act: act.id, data: { affordances: ['east-suburb'], focus: 'east-suburb', handoffFrame: Boolean(ctx.handoff.frame), handoffTicket: ctx.handoff.ticket } };
  },
};
