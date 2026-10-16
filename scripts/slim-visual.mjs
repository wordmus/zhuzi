// Compare the same generated plan/seed with only PNG encoding changed.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tsImport } from 'tsx/esm/api';
const { launch, newContext, serveDir } = await tsImport('../bench/lib.ts', import.meta.url);
const root = process.cwd(), output = path.join(root, 'runs/desk/15/L1/slim-visual');
fs.mkdirSync(output, { recursive: true });
const cases = [ ['desk', 15, 'L1'], ['three-look-at-sky', 3, 'L2'], ['shelf-gallery', 3, 'L2'], ['east-suburb-3d', 5, 'L3'] ];
const server = await serveDir(root), browser = await launch();
const results = [], offline = [];
try {
  for (const [intent, seed, tier] of cases) {
    const controlDir = path.join(root, 'runs', intent, String(seed), tier, 'png-control');
    if (!fs.existsSync(path.join(controlDir, 'index.html'))) {
      // Controls are disposable; keep the exact plan, regenerate the large HTML on demand.
      assert(fs.existsSync(path.join(controlDir, 'plan.json')), `missing control plan: ${controlDir}`);
      execFileSync('pnpm', ['exec', 'vite', 'build'], { cwd: root, env: { ...process.env, ZHUZI_SLIM: '0', ZHUZI_PLAN: path.join(controlDir, 'plan.json'), ZHUZI_OUT: path.join(controlDir, 'build') }, stdio: 'inherit' });
      fs.copyFileSync(path.join(controlDir, 'build/index.html'), path.join(controlDir, 'index.html'));
    }
    const pair = {};
    for (const control of [true, false]) {
      const context = await newContext(browser), page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await context.addInitScript(() => { let x = 123456789; Math.random = () => { x = (1664525 * x + 1013904223) >>> 0; return x / 4294967296; }; });
      // Install before navigation; freeze timers/RAF at the same point in both files.
      const epoch = new Date('2026-10-17T00:00:00Z');
      await page.clock.install({ time: epoch });
      await page.clock.pauseAt(new Date(+epoch + 1000));
      await page.goto(`${server.origin}/runs/${intent}/${seed}/${tier}/${control ? 'png-control/' : ''}index.html`, { waitUntil: 'networkidle' });
      for (let n = 0; n < 100; n++) {
        if (await page.evaluate(() => !!window.__zhuzi?.ctx)) break;
        await page.clock.runFor(16);
      }
      if (intent === 'east-suburb-3d') {
        for (let n = 0; n < 100; n++) {
          if (await page.evaluate(() => !!window.__zhuzi?.ctx?.handoff?.east3d)) break;
          await new Promise(r => setTimeout(r, 50));
        }
      }
      // Asset decoding completes independently of the virtual frame clock.
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
      await page.clock.runFor(1000);
      const count = intent === 'desk' ? 4 : 1;
      for (let layer = 0; layer < count; layer++) {
        if (layer) {
          await page.locator(`[data-aff="${['desk-in', 'desk-doing', 'desk-shelf-in'][layer - 1]}"]`).click({ force: true });
          await page.mouse.move(0, 0);
          await page.clock.runFor(400);
          assert.equal(await page.locator('[data-desk-layer]').getAttribute('data-desk-layer'), `L${layer}`);
        }
        const name = `${intent}${intent === 'desk' ? '-L' + layer : ''}`;
        const file = path.join(output, `${name}-${control ? 'before' : 'after'}.png`);
        await page.screenshot({ path: file, animations: 'disabled' });
        (pair[name] ??= {})[control ? 'before' : 'after'] = file;
      }
      assert.deepEqual(errors, [], `${intent} screenshot page errors`);
      await context.close();
    }
    const diffPage = await browser.newPage();
    for (const [name, files] of Object.entries(pair)) {
      const data = await diffPage.evaluate(async ({ before, after }) => {
        const load = async src => { const i = new Image(); i.src = src; await i.decode(); return i; };
        const a = await load(before), b = await load(after);
        const c = document.createElement('canvas'); c.width = a.width; c.height = a.height;
        const x = c.getContext('2d'); x.drawImage(a, 0, 0); const p = x.getImageData(0, 0, c.width, c.height);
        x.clearRect(0, 0, c.width, c.height); x.drawImage(b, 0, 0); const q = x.getImageData(0, 0, c.width, c.height);
        let changed = 0, over8 = 0, sum = 0, max = 0;
        for (let i = 0; i < p.data.length; i += 4) {
          let peak = 0;
          for (let k = 0; k < 3; k++) { const d = Math.abs(p.data[i + k] - q.data[i + k]); sum += d; max = Math.max(max, d); peak = Math.max(peak, d); p.data[i + k] = Math.min(255, d * 8); }
          changed += Number(peak > 0); over8 += Number(peak > 8); p.data[i + 3] = 255;
        }
        x.putImageData(p, 0, 0);
        return { width: c.width, height: c.height, changedPixels: changed, changedPercent: changed / (c.width * c.height) * 100, over8Percent: over8 / (c.width * c.height) * 100, meanAbsoluteRGB: sum / (c.width * c.height * 3), maxChannelDelta: max, diff: c.toDataURL() };
      }, Object.fromEntries(Object.entries(files).map(([key, file]) => [key, 'data:image/png;base64,' + fs.readFileSync(file).toString('base64')])));
      const { diff, ...metrics } = data;
      const difference = path.join(output, `${name}-diff-x8.png`);
      fs.writeFileSync(difference, Buffer.from(diff.split(',')[1], 'base64'));
      results.push({ name, ...metrics, before: path.relative(root, files.before), after: path.relative(root, files.after), difference: path.relative(root, difference) });
      console.log(`VISUAL ${name} · MAE ${metrics.meanAbsoluteRGB.toFixed(4)}/255 · changed ${metrics.changedPercent.toFixed(3)}% · delta>8 ${metrics.over8Percent.toFixed(3)}% · max ${metrics.maxChannelDelta}`);
    }
    await diffPage.close();
    // Real file:// navigation: no resource server and no local image/model sidecars.
    const context = await newContext(browser), page = await context.newPage();
    const errors = [], localSidecars = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.url().startsWith('file:') && !r.isNavigationRequest()) localSidecars.push(r.url()); });
    await page.goto(pathToFileURL(path.join(root, 'runs', intent, String(seed), tier, 'index.html')).href, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__zhuzi?.ctx);
    if (intent === 'east-suburb-3d') await page.waitForFunction(() => !!window.__zhuzi?.ctx?.handoff?.east3d);
    const canvases = await page.evaluate(async () => {
      const surfaces = [...document.querySelectorAll('canvas')];
      for (const image of document.images) {
        await image.decode();
        const c = document.createElement('canvas'); c.width = image.naturalWidth; c.height = image.naturalHeight;
        c.getContext('2d').drawImage(image, 0, 0); surfaces.push(c);
      }
      return surfaces.map(c => { try { c.toDataURL(); return 'clean'; } catch (e) { return String(e); } });
    });
    assert(canvases.length > 0, `${intent}: no drawn surface`); assert(canvases.every(c => c === 'clean'), `${intent}: canvas tainted`); assert.deepEqual(localSidecars, []); assert.deepEqual(errors, []);
    offline.push({ intent, canvases: canvases.length, localSidecars, errors });
    console.log(`FILE PASS ${intent} · ${canvases.length} clean canvases · no local sidecars · errors 0`);
    await context.close();
  }
  const sheet = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const rows = results.map(r => `<section><h2>${r.name} · MAE ${r.meanAbsoluteRGB.toFixed(4)}/255</h2><div>${['before', 'after'].map(k => `<figure><figcaption>${k === 'before' ? '原 PNG' : '内联 WebP'}</figcaption><img src="data:image/png;base64,${fs.readFileSync(path.join(root, r[k])).toString('base64')}"></figure>`).join('')}</div></section>`).join('');
  await sheet.setContent(`<html lang="zh"><meta charset="utf-8"><style>body{margin:24px;background:#191510;color:#e9ddc5;font:16px serif}h2{font-size:20px;margin:20px 0 6px}section div{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0}figcaption{margin:4px 0}img{width:100%}</style><h1>同 seed、同机位 · PNG → WebP</h1>${rows}</html>`);
  await sheet.screenshot({ path: path.join(output, 'comparison-sheet.png'), fullPage: true });
  await sheet.close();
  fs.writeFileSync(path.join(output, 'comparison.json'), JSON.stringify({ viewport: [1280, 720], seeds: cases, method: 'same generated plan and seed; deterministic Math.random; same Playwright virtual clock; PNG control vs inline WebP; RGB absolute difference, diff image magnified 8x', results, offline }, null, 2));
} finally { await browser.close(); await server.close(); }
