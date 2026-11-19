// Decoration in the camp (#036, Daniel 15.11.2026: „Bau das Dekosystem und aus jeder deiner Pakete ein paar Beispiele. Vielleicht
// auch große Zelte zwischen zwei Containern?“). Pure cosmetics, bought from the dealer in build mode and placed in the world.
// No DOM: browser and Node.
//
//   D.decor[id] = { name, art, place: 'ground' | 'wall' | 'roof' | 'side' | 'span', value, cozy, size: [w, h] tiles, color, colors, text,
//                   addon (rig add-on with a cut-out), items (icons), growDays }   poles, balconies and towers offer span anchors
//   save.rig.decor = [{ id, at }]       at: ground { x } (tiles from the campsite's left edge) · wall/roof { ui, p } (unit, place)
//                                            · span { a, b } (anchor ids: '<ui>:<0|1>' container corners, 'mast:0', 'pole:<i>')
//   save.rig.spare.decor = [id]          bought or taken down, waiting in the Lager
// Gemütlichkeit (cozy): every piece adds its points; the sum makes sleeping and resting give stronger buffs (capped, Camp › Deko).

export const DECOR_PLACES = [['free', 'Frei (Boden, Dach, aufeinander)'], ['inside', 'Im Container (Rückwand, Decke)'], ['climb', 'An der Container-Wand (Leiter, Treppe)'], ['ground', 'Auf dem Boden'], ['wall', 'An der Container-Wand'], ['roof', 'Auf dem Dach'], ['side', 'Am Container-Ende (Balkon)'], ['span', 'Zwischen zwei Punkten']];
export const DECOR_ARTS = [['addon', 'Ausschnitt eines Anbauteils'], ['neon', 'Neon-Schild'], ['banner', 'Banner'], ['graffiti', 'Graffiti'], ['line', 'Wäscheleine'],
  ['sail', 'Sonnensegel'], ['tent', 'Zelt'], ['pole', 'Zeltstange (Ankerpunkt)'], ['windmill', 'Windrad'], ['plant', 'Pflanze im Topf'], ['tripod', 'Dreibein mit Topf'],
  ['birdhouse', 'Vogelhaus (Krähen)'], ['trophies', 'Kiste mit Fundstücken'], ['hammock', 'Hängematte'], ['lantern', 'Laterne'], ['mirror', 'Spiegel (Haare färben)'], ['pennants', 'Wimpelkette'], ['canopy', 'Fallschirm-Plane'], ['barrel', 'Feuertonne'], ['balcony', 'Balkon (begehbar)'], ['bridge', 'Brücke (begehbar)'], ['tower', 'Aussichtsturm (begehbar, Leiter)'], ['icon', 'Bild aus einem Symbol-Raster'], ['sprite', 'Bild mit Varianten (Baukasten)'], ['ladder', 'Leiter aufs Dach (kletterbar)'], ['stairs', 'Treppe in den Container (kletterbar)']];
// #111 Camp-Baukasten: what can stand on a piece (Tragfläche)
export const DECOR_CARRY = [['', 'Nichts'], ['content', 'Oberkante des Bilds'], ['fixed', 'In fester Höhe']];
export const DECOR_GROW = [['', 'Nein'], ['up', 'Höhe (Kopf, Mittelstücke, Fuß)'], ['side', 'Breite (Enden, Abschnitte) und etwas Höhe'], ['stack', 'Stapel (mehr Stück übereinander)']];   // #116
export const DECOR_EXTRAS = [['', 'Nichts'], ['fire', 'Flammen + Licht'], ['light', 'Licht'], ['candle', 'Kerzenlicht (klein)'], ['steam', 'Dampf'], ['rotor', 'Rotor (dreht, von der Seite)'], ['neon', 'Neon (leuchtet nachts, flackert)']];
// #114 Farbe wie Townscaper: arts that take a painted colour (cloth and light)
export const PAINTABLE = new Set(['tent', 'sail', 'canopy', 'pennants', 'banner', 'line', 'hammock', 'neon']);
export const lighten = (hex, k = 0.45) => { const n = parseInt(hex.slice(1), 16), f = c => Math.round(c + (255 - c) * k); return '#' + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join(''); };
// a piece's definition with its painted colour applied (at.paint)
export const paintedDef = (d, at) => (at?.paint && d && PAINTABLE.has(d.art) ? { ...d, color: at.paint, colors: `${at.paint},${lighten(at.paint)}` } : d);
export const DECOR_USES = [['', 'Nichts'], ['mirror', 'Haare färben (Spiegel)'], ['rest', 'Ausruhen (eine Stunde, heilt)']];

