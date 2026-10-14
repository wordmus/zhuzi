// 玩家写给禾的一句话 → 禾能想的概念。纯规则，永远可用，也是模型翻译的回退。
// 农夫能想「天」「社」「地」，不会想「进步」：认不出的返回 null。

import type { Concept, Trait } from '../types';

/** 每个概念的关键词；越长越具体，得分越高 */
const KEYWORDS: Record<Concept, string[]> = {
  tianbo: ['田伯', '借', '求', '讨', '贷', '乞', '开口', '上门', '叩门', '敲门'],
  zou: ['走', '莒', '投亲', '离开', '逃', '上路', '搬', '远方', '投奔', '出门'],
  she: ['祭', '社', '神', '鬼', '祷', '祈', '供', '牲', '巫'],
  tian: ['天', '雨', '云', '龙', '旱', '星', '老天'],
  deng: ['等', '熬', '忍', '守着', '再看', '不急', '耐'],
  di: ['卖', '地', '田契', '契', '田亩', '押'],
  jia: ['家', '妻', '桑', '孩', '娃', '小石', '母', '娘', '饿'],
  su: ['粟', '粮', '瓮', '吃', '饭', '米'],
};

/** 同分时的先后 */
const ORDER: Concept[] = ['tianbo', 'zou', 'she', 'tian', 'di', 'deng', 'jia', 'su'];

export function translateWords(words: string): Concept | null {
  const text = (words ?? '').trim();
  if (!text) return null;
  const score = new Map<Concept, number>();
  for (const c of ORDER) {
    let s = 0;
    for (const k of KEYWORDS[c]) if (text.includes(k)) s += k.length;
    if (s > 0) score.set(c, s);
  }
  // 「田伯」里的「田」不算地
  if (text.includes('田伯') && !/卖|契|地/.test(text)) score.delete('di');
  let best: Concept | null = null;
  let bestS = 0;
  for (const c of ORDER) {
    const s = score.get(c) ?? 0;
    if (s > bestS) {
      best = c;
      bestS = s;
    }
  }
  return best;
}

/** 话里若点明田伯在乎什么，直接改禾心里的小田伯 */
export function traitFromWords(words: string): Trait | null {
  const t = words ?? '';
  const hit = (re: RegExp) => (t.match(re) ?? []).length;
  const q = hit(/情|旧|恩|人情|爹|念/g);
  const l = hit(/利|钱|价|契|押|息|倍|地/g);
  const m = hit(/名|脸|面|乡邻|人多|看着|声|体面/g);
  const max = Math.max(q, l, m);
  if (max === 0) return null;
  if (q === max) return 'qing';
  if (l === max) return 'li';
  return 'ming';
}
