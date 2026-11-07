// HUD as HTML over the canvas: health, ammo, dash, time, kills, Δ, banners and the controls overlay.
import { el } from '../ui.js';
import { clockText } from '../save.js';

const CONTROLS = [
  ['A D / ← →', 'Laufen'], ['Shift halten', 'Gehen statt Rennen'], ['Leertaste', 'Springen (nochmal in der Luft: Doppelsprung)'],
  ['L oder C', 'Dash (auch in der Luft)'], ['S / ↓ beim Rennen', 'Slide (unter Hindernissen durch)'], ['S + Leertaste', 'Von Plattform fallen'], ['S / ↓ im Stand', 'Ducken; an der Kante + Richtung: runter hängen'],
  ['Richtung zur Wand im Sprung', 'Kante greifen; W/Leertaste: hochziehen, S: loslassen, Leertaste weg von der Wand: abspringen'],
  ['W / ↑ an der Leiter', 'Klettern'], ['W / ↑ oder E in der Luft', 'Am Seil festhalten, Leertaste: loslassen mit Schwung'],
  ['E', 'Benutzen: Werkstätten, Lagerfeuer, Companions, Van (im Run: zurück ins Camp)'], ['J oder Y', 'Nahkampf'], ['K oder X', 'Fernkampf'], ['R', 'Raum neu starten'], ['M', 'Ton an/aus'], ['H / Esc', 'Diese Hilfe'], ['G', 'Hitboxen zeigen'],
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
    this.modal = false;
    document.addEventListener('keydown', e => this.menuKey(e), true);
    this.help = el('div', { class: 'hud-help' }, el('div', { class: 'hud-helpBox' },
      el('h2', {}, 'Steuerung'),
      el('dl', {}, ...CONTROLS.flatMap(([k, t]) => [el('dt', {}, k), el('dd', {}, t)])),
      el('p', {}, 'Alle Werte kommen aus der Werkstatt (Leyla, Waffen, Gegner, Raum-Bausteine).',
        commit ? el('b', {}, ` Spieldaten live aus dem Repository (Stand ${commit.slice(0, 7)}).`) : null,
        workshopDrafts ? el('b', {}, ` Dein gespeicherter Werkstatt-Stand ist aktiv (${workshopDrafts} ${workshopDrafts === 1 ? 'Datei' : 'Dateien'}).`) : null),
      el('button', { class: 'hud-go', onclick: () => this.toggleHelp(false) }, 'Los geht’s')));
    root.append(
      el('div', { class: 'hud-top' },
        el('div', { class: 'hud-left' },
          el('div', { class: 'hud-health' }, el('span', { class: 'hud-bar' }, this.healthBar), this.healthText),
          el('div', { class: 'hud-row' }, el('span', { class: 'hud-label' }, 'NÄGEL'), this.ammo, this.dash)),
        el('div', { class: 'hud-right' },
          el('div', { class: 'hud-row' }, this.roomName),
          el('div', { class: 'hud-row' }, el('span', { class: 'hud-label' }, 'ZEIT'), this.time, el('span', { class: 'hud-label' }, 'KILLS'), this.kills, el('span', { class: 'hud-label' }, 'Δ'), this.deltas))),
      this.campEl, this.bannerEl, this.promptEl, this.menuEl, this.help,
      el('div', { class: 'hud-foot' }, 'H: Steuerung · R: Neustart · ', el('a', { href: 'workshop.html' }, 'Werkstatt'), ' · ', el('a', { href: './' }, 'Start'),
        this.newGame = el('span', { hidden: true }, ' · ', el('a', { href: 'game.html?camp&new', onclick: e => { if (!confirm('Spielstand löschen und neu anfangen?')) e.preventDefault(); } }, 'Neues Spiel'))));
    this.root = root;
    this.paused = true;   // help is open at the start
  }

  firstKey() {}

  // camp / run / test: which parts of the HUD show
  mode(mode, save, D) {
    this.modeName = mode; this.save = save; this.D = D;
    this.root.dataset.mode = mode;
    this.campEl.hidden = !save;
    this.newGame.hidden = mode !== 'camp';
    this.prompt(null);
    this.closeMenu();
  }
  // "E · Schlafen · Schlafkoje" at the bottom
  prompt(text) {
    this.promptText = text || null;
    this.promptEl.hidden = !text;
    if (text) this.promptEl.replaceChildren(el('kbd', {}, 'E'), el('span', {}, text));
  }
  // menu: { title, sub, items: [{ label, sub?, primary?, disabled?: reason, act }] }; keys W/S or ↑/↓, E/Enter/Leertaste, Esc, 1–9
  menu({ title, sub = '', items = [] }) {
    this.modal = true; this.menuItems = items; this.menuTitle = title;
    this.menuIndex = Math.max(0, items.findIndex(i => !i.disabled));
    this.menuButtons = items.map((it, i) => el('button', { class: 'hud-item' + (it.primary ? ' primary' : ''), disabled: !!it.disabled, onclick: () => this.choose(i), onmouseenter: () => this.focus(i) },
      el('kbd', {}, String(i + 1)), el('span', {}, el('b', {}, it.label), it.sub || it.disabled ? el('small', {}, [it.sub, it.disabled].filter(Boolean).join(' · ')) : null)));
    this.menuEl.replaceChildren(el('div', { class: 'hud-menuBox' }, el('h2', {}, title), sub ? el('p', {}, sub) : null, el('div', { class: 'hud-items' }, ...this.menuButtons),
      el('small', { class: 'hud-keys' }, 'W/S wählen · E oder Enter nehmen · Esc zurück')));
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
    const move = d => { let i = this.menuIndex; for (let s = 0; s < n; s++) { i = (i + d + n) % n; if (!this.menuItems[i].disabled) break; } this.focus(i); };
    if (k === 'Escape') this.closeMenu();
    else if (k === 'ArrowDown' || k === 's' || k === 'S') move(1);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') move(-1);
    else if (k === 'Enter' || k === ' ' || k === 'e' || k === 'E') this.choose(this.menuIndex);
    else if (/^[1-9]$/.test(k)) this.choose(Number(k) - 1);
    else return;
    e.preventDefault(); e.stopPropagation();
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
    this.ammo.textContent = l.ammo === Infinity ? '∞' : String(l.ammo);
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
