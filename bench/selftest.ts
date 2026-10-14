// 先验证 bench 与校验器本身（管线说明 3.5）：
//   1. 校验器：正常方案通过，几种故意弄坏的方案必须报 error；
//   2. bench：守规矩的页面必须 PASS，故意做坏的页面必须 FAIL。
//   pnpm bench:selftest
import path from 'node:path';
import { directFromFiles } from '../director/pipeline/director-node';
import { validatePlan } from '../director/pipeline/validate';
import type { Plan } from '../engine/types';
import { REPO_ROOT } from './lib';
import { runBench } from './run';

let bad = 0;
const report = (ok: boolean, line: string) => {
  if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'BAD'} ${line}`);
};

// ---- 校验器 ----
const base = await directFromFiles({ root: REPO_ROOT, intentPath: 'intents/first-visit.json', seed: 1, tier: 'L1' });
const clone = (): Plan => JSON.parse(JSON.stringify(base));
report(validatePlan(base).ok, 'validate: 导演的方案通过');

const mutations: [string, (p: Plan) => void, RegExp][] = [
  ['没有宪法', (p) => { p.constitution = []; }, /constitution/],
  ['焦点不在元素里', (p) => { p.acts[0]!.focus = 'nope'; }, /focus/],
  ['没有焦点', (p) => { p.acts[0]!.focus = ''; }, /focus/],
  ['一句话超预算', (p) => { p.acts[0]!.lines[0]!.text = '这是一句非常非常非常非常非常非常非常非常非常非常长的话，长得超过了三十个字的上限'; }, /lines\[0\]\.text/],
  ['预算 maxChars 超规格', (p) => { p.acts[0]!.budget.maxChars = 80; }, /budget\.maxChars/],
  ['前 3 秒可做的事 2 个', (p) => { p.acts[0]!.budget.maxActionsFirst3s = 2; }, /maxActionsFirst3s/],
  ['有动作的元素够不到', (p) => { const e = p.acts[0]!.elements.find((x) => x.id === 'ticket')!; e.prominence.folded = true; p.acts[0]!.reveal = p.acts[0]!.reveal.filter((r) => r !== 'ticket'); }, /elements\[/],
  ['元素 id 重复', (p) => { p.acts[0]!.elements.push({ ...p.acts[0]!.elements[0]! }); }, /elements/],
  ['幕 id 重复', (p) => { p.acts[1]!.id = p.acts[0]!.id; }, /\.id/],
];
for (const [name, fn, re] of mutations) {
  const p = clone();
  fn(p);
  const r = validatePlan(p);
  report(!r.ok && r.errors.some((e) => re.test(e.path)), `validate: ${name} -> ${r.ok ? '通过了（不对）' : r.errors.map((e) => e.path).slice(0, 2).join(', ')}`);
}

// ---- bench ----
const cases: { file: string; expect: 'PASS' | 'FAIL' }[] = [
  { file: 'bench/fixtures/good.html', expect: 'PASS' },
  { file: 'bench/fixtures/bad.html', expect: 'FAIL' },
];
for (const c of cases) {
  const r = await runBench(path.join(REPO_ROOT, c.file), { maxSeconds: 60 });
  report(r.verdict === c.expect, `bench: ${c.file} expect ${c.expect} -> ${r.summary}`);
}
console.log(bad === 0 ? 'selftest PASS · 校验器与 bench 都判得出好坏' : `selftest FAIL · ${bad} 个结论不对`);
process.exit(bad === 0 ? 0 : 1);
