// bench：硬指标由脚本判，不由人（或写作品的 agent）判。
//   pnpm bench <run-dir | url | file.html> [--seed n]
// 一次评测 = 三次游玩：A 主跑（带反馈探针，量全部指标）、B 删字、C 复跑（同 seed 同点法，比事实账本）。
// 输出：bench/report.json、<目标目录>/curve.csv、<目标目录>/bench.json，并在 stdout 打印一行汇总。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser } from 'playwright';
import {
  Differ, REPO_ROOT, attachDiagnostics, factText, installBench, launch, loadThresholds, median, newContext, percentile,
  readPageData, serveDir, slug, type Diagnostics, type PageData, type Thresholds,
} from './lib';
import { play, type PlayResult } from './player';

export interface BenchOptions {
  seed?: number;
  maxSeconds?: number;
  maxSteps?: number;
  headed?: boolean;
  /** 另一个 run 目录：比较两份 plan 的田伯是否不同（不同 seed 的田伯不同） */
  vs?: string;
  verbose?: boolean;
}

export interface Check {
  id: string;
  label: string;
  pass: boolean;
  value: string | number | null;
  limit: string | number | null;
  note?: string;
}

export interface BenchReport {
  target: string;
  url: string;
  when: string;
  verdict: 'PASS' | 'FAIL';
  hard: { pass: number; total: number };
  summary: string;
  checks: Check[];
  metrics: Record<string, unknown>;
  runs: Record<string, unknown>;
  curve: CurveRow[];
  curveSummary: Record<string, number | null>;
  thresholds: Thresholds;
  outDir: string;
}

interface Capture {
  play: PlayResult;
  data: PageData;
  diag: Diagnostics;
  hidden?: boolean;
  ledger: unknown[] | null;
}

// ---------------- 目标解析 ----------------

interface Target {
  label: string;
  serveRoot?: string;
  pagePath?: string;
  url?: string;
  outDir: string;
  planPath?: string;
}

