# Wave 2 · S5 整合：五十年长卷与四个小游戏接进导演管线

前置：wave 1 已交付（s1 三层信件、s2 历史长卷、s3/s4 四个小游戏）。你现在是**唯一的写者**，报告刷新：`engine/layers/**`、`engine/history/**`、四个游戏的 `frameworks/<id>/**` 都已完成并各自通过测试与 bench；它们**只差接线**。

目标：让玩家在一次真实游玩里走完「前 356 → 前 306」的五十年长卷——真实历史事件按年进入世界与个体；个体（禾 / 季 / 田伯）在自己的一章里活动，玩到四个小游戏；他们的决定写回宏观并留在只增的事实账本里；第二次来访接得上。

## 一、你拥有的文件（其他文件先别动；需要时在报告里申请）

- `intents/fifty-years.json`（新，id 建议 `fifty-years`）
- `director/pipeline/**`（act 编排、`director.ts`、必要时 `present.ts`）
- `app/main.ts`（框架注册表；只加行，不改既有）
- `frameworks/walk2d/**`（只在需要时做加法：章的接缝、角色年龄的呈现）
- `frameworks/chronicle/**`（可选新建：年表卡一幕）
- `engine/history/**`、`engine/layers/**`：只允许**向后兼容的加法**（先跑通两者的测试）
- `docs/design/fifty-years-integration.md`（新：把下面验收里每一条怎么做到的写清）

禁止：改 `bench/**` 的判定与门槛、改 `critic/**`、手改 `runs/**` 产物、git 操作。

## 二、已有的接口（照用，不改）

### 三层信件（`engine/layers/`）
```ts
const layers = ctx.layers;                 // 已在 Ctx 里
layers.usePlan(plan);                      // app 已调用，expectedActs 来自真实方案
layers.send({ kind, from, to, act?, payload });   // 返回信（带 id）
layers.receive(id, by);                    // 盖回执；收信人处理完才盖
layers.check();                           // 违规清单（必须为空）
```
信的形状与五种 kind 的载荷见 `engine/layers/types.ts`。演员提示/报告的 act 必须与真实幕 id 一致；报告 `actual` 用真实结果。

### 历史长卷（`engine/history/`）
```ts
const h = createHistory({ events: loadHistory().events, startYear: -356, macro: loadHistory().macro, ledger });
h.advanceTo(-334);          // 返回途中事件；宏观更新；每个事件记一条 Fact（id `history.event.<id>`）
h.enter(event);             // { who, line, year }：事件怎样进入个体
h.writeBack({ by: '季', decision: '上书论天命', delta: { rites: 0.03, minxin: 0.02 }, year: -334 });
h.state();                  // { year, fired, macro }：整份存档用这个
h.ledger();                 // 只增事实
```
事实的 `day = 年份 − epoch`（与《旱》日历分开，别混）。跨章持久化建议：`ctx.store.set('history.state', h.state())` + fired 从账本重建（`createHistory({ ledger })` 已支持）。

### 四个小游戏（各自 README 有完整元素/动作/出口表）
- `jixia-speakers`（季）：焦点 `ji-scroll`；六张学派牌 `school-0..5`；出事实。
- `wude-wheel`（季）：焦点 `ji-scroll`；指针 `wude-pointer` + 五格 `virtue-0..4`；出事实。
- `qi-knife`（田伯）：焦点 `qi-scale`；四样 `qi-people|qi-king|qi-home|qi-name`；三出口 `qi-give|qi-lend|qi-close`。
- `bells`（导师/机器）：焦点 `bells-start`；五钟 `bell-0..4`；两章之间的休息。

每个 `run(act, ctx)` 返回 `{ act, data: { facts, metrics, line? } }`；**事实要进世界账本**（用 `ctx.bus.log('world.fact', { fact })` 记 trace，便于 bench 比对），并把这一章里演员做了什么写进 `ActorReport.did/actual`。

## 三、编排（你来做导演的活）

1. **年表卡（可选但推荐）**：每一章开场一张卡——年份、事件一句话（`history.enter()` 的 line，≤18 字）、一个动作（继续）。这就是「事件进入个体」的可见形态；可以新建 `frameworks/chronicle` 或复用 vignette。
2. **章的顺序（建议）**：
   - 前 356 · 平陆会盟 → **禾章**（复用现有 `walk2d` 的《旱》；它本来就发生在东郊）→ `advanceTo(-334)`
   - 前 334 · 徐州相王 → 年表卡（礼制变了，进入季）→ **季章**：`jixia-speakers` → `wude-wheel`（两件都在季的视角；README 建议接这里）
   - 前 315 · 齐伐燕 → 年表卡（征粮，进入禾/田伯）→ **田伯章**：`qi-knife`
   - `bells` 作为两章之间的休息（放 `walk2d` 之后或田伯章之后）
   - 前 306 收束 → **回咖啡厅**（复用现有 return 幕：盖印、导师一句、留一条线）
   历史事件不必每件都成一章：`advanceTo` 跨年时会一次fire多件，年表卡只在转折点出现（≥3 件要有可见的进入）。
3. **角色老化**：禾章在 356；季章/田伯章在 334/315。若成本高，最小做法：年表卡说一句「十年过去了」，并在章里改一个可见细节（小石长高/禾的背更弯）——写进 `docs/design/fifty-years-integration.md`，不许用数字报年龄。
4. **账本与持久化**：五十年事件事实 + 三章决定事实合并进同一个只增账本；`history.state` 存进 store；第二次来访从存的年份继续（不重播已发生事件）。写一个 `engine/history` 或 `director/` 下的无头测试证明「重开不重播、旧事实不改」（s2 已有类似断言，可复用思路）。
5. **回归**：`intents/first-visit.json` 与 `intents/han-act1.json` 的既有流程不许变差；新框架只加注册表行。

## 四、验收（都要打印出来）

```sh
pnpm typecheck
pnpm present --intent intents/fifty-years.json --tier L1 --seed 3
pnpm bench runs/fifty-years/3/L1            # PASS hard 9/9（含 layers）
pnpm bench runs/first-visit/7/L1            # 既有作品不回归
pnpm present --intent intents/han-act1.json --tier L1 --seed 3 && pnpm bench runs/han-act1/3/L1
```

产物断言（写成 `pnpm tsx director/pipeline/fifty-years.test.ts` 或在报告里逐条列出）：
- `layers.json`：五类信齐全、`check=[]`、每幕有提示与报告；报告里 `did/actual` 是这一章真实发生的事。
- `ledger.json`：含 ≥3 条 `history.event.*`，覆盖 ≥3 个不同年份且首尾跨度 ≥ 40 年；含 ≥2 条 `history.decision.*`（季/田伯的写回）与四个游戏中至少两个的产出事实。
- `trace.jsonl`：`act.enter` 覆盖 ≥5 幕，其中至少两幕的 framework 是四个小游戏之一；`world.fact` 与账本一致。
- 持久化：把该次的 `history.state` 塞回 `createHistory` 重开，`advanceTo` 不再产生已发生事件（无头断言，exit 0）。

## 五、报告

`worker_done` 里写：三句摘要；上面每条验收的命令与结果；`runs/fifty-years/3/L1/` 的产物清单；给 S6（工作室一幕）与 S7（验证）留的接口说明；未做到的部分。用费曼口径。
