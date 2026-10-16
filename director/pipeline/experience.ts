/** Director memory: browser-safe pure joins; Node I/O runs only for the CLI below.
 * Generate: pnpm exec tsx director/pipeline/experience.ts [--root /project]
 */
export interface ExperienceRule {
  id: string;
  text: string;
  source: string;
  param?: Record<string, unknown>;
}

export interface ExperienceEvidence {
  kind: 'case' | 'rule';
  /** Repository-relative file plus an explicit section / JSON pointer. */
  ref: string;
  note: string;
}

export interface ExperienceRunEvidence {
  kind: 'run';
  ref: string;
  when: string | null;
  check: string;
  value: number;
  /** The recorded bench threshold, which need not equal the rule target. */
  limit: number | null;
  ruleLimit: number;
  outcome: 'observed' | 'violated';
  benchPass: boolean | null;
  note: string;
}

export interface ExperienceEntry {
  id: string;
  title: string;
  rule: string;
  why: string;
  source: string;
  caseRefs: number[];
  /** Null means rules.json has no numeric/configuration parameter. */
  param: Record<string, unknown> | null;
  /** Earliest dated run observation, NOT the rule's unknown creation date. */
  firstSeenAt: string | null;
  evidence: ExperienceEvidence;
  runEvidence: ExperienceRunEvidence[];
  violated: boolean;
}

export interface DirectorExperience {
  version: 1;
  note: string;
  entries: ExperienceEntry[];
}

export interface ExperienceRun {
  /** A real run bench.json repository path, supplied by the caller. */
  ref: string;
  when?: unknown;
  checks?: unknown;
}

export interface ExperienceInput {
  rules: { rules: ExperienceRule[] };
  casesMarkdown?: string;
  runs?: ExperienceRun[];
}

const NOTE = '案例是设计文档，非试玩；运行记录只证明列出的测量项，不证明规则来源于该运行。firstSeenAt 是最早有日期的运行对照，非规则写入时间；无日期、无参数、无运行证据分别留 null、null、空数组。';
const RULES = 'director/seed-memory/rules.json';
const CASES = 'director/seed-memory/cases.md';
const captions: Record<string, [string, string]> = {
  'one-focus': ['一处焦点', '十样东西抢眼就找不到动作'],
  'first-3s': ['初见一事', '进门先让人找到能做的事'],
  'one-sentence': ['惜字如金', '导师抬头只说一句'],
  'no-labels': ['物件说话', '先看懂物件能做什么'],
  'first-loop-readable': ['首局明白', '求粮目标和动作要看得懂'],
  feedback: ['动即有应', '动手后要立刻看见回应'],
  'attention-budget': ['光随焦点', '其余退暗才看得见导师'],
  'behavior-first': ['行为显心', '显影本身教会人看懂'],
  'tradeoff-visible': ['取舍有痕', '理由等人追问再展开'],
  'landmarks-fixed': ['地标不移', '位置不变才看得见变化'],
  'change-in-front': ['眼前变化', '让看向的地方当场显影'],
  'one-take': ['一镜到底', '显影途中不切断眼前世界'],
  tone: ['人有诙谐', '角色说话可以歪而有理'],
  'give-then-ask': ['先予后问', '先给一局再问名字'],
  continuity: ['来前有事', '来客进门时导师仍在落笔'],
  response: ['记得来客', '停过的地方下次深一点'],
  anticipate: ['猜错会挪', '猜错之后要让人看见改动'],
  timing: ['择时开口', '专注时不打断'],
  persistence: ['自有主张', '不顺从也让人看得见'],
  control: ['他自作主', '你是心中声音由他做决定'],
  'peak-end': ['峰与结尾', '结尾落在回应上'],
  'leave-a-thread': ['留一条线', '最后一句留下未收口的事'],
  'fold-when-understood': ['懂即收起', '看懂的东西退到幕后'],
  'plans-not-state': ['计划可见', '报时间不能代替回应'],
  'revision-trace': ['改稿留痕', '改前的样子和理由要可追溯'],
  'change-budget': ['改动有度', '每次只改一两处并留下原因'],
  sediment: ['熟能成习', '连续奏效的做法才成为习惯'],
  chronicle: ['年谱对照', '第一天的样子留着对照今天'],
};

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const numeric = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const date = (v: unknown): string | null => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v)) ? v : null;
const short = (v: string, n: number) => Array.from(v).slice(0, n).join('');

