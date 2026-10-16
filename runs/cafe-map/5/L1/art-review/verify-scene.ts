import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { serveDir, launch, newContext } from '../../../../../bench/lib.ts';
import { directFromFiles } from '../../../../../director/pipeline/director-node.ts';
const root=fileURLToPath(new URL('../../../../../',import.meta.url));
async function main(){
 const out=path.join(root,'runs/cafe-map/5/L1/art-review');fs.mkdirSync(out,{recursive:true});
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'cafe-no-index-'));
 fs.mkdirSync(path.join(fixture,'intents'));fs.copyFileSync(path.join(root,'intents/cafe-map.json'),path.join(fixture,'intents/cafe-map.json'));
 const missing=await directFromFiles({root:fixture,intentPath:'intents/cafe-map.json',seed:5,tier:'L1'});
 assert.equal(fs.existsSync(path.join(fixture,'runs/index.json')),false);assert.equal(missing.acts[0]?.cafeMap?.works,null);
 const actual=JSON.parse(fs.readFileSync(path.join(root,'runs/index.json'),'utf8'));const actualWorks=Array.isArray(actual)?actual:actual.works;
 const server=await serveDir(root),browser=await launch(); const evidence:any={indexExists:true,indexCount:actualWorks.length,missingIndexFixture:fixture,missingPlanCount:0};
 try {
  for(const mode of ['populated','empty','old']){
   const context=await newContext(browser);const page=await context.newPage();
   if(mode==='empty')await page.addInitScript(()=>{Object.defineProperty(window,'__zhuzi',{configurable:true,set(value){value.plan.acts[0].cafeMap.works=null;Object.defineProperty(window,'__zhuzi',{value,writable:true,configurable:true});}});});
   await page.goto(server.origin+`/runs/cafe-map/${mode==='old'?3:5}/L1/index.html`);await page.waitForLoadState('networkidle');
   await page.locator('[data-aff="door"]').click();await page.locator('[data-aff="lamp-oil"]:enabled').waitFor({timeout:20000});await page.waitForTimeout(600);await page.mouse.move(20,20);
   if(mode==='populated'){
    await page.screenshot({path:path.join(out,'01-oil.png')});
    evidence.before=await page.evaluate(()=>{const z=(window as any).__zhuzi;return z.mentor.commission(z.plan.intent,z.plan);});
    // Reading the first silk strip takes 0.8 seconds and never creates a panel.
    await page.mouse.move(198,432);await page.waitForTimeout(1600);
    evidence.hypothesisLine=await page.locator('.zl').allTextContents();
   }
   await page.locator('[data-aff="lamp-oil"]').click();await page.waitForTimeout(800);
   if(mode==='old'){
    await page.screenshot({path:path.join(out,'old-02-directors.png')});await context.close();continue;
   }
   if(mode==='populated'){
    evidence.after=await page.evaluate(()=>{const z=(window as any).__zhuzi;return z.mentor.commission(z.plan.intent,z.plan);});
    assert.notEqual(evidence.before.why,evidence.after.why);assert.notEqual(evidence.before.budget.lamp,evidence.after.budget.lamp);
    await page.mouse.move(20,20);await page.screenshot({path:path.join(out,'02-directors.png')});
   }
   await page.locator('[data-aff="directors"]').click();await page.waitForTimeout(800);await page.mouse.move(20,20);
   const count=Number(await page.locator('[data-aff="shelf"]').getAttribute('data-work-count'));assert.equal(count,mode==='empty'?0:actualWorks.length);
   if(mode==='populated'){
    evidence.renderedWorkCount=count;await page.screenshot({path:path.join(out,'03-shelf.png')});
    const shadows=await page.locator('[data-aff]').evaluateAll(els=>els.map(el=>({id:(el as HTMLElement).dataset.aff,shadow:getComputedStyle(el).boxShadow})));evidence.hitAreaShadows=shadows;assert(shadows.every(s=>s.shadow==='none'));
   }
   await page.locator('[data-aff="shelf"]').click();await page.waitForTimeout(1400);await page.mouse.move(20,20);
   if(mode==='empty'){
    const text=await page.locator('.zl').allTextContents();assert(text.some(s=>s.includes('架子还空着。')));evidence.emptyText=text;await page.screenshot({path:path.join(out,'05-empty-shelf.png')});
   }else await page.screenshot({path:path.join(out,'04-door.png')});
   await context.close();
  }
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));
  console.log(`SCENE PASS · 四站 4 张 + 空架 1 张 · index ${actualWorks.length}/${evidence.renderedWorkCount} · missing 0 · hit-area frames 0`);
  console.log(`OIL UI PASS · why ${evidence.before.why} => ${evidence.after.why} · lamp ${evidence.before.budget.lamp} => ${evidence.after.budget.lamp}`);
  console.log(`HYPOTHESIS READ · ${JSON.stringify(evidence.hypothesisLine)}`);console.log(`截图与证据 ${out}`);
 }finally{await browser.close();await server.close();fs.rmSync(fixture,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
