// 共享契约。所有模块（心智、世界、框架、组件、管线、bench）都只通过这些类型对话。
// 改这里 = 改接口，必须同步所有实现方。

// ============================================================
// 一、意图与呈现方案（策划文档第 11、13、14 节；管线说明第 5 节）
// ============================================================

export type Tier = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

/** 导师给导演的一条意图（intents/*.json） */
export interface Intent {
  id: string;
  title: string;
  /** 针对用户的哪条假设，满足还是试探 */
  hypothesis: { id: string; text: string; mode: 'satisfy' | 'probe' };
  /** 目标体验：要让你感到什么 */
  target: string;
  /** 停止准则：何时收 */
  stop: string;
  form: 'game' | 'film' | 'gallery' | 'vignette';
  /** 视角：谁的眼睛；控制程度 0..1 */
  perspective: { who: string; control: number };
  era: string;
  durationMin: number;
  /** 由哪位导演做 */
  director: string;
  /** 组合意图：先后串起来的子意图（如 first-visit = 导师台 + 旱） */
  compose?: string[];
  notes?: string;
}

/** 呈现方案中的一个元素：代表什么、能对它做什么、多显眼、作者预测你会怎样对待它 */
export interface PlanElement {
  id: string;
  component: string;
  represents: string;
  actions: string[];
  prominence: { x: number; y: number; scale: number; brightness: number; folded: boolean };
  predict?: string;
}

export interface PlanLine {
  id: string;
  who: string;
  text: string;
  /** 何时说：进场、某动作之后、条件表达式（由框架解释） */
  when?: string;
}

export interface Prediction {
  /** 第一眼落在哪 */
  firstLook: string;
  /** 会在哪停 */
  dwell: string;
  /** 哪里会意外 */
  surprise: string;
  /** 哪里会累 */
  tired?: string;
  /** 预计首个动作的毫秒 */
  firstActionMs?: number;
}

export interface PlanAct {
  id: string;
  framework: 'vignette' | 'reveal' | 'walk2d';
  /** 这一幕的作者（基础导演 / 叔衡） */
  author: string;
  /** 唯一焦点元素 id */
  focus: string;
  elements: PlanElement[];
  lines: PlanLine[];
  /** 揭示顺序（元素 id） */
  reveal: string[];
  /** 不给的东西 */
  withhold: string[];
  /** 何时离开这一幕 */
  exit: string;
  predict: Prediction;
  budget: { maxChars: number; maxActionsFirst3s: number; feedbackMs: number };
}

/** 导演产出的呈现方案（runs/<intent>/<seed>/<tier>/plan.json） */
export interface Plan {
  id: string;
  version: number;
  intent: Intent;
  seed: number;
  tier: Tier;
  director: { id: string; name: string; rules: string[] };
  era: string;
  acts: PlanAct[];
  /** walk2d 幕使用的世界实例 */
  world: WorldConfig;
  constitution: string[];
  /** 导演在交付前对这一件作品的预演（逐幕） */
  rehearsal: { act: string; expect: string; risk: string }[];
}

// ============================================================
// 二、心智（策划文档第 4 节；note 6/8/9）
// ============================================================

export type Layer = 'unit' | 'module' | 'mind';

/** 小田伯/田伯掂量的三样东西 */
export type Trait = 'qing' | 'li' | 'ming';
export const TRAITS: readonly Trait[] = ['qing', 'li', 'ming'] as const;
export const TRAIT_NAME: Record<Trait, string> = { qing: '情', li: '利', ming: '名' };

export type Weights = Record<Trait, number>;

/** 禾带去田伯家的「来由」：提旧情 / 押地 / 带乡邻 */
export type Approach = 'qing' | 'li' | 'ming';

/** 田伯的回应 */
export type Response = 'give' | 'lend' | 'buy-land' | 'refuse';

export interface Temperament {
  /** 面子/骄傲：越高越难开口求人 */
  pride: number;
  /** 敬畏天与社 */
  awe: number;
  /** 对家人的责任 */
  duty: number;
  /** 恋地 */
  attachment: number;
  /** 耐性：每层能就地消化多少误差 */
  patience: number;
}

// ============================================================
// 三、世界（策划文档第 5、18、19 节）
// ============================================================

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASON_NAME: Record<Season, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

export type PlaceId = 'home' | 'field' | 'well' | 'altar' | 'gate' | 'road';

export interface Place {
  id: PlaceId;
  name: string;
  /** 横幅上的位置 0..1（从左到右） */
  x: number;
  /** 这里能做的事（概念层动作） */
  actions: string[];
  /** 是否已展开（社坛在压力足够前只是一棵社树） */
  unfolded?: boolean;
}

export interface Person {
  id: string;
  name: string;
  role: 'actor' | 'family' | 'lord' | 'scholar' | 'neighbor' | 'mentor' | 'director';
  /** 横幅上的家 */
  home: PlaceId | 'cafe';
}

