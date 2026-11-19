// The Glitch-Duell in the game (#052, Daniel 17.11.2026: „das ganze Kampfinterface für die Duelle so anpassen, dass es im Hauptspiel als Overlay
// funktionieren würde und sich nahtlos in die vorhandenen UI-UX-Konventionen eingliedert“). A window like every other (ui_nav.js): it pauses
// the game, has the frame with title, the hint line with key symbols at the bottom and the ✕; keyboard and controller alike:
//   ←/→ choose the pipeline · ok (E / A) sends the bit · 1–3 straight · back (Esc / B) gives up · at the end ok = weiter.
// With more than one AI-Core in the deck Leyla picks first. The board is the demo's (game/stack_view.js), rules game/stack_duel.js.
//   hud.duel.open({ foe, title, sub, onDone({ won, gaveUp, caught }) })
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { hints, closeX } from './ui_nav.js';
import { gearStats } from '../inventory.js';
import { implantBoosts } from '../stations.js';
import { StackView } from '../stack_view.js';
import { faceCanvas } from '../glitch_face.js';
import { cores, catchGlitchling } from '../glitch_world.js';

export class GlitchDuelUI {
  // host: { scene() }
  constructor(root, host) {
    this.host = host;
    this.el = el('div', { class: 'tut gd', hidden: true });
    root.append(this.el);
    this.view = null;
    window.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      const a = { Escape: 'back', Enter: 'ok', ' ': 'ok', e: 'ok', E: 'ok', ArrowLeft: 'left', ArrowRight: 'right', a: 'left', d: 'right', A: 'left', D: 'right', 1: 'p0', 2: 'p1', 3: 'p2' }[e.key];
      if (!a) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) this.act(a);
    }, true);
  }
  get isOpen() { return !this.el.hidden; }
  open({ foe, title = 'Glitch-Duell', sub = '', onDone = null }) {
    const s = this.host.scene(), D = s.data_, save = s.box?.save;
    this.D = D; this.foe = foe; this.title = title; this.sub = sub; this.onDone = onDone; this.result = null;
    this.cores = cores(save); this.pick = 0;
    this.view = new StackView(D, { reelH: 46, redraw: () => this.draw(), tempo: () => (s.data_.glitchlings?.duel?.tempo ?? 100) / 100, endExtra: () => this.endExtra(), onEnd: d => this.ended(d) });
    this.phase = this.cores.length > 1 ? 'pick' : 'duel';
    this.el.hidden = false; this.fresh = true;
    s.drone?.react?.('curious');   // AvA is curious
    if (this.phase === 'duel') this.begin(); else this.draw();
  }
  begin() {
    const D = this.D, me = this.cores[this.pick], save = this.host.scene()?.box?.save;
    this.phase = 'duel';
    // #065 Cyberware im Duell: implants with „Duell-Integrität“ (eyes, nerves) give Leyla's side more Integrität (a friendly duel too)
    this.hack = save ? Math.round(gearStats(D, save.inv?.wear, implantBoosts(D, save)).hack || 0) : 0;
    const base = D.glitchlings?.duel?.stackHp ?? 35;
    this.view.start(me, this.foe, { rules: 'dot', hp: Math.max(10, base + this.hack), foeHp: this.foe.duelHp ?? base });   // the opponent keeps its own
  }
  close() {
    this.view?.stop(); this.el.hidden = true; this.el.replaceChildren(); this.swallow = 3;   // the next game frames ignore Esc / E (scene.padMenus)
    const r = this.result || { won: false, gaveUp: true }, cb = this.onDone;
    this.onDone = null; this.view = null;
    cb?.(r);
  }
  // the end: a won duel against a wild one catches it (deck, else backpack, else Camp-Lager)
  ended(d) {
    if (this.result) return;
    const s = this.host.scene(), save = s.box?.save, won = d.winner === 'player';
    let caught = null;
    if (won && !this.foe.hunter && !this.foe.friendly && save) caught = catchGlitchling(this.D, save, this.foe);   // #060 a friendly duel catches nothing
    this.result = { won, gaveUp: false, caught, foe: this.foe };
    s.drone?.react?.(won ? 'cleared' : 'hit');
    this.draw();
  }
  endExtra() {
    const r = this.result, where = { deck: 'ins Cyberdeck', backpack: 'in den Rucksack', camp: 'ins Camp-Lager' };
    return [this.foe.friendly ? el('small', { class: 'gd-caught' }, r?.won ? `Gewonnen. ${this.foe.name} grinst.` : `${this.foe.name} gewinnt und freut sich.`) : r?.won && !this.foe.hunter ? el('small', { class: 'gd-caught' }, r.caught ? `${this.foe.name} ist ${where[r.caught]} gewandert.` : 'Kein Platz: sie ist entwischt.') : null,
      el('button', { class: 'inv-btn gd-go on', onclick: () => this.close() }, icon('arrow_right', 16), ' Weiter')];
  }
  // pad (scene.padMenus): only when no keyboard key is down (the keyboard comes through the keydown above)
  nav(u) {
    if (u.keys) return;
    for (const a of ['back', 'ok', 'left', 'right', 'up', 'down']) if (u.pressed(a)) return this.act(a === 'up' ? 'left' : a === 'down' ? 'right' : a);
  }
  act(a) {
    if (this.phase === 'pick') {
      if (a === 'back') return this.close();
      if (a === 'left' || a === 'right') { this.pick = (this.pick + (a === 'left' ? -1 : 1) + this.cores.length) % this.cores.length; return this.draw(); }
      if (a === 'ok') return this.begin();
      return;
    }
    const d = this.view?.duel;
    if (!d) return;
    if (d.winner) { if (a === 'ok' || a === 'back') this.close(); return; }
    if (a === 'back') { this.result = { won: false, gaveUp: true, foe: this.foe }; return this.close(); }   // give up: the duel counts as fought
    if (a[0] === 'p') return this.view.playerPlace(Number(a[1]));
    this.view.nav({ pressed: x => x === a });
  }
  // tests: the rest of the duel at once
  quick() { return this.view?.quick(); }
  state() { const d = this.view?.duel; return { open: this.isOpen, phase: this.phase, foe: this.foe?.name || null, me: d?.sides.player.ai?.name || null, hp: d ? [d.sides.player.hp, d.sides.enemy.hp] : null, winner: d?.winner || null, result: this.result }; }

  draw() {
    if (!this.isOpen) return;
    const head = el('div', { class: 'gd-head' }, icon('brain', 18), el('b', {}, this.title), this.sub ? el('small', {}, this.sub) : null, this.hack && this.phase !== 'pick' ? el('small', { class: this.hack > 0 ? 'gd-hack up' : 'gd-hack down' }, icon('brain', 14), ` Implantate: ${this.hack > 0 ? '+' : ''}${this.hack} Integrität`) : null);   // #065
    let body, help;
    if (this.phase === 'pick') {
      body = el('div', { class: 'gd-pick' }, el('p', {}, 'Welcher AI-Core tritt an?'),
        el('div', { class: 'gd-cores' }, ...this.cores.map((g, i) => el('button', { class: 'gd-core' + (i === this.pick ? ' on' : ''), onclick: () => { this.pick = i; this.begin(); }, onmouseenter: () => { this.pick = i; this.el.querySelectorAll('.gd-core').forEach((b, k) => b.classList.toggle('on', k === i)); } },
          faceCanvas(g, 72), el('b', {}, g.name), el('small', {}, `${g.talent} · ${g.bits} Bit`)))),
        el('p', { class: 'gd-vs' }, 'gegen ', el('b', {}, this.foe.name)));
      help = hints([['move', 'wählen'], ['ok', 'antreten'], ['back', 'zurück']]);
    } else {
      body = this.view.board();
      const d = this.view.duel;
      help = d?.winner ? hints([['ok', 'weiter']]) : hints([['move', 'Pipeline wählen'], ['ok', 'Bit schicken'], ['back', 'aufgeben']], 'Maus: Pipeline anklicken · Tasten 1–3');
    }
    const card = el('div', { class: 'tut-card gd-card ui-frame' + (this.fresh ? ' gd-in' : '') }, head, body, help, closeX(() => this.act('back')));
    this.fresh = false;   // the card pops in once, redraws stand still
    this.el.replaceChildren(card);
    // smaller screens: the whole card shrinks to fit (like the inventory)
    const r = card.getBoundingClientRect(), k = Math.min(1, (innerHeight - 16) / Math.max(1, r.height), (innerWidth - 16) / Math.max(1, r.width));
    card.style.transform = k < 1 ? `scale(${k.toFixed(3)})` : '';
  }
}
