// The action of each workshop (#013, logic in game/stations.js). A station panel sits in the right column of the workshop window
// (game/play/craft_ui.js) instead of the pot; the window stays the same: Rezeptbuch, Experimentieren, Zerlegen are tabs, the
// UI grammar is the same everywhere (cursor over the buttons, A / E / Leertaste = the focused button, B / Esc = back).
//   ui: the CraftUI   r: the recipe (or null at the drone board, the foodtruck counter, the generator)
// A panel: el() → element, tick(ms) while it runs, the first .st-btn.main gets the cursor; done(result) hands the result back.
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { markOf } from './inventory_ui.js';
import { stationConfig, bandQuality, aimQuality, meanQuality, QUALITY_NAMES, cookBonus, spicesOnHand, PART_SLOTS, partOf, partsFor, weaponMods, weaponStats, modsText,
  chipOf, chipsOnHand, boardPower, droneBonuses, CHIP_STATS, rollCustomers, serve, tuneResult } from '../stations.js';
import { stock } from '../crafting.js';
import { clockHours } from '../tank.js';

const QCLS = ['q0', 'q1', 'q2'];
const qLabel = q => ['Normal', 'Gut', 'Perfekt'][q] || 'Normal';
const btn = (label, act, { main = false, disabled = false, cls = '' } = {}) => el('button', { class: `inv-btn st-btn${main ? ' main' : ''}${cls ? ' ' + cls : ''}`, 'data-nav': '', disabled, onclick: act }, label);
const bar = (pos, bands = [], cls = '') => el('div', { class: 'st-bar ' + cls }, ...bands.map(([a, b, k]) => el('i', { class: 'st-band ' + k, style: `left:${a}%;width:${b - a}%` })), el('b', { class: 'st-needle', style: `left:${Math.max(0, Math.min(100, pos))}%` }));

// a timing grip: a needle sweeps over a mark; press near the mark = better. Used by the bench, the drone board and the ripperdoc.
class Grip {
  constructor(seconds, good, perfect, label) { this.seconds = seconds; this.good = good; this.perfect = perfect; this.label = label; this.t = 0; this.done = null; this.mark = 30 + Math.random() * 40; }
  get pos() { const p = (this.t / (this.seconds * 1000)) % 2; return (p < 1 ? p : 2 - p) * 100; }   // back and forth
  tick(ms) { if (this.done == null) this.t += ms; }
  press() { if (this.done == null) this.done = aimQuality(this.pos - this.mark, this.good, this.perfect); return this.done; }
  el() {
    return el('div', { class: 'st-grip' }, el('small', {}, this.label),
      bar(this.pos, [[this.mark - this.good, this.mark + this.good, 'good'], [this.mark - this.perfect, this.mark + this.perfect, 'perfect']], this.done != null ? QCLS[this.done] : ''));
  }
}

