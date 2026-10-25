import { spawn } from 'node:child_process';
const processes = [spawn(process.execPath, ['--watch', '--env-file-if-exists=.env', 'server/index.js'], { stdio: 'inherit' }), spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'client/vite.config.js'], { stdio: 'inherit' })];
let closing = false;
function stop(code = 0) { if (closing) return; closing = true; for (const process of processes) process.kill('SIGTERM'); globalThis.process.exitCode = code; }
for (const child of processes) { child.on('exit', code => stop(code ?? 0)); child.on('error', error => { console.error(error.message); stop(1); }); }
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
