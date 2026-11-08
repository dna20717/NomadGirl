// Build view of the rig (Camp step 4): B in the camp or Warroom › Rig umbauen. Logic in game/rig.js, values in "Rig-Bau".
// The rig as a strip like in the camp (last container on the left, the tractor on the right), places as cells:
//   click a workshop → it is in your hand, click free places → it goes there, click "Lager" → into the store.
//   Buying puts things into the store, containers are hung on at the left end. Budgets on top, "Fertig bauen" writes it all
//   (Δ, time, storage contents move along), "Abbrechen" or Esc forgets the draft. The game waits while it is open.
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { budgets, startDraft, lift, place, fits, toSpare, fromSpare, buyWorkshop, sellWorkshop, buyContainer, sellContainer, attach, detach, shift, problems, applyDraft, shop, placesOf, priceOf, sellPrice, storeFull, wsDef } from '../rig.js';
import { clockText } from '../save.js';

const FN_COLORS = { storage: '#5c6b7a', cooling: '#4a7a9a', cell: '#5a4a4a', sleep: '#6a5a9a', chill: '#9a4a7a', drone: '#3a8a6a', warroom: '#7a6a3a', kitchen: '#a8642a', foodtruck: '#c0703a', craft: '#7a6235', engine: '#5a5a5a', power: '#a8862a' };
const FN_NAMES = { storage: 'Lager', cooling: 'Kühlung', cell: 'Zelle', sleep: 'Schlafen', chill: 'Chillen', drone: 'Drohnen', warroom: 'Planung', kitchen: 'Kochen', foodtruck: 'Verkauf', craft: 'Herstellen', engine: 'Motor', power: 'Energie' };
const de = n => n.toLocaleString('de-DE');

