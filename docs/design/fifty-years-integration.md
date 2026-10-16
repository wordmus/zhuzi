# 五十年长卷：从一个人走到下一次来访

玩家以前只能走完《旱》；现在打开 `runs/fifty-years/3/L1/index.html`，能从前356年走到前306年，玩完四个小游戏，再回咖啡厅关门。可复验的小例子：在田伯章点刀币、掂三次，再选竹券；随后 `ledger.json` 里同时出现 `qi-knife-lend` 与田伯的 `history.decision.*`，重开仍保留两条。小游戏里的齐水德是季的思想实验，辨言使用导师回望的后世存世材料，均不宣称是前334年的现场原话。

## 玩家走的路

| 幕 id | 框架 | 发生了什么 |
| --- | --- | --- |
| threshold | vignette | 推门、拿票，保留原咖啡厅入口 |
| chronicle-356 | chronicle | 平陆会盟的消息进入季，长卷开头 |
| reveal | reveal | 显影临淄与东郊 |
| han | walk2d | 原样复用《旱》，禾留下实际承诺 |
| chronicle-334 | chronicle | 途中史事依年触发，徐州相王进入季 |
| ji-speakers | jixia-speakers | 季回望诸家之言，争取递简机会 |
| ji-wude | wude-wheel | 季写下或重辨齐水德设想，回写礼制与民心 |
| chronicle-314 | chronicle | 齐伐燕进入禾，田伯面对征粮压力 |
| tianbo-knife | qi-knife | 田伯亲选开仓、立券、关门，回写粮与民心 |
| bells-rest | bells | 机器与来客回敲休息 |
| chronicle-306 | chronicle | 剩余史事推进至甘茂奔齐，长卷收束 |
| return | vignette | 原样复用盖印、问名、关门；留下小石的线 |

任务书建议前315年放田伯章；已交付的核验年表把齐伐燕定在前314年，因此按 `eras/zhanguo/history.json` 的前314年接入，没有改史料表。十二件史事全部由 `advanceTo` 按年推进，四个转折点通过 `history.enter` 的短句可见进入个体；其他途中事件的进入语句、年份、宏观状态留在 `world.event` trace。历史事实的 day 是距前356年的年数，《旱》仍使用自己的季节和日历。

年表卡有六个时间刻点，旁边直接显示可复验的人物变化：前334年小石高过门闩、前314年禾的杖磨亮且田伯鬓白、前306年小石接杖；后两张卡人物背弯并多一根杖。不用数字报年龄，未改现有《旱》与四个小游戏的绘制或玩法。

## 事实怎样留下

`director/pipeline/fifty-years-runtime.ts` 包装现有框架，只在 `plan.id === 'fifty-years'` 生效。`app/main.ts` 仅增加 import 与注册行；旧意图立即委托原框架，不改旧幕序。`fifty-years-plan.ts` 只负责新意图的十二幕；校验器只增加五个已注册框架名。

`createLongscroll(store)` 是单个长卷的保存边界。`history.save` 一份快照同时保存 `{version,state,ledger,completed,decisions,ending}`；`history.state` 和 `history.ledger` 是可直接查看的副本，恢复以整份快照为准，避免年份与事实分开读取。每新增事实、推进年份、写回决定、完成一幕时保存。旧事实同编号同内容不再追加，同编号内容不同会拒绝改写。

小游戏原样 `ctx.bus.log('world.fact', {fact})`，接线层补缺省的历史 day，再保存和记录同一份事实。史事由 history 生成，接线层补 trace；禾的真实世界事实照收，另追加一条历史决定；季与田伯的写回来自实际 metrics 与事实，不用预演冒充选择。`ctx.handoff.ledger`、`ctx.handoff.world.ledger()` 与 `history.save.ledger` 最终指向同一份合并账本，《旱》模拟内部仍用原先日历与状态。

田伯开仓对应 grain -0.03、minxin +0.06；立券对应 grain -0.02、minxin -0.01、power +0.02；关门对应 grain +0.02、minxin -0.05。季无错推演对应 rites +0.03、minxin +0.02，受驳对应 rites -0.01、minxin +0.02。它们是游戏内的后果设计，不是计量史实；宏观量仍由 history 夹在0到1。

重开时从已存年份、宏观和账本重建 history，fired 由旧账本还原。已完成的故事章续过，入口、首张“接着上次走”的卡与归来仍可操作，已完成的决定不会再写回。恢复时 trace 中 `world.fact` 带 `restored:true` 只是读旧事实，不再次触发 `world.event` 的 history 事件。

## 三层信件怎样验

沿用 app 的真实委托、方案、逐幕提示与演员报告、导师回顾，不另造一套信件。`actorReport` 读取实际 trace 与框架结果；包装器把这一章事实及写回放进返回数据，报告的 did/actual 因而来自这一局真正发生的事。expectedActs 由十二幕真实 plan 提供，全部回执由原 app 处理。

