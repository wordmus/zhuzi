# C · 对照实验设计：导师层做成 UI（《机器仪表》）

依据：与 B（`docs/tasks/2026-10-16-b-desk-overview.md`，导师台场景化）互为对照。
本实验的分层哲学：**导师层不做场景化，就是能用的 UI；越往呈现层，表现力越丰富**——导师＝仪表（信息与操作），导演＝半抽象（行与草图），呈现＝最丰富（游戏/动画/图集/3D，真场景）。同一份真实数据，两种表达，放在一起看哪种更像这台机器该有的样子。

---

## 一、面板结构表（三栏 + 状态条）

| 区 | 内容 | 可做之事（操作） | 真实数据来源 |
| --- | --- | --- | --- |
| **导师**（左） | 顶部当前念头（「它现在在想什么」）；它眼中的你（假设列表：文本＋证据＋置信度）；灯油分配（每个世界/作品一行份额）；来访史（来过几次、上次距今、停留最久处） | **纠正一条假设**（写回 store，更新置信度与状态为 edited）；**灯油 +/−**（写回 store，**下一次 `commission()` 的 why 与 budget.lamp 真的变**）；展开「为什么这么分」 | `Commission.why`、`engine/mind/hypotheses.ts`、`VisitRecord`、`mentor.lamps` |
| **导演**（中） | 基础导演与叔衡两行：名字、正在做的（毛坯）、已交付（盖印）、一句「为什么这么做」（核心规则摘要） | 查看只读信息；点开查看工作台细节与案头示意图（矢量草图 + 规则列表展开） | 作品索引中的 `director` 字段、`director/seed-memory/rules.json` |
| **呈现**（右） | 作品卡片架：形式（游戏/动画/图集/短章）× 档位（L1/L2/L3）× 状态（毛坯/盖印）× 事实数；留白 | 选一件展开「为什么值得你看」（折叠文本）；**「进入」**＝新标签页打开该作品 `index.html`（无 URL 时按钮禁用并注明「未开门」） | `assets/library/console/works.json`（由 `director/pipeline/console-index.ts` 从真实 `runs` 扫描生成） |
| **状态条**（底） | 当前运行：本地规则 / 未接模型（诚实标注）；念头采样总数；最近一次事实的时间与内容；时代标识 | 只读状态监控 | `think.stats()`、`ctx.handoff.world.ledger()`、`eras/zhanguo` |

---

## 二、真实数据流动与回路

1. **假设与培育回路**：
   - 启动时调用 `getOrInitHypotheses(ctx.store, { previous, current, dayPart })` 读取或初始化。
   - 用户点击「纠正」输入新说法后，调用 `correctHypothesis()` 更新置信度为 0.9，留痕原文本，并持久化写入 store 的 `mentor.hypotheses`。
   - 下一次调用 `createMentor().commission()` 时，`commissionWhyFromHypotheses` 优先识别 edited 状态，输出 `依你纠正的「...」，重排此程。`，回路即时生效。
2. **灯油与注意力预算回路**：
   - 存储在 `store` 键 `mentor.lamps` 中（各世界份额数值）。
   - 用户点击 `+` / `−` 微调灯油份额，实时写入 store。
   - `createMentor().commission(intent, plan)` 在计算 `budget.lamp` 时读取 `store.get('mentor.lamps')?.[intent.id]`，覆盖默认计算值；同时 `commission().why` 生成对应的灯油调配依据（如 `依你调过的灯油（1.6盏），重排此程。`），保证委托与预算忠实反映用户调整。
3. **作品卡架与索引**：
   - 脚本 `director/pipeline/console-index.ts` 扫描 `runs/*/*/L*/plan.json`，关联 `index.html`（判断交付状态与相对 URL）与 `ledger.json`（事实数统计）。
   - 生成的标准资产 `assets/library/console/works.json` 供框架直接作为结构化数据消费，杜绝手写假数据。

---

## 三、视觉与界面交互语言

- **色板**：严格使用 `eras/zhanguo/palette.json` 战国漆书规范：
  - 漆底：`#120d0b`（漆黑）与 `#1e1511`（漆褐暖黑）；
  - 金线分隔：`rgba(201, 162, 74, 0.35)` 与 `#c9a24a`；
  - 帛面字色：浅帛 `#f1e3c4`，次级信息暗帛 `#cbb98f`；
  - 印章与盖印：朱砂红 `#b33a26` 与 `#f38f7d`。
- **无障碍与可操作性**：
  - 原生语义化标签（`<button>`、`<details>`、`<input>`）配合 `aria-label`；
  - 经 `ctx.aff.add()` 注册核心 affordance，首 3 秒内仅暴露 1 个首要动作（纠正假设），3.1 秒后激活其余动作，满足注意力预算门槛；
  - 键盘 Tab/Enter 可聚焦与激活全功能。

---

## 四、复验命令

```sh
# 1. 静态类型校验
pnpm typecheck

# 2. 生成作品索引资产
npx tsx director/pipeline/console-index.ts

# 3. 编排、校验并构建独立呈现产物（试映）
pnpm present --intent intents/console.json --tier L1 --seed 2

# 4. Playwright 交互自证断言（假设纠正、灯油变动、URL有效性、无控制台错误）
node frameworks/console/verify.mjs

# 5. 既有作品回归测试
pnpm bench runs/fifty-years/9/L1

# 6. 自测独立单页构建与基准测试
ZHUZI_ENTRY=dev/console.html ZHUZI_OUT=dist-console npx vite build
pnpm bench dist-console/dev/console.html
```

---

## 五、边界与说明

1. **界面性质与 bench 规则**：
   - 《机器仪表》是机器自身的控制台与监控界面，而非面向剧情沉浸的呈现舞台；
   - 仪表需要完整展示假设列表、证据、导演规则摘要与作品索引，因此**不适用面向呈现规格的「每屏 ≤30 字」**要求（在 bench 中 `max-chars` 失败属预期说明，其余指标全部通过）。
2. **零场景与模型边界**：
   - 不做画布场景、不做人物走动、不建咖啡厅三维模型；
   - 不调用真实外部 LLM，诚实标注本地规则驱动。

---

## 六、与 B（场景化地图）的对照结论

1. **哪种更省字**：B（场景化横幅）以物件、空间行进与呼吸动效代字，一屏一物，严格把每屏控制在 30 字内，在「字最贵」的减字美学上显著更省字；而 C 作为密集型信息仪表承载了完整假设、来访历史与规则表，文字密度更高。
2. **哪种更能承载「你纠正它→它改」的回路**：C（仪表 UI）直接将心智的假设清单、置信度与灯油滑块平铺在用户面前，支持就地编辑并直接回写 store 触发下一次委托重算，在人机双向调校的回路清晰度、操作确定性与反馈效率上显著优于场景化隐喻。
3. **哪种更适合当产品入口**：面向初访用户的情感建立与世界观沉浸，B 的场景化地图更具吸引力与戏剧张力；但面向日常高频使用的创作者、开发者与深度培育者，C 的机器仪表才是真正具备生产力属性、信息一目了然且控制确定的产品入口。
