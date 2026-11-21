// An enemy as a gang sends it (#155, docs/concepts/enemy_kit.md › 5): no DOM, Node tests read it too.
//   POIs › Gang › Bausteine (`gang.traits`)  traits for all their plunderers
//   POIs › Gang › Ausrüstung (`gang.loadout`) rows { enemy, weapon, head, trait, chance }: empty enemy = every plunderer; a weapon only
//                                             replaces one of the same kind (melee for melee, ranged for ranged)
//   POIs › Gang › Wurf der Gang (`gang.throwItem`) what the Werfer they hand out throw
//   Spiel › Kampf › Ergeben (`combat.surrender`) every plunderer may give up (Daniel 21.11.2026: „alle Plünderer mit kleiner Chance“);
//                                             Gegner › Ergibt sich overrides it, chance 0 = never
// ⚠️ `gang.mod` (house modifier) waits for the catalogue „Gegner-Zusätze“ (concept 4).
import { TRAIT_IDS } from './traits/ids.js';

// plunderers: raider-kit enemies of the family Plünderer, not bosses (the same ones that wear the gang colour)
export const plunderer = def => !!def?.kit && def.family === 'raider' && def.behavior !== 'boss';

export const surrenderRules = D => { const C = D?.game?.combat?.surrender || {}; return { at: C.at ?? 25, chance: C.chance ?? 15 }; };

const kindOf = (D, w) => D?.weapons?.[w]?.kind || null;

// def as it fights for gang G (POIs › Gang, or the gang that took the place over) → a new def; rnd for the loadout chances
export function gangDef(D, id, def, G, rnd = Math.random) {
  if (!plunderer(def)) return def;
  const out = { ...def }, traits = [...(def.traits || [])], given = [];
  const add = t => { if (TRAIT_IDS.includes(t) && !traits.includes(t)) { traits.push(t); given.push(t); } };
  for (const t of G?.traits || []) add(t);
  for (const row of G?.loadout || []) {
    if (row.enemy && row.enemy !== id) continue;
    if (rnd() * 100 >= (row.chance ?? 100)) continue;
    if (row.weapon && D?.weapons?.[row.weapon] && (!def.weapon || kindOf(D, row.weapon) === kindOf(D, def.weapon))) out.weapon = row.weapon;
    if (row.head) out.kitHead = row.head;
    if (row.trait) add(row.trait);
  }
  if (given.includes('grenadier') && G?.throwItem && !def.throw?.item) out.throw = { ...def.throw, item: G.throwItem };
  // Ergeben for all: the enemy's own values first (Gegner › Ergibt sich), then Spiel › Kampf › Ergeben
  if (!traits.includes('surrender')) {
    const R = surrenderRules(D), own = def.surrender || {}, chance = own.chance ?? R.chance;
    if (chance > 0) { traits.push('surrender'); out.surrender = { ...own, at: own.at ?? R.at, chance }; out.surrenderAuto = true; }
  }
  out.traits = traits;
  if (G?.name && (given.length || out.weapon !== def.weapon || out.kitHead !== def.kitHead)) out.gangKit = { gang: G.name, traits: given, weapon: out.weapon, head: out.kitHead || null };
  return out;
}
