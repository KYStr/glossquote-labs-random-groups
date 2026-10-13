import { createHash } from 'node:crypto';

export const ORIGIN = 'https://groups.glossquote.com';
export const BASE_ASSETS = Object.freeze([
  'index.html', 'en/index.html', '404.html', 'styles/app.css', 'js/app.mjs', 'js/i18n.mjs', 'js/core/random-groups.mjs', 'robots.txt'
]);
export const PAGES = Object.freeze([
  { path: 'index.html', locale: 'zh-Hant', ogLocale: 'zh_TW', alternate: 'en_US', title: '名單隨機分組', category: 'UtilitiesApplication' },
  { path: 'en/index.html', locale: 'en', ogLocale: 'en_US', alternate: 'zh_TW', title: 'Random group generator', category: 'UtilitiesApplication' }
]);
export const GENERATED_ASSETS = Object.freeze(['_headers', '_redirects', 'sitemap.xml']);
export const ALL_BUILD_ASSETS = Object.freeze([...BASE_ASSETS, ...GENERATED_ASSETS]);
export class ProductionError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function requireProduction(condition, code) { if (!condition) throw new ProductionError(code); }
export function buildAssets(mode = 'preview') {
  requireProduction(mode === 'preview' || mode === 'production', 'BUILD_MODE_INVALID');
  return mode === 'production' ? ALL_BUILD_ASSETS : [...BASE_ASSETS, '_headers'];
}
export function staticJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/gu, (character) =>
    ({ '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029' })[character]);
}
export function createMetadata(html, page) {
  const description = html.match(/<meta name="description" content="([^"]+)">/u)?.[1];
  requireProduction(typeof description === 'string' && description.length >= 40, 'PRODUCTION_DESCRIPTION');
  const url = ORIGIN + '/' + page.path;
  return {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: page.title,
    description, url, inLanguage: page.locale, applicationCategory: page.category
  };
}
export function productionHtml(html, page) {
  requireProduction(html.includes('<meta name="robots" content="noindex,nofollow">') &&
    (html.match(/<\/head>/gu) || []).length === 1, 'PRODUCTION_TEMPLATE');
  requireProduction(!/rel="(?:canonical|alternate)"|application\/ld\+json/u.test(html), 'PRODUCTION_TEMPLATE');
  const metadata = createMetadata(html, page);
  const json = staticJson(metadata);
  const fragment = [
    `  <link rel="canonical" href="${metadata.url}">`,
    `  <link rel="alternate" hreflang="zh-Hant" href="${ORIGIN}/index.html">`,
    `  <link rel="alternate" hreflang="en" href="${ORIGIN}/en/index.html">`,
    `  <link rel="alternate" hreflang="x-default" href="${ORIGIN}/index.html">`,
    '  <meta property="og:type" content="website">',
    '  <meta property="og:site_name" content="GlossQuote">',
    `  <meta property="og:title" content="${metadata.name}">`,
    `  <meta property="og:description" content="${metadata.description}">`,
    `  <meta property="og:url" content="${metadata.url}">`,
    `  <meta property="og:locale" content="${page.ogLocale}">`,
    `  <meta property="og:locale:alternate" content="${page.alternate}">`,
    `  <script type="application/ld+json">${json}</script>`
  ].join('\n') + '\n';
  return html.replace('<meta name="robots" content="noindex,nofollow">', '<meta name="robots" content="index,follow">')
    .replace('</head>', fragment + '</head>');
}
export function headersFor(mode, hashes = []) {
  const hashSources = hashes.map((hash) => ` 'sha256-${hash}'`).join('');
  const csp = `default-src 'none'; script-src 'self'${hashSources}; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
  const lines = [
    '/*',
    `  Content-Security-Policy: ${csp}`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: no-referrer',
    '  X-Frame-Options: DENY',
    '  Cross-Origin-Resource-Policy: same-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), clipboard-read=()'
  ];
  if (mode === 'preview') lines.push('  X-Robots-Tag: noindex, nofollow', '  Cache-Control: no-store');
  else lines.push('', '/404.html', '  X-Robots-Tag: noindex, nofollow', '', 'https://:worker.:subdomain.workers.dev/*', '  X-Robots-Tag: noindex, nofollow');
  return lines.join('\n') + '\n';
}
export function expectedBuildContents(sources, mode = 'preview') {
  buildAssets(mode);
  const output = new Map(BASE_ASSETS.map((file) => [file, sources.get(file)]));
  requireProduction([...output.values()].every((value) => typeof value === 'string'), 'PRODUCTION_SOURCE_MISSING');
  if (mode === 'production') {
    const hashes = [];
    for (const page of PAGES) {
      const html = productionHtml(output.get(page.path), page);
      output.set(page.path, html);
      const json = html.match(/<script type="application\/ld\+json">([^<]*)<\/script>/u)[1];
      hashes.push(createHash('sha256').update(json).digest('base64'));
    }
    output.set('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
    output.set('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      PAGES.map((page) => `  <url><loc>${ORIGIN}/${page.path}</loc></url>`).join('\n') + '\n</urlset>\n');
    output.set('_redirects', '/ /index.html 301\n/en /en/index.html 301\n/en/ /en/index.html 301\n');
    output.set('_headers', headersFor(mode, hashes));
  } else output.set('_headers', headersFor(mode));
  return output;
}

export function validateProductionContents(sources, output) {
  requireProduction(output.size === ALL_BUILD_ASSETS.length && ALL_BUILD_ASSETS.every((file) => output.has(file)), 'PRODUCTION_ASSET_SET');
  for (const page of PAGES) {
    const html = output.get(page.path);
    const url = ORIGIN + '/' + page.path;
    requireProduction(html.includes(`<html lang="${page.locale}">`) && html.includes(`<h1>${page.title}</h1>`), 'PRODUCTION_LANGUAGE');
    requireProduction(!/noindex|nofollow/u.test(html), 'PRODUCTION_NOINDEX');
    requireProduction((html.match(/rel="canonical"/gu) || []).length === 1 && html.includes(`rel="canonical" href="${url}"`), 'PRODUCTION_CANONICAL');
    const alternatives = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/gu)].map((match) => [match[1], match[2]]);
    requireProduction(JSON.stringify(alternatives) === JSON.stringify([
      ['zh-Hant', ORIGIN + '/index.html'], ['en', ORIGIN + '/en/index.html'], ['x-default', ORIGIN + '/index.html']
    ]), 'PRODUCTION_HREFLANG');
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/gu)];
    requireProduction(blocks.length === 1, 'PRODUCTION_JSONLD');
    const metadata = JSON.parse(blocks[0][1]);
    requireProduction(JSON.stringify(metadata) === JSON.stringify(createMetadata(sources.get(page.path), page)), 'PRODUCTION_JSONLD');
    requireProduction(!/aggregateRating|"review"|unsafe-inline|unsafe-eval/u.test(html), 'PRODUCTION_UNPROVEN_CLAIM');
    const hash = createHash('sha256').update(blocks[0][1]).digest('base64');
    requireProduction(output.get('_headers').includes(`'sha256-${hash}'`), 'PRODUCTION_CSP_HASH');
    const home = page.locale === 'en' ? 'https://glossquote.com/en/index.html' : 'https://glossquote.com/index.html';
    requireProduction(html.includes(`href="${home}"`), 'PRODUCTION_HOME_LINK');
    requireProduction(!/Production Network\/Storage|正式 Network\/Storage/u.test(html), 'PRODUCTION_INTERNAL_COPY');
  }
  const expected = expectedBuildContents(sources, 'production');
  for (const [file, content] of expected) requireProduction(output.get(file) === content, 'PRODUCTION_OUTPUT_MISMATCH');
  requireProduction(!/unsafe-inline|unsafe-eval/u.test(output.get('_headers')) &&
    output.get('_headers').split('\n').every((line) => line.length <= 2000), 'PRODUCTION_HEADERS');
  return { status: 'PASS', mode: 'production', origin: ORIGIN, canonicalUrls: PAGES.map((page) => ORIGIN + '/' + page.path) };
}

export function validateWorkersConfig(config) {
  const expected = {
    name: 'glossquote-random-groups', compatibility_date: '2026-10-13', workers_dev: false, preview_urls: false,
    assets: { directory: './dist', html_handling: 'none', not_found_handling: '404-page', run_worker_first: false },
    observability: { enabled: false, logs: { enabled: false }, traces: { enabled: false } },
    routes: [{ pattern: 'groups.glossquote.com', custom_domain: true }]
  };
  requireProduction(JSON.stringify(config) === JSON.stringify(expected), 'PRODUCTION_WORKERS_CONFIG');
  return { status: 'PASS', worker: expected.name, target: 'groups.glossquote.com', assetsOnly: true };
}
