import type { Bus, TraceKind } from '../bus';
import type { Plan, PlanAct } from '../types';
import { presenceFor } from '../../frameworks/desk/presence-letter';
import type { ActorCue, ActorReport, DirectorAck, Letter, LetterKind, Presence } from './types';

export const LETTER_KINDS: readonly LetterKind[] = ['commission', 'plan', 'cue', 'report', 'retro', 'presence'];

export function letterCounts(letters: Letter[]): Record<LetterKind, number> {
  return Object.fromEntries(LETTER_KINDS.map(kind => [kind, letters.filter(l => l.kind === kind).length])) as Record<LetterKind, number>;
}

/** 同一判定供运行时与 bench 使用；expectedActs 来自真实方案，不能拿来信自证。 */
export function checkLayerLetters(letters: Letter[], expectedActs: string[]): string[] {
  const errors: string[] = [];
  const issue = (text: string) => errors.push(text);
  const actualActs = new Set(expectedActs);
  // 旧档案的五类契约不变；出现呈现信的新档案须逐幕完整。
  for (const kind of LETTER_KINDS.filter(k => k !== 'presence')) if (!letters.some(l => l.kind === kind)) issue(`缺少 ${kind} 信`);
  const ids = new Set<string>();
  for (const [i, l] of letters.entries()) {
    if (ids.has(l.id)) issue(`信件编号重复：${l.id}`);
    ids.add(l.id);
    if (!LETTER_KINDS.includes(l.kind)) issue(`未知信件：${l.id}`);
    if (!Number.isFinite(l.t) || (i > 0 && l.t < letters[i - 1]!.t)) issue(`信件时序错误：${l.id}`);
    if (!l.receipt || l.receipt.by !== l.to || !Number.isFinite(l.receipt.at) || l.receipt.at < l.t) issue(`回执不完整：${l.id}`);
    if (l.act !== undefined && !actualActs.has(l.act)) issue(`幕不存在：${l.act}`);
    if (['commission', 'plan', 'retro'].includes(l.kind) && l.act !== undefined) issue(`整场信件不应属于某幕：${l.id}`);
    if ((l.kind === 'cue' || l.kind === 'report') && (!l.act || (l.payload as ActorCue).act !== l.act)) issue(`幕引用不一致：${l.id}`);
    const route = l.kind === 'commission' ? ['mentor', 'director'] : l.kind === 'plan' || l.kind === 'retro' ? ['director', 'mentor'] : null;
    if (route && (l.from !== route[0] || l.to !== route[1])) issue(`收发层不正确：${l.id}`);
    if (l.kind === 'presence') {
      if (l.from !== 'presentation' || l.to !== 'director') issue(`呈现信收发层不正确：${l.id}`);
      if (!l.act) issue(`呈现信没有幕：${l.id}`);
      const p = l.payload as Presence;
      if (!p?.shape || !p.cost || !p.sentence) issue(`呈现信内容不完整：${l.id}`);
      if ([...String(p?.sentence ?? '')].length > 18 || /[0-9０-９]|shape|withheld|cost|sentence|framework|focus/i.test(p?.sentence ?? '')) issue(`呈现信不是短自述：${l.id}`);
    }
    if (l.kind === 'cue') {
      const cue = l.payload as ActorCue;
      if (l.from !== 'director' || l.to !== cue.who) issue(`提示收件人不正确：${l.id}`);
      const report = letters.find((r, n) => n > i && r.kind === 'report' && r.act === l.act && r.from === l.to && (r.payload as ActorReport).who === l.to);
      if (!report) issue(`提示没有同演员同幕的报告：${l.id}`);
      else if (l.receipt && l.receipt.at > report.t) issue(`演员报告前未处理提示：${l.id}`);
    }
    if (l.kind === 'report') {
      if (l.to !== 'director' || l.from !== (l.payload as ActorReport).who) issue(`报告收发人不正确：${l.id}`);
      if (!letters.slice(0, i).some(c => c.kind === 'cue' && c.act === l.act && c.to === l.from)) issue(`报告没有对应提示：${l.id}`);
    }
  }
  const commissionAt = letters.findIndex(l => l.kind === 'commission');
  const plans = letters.filter(l => l.kind === 'plan');
  for (const p of plans) {
    if (commissionAt < 0 || letters.indexOf(p) <= commissionAt) issue('方案早于委托');
    const commission = letters[commissionAt];
    if (commission?.receipt && commission.receipt.at > p.t) issue('回复方案时尚未处理委托');
    const ack = p.payload as DirectorAck;
    const covered = new Set(ack.acts?.map(a => a.id) ?? []);
    for (const id of actualActs) if (!covered.has(id)) issue(`方案没有覆盖幕：${id}`);
    for (const id of covered) if (!actualActs.has(id)) issue(`方案引用不存在的幕：${id}`);
    for (const r of ack.rehearsal ?? []) if (!actualActs.has(r.act)) issue(`预演引用不存在的幕：${r.act}`);
  }
  for (const id of actualActs) if (!letters.some(l => l.kind === 'cue' && l.act === id)) issue(`幕没有演员提示：${id}`);
  if (letters.some(l => l.kind === 'presence')) for (const id of actualActs) {
    if (letters.filter(l => l.kind === 'presence' && l.act === id).length !== 1) issue(`幕须恰有一封呈现信：${id}`);
  }
  const firstPlanAt = letters.findIndex(l => l.kind === 'plan');
  for (const [i, l] of letters.entries()) {
    if (l.kind === 'cue' && (firstPlanAt < 0 || i < firstPlanAt)) issue(`提示早于方案：${l.id}`);
    if (l.kind === 'retro' && letters.slice(i + 1).some(r => r.kind === 'report')) issue('回顾早于演员报告');
    if (l.kind === 'retro' && letters.some(r => r.kind === 'report' && r.receipt && r.receipt.at > l.t)) issue('回顾前尚未处理全部报告');
  }
  return [...new Set(errors)];
}

