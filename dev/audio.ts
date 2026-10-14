// 声音试听页：每个音效、环境声、调式、编钟一个按钮；顶部有电平表；底部可离线渲染自检。
// 打开：npx vite，然后访问 /dev/audio.html

import { Bus } from '../engine/bus';
import { AMBIENCE_NAMES, MODES, SFX_NAMES, createAudioEngine, degreeHz } from '../engine/audio';
import type { AmbienceName, Mode, SfxName } from '../engine/audio-api';

const SFX_LABEL: Record<SfxName, string> = {
  'door-creak': '门吱呀', 'door-close': '关门', latch: '门闩', lamp: '灯亮', brush: '笔触', slide: '帛滑', pickup: '拿起', seal: '盖印',
  dissolve: '散成点', develop: '显影', shimmer: '微光', soil: '土屑', crack: '田裂', step: '脚步', 'wind-gust': '一阵风',
  knock: '叩门', 'gate-open': '开大门', 'gate-shut': '关大门', 'heart-open': '心象开', 'heart-close': '心象合',
  seed: '种子', sprout: '发芽', weight: '砝码', error: '误差', insight: '顿悟', 'tally-snap': '掰竹券', fire: '火', crowd: '人群',
  jar: '粟瓮', water: '水', cough: '咳', hover: '悬停', tick: '滴答', refuse: '拒绝', season: '换季',
};
const AMB_LABEL: Record<AmbienceName, string> = {
  night: '夜', cafe: '咖啡厅', city: '临淄城', 'field-spring': '田·春', 'field-summer': '田·夏', 'field-autumn': '田·秋',
  'field-winter': '田·冬', heart: '心象', gate: '门前院', silence: '静',
};
const MODE_LABEL: Record<Mode, string> = { gong: '宫', shang: '商', jue: '角', zhi: '徵', yu: '羽' };

const bus = new Bus();
const engine = createAudioEngine(bus);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const num = (id: string) => Number($<HTMLInputElement>(id).value);

function btn(label: string, sub: string, attrs: Record<string, string>): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  const main = document.createElement('span');
  main.textContent = label;
  const small = document.createElement('small');
  small.textContent = sub;
  b.append(main, small);
  for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
  return b;
}

// ---- 解锁与总控 ----
const stateEl = $('state');
function refreshState() {
  const c = engine.context as AudioContext | null;
  stateEl.textContent = engine.unlocked ? `声音已解锁（${c?.state ?? '-'}，${c?.sampleRate ?? '-'} Hz）` : '声音未解锁';
}
for (const ev of ['pointerdown', 'keydown'] as const) document.addEventListener(ev, () => { engine.unlock(); refreshState(); }, { passive: true });
$('unlock').addEventListener('click', () => { engine.unlock(); refreshState(); });

$('master').addEventListener('input', () => {
  const db = num('master');
  $('masterOut').textContent = `${db} dB`;
  engine.setMasterGain(db <= -40 ? 0 : 10 ** (db / 20));
});
$('mute').addEventListener('click', () => {
  const on = !engine.muted;
  engine.mute(on);
  $('mute').setAttribute('aria-pressed', String(on));
  $('mute').firstChild!.textContent = on ? '已静音' : '静音';
});

// ---- 音效 ----
const sfxBox = $('sfx');
for (const name of SFX_NAMES) sfxBox.append(btn(SFX_LABEL[name], name, { 'data-sfx': name }));
sfxBox.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sfx]');
  if (!b) return;
  engine.unlock();
  engine.sfx(b.dataset.sfx as SfxName, { index: num('sfxIndex'), gain: num('sfxGain'), pan: num('sfxPan'), rate: num('sfxRate') });
});

// ---- 环境声 ----
const ambBox = $('amb');
for (const name of AMBIENCE_NAMES) ambBox.append(btn(AMB_LABEL[name], name, { 'data-amb': name, 'aria-pressed': 'false' }));
function playAmb(name: AmbienceName) {
  engine.unlock();
  engine.ambience(name, num('ambLevel'), num('ambFade'));
}
ambBox.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-amb]');
  if (b) playAmb(b.dataset.amb as AmbienceName);
});
$('ambLevel').addEventListener('input', () => {
  const on = engine.layers[0];
  if (on) engine.ambience(on, num('ambLevel'), 200);
});

