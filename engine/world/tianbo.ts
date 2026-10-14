// 田伯怎样回应。真田伯与禾心里的小田伯用的是同一个函数 tianboModel：
// 真田伯代入真权重，小田伯代入禾的信念（心智引擎的 imagine 换参数，结构不变）。
// 结构决定回应，模型只负责把已定的回应说成一句话（gatePrompt）。

import type { Candidate } from '../mind';
import type { Approach, Response, Season, ThinkSpec, Trait, Weights } from '../types';
import { TRAIT_NAME } from '../types';

export interface GateScenario {
  approach: Approach;
  /** 仓里还有多少 0..1（征粮之后已折减） */
  granary: number;
  /** 门外乡邻的分量 0..1（只有带乡邻的来由才有人） */
  crowd: number;
  /** 田伯看得出的饥相 0..1 */
  hunger: number;
  /** 禾已经来过几次 */
  visits: number;
  requisitioned: boolean;
  season: Season;
  /** 田伯的骄傲；禾的想象里取 0.5 */
  pride: number;
}

/** 禾眼里各回应的价值（取代他自己的损益）；买地要看他多恋地 */
export function responseValue(r: Response, attachment: number, diSeed = 0): number {
  switch (r) {
    case 'give': return 1;
    case 'lend': return 0.75;
    case 'buy-land': return 0.6 - 0.45 * attachment - 0.15 * diSeed;
    default: return -0.3;
  }
}

/** 田伯的四种回应各自的偏好。纯函数，不碰随机，不碰日志。 */
export function tianboModel(w: Weights, s: GateScenario): Candidate[] {
  const A = s.approach;
  const f = (t: Trait) => (t === A ? 1 : 0.2);
  const v = Math.min(s.visits, 3);
  const scarcity = 1 - s.granary;
  // 情：来由对路，饥相越重越动心；多来几次，也软一点
  const mq = w.qing * f('qing') * (0.55 + 0.9 * s.hunger + (s.season === 'winter' ? 0.1 : 0)) * (1 + 0.1 * v);
  // 名：只有带了乡邻才有分量；同一招来多了，旁人也看腻
  const mm = w.ming * (A === 'ming' ? 0.3 + 1.1 * s.crowd : 0.06) * (1 - 0.08 * v);
  const ml = w.li * f('li');
  const M = mq + mm + ml;
  const E = mq + mm;
  // 给：情与名撑着，仓里越空越肉疼；借：利最爱，押了地才放心；买地：越饿越想买
  const give = 1.6 * E - 0.8 * w.li * (0.4 + scarcity) - 0.3;
  const lend = 0.9 * M + 0.55 * w.li * s.granary * (A === 'li' ? 1 : 0.45) + 0.05 - 0.2 * scarcity;
  const buy = w.li * (A === 'li' ? 1.25 : 0.5) * (0.4 + 1.3 * s.hunger) - 0.15 * scarcity;
  // 拒：仓越空越容易；来由打不到他在乎的地方，也容易
  const refuse = 0.24 + 0.3 * scarcity + 0.1 * s.pride + (s.requisitioned ? 0.03 : 0) + 0.3 * (0.4 - w[A]) - 0.3 * mm;
  return [
    { id: 'give', preference: give },
    { id: 'lend', preference: lend },
    { id: 'buy-land', preference: buy },
    { id: 'refuse', preference: refuse },
  ];
}

/** 不碰日志的纯预测 */
export function predictPure(w: Weights, s: GateScenario): Response {
  const c = tianboModel(w, s);
  let best = c[0]!;
  for (const x of c) if (x.preference > best.preference) best = x;
  return best.id as Response;
}

const APPROACH_TEXT: Record<Approach, string> = {
  qing: '提旧情（禾的父亲曾替你家扛过粟）',
  li: '押地（愿以东头的地作抵）',
  ming: '带着乡邻一同登门（门外站满了人）',
};
const RESPONSE_TEXT: Record<Response, string> = {
  give: '给粟，不要回报',
  lend: '借粟，但明年要还两倍',
  'buy-land': '不借，只肯买下他的地，用粟折价',
  refuse: '拒绝，不给',
};
const CARES: Record<Trait, string> = { qing: '旧情与人情', li: '粟与地契', ming: '脸面与旁人的眼光' };

function granaryWord(g: number): string {
  return g > 0.75 ? '满着' : g > 0.5 ? '还够' : g > 0.3 ? '吃紧' : '快见底了';
}

/** 交给模型「真的去想」的完整指令：回应已由结构定下，模型只负责说那一句。 */
export function gatePrompt(p: {
  response: Response;
  approach: Approach;
  scenario: GateScenario;
  weights: Weights;
  ruleLine: string;
}): string {
  const s = p.scenario;
  const top = (Object.keys(p.weights) as Trait[]).sort((a, b) => p.weights[b] - p.weights[a])[0]!;
  const extra: Record<Response, string> = {
    give: '语气可以勉强，也可以体面，但意思是给。',
    lend: '必须让禾听出：明年要还两倍。',
    'buy-land': '必须让禾听出：你要的是他的地，不是借粮。',
    refuse: '不必说明理由，或随口给一个不太站得住的理由。',
  };
  return [
    '你要扮演战国时齐国东郊的田伯：家有高墙门楼，仓里存着粟，在乡里说话有分量。',
    `农夫禾今天登门，他的来由是：${APPROACH_TEXT[p.approach]}。`,
    `你心里已经拿定了主意：${RESPONSE_TEXT[p.response]}。这个决定不可更改，你只负责把它说出口。`,
    `你此刻的处境：仓里的粟${granaryWord(s.granary)}；王的人${s.requisitioned ? '已经来征过粮' : '还没来征粮'}；`
      + `门外${s.crowd > 0.4 ? '站着不少乡邻' : '只有禾一个人'}；禾${s.hunger > 0.5 ? '面带饥色' : '还撑得住'}；这是禾第 ${s.visits + 1} 次登门。`,
    `你骨子里最在乎的是${CARES[top]}（${TRAIT_NAME[top]}），但不要说破。`,
    '请只写田伯开口说的这一句话。要求：',
    '1. 不超过 18 个字；战国口吻，朴实、短，可以带一点讽刺；',
    '2. 只写这一句，不要解释，不要加引号，不要写动作和旁白；',
    '3. 必须与上面已定的决定一致，不可改口；',
    '4. 不要出现现代词语，不要出现「米」「茶」，粟就叫粟。',
    extra[p.response],
    `参考的规则版本（可以换一种说法）：${p.ruleLine}`,
  ].join('\n');
}

export function gateThink(args: Parameters<typeof gatePrompt>[0]): ThinkSpec {
  return { kind: 'tianbo-line', prompt: gatePrompt(args), deadlineMs: 2500 };
}
