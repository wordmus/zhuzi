# P4.5 呈现自己的信 · 验收记录

验收完成：两个新成品与旧长卷均 9/9，呈现五项 5/5，九张截图已逐张核对，控制台零报错。

以前只能从导演方案和日志猜呈现做了什么；现在每幕有署名为 presentation 的 presence 信，入口抽卷旁和工作室收到报告后都能拿起短简读全文。没有 withhold 记录时，信里和全文里都没有 withheld 一栏。可在 desk/17 的架上抽卷，或在 studio/9 接住报告后点击案上的短简验证。

## 命令

全部从仓库根目录执行；bench 前加 `NODE_OPTIONS="--require $PWD/frameworks/desk/acceptance-guard.cjs"`，只隔离报告输出，判定计算及门槛不变。

```sh
pnpm typecheck
pnpm present --intent intents/desk.json --tier L1 --seed 17
pnpm bench runs/desk/17/L1
pnpm present --intent intents/studio.json --tier L1 --seed 9
pnpm bench runs/studio/9/L1
node frameworks/desk/verify-entry.mjs
node frameworks/desk/verify-activity.mjs
node frameworks/desk/verify-presence.mjs
# desk 最后一次 UI 重建：不调用入口完成钩子
ZHUZI_PLAN="$PWD/runs/desk/17/L1/plan.json" ZHUZI_OUT="$PWD/runs/desk/17/L1/build" pnpm exec vite build
node frameworks/desk/replay-presence.mjs
npx tsx director/pipeline/works-index.ts
pnpm bench runs/fifty-years/9/L1
```

第一轮全部通过：typecheck exit 0；desk/studio/fifty-years 均 hard 9/9、errors 0、layers PASS；ENTRY PASS（宽/窄）、ACTIVITY PASS（6 项）、PRESENCE PASS（5/5）。最终版的逐字 stdout 在 `acceptance/*.log`；首次 desk present 输出保存在 `acceptance/desk-present-initial.log`，最后一次安全重建及重放另列日志。

## 为什么隔离输出

验收进程原本会写 `bench/report.json`、追加 `bench/history.csv`，还会重写被测 run 的 `bench.json/curve.csv`。协调者已批准只隔离这三类测量输出；不改 `bench/` 判定脚本、不改门槛。预加载的 `frameworks/desk/acceptance-guard.cjs` 把两份全局测量输出写到本目录的 `acceptance/bench/`，把既有长卷的测量输出写到 `acceptance/runs/fifty-years/9/L1/`；新 run 自己的 `bench.json/curve.csv` 仍写原新目录。

逐字节核对：`acceptance/redirect-audit.jsonl` 记录写入前待写字节的 SHA 和实际落盘字节 SHA，须全部相等；`studio-first-report-byte-check.json` 与 `fifty-years-report-byte-check.json` 还核对被重定向的全局报告和该次 run 报告完全同字节。隔离的 history 只含本任务追加记录，不冒充旧全局累计 history 的副本。

`presence-before-sha.json` 在首次新 run 生成后、任何 bench 之前记录 desk/13、studio/5、fifty-years/9 共 105 个既有文件；`presence-sha-verification.json` 给出逐文件前后 SHA，区分作品本体与测量输出。works-index 经协调者确认仍正常重建 `runs/index.json`，没有重定义字段。

首次执行规定的 desk present 命令时，管线会自动调用其它工人新增的 update-entry，stdout 出现 `entry runs/entry/index.html → ../desk/17/L1/index.html`；已立即向协调者报告，未直接编辑入口目录或更新脚本。之后等待协调者边界确认的 ask（msg_9fa22d525bd2）十分钟超时，改用安全路径：只对新 seed17 调 Vite 构建，再用原 bench/lib + bench/player 重放更新其 layers/trace/shots/report，不再调用管线的 entry 完成钩子；没有再次触碰入口目录。首次自动更新已报告协调者，入口最终链接由其确认。

## 没有做的部分

没有给旧成品追补 presence，旧 HTML 仍保持旧体验；各形的短信来自已有规则和真实日志，尚无模型即兴口气或逐镜头自动推导。新五项视觉验收直接覆盖入口和工作室；其它形的现有成品没有重建或另拍新短简。工作室方案保留四条既有校验 warning（入口台词句数与揭示顺序中的运行时元素），本次未改这些边界外方案。单页 PNG 瘦身、全量形回归和稳定入口定稿由其它工人/协调者拥有。

## 最终汇总

### `pnpm typecheck`

```text
$ tsc --noEmit
exit 0
```

### `pnpm present desk/17（首次规定命令）`

```text
layers 15 封信 · 未回执 0 · 检查通过
play   done  4 步 · 12.7s · 截图 6 · trace 98 条 · 报错 0
```

### `pnpm bench runs/desk/17/L1`

```text
PASS hard 9/9 · first-action 0.15s · first3s 1 · feedback p90 66ms · max-chars 18 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS
```

### `pnpm present studio/9`

```text
layers 30 封信 · 未回执 0 · 检查通过
play   done  28 步 · 72.3s · 截图 17 · trace 456 条 · 报错 0 · 账本 40 条
```

### `pnpm bench runs/studio/9/L1`

```text
PASS hard 9/9 · first-action 0.11s · first3s 1 · feedback p90 283ms · max-chars 28 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS
```

### `node verify-entry.mjs`

```text
ENTRY PASS · 12 screenshots · four layers never coexist · correction changes real commission().why · console errors 0
```

### `node verify-activity.mjs`

```text
ACTIVITY PASS · all 6 assertions passed · 14 screenshots produced:
```

### `node verify-presence.mjs`

