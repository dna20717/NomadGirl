// Inventory interface (Daniel, 07.11.2026: "Tetris-Diablo-Inventar", mouse only, the game keeps running):
// equipment slots + backpack on the left, another inventory on the right (ground in a run, the chest or a storage place in the camp).
// Mouse: click picks a thing up (it follows the pointer), click on a cell puts it down (stacks or swaps), right click turns it,
// double click moves it to the other side, a click outside the panels puts it back. Placeholders until things have a look:
// coloured cells by category with a short glyph, the name and the count.
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { cellsOf, boxOf, drop, remove, add, fits, moveAll, thing, stackMax, canTurn, worth, newGrid, findSpot } from '../inventory.js';
import { partSlots, installPart, removePart, budgets, SLOT_NAMES as PART_SLOT_NAMES } from '../rig.js';
import { containers as storeList } from '../save.js';

export const CATEGORY_COLORS = {
  junk: '#6b6258', resource: '#5c6b7a', ingredient: '#6b7a3a', food: '#a8642a', component: '#4a6b8a', consumable: '#8a3a5a',
  valuable: '#a8862a', blueprint: '#7a6a9a', melee: '#8a4a3a', ranged: '#3a6a7a', cyberdeck: '#3a8a6a', backpack: '#7a5a8a', rigpart: '#8a6a3a',
};
const PART_ICONS = { engine: 'settings', armor: 'armor', weapon: 'target', roof: 'box' };
const CATEGORY_NAMES = { junk: 'Schrott', resource: 'Ressource', ingredient: 'Zutat', food: 'Gericht', component: 'Bauteil', consumable: 'Verbrauchsgut', valuable: 'Wertsache', blueprint: 'Bauplan', melee: 'Nahkampf', ranged: 'Fernkampf', cyberdeck: 'Cyberdeck', backpack: 'Rucksack', rigpart: 'Rig-Teil' };
const SLOT_NAMES = { melee: 'Nahkampf', ranged: 'Fernkampf', cyberdeck: 'Cyberdeck', backpack: 'Rucksack' };
const SLOT_ICONS = { melee: 'weapon', ranged: 'target', cyberdeck: 'brain', backpack: 'bags' };

export function kindOf(D, a, id) {
  const t = thing(D, a, id) || {};
  return a === 'weapons' ? t.kind || 'melee' : a === 'backpacks' ? 'backpack' : a === 'rigParts' ? 'rigpart' : t.category || 'junk';
}
export const glyphOf = (D, a, id) => { const t = thing(D, a, id) || {}; return t.glyph || (t.name || id).replace(/[^A-Za-zÄÖÜäöü]/g, '').slice(0, 2).toUpperCase(); };

export class InventoryUI {
  // host: { D, save(), changed(), equipChanged(slot), floor()?, notify(text), inCamp()?, rigChanged()? }
  // Tabs over the left panel (camp only): "Leyla" (slots + backpack) and the tractor ("Van": rig part slots + Kofferraum).
  constructor(root, host) {
    this.root = root; this.host = host;
    this.el = el('div', { class: 'inv', hidden: true, oncontextmenu: e => e.preventDefault() });
    this.tip = el('div', { class: 'inv-tip', hidden: true });
    this.ghost = el('div', { class: 'inv-ghost', hidden: true });
    root.append(this.el, this.tip, this.ghost);
    this.held = null;   // { e, from: key | slot name }
    this.other = null;  // { key, title, grid, kind: 'container' | 'floor' }
    document.addEventListener('mousemove', ev => this.move(ev));
    // a click next to the panels throws the held thing on the ground (a new bundle at Leyla's feet, Daniel: "überall auf den Boden werfen")
    document.addEventListener('mousedown', ev => { if (this.isOpen && this.held && !this.el.contains(ev.target) && ev.button === 0) this.throwDown(); }, true);
    // turning while holding: right click, ctrl+click (Mac) or the mouse wheel
    document.addEventListener('wheel', ev => { if (this.isOpen && this.held) { ev.preventDefault(); this.turnHeld(ev.deltaY < 0 ? -1 : 1); } }, { passive: false });
  }
  get D() { return this.host.D; }
  get inv() { return this.host.save().inv; }
  get isOpen() { return !this.el.hidden; }
  get cell() { return this.D.leyla?.inventory?.cell ?? 44; }

