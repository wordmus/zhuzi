export const ELEMENTS = ['木', '火', '土', '金', '水'] as const;
export type Element = typeof ELEMENTS[number];
export const OVERCOMES: Readonly<Record<Element, Element>> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
export const victor = (previous: Element): Element => ELEMENTS.find(e => OVERCOMES[e] === previous)!;
export const beats = (choice: Element, previous: Element): boolean => OVERCOMES[choice] === previous;

export const ROUNDS: readonly { former: string; previous: Element; next: string; hint: string }[] = [
  { former: '夏', previous: '木', next: '商', hint: '夏木既衰，何德继之？' },
  { former: '商', previous: '金', next: '周', hint: '商金既衰，何德继之？' },
  { former: '周', previous: '火', next: '齐之设想', hint: '若齐继周，当取何德？' },
];
export interface WheelScore { round: number; attempts: number; mistakes: number; correct: number; firstTry: number; tried: Element[] }
export const initialWheel = (): WheelScore => ({ round: 0, attempts: 0, mistakes: 0, correct: 0, firstTry: 0, tried: [] });
export function turn(score: WheelScore, choice: Element): WheelScore {
  const round = ROUNDS[score.round];
  if (!round || score.tried.includes(choice)) return score;
  const right = beats(choice, round.previous);
  return { round: score.round + Number(right), attempts: score.attempts + 1,
    mistakes: score.mistakes + Number(!right), correct: score.correct + Number(right),
    firstTry: score.firstTry + Number(right && score.tried.length === 0), tried: right ? [] : [...score.tried, choice] };
}
export function elementAt(x: number, y: number, cx: number, cy: number): Element {
  const a = (Math.atan2(y - cy, x - cx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
  return ELEMENTS[Math.round(a / (Math.PI * 2 / 5)) % 5]!;
}
