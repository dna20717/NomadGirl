// Inventory interface (Daniel, 07.11.2026: "Tetris-Diablo-Inventar", mouse only, the game keeps running):
// equipment slots + backpack on the left, another inventory on the right (ground in a run, the chest or a storage place in the camp).
// Mouse: click picks a thing up (it follows the pointer), click on a cell puts it down (stacks or swaps), right click turns it,
// double click moves it to the other side, a click outside the panels puts it back. Placeholders until things have a look:
// coloured cells by category with a short glyph, the name and the count.
import { el } from '../ui.js';
import { hints, padInUse } from './ui_nav.js';
import { icon } from '../icons.js';
import { cellsOf, boxOf, drop, remove, add, fits, moveAll, thing, stackMax, canTurn, worth, newGrid, findSpot, IMPLANTS, DRONE_WEAR, WEAR_KEYS, wearOf, gearStats, gearScore, occupancy } from '../inventory.js';
import { partSlots, budgets, SLOT_NAMES as PART_SLOT_NAMES } from '../rig.js';
import { containers as storeList } from '../save.js';

export const CATEGORY_COLORS = {
  junk: '#6b6258', resource: '#5c6b7a', ingredient: '#6b7a3a', food: '#a8642a', component: '#4a6b8a', consumable: '#8a3a5a',
  valuable: '#a8862a', blueprint: '#7a6a9a', armor: '#5a5a7a', implant: '#2f7f8a', dronepart: '#3a7a6a', melee: '#8a4a3a', ranged: '#3a6a7a', cyberdeck: '#3a8a6a', backpack: '#7a5a8a', rigpart: '#8a6a3a',
};
const PART_ICONS = { engine: 'settings', armor: 'armor', weapon: 'target', roof: 'box' };
const CATEGORY_NAMES = { junk: 'Schrott', resource: 'Ressource', ingredient: 'Zutat', food: 'Gericht', component: 'Bauteil', consumable: 'Verbrauchsgut', valuable: 'Wertsache', blueprint: 'Bauplan', armor: 'Rüstung', implant: 'Implantat', dronepart: 'Drohnenteil', melee: 'Nahkampf', ranged: 'Fernkampf', cyberdeck: 'Cyberdeck', backpack: 'Rucksack', rigpart: 'Rig-Teil' };
const SLOT_NAMES = { melee: 'Nahkampf', ranged: 'Fernkampf', cyberdeck: 'Cyberdeck', backpack: 'Rucksack' };
const SLOT_ICONS = { melee: 'weapon', ranged: 'target', cyberdeck: 'brain', backpack: 'bags' };
// worn places (game/inventory.js WEAR_KEYS): Leyla's head + armor, implants in her body, Mama-Bot's parts
export const WEAR_NAMES = { head: 'Kopf', armor: 'Rüstung', eyes: 'Augen', nerves: 'Nerven', arm: 'Cyberarm', heart: 'Herz', legs: 'Beine', skin: 'Haut', bow: 'Bug', tail: 'Heck', core: 'Kern', module: 'Modul' };
const WEAR_ICONS = { head: 'person', armor: 'armor', bow: 'target', tail: 'settings', core: 'flash', module: 'box' };
const STAT_NAMES = { defense: ['Abwehr', '%'], health: ['Leben', ''], damage: ['Schaden', '%'], speed: ['Tempo', '%'] };
export const statLine = st => Object.entries(STAT_NAMES).filter(([k]) => st?.[k]).map(([k, [n, u]]) => `${st[k] > 0 ? '+' : ''}${st[k]}${u} ${n}`).join(' · ');

export function kindOf(D, a, id) {
  const t = thing(D, a, id) || {};
  return a === 'weapons' ? t.kind || 'melee' : a === 'backpacks' ? 'backpack' : a === 'rigParts' ? 'rigpart' : t.category || 'junk';
}
export const glyphOf = (D, a, id) => { const t = thing(D, a, id) || {}; return t.glyph || (t.name || id).replace(/[^A-Za-zÄÖÜäöü]/g, '').slice(0, 2).toUpperCase(); };

// The picture of a thing whose look is a cell in an icon sheet (asset kind "icons"), as a CSS sprite; null without one.
// px = edge length on screen, turn = quarter turns (follows the thing in the grid).
const ASSET_BASE = new URL('projects/nomadgirl/', location.href);
export function iconCell(D, t) {
  const A = D.assets?.[t?.look];
  if (A?.kind !== 'icons' || !A.file || t.icon === undefined) return null;
  const [c, r] = A.grid || [1, 1];
  if (t.icon < 0 || t.icon >= c * r) return null;
  return { url: new URL(A.file, ASSET_BASE).href, c, r, col: t.icon % c, row: Math.floor(t.icon / c) };
}
export function artOf(D, a, id, px, turn = 0) {
  const k = iconCell(D, thing(D, a, id));
  if (!k) return null;
  const pos = (i, n) => n > 1 ? (i / (n - 1)) * 100 : 0;
  return el('span', { class: 'inv-art', style: `width:${px}px;height:${px}px;background-image:url("${k.url}");background-size:${k.c * 100}% ${k.r * 100}%;` +
    `background-position:${pos(k.col, k.c)}% ${pos(k.row, k.r)}%;${turn ? `transform:rotate(${turn * 90}deg);` : ''}` });
}
// picture if there is one, otherwise the glyph as text
export const markOf = (D, a, id, px) => artOf(D, a, id, px) || glyphOf(D, a, id);

