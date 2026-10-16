import assert from 'node:assert/strict';
import { buildSchedule, type ScheduleWork } from './schedule';

console.log('--- 运行 engine/mind/schedule.test.ts ---');

const works: ScheduleWork[] = [
  { intent: 'cafe-map', title: '咖啡厅入口总览', form: 'vignette', madeAt: '2026-10-16T04:00:00Z', url: 'x' },
  { intent: 'three-look-at-sky', title: '三人看天', form: 'film', madeAt: '2026-10-16T04:30:00Z', url: 'x' },
  { intent: 'fifty-years', title: '五十年长卷', form: 'game', madeAt: '2026-10-16T05:00:00Z', url: 'x' },
];

// 场景牌用可读短名，绝不把词截成半截（「咖啡厅入口总」）。
const plain = buildSchedule({ visits: 2, works });
for (const entry of plain.entries) {
  assert(entry.title.length <= 6, `短名 <=6 字：${entry.title}`);
  assert(entry.why.length <= 18, `理由 <=18 字：${entry.why}`);
  assert(entry.evidence.ref, '每条排期都要带证据');
}
assert.equal(plain.entries.find(e => e.intentId === 'cafe-map')!.title, '咖啡厅入口');
assert.equal(plain.entries[0]!.when, 'next');
assert.equal(plain.entries[0]!.title, '咖啡厅入口', '最新的那件排在最前');

// 年谱里的违反退化成「上回没做到「短名」，重看」，不是夹生的半句。
const experience = {
  entries: [{
    id: 'feedback', title: '动即有应', rule: '每个动作 100ms 内有看得见的反馈（光、形变、声音），1 秒内有意义上的回应。',
    why: '动手后要立刻看见回应', source: 'spec', param: {}, caseRefs: [1],
    evidence: { kind: 'violation', ref: 'runs/cafe-map/3/L1#feedback' }, violated: true,
  }],
};
const revisited = buildSchedule({ visits: 2, works, experience });
assert.equal(revisited.entries[0]!.intentId, 'cafe-map');
assert.equal(revisited.entries[0]!.why, '上回没做到「动即有应」，重看');
assert.equal(revisited.entries[0]!.evidence.kind, 'rule-violation');
// 别的件不许冒领这条理由。
assert(revisited.entries.slice(1).every(e => e.evidence.kind !== 'rule-violation'));

// 回访（你上次停在哪）只改榜首那一件的理由，不摊到每一件上。
const dwelled = buildSchedule({ visits: 2, works,
  previous: { dwell: { mentor: 40000 }, n: 2 } as never });
assert.equal(dwelled.entries.filter(e => e.evidence.kind === 'dwell').length, 1, '会话级理由只落一件');
assert.equal(dwelled.entries[0]!.when, 'next');
assert.equal(dwelled.entries[0]!.why, '上回停在导师身旁，接着看');
assert(dwelled.entries.every(e => e.title.length <= 6 && e.why.length <= 18));

// 真违反压过会话理由：榜首有实据时不改说「接着看」。
const violatedHead = buildSchedule({ visits: 2, works, experience,
  previous: { dwell: { mentor: 40000 }, n: 2 } as never });
assert.equal(violatedHead.entries[0]!.evidence.kind, 'rule-violation');
assert.equal(violatedHead.entries[0]!.why, '上回没做到「动即有应」，重看');

// 你改过的话只贴给它真指到的那件；指不到时也只落榜首一件。
const preference = { id: 'h1', text: '我更想看人物如何改变', status: 'edited' as const, confidence: .9 };
const unmatched = buildSchedule({ visits: 2, works, hypotheses: [preference as never] });
assert.equal(unmatched.entries.filter(e => e.evidence.kind === 'hypothesis-correction').length, 1, '指不到时只落一件');
assert.equal(unmatched.entries[0]!.why, '你改说我更想看人物如何改变，先试');
assert(unmatched.entries.slice(1).every(e => e.why !== '你改说我更想看人物如何改变，先试'), '其余件不冒领');
const matched = buildSchedule({ visits: 2, works, hypotheses: [{ ...preference, text: '三人看天' } as never] });
const sky = matched.entries.find(e => e.intentId === 'three-look-at-sky')!;
assert.equal(sky.why, '你改说三人看天，先试');
assert.equal(sky.evidence.kind, 'hypothesis-correction');
assert.equal(matched.entries[0]!.intentId, 'three-look-at-sky', '被指到的件升到最前');

// 空索引不编造。
assert.equal(buildSchedule({ visits: 1, works: [] }).entries.length, 0);

console.log('schedule.test PASS · 短名/证据/冒领/空索引 6 项');
