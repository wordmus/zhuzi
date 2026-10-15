// 东郊横幅：由真实 SimWorld 驱动。这里只把世界交来的拍画出来，不另造规则。
import { createHeart } from '../../components/heart/index';
import { approachName, heartLayout } from '../../components/heart/drawing';
import { rehearsalText } from '../../components/heart/labels';
import type { HeartEvent, HeartView } from '../../components/heart/api';
import type { Ctx, Framework } from '../../app/context';
import type { Affordance, AffShape } from '../../engine/affordance';
import { createWorld, translateWords, type SimWorld } from '../../engine/world';
import { traceKindOf, type AuditEntry } from '../../engine/mind';
import type {
  Approach, Beat, Clue, Concept, DayOption, DayOutcome, Ending, Mark, PlaceId, Season, Trait, WorldState,
} from '../../engine/types';
import { createSceneLabels } from './labels';
import { SEASON_NAME } from '../../engine/types';
import {
  FRIEZE_PLACES, makeFriezeCast, makeFigure, sceneFrieze,
  type Figure, type FriezeCast, type PoseName,
  PAL, TONE, bronzeMirror, clamp, easeOut, finish, glow, lerp,
  seasonDial, seedGlyph, sprout, tally, ticket, bambooSlips, type C2D, type FriezeState,
} from '../../components/paint';

const PLACE_ORDER: PlaceId[] = ['home', 'field', 'well', 'altar', 'gate', 'road'];
const APPROACHES: Approach[] = ['qing', 'li', 'ming'];
const CONCEPTS: Concept[] = ['tian', 'she', 'jia', 'su', 'tianbo', 'zou', 'di', 'deng'];
const ENTER_LOCK_MS = 3000;
const IDLE_MS = 6000;
const FRAME_ID = 'walk2d-frieze';

interface VisualMark { mark: Mark; previous: number }
interface VisualClosing { key: string; what: string; day: number; place?: PlaceId }
interface VisualState {
  season: Season;
  day: number;
  dayInSeason: number;
  jarDays: number;
  jarMax: number;
  crack: number;
  hunger: number;
  pressure: number;
  sky: Extract<Beat, { kind: 'sky' }>['state'];
  altar: number;
  gateOpen: number;
  gateKnock: number;
  dip: number;
  marks: VisualMark[];
  closings: VisualClosing[];
  seeds: { seed: Extract<Beat, { kind: 'seed' | 'sprout' }>['seed']; sprout: boolean }[];
  currentClue: Clue | null;
  offer: ReturnType<SimWorld['offer']>;
  pendingCommit: Ending['id'] | null;
  ending: Ending | null;
  tallySplit: number;
  soilInHand: boolean;
  familyLeaving: boolean;
  mirrorTease: number;
  lookUp: boolean;
}

const POSE_MAP: Record<string, PoseName> = {
  stand: 'stand', walk: 'walk', kneel: 'kneel', 'kneel-touch': 'kneel-touch', 'kneel-crack': 'kneel-touch',
  'look-up': 'look-up', bow: 'bow', beg: 'beg', 'sit-write': 'sit-write', 'sit-look': 'sit-look', push: 'push',
  stamp: 'stamp', reach: 'reach', carry: 'carry', point: 'point', 'shake-head': 'shake-head', nod: 'nod',
  slump: 'slump', sit: 'sit', 'open-gate': 'open-gate', turn: 'turn',
  'turn-away': 'turn', 'tend-child': 'kneel', 'lean-well': 'kneel',
  'hand-over': 'reach', 'tally-snap': 'reach', 'soil-in-hand': 'reach',
  'family-leave': 'walk', 'offer-seed': 'bow', 'open-granary': 'open-gate', gather: 'point',
};

function optionFor(world: SimWorld, place: PlaceId, approach?: Approach): DayOption | undefined {
  return world.options().find((o) => o.place === place && (!approach || o.approach === approach));
}

function shapeCircle(x: number, y: number, r: number): AffShape {
  return { kind: 'circle', x, y, r };
}

function setPulse(aff: Affordance, on: boolean) {
  if (on) {
    aff.el.dataset.pulse = 'true';
    aff.el.setAttribute('aria-current', 'true');
  } else {
    delete aff.el.dataset.pulse;
    aff.el.removeAttribute('aria-current');
  }
}

