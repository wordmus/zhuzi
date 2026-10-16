import type { Rng } from '../../engine/rng';

export const CONCERNS = ['people', 'king', 'home', 'name'] as const;
export type Concern = typeof CONCERNS[number];
export const DECISIONS = ['give', 'lend', 'close'] as const;
export type Decision = typeof DECISIONS[number];
export interface QiState {
  weights: Record<Concern, number>;
  weighed: Concern[];
  stock: number;
  levy: number;
  watchers: number;
  tilt: number;
  choice: Decision | null;
}
export function createQi(rng: Pick<Rng, 'int'>): QiState {
  return { weights: { people: rng.int(2, 5), king: rng.int(3, 6), home: rng.int(2, 5), name: rng.int(1, 5) }, weighed: [], stock: 12, levy: rng.int(4, 6), watchers: rng.int(2, 4), tilt: 0, choice: null };
}
export function weigh(state: QiState, concern: Concern): QiState {
  if (!CONCERNS.includes(concern) || state.weighed.length >= 3 || state.choice) return state;
  const counts = state.weighed.filter(x => x === concern).length;
  const pressure = concern === 'king' ? state.levy / 2 : concern === 'name' ? state.watchers / 2 : 1;
  const tilt = Math.max(-0.3, Math.min(0.3, (state.weights[concern] + pressure + counts - 4.5) * 0.075));
  return { ...state, weighed: [...state.weighed, concern], tilt };
}
export const THOUGHT: Record<Concern, readonly [string, string]> = {
  people: ['门外的粥，不能只在嘴上。', '他们的饿，还抵不过王命。'],
  king: ['王的车，明日便到。', '王命之外，也得留口活路。'],
  home: ['自家也有一冬的嘴。', '家里少一碗，还撑得住。'],
  name: ['门外的眼睛，都在看我。', '无人看着，仓也得自己开。'],
};
export function thought(state: QiState): string {
  const last = state.weighed.at(-1);
  return last ? THOUGHT[last][state.tilt >= 0 ? 0 : 1] : '';
}
export function recommend(state: QiState): Decision {
  const emphasis = (c: Concern) => state.weights[c] + state.weighed.filter(x => x === c).length;
  if (emphasis('people') + emphasis('name') > emphasis('king') + emphasis('home') + 1) return 'give';
  return emphasis('king') > emphasis('people') + 3 ? 'close' : 'lend';
}
export function decide(state: QiState, choice: Decision): QiState {
  if (state.weighed.length !== 3 || state.choice || !DECISIONS.includes(choice)) return state;
  return { ...state, choice, stock: state.stock - (choice === 'give' ? 5 : choice === 'lend' ? 3 : 0), watchers: choice === 'give' ? state.watchers + 3 : choice === 'close' ? 0 : state.watchers };
}
export function consequence(state: QiState) {
  const choice = state.choice;
  if (!choice) throw new Error('尚未决定仓门');
  const text = { give: '田伯开仓施粥，征粮前少了五袋粟。', lend: '田伯借出三袋粟，立券来年还六袋。', close: '田伯合上仓门，乡邻空手散去。' }[choice];
  return { id: `qi-knife-${choice}`, text, kind: 'decision' as const, by: '田伯' };
}
