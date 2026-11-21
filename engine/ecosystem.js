// NomadGirl – Leben G3 (#169): Beziehungen, Lager, Simulation zwischen Besuchen, Regie. Browser and Node, no DOM.
//
// Daniel 21.11.2026 (poi_next_gen.md › Entschieden): „Simulation auch zwischen Besuchen. Gruppen wandern, Nester wachsen, Lager ziehen
// um, während Leyla weg ist (wie Rain World)“ und „Gangs zwischen Besuchen: Eroberungen laufen über den Revierkrieg (#102); das
// Ökosystem füllt die Details (Verluste, Umzüge, Nester)“.
//
//   Fraktionen   home (wer den Ort hält, aus dem Revierkrieg), rival (deren Rivalen), gang (andere Gangs), raiders (Plünderer ohne
//                Gang), mutants, machines, critters (Kleinvieh); Beziehungstabelle Welt › Leben › Beziehungen: fight | avoid | flee | ignore
//   Lager        a POI holds camps (Lager-Typen: Gang-Lager, Spähtrupp, Nest, Plünderer-Lager); planLife places them in the welded level
//                (never in an Atempause, the Wow room, the entrance, at a seam) and turns the level's spawns into their members
//   Simulation   lifeState per place in the savegame (save.life[node]); stepDay moves it one day: strength recovers, nests grow and
//                split, camps that Leyla raided move or dissolve, rival patrols come and go, a place is never empty for good; the owner
//                comes from the Revierkrieg (ctx.owner), the ecosystem fills the details. Same seed + same days = same state.
//   Regie        directorStep: tension builds → peak → relax per run (Left 4 Dead), reinforcements only in build/peak, never in an
//                Atempause or the first seconds of the Wow room; the music layer follows (calm / tension / combat)

import { roomType, roomGates, levelConfig } from './level_design.js';

export const FACTIONS = [['home', 'Besitzer des Orts'], ['rival', 'Rivalen des Besitzers'], ['gang', 'andere Gang'], ['raiders', 'Plünderer ohne Gang'],
  ['mutants', 'Mutanten'], ['machines', 'Maschinen'], ['critters', 'Kleinvieh'], ['any', 'alle']];
export const ATTITUDES = [['fight', 'kämpfen'], ['avoid', 'meiden'], ['flee', 'fliehen'], ['ignore', 'ignorieren']];
export const CAMP_FACTIONS = [['owner', 'Besitzer (Gang des Orts)'], ['rival', 'Rivalen'], ['mutants', 'Mutanten'], ['raiders', 'Plünderer']];
export const LIFE_EVENTS = [['moved', 'Lager umgezogen'], ['gone', 'Lager aufgelöst'], ['nest', 'Nest geteilt'], ['owner', 'neuer Besitzer'], ['visit', 'Spähtrupp kam'],
  ['left', 'Spähtrupp zog ab'], ['settle', 'neue Bewohner'], ['raided', 'Verluste durch Leyla']];
export const MUSIC_LAYERS = [['calm', 'Ruhe'], ['tension', 'Anspannung'], ['combat', 'Kampf']];

