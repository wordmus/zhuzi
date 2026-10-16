// 五德转盘：周火到齐水只是季在稷下的推演，不是齐国受命的史实。
import type { Framework } from '../../app/context';
import type { Affordance } from '../../engine/affordance';
import { PAL } from '../../components/paint/palette';
import { makeFigure } from '../../components/paint/figure';
import { bronzeBand } from '../../components/paint/ornament';
import { ELEMENTS, OVERCOMES, ROUNDS, beats, elementAt, initialWheel, turn, victor } from './logic';
import type { Element } from './logic';
import { background, enter, flash, label, pause, pulse, requireElements, say, scroll, trace } from '../jixia-speakers/surface';

function icon(c: CanvasRenderingContext2D, e: Element, x: number, y: number, r: number, color: string) {
  c.save(); c.translate(x, y); c.scale(r, r); c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 0.08;
  c.beginPath();
  if (e === '木') {
    c.moveTo(0, 0.8); c.lineTo(0, -0.8); c.moveTo(-0.6, -0.1); c.lineTo(0, -0.65); c.lineTo(0.6, -0.1);
    c.moveTo(-0.7, 0.3); c.lineTo(0, -0.25); c.lineTo(0.7, 0.3);
  } else if (e === '火') {
    c.moveTo(0, 0.8); c.bezierCurveTo(-1, 0.5, -0.6, -0.2, -0.3, -0.3);
    c.bezierCurveTo(0, 0, -0.2, -0.7, 0.2, -0.9); c.bezierCurveTo(0.2, -0.1, 1, 0.1, 0, 0.8);
  } else if (e === '土') {
    c.moveTo(-0.9, 0.6); c.lineTo(-0.45, -0.2); c.lineTo(0, 0.3); c.lineTo(0.4, -0.7); c.lineTo(0.9, 0.6); c.closePath();
  } else if (e === '金') {
    c.moveTo(-0.75, 0.65); c.lineTo(0.55, -0.7); c.lineTo(0.7, -0.55); c.lineTo(-0.65, 0.75); c.closePath();
    c.moveTo(-0.6, 0.1); c.lineTo(-0.1, 0.6);
  } else {
    for (let i = 0; i < 3; i++) { const y0 = -0.5 + i * 0.5; c.moveTo(-0.85, y0); c.bezierCurveTo(-0.3, y0 - 0.5, 0.3, y0 + 0.5, 0.85, y0); }
  }
  c.stroke(); c.restore();
}

