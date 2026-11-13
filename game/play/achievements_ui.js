// Menü › Achievements (#012): every achievement with its progress, hidden ones as „???“ until reached, and what became of its
// trophy (Rezept gelernt → hergestellt → ausgestellt, Bonus aktiv). Looks like the field guide (tutorial.js), one grammar:
// stick/arrows choose, LB/RB or Q switch the kind, back closes. Logic in game/achievements.js.
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { hints, closeX, keyGlyph } from './ui_nav.js';
import { overview, bonusText, ACHIEVEMENT_CATEGORIES } from '../achievements.js';
import { GEAR_STATS } from '../inventory.js';
import { markOf } from './inventory_ui.js';

const TABS = [['all', 'Alle'], ...ACHIEVEMENT_CATEGORIES];

export class AchievementsUI {
  // host: { scene() }
  constructor(root, host) {
    this.host = host; this.tab = 'all'; this.pick = 0;
    this.el = el('div', { class: 'tut ach', hidden: true, onclick: e => { if (e.target === this.el) this.close(); } });
    root.append(this.el);
    window.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      const map = { Escape: 'back', ArrowLeft: 'prev', ArrowRight: 'next', ArrowUp: 'up', ArrowDown: 'down', w: 'up', s: 'down', a: 'prev', d: 'next', q: 'next', Q: 'next', Tab: 'next' }[e.key];
      if (!map) return;
      e.preventDefault(); e.stopPropagation();
      this.act(map);
    }, true);
  }
  get isOpen() { return !this.el.hidden; }
  get scene() { return this.host.scene(); }
  open() { this.pick = 0; this.draw(); this.el.hidden = false; }
  close() { this.el.hidden = true; this.el.replaceChildren(); }
  nav(u) { for (const a of ['back', 'up', 'down', 'next', 'prev', 'left', 'right']) if (u.pressed(a)) return this.act(a === 'left' ? 'prev' : a === 'right' ? 'next' : a); }
  act(a) {
    if (a === 'back') return this.close();
    if (a === 'next' || a === 'prev') { const i = TABS.findIndex(t => t[0] === this.tab); this.tab = TABS[(i + (a === 'next' ? 1 : -1) + TABS.length) % TABS.length][0]; this.pick = 0; return this.draw(); }
    const n = this.rows().length;
    if (n && (a === 'up' || a === 'down')) { this.pick = (this.pick + (a === 'down' ? 1 : -1) + n) % n; this.draw(); }
  }
  rows() { const s = this.scene, all = s?.box ? overview(s.data_, s.box.save) : []; return this.tab === 'all' ? all : all.filter(x => x.category === this.tab); }
  draw() {
    const s = this.scene, D = s?.data_ || {}, all = s?.box ? overview(D, s.box.save) : [], rows = this.rows(), done = all.filter(x => x.done).length;
    const tabs = el('div', { class: 'tut-tabs' }, ...keyGlyph('tabs').slice(0, 1), ...TABS.map(([k, n]) => el('button', { class: 'tut-tab' + (k === this.tab ? ' on' : ''), onclick: () => { this.tab = k; this.pick = 0; this.draw(); } }, n)), ...keyGlyph('tabs').slice(1));
    const card = (x, i) => {
      const state = !x.done ? null : x.shown ? ['live', 'Ausgestellt · Bonus aktiv'] : x.made ? ['made', 'Hergestellt · in die Schatzkammer stellen'] : x.recipe ? ['recipe', 'Rezept gelernt · an der Werkstatt herstellen'] : ['done', 'Erreicht'];
      const pic = x.hidden ? el('span', { class: 'ach-q' }, '?') : (x.trophy && markOf(D, 'items', x.trophy, 64)) || el('span', { class: 'ach-q' }, icon('trophy', 32));
      const bonus = !x.hidden ? bonusText(D, D.achievements?.[x.id], GEAR_STATS) : [];
      return el('li', { class: 'ach-card' + (x.done ? ' done' : '') + (x.hidden ? ' hidden' : '') + (i === this.pick ? ' on' : '') + (state ? ' ' + state[0] : ''), onclick: () => { this.pick = i; this.draw(); } },
        el('div', { class: 'ach-pic' }, pic),
        el('div', { class: 'ach-text' },
          el('b', {}, x.hidden ? '???' : x.name),
          el('small', {}, x.hidden ? 'Versteckt. Finde es selbst heraus.' : x.description),
          x.done ? null : el('div', { class: 'ach-bar' }, el('i', { style: `width:${Math.round(100 * x.n / Math.max(1, x.target))}%` }), el('span', {}, `${x.n} / ${x.target}`)),
          !x.hidden && x.trophy ? el('small', { class: 'ach-trophy' }, `Trophäe: ${x.trophyName}${bonus.length ? ' · ' + bonus.join(' · ') : ''}`) : null,
          state ? el('small', { class: 'ach-state' }, state[1]) : null));
    };
    this.el.replaceChildren(el('div', { class: 'tut-guide ach-box ui-frame' },
      el('header', {}, icon('trophy', 20), el('h2', {}, 'Achievements'), el('small', {}, `${done} von ${all.length} erreicht`), tabs),
      el('ol', { class: 'ach-list' }, ...(rows.length ? rows.map(card) : [el('p', {}, 'Hier gibt es noch nichts.')])),
      hints([['move', 'wählen'], ['tabs', 'Art'], ['back', 'schließen']], 'Trophäen herstellen und in der Schatzkammer ausstellen: dann wirkt ihr Bonus'),
      closeX(() => this.close())));
    this.el.querySelector('.ach-card.on')?.scrollIntoView?.({ block: 'nearest' });
  }
  state() { return { open: this.isOpen, tab: this.tab, pick: this.pick, rows: this.rows().map(x => ({ id: x.id, hidden: x.hidden, done: x.done, n: x.n, target: x.target, made: x.made, shown: x.shown })) }; }
}