// ⚠️ vorläufig (Code, 21.11.2026): moderate, so Leyla can play them off against each other
export const LIFE = {
  relations: [
    { from: 'home', to: 'rival', attitude: 'fight' }, { from: 'rival', to: 'home', attitude: 'fight' },
    { from: 'home', to: 'gang', attitude: 'avoid' }, { from: 'gang', to: 'home', attitude: 'avoid' },
    { from: 'home', to: 'raiders', attitude: 'fight' }, { from: 'raiders', to: 'home', attitude: 'avoid' },
    { from: 'mutants', to: 'any', attitude: 'fight' }, { from: 'home', to: 'mutants', attitude: 'fight' }, { from: 'rival', to: 'mutants', attitude: 'fight' },
    { from: 'raiders', to: 'mutants', attitude: 'flee' }, { from: 'machines', to: 'mutants', attitude: 'fight' }, { from: 'mutants', to: 'machines', attitude: 'avoid' },
    { from: 'critters', to: 'any', attitude: 'flee' },
  ],
  campTypes: [
    { id: 'gang_camp', name: 'Gang-Lager', faction: 'owner', members: [3, 4], width: 6, props: 'fire,bags,stash', round: true, story: 'raider_camp' },
    { id: 'patrol', name: 'Spähtrupp', faction: 'rival', members: [2, 3], width: 4, props: 'bags', round: true },
    { id: 'nest', name: 'Nest', faction: 'mutants', members: [2, 3], width: 5, props: 'nest', round: false, story: 'nest' },
    { id: 'raider_camp', name: 'Plünderer-Lager', faction: 'raiders', members: [2, 3], width: 5, props: 'fire,stash', round: true, story: 'raider_camp' },
  ],
  sim: { recover: 12, nestGrowth: 15, nestMax: 160, nestSplit: 140, maxNests: 2, dissolveBelow: 25, dissolveDays: 2, moveChance: 50, wander: 5,
    visitChance: 15, visitDays: 2, refillDays: 3, settleStrength: 50, takeover: 60, nestChance: 4, maxCamps: 4, sentries: 35, roundReach: 36, maxStrength: 115 },
  director: { peak: 70, calm: 25, decay: 6, perEngaged: 5, perHurt: 0.8, perKill: 6, siren: 45, peakMin: 6, peakMax: 25, relax: 18, wowGrace: 8,
    lull: 45, maxWaves: 2, waveSize: 2, notice: 50, feudDamage: 60, music: 30 },
  lines: [
    { kind: 'moved', text: '⚠️ Entwurf: Das Lager der {gang} steht jetzt woanders. Sie haben dich nicht vergessen.' },
    { kind: 'gone', text: '⚠️ Entwurf: Vom Lager ist nur kalte Asche übrig. Die {gang} sind weitergezogen.' },
    { kind: 'nest', text: '⚠️ Entwurf: Es raschelt mehr als letztes Mal. Das Nest hat sich geteilt.' },
    { kind: 'owner', text: '⚠️ Entwurf: Neue Farben an den Wänden. Hier sitzen jetzt die {gang}.' },
    { kind: 'visit', text: '⚠️ Entwurf: Funkverkehr auf einer fremden Frequenz. Ein Spähtrupp der {gang} ist im Haus.' },
    { kind: 'settle', text: '⚠️ Entwurf: Jemand hat sich hier neu eingerichtet. Frische Feuerstelle.' },
    { kind: 'raided', text: '⚠️ Entwurf: Sie lecken noch ihre Wunden vom letzten Mal.' },
  ],
};

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
export function lifeConfig(D) {
  const L = D?.life || {}, S = { ...LIFE.sim }, R = { ...LIFE.director };
  for (const k of Object.keys(S)) S[k] = num(L.sim?.[k], S[k]);
  for (const k of Object.keys(R)) R[k] = num(L.director?.[k], R[k]);
  const camps = (L.campTypes?.length ? L.campTypes : LIFE.campTypes).filter(c => c?.id);
  return { enabled: L.enabled !== false, relations: (L.relations?.length ? L.relations : LIFE.relations).filter(r => r?.from && r?.to && r?.attitude), camps, sim: S, director: R,
    lines: L.lines?.length ? L.lines : LIFE.lines };
}
export const campType = (C, id) => C.camps.find(c => c.id === id) || C.camps[0];

// ---------- factions and relations ----------
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const split = v => String(v ?? '').split(',').map(s => s.trim()).filter(Boolean);
export function rivalsOf(D, gang) {
  const out = new Set();
  for (const p of Object.values(D?.pois || {})) { const g = p.gang; if (!g?.name) continue; const R = split(g.rivals); if (g.name === gang) R.forEach(r => out.add(r)); else if (R.includes(gang)) out.add(g.name); }
  return [...out];
}
// the faction token of a group from the place's point of view (owner = the gang holding it)
export function factionOf(D, { family, gang = null, owner = null } = {}) {
  if (family === 'mutant' || family === 'wildlife' || family === 'anomaly') return family === 'anomaly' ? 'machines' : 'mutants';
  if (family === 'machine') return 'machines';
  if (family === 'critter') return 'critters';
  if (!gang) return 'raiders';
  if (gang === owner) return 'home';
  return owner && rivalsOf(D, owner).includes(gang) ? 'rival' : 'gang';
}
// how a member of faction a reacts on seeing one of faction b; the same token never fights itself; rows for gang names win
export function attitude(C, a, b, { gangA = null, gangB = null } = {}) {
  if (a === b && gangA === gangB) return 'ignore';
  const rows = C.relations, hit = (r, x, g) => r === x || r === 'any' || (g && r === g);
  const named = rows.find(r => gangA && gangB && r.from === gangA && r.to === gangB);
  if (named) return named.attitude;
  return rows.find(r => r.from === a && r.to === b)?.attitude || rows.find(r => hit(r.from, a, gangA) && hit(r.to, b, gangB))?.attitude || 'ignore';
}

