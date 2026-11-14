// HUD as HTML over the canvas: health, ammo, dash, time, kills, Δ, banners and the controls overlay.
import { placeOf } from '../worldmap.js';
import { bonuses } from '../techtree.js';
import { phase } from '../tank.js';
import { el } from '../ui.js';
import { hints, setUiDevice, closeX } from './ui_nav.js';
import { icon } from '../icons.js';
import { loadVersion } from '../version.js';
import { clockText } from '../save.js';
import { trackedGoal as questGoal } from '../quests.js';
import { makeSfx } from './sfx.js';

// toast kinds: icon (Lucide) and sound (sfx.js); colours in play.css (.hud-toast.<kind>)
const TOAST_KINDS = {
  info: { icon: 'info', sound: 'ping' }, good: { icon: 'check', sound: 'good' }, warn: { icon: 'warning', sound: 'nope' },
  trophy: { icon: 'trophy', sound: 'fanfare' }, recipe: { icon: 'list', sound: 'chime' }, secret: { icon: 'star', sound: 'sparkle' },
  heal: { icon: 'heart', sound: 'good' }, drama: { icon: 'skull', sound: 'low' }, travel: { icon: 'map', sound: 'ping' },
  camp: { icon: 'moon', sound: 'ping' }, loot: { icon: 'bags', sound: 'good' },
};

// the controls panel (H or Menü › Steuerung), two columns: keys as keycaps, " / " splits alternatives
const CONTROLS = [
  { title: 'Bewegen', icon: 'right', rows: [
    ['A D / ← →', 'Laufen'], ['Shift', 'Gehen statt Rennen (halten)'], ['Leertaste', 'Springen, in der Luft nochmal: Doppelsprung'],
    ['L / C', 'Dash, auch in der Luft'], ['S / ↓', 'Beim Rennen: Slide · im Stand: Ducken'], ['S + Leertaste', 'Von der Plattform fallen'],
    ['→', 'Im Sprung zur Wand: Kante greifen · W hochziehen · S loslassen'], ['W / ↑', 'Leiter klettern, Seil greifen'], ['Leertaste', 'Am Seil: loslassen mit Schwung']] },
  { title: 'Kampf', icon: 'weapon', rows: [
    ['J / Y', 'Nahkampf: tippen = Kombo · 1 s halten: schwerer Hieb'], ['K / X', 'Schießen (am Boden): zieht und schießt im selben Zug'], ['K halten', 'Waffe wegstecken'], ['R', 'Nachladen (leer abdrücken lädt auch)'], ['Q', 'Waffe ziehen / wegstecken'], ['V', 'Fernkampfwaffe wechseln (aus dem Rucksack)']] },
  { title: 'Machen', icon: 'hand', rows: [
    ['E / W', 'Benutzen: Kisten, Schalter, Werkstätten, Feuer, Van (W nur mit Hinweis)'], ['I / Tab', 'Inventar'], ['B', 'Rig bauen (im Camp; Pfeile + Leertaste/Enter ohne Maus)'], ['P', 'Yoga-Pose']] },
  { title: 'System', icon: 'settings', rows: [
    ['Esc', 'Menü'], ['H', 'Diese Steuerung'], ['M', 'Ton an/aus'], ['Rücktaste', 'Raum neu starten'], ['G', 'Hitboxen']] },
];
const caps = keys => keys.split(' / ').flatMap((k, i) => [...(i ? [el('i', {}, '/')] : []), ...k.split(' + ').flatMap((p, j) => [...(j ? [el('i', {}, '+')] : []), el('kbd', {}, p)])]);
const section = g => el('section', {}, el('h3', {}, icon(g.icon, 16), g.title), el('dl', {}, ...g.rows.flatMap(([k, t]) => [el('dt', {}, ...caps(k)), el('dd', {}, t)])));

