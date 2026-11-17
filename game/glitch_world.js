// Glitchlings in the world (#052, Daniel 17.11.2026: „alle Hebel, die Türen öffnen, durch Schalter ersetzen, die man erst bedienen kann, wenn
// man ein Duell ausgetragen hat. Dabei geht es nicht darum, zwangsläufig zu gewinnen. Das Gewinnen ist nur dafür da, die KI zu fangen … KIs in
// verschiedenen anderen Dingen versteckt, so dass, wenn man da vorbeigeht, durch die normale Aktionsbelegung das Duell-Event getriggert wird“).
// No DOM: which Glitchling lives where (switches, machines with Marken-Clutter „KI“), Leyla's AI-Cores, catching.
//
// save.glitch = { caught: [names] }   (a host's duel counts for one run: the level remembers it, poi_level.js)
import { generate } from './glitchlings.js';
import { add } from './inventory.js';

const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const glitchState = save => (save.glitch ??= { caught: [] });

// AvA steps in as the core when the deck is empty (⚠️ vorläufig): her drone mind, two bits
export const AVA_CORE = { id: 'ava', name: 'AvA Core', talent: 'Drohnenflüsterer', bits: 2, brand: null, quirkKind: 'mood', stat: 'battery' };

// the cores Leyla can send: the Glitchlings in her cyberdeck (the AI-Core places), else AvA
export function cores(save) {
  const list = (save?.inv?.grids?.deck?.items || []).filter(e => e.g).map(e => e.g);
  return list.length ? list : [AVA_CORE];
}
// the wild Glitchling living in a host (a switch, a machine): the Durchgang's set, by the host's key; caught ones do not come again
export function foeFor(D, save, key) {
  const seed = (save?.map?.seed ?? 0) + (save?.cycle || 1) * 7919, all = generate(D, seed || 1, Math.max(12, D.glitchlings?.count || 12));
  const caught = new Set(glitchState(save || {}).caught), mine = new Set(cores(save).map(g => g.name));
  // the hand-made unique ones are not found in any switch or machine (they have their own places, design.md)
  const free = all.filter(g => !g.unique && !caught.has(g.name) && !mine.has(g.name));
  const list = free.length ? free : all;
  return list[hash(key) % list.length];
}
// a won duel against a wild one: it goes into the cyberdeck if there is a free AI-Core place, else the backpack, else the Camp-Lager.
// → where it went ('deck' | 'backpack' | 'camp') or null (nowhere room: it gets away)
export function catchGlitchling(D, save, g) {
  const G = glitchState(save), grids = save?.inv?.grids || {};
  for (const k of ['deck', 'backpack', 'camp']) if (grids[k] && add(D, grids[k], 'items', 'glitchling', 1, { g }) === 0) { if (!G.caught.includes(g.name)) G.caught.push(g.name); return k; }
  return null;
}
