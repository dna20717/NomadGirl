// Cheat-Menü (#097, Daniel 19.11.2026: „600, aber ein Cheat-Menü nur für mich“). Unlocked per device: open the game once with
// ?cheats=1 (?cheats=0 locks it again); then the pause menu shows „Cheats“. Nothing about who you are goes into the public repo,
// the device remembers it (localStorage „nomadgirl-cheats“). No DOM here: the actions work on the savegame (browser and Node).
import { give } from './crafting.js';
import { advance } from './save.js';
import { ensureMap } from './worldmap.js';

const KEY = 'nomadgirl-cheats';
export function cheatsOn(search = globalThis.location?.search || '') {
  try {
    const q = new URLSearchParams(search).get('cheats');
    if (q === '1') localStorage.setItem(KEY, '1');
    if (q === '0') localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === '1';
  } catch { return false; }
}
// the cheats: [{ id, label, sub, act(D, save) → line }]
export const CHEATS = [
  { id: 'deltas50', label: '+50.000 Δ', sub: 'Viel Geld zum Testen', act: (D, save) => { save.deltas = (save.deltas || 0) + 50000; return '+50.000 Δ'; } },
  { id: 'deltas', label: '+1.000 Δ', sub: 'Geld', act: (D, save) => { save.deltas = (save.deltas || 0) + 1000; return '+1.000 Δ'; } },
  { id: 'res', label: '+10 jeder Ressource', sub: 'Technik, Wissen, Bio, Dunkelheit (ins Camp-Lager)', act: (D, save) => {
    const got = [];
    for (const r of Object.values(D.resources || {})) if (r.item && D.items?.[r.item]) { give(D, save, r.item, 10); got.push(r.name); }
    return `+10 ${got.join(', ')}`;
  } },
  { id: 'heal', label: 'Leben voll', sub: 'Leyla geheilt', act: (D, save) => { save.health = 9999; return 'Leben voll'; } },
  { id: 'tank', label: 'Tank 100 %', sub: 'AvAs Cryo-Tank frisch gewartet', act: (D, save) => { if (save.tank) { save.tank.cond = 100; save.tank.dead = false; } return 'Tank 100 %'; } },
  { id: 'fuel', label: 'Sprit und Vorräte voll', sub: '+50 l, +10 Rationen', act: (D, save) => { save.fuel = (save.fuel || 0) + 50; save.food = (save.food || 0) + 10; return '+50 l Sprit, +10 Vorräte'; } },
  { id: 'map', label: 'Alle Orte aufdecken', sub: 'Reisekarte', act: (D, save) => { const m = ensureMap(D, save); m.revealed = [...new Set([...(m.revealed || []), ...m.nodes.map(n => n.id)])]; return `${m.nodes.length} Orte aufgedeckt`; } },
  { id: 'time', label: 'Uhr +6 h', sub: 'Zeit vorspulen (Garten, Tank, Bewerber)', act: (D, save) => { advance(save, 6); return 'Uhr +6 h'; } },
];
export function runCheat(D, save, id) { const c = CHEATS.find(x => x.id === id); return c && save ? c.act(D, save) : null; }

// Daniel, 19.11.2026: „Geht nicht“ — the main menu opens the game as /game?camp, so ?cheats=1 was gone by the time the pause menu
// asked. Now the game reads it at start, and typing the word „deltas“ anywhere in the game unlocks the cheats too (and gives
// +50.000 Δ right away when a savegame is running). → stop()
export function watchCheatWord(onWord, word = 'deltas') {
  let buf = '';
  const f = e => {
    if (e.key?.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-word.length);
    if (buf === word) { buf = ''; try { localStorage.setItem(KEY, '1'); } catch { /* private window */ } onWord?.(); }
  };
  globalThis.document?.addEventListener('keydown', f, true);
  return () => globalThis.document?.removeEventListener('keydown', f, true);
}
