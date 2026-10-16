import type { Framework } from '../../app/context';
import type { Affordance } from '../../engine/affordance';
import { getOrInitHypotheses, correctHypothesis, type Hypothesis } from '../../engine/mind/hypotheses';
import worksData from '../../assets/library/console/works.json';
import rulesData from '../../director/seed-memory/rules.json';

export interface ConsoleWork {
  id: string;
  intent: string;
  title: string;
  form: string;
  formKey: string;
  tier: string;
  seed: number;
  status: '盖印' | '毛坯';
  sealed: boolean;
  director: string;
  facts: number;
  url: string | null;
  why: string;
  notes?: string;
}

const DEFAULT_LAMPS: Record<string, number> = {
  'fifty-years': 1.5,
  'first-visit': 1.0,
  'east-suburb-3d': 0.8,
  'shelf-gallery': 0.6,
  'studio': 0.5,
  'han-act1': 0.8,
  'three-look-at-sky': 0.4,
  'mentor-desk': 0.5,
};

const LAMP_REASONS: Record<string, string> = {
  'fifty-years': '长卷跨越五十年，转折繁复，分配四成以上灯油支持天下推演。',
  'first-visit': '初访专注推门与旱田首感，基准 1.0 盏确保一屏一事。',
  'east-suburb-3d': '空间视角重在景深层次，依视线停留深度分配 0.8 盏。',
  'shelf-gallery': '图集重在静赏与追问，按条目篇幅分配 0.6 盏。',
  'studio': '工作台重在回执核验与盖印，保留 0.5 盏供手边事使用。',
  'han-act1': '初谒田伯扣门关键帧，保 0.8 盏心象预演。',
  'three-look-at-sky': '三人看天短篇动画，0.4 盏轻量推进。',
  'mentor-desk': '导师案前信息整理，0.5 盏常驻底色。',
};

