// Run existing checks against the new build without writing into protected old runs.
// NODE_OPTIONS="--import ./scripts/slim-check-hooks.mjs" node frameworks/desk/verify-entry.mjs
import { registerHooks } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const evidence = path.join(root, 'runs/desk/15/L1/checks');
fs.mkdirSync(evidence, { recursive: true });
// Bench writes a global report/history unconditionally; redirect only those two outputs.
const redirect = p => typeof p === 'string' && ['bench/report.json', 'bench/history.csv'].some(s => p === path.join(root, s)) ? path.join(evidence, path.basename(p)) : p;
for (const name of ['writeFileSync', 'appendFileSync']) {
  const original = fs[name];
  fs[name] = (p, ...args) => original(redirect(p), ...args);
}
registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (/\/frameworks\/desk\/verify-(entry|schedule|activity)\.mjs$/.test(url)) {
      // No assertions are changed: only the chosen build/evidence directory.
      return { ...result, source: String(result.source).replaceAll('runs/desk/11/L1', 'runs/desk/15/L1').replaceAll('runs/desk/13/L1', 'runs/desk/15/L1')
        .replaceAll("path.join(run, 'shots')", "path.join(run, 'check-shots')")
        .replaceAll('runs/desk/15/L1/shots', 'runs/desk/15/L1/check-shots') };
    }
    if (/\/frameworks\/east3d\/idle\.test\.ts$/.test(url)) {
      return { ...result, source: String(result.source).replace("'docs/3d-design/east-suburb/evidence'", "'runs/east-suburb-3d/5/L3/idle-evidence'") };
    }
    return result;
  },
});
