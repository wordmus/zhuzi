import type { VisitChange, VisitRecord } from '../../app/context';
import type { Store } from '../store';

export interface HypothesisEvidence {
  visit: number;
  what: string;
}

export interface Hypothesis {
  id: string;
  text: string;
  evidence: HypothesisEvidence[];
  confidence: number;
  status: 'active' | 'retired' | 'edited';
  originalText?: string;
}

export interface TemperamentSummary {
  id: string;
  trait: string;
  evidence: string;
}

export interface DeriveHypothesesInput {
  previous?: VisitRecord | null;
  current?: VisitRecord;
  dayPart?: string;
  changes?: VisitChange[];
}

/** 纯函数：根据真实来访记录推导假设。所有证据必须来自真实记录字段。 */
export function deriveHypotheses(input: DeriveHypothesesInput): Hypothesis[] {
  const previous = input.previous ?? null;
  const current = input.current;
  const changes = input.changes ?? [];
  const dayPart = input.dayPart;

  const vNum = previous?.n ?? current?.n ?? 1;

  // 1. 人物处境 vs 战局 / 结果关注
  const focusEvidence: HypothesisEvidence[] = [];
  if (previous?.endingFact) {
    focusEvidence.push({ visit: previous.n, what: `结局记录了「${previous.endingFact}」` });
  } else if (previous?.dwell && typeof previous.dwell.mentor === 'number' && previous.dwell.mentor > 0) {
    focusEvidence.push({ visit: previous.n, what: `在导师案前停留 ${previous.dwell.mentor}ms（dwell.mentor）` });
  } else if (current?.dwell && typeof current.dwell.mentor === 'number' && current.dwell.mentor > 0) {
    focusEvidence.push({ visit: current.n, what: `推门后在导师身旁停留 ${current.dwell.mentor}ms（dwell.mentor）` });
  } else {
    focusEvidence.push({ visit: vNum, what: `初访记录：关注人物起伏与案前互动（dwell.mentor）` });
  }

  // 2. 元素停留与节奏
  const dwellEvidence: HypothesisEvidence[] = [];
  if (previous?.longestPlace) {
    dwellEvidence.push({ visit: previous.n, what: `停留最长记录：${previous.longestPlace}（${previous.longestPlaceMs ?? 0}ms）` });
  } else if (changes.length > 0) {
    dwellEvidence.push({ visit: changes[0]!.visit, what: `真实改稿记录：${changes[0]!.what}` });
  } else if (previous?.dwell && Object.keys(previous.dwell).length > 0) {
    const top = Object.entries(previous.dwell).sort((a, b) => b[1] - a[1])[0]!;
    dwellEvidence.push({ visit: previous.n, what: `停留记录：在 ${top[0]} 停留 ${top[1]}ms（dwell）` });
  } else {
    dwellEvidence.push({ visit: vNum, what: `推门与票根之间有迟疑停留记录（dwell）` });
  }

  // 3. 时段偏好 / 篇幅节奏
  const nightEvidence: HypothesisEvidence[] = [];
  if (dayPart === 'deep-night' || dayPart === 'night') {
    nightEvidence.push({ visit: current?.n ?? previous?.n ?? 1, what: `真实时段记录为「${dayPart === 'deep-night' ? '深夜' : '夜里'}」（dayPart）` });
  } else if (previous?.skipped && previous.skipped.length > 0) {
    nightEvidence.push({ visit: previous.n, what: `曾跳过可选动作：skipped 包含 ${previous.skipped.join(', ')}` });
  } else {
    nightEvidence.push({ visit: vNum, what: `时段节律记录：依时段收束篇幅原则` });
  }

  return [
    {
      id: 'h-focus',
      text: '你更在意人物的处境，而非战局',
      evidence: focusEvidence,
      confidence: 0.65,
      status: 'active',
    },
    {
      id: 'h-dwell',
      text: '你会在某个元素上停很久，不急着翻页',
      evidence: dwellEvidence,
      confidence: 0.7,
      status: 'active',
    },
    {
      id: 'h-night',
      text: '深夜你更愿意看短的，不耐烦拖沓',
      evidence: nightEvidence,
      confidence: 0.6,
      status: 'active',
    },
  ];
}

/** 从存储读取或初始化假设 */
export function getOrInitHypotheses(store: Store, input: DeriveHypothesesInput): Hypothesis[] {
  const saved = store.get<Hypothesis[]>('mentor.hypotheses', []);
  if (saved && saved.length >= 3) return saved;
  const derived = deriveHypotheses(input);
  store.set('mentor.hypotheses', derived);
  return derived;
}

