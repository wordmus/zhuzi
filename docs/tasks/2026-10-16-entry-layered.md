# ENTRY · 分层展开的入口（v2，替代 A/B/C 的堆叠式总览）

用户反馈（原话，2026-10-16）：
> 「不要再用灯油的比喻，UI 也不要这样。现在的界面混在一起，一出现就像完整的监控面板。需要分层，保持简洁，采用层层展开的方式。之前已经说明，为了简化信息查找，可以把某一层放在侧边 UI。不要像现在这样堆在一起。」

因此本件替代 A（咖啡厅四站同屏）、B（横幅四站同屏）、C（三栏仪表）：**一次只出现一层，往里走要一个动作；侧边 UI 只承载一层（导师层）的明细；全程不用灯油比喻。**

## 一、分层（层层展开，一层一屏）

| 层 | 你看到 | 唯一能做的事 | 数据（真实） |
| --- | --- | --- | --- |
| **L0 案上** | 极简：矮案上**一件东西**（如写着「旱」的票根或一枚印）＋导师一句 ≤18 字 | **往里看** | `commission.why`（它这一次为什么给你这个） |
| **L1 导师层** | **它对你想什么**：2–3 条短句（如「你更在意人的处境」「你上次在门口停了很久」），一次一句轮读或并排两行；**没有灯油、没有比例、没有表** | **看它在做什么** / 退回 | `engine/mind/hypotheses.ts`（带证据假设）、`VisitRecord` |
| **L2 导演层** | **谁在做哪一件**：基础导演 / 叔衡，各一行「《X》·在做/已交付」 | **看架上** / 退回 | `runs/index.json`（director/status/title） |
| **L3 呈现层** | 架上作品：每行「《标题》· 形式·档位 · ✓印或毛坯」；一次聚焦一件 | **拿起 / 进入**（新标签页打开该作品） / 退回 | `runs/index.json`（form/tier/sealed/url） |
| **侧边抽屉** | 右侧一条**细边 tab**（默认收起，宽约 36px；点开约 320px 的窄抽屉）：**只有导师层的明细**——① 它眼中的你（假设＋证据＋置信度，可**纠正**）；② 来访史（来过几次、上次停在哪、多久没来）；③ 它对下一次的打算 | 纠正一条假设（写回 store，下一次 `commission().why` 真的变） | `hypotheses.ts`、`VisitRecord`、`commission` |

## 二、硬规则

- **一次只加一层**：进场只有 L0；每进一层要一个动作，每层都要有「退回」。
- **一屏一个焦点；每屏 ≤1 句 ≤30 字**；前 3 秒 ≤1 个可做之事；100ms 内反馈。
- **禁止**：灯油/份额/比例尺/进度条/多栏仪表/四站同屏；禁止把四层信息堆在一屏；禁止描边矩形标注（这是场景，不是示意图）。
- **侧边抽屉只承载导师层**，其余层的信息留在场景里；抽屉默认收起，不打断场景。
- 数据全真；`runs/index.json` 缺失时呈现层显示「还没装上」，不编造。
- 挖掉旧比喻：删除 desk 里一切 `oil/lamp/attention` 相关绘制与测试（`verify-lamp.ts` 换成「侧边抽屉纠正假设 → commission 改变」的断言）。

## 三、实现与边界

- 主战场：`frameworks/desk/**`（把横幅四站改为分层展开；保留 `runs/index.json` 读取与 director-data 分支）；`director/pipeline/desk-plan.ts` 按层组织 act 数据；`intents/desk.json` 保持 id `desk`。
- 侧边抽屉：DOM（`ctx.stage.dom()`）窄抽屉，漆画配色，可键盘操作。
- 只加不改：`app/main.ts`、`validate.ts`、`director.ts` 的既有条目（console/cafe/film/gallery/...）不许动；`runs/index.json` 只读或多生成，不改既有字段语义。
- 不要碰：`frameworks/vignette/**`（CAFEMAP-ART 的地盘，已交付就冻结）、`frameworks/console/**`、其它 frameworks、bench 判定与门槛、critic、既有 runs 产物、git。

## 四、验收（都要打印）

```sh
pnpm typecheck
pnpm present --intent intents/desk.json --tier L1 --seed 7 && pnpm bench runs/desk/7/L1
pnpm bench runs/fifty-years/9/L1          # 既有不回归
node frameworks/desk/verify-entry.mjs      # 分层与抽屉的浏览器断言（新写）
```
- `runs/desk/7/L1` **PASS hard 9/9**（含 layers）；**截图至少 5 张**：L0 / L1 / L2 / L3 / 侧边抽屉打开；另加一张「四层不同屏」的对照说明（证明没有同屏堆叠）。
- `verify-entry.mjs` 断言：① 进场只有 L0 一件事；② 逐层进入/退回各一次且截图不同；③ 侧边抽屉默认收起、打开后能纠正一条假设并写回 store；④ 纠正后同一 intent 的 `commission().why` 不同；⑤ console errors = 0；⑥ 页面任意一屏可见字 ≤30（抽屉打开时不计入主屏？——若计入，请在报告说明并给出选择）。
- 报告里给出「与 A/B/C 的区别」三句：分层 vs 同屏、简单 vs 面板、侧边抽屉 vs 全屏仪表。

收尾 worker_done：三句摘要 + 命令与汇总行 + 截图路径 + 未做到的部分。