function conceptFromModel(raw: unknown): Concept | null {
  const text = typeof raw === 'string' ? raw.trim().replace(/^['"“”「」]+|['"“”「」]+$/g, '') : '';
  return CONCEPTS.includes(text as Concept) ? text as Concept : null;
}

function gateLineIsPlausible(text: string, response: string): boolean {
  if (!text || [...text.replace(/\s/g, '')].length > 18 || /[\n\r"“”「」]/.test(text)) return false;
  const forbidden: Record<string, RegExp> = {
    give: /不借|不行|买地|还两倍|立券|关门/,
    lend: /不用还|不必还|不立券|买地|不借|关门/,
    'buy-land': /不买|不卖|借你|借给|立券|不用还/,
    refuse: /借你|借给|拿去|给你|地契拿来|立券吧/,
  };
  return !forbidden[response]?.test(text);
}

export const walk2d: Framework = {
  async run(act, ctx) {
    const world: SimWorld = createWorld(ctx.plan.world, ctx.rng);
    const guidedEntry = ctx.plan.director.rules.includes('first-loop-readable');
    let beforeVisitSteps = 0;
    if (guidedEntry) {
      while (!world.finished() && beforeVisitSteps < 11 && !world.options().some(option => option.place === 'gate' && option.approach === 'qing' && !option.refuse)) {
        if (world.inclination().commits) break;
        world.idle();
        beforeVisitSteps++;
      }
    }
    ctx.handoff.world = world;
    const stage = ctx.stage;
    // 横幅只由 camera 平移；hidden 仍可被焦点/scrollIntoView 滚动，clip 才没有滚动容器。
    const previousOverflow = stage.root.style.overflow;
    stage.root.style.overflow = 'clip';
    const runStarted = performance.now();
    const ownedAffs: Affordance[] = [];
    const frameOffs = new Set<() => void>();
    const timeouts = new Set<number>();
    const cast: FriezeCast = makeFriezeCast();
    const hasMother = world.config.family.some(person => person.role === 'mother');
    if (!hasMother) cast.mother.draw = () => {};
    const heFigure: Figure = makeFigure('he', { pose: guidedEntry ? 'stand' : 'kneel-touch', facing: 1 });
    const wifeWalker = makeFigure('wife', { pose: 'walk', facing: 1 });
    const childWalker = makeFigure('child', { pose: 'walk', facing: 1 });
    const motherWalker = makeFigure('mother', { pose: 'walk', facing: 1 });
    const tianboFigure = cast.tianbo;
    cast.he.draw = () => {};

    const initial = world.state();
    const visual: VisualState = {
      season: initial.season, day: initial.day, dayInSeason: initial.dayInSeason,
      jarDays: initial.jarDays, jarMax: Math.max(1, world.config.jarDays), crack: initial.crack,
      hunger: initial.hunger, pressure: initial.pressure, sky: 'clear', altar: initial.unfolded.includes('altar') ? 1 : 0,
      gateOpen: 0, gateKnock: 0, dip: 0.42, marks: [], closings: [], seeds: [], currentClue: null,
      offer: null, pendingCommit: null, ending: null, tallySplit: 0, soilInHand: false, familyLeaving: false, mirrorTease: 0, lookUp: false,
    };

    let worldW = Math.max(stage.width, stage.height * 2.7);
    let camera = 0;
    let actorX = worldW * FRIEZE_PLACES[guidedEntry ? initial.place : 'field'];
    let actorPlace: PlaceId = guidedEntry ? initial.place : 'field';
    let actorY = stage.height * 0.83 + stage.height * 0.025;
    let groundY = stage.height * 0.83;
    let bg: HTMLCanvasElement | null = null;
    let bgScale = 1;
    let sceneInfo: ReturnType<typeof sceneFrieze> | null = null;
    let bgDirty = true;
    let batchingBeats = false;
    let phase: 'intro' | 'intro-actions' | 'playing' | 'ending' = 'intro';
    let busy = false;
    let firstMirrorOpened = false;
    let firstMirrorPending = false;
    let mirrorOpening = false;
    let mirrorReason: 'first' | 'player' | 'error' | 'unfold' | null = null;
    let waitingForClose: (() => void) | null = null;
    let clueCleanup: Promise<void> | null = null;
    let pendingGate: DayOption | null = null;
    let pendingGateSelf: string | null = null;
    // 禾可能先去别处，再自主登门；被拒借法要保留到下一次真实预想才交代清楚。
    let rejectedBorrowApproach: Approach | undefined;
    let pendingCommit: DayOption | null = null;
    let pendingCommitSelf: string | null = null;
    let gateRings = 0;
    let offerEnteredAt = 0;
    let lastPulseId = '';
    let lastFocusId = '';
    let idleTimer: number | null = null;
    let idleWindowStarted: number | null = null;
    const patienceMs = 12_000 + 12_000 * world.config.he.temperament.patience;
    let idleCount = 0;
    let presenterEventSeen = false;
    let presenterOpen = ctx.handoff.presenterOpen === true;
    const seenAudit = new Set<number>();
    const shapeCache = new Map<Affordance, string>();
    let seenFacts = new Set<string>();
    let seenClosings = new Set<string>();
    let hadModel = false;
    let latestPlaceDwell: Record<PlaceId, number> = { home: 0, field: 0, well: 0, altar: 0, gate: 0, road: 0 };
    let lastRingTime = 0;

    const style = document.createElement('style');
    style.dataset.walk2d = 'pulse';
    style.textContent = `
      #stage > [data-layer="affordances"], #stage > [data-layer="walk2d-language"]{overflow:clip}
      .aff[data-pulse="true"]{animation:walk2d-pulse 1.7s ease-in-out infinite;box-shadow:0 0 18px 4px rgba(201,162,74,.72),inset 0 0 8px rgba(240,220,160,.24)}
      @keyframes walk2d-pulse{0%,100%{filter:brightness(1);opacity:.72}50%{filter:brightness(1.8);opacity:1}}
      @media(prefers-reduced-motion:reduce){.aff[data-pulse="true"]{animation:none;opacity:1}}
    `;
    document.head.appendChild(style);

    const layer = stage.layer(FRAME_ID, 20);
    const g = layer.ctx;
    const languageLayer = stage.dom('walk2d-language', 58);
    const sceneLabels = createSceneLabels(languageLayer);
    const heart: HeartView = createHeart(ctx);
    heart.setAdvanced(!guidedEntry || initial.visitsToGate > 0);
    heart.setApproaches(APPROACHES);
    heart.setWritable(true);
    heart.update(initial.mind);

    function addAff(id: string, label: string, shape: AffShape, onActivate: () => void, enabled = false, key?: string, onDrag?: (e: Parameters<NonNullable<Parameters<typeof ctx.aff.add>[0]['onDrag']>>[0]) => void) {
      const aff = ctx.aff.add({ id: `walk2d-${id}`, label, shape, enabled, key, onActivate, onDrag, represents: label });
      ownedAffs.push(aff);
      return aff;
    }

    const placeAffs = {} as Record<PlaceId, Affordance>;
    for (const place of PLACE_ORDER) {
      const label = world.config.places.find((p) => p.id === place)?.name ?? place;
      placeAffs[place] = addAff(`place-${place}`, `建议禾去${label}`, shapeCircle(0, 0, 36), () => void safely(() => onPlace(place)), false);
    }
    const skyAff = addAff('sky', '望天', { kind: 'rect', x: 0, y: 0, w: stage.width, h: stage.height * 0.48 }, () => void safely(() => onSky()), false);
    const rumorAff = addAff('rumor', '把流言放进心里', shapeCircle(0, 0, 34), () => void safely(() => takeCurrentClue()), false, undefined, (e) => {
      if (e.phase === 'end' && Math.hypot(e.dx, e.dy) > 8) void safely(() => takeCurrentClue());
    });
    const acceptAff = addAff('offer-accept', '收下眼前的承诺', shapeCircle(0, 0, 52), () => void safely(() => answerOffer(true)), false);
    const declineAff = addAff('offer-decline', '推开眼前的承诺', shapeCircle(0, 0, 42), () => void safely(() => answerOffer(false)), false);
    const commitAff = addAff('commit', '落下这份承诺', shapeCircle(0, 0, 52), () => void safely(() => confirmCommit()), false);
    const heAff = addAff('he', '看进禾心里', shapeCircle(0, 0, 56), () => void safely(() => onHe()), false);
    const ringAff = addAff('gate-ring', '叩田伯家的铺首', shapeCircle(0, 0, 36), () => void safely(() => onRing()), false);
    for (const item of ctx.aff.all()) if (!ownedAffs.includes(item)) item.setEnabled(false);

    function safely(fn: () => Promise<void> | void) {
      return Promise.resolve().then(fn).catch((err) => {
        ctx.bus.log('error', { source: 'walk2d', message: String((err as Error)?.message ?? err) });
      });
    }

    function runElapsed() { return performance.now() - runStarted; }
    function schedule(fn: () => void, ms: number): number {
      const id = window.setTimeout(() => { timeouts.delete(id); fn(); }, ms);
      timeouts.add(id);
      return id;
    }
    function cancelTimeout(id: number | null) {
      if (id === null) return;
      window.clearTimeout(id);
      timeouts.delete(id);
    }
    function pauseFor(ms: number): Promise<void> {
      return new Promise((resolve) => { schedule(resolve, ms); });
    }
    function frameWaitUntil(test: () => boolean): Promise<void> {
      return new Promise((resolve) => {
        let off = () => {};
        const fn = () => {
          if (!test()) return;
          off(); frameOffs.delete(off); resolve();
        };
        off = stage.onFrame(fn);
        frameOffs.add(off);
      });
    }
    function animate(ms: number, update: (p: number) => void): Promise<void> {
      const duration = stage.reducedMotion ? Math.min(ms, 260) : ms;
      const start = performance.now();
      return new Promise((resolve) => {
        let off = () => {};
        const fn = () => {
          const p = Math.min(1, (performance.now() - start) / Math.max(1, duration));
          update(easeOut(p));
          if (p >= 1) { off(); frameOffs.delete(off); resolve(); }
        };
        off = stage.onFrame(fn);
        frameOffs.add(off);
      });
    }

    function cameraFor(x = actorX): number {
      return clamp((x - stage.width * 0.5) / Math.max(1, worldW - stage.width), 0, 1);
    }
    function screenX(worldX: number) { return worldX - camera; }
    function placeWorldX(place: PlaceId) { return worldW * FRIEZE_PLACES[place]; }
    function actorAnchor() {
      const a = heFigure.anchors;
      return { x: a.top.x || screenX(actorX), y: a.top.y || stage.height * 0.55 };
    }
    function personAnchor(who: string) {
      if (who === 'he') return actorAnchor();
      const id: PlaceId = who === 'tianbo' ? 'gate' : who === 'linren' || who === 'ji' ? 'well' : 'home';
      return { x: screenX(placeWorldX(id)), y: stage.height * 0.64 };
    }
    function markDirty() { bgDirty = true; }

    function updateBackgroundState(state?: WorldState) {
      if (!state) return;
      visual.day = state.day;
      visual.season = state.season;
      visual.dayInSeason = state.dayInSeason;
      visual.jarDays = state.jarDays;
      visual.crack = state.crack;
      visual.hunger = state.hunger;
      visual.pressure = state.pressure;
      visual.altar = state.unfolded.includes('altar') ? 1 : 0;
      visual.dip = clamp(1 - (state.marks?.find((m) => m.kind === 'well')?.strength ?? 0.5));
      if (state.marks) {
        for (const mark of state.marks) if (!visual.marks.some((m) => m.mark.id === mark.id)) visual.marks.push({ mark, previous: 0 });
      }
      for (const closing of state.closing ?? []) applyClosing(closing.what, undefined, closing.day);
      for (const seed of state.mind.seeds) if (!visual.seeds.some((x) => x.seed.id === seed.id)) visual.seeds.push({ seed, sprout: seed.sprouted });
      if (state.ending) visual.ending = state.ending;
      markDirty();
      heart.update(state.mind);
    }

    function rebuildBackground() {
      worldW = Math.max(stage.width, stage.height * 2.7);
      if (!bg) bg = document.createElement('canvas');
      bgScale = Math.min(1, stage.dpr, Math.sqrt(8_000_000 / Math.max(1, worldW * stage.height)), 8192 / Math.max(1, worldW), 4096 / Math.max(1, stage.height));
      bg.width = Math.ceil(worldW * bgScale);
      bg.height = Math.ceil(stage.height * bgScale);
      const bgCtx = bg.getContext('2d');
      if (!bgCtx) return;
      bgCtx.setTransform(bgScale, 0, 0, bgScale, 0, 0);
      bgCtx.clearRect(0, 0, worldW, stage.height);
      cast.mother.setPose(visual.hunger > 0.58 ? 'slump' : 'stand', 0);
      cast.child.setPose(visual.hunger > 0.58 ? 'slump' : 'sit', 0);
      cast.wife.setPose(visual.hunger > 0.68 ? 'slump' : 'stand', 0);
      const finalLeave = visual.familyLeaving || visual.ending?.id === 'leave';
      if (finalLeave) {
        cast.wife.draw = () => {};
        cast.child.draw = () => {};
        cast.mother.draw = () => {};
      }
      const view: FriezeState = {
        cam: 0,
        crack: visual.crack,
        wither: clamp(0.42 + visual.hunger * 0.48 + visual.pressure * 0.1),
        jar: clamp(visual.jarDays / visual.jarMax),
        altar: visual.altar,
        gateOpen: visual.gateOpen,
        dip: visual.dip,
      };
      sceneInfo = sceneFrieze(bgCtx, worldW, stage.height, 0, cast, view);
      groundY = sceneInfo.ground;
      actorY = groundY + stage.height * 0.025;
      bgDirty = false;
    }

    function drawMark(ctx2d: C2D, entry: VisualMark, time: number) {
      const m = entry.mark;
      const x = screenX(placeWorldX(m.place));
      const y = groundY - stage.height * 0.025;
      const k = clamp(m.strength);
      ctx2d.save();
      ctx2d.globalAlpha = 0.28 + k * 0.62;
      if (m.kind === 'path') {
        ctx2d.strokeStyle = PAL.umber;
        ctx2d.lineWidth = 2 + k * 5;
        ctx2d.beginPath(); ctx2d.moveTo(x - stage.height * 0.09, y + 5); ctx2d.quadraticCurveTo(x, y - 1, x + stage.height * 0.12, y + 3); ctx2d.stroke();
        ctx2d.strokeStyle = 'rgba(224,190,130,.5)'; ctx2d.lineWidth = 0.7;
        ctx2d.beginPath(); ctx2d.moveTo(x - stage.height * 0.09, y + 5); ctx2d.lineTo(x + stage.height * 0.12, y + 3); ctx2d.stroke();
      } else if (m.kind === 'well') {
        ctx2d.strokeStyle = PAL.bronze; ctx2d.lineWidth = 1.5 + k * 2;
        ctx2d.beginPath(); ctx2d.ellipse(x, y - stage.height * 0.16, stage.height * (0.06 + k * 0.025), stage.height * 0.018, 0, 0, Math.PI * 2); ctx2d.stroke();
      } else if (m.kind === 'green') {
        sprout(ctx2d, x, y, stage.height * (0.11 + k * 0.06), { grow: k, t: time, glow: 0.12 });
      } else if (m.kind === 'gate') {
        ctx2d.strokeStyle = PAL.cinnabar; ctx2d.lineWidth = 1 + k * 2;
        ctx2d.beginPath(); ctx2d.arc(x, y - stage.height * 0.21, stage.height * (0.05 + k * 0.04), 0, Math.PI * 2); ctx2d.stroke();
      } else if (m.kind === 'oak') {
        seedGlyph(ctx2d, x, y - stage.height * 0.04, stage.height * (0.025 + k * 0.02), { lit: 1 - k, t: time });
      } else if (m.kind === 'door') {
        ctx2d.strokeStyle = PAL.umber; ctx2d.lineWidth = Math.max(2, stage.height * 0.012);
        for (let i = -1; i <= 1; i++) { ctx2d.beginPath(); ctx2d.moveTo(x + i * stage.height * 0.025, y - stage.height * 0.22); ctx2d.lineTo(x + i * stage.height * 0.025, y - stage.height * 0.015); ctx2d.stroke(); }
      } else {
        ctx2d.fillStyle = PAL.umber; ctx2d.beginPath(); ctx2d.ellipse(x, y, stage.height * 0.08, stage.height * 0.018, 0, 0, Math.PI * 2); ctx2d.fill();
      }
      if (entry.previous > 0 && entry.previous !== m.strength) {
        ctx2d.strokeStyle = `rgba(201,162,74,${0.2 + Math.sin(time * 2) * 0.06})`;
        ctx2d.lineWidth = 1;
        ctx2d.beginPath(); ctx2d.arc(x, y - stage.height * 0.06, stage.height * (0.035 + entry.previous * 0.035), 0, Math.PI * 2); ctx2d.stroke();
      }
      ctx2d.restore();
    }

    function drawClosing(ctx2d: C2D, item: VisualClosing) {
      const y = groundY - stage.height * 0.025;
      ctx2d.save(); ctx2d.strokeStyle = 'rgba(42,26,19,.92)'; ctx2d.lineWidth = Math.max(2, stage.height * 0.014);
      if (item.place) {
        const x = screenX(placeWorldX(item.place));
        for (let i = -1; i <= 1; i++) { ctx2d.beginPath(); ctx2d.moveTo(x + i * stage.height * 0.035, y - stage.height * 0.2); ctx2d.lineTo(x + i * stage.height * 0.035, y - stage.height * 0.01); ctx2d.stroke(); }
      } else {
        // 旧版 closing 状态没有地点，只在横幅边饰留一道不指向地点的暗痕。
        const bandY = stage.height * 0.965 - (visual.closings.indexOf(item) % 5) * 2;
        ctx2d.beginPath(); ctx2d.moveTo(stage.width * 0.43, bandY); ctx2d.lineTo(stage.width * 0.57, bandY); ctx2d.stroke();
      }
      ctx2d.restore();
    }

    function focusId(): string {
      if (phase === 'intro' || firstMirrorPending) return 'walk2d-he';
      if (pendingGate) return 'walk2d-gate-ring';
      if (pendingCommit) return 'walk2d-commit';
      if (visual.offer) return 'walk2d-offer-accept';
      if (phase === 'intro-actions') return 'walk2d-place-field';
      if (phase === 'playing') {
        const o = world.inclination();
        return `walk2d-place-${o.place}`;
      }
      return '';
    }

    function drawFocus(ctx2d: C2D, id: string, time: number) {
      if (!id || stage.reducedMotion || id.includes('sky') || id.includes('rumor')) return;
      let x = screenX(actorX); let y = actorY - stage.height * 0.12; let r = stage.height * 0.09;
      if (id === 'walk2d-he') { x = screenX(actorX); y = actorY - stage.height * 0.16; r = stage.height * 0.105; }
      else if (id === 'walk2d-gate-ring' || id === 'walk2d-place-gate') {
        const kn = sceneInfo?.gate.knockers[0]; x = screenX(kn?.x ?? placeWorldX('gate')); y = kn?.y ?? actorY - stage.height * 0.18; r = stage.height * 0.075;
      } else if (id === 'walk2d-offer-accept' || id === 'walk2d-commit') {
        x = screenX(placeWorldX(actorPlace)); y = actorY - stage.height * 0.2; r = stage.height * 0.12;
      } else {
        const place = id.replace('walk2d-place-', '') as PlaceId;
        if (PLACE_ORDER.includes(place)) { x = screenX(placeWorldX(place)); y = groundY - stage.height * 0.12; r = stage.height * 0.07; }
      }
      const k = 1 + Math.sin(time * 3.2) * 0.08;
      ctx2d.save(); ctx2d.strokeStyle = `rgba(201,162,74,${0.48 + Math.sin(time * 3.2) * 0.14})`; ctx2d.lineWidth = 1.2;
      ctx2d.beginPath(); ctx2d.ellipse(x, y, r * k, r * k * 0.72, 0, 0, Math.PI * 2); ctx2d.stroke();
      glow(ctx2d, x, y, r * 1.65, PAL.millet, 0.10 + Math.sin(time * 2.3) * 0.025);
      ctx2d.restore();
    }

    function drawWeather(ctx2d: C2D, time: number) {
      if (visual.sky === 'night') {
        ctx2d.fillStyle = 'rgba(20,24,38,.38)'; ctx2d.fillRect(0, 0, stage.width, stage.height);
      } else if (visual.season === 'winter') {
        ctx2d.fillStyle = 'rgba(20,24,38,.13)'; ctx2d.fillRect(0, 0, stage.width, stage.height);
      } else if (visual.season === 'summer') {
        ctx2d.fillStyle = 'rgba(179,58,38,.035)'; ctx2d.fillRect(0, 0, stage.width, stage.height);
      }
      if (visual.lookUp) {
        const x = stage.width * 0.73;
        const y = stage.height * 0.17;
        glow(ctx2d, x, y, stage.height * 0.08, PAL.cinnabar, 0.18);
        ctx2d.fillStyle = PAL.cinnabar;
        ctx2d.beginPath(); ctx2d.arc(x, y, Math.max(5, stage.height * 0.025), 0, Math.PI * 2); ctx2d.fill();
      }
      if (visual.sky === 'rain') {
        ctx2d.save(); ctx2d.strokeStyle = 'rgba(79,107,90,.58)'; ctx2d.lineWidth = 1;
        for (let i = 0; i < 40; i++) { const x = (i * 83 + time * 170) % stage.width; const y = (i * 47 + time * 230) % stage.height; ctx2d.beginPath(); ctx2d.moveTo(x, y); ctx2d.lineTo(x - 5, y + 11); ctx2d.stroke(); }
        ctx2d.restore();
      } else if (visual.sky === 'omen') {
        ctx2d.save(); ctx2d.fillStyle = PAL.cinnabar; ctx2d.globalAlpha = 0.72;
        ctx2d.beginPath(); ctx2d.arc(stage.width * 0.72, stage.height * 0.13, Math.max(2, stage.height * 0.005), 0, Math.PI * 2); ctx2d.fill(); ctx2d.restore();
      } else if (visual.sky === 'false-clouds' || visual.sky === 'clouds') {
        ctx2d.save(); ctx2d.strokeStyle = 'rgba(203,185,143,.36)'; ctx2d.lineWidth = Math.max(1, stage.height * 0.003);
        for (let i = 0; i < 3; i++) { const x = (stage.width * (0.18 + i * 0.3) + Math.sin(time * 0.14 + i) * stage.width * 0.018); const y = stage.height * (0.17 + i * 0.055); ctx2d.beginPath(); ctx2d.moveTo(x - 30, y); ctx2d.quadraticCurveTo(x, y - 12, x + 30, y); ctx2d.stroke(); }
        ctx2d.restore();
      }
    }

    function drawOffer(ctx2d: C2D, time: number) {
      if (!visual.offer) return;
      const x = screenX(placeWorldX('gate'));
      const y = groundY - stage.height * 0.35;
      if (visual.offer.kind === 'lend') tally(ctx2d, x, y, stage.height * 0.28, { split: 0, t: time });
      else {
        ctx2d.save(); ctx2d.fillStyle = PAL.umber; ctx2d.beginPath(); ctx2d.ellipse(x, y, stage.height * 0.07, stage.height * 0.035, -0.22, 0, Math.PI * 2); ctx2d.fill();
        ctx2d.strokeStyle = TONE.loessLight; ctx2d.lineWidth = 1.5; ctx2d.beginPath(); ctx2d.arc(x - stage.height * 0.018, y - 1, stage.height * 0.05, Math.PI * 1.05, Math.PI * 1.75); ctx2d.stroke(); ctx2d.restore();
      }
      glow(ctx2d, x, y, stage.height * 0.16, PAL.millet, 0.14 + Math.sin(time * 2) * 0.025);
      const dx = x + stage.height * 0.18;
      const dy = groundY - stage.height * 0.29;
      ctx2d.save();
      ctx2d.fillStyle = PAL.ochre;
      ctx2d.strokeStyle = PAL.umber;
      ctx2d.lineWidth = Math.max(1.5, stage.height * 0.004);
      ctx2d.beginPath();
      ctx2d.moveTo(dx - stage.height * 0.045, dy + stage.height * 0.025);
      ctx2d.quadraticCurveTo(dx - stage.height * 0.02, dy - stage.height * 0.005, dx + stage.height * 0.005, dy + stage.height * 0.005);
      ctx2d.lineTo(dx + stage.height * 0.035, dy - stage.height * 0.035);
      ctx2d.quadraticCurveTo(dx + stage.height * 0.052, dy - stage.height * 0.043, dx + stage.height * 0.045, dy - stage.height * 0.018);
      ctx2d.lineTo(dx + stage.height * 0.028, dy + stage.height * 0.025);
      ctx2d.quadraticCurveTo(dx, dy + stage.height * 0.05, dx - stage.height * 0.045, dy + stage.height * 0.025);
      ctx2d.closePath(); ctx2d.fill(); ctx2d.stroke(); ctx2d.restore();
    }

    function drawCommitObject(ctx2d: C2D, time: number) {
      if (!pendingCommit) return;
      const x = screenX(actorX + stage.height * 0.14);
      const y = actorY - stage.height * 0.12;
      if (pendingCommit.commits === 'sacrifice') seedGlyph(ctx2d, x, y, stage.height * 0.035, { lit: 1, t: time });
      else if (pendingCommit.commits === 'leave') {
        ctx2d.save(); ctx2d.fillStyle = PAL.ochre; ctx2d.strokeStyle = PAL.umber; ctx2d.lineWidth = 1.5;
        ctx2d.beginPath(); ctx2d.moveTo(x - 18, y + 10); ctx2d.quadraticCurveTo(x - 24, y - 8, x - 10, y - 14); ctx2d.lineTo(x + 13, y - 12); ctx2d.quadraticCurveTo(x + 22, y, x + 18, y + 12); ctx2d.closePath(); ctx2d.fill(); ctx2d.stroke();
        ctx2d.strokeStyle = PAL.gold; ctx2d.beginPath(); ctx2d.moveTo(x - 13, y - 9); ctx2d.lineTo(x + 13, y - 9); ctx2d.stroke(); ctx2d.restore();
      } else glow(ctx2d, x, y, stage.height * 0.075, PAL.cinnabar, 0.4 + Math.sin(time * 2) * 0.1);
      glow(ctx2d, x, y, stage.height * 0.11, PAL.millet, 0.16);
    }

    function drawFinalFrame(ctx2d: C2D, time: number) {
      if (!visual.ending) return;
      if (visual.ending.id === 'lend' && visual.tallySplit > 0) tally(ctx2d, stage.width * 0.5, stage.height * 0.52, stage.height * 0.5, { split: visual.tallySplit, t: time, angle: -0.06 });
      else if (visual.ending.id === 'sell') {
        ctx2d.fillStyle = PAL.umber; ctx2d.beginPath(); ctx2d.ellipse(stage.width * 0.5, stage.height * 0.55, stage.height * 0.07, stage.height * 0.03, -0.2, 0, Math.PI * 2); ctx2d.fill();
      } else if (visual.ending.id === 'sacrifice') seedGlyph(ctx2d, stage.width * 0.5, stage.height * 0.52, stage.height * 0.04, { lit: 0.5, t: time, text: '粟' });
      ticket(ctx2d, stage.width * 0.5, stage.height * 0.74, Math.min(stage.width * 0.3, stage.height * 0.25), { t: time, lift: 0.18, glow: 0.35, write: 1, seal: 1 });
      finish(ctx2d, stage.width, stage.height, { ground: 'silk', grain: 0.35, vignette: 0.48 });
    }

    function render(timeSeconds: number, forceBackground = false) {
      if (bgDirty && (!batchingBeats || forceBackground)) rebuildBackground();
      if (!bg || !sceneInfo) return;
      camera = cameraFor(actorX) * Math.max(0, worldW - stage.width);
      layer.clear();
      const sx = Math.round(camera * bgScale);
      const sw = Math.min(bg.width - sx, Math.round(stage.width * bgScale));
      g.drawImage(bg, sx, 0, sw, bg.height, 0, 0, sw / bgScale, stage.height);
      drawWeather(g, timeSeconds);
      for (const m of visual.marks) drawMark(g, m, timeSeconds);
      for (const c of visual.closings) drawClosing(g, c);
      for (const seed of visual.seeds) {
        const x = screenX(placeWorldX(seed.seed.concept === 'zou' ? 'road' : seed.seed.concept === 'she' ? 'altar' : seed.seed.concept === 'jia' ? 'home' : seed.seed.concept === 'su' ? 'well' : seed.seed.concept === 'tianbo' ? 'gate' : 'field'));
        seedGlyph(g, x, groundY - stage.height * (0.18 + (visual.seeds.indexOf(seed) % 4) * 0.028), stage.height * 0.022, { lit: seed.sprout ? 0.9 : seed.seed.blockedBy ? 0.18 : 0.58, t: timeSeconds });
        if (seed.sprout) sprout(g, x, groundY - stage.height * 0.02, stage.height * 0.07, { grow: 1, t: timeSeconds, glow: 0.35 });
      }
      if (visual.currentClue) {
        const x = screenX(placeWorldX(visual.currentClue.place));
        const y = groundY - stage.height * 0.31;
        const size = Math.max(44, stage.height * 0.09);
        bambooSlips(g, x, y + size * 0.46, size, { open: 0.62, marks: false, n: 4 });
        glow(g, x, y, size * 0.7, PAL.millet, 0.12);
      }
      seasonDial(g, stage.width * 0.09, stage.height * 0.12, Math.max(22, Math.min(stage.width, stage.height) * 0.045), { season: visual.season, progress: (visual.dayInSeason - 1) / Math.max(1, world.config.seasons.find((s) => s.season === visual.season)?.days ?? 1), t: timeSeconds });
      const heSize = Math.max(54, stage.height * 0.25);
      if (visual.familyLeaving || visual.ending?.id === 'leave') {
        wifeWalker.draw(g, screenX(actorX - heSize * 0.7), actorY, heSize * 0.95, timeSeconds);
        childWalker.draw(g, screenX(actorX - heSize * 0.38), actorY, heSize * 0.62, timeSeconds);
        if (hasMother) motherWalker.draw(g, screenX(actorX - heSize * 1.08), actorY, heSize * 0.9, timeSeconds);
      }
      heFigure.draw(g, screenX(actorX), actorY, heSize, timeSeconds);
      if (sceneInfo.gate.knockers.length) {
        const kn = sceneInfo.gate.knockers[0]!;
        if (visual.gateKnock > 0) {
          const x = screenX(kn.x); const y = kn.y;
          g.save(); g.translate(x, y); g.rotate(Math.sin(timeSeconds * 22) * 0.22 * visual.gateKnock);
          g.strokeStyle = PAL.gold; g.lineWidth = Math.max(1, stage.height * 0.004); g.beginPath(); g.arc(0, stage.height * 0.025, stage.height * 0.026, 0, Math.PI * 2); g.stroke();
          g.restore();
        }
      }
      drawOffer(g, timeSeconds);
      if (!visual.ending && visual.tallySplit > 0) tally(g, screenX(placeWorldX('gate')), groundY - stage.height * 0.35, stage.height * 0.28, { split: visual.tallySplit, t: timeSeconds });
      if (!visual.ending && visual.soilInHand) {
        const x = screenX(actorX + stage.height * 0.14); const y = actorY - stage.height * 0.12;
        g.save(); g.fillStyle = PAL.umber; g.beginPath(); g.ellipse(x, y, stage.height * 0.05, stage.height * 0.023, -0.2, 0, Math.PI * 2); g.fill(); g.restore();
      }
      drawCommitObject(g, timeSeconds);
      if (visual.mirrorTease > 0 && !heart.isOpen) {
        const a = actorAnchor();
        bronzeMirror(g, a.x, a.y - stage.height * 0.16, stage.height * (0.13 + visual.mirrorTease * 0.06), { open: clamp(visual.mirrorTease), t: timeSeconds });
      }
      if (phase !== 'ending') drawFocus(g, focusId(), timeSeconds);
      if (visual.ending) drawFinalFrame(g, timeSeconds);
      const kn = sceneInfo.gate.knockers[0];
      sceneLabels.render({ width: stage.width, mirror: heart.isOpen || mirrorOpening || phase === 'ending', intro: phase === 'intro', playing: phase === 'playing' && !pendingGate && !visual.offer && !pendingCommit, actor: { x: screenX(actorX), y: actorY }, places: Object.fromEntries(PLACE_ORDER.map(place => [place, screenX(placeWorldX(place))])) as Record<PlaceId, number>, ground: groundY, height: stage.height, pendingGate: !!pendingGate, gateRings, gateOpen: visual.gateOpen, ring: { x: screenX(kn?.x ?? placeWorldX('gate')), y: kn?.y ?? groundY - stage.height * 0.34 }, offer: visual.offer?.kind ?? null, commit: !!pendingCommit });
    }

    function syncPulse() {
      const active = focusId();
      if (active === lastPulseId) return;
      for (const item of ownedAffs) setPulse(item, false);
      const target = ctx.aff.get(active ?? '');
      if (target) setPulse(target, true);
      lastPulseId = active;
    }

    function refreshAffordances() {
      const elapsed = runElapsed();
      const allowed = new Set<Affordance>();
      const locked = mirrorOpening || heart.isOpen;
      if (phase !== 'ending' && !busy && !locked) {
        if (pendingGate) {
          if (actorPlace === 'gate' && gateRings < 3) allowed.add(ringAff);
        } else if (pendingCommit) {
          allowed.add(commitAff);
        } else if (visual.offer) {
          allowed.add(acceptAff);
          if (performance.now() - offerEnteredAt >= ENTER_LOCK_MS) allowed.add(declineAff);
        } else if (phase === 'intro') {
          allowed.add(heAff);
        } else if (phase === 'intro-actions') {
          allowed.add(placeAffs.field);
          allowed.add(skyAff);
        } else if (phase === 'playing' && elapsed >= ENTER_LOCK_MS) {
          for (const place of PLACE_ORDER) allowed.add(placeAffs[place]);
          allowed.add(heAff);
          if (visual.currentClue) allowed.add(rumorAff);
        } else if (phase === 'playing') {
          const focus = focusId();
          if (focus === 'walk2d-he') allowed.add(heAff);
          else if (focus.startsWith('walk2d-place-')) allowed.add(placeAffs[focus.slice('walk2d-place-'.length) as PlaceId]);
        }
      }
      for (const item of ownedAffs) item.setEnabled(allowed.has(item));
      const nowFocus = focusId();
      if (nowFocus !== lastFocusId) { syncPulse(); lastFocusId = nowFocus; }
      positionAffordances();
    }

    function placeShape(item: Affordance, shape: AffShape) {
      const rounded = shape.kind === 'circle'
        ? { ...shape, x: Math.round(shape.x), y: Math.round(shape.y), r: Math.round(shape.r) }
        : { ...shape, x: Math.round(shape.x), y: Math.round(shape.y), w: Math.round(shape.w), h: Math.round(shape.h) };
      const key = JSON.stringify(rounded);
      if (shapeCache.get(item) === key) return;
      shapeCache.set(item, key);
      item.setShape(rounded);
    }

    function positionAffordances() {
      const w = stage.width; const h = stage.height;
      const x = screenX(actorX); const y = actorY - h * 0.13;
      placeShape(heAff, shapeCircle(x, y, Math.max(36, h * 0.095)));
      for (const place of PLACE_ORDER) {
        const px = screenX(placeWorldX(place));
        placeShape(placeAffs[place]!, shapeCircle(px, groundY - h * 0.09, Math.max(28, h * 0.058)));
      }
      placeShape(skyAff, { kind: 'rect', x: 0, y: 0, w, h: h * 0.48 });
      if (visual.currentClue) {
        const id = visual.currentClue.place;
        placeShape(rumorAff, shapeCircle(screenX(placeWorldX(id)), groundY - h * 0.31, Math.max(26, h * 0.046)));
      }
      if (visual.offer) placeShape(acceptAff, shapeCircle(screenX(placeWorldX('gate')), groundY - h * 0.35, Math.max(38, h * 0.1)));
      placeShape(declineAff, shapeCircle(screenX(placeWorldX('gate')) + h * 0.18, groundY - h * 0.29, Math.max(28, h * 0.065)));
      placeShape(commitAff, shapeCircle(screenX(actorX + h * 0.14), actorY - h * 0.12, Math.max(38, h * 0.1)));
      const kn = sceneInfo?.gate.knockers[0];
      placeShape(ringAff, shapeCircle(screenX(kn?.x ?? placeWorldX('gate')), kn?.y ?? groundY - h * 0.34, Math.max(28, h * 0.062)));
    }

    function presenterIsOpen() {
      return presenterEventSeen ? presenterOpen : ctx.handoff.presenterOpen === true;
    }

    function canIdle() {
      return phase === 'playing' && !busy && !heart.isOpen && !mirrorOpening && !presenterIsOpen()
        && !visual.offer && !pendingCommit && !pendingGate;
    }

    function resetIdleTimer() {
      cancelTimeout(idleTimer); idleTimer = null;
      if (!canIdle()) { idleWindowStarted = null; return; }
      const now = performance.now();
      idleWindowStarted ??= now;
      const delay = Math.max(0, Math.min(IDLE_MS, idleWindowStarted + patienceMs - now));
      idleTimer = schedule(() => {
        idleTimer = null;
        idleWindowStarted = null;
        if (!canIdle()) return;
        void safely(() => takeIdleTurn());
      }, delay);
    }

    // 视线仍在动就给一点时间，但禾的耐性有限，不会被摇鼠标永远拖住。
    const onAttention = () => resetIdleTimer();
    stage.root.addEventListener('pointermove', onAttention, { passive: true });
    stage.root.addEventListener('pointerdown', onAttention, { passive: true });
    window.addEventListener('keydown', onAttention);

    function recordDwell() {
      const dwell = ctx.aff.dwell();
      for (const place of PLACE_ORDER) {
        const id = `walk2d-place-${place}`;
        const ms = Math.round(dwell[id] ?? 0);
        latestPlaceDwell[place] = ms;
      }
      const best = PLACE_ORDER.slice().sort((a, b) => latestPlaceDwell[b] - latestPlaceDwell[a])[0]!;
      if (latestPlaceDwell[best] > (ctx.record.longestPlaceMs ?? 0)) {
        ctx.record.longestPlace = world.config.places.find((p) => p.id === best)?.name ?? best;
        ctx.record.longestPlaceMs = latestPlaceDwell[best];
      }
    }

    function syncMindTrace() {
      for (const entry of world.mindTrace() as AuditEntry[]) {
        if (seenAudit.has(entry.seq)) continue;
        seenAudit.add(entry.seq);
        ctx.bus.log(traceKindOf(entry), { audit: entry, seq: entry.seq, mind: entry.mind, level: entry.level, op: entry.op, worldDay: entry.t });
      }
    }

    function syncLedger(beats?: Beat[]) {
      syncMindTrace();
      const ledger = world.ledger();
      const seenAtBeats = new Set((beats ?? []).filter((b): b is Extract<Beat, { kind: 'fact' }> => b.kind === 'fact').map((b) => b.fact.id));
      for (const fact of ledger) {
        if (seenFacts.has(fact.id)) continue;
        if (beats && seenAtBeats.has(fact.id)) continue;
        seenFacts.add(fact.id);
        ctx.bus.log('world.fact', { fact });
      }
    }

    function applyClosing(what: string, place?: PlaceId, day = visual.day) {
      const key = `${day}:${what}`;
      const existing = visual.closings.find((x) => x.key === key);
      if (existing) {
        if (!existing.place && place) existing.place = place;
        return;
      }
      visual.closings.push({ key, what, day, place });
      if (!seenClosings.has(key)) {
        seenClosings.add(key);
        ctx.bus.log('world.closing', { what, place, day });
      }
    }

    function applyMark(mark: Mark, previous = 0) {
      const old = visual.marks.find((x) => x.mark.id === mark.id);
      if (old) { old.previous = old.mark.strength; old.mark = mark; }
      else visual.marks.push({ mark, previous });
      ctx.bus.log('world.mark', { mark, previous });
      markDirty();
    }

    function displayName(who: string) {
      return ({ he: '禾', tianbo: '田伯', sang: '桑', xiaoshi: '小石', mu: '母', linren: '邻人', ji: '季', luren: '路人' } as Record<string, string>)[who] ?? who;
    }

    function updateLine(who: string, text: string, source?: { source: 'rules' | 'model'; ms?: number; why?: string }) {
      const anchor = () => personAnchor(who);
      const line = text.trim();
      if (!line) return Promise.resolve();
      if ([...line.replace(/\s/g, '')].length > 30) {
        ctx.bus.log('error', { source: 'walk2d.line', who, chars: [...line.replace(/\s/g, '')].length });
      }
      return ctx.lines.say({ who: displayName(who), text: line, anchor, ink: 'dark', source: source ?? { source: 'rules' }, holdMs: 680, charMs: 24 });
    }

    async function speakGate(beat: Extract<Beat, { kind: 'gate' }>) {
      let text = beat.line;
      let source: { source: 'rules' | 'model'; ms?: number; why?: string } = { source: 'rules', why: 'not-asked' };
      if (beat.think) {
        const result = await ctx.think.race<string>({
          kind: beat.think.kind, prompt: beat.think.prompt,
          rules: () => beat.line,
          coerce: (raw) => {
            const candidate = typeof raw === 'string' ? raw.trim().replace(/^['"“”「」]+|['"“”「」]+$/g, '') : '';
            return gateLineIsPlausible(candidate, beat.response) ? candidate : null;
          },
        }, Math.min(2500, beat.think.deadlineMs));
        text = result.value;
        source = { source: result.source, ms: result.ms, why: result.why };
        hadModel ||= result.source === 'model';
      }
      await updateLine('tianbo', text, source);
    }

    function heartClosePromise() {
      return new Promise<void>((resolve) => { waitingForClose = resolve; });
    }

    async function openHeart(reason: 'first' | 'player' | 'error' | 'unfold') {
      if (heart.isOpen || mirrorOpening) return;
      cancelTimeout(idleTimer); idleTimer = null;
      idleWindowStarted = null;
      mirrorOpening = true;
      mirrorReason = reason;
      heart.update(world.state().mind);
      heart.setAdvanced(!guidedEntry || world.state().visitsToGate > 0);
      heart.setApproaches(reason === 'error' || reason === 'unfold' ? [] : APPROACHES);
      heart.setWritable(reason === 'first' || reason === 'player');
      await heart.open(actorAnchor, { reason });
      mirrorOpening = false;
      if (reason === 'first' || reason === 'player') ctx.audio.sfx('heart-open');
      refreshAffordances();
    }

    async function closeHeartFromCode() {
      if (heart.isOpen || mirrorOpening) await heart.close();
      ctx.audio.sfx('heart-close');
      mirrorOpening = false;
      const wasFirst = mirrorReason === 'first';
      mirrorReason = null;
      const resolve = waitingForClose; waitingForClose = null; resolve?.();
      if (clueCleanup) await clueCleanup;
      if (wasFirst) {
        phase = guidedEntry ? 'playing' : 'intro-actions';
      }
      refreshAffordances();
      resetIdleTimer();
    }

    async function handleHeartEvent(event: HeartEvent) {
      if (event.kind === 'close') {
        await closeHeartFromCode();
        return;
      }
      if (event.kind === 'nudge') {
        world.nudgeBelief(event.trait, event.delta);
        heart.update(world.state().mind);
        syncLedger();
        ctx.audio.sfx('weight');
        recordDwell();
        return;
      }
      if (event.kind === 'rehearse') {
        rejectedBorrowApproach = undefined;
        const rehearsal = world.rehearse(event.approach);
        syncMindTrace();
        heart.update(world.state().mind);
        await heart.showRehearsal(rehearsal);
        ctx.audio.sfx('insight');
        return;
      }
      if (event.kind === 'go') {
        if (busy) return;
        busy = true;
        const suggestion = world.suggest('gate', event.approach);
        syncLedger();
        if (!suggestion.accepted || !suggestion.option) {
          heart.update(world.state().mind);
          if (suggestion.seed) await heart.addSeed(suggestion.seed);
          await closeHeartFromCode();
          phase = 'playing';
          await updateLine('he', `禾没用${approachName[event.approach]}：${suggestion.line ?? '我再想想。'}`, { source: 'rules' });
          await followOwnIntent('禾挡下了这个念头，照自己的意思做。', event.approach);
          return;
        }
        await closeHeartFromCode();
        busy = false;
        await stageGate(suggestion.option);
        return;
      }
      if (event.kind === 'write') {
        const words = event.words.trim();
        if (!words) return;
        const ruleConcept = translateWords(words);
        let concept = ruleConcept;
        let source: { source: 'rules' | 'model'; ms?: number; why?: string } = { source: 'rules', why: 'not-asked' };
        const result = await ctx.think.race<Concept | null>({
          kind: 'translate-thought',
          prompt: `把农夫禾能想的念头翻译成一个概念，只答 tian、she、jia、su、tianbo、zou、di 或 deng。原话：${words}`,
          explicit: true,
          rules: () => ruleConcept,
          coerce: (raw) => conceptFromModel(raw),
        }, 2500);
        if (result.value) concept = result.value;
        source = { source: result.source, ms: result.ms, why: result.why };
        hadModel ||= result.source === 'model';
        if (!concept) {
          await updateLine('he', '这句话，我还想不明白。', source);
          return;
        }
        const planted = world.plant(concept, words);
        syncLedger();
        heart.update(world.state().mind);
        await updateLine('he', planted.line, source);
        if (planted.seed) await heart.addSeed(planted.seed);
        if (planted.effect === 'acted' && planted.option) {
          await closeHeartFromCode();
          if (planted.option.place === 'gate') await stageGate(planted.option);
          else if (planted.option.commits) stageCommit(planted.option);
          else await actOption(planted.option, true);
        }
        return;
      }
    }

    const offHeart = heart.on((event) => { void safely(() => handleHeartEvent(event)); });
    const offPresenter = ctx.bus.on('presenter.visibility', (payload: { open?: boolean } | undefined) => {
      presenterEventSeen = true;
      presenterOpen = typeof payload?.open === 'boolean' ? payload.open : ctx.handoff.presenterOpen === true;
      if (presenterOpen) {
        cancelTimeout(idleTimer);
        idleTimer = null;
        idleWindowStarted = null;
      } else {
        // 收起面板后从此刻重新计满六秒。
        resetIdleTimer();
      }
    });

    async function openFirstMirror() {
      if (firstMirrorOpened) { await openHeart('player'); return; }
      firstMirrorOpened = true;
      firstMirrorPending = false;
      const closed = heartClosePromise();
      await openHeart('first');
      heart.update(world.state().mind);
      if (guidedEntry) {
        await ctx.lines.say({ who: '禾', text: '选个借法，先看预想。', anchor: () => { const layout = heartLayout(stage.width, stage.height, actorAnchor()); return { x: layout.cx, y: layout.cy - layout.ri * 0.69 }; }, width: () => heartLayout(stage.width, stage.height, actorAnchor()).ri * 1.7, ink: 'light', source: { source: 'script' }, sticky: true, charMs: 24 });
      } else {
        const approach = world.inclination().approach ?? 'qing';
        await heart.showRehearsal(world.rehearse(approach));
      }
      await closed;
    }

    async function onHe() {
      if (busy || phase === 'ending') return;
      ctx.audio.unlock();
      ctx.audio.ambience('field-summer', 0.23, 550);
      ctx.audio.music({ tension: 0.42, on: true });
      ctx.audio.sfx('soil');
      busy = true;
      firstMirrorPending = !firstMirrorOpened;
      visual.mirrorTease = 0.2;
      void animate(420, (p) => { visual.mirrorTease = 0.2 + p * 0.8; });
      refreshAffordances();
      if (!firstMirrorOpened && runElapsed() < ENTER_LOCK_MS) await frameWaitUntil(() => runElapsed() >= ENTER_LOCK_MS);
      busy = false;
      if (!firstMirrorOpened) await openFirstMirror();
      else await openHeart('player');
      visual.mirrorTease = 0;
      refreshAffordances();
    }

    function onSky() {
      if (phase === 'intro-actions') {
        heFigure.setPose('look-up', stage.reducedMotion ? 0 : 160);
        heFigure.setGaze(0.42);
        void doSuggestion('field');
      }
    }

    function onPlace(place: PlaceId) {
      if (phase === 'intro-actions' && place !== 'field') return;
      if (pendingGate || pendingCommit || visual.offer || busy) return;
      if (phase === 'intro-actions') {
        void doSuggestion('field');
        return;
      }
      void doSuggestion(place);
    }

    async function doSuggestion(place: PlaceId, approach?: Approach) {
      if (busy) return;
      busy = true;
      resetIdleTimer();
      const actualApproach = place === 'gate' ? approach ?? world.inclination().approach ?? optionFor(world, 'gate')?.approach ?? 'qing' : approach;
      const suggestion = world.suggest(place, actualApproach);
      syncLedger();
      if (!suggestion.accepted || !suggestion.option) {
        heart.update(world.state().mind);
        if (suggestion.seed) {
          visual.seeds.push({ seed: suggestion.seed, sprout: suggestion.seed.sprouted });
          if (heart.isOpen) await heart.addSeed(suggestion.seed);
          ctx.audio.sfx('seed'); markDirty();
        }
        await updateLine('he', suggestion.line ?? '我再想想。', { source: 'rules' });
        if (phase === 'intro-actions') phase = 'playing';
        await followOwnIntent('禾挡下了这个念头，照自己的意思做。', actualApproach);
        return;
      }
      if (phase === 'intro-actions') phase = 'playing';
      if (suggestion.option.place === 'gate') {
        busy = false;
        await stageGate(suggestion.option);
      } else if (suggestion.option.commits) {
        busy = false;
        stageCommit(suggestion.option);
      } else {
        await actOption(suggestion.option, false);
      }
    }

    async function stageGate(option: DayOption, selfWhy: string | null = null, changedFrom?: Approach) {
      if (busy) return;
      busy = true;
      pendingGate = option;
      pendingGateSelf = selfWhy;
      if (selfWhy) ctx.bus.log('world.event', { kind: 'self-intent', option, why: selfWhy });
      gateRings = 0;
      ctx.audio.sfx('step');
      const fromX = actorX;
      const toX = placeWorldX('gate');
      actorPlace = 'gate';
      heFigure.facing = toX >= fromX ? 1 : -1;
      heFigure.setPose('walk', 250);
      await animate(stage.reducedMotion ? 500 : 2300, (p) => { actorX = lerp(fromX, toX, p); });
      actorX = toX;
      heFigure.setPose('stand', 220);
      ctx.audio.sfx('step');
      if (option.approach) {
        // 被拒的建议可以换法。预想始终跟着本次真实借法，在三下门环前常显。
        const rehearsal = world.rehearse(option.approach);
        const previousApproach = changedFrom ?? rejectedBorrowApproach;
        rejectedBorrowApproach = undefined;
        syncMindTrace();
        ctx.bus.log('world.event', { kind: 'gate-preview', approach: rehearsal.approach, predicted: rehearsal.predicted, changedFrom: previousApproach });
        void ctx.lines.say({ who: '禾', text: rehearsalText(rehearsal, previousApproach), anchor: () => ({ x: screenX(actorX), y: actorY - stage.height * 0.21 - 30 }), width: () => stage.width * 0.82, ink: 'dark', tone: 'thought', source: { source: 'rules' }, why: rehearsal.line, sticky: true, charMs: 24 });
      }
      busy = false;
      refreshAffordances();
      resetIdleTimer();
    }

    async function onRing() {
      if (!pendingGate || busy || gateRings >= 3) return;
      busy = true;
      gateRings++;
      lastRingTime = performance.now();
      visual.gateKnock = 1;
      visual.gateOpen = gateRings === 3 ? 0.08 : 0;
      markDirty();
      ringAff.setLabel(gateRings >= 3 ? '门缝透光' : `再叩一次（${gateRings}/3）`);
      ctx.audio.sfx('knock', { gain: 0.72 });
      if (gateRings < 3) {
        await animate(180, (p) => { visual.gateKnock = 1 - p; });
        busy = false; refreshAffordances(); resetIdleTimer();
        return;
      }
      ctx.audio.sfx('gate-open', { gain: 0.35 });
      await animate(720, (p) => { visual.gateOpen = 0.08 + p * 0.2; visual.gateKnock = 1 - p * 0.6; });
      const option = pendingGate;
      const selfWhy = pendingGateSelf;
      pendingGate = null;
      pendingGateSelf = null;
      gateRings = 0;
      ringAff.setLabel('叩田伯家的铺首');
      if (option && selfWhy) await settleOutcome(world.idle(option, selfWhy), option, true);
      else if (option) await actOption(option, true);
      else { busy = false; refreshAffordances(); }
    }

    function stageCommit(option: DayOption, selfWhy: string | null = null) {
      pendingCommit = option;
      pendingCommitSelf = selfWhy;
      if (selfWhy) ctx.bus.log('world.event', { kind: 'self-intent', option, why: selfWhy });
      visual.pendingCommit = option.commits ?? null;
      markDirty();
      busy = false;
      refreshAffordances();
      resetIdleTimer();
    }

    async function confirmCommit() {
      if (!pendingCommit || busy) return;
      const option = pendingCommit;
      const selfWhy = pendingCommitSelf;
      pendingCommit = null;
      pendingCommitSelf = null;
      visual.pendingCommit = null;
      busy = true;
      ctx.audio.sfx('tick');
      await animate(280, () => markDirty());
      if (selfWhy) await settleOutcome(world.idle(option, selfWhy), option, true);
      else await actOption(option, true);
    }

    async function answerOffer(accept: boolean) {
      if (!visual.offer || busy) return;
      if (!accept && performance.now() - offerEnteredAt < ENTER_LOCK_MS) return;
      busy = true;
      const action = accept ? 'accept' : 'decline';
      const option = world.options().find((o) => o.action === action && o.place === 'gate');
      if (!option) { busy = false; return; }
      if (accept && visual.offer.kind === 'lend') {
        visual.tallySplit = 0.08;
        void animate(440, (p) => { visual.tallySplit = p; });
        ctx.audio.sfx('tally-snap');
      } else if (accept && visual.offer.kind === 'buy-land') ctx.audio.sfx('soil');
      else ctx.audio.sfx('gate-shut');
      visual.offer = null;
      markDirty();
      await actOption(option, true);
    }

    async function takeCurrentClue() {
      if (!visual.currentClue || busy || visual.offer || pendingCommit || pendingGate) return;
      const clue = visual.currentClue;
      busy = true;
      let finishCleanup!: () => void;
      const cleanup = new Promise<void>(resolve => { finishCleanup = resolve; });
      clueCleanup = cleanup;
      try {
        const result = world.takeClue(clue.id);
        syncLedger();
        heart.update(world.state().mind);
        if (result.seed) {
          visual.seeds.push({ seed: result.seed, sprout: result.seed.sprouted });
          await heart.addSeed(result.seed);
        }
        ctx.audio.sfx('seed');
        const closed = heartClosePromise();
        await openHeart('player');
        busy = false;
        await updateLine('he', result.line, { source: 'rules' });
        await closed;
      } finally {
        if (visual.currentClue?.id === clue.id) visual.currentClue = null;
        if (clueCleanup === cleanup) clueCleanup = null;
        finishCleanup();
        refreshAffordances(); resetIdleTimer();
      }
    }

    async function followOwnIntent(why: string, changedFrom?: Approach) {
      if (changedFrom) rejectedBorrowApproach = changedFrom;
      const option = world.inclination();
      if (option.place === 'gate' && option.action === 'borrow') {
        busy = false;
        await stageGate(option, why, changedFrom);
      } else if (option.commits) {
        busy = false;
        stageCommit(option, why);
      } else {
        await settleOutcome(world.idle(option, why), option, true);
      }
    }

    async function takeIdleTurn() {
      if (phase !== 'playing' || busy || heart.isOpen || presenterIsOpen() || pendingGate || pendingCommit || visual.offer) return;
      busy = true;
      idleCount++;
      ctx.bus.log('tele.idle', { ms: IDLE_MS, count: idleCount });
      ctx.audio.sfx('step', { gain: 0.35 });
      await followOwnIntent('禾没等你，照自己的意思去做了。');
    }

    async function actOption(option: DayOption, fromPending: boolean) {
      if (world.finished()) { busy = false; return; }
      busy = true;
      resetIdleTimer();
      const outcome = world.act(option);
      await settleOutcome(outcome, option, fromPending);
    }

    async function settleOutcome(outcome: DayOutcome, option: DayOption, fromPending: boolean) {
      await processOutcome(outcome);
      updateBackgroundState(outcome.state);
      syncLedger();
      if (world.finished() || outcome.state.ending) {
        await completeEnding(outcome.state.ending!);
        return;
      }
      const offer = world.offer();
      if (offer) {
        visual.offer = offer;
        offerEnteredAt = performance.now();
        ctx.audio.sfx(offer.kind === 'lend' ? 'tick' : 'soil');
      } else visual.offer = null;
      visual.pendingCommit = null;
      pendingCommit = null;
      pendingCommitSelf = null;
      pendingGate = null;
      pendingGateSelf = null;
      busy = false;
      refreshAffordances();
      resetIdleTimer();
      recordDwell();
      ctx.bus.log('world.day', { day: outcome.state.day, season: outcome.state.season, place: outcome.state.place, suggested: option.place, action: option.action, pending: fromPending });
    }

    async function processOutcome(outcome: DayOutcome) {
      batchingBeats = true;
      let borrowApproach: Approach | undefined;
      for (const beat of outcome.beats) {
        switch (beat.kind) {
          case 'season':
            visual.season = beat.season; visual.day = beat.day; visual.dayInSeason = 1;
            ctx.audio.sfx('season'); ctx.bus.log('world.day', { day: beat.day, season: beat.season }); markDirty(); break;
          case 'dawn':
            visual.day = beat.day; visual.lookUp = false; ctx.audio.sfx('tick', { gain: 0.24 }); break;
          case 'walk': {
            visual.lookUp = false;
            const toX = placeWorldX(beat.to); const fromX = actorX;
            actorPlace = beat.to;
            if (Math.abs(toX - fromX) < 12) { actorX = toX; break; }
            heFigure.facing = toX >= fromX ? 1 : -1;
            heFigure.setPose('walk', 180);
            ctx.audio.sfx('step', { gain: 0.45 });
            await animate(stage.reducedMotion ? 520 : 2200, (p) => { actorX = lerp(fromX, toX, p); });
            actorX = toX; heFigure.setPose('stand', 260); break;
          }
          case 'pose': {
            const pose = POSE_MAP[beat.pose] ?? 'stand';
            if (beat.who === 'he') {
              if (beat.pose !== 'look-up') visual.lookUp = false;
              heFigure.setPose(pose, stage.reducedMotion ? 0 : beat.ms ?? 430);
            }
            else if (beat.who === 'tianbo') { tianboFigure.setPose(pose, 360); markDirty(); }
            else if (beat.who === 'sang') cast.wife.setPose(pose, 360);
            else if (beat.who === 'xiaoshi') cast.child.setPose(pose, 360);
            if (beat.pose === 'soil-in-hand') visual.soilInHand = true;
            if (beat.pose === 'family-leave') { visual.familyLeaving = true; markDirty(); }
            if (beat.pose.includes('tally')) {
              visual.tallySplit = 0.02;
              await animate(stage.reducedMotion ? 180 : 420, (p) => { visual.tallySplit = p; });
            }
            ctx.bus.log('world.event', { kind: 'pose', who: beat.who, pose: beat.pose });
            ctx.audio.sfx(beat.pose.includes('soil') ? 'soil' : beat.pose.includes('tally') ? 'tally-snap' : 'step', { gain: 0.35 });
            if (beat.who !== 'he') markDirty();
            if (beat.ms && !beat.pose.includes('tally')) await animate(Math.min(900, beat.ms), () => {});
            break;
          }
          case 'say': await updateLine(beat.who, beat.text, { source: 'rules' }); break;
          case 'layer':
            heart.flashLayer(beat.layer);
            ctx.bus.log('mind.layer', { who: beat.who, layer: beat.layer, cause: beat.cause });
            if (beat.who === 'he' && beat.layer === 'mind') {
              visual.lookUp = true;
              heFigure.setPose('look-up', stage.reducedMotion ? 0 : 360);
              heFigure.setGaze(0.48);
            } else if (beat.who === 'he' && beat.layer === 'module') {
              visual.lookUp = false;
              heFigure.setPose('stand', stage.reducedMotion ? 0 : 280);
            }
            if (beat.layer === 'mind') ctx.audio.sfx('insight', { gain: 0.25 });
            break;
          case 'jar': visual.jarDays = beat.days; markDirty(); ctx.audio.sfx('jar', { gain: 0.2 }); break;
          case 'hunger': visual.hunger = beat.level; markDirty(); break;
          case 'crack': visual.crack = beat.amount; markDirty(); ctx.audio.sfx('crack', { gain: 0.35 }); break;
          case 'sky': visual.sky = beat.state; break;
          case 'rumor':
            visual.currentClue = beat.clue;
            ctx.audio.sfx('tick', { gain: 0.22 });
            await updateLine(beat.clue.from, beat.clue.text, { source: 'rules' });
            break;
          case 'knock':
            borrowApproach = beat.approach;
            // 三次真实门环已演完，不再把世界的 borrow 拍画成第四下叩门。
            visual.gateKnock = 0; break;
          case 'gate':
            visual.gateOpen = beat.response === 'refuse' ? 0 : 0.78;
            markDirty(); ctx.audio.sfx(beat.response === 'refuse' ? 'gate-shut' : 'gate-open');
            render(stage.time, true);
            await pauseFor(360);
            await speakGate(beat);
            break;
          case 'error': {
            ctx.bus.log('mind.error', { approach: borrowApproach, trait: beat.trait, before: beat.before, after: beat.after, predicted: beat.predicted, actual: beat.actual });
            heart.update(world.state().mind);
            const closed = heartClosePromise();
            await openHeart('error');
            await heart.showError({ approach: borrowApproach, trait: beat.trait, before: beat.before, after: beat.after, predicted: beat.predicted, actual: beat.actual });
            ctx.audio.sfx('error');
            await closed;
            break;
          }
          case 'seed':
            if (!visual.seeds.some((x) => x.seed.id === beat.seed.id)) visual.seeds.push({ seed: beat.seed, sprout: false });
            if (heart.isOpen) await heart.addSeed(beat.seed);
            ctx.audio.sfx('seed'); markDirty(); break;
          case 'sprout':
            if (!visual.seeds.some((x) => x.seed.id === beat.seed.id)) visual.seeds.push({ seed: beat.seed, sprout: true });
            else { const s = visual.seeds.find((x) => x.seed.id === beat.seed.id)!; s.seed = beat.seed; s.sprout = true; }
            if (heart.isOpen) await heart.sprout(beat.seed);
            ctx.audio.sfx('sprout'); markDirty(); break;
          case 'unfold': {
            visual.altar = 1; markDirty(); ctx.audio.sfx('insight'); render(stage.time, true);
            const seed = world.state().mind.seeds.find((s) => s.concept === 'she' || s.concept === 'tian');
            const closed = heartClosePromise();
            await openHeart('unfold');
            if (seed) await heart.sprout(seed);
            await closed; break;
          }
          case 'price': break;
          case 'fact':
            if (!seenFacts.has(beat.fact.id)) { seenFacts.add(beat.fact.id); ctx.bus.log('world.fact', { fact: beat.fact }); }
            break;
          case 'commit':
            visual.ending = beat.ending; visual.familyLeaving ||= beat.ending.id === 'leave'; ctx.audio.sfx('seal'); markDirty(); break;
          case 'wait': await pauseFor(beat.ms); break;
          case 'mark': applyMark(beat.mark, beat.prev ?? 0); break;
          case 'closing':
            applyClosing(beat.what, beat.place, visual.day);
            break;
          case 'self':
            ctx.bus.log('world.self', { option: beat.option, why: beat.why });
            break;
        }
        render(stage.time);
      }
      if (outcome.state.marks) for (const mark of outcome.state.marks) if (!visual.marks.some((x) => x.mark.id === mark.id)) applyMark(mark);
      batchingBeats = false;
      updateBackgroundState(outcome.state);
      render(stage.time);
      syncLedger(outcome.beats);
      heart.update(outcome.state.mind);
    }

    async function completeEnding(ending: Ending) {
      phase = 'ending'; busy = false;
      visual.ending = ending;
      visual.offer = null; visual.pendingCommit = null;
      markDirty();
      cancelTimeout(idleTimer); idleTimer = null;
      recordDwell();
      ctx.record.ending = ending.id;
      ctx.record.endingFact = ending.fact.text;
      ctx.handoff.ending = ending;
      ctx.handoff.world = world;
      ctx.handoff.ticket = { x: stage.width * 0.5, y: stage.height * 0.74, w: Math.min(stage.width * 0.3, stage.height * 0.25) };
      render(stage.time);
      if (bg) {
        const copy = document.createElement('canvas');
        copy.width = bg.width; copy.height = bg.height;
        // handoff.frame 是最终屏幕画面的副本，按 CSS 像素定位票根。
        copy.width = Math.ceil(stage.width * stage.dpr);
        copy.height = Math.ceil(stage.height * stage.dpr);
        const copyCtx = copy.getContext('2d');
        if (copyCtx) copyCtx.drawImage(layer.canvas, 0, 0);
        ctx.handoff.frame = copy;
      }
      ctx.audio.ambience('silence', 0, 650);
      ctx.audio.music({ tension: 0.12, on: false });
      ctx.bus.log('world.event', { kind: 'ending', id: ending.id, day: ending.day, fact: ending.fact.id, modelLine: hadModel });
    }

    async function onHeartEventConcept(event: HeartEvent) {
      await handleHeartEvent(event);
    }

    async function onRingKeySafe() { return onRing(); }

    async function stageOpening() {
      const snapshot = world.state();
      updateBackgroundState(snapshot);
      if (guidedEntry) {
        ctx.bus.log('world.event', { kind: 'before-visit', steps: beforeVisitSteps, day: snapshot.day, season: snapshot.season, reason: '禾已经独自熬到愿意求粮的日子。' });
        syncLedger();
        await ctx.lines.say({ who: '禾', text: `${SEASON_NAME[snapshot.season]}旱未解，得向田伯借点粟。`, anchor: actorAnchor, ink: 'dark', source: { source: 'rules' }, sticky: true, charMs: 24 });
      } else {
        await processOutcome({ beats: world.opening(), state: snapshot });
      }
    }

    async function mainLoop() {
      // 入场只给禾一个焦点。第一次看心象安排在本幕三秒门槛之后。
      refreshAffordances();
      await stageOpening();
      phase = 'intro';
      refreshAffordances();
      await frameWaitUntil(() => phase === 'ending');
    }

    const offResize = stage.onResize(() => {
      const oldW = worldW;
      const nextW = Math.max(stage.width, stage.height * 2.7);
      actorX = oldW ? actorX / oldW * nextW : nextW * FRIEZE_PLACES.field;
      worldW = nextW;
      markDirty(); positionAffordances();
      if (visual.offer) acceptAff.setShape(shapeCircle(screenX(placeWorldX('gate')), groundY - stage.height * 0.35, Math.max(38, stage.height * 0.1)));
    });
    frameOffs.add(offResize);
    const offFrame = stage.onFrame((t) => {
      if (visual.mirrorTease > 0.2 && !heart.isOpen && !firstMirrorOpened) visual.mirrorTease = Math.max(0.2, visual.mirrorTease - 0.0006);
      render(t);
      refreshAffordances();
      if (visual.offer && declineAff.el.disabled && performance.now() - offerEnteredAt >= ENTER_LOCK_MS && !busy && !heart.isOpen) refreshAffordances();
      if (visual.gateKnock > 0 && !busy && performance.now() - lastRingTime > 800) visual.gateKnock = 0;
    });
    frameOffs.add(offFrame);

    // 首次显影画面即从真实世界 opening() 读入天气、粟瓮和季节。
    await mainLoop();

    const ending = world.state().ending;

    // 退出时回收本幕拥有的资源，保留 handoff 的副本。
    cancelTimeout(idleTimer); idleTimer = null;
    for (const id of [...timeouts]) cancelTimeout(id);
    for (const off of [...frameOffs]) { off(); frameOffs.delete(off); }
    offHeart();
    offPresenter();
    stage.root.removeEventListener('pointermove', onAttention);
    stage.root.removeEventListener('pointerdown', onAttention);
    window.removeEventListener('keydown', onAttention);
    heart.destroy();
    for (const aff of ownedAffs) aff.remove();
    ctx.lines.clear();
    await pauseFor(420);
    recordDwell();
    const texture = bg as HTMLCanvasElement | null;
    if (texture) { texture.width = 0; texture.height = 0; }
    sceneLabels.destroy();
    stage.removeLayer('walk2d-language');
    style.remove();
    stage.root.style.overflow = previousOverflow;
    stage.removeLayer(FRAME_ID);
    return { act: act.id, data: { ending: ending?.id, day: ending?.day, fact: ending?.fact.id, source: hadModel ? 'model-and-rules' : 'rules' } };
  },
};
