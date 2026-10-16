# 呈现留下的短简

以前，取舍只留在方案和日志，呈现自己没有回话。现在每一幕有一封 `presence`：`presentation → director`，用原来的信件队列发送、记录两个 trace 快照并回执，最后进入 `layers.json`。原五类信的发送位置和回执时刻不移动。

打开 `runs/desk/17/L1/index.html`，依次拿起票根、看导师、看架上，再抽一件作品。帛条右下会多一截短简，主屏只留下「我只为这一卷开门。」；点击短简看全文。打开 `runs/studio/9/L1/index.html`，接住报告、听完演员的话以后，呈现把短简放到案右下；这一刻才换成「我把回报留在案上。」。可用鼠标或键盘拿起短简；全文可按 Escape 或点右下无字的方印合上。

## 信从哪里来

`Presence` 的四个字段：

- `shape`：这一幕的形实际怎样交付。抽卷引用 `desk.work.open`，接报告引用 `director.compare`；其它幕只说该形已实现的规则，不把 `predict` 的预演写成事实。
- `withheld`：只逐项复制本幕 `PlanAct.withhold` 的非空记录。字段不存在、空数组或全为空白时，payload 连这个键都没有；全文里也没有这一栏。
- `cost`：该形的交付约束。例如入口作品必须去另一页看，工作室必须等前一件信物交接。
- `sentence`：以「我」开头的短自述，按 Unicode 字符计数不超过十八字，不含数字和字段名。

取材函数在 `frameworks/desk/presence-letter.ts`，不访问 DOM；这里同时存放各形的既有规则口气，避免扩展其它工人的 framework 文件。`engine/layers/bus.ts` 只新增呈现这一条回路：监听真实 `act.exit`，按方案找到这一幕并交回导演；入口抽卷和工作室放简可以提前在动作完成后交信。按幕去重，因此随后的 `act.exit` 不会再发第二封。绘画与折页在 `frameworks/desk/presence.ts`，色板沿用 `components/paint`；「言」未收录时明确画空框。

统一检查继续认可只有五类信的旧成品，避免把旧作品误判为坏档案；一旦存在呈现信，就检查方案里的每幕恰有一封，并沿用通用回执、时序、幕引用检查，另查呈现收发层与短自述。缺了一幕、重复发信或漏回执会失败。

## 可复验的小例子

`node frameworks/desk/verify-presence.mjs` 会拿同一份入口方案，在浏览器里删掉全部 `withhold` 记录，再走一遍抽卷动作。短简仍出现，但全文只有 `shape / cost / sentence` 三栏；检查用 `Object.hasOwn(payload, 'withheld') === false`，不以空数组冒充缺席。保存于 `runs/desk/17/L1/presence-evidence/no-record.layers.json` 和 `no-record-no-withheld.png`。

五项检查覆盖逐幕信件和回执、自述字数与口气、缺记录时键和画面同时缺席、两处实物短简及主屏字数、控制台零报错。入口原有两份验证器默认指向新 seed 17，截图及验证结果只写新目录；可用 `DESK_VERIFY_RUN` 指定其它待检 run。

## 验收与证据

验收命令、原样汇总、截图、真实 trace 行号、输出隔离及 SHA 对照在 `runs/desk/17/L1/presence-acceptance.md`。新产物是 desk/17 与 studio/9；旧版同机位只读 desk/13，不重建旧作品。

## 诚实的边界

这轮没有替旧 run 补信，也没有重写旧演员报告。单独双击旧 HTML 仍是旧体验；要看短简请开上面的新 run。各形的规则自述不是模型即兴写作，未实现逐镜头自动推导；没有记录就不捏造具体的镜头时间、角色行动或被舍弃的东西。全文属于主动展开的折页，单独检查其字段；主屏三十字口径不把折页算进去。
