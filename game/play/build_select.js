// #117 Bau-Modus neu (Daniel 20.11.2026, Sprachnachricht): „Konvention: ich berühre den Container und er markiert die Zelle, die ich
// berühre. Ich berühre den Rand und kann ihn schrumpfen oder strecken, ich berühre das Fahrgestell und markiere den ganzen Container.
// Der Pinsel funktioniert unintuitiv. Neu: sobald ich den Container anhand des Fahrgestells markiert habe, kann man die Farbe im
// Kontextmenü auswählen“; „im Baumodus brauchen wir dringend Zoom … in Stufen“; „UI komplett für Controller (erst wählen, dann Menü)“.
//   pick → 'cell' (inside a container, one place) · 'container' (chassis or roof: the whole one) · 'resize' (the rear edge, #113)
//   A / click selects a cell or a container (gold frame), X / right click opens the menu of the selection (or of what is under AvA);
//   the menu of a container starts with its colours (Camp › Farben), then move, length, scrapyard, sell; the menu of an empty cell
//   offers the workshops lying on the scrapyard and the dealer. Zoom: three steps (Rig-Bau › Bau-Modus › Zoom-Stufen): mouse wheel
//   towards the pointer, LT / RT towards AvA, + / − on the keyboard. Mixed into BuildMode (build_mode.js).
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { act, snapshot, paintUnit, wsDef, sizeRange } from '../rig.js';
import { hints, NavCursor } from './ui_nav.js';
import { homes } from '../decor.js';

const de = n => Number(n).toLocaleString('de-DE');

