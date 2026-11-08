// Cooking and crafting in the camp (Camp step 3, design.md › Crafting & Kochen): pure logic, browser and Node, no DOM.
// The interface is game/play/craft_ui.js. Values come from the area "Kochen & Craften" (data/crafting.json) and "Rezepte".
//
// Where things come from: every camp inventory (storage places in the rig, the chest, then the backpack).
// Where things go: backpack first, then the chest, then the storage places; what is left is returned (the scene drops it on the ground).
// Recipe book: save.recipes = [recipe id]; at the start every recipe with discovery "start".
// Experimenting: ingredients go into the pot; a recipe of this kind of workshop with the same kinds of ingredients
// (and enough of each, or exactly as many with "Genaue Mengen") is a hit, everything else is curious junk.
// Time: recipes take minutes (Rezepte › Dauer), the clock jumps on (Ereignis-Zeit).
import { add, remove, count } from './inventory.js';
import { containers, advance } from './save.js';

export const startRecipes = D => Object.entries(D.recipes || {}).filter(([, r]) => (r.discovery || []).includes('start')).map(([id]) => id);
export const known = (save, id) => (save.recipes || []).includes(id);
export function learn(save, id) { save.recipes ??= []; if (known(save, id)) return false; save.recipes.push(id); return true; }

// the function of a workshop (kitchen, craft …); recipes work in every workshop with the same function (Küche can cook Kochnische recipes)
export const functionOf = (D, ws) => D.workshops?.[ws]?.function || null;
export function recipesFor(D, ws) {
  const f = functionOf(D, ws);
  return Object.entries(D.recipes || {}).filter(([, r]) => r.station === ws || (f && functionOf(D, r.station) === f)).map(([id, r]) => ({ id, ...r }));
}

// the grids Leyla can use in the camp, in the order things are taken from them
export function sources(D, save) {
  const g = save.inv.grids, out = [];
  for (const c of containers(D, save)) if (c.key !== 'chest' && g[c.key]) out.push({ key: c.key, name: c.name, grid: g[c.key] });
  if (g.chest) out.push({ key: 'chest', name: 'Kiste', grid: g.chest });
  if (g.backpack) out.push({ key: 'backpack', name: 'Rucksack', grid: g.backpack });
  return out;
}
// everything on hand: { item id: count }
export function stock(D, save) {
  const out = {};
  for (const s of sources(D, save)) for (const e of s.grid.items) if (e.a === 'items') out[e.id] = (out[e.id] || 0) + e.n;
  return out;
}
export const have = (D, save, id) => sources(D, save).reduce((n, s) => n + count(s.grid, 'items', id), 0);

// takes n of an item out of the camp inventories (in source order); → how many were taken
export function take(D, save, id, n) {
  let left = n;
  for (const s of sources(D, save)) {
    for (const e of [...s.grid.items]) {
      if (!left) break;
      if (e.a !== 'items' || e.id !== id) continue;
      const k = Math.min(left, e.n);
      e.n -= k; left -= k;
      if (e.n <= 0) remove(s.grid, e);
    }
  }
  return n - left;
}
// puts n of a thing into the backpack, the chest, the storage places; → how many did not fit
export function give(D, save, id, n, a = 'items') {
  const g = save.inv.grids, order = ['backpack', 'chest', ...sources(D, save).map(s => s.key).filter(k => k !== 'backpack' && k !== 'chest')];
  for (const key of order) { if (!n) break; if (g[key]) n = add(D, g[key], a, id, n); }
  return n;
}

// what a recipe still needs: [{ item, need, have }] (empty = ready)
export function missing(D, save, r) {
  const st = stock(D, save);
  return (r.ingredients || []).map(i => ({ item: i.item, need: i.count || 1, have: st[i.item] || 0 })).filter(i => i.have < i.need);
}

// cooks / crafts a known recipe: takes the ingredients, gives the result, moves the clock. → { ok, reason?, made, left, minutes }
export function craft(D, save, id, ws) {
  const r = D.recipes?.[id];
  if (!r) return { ok: false, reason: 'Unbekanntes Rezept' };
  if (!known(save, id)) return { ok: false, reason: 'Steht nicht im Rezeptbuch' };
  if (ws && !recipesFor(D, ws).some(x => x.id === id)) return { ok: false, reason: 'Geht an dieser Werkstatt nicht' };
  if (!D.items?.[r.result]) return { ok: false, reason: 'Rezept ohne Ergebnis' };
  if (missing(D, save, r).length) return { ok: false, reason: 'Es fehlen Zutaten' };
  for (const i of r.ingredients || []) take(D, save, i.item, i.count || 1);
  const n = r.count || 1, minutes = r.time ?? 10;
  advance(save, minutes / 60);
  return { ok: true, recipe: id, made: { id: r.result, n }, left: give(D, save, r.result, n), minutes };
}

// the pot: { item id: count } → the recipe it makes at this workshop (or null)
export function match(D, ws, pot) {
  const C = D.crafting || {}, kinds = Object.keys(pot).filter(k => pot[k] > 0).sort();
  if (!kinds.length) return null;
  for (const r of recipesFor(D, ws)) {
    const need = {};
    for (const i of r.ingredients || []) need[i.item] = (need[i.item] || 0) + (i.count || 1);
    const rk = Object.keys(need).sort();
    if (rk.join() !== kinds.join()) continue;
    if (rk.every(k => C.exactCounts ? pot[k] === need[k] : pot[k] >= need[k])) return r;
  }
  return null;
}
// close to a recipe: all but one kind of ingredient right (one missing, one too many or one swapped), or the right kinds but too few
export function nearMiss(D, ws, pot) {
  const kinds = new Set(Object.keys(pot).filter(k => pot[k] > 0));
  for (const r of recipesFor(D, ws)) {
    const rk = new Set((r.ingredients || []).map(i => i.item));
    const extra = [...kinds].filter(k => !rk.has(k)).length, lack = [...rk].filter(k => !kinds.has(k)).length;
    if (extra + lack === 0 || (extra <= 1 && lack <= 1 && extra + lack >= 1 && rk.size > 1)) return r;
  }
  return null;
}