export const wudeWheel: Framework = {
  async run(act, ctx) {
    requireElements(act, { 'ji-scroll': 'open', 'wude-pointer': 'turn', ...Object.fromEntries(ELEMENTS.map((_, i) => [`virtue-${i}`, 'choose'])) });
    const rng = ctx.rng.fork('wude-wheel');
    const bg = background(ctx, 'wude-wheel', rng.int(1, 10000));
    const layer = ctx.stage.layer('wude-wheel', 21);
    const ji = makeFigure('ji', { pose: 'carry', onDark: true });
    const zou = makeFigure('mentor', { pose: 'sit', facing: -1, onDark: true });
    let score = initialWheel();
    let activeRound = -1;
    let opened = false;
    let finished = false;
    let pointer: Element = '木';
    let lastRight = false;
    let feedback = false;
    let locked = false;
    let cards: Affordance[] = [];
    let handle: Affordance | null = null;
    const geometry = () => ({ cx: ctx.stage.width / 2, cy: ctx.stage.height * 0.52, r: Math.min(ctx.stage.width * 0.33, ctx.stage.height * 0.25) });
    const point = (e: Element, radius = 1) => {
      const { cx, cy, r } = geometry();
      const angle = -Math.PI / 2 + ELEMENTS.indexOf(e) * Math.PI * 2 / 5;
      return { x: cx + Math.cos(angle) * r * radius, y: cy + Math.sin(angle) * r * radius };
    };
    const shapes = () => ELEMENTS.map(e => {
      const p = point(e); return { kind: 'circle' as const, ...p, r: Math.min(32, geometry().r * 0.2) };
    });
    const pointerShape = () => {
      const p = point(pointer, 0.5); return { kind: 'circle' as const, ...p, r: Math.max(20, geometry().r * 0.15) };
    };
    const draw = (open = opened) => {
      opened = open;
      const c = layer.ctx, w = ctx.stage.width, h = ctx.stage.height;
      const { cx, cy, r } = geometry(); layer.clear();
      ji.draw(c, w * 0.12, h * 0.69, Math.min(h * 0.24, w * 0.17), ctx.stage.time);
      zou.draw(c, w * 0.89, h * 0.65, Math.min(h * 0.24, w * 0.15), ctx.stage.time);
      if (activeRound < 0) { scroll(c, w / 2, h * 0.72, 90, opened); return; }
      c.fillStyle = PAL.bronze; c.beginPath(); c.arc(cx, cy, r * 1.2, 0, Math.PI * 2); c.fill();
      c.strokeStyle = PAL.gold; c.lineWidth = 2;
      for (const radius of [1.18, 1.08, 0.73]) { c.beginPath(); c.arc(cx, cy, r * radius, 0, Math.PI * 2); c.stroke(); }
      for (const e of ELEMENTS) {
        const p = point(e, 0.74), q = point(OVERCOMES[e], 0.74);
        c.strokeStyle = PAL.gold + (finished || feedback && lastRight ? 'cc' : '33');
        c.lineWidth = finished ? 2.5 : 1; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke();
        const a = Math.atan2(q.y - p.y, q.x - p.x);
        c.beginPath(); c.moveTo(q.x - Math.cos(a - 0.45) * 10, q.y - Math.sin(a - 0.45) * 10);
        c.lineTo(q.x, q.y); c.lineTo(q.x - Math.cos(a + 0.45) * 10, q.y - Math.sin(a + 0.45) * 10); c.stroke();
      }
      ELEMENTS.forEach((e, i) => {
        const p = point(e); const picked = feedback && pointer === e;
        c.fillStyle = picked ? lastRight ? PAL.gold : PAL.cinnabar : score.tried.includes(e) ? PAL.umber : PAL.lacquer2;
        c.beginPath(); c.arc(p.x, p.y, shapes()[i]!.r, 0, Math.PI * 2); c.fill();
        icon(c, e, p.x, p.y - 10, Math.max(9, r * 0.07), PAL.silk);
      });
      const previous = ROUNDS[Math.min(activeRound, 2)]!.previous;
      c.fillStyle = PAL.lacquer2; c.beginPath(); c.arc(cx, cy, r * 0.3, 0, Math.PI * 2); c.fill();
      icon(c, previous, cx, cy, r * 0.17, PAL.gold);
      const p = point(pointer, 0.67);
      c.strokeStyle = feedback && !lastRight ? PAL.cinnabar : PAL.gold; c.lineWidth = Math.max(4, r * 0.03);
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(p.x, p.y); c.stroke();
      c.fillStyle = PAL.gold; const grip = point(pointer, 0.5);
      c.beginPath(); c.arc(grip.x, grip.y, r * 0.07, 0, Math.PI * 2); c.fill();
      if (feedback && !lastRight) {
        const hint = point(victor(previous), 0.75);
        icon(c, victor(previous), hint.x, hint.y, r * 0.1, PAL.gold);
      }
      bronzeBand(c, w * 0.38, h * 0.87, w * 0.24, 10, { pattern: 'panchi' });
      scroll(c, w / 2, h * 0.83, 66, true, score.firstTry);
      for (let i = 0; i < score.mistakes; i++) { c.fillStyle = PAL.cinnabar; c.fillRect(w * 0.4 + i * 7, h * 0.9, 3, 7); }
    };
    const resize = () => { cards.forEach((a, i) => a.setShape(shapes()[i]!)); handle?.setShape(pointerShape()); };
    const offResize = ctx.stage.onResize(resize);
    const offFrame = ctx.stage.onFrame(() => draw());
    trace(ctx, 'wude-wheel.start', { act: act.id, focus: act.focus });
    try {
      await enter(ctx, act, 'wude-wheel', draw);
      for (activeRound = 0; activeRound < ROUNDS.length; activeRound++) {
        const round = ROUNDS[activeRound]!;
        pointer = round.previous; feedback = false; locked = false;
        zou.setPose('sit', 0);
        say(ctx, round.hint, '邹子');
        trace(ctx, 'wude-wheel.step', { round: activeRound, previous: round.previous, next: round.next });
        await new Promise<void>(resolve => {
          const choose = (e: Element) => {
            if (locked || score.tried.includes(e)) return;
            locked = true; feedback = true; pointer = e; lastRight = beats(e, round.previous);
            const a = cards[ELEMENTS.indexOf(e)]!; flash(a, lastRight);
            cards.forEach(card => card.setEnabled(false)); handle?.setEnabled(false);
            score = turn(score, e); resize();
            ji.setPose(lastRight ? 'sit-write' : 'slump', 80); zou.setPose(lastRight ? 'nod' : 'shake-head', 80);
            ctx.audio.sfx(lastRight ? 'lamp' : 'refuse', { index: activeRound, gain: 0.35 });
            trace(ctx, 'wude-wheel.choice', { round: activeRound, previous: round.previous, choice: e, correct: lastRight });
            say(ctx, lastRight ? '此德相胜。' : '再看相胜的来路。', '邹子'); draw();
            if (lastRight) setTimeout(resolve, 850);
            else setTimeout(() => {
              locked = false;
              cards.forEach((card, i) => {
                card.setEnabled(!score.tried.includes(ELEMENTS[i]!));
                card.el.style.background = ''; card.el.style.boxShadow = '';
              });
              const next = cards.find((_, i) => !score.tried.includes(ELEMENTS[i]!));
              if (next) pulse(next);
              handle?.setEnabled(true);
            }, 700);
          };
          cards = ELEMENTS.map((e, i) => {
            const a = ctx.aff.add({ id: `virtue-${i}`, label: `转到${e}德`, shape: shapes()[i]!, key: String(i + 1),
              represents: act.elements.find(el => el.id === `virtue-${i}`)?.represents, onActivate: () => choose(e) });
            label(a, e); a.el.style.paddingTop = '24px';
            return a;
          });
          pulse(cards[0]!);
          handle = ctx.aff.add({ id: 'wude-pointer', label: '拖动转盘指针', shape: pointerShape(), key: 'Enter',
            represents: act.elements.find(e => e.id === 'wude-pointer')?.represents,
            onActivate: () => choose(pointer),
            onDrag(e) {
              if (locked) return;
              const { cx, cy } = geometry();
              if (Math.hypot(e.dx, e.dy) < 9 && e.phase !== 'move') return;
              pointer = elementAt(e.x, e.y, cx, cy); handle?.setShape(pointerShape()); draw();
              if (e.phase === 'end') choose(pointer);
            } });
        });
        cards.forEach(a => a.remove()); cards = []; (handle as Affordance | null)?.remove(); handle = null;
      }
      finished = true;
      const perfect = score.mistakes === 0;
      const line = perfect ? '我把天命之说写上简。' : '天命之说，被驳了一句。';
      say(ctx, line); draw();
      const facts = [{ id: `wude-wheel-${perfect ? 'inscribed' : 'challenged'}`, text: perfect ? '季以相胜推齐水德，写下天命之说' : '季推齐水德受驳，重辨天命之说', kind: 'decision' as const, by: '季' }];
      const metrics = { correct: score.correct, rounds: score.round, attempts: score.attempts, mistakes: score.mistakes, firstTry: score.firstTry, perfect: Number(perfect) };
      facts.forEach(fact => ctx.bus.log('world.fact', { fact }));
      ctx.handoff.wude = { proposed: '水', hypothetical: true, challenged: !perfect };
      trace(ctx, 'wude-wheel.end', { metrics });
      await pause(600);
      return { act: act.id, data: { facts, metrics, line } };
    } finally {
      cards.forEach(a => a.remove()); (handle as Affordance | null)?.remove(); offFrame(); offResize(); bg.off();
      if (!finished) { bg.remove(); ctx.stage.removeLayer('wude-wheel'); }
      ctx.lines.clear(); ctx.audio.ambience('silence', 0, 300);
    }
  },
};
