// #194 Feedback board: the page /feedback and the board in the pause menu, against a faked /api/feedback/* (status rules from
// game/feedback/status.js, the same the worker uses). Rows with status and tick, filters, detail with picture, trace and comments,
// status change, the tick closes, „Hier spielen“ opens the game at the spot (?tp=), Esc closes the board and the game goes on.
//   node tools/fbboard_test.mjs [--shots]     (server must run: npm run serve, or tools/test_all.mjs)
import fs from 'node:fs';
import { chromium } from 'playwright';
import { applyStatus, statusOf, acceptedOf, parseBody, replaceText } from '../game/feedback/status.js';

const base = (process.env.GAME_URL || 'http://localhost:8766/game.html').replace(/game\.html.*$/, '');
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [], ok = [];
const check = (name, cond, info) => { if (cond) ok.push(name); else errors.push(`${name}: ${JSON.stringify(info)?.slice(0, 400)}`); console.log(`${cond ? '✓' : '✗'} ${name}`); };

// a small FeedbackBucket in memory
const PNG = fs.readFileSync('game/brand/icon-180.png');
const body = (chip, text, by) => `**${chip}** · Ort\n\n${text.split('\n').map(l => '> ' + l).join('\n')}\n\n_(kein Bild)_\n\n<sub>FB · gemeldet von ${by} · 2026-11-25T19:00:00Z</sub>`;
const issues = [
  { number: 4, title: 'FB-4 · Bug · Mile 7 Gas & Go', state: 'open', labels: ['nomadgirl', 'bug', 'abnahme'], body: body('Bug', 'Baumenü hängt', 'Daniel'), comments: [] },
  { number: 7, title: 'FB-7 · Idee · Mile 7 Gas & Go', state: 'open', labels: ['nomadgirl', 'idee'], body: body('Idee', 'AvA länger festhalten', 'Steven'), comments: [] },
  { number: 12, title: 'FB-12 · Bug · Delta Heights · Seed 5', state: 'open', labels: ['nomadgirl', 'bug', 'in-bearbeitung'], body: body('Bug', 'Bodenplatte\nlässt nicht durch', 'Daniel'), comments: [{ user: { login: 'dna20717' }, created_at: '2026-11-26T10:00:00Z', body: 'Schau ich mir an' }] },
  { number: 15, title: 'FB-15 · Schlecht · Bunker 13', state: 'closed', labels: ['nomadgirl', 'schlecht', 'persona'], body: body('Schlecht', 'Zu dunkel', 'Persona Ole (Ava)'), comments: [] },
];
const TRACE = { chip: 'bug', context: { mode: 'run', poi: 'delta_heights', seed: 5, tile: [20, 30], health: '40/100', version: 'abc1234', screen: '1920×1080' }, reproduce: "node tools/play.mjs 'tp 20 30'",
  trace: { seconds: 30, fps: { avg: 58, worstMs: 40 }, samples: Array.from({ length: 60 }, (_, k) => ({ t: -30000 + k * 500, health: 100 - k, state: 'run', tile: [k, 30] })), inputs: [{ t: -30000, held: '' }, { t: -20000, held: 'right' }, { t: -12000, held: 'right+jump' }, { t: -11000, held: '' }], events: [{ t: -15000, type: 'hit' }], errors: [{ t: -5000, message: 'TypeError: boom', count: 1 }] } };
const item = i => { const p = parseBody(i.body), L = i.labels; return { number: i.number, title: i.title, status: statusOf(i), accepted: acceptedOf(i), chip: ['gut', 'schlecht', 'bug', 'idee', 'verwirrend'].find(c => L.includes(c)) || null, where: i.title.split(' · ').slice(2).join(' · '), text: p.text, by: p.by, persona: p.persona || L.includes('persona'), created: '2026-11-25T19:00:00Z', comments: i.comments.length }; };
const calls = [];
async function api(route) {
  const u = new URL(route.request().url()), way = u.pathname.split('/api/feedback/')[1], send = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
  calls.push(way);
  if (way === 'list') return send({ repo: 'dna20717/FeedbackBucket', items: [...issues].reverse().map(item) });
  const n = Number(u.searchParams.get('n')), i = issues.find(x => x.number === n);
  if (way === 'item') return send({ ...item(i), body: i.body, url: `https://github.com/dna20717/FeedbackBucket/issues/${n}`, files: n === 12 ? ['moment.png', 'trace.json'] : [], comments: i.comments.map(c => ({ by: c.user.login, at: c.created_at, body: c.body })) });
  if (way === 'file') return u.searchParams.get('f') === 'trace.json' ? send(TRACE) : route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  if (way === 'update') {
    const b = JSON.parse(route.request().postData()), j = issues.find(x => x.number === b.n), st = applyStatus(j, b);
    if (st?.error) return send({ error: st.error }, 400);
    if (st) Object.assign(j, { labels: st.labels, state: st.state });
    if (b.text != null) j.body = replaceText(j.body, b.text);
    if (b.comment || st) j.comments.push({ user: { login: 'nomadgirl-bot' }, created_at: new Date().toISOString(), body: (b.comment || '') + ' <sub>über das Feedback-Board</sub>' });
    return send(item(j));
  }
  return send({ error: 'x' }, 404);
}

