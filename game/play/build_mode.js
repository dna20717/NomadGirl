// Building the rig right in the camp (Rig bauen 2.0, Daniel 08.11.2026: "muss sich anfühlen wie das Bauen eines Rigs und weniger wie ein Menü").
// B (or Warroom › Rig umbauen) zooms out over the real rig, the scrapyard by the shaft and the van; the budget bar slides in on top.
// Everything is dragged with the mouse and has weight: the part hangs from the pointer and swings, sits down with a klonk,
// dust and springs bouncing. Every drop counts right away (Δ and time); Leyla walks over and screws for a moment,
// "Rückgängig" takes back the last action as long as she has not finished it.
//   workshop → a place in a trailer or the van (taken = swap), the scrapyard (stow), the dealer's pad (sell)
//   trailer  → a coupling (hang in / change the order, a stack moves along), on top of a trailer or container that carries (stack),
//              the scrapyard (unhitch, only empty and nothing on top), the dealer's pad (sell, only empty)
//   rig part → a socket on the van (taken = swap, the old one goes onto the scrapyard), the scrapyard (take off), the dealer's pad (sell)
//   dealer catalogue (button or click on the pad): bought things are delivered onto the pad.
// Logic in game/rig.js (act, snapshot/restore), drawing in game/play/camp.js (drawRig, drawYard), values in "Rig-Bau".
import { hang, unhang, canHang, lightsConfig } from '../string_lights.js';
import { el } from '../ui.js';
import { hints, NavCursor, closeX } from './ui_nav.js';
import { icon } from '../icons.js';
import { budgets, act, snapshot, restore, lift, place, fits, at as wsAt, toSpare, fromSpare, stow, buyWorkshop, sellWorkshop, buyContainer, sellContainer, buyPart, sellPart, mountPart, unmountPart, SLOT_NAMES as PART_SLOTS, stackOn, stackTop, blockAt, levelOf, attachAt, detach, moveContainer, shop, priceOf, sellPrice, wsDef, placesOf } from '../rig.js';
import { clockText } from '../save.js';
import { workshopTexture, partView, socketRects, unitShape } from './camp.js';
import { makeSfx } from './sfx.js';

