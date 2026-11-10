// NomadGirl – workshop (data editor for every aspect of the game).
// Built on the shared core from NomadTactics/Cosy: design tokens (ui.css), base styles (basis.css), ui.js (dialogs, search,
// dragging on numbers, inspector head), icons.js, store.js (artifact database or localStorage).
// Unlike the Tactics workshop, the pages are generated from engine/schema.js: a new area or field there shows up here.
// Layout like Build › Data: navigation on the left, one area in the middle, the inspector on the right.
import { icon } from '../icons.js';
import { el, openDialogue, suchChoice, draggable, inspectorHead, cleanId } from '../ui.js';
import { openStore } from '../store.js';
import { openCloudStore } from '../cloud_store.js';
import { browserLoader } from '../browser_loader.js';
import { AREAS, GROUPS, fields, loadProject, validateProject, usages, references, renameEntry, removeEntry, rowText, optionLabel, get, set, freeId } from '../../engine/project.js';
import { SUMMARY } from './summaries.js';
import { assetPreview, assetThumb, iconSheet } from './asset_preview.js';

const THEMES = { gray: 'Grau', violet: 'Violett', brightness: 'Hell' };
// Web workshop: save automatically after this many seconds without a new change (?autosave=5 for tests)
const AUTOSAVE = (() => { try { const n = Number(new URLSearchParams(location.search).get('autosave')); return n > 0 ? n : 60; } catch { return 60; } })();
const secondsText = s => s % 60 ? `${s} s` : s === 60 ? '1 Minute' : `${s / 60} Minuten`;
const clockTime = () => new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const PAIR = { size: ['B', 'H'], point: ['x', 'y'], range: ['min', 'max'] };

export class Workshop {
  constructor(root, basis) {
    this.root = root; this.basis = basis;
    this.undo = []; this.redo = []; this.dirty = new Set();
    this.page = { area: 'overview', choice: null };
    this.filter = '';
  }

  async start() {
    try { this.store = await openCloudStore(); } catch (e) { this.cloudError = e.message; }
    if (!this.store) this.store = await openStore({ project: 'nomadgirl', withoutAssets: true });
    this.state = await this.store.all().catch(() => new Map());
    const repo = browserLoader(this.basis), state = this.state;
    const loader = { ...repo, json: async p => state.has(p) ? structuredClone(state.get(p)) : repo.json(p) };
    this.p = await loadProject(loader);
    try { const h = JSON.parse(decodeURIComponent(location.hash.slice(1)) || 'null'); if (h?.area) this.page = { ...this.page, ...h }; } catch { /* no saved place */ }
    this.constructUi();
    this.draw();
    addEventListener('keydown', e => this.key(e));
    addEventListener('beforeunload', e => { if (this.dirty.size) { e.preventDefault(); e.returnValue = ''; } });
  }

