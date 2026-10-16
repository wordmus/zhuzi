# B · 独立总览：整台机器的地图（`intents/desk.json`）

依据：`docs/design/structure.md`（四层结构）、`docs/design/layers.md`（五种信件与回执）、策划 v0.2 §10（一切皆呈现）、§12（注意力是预算、年谱、作品架）、§13（基础导演）。协调者与用户的约定：**一进去先看整台机器的地图，再点进任何一件呈现；咖啡厅退居其一**。

目标：新增一件**独立的总览呈现**《导师台 · 全图》——一条自左向右的横幅，四站：**① 灯油台（导师）→ ② 导演廊（导演）→ ③ 呈现架（呈现）→ ④ 门（进入演员的世界）**。一屏一个焦点、无标签文字、字最贵；数据必须是真的（来自 runs 与 store，不许手写样品）。

## 一、四站各是什么（都能玩）

| 站 | 看到 | 能做 | 真实数据 |
| --- | --- | --- | --- |
| ① 灯油台 | 导师的陶壶向几盏小灯滴油；灯的大小＝分给那样东西的注意力；旁边竹片刻着你的来访史与它对你的假设 | **倒油**：把油从一盏倒到另一盏（写回 store，**下一次 `commission()` 的 budget 与 why 真的变**）；翻看它为什么这么分（折叠） | `commission.budget.lamp`、`visit.last`、`engine/mind/hypotheses.ts` |
| ② 导演廊 | 两位导演（基础导演 / 叔衡）各一张工作台：台上是**毛坯**（形式看得出：画/简/网格），墙上钉草稿与年谱（第一天 vs 今天） | 走近看他的台（trace 记下你看了谁）；**撤掉一版**（回到上一版，写 store，折叠确认） | `runs/index.json` 的 director 字段、`director/seed-memory/rules.json`、`bench/history.csv` |
| ③ 呈现架 | 每件作品一叠帛：形式（游戏/动画/图集）× 档位（L1/L2/L3）× 状态（毛坯/盖印）；盖印旁有事实印 | 拿起一件（选中）；展开「为什么值得你看」（折叠）；换一件 | `runs/index.json`（由脚本从真实 runs 生成） |
| ④ 门 | 拿着的作品走到门边，门缝透光 | **推门**＝进入该作品（新标签页打开 `runs/<...>/index.html`；无 URL 时只留一句「这件还没开门」并收束） | `runs/index.json` 的 url（相对本页） |

## 二、要新建/改的

- `frameworks/desk/**`（新框架 `desk`）：横幅、四站、平移与焦点、`ctx.aff` 交互、`ctx.lines` 短语（≤18 字/句，≤1 句/屏）；`ctx.rng` 确定性。
- `director/pipeline/desk-plan.ts`（新 act 构造）+ `director.ts` 分支（`intent.id === 'desk'`）+ `validate.ts` 白名单加 `desk` + `app/main.ts` 注册一行。
- `intents/desk.json`（新，id `desk`，form `vignette`，perspective 你，director `base`）。
- **作品索引脚本**：`director/pipeline/works-index.ts`——扫 `runs/<intent>/<seed>/<tier>/plan.json`，生成 `runs/index.json`：`[{ intent, title, form, tier, seed, url, director, sealed, facts }]`（`url` 相对 `runs/desk/<seed>/<tier>/` 计算；缺 runs 时优雅降级为空）。此文件可由 present 或手动 `tsx` 跑；跑出来的索引进 plan（`PlanAct.works?` 或元素数据），框架只读 plan，不联网。
- `engine/types.ts`：只加 `WorkEntry` 与 `PlanAct.works?: WorkEntry[]`（加法）。
- `docs/design/desk-map.md`：四站元素/动作表、数据来源、复验命令、加入新作品后索引怎么更新。

## 三、规格与验收

```sh
pnpm typecheck
npx tsx director/pipeline/works-index.ts          # 生成 runs/index.json
pnpm present --intent intents/desk.json --tier L1 --seed 2 && pnpm bench runs/desk/2/L1
pnpm bench runs/fifty-years/9/L1                  # 既有作品不回归
```
- `pnpm bench runs/desk/2/L1` 必须 **PASS hard 9/9**（含 layers）：首操作 ≤0.6s、前 3 秒 ≤1 件事、每屏 ≤30 字、报错 0、fps p5 ≥55、删字可玩、复现一致。
- 截图 4 张：灯油台 / 导演廊 / 呈现架 / 门；且一局里四站都能到达（trace 断言）。
- **灯油倒过的自证**：`npx tsx` 无头断言——倒油前 vs 倒油后，同一 intent 的 `commission().why` 与 `budget.lamp` 不同（对象落在 `store` 的字段可读）。
- 索引忠实：`runs/index.json` 里每件的 form/tier/状态与 `runs/*/plan.json` 一致；新增一件作品后重跑脚本能看见它。
- 门：选中的作品的 `url` 指向真实存在的 `index.html`（脚本校验并打印）；点击行为在无 URL 时优雅降级。

## 四、边界

- 不改既有 frameworks（vignette/walk2d/reveal/四小游戏/studio/east3d/film/gallery）、既有 intents、既有 runs 产物；不碰 bench 判定与门槛、critic；git 操作禁止。
- 不做：灯油影响「分辨率/模型调用」（那属于 P5/P6 的深水区，这里只做**影响下一次委托的排序与预算**）；不做咖啡厅内的入口改造（B 方案咖啡厅退居其一）。
- 若索引脚本需要写文件，只写 `runs/index.json`（新增文件，不动任何 run 目录内已有字节）。
