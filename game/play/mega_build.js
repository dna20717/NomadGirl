// The build plan aboard a mega rig (#029, Daniel 15.11.2026: „Bau-Modus aufs Raster“): a window over the camp with the vehicle's
// grid, story by story (hull = rooms, frame and top = containers). Pick a cell or a container, then act: put a container from the
// Lager or buy one, move it, put it into the Lager, place workshops on its places, hang string lights to another container, buy the
// next stage of the vehicle. Every action is a draft of game/rig.js (act), with "Rückgängig"; the camp is rebuilt on closing.
// Keys like every window (ui_nav.js): arrows = cell, Q / LB / RB = next action, E / A = do it, Esc / B = back. Mouse: click.
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { hints, closeX } from './ui_nav.js';
import { act, budgets, buyContainer, buyWorkshop, place, fromSpare, lift, stow, fits, priceOf, snapshot, restore, wsDef, placesOf } from '../rig.js';
import { activeMega, gridNow, cells, fitsGrid, putFromSpare, moveTo, storeUnit, nextStage, buyStage, mstate, hangLight, unhangLight, fixLights, stageOf } from '../mega.js';
import { clockText, advance } from '../save.js';
import { makeSfx } from './sfx.js';
import { preview as synPreview, synergyText, synergies } from '../synergy.js';

