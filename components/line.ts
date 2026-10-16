// 一句话。每屏的字不超过一句（约 30 字），多出来的折进「为什么」。
// 话跟着说话的人走（锚点每帧更新），像墨洇进纸里一样一字字显出来。
// 每句话旁有一个很小的来源印：悬停可见「规则」或「真的去想 · 秒数」。

import type { Bus } from '../engine/bus';
import type { Stage } from '../engine/stage';

export interface LineSource {
  source: 'model' | 'rules' | 'script';
  ms?: number;
  why?: string;
}

export interface SayOptions {
  who: string;
  text: string;
  /** 说话人的位置（每帧调用） */
  anchor: () => { x: number; y: number };
  /** 物件内的文字行宽（CSS 像素，随布局更新）。 */
  width?: () => number;
  /** 'light' 用在夜色/漆底上，'dark' 用在帛/土上 */
  ink?: 'light' | 'dark';
  tone?: 'speech' | 'thought' | 'mentor' | 'narration';
  size?: 'small' | 'normal' | 'large';
  source?: LineSource;
  /** 停留毫秒；默认按字数算 */
  holdMs?: number;
  /** true：一直留着直到 clear() 或下一句 */
  sticky?: boolean;
  /** 字出现的间隔 */
  charMs?: number;
  /** 折起来的「为什么」，点来源印可展开 */
  why?: string;
  /** 文字放在锚点上方还是下方 */
  place?: 'above' | 'below';
}

export interface Lines {
  say(opts: SayOptions): Promise<void>;
  clear(): void;
  /** 演示面板：常显来源印 */
  setShowSources(on: boolean): void;
  /** 当前屏上可见的字数 */
  visibleChars(): number;
}

const MAX_CHARS = 30;

let injected = false;
function injectStyle() {
  if (injected) return;
  injected = true;
  const s = document.createElement('style');
  s.textContent = `
  .zl{position:absolute;left:0;top:0;transform:translate(-50%,-100%);max-width:min(82vw,30em);
    font-family:"Noto Serif SC","Songti SC","STSong","SimSun",serif;font-weight:500;letter-spacing:.06em;
    line-height:1.5;text-align:center;white-space:normal;word-break:keep-all;overflow-wrap:anywhere;
    pointer-events:none;will-change:transform,opacity;transition:opacity .6s ease}
  .zl[data-place=below]{transform:translate(-50%,0)}
  .zl[data-size=small]{font-size:clamp(14px,1.6vw,17px)}
  .zl[data-size=normal]{font-size:clamp(16px,2vw,22px)}
  .zl[data-size=large]{font-size:clamp(20px,2.8vw,30px)}
  .zl[data-ink=light]{color:#f1e3c4;text-shadow:0 0 12px rgba(10,6,4,.95),0 0 3px rgba(10,6,4,.9)}
  .zl[data-ink=dark]{color:#231a14;text-shadow:0 0 10px rgba(240,228,200,.95),0 0 2px rgba(240,228,200,.9)}
  .zl[data-tone=thought]{font-style:normal;opacity:.92;letter-spacing:.1em}
  .zl[data-tone=thought][data-ink=light]{color:#e9d9b8}
  .zl[data-tone=mentor]{letter-spacing:.12em}
  .zl[data-tone=narration]{letter-spacing:.14em;font-weight:400}
  .zl .c{opacity:0;filter:blur(3px);display:inline-block;transition:opacity .42s ease,filter .5s ease}
  .zl .c.on{opacity:1;filter:blur(0)}
  .zl .src{pointer-events:auto;cursor:help;display:inline-block;width:.42em;height:.42em;margin-left:.5em;
    vertical-align:.18em;border-radius:1px;background:#a3362a;opacity:.55;transform:rotate(45deg);position:relative}
  .zl .src[data-s=model]{background:#c9a24a;opacity:.8}
  .zl .src[data-s=script]{background:transparent;box-shadow:inset 0 0 0 1px currentColor;opacity:.35}
  .zl .tag{position:absolute;left:50%;top:1.6em;transform:translateX(-50%) rotate(-45deg);white-space:nowrap;
    font-size:11px;letter-spacing:.05em;font-weight:400;padding:2px 6px;border-radius:2px;
    background:rgba(20,14,11,.86);color:#e8d6b0;opacity:0;transition:opacity .25s;text-shadow:none}
  .zl .src:hover .tag,.zl.showsrc .tag{opacity:1}
  .zl .why{display:block;margin-top:.4em;font-size:.72em;opacity:0;max-height:0;overflow:hidden;transition:opacity .4s,max-height .4s}
  .zl.open .why{opacity:.85;max-height:6em}
  .zl-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  @media (prefers-reduced-motion: reduce){.zl .c{transition:none;filter:none}}
  `;
  document.head.appendChild(s);
}

