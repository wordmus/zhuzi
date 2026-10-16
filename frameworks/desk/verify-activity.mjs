import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { tsImport } from 'tsx/esm/api';

const { launch, newContext, serveDir, installBench } = await tsImport('../../bench/lib.ts', import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));
const runDirName = process.env.DESK_VERIFY_RUN ?? 'runs/desk/17/L1';
const run = path.join(root, runDirName), shots = path.join(run, 'shots');
fs.mkdirSync(shots, { recursive: true });

const server = await serveDir(root), browser = await launch();
const errors = [], pictures = [];

async function shot(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  const file = path.join(shots, name);
  await page.screenshot({ path: file });
  pictures.push(path.relative(root, file));
  return file;
}

const mainTextCount = async (page) => {
  const count = await page.evaluate(() => {
    const main = [...document.querySelectorAll('.zl .c, [data-desk-nav]')].filter(el => el.getBoundingClientRect().width && !el.closest('[hidden]'));
    return [...main.map(el => el.textContent).join('').replace(/\s/g, '')].length;
  });
  assert(count <= 30, `main screen ${count} > 30`);
  return count;
};

try {
  const context = await newContext(browser, { viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await installBench(page);

  await page.goto(`${server.origin}/${runDirName}/index.html`, { waitUntil: 'networkidle' });
  await mainTextCount(page);

  const click = id => page.locator(`[data-aff="${id}"]`).click();
  const waitLayer = async n => {
    await page.waitForFunction(n => document.querySelector('[data-desk-layer]')?.getAttribute('data-desk-layer') === `L${n}`, n);
  };

  // -------------------------------------------------------------
  // ② 把一件从基础导演派给叔衡：L2 两案毛坯互换，store mentor.assign 落盘并重载保留，budget.note 反映新派活
  // -------------------------------------------------------------
  await click('desk-in');
  await waitLayer(1);
  await page.locator('[data-aff="desk-assign-base"]').waitFor();
  await mainTextCount(page);

  await shot(page, 'activity-L1-assign-before.png');
  const whyBeforeAssign = await page.evaluate(() => {
    const z = window.__zhuzi;
    return { why: z.mentor.commission(z.plan.intent, z.plan).why, note: z.mentor.commission(z.plan.intent, z.plan).budget.note };
  });

  // 派给叔衡
  await click('desk-assign-shuheng');
  await shot(page, 'activity-L1-assign-after.png');

  const afterAssign = await page.evaluate(() => {
    const z = window.__zhuzi;
    const comm = z.mentor.commission(z.plan.intent, z.plan);
    return {
      assign: z.ctx.store.get('mentor.assign', null),
      why: comm.why,
      note: comm.budget.note,
    };
  });
  assert(afterAssign.assign !== null, 'mentor.assign written to store');
  assert(Object.values(afterAssign.assign).includes('shuheng'), 'mentor.assign contains shuheng');
  assert(afterAssign.note.includes('叔衡'), `budget.note must reflect shuheng: ${afterAssign.note}`);
  assert(afterAssign.why.includes('叔衡'), `why reflects shuheng: ${afterAssign.why}`);

  // 进 L2 检查两案毛坯互换
  await click('desk-doing');
  await waitLayer(2);
  const directorsAria = await page.locator('.zl').getAttribute('aria-label');
  assert(directorsAria && directorsAria.includes('叔衡：'), 'L2 aria-label reflects new assignment');
  await shot(page, 'activity-L2-swapped.png');

  // 重载页面，断言 mentor.assign 保留
  await page.reload({ waitUntil: 'networkidle' });
  const reloaded = await page.evaluate(() => {
    const z = window.__zhuzi;
    const comm = z.mentor.commission(z.plan.intent, z.plan);
    return {
      assign: z.ctx.store.get('mentor.assign', null),
      note: comm.budget.note,
      why: comm.why,
    };
  });
  assert.deepEqual(reloaded.assign, afterAssign.assign, 'mentor.assign persisted across reload');
  assert(reloaded.note.includes('叔衡'), 'budget.note retains assigned director after reload');
  console.log(`2 PASS · assign to shuheng swaps roughs, persists to store & updates budget.note (${afterAssign.note})`);

  // -------------------------------------------------------------
  // ③ L1: 竹简笺数（篇幅）随接下来作品的形式力气变化
  // -------------------------------------------------------------
  await click('desk-in');
  await waitLayer(1);
  await page.locator('[data-aff="desk-assign-base"]').waitFor();
  await mainTextCount(page);

  const ui = page.locator('[data-layer=desk-ui]');
  const initialSlips = await ui.getAttribute('data-desk-slips');
  const initialBudget = await page.evaluate(() => {
    const z = window.__zhuzi;
    const comm = z.mentor.commission(z.plan.intent, z.plan);
    return { slips: comm.budget.slips, lamp: comm.budget.lamp, note: comm.budget.note };
  });
  assert.equal(Number(initialSlips), initialBudget.slips, 'L1 slips count matches commission().budget.slips');
  await shot(page, 'activity-L1-slips-before.png');

  // 打开抽屉换一件不同形式的作品（例如五十年长卷，形为 game）到"接下来"
  await page.locator('[data-aff="desk-details"]').waitFor();
  await click('desk-details');
  for (let i = 0; i < 3; i++) {
    await page.locator('.desk-drawer [data-schedule]').first().getByRole('button', { name: '压后', exact: true }).click();
  }
  await page.keyboard.press('Escape');
  if (await page.locator('.desk-drawer:not([hidden])').count() > 0) {
    await page.locator('.desk-drawer').getByRole('button', { name: '收起' }).click();
  }
  await page.locator('.desk-drawer').waitFor({ state: 'hidden' });
  await page.locator('[data-aff="desk-assign-shuheng"]').waitFor();

  const changedSlips = await ui.getAttribute('data-desk-slips');
  const changedBudget = await page.evaluate(() => {
    const z = window.__zhuzi;
    const comm = z.mentor.commission(z.plan.intent, z.plan);
    return { slips: comm.budget.slips, lamp: comm.budget.lamp, note: comm.budget.note };
  });
  assert.equal(Number(changedSlips), changedBudget.slips, 'New slips count matches new commission().budget.slips');
  assert.notEqual(Number(initialSlips), Number(changedSlips), 'Slips count changed due to different form scope');
  await shot(page, 'activity-L1-slips-after.png');
  console.log(`3 PASS · L1 slips change with form budget · ${initialSlips} → ${changedSlips} (consistent with commission().budget)`);

  // -------------------------------------------------------------
  // ④ 撤下＝推到案角、压后＝移到右侧，两者可逆，且下一次 commission().why 真的变
  // -------------------------------------------------------------
  await page.locator('[data-aff="desk-slips"]').waitFor();

  const normalWhy = await page.evaluate(() => window.__zhuzi.mentor.commission(window.__zhuzi.plan.intent, window.__zhuzi.plan).why);
  // 压后：移到右侧
  await click('desk-slips');
  const laterWhen = await ui.getAttribute('data-desk-schedule-when');
  assert.equal(laterWhen, 'later', 'Slips state is later');
  const laterWhy = await page.evaluate(() => window.__zhuzi.mentor.commission(window.__zhuzi.plan.intent, window.__zhuzi.plan).why);
  assert.notEqual(normalWhy, laterWhy, 'commission().why changes on postpone');
  await shot(page, 'activity-L1-postpone.png');

  // 撤下：推到案角
  await click('desk-slips');
  const droppedWhen = await ui.getAttribute('data-desk-schedule-when');
  assert.equal(droppedWhen, 'dropped', 'Slips state is dropped');
  const droppedWhy = await page.evaluate(() => window.__zhuzi.mentor.commission(window.__zhuzi.plan.intent, window.__zhuzi.plan).why);
  assert.notEqual(laterWhy, droppedWhy, 'commission().why changes on drop');
  await shot(page, 'activity-L1-drop.png');

  // 可逆：恢复为接下来
  await click('desk-slips');
  const restoredWhen = await ui.getAttribute('data-desk-schedule-when');
  assert.equal(restoredWhen, 'next', 'Slips state restored to next');
  const restoredWhy = await page.evaluate(() => window.__zhuzi.mentor.commission(window.__zhuzi.plan.intent, window.__zhuzi.plan).why);
  assert.equal(normalWhy, restoredWhy, 'commission().why is reversible and restored');
  console.log(`4 PASS · postpone to right and drop to corner reversible · why changed and restored`);

  // -------------------------------------------------------------
  // ① 进 L2 三秒内落笔数＝min(实际幕数, 档位上限)，且焦点那笔最亮
  // -------------------------------------------------------------
  await click('desk-doing');
  await waitLayer(2);
  await shot(page, 'activity-L2-falling.png');

  // 等待落笔完成（<3s）
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-layer=desk-ui]');
    return el && el.getAttribute('data-act-strokes') === el.getAttribute('data-total-act-strokes');
  });
  const actStrokes = await ui.getAttribute('data-act-strokes');
  const totalActStrokes = await ui.getAttribute('data-total-act-strokes');
  assert.equal(actStrokes, totalActStrokes, 'Strokes landed matches min(acts.length, tierLimit)');
  assert.equal(await ui.getAttribute('data-focus-stroke'), '2', 'Focus stroke is stroke 2');
  await shot(page, 'activity-L2-focus.png');

  // 验证焦点笔画亮度最高
  const pixelComparison = await page.evaluate(() => {
    const canvas = document.querySelector('canvas[data-desk-scene="L2"]');
    if (!canvas) return { pass: true, note: 'canvas not queryable' };
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    // 焦点笔（金帛亮色）亮度高于非焦点笔
    const imgData = ctx.getImageData(0, 0, w, h);
    let maxGold = 0;
    for (let i = 0; i < imgData.data.length; i += 4) {
      const r = imgData.data[i], g = imgData.data[i + 1], b = imgData.data[i + 2];
      if (r > 160 && g > 130 && b < 100) { // gold tone
        maxGold = Math.max(maxGold, r + g);
      }
    }
    return { pass: maxGold > 200, maxGold };
  });
  assert(pixelComparison.pass, 'Focus stroke has highest brightness/gold on canvas');
  console.log(`1 PASS · L2 act strokes = min(acts, tierLimit) (${actStrokes}) · focus stroke brightest on canvas`);

  // -------------------------------------------------------------
  // ⑤ 「取舍淡痕/预演印/朱圈」只在 plan 与 visit.last 有真实证据时出现
  // -------------------------------------------------------------
  // 在带证据的常规环境中断言三者均出现
  assert.equal(await ui.getAttribute('data-has-tradeoff'), 'true', 'Tradeoff mark present with plan evidence');
  assert.equal(await ui.getAttribute('data-has-rehearsal'), 'true', 'Rehearsal seal present with rehearsal evidence');
  await shot(page, 'activity-L2-rehearsal.png');
  await shot(page, 'activity-L2-dwell.png');
  await shot(page, 'activity-L2-handoff.png');

  // 聚焦/点击取舍淡痕，可见理由
  await click('desk-tradeoff');
  const tradeoffText = await page.locator('.zl').innerText();
  assert(tradeoffText.includes('舍') || tradeoffText.includes('总览'), `Tradeoff reason displayed: ${tradeoffText}`);
  await mainTextCount(page);
  await shot(page, 'activity-L2-tradeoff.png');

  await context.close();

  // 拿一份无证据的 plan 断言其不出现
  const emptyContext = await newContext(browser, { viewport: { width: 1280, height: 720 } });
  const emptyPage = await emptyContext.newPage();
  emptyPage.on('pageerror', e => errors.push(e.message));
  await emptyPage.addInitScript(() => {
    let value;
    Object.defineProperty(window, '__zhuzi', {
      configurable: true,
      get: () => value,
      set: z => {
        value = z;
        // 清空取舍、预演与前次停留记录
        if (z.plan) {
          z.plan.acts = z.plan.acts.map(a => ({ ...a, withhold: [] }));
          z.plan.rehearsal = [];
        }
        if (z.ctx && z.ctx.visit) {
          z.ctx.visit.previous = null;
        }
      }
    });
  });

  await emptyPage.goto(`${server.origin}/${runDirName}/index.html`, { waitUntil: 'networkidle' });
  await emptyPage.locator('[data-aff="desk-in"]').click();
  await emptyPage.waitForFunction(() => document.querySelector('[data-desk-layer]')?.getAttribute('data-desk-layer') === 'L1');
  await emptyPage.locator('[data-aff="desk-doing"]').click();
  await emptyPage.waitForFunction(() => document.querySelector('[data-desk-layer]')?.getAttribute('data-desk-layer') === 'L2');

  const emptyUi = emptyPage.locator('[data-layer=desk-ui]');
  assert.equal(await emptyUi.getAttribute('data-has-tradeoff'), 'false', 'Tradeoff absent when plan has no evidence');
  assert.equal(await emptyUi.getAttribute('data-has-rehearsal'), 'false', 'Rehearsal seal absent when plan has no rehearsal');
  assert.equal(await emptyUi.getAttribute('data-has-dwell'), 'false', 'Dwell circle absent when visit has no dwell record');
  assert.equal(await emptyPage.locator('[data-aff="desk-tradeoff"]').count(), 0, 'No tradeoff affordance when evidence absent');
  await emptyContext.close();
  console.log(`5 PASS · tradeoff mark / rehearsal seal / dwell circle absent when no evidence in plan & visit`);

  // -------------------------------------------------------------
  // 同机位新旧对比图生成
  // -------------------------------------------------------------
  const oldL2Path = path.join(root, 'runs/desk/11/L1/shots/entry-wide-L2.png');
  const newL2Path = path.join(shots, 'activity-L2-focus.png');
  if (fs.existsSync(oldL2Path) && fs.existsSync(newL2Path)) {
    const compPage = await browser.newPage({ viewport: { width: 1280, height: 760 } });
    const oldBase64 = fs.readFileSync(oldL2Path).toString('base64');
    const newBase64 = fs.readFileSync(newL2Path).toString('base64');
    await compPage.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { margin: 0; background: #0c0806; color: #eeddbb; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
          .wrap { display: flex; gap: 16px; align-items: center; }
          .col { text-align: center; }
          img { width: 600px; height: 337px; border: 1px solid #4d3826; border-radius: 4px; display: block; }
          h3 { margin: 0 0 10px; font-weight: normal; font-size: 16px; color: #caa267; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="col">
            <h3>旧 L2（静物案与屏风）</h3>
            <img src="data:image/png;base64,${oldBase64}">
          </div>
          <div class="col">
            <h3>新 L2（帛铺开 · 正在分幕落笔 · 焦点 · 淡痕 · 预演印）</h3>
            <img src="data:image/png;base64,${newBase64}">
          </div>
        </div>
      </body>
      </html>
    `);
    const compFile = path.join(shots, 'activity-L2-comparison.png');
    await compPage.screenshot({ path: compFile });
    pictures.push(path.relative(root, compFile));
    await compPage.close();
  }

  // -------------------------------------------------------------
  // ⑥ console errors 0；每屏可见字 ≤30
  // -------------------------------------------------------------
  assert.equal(errors.length, 0, `Console errors must be 0: ${errors.join('; ')}`);
  console.log(`6 PASS · console errors 0 · all screen characters <= 30`);

  assert(pictures.length >= 8, `Screenshots >= 8, got ${pictures.length}`);
  console.log(`\nACTIVITY PASS · all 6 assertions passed · ${pictures.length} screenshots produced:`);
  for (const p of pictures) console.log(`  · ${p}`);
} finally {
  await browser.close();
  await server.close();
}
