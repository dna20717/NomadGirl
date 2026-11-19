// Rig-Radio (#090): stations from the workshop, songs as notes (same seed = same song), talk that knows the game
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { ensureMap } from '../game/worldmap.js';
import { radioConfig, song, talk, talkPool, jammed, rng, RADIO_STYLES } from '../game/radio.js';
import { addRep } from '../game/reputation.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const C = radioConfig(D);

test('Sender: vier, jeder Stil einmal', () => {
  assert.equal(C.stations.length, 4);
  assert.deepEqual(new Set(C.stations.map(s => s.style)), new Set(RADIO_STYLES.map(([k]) => k)));
});
test('Song: gleicher Seed = gleicher Song, Noten im Raster, Nachtsender ohne Drums', () => {
  for (const st of C.stations) {
    const a = song(D, st, 42), b = song(D, st, 42), c = song(D, st, 43);
    assert.deepEqual(a, b); assert.notDeepEqual(a.events, c.events);
    assert.ok(a.events.length > 10 && a.events.every(e => e.step >= 0 && e.step < a.steps && e.len > 0));
    assert.ok(a.title.split(' ').length === 2);
    if (st.style === 'ambient') assert.ok(!a.events.some(e => ['kick', 'snare', 'hat'].includes(e.voice)));
    else assert.ok(a.events.some(e => e.voice === 'kick'));
  }
});
test('Durchsagen kennen das Spiel: Werbung der Marken, Wetter, Front, Gerücht, Lore', () => {
  const save = newSave(D); ensureMap(D, save);
  const P = talkPool(D, save, C.stations[0], rng(1));
  assert.ok(P.ad.some(t => /Delta Petrol/.test(t)), 'Werbung');
  assert.ok(P.weather.length && /(Regen|trocken)/.test(P.weather[0]));
  assert.ok(P.war.length >= 1 && /Rust Guard|Salt Dogs/.test(P.war.join(' ')), 'Bunker 13 ↔ Pit 6 ist eine Front');
  assert.ok(P.tip.length >= 1 && P.lore.length >= 1);
  const kinds = new Set(); for (let i = 0; i < 80; i++) kinds.add(talk(D, save, C.stations[1], rng(i)).kind);
  for (const k of ['ident', 'ad', 'weather', 'war', 'tip', 'lore']) assert.ok(kinds.has(k), k);
  assert.ok(!/\{\w+\}/.test(Object.values(P).flat().join(' ')), 'alle Platzhalter gefüllt');
});
test('Gang-Sender: als Feind nur Rauschen', () => {
  const save = newSave(D), saint = C.stations.find(s => s.gang === 'Static Saints');
  assert.equal(jammed(D, save, saint), null);
  addRep(D, save, 'Static Saints', -80);
  assert.match(jammed(D, save, saint), /Static Saints/);
});
