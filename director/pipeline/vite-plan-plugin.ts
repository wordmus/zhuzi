// 让应用只从「呈现方案」运行：virtual:plan 模块就是导演产出的 plan.json。
// dev：按 ZHUZI_INTENT / ZHUZI_SEED / ZHUZI_TIER 现场让导演出方案（改了导演规则即刻可见）。
// build：由 present CLI 先写好 plan.json，再用 ZHUZI_PLAN 指向它，产物里嵌入的就是那一份。

import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const VIRTUAL = 'virtual:plan';
const RESOLVED = '\0virtual:plan';

export function planPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: 'zhuzi-plan',
    configResolved(cfg) {
      root = cfg.root;
    },
    resolveId(id) {
      if (id === VIRTUAL) return RESOLVED;
      return null;
    },
    async load(id) {
      if (id !== RESOLVED) return null;
      const planPath = process.env.ZHUZI_PLAN;
      if (planPath) {
        const json = fs.readFileSync(path.resolve(root, planPath), 'utf8');
        return `export default ${json};`;
      }
      // dev：现场出方案
      const { directFromFiles } = await import('./director-node.ts');
      const plan = await directFromFiles({
        root,
        intentPath: process.env.ZHUZI_INTENT ?? 'intents/first-visit.json',
        seed: Number(process.env.ZHUZI_SEED ?? 1),
        tier: (process.env.ZHUZI_TIER as any) ?? 'L1',
      });
      // 让 dev server 在导演规则、意图、时代包变动时重新出方案
      for (const dir of ['intents', 'director/seed-memory', 'eras/zhanguo']) {
        const abs = path.resolve(root, dir);
        if (!fs.existsSync(abs)) continue;
        for (const f of fs.readdirSync(abs)) if (f.endsWith('.json')) this.addWatchFile(path.join(abs, f));
      }
      return `export default ${JSON.stringify(plan)};`;
    },
  };
}
