// Achievements & Trophäen (#012, design.md › „Achievements & Trophäen“, Daniel, 13.11.2026: „Wir benutzen den Trophäenraum, um
// Achievements zu visualisieren. Ein Achievement erzeugt immer ein Rezept … das man einmalig an einer Werkbank herstellen kann. Wenn man
// das Belohnungs-Item hergestellt und im Trophäenraum ausgestellt hat, bekommt man einen permanenten Bonus“). Pure logic, no DOM.
//
//   save.achievements = { counts: { '<counter>' | '<counter>:<tag>': n }, done: { <id>: { day, cycle } }, made: [recipe id] }
//
// Counters (ACHIEVEMENT_COUNTERS) are bumped by the game with tags (kills: enemy id, family, weapon, 'crit'); an achievement watches one
// counter, optionally one tag (Filter), and is reached at its target. Reached → its recipe is learnt (once craftable). The trophy it
// makes works while it stands on any trophy stand of any treasury in the rig (no upper limit, several treasuries count).
import { learn, known } from './crafting.js';
import { containers } from './save.js';

// what the game counts (key, label, tags it may carry)
export const ACHIEVEMENT_COUNTERS = [
  ['kills', 'Gegner besiegt (Filter: Gegner, Familie, Waffe oder crit)'], ['secrets', 'Secrets gefunden (Filter: POI)'],
  ['secretsAll', 'Alle Secrets eines POI in einem Run (Filter: POI)'], ['pois', 'POI geschafft (Filter: POI oder Rang S/A/B …)'],
  ['harvests', 'Ernten in der Hydrokultur'], ['cooked', 'Gerichte gekocht (Filter: Rezept)'], ['crafted', 'Hergestellt an der Werkbank (Filter: Rezept)'],
  ['experiments', 'Experimente geglückt'], ['failures', 'Experimente misslungen'], ['salvaged', 'Dinge zerlegt'], ['recipes', 'Rezepte im Rezeptbuch (Stand)'],
  ['sleeps', 'Nächte geschlafen'], ['trips', 'Gefahren (Reisekarte)'], ['encounters', 'Zwischenfälle unterwegs'], ['tankSafeRuns', 'Runs ohne kritischen Tank'], ['knockouts', 'k.o. (AvA bringt Leyla heim)'],
  ['cycles', 'Neuer Durchgang'], ['lights', 'Lichterketten im Camp (Stand)'], ['workshops', 'Werkstätten gekauft'], ['deltas', 'Δ aus Runs verdient'],
];
// what a trophy on a stand gives: Leyla's gear values (game/inventory.js › GEAR_STATS) plus special effects
export const ACHIEVEMENT_SPECIALS = [
  ['growth', 'Hydrokultur wächst schneller %'], ['loot', 'Extra-Beute %'], ['sell', 'Mehr Δ aus Runs %'], ['secrets', 'Secrets schimmern (1 = an)'],
  ['tankRescue', 'Tank: Rettung kostet %'],
];
export const ACHIEVEMENT_CATEGORIES = [['combat', 'Kampf'], ['explore', 'Erkundung'], ['cosy', 'Cosy'], ['ava', 'AvA & Tank'], ['story', 'Story']];

export const state = save => {
  const a = (save.achievements ??= {});
  a.counts ??= {}; a.done ??= {}; a.made ??= [];
  return a;
};
export const reached = (save, id) => !!save?.achievements?.done?.[id];
export const list = D => Object.entries(D.achievements || {}).map(([id, x]) => ({ id, ...x })).sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.id.localeCompare(b.id));
const counterKey = x => x.filter ? `${x.counter}:${x.filter}` : x.counter;
export const progress = (D, save, id) => {
  const x = D.achievements?.[id];
  if (!x) return { n: 0, target: 1 };
  return { n: Math.min(x.target || 1, state(save).counts[counterKey(x)] || 0), target: x.target || 1 };
};

// the trophy recipe of an achievement (Achievements › Rezept) and the trophy thing it makes
export const recipeOf = (D, id) => D.achievements?.[id]?.recipe && D.recipes?.[D.achievements[id].recipe] ? D.achievements[id].recipe : null;
export const trophyOf = (D, id) => D.recipes?.[recipeOf(D, id)]?.result || null;
// the achievement a thing is the trophy of (null = none)
export function achievementOf(D, itemId) {
  for (const [id] of Object.entries(D.achievements || {})) if (trophyOf(D, id) === itemId) return id;
  return null;
}
export const isTrophy = (D, a, id) => a === 'items' && !!achievementOf(D, id);
// a trophy recipe can be made once (Rezepte › Einmalig)
export const madeOnce = (save, rid) => (save?.achievements?.made || []).includes(rid);
export function markMade(D, save, rid) { if (D.recipes?.[rid]?.once && !madeOnce(save, rid)) state(save).made.push(rid); }

