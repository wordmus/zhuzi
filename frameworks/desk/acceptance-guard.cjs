// 验收仍运行原命令，仅把边界外的报告副作用收进本次新 seed。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { syncBuiltinESMExports } = require('node:module');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'runs/desk/17/L1/acceptance');
const write = fs.writeFileSync.bind(fs), append = fs.appendFileSync.bind(fs);
const redirect = file => {
  if (typeof file !== 'string' && !(file instanceof URL)) return file;
  const full = path.resolve(String(file instanceof URL ? require('node:url').fileURLToPath(file) : file));
  const rel = path.relative(root, full);
  if (['bench/report.json', 'bench/history.csv', 'runs/fifty-years/9/L1/bench.json', 'runs/fifty-years/9/L1/curve.csv'].includes(rel)) {
    const target = path.join(output, rel); fs.mkdirSync(path.dirname(target), { recursive: true }); return target;
  }
  return file;
};
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const record = (file, target, expected) => {
  if (file === target) return;
  const row = { source: String(file), target, expectedSha256: digest(expected), actualSha256: digest(fs.readFileSync(target)) };
  append(path.join(output, 'redirect-audit.jsonl'), JSON.stringify(row) + '\n');
};
fs.writeFileSync = (file, data, ...args) => {
  const target = redirect(file); const result = write(target, data, ...args);
  if (file !== target) record(file, target, Buffer.isBuffer(data) ? data : Buffer.from(data, typeof args[0] === 'string' ? args[0] : args[0]?.encoding ?? 'utf8'));
  return result;
};
fs.appendFileSync = (file, data, ...args) => {
  const target = redirect(file); const before = file !== target && fs.existsSync(target) ? fs.readFileSync(target) : Buffer.alloc(0);
  const result = append(target, data, ...args);
  if (file !== target) record(file, target, Buffer.concat([before, Buffer.isBuffer(data) ? data : Buffer.from(data, typeof args[0] === 'string' ? args[0] : args[0]?.encoding ?? 'utf8')]));
  return result;
};
syncBuiltinESMExports();
