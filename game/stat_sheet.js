// Werte-Bildschirm (#091, Daniel 19.11.2026: „#087–#091 Systeme bauen“; Ideenspeicher: „Leylas Ausrüstung und der Tank auch über den
// Boni-Bus, ein Bildschirm mit allen Quellen“; baut auf #076 Punkt 7). Every value the game adds up, with where each point comes from,
// all from the Boni-Bus (game/mods.js) so the screen shows the same numbers the game uses. No DOM.
//   statSheet(D, save) → { leyla: [row], camp: [row], tank: [row], buffs: [{ name, stat, value, label }] }
//   row = { stat, name, unit, total, parts: [{ source, label, value }], good (helps) }
import { gearParts, parts as modParts, MOD_STATS, tankParts } from './mods.js';
import { GEAR_STATS } from './inventory.js';

export const SOURCE_NAMES = { gear: 'Ausrüstung', implant: 'Implantat', techtree: 'Techtree', trophy: 'Trophäe', brand: 'Markentreue', worker: 'Worker', crew: 'Crew',
  synergy: 'Synergie', upgrade: 'Ausbau', drone: 'AvAs Platine', buff: 'Buff' };
const TANK_STATS = [['tankDecay', 'Tank-Verfall', '%', -1], ['tankRescue', 'Rettung kostet', '%', -1], ['tankAccel', 'Beschleuniger', '%', 1], ['tankStatus', 'Tank-Anzeige im Run', '', 1], ['droneBattery', 'AvA-Akku', '%', 1]];
const sum = list => Math.round(list.reduce((n, p) => n + p.value, 0) * 10) / 10;

export function statSheet(D, save) {
  if (!save) return { leyla: [], camp: [], tank: [], buffs: [] };
  const G = gearParts(D, save), T = tankParts(D, save);
  // buffs waiting for the next run (cooking, sleeping): they count in the run, so they stand here as „nächster Run“
  const buffs = (save.buffs || []).map(id => ({ id, ...D.buffs?.[id] })).filter(b => b.stat && b.value);
  const leyla = GEAR_STATS.filter(([k]) => !['droneBattery', 'tankDecay'].includes(k)).map(([stat, name, unit, dir]) => {
    const parts = [...(G[stat] || []), ...buffs.filter(b => b.stat === stat).map(b => ({ source: 'buff', label: `${b.name || b.id} (nächster Run)`, value: b.value }))];
    const total = sum(parts);
    return { stat, name, unit, total, parts, good: total * (dir || 1) >= 0 };
  }).filter(r => r.parts.length);
  const camp = MOD_STATS.map(([stat, name, unit]) => { const parts = modParts(D, save, stat); return { stat, name, unit, total: sum(parts), parts, good: true }; }).filter(r => r.parts.length);
  const tank = TANK_STATS.map(([stat, name, unit, dir]) => { const parts = T[stat] || []; const total = sum(parts); return { stat, name, unit, total, parts, good: total * dir >= 0 }; }).filter(r => r.parts.length);
  return { leyla, camp, tank, buffs };
}
// „+12 %“, „−15 %“, „+2“, „+30 LP“
export const valueText = (v, unit = '') => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${String(Math.abs(v)).replace('.', ',')}${unit === '%' ? ' %' : unit}`;

// #104 (Daniel 19.11.2026: „Das wäre als Abschnitt des Inventars sinnvoller. Bitte sauber dort aufbauen“, dazu Grundwerte + Boni = Endwert):
// Leyla's values from the start: what she has without anything (Leyla › Leben, Ausdauer, Sprünge), plus the boni (gear, implants,
// techtree, trophies, brands, buffs for the next run) = what counts. mult: a % on 100 %, add: % points from 0, flat: plain numbers.
const BASES = [
  ['health', 'flat', D => D.leyla?.health ?? 100], ['stamina', 'flat', D => D.leyla?.stamina?.max ?? 100], ['defense', 'add', () => 0], ['damage', 'mult'], ['melee', 'mult'], ['ranged', 'mult'],
  ['crit', 'add', () => 0], ['speed', 'mult'], ['jump', 'mult'], ['dashCooldown', 'mult'], ['staminaRegen', 'mult'], ['regen', 'flat', () => 0], ['heal', 'mult'],
  ['airJumps', 'flat', D => (D.leyla?.abilities?.gated !== false ? 0 : D.leyla?.movement?.airJumps ?? 0)], ['airDash', 'flat', () => 0], ['hack', 'flat', null],
];
const num = v => String(Math.round(v * 10) / 10).replace('.', ',');
export function leylaValues(D, save) {
  const rows = Object.fromEntries((statSheet(D, save).leyla || []).map(r => [r.stat, r]));
  return BASES.map(([stat, kind, base]) => {
    const def = GEAR_STATS.find(s => s[0] === stat); if (!def) return null;
    const [, name, unit, dir] = def, r = rows[stat], total = r?.total || 0, parts = r?.parts || [];
    if (!base && kind === 'flat' && !parts.length) return null;   // no base and no bonus: nothing to say
    const b = kind === 'mult' ? 100 : base ? base(D) : 0, final = kind === 'mult' ? 100 + total : b + total;
    const fmt = v => stat === 'airDash' ? (v > 0 ? 'ja' : 'nein') : kind === 'flat' ? `${num(v)}${unit === '%' ? ' %' : unit}` : `${num(v)} %`;
    return { stat, name, kind, base: b, total, final, baseText: base === null ? '—' : fmt(b), bonusText: parts.length ? valueText(total, kind === 'flat' ? unit : '%') : '±0', finalText: fmt(final), parts,
      good: total * (dir || 1) >= 0, changed: !!parts.length };
  }).filter(Boolean);
}
