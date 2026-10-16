import { PAL, TONE } from '../../components/paint/palette';
import { createDeskScene } from './scene';
import type { Framework } from '../../app/context';
import type { Affordance } from '../../engine/affordance';
import type { WorkEntry } from '../../engine/types';
import type { Store } from '../../engine/store';
import { createMentor } from '../../engine/layers/mentor';
import { correctHypothesis, deriveHypotheses, type Hypothesis } from '../../engine/mind/hypotheses';
import type { Schedule } from '../../engine/mind/schedule';
import { groupWorks } from './groups';
import { deskExperience, memoryTitle, type DeskExperience } from './evidence';

const IDS = ['desk-entry', 'desk-mentor', 'desk-directors', 'desk-shelf'];
const FOCUS = ['desk-in', 'desk-doing', 'desk-shelf-in', 'desk-open'];
const cut = (text: string, n = 18) => [...text].slice(0, n).join('');
const keyOf = (w: WorkEntry) => `${w.intent}/${w.seed}/${w.tier}`;

/** This entry bases its reasons on visits and explicit corrections, including for returning users. */
export function deskMentorStore(store: Store): Store {
  return { ...store, get<T>(key: string, fallback: T): T {
    return ['visit.last', 'mentor.hypotheses', 'mentor.schedule', 'mentor.assign', 'desk.experience'].includes(key) ? store.get(key, fallback) : fallback;
  } };
}

