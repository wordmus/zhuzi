# 东郊 · 3D（framework id：`east3d`）

独立 L3 短呈现：帛色正午、枯粟、田缝边的禾、右后方的井与桑树。总时长 **50 秒**，结束保留真实末帧；其他作品与事实账本不变。

| 时间 | 画面与当前动作 |
| --- | --- |
| 0–3 秒 | 斜俯田景微降；只有手边田缝可点、触或 Enter 确认 |
| 3–24 秒 | 落到禾右侧三分之四近景；无人操作时第 6 秒自行探土 |
| 24–42 秒 | 焦点交给天空；点、触、向上拖、空格或 Enter 确认；无人操作时第 32 秒自行望天 |
| 42–50 秒 | 镜头稍落回，高跪、缺口与空天一起保留；静观，无新动作 |

禾只说一次：**「天老爷，东郊还有我呢。」**（11 字，含标点）。字幕在右上帛色留白中。动作中的重复输入只给手或视线的小回应；动作完成后收起该焦点，不重播台词、不重启镜头。

探土只掉下一块薄土唇。深色小缺口、擦痕和碎土不恢复；碎土挡住原落手点，禾向右换手继续探。手臂与头用分件姿态驱动，直身只动髋以上，膝盖始终接地。望天不生水、不长苗。减少动态保留相同的两次自主行动、换手和留痕，只用短小过渡，不做持续漂移与循环尘屑。后台时间不计入 50 秒。

## 资产与预算

`assets/library/east3d/build.py` 使用本机 Blender 5.1.2、seed 7 生成全部 GLB，配方在同目录 `*.recipe.json`；`faces` 现在明确按三角面统计。重跑：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python assets/library/east3d/build.py
```

| 资产 | 三角面 | 说明 |
| --- | ---: | --- |
| ground | 32,768 | 26m 平面，约 1.4m 土板块，1024² 同位裂缝贴图，细裂浅起伏 |
| millet | 80 × 26 | 细杆、低垂穗；运行时实例合批，保留中间视线通道 |
| well | 208 | 井圈、桔槔、吊桶 |
| tree | 944 | 树干、主枝、低矮叶冠 |
| pots | 804 | 三只陶罐 |
| he-placeholder | 2,252 | 小头、交领大褶短褐、布带、发髻、鼻额、分指手、沾土双膝与草履 |

包含引擎日轮、土唇和接触阴影的实际全场三角面在 `ctx.handoff.east3d.triangles` 中可读，约 **39.3k**，低于 120k；实例按 26 丛计入。运行时把原资产色块写入顶点色，共用 **10 个材质**；近处土唇反馈与运镜同由探土行动带动。内部分辨率维持 CSS 尺寸 **62%**、pixel ratio 1，沿用舞台帧循环；没有调低 bench 门槛。Tripo 槽位保留，未使用外部生成服务；当前仍是程序化角色分件，无骨骼蒙皮。

## 验证

```sh
pnpm typecheck
ZHUZI_ENTRY=dev/east3d.html ZHUZI_OUT=dist-east3d npx vite build && pnpm bench dist-east3d/dev/east3d.html
pnpm present --intent intents/east-suburb-3d.json --tier L3 --seed 4 && pnpm bench runs/east-suburb-3d/4/L3
pnpm exec tsx frameworks/east3d/idle.test.ts
```

最后一条在 Playwright Chromium 中打开**构建页**，普通与减少动态各真实等待 55 秒，不点击、不调用动作、不拨快时钟。断言 done、6/32 秒的两次自主动作、只有一处缺口、换手、台词一次、无报错与末帧有真实画面。截图与 JSON 自证在 `docs/3d-design/east-suburb/evidence/`，命令汇总见同目录上级的 `d1-polish-report.md`。

复验：进入后第 2 秒点手前田缝，第 24 秒后点天或向上拖；镜头落回时原缺口仍在。也可以全程不碰页面，等到约第 50 秒比较终姿。独立自测页的旧输入台词由本框架收束到 PRD 台词，正式管线 plan 同样使用新台词。

边界：不支持自由走动或环绕、点井取水、点树移动、完全站立、下雨／季节／存档变化；移动端与真机 GPU 尚未纳入验收。减少动态有意缩小运镜幅度。
