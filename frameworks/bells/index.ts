// 编钟：咖啡厅里，机器记得你敲回来的声音。
import type { Framework } from '../../app/context';
import type { Affordance, AffShape } from '../../engine/affordance';
import type { TraceKind } from '../../engine/bus';
import { PAL } from '../../components/paint/palette';
import { finish, glow, lacquerGround } from '../../components/paint/texture';
import { createBells, makeSequence, NOTES, roundLength, strike } from './logic';

export const bells: Framework = {
  async run(act, ctx) {
    const { stage, audio, aff, bus, lines } = ctx;
    const rng = ctx.rng.fork('bells');
    let state = createBells(makeSequence(rng));
    const layer = stage.layer('bells', 20);
    const started = performance.now();
    let phase: 'rest' | 'listen' | 'answer' | 'end' = 'rest';
    let pending = false, playbackAt = 0, playbackIndex = -1, answerAt = 0;
    let flashNote = -1, flashAt = -2000, wrongAt = -2000, endAt = 0;
    let buttons: Affordance[] = [];
    let resolve!: () => void;
    const done = new Promise<void>(r => { resolve = r; });
    const log = (kind: string, data: Record<string, unknown> = {}) => bus.log(kind as TraceKind, { act: act.id, ...data });
    const k = () => Math.min(stage.width / 1000, stage.height / 700);
    const origin = () => ({ x: (stage.width - k() * 1000) / 2, y: (stage.height - k() * 700) / 2 });
    const shape = (x: number, y: number, w: number, h: number): AffShape => { const o = origin(), s = k(); return { kind: 'rect', x: o.x + x * s, y: o.y + y * s, w: w * s, h: h * s }; };
    const clear = () => { buttons.forEach(a => a.remove()); buttons = []; };
    const say = () => {
      const text = act.lines.find(l => l.id === 'remember')?.text ?? '这个，我记着。';
      const line = [...text].slice(0, Math.min(18, act.budget.maxChars)).join('');
      void lines.say({ who: '导师', text: line, tone: 'mentor', sticky: true, charMs: 0, anchor: () => ({ x: stage.width / 2, y: origin().y + 575 * k() }) });
      return line;
    };
    let finalLine = '';
    const play = () => {
      clear(); phase = 'listen'; playbackAt = performance.now() + 180; playbackIndex = -1;
      log('bells.step', { phase: 'listen', round: state.round, sequence: state.sequence.slice(0, roundLength(state)) });
    };
    const showAnswer = () => {
      clear(); phase = 'answer'; answerAt = performance.now();
      NOTES.forEach((name, note) => {
        const e = act.elements.find(x => x.id === `bell-${note}`);
        if (e && !e.actions.includes('strike')) return;
        const a = aff.add({ id: `bell-${note}-r${state.round}-p${state.cursor}-a${state.attempts}`, label: `敲${name}`, represents: e?.represents ?? `${name}钟`, key: String(note + 1), shape: shape(113 + note * 166, 224 + note * 13, 110, 216 - note * 14), onActivate() {
          if (phase !== 'answer') return;
          const before = state;
          state = strike(state, note); flashNote = note; flashAt = performance.now();
          audio.bell(note, { gain: 0.66 });
          const wrong = state.mistakes !== before.mistakes;
          log('bells.step', { phase: 'answer', note, correct: !wrong, round: before.round, cursor: before.cursor });
          if (wrong) {
            wrongAt = performance.now(); audio.bell(note - 5, { gain: 0.12 }); play();
          } else if (state.done) {
            clear(); phase = 'end'; endAt = performance.now(); finalLine = say();
            log('bells.choice', { choice: 'remembered', longest: state.longest });
          } else if (state.round !== before.round) {
            log('bells.choice', { choice: 'round-complete', round: state.round, longest: state.longest }); play();
          } else showAnswer();
          draw();
        } });
        if (note === state.sequence[state.cursor]) { a.el.dataset.pulse = 'memory'; a.el.setAttribute('aria-current', 'true'); }
        buttons.push(a);
      });
    };
    function draw() {
      const c = layer.ctx, w = stage.width, h = stage.height, o = origin(), s = k(), now = performance.now();
      layer.clear(); lacquerGround(c, 0, 0, w, h, { tone: 'brown', sheen: 0.7, seed: rng.seed });
      c.save(); c.translate(o.x, o.y); c.scale(s, s);
      c.strokeStyle = PAL.gold; c.lineWidth = 1; c.globalAlpha = 0.25; c.strokeRect(60, 100, 880, 520); c.globalAlpha = 1;
      c.strokeStyle = PAL.cinnabar; c.lineWidth = 18; c.beginPath(); c.moveTo(85, 520); c.lineTo(85, 191); c.quadraticCurveTo(480, 155, 915, 191); c.lineTo(915, 520); c.stroke();
      c.strokeStyle = PAL.gold; c.lineWidth = 1; c.beginPath(); c.moveTo(85, 185); c.quadraticCurveTo(480, 149, 915, 185); c.stroke();
      for (let note = 0; note < 5; note++) {
        const baseX = 168 + note * 166, baseY = 254 + note * 13, height = 180 - note * 14;
        const flash = note === flashNote ? Math.max(0, 1 - (now - flashAt) / 620) : 0;
        const hint = phase === 'answer' && note === state.sequence[state.cursor] && now - answerAt > 1800;
        const active = phase === 'rest' && note === 0;
        if (flash > 0 || hint || active) glow(c, baseX, baseY + height * 0.5, 130, PAL.gold, flash * 0.7 + (hint || active ? 0.28 : 0));
        c.strokeStyle = PAL.gold; c.lineWidth = 2; c.beginPath(); c.moveTo(baseX, 182); c.lineTo(baseX, baseY - 10); c.stroke();
        c.save(); c.translate(baseX, baseY);
        if (!stage.reducedMotion) c.rotate(flash * Math.sin((now - flashAt) / 52) * 0.035);
        c.fillStyle = PAL.bronze; c.strokeStyle = PAL.gold; c.lineWidth = 2;
        c.beginPath(); c.moveTo(-32, 0); c.bezierCurveTo(-39, height * 0.5, -37, height * 0.7, -50, height); c.quadraticCurveTo(0, height + 23, 50, height); c.bezierCurveTo(37, height * 0.7, 39, height * 0.5, 32, 0); c.quadraticCurveTo(0, -13, -32, 0); c.fill(); c.stroke();
        c.strokeStyle = PAL.lacquer2; c.lineWidth = 5; c.beginPath(); c.moveTo(-23, 17); c.lineTo(-28, height - 12); c.moveTo(23, 17); c.lineTo(28, height - 12); c.stroke();
        for (let row = 0; row < 4; row++) for (const side of [-1, 1]) { c.fillStyle = PAL.gold; c.beginPath(); c.arc(side * 20, 29 + row * (height - 45) / 4, 2.3, 0, Math.PI * 2); c.fill(); }
        c.strokeStyle = flash > 0 ? PAL.millet : PAL.ochre; c.lineWidth = flash > 0 ? 5 : 1; c.beginPath(); c.ellipse(0, height - 6, 46, 10, 0, 0, Math.PI); c.stroke();
        // 三道金线留在钟腹上，记住已回成的轮次。
        for (let r = 0; r < state.round; r++) { c.strokeStyle = PAL.gold; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-26, height - 24 - r * 9); c.lineTo(26, height - 24 - r * 9); c.stroke(); }
        c.restore();
      }
      c.fillStyle = PAL.lacquer; c.beginPath(); c.ellipse(500, 545, 370, 21, 0, 0, Math.PI * 2); c.fill();
      if (phase === 'answer') {
        for (let i = 0; i < roundLength(state); i++) {
          const x = 500 + (i - (roundLength(state) - 1) / 2) * 29;
          c.strokeStyle = PAL.gold; c.lineWidth = 1; c.beginPath(); c.arc(x, 542, 5, 0, Math.PI * 2); c.stroke();
          if (i < state.cursor) { c.fillStyle = PAL.gold; c.fill(); }
        }
      }
      if (phase === 'end') glow(c, 500, 400, 350, PAL.gold, 0.38);
      const dim = Math.max(0, 1 - (now - wrongAt) / 650);
      if (dim > 0) { c.fillStyle = PAL.lacquer; c.globalAlpha = dim * 0.42; c.fillRect(80, 210, 840, 290); c.globalAlpha = 1; }
      c.restore(); finish(c, w, h, { grain: 0.5, vignette: 0.38 });
    }
    log('bells.start', { focus: act.focus });
    const startElement = act.elements.find(e => e.id === 'bells-start');
    if (!startElement || startElement.actions.includes('begin')) {
      const start = aff.add({ id: 'bells-start', label: '轻敲宫钟，听机器记一段', represents: startElement?.represents ?? '机器的第一盏记忆灯', key: 'Enter', shape: shape(113, 224, 110, 216), onActivate() {
        if (phase !== 'rest') return;
        flashNote = 0; flashAt = performance.now(); pending = true; clear(); log('bells.step', { phase: 'begin' }); draw();
        // 声音首次初始化较重，先呈现钟体的反馈。
        requestAnimationFrame(() => setTimeout(() => { audio.unlock(); audio.bell(0, { gain: 0.5 }); }, 0));
      } });
      start.el.dataset.pulse = 'memory'; start.el.setAttribute('aria-current', 'true'); buttons.push(start);
    }
    const offResize = stage.onResize(() => {
      if (phase === 'rest') buttons[0]?.setShape(shape(113, 224, 110, 216));
      else if (phase === 'answer') showAnswer();
      draw();
    });
    const offFrame = stage.onFrame(() => {
      const now = performance.now();
      if (pending && now - started >= 3100) { pending = false; play(); }
      if (phase === 'listen' && now >= playbackAt) {
        const index = Math.floor((now - playbackAt) / 440);
        if (index >= roundLength(state)) showAnswer();
        else if (index !== playbackIndex) {
          playbackIndex = index; flashNote = state.sequence[index]!; flashAt = now; audio.bell(flashNote, { gain: 0.65 });
          log('bells.step', { phase: 'sound', round: state.round, index, note: flashNote });
        }
      }
      draw();
      if (phase === 'end' && now - endAt >= 1450) resolve();
    });
    draw();
    try { await done; } finally { offFrame(); offResize(); clear(); lines.clear(); }
    const fact = { id: 'bells-remembered', text: '机器与来客回成三轮五声，最长记住四声。', kind: 'event' as const, by: '导师' };
    const metrics = { longest: state.longest, rounds: state.round, mistakes: state.mistakes, accuracy: state.correct / Math.max(1, state.attempts), durationMs: Math.round(performance.now() - started) };
    log('world.fact', { fact }); log('bells.end', { metrics });
    ctx.handoff.bells = { longest: state.longest, rounds: state.round, fact };
    return { act: act.id, data: { facts: [fact], metrics, line: finalLine } };
  },
};
