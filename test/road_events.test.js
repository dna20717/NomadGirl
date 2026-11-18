// The Ereignis-Baukasten (#054): incidents from parts (Lage, Stimmung, Antworten, Wörter), the danger scales, answers may go wrong.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateEncounter, eventsConfig, eventProblems } from '../game/road_events.js';
import { pickEncounter, encounterById, choose } from '../game/travel.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('Baukasten: Bausteine vollständig, keine Probleme', () => {
  const C = eventsConfig(D);
  assert.ok(C.situations.length >= 12 && C.moods.length >= 6 && C.answers.length >= 20);
  assert.deepEqual(eventProblems(D), []);
});

test('Jede Lage in jeder Stimmung: Titel, Text, mindestens zwei Antworten, eine geht immer, keine offenen Platzhalter', () => {
  const C = eventsConfig(D);
  for (const S of C.situations) for (let seed = 1; seed < 40; seed++) {
    const e = generateEncounter(D, rng(seed), { situation: S.id, danger: 1 + seed % 5, place: 'Rustvale', region: 'Crow Valley' });
    assert.ok(e && e.name && e.description, S.id);
    assert.ok(e.options.length >= 2 && e.options.length <= C.maxAnswers, `${S.id}: ${e.options.length} Antworten`);
    assert.ok(e.options.some(o => !(o.deltas < 0) && !o.use), `${S.id}: eine Antwort geht immer`);
    assert.ok(!/\{\w+\}/.test(JSON.stringify(e)), `${S.id}: Platzhalter übrig: ${JSON.stringify(e).match(/\{\w+\}/)}`);
    for (const f of e.figures) assert.ok(D.enemies[f]?.kit, `${S.id}: ${f}`);
  }
});

test('Gleicher Seed, gleicher Zwischenfall; viele Seeds, viele verschiedene', () => {
  assert.deepEqual(generateEncounter(D, rng(5), { danger: 2 }), generateEncounter(D, rng(5), { danger: 2 }));
  const all = Array.from({ length: 300 }, (_, i) => generateEncounter(D, rng(i + 1), { danger: 3, night: i % 2 === 0 }));
  const names = new Set(all.map(e => e.name)), texts = new Set(all.map(e => e.description));
  assert.ok(names.size >= 12 && texts.size >= 80, `${names.size} Titel, ${texts.size} Texte`);
});

test('Gefahr macht Zahlen teurer, Stimmung färbt die Antworten', () => {
  const pay = d => generateEncounter(D, rng(3), { situation: 'zollstation', danger: d }).options.find(o => o.answer === 'zahlen')?.deltas;
  assert.ok(pay(5) < pay(1), `Gefahr 5 zahlt mehr (${pay(5)} gegen ${pay(1)})`);
  for (let s = 1; s < 60; s++) {
    const e = generateEncounter(D, rng(s), { situation: 'lagerfeuer', danger: 1 });
    const M = eventsConfig(D).moods.find(m => m.id === e.mood);
    if (!M.hostile) assert.ok(!e.options.some(o => ['kaempfen', 'durchbrechen'].includes(o.answer)));
  }
});

test('Risiko: geht es schief, gibt es keinen Lohn, dafür Schaden', () => {
  const o = { label: 'x', loot: 'kiste_tankstelle', deltas: 30, risk: 50, failHealth: 12, failResult: 'Autsch' };
  const save = { day: 1, hour: 10, fuel: 10, food: 3, deltas: 0, health: 80, inventory: {}, grids: {} };
  const bad = choose(D, save, o, () => 0.1);
  assert.ok(bad.failed && bad.text === 'Autsch' && save.health === 68 && save.deltas === 0 && bad.things.length === 0);
});

test('Zwischenfall wählen: Anteil gewürfelt 100 % = immer Baukasten, 0 % = handgemacht; gen:<Lage> erzwingt', () => {
  const save = { day: 1, hour: 12, fuel: 50 };
  const always = { ...D, travel: { ...D.travel, encounterChance: 100 } };
  assert.ok(pickEncounter({ ...always, roadEvents: { ...D.roadEvents, share: 100 } }, save, 50, rng(2)).generated);
  assert.ok(!pickEncounter({ ...always, roadEvents: { ...D.roadEvents, share: 0 } }, save, 50, rng(2)).generated);
  assert.equal(encounterById(D, save, 'gen:wrack').roadside, 'wreck');
  assert.equal(encounterById(D, save, 'panne').roadside, 'breakdown');
});
