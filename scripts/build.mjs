import { mkdir, readFile, writeFile, lstat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { ASSETS, PROJECT_ROOT, validateProject, inspectAssets, assertSafeFile, assertSafeRoot, requireCondition, within, isMain, safeFailure } from './validation.mjs';
import { ALL_BUILD_ASSETS, buildAssets, expectedBuildContents } from './production.mjs';

export async function buildProject(root = PROJECT_ROOT, { mode = 'preview' } = {}) {
  const report = await validateProject(root);
  const assets = buildAssets(mode);
  const source = path.join(root, 'public');
  const destination = path.join(root, 'dist');
  requireCondition(within(root, destination), 'OUTSIDE_DIRECTORY');
  // Inspect the entire destination before creating or replacing any output.
  const existing = await inspectAssets(destination, { optional: true, partial: true, assets: ALL_BUILD_ASSETS });
  const sources = new Map();
  for (const relative of ASSETS) sources.set(relative, await readFile(path.join(source, ...relative.split('/')), 'utf8'));
  const outputContents = expectedBuildContents(sources, mode);
  await mkdir(destination, { recursive: true });
  await assertSafeRoot(destination);
  for (const relative of existing.filter((file) => !assets.includes(file))) {
    await assertSafeFile(destination, relative, ALL_BUILD_ASSETS);
    const stale = path.join(destination, ...relative.split('/'));
    requireCondition(within(destination, stale), 'OUTSIDE_DIRECTORY');
    await unlink(stale); // Only known, validated generated mode assets; never recursively delete dist.
  }
  for (const relative of assets) {
    if (ASSETS.includes(relative)) await assertSafeFile(source, relative);
    const output = path.join(destination, ...relative.split('/'));
    const directory = path.dirname(output);
    requireCondition(within(destination, output), 'OUTSIDE_DIRECTORY');
    await mkdir(directory, { recursive: true });
    await assertSafeRoot(directory);
    try {
      const stat = await lstat(output);
      requireCondition(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, 'UNSAFE_FILE');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await writeFile(output, outputContents.get(relative), 'utf8');
  }
  await inspectAssets(destination, { assets });
  return { ...report, mode, output: 'dist', assetCount: assets.length };
}

if (isMain(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    requireCondition(args.length === 0 || (args.length === 1 && args[0] === '--production'), 'INVALID_ARGUMENT');
    console.log(JSON.stringify(await buildProject(PROJECT_ROOT, { mode: args.length ? 'production' : 'preview' }), null, 2));
  }
  catch (error) { console.error(safeFailure(error)); process.exitCode = 1; }
}
