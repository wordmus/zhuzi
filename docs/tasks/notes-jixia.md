# S3 交付：季的两个稷下小游戏

以前只有任务书，还不能点进稷下辨言或转盘；现在开简后能玩完五轮辨言与三轮五德，答对、答错都会留下季自己的事实。直接打开两个构建页即可验证：`dist-jixia-speakers/dev/jixia-speakers.html`、`dist-wude-wheel/dev/wude-wheel.html`。本波不接主注册表、不改历史章，齐水德保留为季的思想实验；这两处接线由下一波整合。

## 接入用文件

- `frameworks/jixia-speakers/index.ts`：导出 `jixiaSpeakers`。
- `frameworks/wude-wheel/index.ts`：导出 `wudeWheel`。
- 两目录各有 `logic.ts`、`logic.test.ts`、`README.md`（元素/动作/出口/事实/史源/建议历史章）。
- `frameworks/jixia-speakers/surface.ts`：两游戏复用的漆面、开简、短句和可见反馈；不需要新增共享组件。
- `frameworks/jixia-speakers/dev-boot.ts`：单幕假器官，使用真实 LayerBus、actorReport、导师回顾，只运行一个框架；无模型调用。
- `dev/jixia-speakers.html`、`dev/jixia-speakers.ts`、`dev/wude-wheel.html`、`dev/wude-wheel.ts`：单幕自测入口。
- `frameworks/jixia-speakers/interaction.check.ts`：小规模真实浏览器检查，覆盖全对/全错、错选重试、三轮拖动、键盘和竖屏。
- 两框架目录各留 `desktop.png` 与 `mobile.png`，供查看实际画面；原始 bench 报告在 `runs/_bench/jixia-speakers/bench.json` 和 `runs/_bench/wude-wheel/bench.json`。

所有手写文件都在 s3 独占范围；没有手改 engine、app、components、director、bench、intents、注册表，没有 git 操作、安装依赖或删除文件。

## 可复验小例子

五德开简后按 4、2、5（金、火、水），或把握柄分别拖到这三格：`window.__zhuzi.result.data.metrics` 应有 `mistakes:0, firstTry:3, perfect:1`。第一轮先点木再点金，其余两轮正确，应有 `attempts:4, mistakes:1, firstTry:2`，事实 id 为 `wude-wheel-challenged`。辨言按题目出处连续答对五题，应为 `correct:5, maxStreak:5, seeds:0`；全错应为 `correct:0, seeds:5`，五轮仍会结束。

两页完成时 `window.__zhuzi.done=true`，`result.data` 包含 `facts/metrics/line`；`window.__trace` 包含各游戏 `start/step/choice/end` 与 `world.fact`。`window.__zhuzi.layers.letters()` 能读到委托、方案、季提示、真实结果报告、回顾五封信，全部已回执；报告 actual 来自本次游戏实际事实。

## 验收命令

协调者已更正 Vite 输出路径（消息 msg_37f4bd814f8a / msg_11bbf9dbd0d4）：入口在 `dev/`，产物也保留 `dev/`，直接交给 bench，不需复制。早期排查时复制过 index 副本，之后构建已重建输出；以以下命令和原始 dev 路径报告为准。

```sh
pnpm typecheck
ZHUZI_ENTRY=dev/jixia-speakers.html ZHUZI_OUT=dist-jixia-speakers npx vite build && pnpm bench dist-jixia-speakers/dev/jixia-speakers.html
ZHUZI_ENTRY=dev/wude-wheel.html ZHUZI_OUT=dist-wude-wheel npx vite build && pnpm bench dist-wude-wheel/dev/wude-wheel.html
npx tsx frameworks/jixia-speakers/logic.test.ts && npx tsx frameworks/wude-wheel/logic.test.ts
npx tsx frameworks/jixia-speakers/interaction.check.ts
```

## 史源与未支持的情况

辨言引用清单：儒《论语·卫灵公》15.24“己所不欲，勿施于人”；道《老子》第一章“道可道，非常道”；法《韩非子·有度》“法不阿贵，绳不挠曲”；墨《墨子·兼爱中》“兼相爱，交相利”；名《公孙龙子·白马论》“白马非马”；阴阳命题取《吕氏春秋·应同》“代火者必将水”。每句的链接和归派理由在 jixia-speakers/README.md，句子转简体、加现代标点；不编造古语。

五德相胜取《吕氏春秋·应同》夏木、商金、周火及火后水；秦后来依周火而自居水德参《史记·秦始皇本纪》，邹衍与稷下环境参《史记·孟子荀卿列传》《田敬仲完世家》。齐为水德是季的推演，绝不记成齐国已受水德之命；“邹子”短句是游戏剧本，非邹衍原文。《吕氏春秋》是杂家汇编，只把该段五德命题判作阴阳，不把整书改归阴阳家。

建议历史章：辨言放前 317 孟子至齐的导师回望插幕、错题事实供前 315 伐燕之议重掂；五德放前 334 徐州相王后的思想插幕，供前 315 或前 306 章对照政治现实。传世《韩非子》《吕氏春秋》成书晚于这些章节，不支持把全部题句当作前 317 当堂逐字实录；若整合者坚持严格同时代台词，需要另立早期语录包并复核来源。

屏幕删字测试只证明可操作并完成，不证明玩家读懂被藏掉的题目，也不证明天命学说为真。结束时保留静态画面并停止按钮/帧回调；下一幕如需显式清场，分别移除 `<framework-id>` 与 `<framework-id>-ground` 两个画层。

共享类型 `Bus.TraceKind` 暂未列小游戏节点；本波以局部类型收窄记录真实字符串，没有越界改总线。整合者日后可统一增补这八个节点类型。首次声音初始化原来会同步卡住第一帧，已改为让开简与亮光先画出来、250ms 后再初始化声音；100ms 的目标看下方实际探针，不能把 hard PASS 自动当作所有样本都在 100ms 内。

## 最终验收证据

`pnpm typecheck`：PASS，退出码 0。两次 Vite build：PASS，入口为上述 dev 路径，单文件可离线打开。

```text
jixia-speakers: PASS hard 9/9 · first-action 0.12s · first3s 1 · feedback p90 65ms · max-chars 17 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS
反馈探针 <=100ms 比例：100%；三层信件 5 封、未回执 0、check=[]。
wude-wheel: PASS hard 9/9 · first-action 0.04s · first3s 1 · feedback p90 35ms · max-chars 15 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS
反馈探针 <=100ms 比例：100%；三层信件 5 封、未回执 0、check=[]。
PASS jixia-speakers：六派史源、五题复现、错题留种、连对与六成门槛
PASS wude-wheel：五德相胜、夏商周三轮、错选重试、重复防抖、拖动五向
```

浏览器额外检查：辨言全对/全错、五德错选重试/三轮拖动、键盘/390×844 竖屏、退出按钮清理、五封回信均 PASS；截图见两个框架目录。严格的主线导演注册、历史章挂载、历史事实入世界账本留给整合波；本波已交付独立可玩框架及其事实出口。
