// #114 Farbe wie Townscaper (Daniel 19.11.2026, Wahl „Farbe wie Townscaper“): a brush in build mode. A colour strip (Original + the
// colours of Camp › Farben); clicking a container paints its steel (camp.js paintPixels keeps stripes and rust), clicking a cloth or
// neon piece paints its fabric or light. Every stroke goes on the undo stack. P / the brush button switches it on and off.
// Controller: Kontext-Knopf on a container cycles … (later). Mixed into BuildMode (build_mode.js).
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { act, snapshot, paintUnit } from '../rig.js';
import { decorDef, PAINTABLE } from '../decor.js';

export class BuildPaint {
  paintColors() { return ['', ...(this.D.camp?.paint?.colors || [])]; }
  togglePaint(on = !this.painting) {
    this.painting = on ? (this.painting || this.paintColors()[1] || '') : null;
    if (on) { this.decorHold && this.dropDecorToSpare(); this.say('Pinsel: Farbe wählen, dann Container oder Stoffe anklicken · P / Esc: aus', 'idle'); }
    this.draw();
  }
  paintStrip() {
    if (this.painting == null) return null;
    return el('div', { class: 'bm-paint' }, icon('brush', 15), ...this.paintColors().map(c => el('button', {
      class: 'bm-swatch' + (this.painting === c ? ' on' : ''), title: c ? c : 'Original', style: c ? `--sw:${c}` : '',
      onclick: () => { this.painting = c; this.draw(); } }, c ? '' : 'Original')));
  }
  // a click while painting: the container or the cloth piece under the pointer
  paintAt(w) {
    const D = this.D, save = this.save, c = this.painting || null;
    const dh = this.pickDecor(w.x, w.y), o = dh && save.rig.decor[dh.i], dd = o && decorDef(D, o.id);
    if (o && PAINTABLE.has(dd?.art)) {
      if ((o.at.paint || null) === c) return this.say('Hat schon diese Farbe', 'idle');
      const before = snapshot(save);
      if (c) o.at.paint = c; else delete o.at.paint;
      this.undo.push({ snap: before, label: `${dd.name || o.id} gestrichen`, job: null, at: { x: w.x, y: w.y }, done: false });
      return this.painted(w, `${dd.name || o.id} ${c ? 'gestrichen' : 'wieder im Original'}`);
    }
    const hit = this.pick(w.x, w.y, true);
    const ui = (hit?.kind === 'container' || hit?.kind === 'cell') && hit.from === 'rig' ? hit.ui : hit?.kind === 'ws' && hit.from === 'rig' ? hit.ui : hit?.kind === 'resize' ? hit.ui : null;
    if (ui == null) { this.sfx.nope?.(); return this.say('Nur Container und Stoffe (Zelt, Segel, Plane, Wimpel, Banner, Neon) lassen sich streichen', 'idle'); }
    if (!D.containers?.[save.rig.units[ui]?.id]?.tiles) { this.sfx.nope?.(); return this.say('Dieser Anhänger lässt sich nicht streichen', 'idle'); }
    const before = snapshot(save), r = act(D, save, d => paintUnit(D, d, ui, c));
    if (!r.ok) return this.say(r.reason, 'idle');
    this.undo.push({ snap: before, label: 'Container gestrichen', job: null, at: { x: w.x, y: w.y }, done: false });
    this.painted(w, c ? 'Container gestrichen' : 'Container wieder im Original');
  }
  painted(w, text) {
    this.camp.drawRig();
    this.sfx.snap?.(); this.buzz?.('snap');
    for (let n = 0; n < 6; n++) this.scene.time.delayedCall(n * 40, () => this.scene.fx?.puff?.(w.x + (Math.random() - 0.5) * 60, w.y + (Math.random() - 0.5) * 40, parseInt((this.painting || '#dae0ea').slice(1), 16)));
    this.scene.box.persist?.();
    this.say(text, 'ok');
  }
}
