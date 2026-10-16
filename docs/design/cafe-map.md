# CAFEMAP 设计与对照文档（对照实验 A：咖啡厅作为入口总览）

依据：`docs/design/structure.md`（四层结构）、`docs/design/layers.md`、策划 v0.2 §12（作品架、年谱、灯油默认折叠，第二三次来访随需要出现）、§13（基础导演）；与 `docs/tasks/2026-10-16-b-desk-overview.md`（B：独立总览页）、`docs/tasks/2026-10-16-c-console-ui.md`（C：仪表 UI）互为对照。

---

## 一、A 的核心立场

**入口仍是那间咖啡厅（是呈现、有漆画画面），但第二次起（`ctx.visit.n >= 2`）它展开成整台机器的四站**。
- **第一次来访**：快路径完全不动（推门 → 灯亮 → 导师 → 票根进入）。
- **第二次起展开**：咖啡厅保持地标不动（你的座位、导师的位置、通往世界的门），画面在进场后展开四站具象物件，一屏一个焦点、每屏 ≤1 句 ≤30 字、前 3 秒 ≤1 个可做之事、100ms 内给予看得见的视觉反馈。只有 1–2 处「因为你上次而变」的地方会动。
- **反引号面板**：增加折叠项「看整台机器」，第一次来访也能按需展开总览四站。

---

## 二、四站元素与交互行为表

| 站 | 具象物件 | 可见真实数据 | 可做动作与状态流转 |
| :--- | :--- | :--- | :--- |
| **① 灯油台** (`lamp-oil`) | 案几、黑陶提梁油壶、连盏灯盘与动态火苗 | `commission.budget.lamp`、来访次数与历史偏好 | 点击「倒油」：陶壶倾斜倒油动画，火苗高低变化，写入 `mentor.lamps` 与 `mentor.lamp.poured`，**下一次 commission().why 与 budget.lamp 真实改变**。 |
| **② 导演廊** (`directors`) | 基础导演与叔衡的两张黑漆工作台、未盖印毛坯、墙上年谱草稿 | `director` 字段、`seed-memory/rules.json`、草稿版本 | 点击「细看草稿/撤掉一版」：展开草稿详情与批注，可撤版并写入 `director.draft.dismissed`，折叠确认。 |
| **③ 作品架** (`shelf`) | 漆木多层架、作品帛卷/卡片、朱砂「盖印/毛坯」事实印 | `runs/index.json`（若存在）；缺失时显示「架子还空着」 | 点击作品：展开「为什么值得你看」，切换选中当前作品，印章与事实数量真实映射；无数据时不编造虚假作品。 |
| **④ 门** (`door`) | 经典双扇木门（地标不动，宪法：永远推得开） | 选中作品的相对路径 `runs/<id>/.../index.html` | 点击「推门」：门轴微启，新标签页跳转进入作品；无可用 URL 时显示「这件还没开门」。 |

---

## 三、复验命令与验收结果

### 1. 类型检查
```sh
pnpm typecheck
```
- **结果**: PASS (exit code 0)。

### 2. 第一次来访快路径回归验证
```sh
pnpm bench runs/first-visit/13/L1
```
- **结果**: PASS hard 9/9（在并发争抢时 feedback p90 偶现波动，重跑一次即过，保持快路径 9/9 不变）。

### 3. 展开态呈现构建与评测
```sh
pnpm present --intent intents/cafe-map.json --tier L1 --seed 3 && pnpm bench runs/cafe-map/3/L1
```
- **构建结果**: 5 步 · 13.7s · 截图 6 · trace 53 条 · 报错 0 · layers 5 封信无未回执。
- **评测结果**: `PASS hard 9/9 · first-action 0.3s · first3s 1 · feedback p90 317ms · max-chars 15 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS` (exit code 0)。

