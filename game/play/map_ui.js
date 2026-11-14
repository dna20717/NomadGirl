// The travel map window (#007, Daniel, 13.11.2026: „kein Menü mehr, sondern eine Art Werkbank-Screen mit einer Karte und den nächsten
// Zielen, die zur Wahl stehen“). Opens at the warroom and at the van door. Left the map (game/map_render.js), right the chosen place:
// kind, danger, loot hints, cost of the drive, and the action (Hinfahren, Hier plündern). One UI grammar (ui_nav.js):
// stick / arrows pick a place in that direction, ok = the action, back = close; mouse: hover / click a place, click the button.
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { hints } from './ui_nav.js';
import { ensureMap, placeOf, neighbours, hops, mapConfig, threatOf } from '../worldmap.js';
import { drawMap } from '../map_render.js';
import { ITEM_CATEGORIES, optionLabel as optLabel } from '../../engine/schema.js';

const KIND_NAMES = { gasStation: 'Tankstelle', mall: 'Markt', bunker: 'Bunker', government: 'Behörde' };
const HINT_COLORS = { valuable: '#f9a31b', blueprint: '#249fde', implant: '#20d6c7', ingredient: '#59c135', food: '#9cdb43', resource: '#c7b08b', component: '#8b93af', consumable: '#e86a73', armor: '#6d758d', weapon: '#df3e23', dronepart: '#bc4a9b' };
const de = n => String(n).replace('.', ',');

export class MapUI {
  // host: { D, save(), base (URL of the project), cost(id) → { km, hours, fuel, food }, blocked(cost) → reason | null,
  //         drive(id, cost), plunder(), extras() → [{ label, icon, act }], closed() }
  constructor(root, host) {
    this.root = root; this.host = host; this.sel = null; this.t0 = performance.now(); this.places = {};
    this.el = el('div', { class: 'wm', hidden: true, oncontextmenu: e => e.preventDefault() });
    root.append(this.el);
    this.imgs = {};
    document.addEventListener('keydown', e => { if (this.isOpen && e.key === 'Escape') { this.close(); e.preventDefault(); e.stopPropagation(); } }, true);
  }
  get D() { return this.host.D; }
  get save() { return this.host.save(); }
  get map() { return ensureMap(this.D, this.save); }
  get isOpen() { return !this.el.hidden; }
  get intel() { return this.host.intel?.() ?? true; }

  image(id) {
    const A = this.D.assets?.[id];
    if (!A?.file) return null;
    if (!this.imgs[id]) { const i = new Image(); i.onload = () => this.paint(); i.src = new URL(A.file, this.host.base).href; this.imgs[id] = i; }
    return this.imgs[id].complete && this.imgs[id].naturalWidth ? this.imgs[id] : null;
  }
  open(opts = {}) {
    this.opts = opts; this.el.hidden = false;
    const near = neighbours(this.map, this.save.location);
    // #016: a place you can plunder is chosen first, so „Hier plündern“ is one press away
    const hereN = placeOf(this.D, this.save, this.save.location), canPlunder = !!(hereN?.poi && this.D.pois?.[hereN.poi]);
    this.sel = opts.sel || (this.sel && (this.sel === this.save.location || near.includes(this.sel)) ? this.sel : canPlunder ? this.save.location : near[0] || this.save.location);
    this.draw();
    cancelAnimationFrame(this.raf); const loop = () => { if (!this.isOpen) return; this.paint(); this.raf = requestAnimationFrame(loop); }; loop();
  }
  close() { if (this.el.hidden) return; this.el.hidden = true; cancelAnimationFrame(this.raf); this.host.closed?.(); }

