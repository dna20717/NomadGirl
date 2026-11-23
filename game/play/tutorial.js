// The field guide (#011, Daniel, 13.11.2026: „ein Tutorial, das ähnlich wie bei Far Cry erklärt, wie man Dinge tut … Clips und
// Screenshots … feingranulare Lektionen“; answers: card the first time + archive in the pause menu, clips for moving/fighting/AvA,
// slideshows for windows, keys per device). Lessons live in the workshop (Lektionen, data/tutorial.json), their clips and pictures
// are recorded from the game by tools/tutorial_capture.mjs.
//
//   card     a lesson pops up the first time its trigger fires (pauses like every window); one at a time, Spiel › Tutorial › gap between
//            cards started by time; a window shows at most one lesson per opening
//   archive  Menü › Feldhandbuch: chapters (LB/RB), lessons (up/down), the lesson on the right
//   keys     {k:jump} game action, {u:ok} window action, {stick} {rstick}: keycaps on the keyboard, the buttons of the controller in use
// What was seen is kept in this browser (localStorage nomadgirl-tutorial-seen), the switch in Menü › Optionen (nomadgirl-tutorial-off).
import { unlocked } from '../unlocks.js';   // #184
import { SOLID_TILES } from '../../engine/room.js';
const CHAPTER_SYSTEM = { inventory: 'inventory', build: 'build', travel: 'travel', progress: 'search' };
const LESSON_SYSTEM = { kochen: 'cooking', experimentieren: 'build', werkbank: 'build', ripperdoc: 'cyberware', implantate: 'cyberware', haendler: 'build', warroom: 'travel', ko: 'camp', tank: 'search' };
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { hints, closeX, keyGlyph, padInUse } from './ui_nav.js';
import { TUT_CHAPTERS } from '../../engine/schema.js';

const KEYS = { left: 'A', right: 'D', up: 'W', down: 'S', jump: 'Leertaste', dash: 'L', melee: 'J', ranged: 'K', reload: 'R', holster: 'Q', grab: 'E', walk: 'Shift', inventory: 'I', build: 'B', help: 'Esc', pose: 'P' };
const PAD_SPECIAL = { left: 'stick', right: 'stick', up: 'stick', down: 'stick' };
// „für diese Sitzung nicht mehr“ (Daniel, 14.11.2026): a checkbox on every card, kept for this browser tab (sessionStorage)
const session = { get() { try { return sessionStorage.getItem('nomadgirl-tutorial-session-off') === '1'; } catch { return false; } }, set(v) { try { v ? sessionStorage.setItem('nomadgirl-tutorial-session-off', '1') : sessionStorage.removeItem('nomadgirl-tutorial-session-off'); } catch { /* private mode */ } } };
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } } };

