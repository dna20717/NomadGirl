// #181 Feedback for the test phase: F8 / home / Select + Start pause the game and open the window, the trace covers the last 30 s,
// the controller drives the window, sending without worker waits in the browser, with a (faked) worker it becomes FB-<n>
// and the waiting one goes out too; a JS error offers feedback. Server must run (npm run serve) or use tools/test_all.mjs.
//   node tools/feedback_test.mjs [--shots]
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = process.env.GAME_URL || 'http://localhost:8766/game.html';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => { if (!/boom test/.test(e.message)) errors.push(e.message); });
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json|boom test|404/.test(m.location()?.url + m.text())) errors.push(m.text()); });
await page.addInitScript(() => {
  localStorage.removeItem('nomadgirl-feedback-queue');
  const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)', index: 0, connected: true, mapping: 'standard',
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  window.setPad = (press = []) => { pad.buttons.forEach((b, i) => { b.pressed = press.includes(i); b.value = b.pressed ? 1 : 0; }); };
  navigator.getGamepads = () => [pad, null, null, null];
});
let posted = null, answer = 404;
await page.route('**/api/feedback', async route => {
  posted = JSON.parse(route.request().postData() || 'null');
  if (answer === 404) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"x"}' });
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ number: 7, url: 'https://github.com/x/y/issues/7' }) });
});
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.nomadFeedback && window.game?.scene.getScene('play')?.leyla, null, { timeout: 20000 });
const ev = (f, a) => page.evaluate(f, a);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const wait = ms => page.waitForTimeout(ms);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: `output/feedback_${n}.png` }); };
const frames = async n => ev(k => new Promise(res => { let i = 0; const f = () => (++i >= k ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const st = () => ev(() => { const s = game.scene.getScene('play'), f = nomadFeedback.state(); return { open: f.open, hint: f.hint, queued: f.queued, last: f.last, fbOpen: !!s.hud.feedbackOpen, paused: s.physics.world.isPaused, menu: s.hud.menuState(), x: Math.round(s.leyla.x), status: document.querySelector('.fb-status')?.textContent || '', img: !!document.querySelector('.fb-overlay img.fb-shot'), on: [...document.querySelectorAll('.fb-chip.on')].map(b => b.dataset.chip), focus: document.querySelector('.fb-focus')?.dataset.chip || document.querySelector('.fb-focus')?.className || null }; });

// 1. trace: 40 s of play → the last 30 s, 4 states per second, input changes
await ev(() => { for (let i = 0; i < 40; i++) nomad.step(60, i % 2 ? ['left'] : ['right'], i % 4 === 0 ? ['jump'] : []); });
let tr = await ev(() => nomadFeedback.state().trace);
check('Spur: 30 s, 4 Zustände pro Sekunde', tr.seconds === 30 && tr.samples.length >= 115 && tr.samples.length <= 121 && tr.samples[0].t >= -30000, { n: tr.samples.length, first: tr.samples[0]?.t });
check('Spur: Zustand hat Ort, Position, Leben', tr.samples.at(-1).room && Number.isFinite(tr.samples.at(-1).x) && tr.samples.at(-1).tile?.length === 2 && tr.samples.at(-1).health > 0, tr.samples.at(-1));
check('Spur: Eingaben nur bei Wechsel', tr.inputs.length >= 25 && tr.inputs.length <= 80 && tr.inputs.some(i => i.held.includes('right')) && tr.inputs.some(i => i.held.includes('left')), tr.inputs.length);
await ev(() => nomad.release());
await wait(300);

// 2. F8 opens: game paused, picture of the moment, keys do not reach Leyla
await page.keyboard.press('F8');
await page.waitForSelector('.fb-overlay', { timeout: 5000 });
await wait(400);
let s = await st();
check('F8 öffnet das Fenster und pausiert', s.open && s.fbOpen && s.paused, s);
check('Bild vom Moment', s.img, s);
const x0 = s.x;
await page.keyboard.down('ArrowRight'); await wait(400); await page.keyboard.up('ArrowRight');
check('Tasten im Fenster bewegen Leyla nicht', (await st()).x === x0, { x0, x: (await st()).x });
await shot('open');
await page.keyboard.press('Escape'); await wait(200);
s = await st();
check('Esc schließt, Spiel läuft weiter', !s.open && !s.fbOpen, s);
await frames(12);
check('Spiel nicht mehr pausiert', !(await st()).paused, await st());

// 3. Select + Start together opens it (no pause menu left behind), the controller drives it; without worker it waits
await ev(() => setPad([8, 9])); await wait(500);
s = await st();
check('Select + Start öffnet, kein Pause-Menü dahinter', s.open && !s.menu, s);
await ev(() => setPad([])); await wait(80);
const press = async b => { await ev(k => setPad([k]), b); await wait(250); await ev(() => setPad([])); await wait(250); };
for (const b of [15, 15]) await press(b);
s = await st();
check('Steuerkreuz wandert über die Chips', s.focus === 'bug', s);
await press(0);
check('A wählt den Chip', (await st()).on.join() === 'bug', await st());
await press(9);
await page.waitForFunction(() => !/gesendet …/.test(document.querySelector('.fb-status')?.textContent || 'x'), null, { timeout: 8000 }).catch(() => {});
s = await st();
check('Start schickt ab, ohne Worker wartet es im Browser', /gespeichert/.test(s.status) && s.queued === 1 && posted?.chip === 'bug', { status: s.status, queued: s.queued, chip: posted?.chip });
check('Gesendet: Spur + Bild + Ort + Nachspiel-Zeile', posted?.trace?.samples?.length > 50 && /^data:image\/webp/.test(posted?.shot || '') && posted?.where && /play\.mjs 'tp \d+ \d+'/.test(posted?.reproduce || '') && posted?.context?.room, { ...posted, shot: posted?.shot?.slice(0, 30), trace: posted?.trace?.samples?.length });
console.log(`   Bild ${Math.round((posted?.shot?.length || 0) * 0.75 / 1024)} KB, Spur ${Math.round(JSON.stringify(posted?.trace || {}).length / 1024)} KB`);
await page.waitForFunction(() => !nomadFeedback.state().open, null, { timeout: 5000 }).catch(() => {});
await frames(15);

// 4. with the worker: FB-7, and the waiting one goes out afterwards
answer = 200;
await page.keyboard.press('F8'); await page.waitForSelector('.fb-overlay'); await wait(300);
await page.click('.fb-chip[data-chip="gut"]');
await page.fill('.fb-text', 'Der Sprung über die Kiste fühlt sich super an');
await shot('filled');
await page.keyboard.press('Control+Enter');
await page.waitForFunction(() => /FB-/.test(document.querySelector('.fb-status')?.textContent || '') && !nomadFeedback.state().queued, null, { timeout: 8000 }).catch(() => {});
s = await st();
check('Mit Worker: Danke, FB-7', /FB-7/.test(s.status) && s.last?.text === 'Der Sprung über die Kiste fühlt sich super an' && s.last?.chip === 'gut', { status: s.status, queued: s.queued });
check('Wartendes Feedback geht mit raus', s.queued === 0, s);
await page.waitForFunction(() => !nomadFeedback.state().open, null, { timeout: 5000 }).catch(() => {});

// 5. a JS error offers feedback, „Melden“ opens with Bug
await ev(() => setTimeout(() => { throw new Error('boom test'); }, 0)); await wait(300);
check('JS-Fehler zeigt den Hinweis', (await st()).hint, await st());
await page.click('.fb-hintbox .fb-send'); await page.waitForSelector('.fb-overlay'); await wait(300);
s = await st();
check('Melden öffnet mit Bug', s.open && s.on.join() === 'bug', s);
await shot('error');
await page.keyboard.press('Escape');
await ev(() => setTimeout(() => { throw new Error('boom test'); }, 0)); await wait(300);
check('Gleicher Fehler nur einmal', !(await st()).hint, await st());
const t2 = await ev(() => nomadFeedback.state().trace.errors);
check('Fehler stehen in der Spur', t2.some(e => /boom test/.test(e.message)), t2);

await browser.close();
for (const o of ok) console.log('  ✓ ' + o);
for (const e of errors) console.log('  ✗ ' + e);
console.log(errors.length ? `${errors.length} Fehler` : `feedback_test: alle ${ok.length} Prüfungen grün`);
process.exit(errors.length ? 1 : 0);
