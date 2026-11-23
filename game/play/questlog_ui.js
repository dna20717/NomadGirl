// Questlog (#016, Daniel 14.11.2026: „Wir brauchen eine Art Questlog!“): the search for AvA's cure as a chain, AvA's tank as a standing
// task, side jobs from the companions (take, follow, hand in). Opened at the warroom (map header) and at the campfire. Looks like the
// field guide; one grammar: stick/arrows choose, LB/RB or Q switch the tab, A/E does the main thing (take, hand in, follow), back closes.
// Logic in game/quests.js.
import { unlocked } from '../unlocks.js';   // #184
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { hints, closeX, keyGlyph } from './ui_nav.js';
import { questLog, accept, claim, track } from '../quests.js';
import { stock } from '../crafting.js';
import { CATS, view as journalView } from '../journal.js';

// #129 the Logbuch is the second tab (Daniel 21.11.: „Im Questlog als zweiter Reiter“)
const TABS = [['active', 'Aktiv'], ['log', 'Logbuch'], ['offers', 'Angebote'], ['done', 'Erledigt']];
const LOG_CATS = [['all', 'Alle', 'list'], ...CATS];
const LOG_SHOW = 150;
const STEP = { owned: ['check', 'erledigt'], ready: ['star', 'bereit'], open: ['target', 'jetzt'], locked: ['lock', 'später'] };

