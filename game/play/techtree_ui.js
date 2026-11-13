// The tech tree screen in the warroom (design.md › Progression, Daniel 12.11.2026: „wie Graveyard Keeper 2: horizontal, Knoten mit Bildern,
// Linien dazwischen, vertikale Tabs für die Ressourcen-Arten, komplett für Controller optimiert“). Logic in game/techtree.js.
// One UI grammar (ui_nav.js): stick / arrows jump from node to node, ok = unlock, LB / RB or Q = tabs, back = close.
// Mouse: hover shows a node, click unlocks it, click on a tab switches.
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { hints } from './ui_nav.js';
import { iconCell, markOf } from './inventory_ui.js';
import { tabs, nodesOf, status, unlock, have, owned } from '../techtree.js';
import { TECH_BONUS } from '../../engine/schema.js';

const COL = 250, ROW = 170, BOX = 124, PAD = 40;
const STATE_TEXT = { owned: 'Freigeschaltet', ready: 'Bereit', open: 'Zu wenig Ressourcen', locked: 'Gesperrt' };

export class TechtreeUI {
  // host: { D, save(), changed(), closed(), notify(text) }
  constructor(root, host) {
    this.root = root; this.host = host; this.tab = null; this.sel = null; this.flash = null;
    this.el = el('div', { class: 'tt', hidden: true, oncontextmenu: e => e.preventDefault() });
    root.append(this.el);
    document.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      if (e.key === 'Escape' || e.key === 'Tab') { this.close(); e.preventDefault(); e.stopPropagation(); }
    }, true);
  }
  get D() { return this.host.D; }
  get save() { return this.host.save(); }
  get isOpen() { return !this.el.hidden; }

  open(tab = null) {
    const T = tabs(this.D);
    this.tab = tab || this.tab || T[0]?.id; this.el.hidden = false;
    this.pickFirst(); this.draw();
  }
  close() { if (this.el.hidden) return; this.el.hidden = true; this.host.closed?.(); }

  list() { return nodesOf(this.D, this.tab); }
  // the first node worth looking at: ready, else open, else the leftmost
  pickFirst() {
    const L = this.list(), st = id => status(this.D, this.save, id).state;
    const by = s => L.filter(n => st(n.id) === s).sort((a, b) => a.pos[0] - b.pos[0] || a.pos[1] - b.pos[1])[0];
    this.sel = (by('ready') || by('open') || [...L].sort((a, b) => a.pos[0] - b.pos[0])[0])?.id || null;
  }
  setTab(id) { if (!id || id === this.tab) return; this.tab = id; this.pickFirst(); this.draw(); }
  stepTab(d) { const T = tabs(this.D), i = T.findIndex(t => t.id === this.tab); this.setTab(T[(i + d + T.length) % T.length]?.id); }

  // controller / keyboard (scene.padMenus → nav)
  nav(ui) {
    if (ui.pressed('prev')) return this.stepTab(-1);
    if (ui.pressed('next')) return this.stepTab(1);
    for (const [d, dx, dy] of [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]]) if (ui.pressed(d)) return this.move(dx, dy);
    if (ui.pressed('ok') && this.sel) this.buy(this.sel);
  }
  move(dx, dy) {
    const L = this.list(), c = L.find(n => n.id === this.sel);
    if (!c) { this.pickFirst(); return this.draw(); }
    let best = null, bd = Infinity;
    for (const n of L) {
      if (n.id === c.id) continue;
      const x = n.pos[0] - c.pos[0], y = n.pos[1] - c.pos[1], along = x * dx + y * dy, side = Math.abs(x * dy) + Math.abs(y * dx);
      if (along <= 0) continue;
      const d = dx ? along * 10 + side : side * 10 + along;   // sideways: the next column first; up/down: stay in the column
      if (d < bd) { bd = d; best = n.id; }
    }
    if (best) { this.sel = best; this.draw(); }
  }
  buy(id) {
    const r = unlock(this.D, this.save, id);
    if (!r.ok) { this.shake = id; this.draw(); this.host.notify?.(r.reason, 'warn'); return r; }
    this.flash = id; this.host.changed?.(r); this.draw();
    const n = this.D.techtree[id];
    this.host.notify?.(`${n.name} freigeschaltet!` + (r.learnt.length ? ` Neues Rezept: ${r.learnt.map(x => this.D.recipes?.[x]?.name || x).join(', ')}` : ''), 'good');
    return r;
  }

  pic(n, size) {
    const k = iconCell(this.D, n);
    if (!k) return el('span', { class: 'tt-pic tt-nopic', style: `width:${size}px;height:${size}px` }, icon('tree', size / 3));
    const pos = (i, c) => c > 1 ? (i / (c - 1)) * 100 : 0;
    return el('span', { class: 'tt-pic', style: `width:${size}px;height:${size}px;background-image:url("${k.url}");background-size:${k.c * 100}% ${k.r * 100}%;background-position:${pos(k.col, k.c)}% ${pos(k.row, k.r)}%` });
  }

  draw() {
    if (!this.isOpen) return;
    const D = this.D, save = this.save, T = tabs(D), L = this.list();
    const tabEls = T.map(t => el('button', { class: 'tt-tab' + (t.id === this.tab ? ' on' : ''), style: `--c:${t.color || '#20d6c7'}`, onclick: () => this.setTab(t.id) },
      t.item ? markOf(D, 'items', t.item, 40) : null, el('b', {}, t.name), el('small', {}, String(have(D, save, t.id))),
      el('i', { class: 'tt-count' }, `${nodesOf(D, t.id).filter(n => owned(save, n.id)).length}/${nodesOf(D, t.id).length}`)));
    // the tree: nodes at their place, lines from what they need (needs in other tabs as a small badge)
    const W = Math.max(1, ...L.map(n => n.pos[0] + 1)) * COL + PAD, H = Math.max(1, ...L.map(n => n.pos[1] + 1)) * ROW + PAD;
    const at = n => ({ x: PAD / 2 + n.pos[0] * COL + (COL - BOX) / 2, y: PAD / 2 + n.pos[1] * ROW + (ROW - BOX) / 2 });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('class', 'tt-lines');
    const nodes = L.map(n => {
      const st = status(D, save, n.id).state, p = at(n);
      for (const r of n.requires || []) {
        const m = L.find(x => x.id === r);
        if (!m) continue;
        const a = at(m), x1 = a.x + BOX, y1 = a.y + BOX / 2, x2 = p.x, y2 = p.y + BOX / 2, mx = (x1 + x2) / 2;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
        path.setAttribute('class', 'tt-line ' + (owned(save, r) ? (owned(save, n.id) ? 'done' : 'live') : 'dead'));
        svg.append(path);
      }
      const away = (n.requires || []).filter(r => !L.some(x => x.id === r)).map(r => D.techtree?.[r]);
      return el('button', { class: `tt-node ${st}` + (n.id === this.sel ? ' sel' : '') + (n.id === this.flash ? ' flash' : '') + (n.id === this.shake ? ' shake' : ''), 'data-node': n.id,
        style: `left:${p.x}px;top:${p.y}px;width:${BOX}px;height:${BOX}px`,
        onmouseenter: () => { if (this.sel !== n.id) { this.sel = n.id; this.draw(); } }, onclick: () => this.buy(n.id) },
        this.pic(n, BOX - 16), st === 'owned' ? el('span', { class: 'tt-check' }, icon('check', 18)) : st === 'locked' ? el('span', { class: 'tt-check lock' }, icon('lock', 16)) : null,
        el('span', { class: 'tt-name' }, n.name || n.id),
        away.length ? el('span', { class: 'tt-away' }, '↳ ' + away.map(x => `${x?.name} (${D.resources?.[x?.tab]?.name || ''})`).join(', ')) : null);
    });
    this.flash = null; this.shake = null;
    const tree = el('div', { class: 'tt-tree', style: `width:${W}px;height:${H}px` }, svg, ...nodes);
    this.el.replaceChildren(el('div', { class: 'tt-box ui-frame' },
      el('header', {}, icon('tree', 22), el('h2', {}, 'Techtree'), el('small', {}, 'Was hier freigeschaltet ist, bleibt. Auch im nächsten Durchgang.'),
        el('button', { class: 'craft-x', title: 'Schließen (Esc)', onclick: () => this.close() }, '×')),
      el('div', { class: 'tt-main' }, el('nav', { class: 'tt-tabs' }, ...tabEls), el('div', { class: 'tt-scroll' }, tree), this.detail()),
      hints([['move', 'Knoten'], ['ok', 'freischalten'], ['tabs', 'Bereich'], ['back', 'schließen']], 'Maus: zeigen · Klick: freischalten')));
    this.el.querySelector('.tt-node.sel')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  detail() {
    const D = this.D, save = this.save, n = D.techtree?.[this.sel];
    if (!n) return el('aside', { class: 'tt-detail' }, el('p', {}, 'Hier wächst noch nichts.'));
    const st = status(D, save, this.sel);
    const cost = (n.cost || []).map(c => { const h = have(D, save, c.resource), r = D.resources?.[c.resource]; return el('span', { class: 'tt-cost ' + (st.state === 'owned' || h >= c.count ? 'ok' : 'no'), style: `--c:${r?.color || '#fff'}` },
      r?.item ? markOf(D, 'items', r.item, 28) : null, ` ${st.state === 'owned' ? c.count : `${Math.min(h, 999)}/${c.count}`} ${r?.name || c.resource}`); });
    const fx = [
      ...(n.bonus || []).map(b => `${(TECH_BONUS.find(([k]) => k === b.stat) || [])[1]?.replace(' (1 = an)', '').replace(' %', '') || b.stat}${b.stat === 'tankStatus' ? '' : ` ${b.value > 0 ? '+' : ''}${b.value} %`}`),
      ...(n.recipes || []).map(r => `Rezept: ${D.recipes?.[r]?.name || r}`)];
    return el('aside', { class: 'tt-detail ' + st.state },
      this.pic(n, 216),
      el('h3', {}, n.name || this.sel), el('span', { class: 'tt-state' }, STATE_TEXT[st.state] || ''),
      el('p', {}, n.description || ''),
      fx.length ? el('ul', { class: 'tt-fx' }, ...fx.map(t => el('li', {}, t))) : el('ul', { class: 'tt-fx' }, el('li', {}, '???')),
      (n.requires || []).length ? el('small', { class: 'tt-req' }, 'Braucht: ' + n.requires.map(r => (owned(save, r) ? '✓ ' : '· ') + (D.techtree?.[r]?.name || r)).join('  ')) : null,
      el('div', { class: 'tt-costs' }, ...cost),
      st.state === 'owned' ? null : el('button', { class: 'inv-btn tt-buy', disabled: st.state !== 'ready', title: st.reason || '', onclick: () => this.buy(this.sel) }, st.state === 'ready' ? 'Freischalten' : st.reason || 'Gesperrt'));
  }

  state() {
    return { open: this.isOpen, tab: this.tab, sel: this.sel, tabs: tabs(this.D).map(t => t.id),
      nodes: this.list().map(n => ({ id: n.id, state: status(this.D, this.save, n.id).state })) };
  }
}
