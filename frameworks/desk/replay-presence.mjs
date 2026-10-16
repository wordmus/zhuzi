// 用原模拟玩家重放本任务的新入口 seed；避免 present 完成钩子自动写 ENTRY 工人的目录。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsImport } from 'tsx/esm/api';
const { launch, newContext, serveDir, installBench, readPageData, attachDiagnostics, loadThresholds } = await tsImport('../../bench/lib.ts', import.meta.url);
const { play } = await tsImport('../../bench/player.ts', import.meta.url);
const { letterCounts } = await tsImport('../../engine/layers/bus.ts', import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));
const dir = path.join(root, 'runs/desk/17/L1');
const plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json'), 'utf8'));
assert(plan.intent.id === 'desk' && plan.seed === 17 && plan.tier === 'L1');
fs.copyFileSync(path.join(dir, 'build/index.html'), path.join(dir, 'index.html'));
const server = await serveDir(dir), browser = await launch();
try {
  const context = await newContext(browser), page = await context.newPage();
  const diag = attachDiagnostics(page); await installBench(page);
  await page.goto(`${server.origin}/index.html`, { waitUntil: 'domcontentloaded' });
  const result = await play(page, { ...loadThresholds().player, differ: null, shotsDir: path.join(dir, 'shots'), shotsPerAct: 5 });
  const data = await readPageData(page);
  const layers = await page.evaluate(() => ({ letters: window.__zhuzi.layers.letters(), check: window.__zhuzi.layers.check() }));
  assert(result.done); assert.deepEqual(layers.check, []); assert.deepEqual(diag.consoleErrors, []); assert.deepEqual(diag.pageErrors, []);
  fs.writeFileSync(path.join(dir, 'layers.json'), JSON.stringify({ ...layers, counts: letterCounts(layers.letters) }, null, 2));
  fs.writeFileSync(path.join(dir, 'trace.jsonl'), data.trace.map(e => JSON.stringify(e)).join('\n') + '\n');
  const acts = plan.acts.map(act => {
    const ei = data.trace.findIndex(e => e.kind === 'act.enter' && e.act === act.id);
    const enter = data.trace[ei], xi = data.trace.findIndex((e, i) => i > ei && e.kind === 'act.exit' && e.act === act.id), exit = data.trace[xi];
    const span = data.trace.slice(ei, xi + 1), show = span.find(e => e.kind === 'aff.show'), click = span.find(e => e.kind === 'aff.click');
    const actualMs = click ? Math.round(click.t - enter.t) : null;
    return { act: act.id, expected: act.predict.surprise, entered: ei >= 0, exited: xi >= 0,
      durationMs: Math.round(exit.t - enter.t), firstAffMs: show ? Math.round(show.t - enter.t) : null,
      firstActionMs: actualMs, predictedFirstActionMs: act.predict.firstActionMs ?? null,
      note: actualMs > (act.predict.firstActionMs ?? Infinity) * 2 ? `首个动作 ${actualMs}ms，比预演的 ${act.predict.firstActionMs}ms 慢很多（模拟玩家要先等画面稳定约 ${loadThresholds().player.settleMs}ms）` : '与预演相近',
      lines: span.filter(e => e.kind === 'line.say').map(e => String(e.text)) };
  });
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));
  report.when = new Date().toISOString(); report.status = 'ok';
  report.build.bytes = fs.statSync(path.join(dir, 'index.html')).size;
  report.finalReplay = { command: 'node frameworks/desk/replay-presence.mjs', entryHook: 'not invoked', source: 'same bench/lib + bench/player as present' };
  report.play = { done: result.done, reason: result.reason, seconds: Math.round(result.elapsedMs / 100) / 10,
    steps: result.steps.length, stepLog: result.steps.map(s => ({ i: s.i, act: s.act, aff: s.aff, prefer: s.prefer, progressed: s.progressed })),
    shots: result.shots, traceEvents: data.trace.length, errors: data.trace.filter(e => e.kind === 'error').length,
    consoleErrors: diag.consoleErrors, pageErrors: diag.pageErrors, fallbackClicks: result.fallbackClicks,
    firstActionSec: data.firstActionMs == null ? null : Math.round(data.firstActionMs) / 1000, stageFpsP5: data.stageFpsP5, ledger: null, acts };
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`REPLAY PASS · same bench/player · done ${result.steps.length} steps · ${layers.letters.length} letters · pending ${layers.letters.filter(l => !l.receipt).length} · check=[] · console errors 0 · ENTRY hook not invoked`);
  await context.close();
} finally { await browser.close(); await server.close(); }
