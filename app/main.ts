// 一台只为一个人存在的机器：启动它的器官，然后按导演的呈现方案一幕一幕演。

import plan from 'virtual:plan';
import { createAffordances } from '../engine/affordance';
import { Bus } from '../engine/bus';
import { createRng } from '../engine/rng';
import { createSenses } from '../engine/senses';
import { createStage } from '../engine/stage';
import { createStore } from '../engine/store';
import { createThink } from '../engine/think';
import { createAudio } from '../engine/audio';
import { createLines } from '../components/line';
import { createLayerBus } from '../engine/layers/bus';
import { createMentor } from '../engine/layers/mentor';
import { actorReport, factsIn } from '../engine/layers/report';
import type { ActorReport } from '../engine/layers/types';
import { acceptCommission } from '../director/pipeline/mentor';
import type { Plan } from '../engine/types';
import type { Ctx, Framework, VisitInfo, VisitRecord } from './context';
import { vignette } from '../frameworks/vignette';
import { reveal } from '../frameworks/reveal';
import { walk2d } from '../frameworks/walk2d';
import { studio } from '../frameworks/studio';
import { east3d } from '../frameworks/east3d';
import { film } from '../frameworks/film';
import { gallery } from '../frameworks/gallery';
import { desk } from '../frameworks/desk';
import { deskMentorStore } from '../frameworks/desk';
import { deskExperience } from '../frameworks/desk/evidence';
import { console as consoleFramework } from '../frameworks/console';
import { fiftyYearsFrameworks } from '../director/pipeline/fifty-years-runtime';
import { mountPresenter } from '../components/presenter';

const FRAMEWORKS: Record<string, Framework> = { vignette, reveal, walk2d, studio, east3d };
Object.assign(FRAMEWORKS, fiftyYearsFrameworks, { film, gallery, desk, console: consoleFramework });

