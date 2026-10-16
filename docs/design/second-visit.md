# 第二次来访：看见它因为你而变

以前，咖啡厅只凭“上次是否有结局”挪灯，不能解释它与你的行为有什么关系。现在进门时读取 `visit.last`，计算一次变化，归来时沿用同一版；墙上的“第一天”草图一直保留，点它可以追问改前、改后和为什么。

## 可复验的小例子

预置 `visit.last = { n: 1, at: 1792080000000, seed: 13, dwell: { mentor: 40000, ticket: 0 }, skipped: ["ticket"] }` 后重载并推门。座位和导师不动，灯从画面宽度的 `0.48` 移到 `0.29`；导师先瞥向它，再说“你停得久，灯就挪近了。”，共 12 字。墙上草图可查到 `visit.last.dwell["mentor"]=40000`，没有从结局或随机数猜测原因。

下一次若仍留下同样的停留与跳过记录，灯沿用原位，墙上保留未拿起票根的一版淡稿，理由引用 `visit.last.skipped`。不连续两次改同一处；一回只选一条变化，旧记录继续保留。

## 数据与边界

- `app/context.ts` 的 `VisitChange` 保留 `id / what / why / since / visit`，另有位置、前后对照和短归因；`VisitRecord.changes` 兼容旧存档。
- `frameworks/vignette/visit-changes.ts` 的 `computeVisitChanges(previous, current)` 是纯函数；累计变化写入 `visit.changes`，按 id 只追加，再放入当前来访记录。页面重载不会重复追加同一个 id。
- `mentor` 的真实鼠标停留在咖啡厅累计；票根实际出现后才记为 `skipped`，拿起即移除。旧记录没有 `skipped` 时，不把“没有点击数据”编成“跳过”。已有 `longestPlace / longestPlaceMs` 也能作为依据。
- 墙上“第一天”是固定构图的示意草图，并非历史截图；新改稿与第一天并排，详细解释只在追问时展开。解释引用当前 `director/seed-memory/rules.json` 的 `response / revision-trace`，不会假称规则刚被改写。
- 没有停留、跳过等证据时保持原样；灯已经处于合适位置且另一处刚改过时，也不会为凑数造一次变化。因此不承诺每次刷新都制造新改动，也不改写规则或 bench 门槛。触屏无法产生鼠标悬停，仍可依据票根跳过和既有地点停留。
- “忘掉我”继续清除本机来访与变化。W2 的两本册子入口、绘制和清理保留。

## 验收

协调端明确使用原仓库的新 seed 13，避免重建已存在的 seed 11；未在临时副本运行验收，未手改已有 runs。

```sh
pnpm typecheck
npx tsx app/visit-changes.test.ts
pnpm present --intent intents/first-visit.json --tier L1 --seed 13
pnpm bench runs/first-visit/13/L1
pnpm bench runs/first-visit/7/L1
```

- `pnpm typecheck`：通过。
- `npx tsx app/visit-changes.test.ts`：`PASS visit-changes 6/6`，覆盖首次为空、真实字段、确定性、输入不变、归因长度、相邻来访不重复位置和旧存档兼容。
- seed 13 present：`[ok] 84s · play done · 36 步 · 13 张截图 · trace 479 条 · 报错 0 · 账本 43 条 · 三层 15 封信，未回执 0`。
- seed 13 bench：`PASS hard 9/9 · first-action 0.09s · first3s 1 · feedback p90 341ms · max-chars 29 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS`；最后一次使用 `pnpm bench runs/first-visit/13/L1 --verbose` 单独运行。上一轮并发测量的帧率为 30，单独重跑恢复 60；未修改任何门槛。
- seed 7 baseline：`PASS hard 9/9 · first-action 0.03s · first3s 1 · feedback p90 389ms · max-chars 29 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS`。

两次来访与追问截图：

- [第一次：灯在中间](second-visit-before.png)
- [第二次：灯靠近座位，墙上有改稿](second-visit-after.png)
- [点墙上草图追问依据](second-visit-why.png)

浏览器验证脚本：`frameworks/vignette/second-visit-browser.py`；预置数据与实际页面读数：`second-visit-browser.json`。若 Python Playwright 的默认 Chromium 尚未安装，可将 `W1_CHROMIUM` 指向本机已安装的 Chromium 可执行文件。

浏览器复验（本机已有 Chromium 1248，Python Playwright 默认下载版本不同，因此显式复用）：

```sh
W1_CHROMIUM=/Users/lidechi/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell python3 -u frameworks/vignette/second-visit-browser.py runs/first-visit/13/L1
```

结果：`PASS browser second-visit: n=1 → n=2; lamp x=0.48w → 0.29w; mentor dwell=40000; why dialog verified; pageErrors=0`。脚本内置的静态服务器与 bench 一样声明 UTF-8，避免生成 HTML 的内联脚本位于 meta charset 前时被浏览器按错误编码解析。

验证中修过一处真实问题：归来场景的年谱入口曾在问称呼前出现，模拟玩家会提前翻开详情；现在只在主线可关门后开放，问称呼阶段继续只做眼前这一件事。
