// 程序化声音：Web Audio 合成，不用任何音频文件。接口见 audio-api.ts。
// 母题：战国漆器世界——编钟（非谐泛音）、埙（带气声的陶笛）、木与帛的声音。
// 母线：各路声音 → 轻压缩 → 干/湿（小厅混响）→ 软限幅 → 总音量（默认约 -14 dB）→ 静音 → 输出。
// 第一次手势（unlock）之前，所有调用都是静默空操作；ambience/music 只记下想要的状态，解锁后接上。

import type { Bus } from './bus';
import type { AmbienceName, Audio, Mode, SfxName } from './audio-api';

type Pt = [number, number];

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const expo = (mean: number) => -Math.log(1 - Math.random()) * mean;

// ------------------------------------------------------------------ 乐律

const GONG = 220; // 宫 ≈ A3，落在低中音区
const RATIO = [1, 9 / 8, 81 / 64, 3 / 2, 27 / 16] as const; // 宫商角徵羽（五度相生）
const MODE_AT: Record<Mode, number> = { gong: 0, shang: 1, jue: 2, zhi: 3, yu: 4 };
export const MODES: readonly Mode[] = ['gong', 'shang', 'jue', 'zhi', 'yu'];

/** 五声音阶第 i 级的频率：0 = 宫，5 = 高八度的宫，-1 = 低八度的羽；i 可为任意整数 */
export function degreeHz(i: number, base = GONG): number {
  const n = Math.round(i);
  return base * RATIO[((n % 5) + 5) % 5] * 2 ** Math.floor(n / 5);
}
const hz = degreeHz;

// ------------------------------------------------------------------ 共用缓冲（每个 context 一份，全程复用）

interface Bufs {
  white: AudioBuffer;
  pink: AudioBuffer;
  verb: AudioBuffer;
}
const cache = new WeakMap<BaseAudioContext, Bufs>();

function setRms(d: Float32Array, rms: number) {
  let s = 0;
  for (let i = 0; i < d.length; i++) s += d[i] * d[i];
  const k = rms / Math.sqrt(s / d.length || 1);
  for (let i = 0; i < d.length; i++) d[i] *= k;
}

function rng32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bufs(ac: BaseAudioContext): Bufs {
  const hit = cache.get(ac);
  if (hit) return hit;
  const sr = Math.floor(ac.sampleRate);

  const white = ac.createBuffer(1, sr * 2, sr);
  const w = white.getChannelData(0);
  for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;
  setRms(w, 0.3);

  // 粉红噪声（Paul Kellet 的近似），5 秒，循环处听不出接缝
  const pink = ac.createBuffer(1, sr * 5, sr);
  const p = pink.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < p.length; i++) {
    const x = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + x * 0.0555179;
    b1 = 0.99332 * b1 + x * 0.0750759;
    b2 = 0.969 * b2 + x * 0.153852;
    b3 = 0.8665 * b3 + x * 0.3104856;
    b4 = 0.55 * b4 + x * 0.5329522;
    b5 = -0.7616 * b5 - x * 0.016898;
    p[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362;
    b6 = x * 0.115926;
  }
  // 去掉近直流的缓慢漂移（Kellet 滤波器带来的次低频），省得白占动态余量、推着压缩器乱跳
  let lo = 0;
  const ka = 1 - Math.exp((-2 * Math.PI * 25) / sr);
  for (let i = 0; i < p.length; i++) {
    lo += ka * (p[i] - lo);
    p[i] -= lo;
  }
  setRms(p, 0.25);

  // 小厅的脉冲响应：约 2.2 秒，衰减的噪声，越往后越暗，开头有几个早期反射
  const len = Math.floor(sr * 2.2);
  const verb = ac.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const rand = rng32(1234 + ch * 77);
    const d = verb.getChannelData(ch);
    const pre = Math.floor(sr * 0.012);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      const env = Math.exp(-t / 0.33) * (1 - Math.exp(-t / 0.02));
      lp += lerp(0.75, 0.1, Math.min(1, t / 1.6)) * (rand() * 2 - 1 - lp);
      d[i] = lp * env;
    }
    for (let k = 0; k < 8; k++) {
      const at = pre + Math.floor(sr * (0.011 + k * 0.0061 + rand() * 0.004));
      d[at] += (rand() < 0.5 ? -1 : 1) * (0.7 - k * 0.07);
    }
  }
  const out = { white, pink, verb };
  cache.set(ac, out);
  return out;
}

const gateCurves = new Map<string, Float32Array<ArrayBuffer>>();
/** 把正弦 LFO 削成 0..1 的开关：thr 越高，开的时间越短；soft 是边沿的软度 */
function gateCurve(thr: number, soft: number): Float32Array<ArrayBuffer> {
  const key = `${thr}|${soft}`;
  let c = gateCurves.get(key);
  if (!c) {
    c = new Float32Array(257);
    for (let i = 0; i < 257; i++) c[i] = clamp(((i / 128 - 1 - thr) / soft) * 0.5 + 0.5, 0, 1);
    gateCurves.set(key, c);
  }
  return c;
}

function softCurve(): Float32Array<ArrayBuffer> {
  const n = 2049;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2; // 入口先减半，所以曲线横轴是 ±2
    c[i] = x / (1 + Math.abs(x) ** 4) ** 0.25;
  }
  return c;
}

// ------------------------------------------------------------------ 一次发声的零件盒（Rig）
// 一个 Rig = 一次音效/一个音符/一层环境声用到的全部节点；用完统一断开。
// 所有「名义」参数（频率、秒）都会按 rate 缩放：rate 2 = 高八度、快一倍。

const BELL: readonly [number, number, number][] = [
  // [频率比, 振幅, 衰减时间常数]：基音慢、高泛音快；比值取自铜钟的非谐泛音
  [0.5, 0.16, 1.6],
  [1, 1, 1.25],
  [2.76, 0.5, 0.75],
  [5.4, 0.22, 0.3],
  [8.9, 0.09, 0.12],
];

class Rig {
  readonly nodes: AudioNode[] = [];
  readonly srcs: AudioScheduledSourceNode[] = [];
  readonly timers: ReturnType<typeof setInterval>[] = [];
  end: number;

  constructor(
    readonly ac: BaseAudioContext,
    readonly out: AudioNode,
    readonly t = ac.currentTime,
    readonly rate = 1,
    readonly idx = 0,
  ) {
    this.end = t;
  }

  get offline() {
    return typeof OfflineAudioContext !== 'undefined' && this.ac instanceof OfflineAudioContext;
  }

  add<N extends AudioNode>(n: N, to?: AudioNode): N {
    this.nodes.push(n);
    if (to) n.connect(to);
    return n;
  }
  gain(v = 1, to?: AudioNode) {
    const n = this.add(this.ac.createGain(), to);
    n.gain.value = v;
    return n;
  }
  filt(type: BiquadFilterType, f: number, q = 1, to?: AudioNode) {
    const n = this.add(this.ac.createBiquadFilter(), to);
    n.type = type;
    n.frequency.value = f;
    n.Q.value = q;
    return n;
  }
  osc(type: OscillatorType, f: number, t0: number, t1?: number) {
    const o = this.ac.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.start(t0);
    if (t1 !== undefined) {
      o.stop(t1);
      this.end = Math.max(this.end, t1);
    }
    this.srcs.push(o);
    this.nodes.push(o);
    return o;
  }
  noise(kind: 'white' | 'pink', t0: number, t1?: number) {
    const s = this.ac.createBufferSource();
    const b = bufs(this.ac)[kind];
    s.buffer = b;
    s.loop = true;
    s.start(t0, Math.random() * b.duration);
    if (t1 !== undefined) {
      s.stop(t1);
      this.end = Math.max(this.end, t1);
    }
    this.srcs.push(s);
    this.nodes.push(s);
    return s;
  }
  every(ms: number, fn: () => void) {
    this.timers.push(setInterval(fn, ms));
  }
  /** 起始相位随机的正弦振子（各层 LFO 不要同时从零相位起步） */
  phased(f: number) {
    const o = this.osc('sine', f, this.t);
    const ph = rnd(0, Math.PI * 2);
    o.setPeriodicWave(this.ac.createPeriodicWave(new Float32Array([0, Math.sin(ph)]), new Float32Array([0, Math.cos(ph)])));
    return o;
  }
  /** 慢速调制：LFO → depth → 目标参数 */
  lfo(f: number, depth: number, to: AudioParam) {
    const o = this.phased(f);
    const g = this.gain(depth);
    o.connect(g);
    g.connect(to);
    return o;
  }
  /** 把 LFO 削成开关去调目标参数（蟋蟀的脉冲、蝉的震颤） */
  gate(f: number, thr: number, soft: number, to: AudioParam, amp = 1) {
    const o = this.phased(f);
    const ws = this.add(this.ac.createWaveShaper());
    ws.curve = gateCurve(thr, soft);
    const g = this.gain(amp);
    o.connect(ws);
    ws.connect(g);
    g.connect(to);
  }

