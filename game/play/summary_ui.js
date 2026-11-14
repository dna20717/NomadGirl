// Beute-Bilanz (#017): when Leyla is back from a run, one card says how it went and where to go next: rank with its three parts,
// Δ, what came home (progress resources first), what is new (recipes, tech nodes now affordable, jobs), AvA's tank, and a gold button to
// the most useful next stop (Questlog, Techtree, Cryo-Tank, the workshop of the new recipes). Pauses like every window. Logic: summary.js.
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { hints, closeX } from './ui_nav.js';
import { markOf } from './inventory_ui.js';

export class SummaryUI {
  // host: { scene(), go(next) }
  constructor(root, host) {
    this.host = host;
    this.el = el('div', { class: 'tut sum', hidden: true, onclick: e => { if (e.target === this.el) this.close(); } });
    root.append(this.el);
    window.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      const map = { Escape: 'back', Enter: 'ok', ' ': 'ok', e: 'ok', E: 'ok', ArrowLeft: 'left', ArrowRight: 'right', a: 'left', d: 'right' }[e.key];
      if (!map) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) this.act(map);
    }, true);
  }
  get isOpen() { return !this.el.hidden; }
  open(S) { this.S = S; this.btn = S.next ? 1 : 0; this.draw(); this.el.hidden = false; }
  close() { this.el.hidden = true; this.el.replaceChildren(); this.S = null; }
  nav(u) { for (const a of ['back', 'ok', 'left', 'right']) if (u.pressed(a)) return this.act(a); }
  act(a) {
    if (a === 'back') return this.close();
    if ((a === 'left' || a === 'right') && this.S?.next) { this.btn = a === 'left' ? 0 : 1; return this.draw(); }
    if (a === 'ok') { const next = this.btn === 1 ? this.S?.next : null; this.close(); if (next) this.host.go?.(next); }
  }
  draw() {
    const S = this.S, D = this.host.scene()?.data_ || {};
    if (!S) return;
    const part = (label, v, max) => el('div', { class: 'sum-part' }, el('small', {}, label), el('div', { class: 'ach-bar' }, el('i', { style: `width:${Math.round(100 * (v || 0) / Math.max(1, max || 1))}%` }), el('span', {}, String(v ?? 0))));
    const P = D.ranking?.points || {};
    const head = el('div', { class: 'sum-head' },
      S.grade ? el('div', { class: `sum-grade g${S.grade}` }, S.grade) : el('div', { class: 'sum-grade none' }, S.ko ? icon('heart', 34) : '–'),
      el('div', { class: 'sum-title' }, el('small', {}, S.poi || ''), el('h2', {}, S.title),
        el('p', {}, [S.paid != null && !S.ko ? `+${S.paid} Δ${S.grade ? ` (${S.base} + ${S.bonus} %)` : ''}` : null, S.killsMax != null ? `${S.kills}/${S.killsMax} Kills` : `${S.kills || 0} Kills`, S.secretsMax ? `${S.secrets}/${S.secretsMax} Secrets` : null, S.time || null].filter(Boolean).join(' · '))),
      S.parts ? el('div', { class: 'sum-parts' }, part('Zeit', S.parts.time, P.time), part('Kills', S.parts.kills, P.kills), part('Secrets', S.parts.secrets, P.secrets)) : null);
    const thing = x => el('li', { class: x.resource ? 'res' : '' }, markOf(D, 'items', x.id, 28) || icon('box', 16), el('span', {}, x.name), el('b', {}, `×${x.n}`));
    const home = S.ko ? el('div', { class: 'sum-col' }, el('h3', {}, icon('warning', 14), ' Verloren'), S.lost.length ? el('ul', { class: 'sum-things lost' }, ...S.lost.slice(0, 8).map(thing)) : el('p', {}, 'Nichts. Der Rucksack war leer.'))
      : el('div', { class: 'sum-col' }, el('h3', {}, icon('bags', 14), ' Mitgebracht'), S.gained.length ? el('ul', { class: 'sum-things' }, ...S.gained.slice(0, 8).map(thing), S.gained.length > 8 ? el('li', { class: 'more' }, `+ ${S.gained.length - 8} weitere`) : null) : el('p', {}, 'Mit leeren Taschen zurück.'));
    const news = [
      ...S.recipes.map(r => el('li', {}, icon('item', 14), el('span', {}, 'Rezept gelernt: ', el('b', {}, r)))),
      ...S.ready.map(n => el('li', { class: 'gold' }, icon('tree', 14), el('span', {}, 'Techtree: ', el('b', {}, n), ' jetzt bezahlbar'))),
      ...S.quests.map(q => el('li', { class: q.ready ? 'gold' : '' }, icon('list', 14), el('span', {}, el('b', {}, q.name), q.ready ? ' · erledigt, abgeben' : ` · ${q.from} → ${q.to} / ${q.target}`))),
      ...(S.tank ? [el('li', { class: S.tank.to < 45 ? 'warn' : '' }, icon('heart', 14), el('span', {}, `AvAs Tank: ${S.tank.from} % → `, el('b', {}, `${S.tank.to} %`)))] : []),
    ];
    const newCol = el('div', { class: 'sum-col' }, el('h3', {}, icon('star', 14), ' Neu'), news.length ? el('ul', { class: 'sum-news' }, ...news) : el('p', {}, 'Nichts Neues. Morgen vielleicht.'));
    const btns = el('div', { class: 'sum-btns' },
      el('button', { class: 'inv-btn' + (this.btn === 0 ? ' on' : ''), onclick: () => { this.btn = 0; this.act('ok'); } }, 'Weiter'),
      S.next ? el('button', { class: 'inv-btn wm-go' + (this.btn === 1 ? ' on' : ''), onclick: () => { this.btn = 1; this.act('ok'); } }, icon('arrow_right', 16), ` ${S.next.label}`, el('small', {}, S.next.sub)) : null);
    this.el.replaceChildren(el('div', { class: 'tut-card sum-card ui-frame' }, head, el('div', { class: 'sum-cols' }, home, newCol), btns,
      hints([...(S.next ? [['move', 'wählen']] : []), ['ok', 'weiter'], ['back', 'schließen']]), closeX(() => this.close())));
  }
  state() { const S = this.S; return { open: this.isOpen, grade: S?.grade || null, ko: !!S?.ko, gained: (S?.gained || []).map(x => `${x.id}×${x.n}`), lost: (S?.lost || []).map(x => `${x.id}×${x.n}`), recipes: S?.recipes || [], ready: S?.ready || [], quests: (S?.quests || []).map(q => q.id + (q.ready ? '!' : '')), next: S?.next || null, btn: this.btn }; }
}
