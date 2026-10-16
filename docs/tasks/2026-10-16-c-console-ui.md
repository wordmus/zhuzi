# C · 对照实验：导师层做成 UI（《机器仪表》）

依据：与 B（`docs/tasks/2026-10-16-b-desk-overview.md`，导师台场景化）互为对照。本实验的分层哲学：**导师层不做场景化，就是能用的 UI；越往呈现层，表现力越丰富**——导师＝仪表（信息与操作），导演＝半抽象（行与草图），呈现＝最丰富（游戏/动画/图集/3D，真场景）。同一份真实数据，两种表达，放在一起看哪种更像这台机器该有的样子。

目标：新增 `frameworks/console/**` 与 `intents/console.json`（《机器仪表》），一件**UI 优先**的独立入口，用 DOM/CSS 面板（不是画布场景、没有咖啡厅、没有人物），数据全真、可操作。

## 一、面板（三栏 + 状态条）

| 区 | 内容 | 可做 | 真实数据 |
| --- | --- | --- | --- |
| **导师**（左） | 顶部一句「它现在在想什么」；它眼中的你（假设列表：文本＋证据＋置信度）；灯油分配（每个世界/作品一行份额）；来访史（来过几次、上次距今、停留最久处） | **纠正一条假设**（写回 store）；**灯油 +/−**（写回 store，**下一次 `commission()` 的 why 与 budget.lamp 真的变**）；展开「为什么这么分」 | `Commission`、`engine/mind/hypotheses.ts`、`VisitRecord` |
| **导演**（中） | 每位导演一行：名字、正在做的（毛坯）、已交付（盖印）、一句「为什么这么做」（规则摘要） | 看（只读）；点开一位看他的工作台细节（小示意图即可） | 索引里的 director 字段、`director/seed-memory/rules.json` |
| **呈现**（右） | 作品卡片：形式（游戏/动画/图集）× 档位（L1/L2/L3）× 状态（毛坯/盖印）× 事实数；其余留白 | 选一件展开「为什么值得你看」（折叠）；**「进入」**＝新标签页打开该作品 `index.html`（无 URL 时按钮禁用并注明） | `assets/library/console/works.json`（由你写的脚本从真实 runs 生成） |
| **状态条**（底） | 当前运行：本地规则 / 未接模型（诚实标注）；最近一次事实的时间 | 无 | `think.stats()`、`ledger` |

## 二、要新建/改的

- `frameworks/console/**`（新框架 `console`）：DOM 面板（`ctx.stage.dom()`），era 色板做成界面语言（漆底、金线分隔），表意清楚、可键盘操作；交互全部经 `ctx.aff.add()` 或原生可聚焦元素 + 无障碍标签。
- `director/pipeline/console-index.ts`（新）：扫 `runs/*/*/L*/plan.json` 生成 `assets/library/console/works.json`（form/tier/seed/status/director/facts/url 相对 console run 计算；缺 runs 优雅降级）。
- `director/pipeline/console-plan.ts`（新 act 构造）+ `director.ts` 分支（`intent.id === 'console'`）+ `validate.ts` 白名单加 `console` + `app/main.ts` 注册一行 + `engine/types.ts` 如需只加字段。
- `intents/console.json`（新，id `console`，form `vignette`，director `base`）。
- `dev/console.html`+`ts`（自测页）+ `frameworks/console/verify.mjs`（playwright 交互断言）。
- `docs/design/console-ui.md`：面板表、数据来源、与 B 的对照（哪种更像产品入口）、复验命令、边界。

**与 B 的并行纪律**：DESK 工（另一个人）也在改 `director.ts` / `validate.ts` / `app/main.ts`。你每次改这三个文件：先重读、只追加自己的一条、改完**检查 `desk` 与 `console` 两条都在**；若发现 desk 的条目被覆盖，补回并在报告里写明。不要碰 `frameworks/desk/**`、`desk-plan.ts`、`intents/desk.json`、`runs/index.json`、`works-index.ts`、`docs/design/desk-map.md`（那些是 DESK 工的）。

## 三、验收（都要打印）

```sh
pnpm typecheck
npx tsx director/pipeline/console-index.ts        # 生成 assets/library/console/works.json
pnpm present --intent intents/console.json --tier L1 --seed 2
node frameworks/console/verify.mjs                # playwright：面板渲染真实数据、纠假设、灯油 +/-、进入按钮
pnpm bench runs/fifty-years/9/L1                  # 既有作品不回归
pnpm bench dist-console/dev/console.html          # 该页照常跑一遍（见下说明）
```
- **明确说明**：《机器仪表》是机器自己的界面，不是呈现，**不适用演示规格的「每屏 ≤30 字」**（那是呈现的规矩）。因此 bench 若在 `max-chars` 上失败，请在报告里注明是预期（其余项 errors/fps/notext 仍应通过）；如果不改 bench 让它自然过去更好。
- verify.mjs 必须断言：① 假设列表来自 `hypotheses.ts` 且纠正后 store 变化；② 灯油 +/− 后，同一 intent 的 `commission().why` 与 `budget.lamp` 不同；③ 作品卡数量与 `works.json` 一致，且每张「进入」的 URL 都指向真实存在的 `index.html`；④ 全程 console errors = 0。
- 截图 3 张：导师栏（含假设与灯油）、导演栏、呈现栏。

## 四、边界

- 不做场景、不做人物、不做咖啡厅；不接模型；不碰既有 frameworks/intents/runs 产物、bench 判定与门槛、critic；git 操作禁止。
- 与 B 的对照结论写进 `docs/design/console-ui.md` 末尾：三句话——哪种更省字、哪种更能承载「你纠正它→它改」的回路、哪种更适合当产品入口。