export class InventoryUI {
  // host: { D, save(), changed(), equipChanged(slot), floor()?, notify(text), inCamp()?, rigChanged()? }
  // Tabs over the left panel (camp only): "Leyla" (slots + backpack) and the tractor ("Van": rig part slots + Kofferraum).
  constructor(root, host) {
    this.root = root; this.host = host;
    this.el = el('div', { class: 'inv ui-frame', hidden: true, oncontextmenu: e => e.preventDefault() });
    this.tip = el('div', { class: 'inv-tip', hidden: true });
    this.ghost = el('div', { class: 'inv-ghost', hidden: true });
    this.cursor = el('div', { class: 'inv-cursor', hidden: true });
    root.append(this.el, this.tip, this.ghost, this.cursor);
    this.held = null;   // { e, from: key | slot name }
    this.other = null;  // { key, title, grid, kind: 'container' | 'floor' }
    document.addEventListener('mousemove', ev => this.move(ev));
    // left open without a click for a while: Mama-Bot dozes off (wakes up with the next click)
    document.addEventListener('mousedown', () => { this.lastClick = performance.now(); if (this.face?.mood === 'invIdle') { this.face = null; this.showFace(); } }, true);
    setInterval(() => { if (this.isOpen && !this.face && performance.now() - Math.max(this.lastClick || 0, this.drawn || 0) > (this.D.drone?.idle?.invIdleAfter ?? 25) * 1000) this.react('invIdle'); }, 1000);
    // a click next to the panels throws the held thing on the ground (a new bundle at Leyla's feet, Daniel: "überall auf den Boden werfen")
    document.addEventListener('mousedown', ev => { if (this.isOpen && this.held && !this.el.contains(ev.target) && ev.button === 0) this.throwDown(); }, true);
    // turning while holding: right click, ctrl+click (Mac) or the mouse wheel
    document.addEventListener('wheel', ev => { if (this.isOpen && this.held) { ev.preventDefault(); this.turnHeld(ev.deltaY < 0 ? -1 : 1); } }, { passive: false });
  }
  get D() { return this.host.D; }
  get inv() { return this.host.save().inv; }
  get isOpen() { return !this.el.hidden; }
  get cell() { return this.D.leyla?.inventory?.cell ?? 44; }

  open(other = null, { tab } = {}) { this.other = other; if (tab) this.tab = tab; this.el.hidden = false; if (padInUse()) this.padOn = true; this.draw(); }
  get vanTab() { return this.tab === 'van' && !!this.host.inCamp?.() && !!this.vanStore(); }
  vanStore() { return storeList(this.D, this.host.save()).find(c => c.unit === 0) || null; }
  setTab(t) { this.tab = t; this.draw(); }
  close() { if (this.held) this.putBack(); this.el.hidden = true; this.tip.hidden = true; this.cursor.hidden = true; this.other = null; }
  toggle(other = null) { if (this.isOpen && (!other || other.key === this.other?.key)) this.close(); else this.open(other); }
  grid(key) { return key === this.other?.key ? this.other.grid : this.other?.extra?.find(x => x.key === key)?.grid || this.inv.grids[key]; }
  // what a grid takes (treasury: only valuables on the pile, only things tagged "trophy" on the stands)
  acceptOf(key) { return key === this.other?.key ? this.other.accept : this.other?.extra?.find(x => x.key === key)?.accept; }
  allows(key, e, say = true) {
    const A = this.acceptOf(key);
    if (!A) return true;
    const t = thing(this.D, e.a, e.id) || {}, ok = (!A.categories?.length || A.categories.includes(kindOf(this.D, e.a, e.id))) && (!A.tag || (t.tags || []).includes(A.tag));
    if (!ok && say) this.host.notify?.(A.tag === 'trophy' ? 'Nur Trophäen (Tag „Trophäe“)' : 'Hier nur Wertsachen');
    return ok;
  }

