// Voraussetzungen (#059, Daniel 18.11.2026: „Antworten verlangen ein Implantat, einen Companion an Bord, ein AvA-Anbauteil, ein Rig-Teil
// oder eine Werkstatt im Rig“): what Leyla, AvA, the crew and the rig bring along decides which answers on the road are open.
// No DOM; used by road_events.js (labels) and travel.js (blocked).
//   need fields on an answer / option: needCompanion (id), needWear (slot: eyes, nerves … bow, core …), needItem (worn item id),
//   needRigSlot (engine, armor, weapon, roof), needRigPart (id), needWorkshop (function: kitchen, cyber, drone …)
export const NEED_KEYS = ['needCompanion', 'needWear', 'needItem', 'needRigSlot', 'needRigPart', 'needWorkshop'];
const WEAR_NAMES = { head: 'Kopf', armor: 'Rüstung', eyes: 'Augen-Implantat', nerves: 'Nerven-Implantat', arm: 'Cyberarm', heart: 'Herz-Implantat', legs: 'Bein-Implantat', skin: 'Haut-Implantat',
  bow: 'AvA-Bug', tail: 'AvA-Heck', core: 'AvA-Kern', module: 'AvA-Modul' };
const RIG_NAMES = { engine: 'Motor', armor: 'Panzerung', weapon: 'Waffe am Rig', roof: 'Dach', solar: 'Solar' };
const FN_NAMES = { kitchen: 'Küche', cyber: 'Ripperdoc-Liege', drone: 'Drohnenwerkstatt', craft: 'Werkbank', cell: 'Zelle', guests: 'Gästekoje', garden: 'Hydrokultur', cistern: 'Zisterne',
  cooling: 'Kühlraum', warroom: 'Warroom', armory: 'Waffenkammer', engine: 'Motorraum', chill: 'Chill-Ecke', sleep: 'Schlafkoje', storage: 'Lager', tank: 'Cryo-Tank', jobs: 'Auftragsbüro' };

export const hasNeeds = o => NEED_KEYS.some(k => o?.[k]);
const wear = save => save?.inv?.wear || {};
const rigParts = save => Object.entries(save?.rig?.parts || {}).flatMap(([slot, ids]) => (Array.isArray(ids) ? ids : [ids]).filter(Boolean).map(id => ({ slot, id })));
const benches = (D, save) => (save?.rig?.units || []).flatMap(u => u.workshops || []).map(w => D.workshops?.[w.id]).filter(Boolean);

// every need of an option → [{ ok, name }] (name: who or what does it, for the label and the reason)
export function needsOf(D, save, o) {
  const out = [];
  if (o.needCompanion) out.push({ ok: (save?.companions || []).includes(o.needCompanion), name: D.companions?.[o.needCompanion]?.name || o.needCompanion, what: 'an Bord' });
  if (o.needItem) out.push({ ok: Object.values(wear(save)).includes(o.needItem), name: D.items?.[o.needItem]?.name || o.needItem, what: 'eingebaut' });
  else if (o.needWear) { const id = wear(save)[o.needWear]; out.push({ ok: !!id, name: id ? D.items?.[id]?.name || WEAR_NAMES[o.needWear] : WEAR_NAMES[o.needWear] || o.needWear, what: 'eingebaut' }); }
  if (o.needRigPart) out.push({ ok: rigParts(save).some(p => p.id === o.needRigPart), name: D.rigParts?.[o.needRigPart]?.name || o.needRigPart, what: 'am Rig' });
  else if (o.needRigSlot) { const p = rigParts(save).find(x => x.slot === o.needRigSlot); out.push({ ok: !!p, name: p ? D.rigParts?.[p.id]?.name || p.id : RIG_NAMES[o.needRigSlot] || o.needRigSlot, what: 'am Rig' }); }
  if (o.needWorkshop) { const w = benches(D, save).find(x => x.function === o.needWorkshop); out.push({ ok: !!w, name: w?.name || FN_NAMES[o.needWorkshop] || o.needWorkshop, what: 'im Rig' }); }
  return out;
}
// null = all there, else the reason („Braucht Schraube an Bord“)
export function needBlocked(D, save, o) {
  const miss = needsOf(D, save, o).filter(n => !n.ok);
  return miss.length ? `Braucht ${miss.map(n => `${n.name} ${n.what}`).join(' und ')}` : null;
}
// who makes it possible, for the button („Schraube · Den LKW flicken“)
export const needTag = (D, save, o) => needsOf(D, save, o).filter(n => n.ok).map(n => n.name).join(' + ');
