import type { Ctx } from '../../app/context';
import type { PlanAct } from '../../engine/types';
import { PAL } from '../../components/paint/palette';
import { lacquerGround, finish } from '../../components/paint/texture';
import { bronzeBorder, cloudBand } from '../../components/paint/ornament';
import type { Affordance } from '../../engine/affordance';

export const pause = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
export function trace(ctx: Ctx, kind: string, data: Record<string, unknown> = {}) {
  // 冻结的总线类型尚未列出小游戏节点；运行时保留完整 kind。
  ctx.bus.log(kind as Parameters<Ctx['bus']['log']>[0], data);
}
export function requireElements(act: PlanAct, specs: Record<string, string>) {
  for (const [id, action] of Object.entries(specs)) {
    if (!act.elements.some(e => e.id === id && e.actions.includes(action))) throw new Error(`呈现方案缺少 ${id} 的 ${action} 动作`);
  }
}
export function say(ctx: Ctx, text: string, who = '季') {
  void ctx.lines.say({ who, text, anchor: () => ({ x: ctx.stage.width / 2, y: ctx.stage.height * 0.23 }),
    sticky: true, charMs: 0, source: { source: 'rules' } });
}
export function pulse(aff: Affordance) {
  aff.el.dataset.pulse = 'breath';
  aff.el.setAttribute('aria-current', 'true');
  aff.el.style.boxShadow = `inset 0 0 0 1px ${PAL.gold}, 0 0 22px ${PAL.gold}66`;
}
export function flash(aff: Affordance, right = true) {
  aff.el.style.background = right ? PAL.gold + '88' : PAL.cinnabar + 'aa';
  aff.el.style.boxShadow = `0 0 44px ${right ? PAL.gold : PAL.cinnabar}`;
}
export function label(aff: Affordance, text: string) {
  aff.el.textContent = text;
  aff.el.style.color = PAL.silk;
  aff.el.style.font = '22px "Songti SC","STSong",serif';
  aff.el.style.lineHeight = '1';
}
export function background(ctx: Ctx, id: string, seed: number) {
  const layer = ctx.stage.layer(`${id}-ground`, 20);
  const draw = () => {
    const { width: w, height: h } = ctx.stage;
    layer.clear();
    lacquerGround(layer.ctx, 0, 0, w, h, { seed, sheen: 0.32 });
    cloudBand(layer.ctx, w * 0.06, h * 0.08, w * 0.88, h * 0.06, { seed, alpha: 0.23 });
    bronzeBorder(layer.ctx, 12, 12, w - 24, h - 24, { band: 10 });
    finish(layer.ctx, w, h, { vignette: 0.38, grain: 0.55 });
  };
  draw();
  return { off: ctx.stage.onResize(draw), remove: () => ctx.stage.removeLayer(`${id}-ground`) };
}
export function scroll(c: CanvasRenderingContext2D, x: number, y: number, width: number, opened: boolean, marks = 0) {
  const w = width * (opened ? 1.5 : 1);
  c.fillStyle = PAL.ochre;
  c.fillRect(x - w / 2, y - 22, w, 44);
  c.strokeStyle = PAL.gold;
  c.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const px = x - w / 2 + i * w / 6;
    c.beginPath(); c.moveTo(px, y - 25); c.lineTo(px, y + 25); c.stroke();
  }
  c.strokeStyle = PAL.cinnabar;
  for (let i = 0; i < marks; i++) {
    c.beginPath(); c.moveTo(x - w / 3 + i * 10, y - 12); c.lineTo(x - w / 3 + i * 10, y + 12); c.stroke();
  }
}

export async function enter(ctx: Ctx, act: PlanAct, id: string, draw: (opened: boolean) => void) {
  const started = performance.now();
  let open = false;
  const shape = () => ({ kind: 'rect' as const, x: ctx.stage.width / 2 - 72, y: ctx.stage.height * 0.72 - 34, w: 144, h: 68 });
  let entry: Affordance | undefined;
  const offResize = ctx.stage.onResize(() => { entry?.setShape(shape()); draw(open); });
  try {
    await new Promise<void>(resolve => {
      const a = ctx.aff.add({ id: 'ji-scroll', label: '展开季的竹简', shape: shape(), key: 'Enter',
      represents: act.elements.find(e => e.id === 'ji-scroll')?.represents,
      onActivate() {
        if (open) return;
        open = true; flash(a); a.setEnabled(false); draw(true);
        // 首次声音要建缓存，先让这一帧的展开与亮光真正画出来。
        requestAnimationFrame(() => setTimeout(() => {
          ctx.audio.unlock(); ctx.audio.ambience('city', 0.08, 300); ctx.audio.sfx('brush');
        }, 250));
        trace(ctx, `${id}.step`, { phase: 'open' });
        setTimeout(resolve, Math.max(500, 3100 - (performance.now() - started)));
        } });
      entry = a;
      pulse(a);
      draw(false);
      const intro = act.lines.find(l => l.id === 'enter')?.text;
      if (intro && [...intro].length <= Math.min(18, act.budget.maxChars)) say(ctx, intro);
    });
  } finally { entry?.remove(); offResize(); }
}
