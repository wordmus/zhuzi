# W2 · 可培育闭环：两本册子 + 纠正一条假设（P2）

依据：§7「了解你，也被你读懂」（带证据的假设；在它做事时可问、可改；你也在读它）与 §8 培育、§12 取舍可见；`docs/产品策划 v0.3.md` §2.2（会错会改）。

目标：把「培育」从概念变成**可玩的一件小事**——书架上的两本册子，默认折叠；翻开后能看见它眼中的你（带证据的假设）、能纠正一条，它当场改并告诉你改了什么；另一本是你眼中的它（只读的脾性摘要）。

## 一、要做的

1. **假设的数据形状**（纯函数，可测）：
   ```ts
   interface Hypothesis { id: string; text: string; evidence: { visit: number; what: string }[]; confidence: number; status: 'active' | 'retired' | 'edited'; }
   ```
   证据必须来自真实记录（`visit.last`、`visit.changes`、结局、dwell），不许编造。初始 ≥3 条（如「你更在意人物的处境，而非战局」「你会在某个元素上停很久」「深夜你更愿意看短的」）。
2. **它眼中的你**（可改）：列出假设与证据；点一条 → 三个动作：**留着**（confidence +）、**改一条**（输入/选项纠正成新说法，旧说法留痕为 retired/edited）、**撤销**（删掉，记入变化日志）。改完导师说一句「改了哪条」（≤18 字），写回 `store`，并影响**下一次** `commission()` 的 `why` 与 budget（可验证：改前改后同一 intent 的 commission 不同）。
3. **你眼中的它**（只读）：从真实行为归纳的脾性 3 条（例：你停留久的地方它下次会变；深夜只排短的；它猜错了会挪），每条附一条证据引用。
4. 入口在咖啡厅（书架），默认折叠；一屏一个焦点；≤1 句/屏；全部经 `ctx.aff.add()`。

## 二、验收（都要打印）

- 无头断言 `npx tsx engine/mind/hypotheses.test.ts`（新）：证据来自记录、纠正后 confidence/status 正确、`commission().why` 在纠正前后不同、撤销后不再出现在列表、同输入确定性。
- 浏览器：`pnpm present --intent intents/mentor-desk.json --tier L1 --seed 2`（或 first-visit）里能翻开两本册子、改一条、看到它改口；bench **9/9**。
- 截图：翻开的「它眼中的你」（含证据）与纠正后的一句。

## 三、边界

- 与 W1 串行（同一间咖啡厅）；不改 bench 判定/门槛、critic、现有 runs。
- 你拥有的文件：`components/books/**`（新）或 `frameworks/vignette/**` 的册子部分（与 W1 串行时再动）、`engine/mind/**`（只加）、新 `engine/mind/hypotheses.test.ts`、`docs/design/cultivation.md`。
- 不做模型调用；这一版全部规则化，但**数据形状**要经得起以后接模型。
