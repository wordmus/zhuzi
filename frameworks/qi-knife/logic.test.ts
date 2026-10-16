import assert from 'node:assert/strict';
import { createRng } from '../../engine/rng';
import { CONCERNS, DECISIONS, consequence, createQi, decide, recommend, thought, weigh } from './logic';

for (let seed = 0; seed < 32; seed++) {
  const initial = createQi(createRng(seed).fork('qi-knife'));
  assert.deepEqual(initial, createQi(createRng(seed).fork('qi-knife')));
  assert.equal(decide(initial, 'give'), initial);
  for (const concern of CONCERNS) {
    let state = initial;
    for (let i = 0; i < 3; i++) {
      const before = structuredClone(state);
      const next = weigh(state, concern);
      assert.deepEqual(state, before);
      assert.equal(next.weighed.length, i + 1);
      assert.ok(Math.abs(next.tilt) <= 0.3);
      assert.ok([...thought(next)].length <= 30);
      state = next;
    }
    assert.equal(weigh(state, concern), state);
    assert.ok(DECISIONS.includes(recommend(state)));
    for (const choice of DECISIONS) {
      const end = decide(state, choice);
      assert.equal(end.choice, choice);
      assert.equal(end.stock, choice === 'give' ? 7 : choice === 'lend' ? 9 : 12);
      assert.equal(decide(end, choice), end);
      assert.ok([...consequence(end).text].length <= 30);
      assert.equal(consequence(end).by, '田伯');
    }
  }
}
assert.throws(() => consequence(createQi(createRng(1))));
console.log('PASS 齐法化：32 seeds × 四种掂量 × 三种出口，三次限制、代价、纯函数、事实与复现');
