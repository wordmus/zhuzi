import { bells } from '../frameworks/bells';
import { bootMinigame } from '../frameworks/qi-knife/dev-harness';
import { NOTES } from '../frameworks/bells/logic';
import type { PlanAct, PlanElement } from '../engine/types';

const elements: PlanElement[] = [{ id: 'bells-start', component: 'bell', represents: '机器的第一盏记忆灯', actions: ['begin'], prominence: { x: 0.168, y: 0.5, scale: 1, brightness: 1, folded: false } }, ...NOTES.map((name, i) => ({ id: `bell-${i}`, component: 'bell', represents: `${name}钟`, actions: ['strike'], prominence: { x: 0.168 + i * 0.166, y: 0.5, scale: 1, brightness: 0.5, folded: false } }))];
const act: PlanAct = { id: 'bells-selftest', framework: 'bells', author: '自测导演', focus: 'bells-start', elements, lines: [{ id: 'remember', who: '导师', text: '这个，我记着。' }], reveal: elements.map(e => e.id), withhold: [], exit: '回成三轮，留下机器的记忆', predict: { firstLook: 'bells-start', dwell: 'bell-0', surprise: 'bell-4' }, budget: { maxChars: 30, maxActionsFirst3s: 1, feedbackMs: 100 } };
bootMinigame(act, bells, '导师').catch(console.error);
