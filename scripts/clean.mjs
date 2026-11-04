import { rm } from 'node:fs/promises';
// Fixed generated paths, resolved relative to this repository on every OS.
for (const directory of ['dist', 'coverage']) {
  await rm(new URL('../' + directory + '/', import.meta.url), { recursive: true, force: true });
}
console.log('Removed generated build and coverage output.');
