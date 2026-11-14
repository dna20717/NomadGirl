// Treasury + guest bunk (Daniel, 11.11.2026): the pile takes only valuables and grows in the picture, every trophy stand is an
// inventory of its own (only things tagged "trophy", in their real size), the stands show their things on the wall; guests need beds.
// Server must run (npm run serve).   node tools/treasury_test.mjs [--shots]
import fs from 'node:fs';
import { chromium } from 'playwright';

const shots = process.argv.includes('--shots');
const read = f => JSON.parse(fs.readFileSync(new URL(`../projects/nomadgirl/${f}`, import.meta.url), 'utf8'));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
const game = read('data/game.json');
game.start.containers = ['container_20'];
game.start.workshops = ['schlafkoje', 'warroom', 'schatzkammer', 'gaestekoje']; game.start.spare = [];
game.start.companions = ['schraube', 'onkel_sung'];
await page.addInitScript(g => localStorage.setItem('nomadgirl-drafts:data/game.json', JSON.stringify(g)), game);
await page.goto((process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene.getScene('play')?.camp, null, { timeout: 20000 });
const ev = (f, a) => page.evaluate(f, a);
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info)}`);

let v = await ev(() => {
  const s = game.scene.getScene('play'), b = s.camp.benches.list.find(x => x.id === 'schatzkammer');
  return { bench: !!b, stands: b?.def.stands?.length, grids: Object.keys(s.box.save.inv.grids).filter(k => /:s\d$/.test(k)).length };
});
check('Schatzkammer steht im Rig mit 4 Trophäen-Ständern (je ein Raster)', v.bench && v.stands === 4 && v.grids === 4, v);

v = await ev(() => { nomad.take(); nomad.goTo('Schatzkammer'); nomad.step(1, [], ['grab']); nomad.step(3); const u = game.scene.getScene('play').hud.inv; return { open: u.isOpen, key: u.other?.key, extra: u.other?.extra?.length, shown: document.querySelectorAll('.inv-stand .inv-grid').length }; });
check('E öffnet den Schatz mit allen Ständern im Fenster', v.open && v.extra === 4 && v.shown === 4, v);

v = await ev(() => {
  const s = game.scene.getScene('play'), u = s.hud.inv, key = u.other.key, st = k => u.other.extra[k].key;
  const hold = (a, id) => { u.held = { e: { a, id, n: 1, x: 0, y: 0, r: 0 }, from: 'backpack' }; };
  const out = {};
  hold('items', 'schrott'); u.place(key, 0, 0); out.junkPile = !u.held; u.held = null;
  hold('items', 'goldzahn'); u.place(key, 0, 0); out.valuablePile = !u.held;
  hold('items', 'goldzahn'); u.place(st(0), 0, 0); out.noTrophyStand = !u.held; u.held = null;
  hold('items', 'kristallschaedel'); u.place(st(0), 0, 0); out.bigOnShelf = !u.held; u.held = null;
  hold('items', 'kristallschaedel'); u.place(st(3), 0, 0); out.skullPedestal = !u.held;
  hold('weapons', 'revolver'); u.held = null;
  hold('items', 'revolver'); u.place(st(1), 0, 1); out.revolverHooks = !u.held;
  hold('items', 'schneekugel'); u.place(st(2), 1, 0); out.globeShelf = !u.held;
  nomad.step(40);
  const b = s.camp.benches.list.find(x => x.id === 'schatzkammer');
  out.fill = +b.fill.toFixed(3); out.trophies = b.trophies.length; out.sizes = b.trophies.map(o => Math.round(o.displayWidth));
  return out;
});
check('Haufen nimmt nur Wertsachen', !v.junkPile && v.valuablePile, v);
check('Ständer nehmen nur Trophäen, große Dinge passen nur auf große Ständer', !v.noTrophyStand && !v.bigOnShelf && v.skullPedestal && v.revolverHooks && v.globeShelf, v);
check('Haufen wächst im Bild, Trophäen stehen an der Wand in ihrer Größe', v.fill > 0 && v.trophies === 3 && Math.max(...v.sizes) > Math.min(...v.sizes) * 1.4, v);
await ev(() => game.scene.getScene('play').hud.inv.close());
if (shots) {
  fs.mkdirSync('output', { recursive: true });
  await ev(() => { const s = game.scene.getScene('play'), b = s.camp.benches.list.find(x => x.id === 'schatzkammer'), key = `store:${b.place}`, inv = s.hud.inv;
    s.hud.inv.open(); const add = (k, a, id) => { const g = s.box.save.inv.grids[k]; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { inv.held = { e: { a, id, n: 1, x: 0, y: 0, r: 0 }, from: 'backpack' }; inv.other = { key: k, grid: g }; inv.place(k, x, y); if (!inv.held) return; } inv.held = null; };
    for (const id of ['geldbuendel', 'geldbuendel', 'ring', 'luxusuhr', 'juwelenchip', 'taschenuhr', 'discokugel', 'goldzahn', 'ring']) add(key, 'items', id);
    for (const [i, id] of [[0, 'baseball'], [0, 'taschenuhr'], [0, 'ring'], [1, 'neonschild'], [1, 'luxusuhr'], [1, 'winkekatze'], [1, 'schallplatte'], [2, 'ring'], [2, 'handheld'], [2, 'schneekugel'], [3, 'goetzenfigur'], [3, 'datenkristall']]) add(`${key}:s${i}`, 'items', id);
    inv.close(); nomad.step(40); nomad.goTo('Schatzkammer'); nomad.step(20); s.cam.stopFollow(); const bb = s.camp.benches.list.find(x => x.id === 'schatzkammer'); s.cam.setZoom(2.2); s.cam.centerOn(bb.cx, bb.floor - 170);  nomad.step(2); nomad.freeze(); window.__tro = bb.trophies.map(o => [o.texture.key, o.frame.name, Math.round(o.x + bb.off[0]), Math.round(o.y + bb.off[1])]); window.__clip = bb.clip; });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'output/treasury.png' });
  await ev(() => nomad.thaw());
}
// guests: Onkel Sung rides as a guest; with the guest bunk he has a bed, without it he waits where they are
v = await ev(async () => {
  const { passengers } = await import('./game/rig.js');
  const s = game.scene.getScene('play'), D = s.data_, save = s.box.save, with_ = passengers(D, save);
  const rig = JSON.parse(JSON.stringify(save.rig)); rig.units.forEach(u => { u.workshops = u.workshops.filter(w => w.id !== 'gaestekoje'); });
  const without = passengers(D, { ...save, rig });
  return { beds: with_.beds, riding: with_.riding, staying: without.staying };
});
check('Gästekoje: 2 Betten, Onkel Sung fährt mit; ohne Koje bleibt er', v.beds === 2 && v.riding.includes('onkel_sung') && v.staying.includes('onkel_sung'), v);
v = await ev(() => { const s = game.scene.getScene('play'), save = s.box.save, here = save.location, to = Object.keys(s.data_.locations).find(l => l !== here);
  save.rig.units.forEach(u => { u.workshops = u.workshops.filter(w => w.id !== 'gaestekoje'); });
  save.fuel = 999; s.camp.drive(to, { hours: 1, fuel: 1, food: 0, km: 10 }); return { here, to, comp: [...save.companions], waiting: save.waiting };
});
check('Fahren ohne Bett: Onkel Sung wartet am alten Ort', !v.comp.includes('onkel_sung') && v.waiting?.[v.here]?.includes('onkel_sung'), v);
await page.waitForTimeout(1500);
await page.waitForFunction(() => window.game?.scene.getScene('play')?.camp, null, { timeout: 20000 });
v = await ev(() => { const s = game.scene.getScene('play'), save = s.box.save, back = Object.keys(save.waiting || {})[0]; s.camp.drive(back, { hours: 1, fuel: 1, food: 0, km: 10 }); return { comp: [...save.companions], waiting: save.waiting }; });
check('Zurück am Ort: Onkel Sung steigt wieder ein', v.comp.includes('onkel_sung') && !Object.keys(v.waiting || {}).length, v);

console.log(ok.map(o => '✔ ' + o).join('\n'));
if (errors.length) { console.log(errors.map(e => '✘ ' + e).join('\n')); process.exitCode = 1; }
console.log(`${ok.length} ok, ${errors.length} Fehler`);
await browser.close();
