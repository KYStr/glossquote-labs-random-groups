import { readFile, readdir, lstat, realpath, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { ASSETS, PROJECT_ROOT, assertSafeRoot, within, requireCondition, isMain, safeFailure } from './validation.mjs';

export const SOURCE_FILES = Object.freeze([
  '.gitignore', 'package.json', 'wrangler.jsonc',
  ...ASSETS.map((file) => 'public/' + file),
  ...['build', 'check', 'serve', 'validation', 'production', 'release'].map((file) => `scripts/${file}.mjs`),
  ...['app', 'random-groups', 'scaffold', 'release'].map((file) => `test/${file}.test.mjs`),
  ...['README.md', 'START-HERE.md', 'PRODUCT.md', 'TECHNICAL.md', 'UX-SEO.md', 'ACCEPTANCE.md', 'TASKS.md', 'TASK-ENTRY.md', 'AGENTS.md', 'HANDOFF.md', 'project.json'],
  ...['BRAND', 'ENGINEERING', 'PRIVACY-SECURITY', 'DESIGN-SYSTEM', 'RELEASE', 'RELEASE-CANDIDATE'].map((file) => `docs/${file}.md`)
].sort());
const knownDirectories = new Set(SOURCE_FILES.flatMap((file) => {
  const parts = file.split('/'); return parts.slice(0, -1).map((_part, index) => parts.slice(0, index + 1).join('/'));
}));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const comparable = (value) => process.platform === 'win32' ? value.toLowerCase() : value;
const samePath = (one, two) => comparable(path.resolve(one)) === comparable(path.resolve(two));

async function safeSourceFile(root, relative) {
  requireCondition(SOURCE_FILES.includes(relative), 'SOURCE_NOT_ALLOWLISTED');
  let directory = root;
  await assertSafeRoot(directory);
  for (const part of relative.split('/').slice(0, -1)) { directory = path.join(directory, part); await assertSafeRoot(directory); }
  const file = path.join(root, ...relative.split('/'));
  requireCondition(within(root, file), 'SOURCE_OUTSIDE_ROOT');
  const stat = await lstat(file);
  requireCondition(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 250000, 'UNSAFE_SOURCE_FILE');
  return file;
}
export async function sourceManifest(root = PROJECT_ROOT, { publicCopy = false } = {}) {
  await assertSafeRoot(root);
  const found = [];
  async function visit(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      const full = path.join(directory, entry.name);
      if (['.git', 'dist', '.wrangler', 'test/.tmp'].includes(relative)) {
        await assertSafeRoot(full);
        continue;
      }
      const stat = await lstat(full);
      requireCondition(!stat.isSymbolicLink(), 'UNSAFE_SOURCE_FILE');
      if (stat.isDirectory()) {
        requireCondition(knownDirectories.has(relative), 'UNKNOWN_SOURCE_DIRECTORY');
        await assertSafeRoot(full); await visit(full, relative + '/');
      } else {
        await safeSourceFile(root, relative); found.push(relative);
      }
    }
  }
  await visit(root);
  requireCondition(found.length === SOURCE_FILES.length && SOURCE_FILES.every((file) => found.includes(file)), 'SOURCE_FILE_SET');
  const files = [];
  for (const relative of SOURCE_FILES) {
    const bytes = await readFile(await safeSourceFile(root, relative));
    const text = bytes.toString('utf8');
    requireCondition(!/\b(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{32,})\b/u.test(text), 'SOURCE_SECRET_PATTERN');
    if (publicCopy) {
      requireCondition(!/C:[/\\]Users[/\\]|\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/iu.test(text), 'SOURCE_PRIVATE_MACHINE_METADATA');
    }
    files.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
  }
  return { status: 'PASS', publicCopy, fileCount: files.length, sourceSha256: sha256(JSON.stringify(files)), files };
}

