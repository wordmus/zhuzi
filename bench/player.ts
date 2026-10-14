// 模拟玩家：对任何版本的应用都能玩。只认 [data-aff] 和 window.__zhuzi.done，不认文字。
// 策略（确定性，同样的页面状态永远点同一个东西）：
//   1. 当前幕的焦点（act.enter 里的 focus）对应的可做之事；
//   2. 在脉动的那个；
//   3. 否则 DOM 里第一个（给了 seed 则按 seed 在候选里挑）。
// 点之前等“可做的事”稳定一小会儿，像人一样先看一眼；卡住时换一个、再拖一下，仍无进展就放弃。
// 可选：抽几次点击做反馈延迟探针（截图像素差分），按幕截图。

import fs from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright';
import { Differ, ev, sleep, type Rect, type Thresholds } from './lib';

export interface Cand {
  id: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  hit: boolean;
  pulse: boolean;
}

export interface Snap {
  now: number;
  done: boolean;
  traceLen: number;
  progress: number;
  act: string | null;
  acts: number;
  focus: string | null;
  cands: Cand[];
  inputs: { cx: number; cy: number; focused: boolean }[];
  chars: number;
  digits: number;
  lastSay: number;
}

export type PlayReason = 'done' | 'max-steps' | 'max-seconds' | 'stuck' | 'no-affordance' | 'crashed';

export interface Step {
  i: number;
  /** 页面时钟（performance.now），与 bench 的各种时间序列同一把尺 */
  pageT: number;
  act: string | null;
  aff: string | null;
  how: 'click' | 'drag' | 'js-click' | 'enter';
  prefer: string;
  progressed: boolean;
  probe: boolean;
}

export interface FeedbackSample {
  step: number;
  aff: string;
  /** 对照组（不点）一秒内画面自己漂移的最大差：环境呼吸的底噪 */
  ambient: { g: number; l: number };
  /** 点击后第一张看得见变化（超过同一时刻底噪）的图的差；都没变为 null */
  first: { g: number; l: number } | null;
  /** 首个看得见变化的截图的完成时刻（相对点击）；都没变为 null */
  latencyMs: number | null;
  /** 点击后拍了几张 */
  shots: number;
}

export type PlayOptions = Thresholds['player'] & {
  /** 策略 seed：不给则无焦点时选 DOM 第一个 */
  seed?: number;
  /** 给了就在若干点击上做反馈探针 */
  differ?: Differ | null;
  feedback?: Thresholds['feedback'];
  shotsDir?: string | null;
  shotsPerAct?: number;
  log?: (s: string) => void;
};

