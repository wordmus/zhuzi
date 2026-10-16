# Wave 1 总纲 · 导师 / 导演 / 演员 · 小游戏 · 五十年长卷

2026-10-15 · 协调者：Pi（当前会话）· 执行：Orca orchestration workers

## 这一轮要实现的三件事（用户原话）

1. **完全展示导师、导演、演员多层结构，以及畅通的信息传递。**
2. **多个小游戏。**
3. **加深目前的历史游戏：串起多个历史事件，横跨 50 年的历史进程。**

## 分波

| 波 | 任务书 | 产出 |
| --- | --- | --- |
| 1 | `s1-layers.md` | 三层信息流的实现：信件、双向传递、演示面板、bench 检查 |
| 1 | `s2-history.md` | 前 356–306 五十年事件表 + `engine/history` + 测试 + 说明 |
| 1 | `s3-jixia.md` | 小游戏《稷下谁在说话》《五德转盘》 |
| 1 | `s4-qi.md` | 小游戏《齐法化》《编钟》 |
| 2 | （协调者另发） | 整合：把小游戏与五十年长卷接进导演管线与意图；把三层信息流做成玩家看得见的呈现 |
| 3 | （协调者另发） | 独立验证、bench 棘轮、README 与复验文档 |

## 只属于每个人的文件（同一工作树并行，互不越界）

- s1：`engine/layers/**`、`engine/types.ts`（只增）、`director/pipeline/director.ts`、`director/pipeline/mentor.ts`、`app/main.ts`、`app/context.ts`、`components/presenter.ts`、`bench/run.ts`（只加 layers 检查）、`bench/thresholds.json`（只加 `layers: true`）、`director/pipeline/present.ts`（只加 layers.json 输出）、`docs/design/layers.md`
- s2：`eras/zhanguo/history.json`、`engine/history/**`、`docs/design/history-arc.md`
- s3：`frameworks/jixia-speakers/**`、`frameworks/wude-wheel/**`、`dev/jixia-speakers.*`、`dev/wude-wheel.*`、`docs/tasks/notes-jixia.md`
- s4：`frameworks/qi-knife/**`、`frameworks/bells/**`、`dev/qi-knife.*`、`dev/bells.*`、`docs/tasks/notes-qi.md`

冲突了就停手，把冲突写进 `docs/tasks/notes-<你的id>.md`，不要改别人的文件。

## 所有人共同遵守

- 仓库铁律见 `CLAUDE.md`；作品只能由导演管线产出。
- **不许动 git**：不 commit、不 checkout、不 stash、不 reset、不 clean、不切分支。只改文件。（同一工作树里有别的 worker 未提交的改动。）
- 不跑 `pnpm install`、不删文件、不做大范围格式化或重命名。
- 中文注释，写得稀。所有玩家可见的字都是中文。
- 收尾必须跑 `pnpm typecheck`；**只要报错不在你负责的文件里**（是别的 worker 正在改的），在报告里写明即可；你负责的文件必须零错误。
- 汇报用 Feynman 口径：以前卡在哪、现在能做什么、哪里可复验、哪种情况不支持。

## 冻结的接口（这一波不许改）

- `app/context.ts` 的 `Framework` 接口：`run(act, ctx): Promise<ActResult>`。
- `engine/types.ts` 的 `FrameworkId`：新框架直接用自己的 id 字符串。
- 小游戏契约：`docs/design/minigame-contract.md`（冻结）。
- s1 的信件类型名与字段（见 `s1-layers.md`），其他各人要引用就照抄。
- s2 的 `HistoryEvent` 字段（见 `s2-history.md`），整合者照它接线。

## 收尾

每个 worker 结束时发 `worker_done`，三句执行摘要 + 证据（命令与结果、文件清单、复验步骤），并写明未做到的部分。
