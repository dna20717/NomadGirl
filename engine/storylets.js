// NomadGirl – Erzählschicht G1 (#167, Daniel 21.11.2026: „Storylets erscheinen in der Welt (Zettel, Durchsagen, Funk), wandern ins Logbuch,
// und AvA kommentiert wichtige Funde kurz“). One catalog for everything that is told: notes in POIs, announcements and radio calls inside a
// POI, rumours on the Rig-Radio, a line in the place window, AvA's own words on entering, the Splitter a POI hides and the Faden of AvA's
// memories (a chain). Every storylet has conditions (quality-based narrative, Emily Short): the story of the POI, who holds it today, the
// time layers, Leyla's traces, what she found before. Browser and Node, no DOM. Leitfaden: docs/concepts/poi_next_gen.md › G1.
//
//   storyContext(D, save, nodeOrPoi)   everything the conditions read about one place → ctx
//   holds(D, ctx, cond)                one condition row { when, value, not }
//   eligible(D, ctx, channel)          [[id, storylet]] whose conditions hold, in catalog order
//   pickStorylets(D, ctx, channel, n, seed)   n of them, weighted, deterministic for the seed
//   render(D, ctx, s)                  { title, text, ava } with the placeholders filled
//   see(save, id, D)                   remember a storylet as found (save.story.seen) → true the first time
//   nextMemory(D, save)                the next link of the Faden (channel memory) → [id, storylet] or null
import { eventKind } from './story.js';
import { timeLayers, freshTraces } from './history.js';

// where a storylet appears
export const CHANNELS = [['note', 'Zettel (im POI zu finden)'], ['announce', 'Durchsage (beim Betreten)'], ['radio', 'Funk (im POI, später)'], ['ava', 'AvA sagt (beim Betreten)'],
  ['rumor', 'Radio-Gerücht (Rig-Radio)'], ['place', 'Ortsfenster (Reisekarte)'], ['splinter', 'Splitter (Fundort im POI)'], ['memory', 'Faden: AvAs Erinnerung (Kette)']];
// what a condition reads
export const CONDITIONS = [['event', 'Ereignis des POI'], ['residents', 'Bewohner heute (Gang-Lager, Nest, leer)'], ['owner', 'Besitzer (Gang-Name, home, other, none)'],
  ['layer', 'Zeitschicht: Besetzer war da (ID)'], ['trace', 'Leylas Spur frisch (chest, siren, boss, any)'], ['cleaned', 'Neue Bewohner haben aufgeräumt'],
  ['seen', 'Storylet schon gefunden (ID)'], ['visits', 'Besuche hier ≥'], ['day', 'Tag ≥'], ['cycle', 'Durchgang ≥'], ['decay', 'Verfall ≥'],
  ['region', 'Region'], ['kind', 'POI-Art'], ['landmark', 'Wahrzeichen selbst (1) / gewürfelter Ort (0)'], ['chain', 'Splitter gefunden ≥'], ['war', 'Revierkrieg hat den Ort gedreht']];

const list = v => Array.isArray(v) ? v : String(v ?? '').split(',').map(s => s.trim()).filter(Boolean);
export const hashStr = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// the save's story part (#167): older savegames get it here (repairSave) and wherever it is touched
//   save.story = { seen: { id: day }, chain: [memory ids], shards: { node: day }, traces: { node: [trace] }, layers: { node: [layer] }, visits: { node: n } }
export function storyState(save) {
  if (!save) return null;
  const S = (save.story && typeof save.story === 'object') ? save.story : (save.story = {});
  S.seen = S.seen && typeof S.seen === 'object' ? S.seen : {};
  S.chain = Array.isArray(S.chain) ? S.chain : [];
  S.shards = S.shards && typeof S.shards === 'object' ? S.shards : {};
  S.traces = S.traces && typeof S.traces === 'object' ? S.traces : {};
  S.layers = S.layers && typeof S.layers === 'object' ? S.layers : {};
  S.visits = S.visits && typeof S.visits === 'object' ? S.visits : {};
  return S;
}

