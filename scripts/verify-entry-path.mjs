import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export function verifyEntry(root = fileURLToPath(new URL('../', import.meta.url))) {
  const dir = path.join(root, 'runs', 'entry');
  const page = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert(Buffer.byteLength(page) <= 1024, 'entry redirect must be ≤1 KiB');
  const url = page.match(/content="0;url=([^"]+)"/)?.[1];
  assert(url && /^\.\.\/desk\/\d+\/L[0-4]\/index\.html$/.test(url));
  const [, seed, tier] = url.match(/desk\/(\d+)\/(L[0-4])/) ?? [];
  const target = path.resolve(dir, url);
  assert(fs.existsSync(target));
  const seeds = fs.readdirSync(path.join(root, 'runs', 'desk')).filter(s => /^\d+$/.test(s) && fs.readdirSync(path.join(root, 'runs', 'desk', s)).some(t => fs.existsSync(path.join(root, 'runs', 'desk', s, t, 'index.html')))).map(Number);
  assert.equal(Number(seed), Math.max(...seeds), 'entry must target latest desk seed');
  const metadata = JSON.parse(fs.readFileSync(path.join(dir, 'entry.json'), 'utf8'));
  assert.deepEqual(Object.keys(metadata).sort(), ['builtAt', 'intent', 'seed', 'sizeBytes', 'tier']);
  assert.equal(metadata.intent, 'desk'); assert.equal(metadata.seed, Number(seed)); assert.equal(metadata.tier, tier);
  assert.equal(metadata.sizeBytes, fs.statSync(target).size); assert(Number.isFinite(Date.parse(metadata.builtAt)));
  assert.equal(metadata.builtAt, fs.statSync(target).mtime.toISOString(), 'builtAt matches target build timestamp');
  console.log(`ENTRY PATH PASS · latest seed ${seed}/${tier} · ${Buffer.byteLength(page)} byte redirect · metadata matches ${metadata.sizeBytes} bytes`);
  return metadata;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) verifyEntry();