// ---------- 🍳 Kochen: in die Pfanne, Würzen, Gar-Balken ----------
export class CookPanel {
  constructor(ui, r) { this.ui = ui; this.r = r; this.C = stationConfig(ui.D).cook; this.phase = 'in'; this.added = 0; this.spiced = null; this.t = 0; this.q = null; }
  get D() { return this.ui.D; }
  get ings() { return (this.r.ingredients || []).flatMap(i => Array(i.count || 1).fill(i.item)); }
  title() { return this.r.name || this.r.id; }
  pos() { return Math.min(100, this.t / (this.C.seconds * 1000) * 100); }
  tick(ms) {
    if (this.phase !== 'cook') return false;
    this.t += ms;
    if (this.pos() >= 100) { this.takeOff(); return true; }   // nobody pressed: off the heat at the end, normal result (1a)
    return true;
  }
  addNext() { if (this.added < this.ings.length) this.added++; if (this.added >= this.ings.length) this.phase = spicesOnHand(this.D, this.ui.save).length ? 'spice' : 'cook'; this.ui.draw(); }
  allIn() { this.added = this.ings.length; this.phase = spicesOnHand(this.D, this.ui.save).length ? 'spice' : 'cook'; this.ui.draw(); }
  spice(id) { this.spiced = id; this.phase = 'cook'; this.ui.draw(); }
  takeOff() {
    if (this.phase !== 'cook') return;
    this.q = bandQuality(this.pos(), this.C.good, this.C.perfect); this.phase = 'done';
    this.ui.finishStation({ q: this.q, spice: this.spiced, bonus: cookBonus(this.D, this.q, !!this.spiced) });
  }
  el() {
    const D = this.D, pan = el('div', { class: 'st-pan' + (this.phase === 'cook' ? ' hot' : '') }, ...this.ings.slice(0, this.added).map((id, i) => el('span', { class: 'st-ing', style: `--i:${i}` }, markOf(D, 'items', id, 30))),
      this.spiced ? el('span', { class: 'st-ing spice' }, markOf(D, 'items', this.spiced, 22)) : null);
    let body;
    if (this.phase === 'in') body = [el('p', {}, `Zutat ${this.added + 1} von ${this.ings.length}: `, el('b', {}, D.items?.[this.ings[this.added]]?.name || '')),
      el('div', { class: 'st-row' }, btn('Rein damit', () => this.addNext(), { main: true }), btn('Alles rein', () => this.allIn()))];
    else if (this.phase === 'spice') body = [el('p', {}, 'Noch würzen? Gibt etwas mehr Wirkung (verbraucht eins).'),
      el('div', { class: 'st-row' }, btn('Ohne Gewürz', () => this.spice(null), { main: true }), ...spicesOnHand(D, this.ui.save).map(id => btn(D.items[id].name || id, () => this.spice(id))))];
    else body = [el('p', {}, this.phase === 'done' ? `${qLabel(this.q)}!` : 'Gar-Balken: im grünen Bereich rausnehmen, im goldenen ist es perfekt.'),
      bar(this.pos(), [[this.C.good[0], this.C.good[1], 'good'], [this.C.perfect[0], this.C.perfect[1], 'perfect']], 'cook'),
      el('div', { class: 'st-row' }, btn('Rausnehmen', () => this.takeOff(), { main: true, disabled: this.phase !== 'cook' }))];
    return el('div', { class: 'st-panel st-cook' }, el('header', {}, icon('target', 16), el('b', {}, `Am Herd: ${this.title()}`)), pan, ...body);
  }
}

