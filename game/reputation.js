// Ruf bei den Gangs (#055, Daniel 18.11.2026: „Verzahne den Ruf bei den einzelnen Fraktionen mit den Ereignissen und nutze die
// existierenden Gangs dafür. Es wäre ärgerlich, wenn Leyla von Gang A angegriffen würde, obwohl ihr Ruf bei denen auf max ist“;
// design.md › Die Karawane › Ruf: „ein Wert je Fraktion, Feind … Freund“). The gangs are those of the POIs (POI › Gang); one value each,
// −100 … 100, in the savegame (save.rep, starts anew with every Durchgang like the design says). Levels and their effect on the road
// come from Ereignis-Baukasten › Ruf. No DOM.
export const REP_LEVELS = [['feind', 'Feind'], ['unbeliebt', 'Unbeliebt'], ['neutral', 'Neutral'], ['geduldet', 'Geduldet'], ['freund', 'Freund']];

export function repConfig(D) {
  const R = D?.roadEvents?.rep || {};
  return { enemy: R.enemy ?? -60, disliked: R.disliked ?? -20, tolerated: R.tolerated ?? 20, friend: R.friend ?? 60, price: (R.price ?? 30) / 100, kill: R.kill ?? 1,
    peace: R.peace || 'geduldet', breakPeace: R.breakPeace ?? 15, theft: R.theft ?? 8, job: R.job ?? 10,   // #061 Revier-Camp
    rivalShare: (R.rivalShare ?? 50) / 100, takeover: R.takeover !== false };   // #089 Revierkrieg
}
// every gang of the world: name, colour (kit gang colour), motto, its POIs
export function gangs(D) {
  const out = new Map();
  for (const [id, p] of Object.entries(D?.pois || {})) {
    const g = p.gang; if (!g?.name) continue;
    const e = out.get(g.name) || { name: g.name, color: g.color || '', motto: g.motto || '', pois: [] };
    e.pois.push(id); out.set(g.name, e);
  }
  return [...out.values()];
}
export const repOf = (save, gang) => Math.max(-100, Math.min(100, save?.rep?.[gang] ?? 0));
export function levelOf(D, n) {
  const C = repConfig(D);
  return n <= C.enemy ? 'feind' : n <= C.disliked ? 'unbeliebt' : n < C.tolerated ? 'neutral' : n < C.friend ? 'geduldet' : 'freund';
}
export const levelName = id => REP_LEVELS.find(([k]) => k === id)?.[1] || id;
// #089 Revierkrieg: the rivals of a gang (POI › Gang › Rivalen, both ways)
export function rivalsOf(D, gang) {
  const out = new Set();
  for (const p of Object.values(D?.pois || {})) {
    const g = p.gang; if (!g?.name) continue;
    const R = String(g.rivals || '').split(',').map(x => x.trim()).filter(Boolean);
    if (g.name === gang) R.forEach(r => out.add(r));
    else if (R.includes(gang)) out.add(g.name);
  }
  out.delete(gang);
  return [...out];
}
// change the value → { gang, from, to, n, level, changed (level), rivals: [same for each rival] } or null
// #089: what Leyla wins with a gang, its rivals hold against her (Ruf › Rivalen, Standard 50 %), and the other way round; one step only
export function addRep(D, save, gang, n, spill = true) {
  if (!gang || !n || !save) return null;
  const from = repOf(save, gang), to = Math.max(-100, Math.min(100, Math.round(from + n)));
  (save.rep ??= {})[gang] = to;
  const a = levelOf(D, from), b = levelOf(D, to), share = repConfig(D).rivalShare;
  const rivals = spill && share > 0 && to !== from ? rivalsOf(D, gang).map(r => addRep(D, save, r, -Math.round((to - from) * share) || 0, false)).filter(x => x?.n) : [];
  return { gang, from, to, n: to - from, level: b, changed: a !== b, rivals };
}
// short lines for every rival that moved: „Ruf Neon Rats −7“
export const rivalLines = r => (r?.rivals || []).map(x => `Ruf ${x.gang} ${x.n > 0 ? '+' : '−'}${Math.abs(x.n)}`);
// the gang whose turf a place of the travel map is (its POI's gang), else null
export function gangOfPlace(D, save, nodeId) {
  if (save?.turfs?.[nodeId]) return save.turfs[nodeId];   // #089 a rival moved in
  const n = save?.map?.nodes?.find(x => x.id === nodeId), poi = n?.poi || D?.locations?.[nodeId]?.poi;
  return D?.pois?.[poi]?.gang?.name || null;
}
// the gang as on its home POI (name, colour, motto, rivals), for a place a rival took over
export const gangInfo = (D, name) => name ? (Object.values(D?.pois || {}).find(p => p.gang?.name === name)?.gang || { name }) : null;
// prices with a gang: friends pay less, enemies more (Ruf › Preise: at ±100 by this much)
export const repPrice = (D, save, gang) => gang ? 1 - repConfig(D).price * repOf(save, gang) / 100 : 1;
// short text for windows: „Yellow Vultures · Geduldet (+35)“
export const repLine = (D, save, gang) => { const n = repOf(save, gang); return `${gang} · ${levelName(levelOf(D, n))} (${n > 0 ? '+' : ''}${n})`; };
