import type { Layer, Tier } from '../types';

export type LayerId = 'mentor' | 'director' | 'actor';
export type LetterKind = 'commission' | 'plan' | 'cue' | 'report' | 'retro';

/** 回执表示收信人已处理；内容在发出后不再改动。 */
export interface Letter<T = unknown> {
  id: string;
  kind: LetterKind;
  from: LayerId | string;
  to: LayerId | string;
  act?: string;
  t: number;
  day?: number;
  payload: T;
  receipt?: { at: number; by: string };
}

export interface Commission {
  intentId: string;
  title: string;
  hypothesis: { id: string; text: string; mode: 'satisfy' | 'probe' };
  target: string;
  stop: string;
  budget: { tier: Tier; lamp: number; note: string };
  userModel: {
    visits: number;
    name?: string;
    sinceLastMs: number;
    lastEnding?: string;
    dwellTop?: string;
    dayPart: string;
    device: string;
  };
  why: string;
}

export interface DirectorAck {
  planId: string;
  version: number;
  director: { id: string; name: string };
  acts: { id: string; framework: string; author: string; focus: string }[];
  accept: string;
  changes: string[];
  rehearsal: { act: string; expect: string; risk: string }[];
}

export interface ActorCue {
  act: string;
  who: string;
  expects: string;
  freedom: string;
  initialState: Record<string, unknown>;
  constraints: string[];
}

export interface ActorReport {
  act: string;
  who: string;
  did: string[];
  voice?: string[];
  predicted: string;
  actual: string;
  error?: { layer: Layer; unit?: string; e?: number; eps?: number; note?: string };
  facts: { id: string; text: string; kind: string }[];
  seeds?: { id: string; concept: string; blockedBy?: string }[];
  ms: number;
}

export interface MentorRetro {
  intentId: string;
  predicted: string;
  actual: string;
  userModelDelta: Record<string, unknown>;
  promises: string[];
  next: string;
}
