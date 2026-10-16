import type { Fact } from '../types';

export interface HistoryMacro {
  minxin: number;
  grain: number;
  power: number;
  rites: number;
}

export interface HistoryEvent {
  id: string;
  year: number;
  title: string;
  text: string;
  kind: 'war' | 'reform' | 'rite' | 'scholar' | 'omen' | 'relief';
  effects: Partial<HistoryMacro>;
  enters: { who: string; as: string; line: string };
  source: { title: string; url?: string };
  verified?: boolean;
}

export interface HistoryState {
  year: number;
  fired: string[];
  macro: HistoryMacro;
}

export interface HistoryApi {
  state(): HistoryState;
  events(): HistoryEvent[];
  advanceTo(year: number): HistoryEvent[];
  enter(e: HistoryEvent): { who: string; line: string; year: number };
  writeBack(w: { by: string; decision: string; delta: Partial<HistoryMacro>; year?: number }): HistoryState;
  ledger(): Fact[];
}

export interface HistoryTable {
  span: { from: number; to: number; note?: string };
  macro: HistoryMacro;
  events: HistoryEvent[];
}
