// Demo of the Glitchling duel (#050, Daniel 17.11.2026: „bau bitte eine Demo-Umgebung nur für das Glitch-Spiel“; „mehr wie ein
// Kartenspiel … visualisiert (zunächst über Code)“; „die Welt pausiert“). Own page duel.html (address /duel), not in the game yet.
// Rules: game/duel.js. Cards = Code-Porträts (glitch_face.js) with the four values; dice from code; the AI plays the other side
// (and on request Leyla's side too).
import { loadProject } from '../engine/project.js';
import { browserLoader } from './browser_loader.js';
import { el } from './ui.js';
import { icon } from './icons.js';
import { generate, brandOf } from './glitchlings.js';
import { faceCanvas } from './glitch_face.js';
import { ACTIONS, statsOf, hunterStats, duelConfig, newDuel, options, act, choose, preview, fighter, standing, play } from './duel.js';

const NAMES = Object.fromEntries(ACTIONS);
const ICONS = { whisper: 'wave', link: 'connect', calibrate: 'restart' };
const HINTS = { whisper: 'Angriff mit den Einflüster-Impulsen, ohne Antwort', link: 'Angriff mit den Verschränk-Impulsen, danach antwortet das Ziel', calibrate: 'Kein Angriff; wer flackert, flackert danach nicht mehr' };
const TEMPO = { langsam: 1.6, normal: 1, schnell: 0.45 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rngOf = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pct = v => `${Math.round(v * 100)} %`, num = v => v.toLocaleString('de-DE', { maximumFractionDigits: 1 });

export async function startDuel(root) {
  const project = await loadProject(browserLoader(new URL('projects/nomadgirl/', location.href)));
  const D = project.data, C = duelConfig(D);
  const q = new URLSearchParams(location.search);
  const S = { foe: q.get('foe') || 'wild', foes: +(q.get('foes') || 1), team: +(q.get('team') || C.team), seed: +(q.get('seed') || (1 + Math.floor(Math.random() * 99999))),
    auto: q.has('auto'), tempo: q.get('tempo') || 'normal', duel: null, sel: null, action: 'whisper', busy: false, last: null, sim: '' };
  const ui = {};
  window.duelDemo = { S, D, newGame: () => newGame(), act: (uid, a, t) => playerAct(uid, a, t), state: () => S.duel };

  // ---------- setup ----------
  function teams() {
    const r = rngOf(S.seed), mine = generate(D, S.seed), shuffle = a => a.map(x => [r(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const player = shuffle(mine).slice(0, S.team).map(g => statsOf(D, g));
    const used = new Set(player.map(p => p.name));
    const enemy = S.foe === 'hunters' ? Array.from({ length: S.foes }, () => hunterStats(C.hunters[Math.floor(r() * C.hunters.length)]))
      : shuffle(generate(D, S.seed * 7 + 3)).filter(g => !used.has(g.name)).slice(0, S.foes).map(g => statsOf(D, g));
    return { player, enemy };
  }
  function newGame() {
    const { player, enemy } = teams();
    if (!player.length || !enemy.length) {   // the data did not come (a file missing or not readable): say so instead of an empty board
      const missing = ['glitchlings', 'brands'].filter(a => !Object.keys(D[a] || {}).length);
      root.replaceChildren(el('div', { class: 'dl-boot err' }, el('b', {}, 'Keine Glitchlings zum Duellieren.'), el('br'), el('code', {}, missing.length ? `Spieldaten fehlen: ${missing.map(a => project.paths[a]).join(', ')}` : 'Aufstellung leer'), el('br'), el('small', {}, 'Bitte diese Zeile an Ava schicken.')));
      return;
    }
    S.duel = newDuel(player, enemy); S.sel = null; S.action = 'whisper'; S.last = null; S.busy = false; S.faces = {};
    draw(); step();
  }

  // ---------- turns ----------
  async function step() {
    const d = S.duel;
    if (!d || d.winner || S.busy) return draw();
    if (d.turn === 'enemy' || S.auto) {
      S.busy = true; draw();
      await sleep(650 * TEMPO[S.tempo]);
      if (d !== S.duel) return;
      const c = choose(d, Math.random, d.turn === 'enemy' ? 0.15 : 0.1);
      S.busy = false;
      if (c) await run(c.uid, c.action, c.target);
      return;
    }
    // Leyla's turn: the only ready fighter is chosen right away
    const mine = standing(d, 'player').filter(f => !f.done);
    if (mine.length === 1 && !S.sel) S.sel = mine[0].uid;
    if (S.sel && fighter(d, S.sel)?.flicker) S.action = 'calibrate';
    draw();
  }
  async function run(uid, action, target) {
    const d = S.duel, ev = act(d, uid, action, target);
    if (!ev) return;
    S.last = { uid, action, target, ev }; S.sel = null; S.action = 'whisper'; S.busy = true;
    draw();
    await sleep(1500 * TEMPO[S.tempo]);
    if (d !== S.duel) return;
    S.busy = false;
    step();
  }
  function playerAct(uid, action, target) {
    if (S.busy || S.duel.turn !== 'player' || S.auto) return false;
    if (!options(S.duel, uid).some(o => o.action === action && (o.target ?? null) === (target ?? null))) return false;
    run(uid, action, target); return true;
  }

  // ---------- drawing ----------
  function face(f) {
    S.faces ??= {};
    return S.faces[f.uid] ??= faceCanvas(f.kind === 'hunter' ? { id: f.uid + f.id, name: f.name, hunter: true } : f.g, 112);
  }
  function card(f) {
    const d = S.duel, b = D.brands?.[f.brand], mineTurn = d.turn === 'player' && !S.auto && !S.busy && !d.winner;
    const selectable = mineTurn && f.side === 'player' && !f.done && !f.out;
    const sel = S.sel && fighter(d, S.sel), targetable = mineTurn && sel && f.side === 'enemy' && !f.out && S.action !== 'calibrate' && options(d, S.sel).some(o => o.action === S.action && o.target === f.uid);
    const L = S.last, acting = L?.uid === f.uid, hit = L && (L.target === f.uid || (L.action === 'link' && L.uid === f.uid));
    const wounds = L ? L.ev.filter(e => (e.type === 'attack' || e.type === 'answer') && e.target === f.uid).reduce((s, e) => s + e.wounds, 0) : 0;
    const pv = targetable ? preview(d, S.sel, { action: S.action, target: f.uid }) : null;
    const pips = el('div', { class: 'dl-pips', title: `Integrität ${f.tough - f.wounds} von ${f.tough}` }, ...Array.from({ length: f.tough }, (_, i) => el('i', { class: i < f.tough - f.wounds ? 'on' : '' })));
    const c = el('div', { class: ['dl-card', f.side, f.done && !f.out ? 'done' : '', f.out ? 'out' : '', f.flicker ? 'flicker' : '', S.sel === f.uid ? 'sel' : '', selectable ? 'pick' : '', targetable ? 'target' : '', acting ? 'acting' : '', hit && wounds ? 'hurt' : ''].filter(Boolean).join(' '), 'data-uid': f.uid,
      onclick: () => { if (selectable) { S.sel = f.uid; S.action = f.flicker ? 'calibrate' : S.action; draw(); } else if (targetable) run(S.sel, S.action, f.uid); } },
      el('div', { class: 'dl-face' }, face(f)),
      el('b', { class: 'dl-name' }, f.name),
      el('small', { class: 'dl-maker', style: b?.color ? `color:${b.color}` : '' }, b?.name || (f.kind === 'hunter' ? 'Kammerjäger' : '—')),
      el('div', { class: 'dl-kind' }, f.kind === 'hunter' ? 'Kammerjäger' : `${f.g?.talent || ''} · ${'▮'.repeat(f.g?.bits || 0)}`),
      el('div', { class: 'dl-stats' },
        el('span', { title: 'Präzision: trifft bei W6 ≥ diesem Wert' }, icon('target', 13), `${f.quality}+`),
        el('span', { title: 'Abschirmung: wehrt einen Treffer ab bei W6 ≥ diesem Wert' }, icon('armor', 13), `${f.defense}+`),
        el('span', { title: 'Impulse beim Einflüstern' }, icon('wave', 13), f.remote),
        el('span', { title: 'Impulse beim Verschränken' }, icon('connect', 13), f.link)),
      pips,
      f.flicker ? el('div', { class: 'dl-tag' }, 'flackert') : null,
      f.out ? el('div', { class: 'dl-stamp' }, 'überschrieben') : null,
      wounds && !f.out ? el('div', { class: 'dl-float' }, `−${wounds}`) : null,
      pv ? el('div', { class: 'dl-preview' }, `≈ ${num(pv.wounds)} Wunden · ${pct(pv.overwrite)} überschreiben`, pv.answer != null ? el('br') : null, pv.answer != null ? `Antwort ≈ ${num(pv.answer)}` : null) : null);
    return c;
  }
  function die(v, cls) {
    const P = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[v];
    return el('span', { class: 'dl-die ' + cls, title: String(v) }, ...Array.from({ length: 9 }, (_, i) => el('i', { class: P.includes(i) ? 'p' : '' })));
  }
  function tray() {
    const L = S.last, d = S.duel;
    if (!L) return el('div', { class: 'dl-tray empty' }, d.turn === 'player' && !S.auto ? 'Wähle einen deiner Glitchlings, eine Aktion und ein Ziel.' : '…');
    const nm = uid => fighter(d, uid)?.name || '?', rows = [];
    for (const e of L.ev) {
      if (e.type === 'act') rows.push(el('div', { class: 'dl-line head' }, icon(ICONS[e.action], 16), el('b', {}, nm(e.uid)), ` ${NAMES[e.action].toLowerCase()}${e.target ? ' → ' : ''}`, e.target ? el('b', {}, nm(e.target)) : null));
      if (e.type === 'attack' || e.type === 'answer') {
        const a = fighter(d, e.uid), t = fighter(d, e.target);
        rows.push(el('div', { class: 'dl-line' }, el('small', {}, e.type === 'answer' ? `Antwort ${nm(e.uid)}` : 'Präzision', ` ${a.quality}+`),
          el('span', { class: 'dl-dice' }, ...e.rolls.map(r => die(r, r === 6 || (r !== 1 && r >= a.quality) ? 'hit' : 'miss')))));
        if (e.hits) rows.push(el('div', { class: 'dl-line' }, el('small', {}, `Abschirmung ${nm(e.target)} ${t.defense}+`),
          el('span', { class: 'dl-dice' }, ...e.saves.map(r => die(r, r === 6 || (r !== 1 && r >= t.defense) ? 'block' : 'wound'))), el('b', { class: e.wounds ? 'red' : '' }, e.wounds ? ` −${e.wounds}` : ' gehalten')));
        else rows.push(el('div', { class: 'dl-line' }, el('small', {}, 'kein Treffer')));
      }
      if (e.type === 'test') rows.push(el('div', { class: 'dl-line' }, el('small', {}, `Selbsttest ${nm(e.uid)} ${fighter(d, e.uid).quality}+`), die(e.roll, e.ok ? 'hit' : 'wound'), el('b', { class: e.ok ? '' : 'red' }, e.ok ? ' stabil' : ' flackert!')));
      if (e.type === 'steady') rows.push(el('div', { class: 'dl-line' }, el('small', {}, `${nm(e.uid)} flackert nicht mehr`)));
      if (e.type === 'out') rows.push(el('div', { class: 'dl-line' }, el('b', { class: 'red' }, `${nm(e.uid)} ist überschrieben`)));
    }
    return el('div', { class: 'dl-tray' }, ...rows);
  }
  function actionsBar() {
    const d = S.duel, mine = d.turn === 'player' && !S.auto && !S.busy && !d.winner, opts = mine && S.sel ? options(d, S.sel) : [];
    return el('div', { class: 'dl-actions' }, ...ACTIONS.map(([id, name]) => {
      const can = opts.some(o => o.action === id);
      return el('button', { class: 'dl-act' + (S.action === id && can ? ' on' : ''), disabled: !can, title: HINTS[id], 'data-action': id,
        onclick: () => { if (id === 'calibrate') run(S.sel, 'calibrate'); else { S.action = id; draw(); } } }, icon(ICONS[id], 16), name);
    }));
  }
  function status() {
    const d = S.duel;
    if (d.winner) return el('div', { class: 'dl-status end ' + d.winner }, d.winner === 'player' ? (S.foe === 'hunters' ? 'Gewonnen: das Gerät gehört dir' : 'Gewonnen: gefangen!') : 'Verloren: deine Glitchlings sind erschöpft',
      el('button', { class: 'dl-main', onclick: () => { S.seed++; newGame(); } }, icon('restart', 16), 'Nächstes Duell'));
    return el('div', { class: 'dl-status' }, el('span', { class: 'dl-round' }, `Runde ${d.round}`), d.turn === 'player' ? (S.auto ? 'Deine Seite (KI)' : 'Du bist dran') : 'Der Gegner ist dran');
  }
  function setup() {
    const sel = (label, key, opts, conv = v => v) => el('label', {}, el('small', {}, label), el('select', { onchange: e => { S[key] = conv(e.target.value); newGame(); } }, ...opts.map(([v, n]) => { const o = el('option', { value: v }, n); if (String(S[key]) === String(v)) o.selected = true; return o; })));
    return el('div', { class: 'dl-setup' },
      el('b', { class: 'dl-title' }, 'Glitch-Duell'), el('span', { class: 'dl-sub' }, 'Demo'),
      sel('Gegner', 'foe', [['wild', 'Wilde Glitchlings'], ['hunters', 'Kammerjäger']]),
      sel('Anzahl', 'foes', [[1, '1'], [2, '2'], [3, '3']], Number),
      sel('Dein Deck', 'team', [[1, '1'], [2, '2'], [3, '3']], Number),
      el('label', {}, el('small', {}, 'Seed'), el('input', { type: 'number', value: S.seed, onchange: e => { S.seed = +e.target.value || 1; newGame(); } })),
      el('button', { onclick: () => { S.seed = 1 + Math.floor(Math.random() * 99999); newGame(); } }, icon('restart', 15), 'Neu würfeln'),
      el('label', { class: 'dl-check' }, el('input', { type: 'checkbox', checked: S.auto, onchange: e => { S.auto = e.target.checked; step(); } }), 'KI spielt für mich'),
      sel('Tempo', 'tempo', Object.keys(TEMPO).map(k => [k, k])),
      el('button', { title: 'Dieselbe Aufstellung 1000× von der KI ausspielen lassen', onclick: () => { simulate(); } }, icon('data', 15), '1000× simulieren'),
      S.sim ? el('small', { class: 'dl-sim' }, S.sim) : null);
  }
  function simulate() {
    const { player, enemy } = teams(); let won = 0, rounds = 0;
    for (let i = 0; i < 1000; i++) { const r = play(newDuel(player, enemy)); if (r.winner === 'player') won++; rounds += r.rounds; }
    S.sim = `Du gewinnst ${Math.round(won / 10)} % · im Schnitt ${num(rounds / 1000)} Runden`; draw();
  }
  function draw() {
    const d = S.duel;
    if (!d) return;
    const row = side => el('div', { class: 'dl-row ' + side }, ...d.fighters.filter(f => f.side === side).map(card));
    root.replaceChildren(setup(),
      el('div', { class: 'dl-board' }, row('enemy'), el('div', { class: 'dl-mid' }, status(), tray(), actionsBar()), row('player')),
      el('p', { class: 'dl-rules' }, 'Abwechselnd ist jede Seite mit einem Glitchling dran. ', el('b', {}, 'Einflüstern'), ': Angriff ohne Antwort. ', el('b', {}, 'Verschränken'), ': mehr Impulse, aber das Ziel antwortet. ',
        el('b', {}, 'Kalibrieren'), ': beendet das Flackern. Jeder Impuls trifft bei W6 ≥ Präzision, jeder Treffer wird abgewehrt bei W6 ≥ Abschirmung. Bei halber Integrität ein Selbsttest: misslungen = flackert (nur Kalibrieren, keine Antwort).'));
  }
  newGame();
}
