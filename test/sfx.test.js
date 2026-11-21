// #130 Ton-Ereignisse: the catalog resolves (every recipe exists, every event the code fires is in the catalog), and every
// placeholder recipe builds its Web Audio graph without errors (on a small fake AudioContext).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { RECIPES, SFX_RECIPES, SFX_LEGACY, sfxOf, makeSfx } from '../game/play/sfx.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

// a fake AudioContext: enough of the API for the recipes, counts the nodes started
function fakeCtx() {
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime(v) { if (!(v > 0)) throw new Error('ramp to ' + v); }, linearRampToValueAtTime() {} });
  const node = extra => ({ connect(n) { return n; }, disconnect() {}, ...extra });
  const c = {
    state: 'running', currentTime: 0, sampleRate: 8000, started: 0, destination: node(),
    createBuffer: (ch, n) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => node({ buffer: null, playbackRate: param(), start() { c.started++; } }),
    createOscillator: () => node({ type: 'sine', frequency: param(), detune: param(), start() { c.started++; }, stop() {} }),
    createGain: () => node({ gain: param() }),
    createBiquadFilter: () => node({ type: 'lowpass', frequency: param(), Q: param() }),
    createWaveShaper: () => node({ curve: null, oversample: 'none' }),
    createStereoPanner: () => node({ pan: param() }),
  };
  return c;
}
const fakeScene = c => ({ data_: D, sound: { context: c, mute: false }, time: { now: 0 }, cameras: { main: { worldView: { x: 0, y: 0, width: 1920, height: 1080 } } }, T: 64 });

test('jedes Rezept der Werkstatt hat Code, jedes Ereignis einen Klang', () => {
  for (const [id] of SFX_RECIPES) assert.equal(typeof RECIPES[id], 'function', id);
  for (const id of SFX_LEGACY) assert.ok(RECIPES[id], id);
  for (const [id, e] of Object.entries(D.sounds)) assert.ok(RECIPES[e.recipe] || e.samples?.length, `${id}: weder Rezept noch Datei`);
  const taken = Object.values(D.sounds).map(e => e.replaces).filter(Boolean);
  assert.equal(new Set(taken).size, taken.length, 'jeder alte Code-Ton höchstens einmal ersetzt');
});

test('jedes Ereignis, das der Code auslöst, steht im Katalog', () => {
  const ids = new Set();
  for (const f of readdirSync('game/play').filter(f => f.endsWith('.js'))) {
    const src = readFileSync('game/play/' + f, 'utf8');
    for (const m of src.matchAll(/\bsfx(?:\?\.)?\(([^{]*?)(?:,\s*\{|\);|\) )/g)) for (const q of m[1].matchAll(/(?<!===\s*)'([a-z_]+)'/g)) ids.add(q[1]);
    for (const m of src.matchAll(/sfxNow\('([a-z_]+)'/g)) ids.add(m[1]);
  }
  for (const id of ['melee_whoosh', 'hit_flesh', 'enemy_death', 'jump', 'ui_hover']) assert.ok(ids.has(id), `Suche findet ${id}`);
  for (const id of ids) assert.ok(D.sounds[id], `„${id}“ fehlt in data/sounds.json`);
});

test('alle Rezepte und Ereignisse bauen ihren Klang ohne Fehler', () => {
  const c = fakeCtx(), out = c.createGain();
  for (const [id, f] of Object.entries(RECIPES)) { const n = c.started; f(c, out, 0, 1, { heavy: true, crit: true, run: true, n: 3, weight: 2, k: 1, ms: 300 }); assert.ok(c.started > n, `${id} spielt etwas`); }
  const s = fakeScene(c), bank = sfxOf(s);
  for (const id of Object.keys(D.sounds)) { s.time.now += 10000; bank.recent = []; assert.equal(bank.play(id, { x: 900 }), true, id); }
  assert.ok(bank.played.every(p => p.via === 'code'));
});

test('stumm, aus, Abklingzeit und ohne AudioContext: still, ohne Fehler', () => {
  const c = fakeCtx(), s = fakeScene(c), bank = sfxOf(s);
  s.time.now = 1000; assert.equal(bank.play('hit_flesh'), true);
  assert.equal(bank.play('hit_flesh'), false, 'Abklingzeit');
  s.time.now = 5000; s.muted = true; assert.equal(bank.play('jump'), false, 'M stumm'); s.muted = false;
  c.state = 'suspended'; assert.equal(bank.play('jump'), false, 'vor dem ersten Klick nichts in die Warteschlange'); c.state = 'running';
  D.game.sfx.enabled = false; assert.equal(bank.play('dash'), false, 'Spiel › Effekte aus'); D.game.sfx.enabled = true;
  assert.equal(bank.play('gibt_es_nicht'), false);
  const none = sfxOf({ data_: D, sound: {}, time: { now: 0 } });
  assert.equal(none.play('jump'), false, 'kein AudioContext');
  assert.doesNotThrow(() => makeSfx({ data_: D, sound: {} }).klonk(2));
});

test('Schritte nach Untergrund: Sand, Stein, Blech im Rig', () => {
  const c = fakeCtx(), s = fakeScene(c), bank = sfxOf(s);
  s.terrain = { idAt: () => 'desert' }; assert.equal(bank.surface(100, 600), 'step_sand');
  s.terrain = { idAt: () => 'bunker' }; assert.equal(bank.surface(100, 600), 'step_stone');
  s.terrain = { idAt: () => 'factory' }; assert.equal(bank.surface(100, 600), 'step_metal');
  s.terrain = { idAt: () => 'unbekannt' }; assert.equal(bank.surface(100, 600), 'step_sand', 'sonst überall');
  s.mode = 'camp'; s.campGeo = { floor: 20 }; s.terrain = { idAt: () => 'desert' };
  assert.equal(bank.surface(100, 20 * 64 - 200), 'step_metal', 'im Rig');
  assert.equal(bank.surface(100, 20 * 64), 'step_sand', 'am Boden des Camps');
});

test('produzierter Ton ersetzt den Platzhalter (Daten statt Code)', () => {
  const c = fakeCtx(), s = fakeScene(c), bank = sfxOf(s);
  const r = bank.resolve('enemy_shot');
  assert.equal(r.recipe, 'enemyShot'); assert.deepEqual(r.samples, []);
  const keep = D.sounds.enemy_shot.samples;
  D.sounds.enemy_shot.samples = ['sound_shot'];
  assert.deepEqual(bank.resolve('enemy_shot').samples, ['sound_shot']);
  D.sounds.enemy_shot.samples = ['leyla_idle'];   // not a sound: ignored
  assert.deepEqual(bank.resolve('enemy_shot').samples, []);
  if (keep) D.sounds.enemy_shot.samples = keep; else delete D.sounds.enemy_shot.samples;
});
