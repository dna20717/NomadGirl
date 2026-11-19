// The tech tree in the warroom (design.md › Progression, Daniel 12.11.2026): nodes cost progress resources (Technik, Wissen, Bio …),
// which are items in the world, paid from the camp inventories like recipe ingredients. Unlocked nodes stay across Durchgänge
// (save.nodes), they unlock recipes (discovery „Knoten im Techtree“) and passive bonuses. No DOM: browser and Node.
//
//   D.resources[id] = { name, item, color, hidden, tab, order, darkness }   hidden = not shown (e.g. „Dunkelheit“, multiplier per level)
//   D.techtree[id]  = { name, description, tab, look, icon, pos: [col, row], cost: [{ resource, count }], requires: [ids],
//                       recipes: [ids], bonus: [{ stat, value }] }
import { bonuses as trophyBonuses } from './achievements.js';
import { stock, take, learn } from './crafting.js';
import { gearStats } from './inventory.js';
import { droneBonuses } from './stations.js';
import { setFlag } from './conditions.js';
import { revealPlace } from './worldmap.js';

export const nodes = save => (save.nodes ??= []);
export const owned = (save, id) => nodes(save).includes(id);

// tabs: visible resources in their order
export function tabs(D) {
  return Object.entries(D.resources || {}).filter(([, r]) => !r.hidden && r.tab !== false)
    .sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0)).map(([id, r]) => ({ id, ...r }));
}
export function nodesOf(D, tab) { return Object.entries(D.techtree || {}).filter(([, n]) => n.tab === tab).map(([id, n]) => ({ id, ...n })); }

// how much of a resource the camp holds (its item in the camp inventories)
export function have(D, save, res) { const it = D.resources?.[res]?.item; return it ? stock(D, save)[it] || 0 : 0; }

export function status(D, save, id) {
  const n = D.techtree?.[id];
  if (!n) return { state: 'none' };
  if (owned(save, id)) return { state: 'owned' };
  const need = (n.requires || []).filter(r => !owned(save, r));
  if (need.length) return { state: 'locked', need, reason: 'Erst: ' + need.map(r => D.techtree[r]?.name || r).join(', ') };
  const miss = (n.cost || []).map(c => ({ ...c, have: have(D, save, c.resource) })).filter(c => c.have < (c.count || 0));
  if (miss.length) return { state: 'open', miss, reason: 'Es fehlt: ' + miss.map(c => `${c.count - c.have} ${D.resources?.[c.resource]?.name || c.resource}`).join(', ') };
  return { state: 'ready' };
}

export function unlock(D, save, id) {
  const st = status(D, save, id);
  if (st.state !== 'ready') return { ok: false, reason: st.reason || 'Geht nicht' };
  const n = D.techtree[id];
  for (const c of n.cost || []) { const it = D.resources?.[c.resource]?.item; if (it) take(D, save, it, c.count || 0); }
  nodes(save).push(id);
  const learnt = (n.recipes || []).filter(r => learn(save, r));
  for (const f of String(n.flags || '').split(',').map(x => x.trim()).filter(Boolean)) setFlag(save, f);   // #110 Welt & Story
  const revealed = n.reveal ? revealPlace(D, save, n.reveal) : null;
  return { ok: true, node: id, learnt, revealed };
}

// all passive bonuses with their source (#076 Boni-Bus: the tank and AvA's battery show where each point comes from)
// → [{ stat, source: 'techtree' | 'implant' | 'trophy' | 'drone', label, value }]
export function bonusParts(D, save) {
  const out = [], push = (stat, source, label, value) => { if (value) out.push({ stat, source, label, value }); };
  for (const id of save?.nodes || []) for (const b of D.techtree?.[id]?.bonus || []) if (b.stat) push(b.stat, 'techtree', D.techtree[id].name || id, Number(b.value) || 0);
  // Cyberware (#006): implants that pull on the tank or on AvA's battery (Reaktor-Herz: Tank-Verfall +30 %) count like Techtree bonuses
  for (const [slot, id] of Object.entries(save?.inv?.wear || {})) { const g = gearStats(D, { [slot]: id }); for (const k of ['tankDecay', 'droneBattery']) push(k, 'implant', D.items?.[id]?.name || id, g[k]); }
  // trophies on the stands (#012): AvAs erstes Bild (Tank-Verfall), Notfall-Chip (Rettung), AvA-Akku
  const t = trophyBonuses(D, save); for (const k of ['tankDecay', 'tankRescue', 'droneBattery']) push(k, 'trophy', 'Trophäen', t[k]);
  // AvA's board from the drone workshop (#013): more battery, a cheaper rescue
  const d = droneBonuses(D, save); push('droneBattery', 'drone', 'AvAs Platine', d.battery); push('tankRescue', 'drone', 'AvAs Platine', d.rescue ? -d.rescue : 0);
  return out;
}
// all passive bonuses of the owned nodes (and the tank's other sources), summed per stat
export function bonuses(D, save) {
  const out = {};
  for (const p of bonusParts(D, save)) out[p.stat] = (out[p.stat] || 0) + p.value;
  return out;
}

// the tank's modifiers (game/tank.js): percentages → factors
export function tankMods(D, save) {
  const b = bonuses(D, save), f = v => Math.max(0, 1 + (v || 0) / 100);
  return { decay: f(b.tankDecay), rescue: f(b.tankRescue), accel: f(b.tankAccel) };
}

// #110 a workshop or rig part that a node unlocks can only be bought once one of those nodes is owned → the node's name, or null
export function techLock(D, save, area, id) {
  const by = Object.entries(D.techtree || {}).filter(([, n]) => (n[area] || []).includes(id));
  if (!by.length || by.some(([k]) => owned(save, k))) return null;
  return by[0][1].name || by[0][0];
}
