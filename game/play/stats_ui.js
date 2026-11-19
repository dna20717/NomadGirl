// Werte-Bildschirm (#091): every value with its sources, in four tabs (Leyla · Camp · Tank & AvA · Effekte). Opened with U, from the
// pause menu and from the inventory. Same grammar as the achievements window: LB/RB or ←/→ switch the tab, ↑/↓ scroll, back closes.
// The numbers come from game/stat_sheet.js (the Boni-Bus), the effects from game/effects.js.
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { hints, closeX, keyGlyph } from './ui_nav.js';
import { statSheet, valueText, SOURCE_NAMES } from '../stat_sheet.js';
import { activeEffects } from '../effects.js';

const TABS = [['leyla', 'Leyla'], ['camp', 'Camp'], ['tank', 'Tank & AvA'], ['fx', 'Effekte']];
const EMPTY = { leyla: 'Noch keine Boni. Ausrüstung, Implantate, Techtree, Trophäen und Markentreue zählen hier zusammen.', camp: 'Noch keine Camp-Boni. Worker, Crew, Trophäen und Markentreue tauchen hier auf.',
  tank: 'Noch nichts, was den Tank oder AvA verändert. Techtree, Trophäen und AvAs Platine zählen hier.', fx: 'Gerade wirkt nichts.' };

export class StatsUI {
  // host: { scene() }
  constructor(root, host) {
    this.host = host; this.tab = 'leyla';
    this.el = el('div', { class: 'tut ach stats', hidden: true, onclick: e => { if (e.target === this.el) this.close(); } });
    root.append(this.el);
    window.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      const map = { Escape: 'back', u: 'back', U: 'back', ArrowLeft: 'prev', ArrowRight: 'next', ArrowUp: 'up', ArrowDown: 'down', w: 'up', s: 'down', a: 'prev', d: 'next', q: 'next', Q: 'next', Tab: 'next' }[e.key];
      if (!map) return;
      e.preventDefault(); e.stopPropagation();
      this.act(map);
    }, true);
  }
  get isOpen() { return !this.el.hidden; }
  get scene() { return this.host.scene(); }
  open(tab) { if (tab) this.tab = tab; this.draw(); this.el.hidden = false; }
  close() { this.el.hidden = true; this.el.replaceChildren(); }
  nav(u) { for (const a of ['back', 'up', 'down', 'next', 'prev', 'left', 'right']) if (u.pressed(a)) return this.act(a === 'left' ? 'prev' : a === 'right' ? 'next' : a); }
  act(a) {
    if (a === 'back') return this.close();
    if (a === 'next' || a === 'prev') { const i = TABS.findIndex(t => t[0] === this.tab); this.tab = TABS[(i + (a === 'next' ? 1 : -1) + TABS.length) % TABS.length][0]; return this.draw(); }
    const list = this.el.querySelector('.stats-list'); if (list && (a === 'up' || a === 'down')) list.scrollBy({ top: a === 'down' ? 120 : -120 });
  }
  sheet() { const s = this.scene; return s?.box ? statSheet(s.data_, s.box.save) : { leyla: [], camp: [], tank: [], buffs: [] }; }
  effects() { const s = this.scene; return s?.box ? activeEffects(s.data_, s.box.save, { run: s.mode === 'run', sky: s.weatherRun, turf: s.turf?.state?.() }) : []; }
  draw() {
    const S = this.sheet(), n = { leyla: S.leyla.length, camp: S.camp.length, tank: S.tank.length, fx: this.effects().length };
    const tabs = el('div', { class: 'tut-tabs' }, ...keyGlyph('tabs').slice(0, 1), ...TABS.map(([k, name]) => el('button', { class: 'tut-tab' + (k === this.tab ? ' on' : ''), onclick: () => { this.tab = k; this.draw(); } }, name, n[k] ? el('small', {}, ` ${n[k]}`) : null)), ...keyGlyph('tabs').slice(1));
    const row = r => el('li', { class: 'stats-row' + (r.good ? '' : ' bad') },
      el('div', { class: 'stats-head' }, el('b', {}, r.name), el('span', { class: 'stats-total' }, valueText(r.total, r.unit))),
      el('div', { class: 'stats-parts' }, ...r.parts.map(p => el('span', { class: 'stats-part ' + (p.value < 0 ? 'neg' : 'pos'), title: SOURCE_NAMES[p.source] || p.source },
        el('small', {}, SOURCE_NAMES[p.source] || p.source), ' ', p.label, ' ', el('b', {}, valueText(p.value, r.unit))))));
    const fx = x => el('li', { class: 'stats-row fx ' + (x.kind || '') }, el('div', { class: 'stats-head' }, el('b', {}, x.label), x.left != null ? el('span', { class: 'stats-total small' }, icon('clock', 14)) : null), x.sub ? el('small', {}, x.sub) : null);
    const rows = this.tab === 'fx' ? this.effects().map(fx) : S[this.tab].map(row);
    const intro = { leyla: 'Boni auf Leylas Grundwerte, so wie das Spiel sie rechnet. Buffs zählen im nächsten Run.', camp: 'Was die Werkstätten im Camp schneller und besser macht (Boni-Bus). Ausbau und Synergie gelten je Werkstatt und stehen dort.',
      tank: 'Was AvAs Cryo-Tank und ihren Akku verändert.', fx: 'Was gerade wirkt, mit Ablaufzeit (wie die Effekt-Leiste).' }[this.tab];
    this.el.replaceChildren(el('div', { class: 'tut-guide ach-box stats-box ui-frame' },
      el('header', {}, icon('scale', 20), el('h2', {}, 'Werte'), tabs),
      el('p', { class: 'stats-intro' }, intro),
      el('ol', { class: 'stats-list' }, ...(rows.length ? rows : [el('p', { class: 'stats-empty' }, EMPTY[this.tab])])),
      hints([['tabs', 'Bereich'], ['move', 'blättern'], ['back', 'schließen']], 'Jede Zahl mit ihren Quellen'),
      closeX(() => this.close())));
  }
  state() { const S = this.sheet(); return { open: this.isOpen, tab: this.tab, leyla: S.leyla.map(r => `${r.stat}:${r.total}`), camp: S.camp.map(r => `${r.stat}:${r.total}`), tank: S.tank.map(r => `${r.stat}:${r.total}`), fx: this.effects().map(x => x.id), rows: this.el.querySelectorAll('.stats-row').length }; }
}
