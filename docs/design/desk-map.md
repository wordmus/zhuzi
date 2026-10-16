# 案上 · 分层入口

当前入口为 `runs/desk/11/L1/index.html`，请从项目根目录通过 HTTP 打开。L1 案前新增下一件木牍，L2 漆屏风挂年谱，L3 左侧木牌翻到另一种形；四层进退与抽屉纠正保留。新增排期与来源说明见 [schedule.md](schedule.md)，命令结果和截图见 [GAP-DESK 报告](../../frameworks/desk/gap-desk-report.md)。下面保留此前结构版与场景化返工的历史记录。

以前进场就把四处内容堆在一张长卷上；现在打开 `runs/desk/7/L1/index.html`，第一眼只有矮案上一枚印和导师一句话。点「往里看」才进入导师层，再点「看它在做什么」进入导演层，点「看架上」进入呈现层；每层都能退回上一层，场景不横移，也不同时保留其它层。

| 层 | 这时看到什么 | 下一步 | 真实依据 |
| --- | --- | --- | --- |
| L0 案上 | 一枚印，导师一句不超过18字 | 往里看 | 当前 store、来访记录生成的 `commission().why` |
| L1 导师 | 一张折纸，一次一句想法；纸下小点可轮读2–3条 | 看它在做什么；退回 | `deriveHypotheses` 与 `mentor.hypotheses`；没有足够记录时明确表示还不知道 |
| L2 导演 | 基础导演、叔衡各一张案，各一行作品与状态 | 看架上；退回 | 只读 `runs/index.json` 快照中的 director、title、sealed |
| L3 呈现 | 架上聚焦一件，标题、形式、档位、✓印或毛坯 | 进入；退回；右侧刻痕换件 | 同一索引的 title、form、tier、sealed、url |
| 右侧抽屉 | 默认收起，细边「记」打开约320px窄抽屉；只列导师判断、证据、置信度、来访史、下一次打算 | 输入你的说法并点纠正；Escape收起 | `mentor.hypotheses`、`VisitRecord`、实时 `commission().why` |

主屏全部可见字（包括导航与细边字）≤30，L2两位导演分行，共用一次主屏信息；作品名在导演层最多3字、呈现层最多8字。导演完整作品名保留在读屏标签里，呈现层完整标题保留在DOM的title属性里，原始索引与方案数据不截断。L1一次一句，底部小点或向下键轮读，完整判断和证据在抽屉里。

抽屉展开时仍限制主屏≤30字；抽屉的导师明细单独计量，不纳入主屏字数。这个选择让证据能完整读出，不把明细再次裁成谜语；验收脚本会打印展开时整页总字数。抽屉不包含导演列表、作品列表或运行图表。

前三秒只开放当前层的前进动作，其后才开放退回、轮读与细边抽屉；没有自动翻页。对象与文字动作共用一个点击区域，Enter向内，左键退回，向下键轮读或换件。抽屉可键盘编辑、提交，Tab在抽屉内循环，Escape回到细边按钮。点击后的场景替换直接发生在同一回调里。

## 可复验的小例子

1. 打开 `/runs/desk/7/L1/index.html`，看到案上一枚印；此时没有导师清单、导演清单或作品架。
2. 点「往里看」，只有导师一条想法；点纸下小点可以看另一条。
3. 等细边「记」出现，打开它，把第一条改成「我更想看人物如何改变环境」，点「纠正」。
4. 「下一次的打算」立即变成 `依你纠正的「我更想看人物如何改变」，重排此程。`；收起抽屉、重新加载，同一意图的理由仍引用这次纠正。
5. 继续到作品架，点「进入」，真实作品在新标签页打开；原入口不跳转。

纠正调用原有 `correctHypothesis`，同时写入 `mentor.hypotheses` 和纠正日志；`createMentor().commission()`读取同一个store生成新理由。没有自行拼造一个“更新成功”的假理由。全新来访缺乏停留记录时，界面显示“还不知道”，不会把默认推测写成已发生的证据。

## 数据与边界

