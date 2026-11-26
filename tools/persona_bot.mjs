// Persona playtest (#189, Daniel 26.11.2026: „Bitte lass alle fünf Personen ungefähr 10 Stunden in der Spielwelt verbringen“):
// a bot plays a new game in the persona's style (tools/persona_bot/brain.js) for hours of game time, headless and faster than real time.
// Everything goes to output/persona_play/<persona>/: log.jsonl (toasts, menus, runs, camp jobs), shots, and every finding is reported
// through the real feedback form (F8, chip, text, send) like Daniel and Steven do; the request is kept as fb/<n>.json (no worker here).
//   node tools/persona_bot.mjs --persona malu [--hours 10] [--seed 1] [--shots 30] [--max-reports 40]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PERSONAS } from './persona_feedback.mjs';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const id = opt('persona'), P = PERSONAS[id];
if (!P) throw new Error(`--persona: ${Object.keys(PERSONAS).join(', ')}`);
const hours = Number(opt('hours', 10)), seed = Number(opt('seed', 1)), shotEvery = Number(opt('shots', 30)) * 3600, maxReports = Number(opt('max-reports', 40));
const total = Math.round(hours * 216000), CHUNK = 3600;
const out = path.join('output', 'persona_play', id), fbDir = path.join(out, 'fb');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(fbDir, { recursive: true });
const logFile = fs.openSync(path.join(out, 'log.jsonl'), 'w'), log = o => fs.writeSync(logFile, JSON.stringify(o) + '\n');

