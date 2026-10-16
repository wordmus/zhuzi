// 东郊 · 3D（L3）的呈现方案：事实账本不变，只换画面。
// 与 L1 的 reveal 幕同义（碰田缝 / 望天），资产来自 assets/library/east3d（本机程序化生成）。

import type { PlanAct } from '../../engine/types';

export function east3dActs(budget: PlanAct['budget']): PlanAct[] {
  return [{
    id: 'east3d',
    framework: 'east3d',
    author: '叔衡',
    focus: 'east-crack',
    elements: [
      { id: 'east-crack', component: 'field-crack', represents: '田缝：手按下去的地方', actions: ['碰'], prominence: { x: 0.5, y: 0.72, scale: 1, brightness: 1, folded: false }, predict: '你会先伸手碰那条缝' },
      { id: 'east-sky', component: 'sky', represents: '天：望上去的地方', actions: ['望'], prominence: { x: 0.5, y: 0.12, scale: 1, brightness: 0.8, folded: false }, predict: '碰完缝你会抬头' },
    ],
    lines: [{ id: 'he-sky', who: '禾', text: '天老爷，东郊还有我呢。', when: 'after:east-sky' }],
    reveal: ['east-crack', 'east-sky'],
    withhold: ['解释文字', '数字', '结局名'],
    exit: '50s:crack-and-sky:done',
    predict: { firstLook: 'east-crack', dwell: 'east-crack', surprise: '日轮与禾的一句', firstActionMs: 1200 },
    budget,
  }];
}