export const decorDef = (D, id) => D.decor?.[id] || null;
export const placeOf = (D, id) => decorDef(D, id)?.place || 'ground';
export const dstate = save => { const r = save.rig; r.decor ??= []; r.spare ??= { workshops: [], containers: [] }; r.spare.decor ??= []; return r; };
export const priceOf = (D, id) => decorDef(D, id)?.value || 0;
export const sellPrice = (D, id) => Math.round(priceOf(D, id) * (D.camp?.decor?.back ?? 50) / 100);
// the dealer's decor: everything with a price
export const shopDecor = D => Object.entries(D.decor || {}).filter(([, d]) => (d.value || 0) > 0).map(([id]) => id);

// buy: Δ off, into the hand (the caller places it right away or it waits in the Lager)
export function buy(D, save, id) {
  const d = decorDef(D, id);
  if (!d) return { ok: false, why: 'Unbekannt' };
  if ((save.deltas || 0) < priceOf(D, id)) return { ok: false, why: 'Zu wenig Δ' };
  save.deltas -= priceOf(D, id);
  return { ok: true };
}
// place a piece (from the hand); at must suit its place kind
export function put(D, save, id, at) {
  const kind = placeOf(D, id), R = dstate(save);
  if (!at) return { ok: false, why: 'Kein Platz' };
  if (kind === 'span' && (!at.a || !at.b || at.a === at.b)) return { ok: false, why: 'Zwei verschiedene Punkte wählen' };
  if ((kind === 'wall' || kind === 'roof' || kind === 'inside' || kind === 'climb') && (at.ui == null || at.p == null)) return { ok: false, why: 'An einen Container' };
  if (kind === 'side' && (at.ui == null || (at.side !== 0 && at.side !== 1))) return { ok: false, why: 'An ein Container-Ende' };
  if (kind === 'side' && R.decor.some(o => o.at?.ui === at.ui && o.at?.side === at.side)) return { ok: false, why: 'Da ist schon ein Balkon' };
  if (kind === 'ground' && !Number.isFinite(at.x)) return { ok: false, why: 'Auf den Boden' };
  if (kind === 'free') { const why = freeWhy(D, save, id, at); if (why) return { ok: false, why }; }
  const max = D.camp?.decor?.max ?? 40;
  if (R.decor.length >= max) return { ok: false, why: `Mehr als ${max} Deko-Stücke hat das Camp nicht` };
  const n = variants(D, id), extra = {};
  if (n > 1 && at.v == null) extra.v = Math.floor(Math.random() * n);
  if (decorDef(D, id)?.flip && at.f == null) extra.f = Math.random() < 0.5 ? 1 : 0;
  R.decor.push({ id, at: { ...at, ...extra, day: at.day ?? save.day ?? 1 } });
  return { ok: true, i: R.decor.length - 1 };
}
// take a placed piece back into the hand; spans that hung on it (a pole, a balcony, a tower) come down into the Lager
export function lift(D, save, i) {
  const R = dstate(save), x = R.decor[i];
  if (!x) return null;
  // #111: what stood on it comes down to where it stood (a stack sinks by one piece, Townscaper-like: nothing is lost)
  for (const o of R.decor) if (o.at?.on === `deco:${i}`) {
    const { v, f, day } = o.at, base = { ...x.at };
    delete base.v; delete base.f; delete base.day;
    if (base.on) base.dx = (base.dx || 0) + (o.at.dx || 0); else if (Number.isFinite(base.x)) base.x += o.at.dx || 0;
    o.at = { ...base, ...(v != null ? { v } : {}), ...(f != null ? { f } : {}), day };
  }
  compact(R, (o, k) => k === i, { spare: true, except: i });
  return x;
}
export function stow(save, id) { dstate(save).spare.decor.push(id); }
export function fromSpare(save, id) { const L = dstate(save).spare.decor, i = L.indexOf(id); if (i < 0) return false; L.splice(i, 1); return true; }
export function sell(D, save, id) {
  if (!fromSpare(save, id)) return { ok: false };
  save.deltas = (save.deltas || 0) + sellPrice(D, id);
  return { ok: true, back: sellPrice(D, id) };
}
// Gemütlichkeit: the sum of the placed pieces, and what it gives (Camp › Deko › Gemütlichkeit wirkt bis)
export const cozy = (D, save) => cozyParts(D, save).total;
export const cozyBonus = (D, save) => Math.min(D.camp?.decor?.cozyMax ?? 25, cozy(D, save));