const FN_COLORS = { storage: '#5c6b7a', cooling: '#4a7a9a', cell: '#5a4a4a', sleep: '#6a5a9a', chill: '#9a4a7a', drone: '#3a8a6a', warroom: '#7a6a3a', kitchen: '#a8642a', foodtruck: '#c0703a', craft: '#7a6235', engine: '#5a5a5a', power: '#a8862a' };
const FN_NAMES = { storage: 'Lager', cooling: 'Kühlung', cell: 'Zelle', sleep: 'Schlafen', chill: 'Chillen', drone: 'Drohnen', warroom: 'Planung', kitchen: 'Kochen', foodtruck: 'Verkauf', craft: 'Herstellen', engine: 'Motor', power: 'Energie' };
const de = n => Number(n).toLocaleString('de-DE');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class BuildMode {
  // host: { scene: () => PlayScene }
  constructor(root, host) {
    this.host = host;
    this.active = false;
    this.el = el('div', { class: 'bm', hidden: true });
    root.append(this.el);
    document.addEventListener('keydown', e => {
      if (!this.active) return;
      if (e.key === 'Escape') { if (this.drag) this.cancelDrag(); else if (this.shopOpen) { this.shopOpen = false; this.draw(); } else this.close(); e.preventDefault(); e.stopPropagation(); }
      else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { this.undoLast(); e.preventDefault(); e.stopPropagation(); }
      else if (['e', 'E', 'Tab', 'i', 'I'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    // the window loses focus mid-drag (alt-tab, released outside): the part flies back
    window.addEventListener('blur', () => { if (this.active && this.drag) this.flyBack(null); });
  }
  get scene() { return this.host.scene(); }
  get D() { return this.scene.data_; }
  get save() { return this.scene.box.save; }
  get camp() { return this.scene.camp; }
  get B() { return this.D.build || {}; }
  get isOpen() { return this.active; }

  // the scene restarts (camp ↔ run): forget everything
  reset() { delete this.el.parentElement?.dataset.building; this.el.classList.remove("dragging"); this.active = false; this.el.hidden = true; this.shell = null; this.el.replaceChildren(); this.drag = null; this.jobs = []; this.job = null; this.undo = []; this.working = false; this.shopOpen = false; }

  // ---------- open / close ----------
  open() {
    const s = this.scene, cam = s.cam, geo = this.camp.geo, V = this.B.view || {};
    if (this.active) return;
    this.reset();
    this.active = true; this.el.hidden = false; this.msg = null;
    this.el.parentElement.dataset.building = '1';
    this.sfx = makeSfx(s, (V.volume ?? 50) / 100);
    this.gfx = s.add.graphics().setDepth(35);
    this.labels = [];
    s.hud.prompt(null); s.hud.inv?.close();
    // Daniel, 12.11.2026: „im Bau-Modus soll man nur noch die Drohne steuern und Leyla setzt sich ans Feuer“ (Rig-Bau › Bau-Modus › Leyla ans Feuer)
    this.atFire = V.leylaFire !== false && this.sitAtFire();
    // camera: from the yard to the van's nose, the ground low in the picture
    const x0 = (geo.yard?.x0 ?? geo.rigRoom[0]) - 80, x1 = geo.vanRight + 120, base = s.data_.game?.camera?.zoom || 1;
    const z = clamp(s.scale.width * 0.96 / (x1 - x0), (V.minZoom ?? 30) / 100, base);
    const ground = this.camp.ground, cy = ground - (((V.groundAt ?? 80) / 100) - 0.5) * s.scale.height / z;
    this.camBack = { zoom: cam.zoom, bounds: Phaser.Geom.Rectangle.Clone(cam._bounds), useBounds: cam.useBounds };
    cam.stopFollow(); cam.useBounds = false;
    this.view = { x: (x0 + x1) / 2, y: cy, zoom: z };
    const ms = s.script ? 1 : V.zoomTime ?? 650;
    cam.pan(this.view.x, this.view.y, ms, 'Sine.easeInOut', true);
    cam.zoomTo(z, ms, 'Sine.easeInOut', true);
    // pointer: drag and drop on the world camera
    this.camp.drawRig();   // parts on the van are shown by the sockets now
    this.onDown = p => this.pointerDown(p); this.onMove = p => this.pointerMove(p); this.onUp = p => this.pointerUp(p);
    s.input.on('pointerdown', this.onDown); s.input.on('pointermove', this.onMove); s.input.on('pointerup', this.onUp); s.input.on('pointerupoutside', this.onUp);
    this.draw();
  }
  // Leyla goes to the campfire and sits down (no time passes, no healing: she just waits there); a dust puff where she was
  sitAtFire() {
    const s = this.scene, l = s.leyla, C = this.camp.C, S = C.fire?.sit || {}, fx = this.camp.geo.fireX;
    if (fx == null || !l?.alive || !S.look || !s.textures.exists(S.look)) return false;
    if (l.state === 'sit') return true;
    s.fx.puff?.(l.x, l.feet - 10, 0xb9a2c8);
    const side = l.x >= fx ? 1 : -1;
    const x = fx + side * (S.distance ?? 150);
    l.setStanding?.(); l.body.reset(x, this.camp.ground - l.size.h / 2); l.body.setVelocity(0, 0);   // down on the ground by the fire, also from a container upstairs
    l.startSit(S, x, -side, null);
    return true;
  }
  // where AvA flies while building: above the part in the claw, above the cursor / pointer, or to a job
  droneTarget() {
    const d = this.drag, j = this.job, z = Math.max(0.3, this.scene.cam.zoom), V = this.B.view || {}, up = (V.droneAbove ?? 60) / Math.min(1, z * 1.6);
    if (d) return { x: d.x, y: d.y - up, smooth: (V.droneFollow ?? 30) / 100 };
    if (j && this.atFire) return { x: j.fx, y: j.fy - 150, smooth: 0.12 };
    const p = this.cur?.on ? this.world({ x: this.cur.x, y: this.cur.y }) : this.pointer;
    return p ? { x: p.x, y: p.y - up, smooth: (V.droneFollow ?? 30) / 100 } : null;
  }
  close() {
    if (!this.active) return;
    const s = this.scene, cam = s.cam, back = this.camBack;
    if (s.drone) s.drone.build = null;
    if (this.atFire && s.leyla.state === 'sit' && s.leyla.sit && !s.leyla.sit.up) s.leyla.sit.up = s.time.now;   // back to the player: she gets up
    if (this.drag) this.cancelDrag(true);
    this.peek(null);
    // Leyla finishes the rest in no time (the time has been counted already)
    for (const u of this.undo) u.done = true;
    this.jobs = []; this.job = null; this.working = false;
    this.active = false; this.el.hidden = true; this.shell = null;
    this.cur = null; this.curEl && (this.curEl.hidden = true); this.shopCur?.hide();
    delete this.el.parentElement.dataset.building;
    s.input.off('pointerdown', this.onDown); s.input.off('pointermove', this.onMove); s.input.off('pointerup', this.onUp); s.input.off('pointerupoutside', this.onUp);
    this.gfx?.destroy(); for (const t of this.labels || []) t.destroy(); this.labels = [];
    this.camp.drawRig();
    s.game.canvas.style.cursor = '';
    const ms = s.script ? 1 : this.B.view?.zoomTime ?? 650, C = s.data_.game?.camera || {};
    cam.zoomTo(back.zoom, ms, 'Sine.easeInOut', true);
    cam.pan(s.leyla.x, cam.midPoint.y, ms, 'Sine.easeInOut', true, (c, t) => {
      if (t < 1) return;
      cam.useBounds = back.useBounds; cam.setBounds(back.bounds.x, back.bounds.y, back.bounds.width, back.bounds.height);
      cam.startFollow(s.leyla.box, false, C.follow ?? 0.12, C.follow ?? 0.12);
    });
    s.buildClosed();
  }

  toggleOpen() { const h = this.scene.hud; h.setRigOpen(!h.rigOpen); this.draw(); }

  // ---------- controller and keyboard (Daniel, 12.11.2026: „Rig-Bau-Modus = Select“, Cursor wie vorgeschlagen) ----------
  // u = window input (ui_nav.js), p = controller: a golden cursor over the world; A / Enter / Space packs what is under it, moving
  // carries it along, A again puts it down (the same drop as the mouse); B puts it back, closes the dealer, then finishes;
  // X undoes, Y opens the dealer (its catalogue gets the window cursor), LB / RB / Q jump to the next part, Select = Rig offen/zu
  nav(u, p, dt) {
    if (!this.active) return;
    const s = this.scene, edge = a => p?.kind && p.uiNow.has(a) && !p.uiPrev.has(a);
    if (p?.kind && p.pressed('inventory')) this.toggleOpen();
    if (!this.cur?.on && !u.now.size) return;
    if (!this.curEl) {
      this.curEl = el('div', { class: 'ui-cursor bm-cursor', hidden: true }); document.body.append(this.curEl);
      document.addEventListener('mousemove', ev => { if (this.cur?.on && (Math.abs(ev.movementX) + Math.abs(ev.movementY)) > 0) { this.cur.on = false; this.curEl.hidden = true; } });
    }
    if (!this.cur) this.cur = { x: s.scale.width / 2, y: s.scale.height * 0.62, on: false, held: 0 };
    if (!this.cur.on) { this.cur.on = true; return this.showCur(); }
    // the dealer's catalogue: the window cursor, B closes it
    if (this.shopOpen && !this.drag) {
      this.shopCur ??= new NavCursor(this.shell.shop, '.bm-shop .inv-btn:not(.craft-x)');
      this.shopCur.root = this.shell.shop;
      if (edge('back') || u.pressed('send')) { this.shopOpen = false; this.shopCur.hide(); this.draw(); return this.showCur(); }
      this.shopCur.update(u);
      this.curEl.hidden = true;
      return;
    }
    this.shopCur?.hide();
    // move: the stick moves smoothly (faster when held), arrows and d-pad at a steady pace
    const g = p?.pad, ax = g ? g.axes[0] || 0 : 0, ay = g ? g.axes[1] || 0 : 0, dz = 0.25;
    let vx = (u.down('right') ? 1 : 0) - (u.down('left') ? 1 : 0), vy = (u.down('down') ? 1 : 0) - (u.down('up') ? 1 : 0);
    if (Math.abs(ax) > dz) vx = ax; if (Math.abs(ay) > dz) vy = ay;
    const moving = vx || vy;
    this.cur.held = moving ? this.cur.held + dt : 0;
    const v = (this.B.view?.cursorSpeed ?? 900) * (this.cur.held > 450 ? 1.8 : 1);
    if (moving) {
      this.cur.x = clamp(this.cur.x + vx * v * dt / 1000, 0, s.scale.width); this.cur.y = clamp(this.cur.y + vy * v * dt / 1000, 0, s.scale.height);
      this.pointerMove({ x: this.cur.x, y: this.cur.y });
    }
    if (u.pressed('next') || edge('next')) this.jump(1);
    if (edge('prev')) this.jump(-1);
    const pt = { x: this.cur.x, y: this.cur.y, button: 0 };
    if (u.pressed('ok')) {
      if (this.drag || this.wire) this.pointerUp(pt);
      else {
        this.pointerDown(pt);
        const hit = this.press?.hit;
        if (hit && hit.kind !== 'dealer') { this.press = null; this.startDrag(hit, this.world(pt)); this.pointerMove(pt); }
        else this.pointerUp(pt);
      }
    }
    if (edge('back')) { if (this.drag) this.flyBack(null); else if (this.wire) { this.wire = null; this.draw(); } else { this.close(); return; } }
    if (u.pressed('context') || edge('context')) this.undoLast();
    if (u.pressed('send') || edge('send')) { this.shopOpen = true; this.draw(); }
    this.showCur();
  }
  showCur() {
    const s = this.scene, r = s.game.canvas.getBoundingClientRect(), k = r.width / s.scale.width, show = !!this.cur?.on && this.active;
    this.curEl.hidden = !show;
    if (!show) return;
    const z = this.drag ? 34 : 26;
    Object.assign(this.curEl.style, { left: `${r.left + this.cur.x * k - z / 2}px`, top: `${r.top + this.cur.y * (r.height / s.scale.height) - z / 2}px`, width: `${z}px`, height: `${z}px` });
    this.curEl.classList.toggle('holding', !!this.drag);
  }
  // LB / RB / Q: the cursor jumps to the next part, place, trailer or the dealer (left to right)
  jump(d) {
    const sp = this.spots(), s = this.scene, r = s.game.canvas.getBoundingClientRect(), kx = s.scale.width / r.width, ky = s.scale.height / r.height;
    const pts = this.drag ? [...sp.slots, ...sp.gaps, ...sp.stacks, ...sp.sockets, ...(sp.yardFree ? [sp.yardFree] : []), ...(sp.dealer ? [sp.dealer] : [])]
      : this.wire ? sp.anchors : [...sp.yard, ...sp.slots.filter(x => x.ws), ...sp.units, ...sp.sockets.filter(x => x.id), ...(sp.dealer ? [sp.dealer] : [])];
    const g = pts.map(q => ({ x: (q.x - r.left) * kx, y: (q.y - r.top) * ky })).filter(q => q.x >= 0 && q.x <= s.scale.width).sort((a, b) => a.x - b.x || a.y - b.y);
    if (!g.length) return;
    const i = d > 0 ? g.findIndex(q => q.x > this.cur.x + 12) : g.map(q => q.x < this.cur.x - 12).lastIndexOf(true);
    const q = g[i >= 0 ? i : d > 0 ? 0 : g.length - 1];
    this.cur.x = q.x; this.cur.y = q.y;
    this.pointerMove({ x: q.x, y: q.y });
  }
  cursorState() { return this.cur ? { on: !!this.cur.on, x: Math.round(this.cur.x), y: Math.round(this.cur.y), drag: this.drag?.kind || null, shop: !!this.shopOpen } : null; }

  // ---------- the bar on top: budgets, clock, Δ, dealer, undo, done ----------
  draw() {
    if (!this.active) return;
    if (!this.shopOpen) this.peek(null);
    const D = this.D, save = this.save, b = budgets(D, save.rig), top = this.undo[this.undo.length - 1];
    const bar = (label, val, max, text, over, ic) => el('div', { class: 'build-budget' + (over ? ' over' : '') }, icon(ic, 16),
      el('span', {}, el('small', {}, label), el('b', {}, text)), max != null ? el('i', { style: `--k:${Math.min(1, max ? val / max : 1)}` }) : null);
    const msg = this.msg?.text || (this.drag ? this.dragHint() : this.hoverText || 'Teile mit der Maus packen und ziehen: in einen Anhänger, auf den Schrottplatz oder zum Händler.');
    // the bar, the dealer and the message stay the same elements while building (Daniel: the bar stays on, no slide in on every redraw);
    // only their contents change. The slide-in plays once when building starts or the dealer opens.
    if (!this.shell || !this.el.contains(this.shell.bar)) {
      this.shell = { bar: el('div', { class: 'bm-bar ui-frame' }), shop: el('div', { class: 'bm-shopslot' }), msg: el('div', { class: 'bm-msg idle' }),
        hint: hints([['move', 'Cursor'], ['ok', 'packen / ablegen'], ['context', 'rückgängig'], ['send', 'Händler'], ['tabs', 'nächstes Teil'], ['back', 'zurück / fertig']], 'Maus: Teile packen und ziehen · Strg+Z rückgängig · B fertig') };
      this.shell.hint.classList.add('bm-hints');
      this.el.replaceChildren(this.shell.bar, this.shell.shop, this.shell.msg, this.shell.hint, this.shell.x = closeX(() => this.close(), 'Fertig (B)'));
    }
    const sh = this.shell;
    sh.bar.replaceChildren(
        el('div', { class: 'bm-title' }, icon('build', 18), el('b', {}, 'Rig bauen')),
        el('div', { class: 'bm-budgets' },
          bar('Gewicht', b.weight, b.pull, `${de(b.weight)} / ${de(b.pull)} kg`, b.heavy, 'scale'),
          bar('Anhänger', b.length, b.maxLength, `${b.length} / ${b.maxLength}${b.stack > 1 ? ` · ${b.height} / ${b.stack} hoch` : ''}`, b.length > b.maxLength, 'box'),
          bar('Energie', b.power.used, b.power.made, `${b.power.net >= 0 ? '+' : ''}${b.power.net} ⚡ (${b.power.made} da, ${b.power.used} gebraucht)`, b.power.net < 0, 'flash'),
          bar('Verbrauch', 0, null, `${String(b.fuel).replace('.', ',')} l / 100 km`, false, 'drop'),
          bar('Plätze', b.filled, b.places, `${b.filled} / ${b.places} belegt`, false, 'grid')),
        el('div', { class: 'bm-side' },
          el('small', { class: 'bm-clock' }, clockText(save)),
          el('b', { class: 'build-deltas' }, `${de(save.deltas)} Δ`),
          el('button', { class: 'inv-btn bm-shopbtn' + (this.shopOpen ? ' on' : ''), onclick: () => { this.shopOpen = !this.shopOpen; this.draw(); } }, icon('shop', 15), ' Händler'),
          el('button', { class: 'inv-btn ghost bm-openbtn' + (this.scene.hud.rigOpen ? ' on' : ''), title: 'Rig offen: alle Container bleiben offen (auch außerhalb des Bau-Modus). Controller: Select', onclick: () => this.toggleOpen() }, icon(this.scene.hud.rigOpen ? 'door' : 'box', 15), this.scene.hud.rigOpen ? ' Rig offen' : ' Rig zu'),
          el('button', { class: 'inv-btn ghost bm-undo', disabled: !top || top.done, title: top && !top.done ? `Rückgängig: ${top.label} (Strg+Z)` : 'Nichts zum Rückgängigmachen (Leyla hat schon festgeschraubt)', onclick: () => this.undoLast() }, '↶ Rückgängig'),
          el('button', { class: 'inv-btn build-go', onclick: () => this.close() }, 'Fertig (B)')));
    if (this.shopOpen) {
      const list = sh.shop.querySelector('.build-list'), top0 = list?.scrollTop || 0, was = sh.shop.firstChild;
      const panel = this.shopEl();
      if (was) panel.classList.add('stay');   // already open: no slide in
      sh.shop.replaceChildren(panel);
      const nl = panel.querySelector('.build-list'); if (nl) nl.scrollTop = top0;
    } else sh.shop.replaceChildren();
    sh.msg.className = 'bm-msg ' + (this.msg?.kind || 'idle');
    sh.msg.textContent = msg;
  }
  say(text, kind = 'error') { this.msg = { text, kind, until: this.scene.time.now + 3200 }; this.draw(); }

  shopEl() {
    const D = this.D, S = shop(D), save = this.save;
    const row = (area, id) => {
      const x = D[area][id], price = priceOf(D, area, id), poor = price > save.deltas;
      const sub = area === 'workshops' ? `${FN_NAMES[x.function] || ''} · ${x.places || 1} ${x.places > 1 ? 'Plätze' : 'Platz'} · ${x.power > 0 ? '+' : ''}${x.power || 0} ⚡`
        : area === 'rigParts' ? [PART_SLOTS[x.slot] || x.slot, x.pull ? `+${de(x.pull)} kg` : null, x.armor ? `+${x.armor} Panzerung` : null, x.damage ? `${x.damage} Schaden` : null, x.storageRows ? `+${x.storageRows} Reihen Stauraum` : null].filter(Boolean).join(' · ')
        : `${x.places || 1} Plätze · ${de(x.weight || 0)} kg`;
      const pic = (area === 'workshops' || area === 'rigParts') && this.picture(x.look);   // rig parts with a picture (solar panel) like workshops
      const lead = pic ? el('span', { class: 'bm-thumb', style: `--col:${FN_COLORS[x.function] || '#555'}` }, el('img', { src: pic, alt: '', draggable: 'false' }))
        : area === 'workshops' ? el('span', { class: 'build-dot', style: `--col:${FN_COLORS[x.function] || '#555'}` }) : icon(area === 'rigParts' ? 'settings' : 'box', 16);
      return el('div', { class: 'build-row' + (pic ? ' has-pic' : ''), title: pic ? '' : x.description || '', onmouseenter: ev => area === 'workshops' && this.peek(id, ev.currentTarget), onmouseleave: () => this.peek(null) }, lead,
        el('span', {}, el('b', {}, x.name || id), el('small', {}, sub)),
        el('button', { class: 'inv-btn', disabled: poor, title: poor ? 'Zu wenig Δ' : 'Wird auf den Händler-Platz geliefert', onclick: () => this.buy(area, id) }, `${de(price)} Δ`));
    };
    return el('section', { class: 'inv-panel bm-shop' },
      el('header', {}, icon('shop', 16), el('b', {}, D.camp?.yard?.dealerName || 'Händler'), el('small', {}, 'liefert auf den Händler-Platz'), el('button', { class: 'craft-x', onclick: () => { this.shopOpen = false; this.draw(); } }, '×')),
      el('div', { class: 'build-list' }, el('h3', {}, 'Werkstätten'), ...S.workshops.map(id => row('workshops', id)), el('h3', {}, 'Anhänger'), ...S.containers.map(id => row('containers', id)),
        S.rigParts.length ? el('h3', {}, 'Rig-Teile') : null, ...S.rigParts.map(id => row('rigParts', id))));
  }

  // the file of a picture asset, for the catalogue
  picture(id) { const a = id && this.D.assets?.[id]; return a?.file ? new URL(a.file, this.scene.base).href : null; }
  // hovering a workshop in the catalogue: a big preview next to it (picture, empty → full for shelves, facts)
  peek(id, row) {
    this.peekEl?.remove();
    this.peekEl = null;
    if (!id || this.drag) return;
    const D = this.D, x = D.workshops?.[id] || {}, pic = this.picture(x.look), empty = this.picture(x.lookEmpty);
    const buff = x.buff && D.buffs?.[x.buff]?.name, fxN = (x.fx || []).length;
    const facts = [FN_NAMES[x.function], `${x.places || 1} ${x.places > 1 ? 'Plätze' : 'Platz'}`, `${x.power > 0 ? '+' : ''}${x.power || 0} ⚡`, x.grid ? `Lager ${x.grid[0]} × ${x.grid[1]}` : null,
      buff ? `Buff: ${buff}` : null, x.rest?.verb ? `E: ${x.rest.verb}` : null].filter(Boolean);
    const stage = el('div', { class: 'bm-peek-stage' + (empty ? ' fills' : '') + (fxN ? ' cosy' : ''), style: `--col:${FN_COLORS[x.function] || '#555'}` },
      pic ? (empty ? [el('img', { src: empty, alt: '' }), el('img', { class: 'full', src: pic, alt: '' })] : el('img', { src: pic, alt: '' })) : el('span', { class: 'bm-peek-none' }, 'Noch ohne Bild'));
    const box = el('aside', { class: 'bm-peek' }, stage,
      el('div', { class: 'bm-peek-text' }, el('b', {}, x.name || id), el('small', {}, facts.join(' · ')), x.description ? el('p', {}, x.description) : null,
        empty ? el('p', { class: 'hint' }, 'Füllt sich Fach für Fach, je voller das Lager ist.') : null));
    const shop = this.el.querySelector('.bm-shop')?.getBoundingClientRect(), r = row.getBoundingClientRect();
    box.style.right = `${Math.round(window.innerWidth - (shop?.left ?? r.left) + 12)}px`;
    this.el.append(box);
    box.style.top = `${Math.round(Math.max(84, Math.min(window.innerHeight - box.offsetHeight - 12, r.top - 60)))}px`;
    this.peekEl = box;
  }

  // ---------- where things are (world coordinates) ----------
  // places of all units: trailers (their interior) and the tractor (spots painted over the van while building)
  slots() {
    const D = this.D, geo = this.camp.geo, out = [], U = this.save.rig.units, g = this.camp.ground;
    U.forEach((u, ui) => {
      const n = placesOf(D, u);
      if (u.kind === 'tractor') {
        const w = geo.vanRight - geo.vanLeft, vh = D.assets?.[D.tractors?.[u.id]?.look]?.height || 400, cw = w * 0.62 / Math.max(1, n), x = geo.vanLeft + w * 0.19;
        for (let p = 0; p < n; p++) out.push({ ui, p, x0: x + p * cw, x1: x + (p + 1) * cw, y0: g - vh * 0.72, y1: g - vh * 0.22, van: true });
      } else {
        const v = geo.units.find(x => x.ui === ui);
        if (v) for (let p = 0; p < n; p++) out.push({ ui, p, x0: v.in0 + p * v.cell, x1: v.in0 + (p + 1) * v.cell, y0: v.inTop, y1: v.floorY });
      }
    });
    return out;
  }
  // sockets for rig parts on the van (camp.js socketRects)
  sockets() { return socketRects(this.D, this.save.rig, this.camp.geo, this.camp.ground); }
  // couplings: gap g = in front of the block starting at unit g (1 = right behind the van, units.length = at the end)
  gaps() {
    const geo = this.camp.geo, U = this.save.rig.units, out = [], y = this.camp.ground - 40;
    for (let g = 1; g <= U.length; g++) {
      if (g < U.length && levelOf(U[g]) > 0) continue;   // inside a stack
      const ground = g === 1 ? null : geo.units.find(x => x.ui === blockAt(U, g - 1)[0]);
      out.push({ g, x: ground ? ground.x0 : geo.vanLeft, y });
    }
    return out;
  }
  // stacking spots: on top of every block whose top unit carries (and the tractor allows one more level). Container slots
  // (Daniel, 09.11.2026): a shorter container gets one spot per offset (left … right), shown only while a container hangs at the pointer.
  // The top container of a stack may also move to another slot of its own stack (own: true).
  stacks(d = this.drag) {
    const D = this.D, U = this.save.rig.units, geo = this.camp.geo, out = [];
    const def = D.containers?.[d?.id], p = def?.places || 1, sh = def ? unitShape(D, def, 0, this.scene.T, { stacked: true }) : null;
    const spots = (onto, below, extra = {}) => {
      const wB = below.cell * below.places, wT = sh ? sh.cell * sh.places : wB, n = below.places - p;
      if (n <= 0 || !def) return [{ onto, x: below.in0 + wB / 2, y: below.deckY, w: Math.min(wB, wT), ...extra }];   // nothing in the hand: one spot per stack
      return Array.from({ length: n + 1 }, (_, k) => ({ onto, slot: k, x: below.in0 + (wB - wT) * k / n + wT / 2, y: below.deckY, w: wT, ...extra }));
    };
    U.forEach((u, ui) => {
      if (u.kind !== 'container' || levelOf(u) > 0) return;
      const st = stackTop(D, this.save.rig, ui);
      if (st.reason) return;
      const top = geo.units.find(x => x.ui === st.end - 1);
      if (top) out.push(...spots(ui, top));
    });
    if (d?.from === 'rig' && levelOf(U[d.ui]) > 0) {
      const [a, b] = blockAt(U, d.ui), below = geo.units.find(x => x.ui === d.ui - 1);
      if (d.ui === b - 1 && below) out.push(...spots(a, below, { own: true }).filter(sp => sp.slot !== U[d.ui].slot && sp.slot != null));
    }
    return out;
  }
  // the thing under the pointer: a workshop (rig or yard), a trailer (rig or yard), the dealer's pad
  pick(x, y) {
    const D = this.D, U = this.save.rig.units, camp = this.camp, inside = r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
    // string lights (#008): the docking points on the container corners, the middle of a hanging string
    if (lightsConfig(D).enabled) {
      const z = Math.max(0.5, this.scene.cam.zoom), R = 24 / z, box = p => ({ x0: p.x - R, x1: p.x + R, y0: p.y - R, y1: p.y + R });
      for (const a of camp.anchors?.() || []) if (Math.hypot(x - a.x, y - a.y) < R) return { kind: 'anchor', a, item: box(a) };
      for (let i = 0; i < (this.save.rig.lights || []).length; i++) { const w = camp.wire(i); if (w && Math.hypot(x - w.mid.x, y - w.mid.y) < R) return { kind: 'lights', i, item: box(w.mid) }; }
    }
    for (const it of camp.yardItems || []) if (inside(it)) return { kind: it.kind === 'ws' ? 'ws' : it.kind === 'part' ? 'part' : 'container', from: 'yard', i: it.i, id: it.id, item: it };
    for (const so of this.sockets()) if (so.id && inside(so)) return { kind: 'part', from: 'socket', slot: so.slot, si: so.i, id: so.id, sock: so };
    for (const sl of this.slots()) {
      const w = inside(sl) && wsAt(D, this.save.rig, sl.ui, sl.p);
      // Werkstätten › Fest eingebaut (the cryo tank): stays where it is, and so does its container
      if (w && D.workshops?.[w.id]?.fixed) { this.say(`${D.workshops[w.id].name || w.id} ist fest eingebaut.`); return null; }
      if (w) return { kind: 'ws', from: 'rig', ui: sl.ui, at: w.at, id: w.id, slot: sl };
    }
    for (const u of [...camp.geo.units].sort((a, b) => levelOf(b) - levelOf(a))) if (x >= u.x0 && x <= u.x1 && y >= u.inTop - 40 && y <= (u.base ?? camp.ground) + 10) {
      if (U[u.ui]?.workshops?.some(w => D.workshops?.[w.id]?.fixed)) { this.say('Dieser Container trägt etwas, das bleiben muss.'); return null; }
      return { kind: 'container', from: 'rig', ui: u.ui, id: u.id, unit: u };
    }
    if (camp.dealer && inside(camp.dealer)) return { kind: 'dealer' };
    return null;
  }
  // pointer → world (by hand: the camera matrix is only refreshed when rendering, the remote control steps without it)
  viewBox() { const c = this.scene.cam, w = c.width / c.zoom, h = c.height / c.zoom; return { x: c.scrollX + (c.width - w) / 2, y: c.scrollY + (c.height - h) / 2, z: c.zoom }; }
  world(p) { const v = this.viewBox(); return { x: v.x + (p.x - this.scene.cam.x) / v.z, y: v.y + (p.y - this.scene.cam.y) / v.z }; }

  // ---------- pointer ----------
  pointerDown(p) {
    if (!this.active || p.button !== 0) return;
    const w = this.world(p), hit = this.pick(w.x, w.y);
    this.press = hit ? { hit, x: w.x, y: w.y, sx: p.x, sy: p.y } : null;
  }
  pointerMove(p) {
    if (!this.active) return;
    const w = this.world(p);
    this.pointer = { x: w.x, y: w.y, t: this.scene.time.now };
    // the button came up where the game could not see it (outside the window): nothing happens, the part flies back
    // (Daniel, 08.11.2026: "bleibt man im drop-to-Händler-Modus hängen")
    if (this.drag && p.event && 'buttons' in p.event && !(p.event.buttons & 1)) { this.press = null; return this.flyBack('Losgelassen außerhalb: zurück an seinen Platz'); }
    if (this.press && !this.drag && Math.hypot(p.x - this.press.sx, p.y - this.press.sy) > 6) this.startDrag(this.press.hit, w);
    if (this.drag) { this.drag.x = w.x; this.drag.y = w.y; }
    if (this.wire) { this.wire.x = w.x; this.wire.y = w.y; }
  }
  pointerUp(p) {
    if (!this.active) return;
    const w = this.world(p), press = this.press;
    this.press = null;
    if (this.drag) { this.drag.x = w.x; this.drag.y = w.y; return this.drop(); }
    if (this.wire) return this.finishWire(w);
    if (press?.hit?.kind === 'anchor') return this.startDrag(press.hit, w);   // click, click: from here … to there
    if (press?.hit?.kind === 'lights') return this.takeDown(press.hit.i);
    if (press?.hit?.kind === 'dealer') { this.shopOpen = !this.shopOpen; return this.draw(); }
    if (press?.hit) { this.msg = null; this.hoverText = this.describe(press.hit); this.draw(); }
  }
  describe(h) {
    const D = this.D, L = lightsConfig(D);
    if (h.kind === 'anchor') return this.wire ? 'Hier einhängen' : `Andockpunkt · zu einem anderen ziehen: Lichterkette (${L.price} Δ)`;
    if (h.kind === 'lights') return `Lichterkette · anklicken zum Abnehmen (+${Math.floor(L.price / 2)} Δ)`;
    if (h.kind === 'ws') { const d = wsDef(D, h.id), p = d.power || 0; return `${d.name || h.id} · ${FN_NAMES[d.function] || ''} · ${d.places || 1} ${d.places > 1 ? 'Plätze' : 'Platz'}${p ? ` · ${p > 0 ? '+' : ''}${p} ⚡` : ''} · ziehen zum Umstellen`; }
    if (h.kind === 'part') { const t = D.rigParts?.[h.id] || {}; return `${t.name || h.id} · ${PART_SLOTS[t.slot] || t.slot}${this.partFacts(t)} · ziehen ${h.from === 'yard' ? 'an den Van' : 'zum Ausbauen'}`; }
    if (h.kind === 'container') { const d = D.containers?.[h.id] || {}; return `${d.name || h.id} · ${d.places || 1} Plätze · ${de(d.weight || 0)} kg · ziehen zum Umhängen`; }
    return 'Händler: hier abstellen = verkaufen, anklicken = Katalog';
  }

  partFacts(t) { return [t.pull ? `+${de(t.pull)} kg Zugkraft` : '', t.armor ? `+${t.armor} Panzerung` : '', t.damage ? `${t.damage} Schaden` : '', t.storageRows ? `+${t.storageRows} Reihen Kofferraum` : ''].filter(Boolean).map(x => ' · ' + x).join(''); }

  // ---------- dragging ----------
  startDrag(hit, w) {
    if (hit.kind === 'anchor') { this.wire = { from: hit.a, x: w.x, y: w.y }; this.hoverText = this.describe(hit); return this.draw(); }
    if (hit.kind === 'lights') return this.takeDown(hit.i);
    const s = this.scene, D = this.D, camp = this.camp;
    const holder = s.add.container(w.x, w.y).setDepth(34);
    let weight = 1, hang = 0;
    if (hit.kind === 'ws') {
      const key = workshopTexture(s, D, hit.id, D.camp), img = s.add.image(0, 14, key).setOrigin(0.5, 0);
      holder.add([s.add.rectangle(0, 0, 4, 16, 0x8b949e).setOrigin(0.5, 0), img]);
      weight = 0.5 + (wsDef(D, hit.id).places || 1) * 0.5;
      if (hit.from === 'rig') camp.drawRig({ hide: { ui: hit.ui, at: hit.at } });
      else hit.item.view.setAlpha(0.25);
      hang = img.height;
    } else if (hit.kind === 'part') {
      const v = partView(s, D, hit.id);
      holder.add([s.add.rectangle(0, 0, 4, 16, 0x8b949e).setOrigin(0.5, 0), v]);
      v.y = 14 + v.h;
      weight = 0.6 + ((D.rigParts?.[hit.id]?.size || [2, 2]).reduce((a, b) => a * b, 1)) / 8;
      if (hit.from === 'yard') hit.item.view.setAlpha(0.25);
      hang = v.h;
    } else if (hit.kind === 'container') {
      // the trailer itself hangs from the pointer at its roof
      const view = hit.from === 'rig' ? hit.unit.view : hit.item.view, k = view.scaleX;
      // a ground unit takes its stack along: all views of the block hang together
      const U = this.save.rig.units, [a, e] = hit.from === 'rig' && !levelOf(U[hit.ui]) ? blockAt(U, hit.ui) : [hit.ui, hit.ui + 1];
      const views = hit.from === 'rig' ? camp.geo.units.filter(x => x.ui >= a && x.ui < e).map(x => x.view) : [view];
      const topY = Math.min(...views.map(v => v.getBounds().y)), h = (view.y - topY) / k;
      for (const v of views) { const rx = v.x - view.x, ry = v.y - view.y; holder.add(v); v.setPosition(rx, h + 14 + ry).setScale(1).setAlpha(0.95); }
      if (hit.from === 'yard') { holder.setScale(k); this.scene.tweens.add({ targets: holder, scale: 1, duration: 260, ease: 'Back.easeOut' }); }
      weight = 1 + (D.containers?.[hit.id]?.weight || 1000) / 1500;
      hang = h;
    } else return;
    this.drag = { ...hit, holder, x: w.x, y: w.y, px: w.x, angle: 0, av: 0, vx: 0, weight, hang };
    this.el.classList.add('dragging');   // the dealer's catalogue fades and lets the pointer through
    this.peek(null);
    this.sfx.lift();
    s.game.canvas.style.cursor = 'grabbing';
    this.msg = null;
    this.draw();
  }
  // where would it go? → { type, ... } or null
  target() {
    const d = this.drag, D = this.D, camp = this.camp;
    if (!d) return null;
    const x = d.x, cy = d.y + Math.min(d.hang, 300) / 2;
    if (camp.dealer && x >= camp.dealer.x0 && x <= camp.dealer.x1 && d.y < camp.ground + 40) return { type: 'dealer', x: camp.dealer.x };
    if (d.kind === 'part') {
      const slot = this.D.rigParts?.[d.id]?.slot;
      let best = null, bd = 160;
      for (const so of this.sockets()) {
        if (so.slot !== slot) continue;
        const dist = Math.hypot(x - so.cx, cy - so.cy);
        if (dist < bd) { bd = dist; best = so; }
      }
      if (best) return d.from === 'socket' && best.slot === d.slot && best.i === d.si ? { type: 'home', sock: best, x: best.cx } : { type: 'socket', sock: best, x: best.cx, y: best.cy };
    } else if (d.kind === 'ws') {
      // the nearest place in height (stacked containers have places right above the ones below)
      let sl = null, sd = Infinity;
      for (const q of this.slots()) if (x >= q.x0 && x <= q.x1 && cy >= q.y0 - 120 && cy <= q.y1 + 120) { const dist = Math.abs(cy - (q.y0 + q.y1) / 2); if (dist < sd) { sd = dist; sl = q; } }
      if (sl) {
        if (d.from === 'rig' && sl.ui === d.ui && wsAt(D, this.save.rig, sl.ui, sl.p) === wsAt(D, this.save.rig, d.ui, d.at)) return { type: 'home', slot: sl, x: (sl.x0 + sl.x1) / 2 };
        return { type: 'slot', slot: sl, x: (sl.x0 + sl.x1) / 2 };
      }
    } else {
      // on top of a block: the hanging container's bottom near the deck
      if (this.D.containers?.[d.id]?.stackable) {
        let sb = null, sd = (this.B.view?.snap ?? 260) * 1.2;
        const U = this.save.rig.units, mine = d.from === 'rig' ? blockAt(U, d.ui) : null;
        for (const st of this.stacks()) {
          if (mine && st.onto === mine[0] && !st.own) continue;   // on its own stack (only another slot of it)
          const dist = Math.hypot(x - st.x, d.y + d.hang + 14 - st.y);
          if (dist < sd) { sd = dist; sb = { type: 'stack', onto: st.onto, slot: st.slot, x: st.x, y: st.y, w: st.w }; }
        }
        if (sb) return sb;
      }
      let best = null, bd = this.B.view?.snap ?? 260;
      const U = this.save.rig.units, [ba, be] = d.from === 'rig' ? blockAt(U, d.ui) : [-1, -1], stacked = d.from === 'rig' && levelOf(U[d.ui]) > 0;
      for (const g of this.gaps()) {
        if (d.from === 'rig' && !stacked && (g.g === ba || g.g === be)) continue;   // right next to itself = where it is
        const dist = Math.abs(x - g.x);
        if (dist < bd && d.y < camp.ground + 60) { bd = dist; best = { type: 'gap', g: g.g, x: g.x, y: g.y }; }
      }
      if (best) return best;
    }
    const Y = camp.geo.yard;
    if (Y && x >= Y.x0 && x <= Y.x1 && (d.from === 'rig' || d.from === 'socket')) return { type: 'yard', x: clamp(x, Y.x0 + 60, Y.x1 - 60) };
    return null;
  }
  dragHint() {
    const t = this.target(), d = this.drag, D = this.D;
    if (d.kind === 'part' && !t) return d.from === 'socket' ? 'Loslassen hier setzt es zurück. Ziel: Schrottplatz oder Händler.' : `Ziel: ${PART_SLOTS[D.rigParts?.[d.id]?.slot] || 'Sockel'} am Van oder Händler.`;
    if (!t) return d.from === 'rig' ? 'Loslassen hier legt es zurück. Ziel: freier Platz, Schrottplatz oder Händler.' : 'Ziel: freier Platz im Rig oder Händler.';
    if (t.type === 'dealer') return `Verkaufen: +${this.sellOf(d)} Δ`;
    if (t.type === 'yard') return d.kind === 'ws' ? 'Ausbauen: auf den Schrottplatz' : d.kind === 'part' ? 'Abschrauben: auf den Schrottplatz' : 'Abhängen: auf den Schrottplatz';
    if (t.type === 'socket') return t.sock.id ? `Tauschen mit ${D.rigParts?.[t.sock.id]?.name || t.sock.id}` : 'Anschrauben';
    if (t.type === 'gap') return d.from === 'yard' ? 'Ankuppeln' : 'Hier einreihen';
    if (t.type === 'stack') return 'Obendrauf stapeln';
    if (t.type === 'home') return 'Zurück an seinen Platz';
    const there = wsAt(D, this.save.rig, t.slot.ui, t.slot.p);
    return there ? `Tauschen mit ${wsDef(D, there.id).name || there.id}` : 'Einbauen';
  }
  sellOf(d) { return sellPrice(this.D, d.kind === 'ws' ? 'workshops' : d.kind === 'part' ? 'rigParts' : 'containers', d.id); }
  cancelDrag(silent = false) {
    const d = this.drag;
    if (!d) return;
    this.drag = null; this.el.classList.remove('dragging');
    d.holder.destroy();
    this.camp.drawRig();
    if (!silent) this.draw();
    this.scene.game.canvas.style.cursor = '';
  }
  // the part flies back where it came from
  flyBack(reason) {
    const d = this.drag, s = this.scene;
    if (!d) return;
    this.drag = null; this.el.classList.remove('dragging');
    this.sfx.nope();
    const home = d.from === 'yard' ? d.item : d.from === 'socket' ? d.sock : d.kind === 'ws' ? d.slot : d.unit;
    const hx = (home.x0 + home.x1) / 2, hy = (home.y0 ?? home.inTop ?? this.camp.ground - 300);
    s.tweens.add({ targets: d.holder, x: hx, y: hy, angle: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => { d.holder.destroy(); this.camp.drawRig(); } });
    s.game.canvas.style.cursor = '';
    if (reason) this.say(reason); else this.draw();
  }

  // ---------- dropping: one action, right away ----------
  drop() {
    const d = this.drag, D = this.D, save = this.save, t = this.target();
    if (!t || t.type === 'home') return this.flyBack(null);
    const before = snapshot(save);
    let r, label = '', fxAt = { x: t.x, y: this.camp.ground }, after = null;
    const name = d.kind === 'ws' ? wsDef(D, d.id).name || d.id : d.kind === 'part' ? D.rigParts?.[d.id]?.name || d.id : D.containers?.[d.id]?.name || d.id;
    const take = dd => d.from === 'rig' ? lift(D, dd, d.ui, d.at) : fromSpare(dd, dd.rig.spare.workshops[d.i]?.uid);
    if (d.kind === 'part') {
      if (t.type === 'socket') {
        r = act(D, save, dd => mountPart(D, dd, t.sock.slot, t.sock.i, d.from === 'yard' ? { yard: d.i } : { slot: d.slot, i: d.si }));
        label = r?.swapped ? `${name} angeschraubt, ${D.rigParts?.[r.swapped]?.name || r.swapped} auf dem Schrottplatz` : `${name} angeschraubt`;
        fxAt = { x: t.sock.cx, y: t.sock.y1 };
      } else if (t.type === 'yard') {
        r = act(D, save, dd => unmountPart(D, dd, d.slot, d.si));
        label = `${name} abgeschraubt`; fxAt.yard = 'part';
      } else if (t.type === 'dealer') {
        r = act(D, save, dd => { if (d.from === 'socket') { const x = unmountPart(D, dd, d.slot, d.si); if (!x.ok) return x; return sellPart(D, dd, dd.rig.spare.parts.length - 1); } return sellPart(D, dd, d.i); });
        label = `${name} verkauft`; after = 'sold';
      }
    } else if (d.kind === 'ws' && t.type === 'slot') {
      const sl = t.slot;
      r = act(D, save, dd => {
        const w = take(dd); if (!w) return { ok: false, reason: 'Weg' };
        const there = wsAt(D, dd.rig, sl.ui, sl.p);
        if (there) {
          const thereAt = there.at; lift(D, dd, sl.ui, sl.p);
          if (!place(D, dd, w, sl.ui, thereAt)) return { ok: false, reason: `${name} passt da nicht hin` };
          if (d.from === 'rig') { if (!place(D, dd, there, d.ui, d.at)) return { ok: false, reason: `${wsDef(D, there.id).name} passt nicht auf den alten Platz` }; }
          else stow(D, dd, there);
          return { ok: true };
        }
        const need = wsDef(D, d.id).places || 1;
        for (let p = sl.p; p > sl.p - need; p--) if (p >= 0 && fits(D, dd.rig, sl.ui, p, w.id)) return place(D, dd, w, sl.ui, p) ? { ok: true } : { ok: false };
        return { ok: false, reason: `${name} braucht ${need} freie Plätze nebeneinander` };
      });
      label = `${name} eingebaut`;
      fxAt = { x: t.x, y: sl.y1, unit: sl.ui };
    } else if (d.kind === 'ws' && t.type === 'yard') {
      r = act(D, save, dd => stow(D, dd, take(dd)));
      label = `${name} ausgebaut`; fxAt.yard = 'ws';
    } else if (d.kind === 'ws' && t.type === 'dealer') {
      r = act(D, save, dd => { const w = take(dd); toSpare(dd, w); return sellWorkshop(D, dd, w.uid); });
      label = `${name} verkauft`; after = 'sold';
    } else if (d.kind === 'container' && t.type === 'gap') {
      r = act(D, save, dd => d.from === 'rig' ? moveContainer(D, dd, d.ui, t.g) : attachAt(D, dd, d.i, t.g));
      label = d.from === 'rig' ? `${name} umgehängt` : `${name} angekuppelt`; after = 'coupled';
      fxAt = { x: t.x, y: this.camp.ground - 40, coupling: true };
    } else if (d.kind === 'container' && t.type === 'stack') {
      r = act(D, save, dd => stackOn(D, dd, d.from === 'yard' ? { spare: d.i } : { ui: d.ui }, t.onto, t.slot));
      label = `${name} gestapelt`; after = 'stacked';
      fxAt = { x: t.x, y: t.y, unit: t.onto };
    } else if (d.kind === 'container' && t.type === 'yard') {
      r = act(D, save, dd => detach(D, dd, d.ui));
      label = `${name} abgehängt`; fxAt.yard = 'container';
    } else if (d.kind === 'container' && t.type === 'dealer') {
      r = act(D, save, dd => {
        if (d.from === 'rig') { const x = detach(D, dd, d.ui); if (!x.ok) return x; return sellContainer(D, dd, dd.rig.spare.containers.length - 1); }
        return sellContainer(D, dd, d.i);
      });
      label = `${name} verkauft`; after = 'sold';
    }
    if (!r?.ok) return this.flyBack(r?.reason === 'Erst die Werkstätten ausbauen' ? 'Erst die Werkstätten ausbauen, dann abhängen' : r?.reason);
    d.holder.destroy();
    this.drag = null; this.el.classList.remove('dragging');
    this.scene.game.canvas.style.cursor = '';
    this.done(r, before, label, fxAt, after, d);
  }
  buy(area, id) {
    const D = this.D, save = this.save, before = snapshot(save), name = D[area]?.[id]?.name || id;
    const r = act(D, save, dd => area === 'workshops' ? buyWorkshop(D, dd, id) : area === 'rigParts' ? buyPart(D, dd, id) : buyContainer(D, dd, id));
    if (!r.ok) return this.say(r.reason);
    if (area === 'rigParts') return this.done(r, before, `${name} gekauft`, { x: this.camp.dealer?.x ?? this.scene.leyla.x, y: this.camp.ground }, 'delivered', { kind: 'part' });
    this.done(r, before, `${name} gekauft`, { x: this.camp.dealer?.x ?? this.scene.leyla.x, y: this.camp.ground }, 'delivered', { kind: area === 'workshops' ? 'ws' : 'container' });
  }
  // after an action: redraw, klonk, dust, springs, Leyla gets a job, undo remembers it
  done(r, before, label, fxAt, after, d) {
    const s = this.scene, camp = this.camp, V = this.B.view || {};
    camp.drawRig();
    const unit = fxAt.unit != null ? camp.geo.units.find(u => u.ui === fxAt.unit) : null;
    if (fxAt.yard) { const its = camp.yardItems.filter(it => it.kind === fxAt.yard), it = its[its.length - 1]; if (it) fxAt.x = it.x; }   // it lands on the scrapyard's next free spot
    if (after === 'delivered') {
      const items = camp.yardItems.filter(it => it.kind === d.kind), it = items[items.length - 1];
      if (it) {
        const y = it.view.y;
        it.view.y = y - 520;
        s.tweens.add({ targets: it.view, y, duration: 520, ease: 'Bounce.easeOut', onComplete: () => { this.sfx.klonk(1.4); s.fx.dust(it.x, camp.ground, 14); } });
      }
    } else if (after === 'sold') {
      this.sfx.coins();
      s.fx.text(fxAt.x, camp.ground - 220, `+${r.deltas} Δ`, { color: '#ffd27a', size: 46, rise: 110, life: 1300 });
      s.fx.dust(fxAt.x, camp.ground, 10);
    } else if (after === 'stacked') {
      this.sfx.klonk(2.2); this.sfx.klack();
      s.fx.dust(fxAt.x - 120, fxAt.y, 10); s.fx.dust(fxAt.x + 120, fxAt.y, 10);
      for (const u of camp.geo.units) this.bounce(u.view, 0.4);
    } else if (after === 'coupled') {
      this.sfx.klack(); this.sfx.klonk(2);
      s.fx.sparks(fxAt.x, fxAt.y, 0xffd27a, 10); s.fx.dust(fxAt.x, camp.ground, 16);
      for (const u of camp.geo.units) this.bounce(u.view, 0.6);
    } else {
      this.sfx.klonk(d.weight || 1);
      s.fx.dust(fxAt.x, fxAt.y, 12);
      if (unit) this.bounce(unit.view, 1); else for (const it of camp.yardItems) if (Math.abs(it.x - fxAt.x) < 140) this.bounce(it.view, 0.6);
    }
    if ((V.shake ?? 40) > 0 && after !== 'sold') s.cam.shake(110, 0.0012 * (V.shake ?? 40) / 40 * (d.weight || 1));
    // Leyla walks over and screws (Rig-Bau › Werkeln). Off (Daniel, 09.11.2026: „hält nur alles auf“): it is done at once,
    // „Rückgängig“ works for every action until building ends
    const W = this.B.work || {}, secs = clamp((W.seconds ?? 1.2) + (r.minutes || 0) / 60 * (W.perHour ?? 0.6), 0.4, 6);
    const job = W.enabled === false ? null : { x: this.reach(fxAt.x), fx: fxAt.x, fy: fxAt.y - 30, secs, label, minutes: r.minutes || 0, state: 'wait' };
    if (job) this.jobs.push(job);
    this.undo.push({ snap: before, label, job, at: { x: fxAt.x, y: fxAt.y }, done: false });
    const add = [r.minutes ? `+${r.minutes} min` : null, r.deltas ? `${r.deltas > 0 ? '+' : ''}${r.deltas} Δ` : null].filter(Boolean).join(' · ');
    this.say(`${label}${add ? ' · ' + add : ''}`, 'ok');
  }
  // springs: the unit sinks a bit and bounces back
  bounce(view, k = 1) {
    if (!view?.scene) return;
    const s = this.scene, sy = view.scaleY;
    s.tweens.add({ targets: view, scaleY: { from: sy * (1 - 0.05 * k), to: sy }, scaleX: { from: view.scaleX * (1 + 0.015 * k), to: view.scaleX }, duration: 650, ease: 'Elastic.easeOut' });
  }
  // a spot Leyla can walk to (not into the shaft, not off the map)
  reach(x) { const g = this.camp.geo, T = this.scene.T; return clamp(x, ((g.shaft?.to ?? 0) + 1) * T + 50, (g.W - 2) * T); }

  // the string lands on the docking point nearest to the pointer (string_lights.js checks price, maximum, length)
  finishWire(w) {
    const wr = this.wire, z = this.scene.cam.zoom;
    this.wire = null;
    const near = (this.camp.anchors?.() || []).filter(a => a.id !== wr.from.id).sort((a, b) => Math.hypot(a.x - w.x, a.y - w.y) - Math.hypot(b.x - w.x, b.y - w.y))[0];
    if (!near || Math.hypot(near.x - w.x, near.y - w.y) > 60 / z) { this.draw(); return this.say('Lichterkette: an einem Andockpunkt loslassen'); }
    const r = hang(this.D, this.save, wr.from.id, near.id, { a: wr.from, b: near });
    if (!r.ok) return this.say(r.why);
    this.camp.drawRig();
    this.sfx.klack?.();
    this.scene.fx.text((wr.from.x + near.x) / 2, Math.min(wr.from.y, near.y) - 30, `${r.deltas} Δ`, { color: '#ffd27a', size: 36, rise: 60, life: 1100 });
    this.scene.hud.changed?.();
    this.say('Lichterkette aufgehängt', 'ok');
  }
  takeDown(i) {
    const w = this.camp.wire(i), r = unhang(this.D, this.save, i);
    if (!r.ok) return;
    this.camp.drawRig();
    if (w) this.scene.fx.text(w.mid.x, w.mid.y - 30, `+${r.deltas} Δ`, { color: '#ffd27a', size: 36, rise: 60, life: 1100 });
    this.say('Lichterkette abgenommen', 'ok');
  }
  undoLast() {
    const top = this.undo[this.undo.length - 1];
    if (!this.active || !top || top.done || this.drag) return;
    this.undo.pop();
    restore(this.save, top.snap);
    if (top.job) { this.jobs = this.jobs.filter(j => j !== top.job); if (this.job === top.job) { this.job = null; this.working = false; } }
    this.camp.drawRig();
    this.scene.fx.puff(top.at?.x ?? top.job?.fx ?? 0, this.camp.ground - 10, 0xb9a2c8);
    this.say(`Rückgängig: ${top.label}`, 'ok');
  }

  // ---------- every frame: swinging part, targets, Leyla's jobs ----------
  // replaces the player's input while building: Leyla walks to her jobs by herself
  drive(input, dt) {
    const s = this.scene, l = s.leyla, now = s.time.now, out = {};
    for (const k of Object.keys(input)) out[k] = { down: false, pressed: false };
    out.build = input.build; out.help = input.help; out.controls = input.controls; out.mute = input.mute; out.debug = input.debug;
    this.working = false;
    if (!this.job && this.jobs.length) { this.job = this.jobs.shift(); this.job.state = 'walk'; }
    const j = this.job;
    if (j && this.atFire) {   // AvA does the work: flies there, then sparks and ratchet
      const dr = s.drone, near = !dr || Math.hypot(dr.x - j.fx, dr.y - (j.fy - 150)) < 40;
      if (j.state === 'walk' && near) { j.state = 'work'; j.at = now; }
    } else if (j) {
      const dx = j.x - l.x;
      if (j.state === 'walk' && Math.abs(dx) > 16) { out[dx > 0 ? 'right' : 'left'] = { down: true, pressed: false }; if (Math.abs(dx) < 200) out.walk = { down: true, pressed: false }; }
      else if (j.state === 'walk') { if (Math.abs(l.body.velocity.x) < 8) { j.state = 'work'; j.at = now; l.facing = j.fx >= l.x ? 1 : -1; } }
    }
    if (j) {
      if (j.state === 'work') {
        this.working = true;
        if (now - (j.tick || 0) > 260) { j.tick = now; s.fx.sparks(j.fx + (Math.random() - 0.5) * 60, j.fy, 0xffd27a, 4); this.sfx.ratchet(); }
        if (now - j.at > j.secs * 1000) {
          j.state = 'done';
          const u = this.undo.find(e => e.job === j); if (u) u.done = true;
          this.job = null; this.working = false;
          this.draw();
        }
      }
    }
    return out;
  }
  update(time, dt) {
    if (!this.active) return;
    const s = this.scene, g = this.gfx.clear(), d = this.drag, z = s.cam.zoom, D = this.D;
    if (s.drone) s.drone.build = this.B.view?.droneBuilds === false ? null : this.droneTarget();
    if (this.msg?.until && time > this.msg.until) { this.msg = null; this.draw(); }
    for (const t of this.labels) t.destroy();
    this.labels = [];
    const label = (x, y, text, color = '#f2eef7', fixed = false) => this.labels.push(s.add.text(x, y, text, { fontFamily: 'VT323, monospace', fontSize: fixed ? '24px' : '26px', color, stroke: '#0d0a12', strokeThickness: 5 }).setOrigin(0.5, 1).setScale(fixed ? 1 : 1 / Math.max(0.4, z)).setDepth(36));
    const pulse = 0.55 + 0.35 * Math.sin(time / 160), lw = 3 / z;
    // the van's places (inside the van, painted over it while building)
    for (const sl of this.slots()) if (sl.van) {
      const w = wsAt(D, this.save.rig, sl.ui, sl.p);
      g.lineStyle(2 / z, 0xffd27a, 0.35).strokeRoundedRect(sl.x0 + 6, sl.y0, sl.x1 - sl.x0 - 12, sl.y1 - sl.y0, 10);
      if (w && !(d?.kind === 'ws' && d.from === 'rig' && d.ui === sl.ui && d.at === w.at)) {
        const key = workshopTexture(s, D, w.id, D.camp), k = Math.min((sl.x1 - sl.x0 - 16) / s.textures.get(key).getSourceImage().width, (sl.y1 - sl.y0) / s.textures.get(key).getSourceImage().height);
        this.labels.push(s.add.image((sl.x0 + sl.x1) / 2, sl.y1, key).setOrigin(0.5, 1).setScale(k).setDepth(34));
        label((sl.x0 + sl.x1) / 2, sl.y0 - 4, wsDef(D, w.id).name || w.id, '#ffd27a', true);
      }
    }
    // the sockets for rig parts on the van: empty = dashed frame with the slot's name, built in = the part
    const pslot = d?.kind === 'part' ? D.rigParts?.[d.id]?.slot : null, tt = d ? this.target() : null;
    for (const so of this.sockets()) {
      const hot = tt?.type === 'socket' && tt.sock.slot === so.slot && tt.sock.i === so.i, fits = pslot === so.slot, held = d?.from === 'socket' && d.slot === so.slot && d.si === so.i;
      g.lineStyle(lw, hot ? 0xffd27a : fits ? 0x3fae6a : 0xc9a86a, hot ? 1 : fits ? pulse : 0.45).strokeRoundedRect(so.x0, so.y0, so.x1 - so.x0, so.y1 - so.y0, 10);
      if (hot) g.fillStyle(0xffd27a, 0.14).fillRoundedRect(so.x0, so.y0, so.x1 - so.x0, so.y1 - so.y0, 10);
      if (so.id && !held) { const v = partView(s, D, so.id).setDepth(34); const k = Math.min(1, (so.x1 - so.x0 - 8) / v.w, (so.y1 - so.y0 - 8) / v.h); v.setScale(k).setPosition(so.cx, so.cy + v.h * k / 2); this.labels.push(v); }
      else label(so.cx, so.cy + 12, PART_SLOTS[so.slot] || so.slot, fits || hot ? '#ffd27a' : '#c9a86a', true);
    }
    if (d) {
      // the part swings: it hangs from the pointer, lags behind sideways movement and settles on a damped spring
      const k = dt / 1000, vx = (d.x - d.px) / Math.max(k, 0.001);
      d.vx += (vx - d.vx) * Math.min(1, k * 12); d.px = d.x;
      const swing = (this.B.view?.swing ?? 100) / 100, stiff = 70 / d.weight, target = clamp(-d.vx * 0.0006 * swing, -0.5, 0.5);
      d.av += ((target - d.angle) * stiff - d.av * 7) * k; d.angle += d.av * k;
      d.holder.setPosition(d.x, d.y).setRotation(d.angle);
      // targets: places, couplings, scrapyard, dealer
      const t = this.target(), Y = this.camp.geo.yard, dl = this.camp.dealer;
      if (d.kind === 'part') { /* sockets drawn above */ } else if (d.kind === 'ws') for (const sl of this.slots()) {
        const there = wsAt(D, this.save.rig, sl.ui, sl.p), mine = d.from === 'rig' && there && sl.ui === d.ui && there.at === d.at, hot = t?.slot === sl || (t?.slot && t.slot.ui === sl.ui && t.slot.p === sl.p);
        g.lineStyle(lw, hot ? 0xffd27a : there && !mine ? 0xc77dff : 0x3fae6a, hot ? 1 : 0.45 * pulse).strokeRoundedRect(sl.x0 + 6, sl.y0 + 6, sl.x1 - sl.x0 - 12, sl.y1 - sl.y0 - 12, 10);
        if (hot) g.fillStyle(0xffd27a, 0.12).fillRoundedRect(sl.x0 + 6, sl.y0 + 6, sl.x1 - sl.x0 - 12, sl.y1 - sl.y0 - 12, 10);
      } else {
        if (D.containers?.[d.id]?.stackable) for (const st of this.stacks()) {
          const mine = d.from === 'rig' && blockAt(this.save.rig.units, d.ui)[0] === st.onto && !st.own, hot = t?.type === 'stack' && t.onto === st.onto && t.slot === st.slot;
          if (mine) continue;
          if (hot || st.slot == null) g.lineStyle(lw * 1.4, hot ? 0xffd27a : 0x3fe0d0, hot ? 1 : pulse).lineBetween(st.x - st.w / 2, st.y, st.x + st.w / 2, st.y);   // slots: only the one under the container shows its full width
          g.lineStyle(lw, hot ? 0xffd27a : 0x3fe0d0, hot ? 1 : pulse * 0.6).strokeTriangle(st.x - 14, st.y - 30, st.x + 14, st.y - 30, st.x, st.y - 10);
          if (hot) label(st.x, st.y - 36, st.own ? 'Umsetzen' : 'Stapeln', '#ffd27a');
        }
        for (const gp of this.gaps()) {
        if (d.from === 'rig' && !levelOf(this.save.rig.units[d.ui]) && blockAt(this.save.rig.units, d.ui).includes(gp.g)) continue;
        const hot = t?.type === 'gap' && t.g === gp.g;
        g.lineStyle(lw * 1.4, hot ? 0xffd27a : 0x3fe0d0, hot ? 1 : pulse).strokeCircle(gp.x, gp.y, hot ? 26 : 18);
        if (hot) label(gp.x, gp.y - 34, 'Ankuppeln', '#ffd27a');
        }
      }
      if (Y && (d.from === 'rig' || d.from === 'socket')) { const hot = t?.type === 'yard'; g.lineStyle(lw, hot ? 0xffd27a : 0xb9a2c8, hot ? 1 : 0.35).strokeRoundedRect(Y.x0, this.camp.ground - 300, Y.x1 - Y.x0, 300, 14); label((Y.x0 + Y.x1) / 2, this.camp.ground - 306, 'Schrottplatz', hot ? '#ffd27a' : '#b9a2c8'); }
      if (dl) { const hot = t?.type === 'dealer'; g.lineStyle(lw, hot ? 0xffd27a : 0xe0b030, hot ? 1 : 0.4).strokeRoundedRect(dl.x0, dl.y0, dl.x1 - dl.x0, dl.y1 - dl.y0, 14); if (hot) label(dl.x, dl.y0 - 6, `+${this.sellOf(d)} Δ`, '#ffd27a'); }
      const hint = this.dragHint();
      if (hint !== this.lastHint) { this.lastHint = hint; this.draw(); }
    } else if (this.pointer) {
      // hover: outline what can be grabbed
      const h = this.pick(this.pointer.x, this.pointer.y), r = h && (h.item || h.slot || h.sock || (h.unit && { x0: h.unit.x0, x1: h.unit.x1, y0: h.unit.inTop - 40, y1: h.unit.base ?? this.camp.ground }) || (h.kind === 'dealer' && this.camp.dealer));
      if (r) g.lineStyle(lw, 0xffd27a, 0.8).strokeRoundedRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 12);
      s.game.canvas.style.cursor = h ? (h.kind === 'dealer' ? 'pointer' : 'grab') : '';
      const text = h ? this.describe(h) : null;
      if (text !== this.hoverText) { this.hoverText = text; if (!this.msg) this.draw(); }
    }
    // string lights: docking points on every container corner, the string being pulled, an X in the middle of each hanging one
    if (lightsConfig(D).enabled) {
      const wr = this.wire, A = this.camp.anchors?.() || [], near = wr && A.filter(a => a.id !== wr.from.id).sort((a, b) => Math.hypot(a.x - wr.x, a.y - wr.y) - Math.hypot(b.x - wr.x, b.y - wr.y))[0];
      const snap = near && Math.hypot(near.x - wr.x, near.y - wr.y) < 60 / z ? near : null;
      for (const a of A) {
        const hot = a === snap || wr?.from.id === a.id;
        g.fillStyle(0x0d0a12, 0.7).fillCircle(a.x, a.y, 10 / z).fillStyle(hot ? 0xffd27a : 0xc9a86a, hot ? 1 : 0.5 + 0.3 * pulse).fillCircle(a.x, a.y, 6 / z);
      }
      if (wr) {
        const to = snap || wr, why = snap ? canHang(D, this.save, wr.from.id, snap.id, { a: wr.from, b: snap }) : null;
        g.lineStyle(lw, why ? 0xe86a73 : 0xffd27a, 0.9).lineBetween(wr.from.x, wr.from.y, to.x, to.y);
        if (snap) label(snap.x, snap.y - 16 / z, why || `Lichterkette · ${lightsConfig(D).price} Δ`, why ? '#e86a73' : '#ffd27a');
      }
      (this.save.rig.lights || []).forEach((_, i) => { const w = this.camp.wire(i); if (!w) return; const m = w.mid, r = 7 / z; g.lineStyle(lw, 0xe86a73, 0.4 + 0.3 * pulse).lineBetween(m.x - r, m.y - r, m.x + r, m.y + r).lineBetween(m.x - r, m.y + r, m.x + r, m.y - r); });
    }
    // Leyla's job: a little progress ring over the spot
    const j = this.job;
    if (j?.state === 'work') {
      const p = clamp((time - j.at) / (j.secs * 1000), 0, 1), r = 22 / Math.max(0.5, z);
      g.lineStyle(lw * 1.6, 0x0d0a12, 0.7).strokeCircle(j.fx, j.fy - 120, r);
      g.lineStyle(lw * 1.6, 0x3fe0d0, 1).beginPath().arc(j.fx, j.fy - 120, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2).strokePath();
    }
    for (const j2 of this.jobs) g.fillStyle(0x3fe0d0, 0.6).fillCircle(j2.fx, j2.fy - 120, 6 / z);
  }

  state() {
    if (!this.active) return { open: false };
    const D = this.D, save = this.save;
    return { open: true, deltas: save.deltas, clock: clockText(save), budgets: budgets(D, save.rig), msg: this.msg?.text || null, held: this.drag?.id || null,
      rig: save.rig.units.map(u => `${u.level ? '^' : ''}${u.id}[${u.workshops.map(w => `${w.id}@${w.at}`).join(' ')}]`).join(' '), spare: { workshops: [...save.rig.spare.workshops], containers: [...save.rig.spare.containers], parts: [...(save.rig.spare.parts || [])] }, parts: JSON.parse(JSON.stringify(save.rig.parts || {})),
      jobs: this.jobs.length + (this.job ? 1 : 0), working: this.working, canUndo: !!this.undo.length && !this.undo[this.undo.length - 1].done, shop: !!this.shopOpen, zoom: this.scene.cam.zoom, lights: (save.rig.lights || []).map(p => p.join('-')), wiring: this.wire?.from.id || null };
  }
  // screen positions (CSS pixels in the page) of everything that can be dragged or dropped on, for tests with a real mouse
  spots() {
    if (!this.active) return null;
    const s = this.scene, cam = s.cam, r = s.game.canvas.getBoundingClientRect(), sx = r.width / s.scale.width, sy = r.height / s.scale.height;
    const v = this.viewBox(), scr = (x, y) => ({ x: Math.round(r.left + (cam.x + (x - v.x) * v.z) * sx), y: Math.round(r.top + (cam.y + (y - v.y) * v.z) * sy) });
    const D = this.D, mid = o => scr((o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2);
    return {
      slots: this.slots().map(sl => ({ ui: sl.ui, p: sl.p, ws: wsAt(D, this.save.rig, sl.ui, sl.p)?.id || null, ...mid(sl) })),
      gaps: this.gaps().map(gp => ({ g: gp.g, ...scr(gp.x, gp.y) })),
      stacks: this.stacks().map(st => ({ onto: st.onto, slot: st.slot ?? null, own: !!st.own, ...scr(st.x, st.y) })),
      units: this.camp.geo.units.map(u => ({ ui: u.ui, id: u.id, level: u.level || 0, ...scr((u.in0 + u.in0 + u.cell * u.places) / 2, u.inTop - 20) })),
      yard: (this.camp.yardItems || []).map(it => ({ kind: it.kind, i: it.i, id: it.id, ...mid(it) })),
      sockets: this.sockets().map(so => ({ slot: so.slot, i: so.i, id: so.id, ...scr(so.cx, so.cy) })),
      yardFree: this.camp.geo.yard ? scr(this.camp.geo.yard.x1 - 120, this.camp.ground - 100) : null,
      dealer: this.camp.dealer ? mid(this.camp.dealer) : null,
      anchors: lightsConfig(D).enabled ? (this.camp.anchors?.() || []).map(a => ({ id: a.id, ...scr(a.x, a.y) })) : [],
      wires: (this.save.rig.lights || []).map((_, i) => { const w = this.camp.wire(i); return w ? { i, ...scr(w.mid.x, w.mid.y) } : null; }).filter(Boolean),
    };
  }
}
