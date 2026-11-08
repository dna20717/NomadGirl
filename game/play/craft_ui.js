// Cooking and crafting at a workshop in the camp (Camp step 3): recipe book on the left, the pot for experimenting on the right.
// Logic in game/crafting.js, values in "Kochen & Craften" and "Rezepte". Mouse (and Esc), the game waits while it is open.
//   Rezeptbuch: known recipes of this kind of workshop with what is on hand (green) or missing (red), "Kochen"/"Herstellen" makes one;
//               notes in the camp inventories can be read (recipe learnt), companions in the camp give hints for unknown ones.
//   Experimentieren: click supplies to put one into the pot (right click or click in the pot takes one out), "Ausprobieren" tries it.
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { CATEGORY_COLORS, glyphOf } from './inventory_ui.js';
import { recipesFor, known, missing, stock, craft, experiment, readable, read, tips, functionOf } from '../crafting.js';
import { clockText } from '../save.js';

const VERBS = { kitchen: ['Kochen', 'Kochnische'], foodtruck: ['Kochen', 'Foodtruck'], craft: ['Herstellen', 'Werkbank'] };
// order of the supplies: what fits the workshop first
const FIRST = { kitchen: ['ingredient', 'food'], foodtruck: ['ingredient', 'food'], craft: ['resource', 'junk', 'component'] };
const fill = (t, name) => (t || '').replace('{name}', name);

