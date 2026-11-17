// The Glitchling duel (#050, Daniel 17.11.2026: „Schau dir das OPR-Firefight-System für Kämpfe an (ohne Schlagwörter, nur das reine
// Kampfsystem)“; „keine Regeln für Bewegungen … mehr wie ein Kartenspiel“; „wir starten einfach“). No DOM: the demo page (duel.html,
// game/duel_ui.js), later the game, tests and the simulation.
//
// Every fighter has four values: Präzision (hits on a d6 ≥ it), Abschirmung (blocks a hit on a d6 ≥ it), Integrität (wounds until it
// is overwritten) and Impulse (dice per attack: Einflüstern / Verschränken). The sides take turns activating one fighter; an activation
// is one action:
//   whisper   „Einflüstern“: attack with the remote impulses, no answer
//   link      „Verschränken“: attack with the link impulses, then the target answers with its own link impulses
//   calibrate „Kalibrieren“: no attack; a flickering fighter stops flickering
// At half its Integrität or below, a fighter that takes wounds tests on its Präzision; failed = it flickers („Flackern“: it can only
// calibrate and does not answer a link). A round ends when every fighter that stands has been activated.
//
//   fighter = { uid, side, kind: 'glitchling' | 'hunter', id, name, brand, g?, quality, defense, tough, remote, link, wounds, flicker, done, out }
//   duel    = { fighters, round, turn (side to act), starts (side that began this round), log: [event], winner: side | null }
import { config } from './glitchlings.js';

// names for now (Daniel, 17.11.2026: „sprechende Namen, sonst wirkt es unübersichtlich“); the flavour names Einflüstern / Verschränken /
// Kalibrieren can come back later
export const ACTIONS = [['whisper', 'Sicherer Angriff'], ['link', 'Harter Angriff'], ['calibrate', 'Stabilisieren']];
export const ACTION_SUBS = { whisper: 'ohne Gegenschlag', link: 'mehr Würfel, Ziel schlägt zurück', calibrate: 'kein Angriff, beendet Flackern' };
export const SIDES = ['player', 'enemy'];
const other = s => (s === 'player' ? 'enemy' : 'player');
const clampRoll = v => Math.max(2, Math.min(6, v | 0));

export function duelConfig(D) {
  const G = D.glitchlings || {}, d = G.duel || {};
  return { quality: (d.quality || []).map(x => x.q), defense: { cheap: 5, mid: 4, premium: 4, elite: 3, ...(d.defense || {}) }, tough: d.tough ?? 1, team: d.team ?? 2, hunters: (G.hunters || []).filter(h => h.id) };
}
// the values of a Glitchling: Präzision from its bits, Abschirmung from its maker's tier, Integrität = bits + Zähigkeit-Bonus, Impulse from the talent
export function statsOf(D, g) {
  const C = duelConfig(D), t = config(D).talents.find(x => x.name === g.talent) || {}, brand = g.brand || t.brand || null, tier = D.brands?.[brand]?.tier || 'mid';
  const bits = Math.max(1, Math.min(5, g.bits || 1));
  return { kind: 'glitchling', id: g.id, name: g.name, brand, g, quality: clampRoll(C.quality[bits - 1] ?? [5, 5, 4, 4, 3][bits - 1]), defense: clampRoll(C.defense[tier] ?? 4),
    tough: Math.max(1, bits + C.tough), remote: Math.max(0, t.remote ?? 1), link: Math.max(0, t.link ?? 2) };
}
export function hunterStats(h) {
  return { kind: 'hunter', id: h.id, name: h.name || h.id, brand: h.brand || null, quality: clampRoll(h.quality ?? 5), defense: clampRoll(h.defense ?? 4), tough: Math.max(1, h.tough ?? 3),
    remote: Math.max(0, h.remote ?? 1), link: Math.max(0, h.link ?? 1), description: h.description || '' };
}

// a new duel: two lists of fighter values; the player starts (Leyla attacks) unless first = 'enemy'
export function newDuel(player, enemy, first = 'player') {
  let n = 0;
  const mk = (s, side) => ({ ...s, uid: `${side[0]}${n++}`, side, wounds: 0, flicker: false, done: false, out: false });
  const duel = { fighters: [...player.map(s => mk(s, 'player')), ...enemy.map(s => mk(s, 'enemy'))], round: 1, turn: first, starts: first, log: [], winner: null };
  duel.log.push({ type: 'round', round: 1 });
  return duel;
}
export const standing = (duel, side) => duel.fighters.filter(f => !f.out && (!side || f.side === side));
export const ready = (duel, side) => standing(duel, side).filter(f => !f.done);
export const fighter = (duel, uid) => duel.fighters.find(f => f.uid === uid) || null;

// what a fighter may do now: [{ action, target? }]
export function options(duel, uid) {
  const f = fighter(duel, uid);
  if (!f || f.out || f.done || duel.winner || f.side !== duel.turn) return [];
  if (f.flicker) return [{ action: 'calibrate' }];
  const out = [];
  for (const t of standing(duel, other(f.side))) { if (f.remote > 0) out.push({ action: 'whisper', target: t.uid }); if (f.link > 0) out.push({ action: 'link', target: t.uid }); }
  out.push({ action: 'calibrate' });
  return out;
}

