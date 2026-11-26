// Testpilot skills (#191): what a player does in the camp and on the road, driven through the real windows and their own functions
// (the build mode through its pointer, the workshop window through make / takeApart, the tech tree through buy, the travel map, the drive).
// Loaded by tools/persona_bot.mjs next to brain.js; the brain calls them as camp jobs ('skill:travel' …). Every skill returns
// { ok, what, note } and writes what it touched into window.coverage (checks.js).
(() => {
  const S = () => game.scene.getScene('play'), H = () => S().hud, bot = () => window.personaBot;
  const cov = (k, v) => window.coverage?.touch(k, v);
  const wait = (k, hold = [], tap = []) => bot().wait(k, hold, tap);
  const res = (ok, what, note = '') => ({ ok, what, note });
  // after a scene change: wait until the new scene stands (no loading bar, the camp built)
  const settle = (max = 900) => { for (let k = 0; k < max; k += 15) { const s = S(); if (s?.leyla && !s.leaving && (s.mode !== 'camp' || s.camp) && !H().drive?.isOpen) return true; wait(15); } return false; };
  const fn = (D, id) => D.workshops?.[id]?.function || null;
  // a workshop in the rig by its function (kitchen, craft, tank …) → its hotspot in the camp
  const benchSpot = fun => {
    const s = S(), D = s.data_, R = s.box.save.rig;
    for (const u of R.units || []) for (const w of u.workshops || []) if (fn(D, w.id) === fun || w.id === fun) {
      const name = D.workshops[w.id]?.name;
      const h = s.camp?.hotspots.find(h => h.ws === w.id || h.name === name || h.name?.startsWith?.(name));
      if (h) return { id: w.id, name: h.name };
    }
    return null;
  };
  const openBench = spot => {
    bot().expectMenu = true;
    bot().goTo(spot.name); wait(1, [], ['grab']); wait(10);
    const h = H(), m = h.menuState();
    if (m) { const i = m.items.findIndex(x => !x.disabled && !/zurück|reden/i.test(x.label)); cov('menu', `${m.title} › ${m.items[i]?.label}`); h.choose(Math.max(0, i)); wait(8); }
    else if (!h.craft?.isOpen) cov('miss', `${spot.name}: kein Menü, kein Fenster (Hinweis: ${h.promptText || '–'})`);
    bot().expectMenu = false;
    return h.craft?.isOpen ? h.craft : null;
  };

  const skills = window.testpilot = {
    // ---- TravelMode: the map at the van, a neighbouring place, the drive with its incidents ----
    travel() {
      const s = S(), from = s.box.save.location, cycle = s.box.save.cycle || 1;
      bot().expectMenu = true;
      bot().goTo('Van'); wait(1, [], ['grab']); wait(10);
      if (H().menuState()) nomad.choose('Planen');
      const m = nomad.map();
      if (!m?.open) { bot().expectMenu = false; return res(false, 'travel', 'Karte geht am Van nicht auf'); }
      cov('window', 'Reisekarte');
      const seen = coverage.set('place'), near = (m.near || []).map(n => typeof n === 'string' ? n : n.id), nodes = H().map?.map?.nodes || [];
      const withPoi = near.filter(id => nodes.find(n => n.id === id)?.poi);   // a place with a POI: there is something to plunder after the drive
      const to = withPoi.find(id => !seen.has(id)) || near.find(id => !seen.has(id)) || withPoi[0] || near[Math.floor(Math.random() * near.length)];
      if (!to) { H().map.close(); bot().expectMenu = false; return res(false, 'travel', 'Kein Nachbarort auf der Karte'); }
      const ok = nomad.choose(to);
      bot().expectMenu = false;
      if (!ok) { H().map?.close(); return res(false, 'travel', `Hinfahren nach ${to} geht nicht (${nomad.map()?.action || '–'})`); }
      // the drive: spool it, answer what comes up on the road
      for (let k = 0; k < 400; k++) {
        const h = H(), d = h.drive;
        if (h.modal) { const mm = h.menuState(); cov('incident', mm?.title); const i = Math.max(0, mm.items.findIndex(x => !x.disabled)); cov('menu', `${mm.title} › ${mm.items[i]?.label}`); h.choose(i); wait(5); continue; }
        if (d?.isOpen) { cov('window', 'Fahrt'); d.skip?.(); wait(15); continue; }
        if (S().box.save.location !== from && !d?.isOpen) break;
        wait(15);
      }
      settle();
      const at = S().box.save.location;
      cov('place', at);
      if ((S().box.save.cycle || 1) !== cycle) return res(true, 'travel', `unterwegs neuer Durchgang (Tank leer), zurück in ${at}`);   // the map and the place start over
      return res(at !== from, 'travel', at !== from ? `${from} → ${at}` : `nach ${to} nicht angekommen`);
    },
    // ---- building: a workshop from the scrapyard into a place of the rig (the real drag of the build mode) ----
    build(want = null) {
      const s = S(), D = s.data_, R = s.box.save.rig, spare = R.spare?.workshops || [];
      const id = want && spare.includes(want) ? want : spare.find(w => !D.workshops?.[w]?.fixed);
      if (!id) return res(true, 'build', 'nichts im Schrottplatz');
      s.openBuild(); wait(40);
      const b = H().build;
      if (!b?.active) return res(false, 'build', 'Bau-Modus geht nicht auf');
      cov('window', 'Bau-Modus');
      const item = (s.camp.yardItems || []).find(it => it.id === id && it.kind === 'ws');
      // a place: empty first, else one whose workshop is neither fixed nor the one we need for cooking
      const slots = b.slots(), wsAt = sl => (R.units[sl.ui]?.workshops || []).find(w => w.at === sl.p);
      const free = slots.find(sl => !wsAt(sl)) || slots.find(sl => { const w = wsAt(sl); return w && !D.workshops?.[w.id]?.fixed && !['kitchen', 'tank'].includes(fn(D, w.id)); });
      if (!item || !free) { b.close(); wait(30); return res(false, 'build', !item ? `${id} liegt nicht sichtbar im Schrottplatz` : 'kein Platz im Rig'); }
      const v = b.viewBox(), cam = s.cam, scr = w => ({ x: (w.x - v.x) * v.z + cam.x, y: (w.y - v.y) * v.z + cam.y });
      const a = scr({ x: (item.x0 + item.x1) / 2, y: (item.y0 + item.y1) / 2 }), z = scr({ x: (free.x0 + free.x1) / 2, y: (free.y0 + free.y1) / 2 });
      b.pointerDown({ button: 0, ...a }); wait(2);
      for (let i = 1; i <= 8; i++) { b.pointerMove({ x: a.x + (z.x - a.x) * i / 8, y: a.y + (z.y - a.y) * i / 8, event: { buttons: 1 } }); wait(2); }
      b.pointerUp({ button: 0, ...z }); wait(10);
      const st = nomad.build(), placed = (s.box.save.rig.units || []).some(u => (u.workshops || []).some(w => w.id === id));
      cov('build', id);
      b.close(); wait(30);
      for (let k = 0; k < 80 && nomad.build()?.working; k++) wait(60);   // Leyla screws it in
      return res(placed, 'build', placed ? `${id} eingebaut` : `${id} nicht eingebaut: ${st?.msg?.text || st?.msg || 'ohne Meldung'}`);
    },
    // ---- cooking / crafting: the first recipe that is ready at a workshop of that function ----
    craftAt(fun = 'kitchen') {
      const spot = benchSpot(fun);
      if (!spot) return res(true, 'craft:' + fun, `keine Werkstatt „${fun}“ im Rig`);
      const c = openBench(spot);
      if (!c) return res(false, 'craft:' + fun, `${spot.name}: Fenster geht nicht auf`);
      cov('window', spot.name);
      const st = c.state(), ready = (st.book || []).filter(r => r.ready);
      if (!ready.length) { c.close(); wait(5); return res(true, 'craft:' + fun, `${spot.name}: kein Rezept bereit (${(st.book || []).length} im Buch)`); }
      const r = ready[Math.floor(Math.random() * ready.length)], before = JSON.stringify(nomad.save().inv.grids);
      c.make(r.id); wait(10);
      const after = c.state(), changed = JSON.stringify(nomad.save().inv.grids) !== before;
      cov('recipe', r.id);
      c.close(); wait(5);
      return res(changed && after.log?.kind !== 'error', 'craft:' + fun, `${spot.name}: ${r.id} → ${after.log?.text || '–'}`);
    },
    cook() { return skills.craftAt('kitchen'); },
    // ---- taking apart at the workbench: Technik for the tech tree ----
    salvage() {
      const spot = benchSpot('craft') || benchSpot('werkbank');
      if (!spot) return res(true, 'salvage', 'keine Werkbank im Rig');
      const c = openBench(spot);
      if (!c) return res(false, 'salvage', 'Werkbank: Fenster geht nicht auf');
      if (!c.canSalvage()) { c.close(); wait(5); return res(true, 'salvage', 'Zerlegen noch gesperrt'); }
      c.setMode('salvage'); wait(3);
      const list = c.state().salvage || [];
      if (!list.length) { c.close(); wait(5); return res(true, 'salvage', 'nichts zum Zerlegen'); }
      const [idn] = list, [id, n] = idn.split('×'), a = nomad.save().inv.grids && (S().data_.weapons?.[id] ? 'weapons' : 'items');
      c.takeApart(a, id, 1); wait(5);
      const log = c.state().log;
      cov('salvage', id);
      c.close(); wait(5);
      return res(log?.kind !== 'error', 'salvage', `${id}: ${log?.text || '–'}`);
    },
    // ---- tech tree: the first node that can be paid now ----
    tech() {
      const h = H();
      if (!h.tech) return res(false, 'tech', 'kein Techtree');
      h.tech.open(); wait(5);
      if (!h.tech.isOpen) return res(true, 'tech', 'Techtree gesperrt');
      cov('window', 'Techtree');
      const st = h.tech.state(), nodes = st.nodes || st.list || [];
      const ready = (Array.isArray(nodes) ? nodes : Object.entries(nodes).map(([id, v]) => ({ id, ...(typeof v === 'string' ? { state: v } : v) }))).filter(n => n.state === 'ready');
      if (!ready.length) { h.tech.close(); wait(3); return res(true, 'tech', 'nichts bezahlbar'); }
      const r = h.tech.buy(ready[0].id); wait(5);
      cov('node', ready[0].id);
      h.tech.close(); wait(3);
      return res(!!r?.ok, 'tech', `${ready[0].id}: ${r?.ok ? 'freigeschaltet' : r?.reason}`);
    },
    // ---- AvA's tank: a maintenance recipe at the cryo tank ----
    tank() {
      const t = nomad.save().tank;
      if (!t || t.dead) return res(true, 'tank', 'kein Tank');
      if (t.cond >= 99) return res(true, 'tank', 'Tank voll');
      const spot = benchSpot('tank');
      if (!spot) return res(false, 'tank', 'Cryo-Tank nicht im Rig');
      const before = t.cond, c = openBench(spot);
      if (!c) return res(false, 'tank', 'Cryo-Tank: Fenster geht nicht auf');
      cov('window', 'Cryo-Tank');
      const ready = (c.state().book || []).filter(r => r.ready);
      if (!ready.length) { c.close(); wait(5); return res(true, 'tank', `keine Wartung bereit (Tank ${Math.round(before)} %)`); }
      c.make(ready[0].id); wait(10);
      const after = nomad.save().tank.cond;
      cov('recipe', ready[0].id);
      c.close(); wait(5);
      return res(after > before, 'tank', `${ready[0].id}: ${Math.round(before)} → ${Math.round(after)} %`);
    },
  };
})();
