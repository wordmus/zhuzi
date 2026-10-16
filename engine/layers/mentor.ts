import type { VisitRecord } from '../../app/context';
import type { Senses } from '../senses';
import type { Store } from '../store';
import type { Intent, Plan, Tier } from '../types';
import type { ActorReport, Commission, MentorRetro } from './types';
import { commissionWhyFromHypotheses, type Hypothesis } from '../mind/hypotheses';

export interface MentorInput {
  seed: number;
  tier: Tier;
  visits: number;
  previous: VisitRecord | null;
  sinceLastMs: number;
  dayPart: ReturnType<Senses['dayPart']>;
  device: string;
  strength: number;
  store?: Store;
}

export interface MentorSession {
  record: VisitRecord;
  facts: { id: string; text: string; kind: string }[];
  touched: string[];
}

const short = (text: string, max = 30) => [...text].slice(0, max).join('');
const dayNames: Record<MentorInput['dayPart'], string> = {
  'deep-night': '深夜', dawn: '清晨', morning: '上午', noon: '中午', afternoon: '白天', dusk: '傍晚', night: '夜里',
};

export function createMentor(input: MentorInput) {
  const previous = input.previous ?? input.store?.get<VisitRecord | null>('visit.last', null) ?? null;
  const priorDwell = Object.entries(previous?.dwell ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const dwellTop = previous?.longestPlace ?? priorDwell[0]?.[0];
  const dayPart = dayNames[input.dayPart];
  return {
    commission(intent: Intent, plan: Plan): Commission {
      const late = input.dayPart === 'deep-night';
      const capacity = ({ L0: 0, L1: 1, L2: 3, L3: 6, L4: 10 })[input.tier];
      const lamp = Math.round(capacity * Math.max(0.2, Math.min(1, input.strength)) * (late ? 0.5 : 1) * (input.device === '手机' ? 0.8 : 1) * (input.visits === 1 ? 0.8 : 1) * 10) / 10;
      const variant = ((Math.trunc(input.seed) + input.visits) % 3 + 3) % 3;
      const dwellNames: Record<string, string> = { door: '门口', ticket: '票根', mentor: '导师身旁', name: '称呼处', 'seat-lamp': '座位的灯' };
      const place = plan.world.places.find(p => dwellTop === `walk2d-place-${p.id}`);
      const element = plan.acts.flatMap(a => a.elements).find(e => e.id === dwellTop);
      const dwellLabel = dwellTop ? dwellNames[dwellTop] ?? place?.name
        ?? (dwellTop.startsWith('heart-') ? '心象' : element?.represents.split(/[：:]/)[0])
        ?? (/^[\u3400-\u9fff]+$/.test(dwellTop) ? dwellTop : '上回停留处') : undefined;
      const first = ['第一次来，先让你推开门。', '还没有来访记录，先看禾这一件。', '初次见面，先给你一件再问。'];
      const returning = dwellLabel
        ? [`上回在${short(dwellLabel, 8)}停得久，接着看。`, `你惦记${short(dwellLabel, 8)}，再给它一次。`, `记着上回的${short(dwellLabel, 8)}，往下走。`]
        : previous?.endingFact
          ? [`上回${short(previous.endingFact, 12)}，接着看。`, `记着上回的收场，再试另一条路。`, `第${input.visits}次来，续上回的线。`]
          : [`第${input.visits}次来，门还给你留着。`, `上回还没收场，这回接着看。`, `你又来了，续上没走完的路。`];
      const hypotheses = input.store?.get<Hypothesis[]>('mentor.hypotheses', []);
      const hypothesisWhy = commissionWhyFromHypotheses(hypotheses);
      const why = hypothesisWhy ?? (!previous ? first[variant]! : input.sinceLastMs >= 7 * 86400000
        ? `隔了${Math.floor(input.sinceLastMs / 86400000)}天，先接回上次的线。` : returning[variant]!);
      const budgetNote = `${dayPart}·${input.device}·第${input.visits}次来；${late ? '夜深收短' : '按本机力气分灯'}，${plan.acts.length}幕${hypothesisWhy ? '·依培育调整' : ''}`;
      return {
        intentId: intent.id, title: intent.title, hypothesis: { ...intent.hypothesis }, target: intent.target, stop: intent.stop,
        budget: { tier: input.tier, lamp, note: budgetNote },
        userModel: { visits: input.visits, name: previous?.name, sinceLastMs: input.sinceLastMs, lastEnding: previous?.ending, dwellTop, dayPart, device: input.device },
        why: short(why),
      };
    },
    retro(plan: Plan, reports: ActorReport[], session: MentorSession): MentorRetro {
      const touched = new Set(session.touched);
      const promises = plan.acts.flatMap(act => act.elements
        .filter(e => e.actions.length && !touched.has(`${act.id}:${e.id}`))
        .map(e => `${act.id}：${e.represents}，尚未亲手碰过`));
      const facts = [...new Map(session.facts.map(f => [f.id, f])).values()];
      const errors = reports.filter(r => r.error);
      const actual = facts.at(-1)?.text ?? reports.at(-1)?.actual ?? '这次尚未交付事实';
      const memory = {
        intentId: plan.intent.id, ending: session.record.ending ?? null, facts: facts.map(f => f.id),
        reports: reports.length, predictionErrors: errors.length, promises,
      };
      return {
        intentId: plan.intent.id, predicted: plan.intent.target, actual,
        userModelDelta: { 'visit.last': structuredClone(session.record), 'mentor.last': memory },
        promises, next: promises.length ? `下次从${short(promises[0]!, 36)}接起` : '下次对照这次的事实，换一种来由再试',
      };
    },
  };
}
