// 规则台词库：禾、桑、小石、邻人、季、田伯。
// 都要短、具体、合时代（粟不是米，没有茶；天、社、鬼神、田伯、名分），偶尔带刺，从不解释。
// 每句 ≤ 30 字，最好 ≤ 18 字。流言（CLUE_BANK）≤ 18 字。

import type { Approach, Concept, EndingId, PlaceId, Response, Trait } from '../types';

/** 禾 */
export const HE = {
  /** 望天（事停在心智层） */
  sky: ['天老爷，你是忘了东郊，还是忘了我？', '云呢？借我一朵，秋后还。', '天不说话，缝在说话。', '雨去了谁家？'],
  skyAgain: ['又是一天。', '天还是那个天。', '云走了，没带话。'],
  hunger: ['肚子先开了口。', '瓮空了，人还得站着。'],
  field: ['缝又宽了一指。', '土在掉渣，像粟壳。', '再等三天。我说过了。', '爹，你也熬过旱吗？'],
  rest: ['石儿，过来，阿爹抱。', '瓮底还有粟。', '先把家看住。'],
  listen: ['井绳又短了一截。', '只听见水桶碰壁的响。'],
  pray: ['社公，这田你也有一份。', '我不求多，求一场透雨。', '神要诚心？我只有粟。'],
  look: ['路上没有田。', '路那头，是莒。', '走的人，比回来的多。'],
  approach: {
    qing: '田伯，我爹给您爹扛过粟。',
    li: '田伯，东头那块地，押给您。',
    ming: '田伯，乡邻都陪我来了。',
  } as Record<Approach, string>,
  accept: { lend: '立券吧。', sell: '地……拿去吧。' },
  decline: ['这价，我不能应。', '再想想。回头再说。'],
  thanks: { give: '这份情，我记下。', lend: '秋后，我一定还。' },
  /** 照建议去做时 */
  go: ['去。', '好，我去一趟。', '听你的，就这一回。'],
  final: {
    leave: '走。天亮前就走。',
    sacrifice: '社公在上，种粟献你。',
    endure: '熬。熬到开春。',
  },
};

/** 被建议了却不肯：又歪又合理。key = 地点或 'gate-early' */
export const REFUSE: Record<string, string[]> = {
  'gate-early': ['还没到那一步。', '春天开口，秋天拿什么还？', '脸还要，肚子再撑撑。'],
  gate: ['去了就是求人。', '我的脸，比瓮还空么？', '再等等，等他先看见我瘦。'],
  road: ['走了，谁给爹守坟？', '路上没有田。', '我这双脚，只认这块土。'],
  altar: ['祭要备牲，我拿什么备。', '我去拜，社公准笑我心急。', '社公忙着呢，不添乱。'],
  field: ['再看，缝也合不上。', '等雨等烦了。'],
  well: ['井边只有话，没有粟。', '听风声能当饭吃？'],
  home: ['坐在家里，粟不会自己长。', '家我记着，先不回。'],
  busy: ['先把眼前的事说完。'],
  generic: ['你说得对。可不是今天。', '我再想想。'],
};

/** 被拒的原因（options().refuse，短语） */
export const REASON_TEXT: Record<string, string> = {
  early: '还没到那一步',
  pride: '抹不开脸',
  attach: '舍不得走',
  poor: '备不起牲',
  hope: '还在等雨',
  idle: '用处不大',
};

/** 种下一个念头时禾的回应 */
export const PLANT: Record<Concept, { acted: string; seed: string }> = {
  zou: { acted: '路我看过了。', seed: '走？……我先把这念头收着。' },
  tianbo: { acted: '那就去田伯那儿。', seed: '田伯的门，我记下了。' },
  she: { acted: '那就去社树下。', seed: '社公那里，我记着。' },
  tian: { acted: '天要看，我就去望。', seed: '天，我再问问。' },
  jia: { acted: '家里要紧。我回去。', seed: '家，我放不下。' },
  su: { acted: '粟的事，去井边听听。', seed: '粟，一粒一粒数着过。' },
  di: { acted: '地是爹留的。', seed: '地是爹留的。' },
  deng: { acted: '那就再等。', seed: '等……也是一种活法。' },
};

