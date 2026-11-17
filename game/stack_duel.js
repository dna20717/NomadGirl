// „Bit-Stapel“: the Entity duel after the Knucklebones principle (#051, Daniel 17.11.2026: „Knucklebones klingt interessant. Mach uns
// mal eine abstrakte Demo mit unseren Glitchlingen“; before: the OPR duel „läuft zu stockend“, an duel should take 40–60 s).
// No DOM: the demo (duel.html › Bit-Stapel, game/stack_ui.js), tests, simulation.
//
// Each side has three columns, one per Entity, three places each. Whoever is on turn has a rolled bit (d6) and puts it into one
// of their columns with room. The value of a column: equal bits multiply (a value n times counts n × n × value), and the Entity's
// favourite bit counts double. Putting a bit destroys all bits of the same value in the opponent's opposite column. When one side's
// columns are all full, the duel ends; the higher total wins (draw: the side that did not fill up).
// Wertung „Integrität“ (Daniel, 17.11.2026: „das Duell geht nicht darum, wer die meisten Punkte hat, sondern wer die Lebenspunkte des anderen
// zuerst reduziert hat. Zwei oder mehr Würfel pro Säule erhöhen meine Punkte, während jeder zerstörte Würfel die des anderen reduziert“):
// each side has hp (25); a bit that joins k equal bits in its column heals bit × k (favourite: double); destroyed bits take from the
// opponent what they were worth in their column (colValue lost); hp 0 = overwritten. A side whose columns are all full on its turn
// overflows: its board is wiped (Überlauf). „Summe“ is the first version.
// Wertung „Dauerfeuer“ (the default; Daniel, 17.11.2026: „Integrität ein wenig erhöhen und dafür alle Paare und Trippel jeden Zug Schaden
// anrichten, bis sie zerstört werden. Lieblingsbits bekommen dann einen Bonus obendrauf“): 50 Integrität, no healing; at the end of its
// turn every group of equal bits fires at the opponent: bit × (count − 1) (pair = bit, triple = 2 × bit), a group of the favourite bit
// + bit on top; destroyed bits take their pips from the opponent at once.
//
//   side = { cols: [[values], [values], [values]], glitch: [glitchling | stats] }
//   duel = { sides: { player, enemy }, turn, die, log: [event], winner, moves }
export const COLS = 3, ROWS = 3;
const other = s => (s === 'player' ? 'enemy' : 'player');

// the favourite bit of an Entity: from its name (same Entity, same favourite); 0 = none
export function favourite(g) { let h = 7; for (const c of String(g?.name || g?.id || '')) h = (h * 31 + c.codePointAt(0)) >>> 0; return g ? 1 + (h % 6) : 0; }

// the value of one column (with the favourite of its Entity)
export function colValue(col, fav = 0) {
  const n = {};
  for (const v of col) n[v] = (n[v] || 0) + 1;
  let s = 0;
  for (const [v, k] of Object.entries(n)) s += Number(v) * k * k * (Number(v) === fav ? 2 : 1);
  return s;
}
export const total = side => side.cols.reduce((s, c, i) => s + colValue(c, side.fav[i]), 0);
export const full = side => side.cols.every(c => c.length >= ROWS);

export const RULES = [['dot', 'Dauerfeuer'], ['hp', 'Heilen'], ['sum', 'Summe']];
// what the groups of a side fire at the end of its turn
export function fireOf(side) {
  let t = 0;
  side.cols.forEach((col, i) => { const n = {}; for (const v of col) n[v] = (n[v] || 0) + 1; for (const [v, k] of Object.entries(n)) if (k >= 2) t += Number(v) * (k - 1) + (Number(v) === side.fav[i] ? Number(v) : 0); });
  return t;
}
export const colFire = (side, i) => fireOf({ cols: [side.cols[i]], fav: [side.fav[i]] });
export function newStack(player, enemy, rnd = Math.random, first = 'player', { rules = 'dot', hp = 50 } = {}) {
  // one AI per side with three pipelines (Daniel, 17.11.2026: „nicht drei KIs gegeneinander, sondern jeweils eine, die wiederum 3 Pipelines
  // hat“): a single Entity has one favourite bit for all its pipelines; a list (the first version) gives one per column
  const mk = x => {
    const one = !Array.isArray(x), list = one ? [x, x, x] : x;
    return { ai: one ? x : null, cols: Array.from({ length: COLS }, () => []), glitch: list.slice(0, COLS), fav: Array.from({ length: COLS }, (_, i) => favourite(list[i])), hp, max: hp };
  };
  return { sides: { player: mk(player), enemy: mk(enemy) }, turn: first, die: roll(rnd), log: [], winner: null, moves: 0, rules };
}
// what a bit heals in a column: bit × the equal bits already there (favourite: double)
export function healOf(side, c, die) { const k = side.cols[c].filter(v => v === die).length; return k ? die * k * (die === side.fav[c] ? 2 : 1) : 0; }
const roll = rnd => 1 + Math.floor(rnd() * 6);
export const open = (duel, side = duel.turn) => duel.sides[side].cols.map((c, i) => (c.length < ROWS ? i : -1)).filter(i => i >= 0);

