// Persona bot brain (#189): runs inside game.html, plays through window.nomad (headless steps), one persona style at a time.
// Loaded by tools/persona_bot.mjs with page.addScriptTag; everything the runner needs comes back from window.personaBot.chunk().
//
// Way finding on the room's tiles (platformer moves): walk, step, fall, jump (up to 4 tiles up, 5 across), ladders. Leyla is
// steered with held inputs every few frames; stuck = no progress → jump, back off, then an assisted teleport (counted and logged).
// Persona styles decide the targets in a run (vault, chests, keys, secrets, enemies, loot) and what happens in the camp.
(() => {
  const S = () => game.scene.getScene('play'), H = () => S().hud;
  const STYLE = {
    jana: { runMin: 10, chests: 'near', enemies: 'defend', secrets: false, loot: 'all', camp: ['Lagerfeuer:Hinsetzen', 'Kochnische', 'Schlafkoje:Schlafen'], campMin: 12, travel: 0.1 },
    malu: { runMin: 8, chests: 'near', enemies: 'defend', secrets: false, loot: 'all', camp: ['Kochnische', 'Lagerfeuer:Hinsetzen', 'Onkel Sung', 'Schraube', 'build', 'Schwarzes Brett', 'Kochnische', 'Schlafkoje:Schlafen'], campMin: 40, travel: 0.05 },
    ole: { runMin: 35, chests: 'all', enemies: 'defend', secrets: true, loot: 'choose', camp: ['Schwarzes Brett', 'Lagerfeuer:Questlog', 'Onkel Sung', 'Schlafkoje:Schlafen'], campMin: 8, travel: 0.6 },
    deniz: { runMin: 25, chests: 'all', enemies: 'all', secrets: true, loot: 'choose', camp: ['Schraube', 'Lagerfeuer:Questlog', 'Kochnische', 'trade', 'Schlafkoje:Schlafen'], campMin: 10, travel: 0.25 },
    kai: { runMin: 12, chests: 'none', enemies: 'all', secrets: false, loot: 'none', camp: ['Schlafkoje:Schlafen'], campMin: 2, travel: 0.4 },
  };
  const bot = window.personaBot = {
    persona: null, st: null, frame: 0, log: [], findings: [], runs: [], seen: new Set(), assists: 0, toastsSeen: 0, errors: [],
    init(persona, seed = 1, frame = 0) {
      this.persona = persona; this.frame = frame; this.st = STYLE[persona]; this.rnd = mulberry(seed);
      this.phase = 'camp'; this.plan = null; this.campLeft = null; this.campTodo = [];
      window.addEventListener('error', e => this.errors.push(String(e.message)));
      nomad.take(); nomad.fast(true);   // pictures only for shots and reports (the runner switches it off then)
    },
    // run n frames of play, return what happened since the last chunk
    chunk(n) {
      const end = this.frame + n;
      while (this.frame < end) {
        try { this.tick(); } catch (e) { this.note('script', `Bot-Fehler: ${e.message}`, { stack: String(e.stack).slice(0, 300) }); this.wait(30); }
      }
      this.watch();
      const out = { frame: this.frame, log: this.log, findings: this.findings, runs: this.runs, errors: this.errors, assists: this.assists, state: this.brief() };
      this.log = []; this.findings = []; this.runs = []; this.errors = [];
      return out;
    },
    wait(k, hold = [], tap = []) { nomad.stepQuiet(k, hold, tap); this.frame += k; },
    note(kind, text, extra = {}) {
      const s = S(), l = s?.leyla, tile = l ? [Math.floor(l.x / s.T), Math.round(l.feet / s.T)] : null;
      const key = kind + ':' + (s?.levelPoi || s?.mode) + ':' + (tile ? Math.floor(tile[0] / 6) + ',' + Math.floor(tile[1] / 4) : '');
      const f = { kind, text, frame: this.frame, mode: s?.mode, poi: s?.levelPoi || null, seed: s?.levelSeed || null, tile, key, dup: this.seen.has(key), ...extra };
      this.seen.add(key); this.findings.push(f);
    },
    brief() {
      const s = S(), sv = s?.box?.save;
      return { heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, dom: document.getElementsByTagName('*').length, objs: s?.children?.list?.length ?? null, mode: s?.mode, poi: s?.levelPoi || null, day: sv?.day, deltas: sv?.deltas, hp: s?.leyla && Math.round(s.leyla.health), place: sv?.location, bag: sv?.inv?.grids?.backpack?.items?.length, tank: sv?.tank?.level != null ? Math.round(sv.tank.level) : null };
    },
    // toasts and windows that hang (things a player sees)
    watch() {
      const h = H(), log = h?.toastLog || [];
      for (; this.toastsSeen < log.length; this.toastsSeen++) this.log.push({ f: this.frame, toast: log[this.toastsSeen].title, sub: log[this.toastsSeen].sub });
    },

    // ---------------- main loop ----------------
    tick() {
      const s = S();
      if (!s?.leyla) return this.wait(10);
      if (this.closeStray()) return;
      if (s.mode === 'camp') return this.campTick();
      if (s.mode === 'run' || s.level) return this.runTick();
      this.wait(10);
    },
    // windows the bot did not want (summary, lessons, menus): read, then close
    closeStray() {
      const h = H(), s = S();
      if (h.sum?.isOpen) { const st = h.sum.state(); this.runs.push({ f: this.frame, persona: this.persona, ...st, poi: this.lastPoi, secs: this.lastRun }); h.sum.close(); this.wait(5); return true; }
      if (h.tut?.isOpen) { h.tut.close?.(); this.wait(3); return true; }
      if (h.ach?.isOpen) { h.ach.close?.(); this.wait(3); return true; }
      if (h.paused) { h.toggleHelp(false); this.wait(2); return true; }
      if (h.modal && !this.expectMenu) {
        const m = h.menuState(), items = m?.items || [];
        this.log.push({ f: this.frame, menu: m?.title, items: items.map(i => i.label) });
        let i = items.findIndex(x => !x.disabled && /zurückreisen|weiter|ok|schließen|zurück$/i.test(x.label));
        if (i < 0) i = items.findIndex(x => !x.disabled);
        h.choose(i); this.wait(4);
        if (h.modal && this.menuStuck++ > 20) { this.note('window', `Menü „${m?.title}“ lässt sich nicht schließen`); h.modal = false; }
        return true;
      }
      this.menuStuck = 0;
      for (const w of ['inv', 'craft', 'tech', 'quests', 'trade', 'map']) if (h[w]?.isOpen && !this.keepOpen) { h[w].close(); this.wait(3); return true; }
      if (h.build?.active && !this.keepOpen) { h.build.close?.() ?? h.build.done?.(); this.wait(20); return true; }
      return false;
    },

    // ---------------- camp ----------------
    campTick() {
      const st = this.st, s = S();
      if (this.campLeft == null) { this.campLeft = st.campMin * 3600; this.campTodo = [...st.camp].sort(() => this.rnd() - 0.5).slice(0, Math.max(2, Math.ceil(st.camp.length * 0.7))); }
      if (this.campTodo.length && this.campLeft > 0) {
        const job = this.campTodo.shift(), t0 = this.frame;
        this.campJob(job);
        this.campLeft -= this.frame - t0;
        return;
      }
      if (this.campLeft > 0) { this.wander(Math.min(this.campLeft, 600)); this.campLeft -= 600; return; }
      this.campLeft = null;
      this.startRun();
    },
    // like nomad.walkTo / goTo, but quiet and counted
    walk(x, max = 900) {
      for (let i = 0; i < max; i += 3) {
        const l = S().leyla, d = x - l.x;
        if (Math.abs(d) < 12) { this.wait(10); return true; }
        this.wait(3, [d > 0 ? 'right' : 'left', ...(Math.abs(d) < 160 ? ['walk'] : [])]);
      }
      return false;
    },
    goTo(name) {
      const sc = S(), h = sc.camp?.hotspots.find(h => h.name === name || h.name?.startsWith?.(name));
      if (!h) return null;
      this.walk(h.x);
      const l = sc.leyla;
      if (h.floor != null && Math.abs(l.feet - h.floor) > 4) { l.body.reset(h.x, h.floor - l.size.h / 2); this.wait(20); }
      return true;
    },
    wander(k) {
      const s = S(), hs = s.camp?.hotspots || [], h = hs[Math.floor(this.rnd() * hs.length)];
      if (h) this.walk(h.x, Math.min(k, 600));
      this.wait(Math.min(k, 120));
    },
    campJob(job) {
      const [where, what] = job.split(':'), h = H();
      if (where === 'build') {   // Malu: open the build mode, look around, close it again
        const s = S(); s.openBuild(); this.wait(60);
        const b = nomad.build();
        this.log.push({ f: this.frame, build: b && { budgets: b.budgets, spare: b.spare, msg: b.msg } });
        if (!b?.open) this.note('build', 'Der Bau-Modus geht nicht auf', { build: b });
        h.build?.close?.(); this.wait(60);
        if (h.build?.active) this.note('build', 'Der Bau-Modus geht nicht wieder zu');
        return;
      }
      if (where === 'trade') { this.goUse('Schraube', /handeln/i); const t = nomad.trade(); this.log.push({ f: this.frame, trade: t && { cash: t.cash, rate: t.rate } }); this.wait(120); return; }
      const ok = this.goUse(where, what ? new RegExp(what, 'i') : null);
      if (!ok) this.log.push({ f: this.frame, campMiss: job });
      this.wait(what === 'Hinsetzen' ? 900 : what === 'Schlafen' ? 300 : 240);
    },
    // walk to a hotspot, E, pick a menu entry (or take the first one), let it play out
    goUse(name, pick) {
      const st0 = this.goTo(name);
      if (!st0) return false;
      this.expectMenu = true;
      this.wait(1, [], ['grab']); this.wait(8);
      const h = H(), m = h.menuState();
      if (m) {
        const items = m.items;
        let i = pick ? items.findIndex(x => pick.test(x.label) && !x.disabled) : items.findIndex(x => !x.disabled && !/zurück/i.test(x.label));
        if (i < 0) i = items.findIndex(x => /zurück/i.test(x.label));
        this.log.push({ f: this.frame, use: name, menu: m.title, chose: items[i]?.label });
        h.choose(i); this.wait(10);
      } else this.log.push({ f: this.frame, use: name, window: ['craft', 'trade', 'quests', 'tech', 'map'].find(w => h[w]?.isOpen) || null });
      if (h.craft?.isOpen) { const c = nomad.craft(); this.log.push({ f: this.frame, craft: c && { tab: c.tab, recipes: (c.book || c.recipes || []).length } }); }
      this.expectMenu = false;
      return true;
    },
    startRun() {
      const st = this.st;
      this.expectMenu = true;
      this.goTo('Van'); this.wait(1, [], ['grab']); this.wait(10);
      if (H().menuState()) nomad.choose('Planen');
      const m = nomad.map();
      let ok = false;
      if (m?.open) {
        const go = this.rnd() < st.travel && m.neighbours?.length ? m.neighbours[Math.floor(this.rnd() * m.neighbours.length)] : null;
        if (go) { ok = nomad.choose(typeof go === 'string' ? go : go.name || go.id); this.log.push({ f: this.frame, travel: go?.name || go }); }
        if (!ok) ok = nomad.choose('Plündern');
      }
      this.expectMenu = false;
      if (!ok) { this.note('travel', 'Vom Van aus kommt Leyla nicht los (Karte/Plündern)', { map: m && { here: m.here, action: m.action } }); H().map?.close(); this.wait(600); return; }
      this.wait(120);
      // a drive or an incident on the way (TravelMode): let it run, choose the first answer
      for (let k = 0; k < 200 && S().mode !== 'run' && !S().level; k++) { this.closeStray(); if (H().drive?.isOpen) H().drive.act?.('ok'); this.wait(30); }
      if (S().mode === 'run' || S().level) this.beginRun();
      else this.note('travel', 'Nach „Plündern“ beginnt kein Run');
    },

    // ---------------- run ----------------
    beginRun() {
      const s = S();
      this.lastPoi = s.levelPoi; this.runStart = this.frame; this.plan = null; this.visited = new Set(); this.retreat = false;
      this.log.push({ f: this.frame, run: s.levelPoi, seed: s.levelSeed });
    },
    runTick() {
      const s = S(), l = s.leyla, st = this.st;
      if (this.runStart == null) this.beginRun();
      const R = s.room, rh = (R.h ?? R.tiles.length) * s.T;
      if (l.feet > rh + 400 || !Number.isFinite(l.x) || !Number.isFinite(l.feet)) { this.note('void', `Leyla ist aus der Welt gefallen (Füße bei y ${Math.round(l.feet)}, Level ${rh} hoch)`, { from: this.lastSafe }); if (this.lastSafe) nomad.tp(...this.lastSafe); else if (s.van) nomad.tp(s.van.x, s.van.y); this.wait(30); return; }
      if ((l.body.blocked.down || l.body.touching.down) && this.frame % 60 < 6) this.lastSafe = [l.x, l.feet];
      if (!l.alive || l.health <= 0) { this.log.push({ f: this.frame, ko: true }); this.wait(240); return; }
      // fight first
      if (this.fight()) return;
      // pick up what lies at her feet (persona taste)
      const fl = H().floor;
      if (st.loot !== 'none' && fl?.list?.length && this.rnd() < 0.5) {
        if (st.loot === 'choose' && fl.list.length > 1) fl.cycle(1);
        this.wait(1, [], ['grab']); this.wait(4);
      }
      // the target
      const tooLong = (this.frame - this.runStart) > st.runMin * 3600;
      const lv = s.level?.state?.() || {};
      if (tooLong && this.target && this.target.what !== 'van') this.target = null;   // the persona's time in the run is up: home
      if (this.target && this.target.what !== 'van' && this.frame - this.target.born > 60 * 180) {   // 3 min on one target: give it up
        this.note('giveup', `Ziel (${this.target.what}) nach 3 Minuten aufgegeben`, { to: [Math.round(this.target.x / s.T), Math.round(this.target.feet / s.T)] });
        this.visited.add(this.target.what + Math.round(this.target.x) + ',' + Math.round(this.target.feet)); this.target = null;
      }
      if (!this.target || this.target.done?.()) this.target = this.pickTarget(lv, tooLong);
      if (!this.target) return this.wait(30);
      this.go(this.target);
    },
    fight() {
      const s = S(), l = s.leyla, st = this.st;
      const foes = (s.enemies || []).filter(e => e.alive && e.state !== 'dead' && Math.abs(e.x - l.x) < 520 && Math.abs(e.feet - l.feet) < 160);
      if (!foes.length) return false;
      const e = foes.sort((a, b) => Math.abs(a.x - l.x) - Math.abs(b.x - l.x))[0];
      if (st.enemies === 'defend' && !e.seeing && Math.abs(e.x - l.x) > 220) return false;
      const d = e.x - l.x, dir = d > 0 ? 'right' : 'left';
      if (Math.abs(d) < 130) this.wait(6, [dir], ['melee']);
      else if (l.ammo > 0 && this.rnd() < 0.6) this.wait(6, [], ['ranged']);
      else this.wait(6, [dir]);
      if (this.rnd() < 0.03 && (l.grenade?.state?.().charges || 0) > 0) this.wait(2, [], ['grenade']);
      return true;
    },
    pickTarget(lv, tooLong) {
      const s = S(), l = s.leyla, T = s.T, st = this.st, near = (x, feet) => Math.hypot(x - l.x, (feet - l.feet) * 1.5);
      const mk = (x, feet, what, done, act) => ({ x, feet, what, done, act });
      if (lv.done || tooLong) {   // home: the van (start)
        const v = s.van;
        const t = v ? mk(v.x, v.y, 'van', () => S().mode !== 'run', 'leave') : null;
        if (t) { t.since = this.frame; t.born = this.frame; t.best = 1e9; t.assists = 0; this.plan = null; }
        return t;
      }
      const list = [];
      if (st.chests !== 'none') for (const c of lv.chests || []) if (!c.open && (st.chests === 'all' || near(c.x, c.feet) < 1400)) list.push(mk(c.x, c.feet, 'chest', () => (S().level?.state()?.chests || []).find(q => q.x === c.x && q.feet === c.feet)?.open, 'grab'));
      for (const k of lv.keys || []) if (!k.taken && st.chests !== 'none') list.push(mk(k.x, k.feet, 'key', () => (S().level?.state()?.keys || []).find(q => q.x === k.x)?.taken, 'grab'));
      if (st.secrets) {
        for (const f of lv.fakes || []) if (!f.found) list.push(mk((f.x0 + f.x1 + 1) / 2 * T, (f.y1 + 1) * T, 'secret', () => (S().level?.state()?.fakes || []).find(q => q.x0 === f.x0 && q.y0 === f.y0)?.found, 'walk'));
        for (const w of lv.walls || []) if (!w.open) list.push(mk((w.x0 + w.x1 + 1) / 2 * T, (w.y1 + 1) * T, 'wall', () => (S().level?.state()?.walls || []).find(q => q.x0 === w.x0 && q.y0 === w.y0)?.open, 'melee'));
      }
      if (st.enemies === 'all') for (const e of s.enemies || []) if (e.alive && e.state !== 'dead') list.push(mk(e.x, e.feet, 'enemy', () => !e.alive || e.state === 'dead', 'fight'));
      for (const g of lv.goals || []) list.push(mk(g.x, g.feet, 'goal', () => !!S().level?.state()?.done, 'grab'));
      const fresh = list.filter(t => !this.visited.has(t.what + Math.round(t.x) + ',' + Math.round(t.feet)));
      const pool = fresh.filter(t => t.what !== 'goal');
      const pickFrom = pool.length && !(this.persona === 'jana' && this.rnd() < 0.7) ? pool : fresh;
      pickFrom.sort((a, b) => near(a.x, a.feet) - near(b.x, b.feet));
      const t = pickFrom[0] || null;
      if (t) { t.since = this.frame; t.born = this.frame; t.best = 1e9; t.assists = 0; this.plan = null; }
      return t;
    },
    // walk the path to the target, act there; stuck → jump, back off, assist
    go(t) {
      const s = S(), l = s.leyla, T = s.T;
      const dist = Math.hypot(t.x - l.x, (t.feet - l.feet) * 1.5);
      if (dist < 70) {
        if (t.act === 'grab' || t.act === 'leave') { this.expectMenu = t.act !== 'leave'; this.wait(1, [], ['grab']); this.wait(10); this.expectMenu = false; }
        else if (t.act === 'melee') this.wait(20, [], ['melee']);
        else this.wait(10, [t.x > l.x ? 'right' : 'left']);
        if (t.act === 'leave' && S().mode === 'run') { const m = H().menuState(); if (m) { nomad.choose('Zurückreisen'); this.wait(60); } }
        if (t.act === 'leave' && S().mode !== 'run') { this.lastRun = Math.round((this.frame - this.runStart) / 60); this.runStart = null; this.target = null; return; }
        if (!t.done()) { t.tries = (t.tries || 0) + 1; if (t.tries > 6) { this.note('use', `Am Ziel (${t.what}) passiert nichts`, { prompt: H().promptText }); this.visited.add(t.what + Math.round(t.x) + ',' + Math.round(t.feet)); this.target = null; } }
        else { this.visited.add(t.what + Math.round(t.x) + ',' + Math.round(t.feet)); this.target = null; }
        return;
      }
      if (dist < t.best - 32) { t.best = dist; t.since = this.frame; }
      const stuckFor = this.frame - t.since;
      if (stuckFor > 60 * 40) {   // 40 s without getting closer: assisted teleport, and a finding
        this.assists++; t.assists = (t.assists || 0) + 1;
        if (t.assists > 2 && t.what !== 'van') { this.note('giveup', `Ziel (${t.what}) auch mit Hilfe nicht erreichbar`); this.visited.add(t.what + Math.round(t.x) + ',' + Math.round(t.feet)); this.target = null; return; }
        this.note('stuck', `Kommt nicht zum Ziel (${t.what}), Bot hilft nach`, { to: [Math.round(t.x / T), Math.round(t.feet / T)] });
        nomad.tp(t.x, t.feet); this.wait(20); t.since = this.frame; t.best = 0;
        return;
      }
      if (!this.plan || this.plan.t !== t || this.frame - this.plan.at > 600) { this.plan = { t, at: this.frame, path: path(s, l, t) }; t.bestLen = Math.min(t.bestLen ?? 1e9, this.plan.path?.length ?? 1e9); }
      const p = this.plan.path;
      if (!p || !p.length) { this.drive(t.x, t.feet, stuckFor); return; }
      const n = p[0], nx = (n.c + 0.5) * T, nfeet = n.g * T;
      if (Math.abs(nx - l.x) < 18 && Math.abs(nfeet - l.feet) < 40) { p.shift(); if (p.length < (t.bestLen ?? 1e9)) { t.bestLen = p.length; t.since = this.frame; } return; }   // a way point closer to the end is progress (a ladder may lead away first)
      this.drive(nx, nfeet, stuckFor, n);
    },
    // steer towards a point: hold the direction, jump when it is higher or across a gap, ladders, drop through plates
    drive(x, feet, stuckFor, n) {
      const s = S(), l = s.leyla, T = s.T, dx = x - l.x, dy = feet - l.feet, dir = dx > 0 ? 'right' : 'left', hold = [], tap = [];
      if (l.state === 'hang') { if (dy > 40) this.wait(6, ['down'], ['down']); else this.wait(6, ['up'], ['up']); return; }
      // on a ladder the next way point is not on it: climb towards its height, then jump off sideways
      if (l.state === 'climb' && !n?.ladder) {
        if (dy > 30) { this.wait(6, ['down']); return; }
        if (dy < -30) { this.wait(6, ['up']); return; }
        this.wait(6, [dir, 'jump'], ['jump']); return;
      }
      const ladder = s.ladderAt?.(l.x, l.feet);
      if ((n?.ladder || (ladder && Math.abs(dx) < 40)) && Math.abs(dy) > 20) {
        if (Math.abs(dx) > 24 && l.state !== 'climb') { this.wait(3, [dir, 'walk']); return; }   // walk up to it slowly, then climb
        hold.push(dy < 0 ? 'up' : 'down'); this.wait(6, hold, l.state === 'climb' ? [] : [dy < 0 ? 'up' : 'down']); return;
      }
      if (Math.abs(dx) > 8) hold.push(dir);
      if (Math.abs(dx) < 90 && !n?.jump) hold.push('walk');   // slow down near a way point instead of running over it
      const grounded = l.body.blocked.down || l.body.touching.down;
      if (dy > 40 && Math.abs(dx) < 50 && grounded && s.onPlatform(l.x, l.feet)) { this.wait(4, ['down', 'jump'], ['jump']); return; }
      if (grounded && (dy < -40 || n?.jump || (Math.abs(l.body.velocity.x) < 20 && Math.abs(dx) > 30))) { hold.push('jump'); tap.push('jump'); }
      else if (!grounded && l.body.velocity.y < 0) hold.push('jump');
      if (stuckFor > 60 * 12 && stuckFor % 240 < 60) { hold.length = 0; hold.push(dx > 0 ? 'left' : 'right'); }   // back off a little now and then
      this.wait(6, hold, tap);
    },
  };

  // ---------------- way finding on the tiles ----------------
  function path(s, l, t) {
    const T = s.T, R = s.room, w = R.w ?? R.tiles[0].length, h = R.h ?? R.tiles.length;
    const solid = (c, r) => c < 0 || r < 0 || c >= w || r >= h ? true : R.solid(c, r);
    const plat = (c, r) => s.platformTiles?.has(c + ',' + r);
    const lad = (c, r) => R.tiles[r]?.[c] === 'H';
    const air = (c, r) => !solid(c, r) && !plat(c, r);
    const stand = (c, g) => (solid(c, g) || plat(c, g) || (lad(c, g) && !lad(c, g - 1))) && air(c, g - 1) && air(c, g - 2) && !solid(c, g - 3);
    const start = { c: Math.floor(l.x / T), g: Math.round(l.feet / T) }, goal = { c: Math.floor(t.x / T), g: Math.round(t.feet / T) };
    const key = n => n.c + ',' + n.g, seen = new Map([[key(start), null]]), q = [start];
    let best = start, bd = 1e9;
    const push = (from, n) => { const k = key(n); if (seen.has(k)) return; seen.set(k, from); q.push(n); };
    for (let i = 0; i < q.length && i < 40000; i++) {
      const n = q[i], d = Math.abs(n.c - goal.c) + Math.abs(n.g - goal.g) * 1.5;
      if (d < bd) { bd = d; best = n; }
      if (d < 1) break;
      for (const dir of [-1, 1]) {
        const c = n.c + dir;
        for (const dg of [0, -1, 1]) if (stand(c, n.g + dg) && air(c, n.g - 3 + Math.min(0, dg))) push(n, { c, g: n.g + dg });
        if (air(c, n.g) && air(c, n.g - 1)) { for (let g = n.g + 1; g < n.g + 16 && g < h; g++) if (stand(c, g)) { push(n, { c, g }); break; } else if (solid(c, g)) break; }
        for (let dx = 1; dx <= 5; dx++) for (let up = -3; up <= 4; up++) {
          if (dx < 2 && up <= 0) continue;
          const c2 = n.c + dir * dx, g2 = n.g - up;
          if (!stand(c2, g2)) continue;
          let clear = true;
          for (let k = 0; k <= dx && clear; k++) for (let r = Math.min(n.g, g2) - 3 - (up > 0 ? 1 : 0); r < Math.max(n.g, g2) - 1 && clear; r++) if (solid(n.c + dir * k, r) && !(k === dx && r >= g2)) clear = false;
          if (clear) push(n, { c: c2, g: g2, jump: true });
        }
      }
      // ladders in this column (tiles H and the van's ladder)
      for (const L of s.ladders || []) {
        const c = Math.floor(L.cx / T);
        if (Math.abs(c - n.c) > 0) continue;
        const top = Math.round(L.top / T), bot = Math.round(L.bottom / T);
        if (n.g < top - 1 || n.g > bot + 1) continue;
        for (let g = top - 1; g <= bot + 1; g++) if (g !== n.g && stand(c, g)) push(n, { c, g, ladder: true });
      }
      for (let r = n.g - 1; r >= n.g - 12; r--) { if (!lad(n.c, r) && !lad(n.c, r + 1)) break; if (stand(n.c, r)) push(n, { c: n.c, g: r, ladder: true }); }
      for (let r = n.g; r <= n.g + 12; r++) { if (!lad(n.c, r)) break; if (stand(n.c, r + 1)) push(n, { c: n.c, g: r + 1, ladder: true }); }
    }
    const out = [];
    for (let n = best; n && key(n) !== key(start); n = seen.get(key(n))) out.unshift(n);
    return out;
  }
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
})();