export class BuildUI {
  // host: { D, save(), apply(result), closed() }
  constructor(root, host) {
    this.root = root; this.host = host;
    this.el = el('div', { class: 'build', hidden: true, oncontextmenu: e => e.preventDefault() });
    root.append(this.el);
    document.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') { if (this.held) this.drop(); else this.close(); e.preventDefault(); e.stopPropagation(); }
      else if (['b', 'B', 'e', 'E', 'Tab', 'i', 'I'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); if (e.key === 'b' || e.key === 'B') this.close(); }
    }, true);
  }
  get D() { return this.host.D; }
  get isOpen() { return !this.el.hidden; }

  open() { this.d = startDraft(this.D, this.host.save()); this.held = null; this.msg = null; this.el.hidden = false; this.draw(); }
  close() { this.el.hidden = true; this.d = null; this.held = null; this.host.closed?.(); }
  say(text, kind = 'error') { this.msg = { text, kind }; this.draw(); }
  // the hand goes back into the store
  drop() { if (this.held) toSpare(this.d, this.held); this.held = null; this.draw(); }

  draw() {
    if (!this.isOpen) return;
    const D = this.D, d = this.d, b = budgets(D, d.rig), bad = problems(D, d), save = this.host.save();
    const bar = (label, val, max, text, over, ic) => el('div', { class: 'build-budget' + (over ? ' over' : '') }, icon(ic, 16),
      el('span', {}, el('small', {}, label), el('b', {}, text)), max != null ? el('i', { style: `--k:${Math.min(1, max ? val / max : 1)}` }) : null);
    this.el.replaceChildren(el('div', { class: 'build-box' },
      el('header', {}, icon('build', 20), el('h2', {}, 'Rig umbauen'), el('small', {}, `${clockText(save)}${d.minutes ? ` · +${d.minutes} min` : ''}`),
        el('b', { class: 'build-deltas' }, `${de(d.deltas)} Δ`), el('button', { class: 'craft-x', title: 'Abbrechen (Esc)', onclick: () => this.close() }, '×')),
      el('div', { class: 'build-budgets' },
        bar('Gewicht', b.weight, b.pull, `${de(b.weight)} / ${de(b.pull)} kg`, b.heavy, 'scale'),
        bar('Container', b.length, b.maxLength, `${b.length} / ${b.maxLength}`, b.length > b.maxLength, 'box'),
        bar('Energie', b.power.used, b.power.made, `${b.power.net >= 0 ? '+' : ''}${b.power.net} ⚡ (${b.power.made} da, ${b.power.used} gebraucht)`, b.power.net < 0, 'flash'),
        bar('Verbrauch', 0, null, `${de(b.fuel)} l / 100 km`, false, 'drop'),
        bar('Plätze', b.filled, b.places, `${b.filled} / ${b.places} belegt`, false, 'grid')),
      this.rigEl(),
      el('div', { class: 'build-cols' }, this.spareEl(), this.shopEl()),
      el('footer', {},
        el('div', { class: 'build-msg ' + (this.msg?.kind || (bad.length ? 'error' : 'idle')) },
          this.held ? `In der Hand: ${wsDef(D, this.held.id).name || this.held.id}. Klick auf freie Plätze, Esc legt sie ins Lager.` : this.msg?.text || bad[0] || (b.heavy ? 'Achtung: zu schwer zum Fahren.' : b.power.net < 0 ? 'Achtung: zu wenig Energie, Werkstätten mit − arbeiten nicht.' : 'Werkstatt anklicken, dann einen freien Platz.')),
        el('button', { class: 'inv-btn ghost', onclick: () => this.close() }, 'Abbrechen'),
        el('button', { class: 'inv-btn build-go', disabled: !!bad.length || !!this.held || !d.changes, onclick: () => this.finish() }, d.changes ? `Fertig bauen${d.minutes ? ` (${d.minutes} min)` : ''}` : 'Nichts geändert'))));
  }

  // the rig strip: containers from the end (left) to the tractor (right), like in the camp
  rigEl() {
    const D = this.D, d = this.d, U = d.rig.units;
    const cards = U.map((u, ui) => {
      const def = u.kind === 'tractor' ? D.tractors?.[u.id] || {} : D.containers?.[u.id] || {}, n = placesOf(D, u);
      const cells = el('div', { class: 'build-cells', style: `grid-template-columns:repeat(${Math.max(1, n)}, 1fr)` });
      for (let p = 0; p < n; p++) {
        const w = u.workshops.find(x => x.at === p);
        if (w) cells.append(this.wsEl(w, ui));
        else if (!u.workshops.some(x => p > x.at && p < x.at + (wsDef(D, x.id).places || 1))) {
          const ok = this.held && fits(D, d.rig, ui, p, this.held.id);
          cells.append(el('button', { class: 'build-free' + (ok ? ' ok' : this.held ? ' no' : ''), onclick: () => this.putAt(ui, p) }, this.held ? (ok ? 'Hierhin' : '–') : 'frei'));
        }
      }
      const tools = u.kind === 'container' ? el('div', { class: 'build-tools' },
        el('button', { title: 'Weiter nach hinten', disabled: ui === U.length - 1, onclick: () => this.run(shift(D, d, ui, 1)) }, '◀'),
        el('button', { title: 'Weiter nach vorn', disabled: ui === 1, onclick: () => this.run(shift(D, d, ui, -1)) }, '▶'),
        el('button', { title: 'Abhängen (ins Lager)', onclick: () => this.run(detach(D, d, ui)) }, 'Abhängen')) : null;
      return el('div', { class: 'build-unit' + (u.kind === 'tractor' ? ' tractor' : ''), style: `flex:${Math.max(1, n)}` },
        el('div', { class: 'build-utop' }, el('b', {}, def.name || u.id), el('small', {}, u.kind === 'tractor' ? `${de(def.pull || 0)} kg Zugkraft · +${def.power || 0} ⚡` : `${de(def.weight || 0)} kg`), tools),
        cells);
    }).reverse();
    return el('div', { class: 'build-rig' }, ...cards);
  }
  wsEl(w, ui) {
    const D = this.D, def = wsDef(D, w.id), p = def.power || 0, full = storeFull(this.d, w);
    return el('button', { class: 'build-ws', style: `grid-column:span ${def.places || 1};--col:${FN_COLORS[def.function] || '#555'}`, title: def.description || '',
      onclick: () => this.pick(ui, w.at) },
      el('b', {}, def.name || w.id), el('small', {}, [FN_NAMES[def.function], p ? `${p > 0 ? '+' : ''}${p} ⚡` : null, full ? 'voll' : null].filter(Boolean).join(' · ')));
  }

  // the store: bought or removed workshops and containers
  spareEl() {
    const D = this.D, d = this.d, S = d.rig.spare;
    const ws = S.workshops.map(w => {
      const def = wsDef(D, w.id);
      return el('div', { class: 'build-row' }, el('span', { class: 'build-dot', style: `--col:${FN_COLORS[def.function] || '#555'}` }),
        el('span', {}, el('b', {}, def.name || w.id), el('small', {}, `${def.places || 1} ${def.places > 1 ? 'Plätze' : 'Platz'} · ${def.power > 0 ? '+' : ''}${def.power || 0} ⚡`)),
        el('button', { class: 'inv-btn', onclick: () => { if (this.held) toSpare(d, this.held); this.held = fromSpare(d, w.uid); this.msg = null; this.draw(); } }, 'Einbauen'),
        el('button', { class: 'inv-btn ghost', disabled: storeFull(d, w), onclick: () => this.run(sellWorkshop(D, d, w.uid), `Verkauft: +${sellPrice(D, 'workshops', w.id)} Δ`) }, `+${sellPrice(D, 'workshops', w.id)} Δ`));
    });
    const cs = S.containers.map((id, i) => el('div', { class: 'build-row' }, icon('box', 16),
      el('span', {}, el('b', {}, D.containers?.[id]?.name || id), el('small', {}, `${D.containers?.[id]?.places || 1} Plätze · ${de(D.containers?.[id]?.weight || 0)} kg`)),
      el('button', { class: 'inv-btn', onclick: () => this.run(attach(D, d, i)) }, 'Anhängen'),
      el('button', { class: 'inv-btn ghost', onclick: () => this.run(sellContainer(D, d, i), `Verkauft: +${sellPrice(D, 'containers', id)} Δ`) }, `+${sellPrice(D, 'containers', id)} Δ`)));
    const box = el('section', { class: 'inv-panel build-spare' + (this.held ? ' drop' : ''), onclick: e => { if (this.held && !e.target.closest('button')) this.drop(); } },
      el('header', {}, icon('folder', 16), el('b', {}, 'Lager'), el('small', {}, this.held ? 'hier ablegen' : '')),
      el('div', { class: 'build-list' }, ...(ws.length || cs.length ? [...ws, ...cs] : [el('p', { class: 'craft-empty' }, 'Leer. Werkstätten aus dem Rig landen hier, Gekauftes auch.')])));
    return box;
  }
  shopEl() {
    const D = this.D, d = this.d, S = shop(D);
    const row = (area, id) => {
      const x = D[area][id], price = priceOf(D, area, id), poor = price > d.deltas;
      const sub = area === 'workshops' ? `${FN_NAMES[x.function] || ''} · ${x.places || 1} ${x.places > 1 ? 'Plätze' : 'Platz'} · ${x.power > 0 ? '+' : ''}${x.power || 0} ⚡` : `${x.places || 1} Plätze · ${de(x.weight || 0)} kg`;
      return el('div', { class: 'build-row', title: x.description || '' }, area === 'workshops' ? el('span', { class: 'build-dot', style: `--col:${FN_COLORS[x.function] || '#555'}` }) : icon('box', 16),
        el('span', {}, el('b', {}, x.name || id), el('small', {}, sub)),
        el('button', { class: 'inv-btn', disabled: poor, title: poor ? 'Zu wenig Δ' : '', onclick: () => this.run(area === 'workshops' ? buyWorkshop(D, d, id) : buyContainer(D, d, id), `Gekauft: ${x.name || id} (liegt im Lager)`) }, `${de(price)} Δ`));
    };
    return el('section', { class: 'inv-panel build-shop' },
      el('header', {}, icon('shop', 16), el('b', {}, 'Kaufen'), el('small', {}, 'kommt ins Lager')),
      el('div', { class: 'build-list' }, el('h3', {}, 'Werkstätten'), ...S.workshops.map(id => row('workshops', id)), el('h3', {}, 'Container'), ...S.containers.map(id => row('containers', id))));
  }

  // ---------- actions ----------
  run(r, okText = null) { if (!r?.ok) return this.say(r?.reason || 'Geht nicht'); this.msg = okText ? { text: okText, kind: 'ok' } : null; this.draw(); }
  pick(ui, p) {
    if (this.held) {   // swap: the held one goes where the clicked one was, the clicked one is in the hand
      const there = lift(this.D, this.d, ui, p);
      if (place(this.D, this.d, this.held, ui, there.at)) { this.held = there; this.msg = null; }
      else { place(this.D, this.d, there, ui, there.at, { free: true }); this.msg = { text: 'Passt da nicht zum Tauschen', kind: 'error' }; }
      return this.draw();
    }
    this.held = lift(this.D, this.d, ui, p);
    this.msg = null;
    this.draw();
  }
  // swap: the held one goes where the clicked one was (if it fits), the clicked one is in the hand
  putAt(ui, p, quiet = false) {
    if (!this.held) return false;
    if (!place(this.D, this.d, this.held, ui, p)) { if (!quiet) this.say('Passt da nicht hin'); return false; }
    this.held = null; this.msg = null;
    if (!quiet) this.draw();
    return true;
  }
  finish() {
    const save = this.host.save(), r = applyDraft(this.D, save, this.d);
    if (!r.ok) return this.say(r.reason);
    this.el.hidden = true; this.d = null;
    this.host.apply?.(r);
  }

  state() {
    if (!this.isOpen) return { open: false };
    const D = this.D, d = this.d;
    return { open: true, deltas: d.deltas, minutes: d.minutes, held: this.held?.id || null, budgets: budgets(D, d.rig), problems: problems(D, d),
      rig: d.rig.units.map(u => `${u.id}[${u.workshops.map(w => `${w.id}@${w.at}`).join(' ')}]`).join(' '), spare: { workshops: d.rig.spare.workshops.map(w => w.id), containers: [...d.rig.spare.containers] }, msg: this.msg?.text || null };
  }
}
