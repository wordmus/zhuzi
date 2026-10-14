# 本仓库的铁律

1. 作品只能由导演管线产出：
   pnpm present --intent <file> --tier <L0-L4> --seed <n>
   不要手写或手改某一件作品的产物。

2. 对产物不满意时，只能改下面六处之一，并在 commit 信息里写明改的是哪一处：
   frameworks/              玩法与形式框架（walk2d、vignette、gallery、animatic、film…）
   components/              界面与装置组件
   assets/library/          可复用资产（每件带来源、许可、生成配方）
   eras/<era>/style-bible.md  时代的色板、材质、光照、构图、声音规则
   director/seed-memory/    导演的种子规则与参考案例
   critic/                  评审规则与参考集

3. 每次改动后，用新的 seed 从零重跑一次管线，证明改进能复现；复现失败就回退。

4. 硬指标（字数、首个可操作时间、反馈延迟、帧率、报错）由 bench 脚本判，不由你判。

5. 审美分只来自 critic（与生成不同的模型，看截图，与参考集做配对比较）。你不给自己的产物打分。

6. golden/holdout/ 只用于评测，不得读取用于生成或调参。

7. 每次 /goal 达成后，把 bench/thresholds.json 里对应门槛上调一档（棘轮），只升不降。

---

# 怎么跑

体验规格是唯一依据：`docs/design/demo-spec.md`。共享契约：`engine/types.ts`（改它就是改接口）。

```sh
pnpm install
npx playwright install chromium     # 第一次；bench 与 present 要用

pnpm dev                            # 开发：按 ZHUZI_INTENT / ZHUZI_SEED / ZHUZI_TIER 现场出方案
pnpm typecheck

# 出一件作品：意图 → 方案 → 校验 → 构建 → 模拟玩家试映（截图、trace）
pnpm present --intent intents/first-visit.json --tier L1 --seed 1
#   产物：runs/first-visit/1/L1/{plan.json, index.html, shots/, trace.jsonl, ledger.json, report.json}
#   --no-shots 不截图；--no-play 只构建；校验有 error 会以非零退出

# 评测：硬指标由脚本判，stdout 一行汇总
pnpm bench runs/first-visit/1/L1            # 也可以给 URL 或 .html 文件
#   PASS hard 8/8 · first-action 0.6s · first3s 1 · feedback p90 112ms · max-chars 18 · errors 0 · fps-p5 58 · notext PASS · repro PASS
#   写出 bench/report.json、<run>/curve.csv（体验谱）、<run>/bench.json
pnpm bench runs/first-visit/2/L1 --vs runs/first-visit/1/L1   # 另查「不同 seed 的田伯不同」
#   --seed n 是模拟玩家的点法 seed（无焦点可循时在候选里怎么挑），不是作品的 seed；作品的 seed 在 present 时定

# 先验证 bench 本身：好页面必须 PASS，坏页面必须 FAIL
pnpm bench:selftest
```

## 写代码时要守的

- 所有对玩家可见的字都是中文、尽量少：每屏 ≤ 1 句、≤ 30 字，最好 ≤ 18 字。代码注释用中文，写得稀。
- 每件可交互之物都要经 `engine/affordance.ts` 注册，在 DOM 里有一个 `[data-aff]` 按钮：bench 的模拟玩家只认它，不认文字。
- 要让模拟玩家（和读屏）知道「现在该点哪个」：进场时的焦点 id 与可做之事的 id 对得上（`act.enter` 里的 `focus`），或给那个按钮加 `data-pulse` / `aria-current`。
- 整局走完要置 `window.__zhuzi.done = true`；trace 用 `window.__trace`，事实账本进 `world.fact`。bench 的删字测试和复现检查读的就是这些。
- 每次进入一幕的前 3 秒，同时可做的事 ≤ 1 个。

## 目录

```
frameworks/        每个框架 = 呈现方案的一种「形」
components/        界面与装置组件
engine/            共享契约与引擎器官（types、stage、affordance、audio、world…）
app/               运行时：把呈现方案一幕一幕演出来
director/          pipeline/（present、validate、director）· seed-memory/（规则与案例）
eras/zhanguo/      style-bible.md、palette.json
critic/            rubric.md、golden/（由人提供）
bench/             run.ts、player.ts、thresholds.json、fixtures/、report.json、history.csv
intents/           固定的一组测试意图
runs/              每次管线运行的产物，按 意图/seed/档位 存
```
