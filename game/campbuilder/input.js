// CampBuilder v2 (#196): input from a controller and from touch, no mouse (Daniel, 28.11.2026: „Bedienung nur mit Controller und
// ggf. Touch, aber nicht Maus“). Every frame poll() gives one state: sticks, triggers, buttons (held, pressed, released, how long),
// plus the touch fingers. A virtual pad (window.campbuilder, tests) adds its buttons and sticks on top of the real one.
// Buttons (standard mapping): a b x y lb rb lt rt select start ls rs up down left right.
import { padKind } from '../play/pad.js';
import { hapticsOn } from '../haptics.js';

export const BUTTONS = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'select', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right'];
const DZ = 0.18;
const dead = (x, y, dz = DZ) => { const m = Math.hypot(x, y); if (m < dz) return [0, 0]; const k = Math.min(1, (m - dz) / (1 - dz)) / m; return [x * k, y * k]; };

export class Input {
  constructor(canvasParent) {
    this.virtual = { buttons: new Set(), left: [0, 0], right: [0, 0], lt: 0, rt: 0 };
    this.held = new Map(); this.prev = new Set(); this.now = new Set();
    this.left = [0, 0]; this.right = [0, 0]; this.lt = 0; this.rt = 0; this.kind = 'xbox'; this.padSeen = false;
    this.touches = new Map(); this.touch = null; this.lastInput = 0;
    if (canvasParent) this.bindTouch(canvasParent);
  }
  get pad() { try { return [...(navigator.getGamepads?.() || [])].find(g => g && g.connected) || null; } catch { return null; } }
  poll(time) {
    const g = this.pad, V = this.virtual;
    this.prev = this.now; this.now = new Set(V.buttons);
    let L = [...V.left], R = [...V.right], lt = V.lt, rt = V.rt;
    if (g) {
      this.padSeen = true; this.kind = padKind(g.id);
      const b = i => !!g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.5);
      BUTTONS.forEach((n, i) => { if (b(i)) this.now.add(n); });
      const l = dead(g.axes[0] || 0, g.axes[1] || 0), r = dead(g.axes[2] || 0, g.axes[3] || 0);
      if (Math.hypot(...l) > Math.hypot(...L)) L = l;
      if (Math.hypot(...r) > Math.hypot(...R)) R = r;
      lt = Math.max(lt, g.buttons[6]?.value || 0); rt = Math.max(rt, g.buttons[7]?.value || 0);
    }
    this.left = L; this.right = R; this.lt = lt < 0.06 ? 0 : lt; this.rt = rt < 0.06 ? 0 : rt;
    for (const n of this.now) if (!this.prev.has(n)) this.held.set(n, time);
    for (const n of this.prev) if (!this.now.has(n)) this.held.delete(n);
    if (this.now.size || Math.hypot(...L) > 0 || Math.hypot(...R) > 0 || lt || rt || this.touches.size) this.lastInput = time;
    return this;
  }
  down(n) { return this.now.has(n); }
  pressed(n) { return this.now.has(n) && !this.prev.has(n); }
  released(n) { return !this.now.has(n) && this.prev.has(n); }
  heldFor(n, time) { return this.held.has(n) ? time - this.held.get(n) : 0; }
  anyButton() { return [...this.now].some(n => !this.prev.has(n)); }

  // ---------- touch: one finger builds (the point sits a little above the finger, so the finger does not hide it), two fingers move
  // and zoom the view. A mouse is ignored on purpose. ----------
  bindTouch(el) {
    const T = this.touches;
    const pos = e => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r.width, r.height]; };
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      e.preventDefault(); el.setPointerCapture?.(e.pointerId);
      T.set(e.pointerId, { at: pos(e), start: pos(e), t: performance.now() });
      this.onTouch?.('down', this.touchState());
    }, { passive: false });
    el.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse' || !T.has(e.pointerId)) return;
      e.preventDefault(); T.get(e.pointerId).at = pos(e);
      this.onTouch?.('move', this.touchState());
    }, { passive: false });
    const up = e => {
      if (e.pointerType === 'mouse' || !T.has(e.pointerId)) return;
      const t = T.get(e.pointerId); T.delete(e.pointerId);
      this.onTouch?.('up', { ...this.touchState(), ended: t });
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  touchState() { return { n: this.touches.size, list: [...this.touches.values()] }; }

  // ---------- vibration: soft, short; CampBuilder › Gefühl › Vibration ----------
  rumble(strength = 0.3, ms = 30, cfg = {}) {
    if (cfg.enabled === false || !hapticsOn()) return;
    const k = Math.max(0, Math.min(1, strength * (cfg.strength ?? 60) / 60));
    if (k <= 0.01) return;
    this.rumbles = (this.rumbles || 0) + 1;
    const g = this.pad;
    try { g?.vibrationActuator?.playEffect?.('dual-rumble', { duration: Math.max(12, ms), strongMagnitude: Math.min(1, k * 0.7), weakMagnitude: Math.min(1, k) })?.catch?.(() => {}); } catch { /* no rumble */ }
    if (!g && this.touches.size && typeof navigator !== 'undefined' && navigator.vibrate) try { navigator.vibrate(Math.round(Math.max(6, ms * k))); } catch { /* not allowed */ }
  }
}
