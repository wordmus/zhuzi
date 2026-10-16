import type { PlanAct, Shot } from '../../engine/types';

/** 五张关键帧构成完整的 animatic，沉默也是镜头的内容。 */
export const skyShots: Shot[] = [
  { id: 'he', image: 'three-look-at-sky/shots/shot-01-he.png', ms: 15000, move: 'tilt-up', who: '禾', text: '再不落雨，我拿什么留住这块地？', sound: 'soil', hotspots: [{ id: 'soil', x: 0.36, y: 0.77, r: 0.055, represents: '土还攥在手里。' }] },
  { id: 'sky', image: 'three-look-at-sky/shots/shot-02-sky.png', ms: 12000, move: 'zoom-in', who: '禾', text: '他等的云，还是没有来。', sound: 'wind-gust', hotspots: [{ id: 'sun', x: 0.72, y: 0.73, r: 0.055, represents: '日头不肯挪开。' }] },
  { id: 'ji', image: 'three-look-at-sky/shots/shot-03-ji.png', ms: 17000, move: 'pan-right', who: '季', text: '若天不肯答，我便问到人间去。', sound: 'brush', hotspots: [{ id: 'scroll', x: 0.39, y: 0.65, r: 0.06, represents: '竹简上还空着一句。' }] },
  { id: 'tianbo', image: 'three-look-at-sky/shots/shot-04-tianbo.png', ms: 17000, move: 'zoom-out', who: '田伯', text: '田里的眼睛都望着我，我又望谁？', sound: 'gate-open', hotspots: [{ id: 'gate', x: 0.45, y: 0.70, r: 0.06, represents: '门外有人等粮。' }] },
  { id: 'city', image: 'three-look-at-sky/shots/shot-05-city.png', ms: 14000, move: 'pan-left', who: '季', text: '同一片天，谁先低下头去做事？', sound: 'crowd', hotspots: [{ id: 'city', x: 0.36, y: 0.65, r: 0.06, represents: '城里已有人动身。' }] },
];

export function filmActs(budget: PlanAct['budget']): PlanAct[] {
  return [{
    id: 'three-look-at-sky', framework: 'film', author: '叔衡', focus: 'film-soil',
    shots: skyShots,
    elements: skyShots.flatMap(s => (s.hotspots ?? []).map(h => ({ id: `film-${h.id}`, component: 'film-hotspot', represents: `${s.who}：${h.represents}`, actions: ['碰'], prominence: { x: h.x, y: h.y, scale: 1, brightness: 1, folded: false } }))),
    lines: [], reveal: skyShots.flatMap(s => (s.hotspots ?? []).map(h => `film-${h.id}`)), withhold: ['解释', '时间条', '选择结局'],
    exit: '镜头表播放完毕', predict: { firstLook: 'film-soil', dwell: 'film-soil', surprise: '禾、季、田伯抬头看的是同一片天', firstActionMs: 1500 }, budget,
  }];
}
