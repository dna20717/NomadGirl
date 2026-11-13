// Boden-Leiste (Daniel, 12.11.2026: „am unteren Bildschirmrand den Boden schematisiert darstellen, Items immer dort anzeigen, wenn Leyla
// in der Nähe ist, um nichts zu übersehen“; „das Grid soll zu den Rändern hin ausfaden und ein wenig zur Cyberware-Ansicht von Leylas
// Inventar passen“). A thin scan grid at the bottom of the screen: what lies on the ground in reach, nearest first. The first thing
// carries the golden frame; E / stick ↑ picks it up (scene.floorPick), I opens the whole ground inventory.
import { el } from '../ui.js';
import { thing, add, stackMax, addEntry } from '../inventory.js';
import { artOf, glyphOf, kindOf, CATEGORY_COLORS } from './inventory_ui.js';

export class FloorStrip {
  constructor(root, D) {
    this.D = D; this.sig = null;
    this.el = el('div', { class: 'floor-strip', hidden: true });
    root.append(this.el);
  }
  get S() { return this.D.leyla?.inventory?.floorStrip || {}; }

  // things in reach: { pile, e, d } sorted by distance, then by their place in the bundle
  things(scene) {
    const loot = scene.loot, l = scene.leyla;
    if (!loot || !l) return [];
    const out = [];
    for (const p of loot.piles) {
      const d = Math.hypot(p.x - l.x, (p.feet - l.feet) * 1.5);
      if (d > loot.range) continue;
      for (const e of p.grid.items) out.push({ pile: p, e, d });
    }
    return out.sort((a, b) => a.d - b.d || a.e.y - b.e.y || a.e.x - b.e.x);
  }

  update(scene) {
    const h = scene.hud, S = this.S;
    const off = S.enabled === false || !scene.leyla?.alive || h.inv?.isOpen || h.craft?.isOpen || h.tech?.isOpen || h.map?.isOpen || h.build?.active || h.modal || h.paused;
    const list = off ? [] : this.things(scene).slice(0, S.max ?? 8);
    this.list = list;
    const sig = list.map(t => `${t.e.id}×${t.e.n}`).join(',');
    if (sig === this.sig) return;
    this.sig = sig;
    this.el.hidden = !list.length;
    if (!list.length) return;
    const D = this.D, cell = S.cell ?? 56, slots = Math.max(list.length, S.slots ?? 7);
    const cells = [], lead = Math.floor((slots - list.length) / 2);   // the things sit in the middle, empty cells fade out on both sides
    for (let j = 0; j < slots; j++) {
      const i = j - lead, t = i >= 0 ? list[i] : null;
      if (!t) { cells.push(el('i', { class: 'fs-cell empty' })); continue; }
      const k = kindOf(D, t.e.a, t.e.id), art = artOf(D, t.e.a, t.e.id, Math.round(cell * 0.78));
      cells.push(el('i', { class: 'fs-cell' + (i === 0 ? ' first' : ''), style: `--col:${CATEGORY_COLORS[k] || '#555'}` },
        art || el('b', {}, glyphOf(D, t.e.a, t.e.id)), t.e.n > 1 ? el('span', {}, String(t.e.n)) : null));
    }
    const first = thing(D, list[0].e.a, list[0].e.id);
    this.el.style.setProperty('--fs-cell', `${cell}px`);
    this.el.style.setProperty('--fs-fade', `${S.fade ?? 22}%`);
    this.el.replaceChildren(el('div', { class: 'fs-grid' }, ...cells), el('small', { class: 'fs-label' }, `Boden · ${first?.name || list[0].e.id}`));
  }

  // E / stick ↑: the first thing into the backpack (all of it if it fits), what does not fit stays
  pick(scene) {
    const t = this.list?.[0];
    if (!t || !scene.box) return false;
    const D = this.D, bag = scene.box.save.inv.grids.backpack, l = scene.leyla, name = thing(D, t.e.a, t.e.id)?.name || t.e.id;
    const left = addEntry(D, bag, t.e, t.e.n);
    if (left === t.e.n) { scene.hud.toast('Rucksack voll', '', 'warn', 2600); scene.drone?.react?.('gearWorse'); return true; }
    const got = t.e.n - left;
    t.e.n = left;
    if (!left) t.pile.grid.items.splice(t.pile.grid.items.indexOf(t.e), 1);
    scene.fx.text(l.x, l.feet - l.height - 20, `+${got > 1 || stackMax(D, t.e.a, t.e.id) > 1 ? got + ' ' : ''}${name}`, { color: '#9be8d8', size: 34, rise: 60, life: 900 });
    scene.invChanged?.('floor');
    scene.loot.sync();
    this.sig = null;
    return true;
  }
  // text for the prompt line, or null
  prompt() {
    const t = this.list?.[0];
    if (!t) return null;
    const n = this.list.length, name = thing(this.D, t.e.a, t.e.id)?.name || t.e.id;
    return `Aufheben: ${name}${n > 1 ? ` · I: alles am Boden (${n})` : ''}`;
  }
}
