// Controller support (Daniel, 10.11.2026: "zumindest Xbox und PS aufwandsarm einbinden"): the browser's Gamepad API.
// Controllers with the "standard" mapping (Xbox, PlayStation, Stadia in Bluetooth mode, Switch Pro …) report their buttons
// in the same order, so one mapping fits all (Spiel › Controller). The controller's name only picks the button labels.
//
// Standard buttons: 0 bottom, 1 right, 2 left, 3 top, 4 LB, 5 RB, 6 LT, 7 RT, 8 Select, 9 Start, 10 left stick, 11 right stick,
// 12–15 d-pad up/down/left/right, 16 home.

export const PAD_BUTTONS = [['0', 'Unten (A / ✕)'], ['1', 'Rechts (B / ○)'], ['2', 'Links (X / □)'], ['3', 'Oben (Y / △)'],
  ['4', 'LB / L1'], ['5', 'RB / R1'], ['6', 'LT / L2'], ['7', 'RT / R2'], ['8', 'Select / Share'], ['9', 'Start / Options'],
  ['10', 'Linker Stick drücken'], ['11', 'Rechter Stick drücken'], ['12', 'Steuerkreuz hoch'], ['13', 'Steuerkreuz runter'],
  ['14', 'Steuerkreuz links'], ['15', 'Steuerkreuz rechts']];

// actions of the game (scene.js KEYS) that a controller can trigger
export const PAD_ACTIONS = [['jump', 'Springen'], ['dash', 'Dash'], ['melee', 'Nahkampf'], ['ranged', 'Schießen'], ['reload', 'Nachladen'],
  ['grab', 'Benutzen (E)'], ['walk', 'Gehen'], ['inventory', 'Inventar'], ['help', 'Menü / Pause'], ['pose', 'Yoga'], ['holster', 'Waffe ziehen / wegstecken'], ['down', 'Ducken / Slide (zusätzlich zum Stick)']];

export const PAD_DEFAULTS = { enabled: true, deadzone: 30, walkTilt: 65,
  map: { jump: ['0'], dash: ['1', '6'], melee: ['2'], ranged: ['7'], reload: ['5'], grab: ['3'], walk: ['4'], inventory: ['8'], help: ['9'], pose: ['11'], holster: ['10'], down: [] } };

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
export const padLabel = (kind, button) => LABELS[kind]?.[Number(button)] ?? `#${button}`;

export class Pad {
  constructor(config = {}) {
    this.c = { ...PAD_DEFAULTS, ...config, map: { ...PAD_DEFAULTS.map, ...(config.map || {}) } };
    this.prev = new Set(); this.now = new Set(); this.kind = null; this.active = false;
  }
  get pad() {
    if (this.c.enabled === false || typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    return [...navigator.getGamepads()].find(g => g && g.connected) || null;
  }
  // once per frame: which actions are held (stick, d-pad, buttons) → this.now
  poll() {
    const g = this.pad;
    this.prev = this.now; this.now = new Set();
    this.kind = g ? (this.c.symbols && this.c.symbols !== 'auto' ? this.c.symbols : padKind(g.id)) : null;
    if (!g) return this;
    const btn = i => { const b = g.buttons[i]; return !!b && (b.pressed || b.value > 0.5); };
    const dz = (this.c.deadzone ?? 30) / 100, ax = g.axes[0] || 0, ay = g.axes[1] || 0;
    if (ax < -dz || btn(14)) this.now.add('left');
    if (ax > dz || btn(15)) this.now.add('right');
    if (ay < -dz - 0.2 || btn(12)) this.now.add('up');
    if (ay > dz + 0.2 || btn(13)) this.now.add('down');
    // stick only half tilted = walking (Spiel › Controller › Gehen bis)
    if (Math.abs(ax) > dz && Math.abs(ax) < (this.c.walkTilt ?? 65) / 100) this.now.add('walk');
    for (const [action, list] of Object.entries(this.c.map)) if ((list || []).some(i => btn(Number(i)))) this.now.add(action);
    if (this.now.size) this.active = true;
    return this;
  }
  down(a) { return this.now.has(a); }
  pressed(a) { return this.now.has(a) && !this.prev.has(a); }
  labelOf(button) { return padLabel(this.kind || 'xbox', button); }
  // name of the icon cell (asset of kind „Symbole“, Spiel › Controller › Symbole): xbox_0 … xbox_11, xbox_dpad, xbox_stick
  iconName(button) { const k = this.kind || 'xbox', b = Number(button); return b >= 12 && b <= 15 ? `${k}_dpad` : `${k}_${b}`; }
  label(action) { const b = this.c.map[action]?.[0]; return b == null ? null : padLabel(this.kind || 'xbox', b); }
}