  /** 一声单音：振子 + 指数衰减。可带音高滑动 */
  tone(o: { f: number; to?: number; sweep?: number; type?: OscillatorType; at?: number; atk?: number; tau?: number; len?: number; gain?: number; dest?: AudioNode }) {
    const k = this.rate;
    const t = this.t + (o.at ?? 0) / k;
    const atk = (o.atk ?? 0.004) / k;
    const tau = Math.max(0.001, (o.tau ?? 0.1) / k);
    const stop = t + atk + (o.len !== undefined ? o.len / k : tau * 7);
    const f = o.f * k;
    const osc = this.osc(o.type ?? 'sine', f, t, stop);
    if (o.to !== undefined) {
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(o.to * k, t + (o.sweep ?? 0.1) / k);
    }
    const g = this.gain(0, o.dest ?? this.out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.gain ?? 1, t + atk);
    g.gain.setTargetAtTime(0, t + atk, tau);
    osc.connect(g);
    return g;
  }

  /** 一段噪声：可过滤、可扫频；包络要么 atk+tau 的冲击，要么 env 折线 */
  nz(o: { kind?: 'white' | 'pink'; at?: number; len: number; filt?: BiquadFilterType; f?: number; to?: number; sweep?: number; q?: number; hp?: number; gain?: number; atk?: number; tau?: number; env?: Pt[]; dest?: AudioNode }) {
    const k = this.rate;
    const t = this.t + (o.at ?? 0) / k;
    let n: AudioNode = this.noise(o.kind ?? 'white', t, t + o.len / k);
    if (o.hp) n = n.connect(this.filt('highpass', o.hp * k, 0.7));
    if (o.filt) {
      const f = this.filt(o.filt, (o.f ?? 1000) * k, o.q ?? 1);
      if (o.to !== undefined) {
        f.frequency.setValueAtTime((o.f ?? 1000) * k, t);
        f.frequency.exponentialRampToValueAtTime(o.to * k, t + (o.sweep ?? o.len) / k);
      }
      n = n.connect(f);
    }
    const g = this.gain(0, o.dest ?? this.out);
    const peak = o.gain ?? 1;
    if (o.env) {
      g.gain.setValueAtTime(o.env[0][1] * peak, t + o.env[0][0] / k);
      for (let i = 1; i < o.env.length; i++) g.gain.linearRampToValueAtTime(o.env[i][1] * peak, t + o.env[i][0] / k);
    } else {
      const atk = (o.atk ?? 0.002) / k;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + atk);
      g.gain.setTargetAtTime(0, t + atk, Math.max(0.001, (o.tau ?? o.len / 4) / k));
    }
    n.connect(g);
    return g;
  }

  /** 编钟一击：基音与二分音各有两个略失谐的振子互相拍击，高泛音很快散掉，加一下击打的「嚓」 */
  bell(dt: number, f: number, o: { gain?: number; len?: number; bright?: number } = {}) {
    const k = this.rate;
    const t = this.t + dt / k;
    const F = f * k;
    const len = (o.len ?? 1) / k;
    const br = o.bright ?? 1;
    const body = this.gain((o.gain ?? 1) * 0.4, this.out);
    for (const [ratio, amp, tau0] of BELL) {
      const fp = F * ratio;
      if (fp > 11000) continue;
      const tau = tau0 * len;
      const pair = ratio === 1 || ratio === 2.76;
      for (let j = 0; j < (pair ? 2 : 1); j++) {
        const det = pair ? (j ? 1 : -1) * rnd(0.5, 1.5) * (ratio === 1 ? 1 : 2) : 0;
        const o2 = this.osc('sine', fp + det, t, t + 0.003 + tau * 5.5);
        const e = this.gain(0, body);
        const a = (amp * (ratio > 2 ? br : 1)) / (pair ? 2 : 1);
        e.gain.setValueAtTime(0, t);
        e.gain.linearRampToValueAtTime(a, t + 0.003);
        e.gain.setTargetAtTime(0, t + 0.003, tau);
        o2.connect(e);
      }
    }
    const s = this.noise('white', t, t + 0.06);
    const bp = this.filt('bandpass', Math.min(F * 4, 6000), 1.2);
    const sg = this.gain(0, body);
    sg.gain.setValueAtTime(0, t);
    sg.gain.linearRampToValueAtTime(0.16 * br, t + 0.001);
    sg.gain.setTargetAtTime(0, t + 0.001, 0.009);
    s.connect(bp);
    bp.connect(sg);
  }

  /** 埙：正弦 + 软三角 + 一点二次谐波，起音带气声，慢颤音，音高从略低处吹上来 */
  xun(dt: number, f: number, dur: number, gain = 1) {
    const t = this.t + dt;
    const stop = t + dur + 2.6;
    const amp = this.gain(0, this.out);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(gain * 0.5, t + 0.16);
    amp.gain.linearRampToValueAtTime(gain * 0.42, t + dur);
    amp.gain.setTargetAtTime(0, t + dur, 0.32);
    const vib = this.osc('sine', rnd(4.4, 5.3), t, stop);
    const vd = this.gain(0);
    vd.gain.setValueAtTime(0, t);
    vd.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(dur, 1.3));
    vib.connect(vd);
    const parts: [OscillatorType, number, number][] = [['sine', 1, 1], ['triangle', 1, 0.26], ['sine', 2, 0.06]];
    for (const [type, mul, g] of parts) {
      const o = this.osc(type, f * mul, t, stop);
      o.frequency.setValueAtTime(f * mul * 0.965, t);
      o.frequency.exponentialRampToValueAtTime(f * mul, t + 0.12);
      vd.connect(o.frequency);
      const vg = this.gain(g);
      if (type === 'triangle') {
        o.connect(this.filt('lowpass', 1600, 0.5, vg));
      } else {
        o.connect(vg);
      }
      vg.connect(amp);
    }
    // 气声：窄带噪声，起音处最重，之后只留一缕
    const s = this.noise('white', t, stop);
    const bp = this.filt('bandpass', Math.min(f * 2.4, 3500), 1.6);
    const bg = this.gain(0, this.out);
    bg.gain.setValueAtTime(0, t);
    bg.gain.linearRampToValueAtTime(gain * 0.55, t + 0.06);
    bg.gain.setTargetAtTime(gain * 0.16, t + 0.06, 0.2);
    bg.gain.setTargetAtTime(0, t + dur, 0.25);
    s.connect(bp);
    bp.connect(bg);
  }

  /** 颗粒：许多极短的五声高音，像金点散开/聚拢 */
  grains(o: { n: number; span: number; shape?: 'fall' | 'rise' | 'swell'; lo: number; hi: number; gain?: number; at?: number }) {
    const k = this.rate;
    for (let i = 0; i < o.n; i++) {
      const u = (i + Math.random()) / o.n;
      const shape = o.shape ?? 'fall';
      const x = shape === 'rise' ? 1 - (1 - u) ** 1.8 : shape === 'swell' ? u : u ** 1.8;
      const a = shape === 'rise' ? u ** 1.1 : shape === 'swell' ? Math.sin(Math.PI * u) : (1 - u) ** 1.2;
      const t = this.t + ((o.at ?? 0) + x * o.span) / k;
      const d = rnd(0.07, 0.22) / k;
      const f = hz(Math.round(rnd(o.lo, o.hi))) * k;
      const peak = (o.gain ?? 1) * a * rnd(0.5, 1) * 0.35;
      const g = this.gain(0);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.004);
      g.gain.setTargetAtTime(0, t + 0.004, d / 2.2);
      const p = this.add(this.ac.createStereoPanner());
      p.pan.value = rnd(-0.7, 0.7);
      this.osc(Math.random() < 0.3 ? 'triangle' : 'sine', f, t, t + d * 7).connect(g);
      if (Math.random() < 0.6) {
        const h = this.gain(0.28, g);
        this.osc('sine', f * 2.76, t, t + d * 3).connect(h);
        h.gain.setValueAtTime(0.28, t);
        h.gain.setTargetAtTime(0, t + 0.004, d / 6);
      }
      g.connect(p);
      p.connect(this.out);
    }
  }

  dispose() {
    for (const id of this.timers) clearInterval(id);
    this.timers.length = 0;
    for (const s of this.srcs) {
      try {
        s.stop();
      } catch {
        /* 已经停了 */
      }
    }
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {
        /* 已经断了 */
      }
    }
  }
}

