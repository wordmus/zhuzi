import type { PlanAct, WorkEntry } from '../../engine/types';
export interface DeskData {
  works: WorkEntry[];
  rules: { id: string; text: string }[];
  history: { director: string; first: string; latest: string }[];
}
export function deskActs(budget: PlanAct['budget'], data?: DeskData): PlanAct[] {
  const layers = [
    { id: 'desk-entry', focus: 'desk-in', text: '先给你一件，再听你说', what: '案上一枚印', action: '往里看' },
    { id: 'desk-mentor', focus: 'desk-doing', text: '先听你说，再作判断', what: '导师对你的想法', action: '看它在做什么' },
    { id: 'desk-directors', focus: 'desk-shelf-in', text: '谁在做哪一件', what: '基础导演与叔衡各自的案', action: '看架上' },
    { id: 'desk-shelf', focus: 'desk-open', text: '一次拿起一件', what: '架上一件真实作品', action: '拿起进入' },
  ];
  return layers.map((s, i) => ({
    id: s.id, framework: 'desk', author: '基础导演', focus: s.focus, works: data?.works ?? [],
    elements: [{ id: s.focus, component: s.focus, represents: s.what, actions: [s.action],
      prominence: { x: .5, y: .5, scale: 1, brightness: 1, folded: false } }],
    lines: [{ id: 'entry', who: '导师', text: s.text }], reveal: [s.focus],
    withhold: ['其它层', '导师明细'], exit: i === 3 ? '新标签页打开作品或说明尚未装上' : '主动进入下一层',
    predict: { firstLook: s.focus, dwell: s.focus, surprise: s.what, firstActionMs: 100 }, budget,
  }));
}