export class CraftUI {
  // host: { D, save(), changed(result), leftover(id, n), notify(text) }
  constructor(root, host) {
    this.root = root; this.host = host;
    this.el = el('div', { class: 'craft', hidden: true, oncontextmenu: e => e.preventDefault() });
    this.tip = el('div', { class: 'inv-tip', hidden: true });
    root.append(this.el, this.tip);
    this.pot = {};
    this.log = null;   // { kind: 'hit' | 'learnt' | 'miss' | 'near' | 'read' | 'error', text, who?, line? }
    document.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      if (e.key === 'Escape' || e.key === 'e' || e.key === 'E' || e.key === 'Tab' || e.key === 'i' || e.key === 'I') { this.close(); e.preventDefault(); e.stopPropagation(); }
    }, true);
    document.addEventListener('mousemove', ev => { if (!this.tip.hidden) Object.assign(this.tip.style, { left: `${ev.clientX + 16}px`, top: `${ev.clientY + 16}px` }); });
  }
  get D() { return this.host.D; }
  get save() { return this.host.save(); }
  get isOpen() { return !this.el.hidden; }

  open(ws) { this.ws = ws; this.pot = {}; this.log = null; this.el.hidden = false; this.draw(); }
  close() { this.el.hidden = true; this.tip.hidden = true; this.pot = {}; this.host.closed?.(); }

  verb() { return VERBS[functionOf(this.D, this.ws)]?.[0] || 'Herstellen'; }

  draw() {
    if (!this.isOpen) return;
    const D = this.D, save = this.save, def = D.workshops?.[this.ws] || {};
    this.el.replaceChildren(el('div', { class: 'craft-box' },
      el('header', {}, icon('workbench', 20), el('h2', {}, def.name || this.ws),
        el('small', {}, clockText(save)), el('button', { class: 'craft-x', title: 'Schließen (Esc)', onclick: () => this.close() }, '×')),
      el('div', { class: 'craft-cols' }, this.bookEl(), this.potEl()),
      this.logEl(),
      el('p', { class: 'inv-help' }, 'Vorräte anklicken: in den Topf · Rechtsklick oder Klick im Topf: wieder raus · Zutaten kommen aus Lager, Kiste und Rucksack · Esc oder E: schließen')));
  }

  // ---------- recipe book ----------
  bookEl() {
    const D = this.D, save = this.save, all = recipesFor(D, this.ws), mine = all.filter(r => known(save, r.id)), verb = this.verb();
    const cards = mine.map(r => {
      const miss = missing(D, save, r), st = stock(D, save);
      return el('div', { class: 'craft-recipe' + (miss.length ? ' missing' : '') },
        el('div', { class: 'craft-rtop' }, (r.part ? this.partChip(r.part, r.count || 1) : this.chip(r.result, r.count || 1, { big: true })), el('b', {}, r.name || (r.part ? D.rigParts?.[r.part]?.name : D.items?.[r.result]?.name) || r.id), el('small', {}, `${r.time ?? 10} min`)),
        el('div', { class: 'craft-ings' }, ...(r.ingredients || []).map(i => {
          const n = st[i.item] || 0, need = i.count || 1;
          return el('span', { class: 'craft-ing ' + (n >= need ? 'ok' : 'no') }, `${glyphOf(D, 'items', i.item)} ${D.items?.[i.item]?.name || i.item} ${Math.min(n, 99)}/${need}`);
        })),
        el('button', { class: 'inv-btn', disabled: !!miss.length, title: miss.length ? 'Es fehlen: ' + miss.map(m => `${m.need - m.have}× ${D.items?.[m.item]?.name || m.item}`).join(', ') : '', onclick: () => this.make(r.id) }, verb));
    });
    const notes = readable(D, save).filter(x => all.some(r => r.id === x.recipe)).map(x => el('div', { class: 'craft-note' },
      this.chip(x.item, 1), el('span', {}, el('b', {}, D.items[x.item].name || x.item), el('small', {}, D.items[x.item].description || 'Da steht was drauf.')),
      el('button', { class: 'inv-btn ghost', onclick: () => this.readNote(x.item) }, 'Lesen')));
    const hints = tips(D, save, this.ws).map(t => el('div', { class: 'craft-tip' }, el('b', {}, '???'), el('span', {}, el('i', {}, t.who + ': '), `„${t.hint}“`)));
    const unknown = all.length - mine.length;
    return el('section', { class: 'inv-panel craft-book' },
      el('header', {}, icon('list', 16), el('b', {}, 'Rezeptbuch'), el('small', {}, `${mine.length}/${all.length}`)),
      el('div', { class: 'craft-list' }, ...(cards.length ? cards : [el('p', { class: 'craft-empty' }, 'Noch keine Rezepte. Probier rechts was aus!')]), ...notes, ...hints,
        unknown > hints.length ? el('p', { class: 'craft-empty' }, `${unknown} ${unknown === 1 ? 'Rezept wartet' : 'Rezepte warten'} noch auf dich. Experimentieren, Zettel finden, Companions fragen.`) : null));
  }

  // ---------- experimenting ----------
  potEl() {
    const D = this.D, C = D.crafting || {}, st = stock(D, this.save), slots = C.slots ?? 4, fn = functionOf(D, this.ws);
    const ids = Object.keys(this.pot).filter(k => this.pot[k] > 0);
    const potSlots = [...Array(slots).keys()].map(i => {
      const id = ids[i];
      if (!id) return el('div', { class: 'craft-slot' }, el('small', {}, `Zutat ${i + 1}`));
      const s = el('div', { class: 'craft-slot full', style: `--col:${CATEGORY_COLORS[D.items?.[id]?.category] || '#555'}`, onmousedown: ev => { ev.preventDefault(); this.takeOut(id, ev.shiftKey ? this.pot[id] : 1); } },
        el('b', {}, glyphOf(D, 'items', id)), el('span', {}, D.items?.[id]?.name || id), el('i', {}, `×${this.pot[id]}`));
      this.hover(s, id);
      return s;
    });
    const order = FIRST[fn] || [];
    const rank = id => { const k = order.indexOf(D.items?.[id]?.category); return k < 0 ? 9 : k; };
    const supplies = Object.keys(st).filter(id => D.items?.[id]).sort((a, b) => rank(a) - rank(b) || (D.items[a].name || a).localeCompare(D.items[b].name || b, 'de'));
    const any = ids.length > 0;
    return el('section', { class: 'inv-panel craft-pot' },
      el('header', {}, icon('research', 16), el('b', {}, 'Experimentieren'), el('small', {}, `${C.experimentMinutes ?? 20} min`)),
      el('div', { class: 'craft-slots', style: `grid-template-columns:repeat(${Math.min(slots, 4)}, 1fr)` }, ...potSlots),
      el('div', { class: 'inv-actions' },
        el('button', { class: 'inv-btn craft-try', disabled: !any, onclick: () => this.tryPot() }, 'Ausprobieren'),
        el('button', { class: 'inv-btn ghost', disabled: !any, onclick: () => { this.pot = {}; this.draw(); } }, 'Topf leeren')),
      el('h3', {}, 'Vorräte'),
      el('div', { class: 'craft-supplies' }, ...(supplies.length ? supplies.map(id => {
        const left = st[id] - (this.pot[id] || 0);
        const c = el('button', { class: 'craft-supply' + (left <= 0 ? ' used' : ''), style: `--col:${CATEGORY_COLORS[D.items[id].category] || '#555'}`,
          onmousedown: ev => { ev.preventDefault(); if (ev.button === 2 || ev.ctrlKey) this.takeOut(id, 1); else if (ev.button === 0) this.putIn(id, ev.shiftKey ? left : 1); } },
          el('b', {}, glyphOf(D, 'items', id)), el('span', {}, D.items[id].name || id), el('i', {}, String(left)));
        this.hover(c, id);
        return c;
      }) : [el('p', { class: 'craft-empty' }, 'Nichts da. Erst plündern, dann kochen.')])));
  }
  putIn(id, n = 1) {
    const st = stock(this.D, this.save), slots = this.D.crafting?.slots ?? 4, ids = Object.keys(this.pot).filter(k => this.pot[k] > 0);
    if (!this.pot[id] && ids.length >= slots) return this.say('error', 'Der Topf ist voll');
    const k = Math.min(n, (st[id] || 0) - (this.pot[id] || 0));
    if (k <= 0) return this.say('error', 'Mehr ist nicht da');
    this.pot[id] = (this.pot[id] || 0) + k;
    this.draw();
  }
  takeOut(id, n = 1) {
    if (!this.pot[id]) return;
    this.pot[id] -= n;
    if (this.pot[id] <= 0) delete this.pot[id];
    this.draw();
  }

  // ---------- actions ----------
  make(id) {
    const D = this.D, r = craft(D, this.save, id, this.ws);
    if (!r.ok) return this.say('error', r.reason);
    this.after(r, 'hit', fill(D.crafting?.texts?.hit || '{name} ist fertig!', `${r.made.n > 1 ? r.made.n + '× ' : ''}${this.madeName(r.made)}`) + (r.made.part ? ' · liegt auf dem Schrottplatz, einbauen mit B' : ''));
  }
  madeName(m) { return (m.part ? this.D.rigParts?.[m.id]?.name : this.D.items?.[m.id]?.name) || m.id; }
  tryPot() {
    const D = this.D, T = D.crafting?.texts || {}, pot = { ...this.pot }, r = experiment(D, this.save, this.ws, pot);
    if (!r.ok) return this.say('error', r.reason);
    this.pot = {};   // tried: the pot is empty again (a hit only used what the recipe needs, the rest is back in the supplies)
    if (r.hit) {
      const name = D.recipes[r.recipe]?.name || r.recipe;
      this.after(r, r.learnt ? 'learnt' : 'hit', r.learnt ? fill(T.learnt || 'Neues Rezept: {name}', name) : fill(T.hit || '{name} ist fertig!', this.madeName(r.made)) + (r.made.part ? ' · liegt auf dem Schrottplatz, einbauen mit B' : ''));
    } else {
      const junk = r.made ? D.items[r.made.id]?.name || r.made.id : 'nichts';
      this.after(r, r.near ? 'near' : 'miss', `${r.near ? (T.near || 'Knapp daneben!') + ' ' : ''}${fill(T.miss || 'Daneben. Heraus kommt: {name}', junk)}`);
    }
  }
  readNote(item) {
    const D = this.D, rid = read(D, this.save, item);
    if (!rid) return this.say('error', 'Da steht nichts Brauchbares');
    this.after({ minutes: 0 }, 'read', fill(D.crafting?.texts?.read || 'Gelesen und gemerkt: {name}', D.recipes[rid]?.name || rid));
  }
  // after an action: leftovers go on the ground, a companion of this workshop comments, the savegame is written
  after(r, kind, text) {
    if (r.left > 0) { this.host.leftover?.(r.made.id, r.left); text += ` (${r.left} ${r.left === 1 ? 'liegt' : 'liegen'} am Boden, kein Platz)`; }
    const line = this.companionLine(kind === 'miss' || kind === 'near' ? 'miss' : kind === 'read' ? null : 'hit');
    this.log = { kind, text, minutes: r.minutes, ...line };
    this.host.changed?.(r);
    this.draw();
  }
  companionLine(which) {
    if (!which) return {};
    const D = this.D, mates = (this.save.companions || []).map(id => D.companions?.[id]).filter(c => c?.workshops?.includes(this.ws) && c.craftLines?.[which]?.length);
    if (!mates.length) return {};
    const c = mates[Math.floor(Math.random() * mates.length)], lines = c.craftLines[which];
    return { who: c.name, line: lines[Math.floor(Math.random() * lines.length)], color: c.color };
  }
  say(kind, text) { this.log = { kind, text }; this.draw(); }

  logEl() {
    const L = this.log;
    if (!L) return el('div', { class: 'craft-log idle' }, 'Rezepte kochen, oder einfach mal was zusammenwerfen. Was soll schon passieren?');
    return el('div', { class: 'craft-log ' + L.kind },
      el('b', {}, L.text), L.minutes ? el('small', {}, ` · ${L.minutes} min vergangen`) : null,
      L.who ? el('p', {}, el('i', { style: L.color ? `color:${L.color}` : '' }, L.who + ': '), `„${L.line}“`) : null);
  }

  // small coloured placeholder of a thing (until things have a look)
  chip(id, n = 1, { big = false } = {}) {
    const D = this.D, c = el('span', { class: 'craft-chip' + (big ? ' big' : ''), style: `--col:${CATEGORY_COLORS[D.items?.[id]?.category] || '#555'}` }, glyphOf(D, 'items', id), n > 1 ? el('i', {}, String(n)) : null);
    this.hover(c, id);
    return c;
  }
  // a rig part as a result: it goes onto the scrapyard, not into a bag
  partChip(id, n = 1) {
    const D = this.D, t = D.rigParts?.[id] || {}, c = el('span', { class: 'craft-chip big', style: `--col:${t.color || CATEGORY_COLORS.rigpart}` }, t.glyph || '⚙', n > 1 ? el('i', {}, String(n)) : null);
    c.addEventListener('mouseenter', () => { this.tip.replaceChildren(el('b', {}, t.name || id), el('small', {}, `Rig-Teil · ${t.value || 0} Δ · landet auf dem Schrottplatz`), t.description ? el('p', {}, t.description) : null); this.tip.hidden = false; });
    c.addEventListener('mouseleave', () => { this.tip.hidden = true; });
    return c;
  }
  hover(node, id) {
    node.addEventListener('mouseenter', () => {
      const t = this.D.items?.[id] || {}, b = this.D.buffs?.[t.buff];
      this.tip.replaceChildren(el('b', {}, t.name || id), el('small', {}, [`${t.value || 0} Δ`, b ? `Buff: ${b.name || t.buff}` : null].filter(Boolean).join(' · ')), t.description ? el('p', {}, t.description) : null);
      this.tip.hidden = false;
    });
    node.addEventListener('mouseleave', () => { this.tip.hidden = true; });
  }

  // for tests and Ava
  state() {
    if (!this.isOpen) return { open: false };
    const D = this.D, save = this.save;
    return { open: true, workshop: this.ws, pot: { ...this.pot }, log: this.log && { ...this.log },
      book: recipesFor(D, this.ws).filter(r => known(save, r.id)).map(r => ({ id: r.id, ready: !missing(D, save, r).length })),
      notes: readable(D, save).map(x => x.item), tips: tips(D, save, this.ws).map(t => t.recipe), stock: stock(D, save) };
  }
}
