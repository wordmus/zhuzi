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
import type { Plan } from '../engine/types';
import type { Ctx, Framework, VisitInfo, VisitRecord } from './context';
import { vignette } from '../frameworks/vignette';
import { reveal } from '../frameworks/reveal';
import { walk2d } from '../frameworks/walk2d';
import { mountPresenter } from '../components/presenter';

const FRAMEWORKS: Record<string, Framework> = { vignette, reveal, walk2d };

async function boot() {
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
  const previous = store.get<VisitRecord | null>('visit.last', null);
  const visit: VisitInfo = {
    n: (previous?.n ?? 0) + 1,
    previous,
    sinceMs: previous ? Math.max(0, senses.now() - previous.at) : 0,
  };
  const record: VisitRecord = { n: visit.n, at: senses.now(), dwell: {}, seed: p.seed, name: previous?.name };

  const ctx: Ctx = {
    stage, bus, store, senses, think, aff, lines, audio,
    plan: p,
    rng: createRng(p.seed),
    visit,
    handoff: {},
    record,
  };

  // 给 bench、模拟玩家与演示面板看的窗口
  (window as any).__zhuzi = { ctx, plan: p, bus, stage, version: p.version };
  (window as any).__trace = bus.trace;
  bus.log('sense', { name: 'boot', visit: visit.n, seed: p.seed, tier: p.tier, dayPart: senses.dayPart() });

  mountPresenter(ctx);

  const saveRecord = () => {
    record.at = senses.now();
    const dwell = aff.dwell();
    for (const [k, v] of Object.entries(dwell)) record.dwell[k] = Math.round((record.dwell[k] ?? 0) + v);
    store.set('visit.last', record);
  };
  window.addEventListener('pagehide', saveRecord);

  for (const act of p.acts) {
    const fw = FRAMEWORKS[act.framework];
    if (!fw) {
      bus.log('error', { message: `no framework ${act.framework}` });
      continue;
    }
    bus.log('act.enter', { act: act.id, framework: act.framework, author: act.author, focus: act.focus, predict: act.predict });
    const t0 = performance.now();
    const res = await fw.run(act, ctx);
    bus.log('act.exit', { act: act.id, ms: Math.round(performance.now() - t0), data: res.data });
    aff.clear();
    saveRecord();
  }
  saveRecord();
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