export class Hud {
  constructor(root, { workshopDrafts = 0, commit = null } = {}) {
    this.healthBar = el('i'); this.healthText = el('b');
    this.ammo = el('b'); this.dash = el('span', { class: 'hud-dash' }, 'DASH');
    this.time = el('b'); this.kills = el('b'); this.deltas = el('b'); this.roomName = el('span', { class: 'hud-room' });
    this.toastsEl = el('div', { class: 'hud-toasts' });   // 🏆 Achievement, 📜 Rezept gelernt (#012): stack top right, go by themselves
    this.promptEl = el('div', { class: 'hud-prompt', hidden: true });
    this.menuEl = el('div', { class: 'hud-menu', hidden: true });
    this.campEl = el('div', { class: 'hud-camp', hidden: true });
    // the rig can be rebuilt any time in the camp: B or this button (Daniel, 08.11.2026: "kein Umweg über einen Warroom mehr")
    // „Rig offen“ (Daniel, 09.11.2026: only a button, no key): all closed containers stay open; remembered in this browser
    try { this.rigOpen = localStorage.getItem('nomadgirl-rig-open') === '1'; } catch { this.rigOpen = false; }
    this.openBtn = el('button', { class: 'hud-openbtn', hidden: true, onclick: e => { e.currentTarget.blur(); this.setRigOpen(!this.rigOpen); } });
    this.setRigOpen(this.rigOpen);
    this.buildBtn = el('button', { class: 'hud-buildbtn', hidden: true, title: 'Rig bauen (B, Controller: Select halten): Werkstätten, Anhänger und Rig-Teile mit der Maus oder AvA umsetzen', onclick: e => { e.currentTarget.blur(); this.scene?.openBuild(); } }, el('kbd', {}, 'B'), el('span', {}, 'Rig bauen'));
    this.modal = false;
    document.addEventListener('keydown', e => { if (this.pad) this.pad.active = false; this.menuKey(e); }, true);
    // controls: hidden until asked for (Daniel, 11.11.2026: "nicht mehr per default, in einem Menü verstecken"), two columns
    this.help = el('div', { class: 'hud-help', hidden: true, onclick: e => { if (e.target === this.help) this.toggleHelp(false); } }, el('div', { class: 'hud-helpBox' },
      el('header', {}, el('h2', {}, 'Steuerung'), el('small', {}, 'NomadGirl · Feldhandbuch')), closeX(() => this.toggleHelp(false)),
      this.padHelpEl = el('div', { class: 'hud-padhelp', hidden: true }),
      this.keyHelpEl = el('div', { class: 'hud-keyhelp' }, el('div', {}, section(CONTROLS[0])), el('div', {}, ...CONTROLS.slice(1).map(section))),
      el('p', {}, 'Inventar mit der Maus: klicken nehmen und ablegen, Rechtsklick drehen, Doppelklick rüber, auf „Benutzen“ legen = essen. Alle Werte kommen aus der Werkstatt.',
        commit ? el('b', {}, ` Spieldaten live aus dem Repository (Stand ${commit.slice(0, 7)}).`) : null,
        workshopDrafts ? el('b', {}, ` Dein gespeicherter Werkstatt-Stand ist aktiv (${workshopDrafts} ${workshopDrafts === 1 ? 'Datei' : 'Dateien'}).`) : null),
      hints([['ok', 'weiter'], ['back', 'zurück']]),
      this.goBtn = el('button', { class: 'hud-go', onclick: () => this.toggleHelp(false) }, 'Weiter')));
    root.append(
      el('div', { class: 'hud-top' },
        el('div', { class: 'hud-left' },
          el('div', { class: 'hud-health' }, el('span', { class: 'hud-bar' }, this.healthBar), this.healthText),
          el('div', { class: 'hud-row' }, el('span', { class: 'hud-label' }, 'NÄGEL'), this.ammo, this.dash)),
        el('div', { class: 'hud-right' },
          el('div', { class: 'hud-row' }, this.roomName),
          el('div', { class: 'hud-row' }, el('span', { class: 'hud-label' }, 'ZEIT'), this.time, el('span', { class: 'hud-label' }, 'KILLS'), this.kills, el('span', { class: 'hud-label' }, 'Δ'), this.deltas))),
      this.campEl, this.buildBtn, this.openBtn, this.toastsEl, this.promptEl, this.menuEl, this.help,
      el('div', { class: 'hud-foot' }, // tidy (#008, Daniel: „HUD aufräumen“): only the menu button and the version; Werkstatt, Startseite and Neues Spiel live in the menu
        el('button', { class: 'hud-menubtn', title: 'Menü (Esc)', onclick: e => { e.currentTarget.blur(); this.pauseMenu(); } }, icon('menu', 14), 'Menü'),
        this.versionEl = el('span', { class: 'hud-version' })));
    loadVersion().then(v => { this.versionEl.textContent = ' · ' + v.text; this.versionEl.title = 'Version dieses Spiels' + (v.commit ? ': ' + v.commit : ''); this.version = v; });
    this.root = root;
    this.paused = false;   // the controls wait in the menu (Esc › Steuerung, or H)
  }

