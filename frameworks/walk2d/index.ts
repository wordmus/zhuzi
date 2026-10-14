// 占位框架：显示一句话和一个可做的事，点了就进入下一幕。
import type { Ctx, Framework } from '../../app/context';
import type { PlanAct } from '../../engine/types';

export const walk2d: Framework = {
  async run(act: PlanAct, ctx: Ctx) {
    const { stage, aff, lines } = ctx;
    lines.say({ who: act.author, text: `[walk2d] ${act.id}`, anchor: () => ({ x: stage.width / 2, y: stage.height / 2 }), sticky: true });
    await new Promise<void>((resolve) => {
      aff.add({ id: act.focus || act.id, label: '继续', shape: { kind: 'circle', x: stage.width / 2, y: stage.height / 2 + 60, r: 40 }, onActivate: resolve });
    });
    lines.clear();
    return { act: act.id };
  },
};
