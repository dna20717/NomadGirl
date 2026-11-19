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

// #073 Datensets online: „Speichern unter …“ writes sets/index.json and only the difference as a commit; the main menu and the game see it
await game.close();
await page.evaluate(() => { const w = window.workshop; w.change('leyla', () => { w.p.data.leyla.movement.jumpSpeed = 1234; }); });
await page.click('.ng-setButton');
await page.click('.ed-dialogue .ed-button.main');
await page.waitForSelector('.ed-dialogue input.ed-field');
await page.fill('.ed-dialogue input.ed-field', 'Sprungtest');
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.workshop?.dataSet?.id === 'sprungtest', null, { timeout: 20000 });
const setLeyla = 'projects/nomadgirl/sets/sprungtest/' + leylaFile.replace('projects/nomadgirl/', '');
check(/"jumpSpeed": 1234/.test(g.fileAt(setLeyla) || '') && !/runSpeed/.test(g.fileAt(setLeyla) || ''), 'Datenset: nur der Unterschied liegt als Commit im Set-Ordner');
check(/"sprungtest"/.test(g.fileAt('projects/nomadgirl/sets/index.json') || ''), 'Datenset: steht in sets/index.json');
check(!/"jumpSpeed": 1234/.test(g.fileAt(leylaFile)), 'Datenset: der Standard bleibt, wie er ist');
await page.goto(base + '/');
await page.waitForFunction(() => window.dataSets, null, { timeout: 20000 });
check(await page.evaluate(() => document.getElementById('dataset').textContent) === 'Datenset: Sprungtest', 'Hauptmenü zeigt das aktive Datenset unten');
// #083 Bild hochladen: an asset gets a picture from the file picker, it becomes its own commit under assets/, the asset points to it
await page.goto(base + '/workshop'); await page.waitForSelector('.ng-user', { timeout: 20000 });
await page.evaluate(() => window.workshop.go({ area: 'assets', choice: 'van_dish' }));
await page.waitForSelector('.ng-upload input[type=file]', { state: 'attached', timeout: 10000 });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const upRef = g.refs.main;
await page.setInputFiles('.ng-upload input[type=file]', { name: 'schuessel.png', mimeType: 'image/png', buffer: png });
await page.waitForFunction(() => /Hochgeladen als|fehlgeschlagen/.test(document.querySelector('.ng-upload small')?.textContent || ''), null, { timeout: 15000 });
const upNote = await page.textContent('.ng-upload small');
check(/Hochgeladen als assets\//.test(upNote) && g.refs.main !== upRef && !!g.fileAt('projects/nomadgirl/' + (await page.evaluate(() => window.workshop.p.data.assets.van_dish.file))), 'Bild hochgeladen: eigener Commit, Asset zeigt darauf (' + upNote + ')');
const game2 = page;
await game2.goto(base + '/game');
await game2.waitForFunction(() => window.game?.scene.getScene('play')?.leyla, null, { timeout: 30000 });
check(await game2.evaluate(() => window.game.scene.getScene('play').p.data.leyla.movement.jumpSpeed) === 1234 && await game2.evaluate(() => window.__nomadData.set?.id) === 'sprungtest', 'Spiel lädt das Datenset über /api/files');


// Pixel-Aufträge (Daniel, 19.11.2026: „jemand war schneller, dann ist der Auftrag weg“): auch mit aktivem Datenset im Standard,
// ein gleichzeitiger Commit von jemand anderem an derselben Datei wird zusammengeführt statt verworfen; Rettung vor dem Neuladen
{
  const F = 'projects/nomadgirl/data/pixel_orders.json';
  const w = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await w.goto(base + '/workshop?autosave=600');
  await w.evaluate(() => localStorage.setItem('nomadgirl-set', 'sprungtest')); await w.reload();
  await w.waitForFunction(() => window.workshop?.p, null, { timeout: 20000 });
  check(!!await w.evaluate(() => window.workshop.dataSet?.id), 'Pixel-Aufträge: Datenset ist aktiv (Test mit Set)');
  await w.evaluate(() => window.workshop.go({ area: 'pixelOrders' }));
  await w.click('.da-head button:has-text("Neu")'); await w.waitForTimeout(300);
  await w.fill('.px-card input.ed-field', 'Angelzubehör'); await w.keyboard.press('Tab'); await w.waitForTimeout(200);
  await g.pushOther(F, JSON.stringify({ von_code: { name: 'Von Claude Code', type: 'icons', status: 'open' } }) + '\n');
  await w.keyboard.press('Control+s');
  await w.waitForFunction(() => /Gespeichert/.test(document.querySelector('.ed-status')?.textContent || '') && !window.workshop.dirty.size, null, { timeout: 15000 });
  const saved = JSON.parse(g.fileAt(F) || '{}');
  check(saved.von_code && Object.values(saved).some(x => x.name === 'Angelzubehör') && !await w.locator('.ed-dialogue').count(), 'Pixel-Aufträge: Konflikt automatisch zusammengeführt, beide Aufträge im Repository');
  check([...Object.keys(saved)].length === 2 && !g.fileAt('projects/nomadgirl/sets/sprungtest/data/pixel_orders.json'), 'Pixel-Aufträge landen im Standard, nie im Datenset');
  await w.fill('.px-card input.ed-field', 'Angelzubehör 2'); await w.keyboard.press('Tab'); await w.waitForTimeout(200);
  await w.evaluate(() => { window.workshop.rescue(); window.workshop.dirty.clear(); });
  await w.reload(); await w.waitForSelector('.ed-dialogue button.main', { timeout: 20000 });
  await w.click('.ed-dialogue button.main'); await w.waitForTimeout(300);
  check(await w.evaluate(() => Object.values(window.workshop.p.data.pixelOrders).some(x => x.name === 'Angelzubehör 2') && window.workshop.dirty.size === 1), 'Ungespeicherte Änderungen nach dem Neuladen wiederhergestellt');
  await w.close();
}

await browser.close(); server.close();
console.log(failed ? `\n${failed} Fehler.` : '\nAlles grün.');
process.exit(failed ? 1 : 0);