  // a new game asks in the game's own menu (controller too), no browser dialog (Daniel, 12.11.2026)
  // the end of a Durchgang (scene.wakeUp): black, the lines are typed one after another, then it fades into the camp
  dream(lines, foot, seconds = 7) {
    this.dreamEl?.remove();
    const box = el('div', { class: 'hud-dream' }), text = el('div', { class: 'hud-dream-text' }), small = el('small', {}, foot);
    box.append(text, small, closeX(() => { box.remove(); if (this.dreamEl === box) this.dreamEl = null; }, 'Überspringen')); this.root.append(box); this.dreamEl = box;
    const per = seconds * 1000 / (lines.length + 1);
    lines.forEach((t, i) => setTimeout(() => text.append(el('p', { class: i === lines.length - 1 ? 'last' : '' }, t)), 400 + i * per));
    setTimeout(() => box.classList.add('foot'), 400 + lines.length * per);
    setTimeout(() => box.classList.add('out'), seconds * 1000 + 600);
    setTimeout(() => { box.remove(); if (this.dreamEl === box) this.dreamEl = null; }, seconds * 1000 + 2400);
  }
  confirmNew() {
    if (this.paused) this.toggleHelp(false);
    this.closeMenu();
    this.menu({ title: 'Neues Spiel?', sub: 'Ein neuer Durchgang beginnt klein: Rig, Inventar, Δ, Tank und Uhr. Der Techtree bleibt, es sei denn, du setzt ausdrücklich alles zurück.',
      items: [{ label: 'Abbrechen', sub: 'Weiterspielen', act: () => {} },
        { label: 'Neuer Durchgang', sub: 'Techtree bleibt, alles andere fängt neu an', act: () => { location.href = 'game.html?camp&cycle'; } },
        { label: 'Alles zurücksetzen', sub: 'Auch der Techtree ist weg. Lässt sich nicht rückgängig machen', act: () => { location.href = 'game.html?camp&new'; } }] });
  }
  // pause menu (Esc, Start on the controller, button at the bottom): the controls live here now
  pauseMenu() {
    const sc = this.scene;
    if (this.modal || !sc) return;
    if (this.paused) this.toggleHelp(false);
    const camp = this.modeName === 'camp';
    this.menu({ title: 'Pause', sub: sc.roomDef?.name || '', items: [
      { label: 'Weiter', primary: true, act: () => {} },
      { label: 'Steuerung', sub: 'Tasten und Controller', act: () => this.toggleHelp(true) },
      { label: 'Feldhandbuch', sub: 'Alle Lektionen mit Clips', act: () => setTimeout(() => this.tut?.openGuide(), 0) },
      ...(sc.box ? [{ label: 'Achievements', sub: 'Erreicht, offen, Trophäen', act: () => setTimeout(() => this.ach?.open(), 0) }] : []),
      { label: 'Optionen', sub: 'Ton, Schießstil', act: () => setTimeout(() => this.optionsMenu(), 0) },
      ...(this.modeName === 'test' ? [{ label: 'Raum neu starten', sub: 'Rücktaste', act: () => sc.level ? sc.restartAs({}) : sc.restartRoom() }] : []),
      { label: 'Werkstatt', act: () => { location.href = 'workshop.html'; } },
      { label: 'Startseite', act: () => { location.href = './'; } },
      ...(camp ? [{ label: 'Neues Spiel', sub: 'Spielstand löschen', act: () => this.confirmNew() }] : []),
    ] });
  }

