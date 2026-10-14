// 记忆：痕迹—激活—巩固。
// S = exp(−λ·age)，λ = λ0·(1 − ρ·C)；摆到眼前一次：C ← C + η(1 − C)，年龄从这一刻重算。
// 衰减一直在，巩固过的更耐久。

import type { MemoryParams, Trace } from './types';

export const DEFAULT_MEMORY: MemoryParams = { lambda0: 0.22, rho: 0.85, eta: 0.3 };

export function strengthOf(tr: Trace, now: number, p: MemoryParams = DEFAULT_MEMORY): number {
  const age = Math.max(0, now - tr.touched);
  const lambda = p.lambda0 * (1 - p.rho * tr.C);
  return Math.exp(-lambda * age);
}

export function rehearseTrace(tr: Trace, now: number, p: MemoryParams = DEFAULT_MEMORY): Trace {
  tr.C = tr.C + p.eta * (1 - tr.C);
  tr.rehearsals += 1;
  tr.touched = now;
  return tr;
}

export interface Memory {
  add(init: { key?: string; text: string; tag: Trace['tag']; kind: string; data?: Record<string, unknown> }, now: number): Trace;
  get(id: string): Trace | undefined;
  byKey(key: string): Trace | undefined;
  all(): Trace[];
  strength(id: string, now: number): number;
  rehearse(id: string, now: number): Trace | null;
}

export function createMemory(prefix: string, p: MemoryParams = DEFAULT_MEMORY): Memory {
  const traces = new Map<string, Trace>();
  const keys = new Map<string, string>();
  let n = 0;
  return {
    add(init, now) {
      const id = `${prefix}.m${++n}`;
      // 亲见的比想象的牢一点
      const tr: Trace = {
        id,
        key: init.key ?? id,
        text: init.text,
        tag: init.tag,
        kind: init.kind,
        born: now,
        touched: now,
        C: init.tag === 'observed' ? 0.2 : 0,
        rehearsals: 0,
        data: init.data,
      };
      traces.set(id, tr);
      keys.set(tr.key, id);
      return tr;
    },
    get: (id) => traces.get(id),
    byKey: (key) => {
      const id = keys.get(key);
      return id ? traces.get(id) : undefined;
    },
    all: () => [...traces.values()],
    strength(id, now) {
      const tr = traces.get(id);
      return tr ? strengthOf(tr, now, p) : 0;
    },
    rehearse(id, now) {
      const tr = traces.get(id);
      return tr ? rehearseTrace(tr, now, p) : null;
    },
  };
}