// removes pieces from rig.decor and keeps the rest pointing at the right pieces (Aufräumen 16.11.2026: anchors are array indices,
// 'pole:3' must become 'pole:2' when piece 1 goes; a span whose anchor piece went comes down too, and so on until nothing changes).
// drop(o, i) → true = remove; opts.spare = removed pieces go into the Lager (except index opts.except, the piece taken into the hand)
export function compact(rig, drop, opts = {}) {
  const L = rig.decor || [], gone = new Set(L.map((o, i) => (drop(o, i) ? i : -1)).filter(i => i >= 0));
  const ref = a => { const m = /^(pole|balc|tower|deco):(\d+)$/.exec(a || ''); return m ? Number(m[2]) : null; };
  for (let changed = true; changed;) {
    changed = false;
    L.forEach((o, i) => { if (gone.has(i) || (o.at?.a == null && o.at?.on == null)) return; if ([o.at.a, o.at.b, o.at.on].some(a => { const r = ref(a); return r != null && (gone.has(r) || !L[r]); })) { gone.add(i); changed = true; } });
  }
  if (!gone.size) return [];
  const map = new Map(); let n = 0;
  L.forEach((o, i) => { if (!gone.has(i)) map.set(i, n++); });
  const fix = a => { const r = ref(a); return r == null ? a : a.replace(/\d+$/, String(map.get(r))); };
  const removed = [];
  rig.decor = L.filter((o, i) => {
    if (gone.has(i)) { removed.push(o); if (opts.spare && i !== opts.except) ((rig.spare ??= { workshops: [], containers: [] }).decor ??= []).push(o.id); return false; }
    if (o.at?.a != null) { o.at.a = fix(o.at.a); o.at.b = fix(o.at.b); }
    if (o.at?.on != null) o.at.on = fix(o.at.on);
    return true;
  });
  return removed;
}
// the rig was rebuilt (units moved or left): pieces on a unit follow it by its key; gone units drop theirs into the Lager
// move(key) → new unit index or null (the same mapping applyDraft uses for string lights)
export function remap(rig, move) {
  if (!rig.decor?.length) return;
  rig.spare ??= { workshops: [], containers: [] }; rig.spare.decor ??= [];
  const corner = a => { if (!a || /^(mast|pole|balc|tower):/.test(a)) return a; const [ui, side] = String(a).split(':'); const n = move(Number(ui)); return n == null ? null : `${n}:${side}`; };
  const lost = new Set();
  rig.decor.forEach((o, i) => {
    const at = o.at || {};
    if (at.ui != null) { const n = move(at.ui); if (n == null) lost.add(i); else at.ui = n; }
    if (at.a != null) { at.a = corner(at.a); at.b = corner(at.b); if (!at.a || !at.b) lost.add(i); }
  });
  compact(rig, (o, i) => lost.has(i), { spare: true });
}
// a plant's growth stage 0…3 by days since it was placed (Deko › Wächst in Tagen)
export const plantStage = (D, save, x) => Math.max(0, Math.min(3, Math.floor(((save.day ?? 1) - (x.at?.day ?? 1)) / Math.max(1, decorDef(D, x.id)?.growDays ?? 2))));
// the balconies at a unit's ends (for the camp: no end wall where a balcony is): Set of 'ui:side'
export const balconies = rig => new Set((rig?.decor || []).filter(o => o.at?.side != null).map(o => `${o.at.ui}:${o.at.side}`));

