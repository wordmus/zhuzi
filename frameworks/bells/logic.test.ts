import assert from 'node:assert/strict';
import { createRng } from '../../engine/rng';
import { createBells, frequency, makeSequence, RATIOS, roundLength, strike } from './logic';
import { degreeHz } from '../../engine/audio';

for (let seed = 0; seed < 32; seed++) {
  const sequence = makeSequence(createRng(seed).fork('bells'));
  assert.deepEqual(sequence, makeSequence(createRng(seed).fork('bells')));
  assert.ok(sequence.every(n => n >= 0 && n < 5));
  let state = createBells(sequence);
  const wrong = strike(state, (sequence[0]! + 1) % 5);
  assert.equal(wrong.mistakes, 1);
  assert.equal(wrong.round, 0);
  assert.deepEqual(wrong.sequence, sequence);
  state = wrong;
  for (const length of [2, 3, 4]) {
    assert.equal(roundLength(state), length);
    for (let i = 0; i < length; i++) {
      const before = structuredClone(state);
      const next = strike(state, sequence[i]!);
      assert.deepEqual(state, before);
      state = next;
    }
    assert.equal(state.longest, length);
  }
  assert.equal(state.done, true);
  assert.equal(state.round, 3);
  assert.equal(strike(state, 0), state);
  assert.equal(state.correct, 9);
  assert.equal(state.attempts, 10);
}
let interrupted = strike(createBells([0, 1, 2, 3]), 0);
interrupted = strike(interrupted, 2);
assert.equal(interrupted.cursor, 0);
assert.equal(interrupted.round, 0);
assert.equal(strike(interrupted, -1), interrupted);
assert.throws(() => createBells([8, 0, 1, 2]));
for (let n = -5; n < 11; n++) assert.equal(frequency(n), degreeHz(n));
assert.deepEqual(RATIOS, [1, 9 / 8, 81 / 64, 3 / 2, 27 / 16]);
console.log('PASS 编钟：32 seeds，2/3/4 声三轮、错音重来、纯函数、同 seed 与实际音频五度相生频率一致');
