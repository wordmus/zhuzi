import assert from 'node:assert/strict';
import type { VisitChange, VisitRecord } from '../../app/context';
import { createStore } from '../store';
import { createMentor } from '../layers/mentor';
import type { Intent, Plan } from '../types';
import {
  affirmHypothesis,
  commissionWhyFromHypotheses,
  correctHypothesis,
  deriveHypotheses,
  deriveMentorTemperament,
  getOrInitHypotheses,
  listActiveHypotheses,
  retireHypothesis,
} from './hypotheses';

console.log('--- 运行 engine/mind/hypotheses.test.ts ---');

// 模拟真实记录
const mockPrevious: VisitRecord = {
  n: 1,
  at: Date.now() - 3600000,
  dwell: { mentor: 4200, door: 1200, ticket: 3100 },
  longestPlace: 'mentor',
  longestPlaceMs: 4200,
  ending: 'lend',
  endingFact: '田伯借出半瓮粟',
  seed: 2,
};

const mockCurrent: VisitRecord = {
  n: 2,
  at: Date.now(),
  dwell: { mentor: 2800 },
  seed: 2,
};

const mockChanges: VisitChange[] = [
  {
    id: 'visit-2-lamp',
    visit: 2,
    place: 'lamp',
    what: '灯移到你的座位旁',
    why: '上次你在导师案前停留最久',
    before: '灯在横向 0.48',
    after: '灯在横向 0.29',
    attribution: '你停得久，灯就挪近了。',
    since: mockPrevious.at,
  },
];

// 1. 证据来自记录
{
  const list = deriveHypotheses({
    previous: mockPrevious,
    current: mockCurrent,
    dayPart: 'deep-night',
    changes: mockChanges,
  });

  assert.ok(list.length >= 3, '至少初始 3 条假设');

  // h-focus 证据引用 endingFact
  const hFocus = list.find(h => h.id === 'h-focus');
  assert.ok(hFocus, '存在 h-focus 假设');
  assert.strictEqual(hFocus.status, 'active');
  assert.ok(hFocus.confidence > 0 && hFocus.confidence <= 1);
  assert.ok(
    hFocus.evidence.some(e => e.what.includes('田伯借出半瓮粟')),
    'h-focus 证据必须包含真实 endingFact 记录',
  );

  // h-dwell 证据引用 longestPlace
  const hDwell = list.find(h => h.id === 'h-dwell');
  assert.ok(hDwell, '存在 h-dwell 假设');
  assert.ok(
    hDwell.evidence.some(e => e.what.includes('mentor') && e.what.includes('4200ms')),
    'h-dwell 证据必须包含真实 longestPlace 与 dwell 毫秒',
  );

  // h-night 证据引用 deep-night 时段
  const hNight = list.find(h => h.id === 'h-night');
  assert.ok(hNight, '存在 h-night 假设');
  assert.ok(
    hNight.evidence.some(e => e.what.includes('深夜')),
    'h-night 证据必须引用真实 dayPart 时段',
  );

  console.log('✓ 证据来自记录断言通过（所有证据均绑定真实记录字段）');
}

// 2. 纠正后 status / confidence 正确，且导师应答 ≤18 字
{
  const store = createStore('test.hypo.correct.' + Math.random());
  const initial = deriveHypotheses({ previous: mockPrevious, current: mockCurrent });
  store.set('mentor.hypotheses', initial);

  const res = correctHypothesis(initial, 'h-focus', '其实我更在意胜负大势', store);
  const corrected = res.hypotheses.find(h => h.id === 'h-focus');
  assert.ok(corrected);
  assert.strictEqual(corrected.status, 'edited', '纠正后状态必须为 edited');
  assert.strictEqual(corrected.confidence, 0.9, '纠正后置信度为 0.9');
  assert.strictEqual(corrected.text, '其实我更在意胜负大势', '纠正后内容更新');
  assert.strictEqual(corrected.originalText, '你更在意人物的处境，而非战局', '旧说法留痕');

  assert.ok(res.line.length <= 18, `导师反馈字数必须 ≤18 字，当前：${res.line.length}字「${res.line}」`);
  assert.ok(res.line.includes('胜负大势'), '导师反馈应包含新纠正的内容');

  // 验证写回 store
  const fromStore = store.get<any[]>('mentor.hypotheses', []);
  const storedH = fromStore.find(h => h.id === 'h-focus');
  assert.strictEqual(storedH.status, 'edited');

  console.log(`✓ 纠正后 status=edited/confidence=0.9 正确，导师反馈「${res.line}」（${res.line.length}字 ≤18）`);
}

