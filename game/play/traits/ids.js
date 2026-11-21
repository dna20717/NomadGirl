// Ids and labels of the enemy traits (#139, docs/concepts/enemy_kit.md › 2). No imports, no DOM: the schema reads this in Node too.
// Each trait has its own file game/play/traits/<id>.js and its own section in the area „Gegner“ (shown only when picked).
export const TRAIT_OPTIONS = [
  ['sniper', 'Scharfschütze (Laser, Aufschalten)'],
  ['grenadier', 'Werfer (Granate, Molotow, Säure)'],
  ['medic', 'Sanitäter (heilt, holt Gefallene zurück)'],
  ['alarm', 'Alarmgeber (läuft zur Sirene)'],
  ['coward', 'Feigling (flieht, lässt Beute fallen)'],
  ['surrender', 'Ergibt sich (Gefangen nehmen, laufen lassen, erledigen)'],
];
export const TRAIT_IDS = TRAIT_OPTIONS.map(([id]) => id);

// what can be thrown (Werfer and Leyla's grenade, game/play/throwables.js)
export const THROW_ITEMS = [['granate', 'Granate (prallt ab, platzt nach der Zündzeit)'], ['molotow', 'Molotow (zerspringt, Feuerfläche)'], ['saeure', 'Säure (zerspringt, ätzende Pfütze)']];
