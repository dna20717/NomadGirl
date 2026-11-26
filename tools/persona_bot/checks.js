// Testpilot checks and coverage (#191): rules that must hold at every step, and a record of what the bot has touched.
// Loaded by tools/persona_bot.mjs next to brain.js; the brain calls checks.tick() after every chunk, the runner writes the report.
//   checks.tick(frame) → findings [{ kind, text, … }] (each kind and place once)
//   coverage.touch(kind, value) · coverage.set(kind) · coverage.report() → { kind: { value: count } } + what exists and was never touched
(() => {
  const S = () => game.scene.getScene('play');
  const C = window.coverage = {
    data: {},
    touch(k, v) { if (v == null || v === '') return; const m = (this.data[k] ??= {}); m[v] = (m[v] || 0) + 1; },
    set(k) { return new Set(Object.keys(this.data[k] || {})); },
    // what the game has and the bot never touched: places on the map, recipes known, nodes, workshops in the rig, windows
    report() {
      const s = S(), D = s?.data_, sv = s?.box?.save, out = { touched: this.data, never: {} };
      if (!D || !sv) return out;
      const never = (k, all) => { const t = this.set(k); out.never[k] = [...new Set(all)].filter(x => x && !t.has(x)); };
      never('place', (sv.map?.nodes || []).map(n => n.id));
      never('recipe', sv.recipes || []);
      never('node', Object.keys(D.techtree || {}));
      never('poi', Object.keys(D.pois || {}).filter(id => D.pois[id]?.rooms?.length));
      never('window', ['Reisekarte', 'Fahrt', 'Bau-Modus', 'Händler-Platz', 'Techtree', 'Cryo-Tank', 'Inventar', 'Implantate', 'Händler', 'Questlog', 'Glitch-Duell', 'Bit-Farm']);
      return out;
    },
  };
  let seen = new Set(), last = null, still = 0, saveAt = 0, campBase = null;
  const finding = (kind, text, extra = {}) => {
    const s = S(), l = s?.leyla, key = kind + ':' + text.slice(0, 60);
    if (seen.has(key)) return null;
    seen.add(key);
    return { kind, text, mode: s?.mode, poi: s?.levelPoi || null, seed: s?.levelSeed || null, tile: l ? [Math.floor(l.x / s.T), Math.round(l.feet / s.T)] : null, ...extra };
  };
  window.checks = {
    async tick(frame) {
      const s = S(), out = [], push = f => f && out.push(f);
      if (!s?.leyla || !s.box?.save) return out;
      const sv = s.box.save, h = s.hud, l = s.leyla;
      // coverage that falls out of the state
      C.touch('mode', s.mode); C.touch('place', sv.location); if (s.levelPoi) C.touch('poi', s.levelPoi);
      for (const [w, name] of [['inv', 'Inventar'], ['trade', 'Händler'], ['quests', 'Questlog'], ['duel', 'Glitch-Duell'], ['map', 'Reisekarte'], ['tech', 'Techtree']]) if (h[w]?.isOpen) C.touch('window', name);
      // 1) one HUD piece of a kind (#190 ②: the throw HUD doubled with every run)
      for (const sel of ['.hud-throw', '.floor-strip', '.hud-toasts', '.inv-cursor']) { const n = document.querySelectorAll(sel).length; if (n > 1) push(finding('hud', `${sel} steht ${n}× im HUD`)); }
      // 2) level textures go with their scene (#190 ③)
      const lvl = game.textures.getTextureKeys().filter(k => /^fog_/.test(k) || /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(k)).length;
      // measured in the camp (no level of its own): the count must not climb from visit to visit
      if (s.mode === 'camp' && !s.leaving) { campBase ??= lvl; if (lvl > campBase + 15) push(finding('memory', `Level-Texturen im Camp ${campBase} → ${lvl}: eine Szene räumt nicht auf`)); }
      if (s.mode === 'camp' && !s.leaving && (s.kitCache?.size || 0) > (s.data_.game?.kitCacheKeep ?? 8)) push(finding('memory', `Raider-Cache im Camp bei ${s.kitCache.size} Kombinationen (Grenze ${s.data_.game?.kitCacheKeep ?? 8})`));   // pruned when a level ends
      // 2b) nobody outside the level: an enemy below the bottom is never found, its kill never counts
      if (s.room && s.mode !== 'camp') {
        const H0 = (s.room.h ?? s.room.tiles.length) * s.T, W0 = (s.room.w ?? s.room.tiles[0].length) * s.T;
        for (const e of s.enemies || []) if (e.alive && e.state !== 'dead' && (e.feet > H0 + 200 || e.x < -200 || e.x > W0 + 200)) push(finding('void', `Gegner ${e.id} ist aus dem Level gefallen (Kachel ${Math.round(e.x / s.T)},${Math.round(e.feet / s.T)}, Level ${Math.round(W0 / s.T)}×${Math.round(H0 / s.T)})`, { enemy: e.id, spawn: e.spawnAt || null }));
      }
      // 3) numbers in range
      if (!Number.isFinite(sv.deltas) || sv.deltas < 0) push(finding('numbers', `Δ ist ${sv.deltas}`));
      if (sv.tank && !sv.tank.dead && !(sv.tank.cond >= 0 && sv.tank.cond <= 100)) push(finding('numbers', `Tank-Zustand ${sv.tank.cond}`));
      if (!(l.health >= 0) || l.health > l.maxHealth + 0.5) push(finding('numbers', `Leben ${l.health}/${l.maxHealth}`));
      // 4) a window open for long without the bot asking for it, or nothing moving at all (softlock)
      const sig = [s.mode, Math.round(l.x / 64), Math.round(l.feet / 64), sv.day, sv.hour, h.modal, !!h.build?.active].join('|');
      if (sig === last) still++; else { still = 0; last = sig; }
      if (still >= 6) push(finding('softlock', `Nichts bewegt sich seit Minuten (${h.modal ? 'Menü „' + (h.menuState()?.title || '?') + '“ offen' : s.mode}, Kachel ${Math.round(l.x / 64)},${Math.round(l.feet / 64)})`));
      // 5) the savegame survives saving and loading (every 10 game minutes)
      if (frame - saveAt >= 600 * 60) {
        saveAt = frame;
        try {
          const { repairSave } = await import(new URL('game/save.js', location.href).href);
          const raw = JSON.parse(JSON.stringify(sv)), back = repairSave(raw, s.data_);
          const sum = x => ({ day: x.day, hour: x.hour, deltas: x.deltas, location: x.location, units: (x.rig?.units || []).map(u => u.id + ':' + (u.workshops || []).map(w => w.id).sort().join(',')).join('|'), bag: (x.inv?.grids?.backpack?.items || []).map(e => e.id + '×' + e.n).sort().join(','), camp: (x.inv?.grids?.camp?.items || []).reduce((n, e) => n + e.n, 0), tank: x.tank && Math.round(x.tank.cond), recipes: (x.recipes || []).length, nodes: (x.nodes || []).length });
          const a = sum(sv), b = sum(back), diff = Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
          if (diff.length) push(finding('save', `Speichern + Laden ändert: ${diff.map(k => `${k} ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`).join('; ').slice(0, 300)}`));
          C.touch('check', 'Speichern + Laden');
        } catch (e) { push(finding('save', `Speichern + Laden wirft: ${e.message}`)); }
      }
      return out;
    },
  };
})();
