// Demo „Bit-Stapel“ (#051): the Glitchling duel after the Knucklebones principle, as an abstract board from code. Rules: game/stack_duel.js.
// duel.html shows it by default (?mode=stack), the older Gefecht (OPR) with ?mode=fight. One click per turn: the bit is already rolled,
// click a column (or keys 1–3); the AI answers at once.
import { loadProject } from '../engine/project.js';
import { browserLoader } from './browser_loader.js';
import { el } from './ui.js';
import { icon } from './icons.js';
import { generate } from './glitchlings.js';
import { faceCanvas } from './glitch_face.js';
import { duelConfig } from './duel.js';
import { COLS, ROWS, RULES, colFire, newStack, place, choose, preview, colValue, total, open, play, noiseOf } from './stack_duel.js';

const TEMPO = { langsam: 1.6, normal: 1, schnell: 0.4 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rngOf = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export async function startStack(root, switchTo) {
  const project = await loadProject(browserLoader(new URL('projects/nomadgirl/', location.href)));
  const D = project.data, C = duelConfig(D), q = new URLSearchParams(location.search);
  const S = { rules: ['sum', 'hp'].includes(q.get('rules')) ? q.get('rules') : 'dot', foe: q.get('foe') || 'wild', seed: +(q.get('seed') || (1 + Math.floor(Math.random() * 99999))), auto: q.has('auto'), tempo: q.get('tempo') || 'normal', duel: null, busy: false, last: null, hover: null, sim: '', faces: {} };
  window.duelDemo = { S, D, mode: 'stack', newGame: () => newGame(), place: c => playerPlace(c), state: () => S.duel };

  function teams() {
    const r = rngOf(S.seed), shuffle = a => a.map(x => [r(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const player = shuffle(generate(D, S.seed)).slice(0, COLS), used = new Set(player.map(g => g.name));
    const enemy = S.foe === 'hunters' ? Array.from({ length: COLS }, (_, i) => { const h = C.hunters[Math.floor(r() * C.hunters.length)]; return { id: h.id + i, name: h.name, brand: h.brand, hunter: true, bits: 3 }; })
      : shuffle(generate(D, S.seed * 7 + 3)).filter(g => !used.has(g.name)).slice(0, COLS);
    return { player, enemy };
  }
  const opts = () => ({ rules: S.rules, hp: S.rules === 'dot' ? (D.glitchlings?.duel?.stackHp ?? 50) : 25 });
  function newGame() {
    const { player, enemy } = teams();
    if (player.length < COLS || enemy.length < COLS) { root.replaceChildren(el('div', { class: 'dl-boot err' }, el('b', {}, 'Zu wenige Glitchlings für den Bit-Stapel.'), el('br'), el('small', {}, 'Bitte an Ava schicken.'))); return; }
    S.duel = newStack(player, enemy, Math.random, 'player', opts()); S.duel.noise = { player: noiseOf(player), enemy: S.foe === 'hunters' ? 0.05 : noiseOf(enemy) };
    S.last = null; S.busy = false; S.faces = {}; S.hover = null;
    draw(); step();
  }
  async function step() {
    const d = S.duel;
    if (!d || d.winner) return draw();
    if (S.busy) return;   // a turn is already running (e.g. „KI spielt für mich“ switched on meanwhile)
    if (d.turn === 'enemy' || S.auto) {
      S.busy = true; draw();
      await sleep(700 * TEMPO[S.tempo]);
      if (d !== S.duel || d.winner) return;
      const c = choose(d, Math.random, d.noise[d.turn]);
      S.busy = false;
      return go(c.col);
    }
    draw();
  }
  async function go(c) {
    const d = S.duel, ev = place(d, c);
    if (!ev) return;
    S.last = ev; S.busy = true; draw();
    await sleep((ev.destroyed ? 650 : 380) * TEMPO[S.tempo]);
    if (d !== S.duel) return;
    S.busy = false; step();
  }
  function playerPlace(c) { const d = S.duel; if (!d || d.winner || S.busy || S.auto || d.turn !== 'player' || !open(d).includes(c)) return false; go(c); return true; }
  addEventListener('keydown', e => { if (window.duelDemo?.mode === 'stack' && /^[1-3]$/.test(e.key)) playerPlace(Number(e.key) - 1); });

  // ---------- drawing ----------
  const die = (v, cls = '') => el('span', { class: 'sb-die ' + cls }, ...Array.from({ length: 9 }, (_, i) => el('i', { class: PIPS[v].includes(i) ? 'p' : '' })));
  function face(side, i, g) { const k = side + i; return S.faces[k] ??= faceCanvas(g.hunter ? { id: g.id, name: g.name, hunter: true } : g, 56); }
  function column(side, i) {
    const d = S.duel, me = d.sides[side], col = me.cols[i], g = me.glitch[i], fav = me.fav[i], b = D.brands?.[g.brand];
    const mine = side === 'player', canPick = mine && d.turn === 'player' && !S.auto && !S.busy && !d.winner && col.length < ROWS;
    const L = S.last, justPut = L && L.side === side && L.col === i, hit = L && L.side !== side && L.col === i && L.destroyed;
    // the preview is drawn always and shown by CSS on hover (a redraw on hover would rebuild the column under the mouse)
    const pv = canPick ? preview(d, i) : null, threat = !mine && d.turn === 'player' && !S.auto ? d.die : null;
    const counts = {}; for (const v of col) counts[v] = (counts[v] || 0) + 1;
    const slots = Array.from({ length: ROWS }, (_, k) => {
      const v = col[k];
      if (v == null) return el('span', { class: 'sb-slot' + (pv && k === col.length ? ' ghost' : '') }, pv && k === col.length ? die(d.die, 'ghost') : null);
      return el('span', { class: 'sb-slot' }, die(v, [counts[v] > 1 ? `x${counts[v]}` : '', v === fav ? 'fav' : '', justPut && k === col.length - 1 ? 'new' : '', threat === v ? 'will' : ''].filter(Boolean).join(' ')));
    });
    if (!mine) slots.reverse();   // the enemy's columns grow down towards the middle
    const head = el('div', { class: 'sb-head' }, face(side, i, g), el('b', {}, g.name), el('small', { style: b?.color ? `color:${b.color}` : '' }, g.hunter ? `Kammerjäger · ${b?.name || ''}` : `${g.talent} · ${b?.name || ''}`),
      fav ? el('small', { class: 'sb-fav', title: 'Lieblingsbit: zählt in dieser Spalte doppelt' }, '♥ ', die(fav, 'mini')) : el('small', { class: 'sb-fav' }, 'ohne Lieblingsbit'));
    const hpMode = d.rules === 'hp', dot = d.rules === 'dot', fire = dot ? colFire(me, i) : 0;
    const value = el('div', { class: 'sb-value', title: hpMode ? 'Wert der Spalte: so viel kostet es dich, wenn der Gegner sie leert' : 'Wert der Spalte' }, String(colValue(col, fav)),
      pv && d.rules === 'sum' ? el('small', { class: 'sb-gain' }, ` +${pv.gain}`) : null, pv && hpMode && pv.heal ? el('small', { class: 'sb-gain' }, ` ♥+${pv.heal}`) : null,
      dot && fire ? el('small', { class: 'sb-fire', title: 'Dauerfeuer: so viel Schaden macht diese Spalte am Ende jedes eigenen Zugs' }, icon('flash', 16), String(fire)) : null, pv && dot && pv.fireUp ? el('small', { class: 'sb-gain' }, ' +', icon('flash', 14), String(pv.fireUp)) : null);
    const c = el('div', { class: ['sb-col', side, canPick ? 'pick' : '', hit ? 'hit' : '', justPut ? 'put' : ''].filter(Boolean).join(' '), 'data-col': i,
      onmouseenter: () => { if (canPick) c.closest('.sb-board')?.classList.add('hover-' + i); }, onmouseleave: () => c.closest('.sb-board')?.classList.remove('hover-' + i), onclick: () => playerPlace(i) },
      ...(mine ? [el('div', { class: 'sb-stack' }, ...slots), value, head] : [head, value, el('div', { class: 'sb-stack' }, ...slots)]),
      pv && pv.destroyed ? el('div', { class: 'sb-tip' }, `zerstört ${pv.destroyed} × `, die(d.die, 'mini'), dot ? ` · −${pv.hit}${pv.silenced ? `, sein Feuer −${pv.silenced}` : ''}` : hpMode ? ` · Gegner −${pv.lost} Integrität` : ` drüben (−${pv.lost})`) : null);
    return c;
  }
  function hpBar(side) {
    const sd = S.duel.sides[side], L = S.last, w = Math.max(0, Math.min(100, sd.hp / sd.max * 100));
    const hurt = L ? (L.damage || 0) + (L.fire || 0) : 0, delta = L ? (L.side === side ? (L.heal ? `+${L.heal}` : '') : (hurt ? `−${hurt}` : '')) : '';
    return el('div', { class: 'sb-hp ' + side, title: 'Integrität' }, el('i', { style: `width:${w}%` }), el('small', {}, side === 'player' ? 'Du' : 'Gegner'), el('b', {}, `${sd.hp}`), delta ? el('span', { class: 'sb-delta ' + (delta[0] === '+' ? 'up' : 'down') }, delta) : null);
  }
  function middle() {
    const d = S.duel, hpMode = d.rules !== 'sum', p = hpMode ? d.sides.player.hp : total(d.sides.player), e = hpMode ? d.sides.enemy.hp : total(d.sides.enemy), L = S.last;
    if (d.winner) return el('div', { class: 'sb-mid end ' + d.winner }, el('b', {}, d.winner === 'player' ? (S.foe === 'hunters' ? 'Gewonnen: das Gerät gehört dir' : 'Gewonnen: gefangen!') : 'Verloren: deine Glitchlings sind erschöpft'),
      el('span', { class: 'sb-score' }, hpMode ? `Integrität ${p} : ${e}` : `${p} : ${e}`), el('button', { class: 'dl-main', onclick: () => { S.seed++; newGame(); } }, icon('restart', 16), 'Nächstes Duell'));
    const mine = d.turn === 'player', who = s => (s === 'player' ? 'Du' : 'Gegner');
    const say = !L ? 'Klick eine deiner Spalten (oder Taste 1–3).' : `${who(L.side)}: ${L.die} in Spalte ${L.col + 1}` + (L.heal ? ` · heilt ${L.heal}` : '') + (L.destroyed ? ` · ${L.destroyed} drüben zerstört${hpMode ? `, −${L.damage}` : ''}!` : '') + (L.fire ? ` · Dauerfeuer −${L.fire}` : '') + (L.overflow ? ` · Überlauf: ${L.overflow === 'player' ? 'deine' : 'seine'} Spalten waren voll und sind gelöscht` : '');
    return el('div', { class: 'sb-mid' }, hpMode ? hpBar('enemy') : el('span', { class: 'sb-score enemy' }, String(e)),
      el('div', { class: 'sb-roll ' + (mine ? 'player' : 'enemy') }, el('small', {}, mine ? (S.auto ? 'Deine KI würfelt' : 'Dein Bit') : 'Gegner würfelt'), die(d.die, 'big')),
      hpMode ? hpBar('player') : el('span', { class: 'sb-score player' }, String(p)), el('div', { class: 'sb-say' }, say));
  }
  function setup() {
    const sel = (label, key, opts) => el('label', {}, el('small', {}, label), el('select', { onchange: e => { S[key] = e.target.value; newGame(); } }, ...opts.map(([v, n]) => { const o = el('option', { value: v }, n); if (String(S[key]) === String(v)) o.selected = true; return o; })));
    return el('div', { class: 'dl-setup' },
      el('b', { class: 'dl-title' }, 'Bit-Stapel'), el('span', { class: 'dl-sub' }, 'Glitch-Duell · Demo'),
      el('button', { title: 'Das ältere Gefecht (OPR-Kern) zum Vergleich', onclick: () => switchTo('fight') }, icon('arrow_right', 15), 'Gefecht (alt)'),
      sel('Wertung', 'rules', RULES.map(([k, n]) => [k, k === 'dot' ? `${n} (neu)` : `${n} (alt)`])),
      sel('Gegner', 'foe', [['wild', 'Wilde Glitchlings'], ['hunters', 'Kammerjäger']]),
      el('label', {}, el('small', {}, 'Seed'), el('input', { type: 'number', value: S.seed, onchange: e => { S.seed = +e.target.value || 1; newGame(); } })),
      el('button', { onclick: () => { S.seed = 1 + Math.floor(Math.random() * 99999); newGame(); } }, icon('restart', 15), 'Neu würfeln'),
      el('label', { class: 'dl-check' }, el('input', { type: 'checkbox', checked: S.auto, onchange: e => { S.auto = e.target.checked; step(); } }), 'KI spielt für mich'),
      sel('Tempo', 'tempo', Object.keys(TEMPO).map(k => [k, k])),
      el('button', { title: 'Dieselbe Aufstellung 1000× von der KI ausspielen lassen', onclick: simulate }, icon('data', 15), '1000× simulieren'),
      S.sim ? el('small', { class: 'dl-sim' }, S.sim) : null);
  }
  function simulate() {
    const { player, enemy } = teams(), noise = { player: noiseOf(player), enemy: S.foe === 'hunters' ? 0.05 : noiseOf(enemy) };
    let won = 0, moves = 0;
    for (let i = 0; i < 1000; i++) { const r = play(newStack(player, enemy, Math.random, 'player', opts()), Math.random, noise); if (r.winner === 'player') won++; moves += r.moves; }
    S.sim = `Du gewinnst ${Math.round(won / 10)} % · im Schnitt ${Math.round(moves / 2000)} Züge je Seite`; draw();
  }
  function draw() {
    const d = S.duel;
    if (!d) return;
    root.replaceChildren(setup(),
      el('div', { class: 'sb-board' }, el('div', { class: 'sb-row enemy' }, ...Array.from({ length: COLS }, (_, i) => column('enemy', i))), middle(),
        el('div', { class: 'sb-row player' }, ...Array.from({ length: COLS }, (_, i) => column('player', i)))),
      (S.duel.rules === 'dot'
        ? el('p', { class: 'dl-rules' }, 'Beide haben ', el('b', {}, `${S.duel.sides.player.max} Integrität`), '. Du hast ein gewürfeltes Bit und legst es in eine deiner drei Spalten. ', el('b', {}, 'Paare und Drillinge feuern am Ende jedes deiner Züge'),
          ' (Blitz-Symbol: Paar = Bitwert, Drilling = doppelt, Lieblingsbit ♥ legt seinen Wert obendrauf), bis der Gegner sie zerstört. Ein gelegtes Bit ', el('b', {}, 'zerstört alle gleichen Bits gegenüber'), ' und kostet den Gegner sofort ihre Augen. Wer auf 0 fällt, ist überschrieben. Sind deine Spalten voll, läuft der Speicher über und wird gelöscht.')
        : S.duel.rules === 'hp'
        ? el('p', { class: 'dl-rules' }, 'Beide haben ', el('b', {}, `${S.duel.sides.player.max} Integrität`), '. Du hast ein gewürfeltes Bit und legst es in eine deiner drei Spalten. ', el('b', {}, 'Ein Bit zu gleichen Bits heilt dich'), ' (Wert × gleiche darunter, Lieblingsbit doppelt). Legst du ein Bit, ',
          el('b', {}, 'zerstört es alle gleichen Bits gegenüber'), ', und der Gegner verliert, was sie in seiner Spalte wert waren (gleiche multiplizieren sich: zwei Vieren = 16). Wer auf 0 fällt, ist überschrieben. Sind deine Spalten voll, läuft der Speicher über und wird gelöscht.')
        : el('p', { class: 'dl-rules' }, 'Du hast ein gewürfeltes Bit und legst es in eine deiner drei Spalten, eine je Glitchling. ', el('b', {}, 'Gleiche Bits in einer Spalte multiplizieren sich'), ' (zweimal die 4 zählt 4 × 2 × 2 = 16), das ',
        el('b', {}, 'Lieblingsbit'), ' des Glitchlings zählt doppelt. Legst du ein Bit, ', el('b', {}, 'zerstört es alle gleichen Bits in der gegenüberliegenden Spalte'), '. Sind alle Spalten einer Seite voll, ist Schluss: die höhere Summe gewinnt.')));
  }
  newGame();
}
