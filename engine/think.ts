// 「真的去想」与「规则」。只有到达心智层的事才交给模型；模型不在、被拒、太慢或被按了「停」，
// 一律用本地规则答，并如实标明来源与原因（策划文档第 20 节「回退」）。
//
// 模型通道：发布成 Artifact 后，通过 claude.use('sample') 用观看者自己的 Claude。
// 授权弹窗只允许由玩家的明确动作触发（比如他亲手写下一句话），绝不在峰值时刻弹出。

import type { Bus } from './bus';

export type ThinkSource = 'model' | 'rules';
export type ThinkAvailability = 'model' | 'ask' | 'rules';

export interface ThinkTask<T> {
  /** 'translate-thought' | 'tianbo-line' | 'mentor-line' ... 写进 trace */
  kind: string;
  /** 完整的指令 + 数据 + 输出格式（模型无记忆，只看这一段） */
  prompt: string;
  /** 用 sample.json 取结构化结果 */
  json?: boolean;
  /** 本地规则：永远可用，也是回退 */
  rules: () => T;
  /** 把模型的原始输出收成 T；返回 null 表示不可用 → 回退规则 */
  coerce?: (raw: unknown) => T | null;
  /** 玩家的明确动作触发的调用，才允许弹出授权 */
  explicit?: boolean;
  tier?: 'quick' | 'default';
  signal?: AbortSignal;
  onText?: (text: string) => void;
}

export interface ThinkResult<T> {
  value: T;
  source: ThinkSource;
  ms: number;
  /** 为什么用了规则：no-runtime / not-asked / not_granted / slow / stopped / invalid / <error code> */
  why?: string;
}

export interface Think {
  availability(): Promise<ThinkAvailability>;
  ask<T>(task: ThinkTask<T>): Promise<ThinkResult<T>>;
  /** 截止时间前模型没回来就用规则（并停掉模型，免得白花观看者的额度） */
  race<T>(task: ThinkTask<T>, deadlineMs: number): Promise<ThinkResult<T>>;
  /** 演示面板上的「停」：之后全部走规则 */
  setStopped(stopped: boolean): void;
  stopped(): boolean;
  stats(): { model: number; rules: number; lastWhy?: string };
}

type SampleFn = ((input: unknown, opts?: Record<string, unknown>) => Promise<{ text: string }>) & {
  json?: (input: unknown, opts?: Record<string, unknown>) => Promise<unknown>;
};

const PERMANENT = new Set([
  'not_granted',
  'sampling_disabled',
  'not_declared',
  'capability_disabled',
  'capability_removed',
  'session_expired',
]);

export function createThink(bus: Bus): Think {
  let sampleP: Promise<SampleFn | null> | null = null;
  let permsP: Promise<any | null> | null = null;
  let dead = false;
  let stoppedFlag = false;
  let modelCount = 0;
  let rulesCount = 0;
  let lastWhy: string | undefined;

  const claude = (globalThis as any).claude;
  if (claude && typeof claude.use === 'function') {
    sampleP = Promise.resolve(claude.use('sample')).catch(() => null);
    permsP = Promise.resolve(claude.use('permissions')).catch(() => null);
  }

  async function availability(): Promise<ThinkAvailability> {
    if (dead || stoppedFlag || !sampleP) return 'rules';
    const sample = await sampleP;
    if (!sample) return 'rules';
    const perms = await permsP;
    if (!perms) return 'ask';
    try {
      const st = await perms.state('sample');
      if (st === 'granted') return 'model';
      if (st === 'prompt') return 'ask';
      return 'rules';
    } catch {
      return 'ask';
    }
  }

  function fallback<T>(task: ThinkTask<T>, t0: number, why: string): ThinkResult<T> {
    rulesCount++;
    lastWhy = why;
    const value = task.rules();
    const ms = Math.round(performance.now() - t0);
    bus.log('think.result', { kind: task.kind, source: 'rules', ms, why });
    return { value, source: 'rules', ms, why };
  }

  async function ask<T>(task: ThinkTask<T>): Promise<ThinkResult<T>> {
    const t0 = performance.now();
    if (stoppedFlag) return fallback(task, t0, 'stopped');
    const avail = await availability();
    if (avail === 'rules') return fallback(task, t0, dead ? 'unavailable' : sampleP ? 'unavailable' : 'no-runtime');
    if (avail === 'ask' && !task.explicit) return fallback(task, t0, 'not-asked');
    const sample = (await sampleP)!;
    bus.log('think.call', { kind: task.kind, tier: task.tier ?? 'quick', chars: task.prompt.length });
    try {
      const opts: Record<string, unknown> = { modelTier: task.tier ?? 'quick' };
      if (task.signal) opts.signal = task.signal;
      if (task.onText) opts.onText = ({ text }: { text: string }) => task.onText!(text);
      let raw: unknown;
      if (task.json && typeof sample.json === 'function') raw = await sample.json(task.prompt, opts);
      else raw = (await sample(task.prompt, opts)).text;
      const value = task.coerce ? task.coerce(raw) : (raw as T);
      if (value == null) return fallback(task, t0, 'invalid');
      modelCount++;
      const ms = Math.round(performance.now() - t0);
      bus.log('think.result', { kind: task.kind, source: 'model', ms });
      return { value, source: 'model', ms };
    } catch (e: any) {
      const code = String(e?.code ?? 'upstream_error');
      if (PERMANENT.has(code)) dead = true;
      return fallback(task, t0, code === 'cancelled' ? 'stopped' : code);
    }
  }

  async function race<T>(task: ThinkTask<T>, deadlineMs: number): Promise<ThinkResult<T>> {
    const t0 = performance.now();
    const ctl = new AbortController();
    if (task.signal) task.signal.addEventListener('abort', () => ctl.abort(), { once: true });
    let settled = false;
    return new Promise<ThinkResult<T>>((resolve) => {
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        ctl.abort();
        resolve(fallback(task, t0, 'slow'));
      }, deadlineMs);
      ask({ ...task, signal: ctl.signal }).then((r) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(r);
      });
    });
  }

  return {
    availability,
    ask,
    race,
    setStopped(s) {
      stoppedFlag = s;
      bus.log('think.result', { kind: 'control', source: 'rules', why: s ? 'stopped' : 'resumed', ms: 0 });
    },
    stopped: () => stoppedFlag,
    stats: () => ({ model: modelCount, rules: rulesCount, lastWhy }),
  };
}

/** 话旁的来源标记文本：「规则」或「真的去想 · 1.4 秒」 */
export function sourceTag(r: { source: ThinkSource; ms: number; why?: string }): string {
  if (r.source === 'model') return `真的去想 · ${(r.ms / 1000).toFixed(1)} 秒`;
  const why: Record<string, string> = {
    'no-runtime': '不在线上，用本地规则',
    'not-asked': '未请你授权，用本地规则',
    not_granted: '你没有授权，用本地规则',
    unavailable: '模型不可用，用本地规则',
    slow: '模型太慢，用本地规则',
    stopped: '已按「停」，用本地规则',
    invalid: '模型答非所问，用本地规则',
    rate_limited: '调用太频繁，用本地规则',
  };
  return `规则${r.why && why[r.why] ? ' · ' + why[r.why] : ''}`;
}
