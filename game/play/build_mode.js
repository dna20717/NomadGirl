// Building the rig right in the camp (Rig bauen 2.0, Daniel 08.11.2026: "muss sich anfühlen wie das Bauen eines Rigs und weniger wie ein Menü").
// B (or Warroom › Rig umbauen) zooms out over the real rig, the scrapyard by the shaft and the van; the budget bar slides in on top.
// Everything is dragged with the mouse and has weight: the part hangs from the pointer and swings, sits down with a klonk,
// dust and springs bouncing. Every drop counts right away (Δ and time); Leyla walks over and screws for a moment,
// "Rückgängig" takes back the last action as long as she has not finished it.
//   workshop → a place in a trailer or the van (taken = swap), the scrapyard (stow), the dealer's pad (sell)
//   trailer  → a coupling (hang in / change the order), the scrapyard (unhitch, only empty), the dealer's pad (sell, only empty)
//   dealer catalogue (button or click on the pad): bought things are delivered onto the pad.
// Logic in game/rig.js (act, snapshot/restore), drawing in game/play/camp.js (drawRig, drawYard), values in "Rig-Bau".
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { budgets, act, snapshot, restore, lift, place, fits, at as wsAt, toSpare, fromSpare, stow, buyWorkshop, sellWorkshop, buyContainer, sellContainer, buyPart, SLOT_NAMES as PART_SLOTS, attachAt, detach, moveContainer, shop, priceOf, sellPrice, wsDef, placesOf } from '../rig.js';
import { clockText } from '../save.js';
import { workshopTexture } from './camp.js';
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
  }
  get scene() { return this.host.scene(); }
  get D() { return this.scene.data_; }
  get save() { return this.scene.box.save; }
  get camp() { return this.scene.camp; }
  get B() { return this.D.build || {}; }
  get isOpen() { return this.active; }

  // the scene restarts (camp ↔ run): forget everything
  reset() { delete this.el.parentElement?.dataset.building; this.active = false; this.el.hidden = true; this.shell = null; this.el.replaceChildren(); this.drag = null; this.jobs = []; this.job = null; this.undo = []; this.working = false; this.shopOpen = false; }

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
    this.onDown = p => this.pointerDown(p); this.onMove = p => this.pointerMove(p); this.onUp = p => this.pointerUp(p);
    s.input.on('pointerdown', this.onDown); s.input.on('pointermove', this.onMove); s.input.on('pointerup', this.onUp); s.input.on('pointerupoutside', this.onUp);
    this.draw();
  }
  close() {
    if (!this.active) return;
    const s = this.scene, cam = s.cam, back = this.camBack;
    if (this.drag) this.cancelDrag(true);
    // Leyla finishes the rest in no time (the time has been counted already)
    for (const u of this.undo) u.done = true;
    this.jobs = []; this.job = null; this.working = false;
    this.active = false; this.el.hidden = true; this.shell = null;
    delete this.el.parentElement.dataset.building;
    s.input.off('pointerdown', this.onDown); s.input.off('pointermove', this.onMove); s.input.off('pointerup', this.onUp); s.input.off('pointerupoutside', this.onUp);
    this.gfx?.destroy(); for (const t of this.labels || []) t.destroy(); this.labels = [];
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

  // ---------- the bar on top: budgets, clock, Δ, dealer, undo, done ----------
  draw() {
    if (!this.active) return;
    const D = this.D, save = this.save, b = budgets(D, save.rig), top = this.undo[this.undo.length - 1];
    const bar = (label, val, max, text, over, ic) => el('div', { class: 'build-budget' + (over ? ' over' : '') }, icon(ic, 16),
      el('span', {}, el('small', {}, label), el('b', {}, text)), max != null ? el('i', { style: `--k:${Math.min(1, max ? val / max : 1)}` }) : null);
    const msg = this.msg?.text || (this.drag ? this.dragHint() : this.hoverText || 'Teile mit der Maus packen und ziehen: in einen Anhänger, auf den Schrottplatz oder zum Händler.');
    // the bar, the dealer and the message stay the same elements while building (Daniel: the bar stays on, no slide in on every redraw);
    // only their contents change. The slide-in plays once when building starts or the dealer opens.
    if (!this.shell || !this.el.contains(this.shell.bar)) {
      this.shell = { bar: el('div', { class: 'bm-bar' }), shop: el('div', { class: 'bm-shopslot' }), msg: el('div', { class: 'bm-msg idle' }) };
      this.el.replaceChildren(this.shell.bar, this.shell.shop, this.shell.msg);
    }
    const sh = this.shell;
    sh.bar.replaceChildren(
        el('div', { class: 'bm-title' }, icon('build', 18), el('b', {}, 'Rig bauen')),
        el('div', { class: 'bm-budgets' },
          bar('Gewicht', b.weight, b.pull, `${de(b.weight)} / ${de(b.pull)} kg`, b.heavy, 'scale'),
          bar('Anhänger', b.length, b.maxLength, `${b.length} / ${b.maxLength}`, b.length > b.maxLength, 'box'),
          bar('Energie', b.power.used, b.power.made, `${b.power.net >= 0 ? '+' : ''}${b.power.net} ⚡ (${b.power.made} da, ${b.power.used} gebraucht)`, b.power.net < 0, 'flash'),
          bar('Verbrauch', 0, null, `${String(b.fuel).replace('.', ',')} l / 100 km`, false, 'drop'),
          bar('Plätze', b.filled, b.places, `${b.filled} / ${b.places} belegt`, false, 'grid')),
        el('div', { class: 'bm-side' },
          el('small', { class: 'bm-clock' }, clockText(save)),
          el('b', { class: 'build-deltas' }, `${de(save.deltas)} Δ`),
          el('button', { class: 'inv-btn bm-shopbtn' + (this.shopOpen ? ' on' : ''), onclick: () => { this.shopOpen = !this.shopOpen; this.draw(); } }, icon('shop', 15), ' Händler'),
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
      return el('div', { class: 'build-row', title: x.description || '' }, area === 'workshops' ? el('span', { class: 'build-dot', style: `--col:${FN_COLORS[x.function] || '#555'}` }) : icon(area === 'rigParts' ? 'settings' : 'box', 16),
        el('span', {}, el('b', {}, x.name || id), el('small', {}, sub)),
        el('button', { class: 'inv-btn', disabled: poor, title: poor ? 'Zu wenig Δ' : area === 'rigParts' ? 'Landet im Kofferraum (sonst Kiste, Lager, Rucksack); einbauen im Inventar unter „Van“' : 'Wird auf den Händler-Platz geliefert', onclick: () => this.buy(area, id) }, `${de(price)} Δ`));
    };
    return el('section', { class: 'inv-panel bm-shop' },
      el('header', {}, icon('shop', 16), el('b', {}, D.camp?.yard?.dealerName || 'Händler'), el('small', {}, 'liefert auf den Händler-Platz'), el('button', { class: 'craft-x', onclick: () => { this.shopOpen = false; this.draw(); } }, '×')),
      el('div', { class: 'build-list' }, el('h3', {}, 'Werkstätten'), ...S.workshops.map(id => row('workshops', id)), el('h3', {}, 'Anhänger'), ...S.containers.map(id => row('containers', id)),
        S.rigParts.length ? el('h3', {}, 'Rig-Teile') : null, ...S.rigParts.map(id => row('rigParts', id))));
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
  // couplings: gap g = in front of unit g (1 = right behind the van, units.length = at the end)
  gaps() {
    const geo = this.camp.geo, U = this.save.rig.units, out = [], y = this.camp.ground - 40;
    for (let g = 1; g <= U.length; g++) {
      const behind = geo.units.find(x => x.ui === g - 1);   // the unit in front of the gap (g - 1 = 0 is the van)
      out.push({ g, x: g === 1 ? geo.vanLeft : behind ? behind.x0 : geo.vanLeft, y });
    }
    return out;
  }
  // the thing under the pointer: a workshop (rig or yard), a trailer (rig or yard), the dealer's pad
  pick(x, y) {
    const D = this.D, U = this.save.rig.units, camp = this.camp, inside = r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
    for (const it of camp.yardItems || []) if (inside(it)) return it.kind === 'ws' ? { kind: 'ws', from: 'yard', i: it.i, id: it.id, item: it } : { kind: 'container', from: 'yard', i: it.i, id: it.id, item: it };
    for (const sl of this.slots()) {
      const w = inside(sl) && wsAt(D, this.save.rig, sl.ui, sl.p);
      if (w) return { kind: 'ws', from: 'rig', ui: sl.ui, at: w.at, id: w.id, slot: sl };
    }
    for (const u of camp.geo.units) if (x >= u.x0 && x <= u.x1 && y >= u.inTop - 40 && y <= camp.ground + 10) return { kind: 'container', from: 'rig', ui: u.ui, id: u.id, unit: u };
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
    if (this.press && !this.drag && Math.hypot(p.x - this.press.sx, p.y - this.press.sy) > 6) this.startDrag(this.press.hit, w);
    if (this.drag) { this.drag.x = w.x; this.drag.y = w.y; }
  }
  pointerUp(p) {
    if (!this.active) return;
    const w = this.world(p), press = this.press;
    this.press = null;
    if (this.drag) { this.drag.x = w.x; this.drag.y = w.y; return this.drop(); }
    if (press?.hit?.kind === 'dealer') { this.shopOpen = !this.shopOpen; return this.draw(); }
    if (press?.hit) { this.msg = null; this.hoverText = this.describe(press.hit); this.draw(); }
  }
  describe(h) {
    const D = this.D;
    if (h.kind === 'ws') { const d = wsDef(D, h.id), p = d.power || 0; return `${d.name || h.id} · ${FN_NAMES[d.function] || ''} · ${d.places || 1} ${d.places > 1 ? 'Plätze' : 'Platz'}${p ? ` · ${p > 0 ? '+' : ''}${p} ⚡` : ''} · ziehen zum Umstellen`; }
    if (h.kind === 'container') { const d = D.containers?.[h.id] || {}; return `${d.name || h.id} · ${d.places || 1} Plätze · ${de(d.weight || 0)} kg · ziehen zum Umhängen`; }
    return 'Händler: hier abstellen = verkaufen, anklicken = Katalog';
  }

  // ---------- dragging ----------
  startDrag(hit, w) {
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
    } else if (hit.kind === 'container') {
      // the trailer itself hangs from the pointer at its roof
      const view = hit.from === 'rig' ? hit.unit.view : hit.item.view, k = view.scaleX, b = view.getBounds();
      const topY = b.y, h = (view.y - topY) / k;
      holder.add(view); view.setPosition(0, h * 1 + 14).setScale(1).setAlpha(0.95);
      if (hit.from === 'yard') { holder.setScale(k); this.scene.tweens.add({ targets: holder, scale: 1, duration: 260, ease: 'Back.easeOut' }); }
      weight = 1 + (D.containers?.[hit.id]?.weight || 1000) / 1500;
      hang = h;
    } else return;
    this.drag = { ...hit, holder, x: w.x, y: w.y, px: w.x, angle: 0, av: 0, vx: 0, weight, hang };
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
    if (d.kind === 'ws') {
      for (const sl of this.slots()) if (x >= sl.x0 && x <= sl.x1 && cy >= sl.y0 - 120 && cy <= sl.y1 + 120) {
        if (d.from === 'rig' && sl.ui === d.ui && wsAt(D, this.save.rig, sl.ui, sl.p) === wsAt(D, this.save.rig, d.ui, d.at)) return { type: 'home', slot: sl, x: (sl.x0 + sl.x1) / 2 };
        return { type: 'slot', slot: sl, x: (sl.x0 + sl.x1) / 2 };
      }
    } else {
      let best = null, bd = this.B.view?.snap ?? 260;
      for (const g of this.gaps()) {
        if (d.from === 'rig' && (g.g === d.ui || g.g === d.ui + 1)) continue;   // right next to itself = where it is
        const dist = Math.abs(x - g.x);
        if (dist < bd && d.y < camp.ground + 60) { bd = dist; best = { type: 'gap', g: g.g, x: g.x, y: g.y }; }
      }
      if (best) return best;
    }
    const Y = camp.geo.yard;
    if (Y && x >= Y.x0 && x <= Y.x1 && d.from === 'rig') return { type: 'yard', x: clamp(x, Y.x0 + 60, Y.x1 - 60) };
    return null;
  }
  dragHint() {
    const t = this.target(), d = this.drag, D = this.D;
    if (!t) return d.from === 'rig' ? 'Loslassen hier legt es zurück. Ziel: freier Platz, Schrottplatz oder Händler.' : 'Ziel: freier Platz im Rig oder Händler.';
    if (t.type === 'dealer') return `Verkaufen: +${d.kind === 'ws' ? sellPrice(D, 'workshops', d.id) : sellPrice(D, 'containers', d.id)} Δ`;
    if (t.type === 'yard') return d.kind === 'ws' ? 'Ausbauen: auf den Schrottplatz' : 'Abhängen: auf den Schrottplatz';
    if (t.type === 'gap') return d.from === 'yard' ? 'Ankuppeln' : 'Hier einreihen';
    if (t.type === 'home') return 'Zurück an seinen Platz';
    const there = wsAt(D, this.save.rig, t.slot.ui, t.slot.p);
    return there ? `Tauschen mit ${wsDef(D, there.id).name || there.id}` : 'Einbauen';
  }
  cancelDrag(silent = false) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    d.holder.destroy();
    this.camp.drawRig();
    if (!silent) this.draw();
    this.scene.game.canvas.style.cursor = '';
  }
  // the part flies back where it came from
  flyBack(reason) {
    const d = this.drag, s = this.scene;
    this.drag = null;
    this.sfx.nope();
    const home = d.from === 'yard' ? d.item : d.kind === 'ws' ? d.slot : d.unit;
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
    const name = d.kind === 'ws' ? wsDef(D, d.id).name || d.id : D.containers?.[d.id]?.name || d.id;
    const take = dd => d.from === 'rig' ? lift(D, dd, d.ui, d.at) : fromSpare(dd, dd.rig.spare.workshops[d.i]?.uid);
    if (d.kind === 'ws' && t.type === 'slot') {
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
    this.drag = null;
    this.scene.game.canvas.style.cursor = '';
    this.done(r, before, label, fxAt, after, d);
  }
  buy(area, id) {
    const D = this.D, save = this.save, before = snapshot(save), name = D[area]?.[id]?.name || id;
    const r = act(D, save, dd => area === 'workshops' ? buyWorkshop(D, dd, id) : area === 'rigParts' ? buyPart(D, dd, id, save) : buyContainer(D, dd, id));
    if (!r.ok) return this.say(r.reason);
    if (area === 'rigParts') return this.done(r, before, `${name} gekauft → ${r.where || 'Kofferraum'}`, { x: this.camp.geo.vanLeft + 40, y: this.camp.ground - 60 }, 'part', { weight: 0.6 });
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
    // Leyla walks over and screws (Rig-Bau › Werkeln)
    const W = this.B.work || {}, secs = clamp((W.seconds ?? 1.2) + (r.minutes || 0) / 60 * (W.perHour ?? 0.6), 0.4, 6);
    const job = { x: this.reach(fxAt.x), fx: fxAt.x, fy: fxAt.y - 30, secs, label, minutes: r.minutes || 0, state: 'wait' };
    this.jobs.push(job);
    this.undo.push({ snap: before, label, job, done: false });
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

  undoLast() {
    const top = this.undo[this.undo.length - 1];
    if (!this.active || !top || top.done || this.drag) return;
    this.undo.pop();
    restore(this.save, top.snap);
    this.jobs = this.jobs.filter(j => j !== top.job);
    if (this.job === top.job) { this.job = null; this.working = false; }
    this.camp.drawRig();
    this.scene.fx.puff(top.job.fx, this.camp.ground - 10, 0xb9a2c8);
    this.say(`Rückgängig: ${top.label}`, 'ok');
  }

  // ---------- every frame: swinging part, targets, Leyla's jobs ----------
  // replaces the player's input while building: Leyla walks to her jobs by herself
  drive(input, dt) {
    const s = this.scene, l = s.leyla, now = s.time.now, out = {};
    for (const k of Object.keys(input)) out[k] = { down: false, pressed: false };
    out.build = input.build; out.help = input.help; out.mute = input.mute; out.debug = input.debug;
    this.working = false;
    if (!this.job && this.jobs.length) { this.job = this.jobs.shift(); this.job.state = 'walk'; }
    const j = this.job;
    if (j) {
      const dx = j.x - l.x;
      if (j.state === 'walk' && Math.abs(dx) > 16) { out[dx > 0 ? 'right' : 'left'] = { down: true, pressed: false }; if (Math.abs(dx) < 200) out.walk = { down: true, pressed: false }; }
      else if (j.state === 'walk') { if (Math.abs(l.body.velocity.x) < 8) { j.state = 'work'; j.at = now; l.facing = j.fx >= l.x ? 1 : -1; } }
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
    if (d) {
      // the part swings: it hangs from the pointer, lags behind sideways movement and settles on a damped spring
      const k = dt / 1000, vx = (d.x - d.px) / Math.max(k, 0.001);
      d.vx += (vx - d.vx) * Math.min(1, k * 12); d.px = d.x;
      const swing = (this.B.view?.swing ?? 100) / 100, stiff = 70 / d.weight, target = clamp(-d.vx * 0.0006 * swing, -0.5, 0.5);
      d.av += ((target - d.angle) * stiff - d.av * 7) * k; d.angle += d.av * k;
      d.holder.setPosition(d.x, d.y).setRotation(d.angle);
      // targets: places, couplings, scrapyard, dealer
      const t = this.target(), Y = this.camp.geo.yard, dl = this.camp.dealer;
      if (d.kind === 'ws') for (const sl of this.slots()) {
        const there = wsAt(D, this.save.rig, sl.ui, sl.p), mine = d.from === 'rig' && there && sl.ui === d.ui && there.at === d.at, hot = t?.slot === sl || (t?.slot && t.slot.ui === sl.ui && t.slot.p === sl.p);
        g.lineStyle(lw, hot ? 0xffd27a : there && !mine ? 0xc77dff : 0x3fae6a, hot ? 1 : 0.45 * pulse).strokeRoundedRect(sl.x0 + 6, sl.y0 + 6, sl.x1 - sl.x0 - 12, sl.y1 - sl.y0 - 12, 10);
        if (hot) g.fillStyle(0xffd27a, 0.12).fillRoundedRect(sl.x0 + 6, sl.y0 + 6, sl.x1 - sl.x0 - 12, sl.y1 - sl.y0 - 12, 10);
      } else for (const gp of this.gaps()) {
        if (d.from === 'rig' && (gp.g === d.ui || gp.g === d.ui + 1)) continue;
        const hot = t?.type === 'gap' && t.g === gp.g;
        g.lineStyle(lw * 1.4, hot ? 0xffd27a : 0x3fe0d0, hot ? 1 : pulse).strokeCircle(gp.x, gp.y, hot ? 26 : 18);
        if (hot) label(gp.x, gp.y - 34, 'Ankuppeln', '#ffd27a');
      }
      if (Y && d.from === 'rig') { const hot = t?.type === 'yard'; g.lineStyle(lw, hot ? 0xffd27a : 0xb9a2c8, hot ? 1 : 0.35).strokeRoundedRect(Y.x0, this.camp.ground - 300, Y.x1 - Y.x0, 300, 14); label((Y.x0 + Y.x1) / 2, this.camp.ground - 306, 'Schrottplatz', hot ? '#ffd27a' : '#b9a2c8'); }
      if (dl) { const hot = t?.type === 'dealer'; g.lineStyle(lw, hot ? 0xffd27a : 0xe0b030, hot ? 1 : 0.4).strokeRoundedRect(dl.x0, dl.y0, dl.x1 - dl.x0, dl.y1 - dl.y0, 14); if (hot) label(dl.x, dl.y0 - 6, `+${d.kind === 'ws' ? sellPrice(D, 'workshops', d.id) : sellPrice(D, 'containers', d.id)} Δ`, '#ffd27a'); }
      const hint = this.dragHint();
      if (hint !== this.lastHint) { this.lastHint = hint; this.draw(); }
    } else if (this.pointer) {
      // hover: outline what can be grabbed
      const h = this.pick(this.pointer.x, this.pointer.y), r = h && (h.item || h.slot || (h.unit && { x0: h.unit.x0, x1: h.unit.x1, y0: h.unit.inTop - 40, y1: this.camp.ground }) || (h.kind === 'dealer' && this.camp.dealer));
      if (r) g.lineStyle(lw, 0xffd27a, 0.8).strokeRoundedRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 12);
      s.game.canvas.style.cursor = h ? (h.kind === 'dealer' ? 'pointer' : 'grab') : '';
      const text = h ? this.describe(h) : null;
      if (text !== this.hoverText) { this.hoverText = text; if (!this.msg) this.draw(); }
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
      rig: save.rig.units.map(u => `${u.id}[${u.workshops.map(w => `${w.id}@${w.at}`).join(' ')}]`).join(' '), spare: { workshops: [...save.rig.spare.workshops], containers: [...save.rig.spare.containers] },
      jobs: this.jobs.length + (this.job ? 1 : 0), working: this.working, canUndo: !!this.undo.length && !this.undo[this.undo.length - 1].done, shop: !!this.shopOpen, zoom: this.scene.cam.zoom };
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
      units: this.camp.geo.units.map(u => ({ ui: u.ui, id: u.id, ...scr((u.x0 + u.x1) / 2, u.inTop - 20) })),
      yard: (this.camp.yardItems || []).map(it => ({ kind: it.kind, i: it.i, id: it.id, ...mid(it) })),
      yardFree: this.camp.geo.yard ? scr(this.camp.geo.yard.x1 - 120, this.camp.ground - 100) : null,
      dealer: this.camp.dealer ? mid(this.camp.dealer) : null,
    };
  }
}
