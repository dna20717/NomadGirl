// Demo „Bit-Stapel“ (#051): the Glitchling duel after the Knucklebones principle, from code. Rules: game/stack_duel.js.
// Daniel, 17.11.2026: „nicht drei KIs gegeneinander, sondern jeweils eine, die wiederum 3 Pipelines hat … cyberpunkiger darstellen und die
// Animation des Würfels mehr wie eine Slotmaschine (rollen von oben nach unten)“. One AI per side (Leyla picks her AI-Core before the duel),
// three pipelines each, the bit spins in a reel. duel.html shows it by default (?mode=stack), the older Gefecht with ?mode=fight.
import { loadProject } from '../engine/project.js';
import { browserLoader } from './browser_loader.js';
import { el } from './ui.js';
import { icon } from './icons.js';
import { generate } from './glitchlings.js';
import { faceCanvas } from './glitch_face.js';
import { duelConfig } from './duel.js';
import { COLS, ROWS, RULES, colFire, fireOf, newStack, place, choose, preview, colValue, total, open, play, noiseOf } from './stack_duel.js';

const TEMPO = { langsam: 1.6, normal: 1, schnell: 0.4 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rngOf = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const SPIN = 900;   // ms of the reel at tempo normal

export async function startStack(root, switchTo) {
  const project = await loadProject(browserLoader(new URL('projects/nomadgirl/', location.href)));
  const D = project.data, C = duelConfig(D), q = new URLSearchParams(location.search);
  const S = { rules: ['sum', 'hp'].includes(q.get('rules')) ? q.get('rules') : 'dot', foe: q.get('foe') || 'wild', seed: +(q.get('seed') || (1 + Math.floor(Math.random() * 99999))), core: +(q.get('core') || 0),
    auto: q.has('auto'), tempo: q.get('tempo') || 'normal', duel: null, busy: false, last: null, sim: '', faces: {}, spun: -1 };
  window.duelDemo = { S, D, mode: 'stack', newGame: () => newGame(), place: c => playerPlace(c), state: () => S.duel };
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
    S.duel = newStack(me, foe, Math.random, 'player', opts()); S.duel.noise = { player: noiseOf(me), enemy: foe.hunter ? 0.05 : noiseOf(foe) };
    S.last = null; S.busy = false; S.faces = {}; S.spun = -1;
    step();
  }
  // every turn: the reel spins (the bit was rolled by the rules already), then the side places
  async function step() {
    const d = S.duel;
    if (!d || d.winner) return draw();
    if (S.busy) return;
    S.busy = true; draw();
    await sleep(SPIN * TEMPO[S.tempo] + 80);
    if (d !== S.duel || d.winner) return;
    S.busy = false;
    if (d.turn === 'enemy' || S.auto) {
      S.busy = true; draw();
      await sleep(350 * TEMPO[S.tempo]);
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
    await sleep((ev.destroyed || ev.fire ? 700 : 380) * TEMPO[S.tempo]);
    if (d !== S.duel) return;
    S.busy = false; step();
  }
  function playerPlace(c) { const d = S.duel; if (!d || d.winner || S.busy || S.auto || d.turn !== 'player' || !open(d).includes(c)) return false; go(c); return true; }
  addEventListener('keydown', e => { if (window.duelDemo?.mode === 'stack' && /^[1-3]$/.test(e.key)) playerPlace(Number(e.key) - 1); });

  // ---------- drawing ----------
  const chip = (v, cls = '') => el('span', { class: 'sb-die ' + cls }, ...Array.from({ length: 9 }, (_, i) => el('i', { class: PIPS[v].includes(i) ? 'p' : '' })));
  function face(side, g, size) { const k = side + size; return S.faces[k] ??= faceCanvas(g.hunter ? { id: g.id, name: g.name, hunter: true } : g, size); }
  // the head of one AI: Code-Porträt, name, talent and maker, favourite bit, Integrität, what it fires per turn
  function head(side) {
    const d = S.duel, sd = d.sides[side], g = sd.ai, b = D.brands?.[g.brand], L = S.last, dot = d.rules === 'dot', hpMode = d.rules !== 'sum';
    const w = Math.max(0, Math.min(100, sd.hp / sd.max * 100)), hurt = L ? (L.damage || 0) + (L.fire || 0) : 0;
    const delta = !L || !hpMode ? '' : L.side === side ? (L.heal ? `+${L.heal}` : '') : (hurt ? `−${hurt}` : '');
    const fire = dot ? fireOf(sd) : 0, active = d.turn === side && !d.winner;
    return el('div', { class: ['sb-ai', side, active ? 'active' : '', L && L.side !== side && hurt ? 'hit' : ''].filter(Boolean).join(' ') },
      el('div', { class: 'sb-portrait' }, face(side, g, 88)),
      el('div', { class: 'sb-id' },
        el('small', { class: 'sb-tag' }, side === 'player' ? 'Dein AI-Core' : g.hunter ? 'Kammerjäger' : 'Wilde KI'),
        el('b', {}, g.name),
        el('small', { style: b?.color ? `color:${b.color}` : '' }, g.hunter ? (b?.name || '') : `${g.talent} · ${b?.name || ''} · ${'▮'.repeat(g.bits || 0)}`),
        el('small', { class: 'sb-fav', title: 'Lieblingsbit: Gruppen davon feuern stärker' }, 'Lieblingsbit ', chip(sd.fav[0], 'mini'))),
      hpMode ? el('div', { class: 'sb-hp ' + side, title: 'Integrität' }, el('i', { style: `width:${w}%` }), el('b', {}, `${sd.hp}`), el('small', {}, `/ ${sd.max}`), delta ? el('span', { class: 'sb-delta ' + (delta[0] === '+' ? 'up' : 'down') }, delta) : null)
        : el('div', { class: 'sb-hp ' + side }, el('b', {}, String(total(sd)))),
      dot ? el('div', { class: 'sb-firesum' + (fire ? ' on' : ''), title: 'Feuert am Ende jedes eigenen Zugs' }, icon('flash', 16), String(fire)) : null);
  }
  // one pipeline: three places, the bits flow towards the middle; the value and its fire; hover shows what the bit would do
  function pipe(side, i) {
    const d = S.duel, me = d.sides[side], col = me.cols[i], fav = me.fav[i], mine = side === 'player', dot = d.rules === 'dot';
    const canPick = mine && d.turn === 'player' && !S.auto && !S.busy && !d.winner && col.length < ROWS;
    const L = S.last, justPut = L && L.side === side && L.col === i, hit = L && L.side !== side && L.col === i && L.destroyed;
    const pv = canPick ? preview(d, i) : null, threat = !mine && d.turn === 'player' && !S.auto ? d.die : null, fire = dot ? colFire(me, i) : 0;
    const counts = {}; for (const v of col) counts[v] = (counts[v] || 0) + 1;
    const slots = Array.from({ length: ROWS }, (_, k) => {
      const v = col[k];
      if (v == null) return el('span', { class: 'sb-slot' + (pv && k === col.length ? ' ghost' : '') }, pv && k === col.length ? chip(d.die, 'ghost') : null);
      return el('span', { class: 'sb-slot' }, chip(v, [counts[v] > 1 ? `x${counts[v]}` : '', v === fav ? 'fav' : '', justPut && k === col.length - 1 ? 'new' : '', threat === v ? 'will' : ''].filter(Boolean).join(' ')));
    });
    if (!mine) slots.reverse();   // the enemy's pipelines run down towards the middle
    const info = el('div', { class: 'sb-value' }, el('small', {}, `PIPE ${i + 1}`), dot ? null : el('b', {}, String(colValue(col, fav))),
      fire ? el('span', { class: 'sb-fire' }, icon('flash', 15), String(fire)) : null,
      pv && dot && pv.fireUp ? el('span', { class: 'sb-gain' }, '+', icon('flash', 13), String(pv.fireUp)) : null,
      pv && d.rules === 'hp' && pv.heal ? el('span', { class: 'sb-gain' }, `♥+${pv.heal}`) : null, pv && d.rules === 'sum' ? el('span', { class: 'sb-gain' }, `+${pv.gain}`) : null);
    const c = el('div', { class: ['sb-pipe', side, canPick ? 'pick' : '', hit ? 'hit' : '', justPut ? 'put' : '', fire ? 'firing' : ''].filter(Boolean).join(' '), 'data-col': i,
      onmouseenter: () => { if (canPick) c.closest('.sb-board')?.classList.add('hover-' + i); }, onmouseleave: () => c.closest('.sb-board')?.classList.remove('hover-' + i), onclick: () => playerPlace(i) },
      ...(mine ? [el('div', { class: 'sb-stack' }, ...slots), info] : [info, el('div', { class: 'sb-stack' }, ...slots)]),
      pv && pv.destroyed ? el('div', { class: 'sb-tip' }, `löscht ${pv.destroyed} × `, chip(d.die, 'mini'), dot ? ` · −${pv.hit}${pv.silenced ? `, sein Feuer −${pv.silenced}` : ''}` : ` · −${pv.lost}`) : null);
    return c;
  }
  // the reel: the bit rolls in from above like a slot machine (only once per roll, redraws show it standing)
  function reel() {
    const d = S.duel, H = 56, T = Math.round(SPIN * TEMPO[S.tempo]);
    if (S.spun !== d.moves) { S.spun = d.moves; S.spinAt = performance.now(); S.spinFaces = [...Array.from({ length: 13 }, () => 1 + Math.floor(Math.random() * 6)), d.die].reverse(); }
    // a redraw while it turns picks the animation up where it is (negative delay), so the reel never jumps back
    const gone = performance.now() - S.spinAt, strip = gone < T
      ? el('div', { class: 'sb-strip spin', style: `--n:${S.spinFaces.length - 1};--t:${T}ms;animation-delay:-${Math.round(gone)}ms` }, ...S.spinFaces.map(v => chip(v, 'big')))
      : el('div', { class: 'sb-strip' }, chip(d.die, 'big'));
    return el('div', { class: 'sb-reel ' + (d.turn || ''), style: `--h:${H}px` }, el('div', { class: 'sb-window' }, strip));
  }
  function middle() {
    const d = S.duel, L = S.last;
    if (d.winner) {
      const p = d.rules === 'sum' ? total(d.sides.player) : d.sides.player.hp, e = d.rules === 'sum' ? total(d.sides.enemy) : d.sides.enemy.hp;
      return el('div', { class: 'sb-mid end ' + d.winner }, el('b', {}, d.winner === 'player' ? (S.foe === 'hunters' ? 'ZUGRIFF: das Gerät gehört dir' : 'ÜBERSCHRIEBEN: gefangen!') : 'VERBINDUNG GETRENNT: dein Core ist erschöpft'),
        el('span', { class: 'sb-score' }, `${p} : ${e}`), el('button', { class: 'dl-main', onclick: () => { S.seed++; newGame(); } }, icon('restart', 16), 'Nächstes Duell'));
    }
    const mine = d.turn === 'player', who = s => (s === 'player' ? 'Du' : 'Gegner');
    const say = !L ? 'Klick eine deiner Pipelines (oder Taste 1–3).' : `${who(L.side)}: ${L.die} in Pipe ${L.col + 1}` + (L.heal ? ` · heilt ${L.heal}` : '') + (L.destroyed ? ` · ${L.destroyed} gelöscht${L.damage ? `, −${L.damage}` : ''}!` : '') + (L.fire ? ` · Dauerfeuer −${L.fire}` : '') + (L.overflow ? ` · Überlauf: ${L.overflow === 'player' ? 'deine' : 'seine'} Pipelines waren voll und sind gelöscht` : '');
    return el('div', { class: 'sb-mid' }, el('small', { class: 'sb-turn ' + (mine ? 'player' : 'enemy') }, mine ? (S.auto ? 'DEINE KI WÜRFELT' : 'DEIN BIT') : 'GEGNER WÜRFELT'), reel(), el('div', { class: 'sb-say' }, say));
  }
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
      el('label', { class: 'dl-check' }, el('input', { type: 'checkbox', checked: S.auto, onchange: e => { S.auto = e.target.checked; step(); } }), 'KI spielt für mich'),
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
    const r = S.duel.rules;
    if (r === 'dot') return el('p', { class: 'dl-rules' }, 'Beide KIs haben ', el('b', {}, `${S.duel.sides.player.max} Integrität`), ' und drei Pipelines. Das Bit rollt ein, du schickst es in eine Pipeline. ', el('b', {}, 'Paare und Drillinge feuern am Ende jedes deiner Züge'),
      ' (Blitz: Paar = Bitwert, Drilling = doppelt, Lieblingsbit legt seinen Wert obendrauf), bis der Gegner sie löscht. Ein Bit ', el('b', {}, 'löscht alle gleichen Bits in der Pipeline gegenüber'), ' und kostet den Gegner sofort ihre Augen. Wer auf 0 fällt, ist überschrieben. Volle Pipelines laufen über und werden geleert.');
    if (r === 'hp') return el('p', { class: 'dl-rules' }, 'Wertung Heilen: ein Bit zu gleichen Bits heilt (Wert × gleiche darunter), gelöschte Bits kosten den Gegner ihren Wert in seiner Pipeline. Wer auf 0 fällt, ist überschrieben.');
    return el('p', { class: 'dl-rules' }, 'Wertung Summe: gleiche Bits multiplizieren sich, gelöschte Bits fehlen dem Gegner; sind die Pipelines einer Seite voll, gewinnt die höhere Summe.');
  }
  function draw() {
    const d = S.duel;
    if (!d) return;
    root.replaceChildren(setup(),
      el('div', { class: 'sb-board' }, head('enemy'), el('div', { class: 'sb-pipes enemy' }, ...Array.from({ length: COLS }, (_, i) => pipe('enemy', i))), middle(),
        el('div', { class: 'sb-pipes player' }, ...Array.from({ length: COLS }, (_, i) => pipe('player', i))), head('player')),
      rules());
  }
  newGame();
}
