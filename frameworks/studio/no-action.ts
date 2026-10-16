// 独立验收页：确实没有先演《旱》，演员只收提示，不捏造行动或误差。
import type { Ctx } from '../../app/context';
import type { Plan } from '../../engine/types';
import type { ActorReport } from '../../engine/layers/types';
import { Bus } from '../../engine/bus';
import { createLayerBus } from '../../engine/layers/bus';
import { createStage } from '../../engine/stage';
import { createRng } from '../../engine/rng';
import { createStore } from '../../engine/store';
import { createSenses } from '../../engine/senses';
import { createThink } from '../../engine/think';
import { createAffordances } from '../../engine/affordance';
import { createLines } from '../../components/line';
import { createAudio } from '../../engine/audio';
import { generateWorld } from '../../engine/world/generate';
import { studio } from './index';
import { studioAct } from './plan';

async function boot() {
  const seed = 7, act = studioAct({ maxChars: 30, maxActionsFirst3s: 1, feedbackMs: 100 });
  const bus = new Bus(), stage = createStage(document.getElementById('stage')!);
  const rng = createRng(seed), store = createStore(), senses = createSenses(bus, store);
  const plan: Plan = {
    id: 'studio-no-action', version: 1, seed, tier: 'L1', era: 'zhanguo',
    intent: { id: 'studio-no-action', title: '没有旧演出的回信',
      hypothesis: { id: 'honest-report', text: '没有行动时不冒认行动', mode: 'probe' },
      target: '演员只收提示，明说没有动手', stop: act.exit, form: 'game',
      perspective: { who: '禾', control: .5 }, era: 'zhanguo', durationMin: 1, director: 'selftest' },
    director: { id: 'selftest', name: '自测导演', rules: [] }, acts: [act],
    world: generateWorld(seed, rng), constitution: [],
    rehearsal: [{ act: act.id, expect: '只接提示，不造行动', risk: '不能借用别人的事实' }],
  };
  const layers = createLayerBus(bus, () => ({ t: bus.now() }));
  const ctx: Ctx = { stage, bus, layers, store, senses, rng, think: createThink(bus),
    aff: createAffordances(stage, bus), lines: createLines(stage, bus), audio: createAudio(bus), plan,
    visit: { n: 1, previous: null, sinceMs: 0 }, handoff: {}, record: { n: 1, at: 0, dwell: {}, seed } };
  const exposed = { ctx, plan, bus, stage, layers, done: false };
  (window as any).__zhuzi = exposed;
  (window as any).__trace = bus.trace;
  bus.log('act.enter', { act: act.id, framework: act.framework, focus: act.focus });
  const result = await studio.run(act, ctx);
  bus.log('act.exit', { act: act.id, data: result.data });
  const report = layers.letters().find(l => l.kind === 'report')!.payload as ActorReport;
  const retro = layers.send({ kind: 'retro', from: 'director', to: 'mentor', payload: {
    intentId: plan.intent.id, predicted: report.predicted, actual: report.actual,
    userModelDelta: {}, promises: [], next: '查阅本幕真实报告',
  } });
  layers.receive(retro.id, 'mentor');
  ctx.aff.clear(); exposed.done = true;
}
void boot().catch(console.error);
