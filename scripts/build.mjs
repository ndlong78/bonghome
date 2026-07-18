import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const ignored = new Set(['.git', '.github', 'dist', 'node_modules', 'playwright-report', 'test-results', 'tests', 'scripts', 'package-lock.json']);
const versionSource = process.env.GITHUB_SHA || process.env.CACHE_VERSION || `local-${Date.now()}`;
const cacheVersion = `bonghome-${versionSource.slice(0, 12)}`;

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (ignored.has(entry.name)) continue;
  await cp(path.join(root, entry.name), path.join(dist, entry.name), { recursive: true });
}

const swPath = path.join(dist, 'sw.js');
const sw = await readFile(swPath, 'utf8');
if (!sw.includes('__CACHE_VERSION__')) throw new Error('sw.js thiếu token __CACHE_VERSION__');
await writeFile(swPath, sw.replaceAll('__CACHE_VERSION__', cacheVersion));
await writeFile(path.join(dist, 'version.json'), JSON.stringify({ cacheVersion, source: versionSource, builtAt: new Date().toISOString() }, null, 2));

console.log(`Built dist with cache version: ${cacheVersion}`);
