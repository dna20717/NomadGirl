#!/usr/bin/env node
// Browser test of the web workshop with the real worker code against a fake GitHub and a fake Cloudflare Access.
//   node tools/workshop_cloud_test.mjs [--images]   (builds dist/ first, images → output/cloud_*.png)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { handle } from '../worker/index.js';
import { fakeGitHub, fakeAccess, cloudFetch, testEnv } from '../test/fake_cloud.js';

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const images = process.argv.includes('--images');
execSync('node tools/build_web.mjs', { cwd: repo, stdio: 'ignore' });
const dist = path.join(repo, 'dist');

// fake repository = the real game data
const files = {};
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.json')) files[path.relative(repo, p)] = fs.readFileSync(p, 'utf8'); } };
walk(path.join(repo, 'projects/nomadgirl'));
const g = fakeGitHub(files), access = await fakeAccess();
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const assets = { fetch: async req => {
  let p = decodeURIComponent(new URL(req.url).pathname); if (p.endsWith('/')) p += 'index.html'; else if (!path.extname(p)) p += '.html';   // like Cloudflare: /workshop → workshop.html
  const f = path.join(dist, p);
  if (!f.startsWith(dist) || !fs.existsSync(f)) return new Response('not found', { status: 404 });
  return new Response(fs.readFileSync(f), { headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } });
} };
const env = testEnv(assets), fetchFn = cloudFetch(g, access);
const token = await access.token('daniel@example.com');

const server = http.createServer(async (q, res) => {
  const chunks = []; for await (const c of q) chunks.push(c);
  const headers = { ...q.headers, 'cf-access-jwt-assertion': token };   // what Cloudflare Access adds after the login
  const r = await handle(new Request('http://localhost' + q.url, { method: q.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined }), env, fetchFn);
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
});
await new Promise(ok => server.listen(0, ok));
const base = `http://localhost:${server.address().port}`;

let failed = 0;
const check = (ok, text) => { console.log(`  ${ok ? 'ok  ' : 'FEHLER'} ${text}`); if (!ok) failed++; };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && !/fonts\.googleapis|ERR_TUNNEL|net::ERR|status of 409/.test(m.text()) && errors.push(m.text()));
await page.goto(base + '/workshop?autosave=2');
await page.waitForSelector('.ng-user', { timeout: 20000 });
check((await page.textContent('.ng-user')).includes('Daniel'), 'angemeldet als Daniel (Name aus der E-Mail)');
check(await page.evaluate(() => window.workshop.store.kind === 'cloud'), 'Werkstatt nutzt den Cloudflare-Speicher');

// Name in the commits
await page.click('.ng-user');
await page.waitForSelector('.ed-dialogue input');
await page.fill('.ed-dialogue input.ed-field', 'Daniel K.');
if (images) await page.screenshot({ path: path.join(repo, 'output/cloud_name.png') });
await page.click('.ed-dialogue button.main');
await page.waitForFunction(() => document.querySelector('.ng-user')?.textContent.includes('Daniel K.'), null, { timeout: 10000 });
check(true, 'Name geändert');

const leylaFile = 'projects/nomadgirl/data/leyla.json';
const setSpeed = v => page.evaluate(v => { const w = window.workshop; w.change('leyla', () => { w.p.data.leyla.movement.runSpeed = v; }); }, v);
const startRef = g.refs.main;
await setSpeed(777);
check((await page.textContent('.ed-status')).includes('Ungespeichert'), 'Status zeigt „Ungespeichert“');
if (images) await page.screenshot({ path: path.join(repo, 'output/cloud_unsaved.png') });
await page.waitForFunction(() => document.querySelector('.ed-status')?.textContent.includes('Gespeichert'), null, { timeout: 15000 });
check(g.refs.main !== startRef, 'nach 2 s Ruhe automatisch ein Commit');
check(/"runSpeed": 777/.test(g.fileAt(leylaFile)), 'Änderung steht im Repository');
const author = g.commits.get(g.refs.main).author;
check(author.name === 'Daniel K.' && !author.email.includes('example.com'), 'Autor ist die angemeldete Person, Login-E-Mail bleibt privat');
const title = await page.getAttribute('.ed-status', 'title');
check(/Commit [0-9a-f]{7}/.test(title), 'Status nennt den Commit: ' + title);
if (images) await page.screenshot({ path: path.join(repo, 'output/cloud_saved.png') });

// Ctrl+S saves immediately
const before2 = g.refs.main;
await setSpeed(778);
await page.keyboard.press('Control+s');
await page.waitForFunction(() => !document.querySelector('.ed-status')?.textContent.includes('Ungespeichert') && !document.querySelector('.ed-status')?.textContent.includes('Schreibe'), null, { timeout: 15000 });
check(g.refs.main !== before2 && /"runSpeed": 778/.test(g.fileAt(leylaFile)), 'Strg+S speichert sofort');

// Someone else changes the same file → conflict dialog → overwrite
await g.pushOther(leylaFile, g.fileAt(leylaFile).replace('"runSpeed": 778', '"runSpeed": 555'));
await setSpeed(779);
await page.keyboard.press('Control+s');
await page.waitForSelector('.ed-dialogue', { timeout: 15000 });
check((await page.textContent('.ed-dialogue')).includes('Jemand war schneller'), 'Konflikt wird gemeldet');
if (images) await page.screenshot({ path: path.join(repo, 'output/cloud_conflict.png') });
check(/"runSpeed": 555/.test(g.fileAt(leylaFile)), 'ohne Bestätigung wird nichts überschrieben');
await page.click('.ed-dialogue button.red');
await page.waitForFunction(() => document.querySelector('.ed-status')?.textContent.includes('Gespeichert'), null, { timeout: 15000 });
check(/"runSpeed": 779/.test(g.fileAt(leylaFile)), '„Überschreiben“ speichert den eigenen Stand');

// Reload shows the state from the repository
await page.reload(); await page.waitForSelector('.ng-user', { timeout: 20000 });
check((await page.textContent('.ng-user')).includes('Daniel K.'), 'Name bleibt nach Neuladen erhalten');
check(await page.evaluate(() => window.workshop.p.data.leyla.movement.runSpeed) === 779, 'nach Neuladen kommt der Stand aus dem Repository');

// "Spielen" saves first and opens the game in its own tab, which takes the data live from the repository
const before3 = g.refs.main;
await setSpeed(780);
const infos = [];
const [game] = await Promise.all([page.context().waitForEvent('page'), page.click('.ng-play')]);
game.on('console', m => infos.push(m.text())); game.on('pageerror', e => errors.push('Spiel: ' + e.message));
check(g.refs.main !== before3 || (await page.evaluate(() => window.workshop.dirty.size)) === 0, '„Spielen“ speichert vorher');
await game.waitForURL(/\/game/, { timeout: 15000 });
check(/"runSpeed": 780/.test(g.fileAt(leylaFile)), 'gespeicherter Stand steht vor dem Spielstart im Repository');
await game.waitForFunction(() => window.game?.scene.getScene('play')?.leyla, null, { timeout: 30000 });
check(infos.some(t => t.includes('live aus dem Repository')), 'Spiel lädt die Daten live über /api/files');
check(await game.evaluate(() => window.game.scene.getScene('play').p.data.leyla.movement.runSpeed) === 780, 'Spiel nutzt den gespeicherten Werkstatt-Stand');
check(!errors.length, 'keine Fehler in der Browser-Konsole' + (errors.length ? ': ' + errors.join(' | ') : ''));

await browser.close(); server.close();
console.log(failed ? `\n${failed} Fehler.` : '\nAlles grün.');
process.exit(failed ? 1 : 0);
