// Leylas Signaturfarbe (#044, game/play/signature.js): the mirror's colours, dyeing with a packet, unlocked for good, the colour swap,
// a new Durchgang keeps it, a broken index is repaired.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave, newCycle, repairSave } from '../game/save.js';
import { give, have, take } from '../game/crafting.js';
import { mirrorRows, dye, swapFor, current } from '../game/play/signature.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const C = D.leyla.signature.colors, green = C.findIndex(c => c.name === 'Giftgrün');

test('Spiegel: wie gemalt zuerst, Farben mit Färbemittel gesperrt, bis eine Packung da ist', () => {
  const s = newSave(D), rows = mirrorRows(D, s, id => have(D, s, id));
  assert.ok(rows[0].on && rows[0].unlocked && !rows[0].color);
  assert.ok(rows.length >= 8 && rows.slice(1).every(r => r.color && (r.item ? !r.unlocked : r.unlocked)));
  assert.ok(rows.filter(r => r.i > 0 && !r.item).length >= 3, 'ein paar Farben sind gratis (Daniel, 16.11.2026)');
  assert.equal(current(D, s), null);
  assert.equal(swapFor(D, s), null, 'wie gemalt: kein Farbtausch');
});

test('Färben: eine Packung schaltet frei und wird verbraucht, danach kostenlos; zurück zu Pink geht immer', () => {
  const s = newSave(D), t = (id, n) => take(D, s, id, n);
  assert.equal(dye(D, s, green, t).ok, false, 'ohne Färbemittel nicht');
  give(D, s, C[green].item, 1);
  const r = dye(D, s, green, t);
  assert.ok(r.ok && r.used);
  assert.equal(have(D, s, C[green].item), 0);
  assert.equal(current(D, s).name, 'Giftgrün');
  assert.ok(dye(D, s, 0, t).ok && current(D, s) === null);
  const again = dye(D, s, green, t);
  assert.ok(again.ok && !again.used, 'freigeschaltet: keine Packung mehr nötig');
});

test('Farbtausch: Pink wird Grün, Haut und Grau bleiben, die Schattierung bleibt', () => {
  const s = newSave(D); s.look = { color: green, unlocked: [green] };
  const sw = swapFor(D, s);
  const [r, g, b] = sw(255, 122, 192);   // a pink of her hair
  assert.ok(g > r && g > b, `grün: ${[r, g, b]}`);
  const dark = sw(140, 40, 100), light = sw(255, 170, 220);
  assert.ok(dark[1] < light[1], 'dunkles Pink bleibt dunkler');
  assert.equal(sw(230, 180, 150), null, 'Hautton bleibt');
  assert.equal(sw(120, 120, 125), null, 'Grau bleibt');
});

test('Neuer Durchgang behält die Farbe, kaputte Werte werden repariert', () => {
  const s = newSave(D); s.look = { color: green, unlocked: [green] };
  assert.deepEqual(newCycle(D, s).look, { color: green, unlocked: [green] });
  const r = repairSave({ ...structuredClone(s), look: { color: 99, unlocked: [green, 99, -1] } }, D);
  assert.deepEqual(r.look, { color: 0, unlocked: [green] });
});
