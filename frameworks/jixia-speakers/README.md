# 稷下谁在说话

季想在稷下堂上站住，才有机会把自己的竹简递出去。先点唯一亮着的竹简，开简之后五轮辨言：点六块学派牌之一。对了学士点头、季上前，错了季垂首，原话落成地上的一颗种子；五轮至少答对三轮，季在堂上站住，否则被问住。两种结果都正常交回导演。

## 元素与动作

导出 `jixiaSpeakers: Framework`，id 为 `jixia-speakers`。`run(act, ctx)` 不调用模型、不修改世界；必须提供下表元素与动作，缺少即抛出可定位的方案错误。

| 元素 id | component 建议 | represents | 动作 |
| --- | --- | --- | --- |
| `ji-scroll` | 竹简 | 季想上书的简 | `open`，点击或 Enter |
| `school-0` | 学派牌 | 儒 | `choose`，点击或按 1 |
| `school-1` | 学派牌 | 道 | `choose`，点击或按 2 |
| `school-2` | 学派牌 | 法 | `choose`，点击或按 3 |
| `school-3` | 学派牌 | 墨 | `choose`，点击或按 4 |
| `school-4` | 学派牌 | 名 | `choose`，点击或按 5 |
| `school-5` | 学派牌 | 阴阳 | `choose`，点击或按 6 |

全部点击入口经 `ctx.aff.add` 注册；Tab 聚焦、Enter/空格同样可用。屏幕只保留一句和六个学派短名，牌不显示题号、正确率或按钮说明。窄屏牌分两行。首三秒只允许开简：即使提前点击，也到进场 3.1 秒后才呈现六牌；动作当场变光，850ms 内反应落定。`act.focus` 建议 `ji-scroll`；`act.lines` 只认可选的 `enter` 短句，最多 18 字且不超过 `act.budget.maxChars`；题句由审定语录表提供，导演不能任意替换成未经核验的话。`elements.represents` 进入 affordance trace，布局按画面与屏宽安排。

## 出口、事实与交接

五轮后 resolve `{ act, data: { facts, metrics, line } }`，没有额外确认按钮或隐藏操作。`facts` 每条为 `{id,text,kind,by:'季'}`，文字不超过 30 字；同时用 `world.fact` 写 trace，整合者负责入世界账本。

| 输出 | 内容 |
| --- | --- |
| 事件事实 | `jixia-speakers-standing` 或 `jixia-speakers-questioned` |
| 错题决定事实 | `jixia-seed-<quote.id>`，季以后要重掂的原话 |
| metrics | `correct`、`answered`、`accuracy`、`maxStreak`、`seeds` |
| line | 我在稷下站住了 / 我被问得答不上来 |
| handoff | `jixia: { seeds: string[], standing: boolean }` |

trace 有 `jixia-speakers.start/step/choice/end`；开始记录本局语录 id，逐轮记录出处，选择记录所选学派与正误。随机只走 `ctx.rng.fork('jixia-speakers')`，六条语录洗牌取五条；同 seed、同选择结果一致。计时只影响呈现，不影响事实与分数。

结束停止帧回调、移除按钮与订阅，保留静止的最终画面；整合者离幕可清理 `jixia-speakers` 与 `jixia-speakers-ground` 两个画层。五德转盘复用本目录 `surface.ts` 的漆面与开简入口，独立规则仍在各自 `logic.ts`。

## 语录与史源

原文转为简体，现代标点用于断句。这里判断的是传世文本对应的思想传统，不宣称这些人同时在某年到齐、同席逐字说过这些话；六派也是后世整理学术传统的分类。尤其《韩非子》《吕氏春秋》成书晚于前 317 年，必须作为回望式学习材料，不能当作该年现场引语。

| 题句 | 归派理由 | 出处 |
| --- | --- | --- |
| 己所不欲，勿施于人。 | 孔子答子贡问“恕”，儒家推己及人 | [《论语·卫灵公》15.24](https://ctext.org/analects/wei-ling-gong/zh) |
| 道可道，非常道。 | 《老子》首章论道与名的限度，道家经典 | [《老子》第一章](https://ctext.org/dao-de-jing/zh) |
| 法不阿贵，绳不挠曲。 | 以法绳矫正贵臣与私意，法家治术 | [《韩非子·有度》](https://ctext.org/hanfeizi/you-du/zh) |
| 兼相爱，交相利。 | 墨家以兼相爱交相利易不相爱 | [《墨子·兼爱中》](https://ctext.org/text.pl?if=gb&node=675&show=parallel) |
| 白马非马。 | 辨“马”之形与“白”之色，名辩代表命题 | [《公孙龙子·白马论》](https://ctext.org/gongsunlongzi/bai-ma-lun) |
| 代火者必将水。 | 以五德代兴解释政治，属阴阳家命题 | [《吕氏春秋·应同》](https://ctext.org/lv-shi-chun-qiu/ying-tong/zh) |

《吕氏春秋》本身是杂家汇编；此题只归该段五德相胜命题为阴阳，不将整书划成阴阳家，也不伪称邹衍原句。所取《公孙龙子》为名辩代表的《白马论》，不使用其争议较大的其他篇章。反馈、季的心语为明确的游戏剧本，非古语引用。

## 复验

```sh
pnpm typecheck
npx tsx frameworks/jixia-speakers/logic.test.ts
ZHUZI_ENTRY=dev/jixia-speakers.html ZHUZI_OUT=dist-jixia-speakers npx vite build
pnpm bench dist-jixia-speakers/dev/jixia-speakers.html
```

现有 Vite 保留入口相对路径，协调者已将验收路径更正为 `dev/jixia-speakers.html`。直接双击此单文件即可离线玩，或 `pnpm dev` 后访问 `/dev/jixia-speakers.html?seed=317`。控制台可读 `window.__zhuzi.result`、`window.__trace`，完成标志 `window.__zhuzi.done`。自测器官用真实 LayerBus 发送委托、单幕方案、季的提示，并把实际游戏结果交给 `actorReport` 与导师回顾；五封信全部有回执，用于新增的 layers 验收，框架本身不负责上层编排。

可复验小例子：选对前三题、选错后两题，结尾 `metrics.correct=3`、`maxStreak=3`、`seeds=2`，应产生 standing 事件和两条错题事实。藏掉文本仍能逐轮选牌结束，但这只能验证操作可达，不能证明玩家理解了被隐藏的语录。

## 接进五十年长卷

视角：季。建议接前 317 年“孟子至齐”章的**导师回望式稷下辨言插幕**，不要把晚出的文本当成该年现场文献；若要严格同时代台词，整合者需另供早期语录包并做史源复核后再扩展规则。前 315 年“伐燕之议”可读取错题种子与站住/受挫事实，让季在上书时选择坚持或重掂；事实只记季的游戏经历，不改孟子或齐王的历史行动。本波不注册框架，也不接历史章，由整合者接线。
