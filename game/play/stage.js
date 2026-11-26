// Info-Center, Bühne (#154, Konzept docs/concepts/info_center.md › 2): one layer #stage over the canvas with fixed zones. Every overlay
// hangs in exactly one zone and no longer places itself with position: fixed, so nothing can lie on top of something else.
//
//   left column      A Vitals (Leben, Ausdauer, Nägel, Rig bauen)  ·  F Lehre (Lektions-Tipp) + Menü-Knopf
//   middle column    B Ansage (Raumtitel; with a window open the notes)  ·  E Aktion (E-Hinweis or the build note)
//   right column     C Status (Uhr · Ort, Δ, Effekte, Ziel; in the run Zeit/Kills/Δ)  ·  D Meldungen (Toasts, the big announcement
//                    first)  ·  R the run's status column  ·  G Medien (Kassette over the Rig-Radio chip)
//
// The columns are a CSS grid, every column a flex column: the zones of a column stack, the columns stand side by side.
// The context decides where the notes go: play → D, window (Inventar, Karte …) → B, build → A (below the build bar, A is empty there).
// Zones and their max entries: Werkstatt › Meldungen › Bühne › Zonen (data/notices.json, `zones`).
import { el } from '../ui.js';
import { setNowPlayingHost } from '../now_playing.js';

// the defaults; Werkstatt › Meldungen › Zonen overrides max and compact per zone
export const ZONES = {
  A: { name: 'Vitals', max: 0, compact: true },     // compact: notes put here (build mode) are small
  B: { name: 'Ansage', max: 1, compact: true },     // the room title; with a window open the notes stand here, compact
  C: { name: 'Status', max: 0, compact: false },
  D: { name: 'Meldungen', max: 5, compact: false }, // max = notes visible at most (the big announcement counts)
  E: { name: 'Aktion', max: 1, compact: false },    // E prompt or the build note, never both
  F: { name: 'Lehre', max: 1, compact: false },
  G: { name: 'Medien', max: 1, compact: false },    // one card (the tape); the radio chip shrinks to its icon meanwhile
};
// the zones with the values of the workshop (rows without an id are skipped; 0 = no limit)
export function zoneRules(D) {
  const Z = Object.fromEntries(Object.entries(ZONES).map(([k, v]) => [k, { ...v }]));
  for (const r of D?.notices?.zones || []) {
    const z = Z[r.id]; if (!z) continue;
    if (r.max != null && r.max !== '') z.max = Number(r.max);
    if (r.compact != null) z.compact = !!r.compact;
    if (r.name) z.name = r.name;
  }
  return Z;
}

