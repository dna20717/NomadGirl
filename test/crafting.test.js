// Cooking and crafting (game/crafting.js): recipe book, cooking a known recipe, experimenting (hit, miss, near miss), notes, tips, eating.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave, repairSave, clockText } from '../game/save.js';
import { recipesFor, stock, craft, experiment, match, readable, read, tips, use, give, take, have } from '../game/crafting.js';
import { add, count } from '../game/inventory.js';
import { loadProject } from '../engine/project.js';
import { classicRig } from './fixture.js';
import { nodeLoader } from '../tools/loader.js';

const D = classicRig((await loadProject(nodeLoader('projects/nomadgirl'))).data);   // furnished start rig, whatever the data say
const fresh = () => { const s = newSave(D); s.hour = 18.5; return s; };

test('Rezeptbuch: am Anfang alle Rezepte „Von Anfang an“, alte Spielstände bekommen sie dazu', () => {
  const s = fresh();
  assert.deepEqual(s.recipes.sort(), ['bleche_schweissen', 'bohneneintopf', 'chip', 'grillsteak', 'schrottplatte', 'verband']);
  const old = { ...s, recipes: undefined }; delete old.recipes;
  assert.deepEqual(repairSave(old, D).recipes.sort(), ['bleche_schweissen', 'bohneneintopf', 'chip', 'grillsteak', 'schrottplatte', 'verband']);
  assert.deepEqual(repairSave({ ...s, recipes: ['discokugel', 'gibtsnicht'] }, D).recipes.sort(), ['bleche_schweissen', 'bohneneintopf', 'chip', 'discokugel', 'grillsteak', 'schrottplatte', 'verband']);
});

test('Werkstatt-Art: Küche kann Rezepte der Kochnische, die Werkbank keine Gerichte', () => {
  const k = recipesFor(D, 'kueche').map(r => r.id);
  assert.ok(k.includes('bohneneintopf') && k.includes('mutanten_curry') && !k.includes('verband'));
  assert.ok(!recipesFor(D, 'werkbank').some(r => r.id === 'bohneneintopf'));
});

test('Kochen: Zutaten aus Lager/Kiste/Rucksack, Ergebnis in den Rucksack, Uhr springt Minuten', () => {
  const s = fresh();
  assert.equal(stock(D, s).dosenbohnen, 4);
  const r = craft(D, s, 'bohneneintopf', 'kochnische');
  assert.ok(r.ok, r.reason);
  assert.equal(stock(D, s).dosenbohnen, 2);
  assert.ok(s.inv.grids.backpack.items.some(e => e.id === 'bohneneintopf'));
  assert.equal(clockText(s), 'Tag 1 · 18:45');
  assert.equal(craft(D, s, 'mutanten_curry', 'kochnische').ok, false);   // not in the book yet
  assert.equal(craft(D, s, 'verband', 'kochnische').ok, false);          // wrong workshop
  take(D, s, 'dosenbohnen', 2);
  assert.match(craft(D, s, 'bohneneintopf', 'kochnische').reason, /Zutaten/);
});

test('Experimentieren: Treffer lernt das Rezept und verbraucht nur, was es braucht', () => {
  const s = fresh();
  assert.equal(match(D, 'kochnische', { reis: 1, mutantenfleisch: 1 }), null);
  const r = experiment(D, s, 'kochnische', { mutantenfleisch: 1, reis: 2, gewuerzmischung: 1 });
  assert.ok(r.ok && r.hit && r.learnt && r.recipe === 'mutanten_curry', JSON.stringify(r));
  assert.equal(have(D, s, 'mutanten_curry'), 2);
  assert.equal(have(D, s, 'reis'), 2);                   // only 1 of 3 used
  assert.ok(s.recipes.includes('mutanten_curry'));
  assert.equal(clockText(s), 'Tag 1 · 19:00');
  // the same again: a hit, no longer new (but no meat left)
  add(D, s.inv.grids.chest, 'items', 'mutantenfleisch', 1);
  const again = experiment(D, s, 'kochnische', { mutantenfleisch: 1, reis: 1, gewuerzmischung: 1 });
  assert.ok(again.hit && !again.learnt);
});

test('Experimentieren: Fehlschlag ergibt kuriosen Müll der Werkstatt-Art, knapp daneben wird erkannt', () => {
  const s = fresh();
  const r = experiment(D, s, 'kochnische', { reis: 1, mutantenfleisch: 1 }, () => 0);
  assert.ok(r.ok && !r.hit);
  assert.equal(r.near, 'mutanten_curry');
  assert.equal(r.made.id, 'verkohlter_klumpen');
  assert.equal(have(D, s, 'verkohlter_klumpen'), 1);
  assert.equal(have(D, s, 'mutantenfleisch'), 0);
  const w = experiment(D, s, 'werkbank', { schrott: 1, stoffreste: 1, kronkorken: 1 }, () => 0);
  assert.ok(!w.hit && !w.near && w.made.id === 'kabelsalat', JSON.stringify(w));
  assert.equal(experiment(D, s, 'werkbank', {}).ok, false);
  assert.match(experiment(D, s, 'werkbank', { discokugel: 9 }).reason, /Zu wenig/);
});

test('Zettel lesen und Tipps von Companions', () => {
  const s = fresh();
  assert.deepEqual(tips(D, s, 'kochnische').map(t => t.recipe).sort(), ['gewuerzreis', 'mutanten_curry', 'neon_ramen', 'wasteland_sushi']);
  assert.equal(tips(D, s, 'kochnische')[0].who, 'Onkel Sung');
  give(D, s, 'zettel_curry', 1);
  assert.deepEqual(readable(D, s).map(x => x.item), ['zettel_curry']);
  assert.equal(read(D, s, 'zettel_curry'), 'mutanten_curry');
  assert.equal(have(D, s, 'zettel_curry'), 0);
  assert.ok(!tips(D, s, 'kochnische').some(t => t.recipe === 'mutanten_curry'));
});

test('Essen: Buff für den nächsten Run, Verband heilt sofort', () => {
  const s = fresh();
  assert.deepEqual(use(D, s, 'bohneneintopf'), { ok: true, buff: 'satt', heal: 0 });
  assert.deepEqual(s.buffs, ['satt']);
  assert.equal(use(D, s, 'bohneneintopf').ok, false);   // already full
  assert.equal(use(D, s, 'verband', { health: 100, maxHealth: 100 }).ok, false);
  assert.equal(use(D, s, 'verband', { health: 50, maxHealth: 100 }).heal, 30);
  assert.equal(use(D, s, 'schrott').ok, false);
});

test('Kein Platz: Rest kommt zurück (liegt dann am Boden)', () => {
  const s = fresh();
  for (const g of Object.values(s.inv.grids)) g.items = [];
  for (const g of Object.values(s.inv.grids)) add(D, g, 'items', 'gluehbirne', g.w * g.h * 5);
  assert.equal(give(D, s, 'bohneneintopf', 2), 2);
});

test('Rezept mit Rig-Teil: Ergebnis landet auf dem Schrottplatz', () => {
  const s = fresh();
  for (const g of Object.values(s.inv.grids)) g.items = g.items.filter(e => e.id !== 'schrottplatte');
  add(D, s.inv.grids.backpack, 'items', 'schrottplatte', 3);
  const r = craft(D, s, 'bleche_schweissen', 'werkbank');
  assert.equal(r.ok, true);
  assert.deepEqual(r.made, { id: 'bleche', part: true, n: 1 });
  assert.deepEqual(s.rig.spare.parts, ['bleche']);
  assert.equal(count(s.inv.grids.backpack, 'items', 'schrottplatte'), 0);
});
