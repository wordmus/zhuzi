// Node 侧：从文件读意图、时代包与导演种子记忆，交给纯函数 direct()。
import fs from 'node:fs';
import path from 'node:path';
import type { Intent, Plan, Tier } from '../../engine/types';
import { direct } from './director';

export async function directFromFiles(o: { root: string; intentPath: string; seed: number; tier: Tier }): Promise<Plan> {
  const read = (p: string) => JSON.parse(fs.readFileSync(path.resolve(o.root, p), 'utf8'));
  const intent = read(o.intentPath) as Intent;
  const parts: Intent[] = (intent.compose ?? []).map((id) => read(`intents/${id}.json`) as Intent);
  const rulesPath = path.resolve(o.root, 'director/seed-memory/rules.json');
  const rules = fs.existsSync(rulesPath) ? JSON.parse(fs.readFileSync(rulesPath, 'utf8')) : { rules: [] };
  return direct({ intent, parts, seed: o.seed, tier: o.tier, rules });
}
