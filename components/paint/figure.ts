// 人物：漆画式侧面剪影。头小、衣长、袖宽；几块贝塞尔形状拼成，关节在衣下转。
// 坐标：局部单位里成人身高 100，原点在脚底中心，面朝 +x。draw 时按 scale（成人身高像素）缩放。
// 姿势是一组数，setPose 在两组数之间平滑过渡；走路、写字、点头这类循环由 t 驱动。

import { PAL, TONE } from './palette';
import { type C2D, type Pt, add, clamp, dir, easeInOut, lerp, lerpPt, mix, rgba, smoothPath } from './util';

export type FigureKind = 'he' | 'wife' | 'child' | 'mother' | 'tianbo' | 'mentor' | 'ji' | 'neighbor' | 'traveler';

export type PoseName =
  | 'stand' | 'walk' | 'kneel' | 'kneel-touch' | 'look-up' | 'bow' | 'beg'
  | 'sit-write' | 'sit-look' | 'push' | 'stamp' | 'reach' | 'carry' | 'point'
  | 'shake-head' | 'nod' | 'slump' | 'sit' | 'open-gate' | 'turn';

export const POSES: readonly PoseName[] = [
  'stand', 'walk', 'kneel', 'kneel-touch', 'look-up', 'bow', 'beg', 'sit-write', 'sit-look', 'push',
  'stamp', 'reach', 'carry', 'point', 'shake-head', 'nod', 'slump', 'sit', 'open-gate', 'turn',
];

/** 姿势参数（弧度为主）。可用 setPoseParams 直接调 */
export interface PoseParams {
  /** 0 站 → 1 跪坐 */
  crouch: number;
  /** 0 → 1 坐地、腿向前 */
  sit: number;
  /** 躯干前倾 */
  lean: number;
  /** 头仰（+ 抬头） */
  head: number;
  /** 0 侧面 → 1 转向观者 */
  turn: number;
  /** 前臂：肩角、肘角（0 下垂，+ 向前） */
  fa1: number;
  fa2: number;
  /** 后臂 */
  ba1: number;
  ba2: number;
  /** 循环动作的幅度 */
  walk: number;
  write: number;
  nod: number;
  shake: number;
  play: number;
  /** 抱着东西（袋） */
  hold: number;
  /** 伸指 */
  finger: number;
  /** 手里有笔 */
  brush: number;
  /** 塌肩（饿） */
  slump: number;
}

const D: PoseParams = {
  crouch: 0, sit: 0, lean: 0, head: 0, turn: 0,
  fa1: 0.12, fa2: 0.3, ba1: -0.06, ba2: 0.25,
  walk: 0, write: 0, nod: 0, shake: 0, play: 0, hold: 0, finger: 0, brush: 0, slump: 0,
};
const KEYS = Object.keys(D) as (keyof PoseParams)[];

/** 全身姿势：未写的项回到默认 */
const FULL: Partial<Record<PoseName, Partial<PoseParams>>> = {
  stand: {},
  walk: { walk: 1, lean: 0.05, fa2: 0.2 },
  kneel: { crouch: 1, fa1: 0.5, fa2: 0.75, ba1: 0.45, ba2: 0.75, head: -0.05 },
  'kneel-touch': { crouch: 1, lean: 0.95, head: 0.4, fa1: -0.82, fa2: 0.3, ba1: -0.7, ba2: 0.45 },
  'look-up': { head: 0.62, lean: -0.08, fa1: 0.06, fa2: 0.12 },
  bow: { lean: 0.55, head: -0.1, fa1: 0.55, fa2: 1.0, ba1: 0.5, ba2: 1.0 },
  beg: { crouch: 1, lean: 0.42, head: 0.55, fa1: 0.85, fa2: 0.5, ba1: 0.8, ba2: 0.55 },
  'sit-write': { crouch: 1, lean: 0.3, head: -0.4, fa1: 0.45, fa2: 0.55, ba1: 0.45, ba2: 0.8, write: 1, brush: 1 },
  'sit-look': { crouch: 1, lean: 0.02, head: 0.06, turn: 0.55, fa1: 0.5, fa2: 0.8, ba1: 0.45, ba2: 0.8 },
  carry: { fa1: 0.55, fa2: 1.25, ba1: 0.5, ba2: 1.25, hold: 1, lean: -0.05 },
  slump: { lean: 0.26, head: -0.5, slump: 1, fa1: 0.04, fa2: 0.06, ba1: 0, ba2: 0.06 },
  sit: { sit: 1, lean: 0.12, head: -0.2, fa1: 0.75, fa2: 0.55, ba1: 0.45, ba2: 0.5, play: 1 },
  'open-gate': { fa1: 1.2, fa2: 0.5, lean: -0.04, head: 0.05, ba1: 0.1 },
};
/** 手势：只改手、头，保留当前的站/跪/坐 */
const GESTURE: Partial<Record<PoseName, Partial<PoseParams>>> = {
  push: { lean: 0.32, fa1: 1.0, fa2: 0.1, head: -0.15, write: 0, brush: 0, turn: 0 },
  stamp: { lean: 0.3, fa1: 0.7, fa2: 0.9, head: -0.25, write: 0, brush: 0, turn: 0 },
  reach: { fa1: 1.45, fa2: 0.12, head: 0.12, write: 0, brush: 0 },
  point: { fa1: 1.6, fa2: -0.05, finger: 1, head: 0.06, write: 0, brush: 0 },
  'shake-head': { shake: 1, nod: 0 },
  nod: { nod: 1, shake: 0 },
  turn: { turn: 1, head: 0.02 },
};

