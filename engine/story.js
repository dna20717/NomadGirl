// NomadGirl – „Story zuerst“ (#160, Daniel 21.11.2026: „Ich möchte, dass vor dem ersten Design die Story des POI oder des Raumes feststeht
// und von dort aus gestaltet wird.“). Reads the story fields of POIs (POIs › Story) and rooms (Raum-Bausteine › Story) and hands them to
// the set dressing (#158/#159) and the level design (#163). Browser and Node, no DOM. Leitfaden: docs/concepts/poi_bible.md.
//
//   poiStory(D, poiId)             the POI's canonical story (fields of POIs › Story)
//   placeStory(D, node, save)      the story of a place on the travel map: landmarks keep their own, rolled places inherit the archetype of
//                                  their POI kind, the region tints it, the owner from the turf war (#102) sets „Heute“, the danger the decay
//   roomStory(poi, room, opts)     what the dressing needs from the story: role, decay, must, never, residents …
//   storyTags(D)                   every tag and clutter name the dressing knows (for must / never)

// what happened (POIs › Story › Art des Ereignisses): decides which traces the rooms show (#159, Bibel › Was aus der Story folgt)
export const EVENT_KINDS = [['', '– aus dem Text –'], ['flight', 'Flucht: stehen gelassen'], ['fight', 'Kampf: Deckung, Hülsen'], ['fire', 'Feuer: Ruß, ausgebrannt'],
  ['flood', 'Flut: Pfützen, Algen'], ['sealed', 'versiegelt: zu, unberührt'], ['orderly', 'ordentlich geschlossen'], ['abandoned', 'stehen gelassen, verfällt']];
// who lives there now (Bewohner-Schicht): a gang's camp, a nest of critters, nobody
export const RESIDENTS = [['gang', 'Gang-Lager'], ['nest', 'Nest'], ['empty', 'leer']];

const list = v => Array.isArray(v) ? v.map(String) : String(v || '').split(',').map(s => s.trim()).filter(Boolean);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };

export const poiStory = (D, poiId) => D?.pois?.[poiId]?.story || {};

// the event kind from the text when the field is empty
export function eventKind(story) {
  if (story?.eventKind) return story.eventKind;
  const t = String(story?.event || '');
  if (/brann|Feuer|Flammen/i.test(t)) return 'fire';
  if (/Schlägerei|stürmte|Kampf|Schieß|Unruhen/i.test(t)) return 'fight';
  if (/Flut|überflut|Hochwasser/i.test(t)) return 'flood';
  if (/versiegel|zugeschweißt|angehalten/i.test(t)) return 'sealed';
  if (/ordnungsgemäß|ordentlich/i.test(t)) return 'orderly';
  if (/flohen|Flucht|holten|zurück/i.test(t)) return 'flight';
  return t ? 'abandoned' : '';
}

// Raum-Rolle from „Funktion früher“ when the room has no role of its own (Bibel: Funktion früher → Raum-Rolle)
const ROLE_WORDS = [['storage', /^\S*(Lager|Vorrat|Asservat|Waffenkammer|Depot|Reifen)/i], ['shop', /Laden|Verkauf|Kasse|Kiosk|Kaufhaus|Spielhalle|Food|Imbiss|Markt/i], ['storage', /Lager|Vorrat|Asservat|Waffenkammer|Depot/i],
  ['office', /Büro|Amt|Archiv|Registratur|Verwaltung|Akten|Kommando/i], ['tech', /Technik|Leitstand|Stellwerk|Reaktor|Server|Generator|Funk|Lüftung|Labor|Kontroll|Kabine/i],
  ['living', /Wohn|Schlaf|Kantine|Quartier|Kaserne|Messe|Kaue|Kino|Penthouse|Kranken/i], ['hall', /Halle|Saal|Werkstatt|Kessel|Sammler|Schacht/i],
  ['corridor', /Gang|Flur|Treppe|Schleuse|Rampe|Rolltreppe|Galerie|Steg|Stollen|Kanal/i], ['cave', /Höhle|Grotte|Kaverne|Sohle/i]];
export function roleFromFunction(text, indoor = true) {
  for (const [role, re] of ROLE_WORDS) if (re.test(String(text || ''))) return role;
  return indoor ? 'general' : 'outdoor';
}