function git(root, args, encoding) {
  return execFileSync('git', args, { cwd: root, encoding, windowsHide: true, shell: false, maxBuffer: 5000000, timeout: 30000 });
}
export async function gitSnapshot(root) {
  await assertSafeRoot(root);
  await assertSafeRoot(path.join(root, '.git'));
  requireCondition(samePath(git(root, ['rev-parse', '--show-toplevel'], 'utf8').trim(), await realpath(root)), 'GIT_ROOT_MISMATCH');
  const commit = git(root, ['rev-parse', 'HEAD'], 'utf8').trim();
  requireCondition(/^[0-9a-f]{40}$/u.test(commit), 'GIT_COMMIT_INVALID');
  const entries = git(root, ['ls-tree', '-r', '-z', '--full-tree', 'HEAD'], 'utf8').split('\0').filter(Boolean);
  const files = [];
  for (const entry of entries) {
    const match = entry.match(/^(100644) blob ([0-9a-f]{40})\t(.+)$/u);
    requireCondition(match && SOURCE_FILES.includes(match[3]), 'GIT_SOURCE_TREE');
    const bytes = git(root, ['cat-file', 'blob', match[2]]);
    requireCondition(bytes.length <= 250000, 'GIT_BLOB_TOO_LARGE');
    files.push({ path: match[3], bytes: bytes.length, sha256: sha256(bytes), blob: match[2] });
  }
  files.sort((one, two) => one.path < two.path ? -1 : one.path > two.path ? 1 : 0);
  requireCondition(files.length === SOURCE_FILES.length && files.every((file, index) => file.path === SOURCE_FILES[index]), 'GIT_SOURCE_TREE');
  return { commit, files };
}

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function safeArchivePath(name, directory) {
  requireCondition(name.length <= 4096 && !/[\\:\u0000-\u001f\u007f]/u.test(name) && !name.startsWith('/') &&
    !name.split('/').some((part) => part === '..' || part === '.'), 'ZIP_UNSAFE_PATH');
  requireCondition(directory ? knownDirectories.has(name.slice(0, -1)) : SOURCE_FILES.includes(name), 'ZIP_UNKNOWN_PATH');
}
export function decodeSourceZip(archive, expectedCommit = null) {
  requireCondition(Buffer.isBuffer(archive) && archive.length >= 22 && archive.length <= 5000000, 'ZIP_SIZE');
  let end = -1;
  for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65557); offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50 && offset + 22 + archive.readUInt16LE(offset + 20) === archive.length) { end = offset; break; }
  }
  requireCondition(end >= 0, 'ZIP_END');
  requireCondition(archive.readUInt16LE(end + 4) === 0 && archive.readUInt16LE(end + 6) === 0 &&
    archive.readUInt16LE(end + 8) === archive.readUInt16LE(end + 10), 'ZIP_MULTIDISK');
  const count = archive.readUInt16LE(end + 10);
  const centralSize = archive.readUInt32LE(end + 12);
  const centralStart = archive.readUInt32LE(end + 16);
  requireCondition(count <= 1000 && centralStart + centralSize === end, 'ZIP_CENTRAL');
  const comment = archive.subarray(end + 22).toString('utf8');
  if (expectedCommit !== null) requireCondition(comment === expectedCommit, 'ZIP_COMMIT_COMMENT');
  const files = new Map(); const seen = new Set();
  let cursor = centralStart; let totalSize = 0;
  for (let index = 0; index < count; index += 1) {
    requireCondition(cursor + 46 <= end && archive.readUInt32LE(cursor) === 0x02014b50, 'ZIP_CENTRAL_ENTRY');
    const flags = archive.readUInt16LE(cursor + 8); const method = archive.readUInt16LE(cursor + 10);
    const creatorSystem = archive.readUInt16LE(cursor + 4) >>> 8;
    const checksum = archive.readUInt32LE(cursor + 16); const compressed = archive.readUInt32LE(cursor + 20);
    const size = archive.readUInt32LE(cursor + 24); const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30); const commentLength = archive.readUInt16LE(cursor + 32);
    const attributes = archive.readUInt32LE(cursor + 38); const localOffset = archive.readUInt32LE(cursor + 42);
    requireCondition(cursor + 46 + nameLength + extraLength + commentLength <= end, 'ZIP_CENTRAL_ENTRY');
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    const directory = name.endsWith('/'); safeArchivePath(name, directory);
    requireCondition(!seen.has(name), 'ZIP_DUPLICATE_PATH'); seen.add(name);
    const mode = (attributes >>> 16) & 0o170000;
    const normalDosEntry = creatorSystem === 0 && attributes === (directory ? 16 : 0);
    const normalUnixEntry = creatorSystem === 3 && mode === (directory ? 0o040000 : 0o100000);
    requireCondition(normalDosEntry || normalUnixEntry, 'ZIP_LINK_OR_MODE');
    requireCondition((flags & ~0x0808) === 0 && (method === 0 || method === 8) && size <= 250000, 'ZIP_METHOD_OR_SIZE');
    totalSize += size; requireCondition(totalSize <= 5000000, 'ZIP_EXPANDED_SIZE');
    requireCondition(localOffset + 30 <= centralStart && archive.readUInt32LE(localOffset) === 0x04034b50, 'ZIP_LOCAL_ENTRY');
    const localNameLength = archive.readUInt16LE(localOffset + 26); const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const localData = localOffset + 30 + localNameLength + localExtraLength;
    requireCondition(localData + compressed <= centralStart && archive.readUInt16LE(localOffset + 6) === flags &&
      archive.readUInt16LE(localOffset + 8) === method &&
      archive.subarray(localOffset + 30, localOffset + 30 + localNameLength).toString('utf8') === name, 'ZIP_LOCAL_ENTRY');
    let bytes;
    try { bytes = method === 0 ? archive.subarray(localData, localData + compressed) : inflateRawSync(archive.subarray(localData, localData + compressed), { maxOutputLength: 250000 }); }
    catch { requireCondition(false, 'ZIP_DECOMPRESSION'); }
    requireCondition(bytes.length === size && crc32(bytes) === checksum, 'ZIP_CRC_OR_SIZE');
    if (directory) requireCondition(size === 0, 'ZIP_DIRECTORY_CONTENT'); else files.set(name, bytes);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  requireCondition(cursor === end && files.size === SOURCE_FILES.length && SOURCE_FILES.every((file) => files.has(file)), 'ZIP_FILE_SET');
  return { files, comment };
}
export function verifySourceZip(archive, snapshot) {
  const decoded = decodeSourceZip(archive, snapshot.commit);
  for (const file of snapshot.files) {
    const bytes = decoded.files.get(file.path);
    requireCondition(bytes.length === file.bytes && sha256(bytes) === file.sha256, 'ZIP_GIT_BLOB_MISMATCH');
  }
  return { status: 'PASS', commit: snapshot.commit, archiveBytes: archive.length, archiveSha256: sha256(archive), blobCount: snapshot.files.length };
}
export async function createSourceZip(root) {
  const snapshot = await gitSnapshot(root);
  // Git archive applies working-tree conversion unless it is disabled for this process.
  const archive = git(root, ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', 'archive', '--format=zip', snapshot.commit]);
  const report = verifySourceZip(archive, snapshot);
  return { archive, snapshot, report };
}
export async function extractSourceZip(archive, snapshot, destination, parentRoot) {
  verifySourceZip(archive, snapshot);
  await assertSafeRoot(parentRoot);
  destination = path.resolve(destination); parentRoot = path.resolve(parentRoot);
  requireCondition(within(parentRoot, destination), 'ZIP_DESTINATION_OUTSIDE_PARENT');
  const parent = path.dirname(destination);
  requireCondition(samePath(parentRoot, parent), 'ZIP_DESTINATION_PARENT');
  try { await lstat(destination); requireCondition(false, 'ZIP_DESTINATION_EXISTS'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(destination);
  await assertSafeRoot(destination);
  const decoded = decodeSourceZip(archive, snapshot.commit);
  for (const [relative, bytes] of decoded.files) {
    const target = path.join(destination, ...relative.split('/'));
    requireCondition(within(destination, target), 'ZIP_UNSAFE_PATH');
    let directory = destination;
    for (const part of relative.split('/').slice(0, -1)) {
      const child = path.join(directory, part);
      await assertSafeRoot(directory);
      try { await mkdir(child); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      await assertSafeRoot(child); directory = child;
    }
    await writeFile(target, bytes, { flag: 'wx' });
  }
  return { status: 'PASS', destination, fileCount: decoded.files.size };
}

if (isMain(import.meta.url)) {
  try {
    requireCondition(process.argv.length === 2, 'INVALID_ARGUMENT');
    console.log(JSON.stringify(await sourceManifest(), null, 2));
  } catch (error) { console.error(safeFailure(error)); process.exitCode = 1; }
}
