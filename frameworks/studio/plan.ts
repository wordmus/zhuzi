import type { PlanAct } from '../../engine/types';

export function studioAct(budget: PlanAct['budget']): PlanAct {
  const element = (id: string, component: string, represents: string, actions: string[]) => ({
    id, component, represents, actions,
    prominence: { x: .45, y: .52, scale: 1, brightness: 1, folded: false },
  });
  return {
    id: 'studio', framework: 'studio', author: '叔衡', focus: 'studio-commission',
    elements: [
      element('studio-commission', 'silk', '导师重新交来本次委托，叔衡亲自盖收件印', ['拿起']),
      element('studio-seal', 'seal', '叔衡的回执印与真实幕序的方案条', ['盖印']),
      element('studio-board', 'actor-board', '禾、季、田伯的真实提示信与收件灯', []),
      element('studio-report', 'bamboo', '本次演员报告原件，预演与实际并存', ['接住']),
    ],
    lines: [], reveal: ['studio-commission', 'studio-seal', 'studio-board', 'studio-report'],
    withhold: ['日志面板', '长段解释', '未来结果'], exit: 'report:archived',
    predict: { firstLook: 'studio-commission', dwell: 'studio-report', surprise: '演员的实际会改动案上的预演', firstActionMs: 2000 },
    budget: { ...budget },
  };
}
