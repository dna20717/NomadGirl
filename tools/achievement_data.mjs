#!/usr/bin/env node
// #012 Achievements & Trophäen (design.md › „Achievements & Trophäen“): writes the starting content once: 12 achievements across
// Kampf, Erkundung, Cosy, AvA & Tank and Story (2 hidden), one trophy each (thing with tag Trophäe, symbol from icons_trophies) and its
// one-time recipe at the workbench or the kitchenette. Ingredients are mostly salvage material (design: „Zutaten gern aus dem Zerlegen“).
// Values in the workshop win afterwards; run again only to restore them.   node tools/achievement_data.mjs
import fs from 'node:fs';
import { pretty } from './json.js';
const F = f => `projects/nomadgirl/data/${f}.json`, read = f => fs.existsSync(F(f)) ? JSON.parse(fs.readFileSync(F(f), 'utf8')) : {}, write = (f, d) => fs.writeFileSync(F(f), pretty(d) + '\n');
const AC = read('achievements'), I = read('items'), RC = read('recipes'), A = read('assets');

if (fs.existsSync('projects/nomadgirl/assets/items/icons_trophies.png'))
  A.icons_trophies = { ...(A.icons_trophies || {}), name: 'Symbole · Trophäen', kind: 'icons', file: 'assets/items/icons_trophies.png', grid: [4, 3], cell: [128, 128],
    source: 'KI (PixelLab, Create Image Pro je Trophäe, AAP-64, Stilbild icons_treasure) + Code (Raster)', date: '13.11.2026',
    description: 'Die 12 Trophäen der Achievements (#012), je 2 × 2 Felder, in der Reihenfolge der Achievements.' };

