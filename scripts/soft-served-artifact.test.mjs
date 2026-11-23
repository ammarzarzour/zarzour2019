// Verify that the EXACT seven-file Zarzour Soft release works when served as
// an independent static site; no real network endpoint, database, or login.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { softFiles } from './build-soft-standalone.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'zarzour-soft');
const permitted = new Set(softFiles);
let server;
let origin;

async function sendAsset(request, response) {
  let pathname;
  try { pathname = new URL(request.url, 'http://localhost').pathname; }
  catch { response.writeHead(400).end(); return; }
  // Simulate either a separate site's root or a separate hosting subpath.
  if (pathname.startsWith('/standalone-soft/')) pathname = pathname.slice('/standalone-soft/'.length);
  else pathname = pathname.slice(1);
  const name = pathname || 'index.html';
  if (!permitted.has(name)) { response.writeHead(404).end('Not found in independent Soft artifact'); return; }
  try {
    const content = await readFile(path.join(root, name));
    response.writeHead(200, {
      'Content-Type': name.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(content);
  } catch { response.writeHead(500).end('Missing packaged asset'); }
}

before(async () => {
  server = createServer((request, response) => { void sendAsset(request, response); });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
});

test('real independent release has exactly the seven allowlisted source-matching files', async () => {
  assert.deepEqual((await readdir(root)).sort(), [...softFiles].sort());
  for (const name of softFiles) {
    const actual = await readFile(path.join(root, name));
    const source = await readFile(path.resolve(root, '..', '..', 'docs', 'soft', name));
    assert.deepEqual(actual, source, 'release bytes differ from audited source for ' + name);
  }
});

test('all pages and browser modules are accessible at a separate static host root', async () => {
  for (const name of softFiles) {
    const response = await fetch(origin + '/' + name);
    assert.equal(response.status, 200, name);
    assert.match(response.headers.get('content-type'), name.endsWith('.html') ? /text\/html/ : /text\/javascript/);
    assert.equal((await response.arrayBuffer()).byteLength, (await readFile(path.join(root, name))).byteLength);
  }
  const homepage = await fetch(origin + '/');
  assert.equal(homepage.status, 200);
  assert.equal(await homepage.text(), await readFile(path.join(root, 'index.html'), 'utf8'));
});

test('independent site also resolves its exact relative pages from a subpath', async () => {
  for (const name of ['index.html', 'brief.html', 'projects.html', 'brief.mjs', 'projects-model.mjs']) {
    const response = await fetch(origin + '/standalone-soft/' + name);
    assert.equal(response.status, 200, name);
    assert.equal(await response.text(), await readFile(path.join(root, name), 'utf8'));
  }
  const index = await (await fetch(origin + '/standalone-soft/')).text();
  for (const href of ['brief.html', 'projects.html']) {
    assert.ok(index.includes('href="' + href + '"'));
    assert.equal((await fetch(new URL(href, origin + '/standalone-soft/'))).status, 200);
  }
});

test('travel screens, API routes, arbitrary files and missing scripts are not served', async () => {
  for (const url of [
    '/dashboard.html', '/bookings.html', '/soft/private.json', '/api/orders',
    '/standalone-soft/../dashboard.html', '/standalone-soft/dashboard.html',
    '/standalone-soft/secret.env', '/standalone-soft/unknown.mjs'
  ]) {
    const response = await fetch(origin + url);
    assert.equal(response.status, 404, url);
  }
});

test('the standalone browser modules make no Travel or remote runtime requests', async () => {
  for (const name of softFiles) {
    const content = await readFile(path.join(root, name), 'utf8');
    assert.doesNotMatch(content, /\b(?:fetch\s*\(|XMLHttpRequest\b|WebSocket\b|sendBeacon\s*\()/i, name);
    assert.doesNotMatch(content, /<\s*(?:iframe|base)\b/i, name);
    assert.doesNotMatch(content, /(?:^|["'])\/(?:api|travel|dashboard)/i, name);
  }
});