// tries the pot: hit = the recipe is learnt (if new) and made with what it needs; miss = the pot is used up and curious junk comes out.
// → { hit, recipe?, learnt?, made: { id, n }, left, minutes, near? }
export function experiment(D, save, ws, pot, rnd = Math.random) {
  const C = D.crafting || {}, st = stock(D, save);
  for (const [id, n] of Object.entries(pot)) if (n > (st[id] || 0)) return { ok: false, reason: `Zu wenig ${D.items?.[id]?.name || id}` };
  if (!Object.values(pot).some(n => n > 0)) return { ok: false, reason: 'Der Topf ist leer' };
  const r = match(D, ws, pot);
  if (r) {
    const learnt = learn(save, r.id);
    for (const i of r.ingredients || []) take(D, save, i.item, i.count || 1);
    const n = r.count || 1, minutes = r.time ?? 10;
    advance(save, minutes / 60);
    return { ok: true, hit: true, recipe: r.id, learnt, made: { id: r.result, n }, left: give(D, save, r.result, n), minutes };
  }
  const near = C.nearMiss !== false ? nearMiss(D, ws, pot) : null;
  const share = (C.failConsume ?? 100) / 100;
  for (const [id, n] of Object.entries(pot)) take(D, save, id, Math.max(n > 0 ? 1 : 0, Math.round(n * share)));
  const junk = failure(D, functionOf(D, ws), rnd), minutes = C.experimentMinutes ?? 20;
  advance(save, minutes / 60);
  return { ok: true, hit: false, near: near?.id || null, made: junk, left: junk ? give(D, save, junk.id, junk.n) : 0, minutes };
}
// curious junk for a failed try (Kochen & Craften › Fehlschläge, by the workshop's function; rows without function count everywhere)
export function failure(D, fn, rnd = Math.random) {
  const rows = (D.crafting?.failures || []).filter(f => D.items?.[f.item] && (!f.function || f.function === fn) && (f.weight ?? 1) > 0);
  if (!rows.length) return null;
  let k = rnd() * rows.reduce((s, f) => s + (f.weight ?? 1), 0);
  const f = rows.find(x => (k -= x.weight ?? 1) < 0) || rows[0];
  const lo = f.min ?? 1, hi = f.max ?? lo;
  return { id: f.item, n: lo + Math.floor(rnd() * (hi - lo + 1)) };
}

// notes, recipe cards and cookbooks lying in the camp inventories that teach something new: [{ item, recipe }]
export function readable(D, save) {
  const st = stock(D, save);
  return Object.keys(st).map(id => ({ item: id, recipe: D.items?.[id]?.teaches })).filter(x => x.recipe && D.recipes?.[x.recipe] && !known(save, x.recipe));
}
// reads one (the note is used up if Kochen & Craften › Zettel verbrauchen); → recipe id or null
export function read(D, save, item) {
  const rid = D.items?.[item]?.teaches;
  if (!rid || !D.recipes?.[rid] || !have(D, save, item)) return null;
  learn(save, rid);
  if (D.crafting?.consumeNotes !== false) take(D, save, item, 1);
  return rid;
}

// hints for recipes not yet known, from the companions in the camp who know them (Companions › Kennt Rezepte): [{ recipe, who, hint }]
export function tips(D, save, ws) {
  const out = [], here = new Set(recipesFor(D, ws).map(r => r.id));
  for (const cid of save.companions || []) {
    const c = D.companions?.[cid];
    for (const rid of c?.tips || []) if (here.has(rid) && !known(save, rid) && !out.some(o => o.recipe === rid))
      out.push({ recipe: rid, who: c.name || cid, hint: D.recipes[rid].hint || 'Ich weiß, wie das geht. Probier mal selbst.' });
  }
  return out;
}

// eating / using a thing with a buff (Gegenstände › Buff beim Essen/Benutzen). → { ok, reason?, buff, heal }
// instant health heals now, buffs with the duration "Nächster Run" wait in save.buffs until the run ends.
export function use(D, save, id, { health, maxHealth } = {}) {
  const t = D.items?.[id], b = t && D.buffs?.[t.buff];
  if (!b) return { ok: false, reason: 'Kann man nicht benutzen' };
  if (b.duration === 'instant') {
    if (b.stat !== 'health') return { ok: false, reason: 'Wirkt nicht' };
    const max = maxHealth ?? D.leyla?.health ?? 100, now = health ?? save.health ?? max;
    if (now >= max) return { ok: false, reason: 'Leben ist schon voll' };
    const heal = b.percent ? max * b.value / 100 : b.value;
    return { ok: true, buff: t.buff, heal: Math.min(max - now, heal) };
  }
  save.buffs ??= [];
  if (save.buffs.includes(t.buff)) return { ok: false, reason: `${b.name || t.buff} wirkt schon` };
  save.buffs.push(t.buff);
  return { ok: true, buff: t.buff, heal: 0 };
}
