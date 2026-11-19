// #113 Container ziehen (Daniel 19.11.2026: „Container nur noch insgesamt kaufen und dann über Ziehen und Drücken die Anzahl der Slots
// bestimmen, ganz dynamisch ohne Aufpreis. Wenn Werkbänke drin sind, geht das Ziehen schwerer und der Controller vibriert, wenn man
// weiterzieht, ploppt die Werkbank in die Welt als Kiste.“). A grip at the rear end (left) of every pullable container: drag it to the
// left = longer, to the right = shorter, one place per step. Shrinking over a workshop needs a longer pull (it holds against it, the
// container trembles, the pad rumbles); pulled through, the workshop pops out as a crate onto the scrapyard. A full storage does not
// let go. The whole pull is one step on the undo stack. Controller: AvA on the grip, A = grab, ←/→ = longer/shorter, A/B = done.
// Mixed into BuildMode (build_mode.js).
import { act, snapshot, resizeContainer, sizeRange, containerPlaces, wsDef } from '../rig.js';

export class BuildResize {
  // the grips: the rear end of every pullable container in the rig → [{ ui, x, y0, y1, unit }]
  resizeGrips() {
    const D = this.D, U = this.save.rig.units;
    return (this.camp.geo.units || []).filter(u => u.ui > 0 && sizeRange(D, U[u.ui]?.id)).map(u => ({ ui: u.ui, x: u.in0 - 6, y0: u.inTop, y1: u.floorY, unit: u }));
  }
  pickGrip(x, y) {
    const z = Math.max(0.3, this.scene.cam.zoom), R = 34 / z;
    for (const g of this.resizeGrips()) if (Math.abs(x - g.x) < R && y >= g.y0 - 20 && y <= g.y1 + 20) return { kind: 'resize', ui: g.ui, grip: g, item: { x0: g.x - R, x1: g.x + R, y0: g.y0, y1: g.y1 } };
    return null;
  }
  // a place index is taken by a workshop
  placeTaken(ui, p) { return (this.save.rig.units[ui]?.workshops || []).some(w => p >= w.at && p < w.at + (wsDef(this.D, w.id).places || 1)); }

