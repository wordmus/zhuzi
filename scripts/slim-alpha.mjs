import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
const { convertPng } = await tsImport('../director/pipeline/slim-plugin.ts', import.meta.url);
const { launch } = await tsImport('../bench/lib.ts', import.meta.url);
const root = process.cwd(), browser = await launch(), page = await browser.newPage();
try {
  const probe = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const x = c.getContext('2d'), p = x.createImageData(32, 32);
    for (let n = 0; n < 1024; n++) p.data.set([128, 64, 32, n % 256], n * 4);
    x.putImageData(p, 0, 0); return c.toDataURL();
  });
  const probePath = path.join(root, 'node_modules/.cache/zhuzi-slim/alpha-probe.png');
  fs.writeFileSync(probePath, Buffer.from(probe.split(',')[1], 'base64'));
  const inputs = JSON.parse(fs.readFileSync('runs/desk/15/L1/checks/assets.json')).filter(r => r.file.endsWith('.png')).map(r => ({ file: r.file, webp: fs.readFileSync(`node_modules/.cache/zhuzi-slim/${r.key}.webp`) }));
  inputs.push({ file: 'node_modules/.cache/zhuzi-slim/alpha-probe.png', webp: convertPng(probePath, root).webp });
  const results = [];
  for (const { file, webp } of inputs) {
    const result = await page.evaluate(async ({ png, webp }) => {
      const read = async src => { const i = new Image(); i.src = src; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return { width: c.width, height: c.height, pixels: x.getImageData(0, 0, c.width, c.height).data }; };
      const a = await read(png), b = await read(webp); let delta = 0, nonOpaque = 0;
      for (let i = 3; i < a.pixels.length; i += 4) { delta = Math.max(delta, Math.abs(a.pixels[i] - b.pixels[i])); nonOpaque += Number(a.pixels[i] < 255); }
      return { width: a.width, height: a.height, sameDimensions: a.width === b.width && a.height === b.height, alphaMaxDelta: delta, nonOpaquePixels: nonOpaque };
    }, { png: 'data:image/png;base64,' + fs.readFileSync(file).toString('base64'), webp: 'data:image/webp;base64,' + webp.toString('base64') });
    assert(result.sameDimensions, file); assert.equal(result.alphaMaxDelta, 0, file); results.push({ file, ...result });
    console.log(`ALPHA PASS ${file} · ${result.width}×${result.height} · alpha max delta 0 · ${result.nonOpaquePixels} non-opaque pixels`);
  }
  fs.writeFileSync('runs/desk/15/L1/checks/alpha.json', JSON.stringify(results, null, 2));
} finally { await browser.close(); }
