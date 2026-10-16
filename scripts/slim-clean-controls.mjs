// Remove only the disposable PNG controls created for the four P4 acceptance seeds.
import fs from 'node:fs';
const builds = ['desk/15/L1', 'three-look-at-sky/3/L2', 'shelf-gallery/3/L2', 'east-suburb-3d/5/L3'];
const summary = JSON.parse(fs.readFileSync('runs/desk/15/L1/checks/slimming-summary.json'));
let removedBytes = 0;
for (const build of builds) {
  if (!summary.builds.some(b => b.build === build)) throw new Error(`No recorded baseline for ${build}`);
  const dir = `runs/${build}/png-control`;
  for (const file of [`${dir}/index.html`, `${dir}/build/index.html`]) {
    if (fs.existsSync(file)) { removedBytes += fs.statSync(file).size; fs.rmSync(file); }
  }
  if (fs.existsSync(`${dir}/build`)) fs.rmdirSync(`${dir}/build`); // refuse to remove unexpected files
}
fs.writeFileSync('runs/desk/15/L1/checks/control-cleanup.json', JSON.stringify({ removedBytes, kept: 'exact plans, baseline sizes, before/after screenshots; slim-visual regenerates controls on demand' }, null, 2));
console.log(`CONTROL CLEANUP PASS · removed ${removedBytes} temporary bytes · plans and screenshots retained`);
