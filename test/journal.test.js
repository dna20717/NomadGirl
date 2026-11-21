// #129 Logbuch: categories, counting up, build mode only successes, view with filter + search, new Durchgang starts empty
import test from 'node:test';
import assert from 'node:assert/strict';
import { record, view, catOf, KEEP } from '../game/journal.js';
import { newSave, newCycle } from '../game/save.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const save = () => ({ day: 3, hour: 14.5, journal: [] });

test('category from kind and words', () => {
  assert.equal(catOf('trophy', 'Achievement'), 'progress');
  assert.equal(catOf('info', 'Auftrag angenommen: Kabelsalat'), 'quest');
  assert.equal(catOf('good', 'Gekauft: Laterne', '−40 Δ'), 'trade');
  assert.equal(catOf('info', 'Irgendwas'), 'system');
});

test('same note again counts up, build mode keeps only successes', () => {
  const s = save();
  record(s, 'Kiste offen', 'Schrott', 'loot'); record(s, 'Kiste offen', 'Schrott', 'loot');
  assert.equal(s.journal.length, 1); assert.equal(s.journal[0].n, 2);
  assert.equal(record(s, 'Kein Platz', '', 'warn', { building: true }), null);
  assert.ok(record(s, 'Eingebaut: Küche', '', 'good', { building: true }));
  assert.equal(s.journal.length, 2);
});

test('keeps the newest entries only', () => {
  const s = save();
  for (let i = 0; i < KEEP + 20; i++) record(s, `Note ${i}`);
  assert.equal(s.journal.length, KEEP);
  assert.equal(s.journal.at(-1).title, `Note ${KEEP + 19}`);
});

test('view: newest first, filter by category, search, days', () => {
  const s = save();
  record(s, 'Auftrag angenommen: A', '', 'info'); s.day = 4; record(s, '♪ Dust Road', 'Rig-Radio', 'info', { cat: 'radio' }); record(s, 'Kiste offen', 'Kabel', 'loot');
  const all = view(s);
  assert.deepEqual(all.list.map(e => e.title), ['Kiste offen', '♪ Dust Road', 'Auftrag angenommen: A']);
  assert.deepEqual(all.days.map(d => d.day), [4, 3]);
  assert.deepEqual(view(s, { cat: 'radio' }).list.map(e => e.title), ['♪ Dust Road']);
  assert.deepEqual(view(s, { q: 'kabel' }).list.map(e => e.title), ['Kiste offen']);
  assert.equal(all.counts.quest, 1);
});

test('a new Durchgang starts with an empty Logbuch (Daniel 21.11.)', async () => {
  const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
  const s = newSave(D);
  record(s, 'Etwas passiert');
  assert.equal(newCycle(D, s).journal?.length ?? 0, 0);
});
