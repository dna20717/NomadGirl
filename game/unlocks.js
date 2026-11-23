// Freischaltungen: der Meta-Baum (#184/#185, Konzept docs/concepts/freischaltungen.md, Daniel 23.11.2026: „die Progression so schneiden,
// dass die Systeme dosiert nach und nach auf den Spieler losgelassen werden“). No DOM.
//
// Werkstatt › Meta-Baum: Stufen (data/unlock_stages.json): enabled, firstPoi/firstSeed, stages [{ name, need }]: stage n opens when
//   `need` systems of stage n−1 are free (stage 0 is always open).
// Werkstatt › Meta-Baum: Freischaltungen (data/unlocks.json, catalog): { id: { name, stage, cost, hide, items, goals: [{ kind, …, meta }],
//   moment: { who, title, text, lesson }, grant: { workshops } } }
//     hide   'out' (ganz raus: no trace in the UI until free, Daniel) · 'hidden' (unsichtbar) · 'teaser' · 'quest' (told by a quest)
//     goals  each fulfilled goal adds its meta to the system; the system is free once its stage is open and meta ≥ cost
//            (cost 0: the first fulfilled goal frees it). Kinds: start, counter (name, n), quest (id done), flag (merker), day (n),
//            item (id in the camp inventories), unlock (another system free), poor (Δ below n), stage (stage n open)
//   The player never sees the tree (Daniel: „für den normalen Spieler komplett unsichtbar“); testers see it under Cheats › Meta-Baum.
//
// save.meta = { points, unlocked: [id], goals: { 'id:i': true }, stage, all? }   (all = everything free: old savegames, tests)
// No save (test room, POI test mode) or Freischaltungen off = everything free.

import { stock } from './crafting.js';
import { fits } from './rig.js';
const list = v => (Array.isArray(v) ? v : String(v ?? '').split(',')).map(x => String(x).trim()).filter(Boolean);

export function unlockConfig(D) {
  const U = D?.unlockStages || {};
  const stages = (U.stages?.length ? U.stages : [{ name: 'Stufe 0' }]).map((s, i) => ({ i, name: s.name || `Stufe ${i}`, need: s.need ?? 0, text: s.text || '' }));
  const systems = Object.entries(D?.unlocks || {}).map(([id, s]) => ({ id, name: s.name || id, stage: Math.max(0, Math.min(stages.length - 1, s.stage ?? 0)), cost: Math.max(0, s.cost ?? 0),
    hide: s.hide || 'hidden', goals: (s.goals || []).filter(g => g?.kind), moment: s.moment || null, grant: s.grant || null, teaser: s.teaser || '', description: s.description || '', items: list(s.items) }));
  return { on: U.enabled !== false && systems.length > 0, stages, systems, firstPoi: U.firstPoi || null, firstSeed: U.firstSeed || 1 };
}
export const systemOf = (D, id) => unlockConfig(D).systems.find(s => s.id === id) || null;

export function metaOf(save) {
  if (!save) return null;
  save.meta ??= { points: 0, unlocked: [], goals: {}, stage: 0, all: true };   // a save without meta (old savegame) has everything (repairSave)
  save.meta.unlocked ??= []; save.meta.goals ??= {}; save.meta.points ??= 0; save.meta.stage ??= 0;
  return save.meta;
}
// a brand-new game starts at stage 0 (newSave / newCycle call this)
export function freshMeta(D, keep = null, save = null) {
  const m = { points: 0, unlocked: [], goals: {}, stage: 0, pots: {}, base: { ...(save?.achievements?.counts || {}) } };   // counters count from here (they may run on across a Durchgang)
  if (keep) { m.unlocked = [...(keep.unlocked || [])]; m.stage = keep.stage || 0; m.points = keep.points || 0; m.all = !!keep.all; m.kept = true; }
  return m;
}

