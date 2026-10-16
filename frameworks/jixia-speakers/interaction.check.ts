import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serveDir } from '../../bench/lib';
import { QUOTES, SCHOOLS } from './logic';

// 少量真实浏览器检查，覆盖纯规则测试不能证明的拖动、键盘和竖屏。
const browser = await chromium.launch({ headless: true });
const speakers = await serveDir('dist-jixia-speakers');
const wheel = await serveDir('dist-wude-wheel');
const errors: string[] = [];
try {
  for (const perfect of [true, false]) {
    const page = await browser.newPage({ viewport: perfect ? { width: 1280, height: 720 } : { width: 390, height: 844 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${speakers.origin}/dev/jixia-speakers.html?seed=317`, { waitUntil: 'networkidle' });
    await page.locator('[data-aff="ji-scroll"]').click();
    for (let round = 0; round < 5; round++) {
      await page.waitForFunction(`window.__trace.filter(e => e.kind === 'jixia-speakers.step' && e.round === ${round}).length && document.querySelector('[data-aff="school-0"]:not([disabled])')`);
      const id = await page.evaluate(`window.__trace.filter(e => e.kind === 'jixia-speakers.step' && e.round === ${round}).at(-1).quote`) as string;
      const index = SCHOOLS.indexOf(QUOTES.find(q => q.id === id)!.school);
      const choice = perfect ? index : (index + 1) % 6;
      if (round === 0) await page.screenshot({ path: `frameworks/jixia-speakers/${perfect ? 'desktop' : 'mobile'}.png` });
      await page.keyboard.press(String(choice + 1));
    }
    await page.waitForFunction('window.__zhuzi.done');
    const data = await page.evaluate('window.__zhuzi.result.data') as any;
    assert.equal(data.metrics.correct, perfect ? 5 : 0);
    assert.equal(data.metrics.seeds, perfect ? 0 : 5);
    assert.equal(data.facts[0].id, perfect ? 'jixia-speakers-standing' : 'jixia-speakers-questioned');
    assert.equal(await page.locator('[data-aff]').count(), 0);
    await page.close();
  }
  for (const drag of [false, true]) {
    const page = await browser.newPage({ viewport: drag ? { width: 390, height: 844 } : { width: 1280, height: 720 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${wheel.origin}/dev/wude-wheel.html?seed=317`, { waitUntil: 'networkidle' });
    await page.locator('[data-aff="ji-scroll"]').click();
    for (const [round, choice] of [3, 1, 4].entries()) {
      await page.waitForFunction(`window.__trace.some(e => e.kind === 'wude-wheel.step' && e.round === ${round}) && document.querySelector('[data-aff="wude-pointer"]:not([disabled])')`);
      if (!drag && round === 0) {
        await page.locator('[data-aff="virtue-0"]').click();
        await page.waitForFunction('!document.querySelector(\'[data-aff="virtue-3"]\').disabled');
      }
      if (round === 0) await page.screenshot({ path: `frameworks/wude-wheel/${drag ? 'mobile' : 'desktop'}.png` });
      if (drag) {
        const from = (await page.locator('[data-aff="wude-pointer"]').boundingBox())!;
        const to = (await page.locator(`[data-aff="virtue-${choice}"]`).boundingBox())!;
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down(); await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 }); await page.mouse.up();
      } else await page.keyboard.press(String(choice + 1));
    }
    await page.waitForFunction('window.__zhuzi.done');
    const data = await page.evaluate('window.__zhuzi.result.data') as any;
    assert.equal(data.metrics.perfect, Number(drag));
    assert.equal(data.metrics.mistakes, drag ? 0 : 1);
    assert.equal(data.metrics.correct, 3);
    assert.equal(await page.locator('[data-aff]').count(), 0);
    assert.deepEqual(await page.evaluate('window.__zhuzi.layers.check()'), []);
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS interaction：辨言全对/全错，五德错选重试/三轮拖动，键盘/竖屏，出口清理，真实回信');
} finally { await browser.close(); await speakers.close(); await wheel.close(); }
