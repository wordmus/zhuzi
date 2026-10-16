// 呈现管线 CLI：意图 → 呈现方案 → 校验 → 构建 → 试映（模拟玩家 + 截图 + trace）→ report。
//   pnpm present --intent intents/first-visit.json --tier L1 --seed 1 [--no-shots] [--no-play]
// 产物落在 runs/<意图id>/<seed>/<档位>/：
//   plan.json  index.html  shots/*.png  trace.jsonl  ledger.json（有才写）  report.json  build/
// 不要手改这里的任何产物：不满意，改 frameworks / components / eras / director/seed-memory / critic，再重跑。

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Differ, REPO_ROOT, attachDiagnostics, ev, installBench, launch, loadThresholds, newContext, readPageData, serveDir } from '../../bench/lib';
import { letterCounts } from '../../engine/layers/bus';
import type { Letter } from '../../engine/layers/types';
import { play } from '../../bench/player';
import type { Intent, Plan, Tier } from '../../engine/types';
import { directFromFiles } from './director-node';
import { formatProblems, validatePlan } from './validate';

interface Args {
  intent: string;
  tier: Tier;
  seed: number;
  shots: boolean;
  play: boolean;
  headed: boolean;
  maxSeconds?: number;
  out?: string;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { intent: '', tier: 'L1', seed: 1, shots: true, play: true, headed: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]!;
    const val = () => argv[++i] ?? '';
    if (k === '--intent') a.intent = val();
    else if (k === '--tier') a.tier = val() as Tier;
    else if (k === '--seed') a.seed = Number(val());
    else if (k === '--no-shots') a.shots = false;
    else if (k === '--no-play') a.play = false;
    else if (k === '--headed') a.headed = true;
    else if (k === '--max-seconds') a.maxSeconds = Number(val());
    else if (k === '--out') a.out = val();
    else throw new Error(`未知参数 ${k}`);
  }
  if (!a.intent) throw new Error('用法：pnpm present --intent <file> --tier <L0-L4> --seed <n> [--no-shots] [--no-play]');
  if (!['L0', 'L1', 'L2', 'L3', 'L4'].includes(a.tier)) throw new Error(`--tier 要是 L0..L4，收到 ${a.tier}`);
  if (!Number.isFinite(a.seed)) throw new Error('--seed 要是数字');
  return a;
}

const rel = (p: string) => path.relative(REPO_ROOT, p) || '.';

function listFiles(dir: string, base = dir): { path: string; bytes: number }[] {
  if (!fs.existsSync(dir)) return [];
  const out: { path: string; bytes: number }[] = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...listFiles(p, base));
    else out.push({ path: path.relative(base, p), bytes: st.size });
  }
  return out;
}