async function boot() {
  document.documentElement.lang = 'zh-CN';
  const root = document.getElementById('stage')!;
  const p = plan as Plan;
  const stage = createStage(root);
  const bus = new Bus();
  const store = createStore();
  const senses = createSenses(bus, store);
  const think = createThink(bus);
  const aff = createAffordances(stage, bus);
  const lines = createLines(stage, bus);
  const audio = createAudio(bus);

  // 记得你：来过几次、上次停在哪
  const previousStored = store.get<VisitRecord | null>('visit.last', null);
  const previous = previousStored ?? ((p.intent.id === 'cafe-map' || (p.intent.visit?.n ?? 0) >= 2) ? {
    n: ((p.intent.visit?.n ?? 2) - 1),
    at: senses.now() - 86400000,
    seed: p.seed,
    dwell: { mentor: 5000, door: 1200, ticket: 3500 },
    longestPlace: 'mentor',
    longestPlaceMs: 5000,
    ending: 'lend',
    endingFact: '田伯借出半瓮粟',
  } : null);
  const visit: VisitInfo = {
    n: (previous?.n ?? 0) + 1,
    previous,
    sinceMs: previous ? Math.max(0, senses.now() - previous.at) : 0,
  };
  const record: VisitRecord = { n: visit.n, at: senses.now(), dwell: {}, seed: p.seed, name: previous?.name };

  const layers = createLayerBus(bus, () => ({ t: performance.now(), day: (ctx.handoff.world as { state?: () => { day: number } } | undefined)?.state?.().day }));
  const ctx: Ctx = {
    stage, bus, layers, store, senses, think, aff, lines, audio,
    plan: p,
    rng: createRng(p.seed),
    visit,
    handoff: {},
    record,
  };

  // 给 bench、模拟玩家与演示面板看的窗口
  (window as any).__zhuzi = { ctx, plan: p, bus, stage, version: p.version, layers: { letters: layers.letters, check: layers.check } };
  (window as any).__trace = bus.trace;
  bus.log('sense', { name: 'boot', visit: visit.n, seed: p.seed, tier: p.tier, dayPart: senses.dayPart() });

  mountPresenter(ctx);

  layers.usePlan(p);
  const mentor = createMentor({
    seed: p.seed, tier: p.tier, visits: visit.n, previous, sinceLastMs: visit.sinceMs,
    dayPart: senses.dayPart(), device: senses.coarsePointer() || stage.width < 700 ? '手机' : '宽屏',
    strength: senses.strength(), store,
  });
  // Desk reasons follow explicit user corrections rather than historical entry settings.
  if (p.intent.id === 'desk') store.set('desk.experience', deskExperience());
  if (p.intent.id === 'desk') {
    mentor.commission = createMentor({
      seed: p.seed, tier: p.tier, visits: visit.n, previous, sinceLastMs: visit.sinceMs,
      dayPart: senses.dayPart(), device: senses.coarsePointer() || stage.width < 700 ? '手机' : '宽屏',
      strength: senses.strength(), store: deskMentorStore(store),
    }).commission;
  }
  (window as any).__zhuzi.mentor = mentor;
  const commission = mentor.commission(p.intent, p);
  const commissionLetter = layers.send({ kind: 'commission', from: 'mentor', to: 'director', payload: commission });
  Object.assign(p, acceptCommission(p, commission));
  layers.receive(commissionLetter.id, 'director');
  const planLetter = layers.send({ kind: 'plan', from: 'director', to: 'mentor', payload: p.ack! });
  ctx.handoff.mentorPlan = p.ack;
  layers.receive(planLetter.id, 'mentor');
  const reports: ActorReport[] = [];
  const touched: string[] = [];

  const savedDwell: Record<string, number> = {};
  const saveRecord = () => {
    if (ctx.handoff.forgetVisit) return;
    record.at = senses.now();
    const dwell = aff.dwell();
    for (const [k, v] of Object.entries(dwell)) {
      const delta = Math.max(0, v - (savedDwell[k] ?? 0));
      record.dwell[k] = Math.round((record.dwell[k] ?? 0) + delta);
      savedDwell[k] = v;
    }
    store.set('visit.last', record);
  };
  window.addEventListener('pagehide', saveRecord);

  for (const act of p.acts) {
    const fw = FRAMEWORKS[act.framework];
    if (!fw) {
      bus.log('error', { message: `no framework ${act.framework}` });
      continue;
    }
    const cues = Object.values(p.cues ?? {}).filter(c => c.act === act.id);
    ctx.handoff.actorCues = cues;
    const cueLetters = cues.map(cue => layers.send({ kind: 'cue', from: 'director', to: cue.who, act: act.id, payload: cue }));
    const traceStart = bus.trace.length;
    bus.log('act.enter', { act: act.id, framework: act.framework, author: act.author, focus: act.focus, predict: act.predict });
    const t0 = performance.now();
    const res = await fw.run(act, ctx);
    const ms = performance.now() - t0;
    bus.log('act.exit', { act: act.id, ms: Math.round(ms), data: res.data });
    const span = bus.trace.slice(traceStart);
    for (const e of span) if (e.kind === 'aff.click') {
      const id = String(e.id);
      const local = id.replace(`${act.framework}-`, '').replace(/^place-/, '');
      touched.push(`${act.id}:${id}`, `${act.id}:${local}`);
      if (local === 'he') touched.push(`${act.id}:heart`);
      if (local === 'gate-ring') touched.push(`${act.id}:gate`);
      if (act.id === 'return' && ['name', 'pen'].includes(local)) touched.push(`${act.id}:mentor`);
    }
    for (const [i, cue] of cues.entries()) {
      const report = actorReport(p, act, cue, res, span, ms);
      const world = ctx.handoff.world as { state?: () => { mind?: { seeds?: ActorReport['seeds'] } } } | undefined;
      if (cue.who === '禾' && act.framework === 'walk2d') report.seeds = structuredClone(world?.state?.().mind?.seeds ?? []);
      layers.receive(cueLetters[i]!.id, cue.who);
      const letter = layers.send({ kind: 'report', from: cue.who, to: 'director', act: act.id, payload: report });
      reports.push(report);
      layers.receive(letter.id, 'director');
    }
    aff.clear();
    saveRecord();
  }
  saveRecord();
  const world = ctx.handoff.world as { ledger?: () => unknown[] } | undefined;
  const facts = factsIn([...(world?.ledger?.() ?? []), ...reports.flatMap(r => r.facts)]);
  const retro = mentor.retro(p, reports, { record, facts, touched });
  if (ctx.handoff.forgetVisit) retro.userModelDelta = {};
  const retroLetter = layers.send({ kind: 'retro', from: 'director', to: 'mentor', payload: retro });
  if (!ctx.handoff.forgetVisit) {
    for (const [key, value] of Object.entries(retro.userModelDelta)) store.set(key, value);
  }
  layers.receive(retroLetter.id, 'mentor');
  bus.log('act.exit', { act: 'visit', done: true });
  (window as any).__zhuzi.done = true;
}

boot().catch((err) => {
  console.error(err);
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;inset:auto 0 0 0;color:#e8c9a0;background:#1a120e;padding:12px;font:12px monospace;z-index:999;white-space:pre-wrap';
  pre.textContent = `机器没能醒来：${err?.stack ?? err}`;
  document.body.appendChild(pre);
});
