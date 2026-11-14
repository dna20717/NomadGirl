// The quest log (#016, Daniel 14.11.2026: „Wir brauchen eine Art Questlog!“; answers: main quest Heilmittel + AvA's tank as a standing
// task + side jobs; opened at the warroom and the campfire; the tracked quest can be chosen, a weak tank always comes first).
// No DOM: browser and Node.
//
//   save.quests = { active: { <id>: { base, day } }, done: { <id>: { day } }, tracked: 'main' | <id> }
//   D.quests[id] = { name, giver (companion), text, after (quest), minDay, counter + filter + target (like achievements) | item + count
//                    (deliver), reward: { deltas, items: [{ item, count }] }, done (line of the giver when it is handed in) }
import { state as achState } from './achievements.js';
import { stock, take } from './crafting.js';
import { add as addTo } from './inventory.js';
import { goal as mainGoal, pathTo, progress as mainProgress, goalId } from './quest.js';
import { status, owned } from './techtree.js';
import { phase, hoursLeft } from './tank.js';

export const qstate = save => { const q = (save.quests ??= {}); q.active ??= {}; q.done ??= {}; return q; };
const keyOf = x => x.filter ? `${x.counter}:${x.filter}` : x.counter;
const countOf = (save, x) => achState(save).counts[keyOf(x)] || 0;

// side jobs on offer: not taken, not done, the one before is done, the day has come
export function offers(D, save) {
  const Q = qstate(save);
  return Object.entries(D.quests || {}).filter(([id, x]) => !Q.active[id] && !Q.done[id] && (!x.after || Q.done[x.after]) && (save.day ?? 1) >= (x.minDay ?? 1)).map(([id]) => id);
}
export function accept(D, save, id) {
  const x = D.quests?.[id], Q = qstate(save);
  if (!x || Q.active[id] || Q.done[id]) return false;
  Q.active[id] = { base: x.counter ? countOf(save, x) : 0, day: save.day ?? 1 };
  if (!Q.tracked) Q.tracked = id;
  return true;
}
// how far: counter jobs count from the moment they were taken; deliveries look into the camp inventories and the backpack
export function progressOf(D, save, id) {
  const x = D.quests?.[id], a = qstate(save).active[id];
  if (!x) return { n: 0, target: 1 };
  const target = x.counter ? (x.target || 1) : (x.count || 1);
  const n = x.counter ? countOf(save, x) - (a?.base ?? 0) : (stock(D, save)[x.item] || 0);
  return { n: Math.max(0, Math.min(target, n)), target, ready: n >= target };
}
// hand in: deliveries give their things away, then the reward (Δ, things into the chest, if full into the backpack)
export function claim(D, save, id) {
  const x = D.quests?.[id], Q = qstate(save);
  if (!x || !Q.active[id] || !progressOf(D, save, id).ready) return { ok: false };
  if (!x.counter && x.item) take(D, save, x.item, x.count || 1);
  const R = x.reward || {}, got = [];
  if (R.deltas) { save.deltas = (save.deltas || 0) + R.deltas; got.push(`+${R.deltas} Δ`); }
  const G = save.inv?.grids || {};
  for (const r of R.items || []) {
    if (!r.item || !D.items?.[r.item]) continue;
    let left = r.count || 1;
    for (const k of ['chest', 'backpack']) if (left > 0 && G[k]) left = addTo(D, G[k], 'items', r.item, left);
    got.push(`${(r.count || 1) - (left || 0)}× ${D.items[r.item].name || r.item}`);
  }
  delete Q.active[id]; Q.done[id] = { day: save.day ?? 1 };
  if (Q.tracked === id) Q.tracked = 'main';
  return { ok: true, got, line: x.done || '' };
}
export function track(save, id) { qstate(save).tracked = id || 'main'; }

// the main quest as a chain: every node on the way to the cure, done / now / later, with what is missing
export function mainSteps(D, save) {
  const gid = goalId(D);
  return pathTo(D, gid).map(id => { const n = D.techtree[id], st = owned(save, id) ? { state: 'owned' } : status(D, save, id); return { id, name: n.name || id, state: st.state, reason: st.reason || '', goal: id === gid }; });
}
export function tankTask(D, save) {
  const t = save.tank;
  if (!t || D.tank?.enabled === false) return null;
  if (t.dead) return { cond: 0, phase: D.tank?.deadName || 'Tot', days: 0, dead: true };
  return { cond: Math.round(t.cond), phase: phase(D, save).name, days: Math.max(0, Math.round(hoursLeft(D, save) / 24)), dead: false };
}

// the line in the HUD: a weak tank first, then the tracked side job, else the main quest
export function trackedGoal(D, save) {
  const G = mainGoal(D, save), Q = qstate(save), id = Q.tracked;
  if (!G || G.kind === 'tank' || G.kind === 'lost' || !id || id === 'main' || !Q.active[id] || !D.quests?.[id]) return G;
  const x = D.quests[id], p = progressOf(D, save, id), giver = D.companions?.[x.giver]?.name;
  return { kind: p.ready ? 'ready' : 'side', text: `${x.name || id}${p.ready ? ' · erledigt' : ''}`, sub: p.ready ? `Abgeben im Questlog${giver ? ` bei ${giver}` : ''}` : `${p.n} / ${p.target}${giver ? ` · für ${giver}` : ''}`, progress: p.n / p.target, quest: id };
}

// everything for the window
export function questLog(D, save) {
  const Q = qstate(save);
  return {
    main: { goal: mainGoal(D, save), progress: mainProgress(D, save), steps: mainSteps(D, save), name: D.techtree?.[goalId(D)]?.name || 'Das Heilmittel' },
    tank: tankTask(D, save),
    active: Object.keys(Q.active).filter(id => D.quests?.[id]).map(id => ({ id, ...D.quests[id], ...progressOf(D, save, id) })),
    offers: offers(D, save).map(id => ({ id, ...D.quests[id], ...progressOf(D, save, id) })),
    done: Object.keys(Q.done).filter(id => D.quests?.[id]).map(id => ({ id, ...D.quests[id], day: Q.done[id].day })),
    tracked: Q.tracked || 'main',
  };
}
