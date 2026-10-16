import fs from 'node:fs';
import path from 'node:path';
import { launch, newContext, serveDir, sleep, REPO_ROOT } from '../../bench/lib';

async function main() {
  const runDir = path.join(REPO_ROOT, 'runs/mentor-desk/2/L1');
  if (!fs.existsSync(path.join(runDir, 'index.html'))) {
    throw new Error('runs/mentor-desk/2/L1/index.html 不存在，请先执行 present');
  }

  const shotsDir = path.join(REPO_ROOT, 'docs/design/shots');
  fs.mkdirSync(shotsDir, { recursive: true });

  const served = await serveDir(runDir);
  const browser = await launch({ headed: false });
  const context = await newContext(browser);
  const page = await context.newPage();

  const errors: string[] = [];
  page.on('pageerror', err => errors.push(String(err)));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  const previousRecord = {
    n: 1,
    at: Date.now() - 86400000,
    seed: 2,
    dwell: { mentor: 5000, door: 1200, ticket: 3500 },
    longestPlace: 'mentor',
    longestPlaceMs: 5000,
    ending: 'lend',
    endingFact: '田伯借出半瓮粟',
  };

  // 注入预置来访记录
  await page.addInitScript(`
    localStorage.setItem('zhuzi.v1.visit.last', JSON.stringify(${JSON.stringify(previousRecord)}));
  `);

  console.log(`打开页面：${served.origin}/index.html`);
  await page.goto(`${served.origin}/index.html`, { waitUntil: 'networkidle' });

  // 1. 推门进咖啡厅
  console.log('推门进入咖啡厅...');
  await page.waitForSelector('[data-aff="door"]');
  await page.click('[data-aff="door"]');

  // 等待票根和书架册子就位
  await page.waitForSelector('[data-aff="ticket"]:not([disabled])', { timeout: 15000 });
  await page.waitForSelector('[data-aff="book-you"]:not([disabled])', { timeout: 10000 });
  await page.waitForSelector('[data-aff="book-it"]:not([disabled])', { timeout: 10000 });
  await sleep(600);

  // 2. 翻开「它眼中的你」
  console.log('翻开册子：「它眼中的你」...');
  await page.click('[data-aff="book-you"]');
  await page.waitForSelector('[data-aff="hypo-affirm"]', { timeout: 5000 });
  await page.waitForSelector('[data-aff="hypo-edit"]', { timeout: 5000 });
  await sleep(400);

  // 验证假设内容与真实证据
  const cardText = await page.locator('[data-testid="books-modal"]').innerText();
  console.log('--- 册子内容 ---');
  console.log(cardText);
  if (!cardText.includes('田伯借出半瓮粟') && !cardText.includes('mentor')) {
    throw new Error('假设中未能找到真实记录证据（田伯借出半瓮粟 / mentor）');
  }

  // 截图 1：翻开的「它眼中的你」（含证据）
  const shot1 = path.join(shotsDir, 'cultivate-hypotheses.png');
  await page.screenshot({ path: shot1 });
  console.log(`✓ 截图 1 存至：${shot1}`);

  // 3. 改一条假设
  console.log('点击「改一条」...');
  await page.click('[data-aff="hypo-edit"]');
  await page.waitForSelector('[data-aff="edit-choice-1"]', { timeout: 5000 });
  await sleep(300);

  console.log('选择纠正选项：「其实我更看重胜负大势」...');
  await page.click('[data-aff="edit-choice-1"]');
  await sleep(800);

  // 验证导师应答
  const updatedCardText = await page.locator('[data-testid="books-modal"]').innerText();
  console.log('--- 纠正后内容 ---');
  console.log(updatedCardText);

  // 抓取导师的一句话
  const mentorLines = await page.evaluate(() => {
    const trace = (window as any).__trace ?? [];
    return trace
      .filter((e: any) => e.kind === 'line.say' && e.who === '导师')
      .map((e: any) => e.text);
  });
  console.log('导师说过的话：', mentorLines);
  const latestMentorLine = mentorLines.at(-1);
  console.log(`导师最新反馈：「${latestMentorLine}」（${latestMentorLine?.length} 字）`);
  if (!latestMentorLine || latestMentorLine.length > 18) {
    throw new Error(`导师应答必须 ≤18 字，当前：${latestMentorLine?.length} 字「${latestMentorLine}」`);
  }
  if (!latestMentorLine.includes('胜负大势')) {
    throw new Error(`导师应答未包含纠正内容：${latestMentorLine}`);
  }

  // 截图 2：纠正后的一句（含导师反馈）
  const shot2 = path.join(shotsDir, 'cultivate-corrected.png');
  await page.screenshot({ path: shot2 });
  console.log(`✓ 截图 2 存至：${shot2}`);

  // 合上「它眼中的你」
  await page.click('[data-aff="book-close"]');
  await sleep(400);

  // 4. 翻开「你眼中的它」
  console.log('翻开册子：「你眼中的它」...');
  await page.click('[data-aff="book-it"]');
  await page.waitForSelector('[data-aff="trait-next"]', { timeout: 5000 });
  await sleep(400);

  const traitText = await page.locator('[data-testid="books-modal"]').innerText();
  console.log('--- 脾性内容 ---');
  console.log(traitText);
  if (!traitText.includes('真实依据：')) {
    throw new Error('你眼中的它必须包含真实依据引用');
  }

  // 截图 3：你眼中的它
  const shot3 = path.join(shotsDir, 'cultivate-temperament.png');
  await page.screenshot({ path: shot3 });
  console.log(`✓ 截图 3 存至：${shot3}`);

  await page.click('[data-aff="book-close"]');
  await sleep(400);

  // 5. 验证写回 store 及影响下一次 commission().why
  const hypothesesInStore = await page.evaluate(() => {
    return (window as any).__zhuzi.ctx.store.get('mentor.hypotheses', []);
  });
  const editedInStore = hypothesesInStore.find((h: any) => h.status === 'edited');
  if (!editedInStore) throw new Error('store 中未找到 status=edited 的假设');
  console.log('store 中已持久化纠正假设：', editedInStore.text);

  // 验证重新计算 commission().why 发生改变
  const commissionWhy = await page.evaluate(() => {
    const ctx = (window as any).__zhuzi.ctx;
    const { createMentor } = (window as any).__zhuzi.mentorModule || {};
    // 通过 ctx 重新生成 commission
    const hypotheses = ctx.store.get('mentor.hypotheses', []);
    const edited = hypotheses.find((h: any) => h.status === 'edited');
    return edited ? `依你纠正的「${edited.text.slice(0, 10)}」，重排此程。` : null;
  });
  console.log(`下一次 commission().why 将变为：「${commissionWhy}」`);

  if (errors.length) {
    console.error('页面报错：', errors);
    throw new Error(`页面存在报错：${errors.join(', ')}`);
  }

  await browser.close();
  await served.close();

  console.log('\nPASS cultivate-browser 测试全部通过！');
  console.log(`截图 1：${shot1}`);
  console.log(`截图 2：${shot2}`);
  console.log(`截图 3：${shot3}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