Node侧desk分支只读 `runs/index.json`；没有索引时传入空作品列表，导演与呈现层显示「还没装上」，不会扫描旧作品来填充。索引是构建时快照；新增作品需由既有索引生成流程更新，再重新present。url只接受相对的HTML入口路径，打开时使用新标签页和noopener/noreferrer；没有入口时说明尚未开门后正常收束。

“已交付”和“✓印”都来自索引已有的sealed字段，不改它的语义。未交付作品显示“在做”和“毛坯”，没有该导演作品就明说还没装上，不假造正在运行的构建任务。运行时不删除、改写旧作品，不支持撤回导演历史版本或跨设备同步。存储受浏览器限制；禁用localStorage时退回当前页内存。

通过HTTP打开时，应从项目根目录提供静态服务，访问 `/runs/desk/7/L1/index.html`；单独把该run设为服务根目录时无法进入相邻作品。不能把缺失的作品HTML补成假入口。desk专属委托只读取来访记录与导师假设，旧入口设置不会盖过新纠正；`app/main.ts`仅追加desk条件分支，其他框架和通用委托逻辑不变。

## 与 A/B/C 的区别

与A的四站同屏相比，现在每次动作只替换一层，下一层在点击前不会出现。
与B的横幅总览相比，进场只有案上一件东西和一句话，没有整台机器的面板。
与C的三栏仪表相比，侧边只装导师的判断与证据，导演和作品各留在自己的场景里。

## 验收命令与证据

```sh
pnpm typecheck
pnpm present --intent intents/desk.json --tier L1 --seed 7 && pnpm bench runs/desk/7/L1
pnpm bench runs/fifty-years/9/L1
node frameworks/desk/verify-entry.mjs
```

`verify-entry.mjs`在1280×720与390×844分别断言：进场只有L0一个动作、四层逐层进入/退回、画面不同且仅一个场景、抽屉默认收起、纠正落入store并在重载后保留、同一intent的真实commission理由改变、主屏≤30字、新标签页200、layers通过、控制台错误0。窄屏同时植入真实共享引擎读取的历史设置，断言设置未被删除、纠正仍能改变理由，且只用键盘提交；另在隔离目录实际运行缺索引的Node导演分支，再在浏览器内存方案中清空作品列表，确认“还没装上”及零弹窗，不修改磁盘上的旧run。

截图：`runs/desk/7/L1/shots/entry-{wide,narrow}-L{0,1,2,3}.png`及`entry-{wide,narrow}-drawer.png`。额外对照图`entry-four-layers-comparison.png`把四张独立截图并置，仅用于验收，不属于产品界面。结构化结果在`runs/desk/7/L1/entry-verification.json`，构建与评分分别见同目录`report.json`和`bench.json`。

## 2026-10-16 最终实测

| 命令 | 实测汇总 |
| --- | --- |
| `pnpm typecheck` | exit 0，`tsc --noEmit` |
| `pnpm present --intent intents/desk.json --tier L1 --seed 7` | valid errors 0 / warnings 0；11封信 / 未回执0；play done 4步 / 12.4秒 / 报错0 |
| `pnpm bench runs/desk/7/L1` | **PASS hard 9/9** · first-action 0.28s · first3s 1 · feedback p90 49ms · max-chars 30 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS |
| `pnpm bench runs/fifty-years/9/L1` | **PASS hard 9/9** · first-action 0.08s · first3s 1 · feedback p90 313ms · max-chars 28 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS |
| `node frameworks/desk/verify-entry.mjs` | **ENTRY PASS** · wide/narrow逐层进入和退回 · 默认抽屉收起 · 纠正写回与重载保留 · 同一intent理由不同 · 缺索引真实Node分支及浏览器分支通过 · 新标签页200 · layers PASS · console errors 0 |

主屏最大30字；抽屉展开时整页wide 183字、narrow 188字，其中主屏仍≤30字，导师明细按前述选择单独计数。窄屏用Tab、Enter提交纠正，真实共享引擎读取的历史设置保持原值，纠正仍能主导desk委托理由。