### 4. 自动化自证脚本
```sh
npx tsx scripts/verify-cafe-map.ts
```
- **断言 1 (展开条件对比)**: 同 seed=3 下，`visit.n = 1` 时 `cafeMap.expanded` 为 false，元素仅保留快路径，exit 为 `ticket:picked`；`visit.n >= 2` 时展开四站 (`lamp-oil`、`directors`、`shelf`、`door`)，exit 变为 `door:entered`。
- **断言 2 (灯油倒过前后真实改变)**:
  - 倒油前：`why = 「初次见面，先给你一件再问。」`, `budget.lamp = 0.8`。
  - 倒油后：`why = 「依你调过的灯油（1.6盏），重排此程。」`, `budget.lamp = 1.6`。
  - `commission().why` 与 `budget.lamp` 确实发生前后差异。
- **断言 3 (作品架数据真实性)**:
  - 缺失时：优雅展示「架子还空着」，作品数为 0，绝不编造虚构作品。
  - 存在时：读取真实作品列表，数量与内容完全吻合，印章状态正确区分。

---

## 四、产物截图索引

- `runs/cafe-map/3/L1/shots/01-threshold-enter.png`：门（进场，首屏仅门可交互）
- `runs/cafe-map/3/L1/shots/02-threshold-s0.png`：① 灯油台（黑陶壶、油盏与倒油互动）
- `runs/cafe-map/3/L1/shots/03-threshold-s1.png`：② 导演廊（基础导演与叔衡工作台、草稿与年谱）
- `runs/cafe-map/3/L1/shots/04-threshold-s2.png`：③ 作品架（帛卷卡片、印章状态或「架子还空着」）
- `runs/cafe-map/3/L1/shots/05-threshold-s3.png`：④ 门（选中作品后推门进入）
- `runs/cafe-map/3/L1/shots/06-final-done.png`：推门完成

---

## 五、A/B/C 对照三句结论

1. **A（场景展开）把机器的系统机制彻底内化进咖啡厅的漆画世界中**：每一次交互都是触碰陶壶、案台或门轴等具体物件，维持了最强的世界沉浸感与角色能动性，最适合作为以“体验与世界观”为核心的真正叙事入口。
2. **B（独立场景页）提供了最纯粹的空旷鸟瞰视角，适合快速纵览全局**：它适合已经对作品结构非常熟悉、希望一眼看尽各方进展的巡检者，但在情绪和故事连续性上打断了玩家从咖啡厅步入世界的自然过渡。
3. **C（UI 仪表）具备最高效的信息密度与调参自由度，但完全放弃了具象场景**：它是开发者和系统操作者的理想工作台，却不适合作为普通来访者推门而入的第一站，因而最适合降级为管理侧的次级或反引号工具层。

## 六、2026-10-16 场景化返工

以前四站靠描边方框、卡片标题和空状态居中文字辨认。现在在同一间咖啡厅里看物件：灯油台用 `props-room.lowTable` 的四足矮案，三盏青铜灯以火焰高度表示份额，陶壶有提起、倾倒和落回的动作；角落木架上的假设帛条以长度和墨色表示置信度，`edited` / `originalText` 保留刮改痕。悬停单条 0.8 秒或点击，可听导师读这一条，最多 30 字。

导演廊是两张矮案，按各导演真实作品的 `form` 放毛坯：胶片格、叠帛、线格方或棋盘，旁边有笔和未压下的印；没有历史记录时使用当前意图的形式。墙上只有一张歪斜的旧年谱，有纤维、双钉眼、卷角、原草图和朱笔改线。木架没有整块背板和外描框，每件作品一枚帛条，有印者有朱印，毛坯以麻绳系住；数量按完整索引排列，不再截断为六件。缺索引时只画三枚白简与薄尘，走近再由导师说「架子还空着。」。

