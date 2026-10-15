// 规格 4.8：环境变化必须进入下一步选择；空闲也能走完一局。
import assert from 'node:assert/strict';
import { createRng } from '../rng';
import type { Beat } from '../types';
import { generateWorld } from './generate';
import { createWorld } from './sim';
import { tianboModel, type GateScenario } from './tianbo';

let minMarks = Infinity, minClosings = Infinity, minSelf = Infinity;
for (let seed = 1; seed <= 30; seed++) {
  const run = () => {
    const world = createWorld(generateWorld(seed, createRng(seed)), createRng(seed));
    const beats: Beat[] = [...world.opening()];
    for (let step = 0; step < 40 && !world.finished(); step++) {
      const before = world.ledger();
      const previousMarks = world.state().marks ?? [];
      beats.push(...world.idle().beats);
      assert.deepEqual(world.ledger().slice(0, before.length), before, '事实不能改写');
      const after = world.state().marks ?? [];
      for (const m of previousMarks) {
        assert(after.some(next => next.id === m.id && next.since === m.since), '痕迹不能消失或改写来历');
      }
    }
    assert(world.finished(), `seed ${seed} 空闲必须能收束`);
    const state = world.state();
    const marks = state.marks ?? [];
    const closings = state.closing ?? [];
    const self = beats.filter(b => b.kind === 'self').length;
    assert(marks.length >= 6 && new Set(marks.map(m => m.by)).size >= 3, `seed ${seed} 至少六道痕迹、三种来源`);
    assert(closings.length >= 4 && new Set(closings.map(c => c.day)).size === closings.length, '至少四天关门，一天只有一扇');
    assert(self >= 3, '空闲玩家时禾至少自主行动三次');
    minMarks = Math.min(minMarks, marks.length);
    minClosings = Math.min(minClosings, closings.length);
    minSelf = Math.min(minSelf, self);
    for (const closure of closings) {
      assert.equal(world.ledger().filter(f => f.day === closure.day && f.text === closure.what).length, 1, '关门只交付一次事实');
    }
    const ledger = world.ledger();
    assert.deepEqual(world.idle().beats, [], '收束后空闲不再改世界');
    assert.deepEqual(world.ledger(), ledger);
    return JSON.stringify({ ledger, marks, closings, trace: world.mindTrace() });
  };
  assert.equal(run(), run(), `seed ${seed} 环境与自主行动可复现`);
}

const config = generateWorld(31, createRng(31));
config.jarDays = 100;
config.he.temperament.pride = 1;
const dry = createWorld(config, createRng(31));
while (dry.state().day < 8 && !dry.finished()) dry.idle();
assert(!dry.finished(), '有粮但不愿求人的禾仍在四季中');
assert(dry.state().marks?.some(m => m.kind === 'well' && m.strength === 0), '井已经见底');
assert(dry.options().some(o => o.action === 'dig-well') && !dry.options().some(o => o.action === 'listen'), '井干改变动作与消息入口');
while (dry.state().day < 11 && !dry.finished()) dry.idle();
assert(!dry.options().some(o => o.place === 'gate' && o.approach === 'qing'), '旧情这扇门关上后不再出现');

const scenario: GateScenario = { approach: 'li', granary: 0.6, crowd: 0, hunger: 0.6, visits: 1, requisitioned: false, season: 'autumn', pride: 0.5 };
const weights = { qing: 0.1, li: 0.8, ming: 0.1 };
const score = (s: GateScenario, id: string) => tianboModel(weights, s).find(c => c.id === id)!.preference;
assert(score({ ...scenario, landQuality: 1 }, 'buy-land') > score(scenario, 'buy-land'), '活苗会进入田伯买地的掂量');
assert(score({ ...scenario, wariness: 1 }, 'refuse') > score(scenario, 'refuse'), '田伯的戒备会改变他的回应');
const stubborn = createWorld(generateWorld(1, createRng(1)), createRng(1));
const gate = stubborn.options().find(o => o.place === 'gate')!;
assert(gate.refuse);
const refusal = stubborn.act(gate);
assert(refusal.beats.some(b => b.kind === 'self') && refusal.state.visitsToGate === 0, '硬推时禾留种子、照自己意思做');

console.log(`landscape.test.ts ok · 30 seeds × 2 replays · marks ≥ ${minMarks} · closings ≥ ${minClosings} · self ≥ ${minSelf}`);
