import { build } from 'esbuild';
import { readdir, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const filters = process.argv.slice(2);
const files = (await readdir('client/src/__tests__')).filter(f => f.endsWith('.test.jsx') && (!filters.length || filters.some(s => f.includes(s))));
if (!files.length) throw new Error('No matching client tests.');
await mkdir('.superpowers/client-tests', { recursive: true });
const outputs = [];
for (const file of files) {
  const output = `.superpowers/client-tests/${file.replace('.jsx', '.mjs')}`;
  await build({ entryPoints: [`client/src/__tests__/${file}`], outfile: output, bundle: true, packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic' });
  outputs.push(output);
}
const result = spawnSync(process.execPath, ['--test', ...outputs], { stdio: 'inherit' });
process.exit(result.status ?? 1);