export interface PlayResult {
  done: boolean;
  reason: PlayReason;
  elapsedMs: number;
  steps: Step[];
  feedback: FeedbackSample[];
  shots: string[];
  fallbackClicks: number;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function snapshot(page: Page): Promise<Snap> {
  return ev<Snap>(page, 'window.__bench.snapshot()');
}

async function safeSnapshot(page: Page): Promise<Snap | null> {
  for (let k = 0; k < 6; k++) {
    try {
      return await snapshot(page);
    } catch {
      await sleep(150);
    }
  }
  return null;
}

type Choice =
  | { kind: 'aff'; cand: Cand; prefer: string; drag: boolean }
  | { kind: 'input'; cx: number; cy: number; focused: boolean; typeName: boolean };

/** 焦点/脉动的那个最多先点 2 次；之后点得最少的优先（并列取 DOM 里靠前的），保证每个可做的事都被碰到 */
const PREFERRED_MAX = 2;

export function choose(snap: Snap, stuck: number, rng: (() => number) | null, counts: Map<string, number> = new Map()): Choice | null {
  const usable = snap.cands.filter((c) => c.hit);
  const cands = usable.length ? usable : snap.cands;
  const inp = snap.inputs[0];
  if (!cands.length) return inp ? { kind: 'input', ...inp, typeName: stuck > 0 } : null;
  if (inp?.focused && stuck < 3) return { kind: 'input', ...inp, typeName: stuck > 0 };

  const n = (c: Cand) => counts.get(c.id) ?? 0;
  let pick = cands[0]!;
  let prefer = 'first';
  const f = snap.focus;
  const byFocus = f ? cands.find((c) => c.id === f) ?? cands.find((c) => c.id.startsWith(f) || c.id.endsWith(f) || c.id.includes(f)) : undefined;
  const byPulse = cands.find((c) => c.pulse);
  if (byFocus && n(byFocus) < PREFERRED_MAX) {
    pick = byFocus;
    prefer = 'focus';
  } else if (byPulse && n(byPulse) < PREFERRED_MAX) {
    pick = byPulse;
    prefer = 'pulse';
  } else {
    const least = Math.min(...cands.map(n));
    const pool = cands.filter((c) => n(c) === least);
    if (rng && least === 0 && pool.length > 1) {
      pick = pool[Math.floor(rng() * pool.length)]!;
      prefer = 'seeded';
    } else {
      pick = pool[0]!;
      prefer = least > 0 || byFocus || byPulse ? 'least-clicked' : 'first';
    }
  }
  // 卡住：先原样再试一次（也许要点好几下），然后轮着换，再然后试试拖
  if (stuck >= 2) {
    pick = cands[(stuck - 2) % cands.length]!;
    prefer = 'rotate';
  }
  return { kind: 'aff', cand: pick, prefer, drag: stuck >= 5 && stuck % 2 === 1 };
}

async function moveTo(page: Page, x: number, y: number) {
  await page.mouse.move(x, y, { steps: 4 });
  await sleep(140);
}

async function clickAt(page: Page, x: number, y: number) {
  await moveTo(page, x, y);
  await page.mouse.down();
  await page.mouse.up();
}

async function dragFrom(page: Page, x: number, y: number) {
  await moveTo(page, x, y);
  await page.mouse.down();
  await page.mouse.move(x, Math.max(2, y - 140), { steps: 8 });
  await page.mouse.up();
}

async function jsClick(page: Page, id: string) {
  await ev(page, `(() => { const el = document.querySelector('[data-aff=' + JSON.stringify(${JSON.stringify(id)}) + ']'); if (el) el.click(); })()`);
}

function around(c: Cand): Rect {
  const pad = Math.max(140, 0.75 * Math.max(c.w, c.h));
  return { x: c.cx - c.w / 2 - pad, y: c.cy - c.h / 2 - pad, w: c.w + 2 * pad, h: c.h + 2 * pad };
}

/**
 * 量“点了之后多久有看得见的回应”。环境一直在呼吸，所以要有对照：
 * 先等画面平静；不点，连拍 1 秒，得到画面自己漂移的量；再点，连拍 1 秒；
 * 点后某一刻的差，要超过对照里同一时刻的漂移，才算回应。
 */
async function probeClick(page: Page, differ: Differ, c: Cand, th: Thresholds['feedback'], step: number): Promise<FeedbackSample> {
  const shot = () => page.screenshot({ type: 'jpeg', quality: 75 });
  const rect = around(c);
  const burst = async (ms: number) => {
    const imgs: Buffer[] = [];
    const times: number[] = [];
    const t = performance.now();
    do {
      imgs.push(await shot());
      times.push(performance.now() - t);
    } while (performance.now() - t < ms && imgs.length < 24);
    return { imgs, times, t };
  };

  await moveTo(page, c.cx, c.cy);
  await sleep(250); // 悬停的回应先过去
  const w0 = await ev<number>(page, 'performance.now()');
  // 等画面平静（最多约 1.2 秒）：刚进场的字还在一个个浮出来时，底噪不准
  for (let k = 0; k < 6; k++) {
    const p1 = await shot();
    await sleep(80);
    const p2 = await shot();
    const [d] = await differ.compare([p1, p2], [[0, 1]], rect, th.pixelDelta);
    if (d!.g <= th.globalFrac / 2 && d!.l <= th.localFrac / 2) break;
  }

  const r1 = await shot();
  const ctrl = await burst(1000);
  const r2 = await shot();
  const t = performance.now();
  await page.mouse.down();
  await page.mouse.up();
  const clk = { imgs: [] as Buffer[], times: [] as number[] };
  do {
    clk.imgs.push(await shot());
    clk.times.push(performance.now() - t);
  } while (performance.now() - t < 1000 && clk.imgs.length < 24);
  const w1 = await ev<number>(page, 'performance.now()');
  await ev(page, `window.__bench.mark(${w0 - 100}, ${w1 + 100})`);

  const nc = ctrl.imgs.length;
  const pairs: [number, number][] = [
    ...ctrl.imgs.map((_, i) => [0, 1 + i] as [number, number]),
    ...clk.imgs.map((_, j) => [1 + nc, 2 + nc + j] as [number, number]),
  ];
  const ds = await differ.compare([r1, ...ctrl.imgs, r2, ...clk.imgs], pairs, rect, th.pixelDelta);
  const dc = ds.slice(0, nc);
  const dk = ds.slice(nc);
  const ambient = { g: Math.max(0, ...dc.map((d) => d.g)), l: Math.max(0, ...dc.map((d) => d.l)) };
  const ambAt = (ms: number) => {
    const ok = dc.filter((_, i) => ctrl.times[i]! <= ms + 80);
    return { g: Math.max(0, ...ok.map((d) => d.g)), l: Math.max(0, ...ok.map((d) => d.l)) };
  };
  const k = dk.findIndex((d, j) => {
    const a = ambAt(clk.times[j]!);
    return d.g > Math.max(th.globalFrac, a.g * th.baselineMul) || d.l > Math.max(th.localFrac, a.l * th.baselineMul);
  });
  return {
    step,
    aff: c.id,
    ambient,
    first: k >= 0 ? dk[k]! : null,
    latencyMs: k >= 0 ? Math.round(clk.times[k]!) : null,
    shots: clk.imgs.length,
  };
}

export async function play(page: Page, o: PlayOptions): Promise<PlayResult> {
  const log = o.log ?? (() => {});
  const t0 = Date.now();
  const steps: Step[] = [];
  const feedback: FeedbackSample[] = [];
  const shots: string[] = [];
  const rng = o.seed ? mulberry32(o.seed) : null;
  const perAct = new Map<string, number>();
  let shotNo = 0;
  let fallbackClicks = 0;

  let stuck = 0;
  let lastActionAt = 0;
  let sig = '';
  let sigSince = Date.now();
  let emptySince: number | null = null;
  let seenActs = -1;
  let shotDue = 0;
  let pending: { step: Step; progress: number; acts: number; sig: string } | null = null;
  let reason: PlayReason = 'max-seconds';
  let probes = 0;
  /** 当前这一幕里每个可做的事点过几次（换幕清零） */
  let counts = new Map<string, number>();
  let countsAct = -1;

  const takeShot = async (snap: Snap, label: string) => {
    if (!o.shotsDir) return;
    const act = snap.act ?? 'boot';
    const n = perAct.get(act) ?? 0;
    if (n >= (o.shotsPerAct ?? 5)) return;
    perAct.set(act, n + 1);
    const file = `${String(++shotNo).padStart(2, '0')}-${act}-${label}.png`;
    try {
      fs.mkdirSync(o.shotsDir, { recursive: true });
      await page.screenshot({ path: path.join(o.shotsDir, file), type: 'png' });
      shots.push(file);
    } catch (err) {
      log(`shot failed: ${(err as Error).message}`);
    }
  };

  let snap = await safeSnapshot(page);
  while (true) {
    if (!snap) {
      reason = 'crashed';
      break;
    }
    const elapsed = Date.now() - t0;
    if (snap.done) {
      reason = 'done';
      break;
    }
    if (elapsed > o.maxSeconds * 1000) {
      reason = 'max-seconds';
      break;
    }
    if (steps.length >= o.maxSteps) {
      reason = 'max-steps';
      break;
    }

    // 刚进了新的一幕：先看一会儿，等画面立住拍一张，再动手
    if (snap.acts !== seenActs) {
      seenActs = snap.acts;
      shotDue = o.shotsDir && snap.acts > 0 ? Date.now() + 1300 : 0;
    }
    if (shotDue) {
      if (Date.now() >= shotDue) {
        shotDue = 0;
        await takeShot(snap, 'enter');
      } else {
        await sleep(80);
      }
      snap = await safeSnapshot(page);
      continue;
    }

    const hasWork = snap.cands.length > 0 || snap.inputs.length > 0;
    const curSig = snap.cands.map((c) => c.id).join('|') + `#${snap.acts}`;
    if (curSig !== sig) {
      sig = curSig;
      sigSince = Date.now();
    }
    if (!hasWork) {
      emptySince ??= Date.now();
      if (Date.now() - emptySince > o.emptyAffSeconds * 1000) {
        reason = 'no-affordance';
        break;
      }
      await sleep(100);
      snap = await safeSnapshot(page);
      continue;
    }
    emptySince = null;
    if (Date.now() - sigSince < o.settleMs || Date.now() - lastActionAt < o.minGapMs) {
      await sleep(80);
      snap = await safeSnapshot(page);
      continue;
    }

    // 上一步有没有带来变化
    if (pending) {
      const moved = snap.progress !== pending.progress || snap.acts !== pending.acts || curSig !== pending.sig;
      pending.step.progressed = moved;
      stuck = moved ? 0 : stuck + 1;
      pending = null;
      if (stuck >= 10) {
        reason = 'stuck';
        break;
      }
    }

    if (snap.acts !== countsAct) {
      countsAct = snap.acts;
      counts = new Map();
    }
    const choice = choose(snap, stuck, rng, counts);
    if (!choice) {
      await sleep(100);
      snap = await safeSnapshot(page);
      continue;
    }

    const step: Step = {
      i: steps.length,
      pageT: snap.now,
      act: snap.act,
      aff: choice.kind === 'aff' ? choice.cand.id : null,
      how: choice.kind === 'input' ? 'enter' : choice.drag ? 'drag' : 'click',
      prefer: choice.kind === 'aff' ? choice.prefer : 'input',
      progressed: false,
      probe: false,
    };

    try {
      if (choice.kind === 'input') {
        await page.mouse.click(choice.cx, choice.cy);
        if (choice.typeName) await page.keyboard.type('客');
        await page.keyboard.press('Enter');
      } else {
        const c = choice.cand;
        const doProbe = !!o.differ && !!o.feedback && probes < o.feedback.maxProbes && (steps.length < 3 || steps.length % 4 === 0) && stuck === 0 && c.hit && !choice.drag;
        if (!c.hit) {
          step.how = 'js-click';
          fallbackClicks++;
          await jsClick(page, c.id);
        } else if (choice.drag) {
          await dragFrom(page, c.cx, c.cy);
        } else if (doProbe) {
          probes++;
          step.probe = true;
          const fb = await probeClick(page, o.differ!, c, o.feedback!, step.i);
          feedback.push(fb);
        } else {
          await clickAt(page, c.cx, c.cy);
        }
      }
    } catch (err) {
      log(`action failed: ${(err as Error).message}`);
      if (page.isClosed()) {
        reason = 'crashed';
        break;
      }
    }
    if (step.aff) counts.set(step.aff, (counts.get(step.aff) ?? 0) + 1);
    lastActionAt = Date.now();
    steps.push(step);
    pending = { step, progress: snap.progress, acts: snap.acts, sig: curSig };
    log(`step ${step.i} act=${step.act} aff=${step.aff} (${step.prefer}${step.probe ? ', probe' : ''})`);

    // 动作之后让画面落定再拍一张（每幕有上限）
    if (o.shotsDir) {
      await sleep(900);
      const s2 = await safeSnapshot(page);
      // 这一下若把幕换了，新一幕的 enter 镜头会拍它，这里不重复
      if (s2 && s2.acts === snap.acts) await takeShot(s2, `s${step.i}`);
    }
    snap = await safeSnapshot(page);
  }

  if (reason === 'done' && snap) await takeShot({ ...snap, act: 'final' }, 'done');
  const last = snap ?? null;
  if (pending && last) pending.step.progressed = last.progress !== pending.progress || last.acts !== pending.acts || last.done;
  return { done: reason === 'done', reason, elapsedMs: Date.now() - t0, steps, feedback, shots, fallbackClicks };
}
