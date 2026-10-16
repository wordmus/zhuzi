# 小游戏契约（冻结版 · 2026-10-15）

每个小游戏在仓库里就是一个**框架**（`app/context.ts` 的 `Framework`），由导演在呈现方案里点名，像 `vignette`、`reveal`、`walk2d` 一样排在幕里。这样「小游戏嵌进视角」是导演编排出来的，不是塞进某个大场景里的补丁。

读这份契约之前先读：`app/context.ts`（接口）、`frameworks/reveal/index.ts`（最简的样板）、`docs/design/demo-spec.md` 第一节（体验规格）、`eras/zhanguo/style-bible.md`（材质）。

## 一、目录与命名

```
frameworks/<id>/index.ts      导出 export const <camelId>: Framework
frameworks/<id>/logic.ts      纯逻辑（可无 DOM、可测）
frameworks/<id>/logic.test.ts npx tsx frameworks/<id>/logic.test.ts
frameworks/<id>/README.md     中文名、元素表、动作表、出口、建议接入哪一章历史
dev/<id>.html + dev/<id>.ts   自测页（见第五节）
```

- `<id>`：kebab-case，用中文拼音或意译，如 `jixia-speakers`、`wude-wheel`、`qi-knife`、`bells`。
- 中文名写在 README 与 `index.ts` 顶部注释里，玩家屏幕上不出现游戏名。
- **不要改共享文件**：`engine/**`、`app/**`、`components/**`（除你自己新建的子目录）、`bench/**`、`director/**`、`intents/**`、其他 `frameworks/**`。需要共享改动时，写进 `docs/tasks/notes-<id>.md`，交给整合者。

## 二、小游戏读什么、写什么

`run(act: PlanAct, ctx: Ctx)`：

- 读 `act.elements`：每个元素有 `id`、`component`、`represents`、`actions`、`prominence`。你的游戏在 README 里写明它认哪些元素 id 与动作名；导演按这张表编排。
- 读 `act.lines`：可用台词；`act.focus`：唯一焦点；`act.budget`：字数与首个动作的预算。
- 可以经 `ctx.handoff` 与前后幕交接东西（票据、图、坐标）。
- 完成时 `resolve`，返回 `{ act: act.id, data: { facts, metrics, line? } }`：
  - `facts: { id: string; text: string; kind: 'event' | 'decision'; by: string }[]`（`text` ≤ 30 字；`by` 写角色名）——整合者把它们写进事实账本；
  - `metrics: Record<string, number>`——本次玩法的数（正确率、用时、选了什么），给 trace 与长卷用；
  - `line?: string`——结束时角色的一句（≤ 18 字，可无）。
- **不改世界**：小游戏不直接改 `WorldState`、不写 `world.fact`；只交事实，由上层接线。（为了 bench 复现，facts 同时用 `ctx.bus.log('world.fact', { fact })` 记一条 trace。）

## 三、必须遵守的体验规格（违反即返工）

1. 一屏一个焦点；前 3 秒同时可做的事 ≤ 1 个。
2. 每个可点/可拖之物都经 `ctx.aff.add()` 注册（DOM 里会有 `[data-aff]` 按钮）；模拟玩家与读屏只认它。焦点元素加 `data-pulse` / `aria-current`。
3. 每个动作 100ms 内有看得见的反馈（光、形变、声音），1 秒内有意义上的回应。
4. 每屏 ≤ 1 句、≤ 30 字，最好 ≤ 18 字；没有说明文字、没有标签、没有按钮文字。测试：**隐藏全部文字后仍能玩完**。
5. 全程用 `ctx.rng.fork('<id>')`，不要 `Math.random()`：同 seed 同操作 → 同一结果。
6. 无模型时全程规则可完成。
7. 材质统一：色板用 `components/paint/palette`，复用 `components/paint/**` 的笔触；不引入新字体、不引入新依赖。

## 四、trace

关键节点写 trace（`ctx.bus.log`）：`<id>.start`、`<id>.step`（每一步）、`<id>.choice`（有后果的选择）、`<id>.end`，以及 `world.fact`。字段用自己的名字，但 `kind` 就用这些字符串。

## 五、自测页与 bench

`dev/<id>.html` + `dev/<id>.ts`：合成一个 `PlanAct` 与一套假器官（照 `app/main.ts` 里 `boot()` 建 `stage/bus/store/senses/aff/lines/audio` 的方式），只跑你这一个框架；`window.__zhuzi = { ctx, plan: { acts: [act], seed, tier }, bus, stage }`、`window.__trace = bus.trace`；游戏完成时置 `window.__zhuzi.done = true`。

验证（离线，不依赖 dev server）：

```sh
ZHUZI_ENTRY=dev/<id>.html ZHUZI_OUT=dist-<id> npx vite build
pnpm bench dist-<id>/dev/<id>.html   # 注意：Vite 按 root 相对路径落盘，产物在 dev/ 下；报告在 runs/_bench/<id>/bench.json
npx tsx frameworks/<id>/logic.test.ts
```

必须达到：`errors 0`、`max-chars ≤ 30`、`first3s ≤ 1`、`notext PASS`、`repro PASS`、`fps-p5 ≥ 50`。`first-action` 尽量 ≤ 0.9s。做不到 `repro` 的（例如依赖真实时钟）在 README 里写明原因。

## 六、历史接入（给整合者）

每个 README 最后一节写：这个游戏属于谁的视角（禾 / 季 / 田伯 / 导师）、建议接进 50 年长卷的哪一章（历史事件）、它产出的事实对之后哪一章有效。整合者（wave 2）据此把它排进呈现方案。