// a place: a map node { id, poi, region, landmark, name }, or a POI id (test runs, the workshop)
function nodeOf(D, save, where) {
  if (where && typeof where === 'object') return where;
  const n = save?.map?.nodes?.find(x => x.id === where);
  if (n) return n;
  if (D?.pois?.[where]) return { id: where, poi: where, landmark: true, name: D.pois[where].name };
  const L = D?.locations?.[where];
  return L ? { id: where, poi: L.poi, landmark: true, name: L.name } : { id: where || null, poi: null };
}

// everything a condition reads about one place → ctx
export function storyContext(D, save, where, opts = {}) {
  const node = nodeOf(D, save, where), P = D?.pois?.[node.poi] || {}, S = P.story || {}, st = save ? storyState(save) : null;
  const home = P.gang?.name || null;
  const owner = opts.owner !== undefined ? opts.owner : (save?.turfs?.[node.id] ?? home);
  const layers = timeLayers(D, node, save, opts);
  const nest = !owner && /lebt|Nest|sammelt/i.test(S.today || '');
  return {
    node: node.id, poi: node.poi, name: node.name || P.name || '', kind: P.kind || '', region: node.region || '', landmark: node.landmark !== false,
    event: eventKind(S), decay: S.decay ?? 2, home, owner: owner || null, residents: nest ? 'nest' : owner ? 'gang' : 'empty',
    layers, occupants: layers.map(l => l.occupant).filter(Boolean),
    traces: save ? freshTraces(D, save, node.id) : [], cleaned: layers.some(l => l.by === 'cleanup'), war: layers.some(l => l.by === 'war' || l.by === 'leyla'),
    seen: st?.seen || {}, chain: st?.chain?.length || 0, visits: st?.visits?.[node.id] || 0, day: save?.day ?? 1, cycle: save?.cycle ?? 1,
  };
}

// one condition row { when, value, not } → true / false
export function holds(D, ctx, c = {}) {
  const v = String(c.value ?? '').trim(), n = Number(v) || 0, vals = list(v);
  let ok;
  switch (c.when) {
    case 'event': ok = vals.includes(ctx.event); break;
    case 'residents': ok = vals.includes(ctx.residents); break;
    case 'owner': ok = vals.some(x => x === 'home' ? ctx.owner && ctx.owner === ctx.home : x === 'other' ? ctx.owner && ctx.owner !== ctx.home : x === 'none' ? !ctx.owner : x === ctx.owner); break;
    case 'layer': ok = vals.some(x => ctx.occupants.includes(x)); break;
    case 'trace': ok = ctx.traces.some(t => !vals.length || vals.includes('any') || vals.includes(t.kind)); break;
    case 'cleaned': ok = ctx.cleaned; break;
    case 'war': ok = ctx.war; break;
    case 'seen': ok = vals.every(x => ctx.seen[x] != null); break;
    case 'visits': ok = ctx.visits >= n; break;
    case 'day': ok = ctx.day >= n; break;
    case 'cycle': ok = ctx.cycle >= n; break;
    case 'decay': ok = ctx.decay >= n; break;
    case 'chain': ok = ctx.chain >= n; break;
    case 'region': ok = vals.includes(ctx.region); break;
    case 'kind': ok = vals.includes(ctx.kind); break;
    case 'landmark': ok = (v === '0' || v === 'false') ? !ctx.landmark : ctx.landmark; break;
    default: ok = true;
  }
  return c.not ? !ok : ok;
}

