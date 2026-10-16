// 新 run 的声音与正式信件逐句核对；不重写产物。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { ActorReport, Letter } from '../../engine/layers/types';
import { checkLayerLetters } from '../../engine/layers/bus';
import { actorVoice } from '../../engine/layers/voice';
for (const run of ['studio/7/L1', 'fifty-years/11/L1']) {
  const dir = `runs/${run}`;
  const layers = JSON.parse(fs.readFileSync(`${dir}/layers.json`, 'utf8'));
  const trace = fs.readFileSync(`${dir}/trace.jsonl`, 'utf8').trim().split('\n').map(s => JSON.parse(s));
  assert.deepEqual(layers.check, []);
  const reports = (layers.letters as Letter<ActorReport>[]).filter(l => l.kind === 'report');
  for (const { payload: report } of reports) {
    assert(report.voice && report.voice.length >= 2 && report.voice.length <= 3);
    for (const line of report.voice) { assert([...line].length <= 18); assert(!/茶|米|百分比|数字|[0-9０-９%％]/u.test(line)); }
    if (report.did.includes('本幕未留下可归属于自己的行动记录')) assert.match(report.voice[0]!, /没动手/);
  }
  const spoken = trace.filter(e => e.kind === 'line.say' && e.actorVoice);
  const reviewed = reports.find(l => l.act === 'studio' && l.payload.did.some(s => s.startsWith('复核原件：')))!;
  assert(reviewed);
  const sourceId = reviewed.payload.did.find(s => s.startsWith('复核原件：'))!.slice('复核原件：'.length);
  const source = reports.find(l => l.id === sourceId)!;
  assert(source);
  assert.deepEqual(reviewed.payload.actual, source.payload.actual);
  assert.deepEqual(reviewed.payload.error, source.payload.error);
  assert.deepEqual(reviewed.payload.facts, source.payload.facts);
  assert.deepEqual(reviewed.payload.predicted, source.payload.predicted);
  const compared = trace.find(e => e.kind === 'director.compare' && e.act === 'studio');
  assert.equal(compared.sourceReport, source.id);
  assert.equal(compared.actual, source.payload.actual);
  assert.deepEqual(compared.error, source.payload.error ?? null);
  assert.deepEqual(spoken.map(e => e.text), reviewed.payload.voice);
  assert(spoken.every(e => e.letter === reviewed.id));
  const receive = trace.find(e => e.kind === 'layer.letter' && e.phase === 'received' && e.letter.id === reviewed.id);
  assert(receive.t <= spoken[0].t);
  for (const report of reports.filter(l => l.act?.startsWith('chronicle'))) {
    const span = trace.slice(trace.findIndex(e => e.kind === 'act.enter' && e.act === report.act), trace.findIndex(e => e.kind === 'act.exit' && e.act === report.act));
    const lines = span.filter(e => e.kind === 'line.say' && e.why === 'actor-report');
    assert.equal(lines.length, 1);
    assert.equal(lines[0].text, report.payload.voice![0]);
    assert.deepEqual(report.payload.voice, actorVoice(report.payload));
  }
  console.log(`PASS ${run}: ${reports.length} 份声音，竹简逐句=${spoken.length}，长卷仅首句，原件实际/误差/事实与导演对比不变，回执顺序不变，layers=[]`);
}

const emptyLetters = JSON.parse(fs.readFileSync('runs/studio/7/L1/voice-evidence/no-action.layers.json', 'utf8')) as Letter<ActorReport>[];
assert.deepEqual(checkLayerLetters(emptyLetters, ['studio']), []);
const emptyReport = emptyLetters.find(l => l.kind === 'report')!.payload;
assert.match(emptyReport.voice![0]!, /没动手/);
assert.equal(emptyReport.facts.length, 0);
assert(emptyReport.did.every(s => s.endsWith('已接收提示信') || s.startsWith('复核原件：')));
console.log('PASS 无旧演出工作室：五种真实信件均回执，只有收件和复核记录，首句明说没动手');
