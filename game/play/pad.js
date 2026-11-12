// Controller support (Daniel, 10.11.2026: "zumindest Xbox und PS aufwandsarm einbinden"): the browser's Gamepad API.
// Controllers with the "standard" mapping (Xbox, PlayStation, Stadia in Bluetooth mode, Switch Pro …) report their buttons
// in the same order, so one mapping fits all (Spiel › Controller). The controller's name only picks the button labels.
//
// Standard buttons: 0 bottom, 1 right, 2 left, 3 top, 4 LB, 5 RB, 6 LT, 7 RT, 8 Select, 9 Start, 10 left stick, 11 right stick,
// 12–15 d-pad up/down/left/right, 16 home.

export const PAD_BUTTONS = [['0', 'Unten (A / ✕)'], ['1', 'Rechts (B / ○)'], ['2', 'Links (X / □)'], ['3', 'Oben (Y / △)'],
  ['4', 'LB / L1'], ['5', 'RB / R1'], ['6', 'LT / L2'], ['7', 'RT / R2'], ['8', 'Select / Share'], ['9', 'Start / Options'],
  ['10', 'Linker Stick drücken'], ['11', 'Rechter Stick drücken'], ['12', 'Steuerkreuz hoch'], ['13', 'Steuerkreuz runter'],
  ['14', 'Steuerkreuz links'], ['15', 'Steuerkreuz rechts'], ['up', 'Linker Stick ↑ antippen (nur mit E-Hinweis)']];

// actions of the game (scene.js KEYS) that a controller can trigger
export const PAD_ACTIONS = [['jump', 'Springen'], ['dash', 'Dash'], ['melee', 'Nahkampf'], ['ranged', 'Schießen · halten: wegstecken'], ['reload', 'Nachladen'],
  ['grab', 'Benutzen (mit Hinweis)'], ['walk', 'Gehen'], ['inventory', 'Inventar'], ['help', 'Menü / Pause'], ['pose', 'Yoga'], ['holster', 'Waffe ziehen / wegstecken (Schalter)'], ['swap', 'Fernkampfwaffe wechseln'], ['down', 'Ducken / Slide (zusätzlich zum Stick)']];

export const PAD_DEFAULTS = { enabled: true, deadzone: 30, walkTilt: 65,
  useTilt: 70,
  // Daniel, 12.11.2026: X melee, Y shoot (Quick Draw, hold = holster), use = left stick up (with a prompt on screen)
  map: { jump: ['0'], dash: ['1', '6'], melee: ['2'], ranged: ['3', '7'], reload: ['5'], grab: ['up'], walk: ['4'], inventory: ['8'], help: ['9'], pose: ['11'], holster: [], swap: ['10'], down: [] } };

const LABELS = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L', 'R', '↑', '↓', '←', '→'],
  ps: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', '↑', '↓', '←', '→'],
  switch: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L', 'R', '↑', '↓', '←', '→'],
  stadia: ['A', 'B', 'X', 'Y', 'L1', 'R1', 'L2', 'R2', '…', 'Menü', 'L3', 'R3', '↑', '↓', '←', '→'],
};
export const PAD_KINDS = [['auto', 'Automatisch (Name des Controllers)'], ['xbox', 'Xbox'], ['ps', 'PlayStation'], ['switch', 'Switch'], ['stadia', 'Stadia']];
export function padKind(id = '') {
  if (/xbox|xinput|045e/i.test(id)) return 'xbox';
  if (/054c|playstation|dualsense|dualshock|wireless controller/i.test(id)) return 'ps';
  if (/057e|pro controller|joy-con/i.test(id)) return 'switch';
  if (/stadia|18d1/i.test(id)) return 'stadia';
  return 'xbox';   // Xbox, Stadia and most others carry A B X Y in the same places
}
export const padLabel = (kind, button) => button === 'up' ? '↑' : LABELS[kind]?.[Number(button)] ?? `#${button}`;