function click(r: Rig, at: number, f: number, g: number) {
  r.nz({ at, len: 0.03, filt: 'bandpass', f, q: 1.4, gain: g, tau: 0.004 });
}

/** 门闩：一"嗒"一"咔" */
function latch(r: Rig, at = 0, g = 1) {
  click(r, at, 2300, 0.55 * g);
  click(r, at + 0.065, 1500, 0.45 * g);
  r.tone({ f: 640, at, tau: 0.02, gain: 0.2 * g });
  r.tone({ f: 470, at: at + 0.065, tau: 0.025, gain: 0.18 * g });
}

/** 木头的吱呀：锯齿波过共振带通，音高与音量一顿一顿地「滑动—卡住」 */
function creak(r: Rig, o: { f0: number; span: number; lo: number; hi: number; gain: number; at?: number }) {
  const k = r.rate;
  const t = r.t + (o.at ?? 0) / k;
  const d = o.span / k;
  const steps = Math.max(8, Math.round(d * 16));
  const saw = r.osc('sawtooth', o.f0 * k, t, t + d + 0.05);
  const bp1 = r.filt('bandpass', o.lo * k, 7);
  const bp2 = r.filt('bandpass', o.hi * 1.9 * k, 5);
  const g = r.gain(0, r.out);
  const g2 = r.gain(0.5, g);
  saw.connect(bp1);
  saw.connect(bp2);
  bp1.connect(g);
  bp2.connect(g2);
  saw.frequency.setValueAtTime(o.f0 * k, t);
  bp1.frequency.setValueAtTime(o.lo * k, t);
  g.gain.setValueAtTime(0, t);
  let w = 0;
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    const at = t + d * u;
    w = w * 0.85 + rnd(-0.05, 0.05);
    saw.frequency.linearRampToValueAtTime(o.f0 * k * (1 + 0.22 * Math.sin(Math.PI * u) + w), at);
    bp1.frequency.linearRampToValueAtTime(lerp(o.lo, o.hi, smooth(0, 0.6, u) * (1 - 0.35 * smooth(0.6, 1, u))) * k, at);
    g.gain.linearRampToValueAtTime(i === steps ? 0 : o.gain * Math.sin(Math.PI * u) ** 0.6 * rnd(0.3, 1), at);
  }
  r.nz({ kind: 'pink', at: o.at, len: o.span, filt: 'bandpass', f: o.lo * 1.3, q: 3, gain: o.gain * 0.5, env: [[0, 0], [o.span * 0.2, 1], [o.span * 0.8, 0.7], [o.span, 0]] });
}

/** 低声的人群：几条共振峰带的噪声，各按自己的音节速度起伏 */
function murmur(r: Rig, t0: number, t1: number | undefined, to: AudioNode, lvl: number) {
  const bands: [number, number, number, number][] = [[380, 2.2, 1, 3.1], [820, 2.6, 0.8, 4.4], [1650, 3, 0.45, 5.3], [2600, 3, 0.2, 6.1]];
  for (const [f, q, a, am] of bands) {
    const s = r.noise('pink', t0, t1);
    const bp = r.filt('bandpass', f, q);
    const g = r.gain(0.55 * a * lvl);
    const l1 = r.osc('sine', am * rnd(0.8, 1.25), t0, t1);
    const d1 = r.gain(0.3 * a * lvl);
    l1.connect(d1);
    d1.connect(g.gain);
    const l2 = r.osc('sine', rnd(0.2, 0.5), t0, t1);
    const d2 = r.gain(0.2 * a * lvl);
    l2.connect(d2);
    d2.connect(g.gain);
    s.connect(bp);
    bp.connect(g);
    g.connect(to);
  }
}

/** 在一条常驻的链上撒随机小事件（火星、鸟、落叶）：只改参数，不新增节点 */
function sprinkle(r: Rig, mean: number, fn: (t: number) => void) {
  let next = r.t + expo(mean);
  const run = (horizon: number) => {
    const now = r.ac.currentTime;
    if (next < now) next = now;
    while (next < now + horizon) {
      fn(next);
      next += Math.max(0.03, expo(mean));
    }
  };
  if (r.offline) {
    run(10);
    return;
  }
  r.every(200, () => run(0.45));
}

/** 常驻的一点噪声小通道：给 sprinkle 用 */
function burstChannel(r: Rig, o: { kind?: 'white' | 'pink'; hp?: number; f: number; q: number; to?: AudioNode }) {
  let n: AudioNode = r.noise(o.kind ?? 'white', r.t);
  if (o.hp) n = n.connect(r.filt('highpass', o.hp, 0.7));
  n = n.connect(r.filt('bandpass', o.f, o.q));
  const g = r.gain(0, o.to ?? r.out);
  n.connect(g);
  return g.gain;
}

// ------------------------------------------------------------------ 音效

interface SfxDef {
  fn: (r: Rig) => void;
  /** 本条音效整体音量微调 */
  level?: number;
  /** 送进混响的量 */
  send?: number;
  /** 同名音效最短间隔（秒），防止连点刷屏 */
  gap?: number;
}

