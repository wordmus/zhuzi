import test from 'node:test';
import assert from 'node:assert/strict';
import { actorVoice } from './voice.ts';
import { ACTOR_VOICE } from '../world/lines.ts';

const empty = { who: '禾', did: ['处理本幕提示；观察到一条交付事实', '本幕未留下可归属于自己的行动记录'], facts: [] };
test('有行动从自己的证词取材，旁人的事实不能充作自己的行动', () => {
  const voice = actorVoice({ ...empty, did: ['说：田伯，我爹给您爹扛过粟。'], facts: [{ id: 'other', kind: 'event', text: '田伯开了仓。' }] });
  assert.equal(voice[0], '我说过：田伯，我爹给您爹扛过粟。');
  assert.equal(voice[1], '我记下：田伯开了仓。');
});
test('没有自己的行动时，第一句明说没动手，收信和复核不冒充行动', () => {
  for (const who of Object.keys(ACTOR_VOICE)) {
    assert.match(actorVoice({ ...empty, who, did: [...empty.did, `${who}已接收提示信`, '复核原件：cue:han:1'], facts: [{ id: 'f', kind: 'event', text: '王的人来征粮了。' }] })[0]!, /没动手/);
  }
});
test('种子和误差有证据才说；门槛以内不声称料偏', () => {
  assert.deepEqual(actorVoice({ ...empty, seeds: [{ id: 's', concept: 'she' }], error: { layer: 'mind', e: .8, eps: .2 } }), ['这一幕我没动手。', '我心里有了偏差。', '我心里留着：社。']);
  assert(!actorVoice({ ...empty, error: { layer: 'mind', e: .1, eps: .2 } }).some(l => l.includes('偏差')));
});
test('所有演员每份两至三句、每句至多十八字，不输出禁词或数字，输入不改动', () => {
  for (const who of [...Object.keys(ACTOR_VOICE), '导师']) for (const did of [empty.did, ['说：茶米百分比数字123'], ['说：天不降雨，是人失了序。'], ['给粟'.repeat(40)], ['在mind层处理观测']]) {
    const evidence = { ...empty, who, did, seeds: [{ id: 's', concept: 'di' }], facts: [{ id: 'f', kind: 'event', text: '粟'.repeat(50) }] };
    const before = structuredClone(evidence);
    const lines = actorVoice(evidence);
    assert(lines.length >= 2 && lines.length <= 3);
    for (const line of lines) { assert([...line].length <= 18, line); assert(!/茶|米|百分比|数字|[0-9０-９%％]/u.test(line), line); }
    assert.deepEqual(evidence, before);
  }
});
