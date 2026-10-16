import { qiKnife } from '../frameworks/qi-knife';
import { bootMinigame } from '../frameworks/qi-knife/dev-harness';
import type { PlanAct, PlanElement } from '../engine/types';

const items = [
  ['qi-scale', '刀币与秤', 'begin'], ['qi-people', '门外乡邻', 'weigh'], ['qi-king', '王的征粮令', 'weigh'], ['qi-home', '自家仓廪', 'weigh'], ['qi-name', '名声与围观', 'weigh'],
  ['qi-give', '开仓施粥', 'choose'], ['qi-lend', '借粟立券，明年还两倍', 'choose'], ['qi-close', '合上仓门', 'choose'],
];
const elements: PlanElement[] = items.map(([id, represents, action]) => ({ id: id!, component: 'qi-object', represents: represents!, actions: [action!], prominence: { x: 0.5, y: 0.5, scale: 1, brightness: 1, folded: false } }));
const act: PlanAct = { id: 'qi-knife-selftest', framework: 'qi-knife', author: '自测导演', focus: 'qi-scale', elements, lines: [], reveal: elements.map(e => e.id), withhold: [], exit: '三次掂量后决定仓门', predict: { firstLook: 'qi-scale', dwell: 'qi-people', surprise: 'qi-lend' }, budget: { maxChars: 30, maxActionsFirst3s: 1, feedbackMs: 100 } };
bootMinigame(act, qiKnife, '田伯').catch(console.error);
