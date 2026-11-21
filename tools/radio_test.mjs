#!/usr/bin/env node
// Rig-Radio (#090): chip in the camp, N cycles stations and off, music plays (scheduled Web Audio), the DJ talks between songs, pause menu
// entry, quiet in a POI run, quiet when muted, jammed for enemies of the station's gang.   node tools/radio_test.mjs [--shots]   (server: npm run serve)
import { chromium } from 'playwright';
import fs from 'node:fs';

const shots = process.argv.includes('--shots');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [], ok = [];
page.on('pageerror', e => errors.push('Seite: ' + e.message));
const check = (name, cond, info) => (cond ? ok : errors).push(cond ? name : `${name}: ${JSON.stringify(info).slice(0, 600)}`);
const ev = (fn, a) => page.evaluate(fn, a);
const shot = async n => { if (!shots) return; fs.mkdirSync('output', { recursive: true }); await page.waitForTimeout(500); await page.screenshot({ path: `output/radio_${n}.png` }); };

await page.addInitScript(() => { try { localStorage.removeItem('nomadgirl-radio'); localStorage.removeItem('nomadgirl-mute'); } catch { /* */ } });
await page.goto((process.env.GAME_URL || 'http://localhost:8766/game.html') + '?camp&new');
await page.waitForFunction(() => window.nomad && window.game?.scene?.getScene('play')?.camp && game.scene.getScene('play').hud.radio, null, { timeout: 60000 });
await ev(() => { nomad.take(); nomad.step(10); window.SC = () => game.scene.getScene('play'); window.R = () => SC().hud.radio; SC().hud.tutorial?.setSessionOff?.(true); });

let v = await ev(() => R().state());
check('Camp: Chip „Radio aus · N“, nichts spielt', v.chip && /Radio aus/.test(v.chip) && !v.on && !v.playing, v);
v = await ev(() => { R().next(); return R().state(); });
check('N: erster Sender an, Musik läuft, Songtitel im Chip', v.on && v.station === 'delta_drive' && v.playing && v.seg?.kind === 'song' && /Delta Drive/.test(v.chip) && /♪/.test(v.chip), v);
await page.waitForTimeout(1200);
v = await ev(() => { const s = R().synth; return { step: s.step, next: s.next, now: SC().sound.context.currentTime, events: s.song?.events.length }; });
check('Der Takt läuft (Noten werden eingeplant)', v.step > 4 && v.events > 10, v);
v = await ev(() => { R().seg.until = 0; R().tick(); return R().state(); });
check('Nach dem Song redet der DJ (Text im Chip, Musik leiser)', v.seg?.kind === 'talk' && v.seg.text.length > 10 && /Velvet Vic/.test(v.chip), v);
check('#103 Der DJ ist eine Entity: ihr Gesicht im Chip', await ev(() => !!document.querySelector('.radio-chip canvas.radio-dj')));
await shot('talk');
v = await ev(() => { R().seg.until = 0; R().tick(); return R().state(); });
check('Danach wieder ein Song', v.seg?.kind === 'song' && v.playing, v);
v = await ev(() => { R().next(); R().next(); R().next(); const a = R().state(); R().next(); return { a, b: R().state() }; });
check('N weiter: Dust Radio, Saint FM, Nachtschicht, dann aus', v.a.station === 'nachtschicht' && v.a.playing && !v.b.on && !v.b.playing, v);
v = await ev(() => { SC().hud.pauseMenu(); const items = (SC().hud.menuItems || []).map(x => x.label); nomad.choose('Radio: aus'); return { items }; });
await page.waitForTimeout(150);
v = { ...v, ...(await ev(() => { const sub = (SC().hud.menuItems || []).map(x => x.label); nomad.choose('Dust Radio 88,1'); nomad.step(2); return { sub, st: R().state() }; })) };
check('Pause-Menü: „Radio“ mit allen Sendern und Aus', v.items.includes('Radio: aus') && v.sub.includes('Saint FM 98,6') && v.sub.includes('Aus') && v.st.station === 'dust_radio' && v.st.playing, v);
v = await ev(() => { SC().hud.inv.open(); R().tick(); const a = R().state().chip; SC().hud.inv.close(); R().tick(); return { a, b: R().state().chip }; });
check('Fenster offen (Inventar): Chip tritt zur Seite, danach wieder da', !v.a && !!v.b, v);
v = await ev(() => { SC().toggleMute(); R().tick(); const a = { ...R().state(), mute: SC().muted }; SC().toggleMute(); R().tick(); return { a, b: { ...R().state(), mute: SC().muted, mode: SC().mode } }; });
check('Ton aus (M): Radio schweigt, Ton an: spielt wieder', !v.a.playing && v.b.playing, v);
v = await ev(() => { nomad.save().rep = { 'Static Saints': -80 }; R().set(2); return R().state(); });
check('Saint FM als Feind der Static Saints: nur Rauschen', v.seg?.kind === 'jam' && /Static Saints/.test(v.chip), v);
await ev(() => { nomad.save().rep = {}; R().set(0); });
// the drive (TravelMode): the radio plays on, the chip lies over the drive
await ev(() => { const s = SC(); nomad.release?.(); s.data_.travel.drive.seconds = 6; s.showDrive = true; s.forceEncounter = null;
  nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(3); const mp = s.hud.map, near = nomad.map().near, to = near.find(id => { const n = nomad.save().map.nodes.find(x => x.id === id); return n?.poi && s.data_.pois?.[n.poi]; }) || near[0]; mp.select(to); document.querySelector('.wm-go').click(); nomad.release?.(); });