const SFX: Record<SfxName, SfxDef> = {
  // —— 门与木 ——
  'door-creak': {
    send: 0.3,
    level: 2.2,
    fn: (r) => creak(r, { f0: 138, span: 1.5, lo: 340, hi: 880, gain: 0.55 }),
  },
  'door-close': {
    send: 0.4,
    fn: (r) => {
      r.tone({ f: 118, to: 54, sweep: 0.14, tau: 0.13, gain: 0.9 });
      r.nz({ kind: 'pink', len: 0.22, filt: 'lowpass', f: 420, q: 0.7, gain: 0.8, tau: 0.035 });
      r.nz({ len: 0.05, filt: 'bandpass', f: 1100, q: 0.9, gain: 0.35, tau: 0.008 });
      latch(r, 0.17, 0.8);
    },
  },
  latch: { send: 0.15, level: 1.3, fn: (r) => latch(r) },
  'gate-open': {
    send: 0.5,
    fn: (r) => {
      r.tone({ f: 70, to: 48, sweep: 0.2, tau: 0.2, gain: 0.7 });
      r.nz({ len: 0.05, filt: 'bandpass', f: 500, q: 0.8, gain: 0.5, tau: 0.01 });
      creak(r, { f0: 62, span: 3.2, lo: 150, hi: 460, gain: 0.85, at: 0.15 });
      r.nz({ kind: 'pink', len: 3.4, filt: 'lowpass', f: 150, gain: 0.7, env: [[0, 0], [0.8, 1], [2.6, 0.8], [3.4, 0]] });
    },
  },
  'gate-shut': {
    send: 0.8,
    fn: (r) => {
      r.tone({ f: 92, to: 38, sweep: 0.35, tau: 0.35, gain: 1 });
      r.nz({ kind: 'pink', len: 0.5, filt: 'lowpass', f: 600, to: 200, sweep: 0.3, gain: 0.9, tau: 0.1 });
      r.nz({ len: 0.06, filt: 'bandpass', f: 700, q: 0.8, gain: 0.9, tau: 0.01 });
      // 门闩落下
      r.tone({ f: 310, at: 0.28, tau: 0.05, gain: 0.3 });
      r.tone({ f: 195, at: 0.36, tau: 0.06, gain: 0.3 });
      click(r, 0.28, 1400, 0.7);
      click(r, 0.36, 900, 0.6);
    },
  },
  knock: {
    send: 0.8,
    fn: (r) => {
      // 叩门：沉的木响。第 1、2、3 下略往下沉
      const f = 128 * 0.94 ** (r.idx % 3);
      r.tone({ f, to: f * 0.66, sweep: 0.12, tau: 0.2, gain: 1 });
      r.tone({ f: f * 1.8, to: f * 1.15, sweep: 0.08, tau: 0.1, gain: 0.4 });
      r.tone({ f: 236, tau: 0.07, gain: 0.34 });
      r.tone({ f: 352, tau: 0.05, gain: 0.22 });
      r.tone({ f: 486, tau: 0.035, gain: 0.1 });
      r.nz({ len: 0.05, filt: 'bandpass', f: 800, q: 0.8, hp: 300, gain: 1, tau: 0.007 });
      r.nz({ kind: 'pink', len: 0.3, filt: 'lowpass', f: 300, gain: 0.6, tau: 0.05 });
    },
  },
  refuse: {
    send: 0.3,
    fn: (r) => {
      // 低低的一声木「tok」，后面跟着更轻的回声
      for (const [at, g] of [[0, 1], [0.13, 0.28]] as Pt[]) {
        r.tone({ f: 190 * (1 - at * 0.3), to: 125, sweep: 0.05, at, tau: 0.07, gain: 0.8 * g });
        r.tone({ f: 350, to: 240, sweep: 0.04, at, tau: 0.045, gain: 0.3 * g });
        r.nz({ at, len: 0.03, filt: 'bandpass', f: 900, q: 1, gain: 0.5 * g, tau: 0.006 });
      }
    },
  },

  // —— 灯与钟 ——
  lamp: {
    send: 0.55,
    fn: (r) => {
      // 一盏灯亮：按 index 升调；灯焰「噗」地一小声
      const i = r.idx;
      r.bell(0, hz(i), { gain: 0.85 + 0.05 * clamp(i, 0, 5), len: 1.1 });
      r.nz({ kind: 'pink', len: 0.18, filt: 'bandpass', f: 1000, q: 1, gain: 0.1, env: [[0, 0], [0.05, 1], [0.18, 0]] });
    },
  },
  error: {
    send: 0.5,
    fn: (r) => {
      // 一对不协和的钟（小二度），轻轻的
      r.bell(0, 247, { gain: 0.55, len: 0.7 });
      r.bell(0.05, 247 * (16 / 15), { gain: 0.5, len: 0.7 });
    },
  },
  insight: {
    send: 0.6,
    fn: (r) => {
      // 两声协和的钟：宫与徵（五度），带一点金屑
      r.bell(0, hz(5), { gain: 0.7 });
      r.bell(0.09, hz(8), { gain: 0.6 });
      r.grains({ n: 7, span: 0.7, shape: 'fall', lo: 10, hi: 14, gain: 0.45, at: 0.1 });
    },
  },
  weight: {
    send: 0.3,
    fn: (r) => {
      // 小铜砝码的一声轻响：index 区分情/利/名
      r.bell(0, hz(10 + r.idx), { gain: 0.55, len: 0.35, bright: 1.3 });
      click(r, 0, 5500, 0.2);
    },
  },
  season: {
    send: 0.6,
    fn: (r) => {
      r.bell(0, hz(2 + r.idx), { gain: 0.7, len: 1.3 });
      r.nz({ kind: 'pink', len: 2.6, filt: 'bandpass', f: 350, to: 1000, sweep: 2.2, q: 1.1, gain: 0.55, env: [[0, 0], [0.9, 1], [1.7, 0.7], [2.6, 0]] });
      r.grains({ n: 5, span: 1.6, shape: 'swell', lo: 10, hi: 13, gain: 0.3, at: 0.3 });
    },
  },

  // —— 纸、帛、印 ——
  brush: {
    send: 0.15,
    level: 1.4,
    fn: (r) => r.nz({ kind: 'pink', len: 0.4, filt: 'bandpass', f: 1800, to: 4200, sweep: 0.35, q: 0.9, hp: 900, gain: 0.6, env: [[0, 0], [0.07, 1], [0.2, 0.7], [0.4, 0]] }),
  },
  slide: {
    send: 0.2,
    level: 1.5,
    fn: (r) => {
      const env: Pt[] = [[0, 0], [0.18, 1], [0.4, 0.75], [0.6, 0]];
      r.nz({ kind: 'pink', len: 0.6, filt: 'bandpass', f: 1300, to: 2800, sweep: 0.55, q: 0.8, hp: 600, gain: 0.45, env });
      r.nz({ len: 0.6, hp: 5000, gain: 0.09, env });
    },
  },
  pickup: {
    send: 0.2,
    level: 1.6,
    fn: (r) => {
      r.nz({ len: 0.12, hp: 2800, gain: 0.5, env: [[0, 0], [0.01, 1], [0.04, 0.3], [0.07, 0.65], [0.12, 0]] });
      r.nz({ kind: 'pink', at: 0.02, len: 0.2, filt: 'bandpass', f: 1500, to: 3000, sweep: 0.18, q: 0.9, gain: 0.3, env: [[0, 0], [0.06, 1], [0.2, 0]] });
      r.tone({ f: 520, to: 760, sweep: 0.1, tau: 0.05, gain: 0.08 });
    },
  },
  seal: {
    send: 0.45,
    fn: (r) => {
      // 盖印：闷闷的一压，纸张被按实
      r.tone({ f: 150, to: 68, sweep: 0.1, tau: 0.09, gain: 0.85 });
      r.nz({ kind: 'pink', len: 0.1, filt: 'lowpass', f: 320, gain: 0.7, tau: 0.02 });
      r.nz({ at: 0.02, len: 0.06, hp: 2500, gain: 0.3, tau: 0.015 });
      r.tone({ f: 220, tau: 0.15, gain: 0.16, at: 0.01 });
    },
  },

  // —— 金点 ——
  dissolve: {
    send: 0.6,
    fn: (r) => {
      r.grains({ n: 26, span: 1.9, shape: 'fall', lo: 10, hi: 16, gain: 0.9 });
      r.nz({ kind: 'pink', len: 1.6, filt: 'bandpass', f: 3000, to: 6000, sweep: 1.4, q: 1, gain: 0.07, env: [[0, 0], [0.5, 1], [1.6, 0]] });
    },
  },
  develop: {
    send: 0.7,
    fn: (r) => {
      // 显影：金点聚拢，下面一层缓缓涨起的宫徵，最后落一声轻钟
      r.grains({ n: 22, span: 2.2, shape: 'rise', lo: 5, hi: 12, gain: 0.8 });
      r.tone({ f: 440, atk: 1.2, tau: 1, len: 3, gain: 0.12 });
      r.tone({ f: 660, atk: 1.4, tau: 1, len: 3, gain: 0.08 });
      r.bell(2.2, hz(5), { gain: 0.4, len: 0.9 });
    },
  },
  shimmer: {
    send: 0.7,
    fn: (r) => {
      r.grains({ n: 18, span: 1.3, shape: 'swell', lo: 9, hi: 15, gain: 0.8 });
      r.tone({ f: 880, atk: 0.5, tau: 0.5, len: 1.6, gain: 0.05 });
    },
  },

  // —— 土、风、脚 ——
  soil: {
    send: 0.15,
    level: 1.5,
    fn: (r) => {
      for (let i = 0; i < 14; i++) {
        r.nz({ at: (i / 14) ** 1.3 * 0.4 + rnd(0, 0.02), len: rnd(0.015, 0.04), filt: 'bandpass', f: rnd(600, 2400), q: 1.1, gain: rnd(0.2, 0.55) * (1 - i / 20), tau: 0.01 });
      }
      r.tone({ f: 85, to: 60, sweep: 0.06, tau: 0.05, gain: 0.3 });
    },
  },
  crack: {
    send: 0.2,
    level: 1.9,
    fn: (r) => {
      for (const [at, f, g] of [[0, 3600, 0.9], [0.035, 2600, 0.6], [0.09, 4300, 0.5], [0.15, 2900, 0.4]]) click(r, at + rnd(0, 0.01), f, g);
      r.nz({ kind: 'pink', len: 0.3, filt: 'bandpass', f: 500, q: 1.5, gain: 0.35, env: [[0, 0], [0.05, 1], [0.3, 0]] });
      for (let i = 0; i < 6; i++) r.nz({ at: 0.12 + i * 0.04 + rnd(0, 0.02), len: 0.02, filt: 'bandpass', f: rnd(800, 2200), q: 1, gain: rnd(0.15, 0.3), tau: 0.008 });
    },
  },
  step: {
    send: 0.15,
    fn: (r) => {
      const j = rnd(0.9, 1.1) * (r.idx % 2 ? 0.93 : 1);
      r.tone({ f: 76 * j, to: 52 * j, sweep: 0.05, tau: 0.04, gain: 0.6 });
      r.nz({ kind: 'pink', len: 0.1, filt: 'lowpass', f: 380 * j, gain: 0.5, tau: 0.025 });
      r.nz({ at: 0.015, len: 0.06, filt: 'bandpass', f: 1800 * j, q: 0.9, hp: 900, gain: 0.2, tau: 0.02 });
    },
  },
  'wind-gust': {
    send: 0.3,
    fn: (r) => {
      r.nz({ kind: 'pink', len: 3, filt: 'bandpass', f: 300, to: 760, sweep: 2, q: 1.1, gain: 1.1, env: [[0, 0], [0.9, 0.6], [1.5, 0.75], [3, 0]] });
      r.nz({ kind: 'pink', at: 0.4, len: 2.2, filt: 'bandpass', f: 1200, to: 700, sweep: 2, q: 4, gain: 0.12, env: [[0, 0], [0.8, 1], [2.2, 0]] });
    },
  },

  // —— 心 ——
  'heart-open': {
    send: 0.7,
    fn: (r) => {
      r.nz({ kind: 'pink', len: 1.9, filt: 'bandpass', f: 700, to: 1700, sweep: 1, q: 1.8, gain: 0.7, env: [[0, 0], [0.9, 1], [1.9, 0]] });
      r.tone({ f: 220, atk: 0.9, tau: 0.6, len: 1.5, gain: 0.2 });
      r.tone({ f: 330, atk: 0.9, tau: 0.6, len: 1.5, gain: 0.14 });
      r.tone({ f: 440, at: 0.1, atk: 0.9, tau: 0.6, len: 1.5, gain: 0.08 });
    },
  },
  'heart-close': {
    send: 0.7,
    fn: (r) => {
      r.nz({ kind: 'pink', len: 1.2, filt: 'bandpass', f: 1500, to: 480, sweep: 0.9, q: 1.3, gain: 0.6, env: [[0, 0], [0.12, 1], [1.2, 0]] });
      r.tone({ f: 110, atk: 0.03, tau: 0.35, gain: 0.5 });
      r.tone({ f: 165, tau: 0.25, gain: 0.2 });
    },
  },
  seed: {
    send: 0.5,
    fn: (r) => {
      r.tone({ f: 1480, to: 1100, sweep: 0.05, tau: 0.03, gain: 0.2 });
      click(r, 0, 3000, 0.12);
      r.bell(0.06, hz(10), { gain: 0.3, len: 0.5, bright: 0.8 });
    },
  },
  sprout: {
    send: 0.5,
    fn: (r) => {
      r.nz({ kind: 'pink', len: 0.5, filt: 'bandpass', f: 900, to: 2600, sweep: 0.45, q: 1.2, gain: 0.25, env: [[0, 0], [0.2, 1], [0.5, 0]] });
      [0, 1, 3].forEach((d, i) => r.bell(0.12 * i, hz(10 + d), { gain: 0.26 + 0.05 * i, len: 0.45 }));
    },
  },

  // —— 小物件 ——
  'tally-snap': {
    send: 0.25,
    fn: (r) => {
      // 竹券掰断：清脆的一裂，竹管的空响，纤维撕开
      r.nz({ len: 0.04, hp: 2000, gain: 0.9, tau: 0.004 });
      r.tone({ f: 1100, tau: 0.02, gain: 0.35 });
      r.tone({ f: 1900, tau: 0.015, gain: 0.2 });
      r.tone({ f: 380, to: 330, sweep: 0.05, tau: 0.06, gain: 0.4 });
      r.nz({ at: 0.01, len: 0.08, filt: 'bandpass', f: 3000, q: 1, gain: 0.35, tau: 0.02 });
    },
  },
  fire: {
    send: 0.3,
    fn: (r) => {
      r.nz({ kind: 'pink', len: 1.8, filt: 'lowpass', f: 900, q: 0.6, gain: 0.5, env: [[0, 0], [0.5, 1], [1.2, 0.7], [1.8, 0]] });
      for (let i = 0; i < 22; i++) r.nz({ at: rnd(0, 1.7), len: 0.025, filt: 'highpass', f: rnd(1500, 4000), q: 0.7, gain: rnd(0.1, 0.6), tau: rnd(0.003, 0.01) });
    },
  },
  crowd: {
    send: 0.35,
    fn: (r) => {
      const swell = r.gain(0, r.out);
      swell.gain.setValueAtTime(0, r.t);
      swell.gain.linearRampToValueAtTime(1, r.t + 0.9 / r.rate);
      swell.gain.linearRampToValueAtTime(0.8, r.t + 1.9 / r.rate);
      swell.gain.linearRampToValueAtTime(0, r.t + 2.8 / r.rate);
      murmur(r, r.t, r.t + 2.8 / r.rate, swell, 1.1);
    },
  },
  jar: {
    send: 0.35,
    fn: (r) => {
      // 陶瓮的一敲：音高随 index（五声音阶）
      const f = hz(r.idx);
      r.tone({ f, to: f * 0.96, sweep: 0.05, tau: 0.09, gain: 0.85 });
      r.tone({ f: f * 1.93, tau: 0.05, gain: 0.3 });
      r.tone({ f: f * 2.9, tau: 0.03, gain: 0.14 });
      r.nz({ len: 0.03, filt: 'bandpass', f: 1300, q: 1, gain: 0.4, tau: 0.005 });
    },
  },
  water: {
    send: 0.7,
    fn: (r) => {
      let at = 0;
      for (let i = 0; i < 3; i++) {
        const f = rnd(700, 1200);
        r.tone({ f, to: f * 1.9, sweep: 0.05, at, tau: 0.035, gain: 0.35 - i * 0.07 });
        at += rnd(0.14, 0.3);
      }
      r.nz({ kind: 'pink', len: 0.7, filt: 'bandpass', f: 1800, q: 2, gain: 0.07, env: [[0, 0], [0.2, 1], [0.7, 0]] });
    },
  },
  cough: {
    send: 0.15,
    fn: (r) => {
      // 一声压着的咳：气声一冲，嗓子一抖，再一小下
      r.nz({ len: 0.07, filt: 'bandpass', f: 900, q: 1, hp: 300, gain: 0.5, tau: 0.02 });
      const t = r.t + 0.05 / r.rate;
      const saw = r.osc('sawtooth', 150 * r.rate, t, t + 0.2 / r.rate);
      saw.frequency.setValueAtTime(150 * r.rate, t);
      saw.frequency.exponentialRampToValueAtTime(105 * r.rate, t + 0.15 / r.rate);
      const g = r.gain(0, r.out);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.02);
      g.gain.setTargetAtTime(0, t + 0.04, 0.05 / r.rate);
      for (const f of [700, 1150]) saw.connect(r.filt('bandpass', f * r.rate, 4, g));
      r.nz({ at: 0.28, len: 0.05, filt: 'bandpass', f: 800, q: 1, hp: 300, gain: 0.22, tau: 0.015 });
    },
  },
  hover: {
    gap: 0.06,
    fn: (r) => {
      r.tone({ f: 2400, tau: 0.008, gain: 0.05 });
      click(r, 0, 4000, 0.03);
    },
  },
  tick: {
    gap: 0.05,
    fn: (r) => {
      r.tone({ f: 1500 * (1 + 0.04 * (r.idx % 4)), tau: 0.01, gain: 0.2 });
      r.tone({ f: 700, tau: 0.02, gain: 0.12 });
      click(r, 0, 3500, 0.2);
    },
  },
};

