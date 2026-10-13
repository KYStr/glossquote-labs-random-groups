import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, copyFile, mkdir, mkdtemp, lstat, realpath, rm, readdir, symlink } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { PROJECT_ROOT, assertSafeRoot, within, validateBuild } from '../scripts/validation.mjs';
import { ORIGIN, expectedBuildContents, validateProductionContents, validateWorkersConfig, staticJson, buildAssets } from '../scripts/production.mjs';
import { buildProject } from '../scripts/build.mjs';
import { SOURCE_FILES, sourceManifest, crc32, decodeSourceZip, verifySourceZip, extractSourceZip, createSourceZip } from '../scripts/release.mjs';

const tempParent = path.join(PROJECT_ROOT, 'test/.tmp');
async function releaseFixture(t) {
  const ancestors = [PROJECT_ROOT, path.join(PROJECT_ROOT, 'test'), tempParent];
  for (let index = 0; index < ancestors.length; index += 1) {
    if (index) {
      await assertSafeRoot(ancestors[index - 1]);
      try { await mkdir(ancestors[index]); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    await assertSafeRoot(ancestors[index]);
  }
  const identities = await Promise.all(ancestors.map((ancestor) => lstat(ancestor, { bigint: true })));
  const directory = await mkdtemp(path.join(tempParent, 'release-'));
  await assertSafeRoot(directory);
  const identity = await lstat(directory, { bigint: true });
  const physical = await realpath(directory);
  const physicalParent = await realpath(tempParent);
  assert.ok(within(physicalParent, physical));
  t.after(async () => {
    for (let index = 0; index < ancestors.length; index += 1) {
      await assertSafeRoot(ancestors[index]);
      const fresh = await lstat(ancestors[index], { bigint: true });
      assert.equal(fresh.dev, identities[index].dev); assert.equal(fresh.ino, identities[index].ino);
    }
    await assertSafeRoot(directory);
    const fresh = await lstat(directory, { bigint: true });
    assert.equal(fresh.dev, identity.dev); assert.equal(fresh.ino, identity.ino);
    const resolved = await realpath(directory);
    assert.equal(resolved, physical); assert.ok(within(physicalParent, resolved)); assert.notEqual(resolved, physicalParent);
    await rm(resolved, { recursive: true });
  });
  const project = path.join(directory, 'project');
  for (const relative of SOURCE_FILES) {
    const destination = path.join(project, ...relative.split('/'));
    await mkdir(path.dirname(destination), { recursive: true });
    if (relative.endsWith('.md')) await writeFile(destination, '# Synthetic release fixture\n\nOnly fake test metadata.\n');
    else if (relative === 'project.json') await writeFile(destination, '{"id":"17-random-groups","sourceStatus":"candidate"}\n');
    else await copyFile(path.join(PROJECT_ROOT, ...relative.split('/')), destination);
  }
  return { directory, project };
}
async function sourceContents(project) {
  const map = new Map();
  for (const file of buildAssets('preview').filter((file) => file !== '_headers')) map.set(file, await readFile(path.join(project, 'public', file), 'utf8'));
  return map;
}
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
function git(project, args) { return execFileSync('git', args, { cwd: project, windowsHide: true, shell: false, stdio: 'pipe', timeout: 30000 }); }

test('M2: literal fixed bilingual canonical, reciprocal hreflang, x-default, visible JSON-LD and CSP hashes', async (t) => {
  const { project } = await releaseFixture(t);
  await buildProject(project, { mode: 'production' });
  const report = await validateBuild(project);
  assert.equal(report.status, 'PASS'); assert.equal(report.mode, 'production'); assert.equal(report.assetCount, 11);
  for (const [file, locale, name] of [['index.html', 'zh-Hant', '名單隨機分組'], ['en/index.html', 'en', 'Random group generator']]) {
    const html = await readFile(path.join(project, 'dist', file), 'utf8');
    assert.ok(html.includes(`<link rel="canonical" href="https://groups.glossquote.com/${file}">`));
    assert.ok(html.includes('<link rel="alternate" hreflang="zh-Hant" href="https://groups.glossquote.com/index.html">'));
    assert.ok(html.includes('<link rel="alternate" hreflang="en" href="https://groups.glossquote.com/en/index.html">'));
    assert.ok(html.includes('<link rel="alternate" hreflang="x-default" href="https://groups.glossquote.com/index.html">'));
    assert.ok(!html.includes('noindex') && !html.includes('Production Network/Storage'));
    const block = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/u)[1];
    const data = JSON.parse(block);
    assert.equal(data['@type'], 'WebApplication'); assert.equal(data.name, name); assert.equal(data.inLanguage, locale);
    assert.equal(data.url, 'https://groups.glossquote.com/' + file);
    assert.deepEqual(Object.keys(data), ['@context', '@type', 'name', 'description', 'url', 'inLanguage', 'applicationCategory']);
    const headers = await readFile(path.join(project, 'dist/_headers'), 'utf8');
    assert.ok(headers.includes(`'sha256-${createHash('sha256').update(block).digest('base64')}'`));
    assert.ok(headers.includes("connect-src 'none'") && headers.includes("worker-src 'none'"));
    assert.ok(!headers.includes('unsafe-inline') && !headers.includes('unsafe-eval'));
  }
  assert.equal(await readFile(path.join(project, 'dist/robots.txt'), 'utf8'), 'User-agent: *\nAllow: /\nSitemap: https://groups.glossquote.com/sitemap.xml\n');
  const sitemap = await readFile(path.join(project, 'dist/sitemap.xml'), 'utf8');
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]), ['https://groups.glossquote.com/index.html', 'https://groups.glossquote.com/en/index.html']);
  assert.equal(await readFile(path.join(project, 'dist/_redirects'), 'utf8'), '/ /index.html 301\n/en /en/index.html 301\n/en/ /en/index.html 301\n');
  const config = JSON.parse(await readFile(path.join(project, 'wrangler.jsonc'), 'utf8'));
  assert.equal(config.assets.html_handling, 'none'); assert.equal(config.assets.not_found_handling, '404-page');
  assert.equal(config.workers_dev, false); assert.equal(config.preview_urls, false); assert.equal(config.observability.enabled, false);
  assert.equal(config.main, undefined); assert.equal(config.routes[0].pattern, 'groups.glossquote.com');
  const notFound = await readFile(path.join(project, 'dist/404.html'), 'utf8');
  assert.ok(notFound.includes('href="/styles/app.css"') && notFound.includes('href="/index.html"') && notFound.includes('href="/en/index.html"'));
  assert.equal(validateWorkersConfig(config).assetsOnly, true);
});

