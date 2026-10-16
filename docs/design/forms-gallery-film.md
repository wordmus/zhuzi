# 图集与短片：两种 L2 呈现

以前导演只能把意图交给已有的游戏框架；现在 `form: film` 与 `form: gallery` 都能直接走 `present` 管线，委托、提示、演员回报和复盘仍由 main 统一收发。

打开 `dev/film.html` 可以直接看《三人看天》：不碰任何东西也会播完；鼠标停在浅金圆圈上会稳住运镜，碰一下会把字幕换成物件的一句话、画框即时亮起，停 1.2 秒再续播。打开 `dev/gallery.html` 可左右拖动，滚轮和方向键也能翻页；窄屏沿上下拖动。点当前图片追问一句，右上角「收起」在进场 3.1 秒后出现；到最后一张也会收束。

## 元素与动作

| 形式 | 元素 | 动作 | 状态与收尾 |
| --- | --- | --- | --- |
| film | 一张关键帧、一个当前热点、一句字幕 | 望；碰当前热点 | 镜头表自动推进；每个热点只暂停一次，多个热点依序开放，同时最多一个；末镜结束 resolve |
| gallery | 一张焦点 plate、相邻暗片、红印位置轨、一句题注 | 拖、滚轮、方向键、点图追问、收起 | 分数页码写入 `ctx.store`；刷新/转屏仍留在相同作品附近；到底或收起 resolve |

## 《三人看天》镜头表

| 镜头 | 时长 | 运镜 | 字幕 | 字数（含标点） | 热点 |
| --- | ---: | --- | --- | ---: | --- |
| 禾 | 15s | 向上摇 | 再不落雨，我拿什么留住这块地？ | 15 | 手边裂土 |
| 天 | 12s | 推近 | 他等的云，还是没有来。 | 11 | 朱日 |
| 季 | 17s | 向右移 | 若天不肯答，我便问到人间去。 | 14 | 竹简 |
| 田伯 | 17s | 拉远 | 田里的眼睛都望着我，我又望谁？ | 15 | 粮仓门 |
| 临淄 | 14s | 向左移 | 同一片天，谁先低下头去做事？ | 14 | 城门 |

共 **5 镜、75 秒、5 个热点**。75 秒为镜头内容时长；逐个碰过全部热点时另加最多 6 秒的停顿，仍在 60–90 秒内。字幕隐藏不参与任何计时或退出条件；减弱动态偏好下取消平移与缩放。`ctx.rng` 不参与短片。关键帧通过显式 `?url` 导入，单文件构建不依赖外网。

素材配方在 `assets/library/three-look-at-sky/recipe.json`，含协调者提供的原始提示词、模型、1536×1024 尺寸、日期、参考图与校验和。图集选 8 张现有交付截图/设计图，逐件来源、校验和与许可状态见 `assets/library/shelf-gallery/recipe.json`。这些图片未声明开放许可，不能把项目内使用等同于公共领域或第三方再分发许可。

## 复验命令

```sh
pnpm typecheck
ZHUZI_ENTRY=dev/film.html ZHUZI_OUT=dist-film npx vite build && pnpm bench dist-film/dev/film.html
ZHUZI_ENTRY=dev/gallery.html ZHUZI_OUT=dist-gallery npx vite build && pnpm bench dist-gallery/dev/gallery.html
pnpm present --intent intents/three-look-at-sky.json --tier L2 --seed 2 && pnpm bench runs/three-look-at-sky/2/L2
pnpm present --intent intents/shelf-gallery.json --tier L2 --seed 2 && pnpm bench runs/shelf-gallery/2/L2
pnpm bench runs/fifty-years/9/L1
node frameworks/gallery/verify.mjs
```

拖拽与记忆的最小例子：在第一张中间向左拖约半屏，观察红印向右移动；刷新后红印仍在刚才处。无头脚本会分别在桌面与手机视口执行真实 pointer 拖动、读取 store、刷新比对 restore，随后检查滚轮/键盘到底的完成信号。结果与截图保存在 `frameworks/gallery/evidence/`。

