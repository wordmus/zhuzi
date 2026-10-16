# W2 任务备忘录（两本册子与假设闭环）

## 1. 范围与改动说明
- **components/books/**：新建 `books.ts` 与 `index.ts`，导出 `mountBooks`，负责咖啡厅书架两本折叠册子绘制与弹层交互。
- **engine/mind/**：新建 `hypotheses.ts` 与 `hypotheses.test.ts`，实现假设生成、纠正、留着、撤销等纯函数逻辑及无头断言。
- **engine/layers/mentor.ts**：在 `createMentor().commission` 中增加对 `mentor.hypotheses` 的读取；若存在被纠正的假设，则改写 `why` 并补充预算备注。
- **frameworks/vignette/**：仅在 `runThreshold` 与 `runReturn` 中增加 `mountBooks(ctx)` 的挂载、绘制与清理，完全不修改原有场景结构与镜头流程，与 W1（第二次来访/年谱）完全兼容无冲突。
- **frameworks/vignette/cultivate-browser.ts**：浏览器自动化测试与截图采集脚本。
- **docs/design/cultivation.md**：设计与验证文档。

## 2. 验收结果
- `pnpm typecheck`：通过
- `npx tsx engine/mind/hypotheses.test.ts`：通过全部 7 项无头断言
- `pnpm present --intent intents/mentor-desk.json --tier L1 --seed 2`：顺利构建并完成自测
- `pnpm bench runs/mentor-desk/2/L1`：9/9 PASS
- `pnpm bench runs/first-visit/7/L1`：9/9 PASS（无回归）
- 截图产物存放在 `docs/design/shots/`
