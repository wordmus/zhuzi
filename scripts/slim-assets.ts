import fs from 'node:fs';
import path from 'node:path';
import { convertPng } from '../director/pipeline/slim-plugin';
const root = process.cwd();
const records = [];
for (const relative of fs.readdirSync('assets/library', { recursive: true }).map(String).sort()) {
  const file = path.join(root, 'assets/library', relative);
  if (relative.endsWith('.png')) {
    const { webp, ...record } = convertPng(file, root);
    records.push({ ...record, use: relative.includes('/refs/') ? 'reference only (not bundled)' : relative.startsWith('three-') ? 'film (imported into all forms)' : 'gallery (imported into all forms)' });
  } else if (relative.endsWith('.glb')) {
    const bytes = fs.statSync(file).size;
    const data = fs.readFileSync(file);
    const jsonSize = data.readUInt32LE(12);
    const gltf = JSON.parse(data.toString('utf8', 20, 20 + jsonSize));
    records.push({ file: path.relative(root, file), before: bytes, after: bytes, mode: 'unchanged', use: 'east3d (imported into all forms)', jsonBytes: jsonSize, binaryBytes: bytes - 28 - jsonSize, extensionsRequired: gltf.extensionsRequired ?? [] });
  }
}
fs.mkdirSync('runs/desk/15/L1/checks', { recursive: true });
fs.writeFileSync('runs/desk/15/L1/checks/assets.json', JSON.stringify(records, null, 2));
for (const r of records) console.log(`${r.file} | ${r.before} → ${r.after} | ${r.mode}`);
console.log(`ASSETS ${records.length} · PNG ${records.filter(r => r.file.endsWith('.png')).length} · GLB ${records.filter(r => r.file.endsWith('.glb')).length}`);
