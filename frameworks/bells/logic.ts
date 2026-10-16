import type { Rng } from '../../engine/rng';

export const NOTES = ['宫', '商', '角', '徵', '羽'] as const;
export const RATIOS = [1, 9 / 8, 81 / 64, 3 / 2, 27 / 16] as const;
export function frequency(note: number, base = 220): number {
  return base * RATIOS[((note % 5) + 5) % 5]! * 2 ** Math.floor(note / 5);
}
export function makeSequence(rng: Pick<Rng, 'int'>, length = 5): number[] {
  return Array.from({ length: Math.max(2, Math.min(5, Math.floor(length))) }, () => rng.int(0, 4));
}
export interface BellsState {
  sequence: readonly number[];
  round: number;
  cursor: number;
  mistakes: number;
  correct: number;
  attempts: number;
  longest: number;
  done: boolean;
}
export function createBells(sequence: readonly number[]): BellsState {
  if (sequence.length < 4 || sequence.length > 5 || sequence.some(x => !Number.isInteger(x) || x < 0 || x > 4)) throw new Error('编钟需要四至五个五声音级');
  return { sequence: [...sequence], round: 0, cursor: 0, mistakes: 0, correct: 0, attempts: 0, longest: 0, done: false };
}
export function roundLength(state: BellsState): number { return Math.min(5, state.round + 2); }
export function strike(state: BellsState, note: number): BellsState {
  if (state.done || !Number.isInteger(note) || note < 0 || note > 4) return state;
  const attempts = state.attempts + 1;
  if (note !== state.sequence[state.cursor]) return { ...state, attempts, mistakes: state.mistakes + 1, cursor: 0 };
  const cursor = state.cursor + 1;
  const correct = state.correct + 1;
  if (cursor < roundLength(state)) return { ...state, attempts, correct, cursor };
  const round = state.round + 1;
  return { ...state, attempts, correct, round, cursor: 0, longest: roundLength(state), done: round >= 3 };
}