## 给 S6 的接入边界

- 工作室一幕可放在 `fifty-years-plan.ts` 的 return 前，新增框架继续按既有 app 注册方式接入；不要改旧 first-visit/han-act1 的分支。
- 当前长卷对象在 `ctx.handoff.longscroll`，类型 `Longscroll` 导出自 `fifty-years-state.ts`；`history.state()`、`history.enter()`、`ledger()` 都是读副本。
- 新框架事实仍经 `ctx.bus.log('world.fact', {fact})` 交入世界，不自行重写 ledger；给每条新事实独立 id，写 by，text 用实际结果。
- 若工作室要改宏观，调用 `scroll.decide(实际幕id, 人物, 真实决定, delta)`，再逐条 `world.fact` 记录其返回事实；它按幕去重。一幕结束可调用 `scroll.complete(result, ending)` 保存完成状态；新框架入口也要先查 `scroll.completed[act.id]`，有记录就交回该结果并标记 `resumed:true`，这样工作室也能续过已完成幕。
- 保存结构 version=1；勿将《旱》的 day 当作公元前年份，勿修改已交付事实。`history-save.json` 是 present 自动导出的可检查快照。

## 给 S7 的验证入口

运行 `pnpm tsx director/pipeline/fifty-years.test.ts`。它先逐条检查正式产物，再用该次真实的 state 和 ledger 重建 history，最后把同一份存档装进真实网页并玩第二次来访；检查没有重复 history 事件、没有再启动已完成小游戏、旧事实逐字相同、仍能追加新事实、来访数为2、layers 检查为空。它不更改 runs，也不降低 bench 门槛。

浏览器直接打开 `runs/fifty-years/3/L1/index.html` 可以离线玩；本机允许 localStorage 时关页再开会续接。开发入口由 `pnpm present` 构建意图选择，不另加游戏的独立入口。产物内 `plan.json` 看幕序、`layers.json` 看提示与报告、`ledger.json` 看事实、`history-save.json` 看存档、`trace.jsonl` 看过程，`shots/` 看每幕截图。

## 验收记录

| 命令 | 结果 |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm present --intent intents/fifty-years.json --tier L1 --seed 3` | exit 0；done，62步，141.5秒，37截图，1059条trace，0错误，63条事实 |
| `pnpm bench runs/fifty-years/3/L1` | exit 0；PASS hard 9/9，layers/notext/repro全通过，0错误，fps-p5 60 |
| `pnpm bench runs/first-visit/7/L1` | exit 0；PASS hard 9/9，layers/notext/repro全通过 |
| `pnpm present --intent intents/han-act1.json --tier L1 --seed 3 && pnpm bench runs/han-act1/3/L1` | exit 0；重新构建后done，PASS hard 9/9，layers/notext/repro全通过 |
| `pnpm tsx director/pipeline/fifty-years.test.ts` | exit 0；真实产物断言、state重建、只增账本、实际网页第二次来访均通过 |
| `pnpm tsx engine/history/history.test.ts` | exit 0；原历史模块全部检查通过 |

最终长卷 `layers.json`：commission=1、plan=1、cue=15、report=15、retro=1，共33封，无缺回执，check=[]。账本包含12件史事、3条历史决定与四游戏事实，所有63条均与trace逐条相同，史事首尾跨度50年。

`runs/fifty-years/3/L1/` 由 present/bench 自动生成：`plan.json`、`index.html`、`build/index.html`、`shots/`（37张）、`trace.jsonl`、`ledger.json`、`layers.json`、`history-save.json`、`report.json`，另有 `bench.json` 与 `curve.csv`。没有手改产物。

## 当前边界

- 一幕中途退出会重进这一幕，没有保存光标、走路位置或半局答题；已完成幕与史事不会重演。
- 本机不允许 localStorage 时沿用引擎的内存退路，本页可继续，关页不能长期续存；没有跨设备同步。
- 角色老化用章开场卡的轮廓与细节表现，四个小游戏内部造型与原《旱》不变；未做逐年角色动画。
- 四个转折点可见，其余途中事件只逐年写入世界、账本与 trace，没有为十二件史事各做独立可玩章。
- 保存从整份 `history.save` 恢复；单独复制 `history.state` 而丢掉账本不能还原旧事实。验证脚本明确把 state 与原账本一起恢复。

长卷最终 bench：first-action 0.03s、first3s 1、feedback p90 327ms、max-chars 29、errors 0、fps-p5 60；notext/repro/layers 全部 PASS。两份旧流程同为 PASS hard 9/9，未改 bench 判定、门槛或 critic，也未手改 runs。