// id, category, name, text, counter, filter, target, hidden, trophy [id, name, text, glyph], station, ingredients, bonus
const L = [
  ['plage', 'combat', 'Plünderer-Plage', 'Besiege 25 Plünderer.', 'kills', 'raider', 25, false,
    ['raider_maske', 'Raider-Maske', 'Zusammengeflickt aus den Masken derer, die dich unterschätzt haben.', '👺'], 'werkbank', [['schrott', 4], ['stoffreste', 2], ['panzertape', 1]], [['damage', 5]]],
  ['revolverheldin', 'combat', 'Revolverheldin', 'Besiege 30 Gegner mit dem Trommelrevolver.', 'kills', 'trommelrevolver', 30, false,
    ['messing_patrone', 'Messing-Patrone', 'Eine polierte Patrone auf einem Sockel. Die dreißigste.', '🔫'], 'werkbank', [['schrott', 2], ['kupferkabel', 2], ['kronkorken', 10]], [['crit', 5]]],
  ['ins_schwarze', 'combat', 'Ins Schwarze', 'Erledige 25 Gegner mit einem kritischen Treffer.', 'kills', 'crit', 25, true,
    ['blech_zielscheibe', 'Blech-Zielscheibe', 'Ein Verkehrsschild mit einem Loch genau in der Mitte.', '🎯'], 'werkbank', [['schrottplatte', 1], ['schrauben', 4]], [['ranged', 6]]],
  ['schatzsucherin', 'explore', 'Schatzsucherin', 'Finde alle Secrets im Bunker 13 in einem Run.', 'secretsAll', 'bunker_13', 1, false,
    ['bunker_schluesselbund', 'Bunker-Schlüsselbund', 'Dreizehn Schlüssel. Einer davon passt überall.', '🗝️'], 'werkbank', [['schrott', 3], ['kronkorken', 6]], [['secrets', 1]]],
  ['streckenkennerin', 'explore', 'Streckenkennerin', 'Schaffe 10 POIs.', 'pois', '', 10, false,
    ['delta_petrol_schild', 'Delta-Petrol-Schild', 'Das Emailschild der Tankstelle an Kilometer 7. Leicht verbeult, voll mit Erinnerungen.', '⛽'], 'werkbank', [['schrottplatte', 2], ['gluehbirne', 1], ['kupferkabel', 1]], [['loot', 10]]],
  ['bestnote', 'explore', 'Bestnote', 'Schaffe 3 POIs mit Rang S.', 'pois', 'S', 3, false,
    ['rang_s_abzeichen', 'Rang-S-Abzeichen', 'Ein Abzeichen aus einer Goldmünze. AvA hat es graviert.', '🏅'], 'werkbank', [['goldzahn', 1], ['schrauben', 2]], [['sell', 10]]],
  ['gruener_daumen', 'cosy', 'Grüner Daumen', 'Ernte 25 Mal in der Hydrokultur.', 'harvests', '', 25, false,
    ['goldene_giesskanne', 'Goldene Gießkanne', 'Gelb lackiert, nicht vergoldet. Die Pflanzen merken den Unterschied nicht.', '🪴'], 'werkbank', [['schrott', 3], ['rohrbogen', 1], ['tomaten', 2]], [['growth', 25]]],
  ['sternekoechin', 'cosy', 'Sterneköchin', 'Koche 20 Gerichte.', 'cooked', '', 20, false,
    ['goldener_wok', 'Goldener Wok', 'Ein Wok mit dreißig Jahren Patina. Onkel Sung nickt anerkennend.', '🥘'], 'kochnische', [['schrottplatte', 1], ['speiseoel', 1], ['gewuerzmischung', 1]], [['heal', 15]]],
  ['lichterfest', 'cosy', 'Lichterfest', 'Häng 6 Lichterketten im Camp auf.', 'lights', '', 6, true,
    ['neon_herz', 'Neon-Herz', 'Eine Neonröhre, zu einem Herz gebogen. Brummt leise.', '💗'], 'werkbank', [['gluehbirne', 2], ['kupferkabel', 2], ['batteriezelle', 1]], [['regen', 1]]],
  ['gut_gekuehlt', 'ava', 'Gut gekühlt', 'Schaffe 10 Runs, ohne dass der Tank kritisch wird.', 'tankSafeRuns', '', 10, false,
    ['avas_erstes_bild', 'AvAs erstes Bild', 'Gemalt mit dem Greifarm: Leyla, der Van, ein Herz. Gerahmt in einer Tankklappe.', '🖼️'], 'werkbank', [['schrottplatte', 1], ['stoffreste', 1], ['kuehlmittel', 1]], [['tankDecay', -10]]],
  ['nie_allein', 'ava', 'Nie allein', 'Lass dich 3 Mal von AvA heimbringen.', 'knockouts', '', 3, false,
    ['notfall_chip', 'AvAs Notfall-Chip', 'Der Chip, der dreimal den Heimweg gefunden hat. Steht jetzt unter Glas.', '💾'], 'werkbank', [['chip', 1], ['alte_platine', 1]], [['tankRescue', -15]]],
  ['neuer_anfang', 'story', 'Neuer Anfang', 'Wach in einem neuen Durchgang auf.', 'cycles', '', 1, false,
    ['traumfaenger', 'Traumfänger', 'Aus Kabeln und Stoff, aus dem Traum mitgebracht. Hält die schlechten Nächte fern.', '🕸️'], 'werkbank', [['kupferkabel', 2], ['stoffreste', 2]], [['health', 10]]],
];
L.forEach(([id, category, name, description, counter, filter, target, hidden, [tid, tname, ttext, glyph], station, ing, bonus], i) => {
  I[tid] = { ...(I[tid] || {}), name: tname, category: 'valuable', size: [2, 2], stack: 1, value: 0, glyph, description: ttext, tags: ['trophy'],
    ...(A.icons_trophies ? { look: 'icons_trophies', icon: i } : {}) };
  const rid = `trophaee_${tid}`;
  RC[rid] = { ...(RC[rid] || {}), name: tname, station, ingredients: ing.map(([item, count]) => ({ item, count })), result: tid, count: 1, time: 45, discovery: ['achievement'], once: true,
    hint: `Trophäe für „${name}“` };
  AC[id] = { ...(AC[id] || {}), name, description, category, ...(hidden ? { hidden: true } : {}), order: i + 1, counter, ...(filter ? { filter } : {}), target, recipe: rid,
    bonus: bonus.map(([stat, value]) => ({ stat, value })) };
});
write('achievements', AC); write('items', I); write('recipes', RC); write('assets', A);
console.log(`${L.length} Achievements, Trophäen und Rezepte geschrieben${A.icons_trophies ? ' (mit Symbolen)' : ''}`);