  // ---------- drawing ----------
  draw() {
    if (!this.isOpen) return;
    const D = this.D, inv = this.inv, van = this.vanTab, vs = this.vanStore();
    this.drawn = performance.now();
    if (van) {   // the tractor like a paper doll, the backpack (or the open storage) next to it
      const parts = [this.vanEl(vs), this.bagEl()];
      this.pair = [vs.key, 'backpack'];
      if (this.other && this.other.key !== vs.key) { parts[1] = this.otherEl(); this.pair = [vs.key, this.other.key]; }
      parts[0].prepend(this.tabsEl());
      this.el.replaceChildren(el('div', { class: 'inv-row' }, ...parts),
        hints([['move', 'wählen'], ['ok', 'nehmen / ablegen'], ['tabs', 'Tab wechseln'], ['back', 'zurück']], 'Rig-Teile ein- und ausbauen: Rig bauen (B) · Kofferraum wie jedes Lager'));
      this.fit(); return this.padShow();
    }
    // Daniel, 10.11.2026 ("Inventar im Diablo-Stil"): backpack left (with the ground or the open storage under it), Leyla in the middle, Mama-Bot right
    this.pair = this.other ? ['backpack', this.other.key] : ['backpack', 'drone'];
    const left = el('div', { class: 'inv-col' }, this.bagEl(), this.other ? this.otherEl() : null);
    this.el.replaceChildren(el('div', { class: 'inv-row' }, left, this.leylaEl(), this.droneEl()),
      hints([['move', 'wählen'], ['ok', 'nehmen / ablegen'], ['context', 'drehen'], ['send', 'rüber (halten: wegwerfen)'], ['tabs', 'Tab'], ['back', 'zurück']], 'Maus: klicken, Rechtsklick dreht, Doppelklick rüber, daneben = auf den Boden'));
    this.fit();
    this.drawGhost();
    this.padShow();
  }
  // shrink to the window when the screen is small (clicks into grids divide by the zoom)
  fit() {
    this.zoom = 1; this.el.style.transform = '';
    const w = this.el.scrollWidth, h = this.el.scrollHeight;
    this.zoom = Math.min(1, (innerWidth - 24) / Math.max(1, w), (innerHeight - 110) / Math.max(1, h));
    if (this.zoom < 1) this.el.style.transform = `translateX(-50%) scale(${this.zoom})`;
    this.ghost.style.transform = this.zoom < 1 ? `scale(${this.zoom})` : '';
  }
  tabsEl() {
    const D = this.D, camp = this.host.inCamp?.() && this.vanStore(), t = this.vanTab ? 'van' : this.view === 'implants' ? 'implants' : 'gear';
    const tab = (id, ic, name, go) => el('button', { class: 'inv-tab' + (t === id ? ' on' : ''), 'data-tab': id, onmousedown: ev => { ev.stopPropagation(); go(); } }, icon(ic, 14), name);
    return el('div', { class: 'inv-tabs' }, tab('gear', 'person', 'Ausrüstung', () => { this.view = 'gear'; this.setTab('leyla'); }), tab('implants', 'brain', 'Implantate', () => { this.view = 'implants'; this.setTab('leyla'); }),
      camp ? tab('van', 'vehicle', D.tractors?.[this.host.save().rig.tractor]?.name || 'Van', () => this.setTab('van')) : null);
  }
  bagEl() {
    const D = this.D, inv = this.inv, bp = D.backpacks?.[inv.backpack];
    return el('section', { class: 'inv-panel bag' },
      el('header', {}, icon('bags', 16), el('b', {}, bp?.name || 'Rucksack'), el('small', {}, `${worth(D, inv.grids.backpack)} Δ`)),
      this.gridEl('backpack', inv.grids.backpack));
  }
  otherEl() {
    const D = this.D, o = this.other;
    return el('section', { class: 'inv-panel' + (o.kind === 'floor' ? ' floor' : '') },
      el('header', {}, icon(o.kind === 'floor' ? 'down' : 'box', 16), el('b', {}, o.title), el('small', {}, `${worth(D, o.grid)} Δ`)),
      this.gridEl(o.key, o.grid),
      // trophy stands of the treasury: one small grid each, side by side
      o.extra?.length ? el('div', { class: 'inv-stands' }, ...o.extra.map(x => el('div', { class: 'inv-stand' }, el('small', {}, icon('star', 12), x.title), this.gridEl(x.key, x.grid)))) : null,
      o.kind === 'container' ? el('div', { class: 'inv-actions' },
        el('button', { class: 'inv-btn', onclick: () => this.storeAll() }, 'Alles einlagern'),
        el('button', { class: 'inv-btn ghost', onclick: () => this.takeAll() }, 'Alles nehmen')) :
        el('div', { class: 'inv-actions' }, el('button', { class: 'inv-btn', onclick: () => this.takeAll() }, 'Alles aufheben')));
  }
  // Leyla from the front with her slots around her; tab "Implantate" shows her as a scan with a line from each implant to its place on the body
  leylaEl() {
    const D = this.D, inv = this.inv, I = D.leyla?.inventory || {}, A = D.assets?.[I.portrait], k = I.portraitScale || 1.5;
    const st = gearStats(D, inv.wear), base = D.leyla?.health ?? 100, implants = this.view === 'implants';
    const fig = (cls = '') => {
      if (!A?.file) return el('div', { class: 'inv-figure none ' + cls }, icon('person', 64));
      const [w, h] = A.frameSize || A.size || [96, 256];
      const f = el('div', { class: 'inv-figure ' + cls, style: `width:${w * k}px;height:${h * k}px;--fig:url("${new URL(A.file, ASSET_BASE).href}")` },
        el('img', { src: new URL(A.file, ASSET_BASE).href, alt: 'Leyla', style: `width:${w * k}px;height:${h * k}px`, onload: ev => { const i = ev.target; if (!A.frameSize && (i.naturalWidth !== w || i.naturalHeight !== h)) { f.style.width = i.style.width = `${i.naturalWidth * k}px`; f.style.height = i.style.height = `${i.naturalHeight * k}px`; } } }));
      return f;
    };
    const stat = (n, v, c = '') => el('div', { class: 'inv-stat' + (c ? ' ' + c : '') }, el('small', {}, n), el('b', {}, v));
    const max = I.strainMax ?? 10;
    const stats = el('div', { class: 'inv-stats' }, stat('Leben', String(base + st.health), st.health ? 'up' : ''), stat('Abwehr', `${st.defense} %`), stat('Schaden', `${st.damage >= 0 ? '+' : ''}${st.damage} %`),
      stat('Tempo', `${100 + st.speed} %`, st.speed < 0 ? 'down' : st.speed > 0 ? 'up' : ''), stat('Belastung', `${st.strain} / ${max}`, st.strain > max * 0.8 ? 'warn' : 'cyan'));
    // one layout for both tabs (Daniel, 11.11.2026: "der Switch soll im selben Fenster stattfinden"): Leyla stays put,
    // only the six places left and right change, and she fades into the scan; the wires are drawn once the layout stands
    const col = keys => el('div', { class: 'inv-wearcol' }, ...keys.map(([x, n]) => this.slotEl(x, n)));
    let left, right;
    if (!implants) { left = [['wear:head'], ['wear:armor'], ['melee']]; right = [['cyberdeck'], ['ranged'], ['backpack']]; }
    else {
      const rows = I.implants?.length ? I.implants : IMPLANTS.map((slot, i) => ({ slot, name: WEAR_NAMES[slot], at: [48, 40 + i * 30], side: i < 3 ? 'left' : 'right' }));
      left = rows.filter(r => r.side !== 'right').map(r => ['wear:' + r.slot, r.name]);
      right = rows.filter(r => r.side === 'right').map(r => ['wear:' + r.slot, r.name]);
      requestAnimationFrame(() => this.wires(rows, k));
    }
    const swap = this.lastView !== undefined && this.lastView !== (implants ? 'implants' : 'gear');
    this.lastView = implants ? 'implants' : 'gear';
    const figure = fig(implants ? 'scan' : '');
    const body = el('div', { class: 'inv-doll' + (swap ? ' swap' : '') + (implants ? ' implants' : '') }, col(left),
      el('div', { class: 'inv-center' }, figure, implants ? el('p', { class: 'inv-note' }, this.host.inCamp?.() ? 'Im Camp ein- und ausbauen' : 'Nur im Camp tauschbar') : this.useEl()), col(right));
    this.dollEl = body; this.figEl = figure;
    return el('section', { class: 'inv-panel leyla' }, el('header', {}, icon('person', 16), el('b', {}, 'Leyla'), el('small', {}, `${this.host.save().deltas ?? 0} Δ`)), this.tabsEl(), body, stats);
  }
  // dashed lines from each implant place to its point on Leyla's body (measured after layout, the zoom taken out)
  wires(rows, k) {
    const doll = this.dollEl, f = this.figEl?.querySelector('img');
    if (!doll?.isConnected || !f) return;
    const z = this.zoom || 1, R = doll.getBoundingClientRect(), F = f.getBoundingClientRect(), add = [];
    for (const r of rows) {
      const s = doll.querySelector(`.inv-slot[data-slot="wear:${r.slot}"]`); if (!s) continue;
      const S = s.getBoundingClientRect(), on = !!this.inv.wear?.[r.slot], c = 'inv-wire' + (on ? ' on' : '');
      const px = (F.left - R.left) / z + (r.at?.[0] ?? 48) * k, py = (F.top - R.top) / z + (r.at?.[1] ?? 60) * k;
      const ex = ((r.side === 'right' ? S.left : S.right) - R.left) / z, ly = (S.top + S.height / 2 - R.top) / z;
      add.push(el('i', { class: c, style: `left:${Math.min(ex, px)}px;top:${ly}px;width:${Math.abs(px - ex)}px;height:0` }),
        el('i', { class: c, style: `left:${px}px;top:${Math.min(ly, py)}px;width:0;height:${Math.abs(py - ly)}px` }),
        el('i', { class: 'inv-dot' + (on ? ' on' : ''), style: `left:${px - 5}px;top:${py - 5}px` }));
    }
    doll.append(...add);
  }
  // Mama-Bot: her picture (hull, face of the moment, worn parts), four places for parts, the rescue pocket
  droneEl() {
    const D = this.D, R = D.drone?.rescue || {}, g = this.inv.grids.drone;
    this.droneFig = this.droneFigure();
    const col = keys => el('div', { class: 'inv-wearcol' }, ...keys.map(x => this.slotEl('wear:' + x)));
    return el('section', { class: 'inv-panel drone' }, el('header', {}, icon('air', 16), el('b', {}, D.drone?.name || 'Mama-Bot')),
      el('div', { class: 'inv-doll' }, col(['tail', 'core']), el('div', { class: 'inv-center' }, this.droneFig), col(['bow', 'module'])),
      el('div', { class: 'inv-sub cyan' }, icon('heart', 14), R.name || 'Rettungsfach', el('small', {}, `${g?.w ?? 0} × ${g?.h ?? 0}`)),
      el('div', { class: 'inv-rescue' }, g ? this.gridEl('drone', g) : null, el('p', {}, 'Übersteht ein k.o.: Mama-Bot bringt es heim. Was im Rucksack liegt, ist dann weg.')));
  }
  droneFigure() {
    const D = this.D, Dr = D.drone || {}, A = D.assets || {}, H = A[Dr.look], k = 2, url = a => new URL(a.file, ASSET_BASE).href;
    if (!H?.file) return el('div', { class: 'inv-dronefig none' }, icon('air', 64));
    const [hw, hh] = H.frameSize || [128, 128], [ox, oy] = H.origin || [hw / 2, hh / 2], worn = new Set(Object.values(this.inv.wear || {}).filter(Boolean));
    const box = el('div', { class: 'inv-dronefig', style: `width:${hw * k}px;height:${hh * k}px` });
    const part = r => { const a = A[r.look]; if (!a?.file || !(r.item ? worn.has(r.item) : r.on)) return null;
      const [pw, ph] = a.frameSize || [a.width || 40, a.height || 40], [px, py] = a.origin || [pw / 2, ph / 2];
      const img = el('img', { src: url(a), alt: '', style: `left:${((r.at?.[0] ?? ox) - px) * k}px;top:${((r.at?.[1] ?? oy) - py) * k}px` });
      img.onload = () => { const [nw, nh] = [img.naturalWidth, img.naturalHeight], [qx, qy] = a.origin || [nw / 2, nh / 2]; Object.assign(img.style, { width: `${nw * k}px`, height: `${nh * k}px`, left: `${((r.at?.[0] ?? ox) - qx) * k}px`, top: `${((r.at?.[1] ?? oy) - qy) * k}px` }); };
      return img; };
    for (const r of Dr.parts || []) if (r.layer === 'behind') { const p = part(r); if (p) box.append(p); }
    box.append(el('img', { src: url(H), alt: 'Mama-Bot', style: `left:0;top:0;width:${hw * k}px;height:${hh * k}px` }));
    const F = Dr.face, FA = F && A[F.look];
    if (FA?.file) {
      const [cw, ch] = FA.frameSize || [28, 32], [cx, cy] = FA.origin || [cw / 2, ch / 2], [sx, sy] = F.screen || [ox, oy];
      this.faceEl = el('span', { class: 'inv-face', style: `left:${(sx - cx) * k}px;top:${(sy - cy) * k}px;width:${cw * k}px;height:${ch * k}px;background-image:url("${url(FA)}");background-size:${(FA.frames || 1) * cw * k}px ${ch * k}px` });
      this.faceEl.dataset.cw = cw * k;
      box.append(this.faceEl);
      const GA = A[F.glass]; if (GA?.file) box.append(el('img', { src: url(GA), alt: '', style: `left:0;top:0;width:${hw * k}px;height:${hh * k}px` }));
    }
    for (const r of Dr.parts || []) if (r.layer !== 'behind') { const p = part(r); if (p) box.append(p); }
    this.bubbleEl = el('span', { class: 'inv-bubble', hidden: true });
    box.append(this.bubbleEl);
    this.showFace();
    return box;
  }
  // Mama-Bot reacts to what happens in the inventory (Daniel: "das Drohnengesicht soll reagieren, sei kreativ"); also out in the world
  react(mood) {
    const m = (this.D.drone?.moods || []).find(x => x.mood === mood);
    if (!m) return;
    this.face = { mood, frame: m.frame ?? 0, kaomoji: m.kaomoji || '', until: m.duration ? performance.now() + m.duration : Infinity };
    if (mood !== 'invIdle') this.host.react?.(mood);
    this.showFace();
    this.lastMood = mood;
    clearTimeout(this.faceTimer);
    if (m.duration) this.faceTimer = setTimeout(() => this.showFace(), m.duration + 20);
  }
  showFace() {
    const f = this.face && performance.now() < this.face.until ? this.face : null, idle = (this.D.drone?.moods || []).find(x => x.mood === 'idle');
    const frame = f ? f.frame : idle?.frame ?? 0;
    if (this.faceEl) this.faceEl.style.backgroundPosition = `${-frame * this.faceEl.dataset.cw}px 0`;
    if (this.bubbleEl) { this.bubbleEl.textContent = f?.kaomoji || ''; this.bubbleEl.hidden = !f?.kaomoji; }
    this.droneFig?.classList.toggle('spin', f?.mood === 'dronePart');
    if (!f) this.face = null;
  }
  // after a change: valuables, the backpack filling up, things in the rescue pocket
  moodAfter(key, e) {
    if (!e) return;
    const t = thing(this.D, e.a, e.id) || {}, cat = t.category;
    if (key === 'drone') return this.react(['food', 'ingredient'].includes(cat) ? 'rescueFood' : 'rescue');
    if (key !== 'backpack') return;
    const g = this.inv.grids.backpack, full = occupancy(this.D, g).size / (g.w * g.h);
    if (full >= 0.85 && !this.wasFull) { this.wasFull = true; return this.react('bagFull'); }
    if (full < 0.7) this.wasFull = false;
    if (['valuable', 'blueprint'].includes(cat) || (e.a === 'items' && t.wear)) this.react('valuable');
  }

