这份设计文档（Architecture &amp; Implementation Spec）已经将你的哲学设定完全转化为**可被 Coding Agent（如 Claude Code / Cursor / Windsurf 等）直接读取并写成代码的工程规范**。

文档严格遵循了你的最新界定：**底层心智与环境是纯数学符号驱动的“非人（Non-human）”状态机，LLM 绝不直接扮演底层角色，而是只做“人类高层语义”与“底层数学符号”之间的编译器与翻译器；唯有导师与人类的真实物理时间同频，导演与演员均运行在可任意缩放、剪辑的“呈现时间”中。**

你可以直接复制以下 Markdown 内容喂给你的 Coding Agent：

```markdown
# 东周实验室（娱乐引擎）核心架构与 MVP 实现规范
**Author:** 青竹 (System Architect)  
**Target Executor:** AI Coding Agent  
**System Positioning:** 个人化呈现生成引擎（生成玩法集与设计心智，而非单一固定游戏）

---

## 0. 核心架构铁律 (Core Axioms - 写代码前必读)

1. **LLM 的唯一职责是“翻译”（LLM as Semantic-Symbolic Translator）：**
   - 严禁让 LLM 直接在主循环中扮演 NPC 进行无状态的纯文本聊天。
   - 引擎底层运行的是**非人的数学符号系统**（向量加减、图连接替换、痕迹窗口）。
   - LLM 仅在高层工作，负责两件事：
     - **向下编译（Downward Compilation）：** 将人类的高层概念（如“墨家兼爱”、“靖康之耻的悲愤”）翻译为底层的数学滤波器权重、状态图重写规则（Skill Primitives）和初始参数。
     - **向上渲染（Upward Rendering）：** 将底层符号交锋产生的数学痕迹（Traces）与拓扑变化，翻译为人类可感知的镜头文本、剧情描述或多模态 Prompt。
2. **双轨时间流逝（Dual-Track Temporal Architecture）：**
   - **导师层（Mentor Layer）= 现实物理时间（Real-Time / Wall-Clock）：** 与用户真实时间 1:1 绑定。感知文件读写、系统负载与真实离线时长，驱动“秘密花园”缓慢演化，严禁突变。
   - **呈现层（Director & Actor Layer）= 呈现时间（Presentation Time / Montage Tick）：** 为体验而生，像电影剪辑一样可任意快进、慢放、倒流或跳跃。不同演员可拥有各自独立的局部时钟频率。
3. **禁止写死技能函数（No Hardcoded Skill Functions）：**
   - 所有的“角色与环境交互能力”必须表示为可序列化的**数学符号数据结构**（前置条件向量 + 状态变更算子 + 关系图查找替换规则），由通用算子引擎统一执行，以便导演在运行时动态组合新玩法。

---

## 1. 目录结构规范 (Directory Layout)

请按照以下模块化结构初始化项目（默认使用 Python 3.11+ 与 Pydantic 进行严格的数据结构校验）：

```text
dongzhou_engine/
├── core/
│   ├── schema.py          # 核心数学符号定义（状态表、算子、图重写规则、痕迹）
│   ├── engine.py          # 通用符号执行器（处理向量加减与图查找替换，不含任何具体剧情代码）
│   └── clock.py           # 双轨时钟管理器（WallClock 真实时间 vs MontageClock 呈现时间）
├── minds/
│   ├── mentor.py          # 导师心智（管理秘密花园、用户预期模型、孵化双世界参数）
│   ├── director.py        # 导演心智（双世界嵌套结构、电影/游戏孔径滑杆、组装控制器与技能）
│   └── actor.py           # 演员心智（底层器官脉冲、滑动痕迹窗口、高层概念压缩滤镜、以己度人模型）
├── presentation/
│   ├── unit.py            # 呈现基本单元组装器（Controller + SkillOperators + PlotterFunctor）
│   └── multimodal.py      # 多模态资产网关与“反向坍缩”裁决器（生成资产反向修改世界设定）
├── translator/
│   └── llm_bridge.py      # LLM 翻译器（唯一允许调用 LLM API 的模块：负责语义<->符号双向转换）
├── presets/
│   └── qingzhu_genesis.py # 青竹创世母版（首次初始化的双世界模板与东周历史RPG种子参数）
└── main.py                # 引擎点火入口与交互验证 CLI/Web 闭环

