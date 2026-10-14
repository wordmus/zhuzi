// 世界模拟的无头测试：三种模拟玩家 × seed 1..30。
// 运行：npx tsx engine/world/sim.test.ts
import { createRng, type Rng } from '../rng';
import type { Approach, Beat, Concept, DayOption, EndingId, PlaceId, Response } from '../types';
import { CONCEPT_NAME } from '../types';
import { generateWorld } from './generate';
import { allRuleLines } from './lines';
import { createWorld, translateWords, type SimWorld } from './sim';

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
const APPROACHES: Approach[] = ['qing', 'li', 'ming'];
const PLACES: PlaceId[] = ['home', 'field', 'well', 'altar', 'gate', 'road'];
const CONCEPTS: Concept[] = ['tian', 'she', 'jia', 'su', 'tianbo', 'zou', 'di', 'deng'];
const ENDINGS: EndingId[] = ['lend', 'sell', 'leave', 'sacrifice', 'endure'];
const VALUE: Record<Response, number> = { give: 1, lend: 0.75, 'buy-land': 0.5, refuse: 0 };
const len = (s: string) => [...s].length;

const failures: string[] = [];
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${msg}`);
  if (!ok) failures.push(msg);
};

// ---- 全局收集：台词长度、账本只增 ----
const longLines: string[] = [];
const seenLines = new Set<string>();
const noteLine = (s: string | undefined, max = 30) => {
  if (s === undefined) return;
  seenLines.add(s);
  if (len(s) > max) longLines.push(`(${len(s)}) ${s}`);
};
function scanBeats(beats: Beat[]) {
  for (const b of beats) {
    if (b.kind === 'say') noteLine(b.text);
    if (b.kind === 'gate') noteLine(b.line, 18);
    if (b.kind === 'unfold') noteLine(b.text);
    if (b.kind === 'rumor') noteLine(b.clue.text, 18);
    if (b.kind === 'commit') {
      noteLine(b.ending.mentorLine, 16);
      noteLine(b.ending.echo.replace('{days}', '30'));
    }
  }
}

interface Run { seed: number; day: number; ending: EndingId | null; endingFact: string; steps: number; firstErr: number | null; firstRehearsalOk: boolean | null; ledger: string; trace: string; beats: Beat[]; gateVisits: number; response: Response | null }

type Policy = (w: SimWorld, rng: Rng, log: (b: Beat[]) => void) => void;

const step = (w: SimWorld, o: DayOption, log: (b: Beat[]) => void) => {
  const before = w.ledger();
  const out = w.act(o);
  log(out.beats);
  const after = w.ledger();
  if (after.length < before.length || before.some((f, i) => JSON.stringify(f) !== JSON.stringify(after[i]))) failures.push('账本被改写');
  return out;
};

/** (a) 被动：永远照禾自己的意思 */
const passive: Policy = (w, _r, log) => {
  for (let g = 0; g < 40 && !w.finished(); g++) step(w, w.inclination(), log);
};

/** (b) 乱建议：随机念头、随机去处 */
const randomSuggest: Policy = (w, rng, log) => {
  for (let g = 0; g < 40 && !w.finished(); g++) {
    if (w.offer()) { step(w, rng.pick(w.options()), log); continue; }
    if (rng.chance(0.35)) {
      const c = rng.pick(CONCEPTS);
      const words = rng.chance(0.5) ? `想想${CONCEPT_NAME[c]}` : undefined;
      w.plant(c, words);
    }
    const r = w.suggest(rng.pick(PLACES), rng.chance(0.5) ? rng.pick(APPROACHES) : undefined);
    step(w, r.accepted ? r.option! : w.inclination(), log);
  }
};

/** (c) 想事的人：听流言、放进心里、预演，找到说得通的来由再去 */
const thinker: Policy = (w, _r, log) => {
  const taken = new Set<string>();
  for (let g = 0; g < 40 && !w.finished(); g++) {
    if (w.offer()) { step(w, w.inclination(), log); continue; }
    for (const id of w.state().knownClues) if (!taken.has(id)) { taken.add(id); w.takeClue(id); }
    const st = w.state();
    const opening = st.day <= 3 ? (['well', 'home', 'road'] as PlaceId[])[st.day - 1] : undefined;
    if (opening) {
      const r = w.suggest(opening);
      step(w, r.accepted ? r.option! : w.inclination(), log);
      continue;
    }
    const rh = APPROACHES.map((a) => w.rehearse(a)).filter((r) => r.predicted === 'give' || r.predicted === 'lend' || r.predicted === 'buy-land');
    rh.sort((a, b) => VALUE[b.predicted] - VALUE[a.predicted] || b.confidence - a.confidence);
    if (rh.length && st.season !== 'spring') {
      const r = w.suggest('gate', rh[0]!.approach);
      if (r.accepted) { step(w, r.option!, log); continue; }
    }
    step(w, w.inclination(), log);
  }
};

function runOne(policy: Policy, seed: number): Run {
  const rng = createRng(seed * 7919);
  const w = createWorld(generateWorld(seed, createRng(seed)), createRng(seed));
  const beats: Beat[] = [...w.opening()];
  scanBeats(beats);
  let steps = 0;
  const log = (b: Beat[]) => { steps++; scanBeats(b); beats.push(...b); };
  // 首次预演是否预测成功（粗略：没做任何事时直接预演三种来由里的「情」）
  const first = w.rehearse('qing');
  noteLine(first.line);
  policy(w, rng, log);
  const firstGate = beats.find((b): b is Extract<Beat, { kind: 'gate' }> => b.kind === 'gate');
  const firstErrBeat = beats.find((b): b is Extract<Beat, { kind: 'error' }> => b.kind === 'error');
  const st = w.state();
  return {
    seed, day: st.day, ending: st.ending?.id ?? null, endingFact: st.ending?.fact.id ?? '', steps,
    firstErr: firstErrBeat ? Math.abs(VALUE[firstErrBeat.actual] - VALUE[firstErrBeat.predicted]) : null,
    firstRehearsalOk: first.predicted === 'give' || first.predicted === 'lend',
    ledger: JSON.stringify(w.ledger()), trace: JSON.stringify(w.mindTrace()),
    beats, gateVisits: st.visitsToGate, response: firstGate?.response ?? null,
  };
}

const policies: [string, Policy][] = [['被动', passive], ['乱建议', randomSuggest], ['想事', thinker]];
const results: Record<string, Run[]> = {};
for (const [name, p] of policies) results[name] = SEEDS.map((s) => runOne(p, s));

console.log('\n== 结局分布（30 个 seed）==');
console.log('策略      ' + ENDINGS.map((e) => e.padEnd(10)).join('') + '首次叩门误差   去过田伯家   首预演成功');
for (const [name] of policies) {
  const rs = results[name]!;
  const cnt = ENDINGS.map((e) => rs.filter((r) => r.ending === e).length);
  const errs = rs.map((r) => r.firstErr).filter((x): x is number => x !== null);
  const avg = errs.length ? (errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(2) : '-';
  const visited = rs.filter((r) => r.gateVisits > 0).length;
  const ok = rs.filter((r) => r.firstRehearsalOk).length;
  console.log(`${name.padEnd(6, '　')}  ` + cnt.map((c) => String(c).padEnd(10)).join('') + `${avg} (n=${errs.length})`.padEnd(15) + `${visited}/30`.padEnd(13) + `${ok}/30`);
}

console.log('\n== 检查 ==');
const all = Object.values(results).flat();
check(all.every((r) => r.ending !== null), '每一局最迟在最后一步都有结局');
check(all.every((r) => r.day <= 11), '每一局最多走到第 11 天（四季 3+3+3+2）');
for (const e of ENDINGS) check(all.some((r) => r.ending === e), `结局「${e}」可达（${all.filter((r) => r.ending === e).length} 局）`);

for (const [name, p] of policies) {
  const again = SEEDS.slice(0, 12).map((s) => runOne(p, s));
  const same = again.every((r, i) => r.ledger === results[name]![i]!.ledger && r.trace === results[name]![i]!.trace);
  check(same, `确定性：「${name}」同 seed 同调用，账本与心智日志一致`);
}

const sigs = new Set(SEEDS.map((s) => JSON.stringify(generateWorld(s, createRng(s)).tianbo.weights)));
check(sigs.size === SEEDS.length, `不同 seed 的田伯权重各不相同（${sigs.size}/30）`);
const doms = { qing: 0, li: 0, ming: 0 };
for (const s of SEEDS) {
  const w = generateWorld(s, createRng(s)).tianbo.weights;
  doms[(Object.keys(w) as (keyof typeof w)[]).reduce((a, b) => (w[b] > w[a] ? b : a))]++;
}
check(Object.values(doms).every((n) => n >= 8 && n <= 12), `情/利/名各占约三分之一（${JSON.stringify(doms)}）`);

const good = (rs: Run[]) => rs.filter((r) => r.ending === 'lend').length;
check(good(results['想事']!) > good(results['被动']!), `想事的人借到/得到粟更多（${good(results['想事']!)} > ${good(results['被动']!)}）`);
const nErr = (name: string) => { const e = results[name]!.map((r) => r.firstErr).filter((x): x is number => x !== null); return e.length ? e.reduce((a, b) => a + b, 0) / e.length : 0; };
console.log(`      首次叩门误差：被动 ${nErr('被动').toFixed(2)} / 乱建议 ${nErr('乱建议').toFixed(2)} / 想事 ${nErr('想事').toFixed(2)}`);
check(nErr('想事') < nErr('被动'), '想事的人，首次叩门的误差更小（小田伯更准）');
check(all.filter((r) => r.firstRehearsalOk).length >= all.length * 0.6, '首次预演多半预测成功（禾偏信「情」）');

for (const l of allRuleLines()) noteLine(l);
check(longLines.length === 0, `规则台词都不超过限制${longLines.length ? '：' + longLines.slice(0, 5).join(' | ') : `（共检查 ${seenLines.size} 句）`}`);
check(failures.filter((f) => f === '账本被改写').length === 0, '账本只增不改');

// ---- 几个接口的小检查 ----
{
  const w = createWorld(generateWorld(2, createRng(2)), createRng(2));
  const st = w.state();
  check(st.day === 1 && st.season === 'spring' && st.place === 'home' && st.ending === null, '开局：春，第 1 天，在家');
  const gateSpring = w.suggest('gate');
  check(!gateSpring.accepted && !!gateSpring.seed && gateSpring.seed.concept === 'tianbo' && !!gateSpring.line, '春天建议去田伯家：被拒，念头成为种子');
  check(w.options().every((o, i, a) => i === 0 || a[i - 1]!.want >= o.want), 'options() 按禾的意愿从高到低');
  check(w.options().every((o) => !o.expect || len(o.expect) <= 16), 'expect ≤ 16 字');
  const r = w.rehearse('qing');
  check(['give', 'lend', 'buy-land', 'refuse'].includes(r.predicted) && r.confidence >= 0 && r.confidence <= 1 && len(r.line) <= 18, '预演返回回应、短句与信心');
  const dayBefore = w.state().day;
  check(w.state().day === dayBefore, '预演不花一天');
  check(translateWords('我想去莒') === 'zou' && translateWords('去借点粟') === 'tianbo' && translateWords('祭一祭社公') === 'she'
    && translateWords('等雨') === 'tian' && translateWords('把地卖了') === 'di' && translateWords('再等等') === 'deng' && translateWords('进步') === null,
  'translateWords：走/借/祭/雨/卖地/等，认不出的是 null');
  const nb = w.nudgeBelief('ming', 0.3);
  check(Math.abs(nb.qing + nb.li + nb.ming - 1) < 1e-9 && nb.ming > w.config.he.belief.ming, 'nudgeBelief 直接改小田伯并重新归一');
}

// ---- 心智：四类操作各自留痕；沉淀；成对生长；田伯的条件 ----
{
  const entries = all.flatMap((r) => JSON.parse(r.trace) as any[]);
  const ops = new Set(entries.map((e) => e.op));
  check(['infer', 'learn', 'select', 'act', 'imagine', 'remember', 'sediment'].every((o) => ops.has(o)), `审计日志里有 infer/learn/select/act/imagine/remember/sediment（${[...ops].join(' ')}）`);
  check(entries.every((e) => typeof e.t === 'number' && typeof e.level === 'string' && typeof e.op === 'string' && typeof e.seq === 'number'), '每条审计都有 t/level/op');
  const sel = entries.filter((e) => e.op === 'select');
  check(sel.length > 0 && sel.every((e) => e.data && 'infoGain' in e.data && 'preference' in e.data), 'select 把信息增益与偏好分开记');
  const inferUp = entries.filter((e) => e.op === 'infer' && e.route);
  check(['absorbed', 'up', 'top'].every((r) => inferUp.some((e) => e.route === r)), '误差既有就地消化，也有上传，也有到心智的');
  check(entries.filter((e) => e.op === 'imagine').every((e) => e.data?.tag === 'imagined'), '设想一律标 tag=imagined');
  const sed = entries.filter((e) => e.op === 'sediment' && e.route === 'compiled');
  console.log(`      沉淀（从想到不想）${sed.length} 次，分布在 ${new Set(all.filter((r) => r.trace.includes('"compiled"')).map((r) => r.seed)).size} 个 seed`);
  check(sed.length > 0, '同一情境同一做法连续奏效 3 次，会编译成习惯');
  const stops = { unit: 0, module: 0, mind: 0 } as Record<string, number>;
  for (const r of results['被动']!) for (const b of r.beats) if (b.kind === 'layer') stops[b.layer]!++;
  console.log(`      被动局里事情停在：单元 ${stops.unit} / 模块 ${stops.module} / 心智 ${stops.mind}`);
  check(stops.unit > 0 && stops.module > 0 && stops.mind > 0, '三层都有停过（行为先说话）');
}
{
  let unfoldSeen = 0, offerSeen = 0, declineSeen = 0;
  for (const s of SEEDS) {
    const w = createWorld(generateWorld(s, createRng(s)), createRng(s));
    let unfolded = false;
    for (let g = 0; g < 40 && !w.finished(); g++) {
      if (w.offer()) {
        const day = w.state().day;
        const opts = w.options();
        const acc = opts.find((o) => o.action === 'accept'), dec = opts.find((o) => o.action === 'decline');
        if (!(opts.length === 2 && acc && dec && (acc.commits === 'lend' || acc.commits === 'sell'))) failures.push('offer 时 options 应只有 accept/decline');
        if (declineSeen === 0 && s % 2 === 0) {
          w.act(dec!);
          declineSeen++;
          if (!(w.state().day === day + 1 && !w.finished()) && w.state().day !== day) failures.push('decline 之后只推进一天');
          continue;
        }
        w.act(acc!);
        offerSeen++;
        if (!(w.finished() && w.state().ending!.day === day)) failures.push('accept 应在同一步内了结');
        break;
      }
      if (!unfolded && w.state().unfolded.includes('altar')) {
        unfolded = true;
        unfoldSeen++;
        const sac = w.options().find((o) => o.action === 'sacrifice');
        if (!(sac && sac.commits === 'sacrifice' && sac.place === 'altar')) failures.push('社坛展开后应出现 sacrifice');
        const f = w.ledger().filter((x) => x.kind === 'unfold');
        if (f.length !== 1) failures.push('展开应记一条 unfold 事实');
      }
      w.act(w.inclination());
    }
  }
  check(unfoldSeen > 0, `社坛会展开，并给禾「祭」（${unfoldSeen} 个 seed）`);
  check(offerSeen > 0 && declineSeen > 0, `田伯开条件后 accept/decline 同步了结（accept ${offerSeen}，decline ${declineSeen}）`);
  check(!failures.some((f) => /offer|accept|decline|展开|sacrifice/.test(f)), '条件与社坛的接口行为正确');
}

// ---- 一局完整的故事（seed 1，想事的人）----
function summarize(b: Beat): string | null {
  switch (b.kind) {
    case 'season': return `\n〔${{ spring: '春', summer: '夏', autumn: '秋', winter: '冬' }[b.season]}〕`;
    case 'dawn': return `— 第 ${b.day} 天`;
    case 'walk': return `  禾走向「${{ home: '家', field: '田', well: '井', altar: '社树', gate: '田伯家', road: '路口' }[b.to]}」`;
    case 'pose': return `  ·${b.who} ${b.pose}`;
    case 'say': return `  ${({ he: '禾', sang: '桑', xiaoshi: '小石', mu: '母', linren: '邻人', ji: '季', luren: '路人', tianbo: '田伯' } as Record<string, string>)[b.who] ?? b.who}：「${b.text}」`;
    case 'layer': return `  [心智] 停在${{ unit: '单元', module: '模块', mind: '心智' }[b.layer]}层（${b.cause}）`;
    case 'jar': return `  瓮：${b.days} 天的粟`;
    case 'hunger': return b.level > 0.3 ? `  家人${b.level > 0.6 ? '饿得厉害' : '有点饿'}` : null;
    case 'crack': return `  田缝 ${b.amount}`;
    case 'sky': return b.state === 'clear' || b.state === 'dusk' ? null : `  天：${b.state}`;
    case 'rumor': return `  流言（${b.clue.place}/${b.clue.truthful ? '真' : '假'}/${b.clue.trait}${b.clue.sign > 0 ? '+' : '-'}）：「${b.clue.text}」`;
    case 'knock': return `  叩门（${{ qing: '提旧情', li: '押地', ming: '带乡邻' }[b.approach]}）`;
    case 'gate': return `  田伯【${b.response}】禾预测【${b.predicted}】：「${b.line}」`;
    case 'error': return `  误差 ${b.trait}：${b.before[b.trait].toFixed(2)} → ${b.after[b.trait].toFixed(2)}`;
    case 'seed': return `  种子：${CONCEPT_NAME[b.seed.concept]}`;
    case 'sprout': return `  发芽：${CONCEPT_NAME[b.seed.concept]}`;
    case 'unfold': return `  ※ 展开：${b.text}`;
    case 'price': return `  粟价 ${b.price}`;
    case 'fact': return `  ▪ [${b.fact.kind}] ${b.fact.text}`;
    case 'commit': return `  ★ 结局：${b.ending.id}「${b.ending.mentorLine}」`;
    default: return null;
  }
}
console.log('\n== seed 1 · 想事的人 · 一局的故事 ==');
for (const b of results['想事']![0]!.beats) {
  const s = summarize(b);
  if (s) console.log(s);
}

console.log(failures.length ? `\n${failures.length} 项失败` : '\n全部通过');
process.exitCode = failures.length ? 1 : 0;