// ---- 音乐 ----
let mode: Mode = 'gong';
const modesBox = $('modes');
for (const m of MODES) {
  const b = btn(MODE_LABEL[m], m, { 'data-mode': m, role: 'radio', 'aria-checked': String(m === mode), 'aria-pressed': String(m === mode) });
  b.style.minWidth = '64px';
  modesBox.append(b);
}
function pushMusic(on?: boolean) {
  engine.unlock();
  engine.music({ mode, tension: num('tension'), on });
  $('musicOn').setAttribute('aria-pressed', String(engine.musicOn));
}
modesBox.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-mode]');
  if (!b) return;
  mode = b.dataset.mode as Mode;
  for (const x of modesBox.querySelectorAll('button')) x.setAttribute('aria-checked', String(x === b));
  for (const x of modesBox.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
  pushMusic();
});
$('musicOn').addEventListener('click', () => pushMusic(!engine.musicOn));
$('tension').addEventListener('input', () => {
  $('tensionOut').textContent = num('tension').toFixed(2);
  engine.music({ mode, tension: num('tension') });
});

// ---- 编钟：五声音阶 ----
const bellsBox = $('bells');
const DEG = ['宫', '商', '角', '徵', '羽'];
for (let i = -1; i <= 9; i++) {
  const oct = Math.floor(i / 5);
  const name = DEG[((i % 5) + 5) % 5] + (oct < 0 ? '↓' : oct > 0 ? '↑'.repeat(oct) : '');
  bellsBox.append(btn(name, `${i} · ${degreeHz(i).toFixed(0)} Hz`, { 'data-bell': String(i) }));
}
bellsBox.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-bell]');
  if (!b) return;
  engine.unlock();
  engine.bell(Number(b.dataset.bell), { gain: num('sfxGain') });
});

// ---- 电平表 ----
const dbOf = (x: number) => 20 * Math.log10(Math.max(x, 1e-6));
const meters = [
  { tap: 'mix' as const, bar: $('mixBar'), peak: $('mixPeak'), out: $('mixOut'), hold: 0 },
  { tap: 'out' as const, bar: $('outBar'), peak: $('outPeak'), out: $('outOut'), hold: 0 },
];
function frame() {
  for (const m of meters) {
    const { rms, peak } = engine.level(m.tap);
    const pos = (x: number) => Math.min(1, Math.max(0, (dbOf(x) + 60) / 60));
    m.hold = Math.max(m.hold * 0.985, peak);
    m.bar.style.transform = `scaleX(${pos(rms)})`;
    m.peak.style.left = `calc(${pos(m.hold) * 100}% - 2px)`;
    m.out.textContent = rms > 1e-6 ? `${dbOf(rms).toFixed(0)} / ${dbOf(m.hold).toFixed(0)} dB` : '-∞';
  }
  for (const b of ambBox.querySelectorAll<HTMLElement>('[data-amb]')) b.setAttribute('aria-pressed', String(engine.layers.includes(b.dataset.amb as AmbienceName)));
  const err = engine.errors;
  $('errors').textContent = err.length ? `合成出错：\n${err.join('\n')}` : '';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
refreshState();

// ---- 离线渲染自检 ----
export interface Row {
  kind: 'sfx' | 'ambience' | 'music' | 'misc';
  name: string;
  peakDb: number;
  rmsDb: number;
  /** 声音（高于 -50 dB）持续到第几秒 */
  endS: number;
  /** 空字符串 = 正常 */
  flag: string;
  extra?: string;
}

const SR = 44100;
async function render(secs: number, setup: (e: ReturnType<typeof createAudioEngine>) => void) {
  const ctx = new OfflineAudioContext(2, Math.floor(SR * secs), SR);
  const e = createAudioEngine(new Bus(), { context: ctx, master: 1 });
  setup(e);
  const buf = await ctx.startRendering();
  return { buf, e };
}
function measure(buf: AudioBuffer, from = 0, to = buf.duration) {
  const a = Math.floor(from * buf.sampleRate);
  const b = Math.floor(to * buf.sampleRate);
  let peak = 0, sum = 0, n = 0, last = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = a; i < b; i++) {
      const v = Math.abs(d[i]);
      if (v > peak) peak = v;
      sum += v * v;
      n++;
      if (v > 0.003 && i > last) last = i;
    }
  }
  return { peak, rms: Math.sqrt(sum / Math.max(1, n)), endS: last / buf.sampleRate };
}