// the persona's own words for what the bot ran into (they report as players, not as code readers)
const VOICE = {
  jana: { stuck: 'Ich komme hier nicht weiter und weiß nicht, wie. {what}', use: 'Ich drücke hier E, aber es passiert nichts. {what}', window: 'Ein Fenster geht nicht mehr zu. {what}', build: 'Bauen klappt bei mir nicht. {what}', travel: 'Ich komme vom Camp nicht los. {what}', error: 'Da kam eine Fehlermeldung. {what}', script: 'Irgendwas ist hier komisch. {what}' },
  malu: { stuck: 'Hier hänge ich fest, das nervt beim gemütlichen Spielen. {what}', use: 'Hier sollte doch was gehen, tut es aber nicht. {what}', window: 'Das Fenster bleibt offen. {what}', build: 'Beim Bauen hakt es. {what}', travel: 'Losfahren klappt nicht. {what}', error: 'Fehler aufgetaucht. {what}', script: 'Etwas stimmt hier nicht. {what}' },
  ole: { stuck: 'Weg gefunden, der gemeint aussieht, aber nicht geht. {what}', use: 'Interaktion ohne Wirkung. {what}', window: 'Fenster hängt. {what}', build: 'Bau-Modus hakt. {what}', travel: 'Reisen geht nicht. {what}', error: 'JS-Fehler beim Erkunden. {what}', script: 'Seltsames Verhalten. {what}' },
  deniz: { stuck: 'Hier verliere ich Zeit, weil Leyla nicht durchkommt. Kostet Rang. {what}', use: 'Aktion ohne Ergebnis. {what}', window: 'Fenster lässt sich nicht schließen. {what}', build: 'Bau-Modus: {what}', travel: 'Kein Run möglich. {what}', error: 'Fehlermeldung: {what}', script: 'Unklarer Zustand: {what}' },
  kai: { stuck: 'Lauf unterbrochen, Leyla bleibt hängen. Killt den Flow. {what}', use: 'Input frisst nichts. {what}', window: 'Fenster blockiert. {what}', build: 'Bauen kaputt. {what}', travel: 'Komme nicht in den Run. {what}', error: 'Error: {what}', script: 'Bug? {what}' },
};
const CHIP = { stuck: 'bug', use: 'bug', window: 'bug', build: 'bug', travel: 'bug', error: 'bug', script: 'verwirrend' };

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: P.viewport[0], height: P.viewport[1] } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource|\/api\//.test(m.text())) pageErrors.push(m.text()); });
if (P.pad) await page.addInitScript(() => {
  const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  navigator.getGamepads = () => [pad, null, null, null];
});
let caught = null;
await page.route('**/api/feedback', async r => { caught = r.request().postDataJSON(); await r.fulfill({ status: 200, contentType: 'application/json', body: '{"number":0}' }); });
await page.goto((process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new');
await page.waitForFunction(() => { try { return window.nomad?.state?.() && window.nomadFeedback; } catch { return false; } }, null, { timeout: 90000 });
await page.addScriptTag({ path: 'tools/persona_bot/brain.js' });
await page.evaluate(([p, s]) => personaBot.init(p, s), [id, seed]);

let reports = 0, nextShot = 0, frame = 0, assists = 0;
const t0 = Date.now(), counts = {};
async function report(f) {
  if (reports >= maxReports) return;
  const what = [f.text, f.poi ? `(${f.poi}, Kachel ${f.tile?.join(', ')})` : f.tile ? `(Kachel ${f.tile.join(', ')})` : ''].filter(Boolean).join(' ');
  const text = (VOICE[id][f.kind] || '{what}').replace('{what}', what);
  caught = null;
  await page.evaluate(() => nomad.release());
  await page.waitForTimeout(800);
  await page.keyboard.press('F8');
  try {
    await page.waitForSelector('.fb-text', { timeout: 15000 });
    await page.click(`.fb-chip[data-chip="${CHIP[f.kind] || 'bug'}"]`);
    await page.click('.fb-text'); await page.keyboard.type(text, { delay: 1 });
    await page.click('.fb-send');
    await page.waitForFunction(() => !document.querySelector('.fb-text'), null, { timeout: 30000 });
  } catch (e) { log({ reportFailed: e.message, f }); }
  await page.evaluate(() => nomad.take());
  if (caught) { reports++; fs.writeFileSync(path.join(fbDir, `${String(reports).padStart(3, '0')}_${f.kind}.json`), JSON.stringify({ ...caught, persona: id, finding: f }, null, 1)); }
}

while (frame < total) {
  let r;
  try { r = await page.evaluate(n => personaBot.chunk(n), CHUNK); }
  catch (e) { log({ crash: e.message, frame }); pageErrors.push('crash: ' + e.message); break; }
  frame = r.frame; assists = r.assists;
  for (const x of r.log) log(x);
  for (const x of r.runs) log({ runDone: x });
  for (const e of [...r.errors, ...pageErrors.splice(0)]) r.findings.push({ kind: 'error', text: String(e).slice(0, 300), frame, mode: r.state.mode, poi: r.state.poi });
  for (const f of r.findings) {
    counts[f.kind] = (counts[f.kind] || 0) + 1;
    log({ finding: f });
    const k = f.kind + ':' + (f.key || f.text);
    // only JS errors go through the form right away (objective); the rest Ava checks first and reports as the persona afterwards
    if (f.kind === 'error' && !f.dup && !counts['_' + k]) { counts['_' + k] = 1; await report(f); }
  }
  log({ f: frame, state: r.state, assists });
  if (frame >= nextShot) {
    nextShot += shotEvery;
    await page.evaluate(() => nomad.freeze()); await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, `shot_${String(Math.round(frame / 3600)).padStart(4, '0')}min.png`) });
    await page.evaluate(() => nomad.thaw());
  }
  if (Math.round(frame / 3600) % 30 === 0) console.log(`${P.name}: ${(frame / 216000).toFixed(1)} h Spielzeit · ${Math.round((Date.now() - t0) / 60000)} min · ${reports} Meldungen · ${assists} Hilfen`);
}
const summary = { persona: id, hours: frame / 216000, minutes: Math.round((Date.now() - t0) / 60000), reports, assists, counts };
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary));
await browser.close();