// ---------- 1) the page /feedback ----------
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', e => errors.push('page: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load/.test(m.text())) errors.push('console: ' + m.text()); });
await page.route('**/api/feedback/**', api);
await page.goto(base + 'feedback.html');
await page.waitForSelector('.fbb-row');
const rows = () => page.$$eval('.fbb-row', r => r.map(x => x.dataset.n + ':' + x.querySelector('.fbb-st').value + ':' + x.querySelector('.fbb-tick input').checked + ':' + x.querySelector('.fbb-tick input').disabled));
let v = await rows();
check('Seite /feedback: Liste ohne Geschlossene, neueste oben, Status je Zeile, Häkchen nur bei „Bereit zur Abnahme“ frei', JSON.stringify(v) === JSON.stringify(['12:arbeit:false:true', '7:offen:false:true', '4:abnahme:false:false']), v);
v = await page.$$eval('.fbb-tab', t => t.map(x => x.textContent));
check('Reiter mit Zahlen: Nicht geschlossen 3, Offen 1, In Bearbeitung 1, Bereit zur Abnahme 1, Geschlossen 1, Alle 4', v.join('|') === 'Nicht geschlossen3|Offen1|In Bearbeitung1|Bereit zur Abnahme1|Geschlossen1|Alle4', v);
await page.click('.fbb-row[data-n="12"]');
await page.waitForSelector('.fbb-tl');
v = await page.evaluate(() => ({ img: document.querySelector('.fbb-shot')?.tagName, src: document.querySelector('.fbb-shot')?.getAttribute('src'), text: document.querySelector('.fbb-detail textarea').value, play: document.querySelector('.fbb-actions a.fb-send')?.getAttribute('href'), inputs: document.querySelectorAll('.fbb-tl .inp').length, err: document.querySelectorAll('.fbb-tl .err').length, comments: document.querySelectorAll('.fbb-c').length, facts: document.querySelector('.fbb-facts')?.textContent }));
check('Meldung: Bild, Text, Spur (Leben, Eingaben, Ereignis, Fehler), Kommentar, „Hier spielen“ an die Stelle', v.img === 'IMG' && /f=moment\.png/.test(v.src) && v.text === 'Bodenplatte\nlässt nicht durch' && v.play === 'game.html?poi=delta_heights&seed=5&tp=20,30' && v.inputs === 2 && v.err === 1 && v.comments === 1 && /Nachspielen/.test(v.facts), v);
if (shots) await page.screenshot({ path: 'output/fbboard_page.png' });
// status: In Bearbeitung → Bereit zur Abnahme, then the tick
await page.selectOption('.fbb-row[data-n="12"] .fbb-st', 'abnahme');
await page.waitForFunction(() => document.querySelector('.fbb-row[data-n="12"] .fbb-st')?.value === 'abnahme' && !document.querySelector('.fbb-row[data-n="12"] .fbb-tick input').disabled);
check('Status ändern: FB-12 „Bereit zur Abnahme“, das Häkchen wird frei', issues[2].labels.includes('abnahme') && issues[2].state === 'open', issues[2]);
await page.click('.fbb-row[data-n="12"] .fbb-tick input');
await page.waitForFunction(() => !document.querySelector('.fbb-row[data-n="12"]'));
check('Häkchen: FB-12 abgenommen und geschlossen, verschwindet aus „Nicht geschlossen“', issues[2].state === 'closed' && issues[2].labels.includes('abgenommen'), issues[2]);
await page.click('.fbb-tab:nth-child(5)');   // Geschlossen
v = await rows();
check('Reiter „Geschlossen“: FB-12 mit Häkchen, FB-15 (Persona) ohne', JSON.stringify(v) === JSON.stringify(['15:zu:false:false', '12:zu:true:false']), v);
await page.click('.fbb-check input');   // personas off
v = await rows();
check('Personas ausblenden', JSON.stringify(v) === JSON.stringify(['12:zu:true:false']), v);
// edit the text and comment
await page.click('.fbb-tab:nth-child(1)');
await page.click('.fbb-row[data-n="7"]');
await page.waitForSelector('.fbb-detail textarea');
await page.fill('.fbb-detail textarea', 'AvA länger festhalten\nund Akku 6 s');
await page.click('text=Text speichern');
await page.waitForFunction(() => /speichert|gespeichert/.test(document.querySelector('.fbb-note').textContent) && /gespeichert/.test(document.querySelector('.fbb-note').textContent));
check('Text bearbeiten: landet im Issue, der Rest bleibt', /> AvA länger festhalten\n> und Akku 6 s/.test(issues[1].body) && /gemeldet von Steven/.test(issues[1].body), issues[1].body);
await page.fill('.fbb-comment', 'Bei mir geht es jetzt');
await page.click('text=Kommentieren');
await page.waitForFunction(() => document.querySelectorAll('.fbb-c').length === 1);   // FB-7 had none
check('Kommentieren', /Bei mir geht es jetzt/.test(issues[1].comments.at(-1).body), issues[1].comments);
// keys: ↓ chooses the next one
await page.click('.fbb-dhead'); await page.keyboard.press('ArrowDown');
await page.waitForFunction(() => document.querySelector('.fbb-row.on')?.dataset.n === '4');
check('Tastatur: ↓ wählt die nächste Meldung', true);
// phone width
const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
await phone.route('**/api/feedback/**', api);
await phone.goto(base + 'feedback.html'); await phone.waitForSelector('.fbb-row');
v = await phone.evaluate(() => ({ scroll: document.documentElement.scrollWidth, w: innerWidth, tick: document.querySelector('.fbb-row .fbb-tick')?.getBoundingClientRect().right }));
check('Handy-Breite: kein seitliches Scrollen, Häkchen sichtbar', v.scroll <= v.w && v.tick <= v.w, v);
if (shots) await phone.screenshot({ path: 'output/fbboard_phone.png' });
await phone.close();