  // Menü › Optionen: sound and the shooting style (design.md: Klassisch | Cells-like); the style is kept in this browser
  optionsMenu() {
    const sc = this.scene;
    if (this.modal || !sc) return;
    const cells = sc.cellsLike();
    this.menu({ title: 'Optionen', items: [
      { label: sc.sound.mute ? 'Ton an' : 'Ton aus', sub: 'M', act: () => sc.toggleMute() },
      { label: `Schießstil: ${cells ? 'Cells-like' : 'Klassisch'}`, sub: cells ? 'Schießen im Rennen mit Zielhilfe · umschalten auf Klassisch' : 'Zum Schießen stehen oder gehen · umschalten auf Cells-like',
        act: () => { try { localStorage.setItem('nomadgirl-shoot-style', cells ? 'classic' : 'cells'); } catch { /* private mode */ }
          this.banner(`Schießstil: ${cells ? 'Klassisch' : 'Cells-like'}`, 'Gilt in diesem Browser'); sc.time.delayedCall(1400, () => this.banner(null)); } },
      ...(this.tut ? [{ label: `Lektionen beim ersten Mal: ${this.tut.off ? 'aus' : this.tut.sessionOff ? 'aus (diese Sitzung)' : 'an'}`, sub: 'Feldhandbuch-Karten, wenn du etwas Neues siehst', act: () => { if (this.tut.sessionOff && !this.tut.off) this.tut.setSessionOff(false); else this.tut.setOff(!this.tut.off); setTimeout(() => this.optionsMenu(), 0); } },
        { label: 'Lektionen neu zeigen', sub: 'Alle Karten erscheinen wieder beim ersten Mal', act: () => { this.tut.reset(); this.banner('Lektionen zurückgesetzt', '', 1600); } }] : []),
      { label: 'Zurück', act: () => setTimeout(() => this.pauseMenu(), 0) },
    ] });
  }

  firstKey() {}

  setRigOpen(on) {
    this.rigOpen = !!on;
    try { localStorage.setItem('nomadgirl-rig-open', on ? '1' : '0'); } catch { /* private mode */ }
    this.openBtn.classList.toggle('on', this.rigOpen);
    this.openBtn.title = this.rigOpen ? 'Rig offen: alle Container bleiben offen. Klicken: zu, außer Leyla ist in der Nähe' : 'Container sind zu und öffnen sich, wenn Leyla in der Nähe ist. Klicken: alle offen lassen';
    this.openBtn.replaceChildren(icon(this.rigOpen ? 'door' : 'box', 16), el('span', {}, this.rigOpen ? 'Rig offen' : 'Rig zu'));
  }

