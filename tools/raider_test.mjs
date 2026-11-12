// Raider-Bausatz (#004) im Kampfraum: alle Raider aus dem Bausatz, Köpfe, Waffen, Farben, Zustände (Gehen, Rennen, Alarm,
// Ducken, Angriff leicht/beidhändig, Schuss Pistole/Langwaffe, Treffer, Tod), Mündung an der echten Waffe.
//   npm run serve &   node tools/raider_test.mjs [--shots]
import { chromium } from 'playwright';

const shots = process.argv.includes('--shots');
const url = (process.env.GAME_URL || 'http://localhost:8766/game.html') + '?room=kampfraum';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.nomad && window.game && !document.querySelector('#load.loading-on'), null, { timeout: 60000 });
await page.evaluate(() => nomad.take());

let ok = 0, bad = 0;
const check = (name, cond, info) => { if (cond) { ok++; console.log('✔', name); } else { bad++; console.log('✘', name, info !== undefined ? JSON.stringify(info) : ''); } };
const RAIDERS = ['schlaeger', 'schuetze', 'keulenschwinger', 'brecher', 'gewehrschuetze', 'schrotflinter', 'pistolero', 'schildtraeger'];

// a line-up: Leyla far left, one raider per 3 tiles; enemies frozen in place for the pictures
const lineup = await page.evaluate(ids => {
  const s = game.scene.getScene('play');
  for (const e of s.enemies) e.destroy();
  s.enemies.length = 0;
  nomad.tpTile(3, 15);
  return ids.map((id, i) => nomad.spawn(id, 8 + i * 3, 14));
}, RAIDERS);
await page.evaluate(() => nomad.step(3));
const kits = await page.evaluate(() => game.scene.getScene('play').enemies.map(e => ({ id: e.id, cls: e.look.cls, states: Object.keys(e.look.anims || {}), key: e.sprite.texture.key, w: e.sprite.displayWidth, h: e.sprite.displayHeight })));
check('alle Raider kommen aus dem Bausatz (Animationen statt Platzhalter)', kits.every(k => k.states.length >= 6 && k.key.startsWith('kit:')), kits);
check('Waffenklassen: leicht, beidhändig, Pistole, Langwaffe', ['light', 'heavy', 'pistol', 'long'].every(c => kits.some(k => k.cls === c)), kits.map(k => k.cls));
check('jede Klasse hat Alarm, Gehen, Rennen, Ducken, Angriff, Treffer, Tod', kits.every(k => ['alert', 'walk', 'run', 'crouch', 'attack', 'hit', 'death'].every(s => k.states.includes(s))), kits.map(k => k.states));
check('Größe im Spiel wie eingestellt (≈ 180 px)', kits.every(k => k.h > 150 && k.h < 230), kits.map(k => Math.round(k.h)));

