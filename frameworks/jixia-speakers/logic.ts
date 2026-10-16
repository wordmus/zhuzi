export const SCHOOLS = ['儒', '道', '法', '墨', '名', '阴阳'] as const;
export type School = typeof SCHOOLS[number];

export interface Quote {
  id: string;
  text: string;
  school: School;
  source: string;
  url: string;
}

// 归属文本与思想，不把传世文本冒充堂上某人的逐字录音。
export const QUOTES: readonly Quote[] = [
  { id: 'shu', text: '己所不欲，勿施于人。', school: '儒', source: '《论语·卫灵公》15.24', url: 'https://ctext.org/analects/wei-ling-gong/zh' },
  { id: 'dao', text: '道可道，非常道。', school: '道', source: '《老子》第一章', url: 'https://ctext.org/dao-de-jing/zh' },
  { id: 'fa', text: '法不阿贵，绳不挠曲。', school: '法', source: '《韩非子·有度》', url: 'https://ctext.org/hanfeizi/you-du/zh' },
  { id: 'jian', text: '兼相爱，交相利。', school: '墨', source: '《墨子·兼爱中》', url: 'https://ctext.org/text.pl?if=gb&node=675&show=parallel' },
  { id: 'bai', text: '白马非马。', school: '名', source: '《公孙龙子·白马论》', url: 'https://ctext.org/gongsunlongzi/bai-ma-lun/zh' },
  { id: 'water', text: '代火者必将水。', school: '阴阳', source: '《吕氏春秋·应同》', url: 'https://ctext.org/lv-shi-chun-qiu/ying-tong/zh' },
];

export interface Score { answered: number; correct: number; streak: number; maxStreak: number; seeds: string[] }
export const initialScore = (): Score => ({ answered: 0, correct: 0, streak: 0, maxStreak: 0, seeds: [] });
export function answer(score: Score, quote: Quote, school: School): Score {
  const right = quote.school === school;
  const streak = right ? score.streak + 1 : 0;
  return { answered: score.answered + 1, correct: score.correct + Number(right), streak,
    maxStreak: Math.max(score.maxStreak, streak), seeds: right ? [...score.seeds] : [...score.seeds, quote.id] };
}
export const standing = (score: Score): boolean => score.answered > 0 && score.correct / score.answered >= 0.6;
export function makeDeck(order: readonly Quote[], count = 5): Quote[] {
  if (count < 3 || count > 5 || new Set(order.map(q => q.id)).size < count) throw new Error('语录须有三至五条且不重复');
  return order.slice(0, count);
}