// is the system free? Unknown ids, no save, the feature off, everything free (old saves, tests): true
export function unlocked(D, save, id) {
  if (!save) return true;
  const C = unlockConfig(D);
  if (!C.on) return true;
  const m = metaOf(save);
  if (m.all) return true;
  if (!C.systems.some(s => s.id === id)) return true;
  return m.unlocked.includes(id);
}
// how a locked system shows: 'out' | 'hidden' | 'teaser' | 'quest', null when free
export function lockOf(D, save, id) { return unlocked(D, save, id) ? null : systemOf(D, id)?.hide || 'hidden'; }
export const out = (D, save, id) => !unlocked(D, save, id) && systemOf(D, id)?.hide === 'out';

// the stage that is open now
export function stageOf(D, save) {
  const C = unlockConfig(D), m = metaOf(save);
  if (!m || m.all) return C.stages.length - 1;
  let st = 0;
  for (let i = 1; i < C.stages.length; i++) {
    const prev = C.systems.filter(s => s.stage === i - 1), free = prev.filter(s => m.unlocked.includes(s.id)).length;
    if (free >= Math.min(C.stages[i].need || prev.length, prev.length)) st = i; else break;
  }
  return st;
}

// ---------- goals ----------
// what the game knows, for the goals: counters since this tree began, quests done, Merker, things in the camp inventories
export function gameCtx(D, save) {
  const m = metaOf(save), counts = save?.achievements?.counts || {};
  let st = null;
  return {
    counter: name => Math.max(0, (counts[name] || 0) - (m?.base?.[name] || 0)),
    questDone: id => !!save?.quests?.done?.[id],
    flag: f => (save?.road?.flags || []).includes(f),
    have: id => { try { st ??= stock(D, save); } catch { st = {}; } return st[id] || 0; },
  };
}
// ctx: { counter(name) → n, questDone(id) → bool, flag(name) → bool, have(item) → n }
function goalMet(D, save, g, ctx) {
  switch (g.kind) {
    case 'start': return true;
    case 'counter': return (ctx.counter?.(g.counter) ?? 0) >= (g.n ?? 1);
    case 'quest': return !!ctx.questDone?.(g.quest);
    case 'flag': return !!ctx.flag?.(g.flag);
    case 'day': return (save.day ?? 1) >= (g.n ?? 1);
    case 'item': return (ctx.have?.(g.item) ?? 0) >= (g.n ?? 1);
    case 'unlock': return unlocked(D, save, g.system);
    case 'poor': return (save.deltas ?? 0) < (g.n ?? 50);
    case 'stage': return stageOf(D, save) >= (g.n ?? 0);
    default: return false;
  }
}

// checks every goal; frees what is due. → [{ id, name, moment, grant }] newly free, in stage order
export function checkUnlocks(D, save, ctx = gameCtx(D, save)) {
  const C = unlockConfig(D), m = metaOf(save);
  if (!C.on || !m || m.all) return [];
  m.pots ??= {};
  const fresh = [];
  for (let pass = 0; pass < 4; pass++) {   // a freed system may fulfil another's goal („unlock“) or open the next stage
    let changed = false;
    const st = stageOf(D, save);
    for (const s of C.systems) {
      if (m.unlocked.includes(s.id)) continue;
      s.goals.forEach((g, i) => {
        const k = `${s.id}:${i}`;
        if (m.goals[k] || !goalMet(D, save, g, ctx)) return;
        m.goals[k] = true; m.pots[s.id] = (m.pots[s.id] || 0) + (g.meta ?? 1); m.points += g.meta ?? 1; changed = true;
      });
      const any = s.goals.some((g, i) => m.goals[`${s.id}:${i}`]);
      if (s.stage <= st && any && (m.pots[s.id] || 0) >= s.cost) { m.unlocked.push(s.id); fresh.push({ id: s.id, name: s.name, moment: s.moment, grant: s.grant, stage: s.stage, description: s.description }); changed = true; }
    }
    const now = stageOf(D, save);
    if (now !== m.stage) { m.stage = now; changed = true; }
    if (!changed) break;
  }
  return fresh;
}

