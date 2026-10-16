// 产物与真实重访的整合断言；不是镜像玩法的单元测试。
// pnpm tsx director/pipeline/fifty-years.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHistory, loadHistory } from '../../engine/history';
import { checkLayerLetters, LETTER_KINDS } from '../../engine/layers/bus';
import type { Letter, ActorReport } from '../../engine/layers/types';
import type { Fact, Plan } from '../../engine/types';
import type { TraceEvent } from '../../engine/bus';
import { createLongscroll, type LongscrollSave } from './fifty-years-state';
import { launch, newContext, installBench, serveDir, loadThresholds, readPageData } from '../../bench/lib';
import { play } from '../../bench/player';

const dir = path.resolve('runs/fifty-years/3/L1');
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const plan = read<Plan>('plan.json');
const ledger = read<Fact[]>('ledger.json');
const save = read<LongscrollSave>('history-save.json');
const layers = read<{ letters: Letter[]; check: string[] }>('layers.json');
const trace: TraceEvent[] = fs.readFileSync(path.join(dir, 'trace.jsonl'), 'utf8').trim().split('\n').map(s => JSON.parse(s));
assert.deepEqual(layers.check, []);
assert.deepEqual(checkLayerLetters(layers.letters, plan.acts.map(a => a.id)), []);
assert(LETTER_KINDS.every(kind => layers.letters.some(l => l.kind === kind)));
for (const act of plan.acts) {
  const reports = layers.letters.filter(l => l.kind === 'report' && l.act === act.id).map(l => l.payload as ActorReport);
  assert(reports.length && reports.every(r => r.actual && r.did.length));
  if (['jixia-speakers', 'wude-wheel', 'qi-knife', 'bells'].includes(act.framework)) {
    assert(reports.some(r => r.facts.some(f => ledger.some(w => w.id === f.id))));
    assert(reports.some(r => r.did.some(d => !d.includes('未留下') && !d.startsWith('处理本幕'))));
  }
}
console.log('PASS layers：五类信、逐幕提示与真实报告、回执检查为空');
const historical = ledger.filter(f => f.id.startsWith('history.event.'));
const years = new Set(historical.map(f => f.day));
assert(historical.length >= 3 && years.size >= 3 && Math.max(...years) - Math.min(...years) >= 40);
assert(ledger.filter(f => f.id.startsWith('history.decision.')).length >= 2);
assert(['季', '田伯'].every(by => ledger.some(f => f.id.startsWith('history.decision.') && f.by === by)));
assert(['jixia-speakers-', 'wude-wheel-', 'qi-knife-', 'bells-'].every(prefix => ledger.some(f => f.id.startsWith(prefix))));
assert.equal(new Set(ledger.map(f => f.id)).size, ledger.length);
assert.equal(historical.length, loadHistory().events.length);
assert.equal(save.state.year, -306);
assert.deepEqual(save.ledger, ledger);
const traceFacts = new Map(trace.filter(e => e.kind === 'world.fact').map(e => [(e.fact as Fact).id, e.fact]));
assert.equal(traceFacts.size, ledger.length);
for (const fact of ledger) assert.deepEqual(traceFacts.get(fact.id), fact);
assert(trace.filter(e => e.kind === 'act.enter').length >= 5);
assert(trace.filter(e => e.kind === 'act.enter' && ['jixia-speakers', 'wude-wheel', 'qi-knife', 'bells'].includes(String(e.framework))).length >= 2);
assert(trace.filter(e => e.kind === 'world.event' && e.eventKind === 'history.entry').length >= 3);
console.log(`PASS ledger/trace：${historical.length}件史事跨50年，四游戏事实与账本逐条相同`);

// 用真实试映保存的 history.state 与 ledger 重建，而非再造一套手写样本。
const h = createHistory({ events: loadHistory().events, startYear: save.state.year, macro: save.state.macro, ledger: save.ledger });
assert.deepEqual(h.state(), save.state);
assert.deepEqual(h.advanceTo(-306), []);
assert.deepEqual(h.advanceTo(-334), []);
assert.deepEqual(h.ledger(), save.ledger);
const memory = new Map<string, unknown>([['history.save', structuredClone(save)], ['history.state', structuredClone(save.state)]]);
const store = { get<T>(key: string, fallback: T): T { return structuredClone((memory.get(key) ?? fallback) as T); }, set(key: string, value: unknown) { memory.set(key, structuredClone(value)); } };
const resumed = createLongscroll(store);
assert.deepEqual(resumed.advance(-306), []);
assert.deepEqual(resumed.decide('ji-wude', '季', '不得再写一次', { rites: .2 }), []);
assert.deepEqual(resumed.ledger(), ledger);
assert.deepEqual(resumed.history.state(), save.state);
resumed.decide('next-visit', '小石', '接过禾的杖', { minxin: .01 });
assert.deepEqual(resumed.ledger().slice(0, ledger.length), ledger);
assert.equal(resumed.ledger().length, ledger.length + 1);
console.log('PASS history.state：真实存档重开不重播、不重扣、旧事实逐字保留，仍能追加');

// 把同一份存档装回实际网页，走一遍第二次来访。
const server = await serveDir(dir);
const browser = await launch({ headed: false });
try {
  const context = await newContext(browser);
  await context.addInitScript(({ save }) => {
    localStorage.setItem('zhuzi.v1.history.save', JSON.stringify(save));
    localStorage.setItem('zhuzi.v1.history.state', JSON.stringify(save.state));
    localStorage.setItem('zhuzi.v1.visit.last', JSON.stringify({ n: 1, at: Date.now(), dwell: {}, seed: 3, ending: save.ending?.id }));
  }, { save });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await installBench(page);
  await page.goto(`${server.origin}/index.html`);
  const result = await play(page, { ...loadThresholds().player, maxSeconds: 100, differ: null, shotsDir: null });
  const data = await readPageData(page);
  assert.equal(result.done, true, result.reason);
  assert.deepEqual(errors, []);
  assert.equal(data.trace.filter(e => e.kind === 'world.event' && e.eventKind === 'history').length, 0);
  assert(!data.trace.some(e => ['jixia-speakers.start', 'wude-wheel.start', 'qi-knife.start', 'bells.start'].includes(e.kind)));
  const actual = await page.evaluate<{ state: LongscrollSave['state']; ledger: Fact[]; check: string[]; visit: number }>(`(() => ({ state: window.__zhuzi.ctx.store.get('history.state', null), ledger: window.__zhuzi.ctx.handoff.world.ledger(), check: window.__zhuzi.layers.check(), visit: window.__zhuzi.ctx.visit.n }))()`);
  assert.deepEqual(actual.state, save.state);
  assert.deepEqual(actual.ledger, ledger);
  assert.deepEqual(actual.check, []);
  assert.equal(actual.visit, 2);
  console.log('PASS 真实第二次来访：从前306年续接，未再玩完旧章，咖啡厅可关门，layers=[]');
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
