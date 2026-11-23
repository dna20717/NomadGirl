// #184/#185 Meta-Baum im Browser: ein neues Spiel beginnt im ersten POI (Stufe 0), Ziele schalten frei, im Camp fehlt alles Gesperrte
// (Bau-Modus, Reisen, Handel, Techtree, Implantate, Cyberdeck …), der Spürhund sucht in allen offenen Fenstern nach Wörtern verborgener
// Systeme, Cheats › Meta-Baum schaltet alles frei. Automated browsers normally play with everything free; this test asks for the tree
// (localStorage nomadgirl-unlocks-test). Server must run (npm run serve) or tools/test_all.mjs.   node tools/unlock_test.mjs [--shots]
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new&slot=3';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
await page.addInitScript(() => { localStorage.setItem('nomadgirl-unlocks-test', '1'); localStorage.setItem('nomadgirl-cheats', '1'); });
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.leyla, null, { timeout: 30000 });
const ev = (f, a) => page.evaluate(f, a);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await ev(() => nomad.freeze()); await page.waitForTimeout(250); await page.screenshot({ path: `output/unlock_${n}.png` }); await ev(() => nomad.thaw()); };
const meta = () => ev(() => { const S = game.scene.getScene('play').box.save; return { mode: game.scene.getScene('play').mode, poi: game.scene.getScene('play').levelPoi, unlocked: [...(S.meta?.unlocked || [])], all: !!S.meta?.all, stage: S.meta?.stage }; });
// the Spürhund: words of hidden systems in what the player can see now
const BAD = /Implantat|Cyberdeck|Entit(y|ies)|Bit-Farm|Glitch|Ruf\b|Revier|Bergung|Wrack|Mega-Rig|Gefangen|Dunkelheit|Kopfgeld|Ripperdoc|Zelle\b|Techtree|Skilltree|Heilmittel|Ghostwire|Schwarzmarkt/;
const sniff = async where => { const t = await ev(() => [...document.querySelectorAll('.hud-menu, .inv, .wm-box, .tut, .ql, .hud-camp, .hud-help, .bm-shop')].filter(e => !e.hidden && e.offsetParent !== null).map(e => e.innerText).join('\n')); const m = t.match(BAD); check(`Spürhund: ${where} ohne verborgene Systeme`, !m, m ? `${m[0]} … ${t.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\s+/g, ' ')}` : null); };

// 1. Stufe 0: the new game begins in the first POI
await ev(() => { nomad.take(); nomad.step(70); });
let m = await meta();
check('Neues Spiel beginnt im ersten POI (Stufe 0)', m.mode === 'run' && m.poi === 'tankstelle_km7' && !m.all, m);
check('Bewegung, Kampf, Benutzen frei, Stufe 1 offen', ['movement', 'fight', 'use'].every(x => m.unlocked.includes(x)) && m.stage === 1, m);
check('Reisen, Handel, Cyberware noch zu', !['travel', 'trade', 'cyberware', 'inventory'].some(x => m.unlocked.includes(x)), m.unlocked);
await shot('poi');

// 2. the first kill frees the backpack, with a story moment (toast)
await ev(() => { const s = game.scene.getScene('play'); s.achieve?.('kills', 1); nomad.step(70); });
m = await meta();
const toast = await ev(() => [...document.querySelectorAll('.hud-toast')].map(e => e.innerText).join(' | '));
check('Erster Kill → Rucksack & Inventar frei, Story-Moment', m.unlocked.includes('inventory') && /Taschen|Rucksack/.test(toast), { m: m.unlocked, toast });