  // the places worth choosing: where she is, the neighbours, every other known place (to look at)
  choices() {
    const m = this.map, here = this.save.location, hop = hops(m, here), reveal = mapConfig(this.D).reveal;
    return m.nodes.filter(n => n.id === here || m.visited.includes(n.id) || (hop[n.id] ?? 99) <= reveal).map(n => n.id);
  }
  select(id) { if (id && id !== this.sel) { this.sel = id; this.detail(); this.paint(); } }
  move(dx, dy) {
    const P = this.places, c = P[this.sel];
    if (!c) return;
    let best = null, bd = Infinity;
    for (const id of this.choices()) {
      const p = P[id]; if (!p || id === this.sel) continue;
      const x = p.x - c.x, y = p.y - c.y, along = x * dx + y * dy, side = Math.abs(x * dy) + Math.abs(y * dx);
      if (along <= 4) continue;
      const score = along + side * 2.2 + (p.near ? -30 : 0);
      if (score < bd) { bd = score; best = id; }
    }
    this.select(best);
  }
  // controller / keyboard (scene.padMenus → nav)
  nav(ui) {
    for (const [d, dx, dy] of [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]]) if (ui.pressed(d)) return this.move(dx, dy);
    if (ui.pressed('ok')) this.act();
    if (ui.pressed('next')) this.cycle(1);
    if (ui.pressed('prev')) this.cycle(-1);
  }
  // LB / RB: only the places she can drive to (and where she is)
  cycle(d) { const L = [this.save.location, ...neighbours(this.map, this.save.location)], i = L.indexOf(this.sel); this.select(L[(i + d + L.length) % L.length]); }
  // the action for the chosen place: plunder here, drive to a neighbour
  action() {
    const save = this.save, id = this.sel, n = placeOf(this.D, save, id);
    if (!n) return null;
    if (id === save.location) return n.poi && this.D.pois?.[n.poi] ? { label: 'Hier plündern', icon: 'target', act: () => { this.close(); this.host.plunder(); } } : null;
    // #014: also further away, over several legs along known roads (Zwischenfälle unterwegs)
    const cost = this.host.cost(id);
    if (!cost || cost.route?.[cost.route.length - 1] !== id || (cost.route.length > 2 && !cost.legs?.length)) return { label: 'Kein Weg bekannt', disabled: 'Keine bekannte Straße dorthin' };
    const legs = cost.legs?.length || 1, why = this.host.blocked(cost);
    return { label: legs > 1 ? `Hinfahren · ${legs} Etappen` : 'Hinfahren', icon: 'tracks', cost, disabled: why, act: () => { this.close(); this.host.drive(id, cost); } };
  }
  act() { const a = this.action(); if (a && !a.disabled) a.act(); }
  // the way to the chosen place (several legs, #014), cached per place for the painting
  routeTo(id) { if (!id || id === this.save.location) return null; if (this.routeFor !== id + '@' + this.save.location) { this.routeFor = id + '@' + this.save.location; this.routeIds = this.host.cost(id)?.route || null; } return this.routeIds; }

  draw() {
    const save = this.save;
    this.canvas = el('canvas', { class: 'wm-map', onmousemove: e => this.hover(e), onclick: e => { this.hover(e); if (this.places[this.sel]) this.act(); } });
    const extras = (this.opts?.extras || []).map(x => el('button', { class: 'inv-btn ghost', onclick: () => { this.close(); x.act(); } }, x.icon ? icon(x.icon, 16) : null, ' ', x.label));
    this.aside = el('aside', { class: 'wm-detail' });
    this.el.replaceChildren(el('div', { class: 'wm-box ui-frame' },
      el('header', {}, icon('map', 22), el('h2', {}, 'Reisekarte'), el('small', {}, `Sprit ${de(save.fuel)} l · Vorräte ${de(save.food)}`),
        ...extras, el('button', { class: 'craft-x', title: 'Schließen (Esc)', onclick: () => this.close() }, '×')),
      el('div', { class: 'wm-main' }, el('div', { class: 'wm-paper' }, this.canvas), this.aside),
      hints([['move', 'Ort wählen'], ['ok', 'hinfahren / plündern'], ['tabs', 'nächstes Ziel'], ['back', 'schließen']], 'Maus: zeigen · Klick: hinfahren')));
    this.detail();
    requestAnimationFrame(() => this.paint());
  }
  paint() {
    const c = this.canvas; if (!c || !this.isOpen) return;
    const r = c.parentElement.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const W = Math.max(200, Math.floor(r.width)), H = Math.max(120, Math.floor(r.height));
    if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px'; }
    const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const M = mapConfig(this.D), res = drawMap(ctx, W, H, this.D, this.map, { paper: this.image(M.paper), logos: this.image(M.logos), here: this.save.location, sel: this.sel, route: this.routeTo(this.sel), t: (performance.now() - this.t0) / 1000, hideDanger: !this.intel });
    this.places = res.places;
  }
  hover(e) {
    const r = this.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, ok = new Set(this.choices());
    let best = null, bd = Infinity;
    for (const [id, p] of Object.entries(this.places)) { const d = Math.hypot(p.x - x, p.y - y); if (ok.has(id) && d < p.r * 1.3 && d < bd) { bd = d; best = id; } }
    this.canvas.style.cursor = best ? 'pointer' : 'default';
    if (best) this.select(best);
  }
  detail() {
    const D = this.D, save = this.save, n = placeOf(D, save, this.sel), C = mapConfig(D);
    if (!n) { this.aside.replaceChildren(el('p', {}, 'Wähle einen Ort.')); return; }
    const P = D.pois?.[n.poi] || {}, b = C.brands.find(x => x.id === n.brand), here = n.id === save.location, a = this.action();
    const logo = b && this.D.assets?.[C.logos]?.file ? el('span', { class: 'wm-logo', style: `background-image:url("${new URL(D.assets[C.logos].file, this.host.base).href}");background-position:${(b.icon % 4) * -64}px ${Math.floor(b.icon / 4) * -64}px` }) : null;
    const cost = a?.cost;
    this.aside.replaceChildren(...[
      el('div', { class: 'wm-head' }, logo, el('div', {}, el('h3', {}, n.name), el('small', {}, [KIND_NAMES[P.kind] || P.name, n.region, P.size ? `Größe ${P.size}` : null].filter(Boolean).join(' · ')))),
      here ? el('p', { class: 'wm-here' }, icon('tracks', 14), ' Du bist hier.') : null,
      el('div', { class: 'wm-row' }, el('small', {}, 'Gefahr'), this.intel ? el('b', { class: 'wm-danger' }, '●'.repeat(n.danger || 1) + '○'.repeat(Math.max(0, 5 - (n.danger || 1)))) : el('b', { class: 'wm-unknown' }, '? ? ?')),
      this.intel && (n.danger || 1) > 1 ? (() => { const T = threatOf(this.host.D, n.danger); return el('p', { class: 'wm-threat' }, `Gegner +${Math.round(T.more * 100)} % · zäher +${Math.round((T.health - 1) * 100)} % · Beute +${Math.round(T.loot)} %`); })() : null,
      el('div', { class: 'wm-row' }, el('small', {}, 'Beute'), this.intel ? el('div', { class: 'wm-hints' }, ...(n.hints || []).map(h => el('span', { style: `--c:${HINT_COLORS[h] || '#c7b08b'}` }, optLabel(ITEM_CATEGORIES, h) || h))) : el('b', { class: 'wm-unknown' }, '? ? ?')),
      this.intel ? null : el('p', { class: 'wm-intel' }, icon('research', 14), ' Was dort wartet, zeigt erst ein Warroom. Bau einen ins Rig (B), dann siehst du Gefahr und Beute.'),
      b ? el('p', { class: 'wm-brand' }, `${b.name}: „${b.slogan}“`) : null,
      // the POI's own text only at the landmark itself; rolled places say what kind of place it is
      el('p', { class: 'wm-desc' }, n.landmark && P.description ? P.description : `Wie ${P.name || 'ein POI'}, nur ${n.danger > (P.danger || 1) ? 'weiter draußen und gefährlicher' : 'ein anderer Ort'}. Was genau dort liegt, weiß man erst drinnen.`),
      cost ? el('div', { class: 'wm-cost' }, ...[['Strecke', `${cost.km} km${(cost.legs?.length || 1) > 1 ? ` · ${cost.legs.length} Etappen` : ''}`], ['Fahrt', `${de(cost.hours)} h`], ['Sprit', `${de(cost.fuel)} l`, cost.fuel > save.fuel], ['Vorräte', de(cost.food), cost.food > save.food]]
        .map(([k, v, bad]) => el('div', { class: bad ? 'bad' : '' }, el('small', {}, k), el('b', {}, v)))) : null,
      here && a && !a.disabled ? this.readyBox() : null,
      a ? el('button', { class: 'inv-btn wm-go', disabled: !!a.disabled, title: a.disabled || '', onclick: () => this.act() }, a.icon ? icon(a.icon, 18) : null, ' ', a.disabled && a.cost ? a.disabled : a.label) : null,
      a?.disabled && !a.cost ? el('small', { class: 'wm-why' }, a.disabled) : null].filter(Boolean));   // replaceChildren would write "null"
  }
  // Loadout-Check (#016): what Leyla takes into the run, warnings in amber
  readyBox() {
    const rows = this.host.loadout?.() || [];
    if (!rows.length) return null;
    return el('div', { class: 'wm-ready' }, el('small', {}, 'Bereit?'), ...rows.map(r => el('div', { class: 'wm-ready-row' + (r.warn ? (r.soft ? ' soft' : ' warn') : '') }, icon(r.icon, 14), el('span', {}, r.label), el('b', {}, r.value))));
  }
  state() {
    const m = this.map;
    return { open: this.isOpen, intel: this.intel, extras: (this.opts?.extras || []).map(x => x.label), here: this.save.location, sel: this.sel, nodes: m.nodes.length, edges: m.edges.length, near: neighbours(m, this.save.location), action: this.action()?.label || null, disabled: this.action()?.disabled || null, ready: this.sel === this.save.location ? (this.host.loadout?.() || []).map(r => r.label + (r.warn ? '!' : '')) : [] };
  }
}
