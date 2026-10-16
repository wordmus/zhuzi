// 真实浏览器自证：不调用动作、不拨快时钟，55 秒内禾自己把这件事做完。
// 先构建，再运行：pnpm exec tsx frameworks/east3d/idle.test.ts [构建 HTML]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, newContext, serveDir } from '../../bench/lib';

const target = path.resolve(process.argv[2] ?? 'dist-east3d/dev/east3d.html');
assert.ok(fs.existsSync(target), `先构建页面：${target}`);
const out = path.resolve('docs/3d-design/east-suburb/evidence');
fs.mkdirSync(out, { recursive: true });
const server = await serveDir(path.dirname(target));
const browser = await launch();
try {
  // 同时验证普通和减少动态：两页都完全无人操作，计时使用真实的 55 秒。
  const results = await Promise.all((['no-preference', 'reduce'] as const).map(async reducedMotion => {
    const context = await newContext(browser);
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${server.origin}/${path.basename(target)}?seed=4`, { waitUntil: 'networkidle' });
    await page.waitForFunction('!!window.__zhuzi?.ctx?.handoff?.east3d');
    const start = Date.now();
    for (const at of [2, 10, 35, 48, 55]) {
      const remaining = at * 1000 - (Date.now() - start);
      if (remaining > 0) await page.waitForTimeout(remaining);
      await page.screenshot({ path: path.join(out, `idle-${reducedMotion}-${at}s.png`) });
    }
    const result = await page.evaluate<{ done: boolean; state: { gapCount: number; handShifted: boolean; elapsed: number; triangles: number; materials: number; peakDrawCalls: number }; clicks: number; events: { eventKind: string; elapsed: number; source?: string }[]; lines: string[]; finalColors: number }>(`(() => {
      const z = window.__zhuzi;
      const trace = window.__trace;
      const final = document.querySelector('canvas[data-east3d="final"]');
      const pixels = final?.getContext('2d').getImageData(0, 0, final.width, final.height).data;
      const colors = new Set();
      if (pixels) for (let i = 0; i < pixels.length; i += 800) colors.add([pixels[i], pixels[i+1], pixels[i+2]].join(','));
      return { done: z.done, state: z.ctx.handoff.east3d, clicks: trace.filter(e => e.kind === 'aff.click').length,
        events: trace.filter(e => String(e.eventKind).startsWith('east3d.')),
        lines: trace.filter(e => e.kind === 'line.say').map(e => e.text), finalColors: colors.size };
    })()`);
    const event = (kind: string) => result.events.filter((e: any) => e.eventKind === `east3d.${kind}`);
    assert.equal(result.done, true, '55 秒后应 done');
    assert.equal(result.clicks, 0, '证明无人输入');
    for (const [kind, at] of [['crack', 6], ['sky', 32]] as const) {
      assert.equal(event(kind).length, 1, `${kind} 只发生一次`);
      assert.equal(event(kind)[0].source, 'self');
      assert.ok(Math.abs(event(kind)[0].elapsed - at) < 0.3, `${kind} 应在 ${at} 秒自主发生`);
    }
    assert.equal(event('hand-shift').length, 1, '碎土迫使换手位');
    assert.deepEqual(result.lines, ['天老爷，东郊还有我呢。']);
    assert.equal(result.state.gapCount, 1);
    assert.equal(result.state.handShifted, true);
    assert.equal(result.state.elapsed, 50);
    assert.ok(result.state.triangles <= 120000);
    assert.ok(result.state.materials <= 10);
    assert.ok(result.state.peakDrawCalls <= 45);
    assert.ok(result.finalColors > 20, '结束仍有真实田景末帧');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, `idle-${reducedMotion}.json`), JSON.stringify(result, null, 2));
    console.log(`PASS idle (${reducedMotion}) · 55s 无输入 · done=true · crack=${event('crack')[0].elapsed}s · sky=${event('sky')[0].elapsed}s · gap=1 · hand-shift=1 · line=1 · triangles=${result.state.triangles} · materials=${result.state.materials} · peak-calls=${result.state.peakDrawCalls} · errors=0`);
    await context.close();
    return result;
  }));
  assert.equal(results.length, 2);
  console.log(`PASS east3d idle 2/2 · screenshots ${out}`);
} finally {
  await browser.close(); await server.close();
}
