# 五十年长卷：临淄的人怎样被时代推着走

以前《旱》只能过四季，历史没有年份，也不会留下跨章的痕迹。现在 `engine/history` 可以从前356年走到前306年：12件事件按年进入人的生活，决定反过来改变民心、粮、国力与礼制，事件与决定都追加为事实。运行 `npx tsx engine/history/history.test.ts` 可直接复验“桂陵赢了，禾却还要交粮；禾留种粮，粮与民心改变”的例子。

本轮交付的是供导演接入的纯逻辑、年表与接线说明，尚未把玩家界面接成长卷；这属于第二波整合。没有改 `engine/types.ts`、`engine/world/sim.ts` 或其他 worker 的文件。

## 时间表与核验

核验日期：2026-10-15。12件、实际事件跨度50年、已核验12件、待核0件。`verified` 只说明事件与年份有下列书中依据；人物对白、征粮落到哪家及宏观变化数值均是创作设定，不属于已核验史实。纪年按这里明确列出的版本，不宣称消除了先秦纪年的全部争议。

| 年份 | 事件 | 进入谁／以什么处境 | 一句话（创作） | 出处与定位 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 前356 | 齐赵会平陆 | 季／盟约 | 齐赵在平陆会盟了。 | [《史记·六国年表》](https://zh.wikisource.org/zh-hant/史記/卷015)，周显王十三年齐、赵栏 | 已核 |
| 前353 | 桂陵之战 | 禾／军粮 | 魏军败了，粮还得交。 | [《资治通鉴》卷二](https://zh.wikisource.org/wiki/資治通鑑/卷002)，显王十六年 | 已核 |
| 前350 | 秦开阡陌 | 田伯／田界 | 秦人连田界也改了。 | [《资治通鉴》卷二](https://zh.wikisource.org/wiki/資治通鑑/卷002)，显王十九年 | 已核 |
| 前348 | 齐威王朝周 | 季／朝礼 | 齐王还肯去朝周天子。 | [《资治通鉴》卷二](https://zh.wikisource.org/wiki/資治通鑑/卷002)，显王二十一年 | 已核 |
| 前341 | 马陵之战 | 田伯／军功 | 魏败了，谁家的儿郎回？ | [《资治通鉴》卷二](https://zh.wikisource.org/wiki/資治通鑑/卷002)，显王二十八年 | 已核 |
| 前334 | 徐州相王 | 季／王号 | 如今齐魏互称王了。 | [《资治通鉴》卷二](https://zh.wikisource.org/wiki/資治通鑑/卷002)，显王三十五年 | 已核 |
| 前316 | 秦取蜀 | 田伯／强邻 | 秦又得了蜀地。 | [《资治通鉴》卷三](https://zh.wikisource.org/wiki/資治通鑑/卷003)，慎靓王五年 | 已核 |
| 前314 | 齐伐燕 | 禾／北征 | 燕地拿下，征粮又来了。 | [《资治通鉴》卷三](https://zh.wikisource.org/wiki/資治通鑑/卷003)，赧王元年；此年同载孟子论燕民之意 | 已核 |
| 前313 | 楚绝齐交 | 季／盟约破裂 | 楚把齐国的盟约断了。 | [《资治通鉴》卷三](https://zh.wikisource.org/wiki/資治通鑑/卷003)，赧王二年 | 已核 |
| 前311 | 燕昭王元年 | 乡邻／北方消息 | 北边燕国有新王了。 | [《史记·六国年表》](https://zh.wikisource.org/zh-hant/史記/卷015)，周赧王四年燕栏 | 已核 |
| 前307 | 赵行胡服骑射 | 小石／新军装束 | 赵人换了衣裳学骑射。 | [《资治通鉴》卷三](https://zh.wikisource.org/wiki/資治通鑑/卷003)，赧王八年 | 已核 |
| 前306 | 甘茂奔齐 | 禾／来客 | 秦来的大臣也进齐了。 | [《资治通鉴》卷三](https://zh.wikisource.org/wiki/資治通鑑/卷003)，赧王九年 | 已核 |

以上三处链接都已实际打开阅读，对照了相应年段。前356年用平陆会盟替换“商鞅变法开始”：卷二把定变法令系于前359年，不能拿它给前356年的起始日背书。桂陵采用前353年，前354年是魏围邯郸的阶段；齐伐燕采用卷三所系前314年。

“燕昭王元年”严格指表内开始纪年的前311年：同一表的前312年另载拥立公子平，因此不把前311年包装成没有争议的即位日，也不把漫长招贤过程压到那一年。前320年齐威王卒、孟子约前317年至齐、田文约前309年为相、前306年宣王末年均未作为独立事件录入，避免混用齐国纪年或把大致年份冒充确定年份。“王何必曰利”是对梁惠王说的，不能写成季在齐国亲历的对白。

## 宏观怎样走到人面前

四个量都是0到1的剧情状态：`minxin` 是临淄视角的民心，`grain` 是可支配粮，`power` 是齐在列国中的相对力量，`rites` 是旧礼制的稳定度。秦或赵变强会降低这里的相对 `power`，不是说秦变法直接毁掉了齐国粮仓。事件的变化绝对值不超过0.2；个人决定没有这个幅度限制，但更新结果始终夹在0到1。

事件先改变这些量，`enter(e)` 再交出“谁听见了什么、哪一年”。它不给角色自动灌入信念：桂陵胜利与禾的“打赢便能少交粮”相撞，才构成预测误差。导演需要保留角色之前的预期，呈现征粮后的实际处境，再让角色按已有心智规则更新、拒绝或行动。不要凭战争标签虚构一条 `Beat.error`，那种拍还要求真实的预测、结果与信念前后值。

反方向由具体行动触发：禾留下种粮并和乡邻分担征粮，导演调用 `writeBack({ by:'禾', decision:'留下种粮，和乡邻分担征粮', delta:{grain:0.03,minxin:0.02} })`；卖田可增加眼前粮却损害后续民心；田伯开仓会改粮的去向和人的依赖。这些量是剧情聚合，不是史学计量。角色做完之后才写回，不能把玩家点了建议当成角色已接受。下一章读同一份宏观状态决定处境，例如有无余粮、来借粮的人多不多，而非每章重置。

玩家只见到征粮的袋、空瓮、关门、季改口、田伯犹豫；四个小数、内部编号、核验标记不放上玩家屏幕。供导师与导演查看的诊断面板可以显示。50年也不能让所有人始终保持开场年龄：小石在后段应已是成人，禾与季要老去；本模块不模拟年龄、死亡或继承，整合时必须交代跨代视角，不能让儿童原样站50年。

## 给整合者的接线点

1. 从 `engine/history/index.ts` 导入 `loadHistory`、`createHistory`；类型由 `engine/history/types.ts` 导出，直接复用 `engine/types.ts` 的 `Fact`，不用改共享契约。
2. 导演给每个章节分配绝对年份。只在章节边界调 `advanceTo(year)`，不在《旱》的每一天调；第一章要主动 `advanceTo(span.from)`，这样起始年的事件也能进场。内部会排序输入、跨年触发、避免重播；倒退返回空数组且不改状态。没有事件的年份只移动游标。
3. 对返回的每件事调用 `enter(e)`，折为已有 `say`、`layer` 或 `rumor` 拍。人物显示名映射到演员id，不要拿中文姓名直接冒充演员id。多件事跨年来到时按章排演，不能在一屏堆12句话。
4. 角色确实作决定后才 `writeBack`，其返回状态用于下一章处境。`year` 省略时用当前年；显式年份只允许已走过的年段，不替你推进时间。非法年份、非有限数字、非法宏观键会在改动状态前报错。
5. 用 `store.set('history.state', {version:1,state:history.state(),ledger:history.ledger()})` 把游标、宏观和账本放在同一条存储中。恢复时把 `saved.state.year` 当 `startYear`、宏观及账本一起传回；已发生事件从账本的 `history.event.<id>` 恢复，勿只存年份或只存 `fired`。
6. 历史事件事实编号是 `history.event.<事件id>`，决定是 `history.decision.<递增数>`；恢复时会跳过旧决定编号。`Fact.day` 在历史账本中是距完整事件表起点的年数（前356年为0，前341年为15），正文同时保留绝对年份；它不是世界模拟的第几天。不要用这个字段推进 `World`，不要把两种时钟混排序。
7. `ledger()`、`events()`、`state()` 与返回事件都是副本，旧事实不会因外部修改而变。历史账本单独保存在存档里；交付时可与世界账本合并输出，历史编号有命名空间，不覆盖原世界账本。本模块不操作 DOM、`localStorage` 或 `World`。

下面是对现有 `Beat`、`Store` 形状的接线示例，供整合者放进导演/运行时；本轮没有越界修改它们：

```ts
import { createHistory, loadHistory, type HistoryState } from '../../engine/history';
import type { Beat, Fact } from '../../engine/types';
import type { Store } from '../../engine/store';

function openArc(store: Store) {
  const table = loadHistory();
  const saved = store.get<{version:1; state:HistoryState; ledger:Fact[]} | null>('history.state', null);
  const history = createHistory({
    events: table.events,
    startYear: saved?.state.year ?? table.span.from,
    macro: saved?.state.macro ?? table.macro,
    ledger: saved?.ledger ?? [],
  });
  const persist = () => store.set('history.state', {
    version: 1, state: history.state(), ledger: history.ledger(),
  });
  const actors: Record<string, string> = {
    禾: 'he', 桑: 'sang', 小石: 'xiaoshi', 季: 'ji', 田伯: 'tianbo', 乡邻: 'linren',
  };
  const chapter = (year: number): Beat[] => {
    const beats: Beat[] = [];
    for (const event of history.advanceTo(year)) {
      const entry = history.enter(event);
      const who = actors[entry.who] ?? 'linren';
      beats.push({ kind: 'say', who, text: entry.line });
      // 这是冲击的呈现提示；真实误差由整合后的角色预期与处境比较得出。
      beats.push({ kind: 'layer', who, layer: 'mind', cause: event.enters.as });
    }
    persist();
    return beats;
  };
  return { history, chapter, persist };
}
```

如果改用 `rumor`，要另外构造完整 `Clue`（包括世界日、地点、`trait/sign` 和真假），并进入世界的已知线索流程；`enter()` 的三个字段不足以直接伪装成 `Clue`。`kind:'scholar'` 在甘茂事件中用于人才流入，不表示他是稷下教师。示例演员id应再与所用 `WorldConfig.people` 核对。

存档时保持完整且同版本的事件表：恢复后的 `fired` 从事件事实推导，宏观从保存快照读取，不再次叠加旧 effects。没有提供修改事件历史、回滚年份、账本压缩、自动迁移旧版本或撤销决定的接口。重复调用 `writeBack` 代表两次实际行动；整合层须在消费同一个结局时去重，不能靠决定文本自动合并。

## 本轮复验记录

| 验证 | 结果 |
| --- | --- |
| `npx tsx engine/history/history.test.ts` | exit 0；31条全部 `ok`：年表约束、跨年顺序、去重、夹取、个人写回、账本前缀不变、确定性、外部修改隔离及存档重开 |
| `npx tsx engine/world/sim.test.ts` | exit 0，全部通过；3种策略×30个 seed，世界未改动 |
| `pnpm typecheck` | exit 0，无类型错误 |
| Vite 内存构建 `engine/history/index.ts` | exit 0，1个 bundle；`configFile:false`、`write:false`，验证 JSON 能被 Vite 打包且没有写产物 |

不需要新增依赖，未安装包，未动 git，未生成或手改作品产物。玩家入口与完整导演管线的跨章试玩、角色年龄与心智接入、行动到写回的具体策略及存档迁移留给整合阶段；上述测试证明的是长卷逻辑可用，不表示界面已经接通。