type HeadGear = 'topknot' | 'bun' | 'greybun' | 'tufts' | 'guan' | 'gaoguan' | 'cloth' | 'hat';

interface KindStyle {
  /** 身高系数 */
  h: number;
  robe: string;
  robeBack: string;
  trim: string;
  sash: string;
  hemBand: string;
  long: boolean;
  /** 短衣下摆高度（局部单位，负） */
  hemY: number;
  hair: string;
  gear: HeadGear;
  /** 体宽 */
  build: number;
  /** 袖宽 */
  sleeve: number;
  headScale: number;
  beard?: string;
  longBeard?: boolean;
  /** 驼背 */
  bent?: number;
  staff?: boolean;
  slips?: boolean;
  pack?: boolean;
  /** 金线饰边 */
  gold?: boolean;
  leg: string;
}

const KINDS: Record<FigureKind, KindStyle> = {
  he: { h: 1, robe: PAL.ochre, robeBack: TONE.ochreDark, trim: '#e3c38f', sash: PAL.umber, hemBand: PAL.umber, long: false, hemY: -17, hair: TONE.ink, gear: 'topknot', build: 1, sleeve: 0.9, headScale: 1, leg: '#3a2a1f' },
  wife: { h: 0.94, robe: '#9a4128', robeBack: '#5e2618', trim: '#e0b98a', sash: PAL.umber, hemBand: '#4a1d13', long: true, hemY: 0, hair: TONE.ink, gear: 'bun', build: 0.92, sleeve: 1, headScale: 0.98, leg: TONE.ink },
  child: { h: 0.6, robe: TONE.ochreLight, robeBack: PAL.ochre, trim: PAL.silk, sash: PAL.cinnabar, hemBand: PAL.ochre, long: false, hemY: -22, hair: TONE.ink, gear: 'tufts', build: 1.05, sleeve: 0.85, headScale: 1.32, leg: '#4a3526' },
  mother: { h: 0.9, robe: '#5b3b29', robeBack: '#3a251a', trim: PAL.silkDim, sash: PAL.lacquer2, hemBand: PAL.lacquer2, long: true, hemY: 0, hair: '#9a9286', gear: 'greybun', build: 0.95, sleeve: 0.95, headScale: 1, bent: 0.3, staff: true, leg: TONE.ink },
  tianbo: { h: 1.04, robe: PAL.cinnabar, robeBack: TONE.cinnabarDark, trim: PAL.gold, sash: PAL.lacquer, hemBand: PAL.lacquer, long: true, hemY: 0, hair: TONE.ink, gear: 'guan', build: 1.2, sleeve: 1.4, headScale: 1.02, beard: TONE.ink, gold: true, leg: TONE.ink },
  mentor: { h: 1, robe: '#3e281c', robeBack: '#24160f', trim: PAL.gold, sash: PAL.cinnabar, hemBand: PAL.lacquer, long: true, hemY: 0, hair: TONE.ink, gear: 'topknot', build: 1.05, sleeve: 1.35, headScale: 1, beard: '#b9ab90', longBeard: true, gold: true, leg: TONE.ink },
  ji: { h: 1.02, robe: '#3d5a4f', robeBack: '#22362f', trim: PAL.silkDim, sash: PAL.lacquer, hemBand: PAL.lacquer, long: true, hemY: 0, hair: TONE.ink, gear: 'gaoguan', build: 0.9, sleeve: 1.25, headScale: 0.98, slips: true, gold: true, leg: TONE.ink },
  neighbor: { h: 0.97, robe: '#86694a', robeBack: '#5a4532', trim: PAL.silkDim, sash: PAL.umber, hemBand: PAL.umber, long: false, hemY: -19, hair: TONE.ink, gear: 'cloth', build: 1, sleeve: 0.9, headScale: 1, leg: '#3a2a1f' },
  traveler: { h: 0.98, robe: '#5a4838', robeBack: '#3a2e24', trim: PAL.silkDim, sash: PAL.umber, hemBand: PAL.umber, long: false, hemY: -15, hair: TONE.ink, gear: 'hat', build: 1, sleeve: 0.9, headScale: 1, staff: true, pack: true, leg: '#2f241b' },
};

export interface FigureOpts {
  /** 1 面朝右，-1 面朝左 */
  facing?: 1 | -1;
  pose?: PoseName;
  /** 在漆黑底上：轮廓改用暗金的边光 */
  onDark?: boolean;
  /** 脚下的影子 */
  shadow?: boolean;
  /** 错开多个人物的循环 */
  seed?: number;
  /** 衣色覆盖（例如乡邻各异） */
  robe?: string;
}

export interface FigureAnchors {
  /** 头顶（说话的锚点） */
  top: Pt;
  head: Pt;
  /** 前手 */
  hand: Pt;
  /** 后手 */
  backHand: Pt;
  /** 脚底中心 */
  foot: Pt;
}

