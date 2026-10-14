// 可审计的有限状态心智（note 6 定稿）。单元 → 模块 → 心智。
//
// 误差 e = obs − pred，eps = π·e。|eps| ≤ 本层阈值（由性情的耐性决定）就地消化，否则残差往上传。
// 四类操作分开：infer 只改状态 / learn 只改参数 / select 只选策略（信息增益与偏好分记）/ act 唯一改世界。
// 每次都写一条审计日志。无随机、无真实时钟：同样的调用序列得到同样的日志。

import type { Layer, Weights } from '../types';
import { TRAITS } from '../types';
import { DEFAULT_MEMORY, createMemory, rehearseTrace } from './memory';
import type {
  ActOpts, AuditEntry, Candidate, Habit, Imagined, ImagineReq, Mind, MindParams, MindSpec,
  ParamChange, Propagation, Ranked, SelectOpts, Selection, Trace,
} from './types';

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const EVEN: Weights = { qing: 1 / 3, li: 1 / 3, ming: 1 / 3 };

/** 每层能就地消化多少，由耐性决定：耐性高的人，更多事停在下层 */
export function thresholds(patience: number) {
  return { unit: 0.12 + 0.3 * patience, module: 0.28 + 0.4 * patience };
}

export function normalizeWeights(w: Weights, floor = 0.03): Weights {
  const raw = TRAITS.map((t) => Math.max(floor, w[t]));
  const s = raw.reduce((a, b) => a + b, 0);
  return { qing: raw[0]! / s, li: raw[1]! / s, ming: raw[2]! / s };
}

interface UnitState { id: string; module: string; pred: number; pi: number; lr: number }
interface ModuleState { id: string; pred: number; pi: number; lr: number }

const LAYER_ORDER: Layer[] = ['unit', 'module', 'mind'];

