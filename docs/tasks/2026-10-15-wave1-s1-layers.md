# S1 · 三层信息流：导师 → 导演 → 演员，以及回程

你是 `docs/tasks/2026-10-15-wave1-00-overview.md` 里的 s1。目标：把「导师（机器的心智）、导演（造世界与呈现）、演员（世界里的人）」做成机器里**真实运行、可审计、双向畅通**的三层，把每一次协作都留成一封信（有回执），并让 bench 判它。

现在的问题：`director/pipeline/director.ts` 是一个纯函数，`app/main.ts` 按方案演完拉倒；导师只是舞台上的一件道具，演员只存在于 `engine/world` 里——三层之间没有任何可检查的消息，谁也看不出信息是怎么流过去的。

## 一、冻结的信件类型（照抄这些名字；字段可加不可减）

新建 `engine/layers/types.ts`：

```ts
export type LayerId = 'mentor' | 'director' | 'actor';
export type LetterKind = 'commission' | 'plan' | 'cue' | 'report' | 'retro';

/** 一封信。id 形如 'cue:han:1'；回执只是「收信人读过了」，不改信的内容。 */
export interface Letter<T = unknown> {
  id: string;
  kind: LetterKind;
  from: LayerId | string;      // 演员的信 from 写角色名
  to: LayerId | string;
  act?: string;                // 属于哪一幕（commission/plan/retro 无）
  t: number;                   // performance.now() 口径
  day?: number;                // 世界逻辑时刻（有则记）
  payload: T;
  receipt?: { at: number; by: string };
}

/** 导师：这一次为什么给你这一件（内容必须真的从用户模型算出来，不许写死）。 */
export interface Commission {
  intentId: string;
  title: string;
  hypothesis: { id: string; text: string; mode: 'satisfy' | 'probe' };
  target: string;
  stop: string;
  budget: { tier: Tier; lamp: number; note: string };   // 灯油：这一件给多少算力/注意力
  userModel: {
    visits: number;
    name?: string;
    sinceLastMs: number;
    lastEnding?: string;
    dwellTop?: string;        // 上次停留最久的元素
    dayPart: string;          // 深夜/清晨/白天/夜里
    device: string;           // 宽屏/手机/…
  };
  /** 为什么这一次给你这个（≤ 30 字，玩家可见） */
  why: string;
}

/** 导演：承接委托，并说明哪些照做、哪些改了、为什么。 */
export interface DirectorAck {
  planId: string;
  version: number;
  director: { id: string; name: string };
  acts: { id: string; framework: string; author: string; focus: string }[];
  /** 承接的一句话（≤ 30 字） */
  accept: string;
  /** 相对委托的改动与理由（可空） */
  changes: string[];
  rehearsal: { act: string; expect: string; risk: string }[];
}

/** 导演给一位演员的提示。 */
export interface ActorCue {
  act: string;
  who: string;                // 禾 / 田伯 / 季 / 桑 / 导师…
  /** 导演预期他这一幕会做什么 */
  expects: string;
  /** 他能自己决定的范围 */
  freedom: string;
  /** 交给演员的初始状态（复现用） */
  initialState: Record<string, unknown>;
  constraints: string[];
}

/** 演员回给导演的报告。 */
export interface ActorReport {
  act: string;
  who: string;
  did: string[];              // 他在这一幕真正做了什么（2–4 条）
  predicted: string;          // 导演的预期
  actual: string;             // 实际
  error?: { layer: Layer; unit?: string; e?: number; eps?: number; note?: string };
  facts: { id: string; text: string; kind: string }[];
  seeds?: { id: string; concept: string; blockedBy?: string }[];
  ms: number;
}

/** 导演回给导师：这一次交付后学到了什么、留下什么线。 */
export interface MentorRetro {
  intentId: string;
  predicted: string;
  actual: string;
  userModelDelta: Record<string, unknown>;  // 写回本机存储的那部分
  promises: string[];                        // 没收口的线（下一次的由头）
  next: string;                              // 对下一次的打算
}
```

## 二、模块

