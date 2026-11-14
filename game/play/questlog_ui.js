// Questlog (#016, Daniel 14.11.2026: „Wir brauchen eine Art Questlog!“): the search for AvA's cure as a chain, AvA's tank as a standing
// task, side jobs from the companions (take, follow, hand in). Opened at the warroom (map header) and at the campfire. Looks like the
// field guide; one grammar: stick/arrows choose, LB/RB or Q switch the tab, A/E does the main thing (take, hand in, follow), back closes.
// Logic in game/quests.js.
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { hints, closeX, keyGlyph } from './ui_nav.js';
import { questLog, accept, claim, track } from '../quests.js';

const TABS = [['active', 'Aktiv'], ['offers', 'Angebote'], ['done', 'Erledigt']];
const STEP = { owned: ['check', 'erledigt'], ready: ['star', 'bereit'], open: ['target', 'jetzt'], locked: ['lock', 'später'] };

export class QuestLogUI {
  // host: { scene(), toast(title, sub, kind) }
  constructor(root, host) {
    this.host = host; this.tab = 'active'; this.pick = 0;
    this.el = el('div', { class: 'tut ql', hidden: true, onclick: e => { if (e.target === this.el) this.close(); } });
    root.append(this.el);
    window.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      const map = { Escape: 'back', ArrowLeft: 'prev', ArrowRight: 'next', ArrowUp: 'up', ArrowDown: 'down', w: 'up', s: 'down', a: 'prev', d: 'next', q: 'next', Q: 'next', Tab: 'next', e: 'ok', E: 'ok', Enter: 'ok', ' ': 'ok' }[e.key];
      if (!map) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) this.act(map);
    }, true);
  }
  get isOpen() { return !this.el.hidden; }
  get scene() { return this.host.scene(); }
  get D() { return this.scene?.data_ || {}; }
  get save() { return this.scene?.box?.save || null; }
  open(tab = null) { if (tab) this.tab = tab; this.pick = 0; this.draw(); this.el.hidden = false; }
  close() { this.el.hidden = true; this.el.replaceChildren(); }
  nav(u) { for (const a of ['back', 'ok', 'up', 'down', 'next', 'prev', 'left', 'right']) if (u.pressed(a)) return this.act(a === 'left' ? 'prev' : a === 'right' ? 'next' : a); }
  log() { return this.save ? questLog(this.D, this.save) : null; }
  rows(L = this.log()) {
    if (!L) return [];
    if (this.tab === 'active') return [{ kind: 'main' }, ...(L.tank ? [{ kind: 'tank' }] : []), ...L.active.map(q => ({ kind: 'side', q }))];
    if (this.tab === 'offers') return L.offers.map(q => ({ kind: 'offer', q }));
    return L.done.map(q => ({ kind: 'done', q }));
  }
  act(a) {
    if (a === 'back') return this.close();
    if (a === 'next' || a === 'prev') { const i = TABS.findIndex(t => t[0] === this.tab); this.tab = TABS[(i + (a === 'next' ? 1 : -1) + TABS.length) % TABS.length][0]; this.pick = 0; return this.draw(); }
    const R = this.rows(), n = R.length;
    if (n && (a === 'up' || a === 'down')) { this.pick = (this.pick + (a === 'down' ? 1 : -1) + n) % n; return this.draw(); }
    if (a === 'ok' && R[this.pick]) this.primary(R[this.pick]);
  }
  // the main thing for a row: take an offer, hand in a finished job, else follow it in the HUD
  primary(r) {
    const D = this.D, save = this.save;
    if (!save) return;
    if (r.kind === 'offer') { accept(D, save, r.q.id); this.host.toast?.(`Auftrag angenommen: ${r.q.name}`, D.companions?.[r.q.giver]?.name || '', 'info'); this.tab = 'active'; this.pick = this.rows().findIndex(x => x.q?.id === r.q.id); }
    else if (r.kind === 'side' && r.q.ready) { const res = claim(D, save, r.q.id); if (res.ok) { this.host.toast?.(`Erledigt: ${r.q.name}`, res.got.join(' · '), 'good'); this.host.claimed?.(r.q, res); this.pick = 0; } }
    else if (r.kind === 'side' || r.kind === 'main') track(save, r.kind === 'main' ? 'main' : r.q.id);
    this.scene?.box?.persist?.();
    this.host.changed?.();
    this.draw();
  }
  draw() {
    const L = this.log(), D = this.D;
    if (!L) { this.el.replaceChildren(el('div', { class: 'tut-guide ui-frame' }, el('p', {}, 'Kein Spielstand.'), closeX(() => this.close()))); return; }
    const R = this.rows(L);
    this.pick = Math.max(0, Math.min(this.pick, R.length - 1));
    const tabs = el('div', { class: 'tut-tabs' }, ...keyGlyph('tabs').slice(0, 1), ...TABS.map(([k, n]) => el('button', { class: 'tut-tab' + (k === this.tab ? ' on' : ''), onclick: () => { this.tab = k; this.pick = 0; this.draw(); } }, n, k === 'offers' && L.offers.length ? el('i', { class: 'ql-dot' }, String(L.offers.length)) : null)), ...keyGlyph('tabs').slice(1));
    const giver = q => D.companions?.[q.giver]?.name || '';
    const tracked = r => r.kind === 'main' ? L.tracked === 'main' : r.kind === 'side' && L.tracked === r.q.id;
    const title = r => r.kind === 'main' ? L.main.name : r.kind === 'tank' ? 'AvAs Tank' : r.q.name || r.q.id;
    const sub = r => r.kind === 'main' ? `Hauptquest · ${Math.round(L.main.progress * 100)} %` : r.kind === 'tank' ? (L.tank.dead ? 'Kein Signal' : `${L.tank.cond} % · ${L.tank.phase}`) : r.kind === 'done' ? `${giver(r.q)} · Tag ${r.q.day}` : `${giver(r.q)}${r.kind === 'side' ? ` · ${r.q.n} / ${r.q.target}` : ''}`;
    const list = el('ol', { class: 'tut-list ql-list' }, ...(R.length ? R.map((r, i) => el('li', { class: (i === this.pick ? 'on' : '') + (r.kind === 'side' && r.q.ready ? ' ready' : '') + (r.kind === 'tank' && L.tank.cond < 45 ? ' warn' : ''), onclick: () => { if (this.pick === i) this.primary(r); else { this.pick = i; this.draw(); } } },
      icon(r.kind === 'main' ? 'flag' : r.kind === 'tank' ? 'heart' : r.kind === 'offer' ? 'speechBubble' : r.kind === 'done' ? 'check' : 'target', 14),
      el('span', { class: 'ql-row' }, el('b', {}, title(r)), el('small', {}, sub(r))), tracked(r) ? el('i', { class: 'ql-star', title: 'Wird verfolgt' }, '◆') : null))
      : [el('li', { class: 'ql-empty' }, this.tab === 'offers' ? 'Gerade hat niemand etwas für dich.' : 'Noch nichts erledigt.')]));
    this.el.replaceChildren(el('div', { class: 'tut-guide ql-box ui-frame' },
      el('header', {}, icon('list', 20), el('h2', {}, 'Questlog'), el('small', {}, `Die Suche: ${Math.round(L.main.progress * 100)} %`), tabs),
      el('div', { class: 'tut-main' }, list, R[this.pick] ? this.detail(R[this.pick], L) : el('div')),
      hints([['move', 'wählen'], ['tabs', 'Liste'], ['ok', this.okLabel(R[this.pick])], ['back', 'schließen']], 'Die verfolgte Quest steht als Zielzeile im Bild; ein schwacher Tank geht immer vor'),
      closeX(() => this.close())));
    this.el.querySelector('.ql-list li.on')?.scrollIntoView?.({ block: 'nearest' });
  }
  okLabel(r) { return !r ? 'nehmen' : r.kind === 'offer' ? 'annehmen' : r.kind === 'side' && r.q.ready ? 'abgeben' : r.kind === 'side' || r.kind === 'main' ? 'verfolgen' : '–'; }
  detail(r, L) {
    const D = this.D, giver = q => D.companions?.[q.giver]?.name || '';
    const btn = (label, ic) => el('button', { class: 'inv-btn wm-go ql-go', onclick: () => this.primary(r) }, icon(ic, 16), ' ', label);
    const reward = q => { const R = q.reward || {}, parts = [R.deltas ? `${R.deltas} Δ` : null, ...(R.items || []).map(x => `${x.count || 1}× ${D.items?.[x.item]?.name || x.item}`)].filter(Boolean); return parts.length ? el('p', { class: 'ql-reward' }, icon('gift', 14), ' ', parts.join(' · ')) : null; };
    const bar = (n, t) => el('div', { class: 'ach-bar' }, el('i', { style: `width:${Math.round(100 * n / Math.max(1, t))}%` }), el('span', {}, `${n} / ${t}`));
    if (r.kind === 'main') {
      const G = L.main.goal;
      return el('div', { class: 'tut-body ql-detail' }, el('div', { class: 'tut-text' }, el('small', {}, 'Hauptquest'), el('h2', {}, L.main.name),
        el('p', {}, 'AvAs Körper liegt im Cryo-Tank, ihr Verstand in der Drohne. Irgendwo da draußen gibt es ein Rezept für das Heilmittel. Jeder Knoten im Techtree des Warrooms bringt Leyla näher dran.'),
        G ? el('p', { class: 'ql-now' }, el('b', {}, '◆ ', G.text), el('br'), G.sub) : null,
        el('ol', { class: 'ql-steps' }, ...L.main.steps.map(s => el('li', { class: s.state + (s.goal ? ' goal' : '') }, icon(STEP[s.state]?.[0] || 'lock', 14), el('span', {}, s.name), el('small', {}, s.state === 'owned' ? 'erledigt' : s.reason || STEP[s.state]?.[1] || '')))),
        L.tracked === 'main' ? el('p', { class: 'ql-tracked' }, '◆ Wird verfolgt') : btn('Verfolgen', 'target')));
    }
    if (r.kind === 'tank') {
      const T = L.tank;
      return el('div', { class: 'tut-body ql-detail' }, el('div', { class: 'tut-text' }, el('small', {}, 'Dauerauftrag'), el('h2', {}, 'AvAs Tank'),
        el('p', {}, T.dead ? 'Der Tank ist still. In diesem Durchgang ist die Suche verloren.' : `Zustand ${T.cond} % · ${T.phase}. Ohne Wartung noch etwa ${T.days} ${T.days === 1 ? 'Tag' : 'Tage'}. Jede Rettung durch AvA kostet Zustand.`),
        T.dead ? null : bar(T.cond, 100),
        el('p', {}, 'Wartung am Cryo-Tank im Rig. Der Tank-Ast im Techtree macht ihn haltbarer. Fällt er unter 45 %, steht er in der Zielzeile vor allem anderen.')));
    }
    const q = r.q;
    return el('div', { class: 'tut-body ql-detail' }, el('div', { class: 'tut-text' }, el('small', {}, r.kind === 'offer' ? `Angebot · ${giver(q)}` : r.kind === 'done' ? `Erledigt · ${giver(q)}` : `Nebenauftrag · ${giver(q)}`), el('h2', {}, q.name || q.id),
      el('p', { class: 'ql-say' }, `„${q.text || ''}“`),
      r.kind === 'side' ? bar(q.n, q.target) : null,
      r.kind === 'side' && !q.counter && q.item ? el('small', {}, `Abgeben aus Lager, Kiste und Rucksack: ${D.items?.[q.item]?.name || q.item}`) : null,
      r.kind === 'done' && q.done ? el('p', { class: 'ql-say' }, `„${q.done}“`) : null,
      reward(q),
      r.kind === 'offer' ? btn('Annehmen', 'check') : r.kind === 'side' && q.ready ? btn('Abgeben', 'gift') : r.kind === 'side' ? (L.tracked === q.id ? el('p', { class: 'ql-tracked' }, '◆ Wird verfolgt') : btn('Verfolgen', 'target')) : null));
  }
  state() { const L = this.log(); return { open: this.isOpen, tab: this.tab, pick: this.pick, rows: this.rows(L).map(r => r.kind === 'main' || r.kind === 'tank' ? r.kind : `${r.kind}:${r.q.id}${r.q.ready ? '!' : ''}`), tracked: L?.tracked || null }; }
}