export class BuildSelect {
  // Klickpunkte (Daniel 20.11.2026: „vielleicht sollte man Containern im Baumodus eine Art Klickpunkt geben, anstatt es so kompliziert zu
  // machen. Ein Container kann einen haben, eine Zelle kann einen haben“): a gold point on every container's chassis (the whole
  // container) and a small one in every empty place (that cell). Only the points mark; workshops are still packed directly.
  selPoints() {
    const out = [], camp = this.camp, U = this.save.rig.units;
    if (camp.geo.mega) return out;
    for (const u of camp.geo.units || []) {
      if (u.ui <= 0) continue;
      const base = u.base ?? camp.ground;
      out.push({ kind: 'container', ui: u.ui, id: u.id, unit: u, x: (u.x0 + u.x1) / 2, y: Math.min(base - 18, u.floorY + (base - u.floorY) * 0.45) });
      for (let p = 0; p < (u.places || 0); p++) if (!(U[u.ui]?.workshops || []).some(w => p >= w.at && p < w.at + (wsDef(this.D, w.id).places || 1)))
        out.push({ kind: 'cell', ui: u.ui, p, id: u.id, unit: u, x: u.in0 + (p + 0.5) * u.cell, y: (u.inTop + u.floorY) / 2 + 10 });
    }
    return out;
  }
  pickPoint(x, y) {
    const z = Math.max(0.3, this.scene.cam.zoom), R = 24 / z;
    for (const q of this.selPoints()) if (Math.hypot(x - q.x, y - q.y) < (q.kind === 'container' ? R * 1.2 : R)) return { kind: q.kind, from: 'rig', ui: q.ui, p: q.p, id: q.id, unit: q.unit, point: true, chassis: q.kind === 'container', item: { x0: q.x - R, x1: q.x + R, y0: q.y - R, y1: q.y + R } };
    return null;
  }
  // #118 lived-in places: a soft warm frame and „Wohnen +4“ over each
  drawHomes(g, label, z) {
    const D = this.D, bonus = D.camp?.decor?.homeCozy ?? 4;
    for (const h of homes(D, this.save)) {
      const u = this.camp.geo.units.find(x => x.ui === h.ui); if (!u) continue;
      const x0 = u.in0 + h.p * u.cell;
      g.lineStyle(3 / z, 0xffb347, 0.55).strokeRect(x0 + 4 / z, u.inTop + 4 / z, u.cell - 8 / z, u.floorY - u.inTop - 8 / z);
      label(x0 + u.cell / 2, u.inTop + 22, `Wohnen +${bonus}`, '#ffb347');
    }
  }
  drawPoints(g, z, pulse) {
    if (this.drag || this.decorHold || this.wire || this.painting != null || this.resizing || this.growing) return;
    const w = this.ava?.on ? this.ava : this.pointer, hot = w && this.pickPoint(w.x, w.y);
    for (const q of this.selPoints()) {
      const big = q.kind === 'container', sel = this.sel && this.sel.kind === q.kind && this.sel.ui === q.ui && (!big ? this.sel.p === q.p : true);
      const on = sel || (hot && hot.kind === q.kind && hot.ui === q.ui && hot.p === q.p), r = (big ? 13 : 8) / z * (on ? 1.25 : 1);
      g.fillStyle(0x141013, 0.75).fillCircle(q.x, q.y, r + 3 / z);
      g.fillStyle(big ? 0xffd27a : 0x3fe0d0, sel ? 1 : on ? 0.95 : 0.55 + 0.25 * pulse).fillCircle(q.x, q.y, r);
      if (big) { g.fillStyle(0x141013, 0.9).fillRect(q.x - 6 / z, q.y - 3 / z, 12 / z, 6 / z); g.fillRect(q.x - 4 / z, q.y + 3 / z, 3 / z, 3 / z).fillRect(q.x + 1 / z, q.y + 3 / z, 3 / z, 3 / z); }   // a tiny trailer
    }
  }
  // the place of a container under x (inside its body), or null
  cellOf(u, x, y) {
    if (!u || u.ui <= 0 || !u.places || y < u.inTop || y > u.floorY - 2) return null;
    const p = Math.floor((x - u.in0) / u.cell);
    return p >= 0 && p < u.places ? p : null;
  }
  // A / click on a cell or a container: mark it; a second press on the same container picks it up (move)
  select(hit, w, { menu = false } = {}) {
    const same = this.sel && hit.kind === this.sel.kind && hit.ui === this.sel.ui && (hit.kind !== 'cell' || hit.p === this.sel.p);
    this.sel = { kind: hit.kind, ui: hit.ui, p: hit.p, id: hit.id };
    this.sfx.snap?.(); this.buzz?.('snap');
    const U = this.save.rig.units[hit.ui], name = this.D.containers?.[U?.id]?.name || 'Container';
    this.say(hit.kind === 'cell' ? `${name} · Platz ${hit.p + 1}: markiert · X / Rechtsklick: Menü` : `${name}: markiert · X / Rechtsklick: Farbe und mehr`, 'idle');
    if (menu || same) this.openSelMenu(w);
    this.draw();
  }
  clearSel() { if (!this.sel) return false; this.sel = null; this.draw(); return true; }

