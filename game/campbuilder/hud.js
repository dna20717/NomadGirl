// CampBuilder v2 (#196): the quiet interface (DOM over the canvas, only --ui-* tokens, Inter + VT323, Lucide icons).
// Everything that is not world fades out a few seconds after the last button (CampBuilder › Gefühl › Hilfen blenden aus nach):
// the material chip, the line of hints with the buttons of the connected controller. On demand: the material wheel (LB held),
// the sun (Y held), the menu (Start). Touch gets a small bar of its own (material, add / take away, back, forth, sun, menu).
import { icon } from '../icons.js';

const PAD = { grid: [10, 6], file: 'projects/nomadgirl/assets/ui/pad_icons.png' };
const PAD_NAMES = ['xbox_0', 'xbox_1', 'xbox_2', 'xbox_3', 'xbox_4', 'xbox_5', 'xbox_6', 'xbox_7', 'xbox_8', 'xbox_9', 'stadia_0', 'stadia_1', 'stadia_2', 'stadia_3', 'stadia_4', 'stadia_5', 'stadia_6', 'stadia_7', 'stadia_8', 'stadia_9',
  'ps_0', 'ps_1', 'ps_2', 'ps_3', 'ps_4', 'ps_5', 'ps_6', 'ps_7', 'ps_8', 'ps_9', 'switch_0', 'switch_1', 'switch_2', 'switch_3', 'switch_4', 'switch_5', 'switch_6', 'switch_7', 'switch_8', 'switch_9',
  'stick_l', 'stick_l_up', 'stick_l_down', 'stick_l_left', 'stick_l_right', 'stick_l_press', 'stick_r', 'stick_r_up', 'stick_r_down', 'stick_r_left', 'stick_r_right', 'stick_r_press', 'dpad', 'dpad_up', 'dpad_down', 'dpad_left', 'dpad_right'];
