# 五德转盘

季把“何德能胜前代”放到青铜盘上试一遍。点亮着的竹简后，依次推夏木、商金、周火：选金、火、水，演成“夏木→商金→周火→齐水设想”。点五格或拖指针都能完成，答错学士摇头、格上留朱痕、盘上露出相胜图形线索，仍留在这一轮，直到转对。

## 元素与动作

导出 `wudeWheel: Framework`，id 为 `wude-wheel`。必须提供以下元素及动作：

| 元素 id | component 建议 | represents | 动作 |
| --- | --- | --- | --- |
| `ji-scroll` | 竹简 | 季的上书草简 | `open`，点击或 Enter |
| `wude-pointer` | 指针 | 青铜盘指针握柄 | `turn`，拖动松手选择；点击/Enter 选当前指向 |
| `virtue-0` | 转盘格 | 木德 | `choose`，点击或按 1 |
| `virtue-1` | 转盘格 | 火德 | `choose`，点击或按 2 |
| `virtue-2` | 转盘格 | 土德 | `choose`，点击或按 3 |
| `virtue-3` | 转盘格 | 金德 | `choose`，点击或按 4 |
| `virtue-4` | 转盘格 | 水德 | `choose`，点击或按 5 |

五格各有独立图形：树、焰、山土、刃、水波；盘心显示前代之德图形，金线箭头从胜者指向所胜者。隐藏全部字以后，图形、指针、来路仍可用；答错的格本轮不再可选，最多试五格就能过一轮。指针有自己的 affordance，不靠原生未注册事件。鼠标、触屏、键盘走同一选择逻辑；按住握柄拖动超过 8px 后松手，按最近方向落到一格。

首三秒仅一件事：开简。即使立刻开简，也等进场 3.1 秒后显盘，开简本身立即发光并展开。单次选择当场变色、人物转姿，700ms 后恢复错题操作，答对停盘 850ms，亮起相胜链。屏幕最多一句和五格单字；无题号、分数、现代按钮文字。`act.focus` 建议 `ji-scroll`，`act.lines` 认可选 `enter`（不超过 18 字与 `budget.maxChars`），轮次提示固定为规则剧本并由“邹子”角色说，不冒充古籍引语。

## 出口、事实与交接

三轮全部完成即 resolve `{ act, data: { facts, metrics, line } }`；曾经答错不锁死结局。

| 输出 | 内容 |
| --- | --- |
| 决定事实 | `wude-wheel-inscribed`：季以相胜推齐水德，写下天命之说；或 `wude-wheel-challenged`：季推齐水德受驳，重辨天命之说 |
| metrics | `correct`、`rounds`、`attempts`、`mistakes`、`firstTry`、`perfect`（0/1） |
| line | 我把天命之说写上简 / 天命之说，被驳了一句 |
| handoff | `wude: { proposed:'水', hypothetical:true, challenged:boolean }` |

事实 `by:'季'`、`kind:'decision'`、文字不超过 30 字，同时经 `ctx.bus.log('world.fact',{fact})` 留 trace。框架不改 WorldState，事实只证明季做了推演。trace 有 `wude-wheel.start/step/choice/end`，记录前德、所选、正误；重复点已驳格不计错。随机只从 `ctx.rng.fork('wude-wheel')` 取材质种子，无真实时钟参与判分与事实；同 seed 同操作可复现。

结束移除交互和帧订阅，保留静态结尾；下一幕可移除 `wude-wheel` 与 `wude-wheel-ground` 画层。本框架复用 `jixia-speakers/surface.ts` 的漆面与开简，规则在自己的 `logic.ts`。

## 史源与边界

五德**相胜**为：木胜土、土胜水、水胜火、火胜金、金胜木，闭环为土→木→金→火→水→土（箭头表示后者胜前者）。这里不使用木生火的相生次序。

- [《吕氏春秋·应同》](https://ctext.org/lv-shi-chun-qiu/ying-tong/zh)叙述黄帝土、禹木、汤金、文王火，并有“代火者必将水”。夏木→商金→周火的三德关系取自此类五德代兴叙述。
- [《史记·秦始皇本纪》](https://ctext.org/shiji/qin-shi-huang-ben-ji/zhs)记秦始皇以周火德、秦取其所不胜之水德，尚黑、改正朔等。这是秦后来的政治实践，不能移植为齐国既成事实。
- [《史记·孟子荀卿列传》](https://ctext.org/shiji/meng-zi-xun-qing-lie-zhuan/zh)记邹衍推阴阳消息、五德转移；[《史记·田敬仲完世家》](https://ctext.org/shiji/tian-jing-zhong-wan-shi-jia/zh)可核稷下士人受齐宣王礼遇的学术环境。传世邹子原书不存，这里没有杜撰他的“原话”。

**齐水德只是季依水胜火做的游戏内思想实验**，不是“齐确曾受命为水德”的史实，也不等于确认邹衍专为齐提出此说。对话提示和反馈是剧本改写；《吕氏春秋》成书在五十年长卷范围之后，作为后来保存的学说材料引据，不是当年上课逐字记录。五行不控制天气、战争或真实天命，盘上推演不改写历史胜负。

## 复验

```sh
pnpm typecheck
npx tsx frameworks/wude-wheel/logic.test.ts
ZHUZI_ENTRY=dev/wude-wheel.html ZHUZI_OUT=dist-wude-wheel npx vite build
pnpm bench dist-wude-wheel/dev/wude-wheel.html
```

现有 Vite 保留 dev 目录，协调者已更正验收路径。直接打开 `dist-wude-wheel/dev/wude-wheel.html` 即可离线试玩，或 `pnpm dev` 后点 `/dev/wude-wheel.html?seed=317`。浏览器窗口有 `window.__zhuzi`、`window.__trace`，完成时 `done=true`，返回结果在 `result`。自测 harness 经真实 LayerBus 送出五类信件与回执，演员报告取自实际游戏结果，导师回顾取自这份报告。

可复验小例子：开简后依次点金、火、水（按 4、2、5），结束应见 `attempts=3`、`mistakes=0`、`firstTry=3`、`perfect=1`；第一轮先点木再点金，后两轮正确，则应 `attempts=4`、`mistakes=1`、`firstTry=2` 并产出 challenged 事实。删字只验证操作可完成，不证明五德政治观是真的。

## 接进五十年长卷

视角：季。建议接前 334 年“徐州相王”章后的稷下思想插幕，突出王号与受命话语之间的张力；不声称邹衍在该年已说过全部成型理论。也可接前 317 年“孟子至齐”章，以不同学说争上书机会。前 315 年“伐燕之议”或前 306 年“齐宣王末期”章可读取季写下/受驳的天命之说，形成他对齐国扩张的期望与现实反差。本波不改注册表与历史章，交给整合者。
