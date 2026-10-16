# AI 3D 流水线 · 可执行子代理模板（本机化）

来源：@Saccc_c《AI 3D 游戏制作流程》提炼稿 · 改写：2026-10-15 · 协调者：Pi

这份文件是**任务分解基础**：每个阶段 = 一个可派的子代理任务书 + 一个可判的验收 + 一个闸门。原则照原稿：**AI 主导 + 少量人工确认**；确认只发生在四个闸门（G1–G4）。

---

## 0. 本机现状（2026-10-15 实测，决定哪条路今天能跑）

| 原稿工具 | 本机状态 | 替代 / 说明 |
| --- | --- | --- |
| Fable 5.1（PRD） | ✗ | → `gpt-6.1-sol`（Orca codex worker） |
| Image 2.5 / GPT Image 2.5 | ✓ | → `magpie-image` MCP 的 `generate_image`（支持 `reference_images`，可多视角一致） |
| Tripo（H3.1 / Smart Mesh P2.0） | ⚠ 缺 key | skill 已在：`threejs-3d-generator`（读 `TRIPO_API_KEY`，当前 `MISSING`）；补 key 即可用 |
| Opus 5.5（操控 Blender/Unity + 代码） | ✗ | → `gpt-6.1-sol` 派 worker，用 **headless CLI + 脚本** 驱动（不依赖 MCP） |
| Astra（迭代/修 bug） | ✗ | → `gpt-6-astra` 或 `gpt-6-luna`，且**必须与建造者不同模型**（盲审） |
| Blender + Blender CLI | ✓ | Blender **5.1.2**：`/Applications/Blender.app/Contents/MacOS/Blender --background --python <script.py>` |
| Unity + Unity CLI + Pipeline + Unity MCP | ✗ | 只装了 Unity Hub，`Editor/` 为空；Unity MCP 未配置。走 Unity 前先装 Editor + license |
| Auto-Rig Pro | ? | Blender 插件，需装（走绑骨阶段前确认） |
| Mixamo | ✓（网络） | 下载 FBX；骨骼匹配由脚本校验 |
| Blender/Unity MCP | ✗ 未配置 | **本模板一律用 headless CLI**，Orca worker 可以直接跑 |

**结论**：今天能跑的是「Tripo（补 key 后）→ Blender headless → three.js」；Unity 那条路要先装 Editor。

---

## 1. 流水线阶段（每格 = 一个子代理）

| 阶段 | 子代理 | 输入 | 产出（可检查工件） | 闸门 |
| --- | --- | --- | --- | --- |
| S0 策划 | planner | 一句话主题 + 参考条目 + 预算 | `prd.md`：场景清单、人物卡、剧情线、交互需求、资产预算表 | **G1** 人确认主题与风格 |
| S1 参考图 | concept | `prd.md` | `refs/scene-<名>-{over,top,iso}.png`、`refs/char-<名>-{front,side,back,three-quarter}-tpose.png` | **G2** 人确认参考图 |
| S2 拆解 | planner | `prd.md` + 参考图 | `assets-plan.json`：每个物件 → `tripo` / `blender` / `engine` + 优先级 | — |
| S3 3D 资产 | assetgen | `assets-plan.json` | `assets/library/<id>/{file.glb, recipe.json, license, era, tags}`（含提示词、seed、模型版本） | — |
| S4 场景组装 | builder | 参考图 + 资产 | `build/scene.ts`（three.js）或 `build/scene.py`（Blender）+ `shots/{over,front,side}/*.png` | — |
| S5 盲审 | reviewer（**不同模型**） | 只给：意图 + 参考图 + 截图 | `review.json`：逐机位差异 → 修改点清单；≤3 轮 | **G3** 白模/比例/构图确认 |
| S6 角色与动作 | rigger | 角色 glb + FBX 动作 | 绑定校准脚本 + `check/pose-{raise,bend,turn}.png` + 穿模报告 | — |
| S7 引擎集成 | integrator | S4/S6 产物 | 可运行工程 / 可玩页面；`build.sh` 一键重建 | — |
| S8 交付回归 | qa | 全部 | 预算表（面数/贴图/drawcall/FPS）、盲审记录、复验文档 | **G4** 最终盲审通过 |

