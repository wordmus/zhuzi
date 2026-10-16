# P4.5 · 呈现层自己的信（四层的最后一块诚实拼图）

`docs/design/structure.md` 的诚实清单第一条：**呈现层没有自己的「声音」**——取舍写在 `PlanAct` 与 `trace.jsonl` 里，但没有一封以「呈现」署名的信。导师有委托（为什么给你这件）、导演有方案（怎么安排）、演员有报告（他真做了什么），**呈现层（12 种形本身）没有说话**。

要做：让呈现层在每一幕结束时，**用自己的口气**留一封短信（不只是数据的搬运），回到导演、也给你看。

## 一、信是什么

- 新增一种信件 kind：`presence`（或 `form`），`from: 'presentation'`，`to: 'director'`，`act: <幕 id>`；进 `layers.json`，**必须带回执**（与既有五类同一套一致性检查）。
- 内容（字段固定、可断言）：
  - `shape`：这一幕**这个形**做了什么本形才做的事（例：vignette＝让一个东西成为唯一能做的事；film＝在第 3 秒把镜头交给第二个人；east3d＝让地形的裂缝自己说出旱）。
  - `withheld`：它**故意没给**的东西（承接 `PlanAct` 的「不给的东西」；**没有记录就不写**，不许编）。
  - `cost`：本形为此付出的代价（例：字更少、动更慢、一镜到底不许切）。
  - `sentence`：一句 ≤18 字、**以形自述**的人话（不是数据复述），例如「我只留了一件事能碰。」「我把镜头交给了第二个人。」——语气与台词库一致（少警句、不解释）。
- 不许改既有五类信、回执时机与 `checkLayerLetters` 的语义；`presence` 只新增。

## 二、画面里怎么看见（至少两处）

1. **入口（desk）的呈现层**：抽出一块帛条时，旁边**多一截短简**（就是这封信的 `sentence`），并在抽屉/年谱之外留一处可查全文（`aria-description` 或 folded 区，按入口既有的 30 字口径不算主屏）。
2. **工作室（studio）**：接住报告竹简之后，**呈现层**也放下一截短简（一个动作，不是文字按钮），点开＝见 `shape / withheld / cost / sentence`。

## 三、硬规则

- 一屏 ≤1 句 ≤30 字；一次一焦点；动作是物件；不许文字按钮、数字面板。
- 只从**已发生**的 `PlanAct` / `trace` / 形自身的规则里取材；缺证据就不写（断言其缺席）。
- 色板与画具沿用 `components/paint`；程序化篆意字，未收录字留空框。

## 四、边界（严格）

拥有：`engine/layers/types.ts`（只加 `presence` 到 `LetterKind` 与新 payload 类型）、`engine/layers/bus.ts`（只加这一种的收/回执路径）、`frameworks/desk/**`、`frameworks/studio/**`、`docs/design/{structure.md（只把该缺口改成 ✅）, presence-letter.md（新）}`、你新产的 runs seed。
**不要碰**（另一个工正在写）：`vite.config.ts`、`director/pipeline/present.ts`、`scripts/**`、`assets/library/**`、`runs/entry/**`、`bench/**`、`critic/**`、其它 frameworks、既有 runs 产物、git。

## 五、验收（都要打印）

```sh
pnpm typecheck
pnpm present --intent intents/desk.json --tier L1 --seed 17 && pnpm bench runs/desk/17/L1        # PASS 9/9
pnpm present --intent intents/studio.json --tier L1 --seed 9 && pnpm bench runs/studio/9/L1      # PASS 9/9
node frameworks/desk/verify-entry.mjs && node frameworks/desk/verify-activity.mjs                # 不退化
node frameworks/desk/verify-presence.mjs   # 新：① 每幕一封 presence 且都有回执（checkLayerLetters 为空）② sentence ≤18 字且不是数据复述（不许出现数字/字段名）③ with held 无记录时该字段缺席（用一份无记录 plan 断言）④ 画面里那截短简出现且 30 字口径不破 ⑤ console errors 0
npx tsx director/pipeline/works-index.ts
pnpm bench runs/fifty-years/9/L1     # 不回归
```
截图 ≥5 张：入口呈现层的短简、工作室里呈现层放下短简那一刻、展开的全文、无记录时不出现的对照、与旧版同机位对比。

收尾 worker_done：三句摘要 + 命令与汇总行 + 截图路径 + 「这封信从哪来」两条真实 trace 引用 + 未做到的部分。