1. `engine/layers/bus.ts`：`createLayerBus(bus: Bus, clock?: () => { t: number; day?: number })`
   - `send({ kind, from, to, act?, payload }): Letter`——补 id、时间、入列，并 `bus.log('layer.letter', …)`；
   - `receive(id, by)`——盖上回执（`receipt { at, by }`）；
   - `letters()`、`byAct(act)`、`pending()`（已发未回执）；
   - `check(): string[]`——违反项清单。至少查：
     (a) 五种信都出现；
     (b) 每封 `cue` 都有同 `act` 的 `report`，且回执齐全；
     (c) `commission` 在任一 `plan` 之前；
     (d) `plan.acts` 覆盖方案里全部幕；
     (e) `retro` 在所有 `report` 之后；
     (f) 信件引用的 act id 都真实存在。
   - 回执语义：**收信人处理完才算收到**（导演收到委托后回 plan 时盖委托的回执；导演收到 report 时盖 report 的回执；导师收到 retro 时盖回执）。别在 send 里自动盖章。
2. `engine/layers/mentor.ts`：`createMentor(input)`，纯函数 + 一部分读 store：
   - `commission(intent, plan): Commission`——`why` 与 `budget` 由 `input`（访问记录、感官、tier）真实算出：来过几次、上次结局、上次停得最久的地方、距上次多久、此刻时段与设备。至少 3 种说法按 seed 或访问次数变化，但要都可追溯；
   - `retro(plan, reports, session): MentorRetro`——汇总演员报告与实际账本，得出 `userModelDelta`（交给调用方写进 store）、`promises`（例：某一幕没被碰过的东西）。
3. `director/pipeline/director.ts`：`Plan` 增加两个字段（`engine/types.ts` 里只增）：
   - `commission?: Commission`
   - `cues?: Record<string, ActorCue>`
   - 导演的 `accept`/`changes` 放进 `Plan`（如 `ack?: DirectorAck`）。全部由 `direct()` 纯函数算出，同一 seed 同文件同结果。
4. `app/main.ts` + `app/context.ts`：
   - `Ctx` 增加 `layers: LayerBus`；
   - boot 后：导师发 `commission` → 导演收到 → 导演回 `plan`（盖委托回执）；
   - 每幕：`cue`（导演→该幕里出现的演员，按 `planAct.elements` 与角色名推导；至少给主角一封）→ 框架跑 → 幕出后收集 `res.data.facts` 与这一幕里的 `world.fact`/`mind.*` trace → 每位演员发 `report`（导演盖回执）；
   - 全部幕结束后：导演发 `retro` → 导师收到（盖回执），然后导师把 `userModelDelta` 写进 `ctx.store`；
   - `window.__zhuzi.layers = { letters, check }`。
5. `components/presenter.ts`：演示面板（反引号）新增一段「三层信息流」：
   - 按时间列出信件：`导师 → 导演 · 委托 · 为什么这次给你这个：…`、`导演 → 禾 · 提示 · 预期：…`、`禾 → 导演 · 报告 · 实际：…`，已收到回执的打勾；
   - 一行计数：五类各几封、未回执几封、检查结果。
6. `bench/run.ts`：新增硬检查 `layers`：从 `window.__zhuzi.layers` 读信件与 `check()`（同时允许从 trace 的 `layer.letter` 兜底）。检查项见 `bus.check()`；`bench/thresholds.json` 加 `"layers": true`。不要动已有检查的判定。
7. `director/pipeline/present.ts`：试映结束后把信件与检查结果写成 `runs/<intent>/<seed>/<tier>/layers.json`（形状：`{ letters: Letter[], check: string[], counts: Record<LetterKind, number> }`）。
8. `docs/design/layers.md`：三层结构图、五种信各一封真实样例（从一次运行里摘）、查看方式（面板、layers.json、trace kind）、验证命令、没做到的部分。

## 三、验收（必须打印出来）

```sh
pnpm typecheck
pnpm present --intent intents/first-visit.json --tier L1 --seed 7
pnpm bench runs/first-visit/7/L1            # 必须 PASS，hard 9/9（含 layers）
pnpm present --intent intents/han-act1.json --tier L1 --seed 3   # 不回归
pnpm bench:selftest
```

- `runs/first-visit/7/L1/layers.json` 里五种信齐全、check 为空数组。
- 面板里能看到至少 6 封信（委托、方案、逐幕提示与报告、回顾）。
- `commission.why` 必须引用真实访问史（第一次来时也要有合理说法）。
- 旧检查一个都不许放宽（`first-action ≤ 0.9s`、字数、删字、复现等）。

## 四、不要做

- 不改 `frameworks/**`、`intents/**`、`engine/world/**`、`engine/mind/**`、`director/seed-memory/**`。
- 不把 letters 做成模型调用；这一波全部由规则/数据算出。
- 不在玩家正常路径上显示 eng 语言（面板可以）。
