import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsImport } from 'tsx/esm/api';
const { launch, newContext, serveDir, installBench, loadThresholds } = await tsImport('../../bench/lib.ts', import.meta.url);
const { play } = await tsImport('../../bench/player.ts', import.meta.url);
const { checkLayerLetters } = await tsImport('../../engine/layers/bus.ts', import.meta.url);
const { presenceFor } = await tsImport('./presence-letter.ts', import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = path.join(root, 'runs/desk/17/L1/presence-evidence');
fs.mkdirSync(out, { recursive: true });
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const evidence = { screenshots: [], checks: [], mainChars: [], errors: [] };
for (const run of ['runs/desk/17/L1', 'runs/studio/9/L1']) {
  const plan = read(`${run}/plan.json`), { letters } = read(`${run}/layers.json`);
  assert.deepEqual(checkLayerLetters(letters, plan.acts.map(a => a.id)), []);
  for (const act of plan.acts) {
    const presence = letters.filter(l => l.kind === 'presence' && l.act === act.id);
    assert.equal(presence.length, 1); assert.equal(presence[0].receipt.by, 'director');
    assert.deepEqual(presence[0].payload.withheld, act.withhold?.filter(s => s.trim()).length ? act.withhold : undefined);
  }
  const first = letters.find(l => l.kind === 'presence');
  assert(checkLayerLetters(letters.filter(l => l.id !== first.id), plan.acts.map(a => a.id)).length > 0);
  for (const l of letters.filter(l => l.kind === 'presence')) {
    assert([...l.payload.sentence].length <= 18);
    assert(!/[0-9０-９]|shape|withheld|cost|sentence|framework|focus/i.test(l.payload.sentence));
    assert(l.payload.sentence.startsWith('我'));
  }
}
console.log('1 PASS · desk 4/4 + studio 5/5 presence · director receipts · checkLayerLetters=[] · missing letter detected');
console.log('2 PASS · every sentence ≤18 Unicode characters · first person · no digits/field names');
const sample = read('runs/desk/17/L1/plan.json').acts[3];
for (const withhold of [undefined, [], ['']]) {
  const payload = presenceFor({ ...sample, withhold }, []);
  assert(!Object.hasOwn(payload, 'withheld'));
}
console.log('3 PASS · missing / empty / blank withhold records omit withheld key');
const server = await serveDir(root), browser = await launch();
const shot = async (page, name) => {
  const file = path.join(out, `${name}.png`); await page.screenshot({ path: file });
  evidence.screenshots.push(path.relative(root, file));
};
const observe = page => {
  page.on('console', m => { if (m.type() === 'error') evidence.errors.push(m.text()); });
  page.on('pageerror', e => evidence.errors.push(e.message));
};
const count = async page => {
  const chars = await page.evaluate(() => window.__bench.snapshot().chars);
  assert(chars <= 30, `main screen ${chars}>30`); evidence.mainChars.push(chars);
};
const enterShelf = async page => {
  for (const id of ['desk-in', 'desk-doing', 'desk-shelf-in']) await page.locator(`[data-aff="${id}"]`).click();
  await page.waitForFunction(() => document.querySelector('[data-desk-layer]')?.dataset.deskLayer === 'L3');
};
const extract = async page => {
  const popupPromise = page.waitForEvent('popup');
  await page.locator('[data-aff="desk-open"]').click();
  const popup = await popupPromise; await popup.close();
  await page.waitForFunction(() => window.__zhuzi.done === true);
  await page.locator('[data-presence-slip="desk"]').waitFor({ state: 'visible' });
  assert.deepEqual(await page.evaluate(() => window.__zhuzi.layers.check()), []);
};
try {
  const context = await newContext(browser, { viewport: { width: 1280, height: 720 } });
  const page = await context.newPage(); observe(page); await installBench(page);
  await page.goto(`${server.origin}/runs/desk/17/L1/index.html`, { waitUntil: 'networkidle' });
  await enterShelf(page); await shot(page, 'desk-before-extract');
  assert.equal(await page.locator('[data-presence-slip]').count(), 0);
  await extract(page); await count(page); await shot(page, 'desk-short-slip');
  await page.locator('[data-presence-slip="desk"]').click();
  await page.locator('[data-presence-full]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-presence-field="withheld"]').count(), 1);
  await shot(page, 'desk-full-letter'); await page.keyboard.press('Escape');

  const emptyContext = await newContext(browser, { viewport: { width: 1280, height: 720 } });
  await emptyContext.addInitScript(() => {
    let value;
    Object.defineProperty(window, '__zhuzi', { configurable: true, get: () => value, set: z => {
      value = z; for (const a of z.plan.acts) delete a.withhold;
    } });
  });
  const emptyPage = await emptyContext.newPage(); observe(emptyPage); await installBench(emptyPage);
  await emptyPage.goto(`${server.origin}/runs/desk/17/L1/index.html`, { waitUntil: 'networkidle' });
  await enterShelf(emptyPage); await extract(emptyPage); await count(emptyPage);
  const emptyLetters = await emptyPage.evaluate(() => window.__zhuzi.layers.letters().filter(l => l.kind === 'presence'));
  assert(emptyLetters.every(l => !Object.hasOwn(l.payload, 'withheld')));
  fs.writeFileSync(path.join(out, 'no-record.layers.json'), JSON.stringify(emptyLetters, null, 2));
  await emptyPage.locator('[data-presence-slip="desk"]').click();
  assert.equal(await emptyPage.locator('[data-presence-field="withheld"]').count(), 0);
  assert.equal(await emptyPage.locator('[data-presence-field]').count(), 3);
  await shot(emptyPage, 'no-record-no-withheld');

  const oldContext = await newContext(browser, { viewport: { width: 1280, height: 720 } });
  const old = await oldContext.newPage(); observe(old);
  await old.goto(`${server.origin}/runs/desk/13/L1/index.html`, { waitUntil: 'networkidle' });
  await enterShelf(old); await shot(old, 'old-same-camera');
  assert.equal(await old.locator('[data-presence-slip]').count(), 0);
  const comparison = await browser.newPage({ viewport: { width: 1280, height: 440 } });
  const pair = ['old-same-camera', 'desk-short-slip'].map((name, i) => `<figure><figcaption>${i ? '呈现留下短简' : '旧版同机位'}</figcaption><img src="data:image/png;base64,${fs.readFileSync(path.join(out, `${name}.png`)).toString('base64')}"></figure>`).join('');
  await comparison.setContent(`<meta charset="utf-8"><style>body{margin:18px;background:#120d0b;color:#e7d9b6;font:18px serif;display:flex;gap:16px}figure{margin:0;width:50%}img{width:100%}figcaption{margin-bottom:10px}</style>${pair}`);
  await shot(comparison, 'old-new-same-camera-comparison'); await comparison.close();

  const studioContext = await newContext(browser, { viewport: { width: 1280, height: 720 } });
  const studio = await studioContext.newPage(); observe(studio); await installBench(studio);
  await studio.goto(`${server.origin}/runs/studio/9/L1/index.html`, { waitUntil: 'networkidle' });
  const playing = play(studio, { ...loadThresholds().player, maxSeconds: 180, differ: null, shotsDir: null });
  await studio.locator('[data-presence-slip="studio"]').waitFor({ state: 'visible', timeout: 180000 });
  await studio.waitForTimeout(450); await count(studio); await shot(studio, 'studio-lowering-slip');
  assert.equal(await studio.locator('[data-field="sentence"]').count(), 1);
  assert.equal(await studio.evaluate(() => window.__trace.find(e => e.kind === 'line.say' && e.field === 'sentence')?.who), '呈现');
  const span = await studio.evaluate(() => window.__trace.filter(e => e.kind === 'layer.letter' && e.letter.act === 'studio'));
  const report = span.find(e => e.letter.kind === 'report' && e.phase === 'received');
  const presence = span.find(e => e.letter.kind === 'presence' && e.phase === 'sent');
  assert(report && presence && report.t <= presence.t);
  await studio.locator('[data-presence-slip="studio"]').click();
  await studio.locator('[data-presence-full]').waitFor({ state: 'visible' });
  await shot(studio, 'studio-full-letter'); await studio.keyboard.press('Escape');
  const result = await playing; assert(result.done);
  assert.deepEqual(await studio.evaluate(() => window.__zhuzi.layers.check()), []);
  const narrowContext = await newContext(browser, { viewport: { width: 390, height: 844 } });
  const narrow = await narrowContext.newPage(); observe(narrow); await installBench(narrow);
  await narrow.goto(`${server.origin}/runs/desk/17/L1/index.html`, { waitUntil: 'networkidle' });
  await enterShelf(narrow); await extract(narrow); await count(narrow);
  const slip = narrow.locator('[data-presence-slip=\"desk\"]');
  const box = await slip.boundingBox(); assert(box.x >= 0 && box.x + box.width <= 390);
  await shot(narrow, 'desk-short-slip-narrow');
  await slip.focus(); await narrow.keyboard.press('Enter');
  await narrow.locator('[data-presence-full]').waitFor({ state: 'visible' });
  await narrow.keyboard.press('Escape'); await slip.waitFor({ state: 'visible' });
  assert.equal(await slip.evaluate(el => document.activeElement === el), true);
  await narrowContext.close();
  console.log(`4 PASS · desk extraction + studio lowering + full letters + no-record contrast + old same camera · main chars ${Math.max(...evidence.mainChars)}≤30 · ${evidence.screenshots.length} screenshots`);
  assert.deepEqual(evidence.errors, []);
  console.log('5 PASS · console errors 0');
  evidence.checks = ['one letter per act + receipts + consistency', 'short first-person sentences', 'missing withheld absent', 'visible physical slips + main text≤30', 'console errors 0'];
  fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(evidence, null, 2));
  console.log(`PRESENCE PASS · 5/5 · ${path.relative(root, out)}`);
  for (const p of evidence.screenshots) console.log(`  ${p}`);
  await Promise.all([context.close(), emptyContext.close(), oldContext.close(), studioContext.close()]);
} finally { await browser.close(); await server.close(); }
