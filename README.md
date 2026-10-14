# 竹子（zhuzi）· 个人呈现 Agent

**一台只为一个人存在的机器。** 你推门进去，它认出一个具体的处境，把一个人物放进你心里；走的时候，你带走一条没收口的线。

本轮是**首轮试玩版 demo**：《推门 · 旱》—— 你走进一间漆器作坊式的咖啡厅，拿起一张写着「旱」的票根，票根散成一座临淄城，你在东郊显影出一个跪在田缝前的农夫**禾**。然后你「住进禾的心」，替他设想他的田伯会怎么答。

这不是聊天机器人，是一条**导演管线**：意图 → 方案 → 校验 → 构建 → 模拟玩家试映。

---

## 怎么跑

```sh
pnpm install
npx playwright install chromium     # 第一次；bench 与 present 要用

pnpm dev                            # 开发：按 ZHUZI_INTENT / ZHUZI_SEED / ZHUZI_TIER 现场出方案
pnpm typecheck
```

出一件作品（意图 → 方案 → 校验 → 构建 → 模拟玩家试映，产出截图与 trace）：

```sh
pnpm present --intent intents/first-visit.json --tier L1 --seed 1
# 产物：runs/first-visit/1/L1/{plan.json, index.html, shots/, trace.jsonl, ledger.json, report.json}
```

评测（硬指标由脚本判，不由模型判）：

```sh
pnpm bench runs/first-visit/1/L1        # 也可以给 URL 或 .html 文件
pnpm bench runs/first-visit/2/L1 --vs runs/first-visit/1/L1
pnpm bench:selftest                     # 先证明 bench 本身可信：好页面必须 PASS，坏页面必须 FAIL
```

---

## 目录

```
frameworks/        每个框架 = 呈现方案的一种「形」（walk2d、vignette、gallery、animatic、film…）
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

---

## 本仓库的铁律

写在 [`CLAUDE.md`](./CLAUDE.md)，核心几条：

1. 作品只能由导演管线产出，不手写、不手改产物。
2. 对产物不满意时，只能改六处之一（frameworks / components / assets/library / eras 的 style-bible / director/seed-memory / critic），并在 commit 里写明改的是哪一处。
3. 每次改动后用**新的 seed 从零重跑**，证明改进可复现；复现失败就回退。
4. 硬指标由 bench 脚本判，不由模型判；审美分只来自 critic（与生成不同的模型，看截图、与参考集配对比较）。
5. `critic/golden/` 只用于评测，不得读入用于生成或调参。
6. 每次目标达成后，把 `bench/thresholds.json` 的门槛**只升不降**。

体验规格是唯一依据：[`docs/design/demo-spec.md`](./docs/design/demo-spec.md)。共享契约：[`engine/types.ts`](./engine/types.ts)（改它就是改接口）。

---

## 许可

MIT，见 [`LICENSE`](./LICENSE)。
