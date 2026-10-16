// Interaction proof, run against a served dev page or a built file URL:
// node frameworks/gallery/verify.mjs http://127.0.0.1:5173/dev/gallery.html
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

const url = process.argv[2] ?? pathToFileURL(resolve('dist-gallery/dev/gallery.html')).href;
const evidence = resolve('frameworks/gallery/evidence');
await mkdir(evidence, { recursive: true });
const recipe = JSON.parse(await readFile('assets/library/shelf-gallery/recipe.json', 'utf8'));
assert(recipe.plates.length >= 6 && recipe.plates.length <= 10);
for (const plate of recipe.plates) {
  assert([...plate.caption].length <= 18);
  assert([...plate.question].length <= 30);
  assert(plate.source && plate.license.includes('外部分发需确认'));
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addInitScript(() => {
  // Fresh context has no previous gallery save; monitor every frame of entry.
  window.__galleryFirst3s = [];
  const started = performance.now();
  const sample = () => {
    if (performance.now() - started > 3000) return;
    window.__galleryFirst3s.push(document.querySelectorAll('[data-aff]:not([disabled])').length);
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
const readPosition = () => page.evaluate(() => window.__zhuzi.ctx.store.get('gallery:shelf-gallery:position', 0));
try {
  await page.goto(url);
  const surface = page.locator('[data-aff="plate-01-scroll"]');
  await surface.waitFor();
  await page.waitForFunction(() => document.querySelector('[data-aff="gallery-fold"]'));
  assert.equal(await page.evaluate(() => Math.max(...window.__galleryFirst3s)), 1);
  await page.screenshot({ path: `${evidence}/01-desktop.png` });
  await page.mouse.move(940, 360);
  await page.mouse.down();
  await page.mouse.move(370, 360, { steps: 12 });
  await page.mouse.up();
  const dragged = await readPosition();
  assert(dragged > .3, `drag must advance: ${dragged}`);
  await page.reload();
  await surface.waitFor();
  assert.equal(await readPosition(), dragged);
  const traceRestore = await page.evaluate(() => window.__trace.filter((e) => e.eventKind === 'gallery.restore'));
  assert(traceRestore.some((e) => e.position === dragged));
  await page.mouse.move(650, 360);
  await page.mouse.wheel(0, 400);
  await page.waitForFunction((before) => window.__zhuzi.ctx.store.get('gallery:shelf-gallery:position', 0) > before, dragged);
  const wheeled = await readPosition();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__zhuzi.stage.narrow);
  assert.equal(await readPosition(), wheeled);
  await page.mouse.move(195, 560);
  await page.mouse.down();
  await page.mouse.move(195, 330, { steps: 12 });
  await page.mouse.up();
  const narrowDragged = await readPosition();
  assert(narrowDragged > wheeled, 'narrow-screen vertical drag must advance');
  await page.reload();
  await surface.waitFor();
  assert.equal(await readPosition(), narrowDragged);
  const narrowRestore = await page.evaluate(() => window.__trace.find(e => e.eventKind === 'gallery.restore'));
  assert.equal(narrowRestore.position, narrowDragged);
  await page.screenshot({ path: `${evidence}/02-narrow.png` });
  await surface.click({ position: { x: 195, y: 330 } });
  const question = await page.evaluate(() => window.__trace.filter((e) => e.eventKind === 'gallery.question').at(-1));
  assert(question && [...question.text].length <= 30);
  await page.screenshot({ path: `${evidence}/03-question.png` });
  await page.keyboard.press('End');
  await page.waitForFunction(() => window.__zhuzi.done === true);
  await page.reload();
  await page.locator('[data-aff="gallery-fold"]').waitFor();
  await page.locator('[data-aff="gallery-fold"]').click();
  await page.waitForFunction(() => window.__zhuzi.done === true);
  assert.deepEqual(errors, []);
  const result = { pass: true, plates: recipe.plates.length, first3s: 1, dragged, restored: dragged, wheeled, narrowDragged, narrowRestored: narrowDragged, narrow: 'single column', questionChars: [...question.text].length, completion: ['end', 'fold'], evidence };
  await writeFile(`${evidence}/verification.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
