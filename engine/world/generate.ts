// 世界实例生成：seed → WorldConfig。同一个 seed 永远得到同一个东郊、同一个田伯。
// 一个格子 = 一个决定 = 一步；四季 3+3+3+2 = 11 步，日从 1 数起。
import type { Rng } from '../rng';
import type { Clue, Person, PlaceId, Trait, Weights, WorldConfig } from '../types';
import { TRAITS } from '../types';
import { CLUE_BANK } from './lines';

/** 王征粮之后，田伯的仓只剩原来的这么多 */
export const REQUISITION_CUT = 0.55;

/** 流言属实的判据：某样在田伯心里确实重 / 确实轻 */
export function clueIsTrue(trait: Trait, sign: 1 | -1, w: Weights): boolean {
  return sign > 0 ? w[trait] >= 0.34 : w[trait] < 0.26;
}

/** 哪一样占主导，按 seed 轮换：三个 seed 里各占一个 */
const DOMINANT: Trait[] = ['ming', 'li', 'qing'];

export function generateWorld(seed: number, rng: Rng): WorldConfig {
  const rt = rng.fork('tianbo');
  const rh = rng.fork('he');
  const rc = rng.fork('clues');
  const rs = rng.fork('seasons');
  const rf = rng.fork('family');
  const ro = rng.fork('omen');

  // ---- 田伯的真权重 ----
  const dom = DOMINANT[((seed % 3) + 3) % 3]!;
  const rest = TRAITS.filter((t) => t !== dom);
  const wd = rt.float(0.5, 0.62);
  const split = rt.float(0.3, 0.7);
  const tw: Weights = { qing: 0, li: 0, ming: 0 };
  tw[dom] = wd;
  tw[rest[0]!] = (1 - wd) * split;
  tw[rest[1]!] = (1 - wd) * (1 - split);

  // ---- 禾：性情，与偏向「情」的初始信念（他爹给田伯他爹扛过粟）----
  const bq = rh.float(0.5, 0.64);
  const bl = rh.float(0.12, 0.22);
  const belief: Weights = { qing: bq, li: bl, ming: 1 - bq - bl };

  const family: WorldConfig['family'] = [
    { id: 'sang', name: '桑', role: 'wife' },
    { id: 'xiaoshi', name: '小石', role: 'child' },
  ];
  if (rf.chance(0.45)) family.push({ id: 'mu', name: '母', role: 'mother' });

  const people: Person[] = [
    { id: 'he', name: '禾', role: 'actor', home: 'home' },
    { id: 'tianbo', name: '田伯', role: 'lord', home: 'gate' },
    { id: 'ji', name: '季', role: 'scholar', home: 'road' },
    ...family.map((f) => ({ id: f.id, name: f.name, role: 'family' as const, home: 'home' as const })),
    { id: 'linren', name: '邻人', role: 'neighbor', home: 'well' },
    { id: 'luren', name: '路人', role: 'neighbor', home: 'road' },
  ];

  // ---- 四季：对雨的期待逐季降低，实际一直是旱 ----
  const exp = [0.8, 0.6, 0.4, 0.2];
  const seasons = (['spring', 'summer', 'autumn', 'winter'] as const).map((s, i) => ({
    season: s,
    days: i === 3 ? 2 : 3,
    rainExpect: Math.round((exp[i]! + rs.float(-0.05, 0.05)) * 100) / 100,
    rainActual: Math.round(rs.float(0, 0.1) * 100) / 100,
  }));

  const req = rt.int(7, 9);
  const granary = [rt.float(0.85, 1), rt.float(0.7, 0.95), rt.float(0.6, 0.85), rt.float(0.5, 0.75)].map((v) => Math.round(v * 100) / 100);

  const omenKind = ro.weighted(['yinghuo', 'comet', 'halo'] as const, (k) => (k === 'yinghuo' ? 0.6 : 0.2));

  return {
    seed,
    places: [
      { id: 'home', name: '家', x: 0.08, actions: ['rest', 'eat'] },
      { id: 'field', name: '田', x: 0.26, actions: ['wait-rain'] },
      { id: 'well', name: '井', x: 0.43, actions: ['listen'] },
      { id: 'altar', name: '社树', x: 0.59, actions: ['pray'] },
      { id: 'gate', name: '田伯家', x: 0.77, actions: ['borrow'] },
      { id: 'road', name: '路口', x: 0.94, actions: ['look', 'leave'] },
    ],
    people,
    he: {
      temperament: {
        pride: round2(rh.float(0.42, 0.78)),
        awe: round2(rh.float(0.5, 0.9)),
        duty: round2(rh.float(0.7, 0.95)),
        attachment: round2(rh.float(0.5, 0.9)),
        patience: round2(rh.float(0.35, 0.65)),
      },
      belief,
    },
    tianbo: { weights: tw, pride: round2(rt.float(0.4, 0.85)), granary, requisitionDay: req },
    seasons,
    omen: { kind: omenKind, day: ro.int(4, 6) },
    clues: makeClues(rc, tw),
    jarDays: rf.int(22, 26) + (family.some((f) => f.role === 'mother') ? 3 : 0),
    family,
    unfoldPressure: round2(rt.float(0.5, 0.66)),
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** 4–6 条流言，约七成属实；井、家、路上各至少一条 */
function makeClues(r: Rng, w: Weights): Clue[] {
  const n = r.int(4, 6);
  const places: PlaceId[] = r.shuffle(['well', 'home', 'road'] as PlaceId[]);
  while (places.length < n) places.push(r.weighted(['well', 'home', 'road'] as PlaceId[], (p) => (p === 'well' ? 2 : 1)));
  const used = new Set<string>();
  const out: Clue[] = [];
  for (let i = 0; i < n; i++) {
    const place = places[i]!;
    const wantTrue = r.chance(0.7);
    let pool = CLUE_BANK.filter((c) => !used.has(c.text) && clueIsClear(c.trait, c.sign, w) && clueIsTrue(c.trait, c.sign, w) === wantTrue);
    if (pool.length === 0) pool = CLUE_BANK.filter((c) => !used.has(c.text));
    const t = r.pick(pool);
    used.add(t.text);
    const from = place === 'well' ? 'linren' : place === 'home' ? 'sang' : r.pick(['ji', 'luren']);
    out.push({
      id: `c${i + 1}`, text: t.text, trait: t.trait, sign: t.sign, truthful: clueIsTrue(t.trait, t.sign, w),
      place, day: r.int(1, 8), from,
    });
  }
  return out.sort((a, b) => a.day - b.day || a.id.localeCompare(b.id)).map((c, i) => ({ ...c, id: `c${i + 1}` }));
}

/** 只用「明明白白」属实或不实的话：中间值不拿来出题 */
function clueIsClear(trait: Trait, sign: 1 | -1, w: Weights): boolean {
  return sign > 0 ? w[trait] >= 0.34 || w[trait] <= 0.22 : w[trait] < 0.26 || w[trait] >= 0.4;
}