// ---------- #111 Camp-Baukasten (Daniel 19.11.2026: „wie Townscaper oder Tiny Glade aus der Sidescroll-Perspektive“) ----------
// Free pieces stand on the ground, on a container roof or on another piece (at.on = 'deco:<i>', at.dx tiles from its centre).
// Every piece rolls a variant of its picture (at.v) and maybe a mirror (at.f). Neighbours and ensembles only ever add Gemütlichkeit
// (Dorfromantik: what fits gives a bonus, what does not costs nothing).
export const variants = (D, id) => { const d = decorDef(D, id), a = d?.look && D.assets?.[d.look]; return (d?.art === 'sprite' || d?.art === 'pole') && !d.growStages && a?.grid ? Math.max(1, a.grid[0] * a.grid[1]) : 1; };
export const tagsOf = d => String(d?.tags || '').split(',').map(t => t.trim()).filter(Boolean);
export const canCarry = d => !!d?.carry;
const onIndex = at => { const m = /^deco:(\d+)$/.exec(at?.on || ''); return m ? Number(m[1]) : null; };
// the ground or roof spot a piece finally rests on: { surf: 'g' | 'r<ui>', x (tiles), level (pieces below it) }
export function restOf(D, save, i, seen = new Set()) {
  const L = save?.rig?.decor || [], o = L[i];
  if (!o || seen.has(i)) return null;
  seen.add(i);
  const mb = /^balc:(\d+)$/.exec(o.at?.on || '');
  if (mb) return L[Number(mb[1])] ? { surf: `b${mb[1]}`, x: o.at.dx || 0, level: 0 } : null;
  const j = onIndex(o.at);
  if (j != null) { const b = restOf(D, save, j, seen); return b && { surf: b.surf, x: b.x + (o.at.dx || 0), level: b.level + 1 }; }
  if (o.at?.ui != null && o.at?.p != null) return { surf: `${({ wall: 'w', inside: 'i' })[decorDef(D, o.id)?.place] || 'r'}${o.at.ui}`, x: o.at.p * 6, level: 0 };   // a container place is about 6 tiles
  if (Number.isFinite(o.at?.x)) return { surf: 'g', x: o.at.x, level: 0 };
  return null;
}
// may this free piece go there? → reason or ''
export function freeWhy(D, save, id, at) {
  if (/^balc:\d+$/.test(at.on || '')) return decorDef(D, save.rig.decor?.[Number(at.on.slice(5))]?.id)?.art === 'balcony' ? '' : 'Kein Balkon';
  if (at.on != null) {
    const j = onIndex(at), L = save.rig.decor || [], b = L[j];
    if (j == null || !b) return 'Worauf?';
    if (!decorDef(D, id)?.stack) return 'Das lässt sich nicht draufstellen';
    if (!canCarry(decorDef(D, b.id))) return 'Darauf hält nichts';
    const r = restOf(D, save, j);
    if (!r) return 'Worauf?';
    if (r.level + 1 >= (D.camp?.decor?.stackMax ?? 4)) return 'Höher wird es zu wackelig';
    return '';
  }
  if (at.ui != null && at.p != null) return '';
  return Number.isFinite(at.x) ? '' : 'Kein Platz';
}
// the ensembles that stand in the camp: [{ id, name, cozy, members: [i] }]; a piece counts once per ensemble kind
export function ensembles(D, save) {
  const L = save?.rig?.decor || [], sets = D.decorSets || {}, out = [];
  const pos = L.map((o, i) => ({ i, r: restOf(D, save, i), tags: tagsOf(decorDef(D, o.id)) })).filter(p => p.r);
  for (const [id, e] of Object.entries(sets)) {
    const needs = (e.needs || []).filter(n => n.tag && (n.count ?? 1) > 0), within = e.within ?? 6, used = new Set();
    if (!needs.length) continue;
    const surfs = [...new Set(pos.map(p => p.r.surf))];
    for (const surf of surfs) {
      const here = pos.filter(p => p.r.surf === surf).sort((a, b) => a.r.x - b.r.x);
      for (const start of here) {
        if (used.has(start.i)) continue;
        const win = here.filter(p => !used.has(p.i) && p.r.x >= start.r.x && p.r.x <= start.r.x + within), take = [];
        const ok = needs.every(n => { const got = win.filter(p => p.tags.includes(n.tag) && !take.includes(p.i)).slice(0, n.count ?? 1); take.push(...got.map(p => p.i)); return got.length >= (n.count ?? 1); });
        if (!ok) continue;
        take.forEach(k => used.add(k));
        out.push({ id, name: e.name || id, cozy: e.cozy || 0, members: take, x: Math.min(...take.map(k => pos.find(p => p.i === k).r.x)), surf });
      }
    }
  }
  return out;
}
// neighbours: a piece that likes a tag gets its bonus when such a piece stands near it (once per row)
export function neighbourBonus(D, save) {
  const L = save?.rig?.decor || [], near = D.camp?.decor?.near ?? 2.5, out = [];
  const pos = L.map((o, i) => ({ i, d: decorDef(D, o.id), r: restOf(D, save, i) }));
  for (const p of pos) for (const like of p.d?.likes || []) {
    if (!like?.tag || !p.r) continue;
    if (pos.some(q => q.i !== p.i && q.r && q.r.surf === p.r.surf && Math.abs(q.r.x - p.r.x) <= near && tagsOf(q.d).includes(like.tag))) out.push({ i: p.i, tag: like.tag, cozy: like.cozy ?? 1 });
  }
  return out;
}
// the full sum: pieces + neighbours + ensembles (never below the plain sum)
export function cozyParts(D, save) {
  const base = (save?.rig?.decor || []).reduce((n, x) => n + (decorDef(D, x.id)?.cozy || 0), 0);
  const nb = neighbourBonus(D, save), en = ensembles(D, save);
  return { base, neighbours: nb.reduce((n, b) => n + b.cozy, 0), sets: en, total: base + nb.reduce((n, b) => n + b.cozy, 0) + en.reduce((n, e) => n + e.cozy, 0) };
}