export interface Figure {
  readonly kind: FigureKind;
  readonly pose: PoseName | 'custom';
  facing: 1 | -1;
  onDark: boolean;
  shadow: boolean;
  /** 最近一次 draw 之后的屏幕坐标 */
  readonly anchors: FigureAnchors;
  /** 平滑过渡到一个姿势；ms=0 立即 */
  setPose(name: PoseName, ms?: number): void;
  /** 自定义姿势参数（在当前目标上覆盖） */
  setPoseParams(p: Partial<PoseParams>, ms?: number): void;
  /** 视线：弧度，0 平视前方，+ 向上看，- 向下看；null 复位 */
  setGaze(angle: number | null): void;
  /** 过渡是否已完成 */
  settled(t: number): boolean;
  draw(ctx: C2D, x: number, y: number, scale: number, t: number): void;
}

/** 造一个人物 */
export function makeFigure(kind: FigureKind, opts: FigureOpts = {}): Figure {
  return new Fig(kind, opts);
}

class Fig implements Figure {
  readonly kind: FigureKind;
  pose: PoseName | 'custom';
  facing: 1 | -1;
  onDark: boolean;
  shadow: boolean;
  anchors: FigureAnchors = { top: { x: 0, y: 0 }, head: { x: 0, y: 0 }, hand: { x: 0, y: 0 }, backHand: { x: 0, y: 0 }, foot: { x: 0, y: 0 } };
  private st: KindStyle;
  private from: PoseParams;
  private to: PoseParams;
  private cur: PoseParams;
  private t0: number | null = null;
  private dur = 0;
  private lastT = 0;
  private gaze = 0;
  private gazeTo = 0;
  private gazeT0: number | null = null;
  private gazeFrom = 0;
  private seed: number;

  constructor(kind: FigureKind, opts: FigureOpts) {
    this.kind = kind;
    this.st = { ...KINDS[kind] };
    if (opts.robe) this.st.robe = opts.robe;
    this.facing = opts.facing ?? 1;
    this.onDark = opts.onDark ?? false;
    this.shadow = opts.shadow ?? true;
    this.seed = opts.seed ?? hashKind(kind);
    this.pose = opts.pose ?? (kind === 'mentor' ? 'sit-write' : 'stand');
    const p = resolvePose(this.pose as PoseName, { ...D });
    this.from = p;
    this.to = p;
    this.cur = { ...p };
  }

  setPose(name: PoseName, ms = 450) {
    this.pose = name;
    this.retarget(resolvePose(name, this.to), ms);
  }

  setPoseParams(p: Partial<PoseParams>, ms = 450) {
    this.pose = 'custom';
    this.retarget({ ...this.to, ...p }, ms);
  }

  private retarget(target: PoseParams, ms: number) {
    this.from = { ...this.cur };
    this.to = target;
    this.dur = Math.max(0, ms) / 1000;
    this.t0 = null;
    if (ms <= 0) {
      this.cur = { ...target };
      this.from = { ...target };
    }
  }

  setGaze(angle: number | null) {
    this.gazeFrom = this.gaze;
    this.gazeTo = angle ?? 0;
    this.gazeT0 = null;
  }

  settled(t: number) {
    return this.t0 === null ? this.dur === 0 : t - this.t0 >= this.dur;
  }

  private update(t: number) {
    if (this.t0 === null) this.t0 = t;
    const k = this.dur <= 0 ? 1 : easeInOut((t - this.t0) / this.dur);
    for (const key of KEYS) this.cur[key] = lerp(this.from[key], this.to[key], k);
    if (this.gazeT0 === null) this.gazeT0 = t;
    this.gaze = lerp(this.gazeFrom, this.gazeTo, easeInOut((t - this.gazeT0) / 0.35));
    this.lastT = t;
  }

  draw(ctx: C2D, x: number, y: number, scale: number, t: number) {
    this.update(t);
    const st = this.st;
    const k = (scale / 100) * st.h;
    const sk = solve(this.cur, st, t + this.seed * 1.37, this.gaze);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k * this.facing, k);
    if (this.shadow) {
      ctx.fillStyle = this.onDark ? 'rgba(0,0,0,0.35)' : rgba(PAL.umber, 0.16);
      ctx.beginPath();
      ctx.ellipse(lerp(0, 3, sk.c), 0.5, 15 * st.build + sk.c * 6, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    paint(ctx, sk, st, this.cur, this.onDark, t);
    ctx.restore();
    const W = (p: Pt): Pt => ({ x: x + p.x * k * this.facing, y: y + p.y * k });
    this.anchors = {
      top: W({ x: sk.head.x, y: sk.head.y - 11 * st.headScale - (st.gear === 'gaoguan' ? 10 : st.gear === 'guan' ? 6 : 2) }),
      head: W(sk.head),
      hand: W(sk.hand),
      backHand: W(sk.bhand),
      foot: { x, y },
    };
  }
}

function hashKind(k: string) {
  let h = 0;
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) % 997;
  return h / 97;
}

function resolvePose(name: PoseName, current: PoseParams): PoseParams {
  const full = FULL[name];
  if (full) return { ...D, ...full };
  const g = GESTURE[name] ?? {};
  // 手势：保留站/跪/坐，清掉别的循环
  return { ...D, crouch: current.crouch, sit: current.sit, lean: current.lean, slump: current.slump, ...g };
}

// ============================================================
// 骨架求解
// ============================================================

interface Skel {
  c: number;
  hip: Pt;
  S: Pt;
  N: Pt;
  head: Pt;
  headRot: number;
  turn: number;
  gaze: number;
  robe: Pt[];
  fArm: Pt[];
  bArm: Pt[];
  fSleeve: Pt[];
  bSleeve: Pt[];
  hand: Pt;
  bhand: Pt;
  fHandA: number;
  bHandA: number;
  legs: { hip: Pt; knee: Pt; ankle: Pt; toe: Pt }[];
  collar: Pt[];
  waistF: Pt;
  waistB: Pt;
  hemY: number;
}