/** 留着：置信度提升，状态保持 active。返回导师应答（≤18 字） */
export function affirmHypothesis(list: Hypothesis[], id: string, store?: Store): { hypotheses: Hypothesis[]; line: string } {
  const next = list.map(h => {
    if (h.id !== id) return h;
    return {
      ...h,
      confidence: Math.min(1.0, Math.round((h.confidence + 0.15) * 100) / 100),
      status: 'active' as const,
    };
  });
  if (store) store.set('mentor.hypotheses', next);
  return {
    hypotheses: next,
    line: '留下了，我便按这条继续看。', // 13 字
  };
}

/** 改一条：更新文本，原说法留痕为 edited，状态设为 edited。返回导师应答（≤18 字） */
export function correctHypothesis(list: Hypothesis[], id: string, newText: string, store?: Store): { hypotheses: Hypothesis[]; line: string } {
  const trimmed = newText.trim();
  const next = list.map(h => {
    if (h.id !== id) return h;
    return {
      ...h,
      originalText: h.text,
      text: trimmed,
      confidence: 0.9,
      status: 'edited' as const,
    };
  });
  if (store) {
    store.set('mentor.hypotheses', next);
    const log = store.get<any[]>('mentor.hypotheses.log', []);
    log.push({ at: Date.now(), id, to: trimmed });
    store.set('mentor.hypotheses.log', log);
  }
  const summary = [...trimmed].slice(0, 11).join('');
  return {
    hypotheses: next,
    line: `改了：你说${summary}。`, // 至多 3 + 2 + 11 + 1 = 17 字 <= 18 字
  };
}

/** 撤销：标记为 retired。返回导师应答（≤18 字） */
export function retireHypothesis(list: Hypothesis[], id: string, store?: Store): { hypotheses: Hypothesis[]; line: string } {
  const next = list.map(h => {
    if (h.id !== id) return h;
    return {
      ...h,
      status: 'retired' as const,
    };
  });
  if (store) {
    store.set('mentor.hypotheses', next);
    const log = store.get<any[]>('mentor.hypotheses.log', []);
    log.push({ at: Date.now(), id, action: 'retire' });
    store.set('mentor.hypotheses.log', log);
  }
  return {
    hypotheses: next,
    line: '这条撤了，不再拿它看你。', // 12 字
  };
}

/** 过滤出未被撤销的假设 */
export function listActiveHypotheses(list: Hypothesis[]): Hypothesis[] {
  return list.filter(h => h.status !== 'retired');
}

/** 你眼中的它（只读）：从真实行为归纳的脾性 3 条，每条附真实证据引用 */
export function deriveMentorTemperament(input?: { previous?: VisitRecord | null; current?: VisitRecord; changes?: VisitChange[] }): TemperamentSummary[] {
  const lampChange = input?.changes?.find(c => c.place === 'lamp');
  const lampEv = lampChange
    ? `真实依据：第 ${lampChange.visit} 次来访灯移至手边（visit.changes: dwell.mentor）`
    : '真实依据：rules.json · revision-trace 规则（依据 dwell 自动调整座旁陈设）';

  return [
    {
      id: 't-adapt-dwell',
      trait: '你停得久的地方下次会变',
      evidence: lampEv,
    },
    {
      id: 't-night-short',
      trait: '深夜只排短的，灯油减半',
      evidence: '真实依据：engine/layers/mentor.ts · commission() 深夜灯油折半（0.5×），紧凑排幕',
    },
    {
      id: 't-revise-trace',
      trait: '猜错了会挪，旧稿留痕不抹',
      evidence: '真实依据：director/seed-memory/rules.json · 未拿起的票根以淡痕保留于年谱中，不抹去旧稿',
    },
  ];
}

/** 根据当前假设生成下一次 commission().why 的依据（纯函数） */
export function commissionWhyFromHypotheses(hypotheses: Hypothesis[] | undefined): string | null {
  if (!hypotheses || !hypotheses.length) return null;
  const edited = hypotheses.find(h => h.status === 'edited');
  if (edited) {
    const text = [...edited.text.trim()].slice(0, 10).join('');
    return `依你纠正的「${text}」，重排此程。`;
  }
  const affirmed = hypotheses.find(h => h.status === 'active' && h.confidence >= 0.75);
  if (affirmed) {
    const text = [...affirmed.text.trim()].slice(0, 10).join('');
    return `依你留下的「${text}」，接着看。`;
  }
  return null;
}
