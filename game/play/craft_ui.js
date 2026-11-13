// Cooking and crafting at a workshop in the camp (Camp step 3): recipe book on the left, the pot for experimenting on the right.
// Logic in game/crafting.js, values in "Kochen & Craften" and "Rezepte". Mouse (and Esc), the game waits while it is open.
//   Rezeptbuch: known recipes of this kind of workshop with what is on hand (green) or missing (red), "Kochen"/"Herstellen" makes one;
//               notes in the camp inventories can be read (recipe learnt), companions in the camp give hints for unknown ones.
//   Experimentieren: click supplies to put one into the pot (right click or click in the pot takes one out), "Ausprobieren" tries it.
import { madeOnce } from '../achievements.js';
import { el } from '../ui.js';
import { hints, NavCursor } from './ui_nav.js';
import { icon } from '../icons.js';
import { CATEGORY_COLORS, markOf } from './inventory_ui.js';
import { recipesFor, known, missing, stock, craft, experiment, readable, read, tips, functionOf, salvageable, salvage } from '../crafting.js';
import { clockText } from '../save.js';
import { phase, canMaintain, update as tankUpdate, clockHours } from '../tank.js';
import { RECIPE_PANELS, OWN_PANELS } from './station_ui.js';
import { installBoard, noteSurgery, tuneResult, modsText, droneBonuses, CHIP_STATS } from '../stations.js';
import { take } from '../crafting.js';

const VERBS = { kitchen: ['Kochen', 'Kochnische'], foodtruck: ['Kochen', 'Foodtruck'], craft: ['Bauen', 'Werkbank'], cyber: ['Operieren', 'Ripperdoc'], tank: ['Warten', 'Cryo-Tank'], warroom: ['Auswerten', 'Warroom'], drone: ['Platine', 'Drohnenwerkstatt'], power: ['Regeln', 'Generator'] };
const QNAMES = ['', 'gut', 'perfekt'];
// where things can be taken apart (Gegenstände › Zerlegen): the functions with a „Zerlegen“ tab
const SALVAGE = ['craft', 'kitchen', 'warroom'];
// order of the supplies: what fits the workshop first
const FIRST = { kitchen: ['ingredient', 'food'], foodtruck: ['ingredient', 'food'], craft: ['resource', 'junk', 'component'], tank: ['component', 'resource'] };
const fill = (t, name) => (t || '').replace('{name}', name);