  // ---------- Undo, edit, save ----------
  snapshot() { return JSON.stringify(this.p.data); }
  restore(s) {
    const before = this.snapshot(), data = JSON.parse(s), old = JSON.parse(before);
    for (const a of Object.keys(AREAS)) if (JSON.stringify(old[a]) !== JSON.stringify(data[a])) this.dirty.add(this.p.paths[a]);
    this.p.data = data; this.planAutosave(); this.draw();
  }
  begin() { this.undo.push(this.snapshot()); if (this.undo.length > 100) this.undo.shift(); this.redo = []; }
  undoStep() { if (this.undo.length) { this.redo.push(this.snapshot()); this.restore(this.undo.pop()); } }
  redoStep() { if (this.redo.length) { this.undo.push(this.snapshot()); this.restore(this.redo.pop()); } }
  changed(area) { if (area) this.dirty.add(this.p.paths[area]); this.planAutosave(); }
  // Web workshop: one minute after the last change everything is saved (= one commit)
  planAutosave() {
    if (this.store?.kind !== 'cloud') return;
    clearTimeout(this.autosaveTimer);
    if (this.dirty.size) this.autosaveTimer = setTimeout(() => this.persist({ auto: true }), AUTOSAVE * 1000);
  }
  change(area, f) { this.begin(); const r = f(); this.changed(area); this.draw(); return r; }
  content(file) { const a = Object.keys(this.p.paths).find(k => this.p.paths[k] === file); return a ? this.p.data[a] : null; }
  async persist(opt = {}) {
    if (this.store.saveAll) return this.persistCloud(opt);
    if (!this.dirty.size) { this.hint('Nichts zu speichern.'); return; }
    this.storeError = null;
    try {
      for (const d of [...this.dirty]) { const x = this.content(d); await this.store.persist(d, x); this.dirty.delete(d); this.state.set(d, x); }
      this.latestSaved = clockTime();
      this.hint(this.store.kind === 'artifact' ? 'Gespeichert. Ava übernimmt die Stände ins Repository.' : 'Gespeichert (in diesem Browser).');
    } catch (e) { this.storeError = e.message; this.hint('Speichern fehlgeschlagen: ' + e.message); }
    this.drawMenu();
  }
  // Web workshop: all changed files as one commit into the repository
  async persistCloud({ auto = false, force = false } = {}) {
    clearTimeout(this.autosaveTimer);
    if (this.saving) { this.saveAgain = true; return; }
    if (!this.dirty.size) { if (!auto) this.hint('Nichts zu speichern.'); return; }
    const files = [...this.dirty], sent = new Map(files.map(d => [d, JSON.stringify(this.content(d))]));
    const changes = files.map(d => ({ file: d, content: this.content(d) ?? null }));
    this.saving = true; this.storeError = null; this.statusShowing('saves');
    try {
      const r = await this.store.saveAll(changes, { force });
      for (const d of files) { if (JSON.stringify(this.content(d)) === sent.get(d)) this.dirty.delete(d); this.state.set(d, this.content(d)); }
      this.latestSaved = clockTime(); this.latestCommit = r.short;
      this.hint(r.unchanged ? 'Gespeichert (keine inhaltliche Änderung).' : `Gespeichert${auto ? ' (automatisch)' : ''} · Commit ${r.short} im Repository. Spiel neu laden zum Ausprobieren.`);
    } catch (e) {
      if (e.status === 409 && e.conflicts?.length) this.conflict(e.conflicts);
      else { this.storeError = e.message; this.hint('Speichern fehlgeschlagen: ' + e.message); }
    } finally {
      this.saving = false;
    }
    this.drawMenu();
    if (this.saveAgain) { this.saveAgain = false; this.persistCloud({ auto: true }); }
    else this.planAutosave();
  }
  conflict(files) {
    this.storeError = 'Konflikt beim Speichern';
    openDialogue({
      title: 'Jemand war schneller', icon: 'warning',
      content: [el('p', {}, `Diese ${files.length === 1 ? 'Datei wurde' : 'Dateien wurden'} inzwischen von jemand anderem geändert:`),
        el('ul', {}, ...files.map(f => el('li', {}, el('code', {}, f)))),
        el('p', { class: 'ed-small' }, '„Neu laden“ holt den aktuellen Stand und verwirft deine ungespeicherten Änderungen. „Überschreiben“ speichert deinen Stand trotzdem, die Änderungen der anderen an diesen Dateien gehen dann verloren (im Git-Verlauf bleiben sie erhalten).')],
      left: [el('button', { class: 'ed-button wide red', onclick: () => { document.querySelector('.ed-dialogue')?.remove(); this.persistCloud({ force: true }); } }, 'Überschreiben')],
      main: { text: 'Neu laden', icon: 'restart', action: () => { this.dirty.clear(); location.reload(); } },
    });
  }
  // Jump into the game: save first (the game reads the saved state), then open it in its own tab (reused on every click).
  // The tab is opened right away, otherwise browsers (Safari on the iPad) block it after the save.
  // play(room) plays a room block; play(null, '?poi=<id>&seed=<n>') a POI level
  async play(room = this.playRoom(), query = null) {
    const url = new URL(`../../game.html${query || (room ? `?room=${encodeURIComponent(room)}` : '')}`, import.meta.url).href;
    const tab = window.open('', 'nomadgirl-game');
    if (this.dirty.size) {
      this.hint('Speichere, dann geht’s ins Spiel …');
      await this.persist();
      if (this.dirty.size || this.storeError) { tab?.close(); return; }   // save failed or conflict: stay here
    }
    if (tab) { tab.location.href = url; tab.focus(); } else location.href = url;
  }
  playRoom() { return this.page.area === 'rooms' && this.page.choice && this.p.data.rooms?.[this.page.choice]?.layout?.length ? this.page.choice : null; }
  // Web workshop: the name in the commits (kept in this browser until profiles come)
  showName() {
    const st = this.store;
    const name = el('input', { class: 'ed-field', value: st.user.name || '', maxlength: 40 });
    openDialogue({
      title: 'Dein Name', icon: 'person',
      content: [
        el('p', { class: 'ed-small' }, `Angemeldet als ${st.user.email}. Diese Adresse bleibt privat und landet nie im Repository.`),
        el('label', { class: 'da-field' }, el('span', {}, 'Name'), el('div', {}, name, el('p', { class: 'ed-small' }, 'So stehst du als Autor in den Commits. Gemerkt in diesem Browser.')))],
      main: { text: 'Übernehmen', icon: 'check', action: ({ error }) => {
        try { st.setName(name.value); } catch (e) { error(e.message); return false; }
        this.drawMenu(); this.hint(`Du heißt jetzt ${st.user.name}.`);
      } },
    });
  }
  key(e) {
    const t = e.target, writes = t.matches?.('input, textarea, select') && !(e.metaKey || e.ctrlKey);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); this.persist(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); this.play(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !t.matches?.('input, textarea')) { e.preventDefault(); e.shiftKey ? this.redoStep() : this.undoStep(); return; }
    if (writes) return;
    if (e.key === '?') this.showHelp();
  }

  // ---------- Frame ----------
  constructUi() {
    document.body.classList.add('build', 'data-mode');
    this.ui = { menu: el('div', { class: 'ed-menu' }), data: el('div', { class: 'ed-data ng-data' }), hint: el('div', { class: 'ed-hint' }) };
    this.root.replaceChildren(this.ui.menu, this.ui.data, this.ui.hint);
    this.root.hidden = false;
  }
  statusContent(kind) {
    const n = this.dirty.size;
    if (n && !this.unsavedSince) this.unsavedSince = clockTime();
    if (!n) this.unsavedSince = null;
    if (kind === 'saves') return ['isOpen', icon('save', 14), this.store?.kind === 'cloud' ? 'Schreibe ins Repository …' : 'Speichere …', '', ''];
    if (this.store?.kind === 'cloud' && !this.storeError) {
      if (n) return ['isOpen', el('i', { class: 'ed-status-point' }), 'Ungespeichert · seit ', this.unsavedSince, `Ungespeichert seit ${this.unsavedSince} · ${n} ${n === 1 ? 'Datei' : 'Dateien'} geändert · speichert automatisch nach ${secondsText(AUTOSAVE)} Ruhe · ⌘S speichert sofort`];
      if (this.latestSaved) return ['ok', icon('check', 14), 'Gespeichert · ', this.latestSaved, `Gespeichert um ${this.latestSaved} als Commit ${this.latestCommit} in ${this.store.repo}`];
    }
    return this.storeError ? ['error', icon('warning', 14), 'Fehler beim Speichern', '', this.storeError]
      : n ? ['isOpen', el('i', { class: 'ed-status-point' }), 'Ungespeichert · seit ', this.unsavedSince, `Ungespeichert seit ${this.unsavedSince} · ${n} ${n === 1 ? 'Datei' : 'Dateien'} geändert · ⌘S speichert`]
        : this.latestSaved ? ['ok', icon('check', 14), 'Gespeichert · ', this.latestSaved, `Gespeichert um ${this.latestSaved}`]
          : ['empty', icon('check', 14), 'Nichts geändert', '', 'Seit dem Laden nichts geändert'];
  }
  statusShowing(kind) {
    const [a, ic, text, time, title] = this.statusContent(kind);
    this.ui.status.className = 'ed-status ' + a; this.ui.status.title = title;
    this.ui.status.replaceChildren(ic, el('span', {}, el('span', { class: 'ed-status-text' + (time ? '' : ' alone') }, text), time ? el('span', { class: 'ed-status-time' }, time) : null));
  }
  drawMenu() {
    const ui = this.ui, m = this.messages || [];
    const error = m.filter(x => x.kind === 'error').length, warn = m.filter(x => x.kind === 'warning').length;
    ui.status = el('span', { class: 'ed-status' });
    ui.menu.replaceChildren(...[
      el('span', { class: 'ng-title' }, icon('vehicle', 18), el('b', {}, 'NomadGirl'), el('span', {}, 'Werkstatt')),
      el('button', { class: 'ed-button main ng-play', title: (this.playRoom() ? `Raum „${this.p.data.rooms[this.playRoom()].name || this.playRoom()}“ spielen` : 'Testraum spielen') + ' · speichert vorher (⌘P)', onclick: () => this.play() }, icon('play', 16), ' Spielen'),
      el('span', { class: 'ed-separator' }),
      el('button', { class: 'ed-button', title: 'Speichern (⌘S)', onclick: () => this.persist() }, icon('save', 18)),
      ui.status,
      el('span', { class: 'ed-separator' }),
      el('button', { class: 'ed-button', title: 'Rückgängig (⌘Z)', disabled: !this.undo.length, onclick: () => this.undoStep() }, icon('undo', 18)),
      el('button', { class: 'ed-button', title: 'Wiederholen (⇧⌘Z)', disabled: !this.redo.length, onclick: () => this.redoStep() }, icon('redo', 18)),
      el('span', { class: 'ed-separator' }),
      el('button', { class: 'ed-button ng-checkButton' + (error ? ' red' : warn ? ' yellow' : ' green'), title: 'Prüfung (wie ng check)', onclick: () => this.go({ area: 'validation' }) },
        icon(error ? 'error' : warn ? 'warning' : 'verify', 16), error ? ` ${error} Fehler` : warn ? ` ${warn} Warnungen` : ' Alles stimmig'),
      el('span', { class: 'ed-grow' }),
      this.store.kind === 'cloud' ? el('button', { class: 'ed-button ng-user', title: `Dein Name in den Commits · angemeldet als ${this.store.user.email} · speichert direkt in ${this.store.repo}`, onclick: () => this.showName() },
        icon('person', 16), ' ' + this.store.user.name) : null,
      this.cloudError ? el('span', { class: 'ed-small ng-state', title: this.cloudError }, icon('warning', 14), ' Nur in diesem Browser') : null,
      this.state.size && this.store.kind !== 'cloud' ? el('span', { class: 'ed-small ng-state', title: 'Gespeicherte Stände überdecken diese Repo-Dateien, bis Ava sie übernimmt: ' + [...this.state.keys()].join(', ') }, icon('info', 14), ` ${this.state.size} gespeicherte ${this.state.size === 1 ? 'Datei' : 'Dateien'}`) : null,
      el('button', { class: 'ed-button', title: `Darstellung: ${THEMES[document.documentElement.dataset.theme] || 'Grau'}`, onclick: () => this.nextTheme() }, icon('contrast', 18)),
      el('button', { class: 'ed-button', title: 'Hilfe (?)', onclick: () => this.showHelp() }, icon('help', 18))].filter(Boolean));
    this.statusShowing();
  }
  nextTheme() {
    const ids = Object.keys(THEMES), n = ids[(ids.indexOf(document.documentElement.dataset.theme) + 1) % ids.length];
    document.documentElement.dataset.theme = n; try { localStorage.setItem('nomad.theme', n); } catch { /* private mode */ }
    this.drawMenu(); this.hint(`Darstellung: ${THEMES[n]}`);
  }
  hint(text, opt = {}) {
    const h = this.ui.hint;
    h.replaceChildren(text);
    if (opt.undo) h.append(' ', el('button', { class: 'ed-button small', onclick: () => { h.classList.remove('on'); this.undoStep(); } }, icon('undo', 14), ' Rückgängig'));
    h.classList.toggle('with-button', !!opt.undo); h.classList.add('on');
    clearTimeout(this.hintTime); this.hintTime = setTimeout(() => h.classList.remove('on'), opt.undo ? 6000 : 2600);
  }
  go(target) {
    // scroll positions (Daniel, 08.11.2026: "der Scrollzustand soll immer dort gehalten werden, wo ich in der Navigation unterwegs bin"):
    // the area list on the left always keeps its place; the entry list keeps it while staying in the same area;
    // the inspector starts at the top when another entry is opened
    const same = target.area === this.page?.area;
    this.keepScroll = { main: same, insp: same && (target.choice ?? null) === (this.page?.choice ?? null) };
    if (!same) this.filter = '';
    this.page = { choice: null, ...target };
    try { history.replaceState(null, '', '#' + encodeURIComponent(JSON.stringify(this.page))); } catch { /* artifact sandbox */ }
    this.draw();
  }

  draw() {
    this.messages = validateProject(this.p);
    this.drawMenu();
    const navbar = el('nav', { class: 'da-navbar', 'aria-label': 'Werkstatt-Bereiche' });
    this.navbar(navbar);
    const main = el('div', { class: 'da-main' }), insp = el('div', { class: 'da-insp' });
    for (const box of [main, insp]) { const orig = box.append.bind(box); box.append = (...k) => orig(...k.flat().filter(x => x != null && x !== false)); }
    const a = this.page.area;
    try {
      if (a === 'overview') this.overviewPage(main, insp);
      else if (a === 'validation') this.validationPage(main, insp);
      else if (AREAS[a]?.kind === 'catalog') this.catalogPage(a, main, insp);
      else if (AREAS[a]) this.singlePage(a, main, insp);
      else main.append(el('p', {}, 'Unbekannte Seite'));
    } catch (e) { console.error(e); main.append(el('p', { class: 'ed-error' }, 'Fehler beim Zeichnen: ' + e.message)); }
    const q = c => this.ui.data.querySelector(c)?.scrollTop || 0, scroll = { nav: q('.da-navbar'), main: q('.da-main'), insp: q('.da-insp') };
    this.ui.data.replaceChildren(navbar, main, insp);
    const keep = this.keepScroll ?? { main: true, insp: true };
    navbar.scrollTop = scroll.nav;
    if (keep.main) main.scrollTop = scroll.main;
    if (keep.insp) insp.scrollTop = scroll.insp;
    // the active area and entry stay in sight (e.g. after a jump from a reference or the overview)
    for (const [box, sel] of [[navbar, '.da-nav.on'], [main, '.on, [aria-selected="true"]']]) {
      const on = box.querySelector(sel);
      if (on) { const b = box.getBoundingClientRect(), r = on.getBoundingClientRect(); if (r.top < b.top || r.bottom > b.bottom) on.scrollIntoView({ block: 'nearest' }); }
    }
    this.keepScroll = { main: true, insp: true };
  }

  navbar(nav) {
    const s = this.page, m = this.messages || [];
    const number = x => x == null ? null : el('span', { class: 'da-nav-number' }, String(x));
    const entry = (active, ic, name, right, onclick) => el('button', { class: 'da-nav' + (active ? ' on' : ''), onclick }, ic, el('span', { class: 'da-nav-name' }, name), right);
    const problems = a => m.filter(x => x.place.area === a && x.kind !== 'hint').length;
    nav.append(entry(s.area === 'overview', icon('data', 18), 'Übersicht', null, () => this.go({ area: 'overview' })));
    for (const [title, list] of GROUPS) {
      nav.append(el('div', { class: 'da-navbar-title ng-spacing' }, title));
      for (const a of list) {
        const A = AREAS[a], n = problems(a);
        nav.append(entry(s.area === a, icon(A.icon, 18), A.name,
          n ? el('span', { class: 'da-nav-number ng-problem' }, String(n)) : number(A.kind === 'catalog' ? Object.keys(this.p.data[a] || {}).length : null), () => this.go({ area: a })));
      }
    }
    const fe = m.filter(x => x.kind === 'error').length, wa = m.filter(x => x.kind === 'warning').length;
    nav.append(el('div', { class: 'da-navbar-title ng-spacing' }, 'PRÜFEN'),
      entry(s.area === 'validation', icon(fe ? 'error' : wa ? 'warning' : 'verify', 18), 'Prüfung', number(fe + wa || null), () => this.go({ area: 'validation' })));
  }

  // ---------- Pages ----------
  overviewPage(main, insp) {
    const m = this.messages || [];
    main.append(this.head('NomadGirl'), el('p', { class: 'ed-small' }, 'Leyla lebt in den Wastelands rund um BigCityDelta in ihrem Rig. Hier stellst du alles ein, was das Spiel ausmacht. Jeder Bereich links ist eine Datei unter projects/nomadgirl/data/.'));
    for (const [title, list] of GROUPS) {
      main.append(el('h3', {}, title), el('div', { class: 'ng-cards' }, ...list.map(a => {
        const A = AREAS[a], n = A.kind === 'catalog' ? Object.keys(this.p.data[a] || {}).length : null, bad = m.filter(x => x.place.area === a && x.kind !== 'hint').length;
        return el('button', { class: 'ng-card', onclick: () => this.go({ area: a }) }, el('span', { class: 'ng-card-head' }, icon(A.icon, 18), el('b', {}, A.name), n != null ? el('span', { class: 'ng-card-n' }, String(n)) : null),
          el('span', { class: 'ed-small' }, A.hint), bad ? el('span', { class: 'ng-card-bad' }, icon('warning', 13), ` ${bad} zu prüfen`) : null);
      })));
    }
    insp.append(el('h3', {}, 'So funktioniert die Werkstatt'), ...[
      'Links wählst du einen Bereich. Kataloge (Waffen, Gegenstände …) haben eine Liste in der Mitte und den Inspektor hier rechts, Einzel-Bereiche (Leyla, Reisen …) ein Formular in der Mitte.',
      'Zahlen kannst du am Namen ziehen (Shift = fein). IDs stehen unter dem Namen im Inspektor; ändern benennt um, alle Verweise ziehen mit.',
      'Die Prüfung läuft nach jeder Änderung. Sie meldet kaputte Verweise und Dinge, die nicht zusammenpassen (z. B. zu wenig Platz im Start-Rig).',
      'Online speichert die Werkstatt direkt ins Repository: eine Minute nach der letzten Änderung automatisch, mit ⌘S sofort. Jedes Speichern ist ein Commit, das Spiel nutzt ihn nach dem Neuladen. Lokal bleiben die Stände in diesem Browser bzw. im Artifact, Ava übernimmt sie dann ins Repository.',
    ].map(t => el('p', { class: 'ed-small' }, t)));
  }

  validationPage(main, insp) {
    const m = this.messages || [];
    main.append(this.head('Prüfung'), el('p', { class: 'ed-small' }, 'Läuft nach jeder Änderung, wie „node tools/ng.js check“ auf der Kommandozeile. Antippen springt zur Stelle.'));
    if (!m.length) main.append(el('div', { class: 'ng-allGood' }, icon('verify', 28), el('b', {}, 'Alles stimmig.'), el('span', { class: 'ed-small' }, 'Keine Fehler, Warnungen oder Hinweise.')));
    for (const [kind, title, ic] of [['error', 'Fehler', 'error'], ['warning', 'Warnungen', 'warning'], ['hint', 'Hinweise', 'info']]) {
      const l = m.filter(x => x.kind === kind); if (!l.length) continue;
      main.append(el('h3', {}, `${title} (${l.length})`), el('div', { class: 'da-list' }, ...l.map(x => el('button', { class: 'da-entry ng-message ' + kind, onclick: () => this.go({ area: x.place.area, choice: x.place.id }) },
        icon(ic, 16), el('span', { class: 'da-name' }, x.text), el('small', {}, AREAS[x.place.area]?.name || '')))));
    }
    insp.append(el('h3', {}, 'Was wird geprüft?'), ...['Verweise: jedes Feld, das auf einen anderen Bereich zeigt (Beute, Werkstatt, Zutaten …).', 'Pflichtfelder, Zahlenbereiche, unbekannte Auswahlwerte.',
      'Regeln je Bereich: Start-Rig (Plätze, Energie, Gewicht), Ränge aufsteigend, POIs mit Eingang und Ausgang, Rezepte mit Zutaten, Baupläne mit Rezept.',
      'Hinweise: Gegenstände, die nirgends vorkommen, POIs ohne Ort auf der Oberwelt.'].map(t => el('p', { class: 'ed-small' }, t)));
  }

  catalogPage(a, main, insp) {
    const A = AREAS[a], o = this.p.data[a] = this.p.data[a] || {}, choice = this.page.choice;
    main.append(this.head(A.name,
      this.button('plus', 'Neu', () => { const id = freeId('neu', new Set(Object.keys(o))); this.change(a, () => { o[id] = structuredClone(A.template || { name: 'Neu' }); }); this.go({ area: a, choice: id }); }),
      this.button('export', 'JSON', () => this.jsonDialogue(`${A.name} als JSON`, o, j => this.change(a, () => { for (const k of Object.keys(o)) delete o[k]; Object.assign(o, j); })))),
    el('p', { class: 'ed-small' }, A.hint), this.search());
    const m = this.messages || [];
    const row = (id, x) => {
      const bad = m.filter(y => y.place.area === a && y.place.id === id && y.kind !== 'hint');
      const look = a === 'assets' ? x : this.p.data.assets?.[x.look];
      return [bad.length ? el('span', { class: 'ng-dot ' + (bad.some(y => y.kind === 'error') ? 'error' : 'warning'), title: bad.map(y => y.text).join('\n') }) : null,
        A.gallery ? assetThumb(this, look, 96) : look ? assetThumb(this, look, 28, x.icon) : null,
        el('span', { class: 'da-name' }, x.name || id), el('small', {}, rowText(this.p, a, x))];
    };
    const all = Object.entries(o);
    if (A.groupBy) {
      const { key, options } = A.groupBy, known = new Set(options.map(([k]) => k));
      for (const [k, name] of [...options, ['__other', 'Sonstige']]) {
        const part = all.filter(([, x]) => k === '__other' ? !known.has(x[key]) : x[key] === k);
        if (part.length) main.append(el('h3', { class: 'ng-group' }, name, el('span', { class: 'da-nav-number' }, String(part.length))), this.list(part, choice, id => this.go({ area: a, choice: id }), row));
      }
    } else main.append(this.list(all, choice, id => this.go({ area: a, choice: id }), row));
    const x = o[choice];
    if (!x) { insp.append(el('p', { class: 'ed-small' }, 'Wähle links einen Eintrag oder lege mit „Neu“ einen an.')); return; }
    insp.append(this.ihead(A.singular || A.name, A.icon, x.name || choice, choice, newId => {
      if (o[newId]) { this.hint(`„${newId}“ gibt es schon.`); return false; }
      this.change(a, () => { for (const c of renameEntry(this.p, a, choice, newId)) this.changed(c); });
      this.go({ area: a, choice: newId });
    }));
    for (const msg of m.filter(y => y.place.area === a && y.place.id === choice)) insp.append(el('p', { class: 'ng-inline ' + msg.kind }, icon(msg.kind === 'hint' ? 'info' : msg.kind, 14), ' ' + msg.text.replace(/^[^:]*: /, '')));
    insp.append(this.lookBlock(a, x));
    for (const s of A.sections) if (!s.when || s.when(x)) insp.append(el('h4', {}, s.title), ...s.fields.map(f => this.fieldEditor(a, f, x)));
    for (const extra of [SUMMARY[a]?.(this, x, choice)].flat()) if (extra) insp.append(el('h4', {}, extra.title), extra.body);
    const u = usages(this.p, a, choice);
    insp.append(el('h4', {}, `Verwendet (${u.length})`), u.length ? el('div', { class: 'da-tags' }, ...u.map(v => el('button', { class: 'da-tag ng-leap', title: v.path, onclick: () => this.go({ area: v.area, choice: v.id }) }, icon(AREAS[v.area].icon, 12), ' ' + v.name)))
      : el('p', { class: 'ed-small' }, 'Noch nirgends.'));
    insp.append(el('hr'), el('div', { class: 'ed-row' },
      this.button('duplicate', 'Duplizieren', () => { const n = freeId(choice, new Set(Object.keys(o))); this.change(a, () => { o[n] = structuredClone(x); }); this.go({ area: a, choice: n }); }),
      this.button('delete', 'Löschen', () => { this.change(a, () => { for (const c of removeEntry(this.p, a, choice)) this.changed(c); }); this.go({ area: a }); })));
  }

  singlePage(a, main, insp) {
    const A = AREAS[a], x = this.p.data[a] = this.p.data[a] || {};
    main.append(this.head(A.name, this.button('export', 'JSON', () => this.jsonDialogue(`${A.name} als JSON`, x, j => this.change(a, () => { for (const k of Object.keys(x)) delete x[k]; Object.assign(x, j); })))),
      el('p', { class: 'ed-small' }, A.hint));
    for (const msg of (this.messages || []).filter(y => y.place.area === a)) main.append(el('p', { class: 'ng-inline ' + msg.kind }, icon(msg.kind === 'hint' ? 'info' : msg.kind, 14), ' ' + msg.text.replace(/^[^:]*: /, '')));
    main.append(el('div', { class: 'ng-sections' }, ...A.sections.filter(s => !s.when || s.when(x)).map(s => el('section', { class: 'ng-section' }, el('h3', {}, s.title), ...s.fields.map(f => this.fieldEditor(a, f, x))))));
    insp.append(el('h3', {}, A.name), el('p', { class: 'ed-small' }, `Datei: ${this.p.paths[a]}`), this.lookBlock(a, x));
    for (const extra of [SUMMARY[a]?.(this, x)].flat()) if (extra) insp.append(el('h4', {}, extra.title), extra.body);
  }

  // ---------- Look: preview of the assets an entry points to (or of the asset itself) ----------
  lookBlock(a, x) {
    if (a === 'assets') return [el('h4', {}, 'Vorschau'), assetPreview(this, x)];
    const A = this.p.data.assets || {}, refs = references(a, x).filter(r => r.area === 'assets' && A[r.value]);
    const hasLook = fields(a).some(f => f.area === 'assets');
    if (!refs.length) return hasLook ? el('p', { class: 'ed-small ng-noLook' }, icon('image', 14), ' Noch kein Aussehen. Unter „Aussehen“ ein Asset wählen.') : null;
    this.lookPick = this.lookPick || {};
    const r = refs.find(r => r.path === this.lookPick[a]) || refs[0];
    return [el('h4', {}, 'Aussehen', el('span', { class: 'da-grow' }),
      el('button', { class: 'ed-button small', title: 'Zum Asset', onclick: () => this.go({ area: 'assets', choice: r.value }) }, icon('arrow_right', 13))),
      refs.length > 1 ? el('span', { class: 'ed-segment ng-lookPick' }, ...refs.map(q => el('button', { class: q === r ? 'on' : '', onclick: () => { this.lookPick[a] = q.path; this.draw(); } }, q.field.label))) : null,
      A[r.value].kind === 'icons' && r.holder === x && r.key === 'look' && fields(a).some(f => f.key === 'icon')
        ? iconSheet(this, A[r.value], { value: x.icon, set: i => this.change(a, () => { x.icon = i; }) })
        : assetPreview(this, A[r.value])];
  }

  // ---------- Field editors from the schema ----------
  fieldEditor(a, f, x) {
    const v = get(x, f.key), label = f.label + (f.unit ? ` (${f.unit})` : '');
    const put = val => this.change(a, () => set(x, f.key, val));
    const opt = { set: put, hint: f.hint };
    switch (f.type) {
      case 'text': case 'textarea': case 'color': return this.input(label, v, f.type, opt);
      case 'number': return this.input(label, v, 'number', { ...opt, live: val => { set(x, f.key, val); this.changed(a); }, min: f.min, max: f.max, step: f.step });
      case 'checkbox': return this.input(label, v, 'checkbox', { ...opt, set: val => put(val || undefined) });
      case 'select': return this.labeled(label, this.selection(f.options, v, val => put(val || undefined), '–'), f.hint);
      case 'multi': return this.labeled(label, this.chips(v, f.options, val => put(val.length ? val : undefined), '+', id => optionLabel(f.options, id)), f.hint);
      case 'ref': return this.labeled(label, this.refEditor(f.area, v, val => put(val || undefined)), f.hint);
      case 'refs': return this.labeled(label, this.chips(v, this.refOptions(f.area), val => put(val.length ? val : undefined), '+ ' + (AREAS[f.area].singular || AREAS[f.area].name),
        id => this.p.data[f.area]?.[id]?.name || id, id => this.go({ area: f.area, choice: id })), f.hint);
      case 'size': case 'point': case 'range': return this.labeled(label, this.pair(v, PAIR[f.type], val => put(val)), f.hint);
      case 'table': return this.labeled(label, this.tableEditor(a, f, x), f.hint, 'ng-wide');
      case 'lines': return this.labeled(label, this.linesEditor(v, put), f.hint, 'ng-wide');
      default: return el('p', { class: 'ed-error' }, `Unbekannter Feldtyp ${f.type}`);
    }
  }
  // List of text rows as monospaced text (room layouts): one row per line, no wrapping
  linesEditor(v, onChange) {
    const rows = Array.isArray(v) ? v : [], last = rows.join('\n');
    const t = el('textarea', { class: 'ed-field ng-lines', rows: Math.min(24, Math.max(4, rows.length + 1)), wrap: 'off', spellcheck: 'false' }, last);
    t.addEventListener('change', () => { if (t.value === last) return; const n = t.value.replace(/\s+$/, '').split('\n').map(r => r.replace(/\r$/, '')); onChange(n.join('') ? n : undefined); });
    return t;
  }
  refOptions(area) { return Object.entries(this.p.data[area] || {}).map(([k, y]) => [k, y.name || k]); }
  refEditor(area, v, onChange) {
    const wrong = v && !this.p.data[area]?.[v];
    return el('span', { class: 'ng-ref' + (wrong ? ' wrong' : '') }, area === 'assets' && v && !wrong ? assetThumb(this, this.p.data.assets[v], 24) : null, this.selection(this.refOptions(area), v, onChange, '– keine –'),
      v && !wrong ? el('button', { class: 'ed-button small', title: 'Hinspringen', onclick: () => this.go({ area, choice: v }) }, icon('arrow_right', 14)) : null,
      wrong ? el('span', { class: 'ng-wrongText', title: 'Unbekannte ID' }, v) : null);
  }
  pair(v, names, onChange) {
    v = Array.isArray(v) ? v : [];
    const inp = i => {
      const f = el('input', { type: 'number', class: 'ed-field small', step: 'any', value: v[i] ?? '' });
      f.addEventListener('change', () => { const n = [v[0] ?? 0, v[1] ?? 0]; n[i] = f.value === '' ? 0 : +f.value; onChange(n); });
      return el('label', { class: 'ng-pairField' }, el('span', {}, names[i]), f);
    };
    return el('span', { class: 'ng-pair' }, inp(0), inp(1));
  }
  tableEditor(a, f, x) {
    const rows = get(x, f.key) || [];
    const put = n => this.change(a, () => set(x, f.key, n.length ? n : undefined));
    const cell = (c, row, i) => {
      const val = row[c.key], upd = nv => { const n = structuredClone(rows); if (nv === '' || nv == null) delete n[i][c.key]; else n[i][c.key] = nv; put(n); };
      if (c.type === 'ref') return this.refEditor(c.area, val, upd);
      if (c.type === 'select') return this.selection(c.options, val, upd, '–');
      if (PAIR[c.type]) return this.pair(val, PAIR[c.type], upd);
      if (c.type === 'checkbox') { const b = el('input', { type: 'checkbox', checked: !!val }); b.addEventListener('change', () => upd(b.checked || null)); return b; }
      if (c.type === 'color') { const b = el('input', { type: 'color', class: 'ed-field', value: val || '#cccccc' }); b.addEventListener('change', () => upd(b.value)); return b; }
      const inp = el('input', { type: c.type === 'number' ? 'number' : 'text', class: 'ed-field' + (c.type === 'number' ? ' small' : ''), step: 'any', value: val ?? '' });
      inp.addEventListener('change', () => upd(c.type === 'number' ? (inp.value === '' ? null : +inp.value) : inp.value));
      return inp;
    };
    const blank = () => Object.fromEntries(f.columns.map(c => [c.key, c.type === 'number' ? (c.min ?? 1) : c.type === 'ref' ? (this.refOptions(c.area)[0]?.[0] ?? '') : '']));
    return el('div', { class: 'ng-table' },
      el('div', { class: 'ng-trow head', style: `--cols:${f.columns.length}` }, ...f.columns.map(c => el('span', {}, c.label)), el('span')),
      ...rows.map((row, i) => el('div', { class: 'ng-trow', style: `--cols:${f.columns.length}` }, ...f.columns.map(c => cell(c, row, i)),
        el('button', { class: 'ed-button small', title: 'Zeile entfernen', onclick: () => put(rows.filter((_, j) => j !== i)) }, icon('x', 12)))),
      el('button', { class: 'ed-button small ng-addRow', onclick: () => put([...rows, blank()]) }, icon('plus', 12), ' Zeile'));
  }

  // ---------- shared building blocks (as in the Tactics workshop) ----------
  head(title, ...buttons) { return el('div', { class: 'da-head' }, el('h2', {}, title), el('span', { class: 'da-grow' }), ...buttons); }
  button(ic, text, f, extra = '') {
    const del = ic === 'delete';
    return el('button', { class: 'ed-button wide ' + extra + (del ? ' red' : ''), onclick: del ? e => { if (f(e) !== false) this.hint('Gelöscht.', { undo: true }); } : f }, icon(ic, 16), text ? ' ' + text : '');
  }
  input(label, stat, type = 'text', opt = {}) {
    stat = stat ?? '';
    const inp = type === 'textarea' ? el('textarea', { class: 'ed-field', rows: 3 }, String(stat))
      : type === 'checkbox' ? el('input', { type: 'checkbox', checked: !!stat })
        : el('input', { type, class: 'ed-field' + (type === 'number' ? ' small' : ''), value: type === 'color' ? (stat || '#cccccc') : stat, step: type === 'number' ? (opt.step ?? 'any') : null });
    let last = type === 'checkbox' ? !!stat : String(stat);
    inp.addEventListener('change', () => { const v = type === 'checkbox' ? inp.checked : inp.value; if (v === last) return; last = v; opt.set(type === 'number' ? (v === '' ? undefined : +v) : v); });
    const name = el('span', { title: opt.hint || '' }, label, opt.hint ? el('i', { class: 'ng-hintMark' }, ' ⓘ') : null);
    if (type === 'number' && opt.live) draggable(name, inp, { start: () => this.begin(), live: v => opt.live(v), end: () => this.draw(), min: opt.min, max: opt.max });
    return el('label', { class: 'da-field' + (type === 'checkbox' ? ' across' : '') }, name, inp);
  }
  labeled(label, content, hint, extra = '') {
    return el('div', { class: 'da-field ' + extra }, el('span', { title: hint || '' }, label, hint ? el('i', { class: 'ng-hintMark' }, ' ⓘ') : null), content);
  }
  selection(options, stat, onChange, empty = null) {
    if (options.length > 6) return suchChoice({ options: options.map(([v, n]) => ({ stat: v, name: n ?? v })), stat: stat ?? '', empty, onChoice: onChange });
    const s = el('select', { class: 'ed-choice' }, empty != null ? el('option', { value: '' }, empty) : null, ...options.map(([v, n]) => el('option', { value: v, selected: v === stat }, n ?? v)));
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }
  // List of IDs as chips with ✕ and "+ …" to add; leap(id) makes the name clickable
  chips(list, options, onChange, plus = '+ hinzufügen', name = id => id, leap = null) {
    list = list || [];
    return el('div', { class: 'da-tags' }, ...list.map((v, i) => el('span', { class: 'da-tag' },
      leap ? el('button', { class: 'ng-chipLeap', title: 'Hinspringen', onclick: () => leap(v) }, name(v)) : name(v),
      el('button', { class: 'ed-button small', title: 'Entfernen', onclick: () => onChange(list.filter((_, j) => j !== i)) }, icon('x', 12)))),
    this.selection(options.filter(([v]) => !list.includes(v)), '', v => v && onChange([...list, v]), plus));
  }
  list(entries, choice, onChoice, rendering) {
    const f = this.filter.toLowerCase();
    return el('div', { class: 'da-list' + (AREAS[this.page.area]?.gallery ? ' ng-gallery' : '') }, ...entries.filter(([id, x]) => !f || id.includes(f) || String(x?.name || '').toLowerCase().includes(f)).map(([id, x]) =>
      el('button', { class: 'da-entry' + (choice === id ? ' on' : ''), onclick: () => onChoice(id) }, ...rendering(id, x))));
  }
  search() {
    const s = el('input', { type: 'search', class: 'ed-field', placeholder: 'Suchen …', value: this.filter });
    s.addEventListener('input', () => { this.filter = s.value; clearTimeout(this.sz); this.sz = setTimeout(() => { this.draw(); const n = this.ui.data.querySelector('input[type=search]'); n?.focus(); n?.setSelectionRange(n.value.length, n.value.length); }, 200); });
    return s;
  }
  ihead(kind, kindIcon, title, id, rename) { return inspectorHead({ kind, kindIcon, title, id, rename }); }
  jsonDialogue(title, data, onImport) {
    const text = el('textarea', { class: 'ed-field da-json', spellcheck: 'false' }, JSON.stringify(data, null, 1));
    const { error } = openDialogue({ title, icon: 'export', wide: true, content: [el('p', { class: 'ed-small' }, 'Export: Text kopieren. Import: JSON einfügen, dann „Importieren“ (ersetzt den ganzen Bereich).'), text],
      left: [this.button('copyAction', 'Kopieren', async () => { try { await navigator.clipboard.writeText(text.value); error('Kopiert.'); } catch { text.select(); error('Bitte mit ⌘C kopieren.'); } })],
      main: onImport ? { text: 'Importieren', icon: 'import', action: () => { try { onImport(JSON.parse(text.value)); } catch (e) { error('Kein gültiges JSON: ' + e.message); return false; } } } : null });
  }
  showHelp() {
    const t = (h, ...p) => [el('h4', {}, h), ...p.map(x => el('p', { class: 'ed-small' }, x))];
    openDialogue({ title: 'Werkstatt – Was ist was?', icon: 'help', wide: true, content: [
      ...t('Grundlagen', 'Spiel (Maßstab, Physik, Start-Rig), Wirtschaft (Deltas, Tod und Mama-Bot, Foodtruck) und Ranking (Punkte und Ränge F bis S).'),
      ...t('Leyla & Kampf', 'Alle Bewegungswerte von Leyla, Rucksäcke als Raster, Waffen (Nahkampf, Fernkampf, Cyberdeck), Gegner und Buffs.'),
      ...t('Beute & Crafting', 'Gegenstände mit Größe im Rucksack, Beutetabellen mit Gewichten und Rezepte (Zutaten → Ergebnis, Werkstatt, wie man es lernt).'),
      ...t('Rig', 'Zugmaschinen ziehen Container, Container fassen Werkstätten, Werkstätten brauchen oder liefern Energie. Rig-Teile kommen in die Slots der Zugmaschine, Companions betreiben Werkstätten.'),
      ...t('Welt', 'POIs werden aus Raum-Bausteinen zusammengesetzt, Oberwelt-Orte zeigen auf POIs, Encounter passieren unterwegs, Reisen regelt Sprit, Vorräte und Tag/Nacht.'),
      ...t('Tasten', '⌘S speichern · ⌘P spielen · ⌘Z / ⇧⌘Z rückgängig/wiederholen · Zahlen am Namen ziehen (Shift = fein) · ? Hilfe'),
    ] });
  }
}
export { cleanId };
