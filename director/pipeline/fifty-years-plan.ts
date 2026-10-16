import type { PlanAct } from '../../engine/types';
import { loadHistory } from '../../engine/history';
import { studioAct } from '../../frameworks/studio/plan';

export const CHAPTER_YEARS: Record<string, number> = {
  'chronicle-356': -356, 'chronicle-334': -334,
  'chronicle-314': -314, 'chronicle-306': -306,
};

/** 新长卷独享编排；旧意图仍返回原来的四幕。 */
export function fiftyYearsActs(threshold: PlanAct, reveal: PlanAct, han: PlanAct, ret: PlanAct): PlanAct[] {
  const budget = { ...han.budget };
  const element = (id: string, represents: string, action: string) => ({
    id, component: id, represents, actions: [action],
    prominence: { x: .5, y: .55, scale: 1, brightness: 1, folded: false },
  });
  const scene = (id: string, framework: string, focus: string, who: string, elements: ReturnType<typeof element>[], surprise: string): PlanAct => ({
    id, framework, author: '叔衡', focus, elements, lines: [], reveal: elements.map(e => e.id),
    withhold: ['分数', '结局列表'], exit: 'completed',
    predict: { firstLook: focus, dwell: focus, surprise, firstActionMs: 3000 }, budget,
  });
  const card = (year: number) => {
    const event = loadHistory().events.find(e => e.year === year)!;
    const act = scene(`chronicle${year}`, 'chronicle', 'chronicle-next', event.enters.who,
      [element('chronicle-next', `${event.enters.who}接到${event.title}的消息`, 'continue')], '天下消息走到一个人面前');
    act.lines = [{ id: 'enter', who: event.enters.who, text: event.enters.line }];
    return act;
  };
  const speakers = scene('ji-speakers', 'jixia-speakers', 'ji-scroll', '季', [
    element('ji-scroll', '季回望诸家之言的竹简', 'open'),
    ...['儒', '道', '法', '墨', '名', '阴阳'].map((name, i) => element(`school-${i}`, name, 'choose')),
  ], '季在诸家之言中争取递简的机会');
  speakers.lines = [{ id: 'enter', who: '导师', text: '借后世存下的诸家之言重掂王号。' }];
  const wude = scene('ji-wude', 'wude-wheel', 'ji-scroll', '季', [
    element('ji-scroll', '季的天命草简', 'open'), element('wude-pointer', '青铜盘指针握柄', 'turn'),
    ...['木', '火', '土', '金', '水'].map((name, i) => element(`virtue-${i}`, name, 'choose')),
  ], '季的齐水德设想可以被驳回');
  wude.lines = [{ id: 'enter', who: '季', text: '齐水德，是我在盘上的设想。' }];
  const knife = scene('tianbo-knife', 'qi-knife', 'qi-scale', '田伯', [
    element('qi-scale', '田伯秤前的刀币', 'begin'),
    ...['people', 'king', 'home', 'name'].map((name, i) => element(`qi-${name}`, ['乡邻', '征粮木牍', '自家麻袋', '围观目光'][i]!, 'weigh')),
    ...['give', 'lend', 'close'].map((name, i) => element(`qi-${name}`, ['开仓粥钵', '借粮竹券', '仓门横闩'][i]!, 'choose')),
  ], '田伯掂过顾虑后仍能亲自选择');
  const rest = scene('bells-rest', 'bells', 'bells-start', '导师', [
    element('bells-start', '导师机器的第一枚钟', 'begin'),
    ...['宫', '商', '角', '徵', '羽'].map((name, i) => element(`bell-${i}`, name, 'strike')),
  ], '机器先敲，来客敲回去');
  rest.lines = [{ id: 'remember', who: '导师', text: '这些人做过的，我记着。' }];
  const returnAct = structuredClone(ret);
  returnAct.lines = returnAct.lines.map(l => l.id === 'thread' ? { ...l, text: '小石接过禾的杖，还想往前走。' } : l);
  returnAct.elements = returnAct.elements.map(e => e.id === 'ticket' ? { ...e, represents: '五十年长卷盖上红印，旧事实只增不改' } : e);
  return [threshold, card(-356), reveal, han, card(-334), speakers, wude, card(-314), knife, rest, card(-306), studioAct(budget), returnAct];
}