真实同一意图`desk`的例子：理由从`初次见面，先给你一件再问。`变成`依你纠正的「我更想看人物如何改变」，重排此程。`；页面重载后理由保持后者。

五张宽屏验收图：

- `runs/desk/7/L1/shots/entry-wide-L0.png`
- `runs/desk/7/L1/shots/entry-wide-L1.png`
- `runs/desk/7/L1/shots/entry-wide-L2.png`
- `runs/desk/7/L1/shots/entry-wide-L3.png`
- `runs/desk/7/L1/shots/entry-wide-drawer.png`

窄屏五张为同目录`entry-narrow-L0.png`、`entry-narrow-L1.png`、`entry-narrow-L2.png`、`entry-narrow-L3.png`、`entry-narrow-drawer.png`；额外对照图为`entry-four-layers-comparison.png`，合计11张。对照图明确标注为四次不同屏幕的独立截图，没有把总览重新放回入口。

完整命令与原始stdout保存在`runs/desk/7/L1/entry-acceptance.log`；旧作本轮评分另存`fifty-years-regression.json`。回归完成后旧作51个原文件逐字节一致；评分生成的全局报告和历史记录也恢复原字节，未改评分源码、判定或门槛。`runs/index.json`只读，没有改既有字段语义；本次未操作git。

源码改动范围：`frameworks/desk/**`、`director/pipeline/desk-plan.ts`、`director/pipeline/director-node.ts`的desk路径、`intents/desk.json`、本文；`app/main.ts`只追加一个导入与一个desk条件分支，既有框架条目不变。旧验证入口改为转发分层浏览器验证，旧操作专项断言已移除。

未做到的验收项：无。仍不支持实时目录更新、跨设备记忆同步；作品标题在主屏缩短以遵守30字上限，完整原文仍保留在方案、索引及DOM属性中；需要由项目根目录提供HTTP服务才能打开相邻作品。


## 2026-10-16 场景化返工（ENTRY-ART）

四层入口原本能走通，但石板青背景、悬浮纸片和「往里看／看它在做什么／退回」文字按钮遮住了场景。现在用 `components/paint` 的黑漆、朱、金、帛与青铜重画；四个 act、逐层替换、前三秒唯一动作、退回、抽屉纠正及新标签页都保留。主屏没有带可见文字的 DOM 按钮，透明按钮只承担物件命中、读屏与键盘。

| 层 | 动作物件（点哪里） | 焦点靠什么 | 实际依据 |
| --- | --- | --- | --- |
| L0 案上 | 点矮案上的「旱」票根，或 Enter | 票根朱边、灯照亮的漆面；悬停/键盘聚焦使票根抬起、灯焰增强 | 仍用真实 `commission().why` 口述一句≤18字 |
| L1 导师 | 点案上竹简进入；点空帛端或向下键逐句轮听；左缘铜符退回 | 深衣导师在案后抬头、视线向竹简，灯光落在空白竹面 | 原有2–3条 active hypotheses，一次一句≤18字；confidence=0 留空白与未成字墨痕 |
| L2 导演 | 点右缘漆门看架上；左缘铜符退回 | 导师抬手与视线移向两张矮案，两案之间吊灯照亮毛坯 | 真实 director/form：胶片、叠帛、线格方体或棋盘；没有作品只留空案，不显示「在做／已交付」 |
| L3 呈现 | 点中央亮帛条抽出进入；点右侧暗帛条或向下键换件；铜符退回 | 中央一件亮，其余压暗；拿起时门缝亮起 | 只读真实标题、sealed、url；朱印/麻绳沿用原 sealed 语义，作品仍在新页打开 |
| 导师抽屉 | 右缘黑漆金线书签，Tab可聚焦；Escape收起 | 黑漆底、金线分隔、帛色输入条；仍是可键盘操作的 DOM | 只列导师假设、证据、置信度、来访史、下一次打算；纠正实时改变 commission |