// ---------- dice ----------
// one attack: impulses dice on Präzision, the target rolls Abschirmung for every hit. → { rolls, hits, saves, wounds }
function attack(a, t, n, rnd) {
  const rolls = [], saves = [];
  for (let i = 0; i < n; i++) rolls.push(1 + Math.floor(rnd() * 6));
  const hits = rolls.filter(r => r === 6 || (r !== 1 && r >= a.quality)).length;
  for (let i = 0; i < hits; i++) saves.push(1 + Math.floor(rnd() * 6));
  const wounds = saves.filter(r => !(r === 6 || (r !== 1 && r >= t.defense))).length;
  return { rolls, hits, saves, wounds };
}
function hurt(duel, t, wounds, rnd, ev) {
  if (!wounds) return;
  t.wounds += wounds;
  if (t.wounds >= t.tough) { t.out = true; t.flicker = false; ev.push({ type: 'out', uid: t.uid }); return; }
  if (t.wounds * 2 >= t.tough && !t.flicker) {   // Selbsttest at half Integrität
    const r = 1 + Math.floor(rnd() * 6), ok = r === 6 || (r !== 1 && r >= t.quality);
    if (!ok) t.flicker = true;
    ev.push({ type: 'test', uid: t.uid, roll: r, ok });
  }
}

// carry out one action of the side whose turn it is → the events (also appended to duel.log)
export function act(duel, uid, action, target = null, rnd = Math.random) {
  const f = fighter(duel, uid), ok = options(duel, uid).some(o => o.action === action && (o.target ?? null) === (target ?? null));
  if (!ok) return null;
  const t = target && fighter(duel, target), ev = [{ type: 'act', uid, action, target }];
  if (action === 'calibrate') { if (f.flicker) { f.flicker = false; ev.push({ type: 'steady', uid }); } }
  else {
    const a = attack(f, t, action === 'whisper' ? f.remote : f.link, rnd);
    ev.push({ type: 'attack', uid, target, ...a });
    hurt(duel, t, a.wounds, rnd, ev);
    if (action === 'link' && !t.out && !t.flicker && t.link > 0) {   // the target answers (a flickering one does not)
      const b = attack(t, f, t.link, rnd);
      ev.push({ type: 'answer', uid: t.uid, target: f.uid, ...b });
      hurt(duel, f, b.wounds, rnd, ev);
    }
  }
  f.done = true;
  duel.log.push(...ev);
  advance(duel);
  return ev;
}
// whose turn is next; a new round when everyone standing has acted; the winner when a side has nobody left
function advance(duel) {
  for (const s of SIDES) if (!standing(duel, s).length) { duel.winner = other(s); duel.turn = null; duel.log.push({ type: 'end', winner: duel.winner }); return; }
  const next = other(duel.turn);
  if (ready(duel, next).length) { duel.turn = next; return; }
  if (ready(duel, duel.turn).length) return;
  for (const f of duel.fighters) f.done = false;
  duel.round++; duel.starts = other(duel.starts); duel.turn = duel.starts;
  duel.log.push({ type: 'round', round: duel.round });
}

// ---------- the AI ----------
const pHit = q => Math.min(5, Math.max(1, 7 - q)) / 6;
const pFail = d => Math.min(5, Math.max(1, d - 1)) / 6;
// chance that n dice with p each make at least k wounds
function atLeast(n, p, k) { if (k <= 0) return 1; let s = 0; for (let i = k; i <= n; i++) s += binom(n, i) * p ** i * (1 - p) ** (n - i); return s; }
const binom = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
const worth = f => f.tough * (f.remote + f.link + 1) * (7 - f.quality);   // how much a fighter matters
// the value of one option for the side that takes it (expected wounds, chance to overwrite, the answer of a link)
export function score(duel, uid, o) {
  const f = fighter(duel, uid);
  if (o.action === 'calibrate') return f.flicker ? 5 : -1;
  const t = fighter(duel, o.target), n = o.action === 'whisper' ? f.remote : f.link, p = pHit(f.quality) * pFail(t.defense), left = t.tough - t.wounds;
  let v = n * p + atLeast(n, p, left) * worth(t) * 0.25;
  if (o.action === 'link' && !t.flicker && t.link > 0) {
    const kill = atLeast(n, p, left), q = pHit(t.quality) * pFail(f.defense), back = t.link * q * (1 - kill);
    v -= back + atLeast(t.link, q, f.tough - f.wounds) * (1 - kill) * worth(f) * 0.25;
  }
  return v;
}
// the AI's choice for the side on turn: the best (fighter, option); noise 0 = always the best, more = looser (weak Glitchlings)
export function choose(duel, rnd = Math.random, noise = 0.15) {
  let best = null;
  for (const f of ready(duel, duel.turn)) for (const o of options(duel, f.uid)) {
    const v = score(duel, f.uid, o) + (rnd() - 0.5) * noise * 2;
    if (!best || v > best.v) best = { uid: f.uid, ...o, v };
  }
  return best;
}
// a whole duel without a picture (tests, balancing): → winner and rounds
export function play(duel, rnd = Math.random, noise = 0.15, max = 200) {
  for (let i = 0; i < max && !duel.winner; i++) { const c = choose(duel, rnd, noise); if (!c) break; act(duel, c.uid, c.action, c.target, rnd); }
  return { winner: duel.winner, rounds: duel.round };
}
// expected wounds of an option (the demo shows it on the target)
export function preview(duel, uid, o) {
  const f = fighter(duel, uid), t = o.target && fighter(duel, o.target);
  if (!t || o.action === 'calibrate') return null;
  const n = o.action === 'whisper' ? f.remote : f.link, p = pHit(f.quality) * pFail(t.defense);
  const out = { wounds: n * p, overwrite: atLeast(n, p, t.tough - t.wounds) };
  if (o.action === 'link' && t.link > 0) { const q = pHit(t.quality) * pFail(f.defense); out.answer = t.link * q * (1 - out.overwrite); }
  return out;
}
