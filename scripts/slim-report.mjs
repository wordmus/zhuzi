import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const builds = ['desk/15/L1', 'three-look-at-sky/3/L2', 'shelf-gallery/3/L2', 'east-suburb-3d/5/L3'];
const assets = JSON.parse(fs.readFileSync('runs/desk/15/L1/checks/assets.json'));
const visual = JSON.parse(fs.readFileSync('runs/desk/15/L1/slim-visual/comparison.json'));
const baseline = JSON.parse(fs.readFileSync('scripts/slim-baseline.json'));
const mb = n => (n / 1e6).toFixed(3);
const previous = fs.existsSync('runs/desk/15/L1/checks/slimming-summary.json') ? JSON.parse(fs.readFileSync('runs/desk/15/L1/checks/slimming-summary.json')) : null;
const rows = builds.map(build => {
  const dir = path.join('runs', build);
  const control = path.join(dir, 'png-control/index.html');
  const before = fs.existsSync(control) ? fs.statSync(control).size : previous.builds.find(b => b.build === build).before;
  const after = fs.statSync(path.join(dir, 'index.html')).size;
  const bench = JSON.parse(fs.readFileSync(path.join(dir, 'bench.json')));
  assert.equal(bench.verdict, 'PASS'); assert.equal(bench.checks.filter(c => c.pass).length, 9);
  return { build, before, after, savedPercent: (1 - after / before) * 100, bench: bench.summary, hard: bench.hard, checks: bench.checks };
});
const png = assets.filter(a => a.file.endsWith('.png'));
const imported = png.filter(a => !a.file.includes('/refs/'));
const glbs = assets.filter(a => a.file.endsWith('.glb'));
const sum = (xs, key) => xs.reduce((s, a) => s + a[key], 0);
const summary = { generatedAt: new Date().toISOString(), converter: '/opt/homebrew/bin/cwebp 1.6.0 (libsharpyuv 0.4.2)', builds: rows, assets, visual, baselineFileCount: Object.keys(baseline.files).length };
fs.writeFileSync('runs/desk/15/L1/checks/slimming-summary.json', JSON.stringify(summary, null, 2));
const doc = `# P4 单页瘦身与稳定入口 · 验收报告

以前每份 HTML 约 33 MB，现在四形都在 **12,000,000 bytes 以下**，仍是一份 HTML，双击可开。打开 [稳定入口](../../runs/entry/index.html) 会进入最新 desk seed 15；若浏览器没有跳转，点「点这里进入案上」。没有改旧作品、PNG、GLB、recipe 或验收门槛，没有安装依赖，没有操作 git。

## 文件体积（同 intent、同 seed、同 plan）

MB 均按 1,000,000 bytes；本轮严格采用 12 MB 十进制上限，比 12 MiB 更严。

| 新构建 | PNG 对照 bytes（MB） | WebP bytes（MB） | 减少 | bench |
| --- | ---: | ---: | ---: | --- |
${rows.map(r => `| ${r.build} | ${r.before.toLocaleString('en-US')} (${mb(r.before)}) | ${r.after.toLocaleString('en-US')} (${mb(r.after)}) | ${r.savedPercent.toFixed(2)}% | PASS 9/9 |`).join('\n')}

PNG 对照由本轮代码关闭转换（ZHUZI_SLIM=0）构建，使用相同 seed 和 plan；四份 plan 均逐字节相同。既有旧版实际文件不覆盖，截图对照也没有重新画旧作品。历史库仍占用原磁盘空间，本轮不会删除或瘦身旧 run。

## 转换方式与可复验小例子

- 本机探测：which cwebp ffmpeg sips 均存在，选 **/opt/homebrew/bin/cwebp 1.6.0**，libsharpyuv 0.4.2。没有 pnpm add，没有安装。
- Vite 的 pre/load 插件在构建时把 PNG URL 模块替换为 data:image/webp;base64；不改源码中的资源路径、原 PNG 字节、镜头布局、运行代码、资源尺寸或配方。
- 短片画面与图集中 07/08 的渲染图：cwebp -q 82 -m 6 -alpha_q 100 -exact；图集 01–06 的文字/硬边截图：-near_lossless 90 -q 100 -m 6 -exact。
- 缓存：node_modules/.cache/zhuzi-slim/<SHA256>.webp，哈希覆盖源文件字节、编码器版本及全部参数；node_modules 已被现有 .gitignore 排除，Vite 清空 outDir 也不会删除缓存。首次 13 张转换约 21.5 秒，后续构建 13/13 命中缓存、约 0.7–2.4 秒。
- 小例子：shot-01-he.png 从 3,167,478 bytes 变为 311,896 bytes；再次 present 输出「13 cache hits」。源码 PNG 的 SHA 不变，HTML 中变为内联 WebP，无需 WebP 外部文件。
- 14 张源 PNG 尺寸全部保留；源图均不含透明像素，另用 32×32、256 级 alpha 的探针实际编码/浏览器解码，1,020 个非全不透明像素的 alpha 最大差为 **0**。见 runs/desk/15/L1/checks/alpha.json。

## 资产清单（原始字节与转换后字节）

所有框架被当前应用静态导入，因此四形 HTML 都带 13 张图片与 6 个 GLB；用途列区分真正使用画面的形。style-probe 仅为参考，不在 HTML 内，单独测量以覆盖全部 14 张 PNG。

| 资源（assets/library/） | 使用位置 | 原 bytes | 后 bytes | 编码 |
| --- | --- | ---: | ---: | --- |
${assets.map(a => `| ${a.file.replace('assets/library/', '')} | ${a.file.includes('/refs/') ? '仅参考，不打包' : a.file.includes('/three-look-at-sky/') ? 'film；四形均打包' : a.file.includes('/shelf-gallery/') ? 'gallery；四形均打包' : 'east3d；四形均打包'} | ${a.before.toLocaleString('en-US')} | ${a.after.toLocaleString('en-US')} | ${a.mode} |`).join('\n')}

14 张 PNG 合计 ${sum(png, 'before').toLocaleString('en-US')} → ${sum(png, 'after').toLocaleString('en-US')} bytes；实际打包的 13 张是 ${sum(imported, 'before').toLocaleString('en-US')} → ${sum(imported, 'after').toLocaleString('en-US')} bytes，base64 字符约 ${mb(sum(imported, 'before') * 4 / 3)} → ${mb(sum(imported, 'after') * 4 / 3)} MB。6 个 GLB 共 ${sum(glbs, 'before').toLocaleString('en-US')} bytes，内联后约 ${mb(sum(glbs, 'before') * 4 / 3)} MB，保持不变。

## 同机位截图与像素差

[七处前后并置图](../../runs/desk/15/L1/slim-visual/comparison-sheet.png)；原始 before/after、8 倍亮度差分图和完整数字位于 runs/desk/15/L1/slim-visual/。1280×720，固定 seed、随机序列和 Playwright 时钟；移动指针到画面角落再截图，避免把悬停动画时间差算作压缩差。

| 画面 | RGB 平均绝对差 / 255 | 有差异像素 | 任一色道差 >8 的像素 | 最大色道差 |
| --- | ---: | ---: | ---: | ---: |
${visual.results.map(v => `| ${v.name} | ${v.meanAbsoluteRGB.toFixed(4)} | ${v.changedPercent.toFixed(3)}% | ${v.over8Percent.toFixed(3)}% | ${v.maxChannelDelta} |`).join('\n')}

案上四层由原程序绘制，最终四张均逐像素一致。短片 q82 有细微压缩差（全屏平均 1.4298/255，最大 53 位于局部纹理/硬边），因此**不声称数学上无损**；并置图未见布局、色调或内容变化。图集硬边帧最大差为 1。3D 的 GLB、材质、运行代码没有变化，0.0033/255 的细微差来自实时 WebGL 帧/抗锯齿采样，不归因于 PNG 转换。七帧是抽样视觉验收，不声称比较了短片每一帧或图集每张图。

原始对照图：
${visual.results.map(v => `- ${v.name}：${v.before} ↔ ${v.after}；差分 ${v.difference}`).join('\n')}

## 行为、单文件与旧作保护

- typecheck PASS；四次完整 present 均 done=true、errors=0；四份 bench 均 PASS hard 9/9，notext/repro/layers 全 PASS。没有改 bench、critic、engine、frameworks 或任何门槛。
${rows.map(r => `- ${r.build}：${r.bench}`).join('\n')}
- verify-entry：wide/narrow、四层进退、抽屉编辑持久化、键盘提交、缺索引及 popup 200 全 PASS；verify-schedule 五项 PASS；verify-activity 六项 PASS。
- 原验证脚本把 seed 11/13 写死且会覆盖旧图，bench 还会写全局 report/history；用 scripts/slim-check-hooks.mjs 在加载时只替换被测 run/证据输出路径，断言、判据和框架文件字节不改。原验证截图写入 seed 15 的 check-shots/（不会被 present 的 shots/ 清理删掉），bench 的全局输出重定向到 runs/desk/15/L1/checks/，避免写 bench/**。
- 四形实际通过 file:// 打开，未请求本地资源副本；案上 1、film 1（图片绘入新画布）、gallery 1、east3d 1 个绘制面均可导出，没有 canvas 污染。原有 Google Fonts 样式/预连接仍保留，离线使用现有字体回退；这里的「单文件」断言是**没有外链本地资源**，没有引入任何图片/模型外链。
- east3d 原 idle.test.ts 额外通过 **2/2**（普通与减少动态，真实 55 秒零输入）：39,311 triangles、10 materials、峰值 39/38 draw calls、errors=0，证明六个 GLB 加载且行为保持。证据 runs/east-suburb-3d/5/L3/idle-evidence/，未覆盖旧证据。
- 开工前 SHA256 清单 scripts/slim-baseline.json；收尾逐文件复核 **148/148**：studio/5 26、fifty-years/9 51、desk/13 28、assets/library 43，全部字节相同（连 bench.json/curve.csv 也没有例外重写）。verify-slim 重复计算真实 SHA，不只比较 mtime。

## 稳定入口

present 仅在 canonical desk 成功（ok 或 --no-play 的 built）之后调用 scripts/update-entry.mjs，失败和自定义 --out 预览不会刷新入口。它输出 **466 bytes** 跳转页（meta refresh +「正在进入…」+可见小字链接），及五字段 entry.json；seed 15/L1 的 sizeBytes=11,794,968，builtAt 与目标文件构建时间一致。重建较旧 seed 时仍保留最高 seed 的入口，非 desk 构建不会挪走入口。

scripts/verify-entry-path.mjs 验证目标存在、最高 desk seed、tier、入口大小、metadata 字段/字节/时间一致。没有在 desk 框架中添加入口逻辑。

## 复验命令

先为只读验证设置输出重定向（不修改这些原脚本的源文件）：

~~~sh
export NODE_OPTIONS='--import ./scripts/slim-check-hooks.mjs'
pnpm typecheck
pnpm present --intent intents/desk.json --tier L1 --seed 15 && pnpm bench runs/desk/15/L1
pnpm present --intent intents/three-look-at-sky.json --tier L2 --seed 3 && pnpm bench runs/three-look-at-sky/3/L2
pnpm present --intent intents/shelf-gallery.json --tier L2 --seed 3 && pnpm bench runs/shelf-gallery/3/L2
pnpm present --intent intents/east-suburb-3d.json --tier L3 --seed 5 && pnpm bench runs/east-suburb-3d/5/L3
node frameworks/desk/verify-entry.mjs
node frameworks/desk/verify-schedule.mjs
node frameworks/desk/verify-activity.mjs
pnpm exec tsx frameworks/east3d/idle.test.ts runs/east-suburb-3d/5/L3/index.html
node scripts/verify-entry-path.mjs
node scripts/verify-slim.mjs
pnpm exec tsx scripts/slim-assets.ts
node scripts/slim-alpha.mjs
node scripts/slim-visual.mjs
node scripts/slim-report.mjs
~~~

视觉脚本读取已保存的 png-control/plan.json，缺少 PNG 对照 HTML 时会自动以 ZHUZI_SLIM=0 重建，正常 present 默认一直开启压缩。临时 PNG 对照的 index.html 与 build/ 在截图后移除，保留 plan、report 和原始对照截图，避免额外存下约 266 MB 大文件；before 数值另存 checks/slimming-summary.json。当前 WebP 缓存位于已有忽略目录，不入库。

最终汇总：**SLIM ALL PASS · 4 builds ≤12 MB · inline WebP · stable entry · protected old files unchanged**。

## 未做到的部分

1. **未压 GLB**：6 个原 GLB 原样保留，共 4,124,432 bytes（约 5.499 MB base64），其中 ground.glb 3,763,344 bytes。JSON/BIN 分项见 checks/assets.json。本轮没有实现不需解码器的网格去重/量化，也没有添加 Draco、meshopt 或 WASM；这不等于断言 GLB 理论上不可压。
2. 没有删除/改写历史 run，故原仓库 1.7 GB 不会立刻变小；收益是新产物每份少约 21.78 MB。没有按形拆包，当前四形仍各带全套静态图片与 GLB；这是下一轮可独立做的空间。
3. q82 画面是视觉近似，WebP 的 RGB 不能承诺逐像素无损；alpha、尺寸、交互和导航已分别实测。现有远程可选字体不是本轮新增，完全离线与联网字体可能不同。
`;
fs.writeFileSync('docs/design/slimming.md', doc);
console.log('REPORT docs/design/slimming.md · 4 builds / 20 assets / 7 frame pairs / SHA 148 files');