test('M2: production mutation checks reject wrong canonical, hreflang, schema and CSP; preview never inherits sitemap', async (t) => {
  const { project } = await releaseFixture(t);
  const sources = await sourceContents(project);
  const good = expectedBuildContents(sources, 'production');
  for (const [replace, expected] of [
    [(map) => map.set('index.html', map.get('index.html').replace('rel="canonical" href="https://groups.glossquote.com/index.html"', 'rel="canonical" href="https://example.invalid/index.html"')), 'PRODUCTION_CANONICAL'],
    [(map) => map.set('en/index.html', map.get('en/index.html').replace('hreflang="x-default"', 'hreflang="fr"')), 'PRODUCTION_HREFLANG'],
    [(map) => map.set('index.html', map.get('index.html').replace('"@type":"WebApplication"', '"@type":"Product"')), 'PRODUCTION_JSONLD'],
    [(map) => map.set('_headers', map.get('_headers').replace(/'sha256-[^']+'/gu, '')), 'PRODUCTION_CSP_HASH']
  ]) {
    const mutated = new Map(good); replace(mutated);
    assert.throws(() => validateProductionContents(sources, mutated), { message: expected });
  }
  await buildProject(project, { mode: 'production' });
  await buildProject(project);
  const report = await validateBuild(project, 'preview'); assert.equal(report.assetCount, 9);
  const files = await readdir(path.join(project, 'dist')); assert.ok(!files.includes('sitemap.xml') && !files.includes('_redirects'));
  const html = await readFile(path.join(project, 'dist/index.html'), 'utf8');
  assert.ok(html.includes('noindex,nofollow') && !html.includes('rel="canonical"') && !html.includes('application/ld+json'));
  assert.ok((await readFile(path.join(project, 'dist/_headers'), 'utf8')).includes('X-Robots-Tag: noindex, nofollow'));
  assert.deepEqual(JSON.parse(staticJson({ name: '<>&\u2028\u2029' })), { name: '<>&\u2028\u2029' });
  assert.ok(!staticJson({ name: '<>' }).includes('<'));
  assert.equal(ORIGIN, 'https://groups.glossquote.com');
});

test('M2: source allowlist excludes unknown files, synthetic secret-like values and private machine metadata', async (t) => {
  const { project } = await releaseFixture(t);
  assert.equal((await sourceManifest(project, { publicCopy: true })).fileCount, 38);
  await mkdir(path.join(project, '.wrangler'));
  await writeFile(path.join(project, '.wrangler/cache.json'), '{"synthetic":"local CLI cache"}');
  const withoutCache = await sourceManifest(project, { publicCopy: true });
  assert.equal(withoutCache.fileCount, 38);
  assert.ok(withoutCache.files.every((file) => !file.path.startsWith('.wrangler/')));
  await writeFile(path.join(project, 'unexpected.txt'), 'SYNTHETIC_UNKNOWN');
  await assert.rejects(sourceManifest(project), { message: 'SOURCE_NOT_ALLOWLISTED' });
  const second = await releaseFixture(t);
  await writeFile(path.join(second.project, 'README.md'), 'github_pat_' + 'X'.repeat(40));
  await assert.rejects(sourceManifest(second.project), { message: 'SOURCE_SECRET_PATTERN' });
  const third = await releaseFixture(t);
  await writeFile(path.join(third.project, 'README.md'), ['C:', 'Users', 'Synthetic', 'private'].join('/'));
  await assert.rejects(sourceManifest(third.project, { publicCopy: true }), { message: 'SOURCE_PRIVATE_MACHINE_METADATA' });
  const fourth = await releaseFixture(t);
  const syntheticOutside = path.join(fourth.directory, 'synthetic-cache');
  await mkdir(syntheticOutside);
  await writeFile(path.join(syntheticOutside, 'sentinel.txt'), 'CACHE_LINK_SENTINEL');
  await symlink(syntheticOutside, path.join(fourth.project, '.wrangler'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(sourceManifest(fourth.project), { message: 'UNSAFE_DIRECTORY' });
  assert.equal(await readFile(path.join(syntheticOutside, 'sentinel.txt'), 'utf8'), 'CACHE_LINK_SENTINEL');
});

test('M2: native Git archive ZIP matches every Git blob and restores the standalone production build', async (t) => {
  const { directory, project } = await releaseFixture(t);
  git(project, ['init', '-b', 'main']);
  git(project, ['add', '--', ...SOURCE_FILES]);
  git(project, ['-c', 'user.name=Synthetic Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=.git/disabled-hooks', 'commit', '-m', 'Synthetic fixed source']);
  const { snapshot, archive } = await createSourceZip(project);
  const decoded = decodeSourceZip(archive, snapshot.commit);
  const mismatches = snapshot.files.filter((file) => sha256(decoded.files.get(file.path)) !== file.sha256)
    .map((file) => ({ path: file.path, blobBytes: file.bytes, archiveBytes: decoded.files.get(file.path).length,
      archiveCrLf: (decoded.files.get(file.path).toString('utf8').match(/\r\n/gu) || []).length }));
  assert.deepEqual(mismatches, [], 'Archive contents must be byte-identical to Git blobs');
  const report = verifySourceZip(archive, snapshot);
  assert.equal(report.status, 'PASS'); assert.equal(report.blobCount, 38); assert.equal(report.archiveSha256, sha256(archive));
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const restored = path.join(directory, 'restored');
  await extractSourceZip(archive, snapshot, restored, directory);
  for (const file of snapshot.files) assert.equal(sha256(await readFile(path.join(restored, file.path))), file.sha256);
  await buildProject(restored, { mode: 'production' });
  assert.equal((await validateBuild(restored)).status, 'PASS');
  await assert.rejects(extractSourceZip(archive, snapshot, restored, directory), { message: 'ZIP_DESTINATION_EXISTS' });
  await assert.rejects(extractSourceZip(archive, snapshot, directory, directory), { message: 'ZIP_DESTINATION_OUTSIDE_PARENT' });
  assert.throws(() => decodeSourceZip(archive, '0'.repeat(40)), { message: 'ZIP_COMMIT_COMMENT' });
  const tampered = Buffer.from(archive); const central = tampered.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  tampered.writeUInt32LE(0xa1ff0000, central + 38);
  assert.throws(() => decodeSourceZip(tampered), { message: 'ZIP_LINK_OR_MODE' });
});
