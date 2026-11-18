// Voraussetzungen (#059): what Leyla, AvA, the crew and the rig bring along decides which answers on the road are open. Since #068 a thin
// wrapper over the one condition language (game/conditions.js); the names stay for the callers (road_events.js, travel.js).
import { CREW_KEYS, hasCrew, crewParts } from './conditions.js';

export const NEED_KEYS = CREW_KEYS;
export const hasNeeds = hasCrew;
export const needsOf = crewParts;
// null = all there, else the reason („Braucht Schraube an Bord“)
export function needBlocked(D, save, o) {
  const miss = crewParts(D, save, o).filter(n => !n.ok);
  return miss.length ? `Braucht ${miss.map(n => `${n.name} ${n.what}`).join(' und ')}` : null;
}
// who makes it possible, for the button („Schraube · Den LKW flicken“)
export const needTag = (D, save, o) => crewParts(D, save, o).filter(n => n.ok).map(n => n.name).join(' + ');
