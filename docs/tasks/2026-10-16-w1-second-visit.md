# W1 · 第二次来访：看得见它因为你而变 + 年谱（P1+P3）

依据：`docs/策划文档v0.2 存档.md` §7、§12、§19；`docs/产品策划 v0.3.md` §2.3（留下旧的痕迹/变化指向你/回来时揭示/成长有仪式）。

目标：第二次及以后的来访里，咖啡厅有 **1–2 处看得见、可追溯的变化**，每处都指向你上次做过的事；墙上多一张「第一天」与改版记录（年谱）。变化不突变、不多、不解释过头。

## 一、要做的

1. **数据**：扩展 `VisitRecord`（`app/context.ts`）或新增 `visit.changes`（`engine/store.ts`）：`{ id, what, why, since, visit }[]`，只增不减；计算函数是纯的（给定两次来访记录 → 变化清单），便于无头断言。
2. **变化的候选**（至少做 2 种，按上次真实记录选）：
   - **灯挪到你手边**：若上次你在某元素停留最久（`dwell`/`longestPlace`），这次那盏灯移到你座位旁；导师的视线在它上停一下（基础导演让你看见变化）。
   - **改稿留痕**：某个界面元素旁留一道前一版的淡痕，点它能看到「改前 / 改后 / 为什么」。
   - **墙上的年谱**：一张「第一天的样子」草图 + 一条最近的改版说明（理由来自 `director/seed-memory/rules.json` 的改动或 `bench/history.csv` 的门槛棘轮）。
3. **归因的一句**：导师把变化归到你身上（≤18 字，如「灯挪到你手边了，因为你老停在那儿。」）；不主动解释，追问才展开。
4. **节制**：每次来访最多 1–2 处变化；同一处不连续两回变。

## 二、验收（都要打印）

- 无头断言 `npx tsx app/visit-changes.test.ts`（新）：给定首次来访记录 → 变化清单为空；给定「在 mentor 停 40s、跳过 ticket」→ 至少一条变化，且 `why` 引用真实字段；同输入两次结果一致。
- 浏览器：`pnpm present --intent intents/first-visit.json --tier L1 --seed 11`，用 playwright 或 selftest 预置一份 `visit.last` 后重载，第二次的 café 与第一次不同（截图各一张），bench 仍 **9/9**。
- `pnpm bench runs/first-visit/7/L1` 不回归（若动了 vignette）。

## 三、边界

- 不改现有 runs 产物、bench 判定与门槛、critic；不引模型调用。
- 年谱只读现有记录与规则文件，不新建复杂系统。
- 你拥有的文件：`frameworks/vignette/**`、`components/presenter.ts`（若要）、`app/context.ts`、`engine/store.ts`、新 `app/visit-changes.test.ts`、新 `docs/design/second-visit.md`。与 W2 串行（同桌咖啡厅），不要同时改 `frameworks/vignette`。
