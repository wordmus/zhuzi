import assert from 'node:assert/strict';
import { ELEMENTS, OVERCOMES, ROUNDS, beats, elementAt, initialWheel, turn, victor } from './logic';

assert.deepEqual(ELEMENTS.map(victor), ['金', '水', '木', '火', '土']);
for (const e of ELEMENTS) { assert(beats(victor(e), e)); assert(!beats(e, e)); assert(ELEMENTS.includes(OVERCOMES[e])); }
assert.deepEqual(ROUNDS.map(r => victor(r.previous)), ['金', '火', '水']);
let score = initialWheel();
score = turn(score, '木');
assert.equal(score.round, 0);
assert.equal(score.mistakes, 1);
assert.equal(turn(score, '木'), score);
for (const round of ROUNDS) score = turn(score, victor(round.previous));
assert.equal(score.round, 3); assert.equal(score.correct, 3); assert.equal(score.firstTry, 2);
assert.equal(turn(score, '水'), score);
for (const [i, e] of ELEMENTS.entries()) {
  const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
  assert.equal(elementAt(Math.cos(a) * 100, Math.sin(a) * 100, 0, 0), e);
}
console.log('PASS wude-wheel：五德相胜、夏商周三轮、错选重试、重复防抖、拖动五向');
