// Quests aus Straßen-Merkern (#062, Daniel 18.11.2026): a road story sets a Merker, a companion offers a quest about it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { offers } from '../game/quests.js';
import { choose } from '../game/travel.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;

test('Erst mit Merker: die Fehde öffnet „Nachspiel an der Kreuzung“', () => {
  const save = newSave(D);
  assert.ok(!offers(D, save).includes('kreuzung_nachspiel'));
  const a = D.roadEvents.answers.find(x => x.id === 'dank_annehmen');
  choose(D, save, { ...a }, () => 0.99);
  assert.ok(save.road.flags.includes('fehde_held'));
  assert.ok(offers(D, save).includes('kreuzung_nachspiel'));
});

test('Nicht mit Merker: wer die Läuferin bestohlen und später versöhnt hat, bekommt den Gewissens-Auftrag nicht', () => {
  const save = newSave(D);
  save.road = { flags: ['laeuferin_bestohlen'], seen: [], chain: null };
  assert.ok(offers(D, save).includes('schlechtes_gewissen'));
  save.road.flags.push('laeuferin_freundin');
  assert.ok(!offers(D, save).includes('schlechtes_gewissen'));
  assert.ok(offers(D, save).includes('laeuferins_versteck'));
});

test('Jeder Merker-Auftrag hängt an einem Merker, den eine Antwort wirklich setzt', () => {
  const set = new Set(D.roadEvents.answers.flatMap(a => String(a.flag || '').split(',').map(f => f.trim().replace(/^-/, ''))).concat(Object.values(D.quests).map(q => q.flag)).filter(Boolean));
  for (const [id, q] of Object.entries(D.quests)) for (const f of String(q.needsFlag || '').split(',').map(x => x.trim()).filter(Boolean)) assert.ok(set.has(f), `${id}: Merker ${f}`);
});
