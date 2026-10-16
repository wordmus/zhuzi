// 正式产物的整合断言，不制作另一套剧情样本，也不改 runs。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { ActorCue, ActorReport, Commission, DirectorAck, Letter } from '../../engine/layers/types';
import type { TraceEvent } from '../../engine/bus';
import type { LongscrollSave } from '../../director/pipeline/fifty-years-state';

for (const name of ['studio/2/L1', 'fifty-years/3/L1']) {
  const dir = path.resolve('runs', name);
  const read = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const data = read<{ letters: Letter[]; check: string[] }>('layers.json');
  const trace = fs.readFileSync(path.join(dir, 'trace.jsonl'), 'utf8').trim().split('\n').map(s => JSON.parse(s) as TraceEvent);
  assert.deepEqual(data.check, []);
  const l = data.letters;
  const ref = l.find(a => a.kind === 'cue' && a.act === 'studio' && (a.payload as ActorCue).initialState.sourceReport) as Letter<ActorCue>;
  assert(ref, '工作室必须交回本局原件');
  const source = l.find(a => a.id === ref.payload.initialState.sourceReport) as Letter<ActorReport>;
  assert(source && source.t < ref.t);
  const report = l.find(a => a.kind === 'report' && a.act === 'studio' && (a.payload as ActorReport).did.includes(`复核原件：${source.id}`)) as Letter<ActorReport>;
  assert(report);
  assert.equal(report.from, ref.to);
  assert.deepEqual(report.payload.actual, source.payload.actual);
  assert.deepEqual(report.payload.error, source.payload.error);
  assert.deepEqual(report.payload.facts, source.payload.facts);
  assert(ref.receipt && ref.receipt.at <= report.t);
  assert(report.receipt && report.receipt.at >= report.t);
  const commissions = l.filter(a => a.kind === 'commission') as Letter<Commission>[];
  assert.equal(commissions.length, 2);
  assert.deepEqual(commissions[0]!.payload, commissions[1]!.payload);
  const plans = l.filter(a => a.kind === 'plan') as Letter<DirectorAck>[];
  assert.equal(plans.length, 2);
  assert.deepEqual(plans[0]!.payload.acts, plans[1]!.payload.acts);
  const index = (predicate: (event: TraceEvent) => boolean) => trace.findIndex(predicate);
  const received = (id: string) => index(e => String(e.kind) === 'layer.letter' && (e.letter as Letter).id === id && e.phase === 'received');
  const clicked = (id: string) => index(e => e.kind === 'aff.click' && e.id === id);
  assert(clicked('studio-seal') < received(commissions[1]!.id));
  assert(clicked('studio-report') < received(report.id));
  const lines = trace.filter(e => e.kind === 'line.say' && e.act === 'studio');
  assert.equal(lines.length, 3);
  assert(lines.every(e => [...String(e.text)].length <= 18));
  assert(lines.some(e => e.field === 'actual' && e.fullText === source.payload.actual));
  const shots = fs.readdirSync(path.join(dir, 'shots')).filter(f => f.includes('-studio-'));
  assert.equal(shots.length, 4, '四个焦点都要有正式截图');
  if (name.startsWith('fifty-years')) {
    const save = read<LongscrollSave>('history-save.json');
    assert(save.completed.studio);
    assert(save.decisions.includes('studio'));
    assert(save.ledger.some(f => f.id === 'studio.fifty-years.verified'));
  }
  console.log(`PASS ${name}: cue/report 原件一致、落印后真实回执、check=[]、四焦点截图、幕内句子≤18字（加画布姓名最多22字）`);
}