  open(other = null, { tab } = {}) { this.other = other; if (tab) this.tab = tab; this.el.hidden = false; this.draw(); }
  get vanTab() { return this.tab === 'van' && !!this.host.inCamp?.() && !!this.vanStore(); }
  vanStore() { return storeList(this.D, this.host.save()).find(c => c.unit === 0) || null; }
  setTab(t) { this.tab = t; this.draw(); }
  close() { if (this.held) this.putBack(); this.el.hidden = true; this.tip.hidden = true; this.other = null; }
  toggle(other = null) { if (this.isOpen && (!other || other.key === this.other?.key)) this.close(); else this.open(other); }
  grid(key) { return key === this.other?.key ? this.other.grid : this.inv.grids[key]; }

  // ---------- drawing ----------
  draw() {
    if (!this.isOpen) return;
    const D = this.D, inv = this.inv, bp = D.backpacks?.[inv.backpack], van = this.vanTab, vs = this.vanStore();
    const tabs = this.host.inCamp?.() && vs ? el('div', { class: 'inv-tabs' },
      el('button', { class: 'inv-tab' + (van ? '' : ' on'), onclick: () => this.setTab('leyla') }, icon('person', 14), 'Leyla'),
      el('button', { class: 'inv-tab' + (van ? ' on' : ''), onclick: () => this.setTab('van') }, icon('vehicle', 14), D.tractors?.[this.host.save().rig.tractor]?.name || 'Van')) : null;
    const leyla = () => el('section', { class: 'inv-panel' },
      el('header', {}, icon('bags', 16), el('b', {}, bp?.name || 'Rucksack'), el('small', {}, `${worth(D, inv.grids.backpack)} Δ`)),
      el('div', { class: 'inv-slots' }, ...['melee', 'ranged', 'cyberdeck', 'backpack'].map(s => this.slotEl(s)), this.useEl()),
      this.gridEl('backpack', inv.grids.backpack));
    const left = van ? this.vanEl(vs) : leyla();
    if (tabs) left.prepend(tabs);
    const parts = [left];
    // the two grids on screen (double click moves between them)
    this.pair = [van ? vs.key : 'backpack'];
    if (van && (!this.other || this.other.key === vs.key)) { parts.push(leyla()); this.pair.push('backpack'); }
    else if (this.other) {
      const o = this.other;
      this.pair.push(o.key);
      parts.push(el('section', { class: 'inv-panel' + (o.kind === 'floor' ? ' floor' : '') },
        el('header', {}, icon(o.kind === 'floor' ? 'down' : 'box', 16), el('b', {}, o.title), el('small', {}, `${worth(D, o.grid)} Δ`)),
        this.gridEl(o.key, o.grid),
        o.kind === 'container' ? el('div', { class: 'inv-actions' },
          el('button', { class: 'inv-btn', onclick: () => this.storeAll() }, 'Alles einlagern'),
          el('button', { class: 'inv-btn ghost', onclick: () => this.takeAll() }, 'Alles nehmen')) :
          el('div', { class: 'inv-actions' }, el('button', { class: 'inv-btn', onclick: () => this.takeAll() }, 'Alles aufheben'))));
    }
    this.el.replaceChildren(el('div', { class: 'inv-row' }, ...parts),
      el('p', { class: 'inv-help' }, this.vanTab ? 'Rig-Teil auf einen Slot legen: einbauen · Slot anklicken: ausbauen · Rig-Teile kauft man beim Händler (B), sie landen im Kofferraum · I oder Tab: schließen' : 'Klicken: nehmen und ablegen · Rechtsklick, Strg+Klick oder Mausrad: drehen · Doppelklick: auf die andere Seite · daneben klicken: auf den Boden werfen · I oder Tab: schließen'));
    this.drawGhost();
  }

  gridEl(key, g) {
    const D = this.D, c = this.cell;
    const box = el('div', { class: 'inv-grid', style: `width:${g.w * c}px;height:${g.h * c}px;--c:${c}px` });
    box.addEventListener('mousedown', ev => {
      if (ev.target !== box) return;
      const r = box.getBoundingClientRect(), x = Math.floor((ev.clientX - r.left) / c), y = Math.floor((ev.clientY - r.top) / c);
      if (ev.button === 2 || ev.ctrlKey) { if (this.held) this.turnHeld(); return; }
      if (this.held) this.place(key, x, y, ev);
    });
    for (const e of g.items) box.append(this.itemEl(key, g, e));
    return box;
  }

