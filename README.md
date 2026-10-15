# 竹子（zhuzi）· 个人呈现 Agent

**一台只为一个人存在的机器。** 你推门进去，它认出一个具体的处境，把一个人物放进你心里；走的时候，你带走一条没收口的线。

本轮是**首轮试玩版 demo**：《推门 · 旱》—— 你走进一间漆器作坊式的咖啡厅，拿起一张写着「旱」的票根，票根散成一座临淄城，你在东郊遇见农夫**禾**。导师先交付「帮他借粟过冬」的目标，你替禾在心里选一种开口方式、预演田伯的回答，再真实叩门，对照预演与实情。

这不是聊天机器人，是一条**导演管线**：意图 → 方案 → 校验 → 构建 → 模拟玩家试映。

当前 L1 试玩已经接通：推门、票根显影、铜镜预演、三次叩门、四季选择、不可逆承诺、返屋盖印与次访记忆。禾被拒的建议会留成种子，随后照自己的意思行动；井水、邻家封门、活苗和田伯的戒备会改变之后的选择。砝码点击加重，向上拖动或上键减重。反引号或左下角长按打开演示面板。

最新管线产物是 [`runs/first-visit/51/L1/index.html`](./runs/first-visit/51/L1/index.html)，本地预览 `http://127.0.0.1:5211/index.html`。首轮明确交付「帮禾借粟过冬」：选叙旧情／押田地／请乡邻 → 看禾的预想 → 去叩三次门 → 对照田伯的实情；真实登门后才展开砝码与写念头。禾拒绝建议并改借法时，门前会明确说明改用了什么，结果对应这次真实借法。手机结果页横向滚动已修复。桌面与手机各走过直接叙旧情和押田地被拒后改叙旧情，均无裁切、文字重叠或页面报错；前两下门环不改世界，第三下才执行。导演从禾已经愿意求粮的那天取景，此前自主日程按真实规则计算并留账。硬指标 **8/8**、实际删字通关、同 seed 同操作的真实账本一致。完整数据与复验步骤见 [`docs/verification-demo.md`](./docs/verification-demo.md) 和 [`bench.json`](./runs/first-visit/51/L1/bench.json)。本地版全程可用规则；实时模型需要 Artifact 观看环境提供 `sample`，季与田伯的独立视角尚未开放。可理解性和心流仍需真人试玩，未用模拟玩家的分数替代。

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
