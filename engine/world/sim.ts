// 《旱》的世界模拟：纯逻辑，不碰 DOM，Node 与浏览器都能跑。
// 一次 act = 一步 = 禾做一件事 + 世界回应；返回的 Beat 由呈现层按顺序演出。
// 禾的决定、田伯的回应都经过各自的心智（engine/mind）：结构决定，模型只负责说话。
// 确定性：同一 seed、同一串调用 → 同一份账本（随机只来自 rng.fork 出的子流）。
//
// 契约之外的补充（types.ts 不改）：
//   - 田伯给出「借」或「买地」的条件后，当天不结束：world.offer() 取条件，
//     options() 只剩 accept（commits 'lend' | 'sell'）与 decline，二者在同一步内了结，不推进日子。
//   - world.opening() 取第 1 天清晨的 Beat（季节、天色、瓮、流言）。
//   - 田伯「给」（不立券）也记作 EndingId 'lend'，区别在 ending.fact.id 以 'give' 结尾、mentorLine 不同。

import type { Imagined, Mind } from '../mind';
import { createMind } from '../mind';
import { createRng, type Rng } from '../rng';
import type {
  Approach, Beat, Clue, Concept, DayOption, DayOutcome, Ending, EndingId, Fact, PlaceId, PlantResult,
  Rehearsal, Response, Seed, SuggestResult, Trait, Weights, World, WorldConfig, WorldState,
} from '../types';
import { CONCEPT_NAME, TRAITS, TRAIT_NAME } from '../types';
import { REQUISITION_CUT } from './generate';
import * as L from './lines';
import type { GateScenario } from './tianbo';
import { gateThink, predictPure, responseValue, tianboModel } from './tianbo';
import { traitFromWords, translateWords } from './words';

export { translateWords };

/** 田伯开出的条件（借 / 买地），待禾答应或谢绝 */
export interface Offer {
  kind: 'lend' | 'buy-land';
  approach: Approach;
  /** 换来的粟（瓮里多出几天的量） */
  grain: number;
  terms: string;
}