  // camp / run / test: which parts of the HUD show
  mode(mode, save, D) {
    this.modeName = mode; this.save = save; this.D = D;
    this.root.dataset.mode = mode;
    this.campEl.hidden = !save;
    this.buildBtn.hidden = mode !== 'camp';
    this.openBtn.hidden = true;   // Daniel, 12.11.2026: „Rig offen oder zu kann dann im Bau-Menü sein“ (build_mode.js bar)
    this.prompt(null);
    this.closeMenu();
  }
  // "E · Schlafen · Schlafkoje" at the bottom
  prompt(text, key = 'E') {
    this.promptText = text || null; this.promptKey = key;
    this.promptEl.hidden = !text;
    // with a controller in use the prompt shows its button (Spiel › Controller)
    const p = this.pad?.active && this.pad.kind ? this.pad : null;
    const action = key === 'E' ? 'grab' : key === 'I' ? 'inventory' : null, b = p && action ? p.c.map[action]?.[0] : null;
    const icon = b != null ? this.padIcon(p.iconName(b), p.labelOf(b)) : null;
    if (text) this.promptEl.replaceChildren(icon ? el('kbd', { class: 'pad' }, icon) : el('kbd', {}, (b != null ? p.labelOf(b) : null) || key), el('span', {}, text));
  }
  // menu: { title, sub, items: [{ label, sub?, primary?, disabled?: reason, act }] }; keys W/S or ↑/↓, E/Enter/Leertaste, Esc, 1–9
  // onClose: called when the menu is closed without a choice (✕, Esc, B), e.g. an encounter on the road takes its default then
  menu({ title, sub = '', items = [], onClose = null }) {
    this.modal = true; this.menuItems = items; this.menuTitle = title; this.menuOnClose = onClose;
    this.menuIndex = Math.max(0, items.findIndex(i => !i.disabled));
    this.menuButtons = items.map((it, i) => el('button', { class: 'hud-item' + (it.primary ? ' primary' : ''), disabled: !!it.disabled, onclick: () => this.choose(i), onmouseenter: () => this.focus(i) },
      el('kbd', {}, String(i + 1)), el('span', {}, el('b', {}, it.label), it.sub || it.disabled ? el('small', {}, [it.sub, it.disabled].filter(Boolean).join(' · ')) : null)));
    this.menuEl.replaceChildren(el('div', { class: 'hud-menuBox ui-frame' }, el('h2', {}, title), sub ? el('p', {}, sub) : null, el('div', { class: 'hud-items' }, ...this.menuButtons),
      hints([['move', 'wählen'], ['ok', 'nehmen'], ['back', 'zurück']], '1–9 direkt'), closeX(() => this.closeMenu())));
    this.menuEl.hidden = false;
    this.promptEl.hidden = true;
    this.focus(this.menuIndex);
  }
  focus(i) { this.menuIndex = i; this.menuButtons?.forEach((b, k) => b.classList.toggle('focus', k === i)); }
  closeMenu(chosen = false) {
    const f = this.menuOnClose; this.menuOnClose = null;
    this.modal = false; this.menuEl.hidden = true; this.menuItems = null; this.promptEl.hidden = !this.promptText;
    if (!chosen) f?.();
  }
  choose(i) {
    const it = this.menuItems?.[i];
    if (!it || it.disabled) return false;
    this.closeMenu(true);
    it.act?.();
    return true;
  }
  menuKey(e) {
    if (!this.modal) return;
    const k = e.key, n = this.menuItems.length;
    const move = d => this.menuMove(d);
    if (k === 'Escape') this.closeMenu();
    else if (k === 'ArrowDown' || k === 's' || k === 'S') move(1);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') move(-1);
    else if (k === 'Enter' || k === ' ' || k === 'e' || k === 'E') this.choose(this.menuIndex);
    else if (/^[1-9]$/.test(k)) this.choose(Number(k) - 1);
    else return;
    e.preventDefault(); e.stopPropagation();
  }
  menuKeys() {}
  // one cell of the controller symbols (Spiel › Controller › Symbole) as a pixel-sharp CSS sprite, ×2; null without symbols
  // size: shown height in px (the cells are drawn large, tools/pad_icons.py; Spiel › Controller › Symbol-Größe)
  padIcon(name, title = '', size = null) {
    const I = this.padIcons, i = I?.names.indexOf(name) ?? -1;
    if (!I || I.broken || i < 0) return null;
    const [cw, ch] = I.cell, k = (size ?? I.size ?? 32) / ch, x = i % I.grid[0], y = Math.floor(i / I.grid[0]);
    return el('i', { class: 'pad-ico', title, 'data-icon': name, style: `width:${cw * k}px;height:${ch * k}px;background-image:url("${I.url}");background-size:${I.grid[0] * cw * k}px ${I.grid[1] * ch * k}px;background-position:-${x * cw * k}px -${y * ch * k}px` });
  }
  menuMove(d) { const n = this.menuItems?.length || 0; let i = this.menuIndex; for (let s = 0; s < n; s++) { i = (i + d + n) % n; if (!this.menuItems[i].disabled) break; } this.focus(i); }
  // the help shows the controller's buttons once one is connected (labels for Xbox/Stadia, PlayStation or Switch)
  padHelp(pad, actions) {
    // everything follows the device in use (keyboard ↔ controller) and the controller's type
    const active = !!(pad?.active && pad.kind), sig = `${pad?.kind || ''}|${active}`;
    if (sig === this.padSig) return;
    this.padSig = sig;
    this.root?.classList.toggle('hud-pad', active);
    if (this.promptText) this.prompt(this.promptText, this.promptKey);
    setUiDevice(pad, (n, t) => this.padIcon(n, t));
    const kind = pad?.kind || null;
    this.padHelpEl.hidden = !kind;
    this.keyHelpEl.hidden = active;   // with the controller in hand: only its buttons
    this.goBtn.replaceChildren(...(active ? [this.padIcon(pad.iconName(0), pad.labelOf(0)) || '', ' '] : []), 'Weiter');
    if (!kind) return;
    const ico = b => this.padIcon(pad.iconName(b), pad.labelOf(b)) || el('b', {}, pad.labelOf(b));
    const names = { xbox: 'Xbox', ps: 'PlayStation', switch: 'Switch', stadia: 'Stadia' };
    const rows = [[[ico('stick'), ico('dpad')], 'Laufen (halb neigen = gehen), runter = Ducken/Slide, hoch = Leiter'],
      [[ico('rstick')], 'AvA am Gummiband (Licht, Plattform)'],
      ...actions.map(([a, name]) => [(pad.c.map[a] || []).map(ico), name]).filter(([k]) => k.length),
      [[ico('dpad'), ico(0), ico(1), ico(2), ico(3), ico(4), ico(5)], 'Fenster: wählen, nehmen, zurück, drehen, rüber (halten: wegwerfen), Tabs'],
      ...(pad.c.map.inventory?.length ? [[[...pad.c.map.inventory.map(ico)], 'Im Camp halten: Rig bauen (dort Select = Rig offen/zu)']] : [])];
    const half = Math.ceil(rows.length / 2), list = part => el('dl', {}, ...part.flatMap(([k, t]) => [el('dt', {}, ...k.flatMap((x, i) => i ? [' ', x] : [x])), el('dd', {}, t)]));
    this.padHelpEl.replaceChildren(el('h3', {}, icon('play', 16), `Controller · ${names[kind] || kind}`), el('div', { class: 'hud-cols' }, list(rows.slice(0, half)), list(rows.slice(half))),
      ...(active ? [el('p', { class: 'hud-small' }, 'Eine Taste auf der Tastatur zeigt wieder die Tastenbelegung.')] : [el('h3', { class: 'hud-keytitle' }, icon('grid', 16), 'Tastatur')]));
  }
  menuState() { return this.modal ? { title: this.menuTitle, items: this.menuItems.map(i => ({ label: i.label, sub: i.sub || '', disabled: i.disabled || null })) } : null; }
  toggleHelp(on = !this.paused) { this.paused = on; this.help.hidden = !on; }
  room(name, count) { this.roomName.textContent = name; this.total = count; }
  // banners go by themselves after ms (default 3.5 s; 0 = stays until the next banner or ✕). Before, a banner stayed until
  // the next one replaced it, so „Wieder auf den Beinen“ never left (Daniel, 12.11.2026)
  // Since #014 (Daniel, 13.11.2026: „Toast und Sound, aber stell sicher, dass alle diese Hinweise auf diese Art dargestellt
  // werden“) a banner is a toast too: it replaces the previous banner toast, ms 0 = stays until ✕ or the next banner.
  banner(title, sub = '', ms = 3500, kind = 'info') {
    const old = this.bannerToast; this.bannerToast = null;
    if (old?.isConnected) this.dismiss(old);
    if (!title) return null;
    return (this.bannerToast = this.toast(title, sub, kind, ms, { banner: true }));
  }
  // the text of the banner toast still on screen (for the remote control and the tests)
  bannerText() { const t = this.bannerToast; return t?.isConnected && !t.classList.contains('out') ? t.textContent : null; }
  dismiss(t) { if (!t || t.classList.contains('out')) return; clearTimeout(t._timer); t.classList.add('out'); setTimeout(() => t.remove(), 450); }
  // every message of the game: a note top right that stacks and goes by itself, with its own icon, colour and sound.
  // The same title twice in a row does not stack: the toast already there starts its time again (and nods). → the element
  toast(title, sub = '', kind = 'info', ms = 4200, { banner = false, sound = true } = {}) {
    const K = TOAST_KINDS[kind] || TOAST_KINDS.info;
    const same = [...this.toastsEl.children].find(x => !x.classList.contains('out') && x._title === title && x._sub === sub);
    if (same) {
      clearTimeout(same._timer); same.classList.remove('nod'); void same.offsetWidth; same.classList.add('nod');
      if (ms > 0) same._timer = setTimeout(() => this.dismiss(same), ms);
      return same;
    }
    const t = el('div', { class: `hud-toast ${kind}${banner ? ' banner' : ''}` }, icon(K.icon, 22), el('div', {}, el('b', {}, title), sub ? el('small', {}, sub) : null));
    t._title = title; t._sub = sub;
    if (ms <= 0) t.append(closeX(() => this.dismiss(t)));
    this.toastsEl.append(t);
    const live = [...this.toastsEl.children].filter(x => !x.classList.contains('out'));
    for (const x of live.slice(0, Math.max(0, live.length - 5))) this.dismiss(x);
    if (ms > 0) t._timer = setTimeout(() => this.dismiss(t), ms);
    (this.toastLog ??= []).push({ title, sub, kind });
    if (sound) this.toastSound(K.sound);
    return t;
  }
  toastSound(name) {
    const s = this.scene; if (!s?.sound || !name) return;
    if (this.sfxScene !== s) { this.sfxScene = s; this.sfx = makeSfx(s, (s.data_?.build?.view?.volume ?? 50) / 100 * 0.8); }
    const now = performance.now();
    if (now - (this.lastSound || 0) < 120) return;   // a burst of toasts plays one sound
    this.lastSound = now;
    try { this.sfx[name]?.(); } catch { /* no audio */ }
  }
  hurt() { this.root.classList.remove('hud-hurt'); void this.root.offsetWidth; this.root.classList.add('hud-hurt'); }