export async function selfTest(): Promise<Row[]> {
  const rows: Row[] = [];
  const push = (kind: Row['kind'], name: string, m: ReturnType<typeof measure>, flag: string, extra?: string) =>
    rows.push({ kind, name, peakDb: +dbOf(m.peak).toFixed(1), rmsDb: +dbOf(m.rms).toFixed(1), endS: +m.endS.toFixed(2), flag, extra });

  for (const name of SFX_NAMES) {
    const { buf, e } = await render(7, (x) => x.sfx(name, { index: name === 'jar' || name === 'lamp' ? 2 : 0 }));
    const m = measure(buf);
    push('sfx', name, m, e.errors.length ? e.errors[0] : m.peak < 0.003 ? '无声' : '');
  }
  for (const name of AMBIENCE_NAMES) {
    const { buf, e } = await render(9, (x) => x.ambience(name, 1, 200));
    const m = measure(buf, 4, 9);
    push('ambience', name, m, e.errors.length ? e.errors[0] : name !== 'silence' && m.rms < 0.003 ? '无声' : name === 'silence' && m.peak > 0 ? '应无声' : '');
  }
  for (const tension of [0, 0.85]) {
    const { buf, e } = await render(26, (x) => x.music({ mode: 'gong', tension, on: true }));
    const m = measure(buf);
    const ts = e.musicLog.map((n) => n.t);
    const gaps = ts.slice(1).map((t, i) => t - ts[i]);
    const minGap = Math.min(...gaps);
    const maxGap = Math.max(...gaps);
    const flag = e.errors.length ? e.errors[0] : m.peak < 0.003 ? '无声' : minGap < 1.5 - 1e-6 ? '音符太密' : '';
    push('music', `tension ${tension}`, m, flag, `${ts.length} 个音，间隔 ${minGap.toFixed(2)}–${maxGap.toFixed(2)} s`);
  }
  {
    const { buf } = await render(4, (x) => { x.mute(true); x.sfx('knock'); x.bell(2); x.ambience('night', 1, 100); });
    const m = measure(buf, 0.6);
    push('misc', '静音时无声', m, m.peak > 0 ? '静音失效' : '');
  }
  {
    const { buf } = await render(7, (x) => { for (let i = 0; i < 5; i++) x.bell(i, { delayMs: i * 450 }); });
    const m = measure(buf);
    push('misc', '五声上行 bell 0..4', m, m.peak < 0.003 ? '无声' : '');
  }
  return rows;
}

function renderReport(rows: Row[]) {
  const t = $<HTMLTableElement>('report');
  t.hidden = false;
  t.replaceChildren();
  const head = t.insertRow();
  for (const h of ['类', '名', '峰值 dB', '均方 dB', '止于 s', '备注']) head.insertCell().outerHTML = `<th>${h}</th>`;
  for (const r of rows) {
    const tr = t.insertRow();
    for (const v of [r.kind, r.name, r.peakDb, r.rmsDb, r.endS, r.flag || r.extra || '']) tr.insertCell().textContent = String(v);
    if (r.flag) tr.cells[5].className = 'bad';
  }
}

$('selftest').addEventListener('click', async () => {
  $('selftestState').textContent = '渲染中……';
  const rows = await selfTest();
  renderReport(rows);
  const bad = rows.filter((r) => r.flag);
  $('selftestState').textContent = bad.length ? `${bad.length} 项有问题` : `全部 ${rows.length} 项正常`;
});

(window as any).__audio = { engine, bus, selfTest, SFX_NAMES, AMBIENCE_NAMES, MODES };