await page.waitForFunction(() => game.scene.getScene('play').hud.drive?.isOpen, null, { timeout: 60000 });
await page.waitForTimeout(800);
v = await ev(() => { R().tick(); const e = document.querySelector('.radio-chip'), r = e.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { ...R().state(), over: !!top?.closest('.radio-chip') }; });
check('Auf der Fahrt: Radio läuft weiter, Chip liegt über der Fahrt', v.allowed && v.playing && v.chip && v.over, v);
await shot('drive');
// the drive started after release(): a roadside stop (#054 random incident) may hold it, then drive on with its fallback answer
await page.waitForFunction(() => { const s = game.scene.getScene('play'); if (s?.hud.drive?.isOpen && s.hud.modal) s.hud.closeMenu(); return s?.mode === 'camp' && !s.hud.drive?.isOpen && s.camp; }, null, { timeout: 60000, polling: 250 });
await page.waitForTimeout(800);
await ev(() => { nomad.take(); nomad.step(5); SC().showDrive = false; SC().hud.sum?.close?.(); SC().hud.closeMenu?.(); });
// a POI run: the radio stays in the rig
v = await ev(() => { SC().hud.closeMenu?.(); const TU = SC().hud.tutorial; if (TU?.state?.().open) TU.close(); nomad.goTo('Van'); nomad.step(1, [], ['grab']); nomad.step(4); if (TU?.state?.().open) TU.close(); const m = nomad.map(); nomad.choose('Plündern'); nomad.release(); return { m: m && { open: m.open, action: m.action }, modal: !!SC().hud.modal, items: (SC().hud.menuItems || []).map(x => x.label) }; });
await page.waitForFunction(() => { const s = game.scene.getScene('play'); return s?.mode === 'run' && s.leyla && s.level; }, null, { timeout: 60000 });
await page.waitForTimeout(600);
v = await ev(() => { R().tick(); return R().state(); });
check('Im POI: Radio still, Chip weg, bleibt aber an', v.on && !v.playing && !v.chip, v);

console.log(ok.map(x => '✔ ' + x).join('\n'));
if (errors.length) { console.log(errors.map(x => '✖ ' + x).join('\n')); await browser.close(); process.exit(1); }
console.log(`Radio: ${ok.length} Prüfungen grün`);
await browser.close();
