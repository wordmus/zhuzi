// 导演：意图 + seed → 呈现方案。纯函数，浏览器与 Node 都能跑，同一 seed 永远出同一份方案。
// 编排写成数据：每一幕一个焦点、揭示顺序、不给的东西、一句话、对你的预测（策划文档第 11、19 节）。

import { acceptCommission } from './mentor';
import { fiftyYearsActs } from './fifty-years-plan';
import { east3dActs } from './east3d-plan';
import { filmActs } from './film-plan';
import { galleryActs } from './gallery-plan';
import { deskActs, type DeskData } from './desk-plan';
import { studioAct } from '../../frameworks/studio/plan';
import { consoleActs } from './console-plan';
import type { Commission } from '../../engine/layers/types';
import { createRng } from '../../engine/rng';
import type { Intent, Plan, PlanAct, PlanElement, Tier } from '../../engine/types';
import { generateWorld } from '../../engine/world/generate';

export interface SeedMemory {
  version?: string;
  rules: { id: string; text: string; param?: Record<string, number> }[];
}

export interface DirectInput {
  commission?: Commission;
  intent: Intent;
  parts: Intent[];
  seed: number;
  tier: Tier;
  rules: SeedMemory;
  visitN?: number;
  runsIndex?: any[] | null;
  deskData?: DeskData;
}

const CONSTITUTION = [
  '门永远推得开',
  '你永远能对机器说话',
  '你永远能回到上一版',
  '地标不动：你的座位、导师的位置、通往世界的门',
  '已交付的版本只增不改',
];

function param(rules: SeedMemory, id: string, key: string, fallback: number): number {
  return rules.rules.find((r) => r.id === id)?.param?.[key] ?? fallback;
}

