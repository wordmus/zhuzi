// Optional at build time: absence must stay an empty chronicle.
const files = import.meta.glob('../../director/seed-memory/experience.json', { eager: true, import: 'default' });
export interface DeskExperience {
  id: string; title?: string; rule: string; why: string; source: string;
  param: unknown; caseRefs: number[]; evidence: { kind: string; ref: string }; violated?: boolean;
}
const memoryNames: Record<string, string> = {
  'one-focus': '一处', 'first-3s': '初见', 'one-sentence': '惜字', 'no-labels': '物件',
  'first-loop-readable': '明白', feedback: '回应', 'attention-budget': '光随', 'behavior-first': '行为',
  'tradeoff-visible': '取舍', 'landmarks-fixed': '地标', 'change-in-front': '变化', 'one-take': '一镜',
  tone: '人言', 'give-then-ask': '先给', continuity: '来前', response: '来访', anticipate: '改猜',
  timing: '时机', persistence: '自主', control: '自作', 'peak-end': '峰尾', 'leave-a-thread': '留线',
  'fold-when-understood': '收卷', 'plans-not-state': '计划', 'revision-trace': '改稿',
  'change-budget': '有度', sediment: '成习', chronicle: '年谱',
};
export const memoryTitle = (entry: DeskExperience) => memoryNames[entry.id] ?? '年谱';
export function deskExperience(): DeskExperience[] {
  const data = Object.values(files)[0] as { entries?: DeskExperience[] } | undefined;
  return Array.isArray(data?.entries) ? data.entries.filter(e => e.id && e.source && e.evidence?.ref) : [];
}
