import type { PlanAct, PlanElement } from '../../engine/types';

export function galleryActs(budget: PlanAct['budget']): PlanAct[] {
  const plates = [
  {
    "id": "plate-01",
    "asset": "shelf-gallery/plates/01-threshold.png",
    "title": "初访的门",
    "caption": "门后先亮起一盏灯",
    "question": "推门以后，你先看见了谁？"
  },
  {
    "id": "plate-02",
    "asset": "shelf-gallery/plates/02-drought.png",
    "title": "旱田里的禾",
    "caption": "旱田把禾留在原地",
    "question": "若天不答，禾还能向谁开口？"
  },
  {
    "id": "plate-03",
    "asset": "shelf-gallery/plates/03-studio.png",
    "title": "最初的工作室",
    "caption": "作品开始有了自己的架子",
    "question": "你会把哪件作品留在手边？"
  },
  {
    "id": "plate-04",
    "asset": "shelf-gallery/plates/04-return.png",
    "title": "回到灯前",
    "caption": "走过一遭，灯下多了痕迹",
    "question": "再来一次，你还会走同一条路吗？"
  },
  {
    "id": "plate-05",
    "asset": "shelf-gallery/plates/05-chronicle.png",
    "title": "五十年长卷",
    "caption": "一幕之间，岁月已经过去",
    "question": "岁月拿走的，谁还记得？"
  },
  {
    "id": "plate-06",
    "asset": "shelf-gallery/plates/06-jixia.png",
    "title": "稷下的争辩",
    "caption": "话传到另一人耳里就变了",
    "question": "同一句话，为何各人听见不同？"
  },
  {
    "id": "plate-07",
    "asset": "shelf-gallery/plates/07-east-design.png",
    "title": "东郊的空间稿",
    "caption": "纸上的东郊开始有了远近",
    "question": "换一个站位，你还认得这片田吗？"
  },
  {
    "id": "plate-08",
    "asset": "shelf-gallery/plates/08-east-delivered.png",
    "title": "东郊的交付画面",
    "caption": "禾终于能在天地间抬头",
    "question": "景深变了，禾的难处变了吗？"
  }
];
  const elements: PlanElement[] = plates.map((p, i) => ({
    id: p.id, component: 'gallery-plate', asset: p.asset, represents: p.title, actions: ['看', '追问'],
    prominence: { x: 0.5, y: 0.5, scale: 1, brightness: i === 0 ? 1 : 0.45, folded: false },
    predict: '你会在这一张停一下',
  }));
  return [{
    id: 'shelf-gallery', framework: 'gallery', author: '叔衡', focus: elements[0]!.id, elements,
    lines: plates.flatMap(p => [
      { id: `${p.id}-caption`, who: '导师', text: p.caption, when: `plate:${p.id}` },
      { id: `${p.id}-question`, who: '导师', text: p.question, when: `after:${p.id}` },
    ]),
    reveal: elements.map(p => p.id), withhold: ['长篇说明', '自动播放'], exit: '展卷到底或收起',
    predict: { firstLook: elements[0]!.id, dwell: 'plate-03', surprise: '同一片旱田有了远近', firstActionMs: 800 },
    budget,
  }];
}
