// Beute-Bilanz (#017, from Ava's flow analysis, Daniel 14.11.2026: „Rang, was neu ist (Rezepte, Techtree, Quest-Fortschritt), Knopf zur
// passenden Werkstatt“): a snapshot when Leyla drives off to plunder, the difference when she is back. No DOM: browser and Node.
//   snapshot(D, save) → { stock, recipes, quests, nodesReady, tank }
//   compare(D, save, before, run) → { title, grade, parts, paid, base, bonus, kills, killsMax, secrets, secretsMax, seconds, ko,
//                                      gained: [{ id, name, n, resource }], lost, recipes: [names], quests: [{ id, name, from, to, ready }],
//                                      ready: [node names], tank: { from, to }, next: { kind, label, sub, ws? } }
import { stock } from './crafting.js';
import { qstate, progressOf } from './quests.js';
import { status, owned } from './techtree.js';

export function snapshot(D, save) {
  const Q = qstate(save);
  return {
    stock: { ...stock(D, save) },
    recipes: [...(save.recipes || [])],
    quests: Object.fromEntries(Object.keys(Q.active).map(id => [id, progressOf(D, save, id).n])),
    nodesReady: Object.keys(D.techtree || {}).filter(id => !owned(save, id) && status(D, save, id).state === 'ready'),
    tank: save.tank ? Math.round(save.tank.cond) : null,
  };
}

export function compare(D, save, before = {}, run = {}) {
  const now = stock(D, save), was = before.stock || {}, resItems = new Set(Object.values(D.resources || {}).map(r => r.item).filter(Boolean));
  const diff = Object.keys({ ...now, ...was }).map(id => ({ id, n: (now[id] || 0) - (was[id] || 0) }));
  const named = x => ({ ...x, name: D.items?.[x.id]?.name || x.id, resource: resItems.has(x.id) });
  const gained = diff.filter(x => x.n > 0).map(named).sort((a, b) => b.resource - a.resource || b.n - a.n);
  const lost = diff.filter(x => x.n < 0).map(x => named({ ...x, n: -x.n }));
  const recipes = (save.recipes || []).filter(r => !(before.recipes || []).includes(r)).map(r => D.recipes?.[r]?.name || D.items?.[D.recipes?.[r]?.result]?.name || r);
  const Q = qstate(save);
  const quests = Object.keys(Q.active).filter(id => D.quests?.[id]).map(id => { const p = progressOf(D, save, id); return { id, name: D.quests[id].name || id, from: before.quests?.[id] ?? 0, to: p.n, target: p.target, ready: p.ready }; }).filter(q => q.to !== q.from || q.ready);
  const readyNow = Object.keys(D.techtree || {}).filter(id => !owned(save, id) && status(D, save, id).state === 'ready');
  const ready = readyNow.filter(id => !(before.nodesReady || []).includes(id)).map(id => D.techtree[id].name || id);
  const tank = save.tank && before.tank != null ? { from: before.tank, to: Math.round(save.tank.cond) } : null;
  // what to do next, most useful first: a job to hand in, a node to unlock, a weak tank, new recipes at their workshop
  const qr = quests.find(q => q.ready);
  const rws = (save.recipes || []).filter(r => !(before.recipes || []).includes(r)).map(r => D.recipes?.[r]?.station).find(Boolean);   // the station; the camp opens a workshop of the same function
  const next = qr ? { kind: 'quests', label: 'Questlog', sub: `„${qr.name}“ abgeben` }
    : ready.length ? { kind: 'tech', label: 'Techtree', sub: `${ready[0]} freischalten` }
    : tank && tank.to < 45 ? { kind: 'tank', label: 'Cryo-Tank', sub: `AvAs Tank: ${tank.to} %` }
    : rws ? { kind: 'workshop', ws: rws, label: D.workshops?.[rws]?.name || rws, sub: `${recipes.length} neue${recipes.length === 1 ? 's Rezept' : ' Rezepte'} ausprobieren` }
    : gained.some(x => x.resource) ? { kind: 'quests', label: 'Questlog', sub: 'Wie weit ist die Suche?' } : null;
  return { ...run, gained, lost, recipes, quests, ready, tank, next };
}
