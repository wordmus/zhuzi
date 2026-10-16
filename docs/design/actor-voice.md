# 演员自己回话

原来报告只有 did、误差和事实。现在报告另带 `voice`：演员用自己的口气说两到三句，每句至多十八字。

打开新工作室，接住报告竹简，同一处文字会逐句换成演员的话。打开新长卷，点章节的向下记号，收尾只留一句演员自己的话；长卷没有 verify-entry 的折叠豁免，因此其余话只存进同一演员报告的 `layers.json` payload，不在主屏展开。

声音证据只取已经发生的 did / error / seeds / facts。导演的 expects 和 predicted 不进生成器；收信、复核编号、提示统计不当作世界行动。没有自己的行动记录，首句固定明说“这一幕我没动手。”，即使本幕发生了别人的事。说过的话只引用自己的原证词，长引文标省略；交付事实用“我记下”保留见闻身份，不改写成“我做了”。误差大于报告已有 eps 才说料偏；只有误差记录而无可判大小时只说对照过所料与实情。种子只声称心里留着，不声称已经做成。

禾、田伯、季、桑、小石各有一套口气，放在 `engine/world/lines.ts` 的 ACTOR_VOICE。纯函数 `actorVoice` 不调用模型、不抽随机数、不修改输入；禁词或数字的原文不引用，已有证据仍留在原字段供核对。新增的报告朗读带 actorVoice / actor-report 标记，不反向计为下一份报告的行动证据。

工作室保留原实际台词、信件 kind、原接件动作、回执位置与 director.compare；接件之后才读声音。每句话独立发 line.say，保持完整字数统计，画面从首字起每五十五毫秒继续显字，同一焦点最多一句。长卷原章节台词保持原样，点击收尾时替换为首句并停留片刻。

目前不支持把长卷其余句子点开：全文在报告 payload。声音是可核对的短证词，不额外编一段角色心理，也不会替没有行动的演员邀功。

验收记录与真实 trace 引用见下方完成记录。

## 三个可复验实例

1. 禾的“我说过：社公在上，种粟献你。”来自 `runs/studio/7/L1/trace.jsonl:363` 的真实 `line.say`：`who=禾, text=社公在上，种粟献你。`；接简后的逐句日志在同文件 `:420`，`field=voice, letter=report:studio:1, chars=14`。
2. 同份报告的“我记下：禾献了种粟。”来自同文件 `:367` 的 `world.fact`：`id=f39, kind=delivery, text=《旱》交付：禾献了种粟。雨没来，人都来了。`。声音只摘已有第一句，去掉交付包装，不增写雨或人；朗读日志在 `:421`，`chars=10`。
3. 空局工作室的“这一幕我没动手。”来自 `runs/studio/7/L1/voice-evidence/no-action.trace.jsonl:22` 的实际报告：`did=[禾已接收提示信,复核原件：cue:studio:1], facts=[]`，没有借用任何旧演出。`:32` 是这句八字声音自己的 `line.say`；此独立页的五种信件与回执亦通过正式 `checkLayerLetters`，不是改写生产轨迹来造无行动图。

## 画面与点击验证

四张截图位于 `runs/studio/7/L1/voice-evidence/`：

| 画面 | 文件 | 怎样重看 |
| --- | --- | --- |
| 接简后禾自己的话 | `studio-actor-first.png` | 打开 studio/7，接住最后的报告竹简 |
| 长卷每章收尾只一句 | `chronicle-actor-first.png` | 打开 fifty-years/11，点第一章向下记号 |
| 空局承认没动手 | `studio-no-action.png` | dev 服务打开 `/frameworks/studio/no-action.html`，拿委托、盖印、接简 |
| 旧版仍是实际摘录 | `studio-old-report.png` | 与第一张并排；旧 studio/5 的实际字段保持原样 |

复拍：先 `pnpm dev --host 127.0.0.1 --port 5188`，再 `pnpm exec tsx frameworks/studio/capture-voice.ts`。复核报告与朗读一致性：`pnpm exec tsx frameworks/studio/verify-voice.ts`。

## 验收范围与旧产物保护

类型检查通过；`node --test engine/layers/voice.test.ts` 四项通过；正式集成核对通过两局二十九份报告及空局工作室的真实信件。

`bench` 会在目标目录写 `bench.json` 和 `curve.csv`。为遵守不改旧产物，本工旧局命令从 `/tmp/gap-actors-regression` 执行，目标为原目录逐字节副本，评分脚本与门槛仍来自本仓库；原目录每个文件的 SHA256 清单保存在 `voice-evidence/old-sha-before.json`，完成时再逐文件核对。旧长卷的同路径复测也与 GAP-DESK 工协调共享其正式结果，避免同时开浏览器压低帧率。