function tagText(s?: LineSource): string {
  if (!s || s.source === 'script') return '剧本';
  if (s.source === 'model') return `真的去想 · ${((s.ms ?? 0) / 1000).toFixed(1)} 秒`;
  const why: Record<string, string> = {
    'no-runtime': '本地规则', 'not-asked': '本地规则', not_granted: '未授权 · 本地规则', unavailable: '模型不可用 · 本地规则',
    slow: '模型太慢 · 本地规则', stopped: '已停 · 本地规则', invalid: '模型答偏 · 本地规则',
  };
  return `规则${s.why && why[s.why] ? ' · ' + why[s.why] : ''}`;
}

export function createLines(stage: Stage, bus: Bus, z = 60): Lines {
  injectStyle();
  const layer = stage.dom('lines', z);
  const live = document.createElement('div');
  live.className = 'zl-live';
  live.setAttribute('aria-live', 'polite');
  layer.appendChild(live);

  interface Active {
    el: HTMLElement;
    anchor: () => { x: number; y: number };
    width?: () => number;
    chars: number;
    dying: boolean;
  }
  const active = new Set<Active>();
  let showSources = false;

  stage.onFrame(() => {
    for (const a of active) {
      const p = a.anchor();
      if (a.width) a.el.style.width = `${Math.max(24, Math.min(stage.width - 24, a.width()))}px`;
      const halfWidth = Math.min(stage.width / 2 - 12, a.el.getBoundingClientRect().width / 2);
      const x = Math.max(halfWidth + 12, Math.min(stage.width - halfWidth - 12, p.x));
      const y = Math.max(28, Math.min(stage.height - 12, p.y));
      a.el.style.left = `${x}px`;
      a.el.style.top = `${y}px`;
    }
  });

  function kill(a: Active, fadeMs = 600) {
    if (stage.reducedMotion) fadeMs = 0;
    // 新句要立即替换；已经退场的旧句也必须移除，不能留下两句同时可见。
    if (a.dying && fadeMs !== 0) return;
    a.dying = true;
    a.el.style.opacity = '0';
    if (fadeMs === 0) {
      a.el.remove();
      active.delete(a);
      return;
    }
    setTimeout(() => {
      a.el.remove();
      active.delete(a);
    }, fadeMs);
  }

  function say(o: SayOptions): Promise<void> {
    const text = o.text.trim();
    const chars = [...text.replace(/\s/g, '')].length;
    bus.log('line.say', { who: o.who, text, chars, source: o.source?.source ?? 'script', ms: o.source?.ms, why: o.source?.why, over: chars > MAX_CHARS });
    if (chars > MAX_CHARS) console.warn(`[line] 超过一句（${chars} 字）：${text}`);
    // 一屏一句：新话出现，旧话退下
    for (const a of active) kill(a, 0);

    const el = document.createElement('div');
    el.className = 'zl' + (showSources ? ' showsrc' : '');
    el.dataset.ink = o.ink ?? 'light';
    el.dataset.tone = o.tone ?? 'speech';
    el.dataset.size = o.size ?? 'normal';
    el.dataset.place = o.place ?? 'above';
    el.dataset.who = o.who;
    if (o.width) el.style.width = `${Math.max(24, Math.min(stage.width - 24, o.width()))}px`;
    const charMs = stage.reducedMotion ? 0 : (o.charMs ?? 70);
    const spans: HTMLSpanElement[] = [];
    for (const ch of [...text]) {
      const sp = document.createElement('span');
      sp.className = 'c';
      sp.textContent = ch;
      el.appendChild(sp);
      spans.push(sp);
    }
    const src = document.createElement('span');
    src.className = 'src';
    src.dataset.s = o.source?.source ?? 'script';
    src.setAttribute('aria-label', tagText(o.source));
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = tagText(o.source);
    src.appendChild(tag);
    el.appendChild(src);
    if (o.why) {
      const why = document.createElement('span');
      why.className = 'why';
      why.textContent = o.why;
      el.appendChild(why);
      src.addEventListener('click', () => el.classList.toggle('open'));
    }
    layer.appendChild(el);
    live.textContent = `${o.who}：${text}`;
    const a: Active = { el, anchor: o.anchor, width: o.width, chars, dying: false };
    active.add(a);

    return new Promise<void>((resolve) => {
      spans.forEach((sp, i) => {
        if (charMs === 0) sp.classList.add('on');
        else setTimeout(() => sp.classList.add('on'), i * charMs);
      });
      const revealMs = spans.length * charMs + 300;
      const hold = o.holdMs ?? Math.max(1400, 900 + chars * 160);
      if (o.sticky) {
        setTimeout(resolve, revealMs);
        return;
      }
      setTimeout(() => {
        kill(a);
        resolve();
      }, revealMs + hold);
    });
  }

  return {
    say,
    clear() {
      for (const a of active) kill(a, 400);
    },
    setShowSources(on) {
      showSources = on;
      for (const a of active) a.el.classList.toggle('showsrc', on);
    },
    visibleChars() {
      let n = 0;
      for (const a of active) if (!a.dying) n += a.chars;
      return n;
    },
  };
}