限制：这是关键帧 animatic，尚无口型或骨骼动画；声音受浏览器的首次手势解锁限制，不动手也能静音看完。记忆只保存在同一浏览器与来源；禁用存储时退回当前页面内存，不能承诺跨刷新保留。不同文件路径或不同端口可能被浏览器视为不同来源。

## 本轮验收记录

- `pnpm typecheck`：PASS（tsc --noEmit）。
- `node frameworks/gallery/verify.mjs`：PASS；8 plates，first3s=1；桌面拖后位置0.5748285599031869、刷新一致，滚轮到0.9782170229931426，窄屏纵拖到1.6673555997721687、刷新一致；追问12字；到底与收起均完成。
- 图集自证截图：`frameworks/gallery/evidence/01-desktop.png`、`02-narrow.png`、`03-question.png`。

- `ZHUZI_ENTRY=dev/film.html ZHUZI_OUT=dist-film npx vite build && pnpm bench dist-film/dev/film.html`：PASS hard 9/9 · first-action 0.24s · first3s 1 · feedback p90 233ms · max-chars 15 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS。
- `ZHUZI_ENTRY=dev/gallery.html ZHUZI_OUT=dist-gallery npx vite build && pnpm bench dist-gallery/dev/gallery.html`：PASS hard 9/9 · first-action 0.2s · first3s 1 · feedback p90 101ms · max-chars 12 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS。

- `pnpm present --intent intents/three-look-at-sky.json --tier L2 --seed 2`：方案校验0错误0警告，单文件32310KB，play done，5步，81.2秒，6张截图，trace78条，无报错；layers9封信、未回执0、检查通过。
- 播放中：`runs/three-look-at-sky/2/L2/shots/01-three-look-at-sky-enter.png`。
- 热点回应：`runs/three-look-at-sky/2/L2/shots/02-three-look-at-sky-s0.png`（裂土金圈、亮框、物件台词）。
- 关键帧：`assets/library/three-look-at-sky/shots/shot-01-he.png`，其余四镜同目录。

- `pnpm present --intent intents/three-look-at-sky.json --tier L2 --seed 2 && pnpm bench runs/three-look-at-sky/2/L2`：PASS hard 9/9 · first-action 0.32s · first3s 1 · feedback p90 149ms · max-chars 15 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS。

- `pnpm present --intent intents/shelf-gallery.json --tier L2 --seed 2 && pnpm bench runs/shelf-gallery/2/L2`：PASS hard 9/9 · first-action 0.31s · first3s 1 · feedback p90 66ms · max-chars 12 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS；present play done、3步、6.1秒、5张截图、trace37条、layers7封信、未回执0。
- `node frameworks/gallery/verify.mjs file:///Users/lidechi/orca/workspaces/Zhuzi-claude/ds/runs/shelf-gallery/2/L2/index.html`：PASS；正式产物的拖拽、桌面/窄屏刷新恢复、滚轮、转屏、追问、End到底、收起均通过；数值与上方 dev 自证一致，结构化结果在 `frameworks/gallery/evidence/verification.json`。
- 正式图集截图：`runs/shelf-gallery/2/L2/shots/01-shelf-gallery-enter.png`、`02-shelf-gallery-s0.png`。

- `pnpm bench runs/fifty-years/9/L1`：PASS hard 9/9 · first-action 0.08s · first3s 1 · feedback p90 369ms · max-chars 28 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS。
- 旧作保护：51个文件的相对路径与SHA-256全部等于验收前快照；bench 覆盖的旧报告/curve已恢复原字节，本轮新结果另存 `assets/library/three-look-at-sky/evidence/fifty-years-regression-bench.json`，核对在同目录 `fifty-years-preservation.json`。

任务范围内没有未完成项。animatic只包含关键帧运镜；无首次手势时浏览器可能保持静音；禁用本机存储时不保证跨刷新记忆，这些限制不影响上述验收完成。