/** 流言：可以被放进禾的心里，改他心里的小田伯 */
export interface Clue {
  id: string;
  /** ≤ 20 字 */
  text: string;
  /** 指向哪一样，正负 */
  trait: Trait;
  sign: 1 | -1;
  /** 是否属实（视角过滤事实：流言可能是错的） */
  truthful: boolean;
  /** 在哪、第几天出现 */
  place: PlaceId;
  day: number;
  /** 谁说的 */
  from: string;
}

export interface SeasonPlan {
  season: Season;
  days: number;
  /** 这一季对雨的预期（0..1）与实际 */
  rainExpect: number;
  rainActual: number;
}

export interface WorldConfig {
  seed: number;
  places: Place[];
  people: Person[];
  he: { temperament: Temperament; belief: Weights };
  tianbo: { weights: Weights; pride: number; granary: number[]; requisitionDay: number };
  seasons: SeasonPlan[];
  omen: { kind: 'yinghuo' | 'comet' | 'halo'; day: number };
  clues: Clue[];
  /** 家：粟瓮里还有几天的粮 */
  jarDays: number;
  family: { id: string; name: string; role: 'wife' | 'child' | 'mother' }[];
  /** 社祭展开的门槛 */
  unfoldPressure: number;
}

/** 玩家能放进禾心里的念头（来自时代的概念库存：农夫能想「天」，不会想「进步」） */
export type Concept = 'tian' | 'she' | 'jia' | 'su' | 'tianbo' | 'zou' | 'di' | 'deng';
export const CONCEPT_NAME: Record<Concept, string> = {
  tian: '天', she: '社', jia: '家', su: '粟', tianbo: '田伯', zou: '走', di: '地', deng: '等',
};

export interface Seed {
  id: string;
  concept: Concept;
  /** 玩家原话（若有） */
  words?: string;
  /** 0..1，压力足时可能发芽 */
  strength: number;
  plantedDay: number;
  sprouted: boolean;
  /** 被结构挡下的理由（成为种子的原因） */
  blockedBy?: string;
}

export interface Fact {
  id: string;
  day: number;
  /** 世界内的事实，交付后不可改 */
  text: string;
  kind: 'event' | 'decision' | 'unfold' | 'commit' | 'delivery';
  /** 由谁的决定写回 */
  by?: string;
}

export type EndingId = 'lend' | 'sell' | 'leave' | 'sacrifice' | 'endure';

export interface Ending {
  id: EndingId;
  day: number;
  /** 导师回到咖啡厅后说的那一句（≤ 20 字） */
  mentorLine: string;
  /** 第二次来访时导师的那一句模板，{days} 由真实流逝换算 */
  echo: string;
  fact: Fact;
}

export interface MindSnapshot {
  /** 每层当前的「亮度」（0..1）：心象里的三盏灯 */
  lamps: Record<Layer, number>;
  belief: Weights;
  seeds: Seed[];
  /** 最近一次误差停在哪层 */
  lastLayer: Layer | null;
  /** 世界压力 0..1 */
  pressure: number;
}

export interface WorldState {
  day: number;
  season: Season;
  dayInSeason: number;
  place: PlaceId;
  jarDays: number;
  crack: number;
  rainToday: boolean;
  grainPrice: number;
  minxin: number;
  pressure: number;
  /** 家人的样子 0..1（1 = 饿得厉害） */
  hunger: number;
  tianboGranary: number;
  knownClues: string[];
  visitsToGate: number;
  unfolded: PlaceId[];
  mind: MindSnapshot;
  ending: Ending | null;
  /** 世界上留下的痕迹：禾做的事改变环境，环境又改变禾（共同进化）。只增不删，可变强弱 */
  marks?: Mark[];
  /** 今天关上的一扇门（一个选项永远消失了）——张力的来源 */
  closing?: { what: string; day: number }[];
}

/** 谁留下的痕迹 */
export type MarkBy = 'he' | 'world' | 'tianbo' | 'neighbors';

/**
 * 环境上看得见的痕迹。每一种都必须：画得出来（呈现层）、并且反过来改变某个选项或某个心智量（模拟层）。
 * path   禾常走的路被踩出来（强度=走过的次数）；最深的那条，他不等你就会自己走（习惯=沉淀）
 * well   井水位（强度=剩下的水 0..1）；禾和乡邻都在打水
 * green  禾挑水浇活的一小块苗（强度=活着的程度）；田伯买地时看得见它
 * door   乡邻的门：开着/钉上了板（强度=1 已走）；走的人越多，「带乡邻」越弱、「走」越近
 * gate   田伯门前：铺首的磨痕、门口多了个看门的（强度=田伯对禾的戒备）
 * oak    社树下的橡子被捡光的程度
 * ground 田缝，禾的手印、刨开的土
 */
export interface Mark {
  id: string;
  kind: 'path' | 'well' | 'green' | 'door' | 'gate' | 'oak' | 'ground';
  place: PlaceId;
  by: MarkBy;
  /** 0..1 */
  strength: number;
  /** 第一次出现的那天 */
  since: number;
  /** 这道痕迹改变了什么（给演示面板与 bench 看，不上玩家屏幕） */
  effect: string;
}