export class CraftUI {
  // host: { D, save(), changed(result), leftover(id, n), notify(text) }
  constructor(root, host) {
    this.root = root; this.host = host;
    this.el = el('div', { class: 'craft', hidden: true, oncontextmenu: e => e.preventDefault() });
    this.tip = el('div', { class: 'inv-tip', hidden: true });
    root.append(this.el, this.tip);
    this.pot = {};
    this.cursor = new NavCursor(this.el, '.craft-recipe .inv-btn, .craft-supply');
    this.log = null;   // { kind: 'hit' | 'learnt' | 'miss' | 'near' | 'read' | 'error', text, who?, line? }
    document.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      // a workshop's action is running (#013): Leertaste / Enter / E = its main button, arrows turn the regulator, Esc = back to the book
      if (this.station && !this.station.finished) {
        const k = e.key;
        if (k === ' ' || k === 'Enter' || ((k === 'e' || k === 'E') && !this.cursor.on)) { this.mainPress(); e.preventDefault(); e.stopPropagation(); return; }
        if ((k === 'ArrowLeft' || k === 'ArrowRight') && this.station.turn) { this.station.turn(k === 'ArrowLeft' ? -1 : 1); e.preventDefault(); e.stopPropagation(); return; }
        if (k === 'Escape' && !this.stationOnly) { this.stopStation(); e.preventDefault(); e.stopPropagation(); return; }
      }
      // one grammar (ui_nav.js): Esc = back; E is „ok“ once the cursor is in use, before that it closes like it opened
      const ek = (e.key === 'e' || e.key === 'E') && !this.cursor.on;
      if (e.key === 'Escape' || ek || e.key === 'Tab' || e.key === 'i' || e.key === 'I') { this.close(); e.preventDefault(); e.stopPropagation(); }
    }, true);
    document.addEventListener('mousemove', ev => { if (!this.tip.hidden) Object.assign(this.tip.style, { left: `${ev.clientX + 16}px`, top: `${ev.clientY + 16}px` }); });
  }
  get D() { return this.host.D; }
  get save() { return this.host.save(); }
  get isOpen() { return !this.el.hidden; }

  // mode: 'pot' (experimenting) or 'salvage' (taking things apart); the warroom only has the salvage side
  open(ws, mode = null) {
    this.ws = ws; this.cursor.i = -1; this.pot = {}; this.log = null; this.station = null; this.stationOnly = false;
    const fn = functionOf(this.D, ws);
    this.only = fn === 'warroom'; this.mode = this.only ? 'salvage' : mode || 'pot'; this.el.hidden = false;
    // workshops whose action needs no recipe (#013): AvA's board, the regulator; the foodtruck opens at its counter
    if (OWN_PANELS[fn] && (fn !== 'foodtruck' || mode !== 'pot')) { this.stationOnly = fn !== 'foodtruck'; this.startStation(new OWN_PANELS[fn](this), null); return; }
    this.draw();
  }
  // ---------- the workshop's action (#013, game/play/station_ui.js) ----------
  startStation(panel, r) {
    this.station = panel; this.stationRecipe = r; this.cursor.i = -1; this.cursor.start = '.st-btn.main';
    this.draw(); this.focusMain();
    cancelAnimationFrame(this.raf); let last = performance.now();
    const loop = now => { if (!this.isOpen || this.station !== panel) return; const dt = Math.min(100, now - last); last = now; if (!this.manual && panel.tick?.(dt)) this.refreshStation(); this.raf = requestAnimationFrame(loop); };   // manual: tests step by hand
    this.raf = requestAnimationFrame(loop);
  }
  // the time of the panels: steps by hand for tests (nomad, scripts), the same as the frame loop
  stepStation(ms) { if (this.station?.tick?.(ms)) this.refreshStation(); }
  focusMain() { const T = this.cursor.targets(), k = T.findIndex(n => n.matches('.st-btn.main')); if (k >= 0) { this.cursor.i = k; if (this.cursor.on) this.cursor.show(); } }
  refreshStation() { const old = this.el.querySelector('.st-panel'); if (old && this.station) { const n = this.station.el(); old.replaceWith(n); if (this.cursor.on) this.cursor.show(); } }
  mainPress() { const b = this.el.querySelector('.st-btn.main:not([disabled])'); if (b) b.click(); }
  stopStation() { cancelAnimationFrame(this.raf); this.station = null; this.stationRecipe = null; this.cursor.start = null; if (this.stationOnly) return this.close(); this.draw(); }
  drone(mood) { this.host.react?.(mood); }
  // a panel is through: make the thing with its quality, or put AvA's board in, sell, tune
  finishStation(res) {
    const D = this.D, save = this.save, p = this.station, r = this.stationRecipe, fn = functionOf(D, this.ws);
    p.finished = true; cancelAnimationFrame(this.raf);
    if (r) {
      let q = res.q || 0;
      if (res.spice) { take(D, save, res.spice, 1); q = Math.min(2, q + 1); }   // spice: one step better
      if (fn === 'cyber' && r.result) noteSurgery(save, r.result, q);
      const out = craft(D, save, r.id, this.ws, { q, mods: res.mods || null, parts: res.parts || [] });
      this.station = null; this.stationRecipe = null; this.cursor.start = null;
      if (!out.ok) return this.say('error', out.reason);
      const qn = QNAMES[q], extra = out.made.mods ? ` (${modsText(out.made.mods) || 'Grundwerte'})` : fn === 'cyber' && q ? ` · Implantat wirkt +${D.crafting?.stations?.surgery?.bonus?.[q] ?? [0, 10, 20][q]} %` : '';
      return this.after(out, 'hit', `${this.madeName(out.made)}${qn ? ` · ${qn}` : ''} ist fertig!${extra}` + (out.made.part ? ' · liegt auf dem Schrottplatz, einbauen mit B' : ''));
    }
    let text = '', kind = 'hit';
    if (fn === 'drone') { const x = installBoard(D, save, res.chips); if (!x.ok) { kind = 'error'; text = x.reason; } else text = 'AvAs Platine sitzt: ' + Object.entries(x.bonuses).map(([k, v]) => `${CHIP_STATS.find(s => s[0] === k)?.[1] || k} +${v}`).join(' · '); this.drone(x.ok ? 'happy' : 'gearWorse'); }
    else if (fn === 'foodtruck') text = res.sold ? `${res.sold} verkauft: +${res.deltas} Δ${res.tips ? ` (davon ${res.tips} Δ Trinkgeld)` : ''}` : 'Niemand bedient.';
    else if (fn === 'power') { const x = tuneResult(D, save, res.share, clockHours(save)); kind = x.ok ? 'hit' : 'miss'; text = x.ok ? `Im grünen Bereich (${x.share} %): +${x.extra} ⚡ für ${x.hours} h` : `Nur ${x.share} % im grünen Bereich. Das Licht flackert, sonst passiert nichts.`; }
    this.station = null; this.stationRecipe = null; this.cursor.start = null;
    this.log = { kind, text }; this.host.changed?.({ minutes: 0 });
    if (this.stationOnly) { this.stationOnly = false; this.mode = 'done'; }
    this.draw();
  }
  canSalvage() { return SALVAGE.includes(functionOf(this.D, this.ws)); }
  setMode(m) { if (this.mode === m) return; this.mode = m; this.cursor.i = -1; this.draw(); }
  close() { cancelAnimationFrame(this.raf); this.station = null; this.el.hidden = true; this.tip.hidden = true; this.pot = {}; this.cursor.hide(); this.cursor.start = null; this.host.closed?.(); }
  nav(ui) {
    if (this.station && this.station.turn && !this.station.finished) { if (ui.down('left')) this.station.turn(-1); else if (ui.down('right')) this.station.turn(1); }
    if (this.station && !this.station.finished && ui.pressed('back') && !this.stationOnly) return this.stopStation();
    if (!this.station && this.canSalvage() && !this.only && (ui.pressed('prev') || ui.pressed('next'))) return this.setMode(this.mode === 'salvage' ? 'pot' : 'salvage');
    if (this.cursor.update(ui)) this.cursor.show();
  }

  verb() { return VERBS[functionOf(this.D, this.ws)]?.[0] || 'Herstellen'; }
  // the action panel of a recipe at this workshop (#013); tank care and trophies stay plain
  panelFor(r) { const P = RECIPE_PANELS[functionOf(this.D, this.ws)]; return P && !r.tank && !r.part ? P : null; }

  draw() {
    if (!this.isOpen) return;
    const D = this.D, save = this.save, def = D.workshops?.[this.ws] || {};
    this.el.replaceChildren(el('div', { class: 'craft-box ui-frame' },
      el('header', {}, icon('workbench', 20), el('h2', {}, def.name || this.ws),
        el('small', {}, clockText(save)), el('button', { class: 'craft-x', title: 'Schließen (Esc)', onclick: () => this.close() }, '×')),
      this.tankEl(),
      el('div', { class: 'craft-cols' + (this.only || this.stationOnly || this.mode === 'done' ? ' single' : '') }, this.only || this.stationOnly || this.mode === 'done' ? null : this.bookEl(),
        this.station ? this.station.el() : this.mode === 'done' ? this.doneEl() : this.mode === 'salvage' ? this.salvageEl() : this.potEl()),
      this.logEl(),
      this.station ? hints([['move', 'wählen'], ['ok', 'drücken'], ['back', this.stationOnly ? 'schließen' : 'abbrechen']], 'Leertaste: Hauptknopf · Geschick gibt nur Bonus, daneben ist auch in Ordnung')
        : hints([['move', 'wählen'], ['ok', 'eins'], ['send', 'alle'], ['context', 'wieder raus'], ['back', 'schließen']], 'Vorräte anklicken: in den Topf · Rechtsklick oder Klick im Topf: raus · Zutaten aus Lager, Kiste und Rucksack')));
    this.cursor.show();
  }

  // ---------- recipe book ----------
  bookEl() {
    const D = this.D, save = this.save, all = recipesFor(D, this.ws), mine = all.filter(r => known(save, r.id)), verb = this.verb();
    const cards = mine.map(r => {
      const miss = missing(D, save, r), st = stock(D, save), made = r.once && madeOnce(save, r.id);   // a trophy (#012): once, then „hergestellt“
      return el('div', { class: 'craft-recipe' + (miss.length && !made ? ' missing' : '') + (r.once ? ' trophy' : '') + (made ? ' made' : '') },
        el('div', { class: 'craft-rtop' }, (r.tank ? el('span', { class: 'craft-chip big tank' }, `+${r.tank}%`) : r.part ? this.partChip(r.part, r.count || 1) : r.weapon ? el('span', { class: 'craft-chip big', style: '--col:#c7b08b' }, markOf(D, 'weapons', r.weapon, 40)) : this.chip(r.result, r.count || 1, { big: true })), el('b', {}, r.name || (r.part ? D.rigParts?.[r.part]?.name : r.weapon ? D.weapons?.[r.weapon]?.name : D.items?.[r.result]?.name) || r.id), el('small', {}, `${r.time ?? 10} min`)),
        el('div', { class: 'craft-ings' }, ...(r.ingredients || []).map(i => {
          const n = st[i.item] || 0, need = i.count || 1;
          return el('span', { class: 'craft-ing ' + (n >= need ? 'ok' : 'no') }, markOf(D, 'items', i.item, 18), ` ${D.items?.[i.item]?.name || i.item} ${Math.min(n, 99)}/${need}`);
        })),
        r.tank && r.tankUpTo ? el('small', { class: 'craft-upto' }, `hilft bis Phase ${r.tankUpTo}`) : null,
        r.once ? el('small', { class: 'craft-upto' }, made ? 'Trophäe · hergestellt' : 'Trophäe · einmalig') : null,
        made ? null : (() => {
          const off = !!miss.length || (r.tank && !canMaintain(D, save, r).ok), why = miss.length ? 'Es fehlen: ' + miss.map(m => `${m.need - m.have}× ${D.items?.[m.item]?.name || m.item}`).join(', ') : r.tank ? canMaintain(D, save, r).reason || '' : '';
          const P = this.panelFor(r), needsParts = (r.slots || []).some(x => x.required);
          return el('div', { class: 'craft-btns' },
            el('button', { class: 'inv-btn', disabled: off, title: why, onclick: () => P ? this.startStation(new P(this, r), r) : this.make(r.id) }, P ? verb : verb === 'Bauen' ? 'Herstellen' : verb),
            P && !needsParts ? el('button', { class: 'inv-btn ghost craft-quick', disabled: off, title: 'Ohne Handgriffe, normales Ergebnis', onclick: () => this.make(r.id) }, 'Schnell') : null);
        })());
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
      const s = el('div', { class: 'craft-slot full', 'data-nav': '', style: `--col:${CATEGORY_COLORS[D.items?.[id]?.category] || '#555'}`, onmousedown: ev => { ev.preventDefault(); this.takeOut(id, ev.shiftKey ? this.pot[id] : 1); } },
        el('b', {}, markOf(D, 'items', id, 24)), el('span', {}, D.items?.[id]?.name || id), el('i', {}, `×${this.pot[id]}`));
      this.hover(s, id);
      return s;
    });
    const order = FIRST[fn] || [];
    const rank = id => { const k = order.indexOf(D.items?.[id]?.category); return k < 0 ? 9 : k; };
    const supplies = Object.keys(st).filter(id => D.items?.[id]).sort((a, b) => rank(a) - rank(b) || (D.items[a].name || a).localeCompare(D.items[b].name || b, 'de'));
    const any = ids.length > 0;
    return el('section', { class: 'inv-panel craft-pot' },
      this.modeTabs() || el('header', {}, icon('research', 16), el('b', {}, 'Experimentieren'), el('small', {}, `${C.experimentMinutes ?? 20} min`)),
      el('div', { class: 'craft-slots', style: `grid-template-columns:repeat(${Math.min(slots, 4)}, 1fr)` }, ...potSlots),
      el('div', { class: 'inv-actions' },
        el('button', { class: 'inv-btn craft-try', disabled: !any, onclick: () => this.tryPot() }, 'Ausprobieren'),
        el('button', { class: 'inv-btn ghost', disabled: !any, onclick: () => { this.pot = {}; this.draw(); } }, 'Topf leeren')),
      el('h3', {}, 'Vorräte'),
      el('div', { class: 'craft-supplies' }, ...(supplies.length ? supplies.map(id => {
        const left = st[id] - (this.pot[id] || 0);
        const c = el('button', { 'data-nav': '', class: 'craft-supply' + (left <= 0 ? ' used' : ''), style: `--col:${CATEGORY_COLORS[D.items[id].category] || '#555'}`,
          onmousedown: ev => { ev.preventDefault(); if (ev.button === 2 || ev.ctrlKey) this.takeOut(id, 1); else if (ev.button === 0) this.putIn(id, ev.shiftKey ? left : 1); } },
          el('b', {}, markOf(D, 'items', id, 24)), el('span', {}, D.items[id].name || id), el('i', {}, String(left)));
        this.hover(c, id);
        return c;
      }) : [el('p', { class: 'craft-empty' }, 'Nichts da. Erst plündern, dann kochen.')])));
  }
  // tabs over the right panel: Experimentieren | Zerlegen | Theke (Q / LB / RB switches, ui_nav.js)
  modeTabs() {
    const truck = functionOf(this.D, this.ws) === 'foodtruck';
    if ((!this.canSalvage() && !truck) || this.only) return null;
    const t = (m, ic, label) => el('button', { class: 'inv-tab' + (this.mode === m ? ' on' : ''), onclick: () => m === 'counter' ? this.startStation(new OWN_PANELS.foodtruck(this), null) : this.setMode(m) }, icon(ic, 14), label);
    return el('header', { class: 'craft-modes' }, t('pot', 'research', 'Experimentieren'), this.canSalvage() ? t('salvage', 'anvil', 'Zerlegen') : null, truck ? t('counter', 'shop', 'Theke') : null);
  }
  // after a workshop without recipes (AvA's board, the regulator): what came out, and once more
  doneEl() {
    const fn = functionOf(this.D, this.ws), again = () => { this.mode = 'pot'; this.stationOnly = fn !== 'foodtruck'; this.startStation(new OWN_PANELS[fn](this), null); };
    const now = fn === 'drone' ? Object.entries(droneBonuses(this.D, this.save)).map(([k, v]) => `${CHIP_STATS.find(s => s[0] === k)?.[1] || k} +${v}`).join(' · ') : '';
    return el('section', { class: 'inv-panel st-panel st-done' }, el('header', {}, icon('check', 16), el('b', {}, 'Erledigt')), now ? el('p', {}, `AvA jetzt: ${now}`) : null,
      el('div', { class: 'st-row' }, el('button', { class: 'inv-btn st-btn main', 'data-nav': '', onclick: again }, 'Nochmal'), el('button', { class: 'inv-btn ghost st-btn', 'data-nav': '', onclick: () => this.close() }, 'Fertig')));
  }
  // ---------- taking things apart (game/crafting.js › salvage) ----------
  salvageEl() {
    const D = this.D, list = salvageable(D, this.save, this.ws), per = D.crafting?.salvageTime ?? 5;
    const name = (a, id) => D[a]?.[id]?.name || id;
    const rows = list.sort((a, b) => name(a.a, a.id).localeCompare(name(b.a, b.id), 'de')).map(t => {
      const r = el('div', { class: 'craft-salv' },
        el('b', { class: 'craft-salv-thing' }, markOf(D, t.a, t.id, 28)), el('span', {}, name(t.a, t.id), el('i', {}, ` ×${t.n}`)),
        el('span', { class: 'craft-salv-out' }, '→ ', ...t.salvage.map(x => el('span', { class: 'craft-out' + (D.items?.[x.item]?.category === 'progress' ? ' prog' : '') }, markOf(D, 'items', x.item, 18), ` ${x.count || 1} ${D.items?.[x.item]?.name || x.item}`))),
        el('button', { class: 'inv-btn', title: 'Shift / Y: alle', onmousedown: ev => { if (ev.button !== 0) return; ev.preventDefault(); this.takeApart(t.a, t.id, ev.shiftKey ? t.n : 1); } }, 'Zerlegen'));
      this.hover(r, t.id, t.a);
      return r;
    });
    return el('section', { class: 'inv-panel craft-pot craft-salvage' },
      this.modeTabs() || el('header', {}, icon('anvil', 16), el('b', {}, this.only ? 'Auswerten' : 'Zerlegen'), el('small', {}, `${per} min je Stück`)),
      el('p', { class: 'craft-empty' }, this.only ? 'Datenträger, Zettel und Kurioses auswerten: daraus wird Wissen für den Techtree.' : 'Beute in ihre Teile zerlegen. Manches ergibt Fortschritt für den Techtree.'),
      el('div', { class: 'craft-list' }, ...(rows.length ? rows : [el('p', { class: 'craft-empty' }, 'Hier lässt sich gerade nichts zerlegen. Erst plündern!')])));
  }
  takeApart(a, id, n) {
    const D = this.D, r = salvage(D, this.save, a, id, this.ws, n);
    if (!r.ok) return this.say('error', r.reason);
    for (const l of r.left) this.host.leftover?.(l.id, l.n);
    this.log = { kind: 'hit', text: `${r.n > 1 ? r.n + '× ' : ''}${D[a]?.[id]?.name || id} zerlegt: ` + r.got.map(g => `${g.n} ${D.items?.[g.id]?.name || g.id}`).join(', ') + (r.left.length ? ' (Rest am Boden, kein Platz)' : ''), minutes: r.minutes };
    this.host.changed?.(r);
    this.draw();
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
  madeName(m) { return m.tank ? `Tank +${m.tank} %` : (m.part ? this.D.rigParts?.[m.id]?.name : m.weapon ? this.D.weapons?.[m.id]?.name : this.D.items?.[m.id]?.name) || m.id; }
  // at the cryo tank: a bar with its condition and phase over the recipe book (Cryo-Tank › Phasen)
  tankEl() {
    if (functionOf(this.D, this.ws) !== 'tank') return null;
    const D = this.D, save = this.save; tankUpdate(D, save);
    const t = save.tank || { cond: 0 }, p = phase(D, save), c = Math.round(t.cond);
    return el('div', { class: 'craft-tank ph' + p.index + (p.dead ? ' dead' : '') },
      el('b', {}, p.dead ? 'AvA ist fort.' : `AvA · ${c} %`), el('i', {}, el('span', { style: `width:${c}%` })), el('small', {}, p.name + (t.rescues ? ` · ${t.rescues}× gerettet` : '')));
  }
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
    if (r.left > 0) { this.host.leftover?.(r.made.id, r.left, r.made.weapon ? 'weapons' : 'items', { ...(r.made.q ? { q: r.made.q } : {}), ...(r.made.mods ? { mods: r.made.mods } : {}) }); text += ` (${r.left} ${r.left === 1 ? 'liegt' : 'liegen'} am Boden, kein Platz)`; }
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
    const D = this.D, c = el('span', { class: 'craft-chip' + (big ? ' big' : ''), style: `--col:${CATEGORY_COLORS[D.items?.[id]?.category] || '#555'}` }, markOf(D, 'items', id, big ? 40 : 26), n > 1 ? el('i', {}, String(n)) : null);
    this.hover(c, id);
    return c;
  }
  // a rig part as a result: it goes onto the scrapyard, not into a bag
  partChip(id, n = 1) {
    const D = this.D, t = D.rigParts?.[id] || {}, c = el('span', { class: 'craft-chip big', style: `--col:${t.color || CATEGORY_COLORS.rigpart}` }, t.glyph || '⚙', n > 1 ? el('i', {}, String(n)) : null);
    c.addEventListener('mouseenter', () => { this.tip.replaceChildren(el('b', {}, t.name || id), el('small', {}, `Rig-Teil · ${t.value || 0} Δ · landet auf dem Schrottplatz`), ...(t.description ? [el('p', {}, t.description)] : [])); this.tip.hidden = false; });
    c.addEventListener('mouseleave', () => { this.tip.hidden = true; });
    return c;
  }
  hover(node, id, a = 'items') {
    node.addEventListener('mouseenter', () => {
      const t = this.D[a]?.[id] || {}, b = this.D.buffs?.[t.buff];
      this.tip.replaceChildren(el('b', {}, t.name || id), el('small', {}, [`${t.value || 0} Δ`, b ? `Buff: ${b.name || t.buff}` : null].filter(Boolean).join(' · ')), ...(t.description ? [el('p', {}, t.description)] : []));
      this.tip.hidden = false;
    });
    node.addEventListener('mouseleave', () => { this.tip.hidden = true; });
  }

  // for tests and Ava
  state() {
    if (!this.isOpen) return { open: false };
    const D = this.D, save = this.save;
    return { open: true, workshop: this.ws, mode: this.mode, station: this.station ? this.station.constructor.name : null, phase: this.station?.phase ?? null, salvage: this.mode === 'salvage' ? salvageable(D, save, this.ws).map(t => `${t.id}×${t.n}`) : null, pot: { ...this.pot }, log: this.log && { ...this.log },
      book: recipesFor(D, this.ws).filter(r => known(save, r.id)).map(r => ({ id: r.id, ready: !missing(D, save, r).length })),
      notes: readable(D, save).map(x => x.item), tips: tips(D, save, this.ws).map(t => t.recipe), stock: stock(D, save) };
  }
}
