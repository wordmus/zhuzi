# 差距⑤⑥ · 导师的"给多少" 与 导演的"正在设计"（都在 ENTRY 里长出来）

用户指着入口问了两句：**「导师分配资源呢？导演的活动呢」**。查证结果——两个都是真缺口，不是看漏：

- **导师**：现在只有"先做哪个"（抽屉排期可上移/压后/撤下）与"给谁做"（L2 两张案＝基础导演/叔衡各接一件）。"**给多少**"（`engine/layers/mentor.ts` 的 `commission().budget` 里算出的篇幅/力气）**一处都没画**——灯油比喻被否掉后没有替代呈现。
- **导演**：L2 是静物（屏风＋两张案＋毛坯＋年谱墙）。导演"设计世界"的真实动作（`director.ts`：分幕、焦点、取舍、预演、停止准则）没有在场景里**发生**。

## 一、导师的"给多少"（三个维度全是物件，不许灯油/份额/比例/数字）

1. **先后**（已有）：抽屉排期。
2. **派活（给谁）**：L1 木牍旁放**两枚小签**（刻「基」「衡」）——把木牍上那件**推到哪一枚签**上＝派给谁。动作：拖/推到签上（或键盘选中后左右移）；推完 **L2 对应案上的毛坯真的换到那一侧**（写回 store 键 `mentor.assign`，重载保留），并且下一次 `commission()` 的 `budget.note` 与 `why` 反映它。
3. **篇幅（给多少）**：木牍下**压着的竹简笺数**＝这一件打算做多长（由 `commission().budget` 的力气/档位推出：L0–L4 对应 1/3/6/10 简，取整即可，**不写字、不写数字**）。把另一件排到"接下来"后，笺数**真的跟着变**（因为形的力气不同：vignette .8 / film 1 / game 1.2 / east3d 1.3 …）。
4. **撤下/压后**：撤下＝把笺**推到案角**（那一叠"先放着"），压后＝笺移到木牍右侧；两者都要能一眼看出与"接下来"的区别，并且抽屉里可逆。

## 二、导演的"正在设计"（L2 要动起来）

进 L2 后，**帛在案上铺开**，然后按 `plan` 真实数据一处处发生：

1. **分幕**：每 0.4s 落一笔＝一幕（幕数取实际 `plan.acts.length`；`stage.reducedMotion` 时一次落完）；落笔有墨迹扩散（≤100ms 内有反馈）。
2. **焦点**：本幕焦点那一笔**更亮**（其余退暗）——"一屏一个焦点"的取舍看得见。
3. **取舍留痕**：被放弃的那一笔留**一道淡痕**，悬停/长按（键盘：焦点上按 Enter）能看到理由（取自 `plan` 的取舍记录；没有记录就不留痕、不编）。
4. **预演**：帛角一枚**小朱印**按一次；预演失败时留下一道"重来"的划痕（有证据才画）。
5. **记忆落点**：**你上次停留的地方**被朱笔**圈出**（取 `visit.last.dwell` 命中的那一笔；没有就不圈）。
6. **交接**：帛**卷起**，一条细线牵到 L3 的架子——"设计→呈现"是同一台机器，不是各画各的。

## 三、硬规则

- 每屏 ≤1 句 ≤30 字；一次一个焦点；焦点靠光/视线/墨迹；动作是物件（签、笺、笔、印）；**不许**文字按钮、数字面板、百分比、计数、灯油/份额比喻。
- 色板只用 `components/paint` 的 PAL/TONE；字用 `ctx.lines` 与程序化篆意字；新词若未收录题字就留空框。
- `stage.reducedMotion` 时全部动画直接呈现终态。

## 四、你的文件边界（严格）

拥有：`frameworks/desk/**`、`engine/layers/mentor.ts`（只加 `mentor.assign`／篇幅输出，**不改**已有 `why` 与预算语义）、`engine/mind/schedule.ts`（只读更稳妥，需要改先说明）、`director/pipeline/desk-plan.ts`、`docs/design/desk-map.md`。
**不要碰**：`engine/layers/types.ts`、`engine/layers/report.ts`、`engine/world/**`、`frameworks/studio|chronicle|vignette|console|film|gallery|east3d/**`、`eras/**`、`bench/**`、`critic/**`、其它既有 runs 产物（你新产的 seed 除外）、git。

## 五、验收（都要打印）

```sh
pnpm typecheck
pnpm present --intent intents/desk.json --tier L1 --seed 13 && pnpm bench runs/desk/13/L1   # PASS hard 9/9（含 layers）
node frameworks/desk/verify-entry.mjs        # 不退化
node frameworks/desk/verify-schedule.mjs     # 不退化
node frameworks/desk/verify-activity.mjs     # 新，六项：
#  ① 进 L2 三秒内落笔数＝min(实际幕数, 档位上限)，且焦点那笔最亮（读 canvas 像素或 data-* 断言都行，但要真断言）
#  ② 把一件从基础导演派给叔衡：L2 两案毛坯互换，store `mentor.assign` 落盘并重载保留，`budget.note` 反映新派活
#  ③ 把另一件排到"接下来"：L1 竹简笺数变（形不同→力气不同），且新笺数与 `commission().budget` 推算一致
#  ④ 撤下＝推到案角、压后＝移到右侧，两者可逆，且下一次 commission().why 真的变
#  ⑤ 「取舍淡痕/预演印/朱圈」只在 plan 与 visit.last 有真实证据时出现（拿一份无证据的 plan 断言其不出现）
#  ⑥ console errors 0；每屏可见字 ≤30
pnpm bench runs/fifty-years/9/L1 && pnpm bench runs/first-visit/13/L1   # 不回归（诚实分类；负载型假失败安静重跑一次，门槛不动）
```
- 截图 ≥8 张：L1（木牍＋两签＋笺数，改派活前/后、改篇幅前/后）· L2（落幕中、焦点、淡痕+理由、预演印、朱圈、卷帛牵线）· 与旧 L2 的同机位对比。
- 旧作逐文件 SHA 比对（studio/5、fifty-years/9；只允许 bench.json/curve.csv 两个测量产物变化）。

收尾 worker_done：三句摘要 + 命令与汇总行 + 截图路径 + 「给多少/派给谁/导演在做什么」各自的一句话证据链 + 未做到的部分。
