import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

const REPO_ROOT = process.cwd();
const runDir = path.join(REPO_ROOT, 'runs', 'console', '2', 'L1');
const targetHtml = fs.existsSync(path.join(runDir, 'index.html'))
  ? path.join(runDir, 'index.html')
  : path.join(REPO_ROOT, 'dist-console', 'dev', 'console.html');

console.log(`[verify] Target HTML: ${targetHtml}`);

// Simple static server from REPO_ROOT to handle modules & relative paths
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, 'http://127.0.0.1');
  let filePath = path.join(REPO_ROOT, decodeURIComponent(parsedUrl.pathname));
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404).end('Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const targetRel = path.relative(REPO_ROOT, targetHtml).replace(/\\/g, '/');
const url = `http://127.0.0.1:${port}/${targetRel}`;
console.log(`[verify] Serving on ${url}`);

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  }
});
page.on('pageerror', err => {
  pageErrors.push(String(err));
});

try {
  // Handle prompt dialog for hypothesis correction
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') {
      await dialog.accept('你更看重天下的波澜而非一人得失');
    } else {
      await dialog.accept();
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#console-root');

  // ==========================================
  // 断言 ①：假设列表来自 hypotheses.ts 且纠正后 store 变化
  // ==========================================
  console.log('[verify] Assert ①: 假设列表来自 hypotheses.ts 且纠正后 store 变化');
  const initialHypotheses = await page.evaluate(() => {
    return window.__zhuzi.ctx.store.get('mentor.hypotheses', []);
  });
  assert(Array.isArray(initialHypotheses) && initialHypotheses.length >= 3, '假设列表应至少有 3 条');
  const hFocus = initialHypotheses.find(h => h.id === 'h-focus');
  assert(hFocus, '必须包含 h-focus 假设');
  assert(hFocus.text.includes('人物'), '初始假设文本应来自 hypotheses.ts');

  // 点击纠正按钮
  await page.click('.btn-correct[data-id="h-focus"]');

  // 验证 store 中假设确实被修改
  const updatedHypotheses = await page.evaluate(() => {
    return window.__zhuzi.ctx.store.get('mentor.hypotheses', []);
  });
  const updatedFocus = updatedHypotheses.find(h => h.id === 'h-focus');
  assert.equal(updatedFocus.status, 'edited', '纠正后状态应为 edited');
  assert.equal(updatedFocus.text, '你更看重天下的波澜而非一人得失', '纠正后文本应写入 store');

  // ==========================================
  // 断言 ②：灯油 +/− 使同一 intent 的 commission().why 与 budget.lamp 不同
  // ==========================================
  console.log('[verify] Assert ②: 灯油 +/− 使 commission().why 与 budget.lamp 不同');
  const commissionBefore = await page.evaluate(() => {
    const z = window.__zhuzi;
    const plan = z.plan;
    const intent = { ...plan.intent, id: 'fifty-years' };
    return z.mentor.commission(intent, plan);
  });

  // 点击增加灯油
  await page.click('.btn-oil-plus[data-intent="fifty-years"]');

  const commissionAfter = await page.evaluate(() => {
    const z = window.__zhuzi;
    const plan = z.plan;
    const intent = { ...plan.intent, id: 'fifty-years' };
    return z.mentor.commission(intent, plan);
  });

  const storedLamps = await page.evaluate(() => {
    return window.__zhuzi.ctx.store.get('mentor.lamps', {});
  });

  assert(storedLamps['fifty-years'] > 1.5, `store 中 fifty-years 灯油应更新: ${storedLamps['fifty-years']}`);
  assert.notEqual(commissionBefore.budget.lamp, commissionAfter.budget.lamp, 'commission().budget.lamp 必须变');
  assert.notEqual(commissionBefore.why, commissionAfter.why, 'commission().why 必须变');
  console.log(`  · budget.lamp: ${commissionBefore.budget.lamp} -> ${commissionAfter.budget.lamp}`);
  console.log(`  · why: "${commissionBefore.why}" -> "${commissionAfter.why}"`);

  // ==========================================
  // 断言 ③：作品卡与 works.json 一致且「进入」URL 存在
  // ==========================================
  console.log('[verify] Assert ③: 作品卡与 works.json 一致且「进入」URL 存在');
  const worksPath = path.join(REPO_ROOT, 'assets', 'library', 'console', 'works.json');
  assert(fs.existsSync(worksPath), 'assets/library/console/works.json 必须存在');
  const worksData = JSON.parse(fs.readFileSync(worksPath, 'utf8'));
  const cardCount = await page.locator('.work-card').count();
  assert.equal(cardCount, worksData.length, `作品卡数量 (${cardCount}) 必须与 works.json (${worksData.length}) 一致`);

  for (const work of worksData) {
    if (work.url) {
      // url 是相对于 runs/console/2/L1 的相对路径
      const targetPath = path.resolve(runDir, work.url);
      assert(fs.existsSync(targetPath), `作品《${work.title}》的 URL 文件必须存在: ${targetPath}`);
    }
  }

  // 展开第一件作品的「为什么值得你看」
  await page.click('.work-card details summary');

  // ==========================================
  // 断言 ④：全程 console errors = 0
  // ==========================================
  console.log('[verify] Assert ④: 全程 console errors = 0');
  assert.equal(consoleErrors.length, 0, `consoleErrors 必须为 0，收到: ${consoleErrors.join(', ')}`);
  assert.equal(pageErrors.length, 0, `pageErrors 必须为 0，收到: ${pageErrors.join(', ')}`);

  // ==========================================
  // 截图 3 张：导师栏、导演栏、呈现栏
  // ==========================================
  const shotsDir = path.join(REPO_ROOT, 'docs', 'design', 'shots');
  fs.mkdirSync(shotsDir, { recursive: true });

  const mentorCol = page.locator('#col-mentor');
  await mentorCol.screenshot({ path: path.join(shotsDir, 'console-mentor.png') });
  console.log(`[verify] 导师栏截图保存至: ${path.join(shotsDir, 'console-mentor.png')}`);

  const directorCol = page.locator('#col-director');
  await directorCol.screenshot({ path: path.join(shotsDir, 'console-director.png') });
  console.log(`[verify] 导演栏截图保存至: ${path.join(shotsDir, 'console-director.png')}`);

  const worksCol = page.locator('#col-works');
  await worksCol.screenshot({ path: path.join(shotsDir, 'console-works.png') });
  console.log(`[verify] 呈现栏截图保存至: ${path.join(shotsDir, 'console-works.png')}`);

  console.log('\n=== ALL VERIFY CHECKS PASSED ===\n');
} finally {
  await browser.close();
  server.close();
}
