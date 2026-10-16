# 五十年长卷：S7 独立复验

验证日期：2026-10-16（Asia/Tokyo）。本轮只做验证、门槛与文档收口，不修改玩法、critic 或手工修改 runs 产物。所有指定命令均已完成并通过；坏夹具的预期FAIL属于自检通过，不是作品失败。

## 当前结果

新 seed 9 的长卷已完整试映：61 步、137.3 秒、41 张截图、999 条 trace、65 条事实、0 报错。43 封信全部有回执，check=[]。四件作品在原门槛与收紧后均为PASS hard 9/9（含layers），typecheck、10个指定测试脚本与两轮bench自检全部通过。三项棘轮全部保留，无回退；未改玩法代码。

可复验的小例子：打开 `runs/fifty-years/9/L1/index.html`，走到田伯章，掂刀币后选竹券；本轮模拟玩家留下 `qi-knife-lend`。工作室收回原局报告后，在反引号面板沿 `initialState.sourceReport` 找到原件，核对 actual 与 error；它复核本局，不会重演借粮。

## 命令与结果

所有命令从仓库根目录运行。present 负责生成，bench 负责评判；原始汇总行与退出码为验收依据。

| 命令 | 结果 |
| --- | --- |
| `pnpm present --intent intents/fifty-years.json --tier L1 --seed 9` | exit 0；done，61步，137.3秒，41截图，999条trace，65事实，0报错；43封信，无未回执，check=[] |
| `pnpm bench runs/fifty-years/9/L1` | exit 0；PASS hard 9/9 · first-action 0.07s · first3s 1 · feedback p90 269ms · max-chars 28 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS |
| `pnpm present --intent intents/studio.json --tier L1 --seed 5` | exit 0；done，39步，96.8秒，17截图，531条trace，45事实，0报错；25封信，未回执0，check=[] |
| `pnpm bench runs/studio/5/L1` | exit 0；PASS hard 9/9 · first-action 0.07s · first3s 1 · feedback p90 271ms · max-chars 29 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS |
| `pnpm present --intent intents/first-visit.json --tier L1 --seed 11` | exit 0；done，34步，78秒，13截图，459条trace，43事实，0报错；15封信，未回执0，check=[] |
| `pnpm bench runs/first-visit/11/L1` | exit 0；PASS hard 9/9 · first-action 0.06s · first3s 1 · feedback p90 240ms · max-chars 28 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS |
| `pnpm present --intent intents/han-act1.json --tier L1 --seed 7` | exit 0；done，23步，55.8秒，7截图，362条trace，39事实，0报错；9封信，未回执0，check=[] |
| `pnpm bench runs/han-act1/7/L1` | exit 0；PASS hard 9/9 · first-action 0.07s · first3s 1 · feedback p90 64ms · max-chars 29 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS |
| `pnpm bench:selftest` | exit 0；10项校验器检查OK；good PASS hard 9/9；bad按预期FAIL hard 3/9（first3s/feedback/max-chars/errors/notext/repro被拒），两夹具layers skipped；selftest PASS |
| `pnpm typecheck` | exit 0；tsc --noEmit |
| `npx tsx engine/mind/mind.test.ts` | exit 0；mind.test.ts ok |
| `npx tsx engine/world/sim.test.ts` | exit 0；全部通过，30个seed×三种策略，五种结局可达，同seed账本与心智日志一致 |
| `npx tsx engine/world/landscape.test.ts` | exit 0；30 seeds × 2 replays，marks ≥11、closings ≥9、self ≥9 |
| `npx tsx engine/history/history.test.ts` | exit 0；12件史事跨50年，推进、写回、重开与边界全部通过；史源是离线字段检查，不代替本轮在线核史 |
| `npx tsx director/pipeline/fifty-years.test.ts` | exit 0；五类信与逐幕报告、12件史事跨50年、真实存档只增账本、实际网页第二次来访均PASS；该脚本固定读取fifty-years/3，新seed另验 |
| `npx tsx frameworks/jixia-speakers/logic.test.ts` | exit 0；六派史源、五题复现、错题留种、连对与六成门槛PASS |
| `npx tsx frameworks/wude-wheel/logic.test.ts` | exit 0；五德相胜、夏商周三轮、错选重试、重复防抖、拖动五向PASS |
| `npx tsx frameworks/qi-knife/logic.test.ts` | exit 0；32 seeds × 四种掂量 × 三种出口，限制、代价、事实与复现PASS |
| `npx tsx frameworks/bells/logic.test.ts` | exit 0；32 seeds，2/3/4声三轮、错音重来、同seed与实际音频五度相生频率一致 |
| `npx tsx frameworks/studio/verify.ts` | exit 0；studio/2与fifty-years/3的原件一致、真实回执、check=[]、四焦点截图PASS；此脚本固定读取旧seed |

