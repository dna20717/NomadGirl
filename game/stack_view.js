// The board of the Bit-Stapel (#051/#052): one AI per side with its Code-Porträt (a ghost), three pipelines each, the reel in the middle.
// No page of its own: the demo (duel.html › game/stack_ui.js) and the game's overlay (game/play/glitch_duel_ui.js) both put view.board()
// where they want it and redraw when the view says so (host.redraw). Rules: game/stack_duel.js.
//
//   const view = new StackView(D, { redraw, onEnd(duel), endExtra(duel) → elements, tempo: () => 1, auto: () => false })
//   view.start(me, foe, { rules, hp })    view.nav(u) (ui_nav input)    view.playerPlace(c)    view.quick()    view.stop()
import { el } from './ui.js';
import { icon } from './icons.js';
import { faceCanvas } from './glitch_face.js';
import { COLS, ROWS, colFire, fireOf, newStack, place, choose, preview, colValue, total, open, noiseOf } from './stack_duel.js';

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export const SPIN = 900;   // ms of the reel at tempo 1
const sleep = ms => new Promise(r => setTimeout(r, ms));
export const chip = (v, cls = '') => el('span', { class: 'sb-die ' + cls }, ...Array.from({ length: 9 }, (_, i) => el('i', { class: PIPS[v]?.includes(i) ? 'p' : '' })));

export class StackView {
  constructor(D, host) {
    this.D = D; this.host = host; this.duel = null; this.busy = false; this.last = null; this.faces = {}; this.spun = -1; this.cursor = 0; this.token = 0;
  }
  tempo() { return this.host.tempo?.() ?? 1; }
  auto() { return !!this.host.auto?.(); }
  start(me, foe, opts = {}) {
    this.duel = newStack(me, foe, Math.random, 'player', opts);
    this.duel.noise = { player: noiseOf(me), enemy: foe.hunter ? 0.05 : noiseOf(foe) };
    this.last = null; this.busy = false; this.faces = {}; this.spun = -1; this.cursor = 1; this.token++;
    this.step();
  }
  stop() { this.token++; this.duel = null; }
  redraw() { this.host.redraw?.(); }
  // every turn: the reel spins (the bit was rolled by the rules already), then the side places
  async step() {
    const d = this.duel, tk = this.token;
    if (!d) return;
    if (d.winner) { this.redraw(); return this.host.onEnd?.(d); }
    if (this.busy) return;
    this.busy = true; this.redraw();
    await sleep(SPIN * this.tempo() + 80);
    if (tk !== this.token || d.winner) return;
    this.busy = false;
    if (d.turn === 'enemy' || this.auto()) {
      this.busy = true; this.redraw();
      await sleep(350 * this.tempo());
      if (tk !== this.token || d.winner) return;
      const c = choose(d, Math.random, d.noise[d.turn]);
      this.busy = false;
      return this.go(c.col);
    }
    if (!open(d).includes(this.cursor)) this.cursor = open(d)[0] ?? 0;
    this.redraw();
  }
  async go(c) {
    const d = this.duel, tk = this.token, ev = place(d, c);
    if (!ev) return;
    this.last = ev; this.busy = true; this.picked = null; this.redraw();
    await sleep((ev.destroyed || ev.fire ? 700 : 380) * this.tempo());
    if (tk !== this.token) return;
    this.busy = false; this.step();
  }
  canAct() { const d = this.duel; return !!d && !d.winner && !this.busy && !this.auto() && d.turn === 'player'; }
  playerPlace(c) { if (!this.canAct() || !open(this.duel).includes(c)) return false; this.go(c); return true; }
  // keyboard and controller (ui_nav grammar): ←/→ choose the pipeline, ok sends the bit; 1–3 straight
  nav(u) {
    if (!this.canAct()) return false;
    const o = open(this.duel);
    if (u.pressed('left') || u.pressed('right')) {
      const dir = u.pressed('left') ? -1 : 1;
      for (let k = 1; k <= COLS; k++) { const c = (this.cursor + dir * k + COLS * 3) % COLS; if (o.includes(c)) { this.cursor = c; break; } }
      this.redraw(); return true;
    }
    if (u.pressed('ok')) return this.playerPlace(this.cursor);
    return false;
  }
  // the rest of the duel at once (tests, „Aufgeben“ is something else): both sides by the AI, no waiting
  quick() {
    const d = this.duel;
    if (!d) return null;
    this.token++; this.busy = false;
    for (let i = 0; i < 400 && !d.winner; i++) place(d, choose(d, Math.random, d.noise[d.turn]).col);
    this.last = d.log.filter(e => e.type === 'place').at(-1) || null;
    this.redraw(); this.host.onEnd?.(d);
    return d.winner;
  }

