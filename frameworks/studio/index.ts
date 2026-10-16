import type { ActResult, Framework } from '../../app/context';
import type { ActorCue, ActorReport, Commission, DirectorAck, Letter } from '../../engine/layers/types';
import { actorVoice } from '../../engine/layers/voice';
import type { Fact } from '../../engine/types';
import type { Affordance } from '../../engine/affordance';
import type { Longscroll } from '../../director/pipeline/fifty-years-state';
import { createMentor } from '../../engine/layers/mentor';
import { acceptCommission } from '../../director/pipeline/mentor';
import { makeFigure } from '../../components/paint/figure';
import { drawReturnScene, makeMentor } from '../vignette/scene';
import { paintStudio, studioLayout, type StudioState } from './paint';

const excerpt = (text: string, n = 18) => [...text].length <= n ? text : [...text].slice(0, n - 1).join('') + '…';

/** 工作室重新接本次委托、复核已经演出的原件；不重演或改写演员的决定。 */
export const studio: Framework = {
  async run(act, ctx) {
    const scroll = ctx.handoff.longscroll as Longscroll | undefined;
    const saved = scroll?.completed[act.id];
    if (saved) {
      ctx.bus.log('world.event', { kind: 'history.resume', act: act.id });
      return { act: act.id, data: { ...saved.data, resumed: true } };
    }
    const { stage, layers, bus } = ctx;
    ctx.lines.clear();
    // 启动器已经处理过最初的委托；另发一轮真实复核委托，不能重写旧回执时刻。
    let commission = layers.letters().find(l => l.kind === 'commission')?.payload as Commission | undefined;
    if (!commission) {
      layers.usePlan(ctx.plan);
      commission = createMentor({ seed: ctx.plan.seed, tier: ctx.plan.tier, visits: ctx.visit.n,
        previous: ctx.visit.previous, sinceLastMs: ctx.visit.sinceMs, dayPart: ctx.senses.dayPart(),
        device: stage.narrow ? '手机' : '宽屏', strength: ctx.senses.strength(), store: ctx.store }).commission(ctx.plan.intent, ctx.plan);
    }
    const commissionLetter = layers.send({ kind: 'commission', from: 'mentor', to: 'director', payload: commission });
    const ack = (ctx.plan.ack ?? acceptCommission(ctx.plan, commission).ack)!;
    const previousReports = layers.letters().filter(l => l.kind === 'report' && l.act !== act.id) as Letter<ActorReport>[];
    const source = previousReports.find(l => l.act === 'han' && l.payload.error)
      ?? previousReports.find(l => l.act === 'han' && l.from === '禾')
      ?? previousReports.find(l => ['禾', '季', '田伯'].includes(l.from));
    const current = layers.byAct(act.id).filter(l => l.kind === 'cue') as Letter<ActorCue>[];
    const who = source?.payload.who ?? current.find(l => ['禾', '季', '田伯'].includes(l.to))?.to ?? '禾';
    const originalCue = source ? layers.byAct(source.act!).find(l => l.kind === 'cue' && l.to === who) as Letter<ActorCue> | undefined : undefined;
    const expected = source?.payload.predicted ?? originalCue?.payload.expects ?? act.predict.surprise;
    const state: StudioState = { phase: 'commission', acts: ack.acts, who, lamp: commission.budget.lamp,
      seal: false, received: false, progress: 0, error: false, caught: false, receipts: 0, pinned: 0, archive: 0 };
    const canvas = stage.layer('studio', 40);
    const caption = stage.dom('studio-caption', 41);
    caption.style.cssText += ';display:flex;align-items:center;justify-content:center;font-family:"Kaiti SC","STKaiti",serif;color:#2d2319;font-size:clamp(17px,1.7vw,22px);text-align:center;line-height:1.6';
    const mentor = makeMentor();
    const director = makeFigure('ji', { pose: 'sit-look', facing: 1, onDark: true });
    const start = performance.now();
    let voiceAt = 0, voiceIndex = -1;
    let phaseAt = start, finishAt = 0, control: Affordance | undefined;
    let planLetter: Letter<DirectorAck> | undefined, cueLetter: Letter<ActorCue> | undefined, reportLetter: Letter<ActorReport> | undefined;
    const facts: Fact[] = [];
    const letterIds: string[] = [commissionLetter.id];
    let resolve!: () => void;
    const done = new Promise<void>(r => { resolve = r; });
    const tell = (text: string, letter: string, field: string) => {
      caption.textContent = excerpt(text);
      caption.dataset.letter = letter;
      caption.dataset.field = field;
      bus.log('line.say', { who: state.phase === 'commission' ? '导师' : state.phase === 'report' ? who : '叔衡', text: caption.textContent, fullText: text, letter, field, act: act.id });
    };
    const sayVoice = (index: number) => {
      const text = reportLetter?.payload.voice?.[index];
      if (!text) return;
      voiceIndex = index; voiceAt = performance.now();
      caption.textContent = [...text][0] ?? '';
      caption.dataset.letter = reportLetter!.id;
      caption.dataset.field = 'voice';
      caption.dataset.voiceIndex = String(index);
      bus.log('line.say', { who, text, chars: [...text].length, fullText: text,
        letter: reportLetter!.id, field: 'voice', actorVoice: true, act: act.id });
    };
    const draw = () => {
      const w = stage.width, h = stage.height, c = canvas.ctx;
      canvas.clear();
      drawReturnScene(c, w, h, mentor, { t: stage.time, revisiting: ctx.visit.n > 1, doorOpen: 0, ticketOpacity: 0, showSlips: false });
      // 原座位、导师、门均沿用归来场景坐标；案设在左侧空处。
      paintStudio(c, w, h, stage.time, state, director);
      const box = studioLayout(w, h).caption;
      Object.assign(caption.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px`, right: 'auto', bottom: 'auto' });
      control?.setShape({ kind: 'rect', ...studioLayout(w, h).action });
    };
    const action = (id: string, label: string, fn: () => void) => {
      control?.remove();
      control = ctx.aff.add({ id, label, key: 'Enter', shape: { kind: 'rect', ...studioLayout(stage.width, stage.height).action }, represents: label,
        onActivate: () => { control?.remove(); control = undefined; fn(); draw(); } });
      control.el.dataset.pulse = 'breath';
      control.el.setAttribute('aria-current', 'true');
    };
    const addFact = (id: string, text: string, by: string) => {
      const fact: Fact = { id: `studio.${ctx.plan.id}.${id}`, day: scroll ? scroll.history.state().year + 356 : 0, by, text, kind: 'delivery' };
      facts.push(fact); bus.log('world.fact', { fact });
      if (!scroll) {
        const prior = ctx.handoff.ledger as Fact[] | undefined;
        const world = ctx.handoff.world as { ledger?: () => Fact[] } | undefined;
        ctx.handoff.ledger = [...(prior ?? world?.ledger?.() ?? []), fact];
      }
    };
    const beginBoard = () => {
      // 回执与印同时发生，方案在读完委托后才真的发出。
      layers.receive(commissionLetter.id, 'director');
      state.seal = true; state.receipts++;
      planLetter = layers.send({ kind: 'plan', from: 'director', to: 'mentor', payload: ack });
      letterIds.push(planLetter.id);
      layers.receive(planLetter.id, 'mentor'); state.receipts++;
      director.setPose('stamp', 100);
      addFact('accepted', '叔衡读过本次委托，盖印接下方案。', '叔衡');
      state.phase = 'board'; phaseAt = performance.now();
      caption.textContent = '';
      const cue: ActorCue = {
        act: act.id, who, expects: expected, freedom: '复核原局报告；保留真实实际与误差，不改旧决定',
        initialState: { sourceAct: source?.act ?? act.id, sourceReport: source?.id ?? null, sourceCue: originalCue?.id ?? null,
          request: '交回本次已发生的报告', original: originalCue?.payload.initialState ?? ctx.plan.world },
        constraints: [...ctx.plan.constitution, '不能把预演当成事实'],
      };
      cueLetter = layers.send({ kind: 'cue', from: 'director', to: who, act: act.id, payload: cue });
      letterIds.push(cueLetter.id);
      draw();
    };
    const receiveReport = () => {
      // 演员回传的是本局已有证据；dev 空局只报告真实收件，不杜撰演出。
      const actual = source?.payload.actual ?? `${who}接过了提示信。`;
      const report: ActorReport = {
        ...(source ? structuredClone(source.payload) : { facts: [], predicted: expected, did: [`${who}已接收提示信`] }),
        act: act.id, who, actual, ms: Math.round(performance.now() - phaseAt),
      };
      report.voice ??= actorVoice(report);
      report.did = [...report.did, `复核原件：${source?.id ?? cueLetter!.id}`];
      reportLetter = layers.send({ kind: 'report', from: who, to: 'director', act: act.id, payload: report });
      letterIds.push(reportLetter.id);
      state.phase = 'report'; state.error = !!report.error; phaseAt = performance.now();
      director.setPose('reach', 220);
      tell(report.actual, reportLetter.id, 'actual');
      action('studio-report', '接住报告竹简', () => {
        layers.receive(reportLetter!.id, 'director');
        state.receipts++; state.caught = true;
        addFact('verified', `${who}的真实回报已收妥：${actual}`, '叔衡');
        // 预期的虚线仍留在案上；新钉的位置由真实结果是否偏离决定。
        bus.log('director.compare', { act: act.id, sourceReport: source?.id ?? null, predicted: expected, actual, error: report.error ?? null });
        const decisions = scroll?.decide(act.id, '叔衡', `收妥${who}的回报，保留${report.error ? '预演的误差' : '原局实际'}`, {}) ?? [];
        for (const fact of decisions) { facts.push(fact); bus.log('world.fact', { fact }); }
        sayVoice(0);
        finishAt = performance.now() + (report.voice?.length ?? 0) * 1600 + 650;
      });
    };
    tell(commission.why, commissionLetter.id, 'why');
    action('studio-commission', '拿起导师委托', () => {
      state.phase = 'plan'; phaseAt = performance.now();
      mentor.setPose('push', 180); director.setPose('sit-write', 220);
      const rehearsal = ack.rehearsal.find(r => r.act === source?.act) ?? ack.rehearsal[0];
      tell(rehearsal?.expect ?? ack.accept, layers.letters().find(l => l.kind === 'plan')?.id ?? commissionLetter.id, 'rehearsal');
    });
    draw();
    const offResize = stage.onResize(draw);
    const offFrame = stage.onFrame(() => {
      const now = performance.now();
      if (state.phase === 'plan') {
        state.pinned = Math.min(ack.acts.length, Math.floor((now - phaseAt) / 65) + 1);
        if (!control && now - start >= 3100) action('studio-seal', '叔衡读过，盖回执印', beginBoard);
      }
      if (state.phase === 'board') {
        state.progress = stage.reducedMotion ? 1 : Math.min(1, (now - phaseAt) / 750);
        if (!state.received && now - phaseAt >= 800) {
          layers.receive(cueLetter!.id, who); state.received = true; state.receipts++;
          for (const cue of current) layers.receive(cue.id, cue.to);
          bus.log('world.event', { kind: 'studio.cue-delivered', act: act.id, who, letter: cueLetter!.id });
        }
        if (now - phaseAt >= 2600) receiveReport();
      }
      if (voiceIndex >= 0) {
        const voice = reportLetter!.payload.voice!;
        if (now - voiceAt >= 1600 && voiceIndex + 1 < voice.length) sayVoice(voiceIndex + 1);
        caption.textContent = [...voice[voiceIndex]!].slice(0, 1 + Math.floor((now - voiceAt) / 55)).join('');
      }
      if (finishAt) {
        state.archive = Math.max(0, Math.min(1, (now - finishAt + 650) / 650));
        if (state.archive > .1) caption.textContent = '';
        if (now >= finishAt) resolve();
      }
      draw();
    });
    try { await done; } finally {
      offFrame(); offResize(); control?.remove(); caption.textContent = '';
      stage.removeLayer('studio'); stage.removeLayer('studio-caption'); ctx.lines.clear();
    }
    const result: ActResult = { act: act.id, data: { facts, letters: letterIds, sourceReport: source?.id ?? null,
      actual: reportLetter!.payload.actual, error: reportLetter!.payload.error ?? null, receipts: state.receipts,
      affordances: ['studio-commission', 'studio-seal', 'studio-report'] } };
    if (scroll && !ctx.handoff.forgetVisit) scroll.complete(result, scroll.ending);
    return result;
  },
};