/** 把流言放进心里时禾的回应 */
export const CLUE_REACT: Record<Trait, Record<'1' | '-1', string>> = {
  qing: { '1': '原来田伯念旧。', '-1': '旧情，他不认？' },
  li: { '1': '他认粟，认地。', '-1': '他不缺那点钱。' },
  ming: { '1': '他要人看着。', '-1': '脸面，他不在乎？' },
};
export const CLUE_AGAIN = '这话我记着呢。';
export const CLUE_UNKNOWN = '没听过这话。';

export const SANG = {
  calm: ['先吃，别说话。', '石儿睡了，你也歇。'],
  thin: ['瓮快见底了。', '石儿今天没哭，是没力气哭。', '别丢脸，也别饿着。'],
  hungry: ['我少吃一口，石儿多吃一口。', '娘家那边……还有人。'],
};
export const XIAOSHI = ['阿爹，饿。', '阿爹，天为什么不下水？', '阿爹，云是不是被谁吃了？'];
export const MU = ['我老了，少吃点没事。', '我不饿，你们吃。'];
export const LINREN = ['井水又浅了一掌。', '东边那口井，干了。', '别问我，我也饿。'];
export const JI = ['天不降雨，是人失了序。', '我在写上书。谁看，不知道。'];
export const LUREN = ['莒那边，听说有粟。', '路上的人，一年比一年多。'];

/** 天象与征粮 */
export const OMEN = {
  yinghuo: { who: 'ji', text: '荧惑守心。要出大事。', sky: '天上那颗红星，不走了。' },
  comet: { who: 'linren', text: '有星拖着尾巴。', sky: '扫帚星，扫到东郊来了。' },
  halo: { who: 'linren', text: '日头套了个圈。', sky: '日头戴了冠，不是好事。' },
};
export const REQUISITION = {
  who: 'linren',
  text: '王的人来征粮了。',
  cart: '田伯家的车，装了三趟。',
  fact: '王的人来征粮，田伯的仓空了一角。',
};
export const FALSE_CLOUDS = '云来了，又走了。';

/** 田伯的话：规则版。键 = 回应 → 来由 或 'any' */
export const TIANBO: Record<Response, Partial<Record<Approach | 'any' | 'poor' | 'req', string[]>>> = {
  give: {
    qing: ['旧人来了，拿去。', '你爹的粟，我记着。'],
    ming: ['人都看着，拿去。', '拿去。别在门口跪。'],
    li: ['拿去，别说我吃亏。'],
    any: ['拿去。'],
  },
  lend: {
    any: ['借你。秋后还我两倍。', '立个券。别怪我算得清。', '借。两倍。'],
  },
  'buy-land': {
    any: ['地契拿来，粟我给你。', '东头那块，我早看着了。'],
  },
  refuse: {
    qing: ['情是情，仓是仓。', '旧事不提。'],
    li: ['你的地，不值这些粟。'],
    ming: ['门口站这么多人，是借粮，还是看我？'],
    poor: ['仓见底了。'],
    req: ['王的人刚走。'],
    any: ['今年仓里也紧。', '改日吧。'],
  },
};

/** 禾心里小田伯的话（预演） */
export const IMAGINED: Record<Response, string[]> = {
  give: ['你爹的情，我记着。', '拿去吧，旧人。'],
  lend: ['借你，秋后还。'],
  'buy-land': ['地契留下。'],
  refuse: ['今年不凑巧。'],
};

