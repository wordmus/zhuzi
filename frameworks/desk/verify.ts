import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, [new URL('./verify-entry.mjs', import.meta.url).pathname], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