// composed pixels: weapon drawn (the strip differs from the plain body strip), heads and colours differ between raiders
const px = await page.evaluate(() => {
  const s = game.scene.getScene('play');
  const sum = key => { const src = s.textures.get(key).getSourceImage(); const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d'); x.drawImage(src, 0, 0); const d = x.getImageData(0, 0, 256, 256).data; let n = 0, g = 0, h = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { n++; h = (h * 31 + d[i] * 7 + d[i + 1] * 3 + d[i + 2]) % 1e9; if (d[i + 1] > 150 && d[i + 1] > d[i] + 60 && d[i + 1] > d[i + 2] + 60) g++; } return { n, g, h }; };
  return s.enemies.map(e => ({ id: e.id, comp: sum(e.look.anims.alert.key), body: sum('raider_' + e.look.cls + '_alert') }));
});
check('Waffe ins Bild gesetzt (mehr Pixel als der Körper allein)', px.every(p => p.comp.n > p.body.n + 60), px.map(p => [p.id, p.comp.n - p.body.n]));
check('kein grüner Platzhalter mehr im Bild', px.every(p => p.comp.g < 20), px.map(p => [p.id, p.comp.g]));
check('Köpfe und Farben machen jeden anders', new Set(px.map(p => p.comp.h)).size === px.length, px.map(p => p.comp.h));

if (shots) {   // contact sheet of the composed strips: one row per raider, alert + walk + attack frames
  const url = await page.evaluate(() => {
    const s = game.scene.getScene('play'), es = s.enemies, rows = es.map(e => ['alert', 'walk', 'run', 'crouch', 'attack', 'hit'].map(st => e.look.anims[st]).filter(Boolean));
    const W = 128, c = document.createElement('canvas'); c.width = W * 16; c.height = W * es.length; const x = c.getContext('2d');
    x.fillStyle = '#2a2433'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = false;
    rows.forEach((r, i) => { let col = 0; for (const a of r) { const src = s.textures.get(a.key).getSourceImage(); for (let f = 0; f < a.frames && col < 16; f += Math.max(1, Math.floor(a.frames / 3))) x.drawImage(src, f * 256, 0, 256, 256, (col++) * W, i * W, W, W); } });
    return c.toDataURL();
  });
  (await import('fs')).writeFileSync('output/raider_kits.png', Buffer.from(url.split(',')[1], 'base64'));
}

// states: walk / run / alert / crouch / attack / hit / death on one raider each
const R = await page.evaluate(() => {
  const s = game.scene.getScene('play'), out = {}, now = () => s.now;
  const e = s.enemies.find(x => x.id === 'brecher'), g = s.enemies.find(x => x.id === 'gewehrschuetze'), p = s.enemies.find(x => x.id === 'pistolero'), k = s.enemies.find(x => x.id === 'keulenschwinger');
  // walking and running come from the speed
  e.state = 'patrol'; e.body.setVelocityX(80); e.body.blocked.down = true; e.draw(now()); out.walk = e.kitState;
  e.body.setVelocityX(400); e.draw(now()); out.run = e.kitState;
  e.body.setVelocityX(0); e.state = 'engage'; e.draw(now()); out.alert = e.kitState;
  // windup of the heavy hit: the first frames of the attack
  e.state = 'windup'; e.windupEnd = now() + 300; e.a.windup = 700; e.draw(now()); out.windup = [e.kitState, Number(e.sprite.frame.name)];
  e.state = 'strike'; e.strikeAt = now() - 120; e.draw(now()); out.strike = [e.kitState, Number(e.sprite.frame.name)];
  // light hit
  k.state = 'strike'; k.strikeAt = now() - 100; k.draw(now()); out.light = [k.kitState, k.look.cls];
  // shot: recoil after the shot, muzzle at the drawn weapon (in front of him, at chest height)
  g.facing = 1; g.state = 'recover'; g.shotAt = now(); g.draw(now()); out.shot = [g.kitState, g.look.cls];
  const m = g.muzzle(); out.muzzle = { dx: Math.round(m.x - g.x), up: Math.round(g.feet - m.y), h: g.h };
  p.facing = -1; p.state = 'recover'; p.shotAt = now(); p.draw(now()); const pm = p.muzzle(); out.pistol = [p.kitState, p.look.cls, Math.round(pm.x - p.x)];
  return out;
});
check('Gehen, Rennen, Alarm nach Tempo und Zustand', R.walk === 'walk' && R.run === 'run' && R.alert === 'alert', R);
check('Beidhändiger Hieb: Ausholen in der Warnung, Schlag danach', R.windup[0] === 'attack' && R.windup[1] <= 3 && R.strike[0] === 'attack' && R.strike[1] >= 3, R);
check('Leichter Hieb spielt den Angriff', R.light[0] === 'attack' && R.light[1] === 'light', R.light);
check('Schuss Langwaffe: Rückstoß + Mündung vorn an der Waffe', R.shot[0] === 'attack' && R.shot[1] === 'long' && R.muzzle.dx > 40 && R.muzzle.up > R.muzzle.h * 0.55, R);
check('Schuss Pistole, auch nach links gespiegelt', R.pistol[0] === 'attack' && R.pistol[1] === 'pistol' && R.pistol[2] < -30, R.pistol);

// ducking: a nail at chest height → down (box lower), the nail flies over, he stands up again
const D = await page.evaluate(() => {
  const s = game.scene.getScene('play'), g = s.enemies.find(x => x.id === 'gewehrschuetze');
  for (const e of s.enemies) if (e !== g) { e.state = 'patrol'; e.body.enable = false; e.sprite.setVisible(false); }
  g.C.duck = 100; g.duckReady = 0; g.state = 'engage'; g.facing = -1;
  const l = s.leyla;
  nomad.tpTile(Math.floor(g.x / s.T) - 6, 15);
  const before = Math.round(g.body.height), hp = g.hp;
  // a friendly nail flying at him at Leyla's chest (only for the roll; removed right after)
  const y = g.feet - g.bodyH * 0.62, fake = { x: g.x - 300, y, vx: 1800, vy: 0, friendly: true, dead: false };
  s.combat.shots.push(fake);
  g.watchDuck(s.now);
  const st = g.state, low = Math.round(g.body.height), frame = (g.draw(s.now), g.kitState);
  s.combat.shots = s.combat.shots.filter(p => p !== fake);
  nomad.step(Math.ceil(g.C.duckTime / 16) + 20);
  return { before, st, low, frame, after: g.state, h: Math.round(g.body.height), hp, hp2: g.hp };
});
check('Ducken: Nagel auf Brusthöhe → geduckt, Box niedriger, Animation Ducken', D.st === 'duck' && D.low < D.before * 0.7 && D.frame === 'crouch', D);
check('… und steht danach wieder auf', D.after !== 'duck' && D.h === D.before, D);

// hit + death: hit animation, then the death animation (the dropped weapon: test/loot_weapons.test.js)
const K = await page.evaluate(() => {
  const s = game.scene.getScene('play'), e = s.enemies.find(x => x.id === 'schlaeger');
  e.body.enable = true; e.sprite.setVisible(true); e.d = { ...e.d, dropWeapon: 100 };
  e.hit(s.now, 1, 50, 1, false, { kind: 'melee' }); e.draw(s.now); const hit = e.kitState;
  e.hit(s.now, 999, 50, 1, false, { kind: 'melee' }); nomad.step(30);
  const dead = e.kitState;
  return { hit, dead, frame: Number(e.sprite.frame.name) };
});
check('Treffer spielt die Treffer-Animation', K.hit === 'hit', K);
check('Tod fällt um (Tod-Animation)', K.dead === 'death' && K.frame > 2, K);

check('keine Fehler in der Konsole', !errors.length, errors);
console.log(`${ok} ok, ${bad} Fehler`);
await browser.close();
process.exit(bad ? 1 : 0);