export interface SimWorld extends World {
  /** 建议去某处；去田伯家时可指定带什么来由（预演过后选的那个） */
  suggest(place: PlaceId, approach?: Approach): SuggestResult;
  opening(): Beat[];
  offer(): Offer | null;
  finished(): boolean;
  /** 禾的心智（演示面板：审计日志、习惯、三层计数） */
  heMind(): Mind;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const APPROACH_NAME: Record<Approach, string> = { qing: '提旧情', li: '押地', ming: '带乡邻' };
const RESPONSE_NAME: Record<Response, string> = { give: '给', lend: '借', 'buy-land': '买地', refuse: '拒' };
const GATE_UNIT_VALUE: Record<Response, number> = { give: 1, lend: 0.75, 'buy-land': 0.5, refuse: 0 };
const APPROACHES: Approach[] = ['qing', 'li', 'ming'];

interface Ev { opt: DayOption; pref: number; info: number; key?: string }

export function createWorld(cfg: WorldConfig, rng?: Rng): SimWorld {
  const config: WorldConfig = structuredClone(cfg);
  const root = rng ?? createRng(config.seed);
  const lr = root.fork('lines');
  const T = config.he.temperament;
  const total = config.seasons.reduce((a, s) => a + s.days, 0);
  const hasMother = config.family.some((f) => f.role === 'mother');
  const falseDay = (() => {
    const d = root.fork('sky').int(2, Math.max(2, total - 2));
    return d === config.omen.day ? d + 1 : d;
  })();

  // ---- 两颗心智：同一套结构，参数不同 ----
  const seq = { seq: 0 };
  const he = createMind({
    id: 'he', temperament: T, belief: config.he.belief, infoWeight: 0.5,
    modules: [{ id: 'body' }, { id: 'field' }, { id: 'faith' }, { id: 'social' }],
    units: [
      { id: 'hunger', module: 'body', pi: 1.3, lr: 0.5 },
      { id: 'rain', module: 'field', pred: config.seasons[0]!.rainExpect, pi: 1, lr: 0.6 },
      { id: 'crack', module: 'field', pi: 0.9, lr: 0.5 },
      { id: 'omen', module: 'faith', pi: 1, lr: 0.8 },
      { id: 'news', module: 'social', pi: 1, lr: 0.8 },
      { id: 'gate', module: 'social', pred: 0.5, pi: 1, lr: 0.7 },
    ],
  }, seq);
  const tb = createMind({
    id: 'tianbo', temperament: { pride: config.tianbo.pride, awe: 0.4, duty: 0.5, attachment: 0.6, patience: 0.5 },
    weights: config.tianbo.weights, infoWeight: 0,
  }, seq);

  // ---- 状态 ----
  const S = {
    day: 1, place: 'home' as PlaceId, jar: config.jarDays, crack: 0.08, pressure: 0.04,
    disappoint: 0, failed: { qing: 0, li: 0, ming: 0 } as Record<Approach, number>, prayed: 0, visits: 0, gBelief: 0.85, requisitioned: false, omenSeen: false,
    seeds: [] as Seed[], seedN: 0, factN: 0, known: [] as string[], taken: new Set<string>(),
    unfolded: [] as PlaceId[], offer: null as Offer | null, ending: null as Ending | null,
    price: 120, lastPrice: 120, crackShown: 0.08, senses: [] as ReturnType<Mind['sense']>[],
    todayHabit: null as { sig: string; action: string } | null, skyN: 0,
  };
  const ledger: Fact[] = [];

  // ---- 小工具 ----
  const seasonAt = (day: number) => {
    let d = day;
    for (let i = 0; i < config.seasons.length; i++) {
      const s = config.seasons[i]!;
      if (d <= s.days) return { plan: s, idx: i, inSeason: d };
      d -= s.days;
    }
    const i = config.seasons.length - 1;
    return { plan: config.seasons[i]!, idx: i, inSeason: config.seasons[i]!.days };
  };
  const granaryAt = (day: number) =>
    clamp01((config.tianbo.granary[seasonAt(day).idx] ?? 0.7) * (day >= config.tianbo.requisitionDay ? REQUISITION_CUT : 1));
  const hungerOf = (jar: number) => clamp01(1 - jar / 12);
  const eatPerStep = () => (seasonAt(S.day).idx >= 2 ? 3 : 2) + (hasMother ? 0.5 : 0);
  const seedStr = (c: Concept) => S.seeds.filter((s) => s.concept === c).reduce((m, s) => Math.max(m, s.strength), 0);
  const addPressure = (x: number) => (S.pressure = clamp01(S.pressure + x));
  const pickLine = (list: readonly string[]) => lr.pick(list);
  const sense = (unit: string, obs: number, cause: string) => {
    const p = he.sense(unit, obs, cause);
    S.senses.push(p);
    return p;
  };
  const ctx = () => {
    const h = hungerOf(S.jar);
    const { plan, inSeason } = seasonAt(S.day);
    return {
      h, P: S.pressure, plan, inSeason,
      D: clamp01(0.55 * S.pressure + 0.75 * h + 0.08 * Math.min(S.disappoint, 3)),
      hope: clamp01(plan.rainExpect - 0.05 * (inSeason - 1)),
    };
  };
  const tol = () => 0.08 + 0.32 * (1 - T.pride);

  function fact(kind: Fact['kind'], text: string, by?: string, beats?: Beat[], idTag?: string): Fact {
    const f: Fact = { id: `f${++S.factN}${idTag ? ':' + idTag : ''}`, day: S.day, text, kind, by };
    ledger.push(f);
    beats?.push({ kind: 'fact', fact: f });
    return f;
  }

  function addSeed(concept: Concept, words: string | undefined, strength: number, blockedBy?: string): Seed {
    const old = S.seeds.find((s) => s.concept === concept);
    if (old) {
      old.strength = clamp01(old.strength + 0.15);
      if (words) old.words = words;
      if (blockedBy) old.blockedBy = blockedBy;
      he.infer(`seed:${concept}`, r2(old.strength), blockedBy ?? 'planted');
      return { ...old };
    }
    const seed: Seed = { id: `s${++S.seedN}`, concept, words, strength, plantedDay: S.day, sprouted: false, blockedBy };
    S.seeds.push(seed);
    he.infer(`seed:${concept}`, r2(strength), blockedBy ?? 'planted');
    return { ...seed };
  }

  // ---- 田伯的场景：真 / 禾以为的 ----
  const crowdFor = (a: Approach) => (a === 'ming' ? clamp01(0.3 + (S.unfolded.includes('altar') ? 0.3 : 0) + 0.08 * Math.min(S.prayed, 3)) : 0);
  const believed = (a: Approach): GateScenario => ({
    approach: a, granary: S.gBelief, crowd: crowdFor(a), hunger: hungerOf(S.jar), visits: S.visits,
    requisitioned: S.requisitioned, season: seasonAt(S.day).plan.season, pride: 0.5,
  });
  const real = (a: Approach): GateScenario => ({
    approach: a, granary: granaryAt(S.day), crowd: crowdFor(a), hunger: hungerOf(S.jar), visits: S.visits,
    requisitioned: S.day >= config.tianbo.requisitionDay, season: seasonAt(S.day).plan.season, pride: config.tianbo.pride,
  });

  // ---- 禾想做什么 ----
  const sigFor = (place: PlaceId) => `${place}|h${Math.min(2, Math.floor(hungerOf(S.jar) * 3))}`;
  const unheard = (place: PlaceId) => Math.min(1, config.clues.filter((c) => c.place === place && c.day <= S.day && !S.known.includes(c.id)).length / 2);

  const wantLeave = () => { const c = ctx(); return (0.1 + 0.9 * c.D) * (1 - 0.65 * T.attachment) * (0.45 + 0.55 * T.duty) + 0.3 * seedStr('zou'); };
  const wantSacrifice = () => { const c = ctx(); return 0.1 + 0.4 * T.awe * (0.4 + 0.6 * c.D) + 0.2 * Math.max(seedStr('she'), seedStr('tian')); };
  const wantEndure = () => { const c = ctx(); return 0.26 + 0.4 * T.attachment + 0.25 * T.patience - 0.12 * c.D; };
  const leaveOpen = () => S.pressure >= 0.55 || seedStr('zou') >= 0.6;

  function evaluate(): Ev[] {
    const c = ctx();
    const W = he.params.infoWeight;
    const out: Ev[] = [];
    const add = (place: PlaceId, action: string, pref: number, info: number, extra: Partial<DayOption>, expect: string) => {
      const p = pref + (he.habit(sigFor(place)) === action ? 0.06 : 0);
      out.push({ opt: { place, action, want: clamp01(p + W * info), expect, ...extra }, pref: p, info });
    };
    if (S.offer) {
      const o = S.offer;
      const wa = o.kind === 'lend'
        ? clamp01(0.55 + 0.4 * c.D - 0.15 * T.pride * (1 - c.D))
        : clamp01(0.2 + 0.85 * c.D - 0.55 * T.attachment - 0.3 * seedStr('di'));
      add('gate', 'accept', wa, 0, { approach: o.approach, commits: o.kind === 'lend' ? 'lend' : 'sell' }, o.kind === 'lend' ? L.EXPECT['gate:accept-lend'] : L.EXPECT['gate:accept-sell']);
      add('gate', 'decline', 1 - wa, 0, { approach: o.approach }, L.EXPECT['gate:decline']);
      return sortEv(out);
    }
    add('home', 'rest', 0.22 + 0.2 * T.duty * (0.4 + c.h) + 0.25 * seedStr('jia') + (hasMother ? 0.04 : 0), 0.4 * unheard('home'), {}, L.EXPECT['home:rest']);
    add('field', 'wait-rain', 0.62 * c.hope + 0.18 * T.attachment - 0.35 * c.D + 0.25 * seedStr('deng'), 0.05, {}, L.EXPECT['field:wait-rain']);
    add('well', 'listen', 0.15 + 0.2 * unheard('well') + 0.15 * seedStr('su') - 0.15 * c.D, 0.4 * unheard('well'), {}, L.EXPECT['well:listen']);
    const prayWant = 0.1 + T.awe * (0.2 + 0.45 * (S.omenSeen ? 1 : 0) + 0.3 * Math.min(1, c.P / 0.6)) + 0.3 * Math.max(seedStr('she'), seedStr('tian')) - 0.12 * S.prayed;
    add('altar', 'pray', Math.max(0, prayWant), 0.1, {}, L.EXPECT['altar:pray']);
    if (S.unfolded.includes('altar')) add('altar', 'sacrifice', wantSacrifice(), 0, { commits: 'sacrifice' }, L.EXPECT['altar:sacrifice']);
    const early = c.plan.season === 'spring' && c.P < 0.45;
    for (const a of APPROACHES) {
      const pred = predictPure(he.params.belief, believed(a));
      const V = responseValue(pred, T.attachment, seedStr('di'));
      const willing = 0.15 + 0.95 * c.D;
      const penalty = T.pride * 0.7 * Math.pow(1 - c.D, 1.5);
      let pref = (V > 0 ? V * willing : V * willing * 0.5) - penalty - 0.35 * S.failed[a] + 0.25 * seedStr('tianbo') + 0.1 * seedStr('su');
      if (early) pref = Math.min(pref, 0.12); // 春天他自己不会去求人：还没到那一步
      add('gate', 'borrow', Math.max(0, pref), 0.3 / (1 + S.visits), { approach: a }, L.EXPECT.gate[pred]);
    }
    add('road', 'look', 0.08 + 0.2 * c.D + 0.2 * seedStr('zou') + 0.2 * unheard('road'), 0.4 * unheard('road'), {}, L.EXPECT['road:look']);
    if (leaveOpen()) add('road', 'leave', wantLeave(), 0, { commits: 'leave' }, L.EXPECT['road:leave']);
    if (S.day >= total) add('home', 'endure', wantEndure(), 0, { commits: 'endure' }, L.EXPECT['home:endure']);
    const sorted = sortEv(out);
    const best = sorted[0]!;
    for (const ev of sorted.slice(1)) {
      const r = blockReason(ev.opt, best.opt.want, c);
      if (r) { ev.opt.refuse = L.REASON_TEXT[r]; ev.key = r; }
    }
    return sorted;
  }
  const sortEv = (evs: Ev[]) => evs.map((e, i) => ({ e, i })).sort((a, b) => b.e.opt.want - a.e.opt.want || a.i - b.i).map((x) => x.e);

  /** 为什么不肯：春天的田伯家、骄傲、舍不得 … 返回原因的键 */
  function blockReason(o: DayOption, bestWant: number, c: ReturnType<typeof ctx>): string | null {
    if (o.place === 'gate' && o.action === 'borrow' && c.plan.season === 'spring' && c.P < 0.45) return 'early';
    if (bestWant - o.want > tol()) return ({ gate: 'pride', road: 'attach', altar: 'poor', field: 'hope', well: 'idle', home: 'idle' } as Record<PlaceId, string>)[o.place];
    return null;
  }

  const optId = (o: DayOption) => `${o.place}:${o.action}${o.approach ? ':' + o.approach : ''}`;

  // ---- 状态快照 ----
  function snapshot(): WorldState {
    const { plan, inSeason } = seasonAt(S.day);
    return {
      day: S.day, season: plan.season, dayInSeason: inSeason, place: S.place, jarDays: r2(S.jar), crack: r2(S.crack),
      rainToday: plan.rainActual >= 0.5 && inSeason === plan.days, grainPrice: S.price,
      minxin: r2(clamp01(0.8 - 0.55 * S.pressure + (S.ending?.id === 'sacrifice' ? 0.1 : 0))), pressure: r2(S.pressure),
      hunger: r2(hungerOf(S.jar)), tianboGranary: r2(granaryAt(S.day)), knownClues: [...S.known], visitsToGate: S.visits,
      unfolded: [...S.unfolded],
      mind: {
        lamps: he.lamps(), belief: { ...he.params.belief }, seeds: S.seeds.map((s) => ({ ...s })), lastLayer: he.lastLayer, pressure: r2(S.pressure),
      },
      ending: S.ending,
    };
  }

  // ---- Beat 的片段 ----
  function goTo(place: PlaceId, beats: Beat[]) {
    if (S.place !== place) { beats.push({ kind: 'walk', who: 'he', to: place }); S.place = place; }
  }
  const say = (who: string, text: string): Beat => ({ kind: 'say', who, text });

  function surfaceClues(place: PlaceId, beats: Beat[]): number {
    const avail = config.clues.filter((c) => c.place === place && c.day <= S.day && !S.known.includes(c.id)).slice(0, 2);
    for (const c of avail) {
      S.known.push(c.id);
      beats.push({ kind: 'rumor', clue: { ...c } });
      he.remember({ key: `clue:${c.id}`, text: c.text, tag: 'observed', kind: 'clue', data: { trait: c.trait, sign: c.sign } });
    }
    return avail.length;
  }

  /** 这一天停得最高的那一层：行为先说话 */
  function flushLayer(beats: Beat[], line?: string) {
    if (!S.senses.length) return null;
    const order = { unit: 0, module: 1, mind: 2 };
    let best = S.senses[0]!;
    for (const p of S.senses) {
      if (order[p.layer] > order[best.layer] || (order[p.layer] === order[best.layer] && Math.abs(p.eps) > Math.abs(best.eps))) best = p;
    }
    S.senses = [];
    beats.push({ kind: 'layer', who: 'he', layer: best.layer, cause: best.cause });
    if (best.layer === 'mind') {
      if (line) beats.push(say('he', line));
      else if (best.cause === 'rain') beats.push(say('he', S.skyN++ === 0 ? L.HE.sky[0]! : pickLine(L.HE.sky.slice(1).concat(L.HE.skyAgain))));
      else if (best.cause === 'hunger') beats.push(say('he', pickLine(L.HE.hunger)));
    }
    return best;
  }

  // ---- 清晨 ----
  function dawn(beats: Beat[]) {
    const { plan, inSeason } = seasonAt(S.day);
    he.tick(S.day);
    tb.tick(S.day);
    if (inSeason === 1) {
      beats.push({ kind: 'season', season: plan.season, day: S.day });
      he.infer('rain', plan.rainExpect, `season:${plan.season}`);
    }
    beats.push({ kind: 'dawn', day: S.day });
    const isOmen = S.day === config.omen.day;
    beats.push({ kind: 'sky', state: isOmen ? 'omen' : S.day === falseDay ? 'false-clouds' : 'clear' });
    beats.push({ kind: 'jar', days: r2(S.jar) });
    beats.push({ kind: 'hunger', level: r2(hungerOf(S.jar)) });
    if (Math.abs(S.crack - S.crackShown) > 0.02) { beats.push({ kind: 'crack', amount: r2(S.crack) }); S.crackShown = S.crack; }
    S.price = Math.round(120 + 260 * S.pressure + (S.requisitioned ? 60 : 0));
    if (Math.abs(S.price - S.lastPrice) >= 25) { beats.push({ kind: 'price', price: S.price }); S.lastPrice = S.price; }
    if (S.day === falseDay) beats.push(say('linren', L.FALSE_CLOUDS));
    if (isOmen) {
      const o = L.OMEN[config.omen.kind];
      S.omenSeen = true;
      beats.push(say(o.who, o.text));
      sense('omen', 1, 'omen');
      addPressure(0.06);
      fact('event', `天象：${o.text}`, undefined, beats);
      flushLayer(beats, o.sky);
    }
    if (S.day === config.tianbo.requisitionDay) {
      S.requisitioned = true;
      beats.push(say(L.REQUISITION.who, pickLine([L.REQUISITION.text, L.REQUISITION.cart])));
      sense('news', 1, 'news');
      addPressure(0.08);
      S.gBelief = clamp01(S.gBelief * 0.7);
      he.infer('granary', r2(S.gBelief), 'heard:requisition');
      fact('event', L.REQUISITION.fact, undefined, beats);
      flushLayer(beats);
    }
    surfaceClues(S.place, beats);
  }

  // ---- 一天结束 ----
  function endDay(beats: Beat[]) {
    const { plan } = seasonAt(S.day);
    S.jar = Math.max(0, S.jar - eatPerStep());
    S.crack = clamp01(S.crack + 0.08 * (1 - plan.rainActual));
    const h = hungerOf(S.jar);
    sense('rain', plan.rainActual, 'rain');
    sense('hunger', h, 'hunger');
    if (S.place === 'field') sense('crack', S.crack, 'crack');
    addPressure(0.045 * Math.max(0, plan.rainExpect - plan.rainActual) + 0.1 * h + 0.02 * S.crack - 0.01);
    growSeeds(beats);
    const top = flushLayer(beats);
    if (S.todayHabit) {
      const r = he.outcome(S.todayHabit.sig, S.todayHabit.action, !!top && top.layer !== 'mind');
      if (r === 'compiled') fact('event', `禾对「${L.ACTION_NAME[S.todayHabit.action] ?? S.todayHabit.action}」不再多想了。`, 'he');
      S.todayHabit = null;
    }
    checkUnfold(beats);
    beats.push({ kind: 'sky', state: 'dusk' });
    if (S.day >= total) { finalDecision(beats); return; }
    S.day++;
    dawn(beats);
  }

  function growSeeds(beats: Beat[]) {
    for (const s of S.seeds) {
      if (s.sprouted || s.concept === 'she' || s.concept === 'tian') continue;
      if (s.blockedBy) s.strength = clamp01(s.strength + 0.03 * (0.5 + S.pressure));
      if (s.strength >= 0.5 && S.pressure >= 0.75 - 0.5 * s.strength) {
        s.sprouted = true;
        s.strength = Math.max(s.strength, 0.8);
        beats.push({ kind: 'sprout', seed: { ...s } });
      }
    }
  }

  function checkUnfold(beats: Beat[]) {
    if (S.unfolded.includes('altar') || S.pressure < config.unfoldPressure) return;
    const faith = S.seeds.filter((s) => (s.concept === 'she' || s.concept === 'tian') && s.strength >= 0.25);
    if (!faith.length && S.prayed < 2) return;
    // 成对生长：东郊立起社坛，禾心里同时多了「祭」
    S.unfolded.push('altar');
    const altar = config.places.find((p) => p.id === 'altar')!;
    altar.unfolded = true;
    if (!altar.actions.includes('sacrifice')) altar.actions.push('sacrifice');
    beats.push({ kind: 'unfold', place: 'altar', text: L.UNFOLD.text });
    if (!faith.length) faith.push({ ...(S.seeds.find((s) => s.concept === 'she') ?? addSeed('she', undefined, 0.7, '祷了又祷')) });
    for (const f of faith) {
      const s = S.seeds.find((x) => x.id === f.id)!;
      s.sprouted = true;
      s.strength = Math.max(s.strength, 0.85);
      beats.push({ kind: 'sprout', seed: { ...s } });
    }
    he.infer('can:sacrifice', 1, 'paired-growth');
    beats.push(say('he', L.UNFOLD.say));
    fact('unfold', L.UNFOLD.fact, 'world', beats);
  }

  // ---- 结局 ----
  function commit(id: EndingId, beats: Beat[], variant?: 'give') {
    const base = variant === 'give' ? L.MENTOR_GIVE : L.ENDING[id];
    const jarBefore = S.jar;
    let mentor = base.mentor;
    const grain = { lend: 14, sell: 16, sacrifice: 0, leave: 0, endure: 0 }[id];
    if (id === 'lend') beats.push({ kind: 'pose', who: variant === 'give' ? 'tianbo' : 'he', pose: variant === 'give' ? 'hand-over' : 'tally-snap' });
    if (id === 'sell') beats.push({ kind: 'pose', who: 'he', pose: 'soil-in-hand' });
    if (id === 'leave') {
      goTo('road', beats);
      beats.push(say('he', L.HE.final.leave), { kind: 'pose', who: 'he', pose: 'family-leave' });
    }
    if (id === 'sacrifice') {
      goTo('altar', beats);
      beats.push(say('he', L.HE.final.sacrifice), { kind: 'pose', who: 'he', pose: 'offer-seed' }, say('linren', L.SACRIFICE.crowd));
      if (config.tianbo.weights.ming >= 0.4) {
        beats.push(say('tianbo', L.SACRIFICE.text), { kind: 'pose', who: 'tianbo', pose: 'open-granary' });
        S.jar += 10;
        mentor = L.MENTOR_SACRIFICE_MING;
      }
    }
    if (id === 'endure') beats.push({ kind: 'sky', state: 'night' }, say('he', L.HE.final.endure));
    S.jar += grain;
    if (S.jar !== jarBefore) beats.push({ kind: 'jar', days: r2(S.jar) }, { kind: 'hunger', level: r2(hungerOf(S.jar)) });
    const f = fact('commit', variant === 'give' ? L.MENTOR_GIVE.fact : base.fact, 'he', beats, variant === 'give' ? `${id}:give` : id);
    const ending: Ending = { id, day: S.day, mentorLine: mentor, echo: base.echo, fact: f };
    S.ending = ending;
    S.offer = null;
    beats.push({ kind: 'commit', ending });
    fact('delivery', `《旱》交付：${mentor}`, undefined, beats);
  }

  /** 冬尽仍未决：禾自己决定，按他自己的意愿最高者 */
  function finalDecision(beats: Beat[]) {
    const cands = [
      { id: 'endure', preference: wantEndure() + 0.02 },
      { id: 'leave', preference: wantLeave() },
      ...(S.unfolded.includes('altar') ? [{ id: 'sacrifice', preference: wantSacrifice() }] : []),
    ];
    const sel = he.select(cands, { why: 'final', weight: 0 });
    he.act(`final:${sel.chosen.id}`, () => commit(sel.chosen.id as EndingId, beats), { data: { day: S.day } });
  }

  // ---- 叩门 ----
  function doBorrow(a: Approach, beats: Beat[]) {
    goTo('gate', beats);
    beats.push(say('he', L.HE.approach[a]), { kind: 'knock', approach: a });
    if (a === 'ming') beats.push({ kind: 'pose', who: 'linren', pose: 'gather' });
    beats.push({ kind: 'wait', ms: 1100 });
    // 禾的预测：用他此刻的信念搭一个小田伯
    const imag: Imagined = he.imagine({ other: 'tianbo', label: a, params: he.params.belief, scenario: believed(a), model: tianboModel });
    const predicted = imag.choice as Response;
    // 真田伯：自己的心智、自己的权重、自己此刻的处境
    const sc = real(a);
    const actual = tb.select(tianboModel(config.tianbo.weights, sc), { why: `gate:${a}` }).chosen.id as Response;
    const line = gateLine(actual, a, sc);
    const think = gateThink({ response: actual, approach: a, scenario: sc, weights: config.tianbo.weights, ruleLine: line });
    beats.push({ kind: 'gate', response: actual, predicted, line, think });
    fact('decision', `田伯对禾的「${APPROACH_NAME[a]}」：${RESPONSE_NAME[actual]}。`, 'tianbo', beats);
    // 误差：禾心里的小田伯向真实挪
    const miss = Math.abs(responseValue(actual, 0.5) - responseValue(predicted, 0.5));
    const learned = he.learn({ kind: 'belief', target: config.tianbo.weights, rate: 0.35 + 0.35 * Math.min(1, miss) }, `gate:${a}`)!;
    let trait: Trait = a;
    for (const t of TRAITS) if (Math.abs(learned.after[t] - learned.before[t]) > Math.abs(learned.after[trait] - learned.before[trait])) trait = t;
    beats.push({ kind: 'error', trait, before: learned.before, after: learned.after, predicted, actual });
    const dir = learned.after[trait] >= learned.before[trait] ? '更看重' : '没那么看重';
    fact('decision', `禾觉得田伯${dir}「${TRAIT_NAME[trait]}」。`, 'he', beats);
    he.infer('gate', GATE_UNIT_VALUE[predicted], 'predicted');
    sense('gate', GATE_UNIT_VALUE[actual], 'gate');
    he.remember({ key: `gate:${S.day}`, text: `${APPROACH_NAME[a]}→${RESPONSE_NAME[actual]}`, tag: 'observed', kind: 'tianbo' });
    S.gBelief = clamp01(S.gBelief + 0.6 * (granaryAt(S.day) - S.gBelief));
    he.infer('granary', r2(S.gBelief), 'seen:gate');
    S.visits++;
    flushLayer(beats);
    if (actual === 'refuse') { addPressure(0.1); S.disappoint++; S.failed[a]++; return; }
    if (actual === 'give') { beats.push(say('he', L.HE.thanks.give)); commit('lend', beats, 'give'); return; }
    S.offer = actual === 'lend'
      ? { kind: 'lend', approach: a, grain: 14, terms: L.OFFER_TERMS.lend }
      : { kind: 'buy-land', approach: a, grain: 16, terms: L.OFFER_TERMS['buy-land'] };
    fact('decision', `田伯开出条件：${S.offer.terms}。`, 'tianbo', beats);
  }

  function gateLine(resp: Response, a: Approach, sc: GateScenario): string {
    const m = L.TIANBO[resp];
    let key: keyof typeof m = 'any';
    if (resp === 'refuse') key = sc.granary < 0.3 ? 'poor' : sc.requisitioned && sc.visits === 0 && a !== 'ming' ? 'req' : m[a] ? a : 'any';
    else if (m[a]) key = a;
    return pickLine(m[key] ?? m.any!);
  }

  // ---- 日常的一天 ----
  function perform(o: DayOption, beats: Beat[]) {
    switch (o.action) {
      case 'rest': {
        goTo('home', beats);
        beats.push({ kind: 'pose', who: 'he', pose: 'tend-child' });
        const h = hungerOf(S.jar);
        beats.push(h > 0.55 ? say('sang', pickLine(L.SANG.hungry)) : h > 0.25 ? say('xiaoshi', pickLine(L.XIAOSHI)) : hasMother && lr.chance(0.4) ? say('mu', pickLine(L.MU)) : say('sang', pickLine(L.SANG.calm)));
        surfaceClues('home', beats);
        addPressure(-0.01);
        return;
      }
      case 'wait-rain':
        goTo('field', beats);
        beats.push({ kind: 'pose', who: 'he', pose: 'kneel-crack' }, { kind: 'crack', amount: r2(S.crack) }, say('he', pickLine(L.HE.field)));
        S.crackShown = S.crack;
        return;
      case 'listen': {
        goTo('well', beats);
        beats.push({ kind: 'pose', who: 'he', pose: 'lean-well' });
        if (!surfaceClues('well', beats)) beats.push(say('linren', pickLine(L.LINREN)));
        return;
      }
      case 'pray':
        goTo('altar', beats);
        beats.push({ kind: 'pose', who: 'he', pose: 'kneel' }, say('he', pickLine(L.HE.pray)));
        S.prayed++;
        addPressure(-0.015);
        return;
      case 'look': {
        goTo('road', beats);
        beats.push({ kind: 'pose', who: 'he', pose: 'look-far' });
        if (!surfaceClues('road', beats)) {
          const ji = lr.chance(0.5);
          beats.push(say(ji ? 'ji' : 'luren', pickLine(ji ? L.JI : L.LUREN)));
        }
        if (S.pressure >= 0.45 && !seedStr('zou')) beats.push({ kind: 'seed', seed: addSeed('zou', undefined, 0.3, '路在脚下') });
        return;
      }
      case 'borrow': doBorrow(o.approach ?? 'qing', beats); return;
      case 'sacrifice': goTo('altar', beats); commit('sacrifice', beats); return;
      case 'leave': commit('leave', beats); return;
      case 'endure': commit('endure', beats); return;
    }
  }

  function acceptOffer(beats: Beat[]) {
    const o = S.offer!;
    beats.push(say('he', o.kind === 'lend' ? L.HE.accept.lend : L.HE.accept.sell));
    commit(o.kind === 'lend' ? 'lend' : 'sell', beats);
  }
  function declineOffer(beats: Beat[], spoken: boolean) {
    if (spoken) beats.push(say('he', pickLine(L.HE.decline)), { kind: 'pose', who: 'he', pose: 'turn-away' });
    fact('decision', `禾没有应田伯的条件：${S.offer!.terms}。`, 'he', beats);
    addPressure(0.04);
    S.offer = null;
  }

  // ---- 对外接口 ----
  const nudgeTo = (t: Trait, delta: number, cause: string) => {
    const b = { ...he.params.belief };
    b[t] = Math.max(0.03, b[t] + delta);
    return he.learn({ kind: 'belief-set', value: b }, cause)!;
  };
  const outcome = (beats: Beat[]): DayOutcome => ({ beats, state: snapshot() });

  const openBeats: Beat[] = [];
  dawn(openBeats);

  const world: SimWorld = {
    config,
    state: snapshot,
    opening: () => openBeats.map((b) => ({ ...b }) as Beat),
    offer: () => (S.offer ? { ...S.offer } : null),
    finished: () => S.ending !== null,
    heMind: () => he,
    ledger: () => ledger.map((f) => ({ ...f })),
    mindTrace: () => [...he.audit, ...tb.audit].sort((a, b) => a.seq - b.seq),

    options: () => evaluate().map((e) => ({ ...e.opt })),
    inclination: () => ({ ...evaluate()[0]!.opt }),

    suggest(place: PlaceId, approach?: Approach): SuggestResult {
      if (S.ending) return { accepted: false, line: pickLine(L.REFUSE.generic) };
      if (S.offer) return { accepted: false, line: pickLine(L.REFUSE.busy) };
      const evs = evaluate();
      const mine = evs.filter((e) => e.opt.place === place && (!approach || place !== 'gate' || e.opt.approach === approach));
      if (!mine.length) return { accepted: false, line: pickLine(L.REFUSE.generic) };
      const pick = mine[0]!;
      const reason = pick === evs[0] ? null : blockReason(pick.opt, evs[0]!.opt.want, ctx());
      if (!reason) return { accepted: true, option: { ...pick.opt, refuse: undefined } };
      const line = pickLine(reason === 'early' ? L.REFUSE['gate-early']! : L.REFUSE[place] ?? L.REFUSE.generic!);
      const seed = addSeed(L.PLACE_CONCEPT[place], undefined, 0.4, L.REASON_TEXT[reason]);
      fact('decision', `禾没有照做（${L.REASON_TEXT[reason]}）；心里留下了「${CONCEPT_NAME[seed.concept]}」。`, 'he');
      return { accepted: false, line, seed };
    },

    plant(concept: Concept, words?: string): PlantResult {
      if (concept === 'tianbo' && words) {
        const t = traitFromWords(words);
        if (t) {
          const { before, after } = nudgeTo(t, 0.12, 'plant');
          fact('decision', `禾听进了一句话，觉得田伯更在乎「${TRAIT_NAME[t]}」。`, 'player');
          return { effect: 'belief', line: L.CLUE_REACT[t]['1'], beliefDelta: { [t]: after[t] - before[t] } };
        }
      }
      const seed = addSeed(concept, words, words ? 0.5 : 0.4);
      fact('decision', `禾心里多了一个念头：${CONCEPT_NAME[concept]}。`, 'player');
      if (concept === 'di') return { effect: 'seed', line: L.PLANT.di.seed, seed };
      const evs = evaluate();
      const want: PlaceId = ({ zou: 'road', tianbo: 'gate', she: 'altar', tian: 'altar', deng: 'field', jia: 'home', su: 'well', di: 'gate' } as Record<Concept, PlaceId>)[concept];
      const mine = evs.filter((e) => e.opt.place === want && !(concept === 'zou' && e.opt.action !== 'leave'));
      const pick = mine[0];
      const ok = !!pick && !S.offer && (pick === evs[0] || !blockReason(pick.opt, evs[0]!.opt.want, ctx()));
      if (ok) return { effect: 'acted', line: L.PLANT[concept].acted, seed, option: { ...pick!.opt, refuse: undefined } };
      return { effect: 'seed', line: L.PLANT[concept].seed, seed };
    },

    takeClue(id: string): PlantResult {
      const c: Clue | undefined = config.clues.find((x) => x.id === id);
      if (!c || !S.known.includes(id)) return { effect: 'belief', line: L.CLUE_UNKNOWN, beliefDelta: {} };
      const mem = he.traces().find((t) => t.key === `clue:${id}`);
      if (S.taken.has(id)) {
        if (mem) he.rehearse(mem.id);
        return { effect: 'belief', line: L.CLUE_AGAIN, beliefDelta: {} };
      }
      S.taken.add(id);
      if (mem) he.rehearse(mem.id);
      const { before, after } = nudgeTo(c.trait, 0.14 * c.sign, `clue:${id}`);
      fact('decision', `禾把一句话放进心里：${c.text}`, 'player');
      return { effect: 'belief', line: L.CLUE_REACT[c.trait][String(c.sign) as '1' | '-1'], beliefDelta: { [c.trait]: after[c.trait] - before[c.trait] } };
    },

    nudgeBelief(trait: Trait, delta: number): Weights {
      const { after } = nudgeTo(trait, delta, 'nudge');
      fact('decision', `禾心里的小田伯挪动了：「${TRAIT_NAME[trait]}」${delta >= 0 ? '重了' : '轻了'}。`, 'player');
      return { ...after };
    },

    rehearse(a: Approach): Rehearsal {
      const imag = he.imagine({ other: 'tianbo', label: a, params: he.params.belief, scenario: believed(a), model: tianboModel });
      const resp = imag.choice as Response;
      return { approach: a, predicted: resp, line: pickLine(L.IMAGINED[resp]), confidence: imag.confidence };
    },

    act(option: DayOption): DayOutcome {
      const beats: Beat[] = [];
      if (S.ending) return outcome(beats);
      he.tick(S.day);
      if (S.offer && option.action !== 'accept' && option.action !== 'decline') declineOffer(beats, false);
      const evs = evaluate();
      let ev = evs.find((e) => e.opt.place === option.place && e.opt.action === option.action && (e.opt.approach ?? null) === (option.approach ?? null)) ?? evs[0]!;
      // 被硬推的（没经过建议、还带着 refuse）：禾不肯，照自己的来，被挡下的念头留作种子
      if (option.refuse && ev.opt.refuse && ev !== evs[0]) {
        const key = ev.key ?? 'idle';
        const seed = addSeed(L.PLACE_CONCEPT[ev.opt.place], undefined, 0.4, ev.opt.refuse);
        beats.push(say('he', pickLine(key === 'early' ? L.REFUSE['gate-early']! : L.REFUSE[ev.opt.place] ?? L.REFUSE.generic!)), { kind: 'seed', seed });
        ev = evs[0]!;
      }
      const o = ev.opt;
      const habitual = !S.offer && !o.commits && o.action !== 'borrow' && he.habit(sigFor(o.place)) === o.action;
      if (habitual) {
        S.todayHabit = { sig: sigFor(o.place), action: o.action };
        he.act(optId(o), () => perform(o, beats), { level: 'unit', route: 'habit', data: { day: S.day } });
      } else {
        he.select(evs.map((e) => ({ id: optId(e.opt), preference: e.pref, infoGain: e.info })), { pick: optId(o), why: ev === evs[0] ? undefined : 'suggested' });
        if (!S.offer && !o.commits && o.action !== 'borrow') S.todayHabit = { sig: sigFor(o.place), action: o.action };
        he.act(optId(o), () => {
          if (S.offer && o.action === 'accept') acceptOffer(beats);
          else if (S.offer && o.action === 'decline') { declineOffer(beats, true); }
          else perform(o, beats);
        }, { data: { day: S.day } });
      }
      if (!S.ending && !S.offer) endDay(beats);
      return outcome(beats);
    },
  };
  return world;
}
