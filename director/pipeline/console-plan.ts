import type { PlanAct, PlanElement } from '../../engine/types';

export function consoleActs(budget: PlanAct['budget']): PlanAct[] {
  const element = (id: string, component: string, represents: string, actions: string[]): PlanElement => ({
    id,
    component,
    represents,
    actions,
    prominence: { x: 0.5, y: 0.5, scale: 1, brightness: 1, folded: false },
  });

  return [
    {
      id: 'console',
      framework: 'console',
      author: '基础导演',
      focus: 'panel-mentor',
      elements: [
        element('panel-mentor', 'dom-panel', '导师栏：心智当前念头、假设清单、灯油分配与来访史', ['纠正假设', '调灯油', '看依据']),
        element('panel-director', 'dom-panel', '导演栏：各导演毛坯与交付状态、规则工作台', ['查看细节']),
        element('panel-works', 'dom-panel', '呈现栏：作品卡架、形式档位与事实印、进入作品', ['展开理由', '进入']),
        element('panel-status', 'status-bar', '状态条：本地规则运行状态、未接模型标注、最近事实时间', []),
      ],
      lines: [
        { id: 'console-welcome', who: '导师', text: '机器醒着，这是它的仪表。', when: 'enter' },
      ],
      reveal: ['panel-mentor', 'panel-director', 'panel-works', 'panel-status'],
      withhold: ['长段说教', '虚假样品', '场景与人物'],
      exit: 'console:exit',
      predict: {
        firstLook: 'panel-mentor',
        dwell: 'panel-mentor',
        surprise: '仪表没有人物场景，所有数据真实可动',
        firstActionMs: 300,
      },
      budget: { ...budget },
    },
  ];
}
