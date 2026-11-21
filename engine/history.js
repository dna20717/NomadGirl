// NomadGirl – Zeitschichten und Leylas Spuren (#167 G1). Browser and Node, no DOM.
//
// Zeitschichten (Daniel 21.11.2026: „1–3 Zwischenbesitzer, hinterher begründet per Ersetzungs-Grammatik wie Caves of Qud“): between the
// POI's event (POIs › Story) and today, 1–3 occupants lived in a place, rolled per Durchgang and place. They are rolled first and explained
// afterwards: each layer's ending is told by who came next (Grammatik › ending.<Art des Nächsten>), so the chain always makes sense. The
// last layer is whoever holds the place today. The Revierkrieg (#102) and Leyla's own takeovers write new layers into the savegame, and so
// do the new residents who clear away Leyla's traces.
//
// Leylas Spuren (Daniel: „verblassen langsam; einige Tage im Durchgang, dann räumen neue Bewohner auf und bauen um“): an opened chest, a
// broken siren, a fallen boss are kept per place with the day; they fade over Zeitschichten › Spuren › Aufräumen nach (days), then they are
// gone and a cleanup layer is written.
//
//   timeLayers(D, node, save, opts)    → [{ occupant, name, kind, by: roll | home | war | leyla | cleanup, day, text }]
//   expand(D, symbol, vars, r)         one symbol of the grammar, recursive (#symbol# inside, {var} placeholders)
//   writeLayer(save, node, layer)      the Revierkrieg / Leyla / the cleanup add a layer (save.story.layers)
//   addTrace(save, node, trace)        { kind: chest | siren | boss, room, rx, ry } with today's day
//   traceFade(D, trace, day)           1 → fadeTo while it ages, 0 when the new residents have cleared it
//   freshTraces(D, save, node)         the traces still there, with .fade
//   tidyTraces(D, save)                clears the old traces everywhere, writes a cleanup layer → [{ node, n }]

const list = v => Array.isArray(v) ? v : String(v ?? '').split(',').map(s => s.trim()).filter(Boolean);
const alts = v => String(v ?? '').split('|').map(s => s.trim()).filter(Boolean);
const hashStr = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a.length ? a[Math.floor(r() * a.length)] : '';

// kinds of occupants (the grammar has an ending for each: ending.gang, ending.nest …)
export const OCCUPANT_KINDS = [['gang', 'Gang'], ['sect', 'Sekte'], ['refugees', 'Flüchtlinge'], ['traders', 'Händler'], ['scavengers', 'Plünderer'],
  ['hermit', 'Einsiedler'], ['military', 'Versprengte Soldaten'], ['nest', 'Viecher (Nest)'], ['empty', 'niemand']];
export const TRACE_KINDS = [['chest', 'geöffnete Kiste'], ['siren', 'zerstörte Sirene'], ['boss', 'gefallener Boss']];
export const LAYER_BY = [['roll', 'gewürfelt'], ['home', 'heute (Heimat-Gang)'], ['war', 'Revierkrieg'], ['leyla', 'Leyla hat freigekämpft'], ['cleanup', 'aufgeräumt'], ['moved', 'Lager umgezogen (#169)'], ['gone', 'Lager aufgelöst (#169)'], ['nest', 'Nest gewachsen (#169)'], ['settle', 'neue Bewohner (#169)']];

export const traceConfig = D => ({ cleanupDays: Math.max(1, D?.history?.traces?.cleanupDays ?? 4), fadeTo: Math.max(0, Math.min(100, D?.history?.traces?.fadeTo ?? 35)) / 100 });