  // a thing in a grid: coloured cells of its shape + glyph, name and count
  itemEl(key, g, e) {
    const D = this.D, c = this.cell, cells = cellsOf(D, e.a, e.id, e.r || 0), b = boxOf(D, e), t = thing(D, e.a, e.id) || {}, color = CATEGORY_COLORS[kindOf(D, e.a, e.id)] || '#555';
    const wrap = el('div', { class: 'inv-item', style: `left:${e.x * c}px;top:${e.y * c}px;width:${b.w * c}px;height:${b.h * c}px;--col:${color}` });
    const set = new Set(cells.map(p => p.join(',')));
    for (const [x, y] of cells) wrap.append(el('i', { style: `left:${x * c}px;top:${y * c}px;width:${c}px;height:${c}px`,
      class: [!set.has(`${x - 1},${y}`) && 'l', !set.has(`${x + 1},${y}`) && 'r', !set.has(`${x},${y - 1}`) && 't', !set.has(`${x},${y + 1}`) && 'b'].filter(Boolean).join(' ') }));
    const [lx, ly] = cells[0];
    wrap.append(el('span', { class: 'inv-glyph', style: `left:${lx * c}px;top:${ly * c}px;width:${c}px;height:${c}px` }, glyphOf(D, e.a, e.id)));
    if (b.w * c >= 80 || b.h > 1) wrap.append(el('span', { class: 'inv-name' }, t.name || e.id));
    if (e.n > 1) wrap.append(el('span', { class: 'inv-count' }, String(e.n)));
    wrap.addEventListener('mousedown', ev => {
      ev.stopPropagation();
      if (ev.button === 2 || ev.ctrlKey) { if (this.held) this.turnHeld(); else this.turnInPlace(g, e); return; }
      if (ev.button !== 0) return;
      if (this.held) { const r = wrap.parentElement.getBoundingClientRect(); this.place(key, Math.floor((ev.clientX - r.left) / c), Math.floor((ev.clientY - r.top) / c), ev); return; }
      if (ev.detail >= 2) return;
      this.pick(key, g, e, ev);
    });
    wrap.addEventListener('mouseenter', () => this.showTip(e));
    wrap.addEventListener('mouseleave', () => { this.tip.hidden = true; });
    return wrap;
  }

  slotEl(slot) {
    const D = this.D, inv = this.inv, id = slot === 'backpack' ? inv.backpack : inv.slots[slot], a = slot === 'backpack' ? 'backpacks' : 'weapons', t = id && thing(D, a, id);
    const s = el('div', { class: 'inv-slot' + (t ? ' full' : ''), title: SLOT_NAMES[slot], style: t ? `--col:${CATEGORY_COLORS[kindOf(D, a, id)]}` : '' },
      el('small', {}, SLOT_NAMES[slot]), t ? el('b', {}, glyphOf(D, a, id)) : icon(SLOT_ICONS[slot], 18), t ? el('span', {}, t.name) : null);
    s.addEventListener('mousedown', ev => { ev.stopPropagation(); if (ev.button === 0) this.slotClick(slot); });
    if (t) { s.addEventListener('mouseenter', () => this.showTip({ a, id, n: 1 })); s.addEventListener('mouseleave', () => { this.tip.hidden = true; }); }
    return s;
  }

  // eating / using: drop a thing with a buff here (food, bandages); Gegenstände › Buff beim Essen/Benutzen
  useEl() {
    const s = el('div', { class: 'inv-slot use', title: 'Essen oder benutzen: Gericht oder Verband hier ablegen' }, el('small', {}, 'Benutzen'), icon('heart', 18), el('span', {}, 'Essen'));
    s.addEventListener('mousedown', ev => {
      ev.stopPropagation();
      if (ev.button !== 0) return;
      const h = this.held;
      if (!h) return this.host.notify?.('Zieh etwas Essbares hierher');
      if (h.e.a !== 'items') return this.host.notify?.('Das kann man nicht essen');
      const r = this.host.use?.(h.e.id);
      if (!r?.ok) return this.host.notify?.(r?.reason || 'Geht nicht');
      h.e.n -= 1;
      if (h.e.n <= 0) this.held = null;
      this.changed(h.from);
    });
    return s;
  }

