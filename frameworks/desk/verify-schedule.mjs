import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsImport } from 'tsx/esm/api';
const root = fileURLToPath(new URL('../../', import.meta.url));
const { buildSchedule } = await tsImport('../../engine/mind/schedule.ts', import.meta.url);
const { groupWorks } = await tsImport('./groups.ts', import.meta.url);
const { readExperience } = await tsImport('../../director/pipeline/experience.ts', import.meta.url);
const { launch, newContext, serveDir } = await tsImport('../../bench/lib.ts', import.meta.url);
const index = JSON.parse(fs.readFileSync(path.join(root, 'runs/index.json')));
const experience = JSON.parse(fs.readFileSync(path.join(root, 'director/seed-memory/experience.json')));
const base = { visits: 2, works: index, experience };
const a = buildSchedule(base);
const recordedLayers = JSON.parse(fs.readFileSync(path.join(root, 'runs/first-visit/13/L1/layers.json')));
const recordedVisit = recordedLayers.letters.find(l => l.kind === 'retro').payload.userModelDelta['visit.last'];
assert(Object.values(recordedVisit.dwell).some(ms => ms > 0));
const b = buildSchedule({ ...base, previous: recordedVisit });
assert(a.entries.length >= 2); assert.notDeepEqual(a, b);
assert(b.entries.some(e => e.evidence.kind === 'dwell' && e.evidence.ref.includes('visit.last.dwell')));
const corrected = buildSchedule({ ...base, hypotheses: [{ id: 'real-edit', status: 'edited', text: '我更愿意看电影', confidence: .9, evidence: [{ visit: 2, what: '用户纠正' }] }] });
assert.notDeepEqual(a, corrected); assert(corrected.entries.some(e => e.evidence.kind === 'hypothesis-correction'));
assert(a.entries.every(e => e.evidence.ref && [...e.why].length <= 18 && [...e.title].length <= 6));
console.log('1 PASS · real visit.last.dwell / hypothesis correction change schedule with evidence refs');
const groups = groupWorks(index);
for (const form of new Set(index.filter(w => w.intent !== 'desk').map(w => w.form))) assert(groups.some(g => g.form === form));
assert.equal(groups.flatMap(g => g.works).length, index.filter(w => w.intent !== 'desk').length);
assert(groupWorks([]).every(g => g.works.length === 0));
assert(groups.some(g => !g.works.length));
console.log('3 PASS · every real form grouped once · empty groups contain no invented works');
assert(experience.entries.length);
for (const e of experience.entries) {
  assert(e.source && e.evidence?.ref && Object.hasOwn(e, 'param') && Array.isArray(e.caseRefs));
  assert(fs.existsSync(path.join(root, e.evidence.ref.split('#')[0])));
}
assert.equal(readExperience(null).entries.length, 0);
console.log(`4 PASS · ${experience.entries.length} entries source + evidence + param · missing memory stays empty`);
const shots = path.join(root, 'runs/desk/11/L1/shots'); fs.mkdirSync(shots, { recursive: true });
const server = await serveDir(root), browser = await launch();
const errors = [], pictures = [];
async function shot(page, name) {
  await page.mouse.move(0, 0); await page.waitForTimeout(450);
  const file = path.join(shots, name); await page.screenshot({ path: file }); pictures.push(path.relative(root, file));
}
try {
  const context = await newContext(browser), page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push(e.message));
  const click = id => page.locator(`[data-aff="${id}"]`).click();
  const showQueue = () => page.locator('.desk-drawer').evaluate(el => {
    const heading = [...el.querySelectorAll('h3')].find(h => h.textContent === '它下一步的排期');
    if (heading) el.scrollTop = heading.offsetTop - 24;
  });
  await page.goto(`${server.origin}/runs/desk/11/L1/index.html`, { waitUntil: 'networkidle' });
  await click('desk-in'); await page.locator('[data-aff="desk-details"]').waitFor();
  await shot(page, 'schedule-L1.png');
  await click('desk-details'); await showQueue(); await shot(page, 'schedule-drawer-before.png');
  const before = await page.evaluate(() => { const z = window.__zhuzi; return z.mentor.commission(z.plan.intent, z.plan).why; });
  await page.locator('[data-schedule]').nth(1).getByRole('button', { name: '上移', exact: true }).click();
  const after = await page.evaluate(() => { const z = window.__zhuzi; return { why: z.mentor.commission(z.plan.intent, z.plan).why, queue: z.ctx.store.get('mentor.schedule', null) }; });
  assert.notEqual(before, after.why); assert(after.queue.entries[0].when === 'next');
  await showQueue(); await shot(page, 'schedule-drawer-after.png'); await page.keyboard.press('Escape');
  await shot(page, 'schedule-L1-after.png');
  await page.reload({ waitUntil: 'networkidle' });
  const reloaded = await page.evaluate(() => { const z = window.__zhuzi; return { queue: z.ctx.store.get('mentor.schedule', null), why: z.mentor.commission(z.plan.intent, z.plan).why }; });
  assert.deepEqual(reloaded.queue, after.queue);
  assert(reloaded.why.includes(after.queue.entries[0].title), 'persisted head still drives commission after a new visit');
  console.log(`2 PASS · persisted move changes real commission().why · ${before} → ${after.why}`);
  for (const id of ['desk-in', 'desk-doing']) await click(id);
  await page.locator('[data-aff="desk-memory-next"]').waitFor(); await shot(page, 'experience-L2.png');
  const firstMemory = await page.locator('[data-desk-memory]').getAttribute('data-desk-memory');
  await click('desk-memory-next');
  assert.notEqual(await page.locator('[data-desk-memory]').getAttribute('data-desk-memory'), firstMemory);
  await shot(page, 'experience-L2-next.png'); await click('desk-shelf-in');
  await page.locator('[data-aff="desk-group-next"]').waitFor(); await shot(page, 'groups-L3-first.png');
  const seen = new Set();
  for (let i = 0; i < groups.length; i++) {
    const form = await page.locator('[data-desk-group]').getAttribute('data-desk-group'); seen.add(form);
    if (!groups.find(g => g.form === form)?.works.length) assert.equal(await page.locator('.zl').innerText(), '这种形还没装上');
    await click('desk-group-next');
    if (i === 0) await shot(page, 'groups-L3-second.png');
  }
  assert.equal(seen.size, groups.length);
  for (const form of new Set(index.filter(w => w.intent !== 'desk').map(w => w.form))) assert(seen.has(form));
  await context.close();
  // Missing file is represented by the same empty loader output in the runtime store.
  const emptyContext = await newContext(browser), empty = await emptyContext.newPage();
  empty.on('pageerror', e => errors.push(e.message));
  await empty.addInitScript(() => {
    let value; Object.defineProperty(window, '__zhuzi', { configurable: true, get: () => value, set: z => {
      value = z; const get = z.ctx.store.get.bind(z.ctx.store);
      z.ctx.store.get = (key, fallback) => key === 'desk.experience' ? [] : get(key, fallback);
    } });
  });
  await empty.goto(`${server.origin}/runs/desk/11/L1/index.html`, { waitUntil: 'networkidle' });
  for (const id of ['desk-in', 'desk-doing']) await empty.locator(`[data-aff="${id}"]`).click();
  assert.equal(await empty.locator('.zl').innerText(), '还没记下什么');
  assert.equal(await empty.locator('[data-aff="desk-memory-next"]').count(), 0);
  await shot(empty, 'experience-L2-empty.png'); await emptyContext.close();
  // Three same-camera old/new comparisons are evidence sheets, outside the product.
  const sheet = await browser.newPage({ viewport: { width: 1280, height: 790 } });
  for (const [level, newer] of [['L1', 'schedule-L1.png'], ['L2', 'experience-L2.png'], ['L3', 'groups-L3-first.png']]) {
    const old = path.join(root, `runs/desk/9/L1/shots/entry-wide-${level}.png`);
    const images = [old, path.join(shots, newer)].map((p, i) => `<figure><figcaption>${i ? '现在' : '以前'} · ${level} · 1280×720</figcaption><img src="data:image/png;base64,${fs.readFileSync(p).toString('base64')}"></figure>`).join('');
    await sheet.setContent(`<html><style>body{background:#120d0b;color:#e7d9b6;font:20px serif;margin:24px}main{display:flex;gap:20px}figure{margin:0;width:50%}img{width:100%}</style><p>同机位对照 · 只作验收证据</p><main>${images}</main></html>`);
    await shot(sheet, `comparison-${level}.png`);
  }
  assert.deepEqual(errors, []); console.log('5 PASS · console errors 0 · grouped navigation and empty chronicle verified');
  fs.writeFileSync(path.join(root, 'runs/desk/11/L1/schedule-verification.json'), JSON.stringify({ before, after, groups: groups.map(g => ({ form: g.form, works: g.works.length })), experience: experience.entries.length, errors, pictures }, null, 2));
  console.log(`SCHEDULE PASS · five assertions · ${pictures.length} screenshots · runs/desk/11/L1/schedule-verification.json`);
} finally { await browser.close(); await server.close(); }
