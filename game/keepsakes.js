// Keepsakes in the cockpit (#142, Daniel 21.11.2026: „Ava setzt sie, aber basierend auf Ereignissen im Spiel (wie Achievements, aber
// weniger ‚groß‘, mit einer kleinen Unlock-Meldung)“). A piece of clutter, a thing hanging from the mirror or the driver's sun visor
// (Startseite › Cockpit) can name a counter of the achievements (counter, filter, target): it shows in the main menu once the global
// counts reach it, and the game says so once with a small note. Without a counter a piece is always there. No DOM: browser and Node.
//
//   save.achievements.keepsakes = [look]   the pieces this savegame has already announced
const keyOf = x => x.filter ? `${x.counter}:${x.filter}` : x.counter;

// every piece of the cockpit that can be unlocked: { look, counter, filter, target, note, where }
export function keepsakeList(D) {
  const C = D.splash?.cockpit || {}, out = [];
  for (const [where, rows] of [['clutter', C.clutter], ['hang', C.hang]]) for (const r of rows || []) if (r.look) out.push({ ...r, where });
  if (C.visor?.look) out.push({ ...C.visor, where: 'visor' });
  return out;
}
export const unlocked = (x, counts = {}) => !x.counter || (counts[keyOf(x)] || 0) >= (x.target || 1);

// the cockpit config with only the pieces that are unlocked (all = true: everything, e.g. ?stickers=all)
export function cockpitFor(C = {}, counts = {}, all = false) {
  if (all) return C;
  const keep = x => unlocked(x, counts);
  return { ...C, clutter: (C.clutter || []).filter(keep), hang: (C.hang || []).filter(keep), visor: C.visor && !keep(C.visor) ? { ...C.visor, at: null } : C.visor };
}

// newly reached pieces of this savegame, marked as announced → [{ look, name, note }]
export function newKeepsakes(D, save) {
  const A = (save.achievements ??= {}), seen = (A.keepsakes ??= []), counts = A.counts || {}, out = [];
  for (const x of keepsakeList(D)) {
    if (!x.counter || seen.includes(x.look) || !unlocked(x, counts)) continue;
    seen.push(x.look);
    out.push({ look: x.look, name: x.name || (D.assets?.[x.look]?.name || x.look).replace(/^Cockpit(-Kram)? · /, ''), note: x.note || '' });
  }
  return out;
}