  update(scene, time) {
    const l = scene.leyla, max = l.maxHealth;
    // windows on top: the E prompt of the world waits (its key means „ok“ in the window)
    const hideP = !this.promptText || this.modal || !!this.inv?.isOpen || !!this.craft?.isOpen || !!this.tech?.isOpen || !!this.map?.isOpen;
    this.root.classList.toggle('hud-windowed', !!(this.inv?.isOpen || this.craft?.isOpen || this.tech?.isOpen || this.map?.isOpen || this.quests?.isOpen || this.ach?.isOpen || this.tut?.isOpen || this.build?.active));   // #017: toasts move to the top centre, over the free middle of the window header, never over its buttons
    if (this.promptEl.hidden !== hideP) this.promptEl.hidden = hideP;
    this.healthBar.style.width = `${Math.max(0, l.health / max * 100)}%`;
    this.healthText.textContent = `${Math.ceil(l.health)}/${max}`;
    // reload ring next to the magazine (also while she jumps or dashes, the reload keeps going; paused = dimmed)
    const rp = l.reloading ? Math.min(1, (scene.now - l.reloading.at) / l.reloading.dur) : l.reloadSaved > 0 ? l.reloadSaved / (scene.weapon('ranged')?.reloadTime ?? 1400) : -1;
    this.ammo.classList.toggle('hud-reloading', rp >= 0); this.ammo.classList.toggle('hud-paused', rp >= 0 && !l.reloading);
    if (rp >= 0) this.ammo.style.setProperty('--p', (rp * 100).toFixed(1) + '%');
    this.ammo.textContent = rp >= 0 ? `lädt ${Math.round(rp * 100)} %` : l.mag === Infinity ? '∞' : l.magSize === Infinity || l.magSize >= 999 ? String(l.mag) : `${l.mag}/${l.ammo === Infinity ? '∞' : l.ammo}`;
    this.dash.classList.toggle('ready', time >= l.dashReady);
    this.time.textContent = scene.clock();
    this.kills.textContent = `${scene.kills}/${this.total ?? 0}`;
    this.deltas.textContent = String(scene.deltas);
    const sv = this.save;
    if (sv) {
      const D = this.D, loc = placeOf(D, sv)?.name || '';
      const vit = this.modeName === 'run' && sv.tank && bonuses(D, sv).tankStatus > 0 ? phase(D, sv) : null;   // Techtree › Lebenszeichen: the tank in the run
      const now = performance.now();
      if (!this.goalAt || now - this.goalAt > 1000) {
        this.goalAt = now;
        const before = this.goal;
        try { this.goal = questGoal(D, sv); } catch { this.goal = null; }
        // progress on the way (#016): a node on the way was unlocked → a gold toast with how far the search is
        if (before && this.goal && before.quest && before.quest === this.goal.quest && this.goal.kind === 'ready' && before.kind !== 'ready') this.toast(`Auftrag erledigt: ${this.goal.text.replace(/ · erledigt$/, '')}`, 'Abgeben im Questlog (Lagerfeuer, Warroom)', 'good');
        else if (before && this.goal && !before.quest && !this.goal.quest && this.goal.progress > before.progress + 1e-6) this.toast('Ein Schritt näher an AvA', `${Math.round(this.goal.progress * 100)} % des Weges · nächster: ${this.goal.text.replace(/^[^:]*:\s*/, '')}`, 'good');
      }
      const G = this.goal, run = this.modeName === 'run';
      const key = [sv.day, sv.hour, sv.location, sv.deltas, sv.fuel, sv.food, sv.buffs.join(), this.modeName, vit ? `${Math.round(sv.tank.cond)}${sv.tank.dead}` : '', G ? G.text + G.sub : ''].join('|');
      if (key !== this.campKey) {
        this.campKey = key;
        const buffs = sv.buffs.map(b => D.buffs?.[b]?.name || b);
        // #016 Run-HUD aufräumen: in the run only what matters in the run (AvA's vital signs, buffs, the goal); clock, Δ, fuel and
        // supplies of the camp stay in the camp (the run shows its own Δ top right)
        this.campEl.replaceChildren(
          ...(run ? [] : [el('div', { class: 'hud-row' }, el('span', { class: 'hud-room' }, `${clockText(sv)} · ${loc}`)),
            el('div', { class: 'hud-row' }, el('span', { class: 'hud-label' }, 'Δ'), el('b', {}, String(sv.deltas)), el('span', { class: 'hud-label' }, 'SPRIT'), el('b', {}, `${Math.round(sv.fuel)} l`),
              el('span', { class: 'hud-label' }, 'VORRÄTE'), el('b', {}, (Math.round(sv.food * 10) / 10).toLocaleString('de-DE')))]),
          ...(vit ? [el('div', { class: 'hud-row hud-vital' + (vit.index >= 4 || vit.dead ? ' bad' : '') }, el('span', { class: 'hud-label' }, '♥ AvA'), el('b', {}, vit.dead ? 'kein Signal' : `${Math.round(sv.tank.cond)} % · ${vit.name}`))] : []),
          ...(buffs.length ? [el('div', { class: 'hud-row hud-buffs' }, el('span', { class: 'hud-label' }, 'BUFFS'), el('b', {}, buffs.join(' · ')))] : []),
          ...(G ? [goalEl(G, run)] : []));
      }
    }
  }
}

// the red thread (#016): ◆ next step to the cure (or the tank when it is weak), a thin bar of the way so far; compact in the run
export function goalEl(G, compact = false) {
  return el('div', { class: `hud-goal ${G.kind}` + (compact ? ' compact' : '') },
    el('div', { class: 'hud-goal-text' }, el('i', {}, G.kind === 'tank' || G.kind === 'lost' ? '♥' : G.quest ? '◇' : '◆'), el('b', {}, G.text)),
    compact && G.kind !== 'tank' ? null : el('small', {}, G.sub),
    el('span', { class: 'hud-goal-bar', style: `--p:${Math.round((G.progress || 0) * 100)}%` }));
}
