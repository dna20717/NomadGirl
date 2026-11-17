// Entities (#047, game/glitchlings.js): the generator of passive companions. Same seed = same set, names from two words and
// never twice (no word twice), unique ones marked „immer“ always there, effect = per bit × bits, weaker in a foreign workbench.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, config, effectOf } from '../game/glitchlings.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('Gleicher Seed, gleiche Entities; anderer Seed, andere', () => {
  assert.deepEqual(generate(D, 42), generate(D, 42));
  assert.notDeepEqual(generate(D, 42).map(g => g.name), generate(D, 43).map(g => g.name));
});

test('Namen: zwei Wörter, keins doppelt; Unikate „immer“ sind dabei', () => {
  for (const seed of [1, 2, 3, 99, 1234]) {
    const list = generate(D, seed), words = list.flatMap(g => g.name.split(' '));
    assert.equal(list.length, config(D).count);
    assert.ok(list.every(g => g.name.split(' ').length === 2), seed);
    assert.equal(new Set(list.map(g => g.name.split(' ')[0])).size, list.length, 'erstes Wort einmalig');
    assert.equal(new Set(list.map(g => g.name.split(' ')[1])).size, list.length, 'zweites Wort einmalig');
    for (const u of config(D).unique.filter(u => u.always)) assert.ok(list.some(g => g.name === u.name && g.unique), u.name);
    assert.ok(words.includes('Amber') && words.includes('Slay'), 'Amber Slay (Daniel)');
  }
});

test('Jeder hat Begabung mit Werkbank, Stärke 1–5, Macke, Wunsch, Wohnort; Effekt = je Bit × Bits, fremd schwächer', () => {
  const C = config(D);
  for (const g of generate(D, 7)) {
    assert.ok(g.talent && g.function && g.bits >= 1 && g.bits <= 5 && g.quirk && g.wish && g.home, g.name);
    assert.ok(g.effect.length && !g.effect.includes('{n}'), g.name);
  }
  const t = C.talents[0], own = effectOf(C, t, 3), off = effectOf(C, t, 3, false);
  assert.equal(own.value, t.perBit * 3);
  assert.equal(off.value, Math.round(t.perBit * 3 * C.off / 100 * 10) / 10);
});

test('Macken wiederholen sich in einem Durchgang nicht, solange es genug gibt', () => {
  const list = generate(D, 5).filter(g => !g.unique);
  assert.equal(new Set(list.map(g => g.quirk)).size, list.length);
});

// Code portraits (#048, game/glitch_face.js): same Entity = same face, every one its own, they move, unique ones have a gold rim
import { renderFace, faceOf, SIZE, WEARS } from '../game/glitch_face.js';
const key = px => Buffer.from(px).toString('base64');
test('Code-Porträt: gleich bleibt gleich, jeder Entity hat sein eigenes Gesicht', () => {
  const list = [...generate(D, 3), ...generate(D, 4)];
  assert.equal(key(renderFace(list[2], 1.1)), key(renderFace(list[2], 1.1)));
  const faces = new Set(list.map(g => key(renderFace(g, 0.2))));
  assert.equal(faces.size, new Set(list.map(g => g.name)).size);
  assert.equal(renderFace(list[0], 0).length, SIZE * SIZE * 4);
});
test('Code-Porträt bewegt sich (Blinzeln, Code, Glitches)', () => {
  const g = generate(D, 5)[3], seen = new Set();
  for (let t = 0; t < 8; t += 0.25) seen.add(key(renderFace(g, t)));
  assert.ok(seen.size > 10, `nur ${seen.size} verschiedene Bilder`);
});
test('Code-Porträt: Unikate mit Goldrand, jede Begabung trägt etwas, Archäologe den Hut', () => {
  const gold = px => { let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] === 0xff && px[i + 1] === 0xd5 && px[i + 2] === 0x41) n++; return n; };
  const [u, , n] = generate(D, 6);
  assert.ok(u.unique && gold(renderFace(u, 0.05)) > 30);
  assert.ok(!n.unique && gold(renderFace({ ...n, stat: 'perfect' }, 0.05)) < 5);
  for (const t of config(D).talents) assert.ok(WEARS[t.stat], `${t.name} (${t.stat}) trägt nichts`);
  assert.equal(faceOf({ name: 'Ochre Dig', stat: 'archaeology' }).wears, 'fedora');
  assert.ok(config(D).talents.some(t => t.name === 'Archäologe' && t.function === 'warroom'));
});

// an Entity as a thing (#048, Daniel: „Kannst du mir einen Glitchling ins Inventar legen?“): once per older savegame, Amber Slay
import { newSave, repairSave } from '../game/save.js';
import { addEntry, newGrid } from '../game/inventory.js';
test('Geschenk: ein alter Spielstand bekommt einmal Amber Slay als Entity, er bleibt er selbst', () => {
  const old = newSave(D); delete old.gifts;
  const s = repairSave(structuredClone(old), D), all = x => Object.values(x.inv.grids).flatMap(g => g.items).filter(e => e.id === 'glitchling');
  assert.equal(all(s).length, 1);
  assert.equal(all(s)[0].g.name, 'Amber Slay');
  assert.ok(['deck', 'backpack', 'camp'].some(k => s.inv.grids[k]?.items.includes(all(s)[0])), 'im Cyberdeck, sonst Rucksack, sonst Camp-Lager');
  assert.equal(all(repairSave(structuredClone(s), D)).length, 1, 'nur einmal');
  assert.equal(all(repairSave(structuredClone(newSave(D)), D)).length, 0, 'ein neues Spiel startet ohne');
  const g = newGrid(6, 6), e = all(s)[0];
  addEntry(D, g, e); addEntry(D, g, { ...e, g: { ...e.g, name: 'Moss Fang' } });
  assert.deepEqual(g.items.map(x => x.g.name), ['Amber Slay', 'Moss Fang'], 'Entities stapeln nie');
});