export const SFX_NAMES = Object.keys(SFX) as SfxName[];

// ------------------------------------------------------------------ 环境声

interface AmbDef {
  build: ((r: Rig) => void) | null;
  /** 送进混响的量 */
  send: number;
}

/** 风：粉红噪声过一个缓慢漂移的带通，音量也被两个很慢的 LFO 推着走 */
function windBed(r: Rig, o: { f: number; q?: number; swing?: number; hz?: number; gain: number; hp?: number }) {
  const rate = o.hz ?? 0.07;
  let n: AudioNode = r.noise('pink', r.t);
  if (o.hp) n = n.connect(r.filt('highpass', o.hp, 0.7));
  const bp = r.filt('bandpass', o.f, o.q ?? 0.8);
  const g = r.gain(o.gain, r.out);
  n.connect(bp);
  bp.connect(g);
  r.lfo(rate, o.gain * 0.5, g.gain);
  r.lfo(rate * 2.6, o.gain * 0.2, g.gain);
  r.lfo(rate * 0.65, o.f * (o.swing ?? 0.3), bp.frequency);
}

/** 蟋蟀：4.5 kHz 附近的窄带噪声，被 30 Hz 左右的脉冲切成一小串，再被 1–2 Hz 的开关分成一声声「唧唧唧」 */
function crickets(r: Rig, n: number, gain: number) {
  const swell = r.gain(0.7 * gain, r.out);
  r.lfo(0.035, 0.3 * gain, swell.gain);
  for (let i = 0; i < n; i++) {
    const s = r.noise('white', r.t);
    const bp = r.filt('bandpass', 4300 + i * 330 + rnd(-60, 60), 25);
    const boost = r.gain(7);
    const pulse = r.gain(0);
    const group = r.gain(0, swell);
    s.connect(bp);
    bp.connect(boost);
    boost.connect(pulse);
    pulse.connect(group);
    r.gate(rnd(28, 38), -0.15, 0.5, pulse.gain);
    r.gate(rnd(1.1, 2.1), 0.6, 0.3, group.gain);
  }
}

