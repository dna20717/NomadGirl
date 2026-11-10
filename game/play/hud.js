// HUD as HTML over the canvas: health, ammo, dash, time, kills, Δ, banners and the controls overlay.
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { loadVersion } from '../version.js';
import { clockText } from '../save.js';

const CONTROLS = [
  ['A D / ← →', 'Laufen'], ['Shift halten', 'Gehen statt Rennen'], ['Leertaste', 'Springen (nochmal in der Luft: Doppelsprung)'],
  ['L oder C', 'Dash (auch in der Luft)'], ['S / ↓ beim Rennen', 'Slide (unter Hindernissen durch)'], ['S + Leertaste', 'Von Plattform fallen'], ['S / ↓ im Stand', 'Ducken; an der Kante + Richtung: runter hängen'],
  ['Richtung zur Wand im Sprung', 'Kante greifen; W/Leertaste: hochziehen, S: loslassen, Leertaste weg von der Wand: abspringen'],
  ['W / ↑ an der Leiter', 'Klettern'], ['W / ↑ oder E in der Luft', 'Am Seil festhalten, Leertaste: loslassen mit Schwung'],
  ['E', 'Benutzen: Werkstätten (Kochnische/Werkbank: Kochen & Craften), Lagerfeuer, Companions, Van (im Run: zurück ins Camp)'], ['J oder Y', 'Nahkampf (antippen = leicht, 3 s halten und loslassen = schwer)'], ['K oder X', 'Schießen (nur am Boden, Waffe gezogen)'], ['R', 'Nachladen (im Stehen und Gehen)'], ['P', 'Yoga-Pose (nochmal P oder bewegen = auflösen)'], ['Rücktaste', 'Raum neu starten'], ['M', 'Ton an/aus'], ['I oder Tab', 'Inventar (Maus: klicken nehmen/ablegen, Rechtsklick drehen, Doppelklick rüber, auf „Benutzen“ legen = essen)'], ['B (im Camp)', 'Rig bauen: Werkstätten und Anhänger mit der Maus ziehen (Schrottplatz, Händler, Kupplungen), Strg+Z rückgängig, B fertig'], ['H / Esc', 'Diese Hilfe'], ['G', 'Hitboxen zeigen'],
];