焦点用物件周围的暖光和导师朝该站的视线表示。四站透明按钮不再绘制 CSS 发光矩形；进门后清掉入口按钮残留的光框。展开时收起原有的平面年谱/书卡和放大的票根，以免与场景物件重叠；首次来访的快路径保持原逻辑。门的位置与门扉画法保持原样，门框属于真实门构件。

倒油按钮现在同时写入 `mentor.lamp.poured` 与 `mentor.lamps`，画面直接读取真实 commission 的灯油或已保存份额；下一次 commission 的理由和预算随之改变。没有更改 bench 判定、门槛、其它框架或 `runs/index.json`。

复验入口：打开 `runs/cafe-map/5/L1/index.html`，推门，依次点陶壶（或按 1）、导演矮案（2）、作品架（3）、门（Enter）。在左侧小木架的第一条帛上停留 0.8 秒，能读到「你更在意人物的处境，而非战局」；这比标签解释更容易检查条与假设是否对应。

截图均为 1280×720：

- `runs/cafe-map/5/L1/art-review/01-oil.png`：灯油台与假设架。
- `runs/cafe-map/5/L1/art-review/02-directors.png`：两张矮案与旧纸年谱。
- `runs/cafe-map/5/L1/art-review/03-shelf.png`：真实 31 件对应 31 枚帛条。
- `runs/cafe-map/5/L1/art-review/04-door.png`：门焦点。
- `runs/cafe-map/5/L1/art-review/05-empty-shelf.png`：空架与导师一句话。
- `runs/cafe-map/5/L1/art-review/before-after-directors.png`：同机位、同倒油后动作对照，上旧版 seed 3，下新版 seed 5；旧版原始截图仍在 `runs/cafe-map/3/L1/shots/03-threshold-s1.png`，未改动。
- `runs/cafe-map/5/L1/art-review/evidence.json`：索引数量、真实按钮倒油前后 commission、透明按钮无框、缺索引文案的浏览器证据。

缺索引验收在临时目录中运行真实 `directFromFiles`：目录没有 `runs/index.json`，方案得到 `works: null`，再把这个空状态送进同一个构建测试。没有挪动或删除共享工作区中的真实索引。空架截图因此是验收场景，不是声称生产索引为空。

限制：当前仍沿用原来的逐站引导和默认选择第一件作品；不包含任意点选架上其它作品的新导航。窄屏未做专项验收，索引特别多时帛条会缩小；完整标题与作品详情并未常驻画面。bench 的反馈 p90 门槛为 900ms，不把通过 9/9 等同于所有动作均在 100ms 完成。

本轮验收实测：

```text
pnpm typecheck
  PASS (exit 0)
pnpm bench runs/first-visit/13/L1
  PASS hard 9/9 · first-action 0.1s · first3s 1 · feedback p90 409ms · max-chars 29 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS
pnpm present --intent intents/cafe-map.json --tier L1 --seed 5 && pnpm bench runs/cafe-map/5/L1
  present: layers 5 封信 · 未回执 0 · 检查通过；5 步 · 13s · 截图 6 · trace 47 条 · 报错 0
  PASS hard 9/9 · first-action 0.37s · first3s 1 · feedback p90 393ms · max-chars 15 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS
pnpm exec tsx scripts/verify-cafe-map.ts
  所有自证断言全部通过 (EXIT 0)
pnpm exec tsx runs/cafe-map/5/L1/art-review/verify-scene.ts
  SCENE PASS · 四站 4 张 + 空架 1 张 · index 31/31 · missing 0 · hit-area frames 0
  OIL UI PASS · why 你惦记导师身旁，再给它一次。 => 依你调过的灯油（1.6盏），重排此程。 · lamp 1 => 1.6
```

一轮并行运行多个浏览器时出现 `FAIL hard 8/9`（只有 fps-p5=30 未过 55），结束并行负载后重跑上述最终命令得到 fps-p5=60 和 9/9；没有改门槛。100ms 是交互目标，本轮 bench 实测 p90 为 393ms，不能据此宣称该目标全部达成。
