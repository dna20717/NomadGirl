// Decoration in build mode (#036): the dealer's „Deko“ tab sells pieces; a bought piece hangs on AvA's claw / the pointer and goes
// where it fits: ground pieces anywhere on the campsite, wall and roof pieces on a container's places, span pieces between two
// anchors (container corners, the mast, poles: click, click). A placed piece is picked up again by clicking it (move it), Esc / B
// puts the piece in hand into the Lager (the Deko tab lists it to place again or to sell). Everything goes on the undo stack.
// Mixed into BuildMode (build_mode.js).
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { decorDef, placeOf, buy, put, lift, stow, fromSpare, sell, shopDecor, priceOf, sellPrice, dstate, cozy, cozyBonus, cozyParts, ensembles } from '../decor.js';
import { snapshot } from '../rig.js';

const de = n => Number(n || 0).toLocaleString('de-DE');

export class BuildDecor {
  // ---- the dealer's tab ----
  decorShopRows() {
    const D = this.D, save = this.save, R = dstate(save), out = [];
    const spare = [...new Set(R.spare.decor)];
    if (spare.length) out.push(el('div', { class: 'build-sub' }, icon('box', 14), ' Im Lager'));
    for (const id of spare) {
      const d = decorDef(D, id) || {}, n = R.spare.decor.filter(x => x === id).length;
      out.push(el('div', { class: 'build-row' }, icon('star', 16), el('span', {}, el('b', {}, `${d.name || id}${n > 1 ? ` ×${n}` : ''}`), el('small', {}, `${placeName(d.place)} · verkaufen: ${de(sellPrice(D, id))} Δ`)),
        el('button', { class: 'inv-btn', onclick: () => this.holdDecor(id, 'spare') }, 'Platzieren'),
        el('button', { class: 'inv-btn ghost', title: `Verkaufen: +${sellPrice(D, id)} Δ`, onclick: () => this.sellDecor(id) }, icon('coins', 14))));
    }
    const cp = cozyParts(D, save);
    out.push(el('div', { class: 'build-sub', title: `Stücke ${cp.base} · Nachbarn +${cp.neighbours} · Ensembles +${cp.sets.reduce((n, e) => n + e.cozy, 0)}` }, icon('star', 14), ` Gemütlichkeit ${cozy(D, save)} · Buffs +${cozyBonus(D, save)} %`));
    for (const e of cp.sets) out.push(el('div', { class: 'build-row' }, icon('sparkles', 16), el('span', {}, el('b', {}, e.name), el('small', {}, `Ensemble · +${e.cozy} Gemütlichkeit`))));
    for (const id of shopDecor(D)) {
      const d = decorDef(D, id), price = priceOf(D, id), poor = price > save.deltas;
      out.push(el('div', { class: 'build-row', title: d.description || '' }, el('span', { class: 'build-dot', style: `--col:${d.color || (d.colors || '').split(',')[0] || '#ffd27a'}` }),
        el('span', {}, el('b', {}, d.name || id), el('small', {}, `${placeName(d.place)}${d.cozy ? ` · +${d.cozy} Gemütlichkeit` : ''}`)),
        el('button', { class: 'inv-btn', disabled: poor, title: poor ? 'Zu wenig Δ' : 'Kaufen und gleich platzieren', onclick: () => this.buyDecor(id) }, `${de(price)} Δ`)));
    }
    return out;
  }
  buyDecor(id) {
    const before = snapshot(this.save), r = buy(this.D, this.save, id);
    if (!r.ok) return this.say(r.why);
    this.undo.push({ snap: before, label: `${decorDef(this.D, id)?.name || id} gekauft`, job: null, at: null, done: false });
    this.sfx.coins?.();
    this.holdDecor(id, 'shop');
  }
  sellDecor(id) {
    const before = snapshot(this.save), r = sell(this.D, this.save, id);
    if (!r.ok) return;
    this.undo.push({ snap: before, label: 'Deko verkauft', job: null, at: null, done: false });
    this.sfx.coins?.();
    this.say(`Verkauft: +${r.back} Δ`, 'ok');
  }
  // a piece in hand (from: shop = just bought, spare = from the Lager, moved = picked up in the world)
  holdDecor(id, from) {
    if (from === 'spare') {
      const before = snapshot(this.save);
      if (!fromSpare(this.save, id)) return;
      this.undo.push({ snap: before, label: `${decorDef(this.D, id)?.name || id} aus dem Lager`, job: null, at: null, done: false });
    }
    this.decorHold = { id, from, a: null };
    this.shopOpen = false;
    const k = placeOf(this.D, id);
    if (k === 'ground' || k === 'span' || k === 'free') { const A = this.areas().find(a => a.key === 'camp'); if (A) { this.areaNow = A; this.frame(A); } }   // to the campsite
    this.say(k === 'span' ? 'Erster Punkt: Container-Ecke, Mast oder Zeltstange' : k === 'free' ? 'Auf den Boden, ein Dach oder ein anderes Stück stellen' : k === 'ground' ? 'Auf den Boden am Lagerplatz stellen' : k === 'wall' ? 'An eine Container-Wand hängen' : k === 'side' ? 'An ein Container-Ende (Balkon)' : 'Auf ein Container-Dach stellen', 'idle');
    this.draw();
  }
  // Esc / B: the piece in hand goes into the Lager
  dropDecorToSpare() {
    const h = this.decorHold;
    if (!h) return false;
    stow(this.save, h.id);
    this.decorHold = null;
    this.decorGhost?.setVisible(false);
    this.say(`${decorDef(this.D, h.id)?.name || h.id}: ins Lager (Händler › Deko)`, 'idle');
    this.camp.drawRig(); this.draw();
    return true;
  }
  // the place under the pointer for the piece in hand
  decorTarget(w) {
    const h = this.decorHold, z = Math.max(0.3, this.scene.cam.zoom);
    if (!h || !w) return null;
    if (placeOf(this.D, h.id) === 'span') {
      const A = this.camp.spanAnchors().filter(a => a.id !== h.a?.id);
      const best = A.sort((p, q) => Math.hypot(p.x - w.x, p.y - w.y) - Math.hypot(q.x - w.x, q.y - w.y))[0];
      return best && Math.hypot(best.x - w.x, best.y - w.y) < 90 / z ? { anchor: best, x: best.x, y: best.y } : null;
    }
    const S = this.camp.decorSpots(h.id), best = S.sort((p, q) => Math.hypot(p.x - w.x, p.y - w.y) - Math.hypot(q.x - w.x, q.y - w.y))[0];
    return best && Math.hypot(best.x - w.x, best.y - w.y) < 220 / z ? best : null;
  }
  placeDecor(w) {
    const h = this.decorHold, t = this.decorTarget(w);
    if (!t) { this.sfx.nope?.(); return this.say(placeOf(this.D, h.id) === 'span' ? 'An einem Punkt loslassen (Ecke, Mast, Zeltstange)' : 'Hier passt es nicht hin'); }
    if (placeOf(this.D, h.id) === 'span' && !h.a) { h.a = t.anchor; this.sfx.snap?.(); this.say('Zweiter Punkt', 'idle'); return this.draw(); }
    const before = snapshot(this.save), at = placeOf(this.D, h.id) === 'span' ? { a: h.a.id, b: t.anchor.id } : { ...t.at, ...(h.v != null ? { v: h.v } : {}), ...(h.f != null ? { f: h.f } : {}) };
    const had = new Set(ensembles(this.D, this.save).map(e => `${e.id}:${[...e.members].sort().join(',')}`)), hadN = ensembles(this.D, this.save).length;
    const r = put(this.D, this.save, h.id, at);
    if (!r.ok) return this.say(r.why);
    this.camp.kitPop = r.i;
    this.decorGhost?.setVisible(false);
    this.undo.push({ snap: before, label: `${decorDef(this.D, h.id)?.name || h.id} platziert`, job: null, at: { x: t.x, y: t.y }, done: false, hold: { id: h.id, from: h.from } });
    this.decorHold = null;
    this.camp.drawRig();
    this.sfx.klonk?.(0.6);
    this.scene.fx?.puff?.(t.x, t.y - 10, 0xb9a2c8);
    this.scene.box.persist?.();
    // #111 Ensembles (Dorfromantik): a new one sparkles and says its name
    const now = ensembles(this.D, this.save), fresh = now.filter(e => e.members.includes(r.i) && !had.has(`${e.id}:${[...e.members].sort().join(',')}`));
    if (fresh.length && now.length > hadN) {
      const e = fresh[0];
      this.say(`✨ ${e.name}! +${e.cozy} Gemütlichkeit`, 'ok');
      this.sfx.chime?.() ?? this.sfx.coins?.();
      for (const k of e.members) { const b = this.camp.decorBoxes?.[k]; if (b) for (let n = 0; n < 6; n++) this.scene.time.delayedCall(n * 70 + k * 30, () => this.scene.fx?.puff?.(b.x + (Math.random() - 0.5) * 50, b.y0 - 10 - Math.random() * 30, 0xffd541)); }
    } else this.say(`${decorDef(this.D, r.ok ? this.save.rig.decor[r.i].id : h.id)?.name || ''} steht`, 'ok');
    this.scene.achieveLevel?.('decor', this.save.rig.decor.length);
  }
  // a placed piece under the pointer → { kind: 'decor', i }
  pickDecor(x, y) {
    const D = this.D, camp = this.camp, T = this.scene.T, R = this.save.rig.decor || [];
    for (let i = R.length - 1; i >= 0; i--) {
      const o = R[i], d = decorDef(D, o.id);
      if (!d) continue;
      const [sw, sh] = d.size || [1, 1], w = Math.max(sw * T, 50), h = Math.max(sh * T, 50), at = o.at || {};
      let box = null;
      if (d.place === 'free') { const b = camp.decorBoxes?.[i]; if (b) box = { x0: b.x0, x1: b.x1, y0: Math.min(b.y0, b.y1 - 30), y1: b.y1 }; }
      else if (d.place === 'ground') { const gx = camp.groundX(at.x); box = { x0: gx - w / 2, x1: gx + w / 2, y0: camp.ground - h, y1: camp.ground }; }
      else if (d.place === 'wall') { const q = camp.wallAt(at.ui, at.p); if (q) box = { x0: q.x - w / 2, x1: q.x + w / 2, y0: q.y - h / 2, y1: q.y + h / 2 }; }
      else if (d.place === 'side') { const b = camp.balconyAt(at.ui, at.side, d); if (b) box = { x0: b.x0, x1: b.x1, y0: b.y - T, y1: b.y + 20 }; }
      else if (d.place === 'roof') { const q = camp.roofAt(at.ui, at.p); if (q) box = { x0: q.x - w / 2, x1: q.x + w / 2, y0: q.y - h, y1: q.y }; }
      else { const a = camp.spanPoint(at.a), b = camp.spanPoint(at.b); if (a && b) { const mx = (a.x + b.x) / 2, my = Math.max(a.y, b.y) + 30; box = { x0: mx - 60, x1: mx + 60, y0: my - 60, y1: my + 60 }; } }
      if (box && x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1) return { kind: 'decor', i, id: o.id, item: box };
    }
    return null;
  }
  liftDecor(i) {
    const before = snapshot(this.save), o = lift(this.D, this.save, i);
    if (!o) return;
    this.undo.push({ snap: before, label: `${decorDef(this.D, o.id)?.name || o.id} aufgenommen`, job: null, at: null, done: false });
    this.decorHold = { id: o.id, from: 'moved', a: null, v: o.at?.v, f: o.at?.f };
    this.camp.drawRig();
    this.say('Wohin damit? (Esc: ins Lager)', 'idle');
    this.draw();
  }
  // markers while a piece is in hand (update): every place it can go, the one under the pointer gold
  drawDecorHold(g, label, z, pulse) {
    const h = this.decorHold, w = this.ava?.on ? this.ava : this.pointer;
    if (!h) { this.decorGhost?.setVisible(false); return; }
    const t = this.decorTarget(w), lw = 3 / z;
    if (placeOf(this.D, h.id) === 'span') {
      for (const a of this.camp.spanAnchors()) { const hot = t?.anchor?.id === a.id; g.lineStyle(lw, hot ? 0xffd27a : 0x3fe0d0, hot ? 1 : pulse).strokeCircle(a.x, a.y, hot ? 18 : 12); }
      if (h.a) { g.lineStyle(lw * 1.5, 0xffd27a, 0.9).lineBetween(h.a.x, h.a.y, t ? t.x : w?.x ?? h.a.x, t ? t.y : w?.y ?? h.a.y); g.fillStyle(0xffd27a).fillCircle(h.a.x, h.a.y, 8); }
    } else for (const q of this.camp.decorSpots(h.id)) {
      const hot = t === q || (t && t.x === q.x && t.y === q.y);
      if (!hot && placeOf(this.D, h.id) === 'free' && !q.stack && q.at.x != null && Math.abs(q.at.x % 1) > 0.01) continue;   // ground: one marker per tile
      g.fillStyle(hot ? 0xffd27a : 0x3fe0d0, hot ? 0.9 : 0.35 * pulse).fillTriangle(q.x - 8 / z, q.y - 16 / z, q.x + 8 / z, q.y - 16 / z, q.x, q.y - 2 / z);
    }
    this.drawDecorGhost(t, h);
    if (t) label(t.x, t.y - 40, decorDef(this.D, h.id)?.name || h.id, '#ffd27a');
    else if (w) label(w.x, w.y - 30, decorDef(this.D, h.id)?.name || h.id, '#f2eef7');
  }
  // #111: the piece in hand shows where it would stand, half see-through (Tiny Glade: you see it before you click)
  drawDecorGhost(t, h) {
    const d = decorDef(this.D, h.id), s = this.scene;
    if (!d || d.art !== 'sprite' || !s.textures.exists(d.look)) { this.decorGhost?.setVisible(false); return; }
    const fr = this.camp.kitFrame(d, { v: h.v ?? 0 }), k = (d.scale || 100) / 100;
    if (!this.decorGhost || !this.decorGhost.scene) this.decorGhost = s.add.image(0, 0, d.look, fr).setOrigin(0.5, 1).setDepth(-15.8);
    const y = t ? (t.stack ? t.y + 4 : t.at?.ui != null ? t.y + 6 : this.camp.ground) : null;
    this.decorGhost.setTexture(d.look, fr).setScale(k).setFlipX(!!(d.flip && h.f)).setVisible(!!t).setAlpha(0.6 + 0.15 * Math.sin(this.scene.time.now / 160));
    if (t) this.decorGhost.setPosition(Math.round(t.x), Math.round(y) + 1);
  }
  // controller: AvA hops between the places of the piece in hand
  decorNavTargets() {
    const h = this.decorHold;
    if (!h) return null;
    if (placeOf(this.D, h.id) === 'span') return this.camp.spanAnchors().filter(a => a.id !== h.a?.id).map(a => ({ x: a.x, y: a.y, label: 'Hier festmachen' }));
    const k = placeOf(this.D, h.id);
    return this.camp.decorSpots(h.id).filter((q, i) => k === 'free' ? (q.at.x == null || Math.abs(q.at.x % 1) < 0.01) && (q.at.p == null || Math.abs(q.at.p % 0.5) < 0.01) : i % 2 === 0 || k !== 'ground').map(q => ({ x: q.x, y: q.y - 10, label: q.label }));
  }
}
const placeName = p => ({ free: 'Boden, Dach, aufeinander', ground: 'Boden', wall: 'Wand', roof: 'Dach', side: 'Container-Ende', span: 'zwischen zwei Punkten' })[p] || '';
