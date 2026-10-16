// 独立自测页的通用启动器：合成 PlanAct 与假器官，跑一个框架，收尾并暴露给 bench。
// 正式作品仍由导演管线编排；这里只为 dev/<id>.html 提供可复验入口。
import type { Ctx, Framework } from '../app/context';
import type { ActResult } from '../app/context';
import type { Plan, PlanAct } from '../engine/types';
import { createStage } from '../engine/stage';
import { Bus } from '../engine/bus';
import { createRng } from '../engine/rng';
import { createStore } from '../engine/store';
import { createSenses } from '../engine/senses';
import { createThink } from '../engine/think';
import { createAffordances } from '../engine/affordance';
import { createLines } from '../components/line';
import { createAudio } from '../engine/audio';
import { generateWorld } from '../engine/world/generate';
import { createLayerBus } from '../engine/layers/bus';
import type { ActorReport, DirectorAck } from '../engine/layers/types';

export async function bootOne(act: PlanAct, framework: Framework, who: string): Promise<ActResult> {
  const value = Number(new URLSearchParams(location.search).get('seed') ?? 17);
  const seed = Number.isFinite(value) ? value : 17;
  const bus = new Bus();
  const stage = createStage(document.getElementById('stage')!);
  const rng = createRng(seed);
  const store = createStore();
  const senses = createSenses(bus, store);
  const plan: Plan = {
    id: `${act.framework}-selftest`, version: 1, seed, tier: 'L3', era: 'zhanguo',
    intent: { id: act.framework, title: '独立自测', hypothesis: { id: 'play', text: '不用说明也能动手', mode: 'probe' }, target: '回成一幕', stop: act.exit, form: 'game', perspective: { who, control: 0.5 }, era: 'zhanguo', durationMin: 1, director: 'selftest' },
    director: { id: 'selftest', name: '自测导演', rules: [] }, acts: [act], world: generateWorld(seed, rng), constitution: [], rehearsal: [{ act: act.id, expect: '全程规则完成', risk: '无声时仍有光线' }],
  };
  const layers = createLayerBus(bus, () => ({ t: bus.now() }));
  const ctx: Ctx = { stage, bus, layers, store, senses, rng, think: createThink(bus), aff: createAffordances(stage, bus), lines: createLines(stage, bus), audio: createAudio(bus), plan, visit: { n: 1, previous: null, sinceMs: 0 }, handoff: {}, record: { n: 1, at: 0, dwell: {}, seed } };
  const exposed: Record<string, unknown> = { ctx, plan, seed, tier: plan.tier, bus, stage, layers, done: false };
  (window as any).__zhuzi = exposed;
  (window as any).__trace = bus.trace;
  layers.usePlan(plan);
  const commission = layers.send({ kind: 'commission', from: 'mentor', to: 'director', payload: { intentId: plan.intent.id, target: plan.intent.target } });
  layers.receive(commission.id, 'director');
  const ack: DirectorAck = { planId: plan.id, version: 1, director: plan.director, acts: [act], accept: '独立自测采用这一幕', changes: [], rehearsal: plan.rehearsal };
  const planLetter = layers.send({ kind: 'plan', from: 'director', to: 'mentor', payload: ack });
  layers.receive(planLetter.id, 'mentor');
  const cue = layers.send({ kind: 'cue', from: 'director', to: who, act: act.id, payload: { act: act.id, who, expects: act.exit, freedom: '玩家自由玩这一幕', initialState: {}, constraints: ['只交事实，不改世界'] } });
  layers.receive(cue.id, who);
  bus.log('act.enter', { act: act.id, framework: act.framework, focus: act.focus });
  const started = performance.now();
  const result = await framework.run(act, ctx);
  bus.log('act.exit', { act: act.id, data: result.data });
  const facts = (result.data?.facts as ActorReport['facts'] | undefined) ?? [];
  for (const fact of facts) bus.log('world.fact', { fact });
  const report: ActorReport = {
    act: act.id, who,
    did: bus.trace.filter(e => e.kind === 'aff.click').map(e => String(e.id)),
    predicted: act.exit,
    actual: facts.map(f => f.text).join('；') || '这一幕演完了',
    facts, ms: Math.round(performance.now() - started),
  };
  const reportLetter = layers.send({ kind: 'report', from: who, to: 'director', act: act.id, payload: report });
  layers.receive(reportLetter.id, 'director');
  const retro = layers.send({ kind: 'retro', from: 'director', to: 'mentor', payload: { intentId: plan.intent.id, predicted: act.exit, actual: report.actual, userModelDelta: result.data?.metrics ?? {}, promises: [], next: '交回整合者' } });
  layers.receive(retro.id, 'mentor');
  ctx.aff.clear();
  exposed.done = true;
  return result;
}
