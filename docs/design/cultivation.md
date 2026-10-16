# 可培育闭环：两本册子与假设纠正设计文档

依据：策划 v0.2 §7、§8、§12；`docs/产品策划 v0.3.md` §2.2（会错会改，了解你也被你读懂）。

---

## 1. 目标与设计理念

培育不是写配置项或填问卷，而是把「了解你，也被你读懂」做成咖啡厅书架上可翻阅、可纠正的一件小事：
- **它眼中的你**：导师基于真实记录对你做出的带证据假设（≥3 条），玩家可**留着**（置信度提升）、**改一条**（纠正说法，旧说法留痕）或**撤销**（删除）。纠正后导师当场用一句 ≤18 字反馈，并持久化写回 `store`，在下一次委托时真正改变 `commission().why`。
- **你眼中的它**：只读的脾性摘要（3 条），从系统真实行为归纳，每条附带真实的依据引用（如代码规则或来访记录）。
- **极简克制交互**：两本册子置于书架上，默认折叠；翻开后遵循「一屏一个焦点、≤1 句/屏」；所有按钮与交互均经 `ctx.aff.add()` 统一注册，无障碍与模拟玩家均走同一标准通路。

---

## 2. 数据契约与纯函数设计

数据结构定义于 `engine/mind/hypotheses.ts`：

```ts
export interface HypothesisEvidence {
  visit: number;
  what: string;
}

export interface Hypothesis {
  id: string;
  text: string;
  evidence: HypothesisEvidence[];
  confidence: number;
  status: 'active' | 'retired' | 'edited';
  originalText?: string;
}

export interface TemperamentSummary {
  id: string;
  trait: string;
  evidence: string;
}
```

### 真实证据来源（禁止编造）

所有假设证据均提取自真实数据字段：
1. **`h-focus`（人物处境 vs 战局）**：
   - 优先依据 `previous.endingFact`（如「田伯借出半瓮粟」）；
   - 或依据停留时间 `dwell.mentor`；
2. **`h-dwell`（停留细节与节奏）**：
   - 依据 `previous.longestPlace` 与 `longestPlaceMs`；
   - 或依据来访变动 `visit.changes[0]`；
3. **`h-night`（时段偏好）**：
   - 依据感官时段 `dayPart`（如「深夜」）；
   - 或依据跳过行为 `previous.skipped`；

### 核心操作与导师应答（严格 ≤18 字）

- **留着（affirm）**：置信度 `+0.15`，状态保持 `active`。
  - 导师应答：`留下了，我便按这条继续看。`（13 字）
- **改一条（correct）**：更新文本为新说法，旧说法保留于 `originalText`，状态置为 `edited`，置信度更新为 0.9。
  - 导师应答：`改了：你说${新说法}。`（≤16 字）
  - 写入变更日志：`store.set('mentor.hypotheses.log', ...)`。
- **撤销（retire）**：状态置为 `retired`，从活跃列表过滤，写入变化日志。
  - 导师应答：`这条撤了，不再拿它看你。`（12 字）

### 驱动下一次委托 `commission().why`

在 `engine/layers/mentor.ts` 中集成：
- 当存在用户纠正的假设（`status === 'edited'`）时：
  `why = 依你纠正的「${edited.text}」，重排此程。`
- 预算备注标注 `·依培育调整`；
- 当改前与改后调用同一意图与方案时，`commission().why` 确保不同且明确反应纠正意图。

### 你眼中的它（3 条脾性摘要）

1. **你停得久的地方下次会变**
   - 依据：`第 2 次来访灯移至手边（visit.changes: dwell.mentor）` 或 `rules.json · revision-trace 规则`。
2. **深夜只排短的，灯油减半**
   - 依据：`engine/layers/mentor.ts · commission() 深夜灯油折半（0.5×），紧凑排幕`。
3. **猜错了会挪，旧稿留痕不抹**
   - 依据：`director/seed-memory/rules.json · 未拿起的票根以淡痕保留于年谱中，不抹去旧稿`。

---

## 3. 组件与界面呈现（`components/books/`）

- 画布表现：在咖啡厅右侧绘制木制书架托板，陈列两卷战国风格的折叠册子「它眼看你」与「你眼看它」，标注「架上两册」。
- 交互注册：在进门后（`elapsed > 4 && greetRevealed`）注册 `book-you` 与 `book-it` 两个 affordance，默认折叠，不设脉动，完全不干扰模拟玩家与 bench 指标。
- 翻开体验：
  - 采用卡片弹层（`z-index: 45`，置于 affordances `50` 之下，确保无点击穿透与拦截冲突）；
  - 一屏仅展示一条假设或一条脾性；
  - 交互按钮全由 `ctx.aff.add()` 统一管理，合上时彻底注销。

---

## 4. 验收记录

### 1. 类型检查
`pnpm typecheck`：通过，0 errors。

### 2. 无头逻辑断言
`npx tsx engine/mind/hypotheses.test.ts`：全部通过：
- 证据来自真实记录字段
- 纠正后 status=`edited`, confidence=0.9，导师反馈 16 字（≤18 字）
- commission().why 纠正前后确切不同
- 撤销后不再出现在活跃列表
- 留着操作置信度提升
- 同输入输出严格幂等确定
- 3 条脾性均含真实依据引用

### 3. 评测指标（Bench 9/9）
- `runs/mentor-desk/2/L1`: **PASS hard 9/9**（`first-action 0.11s`, `first3s 1`, `feedback p90 274ms`, `max-chars 13`, `errors 0`, `fps-p5 60`, `notext PASS`, `repro PASS`, `layers PASS`）
- `runs/first-visit/7/L1`: **PASS hard 9/9**（无回归）

### 4. 浏览器真实交互与截图产物
脚本：`frameworks/vignette/cultivate-browser.ts`
- 截图 1：`docs/design/shots/cultivate-hypotheses.png`（翻开的「它眼中的你」，展示假设与真实记录证据）
- 截图 2：`docs/design/shots/cultivate-corrected.png`（纠正为「其实我更看重胜负大势」后，导师应答 ≤18 字及写回状态）
- 截图 3：`docs/design/shots/cultivate-temperament.png`（「你眼中的它」脾性摘要及真实依据引用）
