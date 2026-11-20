// #126 Drei Spielstände (game/slots.js, game/save.js › openSave): local storage, the move of the old savegame, global achievements,
// the Vor-Lösch-Zustand, Datenset per slot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave, openSave } from '../game/save.js';
import { state } from '../game/achievements.js';
import { localStorageBackend, slotKey, LEGACY_KEY, activeSlot, chooseSlot, deleteSlot, copySlot, renameSlot, trashInfo, restoreTrash, mergeAchievements, metaLine } from '../game/slots.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const fakeLS = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
const open = (ls, slot, o = {}) => openSave(D, '', { be: localStorageBackend(ls), slot, ...o });

test('Alter Spielstand zieht nach Slot 1: kopiert, geprüft, alter Schlüssel weg, Achievements werden global', async () => {
  const ls = fakeLS(), old = newSave(D);
  old.deltas = 4321; old.savedAt = 5; old.achievements = { counts: { kills: 12 }, done: { [Object.keys(D.achievements)[0]]: { day: 3 } }, made: [] };
  ls.setItem(LEGACY_KEY, JSON.stringify(old));
  const be = localStorageBackend(ls);
  assert.equal(be.migrate(), true);
  assert.equal(ls.getItem(LEGACY_KEY), null);
  assert.equal(JSON.parse(ls.getItem(slotKey(1))).deltas, 4321);
  assert.equal((await be.blob('achievements')).counts.kills, 12);
  assert.equal((await be.list())[1].day, old.day);
  assert.equal(be.migrate(), false);   // once
});

test('Slots sind getrennt, Name und Datenset je Slot, Liste mit Kurzzeile', async () => {
  const ls = fakeLS();
  const a = await open(ls, 1); a.save.deltas = 111; await a.persist(true);
  const b = await open(ls, 2, { set: 'schnell' }); b.save.deltas = 222; await b.persist(true);
  assert.equal((await open(ls, 1)).save.deltas, 111);
  assert.equal((await open(ls, 2)).save.deltas, 222);
  const L = await localStorageBackend(ls).list();
  assert.equal(L[1].name, 'Leyla 1'); assert.equal(L[2].set, 'schnell'); assert.equal(L[1].set, ''); assert.equal(L[3], null);
  assert.match(metaLine(L[2]), /^Tag \d+/); assert.equal(metaLine(null), 'leer · Neues Spiel');
});

test('Achievements gelten über alle Spielstände (Zähler nehmen den höchsten Stand, erreicht bleibt erreicht)', async () => {
  const ls = fakeLS(), id = Object.keys(D.achievements).find(k => D.achievements[k].recipe && D.recipes?.[D.achievements[k].recipe]);
  const a = await open(ls, 1);
  state(a.save).counts.kills = 30; state(a.save).done[id] = { day: 1 };
  await a.persist(true);
  const b = await open(ls, 2);
  assert.equal(b.save.achievements.counts.kills, 30);
  assert.ok(b.save.achievements.done[id]);
  assert.ok(b.save.recipes.includes(D.achievements[id].recipe), 'Rezept des Achievements in jedem Slot');
  b.save.achievements.counts.kills = 31; await b.persist(true);
  assert.equal((await open(ls, 1)).save.achievements.counts.kills, 31);
  assert.deepEqual(mergeAchievements({ counts: { x: 5 } }, { counts: { x: 2, y: 1 } }).counts, { x: 5, y: 1 });
});

test('Löschen und Überschreiben landen im Vor-Lösch-Zustand, Wiederherstellen tauscht', async () => {
  const ls = fakeLS(), be = localStorageBackend(ls);
  const a = await open(ls, 1); a.save.deltas = 9; await a.persist(true);
  assert.equal(await deleteSlot(be, 1), true);
  assert.equal((await be.list())[1], null);
  assert.equal((await trashInfo(be)).why, 'gelöscht');
  assert.equal(await restoreTrash(be, 3, D), true);
  assert.equal((await open(ls, 3)).save.deltas, 9);
  assert.equal(await trashInfo(be), null);
  // Neues Spiel auf einem belegten Slot: der alte kommt in den Vor-Lösch-Zustand
  const c = await open(ls, 3); await c.reset();
  assert.equal((await trashInfo(be)).why, 'überschrieben');
  assert.notEqual((await open(ls, 3)).save.deltas, 9);
  // Kopieren auf einen belegten Slot ebenso
  const d = await open(ls, 2); d.save.deltas = 77; await d.persist(true);
  assert.equal(await copySlot(be, 2, 3, D), true);
  assert.equal((await open(ls, 3)).save.deltas, 77);
  assert.equal((await trashInfo(be)).slot, 3);
  assert.equal(await renameSlot(be, 3, '  Wüstenfuchs<> ', D), true);
  assert.equal((await be.list())[3].name, 'Wüstenfuchs');
});

test('Aktiver Slot: ?slot vor dem gemerkten, sonst 1; Unsinn zählt nicht', () => {
  const ls = fakeLS();
  assert.equal(activeSlot('', ls), 1);
  chooseSlot(3, ls); assert.equal(activeSlot('', ls), 3);
  assert.equal(activeSlot('?slot=2', ls), 2);
  assert.equal(activeSlot('?slot=9', ls), 3);
  chooseSlot(7, ls); assert.equal(activeSlot('', ls), 3);
});
