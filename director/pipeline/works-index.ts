import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plan, Tier, WorkEntry } from '../../engine/types';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (file: string, fallback: any) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
const dirs = (dir: string) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort() : [];

/** Only runs/index.json is written. A missing HTML is explicitly represented by null. */
export function buildWorksIndex(root = ROOT, seed = 2, tier: Tier = 'L1', write = true): WorkEntry[] {
  const runs = path.join(root, 'runs');
  const base = path.join(runs, 'desk', String(seed), tier);
  const works: WorkEntry[] = [];
  for (const intent of dirs(runs)) for (const runSeed of dirs(path.join(runs, intent))) for (const runTier of dirs(path.join(runs, intent, runSeed))) {
    if (!/^L[0-4]$/.test(runTier)) continue;
    const dir = path.join(runs, intent, runSeed, runTier);
    const plan = read(path.join(dir, 'plan.json'), null) as Plan | null;
    if (!plan?.intent?.id || !plan.intent.form || !Number.isFinite(plan.seed)) continue;
    if (plan.intent.id !== intent || String(plan.seed) !== runSeed || plan.tier !== runTier) throw new Error(`run 与方案不一致：${dir}`);
    const report = read(path.join(dir, 'report.json'), {});
    const layers = read(path.join(dir, 'layers.json'), {});
    const ledger = read(path.join(dir, 'ledger.json'), []);
    const raw = Array.isArray(ledger) && ledger.length ? ledger : (layers.letters ?? []).filter((l: any) => l.kind === 'report').flatMap((l: any) => l.payload?.facts ?? []);
    const facts = [...new Map<string, WorkEntry['facts'][number]>(raw.filter((f: any) => typeof f?.text === 'string').map((f: any, i: number) => [String(f.id ?? `fact-${i}`), { id: String(f.id ?? `fact-${i}`), text: f.text, kind: String(f.kind ?? 'event') }])).values()];
    const delivered = (layers.letters ?? []).some((l: any) => l.kind === 'retro' && l.receipt);
    const html = path.join(dir, 'index.html');
    const url = fs.existsSync(html) ? path.relative(base, html).split(path.sep).map(encodeURIComponent).join('/') : null;
    if (url && !fs.existsSync(path.resolve(base, decodeURIComponent(url)))) throw new Error(`URL 不存在：${url}`);
    works.push({ intent, title: plan.intent.title, form: plan.intent.form, tier: plan.tier, seed: plan.seed,
      url, director: plan.director.id, sealed: !!(report.play?.done && delivered && !(layers.check?.length)), facts,
      version: plan.version, madeAt: report.when ?? fs.statSync(path.join(dir, 'plan.json')).mtime.toISOString() });
  }
  works.sort((a, b) => a.intent.localeCompare(b.intent, 'en') || a.seed - b.seed || a.tier.localeCompare(b.tier));
  if (write) { fs.mkdirSync(runs, { recursive: true }); fs.writeFileSync(path.join(runs, 'index.json'), JSON.stringify(works, null, 2) + '\n'); }
  return works;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const works = buildWorksIndex();
  for (const w of works) console.log(`${w.intent}/${w.seed}/${w.tier} · ${w.form} · ${w.sealed ? '盖印' : '毛坯'} · ${w.url ? `URL EXISTS ${w.url}` : '这件还没开门'}`);
  console.log(`works-index PASS · ${works.length} 件 · ${works.filter(w => w.url).length} 个真实入口 · runs/index.json`);
}