// ---------- 2) in the game: pause menu → Feedback-Board, Esc closes, the game goes on ----------
const game = await browser.newPage({ viewport: { width: 1280, height: 720 } });
game.on('pageerror', e => errors.push('game: ' + e.message));
await game.route('**/api/feedback/**', api);
await game.goto(base + 'game.html?poi=delta_heights&seed=5&tp=20,30');
await game.waitForFunction(() => window.nomad && window.nomadFeedback?.openBoard && window.game?.scene.getScene('play')?.leyla?.body, null, { timeout: 30000 });
await game.waitForTimeout(1500);
v = await game.evaluate(() => { const s = game.scene.getScene('play'); return [Math.floor(s.leyla.x / s.T), Math.round(s.leyla.feet / s.T)]; });
check('„Hier spielen“: ?tp=20,30 setzt Leyla an die Kachel', Math.abs(v[0] - 20) <= 1 && Math.abs(v[1] - 30) <= 2, v);
v = await game.evaluate(() => { const h = game.scene.getScene('play').hud; h.pauseMenu(); return h.menuState().items.map(x => x.label); });
check('Pause-Menü hat „Feedback-Board“', v.includes('Feedback-Board'), v);
await game.evaluate(() => { const h = game.scene.getScene('play').hud; h.choose(h.menuState().items.findIndex(x => x.label === 'Feedback-Board')); });
await game.waitForSelector('.fbb-row');
v = await game.evaluate(() => ({ open: !!window.nomadFeedback.board()?.isOpen, paused: game.scene.getScene('play').hud.feedbackOpen, kb: game.scene.getScene('play').input.keyboard.enabled }));
check('Board im Spiel: offen, Spiel pausiert, Tastatur erreicht Leyla nicht', v.open && v.paused && !v.kb, v);
if (shots) await game.screenshot({ path: 'output/fbboard_game.png' });
await game.keyboard.press('Escape');
await game.waitForFunction(() => !document.querySelector('.fbb'));
v = await game.evaluate(() => ({ paused: game.scene.getScene('play').hud.feedbackOpen, kb: game.scene.getScene('play').input.keyboard.enabled, modal: game.scene.getScene('play').hud.modal }));
check('Esc schließt das Board, das Spiel läuft weiter', !v.paused && v.kb && !v.modal, v);
// main menu: the entry is there
const menu = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await menu.goto(base + 'index.html');
await menu.waitForFunction(() => [...document.querySelectorAll('#lcd a')].some(a => /Feedback/.test(a.textContent)), null, { timeout: 30000 }).catch(() => {});
v = await menu.evaluate(() => [...document.querySelectorAll('#lcd a')].map(a => a.querySelector('span')?.textContent + '|' + a.getAttribute('href')));
check('Hauptmenü: „Feedback“ führt zu feedback.html', v.some(x => x === 'Feedback|feedback.html'), v);

await browser.close();
console.log(errors.length ? `${errors.length} Fehler:\n${errors.join('\n')}` : `fbboard_test: alle ${ok.length} Prüfungen grün`);
process.exit(errors.length ? 1 : 0);
