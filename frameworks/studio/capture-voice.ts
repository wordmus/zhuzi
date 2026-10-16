// 先运行 pnpm dev --host 127.0.0.1 --port 5188；截图来自真实页面，不改演员或轨迹。
import fs from 'node:fs';
import path from 'node:path';
import { launch, newContext, installBench, serveDir, loadThresholds, REPO_ROOT } from '../../bench/lib';
import { play } from '../../bench/player';

const out = path.join(REPO_ROOT, 'runs/studio/7/L1/voice-evidence');
fs.mkdirSync(out, { recursive: true });
const browser = await launch({ headed: false });
try {
  for (const kind of ['studio', 'chronicle', 'no-action', 'old'] as const) {
    const run = kind === 'chronicle' ? 'fifty-years/11/L1' : kind === 'old' ? 'studio/5/L1' : 'studio/7/L1';
    const server = kind === 'no-action' ? undefined : await serveDir(path.join(REPO_ROOT, 'runs', run));
    const ctx = await newContext(browser), page = await ctx.newPage();
    try {
      await installBench(page);
      await page.goto(kind === 'no-action' ? 'http://127.0.0.1:5188/frameworks/studio/no-action.html' : `${server!.origin}/index.html`, { waitUntil: 'networkidle' });
      const capture = (async () => {
        if (kind === 'chronicle') {
          await page.waitForFunction(() => (window as any).__trace?.some((e: any) => e.kind === 'line.say' && e.why === 'actor-report'), {}, { timeout: 240000 });
        } else {
          await page.waitForSelector(kind === 'old' ? '[data-field="actual"]' : '[data-field="voice"][data-voice-index="0"]', { timeout: 240000 });
        }
        if (kind !== 'old') await page.waitForTimeout(1100);
        const name = { studio: 'studio-actor-first', chronicle: 'chronicle-actor-first', 'no-action': 'studio-no-action', old: 'studio-old-report' }[kind];
        await page.screenshot({ path: path.join(out, `${name}.png`) });
      })();
      const result = await play(page, { ...loadThresholds().player, differ: null, shotsDir: null });
      await capture;
      if (kind === 'no-action') {
        const data = await page.evaluate(() => ({ trace: (window as any).__trace, letters: (window as any).__zhuzi.layers.letters() }));
        fs.writeFileSync(path.join(out, 'no-action.trace.jsonl'), data.trace.map((e: any) => JSON.stringify(e)).join('\n') + '\n');
        fs.writeFileSync(path.join(out, 'no-action.layers.json'), JSON.stringify(data.letters, null, 2));
      }
      console.log(`${kind}: ${result.reason}`);
    } finally { await ctx.close(); await server?.close(); }
  }
} finally { await browser.close(); }