export const consoleFramework: Framework = {
  async run(act, ctx) {
    const { stage, store, bus, senses, visit, aff } = ctx;
    const dom = stage.dom('console-ui', 20);
    dom.style.pointerEvents = 'auto';
    dom.innerHTML = '';

    let finished = false;
    let reason = 'exit';
    let resolve!: () => void;
    const done = new Promise<void>(r => { resolve = r; });

    const finish = (why: string) => {
      if (finished) return;
      finished = true;
      reason = why;
      bus.log('world.event', { kind: 'console.complete', reason });
      resolve();
    };

    // 1. 数据准备
    // 假设列表
    let hypotheses = getOrInitHypotheses(store, {
      previous: visit.previous,
      current: ctx.record,
      dayPart: senses.dayPart(),
    });

    // 灯油分配
    const savedLamps = store.get<Record<string, number>>('mentor.lamps', {});
    const lamps: Record<string, number> = { ...DEFAULT_LAMPS, ...savedLamps };
    store.set('mentor.lamps', lamps);

    // 作品列表
    const works: ConsoleWork[] = Array.isArray(worksData) ? (worksData as ConsoleWork[]) : [];

    // 导演数据
    const directorRules = rulesData.rules || [];
    const baseRules = directorRules.filter(r => ['landmarks-fixed', 'give-then-ask', 'continuity', 'one-sentence'].includes(r.id));
    const shuhengRules = directorRules.filter(r => ['control', 'behavior-first', 'peak-end', 'tradeoff-visible'].includes(r.id));

    // 导师念头
    const mentorThought = store.get<string>('mentor.currentThought', '正在比对前次留痕与灯油余量，暂无突发偏颇。');

    // 来访史
    const visitsCount = visit.n;
    const sinceText = visit.sinceMs > 0
      ? (visit.sinceMs < 3600000 ? `${Math.round(visit.sinceMs / 60000)} 分钟前` : `${Math.round(visit.sinceMs / 86400000)} 天前`)
      : '初次造访';
    const longestPlace = visit.previous?.longestPlace || (visit.previous?.dwell ? Object.entries(visit.previous.dwell).sort((a,b)=>b[1]-a[1])[0]?.[0] : null) || '导师案前';

    // 2. 注入样式
    const style = document.createElement('style');
    style.id = 'console-styles';
    style.textContent = `
      #console-root {
        position: absolute; inset: 0;
        background: #120d0b;
        color: #f1e3c4;
        font-family: -apple-system, "Songti SC", "PingFang SC", "Noto Serif CJK SC", serif;
        display: flex; flex-direction: column;
        overflow: hidden; box-sizing: border-box;
      }
      .c-header {
        height: 52px; padding: 0 20px;
        border-bottom: 1px solid rgba(201, 162, 74, 0.4);
        display: flex; align-items: center; justify-content: space-between;
        background: #1a120e; flex-shrink: 0;
      }
      .c-title { font-size: 17px; font-weight: bold; color: #c9a24a; letter-spacing: 1px; display: flex; align-items: center; gap: 8px; }
      .c-tag { font-size: 11px; background: rgba(201,162,74,0.15); border: 1px solid #c9a24a; color: #e7d9b6; padding: 2px 6px; border-radius: 2px; }
      .c-thought { font-size: 13px; color: #cbb98f; font-style: italic; }
      .c-exit-btn {
        background: #2a1a13; border: 1px solid #c9a24a; color: #f1e3c4;
        padding: 5px 12px; font-size: 13px; cursor: pointer; border-radius: 2px;
      }
      .c-exit-btn:hover { background: #b33a26; color: #fff; }
      .c-body {
        flex: 1; display: grid; grid-template-columns: 32% 33% 35%;
        gap: 14px; padding: 14px; box-sizing: border-box; overflow: hidden;
      }
      .c-col {
        background: #18110e; border: 1px solid rgba(201, 162, 74, 0.3);
        border-radius: 3px; display: flex; flex-direction: column; overflow: hidden;
      }
      .c-col-header {
        background: #221612; padding: 10px 14px; border-bottom: 1px solid rgba(201, 162, 74, 0.25);
        color: #c9a24a; font-size: 15px; font-weight: bold; display: flex; align-items: center; justify-content: space-between;
      }
      .c-col-scroll { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
      .c-card {
        background: #1e1511; border: 1px solid rgba(201, 162, 74, 0.2);
        padding: 10px; border-radius: 2px; display: flex; flex-direction: column; gap: 6px;
      }
      .c-card-title { font-size: 13px; font-weight: bold; color: #cbb98f; border-bottom: 1px dashed rgba(201, 162, 74, 0.2); padding-bottom: 4px; }
      .hyp-item {
        padding: 6px; background: rgba(0,0,0,0.25); border-left: 2px solid #c9a24a;
        margin-top: 4px; font-size: 12px; display: flex; flex-direction: column; gap: 4px;
      }
      .hyp-text { color: #f1e3c4; line-height: 1.4; }
      .hyp-meta { font-size: 11px; color: #cbb98f; display: flex; justify-content: space-between; }
      .hyp-act { display: flex; gap: 6px; align-items: center; margin-top: 4px; }
      .btn-mini {
        background: #2a1a13; border: 1px solid #c9a24a; color: #f1e3c4;
        font-size: 11px; padding: 2px 7px; cursor: pointer; border-radius: 2px;
      }
      .btn-mini:hover { background: #c9a24a; color: #120d0b; }
      .oil-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 5px 0; border-bottom: 1px solid rgba(201, 162, 74, 0.1); font-size: 12px;
      }
      .oil-val { color: #d6b25a; font-weight: bold; margin: 0 6px; }
      .btn-circle {
        width: 22px; height: 22px; border-radius: 50%; background: #2a1a13;
        border: 1px solid #c9a24a; color: #f1e3c4; cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold;
      }
      .btn-circle:hover { background: #b33a26; color: #fff; }
      .oil-detail { font-size: 11px; color: #cbb98f; padding: 4px 6px; background: rgba(0,0,0,0.3); border-radius: 2px; margin-top: 4px; }
      .dir-item {
        padding: 8px; background: #201713; border: 1px solid rgba(201, 162, 74, 0.25);
        display: flex; flex-direction: column; gap: 6px;
      }
      .dir-name { font-size: 14px; font-weight: bold; color: #c9a24a; display: flex; justify-content: space-between; align-items: center; }
      .dir-status-line { font-size: 12px; color: #e7d9b6; display: flex; gap: 8px; }
      .dir-rule { font-size: 11px; color: #cbb98f; font-style: italic; background: rgba(0,0,0,0.2); padding: 4px; }
      .dir-bench-svg {
        width: 100%; height: 70px; background: #140d0a; border: 1px dashed rgba(201, 162, 74, 0.3);
        margin-top: 6px; display: block;
      }
      .work-card {
        background: #201713; border: 1px solid rgba(201, 162, 74, 0.3);
        padding: 10px; border-radius: 3px; display: flex; flex-direction: column; gap: 8px;
        transition: border-color 0.2s;
      }
      .work-card:hover { border-color: #c9a24a; }
      .work-header { display: flex; justify-content: space-between; align-items: center; }
      .work-title { font-size: 14px; font-weight: bold; color: #f1e3c4; }
      .work-tags { display: flex; gap: 5px; flex-wrap: wrap; }
      .tag-pill { font-size: 10px; padding: 1px 5px; border-radius: 2px; }
      .tag-form { background: #2a1a13; border: 1px solid #b0763a; color: #e7d9b6; }
      .tag-tier { background: #1a1a24; border: 1px solid #4f6b5a; color: #cbb98f; }
      .tag-status-sealed { background: #3d1612; border: 1px solid #b33a26; color: #f38f7d; }
      .tag-status-draft { background: #262118; border: 1px solid #8c6f32; color: #d6b25a; }
      .tag-facts { background: #1a2219; border: 1px solid #4f6b5a; color: #a2c4aa; }
      .work-why-box {
        font-size: 12px; color: #cbb98f; line-height: 1.4;
        background: rgba(0,0,0,0.25); padding: 6px; border-radius: 2px;
      }
      .work-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
      .enter-btn {
        background: #b33a26; border: 1px solid #d94e36; color: #fff;
        padding: 4px 14px; font-size: 12px; font-weight: bold; cursor: pointer; border-radius: 2px;
      }
      .enter-btn:hover:not([disabled]) { background: #d94e36; }
      .enter-btn[disabled] { background: #332420; border-color: #553e37; color: #77625b; cursor: not-allowed; }
      .c-status-bar {
        height: 32px; padding: 0 16px; border-top: 1px solid rgba(201, 162, 74, 0.3);
        background: #140d0a; display: flex; align-items: center; justify-content: space-between;
        font-size: 11px; color: #cbb98f; flex-shrink: 0;
      }
      .status-left { display: flex; gap: 14px; align-items: center; }
      .status-badge { background: rgba(79, 107, 90, 0.35); border: 1px solid #4f6b5a; color: #b7e0c4; padding: 1px 6px; border-radius: 2px; }
      .status-right { color: #8c7f6b; }
    `;
    dom.appendChild(style);

    // 3. 根容器
    const root = document.createElement('div');
    root.id = 'console-root';
    dom.appendChild(root);

    // 顶部
    const header = document.createElement('header');
    header.className = 'c-header';
    header.innerHTML = `
      <div class="c-title">
        <span>机器仪表</span>
        <span class="c-tag">UI 优先 · 独立入口</span>
        <span class="c-thought" id="header-thought">它现在在想：${mentorThought}</span>
      </div>
      <div>
        <button class="c-exit-btn" id="btn-console-exit" aria-label="收起仪表">关闭仪表</button>
      </div>
    `;
    root.appendChild(header);

    // 中间三栏
    const body = document.createElement('main');
    body.className = 'c-body';
    root.appendChild(body);

    // 左栏：导师
    const colMentor = document.createElement('section');
    colMentor.className = 'c-col';
    colMentor.id = 'col-mentor';
    colMentor.innerHTML = `
      <div class="c-col-header">
        <span>导师（心智 · 假设 · 灯油）</span>
        <span style="font-size:11px;color:#cbb98f">实时可调</span>
      </div>
      <div class="c-col-scroll" id="mentor-scroll">
        <!-- 假设清单 -->
        <div class="c-card" id="card-hypotheses">
          <div class="c-card-title">它眼中的你（假设清单）</div>
          <div id="hyp-list" style="display:flex;flex-direction:column;gap:6px;"></div>
        </div>

        <!-- 灯油分配 -->
        <div class="c-card" id="card-oil">
          <div class="c-card-title">灯油分配（每个世界 / 作品份额）</div>
          <div id="oil-list"></div>
        </div>

        <!-- 来访史 -->
        <div class="c-card" id="card-visit">
          <div class="c-card-title">来访史与留痕</div>
          <div style="font-size:12px;line-height:1.6;color:#e7d9b6">
            <div>来访次数：<strong style="color:#c9a24a">${visitsCount}</strong> 次</div>
            <div>上次距今：<span style="color:#cbb98f">${sinceText}</span></div>
            <div>最久停留：<span style="color:#cbb98f">${longestPlace}</span></div>
          </div>
        </div>
      </div>
    `;
    body.appendChild(colMentor);

    // 中栏：导演
    const colDirector = document.createElement('section');
    colDirector.className = 'c-col';
    colDirector.id = 'col-director';
    colDirector.innerHTML = `
      <div class="c-col-header">
        <span>导演（工作台 · 毛坯 · 盖印）</span>
        <span style="font-size:11px;color:#cbb98f">规则摘要</span>
      </div>
      <div class="c-col-scroll" id="director-scroll">
        <!-- 基础导演 -->
        <div class="dir-item">
          <div class="dir-name">
            <span>基础导演</span>
            <span class="tag-pill tag-tier">守宪法 · 基底</span>
          </div>
          <div class="dir-status-line">
            <span>毛坯：<span style="color:#d6b25a">《机器仪表》/《导师台》</span></span>
            <span>盖印：<span style="color:#f38f7d">《导师台》</span></span>
          </div>
          <div class="dir-rule">规则摘要：地标不动（你的座位、导师的位置、门）；已交付的版本只增不改。</div>
          <details style="font-size:11px;color:#cbb98f;cursor:pointer;">
            <summary style="padding:4px 0;color:#c9a24a">点开查看工作台细节与草图</summary>
            <svg class="dir-bench-svg" viewBox="0 0 300 70">
              <rect x="10" y="10" width="280" height="50" rx="3" fill="#1d1410" stroke="#c9a24a" stroke-dasharray="3,3"/>
              <text x="25" y="32" fill="#c9a24a" font-size="10" font-weight="bold">工作台 A · 基础案头</text>
              <rect x="25" y="40" width="45" height="15" fill="#2a1a13" stroke="#b0763a"/>
              <text x="32" y="51" fill="#e7d9b6" font-size="8">宪法简</text>
              <rect x="80" y="40" width="45" height="15" fill="#2a1a13" stroke="#b0763a"/>
              <text x="87" y="51" fill="#e7d9b6" font-size="8">地标印</text>
              <circle cx="260" cy="35" r="12" fill="#b33a26" opacity="0.6"/>
              <text x="252" y="38" fill="#fff" font-size="9">基印</text>
            </svg>
            <div style="margin-top:6px;line-height:1.4">
              ${baseRules.map(r => `<div>· <strong>${r.id}</strong>: ${r.text}</div>`).join('')}
            </div>
          </details>
        </div>

        <!-- 叔衡 -->
        <div class="dir-item">
          <div class="dir-name">
            <span>叔衡</span>
            <span class="tag-pill tag-form">叙事 · 3D · 电影</span>
          </div>
          <div class="dir-status-line">
            <span>毛坯：<span style="color:#d6b25a">《东郊空间稿》/《五十年长卷》</span></span>
            <span>盖印：<span style="color:#f38f7d">《旱》/《案上回信》</span></span>
          </div>
          <div class="dir-rule">规则摘要：视角与控制约 0.3；心智先从行为读出；峰值在此打开。</div>
          <details style="font-size:11px;color:#cbb98f;cursor:pointer;">
            <summary style="padding:4px 0;color:#c9a24a">点开查看工作台细节与草图</summary>
            <svg class="dir-bench-svg" viewBox="0 0 300 70">
              <rect x="10" y="10" width="280" height="50" rx="3" fill="#1d1410" stroke="#c9a24a" stroke-dasharray="3,3"/>
              <text x="25" y="32" fill="#c9a24a" font-size="10" font-weight="bold">工作台 B · 叔衡画案</text>
              <rect x="25" y="40" width="55" height="15" fill="#2a1a13" stroke="#4f6b5a"/>
              <text x="32" y="51" fill="#e7d9b6" font-size="8">东郊景深</text>
              <rect x="90" y="40" width="55" height="15" fill="#2a1a13" stroke="#4f6b5a"/>
              <text x="97" y="51" fill="#e7d9b6" font-size="8">五十年卷</text>
              <circle cx="260" cy="35" r="12" fill="#b33a26" opacity="0.6"/>
              <text x="252" y="38" fill="#fff" font-size="9">衡印</text>
            </svg>
            <div style="margin-top:6px;line-height:1.4">
              ${shuhengRules.map(r => `<div>· <strong>${r.id}</strong>: ${r.text}</div>`).join('')}
            </div>
          </details>
        </div>
      </div>
    `;
    body.appendChild(colDirector);

    // 右栏：呈现
    const colWorks = document.createElement('section');
    colWorks.className = 'c-col';
    colWorks.id = 'col-works';
    colWorks.innerHTML = `
      <div class="c-col-header">
        <span>呈现（作品卡片 · 进入）</span>
        <span style="font-size:11px;color:#cbb98f">共 ${works.length} 件</span>
      </div>
      <div class="c-col-scroll" id="works-scroll"></div>
    `;
    body.appendChild(colWorks);

    // 底部状态条
    const statusBar = document.createElement('footer');
    statusBar.className = 'c-status-bar';
    statusBar.id = 'bar-status';
    const thinkStats = ctx.think.stats();
    const thinkCount = thinkStats.model + thinkStats.rules;
    const ledger = (ctx.handoff.world as any)?.ledger?.() ?? [];
    const lastFactText = ledger.length > 0 ? (ledger[ledger.length - 1]?.text || '已记录') : '暂无事实';
    statusBar.innerHTML = `
      <div class="status-left">
        <span class="status-badge">本地规则驱动</span>
        <span>未接外部模型（诚实标注）</span>
        <span>念头采样：<strong style="color:#d6b25a">${thinkCount}</strong> 笔</span>
        <span>最近事实：<span style="color:#cbb98f">${lastFactText}</span></span>
      </div>
      <div class="status-right">
        <span>时代：zhanguo · 《机器仪表》</span>
      </div>
    `;
    root.appendChild(statusBar);

    // 4. 渲染假设列表与纠正动作
    const hypListEl = colMentor.querySelector('#hyp-list')!;
    function renderHypotheses() {
      hypListEl.innerHTML = '';
      hypotheses.forEach(h => {
        const item = document.createElement('div');
        item.className = 'hyp-item';
        item.dataset.id = h.id;
        const evSummary = h.evidence?.map(e => e.what).join('；') || '初访记录';
        item.innerHTML = `
          <div class="hyp-text" id="hyp-text-${h.id}"><strong>「${h.text}」</strong></div>
          <div class="hyp-meta">
            <span>依据：${evSummary}</span>
            <span>置信度：<strong style="color:#d6b25a">${Math.round(h.confidence * 100)}%</strong>${h.status === 'edited' ? ' · <span style="color:#f38f7d">已纠正</span>' : ''}</span>
          </div>
          <div class="hyp-act">
            <button class="btn-mini btn-correct" data-id="${h.id}" aria-label="纠正假设 ${h.id}">纠正</button>
            <span style="font-size:10px;color:#8c7f6b" id="hyp-reply-${h.id}"></span>
          </div>
        `;
        const btnCorrect = item.querySelector('.btn-correct') as HTMLButtonElement;
        btnCorrect.addEventListener('click', () => {
          const current = h.text;
          const correction = prompt(`纠正导师假设「${h.id}」：`, current.includes('人物') ? '你更看重天下的波澜而非一人得失' : `${current}（已澄清）`);
          if (correction && correction.trim() && correction.trim() !== current) {
            const res = correctHypothesis(hypotheses, h.id, correction.trim(), store);
            hypotheses = res.hypotheses;
            bus.log('world.event', { kind: 'console.hypothesis.corrected', id: h.id, to: correction.trim() });
            renderHypotheses();
            const replyEl = colMentor.querySelector(`#hyp-reply-${h.id}`) as HTMLElement;
            if (replyEl) replyEl.textContent = res.line;
          }
        });
        hypListEl.appendChild(item);
      });
    }
    renderHypotheses();

    // 5. 渲染灯油分配与 + / -
    const oilListEl = colMentor.querySelector('#oil-list')!;
    function renderOil() {
      oilListEl.innerHTML = '';
      Object.entries(lamps).forEach(([intentId, val]) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.gap = '3px';
        row.style.marginBottom = '6px';
        const workTitle = works.find(w => w.intent === intentId)?.title || intentId;
        const reason = LAMP_REASONS[intentId] || '依关注度与幕数配比分配。';

        row.innerHTML = `
          <div class="oil-row">
            <span style="color:#e7d9b6">${workTitle}</span>
            <div style="display:flex;align-items:center;">
              <button class="btn-circle btn-oil-minus" data-intent="${intentId}" aria-label="减少 ${workTitle} 灯油">−</button>
              <span class="oil-val" id="oil-val-${intentId}">${val.toFixed(1)} 盏</span>
              <button class="btn-circle btn-oil-plus" data-intent="${intentId}" aria-label="增加 ${workTitle} 灯油">+</button>
            </div>
          </div>
          <details style="font-size:11px;color:#cbb98f;cursor:pointer;">
            <summary style="padding:2px 0;color:#c9a24a;font-size:10px;">为什么这么分</summary>
            <div class="oil-detail">${reason}</div>
          </details>
        `;

        const btnMinus = row.querySelector('.btn-oil-minus') as HTMLButtonElement;
        const btnPlus = row.querySelector('.btn-oil-plus') as HTMLButtonElement;

        btnMinus.addEventListener('click', () => {
          lamps[intentId] = Math.max(0.1, Math.round((lamps[intentId]! - 0.1) * 10) / 10);
          store.set('mentor.lamps', lamps);
          bus.log('world.event', { kind: 'console.lamp.change', intentId, to: lamps[intentId] });
          renderOil();
        });

        btnPlus.addEventListener('click', () => {
          lamps[intentId] = Math.min(5.0, Math.round((lamps[intentId]! + 0.1) * 10) / 10);
          store.set('mentor.lamps', lamps);
          bus.log('world.event', { kind: 'console.lamp.change', intentId, to: lamps[intentId] });
          renderOil();
        });

        oilListEl.appendChild(row);
      });
    }
    renderOil();

    // 6. 渲染作品架
    const worksScrollEl = colWorks.querySelector('#works-scroll')!;
    works.forEach(w => {
      const card = document.createElement('div');
      card.className = 'work-card';
      card.dataset.id = w.id;
      const isSealed = w.status === '盖印';
      const hasUrl = !!w.url;

      card.innerHTML = `
        <div class="work-header">
          <span class="work-title">《${w.title}》</span>
          <div class="work-tags">
            <span class="tag-pill tag-form">${w.form}</span>
            <span class="tag-pill tag-tier">${w.tier}</span>
            <span class="tag-pill ${isSealed ? 'tag-status-sealed' : 'tag-status-draft'}">${w.status}</span>
            <span class="tag-pill tag-facts">${w.facts} 事实</span>
          </div>
        </div>
        <details class="work-why-details" style="font-size:11px;color:#cbb98f;cursor:pointer;">
          <summary style="padding:2px 0;color:#c9a24a">为什么值得你看</summary>
          <div class="work-why-box">${w.why}</div>
        </details>
        <div class="work-actions">
          <span style="font-size:11px;color:#8c7f6b">导演：${w.director} · seed ${w.seed}</span>
          <button class="enter-btn" data-url="${w.url ?? ''}" ${!hasUrl ? 'disabled' : ''} aria-label="进入 ${w.title}">
            ${hasUrl ? '进入' : '未开门'}
          </button>
        </div>
      `;

      const btnEnter = card.querySelector('.enter-btn') as HTMLButtonElement;
      if (hasUrl) {
        btnEnter.addEventListener('click', () => {
          bus.log('world.event', { kind: 'console.enter', work: w.id, url: w.url });
          window.open(w.url!, '_blank');
          finish(`enter:${w.id}`);
        });
      }

      worksScrollEl.appendChild(card);
    });

    // 7. 关闭/收起
    const btnExit = header.querySelector('#btn-console-exit') as HTMLButtonElement;
    btnExit.addEventListener('click', () => {
      finish('user-exit');
    });

    // 8. 注册 Affordances（首 3 秒仅 1 个可做之事，其余 3.1 秒后激活）
    let affCorrect: Affordance | undefined;
    let affOilPlus: Affordance | undefined;
    let affExit: Affordance | undefined;
    let affFirstEnter: Affordance | undefined;
    let timer3s: ReturnType<typeof setTimeout> | undefined;

    const setupAffordances = () => {
      const w = stage.width;
      const h = stage.height;
      const flashElement = (selector: string) => {
        const el = dom.querySelector(selector) as HTMLElement | null;
        if (el) {
          el.style.transition = 'none';
          el.style.backgroundColor = 'rgba(201, 162, 74, 0.45)';
          el.style.borderColor = '#c9a24a';
          setTimeout(() => {
            el.style.transition = 'background-color 0.2s, border-color 0.2s';
            el.style.backgroundColor = '';
            el.style.borderColor = '';
          }, 150);
        }
      };

      affCorrect = aff.add({
        id: 'console-mentor-correct',
        label: '纠正假设',
        shape: { kind: 'rect', x: 20, y: 120, w: Math.min(260, w * 0.28), h: 40 },
        represents: '纠正导师假设',
        onActivate: () => {
          flashElement('#card-hypotheses');
          const firstHyp = hypotheses[0];
          if (firstHyp) {
            const res = correctHypothesis(hypotheses, firstHyp.id, '你更看重天下的波澜而非一人得失', store);
            hypotheses = res.hypotheses;
            renderHypotheses();
          }
        },
      });

      timer3s = setTimeout(() => {
        if (finished) return;
        affOilPlus = aff.add({
          id: 'console-oil-adjust',
          label: '调整灯油',
          shape: { kind: 'rect', x: 20, y: 320, w: Math.min(260, stage.width * 0.28), h: 40 },
          represents: '调整长卷灯油',
          onActivate: () => {
            lamps['fifty-years'] = Math.round((lamps['fifty-years']! + 0.1) * 10) / 10;
            store.set('mentor.lamps', lamps);
            renderOil();
          },
        });

        affExit = aff.add({
          id: 'console-exit',
          label: '收起仪表',
          shape: { kind: 'rect', x: stage.width - 100, y: 10, w: 80, h: 36 },
          represents: '退出机器仪表',
          onActivate: () => finish('aff-exit'),
        });

        const firstWithUrl = works.find(wk => !!wk.url);
        if (firstWithUrl) {
          affFirstEnter = aff.add({
            id: 'console-enter-work',
            label: `进入《${firstWithUrl.title}》`,
            shape: { kind: 'rect', x: stage.width * 0.65, y: 140, w: Math.min(280, stage.width * 0.3), h: 44 },
            represents: `进入作品 ${firstWithUrl.title}`,
            onActivate: () => {
              bus.log('world.event', { kind: 'console.enter', work: firstWithUrl.id, url: firstWithUrl.url });
              finish(`enter:${firstWithUrl.id}`);
            },
          });
        }
      }, 3100);
    };

    setupAffordances();
    const offResize = stage.onResize(() => {
      affCorrect?.setShape({ kind: 'rect', x: 20, y: 120, w: Math.min(260, stage.width * 0.28), h: 40 });
      affOilPlus?.setShape({ kind: 'rect', x: 20, y: 320, w: Math.min(260, stage.width * 0.28), h: 40 });
      affExit?.setShape({ kind: 'rect', x: stage.width - 100, y: 10, w: 80, h: 36 });
      affFirstEnter?.setShape({ kind: 'rect', x: stage.width * 0.65, y: 140, w: Math.min(280, stage.width * 0.3), h: 44 });
    });

    bus.log('world.event', { kind: 'console.ready', worksCount: works.length });

    try {
      await done;
    } finally {
      if (timer3s) clearTimeout(timer3s);
      offResize();
      affCorrect?.remove();
      affOilPlus?.remove();
      affExit?.remove();
      affFirstEnter?.remove();
      stage.removeLayer('console-ui');
    }

    return {
      act: act.id,
      data: {
        reason,
        worksCount: works.length,
        hypothesesCount: hypotheses.length,
        facts: [
          { id: 'console-viewed', text: '机器仪表已查阅并完成调整', kind: 'delivery' }
        ],
      },
    };
  },
};

export const console = consoleFramework;