/** 蝉：5 kHz 以上的带噪声，被 70–110 Hz 的震颤切碎，整体一阵阵涨落 */
function cicadas(r: Rig, gain: number) {
  for (let i = 0; i < 2; i++) {
    const s = r.noise('white', r.t);
    const bp = r.filt('bandpass', 5200 + i * 900, 4);
    const lp = r.filt('lowpass', 7500, 0.6);
    const rattle = r.gain(0);
    const swell = r.gain(0.55 * gain, r.out);
    s.connect(bp);
    bp.connect(lp);
    lp.connect(rattle);
    rattle.connect(swell);
    r.gate(rnd(70, 110), -0.2, 0.6, rattle.gain);
    r.lfo(0.08 + i * 0.035, 0.45 * gain, swell.gain);
  }
}

const AMB: Record<AmbienceName, AmbDef> = {
  silence: { build: null, send: 0 },
  night: {
    send: 0.12,
    build: (r) => {
      windBed(r, { f: 420, q: 0.7, swing: 0.35, hz: 0.07, gain: 0.5, hp: 90 });
      crickets(r, 3, 0.22);
    },
  },
  cafe: {
    send: 0.1,
    build: (r) => {
      // 暖暖的室内底噪 + 木梁的低嗡 + 灯焰的呼吸 + 偶尔一声火星
      const room = r.gain(0.3, r.out);
      r.noise('pink', r.t).connect(r.filt('lowpass', 380, 0.5, room));
      r.lfo(0.05, 0.1, room.gain);
      for (const f of [98, 147]) r.osc('sine', f, r.t).connect(r.gain(0.028, r.out));
      const flame = r.gain(0.07, r.out);
      r.noise('pink', r.t).connect(r.filt('bandpass', 600, 0.8, flame));
      r.lfo(0.31, 0.08, flame.gain);
      const crk = burstChannel(r, { hp: 1800, f: 3500, q: 0.8 });
      sprinkle(r, 0.3, (t) => {
        crk.setValueAtTime(0, t);
        crk.linearRampToValueAtTime(rnd(0.1, 1) ** 2 * 0.3, t + 0.0015);
        crk.setTargetAtTime(0, t + 0.0015, rnd(0.003, 0.012));
      });
    },
  },
  city: {
    send: 0.2,
    build: (r) => {
      // 远远的人声：共振峰噪声 + 低沉的地面嗡鸣，整体放进远处（低通）
      const far = r.filt('lowpass', 1500, 0.5, r.out);
      murmur(r, r.t, undefined, far, 0.55);
      r.noise('pink', r.t).connect(r.filt('lowpass', 160, 0.5, r.gain(0.3, r.out)));
    },
  },
  'field-spring': {
    send: 0.15,
    build: (r) => {
      windBed(r, { f: 520, q: 0.9, swing: 0.3, hz: 0.06, gain: 0.55, hp: 120 });
      // 很远、很稀的一两声鸟
      const o = r.osc('sine', 3000, r.t);
      const g = r.gain(0, r.out);
      o.connect(g);
      sprinkle(r, 7, (t) => {
        const f = rnd(2600, 3600);
        for (let j = 0; j < Math.round(rnd(2, 4)); j++) {
          const tt = t + j * 0.11;
          o.frequency.setValueAtTime(f, tt);
          o.frequency.exponentialRampToValueAtTime(f * rnd(1.15, 1.4), tt + 0.07);
          g.gain.setValueAtTime(0, tt);
          g.gain.linearRampToValueAtTime(0.05, tt + 0.01);
          g.gain.setTargetAtTime(0, tt + 0.03, 0.02);
        }
      });
    },
  },
  'field-summer': {
    send: 0.12,
    build: (r) => {
      windBed(r, { f: 650, q: 0.7, swing: 0.3, hz: 0.05, gain: 0.5, hp: 150 });
      cicadas(r, 0.6);
    },
  },
  'field-autumn': {
    send: 0.15,
    build: (r) => {
      windBed(r, { f: 480, q: 1.1, swing: 0.4, hz: 0.08, gain: 0.6, hp: 100 });
      // 枯叶的沙沙
      const leaf = burstChannel(r, { hp: 2500, f: 4200, q: 0.7 });
      sprinkle(r, 2.2, (t) => {
        for (let j = 0; j < 6; j++) {
          const tt = t + j * rnd(0.02, 0.06);
          leaf.setValueAtTime(0, tt);
          leaf.linearRampToValueAtTime(rnd(0.05, 0.22), tt + 0.004);
          leaf.setTargetAtTime(0, tt + 0.004, 0.015);
        }
      });
    },
  },
  'field-winter': {
    send: 0.2,
    build: (r) => {
      // 又薄又冷：高一点的窄带风，加一缕细细的啸
      windBed(r, { f: 1000, q: 2.2, swing: 0.3, hz: 0.06, gain: 0.55, hp: 400 });
      const w = r.gain(0.45, r.out);
      const bp = r.filt('bandpass', 1300, 14, w);
      r.noise('pink', r.t).connect(bp);
      r.lfo(0.04, 260, bp.frequency);
      r.lfo(0.09, 0.3, w.gain);
    },
  },
  heart: {
    send: 0.35,
    build: (r) => {
      // 低低的嗡（宫与徵）随一次很慢的呼吸起落
      const breath = r.gain(0.3, r.out);
      r.lfo(0.13, 0.25, breath.gain);
      const lp = r.filt('lowpass', 520, 0.6, breath);
      for (const [f, g] of [[55, 0.5], [110, 0.7], [165.2, 0.3], [110.7, 0.3]]) r.osc('triangle', f, r.t).connect(r.gain(g * 0.5, lp));
      const air = r.gain(0.1, r.out);
      r.noise('pink', r.t).connect(r.filt('lowpass', 700, 0.5, air));
      r.lfo(0.13, 0.07, air.gain);
    },
  },
  gate: {
    send: 0.25,
    build: (r) => {
      // 院子里静静的：一点点风，一点点空气，偶尔树叶蹭一下
      windBed(r, { f: 300, q: 0.6, swing: 0.3, hz: 0.045, gain: 0.3, hp: 80 });
      const air = r.gain(0.04, r.out);
      r.noise('pink', r.t).connect(r.filt('highpass', 2000, 0.7, air));
      const leaf = burstChannel(r, { hp: 2000, f: 3500, q: 0.7 });
      sprinkle(r, 9, (t) => {
        for (let j = 0; j < 4; j++) {
          const tt = t + j * rnd(0.03, 0.08);
          leaf.setValueAtTime(0, tt);
          leaf.linearRampToValueAtTime(rnd(0.04, 0.12), tt + 0.005);
          leaf.setTargetAtTime(0, tt + 0.005, 0.02);
        }
      });
    },
  },
};

