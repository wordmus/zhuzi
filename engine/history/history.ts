import table from '../../eras/zhanguo/history.json';
import type { Fact } from '../types';
import type { HistoryApi, HistoryEvent, HistoryMacro, HistoryState, HistoryTable } from './types';

const KEYS = ['minxin', 'grain', 'power', 'rites'] as const;
const EVENT_PREFIX = 'history.event.';
const DECISION_PREFIX = 'history.decision.';
const copy = <T>(value: T): T => structuredClone(value);
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function checkYear(year: number): void {
  if (!Number.isSafeInteger(year)) throw new Error('历史年份必须是整数');
}

function checkDelta(delta: Partial<HistoryMacro>, limit = Infinity): void {
  for (const [key, value] of Object.entries(delta)) {
    if (!KEYS.includes(key as keyof HistoryMacro) || typeof value !== 'number'
      || !Number.isFinite(value) || Math.abs(value) > limit) {
      throw new Error(`无效的历史变化：${key}`);
    }
  }
}

function checkEvents(events: HistoryEvent[]): void {
  const ids = new Set<string>();
  for (const e of events) {
    checkYear(e.year);
    if (!e.id || ids.has(e.id)) throw new Error(`历史事件编号重复或为空：${e.id}`);
    ids.add(e.id);
    if (!e.source.title.trim() || [...e.text].length > 30 || [...e.enters.line].length > 18) {
      throw new Error(`历史事件缺少出处或文字过长：${e.id}`);
    }
    if (!['war', 'reform', 'rite', 'scholar', 'omen', 'relief'].includes(e.kind)) {
      throw new Error(`无效的历史事件种类：${e.id}`);
    }
    checkDelta(e.effects, 0.2);
  }
}

function normalize(macro: HistoryMacro): HistoryMacro {
  const out = {} as HistoryMacro;
  for (const key of KEYS) {
    if (!Number.isFinite(macro[key])) throw new Error(`无效的历史宏观量：${key}`);
    out[key] = clamp(macro[key]);
  }
  return out;
}

export function loadHistory(): HistoryTable {
  const result = copy(table) as HistoryTable;
  checkEvents(result.events);
  result.macro = normalize(result.macro);
  return result;
}

export function createHistory(cfg: {
  events: HistoryEvent[];
  startYear: number;
  macro?: HistoryMacro;
  ledger?: Fact[];
}): HistoryApi {
  checkYear(cfg.startYear);
  checkEvents(cfg.events);
  const events = copy(cfg.events).sort((a, b) => a.year - b.year || a.id.localeCompare(b.id, 'en'));
  const facts = copy(cfg.ledger ?? []);
  const factIds = new Set(facts.map(f => f.id));
  if (factIds.size !== facts.length) throw new Error('历史账本编号重复');
  const fired = new Set(events.filter(e => factIds.has(`${EVENT_PREFIX}${e.id}`)).map(e => e.id));
  let year = cfg.startYear;
  let macro = normalize(cfg.macro ?? table.macro);
  let serial = 0;
  // 历史事实的 day 是距整张事件表起点的年数，与《旱》的日历分开。
  const epoch = Math.min(cfg.startYear, events[0]?.year ?? cfg.startYear);
  const state = (): HistoryState => ({ year, fired: [...fired], macro: { ...macro } });
  const apply = (delta: Partial<HistoryMacro>) => {
    for (const key of KEYS) macro[key] = clamp(macro[key] + (delta[key] ?? 0));
  };
  const record = (fact: Fact) => {
    facts.push(fact);
    factIds.add(fact.id);
  };
  const date = (at: number) => at < 0 ? `前${-at}年` : `${at}年`;

  return {
    state,
    events: () => copy(events),
    advanceTo(to) {
      checkYear(to);
      if (to < year) return [];
      const due = events.filter(e => e.year >= year && e.year <= to && !fired.has(e.id));
      for (const e of due) {
        apply(e.effects);
        fired.add(e.id);
        record({ id: `${EVENT_PREFIX}${e.id}`, day: e.year - epoch, kind: 'event', text: `${date(e.year)}·${e.title}：${e.text}` });
      }
      year = to;
      return copy(due);
    },
    enter: e => ({ who: e.enters.who, line: e.enters.line, year: e.year }),
    writeBack(w) {
      const at = w.year ?? year;
      checkYear(at);
      if (at > year || at < epoch) throw new Error('决定年份必须处于已经走过的长卷内');
      if (!w.by.trim() || !w.decision.trim()) throw new Error('决定必须说明由谁做了什么');
      checkDelta(w.delta);
      apply(w.delta);
      let id: string;
      do { id = `${DECISION_PREFIX}${++serial}`; } while (factIds.has(id));
      record({ id, day: at - epoch, kind: 'decision', by: w.by, text: `${date(at)}·${w.by}：${w.decision}` });
      return state();
    },
    ledger: () => copy(facts),
  };
}