/** Join only literal, backticked rule IDs within numbered case sections. */
function caseJoins(markdown: string): Map<string, number[]> {
  const result = new Map<string, number[]>();
  const sections = [...markdown.matchAll(/^##\s+案例\s+(\d+)\b[^\n]*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/gm)];
  for (const section of sections) {
    const n = Number(section[1]);
    // Narrative mentions are not automatically rule associations.
    for (const line of section[2]!.split('\n').filter(line => /^-\s*(违反|对应)[：:]/.test(line))) {
      for (const match of line.matchAll(/`([a-z][a-z0-9-]*)`/g)) {
        const refs = result.get(match[1]!) ?? [];
        if (!refs.includes(n)) refs.push(n);
        result.set(match[1]!, refs);
      }
    }
  }
  return result;
}

/** Only these three joins are supported by actual numeric bench measurements.
 * first3s measures action count, NOT animated focus; notext does NOT prove no-labels.
 */
function observations(rule: ExperienceRule, runs: ExperienceRun[]): ExperienceRunEvidence[] {
  const mapping: Record<string, [string, string, string]> = {
    'first-3s': ['first3s', 'actions', '仅对照前3秒可做的事，不推断视觉焦点'],
    'one-sentence': ['max-chars', 'maxChars', '仅对照可见字数，不推断句数'],
    feedback: ['feedback', 'ms', '仅对照反馈延迟p90，不推断每次动作或语义回应'],
  };
  const join = mapping[rule.id];
  const target = join && rule.param?.[join[1]];
  if (!join || !numeric(target) || (rule.id === 'first-3s' && rule.param?.seconds !== 3)) return [];
  return runs.flatMap(run => !Array.isArray(run.checks) ? [] : run.checks.flatMap((check, index) => {
    if (!record(check) || check.id !== join[0] || !numeric(check.value)) return [];
    // 只有真正没过硬门槛才算违反：规则里的理想值（如 100ms）只用来展示差距，不用来定罪；
    // 拿理想值比历史测量会把机器负载下的正常波动当成「没做到」。
    const limit = numeric(check.limit) ? check.limit : null;
    const violated = check.pass === false || (limit !== null && check.value > limit);
    return [{ kind: 'run' as const, ref: `${run.ref}#/checks/${index}`, when: date(run.when),
      check: join[0], value: check.value, limit,
      ruleLimit: target, outcome: violated ? 'violated' as const : 'observed' as const,
      benchPass: typeof check.pass === 'boolean' ? check.pass : null, note: join[2] }];
  })).sort((a, b) => (a.when ?? '\uffff').localeCompare(b.when ?? '\uffff') || a.ref.localeCompare(b.ref));
}

/** Pure build: no filesystem, clock, mtime fallback, invented cases or run dates. */
export function buildExperience(input: ExperienceInput): DirectorExperience {
  const cases = caseJoins(input.casesMarkdown ?? '');
  const seen = new Set<string>();
  const entries = input.rules.rules.map((rule, index): ExperienceEntry => {
    if (!rule.id?.trim() || !rule.text?.trim() || !rule.source?.trim() || seen.has(rule.id)) {
      throw new Error(`规则缺少来源、正文、唯一 id：${index}`);
    }
    seen.add(rule.id);
    const caseRefs = cases.get(rule.id) ?? [];
    const runEvidence = observations(rule, input.runs ?? []);
    const caption = captions[rule.id];
    return {
      id: rule.id, title: short(caption?.[0] ?? rule.text.split(/[：:，,。；;]/)[0]!, 6),
      rule: rule.text, why: short(caption?.[1] ?? rule.text, 18), source: rule.source,
      caseRefs, param: rule.param ? { ...rule.param } : null,
      firstSeenAt: runEvidence.find(e => e.when !== null)?.when ?? null,
      evidence: caseRefs.length ? { kind: 'case', ref: `${CASES}#案例-${caseRefs[0]}`,
        note: '设计案例明确引用本规则；不是试玩或运行记录' }
        : { kind: 'rule', ref: `${RULES}#/rules/${index}`, note: '仅有规则原文来源，未找到明确引用本规则的案例' },
      runEvidence, violated: runEvidence.some(e => e.outcome === 'violated'),
    };
  });
  return { version: 1, note: NOTE, entries };
}

/** Browser boundary: missing file (undefined/null) or malformed data stays empty.
 * Example: readExperience(optionalJson).entries; no replacement history is invented.
 */
export function readExperience(value: unknown): DirectorExperience {
  const empty: DirectorExperience = { version: 1, note: NOTE, entries: [] };
  if (!record(value) || value.version !== 1 || !Array.isArray(value.entries)) return empty;
  const entries = value.entries.filter((v): v is ExperienceEntry => {
    if (!record(v) || !['id', 'title', 'rule', 'why', 'source'].every(k => typeof v[k] === 'string' && !!v[k])) return false;
    if (Array.from(v.title as string).length > 6 || Array.from(v.why as string).length > 18) return false;
    if (!Array.isArray(v.caseRefs) || !v.caseRefs.every(n => Number.isInteger(n) && n > 0)) return false;
    if (!(v.param === null || record(v.param)) || !(v.firstSeenAt === null || date(v.firstSeenAt))) return false;
    if (!record(v.evidence) || !['case', 'rule'].includes(String(v.evidence.kind)) || typeof v.evidence.ref !== 'string' || !v.evidence.ref || typeof v.evidence.note !== 'string') return false;
    if (typeof v.violated !== 'boolean' || !Array.isArray(v.runEvidence)) return false;
    return v.runEvidence.every(e => record(e) && e.kind === 'run' && typeof e.ref === 'string' && !!e.ref
      && (e.when === null || !!date(e.when)) && typeof e.check === 'string' && numeric(e.value)
      && (e.limit === null || numeric(e.limit)) && numeric(e.ruleLimit)
      && ['observed', 'violated'].includes(String(e.outcome))
      && (e.benchPass === null || typeof e.benchPass === 'boolean') && typeof e.note === 'string');
  });
  return { version: 1, note: typeof value.note === 'string' ? value.note : NOTE, entries };
}

async function runCli(): Promise<void> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--root')) throw new Error('Usage: tsx director/pipeline/experience.ts [--root /project]');
  const root = args.length ? path.resolve(args[1]!) : fileURLToPath(new URL('../../', import.meta.url));
  const readJson = async (ref: string): Promise<unknown> => JSON.parse(await fs.readFile(path.join(root, ref), 'utf8'));
  const rules = await readJson(RULES);
  if (!record(rules) || !Array.isArray(rules.rules)) throw new Error('rules.json must contain rules[]');
  const optionalText = async (ref: string) => {
    try { return await fs.readFile(path.join(root, ref), 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''; throw error; }
  };
  const dirs = async (ref: string) => {
    try { return (await fs.readdir(path.join(root, ref), { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  };
  const runs: ExperienceRun[] = [];
  // Only real intent/seed/tier runs. Synthetic runs/_bench fixtures are excluded.
  for (const intent of await dirs('runs')) {
    if (intent.startsWith('_')) continue;
    for (const seed of await dirs(`runs/${intent}`)) for (const tier of await dirs(`runs/${intent}/${seed}`)) {
      if (!/^\d+$/.test(seed) || !/^L[0-4]$/.test(tier)) continue;
      const ref = `runs/${intent}/${seed}/${tier}/bench.json`;
      const raw = await optionalText(ref);
      if (!raw) continue;
      const bench: unknown = JSON.parse(raw);
      // Verify recorded target as well as the containing directory; no timestamp borrowing.
      if (!record(bench) || bench.target !== `runs/${intent}/${seed}/${tier}`) continue;
      runs.push({ ref, when: bench.when, checks: bench.checks });
    }
  }
  const experience = buildExperience({ rules: rules as unknown as ExperienceInput['rules'], casesMarkdown: await optionalText(CASES), runs });
  const output = 'director/seed-memory/experience.json';
  await fs.writeFile(path.join(root, output), JSON.stringify(experience, null, 2) + '\n');
  console.log(`experience PASS · ${experience.entries.length} 条规则 · ${experience.entries.filter(e => e.caseRefs.length).length} 条有设计案例 · ${experience.entries.filter(e => e.runEvidence.length).length} 条有运行对照 · ${output}`);
}

// This guard is false in the browser; importing pure helpers never invokes the CLI.
if (typeof process !== 'undefined' && process.argv?.[1] && import.meta.url.startsWith('file:')) {
  void import('node:url').then(({ pathToFileURL }) => {
    if (pathToFileURL(process.argv[1]!).href === import.meta.url) return runCli();
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