export class Pad {
  constructor(config = {}) {
    this.c = { ...PAD_DEFAULTS, ...config, map: { ...PAD_DEFAULTS.map, ...(config.map || {}) } };
    this.prev = new Set(); this.now = new Set(); this.uiNow = new Set(); this.uiPrev = new Set(); this.kind = null; this.active = false;
  }
  get pad() {
    if (this.c.enabled === false || typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    return [...navigator.getGamepads()].find(g => g && g.connected) || null;
  }
  // once per frame: which actions are held (stick, d-pad, buttons) → this.now
  poll() {
    const g = this.pad;
    this.prev = this.now; this.now = new Set();
    this.uiPrev = this.uiNow || new Set(); this.uiNow = new Set();
    this.kind = g ? (this.c.symbols && this.c.symbols !== 'auto' ? this.c.symbols : padKind(g.id)) : null;
    this.right = [0, 0];
    if (!g) return this;
    // right stick (AvA on the rubber band, Daniel 12.11.2026): raw direction beyond the dead zone, scaled back to 0 … 1
    const rx = g.axes[2] || 0, ry = g.axes[3] || 0, rm = Math.hypot(rx, ry), rdz = (this.c.deadzone ?? 30) / 100 * 0.6;
    if (rm > rdz) { const q = Math.min(1, (rm - rdz) / (1 - rdz)) / rm; this.right = [rx * q, ry * q]; }
    const dz = (this.c.deadzone ?? 30) / 100, ax = g.axes[0] || 0, ay = g.axes[1] || 0;
    // 'up' = a clear flick of the left stick upwards (Spiel › Controller › Benutzen ab), or the d-pad up
    const stickUp = ay < -(this.c.useTilt ?? 70) / 100 || (g.buttons[12]?.pressed ?? false);
    const btn = i => { if (i === 'up') return stickUp; const b = g.buttons[i]; return !!b && (b.pressed || b.value > 0.5); };
    this.viaUp = new Set();
    if (ax < -dz || btn(14)) this.now.add('left');
    if (ax > dz || btn(15)) this.now.add('right');
    if (ay < -dz - 0.2 || btn(12)) this.now.add('up');
    if (ay > dz + 0.2 || btn(13)) this.now.add('down');
    // stick only half tilted = walking (Spiel › Controller › Gehen bis)
    if (Math.abs(ax) > dz && Math.abs(ax) < (this.c.walkTilt ?? 65) / 100) this.now.add('walk');
    for (const [action, list] of Object.entries(this.c.map)) {
      const on = (list || []).filter(i => btn(i === 'up' ? 'up' : Number(i)));
      if (!on.length) continue;
      this.now.add(action);
      if (on.every(i => i === 'up')) this.viaUp.add(action);   // only the stick flick: the scene decides whether it counts (prompt on screen)
    }
    // window keys (ui_nav.js): fixed buttons, independent of the game mapping
    const U = this.uiNow, wdz = Math.max(dz, 0.5);
    if (ax < -wdz || btn(14)) U.add('left'); if (ax > wdz || btn(15)) U.add('right');
    if (ay < -wdz || btn(12)) U.add('up'); if (ay > wdz || btn(13)) U.add('down');
    for (const [a, b] of [['ok', 0], ['back', 1], ['context', 2], ['send', 3], ['prev', 4], ['next', 5]]) if (btn(b)) U.add(a);
    if (this.now.size || U.size) this.active = true;
    return this;
  }
  down(a) { return this.now.has(a); }
  pressed(a) { return this.now.has(a) && !this.prev.has(a); }
  labelOf(button) { return padLabel(this.kind || 'xbox', button); }
  // name of the icon cell (asset of kind „Symbole“, Spiel › Controller › Symbole): xbox_0 … xbox_11, xbox_dpad, xbox_stick
  iconName(button) { const k = this.kind || 'xbox', b = Number(button); return button === 'up' ? `${k}_stick` : b >= 12 && b <= 15 ? `${k}_dpad` : `${k}_${b}`; }
  label(action) { const b = this.c.map[action]?.[0]; return b == null ? null : padLabel(this.kind || 'xbox', b); }
}
