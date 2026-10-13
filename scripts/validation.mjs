import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { BASE_ASSETS, ProductionError, buildAssets, expectedBuildContents, validateProductionContents, validateWorkersConfig } from './production.mjs';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ASSETS = BASE_ASSETS;
export const MIME = Object.freeze({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8' });
export class ValidationError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function requireCondition(condition, code) { if (!condition) throw new ValidationError(code); }
export function assertNodeVersion(version = process.versions.node) {
  requireCondition(/^\d+\./u.test(version) && Number(version.split('.')[0]) >= 24, 'NODE_24_REQUIRED');
}
export function isMain(moduleUrl) {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(moduleUrl);
}
export function safeFailure(error) {
  return error instanceof ValidationError || error instanceof ProductionError ? error.code : 'TOOLING_FAILED';
}
export function within(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
}
const comparable = (value) => process.platform === 'win32' ? value.toLowerCase() : value;
export async function assertSafeRoot(root, { optional = false } = {}) {
  try {
    const stat = await lstat(root);
    requireCondition(stat.isDirectory() && !stat.isSymbolicLink(), 'UNSAFE_DIRECTORY');
    requireCondition(comparable(await realpath(root)) === comparable(path.resolve(root)), 'UNSAFE_DIRECTORY');
    return true;
  } catch (error) {
    if (error.code === 'ENOENT' && optional) return false;
    throw error;
  }
}
export async function assertSafeFile(root, relative, assets = ASSETS) {
  requireCondition(assets.includes(relative), 'UNKNOWN_ASSET');
  await assertSafeRoot(root);
  let current = root;
  for (const part of relative.split('/').slice(0, -1)) {
    current = path.join(current, part);
    await assertSafeRoot(current);
  }
  const file = path.join(root, ...relative.split('/'));
  requireCondition(within(root, file), 'OUTSIDE_DIRECTORY');
  const stat = await lstat(file);
  requireCondition(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, 'UNSAFE_FILE');
  requireCondition(stat.size <= 250000, 'ASSET_TOO_LARGE');
  return stat;
}
export async function inspectAssets(root, { optional = false, partial = false, assets = ASSETS } = {}) {
  if (!await assertSafeRoot(root, { optional })) return [];
  const directories = new Set(assets.flatMap((file) => {
    const parts = file.split('/');
    return parts.slice(0, -1).map((_part, index) => parts.slice(0, index + 1).join('/'));
  }));
  const found = [];
  async function visit(directory, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const relative = prefix + entry.name;
      const file = path.join(directory, entry.name);
      const stat = await lstat(file);
      requireCondition(!stat.isSymbolicLink(), 'UNSAFE_FILE');
      if (stat.isDirectory()) {
        requireCondition(directories.has(relative), 'UNKNOWN_DIRECTORY');
        await assertSafeRoot(file);
        await visit(file, relative + '/');
      } else {
        requireCondition(assets.includes(relative), 'UNKNOWN_ASSET');
        await assertSafeFile(root, relative, assets);
        found.push(relative);
      }
    }
  }
  await visit(root);
  if (!partial) requireCondition(found.length === assets.length && assets.every((file) => found.includes(file)), 'MISSING_ASSET');
  return found.sort();
}

function localTarget(from, reference) {
  requireCondition(!/[?#\\]/u.test(reference), 'INVALID_LOCAL_REFERENCE');
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(from), reference));
  requireCondition(ASSETS.includes(target), 'BROKEN_LOCAL_REFERENCE');
  return target;
}

function validateHtml(source, file, locale) {
  requireCondition(source.includes(`<html lang="${locale}">`), 'HTML_LANGUAGE');
  requireCondition(/<meta name="robots" content="noindex,nofollow">/u.test(source), 'PREVIEW_NOINDEX_REQUIRED');
  requireCondition(!/<link[^>]+(?:canonical|alternate)|application\/ld\+json|sitemap/iu.test(source), 'PREVIEW_PRODUCTION_METADATA');
  requireCondition(/<meta name="description" content="[^"]{40,}">/u.test(source), 'HTML_DESCRIPTION');
  const title = locale === 'en' ? 'Random Group Generator | GlossQuote' : '名單隨機分組｜GlossQuote';
  requireCondition(source.includes(`<title>${title}</title>`), 'HTML_TITLE');
  const h1 = locale === 'en' ? 'Random group generator' : '名單隨機分組';
  requireCondition(source.includes(`<h1>${h1}</h1>`) && (source.match(/<h1>/gu) || []).length === 1, 'HTML_HEADING');
  requireCondition(!/<(?:form|iframe|object|embed|img|base)\b|\bon[a-z]+\s*=|\bstyle\s*=/iu.test(source), 'UNSAFE_HTML');
  requireCondition(!/maxlength\s*=/iu.test(source), 'INPUT_MUST_NOT_TRUNCATE');
  requireCondition(source.includes('<div id="workspace" hidden>') && /<noscript>[\s\S]+JavaScript[\s\S]+<\/noscript>/u.test(source), 'NOSCRIPT_REQUIRED');
  requireCondition((source.match(/<dt>/gu) || []).length === 6 && (source.match(/<dd>/gu) || []).length === 6, 'FAQ_REQUIRED');
  const expectedHome = locale === 'en' ? 'https://glossquote.com/en/index.html' : 'https://glossquote.com/index.html';
  const expectedLanguage = locale === 'en' ? '../index.html' : './en/index.html';
  requireCondition(source.includes(`href="${expectedHome}"`) && source.includes(`href="${expectedLanguage}"`), 'LANGUAGE_NAVIGATION');
  const scripts = [...source.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/giu)];
  requireCondition(scripts.length === 1 && /^<script type="module" src="[^"\s]+"><\/script>$/u.test(scripts[0][0]), 'MODULE_SCRIPT_REQUIRED');
  for (const match of source.matchAll(/<(a|link|script)\b[^>]*\b(href|src)="([^"]+)"[^>]*>/giu)) {
    const [, tag, , reference] = match;
    if (reference.startsWith('#')) { requireCondition(reference === '#main-content', 'INVALID_FRAGMENT'); continue; }
    if (/^(?:https?:)?\/\//u.test(reference)) {
      requireCondition(tag === 'a' && reference === expectedHome, 'EXTERNAL_REFERENCE');
    } else {
      localTarget(file, reference);
    }
  }
  requireCondition(source.includes('id="copy-text"') && /<textarea id="copy-text"[^>]*\breadonly\b/u.test(source), 'COPY_FALLBACK_REQUIRED');
  const ids = [...source.matchAll(/\bid="([^"]+)"/gu)].map((match) => match[1]);
  requireCondition(new Set(ids).size === ids.length, 'DUPLICATE_HTML_ID');
  for (const match of source.matchAll(/aria-(?:describedby|labelledby)="([^"]+)"/gu)) {
    requireCondition(match[1].split(' ').every((id) => ids.includes(id)), 'BROKEN_ARIA_REFERENCE');
  }
  return ids.sort();
}

