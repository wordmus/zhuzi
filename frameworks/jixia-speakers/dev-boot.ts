import type { Ctx, Framework } from '../../app/context';
import type { Plan, PlanAct, PlanElement } from '../../engine/types';
import { createAffordances } from '../../engine/affordance';
import { createAudio } from '../../engine/audio';
import { Bus } from '../../engine/bus';
import { createLayerBus } from '../../engine/layers/bus';
import { createMentor } from '../../engine/layers/mentor';
import { actorReport } from '../../engine/layers/report';
import type { ActorCue, DirectorAck } from '../../engine/layers/types';
import { createRng } from '../../engine/rng';
import { createSenses } from '../../engine/senses';
import { createStage } from '../../engine/stage';
import { createStore } from '../../engine/store';
import { createThink } from '../../engine/think';
import { generateWorld } from '../../engine/world/generate';
import { createLines } from '../../components/line';

export function element(id: string, action: string, represents: string): PlanElement {
  return { id, component: '漆画', represents, actions: [action], prominence: { x: 0.5, y: 0.5, scale: 1, brightness: 1, folded: false } };
}
export function devAct(framework: string, elements: PlanElement[]): PlanAct {
  return { id: `${framework}-dev`, framework, author: '基础导演', focus: 'ji-scroll',
    elements: [element('ji-scroll', 'open', '季想在稷下上书的竹简'), ...elements],
    lines: [{ id: 'enter', who: '季', text: '我想在这堂上站住。', when: 'enter' }],
    reveal: ['ji-scroll'], withhold: [], exit: '规则游戏结束并交回事实',
    predict: { firstLook: 'ji-scroll', dwell: 'ji-scroll', surprise: '堂上学士会反驳季', firstActionMs: 100 },
    budget: { maxChars: 30, maxActionsFirst3s: 1, feedbackMs: 100 } };
}
export async function boot(framework: Framework, act: PlanAct) {
  const seed = Number(new URLSearchParams(location.search).get('seed') ?? 317);
  const rng = createRng(Number.isFinite(seed) ? seed : 317);
  const plan: Plan = {
    id: act.id, version: 1, seed: rng.seed, tier: 'L1', era: 'zhanguo', acts: [act],
    director: { id: 'dev', name: '自测导演', rules: ['只跑一个冻结契约框架'] },
    intent: { id: act.id, title: '稷下自测', hypothesis: { id: 'choice', text: '季能在堂上辨言', mode: 'satisfy' },
      target: '规则玩法可完成', stop: '交回事实', form: 'game', perspective: { who: '季', control: 1 }, era: 'zhanguo', durationMin: 1, director: 'dev' },
    world: generateWorld(rng.seed, rng.fork('world')), constitution: [], rehearsal: [],
  };
  const stage = createStage(document.getElementById('stage')!);
  const bus = new Bus(); const store = createStore(`dev-${act.framework}`);
  const ctx: Ctx = { stage, bus, layers: createLayerBus(bus), store, rng, plan, senses: createSenses(bus, store), think: createThink(bus),
    aff: createAffordances(stage, bus), lines: createLines(stage, bus), audio: createAudio(bus),
    visit: { n: 1, previous: null, sinceMs: 0 }, handoff: {}, record: { n: 1, at: 0, seed: rng.seed, dwell: {} } };
  const layers = ctx.layers;
  layers.usePlan(plan);
  const mentor = createMentor({ seed: rng.seed, tier: 'L1', visits: 1, previous: null, sinceLastMs: 0, dayPart: 'night', device: '宽屏', strength: 1 });
  const deliver = (kind: 'commission' | 'plan' | 'retro', from: string, to: string, payload: unknown) => {
    const letter = layers.send({ kind, from, to, payload }); layers.receive(letter.id, to);
  };
  deliver('commission', 'mentor', 'director', mentor.commission(plan.intent, plan));
  const ack: DirectorAck = { planId: plan.id, version: 1, director: plan.director,
    acts: [{ id: act.id, framework: act.framework, author: act.author, focus: act.focus }],
    accept: '用单幕规则玩法检验季的推断', changes: [], rehearsal: [{ act: act.id, expect: '点击可结束，事实留痕', risk: '判断错误仍可结束' }] };
  deliver('plan', 'director', 'mentor', ack);
  const cue: ActorCue = { act: act.id, who: '季', expects: '在稷下辨明学说，留下上书的简', freedom: '可以答错或坚持自己的推断', initialState: {}, constraints: ['不把齐水德推演当史实'] };
  const cueLetter = layers.send({ kind: 'cue', from: 'director', to: '季', act: act.id, payload: cue });
  layers.receive(cueLetter.id, '季');
  const exposed = { ctx, plan, bus, stage, layers: { letters: layers.letters, check: layers.check }, done: false, result: null as unknown };
  Object.assign(window, { __zhuzi: exposed, __trace: bus.trace });
  bus.log('act.enter', { act: act.id, framework: act.framework, focus: act.focus });
  const started = performance.now(), traceStart = bus.trace.length;
  const result = await framework.run(act, ctx);
  exposed.result = result;
  const report = actorReport(plan, act, cue, result, bus.trace.slice(traceStart), performance.now() - started);
  const reportLetter = layers.send({ kind: 'report', from: '季', to: 'director', act: act.id, payload: report });
  layers.receive(reportLetter.id, 'director');
  const touched = bus.trace.filter(e => e.kind === 'aff.click').map(e => `${act.id}:${String(e.id)}`);
  deliver('retro', 'director', 'mentor', mentor.retro(plan, [report], { record: ctx.record, facts: report.facts, touched }));
  bus.log('act.exit', { act: act.id, data: exposed.result });
  exposed.done = true;
}