  // the menu of the selection (or, without one, of what is under AvA / the pointer: the old context menu)
  openSelMenu(w) {
    const S = this.sel, D = this.D, save = this.save;
    if (!S) return this.openCtx();
    const U = save.rig.units[S.ui], name = D.containers?.[U?.id]?.name || 'Container', items = [];
    let swatches = null;
    if (S.kind === 'container') {
      if (D.containers?.[U?.id]?.tiles) swatches = this.paintColors().map(c => el('button', {
        class: 'inv-btn bm-swatch' + ((U.color || '') === c ? ' on' : ''), title: c ? c : 'Original', style: c ? `--sw:${c}` : '',
        onclick: () => { this.paintSel(c); this.closeCtx(); } }, c ? '' : 'Original'));
      const unitHit = { kind: 'container', from: 'rig', ui: S.ui, id: U.id, unit: this.camp.geo.units.find(u => u.ui === S.ui) };
      items.push({ label: 'Umhängen', icon: 'hand', act: () => { this.closeCtx(); this.sel = null; this.startDrag(unitHit, w); this.buzz('lift'); } });
      if (sizeRange(D, U.id)) items.push({ label: 'Länger / kürzer', icon: 'fit', act: () => { this.closeCtx(); const g = this.resizeGrips().find(q => q.ui === S.ui); if (g) this.startResize({ kind: 'resize', ui: S.ui, grip: g }, { x: g.x, y: (g.y0 + g.y1) / 2 }, true); } });
      items.push({ label: 'Auf den Schrottplatz', icon: 'box', act: () => { this.closeCtx(); this.sel = null; this.startDrag(unitHit, w); this.sendTap(); } });
      items.push({ label: `Verkaufen · +${de(this.sellOf(unitHit))} Δ`, icon: 'shop', act: () => { this.closeCtx(); this.sel = null; this.startDrag(unitHit, w); this.sendHold(); } });
    } else {
      // an empty place: the workshops on the scrapyard that fit, else the dealer
      const yard = (this.camp.yardItems || []).filter(it => it.kind === 'ws');
      for (const it of yard.slice(0, 6)) items.push({ label: `${wsDef(D, it.id).name || it.id} hierhin`, icon: 'workbench', act: () => this.wsToCell(it, S) });
      items.push({ label: 'Beim Händler kaufen', icon: 'shop', act: () => { this.closeCtx(); this.shopOpen = true; this.draw(); } });
    }
    items.push({ label: 'Markierung aufheben', icon: 'x', act: () => { this.closeCtx(); this.clearSel(); } });
    this.showMenu(S.kind === 'cell' ? `${name} · Platz ${S.p + 1}` : name, S.kind === 'cell' ? 'Zelle' : 'Ganzer Container', items, w, swatches);
  }
  // a menu box next to the point: header, an optional row of colour swatches, the buttons, the hint line; the golden cursor walks it
  showMenu(title, sub, items, w, swatches = null) {
    this.closeCtx();
    const box = el('div', { class: 'bm-ctx ui-frame' }, el('header', {}, el('b', {}, title), sub ? el('small', {}, sub) : null),
      swatches ? el('div', { class: 'bm-ctx-colors' }, el('small', {}, icon('brush', 13), ' Farbe'), el('div', {}, ...swatches)) : null,
      ...items.map(x => el('button', { class: 'inv-btn ghost', onclick: x.act }, icon(x.icon, 15), ' ', x.label)),
      hints([['move', 'wählen'], ['ok', 'ausführen'], ['back', 'zurück']]));
    const sp = this.screenOf(w);
    Object.assign(box.style, { left: `${Math.max(8, Math.min(window.innerWidth - 320, sp.x + 40))}px`, top: `${Math.max(130, Math.min(window.innerHeight - 380, sp.y - 120))}px` });
    document.body.append(box);
    this.ctx = { box, cur: new NavCursor(box, swatches ? '.bm-swatch.on, .bm-swatch' : '.inv-btn') };
    this.ctx.cur.on = false;
    this.ctx.cur.update({ now: new Set(['ok']), down: () => false, pressed: () => false });
    this.sfx.snap?.();
  }
  // the colour of the marked container (the brush, now in the menu)
  paintSel(c) {
    const S = this.sel, D = this.D, save = this.save;
    if (S?.kind !== 'container') return;
    if ((save.rig.units[S.ui]?.color || '') === (c || '')) return this.say('Hat schon diese Farbe', 'idle');
    const before = snapshot(save), r = act(D, save, d => paintUnit(D, d, S.ui, c || null));
    if (!r.ok) return this.say(r.reason, 'idle');
    const u = this.camp.geo.units.find(x => x.ui === S.ui), at = u ? { x: (u.x0 + u.x1) / 2, y: (u.inTop + u.floorY) / 2 } : null;
    this.undo.push({ snap: before, label: 'Container gestrichen', job: null, at, done: false });
    this.painting = c; this.painted(at || { x: 0, y: 0 }, c ? 'Container gestrichen' : 'Container wieder im Original'); this.painting = null;
  }
  // a workshop from the scrapyard into the marked place (as if dragged there)
  wsToCell(it, S) {
    this.closeCtx();
    const u = this.camp.geo.units.find(x => x.ui === S.ui); if (!u) return;
    const at = { x: it.x0 != null ? (it.x0 + it.x1) / 2 : it.x, y: it.y0 != null ? (it.y0 + it.y1) / 2 : it.y };
    this.startDrag({ kind: 'ws', from: 'yard', i: it.i, id: it.id, item: it }, at);
    if (!this.drag) return;
    this.drag.x = u.in0 + (S.p + 0.5) * u.cell; this.drag.y = (u.inTop + u.floorY) / 2;
    this.drop();
    this.sel = null;
  }