const BTN = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9 };
const hh = h => { const m = Math.round((((h % 24) + 24) % 24) * 60); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Hud {
  constructor(root, base) {
    this.root = root; this.base = base; this.menuOpen = false; this.wheelOpen = false; this.awake = 0; this.thumbs = new Map();
    root.innerHTML = `
      <div class="cb-chip" data-chip><canvas width="96" height="72"></canvas><div><b data-name></b><span class="cb-keys" data-keys></span></div></div>
      <div class="cb-hints" data-hints></div>
      <div class="cb-clock" data-clock><svg viewBox="0 0 300 140" aria-hidden="true"><path d="M30 130 A120 120 0 0 1 270 130" class="cb-arc"/><path d="M30 130 A120 120 0 0 1 270 130" class="cb-arc-lit" data-lit/><circle r="11" data-sun class="cb-sun"/></svg><div class="cb-time" data-time></div><div class="cb-clock-hint" data-chint></div></div>
      <div class="cb-wheel" data-wheel><div class="cb-wheel-ring" data-ring></div><div class="cb-wheel-mid"><b data-wname></b><span data-whint></span></div></div>
      <div class="cb-menu" data-menu></div>
      <div class="cb-sound" data-sound>${icon('muted', 16).outerHTML}<span>Für Ton einmal tippen oder eine Taste drücken</span></div>
      <div class="cb-saved" data-saved>${icon('cloud', 16).outerHTML}</div>
      <div class="cb-touch" data-touch></div>
      <div class="cb-hello" data-hello><div class="cb-hello-card"><div class="cb-title">CampBuilder</div><p>Bau dein Camp. Ohne Eile, ohne Grenzen.</p><p class="cb-hello-how" data-how></p><p class="cb-go" data-go></p></div></div>`;
    this.$ = sel => root.querySelector(`[data-${sel}]`);
    this.$('hello').addEventListener('pointerdown', e => { e.preventDefault(); this.hideHello(); this.scene?.tones?.unlock(); });
  }
  pad(name, size = 26) {
    const i = PAD_NAMES.indexOf(name);
    if (i < 0) return `<span class="cb-key">${esc(name)}</span>`;
    const [gx, gy] = PAD.grid;
    return `<span class="cb-pad" style="width:${size}px;height:${size}px;background-image:url(${new URL(PAD.file, location.href).href});background-size:${gx * size}px ${gy * size}px;background-position:-${(i % gx) * size}px -${Math.floor(i / gx) * size}px"></span>`;
  }
  btn(b, size) { const k = this.kind || 'xbox'; return this.pad(BTN[b] != null ? `${k}_${BTN[b]}` : b, size); }
  attach(scene) {
    this.scene = scene; this.helloAt = performance.now();
    this.kind = scene.input_.kind;
    this.setMaterial(scene.set, scene.view.kitOf(scene.set));
    this.hints();
    this.touchBar();
    this.$('how').innerHTML = `${this.btn('a')} halten und hochziehen: ein Hügel wächst. ${this.btn('b')} gräbt.`;
    this.$('go').innerHTML = `${this.btn('a')} oder tippen`;
    scene.input_.onTouch = (kind, st) => this.onTouch(kind, st);
    addEventListener('keydown', () => scene.tones?.unlock());
    addEventListener('pointerdown', () => scene.tones?.unlock());
  }
  hideHello() { const h = this.$('hello'); if (!h || h.classList.contains('gone')) return; h.classList.add('gone'); this.wake(performance.now()); }
  wake(time) { this.awake = time; if (performance.now() - (this.helloAt || 0) > 350) this.hideHello(); }

  // ---------- material ----------
  thumb(set, kit) {
    if (this.thumbs.has(set)) return this.thumbs.get(set);
    const s = this.scene, c = document.createElement('canvas'); c.width = 96; c.height = 72;
    const g = c.getContext('2d');
    try {
      const draw = (frame, x, y) => { const f = s.textures.getFrame(kit.key, frame); g.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, x, y, 48, 48 * f.cutHeight / f.cutWidth); };
      const ov = kit.over * 48 / 64;
      draw(kit.fill[0], 0, 24 + 48 - ov); draw(kit.fill[1 % kit.fill.length], 48, 24 + 48 - ov);
      draw(kit.top[0], 0, 24 - ov); draw(kit.top[1 % kit.top.length], 48, 24 - ov);
    } catch { g.fillStyle = '#6b4f45'; g.fillRect(0, 24, 96, 48); }
    this.thumbs.set(set, c);
    return c;
  }
  setMaterial(set, kit) {
    const s = this.scene, name = s.data_.terrain?.[set]?.name || set;
    const cv = this.$('chip').querySelector('canvas'), g = cv.getContext('2d');
    g.clearRect(0, 0, 96, 72); if (kit) g.drawImage(this.thumb(set, kit), 0, 0);
    this.$('name').textContent = name;
    this.$('keys').innerHTML = `${this.btn('lb', 22)}${this.btn('rb', 22)}`;
    this.$('chip').classList.add('flash'); setTimeout(() => this.$('chip').classList.remove('flash'), 260);
    const tc = this.root.querySelector('[data-tset] canvas'); if (tc && kit) { const t = tc.getContext('2d'); t.clearRect(0, 0, 96, 72); t.drawImage(this.thumb(set, kit), 0, 0); }
    this.wake(performance.now());
  }
  hints() {
    this.$('hints').innerHTML = [
      [this.pad('stick_l'), 'Fliegen'], [this.btn('a'), 'Auftragen · hochziehen'], [this.btn('b'), 'Abtragen · runterziehen'],
      [this.btn('lb'), 'Material'], [this.btn('y'), 'Uhr'], [this.btn('select'), 'Zurück'], [this.btn('x'), 'Vor'], [this.btn('lt') + this.btn('rt'), 'Zoom'],
    ].map(([k, t]) => `<span>${k}<i>${t}</i></span>`).join('');
  }

  // ---------- the material wheel ----------
  openWheel(current) {
    const s = this.scene, sets = s.sets, ring = this.$('ring'), n = sets.length;
    this.wheelOpen = true; this.aim = sets.indexOf(current);
    ring.innerHTML = sets.map((id, i) => {
      const a = -Math.PI / 2 + i / n * Math.PI * 2;
      return `<button class="cb-slice" data-i="${i}" style="--x:${Math.cos(a) * 230}px;--y:${Math.sin(a) * 230}px"></button>`;
    }).join('');
    ring.querySelectorAll('.cb-slice').forEach((b, i) => {
      b.append(this.thumb(sets[i], s.view.kitOf(sets[i])).cloneNode());
      b.querySelector('canvas').getContext('2d').drawImage(this.thumb(sets[i], s.view.kitOf(sets[i])), 0, 0);
      b.addEventListener('pointerdown', e => { e.preventDefault(); this.aim = i; this.paintAim(); s.chooseSet(sets[i]); this.closeWheel(); });
    });
    this.$('wheel').classList.add('open');
    this.$('whint').innerHTML = `${this.pad('stick_r', 22)} wählen · ${this.btn('lb', 22)} loslassen`;
    this.paintAim();
  }
  wheelAim(x, y) {
    if (Math.hypot(x, y) < 0.4) return;
    const n = this.scene.sets.length, a = Math.atan2(y, x) + Math.PI / 2, i = ((Math.round(a / (Math.PI * 2) * n) % n) + n) % n;
    if (i !== this.aim) { this.aim = i; this.paintAim(); this.scene.tones?.play('move'); this.scene.input_.rumble(0.08, 12, this.scene.cfg.haptics); }
  }
  paintAim() {
    const s = this.scene;
    this.$('ring').querySelectorAll('.cb-slice').forEach((b, i) => b.classList.toggle('on', i === this.aim));
    this.$('wname').textContent = s.data_.terrain?.[s.sets[this.aim]]?.name || '';
  }
  closeWheel() { this.wheelOpen = false; this.$('wheel').classList.remove('open'); return this.scene.sets[this.aim]; }

  // ---------- the sun ----------
  showClock(on, time) {
    const el = this.$('clock');
    if (on) this.clockUntil = time + 1400;
    el.classList.toggle('open', on || time < (this.clockUntil || 0));
    if (!el.classList.contains('open')) return;
    const h = this.scene.hour, day = h >= 6 && h <= 19, k = day ? (h - 6) / 13 : ((h - 19 + 24) % 24) / 11, a = Math.PI * (1 - k);
    const x = 150 + Math.cos(a) * 120, y = 130 - Math.sin(a) * 120;
    const sun = this.$('sun'); sun.setAttribute('cx', x); sun.setAttribute('cy', y); sun.classList.toggle('moon', !day);
    const lit = this.$('lit'); lit.style.strokeDasharray = `${k * 377} 377`; lit.classList.toggle('moon', !day);
    this.$('time').textContent = hh(h);
    this.$('chint').innerHTML = `${this.btn('y', 20)} halten · ${this.pad('stick_l', 20)} drehen`;
  }

  // ---------- the menu (Start) ----------
  items() {
    const s = this.scene, t = s.tones;
    return [
      { id: 'music', label: 'Musik', on: t?.musicOn, icon: 'music', act: () => t?.music(!t.musicOn) },
      { id: 'tones', label: 'Bau-Töne', on: t?.tonesOn, icon: 'loudspeaker', act: () => t?.sounds(!t.tonesOn) },
      { id: 'buzz', label: 'Vibration', on: s.cfg.haptics?.enabled !== false, icon: 'wave', act: () => { s.cfg.haptics = { ...(s.cfg.haptics || {}), enabled: s.cfg.haptics?.enabled === false }; } },
      { id: 'details', label: 'Lebendige Details', on: s.view.details, icon: 'particles', act: () => s.view.setDetails(!s.view.details) },
      { id: 'new', label: 'Neue Parzelle', hold: true, icon: 'restart', act: () => s.fresh() },
      { id: 'close', label: 'Weiter bauen', icon: 'play', act: () => this.closeMenu() },
    ];
  }
  openMenu() { this.menuOpen = true; this.sel = 0; this.renderMenu(); this.$('menu').classList.add('open'); }
  closeMenu() { this.menuOpen = false; this.$('menu').classList.remove('open'); this.holdAt = 0; }
  renderMenu() {
    const el = this.$('menu'), list = this.items();
    el.innerHTML = `<div class="cb-menu-card"><div class="cb-title small">CampBuilder</div>${list.map((it, i) => `<button class="cb-item${i === this.sel ? ' on' : ''}" data-i="${i}">${icon(it.icon, 18).outerHTML}<span>${it.label}</span>${it.on != null ? `<em class="${it.on ? 'yes' : ''}">${it.on ? 'an' : 'aus'}</em>` : it.hold ? `<em class="hold">${this.btn('a', 18)} halten</em><i class="cb-hold" style="--k:${this.holdK || 0}"></i>` : ''}</button>`).join('')}
      <div class="cb-menu-foot">${this.btn('a', 20)} wählen · ${this.btn('b', 20)} zurück</div></div>`;
    // touch: a tap switches; „Neue Parzelle“ wants the finger held for a second, like A on the controller
    el.querySelectorAll('.cb-item').forEach((b, i) => {
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); this.sel = i; const it = list[i];
        if (!it.hold) { it.act(); if (this.menuOpen) this.renderMenu(); return; }
        b.classList.add('holding'); clearTimeout(this.touchHold);
        this.touchHold = setTimeout(() => { it.act(); this.closeMenu(); }, 1000);
      });
      const stop = () => { clearTimeout(this.touchHold); b.classList.remove('holding'); };
      b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop);
    });
  }
  menuNav(I, time) {
    const list = this.items();
    if (I.pressed('start') || I.pressed('b')) { this.closeMenu(); this.scene.tones?.play('menu'); return; }
    if (I.pressed('down') || (I.left[1] > 0.6 && !this.stickDown)) { this.sel = (this.sel + 1) % list.length; this.scene.tones?.play('move'); }
    if (I.pressed('up') || (I.left[1] < -0.6 && !this.stickUp)) { this.sel = (this.sel - 1 + list.length) % list.length; this.scene.tones?.play('move'); }
    this.stickDown = I.left[1] > 0.6; this.stickUp = I.left[1] < -0.6;
    const it = list[this.sel];
    if (it.hold) {
      this.holdK = I.down('a') ? Math.min(1, I.heldFor('a', time) / 1000) : 0;
      if (this.holdK >= 1) { this.holdK = 0; it.act(); this.closeMenu(); return; }
    } else if (I.pressed('a')) { it.act(); this.scene.tones?.play('select', { degree: this.sel }); }
    if (this.menuOpen) this.renderMenu();
  }

  // ---------- touch ----------
  touchBar() {
    const el = this.$('touch'), s = this.scene;
    el.innerHTML = `<button data-tset><canvas width="96" height="72"></canvas></button>
      <div class="cb-seg"><button data-tool="a" class="on">${icon('plus', 18).outerHTML}<span>Auftragen</span></button><button data-tool="b">${icon('eraser', 18).outerHTML}<span>Abtragen</span></button></div>
      <button data-tundo>${icon('undo', 18).outerHTML}</button><button data-tredo>${icon('redo', 18).outerHTML}</button><button data-tsun>${icon('sun', 18).outerHTML}</button><button data-tmenu>${icon('menu', 18).outerHTML}</button>`;
    this.tool = 'a';
    const tap = (sel, f) => el.querySelector(sel).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); s.tones?.unlock(); f(); });
    tap('[data-tset]', () => this.wheelOpen ? this.closeWheel() : this.openWheel(s.set));
    el.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); this.tool = b.dataset.tool; el.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x === b)); s.tones?.play('select'); }));
    tap('[data-tundo]', () => s.back()); tap('[data-tredo]', () => s.forth());
    tap('[data-tsun]', () => { s.setHour(s.hour + 1.5); this.showClock(true, s.time.now); });
    tap('[data-tmenu]', () => this.menuOpen ? this.closeMenu() : this.openMenu());
    const tc = el.querySelector('[data-tset] canvas').getContext('2d'); tc.drawImage(this.thumb(s.set, s.view.kitOf(s.set)), 0, 0);
  }
  // one finger: the point a little above it builds; two fingers: move and zoom the view
  onTouch(kind, st) {
    const s = this.scene;
    this.root.classList.add('touch'); this.hideHello(); s.tones?.unlock();
    if (st.n >= 2) {
      const [p, q] = st.list, mid = [(p.at[0] + q.at[0]) / 2, (p.at[1] + q.at[1]) / 2], d = Math.hypot(p.at[0] - q.at[0], p.at[1] - q.at[1]);
      if (s.touchA) { s.touchA = null; s.endGesture(false); s.g = null; }
      if (this.pinch) {
        const k = s.scale.width / p.at[2];
        s.cam.scrollX -= (mid[0] - this.pinch.mid[0]) * k / s.cam.zoom; s.cam.scrollY -= (mid[1] - this.pinch.mid[1]) * k / s.cam.zoom;
        s.zoom = Math.max(s.zoomRange()[0], Math.min(s.zoomRange()[1], s.zoom * d / this.pinch.d)); s.cam.setZoom(s.zoom);
      }
      this.pinch = { mid, d }; s.touchPan = true; s.panned = s.time.now; s.touchAim = false;
      return;
    }
    this.pinch = null;
    if (kind === 'up' && st.n === 0) { s.touchA = null; s.touchPan = false; s.touchAim = false; return; }
    if (st.n === 1 && !s.touchPan) {
      const f = st.list[0], k = s.scale.width / f.at[2], cam = s.cam;
      const wx = cam.worldView.x + f.at[0] * k / cam.zoom, wy = cam.worldView.y + (f.at[1] * k - 70) / cam.zoom;
      s.cur.x = wx; s.cur.y = wy; s.cur.vx = s.cur.vy = 0; s.touchAim = true;
      if (kind === 'down') s.touchA = this.tool;
    }
  }

  // ---------- every frame ----------
  update(time, s) {
    const fade = (s.cfg.hud?.fade ?? 3.5) * 1000, quiet = time - this.awake > fade || !!s.g;
    this.root.classList.toggle('quiet', quiet && !this.wheelOpen && !this.menuOpen);
    if (s.input_.kind !== this.kind) { this.kind = s.input_.kind; this.hints(); this.setMaterial(s.set, s.view.kitOf(s.set)); }
    this.$('sound').classList.toggle('show', !!s.tones && !s.tones.running && time > 2500);
    this.root.classList.toggle('nopad', !s.input_.padSeen);
  }
  saved(ok) { const el = this.$('saved'); el.classList.toggle('bad', !ok); el.classList.add('show'); clearTimeout(this.savedT); this.savedT = setTimeout(() => el.classList.remove('show'), 1400); }
}