分工纪律：
- **建造者与审查者不同模型**；审查者不读生成提示词（防刷分）。
- 每个子代理只改自己目录；共享接口（schema、命名、坐标系）先冻结再开工。
- 同一阶段连续 2 次不过 → 降低野心（减资产 / 换简化拓扑 / 减镜头）；3 次 → 停，进人工闸门。

---

## 2. 提示词模板（复制即用）

### S0 · PRD
```
你是策划。为「<一句话主题>」写一份可执行的 prd.md（中文，克制）。
必须包含：1) 核心场景 3–6 个（每个：名字、一句话空间描述、玩家在这里做什么、情绪目标）；
2) 人物卡（名字、外观 3 条、动机、与世界的关系）；3) 剧情线（节拍，≤7 拍）；
4) 交互需求（每个场景 1–2 个动词）；5) 资产预算表（物件 | 走 Tripo 还是 Blender 直搭 | 优先级 P0/P1/P2）。
约束：预算 ≤ 40 个资产，P0 ≤ 12 个；不写代码；不做 UI 细节。
输出：prd.md；最后列出 3 条你最不确定、需要人拍板的点（这些是 G1 的问题）。
```

### S1 · 参考图（多视角）
```
你是概念美术。按 prd.md 的 <场景> 生成三张参考图：整体视图、俯视图（标出主要物体位置）、斜侧视图。
风格锁定：<画风>；配色：<3–5 个色值>；材质：<…>；光：<…>。
三张图必须是同一个空间的不同机位（用 reference_images 传入第一张，保持一致性）。
输出：refs/scene-<名>-{over,top,iso}.png。
人物：为 <角色> 生成 T-pose 四视图（正、侧、背、四分之三），细节一致，白底。
输出：refs/char-<名>-{front,side,back,three-quarter}-tpose.png。
验收：每张图分辨率 ≥ 1024；同机位组内角色/物件比例大致一致；俯视图能读出布局。
```

### S2 · 资产拆解
```
读 prd.md、assets-plan 与参考图。把每个可见物件分成三类并给理由：
tripo（细节多、难建：器物、雕像、复杂道具）/ blender（简单几何、重复件、地形）/ engine（程序化或贴图即可）。
输出 assets-plan.json：{id, name, class, why, source_ref（图上位置）, priority, poly_budget}。
规则：Tripo 资产 ≤ 12 件；单件面数预算 ≤ <N>；同类物件优先 Blender 参数化。
```

### S3 · Tripo 资产
```
用 threejs-3d-generator skill 生成 <id>：<一段外形描述>。
角色走多视图生成（上传 refs/char-<名>-*-tpose.png），先白模检查拓扑，再贴图。
道具用高精度模式。导出 glb 到 assets/library/<id>/，写 recipe.json（提示词、seed、模型版本、参数、来源图）。
验收：GLB 可被 three.js GLTFLoader 打开；面数 ≤ 预算；贴图 ≤ 2048；命名与 prd 一致。
失败重试：生成失败/破面 → 简化描述重试 1 次；再失败 → 换 Blender 直搭并在 recipe 里记原因。
```

### S4 · Blender 组装（headless）
```
用 Blender headless 组装 <场景>：/Applications/Blender.app/Contents/MacOS/Blender --background --python build/scene.py
对照 refs/scene-<名>-{over,top,iso}.png 复刻：比例、位置、朝向、材质、灯光、相机。
坐标约定：Y 上，米；同一资产的 pivot 在底心。
脚本必须可重跑（幂等），最后自动截图 4 机位（over/front/side/iso）到 shots/。
验收：存在 shots/*.png ≥4 张；重跑两次产物一致；无脚本报错。
```

### S5 · 盲审（独立模型）
```
你是审查者，没看过生成过程。给你的只有：意图（prd.md 的该场景段）、参考图、当前截图。
逐机位回答：1) 与参考图的关键差异（位置/比例/颜色/光，按严重度排序）；
2) 每条差异给出最小修改点（改什么参数/移动什么，不要重写方案）；
3) 一句话总评：像不像同一个空间？哪里最假？
输出 review.json：[{shot, issue, severity(1-3), fix, target}]。
禁止：给鼓励分、写新方案、改动风格。
```

