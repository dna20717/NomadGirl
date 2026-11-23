// Feedback for the test phase (#181): the window. Chips (what kind of feedback), an optional text, the picture of the moment,
// Abbrechen | Abschicken. Works with mouse, keyboard and controller (its own Gamepad poll, the game is paused meanwhile):
//   stick / d-pad move the focus · A takes (chip on/off, text field, button) · B cancels · Start sends
//   keyboard: Esc cancels, Strg/Cmd + Enter sends; keys typed here never reach the game.
import { el } from '../ui.js';
import { icon } from '../icons.js';

export const CHIPS = [
  { id: 'gut', label: 'Gut', icon: 'thumbsUp' },
  { id: 'schlecht', label: 'Schlecht', icon: 'thumbsDown' },
  { id: 'bug', label: 'Bug', icon: 'bug' },
  { id: 'idee', label: 'Idee', icon: 'light' },
  { id: 'verwirrend', label: 'Verwirrend', icon: 'help' },
];

export class FeedbackDialog {
  constructor({ shot, where = '', chip = null, text = '', onSend, onClose }) {
    this.chip = chip; this.onSend = onSend; this.onClose = onClose; this.busy = false;
    this.chipEls = CHIPS.map(c => el('button', { class: 'fb-chip', type: 'button', 'data-chip': c.id, onclick: () => this.pick(c.id) }, icon(c.icon, 16), ' ', c.label));
    this.text = el('textarea', { class: 'fb-text', rows: '4', maxlength: '2000', placeholder: 'Was war gut, was war schlecht? (optional, Tastatur)' });
    this.text.value = text;
    this.cancelBtn = el('button', { class: 'fb-btn', type: 'button', onclick: () => this.close() }, 'Abbrechen');
    this.sendBtn = el('button', { class: 'fb-btn fb-send', type: 'button', onclick: () => this.send() }, icon('send', 16), ' Abschicken');
    this.status = el('div', { class: 'fb-status' });
    const pic = shot ? el('img', { class: 'fb-shot', src: shot, alt: 'Bild vom Moment' }) : el('div', { class: 'fb-shot fb-noshot' }, 'kein Bild');
    this.root = el('div', { class: 'fb-overlay', role: 'dialog', 'aria-label': 'Feedback' },
      el('div', { class: 'fb-box' },
        el('div', { class: 'fb-head' }, icon('speechBubble', 18), el('span', {}, 'Feedback'), el('span', { class: 'fb-where' }, where)),
        el('div', { class: 'fb-body' }, pic,
          el('div', { class: 'fb-main' },
            el('div', { class: 'fb-chips' }, this.chipEls),
            this.text,
            el('div', { class: 'fb-hint' }, 'Mit dabei: das Bild, die letzten 30 s als Spur (Position, Eingaben, Fehler), Ort und Version.'))),
        el('div', { class: 'fb-foot' }, this.status, el('span', { class: 'fb-keys' }, 'Steuerkreuz wählen · A nehmen · B zurück · Start abschicken'), this.cancelBtn, this.sendBtn)));
    // focus grid for keyboard-less control: row 0 chips, row 1 text, row 2 buttons
    this.rows = [this.chipEls, [this.text], [this.cancelBtn, this.sendBtn]];
    this.pos = [0, chip ? CHIPS.findIndex(c => c.id === chip) : 0];
    this.root.addEventListener('keydown', e => {
      e.stopPropagation();   // typing here must not move Leyla or open menus
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.send(); }
    });
    for (const type of ['keyup', 'keypress']) this.root.addEventListener(type, e => e.stopPropagation());
    this.refresh();
  }
  mount(parent = document.body) {
    parent.append(this.root); this.isOpen = true;
    this.prev = new Set(this.padButtons());   // buttons still held from the trigger do not count
    const loop = () => { if (!this.isOpen) return; this.pollPad(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    this.focusAt(this.pos);
    return this;
  }
  pick(id) { this.chip = this.chip === id ? null : id; this.refresh(); }
  refresh() {
    this.chipEls.forEach((b, i) => b.classList.toggle('on', CHIPS[i].id === this.chip));
    this.sendBtn.disabled = this.busy || (!this.chip && !this.text.value.trim());
  }
  focusAt([r, c]) {
    this.pos = [r, Math.min(c, this.rows[r].length - 1)];
    for (const row of this.rows) for (const b of row) b.classList.remove('fb-focus');
    const t = this.rows[this.pos[0]][this.pos[1]];
    t.classList.add('fb-focus');
    if (document.activeElement !== t) t.focus({ preventScroll: true });
  }
  move(dr, dc) {
    let [r, c] = this.pos;
    if (dr) { r = Math.max(0, Math.min(this.rows.length - 1, r + dr)); c = dr && r === 2 && this.pos[0] !== 2 ? 1 : c; }
    if (dc) c = Math.max(0, Math.min(this.rows[r].length - 1, c + dc));
    this.focusAt([r, c]);
  }
  activate() {
    const t = this.rows[this.pos[0]][this.pos[1]];
    if (t === this.text) { this.text.focus(); return; }
    t.click();
  }
  padButtons() {
    const g = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].find(p => p && p.connected) : null;
    if (!g) return [];
    const on = [];
    g.buttons.forEach((b, i) => { if (b && (b.pressed || b.value > 0.5)) on.push(String(i)); });
    const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
    if (ax < -0.5) on.push('L'); if (ax > 0.5) on.push('R'); if (ay < -0.5) on.push('U'); if (ay > 0.5) on.push('D');
    return on;
  }
  pollPad() {
    const now = new Set(this.padButtons()), before = this.prev, hit = k => now.has(k) && !before.has(k);
    this.prev = now;
    if (this.busy) return;
    if (hit('12') || hit('U')) this.move(-1, 0);
    else if (hit('13') || hit('D')) this.move(1, 0);
    else if (hit('14') || hit('L')) this.move(0, -1);
    else if (hit('15') || hit('R')) this.move(0, 1);
    else if (hit('0')) this.activate();
    else if (hit('1')) this.close();
    else if (hit('9')) this.send();
    if (document.activeElement === this.text) this.refresh();
  }
  async send() {
    this.refresh();
    if (this.busy || this.sendBtn.disabled) return;
    this.busy = true; this.refresh();
    this.status.textContent = 'Wird gesendet …'; this.status.className = 'fb-status';
    try {
      const r = await this.onSend({ chip: this.chip, text: this.text.value.trim() });
      this.status.textContent = r?.message || 'Danke!'; this.status.className = `fb-status ${r?.queued ? 'warn' : 'good'}`;
      setTimeout(() => this.close(true), r?.queued ? 2600 : 1400);
    } catch (e) {
      this.busy = false; this.refresh();
      this.status.textContent = `Ging nicht: ${e.message || e}`; this.status.className = 'fb-status bad';
    }
  }
  close(sent = false) {
    if (!this.isOpen) return;
    this.isOpen = false; cancelAnimationFrame(this.raf); this.root.remove();
    this.onClose?.(sent);
  }
}