export function direct(input: DirectInput): Plan {
  const { intent, seed, tier, rules } = input;
  const rng = createRng(seed);
  const maxChars = param(rules, 'one-sentence', 'maxChars', 30);
  const feedbackMs = param(rules, 'feedback', 'ms', 100);
  const budget = { maxChars, maxActionsFirst3s: 1, feedbackMs };

  // 导师的第一句：按 seed 在几种说法里挑，但都只说一句、不报时间、不问名字
  const greet = rng.fork('greet').pick(['来了。这一件刚做好。', '你来得正好，墨还没干。', '等你一会儿了。先看这个。']);
  const visitN = input.visitN ?? (intent.id === 'cafe-map' ? 2 : ((intent as any).visit?.n ?? 1));
  const isCafeExpanded = visitN >= 2 || intent.id === 'cafe-map';

  const thresholdElements: PlanElement[] = isCafeExpanded ? [
    { id: 'door', component: 'door', represents: '通往机器的门（宪法：永远推得开）', actions: ['推'], prominence: { x: 0.5, y: 0.56, scale: 1, brightness: 0.35, folded: false }, predict: '你会先看窗里那点动的灯，然后找到门' },
    { id: 'window', component: 'window-lamp', represents: '机器醒着，在你来之前就在做事', actions: [], prominence: { x: 0.62, y: 0.46, scale: 0.4, brightness: 0.9, folded: false } },
    { id: 'omen', component: 'star', represents: '荧惑守心：之后才会有意义的一颗红星', actions: [], prominence: { x: 0.74, y: 0.16, scale: 0.1, brightness: 0.25, folded: false }, predict: '第二次来时有人会注意' },
    { id: 'lamps', component: 'lamp-tree', represents: '连盏灯：灯一盏盏亮到你这边', actions: [], prominence: { x: 0.2, y: 0.5, scale: 1, brightness: 0, folded: false } },
    { id: 'lamp-oil', component: 'oil-pot', represents: '灯油台：陶壶与小灯，分给各世界的灯油份额', actions: ['倒油'], prominence: { x: 0.22, y: 0.65, scale: 1, brightness: 0.9, folded: false }, predict: '你会先看灯树上多出的几盏小灯' },
    { id: 'mentor', component: 'mentor', represents: '导师：机器的心智，正写完手上那一笔', actions: ['看'], prominence: { x: 0.55, y: 0.58, scale: 1, brightness: 0.6, folded: false } },
    { id: 'directors', component: 'directors-bench', represents: '导演廊：基础导演与叔衡的工作台、毛坯与年谱', actions: ['看', '撤版'], prominence: { x: 0.45, y: 0.58, scale: 1, brightness: 0.85, folded: false } },
    { id: 'shelf', component: 'shelf', represents: '作品架：启用现有折叠的 shelf，陈列作品与盖印状态', actions: ['拿起', '翻看'], prominence: { x: 0.86, y: 0.42, scale: 1, brightness: 0.85, folded: false } },
    { id: 'seat', component: 'seat', represents: '你的座位（地标）', actions: [], prominence: { x: 0.5, y: 0.92, scale: 1, brightness: 0.3, folded: false } },
    { id: 'books', component: 'books', represents: '两本册子：它眼中的你／你眼中的它', actions: [], prominence: { x: 0.3, y: 0.8, scale: 1, brightness: 0.1, folded: true } },
    { id: 'senses', component: 'sense-shelf', represents: '感官架', actions: [], prominence: { x: 0.95, y: 0.5, scale: 1, brightness: 0.05, folded: true } },
    { id: 'cup', component: 'ear-cup', represents: '耳杯里的热气：背景的呼吸；放在你常坐的那边', actions: [], prominence: { x: 0.64, y: 0.8, scale: 1, brightness: 0.4, folded: false } },
  ] : [
    { id: 'door', component: 'door', represents: '通往机器的门（宪法：永远推得开）', actions: ['推'], prominence: { x: 0.5, y: 0.56, scale: 1, brightness: 0.35, folded: false }, predict: '你会先看窗里那点动的灯，然后找到门' },
    { id: 'window', component: 'window-lamp', represents: '机器醒着，在你来之前就在做事', actions: [], prominence: { x: 0.62, y: 0.46, scale: 0.4, brightness: 0.9, folded: false } },
    { id: 'omen', component: 'star', represents: '荧惑守心：之后才会有意义的一颗红星', actions: [], prominence: { x: 0.74, y: 0.16, scale: 0.1, brightness: 0.25, folded: false }, predict: '几乎没人会注意；第二次来时有人会' },
    { id: 'lamps', component: 'lamp-tree', represents: '连盏灯：灯一盏盏亮到你这边', actions: [], prominence: { x: 0.2, y: 0.5, scale: 1, brightness: 0, folded: false } },
    { id: 'mentor', component: 'mentor', represents: '导师：机器的心智，正写完手上那一笔', actions: ['看'], prominence: { x: 0.55, y: 0.58, scale: 1, brightness: 0.6, folded: false } },
    { id: 'ticket', component: 'ticket', represents: '《旱》的票根：先给，再问', actions: ['拿起'], prominence: { x: 0.5, y: 0.78, scale: 1, brightness: 1, folded: false }, predict: '你会在 3 秒内伸手' },
    { id: 'seat', component: 'seat', represents: '你的座位（地标）', actions: [], prominence: { x: 0.5, y: 0.92, scale: 1, brightness: 0.3, folded: false } },
    { id: 'shelf', component: 'shelf', represents: '作品架', actions: [], prominence: { x: 0.86, y: 0.42, scale: 1, brightness: 0.12, folded: true } },
    { id: 'books', component: 'books', represents: '两本册子：它眼中的你／你眼中的它', actions: [], prominence: { x: 0.3, y: 0.8, scale: 1, brightness: 0.1, folded: true } },
    { id: 'senses', component: 'sense-shelf', represents: '感官架', actions: [], prominence: { x: 0.95, y: 0.5, scale: 1, brightness: 0.05, folded: true } },
    { id: 'cup', component: 'ear-cup', represents: '耳杯里的热气：背景的呼吸；放在你常坐的那边', actions: [], prominence: { x: 0.64, y: 0.8, scale: 1, brightness: 0.4, folded: false } },
  ];

  const threshold: PlanAct = {
    id: 'threshold',
    framework: 'vignette',
    author: '基础导演',
    focus: 'door',
    cafeMap: isCafeExpanded ? {
      expanded: true,
      stations: ['lamp-oil', 'directors', 'shelf', 'door'],
      works: input.runsIndex ? (Array.isArray(input.runsIndex) ? input.runsIndex : (input.runsIndex as any).works ?? null) : null,
    } : undefined,
    elements: thresholdElements,
    lines: [{ id: 'greet', who: '导师', text: greet, when: 'after:mentor-look' }],
    reveal: isCafeExpanded ? ['window', 'door', 'lamps', 'mentor', 'lamp-oil', 'directors', 'shelf'] : ['window', 'door', 'lamps', 'mentor', 'ticket'],
    withhold: isCafeExpanded ? ['时间', '第几天', '名字', '假设清单', '机器的仪表'] : ['时间', '第几天', '名字', '灯油', '假设清单', '机器的仪表'],
    exit: isCafeExpanded ? 'door:entered' : 'ticket:picked',
    predict: { firstLook: 'window', dwell: 'mentor', surprise: isCafeExpanded ? '咖啡厅里四站展开' : '灯一盏盏亮到你这边', firstActionMs: 4000 },
    budget,
  };

  const revealAct: PlanAct = {
    id: 'reveal',
    framework: 'reveal',
    author: '叔衡',
    focus: 'east-suburb',
    elements: [
      { id: 'city', component: 'dot-city', represents: '临淄此刻：低分辨率，人退回统计', actions: ['看'], prominence: { x: 0.5, y: 0.5, scale: 1, brightness: 0.5, folded: false } },
      { id: 'east-suburb', component: 'dot-region', represents: '东郊：唯一在呼吸的一片', actions: ['看', '点'], prominence: { x: 0.8, y: 0.52, scale: 1, brightness: 0.8, folded: false }, predict: '视线 5 秒内会被东郊的呼吸吸过去' },
      { id: 'crack', component: 'field-crack', represents: '田缝', actions: ['碰'], prominence: { x: 0.5, y: 0.7, scale: 1, brightness: 1, folded: false } },
      { id: 'sky', component: 'sky', represents: '天：望天', actions: ['望'], prominence: { x: 0.5, y: 0.12, scale: 1, brightness: 0.8, folded: false } },
    ],
    lines: [{ id: 'he-sky', who: '禾', text: '天老爷，你是忘了东郊，还是忘了我？', when: 'after:sky' }],
    reveal: ['city', 'east-suburb', 'he', 'crack', 'sky'],
    withhold: ['分辨率的解释', '临淄的说明文字'],
    exit: 'crack-or-sky:done',
    predict: { firstLook: 'east-suburb', dwell: 'crack', surprise: '你看向哪里，哪里显影', firstActionMs: 6000 },
    budget,
  };

  const han: PlanAct = {
    id: 'han',
    framework: 'walk2d',
    author: '叔衡',
    focus: 'he',
    elements: [
      { id: 'he', component: 'figure', represents: '禾：你能部分影响的那个人（约 0.3）', actions: ['看进他心里'], prominence: { x: 0.3, y: 0.7, scale: 1, brightness: 1, folded: false } },
      { id: 'heart', component: 'heart-mirror', represents: '心象：禾的心是一块田；小田伯站在田埂上', actions: ['放念头', '拨小田伯的秤', '预演'], prominence: { x: 0.5, y: 0.4, scale: 1, brightness: 1, folded: true } },
      { id: 'jar', component: 'jar', represents: '粟瓮：饥饱不用数字', actions: [], prominence: { x: 0.1, y: 0.75, scale: 1, brightness: 0.7, folded: false } },
      { id: 'dial', component: 'season-dial', represents: '四季转盘', actions: [], prominence: { x: 0.06, y: 0.1, scale: 1, brightness: 0.5, folded: false } },
      { id: 'gate', component: 'gate', represents: '田伯家的门：峰值在这里打开', actions: ['叩门'], prominence: { x: 0.77, y: 0.6, scale: 1, brightness: 0.8, folded: false } },
    ],
    lines: [],
    reveal: ['he', 'jar', 'heart', 'gate', 'rumor', 'altar'],
    withhold: ['田伯真正掂量什么', '粮价的数字（只在流言里出现一次）', '结局列表'],
    exit: 'commit',
    predict: { firstLook: 'he', dwell: 'gate', surprise: '田伯开门后说的和心里预演的不一样', tired: '冬天第二天', firstActionMs: 3000 },
    budget,
  };

  const ret: PlanAct = {
    id: 'return',
    framework: 'vignette',
    author: '基础导演',
    focus: 'ticket',
    elements: [
      { id: 'ticket', component: 'ticket', represents: '《旱》盖上红印：交付即事实', actions: [], prominence: { x: 0.5, y: 0.75, scale: 1, brightness: 1, folded: false } },
      { id: 'mentor', component: 'mentor', represents: '导师说一句禾做了什么，这才问你怎么称呼', actions: ['说名字', '不说'], prominence: { x: 0.55, y: 0.58, scale: 1, brightness: 0.8, folded: false } },
      { id: 'door', component: 'door', represents: '门：关上它', actions: ['关门'], prominence: { x: 0.5, y: 0.5, scale: 1, brightness: 0.5, folded: false } },
    ],
    lines: [
      { id: 'ask-name', who: '导师', text: '怎么称呼你？', when: 'after:seal' },
      { id: 'thread', who: '导师', text: '季那边，听说也有人敲门。', when: 'before:leave' },
    ],
    reveal: ['ticket', 'mentor', 'door'],
    withhold: ['评分', '结局名'],
    exit: 'door:closed',
    predict: { firstLook: 'ticket', dwell: 'mentor', surprise: '它记得禾做了什么', firstActionMs: 5000 },
    budget,
  };

  const acts = intent.id === 'desk' ? deskActs(budget, input.deskData)
    : intent.form === 'film' ? filmActs(budget)
    : intent.form === 'gallery' ? galleryActs(budget)
    : intent.id === 'east-suburb-3d' ? east3dActs(budget)
    : intent.id === 'fifty-years' ? fiftyYearsActs(threshold, revealAct, han, ret)
    : intent.id === 'studio' ? [threshold, revealAct, han, studioAct(budget), ret]
    : intent.id === 'console' ? consoleActs(budget)
    : intent.id === 'cafe-map' ? [threshold]
    : intent.compose?.length ? [threshold, revealAct, han, ret] : intent.id === 'han-act1' ? [revealAct, han] : [threshold];

  const plan: Plan = {
    id: intent.id,
    version: 1,
    intent,
    seed,
    tier,
    director: { id: intent.director, name: intent.director === 'shuheng' ? '叔衡' : '基础导演', rules: rules.rules.map((r) => r.id) },
    era: intent.era,
    acts,
    world: generateWorld(seed, rng.fork('world')),
    constitution: CONSTITUTION,
    rehearsal: acts.map((a) => ({ act: a.id, expect: a.predict.surprise, risk: a.predict.tired ?? '' })),
  };
  return { ...plan, ...acceptCommission(plan, input.commission) };
}