export class QuestLogUI {
  // host: { scene(), toast(title, sub, kind) }
  constructor(root, host) {
    this.host = host; this.tab = 'active'; this.pick = 0; this.logCat = 'all'; this.logQ = '';
    this.el = el('div', { class: 'tut ql', hidden: true, onclick: e => { if (e.target === this.el) this.close(); } });
    root.append(this.el);
    window.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      if (e.target?.classList?.contains('lb-search') && !['Escape', 'Enter', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.key)) return;   // typing a search
      const map = { Escape: 'back', ArrowLeft: 'prev', ArrowRight: 'next', ArrowUp: 'up', ArrowDown: 'down', w: 'up', s: 'down', a: 'prev', d: 'next', q: 'next', Q: 'next', Tab: 'next', e: 'ok', E: 'ok', Enter: 'ok', ' ': 'ok', r: 'context', R: 'context' }[e.key];
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
  nav(u) { for (const a of ['back', 'ok', 'up', 'down', 'next', 'prev', 'left', 'right', 'context']) if (u.pressed(a)) return this.act(a === 'left' ? 'prev' : a === 'right' ? 'next' : a); }
  log() { return this.save ? questLog(this.D, this.save) : null; }
  rows(L = this.log()) {
    if (!L) return [];
    const U = id => unlocked(this.D, this.save, id);   // #184 Meta-Baum: the search (main quest, tank) from stage 4, salvage with the Mega-Rigs
    if (this.tab === 'active') return [...(U('search') ? [{ kind: 'main' }, ...(L.tank ? [{ kind: 'tank' }] : [])] : []), ...(U('megarigs') ? (L.salvage || []).map(q => ({ kind: 'salvage', q })) : []), ...L.active.map(q => ({ kind: 'side', q }))];
    if (this.tab === 'log') return this.logView().list.slice(0, LOG_SHOW).map(e => ({ kind: 'log', e }));
    if (this.tab === 'offers') return L.offers.map(q => ({ kind: 'offer', q }));
    return L.done.map(q => ({ kind: 'done', q }));
  }
  act(a) {
    if (a === 'back') return this.close();
    if (a === 'next' || a === 'prev') { const i = TABS.findIndex(t => t[0] === this.tab); this.tab = TABS[(i + (a === 'next' ? 1 : -1) + TABS.length) % TABS.length][0]; this.pick = 0; return this.draw(); }
    if (a === 'context' && this.tab === 'log') { const i = LOG_CATS.findIndex(c => c[0] === this.logCat); this.logCat = LOG_CATS[(i + 1) % LOG_CATS.length][0]; this.pick = 0; return this.draw(); }
    const R = this.rows(), n = R.length;
    if (n && (a === 'up' || a === 'down')) { this.pick = (this.pick + (a === 'down' ? 1 : -1) + n) % n; return this.draw(); }
    if (a === 'ok' && R[this.pick]) this.primary(R[this.pick]);
  }
  logView() { return journalView(this.save, { cat: this.logCat, q: this.logQ }); }
  // the main thing for a row: take an offer, hand in a finished job, else follow it in the HUD
  primary(r) {
    const D = this.D, save = this.save;
    if (!save || r.kind === 'log') return;
    if (r.kind === 'offer') { accept(D, save, r.q.id); this.host.toast?.(`Auftrag angenommen: ${r.q.name}`, D.companions?.[r.q.giver]?.name || '', 'info'); this.tab = 'active'; this.pick = this.rows().findIndex(x => x.q?.id === r.q.id); }
    else if (r.kind === 'side' && r.q.ready && !r.q.gang) { const res = claim(D, save, r.q.id); if (res.ok) { this.host.toast?.(`Erledigt: ${r.q.name}`, res.got.join(' · '), 'good'); this.host.claimed?.(r.q, res); this.pick = 0; } }
    else if (r.kind === 'salvage') track(save, 'salvage:' + r.q.id);
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
    if (this.tab === 'log') return this.drawLog(L, R, tabs);
    const giver = q => q.gang || D.companions?.[q.giver]?.name || '';
    const tracked = r => r.kind === 'main' ? L.tracked === 'main' : r.kind === 'salvage' ? L.tracked === 'salvage:' + r.q.id : r.kind === 'side' && L.tracked === r.q.id;
    const title = r => r.kind === 'main' ? L.main.name : r.kind === 'tank' ? 'AvAs Tank' : r.q.name || r.q.id;
    const sub = r => r.kind === 'salvage' ? `Bergung · ${Math.round(r.q.share * 100)} %${r.q.site ? ` · ${r.q.site}` : ''}` : r.kind === 'main' ? `Hauptquest · ${Math.round(L.main.progress * 100)} %` : r.kind === 'tank' ? (L.tank.dead ? 'Kein Signal' : `${L.tank.cond} % · ${L.tank.phase}`) : r.kind === 'done' ? `${giver(r.q)} · Tag ${r.q.day}` : `${giver(r.q)}${r.kind === 'side' ? ` · ${r.q.n} / ${r.q.target}` : ''}`;
    const list = el('ol', { class: 'tut-list ql-list' }, ...(R.length ? R.map((r, i) => el('li', { class: (i === this.pick ? 'on' : '') + (r.kind === 'side' && r.q.ready ? ' ready' : '') + (r.kind === 'tank' && L.tank.cond < 45 ? ' warn' : ''), onclick: () => { if (this.pick === i) this.primary(r); else { this.pick = i; this.draw(); } } },
      icon(r.kind === 'main' ? 'flag' : r.kind === 'tank' ? 'heart' : r.kind === 'salvage' ? 'vehicle' : r.kind === 'offer' ? 'speechBubble' : r.kind === 'done' ? 'check' : 'target', 14),
      el('span', { class: 'ql-row' }, el('b', {}, title(r)), el('small', {}, sub(r))), tracked(r) ? el('i', { class: 'ql-star', title: 'Wird verfolgt' }, '◆') : null))
      : [el('li', { class: 'ql-empty' }, this.tab === 'offers' ? 'Gerade hat niemand etwas für dich.' : this.tab === 'active' ? 'Gerade nichts zu tun. Frag im Camp herum.' : 'Noch nichts erledigt.')]));
    this.el.replaceChildren(el('div', { class: 'tut-guide ql-box ui-frame' },
      el('header', {}, icon('list', 20), el('h2', {}, 'Questlog'), el('small', {}, unlocked(D, this.save, 'search') ? `Die Suche: ${Math.round(L.main.progress * 100)} %` : 'Aufträge aus dem Camp'), tabs),
      el('div', { class: 'tut-main' }, list, R[this.pick] ? this.detail(R[this.pick], L) : el('div')),
      hints([['move', 'wählen'], ['tabs', 'Liste'], ['ok', this.okLabel(R[this.pick])], ['back', 'schließen']], 'Die verfolgte Quest steht als Zielzeile im Bild; ein schwacher Tank geht immer vor'),
      closeX(() => this.close())));
    this.el.querySelector('.ql-list li.on')?.scrollIntoView?.({ block: 'nearest' });
  }
  // #129 the Logbuch: category chips (R / X switches), search (keyboard), entries grouped by day, newest first; detail on the right
  drawLog(L, R, tabs) {
    const D = this.D, V = this.logView(), total = this.save?.journal?.length || 0;
    const chips = el('div', { class: 'lb-cats' }, ...LOG_CATS.map(([id, name, ic]) => el('button', { class: 'lb-cat' + (id === this.logCat ? ' on' : ''), onclick: () => { this.logCat = id; this.pick = 0; this.draw(); } }, icon(ic, 13), ' ', name, id !== 'all' && V.counts[id] ? el('i', {}, String(V.counts[id])) : null)));
    const search = el('input', { class: 'lb-search', type: 'search', placeholder: 'Suchen …', value: this.logQ, oninput: e => { this.logQ = e.target.value; this.pick = 0; const at = e.target.selectionStart; this.draw(); const s = this.el.querySelector('.lb-search'); s?.focus(); s?.setSelectionRange?.(at, at); } });
    const catOf = id => LOG_CATS.find(c => c[0] === id) || LOG_CATS[0];
    const items = [];
    let day = null;
    R.forEach((r, i) => {
      const e = r.e;
      if (e.day !== day) { day = e.day; items.push(el('li', { class: 'lb-day' }, `Tag ${day}`)); }
      items.push(el('li', { class: (i === this.pick ? 'on' : '') + ` lb-${e.cat}`, onclick: () => { this.pick = i; this.draw(); } }, icon(catOf(e.cat)[2], 14),
        el('span', { class: 'ql-row' }, el('b', {}, e.title, e.n > 1 ? el('i', { class: 'lb-n' }, ` ×${e.n}`) : null), el('small', {}, [e.at?.replace(/^Tag \d+ · /, ''), e.sub].filter(Boolean).join(' · ')))));
    });
    const list = el('ol', { class: 'tut-list ql-list lb-list' }, ...(items.length ? items : [el('li', { class: 'ql-empty' }, total ? 'Nichts gefunden.' : 'Noch keine Einträge in diesem Durchgang.')]));
    const e = R[this.pick]?.e, poi = e?.run ? (D.pois?.[e.run]?.name || e.run) : null;
    const detail = e ? el('div', { class: 'tut-body ql-detail' }, el('div', { class: 'tut-text' }, el('small', {}, `${catOf(e.cat)[1]} · ${e.at || ''}`), el('h2', {}, e.title),
      e.sub ? el('p', {}, e.sub) : null, e.n > 1 ? el('p', { class: 'ql-say' }, `${e.n}× hintereinander`) : null, poi ? el('p', {}, icon('map', 14), ' Im Run: ', poi) : null)) : el('div');
    this.el.replaceChildren(el('div', { class: 'tut-guide ql-box ui-frame' },
      el('header', {}, icon('list', 20), el('h2', {}, 'Logbuch'), el('small', {}, `${total} Einträge in diesem Durchgang`), tabs),
      el('div', { class: 'lb-head' }, chips, search),
      el('div', { class: 'tut-main' }, list, detail),
      hints([['move', 'wählen'], ['tabs', 'Liste'], ['context', 'Kategorie'], ['back', 'schließen']], 'Jeder Durchgang beginnt mit einem leeren Logbuch'),
      closeX(() => this.close())));
    this.el.querySelector('.ql-list li.on')?.scrollIntoView?.({ block: 'nearest' });
  }
  okLabel(r) { return !r ? 'nehmen' : r.kind === 'offer' ? 'annehmen' : r.kind === 'side' && r.q.ready ? 'abgeben' : r.kind === 'side' || r.kind === 'main' || r.kind === 'salvage' ? 'verfolgen' : '–'; }
  detail(r, L) {
    const D = this.D, giver = q => D.companions?.[q.giver]?.name || '';
    const btn = (label, ic) => el('button', { class: 'inv-btn wm-go ql-go', onclick: () => this.primary(r) }, icon(ic, 16), ' ', label);
    const reward = q => { const R = q.reward || {}, parts = [R.reveal ? `Ort: ${D.locations?.[R.reveal]?.name || R.reveal}` : null, R.rep && q.gang ? `Ruf ${q.gang} +${R.rep}` : null, R.deltas ? `${R.deltas} Δ` : null, ...(R.items || []).map(x => `${x.count || 1}× ${D.items?.[x.item]?.name || x.item}`)].filter(Boolean); return parts.length ? el('p', { class: 'ql-reward' }, icon('gift', 14), ' ', parts.join(' · ')) : null; };
    const bar = (n, t) => el('div', { class: 'ach-bar' }, el('i', { style: `width:${Math.round(100 * n / Math.max(1, t))}%` }), el('span', {}, `${n} / ${t}`));
    if (r.kind === 'main') {
      const G = L.main.goal;
      return el('div', { class: 'tut-body ql-detail' }, el('div', { class: 'tut-text' }, el('small', {}, 'Hauptquest'), el('h2', {}, L.main.name),
        el('p', {}, 'AvAs Körper liegt im Cryo-Tank, ihr Verstand in der Drohne. Irgendwo da draußen gibt es ein Rezept für das Heilmittel. Jeder Knoten im Techtree des Warrooms bringt Leyla näher dran.'),
        G ? el('p', { class: 'ql-now' }, el('b', {}, '◆ ', G.text), el('br'), G.sub) : null,
        el('ol', { class: 'ql-steps' }, ...L.main.steps.map(s => el('li', { class: s.state + (s.goal ? ' goal' : '') }, icon(STEP[s.state]?.[0] || 'lock', 14), el('span', {}, s.name), el('small', {}, s.state === 'owned' ? 'erledigt' : s.reason || STEP[s.state]?.[1] || '')))),
        L.tracked === 'main' ? el('p', { class: 'ql-tracked' }, '◆ Wird verfolgt') : btn('Verfolgen', 'target')));
    }
    if (r.kind === 'salvage') {
      const q = r.q;
      return el('div', { class: 'tut-body ql-detail' }, el('div', { class: 'tut-text' }, el('small', {}, `Bergung${q.reward ? ` · Belohnung: ${q.reward}` : ''}`), el('h2', {}, q.name),
        el('p', {}, q.site ? `Das Wrack liegt in ${q.site}${q.here ? ' (hier, am Ende des Camps)' : ''}. Hinfahren, Teile einbauen, wieder los.` : 'Der Fundort steht auf der Reisekarte.'),
        q.description ? el('p', { class: 'ql-say' }, q.description) : null,
        bar(q.got, q.total),
        el('ol', { class: 'ql-steps' }, ...q.sections.map((sec, i) => el('li', { class: sec.done ? 'owned' : i === q.current ? 'open' : 'locked' }, icon(sec.done ? 'check' : i === q.current ? 'target' : 'lock', 14), el('span', {}, sec.name),
          el('small', {}, sec.done ? 'eingebaut' : sec.rows.map(x => `${x.name} ${x.built}/${x.count}${i === q.current && x.built < x.count ? ` (${x.have} da${x.whereNames.length ? `, liegt in ${x.whereNames.join(', ')}` : ''})` : ''}`).join(' · '))))),
        q.ready ? el('p', { class: 'ql-now' }, el('b', {}, '◆ Bereit zum Probestart'), el('br'), 'Am Wrack E drücken') : null,
        L.tracked === 'salvage:' + q.id ? el('p', { class: 'ql-tracked' }, '◆ Wird verfolgt') : btn('Verfolgen', 'target')));
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
      r.kind === 'side' && !q.counter && q.pieces?.length ? el('small', {}, q.pieces.map(x => `${(stock(D, this.save)[x] || 0) > 0 ? '✓' : '·'} ${D.items?.[x]?.name || x}`).join('  ')) : null,   // #057
      r.kind === 'done' && q.done ? el('p', { class: 'ql-say' }, `„${q.done}“`) : null,
      reward(q),
      r.kind === 'side' && q.gang && q.ready ? el('p', { class: 'ql-now' }, el('b', {}, '◆ Erledigt'), el('br'), `Abgeben im Revier der ${q.gang}: mit einem von ihnen reden`) : r.kind === 'offer' ? btn('Annehmen', 'check') : r.kind === 'side' && q.ready ? btn('Abgeben', 'gift') : r.kind === 'side' ? (L.tracked === q.id ? el('p', { class: 'ql-tracked' }, '◆ Wird verfolgt') : btn('Verfolgen', 'target')) : null));
  }
  state() { const L = this.log(); return { open: this.isOpen, tab: this.tab, pick: this.pick, logCat: this.logCat, logQ: this.logQ, rows: this.rows(L).map(r => r.kind === 'log' ? `log:${r.e.cat}:${r.e.title}` : r.kind === 'main' || r.kind === 'tank' ? r.kind : r.kind === 'salvage' ? `salvage:${r.q.id}` : `${r.kind}:${r.q.id}${r.q.ready ? '!' : ''}`), tracked: L?.tracked || null }; }
}
