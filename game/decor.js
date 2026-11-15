// Decoration in the camp (#036, Daniel 15.11.2026: „Bau das Dekosystem und aus jeder deiner Pakete ein paar Beispiele. Vielleicht
// auch große Zelte zwischen zwei Containern?“). Pure cosmetics, bought from the dealer in build mode and placed in the world.
// No DOM: browser and Node.
//
//   D.decor[id] = { name, art, place: 'ground' | 'wall' | 'roof' | 'span', value, cozy, size: [w, h] tiles, color, colors, text,
//                   addon (rig add-on with a cut-out), items (icons), anchor (a ground piece that offers a span anchor at its top) }
//   save.rig.decor = [{ id, at }]       at: ground { x } (tiles from the campsite's left edge) · wall/roof { ui, p } (unit, place)
//                                            · span { a, b } (anchor ids: '<ui>:<0|1>' container corners, 'mast:0', 'pole:<i>')
//   save.rig.spare.decor = [id]          bought or taken down, waiting in the Lager
// Gemütlichkeit (cozy): every piece adds its points; the sum makes sleeping and resting give stronger buffs (capped, Camp › Deko).

export const DECOR_PLACES = [['ground', 'Auf dem Boden'], ['wall', 'An der Container-Wand'], ['roof', 'Auf dem Dach'], ['span', 'Zwischen zwei Punkten']];
export const DECOR_ARTS = [['addon', 'Ausschnitt eines Anbauteils'], ['neon', 'Neon-Schild'], ['banner', 'Banner'], ['graffiti', 'Graffiti'], ['line', 'Wäscheleine'],
  ['sail', 'Sonnensegel'], ['tent', 'Zelt'], ['pole', 'Zeltstange (Ankerpunkt)'], ['windmill', 'Windrad'], ['plant', 'Pflanze im Topf'], ['tripod', 'Dreibein mit Topf'],
  ['birdhouse', 'Vogelhaus (Krähen)'], ['trophies', 'Kiste mit Fundstücken'], ['hammock', 'Hängematte'], ['lantern', 'Laterne'], ['pennants', 'Wimpelkette'], ['canopy', 'Fallschirm-Plane'], ['barrel', 'Feuertonne']];

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
  if ((kind === 'wall' || kind === 'roof') && (at.ui == null || at.p == null)) return { ok: false, why: 'An einen Container' };
  if (kind === 'ground' && !Number.isFinite(at.x)) return { ok: false, why: 'Auf den Boden' };
  const max = D.camp?.decor?.max ?? 40;
  if (R.decor.length >= max) return { ok: false, why: `Mehr als ${max} Deko-Stücke hat das Camp nicht` };
  R.decor.push({ id, at: { ...at, day: at.day ?? save.day ?? 1 } });
  return { ok: true, i: R.decor.length - 1 };
}
// take a placed piece back into the hand; spans that hung on a pole at index i come down into the Lager, later poles shift
export function lift(D, save, i) {
  const R = dstate(save), x = R.decor[i];
  if (!x) return null;
  R.decor.splice(i, 1);
  const fix = a => { const m = /^pole:(\d+)$/.exec(a || ''); if (!m) return a; const n = Number(m[1]); return n === i ? null : n > i ? `pole:${n - 1}` : a; };
  R.decor = R.decor.filter(o => {
    if (o.at?.a == null) return true;
    o.at.a = fix(o.at.a); o.at.b = fix(o.at.b);
    if (o.at.a && o.at.b) return true;
    R.spare.decor.push(o.id);
    return false;
  });
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
export const cozy = (D, save) => (save?.rig?.decor || []).reduce((n, x) => n + (decorDef(D, x.id)?.cozy || 0), 0);
export const cozyBonus = (D, save) => Math.min(D.camp?.decor?.cozyMax ?? 25, cozy(D, save));

// the rig was rebuilt (units moved or left): pieces on a unit follow it by its key; gone units drop theirs into the Lager
// move(key) → new unit index or null (the same mapping applyDraft uses for string lights)
export function remap(rig, move) {
  if (!rig.decor?.length) return;
  rig.spare ??= { workshops: [], containers: [] }; rig.spare.decor ??= [];
  const corner = a => { if (!a || /^(mast|pole):/.test(a)) return a; const [ui, side] = String(a).split(':'); const n = move(Number(ui)); return n == null ? null : `${n}:${side}`; };
  rig.decor = rig.decor.filter(o => {
    const at = o.at || {};
    if (at.ui != null) { const n = move(at.ui); if (n == null) { rig.spare.decor.push(o.id); return false; } at.ui = n; }
    if (at.a != null) { at.a = corner(at.a); at.b = corner(at.b); if (!at.a || !at.b) { rig.spare.decor.push(o.id); return false; } }
    return true;
  });
}
// a plant's growth stage 0…3 by days since it was placed (Deko › Wächst in Tagen)
export const plantStage = (D, save, x) => Math.max(0, Math.min(3, Math.floor(((save.day ?? 1) - (x.at?.day ?? 1)) / Math.max(1, decorDef(D, x.id)?.growDays ?? 2))));
