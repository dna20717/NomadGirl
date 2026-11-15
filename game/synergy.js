// Synergies between neighbouring workshops (#033, Daniel 15.11.2026: „ein wenig wie bei Civilization oder Dorfromantik. Wenn rund
// herum, also in allen verfügbaren angrenzenden Slots, passende Werkstätten sind, maximaler Bonus, ansonsten weniger“). No DOM.
//
// Every place of the rig is a cell on one grid: in the rig the containers stand side by side (the first one next to the van on
// the right, screen order), stacked ones one row up; in a mega rig the cells are its grid (place, story). The tractor's own places
// (van, bridge) are an island of their own. A workshop's neighbours are the cells left and right of it and above and below every
// place it takes, as far as there are places there. Its synergy:  score = neighbour cells holding a partner / neighbour cells,
// bonus = Werkstätten › Synergie › Höchstens × score. Partners are workshop ids or functions (Werkstätten › Synergie › Passt zu).
//   effects: speed (crafting, cooking, growing faster, %), power (+⚡ at full score), quality (its buff stronger, %)

const placesOf = (D, u) => (u.kind === 'tractor' ? D.tractors?.[u.id]?.places : D.containers?.[u.id]?.places) || 0;
const sizeOf = (D, id) => D.workshops?.[id]?.places || 1;

// cells: Map "x,y" → { ui, at, ws? } for every place of the rig (ws = the workshop instance standing there)
export function cells(D, rig, mega = false) {
  const out = new Map(), put = (x, y, ui, at) => out.set(`${x},${y}`, { ui, at, x, y });
  const U = rig?.units || [];
  // the tractor's places: an island far away
  U.forEach((u, ui) => { if (u.kind === 'tractor') for (let k = 0; k < placesOf(D, u); k++) put(-1000 + k, 0, ui, k); });
  if (mega) U.forEach((u, ui) => { if (u.kind === 'container' && u.pos) for (let k = 0; k < placesOf(D, u); k++) put(u.pos.place + k, u.pos.story, ui, k); });
  else {
    // the chain: ground units from the van to the left (screen order: place 0 on the left of each box), stacks on top of their base
    let right = 0, base = null;
    U.forEach((u, ui) => {
      if (u.kind !== 'container') return;
      const n = placesOf(D, u);
      if (u.level && base) {
        const free = base.n - n, off = u.slot != null ? Math.max(0, Math.min(free, u.slot)) : Math.floor(free / 2);
        for (let k = 0; k < n; k++) put(base.x + off + k, u.level, ui, k);
        return;
      }
      const x = right - n;
      for (let k = 0; k < n; k++) put(x + k, 0, ui, k);
      base = { x, n }; right = x;
    });
  }
  for (const c of out.values()) {
    const u = U[c.ui], w = u.workshops?.find(w => c.at >= w.at && c.at < w.at + sizeOf(D, w.id));
    if (w) c.ws = { id: w.id, at: w.at };
  }
  return out;
}

const fits = (D, partners, id) => { const f = D.workshops?.[id]?.function; return partners.includes(id) || (f && partners.includes(f)); };

// every built workshop with a synergy: [{ ui, at, id, effect, max, score, bonus, near: n, hits: [ids], avail }]
// save (or a rig: drafts and budgets): a rig whose containers carry grid positions is a mega rig
export function synergies(D, save) {
  const rig = save?.rig || save, mega = (rig?.units || []).some(u => u.pos), C = cells(D, rig, mega), out = [];
  (rig?.units || []).forEach((u, ui) => (u.workshops || []).forEach(w => {
    const S = D.workshops?.[w.id]?.synergy, partners = (S?.partners || []).filter(Boolean);
    if (!partners.length || !S.effect) return;
    const mine = [...C.values()].filter(c => c.ui === ui && c.ws?.at === w.at);
    if (!mine.length) return;
    const own = new Set(mine.map(c => `${c.x},${c.y}`)), seen = new Set(), hits = [];
    let avail = 0, good = 0;
    for (const c of mine) for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) {
      const k = `${c.x + dx},${c.y + dy}`;
      if (own.has(k) || seen.has(k)) continue;
      seen.add(k);
      const n = C.get(k);
      if (!n) continue;   // no place there: does not count against it
      avail++;
      if (n.ws && fits(D, partners, n.ws.id)) { good++; hits.push(n.ws.id); }
    }
    const score = avail ? good / avail : 0, max = Number(S.max) || 0;
    out.push({ ui, at: w.at, id: w.id, effect: S.effect, max, score, bonus: Math.round(max * score * 10) / 10, avail, near: good, hits: [...new Set(hits)] });
  }));
  return out;
}
// the synergy of one placed workshop (`<ui>:<at>`)
export const synergyAt = (D, save, place) => { const [ui, at] = String(place).split(':').map(Number); return synergies(D, save).find(s => s.ui === ui && s.at === at) || null; };
// the best speed bonus (%) of all built workshops with this id (crafting does not know which of two benches is used)
export const speedOf = (D, save, id) => Math.max(0, ...synergies(D, save).filter(s => s.id === id && s.effect === 'speed').map(s => s.bonus));
// extra power of all synergies (⚡, rounded down per workshop)
export const synergyPower = (D, save) => synergies(D, save).filter(s => s.effect === 'power').reduce((n, s) => n + Math.floor(s.bonus), 0);
// a short line for prompts and labels: „Synergie 2/3 · +20 % schneller“
export function synergyText(s) {
  if (!s) return '';
  const what = s.effect === 'speed' ? `${Math.round(s.bonus)} % schneller` : s.effect === 'power' ? `+${Math.floor(s.bonus)} ⚡` : `Buff +${Math.round(s.bonus)} %`;
  return `Synergie ${s.near}/${s.avail} · ${what}`;
}
export const SYNERGY_EFFECTS = [['speed', 'Schneller (Herstellen, Kochen, Wachsen)'], ['power', 'Mehr Strom'], ['quality', 'Stärkerer Buff']];
// the pairs to draw (a glowing link between two neighbours where at least one likes the other): [{ a: { ui, at }, b: { ui, at } }]
export function links(D, save) {
  const rig = save?.rig || save, mega = (rig?.units || []).some(u => u.pos), C = cells(D, rig, mega), out = [], seen = new Set();
  for (const c of C.values()) {
    if (!c.ws) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const n = C.get(`${c.x + dx},${c.y + dy}`);
      if (!n?.ws || (n.ui === c.ui && n.ws.at === c.ws.at)) continue;
      const likes = (a, b) => fits(D, (D.workshops?.[a.ws.id]?.synergy?.partners || []), b.ws.id);
      if (!likes(c, n) && !likes(n, c)) continue;
      const key = [`${c.ui}:${c.ws.at}`, `${n.ui}:${n.ws.at}`].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ a: { ui: c.ui, at: c.ws.at }, b: { ui: n.ui, at: n.ws.at } });
    }
  }
  return out;
}
