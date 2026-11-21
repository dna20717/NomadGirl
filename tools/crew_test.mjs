// Crew-Kern klein (#085): a settler waits at the fire, Leyla takes her in, gives her a job; the crew window and the effect bar.
// Server must run (npm run serve).   node tools/crew_test.mjs [--shots]
import fs from 'node:fs';
import { chromium } from 'playwright';
import { furnishedStart } from './test_fixture.mjs';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await furnishedStart(page);
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.camp, null, { timeout: 20000 });
const ev = f => page.evaluate(f);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`);

let v = await ev(async () => {
  nomad.take(); nomad.step(5);
  const s = game.scene.getScene('play'), C = await import('/game/crew.js'), save = s.box.save;
  save.applicant = C.rollPerson(s.data_, 11); save.applicant.skills = { kochen: 2 };
  s.camp.fireMenu(); nomad.step(2); const fire = (s.hud.menuItems || []).map(x => x.label);
  nomad.choose('Bewerber'); nomad.step(2); const title = s.hud.menuTitle, items = (s.hud.menuItems || []).map(x => x.label);
  nomad.choose('Aufnehmen'); nomad.step(2); const person = s.hud.menuTitle, jobs = (s.hud.menuItems || []).map(x => x.label + ' | ' + (x.sub || ''));
  return { fire, title, items, person, jobs, crew: save.crew.length, name: save.crew[0]?.name };
});
check('Am Feuer: „Bewerber: Name“, Fenster mit Fähigkeiten, Aufnehmen/Ablehnen', v.fire.some(l => /^Bewerber: /.test(l)) && /will mitfahren/.test(v.title || '') && v.items.includes('Aufnehmen') && v.items.includes('Ablehnen'), v);
check('Aufgenommen: in der Crew, ihr Fenster zeigt die Werkstätten mit dem, was sie dort bringt (Kochnische zuerst)', v.crew === 1 && v.person === v.name && /Kochnische \| Kochen \+12/.test(v.jobs[0] || ''), v);
v = await ev(async () => {
  const s = game.scene.getScene('play'), M = await import('/game/mods.js'); nomad.choose('Kochnische'); nomad.step(2);
  const job = s.box.save.crew[0].job, perfect = M.mod(s.data_, s.box.save, 'perfect');
  s.hud.closeMenu?.(); nomad.step(2); s.camp.fireMenu(); nomad.step(2); const fire = (s.hud.menuItems || []).map(x => x.label);
  nomad.choose('Crew'); nomad.step(2); const crew = (s.hud.menuItems || []).map(x => x.label + ' | ' + (x.sub || ''));
  return { job, perfect, fire, crew };
});
check('Job an der Kochnische: Boni-Bus „Perfekt kochen“ +12, im Crew-Fenster mit Job', v.job && v.perfect === 12 && v.fire.some(l => /^Crew \(1\)/.test(l)) && /Job: Kochnische · Kochen \+12/.test(v.crew[0] || ''), v);
if (shots) { fs.mkdirSync('output', { recursive: true }); await page.screenshot({ path: 'output/crew_menu.png' }); }

// #100 Rig-Moral: in the crew menu with its sources; arriving after days moves it, a new level says so
v = await ev(() => {
  const s = game.scene.getScene('play'), items = (s.hud.menuItems || []).map(x => x.label), sub = s.hud.menuSub || document.querySelector('.hud-menu p, .ui-menu p')?.textContent || '';
  nomad.choose('Moral'); nomad.step(2);
  const parts = (s.hud.menuItems || []).map(x => x.label), title = s.hud.menuTitle;
  s.hud.closeMenu?.(); nomad.step(2);   // #129 the window must be shut, or the Info-Center holds the news back
  s.box.save.morale = { value: 5, at: (s.box.save.day || 1) * 24 + (s.box.save.hour || 0) - 24 * 6 }; s.box.save.food = 50;
  const toasts0 = document.querySelectorAll('.hud-toast').length; s.crewNews(); nomad.step(2);
  const toasts = [...document.querySelectorAll('.hud-toast')].map(t => t.textContent).slice(toasts0);
  return { items, parts, title, value: s.box.save.morale.value, toasts };
});
check('#100 Crew-Menü: Moral mit Stufe und Quellen (Grundstimmung, Betten, Vorräte)', v.items.some(l => /^Moral: \d+/.test(l)) && /^Moral \d+ · /.test(v.title || '') && v.parts.some(l => /Grundstimmung/.test(l)), v);
check('#100 Nach Tagen steigt die Moral Stück für Stück, die neue Stufe wird gemeldet', v.value > 5 && v.toasts.some(t => /Stimmung: /.test(t)), v);

await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✖', e);
console.log(errors.length ? `${ok.length} ok, ${errors.length} Fehler` : `Crew: alle ${ok.length} Prüfungen ok`);
process.exit(errors.length ? 1 : 0);
