import type { ActorReport } from './types.ts';
import { ACTOR_VOICE } from '../world/lines.ts';

type Evidence = Pick<ActorReport, 'who' | 'did' | 'error' | 'facts' | 'seeds'>;
const forbidden = /茶|米|百分比|数字|[0-9０-９%％]/u;
const administrative = /^(处理本幕提示|本幕未留下|复核原件：)|已接收提示信$/u;
const concepts: Record<string, string> = { zou: '走', tianbo: '田伯', she: '社', tian: '天', jia: '家', su: '粟', di: '地', deng: '等' };

/** 只截取原证词，并标省略；不把残句补成新的事实。 */
function quote(prefix: string, evidence: string): string | undefined {
  const text = evidence.trim().replace(/^说：/u, '').replace(/^《[^》]+》交付：/u, '').replace(/[。！？；].*$/u, '');
  if (/预演：|实际：|处理本幕|真实回报|复核原件/u.test(text)) return;
  if (!text || forbidden.test(text)) return;
  const room = 18 - [...prefix].length - 1;
  return prefix + ([...text].length > room ? [...text].slice(0, room - 1).join('') + '…' : text) + '。';
}

/** 纯函数：只读已归属演员的 did 和已交付的 error / seeds / facts，不读导演预期。 */
export function actorVoice(report: Evidence): string[] {
  const grammar = ACTOR_VOICE[report.who as keyof typeof ACTOR_VOICE] ?? ACTOR_VOICE.禾;
  const actions = report.did.filter(line => !administrative.test(line));
  const action = actions.find(line => line.startsWith('说：')) ?? actions.at(-1);
  let first: string = grammar.idle;
  if (action) {
    first = action.startsWith('说：')
      ? quote(grammar.said, action) ?? '这一幕我确曾开口。'
      : /层|误差|观测|预演|心智|单元|概念/u.test(action)
        ? grammar.mind
        : quote('我经手：', action) ?? grammar.action;
  }
  const voice = [first];
  // 误差大小并非总超过门槛；只有已记明的偏差才声称料偏了。
  if (report.error && report.error.e !== undefined && report.error.eps !== undefined && report.error.e > report.error.eps) voice.push(grammar.error);
  const seed = report.seeds?.find(s => s.concept && !forbidden.test(s.concept));
  if (seed && voice.length < 3) {
    const concept = concepts[seed.concept] ?? seed.concept;
    const line = quote('我心里留着：', concept);
    if (line) voice.push(line);
  }
  const fact = [...report.facts].reverse().find(f => !forbidden.test(f.text));
  if (fact && voice.length < 3) {
    const line = quote(grammar.fact, fact.text);
    if (line) voice.push(line);
  }
  if (voice.length === 1 && report.error) voice.push('我把所料与实情对照了。');
  if (voice.length === 1) voice.push(grammar.empty);
  return voice;
}