  gridEl(key, g) {
    const D = this.D, c = this.cell;
    const box = el('div', { class: 'inv-grid', 'data-key': key, style: `width:${g.w * c}px;height:${g.h * c}px;--c:${c}px` });
    box.addEventListener('mousedown', ev => {
      if (ev.target !== box) return;
      const r = box.getBoundingClientRect(), z = this.zoom || 1, x = Math.floor((ev.clientX - r.left) / z / c), y = Math.floor((ev.clientY - r.top) / z / c);
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
    const [lx, ly] = cells[0], side = Math.min(b.w, b.h) * c, art = artOf(D, e.a, e.id, Math.round(side * 0.92), e.r || 0);
    if (art) { wrap.classList.add('pic'); wrap.append(el('span', { class: 'inv-pic', style: `left:${(b.w * c - side) / 2}px;top:${(b.h * c - side) / 2}px;width:${side}px;height:${side}px` }, art)); }
    else wrap.append(el('span', { class: 'inv-glyph', style: `left:${lx * c}px;top:${ly * c}px;width:${c}px;height:${c}px` }, glyphOf(D, e.a, e.id)));
    if (!art && (b.w * c >= 80 || b.h > 1)) wrap.append(el('span', { class: 'inv-name' }, t.name || e.id));
    if (e.n > 1) wrap.append(el('span', { class: 'inv-count' }, String(e.n)));
    wrap.addEventListener('mousedown', ev => {
      ev.stopPropagation();
      if (ev.button === 2 || ev.ctrlKey) { if (this.held) this.turnHeld(); else this.turnInPlace(g, e); return; }
      if (ev.button !== 0) return;
      if (this.held) { const r = wrap.parentElement.getBoundingClientRect(), z = this.zoom || 1; this.place(key, Math.floor((ev.clientX - r.left) / z / c), Math.floor((ev.clientY - r.top) / z / c), ev); return; }
      if (ev.detail >= 2) return;
      this.pick(key, g, e, ev);
    });
    wrap.addEventListener('mouseenter', () => this.showTip(e));
    wrap.addEventListener('mouseleave', () => { this.tip.hidden = true; });
    return wrap;
  }

  // a slot: weapons (melee, ranged, cyberdeck), the backpack, or a worn place 'wear:<key>' (head, armor, implants, Mama-Bot's parts)
  slotEl(slot, label) {
    const D = this.D, inv = this.inv, w = slot.startsWith('wear:') && slot.slice(5);
    const [a, id] = w ? ['items', inv.wear?.[w]] : slot === 'backpack' ? ['backpacks', inv.backpack] : ['weapons', inv.slots[slot]];
    const t = id && thing(D, a, id), name = label || (w ? WEAR_NAMES[w] : SLOT_NAMES[slot]);
    const part = w && DRONE_WEAR.includes(w) && t?.partLook && D.assets?.[t.partLook]?.file;
    const pic = !t ? icon(w ? WEAR_ICONS[w] || (IMPLANTS.includes(w) ? 'brain' : 'item') : SLOT_ICONS[slot], 22)
      : part ? el('img', { class: 'inv-partpic', src: new URL(part, ASSET_BASE).href, alt: '' }) : el('b', {}, markOf(D, a, id, w ? 52 : 40));
    const s = el('div', { class: 'inv-slot wear' + (t ? ' full' : '') + (w && IMPLANTS.includes(w) ? ' implant' : ''), title: name, 'data-slot': slot, style: t ? `--col:${CATEGORY_COLORS[kindOf(D, a, id)]}` : '' },
      el('small', {}, name), pic, el('span', {}, t ? t.name : 'frei'));
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
  // the slots only show what is built in: rig parts are dragged onto the van in the build mode (B)
  partClick(p) { this.host.notify?.(p.id ? 'Ein- und ausbauen: Rig bauen (B)' : `${PART_SLOT_NAMES[p.slot]}: ein Rig-Teil im Bau-Modus (B) an den Van ziehen`); }

  showTip(e) {
    const D = this.D, t = thing(D, e.a, e.id) || {}, k = kindOf(D, e.a, e.id);
    const facts = [CATEGORY_NAMES[k], e.a === 'rigParts' ? `Slot: ${PART_SLOT_NAMES[t.slot] || t.slot}` : null, e.a === 'rigParts' && t.pull ? `+${t.pull} kg Zugkraft` : null,
      e.a === 'rigParts' && t.armor ? `+${t.armor} Panzerung` : null, e.a === 'rigParts' && t.storageRows ? `+${t.storageRows} Reihen Stauraum` : null,
      (e.a === 'weapons' || e.a === 'rigParts') && t.damage ? `${t.damage} Schaden` : null, e.a === 'backpacks' && t.size ? `Raster ${t.size.join(' × ')}` : null,
      t.wear ? `${DRONE_WEAR.includes(t.wear) ? 'Mama-Bot: ' : 'Platz: '}${WEAR_NAMES[t.wear] || t.wear}` : null, t.stats ? statLine(t.stats) : null, t.strain ? `Belastung ${t.strain}` : null,
      stackMax(D, e.a, e.id) > 1 ? `Stapel ${e.n}/${stackMax(D, e.a, e.id)}` : null, `${(t.value || 0) * e.n} Δ`, t.buff ? `Buff: ${D.buffs?.[t.buff]?.name || t.buff}` : null].filter(Boolean);
    this.tip.replaceChildren(el('b', {}, t.name || e.id), el('small', {}, facts.join(' · ')), t.description ? el('p', {}, t.description) : null);
    this.tip.hidden = false;
  }

  // ---------- controller (Daniel, 11.11.2026: „sinnvolle Controller-Steuerung OHNE Zeiger“) ----------
  // A cursor jumps between the cells of every grid, the slots, tabs and buttons (the nearest one in the stick's direction).
  // A = take / put down (like a click), X = turn, Y = to the other side (like a double click), B = put back or close, LB / RB = tabs.
  padTargets() {
    const out = [];
    for (const box of this.el.querySelectorAll('.inv-grid[data-key]')) {
      const key = box.dataset.key, g = this.grid(key), r = box.getBoundingClientRect();
      if (!g || !r.width) continue;
      const cw = r.width / g.w, ch = r.height / g.h;
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) out.push({ id: `cell:${key}:${x}:${y}`, key, x, y, l: r.left + x * cw, t: r.top + y * ch, w: cw, h: ch });
    }
    for (const n of this.el.querySelectorAll('.inv-slot, .inv-tab, .inv-btn')) {
      const r = n.getBoundingClientRect();
      if (!r.width) continue;
      out.push({ id: 'el:' + (n.dataset.slot || n.dataset.part || n.dataset.tab || n.className + ':' + n.textContent), node: n, l: r.left, t: r.top, w: r.width, h: r.height });
    }
    return out;
  }
  padFocus() {
    const all = this.padTargets();
    let f = all.find(t => t.id === this.focusId);
    if (!f) { f = all.find(t => t.key === 'backpack') || all[0]; this.focusId = f?.id; }
    return f;
  }
  padShow() {
    if (!this.padOn || !this.isOpen) { this.cursor.hidden = true; return; }
    const f = this.padFocus();
    if (!f) return;
    this.cursor.hidden = false;
    const box = this.cursorShape(f);
    this.cursor.classList.toggle('holding', !!this.held);
    this.mouse = [f.l + f.w / 2, f.t + f.h / 2];
    if (this.held) Object.assign(this.ghost.style, { left: `${this.mouse[0]}px`, top: `${this.mouse[1]}px` });
    const e = f.key && this.itemAt(f.key, f.x, f.y);
    if (e && !this.held) { this.showTip(e); Object.assign(this.tip.style, { left: `${box.r + 8}px`, top: `${box.t + 3}px` }); } else this.tip.hidden = true;
  }
  // the cursor frame follows the thing's shape (Daniel, 12.11.2026: „wenn ein Objekt mehr als ein Segment hat, soll der Rahmen das ganze Objekt in seiner Form umfassen“):
  // on a thing = its cells, holding something = where it would land (red if it does not fit), otherwise the one field
  cursorShape(f) {
    const g = f.key != null && this.grid(f.key), held = this.held?.e, e = g && !held && this.itemAt(f.key, f.x, f.y);
    let cells = null, ox = 0, oy = 0, bad = false;
    if (e) { cells = cellsOf(this.D, e.a, e.id, e.r || 0); ox = e.x; oy = e.y; }
    else if (g && held) {
      cells = cellsOf(this.D, held.a, held.id, held.r || 0); ox = f.x; oy = f.y;
      bad = !cells.every(([cx, cy]) => ox + cx < g.w && oy + cy < g.h) || (!fits(this.D, g, held, ox, oy) && !this.itemAt(f.key, f.x, f.y));
    }
    const c = this.cursor;
    c.classList.toggle('bad', bad);
    if (!cells || cells.length < 2 && !bad) {
      c.classList.remove('shaped'); c.replaceChildren();
      Object.assign(c.style, { left: `${f.l - 3}px`, top: `${f.t - 3}px`, width: `${f.w + 6}px`, height: `${f.h + 6}px` });
      return { r: f.l + f.w + 3, t: f.t - 3 };
    }
    const set = new Set(cells.map(([x, y]) => `${x},${y}`)), w = Math.max(...cells.map(q => q[0])) + 1, h = Math.max(...cells.map(q => q[1])) + 1;
    const P = 3, L = f.l + (ox - f.x) * f.w, T = f.t + (oy - f.y) * f.h, M = P + 2, W = w * f.w + 2 * M, H = h * f.h + 2 * M;
    // edges of every cell where the neighbour is not part of the thing → one outline around the whole shape
    let d = '';
    // outward by P; at each end: open = reach out (convex corner), straight on = 0, inner corner = stop short
    const has = (a, b) => set.has(`${a},${b}`), end = (nx, ny, ox2, oy2) => !has(nx, ny) ? P : has(nx + ox2, ny + oy2) ? -P : 0;
    for (const [x, y] of cells) {
      const x0 = M + x * f.w, y0 = M + y * f.h, x1 = x0 + f.w, y1 = y0 + f.h;
      if (!has(x, y - 1)) d += `M${x0 - end(x - 1, y, 0, -1)} ${y0 - P}H${x1 + end(x + 1, y, 0, -1)}`;
      if (!has(x, y + 1)) d += `M${x0 - end(x - 1, y, 0, 1)} ${y1 + P}H${x1 + end(x + 1, y, 0, 1)}`;
      if (!has(x - 1, y)) d += `M${x0 - P} ${y0 - end(x, y - 1, -1, 0)}V${y1 + end(x, y + 1, -1, 0)}`;
      if (!has(x + 1, y)) d += `M${x1 + P} ${y0 - end(x, y - 1, 1, 0)}V${y1 + end(x, y + 1, 1, 0)}`;
    }
    c.classList.add('shaped');
    c.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="${d}"/></svg>`;
    Object.assign(c.style, { left: `${L - M}px`, top: `${T - M}px`, width: `${W}px`, height: `${H}px` });
    return { r: L - M + W, t: T - M };
  }
  itemAt(key, x, y) {
    const g = this.grid(key);
    return g?.items.find(e => cellsOf(this.D, e.a, e.id, e.r || 0).some(([cx, cy]) => e.x + cx === x && e.y + cy === y)) || null;
  }
  padMove(dx, dy) {
    const all = this.padTargets(), f = this.padFocus();
    if (!f) return;
    const fx = f.l + f.w / 2, fy = f.t + f.h / 2;
    let best = null, score = Infinity;
    for (const t of all) {
      if (t.id === f.id) continue;
      const ex = t.l + t.w / 2 - fx, ey = t.t + t.h / 2 - fy, along = ex * dx + ey * dy, across = Math.abs(ex * dy - ey * dx);
      if (along < 4) continue;
      const sc = along + across * 2.2;
      if (sc < score) { score = sc; best = t; }
    }
    if (best) { this.focusId = best.id; this.padShow(); }
  }
  padNav(p, now = performance.now()) {
    // p = window input (ui_nav.js uiInput): the same grammar for keyboard and controller; the mouse keeps working until a key is touched
    if (!this.isOpen || (!this.padOn && !p.now.size)) return;
    this.pad = p;
    // the key that opened a chest (E) closes it again while the cursor is not in use, like the cooking window; other keys only show the cursor first
    if (!this.padOn && p.keys && p.pressed('ok') && !this.held) return this.close();
    if (!this.padOn) { this.padOn = true; this.draw(); if (p.keys) { this.padShow(); return; } }
    // directions: one step, held = repeats
    const dirs = [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]];
    this.rep ??= {};
    for (const [d, dx, dy] of dirs) {
      if (!p.down(d)) { this.rep[d] = 0; continue; }
      if (!this.rep[d]) { this.rep[d] = now + 300; this.padMove(dx, dy); }
      else if (now >= this.rep[d]) { this.rep[d] = now + 95; this.padMove(dx, dy); }
    }
    const f = this.padFocus();
    if (!f) return;
    const e = f.key != null ? this.itemAt(f.key, f.x, f.y) : null;
    if (p.pressed('ok')) {
      if (f.key != null) { if (this.held) this.place(f.key, f.x, f.y); else if (e) this.pick(f.key, this.grid(f.key), e); }
      else { f.node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); if (f.node.tagName === 'BUTTON' && f.node.classList.contains('inv-btn')) f.node.click(); }
    }
    if (p.pressed('context')) { if (this.held) this.turnHeld(); else if (e) this.turnInPlace(this.grid(f.key), e); }
    // Y / F: tap = to the other side, hold = throw it on the ground (Daniel, 12.11.2026, controller has no „click beside the window“)
    const hold = this.D.game?.gamepad?.throwHold ?? 450;
    if (p.pressed('send')) this.sendAt = now;
    if (this.sendAt != null && p.down('send') && hold > 0 && now - this.sendAt >= hold) {
      this.sendAt = null;
      if (!this.held && e && f.key != null) this.pick(f.key, this.grid(f.key), e);
      if (this.held) { this.throwDown(); this.draw(); }
    } else if (this.sendAt != null && !p.down('send')) {
      this.sendAt = null;
      if (f.key != null) { if (this.held) this.quickMoveHeld(f.key); else if (e) this.quickMove(f.key, e); }
    }
    if (p.pressed('back')) { if (this.held) this.putBack(); else return this.close(); }
    for (const [a, d] of [['prev', -1], ['next', 1]]) if (p.pressed(a)) {
      const tabs = [...this.el.querySelectorAll('.inv-tab')], i = tabs.findIndex(t => t.classList.contains('on'));
      const t = tabs[(i + d + tabs.length) % tabs.length];
      if (tabs.length > 1 && t) t.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    }
    this.padShow();
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
    if (this.padOn) { this.padOn = false; this.cursor.hidden = true; this.draw(); }   // the mouse takes over again
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
    if (!this.allows(key, h.e)) return;
    const res = drop(this.D, g, h.e, x, y);
    if (!res.ok) { this.host.notify?.('Passt da nicht hin'); return; }
    this.held = res.held ? { e: res.held, from: key } : null;
    this.changed(key);
    this.moodAfter(key, h.e);
  }
  // back where it came from, otherwise anywhere in the backpack, otherwise on the other side
  putBack() {
    const h = this.held;
    if (!h) return;
    this.held = null;
    if ((['melee', 'ranged', 'cyberdeck', 'backpack'].includes(h.from) || String(h.from).startsWith('wear:')) && this.equip(h.from, h.e, true)) return this.changed();
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
    if (!dst || !this.allows(to, e)) return;
    const left = add(this.D, dst, e.a, e.id, e.n);
    if (left === e.n) return this.host.notify?.('Kein Platz');
    if (left === 0) remove(g, e); else e.n = left;
    this.changed(to);
    this.moodAfter(to, e);
  }
  quickMoveHeld(key) {
    const h = this.held, to = this.otherSide(key), dst = to && this.grid(to);
    if (!dst || !this.allows(to, h.e)) return;
    const left = add(this.D, dst, h.e.a, h.e.id, h.e.n);
    if (left === h.e.n) return this.host.notify?.('Kein Platz');
    h.e.n = left;
    this.held = left ? h : null;
    if (left) this.putBack();
    this.changed(to);
  }
  storeAll() {
    if (this.other.accept) {   // only what this storage takes
      let n = 0;
      for (const e of [...this.inv.grids.backpack.items]) if (this.allows(this.other.key, e, false) && add(this.D, this.other.grid, e.a, e.id, e.n) === 0) { remove(this.inv.grids.backpack, e); n++; }
      this.host.notify?.(n ? `${n} ${n === 1 ? 'Sache' : 'Sachen'} eingelagert` : 'Nichts Passendes im Rucksack'); return this.changed(this.other.key);
    }
    const n = moveAll(this.D, this.inv.grids.backpack, this.other.grid); this.host.notify?.(n ? `${n} ${n === 1 ? 'Sache' : 'Sachen'} eingelagert` : 'Nichts passt mehr rein'); this.changed(this.other.key); }
  takeAll() { const n = moveAll(this.D, this.other.grid, this.inv.grids.backpack); this.host.notify?.(n ? `${n} ${n === 1 ? 'Sache' : 'Sachen'} eingepackt` : 'Rucksack ist voll'); this.changed(this.other.key); }

  // ---------- slots ----------
  slotClick(slot) {
    const inv = this.inv, h = this.held;
    if (h) {
      if (!this.equip(slot, h.e)) return;
      return this.changed();
    }
    if (slot === 'backpack') return this.host.notify?.('Den Rucksack tauschst du, indem du einen anderen draufziehst');
    if (slot.startsWith('wear:')) {
      const w = slot.slice(5), id = inv.wear?.[w];
      if (!id) return this.host.notify?.(IMPLANTS.includes(w) ? `${WEAR_NAMES[w]}: ein Implantat hierher ziehen` : `${WEAR_NAMES[w]}: frei`);
      if (IMPLANTS.includes(w) && !this.host.inCamp?.()) return this.host.notify?.('Implantate baust du nur im Camp aus');
      inv.wear[w] = null;
      this.held = { e: { a: 'items', id, n: 1, r: 0 }, from: slot };
      this.host.gearChanged?.();
      this.react('gearOff');
      return this.changed();
    }
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
    if (slot.startsWith('wear:')) return this.wear(slot.slice(5), e, quiet, say);
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
  // head, armor, implants (camp only, strain limit), Mama-Bot's parts
  wear(w, e, quiet, say) {
    const D = this.D, inv = this.inv, t = e.a === 'items' && D.items?.[e.id];
    if (!t || wearOf(D, e.id) !== w) return say(`Hier gehört ${IMPLANTS.includes(w) ? 'ein Implantat für ' : DRONE_WEAR.includes(w) ? 'ein Drohnenteil für ' : 'etwas für '}${WEAR_NAMES[w]} hin`);
    if (IMPLANTS.includes(w) && !quiet && !this.host.inCamp?.()) return say('Implantate baust du nur im Camp ein');
    const prev = inv.wear[w], max = D.leyla?.inventory?.strainMax ?? 10;
    if (IMPLANTS.includes(w) && gearStats(D, { ...inv.wear, [w]: e.id }).strain > max) return say(`Zu viel Belastung (höchstens ${max})`);
    inv.wear[w] = e.id;
    const rest = (e.n || 1) - 1;
    this.held = prev ? { e: { a: 'items', id: prev, n: 1, r: 0 }, from: 'wear:' + w } : rest > 0 ? { e: { ...e, n: rest }, from: this.held?.from } : null;
    if (prev && rest > 0) add(D, this.inv.grids.backpack, e.a, e.id, rest);
    this.host.gearChanged?.();
    if (!quiet) {
      const before = prev ? gearScore(D.items?.[prev]?.stats) : 0, after = gearScore(t.stats);
      this.react(DRONE_WEAR.includes(w) ? 'dronePart' : after < before ? 'gearWorse' : 'gearBetter');
    }
    return true;
  }

  changed(key) { this.host.changed?.(key); this.draw(); }

  // for tests and Ava: the open state
  state() {
    const g = x => x && { w: x.w, h: x.h, items: x.items.map(e => `${e.id}×${e.n}@${e.x},${e.y}${e.r ? ' r' + e.r : ''}`) };
    return { open: this.isOpen, tab: this.vanTab ? 'van' : 'leyla', pair: this.pair, parts: this.host.save().rig.parts, other: this.other && { key: this.other.key, title: this.other.title, grid: g(this.other.grid) }, backpack: g(this.inv.grids.backpack), slots: { ...this.inv.slots, backpack: this.inv.backpack }, wear: { ...this.inv.wear }, drone: g(this.inv.grids.drone), view: this.vanTab ? 'van' : this.view === 'implants' ? 'implants' : 'gear', face: this.face?.mood || 'idle', zoom: this.zoom, held: this.held && `${this.held.e.id}×${this.held.e.n}` };
  }
}
