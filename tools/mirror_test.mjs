// Leylas Signaturfarbe (#044): the mirror from the dealer's Deko tab, E opens the colours, a Färbemittel unlocks and dyes, the camp
// comes back with Leyla's textures recoloured (pink pixels gone, green there), the inventory portrait too; back to pink.
// Server must run (npm run serve).   node tools/mirror_test.mjs [--shots]   pictures to output/mirror_*.png
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new';
const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/\/api\/|version\.json/.test(m.location()?.url || '')) errors.push(m.text()); });
const check = (name, cond, info) => { if (cond) ok.push(name); else errors.push(`${name}: ${JSON.stringify(info)}`); };
const ev = f => page.evaluate(f);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await ev(() => nomad.freeze()); await page.waitForTimeout(300); await page.screenshot({ path: `output/mirror_${n}.png` }); await ev(() => nomad.thaw()); };
const ready = () => page.waitForFunction(() => window.nomad && window.game?.scene?.getScene?.('play')?.camp && !game.scene.getScene('play').restarting, null, { timeout: 30000 });
// how many pixels of Leyla's idle strip are in the signature's pink (skin stays) / green
const colours = () => ev(() => {
  const s = game.scene.getScene('play'), id = s.data_.leyla.look.idle, src = s.textures.get(id).getSourceImage(), cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height; const c = cv.getContext('2d'); c.drawImage(src, 0, 0);
  const d = c.getImageData(0, 0, cv.width, cv.height).data; let pink = 0, green = 0;
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const [r, g, b] = [d[i], d[i + 1], d[i + 2]]; const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, dd = mx - mn, sat = dd ? dd / (1 - Math.abs(2 * l - 1)) : 0; let h = 0; if (dd) { const R = r / 255, G = g / 255, B = b / 255; h = mx === R ? ((G - B) / dd + 6) % 6 : mx === G ? (B - R) / dd + 2 : (R - G) / dd + 4; h *= 60; } if (h >= 290 && h <= 350 && sat >= 0.35) pink++; if (g > 120 && g > r + 40 && g > b + 40) green++; }
  return { pink, green };
});

await page.goto(url);
await ready();
const before = await colours();
let r = await ev(() => {
  const s = game.scene.getScene('play'), save = s.box.save, out = {};
  save.deltas = 5000; s.openBuild();
  const bm = s.hud.build, camp = s.camp;
  bm.buyDecor('spiegel'); const g = camp.decorSpots('spiegel')[10]; bm.placeDecor({ x: g.x, y: g.y });
  out.placed = save.rig.decor.map(x => x.id);
  s.closeBuild?.(); bm.close?.();
  return out;
});
check('Spiegel beim Händler gekauft und aufgestellt', r.placed.includes('spiegel'), r);
await page.waitForTimeout(800);
await ready();
r = await ev(() => {
  nomad.take(); nomad.step(20);
  const s = game.scene.getScene('play'), h = s.camp.hotspots.find(x => x.name === 'Spiegel');
  if (!h) return { none: true, names: s.camp.hotspots.map(x => x.name) };
  nomad.walkTo(h.x); nomad.step(200); nomad.step(1, [], ['grab']); nomad.step(2);
  return { title: s.hud.menuTitle, items: s.hud.menuItems?.map(i => i.label + (i.disabled ? '×' : '')), pic: !!document.querySelector('.hud-menuPic img') };
});
check('E am Spiegel: Farben, Neonpink zuerst, ohne Färbemittel gesperrt', r.title === 'Spiegel' && r.items?.[0] === 'Neonpink' && r.items.includes('Giftgrün×') && r.pic, r);
await shot('menu');
// a packet of green into the Camp-Lager, choose it
r = await ev(async () => {
  const s = game.scene.getScene('play'), C = await import('/game/crafting.js');
  s.hud.closeMenu?.(); C.give(s.data_, s.box.save, 'faerbemittel_giftgruen', 1);
  const h = s.camp.hotspots.find(x => x.name === 'Spiegel'); h.act(); nomad.step(2);
  const i = s.hud.menuItems.findIndex(x => x.label === 'Giftgrün'), dis = !!s.hud.menuItems[i].disabled;
  s.hud.choose(i); for (let k = 0; k < 6; k++) nomad.step(30);
  return { dis, look: s.box.save.look, left: C.have(s.data_, s.box.save, 'faerbemittel_giftgruen') };
});
check('Giftgrün: Packung verbraucht, Farbe frei und getragen', !r.dis && r.look?.color > 0 && r.look.unlocked.includes(r.look.color) && r.left === 0, r);
await page.waitForFunction(() => { if (game.__signatureKey !== '#59c135') nomad.step(10); return game.__signatureKey === '#59c135' && game.scene.getScene('play')?.camp; }, null, { timeout: 30000, polling: 200 });   // the camp came back in the new colour
const after = await colours();
check('Leylas Pixel: Pink weg, Grün da', before.pink > 200 && after.pink < before.pink * 0.05 && after.green > before.pink * 0.5, { before, after });
await shot('green');
r = await ev(() => { const s = game.scene.getScene('play'); s.hud.inv.open(); return document.querySelector('.inv-figure img')?.getAttribute('src')?.slice(0, 22); });
await page.waitForTimeout(800);
r = await ev(() => document.querySelector('.inv-figure img')?.getAttribute('src')?.slice(0, 22));
check('Inventar-Bild in der Signaturfarbe (gefärbtes Bild)', r === 'data:image/png;base64,', r);
// back to pink: free
r = await ev(() => {
  const s = game.scene.getScene('play'); s.hud.inv.close();
  const h = s.camp.hotspots.find(x => x.name === 'Spiegel'); h.act(); nomad.step(2);
  s.hud.choose(0); const look = structuredClone(s.box.save.look); for (let k = 0; k < 6; k++) nomad.step(30); return look;
});
await page.waitForFunction(() => { if (game.__signatureKey !== '') nomad.step(10); return game.__signatureKey === '' && game.scene.getScene('play')?.camp; }, null, { timeout: 30000, polling: 200 });
const back = await colours();
check('Zurück zu Neonpink, kostenlos', r.color === 0 && back.pink === before.pink && back.green === before.green, { r, back, before });

await browser.close();
for (const o of ok) console.log('✔', o);
for (const e of errors) console.log('✘', e);
console.log(errors.length ? `${ok.length} ok, ${errors.length} Fehler` : `Spiegel: alle ${ok.length} Prüfungen ok`);
process.exit(errors.length ? 1 : 0);
