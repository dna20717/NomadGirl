// Banter in the Bit-Stapel (Daniel, 18.11.2026: „Gib jeder KI außerdem einen Charakter und passend zu diesem Charakter einige Zeilen Text, so dass
// während des Spiels Banter entstehen kann“). No DOM: the board (stack_view.js) asks after every move who says what.
//
// Entities › Charaktere (data/glitchlings.json characters): id, name, description and lines per moment, several separated by „|“:
//   start (the duel begins), fire (its pairs fire), wipe (it wiped bits opposite), wiped (its bits were wiped), overflow (its pipelines ran
//   over), low (Integrität at 15 or below, once), win, lose. Generated Entities get a character from their name (always the same), the unique
//   ones their own; Kammerjäger speak as software, AvA as herself.
export const MOMENTS = [['start', 'Start'], ['fire', 'Feuer'], ['wipe', 'Löscht'], ['wiped', 'Gelöscht'], ['overflow', 'Überlauf'], ['low', 'Knapp'], ['win', 'Sieg'], ['lose', 'Niederlage']];
const SPECIAL = new Set(['kammerjaeger', 'ava', 'amber_slay', 'marble_sting']);
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const characters = D => (D.glitchlings?.characters || []).filter(c => c.id);

// the character of an Entity (an id of Entities › Charaktere)
export function characterOf(D, g) {
  const all = characters(D), has = id => all.some(c => c.id === id);
  if (g?.hunter) return has('kammerjaeger') ? 'kammerjaeger' : null;
  if (g?.id === 'ava' && has('ava')) return 'ava';
  if (g?.character && has(g.character)) return g.character;
  const unique = (D.glitchlings?.unique || []).find(u => u.name === g?.name);
  if (unique?.character && has(unique.character)) return unique.character;
  const plain = all.filter(c => !SPECIAL.has(c.id));
  return plain.length ? plain[hash(g?.name || g?.id) % plain.length].id : null;
}
export function linesOf(D, id, moment) {
  const c = characters(D).find(x => x.id === id);
  return String(c?.[moment] || '').split('|').map(s => s.trim()).filter(Boolean);
}
export function line(D, g, moment, rnd = Math.random) {
  const L = linesOf(D, characterOf(D, g), moment);
  return L.length ? L[Math.floor(rnd() * L.length)] : null;
}

// after a move: who says something → { side, text, moment } or null. Most important first: Integrität low (once per side), a wipe (the wiper
// or the wiped, half and half), an overflow, its pairs firing; „Banter-Chance“ % that anything is said at all (low always).
export function banter(D, duel, ev, rnd = Math.random) {
  if (!ev || ev.type !== 'place') return null;
  const other = s => (s === 'player' ? 'enemy' : 'player'), ai = s => duel.sides[s]?.ai, said = duel.lowSaid ??= {};
  const victim = other(ev.side), pick = (side, moment) => { const text = line(D, ai(side), moment, rnd); return text ? { side, text, moment } : null; };
  if (!duel.winner && duel.sides[victim].hp <= 15 && !said[victim]) { said[victim] = true; const b = pick(victim, 'low'); if (b) return b; }
  if (rnd() * 100 >= (D.glitchlings?.banter?.chance ?? 60)) return null;
  if (ev.destroyed) return rnd() < 0.5 ? pick(ev.side, 'wipe') : pick(victim, 'wiped');
  if (ev.overflow) return pick(ev.overflow, 'overflow');
  if (ev.fire) return pick(ev.side, 'fire');
  return null;
}