export class Stage {
  constructor(root) {
    const zone = id => el('div', { class: `stage-zone zone-${id.toLowerCase()}`, 'data-zone': id });
    this.z = { A: zone('A'), B: zone('B'), C: zone('C'), D: zone('D'), E: zone('E'), F: zone('F'), G: zone('G'), R: zone('R') };
    const Z = this.z, gap = () => el('div', { class: 'stage-gap' });
    this.el = el('div', { id: 'stage', 'data-ctx': 'play' },
      el('div', { class: 'stage-col left' }, Z.A, gap(), Z.F),
      el('div', { class: 'stage-col mid' }, Z.B, gap(), Z.E),
      el('div', { class: 'stage-col right' }, Z.C, Z.D, gap(), Z.R, Z.G));
    root.prepend(this.el);
    setNowPlayingHost(Z.G);   // the tape slides in in G, above the radio chip
    this.ctx = 'play';
  }
  zone(id) { return this.z[id]; }
  // put a node into a zone (at the end, or first); nothing happens when it is there already
  put(id, node, first = false) {
    const z = this.z[id]; if (!node || !z) return;
    if (node.parentElement === z && (!first || z.firstElementChild === node)) return;
    if (first) z.prepend(node); else z.append(node);
  }
  // which context the screen is in (Konzept › 4): the notes and the zones follow it
  context(h) {
    if (h.build?.active) return 'build';
    if (h.drive?.isOpen) return 'drive';
    if (h.inv?.isOpen || h.craft?.isOpen || h.tech?.isOpen || h.map?.isOpen || h.quests?.isOpen || h.trade?.isOpen || h.ach?.isOpen || h.tut?.isOpen || h.megaBuild?.isOpen || h.duel?.isOpen) return 'window';
    if (h.modal) return h.menuEl?.classList.contains('talk') ? 'talk' : 'window';
    return 'play';
  }
  // every frame from hud.update: everything into its zone, the context, the max entries
  sync(h, D) {
    const ctx = this.context(h), run = h.modeName === 'run';
    if (ctx !== this.ctx) { this.ctx = ctx; this.el.dataset.ctx = ctx; }
    if (D !== this.rulesFor) { this.rulesFor = D; this.rules = zoneRules(D); for (const [id, z] of Object.entries(this.rules)) this.z[id]?.classList.toggle('compact', !!z.compact); }
    this.put('A', h.leftEl); this.put('A', h.buildBtn); this.put('A', h.openBtn);
    this.put('C', h.rightEl);
    this.put(run ? 'R' : 'C', h.campEl);
    const notes = ctx === 'window' ? 'B' : ctx === 'build' ? 'A' : 'D';
    this.put(notes, h.toastsEl, ctx === 'window');
    this.limitNotes(h.toastsEl, notes === 'D' ? 0 : this.rules?.[notes]?.max ?? ZONES[notes].max);
    this.put('E', h.promptEl, true);
    if (ctx === 'build') this.buildEdges(h);
    const msg = h.build?.active ? h.build.shell?.msg : null;   // the build note leaves the build layer and stands in E (Konzept › 9, Etappe 3)
    if (msg) this.put('E', msg); if (this.msg && this.msg !== msg) this.msg.remove(); this.msg = msg;
    this.put('F', h.tut?.tipEl, true); this.put('F', h.footEl);
    this.put('G', h.radio?.el);
    this.limit('B'); this.limit('E'); this.limit('F'); this.limit('G');
    if (!h.scene?.fast) this.fitNotes(h);   // #189 no layout measuring while bots step headless
  }
  // build mode: the stage starts below the build bar and ends above its hint line (layout boxes, not the slide-in animation)
  buildEdges(h) {
    const sh = h.build?.shell, bar = sh?.bar, hint = sh?.hint, box = (n, side) => n?.isConnected && n.offsetParent ? (side === 'top' ? n.offsetTop : n.offsetTop + n.offsetHeight) : null;
    const top = box(bar, 'bottom'), bottom = box(hint, 'top'), H = h.root.clientHeight || innerHeight;
    if (top != null) h.root.style.setProperty('--build-top', `${Math.round(top + 10)}px`);
    if (bottom != null && bottom > H / 2) h.root.style.setProperty('--build-bottom', `${Math.round(H - bottom + 8)}px`);
  }
  // more entries than the zone allows: the earlier ones step back (E: the build note wins over the prompt; G: one card)
  limit(id) {
    const max = this.rules?.[id]?.max ?? ZONES[id].max, z = this.z[id];
    if (!max) return;
    const entries = [...z.children].filter(n => !n.matches('.hud-foot, .radio-chip, .hud-toasts'));
    const live = entries.filter(n => !n.hidden && !n.classList.contains('out') && (!n.matches('.np-card') || n.classList.contains('on')));
    const over = new Set(live.slice(0, Math.max(0, live.length - max)));
    for (const n of entries) n.classList.toggle('stage-over', over.has(n));
  }
  // notes outside D (a window open: B, one by default) show only the newest; the others wait hidden and come back in D
  limitNotes(t, max) {
    const live = [...(t?.children || [])].filter(x => !x.classList.contains('out')), over = new Set(max ? live.slice(0, Math.max(0, live.length - max)) : []);
    for (const x of t?.children || []) x.classList.toggle('stage-over', over.has(x));
  }
  // the notes never grow into the next zone: does the column not hold them, the oldest goes (the announcement stays)
  fitNotes(h) {
    const t = h.toastsEl, z = t?.parentElement; if (!z || !t.children.length) return;
    if (z.scrollHeight <= z.clientHeight + 2 || [...t.children].some(x => x.classList.contains('out'))) return;
    const old = [...t.children].find(x => !x.classList.contains('out') && !x.classList.contains('banner'));
    if (old) h.dismiss(old);
  }
  // for the tests: every visible entry of the zones with its box (clipped to its zone)
  rects() {
    const out = [];
    const vis = n => { const s = getComputedStyle(n); return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.05; };
    for (const [id, z] of Object.entries(this.z)) {
      if (!vis(z)) continue;
      const zr = z.getBoundingClientRect();
      const items = [...z.children].flatMap(n => n.matches('.hud-toasts') ? [...n.children].filter(x => !x.classList.contains('out')) : [n]);
      for (const n of items) {
        if (n.hidden || !vis(n) || n.closest('[hidden]')) continue;
        const r = n.getBoundingClientRect();
        const x0 = Math.max(r.left, zr.left), y0 = Math.max(r.top, zr.top), x1 = Math.min(r.right, zr.right), y1 = Math.min(r.bottom, zr.bottom);
        if (x1 - x0 < 1 || y1 - y0 < 1) continue;
        out.push({ zone: id, what: n.className.split(' ')[0] || n.tagName, title: n._title || n.textContent.trim().slice(0, 40), x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      }
    }
    return out;
  }
}
