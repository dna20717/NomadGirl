// HUD as HTML over the canvas: health, ammo, dash, time, kills, Δ, banners and the controls overlay.
import { el } from '../ui.js';

const CONTROLS = [
  ['A D / ← →', 'Laufen'], ['Shift halten', 'Gehen statt Rennen'], ['Leertaste', 'Springen (nochmal in der Luft: Doppelsprung)'],
  ['L oder C', 'Dash (auch in der Luft)'], ['S / ↓ beim Rennen', 'Slide (unter Hindernissen durch)'], ['S + Leertaste', 'Von Plattform fallen'],
  ['W / ↑ an der Leiter', 'Klettern'], ['W / ↑ oder E in der Luft', 'Am Seil festhalten, Leertaste: loslassen mit Schwung'],
  ['J oder Y', 'Nahkampf'], ['K oder X', 'Fernkampf'], ['R', 'Raum neu starten'], ['H / Esc', 'Diese Hilfe'], ['G', 'Hitboxen zeigen'],
];

export class Hud {
  constructor(root, { workshopDrafts = 0 } = {}) {
    this.healthBar = el('i'); this.healthText = el('b');
    this.ammo = el('b'); this.dash = el('span', { class: 'hud-dash' }, 'DASH');
    this.time = el('b'); this.kills = el('b'); this.deltas = el('b'); this.roomName = el('span', { class: 'hud-room' });
    this.bannerEl = el('div', { class: 'hud-banner', hidden: true });
    this.help = el('div', { class: 'hud-help' }, el('div', { class: 'hud-helpBox' },
      el('h2', {}, 'Steuerung'),
      el('dl', {}, ...CONTROLS.flatMap(([k, t]) => [el('dt', {}, k), el('dd', {}, t)])),
      el('p', {}, 'Alle Werte kommen aus der Werkstatt (Leyla, Waffen, Gegner, Raum-Bausteine).',
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
      this.bannerEl, this.help,
      el('div', { class: 'hud-foot' }, 'H: Steuerung · R: Neustart · ', el('a', { href: 'workshop.html' }, 'Werkstatt'), ' · ', el('a', { href: './' }, 'Start')));
    this.root = root;
    this.paused = true;   // help is open at the start
  }

  firstKey() {}
  toggleHelp(on = !this.paused) { this.paused = on; this.help.hidden = !on; }
  room(name, count) { this.roomName.textContent = name; this.total = count; }
  banner(title, sub = '') {
    this.bannerEl.hidden = !title;
    this.bannerEl.replaceChildren(...(title ? [el('b', {}, title), el('small', {}, sub)] : []));
  }
  hurt() { this.root.classList.remove('hud-hurt'); void this.root.offsetWidth; this.root.classList.add('hud-hurt'); }

  update(scene, time) {
    const l = scene.leyla, max = l.d.health ?? 100;
    this.healthBar.style.width = `${Math.max(0, l.health / max * 100)}%`;
    this.healthText.textContent = `${Math.ceil(l.health)}/${max}`;
    this.ammo.textContent = l.ammo === Infinity ? '∞' : String(l.ammo);
    this.dash.classList.toggle('ready', time >= l.dashReady);
    this.time.textContent = scene.clock();
    this.kills.textContent = `${scene.kills}/${this.total ?? 0}`;
    this.deltas.textContent = String(scene.deltas);
  }
}
