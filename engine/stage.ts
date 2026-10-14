// 舞台：分层画布 + DOM 层 + 帧循环 + 指针（当作「视线」）+ 帧率采样。
// 所有绘制都用 CSS 像素坐标；DPR 在层内部处理。

export interface CanvasLayer {
  id: string;
  z: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  clear(): void;
  /** 叠加模式等全局状态复位 */
  reset(): void;
}

export interface PointerState {
  x: number;
  y: number;
  /** 平滑后的「视线」位置：像人的目光一样慢半拍 */
  gx: number;
  gy: number;
  inside: boolean;
  down: boolean;
  kind: 'mouse' | 'touch' | 'pen';
  /** performance.now() 毫秒 */
  lastMove: number;
  lastDown: number;
}

export type FrameFn = (t: number, dt: number) => void;

export interface Stage {
  readonly root: HTMLElement;
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  /** 自启动以来的秒数 */
  readonly time: number;
  readonly pointer: PointerState;
  readonly reducedMotion: boolean;
  /** 竖屏手机等窄屏 */
  readonly narrow: boolean;
  layer(id: string, z: number): CanvasLayer;
  dom(id: string, z: number): HTMLElement;
  removeLayer(id: string): void;
  onFrame(fn: FrameFn): () => void;
  onResize(fn: (w: number, h: number) => void): () => void;
  /** 最近若干帧的帧率第 5 百分位 */
  fpsP5(): number;
  fpsSamples(): number[];
  destroy(): void;
}

export function createStage(root: HTMLElement): Stage {
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.overflow = 'hidden';
  root.style.touchAction = 'none';
  root.style.userSelect = 'none';
  (root.style as any).webkitUserSelect = 'none';

  const canvases = new Map<string, CanvasLayer>();
  const doms = new Map<string, HTMLElement>();
  const frameFns = new Set<FrameFn>();
  const resizeFns = new Set<(w: number, h: number) => void>();
  const frameTimes: number[] = [];
  const MAX_SAMPLES = 600;

  let width = root.clientWidth || window.innerWidth;
  let height = root.clientHeight || window.innerHeight;
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  const start = performance.now();
  let last = start;
  let time = 0;
  let raf = 0;
  let alive = true;

  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const pointer: PointerState = {
    x: width / 2,
    y: height / 2,
    gx: width / 2,
    gy: height / 2,
    inside: false,
    down: false,
    kind: 'mouse',
    lastMove: 0,
    lastDown: 0,
  };

  function sizeCanvas(layer: CanvasLayer) {
    const c = layer.canvas;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    c.style.width = `${width}px`;
    c.style.height = `${height}px`;
    layer.reset();
  }

  function layer(id: string, z: number): CanvasLayer {
    const existing = canvases.get(id);
    if (existing) return existing;
    const canvas = document.createElement('canvas');
    canvas.dataset.layer = id;
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.zIndex = String(z);
    canvas.style.pointerEvents = 'none';
    const ctx = canvas.getContext('2d', { alpha: true })!;
    const l: CanvasLayer = {
      id,
      z,
      canvas,
      ctx,
      clear() {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      },
      reset() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = 'none';
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
      },
    };
    sizeCanvas(l);
    root.appendChild(canvas);
    canvases.set(id, l);
    return l;
  }

  function dom(id: string, z: number): HTMLElement {
    const existing = doms.get(id);
    if (existing) return existing;
    const el = document.createElement('div');
    el.dataset.layer = id;
    el.style.position = 'absolute';
    el.style.inset = '0';
    el.style.zIndex = String(z);
    el.style.pointerEvents = 'none';
    root.appendChild(el);
    doms.set(id, el);
    return el;
  }

  function removeLayer(id: string) {
    const c = canvases.get(id);
    if (c) {
      c.canvas.remove();
      canvases.delete(id);
    }
    const d = doms.get(id);
    if (d) {
      d.remove();
      doms.delete(id);
    }
  }

  function handleResize() {
    const w = root.clientWidth || window.innerWidth;
    const h = root.clientHeight || window.innerHeight;
    const d = Math.min(2, window.devicePixelRatio || 1);
    if (w === width && h === height && d === dpr) return;
    width = w;
    height = h;
    dpr = d;
    for (const l of canvases.values()) sizeCanvas(l);
    for (const fn of resizeFns) fn(width, height);
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => handleResize()) : null;
  ro?.observe(root);
  window.addEventListener('resize', handleResize);

  function toLocal(e: PointerEvent) {
    const r = root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  const onMove = (e: PointerEvent) => {
    const p = toLocal(e);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.inside = true;
    pointer.kind = (e.pointerType as PointerState['kind']) || 'mouse';
    pointer.lastMove = performance.now();
  };
  const onDown = (e: PointerEvent) => {
    onMove(e);
    pointer.down = true;
    pointer.lastDown = performance.now();
    // 触屏没有悬停：按下的那一刻视线直接跳过去
    if (pointer.kind !== 'mouse') {
      pointer.gx = pointer.x;
      pointer.gy = pointer.y;
    }
  };
  const onUp = () => {
    pointer.down = false;
  };
  const onLeave = () => {
    pointer.inside = false;
  };
  root.addEventListener('pointermove', onMove, { passive: true });
  root.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  root.addEventListener('pointerleave', onLeave, { passive: true });

  function loop(now: number) {
    if (!alive) return;
    const dtMs = Math.min(50, now - last);
    if (now - last > 0) {
      frameTimes.push(now - last);
      if (frameTimes.length > MAX_SAMPLES) frameTimes.shift();
    }
    last = now;
    time = (now - start) / 1000;
    const dt = dtMs / 1000;
    // 视线跟随：约 0.25 秒追上
    const k = 1 - Math.exp(-dt * 7);
    pointer.gx += (pointer.x - pointer.gx) * k;
    pointer.gy += (pointer.y - pointer.gy) * k;
    for (const fn of [...frameFns]) {
      try {
        fn(time, dt);
      } catch (err) {
        console.error('[stage] frame fn failed', err);
      }
    }
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  const stage: Stage = {
    root,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    get dpr() {
      return dpr;
    },
    get time() {
      return time;
    },
    pointer,
    get reducedMotion() {
      return !!mq?.matches;
    },
    get narrow() {
      return width < 640 || height > width * 1.15;
    },
    layer,
    dom,
    removeLayer,
    onFrame(fn) {
      frameFns.add(fn);
      return () => frameFns.delete(fn);
    },
    onResize(fn) {
      resizeFns.add(fn);
      return () => resizeFns.delete(fn);
    },
    fpsSamples() {
      return frameTimes.map((ms) => 1000 / Math.max(1, ms));
    },
    fpsP5() {
      if (frameTimes.length < 10) return 60;
      const fps = frameTimes.map((ms) => 1000 / Math.max(1, ms)).sort((a, b) => a - b);
      return fps[Math.floor(fps.length * 0.05)]!;
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointerleave', onLeave);
      for (const id of [...canvases.keys(), ...doms.keys()]) removeLayer(id);
    },
  };
  return stage;
}

// ---- 小工具 ----

export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOut = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
/** 指数趋近：每帧调用，rate 越大越快 */
export const approach = (cur: number, target: number, rate: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 补间：返回 Promise，每帧回调 0..1 */
export function tween(stage: Stage, ms: number, fn: (t: number) => void, ease: (t: number) => number = easeInOut): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    fn(0);
    const off = stage.onFrame(() => {
      const t = Math.min(1, (performance.now() - t0) / Math.max(1, ms));
      fn(ease(t));
      if (t >= 1) {
        off();
        resolve();
      }
    });
  });
}
