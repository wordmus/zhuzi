import type { PlanAct } from '../../engine/types';
import type { Presence } from '../../engine/layers/types';

type Evidence = { kind: string; [key: string]: unknown };
// 只说各形已有的约束；不把方案里的预测当作已发生的镜头或决定。
const rules: Record<string, [string, string, string]> = {
  desk: ['用逐层替换场景把案上、导师、导演和作品架分开。', '回看上一层需要退回，不能同时摊开。', '我一次只让一层在场。'],
  studio: ['把委托、回执印、提示灯和报告竹简依次放上同一张案。', '必须等前一件信物交接，才轮到下一件。', '我让信一件件过案。'],
  vignette: ['以单一焦点实物承接这一幕的动作。', '同一时刻只突出一件实物。', '我只把一件事放近。'],
  reveal: ['让帛卷按揭示顺序展开。', '未揭开的部分需要等待。', '我把帛一段段展开。'],
  walk2d: ['把行走、地景和可建议的地方放在同一横幅。', '视野沿横幅移动，不能同时靠近所有地方。', '我让路留在眼前。'],
  east3d: ['用立体地景与视角承接世界。', '地物会因视角发生遮挡。', '我让地面有了远近。'],
  film: ['按镜头表的顺序和时长交付画面。', '观看节奏受镜头时长约束。', '我让镜头接着走。'],
  gallery: ['把作品放进可逐件查看的画架。', '每次靠近一件作品。', '我把画一件件递近。'],
  chronicle: ['以年份卡把天下消息送到眼前的人。', '前后消息要逐张翻过。', '我把消息交到人前。'],
  'jixia-speakers': ['把诸家之言化作可递交的竹简。', '每次递交一种说法。', '我让话从简上传出。'],
  'wude-wheel': ['把德运设想放上可转动的盘。', '设想需要经过盘上的选择。', '我把设想放上盘。'],
  'qi-knife': ['把开仓顾虑放在刀币与秤前。', '决定要经过掂量。', '我让顾虑有了分量。'],
  bells: ['把机器与来客的往返交给钟声。', '需要听过前一声再回应。', '我留一声等你回。'],
  console: ['把机器的当前工作收束在案上的机杼。', '一次只交出当前工作。', '我把手边这件交出。'],
};

export function presenceFor(act: PlanAct, trace: Evidence[]): Presence {
  const [shape, cost, sentence] = rules[act.framework] ?? ['按这一幕唯一焦点安排呈现。', '同一时刻只突出一个焦点。', '我只把眼前这件交出。'];
  const opened = act.framework === 'desk' && trace.some(e => e.eventKind === 'desk.work.open');
  const caught = act.framework === 'studio' && trace.some(e => e.kind === 'director.compare' && e.act === act.id);
  const payload: Presence = {
    shape: opened ? '抽出选中的作品帛条，并在新页为这一件作品开门。' : caught ? '接住演员报告后，把真实回报留在案上，再放下呈现短简。' : shape,
    cost: opened ? '作品要在另一页观看，入口不同时摊开全文。' : cost,
    sentence: opened ? '我只为这一卷开门。' : caught ? '我把回报留在案上。' : sentence,
  };
  const withheld = Array.isArray(act.withhold) ? act.withhold.filter(s => typeof s === 'string' && s.trim()) : [];
  if (withheld.length) payload.withheld = [...withheld];
  return payload;
}

