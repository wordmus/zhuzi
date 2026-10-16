# Wave 2 · S6 工作室一幕：三层信息流做成玩得出来的一幕

前置：S5 已完成五十年长卷整合（`intents/fifty-years.json` 与新的 act 编排就绪）。你是这一轮唯一的写者。

目标：玩家在咖啡厅里**亲眼看见**「导师 → 导演 → 演员」三层怎么协作、怎么回传——不是面板里的日志，而是一幕戏：委托书、方案条、演员板、报告竹简、回执印，全部用**这一次真实的信**（`ctx.layers`）驱动。

## 一、这一幕怎么演（建议，可调）

地点：咖啡厅一角的工作台（地标：你的座位、导师的位置、门都不动）。

1. **焦点一：导师写委托**。帛书上是这一次真实的委托：`why`（为什么这次给你这个）作为唯一一句可见的话（≤18 字）。你做一个动作：**拿起委托**（或推过去）。
2. **焦点二：叔衡（导演）接委托**。他读完，**盖回执**（信上的 `receipt` 真的盖上），然后把呈现方案一条条钉上案：每条对应 `DirectorAck.acts` 里真实的一幕（用图形/短名，不上长文字）。一句导演的话（≤18 字，如「他猜你会先看东郊。」）——来自 `rehearsal` 或 `predict`。
3. **焦点三：提示信飞向演员板**。板上是这一幕的演员（禾/季/田伯的小像或名牌 + 一盏小灯）；真实的 `ActorCue` 送达时那盏灯亮。你只需看。
4. **焦点四：报告竹简回来**。真实的 `ActorReport.actual` 以一句 ≤18 字出现在竹简上（如「禾没照做，他挑了另一条。」），旁边浮出误差的淡痕（有 `error` 时）。你接住它（一个动作）。
5. 收：导演把这一场压成一叠盖印的简，放回架上；回执计数在角落极简显示（如三枚小印，不写数字）。

原则：一屏一个焦点；前 3 秒只给一个动作；每屏 ≤1 句、≤30 字（最好 ≤18）；动作 100ms 内有反馈；全部交互经 `ctx.aff.add()` 注册。

## 二、数据从哪来（不许摆样品）

- 委托：`Commission`（`why`、`budget.lamp`、`userModel.visits` 等）。
- 方案：`DirectorAck`（`acts[]`、`accept`、`changes[]`、`rehearsal[]`）。
- 提示/报告：`ActorCue` / `ActorReport`（按 act 匹配，`ctx.layers.byAct(act)`）。
- 回执：`ctx.layers.receive(id, by)`——你盖印的那一刻就是真实回执时刻。
- 若这一幕跑在没有真实信件的数据源上（例如 dev 自测页），用 `ctx.layers.send()` 造一轮**自洽的真信**并走完整流程；检查器 `ctx.layers.check()` 必须为空。

## 三、你拥有的文件

- `frameworks/studio/**`（新）
- `director/pipeline/director.ts`（把工作室一幕排进流程：独立 intent、以及 S5 的五十秋长卷）
- `app/main.ts`（只加注册表行：`studio`）
- `intents/studio.json`（新）与 `intents/fifty-years.json`（插入一幕的位置）
- `frameworks/vignette/**`（仅在需要接缝时做最小加法）
- `docs/design/layers.md`（补「怎么在游戏里看见它」一节）

禁止：改 `bench/**` 判定与门槛、改 `critic/**`、手改 `runs/**`、git 操作、碰四个小游戏与 `engine/layers/**` 的行为（只读它们）。

## 四、验收

```sh
pnpm typecheck
pnpm present --intent intents/studio.json --tier L1 --seed 2
pnpm bench runs/studio/2/L1                 # PASS hard 9/9（含 layers）
pnpm bench runs/fifty-years/3/L1            # 插入后仍 PASS（S5 的产物）
pnpm bench runs/first-visit/7/L1            # 既有作品不回归（若你动了 first-visit）
```

断言：
- `runs/studio/2/L1/layers.json`：工作室这一幕里有真实 cue/report 成对出现；`check=[]`；委托、方案、回顾齐全。
- 截图 `runs/studio/2/L1/shots/` 里能看出四个焦点（委托、方案、演员板、报告）；每张截图可见字 ≤30。
- `frameworks/studio/README.md`：元素/动作表、这一幕在哪些 intent 的哪个位置、看的顺序。
- `docs/design/layers.md` 补一节：在哪看（游戏内哪一幕、面板哪一段、runs 里哪个文件）。

## 五、报告

`worker_done`：三句摘要 + 上述每条验收的命令与结果 + 产物清单 + 未做到的部分。用费曼口径。