```text
PRESENCE PASS · 5/5 · runs/desk/17/L1/presence-evidence
```

### `npx tsx director/pipeline/works-index.ts`

```text
works-index PASS · 43 件 · 43 个真实入口 · runs/index.json
```

### `pnpm bench runs/fifty-years/9/L1`

```text
PASS hard 9/9 · first-action 0.09s · first3s 1 · feedback p90 439ms · max-chars 28 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS
```

### `最终 desk 安全重放`

```text
REPLAY PASS · same bench/player · done 4 steps · 15 letters · pending 0 · check=[] · console errors 0 · ENTRY hook not invoked
```

- `runs/desk/17/L1`：`counts={"commission": 1, "plan": 1, "cue": 4, "report": 4, "retro": 1, "presence": 4}`；`check=[]`；未回执 `0`。
- `runs/studio/9/L1`：`counts={"commission": 2, "plan": 2, "cue": 10, "report": 10, "retro": 1, "presence": 5}`；`check=[]`；未回执 `0`。

## 截图（本轮最终版）

- `runs/desk/17/L1/presence-evidence/desk-before-extract.png`
- `runs/desk/17/L1/presence-evidence/desk-short-slip.png`
- `runs/desk/17/L1/presence-evidence/desk-full-letter.png`
- `runs/desk/17/L1/presence-evidence/no-record-no-withheld.png`
- `runs/desk/17/L1/presence-evidence/old-same-camera.png`
- `runs/desk/17/L1/presence-evidence/old-new-same-camera-comparison.png`
- `runs/desk/17/L1/presence-evidence/studio-lowering-slip.png`
- `runs/desk/17/L1/presence-evidence/studio-full-letter.png`
- `runs/desk/17/L1/presence-evidence/desk-short-slip-narrow.png`

主屏新短简检查最大 9 字；入口原有四层最大十八字；工作室/旧长卷的完整 bench 最大二十八字。窄屏 390×844 的短简在屏内，键盘 Enter 展开、Escape 合上并回到原物件。

## 这封信从哪来：两条真实 trace

`runs/desk/17/L1/trace.jsonl:58`

```json
{"kind":"world.event","layer":"L3","work":"east-suburb-3d/5/L3","url":"../../../east-suburb-3d/5/L3/index.html","t":11480,"eventKind":"desk.work.open"}
```

`runs/studio/9/L1/trace.jsonl:393`

```json
{"act":"studio","sourceReport":"report:han:1","predicted":"田伯开门后说的和心里预演的不一样","actual":"预演：给粟；实际：拒绝","error":{"layer":"mind","note":"预演：给粟；实际：拒绝"},"t":57315,"kind":"director.compare"}
```

第一条支持「我只为这一卷开门」，第二条证明演员报告已经收到并完成预演/实际对照，才轮到「我把回报留在案上」。取舍另逐字复制各幕 plan.withhold，不从这些事件推测不存在的舍弃。

## 旧文件与隔离报告字节

作品本体（HTML/plan/layers/report/shots 等）99/99 前后 SHA 相同；旧测量文件 6/6 也未被本次测试覆盖。受审计的隔离写入 6/6 待写字节与落盘字节的 SHA 相同；初轮未启用审计的旧长卷报告另有逐字节双副本核对通过。

| 旧测量文件 | 之前 SHA-256 | 之后 SHA-256 |
| --- | --- | --- |
| runs/desk/13/L1/curve.csv | 91666c0edc1b75303e0626130c62237d0d5b8eb985ab5be2cae1a40853090714 | 91666c0edc1b75303e0626130c62237d0d5b8eb985ab5be2cae1a40853090714 |
| runs/desk/13/L1/bench.json | 06aeaff1a8cf22835e3b8464d02436f5d60d24ae2b8215039f0523bd92b88031 | 06aeaff1a8cf22835e3b8464d02436f5d60d24ae2b8215039f0523bd92b88031 |
| runs/studio/5/L1/curve.csv | 58f264d652c8100d024a0dafc48cfcec30163e20d7e4a0104ae8ce00a72867f0 | 58f264d652c8100d024a0dafc48cfcec30163e20d7e4a0104ae8ce00a72867f0 |
| runs/studio/5/L1/bench.json | f24db5affe6a3a6f0e8f6ad5dfaf2e4e16bb473ccd3f2202240465bd67f2e6c9 | f24db5affe6a3a6f0e8f6ad5dfaf2e4e16bb473ccd3f2202240465bd67f2e6c9 |
| runs/fifty-years/9/L1/curve.csv | 61ea0807ff233fb6e3c89e5fe3065035347bac0eb7316800bb9e8678de351d6c | 61ea0807ff233fb6e3c89e5fe3065035347bac0eb7316800bb9e8678de351d6c |
| runs/fifty-years/9/L1/bench.json | 46cd236c7daecad463826e57c0bee54f71270f94b24edc5cc6510105f0dc1848 | 46cd236c7daecad463826e57c0bee54f71270f94b24edc5cc6510105f0dc1848 |

## 协作边界交接

- `components/presenter.ts` 的 presence 名称和自述分支由协调者补齐，本工未编辑该文件。
- `runs/index.json` 按协调者允许正常重建，最终四十三件、四十三个真实入口。
- 当前稳定入口 SHA 为 `9120c7627c4fb5e3a939bc2b8a88e1c42909e5aedf60965f374dbccdcade0848`，最终 desk/17 SHA 为 `95c38384350ec5fa20cb5745445db4fb0cff0a7e8d02ecc4a52a29d1677c0ffd`；两者不同，稳定入口的最终复制/链接请 ENTRY 所有者确认；本工没有再次写该目录。
