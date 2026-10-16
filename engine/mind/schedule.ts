import type { VisitRecord } from '../../app/context';
import type { Hypothesis } from './hypotheses';

export interface ScheduleEntry {
  intentId: string;
  title: string;
  form: string;
  order: number;
  when: 'next' | 'later' | 'dropped';
  why: string;
  evidence: { kind: string; ref: string };
}

export interface Schedule { version: number; entries: ScheduleEntry[] }

/** Structural inputs keep the browser independent of the Node-only index builders. */
export interface ScheduleWork {
  intent: string;
  title: string;
  form: string;
  seed?: number;
  tier?: string;
  url?: string | null;
  madeAt?: string;
  facts?: { id: string; text: string; kind: string }[];
}

export interface ScheduleExperienceEntry {
  id: string;
  rule: string;
  why?: string;
  source?: string;
  title?: string;
  evidence: { kind: string; ref: string };
  violated?: boolean;
  runEvidence?: readonly { ref: string; outcome: string }[];
}

export type ScheduleExperience = { entries: readonly ScheduleExperienceEntry[] } | readonly ScheduleExperienceEntry[];
export interface ScheduleInput {
  visits: number;
  previous?: VisitRecord | null;
  hypotheses?: readonly Hypothesis[];
  works?: readonly ScheduleWork[];
  experience?: ScheduleExperience | null;
}

