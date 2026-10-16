// 齐法化：田伯亲手掂量仓里的粟。
import type { Framework } from '../../app/context';
import type { Affordance, AffShape } from '../../engine/affordance';
import type { TraceKind } from '../../engine/bus';
import { PAL } from '../../components/paint/palette';
import { finish, glow, lacquerGround } from '../../components/paint/texture';
import { CONCERNS, DECISIONS, consequence, createQi, decide, recommend, thought, weigh, type Concern, type Decision } from './logic';
import { gate, grain, knife, person, sack } from './paint';

export const qiKnife: Framework = {
  async run(act, ctx) {
    const { stage, aff, audio, lines, bus } = ctx;
    const rng = ctx.rng.fork('qi-knife');
    let state = createQi(rng);
    const layer = stage.layer('qi-knife', 20);
    const started = performance.now();
    let opened = false, released = false, finished = false;
    let lastConcern: Concern | null = null, flashAt = -1000, angle = 0, exitAt = 0;
    let buttons: Affordance[] = [];
    let resolve!: () => void;
    const done = new Promise<void>(r => { resolve = r; });
    const log = (kind: string, data: Record<string, unknown> = {}) => bus.log(kind as TraceKind, { act: act.id, ...data });
    const element = (id: string) => act.elements.find(e => e.id === id);
    const s = () => Math.min(stage.width / 1000, stage.height / 700);
    const origin = () => ({ x: (stage.width - 1000 * s()) / 2, y: (stage.height - 700 * s()) / 2 });
    const shape = (x: number, y: number, w: number, h: number): AffShape => {
      const o = origin(), k = s(); return { kind: 'rect', x: o.x + x * k, y: o.y + y * k, w: w * k, h: h * k };
    };
    const clear = () => { buttons.forEach(a => a.remove()); buttons = []; };
    const say = (id: string, fallback: string) => {
      const text = act.lines.find(l => l.id === id)?.text ?? fallback;
      void lines.say({ who: '田伯', text: [...text].slice(0, Math.min(30, act.budget.maxChars)).join(''), anchor: () => ({ x: stage.width / 2, y: origin().y + 150 * s() }), charMs: 0, sticky: true, tone: 'thought' });
    };
    const add = (id: string, label: string, action: string, rect: number[], fn: () => void, pulse = false, key?: string) => {
      const e = element(id);
      if (e && !e.actions.includes(action)) return;
      const a = aff.add({ id, label, key, shape: shape(rect[0]!, rect[1]!, rect[2]!, rect[3]!), represents: e?.represents ?? label, onActivate: fn });
      if (pulse) { a.el.dataset.pulse = 'breath'; a.el.setAttribute('aria-current', 'true'); }
      buttons.push(a);
    };
    const showChoices = () => {
      clear();
      DECISIONS.forEach((choice, i) => add(`qi-${choice}`, ['开仓施粥', '借粟立券，明年还两倍', '合上仓门'][i]!, 'choose', [165 + i * 245, 467, 180, 159], () => {
        if (state.choice) return;
        state = decide(state, choice); flashAt = performance.now(); exitAt = flashAt; clear();
        audio.sfx(choice === 'close' ? 'gate-shut' : choice === 'give' ? 'jar' : 'tally-snap');
        say(`after-${choice}`, choice === 'give' ? '粟出了仓，王的车还会来。' : choice === 'lend' ? '三袋出去，来年六袋回来。' : '门合上，脚步渐渐远了。');
        log('qi-knife.choice', { choice, stock: state.stock, levy: state.levy });
        draw();
      }, recommend(state) === choice, String(i + 1)));
    };
    const showConcerns = () => {
      clear();
      CONCERNS.forEach((concern, i) => add(`qi-${concern}`, ['掂量门外乡邻', '掂量王的征粮令', '掂量自家仓廪', '掂量门外名声'][i]!, 'weigh', [110 + i * 220, 466, 120, 160], () => {
        if (state.weighed.length >= 3) return;
        state = weigh(state, concern); lastConcern = concern; flashAt = performance.now();
        audio.sfx(concern === 'king' ? 'weight' : 'soil', { gain: 0.55 });
        say(`weigh-${concern}`, thought(state));
        log('qi-knife.step', { concern, count: state.weighed.length, tilt: state.tilt });
        if (state.weighed.length === 3) showChoices();
        else showConcerns();
        draw();
      }, (act.focus === `qi-${concern}` || i === state.weighed.length % 4), String(i + 1)));
    };
    const drawConcern = (c: CanvasRenderingContext2D, concern: Concern, x: number, y: number, scale = 1) => {
      c.save(); c.translate(x, y); c.scale(scale, scale);
      if (concern === 'people') { person(c, -22, 12, 0.85); person(c, 18, 12, 0.7); }
      if (concern === 'king') {
        c.fillStyle = PAL.ochre; c.strokeStyle = PAL.gold; c.lineWidth = 2; c.fillRect(-26, -74, 52, 87); c.strokeRect(-26, -74, 52, 87);
        c.fillStyle = PAL.cinnabar; c.fillRect(-16, -60, 32, 30); c.strokeStyle = PAL.lacquer2;
        for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-15, -17 + i * 7); c.lineTo(15, -17 + i * 7); c.stroke(); }
      }
      if (concern === 'home') { sack(c, -16, 12); sack(c, 22, 9, 0.85); }
      if (concern === 'name') {
        person(c, -25, 12, 0.7, PAL.bronze); person(c, 22, 12, 0.7, PAL.bronze);
        c.strokeStyle = PAL.gold; c.lineWidth = 2; c.beginPath(); c.ellipse(0, -75, 33, 12, 0, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(0, -75, 6, 0, Math.PI * 2); c.stroke();
      }
      c.restore();
    };
    function draw() {
      const w = stage.width, h = stage.height, c = layer.ctx, k = s(), o = origin();
      layer.clear(); lacquerGround(c, 0, 0, w, h, { seed: rng.seed, sheen: 0.5 });
      c.save(); c.translate(o.x, o.y); c.scale(k, k);
      c.strokeStyle = PAL.gold; c.lineWidth = 1; c.globalAlpha = 0.3; c.strokeRect(56, 70, 888, 560); c.globalAlpha = 1;
      gate(c, 110, 340, state.choice === 'close' ? 0 : state.choice ? 0.95 : 0.3);
      const crowd = state.choice === 'close' ? 0 : state.watchers;
      for (let i = 0; i < crowd; i++) person(c, 60 + i * 19, 415 + (i % 2) * 12, 0.45, i % 2 ? PAL.ochre : PAL.bronze);
      person(c, 880, 381, 1.7, PAL.cinnabar);
      for (let i = 0; i < Math.ceil(state.stock / 2); i++) sack(c, 795 + (i % 3) * 31, 425 - Math.floor(i / 3) * 38, 0.66);
      c.strokeStyle = PAL.bronze; c.lineWidth = 9; c.beginPath(); c.moveTo(500, 252); c.lineTo(500, 450); c.stroke();
      c.fillStyle = PAL.bronze; c.beginPath(); c.moveTo(449, 453); c.lineTo(500, 425); c.lineTo(551, 453); c.closePath(); c.fill();
      c.save(); c.translate(500, 277); c.rotate(angle); c.strokeStyle = PAL.gold; c.lineWidth = 4; c.beginPath(); c.moveTo(-151, 0); c.lineTo(151, 0); c.stroke();
      for (const x of [-135, 135]) {
        c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, 1); c.lineTo(x - 47, 90); c.lineTo(x + 47, 90); c.closePath(); c.stroke();
        c.fillStyle = PAL.bronze; c.beginPath(); c.ellipse(x, 90, 52, 10, 0, 0, Math.PI); c.fill();
      }
      grain(c, 135, 80, 28); knife(c, 144, 61, 0.3);
      if (lastConcern) drawConcern(c, lastConcern, -135, 80, 0.55);
      c.restore();
      if (!opened) { glow(c, 500, 330, 160, PAL.gold, 0.45); knife(c, 500, 350, 1.05); }
      else if (!state.choice && state.weighed.length < 3) {
        CONCERNS.forEach((concern, i) => {
          const x = 170 + i * 220;
          if (released && i === state.weighed.length % 4) glow(c, x, 554, 100, PAL.gold, 0.36);
          drawConcern(c, concern, x, 583);
          for (let j = 0; j < state.weighed.filter(a => a === concern).length; j++) { c.fillStyle = PAL.gold; c.fillRect(x - 18 + j * 14, 613, 7, 3); }
        });
      } else if (!state.choice) {
        for (let i = 0; i < 3; i++) {
          const x = 255 + i * 245;
          if (DECISIONS[i] === recommend(state)) glow(c, x, 550, 117, PAL.gold, 0.4);
          if (i === 0) { c.fillStyle = PAL.bronze; c.beginPath(); c.ellipse(x, 564, 60, 22, 0, 0, Math.PI); c.fill(); grain(c, x, 559, 34); }
          if (i === 1) { c.fillStyle = PAL.ochre; c.fillRect(x - 34, 505, 68, 99); c.strokeStyle = PAL.lacquer; c.lineWidth = 3; c.beginPath(); c.moveTo(x, 504); c.lineTo(x - 7, 536); c.lineTo(x + 4, 562); c.lineTo(x - 3, 604); c.stroke(); for (let j = 0; j < 6; j++) { c.strokeStyle = PAL.cinnabar; c.strokeRect(x - 23 + j % 3 * 18, 524 + Math.floor(j / 3) * 32, 6, 12); } }
          if (i === 2) gate(c, x, 604, 0);
        }
      } else {
        const x = 500;
        if (state.choice === 'give') { c.fillStyle = PAL.bronze; c.beginPath(); c.ellipse(x, 563, 88, 32, 0, 0, Math.PI); c.fill(); grain(c, x, 556, 60, 140); person(c, x - 112, 597, 1.15); person(c, x + 112, 597, 1.15); }
        else if (state.choice === 'lend') { for (const side of [-1, 1]) { c.fillStyle = PAL.ochre; c.fillRect(x + side * 36 - 20, 505, 36, 98); c.strokeStyle = PAL.cinnabar; c.strokeRect(x + side * 36 - 15, 530, 24, 32); } knife(c, x + 94, 552, 0.68); }
        else { gate(c, x, 599, 0); c.strokeStyle = PAL.gold; c.lineWidth = 5; c.beginPath(); c.moveTo(x - 55, 553); c.lineTo(x + 55, 553); c.stroke(); }
      }
      const flash = Math.max(0, 1 - (performance.now() - flashAt) / 450);
      if (flash > 0) glow(c, 500, state.choice ? 530 : 330, 220, PAL.millet, flash * 0.75);
      c.restore(); finish(c, w, h, { grain: 0.55, vignette: 0.38 });
    }
    log('qi-knife.start', { focus: act.focus, stock: state.stock, levy: state.levy, weights: state.weights });
    add('qi-scale', '拿起刀币，掂量仓门', 'begin', [385, 232, 230, 210], () => {
      if (opened) return; opened = true; flashAt = performance.now(); clear(); log('qi-knife.step', { phase: 'begin' }); draw();
      // 先把动手的亮光送上屏，再初始化声音缓冲。
      requestAnimationFrame(() => setTimeout(() => { audio.unlock(); audio.sfx('weight'); }, 0));
    }, true, 'Enter');
    const offResize = stage.onResize(() => { if (!opened) buttons[0]?.setShape(shape(385, 232, 230, 210)); else if (released && !state.choice) state.weighed.length < 3 ? showConcerns() : showChoices(); draw(); });
    const offFrame = stage.onFrame((_t, dt) => {
      angle += (state.tilt - angle) * (stage.reducedMotion ? 1 : 1 - Math.exp(-dt * 13));
      if (opened && !released && performance.now() - started >= 3100) { released = true; showConcerns(); }
      draw();
      if (state.choice && !finished && performance.now() - exitAt >= 1500) { finished = true; resolve(); }
    });
    draw();
    try { await done; } finally { offFrame(); offResize(); clear(); lines.clear(); }
    const fact = consequence(state);
    log('world.fact', { fact });
    const metrics = { weighings: state.weighed.length, choice: DECISIONS.indexOf(state.choice as Decision), stock: state.stock, levy: state.levy, durationMs: Math.round(performance.now() - started) };
    log('qi-knife.end', { metrics });
    ctx.handoff.qiKnife = { choice: state.choice, stock: state.stock, fact };
    return { act: act.id, data: { facts: [fact], metrics } };
  },
};
