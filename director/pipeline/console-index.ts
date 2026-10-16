import fs from 'node:fs';
import path from 'node:path';

export interface ConsoleWorkEntry {
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

export function generateConsoleWorksIndex(repoRoot = process.cwd()): ConsoleWorkEntry[] {
  const runsDir = path.join(repoRoot, 'runs');
  const consoleRunDir = path.join(runsDir, 'console', '2', 'L1');
  const works: ConsoleWorkEntry[] = [];

  if (!fs.existsSync(runsDir)) {
    return [];
  }

  const formNames: Record<string, string> = {
    game: '游戏',
    film: '动画',
    gallery: '图集',
    vignette: '短章',
  };

  // Scan all runs/<intent>/<seed>/<tier>/plan.json
  const candidateRuns: {
    intent: string;
    seed: number;
    tier: string;
    dir: string;
    planPath: string;
    hasHtml: boolean;
    factsCount: number;
  }[] = [];

  for (const intentName of fs.readdirSync(runsDir)) {
    if (intentName.startsWith('_') || intentName.startsWith('.') || intentName === 'console') continue;
    const intentDir = path.join(runsDir, intentName);
    if (!fs.statSync(intentDir).isDirectory()) continue;

    for (const seedStr of fs.readdirSync(intentDir)) {
      const seedDir = path.join(intentDir, seedStr);
      if (!fs.statSync(seedDir).isDirectory()) continue;

      for (const tierStr of fs.readdirSync(seedDir)) {
        const tierDir = path.join(seedDir, tierStr);
        if (!fs.statSync(tierDir).isDirectory()) continue;

        const planPath = path.join(tierDir, 'plan.json');
        if (fs.existsSync(planPath)) {
          const indexPath = path.join(tierDir, 'index.html');
          const hasHtml = fs.existsSync(indexPath);
          const ledgerPath = path.join(tierDir, 'ledger.json');
          let factsCount = 0;
          if (fs.existsSync(ledgerPath)) {
            try {
              const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
              factsCount = Array.isArray(ledger) ? ledger.length : 0;
            } catch (_) {}
          }
          candidateRuns.push({
            intent: intentName,
            seed: Number(seedStr) || 0,
            tier: tierStr,
            dir: tierDir,
            planPath,
            hasHtml,
            factsCount,
          });
        }
      }
    }
  }

  // Group by intent, picking the best run (with HTML, highest facts, seed)
  const grouped = new Map<string, typeof candidateRuns[0]>();
  for (const cand of candidateRuns) {
    const key = cand.intent;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, cand);
    } else {
      const score = (c: typeof cand) => (c.hasHtml ? 1000 : 0) + c.factsCount * 10 + c.seed;
      if (score(cand) > score(existing)) {
        grouped.set(key, cand);
      }
    }
  }

  // Sort canonical works: fifty-years first, then first-visit, then others
  const sortPriority = ['fifty-years', 'first-visit', 'east-suburb-3d', 'shelf-gallery', 'three-look-at-sky', 'studio', 'han-act1', 'mentor-desk'];
  const sortedCands = [...grouped.values()].sort((a, b) => {
    const ai = sortPriority.indexOf(a.intent);
    const bi = sortPriority.indexOf(b.intent);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.intent.localeCompare(b.intent);
  });

  for (const c of sortedCands) {
    try {
      const plan = JSON.parse(fs.readFileSync(c.planPath, 'utf8'));
      const intent = plan.intent ?? {};
      const formKey = intent.form || (plan.acts?.[0]?.framework) || 'vignette';
      const form = formNames[formKey] || formKey;
      const indexPath = path.join(c.dir, 'index.html');
      const hasHtml = fs.existsSync(indexPath);
      const url = hasHtml ? path.relative(consoleRunDir, indexPath) : null;
      const sealed = hasHtml;
      const status: '盖印' | '毛坯' = sealed ? '盖印' : '毛坯';
      const director = plan.director?.name || (intent.director === 'shuheng' ? '叔衡' : '基础导演');
      const title = intent.title || plan.id;
      const why = intent.target || intent.hypothesis?.text || '机器打磨的一件呈现';

      works.push({
        id: c.intent,
        intent: c.intent,
        title,
        form,
        formKey,
        tier: c.tier,
        seed: c.seed,
        status,
        sealed,
        director,
        facts: c.factsCount,
        url,
        why,
        notes: intent.notes,
      });
    } catch (err) {
      console.warn(`[console-index] error reading ${c.planPath}`, err);
    }
  }

  const outDir = path.join(repoRoot, 'assets', 'library', 'console');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'works.json');
  fs.writeFileSync(outFile, JSON.stringify(works, null, 2), 'utf8');
  console.log(`[console-index] 生成 ${works.length} 件作品索引 -> ${outFile}`);
  for (const w of works) {
    console.log(`  · ${w.title} (${w.form}·${w.tier}·seed ${w.seed}) [${w.status}] facts: ${w.facts} url: ${w.url ?? '无'}`);
  }

  return works;
}

if (process.argv[1] && (process.argv[1].endsWith('console-index.ts') || process.argv[1].endsWith('console-index.js'))) {
  generateConsoleWorksIndex();
}