const cut = (text: string, n: number) => [...text].slice(0, n).join('');
const tidy = (text: string) => text.replace(/\s+/g, ' ').trim();
/** 场景牌与台词里的短名：用能读的简称，别把词截成半截（「咖啡厅入口总」）。正式名以 index.json 为准。 */
const aliases: Record<string, string> = {
  'cafe-map': '咖啡厅入口', console: '机器仪表', desk: '导师台', 'east-suburb-3d': '东郊3D',
  'fifty-years': '五十年长卷', 'first-visit': '第一次来访', 'han-act1': '旱', 'mentor-desk': '导师台',
  'shelf-gallery': '作品架', studio: '案上回信', 'three-look-at-sky': '三人看天',
};
const shortTitle = (work: ScheduleWork, n: number) => {
  const base = tidy(aliases[work.intent] ?? work.title);
  if ([...base].length <= n) return base;
  const head = base.split(/[·:：，,（(、]/)[0]!.trim();
  return [...head].length <= n ? head : cut(head, n);
};
/** 用户原话只取第一小句，避免半句话。 */
const firstClause = (text: string, n: number) => {
  const clean = tidy(text);
  const head = clean.split(/[。；;！!？?，,、]/)[0]!.trim() || clean;
  return [...head].length <= n ? head : cut(head, n);
};
const workRef = (work: ScheduleWork) => `runs/index.json#${work.intent}/${work.seed ?? '?'}/${work.tier ?? '?'}`;
const matches = (text: string, work: ScheduleWork) => {
  const haystack = `${work.intent} ${work.title} ${work.form} ${(work.facts ?? []).map(f => `${f.id} ${f.text}`).join(' ')}`;
  const tokens = text.split(/[^\p{L}\p{N}-]+/u).filter(t => [...t].length >= 2);
  return tokens.some(t => haystack.includes(t)) || [...work.title].some((_, i, chars) => {
    const pair = chars.slice(i, i + 2).join('');
    return pair.length === 2 && text.includes(pair);
  });
};

/** Only supplied evidence can introduce a candidate; an empty index stays empty. */
export function buildSchedule(input: ScheduleInput): Schedule {
  const works = [...(input.works ?? [])].filter(w => w && w.intent && w.title && w.form && w.intent !== 'desk');
  // The index contains several seeds of one work; schedule the work only once.
  works.sort((a, b) => (b.madeAt ?? '').localeCompare(a.madeAt ?? '') || workRef(a).localeCompare(workRef(b)));
  const byIntent = new Map<string, ScheduleWork>();
  for (const work of works) if (!byIntent.has(work.intent)) byIntent.set(work.intent, work);
  const unique = [...byIntent.values()];
  const corrected = input.hypotheses?.find(h => h.status === 'edited' && tidy(h.text));
  const affirmed = input.hypotheses?.find(h => h.status === 'active' && h.confidence >= .75 && tidy(h.text));
  const withdrawn = input.hypotheses?.find(h => h.status === 'retired');
  const preference = corrected ?? affirmed;
  const dwell = Object.entries(input.previous?.dwell ?? {})
    .filter(([, ms]) => Number.isFinite(ms) && ms > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const rawExperience = input.experience;
  const experience: readonly ScheduleExperienceEntry[] = !rawExperience ? []
    : 'entries' in rawExperience && !Array.isArray(rawExperience) ? rawExperience.entries as readonly ScheduleExperienceEntry[]
    : rawExperience as readonly ScheduleExperienceEntry[];
  // A rule's existence or a successful case is not proof it was violated.
  const violations = experience.flatMap(entry => {
    const observed = (entry.runEvidence ?? []).filter(e => e.outcome === 'violated' && e.ref)
      .map(e => ({ entry, ref: e.ref }));
    if (observed.length) return observed;
    return entry.evidence?.ref && (entry.violated === true || /violation|violated|failure|failed/.test(entry.evidence.kind))
      ? [{ entry, ref: entry.evidence.ref }] : [];
  });
  const ranked = unique.map(work => {
    const violation = violations.find(e => e.ref.includes(`runs/${work.intent}/`));
    let score = 0;
    let why = '按顺序，轮到这件';
    let evidence: ScheduleEntry['evidence'] = { kind: 'work', ref: workRef(work) };
    if (violation) {
      score += 30;
      why = `上回没做到「${firstClause(violation.entry.title ?? violation.entry.rule, 8)}」，重看`;
      evidence = { kind: 'rule-violation', ref: violation.ref };
    }
    // 你改过或留下的话只贴给它真的指到的那件；指不到时留给榜首（下面 rank 之后再落一次）。
    if (preference && matches(preference.text, work)) {
      score += 80;
      why = `${corrected ? '你改说' : '你留下'}${firstClause(preference.text, 10)}，先试`;
      evidence = { kind: corrected ? 'hypothesis-correction' : 'hypothesis',
        ref: `mentor.hypotheses#${preference.id}:${preference.status}:${tidy(preference.text)}` };
    }
    return { work, score, why: cut(why, 18), evidence };
  });
  ranked.sort((a, b) => b.score - a.score || a.work.intent.localeCompare(b.work.intent));
  // 会话级的理由（你上次停在哪、你改过的话指不到具体件）只落在榜首那一件上，
  // 且只在榜首自己没有更强的理由（真违反）时才落；否则十件都掛同一句就是冒领。
  const top = ranked[0];
  if (top && top.evidence.kind === 'work') {
    const dwellLabel = dwell ? ({ mentor: '导师身旁', ticket: '票根', door: '门口', name: '称呼处',
      'desk-in': '案上', 'desk-doing': '导师案前', 'desk-shelf-in': '导演案前',
      'desk-details': '明细', 'desk-open': '作品架' } as Record<string, string>)[dwell[0]] : undefined;
    if (dwell) {
      top.why = matches(dwell[0], top.work) ? `上回在${shortTitle(top.work, 6)}停住，再看`
        : dwellLabel ? `上回停在${dwellLabel}，接着看` : '上回停得久，先接着看';
      top.evidence = { kind: 'dwell', ref: `visit.last.dwell[${JSON.stringify(dwell[0])}]=${dwell[1]};visit=${input.previous!.n}` };
    } else if (preference) {
      top.why = `${corrected ? '你改说' : '你留下'}${firstClause(preference.text, 10)}，先试`;
      top.evidence = { kind: corrected ? 'hypothesis-correction' : 'hypothesis',
        ref: `mentor.hypotheses#${preference.id}:${preference.status}:${tidy(preference.text)}` };
    } else if (withdrawn) {
      top.why = `旧猜测已撤，换看${shortTitle(top.work, 8)}`;
      top.evidence = { kind: 'hypothesis-retired', ref: `mentor.hypotheses#${withdrawn.id}:retired:${withdrawn.text}` };
    }
  }
  return { version: 1, entries: ranked.map(({ work, why, evidence }, order) => ({
    intentId: work.intent, title: shortTitle(work, 6), form: work.form, order,
    when: order === 0 ? 'next' : 'later', why, evidence,
  })) };
}

/** Merge only known works, preserving user decisions while refreshing their evidence. */
export function applySavedSchedule(current: Schedule, saved: Schedule | null | undefined): Schedule {
  if (!saved || !Array.isArray(saved.entries)) return current;
  const known = new Map(current.entries.map(e => [e.intentId, e]));
  const used = new Set<string>();
  const entries: ScheduleEntry[] = [];
  for (const entry of saved.entries) {
    const fresh = entry && known.get(entry.intentId);
    if (!fresh || used.has(entry.intentId)) continue;
    used.add(entry.intentId);
    const when = ['next', 'later', 'dropped'].includes(entry.when) ? entry.when : 'later';
    entries.push({ ...fresh, order: Number.isFinite(entry.order) ? entry.order : entries.length, when,
      why: fresh.evidence.ref === entry.evidence?.ref && typeof entry.why === 'string' ? cut(entry.why, 18) : fresh.why });
  }
  entries.push(...current.entries.filter(e => !used.has(e.intentId)).map(e => ({ ...e, when: 'later' as const, order: entries.length + e.order })));
  entries.sort((a, b) => Number(a.when === 'dropped') - Number(b.when === 'dropped') ||
    Number(b.when === 'next') - Number(a.when === 'next') || a.order - b.order);
  const hadNext = saved.entries.some(e => e && e.when === 'next');
  let hasNext = !hadNext;
  return { version: 1, entries: entries.map((entry, order) => {
    const when = entry.when === 'dropped' ? 'dropped' : hasNext ? 'later' : 'next';
    if (when === 'next') hasNext = true;
    return { ...entry, order, when };
  }) };
}