export class Hud {
  constructor(root, { workshopDrafts = 0, commit = null } = {}) {
    this.healthBar = el('i'); this.healthText = el('b');
    this.ammo = el('b'); this.dash = el('span', { class: 'hud-dash' }, 'DASH');
    this.time = el('b'); this.kills = el('b'); this.deltas = el('b'); this.roomName = el('span', { class: 'hud-room' });
    this.bannerEl = el('div', { class: 'hud-banner', hidden: true });
    this.promptEl = el('div', { class: 'hud-prompt', hidden: true });
    this.menuEl = el('div', { class: 'hud-menu', hidden: true });
    this.campEl = el('div', { class: 'hud-camp', hidden: true });
    // the rig can be rebuilt any time in the camp: B or this button (Daniel, 08.11.2026: "kein Umweg über einen Warroom mehr")
    // „Rig offen“ (Daniel, 09.11.2026: only a button, no key): all closed containers stay open; remembered in this browser
    try { this.rigOpen = localStorage.getItem('nomadgirl-rig-open') === '1'; } catch { this.rigOpen = false; }
    this.openBtn = el('button', { class: 'hud-openbtn', hidden: true, onclick: e => { e.currentTarget.blur(); this.setRigOpen(!this.rigOpen); } });
    this.setRigOpen(this.rigOpen);
    this.buildBtn = el('button', { class: 'hud-buildbtn', hidden: true, title: 'Rig bauen: Werkstätten und Anhänger mit der Maus ziehen', onclick: e => { e.currentTarget.blur(); this.scene?.openBuild(); } }, el('kbd', {}, 'B'), el('span', {}, 'Rig bauen'));
    this.modal = false;
    document.addEventListener('keydown', e => { if (this.pad) this.pad.active = false; this.menuKey(e); }, true);
    this.help = el('div', { class: 'hud-help' }, el('div', { class: 'hud-helpBox' },
      el('h2', {}, 'Steuerung'),
      this.padHelpEl = el('div', { class: 'hud-padhelp', hidden: true }),
      this.keyHelpEl = el('dl', {}, ...CONTROLS.flatMap(([k, t]) => [el('dt', {}, k), el('dd', {}, t)])),
      el('p', {}, 'Alle Werte kommen aus der Werkstatt (Leyla, Waffen, Gegner, Raum-Bausteine).',
        commit ? el('b', {}, ` Spieldaten live aus dem Repository (Stand ${commit.slice(0, 7)}).`) : null,
        workshopDrafts ? el('b', {}, ` Dein gespeicherter Werkstatt-Stand ist aktiv (${workshopDrafts} ${workshopDrafts === 1 ? 'Datei' : 'Dateien'}).`) : null),
      this.goBtn = el('button', { class: 'hud-go', onclick: () => this.toggleHelp(false) }, 'Los geht’s')));
    root.append(
      el('div', { class: 'hud-top' },
        el('div', { class: 'hud-left' },
          el('div', { class: 'hud-health' }, el('span', { class: 'hud-bar' }, this.healthBar), this.healthText),
          el('div', { class: 'hud-row' }, el('span', { class: 'hud-label' }, 'NÄGEL'), this.ammo, this.dash)),
        el('div', { class: 'hud-right' },
          el('div', { class: 'hud-row' }, this.roomName),
          el('div', { class: 'hud-row' }, el('span', { class: 'hud-label' }, 'ZEIT'), this.time, el('span', { class: 'hud-label' }, 'KILLS'), this.kills, el('span', { class: 'hud-label' }, 'Δ'), this.deltas))),
      this.campEl, this.buildBtn, this.openBtn, this.bannerEl, this.promptEl, this.menuEl, this.help,
      el('div', { class: 'hud-foot' }, 'H: Steuerung · Rücktaste: Neustart · ', el('a', { href: 'workshop.html' }, 'Werkstatt'), ' · ', el('a', { href: './' }, 'Start'),
        this.newGame = el('span', { hidden: true }, ' · ', el('a', { href: 'game.html?camp&new', onclick: e => { if (!confirm('Spielstand löschen und neu anfangen?')) e.preventDefault(); } }, 'Neues Spiel')),
        this.versionEl = el('span', { class: 'hud-version' })));
    loadVersion().then(v => { this.versionEl.textContent = ' · ' + v.text; this.versionEl.title = 'Version dieses Spiels' + (v.commit ? ': ' + v.commit : ''); this.version = v; });
    this.root = root;
    this.paused = true;   // help is open at the start
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
    this.newGame.hidden = mode !== 'camp';
    this.buildBtn.hidden = mode !== 'camp';
    this.openBtn.hidden = mode !== 'camp';
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
  menu({ title, sub = '', items = [] }) {
    this.modal = true; this.menuItems = items; this.menuTitle = title;
    this.menuIndex = Math.max(0, items.findIndex(i => !i.disabled));
    this.menuButtons = items.map((it, i) => el('button', { class: 'hud-item' + (it.primary ? ' primary' : ''), disabled: !!it.disabled, onclick: () => this.choose(i), onmouseenter: () => this.focus(i) },
      el('kbd', {}, String(i + 1)), el('span', {}, el('b', {}, it.label), it.sub || it.disabled ? el('small', {}, [it.sub, it.disabled].filter(Boolean).join(' · ')) : null)));
    this.menuEl.replaceChildren(el('div', { class: 'hud-menuBox' }, el('h2', {}, title), sub ? el('p', {}, sub) : null, el('div', { class: 'hud-items' }, ...this.menuButtons),
      this.menuKeysEl = el('small', { class: 'hud-keys' })));
    this.menuKeys();
    this.menuEl.hidden = false;
    this.promptEl.hidden = true;
    this.focus(this.menuIndex);
  }
  focus(i) { this.menuIndex = i; this.menuButtons?.forEach((b, k) => b.classList.toggle('focus', k === i)); }
  closeMenu() { this.modal = false; this.menuEl.hidden = true; this.menuItems = null; this.promptEl.hidden = !this.promptText; }
  choose(i) {
    const it = this.menuItems?.[i];
    if (!it || it.disabled) return false;
    this.closeMenu();
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
  // footer of a menu: keyboard keys or the controller's symbols (d-pad, bottom, right)
  menuKeys() {
    if (!this.menuKeysEl) return;
    const p = this.pad?.active && this.pad.kind ? this.pad : null;
    if (!p) return this.menuKeysEl.replaceChildren('W/S wählen · E oder Enter nehmen · Esc zurück');
    const ico = (b, alt) => this.padIcon(p.iconName(b), alt) || el('b', {}, alt);
    this.menuKeysEl.replaceChildren(ico(12, '✚'), ' wählen · ', ico(0, p.labelOf(0)), ' nehmen · ', ico(1, p.labelOf(1)), ' zurück');
  }
  // one cell of the controller symbols (Spiel › Controller › Symbole) as a pixel-sharp CSS sprite, ×2; null without symbols
  padIcon(name, title = '') {
    const I = this.padIcons, i = I?.names.indexOf(name) ?? -1;
    if (!I || i < 0) return null;
    const k = 2, [cw, ch] = I.cell, x = i % I.grid[0], y = Math.floor(i / I.grid[0]);
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
    if (this.modal) this.menuKeys();
    const kind = pad?.kind || null;
    this.padHelpEl.hidden = !kind;
    this.keyHelpEl.hidden = active;   // with the controller in hand: only its buttons
    this.goBtn.replaceChildren(...(active ? [this.padIcon(pad.iconName(0), pad.labelOf(0)) || '', ' '] : []), 'Los geht’s');
    if (!kind) return;
    const ico = b => this.padIcon(pad.iconName(b), pad.labelOf(b)) || el('b', {}, pad.labelOf(b));
    const names = { xbox: 'Xbox', ps: 'PlayStation', switch: 'Switch', stadia: 'Stadia' };
    const rows = [[[this.padIcon(`${kind}_stick`, 'Stick') || el('b', {}, 'Stick'), ico(12)], 'Laufen (halb neigen = gehen), runter = Ducken/Slide, hoch = Leiter'],
      ...actions.map(([a, name]) => [(pad.c.map[a] || []).map(ico), name]).filter(([k]) => k.length),
      [[ico(12), ico(0), ico(1)], 'Menüs: wählen, nehmen, zurück']];
    this.padHelpEl.replaceChildren(el('h3', {}, `Controller · ${names[kind] || kind}`), el('dl', {}, ...rows.flatMap(([k, t]) => [el('dt', {}, ...k.flatMap((x, i) => i ? [' ', x] : [x])), el('dd', {}, t)])),
      ...(active ? [el('p', { class: 'hud-small' }, 'Eine Taste auf der Tastatur zeigt wieder die Tastenbelegung.')] : [el('h3', {}, 'Tastatur')]));
  }
  menuState() { return this.modal ? { title: this.menuTitle, items: this.menuItems.map(i => ({ label: i.label, sub: i.sub || '', disabled: i.disabled || null })) } : null; }
  toggleHelp(on = !this.paused) { this.paused = on; this.help.hidden = !on; }
  room(name, count) { this.roomName.textContent = name; this.total = count; }
  banner(title, sub = '') {
    this.bannerEl.hidden = !title;
    this.bannerEl.replaceChildren(...(title ? [el('b', {}, title), el('small', {}, sub)] : []));
  }
  hurt() { this.root.classList.remove('hud-hurt'); void this.root.offsetWidth; this.root.classList.add('hud-hurt'); }

  update(scene, time) {
    const l = scene.leyla, max = l.maxHealth;
    this.healthBar.style.width = `${Math.max(0, l.health / max * 100)}%`;
    this.healthText.textContent = `${Math.ceil(l.health)}/${max}`;
    this.ammo.textContent = l.reloading ? 'lädt …' : l.mag === Infinity ? '∞' : l.magSize === Infinity || l.magSize >= 999 ? String(l.mag) : `${l.mag}/${l.ammo === Infinity ? '∞' : l.ammo}`;
    this.dash.classList.toggle('ready', time >= l.dashReady);
    this.time.textContent = scene.clock();
    this.kills.textContent = `${scene.kills}/${this.total ?? 0}`;
    this.deltas.textContent = String(scene.deltas);
    const sv = this.save;
    if (sv) {
      const D = this.D, loc = D.locations?.[sv.location]?.name || '';
      const key = [sv.day, sv.hour, sv.location, sv.deltas, sv.fuel, sv.food, sv.buffs.join(), this.modeName].join('|');
      if (key !== this.campKey) {
        this.campKey = key;
        const buffs = sv.buffs.map(b => D.buffs?.[b]?.name || b);
        this.campEl.replaceChildren(
          el('div', { class: 'hud-row' }, el('span', { class: 'hud-room' }, `${clockText(sv)} · ${loc}`)),
          el('div', { class: 'hud-row' }, el('span', { class: 'hud-label' }, 'Δ'), el('b', {}, String(sv.deltas)), el('span', { class: 'hud-label' }, 'SPRIT'), el('b', {}, `${Math.round(sv.fuel)} l`),
            el('span', { class: 'hud-label' }, 'VORRÄTE'), el('b', {}, (Math.round(sv.food * 10) / 10).toLocaleString('de-DE'))),
          ...(buffs.length ? [el('div', { class: 'hud-row hud-buffs' }, el('span', { class: 'hud-label' }, 'BUFFS'), el('b', {}, buffs.join(' · ')))] : []));
      }
    }
  }
}