// ---------- the state of a place (save.life[node]) ----------
// { v, day, seed, owner, camps: [{ id, type, gang, pos (0..1 along the main path), strength (%), age, low, ttl? }], log: [{ day, kind, gang }],
//   losses (Leyla's kills, all time), quiet (days without a camp) }
const SIZE_CAMPS = { S: 1, M: 2, L: 2, XL: 3, XXL: 4 };
const hasMutants = (D, P) => (P.enemies || []).some(e => D.enemies?.[e]?.family === 'mutant');
const hasRaiders = (D, P) => (P.enemies || []).some(e => D.enemies?.[e]?.family === 'raider' && D.enemies[e].behavior !== 'boss');
export function initLife(D, poiId, { seed = 1, owner, day = 1 } = {}) {
  const P = D?.pois?.[poiId] || {}, C = lifeConfig(D), r = rng((seed ^ hash(poiId)) >>> 0), own = owner === undefined ? (P.gang?.name || null) : owner;
  const n = Math.max(1, Math.min(C.sim.maxCamps, P.life?.camps ?? SIZE_CAMPS[P.size] ?? 1)), camps = [];
  const nest = P.life?.nest ?? hasMutants(D, P);
  for (let i = 0; i < n; i++) {
    // the owner's camps first; a POI with mutants gets one nest (Storm Drain: only nests)
    const type = (!own || !hasRaiders(D, P)) && nest ? 'nest' : nest && i === n - 1 && n > 1 ? 'nest' : own ? 'gang_camp' : 'raider_camp';
    camps.push({ id: `c${i + 1}`, type, gang: type === 'gang_camp' ? own : null, pos: Math.round(clamp((i + 0.5) / n + (r() - 0.5) * 0.3, 0, 1) * 100) / 100, strength: 100, age: 0, low: 0 });
  }
  return { v: 1, day, seed: seed >>> 0, owner: own, camps, log: [], losses: 0, quiet: 0, next: n + 1 };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const note = (S, day, kind, gang = null, camp = null) => { S.log.push({ day, kind, gang, ...(camp ? { camp } : {}) }); if (S.log.length > 24) S.log.splice(0, S.log.length - 24); };
// one day passes at a place (ctx: { owner, rivals }) → the state, changed in place
export function stepDay(D, poiId, S, ctx = {}) {
  const C = lifeConfig(D), K = C.sim, P = D?.pois?.[poiId] || {}, day = S.day + 1, r = rng((S.seed ^ hash(`${poiId}:${day}`)) >>> 0);
  const owner = ctx.owner === undefined ? S.owner : ctx.owner, rivals = ctx.rivals || (owner ? rivalsOf(D, owner) : []);
  S.day = day;
  // the Revierkrieg set a new owner: the old owner's camps change hands (weakened), the ecosystem tells it
  if (owner !== S.owner) {
    for (const c of S.camps) if (c.type === 'gang_camp') { c.gang = owner; c.strength = Math.min(c.strength, K.takeover); if (!owner) c.type = 'raider_camp'; }
    if (owner && hasRaiders(D, P) && !S.camps.some(c => c.type === 'gang_camp')) S.camps.push({ id: `c${S.next++}`, type: 'gang_camp', gang: owner, pos: Math.round(r() * 100) / 100, strength: K.takeover, age: 0, low: 0 });
    note(S, day, 'owner', owner); S.owner = owner;
  }
  for (const c of [...S.camps]) {
    c.age++;
    if (c.type === 'nest') c.strength = clamp(c.strength + K.nestGrowth, 0, K.nestMax);
    else c.strength = clamp(c.strength + K.recover, 0, K.maxStrength);
    if (c.ttl != null && --c.ttl <= 0) { S.camps.splice(S.camps.indexOf(c), 1); note(S, day, 'left', c.gang, c.id); continue; }
    if (c.strength < K.dissolveBelow) { if (++c.low >= K.dissolveDays) { S.camps.splice(S.camps.indexOf(c), 1); note(S, day, 'gone', c.gang, c.id); continue; } } else c.low = 0;
    // raided by Leyla: often they move (Rain World: a lair that got found is given up), sometimes just like that
    if ((c.raided && r() * 100 < K.moveChance) || r() * 100 < K.wander) { c.pos = Math.round(r() * 100) / 100; note(S, day, 'moved', c.gang, c.id); }
    c.raided = false;
  }
  // nests grow and split
  const nests = S.camps.filter(c => c.type === 'nest');
  for (const c of nests) if (c.strength >= K.nestSplit && nests.length < K.maxNests && S.camps.length < K.maxCamps) {
    c.strength = Math.round(c.strength / 2);
    S.camps.push({ id: `c${S.next++}`, type: 'nest', gang: null, pos: clamp(Math.round((c.pos + (r() < 0.5 ? -0.3 : 0.3)) * 100) / 100, 0, 1), strength: c.strength, age: 0, low: 0 });
    note(S, day, 'nest', null); break;
  }
  // wandering groups: a rival patrol comes for a few days
  if (rivals.length && hasRaiders(D, P) && !S.camps.some(c => c.type === 'patrol') && S.camps.length < K.maxCamps && r() * 100 < K.visitChance) {
    const g = rivals[Math.floor(r() * rivals.length)];
    S.camps.push({ id: `c${S.next++}`, type: 'patrol', gang: g, pos: Math.round(r() * 100) / 100, strength: 80, age: 0, low: 0, ttl: K.visitDays });
    note(S, day, 'visit', g);
  }
  // now and then mutants move into a weak place
  const total = S.camps.reduce((s, c) => s + c.strength, 0);
  if (!nests.length && total < 120 && S.camps.length < K.maxCamps && r() * 100 < K.nestChance) { S.camps.push({ id: `c${S.next++}`, type: 'nest', gang: null, pos: Math.round(r() * 100) / 100, strength: 40, age: 0, low: 0 }); note(S, day, 'nest', null); }
  // never empty for good: after a few quiet days someone settles
  if (!S.camps.length) {
    if (++S.quiet >= K.refillDays) {
      const type = owner && hasRaiders(D, P) ? 'gang_camp' : hasMutants(D, P) || !hasRaiders(D, P) ? 'nest' : 'raider_camp';
      S.camps.push({ id: `c${S.next++}`, type, gang: type === 'gang_camp' ? owner : null, pos: Math.round(r() * 100) / 100, strength: K.settleStrength, age: 0, low: 0 });
      note(S, day, 'settle', type === 'gang_camp' ? owner : null); S.quiet = 0;
    }
  } else S.quiet = 0;
  for (const c of S.camps) c.strength = Math.round(c.strength);
  return S;
}
// up to `day` (whole days), at most 60 at once (a long trip: the rest is as good as settled)
export function simulate(D, poiId, S, day, ctx = {}) {
  if (Math.floor(day) - S.day > 60) S.day = Math.floor(day) - 60;
  let n = Math.max(0, Math.floor(day) - S.day);
  while (n-- > 0) stepDay(D, poiId, S, ctx);
  return S;
}
// Leyla's kills per camp at the end of a run: strength down by the share she took, the camp remembers it was raided
export function recordLosses(D, S, kills = {}) {
  const C = lifeConfig(D);
  for (const [id, n] of Object.entries(kills)) {
    const c = S.camps.find(x => x.id === id); if (!c || !(n > 0)) continue;
    const T = campType(C, c.type), size = Math.max(1, T.members?.[1] ?? 3);
    c.strength = Math.max(0, Math.round(c.strength - 100 * n / size)); c.raided = true; S.losses += n;
    note(S, S.day, 'raided', c.gang, c.id);
  }
  return S;
}
export function validState(S) {
  return !!S && typeof S === 'object' && Array.isArray(S.camps) && Number.isFinite(S.day) && Array.isArray(S.log)
    && S.camps.every(c => c && typeof c.id === 'string' && Number.isFinite(c.strength) && Number.isFinite(c.pos));
}
// a place in the savegame: save.life[node] (repaired, created, simulated to today) → the state
export function lifeAt(D, save, node, poiId, owner) {
  repairLife(save);
  const day = save.day ?? 1, seed = ((save.map?.seed ?? 0) ^ hash(`${node}:${save.cycle ?? 1}`)) >>> 0;
  let S = save.life[node];
  if (!validState(S)) S = save.life[node] = initLife(D, poiId, { seed, owner, day });
  simulate(D, poiId, S, day, { owner });
  return S;
}
// the savegame repair: broken places are dropped (they start fresh on the next visit)
export function repairLife(save) {
  if (!save) return save;
  if (!save.life || typeof save.life !== 'object' || Array.isArray(save.life)) { save.life = {}; return save; }
  for (const [k, S] of Object.entries(save.life)) if (!validState(S)) delete save.life[k];
  return save;
}
// what changed since `since` (day) for AvA and the time layers → [{ day, kind, gang }]
export const newsSince = (S, since) => (S?.log || []).filter(x => x.day > since);
// ---------- camps in the welded level ----------
const BLOCK = new Set(['H', 'D', 'C', 'S', '!', '@', '+', '|', 'Z', 'L', '%', '$', 'B', 'o', '^', 'v']);
// the rooms a camp may live in, each with its longest free floor away from seams → [{ i, id, x0, x1, y }] (y = the row she stands in)
export function campSpots(D, L, minW = 4, loose = false) {
  if (!L?.def) return [];
  const tiles = L.def.layout, sym = new Set((L.def.spawns || []).map(s => s.symbol)), cfg = levelConfig(D), gates = roomGates(L), mains = L.rooms.filter(r => r.band === 'main');
  const at = (x, y) => tiles[y]?.[x] ?? '#', air = c => c === '.' || sym.has(c);
  const near = (x, y) => { for (let dy = -2; dy <= 0; dy++) for (let dx = -1; dx <= 1; dx++) if (BLOCK.has(at(x + dx, y + dy))) return true; return false; };
  const ladder = (x, y) => { for (let dy = -3; dy <= 1; dy++) for (let dx = -4; dx <= 4; dx++) if (at(x + dx, y + dy) === 'H') return true; return false; };
  const out = [], scan = (r, i, pts, side) => {
    let best = null;
    for (let y = r.y + 2; y < r.y + r.h - 1; y++) {
      let x0 = null;
      for (let x = r.x + 2; x <= r.x + r.w - 2; x++) {
        const ok = x < r.x + r.w - 2 && air(at(x, y)) && air(at(x, y - 1)) && air(at(x, y - 2)) && at(x, y + 1) === '#' && !near(x, y)
          && !pts.some(([gx, gy]) => Math.abs(gx - x) <= cfg.seam + (loose ? 0 : 1) && Math.abs(gy - y) <= cfg.seam + 2) && (!side || !ladder(x, y));
        if (ok && x0 == null) x0 = x;
        if (!ok && x0 != null) { const w = x - x0; if (w >= minW && (!best || w + (y - r.y) * 0.5 > best.x1 - best.x0 + (best.y - r.y) * 0.5)) best = { i, id: r.id, x0, x1: x - 1, y, ...(side ? { side: true } : {}) }; x0 = null; }
      }
    }
    if (best) out.push(best);
  };
  mains.forEach((r, i) => {
    const R = D.rooms?.[r.id] || {}, type = roomType(R);
    if (r.rest || r.wow || type === 'rest' || type === 'wow' || type === 'boss' || i === 0 || (i === mains.length - 1 && mains.length > 3)) return;
    const g = gates[i] || {};
    scan(r, i, [g.in, g.out].filter(Boolean), false);
  });
  // the exit (the vault, the climax) only when no other main room has a place
  const last = mains.length - 1, R = mains[last];
  if (!out.length && last > 0 && mains.length > 3 && !R.rest && !R.wow && !['rest', 'wow', 'boss'].includes(roomType(D.rooms?.[R.id] || {}))) scan(R, last, [gates[last]?.in, gates[last]?.out].filter(Boolean), false);
  // small POIs: side rooms help out (away from their ladder)
  if (out.length < 2) L.rooms.forEach((r, k) => { if (r.band === 'branch' && !r.wow && roomType(D.rooms?.[r.id]) !== 'rest') scan(r, mains.length + k, [], true); });
  // nothing at all (a tiny POI): closer to the seams (still out of the seam rule's reach) and narrower
  return out.length || loose ? out : campSpots(D, L, 3, true);
}
// how far a round goes along the same floor from x (tiles), both ways → [xl, xr]
function roundRoute(tiles, x, y, reach) {
  const at = (xx, yy) => tiles[yy]?.[xx] ?? '#', walk = xx => !'#=HDB$%|'.includes(at(xx, y)) && !'#=HD'.includes(at(xx, y - 1)) && '#='.includes(at(xx, y + 1));
  let l = x, r = x;
  while (l - 1 > 0 && x - l < reach && walk(l - 1)) l--;
  while (r + 1 < tiles[0].length - 1 && r - x < reach && walk(r + 1)) r++;
  return [Math.min(x, l + 1), Math.max(x, r - 1)];
}
// the camps of a state in a level, its members instead of the level's spawns → { camps, layout, sentries, removed, unplaced }
//   Specialists (bosses, enemies with traits: sirens, medics, snipers, throwers) keep their designed places; of the others a share
//   (Simulation › Wachen) keeps standing as sentries, the rest is gone: the camps bring their own people.
export function planLife(D, poiId, L, S, seed = 1) {
  const C = lifeConfig(D), K = C.sim, P = D?.pois?.[poiId] || {}, r = rng((seed ^ hash(`life:${poiId}`)) >>> 0);
  if (!L?.def || !S || !C.enabled || P.life?.off) return { camps: [], layout: L?.def?.layout || [], sentries: [], removed: 0, unplaced: [] };
  const E = D.enemies || {}, owner = S.owner, sym = new Map((L.def.spawns || []).map(s => [s.symbol, s.enemy]));
  const special = id => !E[id] || E[id].behavior === 'boss' || (E[id].traits || []).length > 0;
  const tiles = L.def.layout.map(row => [...row]), sentries = [];
  let removed = 0;
  for (let y = 0; y < tiles.length; y++) for (let x = 0; x < tiles[y].length; x++) {
    const e = sym.get(tiles[y][x]); if (!e || special(e)) continue;
    if (r() * 100 < K.sentries) sentries.push({ x, y, enemy: e, faction: factionOf(D, { family: E[e].family, gang: E[e].family === 'raider' ? owner : null, owner }), gang: E[e].family === 'raider' ? owner : null });
    else { tiles[y][x] = '.'; removed++; }
  }
  const pool = fam => (P.enemies || []).filter(e => E[e] && !special(e) && E[e].family === fam && (fam !== 'mutant' || E[e].behavior !== 'ambusher'));
  const spots = campSpots(D, L, 4), used = new Set(), camps = [], unplaced = [], mains = L.rooms.filter(o => o.band === 'main').length;
  for (const c of [...S.camps].sort((a, b) => a.pos - b.pos)) {
    const T = campType(C, c.type), mut = T.faction === 'mutants';
    let list = mut ? pool('mutant') : pool('raider');
    if (mut && !list.length && E[D.life?.nestEnemy || 'kriecher']) list = [D.life?.nestEnemy || 'kriecher'];
    const free = spots.filter(s => !used.has(s.i) && s.x1 - s.x0 + 1 >= Math.min(T.width ?? 5, 3));
    if (!list.length || !free.length) { unplaced.push(c.id); continue; }
    const want = c.pos * (mains - 1), s = free.sort((a, b) => (a.side ? 1 : 0) - (b.side ? 1 : 0) || Math.abs(a.i - want) - Math.abs(b.i - want) || b.x1 - b.x0 - (a.x1 - a.x0))[0];
    used.add(s.i);
    const [lo, hi] = T.members || [2, 3], base = lo + Math.floor(r() * (Math.max(lo, hi) - lo + 1)), n = Math.max(c.strength >= K.dissolveBelow ? 1 : 0, Math.min(hi + 1, Math.round(base * c.strength / 100)));
    const w = s.x1 - s.x0 + 1, gang = mut ? null : c.gang, faction = mut ? 'mutants' : factionOf(D, { family: 'raider', gang, owner });
    const members = [];
    for (let k = 0; k < n; k++) {
      const x = s.x0 + Math.min(w - 1, Math.floor((k + 0.5) * w / n));
      members.push({ enemy: list[Math.floor(r() * list.length)], x, y: s.y, role: T.round && n >= 2 && k === 0 ? 'round' : k % 2 ? 'guard' : 'sit', faction, gang });
    }
    for (const m of members) if (sym.has(tiles[m.y][m.x])) tiles[m.y][m.x] = '.';
    const cx = Math.round((s.x0 + s.x1) / 2), room = L.rooms.find(o => o.id === s.id && s.x0 >= o.x && s.x0 < o.x + o.w && s.y >= o.y && s.y < o.y + o.h);
    camps.push({ id: c.id, type: c.type, name: T.name, faction, gang, strength: c.strength, room: room.id, roomIndex: s.i, ...(s.side ? { side: true } : {}), x0: s.x0, x1: s.x1, y: s.y, cx,
      props: split(T.props), story: T.story || null, members, route: roundRoute(tiles, cx, s.y, K.roundReach) });
  }
  return { camps, layout: tiles.map(row => row.join('')), sentries, removed, unplaced };
}

// ---------- Regie (Left 4 Dead: build-up → peak → relax) ----------
export const DIRECTOR_PHASES = [['build', 'Aufbau'], ['peak', 'Spitze'], ['relax', 'Ruhe']];
export const newDirector = () => ({ phase: 'build', tension: 0, t: 0, since: 0, waves: 0, lullSince: 0, peaks: 0, log: [] });
// one tick: inp = { dt (ms), engaged (enemies fighting her), hurt (life lost), kills, siren (a siren howled), rest (she is in an Atempause) }
export function directorStep(st, inp = {}, R = LIFE.director) {
  const dt = Math.max(0, inp.dt || 0) / 1000;
  st.t += dt;
  let T = st.tension + (inp.engaged || 0) * R.perEngaged * dt + (inp.hurt || 0) * R.perHurt + (inp.kills || 0) * R.perKill + (inp.siren ? R.siren : 0);
  if (!inp.engaged) T -= R.decay * dt * (st.phase === 'relax' ? 2 : 1);
  st.tension = Math.max(0, Math.min(100, T));
  const go = phase => { st.phase = phase; st.since = st.t; st.log.push({ t: Math.round(st.t * 10) / 10, phase }); if (st.log.length > 30) st.log.shift(); if (phase === 'peak') st.peaks++; };
  if (inp.rest && st.phase !== 'relax') go('relax');
  else if (st.phase === 'build' && st.tension >= R.peak) go('peak');
  else if (st.phase === 'peak' && st.t - st.since >= R.peakMin && (st.tension < R.peak * 0.6 || st.t - st.since >= R.peakMax)) go('relax');
  else if (st.phase === 'relax' && !inp.rest && st.t - st.since >= R.relax && st.tension <= R.calm) go('build');
  if (st.phase === 'build' && st.tension <= R.calm && !inp.engaged) st.lullSince ||= st.t; else st.lullSince = 0;
  return st;
}
// may help come now? never in the relax phase, never in an Atempause, never in the first seconds of the Wow room
export const mayReinforce = (st, ctx = {}, R = LIFE.director) => !!st && st.phase !== 'relax' && !ctx.rest && !(ctx.wow && (ctx.inRoom ?? 0) < R.wowGrace);
// the music layer for the phase
export const musicLayer = (st, R = LIFE.director) => !st || st.phase === 'relax' ? 'calm' : st.phase === 'peak' ? 'combat' : st.tension > R.calm ? 'tension' : 'calm';
// a director's wave in a long lull of the build-up (she walks through quiet rooms): only where help may come, at most „Wellen“ per run
export const wantsWave = (st, ctx = {}, R = LIFE.director) => mayReinforce(st, ctx, R) && st.phase === 'build' && st.lullSince > 0 && st.t - st.lullSince >= R.lull && st.waves < R.maxWaves && !!ctx.arena;

export function lifeLine(D, kind, vars = {}) {
  const t = lifeConfig(D).lines.find(l => l.kind === kind)?.text || '';
  return t.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? 'jemand');
}
