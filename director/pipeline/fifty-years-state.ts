import { createHistory, loadHistory, type HistoryState, type HistoryApi, type HistoryMacro } from '../../engine/history';
import type { Fact, Ending } from '../../engine/types';
import type { ActResult } from '../../app/context';
import type { Store } from '../../engine/store';

export interface LongscrollSave {
  version: 1;
  state: HistoryState;
  ledger: Fact[];
  completed: Record<string, ActResult>;
  decisions: string[];
  ending?: Ending;
}

/** 存档是一整份快照；state 与只增账本始终一起恢复。 */
export function createLongscroll(store: Pick<Store, 'get' | 'set'>) {
  const table = loadHistory();
  const saved = store.get<LongscrollSave | null>('history.save', null);
  let history = createHistory({ events: table.events, startYear: saved?.state.year ?? table.span.from,
    macro: saved?.state.macro ?? table.macro, ledger: saved?.ledger ?? [] });
  const completed = structuredClone(saved?.completed ?? {});
  const decisions = new Set(saved?.decisions ?? []);
  let ending = saved?.ending;
  const persist = () => {
    const save: LongscrollSave = { version: 1, state: history.state(), ledger: history.ledger(), completed, decisions: [...decisions], ...(ending ? { ending } : {}) };
    store.set('history.save', save);
    store.set('history.state', save.state);
    store.set('history.ledger', save.ledger);
  };
  const append = (input: Fact) => {
    const ledger = history.ledger();
    const prior = ledger.find(f => f.id === input.id);
    if (prior) {
      if (JSON.stringify(prior) !== JSON.stringify(input)) throw new Error(`旧事实不许改写：${input.id}`);
      return;
    }
    const state = history.state();
    history = createHistory({ events: table.events, startYear: state.year, macro: state.macro, ledger: [...ledger, structuredClone(input)] });
    persist();
  };
  return {
    get history(): HistoryApi { return history; },
    get ending() { return ending; },
    completed,
    persist,
    append,
    ledger: () => history.ledger(),
    advance(year: number) { const events = history.advanceTo(year); persist(); return events; },
    complete(result: ActResult, nextEnding?: Ending) {
      completed[result.act] = structuredClone(result);
      if (nextEnding) ending = structuredClone(nextEnding);
      persist();
    },
    decide(act: string, by: string, decision: string, delta: Partial<HistoryMacro>) {
      if (decisions.has(act)) return [];
      const before = history.ledger().length;
      history.writeBack({ by, decision, delta });
      decisions.add(act);
      persist();
      return history.ledger().slice(before);
    },
  };
}
export type Longscroll = ReturnType<typeof createLongscroll>;