function solve(p: PoseParams, st: KindStyle, t: number, gaze: number): Skel {
  const b = st.build;
  const c = clamp(p.crouch);
  const s = clamp(p.sit);
  const ph = t * 5.6;
  const walk = p.walk;
  const breath = Math.sin(t * 1.7) * 0.35;
  const bob = walk * Math.abs(Math.cos(ph)) * 1.4;

  const hipY = lerp(lerp(-47, -19, c), -12, s) - bob + breath * 0.3;
  const hipX = lerp(lerp(0, -2, c), -4, s);
  const hip = { x: hipX, y: hipY };
  const lean = p.lean + (st.bent ?? 0) + p.slump * 0.12 + walk * 0.03;
  const u = { x: Math.sin(lean), y: -Math.cos(lean) };
  const f = { x: Math.cos(lean), y: Math.sin(lean) };
  const torso = 31 * (1 - p.slump * 0.04) + breath * 0.2;
  const S = add(hip, u, torso);
  const N = add(hip, u, torso + 3.2);
  const T = (a: number, d: number): Pt => ({ x: S.x + f.x * a - u.x * d, y: S.y + f.y * a - u.y * d });
  const H = (a: number, d: number): Pt => ({ x: hip.x + f.x * a - u.x * d, y: hip.y + f.y * a - u.y * d });

  // 头
  const nod = p.nod * 0.2 * Math.sin(t * 6.5);
  const shakeTurn = p.shake * (0.5 + 0.5 * Math.sin(t * 9));
  const headRot = lean * 0.45 - p.head - clamp(gaze, -1, 1) * 0.3 + nod - (st.bent ?? 0) * 0.6;
  const hs = st.headScale;
  const head = add(N, { x: Math.sin(lean * 0.5) * 6.4 * hs + 1.0, y: -Math.cos(lean * 0.5) * 6.6 * hs });

  // 腿：站（带走路）→ 跪 → 坐
  const legLen = -hipY - 2.5;
  const legs = [1, -1].map((side) => {
    const sw = Math.sin(ph) * 0.42 * walk * side;
    const bend = walk * Math.max(0, Math.sin(ph + (side > 0 ? 0 : Math.PI) + 1.2)) * 0.7;
    const lh = { x: hipX + side * 1.2, y: hipY };
    const kn = add(lh, dir(sw), legLen * 0.52);
    const an = add(kn, dir(sw - bend), legLen * 0.48);
    const standLeg = { hip: lh, knee: kn, ankle: an, toe: { x: an.x + 4.2, y: an.y + 1.5 } };
    const kneelLeg = { hip: { x: hipX, y: hipY }, knee: { x: 14 + side, y: -3.2 }, ankle: { x: -9, y: -2.4 }, toe: { x: -13, y: -1.5 } };
    const sitLeg = { hip: { x: hipX, y: hipY }, knee: { x: 9, y: -6 + side }, ankle: { x: 19, y: -2.5 }, toe: { x: 21, y: -5.5 } };
    const mixLeg = (a: typeof standLeg, z: typeof standLeg, k: number) => ({
      hip: lerpPt(a.hip, z.hip, k), knee: lerpPt(a.knee, z.knee, k), ankle: lerpPt(a.ankle, z.ankle, k), toe: lerpPt(a.toe, z.toe, k),
    });
    return mixLeg(mixLeg(standLeg, kneelLeg, c), sitLeg, s);
  });

  // 衣：三套轮廓按 crouch/sit 混合
  const fFoot = Math.max(legs[0]!.ankle.x, legs[1]!.ankle.x);
  const bFoot = Math.min(legs[0]!.ankle.x, legs[1]!.ankle.x);
  const sway = Math.sin(ph + 0.6) * 1.6 * walk + Math.sin(t * 1.3) * 0.3;
  const hemY = st.long ? 0 : st.hemY;
  const collarF = add(N, f, 2.4);
  const chestF = T(6.2 * b, -4);
  const waistF = H(4.9 * b, 2);
  const waistB = H(-5.1 * b, 1);
  const backS = T(-5.4 * b, -1.5);
  const neckB = add(N, f, -2.2);
  let stand: Pt[];
  if (st.long) {
    stand = [
      collarF, chestF, waistF,
      { x: fFoot + 8.2 * b, y: -3.2 },
      { x: fFoot + 7 * b, y: 0 },
      { x: bFoot - 9.5 * b - sway, y: 0 },
      { x: bFoot - 14 * b - sway * 1.8, y: -1.4 },
      H(-7 * b, -14),
      waistB, backS, neckB,
    ];
  } else {
    const hf = hemY;
    stand = [
      collarF, chestF, waistF,
      { x: 6.6 * b + sway * 0.3, y: hf - 3 },
      { x: 6 * b + sway * 0.4, y: hf + 0.5 },
      { x: -6.6 * b - sway * 0.5, y: hf + 0.5 },
      { x: -7.6 * b - sway * 0.6, y: hf - 1.5 },
      H(-6.6 * b, -6),
      waistB, backS, neckB,
    ];
  }
  const kneel: Pt[] = [
    collarF, chestF, waistF,
    { x: 15 * b, y: -10 },
    { x: 19.5 * b, y: -1.5 },
    { x: -11.5 * b, y: 0 },
    { x: -13.5 * b, y: -3.5 },
    { x: -10.5 * b, y: -14 },
    waistB, backS, neckB,
  ];
  const sitPts: Pt[] = [
    collarF, chestF, waistF,
    { x: 14 * b, y: -8.5 },
    { x: 18 * b, y: -2 },
    { x: -8.5 * b, y: 0 },
    { x: -10 * b, y: -2.5 },
    { x: -8.5 * b, y: -9 },
    waistB, backS, neckB,
  ];
  const robe = stand.map((pt, i) => lerpPt(lerpPt(pt, kneel[i]!, c), sitPts[i]!, s));

  // 臂
  const swing = Math.sin(ph) * 0.38 * walk;
  const wr = p.write;
  const play = p.play;
  const fa1 = lean + p.fa1 + swing + wr * 0.05 * Math.sin(t * 4.3 + 1) + play * 0.28 * Math.sin(t * 3.1);
  const fa2 = p.fa2 + wr * 0.16 * Math.sin(t * 8.7) + play * 0.25 * Math.sin(t * 4.7 + 1);
  const ba1 = lean + p.ba1 - swing + play * 0.2 * Math.sin(t * 2.7 + 2);
  const ba2 = p.ba2;
  const sj = T(1.2, -2.8);
  const bsj = T(-1.4, -2.2);
  const arm = (o: Pt, a1: number, a2: number, wide: number) => {
    const E = add(o, dir(a1), 16);
    const W = add(E, dir(a1 + a2), 14);
    const hand = add(W, dir(a1 + a2), 2.4);
    const n = (a: number) => ({ x: -Math.cos(a), y: Math.sin(a) });
    const n1 = n(a1);
    const n2 = n(a1 + a2);
    const horiz = Math.abs(Math.sin(a1 + a2));
    const sag = (2 + 6.5 * horiz) * wide;
    const w0 = 3.4 * Math.min(1.15, wide);
    const w2 = 3.3 * wide;
    // n 指向臂的「下/后」侧（袖子垂下的一侧）
    const sleeve: Pt[] = [
      add(o, n1, -w0),
      add(E, n1, -w0 * 0.92),
      add(W, n2, -w2 * 0.85),
      { x: W.x + n2.x * w2 * 0.9, y: W.y + n2.y * w2 * 0.9 + sag * 0.55 },
      { x: E.x + n1.x * w0 * 1.1 + (W.x - E.x) * 0.25, y: E.y + n1.y * w0 * 1.1 + sag },
      { x: o.x + n1.x * w0, y: o.y + n1.y * w0 + 3 },
    ];
    return { pts: [o, E, W], sleeve, hand, a: a1 + a2 };
  };
  const fa = arm(sj, fa1, fa2, st.sleeve);
  const ba = arm(bsj, ba1, ba2, st.sleeve);

  const collar = [add(N, f, 2.2), T(3.4 * b, -6), H(3.6 * b, 3.5)];
  return {
    c: Math.max(c, s), hip, S, N, head, headRot, turn: clamp(p.turn + shakeTurn * 0.6), gaze,
    robe, fArm: fa.pts, bArm: ba.pts, fSleeve: fa.sleeve, bSleeve: ba.sleeve, hand: fa.hand, bhand: ba.hand,
    fHandA: fa.a, bHandA: ba.a, legs, collar, waistF, waistB, hemY,
  };
}

