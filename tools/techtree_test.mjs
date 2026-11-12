// The tech tree in the warroom (design.md › Progression): Warroom › Techtree opens the screen, tabs, moving between nodes,
// unlocking costs resources from the camp, unlocks recipes and bonuses, the tank decays slower, Lebenszeichen shows AvA in the run.
// node tools/techtree_test.mjs [--shots]   (server must run: npm run serve)
import { chromium } from 'playwright';
import fs from 'node:fs';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`);
const ev = (fn, a) => page.evaluate(fn, a);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.waitForTimeout(300); await page.screenshot({ path: `output/techtree_${n}.png` }); };

await page.goto('http://localhost:8766/game.html?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp, null, { timeout: 40000 });
let v = await ev(() => { nomad.take(); nomad.step(5);
  const s = nomad.save(), g = s.inv.grids.chest; g.items = [];
  g.items.push({ a: 'items', id: 'technik', n: 12, x: 0, y: 0, r: 0 }, { a: 'items', id: 'wissen', n: 4, x: 1, y: 0, r: 0 }, { a: 'items', id: 'bio', n: 1, x: 2, y: 0, r: 0 });
  nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.choose('Planen'); const m = nomad.menu(); nomad.choose('Techtree'); nomad.step(3);
  return { menu: m.items.map(i => i.label), t: nomad.tech() }; });
check('Warroom › Techtree öffnet den Bildschirm, erster Tab Technik, Auswahl auf dem ersten bereiten Knoten', v.menu.includes('Techtree') && v.t?.open && v.t.tab === 'technik' && v.t.sel === 'wartungsklappe', v);
await shot('open');

v = await ev(() => { nomad.step(1, [], ['grab']); nomad.step(2); const s = nomad.save(); return { t: nomad.tech(), nodes: s.nodes, dicht: s.recipes.includes('tank_dichtung'), tech: s.inv.grids.chest.items.find(e => e.id === 'technik')?.n }; });
check('E schaltet frei: kostet 3 Technik, lernt „Dichtung tauschen“', v.nodes.includes('wartungsklappe') && v.dicht && v.tech === 9, v);
v = await ev(() => { const r0 = (() => { const s = nomad.save(); return s.tank.cond; })(); nomad.step(1, [], ['right']); nomad.step(2); const sel = nomad.tech().sel; nomad.step(1, [], ['grab']); nomad.step(2); return { sel, nodes: nomad.save().nodes, t: nomad.tech() }; });
check('→ springt zum nächsten Knoten, E schaltet die Thermohülle frei', v.sel === 'thermohuelle' && v.nodes.includes('thermohuelle'), v);
v = await ev(() => { nomad.step(1, [], ['down']); nomad.step(2); nomad.step(1, [], ['down']); nomad.step(2); const sel = nomad.tech().sel; nomad.step(1, [], ['grab']); nomad.step(2); return { sel, nodes: nomad.save().nodes, st: nomad.tech().nodes }; });
check('Notreserve: zu wenig Bio, bleibt gesperrt', v.sel === 'notreserve' && !v.nodes.includes('notreserve') && v.st.find(n => n.id === 'notreserve').state === 'open', v);
await shot('tree');
v = await ev(() => { nomad.step(1, [], ['holster']); nomad.step(2); const t = nomad.tech(); nomad.step(1, [], ['grab']); nomad.step(2); return { t, nodes: nomad.save().nodes }; });
check('Q wechselt den Tab (Wissen), Lebenszeichen freischalten', v.t.tab === 'wissen' && v.t.sel === 'lebenszeichen' && v.nodes.includes('lebenszeichen'), v);
await shot('wissen');
v = await ev(() => { nomad.step(1, [], ['help']); nomad.step(2); return nomad.tech().open; });
check('Esc schließt', v === false, v);

// bonuses: the tank decays slower with the Thermohülle; the vital signs show in the run
v = await ev(async () => { const { rate } = await import('/game/tank.js'); const sc = game.scene.getScene('play'), s = nomad.save(), D = sc.data_;
  const a = rate(D, s); const keep = s.nodes; s.nodes = []; const b = rate(D, s); s.nodes = keep; return { a, b }; });
check('Thermohülle: Tank verfällt 15 % langsamer', Math.abs(v.a / v.b - 0.85) < 0.001, v);
v = await ev(() => { nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.choose('Planen'); nomad.choose('Plündern'); nomad.step(20); return document.querySelector('.hud-vital')?.textContent || null; });
check('Lebenszeichen: AvAs Zustand im Run', /AvA.*100 % · Stabil/.test(v || ''), v);
await shot('run');

await browser.close();
console.log(ok.map(n => '✔ ' + n).join('\n'));
if (errors.length) { console.log('✖ ' + errors.join('\n✖ ')); }
console.log(`${ok.length} ok, ${errors.length} Fehler`);
process.exit(errors.length ? 1 : 0);