const LEDGER_JS = `(() => {
  const z = window.__zhuzi || {};
  const paths = [['ledger'], ['ctx','handoff','ledger'], ['ctx','handoff','world','ledger'], ['world','ledger'], ['ctx','world','ledger'], ['ctx','handoff','facts']];
  for (const p of paths) {
    try {
      let parent = z;
      for (let i = 0; i < p.length - 1; i++) parent = parent && parent[p[i]];
      const key = p[p.length - 1];
      if (!parent) continue;
      let v = parent[key];
      if (typeof v === 'function') v = parent[key]();
      if (Array.isArray(v) && v.length) return { source: 'window.__zhuzi.' + p.join('.'), facts: JSON.parse(JSON.stringify(v)) };
    } catch (e) {}
  }
  return null;
})()`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = REPO_ROOT;
  const intentAbs = path.resolve(process.cwd(), args.intent);
  if (!fs.existsSync(intentAbs)) throw new Error(`找不到意图文件：${args.intent}`);
  const intentJson = JSON.parse(fs.readFileSync(intentAbs, 'utf8')) as Intent;
  const runDir = args.out ? path.resolve(process.cwd(), args.out) : path.join(root, 'runs', intentJson.id, String(args.seed), args.tier);
  fs.mkdirSync(runDir, { recursive: true });
  const t0 = Date.now();
  const report: Record<string, any> = { intent: intentJson.id, seed: args.seed, tier: args.tier, when: new Date().toISOString(), status: 'running' };
  const writeReport = () => fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2));
  const finish = (code: number): never => {
    if (code === 0 && ['ok', 'built'].includes(report.status) && intentJson.id === 'desk' && !args.out) {
      execFileSync(process.execPath, [path.join(root, 'scripts/update-entry.mjs'), String(args.seed), args.tier], { cwd: root, stdio: 'inherit' });
    }
    report.seconds = Math.round((Date.now() - t0) / 100) / 10;
    report.files = listFiles(runDir).filter((f) => !f.path.startsWith('build/'));
    writeReport();
    console.log(`\n运行目录 ${rel(runDir)}  [${report.status}]  ${report.seconds}s`);
    for (const f of report.files as { path: string; bytes: number }[]) console.log(`  ${f.path.padEnd(34)} ${f.bytes > 1024 ? (f.bytes / 1024).toFixed(1) + ' KB' : f.bytes + ' B'}`);
    process.exit(code);
  };

  // 1. 导演出方案
  const plan: Plan = await directFromFiles({ root, intentPath: intentAbs, seed: args.seed, tier: args.tier });
  const planPath = path.join(runDir, 'plan.json');
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
  console.log(`plan   ${rel(planPath)}  ${plan.acts.map((a) => `${a.id}(${a.framework})`).join(' → ')}`);

  // 2. 校验
  const rulesPath = path.join(root, 'director/seed-memory/rules.json');
  const rules = fs.existsSync(rulesPath) ? JSON.parse(fs.readFileSync(rulesPath, 'utf8')) : undefined;
  const v = validatePlan(plan, { rules });
  report.validation = { ok: v.ok, errors: v.errors, warnings: v.warnings };
  const lines = formatProblems(v);
  console.log(`valid  ${v.ok ? 'ok' : 'FAILED'}  errors ${v.errors.length} · warnings ${v.warnings.length}`);
  for (const l of lines) console.log('  ' + l);
  if (!v.ok) {
    report.status = 'invalid';
    console.error('呈现方案没通过校验，不构建。');
    finish(1);
  }

  // 3. 构建（Vite API；产物是单文件 index.html）
  const buildDir = path.join(runDir, 'build');
  const tb = Date.now();
  try {
    process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING ??= 'true';
    process.env.ZHUZI_PLAN = planPath;
    process.env.ZHUZI_OUT = buildDir;
    const { build } = await import('vite');
    await build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'warn', mode: 'production' });
  } catch (err) {
    report.status = 'build-failed';
    report.build = { ok: false, error: String((err as Error)?.message ?? err).split('\n').slice(0, 8).join('\n') };
    console.error(`构建失败：\n${(err as Error)?.stack ?? err}`);
    finish(2);
  }
  const builtHtml = path.join(buildDir, 'index.html');
  if (!fs.existsSync(builtHtml)) {
    report.status = 'build-failed';
    report.build = { ok: false, error: 'build/index.html 不存在' };
    console.error('构建没有产出 build/index.html');
    finish(2);
  }
  const html = fs.readFileSync(builtHtml, 'utf8');
  const external = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="(\.\/[^"]+|\/[^"/][^"]*)"/g)].map((m) => m[1]);
  const indexPath = path.join(runDir, 'index.html');
  fs.copyFileSync(builtHtml, indexPath);
  report.build = { ok: true, ms: Date.now() - tb, bytes: Buffer.byteLength(html), singleFile: external.length === 0, external };
  console.log(`build  ${rel(indexPath)}  ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB${external.length ? `  （注意：还引用了外部文件 ${external.join(', ')}）` : ''}`);

  if (!args.play) {
    report.status = 'built';
    finish(0);
  }

  // 4. 试映：模拟玩家玩一遍，截图 + trace
  const th = loadThresholds();
  const served = await serveDir(runDir);
  const browser = await launch({ headed: args.headed }).catch((err) => {
    report.status = 'browser-failed';
    report.play = { error: String(err?.message ?? err) };
    console.error(`起不了浏览器：${err?.message ?? err}\n（试试 npx playwright install chromium）`);
    return finish(3);
  });
  try {
    const shotsDir = path.join(runDir, 'shots');
    fs.rmSync(shotsDir, { recursive: true, force: true });
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    const diag = attachDiagnostics(page);
    await installBench(page);
    await page.goto(`${served.origin}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const maxSeconds = args.maxSeconds ?? th.player.maxSeconds;
    const result = await play(page, { ...th.player, maxSeconds, differ: null as Differ | null, shotsDir: args.shots ? shotsDir : null, shotsPerAct: 5 });
    const data = await readPageData(page);
    const layers = await ev<{ letters: Letter[]; check: string[] }>(page, `(() => {
      const layers = window.__zhuzi?.layers;
      return layers ? { letters: layers.letters(), check: layers.check() } : { letters: [], check: ['缺少三层信息流'] };
    })()`);
    fs.writeFileSync(path.join(runDir, 'layers.json'), JSON.stringify({ ...layers, counts: letterCounts(layers.letters) }, null, 2));
    console.log(`layers ${layers.letters.length} 封信 · 未回执 ${layers.letters.filter(l => !l.receipt).length} · ${layers.check.length ? layers.check.join('；') : '检查通过'}`);

    fs.writeFileSync(path.join(runDir, 'trace.jsonl'), data.trace.map((e) => JSON.stringify(e)).join('\n') + (data.trace.length ? '\n' : ''));
    const ledger = await ev<{ source: string; facts: unknown[] } | null>(page, LEDGER_JS).catch(() => null);
    let ledgerSource = ledger?.source ?? null;
    let facts = ledger?.facts ?? null;
    if (!facts) {
      const fromTrace = data.trace.filter((e) => e.kind === 'world.fact').map((e) => e.fact ?? { text: e.text, day: e.day });
      if (fromTrace.length) {
        facts = fromTrace;
        ledgerSource = 'trace(world.fact)';
      }
    }
    if (facts) fs.writeFileSync(path.join(runDir, 'ledger.json'), JSON.stringify(facts, null, 2));
    if (plan.id === 'fifty-years') {
      const historySave = await ev(page, `window.__zhuzi.ctx.store.get('history.save', null)`);
      fs.writeFileSync(path.join(runDir, 'history-save.json'), JSON.stringify(historySave, null, 2));
    }

    // 对照导演的预演：每幕“以为会怎样 / 实际怎样”
    const tr = data.trace;
    const acts = plan.acts.map((a) => {
      const ei = tr.findIndex((e) => e.kind === 'act.enter' && e.act === a.id);
      const enter = ei >= 0 ? tr[ei] : undefined;
      // 同一毫秒里上一幕的点击与这一幕的进场可能同 t，所以按先后位置找，不按时间
      const xi = ei >= 0 ? tr.findIndex((e, i) => i > ei && e.kind === 'act.exit' && e.act === a.id) : -1;
      const exit = xi >= 0 ? tr[xi] : undefined;
      const span = ei >= 0 ? tr.slice(ei, xi >= 0 ? xi + 1 : undefined) : [];
      const firstShow = span.find((e) => e.kind === 'aff.show');
      const firstClick = span.find((e) => e.kind === 'aff.click');
      const said = span.filter((e) => e.kind === 'line.say').map((e) => String(e.text));
      const predictedMs = a.predict.firstActionMs ?? null;
      const actualMs = enter && firstClick ? Math.round(firstClick.t - enter.t) : null;
      return {
        act: a.id,
        expected: a.predict.surprise,
        entered: !!enter,
        exited: !!exit,
        durationMs: enter && exit ? Math.round(exit.t - enter.t) : null,
        firstAffMs: enter && firstShow ? Math.round(firstShow.t - enter.t) : null,
        firstActionMs: actualMs,
        predictedFirstActionMs: predictedMs,
        note: !enter ? '没进场' : actualMs == null ? '模拟玩家没有点过任何东西' : predictedMs != null && actualMs > predictedMs * 2 ? `首个动作 ${actualMs}ms，比预演的 ${predictedMs}ms 慢很多（模拟玩家要先等画面稳定约 ${th.player.settleMs}ms）` : '与预演相近',
        lines: said,
      };
    });
    const errorCount = diag.consoleErrors.length + diag.pageErrors.length + tr.filter((e) => e.kind === 'error').length;
    report.play = {
      done: result.done,
      reason: result.reason,
      seconds: Math.round(result.elapsedMs / 100) / 10,
      steps: result.steps.length,
      stepLog: result.steps.map((s) => ({ i: s.i, act: s.act, aff: s.aff, prefer: s.prefer, progressed: s.progressed })),
      shots: result.shots,
      traceEvents: tr.length,
      errors: errorCount,
      consoleErrors: diag.consoleErrors.slice(0, 10),
      pageErrors: diag.pageErrors.slice(0, 10),
      fallbackClicks: result.fallbackClicks,
      firstActionSec: data.firstActionMs == null ? null : Math.round(data.firstActionMs) / 1000,
      stageFpsP5: data.stageFpsP5,
      ledger: facts ? { source: ledgerSource, facts: facts.length } : null,
      acts,
    };
    report.status = result.done ? 'ok' : 'play-incomplete';
    console.log(`play   ${result.done ? 'done' : '未跑完（' + result.reason + '）'}  ${result.steps.length} 步 · ${report.play.seconds}s · 截图 ${result.shots.length} · trace ${tr.length} 条 · 报错 ${errorCount}${facts ? ` · 账本 ${facts.length} 条` : ''}`);
    if (!result.done) console.warn(`警告：模拟玩家没有走到 window.__zhuzi.done（${result.reason}）。产物已写出，但这一版不能从头玩到尾。`);
    await ctx.close();
  } catch (err) {
    report.status = 'play-crashed';
    report.play = { error: String((err as Error)?.stack ?? err) };
    console.error(`试映出错：${(err as Error)?.stack ?? err}`);
    await browser.close().catch(() => {});
    await served.close();
    finish(3);
  }
  await browser.close().catch(() => {});
  await served.close();
  finish(0);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(2);
});
