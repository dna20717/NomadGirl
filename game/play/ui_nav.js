// One UI grammar for every window (Daniel, 12.11.2026, 5b: „Inventare und Menüs haben keine einheitliche Identität in der Handhabung“):
// the same keys, the same hint line at the bottom, the same golden cursor in the pause/camp menus, the inventory, the cooking window
// and the build mode. Window keys never follow the game mapping (Spiel › Controller), they are fixed:
//
//   action    keyboard              controller (standard layout)
//   move      arrows / WASD         stick / d-pad
//   ok        E / Enter / Space     A (bottom)
//   back      Esc                   B (right)            one layer back: put back what is held, then close
//   context   R / right click       X (left)             turn, take out of the pot …
//   send      F / double click      Y (top)              to the other side (inventory: hold = throw on the ground; pot: all)
//   tabs      Q                     LB / RB
import { el } from '../ui.js';

export const UI_KEYS = { move: 'Pfeile', ok: 'E', back: 'Esc', context: 'R', send: 'F', tabs: 'Q' };
export const UI_BUTTONS = { move: 12, ok: 0, back: 1, context: 2, send: 3, tabs: [4, 5] };

// device state for the hints: set by the HUD whenever keyboard ↔ controller switches
const device = { pad: null, padIcon: null };
const shown = new Set();
export function setUiDevice(pad, padIcon) {
  device.pad = pad?.active && pad.kind ? pad : null; device.padIcon = padIcon;
  for (const h of [...shown]) { if (!h.el.isConnected) shown.delete(h); else render(h); }
}
export const padInUse = () => !!device.pad;

// hint line: hints([['move', 'wählen'], ['ok', 'nehmen'], ['back', 'zurück']], 'Maus: …')
export function hints(entries, extra = '') {
  const h = { el: el('div', { class: 'ui-hints' }), entries, extra };
  render(h); shown.add(h);
  return h.el;
}
// the key (keyboard) or button picture (controller) of one window action, e.g. in a tooltip
export function keyGlyph(a) {
  const p = device.pad;
  if (!p) return [el('kbd', {}, UI_KEYS[a])];
  return [].concat(UI_BUTTONS[a]).map(b => device.padIcon?.(p.iconName(b), p.labelOf(b)) || el('kbd', {}, p.labelOf(b)));
}
function render(h) {
  const p = device.pad, key = keyGlyph;
  const parts = h.entries.map(([a, text]) => el('span', {}, ...key(a), ' ', text));
  h.el.replaceChildren(...parts.flatMap((x, i) => i ? [el('i', {}, '·'), x] : [x]), ...(h.extra && !p ? [el('small', {}, h.extra)] : []));
}

// input for windows: keyboard and controller merged into the grammar's actions (scene.readInput builds it every frame)
export function uiInput(i, pad) {
  const now = new Set(), hit = new Set();
  const add = (a, down, pressed) => { if (down || pressed) now.add(a); if (pressed) hit.add(a); };
  for (const d of ['left', 'right', 'up', 'down']) add(d, i[d]?.down, i[d]?.pressed);
  add('ok', i.grab?.down || i.uiOk?.down || i.jump?.down, i.grab?.pressed || i.uiOk?.pressed || i.jump?.pressed);
  add('back', i.help?.down, i.help?.pressed);
  add('context', i.reload?.down, i.reload?.pressed);
  add('send', i.uiSend?.down, i.uiSend?.pressed);
  add('next', i.holster?.down, i.holster?.pressed);
  const keys = now.size > 0;
  if (pad?.kind) for (const a of pad.uiNow) { now.add(a); if (!pad.uiPrev.has(a)) hit.add(a); }
  return { now, keys, down: a => now.has(a), pressed: a => hit.has(a) };
}

// a golden cursor over the buttons of a window (cooking window, build bar): the next one in the pushed direction, ok clicks it
export class NavCursor {
  // start: selector of the first target when the cursor shows up (else the first button)
  constructor(root, start = null) {
    this.root = root; this.start = start; this.i = -1; this.on = false; this.rep = {};
    this.box = el('div', { class: 'ui-cursor', hidden: true });
    document.body.append(this.box);
    document.addEventListener('mousemove', () => { if (this.on) { this.on = false; this.box.hidden = true; } });
  }
  targets() {
    return [...this.root.querySelectorAll('button:not([disabled]), [data-nav]')].filter(n => n.offsetParent !== null && !n.closest('[hidden]'));
  }
  current() { const t = this.targets(); return t[Math.max(0, Math.min(t.length - 1, this.i))] || null; }
  // returns true when it used the input
  update(ui, now = performance.now()) {
    if (!ui.now.size && !this.on) return false;
    const T = this.targets();
    if (!T.length) return false;
    if (!this.on) {
      const k = this.i < 0 && this.start ? T.findIndex(n => n.matches(this.start)) : -1;
      this.on = true; this.i = k >= 0 ? k : Math.max(0, Math.min(T.length - 1, this.i)); this.show(); return true;
    }   // the first touch only shows the cursor
    for (const [d, dx, dy] of [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]]) {
      if (!ui.down(d)) { this.rep[d] = 0; continue; }
      if (!this.rep[d]) { this.rep[d] = now + 300; this.move(dx, dy); }
      else if (now >= this.rep[d]) { this.rep[d] = now + 95; this.move(dx, dy); }
    }
    const c = this.current();
    if (c && ui.pressed('ok')) { c.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); c.click(); }
    if (c && ui.pressed('send')) c.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }));   // Y / F = all of it (shift + click)
    if (c && ui.pressed('context')) { c.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2 })); c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button: 2 })); }
    this.show();
    return true;
  }
  move(dx, dy) {
    const T = this.targets(), c = this.current();
    if (!c) return;
    const r = c.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bd = Infinity;
    T.forEach((n, k) => {
      if (n === c) return;
      const q = n.getBoundingClientRect(), x = q.left + q.width / 2 - cx, y = q.top + q.height / 2 - cy;
      const along = x * dx + y * dy, side = Math.abs(x * dy) + Math.abs(y * dx);
      if (along <= 4) return;
      const d = along + side * 2.2;
      if (d < bd) { bd = d; best = k; }
    });
    if (best != null) this.i = best;
  }
  show() {
    const c = this.current();
    this.box.hidden = !this.on || !c;
    if (!c || !this.on) return;
    c.scrollIntoView?.({ block: 'nearest' });
    const r = c.getBoundingClientRect();
    Object.assign(this.box.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px` });
  }
  hide() { this.on = false; this.box.hidden = true; }
}