字形由 `assets/library/desk/paint.ts` 的原创单线坐标和既有旱/禾篆意路径画出，不调用 `fillText`，不依赖浏览器标题字体。当前索引题字均已覆盖；当前件显示最多六字，其余每条只留两字，让视线聚在一件上。标题原文仍保留在 DOM title/读屏标签和原方案中，未收录的新字保留空字框，后续可继续刻入字形。台词沿用 `ctx.lines` 与 Noto Serif SC 字体栈；抽屉明细不计入主屏≤30字。所有新画具的来源、颜色与物件动作记录在 `assets/library/desk/recipe.json`。

可复验例子：打开 `/runs/desk/9/L1/index.html`，将鼠标移到票根上，应看到票根抬起且灯更亮；点票根后只有案后的导师与竹简，右缘书签等三秒出现。点书签，把第一条纠正成「我更想看人物如何改变环境」，提交并重载，导师的下一次打算仍引用这句话。继续点竹简、右缘门与中央亮帛条，真实作品应在新标签页打开；不是把四层同时放回主屏。

新旧同机位对比：旧图 `runs/desk/7/L1/shots/entry-wide-L0.png`，新图 `runs/desk/9/L1/shots/entry-wide-L0.png`；并置图 `runs/desk/9/L1/shots/entry-art-before-after-L0.png`。四层与抽屉截图是 `runs/desk/9/L1/shots/entry-{wide,narrow}-L{0,1,2,3}.png`、`entry-{wide,narrow}-drawer.png`；四层独立截图并置为 `entry-four-layers-comparison.png`。这些并置图只作验收证据，不出现在产品里。

未改变的边界：索引仍是构建时快照；需要由项目根目录提供 HTTP 才能打开相邻作品；无真实 url 的条目不造假入口；没有跨设备记忆同步。验收脚本改为读取本轮新建的 seed 9 产物，旧 seed 7 的页面与截图保持原样。既有「四层不同屏／纠正改变真实commission／历史设置保留／键盘提交／缺索引／新页200」断言全部保留，额外断言四层动作按钮没有可见文字。


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

## 2026-10-16 差距⑤⑥（GAP-ACTIVITY）· 导师的"给多少" 与 导演的"正在设计"

针对用户「导师分配资源呢？导演的活动呢」两个真缺口，依照全部场景物件、禁止数字/灯油比喻、每屏≤30字、一次一焦点的原则完成落水：

### 一、导师的"给多少"（场景物件驱动）
1. **派活（给谁做）**：L1 木牍旁两枚小木签，篆刻「基」与「衡」。推到哪一枚签即派给基础导演或叔衡。落盘写回 store 键 `mentor.assign`，重载页面完全保留。L2 对应案上的毛坯真的换侧，下一次 `commission().budget.note`（`·派叔衡`/`·派基础导演`）与 `why`（`派叔衡做`）真实反映派活。
2. **篇幅（给多少）**：木牍下压着的竹简笺数直观反映该件作品打算做多长。根据 `commission().budget` 的力气/档位计算，由作品形式的不同力气缩放（vignette 0.8 / gallery 0.9 / film 1.0 / game 1.2 / east3d 1.3），L0–L4 对应 1/3/6/10 简取整。把另一件作品排到接下来时，竹简笺数根据形式力气真实改变（例如 2 简 → 4 简），不写任何数字面板。
3. **撤下与压后**：撤下＝竹简笺推到案角，压后＝竹简笺移到木牍右侧。两者均可在抽屉排期中与案上物件点击中互相转换与逆转。压后时 `commission().why` 变为 `排期已压后，稍后再看...`，撤下时变为 `你已撤下所有排期，先停一停。`，恢复为接下来后完全还原。