// 3. 纠正前后 commission().why 不同
{
  const store = createStore('test.hypo.commission.' + Math.random());
  const mockIntent: Intent = {
    id: 'mentor-desk',
    title: '导师台',
    hypothesis: { id: 'h-test', text: '测试假设', mode: 'satisfy' },
    target: '推门',
    stop: '拿起票根',
    form: 'vignette',
    perspective: { who: '你', control: 1 },
    era: 'zhanguo',
    durationMin: 1,
    director: 'base',
  };

  const mockPlan: Plan = {
    id: 'mentor-desk',
    version: 1,
    intent: mockIntent,
    seed: 2,
    tier: 'L1',
    director: { id: 'base', name: '基础导演', rules: [] },
    era: 'zhanguo',
    acts: [],
    world: { places: [], people: [], items: [], relations: [], clocks: [] } as any,
    constitution: [] as any,
    rehearsal: [],
  };

  // 纠正前
  const mentorBefore = createMentor({
    seed: 2,
    tier: 'L1',
    visits: 2,
    previous: mockPrevious,
    sinceLastMs: 1000,
    dayPart: 'night',
    device: '宽屏',
    strength: 1,
    store,
  });
  const commBefore = mentorBefore.commission(mockIntent, mockPlan);

  // 纠正一条假设并写入 store
  const initial = getOrInitHypotheses(store, { previous: mockPrevious, current: mockCurrent });
  correctHypothesis(initial, 'h-focus', '更关注胜负大势', store);

  // 纠正后
  const mentorAfter = createMentor({
    seed: 2,
    tier: 'L1',
    visits: 2,
    previous: mockPrevious,
    sinceLastMs: 1000,
    dayPart: 'night',
    device: '宽屏',
    strength: 1,
    store,
  });
  const commAfter = mentorAfter.commission(mockIntent, mockPlan);

  assert.notStrictEqual(
    commBefore.why,
    commAfter.why,
    `纠正前后 commission().why 必须不同。前：「${commBefore.why}」，后：「${commAfter.why}」`,
  );
  assert.ok(
    commAfter.why.includes('胜负大势'),
    `纠正后的 why 必须反映被纠正的假设内容，当前：「${commAfter.why}」`,
  );

  console.log(`✓ commission().why 纠正前后不同：\n  改前：${commBefore.why}\n  改后：${commAfter.why}`);
}

// 4. 撤销后不再出现在活跃列表
{
  const store = createStore('test.hypo.retire.' + Math.random());
  const initial = deriveHypotheses({ previous: mockPrevious, current: mockCurrent });
  store.set('mentor.hypotheses', initial);

  const res = retireHypothesis(initial, 'h-dwell', store);
  assert.ok(res.line.length <= 18, `撤销应答 ≤18 字，当前：「${res.line}」`);

  const active = listActiveHypotheses(res.hypotheses);
  assert.strictEqual(
    active.some(h => h.id === 'h-dwell'),
    false,
    '已撤销的假设不能出现在 active 列表中',
  );

  const retired = res.hypotheses.find(h => h.id === 'h-dwell');
  assert.strictEqual(retired?.status, 'retired', '撤销后状态为 retired');

  console.log(`✓ 撤销后不再出现在列表（status=retired，导师应答：「${res.line}」）`);
}

// 5. 留着（affirm）置信度提升，状态 active
{
  const initial = deriveHypotheses({ previous: mockPrevious, current: mockCurrent });
  const confBefore = initial.find(h => h.id === 'h-night')!.confidence;
  const res = affirmHypothesis(initial, 'h-night');
  const confAfter = res.hypotheses.find(h => h.id === 'h-night')!.confidence;

  assert.ok(confAfter > confBefore, '留着动作必须提升置信度');
  assert.strictEqual(res.hypotheses.find(h => h.id === 'h-night')!.status, 'active');
  assert.ok(res.line.length <= 18, `留着应答 ≤18 字，当前：「${res.line}」`);
  console.log(`✓ 留着动作提升置信度：${confBefore} -> ${confAfter}，应答：「${res.line}」`);
}

// 6. 同输入确定性
{
  const input = {
    previous: mockPrevious,
    current: mockCurrent,
    dayPart: 'dusk',
    changes: mockChanges,
  };
  const run1 = deriveHypotheses(input);
  const run2 = deriveHypotheses(input);
  assert.deepStrictEqual(run1, run2, '给定相同输入，推导结果必须严格相同');
  console.log('✓ 同输入确定性断言通过');
}

// 7. 你眼中的它（只读脾性 3 条）
{
  const traits = deriveMentorTemperament({ previous: mockPrevious, current: mockCurrent, changes: mockChanges });
  assert.strictEqual(traits.length, 3, '必须恰好归纳 3 条脾性');
  for (const t of traits) {
    assert.ok(t.trait.length > 0, '脾性摘要非空');
    assert.ok(t.evidence.includes('真实依据：'), '每条必须附一条真实证据引用');
  }
  console.log('✓ 你眼中的它（3 条脾性，每条含真实证据引用）断言通过：');
  for (const t of traits) {
    console.log(`  · ${t.trait} -> ${t.evidence}`);
  }
}

console.log('PASS 全部 engine/mind/hypotheses.test.ts 无头断言');
