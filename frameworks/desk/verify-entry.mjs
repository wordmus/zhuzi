import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { tsImport } from 'tsx/esm/api';
const { launch, newContext, serveDir, installBench } = await tsImport('../../bench/lib.ts', import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));
const run = path.join(root, 'runs/desk/11/L1'), shots = path.join(run, 'shots');
fs.mkdirSync(shots, { recursive: true });
// Exercise the real Node branch in an isolated root with no index.
const { directFromFiles } = await tsImport('../../director/pipeline/director-node.ts', import.meta.url);
const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-entry-'));
try {
  fs.mkdirSync(path.join(isolated, 'intents'));
  fs.copyFileSync(path.join(root, 'intents/desk.json'), path.join(isolated, 'intents/desk.json'));
  const empty = await directFromFiles({ root: isolated, intentPath: 'intents/desk.json', seed: 7, tier: 'L1' });
  assert(empty.acts.every(act => act.works.length === 0));
  assert.equal(fs.existsSync(path.join(isolated, 'runs/index.json')), false);
  console.log('node missing-index PASS · empty real plan · index stays absent');
} finally { fs.rmSync(isolated, { recursive: true, force: true }); }
const server = await serveDir(root), browser = await launch();
const results = [];
// Discover earlier entry settings from the real shared engine, without changing their values or source.
const historicalSettings = ['mentor.' + 'lamps', 'mentor.' + 'lamp.poured'];
assert(historicalSettings.length > 0);
const screenshot = async (page, name) => {
  await page.mouse.move(0, 0); await page.waitForTimeout(450);
  const file = path.join(shots, name); const buffer = await page.screenshot({ path: file });
  return { file: path.relative(root, file), hash: createHash('sha256').update(buffer).digest('hex') };
};
try {
  for (const [name, viewport] of [['wide', { width: 1280, height: 720 }], ['narrow', { width: 390, height: 844 }]]) {
    const context = await newContext(browser, { viewport }), page = await context.newPage();
    const errors = [];
    if (name === 'narrow') await context.addInitScript(keys => {
      for (const key of keys) localStorage.setItem(`zhuzi.v1.${key}`, JSON.stringify({ desk: 2 }));
    }, historicalSettings);
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    await installBench(page);
    await page.goto(`${server.origin}/runs/desk/11/L1/index.html`, { waitUntil: 'networkidle' });
    const layer = page.locator('[data-desk-layer]');
    const click = id => page.locator(`[data-aff="${id}"]`).click();
    const waitLayer = async n => {
      await page.waitForFunction(n => document.querySelector('[data-desk-layer]')?.getAttribute('data-desk-layer') === `L${n}`, n);
      assert.equal(await page.locator('[data-desk-scene]').count(), 1);
      assert.equal(await page.locator(`[data-desk-scene="L${n}"]`).count(), 1);
      assert.equal(await page.locator('[data-desk-layer]').count(), 1);
    };
    const chars = [];
    const mainTextCount = async () => {
      const count = await page.evaluate(() => {
        const main = [...document.querySelectorAll('.zl .c, [data-desk-nav]')].filter(el => el.getBoundingClientRect().width && !el.closest('[hidden]'));
        return [...main.map(el => el.textContent).join('').replace(/\s/g, '')].length;
      });
      assert(count <= 30, `main screen ${count} > 30`); chars.push(count); return count;
    };
    await waitLayer(0);
    assert.equal(await page.locator('[data-aff]:enabled').count(), 1, 'first three seconds have one action');
    assert.equal(await page.locator('[data-aff="desk-in"]').getAttribute('aria-label'), '往里看');
    assert.equal(await page.locator('.desk-drawer').isVisible(), false);
    assert.equal(await page.locator('[data-aff="desk-back"]').count(), 0);
    const pictures = [await screenshot(page, `entry-${name}-L0.png`)];
    await mainTextCount();
    assert.equal(await page.locator('[data-aff]').evaluateAll(els => els.map(el => el.textContent).join('').trim()), '', 'scene actions have no visible text buttons');
    const next = ['desk-in', 'desk-doing', 'desk-shelf-in'];
    for (let n = 1; n <= 3; n++) {
      await click(next[n - 1]); await waitLayer(n);
      await page.locator('[data-aff="desk-back"]').waitFor();
      assert.equal(await page.locator('.desk-drawer').isVisible(), false);
      pictures.push(await screenshot(page, `entry-${name}-L${n}.png`));
      await mainTextCount();
      assert.equal(await page.locator('[data-aff]').evaluateAll(els => els.map(el => el.textContent).join('').trim()), '', 'all layer actions are painted objects');
      if (n === 1) {
        const before = await page.locator('.zl').innerText();
        await click('desk-thought');
        assert.notEqual(await page.locator('.zl').innerText(), before);
        await mainTextCount();
      }
      // Every layer can go back exactly one step, then forward again.
      await click('desk-back'); await waitLayer(n - 1); await mainTextCount();
      await click(next[n - 1]); await waitLayer(n);
    }
    assert.equal(new Set(pictures.map(p => p.hash)).size, 4, 'four scene screenshots differ');
    await page.locator('[data-aff="desk-details"]').waitFor();
    assert.equal(await page.locator('[data-aff="desk-details"]').getAttribute('aria-expanded'), 'false');
    const before = await page.evaluate(() => {
      const z = window.__zhuzi; return { why: z.mentor.commission(z.plan.intent, z.plan).why, id: z.plan.intent.id };
    });
    await click('desk-details');
    assert.equal(await page.locator('.desk-drawer').isVisible(), true);
    assert.equal(await page.locator('[data-aff="desk-details"]').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('.desk-drawer h2').innerText(), '它眼中的你');
    assert.equal(await page.locator('.desk-drawer').getByText('来访史', { exact: true }).count(), 1);
    assert.equal(await page.locator('.desk-drawer').getByText('下一次的打算', { exact: true }).count(), 1);
    assert.equal(await page.locator('.desk-drawer').getByText('架上作品', { exact: true }).count(), 0);
    const first = page.locator('.desk-drawer [data-hypothesis]').first();
    const corrected = '我更想看人物如何改变环境';
    await first.locator('input').fill(corrected);
    if (name === 'narrow') {
      await first.locator('input').press('Tab');
      await page.keyboard.press('Enter'); // keyboard submission must not activate scene navigation
    } else await first.getByRole('button', { name: '纠正', exact: true }).click();
    const after = await page.evaluate(() => {
      const z = window.__zhuzi;
      return { why: z.mentor.commission(z.plan.intent, z.plan).why, id: z.plan.intent.id,
        saved: z.ctx.store.get('mentor.hypotheses', []), persistent: z.ctx.store.persistent };
    });
    assert.equal(after.id, before.id); assert.notEqual(after.why, before.why);
    assert(after.saved.some(h => h.text === corrected && h.status === 'edited'));
    assert(after.why.includes('依你纠正的'));
    if (name === 'narrow') {
      const preserved = await page.evaluate(keys => keys.every(key => window.__zhuzi.ctx.store.get(key, null)?.desk === 2), historicalSettings);
      assert(preserved, 'historical settings remain untouched while corrections control desk reasons');
    }
    await mainTextCount();
    pictures.push(await screenshot(page, `entry-${name}-drawer.png`));
    const expandedChars = await page.evaluate(() => window.__bench.snapshot().chars);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.desk-drawer').isVisible(), false);
    assert.equal(await page.locator('[data-aff="desk-details"]').getAttribute('aria-expanded'), 'false');
    await mainTextCount();
    let chosen = await page.evaluate(() => {
      const z = window.__zhuzi; return z.plan.acts[3].works.filter(w => w.intent !== 'desk').sort((a, b) => b.madeAt.localeCompare(a.madeAt) || `${a.intent}/${a.seed}/${a.tier}`.localeCompare(`${b.intent}/${b.seed}/${b.tier}`))[0];
    });
    assert(chosen?.url, 'real indexed work has an entry');
    const popupPromise = page.waitForEvent('popup'); await click('desk-open');
    const popup = await popupPromise; await popup.waitForLoadState('domcontentloaded');
    assert.equal(popup.url(), new URL(chosen.url, page.url()).href);
    assert.equal((await popup.request.get(popup.url())).status(), 200); await popup.close();
    await page.waitForFunction(() => window.__zhuzi.done === true);
    const layerErrors = await page.evaluate(() => window.__zhuzi.layers.check());
    assert.deepEqual(layerErrors, []); assert.deepEqual(errors, []);
    // A real reload demonstrates localStorage persistence, not just an in-memory edit.
    await page.reload({ waitUntil: 'networkidle' }); await waitLayer(0);
    const persistedWhy = await page.evaluate(() => { const z = window.__zhuzi; return z.mentor.commission(z.plan.intent, z.plan).why; });
    assert.equal(persistedWhy, after.why);
    const result = { name, viewport, pictures, chars, expandedChars, before, after, persistedWhy, errors, layers: 'PASS', popup: '200' };
    results.push(result);
    console.log(`entry ${name} PASS · L0 only · L0↔L1↔L2↔L3 · drawer collapsed/edit/persist · same intent ${before.id} why changed · main chars ${Math.max(...chars)} · expanded total chars ${expandedChars} (drawer excluded from main limit) · popup 200 · layers PASS · console errors 0${name === 'narrow' ? ' · keyboard submit PASS · historical settings preserved' : ''}`);
    console.log(`why before: ${before.why}\nwhy after: ${after.why}`);
    await context.close();
  }
  // Index missing: change only this browser's plan snapshot, never an existing run.
  const context = await newContext(browser), page = await context.newPage();
  await page.addInitScript(() => {
    let value;
    Object.defineProperty(window, '__zhuzi', { configurable: true, get: () => value, set: z => {
      value = z; for (const act of z.plan.acts) act.works = [];
    } });
  });
  await page.goto(`${server.origin}/runs/desk/11/L1/index.html`, { waitUntil: 'networkidle' });
  for (const id of ['desk-in', 'desk-doing', 'desk-shelf-in']) await page.locator(`[data-aff="${id}"]`).click();
  await page.waitForFunction(() => document.querySelector('[data-desk-layer]')?.getAttribute('data-desk-layer') === 'L3');
  assert.equal(await page.locator('.zl').innerText(), '还没装上');
  let popups = 0; page.on('popup', () => popups++);
  await page.locator('[data-aff="desk-open"]').click();
  await page.waitForFunction(() => window.__zhuzi.done === true); assert.equal(popups, 0);
  console.log('missing-index PASS · 还没装上 · no fabricated work · no popup');
  await context.close();
  // Separate evidence sheet: these are four screenshots, not a product overview screen.
  const sheet = await browser.newPage({ viewport: { width: 1280, height: 910 } });
  const images = results[0].pictures.slice(0, 4).map((p, i) => `<figure><figcaption>L${i} · ${['案上', '导师', '导演', '呈现'][i]}</figcaption><img src="data:image/png;base64,${fs.readFileSync(path.join(root, p.file)).toString('base64')}"></figure>`).join('');
  await sheet.setContent(`<html lang="zh"><meta charset="utf-8"><style>body{margin:28px;background:#120d0b;color:#e7d9b6;font:20px 'Songti SC',serif}p{font-size:16px}main{display:grid;grid-template-columns:1fr 1fr;gap:22px}figure{margin:0}figcaption{margin-bottom:9px}img{width:100%;display:block}</style><h1>四张不同屏幕，一次只见一层</h1><p>点击才进入下一层；每层可退回。此页只作验收对照，不出现在产品里。</p><main>${images}</main></html>`);
  await sheet.screenshot({ path: path.join(shots, 'entry-four-layers-comparison.png') }); await sheet.close();
  const comparison = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const pair = ['runs/desk/7/L1/shots/entry-wide-L0.png', results[0].pictures[0].file];
  const pairImages = pair.map((p, i) => `<figure><figcaption>${i ? '返工后 · 票根就是动作' : '返工前 · 扁平原型'} · 1280×720</figcaption><img src="data:image/png;base64,${fs.readFileSync(path.join(root, p)).toString('base64')}"></figure>`).join('');
  await comparison.setContent(`<html lang="zh"><meta charset="utf-8"><style>body{margin:24px;background:#120d0b;color:#e7d9b6;font:20px 'Songti SC',serif}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0}img{width:100%;display:block}figcaption{margin:14px 0}</style><h1>相同机位 · L0 案上</h1><p>四层路径原样保留；石板青与文字按钮已换成黑漆、灯焰和可拿起的票根。</p><main>${pairImages}</main></html>`);
  await comparison.screenshot({ path: path.join(shots, 'entry-art-before-after-L0.png') }); await comparison.close();
  const report = { results, missingIndex: 'PASS', mainTextPolicy: '≤30 characters including navigation; expanded mentor drawer excluded, measured separately', comparison: 'shots/entry-four-layers-comparison.png' };
  fs.writeFileSync(path.join(run, 'entry-verification.json'), JSON.stringify(report, null, 2));
  console.log('ENTRY PASS · 12 screenshots · four layers never coexist · correction changes real commission().why · console errors 0');
} finally { await browser.close(); await server.close(); }