// what putting the die into column c would do (for the AI and the preview): own gain, opponent's loss, destroyed count
export function preview(duel, c, side = duel.turn, die = duel.die) {
  const me = duel.sides[side], op = duel.sides[other(side)];
  const before = colValue(me.cols[c], me.fav[c]), after = colValue([...me.cols[c], die], me.fav[c]);
  const left = op.cols[c].filter(v => v !== die), lost = colValue(op.cols[c], op.fav[c]) - colValue(left, op.fav[c]);
  const destroyed = op.cols[c].length - left.length;
  const fireBefore = fireOf(me), fireAfter = fireOf({ cols: me.cols.map((x, i) => (i === c ? [...x, die] : x)), fav: me.fav });
  const theirBefore = fireOf(op), theirAfter = fireOf({ cols: op.cols.map((x, i) => (i === c ? left : x)), fav: op.fav });
  return { gain: after - before, lost, destroyed, heal: healOf(me, c, die), hit: destroyed * die, fire: fireAfter, fireUp: fireAfter - fireBefore, silenced: theirBefore - theirAfter };
}

// put the die of the side on turn into column c → events; then the other side rolls (or the duel ends)
export function place(duel, c, rnd = Math.random) {
  if (duel.winner || !open(duel).includes(c)) return null;
  const side = duel.turn, me = duel.sides[side], op = duel.sides[other(side)], die = duel.die, pv = preview(duel, c);
  me.cols[c].push(die);
  op.cols[c] = op.cols[c].filter(v => v !== die);
  const ev = { type: 'place', side, col: c, die, gain: pv.gain, destroyed: pv.destroyed, lost: pv.lost, heal: 0, damage: 0 };
  duel.log.push(ev); duel.moves++;
  if (duel.rules === 'dot') {
    ev.damage = pv.hit; ev.fire = pv.fire;
    op.hp = Math.max(0, op.hp - pv.hit - pv.fire);
    if (op.hp <= 0) { duel.winner = side; duel.turn = null; duel.die = null; duel.log.push({ type: 'end', winner: side, hp: { [side]: me.hp, [other(side)]: 0 } }); return ev; }
    duel.turn = other(side); duel.die = roll(rnd);
    if (!open(duel).length) { duel.sides[duel.turn].cols = Array.from({ length: COLS }, () => []); duel.log.push({ type: 'overflow', side: duel.turn }); ev.overflow = duel.turn; }
    return ev;
  }
  if (duel.rules === 'hp') {
    ev.heal = pv.heal; ev.damage = pv.lost;
    me.hp += pv.heal; op.hp = Math.max(0, op.hp - pv.lost);
    if (op.hp <= 0) { duel.winner = side; duel.turn = null; duel.die = null; duel.log.push({ type: 'end', winner: side, hp: { [side]: me.hp, [other(side)]: 0 } }); return ev; }
    duel.turn = other(side); duel.die = roll(rnd);
    if (!open(duel).length) { duel.sides[duel.turn].cols = Array.from({ length: COLS }, () => []); duel.log.push({ type: 'overflow', side: duel.turn }); ev.overflow = duel.turn; }   // Überlauf
    return ev;
  }
  if (full(me)) {
    const a = total(me), b = total(op);
    duel.winner = a > b ? side : other(side);   // a draw goes to the side that did not fill up
    duel.turn = null; duel.die = null;
    duel.log.push({ type: 'end', winner: duel.winner, score: { [side]: a, [other(side)]: b } });
  } else { duel.turn = other(side); duel.die = roll(rnd); }
  return ev;
}

// ---------- the AI ----------
// greedy with a look at the danger: own gain + what it takes from the opponent, minus how exposed the column becomes
// (the opponent's next bit could hit equal values there). noise 0 = always the best (strong Entities), more = looser
export function choose(duel, rnd = Math.random, noise = 0.15) {
  const side = duel.turn, me = duel.sides[side];
  let best = null;
  for (const c of open(duel)) {
    const pv = preview(duel, c), col = [...me.cols[c], duel.die];
    // expected loss from the opponent's next bit: for every face, what it would wipe in this column
    let risk = 0;
    for (let f = 1; f <= 6; f++) if (col.includes(f) && duel.sides[other(side)].cols[c].length < ROWS) risk += (colValue(col, me.fav[c]) - colValue(col.filter(v => v !== f), me.fav[c])) / 6;
    const v = duel.rules === 'dot' ? pv.fireUp * 1.6 + pv.silenced * 1.8 + pv.hit - risk * 0.25 + (rnd() - 0.5) * noise * 16
      : (duel.rules === 'hp' ? pv.heal * 1.3 : pv.gain) + pv.lost * 1.1 - risk * 0.5 + (rnd() - 0.5) * noise * 20;
    if (!best || v > best.v) best = { col: c, v };
  }
  return best;
}
// a whole duel without a picture → winner, moves, score
export function play(duel, rnd = Math.random, noise = { player: 0.15, enemy: 0.15 }) {
  for (let i = 0; i < 400 && !duel.winner; i++) { const c = choose(duel, rnd, typeof noise === 'number' ? noise : noise[duel.turn]); place(duel, c.col, rnd); }
  return { winner: duel.winner, moves: duel.moves, score: duel.log.at(-1)?.score };
}
// the AI's sharpness from the bits of its Entities: more bits, less noise
export const noiseOf = x => { const list = Array.isArray(x) ? x : [x]; return Math.max(0.02, 0.35 - (list.reduce((s, g) => s + (g?.bits || 1), 0) / Math.max(1, list.length)) * 0.06); };