// ---------- 🔧 Werkbank: Bauplan + Teile, dann Handgriffe ----------
export class BenchPanel {
  constructor(ui, r) {
    this.ui = ui; this.r = r; this.C = stationConfig(ui.D).bench; this.phase = 'parts'; this.qs = []; this.grip = null;
    this.slots = (r.slots || []).map(s => ({ ...s, part: null }));
    this.weapon = r.weapon && ui.D.weapons?.[r.weapon];
    if (!this.slots.length) this.startGrips();
  }
  get D() { return this.ui.D; }
  parts() { return this.slots.map(s => s.part).filter(Boolean); }
  // choose the next part for a slot (cycles through what is on hand, then empty)
  cycle(i, dir = 1) {
    const s = this.slots[i], used = this.parts(), st = stock(this.D, this.ui.save);
    const list = [null, ...partsFor(this.D, this.ui.save, s.slot, this.weapon?.kind).filter(id => id === s.part || (st[id] || 0) > used.filter(u => u === id).length)];
    s.part = list[(list.indexOf(s.part) + dir + list.length) % list.length];
    this.ui.draw();
  }
  ready() { return this.slots.every(s => !s.required || s.part); }
  startGrips() { this.phase = 'grip'; this.qs = []; this.grip = new Grip(this.C.seconds, this.C.good, this.C.perfect, this.gripName(0)); this.ui.draw?.(); }
  gripName(i) { return ['Schrauben', 'Schweißen', 'Feilen', 'Justieren'][i % 4]; }
  tick(ms) { if (this.phase !== 'grip' || !this.grip) return false; this.grip.tick(ms); return true; }
  press() {
    if (this.phase !== 'grip') return;
    this.qs.push(this.grip.press());
    const steps = this.slots.length ? this.C.steps : 1;
    if (this.qs.length >= steps) { this.phase = 'done'; const q = meanQuality(this.qs); return this.ui.finishStation({ q, parts: this.parts(), mods: this.weapon ? weaponMods(this.D, this.parts(), q) : null }); }
    this.grip = new Grip(this.C.seconds, this.C.good, this.C.perfect, this.gripName(this.qs.length));
    this.ui.draw();
  }
  el() {
    const D = this.D, nm = this.r.name || this.r.id, head = el('header', {}, icon('workbench', 16), el('b', {}, /^Bauplan/.test(nm) ? nm : this.slots.length ? `Bauplan: ${nm}` : nm));
    if (this.phase === 'parts') {
      const mods = weaponMods(D, this.parts(), 0), rows = this.weapon ? weaponStats(this.weapon, mods) : [];
      return el('div', { class: 'st-panel st-bench' }, head,
        el('div', { class: 'st-blueprint' }, ...this.slots.map((s, i) => {
          const p = s.part && D.items?.[s.part];
          return el('div', { class: 'st-slot' + (s.part ? ' full' : '') + (s.required && !s.part ? ' need' : '') },
            el('small', {}, (PART_SLOTS.find(x => x[0] === s.slot)?.[1] || s.slot) + (s.required ? ' *' : '')),
            btn('◀', () => this.cycle(i, -1), { cls: 'ghost st-arrow' }),
            el('span', { class: 'st-part', onclick: () => this.cycle(i, 1) }, p ? markOf(D, 'items', s.part, 26) : el('i', {}, 'leer'), el('b', {}, p ? p.name : 'frei')),
            btn('▶', () => this.cycle(i, 1), { cls: 'ghost st-arrow' }));
        })),
        rows.length ? el('table', { class: 'st-stats' }, ...rows.map(x => el('tr', { class: x.now === x.base ? '' : x.better ? 'up' : 'down' }, el('td', {}, x.label), el('td', {}, String(x.base)), el('td', {}, '→'), el('td', {}, el('b', {}, String(x.now)))))) : null,
        el('div', { class: 'st-row' }, btn('Zusammenbauen', () => this.startGrips(), { main: true, disabled: !this.ready() }), el('small', {}, this.ready() ? 'Teile frei wählen, die Werte ändern sich sofort' : '* braucht ein Teil')));
    }
    return el('div', { class: 'st-panel st-bench' }, head, el('p', {}, `Handgriff ${Math.min(this.qs.length + 1, this.slots.length ? this.C.steps : 1)}: im Ziel drücken (grün gut, gold perfekt). Daneben ist auch in Ordnung.`),
      this.grip?.el(), el('div', { class: 'st-row' }, btn(this.grip?.label || 'Los', () => this.press(), { main: true, disabled: this.phase !== 'grip' })),
      this.qs.length ? el('p', { class: 'st-qs' }, ...this.qs.map(q => el('span', { class: 'st-q ' + QCLS[q] }, qLabel(q)))) : null);
  }
}

// ---------- 💉 Ripperdoc: ruhige Hand ----------
export class SurgeryPanel {
  constructor(ui, r) { this.ui = ui; this.r = r; this.C = stationConfig(ui.D).surgery; this.grip = new Grip(this.C.seconds, this.C.good, this.C.perfect, 'Schnitt'); this.done = false; }
  tick(ms) { if (this.done) return false; this.grip.tick(ms); return true; }
  press() { if (this.done) return; this.done = true; this.ui.finishStation({ q: this.grip.press() }); }
  el() {
    return el('div', { class: 'st-panel st-surgery' }, el('header', {}, icon('heart', 16), el('b', {}, `OP: ${this.r.name || this.r.id}`)),
      el('p', {}, 'Ruhige Hand. Je genauer der Schnitt, desto besser wirkt das Implantat. Die Nachteile bleiben, wie sie sind.'),
      el('div', { class: 'st-op' }, el('i', { class: 'st-pulse' }), this.grip.el()), el('div', { class: 'st-row' }, btn('Schneiden', () => this.press(), { main: true, disabled: this.done })));
  }
}

