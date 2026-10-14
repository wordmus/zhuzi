// 运行时上下文：一台机器的全部器官。框架和组件只从这里拿东西。

import type { AffordanceRegistry } from '../engine/affordance';
import type { Audio } from '../engine/audio-api';
import type { Bus } from '../engine/bus';
import type { Rng } from '../engine/rng';
import type { Senses } from '../engine/senses';
import type { Stage } from '../engine/stage';
import type { Store } from '../engine/store';
import type { Think } from '../engine/think';
import type { EndingId, Plan, PlanAct } from '../engine/types';
import type { Lines } from '../components/line';

/** 上一次来访留下的东西（存在本机） */
export interface VisitRecord {
  n: number;
  at: number;
  name?: string;
  ending?: EndingId;
  endingFact?: string;
  /** 各元素累计停留毫秒 */
  dwell: Record<string, number>;
  /** 在哪个地方停得最久 */
  longestPlace?: string;
  longestPlaceMs?: number;
  seed: number;
}

export interface VisitInfo {
  /** 这是第几次来（从 1 开始） */
  n: number;
  previous: VisitRecord | null;
  /** 距上次离开多久（毫秒，已计入拨快的钟） */
  sinceMs: number;
}

export interface Ctx {
  stage: Stage;
  bus: Bus;
  store: Store;
  senses: Senses;
  think: Think;
  aff: AffordanceRegistry;
  lines: Lines;
  audio: Audio;
  plan: Plan;
  rng: Rng;
  visit: VisitInfo;
  /** 幕与幕之间的交接物（比如票根在屏幕上的位置），一镜到底靠它 */
  handoff: Record<string, unknown>;
  /** 这一次来访正在积累的记录 */
  record: VisitRecord;
}

export interface ActResult {
  act: string;
  data?: Record<string, unknown>;
}

export interface Framework {
  run(act: PlanAct, ctx: Ctx): Promise<ActResult>;
}