// reaches what is due → [{ id, name, recipe, trophy, learnt }]
export function check(D, save) {
  const A = state(save), out = [];
  for (const x of list(D)) {
    if (A.done[x.id] || !x.counter) continue;
    if ((A.counts[counterKey(x)] || 0) < (x.target || 1)) continue;
    A.done[x.id] = { day: save.day || 1, cycle: save.cycle || 1 };
    const rid = recipeOf(D, x.id), learnt = rid ? learn(save, rid) : false;
    out.push({ id: x.id, name: x.name || x.id, recipe: rid, recipeName: rid ? D.recipes[rid].name || D.items?.[D.recipes[rid].result]?.name || rid : null, trophy: trophyOf(D, x.id), learnt });
  }
  return out;
}
// counts something: the counter and one entry per tag; → newly reached achievements
export function bump(D, save, counter, n = 1, tags = []) {
  if (!D.achievements || !(n > 0)) return [];
  const C = state(save).counts;
  C[counter] = (C[counter] || 0) + n;
  for (const t of tags) if (t != null && t !== '') C[`${counter}:${t}`] = (C[`${counter}:${t}`] || 0) + n;
  return check(D, save);
}
// a state, not a sum (recipes in the book, string lights in the camp): the counter becomes at least this
export function level(D, save, counter, value) {
  if (!D.achievements) return [];
  const C = state(save).counts;
  if ((C[counter] || 0) < value) C[counter] = value;
  return check(D, save);
}

// ---------- the bonus: trophies on the stands of every treasury in the rig ----------
// → [{ id, item, key }] one per achievement whose trophy stands somewhere (the same trophy twice counts once)
export function displayed(D, save) {
  const g = save.inv?.grids || {}, seen = new Map();
  for (const c of containers(D, save)) {
    if (c.stand == null || !g[c.key]) continue;
    for (const e of g[c.key].items) { const id = e.a === 'items' && achievementOf(D, e.id); if (id && !seen.has(id)) seen.set(id, { id, item: e.id, key: c.key }); }
  }
  return [...seen.values()];
}
// summed per stat: { crit: 5, growth: 25, … }
export function bonuses(D, save) {
  const out = {};
  if (!save || !D.achievements) return out;
  for (const d of displayed(D, save)) for (const b of D.achievements[d.id]?.bonus || []) if (b?.stat) out[b.stat] = (out[b.stat] || 0) + (Number(b.value) || 0);
  return out;
}
// one line per bonus for tooltips: '+5 % Krit-Chance'
export function bonusText(D, x, stats = []) {
  const names = Object.fromEntries([...stats.map(s => [s[0], [s[1], s[2]]]), ...ACHIEVEMENT_SPECIALS.map(([k, l]) => [k, [l.replace(/ %$| \(1 = an\)$/, ''), / %$/.test(l) ? '%' : '']])]);
  return (x?.bonus || []).filter(b => b?.stat).map(b => {
    const [name, unit] = names[b.stat] || [b.stat, ''], v = Number(b.value) || 0;
    if (b.stat === 'secrets') return name;
    return `${v > 0 ? '+' : ''}${v}${unit === '%' ? ' %' : unit || ''} ${name}`;
  });
}

// ---------- a new Durchgang (design.md: „Achievements, ihre Rezepte und hergestellte Trophäen bleiben als Erinnerungsstücke“) ----------
// → the trophies Leyla owned anywhere (camp grids, backpack, ground), to go into the memory chest at the fire
export function keepThrough(D, old, s) {
  const A = state(old);
  s.achievements = { counts: { ...A.counts, cycles: (A.counts.cycles || 0) + 1 }, done: { ...A.done }, made: [...A.made], news: [] };
  for (const id of Object.keys(A.done)) { const rid = recipeOf(D, id); if (rid && !s.recipes.includes(rid)) s.recipes.push(rid); }
  const trophies = [], take = e => { if (e.a === 'items' && achievementOf(D, e.id)) trophies.push({ a: 'items', id: e.id, n: e.n || 1 }); };
  for (const g of Object.values(old.inv?.grids || {})) for (const e of g?.items || []) take(e);
  for (const piles of Object.values(old.ground || {})) for (const p of piles || []) for (const e of p.grid?.items || []) take(e);
  return trophies;
}

// for the pause menu: reached, open, hidden (as „???“)
export function overview(D, save) {
  return list(D).map(x => {
    const done = reached(save, x.id), p = progress(D, save, x.id), rid = recipeOf(D, x.id), tid = trophyOf(D, x.id);
    const shown = displayed(D, save).some(d => d.id === x.id), made = rid ? madeOnce(save, rid) : false;
    return { id: x.id, category: x.category || 'story', hidden: !!x.hidden && !done, done, n: p.n, target: p.target, name: x.name || x.id, description: x.description || '',
      trophy: tid, trophyName: D.items?.[tid]?.name || tid, recipe: rid, known: rid ? known(save, rid) : false, made, shown, at: save?.achievements?.done?.[x.id] || null };
  });
}
