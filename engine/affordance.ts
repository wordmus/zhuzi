// 可做的事（affordance）。画布上画出来的每件可交互之物，都在 DOM 里有一个透明按钮：
// 键盘、读屏、触屏、自动化（bench 的「首个可操作元素」「删字测试」）都走同一条路。
// 悬停的时长记为停留（telemetry），导演和基础导演据此观察你。

import type { Bus } from './bus';
import type { Stage } from './stage';

export type AffShape =
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number };

export interface DragEvent {
  phase: 'start' | 'move' | 'end';
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export interface AffordanceSpec {
  id: string;
  /** 读屏与悬停提示用的动词短语，如「推门」 */
  label: string;
  shape: AffShape;
  onActivate?: () => void;
  onHover?: (hovering: boolean) => void;
  /** 拖拽：提供则按住可拖，松手时若位移很小仍当作点击 */
  onDrag?: (e: DragEvent) => void;
  enabled?: boolean;
  cursor?: string;
  /** 键盘快捷键（KeyboardEvent.key），如 ' ' 或 'Enter' */
  key?: string;
  /** 它代表什么（呈现方案里的 represents），写进 trace */
  represents?: string;
}

export interface Affordance {
  readonly id: string;
  readonly el: HTMLButtonElement;
  readonly hovering: boolean;
  /** 累计悬停毫秒 */
  readonly dwellMs: number;
  /** 正在进行的这一次悬停已持续的毫秒（未悬停为 0） */
  readonly currentHoverMs: number;
  setShape(shape: AffShape): void;
  setEnabled(on: boolean): void;
  setLabel(label: string): void;
  remove(): void;
}

export interface AffordanceRegistry {
  add(spec: AffordanceSpec): Affordance;
  get(id: string): Affordance | undefined;
  all(): Affordance[];
  /** 当前可做的事的数目（bench：进场 3 秒内只给一个） */
  enabledCount(): number;
  /** 累计停留：id → 毫秒 */
  dwell(): Record<string, number>;
  clear(): void;
}

let styleInjected = false;
function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const s = document.createElement('style');
  s.textContent = `
  .aff{position:absolute;margin:0;padding:0;border:0;background:transparent;color:transparent;
    font-size:0;line-height:0;pointer-events:auto;cursor:pointer;-webkit-tap-highlight-color:transparent;
    touch-action:none;outline:none;border-radius:0}
  .aff[data-shape=circle]{border-radius:50%}
  .aff:focus-visible{box-shadow:0 0 0 2px rgba(240,200,120,.85), 0 0 18px rgba(240,180,90,.45)}
  .aff[disabled]{pointer-events:none;cursor:default}
  `;
  document.head.appendChild(s);
}

