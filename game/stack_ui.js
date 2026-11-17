// Demo „Bit-Stapel“ (#051): the Glitchling duel after the Knucklebones principle, from code. Rules: game/stack_duel.js, board: game/stack_view.js
// (the same board runs in the game as an overlay, game/play/glitch_duel_ui.js). Daniel, 17.11.2026: „nicht drei KIs gegeneinander, sondern
// jeweils eine, die wiederum 3 Pipelines hat … cyberpunkiger … Animation des Würfels mehr wie eine Slotmaschine“. duel.html shows it by default
// (?mode=stack), the older Gefecht with ?mode=fight.
import { loadProject } from '../engine/project.js';
import { browserLoader } from './browser_loader.js';
import { el } from './ui.js';
import { icon } from './icons.js';
import { generate } from './glitchlings.js';
import { duelConfig } from './duel.js';
import { RULES, newStack, play, noiseOf } from './stack_duel.js';
import { StackView } from './stack_view.js';

const TEMPO = { langsam: 1.6, normal: 1, schnell: 0.4 };
const rngOf = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export async function startStack(root, switchTo) {
  const project = await loadProject(browserLoader(new URL('projects/nomadgirl/', location.href)));
  const D = project.data, C = duelConfig(D), q = new URLSearchParams(location.search);
  const S = { rules: ['sum', 'hp'].includes(q.get('rules')) ? q.get('rules') : 'dot', foe: q.get('foe') || 'wild', seed: +(q.get('seed') || (1 + Math.floor(Math.random() * 99999))), core: +(q.get('core') || 0),
    auto: q.has('auto'), tempo: q.get('tempo') || 'normal', sim: '' };
  const view = new StackView(D, { redraw: () => draw(), tempo: () => TEMPO[S.tempo], auto: () => S.auto,
    endExtra: () => [el('button', { class: 'dl-main', onclick: () => { S.seed++; newGame(); } }, icon('restart', 16), 'Nächstes Duell')] });
  // the demo's handle (tests): S with the duel and the board's state mirrored
  Object.defineProperties(S, { duel: { get: () => view.duel }, busy: { get: () => view.busy, set: v => { view.busy = v; } }, last: { get: () => view.last, set: v => { view.last = v; } } });
  window.duelDemo = { S, D, view, mode: 'stack', newGame: () => newGame(), place: c => view.playerPlace(c), state: () => view.duel };
  const opts = () => ({ rules: S.rules, hp: S.rules === 'dot' ? (D.glitchlings?.duel?.stackHp ?? 50) : 25 });

  // Leyla's deck (three to pick from: her AI-Core for this duel) and the opponent: one wild Glitchling or one Kammerjäger
  function lineup() {
    const r = rngOf(S.seed), shuffle = a => a.map(x => [r(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const deck = shuffle(generate(D, S.seed)).slice(0, 3), used = new Set(deck.map(g => g.name));
    const h = C.hunters[Math.floor(r() * C.hunters.length)];
    const foe = S.foe === 'hunters' ? { id: h.id, name: h.name, brand: h.brand, hunter: true, bits: 5, description: h.description } : shuffle(generate(D, S.seed * 7 + 3)).find(g => !used.has(g.name));
    return { deck, me: deck[Math.min(S.core, deck.length - 1)], foe };
  }
  function newGame() {
    const { me, foe } = lineup();
    if (!me || !foe) { root.replaceChildren(el('div', { class: 'dl-boot err' }, el('b', {}, 'Keine Glitchlings für den Bit-Stapel.'), el('br'), el('small', {}, 'Bitte an Ava schicken.'))); return; }
    view.start(me, foe, opts());
  }
  addEventListener('keydown', e => { if (window.duelDemo?.mode === 'stack' && /^[1-3]$/.test(e.key)) view.playerPlace(Number(e.key) - 1); });

  function setup() {
    const sel = (label, key, opts, conv = v => v) => el('label', {}, el('small', {}, label), el('select', { onchange: e => { S[key] = conv(e.target.value); newGame(); } }, ...opts.map(([v, n]) => { const o = el('option', { value: v }, n); if (String(S[key]) === String(v)) o.selected = true; return o; })));
    const { deck } = lineup();
    return el('div', { class: 'dl-setup' },
      el('b', { class: 'dl-title' }, 'Bit-Stapel'), el('span', { class: 'dl-sub' }, 'Glitch-Duell · Demo'),
      el('button', { title: 'Das ältere Gefecht (OPR-Kern) zum Vergleich', onclick: () => switchTo('fight') }, icon('arrow_right', 15), 'Gefecht (alt)'),
      sel('Dein AI-Core', 'core', deck.map((g, i) => [i, `${g.name} (${g.talent}, ${g.bits} Bit)`]), Number),
      sel('Gegner', 'foe', [['wild', 'Wilde KI'], ['hunters', 'Kammerjäger']]),
      sel('Wertung', 'rules', RULES.map(([k, n]) => [k, k === 'dot' ? `${n} (neu)` : `${n} (alt)`])),
      el('label', {}, el('small', {}, 'Seed'), el('input', { type: 'number', value: S.seed, onchange: e => { S.seed = +e.target.value || 1; newGame(); } })),
      el('button', { onclick: () => { S.seed = 1 + Math.floor(Math.random() * 99999); newGame(); } }, icon('restart', 15), 'Neu würfeln'),
      el('label', { class: 'dl-check' }, el('input', { type: 'checkbox', checked: S.auto, onchange: e => { S.auto = e.target.checked; view.step(); } }), 'KI spielt für mich'),
      sel('Tempo', 'tempo', Object.keys(TEMPO).map(k => [k, k])),
      el('button', { title: 'Dieselbe Aufstellung 1000× von der KI ausspielen lassen', onclick: simulate }, icon('data', 15), '1000× simulieren'),
      S.sim ? el('small', { class: 'dl-sim' }, S.sim) : null);
  }
  function simulate() {
    const { me, foe } = lineup(), noise = { player: noiseOf(me), enemy: foe.hunter ? 0.05 : noiseOf(foe) };
    let won = 0, moves = 0;
    for (let i = 0; i < 1000; i++) { const r = play(newStack(me, foe, Math.random, 'player', opts()), Math.random, noise); if (r.winner === 'player') won++; moves += r.moves; }
    S.sim = `Du gewinnst ${Math.round(won / 10)} % · im Schnitt ${Math.round(moves / 2000)} Züge je Seite`; draw();
  }
  function rules() {
    const r = view.duel?.rules;
    if (r === 'dot') return el('p', { class: 'dl-rules' }, 'Beide KIs haben ', el('b', {}, `${view.duel.sides.player.max} Integrität`), ' und drei Pipelines. Das Bit rollt ein, du schickst es in eine Pipeline (Klick, Taste 1–3, oder ←/→ und E). ', el('b', {}, 'Paare und Drillinge feuern am Ende jedes deiner Züge'),
      ' (Blitz: Paar = Bitwert, Drilling = doppelt, Lieblingsbit legt seinen Wert obendrauf), bis der Gegner sie löscht. Ein Bit ', el('b', {}, 'löscht alle gleichen Bits in der Pipeline gegenüber'), ' und kostet den Gegner sofort ihre Augen. Wer auf 0 fällt, ist überschrieben. Volle Pipelines laufen über und werden geleert.');
    if (r === 'hp') return el('p', { class: 'dl-rules' }, 'Wertung Heilen: ein Bit zu gleichen Bits heilt (Wert × gleiche darunter), gelöschte Bits kosten den Gegner ihren Wert in seiner Pipeline. Wer auf 0 fällt, ist überschrieben.');
    return el('p', { class: 'dl-rules' }, 'Wertung Summe: gleiche Bits multiplizieren sich, gelöschte Bits fehlen dem Gegner; sind die Pipelines einer Seite voll, gewinnt die höhere Summe.');
  }
  function draw() { if (view.duel) root.replaceChildren(setup(), view.board(), rules()); }
  // arrows and E like the game's windows (ui_nav grammar)
  addEventListener('keydown', e => {
    if (window.duelDemo?.mode !== 'stack' || e.target.closest?.('select, input')) return;
    const a = { ArrowLeft: 'left', ArrowRight: 'right', a: 'left', d: 'right', e: 'ok', E: 'ok', Enter: 'ok', ' ': 'ok' }[e.key];
    if (a && view.nav({ pressed: x => x === a })) e.preventDefault();
  });
  newGame();
}