  // the tractor like a paper doll: its slots for rig parts (V8, Bleche, Dachbox …), what they add up to, the Kofferraum
  vanEl(vs) {
    const D = this.D, save = this.host.save(), T = D.tractors?.[save.rig.tractor] || {}, b = budgets(D, save.rig), g = this.inv.grids[vs.key];
    const facts = [`${b.pull.toLocaleString('de-DE')} kg Zugkraft`, `${b.fuel} l/100 km`, b.armor ? `${b.armor} Panzerung` : null, b.damage ? `${b.damage} Schaden` : null].filter(Boolean);
    return el('section', { class: 'inv-panel van' },
      el('header', {}, icon('vehicle', 16), el('b', {}, T.name || 'Van'), el('small', {}, `${worth(D, g)} Δ`)),
      el('div', { class: 'inv-slots parts' }, ...partSlots(D, save.rig).map(p => this.partEl(p))),
      el('p', { class: 'inv-facts' }, facts.join(' · ')),
      el('div', { class: 'inv-sub' }, icon('box', 14), vs.name),
      this.gridEl(vs.key, g));
  }
  partEl(p) {
    const D = this.D, t = p.id && D.rigParts?.[p.id], name = PART_SLOT_NAMES[p.slot] || p.slot;
    const s = el('div', { class: 'inv-slot part' + (t ? ' full' : ''), title: name, 'data-part': `${p.slot}:${p.i}`, style: t ? `--col:${CATEGORY_COLORS.rigpart}` : '' },
      el('small', {}, name), t ? el('b', {}, glyphOf(D, 'rigParts', p.id)) : icon(PART_ICONS[p.slot] || 'box', 18), t ? el('span', {}, t.name) : null);
    s.addEventListener('mousedown', ev => { ev.stopPropagation(); if (ev.button === 0) this.partClick(p); });
    if (t) { s.addEventListener('mouseenter', () => this.showTip({ a: 'rigParts', id: p.id, n: 1 })); s.addEventListener('mouseleave', () => { this.tip.hidden = true; }); }
    return s;
  }
  // held rig part onto a slot = build it in (the old one comes into the hand); click on a full slot = take it out
  partClick(p, quiet = false) {
    const D = this.D, save = this.host.save(), h = this.held, say = t => { if (!quiet) this.host.notify?.(t); return false; };
    if (h) {
      if (h.e.a !== 'rigParts') return say(`Hier gehört ein Rig-Teil (${PART_SLOT_NAMES[p.slot]}) hin`);
      const r = installPart(D, save, p.slot, p.i, h.e.id);
      if (!r.ok) return say(r.reason);
      this.held = r.prev ? { e: { a: 'rigParts', id: r.prev, n: 1, r: 0 }, from: `part:${p.slot}:${p.i}` } : null;
      if (!quiet) this.host.notify?.(`${D.rigParts[h.e.id]?.name || h.e.id} eingebaut`);
      this.host.rigChanged?.();
      this.changed();
      return true;
    }
    if (!p.id) return say(`Zieh ein Rig-Teil (${PART_SLOT_NAMES[p.slot]}) hierher`);
    const r = removePart(D, save, p.slot, p.i);
    if (!r.ok) return say(r.reason);
    this.held = { e: { a: 'rigParts', id: r.prev, n: 1, r: 0 }, from: `part:${p.slot}:${p.i}` };
    this.host.rigChanged?.();
    this.changed();
    return true;
  }

  showTip(e) {
    const D = this.D, t = thing(D, e.a, e.id) || {}, k = kindOf(D, e.a, e.id);
    const facts = [CATEGORY_NAMES[k], e.a === 'rigParts' ? `Slot: ${PART_SLOT_NAMES[t.slot] || t.slot}` : null, e.a === 'rigParts' && t.pull ? `+${t.pull} kg Zugkraft` : null,
      e.a === 'rigParts' && t.armor ? `+${t.armor} Panzerung` : null, e.a === 'rigParts' && t.storageRows ? `+${t.storageRows} Reihen Stauraum` : null,
      (e.a === 'weapons' || e.a === 'rigParts') && t.damage ? `${t.damage} Schaden` : null, e.a === 'backpacks' && t.size ? `Raster ${t.size.join(' × ')}` : null,
      stackMax(D, e.a, e.id) > 1 ? `Stapel ${e.n}/${stackMax(D, e.a, e.id)}` : null, `${(t.value || 0) * e.n} Δ`, t.buff ? `Buff: ${D.buffs?.[t.buff]?.name || t.buff}` : null].filter(Boolean);
    this.tip.replaceChildren(el('b', {}, t.name || e.id), el('small', {}, facts.join(' · ')), t.description ? el('p', {}, t.description) : null);
    this.tip.hidden = false;
  }