export function createAffordances(stage: Stage, bus: Bus, z = 50): AffordanceRegistry {
  injectStyle();
  const layer = stage.dom('affordances', z);
  const items = new Map<string, Affordance>();
  const dwellTotals: Record<string, number> = {};
  const keyMap = new Map<string, string>();

  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const id = keyMap.get(e.key);
    if (!id) return;
    const a = items.get(id);
    if (a && !a.el.disabled) {
      e.preventDefault();
      a.el.click();
    }
  };
  window.addEventListener('keydown', onKey);

  function place(el: HTMLButtonElement, shape: AffShape) {
    if (shape.kind === 'circle') {
      el.dataset.shape = 'circle';
      el.style.left = `${shape.x - shape.r}px`;
      el.style.top = `${shape.y - shape.r}px`;
      el.style.width = `${shape.r * 2}px`;
      el.style.height = `${shape.r * 2}px`;
    } else {
      el.dataset.shape = 'rect';
      el.style.left = `${shape.x}px`;
      el.style.top = `${shape.y}px`;
      el.style.width = `${shape.w}px`;
      el.style.height = `${shape.h}px`;
    }
  }

  function add(spec: AffordanceSpec): Affordance {
    items.get(spec.id)?.remove();
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'aff';
    el.dataset.aff = spec.id;
    el.setAttribute('aria-label', spec.label);
    el.title = '';
    if (spec.cursor) el.style.cursor = spec.cursor;
    place(el, spec.shape);
    let enabled = spec.enabled !== false;
    el.disabled = !enabled;
    let hovering = false;
    let hoverStart = 0;
    let dwell = 0;
    dwellTotals[spec.id] ??= 0;

    const setHover = (on: boolean) => {
      if (on === hovering) return;
      hovering = on;
      if (on) {
        hoverStart = performance.now();
        bus.log('aff.hover', { id: spec.id, on: true });
      } else {
        const d = performance.now() - hoverStart;
        dwell += d;
        dwellTotals[spec.id] = (dwellTotals[spec.id] ?? 0) + d;
        bus.log('aff.hover', { id: spec.id, on: false, ms: Math.round(d) });
      }
      spec.onHover?.(on);
      bus.emit('aff.hover', { id: spec.id, on });
    };

    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') setHover(true);
    });
    el.addEventListener('pointerleave', () => setHover(false));
    el.addEventListener('focus', () => setHover(true));
    el.addEventListener('blur', () => setHover(false));

    let dragging = false;
    let moved = 0;
    let sx = 0, sy = 0, lx = 0, ly = 0;
    let suppressClick = false;

    const local = (e: PointerEvent) => {
      const r = stage.root.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    if (spec.onDrag) {
      el.addEventListener('pointerdown', (e) => {
        if (el.disabled) return;
        dragging = true;
        moved = 0;
        const p = local(e);
        sx = lx = p.x;
        sy = ly = p.y;
        el.setPointerCapture(e.pointerId);
        spec.onDrag!({ phase: 'start', x: p.x, y: p.y, dx: 0, dy: 0 });
      });
      el.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const p = local(e);
        moved = Math.max(moved, Math.hypot(p.x - sx, p.y - sy));
        spec.onDrag!({ phase: 'move', x: p.x, y: p.y, dx: p.x - lx, dy: p.y - ly });
        lx = p.x;
        ly = p.y;
      });
      const end = (e: PointerEvent) => {
        if (!dragging) return;
        dragging = false;
        const p = local(e);
        spec.onDrag!({ phase: 'end', x: p.x, y: p.y, dx: p.x - sx, dy: p.y - sy });
        // 真拖动过就不再当成点击
        suppressClick = moved > 8;
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    }

    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (el.disabled) return;
      bus.log('aff.click', { id: spec.id, represents: spec.represents, dwellMs: Math.round(dwell) });
      bus.emit('aff.click', { id: spec.id });
      spec.onActivate?.();
    });

    if (spec.key) keyMap.set(spec.key, spec.id);
    layer.appendChild(el);
    if (enabled) bus.log('aff.show', { id: spec.id, label: spec.label, represents: spec.represents });

    const aff: Affordance = {
      id: spec.id,
      el,
      get hovering() {
        return hovering;
      },
      get dwellMs() {
        return dwell + (hovering ? performance.now() - hoverStart : 0);
      },
      get currentHoverMs() {
        return hovering ? performance.now() - hoverStart : 0;
      },
      setShape(shape) {
        place(el, shape);
      },
      setEnabled(on) {
        if (on === enabled) return;
        enabled = on;
        el.disabled = !on;
        if (!on) setHover(false);
        bus.log(on ? 'aff.show' : 'aff.hide', { id: spec.id });
      },
      setLabel(label) {
        el.setAttribute('aria-label', label);
      },
      remove() {
        if (hovering) setHover(false);
        if (spec.key && keyMap.get(spec.key) === spec.id) keyMap.delete(spec.key);
        el.remove();
        if (items.get(spec.id) === aff) items.delete(spec.id);
        if (enabled) bus.log('aff.hide', { id: spec.id });
      },
    };
    items.set(spec.id, aff);
    return aff;
  }

  return {
    add,
    get: (id) => items.get(id),
    all: () => [...items.values()],
    enabledCount: () => [...items.values()].filter((a) => !a.el.disabled).length,
    dwell() {
      const out: Record<string, number> = { ...dwellTotals };
      for (const a of items.values()) if (a.hovering) out[a.id] = (out[a.id] ?? 0) + a.currentHoverMs;
      return out;
    },
    clear() {
      for (const a of [...items.values()]) a.remove();
    },
  };
}
