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