// #049 (Daniel, 17.11.2026): „KIs brauchen einen Hersteller“; „Man muss sie nicht im Inventar transportieren, wenn man ein Cyberdeck hat“
import { brandOf } from '../game/glitchlings.js';
import { deckSize, fitDeck, DECK } from '../game/save.js';
test('Jeder Entity hat einen Hersteller (Unikate auch einen eigenen)', () => {
  const list = generate(D, 11);
  for (const g of list) assert.ok(D.brands[g.brand], `${g.name} ohne Hersteller`);
  assert.equal(list.find(g => g.name === 'Marble Sting').brand, 'kessler');
  assert.equal(brandOf(D, { talent: 'Koch' }), 'neon_nudel', 'alte Entities (ohne brand) nach ihrer Begabung');
});
test('Cyberdeck = Fach für Entities: Plätze je Deck, ohne Deck kein Fach, nichts geht verloren', () => {
  assert.deepEqual(deckSize(D, 'bastlerdeck'), [2 * D.weapons.bastlerdeck.glitchSlots, 2]);
  assert.equal(deckSize(D, 'rohrzange'), null);
  const inv = { slots: { cyberdeck: 'bastlerdeck' }, grids: {} };
  fitDeck(D, inv);
  addEntry(D, inv.grids[DECK], { a: 'items', id: 'glitchling', n: 1, g: generate(D, 1)[0] });
  inv.slots.cyberdeck = null;
  const out = fitDeck(D, inv);
  assert.equal(inv.grids[DECK], undefined);
  assert.equal(out[0].g.name, 'Amber Slay');
  // the gift goes into the deck when Leyla has one
  const old = newSave(D); delete old.gifts; old.inv.slots.cyberdeck = 'bastlerdeck';
  const s = repairSave(structuredClone(old), D);
  assert.equal(s.inv.grids[DECK].items[0]?.g?.name, 'Amber Slay');
});
test('Alter Spielstand ohne Deck: bekommt einmal ein Bastler-Deck, Amber Slay zieht aus dem Rucksack ins Deck', () => {
  const old = newSave(D); old.gifts = ['glitchling_048']; old.inv.slots.cyberdeck = null;
  addEntry(D, old.inv.grids.camp, { a: 'items', id: 'glitchling', n: 1, g: generate(D, 1)[0] });
  const s = repairSave(structuredClone(old), D);
  assert.equal(s.inv.slots.cyberdeck, 'bastlerdeck');
  assert.equal(s.inv.grids[DECK].items[0]?.g?.name, 'Amber Slay');
  assert.ok(!s.inv.grids.camp.items.some(e => e.g), 'nicht mehr im Lager');
  assert.equal(repairSave(structuredClone(s), D).inv.grids[DECK].items.length, 1);
});

// Geister-Köpfe (Daniel, 17.11.2026: „mehr wie digitale Geister und weniger wie Fernseher“): a pale head with a black void, tinted,
// the face drawn by code inside the void; Kammerjäger stay screens
import { setHeads, renderGhost, GSIZE, headsReady } from '../game/glitch_face.js';
test('Geist: Kopf in der Farbe des Entities, Gesicht in der Leere, schwebt; Kammerjäger bleiben Bildschirme', () => {
  const S = GSIZE, head = new Uint8ClampedArray(S * S * 4);
  for (let y = 8; y < 56; y++) for (let x = 12; x < 52; x++) { const i = (y * S + x) * 4, voidPx = (x - 32) ** 2 / 144 + (y - 30) ** 2 / 196 < 1; head[i] = head[i + 1] = head[i + 2] = voidPx ? 6 : 235; head[i + 3] = 255; }
  const [H] = setHeads([head]);
  assert.ok(headsReady()); assert.ok(Math.abs(H.face.cx - 32) <= 1 && Math.abs(H.face.cy - 30) <= 1, JSON.stringify(H.face));
  const amber = generate(D, 1).find(g => g.name === 'Amber Slay'), px = renderGhost(amber, 0.3);
  assert.equal(px.length, S * S * 4);
  const at = (x, y) => [...px.slice((y * S + x) * 4, (y * S + x) * 4 + 4)];
  const body = at(14, 50); assert.ok(body[0] > 150 && body[2] < body[0], `Körper in Bernstein getönt: ${body}`);
  let lit = 0; for (let y = 18; y < 42; y++) for (let x = 22; x < 42; x++) { const p = at(x, y); if (p[0] + p[1] + p[2] > 300) lit++; }
  assert.ok(lit > 4, 'Augen und Mund leuchten in der Leere');
  const frames = new Set(); for (let t = 0; t < 4; t += 0.3) frames.add(Buffer.from(renderGhost(amber, t)).toString('base64'));
  assert.ok(frames.size >= 3, `bewegt sich (${frames.size} Bilder)`);
});
