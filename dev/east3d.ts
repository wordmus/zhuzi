import { east3d } from '../frameworks/east3d';
import { bootOne } from './harness';
import type { PlanAct, PlanElement } from '../engine/types';

const items: [string, string, string][] = [
  ['east-crack', '田缝：手按下去的地方', '碰'],
  ['east-sky', '天：望上去的地方', '望'],
];
const elements: PlanElement[] = items.map(([id, represents, action]) => ({
  id, component: 'east3d-object', represents, actions: [action],
  prominence: { x: 0.5, y: 0.5, scale: 1, brightness: 1, folded: false },
}));
const act: PlanAct = {
  id: 'east3d-selftest', framework: 'east3d', author: '自测导演', focus: 'east-crack',
  elements,
  lines: [{ id: 'he-sky', who: '禾', text: '天老爷，你是忘了东郊，还是忘了我？', when: 'after:east-sky' }],
  reveal: elements.map(e => e.id),
  withhold: [],
  exit: '碰过田缝、也望过天',
  predict: { firstLook: 'east-crack', dwell: 'east-crack', surprise: '日轮从地平线上升起' },
  budget: { maxChars: 30, maxActionsFirst3s: 1, feedbackMs: 100 },
};
bootOne(act, east3d, '禾').catch(console.error);