构建警告保留：fifty-years/9与first-visit/11各4条，studio/5与han-act1/7各3条；包含入口台词“等你一会儿了。先看这个。”不止一句，以及reveal列表里he／rumor／altar不是静态幕元素。校验错误均为0；本轮未修改这些台词或动态元素规则，hard 9/9不代表警告已经消失。

## 新 seed 产物断言

实际读取 `runs/fifty-years/9/L1/ledger.json`、`layers.json`、`trace.jsonl`，不改文件：

```text
PASS fifty-years/9 artifact assertions: history.event=12; span=50 years; history.decision=4; game facts=4; layers={"commission":2,"plan":2,"cue":19,"report":19,"retro":1} check=[]; act.enter=jixia-speakers,wude-wheel,qi-knife,bells
Game fact ids: jixia-speakers-questioned, wude-wheel-challenged, qi-knife-lend, bells-remembered
```

跨度用 history.event.* 的 day 最大值减最小值计算；历史 day 是距前356年的年数，不与《旱》的季节日历混用。判定要求至少3件史事、跨度至少40年、至少2条决定、至少2条游戏事实、五类信齐全且 check=[]、四游戏均有 act.enter。本轮实测全部满足。

另外对studio/5与fifty-years/9做只读工作室原件断言，两者均PASS：工作室提示指向早先的report:han:1；复核报告的actual、error、facts逐字不变，收件顺序合法，各有4张工作室截图，check=[]。

复验代码（仓库根目录）：

```sh
node --input-type=module <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir = 'runs/fifty-years/9/L1';
const read = name => JSON.parse(fs.readFileSync(`${dir}/${name}`, 'utf8'));
const ledger = read('ledger.json'), layers = read('layers.json');
const trace = fs.readFileSync(`${dir}/trace.jsonl`, 'utf8').trim().split('\n').map(s => JSON.parse(s));
const events = ledger.filter(f => f.id.startsWith('history.event.'));
const span = Math.max(...events.map(f => f.day)) - Math.min(...events.map(f => f.day));
const decisions = ledger.filter(f => f.id.startsWith('history.decision.'));
const games = ['jixia-speakers', 'wude-wheel', 'qi-knife', 'bells'];
const facts = ledger.filter(f => games.some(g => f.id.startsWith(g + '-')));
assert(events.length >= 3 && span >= 40);
assert(decisions.length >= 2 && facts.length >= 2);
assert.deepEqual(layers.check, []);
assert(['commission', 'plan', 'cue', 'report', 'retro'].every(k => layers.letters.some(l => l.kind === k)));
assert(layers.letters.every(l => l.receipt));
assert(games.every(g => trace.some(e => e.kind === 'act.enter' && e.framework === g)));
console.log('PASS', { events: events.length, span, decisions: decisions.length, gameFacts: facts.length, counts: layers.counts });
JS
```

## 棘轮

| 指标 | 验证前 | 目标 | 最终 |
| --- | --- | --- | --- |
| firstActionSec | 0.9 秒 | 0.6 秒 | 0.6 秒，保留 |
| fpsP5Min | 50 | 55 | 55，保留 |
| feedbackMsMax | 1000 毫秒 | 900 毫秒 | 900 毫秒，保留 |
| maxChars | 30 | 30 | 30，规格是≤30 |

先用原门槛跑四件作品，再改三项，重跑同四件作品的bench；全部通过，回退项为无。逐份读取四个最终bench.json，断言verdict=PASS、hard=9/9、layers=PASS、check=[]，并核对实际thresholds为0.6秒／55帧／900毫秒／30字，全部通过。layers=true是接手时已有设置，本轮仅调整三项数值。

