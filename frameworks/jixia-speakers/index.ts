// 稷下谁在说话：季在堂上辨学派；学士反应与错题种子随选择留下。
import type { Framework } from '../../app/context';
import type { Affordance } from '../../engine/affordance';
import { PAL } from '../../components/paint/palette';
import { makeFigure } from '../../components/paint/figure';
import { QUOTES, SCHOOLS, answer, initialScore, makeDeck, standing } from './logic';
import { background, enter, flash, label, pause, pulse, requireElements, say, scroll, trace } from './surface';

export const jixiaSpeakers: Framework = {
  async run(act, ctx) {
    requireElements(act, { 'ji-scroll': 'open', ...Object.fromEntries(SCHOOLS.map((_, i) => [`school-${i}`, 'choose'])) });
    const rng = ctx.rng.fork('jixia-speakers');
    const deck = makeDeck(rng.shuffle(QUOTES));
    const bg = background(ctx, 'jixia-speakers', rng.int(1, 10000));
    const layer = ctx.stage.layer('jixia-speakers', 21);
    const ji = makeFigure('ji', { pose: 'carry', onDark: true });
    const scholars = SCHOOLS.map((_, i) => makeFigure(i % 2 ? 'mentor' : 'tianbo', {
      pose: 'sit', onDark: true, facing: -1, seed: i, robe: [PAL.ochre, PAL.lacquer2, PAL.cinnabar, PAL.bronze, PAL.umber, PAL.night][i],
    }));
    let score = initialScore();
    let round = -1;
    let selected = -1;
    let wasRight = false;
    let opened = false;
    let finished = false;
    let cards: Affordance[] = [];
    const shapes = () => SCHOOLS.map((_, i) => {
      const w = ctx.stage.width, h = ctx.stage.height;
      const cols = ctx.stage.narrow ? 3 : 6;
      const gap = Math.min(88, (w - 60) / cols);
      return { kind: 'rect' as const, x: w / 2 + (i % cols - (cols - 1) / 2) * gap - gap * 0.38,
        y: h * 0.73 + Math.floor(i / cols) * 65, w: gap * 0.76, h: 56 };
    });
    const draw = (open = opened) => {
      opened = open;
      const c = layer.ctx, w = ctx.stage.width, h = ctx.stage.height;
      layer.clear();
      c.strokeStyle = PAL.gold + '55'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(w * 0.1, h * 0.6); c.lineTo(w * 0.91, h * 0.6); c.stroke();
      scholars.forEach((s, i) => {
        c.globalAlpha = round >= 0 && deck[round]?.school === SCHOOLS[i] ? 1 : 0.42;
        const x = w * (0.35 + i * 0.095);
        const shift = selected === i && wasRight ? -w * 0.015 : 0;
        s.draw(c, x + shift, h * 0.57, Math.min(h * 0.23, w * 0.19), ctx.stage.time);
      });
      c.globalAlpha = 1;
      ji.draw(c, w * (0.19 + score.correct * 0.018), h * 0.64, Math.min(h * 0.31, w * 0.2), ctx.stage.time);
      scroll(c, w / 2, h * 0.72, 90, opened, finished && standing(score) ? 5 : 0);
      if (round >= 0 && !finished) shapes().forEach((s, i) => {
        c.fillStyle = selected === i ? wasRight ? PAL.gold : PAL.cinnabar : PAL.lacquer2;
        c.fillRect(s.x, s.y, s.w, s.h);
        c.strokeStyle = PAL.gold + (selected === i ? 'ff' : '77'); c.strokeRect(s.x, s.y, s.w, s.h);
      });
      score.seeds.forEach((_, i) => {
        c.fillStyle = PAL.ochre; c.beginPath(); c.ellipse(w * 0.18 + i * 15, h * 0.68, 4, 7, 0.5, 0, Math.PI * 2); c.fill();
      });
      for (let i = 0; i < score.correct; i++) {
        c.fillStyle = PAL.gold; c.beginPath(); c.arc(w * 0.36 + i * 15, h * 0.64, 3, 0, Math.PI * 2); c.fill();
      }
    };
    const offFrame = ctx.stage.onFrame(() => draw());
    const offResize = ctx.stage.onResize(() => cards.forEach((a, i) => a.setShape(shapes()[i]!)));
    trace(ctx, 'jixia-speakers.start', { act: act.id, quotes: deck.map(q => q.id), focus: act.focus });
    try {
      await enter(ctx, act, 'jixia-speakers', draw);
      for (round = 0; round < deck.length; round++) {
        selected = -1;
        const quote = deck[round]!;
        scholars.forEach(s => s.setPose('sit', 0));
        say(ctx, quote.text, '堂上学士');
        trace(ctx, 'jixia-speakers.step', { round, quote: quote.id, source: quote.source });
        await new Promise<void>(resolve => {
          let locked = false;
          cards = SCHOOLS.map((school, i) => {
            const a = ctx.aff.add({ id: `school-${i}`, label: `判为${school}家`, shape: shapes()[i]!, key: String(i + 1),
              represents: act.elements.find(e => e.id === `school-${i}`)?.represents,
              onActivate() {
                if (locked) return;
                locked = true; selected = i; wasRight = school === quote.school;
                flash(a, wasRight); cards.forEach(card => card.setEnabled(false));
                score = answer(score, quote, school);
                scholars[SCHOOLS.indexOf(quote.school)]!.setPose(wasRight ? 'nod' : 'shake-head', 80);
                ji.setPose(wasRight ? 'reach' : 'slump', 80);
                ctx.audio.sfx(wasRight ? 'insight' : 'seed', { gain: 0.4 });
                trace(ctx, 'jixia-speakers.choice', { round, quote: quote.id, school, correct: wasRight });
                say(ctx, wasRight ? '堂上有人点头。' : '这句话，先留下。');
                draw(); setTimeout(resolve, 850);
              } });
            label(a, school);
            if (i === 0) pulse(a);
            return a;
          });
        });
        cards.forEach(a => a.remove()); cards = [];
      }
      finished = true;
      const won = standing(score);
      ji.setPose(won ? 'stand' : 'slump', 80);
      const line = won ? '我在稷下站住了。' : '我被问得答不上来。';
      say(ctx, line); draw();
      const facts = [{ id: `jixia-speakers-${won ? 'standing' : 'questioned'}`, text: won ? '季辨诸家之言，在稷下站住了' : '季辨言受挫，错题留作心中种子', kind: 'event' as const, by: '季' },
        ...score.seeds.map(id => ({ id: `jixia-seed-${id}`, text: `季重掂${QUOTES.find(q => q.id === id)!.text}`, kind: 'decision' as const, by: '季' }))];
      const metrics = { correct: score.correct, answered: score.answered, accuracy: score.correct / score.answered, maxStreak: score.maxStreak, seeds: score.seeds.length };
      for (const fact of facts) ctx.bus.log('world.fact', { fact });
      ctx.handoff.jixia = { seeds: score.seeds, standing: won };
      trace(ctx, 'jixia-speakers.end', { metrics });
      await pause(600);
      return { act: act.id, data: { facts, metrics, line } };
    } finally {
      cards.forEach(a => a.remove()); offFrame(); offResize(); bg.off();
      if (!finished) { bg.remove(); ctx.stage.removeLayer('jixia-speakers'); }
      ctx.lines.clear(); ctx.audio.ambience('silence', 0, 300);
    }
  },
};
