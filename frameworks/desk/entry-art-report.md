# ENTRY-ART 交付记录

原来四层已经能展开和退回，但石板青、悬浮纸片和文字按钮看起来仍像原型。现在四层及导师抽屉都换成黑漆、朱金、帛、青铜与木架场景，入口动作由票根、竹简、漆门、铜符和帛条承担。结构、既有按键、前三秒唯一动作、真实导师纠正与作品新页路径保持原样。

可复验：通过项目根 HTTP 服务打开 `/runs/desk/9/L1/index.html`，悬停票根会抬起且灯焰增强；点票根→竹简→右缘门→中央亮帛条，作品在新标签页打开；每层的左缘铜符退回一级。右缘书签打开可键盘操作的导师明细，把第一条改成「我更想看人物如何改变环境」，提交再刷新，真实 `commission().why` 仍引用纠正。

| 层 | 动作物件 | 焦点靠什么 |
| --- | --- | --- |
| L0 | 朱边「旱」票根；Enter同一动作 | 灯照票根、漆案反光；悬停抬起票根并增强灯焰 |
| L1 | 竹简进入；伸出的空帛端/向下键轮听三句；铜符退回 | 导师深衣侧影抬头与视线、灯照空白竹简；不确定时只留墨痕 |
| L2 | 右缘漆门进入作品架；铜符退回 | 导师转向双案、中央吊灯、胶片/叠帛/线格方体/棋盘毛坯；不写状态标签 |
| L3 | 中央亮帛条抽出进入；右侧暗帛条/向下键换件；铜符退回 | 一件亮、其余暗；抬起时右门透光；朱印/麻绳来自真实sealed |
| 抽屉 | 右缘书签；Tab/Enter纠正；Escape收起 | 黑漆底、细金线、帛色输入条；只有导师明细 |

题字为原创单线程序路径，当前索引全部题字已覆盖；已有「旱/禾」复用paint篆意路径。新物件recipe：`assets/library/desk/recipe.json`；画具：`assets/library/desk/paint.ts`；场景：`frameworks/desk/scene.ts`。当前件标题≤6字，周围帛条每件≤2字，台词一次≤18字，避免画布题字也挤破主屏30字限制。

## 实测命令

完整stdout见同目录 `evidence/entry-art-acceptance.log`；结构化验证见 `runs/desk/9/L1/entry-verification.json`；desk评分见 `runs/desk/9/L1/bench.json`；旧作本次评分见 `evidence/fifty-years-regression.json`。

## 截图（14张）

- `runs/desk/9/L1/shots/entry-wide-L0.png`
- `runs/desk/9/L1/shots/entry-wide-L1.png`
- `runs/desk/9/L1/shots/entry-wide-L2.png`
- `runs/desk/9/L1/shots/entry-wide-L3.png`
- `runs/desk/9/L1/shots/entry-wide-drawer.png`
- `runs/desk/9/L1/shots/entry-narrow-L0.png`
- `runs/desk/9/L1/shots/entry-narrow-L1.png`
- `runs/desk/9/L1/shots/entry-narrow-L2.png`
- `runs/desk/9/L1/shots/entry-narrow-L3.png`
- `runs/desk/9/L1/shots/entry-narrow-drawer.png`
- `runs/desk/9/L1/shots/entry-four-layers-comparison.png`（四次独立屏幕，仅验收并置）
- `runs/desk/9/L1/shots/entry-art-before-after-L0.png`（同为1280×720原始画面）
- `runs/desk/9/L1/shots/entry-art-before-after-all.png`（L0/L1/L2/L3/抽屉五处同机位前后对比）
- `runs/desk/9/L1/shots/entry-wide-L0-ticket-lift.png`（票根抬起、灯焰更亮）

旧图保持原样：`runs/desk/7/L1/shots/entry-wide-{L0,L1,L2,L3,drawer}.png`。两张新旧并置图直接读取这些旧图与本轮截图，没有重画「旧版」。

## 边界与未支持情况

本次没有更改四层协议、台词数据、纠正存储、commission、索引语义或新标签页路径；没有新增灯油操作。L1沿用原有空帛端/向下键逐句轮听，不自动前往下一层；未收录的未来新标题字显示空字框，完整标题保留在DOM读屏标签和title属性中。原有的构建时索引快照、需要根目录HTTP服务打开相邻作品、缺真实URL不开门、无跨设备记忆同步等边界保留。


## 2026-10-16 本轮验收结果

| 命令 | 结果 |
| --- | --- |
| `pnpm typecheck` | PASS · tsc --noEmit exit 0 |
| `pnpm present --intent intents/desk.json --tier L1 --seed 9` | valid errors 0 / warnings 0；play done 4步 / 12.6s / errors 0；11封信，未回执0 |
| `pnpm bench runs/desk/9/L1` | **PASS hard 9/9 · first-action 0.35s · first3s 1 · feedback p90 130ms · max-chars 15 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS** |
| `pnpm bench runs/fifty-years/9/L1` | **PASS hard 9/9 · first-action 0.07s · first3s 1 · feedback p90 434ms · max-chars 28 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS** |
| `node frameworks/desk/verify-entry.mjs` | **ENTRY PASS** · wide/narrow、四层不同屏、双向逐层、纠正改变真实commission并重载保留、历史设置保留、键盘提交、新页200、缺索引、layers、console errors 0；另加四层动作无可见文字断言 |

主屏DOM/台词最大15字；抽屉展开整页wide 121字、narrow 169字，导师明细不计主屏。14张验收图均已生成，五处同机位对比另见 `runs/desk/9/L1/shots/entry-art-before-after-all.png`。旧作回归评分另存后，既有fifty-years的51个文件逐字节复验一致；bench生成的全局产物恢复原值，保留并发无关历史行；未改bench判定、门槛、critic、旧run或runs/index.json，未操作git。

未完成的必需验收项：无；未来新标题未收录的字形留空框，需要补刻字形，原始完整标题始终保留。