// What the dressing reads from the story of a POI and one of its rooms (#160 step 5). poi and room are the data objects (a rolled place
// passes the POI with its placeStory merged into poi.story). opts: { owner: gang name holding the place now (#102), home: the POI's own gang }
// → { role, decay, must, never, function, moment, today, keyImage, event, era, residents: { kind, gang, motto } }
//   role: Raum-Bausteine › Rolle, else from „Funktion früher“ · decay: room › story › decay, else POI (0–3) · must / never: lists of tags or clutter names
export function roomStory(poi = {}, room = {}, opts = {}) {
  const P = poi?.story || {}, R = room?.story || {};
  const indoor = room?.indoor ?? !(room?.backdrop?.image || room?.backdrop?.weather);
  const role = room?.role || roleFromFunction(R.function, indoor);
  const decay = clamp(Math.round(R.decay ?? P.decay ?? 2), 0, 3);
  const gang = opts.owner !== undefined ? opts.owner : (poi?.gang?.name || null);
  const motto = gang && gang === poi?.gang?.name ? poi.gang.motto || '' : opts.motto || '';
  const today = R.today || P.today || '';
  const nest = /Nest|Viecher|Kriecher|sammel/i.test(R.today || '') || (!gang && /lebt|Nest|sammelt/i.test(P.today || ''));
  return {
    role, decay, must: list(R.must), never: list(R.never),
    function: R.function || '', moment: R.moment || '', today, keyImage: R.keyImage || '',
    event: eventKind(P), era: P.era || '',
    residents: { kind: nest ? 'nest' : gang ? 'gang' : 'empty', gang, motto },
  };
}

// every tag and clutter name known to the dressing: Kachel-Sets › Clutter-Regeln (name + tags) and POIs › Marken-Clutter
export function storyTags(D) {
  const out = new Set();
  for (const t of Object.values(D?.terrain || {})) for (const r of t.dressing || []) { if (r.name) out.add(r.name); for (const g of list(r.tags)) out.add(g); }
  for (const P of Object.values(D?.pois || {})) for (const r of P.brandProps || []) { if (r.name) out.add(r.name); for (const g of list(r.tags)) out.add(g); }
  return out;
}

// The story of a place on the travel map (#160 step 3). Landmarks (from Oberwelt-Orte) keep the story of their POI; rolled places inherit
// the archetype of their POI kind (the landmark's story), the region tints it (Reisekarte › Regionen färben die Story), the owner from the
// turf war sets „Heute“, the danger above the archetype's makes it older and more broken.
// node: { id, poi, region, danger, landmark } · save (optional): for the owner (save.turfs) · owner (optional): who holds it, if known
// → { ...story, decay, region, tint, owner, archetype (POI id), line (one sentence for the place window) }
export function placeStory(D, node = {}, save = null, owner) {
  const P = D?.pois?.[node.poi] || {}, S = P.story || {};
  const W = (D?.worldmap?.regionStory || []).find(r => r.region === node.region) || null;
  const home = P.gang?.name || null, who = owner !== undefined ? owner : (save?.turfs?.[node.id] ?? home);
  const older = node.landmark ? 0 : Math.max(0, (node.danger || P.danger || 1) - (P.danger || 1));
  const decay = clamp((S.decay ?? 2) + older + (node.landmark ? 0 : W?.decay || 0), 0, 3);
  const gangInfo = Object.values(D?.pois || {}).find(o => o.gang?.name === who)?.gang;
  const today = who === home ? S.today || '' : who ? `${who} haben übernommen${gangInfo?.motto ? `: „${gangInfo.motto}“` : ''}` : 'Niemand hält den Ort. Noch nicht';
  return { ...S, decay, region: node.region || '', tint: W?.tint || '', owner: who || null, archetype: node.poi || null, today, line: placeLine(P, node) };
}
// one sentence for the place window of a rolled place: the archetype's line (POIs › Story › Satz für gewürfelte Orte), else its joke or its past
// (by place id), never one that names the landmark's own gang or name
export function placeLine(P = {}, node = {}) {
  const S = P.story || {};
  if (S.line) return S.line;
  const own = [P.gang?.name, P.name].filter(Boolean);
  const ok = t => t && !own.some(n => t.includes(n));
  const pick = hash(node.id || '') % 2 ? [S.before, S.joke] : [S.joke, S.before];
  const t = pick.find(ok) || '';
  return t && !/[.!?“]$/.test(t) ? t + '.' : t;
}