export const AMBIENCE_NAMES = Object.keys(AMB) as AmbienceName[];

// ------------------------------------------------------------------ 引擎

/** 默认总音量：约 -14 dB */
const DEFAULT_MASTER = 0.2;
const MAX_VOICES = 64;

export interface AudioDebug {
  readonly context: BaseAudioContext | null;
  /** 取总线电平：mix = 软限幅之后、总音量之前；out = 最终输出（含总音量与静音） */
  level(tap?: 'mix' | 'out'): { rms: number; peak: number };
  readonly voices: number;
  /** 当前（未在淡出的）环境声层 */
  readonly layers: readonly AmbienceName[];
  readonly musicOn: boolean;
  /** 最近发出的音乐音符（给试听页与测试看） */
  readonly musicLog: readonly { t: number; kind: 'bell' | 'xun'; hz: number }[];
  /** 合成过程中被吞掉的异常（正常应为空） */
  readonly errors: readonly string[];
}

interface Graph {
  sfx: GainNode;
  amb: GainNode;
  mus: GainNode;
  verbIn: GainNode;
  master: GainNode;
  mute: GainNode;
  pre: AnalyserNode;
  out: AnalyserNode;
}

interface Layer {
  name: AmbienceName;
  rig: Rig;
  out: GainNode;
  dying: boolean;
}