export async function validateProject(root = PROJECT_ROOT) {
  assertNodeVersion();
  await assertSafeRoot(root);
  const packageFile = path.join(root, 'package.json');
  const packageStat = await lstat(packageFile);
  requireCondition(packageStat.isFile() && !packageStat.isSymbolicLink() && packageStat.nlink === 1 && packageStat.size < 20000, 'UNSAFE_PACKAGE');
  const pkg = JSON.parse(await readFile(packageFile, 'utf8'));
  requireCondition(pkg.private === true && pkg.type === 'module' && pkg.engines?.node === '>=24', 'PACKAGE_CONTRACT');
  requireCondition(!pkg.dependencies && !pkg.devDependencies && !pkg.optionalDependencies && !pkg.peerDependencies, 'ZERO_DEPENDENCIES_REQUIRED');
  const expectedScripts = {
    dev: 'node scripts/serve.mjs', test: 'node --test', check: 'node scripts/check.mjs', build: 'node scripts/build.mjs',
    'build:production': 'node scripts/build.mjs --production', 'check:production': 'node scripts/check.mjs --production', 'release:check': 'node scripts/release.mjs'
  };
  requireCondition(JSON.stringify(pkg.scripts) === JSON.stringify(expectedScripts), 'PACKAGE_SCRIPTS');
  const publicRoot = path.join(root, 'public');
  await inspectAssets(publicRoot);
  const sources = new Map();
  for (const file of ASSETS) sources.set(file, await readFile(path.join(publicRoot, ...file.split('/')), 'utf8'));
  const zhIds = validateHtml(sources.get('index.html'), 'index.html', 'zh-Hant');
  const enIds = validateHtml(sources.get('en/index.html'), 'en/index.html', 'en');
  requireCondition(JSON.stringify(zhIds) === JSON.stringify(enIds), 'BILINGUAL_CONTROL_PARITY');
  const notFound = sources.get('404.html');
  requireCondition(notFound.includes('<meta name="robots" content="noindex,nofollow">') &&
    notFound.includes('lang="en"') && notFound.includes('href="/index.html"') && notFound.includes('href="/en/index.html"') &&
    notFound.includes('href="/styles/app.css"') &&
    !/<(?:script|form|iframe|object|embed|img|base)\b|\bon[a-z]+\s*=|\bstyle\s*=/iu.test(notFound), '404_PAGE_CONTRACT');
  const forbidden = /\b(?:fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|serviceWorker|execCommand|innerHTML|outerHTML|insertAdjacentHTML)|\bMath\s*\.\s*random\b|\beval\s*\(|\bnew\s+Function\b|\.\s*(?:cookie|readText|read)\s*(?:\(|=)|\bcaches\s*\./u;
  for (const file of ASSETS.filter((name) => name.endsWith('.mjs'))) {
    const source = sources.get(file);
    requireCondition(!forbidden.test(source), 'UNSAFE_RUNTIME_API');
    requireCondition(!/\bimport\s*\(/u.test(source), 'DYNAMIC_RUNTIME_IMPORT');
    // Bounded static-reference scan: named/re-export specifiers and side-effect imports.
    // This scan is evidence about ordinary declarations, not a general JavaScript parser.
    for (const match of source.matchAll(/\b(?:from\s*|import\s*)(['"])([^'"\\\r\n]+)\1/gu)) {
      requireCondition(match[2].startsWith('./') || match[2].startsWith('../'), 'INVALID_MODULE_REFERENCE');
      localTarget(file, match[2]);
    }
    execFileSync(process.execPath, ['--check', path.join(publicRoot, ...file.split('/'))], { stdio: 'pipe', timeout: 10000 });
  }
  const app = sources.get('js/app.mjs');
  requireCondition(app.includes('generateGroups(') && !app.includes('generateGroupsWithUint32Source'), 'PRODUCTION_RANDOM_ENTRY');
  requireCondition(app.includes('copyRequestId') && app.includes('contentRevision') && app.includes("'pagehide'"), 'STATE_GUARDS_REQUIRED');
  const i18n = sources.get('js/i18n.mjs');
  for (const code of ['SOURCE_TOO_LONG', 'ROSTER_TOO_FEW', 'ROSTER_TOO_MANY', 'NAME_TOO_LONG', 'NAME_CONTROL', 'GROUP_COUNT_TOO_LONG', 'GROUP_COUNT_FORMAT', 'GROUP_COUNT_RANGE', 'INPUT_SCHEMA_INVALID', 'RANDOM_SOURCE_FAILED', 'COPY_FAILED']) {
    requireCondition((i18n.match(new RegExp('\\b' + code + ':', 'gu')) || []).length === 2, 'BILINGUAL_ERRORS_REQUIRED');
  }
  const css = sources.get('styles/app.css');
  requireCondition(!/@import|url\s*\(/iu.test(css) && css.includes(':focus-visible') && css.includes('prefers-reduced-motion') && css.includes('[hidden]'), 'CSS_CONTRACT');
  requireCondition(sources.get('robots.txt') === 'User-agent: *\nDisallow: /\n', 'PREVIEW_ROBOTS');
  const scriptRoot = path.join(root, 'scripts');
  await assertSafeRoot(scriptRoot);
  for (const file of ['validation.mjs', 'check.mjs', 'build.mjs', 'serve.mjs', 'production.mjs', 'release.mjs']) {
    const target = path.join(scriptRoot, file);
    const stat = await lstat(target);
    requireCondition(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, 'UNSAFE_SCRIPT');
    execFileSync(process.execPath, ['--check', target], { stdio: 'pipe', timeout: 10000 });
  }
  const configuration = path.join(root, 'wrangler.jsonc');
  const configStat = await lstat(configuration);
  requireCondition(configStat.isFile() && !configStat.isSymbolicLink() && configStat.nlink === 1 && configStat.size < 20000, 'UNSAFE_WORKERS_CONFIG');
  validateWorkersConfig(JSON.parse(await readFile(configuration, 'utf8')));
  return {
    status: 'PASS', mode: 'preview', node: process.versions.node,
    files: ASSETS.map((file) => ({ path: file, bytes: Buffer.byteLength(sources.get(file)), sha256: createHash('sha256').update(sources.get(file)).digest('hex') }))
  };
}

export async function validateBuild(root = PROJECT_ROOT, mode = 'production') {
  const sourceReport = await validateProject(root);
  const assets = buildAssets(mode);
  const destination = path.join(root, 'dist');
  await inspectAssets(destination, { assets });
  const sources = new Map();
  const output = new Map();
  for (const file of ASSETS) sources.set(file, await readFile(path.join(root, 'public', ...file.split('/')), 'utf8'));
  for (const file of assets) output.set(file, await readFile(path.join(destination, ...file.split('/')), 'utf8'));
  const expected = expectedBuildContents(sources, mode);
  if (mode === 'production') validateProductionContents(sources, output);
  else for (const [file, content] of expected) requireCondition(output.get(file) === content, 'PREVIEW_OUTPUT_MISMATCH');
  return {
    ...sourceReport, mode, output: 'dist', assetCount: assets.length,
    files: assets.map((file) => ({ path: file, bytes: Buffer.byteLength(output.get(file)), sha256: createHash('sha256').update(output.get(file)).digest('hex') }))
  };
}
