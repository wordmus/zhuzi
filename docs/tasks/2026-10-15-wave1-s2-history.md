# S2 · 五十年历史长卷（前 356 – 前 306）

你是 `docs/tasks/2026-10-15-wave1-00-overview.md` 里的 s2。目标：给《旱》所在的战国临淄加一条横跨 50 年的历史进程——多个真实历史事件按年发生，宏观（民心、粮、国力、礼制）与个体（禾一家、季、田伯）**互相写入**：事件进入个体成为预测误差，个体的决定写回宏观。

现在的问题：`engine/world/sim.ts` 的四季只走一季到一年，历史停在背景里的一层雾，没有年表、没有宏观变量、没有跨章的事实账本。

## 一、交付

### 1. `eras/zhanguo/history.json`（新）

事件表，**≥ 8 件、跨度 ≥ 50 年（最早年 − 最晚年 ≥ 50）、按年排序**、每件都有来源。字段：

```json
{
  "era": "zhanguo",
  "place": "临淄",
  "span": { "from": -356, "to": -306, "note": "齐威王末年至宣王末年" },
  "macro": { "minxin": 0.52, "grain": 0.48, "power": 0.5, "rites": 0.55 },
  "events": [
    {
      "id": "guiling-354",
      "year": -354,
      "title": "桂陵之战",
      "text": "齐救赵，围魏于桂陵",            // ≤ 30 字
      "kind": "war" | "reform" | "rite" | "scholar" | "omen" | "relief",
      "effects": { "power": 0.04, "grain": -0.05 },   // 键取自 minxin|grain|power|rites，绝对值 ≤ 0.2
      "enters": { "who": "禾", "as": "征卒", "line": "东郊要出卒了。" },   // who ∈ 禾|桑|小石|季|田伯|乡邻；line ≤ 18 字
      "source": { "title": "《史记·田敬仲完世家》", "url": "…" },
      "verified": true
    }
  ]
}
```

候选事件（**必须逐条核验日期与出处**，可增删替换，但保持 356→306 的跨度与齐国视角）：

| 年 | 事件 | 进入谁 |
| --- | --- | --- |
| 前356 | 秦用商鞅（变法开始；秦强） | 季（听说秦人改了法） |
| 前354 | 桂陵之战（齐救赵） | 禾（征卒、粮征） |
| 前341 | 马陵之战（齐破魏，庞涓死） | 田伯（军功与赏田） |
| 前334 | 徐州相王（齐魏互王） | 季（礼制变了） |
| 前320 | 齐威王卒，宣王立 | 乡邻（国丧、徭役） |
| 约前317 | 孟子至齐（「王何必曰利」） | 季（稷下学风） |
| 约前315 | 齐宣王伐燕（五旬而举之；孟子劝勿取） | 田伯（国策、粮与民心） |
| 前311 | 燕昭王即位，招贤复仇 | 乡邻（流言：北边的仇） |
| 约前309 | 田文为相（稷下盈门） | 田伯（新贵的掂量） |
| 约前306 | 宣王末年（长卷收束点） | 禾（小石已长成） |

**核验要求**：每条事件的年份与出处要有依据。优先查《史记》相关世家/列传、中文维基、中国哲学书电子化计划（ctext）等；把来源写进 `source`，核验过的 `"verified": true`，无法核验的 `"verified": false` 并在报告里点名。**不许编造 URL**；不确定就写书名篇名，不要造链接。

### 2. `engine/history/`（新）

```ts
// engine/history/types.ts
export interface HistoryMacro { minxin: number; grain: number; power: number; rites: number }  // 0..1
export interface HistoryEvent {
  id: string; year: number; title: string; text: string;
  kind: 'war' | 'reform' | 'rite' | 'scholar' | 'omen' | 'relief';
  effects: Partial<HistoryMacro>;
  enters: { who: string; as: string; line: string };
  source: { title: string; url?: string };
  verified?: boolean;
}
export interface HistoryState { year: number; fired: string[]; macro: HistoryMacro }
export interface HistoryApi {
  state(): HistoryState;
  events(): HistoryEvent[];
  /** 推进到某年（可跨多年）：返回途中发生的事件，按年依次；已发生的不重复；同步更新宏观 0..1 */
  advanceTo(year: number): HistoryEvent[];
  /** 一个事件怎样进入个体：给呈现层的一条（谁、一句话、哪一年） */
  enter(e: HistoryEvent): { who: string; line: string; year: number };
  /** 个体的决定写回宏观（民心/粮/国力/礼制） */
  writeBack(w: { by: string; decision: string; delta: Partial<HistoryMacro>; year?: number }): HistoryState;
  /** 事实账本：事件与写回都记一条 Fact（用 engine/types 的 Fact 形状），只增不改 */
  ledger(): Fact[];
}
export function createHistory(cfg: { events: HistoryEvent[]; startYear: number; macro?: HistoryMacro; ledger?: Fact[] }): HistoryApi;
/** 从 eras/zhanguo/history.json 读表（Vite 与 tsx 都要能跑：用 import JSON） */
export function loadHistory(): { span: { from: number; to: number; note?: string }; macro: HistoryMacro; events: HistoryEvent[] };
```

`engine/history/index.ts` 汇总导出。纯函数、确定性、不碰 DOM、不碰 `engine/world`。

### 3. `engine/history/history.test.ts`

`npx tsx engine/history/history.test.ts`，照 `engine/world/sim.test.ts` 的 `check()` 风格：

- 事件 ≥ 8、跨度 ≥ 50 年、按年排序、id 唯一；
- 每条有 `source.title`；`effects` 键合法、值 |v| ≤ 0.2；`enters.line` ≤ 18 字、`text` ≤ 30 字；
- `advanceTo` 跨年返回顺序正确、不重复；宏观变量被 effects 更新且夹在 0..1；
- `writeBack` 生效且写进账本；账本只增；
- 同一输入两次 → `state()` 深相等（确定性）；
- 起点即末年的边界：`advanceTo` 倒退不报错、不产生事件。

### 4. `docs/design/history-arc.md`

- 50 年时间表（年 · 事件 · 进入谁 · 一句话 · 来源）；
- 规则：宏观 ↔ 个体互相写入（事件怎样变成预测误差；决定怎样写回；哪些数字不上屏——上屏的只有处境与人的样子）；
- **给整合者的接线说明**：怎么在幕与幕之间 `advanceTo`、怎么把 `enter()` 折成现有 `Beat`（例：`{kind:'rumor'|'say'|'world…'}`）、跨章账本怎么经 `store` 持久化（键名建议 `history.state`）；
- 来源清单与核验状态；没做到的部分。

## 二、验收

```sh
npx tsx engine/history/history.test.ts      # 全 ok，exit 0
npx tsx engine/world/sim.test.ts            # 不回归（你若没碰 sim.ts 也应通过）
pnpm typecheck
```

报告里打印：事件条数与跨度、核验过的条数与未核验的条数、测试输出摘要、给整合者的接线点清单。

## 三、不要做

- 不改 `engine/world/sim.ts` 的公开接口（真有需要，只做向后兼容的加法，并先跑通 `sim.test.ts`）；更不许改 `engine/types.ts`（`Fact` 直接用）。
- 不碰 `frameworks/**`、`app/**`、`components/**`、`bench/**`、`director/**`、`intents/**`。
- 不把 50 年压缩成一天一格的模拟；长卷按「幕／章」推进年份，年中不展开（低分辨率）。
- 不编造历史；宁可标「待核」。
