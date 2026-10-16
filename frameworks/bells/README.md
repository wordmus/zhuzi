# 编钟

机器先敲，来客敲回去。这是咖啡厅的休息：从两声开始，每回成一轮加一声，三轮为两声、三声、四声；生成器上限五声，当前三轮规则不会到第五声。错音会轻轻沉下，再播放原来这一轮，不扣掉已回成的轮次。正常九次回敲约 20–35 秒；不设失败倒计时，走神或一直错音可以慢慢重来，不保证这种情况下四十秒内结束。

## 导演接入

导出 `bells: Framework`，框架 id `bells`，入场焦点 `bells-start`。属于导师／机器，不属于禾或季。

| 元素 id | 实物 | actions | 快捷键 |
| --- | --- | --- | --- |
| `bells-start` | 第一枚钟上唯一的暖光；开始听 | `begin` | 回车 |
| `bell-0` | 宫，最大、最左 | `strike` | 1 |
| `bell-1` | 商 | `strike` | 2 |
| `bell-2` | 角 | `strike` | 3 |
| `bell-3` | 徵 | `strike` | 4 |
| `bell-4` | 羽，最小、最右 | `strike` | 5 |

读取元素 `represents` 与动作授权；未传元素时用默认五钟，显式关闭某个动作会让对应钟不可敲。`prominence` 不改钟架布局。可选 `act.lines` 的 `remember` 是结束时导师的话，截到 `min(18, act.budget.maxChars)` 字；默认「这个，我记着。」。没有标签、数字、说明按钮或游戏名。

前三秒只可点第一钟，之后机器逐声敲；播放时不收回敲。回敲时五钟都能点，也能用 1–5；每一声都有音与钟体变形。停顿 1.8 秒后，下一枚钟给一点暖光，读屏始终把它作为唯一当前焦点。这是可关闭文字后继续的温和记忆练习，不是无提示的记忆考试。每个回敲位置的 `[data-aff]` id 形如 `bell-2-r0-p1-a1`，前缀对应方案里的 `bell-2`，后缀标示轮次、当前声位与累计尝试；所有交互仍由 `ctx.aff.add()` 注册。

## 纯逻辑与出口

`makeSequence(ctx.rng.fork('bells'))` 生成五个音级。三轮使用同一段前缀，错音只清当前轮的输入，绝不重新抽签。`logic.ts` 不读 DOM、时钟或音频，`strike()` 返回新状态，回成三轮才结束。

结束时每枚钟腹上有三条金线，交回：

- `facts`：`{ id: 'bells-remembered', text: '机器与来客回成三轮五声，最长记住四声。', kind: 'event', by: '导师' }`。
- `metrics`：`longest`（当前完整通关为 4）、`rounds`、`mistakes`、`accuracy`（所有尝试中正确音的比例）、`durationMs`。
- `line`：导师的结束短句，最多 18 字。

`ctx.handoff.bells` 也留下最长声数与事实。只记 `world.fact` trace，不改 `WorldState`。另有 `bells.start`、`bells.step`（播放与回敲）、`bells.choice`（回成一轮）、`bells.end`。同 seed 同操作的序列、事实与正确率可复现，真实停留时长不要求一致。

## 音律与动机

复用 `ctx.audio.bell(note)`，实际音高由 `engine/audio.ts` 的 `degreeHz` 产生。以宫 220 Hz 为基准，五声频率关系为 **1、9/8、81/64、3/2、27/16**：宫 220、商 247.5、角 278.4375、徵 330、羽 371.25 Hz；这是五度相生后折入同一八度的五声音阶，不是任意五个电子音。纯逻辑测试会逐级对照实际音频函数，避免文档和听见的音不一致。

音律方法依据[《管子·地员》的五音三分损益记述](https://zh.wikisource.org/zh-hant/管子/第58篇地員)。220 Hz 是本作品的现代合成基准，不声称重建某组战国出土编钟的绝对音高、双音结构或调律。第一下点击前保持静默；无声设备仍可跟着钟体亮起的顺序回敲。合成音色使用现有非谐泛音与室内混响。

这架钟与初访时「灯一盏盏亮到你这边」是同一动机：灯的五声上行表示机器来到你面前，这里的回敲表示你把声音交回给机器，三条金线留在钟上，像一次相互记住。

## 自测与复验

```sh
pnpm typecheck
ZHUZI_ENTRY=dev/bells.html ZHUZI_OUT=dist-bells npx vite build
pnpm bench dist-bells/dev/bells.html
npx tsx frameworks/bells/logic.test.ts
```

协调者已确认 Vite 自测入口实际路径为 `dist-bells/dev/bells.html`，不是原任务书的 `dist-bells/index.html`。`pnpm dev` 后打开 `/dev/bells.html?seed=23`，点第一钟，跟着音与亮光回敲；故意敲错一枚，会重播同一段。`window.__zhuzi.result` 交回结果，`done` 为完成标志。独立页使用 `frameworks/qi-knife/dev-harness.ts`，仅自测页共用，正式框架不依赖另一个小游戏；它发送真实五类三层信件并处理回执。

## 五十年长卷的位置

这是导师／机器在咖啡厅的休息，不新增战国史实。建议放在任意两章之间，尤其是前 315 年伐燕／征粮的紧张章节之后，让玩家回咖啡厅喘口气再进入下一年。产出的事实只作用于之后咖啡厅里导师的记忆回应，不应改变王命、禾的债务或历史日期。正式故事注册、跨来访长期记忆与更长的五声挑战尚未接入，交由整合者决定。
