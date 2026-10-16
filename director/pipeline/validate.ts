// 呈现方案的静态校验：在构建、试映之前，先拦住违反体验规格的方案。
// 纯函数，Node 和浏览器都能跑。error 会让 present 以非零退出；warn 只提醒。
// 依据：docs/design/demo-spec.md 第一节（总原则）、策划文档第 11、12 节。

import type { Plan, PlanAct, PlanElement } from '../../engine/types';

export interface Problem {
  level: 'error' | 'warn';
  /** 哪一幕（可空） */
  act?: string;
  /** 方案里的位置，如 acts[2].lines[0].text */
  path: string;
  msg: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: Problem[];
  warnings: Problem[];
}

export interface ValidateOptions {
  /** 种子记忆里的规则（读 one-sentence、feedback 的参数做对照） */
  rules?: { rules: { id: string; param?: Record<string, number> }[] };
}

const FRAMEWORKS = ['vignette', 'reveal', 'walk2d', 'chronicle', 'jixia-speakers', 'wude-wheel', 'qi-knife', 'bells', 'studio', 'east3d'];
const TIERS = ['L0', 'L1', 'L2', 'L3', 'L4'];
/** 一句话的字数：不含空白，按码位数，与 components/line.ts 的算法一致 */
export const countChars = (s: string) => [...String(s).replace(/\s/g, '')].length;
/** 句数：以句末标点收尾的段数 */
const countSentences = (s: string) => (String(s).match(/[^。！？!?；;…]+[。！？!?；;…]*/g) ?? []).filter((x) => x.trim()).length;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export function validatePlan(plan: Plan, opts: ValidateOptions = {}): ValidationResult {
  const errors: Problem[] = [];
  const warnings: Problem[] = [];
  const err = (path: string, msg: string, act?: string) => errors.push({ level: 'error', path, msg, act });
  const warn = (path: string, msg: string, act?: string) => warnings.push({ level: 'warn', path, msg, act });

  const ruleParam = (id: string, key: string): number | undefined => opts.rules?.rules.find((r) => r.id === id)?.param?.[key];
  const ruleMaxChars = ruleParam('one-sentence', 'maxChars');
  const ruleFeedback = ruleParam('feedback', 'ms');

  // ---- 方案整体 ----
  if (!plan || typeof plan !== 'object') {
    err('plan', '方案不是对象');
    return { ok: false, errors, warnings };
  }
  if (!isStr(plan.id)) err('id', '缺 id');
  if (!isNum(plan.seed)) err('seed', 'seed 不是数字');
  if (!TIERS.includes(plan.tier)) err('tier', `档位 ${String(plan.tier)} 不在 ${TIERS.join('/')}`);
  if (!plan.intent || !isStr(plan.intent.id)) err('intent', '缺意图');
  if (!isStr(plan.era)) err('era', '缺时代');

  // 宪法
  if (!Array.isArray(plan.constitution) || plan.constitution.length === 0) {
    err('constitution', '缺宪法：门永远推得开、你永远能对机器说话……');
  } else {
    if (plan.constitution.some((c) => !isStr(c))) err('constitution', '宪法里有空条目');
    if (!plan.constitution.some((c) => /门/.test(c) && /推得开/.test(c))) warn('constitution', '宪法里没有「门永远推得开」');
    if (!plan.constitution.some((c) => /地标/.test(c))) warn('constitution', '宪法里没有「地标不动」');
  }

  // ---- 各幕 ----
  if (!Array.isArray(plan.acts) || plan.acts.length === 0) {
    err('acts', '没有任何一幕');
    return { ok: false, errors, warnings };
  }
  const actIds = new Set<string>();
  plan.acts.forEach((act, ai) => {
    const at = `acts[${ai}]`;
    const aid = isStr(act?.id) ? act.id : `#${ai}`;
    if (!isStr(act?.id)) err(`${at}.id`, '幕缺 id');
    else if (actIds.has(act.id)) err(`${at}.id`, `幕 id 重复：${act.id}`, aid);
    else actIds.add(act.id);
    validateAct(act, at, aid);
  });

  function validateAct(act: PlanAct, at: string, aid: string) {
    if (!FRAMEWORKS.includes(act.framework)) err(`${at}.framework`, `框架 ${String(act.framework)} 不在 ${FRAMEWORKS.join('/')}`, aid);
    if (act.framework === 'walk2d' && !(plan.world?.places?.length > 0)) err(`${at}.framework`, 'walk2d 幕需要 plan.world.places', aid);
    if (!isStr(act.author)) warn(`${at}.author`, '幕没有作者', aid);
    if (!isStr(act.exit)) err(`${at}.exit`, '幕没有离开条件', aid);

    // 元素
    const els: PlanElement[] = Array.isArray(act.elements) ? act.elements : [];
    if (!els.length) err(`${at}.elements`, '幕里没有元素', aid);
    const ids = new Map<string, number>();
    els.forEach((el, ei) => {
      const et = `${at}.elements[${ei}]`;
      if (!isStr(el?.id)) {
        err(`${et}.id`, '元素缺 id', aid);
        return;
      }
      ids.set(el.id, (ids.get(el.id) ?? 0) + 1);
      if (!isStr(el.component)) err(`${et}.component`, `元素 ${el.id} 缺 component`, aid);
      if (!Array.isArray(el.actions)) err(`${et}.actions`, `元素 ${el.id} 的 actions 不是数组`, aid);
      const p = el.prominence;
      if (!p || ![p.x, p.y, p.scale, p.brightness].every(isNum)) err(`${et}.prominence`, `元素 ${el.id} 的 prominence 缺数值`, aid);
      else {
        if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) warn(`${et}.prominence`, `元素 ${el.id} 的位置在画面之外（x=${p.x}, y=${p.y}）`, aid);
        if (p.brightness < 0 || p.brightness > 1) warn(`${et}.prominence.brightness`, `元素 ${el.id} 亮度应在 0..1`, aid);
        if (p.scale <= 0) err(`${et}.prominence.scale`, `元素 ${el.id} 的 scale 要大于 0`, aid);
      }
    });
    for (const [id, n] of ids) if (n > 1) err(`${at}.elements`, `元素 id 重复：${id}（${n} 个）`, aid);

    // 每幕一个焦点，且在元素里
    if (!isStr(act.focus)) err(`${at}.focus`, '幕没有焦点（一屏一个焦点）', aid);
    else if (!ids.has(act.focus)) err(`${at}.focus`, `焦点 ${act.focus} 不在这一幕的元素里`, aid);
    else {
      const f = els.find((e) => e.id === act.focus);
      if (f && Array.isArray(f.actions) && f.actions.length === 0 && act.framework !== 'vignette') warn(`${at}.focus`, `焦点 ${act.focus} 没有可做的动作`, aid);
    }

    // 揭示与可达
    const reveal = Array.isArray(act.reveal) ? act.reveal : [];
    const withhold = new Set(Array.isArray(act.withhold) ? act.withhold : []);
    for (const r of reveal) if (!ids.has(r)) warn(`${at}.reveal`, `揭示顺序里的 ${r} 不是这一幕的元素（若是运行时生成的可忽略）`, aid);
    els.forEach((el, ei) => {
      if (!isStr(el?.id) || !Array.isArray(el.actions) || el.actions.length === 0) return;
      const et = `${at}.elements[${ei}]`;
      const isFocus = el.id === act.focus;
      const revealed = reveal.includes(el.id);
      if (withhold.has(el.id) && !isFocus) err(`${et}`, `元素 ${el.id} 有可做的事，却被列在 withhold 里：玩家永远够不到`, aid);
      else if (!isFocus && !revealed) {
        const p = el.prominence;
        const hidden = p && (p.folded || p.brightness <= 0);
        if (hidden) err(`${et}`, `元素 ${el.id} 有可做的事（${el.actions.join('/')}），但折叠或不可见，又不在揭示顺序里：够不到`, aid);
        else warn(`${et}`, `元素 ${el.id} 有可做的事，却不在揭示顺序里（它会一开始就在场，抢焦点）`, aid);
      }
    });

    // 话
    const budgetMax = act.budget?.maxChars;
    const lineIds = new Set<string>();
    (Array.isArray(act.lines) ? act.lines : []).forEach((ln, li) => {
      const lt = `${at}.lines[${li}]`;
      if (!isStr(ln?.id)) err(`${lt}.id`, '话缺 id', aid);
      else if (lineIds.has(ln.id)) err(`${lt}.id`, `话 id 重复：${ln.id}`, aid);
      else lineIds.add(ln.id);
      if (!isStr(ln?.text)) {
        err(`${lt}.text`, '话是空的', aid);
        return;
      }
      const n = countChars(ln.text);
      const limit = isNum(budgetMax) ? budgetMax : 30;
      if (n > limit) err(`${lt}.text`, `「${ln.text}」${n} 字，超过本幕预算 ${limit} 字`, aid);
      else if (n > 18) warn(`${lt}.text`, `「${ln.text}」${n} 字，最好 ≤ 18 字`, aid);
      if (countSentences(ln.text) > 1) warn(`${lt}.text`, `「${ln.text}」不止一句（每屏 ≤ 1 句）`, aid);
      if (/\d{2,}\s*%|百分之/.test(ln.text)) warn(`${lt}.text`, `「${ln.text}」里有百分比：饥饱用样子，不用数字`, aid);
    });

    // 预算
    const b = act.budget;
    if (!b) err(`${at}.budget`, '缺 budget', aid);
    else {
      if (!isNum(b.maxChars) || !Number.isInteger(b.maxChars) || b.maxChars < 1) err(`${at}.budget.maxChars`, `maxChars=${String(b.maxChars)} 不合理`, aid);
      else {
        if (b.maxChars > 30) err(`${at}.budget.maxChars`, `maxChars=${b.maxChars}，规格上限 30 字`, aid);
        if (isNum(ruleMaxChars) && b.maxChars !== ruleMaxChars) warn(`${at}.budget.maxChars`, `maxChars=${b.maxChars} 与规则 one-sentence 的 ${ruleMaxChars} 不一致`, aid);
      }
      if (!isNum(b.maxActionsFirst3s) || !Number.isInteger(b.maxActionsFirst3s) || b.maxActionsFirst3s < 0) err(`${at}.budget.maxActionsFirst3s`, `maxActionsFirst3s=${String(b.maxActionsFirst3s)} 不合理`, aid);
      else if (b.maxActionsFirst3s > 1) err(`${at}.budget.maxActionsFirst3s`, `前 3 秒可做的事 ${b.maxActionsFirst3s} 个，规格上限 1`, aid);
      else if (b.maxActionsFirst3s === 0) warn(`${at}.budget.maxActionsFirst3s`, '前 3 秒没有可做的事：玩家会等', aid);
      if (!isNum(b.feedbackMs) || b.feedbackMs <= 0) err(`${at}.budget.feedbackMs`, `feedbackMs=${String(b.feedbackMs)} 不合理`, aid);
      else {
        if (b.feedbackMs > 1000) err(`${at}.budget.feedbackMs`, `反馈 ${b.feedbackMs}ms，规格上限 1000ms`, aid);
        else if (b.feedbackMs > 100) warn(`${at}.budget.feedbackMs`, `反馈 ${b.feedbackMs}ms，目标 100ms`, aid);
        if (isNum(ruleFeedback) && b.feedbackMs !== ruleFeedback) warn(`${at}.budget.feedbackMs`, `feedbackMs=${b.feedbackMs} 与规则 feedback 的 ${ruleFeedback} 不一致`, aid);
      }
    }

    // 对玩家的预测
    const pr = act.predict;
    if (!pr || !isStr(pr.firstLook) || !isStr(pr.dwell) || !isStr(pr.surprise)) warn(`${at}.predict`, '缺对玩家的预测（firstLook / dwell / surprise）', aid);
    else if (!ids.has(pr.firstLook)) warn(`${at}.predict.firstLook`, `firstLook ${pr.firstLook} 不是这一幕的元素`, aid);
  }

  // 预演应逐幕有
  if (Array.isArray(plan.rehearsal)) {
    for (const id of actIds) if (!plan.rehearsal.some((r) => r.act === id)) warn('rehearsal', `幕 ${id} 没有预演`, id);
  } else warn('rehearsal', '缺 rehearsal');

  // 方案第一幕：宪法要求门永远推得开
  const first = plan.acts[0];
  if (first && first.framework === 'vignette' && !first.elements?.some((e) => /door|门/.test(e.id) && e.actions?.length > 0)) {
    warn('acts[0]', '第一幕是 vignette，却没有一扇能推的门');
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** 一行一条，便于打印 */
export function formatProblems(r: ValidationResult): string[] {
  const line = (p: Problem) => `${p.level === 'error' ? 'ERROR' : 'warn '} ${p.act ? `[${p.act}] ` : ''}${p.path}: ${p.msg}`;
  return [...r.errors.map(line), ...r.warnings.map(line)];
}
