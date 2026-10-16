import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifyEntry } from './verify-entry-path.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const builds = ['desk/15/L1', 'three-look-at-sky/3/L2', 'shelf-gallery/3/L2', 'east-suburb-3d/5/L3'];
for (const build of builds) {
  const dir = path.join(root, 'runs', build), html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const bytes = Buffer.byteLength(html);
  assert(bytes <= 12_000_000, `${build}: ${bytes} exceeds 12 MB`);
  const png = [...html.matchAll(/data:image\/png;base64,/g)].length;
  const webp = [...html.matchAll(/data:image\/webp;base64,/g)].length;
  assert(webp >= 13 && png === 0, `${build}: PNG ${png}, WebP ${webp}`);
  // Verify actual resource references, allowing ordinary navigation links between works.
  assert(!/<(?:script|img|source|video|audio|iframe)\b[^>]*\bsrc\s*=\s*["'](?!data:|#|https?:|\/\/|blob:)[^"']+["']/i.test(html), 'local resource sidecar');
  assert(!/<link\b[^>]*\bhref\s*=\s*["'](?!data:|#|https?:|\/\/)[^"']+["']/i.test(html), 'local stylesheet sidecar');
  assert(!/url\(\s*["']?(?!data:|#)[./][^)]*\)/i.test(html), 'external CSS URL');
  assert.equal(fs.readFileSync(path.join(dir, 'build/index.html'), 'utf8'), html);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'build')).sort(), ['index.html'], 'build contains exactly one file');
  const plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json'), 'utf8'));
  const [intent, seed, tier] = build.split('/');
  assert.equal(plan.intent.id, intent); assert.equal(plan.seed, Number(seed)); assert.equal(plan.tier, tier);
  console.log(`SLIM PASS · ${build} · ${bytes} bytes (${(bytes / 1e6).toFixed(3)} MB) · PNG ${png} / WebP ${webp} · single HTML`);
}
verifyEntry(root);
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'scripts/slim-baseline.json'), 'utf8'));
const groups = {};
for (const group of ['runs/studio/5', 'runs/fifty-years/9', 'runs/desk/13']) {
  const actual = fs.readdirSync(path.join(root, group), { recursive: true }).map(String)
    .filter(f => fs.statSync(path.join(root, group, f)).isFile()).map(f => `${group}/${f}`).sort();
  assert.deepEqual(actual, Object.keys(baseline.files).filter(f => f.startsWith(group + '/')).sort(), `old file list changed: ${group}`);
}
for (const [file, expected] of Object.entries(baseline.files)) {
  const content = fs.readFileSync(path.join(root, file));
  assert.equal(content.length, expected.bytes, `old bytes changed: ${file}`);
  assert.equal(createHash('sha256').update(content).digest('hex'), expected.sha256, `old SHA changed: ${file}`);
  const group = file.startsWith('assets/') ? 'assets/library' : file.split('/').slice(0, 3).join('/');
  groups[group] = (groups[group] ?? 0) + 1;
}
for (const [group, count] of Object.entries(groups)) console.log(`SHA PASS · ${group} · ${count} files byte-identical`);
console.log('SLIM ALL PASS · 4 builds ≤12 MB · inline WebP · stable entry · protected old files unchanged');