// does storylet s fit the place: channel, POIs (only at the landmark itself unless „auch gewürfelte Orte“), POI kinds (archetypes),
// the link before it in a chain, once only, every condition
export function fits(D, ctx, s) {
  if (!s || s.off) return false;
  const pois = list(s.pois), kinds = list(s.kinds);
  if (pois.length && !(pois.includes(ctx.poi) && (ctx.landmark || s.archetype))) return false;
  if (kinds.length && !kinds.includes(ctx.kind)) return false;
  if (s.after && ctx.seen[s.after] == null) return false;
  if (!s.repeat && ctx.seen[s.id] != null) return false;
  return (s.when || []).every(c => !c.when || holds(D, ctx, c));
}
export function eligible(D, ctx, channel) {
  return Object.entries(D?.storylets || {}).filter(([id, s]) => (!channel || s.channel === channel) && fits(D, ctx, { ...s, id }));
}
// n storylets of one channel, weighted (Gewicht; a storylet naming this POI counts double over a mere archetype), the same for the same seed
export function pickStorylets(D, ctx, channel, n = 1, seed = 0) {
  const pool = eligible(D, ctx, channel).filter(([, s]) => (s.weight ?? 10) > 0), out = [], r = rng((seed ^ hashStr(channel + ctx.node)) >>> 0);
  const w = ([, s]) => Math.max(0, s.weight ?? 10) * (list(s.pois).includes(ctx.poi) ? 2 : 1);
  while (out.length < n && pool.length) {
    const sum = pool.reduce((a, c) => a + w(c), 0); if (sum <= 0) break;
    let k = r() * sum, i = 0;
    for (; i < pool.length - 1; i++) { k -= w(pool[i]); if (k < 0) break; }
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

// placeholders: {place} {gang} {home} {layer} (the last occupant before today) {first} {day} {region}
export function fill(D, ctx, text = '') {
  const before = ctx.layers.filter(l => l.by === 'roll' && l.occupant), last = before[before.length - 1], first = before[0];
  const v = { place: ctx.name, gang: ctx.owner || 'niemand', home: ctx.home || 'niemand', layer: last?.name || 'Plünderer', first: first?.name || 'Plünderer', day: String(ctx.day), region: ctx.region || 'draußen' };
  return String(text || '').replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
}
export function render(D, ctx, s) {
  return { title: fill(D, ctx, s.title || (s.channel === 'note' ? 'Ein Zettel' : s.channel === 'announce' ? 'Durchsage' : s.channel === 'radio' ? 'Funk' : s.name || '')), text: fill(D, ctx, s.text), ava: s.ava ? fill(D, ctx, s.ava) : '', important: !!s.important };
}
// remember a found storylet; the memory chain and the Splitter of a place too → true the first time
export function see(save, id, D) {
  const S = storyState(save); if (!S || !id) return false;
  const first = S.seen[id] == null;
  if (first) S.seen[id] = save.day ?? 1;
  if (D?.storylets?.[id]?.channel === 'memory' && !S.chain.includes(id)) S.chain.push(id);
  return first;
}
// the Faden: memories (channel memory) form a chain over „Nach“; the next one is the first whose link before is found and that is not
export function nextMemory(D, save) {
  const S = storyState(save) || { chain: [] }, M = Object.entries(D?.storylets || {}).filter(([, s]) => s.channel === 'memory' && !s.off);
  const have = new Set(S.chain);
  return M.find(([id, s]) => !have.has(id) && (!s.after || have.has(s.after))) || null;
}
// the whole chain in order (for the workshop and the tests): follows „Nach“ from the start
export function chainOrder(D) {
  const M = Object.entries(D?.storylets || {}).filter(([, s]) => s.channel === 'memory'), out = [];
  let cur = M.find(([, s]) => !s.after);
  const seen = new Set();
  while (cur && !seen.has(cur[0])) { out.push(cur[0]); seen.add(cur[0]); const id = cur[0]; cur = M.find(([, s]) => s.after === id); }
  return out;
}
// a visit to a place counts (the conditions „Besuche hier ≥“)
export function visit(save, node) { const S = storyState(save); if (S && node) S.visits[node] = (S.visits[node] || 0) + 1; return S?.visits[node] || 0; }
