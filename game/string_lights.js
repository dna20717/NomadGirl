// String lights in the camp (#008, Daniel, 13.11.2026: „Mach an den Container-Ecken Andockpunkte und lass den Spieler die
// Lichterketten selbst ziehen“). Every unit of the rig has two docking points on its upper corners; in build mode a string is
// pulled from one point to another (Camp › Lichterketten: price, maximum, sag, bulb spacing, colours). No DOM.
//
//   save.rig.lights = [['<unit>:<0|1>', '<unit>:<0|1>'], …]   0 = left corner, 1 = right corner; 'mast:0' = the mast at the
//   campfire (#014, Daniel 13.11.2026: „Mast am Lagerfeuer“), it belongs to no unit and stays put when the rig is rebuilt

export function lightsConfig(D) {
  const L = D.camp?.lights || {};
  return { enabled: L.enabled !== false, max: L.max ?? 12, sag: L.sag ?? 18, spacing: Math.max(12, L.spacing ?? 34), price: L.price ?? 10, back: L.back ?? 50, maxLength: L.maxLength ?? 1600,
    mast: L.mast !== false, mastOffset: L.mastOffset ?? -220, mastHeight: L.mastHeight ?? 300,
    colors: String(L.colors || '#ffd541').split(',').map(c => c.trim()).filter(Boolean) };
}

// the mast at the campfire: where it stands (x of the fire, ground) → { x, y, top } or null
export function mastAt(D, fireX, ground) {
  const L = lightsConfig(D);
  return L.enabled && L.mast && fireX != null ? { x: fireX + L.mastOffset, y: ground, top: ground - L.mastHeight } : null;
}
// the docking points of the units as drawn (geo.units of the camp: x0, x1, inTop), plus the mast
export function anchors(units, mast = null) {
  const out = [];
  if (mast) out.push({ id: 'mast:0', ui: 'mast', x: mast.x, y: mast.top + 6 });
  for (const u of units || []) {
    // the corners of the box itself (interior ± its walls), not of the drawbar or chassis
    const y = u.inTop - 34, l = u.in0 != null ? u.in0 - 4 : u.x0 + 12, r = u.in0 != null ? u.in0 + u.cell * u.places + 4 : u.x1 - 12;
    out.push({ id: `${u.ui}:0`, ui: u.ui, x: l, y }, { id: `${u.ui}:1`, ui: u.ui, x: r, y });
  }
  return out;
}

// hanging string between two points: a parabola that sags more on longer spans; bulbs at even spacing
export function catenary(p, q, sag = 18, spacing = 34) {
  const len = Math.hypot(q.x - p.x, q.y - p.y), drop = sag + len * 0.07, n = Math.max(2, Math.ceil(len / 10));
  const at = t => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t + drop * 4 * t * (1 - t) });
  const line = Array.from({ length: n + 1 }, (_, i) => at(i / n));
  const k = Math.max(1, Math.round(len / spacing)), bulbs = Array.from({ length: Math.max(0, k - 1) }, (_, i) => at((i + 1) / k));
  return { line, bulbs, mid: at(0.5), len };
}

// may this string be hung? → reason or null
export function canHang(D, save, a, b, pos) {
  const L = lightsConfig(D), list = save.rig.lights || [];
  if (!L.enabled) return 'Lichterketten sind aus';
  if (!a || !b || a === b) return 'Zu einem anderen Andockpunkt ziehen';
  if (list.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return 'Da hängt schon eine';
  if (list.length >= L.max) return `Mehr als ${L.max} Lichterketten hat das Camp nicht`;
  if ((save.deltas || 0) < L.price) return `Eine Lichterkette kostet ${L.price} Δ`;
  if (pos && Math.hypot(pos.b.x - pos.a.x, pos.b.y - pos.a.y) > L.maxLength) return 'Zu weit für eine Kette';
  return null;
}
export function hang(D, save, a, b, pos) {
  const why = canHang(D, save, a, b, pos);
  if (why) return { ok: false, why };
  const L = lightsConfig(D);
  (save.rig.lights ??= []).push([a, b]);
  save.deltas = (save.deltas || 0) - L.price;
  return { ok: true, deltas: -L.price };
}
// taking one down gives part of the price back (Camp › Lichterketten › Zurück beim Abnehmen, default half)
export function unhang(D, save, i) {
  const list = save.rig.lights || [];
  if (!list[i]) return { ok: false };
  list.splice(i, 1);
  const L = lightsConfig(D), back = Math.floor(L.price * L.back / 100);
  save.deltas = (save.deltas || 0) + back;
  return { ok: true, deltas: back };
}