```

## 2. 核心数据结构规范 (`core/[schema.py](http://schema.py)`)

Coding Agent 必须使用 `Pydantic` 实现以下纯符号化数据结构，不得将具体业务逻辑硬编码为类方法：

### 2.1 世界状态底表 (`WorldState`)

世界由“连续数值向量”与“离散关系有向图”共同构成：

- `continuous_vars`: `Dict[str, float]` —— 全局或局部连续状态（如环境温度、粮草总量、城池警戒度）。
- `relation_graph`: `List[Tuple[str, str, str]]` —— 离散拓扑三元组 `(Subject_ID, Relation_Type, Object_ID)`，如 `("Actor_Mozi", "HOLDS", "Token_A")` 或 `("State_Qin", "ALLIED_WITH", "State_Zhao")`。

### 2.2 交互能力/可组合技能算子 (`InteractionOperator`)

彻底取代 `def skill()`，任何交互能力均表示为以下符号三元组：

- `operator_id`: `str` —— 纯数学编号（如 `OP_001`，不带特定剧情语义）。
- `guard_conditions`:
  - `numeric_bounds`: `Dict[str, Tuple[Optional[float], Optional[float]]]` —— 触发门槛（大于/小于多少才可用）。
  - `required_edges`: `List[Tuple[str, str, str]]` —— 查找图模式 L（必须存在的连线，支持变量占位符如 `$Self`, `$Target`）。
- `effects`:
  - `delta_vector`: `Dict[str, float]` —— 对连续状态的加减法数组（支持算子间线性叠加：\\alpha \\hat{O}\_1 + \\beta \\hat{O}\_2）。
  - `remove_edges`: `List[Tuple[str, str, str]]` —— 擦除的旧关系线。
  - `add_edges`: `List[Tuple[str, str, str]]` —— 替换的新关系线 R。

### 2.3 呈现基本单元 (`PresentationUnit`)

一个小游戏或一段电影场景的解耦表示：

- `aperture`: `float` (取值 `0.0` 到 `1.0`) —— **预期验证权阀门**。
  - `0.0` = 纯电影模式（镜头完全由导演控制，剥夺用户操作以制造宿命感/张力）。
  - `1.0` = 纯沙盒游戏模式（开放交互控制器，让用户通过操作验证自身预期）。
- `active_operators`: `List[InteractionOperator]` —— 当前场景被导演激活的可组合技能池。
- `controller_mapping`: `Dict[str, str]` —— 将用户的物理输入动作映射到底层 `operator_id`。
- `plotter_functor`: `Dict[str, str]` —— **剧情器（词典映射表）**。将底层的抽象符号（如 `VAR_X`, `EDGE_A`, `OP_001`）实时翻译为当前主题的具象名词（如 `黄金`, `盟约`, `游说离间`）。

## 3. 三层心智架构实现规范 (`minds/`)

### 3.1 演员心智 (`minds/[actor.py](http://actor.py)`) —— 拒绝概念数值，使用心智痕迹驱动

每个演员是一个自包含的符号动力学个体，包含以下四个组件：

1. **底层本能模块 (**`DriveOrgans`**)：**
   - 预定义生理/基础实体模块（如 `Stomach_Hunger` 胃、`Pain_Avoidance` 痛觉、`Kin_Attachment` 血缘）。
   - 每个模块按各自的频率（高频/低频）产生原始刺激脉冲向量 I\_{raw} \\in \\mathbb{R}^d。
2. **高层概念压缩滤镜 (**`ConceptFilter`**)：**
   - 用一个权重变换矩阵 W\_{concept} 表示高层思想（如“墨家兼爱”、“法家酷吏”、“商贾重利”）。
   - **信息压缩计算：** 原始信号经过滤镜后得到高层有效刺激 I\_{effective} = W\_{concept} \\cdot I\_{raw}（低权重维度作为噪声被过滤，高权重维度刺激高层决策）。
   - *示例：* “兼爱”滤镜会强制将 `[自身利益, 亲人利益, 陌生人利益]` 的关注权重拉平为 `[0.5, 0.5, 0.5]`，从而在底层 `[胃]` 发出饥饿高脉冲时，在数值上自然产生“自保”与“兼爱”的内生张力冲突。
3. **意识与滑动痕迹窗口 (**`TraceTape`**)：**
   - 固定容量为 N 的先入先出队列（Deque）。
   - 每一帧记录当前的 `Trace = (底层激活信号, 环境反馈快照, 上一帧意识残影)`。当前决策必须读取该窗口内的连续痕迹，实现连续自我感。
4. **以己度人认知投射 (**`TheoryOfMindProjector`**)：**
   - 当演员 A 观察演员 B 的行动时，**禁止直接读取 B 的真实参数**。
   - 演员 A 必须将 B 的外显行为代入 **A 自己的** `ConceptFilter` **结构** 中，反推 B 的意图参数（从而在数学上自然涌现误解、偏见与知己感）。

### 3.2 导演心智 (`minds/[director.py](http://director.py)`) —— 双世界嵌套与呈现设计

1. **双世界结构 (**`DualWorldContext`**)：**
   - `outer_world`（导演身处的世界）：包含导演的私人经历/创伤参数 + 所在时代的公共知识库（例如：身处北宋靖康之变后的落魄学者）。
   - `inner_world`（导演设计的呈现世界）：导演基于外层视角去建模的目标世界（例如：他眼中的东周列国刺客传）。
   - `biography_stream`：记录导演在调整 `inner_world` 规则时的思辨与犹豫，可随时导出为“导演传记”供用户阅读。
2. **导演的核心行动（修改公式而非填数字）：**
   - 模拟推演：基于自身心智对用户体验进行建模估计。
   - 动态扩充能力：当发现当前演员或用户的行动受限、无法达到目标体验张力时，导演通过组合现有的 `InteractionOperator`（或请求 `llm_bridge` 编译新算子）向环境中注入新技能。
   - 调节孔径：实时调整 `PresentationUnit.aperture`，在“电影镜头控制”与“游戏交互验证”之间无缝滑动。

### 3.3 导师心智 (`minds/[mentor.py](http://mentor.py)`) —— 现实流逝与秘密花园

1. **原生机器感官 (**`MachineSensors`**)：**
   - 不伪造人类肉体感官，直接读取真实系统状态：`file_io_count`（文件读写频次）、`compute_load`（算力消耗）、`user_elapsed_seconds`（用户真实离线/在线物理时间流逝）。
2. **秘密花园空间锚点 (**`SecretGardenState`**)：**
   - 维护一个持久化的 JSON 状态树（代表花园的景观、植物生长度、气候、石碑档案）。
   - **平滑演化约束（Smooth Evolution Constraint）：** 每次更新时，状态向量的单步变化率必须受真实时间差 \\Delta t\_{real} 严格限制（\\Vert{}\\Delta G\\Vert{} \\le k \\cdot \\Delta t\_{real}）。严禁在一次交互中将“花园”突变为“飞船”。
3. **用户心智建模：**
   - 收集用户在呈现中的交互验证数据（操作频率、在电影/游戏模式下的停留偏好），更新 `UserMentalModel`，并向导演下发新的主题与资源配额。

## 4. LLM 翻译桥与多模态反向坍缩 (`translator/` &amp; `presentation/`)

### 4.1 语义-符号翻译器 (`translator/llm_[bridge.py](http://bridge.py)`)

封装三个核心接口（使用 Structured Outputs / JSON Schema 强制返回合法符号）：

1. `compile_concept_to_symbol(concept_text: str) -> ConceptFilter | InteractionOperator`
   - 输入人类高层概念（如“战国合纵连横的游说术”或“墨家兼爱”），输出对应的矩阵权重或图重写规则 (L \\leftarrow K \\rightarrow R)。
2. `translate_traces_to_presentation(traces: List[Trace], functor: Dict[str, str], aperture: float) -> str`
   - 输入底层的纯数学痕迹变化与剧情器词典，输出符合当前导演“双世界”腔调的镜头语言或交互提示。
3. `evaluate_emergent_asset(asset_description: str, current_world: WorldState, director_context: DualWorldContext) -> bool`
   - 服务于**多模态反向坍缩**（见 4.2）。

### 4.2 多模态资产的“去留裁决” (`presentation/[multimodal.py](http://multimodal.py)`)

当调用外部文生图/视频/音频接口生成资产时，模拟生成模型带来的“意外涌现”：

- 生成结果除了返回媒体文件外，还会通过视觉/语义解析提取出画面中的**意外细节标签**（Emergent Tags，如设定之外出现的神秘器物或反常天气）。
- 触发导演心智裁决：若决定“留（Keep）”**，则调用** `llm_bridge` **将该意外细节编译为新的节点与** `InteractionOperator` **反向写入** `WorldState`**；若决定**“去（Discard）”，则抹除该特征重新生成。

## 5. 青竹创世母版 (`presets/qingzhu_[genesis.py](http://genesis.py)`)

请在该文件中硬编码由架构师“青竹”首次设定的初始结构数据，作为引擎启动的第一粒种子：

1. **初始秘密花园：** 包含 `[青竹轩, 记事石碑, 算力溪流]` 三个基础节点，绑定真实系统时间戳。
2. **初始双世界模板：**
   - **外层导演（Outer Director）：** 设定为一位对“秩序崩坏与个体信义”极度执着的观察者，偏好冷峻的镜头控制，但在关键道德困境时会突然将孔径滑杆推向 `1.0` 逼迫用户亲自抉择。
   - **内层世界（Inner World - 东周历史 RPG 原型）：**
     - 初始化两个核心演员心智种子：`Actor_Mo`（搭载 `[胃: 高频]` + `[兼爱滤镜]`）与 `Actor_Merchant`（搭载 `[安全感: 中频]` + `[功利滤镜]`）。
     - 初始化 3 个纯符号基础算子：`OP_TRANSFER`（物品/资源转移与关系重连）、`OP_SEVER`（切断同盟/连接并引发愤怒增量）、`OP_ENDURE`（压制底层器官脉冲以维持高层信念）。

## 6. 分步实施计划 (Execution Milestones for Coding Agent)

请按以下顺序分步编写并运行测试，每完成一步向我汇报：

- **Milestone 1 (纯符号内核验证):** 实现 `core/[schema.py](http://schema.py)` 与 `core/[engine.py](http://engine.py)`。在不接入任何 LLM 的情况下，通过单元测试证明：仅靠向量加减与图查找替换，就能跑通 `OP_TRANSFER` 和 `OP_SEVER` 的组合，以及演员内部 `[胃]` 与 `[兼爱滤镜]` 的数值冲突与“以己度人”参数反推。
- **Milestone 2 (双轨时钟与秘密花园):** 实现 `core/[clock.py](http://clock.py)` 与 `minds/[mentor.py](http://mentor.py)`。实现真实时间持久化存档，验证每次启动程序时，导师能根据真实流逝的秒数和文件操作数，平滑更新秘密花园的状态并输出符合其“机器感官”的自述。
- **Milestone 3 (双世界导演与呈现单元组装):** 实现 `minds/[director.py](http://director.py)` 与 `presentation/[unit.py](http://unit.py)`。实现电影/游戏孔径滑杆（Aperture）切换逻辑，以及同一个底层算子在不同 `plotter_functor` 词典下的换皮呈现。
- **Milestone 4 (接入 LLM 翻译器与完整闭环):** 实现 `translator/llm_[bridge.py](http://bridge.py)` 与 [`main.py`](http://main.py)，连接青竹创世母版，跑通一个完整的交互回合（导师感知真实时间 -&gt; 导演在双世界下组装东周场景并披露传记思考 -&gt; 玩家交互验证预期 -&gt; 演员基于心智痕迹反应）。

```

---

### 给你的使用建议（作为“青竹”如何指挥 Coding Agent）：

1. **先锁死 Milestone 1（最关键的防跑偏步）：** 现在的 Coding Agent 看到游戏或 Agent 需求，本能反应就是去写 `prompt = "你是一个东周刺客..."`。上面这份文档在 **Milestone 1** 强制要求它**在完全不import LLM 库的前提下**，先把“胃与兼爱滤镜的数学冲突”、“以己度人的矩阵反推”和“算子加减法”用纯 Python 跑通。这能从根源上保证你的底层是纯正的符号系统。
2. **随时注入你的审美：** 在 `presets/qingzhu_genesis.py` 那一节，我目前放了一个通用的“东周墨者与商人”种子。当你把代码框架跑起来后，你可以随时亲手修改那个文件里的第一个“外层世界导演设定”——那就是你作为青竹赋予这台机器的第一个真正意义上的母本。

要不要我现在直接帮你把 **Milestone 1（纯数学符号内核 + 胃与兼爱的冲突 + 以己度人认知投射）** 的核心 Python 原型代码写出来，你既可以先看一眼它在代码里长什么样，也可以直接拿去作为给 Coding Agent 的 Few-shot 范例？

```