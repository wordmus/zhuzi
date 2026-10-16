import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { Plugin } from 'vite';

// node_modules/ is already ignored, and Vite cannot clear this cache with outDir.
// The encoder version + settings + source bytes form the key.
export function convertPng(file: string, root: string) {
  const source = fs.readFileSync(file);
  const hardEdge = /shelf-gallery[/\\]plates[/\\]0[1-6]-/.test(file);
  const settings = hardEdge
    ? ['-near_lossless', '90', '-q', '100', '-m', '6', '-exact']
    : ['-q', '82', '-m', '6', '-alpha_q', '100', '-exact'];
  const version = execFileSync('cwebp', ['-version'], { encoding: 'utf8' }).trim();
  const key = createHash('sha256').update(source).update(JSON.stringify({ version, settings })).digest('hex');
  const cache = path.join(root, 'node_modules', '.cache', 'zhuzi-slim');
  fs.mkdirSync(cache, { recursive: true });
  const output = path.join(cache, `${key}.webp`);
  const cached = fs.existsSync(output);
  if (!cached) {
    const temp = `${output}.${process.pid}.tmp`;
    try {
      execFileSync('cwebp', ['-quiet', ...settings, file, '-o', temp], { stdio: 'pipe' });
      fs.renameSync(temp, output);
    } finally { fs.rmSync(temp, { force: true }); }
  }
  const webp = fs.readFileSync(output);
  if (webp.toString('ascii', 0, 4) !== 'RIFF' || webp.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`Invalid WebP: ${file}`);
  return { file: path.relative(root, file), before: source.length, after: webp.length, mode: hardEdge ? 'near-lossless 90' : 'lossy q82 / alpha100', key, cached, version, webp };
}

export function slimPlugin(): Plugin {
  let root = process.cwd();
  let saved = 0, count = 0, hits = 0;
  return {
    name: 'zhuzi-inline-webp', enforce: 'pre', apply: 'build',
    configResolved(config) { root = config.root; },
    load(id) {
      if (process.env.ZHUZI_SLIM === '0') return null; // reproducible PNG control builds only
      const file = id.split('?')[0]!;
      if (!file.endsWith('.png') || /[?&](raw|worker|sharedworker)(?:&|$)/.test(id)) return null;
      const result = convertPng(file, root);
      count++; saved += result.before - result.after; hits += Number(result.cached);
      return `export default ${JSON.stringify(`data:image/webp;base64,${result.webp.toString('base64')}`)};`;
    },
    buildEnd() {
      if (count) console.log(`slim   ${count} PNG → inline WebP · ${hits} cache hits · saved ${(saved / 1e6).toFixed(2)} MB raw`);
    },
  };
}
