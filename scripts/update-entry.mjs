import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function updateEntry({ root, intent, seed, tier, runDir }) {
  if (intent !== 'desk') return;
  let html = path.join(runDir, 'index.html');
  const expected = path.join(root, 'runs', 'desk', String(seed), tier, 'index.html');
  // A custom --out preview must not replace the permanent public entry.
  if (path.resolve(html) !== path.resolve(expected)) return;
  // Rebuilding an older seed must not move the permanent link backwards.
  const desk = path.join(root, 'runs', 'desk');
  const candidates = fs.readdirSync(desk).filter(s => /^\d+$/.test(s)).flatMap(s =>
    fs.readdirSync(path.join(desk, s)).filter(t => /^L[0-4]$/.test(t) && fs.existsSync(path.join(desk, s, t, 'index.html')))
      .map(t => ({ seed: Number(s), tier: t })));
  candidates.sort((a, b) => b.seed - a.seed || Number(b.tier === tier) - Number(a.tier === tier) || b.tier.localeCompare(a.tier));
  const latest = candidates[0];
  if (latest && latest.seed > seed) {
    seed = latest.seed; tier = latest.tier;
    html = path.join(desk, String(seed), tier, 'index.html');
  }
  const builtAt = fs.statSync(html).mtime.toISOString();
  const dir = path.join(root, 'runs', 'entry');
  fs.mkdirSync(dir, { recursive: true });
  const url = `../desk/${seed}/${tier}/index.html`;
  const metadata = { intent, seed, tier, builtAt, sizeBytes: fs.statSync(html).size };
  const page = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${url}"><title>进入案上</title><style>body{margin:12vh 10%;background:#191510;color:#e9ddc5;font:20px serif}small{font-size:14px}a{color:inherit}</style><p>正在进入…</p><small>若未自动跳转，<a href="${url}">点这里进入案上</a></small></html>\n`;
  for (const [name, content] of [['entry.json', JSON.stringify(metadata, null, 2) + '\n'], ['index.html', page]]) {
    fs.writeFileSync(path.join(dir, `${name}.tmp`), content);
    fs.renameSync(path.join(dir, `${name}.tmp`), path.join(dir, name));
  }
  console.log(`entry  runs/entry/index.html → ${url} · ${metadata.sizeBytes} bytes`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed, tier = 'L1'] = process.argv.slice(2);
  if (!seed || !Number.isFinite(Number(seed)) || !/^L[0-4]$/.test(tier)) throw new Error('Usage: node scripts/update-entry.mjs <desk seed> [tier]');
  const root = fileURLToPath(new URL('../', import.meta.url));
  updateEntry({ root, intent: 'desk', seed: Number(seed), tier, runDir: path.join(root, 'runs', 'desk', seed, tier) });
}
