// 心智引擎的内部类型。契约层的 Layer / Weights / Temperament 仍在 engine/types.ts。
// 一律是可审计的有限状态版本：每次预测、误差、精度、策略、参数更新都写一条 AuditEntry。

import type { Layer, Temperament, Weights } from '../types';

/**
 * 操作种类。infer / learn / select / act 是四类互不混用的操作：
 * infer 只改状态，learn 只改参数，select 只选策略，act 是唯一改世界的。
 * 其余四样：设想、记下、复习、沉淀。
 */
export type Op = 'infer' | 'learn' | 'select' | 'act' | 'imagine' | 'remember' | 'rehearse' | 'sediment';

/** 审计日志的一条，只增不改。t 是逻辑时钟（世界的天），不碰真实时间，所以可复现。 */
export interface AuditEntry {
  seq: number;
  t: number;
  mind: string;
  level: Layer;
  op: Op;
  unit?: string;
  obs?: number | string;
  pred?: number | string;
  /** e = obs − pred */
  e?: number;
  /** 精度 π */
  pi?: number;
  /** eps = π·e */
  eps?: number;
  /** absorbed 就地消化 / up 残差上传 / top 到了心智 / argmax / suggested / set / habit … */
  route?: string;
  note?: string;
  data?: Record<string, unknown>;
}

export interface UnitSpec {
  id: string;
  module: string;
  label?: string;
  /** 当前预测（状态估计） */
  pred?: number;
  /** 精度 π：误差乘它才是 eps */
  pi?: number;
  /** 就地适应的快慢 */
  lr?: number;
}

export interface ModuleSpec {
  id: string;
  label?: string;
  pi?: number;
  lr?: number;
}

export interface MindSpec {
  id: string;
  temperament: Temperament;
  /** 自己在乎什么（田伯的真权重）；用不到时留空 */
  weights?: Weights;
  /** 对另一个人的信念（禾心里的小田伯） */
  belief?: Weights;
  units?: UnitSpec[];
  modules?: ModuleSpec[];
  /** 选策略时信息增益的权重 */
  infoWeight?: number;
}

export interface MindParams {
  temperament: Temperament;
  weights: Weights;
  belief: Weights;
  infoWeight: number;
}

/** 一次观测穿过各层之后停在哪 */
export interface Propagation {
  layer: Layer;
  unit: string;
  module: string;
  e: number;
  eps: number;
  cause: string;
}

export interface Candidate {
  id: string;
  /** 偏好结果（实用价值） */
  preference: number;
  /** 信息增益（认识价值） */
  infoGain?: number;
  note?: string;
}

export interface Ranked extends Candidate {
  infoGain: number;
  /** G = preference + w·infoGain */
  G: number;
}

export interface SelectOpts {
  /** 外来的建议（玩家建议被接受）：记下来，但选择仍写明是被建议的 */
  pick?: string;
  why?: string;
  level?: Layer;
  /** 覆盖信息增益权重 */
  weight?: number;
}

export interface Selection {
  chosen: Ranked;
  ranked: Ranked[];
}

export interface ActOpts {
  level?: Layer;
  route?: string;
  data?: Record<string, unknown>;
}

export type ParamChange =
  | { kind: 'belief'; target: Weights; rate: number }
  | { kind: 'belief-set'; value: Weights }
  | { kind: 'precision'; unit: string; pi: number }
  | { kind: 'patience'; value: number };

export interface Trace {
  id: string;
  key: string;
  text: string;
  tag: 'observed' | 'imagined';
  /** 记的是谁/什么：'tianbo'、'clue'… */
  kind: string;
  born: number;
  touched: number;
  /** 稳定度 C */
  C: number;
  rehearsals: number;
  data?: Record<string, unknown>;
}

export interface MemoryParams {
  lambda0: number;
  rho: number;
  eta: number;
}

export interface Habit {
  sig: string;
  action: string;
  streak: number;
  fails: number;
  uses: number;
  compiled: boolean;
}

export interface ImagineReq<S> {
  /** 想象的对象 */
  other: string;
  /** 这次想象的题目（'qing' 来由等） */
  label: string;
  /** 换上的参数：禾以为的田伯 */
  params: Weights;
  scenario: S;
  /** 与真实的对方同一个模型函数，参数不同 */
  model: (params: Weights, scenario: S) => Candidate[];
  /** 只算预测，不写入记忆 */
  silent?: boolean;
  otherTemperament?: Temperament;
}

export interface Imagined {
  choice: string;
  ranked: Ranked[];
  /** 第一与第二的差 */
  margin: number;
  confidence: number;
  trace: Trace | null;
}

export interface Mind {
  readonly id: string;
  readonly params: MindParams;
  readonly audit: readonly AuditEntry[];
  readonly lastLayer: Layer | null;
  tick(t: number): void;
  now(): number;
  thresholds(): { unit: number; module: number };
  /** 观测进某个单元，逐层判断：就地消化，还是残差上传 */
  sense(unitId: string, obs: number, cause?: string): Propagation;
  /** 只改状态（单元的预测或心智的状态量） */
  infer(key: string, value: number | string, note?: string): void;
  /** 只改参数 */
  learn(change: ParamChange, cause?: string): { before: Weights; after: Weights } | null;
  /** 只选策略，信息增益与偏好分开记 */
  select(cands: Candidate[], opts?: SelectOpts): Selection;
  /** 唯一改世界的操作：先记，再执行 */
  act<T>(name: string, effect: () => T, opts?: ActOpts): T;
  /** 设想：同一结构，换上对方参数 */
  imagine<S>(req: ImagineReq<S>): Imagined;
  remember(init: { key?: string; text: string; tag: 'observed' | 'imagined'; kind: string; data?: Record<string, unknown> }): Trace;
  rehearse(id: string): Trace | null;
  strength(id: string): number;
  traces(): Trace[];
  /** 同一情境同一做法的结果：连续奏效 3 次编译成习惯，连续出错 2 次降级 */
  outcome(sig: string, action: string, ok: boolean): 'compiled' | 'demoted' | null;
  habit(sig: string): string | null;
  habits(): Habit[];
  /** 三盏心灯 0..1 */
  lamps(): Record<Layer, number>;
  stops(): Record<Layer, number>;
}