// one symbol of the grammar (Zeitschichten › Grammatik: symbol → alternatives with „|“); #other# expands another symbol, {var} a value
export function expand(D, symbol, vars = {}, r = Math.random, depth = 0) {
  const G = D?.history?.grammar || [], row = G.find(g => g.symbol === symbol) || (symbol.includes('.') ? G.find(g => g.symbol === symbol.split('.')[0]) : null);
  if (!row || depth > 6) return '';
  const t = pick(r, alts(row.text));
  return t.replace(/#([\w.]+)#/g, (m, s) => expand(D, s, vars, r, depth + 1)).replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m).replace(/\s+/g, ' ').trim();
}
const cap = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;

// the occupants that may have lived in this POI kind (Zeitschichten › Besetzer › Passt zu POI-Arten, leer = überall; Nicht in: POI ids)
export function occupantsFor(D, poiId) {
  const P = D?.pois?.[poiId] || {};
  return (D?.history?.occupants || []).filter(o => o.id && o.name && (!list(o.kinds).length || list(o.kinds).includes(P.kind)) && !list(o.never).includes(poiId));
}

// the seed of a place in this Durchgang: the map's seed, the place, the cycle
export const placeSeed = (save, nodeId, opts = {}) => (opts.seed ?? ((save?.map?.seed ?? 0) ^ hashStr(`${nodeId}:${save?.cycle ?? 1}`))) >>> 0;

export function timeLayers(D, node = {}, save = null, opts = {}) {
  const H = D?.history; if (!H || !node?.poi) return [];
  const P = D.pois?.[node.poi] || {}, S = P.story || {}, r = rng(placeSeed(save, node.id, opts));
  const [lo, hi] = [H.layers?.min ?? 1, H.layers?.max ?? 3].map(n => Math.max(0, Math.min(3, n)));
  let n = lo + Math.floor(r() * (Math.max(lo, hi) - lo + 1));
  // sealed places keep their quiet: at most one layer (Steckbriefe: Silo, Pit 6, Metro were sealed)
  if (S.eventKind === 'sealed' || S.eventKind === 'orderly') n = Math.min(n, 1);
  const home = P.gang?.name || null, nest = !home && /lebt|Nest|sammelt/i.test(S.today || '');
  const pool = occupantsFor(D, node.poi).filter(o => o.name !== home && !(nest && o.kind === 'nest')), chosen = [];
  while (chosen.length < n && pool.length) chosen.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  const today = { occupant: null, name: home || (nest ? 'etwas, das sammelt' : 'niemand'), kind: home ? 'gang' : nest ? 'nest' : 'empty', by: 'home', day: null };
  const out = [];
  chosen.forEach((o, i) => {
    const next = chosen[i + 1] ? { name: chosen[i + 1].name, kind: chosen[i + 1].kind || 'scavengers' } : today;
    const vars = { name: o.name, next: next.name, place: node.name || P.name || '', arrive: pick(r, alts(o.arrive)), leave: pick(r, alts(o.leave)) };
    const when = expand(D, i ? 'when.next' : 'when.first', vars, r);
    const ending = expand(D, `ending.${next.kind}`, vars, r) || vars.leave;
    out.push({ occupant: o.id, name: o.name, kind: o.kind || 'scavengers', by: 'roll', day: null, text: cap(expand(D, 'layer', { ...vars, when, ending }, r) || `${when} ${o.name} ${vars.arrive}. ${ending}.`) });
  });
  today.text = cap(expand(D, `today.${today.kind}`, { name: today.name, place: node.name || P.name || '' }, r) || `Heute: ${today.name}.`);
  out.push(today);
  // what the savegame wrote: the Revierkrieg, Leyla's takeovers, the cleanup after her traces
  for (const L of (save?.story?.layers?.[node.id] || [])) {
    const vars = { name: L.gang || 'niemand', from: L.from || 'die Vorigen', day: String(L.day ?? '') };
    out.push({ occupant: null, name: L.gang || null, kind: L.gang ? 'gang' : 'empty', by: L.by, day: L.day ?? null, text: cap(expand(D, `by.${L.by}`, vars, r) || `Tag ${vars.day}: ${vars.name}.`) });
  }
  return out;
}
// a new layer from the savegame's side (turf_war.js, the cleanup) → the stored row
export function writeLayer(save, node, layer = {}) {
  if (!save || !node) return null;
  const S = (save.story ??= {}), L = ((S.layers ??= {})[node] ??= []);
  const row = { day: layer.day ?? save.day ?? 1, by: layer.by || 'war', gang: layer.gang ?? null, from: layer.from ?? null };
  L.push(row);
  if (L.length > 8) L.splice(0, L.length - 8);
  return row;
}

// ---------- Leylas Spuren ----------
export function addTrace(save, node, t = {}) {
  if (!save || !node || !t.kind) return null;
  const S = (save.story ??= {}), L = ((S.traces ??= {})[node] ??= []);
  const row = { kind: t.kind, room: t.room ?? null, rx: t.rx ?? null, ry: t.ry ?? null, day: t.day ?? save.day ?? 1, at: t.at ?? hoursOf(save), ...(t.name ? { name: t.name } : {}) };
  if (L.some(x => x.kind === row.kind && x.room === row.room && x.rx === row.rx && x.ry === row.ry)) return null;   // the same chest twice
  L.push(row);
  if (L.length > 40) L.splice(0, L.length - 40);
  return row;
}
// the Ereignis-Zeit in hours (save.day, save.hour): traces age by the hour, a trace without `at` by whole days
export const hoursOf = save => (save?.day ?? 1) * 24 + (save?.hour ?? 0);
export function traceFade(D, t, now) {
  const C = traceConfig(D), h = typeof now === 'object' ? hoursOf(now) : (now ?? 1) * 24, at = t?.at ?? (t?.day ?? h / 24) * 24, age = Math.max(0, h - at) / 24;
  if (age >= C.cleanupDays) return 0;
  return 1 - (1 - C.fadeTo) * age / C.cleanupDays;
}
export function freshTraces(D, save, node) {
  return (save?.story?.traces?.[node] || []).map(t => ({ ...t, fade: traceFade(D, t, save) })).filter(t => t.fade > 0);
}
// the new residents clear what Leyla left: traces past Aufräumen nach go, a cleanup layer tells it (whoever holds the place then)
export function tidyTraces(D, save) {
  const out = [], T = save?.story?.traces || {};
  for (const [node, L] of Object.entries(T)) {
    const gone = L.filter(t => traceFade(D, t, save) <= 0);
    if (!gone.length) continue;
    T[node] = L.filter(t => !gone.includes(t));
    if (!T[node].length) delete T[node];
    const n = save.map?.nodes?.find(x => x.id === node), home = D?.pois?.[n?.poi || D?.locations?.[node]?.poi || node]?.gang?.name || null;
    const day = Math.floor(Math.max(...gone.map(t => t.at ?? t.day * 24)) / 24) + traceConfig(D).cleanupDays;
    writeLayer(save, node, { by: 'cleanup', day: Math.min(day, save.day ?? day), gang: save.turfs?.[node] ?? home });
    out.push({ node, n: gone.length });
  }
  return out;
}