// ---------- 🤖 Drohnenwerkstatt: Platine ----------
export class DronePanel {
  constructor(ui) { this.ui = ui; this.C = stationConfig(ui.D).drone; this.chips = []; this.phase = 'board'; this.qs = []; this.grip = null; }
  get D() { return this.ui.D; }
  add(id) {
    const st = stock(this.D, this.ui.save), have = (st[id] || 0) - this.chips.filter(c => c.id === id).length;
    if (have <= 0 || this.chips.length >= this.C.slots) return;
    if (boardPower(this.D, [...this.chips, { id }]).used > this.C.power) { this.ui.drone?.('gearWorse'); return this.ui.say('error', 'Zu viel Energie für AvAs Platine'); }
    this.chips.push({ id }); this.ui.drone?.('curious'); this.ui.draw();
  }
  removeAt(i) { this.chips.splice(i, 1); this.ui.draw(); }
  wire() { this.phase = 'wire'; this.qs = []; this.grip = new Grip(1.4, 20, 8, 'Kabel 1'); this.ui.draw(); }
  tick(ms) { if (this.phase !== 'wire') return false; this.grip.tick(ms); return true; }
  press() {
    if (this.phase !== 'wire') return;
    this.qs.push(this.grip.press());
    if (this.qs.length >= this.chips.length) { this.phase = 'done'; return this.ui.finishStation({ chips: this.chips.map((c, i) => ({ id: c.id, q: this.qs[i] })) }); }
    this.grip = new Grip(1.4, 20, 8, `Kabel ${this.qs.length + 1}`); this.ui.draw();
  }
  el() {
    const D = this.D, p = boardPower(D, this.chips), now = droneBonuses(D, this.ui.save), have = chipsOnHand(D, this.ui.save);
    const head = el('header', {}, icon('rakete', 16), el('b', {}, 'AvAs Platine'), el('small', {}, `Energie ${p.used}/${p.max}`));
    const slots = el('div', { class: 'st-board' }, ...Array.from({ length: this.C.slots }, (_, i) => {
      const c = this.chips[i], x = c && chipOf(D, c.id);
      return el('div', { class: 'st-chip' + (c ? ' full' : '') + (this.phase === 'wire' && i < this.qs.length ? ' ' + QCLS[this.qs[i]] : ''), onclick: () => this.phase === 'board' && c && this.removeAt(i) },
        c ? markOf(D, 'items', c.id, 28) : el('i', {}, '+'), el('small', {}, c ? `${CHIP_STATS.find(s => s[0] === x.stat)?.[1] || x.stat} +${x.value}` : 'frei'));
    }));
    const cur = Object.entries(now).map(([k, v]) => `${CHIP_STATS.find(s => s[0] === k)?.[1] || k} +${v}`).join(' · ');
    if (this.phase === 'board') return el('div', { class: 'st-panel st-drone' }, head, el('div', { class: 'st-pbar' }, el('i', { style: `width:${Math.min(100, p.used / p.max * 100)}%` })), slots,
      el('p', { class: 'st-now' }, cur ? `Jetzt: ${cur}` : 'Noch keine Platine. Chips aus Rucksack, Kiste und Lager stecken.'),
      el('div', { class: 'st-row wrap' }, ...have.map(id => btn(`${D.items[id].name} (${chipOf(D, id).power} ⚡)`, () => this.add(id)))),
      el('div', { class: 'st-row' }, btn('Verkabeln', () => this.wire(), { main: true, disabled: !this.chips.length }), el('small', {}, 'Die alte Platine wird ersetzt, gesteckte Chips verbaut')));
    return el('div', { class: 'st-panel st-drone' }, head, slots, el('p', {}, 'Kabel ziehen: im Ziel drücken. Saubere Lötstellen geben mehr.'), this.grip?.el(),
      el('div', { class: 'st-row' }, btn('Löten', () => this.press(), { main: true, disabled: this.phase !== 'wire' })));
  }
}

