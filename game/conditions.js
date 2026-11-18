// Eine Bedingungs-Sprache (#068, Daniel 18.11.2026, Eleganz-Prüfung Punkt 2: „drei Bedingungs-Sprachen“): what must be true for an
// answer on the road, a situation, a quest offer, in one place. No DOM. The fields stay where they were (no data migration):
//   Merker      needsFlag / needs (all of them, comma), notFlag / not (none of them)
//   Crew & Rig  needCompanion (on board), needWear (any part in that place, Leyla or AvA), needItem (exactly that, worn),
//               needRigSlot (a rig part in that slot), needRigPart (exactly that), needWorkshop (a workshop of that kind in the rig)
//   Zeit        minDay
// check(D, save, c) → { ok, why (first missing, for a greyed button), parts: [{ ok, name, what }] (for labels) }
const list = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
export const COND_KEYS = ['needsFlag', 'needs', 'notFlag', 'not', 'needCompanion', 'needWear', 'needItem', 'needRigSlot', 'needRigPart', 'needWorkshop', 'minDay'];
export const CREW_KEYS = ['needCompanion', 'needWear', 'needItem', 'needRigSlot', 'needRigPart', 'needWorkshop'];

const WEAR_NAMES = { head: 'Kopf', armor: 'Rüstung', eyes: 'Augen-Implantat', nerves: 'Nerven-Implantat', arm: 'Cyberarm', heart: 'Herz-Implantat', legs: 'Bein-Implantat', skin: 'Haut-Implantat',
  bow: 'AvA-Bug', tail: 'AvA-Heck', core: 'AvA-Kern', module: 'AvA-Modul' };
const RIG_NAMES = { engine: 'Motor', armor: 'Panzerung', weapon: 'Waffe am Rig', roof: 'Dach', solar: 'Solar' };
const FN_NAMES = { kitchen: 'Küche', cyber: 'Ripperdoc-Liege', drone: 'Drohnenwerkstatt', craft: 'Werkbank', cell: 'Zelle', guests: 'Gästekoje', garden: 'Hydrokultur', cistern: 'Zisterne',
  cooling: 'Kühlraum', warroom: 'Warroom', armory: 'Waffenkammer', engine: 'Motorraum', chill: 'Chill-Ecke', sleep: 'Schlafkoje', storage: 'Lager', tank: 'Cryo-Tank', jobs: 'Auftragsbüro', bitfarm: 'Bit-Farm' };

const flagsOf = save => new Set(save?.road?.flags || []);
const wear = save => save?.inv?.wear || {};
const rigParts = save => Object.entries(save?.rig?.parts || {}).flatMap(([slot, ids]) => (Array.isArray(ids) ? ids : [ids]).filter(Boolean).map(id => ({ slot, id })));
const benches = (D, save) => (save?.rig?.units || []).flatMap(u => u.workshops || []).map(w => D.workshops?.[w.id]).filter(Boolean);

export const hasConditions = c => !!c && COND_KEYS.some(k => c[k]);
export const hasCrew = c => !!c && CREW_KEYS.some(k => c[k]);

// the crew & rig part: every need → { ok, name, what }
export function crewParts(D, save, c) {
  const out = [];
  if (c.needCompanion) out.push({ ok: (save?.companions || []).includes(c.needCompanion), name: D.companions?.[c.needCompanion]?.name || c.needCompanion, what: 'an Bord' });
  if (c.needItem) out.push({ ok: Object.values(wear(save)).includes(c.needItem), name: D.items?.[c.needItem]?.name || c.needItem, what: 'eingebaut' });
  else if (c.needWear) { const id = wear(save)[c.needWear]; out.push({ ok: !!id, name: id ? D.items?.[id]?.name || WEAR_NAMES[c.needWear] : WEAR_NAMES[c.needWear] || c.needWear, what: 'eingebaut' }); }
  if (c.needRigPart) out.push({ ok: rigParts(save).some(p => p.id === c.needRigPart), name: D.rigParts?.[c.needRigPart]?.name || c.needRigPart, what: 'am Rig' });
  else if (c.needRigSlot) { const p = rigParts(save).find(x => x.slot === c.needRigSlot); out.push({ ok: !!p, name: p ? D.rigParts?.[p.id]?.name || p.id : RIG_NAMES[c.needRigSlot] || c.needRigSlot, what: 'am Rig' }); }
  if (c.needWorkshop) { const w = benches(D, save).find(x => x.function === c.needWorkshop); out.push({ ok: !!w, name: w?.name || FN_NAMES[c.needWorkshop] || c.needWorkshop, what: 'im Rig' }); }
  return out;
}
// everything
export function check(D, save, c = {}) {
  const F = flagsOf(save), parts = [];
  for (const f of [...list(c.needsFlag), ...list(c.needs)]) parts.push({ ok: F.has(f), name: `Merker ${f}`, what: 'gesetzt', flag: true });
  for (const f of [...list(c.notFlag), ...list(c.not)]) parts.push({ ok: !F.has(f), name: `Merker ${f}`, what: 'nicht gesetzt', flag: true });
  if (c.minDay) parts.push({ ok: (save?.day ?? 1) >= c.minDay, name: `Tag ${c.minDay}`, what: 'erreicht' });
  parts.push(...crewParts(D, save, c));
  const miss = parts.filter(p => !p.ok);
  return { ok: !miss.length, why: miss.length ? `Braucht ${miss.map(p => `${p.name} ${p.what}`).join(' und ')}` : null, parts };
}
export const ok = (D, save, c) => check(D, save, c).ok;
