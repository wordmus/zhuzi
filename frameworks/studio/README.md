# 案上回信

以前三层信件只能在面板里查；现在玩家在咖啡厅拿起这次委托、替叔衡盖收件印，看提示飞到演员板，再接住演员这一局的真实回报。打开 `runs/studio/2/L1/index.html`，走完《旱》后即可看见；在 `runs/fifty-years/3/L1/index.html` 中，它位于前306年卡之后、归来关门之前。

可复验的小例子：报告竹简若写“预演：给粟；实际：拒绝”，反引号面板里找到 `studio` 的报告，再沿提示 `initialState.sourceReport` 回到 `han` 报告，两份 `actual` 与 `error` 应逐字相同。竹简下的淡虚线只在原件确实带 `error` 时出现，接住之后才有导演的真实回执。

## 看与做的顺序

| 焦点 | 眼前的物件 | 真实数据 | 玩家动作与反馈 |
| --- | --- | --- | --- |
| 导师写委托 | 帛轴、笔、预算灯 | 本次 Commission.why / budget.lamp | 拿起委托；同一帧换到叔衡的案 |
| 叔衡读并盖印 | 逐条钉下的方案、手边大印 | DirectorAck.acts，每幕一条；rehearsal.expect 的18字以内摘录 | 盖印；立即落朱印，调用 receive，然后发送真实 plan |
| 提示飞向演员 | 禾、季、田伯三块小像，收件者的灯 | 新 ActorCue；sourceAct / sourceReport / sourceCue 指向原局 | 只看；提示抵达的那一帧调用 receive 并亮灯 |
| 报告返回 | 有绳束的竹简、误差淡痕 | ActorReport.actual / error；来自原局报告原文 | 接住；同帧调用 receive，添回执印，然后压成一册移入架 |

所有玩家动作由 `ctx.aff.add()` 注册，可点、触或按 Enter。每时刻只有一个动作；进入工作室3.1秒后才允许盖印。每屏唯一一句摘录不超过18字，板上只有四字人名；幕名以图形呈现，不叠成长字串。长字段只作带省略号的原文摘录，全文保留在信和 trace 的 fullText，不能把截断的显示当成完整报告。

工作室沿用 `vignette/scene.ts` 的原咖啡厅绘制：座位、导师和门坐标不动；工作案放在左侧。独立 `studio` 意图为 threshold → reveal → han → studio → return；长卷为 chronicle-306 → studio → return，其他幕顺序不变。

## 为什么另发一轮信

启动器在进第一幕之前已收过最初的 commission/plan；那些首次回执不可改写。工作室把本次 Commission 重新交给叔衡复核，因此产生第二封真实委托，拿起时仍未收件，盖印时才得到新的回执。新的方案包含本次全幕序；新提示要求演员交回原局报告，报告指向原局证据，不声称又发生一遍《旱》。启动器也照常生成工作室自身的演员提示和结束报告；这两组不是互相覆盖的样品。

选原件顺序为《旱》中带真实误差的报告、禾的《旱》报告、其他禾/季/田伯报告。正常两个意图都先玩《旱》，不预填演员的实际。若在没有既有演出的自测上下文运行，它也会发真委托、方案与提示，演员灯收到后只回“接过了提示信”，不制造一条拒绝或误差；完整来访的 retro 仍由启动器收场发送。

## 账本与续接

`world.fact` 留下叔衡实际收件和核对的事实。在长卷里经原接线进入同一只增账本；`longscroll.decide` 用真实收件结果写回，宏观 delta 为空，不捏造丰收或民心变化。结束调用 complete；入口检查 completed，已完成工作室直接续过，不重发复核轮、不重复加事实。中途退出会从本幕开头重来，不保存半盖下的印。

## 产物与验收

运行 `pnpm present --intent intents/studio.json --tier L1 --seed 2` 后，四个焦点在 `runs/studio/2/L1/shots/*-studio-*.png`，真实信件在 `layers.json`，收件与发送时刻在 `trace.jsonl`，事实在 `ledger.json`。字数同时由 DOM 采样与 trace 检查；不依靠画布藏长句。`pnpm bench runs/studio/2/L1` 与 `pnpm bench runs/fifty-years/3/L1` 应都为 hard 9/9，含 layers。

边界：这幕复核已经发生的决定，不让演员重新选择；未接实时模型。无旧演出时只演收件，不支持凭空展示戏剧误差；长卷只保存完成后的整幕状态，不支持跨设备存档。

## S6 正式交付记录（2026-10-15）

| 验收命令 | 最终结果 |
| --- | --- |
| `pnpm typecheck` | exit 0，tsc --noEmit 通过 |
| `pnpm present --intent intents/studio.json --tier L1 --seed 2` | exit 0；done，37步，87.5秒，17截图，503条trace，0错误，45条事实；25封信，未回执0，check=[] |
| `pnpm bench runs/studio/2/L1` | exit 0；PASS hard 9/9，first-action 0.04s、first3s 1、feedback p90 328ms、max-chars 28、errors 0、fps-p5 60；notext/repro/layers全PASS |
| `pnpm present --intent intents/fifty-years.json --tier L1 --seed 3` | exit 0；插入工作室后为13幕，done，65步，151.9秒，41截图，1104条trace，0错误，66条事实；43封信，未回执0，check=[] |
| `pnpm bench runs/fifty-years/3/L1` | exit 0；PASS hard 9/9，first-action 0.04s、first3s 1、feedback p90 318ms、max-chars 29、errors 0、fps-p5 60；notext/repro/layers全PASS |
| `pnpm tsx frameworks/studio/verify.ts` | exit 0；两份正式产物的原件来源、actual/error/facts逐字相同、先点击后回执、四焦点截图、幕内句子≤18字均通过 |
| `pnpm tsx director/pipeline/fifty-years.test.ts` | exit 0；12件史事跨50年、旧账本逐字相同、实际网页第二次来访与layers=[]均通过，工作室没有重复写入 |
| `pnpm bench runs/first-visit/7/L1` | 条件项未触发：未改first-visit编排或其框架行为，因此未重复运行 |

正式产物都由 present/bench 生成：`runs/studio/2/L1/` 与 `runs/fifty-years/3/L1/` 内的 index.html、build/index.html、plan.json、layers.json、ledger.json、trace.jsonl、report.json、shots/；长卷另有 history-save.json；bench.json 与 curve.csv 是评分产物，没有手改。

工作室四焦点截图：独立试玩的 `09-studio-enter.png`（委托）、`10-studio-s31.png`（方案）、`11-studio-s32.png`（演员板）、`12-studio-s33.png`（报告）；长卷对应 `33-studio-enter.png`、`34-studio-s59.png`、`35-studio-s60.png`、`36-studio-s61.png`。已实际查看，导师与叔衡都露在案旁，句子至多18字，加两个人名至多22字，演员板共8字。

这次独立试玩的真实回报是“预演：借粟；实际：给粟”，长卷则是“预演：借粟；实际：拒绝”。两份都沿 sourceReport 找得到原局原件，没有把任务书中的例句写死。长卷工作室完成后，`history-save.json` 同时含 completed.studio 与 decisions 中的 studio。

未做的部分：未接实时模型、未保存半幕光标、未做跨设备存档；没有既有演出时只展示真实收件，不编造一场演员偏离。bench判定与门槛、critic、四个小游戏与engine/layers行为均未改，未运行git操作。