  startResize(hit, w, pad = false) {
    const u = this.save.rig.units[hit.ui], g = hit.grip;
    this.resizing = { ui: hit.ui, x: w.x, n0: containerPlaces(this.D, u), n: containerPlaces(this.D, u), cell: g.unit.cell, snap: snapshot(this.save), pad, strain: 0, floor: 0, armed: 0 };
    this.sfx.klack?.();
    this.buzz('lift');
    this.say(pad ? '← länger · → kürzer · A fertig' : 'Nach links länger, nach rechts kürzer', 'idle');
    this.draw();
  }
  // the pointer moved while pulling: how many places would the container have now?
  resizeMove(w) {
    const R = this.resizing; if (!R || R.pad) return;
    const raw = R.n0 + (R.x - w.x) / R.cell, D = this.D, range = sizeRange(D, this.save.rig.units[R.ui]?.id) || [1, 1];
    let want = Math.max(range[0], Math.min(range[1], Math.round(raw)));
    if (want < R.n) {
      // shrinking over a workshop: it holds against it, the pull has to go further (1.1 places instead of half a place)
      const p = R.n - 1, hold = this.placeTaken(R.ui, p);
      if (hold && raw > R.n - 1.1) { want = R.n; R.strain = Math.min(1, (R.n - 0.5 - raw) / 0.6); }
      else R.strain = 0;
      if (R.floor && want < R.floor) want = R.floor;   // a full storage stopped it here
    } else R.strain = 0;
    if (want !== R.n) this.resizeTo(want); else this.strainFx();
  }
  // controller: one place per press; shrinking over a workshop needs a second press (the first one strains)
  resizeStep(dir) {
    const R = this.resizing; if (!R) return;
    const want = R.n + dir;
    if (dir < 0 && this.placeTaken(R.ui, R.n - 1) && !(R.armed && this.scene.time.now - R.armed < 1600)) {
      R.armed = this.scene.time.now; R.strain = 1; this.strainFx(true);
      return this.say('Da steht eine Werkstatt drin: nochmal drücken, dann fliegt sie raus', 'idle');
    }
    R.armed = 0; R.strain = 0;
    this.resizeTo(want);
  }
  resizeTo(n) {
    const R = this.resizing, s = this.scene, camp = this.camp, D = this.D;
    const r = act(D, this.save, d => resizeContainer(D, d, R.ui, n));
    if (!r.ok) {
      if (!r.same) { R.floor = R.n; this.sfx.nope?.(); this.buzz('nope'); this.shakeUnit(R.ui, 1); this.say(r.reason || 'Geht nicht', 'bad'); }
      else this.say(r.reason, 'idle');
      return;
    }
    const before = camp.geo.units.find(u => u.ui === R.ui);
    const popAt = r.popped?.length && before ? r.popped.map((id, k) => ({ id, x: before.in0 + before.cell * (n + k + 0.5), y: before.floorY - 60 })) : [];
    R.n = r.to; R.strain = 0;
    camp.drawRig();
    this.sfx.klack?.(); this.buzz('snap');
    const u = camp.geo.units.find(x => x.ui === R.ui);
    if (u?.view) this.bounce(u.view, 0.35);
    s.fx.dust((u?.in0 ?? 0) - 10, u?.floorY ?? camp.ground, 8);
    // a workshop pops out: it flies as a crate onto the scrapyard
    for (const p of popAt) this.popCrate(p);
    const add = r.minutes ? ` · +${r.minutes} min` : '';
    const deco = (r.decor || []).map(id => D.decor?.[id]?.name || id);
    this.say(`${D.containers?.[this.save.rig.units[R.ui]?.id]?.name || 'Container'}: ${r.to} ${r.to === 1 ? 'Platz' : 'Plätze'}${popAt.length ? ` · ${popAt.map(p => wsDef(D, p.id).name || p.id).join(', ')} ploppt auf den Schrottplatz` : ''}${deco.length ? ` · ${deco.join(', ')} ins Lager (Händler › Deko)` : ''}${add}`, popAt.length || deco.length ? 'idle' : 'ok');
    this.draw();
  }
  popCrate(p) {
    const s = this.scene, Y = this.camp.geo.yard, tx = Y ? (Y.x0 + Y.x1) / 2 : p.x - 400, ty = this.camp.ground - 30;
    const box = s.add.rectangle(p.x, p.y, 70, 52, 0x8e5252).setStrokeStyle(4, 0x141013).setDepth(35);
    const lid = s.add.rectangle(p.x, p.y - 22, 74, 10, 0xba756a).setStrokeStyle(3, 0x141013).setDepth(35);
    this.sfx.klonk?.(1.4); this.buzz('drop');
    s.fx.puff?.(p.x, p.y, 0xffd27a);
    s.tweens.addCounter({ from: 0, to: 1, duration: 750, ease: 'Sine.easeInOut', onUpdate: tw => {
      const t = tw.getValue(), x = p.x + (tx - p.x) * t, y = p.y + (ty - p.y) * t - Math.sin(t * Math.PI) * 220;
      box.setPosition(x, y).setAngle(t * 540); lid.setPosition(x, y - 22).setAngle(t * 540);
    }, onComplete: () => { box.destroy(); lid.destroy(); this.sfx.klonk?.(1); s.fx.dust(tx, ty + 30, 12); this.camp.drawRig(); } });
  }
  // the container trembles while a workshop holds against the pull; the pad rumbles harder the further it is pulled
  strainFx(force = false) {
    const R = this.resizing; if (!R || (!R.strain && !force)) return;
    const now = this.scene.time.now;
    if (now - (R.lastStrain || 0) < 140) return;
    R.lastStrain = now;
    this.shakeUnit(R.ui, R.strain || 1);
    const g = this.scene.pad?.pad, a = g?.vibrationActuator;
    if (this.D.game?.gamepad?.rumble !== false && a?.playEffect) try { a.playEffect('dual-rumble', { duration: 120, weakMagnitude: 0.2 + 0.5 * R.strain, strongMagnitude: 0.15 + 0.6 * R.strain }); } catch { /* no rumble */ }
    if (R.strain > 0.2) this.say('Die Werkstatt hält dagegen … weiterziehen, dann ploppt sie raus', 'idle');
  }
  shakeUnit(ui, k = 1) {
    const u = this.camp.geo.units.find(x => x.ui === ui); if (!u?.view) return;
    const x0 = u.view.x;
    this.scene.tweens.add({ targets: u.view, x: x0 + 4 * k, duration: 40, yoyo: true, repeat: 2, onComplete: () => { u.view.x = x0; } });
  }
  endResize() {
    const R = this.resizing; if (!R) return false;
    this.resizing = null;
    if (R.n !== R.n0) {
      const u = this.camp.geo.units.find(x => x.ui === R.ui);
      this.undo.push({ snap: R.snap, label: `Container auf ${R.n} ${R.n === 1 ? 'Platz' : 'Plätze'} gezogen`, job: null, at: u ? { x: u.in0, y: u.floorY } : null, done: false });
      this.sfx.klonk?.(1.2); this.buzz('drop');
      this.scene.box.persist?.();
    } else this.say('Gleich lang geblieben', 'idle');
    this.draw();
    return true;
  }
  // markers: a gold grip at the rear end of every pullable container (pulsing while hovered or pulled)
  drawResizeGrips(g, label, z, pulse) {
    if (this.drag || this.decorHold || this.wire) return;
    const w = this.ava?.on ? this.ava : this.pointer, hot = this.resizing ? null : w && this.pickGrip(w.x, w.y);
    for (const q of this.resizeGrips()) {
      const on = this.resizing?.ui === q.ui || hot?.ui === q.ui, h = Math.min(120, (q.y1 - q.y0) * 0.45), ym = (q.y0 + q.y1) / 2, lw = 3 / z;
      g.fillStyle(on ? 0xffd27a : 0x3fe0d0, on ? 0.95 : 0.4 * pulse).fillRoundedRect(q.x - 7 / z, ym - h / 2, 14 / z, h, 6 / z);
      for (const dy of [-14, 0, 14]) g.fillStyle(0x141013, 0.8).fillRect(q.x - 4 / z, ym + dy / z - 1.5 / z, 8 / z, 3 / z);
      if (on) {
        g.lineStyle(lw, 0xffd27a, 0.9).lineBetween(q.x - 46 / z, ym, q.x - 16 / z, ym).lineBetween(q.x + 16 / z, ym, q.x + 46 / z, ym);
        g.fillStyle(0xffd27a).fillTriangle(q.x - 56 / z, ym, q.x - 44 / z, ym - 8 / z, q.x - 44 / z, ym + 8 / z).fillTriangle(q.x + 56 / z, ym, q.x + 44 / z, ym - 8 / z, q.x + 44 / z, ym + 8 / z);
        const n = this.resizing?.ui === q.ui ? this.resizing.n : containerPlaces(this.D, this.save.rig.units[q.ui]);
        label(q.x, q.y0 - 34, `${n} ${n === 1 ? 'Platz' : 'Plätze'}${this.resizing ? '' : ' · ziehen'}`, '#ffd27a');
      }
    }
  }
}