// ============================================================
// 绘制
// ============================================================

function paint(ctx: C2D, sk: Skel, st: KindStyle, p: PoseParams, onDark: boolean, t: number) {
  const line = onDark ? rgba(PAL.gold, 0.55) : TONE.ink;
  const lw = onDark ? 0.75 : 0.95;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 行囊（背后）
  if (st.pack) {
    ctx.save();
    ctx.translate(sk.S.x - 6, sk.S.y + 6);
    ctx.rotate(-0.15);
    ctx.fillStyle = TONE.straw;
    ctx.strokeStyle = line;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = rgba(PAL.umber, 0.6);
    ctx.beginPath();
    ctx.moveTo(-4, -3);
    ctx.lineTo(4, -2);
    ctx.moveTo(-4.5, 3);
    ctx.lineTo(4.5, 4);
    ctx.stroke();
    ctx.restore();
  }

  // 后臂
  drawSleeve(ctx, sk.bSleeve, st.robeBack, line, lw, st, false);
  drawHand(ctx, sk.bhand, sk.bHandA, line, lw, 0);

  // 腿（短衣看得见）
  for (let i = 1; i >= 0; i--) {
    const L = sk.legs[i]!;
    ctx.strokeStyle = i === 1 ? mix(st.leg, '#000000', 0.25) : st.leg;
    ctx.lineWidth = 2.9;
    ctx.beginPath();
    ctx.moveTo(L.hip.x, L.hip.y);
    ctx.quadraticCurveTo(L.knee.x, L.knee.y, L.ankle.x, L.ankle.y);
    ctx.stroke();
    // 履：鞋头上翘
    ctx.fillStyle = TONE.ink;
    ctx.beginPath();
    const dx = L.toe.x - L.ankle.x;
    const dy = L.toe.y - L.ankle.y;
    const a = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(L.ankle.x, L.ankle.y + 0.6);
    ctx.rotate(a * 0.4);
    ctx.scale(0.78, 0.78);
    ctx.moveTo(-2.2, 1.6);
    ctx.lineTo(4.4, 1.6);
    ctx.quadraticCurveTo(6.4, 1.4, 6.0, -0.8);
    ctx.quadraticCurveTo(4.0, -1.6, 0, -1.8);
    ctx.quadraticCurveTo(-2.4, -1.2, -2.2, 1.6);
    ctx.fill();
    ctx.restore();
  }

  // 衣身
  ctx.beginPath();
  smoothPath(ctx, sk.robe, true);
  ctx.fillStyle = st.robe;
  ctx.fill();
  // 衣上的浅浅明暗与褶线、下摆色带
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(sk.hip.x - 12, 0, sk.hip.x + 12, 0);
  g.addColorStop(0, rgba('#000000', 0.18));
  g.addColorStop(0.55, rgba('#000000', 0));
  g.addColorStop(1, rgba('#ffffff', 0.05));
  ctx.fillStyle = g;
  ctx.fillRect(-40, -110, 80, 112);
  if (st.long || sk.c > 0.5) {
    const by = sk.hemY - 3.4 - sk.c * 1.2;
    ctx.fillStyle = st.hemBand;
    ctx.fillRect(-40, by, 80, 10);
    if (st.gold) {
      ctx.strokeStyle = rgba(PAL.gold, 0.9);
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(-40, by + 0.7);
      ctx.lineTo(40, by + 0.7);
      ctx.stroke();
      // 下摆的小云纹点
      ctx.fillStyle = rgba(PAL.gold, 0.85);
      for (let x = -30; x < 30; x += 4.2) {
        ctx.beginPath();
        ctx.arc(x, by + 2, 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    ctx.fillStyle = st.hemBand;
    ctx.fillRect(-40, sk.hemY - 1.6, 80, 3);
  }
  // 褶线
  ctx.strokeStyle = rgba(TONE.ink, 0.28);
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  const wf = sk.waistF;
  const wb = sk.waistB;
  const hy = sk.robe[4]!;
  const hb = sk.robe[5]!;
  ctx.moveTo(lerp(wb.x, wf.x, 0.35), lerp(wb.y, wf.y, 0.35) + 3);
  ctx.quadraticCurveTo(lerp(hb.x, hy.x, 0.3) - 2, lerp(wb.y, hy.y, 0.6), lerp(hb.x, hy.x, 0.32), hy.y - 1);
  ctx.moveTo(lerp(wb.x, wf.x, 0.7), lerp(wb.y, wf.y, 0.7) + 3);
  ctx.quadraticCurveTo(lerp(hb.x, hy.x, 0.7) + 1, lerp(wb.y, hy.y, 0.55), lerp(hb.x, hy.x, 0.72), hy.y - 1);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  smoothPath(ctx, sk.robe, true);
  ctx.strokeStyle = line;
  ctx.lineWidth = lw;
  ctx.stroke();

  // 交领
  ctx.strokeStyle = st.trim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  smoothPath(ctx, sk.collar, false);
  ctx.stroke();
  // 腰带与垂绅
  ctx.strokeStyle = st.sash;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(sk.waistB.x + 0.8, sk.waistB.y + 0.6);
  ctx.lineTo(sk.waistF.x - 0.3, sk.waistF.y - 0.4);
  ctx.stroke();
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  const tie = lerpPt(sk.waistB, sk.waistF, 0.75);
  ctx.moveTo(tie.x, tie.y);
  ctx.quadraticCurveTo(tie.x + 1.5, tie.y + 5, tie.x + 0.5 + Math.sin(t * 1.4) * 0.6, tie.y + 9 - sk.c * 3);
  ctx.stroke();
  if (st.gold) {
    ctx.strokeStyle = rgba(PAL.gold, 0.8);
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(sk.waistB.x + 0.8, sk.waistB.y - 0.6);
    ctx.lineTo(sk.waistF.x - 0.3, sk.waistF.y - 1.6);
    ctx.stroke();
  }

  // 头
  drawHead(ctx, sk, st, line, lw);

  // 杖：前手拄地
  if (st.staff) {
    ctx.strokeStyle = TONE.ochreDark;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sk.hand.x - 0.5, sk.hand.y - 6);
    ctx.lineTo(sk.hand.x + (0 - sk.hand.y) * 0.12 + 2, 0);
    ctx.stroke();
  }

  // 抱着的粟袋
  if (p.hold > 0.05) {
    const m = lerpPt(sk.hand, sk.bhand, 0.5);
    ctx.save();
    ctx.globalAlpha *= clamp(p.hold * 1.5);
    ctx.fillStyle = TONE.straw;
    ctx.strokeStyle = line;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(m.x + 1, m.y - 2.5, 6.5, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(m.x - 1, m.y - 8);
    ctx.lineTo(m.x + 1.5, m.y - 10.5);
    ctx.lineTo(m.x + 3, m.y - 7.5);
    ctx.stroke();
    ctx.restore();
  }

  // 前臂
  drawSleeve(ctx, sk.fSleeve, st.robe, line, lw, st, true);
  drawHand(ctx, sk.hand, sk.fHandA, line, lw, p.finger);

  // 笔
  if (p.brush > 0.05) {
    ctx.save();
    ctx.globalAlpha *= clamp(p.brush * 1.5);
    ctx.translate(sk.hand.x, sk.hand.y);
    ctx.rotate(-0.25);
    ctx.strokeStyle = TONE.ochreDark;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(0.5, -7);
    ctx.lineTo(0.5, 3.5);
    ctx.stroke();
    ctx.strokeStyle = TONE.ink;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0.5, 3.5);
    ctx.lineTo(0.5, 5.6);
    ctx.stroke();
    ctx.restore();
  }
  // 季手里的简
  if (st.slips && p.hold < 0.5 && p.finger < 0.5) {
    ctx.save();
    ctx.translate(sk.hand.x + 1, sk.hand.y - 1);
    ctx.rotate(-0.5);
    ctx.fillStyle = TONE.bamboo;
    ctx.strokeStyle = line;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.rect(-1.8, -9, 3.6, 13);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = rgba(TONE.bambooDark, 0.9);
    ctx.beginPath();
    ctx.moveTo(-0.6, -9);
    ctx.lineTo(-0.6, 4);
    ctx.moveTo(0.6, -9);
    ctx.lineTo(0.6, 4);
    ctx.stroke();
    ctx.strokeStyle = PAL.cinnabar;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-2, -5);
    ctx.lineTo(2, -5);
    ctx.moveTo(-2, 1);
    ctx.lineTo(2, 1);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSleeve(ctx: C2D, pts: Pt[], color: string, line: string, lw: number, st: KindStyle, front: boolean) {
  ctx.beginPath();
  smoothPath(ctx, pts, true);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.lineWidth = lw;
  ctx.stroke();
  // 袖口
  const a = pts[2]!;
  const b = pts[3]!;
  ctx.strokeStyle = front ? st.trim : rgba(st.trim, 0.5);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawHand(ctx: C2D, h: Pt, a: number, line: string, lw: number, finger: number) {
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(-a + Math.PI / 2);
  ctx.fillStyle = TONE.skin;
  ctx.strokeStyle = line;
  ctx.lineWidth = lw * 0.7;
  ctx.beginPath();
  ctx.ellipse(0.4, 0, 2.5, 1.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (finger > 0.05) {
    ctx.strokeStyle = TONE.skin;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(2 + 3.2 * finger, -0.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHead(ctx: C2D, sk: Skel, st: KindStyle, line: string, lw: number) {
  const tr = sk.turn;
  const nose = 1 - tr * 0.75;
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headRot);
  ctx.scale(st.headScale, st.headScale);
  const hl = lw / st.headScale;

  // 颈
  ctx.fillStyle = mix(TONE.skin, PAL.ochre, 0.25);
  ctx.beginPath();
  ctx.moveTo(-1.6, 3.5);
  ctx.lineTo(1.8, 3.5);
  ctx.lineTo(1.6, 9);
  ctx.lineTo(-2.2, 9);
  ctx.closePath();
  ctx.fill();

  // 发髻在后：先画在头后
  if (st.gear === 'bun' || st.gear === 'greybun') {
    ctx.fillStyle = st.hair;
    ctx.beginPath();
    ctx.ellipse(-6.4, 2.2, 3.4, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.lineWidth = hl * 0.8;
    ctx.stroke();
  }

  // 脸（侧面，鼻尖随转头收）
  ctx.beginPath();
  ctx.moveTo(-1.8, 6.4);
  ctx.bezierCurveTo(-6.4, 4.6, -6.8, -4.6, -1.4, -6.7);
  ctx.bezierCurveTo(2.6, -7.5, 5.1, -4.4, 5.0, -2.1);
  ctx.lineTo(5.0 + 1.5 * nose, 0.7);
  ctx.lineTo(5.0, 1.5);
  ctx.quadraticCurveTo(5.5, 2.4, 5.0, 3.1);
  ctx.quadraticCurveTo(4.7, 5.0, 2.2, 5.6);
  ctx.lineTo(1.6, 7.0);
  ctx.closePath();
  ctx.fillStyle = TONE.skin;
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.lineWidth = hl * 0.75;
  ctx.stroke();

  // 头发
  ctx.fillStyle = st.hair;
  ctx.beginPath();
  ctx.moveTo(4.7, -3.0);
  ctx.bezierCurveTo(3.4, -7.9, -3.8, -8.1, -5.8, -2.6);
  ctx.bezierCurveTo(-6.6, 0.8, -5.4, 3.8, -3.0, 5.6);
  ctx.bezierCurveTo(-1.6, 3.4, -0.8, 1.2, -0.6, -0.4);
  ctx.bezierCurveTo(0.6, -2.4, 2.6, -3.0, 4.7, -3.0);
  ctx.fill();
  // 耳
  ctx.strokeStyle = rgba(TONE.ink, 0.6);
  ctx.lineWidth = hl * 0.6;
  ctx.beginPath();
  ctx.arc(-0.2, 0.9, 1.1, -1.2, 1.9);
  ctx.stroke();

  // 冠与髻
  drawGear(ctx, st, line, hl);

  // 须
  if (st.beard) {
    ctx.fillStyle = st.beard;
    ctx.beginPath();
    if (st.longBeard) {
      ctx.moveTo(4.6, 3.2);
      ctx.quadraticCurveTo(5.4, 8, 3.2, 13.5);
      ctx.quadraticCurveTo(2.2, 9, 1.6, 5.4);
    } else {
      ctx.moveTo(4.8, 3.0);
      ctx.quadraticCurveTo(5.4, 6.8, 2.8, 8.0);
      ctx.quadraticCurveTo(1.2, 6.8, 1.4, 5.2);
    }
    ctx.closePath();
    ctx.fill();
    // 上唇须
    ctx.strokeStyle = st.beard;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(5.6, 1.9);
    ctx.quadraticCurveTo(4.6, 2.6, 3.4, 2.4);
    ctx.stroke();
  }

  // 眼：一点墨；视线决定它的位置
  const gx = Math.cos(sk.gaze) * 0.45;
  const gy = -Math.sin(sk.gaze) * 0.5;
  const ex = lerp(2.75, 1.7, tr) + gx;
  ctx.fillStyle = TONE.ink;
  ctx.beginPath();
  ctx.ellipse(ex, -0.75 + gy, 0.62, 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  // 眉
  ctx.strokeStyle = rgba(TONE.ink, 0.85);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(ex - 1.1, -2.25);
  ctx.quadraticCurveTo(ex + 0.2, -2.8, ex + 1.3, -2.25);
  ctx.stroke();
  if (tr > 0.05) {
    ctx.globalAlpha *= tr;
    ctx.beginPath();
    ctx.ellipse(-1.6 + gx, -0.75 + gy, 0.58, 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2.6, -2.25);
    ctx.quadraticCurveTo(-1.5, -2.8, -0.5, -2.25);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGear(ctx: C2D, st: KindStyle, line: string, hl: number) {
  ctx.lineWidth = hl * 0.8;
  ctx.strokeStyle = line;
  switch (st.gear) {
    case 'topknot': {
      ctx.fillStyle = st.hair;
      ctx.beginPath();
      ctx.ellipse(-1.6, -7.8, 2.5, 2.1, -0.2, 0, Math.PI * 2);
      ctx.fill();
      // 笄
      ctx.strokeStyle = st.gold ? PAL.gold : PAL.silkDim;
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(-4.4, -7.3);
      ctx.lineTo(1.3, -8.4);
      ctx.stroke();
      break;
    }
    case 'bun':
    case 'greybun': {
      ctx.strokeStyle = st.gear === 'bun' ? PAL.gold : PAL.silkDim;
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(-9.6, 0.4);
      ctx.lineTo(-3.4, 3.8);
      ctx.stroke();
      break;
    }
    case 'tufts': {
      ctx.fillStyle = st.hair;
      for (const [x, y] of [[-3.6, -6.8], [1.6, -7.6]] as const) {
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = PAL.cinnabar;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(-3.6, -5.2);
      ctx.lineTo(-3.4, -4.6);
      ctx.moveTo(1.4, -6);
      ctx.lineTo(1.6, -5.4);
      ctx.stroke();
      break;
    }
    case 'guan': {
      // 田伯的冠：黑漆冠，后仰，金线；缨系到颔下
      ctx.fillStyle = PAL.lacquer;
      ctx.beginPath();
      ctx.moveTo(-4.2, -5.6);
      ctx.lineTo(2.6, -7.0);
      ctx.lineTo(1.6, -13.2);
      ctx.quadraticCurveTo(-1.6, -14.4, -4.6, -12.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4.3, -8.6);
      ctx.lineTo(2.1, -10.0);
      ctx.stroke();
      ctx.strokeStyle = PAL.lacquer;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(2.2, -6.6);
      ctx.quadraticCurveTo(3.4, 0, 3.4, 5.4);
      ctx.stroke();
      break;
    }
    case 'gaoguan': {
      // 季：高冠前倾（切云冠）
      ctx.fillStyle = PAL.lacquer;
      ctx.beginPath();
      ctx.moveTo(-4.4, -5.4);
      ctx.lineTo(2.4, -6.8);
      ctx.lineTo(7.6, -18.5);
      ctx.quadraticCurveTo(5.6, -20.4, 3.2, -19.4);
      ctx.lineTo(-3.2, -9.6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-3.6, -8.2);
      ctx.lineTo(2.8, -9.4);
      ctx.stroke();
      ctx.strokeStyle = PAL.lacquer;
      ctx.beginPath();
      ctx.moveTo(2.0, -6.6);
      ctx.quadraticCurveTo(3.2, 0, 3.2, 5.4);
      ctx.stroke();
      break;
    }
    case 'cloth': {
      // 乡邻：头巾（帻），后面打结
      ctx.fillStyle = PAL.umber;
      ctx.beginPath();
      ctx.moveTo(4.8, -3.4);
      ctx.bezierCurveTo(3.6, -8.4, -4.2, -8.6, -6.2, -2.8);
      ctx.lineTo(-5.4, -1.6);
      ctx.bezierCurveTo(-3.6, -5.2, 2.6, -5.6, 4.8, -3.4);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-6.4, -3.4, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PAL.umber;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-6.8, -2.6);
      ctx.quadraticCurveTo(-8.6, 0, -8.2, 2.6);
      ctx.stroke();
      break;
    }
    case 'hat': {
      // 行人：斗笠
      ctx.fillStyle = TONE.straw;
      ctx.beginPath();
      ctx.moveTo(-10, -4.2);
      ctx.quadraticCurveTo(0, -6.2, 10.4, -4.2);
      ctx.lineTo(0.6, -11.6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = line;
      ctx.stroke();
      ctx.strokeStyle = rgba(PAL.umber, 0.55);
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      for (const x of [-6, -2.5, 1, 4.5, 8]) {
        ctx.moveTo(0.6, -11.2);
        ctx.lineTo(x, -4.8);
      }
      ctx.stroke();
      break;
    }
  }
}
