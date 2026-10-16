import { actorReport } from '../../engine/layers/report';
import type { ActorCue } from '../../engine/layers/types';
import type { Framework } from '../../app/context';
import { CHAPTER_YEARS } from '../../director/pipeline/fifty-years-plan';
import type { Longscroll } from '../../director/pipeline/fifty-years-state';

/** 年表只给一件消息和一个继续动作；人物轮廓把时间留在身体上。 */
export const chronicle: Framework = {
  async run(act, ctx) {
    const traceStart = ctx.bus.trace.length;
    const scroll = ctx.handoff.longscroll as Longscroll;
    const year = CHAPTER_YEARS[act.id]!;
    const due = scroll.advance(Math.max(year, scroll.history.state().year));
    for (const event of due) {
      const fact = scroll.ledger().find(f => f.id === `history.event.${event.id}`)!;
      ctx.bus.log('world.fact', { fact });
      ctx.bus.log('world.event', { kind: 'history', event: event.id, year: event.year, entry: scroll.history.enter(event), macro: scroll.history.state().macro });
    }
    const resumed = scroll.history.state().year > year;
    const event = scroll.history.events().find(e => e.year === year)!;
    const entry = scroll.history.enter(event);
    const line = resumed ? '长卷还在，接着上次往前走。' : entry.line;
    const age = resumed ? '杖上的刻痕还在' : year === -334 ? '小石已高过旧门闩' : year === -314 ? '禾的杖已磨亮，田伯鬓白' : year === -306 ? '小石接过禾的杖' : '禾的手还握得紧';
    for (const id of ['vignette', 'reveal', 'jixia-speakers', 'jixia-speakers-ground', 'wude-wheel', 'wude-wheel-ground', 'qi-knife', 'bells']) ctx.stage.removeLayer(id);
    ctx.lines.clear();
    const layer = ctx.stage.layer('chronicle', 35);
    let pressed = false;
    let closingVoice: string[] | undefined;
    const draw = () => {
      const c = layer.ctx, w = ctx.stage.width, h = ctx.stage.height;
      layer.clear();
      c.fillStyle = '#211a15'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#8b7351'; c.lineWidth = 1; c.beginPath(); c.moveTo(w * .15, h * .3); c.lineTo(w * .85, h * .3); c.stroke();
      for (let i = 0; i <= 5; i++) { const x = w * (.15 + i * .14); c.beginPath(); c.arc(x, h * .3, 3, 0, Math.PI * 2); c.fillStyle = i <= (scroll.history.state().year + 356) / 10 ? '#d9b979' : '#514737'; c.fill(); }
      c.fillStyle = '#d9c8a7'; c.textAlign = 'center'; c.font = '24px "Songti SC",serif'; c.fillText(`前${-scroll.history.state().year}年`, w / 2, h * .23);
      // 同一个轮廓：暮年背弯、手边有杖；不用数字报年龄。
      const old = year >= -314 || resumed, x = w / 2, y = h * .58;
      c.strokeStyle = '#bda984'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath();
      c.arc(x - (old ? 9 : 0), y - 43, 9, 0, Math.PI * 2); c.moveTo(x, y - 30); c.lineTo(x + (old ? 12 : 0), y + 10);
      c.moveTo(x + (old ? 12 : 0), y + 10); c.lineTo(x - 15, y + 42); c.moveTo(x + (old ? 12 : 0), y + 10); c.lineTo(x + 20, y + 42); c.stroke();
      if (old) { c.lineWidth = 3; c.beginPath(); c.moveTo(x - 30, y - 13); c.lineTo(x - 30, y + 44); c.stroke(); }
      c.font = '15px "Songti SC",serif'; c.fillStyle = '#ac9674'; c.fillText(age, w / 2, h * .75);
      c.fillStyle = pressed ? '#f3dda5' : '#b9955d'; c.beginPath(); c.moveTo(w / 2 - 15, h * .84); c.lineTo(w / 2 + 15, h * .84); c.lineTo(w / 2, h * .87); c.closePath(); c.fill();
    };
    draw();
    let resolve!: () => void;
    const done = new Promise<void>(r => { resolve = r; });
    const shape = () => ({ kind: 'rect' as const, x: ctx.stage.width * .25, y: ctx.stage.height * .78, w: ctx.stage.width * .5, h: ctx.stage.height * .14 });
    const next = ctx.aff.add({ id: 'chronicle-next', label: '继续长卷', shape: shape(), key: 'Enter', represents: act.elements[0]!.represents,
      onActivate: () => {
        if (pressed) return;
        pressed = true; draw();
        const cue = (ctx.handoff.actorCues as ActorCue[] | undefined)?.[0];
        if (!cue) { resolve(); return; }
        const report = actorReport(ctx.plan, act, cue, { act: act.id }, ctx.bus.trace.slice(traceStart), 0);
        closingVoice = report.voice;
        // 长卷没有 verify-entry 的展开豁免：主屏只留第一句，全文由 report payload 存档。
        void ctx.lines.say({ who: cue.who, text: closingVoice![0]!,
          anchor: () => ({ x: ctx.stage.width / 2, y: ctx.stage.height * .4 }),
          sticky: true, charMs: 55, source: { source: 'rules', why: 'actor-report' } });
        setTimeout(resolve, 1800);
      } });
    const off = ctx.stage.onResize(() => { draw(); next.setShape(shape()); });
    void ctx.lines.say({ who: resumed ? '导师' : entry.who, text: line, anchor: () => ({ x: ctx.stage.width / 2, y: ctx.stage.height * .4 }), sticky: true, charMs: 0 });
    ctx.bus.log('world.event', { kind: 'history.entry', act: act.id, year: scroll.history.state().year, who: entry.who, line, age, resumed });
    try { await done; } finally { next.remove(); off(); ctx.lines.clear(); ctx.stage.removeLayer('chronicle'); }
    return { act: act.id, data: { year: scroll.history.state().year, line, voice: closingVoice, entered: entry, events: due.map(e => e.id) } };
  },
};
