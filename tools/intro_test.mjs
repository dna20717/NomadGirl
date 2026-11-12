#!/usr/bin/env node
// Intro comic (#005) in the headless browser: all panels with pictures, captions type and finish, pages turn,
// back and skip work, a controller advances, the end leads back to the main menu, the main menu offers the intro.
// Server must run (npm run serve).   node tools/intro_test.mjs [--shots]   (images → output/intro_*.png)
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const shots = process.argv.includes('--shots');
const data = JSON.parse(fs.readFileSync(path.join(repo, 'projects/nomadgirl/data/intro.json'), 'utf8'));
const count = Object.keys(data).length;
let failed = 0;
const check = (ok, text) => { console.log(`  ${ok ? 'ok  ' : 'FEHLER'} ${text}`); if (!ok) failed++; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await page.addInitScript(() => {
  const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)', index: 0, connected: true, mapping: 'standard', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  window.setPad = (press = []) => pad.buttons.forEach((b, i) => { b.pressed = press.includes(i); b.value = b.pressed ? 1 : 0; });
  navigator.getGamepads = () => [pad, null, null, null];
});
await page.goto('http://localhost:8766/intro.html');
await page.waitForFunction(() => window.intro, null, { timeout: 15000 });
const ev = f => page.evaluate(f);
const info = await ev(() => ({ panels: intro.panels, images: intro.images, s: intro.state() }));
check(info.panels === count && info.images === count, `${info.panels} Panels, ${info.images} mit Bild (Daten: ${count})`);
check(info.s.panel === 'panel_1' && info.s.page === 1, `beginnt mit ${info.s.panel} auf Seite ${info.s.page}`);

// captions: one press finishes typing, the next one opens the next box
await page.waitForTimeout(700);
const typing = (await ev(() => intro.state())).typing;
await ev(() => intro.next());
const after = await ev(() => intro.state());
check(typing && !after.typing && after.caption === 0, 'Taste vervollständigt die Textbox, die gerade schreibt');
await ev(() => intro.next());
check((await ev(() => intro.state())).caption === 1, 'nächste Taste öffnet die zweite Textbox');

// controller: A advances
const before = await ev(() => intro.state());
await ev(() => setPad([0])); await page.waitForTimeout(120); await ev(() => setPad()); await page.waitForTimeout(120);
const padStep = await ev(() => intro.state());
check(padStep.typing !== before.typing || padStep.caption !== before.caption || padStep.index !== before.index, 'A am Controller blättert weiter');

// through all panels, collecting the pages
const pages = new Set(), seen = new Set();
for (let i = 0; i < 80; i++) {
  const s = await ev(() => intro.state());
  if (s.ended) break;
  pages.add(s.page); seen.add(s.panel);
  if (shots && !s.typing && s.caption === s.captions - 1) { await page.waitForTimeout(1500); await page.screenshot({ path: path.join(repo, `output/intro_${s.panel}.png`) }); }
  await ev(() => intro.next());
}
check(seen.size === count, `alle ${seen.size} Panels gezeigt`);
check(pages.size >= 2, `${pages.size} Comic-Seiten`);
const end = await ev(() => intro.state());
check(end.ended, 'nach dem letzten Panel kommt der Titel');

// back from the title returns to the last panel, back across a page turns the page back
await ev(() => intro.back());
const back1 = await ev(() => intro.state());
await ev(() => intro.back());
const back2 = await ev(() => intro.state());
check(!back1.ended && back2.index === back1.index - 1, `zurück: Titel → ${back1.panel} → ${back2.panel} (Seite ${back2.page})`);

// skip: Esc shows the title, the second Esc leaves for the main menu
await page.keyboard.press('Escape');
check((await ev(() => intro.state())).ended, 'Esc springt zum Titel');
await Promise.all([page.waitForURL(u => !u.pathname.endsWith('intro.html'), { timeout: 8000 }), page.keyboard.press('Escape')]);
check(new URL(page.url()).pathname === '/', `zweites Esc führt ins Hauptmenü (${new URL(page.url()).pathname})`);

// workshop › Spielen in the area Intro opens the comic at the chosen panel, the panels before it on that page are there
{
  const second = Object.entries(data).find(([, x]) => (x.order ?? 0) > 1 && Object.values(data).some(y => y.page === x.page && (y.order ?? 0) < x.order));
  if (second) {
    const p2 = await browser.newPage({ viewport: { width: 1200, height: 700 } });
    await p2.goto(`http://localhost:8766/intro.html?panel=${second[0]}`);
    await p2.waitForFunction(() => window.intro, null, { timeout: 15000 });
    const s = await p2.evaluate(() => intro.state());
    check(s.panel === second[0] && s.shown.length >= 2, `?panel=${second[0]} beginnt dort, mit ${s.shown.length - 1} Panel(s) davor auf Seite ${s.page}`);
    await p2.close();
  }
}

// main menu: the intro is there to choose (Daniel: only on purpose)
await page.waitForFunction(() => window.menu, null, { timeout: 15000 });
const links = await ev(() => [...document.querySelectorAll('nav a')].map(a => a.getAttribute('href')));
check(links.includes('intro.html'), 'Hauptmenü hat den Eintrag „Intro“');
check(!errors.length, `keine Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
console.log(failed ? `\n${failed} Fehler` : '\nIntro: alles ok');
process.exit(failed ? 1 : 0);