export class MegaBuild {
  constructor(root, host) {
    this.host = host;
    this.el = el('div', { class: 'mb', hidden: true });
    root.append(this.el);
    this.isOpen = false;
  }
  get scene() { return this.host.scene(); }
  get D() { return this.scene.data_; }
  get save() { return this.scene.box.save; }
  open() {
    this.isOpen = true; this.el.hidden = false; this.changed = false; this.undo = [];
    this.cur = { place: 0, story: 0 }; this.mode = null; this.pick = 0; this.msg = '';
    this.draw();
  }
  close() {
    if (this.mode) { this.mode = null; this.msg = ''; return this.draw(); }
    this.isOpen = false; this.el.hidden = true;
    if (this.changed) this.scene.goCamp({ fade: 300, keepPlace: true });   // the world follows the plan
  }
  // ---------- what stands where ----------
  unitAt(place, story) { return cells(this.D, this.save.rig).get(`${story}:${place}`) ?? null; }
  sel() { const ui = this.unitAt(this.cur.place, this.cur.story); return ui == null ? null : ui; }
  // one action of the rig as a draft, with undo; the result goes into the message line
  run(fn, label) {
    const D = this.D, save = this.save, before = { snap: snapshot(save), lights: JSON.parse(JSON.stringify(mstate(save).lights)) };
    const r = act(D, save, d => fn(d));
    if (r.ok) {
      this.undo.push(before); this.changed = true;
      if (r.removed != null) fixLights(save, r.removed);
      this.msg = `${label}${r.minutes ? ` · ${r.minutes >= 60 ? `${Math.round(r.minutes / 6) / 10} h` : `${r.minutes} min`}` : ''}${r.deltas ? ` · ${r.deltas > 0 ? '+' : ''}${r.deltas} Δ` : ''}`;
      this.sound('klonk');
      this.scene.box.persist?.();
    } else { this.msg = r.reason || 'Geht nicht'; this.sound('nope'); }
    this.mode = null; this.draw();
    return r;
  }
  undoLast() {
    const u = this.undo.pop();
    if (!u) return;
    restore(this.save, u.snap); mstate(this.save).lights = u.lights;
    this.msg = 'Rückgängig'; this.changed = true; this.scene.box.persist?.(); this.draw();
  }
  // ---------- the actions for the current cell ----------
  actions() {
    const D = this.D, save = this.save, rig = save.rig, g = gridNow(D, save), { place: p, story: s } = this.cur, ui = this.sel(), out = [];
    if (this.mode === 'move') return [{ label: 'Hierher verschieben', primary: true, icon: 'arrow_right', do: () => this.run(d => moveTo(D, save, d, this.from, p, s), 'Verschoben') }, { label: 'Abbrechen', icon: 'x', do: () => this.close() }];
    if (this.mode === 'light') return [{ label: 'Kette hierher ziehen', primary: true, icon: 'light', disabled: ui == null || ui === this.from ? 'Einen anderen Container wählen' : null, do: () => this.hang(ui) }, { label: 'Abbrechen', icon: 'x', do: () => this.close() }];
    if (ui == null) {
      // empty cell: a container from the Lager or the shop
      rig.spare.containers.forEach((id, i) => out.push({ label: `${D.containers[id]?.name || id} hinstellen`, sub: 'aus dem Lager', icon: 'box', disabled: fitsGrid(D, g, rig, -1, p, s, id), do: () => this.run(d => putFromSpare(D, save, d, i, p, s), 'Hingestellt') }));
      for (const [id, c] of Object.entries(D.containers || {})) if (!c.retired && c.look && c.chassis) out.push({ label: `${c.name} kaufen`, sub: `${priceOf(D, 'containers', id)} Δ · ${c.places || 1} Plätze`, icon: 'coins', disabled: fitsGrid(D, g, rig, -1, p, s, id) || (save.deltas < priceOf(D, 'containers', id) ? 'Zu wenig Δ' : null),
        do: () => this.run(d => { const b = buyContainer(D, d, id); return b.ok ? putFromSpare(D, save, d, d.rig.spare.containers.length - 1, p, s) : b; }, `${c.name} gekauft`) });
    } else {
      const u = rig.units[ui], n = placesOf(D, u), c = D.containers[u.id] || {}, slot = Math.min(n - 1, p - u.pos.place);
      const w = u.workshops.find(x => slot >= x.at && slot < x.at + (wsDef(D, x.id).places || 1));
      if (w) out.push({ label: `${wsDef(D, w.id).name || w.id} herausnehmen`, sub: 'ins Lager', icon: 'box', do: () => this.run(d => { const inst = lift(D, d, ui, slot); return inst ? stow(D, d, inst) : { ok: false }; }, 'Ins Lager') });
      else {
        const seen = new Set();
        rig.spare.workshops.forEach((id, i) => { if (seen.has(id)) return; seen.add(id); const pv = synPreview(D, save, id, ui, slot), syn = pv && (pv.near || pv.chain > 1) && pv.bonus > 0 ? ` · ${synergyText(pv)}` : ''; out.push({ label: `${wsDef(D, id).name || id} einräumen`, sub: `aus dem Lager · Platz ${slot + 1}${syn}`, primary: !!syn, icon: 'workbench', disabled: fits(D, rig, ui, slot, id) ? null : 'Passt hier nicht hin', do: () => this.run(d => { const inst = d.rig.spare.workshops.find(x => x.id === id); return { ok: !!inst && place(D, d, fromSpare(d, inst.uid), ui, slot) }; }, 'Eingeräumt') }); });
        out.push({ label: 'Werkstatt kaufen …', icon: 'coins', do: () => this.shopFor(ui, slot) });
      }
      out.push({ label: 'Verschieben', icon: 'arrow_right', do: () => { this.mode = 'move'; this.from = ui; this.msg = `${c.name || u.id}: Ziel wählen`; this.pick = 0; this.draw(); } });
      out.push({ label: 'Lichterkette ziehen', icon: 'light', do: () => { this.mode = 'light'; this.from = ui; this.msg = 'Zu welchem Container?'; this.pick = 0; this.draw(); } });
      const L = mstate(save).lights;
      L.forEach((l, i) => { if (l.from === ui || l.to === ui) out.push({ label: 'Lichterkette abnehmen', sub: `zu ${D.containers[rig.units[l.from === ui ? l.to : l.from]?.id]?.name || '?'}`, icon: 'x', do: () => { const before = { snap: snapshot(save), lights: JSON.parse(JSON.stringify(L)) }; if (unhangLight(D, save, i).ok) { this.undo.push(before); this.changed = true; this.msg = 'Abgenommen'; save && this.scene.box.persist?.(); } this.draw(); } }); });
      out.push({ label: `${c.name || u.id} ins Lager`, sub: 'mit seinen Werkstätten', icon: 'delete', danger: true, do: () => this.run(d => storeUnit(D, save, d, ui), 'Ins Lager') });
    }
    return out;
  }
  shopFor(ui, slot) {
    const D = this.D, save = this.save, rig = save.rig;
    const items = Object.entries(D.workshops || {}).filter(([id, w]) => !w.retired && w.value != null && fits(D, rig, ui, slot, id)).map(([id, w]) => { const pv = synPreview(D, save, id, ui, slot), syn = pv && (pv.near || pv.chain > 1) && pv.bonus > 0 ? ` · ${synergyText(pv)}` : ''; return { label: w.name || id, sub: `${priceOf(D, 'workshops', id)} Δ · ${w.places || 1} Platz${(w.places || 1) > 1 ? 'e' : ''}${syn}`, primary: !!syn, disabled: save.deltas < priceOf(D, 'workshops', id) ? 'Zu wenig Δ' : null,
      act: () => this.run(d => { const b = buyWorkshop(D, d, id); return b.ok ? { ok: place(D, d, fromSpare(d, b.inst.uid), ui, slot) } : b; }, `${w.name || id} gekauft`) }; });
    this.scene.hud.menu({ title: 'Werkstatt kaufen', sub: `Platz ${slot + 1} · ${save.deltas} Δ`, items: [...items, { label: 'Zurück', act: () => {} }] });
  }
  hang(to) {
    const D = this.D, save = this.save, a = this.save.rig.units[this.from], b = this.save.rig.units[to];
    const left = a.pos.place <= b.pos.place, before = { snap: snapshot(save), lights: JSON.parse(JSON.stringify(mstate(save).lights)) };
    const r = hangLight(D, save, { ui: this.from, corner: left ? 1 : 0 }, { ui: to, corner: left ? 0 : 1 });
    if (r.ok) { this.undo.push(before); this.changed = true; this.msg = 'Lichterkette hängt'; this.scene.box.persist?.(); } else this.msg = r.why;
    this.mode = null; this.draw();
  }
  stage() {
    const D = this.D, save = this.save, x = nextStage(D, save);
    if (!x) return;
    this.scene.hud.menu({ title: `Ausbau: ${x.name}`, sub: `Das Fahrzeug wächst: mehr Plätze und Stockwerke. Kostet ${x.price} Δ und ${x.hours} h. Lässt sich nicht rückgängig machen.`,
      items: [{ label: 'Ausbauen', primary: true, disabled: save.deltas < x.price ? 'Zu wenig Δ' : null, act: () => { const r = buyStage(D, save); if (r.ok) { if (x.hours) advance(save, x.hours); this.undo = []; this.changed = true; this.msg = `${x.name}: ausgebaut`; this.scene.box.persist?.(); } this.draw(); } }, { label: 'Noch nicht', act: () => {} }] });
  }
  // ---------- input ----------
  nav(u) {
    if (this.scene.hud.modal) return;
    if (u.pressed('back')) return this.close();
    const g = gridNow(this.D, this.save), mv = (dx, dy) => { this.cur = { place: Math.max(0, Math.min(g.places - 1, this.cur.place + dx)), story: Math.max(0, Math.min(g.stories - 1, this.cur.story + dy)) }; this.pick = 0; this.draw(); };
    if (u.pressed('left')) mv(-1, 0); else if (u.pressed('right')) mv(1, 0); else if (u.pressed('up')) mv(0, 1); else if (u.pressed('down')) mv(0, -1);
    else if (u.pressed('next') || u.pressed('prev')) { const n = this.acts?.length || 1; this.pick = (this.pick + (u.pressed('next') ? 1 : -1) + n) % n; this.draw(); }
    else if (u.pressed('ok')) { const a = this.acts?.[this.pick]; if (a && !a.disabled) a.do(); }
  }
  // ---------- drawing ----------
  draw() {
    const D = this.D, save = this.save, id = activeMega(D, save), V = D.megarigs?.[id] || {}, g = gridNow(D, save);
    if (!g) return this.close();
    const rig = save.rig, B = budgets(D, rig), taken = cells(D, rig), syns = synergies(D, save), st = V.stages?.[stageOf(D, save, id)], nx = nextStage(D, save);
    const chip = (ic, text, warn) => el('span', { class: 'mb-chip' + (warn ? ' warn' : '') }, icon(ic, 14), text);
    const head = el('header', {}, icon('build', 20), el('h2', {}, `Bauplan · ${V.name || id}`), el('small', {}, st?.name || ''),
      chip('coins', `${save.deltas} Δ`), chip('flash', `${B.power.net >= 0 ? '+' : ''}${B.power.net} ⚡`, B.power.net < 0), chip('scale', `${Math.round(B.weight / 100) / 10} / ${Math.round(B.pull / 1000)} t`, B.heavy),
      chip('workbench', `${B.filled} / ${B.places} Plätze`), chip('clock', clockText(save)),
      nx ? el('button', { class: 'mb-btn gold', onclick: () => this.stage() }, icon('plus', 14), `Ausbau: ${nx.name} · ${nx.price} Δ`) : null,
      el('button', { class: 'mb-btn', disabled: !this.undo.length, onclick: () => this.undoLast() }, icon('undo', 14), 'Rückgängig'), closeX(() => { this.mode = null; this.close(); }));
    // the grid: top story first; hull stories are rooms, the frame and the stories on top hold containers
    const gridEl = el('div', { class: 'mb-grid', style: `grid-template-columns: 64px repeat(${g.places}, minmax(36px, 1fr))` });
    for (let s = g.stories - 1; s >= 0; s--) {
      const zone = s < g.frames ? 'frame' : s < g.inside ? 'hull' : 'top';
      gridEl.append(el('div', { class: `mb-row ${zone}` }, s < g.frames ? 'Rahmen' : s < g.inside ? `Rumpf ${s + 1}` : `Stock ${s - g.inside + 1}`));
      for (let p = 0; p < g.places; p++) {
        const ui = taken.get(`${s}:${p}`), cur = this.cur.place === p && this.cur.story === s;
        if (ui != null) {
          const u = rig.units[ui];
          if (u.pos.place !== p) continue;   // the container spans its places
          const n = placesOf(D, u), c = D.containers[u.id] || {};
          const slots = Array.from({ length: n }, (_, k) => { const w = u.workshops.find(x => k >= x.at && k < x.at + (wsDef(D, x.id).places || 1)); const sx = w && syns.find(x => x.ui === ui && x.at === w.at && x.bonus > 0); return el('span', { class: 'mb-slot' + (w ? ' full' : '') + (sx ? ' syn' : ''), title: w ? `${wsDef(D, w.id).name}${sx ? ' · ' + synergyText(sx) : ''}` : 'frei' }, w ? (wsDef(D, w.id).name || w.id).slice(0, 10) : '·'); });
          const inCur = this.cur.story === s && this.cur.place >= p && this.cur.place < p + n;
          gridEl.append(el('div', { class: `mb-unit ${zone}` + (inCur ? ' cur' : '') + (this.mode && this.from === ui ? ' from' : ''), style: `grid-column: span ${n}`, onclick: e => { const r = e.currentTarget.getBoundingClientRect(); this.cur = { place: p + Math.min(n - 1, Math.floor((e.clientX - r.left) / r.width * n)), story: s }; this.pick = 0; this.draw(); } },
            el('b', {}, `${zone === 'hull' ? 'Raum' : c.name || u.id}`), el('div', { class: 'mb-slots' }, ...slots)));
        } else gridEl.append(el('div', { class: `mb-cell ${zone}` + (cur ? ' cur' : ''), onclick: () => { this.cur = { place: p, story: s }; this.pick = 0; this.draw(); } }));
      }
    }
    gridEl.append(el('div', { class: 'mb-row' }, ''), ...Array.from({ length: g.places }, (_, p) => el('div', { class: 'mb-num' }, String(p + 1))));
    this.acts = this.actions();
    this.pick = Math.min(this.pick, Math.max(0, this.acts.length - 1));
    const ui = this.sel(), u = ui != null ? rig.units[ui] : null;
    const side = el('aside', { class: 'mb-side' }, el('h3', {}, this.mode === 'move' ? 'Verschieben' : this.mode === 'light' ? 'Lichterkette' : u ? (D.containers[u.id]?.name || u.id) : `Platz ${this.cur.place + 1} · ${this.cur.story < g.inside ? 'Rumpf' : 'oben'}`),
      this.msg ? el('p', { class: 'mb-msg' }, this.msg) : null,
      el('div', { class: 'mb-acts' }, ...this.acts.map((a, i) => el('button', { class: 'mb-act' + (i === this.pick ? ' focus' : '') + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''), disabled: !!a.disabled, title: a.disabled || '', onclick: () => a.do(), onmouseenter: () => { this.pick = i; this.markPick(); } },
        icon(a.icon || 'chevron_right', 16), el('span', {}, el('b', {}, a.label), a.sub || a.disabled ? el('small', {}, [a.sub, a.disabled].filter(Boolean).join(' · ')) : null)))));
    const lager = el('footer', {}, el('span', { class: 'mb-lagerT' }, icon('box', 14), 'Lager'),
      ...rig.spare.containers.map(id => el('span', { class: 'mb-chip' }, D.containers[id]?.name || id)), ...rig.spare.workshops.map(id => el('span', { class: 'mb-chip ws' }, wsDef(D, id).name || id)),
      !rig.spare.containers.length && !rig.spare.workshops.length ? el('small', {}, 'leer') : null);
    this.el.replaceChildren(el('div', { class: 'mb-box' }, head, el('div', { class: 'mb-body' }, gridEl, side), lager,
      hints([['move', 'Platz'], ['tabs', 'Aktion'], ['ok', 'ausführen'], ['back', this.mode ? 'abbrechen' : 'schließen']])));
  }
  sound(name) { try { const s = this.scene; if (this.sfxScene !== s) { this.sfxScene = s; this.sfx = makeSfx(s, (this.D.build?.view?.volume ?? 50) / 100); } this.sfx[name]?.(); } catch { /* no audio */ } }
  markPick() { this.el.querySelectorAll('.mb-act').forEach((b, i) => b.classList.toggle('focus', i === this.pick)); }
  state() { return this.isOpen ? { cur: this.cur, mode: this.mode, msg: this.msg, actions: (this.acts || []).map(a => ({ label: a.label, disabled: a.disabled || null })) } : null; }
  // remote control: do the action whose label contains text
  choose(text) { const a = (this.acts || []).find(x => x.label.toLowerCase().includes(String(text).toLowerCase())); if (!a || a.disabled) return false; a.do(); return true; }
}
