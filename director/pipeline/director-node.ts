// Node 侧：从文件读意图、时代包与导演种子记忆，交给纯函数 direct()。
import fs from 'node:fs';
import path from 'node:path';
import type { Intent, Plan, Tier } from '../../engine/types';
import { direct } from './director';
import type { DeskData } from './desk-plan';

export async function directFromFiles(o: { root: string; intentPath: string; seed: number; tier: Tier }): Promise<Plan> {
  const read = (p: string) => JSON.parse(fs.readFileSync(path.resolve(o.root, p), 'utf8'));
  const intent = read(o.intentPath) as Intent;
  const parts: Intent[] = (intent.compose ?? []).map((id) => read(`intents/${id}.json`) as Intent);
  const rulesPath = path.resolve(o.root, 'director/seed-memory/rules.json');
  const rules = fs.existsSync(rulesPath) ? JSON.parse(fs.readFileSync(rulesPath, 'utf8')) : { rules: [] };
  const runsIndexPath = path.resolve(o.root, 'runs/index.json');
  const runsIndex = fs.existsSync(runsIndexPath) ? JSON.parse(fs.readFileSync(runsIndexPath, 'utf8')) : null;
  let deskData: DeskData | undefined;
  if (intent.id === 'desk') {
    const works = Array.isArray(runsIndex) ? runsIndex : []; // Read-only snapshot; absent index stays empty.
    const historyPath = path.join(o.root, 'bench/history.csv');
    const historyRows = fs.existsSync(historyPath) ? fs.readFileSync(historyPath, 'utf8').split('\n').slice(1) : [];
    const history = ['base', 'shuheng'].flatMap(director => {
      const intents = works.filter(w => w.director === director).map(w => w.intent);
      const dates = historyRows.filter(row => intents.some(id => row.includes(`runs/${id}/`))).map(row => row.split(',')[0]!).filter(Boolean).sort();
      return dates.length ? [{ director, first: dates[0]!, latest: dates.at(-1)! }] : [];
    });
    deskData = { works, rules: rules.rules, history };
  }
  return direct({ intent, parts, seed: o.seed, tier: o.tier, rules, runsIndex, deskData });
}