/** 选项上禾的预期（≤16 字） */
export const EXPECT = {
  'home:rest': '看着石儿，心里踏实',
  'field:wait-rain': '也许今天有云',
  'well:listen': '也许井边有新话',
  'altar:pray': '社公也许听得见',
  'road:look': '看看路那头',
  'road:leave': '一家人，走',
  'altar:sacrifice': '献上种粟，乡邻来',
  'home:endure': '再熬一冬',
  'gate:accept-lend': '立券，明年双倍',
  'gate:accept-sell': '地换粟',
  'gate:decline': '不应',
  gate: {
    give: '念旧情，田伯会给',
    lend: '田伯会借，要还',
    'buy-land': '田伯想要我的地',
    refuse: '怕是要关门',
  } as Record<Response, string>,
};

/** 动作的中文名（账本里用） */
export const ACTION_NAME: Record<string, string> = {
  rest: '守家', 'wait-rain': '等雨', listen: '打听', pray: '祈', look: '望路',
};

/** 条件（offer）的措辞 */
export const OFFER_TERMS = { lend: '借粟，秋后还两倍', 'buy-land': '粟换东头的地' };

/** 社坛起来 */
export const UNFOLD = {
  text: '社树下的土，隆起了一块。',
  fact: '社树下立起了社坛；禾心里多了「祭」。',
  say: '社公，这回我备牲。',
};

/** 结局：导师回到咖啡厅说的那一句 / 第二次来访的回声 */
export const ENDING: Record<EndingId, { mentor: string; echo: string; fact: string }> = {
  lend: { mentor: '禾借到了粟。明年要还两倍。', echo: '禾借的粟，秋后要还了。你走后第{days}天。', fact: '禾向田伯借了粟，立券，明年还两倍。' },
  sell: { mentor: '禾卖了地，换来一冬的粟。', echo: '禾的地换了主人。你走后第{days}天。', fact: '禾把东头的地卖给了田伯，换了粟。' },
  leave: { mentor: '禾带着一家人，往莒去了。', echo: '禾到莒了，你走后第{days}天。', fact: '禾带一家人上了往莒的路。' },
  sacrifice: { mentor: '禾献了种粟。雨没来，人都来了。', echo: '社坛上的缯还在。你走后第{days}天。', fact: '禾在社坛献上了来年的种粟，乡邻聚来。' },
  endure: { mentor: '禾熬到了冬末，还在东郊。', echo: '禾熬过了那个冬天。你走后第{days}天。', fact: '禾没有借、没有走，熬过了冬。' },
};
export const MENTOR_GIVE = { mentor: '田伯给了粟。禾欠下一份情。', echo: '禾欠田伯的那份情，还在。你走后第{days}天。', fact: '田伯给了禾粟，没立券。' };
export const MENTOR_SACRIFICE_MING = '禾献了种粟，田伯开仓施粥了。';
export const SACRIFICE = { text: '开仓。', crowd: '乡邻都来了。' };