// Cheats › Meta-Baum
export function setUnlocked(D, save, id, on) {
  const m = metaOf(save);
  if (m.all) { m.all = false; m.unlocked = unlockConfig(D).systems.map(s => s.id); }
  m.unlocked = m.unlocked.filter(x => x !== id);
  if (on) m.unlocked.push(id);
  m.stage = stageOf(D, save);
}
export function unlockAll(D, save) { const m = metaOf(save); m.all = true; m.unlocked = unlockConfig(D).systems.map(s => s.id); m.stage = stageOf(D, save); }
export function resetMeta(D, save) { save.meta = freshMeta(D, null, save); }

// the tree for the cheat view: stages with their systems and state
export function tree(D, save) {
  const C = unlockConfig(D), m = metaOf(save), st = stageOf(D, save);
  return C.stages.map(S => ({ ...S, open: S.i <= st, systems: C.systems.filter(s => s.stage === S.i).map(s => ({ id: s.id, name: s.name, hide: s.hide, cost: s.cost,
    free: unlocked(D, save, s.id), pot: m?.pots?.[s.id] || 0, goals: s.goals.map((g, i) => ({ ...g, done: !!m?.goals?.[`${s.id}:${i}`], text: goalText(D, g) })) })) }));
}
export function goalText(D, g) {
  switch (g.kind) {
    case 'start': return 'von Anfang an';
    case 'counter': return `${g.n ?? 1}× ${g.counter}`;
    case 'quest': return `Auftrag „${D.quests?.[g.quest]?.name || g.quest}“`;
    case 'flag': return `Merker ${g.flag}`;
    case 'day': return `ab Tag ${g.n}`;
    case 'item': return `${g.n ?? 1}× ${D.items?.[g.item]?.name || g.item} im Lager`;
    case 'unlock': return `nach ${systemOf(D, g.system)?.name || g.system}`;
    case 'poor': return `weniger als ${g.n ?? 50} Δ`;
    case 'stage': return `Stufe ${g.n} offen`;
    default: return g.kind;
  }
}
export const GOAL_KINDS = [['start', 'von Anfang an'], ['counter', 'Zähler erreicht'], ['quest', 'Auftrag erledigt'], ['flag', 'Merker gesetzt'], ['day', 'ab Tag'], ['item', 'Ding im Lager'], ['unlock', 'anderes System frei'], ['poor', 'weniger Δ als'], ['stage', 'Stufe offen']];
export const HIDE_KINDS = [['out', 'Ganz raus (keine Spur)'], ['hidden', 'Unsichtbar'], ['teaser', 'Teaser'], ['quest', 'Als Quest erzählt']];
export { list as unlockList };

// ---------- ganz raus: things of a hidden system ----------
// the system that hides this thing until it is free (Freischaltung › Dinge des Systems: item categories), or null
export function hiddenAs(D, save, itemId) {
  const t = D.items?.[itemId];
  if (!t || !save) return null;
  const taught = t.teaches ? D.items?.[D.recipes?.[t.teaches]?.result]?.category : null;   // a blueprint for a hidden thing hides with it
  for (const s of unlockConfig(D).systems) if ((s.items.includes(t.category) || (taught && s.items.includes(taught))) && !unlocked(D, save, s.id)) return s.id;
  return null;
}

// the workshops a freed system brings (Freischaltung › Geschenk): into a free place of the rig, else onto the scrapyard → [{ id, where }]
export function grantWorkshops(D, save, ids = []) {
  const out = [], rig = save.rig;
  for (const id of ids) {
    if (!D.workshops?.[id]) continue;
    let done = false;
    for (let ui = 0; ui < rig.units.length && !done; ui++) for (let at = 0; at < 12 && !done; at++) if (fits(D, rig, ui, at, id)) { rig.units[ui].workshops.push({ id, at }); done = true; }
    if (!done) (rig.spare.workshops ??= []).push(id);
    out.push({ id, where: done ? 'rig' : 'spare' });
  }
  return out;
}
