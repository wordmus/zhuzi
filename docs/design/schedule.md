# 导师排期与年谱

入口仍是四层逐次进入。新增的东西只长在当前层：L1 案前木牍写下一件，L2 屏风挂导演年谱，L3 架旁木牌翻到另一种形。右缘黑漆书签打开明细，默认收起。

## 排期从哪里来

`engine/mind/schedule.ts` 的 `buildSchedule({ visits, previous, hypotheses, works, experience })` 只用已提供的真实索引作品建立候选，同一 intent 的多个 seed 不重复排。输入为空就返回空排期。

每项保存 `intentId/title/form/order/when/why/evidence`。`when` 为 next、later、dropped；标题最多六字，理由最多十八字。停留取 `visit.last.dwell` 的最长实测值，引用保留原始字段与毫秒；画面理由把已知物件叫作“案上”“导师案前”，不把技术标识当人话。纠正取 `mentor.hypotheses` 中 edited 的真实文本；已有形引用 `runs/index.json#intent/seed/tier`；被违反的规则引用年谱 `runEvidence` 中具体 bench JSON 指针。历史测量超过原规则目标与是否通过当时 bench 分开记录。

`createMentor().schedule(intent, plan)` 每次合并 `mentor.schedule`，`commission()` 的下一件、理由及工作篇幅跟随首项；调用当前作品的其它入口保留其当前意图。原 `Commission` 已有预算属性作为兼容接口保留，内部只叫 effort/scope，没有新增资源份额概念。全撤下时篇幅为零，空索引不补虚构作品。

抽屉“它下一步的排期”显示前三件；“上移／压后／撤下”写回 `mentor.schedule`，其余折入“还有 N 件”。新来访可以刷新证据与理由，但已保存的顺序和撤下决定不丢。localStorage 不可用时只有当前页记忆。

## 玩法集

`frameworks/desk/groups.ts` 根据真实 `form` 分组，每件恰属一组；另为尚无作品的已知形保留空牌。进入 L3 停在第一组，翻左侧木牌或向右键切组；组内向下键换帛条，中央亮帛条在新标签页打开已有 URL。只绘制当前组的牌名，空组留空牌并说“这种形还没装上”，不显示数量。

## 年谱

`pnpm exec tsx director/pipeline/experience.ts` 联接 `rules.json`、`cases.md` 的明确规则引用和现有 run 的测量证据，写 `experience.json`。每条保存来源、规则参数、案例号与证据位置。案例明确是设计文档，不冒充试玩；没有参数用 null，没有定年用 null，没有运行对照用空数组。`firstSeenAt` 是最早有日期的运行对照，不是规则诞生日。

L2 每次只题两块木牍，其余退暗。点中央木牍或向下键，吊灯与导师视线移向下一块，底部只说该条的一句理由。缺失或空数据只留下空木牍和“还没记下什么”。完整来源、案例与参数保留在物件的读屏描述和数据文件中。

## 可复验例子

打开 `/runs/desk/11/L1/index.html`，点票根到 L1，等右缘书签出现后打开抽屉。把第二件“上移”，下一次的打算立即改为这件；收起抽屉看木牍，刷新再打开，顺序仍在。继续点竹简到 L2，点亮木牍，吊灯换位；点右缘门到 L3，翻左侧木牌可见另一种形。没有该形作品时只有空牌，中央帛条不产生假入口。

验收脚本：`node frameworks/desk/verify-entry.mjs` 保留四层、回退、纠正、重载、新页等原断言；`node frameworks/desk/verify-schedule.mjs` 验证五项新增证据链并生成同机位对照。最终命令输出与限制见 `frameworks/desk/gap-desk-report.md`。
