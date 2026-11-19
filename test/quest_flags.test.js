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

// #076 (Daniel 19.11.2026: „Ketten-Quest: die Läuferin kommt zurück und bietet gegen Bezahlung eine zweite Chance“)
import { situationsFor, generateEncounter } from '../game/road_events.js';
test('Verrat an der Läuferin hat eine Folge: zweite Chance gegen Δ, Probefahrt, danach Freundin (oder Feindin)', () => {
  const save = newSave(D); save.deltas = 500;
  const sit = () => situationsFor(D, { danger: 2, save }).map(s => s.id);
  assert.ok(!sit().includes('laeuferin_zweite_chance'));
  choose(D, save, { ...D.roadEvents.answers.find(a => a.id === 'ausliefern') }, () => 0.99);
  assert.ok(sit().includes('laeuferin_zweite_chance'), 'der Merker wird jetzt gelesen');
  const E = generateEncounter(D, () => 0.5, { save, situation: 'laeuferin_zweite_chance', danger: 2 });
  const pay = E.options.find(o => o.answer === 'zweite_chance_zahlen');
  assert.ok(pay && E.options.some(o => o.answer === 'zweite_chance_ablehnen'));
  choose(D, save, pay, () => 0.99);
  assert.ok(save.deltas < 500 && save.deltas >= 300, save.deltas); assert.equal(save.road.chain?.step, 'laeuferin_bewaehrung');
  const F = generateEncounter(D, () => 0.5, { save, chain: save.road.chain, danger: 2 });
  choose(D, save, F.options.find(o => o.answer === 'bewaehrung_vertrauen'), () => 0.99);
  assert.ok(save.road.flags.includes('laeuferin_freundin'));
  assert.ok(sit().includes('laeuferin_wieder'), 'die alte Freundschafts-Kette geht weiter');
  assert.ok(offers(D, save).includes('laeuferins_versteck'));
  // the other way: turned away → she comes back with friends
  const s2 = newSave(D);
  choose(D, s2, { ...D.roadEvents.answers.find(a => a.id === 'ausliefern') }, () => 0.99);
  const G = generateEncounter(D, () => 0.5, { save: s2, situation: 'laeuferin_zweite_chance', danger: 2 });
  choose(D, s2, G.options.find(o => o.answer === 'zweite_chance_ablehnen'), () => 0.99);
  assert.ok(situationsFor(D, { danger: 2, save: s2 }).some(s => s.id === 'laeuferin_rache'));
});