/** opts.context：用现成的 context（比如 OfflineAudioContext，测试与试听页用，立即视为已解锁）；opts.master：初始总音量（线性） */
export function createAudioEngine(bus: Bus, opts: { context?: BaseAudioContext; master?: number } = {}): Audio & AudioDebug {
  let ac: BaseAudioContext | null = null;
  let g: Graph | null = null;
  let unlocked = false;
  let muted = false;
  let masterGain = clamp(opts.master ?? DEFAULT_MASTER, 0, 1);
  const errors: string[] = [];

  // 想要的环境声与音乐（解锁前只记状态）
  let wantAmb: { name: AmbienceName; level: number; fadeMs: number } | null = null;
  const mus = { on: false, mode: 'gong' as Mode, tension: 0, next: 0, cur: 5, left: 3, timer: 0 as ReturnType<typeof setInterval> | 0 };
  const musicLog: { t: number; kind: 'bell' | 'xun'; hz: number }[] = [];

  const layers: Layer[] = [];
  const pending: Rig[] = [];
  let reaper: ReturnType<typeof setInterval> | 0 = 0;
  const lastAt = new Map<string, number>();
  const meterBuf = new Float32Array(2048);

  const isOffline = () => typeof OfflineAudioContext !== 'undefined' && ac instanceof OfflineAudioContext;

  // ---- 母线 ----
  function build(a: BaseAudioContext) {
    const gain = (v: number) => {
      const n = a.createGain();
      n.gain.value = v;
      return n;
    };
    const sfx = gain(1);
    const amb = gain(0.9);
    const musBus = gain(0.7);
    const mix = gain(1);
    sfx.connect(mix);
    amb.connect(mix);
    musBus.connect(mix);

    const comp = a.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 20;
    comp.ratio.value = 3;
    comp.attack.value = 0.012;
    comp.release.value = 0.3;
    mix.connect(comp);

    // 小厅混响：各路声音按自己的量送进来，去掉过低过高的部分
    const verbIn = gain(1);
    const hp = a.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 120;
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5500;
    const conv = a.createConvolver();
    conv.buffer = bufs(a).verb;
    conv.normalize = true;
    const wet = gain(0.9);
    verbIn.connect(hp);
    hp.connect(lp);
    lp.connect(conv);
    conv.connect(wet);

    const sum = gain(1);
    comp.connect(sum);
    wet.connect(sum);

    // 暖一点：削一点高频；再过软限幅（入口减半，曲线横轴为 ±2）
    const warm = a.createBiquadFilter();
    warm.type = 'highshelf';
    warm.frequency.value = 5500;
    warm.gain.value = -4;
    const half = gain(0.5);
    const ws = a.createWaveShaper();
    ws.curve = softCurve();
    ws.oversample = '2x';
    const pre = a.createAnalyser();
    pre.fftSize = 2048;
    const master = gain(masterGain);
    const mute = gain(muted ? 0 : 1);
    const out = a.createAnalyser();
    out.fftSize = 2048;
    sum.connect(warm);
    warm.connect(half);
    half.connect(ws);
    ws.connect(pre);
    ws.connect(master);
    master.connect(mute);
    mute.connect(out);
    mute.connect(a.destination);

    g = { sfx, amb, mus: musBus, verbIn, master, mute, pre, out };
  }

  // ---- 发声与回收 ----
  function sweep() {
    if (!ac) return;
    const now = ac.currentTime;
    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i].end < now) {
        pending[i].dispose();
        pending.splice(i, 1);
      }
    }
    if (!pending.length && reaper) {
      clearInterval(reaper);
      reaper = 0;
    }
  }
  function reapAt(r: Rig, at: number) {
    if (isOffline()) return; // 离线渲染不回收，渲染完整个 context 丢掉即可
    r.end = at;
    pending.push(r);
    if (!reaper) reaper = setInterval(sweep, 400);
  }

  /** 起一次发声：带音量、混响量、声像、rate、index、延迟 */
  function spawn(dest: AudioNode, o: { level?: number; send?: number; pan?: number; rate?: number; idx?: number; delay?: number }, fn: (r: Rig) => void) {
    if (!ac || !g) return;
    const a = ac;
    const out = a.createGain();
    out.gain.value = o.level ?? 1;
    const rig = new Rig(a, out, a.currentTime + 0.01 + (o.delay ?? 0), clamp(o.rate ?? 1, 0.25, 4), o.idx ?? 0);
    rig.add(out);
    let tail: AudioNode = out;
    if (o.pan) {
      const p = rig.add(a.createStereoPanner());
      p.pan.value = clamp(o.pan, -1, 1);
      out.connect(p);
      tail = p;
    }
    tail.connect(dest);
    if (o.send) {
      const s = rig.add(a.createGain(), g.verbIn);
      s.gain.value = o.send;
      tail.connect(s);
    }
    try {
      fn(rig);
    } catch (e) {
      rig.dispose();
      errors.push(String((e as Error)?.message ?? e));
      return;
    }
    reapAt(rig, rig.end + 0.2);
  }

  // ---- 环境声 ----
  function fadeLayer(L: Layer, to: number, fade: number) {
    const now = ac!.currentTime;
    L.out.gain.cancelScheduledValues(now);
    L.out.gain.setTargetAtTime(to, now, Math.max(0.005, fade / 4));
  }

  function applyAmbience() {
    if (!ac || !g || !wantAmb) return;
    const { name, fadeMs } = wantAmb;
    const level = clamp(wantAmb.level, 0, 2);
    const fade = Math.max(0.02, fadeMs / 1000);
    const now = ac.currentTime;
    for (const L of layers) {
      if (!L.dying && (L.name !== name || level <= 0)) {
        L.dying = true;
        fadeLayer(L, 0, fade);
        reapAt(L.rig, now + fade * 1.6 + 0.1);
      }
    }
    // 淡出的层别积太多
    const dying = layers.filter((l) => l.dying);
    for (let i = 0; i < dying.length - 3; i++) {
      dying[i].rig.dispose();
      layers.splice(layers.indexOf(dying[i]), 1);
    }
    for (let i = layers.length - 1; i >= 0; i--) {
      if (layers[i].dying && layers[i].rig.end < now) layers.splice(i, 1);
    }
    const def = AMB[name];
    if (!def.build || level <= 0) return;
    let L = layers.find((l) => l.name === name && !l.dying);
    if (!L) {
      const out = ac.createGain();
      out.gain.value = 0;
      out.connect(g.amb);
      const send = ac.createGain();
      send.gain.value = def.send;
      out.connect(send);
      send.connect(g.verbIn);
      const rig = new Rig(ac, out);
      rig.add(out);
      rig.add(send);
      try {
        def.build(rig);
      } catch (e) {
        rig.dispose();
        errors.push(String((e as Error)?.message ?? e));
        return;
      }
      L = { name, rig, out, dying: false };
      layers.push(L);
    }
    fadeLayer(L, level, fade);
  }

  // ---- 音乐：稀疏的编钟与埙 ----
  /** 起一个音符；返回这一句是否刚好收住 */
  function playNote(t: number): boolean {
    const T = mus.tension;
    const mode: Mode = Math.random() < smooth(0.35, 0.8, T) ? 'yu' : mus.mode;
    const center = MODE_AT[mode];
    // 音阶上的随机游走：小步为主，偶有跳进；乐句末回到调式主音
    const r = Math.random();
    let step = r < 0.27 ? -1 : r < 0.54 ? 1 : r < 0.66 ? -2 : r < 0.78 ? 2 : r < 0.86 ? 0 : r < 0.9 ? -3 : r < 0.94 ? 3 : r < 0.97 ? -4 : 4;
    if (mus.cur + step > 9 || mus.cur + step < 0) step = -step;
    mus.cur = clamp(mus.cur + step, 0, 9);
    const ended = --mus.left <= 0;
    if (ended) {
      for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
        if ((((mus.cur + d) % 5) + 5) % 5 === center) {
          mus.cur += d;
          break;
        }
      }
      mus.left = 3 + Math.floor(rnd(0, 3));
    }
    // 张力升高，整体沉下去一个八度
    const shift = -Math.round(5 * smooth(0.25, 0.9, T));
    const useXun = Math.random() < lerp(0.4, 0.55, T);
    const fold = (i: number, lo: number, hi: number) => {
      while (i < lo) i += 5;
      while (i > hi) i -= 5;
      return i;
    };
    const vel = rnd(0.6, 1);
    if (useXun) {
      const idx = fold(mus.cur + shift, 3 + shift, 8 + shift);
      const f = hz(idx);
      const dur = rnd(1.6, 2.8);
      musicLog.push({ t, kind: 'xun', hz: f });
      spawn(g!.mus, { send: 0.5, delay: Math.max(0, t - ac!.currentTime - 0.01) }, (rg) => rg.xun(0, f, dur, 0.7 * vel * lerp(1, 0.8, smooth(0.25, 0.9, T))));
    } else {
      const idx = fold(mus.cur + shift, shift, 9 + shift);
      const f = hz(idx);
      musicLog.push({ t, kind: 'bell', hz: f });
      spawn(g!.mus, { send: 0.55, delay: Math.max(0, t - ac!.currentTime - 0.01) }, (rg) => rg.bell(0, f, { gain: 0.8 * vel * lerp(1, 0.7, smooth(0.25, 0.9, T)), len: lerp(1, 1.1, T) }));
    }
    if (musicLog.length > 200) musicLog.shift();
    return ended;
  }

  function musicTick() {
    if (!ac || !g || !mus.on) return;
    const now = ac.currentTime;
    const horizon = isOffline() ? 24 : 0.3;
    if (mus.next < now) mus.next = now + 0.05;
    while (mus.next < now + horizon) {
      const t = mus.next;
      const ended = muted ? false : playNote(t);
      // 音与音的最小间隔：平静时 4 秒，紧张时 1.5 秒；一句收住后再多歇一会儿
      mus.next = t + lerp(4, 1.5, mus.tension) * rnd(1, 1.2) + (ended ? lerp(1.5, 0.6, mus.tension) : 0);
    }
  }

  function syncMusic() {
    if (!ac || !g) return;
    if (mus.on && !mus.timer) {
      mus.next = ac.currentTime + rnd(0.8, 1.5);
      if (isOffline()) musicTick();
      else mus.timer = setInterval(musicTick, 250);
    } else if (!mus.on && mus.timer) {
      clearInterval(mus.timer);
      mus.timer = 0;
    }
  }

  // ---- 解锁 ----
  function onVisibility() {
    if (!ac || isOffline() || typeof document === 'undefined') return;
    const c = ac as AudioContext;
    if (document.hidden) c.suspend().catch(() => {});
    else c.resume().catch(() => {});
  }
  function onGesture() {
    const c = ac as AudioContext | null;
    if (c && !isOffline() && c.state !== 'running' && !document.hidden) c.resume().catch(() => {});
  }

  function start() {
    unlocked = true;
    bus?.log?.('sense', { name: 'audio', state: 'unlocked', sampleRate: ac!.sampleRate });
    applyAmbience();
    syncMusic();
  }

  if (opts.context) {
    ac = opts.context;
    build(ac);
    start();
  }

  const api: Audio & AudioDebug = {
    get unlocked() {
      return unlocked;
    },
    get muted() {
      return muted;
    },
    get context() {
      return ac;
    },
    get voices() {
      return pending.length;
    },
    get layers() {
      return layers.filter((l) => !l.dying).map((l) => l.name);
    },
    get musicOn() {
      return mus.on;
    },
    get musicLog() {
      return musicLog;
    },
    get errors() {
      return errors;
    },

    unlock() {
      try {
        if (!ac) {
          const Ctor: typeof AudioContext | undefined = typeof window === 'undefined' ? undefined : (window as any).AudioContext ?? (window as any).webkitAudioContext;
          if (!Ctor) return;
          ac = new Ctor({ latencyHint: 'interactive' });
          build(ac);
          document.addEventListener('visibilitychange', onVisibility);
          document.addEventListener('pointerdown', onGesture, { passive: true });
          document.addEventListener('keydown', onGesture, { passive: true });
          start();
        }
        const c = ac as AudioContext;
        if (c.state !== 'running') c.resume().catch(() => {});
      } catch (e) {
        errors.push(String((e as Error)?.message ?? e));
      }
    },

    sfx(name, o = {}) {
      if (!ac || !g || muted) return;
      const def = SFX[name];
      if (!def) return;
      const now = ac.currentTime;
      if (def.gap && now - (lastAt.get(name) ?? -1) < def.gap) return;
      if (pending.length >= MAX_VOICES) return;
      lastAt.set(name, now);
      spawn(g.sfx, { level: (def.level ?? 1) * (o.gain ?? 1), send: def.send, pan: o.pan, rate: o.rate, idx: o.index }, def.fn);
    },

    ambience(name, level = 1, fadeMs = 1500) {
      wantAmb = { name, level, fadeMs };
      applyAmbience();
    },

    music(o) {
      if (o.mode) mus.mode = o.mode;
      if (o.tension !== undefined) mus.tension = clamp(o.tension, 0, 1);
      if (o.on !== undefined) mus.on = o.on;
      syncMusic();
    },

    bell(i, o = {}) {
      if (!ac || !g || muted) return;
      spawn(g.sfx, { send: 0.55, delay: Math.max(0, (o.delayMs ?? 0) / 1000) }, (r) => r.bell(0, hz(i), { gain: o.gain ?? 1 }));
    },

    setMasterGain(v) {
      masterGain = clamp(v, 0, 1);
      if (ac && g) g.master.gain.setTargetAtTime(masterGain, ac.currentTime, 0.05);
    },

    mute(on) {
      muted = on;
      if (ac && g) g.mute.gain.setTargetAtTime(on ? 0 : 1, ac.currentTime, 0.04);
    },

    level(tap = 'mix') {
      const an = tap === 'out' ? g?.out : g?.pre;
      if (!an) return { rms: 0, peak: 0 };
      an.getFloatTimeDomainData(meterBuf);
      let s = 0;
      let p = 0;
      for (let i = 0; i < meterBuf.length; i++) {
        const v = meterBuf[i];
        s += v * v;
        if (Math.abs(v) > p) p = Math.abs(v);
      }
      return { rms: Math.sqrt(s / meterBuf.length), peak: p };
    },
  };
  return api;
}

export function createAudio(bus: Bus): Audio {
  return createAudioEngine(bus);
}