function resolveTarget(t: string): Target {
  if (/^https?:\/\//.test(t)) return { label: t, url: t, outDir: path.join(REPO_ROOT, 'runs/_bench', slug(t)) };
  const abs = path.resolve(process.cwd(), t);
  if (!fs.existsSync(abs)) throw new Error(`找不到目标：${t}`);
  if (fs.statSync(abs).isDirectory()) {
    const idx = fs.existsSync(path.join(abs, 'index.html')) ? 'index.html' : fs.existsSync(path.join(abs, 'build/index.html')) ? 'build/index.html' : null;
    if (!idx) throw new Error(`${t} 里没有 index.html（先跑 pnpm present）`);
    const plan = path.join(abs, 'plan.json');
    return { label: path.relative(REPO_ROOT, abs) || t, serveRoot: abs, pagePath: '/' + idx, outDir: abs, planPath: fs.existsSync(plan) ? plan : undefined };
  }
  return {
    label: path.relative(REPO_ROOT, abs) || t,
    serveRoot: path.dirname(abs),
    pagePath: '/' + path.basename(abs),
    outDir: path.join(REPO_ROOT, 'runs/_bench', slug(path.basename(abs, path.extname(abs)))),
  };
}

// ---------------- 游玩 ----------------

async function capture(browser: Browser, url: string, o: { noText?: boolean; differ?: Differ | null; seed?: number; th: Thresholds; maxSeconds: number; maxSteps: number; headed?: boolean; log: (s: string) => void }): Promise<Capture> {
  const ctx = await newContext(browser);
  try {
    const page = await ctx.newPage();
    const diag = attachDiagnostics(page);
    await installBench(page, { noText: o.noText });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    let wd: NodeJS.Timeout | undefined;
    const result = await Promise.race([
      play(page, { ...o.th.player, maxSeconds: o.maxSeconds, maxSteps: o.maxSteps, seed: o.seed, differ: o.differ ?? null, feedback: o.th.feedback, log: o.log }),
      new Promise<never>((_, rej) => {
        wd = setTimeout(() => rej(new Error('play watchdog')), (o.maxSeconds + 90) * 1000);
      }),
    ]).finally(() => clearTimeout(wd));
    const data = await readPageData(page);
    const hidden = o.noText ? await page.evaluate('!!document.getElementById("__bench_notext")').catch(() => false) as boolean : undefined;
    const ledger = await page.evaluate(`(() => {
      const world = window.__zhuzi?.ctx?.handoff?.world;
      return typeof world?.ledger === 'function' ? world.ledger() : null;
    })()`).catch(() => null) as unknown[] | null;
    return { play: result, data, diag, hidden, ledger };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ---------------- 指标 ----------------

/** 每次 act.enter 之后 3 秒内，同时可做的事最多几个。无 act.enter 的页面退回 DOM 序列。 */
function first3s(data: PageData): { perAct: { act: string; n: number }[]; max: number; source: 'trace' | 'dom' } {
  const tr = data.trace;
  const enters = tr.filter((e) => e.kind === 'act.enter');
  if (!enters.length) {
    const s = data.affSeries;
    if (!s.length || data.firstActionMs == null) return { perAct: [{ act: '(page)', n: 0 }], max: 0, source: 'dom' };
    const t0 = data.firstActionMs;
    let cur = 0;
    for (const p of s) if (p.t <= t0) cur = p.n;
    let max = cur;
    for (const p of s) if (p.t >= t0 && p.t <= t0 + 3000) max = Math.max(max, p.n);
    return { perAct: [{ act: '(page)', n: max }], max, source: 'dom' };
  }
  const set = new Set<string>();
  const wins: { act: string; t0: number; max: number; open: boolean }[] = [];
  for (const e of tr) {
    if (e.kind === 'act.enter') {
      for (const w of wins) w.open = false;
      wins.push({ act: String(e.act), t0: e.t, max: set.size, open: true });
      continue;
    }
    if (e.kind === 'act.exit') {
      for (const w of wins) w.open = false;
    }
    if (e.kind === 'aff.show') set.add(String(e.id));
    else if (e.kind === 'aff.hide') set.delete(String(e.id));
    else continue;
    for (const w of wins) {
      if (!w.open) continue;
      if (e.t - w.t0 > 3000) w.open = false;
      else w.max = Math.max(w.max, set.size);
    }
  }
  const perAct = wins.map((w) => ({ act: w.act, n: w.max }));
  return { perAct, max: Math.max(0, ...perAct.map((p) => p.n)), source: 'trace' };
}

/**
 * 帧率第 5 百分位。主值：整局的 rAF 帧间隔，去掉截图探针占用的时间窗（那是 bench 自己卡的）。
 * 若最后 12 秒里没有探针，stage.fpsP5() 的环形缓冲是干净的，取两者较小。
 */
function fpsP5(data: PageData): { p5: number | null; frames: number; own: number | null; stage: number | null; usedStage: boolean } {
  const f = data.frames;
  const fps: number[] = [];
  const ex = data.excl;
  for (let i = 1; i < f.length; i++) {
    if (f[i - 1]! < 1500) continue;
    const a = f[i - 1]!;
    const b = f[i]!;
    if (ex.some(([x, y]) => b >= x && a <= y)) continue;
    fps.push(1000 / Math.max(1, b - a));
  }
  const own = fps.length >= 30 ? (fps.sort((x, y) => x - y), percentile(fps, 0.05)) : null;
  const stage = data.stageFpsP5;
  const stageClean = stage != null && !ex.some(([, y]) => y > data.now - 12000);
  const p5 = own == null ? (stageClean ? stage : null) : stageClean ? Math.min(own, stage!) : own;
  return { p5, frames: fps.length, own, stage, usedStage: stageClean };
}

function maxChars(data: PageData): { dom: number; trace: number; max: number } {
  const dom = Math.max(0, ...data.textSeries.map((s) => s.chars));
  const trace = Math.max(0, ...data.trace.filter((e) => e.kind === 'line.say').map((e) => Number(e.chars ?? 0)));
  return { dom, trace, max: Math.max(dom, trace) };
}

function factsOf(data: PageData): string[] {
  return data.trace.filter((e) => e.kind === 'world.fact').map(factText);
}
const actsOf = (data: PageData) => data.trace.filter((e) => e.kind === 'act.enter').map((e) => String(e.act));
const linesOf = (data: PageData) => data.trace.filter((e) => e.kind === 'line.say').map((e) => String(e.text));

const eq = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---------------- 体验谱 curve.csv（管线说明 3.6） ----------------

export interface CurveRow {
  minute: number;
  decisions: number;
  new_info: number;
  want_continue: number;
  numbers_on_screen: number;
  words_on_screen: number;
  note: string;
}

function buildCurve(cap: Capture): CurveRow[] {
  const { data, play: pl } = cap;
  const endT = Math.max(data.now, 1);
  const minutes = Math.max(1, Math.ceil(endT / 60000));
  const off = data.busOffset;
  const rows: CurveRow[] = [];
  const seenAff = new Set<string>();
  const seenLine = new Set<string>();
  const newInfo = new Array(minutes).fill(0);
  for (const e of data.trace) {
    const m = Math.min(minutes - 1, Math.max(0, Math.floor((e.t + off) / 60000)));
    if (e.kind === 'aff.show' && !seenAff.has(String(e.id))) {
      seenAff.add(String(e.id));
      newInfo[m]++;
    } else if (e.kind === 'line.say' && !seenLine.has(String(e.text))) {
      seenLine.add(String(e.text));
      newInfo[m]++;
    } else if (e.kind === 'world.fact') newInfo[m]++;
  }
  for (let m = 0; m < minutes; m++) {
    const lo = m * 60000;
    const hi = lo + 60000;
    const steps = pl.steps.filter((s) => s.pageT >= lo && s.pageT < hi);
    const decisions = steps.filter((s) => s.progressed).length;
    const samples = data.textSeries.filter((s) => s.t >= lo && s.t < hi);
    const words = median(samples.map((s) => s.chars).filter((c) => c > 0));
    const nums = median(samples.map((s) => s.digits));
    const wordsN = Number.isFinite(words) ? Math.round(words) : 0;
    const numsN = Number.isFinite(nums) ? Math.round(nums) : 0;
    // 想继续的启发式：有决定、有新东西加分；没决定、屏上太满减分
    let want = 3;
    if (decisions >= 2) want++;
    if (newInfo[m] >= 2) want++;
    if (decisions === 0) want--;
    if (wordsN > 30 || numsN > 3) want--;
    want = Math.max(1, Math.min(5, want));
    const first = steps[0];
    const note = steps.length
      ? `${steps.length} 次动手，起于 ${first?.act ?? '?'}/${first?.aff ?? '?'}；${newInfo[m]} 条新东西${wordsN > 30 ? '；字偏多' : ''}`
      : '没有动手（等待或演出）';
    rows.push({ minute: m + 1, decisions, new_info: newInfo[m], want_continue: want, numbers_on_screen: numsN, words_on_screen: wordsN, note });
  }
  return rows;
}

function curveCsv(rows: CurveRow[]): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return ['minute,decisions,new_info,want_continue,numbers_on_screen,words_on_screen,note', ...rows.map((r) => [r.minute, r.decisions, r.new_info, r.want_continue, r.numbers_on_screen, r.words_on_screen, esc(r.note)].join(','))].join('\n') + '\n';
}

function curveSummary(rows: CurveRow[]): Record<string, number | null> {
  const firstDecision = rows.find((r) => r.decisions > 0)?.minute ?? null;
  return {
    decisionDensity: rows.length ? median(rows.map((r) => r.decisions)) : null,
    firstDecisionMinute: firstDecision,
    wantContinueMin: rows.length ? Math.min(...rows.map((r) => r.want_continue)) : null,
    wantContinueEnd: rows.length ? rows[rows.length - 1]!.want_continue : null,
    numbersMedian: rows.length ? median(rows.map((r) => r.numbers_on_screen)) : null,
  };
}

// ---------------- 评测 ----------------

const fmt = (n: number | null | undefined, d = 1) => (n == null || !Number.isFinite(n) ? 'n/a' : Number(n.toFixed(d)).toString());

export async function runBench(targetArg: string, opts: BenchOptions = {}): Promise<BenchReport> {
  const th = loadThresholds();
  const target = resolveTarget(targetArg);
  const maxSeconds = opts.maxSeconds ?? th.player.maxSeconds;
  const maxSteps = opts.maxSteps ?? th.player.maxSteps;
  const log = (s: string) => opts.verbose && console.error(`[bench] ${s}`);

  let served: Awaited<ReturnType<typeof serveDir>> | null = null;
  let url = target.url ?? '';
  if (target.serveRoot) {
    served = await serveDir(target.serveRoot);
    url = served.origin + target.pagePath;
  }
  const browser = await launch({ headed: opts.headed });
  const differ = await Differ.create(browser);
  try {
    log(`A 主跑 ${url}`);
    const A = await capture(browser, url, { differ, seed: opts.seed, th, maxSeconds, maxSteps, log });
    log(`A: ${A.play.reason}, ${A.play.steps.length} 步, ${(A.play.elapsedMs / 1000).toFixed(1)}s`);
    log('B 删字 + C 复跑');
    const [B, C] = await Promise.all([
      th.notext ? capture(browser, url, { noText: true, seed: opts.seed, th, maxSeconds, maxSteps, log }) : Promise.resolve(null),
      th.repro ? capture(browser, url, { seed: opts.seed, th, maxSeconds, maxSteps, log }) : Promise.resolve(null),
    ]);

    // ---- 指标 ----
    const firstAction = A.data.firstActionMs == null ? null : A.data.firstActionMs / 1000;
    const f3 = first3s(A.data);
    const fbSamples = A.play.feedback;
    const lat = fbSamples.map((s) => s.latencyMs ?? Infinity).sort((a, b) => a - b);
    const fbP90 = lat.length ? lat[Math.min(lat.length - 1, Math.ceil(lat.length * 0.9) - 1)]! : null;
    const within100 = fbSamples.length ? fbSamples.filter((s) => s.latencyMs != null && s.latencyMs <= th.feedbackMsTarget).length / fbSamples.length : null;
    const chars = maxChars(A.data);
    const traceErrors = A.data.trace.filter((e) => e.kind === 'error').length;
    const errors = A.diag.consoleErrors.length + A.diag.pageErrors.length + traceErrors;
    const fps = fpsP5(A.data);

    const notext = B ? { done: B.play.done, hidden: !!B.hidden, reason: B.play.reason } : null;
    const factsA = factsOf(A.data);
    const factsC = C ? factsOf(C.data) : [];
    const actsA = actsOf(A.data);
    const actsC = C ? actsOf(C.data) : [];
    const firstDifference = (a: string[], b: string[]) => {
      const index = Array.from({ length: Math.max(a.length, b.length) }, (_, i) => i).find(i => a[i] !== b[i]);
      return index === undefined ? null : { index, main: a[index] ?? null, replay: b[index] ?? null };
    };
    const actionsA = A.play.steps.map(step => `${step.aff ?? 'input'}:${step.how}`);
    const actionsC = C ? C.play.steps.map(step => `${step.aff ?? 'input'}:${step.how}`) : [];
    const repro = C
      ? { facts: factsA.length, factsEqual: eq(factsA, factsC), actsEqual: eq(actsA, actsC), linesEqual: eq(linesOf(A.data), linesOf(C.data)), bothDone: A.play.done && C.play.done,
          actualLedgerEqual: A.ledger && C.ledger ? JSON.stringify(A.ledger) === JSON.stringify(C.ledger) : null,
          sameActionSequence: eq(actionsA, actionsC), firstFactDifference: firstDifference(factsA, factsC), firstActionDifference: firstDifference(actionsA, actionsC) }
      : null;
    const reproPass = !!repro && repro.bothDone && repro.factsEqual && repro.actsEqual;

    // 不同 seed 的田伯不同（给了 --vs 才查）
    let seedDiff: { checked: boolean; differs?: boolean } = { checked: false };
    if (opts.vs && target.planPath) {
      const other = path.join(path.resolve(process.cwd(), opts.vs), 'plan.json');
      if (fs.existsSync(other)) {
        const a = JSON.parse(fs.readFileSync(target.planPath, 'utf8'));
        const b = JSON.parse(fs.readFileSync(other, 'utf8'));
        seedDiff = { checked: true, differs: JSON.stringify(a.world?.tianbo) !== JSON.stringify(b.world?.tianbo) };
      }
    }

    const checks: Check[] = [
      { id: 'first-action', label: '首个可操作元素', pass: firstAction != null && firstAction <= th.firstActionSec, value: firstAction, limit: th.firstActionSec, note: firstAction == null ? '整个过程没有出现 [data-aff]' : undefined },
      { id: 'first3s', label: '每幕前 3 秒可做的事', pass: f3.max <= th.first3sActionsMax, value: f3.max, limit: th.first3sActionsMax, note: f3.perAct.map((p) => `${p.act}:${p.n}`).join(' ') },
      { id: 'feedback', label: '反馈延迟 p90', pass: fbP90 != null && Number.isFinite(fbP90) && fbP90 <= th.feedbackMsMax, value: fbP90 == null ? null : Number.isFinite(fbP90) ? fbP90 : 'none', limit: th.feedbackMsMax, note: `样本 ${fbSamples.length}，100ms 内有反馈的占 ${within100 == null ? 'n/a' : Math.round(within100 * 100) + '%'}（目标 ${th.feedbackMsTarget}ms）` },
      { id: 'max-chars', label: '每屏可见字数', pass: chars.max <= th.maxChars, value: chars.max, limit: th.maxChars, note: `DOM ${chars.dom} / trace ${chars.trace}` },
      { id: 'errors', label: '控制台报错', pass: errors <= th.consoleErrorsMax, value: errors, limit: th.consoleErrorsMax, note: [...A.diag.consoleErrors, ...A.diag.pageErrors].slice(0, 3).join(' | ') || undefined },
      { id: 'fps-p5', label: '帧率 p5', pass: fps.p5 != null && fps.p5 >= th.fpsP5Min, value: fps.p5 == null ? null : Math.round(fps.p5), limit: th.fpsP5Min, note: `${fps.frames} 帧；整局 rAF p5=${fps.own == null ? 'n/a' : Math.round(fps.own)}；stage.fpsP5()=${fps.stage == null ? 'n/a' : Math.round(fps.stage)}${fps.usedStage ? '（已计入）' : '（末 12 秒有探针，未计入）'}` },
      { id: 'notext', label: '删字测试', pass: !th.notext || (!!notext && notext.hidden && notext.done), value: notext ? (notext.hidden && notext.done ? 'PASS' : 'FAIL') : 'skipped', limit: 'hidden + done', note: notext && !notext.hidden ? '隐藏样式未生效' : notext && !notext.done ? `停在 ${notext.reason}` : undefined },
      { id: 'repro', label: '同 seed 复现', pass: !th.repro || reproPass, value: repro ? (reproPass ? 'PASS' : 'FAIL') : 'skipped', limit: 'same', note: repro ? `事实 ${repro.facts} 条${repro.facts === 0 ? '（无 world.fact，只比较幕序）' : ''}；账本${repro.factsEqual ? '一致' : '不一致'}，幕序${repro.actsEqual ? '一致' : '不一致'}，台词${repro.linesEqual ? '一致' : '有差'}${repro.bothDone ? '' : '；有一次没跑完'}` : undefined },
    ];
    const pass = checks.filter((c) => c.pass).length;
    const completed = A.play.done;
    const verdict: 'PASS' | 'FAIL' = pass === checks.length && completed ? 'PASS' : 'FAIL';

    const seg = (id: string, text: string) => {
      const c = checks.find((x) => x.id === id)!;
      return c.pass ? text : `${text} (limit ${c.limit})`;
    };
    const summary = [
      `${verdict} hard ${pass}/${checks.length}`,
      seg('first-action', `first-action ${firstAction == null ? 'none' : fmt(firstAction, 2) + 's'}`),
      seg('first3s', `first3s ${f3.max}`),
      seg('feedback', `feedback p90 ${fbP90 == null ? 'n/a' : Number.isFinite(fbP90) ? fbP90 + 'ms' : 'none'}`),
      seg('max-chars', `max-chars ${chars.max}`),
      seg('errors', `errors ${errors}`),
      seg('fps-p5', `fps-p5 ${fps.p5 == null ? 'n/a' : Math.round(fps.p5)}`),
      `notext ${checks.find((c) => c.id === 'notext')!.value === 'PASS' ? 'PASS' : notext ? 'FAIL' : 'skipped'}`,
      `repro ${checks.find((c) => c.id === 'repro')!.value}`,
      ...(completed ? [] : [`incomplete (${A.play.reason})`]),
      ...(seedDiff.checked ? [`seed-differs ${seedDiff.differs ? 'PASS' : 'FAIL'}`] : []),
    ].join(' · ');

    const curve = buildCurve(A);
    const summ = curveSummary(curve);
    const brief = (c: Capture | null) => (c ? { done: c.play.done, reason: c.play.reason, steps: c.play.steps.length, seconds: Math.round(c.play.elapsedMs / 100) / 10, fallbackClicks: c.play.fallbackClicks, shots: c.play.shots.length } : null);
    const report: BenchReport = {
      target: target.label,
      url,
      when: new Date().toISOString(),
      verdict,
      hard: { pass, total: checks.length },
      summary,
      checks,
      metrics: {
        firstActionSec: firstAction,
        first3s: f3,
        feedback: { samples: fbSamples, p90Ms: fbP90 != null && Number.isFinite(fbP90) ? fbP90 : null, within100Ratio: within100 },
        chars,
        errors: { total: errors, console: A.diag.consoleErrors, page: A.diag.pageErrors, trace: traceErrors, warnings: A.diag.consoleWarnings },
        fps: { p5: fps.p5, own: fps.own, stage: fps.stage, usedStage: fps.usedStage, frames: fps.frames },
        notext,
        repro,
        seedDiff,
        stepsPolicy: { seed: opts.seed ?? null, preferCounts: countBy(A.play.steps.map((s) => s.prefer)) },
      },
      runs: { main: brief(A), notext: brief(B), repro: brief(C) },
      curve,
      curveSummary: summ,
      thresholds: th,
      outDir: target.outDir,
    };

    fs.mkdirSync(target.outDir, { recursive: true });
    fs.writeFileSync(path.join(target.outDir, 'curve.csv'), curveCsv(curve));
    fs.writeFileSync(path.join(target.outDir, 'bench.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(REPO_ROOT, 'bench/report.json'), JSON.stringify(report, null, 2));
    const hist = path.join(REPO_ROOT, 'bench/history.csv');
    if (!fs.existsSync(hist)) fs.writeFileSync(hist, 'when,target,verdict,hard,summary\n');
    fs.appendFileSync(hist, `${report.when},${JSON.stringify(report.target)},${verdict},${pass}/${checks.length},${JSON.stringify(summary)}\n`);
    return report;
  } finally {
    await differ.close();
    await browser.close().catch(() => {});
    await served?.close();
  }
}

function countBy(xs: string[]): Record<string, number> {
  const o: Record<string, number> = {};
  for (const x of xs) o[x] = (o[x] ?? 0) + 1;
  return o;
}

// ---------------- CLI ----------------

function parseArgs(argv: string[]) {
  const pos: string[] = [];
  const o: BenchOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const val = () => argv[++i];
    if (a === '--seed') o.seed = Number(val());
    else if (a === '--max-seconds') o.maxSeconds = Number(val());
    else if (a === '--max-steps') o.maxSteps = Number(val());
    else if (a === '--vs') o.vs = val();
    else if (a === '--headed') o.headed = true;
    else if (a === '--verbose' || a === '-v') o.verbose = true;
    else if (a.startsWith('--')) throw new Error(`未知参数 ${a}`);
    else pos.push(a);
  }
  return { target: pos[0], opts: o };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { target, opts } = parseArgs(process.argv.slice(2));
  if (!target) {
    console.error('用法：pnpm bench <run-dir | url | file.html> [--seed n] [--vs <run-dir>] [--max-seconds n] [--verbose]');
    process.exit(2);
  }
  runBench(target, opts)
    .then((r) => {
      console.log(r.summary);
      process.exit(r.verdict === 'PASS' ? 0 : 1);
    })
    .catch((err) => {
      console.log(`FAIL bench crashed · ${String(err?.message ?? err).split('\n')[0]}`);
      if (opts.verbose) console.error(err);
      process.exit(2);
    });
}