  // ---------- holding things ----------
  pick(key, g, e) {
    remove(g, e);
    this.held = { e, from: key };
    this.pickedAt = performance.now();
    this.tip.hidden = true;
    this.changed(key);
  }
  move(ev) {
    this.mouse = [ev.clientX, ev.clientY];
    if (!this.tip.hidden) Object.assign(this.tip.style, { left: `${ev.clientX + 16}px`, top: `${ev.clientY + 16}px` });
    if (this.held) Object.assign(this.ghost.style, { left: `${ev.clientX}px`, top: `${ev.clientY}px` });
  }
  drawGhost() {
    const h = this.held;
    this.ghost.hidden = !h;
    if (!h) return;
    const D = this.D, c = this.cell, b = boxOf(D, h.e);
    const fake = this.itemEl('ghost', { items: [] }, { ...h.e, x: 0, y: 0 });
    this.ghost.replaceChildren(fake);
    Object.assign(this.ghost.style, { width: `${b.w * c}px`, height: `${b.h * c}px`, marginLeft: `${-c / 2}px`, marginTop: `${-c / 2}px` });
    if (this.mouse) Object.assign(this.ghost.style, { left: `${this.mouse[0]}px`, top: `${this.mouse[1]}px` });
  }
  turnHeld(d = 1) {
    const h = this.held;
    if (!h || !canTurn(this.D, h.e.a, h.e.id)) return;
    h.e.r = (((h.e.r || 0) + d) % 4 + 4) % 4;
    this.drawGhost();
  }
  turnInPlace(g, e) {
    if (!canTurn(this.D, e.a, e.id)) return;
    const r = e.r || 0;
    for (let k = 1; k < 4; k++) if (fits(this.D, g, { ...e, r: (r + k) % 4 }, e.x, e.y, e)) { e.r = (r + k) % 4; this.changed(); return; }
    this.host.notify?.('Kein Platz zum Drehen');
  }
  // the held thing goes at the clicked cell (the pointer holds its first cell)
  place(key, x, y, ev) {
    const g = this.grid(key), h = this.held;
    if (!g || !h) return;
    // second click of a double click on a thing just picked up: send it to the other side
    if (ev?.detail >= 2 && performance.now() - (this.pickedAt || 0) < 450 && h.from === key) return this.quickMoveHeld(key);
    const res = drop(this.D, g, h.e, x, y);
    if (!res.ok) { this.host.notify?.('Passt da nicht hin'); return; }
    this.held = res.held ? { e: res.held, from: key } : null;
    this.changed(key);
  }
  // back where it came from, otherwise anywhere in the backpack, otherwise on the other side
  putBack() {
    const h = this.held;
    if (!h) return;
    this.held = null;
    if (['melee', 'ranged', 'cyberdeck', 'backpack'].includes(h.from) && this.equip(h.from, h.e, true)) return this.changed();
    if (h.from?.startsWith('part:')) {
      const [, slot, i] = h.from.split(':');
      this.held = h;
      if (this.partClick({ slot, i: +i, id: this.host.save().rig.parts?.[slot]?.[+i] || null }, true) && !this.held) return;
      this.held = null;
    }
    for (const key of [h.from, 'backpack', ...(this.pair || []), this.other?.key]) {
      const g = key && this.grid(key);
      if (g && add(this.D, g, h.e.a, h.e.id, h.e.n) === 0) return this.changed(key);
    }
    this.held = h; this.host.notify?.('Nirgends Platz');
  }
  throwDown() {
    const h = this.held;
    if (!h) return;
    const left = this.host.throwDown?.(h.e);
    if (left == null) return this.putBack();
    if (left > 0) { h.e.n = left; this.host.notify?.('Nicht alles passt hin'); return this.putBack(); }
    this.held = null;
    this.changed('floor');
  }
  otherSide(key) { return (this.pair || []).find(k => k !== key) || (key === 'backpack' ? this.other?.key : 'backpack'); }
  quickMove(key, e) {
    const to = this.otherSide(key), g = this.grid(key), dst = to && this.grid(to);
    if (!dst) return;
    const left = add(this.D, dst, e.a, e.id, e.n);
    if (left === e.n) return this.host.notify?.('Kein Platz');
    if (left === 0) remove(g, e); else e.n = left;
    this.changed(to);
  }
  quickMoveHeld(key) {
    const h = this.held, to = this.otherSide(key), dst = to && this.grid(to);
    if (!dst) return;
    const left = add(this.D, dst, h.e.a, h.e.id, h.e.n);
    if (left === h.e.n) return this.host.notify?.('Kein Platz');
    h.e.n = left;
    this.held = left ? h : null;
    if (left) this.putBack();
    this.changed(to);
  }
  storeAll() { const n = moveAll(this.D, this.inv.grids.backpack, this.other.grid); this.host.notify?.(n ? `${n} ${n === 1 ? 'Sache' : 'Sachen'} eingelagert` : 'Nichts passt mehr rein'); this.changed(this.other.key); }
  takeAll() { const n = moveAll(this.D, this.other.grid, this.inv.grids.backpack); this.host.notify?.(n ? `${n} ${n === 1 ? 'Sache' : 'Sachen'} eingepackt` : 'Rucksack ist voll'); this.changed(this.other.key); }

