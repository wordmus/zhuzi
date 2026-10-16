import type { Ctx, Framework, ActResult } from '../../app/context';
import type { Fact, Ending } from '../../engine/types';
import { vignette } from '../../frameworks/vignette';
import { reveal } from '../../frameworks/reveal';
import { walk2d } from '../../frameworks/walk2d';
import { chronicle } from '../../frameworks/chronicle';
import { jixiaSpeakers } from '../../frameworks/jixia-speakers';
import { wudeWheel } from '../../frameworks/wude-wheel';
import { qiKnife } from '../../frameworks/qi-knife';
import { bells } from '../../frameworks/bells';
import { createLongscroll, type Longscroll } from './fifty-years-state';

function connect(ctx: Ctx): Longscroll {
  if (ctx.handoff.longscroll) return ctx.handoff.longscroll as Longscroll;
  const scroll = createLongscroll(ctx.store);
  ctx.handoff.longscroll = scroll;
  ctx.handoff.ledger = scroll.ledger();
  if (scroll.ending) ctx.handoff.ending = scroll.ending;
  const originalLog = ctx.bus.log.bind(ctx.bus);
  // 游戏只交事实，不碰世界；在这一层补上历史年份并进入同一个只增账本。
  ctx.bus.log = (kind, data = {}) => {
    if (kind === 'world.fact' && data.fact) {
      const input = data.fact as Fact;
      const fact = { ...input, day: input.day ?? scroll.history.state().year + 356 };
      scroll.append(fact);
      ctx.handoff.ledger = scroll.ledger();
      return originalLog(kind, { ...data, fact });
    }
    return originalLog(kind, data);
  };
  // 这是读存档的事实快照；不重新触发事件和宏观变化。
  for (const fact of scroll.ledger()) originalLog('world.fact', { fact, restored: true });
  ctx.handoff.world = { ledger: scroll.ledger };
  return scroll;
}

const layers = ['vignette', 'reveal', 'jixia-speakers', 'jixia-speakers-ground', 'wude-wheel', 'wude-wheel-ground', 'qi-knife', 'bells'];
function wrap(framework: Framework): Framework {
  return { async run(act, ctx) {
    if (ctx.plan.id !== 'fifty-years') return framework.run(act, ctx);
    const scroll = connect(ctx);
    const previous = scroll.completed[act.id];
    // 入口和归来始终真实可玩；首张卡告诉重访者存档走到哪里。
    if (previous && !['threshold', 'return', 'chronicle-356'].includes(act.id)) {
      ctx.bus.log('world.event', { kind: 'history.resume', act: act.id, year: scroll.history.state().year });
      return { act: act.id, data: { ...previous.data, resumed: true, line: '这一章已留在长卷中。' } };
    }
    for (const id of layers) ctx.stage.removeLayer(id);
    ctx.lines.clear();
    const start = ctx.bus.trace.length;
    const result = await framework.run(act, ctx);
    const facts = ctx.bus.trace.slice(start).filter(e => e.kind === 'world.fact').map(e => e.fact as Fact);
    const metrics = result.data?.metrics as Record<string, number> | undefined;
    let decisions: Fact[] = [];
    if (act.id === 'han') {
      const ending = ctx.handoff.ending as Ending | undefined;
      decisions = scroll.decide(act.id, '禾', ending?.fact.text ?? '熬过旱年，留下自己的承诺', { grain: .01, minxin: .01 });
      // SimWorld 的日历与历史年份分开；对外账本合并，模拟内部仍读它自己的事实。
      const world = ctx.handoff.world as object;
      ctx.handoff.world = new Proxy(world, { get(target, key, receiver) { return key === 'ledger' ? scroll.ledger : Reflect.get(target, key, receiver); } });
    } else if (act.id === 'ji-wude') {
      const challenged = !!metrics?.mistakes;
      decisions = scroll.decide(act.id, '季', challenged ? '天命之说受驳，留下重辨的简' : '把齐水德设想写上简', { rites: challenged ? -.01 : .03, minxin: .02 });
    } else if (act.id === 'tianbo-knife') {
      const choice = metrics?.choice ?? 2;
      decisions = scroll.decide(act.id, '田伯', ['开仓施粥', '借粟立券', '关上粮仓'][choice]!,
        choice === 0 ? { grain: -.03, minxin: .06 } : choice === 1 ? { grain: -.02, minxin: -.01, power: .02 } : { grain: .02, minxin: -.05 });
    }
    for (const fact of decisions) ctx.bus.log('world.fact', { fact });
    const delivered: ActResult = { ...result, data: { ...result.data, facts: [...facts, ...decisions], history: scroll.history.state() } };
    if (!ctx.handoff.forgetVisit) scroll.complete(delivered, ctx.handoff.ending as Ending | undefined);
    ctx.handoff.ledger = scroll.ledger();
    return delivered;
  } };
}

/** app 只增加注册；包装器只在 fifty-years 意图生效，旧玩法原样委托。 */
export const fiftyYearsFrameworks: Record<string, Framework> = {
  vignette: wrap(vignette), reveal: wrap(reveal), walk2d: wrap(walk2d), chronicle: wrap(chronicle),
  'jixia-speakers': wrap(jixiaSpeakers), 'wude-wheel': wrap(wudeWheel), 'qi-knife': wrap(qiKnife), bells: wrap(bells),
};
