# 齐法化

田伯在堂上掂量开不开仓。先拿起秤前的刀币，再任选民、王、家、名掂三次，最后亲手选择开仓、立券或关门。共五次动作，不用模型；通常约 15–30 秒，反复选同一样也算一次真正的掂量。没有倒计时，玩家停下来想时不会被替他做决定。

## 导演接入

导出 `qiKnife: Framework`，框架 id 为 `qi-knife`。`run(act, ctx)` 只交回事实与数值，不修改 `WorldState`，不注册主入口。

| 元素 id | 实物与含义 | actions |
| --- | --- | --- |
| `qi-scale` | 秤前一枚金线刀币；入场唯一焦点 | `begin` |
| `qi-people` | 门外乡邻剪影；民 | `weigh` |
| `qi-king` | 有朱印的征粮木牍；王 | `weigh` |
| `qi-home` | 麻袋与粟；家 | `weigh` |
| `qi-name` | 围观者与目光；名 | `weigh` |
| `qi-give` | 盛粟的粥钵；开仓 | `choose` |
| `qi-lend` | 两半竹券，六道朱刻；来年还两倍 | `choose` |
| `qi-close` | 仓门与横闩；关门 | `choose` |

`act.focus` 设为 `qi-scale`。前三秒只给刀币，之后展开四件实物；每步只有一个物件是焦点。点按与读屏走同一套 `ctx.aff.add()`，回车开始，1–4 掂量，1–3 决定。三个出口都可自由选择，金光只表示田伯此刻更偏向什么。

读取同名元素的 `represents` 和 `actions`；未提供元素时使用默认实物，显式提供却不授权对应动作时不开放该动作。`prominence` 不改实物布局。可选台词 id：`weigh-people`、`weigh-king`、`weigh-home`、`weigh-name`、`after-give`、`after-lend`、`after-close`，按 `act.budget.maxChars` 与 30 字双重截断。台词不参与判定，隐藏文字仍可走完。

## 掂量与后果

`logic.ts` 是纯函数：从 `ctx.rng.fork('qi-knife')` 得到田伯四项真实顾虑、征粮量与围观人数。所选顾虑越重，左盘越低；盘里是剪影或仓廪，右盘始终是粟与刀币。重复掂量会加重那项顾虑。三次记录只影响田伯的偏向，不封锁玩家的出口。

| 出口 | 看得见的变化 | 交回事实 id |
| --- | --- | --- |
| 开仓施粥 | 仓减五袋、门开、乡邻聚到粥钵前 | `qi-knife-give` |
| 借粟立券 | 仓减三袋、券分两半、来年还六袋 | `qi-knife-lend` |
| 合上仓门 | 粟留在仓里、门闩落下、乡邻散去 | `qi-knife-close` |

结果为 `{ facts, metrics }`，事实 `kind: 'decision'`、`by: '田伯'`、文字均不超过 30 字。`metrics` 包含 `weighings`、`choice`（0 开仓 / 1 立券 / 2 关门）、`stock`、`levy`、`durationMs`。`ctx.handoff.qiKnife` 留下选择、余粮与事实供下一幕读。时长会随玩家停留变化；同 seed 同动作的事实、秤重与库存可复现。

trace：`qi-knife.start`、`qi-knife.step`、`qi-knife.choice`、`qi-knife.end`；结果另记 `world.fact`（只记录，不直接写世界账本）。首个动作与每次选择当次事件内立即重画，秤用短补间移动，减少动态时直接落位。声音复用 `weight`、`soil`、`jar`、`tally-snap`、`gate-shut`，只在动手解锁后响。

## 史源与虚构边界

齐法化为齐国刀币；刀币的齐国归属可参看[大英博物馆齐国刀币馆藏](https://www.britishmuseum.org/collection/object/C_1883-0802-31)。画面是青铜刀形货币的概括，不是某件出土器物的逐线摹本。开仓、征粮压力、三袋借六袋还与田伯一家，都是为本游戏设计的虚构情境，不作为齐国普遍利率或具体史实。

## 自测与复验

```sh
pnpm typecheck
ZHUZI_ENTRY=dev/qi-knife.html ZHUZI_OUT=dist-qi-knife npx vite build
pnpm bench dist-qi-knife/dev/qi-knife.html
npx tsx frameworks/qi-knife/logic.test.ts
```

任务书原写的 `dist-qi-knife/index.html` 与 Vite 实际目录不同；协调者已确认使用以上 `dev/qi-knife.html` 路径，不改共享构建配置。`pnpm dev` 后打开 `/dev/qi-knife.html?seed=23`：点刀币，任点三件实物，再点粥钵、竹券或仓门，即可复验三个不同出口。独立页也通过现有 `engine/layers` 发送并接收委托、方案、演员提示、报告、回顾；`window.__zhuzi.result` 可读原始结果，`done` 完成后置真。

## 五十年长卷的位置

这是田伯的视角。建议在前 315 年前后伐燕与征粮的章节，在禾来叩门之前或之后插入这一幕；不要当作史书中已记载的个案。开仓事实可让后续乡邻更愿聚拢，立券事实可给次年债务章留下凭据，关门事实可改变禾下一次叩门的预期。上层应消费事实再更新后续章节，框架本身不推进年表。未接入正式主故事、未持久保存债券、未模拟整年经济；这些由整合者决定。