/** 禾今天可以做的事 */
export interface DayOption {
  place: PlaceId;
  /** 概念层动作，如 'wait-rain' 'borrow' 'pray' 'listen' 'leave' 'sacrifice' 'sell' */
  action: string;
  /** 禾自己有多想做（0..1） */
  want: number;
  /** 禾预期的结果（≤ 16 字，用于心象里的预演） */
  expect: string;
  /** 若玩家建议，禾会不会照做；不会的原因 */
  refuse?: string;
  /** 若去田伯家，带什么来由 */
  approach?: Approach;
  /** 不可逆承诺 */
  commits?: EndingId;
}

export interface Rehearsal {
  approach: Approach;
  /** 禾心里的田伯会怎样（按信念算） */
  predicted: Response;
  /** 心里田伯的那句话 */
  line: string;
  /** 信心 0..1 */
  confidence: number;
}

/** 世界交给呈现层的「拍」：呈现层按顺序把它们演出来 */
export type Beat =
  | { kind: 'season'; season: Season; day: number }
  | { kind: 'dawn'; day: number }
  | { kind: 'walk'; who: string; to: PlaceId }
  | { kind: 'pose'; who: string; pose: string; ms?: number }
  | { kind: 'say'; who: string; text: string; think?: ThinkSpec }
  | { kind: 'layer'; who: string; layer: Layer; cause: string }
  | { kind: 'jar'; days: number }
  | { kind: 'hunger'; level: number }
  | { kind: 'crack'; amount: number }
  | { kind: 'sky'; state: 'clear' | 'clouds' | 'false-clouds' | 'omen' | 'rain' | 'dusk' | 'night' }
  | { kind: 'rumor'; clue: Clue }
  | { kind: 'knock'; approach: Approach }
  | { kind: 'gate'; response: Response; predicted: Response; line: string; think?: ThinkSpec }
  | { kind: 'error'; trait: Trait; before: Weights; after: Weights; predicted: Response; actual: Response }
  | { kind: 'seed'; seed: Seed }
  | { kind: 'sprout'; seed: Seed }
  | { kind: 'unfold'; place: PlaceId; text: string }
  | { kind: 'price'; price: number }
  | { kind: 'fact'; fact: Fact }
  | { kind: 'commit'; ending: Ending }
  | { kind: 'wait'; ms: number }
  /** 一道痕迹出现或变化（呈现层把它画进横幅，永不擦掉） */
  | { kind: 'mark'; mark: Mark; prev?: number }
  /** 一扇门在今天关上：某个选项永远没有了（例：邻家走了，「带乡邻」少了一个人） */
  | { kind: 'closing'; what: string; place?: PlaceId }
  /** 禾没等你，自己做了（你沉默太久，或他心里的意愿太强） */
  | { kind: 'self'; option: DayOption; why: string };

/** 一句话交给模型「真的去想」时的说明；无模型时用 Beat 里的规则文本 */
export interface ThinkSpec {
  kind: string;
  prompt: string;
  /** 最多等多久（毫秒），超时用规则 */
  deadlineMs: number;
}

export interface DayOutcome {
  beats: Beat[];
  state: WorldState;
}

export interface SuggestResult {
  accepted: boolean;
  option?: DayOption;
  /** 拒绝时禾说的话（又歪又合理） */
  line?: string;
  seed?: Seed;
}

export interface PlantResult {
  /** 'acted'：禾会照自己的方式做；'seed'：做不到，留作种子；'belief'：改了小田伯 */
  effect: 'acted' | 'seed' | 'belief';
  line: string;
  seed?: Seed;
  option?: DayOption;
  beliefDelta?: Partial<Weights>;
}

/** 世界模拟的公开接口：纯逻辑，不碰 DOM，可在 Node 里跑（bench 的模拟玩家直接调它） */
export interface World {
  readonly config: WorldConfig;
  state(): WorldState;
  /** 今天禾可以做的事，按他自己的意愿排序 */
  options(): DayOption[];
  /** 禾自己会做什么 */
  inclination(): DayOption;
  /** 玩家点了某个地方：建议禾去 */
  suggest(place: PlaceId): SuggestResult;
  /** 玩家往禾心里放一个念头（概念，可带原话） */
  plant(concept: Concept, words?: string): PlantResult;
  /** 玩家把一条流言放进禾心里 */
  takeClue(clueId: string): PlantResult;
  /** 玩家直接拨动心里小田伯的秤 */
  nudgeBelief(trait: Trait, delta: number): Weights;
  /** 预演：禾在心里搭小田伯，看他会怎样 */
  rehearse(approach: Approach): Rehearsal;
  /** 过一天：禾去做这件事，世界回应 */
  act(option: DayOption): DayOutcome;
  /** 你沉默了（呈现层空闲 6 秒后调用）：禾不等你，按自己的意愿/习惯过这一天；beats 以 {kind:'self'} 开头 */
  idle?(): DayOutcome;
  /** 事实账本（只增不改） */
  ledger(): Fact[];
  /** trace 用：心智内部每一次预测、误差、更新 */
  mindTrace(): unknown[];
}