  // ---------- zoom in steps ----------
  // the steps: overview (the whole camp), the rig, detail (Rig-Bau › Bau-Modus › Zoom-Stufen, % of the game's zoom; 0 = fit all)
  zoomSteps() {
    const s = this.scene, base = s.data_.game?.camera?.zoom || 1, V = this.B.view || {}, all = this.areas()[0];
    const L = this.limits?.(), least = L ? Math.max(s.scale.width / (L.x1 - L.x0), s.scale.height / (L.y1 - L.y0)) : 0;   // #121 never further out than the camp goes
    const fit = Math.max((V.minZoom ?? 30) / 100, least, Math.min(base, s.scale.width * 0.92 / (all.x1 - all.x0)));
    return [fit, ...(V.zoomSteps || [60, 110]).map(z => base * z / 100)].sort((a, b) => a - b);
  }
  zoomStep(dir, at) {
    const s = this.scene, cam = s.cam, Z = this.zoomSteps(), now = cam.zoom;
    const near = Z.reduce((a, z, j) => Math.abs(z - now) < Math.abs(Z[a] - now) ? j : a, 0);
    let j = Math.abs(Z[near] - now) < 0.01 ? near + dir : dir > 0 ? Z.findIndex(q => q > now) : Z.map(q => q < now).lastIndexOf(true);
    const z = j >= 0 && j < Z.length ? Z[j] : null;
    if (z == null) { this.buzz?.('edge'); return this.say(dir > 0 ? 'Näher geht es nicht' : 'Weiter raus geht es nicht', 'idle'); }
    if (Math.abs(z - now) < 0.005) { this.buzz?.('edge'); return; }
    const ms = s.script ? 1 : 320, p = at || { x: cam.midPoint.x, y: cam.midPoint.y };
    // the point under the pointer / AvA stays where it is on the screen
    const v = this.viewBox(), fx = (p.x - v.x) / (cam.width / v.z), fy = (p.y - v.y) / (cam.height / v.z);
    const w = cam.width / z, h = cam.height / z, cx = p.x - fx * w + w / 2, cy = Math.min(this.camp.ground + h * 0.35, p.y - fy * h + h / 2);
    this.view = { x: cx, y: cy, zoom: z };
    cam.zoomTo(z, ms, 'Sine.easeInOut', true);
    cam.pan(cx, cy, ms, 'Sine.easeInOut', true);
    this.zoomLevel = Z.indexOf(z);
    this.sfx.klack?.(); this.buzz?.('snap');
    this.say(['Übersicht', 'Rig', 'Detail', 'Ganz nah'][this.zoomLevel] || 'Zoom', 'idle');
    this.draw();
  }

  // the gold frame of the selection
  drawSel(g, z, pulse) {
    const S = this.sel; if (!S) return;
    const u = this.camp.geo.units.find(x => x.ui === S.ui); if (!u) { this.sel = null; return; }
    const lw = 4 / z;
    g.lineStyle(lw, 0xffd27a, 0.6 + 0.4 * pulse);
    if (S.kind === 'cell') g.strokeRect(u.in0 + S.p * u.cell + 3 / z, u.inTop + 3 / z, u.cell - 6 / z, u.floorY - u.inTop - 6 / z);
    else { g.strokeRect(u.x0 - 6 / z, u.inTop - 10 / z, u.x1 - u.x0 + 12 / z, (u.base ?? this.camp.ground) - u.inTop + 16 / z); g.fillStyle(0xffd27a, 0.08).fillRect(u.x0, u.floorY, u.x1 - u.x0, (u.base ?? this.camp.ground) - u.floorY); }
  }
}
