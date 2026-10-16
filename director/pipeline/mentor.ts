import type { ActorCue, Commission, DirectorAck } from '../../engine/layers/types';
import type { Plan } from '../../engine/types';

/** 编排本身不读时钟和存储；运行时把真实委托交进来再承接。 */
export function acceptCommission(plan: Plan, commission?: Commission): Pick<Plan, 'commission' | 'ack' | 'cues'> {
  const cues: Record<string, ActorCue> = {};
  for (const act of plan.acts) {
    const text = [...act.elements.map(e => e.represents), ...act.lines.map(l => l.who)].join('；').replace(/四季|季节|季度/g, '');
    const actors = plan.world.people.filter(p => act.elements.some(e => e.id === p.id) || text.includes(p.name));
    const names = actors.map(p => p.name);
    if (act.elements.some(e => e.component === 'mentor') || act.lines.some(l => l.who === '导师')) names.push('导师');
    if (!names.length) names.push(plan.intent.perspective.who || '禾');
    for (const who of new Set(names)) {
      const person = actors.find(p => p.name === who);
      cues[`${act.id}:${who}`] = {
        act: act.id, who, expects: act.predict.surprise,
        freedom: who === '导师' ? '按真实来访记忆说话，允许用户不留名字' : '按自身心智、所见事实与世界压力行动；可以偏离导演预期',
        initialState: { seed: plan.seed, focus: act.focus, person: person ?? { name: who }, world: plan.world },
        constraints: [...plan.constitution, '不得把预演写成已发生的事实', `每屏最多${act.budget.maxChars}字`],
      };
    }
  }
  const changes: string[] = [];
  if (commission?.userModel.dayPart === '深夜' && plan.acts.length > 1) changes.push('深夜灯油减半；保留既定幕序，让每幕可及时离开');
  if (commission?.userModel.dwellTop) changes.push(`保留${commission.userModel.dwellTop}的来访线索，演员仍按世界事实决定`);
  const ack: DirectorAck = {
    planId: plan.id, version: plan.version, director: { id: plan.director.id, name: plan.director.name },
    acts: plan.acts.map(({ id, framework, author, focus }) => ({ id, framework, author, focus })),
    accept: commission ? `接下这${plan.acts.length}幕，按事实交付。` : `这${plan.acts.length}幕等候导师委托。`,
    changes, rehearsal: plan.rehearsal.map(r => ({ ...r })),
  };
  return { ...(commission ? { commission } : {}), ack, cues };
}
