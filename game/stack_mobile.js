// Bit-Stapel as a standalone mobile page (mobile.html, address /mobile; Daniel, 17.11.2026: „eine weitere Version des Spiels als Standalone
// mobile Variante“; „Haptik und Touch sind auch wichtig … triff relevante Entscheidungen alleine“). The board of game/stack_view.js in portrait:
// a slim title, the duel, a bar with the AI-Core, the opponent and „Neu“. Touch: tap a pipeline once to see what the bit would do, tap again
// to send it, or swipe up on it to send at once; the pipeline gives way under the finger. Haptics: a pattern per event (vibrate API: Android;
// iOS has none, there the tap on a pipeline gives the system's switch tick where Safari offers it), switchable in the title bar.
import { loadProject } from '../engine/project.js';
import { browserLoader } from './browser_loader.js';
import { el } from './ui.js';
import { icon } from './icons.js';
import { generate } from './glitchlings.js';
import { duelConfig } from './duel.js';
import { StackView } from './stack_view.js';
import { hapticsOn, setHaptics, buzzLog } from './haptics.js';
import { duelSoundOn, setDuelSound, duelSoundLog } from './duel_sound.js';

const TEMPO = { langsam: 1.6, normal: 1, schnell: 0.5 };
const rngOf = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export async function startMobile(root) {
  const project = await loadProject(browserLoader(new URL('projects/nomadgirl/', location.href)));
  const D = project.data, C = duelConfig(D), q = new URLSearchParams(location.search);
  const S = { foe: q.get('foe') || 'wild', seed: +(q.get('seed') || (1 + Math.floor(Math.random() * 99999))), core: 0, tempo: q.get('tempo') || 'normal', wins: 0, losses: 0, get buzzOn() { return hapticsOn(); }, get buzzed() { return buzzLog(); }, get soundOn() { return duelSoundOn(); }, get sounds() { return duelSoundLog(); } };
  // haptics come from the board itself (haptics.js), the same in the game; the phone only has the switch
  const view = new StackView(D, { confirmTap: true, redraw: () => draw(), tempo: () => TEMPO[S.tempo] ?? 1, 
    onEnd: d => { if (S.counted !== d) { S.counted = d; if (d.winner === 'player') S.wins++; else S.losses++; } },
    endExtra: () => [el('button', { class: 'dl-main', onclick: () => { S.seed++; newGame(); } }, icon('restart', 18), 'Nächstes Duell')] });
  window.duelDemo = { S, D, view, mode: 'mobile', newGame: () => newGame(), place: c => view.playerPlace(c), state: () => view.duel };

  // three Entities of Leyla's deck to pick from, one opponent (wild Entity or Kammerjäger)
  function lineup() {
    const r = rngOf(S.seed), shuffle = a => a.map(x => [r(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const deck = shuffle(generate(D, S.seed)).slice(0, 3), used = new Set(deck.map(g => g.name)), h = C.hunters[Math.floor(r() * C.hunters.length)];
    const foe = S.foe === 'hunters' ? { id: h.id, name: h.name, brand: h.brand, hunter: true, bits: 5 } : shuffle(generate(D, S.seed * 7 + 3)).find(g => !used.has(g.name));
    return { deck, me: deck[Math.min(S.core, deck.length - 1)], foe };
  }
  function newGame() {
    const { me, foe } = lineup();
    if (!me || !foe) { root.replaceChildren(el('div', { class: 'mb-main' }, el('p', { class: 'mb-boot err' }, 'Keine Entities für den Bit-Stapel.'))); return; }
    view.start(me, foe, { rules: 'dot', hp: D.glitchlings?.duel?.stackHp ?? 35 });
  }
  function draw() {
    if (!view.duel) return;
    const { deck } = lineup(), d = view.duel;
    const hint = d.winner ? '' : d.turn === 'player' && !view.busy ? 'Tippen zeigt, nochmal tippen schickt · nach oben wischen schickt sofort' : '';
    const sel = (value, opts, on) => { const s = el('select', { onchange: e => on(e.target.value) }, ...opts.map(([v, n]) => { const o = el('option', { value: v }, n); if (String(value) === String(v)) o.selected = true; return o; })); return s; };
    root.replaceChildren(
      el('div', { class: 'mb-top' }, el('b', {}, 'BIT-STAPEL'), el('small', {}, `Siege ${S.wins} · Niederlagen ${S.losses}`),
        el('button', { class: 'mb-buzz' + (S.buzzOn ? ' on' : ''), title: 'Vibration an/aus', 'aria-pressed': String(S.buzzOn), onclick: () => { setHaptics(!hapticsOn()); draw(); } }, icon(S.buzzOn ? 'wave' : 'muted', 18)),
        el('button', { class: 'mb-buzz mb-sound' + (S.soundOn ? ' on' : ''), title: 'Ton an/aus', 'aria-pressed': String(S.soundOn), onclick: () => { setDuelSound(!duelSoundOn()); draw(); } }, icon(S.soundOn ? 'loudspeaker' : 'muted', 18))),   // #151
      el('div', { class: 'mb-main mob' }, el('div', { style: 'width:100%' }, view.board(), el('div', { class: 'mb-hint' }, hint))),
      el('div', { class: 'mb-bar' },
        sel(S.core, deck.map((g, i) => [i, `Core: ${g.name}`]), v => { S.core = Number(v); newGame(); }),
        sel(S.foe, [['wild', 'Gegner: Wilde KI'], ['hunters', 'Gegner: Kammerjäger']], v => { S.foe = v; newGame(); }),
        el('button', { onclick: () => { S.seed = 1 + Math.floor(Math.random() * 99999); S.core = 0; newGame(); } }, icon('restart', 18), 'Neu')));
    // small phones: the board shrinks until it fits between the title and the bar
    const main = root.querySelector('.mb-main'), inner = main?.firstChild;
    if (inner) { const k = Math.min(1, (main.clientHeight - 4) / Math.max(1, inner.scrollHeight)); inner.style.transform = k < 1 ? `scale(${k.toFixed(3)})` : ''; inner.style.transformOrigin = 'top center'; }
  }
  // swipe up on one of her pipelines: send at once (the click after it is swallowed)
  let down = null, swiped = false;
  root.addEventListener('pointerdown', e => { swiped = false; const p = e.target.closest?.('.sb-pipe.player'); down = p ? { col: Number(p.dataset.col), x: e.clientX, y: e.clientY } : null; });
  root.addEventListener('pointerup', e => {
    if (!down) return;
    const dy = e.clientY - down.y, dx = e.clientX - down.x, col = down.col; down = null;
    if (dy < -36 && Math.abs(dy) > Math.abs(dx) * 1.3 && view.playerPlace(col)) { swiped = true; setTimeout(() => { swiped = false; }, 350); }   // only the click right after the swipe
  });
  root.addEventListener('click', e => { if (swiped) { swiped = false; e.stopPropagation(); e.preventDefault(); } }, true);
  newGame();
}
