// Ressourcen verdienen (#039, design.md › Ressourcen verdienen: „Ressourcen-Rohstoffe gibt es für erledigte Aktionen: Kisten, Kills,
// Secrets, Kochen, Bauen; ein guter Rang gibt Wissen extra“). The rules are rows in Ranking › Ressourcen verdienen; every row that
// matches the event rolls on its own (chance %, then min…max of the item). The things come out like loot: next to the chest, the
// fallen enemy, the broken wall, in the vault, or straight into the stores after crafting. No DOM: browser and Node.
// Herstellen (Daniel 16.11.2026: „Herstellen sollte immer eine der drei Ressourcen produzieren … nicht inflationär, weil Fortschritt
// immer teurer wird, aber das Nebenergebnis aus Crafting nicht zwangsläufig mehr“): every craft gives its by-product, the rows with
// the workshop's function win, rows without a function are the fallback.
//
//   D.ranking.earn = [{ when, item, chance, min, max, grade, function }]
//   when: chest · kill (every enemy) · kill_<family> (mutant, raider, wildlife, machine, anomaly) · boss · secret
//         · rank (POI finished with at least `grade`) · craft (every recipe made; `function` = only at that kind of workshop)

export const EARN_WHEN = [['chest', 'Kiste geöffnet'], ['kill', 'Gegner besiegt (alle)'], ['kill_mutant', 'Mutant besiegt'], ['kill_raider', 'Plünderer besiegt'],
  ['kill_wildlife', 'Tier besiegt'], ['kill_machine', 'Maschine besiegt'], ['boss', 'Boss besiegt'], ['secret', 'Secret gefunden'],
  ['rank', 'POI geschafft (ab Rang)'], ['craft', 'Etwas hergestellt (Nebenergebnis)']];
const GRADES = ['F', 'D', 'C', 'B', 'A', 'S'];

// which rows fire for an event → rows (ctx: { family, boss, grade })
export function earnRows(D, when, ctx = {}) {
  return (D.ranking?.earn || []).filter(r => {
    if (!D.items?.[r.item]) return false;
    if (when === 'kill') return r.when === 'kill' || (ctx.family && r.when === `kill_${ctx.family}`) || (ctx.boss && r.when === 'boss');
    if (when === 'rank') return r.when === 'rank' && GRADES.indexOf(ctx.grade) >= GRADES.indexOf(r.grade || 'F');
    return r.when === when;
  }).filter((r, _, all) => when !== 'craft' || (all.some(x => x.function && x.function === ctx.function) ? r.function === ctx.function : !r.function));
}
// roll an event → [{ a: 'items', id, n }] (merged by item)
export function earn(D, when, ctx = {}, rnd = Math.random) {
  const out = [];
  for (const r of earnRows(D, when, ctx)) {
    if (rnd() * 100 >= (r.chance ?? 100)) continue;
    const lo = r.min ?? 1, hi = Math.max(lo, r.max ?? lo), n = lo + Math.floor(rnd() * (hi - lo + 1));
    if (n <= 0) continue;
    const same = out.find(o => o.id === r.item);
    if (same) same.n += n; else out.push({ a: 'items', id: r.item, n });
  }
  return out;
}
// „+2 Technik · +1 Wissen“
export const earnText = (D, things) => things.map(t => `+${t.n} ${D.items?.[t.id]?.name || t.id}`).join(' · ');
