# 东郊 · D1 精修验收

**结果：独立构建与 seed 4 正式产物均 PASS hard 9/9；55 秒无人操作普通／减少动态 2/2 通过。**

此前必须等观众先后点两次，天空很早开放，土屑也一直循环；现在禾会在同一片田里自行探土、换手、望天，50 秒后留下高跪与缺口的末帧。点击只提前给他一个注意方向，不能无限掏土或重播台词。

本轮只写入授权的 east3d 框架、程序资产、独立 plan/intent 与本件文档，按要求生成 `dist-east3d`、`runs/east-suburb-3d/4/L3` 和本件 bench 证据；未改其他作品、bench 判定或门槛、critic，也未执行 git 操作。

## 可以怎样复验

打开 `dist-east3d/dev/east3d.html` 或正式产物 `runs/east-suburb-3d/4/L3/index.html`，第 2 秒点禾手前的田缝；第 24 秒后点天空、向上拖或按 Enter/空格。土唇松动、指尖探入，原手位被碎土挡住，禾换到旁边继续探；望天时只出现「天老爷，东郊还有我呢。」，镜头落回后缺口仍在。完全不动页面，则第 6 秒自行探土、第 32 秒自行望天，第 50 秒完成。

四段是 0–3 / 3–24 / 24–42 / 42–50 秒；只有当段焦点可操作，已完成动作的短暂重复输入只给小回应。角色从髋部直起，膝盖不离土；镜头从斜俯降至右侧三分之四近景，沿视线仰到日轮，再稍落回；减少动态保留相同因果，用短小过渡。

## 资产与预算

Blender 5.1.2、seed 7 已重跑，生成文件与配方在 `assets/library/east3d/`。地裂是约 1.4m 土板块、1024² 同位烘焙，薄土唇、缺口、擦痕、一次落尘由引擎生成；角色新增交领、布带、发髻、鼻额、分指手、沾土双膝与草履。`recipe.faces` 明确按三角面统计，枯穗折垂 38°，26 丛实例计入全场。

运行时保留原有色块，把角色／道具颜色写进顶点色并共享材质；井、树、罐的静态分件合批。最终全场 39,311 三角面、10 个材质；无人操作的全程峰值普通模式 39 次、减少动态 38 次绘制，均低于 45。内部分辨率仍为 CSS 尺寸 62%、pixel ratio 1，舞台帧率策略不变，未降低任何 bench 门槛。实际基准采用仓库 helper 的 1280×720 Chromium；PRD G1 中暂记的 1280×800 已补充说明。

## 边界与未做部分

Tripo 槽位保留，未调用外部生成服务；角色是程序化分件驱动，没有骨骼蒙皮。未实现完全站立、自由走动或环绕、点井取水、点树移动、求雨、季节或存档变化，移动端与真机 GPU 未纳入验收。普通 bench 的截图反馈值包含探针采集开销，不将其冒充为严格的物理显示 100ms 实测。

## 命令与汇总行

```sh
pnpm typecheck
```

`tsc --noEmit`，exit 0。

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python assets/library/east3d/build.py
```

`EXPORT ground: faces=32768; millet: 80; well: 208; tree: 944; pots: 804; he-placeholder: 2252; DONE`。GLB 与 recipe 已同步更新。

```sh
ZHUZI_ENTRY=dev/east3d.html ZHUZI_OUT=dist-east3d npx vite build && pnpm bench dist-east3d/dev/east3d.html
```

构建 `6,207.49 kB`，exit 0；最终 bench：

```text
PASS hard 9/9 · first-action 0.36s · first3s 1 · feedback p90 287ms · max-chars 11 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS
```

```sh
pnpm exec tsx frameworks/east3d/idle.test.ts
```

`PASS idle (no-preference) · 55s 无输入 · done=true · crack=6.003s · sky=32.009s · gap=1 · hand-shift=1 · line=1 · triangles=39311 · materials=10 · peak-calls=39 · errors=0`。

`PASS idle (reduce) · 55s 无输入 · done=true · crack=6.015s · sky=32.021s · gap=1 · hand-shift=1 · line=1 · triangles=39311 · materials=10 · peak-calls=38 · errors=0`。

`PASS east3d idle 2/2`，exit 0；没有模拟点击或拨快时间。

额外浏览器实测：第 2 秒点击田缝后重复 Enter，第 24 秒用 Enter 望天后重复空格；`PASS interaction · gap=1 · hand-shift=1 · line=1 · done=true · errors=0`，结果见 `evidence/interaction.json`。

最终验证时临时用 `caffeinate -i` 包住浏览器命令，防止系统闲置休眠；未更改浏览器代码、bench 判定或门槛。Vite 有仓库现存的未来 native config loader 兼容提示，当前构建成功。

```sh
pnpm present --intent intents/east-suburb-3d.json --tier L3 --seed 4 && pnpm bench runs/east-suburb-3d/4/L3
```

正式管线输出：

```text
valid  ok  errors 0 · warnings 0
build  runs/east-suburb-3d/4/L3/index.html  6372 KB
layers 5 封信 · 未回执 0 · 检查通过
play   done  4 步 · 50.3s · 截图 6 · trace 39 条 · 报错 0
运行目录 runs/east-suburb-3d/4/L3 [ok] 51.4s
```

正式产物 bench，exit 0：

```text
PASS hard 9/9 · first-action 0.23s · first3s 1 · feedback p90 302ms · max-chars 11 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS
```

## 截图与原始证据

- [无人输入第 2 秒](evidence/idle-no-preference-2s.png)：只有田缝可操作。
- [无人输入第 10 秒](evidence/idle-no-preference-10s.png)：探土后，碎土与换手。
- [无人输入第 35 秒](evidence/idle-no-preference-35s.png)：日轮、望天与唯一一句台词。
- [无人输入第 55 秒](evidence/idle-no-preference-55s.png)：done 后的高跪与缺口末帧。
- [减少动态第 55 秒](evidence/idle-reduce-55s.png)：同样的因果终态。
- [正式产物末帧](../../../runs/east-suburb-3d/4/L3/shots/06-final-done.png)：导演管线实际产物；同目录还有另外五张试映截图。

机器可读记录：`evidence/idle-no-preference.json`、`idle-reduce.json`、`interaction.json`、`dev-bench.json`、`pipeline-bench.json`。简明命令回执见 `evidence/verification-summary.txt`。