/** trace 里的发送和回执是两个快照，按 id 合并，保留最后一次。 */
export function lettersFromTrace(trace: { kind: string; [key: string]: unknown }[]): Letter[] {
  const letters = new Map<string, Letter>();
  for (const e of trace) {
    if (e.kind !== 'layer.letter') continue;
    const l = e.letter as Letter | undefined;
    if (l?.id) letters.set(l.id, l);
  }
  return [...letters.values()];
}

export function createLayerBus(bus: Bus, clock: () => { t: number; day?: number } = () => ({ t: performance.now() })) {
  const queue: Letter[] = [];
  const serial = new Map<string, number>();
  let expectedActs: string[] = [];
  let presenceActs: PlanAct[] = [];
  const snapshot = <T>(value: T): T => structuredClone(value);
  const log = (letter: Letter, phase: string) => {
    // TraceKind 在总线的独占文件中；此扩展只在本模块声明，不改其他工人的接口。
    bus.log('layer.letter' as TraceKind, { phase, letter: snapshot(letter) });
  };
  const api = {
    usePlan(plan: Pick<Plan, 'acts'>) { expectedActs = plan.acts.map(a => a.id); presenceActs = plan.acts; },
    present(act: string): Letter<Presence> {
      const previous = queue.find(l => l.kind === 'presence' && l.act === act);
      if (previous) return snapshot(previous as Letter<Presence>);
      const planAct = presenceActs.find(a => a.id === act);
      if (!planAct) throw new Error(`呈现信没有方案：${act}`);
      const enter = bus.trace.findLastIndex(e => e.kind === 'act.enter' && e.act === act);
      const payload = presenceFor(planAct, bus.trace.slice(Math.max(0, enter)));
      const letter = api.send({ kind: 'presence', from: 'presentation', to: 'director', act, payload });
      // 呈现交回导演时即读入；不改动任一旧信的回执。
      return api.receive(letter.id, 'director') as Letter<Presence>;
    },
    send<T>(input: { kind: LetterKind; from: string; to: string; act?: string; payload: T }): Letter<T> {
      const key = `${input.kind}:${input.act ?? 'visit'}`;
      const n = (serial.get(key) ?? 0) + 1;
      serial.set(key, n);
      const letter: Letter<T> = { ...snapshot(input), id: `${key}:${n}`, ...clock() };
      queue.push(letter);
      log(letter, 'sent');
      return snapshot(letter);
    },
    receive(id: string, by: string): Letter {
      const letter = queue.find(l => l.id === id);
      if (!letter) throw new Error(`没有这封信：${id}`);
      if (letter.to !== by) throw new Error(`收信人不符：${id}`);
      if (!letter.receipt) {
        letter.receipt = { at: clock().t, by };
        log(letter, 'received');
      }
      return snapshot(letter);
    },
    letters: () => snapshot(queue),
    byAct: (act: string) => snapshot(queue.filter(l => l.act === act)),
    pending: () => snapshot(queue.filter(l => !l.receipt)),
    check: () => checkLayerLetters(queue, expectedActs),
  };
  // act.exit 是真实演完的记录；从此处新增呈现回路，不移动旧五类信。
  bus.on('trace', e => {
    if (e.kind === 'act.exit' && presenceActs.some(a => a.id === e.act)) api.present(String(e.act));
  });
  return api;
}

export type LayerBus = ReturnType<typeof createLayerBus>;
