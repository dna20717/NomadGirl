// Glitchlings (#047, game/glitchlings.js): the generator of passive companions. Same seed = same set, names from two words and
// never twice (no word twice), unique ones marked „immer“ always there, effect = per bit × bits, weaker in a foreign workbench.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, config, effectOf } from '../game/glitchlings.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('Gleicher Seed, gleiche Glitchlings; anderer Seed, andere', () => {
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

// Code portraits (#048, game/glitch_face.js): same Glitchling = same face, every one its own, they move, unique ones have a gold rim
import { renderFace, faceOf, SIZE, WEARS } from '../game/glitch_face.js';
const key = px => Buffer.from(px).toString('base64');
test('Code-Porträt: gleich bleibt gleich, jeder Glitchling hat sein eigenes Gesicht', () => {
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

// a Glitchling as a thing (#048, Daniel: „Kannst du mir einen Glitchling ins Inventar legen?“): once per older savegame, Amber Slay
import { newSave, repairSave } from '../game/save.js';
import { addEntry, newGrid } from '../game/inventory.js';
test('Geschenk: ein alter Spielstand bekommt einmal Amber Slay als Glitchling, er bleibt er selbst', () => {
  const old = newSave(D); delete old.gifts;
  const s = repairSave(structuredClone(old), D), all = x => Object.values(x.inv.grids).flatMap(g => g.items).filter(e => e.id === 'glitchling');
  assert.equal(all(s).length, 1);
  assert.equal(all(s)[0].g.name, 'Amber Slay');
  assert.ok(['backpack', 'camp'].some(k => s.inv.grids[k]?.items.includes(all(s)[0])), 'im Rucksack, sonst im Camp-Lager');
  assert.equal(all(repairSave(structuredClone(s), D)).length, 1, 'nur einmal');
  assert.equal(all(repairSave(structuredClone(newSave(D)), D)).length, 0, 'ein neues Spiel startet ohne');
  const g = newGrid(6, 6), e = all(s)[0];
  addEntry(D, g, e); addEntry(D, g, { ...e, g: { ...e.g, name: 'Moss Fang' } });
  assert.deepEqual(g.items.map(x => x.g.name), ['Amber Slay', 'Moss Fang'], 'Glitchlings stapeln nie');
});
