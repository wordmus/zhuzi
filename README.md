# 竹子（zhuzi）· 个人呈现 Agent

**一台只为一个人存在的机器。** 你推门进去，它认出一个具体的处境，把一个人物放进你心里；走的时候，你带走一条没收口的线。

本轮 demo 把**推门、导师台、工作室与五十年长卷的四个小游戏**接在同一条导演管线上：意图 → 方案 → 校验 → 构建 → 模拟玩家试映。导师根据本次来访写委托，导演交方案，演员带着自己的处境行动，最后把真实结果交回来。

第一次可以先玩「案上回信」：推门拿《旱》的票根 → 进入禾的处境，预演并真实叩门 → 回到咖啡厅工作室，拿委托、盖印、接演员报告 → 归来关门。长卷则从前356年走到前306年，依次穿过《旱》、季的诸家辨言、五德轮、田伯的刀币抉择与编钟回敲；工作室实际在前306年卡之后、最终关门之前，不是四游戏前的菜单。

四个游戏分别让你辨一句话来自哪家、转动五德轮推演相胜、掂刀币后决定开仓／立券／关门、听并回敲编钟。决定进入事实账本，天下的变动也会改变人的处境。齐水德是季的思想实验，辨言是导师回望材料，不把后世存世文字冒充当年的现场对白。

本轮独立复验入口是 [五十年长卷 seed 9](./runs/fifty-years/9/L1/index.html) 与 [工作室 seed 5](./runs/studio/5/L1/index.html)；四件作品在原门槛与收紧后都通过 **hard 9/9，含layers**；首操作上限由0.9降至0.6秒、帧率p5下限由50升至55、反馈上限由1000降至900毫秒，字数仍≤30。逐条命令、实际结果、产物断言与支持边界见 [S7复验记录](./docs/verification-fifty-years.md)，旧轮次数据见 [首轮复验记录](./docs/verification-demo.md)。

一个可复验的小例子：长卷田伯章掂刀币后选竹券，账本会留下 `qi-knife-lend`；工作室接到报告后，按反引号打开“三层信息流”，沿工作室提示的 `initialState.sourceReport` 找到原局报告，两份 actual 与 error 应一致。这里接的是刚才真实发生的回报，预演仍保留为预演。

本机允许 localStorage 时可续接已完成幕和历史账本；半局答题、步行位置与盖到一半的印不恢复。无本地存储时退回本页内存，关页后不能续存；不支持跨设备同步，本轮没有验证实时模型、手机手工试玩或真人心流。

---

## 怎么跑

```sh
pnpm install
npx playwright install chromium     # 第一次；bench 与 present 要用

pnpm dev                            # 开发：按 ZHUZI_INTENT / ZHUZI_SEED / ZHUZI_TIER 现场出方案
pnpm typecheck
```

生成与评测（从仓库根目录执行；每条present都会实际试玩并生成截图、信件和账本）：

```sh
# 完整长卷：四游戏 + 工作室
pnpm present --intent intents/fifty-years.json --tier L1 --seed 9
pnpm bench runs/fifty-years/9/L1

# 短流程：推门 → 《旱》 → 工作室 → 归来
pnpm present --intent intents/studio.json --tier L1 --seed 5
pnpm bench runs/studio/5/L1

# 旧流程回归
pnpm present --intent intents/first-visit.json --tier L1 --seed 11
pnpm bench runs/first-visit/11/L1
pnpm present --intent intents/han-act1.json --tier L1 --seed 7
pnpm bench runs/han-act1/7/L1
pnpm bench:selftest
```

试玩可直接打开对应目录的 `index.html`；也可运行 `python3 -m http.server 5211 --directory runs`，在浏览器访问 `http://127.0.0.1:5211/fifty-years/9/L1/index.html` 或 `/studio/5/L1/index.html`。用新浏览器配置体验首次来访；要验证续接，保持同一浏览器和地址来源。`pnpm dev` 默认为原首访入口，长卷与工作室使用上面的指定intent命令生成。

三层信在三个地方可查：

- 试玩中按反引号（数字1左侧键），或长按舞台左下角，展开“三层信息流”。委托 commission、方案 plan、提示 cue、报告 report、回顾 retro 五类齐全，完成后未回执为0。
- `runs/<intent>/<seed>/L1/layers.json` 保存完整信件、数量与 `check`；完整收场应为 `check: []`。`trace.jsonl` 的 `layer.letter` 分别记录发出和收件，`ledger.json` 只记实际事实。
- 浏览器控制台运行 `window.__zhuzi.layers.letters()` 或 `window.__zhuzi.layers.check()`；演出中尚缺的报告与回顾不代表已经通过。

`bench` 会做正常通关、删字通关、同seed同操作复现，并检查三层信件；验收应看到 **PASS hard 9/9** 和 **layers PASS**。每件作品的 `bench.json` 保存实际指标与门槛，`curve.csv` 保存体验谱；不要用会被下一次覆盖的 `bench/report.json` 代替四件作品各自的报告。`shots/` 可看每幕，长卷 `history-save.json` 可看年份、完成幕与账本。

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
