// 注入页面里跑的测量脚本（纯 JS，不经 TS 转译：page.addInitScript 直接塞进去）。
// 只读页面，不改行为；唯一例外是 noText：删字测试时隐藏全部文字。
// 通用：不依赖 app 的任何模块，只认 [data-aff]、window.__trace、window.__zhuzi.done。
(() => {
  if (window.__bench) return;
  const B = (window.__bench = {
    firstAction: null, // 首个可操作元素出现的 performance.now()（自导航起）
    affSeries: [], // [{t, n}] 可见且未禁用的 [data-aff] 数量变化
    frames: [], // rAF 时间戳
    textSeries: [], // [{t, chars, digits}] 可见字数采样
    excl: [], // 截图等外力干扰帧率的时间窗 [t0, t1]
    errors: [],
    noText: false,
  });

  const AFF = '[data-aff]:not([disabled])';
  const INPUT = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), textarea, [contenteditable=""], [contenteditable="true"]';

  function visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    if (r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }

  function pulsing(el) {
    if (el.matches('[data-pulse]:not([data-pulse="0"]):not([data-pulse="false"]), [data-focus="1"], [data-focus="true"], .pulse, .pulsing, [aria-current]')) return true;
    const cs = getComputedStyle(el);
    return !!cs.animationName && cs.animationName !== 'none';
  }

  /** 当前可做的事：DOM 顺序，带中心点与是否真的点得到 */
  function candidates() {
    const out = [];
    for (const el of document.querySelectorAll(AFF)) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      const cx = Math.min(innerWidth - 1, Math.max(1, r.left + r.width / 2));
      const cy = Math.min(innerHeight - 1, Math.max(1, r.top + r.height / 2));
      const top = document.elementFromPoint(cx, cy);
      const hit = !!top && (top === el || el.contains(top) || top.contains(el));
      out.push({ id: el.dataset.aff, cx, cy, w: r.width, h: r.height, hit, pulse: pulsing(el) });
    }
    return out;
  }

  function inputs() {
    const out = [];
    for (const el of document.querySelectorAll(INPUT)) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      out.push({ cx: r.left + r.width / 2, cy: r.top + r.height / 2, focused: document.activeElement === el });
    }
    return out;
  }

  /** 屏上可见的字：文本节点，沿祖先累乘透明度，≥0.5 才算看得见 */
  function visibleText() {
    const root = document.body;
    if (!root) return { chars: 0, digits: 0 };
    const opCache = new Map();
    function effOpacity(el) {
      if (!el) return 1;
      if (opCache.has(el)) return opCache.get(el);
      const cs = getComputedStyle(el);
      let v = 1;
      if (cs.display === 'none' || cs.visibility === 'hidden') v = 0;
      else v = (parseFloat(cs.opacity) || 0) * effOpacity(el.parentElement);
      opCache.set(el, v);
      return v;
    }
    const skipTag = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE']);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let chars = 0;
    let digits = 0;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.nodeValue || '';
      if (!text.trim()) continue;
      const el = n.parentElement;
      if (!el || skipTag.has(el.tagName)) continue;
      if (el.closest('.zl-live, [aria-hidden="true"], [hidden]')) continue;
      if (effOpacity(el) < 0.5) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
      if (fs < 2) continue;
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) continue;
      const s = text.replace(/\s/g, '');
      chars += [...s].length;
      const m = s.match(/[0-9０-９]+/g);
      if (m) digits += m.length;
    }
    return { chars, digits };
  }

  function checkAff() {
    let n = 0;
    for (const el of document.querySelectorAll(AFF)) if (visible(el)) n++;
    const last = B.affSeries[B.affSeries.length - 1];
    if (!last || last.n !== n) {
      const t = performance.now();
      B.affSeries.push({ t, n });
      if (n > 0 && B.firstAction == null) B.firstAction = t;
    }
  }

  function done() {
    return !!(window.__zhuzi && window.__zhuzi.done === true);
  }

  const NOISE = new Set(['aff.hover', 'aff.click', 'tele.dwell', 'tele.idle', 'perf', 'sense']);

  /** 一次快照：模拟玩家每一步都读它 */
  B.snapshot = () => {
    const tr = Array.isArray(window.__trace) ? window.__trace : null;
    let progress = B.affSeries.length;
    let act = null;
    let focus = null;
    let acts = 0;
    let lastSay = 0;
    if (tr) {
      for (let i = 0; i < tr.length; i++) {
        const e = tr[i];
        if (!NOISE.has(e.kind)) progress++;
        if (e.kind === 'act.enter') {
          act = e.act;
          focus = e.focus || null;
          acts++;
        } else if (e.kind === 'line.say') lastSay = e.t;
      }
    }
    const txt = visibleText();
    return {
      now: performance.now(),
      done: done(),
      traceLen: tr ? tr.length : 0,
      progress,
      act,
      acts,
      focus,
      cands: candidates(),
      inputs: inputs(),
      chars: txt.chars,
      digits: txt.digits,
      lastSay,
    };
  };

  /** 删字测试：隐藏全部 DOM 文字，并让 canvas 的 fillText/strokeText 不出字 */
  B.hideText = () => {
    if (B.noText) return;
    B.noText = true;
    const css = document.createElement('style');
    css.id = '__bench_notext';
    css.textContent =
      'html *, html *::before, html *::after { color: transparent !important; text-shadow: none !important; -webkit-text-fill-color: transparent !important; }' +
      ' [data-layer="lines"], .zl, .zl-live { visibility: hidden !important; }';
    (document.head || document.documentElement).appendChild(css);
    const P = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
    if (P) {
      P.fillText = function () {};
      P.strokeText = function () {};
    }
  };

  B.mark = (a, b) => B.excl.push([a, b]);

  B.start = (opts) => {
    opts = opts || {};
    if (opts.noText) {
      B.hideText();
      // 文档还在构建时 head 可能不存在，补一次
      document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('__bench_notext')) {
          B.noText = false;
          B.hideText();
        }
      });
    }
    const mo = new MutationObserver(checkAff);
    const attach = () => {
      if (!document.documentElement) return;
      mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'style', 'class', 'hidden'] });
    };
    attach();
    document.addEventListener('DOMContentLoaded', () => {
      attach();
      checkAff();
    });
    setInterval(checkAff, 50);
    setInterval(() => {
      if (!document.body) return;
      const t = visibleText();
      B.textSeries.push({ t: performance.now(), chars: t.chars, digits: t.digits });
      if (B.textSeries.length > 40000) B.textSeries.splice(0, 10000);
    }, 250);
    const loop = (now) => {
      B.frames.push(now);
      if (B.frames.length > 60000) B.frames.splice(0, 20000);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    window.addEventListener('error', (e) => B.errors.push(String(e.message || e)));
  };
})();
