import type { Ctx } from '../../app/context';
import type { Affordance, AffShape } from '../../engine/affordance';
import type { Approach, Layer, MindSnapshot, Rehearsal, Seed, Trait, Weights } from '../../engine/types';
import type { HeartErrorView, HeartEvent, HeartView } from './api';
import { createHeartLabels, rehearsalText } from './labels';
import {
  approachName,
  circle,
  heartLayout,
  lerpWeights,
  paintHeart,
  traitName,
  weightY,
  type HeartLayout,
} from './drawing';

const APPROACHES: Approach[] = ['qing', 'li', 'ming'];
const TRAITS: Trait[] = ['qing', 'li', 'ming'];
const LAYERS: Layer[] = ['unit', 'module', 'mind'];
const ERROR_MS = 900;

interface TimedSeed {
  start: number;
  duration: number;
}

interface ErrorMotion {
  before: Weights;
  after: Weights;
  predicted: HeartErrorView['predicted'];
  actual: HeartErrorView['actual'];
  start: number;
  duration: number;
}

interface EffectWaiter {
  started: number;
  duration: number;
  resolve: () => void;
}

let styleReady = false;
function injectStyle() {
  if (styleReady) return;
  styleReady = true;
  const style = document.createElement('style');
  style.dataset.heart = 'true';
  style.textContent = `
  .heart-word{position:absolute;box-sizing:border-box;margin:0;padding:0 6px;border:0;border-bottom:1px solid rgba(138,106,42,.5);
    border-radius:0;background:transparent;color:#1a110c;font:500 16px/1.3 "Noto Serif SC","Songti SC","STSong","SimSun",serif;
    letter-spacing:.04em;text-align:center;outline:none;pointer-events:auto;touch-action:manipulation;user-select:text}
  .heart-word:focus-visible{border-bottom-color:#8a6a2a;box-shadow:0 2px 0 rgba(201,162,74,.46)}
  .aff[data-heart-pulse]{outline:1px solid rgba(230,200,120,.8);box-shadow:0 0 16px rgba(214,178,90,.24);animation:heart-aff-pulse 2.2s ease-in-out infinite}
  .aff[data-aff="heart-approach"][data-heart-pulse]{outline:none;box-shadow:none;animation:none}
  @keyframes heart-aff-pulse{0%,100%{box-shadow:0 0 8px rgba(214,178,90,.18)}50%{box-shadow:0 0 20px rgba(214,178,90,.48)}}
  @media (prefers-reduced-motion:reduce){.aff[data-heart-pulse]{animation:none}}
  `;
  document.head.appendChild(style);
}