  // ---------- slots ----------
  slotClick(slot) {
    const inv = this.inv, h = this.held;
    if (h) {
      if (!this.equip(slot, h.e)) return;
      return this.changed();
    }
    if (slot === 'backpack') return this.host.notify?.('Den Rucksack tauschst du, indem du einen anderen draufziehst');
    const id = inv.slots[slot];
    if (!id) return;
    inv.slots[slot] = null;
    this.held = { e: { a: 'weapons', id, n: 1, r: 0 }, from: slot };
    this.host.equipChanged?.(slot);
    this.changed();
  }
  // put e into a slot; whatever was there becomes held. quiet = no messages (putting back)
  equip(slot, e, quiet = false) {
    const D = this.D, inv = this.inv, say = t => { if (!quiet) this.host.notify?.(t); return false; };
    if (slot === 'backpack') {
      if (e.a !== 'backpacks') return say('Hier gehört ein Rucksack hin');
      const size = D.backpacks?.[e.id]?.size || [4, 3], test = newGrid(...size), old = inv.grids.backpack;
      for (const x of old.items) { if (fits(D, test, x, x.x, x.y)) test.items.push({ ...x }); else { const s = findSpot(D, test, x.a, x.id); if (!s) return say('Der Inhalt passt nicht in den neuen Rucksack'); test.items.push({ ...x, ...s }); } }
      const prev = inv.backpack;
      inv.backpack = e.id; inv.grids.backpack = test;
      this.held = prev ? { e: { a: 'backpacks', id: prev, n: 1, r: 0 }, from: 'backpack' } : null;
      this.host.equipChanged?.('backpack');
      return true;
    }
    if (e.a !== 'weapons' || (D.weapons?.[e.id]?.kind || 'melee') !== slot) return say(`Hier gehört eine ${SLOT_NAMES[slot]}-Waffe hin`);
    const prev = inv.slots[slot];
    inv.slots[slot] = e.id;
    this.held = prev ? { e: { a: 'weapons', id: prev, n: 1, r: 0 }, from: slot } : null;
    this.host.equipChanged?.(slot);
    return true;
  }

  changed(key) { this.host.changed?.(key); this.draw(); }

  // for tests and Ava: the open state
  state() {
    const g = x => x && { w: x.w, h: x.h, items: x.items.map(e => `${e.id}×${e.n}@${e.x},${e.y}${e.r ? ' r' + e.r : ''}`) };
    return { open: this.isOpen, tab: this.vanTab ? 'van' : 'leyla', pair: this.pair, parts: this.host.save().rig.parts, other: this.other && { key: this.other.key, title: this.other.title, grid: g(this.other.grid) }, backpack: g(this.inv.grids.backpack), slots: { ...this.inv.slots, backpack: this.inv.backpack }, held: this.held && `${this.held.e.id}×${this.held.e.n}` };
  }
}
