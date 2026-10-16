import type { ActResult } from '../../app/context';
import type { TraceEvent } from '../bus';
import type { Plan, PlanAct } from '../types';
import type { ActorCue, ActorReport } from './types';
import { actorVoice } from './voice';

export function factsIn(values: unknown[]): ActorReport['facts'] {
  const found = new Map<string, ActorReport['facts'][number]>();
  for (const value of values) {
    if (!value || typeof value !== 'object') continue;
    const f = value as Record<string, unknown>;
    if (typeof f.id === 'string' && typeof f.text === 'string') found.set(f.id, { id: f.id, text: f.text, kind: String(f.kind ?? 'event') });
  }
  return [...found.values()];
}

/** 只归纳已经发生的轨迹；没有行动证据就明说，不拿导演的期待冒充行动。 */
export function actorReport(plan: Plan, act: PlanAct, cue: ActorCue, result: ActResult, trace: TraceEvent[], ms: number): ActorReport {
  const person = plan.world.people.find(p => p.name === cue.who);
  const isActor = (value: unknown) => value === cue.who || (person !== undefined && value === person.id);
  const owns = (event: TraceEvent) => isActor(event.who) || isActor(event.actor) || isActor(event.by) || isActor(event.mind);
  // 新增的报告朗读不能反过来充作本幕原有行动证据。
  const mine = trace.filter(e => owns(e) && !e.actorVoice && e.why !== 'actor-report');
  const sceneFacts = trace.filter(e => e.kind === 'world.fact').map(e => e.fact);
  const supplied = Array.isArray(result.data?.facts) ? result.data.facts : [];
  const facts = factsIn([...sceneFacts, ...supplied]);
  const said = mine.filter(e => e.kind === 'line.say').map(e => `说：${String(e.text)}`);
  const actions = mine.filter(e => e.kind === 'world.event' || e.kind === 'world.self').map(e => String(e.note ?? e.pose ?? e.eventKind ?? '依世界状态行动'));
  const ownFacts = sceneFacts.filter(f => f && typeof f === 'object' && isActor((f as Record<string, unknown>).by));
  const mindActions = mine.filter(e => e.kind.startsWith('mind.') && e.audit).map(e => {
    const audit = e.audit as Record<string, unknown>;
    return String(audit.note ?? `在${String(audit.level)}层处理${String(audit.unit ?? '观测')}`);
  });
  const did = [...new Set([...mindActions, ...factsIn(ownFacts).map(f => f.text), ...said, ...actions])].slice(-3);
  if (!did.length) did.push('本幕未留下可归属于自己的行动记录');
  did.unshift(`处理本幕提示；观察到${facts.length}条交付事实`);
  const err = [...trace].reverse().find(e => e.kind === 'mind.error' && (owns(e) || (e.who === undefined && !e.mind && cue.who === '禾')) && ('predicted' in e || 'actual' in e));
  const auditError = [...mine].reverse().find(e => e.kind === 'mind.error' && e.audit);
  const errorData = (err ?? auditError?.audit) as Record<string, unknown> | undefined;
  const layer = errorData?.layer ?? errorData?.level;
  const responses: Record<string, string> = { give: '给粟', lend: '借粟', 'buy-land': '买地', refuse: '拒绝' };
  const describe = (value: unknown) => responses[String(value)] ?? String(value);
  const compared = errorData?.predicted !== undefined || errorData?.pred !== undefined
    ? `预演：${describe(errorData.predicted ?? errorData.pred)}；实际：${describe(errorData.actual ?? errorData.obs)}`
    : String(errorData?.note ?? '观测误差传到心智层');
  const error: ActorReport['error'] = errorData ? {
    layer: layer === 'unit' || layer === 'module' || layer === 'mind' ? layer : 'mind',
    unit: typeof errorData.unit === 'string' ? errorData.unit : undefined,
    e: typeof errorData.e === 'number' ? errorData.e : undefined, eps: typeof errorData.eps === 'number' ? errorData.eps : undefined,
    note: compared,
  } : undefined;
  const seeds = mine.filter(e => e.kind === 'mind.seed').map(e => {
    const seed = (e.seed && typeof e.seed === 'object' ? e.seed : e) as Record<string, unknown>;
    return { id: String(seed.id ?? e.unit ?? '未编号'), concept: String(seed.concept ?? e.note ?? ''), ...(typeof seed.blockedBy === 'string' ? { blockedBy: seed.blockedBy } : {}) };
  });
  const actual = error?.note ?? facts.at(-1)?.text ?? said.at(-1) ?? `本幕已结束；${trace.filter(e => e.kind === 'aff.click').length}次动手，未新增世界事实`;
  const report: ActorReport = { act: act.id, who: cue.who, did, predicted: cue.expects, actual, ...(error ? { error } : {}), facts, ...(seeds.length ? { seeds } : {}), ms: Math.round(ms) };
  report.voice = actorVoice(report);
  return report;
}
