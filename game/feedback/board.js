// Feedback board (#194): every report of the test phase, its status and the acceptance tick. Opens from the pause menu
// (over the paused game), from the main menu and as the page /feedback. Everybody with a login may edit (Daniel, 27.11.2026).
//   list: filter by status (with counts), kind, personas · a row: FB-n, kind, place, status, tick
//   detail: picture, text (editable), the trace as a timeline, „Hier spielen“, comments
//   keys: ↑ ↓ choose · Esc closes · typing in a field never reaches the game. Controller: d-pad ↑ ↓, B closes.
// Talks to worker/feedback_board.js; without a worker (locally) it says so.
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { STATUS, statusName } from './status.js';
import { CHIPS } from './dialog.js';

const chipOf = id => CHIPS.find(c => c.id === id);
const when = iso => { if (!iso) return ''; const d = new Date(iso); return `${d.getDate()}.${d.getMonth() + 1}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export class FeedbackBoard {
  constructor({ api = '/api/feedback/', onClose = null, page = false } = {}) {
    this.api = api; this.onClose = onClose; this.page = page;
    this.items = []; this.sel = null; this.filter = { status: 'aktiv', chip: '', persona: true }; this.detail = null; this.cache = {};
    this.listEl = el('div', { class: 'fbb-list', role: 'listbox' });
    this.detailEl = el('div', { class: 'fbb-detail' }, el('div', { class: 'fbb-empty' }, 'Eine Meldung wählen'));
    this.tabsEl = el('div', { class: 'fbb-tabs' });
    this.note = el('div', { class: 'fbb-note' });
    const chipSel = el('select', { class: 'fbb-select', 'aria-label': 'Art', onchange: e => { this.filter.chip = e.target.value; this.drawList(); } },
      el('option', { value: '' }, 'Alle Arten'), CHIPS.map(c => el('option', { value: c.id }, c.label)));
    const persona = el('label', { class: 'fbb-check' }, el('input', { type: 'checkbox', checked: '', onchange: e => { this.filter.persona = e.target.checked; this.drawList(); } }), ' Personas');
    this.root = el('div', { class: 'fb-overlay fbb' + (page ? ' fbb-page' : ''), role: 'dialog', 'aria-label': 'Feedback-Board' },
      el('div', { class: 'fbb-box' },
        el('div', { class: 'fb-head' }, icon('speechBubble', 18), el('span', {}, 'Feedback-Board'), this.note,
          el('button', { class: 'fb-x', type: 'button', title: 'Neu laden', 'aria-label': 'Neu laden', onclick: () => this.load() }, icon('restart', 16)),
          el('button', { class: 'fb-x', type: 'button', title: page ? 'Zur Startseite' : 'Schließen (Esc)', 'aria-label': 'Schließen', onclick: () => this.close() }, icon('x', 18))),
        el('div', { class: 'fbb-bar' }, this.tabsEl, chipSel, persona),
        el('div', { class: 'fbb-main' }, this.listEl, this.detailEl)));
    this.root.addEventListener('keydown', e => {
      e.stopPropagation();   // nothing typed here moves Leyla
      const typing = /^(TEXTAREA|INPUT|SELECT)$/.test(e.target.tagName) && e.target.type !== 'checkbox';
      if (e.key === 'Escape') { e.preventDefault(); if (typing) e.target.blur(); else this.close(); }
      else if (!typing && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); this.step(e.key === 'ArrowDown' ? 1 : -1); }
    });
    this.root.addEventListener('keyup', e => e.stopPropagation());
  }
  get isOpen() { return !!this.root.isConnected; }
  mount() {
    if (!document.querySelector('link[data-feedback]')) document.head.append(el('link', { rel: 'stylesheet', href: new URL('./feedback.css', import.meta.url).href, 'data-feedback': '' }));
    document.body.append(this.root); this.root.tabIndex = -1; this.root.focus();
    this.load(); this.pad();
    return this;
  }
  close() {
    if (this.page) { location.href = './'; return; }
    this.root.remove(); cancelAnimationFrame(this.raf); this.onClose?.();
  }
  // the controller: d-pad up / down chooses, B closes (the game is paused meanwhile)
  pad() {
    let prev = new Set();
    const poll = () => {
      if (!this.isOpen) return;
      const g = navigator.getGamepads ? [...navigator.getGamepads()].find(p => p && p.connected) : null, now = new Set();
      if (g) g.buttons.forEach((b, i) => { if (b && (b.pressed || b.value > 0.5)) now.add(i); });
      const hit = k => now.has(k) && !prev.has(k);
      if (hit(1)) this.close(); else if (hit(13)) this.step(1); else if (hit(12)) this.step(-1);
      prev = now; this.raf = requestAnimationFrame(poll);
    };
    this.raf = requestAnimationFrame(() => { prev = new Set(); poll(); });
  }

  async call(way, body) {
    const r = await fetch(this.api + way, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
    const data = await r.json().catch(() => null);
    if (!r.ok) throw Object.assign(new Error(data?.error || `HTTP ${r.status}`), { status: r.status });
    return data;
  }
  say(text, kind = '') { this.note.textContent = text; this.note.className = 'fbb-note ' + kind; }
  async load() {
    this.say('lädt …');
    try {
      const d = await this.call('list');
      this.items = d.items || []; this.repo = d.repo; this.say(`${this.items.length} Meldungen`);
    } catch (e) {
      this.items = [];
      this.say(e.status === 404 || e.status === 401 || e.status === 503 || e.status === 405 ? 'Kein Server hier: das Board geht online (nomadgirl.dna20717.workers.dev)' : `Fehler: ${e.message}`, 'bad');
    }
    this.drawList();
    if (this.sel && this.items.some(i => i.number === this.sel)) this.open(this.sel, true);
  }

  visible() {
    const f = this.filter;
    return this.items.filter(i => (f.status === 'alle' || (f.status === 'aktiv' ? i.status !== 'zu' : i.status === f.status)) && (!f.chip || i.chip === f.chip) && (f.persona || !i.persona));
  }
  drawList() {
    const f = this.filter, count = id => this.items.filter(i => (id === 'alle' || (id === 'aktiv' ? i.status !== 'zu' : i.status === id)) && (f.persona || !i.persona)).length;
    this.tabsEl.replaceChildren(...[{ id: 'aktiv', label: 'Nicht geschlossen' }, ...STATUS, { id: 'alle', label: 'Alle' }].map(s =>
      el('button', { class: 'fbb-tab' + (f.status === s.id ? ' on' : ''), type: 'button', onclick: () => { f.status = s.id; this.drawList(); } }, s.label, el('b', {}, String(count(s.id))))));
    const list = this.visible();
    this.listEl.replaceChildren(...(list.length ? list.map(i => this.row(i)) : [el('div', { class: 'fbb-empty' }, this.items.length ? 'Nichts in diesem Filter' : 'Keine Meldungen')]));
  }
  row(i) {
    const c = chipOf(i.chip);
    const status = el('select', { class: 'fbb-select fbb-st st-' + i.status, 'aria-label': 'Status', onclick: e => e.stopPropagation(), onchange: e => this.update(i.number, { status: e.target.value }) },
      STATUS.map(s => el('option', { value: s.id, ...(s.id === i.status ? { selected: '' } : {}) }, s.label)));
    const tick = el('label', { class: 'fbb-tick' + (i.accepted ? ' on' : ''), title: i.status === 'abnahme' || i.status === 'zu' ? 'Abgenommen: schließt die Meldung' : 'Erst bei „Bereit zur Abnahme“', onclick: e => e.stopPropagation() },
      el('input', { type: 'checkbox', ...(i.accepted ? { checked: '' } : {}), ...(i.status === 'abnahme' || i.status === 'zu' ? {} : { disabled: '' }), onchange: e => this.update(i.number, { accepted: e.target.checked }) }), ' Abnahme');
    const r = el('div', { class: 'fbb-row' + (this.sel === i.number ? ' on' : ''), role: 'option', 'data-n': String(i.number), onclick: () => this.open(i.number) },
      el('span', { class: 'fbb-n' }, `FB-${i.number}`), c ? icon(c.icon, 16) : icon('speechBubble', 16),
      el('div', { class: 'fbb-what' }, el('b', {}, i.where || i.title), el('small', {}, [i.text?.split('\n')[0]?.slice(0, 90) || '–', i.by ? ` · ${i.by}` : ''].join(''))),
      status, tick);
    return r;
  }
  step(d) {
    const list = this.visible(); if (!list.length) return;
    const k = list.findIndex(i => i.number === this.sel), next = list[Math.max(0, Math.min(list.length - 1, k < 0 ? 0 : k + d))];
    this.open(next.number);
    this.listEl.querySelector(`[data-n="${next.number}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  async update(n, change) {
    this.say('speichert …');
    try {
      const it = await this.call('update', { n, ...change });
      this.items = this.items.map(x => x.number === n ? { ...x, ...it } : x);
      delete this.cache[n];
      this.say(change.accepted ? `FB-${n} abgenommen ✓` : change.status ? `FB-${n}: ${statusName(it.status)}` : `FB-${n} gespeichert`, 'good');
    } catch (e) { this.say(`Nicht gespeichert: ${e.message}`, 'bad'); }
    this.drawList();
    if (this.sel === n) this.open(n, true);
  }

  async open(n, quiet = false) {
    this.sel = n;
    this.listEl.querySelectorAll('.fbb-row').forEach(r => r.classList.toggle('on', r.dataset.n === String(n)));
    if (!quiet) this.detailEl.replaceChildren(el('div', { class: 'fbb-empty' }, `FB-${n} lädt …`));
    try {
      const d = this.cache[n] ||= await this.call(`item?n=${n}`);
      const shot = d.files.find(f => /^moment\./.test(f));
      const trace = d.files.includes('trace.json') ? await (this.cache['t' + n] ||= fetch(`${this.api}file?n=${n}&f=trace.json`).then(r => r.ok ? r.json() : null).catch(() => null)) : null;
      if (this.sel === n) this.drawDetail(d, shot, trace);
    } catch (e) { this.detailEl.replaceChildren(el('div', { class: 'fbb-empty bad' }, `FB-${n}: ${e.message}`)); }
  }
  drawDetail(d, shot, trace) {
    const n = d.number, c = chipOf(d.chip), ctx = trace?.context || {};
    const text = el('textarea', { class: 'fb-text', rows: '4', maxlength: '4000' }); text.value = d.text || '';
    const comment = el('textarea', { class: 'fb-text fbb-comment', rows: '2', maxlength: '4000', placeholder: 'Kommentar, z. B. „gefixt in abc1234“ oder „bei mir noch kaputt“' });
    const q = ctx.poi ? `?poi=${encodeURIComponent(ctx.poi)}&seed=${ctx.seed}` : ctx.mode === 'camp' ? '?camp' : ctx.room ? `?room=${encodeURIComponent(ctx.room)}` : '';
    const playHref = `game.html${q}${ctx.tile && ctx.mode !== 'camp' ? `${q ? '&' : '?'}tp=${ctx.tile.join(',')}` : ''}`;
    this.detailEl.replaceChildren(
      el('div', { class: 'fbb-dhead' },
        el('h3', {}, c ? icon(c.icon, 18) : null, ` FB-${n} · ${c?.label || 'Feedback'}`),
        el('small', {}, [d.where, d.by && `von ${d.by}`, when(d.created)].filter(Boolean).join(' · ')),
        el('div', { class: 'fbb-actions' },
          el('span', { class: 'fbb-badge st-' + d.status }, statusName(d.status), d.accepted ? ' · abgenommen ✓' : ''),
          q ? el('a', { class: 'fb-btn fb-send', href: playHref, title: 'Öffnet das Spiel an dieser Stelle (POI, Seed, Kachel)' }, icon('play', 16), ' Hier spielen') : null,
          el('a', { class: 'fb-btn', href: d.url, target: '_blank', rel: 'noopener' }, icon('connect', 16), ' GitHub'))),
      shot ? el('img', { class: 'fbb-shot', src: `${this.api}file?n=${n}&f=${shot}`, alt: `Bild vom Moment FB-${n}` }) : el('div', { class: 'fbb-shot fb-noshot' }, 'kein Bild'),
      el('div', { class: 'fbb-sec' }, el('b', {}, 'Text'), text,
        el('div', { class: 'fbb-row2' }, el('button', { class: 'fb-btn', type: 'button', onclick: () => this.update(n, { text: text.value }) }, icon('save', 16), ' Text speichern'))),
      trace?.trace ? this.timeline(trace.trace) : null,
      trace ? this.facts(ctx, trace) : null,
      el('div', { class: 'fbb-sec' }, el('b', {}, `Kommentare (${d.comments.length})`),
        ...d.comments.map(k => el('div', { class: 'fbb-c' }, el('small', {}, `${k.by} · ${when(k.at)}`), el('div', {}, k.body.replace(/<\/?sub>/g, '').replace(/\*\*/g, '')))),
        comment,
        el('div', { class: 'fbb-row2' }, el('button', { class: 'fb-btn', type: 'button', onclick: () => { if (comment.value.trim()) this.update(n, { comment: comment.value }); } }, icon('send', 16), ' Kommentieren'))));
  }
  // a few lines from the trace and the context: where, version, device
  facts(ctx, tr) {
    const rows = [['Modus', ctx.mode], ['POI', ctx.poi && `${ctx.poi} · Seed ${ctx.seed}`], ['Kachel', ctx.tile?.join(', ')], ['Leben', ctx.health], ['Fenster', ctx.window], ['Version', ctx.version], ['Controller', ctx.pad], ['Bildschirm', ctx.screen], ['Browser', ctx.browser],
      ['fps', tr.trace?.fps ? `${tr.trace.fps.avg} (schlimmster Frame ${tr.trace.fps.worstMs} ms)` : null], ['Nachspielen', tr.reproduce]].filter(([, v]) => v != null && v !== '');
    return el('div', { class: 'fbb-sec' }, el('b', {}, 'Moment'), el('dl', { class: 'fbb-facts' }, rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, String(v))])));
  }
  // the trace as a timeline: health as a line, held inputs as bars, events and errors as marks; hover shows what it was
  timeline(t) {
    const S = (t.seconds || 30) * 1000, W = 600, H = 96, x = ms => Math.round(W + (ms / S) * W);
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'fbb-tl'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `Spur der letzten ${t.seconds} s`);
    const add = (tag, a, tip) => { const e = document.createElementNS(ns, tag); for (const k in a) e.setAttribute(k, a[k]); if (tip) { const ti = document.createElementNS(ns, 'title'); ti.textContent = tip; e.append(ti); } svg.append(e); return e; };
    for (let s = 0; s <= (t.seconds || 30); s += 5) { add('line', { x1: x(-s * 1000), x2: x(-s * 1000), y1: 0, y2: H, class: 'grid' }); add('text', { x: x(-s * 1000) + 2, y: H - 2, class: 'lbl' }).textContent = s ? `−${s}s` : 'jetzt'; }
    const sm = t.samples || [], hp = sm.filter(s => Number.isFinite(s.health));
    const maxHp = Math.max(100, ...hp.map(s => s.health));
    if (hp.length > 1) add('polyline', { points: hp.map(s => `${x(s.t)},${8 + (1 - s.health / maxHp) * 34}`).join(' '), class: 'hp' }, 'Leben');
    for (const s of sm.filter((_, k) => k % 2 === 0)) add('rect', { x: x(s.t) - 2, y: 6, width: 4, height: 40, class: 'hit' }, [`${(s.t / 1000).toFixed(1)} s`, s.state, `Kachel ${s.tile?.join(',')}`, `Leben ${s.health}`, s.window, s.prompt, s.enemies?.length ? `${s.enemies.length} Gegner nah` : null].filter(Boolean).join(' · '));
    const inp = t.inputs || [];
    inp.forEach((k, j) => { if (!k.held) return; const end = inp[j + 1]?.t ?? 0; add('rect', { x: x(k.t), y: 52, width: Math.max(1, x(end) - x(k.t)), height: 12, class: 'inp' }, `${k.held} (${((end - k.t) / 1000).toFixed(1)} s)`); });
    for (const e of t.events || []) add('circle', { cx: x(e.t), cy: 74, r: 4, class: 'ev' }, `${(e.t / 1000).toFixed(1)} s · ${e.type}${e.to ? ' → ' + e.to : ''}${e.value != null ? ' ' + e.value : ''}`);
    for (const e of t.errors || []) if (e.t > -S) add('circle', { cx: x(e.t), cy: 84, r: 5, class: 'err' }, `${e.message}${e.count > 1 ? ` (${e.count}×)` : ''}`);
    return el('div', { class: 'fbb-sec' }, el('b', {}, `Spur · die letzten ${t.seconds} s`), svg,
      el('div', { class: 'fbb-legend' }, el('span', { class: 'l-hp' }, 'Leben'), el('span', { class: 'l-inp' }, 'Eingaben'), el('span', { class: 'l-ev' }, `Ereignisse (${(t.events || []).length})`), el('span', { class: 'l-err' }, `Fehler (${(t.errors || []).length})`), el('span', {}, 'Maus drauf: Details')));
  }
}

export const openBoard = opts => new FeedbackBoard(opts).mount();
