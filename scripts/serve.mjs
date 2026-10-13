import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ASSETS, MIME, PROJECT_ROOT, assertNodeVersion, inspectAssets, assertSafeFile, requireCondition, isMain, safeFailure } from './validation.mjs';

const PREVIEW_HEADERS = Object.freeze({
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
});

export function requestAsset(url) {
  if (typeof url !== 'string' || url.length > 4096) return null;
  const rawPath = url.split('?')[0];
  if (!rawPath.startsWith('/') || rawPath.startsWith('//') || /%(?:2f|5c)/iu.test(rawPath)) return null;
  let decoded;
  try { decoded = decodeURIComponent(rawPath); } catch { return null; }
  if (/[\\\u0000-\u001f\u007f#]/u.test(decoded) || decoded.split('/').some((part) => part.startsWith('.'))) return null;
  const relative = decoded === '/' ? 'index.html' : decoded === '/en/' ? 'en/index.html' : decoded.slice(1);
  return ASSETS.includes(relative) ? relative : null;
}

export async function startPreview({ root = PROJECT_ROOT, port = 4197, fallbackOnConflict = false } = {}) {
  assertNodeVersion();
  requireCondition(Number.isInteger(port) && port >= 0 && port <= 65535, 'INVALID_PORT');
  const publicRoot = path.join(root, 'public');
  await inspectAssets(publicRoot);
  const server = http.createServer({ maxHeaderSize: 8192 }, async (request, response) => {
    for (const [name, value] of Object.entries(PREVIEW_HEADERS)) response.setHeader(name, value);
    const finish = (status, text, headers = {}) => {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
      response.end(request.method === 'HEAD' ? undefined : text);
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') { finish(405, 'Method not allowed\n', { Allow: 'GET, HEAD' }); return; }
    if (request.headers['transfer-encoding'] || Number(request.headers['content-length'] || 0) !== 0) { finish(400, 'Request body not accepted\n'); return; }
    const asset = requestAsset(request.url);
    if (!asset) { finish(404, 'Not found\n'); return; }
    try {
      await assertSafeFile(publicRoot, asset);
      const body = await readFile(path.join(publicRoot, ...asset.split('/')));
      response.writeHead(200, { 'Content-Type': MIME[path.extname(asset)], 'Content-Length': body.length });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { finish(404, 'Not found\n'); }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 1000;
  async function bind(targetPort) {
    await new Promise((resolve, reject) => {
      const failed = (error) => { server.removeListener('listening', ready); reject(error); };
      const ready = () => { server.removeListener('error', failed); resolve(); };
      server.once('error', failed);
      server.once('listening', ready);
      server.listen(targetPort, '127.0.0.1');
    });
  }
  try { await bind(port); }
  catch (error) {
    if (error.code === 'EADDRINUSE' && fallbackOnConflict && port !== 0) await bind(0);
    else throw error;
  }
  const actualPort = server.address().port;
  return { server, port: actualPort, url: `http://127.0.0.1:${actualPort}` };
}

if (isMain(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    requireCondition(args.length === 0 || (args.length === 2 && args[0] === '--port' && /^[0-9]{1,5}$/u.test(args[1])), 'INVALID_ARGUMENT');
    const port = args.length ? Number(args[1]) : 4197;
    const { server, url } = await startPreview({ port, fallbackOnConflict: true });
    console.log(JSON.stringify({ status: 'READY', mode: 'preview', host: '127.0.0.1', url, pid: process.pid }));
    const stop = () => server.close(() => { process.exitCode = 0; });
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) { console.error(safeFailure(error)); process.exitCode = 1; }
}