export class Tutorial {
  // host: { scene: () => PlayScene, hud }
  constructor(root, host) {
    this.root = root; this.host = host;
    this.seen = new Set(store.get('nomadgirl-tutorial-seen', []));
    this.off = !!store.get('nomadgirl-tutorial-off', false);
    this.sessionOff = session.get();
    this.events = new Map(); this.lastClose = -1e9; this.queue = []; this.winOpen = null; this.winShown = null;
    this.freed = new Set(); this.count = 0;   // #186 systems freed (Meta-Baum) waiting for their lesson; lessons in this run / camp visit
    this.el = el('div', { class: 'tut', hidden: true, onclick: e => { if (e.target === this.el) this.close(); } });
    root.append(this.el);
    // #016: in the run a lesson comes as a small tip in the corner that does not stop the game; a click opens the full card
    this.tipEl = el('div', { class: 'tut-tip', hidden: true });
    root.append(this.tipEl);
    // the keyboard while a card or the guide is open: our own keys first (before the windows and the game below see them)
    window.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      const k = e.key, map = { Escape: 'back', Enter: 'ok', ' ': 'ok', e: 'ok', E: 'ok', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', q: 'next', Q: 'next', Tab: 'next', r: 'context', R: 'context' }[k];
      if (!map) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat || map !== 'back') this.act(map);
    }, true);
  }
  get scene() { return this.host.scene(); }
  get D() { return this.scene?.data_ || {}; }
  get lessons() {
    const order = Object.fromEntries(TUT_CHAPTERS.map(([k], i) => [k, i]));
    const save = this.scene?.box?.save, D = this.D, free = l => unlocked(D, save, l.unlock || LESSON_SYSTEM[l.id] || CHAPTER_SYSTEM[l.chapter]);   // #184 Meta-Baum: lessons come with their system
    return Object.entries(this.D.tutorial || {}).map(([id, l]) => ({ id, ...l })).filter(free).sort((a, b) => (order[a.chapter] ?? 99) - (order[b.chapter] ?? 99) || (a.order ?? 0) - (b.order ?? 0));
  }
  get isOpen() { return !this.el.hidden; }
  // automated browsers (the tests) see no cards unless they ask for them (nomadgirl-tutorial-test), so no card pauses another test
  get enabled() { return !this.off && !this.sessionOff && this.D.game?.tutorial?.enabled !== false && (typeof navigator === 'undefined' || !navigator.webdriver || store.get('nomadgirl-tutorial-test', false)); }
  setSessionOff(v) { this.sessionOff = !!v; session.set(this.sessionOff); const c = this.el.querySelector('.tut-mute input'); if (c) c.checked = this.sessionOff; }
  setOff(off) { this.off = off; store.set('nomadgirl-tutorial-off', off); }
  markSeen(id) { if (!this.seen.has(id)) { this.seen.add(id); store.set('nomadgirl-tutorial-seen', [...this.seen]); } }
  reset() { this.seen.clear(); store.set('nomadgirl-tutorial-seen', []); }
  // AvA's moods (drone.react) and a few game events (cycle) feed the event triggers
  event(name) { this.events.set(name, this.scene?.now ?? 0); }   // the loop's clock, like poll()
  // #186 a system was freed (Meta-Baum, scene.unlockTick): its lesson comes at the next calm moment
  unlocked(id) { this.freed.add(id); }
  // #187 (Daniel 23.11.2026: „wenn sie es zum ersten Mal macht, bedeutet eigentlich oft: kurz bevor sie es das erste Mal machen muss“):
  // what lies just ahead of Leyla in the level, in her direction (Auslöser „Voraus im Level“). In the first POI (fixed seed) that is always
  // the same spot: the first ladder, the first ledge, the first gap of Mile 7.
  //   jump: a step of 1–2 tiles or a gap ahead · ledge: a wall of 3–4 tiles with room on top (grab it) · ladder: one in reach
  //   ceiling: a passage only one tile high (duck / slide) · enemy: someone in sight ahead · enemyClose: someone a few steps away
  ahead(on, s) {
    const l = s.leyla, T = s.T, b = l.body;
    if (!b || !s.tileAt || !(b.blocked.down || b.touching.down) || l.state !== 'normal') return false;
    const dir = l.facing < 0 ? -1 : 1, ry = Math.floor((l.feet - 1) / T), solid = (x, y) => SOLID_TILES.has(s.tileAt(x, (y + 0.5) * T));
    const col = d => l.x + dir * d * T;
    switch (on) {
      case 'jump': for (let d = 1; d <= 3; d++) {
        const x = col(d), h = [0, 1, 2, 3].findIndex(k => !solid(x, ry - k));
        if (h >= 1 && h <= 2) return true;   // a step to jump onto
        if (!solid(x, ry + 1) && !solid(x, ry + 2) && !(s.ladders || []).some(q => Math.abs(q.cx - x) < T / 2)) return d <= 2;   // a gap
        if (h !== 0) return false;
      } return false;
      case 'ledge': for (let d = 1; d <= 3; d++) {
        const x = col(d), h = [0, 1, 2, 3, 4, 5].findIndex(k => !solid(x, ry - k));
        if (h >= 3 && h <= 4) return true;
        if (h !== 0) return false;
      } return false;
      case 'ceiling': for (let d = 1; d <= 3; d++) { const x = col(d); if (solid(x, ry)) return false; if (solid(x, ry - 1)) return true; } return false;
      case 'ladder': return (s.ladders || []).some(q => Math.abs(q.cx - l.x) < 3 * T && Math.sign(q.cx - l.x || dir) === dir && l.feet > q.top - T && l.feet <= q.bottom + T);
      case 'enemy': case 'enemyClose': {
        const far = on === 'enemy' ? 12 : 5;
        return (s.enemies || []).some(e => e.alive && e.state !== 'dead' && Math.sign((e.x ?? e.body?.center.x) - l.x) === dir && Math.abs((e.x ?? e.body?.center.x) - l.x) < far * T && Math.abs((e.feet ?? e.body?.bottom) - l.feet) < 3 * T);
      }
      default: return false;
    }
  }
  // #186 what Leyla is doing right now (Lektionen › Auslöser „Leyla“): her state, plus a few things she does that are no state
  doing(on, s, now) {
    const l = s.leyla, b = l.body, grounded = b?.blocked.down || b?.touching.down;
    switch (on) {
      case 'flip': return (l.flipUntil || 0) > (s.now ?? now);
      case 'run': return grounded && Math.abs(b.velocity.x) > 150;
      case 'air': return !grounded && l.state === 'normal' && now - this.modeAt > 1500;   // in the air (a short hop is over before the next look); not the fall at the start
      case 'melee': return !!l.attack;
      case 'shot': return (l.rangedReady || 0) > (s.now ?? now);
      case 'reload': return !!l.reloading;
      default: return l.state === on;
    }
  }

  // ---------- triggers: checked a few times a second (scene.update, now = the loop's clock: steps headless like the game) ----------
  poll(now) {
    const s = this.scene, hud = this.host.hud;
    for (const [k, at] of this.events) if (now - at > 8000) this.events.delete(k);   // an event counts for a few seconds
    if (this.tip && now < this.tip.at) { this.tip.until = now + (this.tip.until - this.tip.at); this.tip.at = now; }   // the scene clock started again
    if (this.tip && (now >= this.tip.until || !this.enabled || s?.mode !== 'run')) this.hideTip(now);   // gone with time, outside the run, or off
    // #187 a tip that stands for a few seconds may make way for a lesson Leyla needs right now (something just ahead)
    const urgentOnly = !!this.tip && now - this.tip.at > 3000;   // (urgent() below waits Spiel › Tutorial › Vorher-Abstand)
    if (!s || this.isOpen || (this.tip && !urgentOnly) || !this.enabled) return;
    if (this.mode !== s.mode || this.sceneId !== s.sys.settings.key + (s.roomId || '') + (s.level ? 'L' : '')) { this.count = 0; this.mode = s.mode; this.sceneId = s.sys.settings.key + (s.roomId || '') + (s.level ? 'L' : ''); this.modeAt = now; if (this.lastClose > now) this.lastClose = now - 2500; }   // a new scene starts its clock again
    if (this.nextPoll - now > 1000) this.nextPoll = 0;   // #186 the scene clock started again (camp ↔ run): poll right away
    if (this.lastClose > now) this.lastClose = now - 1;
    if (now < (this.nextPoll || 0)) return;
    this.nextPoll = now + 250;
    if (hud.modal || hud.paused || s.leaving || s.dreaming || !s.leyla?.alive) return;
    const win = this.window();
    if (win !== this.winOpen) { this.winOpen = win; this.winShown = null; }
    const t = (now - this.modeAt) / 1000, gap = (this.D.game?.tutorial?.gap ?? 40) * 1000, prompt = hud.promptText || s.camp?.promptText || s.promptText || '';   // the camp keeps its prompt while a window hides it
    const l = s.leyla, mode = s.mode === 'camp' ? 'camp' : s.mode === 'run' || s.level ? 'run' : 'test';
    // #186 (Daniel 23.11.2026: „wenn man etwas das erste Mal tut … ohne den Spieler mit Informationen zu erschlagen“): a pause between two
    // lessons, at most a few per run or camp visit, in a fight only fight lessons; the first run in the first POI is a Lehrpfad
    const T = this.D.game?.tutorial || {}, first = !!s.box?.save?.run?.first && mode === 'run', path = first ? (T.firstRun || []) : null;
    const quiet = (first ? T.firstGap ?? 10 : T.minGap ?? 25) * 1000, cap = first ? T.firstMax ?? 10 : T.perVisit ?? 4;
    const fight = mode === 'run' && (l.fight?.on || (s.enemies || []).some(e => e.alive && e.seeing));
    const fits = x => {
      if (this.seen.has(x.id) || !x.trigger || (x.mode && x.mode !== mode)) return false;
      if (x.after && t < x.after) return false;
      if (path && !path.includes(x.id)) return false;   // the first run teaches only its path; the rest comes when it comes
      if (fight && x.chapter !== 'fight') return false;
      switch (x.trigger) {
        case 'time': return now - this.lastClose > gap && !win;
        case 'near': return !win && x.on && (x.on === '*' ? !!prompt : prompt.toLowerCase().includes(x.on.toLowerCase()));
        case 'window': return win && x.on === win && this.winShown == null;
        case 'leyla': return !win && this.doing(x.on, s, now);
        case 'event': return this.events.has(x.on);
        case 'unlock': return !win && this.freed.has(x.on);
        case 'ahead': return !win && mode !== 'camp' && this.ahead(x.on, s);   // #187 kurz bevor
        default: return false;
      }
    };
    const order = path ? [...this.lessons].sort((a, b) => (path.indexOf(a.id) + 1 || 99) - (path.indexOf(b.id) + 1 || 99)) : this.lessons;
    // the pause and the cap hold for everything except a window the player opened himself (he is right there)
    const calm = now - this.lastClose > quiet && this.count < cap;
    // what she needs right now (Voraus im Level) waits only 4 s, not the whole pause; it may replace a tip that has stood long enough
    const urgentGap = (T.urgentGap ?? 6) * 1000, urgent = x => x.trigger === 'ahead' && this.count < cap && now - this.lastClose > urgentGap && (!this.tip || now - this.tip.at > urgentGap);
    const next = order.find(x => fits(x) && (urgentOnly ? urgent(x) : calm || urgent(x) || (x.trigger === 'window' && now - this.lastClose > 2500)));
    if (next && urgentOnly) this.hideTip(now - 2501);   // the old tip goes, the new one comes right away
    if (next?.trigger === 'unlock') this.freed.delete(next.on);
    if (next?.trigger === 'event') this.events.delete(next.on);
    if (next && now - this.lastClose > 2500) {
      if (win) this.winShown = next.id;
      this.count++;
      if (mode === 'run' && !win && this.D.game?.tutorial?.runTips !== false) this.showTip(next.id, now); else this.show(next.id);
    }
  }
  // which window is open right now (for window triggers)
  window() {
    const hud = this.host.hud, b = hud.build;
    if (b?.active) return b.shopOpen ? 'shop' : 'build';
    if (hud.inv?.isOpen) return hud.inv.other?.kind === 'floor' ? 'floor' : hud.inv.other?.kind === 'container' ? 'other' : 'inventory';
    if (hud.map?.isOpen) return 'map';
    if (hud.tech?.isOpen) return 'tech';
    if (hud.craft?.isOpen) { const f = this.D.workshops?.[hud.craft.ws]?.function; return f === 'kitchen' || f === 'foodtruck' ? 'kitchen' : f === 'cyber' ? 'cyber' : 'craft'; }
    return null;
  }

  // ---------- text with keys ----------
  glyphs(text) {
    const hud = this.host.hud, p = this.scene?.pad, pad = padInUse() && p?.kind ? p : null;
    const ico = b => hud.padIcon?.(pad.iconName(b), pad.labelOf(b)) || el('kbd', {}, pad.labelOf(b));
    const out = [];
    let last = 0, prevStick = false;
    String(text || '').replace(/\{(k|u):(\w+)\}|\{(stick|rstick)\}/g, (m, kind, a, special, at) => {
      // {k:left} {k:right} on the controller: one stick, not two
      const stick = pad && kind === 'k' && PAD_SPECIAL[a] === 'stick';
      if (stick && prevStick && !text.slice(last, at).trim()) { last = at + m.length; return m; }
      prevStick = stick;
      if (at > last) out.push(text.slice(last, at));
      last = at + m.length;
      if (special) out.push(pad ? ico(special) : el('kbd', {}, special === 'rstick' ? 'rechter Stick' : 'Stick'));
      else if (kind === 'u') out.push(...keyGlyph(a));
      else if (pad) { const bs = PAD_SPECIAL[a] ? [PAD_SPECIAL[a]] : (pad.c.map[a] || []); out.push(...(bs.length ? bs.map(ico) : [el('kbd', {}, KEYS[a] || a)])); }
      else out.push(el('kbd', {}, KEYS[a] || a));
      return m;
    });
    if (last < String(text || '').length) out.push(text.slice(last));
    return out;
  }
  media(l) {
    const A = this.D.assets || {}, url = id => A[id]?.file ? new URL(A[id].file, this.scene.base).href : null;
    if (l.media === 'clip') {
      const src = url(l.clip);
      return src ? el('video', { class: 'tut-clip', src, autoplay: true, loop: true, muted: true, playsinline: true, oncanplay: e => { e.target.muted = true; e.target.play?.().catch(() => {}); } }) : el('div', { class: 'tut-clip tut-missing' }, icon('image', 28), ' Clip fehlt noch');
    }
    const S = (l.slides || []).filter(x => x.look);
    this.slide = { i: 0, n: S.length, at: performance.now() };
    const frames = S.map((x, i) => el('figure', { class: 'tut-slide' + (i ? '' : ' on') }, url(x.look) ? el('img', { src: url(x.look), alt: '' }) : el('div', { class: 'tut-missing' }, 'Bild fehlt')));
    const dots = S.length > 1 ? el('div', { class: 'tut-dots' }, ...S.map((_, i) => el('i', { class: i ? '' : 'on', onclick: () => this.go(i) }))) : null;
    return el('div', { class: 'tut-slides' }, ...frames, dots);
  }
  // slideshow: next / previous page (also by itself every few seconds)
  go(i) {
    const box = this.el.querySelector('.tut-slides');
    if (!box || !this.slide?.n) return;
    this.slide.i = (i + this.slide.n) % this.slide.n; this.slide.at = performance.now();
    box.querySelectorAll('.tut-slide').forEach((f, k) => f.classList.toggle('on', k === this.slide.i));
    box.querySelectorAll('.tut-dots i').forEach((d, k) => d.classList.toggle('on', k === this.slide.i));
    this.el.querySelectorAll('.tut-steps li').forEach((d, k) => d.classList.toggle('on', k === this.slide.i));
  }
  tick(now) {
    if (this.isOpen && this.slide?.n > 1 && now - this.slide.at > 4200) this.go(this.slide.i + 1);
  }
  body(l) {
    const ch = TUT_CHAPTERS.find(([k]) => k === l.chapter)?.[1] || '';
    const steps = l.media === 'slides' ? (l.slides || []).filter(x => x.look && x.caption) : [];
    return el('div', { class: 'tut-body' }, this.media(l), el('div', { class: 'tut-text' }, el('small', {}, ch), el('h2', {}, l.name || l.id),
      l.text ? el('p', {}, ...this.glyphs(l.text)) : null,
      steps.length ? el('ol', { class: 'tut-steps' }, ...steps.map((x, i) => el('li', { class: i ? '' : 'on', onclick: () => this.go(i) }, ...this.glyphs(x.caption)))) : null));
  }

  // ---------- the card ----------
  show(id) {
    const l = this.lessons.find(x => x.id === id);
    if (!l) return;
    this.view = 'card'; this.cur = l;
    this.markSeen(id);
    this.el.replaceChildren(el('div', { class: 'tut-card ui-frame' },
      el('header', {}, icon('help', 18), el('b', {}, 'Feldhandbuch'), el('span', { class: 'tut-new' }, 'Neu')),
      this.body(l),
      el('label', { class: 'tut-mute' }, el('input', { type: 'checkbox', checked: this.sessionOff, onchange: e => this.setSessionOff(e.target.checked) }), ' Für diese Sitzung keine Lektionen mehr zeigen'),
      hints([...(l.media === 'slides' && (l.slides || []).length > 1 ? [['move', 'blättern']] : []), ['context', 'nicht mehr zeigen'], ['ok', 'Verstanden'], ['back', 'schließen']], 'Alle Lektionen: Menü › Feldhandbuch'),
      closeX(() => this.close())));
    this.el.hidden = false; this.el.dataset.view = 'card';
  }
  // ---------- the tip in the run (#016): no pause, goes by itself after Spiel › Tutorial › Tipp im Run (s) ----------
  showTip(id, now) {
    const l = this.lessons.find(x => x.id === id);
    if (!l) return;
    this.markSeen(id);
    const A = this.D.assets || {}, url = x => A[x]?.file ? new URL(A[x].file, this.scene.base).href : null;
    const pic = l.media === 'clip' ? (url(l.clip) ? el('video', { src: url(l.clip), autoplay: true, loop: true, muted: true, playsinline: true, oncanplay: e => { e.target.muted = true; e.target.play?.().catch(() => {}); } }) : null)
      : (() => { const f = (l.slides || []).find(x => x.look && url(x.look)); return f ? el('img', { src: url(f.look), alt: '' }) : null; })();
    const ch = TUT_CHAPTERS.find(([k]) => k === l.chapter)?.[1] || '';
    this.tipEl.replaceChildren(
      pic ? el('div', { class: 'tut-tip-pic' }, pic) : null,
      el('div', { class: 'tut-tip-text' }, el('small', {}, icon('help', 12), ' Feldhandbuch · ', ch), el('b', {}, l.name || l.id), l.text ? el('p', {}, ...this.glyphs(l.text)) : null,
        el('div', { class: 'tut-tip-foot' }, el('button', { class: 'tut-tip-more', onclick: e => { e.stopPropagation(); this.hideTip(this.scene?.now ?? 0); this.show(id); } }, 'Mehr'),
          el('button', { class: 'tut-tip-off', onclick: e => { e.stopPropagation(); this.setSessionOff(true); this.hideTip(this.scene?.now ?? 0); } }, 'Für diese Sitzung aus'))),
      el('span', { class: 'tut-tip-bar', style: `animation-duration:${(this.D.game?.tutorial?.tipSeconds ?? 9)}s` }));
    this.tipEl.hidden = false;
    this.tip = { id, at: now, until: now + (this.D.game?.tutorial?.tipSeconds ?? 9) * 1000 };
  }
  hideTip(now) {
    if (!this.tip) return;
    this.tipEl.hidden = true; this.tipEl.replaceChildren(); this.tip = null; this.lastClose = now;
  }
  close() {
    if (!this.isOpen) return;
    this.el.hidden = true; this.el.replaceChildren(); this.slide = null; this.view = null;
    this.lastClose = this.scene?.now ?? 0;
  }

  // ---------- the archive: Menü › Feldhandbuch ----------
  openGuide(chapter = null) {
    this.view = 'guide';
    this.chapter = chapter || this.chapter || TUT_CHAPTERS[0][0];
    this.pick = this.pick && this.lessons.find(x => x.id === this.pick && x.chapter === this.chapter) ? this.pick : this.lessons.find(x => x.chapter === this.chapter)?.id;
    this.drawGuide();
    this.el.hidden = false; this.el.dataset.view = 'guide';
  }
  drawGuide() {
    const L = this.lessons, mine = L.filter(x => x.chapter === this.chapter), cur = L.find(x => x.id === this.pick) || mine[0];
    const tabs = el('div', { class: 'tut-tabs' }, ...keyGlyph('tabs').slice(0, 1), ...TUT_CHAPTERS.filter(([k]) => L.some(x => x.chapter === k)).map(([k, n]) => el('button', { class: 'tut-tab' + (k === this.chapter ? ' on' : ''), onclick: () => { this.chapter = k; this.pick = null; this.openGuide(k); } }, n)), ...keyGlyph('tabs').slice(1));
    const list = el('ol', { class: 'tut-list' }, ...mine.map(x => el('li', { class: (x.id === cur?.id ? 'on' : '') + (this.seen.has(x.id) ? '' : ' fresh'), onclick: () => { this.pick = x.id; this.drawGuide(); } }, icon(x.media === 'clip' ? 'play' : 'image', 14), ' ', x.name || x.id)));
    this.el.replaceChildren(el('div', { class: 'tut-guide ui-frame' },
      el('header', {}, icon('help', 20), el('h2', {}, 'Feldhandbuch'), el('small', {}, `${this.seen.size} von ${L.length} gesehen`), tabs),
      el('div', { class: 'tut-main' }, list, cur ? this.body(cur) : el('p', {}, 'Noch keine Lektionen.')),
      hints([['move', 'Lektion wählen'], ['tabs', 'Kapitel'], ['back', 'schließen']], 'Maus: Kapitel und Lektionen anklicken'),
      closeX(() => this.close())));
    if (cur) this.markSeen(cur.id);
    this.el.querySelector('.tut-list li.on')?.scrollIntoView?.({ block: 'nearest' });
  }

  // ---------- one grammar: controller (scene.padMenus) and keyboard (our listener) ----------
  nav(u) {
    for (const a of ['back', 'ok', 'context', 'left', 'right', 'up', 'down', 'next', 'prev']) if (u.pressed(a)) { this.act(a); return; }
  }
  act(a) {
    if (this.view === 'card') {
      if (a === 'back' || a === 'ok') return this.close();
      if (a === 'context') return this.setSessionOff(!this.sessionOff);
      if (a === 'left' || a === 'up') return this.go((this.slide?.i ?? 0) - 1);
      if (a === 'right' || a === 'down') return this.go((this.slide?.i ?? 0) + 1);
      return;
    }
    if (this.view !== 'guide') return;
    if (a === 'back') return this.close();
    const L = this.lessons, C = TUT_CHAPTERS.map(([k]) => k).filter(k => L.some(x => x.chapter === k));
    if (a === 'next' || a === 'prev' || a === 'right' || a === 'left') { const i = C.indexOf(this.chapter), d = a === 'next' || a === 'right' ? 1 : -1; this.chapter = C[(i + d + C.length) % C.length]; this.pick = null; return this.openGuide(this.chapter); }
    const mine = L.filter(x => x.chapter === this.chapter), i = Math.max(0, mine.findIndex(x => x.id === this.pick));
    if (a === 'up' || a === 'down') { this.pick = mine[(i + (a === 'down' ? 1 : -1) + mine.length) % mine.length]?.id; this.drawGuide(); }
    if (a === 'ok') this.go((this.slide?.i ?? 0) + 1);
  }
  state() { return { tip: this.tip?.id || null, open: this.isOpen, view: this.view || null, lesson: this.view === 'card' ? this.cur?.id : this.pick || null, chapter: this.chapter || null, seen: [...this.seen], slide: this.slide?.i ?? null, off: this.off, sessionOff: this.sessionOff }; }
}