export function createMind(spec: MindSpec, shared: { seq: number } = { seq: 0 }): Mind {
  const params: MindParams = {
    temperament: { ...spec.temperament },
    weights: { ...(spec.weights ?? EVEN) },
    belief: { ...(spec.belief ?? EVEN) },
    infoWeight: spec.infoWeight ?? 0.5,
  };
  const units = new Map<string, UnitState>();
  const modules = new Map<string, ModuleState>();
  for (const m of spec.modules ?? []) modules.set(m.id, { id: m.id, pred: 0, pi: m.pi ?? 1, lr: m.lr ?? 0.4 });
  for (const u of spec.units ?? []) {
    if (!modules.has(u.module)) modules.set(u.module, { id: u.module, pred: 0, pi: 1, lr: 0.4 });
    units.set(u.id, { id: u.id, module: u.module, pred: u.pred ?? 0, pi: u.pi ?? 1, lr: u.lr ?? 0.6 });
  }
  const latent = new Map<string, number | string>();
  const audit: AuditEntry[] = [];
  const memory = createMemory(spec.id, DEFAULT_MEMORY);
  const habits = new Map<string, Habit>();
  const lampV: Record<Layer, number> = { unit: 0, module: 0, mind: 0 };
  const stopN: Record<Layer, number> = { unit: 0, module: 0, mind: 0 };
  let clock = 0;
  let lastLayer: Layer | null = null;

  function log(e: Omit<AuditEntry, 'seq' | 't' | 'mind'>): AuditEntry {
    const entry: AuditEntry = { seq: ++shared.seq, t: clock, mind: spec.id, ...e };
    audit.push(entry);
    return entry;
  }

  /** 事情停在某层：该层的灯亮 */
  function stop(layer: Layer, unit: string, module: string, e: number, eps: number, cause: string): Propagation {
    lampV[layer] = 1;
    stopN[layer]++;
    lastLayer = layer;
    return { layer, unit, module, e: r3(e), eps: r3(eps), cause };
  }

  const mind: Mind = {
    id: spec.id,
    params,
    audit,
    get lastLayer() {
      return lastLayer;
    },
    now: () => clock,
    tick(t) {
      if (t > clock) {
        const f = Math.pow(0.5, t - clock);
        for (const l of LAYER_ORDER) lampV[l] *= f;
        clock = t;
      }
    },
    thresholds: () => thresholds(params.temperament.patience),

    // ---- infer：观测逐层上传，只改状态 ----
    sense(unitId, obs, cause = '') {
      const u = units.get(unitId);
      if (!u) throw new Error(`mind ${spec.id}: 没有这个单元 ${unitId}`);
      const m = modules.get(u.module)!;
      const thr = thresholds(params.temperament.patience);
      const e = obs - u.pred;
      const eps = u.pi * e;
      const predBefore = u.pred;
      u.pred += u.lr * e; // 单元自己的适应：同一件事再来，就不那么意外
      const base = { unit: u.id, obs: r3(obs), pred: r3(predBefore), e: r3(e), pi: u.pi, eps: r3(eps), note: cause };
      if (Math.abs(eps) <= thr.unit) {
        log({ level: 'unit', op: 'infer', ...base, route: 'absorbed' });
        return stop('unit', u.id, m.id, e, eps, cause);
      }
      log({ level: 'unit', op: 'infer', ...base, route: 'up' });
      // 模块：只看单元交上来的残差，不知道是哪一路在响
      const em = eps - m.pred;
      const epsM = m.pi * em;
      const mBefore = m.pred;
      m.pred += m.lr * em;
      const mBase = { unit: m.id, obs: r3(eps), pred: r3(mBefore), e: r3(em), pi: m.pi, eps: r3(epsM), note: cause };
      if (Math.abs(epsM) <= thr.module) {
        log({ level: 'module', op: 'infer', ...mBase, route: 'absorbed' });
        return stop('module', u.id, m.id, em, epsM, cause);
      }
      log({ level: 'module', op: 'infer', ...mBase, route: 'up' });
      // 心智：只知道「这是一件什么事」，不记是哪个单元
      latent.set('event', cause);
      log({ level: 'mind', op: 'infer', obs: r3(epsM), e: r3(epsM), pi: 1, eps: r3(epsM), route: 'top', note: cause });
      return stop('mind', u.id, m.id, em, epsM, cause);
    },

    infer(key, value, note) {
      const u = units.get(key);
      const prev = u ? u.pred : latent.get(key);
      if (u && typeof value === 'number') u.pred = value;
      else latent.set(key, value);
      log({
        level: u ? 'unit' : 'mind', op: 'infer', unit: key, obs: typeof value === 'number' ? r3(value) : value,
        pred: typeof prev === 'number' ? r3(prev) : prev, route: 'set', note,
      });
    },

    // ---- learn：只改参数 ----
    learn(change: ParamChange, cause = '') {
      if (change.kind === 'belief' || change.kind === 'belief-set') {
        const before = { ...params.belief };
        const raw: Weights =
          change.kind === 'belief'
            ? {
                qing: before.qing + change.rate * (change.target.qing - before.qing),
                li: before.li + change.rate * (change.target.li - before.li),
                ming: before.ming + change.rate * (change.target.ming - before.ming),
              }
            : change.value;
        params.belief = normalizeWeights(raw);
        log({
          level: 'mind', op: 'learn', route: change.kind === 'belief' ? 'toward-truth' : 'set', note: cause,
          data: { param: 'belief', before: roundW(before), after: roundW(params.belief), rate: change.kind === 'belief' ? change.rate : undefined },
        });
        return { before, after: { ...params.belief } };
      }
      if (change.kind === 'precision') {
        const u = units.get(change.unit);
        if (!u) return null;
        const prev = u.pi;
        u.pi = clamp(change.pi, 0.05, 3);
        log({ level: 'unit', op: 'learn', unit: u.id, route: 'set', note: cause, data: { param: 'pi', before: prev, after: u.pi } });
        return null;
      }
      const prev = params.temperament.patience;
      params.temperament.patience = clamp(change.value);
      log({ level: 'mind', op: 'learn', route: 'set', note: cause, data: { param: 'patience', before: prev, after: params.temperament.patience } });
      return null;
    },

    // ---- select：只选策略，信息增益与偏好分开记 ----
    select(cands: Candidate[], opts: SelectOpts = {}): Selection {
      const w = opts.weight ?? params.infoWeight;
      const ranked: Ranked[] = cands
        .map((c, i) => ({ c, i, ig: c.infoGain ?? 0 }))
        .map(({ c, i, ig }) => ({ ...c, infoGain: ig, G: c.preference + w * ig, _i: i }))
        .sort((a, b) => b.G - a.G || a._i - b._i)
        .map(({ _i, ...r }) => r);
      const picked = opts.pick ? ranked.find((r) => r.id === opts.pick) : undefined;
      const chosen = picked ?? ranked[0]!;
      log({
        level: opts.level ?? 'mind', op: 'select', route: picked ? 'suggested' : 'argmax', note: opts.why,
        data: {
          chosen: chosen.id, preference: r3(chosen.preference), infoGain: r3(chosen.infoGain), G: r3(chosen.G),
          ranking: ranked.slice(0, 4).map((r) => ({ id: r.id, preference: r3(r.preference), infoGain: r3(r.infoGain), G: r3(r.G) })),
        },
      });
      return { chosen, ranked };
    },

    // ---- act：唯一改世界的操作 ----
    act<T>(name: string, effect: () => T, opts: ActOpts = {}): T {
      log({ level: opts.level ?? 'mind', op: 'act', route: opts.route ?? 'done', note: name, data: opts.data });
      return effect();
    },

    // ---- 设想：同一结构，换上对方的参数 ----
    imagine<S>(req: ImagineReq<S>): Imagined {
      const twin = createMind({
        id: `${spec.id}~${req.other}`, temperament: req.otherTemperament ?? params.temperament, weights: req.params, infoWeight: 0,
      });
      twin.tick(clock);
      const { chosen, ranked } = twin.select(req.model(req.params, req.scenario), { level: 'mind' });
      const margin = chosen.G - (ranked[1]?.G ?? chosen.G - 0.3);
      // 亲见过几次、记得多牢，信心就多一点
      const seen = memory.all().filter((t) => t.tag === 'observed' && t.kind === req.other);
      const experience = seen.reduce((mx, t) => Math.max(mx, memory.strength(t.id, clock)), 0);
      const confidence = r3(clamp(0.2 + 0.5 * clamp(margin / 0.35) + 0.3 * experience));
      let trace: Trace | null = null;
      if (!req.silent) {
        const key = `imagine:${req.other}:${req.label}`;
        const text = `${req.other}·${req.label} → ${chosen.id}`;
        const old = memory.byKey(key);
        if (old) {
          old.text = text;
          old.data = { choice: chosen.id, confidence };
          trace = rehearseTrace(old, clock);
        } else {
          trace = memory.add({ key, text, tag: 'imagined', kind: `imagined:${req.other}`, data: { choice: chosen.id, confidence } }, clock);
        }
      }
      lampV.mind = Math.max(lampV.mind, 0.8);
      log({
        level: 'mind', op: 'imagine', route: req.silent ? 'implicit' : 'imagined', obs: req.label, pred: chosen.id, note: req.other,
        data: {
          tag: 'imagined', margin: r3(margin), confidence, preference: r3(chosen.preference),
          ranking: ranked.map((r) => ({ id: r.id, G: r3(r.G) })), trace: trace?.id, rehearsals: trace?.rehearsals, C: trace ? r3(trace.C) : undefined,
        },
      });
      return { choice: chosen.id, ranked, margin: r3(margin), confidence, trace };
    },

    // ---- 记忆 ----
    remember(init) {
      const tr = memory.add(init, clock);
      log({ level: 'mind', op: 'remember', route: init.tag, note: init.text, data: { trace: tr.id, kind: init.kind, C: tr.C } });
      return tr;
    },
    rehearse(id) {
      const before = memory.get(id)?.C;
      const tr = memory.rehearse(id, clock);
      if (tr) log({ level: 'mind', op: 'rehearse', route: 'recalled', note: tr.text, data: { trace: id, C: r3(tr.C), before: r3(before ?? 0), rehearsals: tr.rehearsals } });
      return tr;
    },
    strength: (id) => memory.strength(id, clock),
    traces: () => memory.all(),

    // ---- 沉淀：从想到不想 ----
    outcome(sig, action, ok) {
      const key = `${sig}|${action}`;
      const h = habits.get(key) ?? { sig, action, streak: 0, fails: 0, uses: 0, compiled: false };
      habits.set(key, h);
      if (ok) {
        h.streak++;
        h.fails = 0;
        if (h.compiled) h.uses++;
      } else {
        h.streak = 0;
        h.fails++;
      }
      if (!h.compiled && h.streak >= 3) {
        h.compiled = true;
        log({ level: 'module', op: 'sediment', route: 'compiled', unit: sig, pred: action, note: '从想到不想', data: { streak: h.streak } });
        return 'compiled';
      }
      if (h.compiled && h.fails >= 2) {
        h.compiled = false;
        h.streak = 0;
        log({ level: 'mind', op: 'sediment', route: 'demoted', unit: sig, pred: action, note: '又要想了', data: { fails: h.fails } });
        return 'demoted';
      }
      return null;
    },
    habit(sig) {
      let best: Habit | null = null;
      for (const h of habits.values()) if (h.sig === sig && h.compiled && (!best || h.uses > best.uses)) best = h;
      return best ? best.action : null;
    },
    habits: () => [...habits.values()].map((h) => ({ ...h })),

    lamps: () => ({ unit: r3(lampV.unit), module: r3(lampV.module), mind: r3(lampV.mind) }),
    stops: () => ({ ...stopN }),
  };
  return mind;
}

function roundW(w: Weights): Weights {
  return { qing: r3(w.qing), li: r3(w.li), ming: r3(w.ming) };
}

/** 审计条目 → bus 的 trace 类别（engine/bus.ts 的 TraceKind 子集） */
export function traceKindOf(e: AuditEntry): 'mind.observe' | 'mind.error' | 'mind.layer' | 'mind.update' | 'mind.policy' | 'mind.imagine' | 'mind.sediment' {
  switch (e.op) {
    case 'infer':
      return e.route === 'absorbed' ? 'mind.observe' : e.route === 'top' ? 'mind.layer' : e.route === 'up' ? 'mind.error' : 'mind.update';
    case 'learn':
      return 'mind.update';
    case 'select':
    case 'act':
      return 'mind.policy';
    case 'sediment':
      return 'mind.sediment';
    default:
      return 'mind.imagine';
  }
}