/** 流言库：trait + sign + 文本（≤ 18 字）。生成器按田伯的真权重决定哪些属实 */
export interface ClueTemplate { trait: Trait; sign: 1 | -1; text: string }
export const CLUE_BANK: ClueTemplate[] = [
  { trait: 'qing', sign: 1, text: '禾他爹给田伯他爹扛过粟。' },
  { trait: 'qing', sign: 1, text: '田伯认旧人，逢年还送盐。' },
  { trait: 'qing', sign: 1, text: '谁家孩子饿着，田伯会红眼。' },
  { trait: 'qing', sign: 1, text: '田伯养着老仆，养了十年。' },
  { trait: 'qing', sign: 1, text: '田伯他娘的坟，禾他爹修过。' },
  { trait: 'qing', sign: -1, text: '田伯说，旧情不能当粟吃。' },
  { trait: 'qing', sign: -1, text: '田伯翻脸，连亲兄弟也不认。' },
  { trait: 'qing', sign: -1, text: '旧人上门，田伯让他在门外等。' },
  { trait: 'qing', sign: -1, text: '田伯去年赶走了同乡的穷亲。' },
  { trait: 'li', sign: 1, text: '田伯把仓里的粟卖进城，一石三百钱。' },
  { trait: 'li', sign: 1, text: '田伯收地契，不收人情。' },
  { trait: 'li', sign: 1, text: '田伯家的账房，夜里还亮着灯。' },
  { trait: 'li', sign: 1, text: '田伯放粟，秋后要加倍。' },
  { trait: 'li', sign: 1, text: '东头那三亩地，田伯早看中了。' },
  { trait: 'li', sign: -1, text: '田伯不缺钱，缺的是别的。' },
  { trait: 'li', sign: -1, text: '田伯把去年的债，一笔勾了。' },
  { trait: 'li', sign: -1, text: '田伯不爱地，爱的是门面。' },
  { trait: 'ming', sign: 1, text: '田伯前日在门口施粥，跪了一地人。' },
  { trait: 'ming', sign: 1, text: '田伯办寿，请了半个乡的人。' },
  { trait: 'ming', sign: 1, text: '田伯出门，总要先问有谁看着。' },
  { trait: 'ming', sign: 1, text: '田伯最怕人背后说他。' },
  { trait: 'ming', sign: 1, text: '田伯门前的匾，是新换的。' },
  { trait: 'ming', sign: -1, text: '田伯不理乡里怎么说他。' },
  { trait: 'ming', sign: -1, text: '田伯关起门来，谁的脸也不给。' },
  { trait: 'ming', sign: -1, text: '人在门口跪三天，田伯也不出来。' },
];

/** 地点 → 念头（被挡下的建议成为哪一种种子） */
export const PLACE_CONCEPT: Record<PlaceId, Concept> = {
  home: 'jia', field: 'deng', well: 'su', altar: 'she', gate: 'tianbo', road: 'zou',
};

export function pickLine(list: readonly string[], rng: { pick<T>(items: readonly T[]): T }): string {
  return rng.pick(list);
}

/** 测试用：把所有规则台词摊平成一个数组 */
export function allRuleLines(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  [HE, REFUSE, REASON_TEXT, PLANT, CLUE_REACT, SANG, XIAOSHI, MU, LINREN, JI, LUREN, OMEN, REQUISITION, FALSE_CLOUDS, TIANBO, IMAGINED, EXPECT, OFFER_TERMS, UNFOLD, MENTOR_GIVE, SACRIFICE].forEach(walk);
  out.push(CLUE_AGAIN, CLUE_UNKNOWN, MENTOR_SACRIFICE_MING);
  for (const e of Object.values(ENDING)) out.push(e.mentor, e.echo.replace('{days}', '12'), e.fact);
  return out;
}

/** 报告的口气；只由 voice.ts 在对应证据存在时选用，不另造世界事实。 */
export const ACTOR_VOICE = {
  禾: { idle: '这一幕我没动手。', action: '这事我确曾经手。', mind: '我在心里掂过此事。', said: '我说过：', fact: '我记下：', empty: '旁的，我不敢添话。', error: '我心里有了偏差。' },
  田伯: { idle: '这一幕我没动手。', action: '此事是我经的手。', mind: '这事我心里算过。', said: '我说了：', fact: '我记着：', empty: '旁的，我不替人认账。', error: '我也有算偏的时候。' },
  季: { idle: '这一幕我没动手。', action: '此事我曾亲自过问。', mind: '此事我在心中辨过。', said: '我曾言：', fact: '我记下：', empty: '我不拿空话充实据。', error: '我所料的，出了偏差。' },
  桑: { idle: '这一幕我没动手。', action: '这事是我做的。', mind: '我心里掂量过了。', said: '我说过：', fact: '我记着：', empty: '别的，我不敢乱说。', error: '我也有料不准的。' },
  小石: { idle: '这一幕我没动手。', action: '这事我做过。', mind: '这事我想过了。', said: '我说了：', fact: '我记住：', empty: '别的，我不敢乱讲。', error: '我先前想岔了。' },
} as const;