### S6 · 绑骨与动作
```
用 Blender + Auto-Rig Pro 对 <角色> 绑骨蒙皮：骨骼对齐关节；导出前测试三个动作：
抬手 / 弯腿 / 转身。每个动作截图到 check/pose-*.png，并检查：穿模、变形、权重拉扯。
从 Mixamo 取 <动作名>.fbx，校验骨骼命名映射并适配；接触类动作（提、放、握）
用 IK 控制器迭代到手掌接触点误差 < 2cm、全程无穿模。输出 rig.json（骨骼映射表 + 已知限制）。
```

---

## 3. 验收与重试（机器可判的）

| 检查 | 命令 / 判据 |
| --- | --- |
| GLB 合法性 | `python3 -c "import trimesh,sys; m=trimesh.load('<f>.glb'); print(len(m.faces))"` ≤ 预算 |
| 截图齐全 | `ls shots/*.png \| wc -l` ≥ 4；分辨率一致 |
| 幂等重跑 | 连跑两次，产物 hash/尺寸一致 |
| three.js 加载 | 页面无控制台报错、模型可见（截图非空像素占比 ≥ 阈值） |
| 帧率 | p5 ≥ 50（沿用竹子 bench 的口径） |
| 盲审 | `review.json` 中 severity≥2 的条目数下降且 ≤ 阈值 |

重试纪律：单阶段 2 次不过 → 减野心；3 次 → 人工闸门；每次重试必须换一个变量（模型/提示词/资产类别），不许原地重试。

---

## 4. 两个落地实例

### A · 竹子 L3 升级（推荐，今天只缺 Tripo key）
- 目标：把已交付的某一幕（东郊 / 临淄点阵 / 咖啡厅）从程序化 2D 升为 3D 呈现；**事实账本不变，只换画面**（符合 `docs/presentation-pipeline-brief (2).md` §4）。
- 链路：Tripo → Blender（统一比例/朝向/减面/烘焙 LUT）→ `three.js`（浏览器内，无需 Unity）。
- 与仓库对接：资产进 `assets/library/`，新框架 `frameworks/world3d/`；导演可把同一份 PlanAct 排成 L1 或 L3。
- 缺件：`TRIPO_API_KEY`；Blender 插件（Auto-Rig Pro）仅在需要角色时确认。

### B · 独立 Unity 项目（原稿路线）
- 先决条件：安装 Unity Editor（`/Applications/Unity/Hub/Editor/<版本>` 当前为空）+ license；确认 Unity MCP 或 `-batchmode -executeMethod` 脚本可跑。
- 链路：Blender 资产 → FBX → Unity；本模板的 S0–S6 不变，只换 S7 引擎。
- 风险：Unity Editor 下载/许可/CLI 权限是三个独立失败点，建议单独一个子代理负责打通并出一份 hello-world 证据再说项目。

---

## 5. 挂到 Orca 编排的接法

- 一个阶段一个 Task；并行关系：S1 与 S2 可并行（S2 也读参考图，但可先起草）；S3 依赖 S2；S4 依赖 S3；S5 依赖 S4；S6 依赖 S3（可与 S4 并行）；S7/S8 收口。
- 每次派单都带：目标、范围（目录边界）、约束、验收命令、失败重试规则；worker 交付时附 `worker_done` 与产物清单。
- 盲审 worker **必须换模型**（例：建造者 `gpt-6.1-sol` → 审查者 `gpt-6-astra` / `deepseek-4.1-flash`）。
- 人工确认（G1–G4）由人回复一句「过 / 改哪里」；没确认不推进。

---

## 6. 下一步（需要人选一条）

- 选 **A**：我直接按 A 写 wave 任务书（先补 `TRIPO_API_KEY`，从「东郊一幕 3D 化」开跑），不影响当前 2D wave。
- 选 **B**：我先派一个 worker 打通 Unity Editor 安装 + `-batchmode` hello world，再开项目。
- 只要模板：此文件即为交付，可直接喂给任何 agent。
