// 演示面板默认收起；反引号或左下角长按才打开。
import type { Ctx } from '../app/context';
import { direct } from '../director/pipeline/director';
import { createRng } from '../engine/rng';
import type { SimWorld } from '../engine/world/sim';
import { letterCounts } from '../engine/layers/bus';
import type { ActorCue, ActorReport, Commission, DirectorAck, MentorRetro } from '../engine/layers/types';
import { mountTouchFeedback } from './touch-feedback';

export function mountPresenter(ctx: Ctx): void {
  const query = new URLSearchParams(location.search);
  const requested = query.get('seed');
  if (requested !== null && /^-?\d+$/.test(requested)) {
    const seed = Number(requested);
    if (Number.isSafeInteger(seed) && Math.abs(seed) <= 2147483647 && seed !== ctx.plan.seed) {
      const budget = ctx.plan.acts[0]?.budget;
      Object.assign(ctx.plan, direct({
        intent: ctx.plan.intent,
        parts: [],
        seed,
        tier: ctx.plan.tier,
        rules: { rules: ctx.plan.director.rules.map(id => {
          const param: Record<string, number> | undefined = id === 'one-sentence' ? { maxChars: budget?.maxChars ?? 30 }
            : id === 'feedback' ? { ms: budget?.feedbackMs ?? 100 } : undefined;
          return { id, text: '', param };
        }) },
      }));
      ctx.rng = createRng(seed);
      ctx.record.seed = seed;
    }
  }

  mountTouchFeedback(ctx);
  const style = document.createElement('style');
  style.textContent = `
  .zp-shade{position:absolute;inset:0;background:rgba(9,7,6,.83);backdrop-filter:blur(7px);pointer-events:auto;
    color:#e7d9b6;font:14px/1.65 "Noto Serif SC","Songti SC",serif;overflow:auto;overscroll-behavior:contain;
    padding:clamp(16px,4vw,44px);box-sizing:border-box;user-select:text}
  .zp-shade[hidden]{display:none!important}
  .zp-dialog{max-width:860px;margin:auto;outline:none}
  .zp-head{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #5d482b;padding-bottom:12px}
  .zp-head h2{margin:0;font-size:21px;font-weight:500;letter-spacing:.12em}
  .zp-shade h3{font-size:15px;font-weight:500;color:#c9a24a;letter-spacing:.08em;margin:24px 0 8px}
  .zp-shade p{margin:8px 0}.zp-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .zp-shade button,.zp-shade input{font:inherit;color:inherit;background:#231910;border:1px solid #655036;
    padding:8px 12px;min-height:44px;box-sizing:border-box;touch-action:manipulation}
  .zp-shade button{cursor:pointer}.zp-shade button:hover{border-color:#c9a24a;background:#322315}
  .zp-shade :focus-visible{outline:2px solid #c9a24a;outline-offset:3px}
  .zp-shade input{width:100px}.zp-shade label{display:flex;align-items:center;gap:8px}
  .zp-shade pre{font:12px/1.65 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;
    border-left:1px solid #5d482b;padding:8px 12px;margin:0;max-height:260px;overflow:auto;color:#cbb98f}
  .zp-facts{margin:0;padding-left:24px;max-height:230px;overflow:auto}.zp-facts li{padding:3px 0}
  .zp-subtle{color:#a99a7a;font-size:12px}.zp-confirm{border-left:2px solid #b33a26;padding-left:14px;margin-top:16px}
  .zp-confirm[hidden]{display:none}
  @media(prefers-reduced-motion:reduce){.zp-shade{backdrop-filter:none}}
  `;
  document.head.appendChild(style);
  const layer = ctx.stage.dom('presenter', 120);
  const shade = document.createElement('div');
  shade.className = 'zp-shade';
  shade.hidden = true;
  const dialog = document.createElement('section');
  dialog.className = 'zp-dialog';
  dialog.tabIndex = -1;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'zp-title');
  shade.appendChild(dialog);
  layer.appendChild(shade);

  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const button = (text: string, action: () => void) => {
    const el = node('button', text);
    el.type = 'button';
    el.addEventListener('click', action);
    return el;
  };
  const group = () => {
    const el = node('div');
    el.className = 'zp-controls';
    return el;
  };
  const title = (text: string) => dialog.appendChild(node('h3', text));
  const head = node('div');
  head.className = 'zp-head';
  const heading = node('h2', '看见这台机器');
  heading.id = 'zp-title';
  const close = button('收起', () => setOpen(false));
  head.append(heading, close);
  dialog.appendChild(head);
  const status = node('p');
  dialog.appendChild(status);
  const controls = group();
  const stop = button('停：后续都用规则', () => {
    ctx.think.setStopped(!ctx.think.stopped());
    render();
  });
  let sources = false;
  const source = button('显示话语来源', () => {
    sources = !sources;
    ctx.lines.setShowSources(sources);
    source.textContent = sources ? '收起话语来源' : '显示话语来源';
  });
  const clock = button('假装离开两小时', () => {
    ctx.senses.skew(2 * 60 * 60 * 1000);
    render();
  });
  controls.append(stop, source, clock);
  dialog.appendChild(controls);

  title('重新试一局');
  const restart = group();
  const label = node('label', '种子');
  const seed = node('input');
  seed.type = 'number';
  seed.step = '1';
  seed.min = '-2147483647';
  seed.max = '2147483647';
  seed.value = String(ctx.plan.seed);
  label.appendChild(seed);
  const restartWithSeed = () => {
    if (!seed.reportValidity()) return;
    const n = Number(seed.value);
    if (!Number.isSafeInteger(n) || Math.abs(n) > 2147483647) return;
    const url = new URL(location.href);
    url.searchParams.set('seed', String(n));
    location.assign(url.href);
  };
  seed.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); restartWithSeed(); }
  });
  restart.append(label, button('重开', restartWithSeed), button('忘掉我', () => { confirm.hidden = false; forget.focus(); }));
  dialog.appendChild(restart);
  const explanation = node('p', '换种子仍由同一导演重新出方案；记忆只留在本机。');
  explanation.className = 'zp-subtle';
  dialog.appendChild(explanation);
  const confirm = node('div');
  confirm.className = 'zp-confirm';
  confirm.hidden = true;
  confirm.appendChild(node('p', '抹去这台机器记住的称呼与来访？'));
  const confirmation = group();
  const forget = button('忘掉，重新推门', () => {
    ctx.handoff.forgetVisit = true;
    ctx.store.forget();
    location.reload();
  });
  confirmation.append(forget, button('留下', () => { confirm.hidden = true; }));
  confirm.appendChild(confirmation);
  dialog.appendChild(confirm);

  title('三层信息流');
  const layerStatus = node('p');
  const layerLetters = node('pre');
  dialog.append(layerStatus, layerLetters);

  const machineDetails = node('details');
  machineDetails.style.cssText = 'margin:14px 0;padding:10px 14px;background:#18110b;border:1px solid #4a3824;border-radius:4px;';
  const machineSummary = node('summary', '看整台机器');
  machineSummary.style.cssText = 'cursor:pointer;color:#c9a24a;font-weight:500;';
  const machineBody = node('div');
  machineBody.style.cssText = 'margin-top:10px;font-size:13px;line-height:1.6;color:#d8cbb0;';
  machineDetails.append(machineSummary, machineBody);
  dialog.appendChild(machineDetails);

  title('心智停在哪一层');
  const mind = node('p');
  dialog.appendChild(mind);
  const predictions = node('pre');
  dialog.appendChild(predictions);
  title('交付的事实');
  const facts = node('ol');
  facts.className = 'zp-facts';
  dialog.appendChild(facts);
  title('页面真正读到的身体');
  const senses = node('p');
  dialog.appendChild(senses);
  title('最近的轨迹');
  const trace = node('pre');
  dialog.appendChild(trace);
  const exports = group();
  exports.append(button('保存轨迹', () => download(`zhuzi-${ctx.plan.seed}-trace.jsonl`, ctx.bus.jsonl(), 'application/x-ndjson')),
    button('保存事实', () => download(`zhuzi-${ctx.plan.seed}-ledger.json`, JSON.stringify(world()?.ledger() ?? [], null, 2), 'application/json')));
  dialog.appendChild(exports);

  const world = () => ctx.handoff.world as SimWorld | undefined;
  const response: Record<string, string> = { give: '给粟', lend: '借粟', 'buy-land': '买地', refuse: '拒绝' };
  const kindNames: Record<string, string> = {
    'mind.observe': '观测', 'mind.error': '误差', 'mind.layer': '停层', 'mind.update': '更新', 'mind.policy': '选择',
    'mind.imagine': '预演', 'mind.seed': '种子', 'mind.sediment': '沉淀', 'world.day': '日子', 'world.fact': '事实',
    'world.event': '事件', 'world.mark': '痕迹', 'world.closing': '关门', 'world.self': '禾自己行动',
    'think.call': '请求模型', 'think.result': '回应来源', 'line.say': '说话', 'act.enter': '进场', 'act.exit': '退场',
  };
  function render() {
    if (shade.hidden) return;
    const letters = ctx.layers.letters();
    const checks = ctx.layers.check();
    const kinds = { commission: '委托', plan: '方案', cue: '提示', report: '报告', retro: '回顾' };
    const names: Record<string, string> = { mentor: '导师', director: '导演', actor: '演员' };
    const totals = letterCounts(letters);
    layerStatus.textContent = Object.entries(totals).map(([kind, n]) => `${kinds[kind as keyof typeof kinds]} ${n}`).join(' · ')
      + ` · 未回执 ${ctx.layers.pending().length} · ${checks.length ? ((window as any).__zhuzi?.done ? '检查未通过' : '演出进行中') + '：' + checks.join('；') : '检查通过'}`;
    layerLetters.textContent = letters.map(l => {
      const detail = l.kind === 'commission' ? `为什么这次给你这个：${(l.payload as Commission).why}`
        : l.kind === 'plan' ? (l.payload as DirectorAck).accept
        : l.kind === 'cue' ? `预期：${(l.payload as ActorCue).expects}`
        : l.kind === 'report' ? `实际：${(l.payload as ActorReport).actual}` : `学到：${(l.payload as MentorRetro).actual}`;
      return `${l.receipt ? '✓' : '○'} ${(l.t / 1000).toFixed(1)}秒 ${names[l.from] ?? l.from} → ${names[l.to] ?? l.to} · ${kinds[l.kind]}${l.act ? ' · ' + l.act : ''} · ${detail}`;
    }).join('\n');
    const st = world()?.state();
    const counts = ctx.think.stats();
    status.textContent = `种子 ${ctx.plan.seed} · 来访 ${ctx.visit.n} · 本地规则 ${counts.rules} 次 · 模型 ${counts.model} 次`;
    stop.textContent = ctx.think.stopped() ? '继续允许模型' : '停：后续都用规则';
    const layers = { unit: 0, module: 0, mind: 0 };
    for (const event of ctx.bus.trace) {
      if (event.kind !== 'mind.layer') continue;
      const layer = event.layer ?? event.level;
      if (layer === 'unit' || layer === 'module' || layer === 'mind') layers[layer]++;
    }
    mind.textContent = `单元 ${layers.unit} · 模块 ${layers.module} · 心智 ${layers.mind}`
      + (st ? ` · ${({ spring: '春', summer: '夏', autumn: '秋', winter: '冬' })[st.season]} · 第 ${st.day} 天` : ' · 还没有进入禾的世界');
    const errors = ctx.bus.trace.filter(e => e.kind === 'mind.error' && ('predicted' in e || 'actual' in e));
    predictions.textContent = errors.length ? errors.slice(-6).map(e =>
      `预演：${response[String(e.predicted)] ?? String(e.predicted)}；实际：${response[String(e.actual)] ?? String(e.actual)}`
    ).join('\n') : '还没有拿预演和真实的田伯比较。';
    const ledger = world()?.ledger() ?? [];
    facts.replaceChildren(...ledger.map(f => node('li', f.text)));
    if (!ledger.length) facts.appendChild(node('li', '还没有交付事实。'));
    senses.textContent = ctx.senses.inventory().map(s => `${s.name}：${s.value}${s.real ? '' : '（未读到）'}`).join(' · ');
    const events = ctx.bus.trace.filter(e => e.kind !== 'aff.hover').slice(-24);
    trace.textContent = events.map(e => {
      const data = { ...e };
      delete (data as Partial<typeof e>).t;
      delete (data as Partial<typeof e>).kind;
      return `${(e.t / 1000).toFixed(1)}秒 ${kindNames[e.kind] ?? e.kind} ${JSON.stringify(data)}`;
    }).join('\n');

    const poured = ctx.store.get<boolean>('mentor.lamp.poured', false);
    const dismissed = ctx.store.get<boolean>('director.draft.dismissed', false);
    const lampVal = (ctx.handoff.commission as any)?.budget?.lamp ?? (poured ? '已调配' : '按感官分配');
    const worksList = (window as any).__runsIndex as any[] | undefined;
    machineBody.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="background:#20140c;padding:8px;border-left:2px solid #c9a24a;">
          <strong>① 灯油台</strong><br/>
          灯油份额：${lampVal}<br/>
          状态：${poured ? '已倒油微调' : '原样运行'}
        </div>
        <div style="background:#20140c;padding:8px;border-left:2px solid #c9a24a;">
          <strong>② 导演廊</strong><br/>
          台位：基础导演与叔衡<br/>
          草稿状态：${dismissed ? '已撤掉一版' : '毛坯在案'}
        </div>
        <div style="background:#20140c;padding:8px;border-left:2px solid #c9a24a;">
          <strong>③ 作品架</strong><br/>
          作品：${worksList && worksList.length > 0 ? `收录 ${worksList.length} 卷` : '架子还空着'}
        </div>
        <div style="background:#20140c;padding:8px;border-left:2px solid #c9a24a;">
          <strong>④ 门</strong><br/>
          地标：夜门通往各世界
        </div>
      </div>
    `;
  }
  function download(name: string, data: string, type: string) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = node('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  let previousFocus: HTMLElement | null = null;
  function setOpen(open: boolean) {
    if (open === !shade.hidden) return;
    if (open) previousFocus = document.activeElement as HTMLElement | null;
    shade.hidden = !open;
    ctx.handoff.presenterOpen = open;
    ctx.bus.emit('presenter.visibility', { open });
    if (open) { render(); close.focus(); }
    else {
      confirm.hidden = true;
      if (previousFocus?.isConnected) previousFocus.focus();
    }
  }
  dialog.addEventListener('keydown', e => {
    if (e.key === 'Escape' || e.code === 'Backquote') { e.preventDefault(); setOpen(false); }
    if (e.key === 'Tab') {
      const all = [...dialog.querySelectorAll<HTMLElement>('button,input,a')].filter(el => el.getClientRects().length > 0);
      const first = all[0], last = all.at(-1);
      if (e.shiftKey && document.activeElement === first && last) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last && first) { e.preventDefault(); first.focus(); }
    }
    e.stopPropagation();
  });
  window.addEventListener('keydown', e => {
    const target = e.target as HTMLElement | null;
    if (target?.matches('input,textarea,[contenteditable=true]')) return;
    if (e.code === 'Backquote') { e.preventDefault(); setOpen(shade.hidden !== false); }
  });
  shade.addEventListener('click', e => { if (e.target === shade) setOpen(false); });
  let hold: ReturnType<typeof setTimeout> | undefined;
  const cancelHold = () => { if (hold) clearTimeout(hold); hold = undefined; };
  ctx.stage.root.addEventListener('pointerdown', e => {
    if (e.clientX < 36 && e.clientY > ctx.stage.height - 36 && shade.hidden) {
      cancelHold();
      hold = setTimeout(() => setOpen(true), 1000);
    }
  });
  window.addEventListener('pointerup', cancelHold);
  window.addEventListener('pointercancel', cancelHold);
  let refresh: ReturnType<typeof setTimeout> | undefined;
  ctx.bus.on('trace', () => {
    if (shade.hidden || refresh) return;
    refresh = setTimeout(() => { refresh = undefined; render(); }, 160);
  });
}