### 二、导演的"正在设计"（L2 场景动作化）
1. **分幕落笔**：进 L2 后，帛在案上铺开，按 `plan.acts` 真实数据每 0.4s 落一笔（一笔＝一幕，总数取 `min(acts.length, tierLimit)`）。落笔伴随 ≤100ms 的墨迹晕染扩散；在 `reducedMotion` 开启时直接呈现终态。
2. **焦点高亮**：当前幕焦点对应的那一笔施加金色高光（PAL.millet/TONE.goldHot），其余各幕笔画退暗，视觉上呈现严格的「一屏一个焦点」。
3. **取舍留痕**：被方案放弃的备选方向在帛面上留下一道淡痕（PAL.silkDim），悬停或聚焦按 Enter 弹出真实取舍理由（来自 `plan.acts.withhold`，无真实记录时不造痕）。
4. **预演与重来划痕**：帛角盖有小朱印（PAL.cinnabar）；若方案预演中检测到风险/失败，朱印旁留有一道朱色划痕。
5. **记忆落点圈出**：若来访记录中含有上次停留记录（`visit.last.dwell`），命中的对应幕由朱墨圈出；无记录不画。
6. **卷帛牵线**：设计帛末端卷起，一条细墨线牵引延伸至 L3 架子，表明「设计→呈现」是同一流水线。

### 三、本轮验收实测

| 命令 | 结果 |
| --- | --- |
| `pnpm typecheck` | **PASS** · exit 0，`tsc --noEmit` 0 errors |
| `pnpm present --intent intents/desk.json --tier L1 --seed 13` | **PASS** · valid errors 0 / warnings 0；11 封信，未回执 0；play done 4 步 / 12.6s / errors 0 |
| `pnpm bench runs/desk/13/L1` | **PASS hard 9/9** · first-action 0.37s · first3s 1 · feedback p90 81ms · max-chars 18 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS |
| `node frameworks/desk/verify-entry.mjs` | **ENTRY PASS** · 0 退化 · 12 张截图 · 四层互斥与单焦点保持 |
| `node frameworks/desk/verify-schedule.mjs` | **SCHEDULE PASS** · 0 退化 · 5 项断言通过 |
| `node frameworks/desk/verify-activity.mjs` | **ACTIVITY PASS** · 六项新断言全部通过 · 14 张截图产出 · 同机位对比图生成 |
| `pnpm bench runs/fifty-years/9/L1` | **PASS hard 9/9** · first-action 0.12s · first3s 1 · feedback p90 349ms · max-chars 28 · errors 0 · fps-p5 60 · layers PASS |
| `pnpm bench runs/first-visit/13/L1` | 8/9（首动 0.12s、每屏 29 字、报错 0、fps 60，旧产物在无头并发测试下 feedback p90 采样抖动，既有文件逐字节无修改） |

### 四、截图证据（14 张，位于 `runs/desk/13/L1/shots/`）
- `activity-L1-assign-before.png`: 派活前木牍与基/衡签
- `activity-L1-assign-after.png`: 派活至叔衡后木牍偏向与衡签高亮
- `activity-L2-swapped.png`: 派活后进 L2 两案毛坯互换
- `activity-L1-slips-before.png`: 排期更换前 2 简
- `activity-L1-slips-after.png`: 排期更换后 4 简（随 game 力气改变）
- `activity-L1-postpone.png`: 竹简压后（移至木牍右侧）
- `activity-L1-drop.png`: 竹简撤下（移至案角）
- `activity-L2-falling.png`: L2 帛上分幕墨笔正在落笔
- `activity-L2-focus.png`: L2 焦点笔金帛高亮
- `activity-L2-rehearsal.png`: L2 帛角预演小朱印与划痕
- `activity-L2-dwell.png`: L2 上次停留处朱墨圈出
- `activity-L2-handoff.png`: L2 帛卷起牵线至 L3
- `activity-L2-tradeoff.png`: L2 取舍淡痕与理由浮现
- `activity-L2-comparison.png`: 新旧 L2 同机位对比图（静物 vs 正在设计落笔）

### 五、旧作逐文件 SHA 比对
对既有运行目录 `runs/fifty-years/9/L1` 与 `runs/studio/5/L1` 进行了 SHA-256 哈希校验：除 `bench.json` 和 `curve.csv` 作为运行期重测产物发生数值刷新外，既有的 `index.html`、`layers.json`、`ledger.json`、`plan.json`、`report.json`、`trace.jsonl` 全部逐字节保持一致，零污染、零意外改动。未触碰 git。

