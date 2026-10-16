// 指尖与键盘都有即时的触感；可做之物重墨，背景只留轻痕。
import type { Ctx } from '../app/context';

export function mountTouchFeedback(ctx: Ctx): void {
  const layer = ctx.stage.dom('touch-feedback', 90);
  layer.setAttribute('aria-hidden', 'true');
  const rings = new Set<HTMLElement>();
  const timers = new Set<number>();
  let pointerAt = -Infinity;
  let alive = true;

  function show(x: number, y: number, active: boolean) {
    if (!alive) return;
    const r = active ? 26 : 19;
    const ring = document.createElement('span');
    ring.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${r * 2}px;height:${r * 2}px;
      border-radius:50%;box-sizing:border-box;pointer-events:none;transform:translate(-50%,-50%);
      border:2px solid rgba(58,33,20,.88);outline:2px solid rgba(231,200,112,.94);
      background:radial-gradient(circle,rgba(233,204,125,${active ? '.64' : '.38'}) 0%,rgba(233,204,125,.14) 65%,transparent 100%);`;
    layer.appendChild(ring);
    rings.add(ring);
    const remove = () => { ring.remove(); rings.delete(ring); };
    if (typeof ring.animate === 'function') {
      const transform = 'translate(-50%,-50%)';
      const animation = ring.animate([
        { opacity: 1, transform: ctx.stage.reducedMotion ? transform : `${transform} scale(.85)` },
        { opacity: 0, transform: ctx.stage.reducedMotion ? transform : `${transform} scale(1.3)` },
      ], { duration: ctx.stage.reducedMotion ? 260 : 360, easing: 'ease-out', fill: 'forwards' });
      void animation.finished.then(remove, remove);
    } else {
      const timer = window.setTimeout(() => { timers.delete(timer); remove(); }, 300);
      timers.add(timer);
    }
  }

  const onPointer = (event: PointerEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.zp-shade')) return;
    pointerAt = performance.now();
    const root = ctx.stage.root.getBoundingClientRect();
    const aff = target?.closest<HTMLElement>('[data-aff]:not([disabled])');
    show(event.clientX - root.left, event.clientY - root.top, !!aff);
  };
  ctx.stage.root.addEventListener('pointerdown', onPointer, { passive: true });
  const offClick = ctx.bus.on('aff.click', ({ id }: { id: string }) => {
    if (performance.now() - pointerAt < 150) return;
    const aff = ctx.aff.get(id);
    if (!aff) return;
    const rect = aff.el.getBoundingClientRect();
    const root = ctx.stage.root.getBoundingClientRect();
    show(rect.left + rect.width / 2 - root.left, rect.top + rect.height / 2 - root.top, true);
  });
  window.addEventListener('pagehide', () => {
    alive = false;
    offClick();
    ctx.stage.root.removeEventListener('pointerdown', onPointer);
    for (const ring of rings) ring.remove();
    rings.clear();
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    ctx.stage.removeLayer('touch-feedback');
  }, { once: true });
}