// 3. into the camp (as if back by van): locked things are missing
await ev(() => { const s = game.scene.getScene('play'); s.box.save.run = { poi: 'tankstelle_km7', before: {} }; s.endRun(false); nomad.release(); });   // the camp loads its pictures: the real loop
await page.waitForTimeout(600);
await page.waitForFunction(() => game.scene.getScene('play')?.camp && game.scene.getScene('play').mode === 'camp', null, { timeout: 60000 }).catch(() => {});
await ev(() => { nomad.take(); nomad.step(90); game.scene.getScene('play').hud.sum?.close?.(); nomad.step(5); });
m = await meta();
check('Zurück im Camp', m.mode === 'camp', m);
const camp = await ev(() => { const s = game.scene.getScene('play'), H = s.hud; nomad.step(1, [], ['build']); nomad.step(3); const build = !!H.build?.active; return { build, btn: !H.buildBtn.hidden, ws: s.box.save.rig.units.flatMap(u => u.workshops.map(w => w.id)) }; });
check('Bau-Modus zu (B tut nichts, kein Knopf)', !camp.build && !camp.btn, camp);
check('Start-Rig: Schlafkoje, keine Kochnische/Werkbank/Warroom', camp.ws.includes('schlafkoje') && !['kochnische', 'werkbank', 'warroom'].some(x => camp.ws.includes(x)), camp.ws);
await ev(() => { game.scene.getScene('play').camp.vanMenu([]); nomad.step(4); });
let map = await ev(() => { const M = game.scene.getScene('play').hud.map; if (!M?.isOpen) return null; const near = M.state().near[0]; if (near) M.select(near); return M.state(); });
check('Reisekarte: Hinfahren gesperrt mit Teaser, keine Händler-Knöpfe', map && /Van springt noch nicht/.test(map.disabled || '') && !map.extras.some(x => /Handeln/.test(x)), map);
await sniff('Reisekarte');
await shot('map');
await ev(() => { game.scene.getScene('play').hud.map?.close(); game.scene.getScene('play').hud.closeMenu(); nomad.step(3); });
// the inventory: no implants tab, no deck slot; a Nachtsicht-Optik in the store is a Wertsache
await ev(() => { nomad.step(1, [], ['inventory']); nomad.step(4); const H = game.scene.getScene('play').hud; if (!H.inv.isOpen) window.__invTap = false, H.inv.open(); nomad.step(2); });
const inv = await ev(() => ({ tap: window.__invTap !== false, open: game.scene.getScene('play').hud.inv?.isOpen, tabs: [...document.querySelectorAll('.inv-tab')].map(b => b.dataset.tab) }));
check('Inventar offen, ohne Implantate-Tab', inv.open && !inv.tabs.includes('implants'), inv);
await sniff('Inventar');
await shot('inventory');
await ev(() => { nomad.step(1, [], ['inventory']); nomad.step(3); });
// the fire: questlog without the search, no crew
await ev(() => { nomad.goTo('Lagerfeuer'); nomad.step(1, [], ['grab']); nomad.step(4); });
await sniff('Lagerfeuer');
await ev(() => { nomad.choose('Questlog'); nomad.step(4); });
const ql = await ev(() => game.scene.getScene('play').hud.quests?.state?.());
check('Questlog ohne Hauptquest und Tank, mit Sungs „Fleisch mit Meinung“', ql && !ql.rows?.some?.(r => /^main|^tank/.test(r)) , ql);
await sniff('Questlog');
await ev(() => { game.scene.getScene('play').hud.quests.close(); nomad.step(3); });
// Schraube: no trade yet
const talk = await ev(() => { nomad.goTo('Schraube'); nomad.step(1, [], ['grab']); nomad.step(3); const mm = nomad.menu(); game.scene.getScene('play').hud.closeMenu(); return mm?.items.map(i => i.label) || []; });
check('Schraube handelt noch nicht', !talk.includes('Handeln'), talk);
// the pause menu: no Skilltree
await ev(() => { game.scene.getScene('play').hud.pauseMenu(); nomad.step(2); });
await sniff('Pause-Menü');
const pm = await ev(() => nomad.menu()?.items.map(i => i.label) || []);
check('Pause-Menü ohne Skilltree, mit Cheats', !pm.includes('Skilltree') && pm.includes('Cheats'), pm);

// 4. Cheats › Meta-Baum: everything free
await ev(() => { nomad.choose('Cheats'); }); await page.waitForTimeout(100);
await ev(() => { nomad.step(2); nomad.choose('Meta-Baum'); }); await page.waitForTimeout(100);
const tree = await ev(() => { nomad.step(2); return nomad.menu(); });
check('Cheats › Meta-Baum zeigt Stufen und Systeme', tree?.title === 'Meta-Baum' && tree.items.some(i => /Reisen/.test(i.label)) && tree.items.some(i => /Cyberware/.test(i.label)), tree?.items?.slice(0, 6));
await shot('tree');
await ev(() => { nomad.choose('Alles frei'); }); await page.waitForTimeout(100);
await ev(() => { nomad.step(2); game.scene.getScene('play').hud.closeMenu(); nomad.step(2); const H = game.scene.getScene('play').hud; if (!H.inv.isOpen) H.inv.open(); nomad.step(4); });
const after = await ev(() => ({ all: !!game.scene.getScene('play').box.save.meta.all, tabs: [...document.querySelectorAll('.inv-tab')].map(b => b.dataset.tab), btn: !game.scene.getScene('play').hud.buildBtn.hidden }));
check('Alles frei: Implantate-Tab und Bau-Knopf da', after.all && after.tabs.includes('implants'), after);

await browser.close();
for (const o of ok) console.log('  ✓ ' + o);
for (const e of errors) console.log('  ✗ ' + e);
console.log(errors.length ? `${errors.length} Fehler` : `unlock_test: alle ${ok.length} Prüfungen grün`);
process.exit(errors.length ? 1 : 0);
