// 事件总线与 trace。trace 是结构化日志：每次预测、误差、传递、调度、说话都记一条，
// agent 和 bench 都能读（window.__trace）。只增不改。

export type TraceKind =
  | 'act.enter' | 'act.exit'
  | 'aff.show' | 'aff.hide' | 'aff.hover' | 'aff.click'
  | 'line.say'
  | 'mind.observe' | 'mind.error' | 'mind.layer' | 'mind.update' | 'mind.policy' | 'mind.imagine' | 'mind.seed' | 'mind.sediment'
  | 'world.day' | 'world.event' | 'world.fact' | 'world.unfold' | 'world.mark' | 'world.closing' | 'world.self'
  | 'think.call' | 'think.result'
  | 'tele.dwell' | 'tele.idle'
  | 'director.predict' | 'director.compare'
  | 'desk.revision'
  | 'sense'
  | 'perf'
  | 'error';

export interface TraceEvent {
  /** 自页面加载起的毫秒 */
  t: number;
  kind: TraceKind;
  [k: string]: unknown;
}

type Handler = (payload: any) => void;

export class Bus {
  private handlers = new Map<string, Set<Handler>>();
  readonly trace: TraceEvent[] = [];
  private t0 = performance.now();

  on(topic: string, fn: Handler): () => void {
    let set = this.handlers.get(topic);
    if (!set) this.handlers.set(topic, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  once(topic: string, fn: Handler): () => void {
    const off = this.on(topic, (p) => {
      off();
      fn(p);
    });
    return off;
  }

  /** 等待某个话题，可带过滤条件。 */
  wait<T = any>(topic: string, filter?: (p: T) => boolean): Promise<T> {
    return new Promise((resolve) => {
      const off = this.on(topic, (p: T) => {
        if (!filter || filter(p)) {
          off();
          resolve(p);
        }
      });
    });
  }

  emit(topic: string, payload?: unknown): void {
    const set = this.handlers.get(topic);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[bus] handler for ${topic} failed`, err);
        this.log('error', { topic, message: String((err as Error)?.message ?? err) });
      }
    }
  }

  now(): number {
    return Math.round(performance.now() - this.t0);
  }

  log(kind: TraceKind, data: Record<string, unknown> = {}): TraceEvent {
    const ev: TraceEvent = { t: this.now(), kind, ...data };
    this.trace.push(ev);
    this.emit('trace', ev);
    return ev;
  }

  jsonl(): string {
    return this.trace.map((e) => JSON.stringify(e)).join('\n');
  }
}