### 收紧后重新运行bench

以下每条命令重新执行正常、删字与同操作复现；不是只拿旧数值与新门槛比较。

| 命令 | 新门槛结果 |
| --- | --- |
| `pnpm bench runs/fifty-years/9/L1` | exit 0；PASS hard 9/9 · first-action 0.12s · first3s 1 · feedback p90 315ms · max-chars 28 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS |
| `pnpm bench runs/studio/5/L1` | exit 0；PASS hard 9/9 · first-action 0.12s · first3s 1 · feedback p90 300ms · max-chars 29 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS |
| `pnpm bench runs/first-visit/11/L1` | exit 0；PASS hard 9/9 · first-action 0.07s · first3s 1 · feedback p90 268ms · max-chars 28 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS |
| `pnpm bench runs/han-act1/7/L1` | exit 0；PASS hard 9/9 · first-action 0.08s · first3s 1 · feedback p90 81ms · max-chars 29 · errors 0 · fps-p5 60 · notext PASS · repro PASS · layers PASS |
| `pnpm bench:selftest`（新门槛追加复验） | exit 0；10项校验器检查OK；good PASS hard 9/9（反馈101ms）；bad按预期FAIL hard 3/9，反馈限制显示900ms；selftest PASS |

## 产物在哪里

四个独立目录：`runs/fifty-years/9/L1/`、`runs/studio/5/L1/`、`runs/first-visit/11/L1/`、`runs/han-act1/7/L1/`，均由本轮present生成并经两轮bench验证。

- `index.html`：单文件试玩；`plan.json`：实际幕序。
- `shots/`：present的模拟玩家截图；长卷工作室为33—36号截图。
- `ledger.json`：实际发生的事实；`trace.jsonl`：进入每幕、点击、收发信与事实轨迹。
- `layers.json`：letters、counts与check；`history-save.json`：长卷整份存档。
- `report.json`：present的构建与试玩结果；`bench.json`：该作品的硬指标与所用门槛；`curve.csv`：体验谱。
- `bench/report.json` 是最近一次bench，后跑会覆盖；以各作品目录的bench.json为准。

## 支持与不支持

| 场景 | 当前边界 |
| --- | --- |
| 本机完整试玩 | 已生成单文件L1长卷；规则运行，不依赖实时模型 |
| 三层信件 | 委托、方案、提示、报告、回顾及真实回执可查；演出未结束时缺回顾是未完成，不能判全通过 |
| 长卷续接 | 同一浏览器、同一存储来源且localStorage可用时，保存已完成幕、年份和账本；重开不重复已完成决定 |
| 半局恢复 | 不保存光标、步行位置、半局答题或盖到一半的印；未完成幕从头进入 |
| 跨设备/跨浏览器 | 不支持云同步；单独复制history.state不足以恢复账本；不同来源的localStorage不共用 |
| 无本地存储 | Store退回内存，本页可运行；关页后不能保证继续存档，本轮尚未实测禁用存储浏览器 |
| 实时模型 | 本轮未接入或验证；三层信件是规则与数据记录，不代表真实模型协商 |
| 手机、读屏与真人体验 | 本轮自动bench不替代手机手工、读屏、可理解性或心流验收，未新增这些结论 |
| 历史表现 | 四个转折点可见，其他史事进入账本；不支持每年独立可玩章或逐年角色动画；齐水德是思想实验，辨言为导师回望材料 |

## 未完成与失败

指定验收没有失败或未完成项，未发生门槛回退。保留构建警告如上；没有修改玩法来消除警告。半局精确恢复、跨设备同步、实时模型接入不支持，禁用本地存储浏览器、手机、读屏与真人心流本轮未实测，不能由自动通过推断这些也通过。

手工修改仅README.md、bench/thresholds.json、新建本报告；README现含推门、导师台、工作室、四游戏的实际顺序、运行与bench命令和三层信查看入口。present自动生成四个runs目录，bench自动更新各目录bench.json/curve.csv及bench/report.json、bench/history.csv和自检产物；没有手改runs，没有git提交、checkout、stash或reset。