export function createHeart(ctx: Ctx): HeartView {
  injectStyle();

  let destroyed = false;
  let opening = false;
  // 解锁看状态不看钟：首镜要你先预演一次；你主动打开的镜立即可用；误差镜等演完。
  let openReason: 'first' | 'player' | 'error' | 'unfold' = 'player';
  let unlocked = false;
  let settledFrames = 0;
  let progress = 0;
  let target: 0 | 1 | null = null;
  let transitionWaiters: { target: 0 | 1; resolve: () => void }[] = [];
  let canvasLayer: ReturnType<typeof ctx.stage.layer> | null = null;
  let uiRoot: HTMLElement | null = null;
  let labels: ReturnType<typeof createHeartLabels> | null = null;
  let advanced = true;
  let offFrame: (() => void) | null = null;
  let offResize: (() => void) | null = null;
  let currentAnchor: (() => { x: number; y: number }) | null = null;
  let layout: HeartLayout = heartLayout(ctx.stage.width, ctx.stage.height, null);
  let snapshot: MindSnapshot | null = null;
  let localWeights: Weights | null = null;
  let dragPreview: Partial<Record<Trait, number>> = {};
  let dragTrait: Trait | null = null;
  let dragStartY = 0;
  let dragStartValue = 0;
  let dragOriginX = 0;
  let dragOriginY = 0;
  let weightDragOriginX = 0;
  let weightDragOriginY = 0;
  let lastPointerY = 0;
  let editorOpen = false;
  let writable = false;
  let rehearsal: Rehearsal | null = null;
  let actualResponse: HeartErrorView['actual'] | null = null;
  let errorMotion: ErrorMotion | null = null;
  let persistentGhost: Weights | null = null;
  let goFlashUntil = 0;
  let nudgeFlashUntil = 0;
  let nudgeFlashTrait: Trait | null = null;
  let approaches = [...APPROACHES];
  let selectedApproach: Approach | null = 'qing';
  const listeners = new Set<(e: HeartEvent) => void>();
  const effectWaiters: EffectWaiter[] = [];
  const ownAffordances = new Map<string, Affordance>();
  const affordanceCleanup = new Map<string, () => void>();
  const shapeCache = new Map<string, AffShape>();
  const seeds: Seed[] = [];
  const seedFalls = new Map<string, TimedSeed>();
  const seedSprouts = new Map<string, TimedSeed>();
  const flashes = new Map<Layer, number>();
  let input: HTMLInputElement | null = null;
  let inputKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  let inputTextHandler: (() => void) | null = null;
  let resolveError: (() => void) | null = null;
  let lastApproachLabel = '';

  const now = () => performance.now();
  const indexOfApproach = (a: Approach) => APPROACHES.indexOf(a);
  const currentIndex = () => selectedApproach ? indexOfApproach(selectedApproach) : -1;
  const ready = () => unlocked || (approaches.length === 0 && settledFrames >= 2 && !errorMotion && effectWaiters.length === 0);
  const displayWeights = (): Weights | null => {
    let base = localWeights;
    if (!base) return null;
    if (errorMotion) {
      const k = ctx.stage.reducedMotion ? 1 : Math.max(0, Math.min(1, (now() - errorMotion.start) / errorMotion.duration));
      base = lerpWeights(errorMotion.before, errorMotion.after, k);
    }
    if (dragTrait && dragPreview[dragTrait] !== undefined) return { ...base, [dragTrait]: dragPreview[dragTrait]! };
    return base;
  };

  function emit(e: HeartEvent) {
    for (const fn of [...listeners]) {
      try {
        fn(e);
      } catch (err) {
        ctx.bus.log('error', { topic: 'heart.on', message: String((err as Error)?.message ?? err) });
      }
    }
  }

  function removeAffordance(id: string) {
    affordanceCleanup.get(id)?.();
    affordanceCleanup.delete(id);
    ownAffordances.get(id)?.remove();
    ownAffordances.delete(id);
    shapeCache.delete(id);
  }

  function removeAllAffordances() {
    for (const id of [...ownAffordances.keys()]) removeAffordance(id);
  }

  function setPulse(id: string, on: boolean) {
    const el = ownAffordances.get(id)?.el;
    if (!el) return;
    if (on) {
      if (el.dataset.pulse !== 'true') el.dataset.pulse = 'true';
      if (el.dataset.heartPulse !== 'true') el.dataset.heartPulse = 'true';
      if (el.getAttribute('aria-current') !== 'true') el.setAttribute('aria-current', 'true');
    } else {
      delete el.dataset.pulse;
      delete el.dataset.heartPulse;
      if (el.hasAttribute('aria-current')) el.removeAttribute('aria-current');
    }
  }

  function setApproachLabel() {
    const a = ownAffordances.get('heart-approach');
    if (!a) return;
    const available = approaches.map((x) => approachName[x]).join('、');
    const label = available && selectedApproach
      ? `预演来由：${approachName[selectedApproach]}；可选${available}`
      : '没有可预演的来由';
    if (label !== lastApproachLabel) {
      a.setLabel(label);
      lastApproachLabel = label;
    }
  }

  function placeAffordance(id: string, shape: AffShape) {
    const rounded: AffShape = shape.kind === 'circle'
      ? { kind: 'circle', x: Math.round(shape.x), y: Math.round(shape.y), r: Math.round(shape.r) }
      : { kind: 'rect', x: Math.round(shape.x), y: Math.round(shape.y), w: Math.round(shape.w), h: Math.round(shape.h) };
    const old = shapeCache.get(id);
    if (old && old.kind === rounded.kind && old.x === rounded.x && old.y === rounded.y &&
      (old.kind === 'circle'
        ? rounded.kind === 'circle' && old.r === rounded.r
        : rounded.kind === 'rect' && old.w === rounded.w && old.h === rounded.h)) return;
    ownAffordances.get(id)?.setShape(rounded);
    shapeCache.set(id, rounded);
  }

  function updateShapes() {
    if (!canvasLayer || !opening) return;
    const p = currentAnchor?.();
    layout = heartLayout(ctx.stage.width, ctx.stage.height, p ?? null);
    placeAffordance('heart-approach', { kind: 'rect', x: layout.cx - layout.ri * 0.76, y: layout.approach[0]!.y - 24, w: layout.ri * 1.52, h: 48 });
    const weights = displayWeights();
    for (const trait of TRAITS) {
      const p0 = layout.weights[trait];
      const value = weights?.[trait] ?? 0.5;
      placeAffordance(`heart-weight-${trait}`, circle(p0.x, layout.cy + weightY(layout.ri, value), 24));
    }
    placeAffordance('heart-go', circle(layout.go.x, layout.go.y, layout.go.r));
    placeAffordance('heart-close', circle(layout.close.x, layout.close.y, layout.close.r));
    placeAffordance('heart-write', circle(layout.write.x, layout.write.y, layout.write.r));
    const editorClose = ownAffordances.get('heart-editor-close');
    if (editorClose) placeAffordance('heart-editor-close', circle(layout.editor.x + layout.editor.w + 14, layout.editor.y + layout.editor.h / 2, 23));
    if (input) {
      const setPx = (property: 'left' | 'top' | 'width' | 'height', value: number) => {
        const px = `${Math.round(value)}px`;
        if (input?.style[property] !== px) input!.style[property] = px;
      };
      setPx('left', layout.editor.x + 8);
      setPx('top', layout.editor.y + 3);
      setPx('width', Math.max(66, layout.editor.w - 16));
      setPx('height', layout.editor.h - 6);
    }
  }

  function syncAffordanceState() {
    if (!opening) return;
    const readyNow = ready();
    const interactive = progress === 1 && target === null && settledFrames >= 2;
    const hasApproaches = approaches.length > 0;
    ownAffordances.get('heart-approach')?.setEnabled(interactive && hasApproaches && !editorOpen);
    ownAffordances.get('heart-go')?.setEnabled(interactive && readyNow && !!rehearsal && !editorOpen);
    for (const trait of TRAITS) {
      ownAffordances.get(`heart-weight-${trait}`)?.setEnabled(interactive && readyNow && advanced && !!localWeights && !editorOpen);
    }
    ownAffordances.get('heart-write')?.setEnabled(interactive && readyNow && advanced && writable && !editorOpen);
    ownAffordances.get('heart-close')?.setEnabled(interactive && readyNow && !editorOpen);
    ownAffordances.get('heart-editor-close')?.setEnabled(editorOpen);

    setPulse('heart-approach', hasApproaches && !editorOpen && (!rehearsal || !readyNow));
    setPulse('heart-go', !!rehearsal && readyNow && !editorOpen);
    setApproachLabel();
  }

  function availableApproachAt(x: number): Approach | null {
    const left = layout.cx - layout.ri * 0.76;
    const span = layout.ri * 1.52;
    const raw = Math.max(0, Math.min(2, Math.floor(((x - left) / span) * 3)));
    const allowed = approaches.map((a) => indexOfApproach(a));
    const picked = allowed.sort((a, b) => Math.abs(a - raw) - Math.abs(b - raw))[0];
    return picked === undefined ? null : APPROACHES[picked]!;
  }

  function chooseApproach(approach: Approach | null) {
    if (!approach || !approaches.includes(approach)) return;
    selectedApproach = approach;
    setApproachLabel();
  }

  function sendRehearsal(approach: Approach | null) {
    if (!approach || !approaches.includes(approach)) return;
    unlocked = true;
    selectedApproach = approach;
    rehearsal = null;
    actualResponse = null;
    errorMotion = null;
    persistentGhost = null;
    setApproachLabel();
    syncAffordanceState();
    emit({ kind: 'rehearse', approach });
  }

  function waitForEffect(duration: number): Promise<void> {
    if (!opening || ctx.stage.reducedMotion || duration <= 0) return Promise.resolve();
    return new Promise<void>((resolve) => effectWaiters.push({ started: now(), duration, resolve }));
  }

  function settleEffects(all = false) {
    const at = now();
    for (let i = effectWaiters.length - 1; i >= 0; i--) {
      const waiter = effectWaiters[i]!;
      if (all || at - waiter.started >= waiter.duration) {
        effectWaiters.splice(i, 1);
        waiter.resolve();
      }
    }
  }

  function sendNudge(trait: Trait, delta: number) {
    const weights = displayWeights();
    if (!weights || !Number.isFinite(delta)) return;
    const current = weights[trait];
    const next = Math.max(0, Math.min(1, current + Math.max(-0.8, Math.min(0.8, delta))));
    const applied = next - current;
    if (Math.abs(applied) < 0.005) return;
    // 只显示短促的触感光，真实形变等世界回传快照后发生。
    nudgeFlashTrait = trait;
    nudgeFlashUntil = now() + 380;
    updateShapes();
    emit({ kind: 'nudge', trait, delta: applied });
  }

  function beginEditor() {
    if (!writable || editorOpen || !opening || !uiRoot) return;
    editorOpen = true;
    const strip = document.createElement('input');
    strip.type = 'text';
    strip.className = 'heart-word';
    strip.setAttribute('aria-label', '写一句话放进禾心里');
    strip.autocomplete = 'off';
    strip.spellcheck = false;
    strip.maxLength = 60;
    strip.inputMode = 'text';
    strip.style.position = 'absolute';
    strip.style.left = `${layout.editor.x + 8}px`;
    strip.style.top = `${layout.editor.y + 3}px`;
    strip.style.width = `${Math.max(66, layout.editor.w - 16)}px`;
    strip.style.height = `${layout.editor.h - 6}px`;
    input = strip;
    inputTextHandler = () => {
      const value = [...strip.value].slice(0, 30).join('');
      if (value !== strip.value) strip.value = value;
    };
    inputKeyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const words = [...strip.value.trim()].slice(0, 30).join('');
        if (words) emit({ kind: 'write', words });
        closeEditor();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeEditor();
      }
    };
    strip.addEventListener('input', inputTextHandler);
    strip.addEventListener('keydown', inputKeyHandler);
    uiRoot.appendChild(strip);
    addEditorClose();
    updateShapes();
    syncAffordanceState();
    strip.focus({ preventScroll: true });
  }

  function closeEditor() {
    if (!editorOpen) return;
    editorOpen = false;
    if (input && inputTextHandler) input.removeEventListener('input', inputTextHandler);
    if (input && inputKeyHandler) input.removeEventListener('keydown', inputKeyHandler);
    input?.remove();
    input = null;
    inputTextHandler = null;
    inputKeyHandler = null;
    removeAffordance('heart-editor-close');
    syncAffordanceState();
  }

  function addEditorClose() {
    removeAffordance('heart-editor-close');
    const aff = ctx.aff.add({
      id: 'heart-editor-close',
      label: '收起帛与笔',
      shape: circle(layout.editor.x + layout.editor.w + 14, layout.editor.y + layout.editor.h / 2, 23),
      enabled: true,
      represents: 'heart.editor.close',
      onActivate: closeEditor,
    });
    ownAffordances.set(aff.id, aff);
  }

  function addAffordances() {
    removeAllAffordances();
    const approachAff = ctx.aff.add({
      id: 'heart-approach',
      label: '预演来由：提旧情；可选提旧情、押地、带乡邻',
      shape: { kind: 'rect', x: layout.cx - layout.ri * 0.76, y: layout.approach[0]!.y - 24, w: layout.ri * 1.52, h: 48 },
      enabled: false,
      cursor: 'pointer',
      represents: 'heart.approach',
      onDrag: (e) => {
        if (e.phase === 'start') {
          const a = availableApproachAt(e.x);
          chooseApproach(a);
          dragOriginX = e.x;
          dragOriginY = e.y;
        } else if (e.phase === 'move') {
          chooseApproach(availableApproachAt(e.x));
        } else {
          const a = availableApproachAt(e.x);
          chooseApproach(a);
          if (Math.hypot(e.x - dragOriginX, e.y - dragOriginY) > 8) sendRehearsal(a);
        }
      },
      onActivate: () => sendRehearsal(selectedApproach),
    });
    ownAffordances.set(approachAff.id, approachAff);
    const approachKeyHandler = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (approaches.length < 2) return;
      e.preventDefault();
      e.stopPropagation();
      const ordered = APPROACHES.filter((a) => approaches.includes(a));
      const at = selectedApproach ? Math.max(0, ordered.indexOf(selectedApproach)) : 0;
      const step = e.key === 'ArrowRight' ? 1 : -1;
      chooseApproach(ordered[(at + step + ordered.length) % ordered.length]!);
    };
    approachAff.el.addEventListener('keydown', approachKeyHandler);
    affordanceCleanup.set(approachAff.id, () => approachAff.el.removeEventListener('keydown', approachKeyHandler));

    const goAff = ctx.aff.add({
      id: 'heart-go',
      label: '带这个来由去田伯家',
      shape: circle(layout.go.x, layout.go.y, layout.go.r),
      enabled: false,
      cursor: 'pointer',
      represents: 'heart.go',
      onActivate: () => {
        if (rehearsal && approaches.includes(rehearsal.approach)) {
          goFlashUntil = now() + 480;
          emit({ kind: 'go', approach: rehearsal.approach });
        }
      },
    });
    ownAffordances.set(goAff.id, goAff);

    for (const trait of TRAITS) {
      const point = layout.weights[trait];
      const aff = ctx.aff.add({
        id: `heart-weight-${trait}`,
        label: `拨动情利名砝码：${traitName[trait]}`,
        shape: circle(point.x, point.y, 24),
        enabled: false,
        cursor: 'grab',
        represents: `heart.weight.${trait}`,
        onDrag: (e) => {
          const weights = displayWeights();
          if (e.phase === 'start') {
            if (!weights) return;
            dragTrait = trait;
            dragStartY = e.y;
            dragStartValue = weights[trait];
            lastPointerY = e.y;
            weightDragOriginX = e.x;
            weightDragOriginY = e.y;
            dragPreview[trait] = dragStartValue;
          } else if (e.phase === 'move' && dragTrait === trait) {
            lastPointerY = e.y;
            const range = Math.max(30, layout.ri * 0.28);
            dragPreview[trait] = Math.max(0, Math.min(1, dragStartValue + (e.y - dragStartY) / range));
          } else if (e.phase === 'end' && dragTrait === trait) {
            lastPointerY = e.y;
            const range = Math.max(30, layout.ri * 0.28);
            const next = Math.max(0, Math.min(1, dragStartValue + (e.y - dragStartY) / range));
            const delta = next - dragStartValue;
            delete dragPreview[trait];
            dragTrait = null;
            if (Math.hypot(e.x - weightDragOriginX, e.y - weightDragOriginY) > 8 && Math.abs(delta) > 0.015) sendNudge(trait, delta);
          }
        },
        onActivate: () => sendNudge(trait, 0.1),
      });
      ownAffordances.set(aff.id, aff);
      const keyHandler = (e: KeyboardEvent) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        e.stopPropagation();
        sendNudge(trait, e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 0.1 : -0.1);
      };
      aff.el.addEventListener('keydown', keyHandler);
      affordanceCleanup.set(aff.id, () => aff.el.removeEventListener('keydown', keyHandler));
    }

    const writeAff = ctx.aff.add({
      id: 'heart-write',
      label: '展开帛与笔，写一句话',
      shape: circle(layout.write.x, layout.write.y, layout.write.r),
      enabled: false,
      cursor: 'text',
      represents: 'heart.write.open',
      onActivate: beginEditor,
    });
    ownAffordances.set(writeAff.id, writeAff);

    const closeAff = ctx.aff.add({
      id: 'heart-close',
      label: '合上铜镜',
      shape: circle(layout.close.x, layout.close.y, layout.close.r),
      enabled: false,
      cursor: 'pointer',
      represents: 'heart.close',
      onActivate: () => {
        emit({ kind: 'close' });
      },
    });
    ownAffordances.set(closeAff.id, closeAff);
    syncAffordanceState();
  }

  function seedProgress(seed: Seed): number {
    const motion = seedFalls.get(seed.id);
    if (!motion) return 1;
    if (ctx.stage.reducedMotion) return 1;
    return Math.max(0, Math.min(1, (now() - motion.start) / motion.duration));
  }

  function sproutProgress(seed: Seed): number {
    const motion = seedSprouts.get(seed.id);
    if (!motion) return seed.sprouted ? 1 : 0;
    if (ctx.stage.reducedMotion) return 1;
    return Math.max(0, Math.min(1, (now() - motion.start) / motion.duration));
  }

  function frame(t: number, dt: number) {
    if (!canvasLayer || !opening) return;
    const frameNow = now();
    settleEffects();
    for (const [id, motion] of seedFalls) if (frameNow - motion.start >= motion.duration) seedFalls.delete(id);
    for (const [id, motion] of seedSprouts) if (frameNow - motion.start >= motion.duration) seedSprouts.delete(id);
    if (target !== null) {
      if (ctx.stage.reducedMotion) progress = target;
      else {
        const k = 1 - Math.exp(-Math.max(0, dt) * 8.5);
        progress += (target - progress) * k;
        if (Math.abs(target - progress) < 0.003) progress = target;
      }
      if (progress === target) {
        const reached = target;
        target = null;
        for (const waiter of [...transitionWaiters]) {
          if (waiter.target === reached) {
            waiter.resolve();
            transitionWaiters.splice(transitionWaiters.indexOf(waiter), 1);
          }
        }
        if (reached === 0) {
          opening = false;
          cleanupRuntime();
          return;
        }
      }
    }

    settledFrames = progress === 1 && target === null ? settledFrames + 1 : 0;
    syncAffordanceState();
    updateShapes();
    const weights = displayWeights();
    const ghost = errorMotion ? errorMotion.before : persistentGhost;
    const layerPulse: Partial<Record<Layer, number>> = {};
    for (const layer of LAYERS) {
      const until = flashes.get(layer) ?? 0;
      if (until > now()) {
        const remaining = until - now();
        layerPulse[layer] = ctx.stage.reducedMotion ? 1 : Math.min(1, remaining / 850);
      } else flashes.delete(layer);
    }
    const motion = errorMotion;
    const err = motion ? {
      predicted: motion.predicted,
      actual: motion.actual,
      progress: ctx.stage.reducedMotion ? 1 : Math.max(0, Math.min(1, (now() - motion.start) / motion.duration)),
    } : null;
    canvasLayer.clear();
    paintHeart(canvasLayer.ctx, layout, {
      t: ctx.stage.reducedMotion ? 0 : t,
      open: progress,
      advanced,
      canGo: !!rehearsal && approaches.length > 0 && ready(),
      canWrite: advanced && writable,
      weights,
      ghost,
      seeds,
      seedProgress,
      sproutProgress,
      lamps: snapshot?.lamps ?? null,
      lampPulse: layerPulse,
      pressure: snapshot?.pressure ?? 0,
      selectedApproach: currentIndex(),
      approachAvailable: APPROACHES.map((a) => approaches.includes(a)),
      approachFocus: !rehearsal && !editorOpen,
      weightFocus: TRAITS.find((trait) => ownAffordances.get(`heart-weight-${trait}`)?.hovering) ?? (now() < nudgeFlashUntil ? nudgeFlashTrait : null),
      writing: editorOpen,
      goPressed: now() < goFlashUntil,
      response: rehearsal?.predicted ?? actualResponse,
      error: err,
    });
    labels?.render(layout, { open: progress, advanced, writing: editorOpen, canGo: !!rehearsal && approaches.length > 0 && ready(), canWrite: advanced && writable, approaches, weights, compare: !!err || !!persistentGhost });
    if (motion && (ctx.stage.reducedMotion || now() - motion.start >= motion.duration)) {
      persistentGhost = { ...motion.before };
      actualResponse = motion.actual;
      rehearsal = null;
      errorMotion = null;
      resolveError?.();
      resolveError = null;
    }
  }

  function cleanupRuntime() {
    resolveError?.();
    resolveError = null;
    settleEffects(true);
    closeEditor();
    removeAllAffordances();
    offFrame?.();
    offFrame = null;
    offResize?.();
    offResize = null;
    labels?.destroy();
    labels = null;
    ctx.stage.removeLayer('heart-view');
    ctx.stage.removeLayer('heart-ui');
    canvasLayer = null;
    uiRoot = null;
    currentAnchor = null;
    seedFalls.clear();
    seedSprouts.clear();
    flashes.clear();
  }

  function mountRuntime() {
    if (!canvasLayer) {
      canvasLayer = ctx.stage.layer('heart-view', 40);
      canvasLayer.canvas.setAttribute('role', 'img');
      canvasLayer.canvas.setAttribute('aria-label', '青铜镜里的黄昏田、三种来由、三样砝码与三盏心灯');
      canvasLayer.canvas.dataset.heart = 'true';
    }
    if (!uiRoot) {
      uiRoot = ctx.stage.dom('heart-ui', 45);
      uiRoot.style.pointerEvents = 'none';
      uiRoot.setAttribute('aria-hidden', 'false');
      uiRoot.dataset.heart = 'true';
      labels = createHeartLabels(uiRoot);
    }
    if (!offResize) offResize = ctx.stage.onResize(() => updateShapes());
    if (!offFrame) offFrame = ctx.stage.onFrame(frame);
    layout = heartLayout(ctx.stage.width, ctx.stage.height, currentAnchor?.() ?? null);
    addAffordances();
  }

  function animateTo(next: 0 | 1): Promise<void> {
    if (target !== next && target !== null) {
      for (const waiter of transitionWaiters.splice(0)) waiter.resolve();
    }
    if (progress === next && target === null) return Promise.resolve();
    target = next;
    if (next === 1) opening = true;
    return new Promise((resolve) => {
      transitionWaiters.push({ target: next, resolve });
      if (ctx.stage.reducedMotion) {
        progress = next;
        target = null;
        for (const waiter of transitionWaiters.splice(0)) waiter.resolve();
        if (next === 0) {
          opening = false;
          cleanupRuntime();
        }
      }
    });
  }

  return {
    get isOpen() {
      return opening;
    },
    async open(anchor, opts) {
      if (destroyed) return;
      currentAnchor = anchor;
      if (opening && target !== 0) {
        updateShapes();
        await animateTo(1);
        return;
      }
      openReason = opts?.reason ?? 'player';
      unlocked = openReason === 'player';
      settledFrames = 0;
      opening = true;
      rehearsal = null;
      actualResponse = null;
      errorMotion = null;
      persistentGhost = null;
      mountRuntime();
      const first = ownAffordances.get('heart-approach');
      if (first && !first.el.disabled) first.el.focus({ preventScroll: true });
      await animateTo(1);
    },
    async close() {
      if (!opening && progress === 0) {
        cleanupRuntime();
        return;
      }
      // 程序关闭只撤下交互，不再回发 close 事件。
      closeEditor();
      removeAllAffordances();
      ctx.lines.clear();
      await animateTo(0);
    },
    update(next) {
      const beforeSeeds = new Map(seeds.map((s) => [s.id, s]));
      snapshot = {
        ...next,
        belief: { ...next.belief },
        lamps: { ...next.lamps },
        seeds: next.seeds.map((s) => ({ ...s })),
      };
      localWeights = { ...next.belief };
      seeds.splice(0, seeds.length, ...next.seeds.map((s) => ({ ...s })));
      const at = now();
      const currentIds = new Set(seeds.map((s) => s.id));
      for (const id of seedFalls.keys()) if (!currentIds.has(id)) seedFalls.delete(id);
      for (const id of seedSprouts.keys()) if (!currentIds.has(id)) seedSprouts.delete(id);
      for (const seed of seeds) {
        const old = beforeSeeds.get(seed.id);
        if (!old) seedFalls.set(seed.id, { start: at, duration: 480 });
        if (seed.sprouted && !old?.sprouted) seedSprouts.set(seed.id, { start: at, duration: 760 });
      }
      updateShapes();
    },
    showRehearsal(r: Rehearsal) {
      rehearsal = { ...r };
      actualResponse = r.predicted;
      errorMotion = null;
      persistentGhost = null;
      selectedApproach = r.approach;
      setApproachLabel();
      syncAffordanceState();
      void ctx.lines.say({
        who: '禾',
        text: rehearsalText(r),
        anchor: () => ({ x: layout.cx, y: layout.cy - layout.ri * 0.69 }),
        width: () => layout.ri * 1.7,
        ink: 'light',
        tone: 'thought',
        source: { source: 'rules' },
        why: r.line,
        sticky: true,
      });
      return Promise.resolve();
    },
    showError(e: HeartErrorView) {
      resolveError?.();
      resolveError = null;
      persistentGhost = { ...e.before };
      localWeights = { ...e.after };
      rehearsal = null;
      selectedApproach = e.approach ?? null;
      actualResponse = e.actual;
      dragPreview = {};
      dragTrait = null;
      errorMotion = {
        before: { ...e.before },
        after: { ...e.after },
        predicted: e.predicted,
        actual: e.actual,
        start: now(),
        duration: ctx.stage.reducedMotion ? 0 : ERROR_MS,
      };
      updateShapes();
      const method = e.approach ? approachName[e.approach] : '借法未明';
      const resultName = { give: '肯给粟', lend: '肯借粟', 'buy-land': '要买地', refuse: '会拒绝' };
      void ctx.lines.say({ who: '禾', text: `${method}：预想${resultName[e.predicted]}，实际${resultName[e.actual]}。`, anchor: () => ({ x: layout.cx, y: layout.cy - layout.ri * 0.25 }), width: () => layout.ri * 1.7, ink: 'light', source: { source: 'rules' }, sticky: true });
      if (!opening || ctx.stage.reducedMotion) return Promise.resolve();
      return new Promise<void>((resolve) => { resolveError = resolve; });
    },
    addSeed(seed: Seed) {
      const copy = { ...seed };
      const i = seeds.findIndex((s) => s.id === copy.id);
      if (i >= 0) seeds.splice(i, 1, copy);
      else seeds.push(copy);
      seedFalls.set(copy.id, { start: now(), duration: ctx.stage.reducedMotion ? 0 : 480 });
      if (copy.sprouted) seedSprouts.set(copy.id, { start: now(), duration: ctx.stage.reducedMotion ? 0 : 760 });
      return waitForEffect(480);
    },
    sprout(seed: Seed) {
      const copy = { ...seed, sprouted: true };
      const i = seeds.findIndex((s) => s.id === copy.id);
      if (i >= 0) seeds.splice(i, 1, copy);
      else seeds.push(copy);
      seedSprouts.set(copy.id, { start: now(), duration: ctx.stage.reducedMotion ? 0 : 760 });
      return waitForEffect(760);
    },
    flashLayer(layer) {
      flashes.set(layer, now() + (ctx.stage.reducedMotion ? 300 : 850));
    },
    setAdvanced(on) {
      advanced = on;
      if (!on) closeEditor();
      syncAffordanceState();
    },
    setApproaches(list) {
      approaches = [...new Set(list)].filter((a) => APPROACHES.includes(a));
      if (!selectedApproach || !approaches.includes(selectedApproach)) {
        selectedApproach = approaches[0] ?? null;
      }
      if (rehearsal && !approaches.includes(rehearsal.approach)) rehearsal = null;
      setApproachLabel();
      syncAffordanceState();
    },
    setWritable(on) {
      writable = on;
      if (!on) closeEditor();
      syncAffordanceState();
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const waiter of transitionWaiters.splice(0)) waiter.resolve();
      target = null;
      progress = 0;
      opening = false;
      cleanupRuntime();
      listeners.clear();
      ctx.lines.clear();
      seeds.length = 0;
      seedFalls.clear();
      seedSprouts.clear();
      flashes.clear();
    },
  };
}