  // ---------- drawing ----------
  face(side, g, size) { const k = side + size; return this.faces[k] ??= faceCanvas(g.hunter ? { id: g.id, name: g.name, hunter: true } : g, size); }
  // the head of one AI: ghost, name, talent and maker, favourite bit, Integrität, what it fires per turn
  head(side) {
    const D = this.D, d = this.duel, sd = d.sides[side], g = sd.ai, b = D.brands?.[g.brand], L = this.last, dot = d.rules === 'dot', hpMode = d.rules !== 'sum';
    const w = Math.max(0, Math.min(100, sd.hp / sd.max * 100)), hurt = L ? (L.damage || 0) + (L.fire || 0) : 0;
    const delta = !L || !hpMode ? '' : L.side === side ? (L.heal ? `+${L.heal}` : '') : (hurt ? `−${hurt}` : '');
    const fire = dot ? fireOf(sd) : 0, active = d.turn === side && !d.winner;
    return el('div', { class: ['sb-ai', side, active ? 'active' : '', L && L.side !== side && hurt ? 'hit' : ''].filter(Boolean).join(' ') },
      el('div', { class: 'sb-portrait' }, this.face(side, g, 88)),
      el('div', { class: 'sb-id' },
        el('small', { class: 'sb-tag' }, side === 'player' ? 'Dein AI-Core' : g.hunter ? 'Kammerjäger' : 'Wilde KI'),
        el('b', {}, g.name),
        el('small', { style: b?.color ? `color:${b.color}` : '' }, g.hunter ? (b?.name || '') : [g.talent, b?.name, '▮'.repeat(g.bits || 0)].filter(Boolean).join(' · ')),
        el('small', { class: 'sb-fav', title: 'Lieblingsbit: Gruppen davon feuern stärker' }, 'Lieblingsbit ', chip(sd.fav[0], 'mini'))),
      hpMode ? el('div', { class: 'sb-hp ' + side, title: 'Integrität' }, el('i', { style: `width:${w}%` }), el('b', {}, `${sd.hp}`), el('small', {}, `/ ${sd.max}`), delta ? el('span', { class: 'sb-delta ' + (delta[0] === '+' ? 'up' : 'down') }, delta) : null)
        : el('div', { class: 'sb-hp ' + side }, el('b', {}, String(total(sd)))),
      dot ? el('div', { class: 'sb-firesum' + (fire ? ' on' : ''), title: 'Feuert am Ende jedes eigenen Zugs' }, icon('flash', 16), String(fire)) : null);
  }
  // one pipeline: three places, the bits flow towards the middle; its value and fire; hover (or the cursor) shows what the bit would do
  pipe(side, i) {
    const d = this.duel, me = d.sides[side], col = me.cols[i], fav = me.fav[i], mine = side === 'player', dot = d.rules === 'dot';
    const canPick = mine && this.canAct() && col.length < ROWS, cur = canPick && this.cursor === i;
    const L = this.last, justPut = L && L.side === side && L.col === i, hit = L && L.side !== side && L.col === i && L.destroyed;
    const pv = canPick ? preview(d, i) : null, threat = !mine && d.turn === 'player' && !this.auto() ? d.die : null, fire = dot ? colFire(me, i) : 0;
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
    const c = el('div', { class: ['sb-pipe', side, canPick ? 'pick' : '', cur ? 'cursor' : '', hit ? 'hit' : '', justPut ? 'put' : '', fire ? 'firing' : ''].filter(Boolean).join(' '), 'data-col': i,
      onmouseenter: () => { if (canPick) { this.cursor = i; c.closest('.sb-board')?.querySelectorAll('.sb-pipe.cursor').forEach(n => n.classList.remove('cursor')); c.classList.add('cursor'); } },
      // touch (host.confirmTap, the mobile page): the first tap picks the pipeline and shows what the bit would do, the second sends it
      onclick: () => { if (this.host.confirmTap && canPick && this.picked !== i) { this.picked = this.cursor = i; return this.redraw(); } this.playerPlace(i); } },
      ...(mine ? [el('div', { class: 'sb-stack' }, ...slots), info] : [info, el('div', { class: 'sb-stack' }, ...slots)]),
      pv && pv.destroyed ? el('div', { class: 'sb-tip' }, `löscht ${pv.destroyed} × `, chip(d.die, 'mini'), dot ? ` · −${pv.hit}${pv.silenced ? `, sein Feuer −${pv.silenced}` : ''}` : ` · −${pv.lost}`) : null);
    return c;
  }
  // the reel: the bit rolls in from above like a slot machine; a redraw while it turns picks the animation up where it is
  reel() {
    const d = this.duel, H = this.host.reelH ?? 56, T = Math.round(SPIN * this.tempo());
    if (this.spun !== d.moves) { this.spun = d.moves; this.spinAt = performance.now(); this.spinFaces = [...Array.from({ length: 13 }, () => 1 + Math.floor(Math.random() * 6)), d.die].reverse(); }
    const gone = performance.now() - this.spinAt, strip = d.die && gone < T
      ? el('div', { class: 'sb-strip spin', style: `--n:${this.spinFaces.length - 1};--t:${T}ms;animation-delay:-${Math.round(gone)}ms` }, ...this.spinFaces.map(v => chip(v, 'big')))
      : el('div', { class: 'sb-strip' }, d.die ? chip(d.die, 'big') : el('span', { class: 'sb-die big' }));
    return el('div', { class: 'sb-reel ' + (d.turn || ''), style: `--h:${H}px` }, el('div', { class: 'sb-window' }, strip));
  }
  middle() {
    const d = this.duel, L = this.last;
    if (d.winner) {
      const p = d.rules === 'sum' ? total(d.sides.player) : d.sides.player.hp, e = d.rules === 'sum' ? total(d.sides.enemy) : d.sides.enemy.hp, foe = d.sides.enemy.ai;
      return el('div', { class: 'sb-mid end ' + d.winner }, el('b', {}, d.winner === 'player' ? (foe?.hunter ? 'ZUGRIFF: das Gerät gehört dir' : 'ÜBERSCHRIEBEN: gefangen!') : 'VERBINDUNG GETRENNT: dein Core ist erschöpft'),
        el('span', { class: 'sb-score' }, `${p} : ${e}`), ...(this.host.endExtra?.(d) || []));
    }
    const mine = d.turn === 'player', who = s => (s === 'player' ? 'Du' : 'Gegner');
    const say = !L ? 'Wähle eine deiner Pipelines.' : `${who(L.side)}: ${L.die} in Pipe ${L.col + 1}` + (L.heal ? ` · heilt ${L.heal}` : '') + (L.destroyed ? ` · ${L.destroyed} gelöscht${L.damage ? `, −${L.damage}` : ''}!` : '') + (L.fire ? ` · Dauerfeuer −${L.fire}` : '') + (L.overflow ? ` · Überlauf: ${L.overflow === 'player' ? 'deine' : 'seine'} Pipelines waren voll und sind gelöscht` : '');
    return el('div', { class: 'sb-mid' }, el('small', { class: 'sb-turn ' + (mine ? 'player' : 'enemy') }, mine ? (this.auto() ? 'DEINE KI WÜRFELT' : 'DEIN BIT') : 'GEGNER WÜRFELT'), this.reel(), el('div', { class: 'sb-say' }, say));
  }
  board() {
    if (!this.duel) return el('div', { class: 'sb-board' });
    return el('div', { class: 'sb-board' }, this.head('enemy'), el('div', { class: 'sb-pipes enemy' }, ...Array.from({ length: COLS }, (_, i) => this.pipe('enemy', i))), this.middle(),
      el('div', { class: 'sb-pipes player' }, ...Array.from({ length: COLS }, (_, i) => this.pipe('player', i))), this.head('player'));
  }
}