/** Replace the scene at each depth; there are no neighbouring scenes off camera. */
export const desk: Framework = {
  async run(act, ctx) {
    const { stage, bus, aff, lines, store } = ctx;
    const layer = stage.layer('desk-scene', 25), c = layer.ctx;
    const scene = createDeskScene(stage, c);
    const start = Math.max(0, IDS.indexOf(act.id));
    let depth = start, selected = Number(ctx.handoff.deskSelected ?? 0), thought = 0, memory = 0;
    let ready = false, finished = false, drawerOpen = false, opened = false;
    let resolve!: () => void;
    const done = new Promise<void>(r => { resolve = r; });
    const controls: Affordance[] = [];
    // 架子上一件作品一块帛条：同一个 intent 的旧 seed 是试作，不是作品。
    // 不过滤的话 36 块帛条里只有 11 件作品（《第一次来访》一个节就有 16 个种子）。
    const newest = new Map<string, WorkEntry>();
    for (const w of [...(act.works ?? [])].filter(w => w.intent !== 'desk')
      .sort((a, b) => b.madeAt.localeCompare(a.madeAt) || keyOf(a).localeCompare(keyOf(b)))) {
      if (!newest.has(w.intent)) newest.set(w.intent, w);
    }
    const works = [...newest.values()];
    let l2EnterAt = -1;
    const getAssignments = () => store.get<Record<string, 'base' | 'shuheng'>>('mentor.assign', {});
    const assignedWorks = () => {
      const assigns = getAssignments();
      return works.map(w => ({ ...w, director: assigns[w.intent] ?? w.director }));
    };
    function assignTo(director: 'base' | 'shuheng') {
      const head = schedule().entries.find(e => e.when === 'next');
      if (!head) return;
      const assigns = { ...getAssignments() };
      const currentHeadDir = assigns[head.intentId] ?? (works.find(w => w.intent === head.intentId)?.director ?? 'base');
      if (currentHeadDir === director) return;
      const otherDir = director === 'shuheng' ? 'base' : 'shuheng';
      const otherWork = works.find(w => (assigns[w.intent] ?? w.director) === director);
      assigns[head.intentId] = director;
      if (otherWork && otherWork.intent !== head.intentId) {
        assigns[otherWork.intent] = otherDir;
      }
      store.set('mentor.assign', assigns);
      event('desk.assign.changed', { intentId: head.intentId, director });
      say(); mount(); draw();
    }
    function getScheduleState(): { when: 'next' | 'later' | 'dropped'; target: any } {
      const planned = schedule();
      const head = planned.entries.find(e => e.when === 'next');
      const postponed = !head ? planned.entries.find(e => e.when === 'later') : undefined;
      const target = head ?? postponed ?? planned.entries[0];
      const when = head ? 'next' : postponed ? 'later' : 'dropped';
      return { when, target };
    }
    function setSlipsState(action: 'next' | 'later' | 'dropped') {
      const planned = schedule();
      const entries = planned.entries.map(e => ({ ...e }));
      if (action === 'later') {
        const headIndex = entries.findIndex(e => e.when === 'next');
        if (headIndex >= 0) entries[headIndex]!.when = 'later';
        else entries.forEach(e => { if (e.when !== 'dropped') e.when = 'later'; });
      } else if (action === 'dropped') {
        entries.forEach(e => { e.when = 'dropped'; });
      } else if (action === 'next') {
        if (entries.length > 0) {
          entries[0]!.when = 'next';
          for (let i = 1; i < entries.length; i++) {
            if (entries[i]!.when !== 'dropped') entries[i]!.when = 'later';
          }
        }
      }
      store.set('mentor.schedule', { ...planned, entries });
      event('desk.schedule.slips.changed', { action });
      say(); mount(); draw();
    }
    const act2Withhold = ctx.plan.acts.find(a => a.id === 'desk-directors')?.withhold ?? ctx.plan.acts[2]?.withhold ?? [];
    const tradeoffItem = act2Withhold.find(w => w.includes('：') || w.includes('选') || w.includes('舍'));
    const tradeoffReason = tradeoffItem ?? (act2Withhold.length > 0 && act2Withhold[0] !== '其它层' && act2Withhold[0] !== '导师明细' ? `取舍：${act2Withhold[0]}` : undefined);
    const hasRehearsal = Array.isArray(ctx.plan.rehearsal) && ctx.plan.rehearsal.length > 0;
    const rehearsalFailed = hasRehearsal && ctx.plan.rehearsal.some(r => r.risk && (r.risk.includes('重来') || r.risk.includes('失败') || r.risk.includes('不一致')));
    const priorDwell = Object.entries(ctx.visit.previous?.dwell ?? {}).filter(([, ms]) => Number.isFinite(ms) && ms > 0).sort((a, b) => b[1] - a[1]);
    const topDwellKey = priorDwell[0]?.[0];
    const dwellActIndex = topDwellKey ? ctx.plan.acts.findIndex(a => a.id === topDwellKey || a.focus === topDwellKey || a.elements.some(e => e.id === topDwellKey) || (topDwellKey === 'ticket' && a.id === 'desk-entry') || (topDwellKey === 'mentor' && a.id === 'desk-mentor') || (topDwellKey.includes('director') && a.id === 'desk-directors') || (topDwellKey.includes('shelf') && a.id === 'desk-shelf')) : -1;
    const groups = groupWorks(works);
    let group = Math.min(Number(ctx.handoff.deskGroup ?? 0), groups.length - 1), groupTurnAt = -1;
    const currentWorks = () => groups[group]?.works ?? [];
    if (selected >= currentWorks().length) selected = 0;
    const work = () => currentWorks()[selected];
    const experience = store.get<DeskExperience[]>('desk.experience', deskExperience());
    const mentor = createMentor({ seed: ctx.plan.seed, tier: ctx.plan.tier, visits: ctx.visit.n,
      previous: ctx.visit.previous, sinceLastMs: ctx.visit.sinceMs, dayPart: ctx.senses.dayPart(),
      device: stage.narrow ? '手机' : '宽屏', strength: ctx.senses.strength(), store: deskMentorStore(store), works, experience });
    const commission = () => mentor.commission(ctx.plan.intent, ctx.plan);
    const schedule = () => mentor.schedule(ctx.plan.intent, ctx.plan);
    const saved = store.get<Hypothesis[]>('mentor.hypotheses', []);
    const previous = ctx.visit.previous;
    // No recorded behaviour means uncertainty, never an invented dwell or preference.
    const provisional = deriveHypotheses({ previous, dayPart: ctx.senses.dayPart() }).map((h, i) => {
      const hasEvidence = i === 0 ? !!(previous?.endingFact || previous?.dwell?.mentor)
        : i === 1 ? !!(previous?.longestPlace || Object.keys(previous?.dwell ?? {}).length)
        : ['night', 'deep-night'].includes(ctx.senses.dayPart()) || !!previous?.skipped?.length;
      return hasEvidence ? h : { ...h, text: ['还不知道你在意谁', '还不知道你愿意在哪停留', '还不知道你喜欢多长的故事'][i]!, confidence: 0,
        evidence: [{ visit: ctx.visit.n, what: '尚无足够来访记录；这是待确认的问题。' }] };
    });
    let hypotheses = saved.length ? saved : provisional;
    if (!saved.length) store.set('mentor.hypotheses', hypotheses);
    const active = () => hypotheses.filter(h => h.status !== 'retired');
    const event = (kind: string, more: Record<string, unknown> = {}) => bus.log('world.event', { kind, layer: `L${depth}`, ...more });

    const ui = stage.dom('desk-ui', 70);
    const style = document.createElement('style');
    style.textContent = `
      [data-layer=desk-ui]{font-family:"Noto Serif SC","Songti SC","STSong",serif;color:${PAL.silk}}
      .desk-drawer{position:absolute;right:0;top:0;bottom:0;width:min(320px,calc(100vw - 44px));box-sizing:border-box;
        background:linear-gradient(90deg,${PAL.lacquer2},${PAL.lacquer} 12%);border-left:1px solid ${PAL.gold};box-shadow:-16px 0 48px ${PAL.lacquer};padding:26px 22px;overflow:auto;pointer-events:auto;user-select:text;touch-action:pan-y}
      .desk-drawer[hidden]{display:none}.desk-drawer h2{font-size:21px;font-weight:400;margin:25px 0 18px;letter-spacing:.18em;color:${PAL.gold}}
      .desk-drawer h3{font-size:15px;font-weight:400;margin:25px 0 8px;color:${PAL.gold};border-top:1px solid ${TONE.goldDark};padding-top:18px}
      .desk-drawer section{border-top:1px solid ${TONE.goldDark};margin:20px 0;padding:5px 0 12px 12px;border-left:3px double ${TONE.bambooDark};background:linear-gradient(90deg,${PAL.lacquer2},${PAL.lacquer})}
      .desk-drawer p,.desk-drawer label{font-size:14px;line-height:1.8;overflow-wrap:anywhere;display:block}
      .desk-drawer section>p:first-child{color:${PAL.silk};border-bottom:1px solid ${TONE.bambooDark};padding-bottom:10px;letter-spacing:.06em}
      .desk-drawer .desk-evidence{font-size:12px;color:${PAL.silkDim}}.desk-drawer button{font:inherit;color:${PAL.gold};background:${PAL.lacquer2};border:1px solid ${TONE.goldDark};padding:8px 12px;cursor:pointer}
      .desk-drawer input{box-sizing:border-box;width:100%;font:15px/1.8 "Noto Serif SC","Songti SC",serif;background:${PAL.silkDim};color:${TONE.ink};border:0;border-bottom:2px solid ${TONE.bambooDark};padding:7px;user-select:text}
      .desk-drawer :focus-visible{outline:2px solid ${PAL.gold};outline-offset:4px}
      [data-layer=lines] .zl{white-space:pre-line;color:${PAL.silk}!important;font-family:"Noto Serif SC","Songti SC",serif!important;font-size:clamp(16px,2vw,21px)!important;letter-spacing:.16em;text-shadow:0 2px 12px ${PAL.lacquer}}
      [data-layer=lines] .src{display:none}
    `;
    ui.appendChild(style);
    const drawer = document.createElement('aside');
    drawer.className = 'desk-drawer'; drawer.id = 'desk-mentor-details'; drawer.hidden = true;
    drawer.setAttribute('aria-label', '导师层明细'); drawer.tabIndex = -1;
    ui.appendChild(drawer);
    const add = <K extends keyof HTMLElementTagNameMap>(tag: K, text: string, parent: HTMLElement = drawer) => {
      const el = document.createElement(tag); el.textContent = text; parent.appendChild(el); return el;
    };
    const toggleDrawer = (open: boolean) => {
      drawerOpen = open; drawer.hidden = !open;
      if (open) { renderDrawer(); drawer.querySelector('button')?.focus(); }
      else aff.get('desk-details')?.el.focus();
      mount(); draw();
    };
    function renderDrawer() {
      drawer.replaceChildren();
      const close = add('button', '收起'); close.type = 'button'; close.onclick = () => toggleDrawer(false);
      add('h2', '它眼中的你');
      for (const h of active()) {
        const section = add('section', ''); section.dataset.hypothesis = h.id;
        add('p', h.text, section);
        for (const ev of h.evidence) add('p', `第${ev.visit}次：${ev.what}`, section).className = 'desk-evidence';
        add('p', `置信度 ${h.confidence.toFixed(2)} · ${h.status === 'edited' ? '你已纠正' : '可纠正的判断'}`, section).className = 'desk-evidence';
        const form = document.createElement('form'); section.appendChild(form);
        const label = add('label', '你的说法', form);
        const input = document.createElement('input'); input.value = h.text; input.maxLength = 60;
        input.setAttribute('aria-label', `纠正假设 ${h.id}`); label.appendChild(input);
        const save = add('button', '纠正', form); save.type = 'submit';
        form.onsubmit = e => {
          e.preventDefault(); if (!input.value.trim()) { input.focus(); return; }
          const before = commission().why;
          hypotheses = correctHypothesis(hypotheses, h.id, input.value, store).hypotheses;
          const after = commission().why;
          event('desk.hypothesis.corrected', { id: h.id, before, after });
          say(); renderDrawer();
          drawer.querySelector<HTMLInputElement>(`[data-hypothesis="${h.id}"] input`)?.focus();
        };
      }
      add('h3', '来访史');
      add('p', `这是第${ctx.visit.n}次来访。`);
      add('p', previous ? `上次停在${previous.longestPlace ?? '尚未记录的位置'}；距今${Math.floor(ctx.visit.sinceMs / 60000)}分钟。` : '还没有上次来访记录。');
      add('h3', '下一次的打算'); add('p', commission().why);
      add('h3', '它下一步的排期');
      const planned = schedule();
      for (const item of planned.entries.slice(0, 3)) {
        const section = add('section', ''); section.dataset.schedule = item.intentId;
        add('p', `${item.title} · ${item.when === 'next' ? '接下来' : item.when === 'later' ? '稍后' : '已撤下'}`, section);
        add('p', item.why, section);
        add('p', `${item.evidence.kind} · ${item.evidence.ref}`, section).className = 'desk-evidence';
        for (const action of ['上移', '压后', '撤下']) {
          const control = add('button', action, section); control.type = 'button';
          control.onclick = () => {
            const before = commission().why;
            const entries = schedule().entries.map(e => ({ ...e }));
            const at = entries.findIndex(e => e.intentId === item.intentId);
            const [moved] = entries.splice(at, 1); if (!moved) return;
            if (action === '撤下') moved.when = 'dropped';
            else moved.when = 'later';
            if (action === '上移') entries.splice(Math.max(0, at - 1), 0, moved);
            else entries.push(moved);
            let head = false;
            entries.forEach((e, i) => { e.order = i; if (e.when !== 'dropped') { e.when = head ? 'later' : 'next'; head = true; } });
            const next: Schedule = { ...planned, entries };
            store.set('mentor.schedule', next);
            event('desk.schedule.changed', { action, intentId: item.intentId, before, after: commission().why });
            renderDrawer(); say(); draw();
          };
        }
      }
      if (planned.entries.length > 3) {
        const fold = add('details', ''); add('summary', `还有 ${planned.entries.length - 3} 件`, fold);
        for (const item of planned.entries.slice(3)) add('p', `${item.title} · ${item.why}`, fold);
      }
    }
    const onWindowKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        e.preventDefault(); e.stopPropagation(); toggleDrawer(false);
      }
    };
    window.addEventListener('keydown', onWindowKey);
    drawer.addEventListener('keydown', e => {
      // Editing and submitting belong to the drawer, not the scene's Enter shortcut.
      if (e.key !== 'Escape') e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); toggleDrawer(false); }
      if (e.key === 'Tab') {
        const focusable = [...drawer.querySelectorAll<HTMLElement>('button,input')];
        const first = focusable[0], last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    });
    const text = () => depth === 0 ? cut(commission().why)
      : depth === 1 ? cut(thought === 0 ? schedule().entries.find(e => e.when === 'next')?.why ?? '还没排下什么' : active()[(thought - 1) % Math.max(1, active().length)]?.text ?? '先听你说，再作判断')
      : depth === 2 ? cut(experience[memory]?.why ?? '还没记下什么')
      : work() ? '抽出一卷，门便亮了' : works.length ? '这种形还没装上' : '还没装上';
    function say(message = text()) {
      void lines.say({ who: depth < 2 ? '导师' : '旁白', text: message, charMs: 0, sticky: true,
        anchor: () => ({ x: stage.width / 2, y: stage.height * .82 }), width: () => Math.min(620, stage.width - 84), source: { source: 'script' } });
      for (const span of stage.root.querySelectorAll<HTMLElement>('[data-layer=lines] .c')) {
        if (span.textContent === '\n') { span.style.display = 'block'; span.style.height = '10px'; }
      }
      const line = stage.root.querySelector<HTMLElement>('[data-layer=lines] .zl');
      if (line && depth === 2) line.setAttribute('aria-label', ['base', 'shuheng'].map(id => { const w = assignedWorks().find(w => w.director === id); return `${id === 'base' ? '基础导演' : '叔衡'}：${w ? `《${w.title}》，${w.sealed ? '已交付' : '在做'}` : '还没装上'}`; }).join('；'));
      if (line && depth === 3 && work()) line.title = work()!.title;
    }
    const finish = () => { if (!finished) { finished = true; ctx.handoff.deskSelected = selected; ctx.handoff.deskGroup = group; resolve(); } };
    function inward() {
      if (drawerOpen || finished) return;
      if (depth < 3) {
        if (depth < start) { depth++; enter(); }
        else finish();
      } else {
        const w = work();
        if (w?.url && /^(?:\.\.\/)+[^?#]+\/index\.html$/.test(w.url)) {
          window.open(w.url, '_blank', 'noopener,noreferrer'); opened = true;
          event('desk.work.open', { work: keyOf(w), url: w.url });
          say('已在新页打开'); draw();
          setTimeout(() => finish(), 800);
        } else { say(w ? '这件还没开门' : '还没装上'); event('desk.work.unavailable'); draw(); setTimeout(() => finish(), 800); }
      }
    }
    function button(id: string, label: string, box: { x: number; y: number; w: number; h: number }, action: () => void, key?: string) {
      const a = aff.add({ id, label, shape: { kind: 'rect', ...box }, onActivate: action, onHover: () => draw(), key, represents: IDS[depth] });
      controls.push(a); return a;
    }
    function mount() {
      const focused = (document.activeElement as HTMLElement | null)?.dataset.aff;
      for (const a of controls.splice(0)) a.remove();
      const boxes = scene.boxes(depth);
      if (!drawerOpen) {
        button(FOCUS[depth]!, ['往里看', '看它在做什么', '看架上', '拿起进入'][depth]!, boxes.main!, inward, 'Enter');
        if (ready && depth > 0) button('desk-back', '退回', boxes.back!, () => { depth--; enter(); }, 'ArrowLeft');
        if (ready && depth === 1) {
          button('desk-assign-base', '派给基础导演', boxes.assignBase!, () => assignTo('base'), 'ArrowLeft');
          button('desk-assign-shuheng', '派给叔衡', boxes.assignShuheng!, () => assignTo('shuheng'), 'ArrowRight');
          button('desk-slips', '竹简笺', boxes.slips!, () => {
            const state = getScheduleState();
            if (state.when === 'next') setSlipsState('later');
            else if (state.when === 'later') setSlipsState('dropped');
            else setSlipsState('next');
          });
        }
        if (ready && depth === 1 && active().length > 1) button('desk-thought', '下一条想法', boxes.thought!, () => { thought++; say(); draw(); }, 'ArrowDown');
        if (ready && depth === 2 && tradeoffReason) {
          button('desk-tradeoff', '取舍留痕', boxes.tradeoff!, () => { say(tradeoffReason); draw(); }, 'Enter');
        }
        if (ready && depth === 2 && experience.length > 1) {
          const e = experience[memory]!;
          const item = button('desk-memory-next', '移灯看另一条年谱', boxes.memory!, () => { memory = (memory + 1) % experience.length; say(); mount(); draw(); }, 'ArrowDown');
          item.el.setAttribute('aria-description', `${e.title ?? e.rule}；${e.source}；${e.evidence.ref}；案例${e.caseRefs.join('、') || '未记'}；${JSON.stringify(e.param)}`);
        }
        if (ready && depth === 3 && currentWorks().length > 1) button('desk-work-next', '下一件作品', boxes.next!, () => { selected = (selected + 1) % currentWorks().length; say(); draw(); }, 'ArrowDown');
        if (ready && depth === 3 && groups.length > 1) button('desk-group-next', '翻木牌换形', boxes.group!, () => { group = (group + 1) % groups.length; groupTurnAt = stage.time; selected = 0; event('desk.group.changed', { form: groups[group]?.form }); say(); mount(); draw(); }, 'ArrowRight');
      }
      if (ready) {
        const tab = button('desk-details', drawerOpen ? '收起导师明细' : '打开导师明细', { x: stage.width - 36, y: stage.height * .4, w: 36, h: stage.height * .2 }, () => toggleDrawer(!drawerOpen));
        tab.el.setAttribute('aria-expanded', String(drawerOpen)); tab.el.setAttribute('aria-controls', drawer.id);
        tab.el.style.left = 'auto'; tab.el.style.right = drawerOpen ? 'min(320px,calc(100vw - 44px))' : '0';
      }
      if (focused && !drawerOpen) aff.get(focused)?.el.focus();
    }
    function draw() {
      layer.clear(); layer.reset();
      const { when: currentWhen, target } = getScheduleState();
      const assigned = target ? (getAssignments()[target.intentId] ?? (works.find(w => w.intent === target.intentId)?.director ?? 'base')) : 'base';
      const slipsCount = (commission().budget as any).slips ?? 3;

      ui.dataset.deskGroup = groups[group]?.form ?? '';
      ui.dataset.deskMemory = experience[memory]?.id ?? '';

      if (depth === 1) {
        ui.dataset.deskAssign = assigned;
        ui.dataset.deskSlips = String(slipsCount);
        ui.dataset.deskScheduleWhen = currentWhen;
        layer.canvas.dataset.deskAssign = assigned;
        layer.canvas.dataset.deskSlips = String(slipsCount);
        layer.canvas.dataset.deskScheduleWhen = currentWhen;
      }

      const l2Time = depth === 2 ? (stage.reducedMotion ? 999 : (l2EnterAt >= 0 ? Math.max(0, stage.time - l2EnterAt) : 0)) : 0;
      const tierCapacity: Record<string, number> = { L0: 1, L1: 4, L2: 6, L3: 8, L4: 10 };
      const maxActs = tierCapacity[ctx.plan.tier] ?? 4;
      const totalActs = Math.min(ctx.plan.acts.length, maxActs);
      const visibleActs = stage.reducedMotion ? totalActs : Math.min(totalActs, Math.floor(l2Time / 0.4) + 1);

      if (depth === 2) {
        ui.dataset.actStrokes = String(visibleActs);
        ui.dataset.totalActStrokes = String(totalActs);
        ui.dataset.focusStroke = '2';
        ui.dataset.hasTradeoff = String(!!tradeoffReason);
        ui.dataset.hasRehearsal = String(hasRehearsal);
        ui.dataset.rehearsalFailed = String(rehearsalFailed);
        ui.dataset.hasDwell = String(dwellActIndex !== undefined && dwellActIndex >= 0);
        layer.canvas.dataset.actStrokes = String(visibleActs);
        layer.canvas.dataset.totalActStrokes = String(totalActs);
        layer.canvas.dataset.focusStroke = '2';
      }

      scene.draw(depth, depth === 3 ? currentWorks() : assignedWorks(), selected, (active()[thought % Math.max(1, active().length)]?.confidence ?? 0) === 0,
        ready, drawerOpen, id => aff.get(id)?.hovering ?? false, opened, {
          scheduleTitle: cut(target?.title ?? '', 6),
          group: groups[group]?.title ?? '', groupTurnAt, entries: experience.map(e => ({ title: memoryTitle(e) })), memory,
          assignedDirector: assigned,
          scheduleWhen: currentWhen,
          budgetSlips: slipsCount,
          l2Time,
          acts: ctx.plan.acts,
          tier: ctx.plan.tier,
          currentActId: 'desk-directors',
          tradeoffReason,
          hasRehearsal,
          rehearsalFailed,
          dwellActIndex,
        });
    }
    function enter() {
      if (depth === 2 && l2EnterAt < 0) l2EnterAt = stage.time;
      else if (depth !== 2) l2EnterAt = -1;
      ui.dataset.deskLayer = `L${depth}`; layer.canvas.dataset.deskScene = `L${depth}`;
      ui.dataset.deskGroup = groups[group]?.form ?? ''; ui.dataset.deskMemory = experience[memory]?.id ?? '';
      event('desk.layer.enter'); say(); mount(); draw();
    }
    enter();
    const timer = setTimeout(() => { ready = true; mount(); draw(); }, 3100);
    const offFrame = stage.onFrame(() => draw());
    const offResize = stage.onResize(() => { mount(); draw(); });
    await done;
    clearTimeout(timer); offFrame(); offResize(); window.removeEventListener('keydown', onWindowKey); for (const a of controls) a.remove(); stage.removeLayer('desk-ui');
    ctx.handoff.deskSelected = selected;
    ctx.handoff.deskGroup = group;
    return { act: act.id, data: { layer: `L${depth}`, selected: work() ? keyOf(work()!) : null,
      facts: [{ id: `desk:${act.id}`, kind: 'delivery', text: `${IDS[start]}已展开${depth === 3 ? opened ? '，作品已打开' : '，入口尚未装上' : ''}` }] } };
  },
};
