# S4 交接：齐法化、编钟

以前只有田伯开仓的叙述与咖啡厅的编钟母题，现在这两件事都能单独动手玩完，并把事实交回导演；尚未改主入口注册与长卷编排。

## 入口与可复验的小例子

- `/dev/qi-knife.html?seed=23`：点秤前刀币，点乡邻、征粮牍、麻袋各一次，再点左侧粥钵；应看到乡邻聚拢、仓减五袋，返回事实 `qi-knife-give`。同样三次后，点中间竹券返回 `qi-knife-lend`，点右侧仓门返回 `qi-knife-close`。
- `/dev/bells.html?seed=23`：点第一钟，机器敲一段，点钟或按 1–5 敲回去；故意错一声，应重播同一段而非抽新序列。三轮后每枚钟留下三条金线，返回 `longest: 4` 与「这个，我记着。」。
- 只为独立自测页复用 `frameworks/qi-knife/dev-harness.ts`。正式 `bells` 框架不依赖 `qi-knife` 框架；两者都只依赖现有器官与自己的逻辑。

## 路径更正（协调者已确认）

原任务书的 `dist-<id>/index.html` 不符合 Vite 对 `dev/<id>.html` 入口的输出规则，实际是 `dist-<id>/dev/<id>.html`。已向协调者报告，协调者明确改验收口径并禁止修改共享构建配置；没有改 `vite.config.ts`。

```sh
pnpm typecheck
ZHUZI_ENTRY=dev/qi-knife.html ZHUZI_OUT=dist-qi-knife npx vite build
pnpm bench dist-qi-knife/dev/qi-knife.html
ZHUZI_ENTRY=dev/bells.html ZHUZI_OUT=dist-bells npx vite build
pnpm bench dist-bells/dev/bells.html
npx tsx frameworks/qi-knife/logic.test.ts && npx tsx frameworks/bells/logic.test.ts
```

TypeScript 检查退出码 0；两次构建成功。两个自测页使用 s1 的现有 LayerBus，委托、方案、提示、报告、回顾都真正发送并收妥回执，未伪造 bench trace。

## 纯逻辑验收输出

```text
PASS 齐法化：32 seeds × 四种掂量 × 三种出口，三次限制、代价、纯函数、事实与复现
PASS 编钟：32 seeds，2/3/4 声三轮、错音重来、纯函数、同 seed 与实际音频五度相生频率一致
```

## 额外浏览器复验

```text
PASS browser QA: 齐法化三个出口、小屏重复掂量与横竖屏切换；编钟小屏、减弱动态、错音重播、九声三轮；page errors 0
```

以 390×844 的窄屏、减弱动态与横竖切换实跑，三个出口、重复选择、错音重播、三轮结束及信件检查均通过；截图检查确认物件与点击区在屏内。首次测量发现声音初始化会阻塞约 288ms，已修为先画反馈，再于下一帧后初始化声音。对最终构建的 canvas 直接采样：

```text
PASS immediate pixels qi-scale: drawMs 1.5，改变 70236 像素
PASS immediate pixels qi-people: drawMs 2.8，改变 62867 像素
PASS immediate pixels bells-start: drawMs 0.4，改变 6171 像素
PASS immediate pixels bell answer: drawMs 3.5，改变 6609 像素
```

这是事件内重画耗时与像素变化检查，不是替代 bench 的截图延迟。bench 的完整截图/对照差分结果仍以以下汇总为准，不能宣称其 p90 小于 100ms。

## 整合要读的内容

- 导出名：`qiKnife` 与 `bells`。元素 id、动作授权、可选台词 id、事实、metrics、handoff、历史位置都在各自 README。
- `qi-knife` 建议接前 315 年前后伐燕／征粮章，田伯视角；三个事实可影响以后乡邻聚拢、债务、禾对田伯的预期。田伯和开仓／双倍归还情境为虚构，不能引用为通行历史制度。
- `bells` 建议接咖啡厅两章之间，导师／机器视角；事实只影响之后导师的记忆回应。五声音律为 1、9/8、81/64、3/2、27/16，宫音 220Hz，对照实际 `ctx.audio.bell` 音高函数已测；音律依据及不是古钟绝对音高重建的边界见 README。
- 没有直接修改 `WorldState` 或事实账本：只通过返回值交回 facts，并按冻结契约记录 `world.fact` trace。

## 未做到与边界

- 不改注册表与主故事，也没有长卷接线、跨来访保存编钟记忆、全年经济或债券持久化。
- 正常实测《齐法化》约 17 秒／5 步，《编钟》约 28 秒／10 步。两者没有强制倒计时；玩家一直不动或反复敲错时，不保证 90 秒／40 秒内结束，这是保留不惩罚休息体验的明确边界。
- 编钟三轮按两、三、四声增长；生成器最多五声，当前三轮规则不会到第五声。停顿 1.8 秒后下一枚钟给柔光，读屏始终指向下一枚钟，属于带温和提示的练习。
- `metrics.durationMs` 记录真实时长，不要求逐次相等；同 seed 同操作的序列、事实与玩法结果一致。
- 按任务范围仅改两个框架、两组 dev 页和此交接文档；没有改共享文件、没有 git 操作、没有安装依赖。

## 最终 bench 汇总（声音初始化改序后重新构建）

`pnpm bench dist-qi-knife/dev/qi-knife.html`

```text
PASS hard 9/9 · first-action 0.07s · first3s 1 · feedback p90 313ms · max-chars 12 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS
```

证据文件：`runs/_bench/qi-knife/bench.json`；主跑 5 次动作、15.8 秒。

`pnpm bench dist-bells/dev/bells.html`

```text
PASS hard 9/9 · first-action 0.03s · first3s 1 · feedback p90 234ms · max-chars 7 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS
```

证据文件：`runs/_bench/bells/bench.json`；主跑 10 次动作、25.9 秒。

