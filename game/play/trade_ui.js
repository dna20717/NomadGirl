// Händlerfenster (#182, Daniel 23.11.2026: „Wir brauchen ein Händler-Interface“, „Ein Fenster für alle Händler“). Logic in game/trade.js.
// Looks like the Questlog; one grammar: stick/arrows choose, LB/RB or Q switch Verkaufen | Kaufen, A/E = one piece, Y/F = all of it,
// back closes. Leyla sells from and buys into the camp inventories (Lager, Kiste, Rucksack).
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { hints, closeX, keyGlyph } from './ui_nav.js';
import { markOf } from './inventory_ui.js';
import { traderConfig, offers, sell, buy } from '../trade.js';
import { valueOf } from '../brands.js';

const TABS = [['sell', 'Verkaufen'], ['buy', 'Kaufen']];

export class TradeUI {
  // host: { scene(), toast(title, sub, kind), changed() }
  constructor(root, host) {
    this.host = host; this.tab = 'sell'; this.pick = 0; this.id = null; this.note = null;
    this.el = el('div', { class: 'tut ql trade', hidden: true, onclick: e => { if (e.target === this.el) this.close(); } });
    root.append(this.el);
    window.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      const map = { Escape: 'back', ArrowLeft: 'prev', ArrowRight: 'next', ArrowUp: 'up', ArrowDown: 'down', w: 'up', s: 'down', a: 'prev', d: 'next', q: 'next', Q: 'next', Tab: 'next', e: 'ok', E: 'ok', Enter: 'ok', ' ': 'ok', f: 'send', F: 'send' }[e.key];
      if (!map) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) this.act(map === 'ok' && e.shiftKey ? 'send' : map);
    }, true);
  }
  get isOpen() { return !this.el.hidden; }
  get scene() { return this.host.scene(); }
  get D() { return this.scene?.data_ || {}; }
  get save() { return this.scene?.box?.save || null; }
  open(id, tab = 'sell') { this.id = id; this.tab = tab; this.pick = 0; this.note = null; this.draw(); this.el.hidden = false; }
  close() { this.el.hidden = true; this.el.replaceChildren(); this.id = null; }
  nav(u) { for (const a of ['back', 'ok', 'send', 'up', 'down', 'next', 'prev', 'left', 'right']) if (u.pressed(a)) return this.act(a === 'left' ? 'prev' : a === 'right' ? 'next' : a); }
  rows() { const O = offers(this.D, this.save, this.id); return this.tab === 'sell' ? O.sell : O.buy; }
  act(a) {
    if (a === 'back') return this.close();
    if (a === 'next' || a === 'prev') { const i = TABS.findIndex(t => t[0] === this.tab); this.tab = TABS[(i + 1) % TABS.length][0]; this.pick = 0; this.note = null; return this.draw(); }
    const R = this.rows(), n = R.length;
    if (n && (a === 'up' || a === 'down')) { this.pick = (this.pick + (a === 'down' ? 1 : -1) + n) % n; return this.draw(); }
    if ((a === 'ok' || a === 'send') && R[this.pick]) this.deal(R[this.pick], a === 'send' ? R[this.pick].n : 1);
  }
  deal(r, n) {
    const D = this.D, save = this.save, name = D.items?.[r.item]?.name || r.item;
    const res = this.tab === 'sell' ? sell(D, save, this.id, r.item, n) : buy(D, save, this.id, r.item, n);
    if (res.ok) {
      this.note = { good: true, text: this.tab === 'sell' ? `${res.n}× ${name} verkauft · +${res.got} Δ${res.reason ? ` · ${res.reason}` : ''}` : `${res.n}× ${name} gekauft · −${res.paid} Δ${res.reason ? ` · ${res.reason}` : ''}` };
      this.scene?.sfx?.('trade_coins');
      this.scene?.box?.persist?.();
      this.host.changed?.();
    } else this.note = { good: false, text: res.reason || 'Geht nicht' };
    const R = this.rows();
    this.pick = Math.max(0, Math.min(this.pick, R.length - 1));
    this.draw();
  }
  draw() {
    const D = this.D, save = this.save, C = traderConfig(D, this.id);
    if (!save || !C) { this.el.replaceChildren(el('div', { class: 'tut-guide ui-frame' }, el('p', {}, 'Kein Händler.'), closeX(() => this.close()))); return; }
    const O = offers(D, save, this.id), R = this.tab === 'sell' ? O.sell : O.buy;
    this.pick = Math.max(0, Math.min(this.pick, R.length - 1));
    const keeper = D.companions?.[C.keeper]?.name || '';
    const tabs = el('div', { class: 'tut-tabs' }, ...keyGlyph('tabs').slice(0, 1), ...TABS.map(([k, t]) => el('button', { class: 'tut-tab' + (k === this.tab ? ' on' : ''), onclick: () => { this.tab = k; this.pick = 0; this.note = null; this.draw(); } }, t)), ...keyGlyph('tabs').slice(1));
    const list = el('ol', { class: 'tut-list ql-list tr-list' }, ...(R.length ? R.map((r, i) => {
      const t = D.items?.[r.item] || {}, mark = markOf(D, 'items', r.item, 28);
      const poor = this.tab === 'buy' && r.price > O.deltas, broke = this.tab === 'sell' && r.price > O.cash;
      return el('li', { class: (i === this.pick ? 'on' : '') + (poor || broke ? ' tr-no' : ''), onclick: () => { if (this.pick === i) this.deal(r, 1); else { this.pick = i; this.draw(); } } },
        typeof mark === 'string' ? el('i', { class: 'tr-glyph' }, mark) : mark,
        el('span', { class: 'ql-row' }, el('b', {}, t.name || r.item, el('i', { class: 'lb-n' }, ` ×${r.n}`)), el('small', {}, this.tab === 'sell' && r.sat < 100 ? `satt · ${r.sat} %` : (t.category ? catName(t.category) : ''))),
        el('b', { class: 'tr-price' }, `${r.price} Δ`));
    }) : [el('li', { class: 'ql-empty' }, this.tab === 'sell' ? `Nichts dabei, was ${keeper || C.name} ankauft.` : 'Heute nichts mehr im Angebot. Morgen gibt es neue Ware.')]));
    const r = R[this.pick], t = r ? D.items?.[r.item] || {} : null;
    const verb = this.tab === 'sell' ? 'verkaufen' : 'kaufen';
    const detail = r ? el('div', { class: 'tut-body ql-detail' }, el('div', { class: 'tut-text' },
      el('small', {}, catName(t.category) || ''), el('h2', {}, t.name || r.item),
      t.description ? el('p', {}, t.description) : null,
      el('p', { class: 'tr-line' }, this.tab === 'sell' ? `Wert ${r.full} Δ · ${keeper || 'Er'} zahlt ${r.price} Δ (${O.rate} %${r.sat < 100 ? `, satt ${r.sat} %` : ''})` : `Wert ${Math.round(valueOf(D, t))} Δ · kostet ${r.price} Δ`),
      el('p', { class: 'tr-line' }, this.tab === 'sell' ? `Du hast ${r.n}` : `Er hat ${r.n}`),
      el('div', { class: 'tr-btns' },
        el('button', { class: 'inv-btn wm-go ql-go', onclick: () => this.deal(r, 1) }, icon('coins', 16), ` 1 ${verb}`),
        r.n > 1 ? el('button', { class: 'inv-btn', onclick: () => this.deal(r, r.n) }, `Alle ${verb}`) : null))) : el('div');
    const note = this.note ? el('p', { class: 'tr-note ' + (this.note.good ? 'good' : 'bad') }, this.note.text) : null;
    this.el.replaceChildren(el('div', { class: 'tut-guide ql-box tr-box ui-frame' },
      el('header', {}, icon('coins', 20), el('h2', {}, C.name), el('small', {}, `Du: ${O.deltas} Δ · Kasse: ${O.cash} Δ · zahlt ${O.rate} %`), tabs),
      C.greeting ? el('p', { class: 'ql-say tr-greet' }, keeper ? `${keeper}: „${C.greeting}“` : C.greeting) : null,
      el('div', { class: 'tut-main' }, list, detail),
      note,
      hints([['move', 'wählen'], ['tabs', 'Verkaufen / Kaufen'], ['ok', `1 ${verb}`], ['send', `alle ${verb}`], ['back', 'schließen']], this.tab === 'sell' ? 'Verkauft wird aus Lager, Kiste und Rucksack · je mehr vom Gleichen, desto weniger zahlt er' : 'Gekauftes kommt in den Rucksack bzw. ins Lager · neue Ware jeden Tag'),
      closeX(() => this.close())));
    this.el.querySelector('.tr-list li.on')?.scrollIntoView?.({ block: 'nearest' });
  }
  state() { if (!this.isOpen) return null; const O = offers(this.D, this.save, this.id); return { id: this.id, tab: this.tab, pick: this.pick, cash: O.cash, rate: O.rate, deltas: O.deltas, sell: O.sell.map(x => `${x.item}×${x.n}@${x.price}`), buy: O.buy.map(x => `${x.item}×${x.n}@${x.price}`), note: this.note?.text || null }; }
}

const CATS = { junk: 'Schrott', resource: 'Ressource', ingredient: 'Zutat', food: 'Gericht', component: 'Bauteil', consumable: 'Verbrauchsgut', valuable: 'Wertsache', blueprint: 'Bauplan', armor: 'Rüstung', implant: 'Implantat', dronepart: 'Drohnenteil', weaponpart: 'Waffenteil', progress: 'Fortschritt' };
const catName = c => CATS[c] || '';