// ---------- 🚚 Foodtruck: Kunden an der Theke ----------
export class TruckPanel {
  constructor(ui) { this.ui = ui; this.C = stationConfig(ui.D).truck; this.queue = rollCustomers(ui.D, ui.save); this.t = 0; this.since = 0; this.earned = 0; this.tips = 0; this.served = 0; }
  get D() { return this.ui.D; }
  tick(ms) { if (!this.queue.length) return false; this.t += ms; this.since += ms; return true; }
  serveFirst() {
    const c = this.queue[0]; if (!c) return;
    const r = serve(this.D, this.ui.save, c, this.since / 1000);
    if (!r.ok) { this.queue.shift(); this.since = 0; this.ui.say('miss', `${c.name} geht leer aus: ${this.D.items[c.want]?.name || c.want} ist aus`); return; }
    this.earned += r.deltas; this.tips += r.tip; this.served++; this.queue.shift(); this.since = 0;
    this.ui.drone?.('happy');
    if (!this.queue.length) return this.ui.finishStation({ sold: this.served, deltas: this.earned, tips: this.tips });
    this.ui.draw();
  }
  sellAll() {   // no hurry: everyone gets their dish, no tip
    for (const c of this.queue) { const st = stock(this.D, this.ui.save); if (!(st[c.want] > 0)) continue; const r = serve(this.D, this.ui.save, c, 1e9); if (r.ok) { this.earned += r.deltas; this.served++; } }
    this.queue = []; this.ui.finishStation({ sold: this.served, deltas: this.earned, tips: this.tips });
  }
  el() {
    const D = this.D, head = el('header', {}, icon('shop', 16), el('b', {}, 'An der Theke'), el('small', {}, `${this.earned} Δ · Trinkgeld ${this.tips} Δ`));
    if (!this.queue.length) return el('div', { class: 'st-panel st-truck' }, head, el('p', {}, this.served ? 'Alle satt.' : 'Keine Gerichte da. Erst kochen, dann verkaufen.'));
    const c = this.queue[0], left = Math.max(0, 1 - this.since / 1000 / c.patience);
    return el('div', { class: 'st-panel st-truck' }, head,
      el('div', { class: 'st-queue' }, ...this.queue.map((x, i) => el('div', { class: 'st-cust' + (i === 0 ? ' now' : '') }, el('b', {}, x.name), el('span', {}, markOf(D, 'items', x.want, 24), ' ', D.items[x.want]?.name || x.want), x.favourite ? el('small', { class: 'st-fav' }, '♥ Lieblingsgericht') : null))),
      el('div', { class: 'st-pbar patience' }, el('i', { style: `width:${left * 100}%` })),
      el('p', {}, left > 0.5 ? 'Schnell serviert gibt Trinkgeld.' : 'Ohne Eile, normaler Preis.'),
      el('div', { class: 'st-row' }, btn(`Servieren: ${D.items[c.want]?.name || c.want}`, () => this.serveFirst(), { main: true }), btn('Ohne Eile alle bedienen', () => this.sellAll())));
  }
}

// ---------- ⚡ Generator / Reaktor: Regler und Lastanzeige ----------
export class PowerPanel {
  constructor(ui) { this.ui = ui; this.C = stationConfig(ui.D).power; this.load = 50; this.vel = 0; this.t = 0; this.inBand = 0; this.on = false; this.done = false; this.knob = 0; }
  tick(ms) {
    if (!this.on || this.done) return false;
    const k = ms / 1000; this.t += ms;
    this.vel += (Math.random() - 0.5) * this.C.drift * 4 * k; this.vel *= 0.96;
    this.load = Math.max(0, Math.min(100, this.load + (this.vel + this.knob * 22) * k));
    if (this.load >= this.C.band[0] && this.load <= this.C.band[1]) this.inBand += ms;
    if (this.t >= this.C.seconds * 1000) { this.done = true; this.ui.finishStation({ share: this.inBand / this.t }); }
    return true;
  }
  turn(d) { this.knob = Math.max(-1, Math.min(1, d)); this.on = true; }
  el() {
    const left = Math.max(0, this.C.seconds - this.t / 1000);
    return el('div', { class: 'st-panel st-power' }, el('header', {}, icon('flash', 16), el('b', {}, 'Regler'), el('small', {}, this.on ? `${left.toFixed(1)} s` : '')),
      el('p', {}, 'Halte die Last im grünen Bereich: das gibt eine Weile etwas Extra-Strom. Daneben flackert nur das Licht.'),
      bar(this.load, [[this.C.band[0], this.C.band[1], 'good']], 'power' + (this.load < this.C.band[0] || this.load > this.C.band[1] ? ' flicker' : '')),
      el('div', { class: 'st-row' }, btn('◀ weniger', () => this.turn(-1), { cls: 'ghost' }), btn(this.on ? 'Halten' : 'Anwerfen', () => this.turn(0), { main: true }), btn('mehr ▶', () => this.turn(1), { cls: 'ghost' })));
  }
}

// which panel a workshop function has: for a recipe (kitchen, foodtruck kitchen, craft, cyber) or on its own (drone, foodtruck, power)
export const RECIPE_PANELS = { kitchen: CookPanel, foodtruck: CookPanel, craft: BenchPanel, cyber: SurgeryPanel };
export const OWN_PANELS = { drone: DronePanel, foodtruck: TruckPanel, power: PowerPanel };
export { tuneResult, clockHours, QUALITY_NAMES, modsText };
