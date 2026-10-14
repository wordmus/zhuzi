// 心智引擎的小测试。运行：npx tsx engine/mind/mind.test.ts
import assert from 'node:assert/strict';
import { createMind, thresholds, strengthOf } from './index';
import type { Temperament } from '../types';

const T = (patience: number): Temperament => ({ pride: 0.5, awe: 0.5, duty: 0.5, attachment: 0.5, patience });
const topo = { modules: [{ id: 'field' }], units: [{ id: 'rain', module: 'field', pred: 0.8, pi: 1, lr: 0.6 }] };

// 1. 同一件事，耐性不同，停的层不同
const patient = createMind({ id: 'a', temperament: T(0.9), ...topo });
const edgy = createMind({ id: 'b', temperament: T(0.1), ...topo });
const pa = patient.sense('rain', 0.5, 'rain'); // e = -0.3
const pb = edgy.sense('rain', 0.5, 'rain');
assert.equal(pa.layer, 'unit', '耐性高：就地消化');
assert.notEqual(pb.layer, 'unit', '耐性低：要往上走');
assert.ok(thresholds(0.9).unit > thresholds(0.1).unit);

// 2. 大意外一路到心智；再来一次就习惯了（单元适应）
const m = createMind({ id: 'c', temperament: T(0.5), ...topo });
assert.equal(m.sense('rain', 0, 'rain').layer, 'mind');
assert.equal(m.lamps().mind, 1);
m.sense('rain', 0, 'rain');
const third = m.sense('rain', 0, 'rain');
assert.ok(['unit', 'module'].includes(third.layer), '同一件事再来，不再到心智');
const e0 = m.audit.find((x) => x.op === 'infer' && x.route === 'top')!;
assert.ok(e0.e !== undefined && e0.eps !== undefined && e0.t !== undefined, '审计条目有 e/eps/t');

// 3. select 分记信息增益与偏好；learn 只改参数；act 先记后做
const sel = m.select([{ id: 'a', preference: 0.4, infoGain: 0.1 }, { id: 'b', preference: 0.3, infoGain: 0.5 }], { weight: 1 });
assert.equal(sel.chosen.id, 'b');
const selLog = m.audit.filter((x) => x.op === 'select').at(-1)!;
assert.ok((selLog.data as any).infoGain === 0.5 && (selLog.data as any).preference === 0.3);
let touched = 0;
m.act('walk', () => touched++);
assert.equal(touched, 1);
const lr = m.learn({ kind: 'belief', target: { qing: 0, li: 1, ming: 0 }, rate: 0.5 }, 'test');
assert.ok(lr!.after.li > lr!.before.li);

// 4. 记忆：衰减、复习后更耐久；设想写 imagined 痕迹
const tr = m.remember({ text: '田伯借了粟', tag: 'observed', kind: 'tianbo' });
m.tick(5);
const s1 = m.strength(tr.id);
m.rehearse(tr.id);
m.tick(10);
const old = createMind({ id: 'd', temperament: T(0.5) });
const t2 = old.remember({ text: 'x', tag: 'observed', kind: 'k' });
old.tick(10);
assert.ok(m.strength(tr.id) > old.strength(t2.id), '复习过的更耐久');
assert.ok(s1 < 1 && strengthOf({ ...tr, C: 0, touched: 0 }, 0) === 1);
const model = (w: any) => [{ id: 'give', preference: w.qing }, { id: 'refuse', preference: 0.4 }];
const im = m.imagine({ other: 'tianbo', label: 'qing', params: { qing: 0.6, li: 0.2, ming: 0.2 }, scenario: {}, model });
assert.equal(im.choice, 'give');
assert.equal(im.trace!.tag, 'imagined');
const im2 = m.imagine({ other: 'tianbo', label: 'qing', params: { qing: 0.2, li: 0.5, ming: 0.3 }, scenario: {}, model });
assert.equal(im2.choice, 'refuse');
assert.equal(im2.trace!.rehearsals, 1, '同一题再想一次 = 复习');

// 5. 沉淀：连续 3 次奏效编译成习惯，连续 2 次出错降级
assert.equal(m.outcome('s', 'wait', true), null);
assert.equal(m.outcome('s', 'wait', true), null);
assert.equal(m.outcome('s', 'wait', true), 'compiled');
assert.equal(m.habit('s'), 'wait');
assert.equal(m.outcome('s', 'wait', false), null);
assert.equal(m.outcome('s', 'wait', false), 'demoted');
assert.equal(m.habit('s'), null);

// 6. 可复现：同样的调用序列，同样的日志
const run = () => {
  const x = createMind({ id: 'e', temperament: T(0.5), ...topo });
  x.sense('rain', 0, 'r');
  x.select([{ id: 'a', preference: 1 }]);
  x.imagine({ other: 'o', label: 'l', params: { qing: 0.5, li: 0.3, ming: 0.2 }, scenario: {}, model });
  return JSON.stringify(x.audit);
};
assert.equal(run(), run());

console.log('mind.test.ts ok');
