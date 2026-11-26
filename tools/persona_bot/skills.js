// Testpilot skills (#191): what a player does in the camp and on the road, driven through the real windows and their own functions
// (the build mode through its pointer, the workshop window through make / takeApart, the tech tree through buy, the travel map, the drive).
// Loaded by tools/persona_bot.mjs next to brain.js; the brain calls them as camp jobs ('skill:travel' …). Every skill returns
// { ok, what, note } and writes what it touched into window.coverage (checks.js).
(() => {
  const S = () => game.scene.getScene('play'), H = () => S().hud, bot = () => window.personaBot;
  const cov = (k, v) => window.coverage?.touch(k, v);
  const wait = (k, hold = [], tap = []) => bot().wait(k, hold, tap);
  const res = (ok, what, note = '') => ({ ok, what, note });
  let INV = null; import(new URL('game/inventory.js', location.href).href).then(m => { INV = m; });   // the inventory core (same module the game uses)
  let TECH = null; import(new URL('game/techtree.js', location.href).href).then(m => { TECH = m; });
  let WORK = null; import(new URL('game/workers.js', location.href).href).then(m => { WORK = m; });
  const addBack = (D, grid, e) => INV ? INV.addEntry(D, grid, e, e.n || 1) === 0 : false;
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
      want ??= skills.lastBought; skills.lastBought = null;
      const id = want && spare.includes(want) ? want : spare.find(w => !D.workshops?.[w]?.fixed);
      if (!id) return res(true, 'build', 'nichts im Schrottplatz');
      s.openBuild(); wait(40);
      const b = H().build;
      if (!b?.active) return res(false, 'build', 'Bau-Modus geht nicht auf');
      cov('window', 'Bau-Modus');
      const item = (s.camp.yardItems || []).find(it => it.id === id && it.kind === 'ws');
      // a place: empty first, else one whose workshop is neither fixed nor the one we need for cooking
      const slots = b.slots(), wsAt = sl => (R.units[sl.ui]?.workshops || []).find(w => w.at === sl.p);
      const free = slots.find(sl => !wsAt(sl)) || slots.find(sl => { const w = wsAt(sl); return w && !D.workshops?.[w.id]?.fixed && !['kitchen', 'tank'].includes(fn(D, w.id)) && !['bitfarm', 'chill_area'].includes(w.id); });   // what the Bit-Farm skill needs stays
      if (!item || !free) { b.close(); wait(30); return res(false, 'build', !item ? `${id} liegt nicht sichtbar im Schrottplatz` : 'kein Platz im Rig'); }
      const v = b.viewBox(), cam = s.cam, scr = w => ({ x: (w.x - v.x) * v.z + cam.x, y: (w.y - v.y) * v.z + cam.y });
      const a = scr({ x: (item.x0 + item.x1) / 2, y: (item.y0 + item.y1) / 2 }), z = scr({ x: (free.x0 + free.x1) / 2, y: (free.y0 + free.y1) / 2 });
      b.pointerDown({ button: 0, ...a }); wait(2);
      for (let i = 1; i <= 8; i++) { b.pointerMove({ x: a.x + (z.x - a.x) * i / 8, y: a.y + (z.y - a.y) * i / 8, event: { buttons: 1 } }); wait(2); }
      b.pointerUp({ button: 0, ...z }); wait(10);
      const st = nomad.build(), swapped = wsAt(free)?.id, placed = (s.box.save.rig.units || []).some(u => (u.workshops || []).some(w => w.id === id));
      cov('build', id);
      b.close(); wait(30);
      for (let k = 0; k < 80 && nomad.build()?.working; k++) wait(60);   // Leyla screws it in
      return res(placed, 'build', placed ? `${id} eingebaut${swapped && swapped !== id ? ` (statt ${swapped})` : ''}` : `${id} nicht eingebaut: ${st?.msg?.text || st?.msg || 'ohne Meldung'}`);
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
    // ---- DuellMode / hacking: the duel window that E at a KI machine or terminal opened; a few real moves, then the rest at once ----
    duel() {
      const D = H().duel;
      if (!D?.isOpen) return res(false, 'duel', 'Duell-Fenster ist nicht offen');
      cov('window', 'Glitch-Duell');
      const st0 = D.state(); cov('duel', st0.foe);
      if (D.phase === 'pick') { D.act('ok'); wait(2); }
      for (let k = 0; k < 6 && D.view?.duel && !D.view.duel.winner; k++) {
        if (D.view.canAct?.()) { for (let r = Math.floor(Math.random() * 3); r > 0; r--) D.act(Math.random() < 0.5 ? 'left' : 'right'); D.act('ok'); cov('duel', 'Zug'); }
        wait(20);
      }
      if (D.view?.duel && !D.view.duel.winner) D.quick();
      const st = D.state();
      if (D.isOpen) { D.act('ok'); wait(5); }
      if (D.isOpen) D.close();
      wait(10);
      return res(!!st.winner, 'duel', `${st0.foe || '?'}: ${st.winner === 'player' ? 'gewonnen' : st.winner ? 'verloren' : 'ohne Ende'}`);
    },
    // ---- trading at Schraube: sell the stack he pays most for, buy the cheapest thing that fits the purse ----
    trade(who = 'Schraube') {
      bot().expectMenu = true;
      if (!bot().goTo(who)) { bot().expectMenu = false; return res(true, 'trade', `${who} ist nicht im Camp`); }
      wait(1, [], ['grab']); wait(8);
      const m = H().menuState(), i = m ? m.items.findIndex(x => /handeln/i.test(x.label) && !x.disabled) : -1;
      if (i < 0) { if (m) H().choose(m.items.findIndex(x => /zurück/i.test(x.label))); bot().expectMenu = false; wait(5); return res(true, 'trade', `${who}: noch kein Handel`); }
      const sub = m.items[i].sub;
      H().choose(i); wait(8); bot().expectMenu = false;
      const T = H().trade;
      // „Handeln“ opens the window with setTimeout(…, 0): after this synchronous chunk. Open it the same way at once (the same trader).
      if (T && !T.isOpen) { const tid = Object.keys(S().data_.traders || {}).find(k => S().data_.traders[k].name === sub); if (tid) { T.open(tid); wait(2); } }
      if (!T?.isOpen) return res(false, 'trade', `${who}: Händlerfenster geht nicht auf`);
      cov('window', 'Händler');
      const d0 = nomad.save().deltas, s0 = T.state(), notes = [];
      if (s0.sell.length) {
        const best = s0.sell.map((x, j) => ({ j, v: Number(x.split('@')[1]) * Number(x.split('×')[1].split('@')[0]) })).sort((a, b) => b.v - a.v)[0];
        T.pick = best.j; T.act('send'); wait(3); notes.push(T.state().note); cov('trade', 'verkauft');
      }
      T.act('next'); wait(2);
      const s1 = T.state();
      if (s1.tab !== 'sell' && s1.buy.length) {
        const cheap = s1.buy.map((x, j) => ({ j, p: Number(x.split('@')[1]) })).filter(x => x.p <= nomad.save().deltas).sort((a, b) => a.p - b.p)[0];
        if (cheap) { T.pick = cheap.j; T.act('ok'); wait(3); notes.push(T.state().note); cov('trade', 'gekauft'); }
      }
      T.close(); wait(5);
      return res(true, 'trade', `${who}: ${notes.filter(Boolean).join(' · ') || 'nichts zu handeln'} (Δ ${d0} → ${nomad.save().deltas})`);
    },
    // ---- crew: a settler waiting at the fire is taken in and gets the first job offered ----
    crew() {
      const s = S(), sv = s.box.save;
      if (!sv.applicant) { cov('crew', `Crew ${sv.crew?.length || 0}`); return res(true, 'crew', `kein Bewerber (Crew ${sv.crew?.length || 0})`); }
      bot().expectMenu = true;
      bot().goTo('Lagerfeuer'); s.camp.fireMenu?.(); wait(3);
      let ok = nomad.choose('Bewerber');
      if (ok) ok = nomad.choose('Aufnehmen');
      const jobs = (H().menuItems || []).filter(x => !x.disabled && !/zurück/i.test(x.label));
      if (ok && jobs.length) { H().choose(H().menuItems.indexOf(jobs[0])); wait(3); cov('crew', 'Job vergeben'); }
      while (H().modal) { const m = H().menuState(); H().choose(Math.max(0, m.items.findIndex(x => /zurück|schließen/i.test(x.label)))); wait(2); if (!H().modal) break; H().modal = false; }
      bot().expectMenu = false;
      cov('crew', ok ? 'aufgenommen' : 'nicht aufgenommen');
      return res(ok && (sv.crew?.length || 0) > 0, 'crew', ok ? `aufgenommen: ${sv.crew?.at(-1)?.name || '?'}${jobs[0] ? ' · ' + jobs[0].label : ''}` : 'Bewerber da, aber „Aufnehmen“ fehlt');
    },
    // ---- jobs (#193): the questlog takes the first offer and hands in what is done; NPC menus offer the same („Abgeben: …“) ----
    quests() {
      const h = H(), Q = h.quests;
      if (!Q) return res(false, 'quests', 'kein Questlog');
      Q.open('offers'); wait(3);
      if (!Q.isOpen) return res(false, 'quests', 'Questlog geht nicht auf');
      cov('window', 'Questlog');
      const notes = [], st0 = Q.state();
      if (st0.rows?.length) { Q.pick = 0; Q.act('ok'); wait(2); notes.push('angenommen'); cov('quest', 'angenommen'); }
      Q.open('active'); wait(2);
      const rows = Q.state().rows || [];
      rows.forEach((r, i) => { if (/!$/.test(r)) { Q.pick = i; Q.act('ok'); wait(2); notes.push('abgegeben: ' + r.replace(/^side:|!$/g, '')); cov('quest', 'abgegeben'); } });
      Q.close(); wait(3);
      // at the NPCs: what they want back
      for (const who of ['Schraube', 'Onkel Sung']) {
        bot().expectMenu = true;
        if (!bot().goTo(who)) { bot().expectMenu = false; continue; }
        wait(1, [], ['grab']); wait(6);
        const m = h.menuState(), j = m ? m.items.findIndex(x => /^Abgeben:/.test(x.label) && !x.disabled) : -1;
        if (j >= 0) { notes.push(m.items[j].label); h.choose(j); wait(5); cov('quest', 'beim NPC abgegeben'); }
        while (h.modal) { const mm = h.menuState(); const k = mm.items.findIndex(x => /tschüss|zurück|schließen/i.test(x.label)); h.choose(k >= 0 ? k : mm.items.length - 1); wait(2); if (h.modal && h.menuState()?.title === mm.title) { h.modal = false; break; } }
        bot().expectMenu = false;
      }
      return res(true, 'quests', notes.join(' · ') || `nichts zu tun (${(st0.rows || []).length} Angebote)`);
    },
    // ---- the dealer in the build mode: buy a workshop the rig does not have yet (Bit-Farm, Chill-Ecke, Ripperdoc …), build() puts it in ----
    shop() {
      const s = S(), D = s.data_, R = s.box.save.rig, have = new Set((R.units || []).flatMap(u => (u.workshops || []).map(w => w.id)));
      const all = ['bitfarm', 'chill_area', 'ripperdoc', 'werkbank', 'warroom'].filter(id => D.workshops?.[id] && !have.has(id));
      const locked = all.filter(id => TECH?.techLock(D, s.box.save, 'workshops', id));
      const want = all.filter(id => !locked.includes(id) && (D.workshops[id].value ?? 0) <= s.box.save.deltas);
      const waiting = all.filter(id => (R.spare?.workshops || []).includes(id));
      if (waiting.length) return res(true, 'shop', `${waiting.join('/')} wartet noch im Schrottplatz auf Platz`);
      if (!want.length) return res(true, 'shop', `nichts Neues bezahlbar (${s.box.save.deltas} Δ${locked.length ? ', Techtree fehlt für ' + locked.join('/') : ''})`);
      s.openBuild(); wait(40);
      const b = H().build;
      if (!b?.active) return res(false, 'shop', 'Bau-Modus geht nicht auf');
      cov('window', 'Händler-Platz');
      const d0 = s.box.save.deltas; b.buy('workshops', want[0]); wait(10);
      const got = (s.box.save.rig.spare?.workshops || []).includes(want[0]);
      const msg = b.msg?.text || b.msg || '';
      b.close(); wait(30);
      for (let k = 0; k < 40 && nomad.build()?.working; k++) wait(60);
      if (got) { skills.lastBought = want[0]; cov('bought', want[0]); }
      return res(got || /Techtree/.test(msg), 'shop', got ? `${want[0]} gekauft (${d0} → ${s.box.save.deltas} Δ)` : `${want[0]}: ${msg || 'nicht gekauft'}`);
    },
    // ---- cyberware (#006): an implant from the backpack or the Camp-Lager onto its place, through the inventory's own hand ----
    implants() {
      const s = S(), D = s.data_, inv = s.box.save.inv, U = H().inv;
      const IMPL = ['eyes', 'nerves', 'arm', 'heart', 'legs', 'skin'];
      let found = null;
      for (const key of ['backpack', 'camp']) for (const e of inv.grids[key]?.items || []) { const w = e.a === 'items' && D.items?.[e.id]?.wear; if (w && IMPL.includes(w) && inv.wear?.[w] !== e.id) { found = { key, e, w }; break; } }
      if (!found) return res(true, 'implants', 'kein Implantat im Rucksack oder Lager');
      U.open(); wait(3);
      if (!U.isOpen) return res(false, 'implants', 'Inventar geht nicht auf');
      cov('window', 'Inventar');
      U.view = 'implants'; U.draw?.(); wait(2); cov('window', 'Implantate');
      const g = inv.grids[found.key], i = g.items.indexOf(found.e);
      g.items.splice(i, 1); U.held = { e: { ...found.e, n: 1 }, from: found.key };
      if ((found.e.n || 1) > 1) g.items.splice(i, 0, { ...found.e, n: found.e.n - 1 });
      U.slotClick('wear:' + found.w); wait(3);
      const now = inv.wear[found.w] === found.e.id;
      if (U.held) { addBack(D, inv.grids[found.key], U.held.e); U.held = null; }   // still in the hand (refused, or the old one came off): back into the grid
      U.close(); wait(3);
      cov('implant', found.e.id);
      return res(true, 'implants', now ? `${found.e.id} eingebaut (${found.w})` : `${found.e.id}: nicht eingebaut (${U.lastNote || 'Belastung oder Regel'})`);
    },
    // ---- Bit-Farm (#060): a caught Entity moves into the farm and works at a workshop; the Chill-Ecke offers a friendly duel ----
    bitfarm() {
      const s = S(), D = s.data_, sv = s.box.save, keys = WORK ? WORK.farmKeys(D, sv) : [];
      const hasFarm = (sv.rig.units || []).some(u => (u.workshops || []).some(w => w.id === 'bitfarm'));
      if (!hasFarm) return res(true, 'bitfarm', 'keine Bit-Farm im Rig');
      cov('window', 'Bit-Farm');
      const notes = [];
      // an Entity from the deck, the backpack or the Camp-Lager into the farm
      const farm = keys.map(k => sv.inv.grids[k]).find(Boolean);
      if (farm) for (const key of ['deck', 'backpack', 'camp']) {
        const g = sv.inv.grids[key], e = g?.items?.find(x => x.g);
        if (!e) continue;
        g.items.splice(g.items.indexOf(e), 1);
        if (addBack(D, farm, e)) { notes.push(`${e.g.name} in die Bit-Farm`); cov('bitfarm', 'Entity eingezogen'); } else { g.items.push(e); notes.push('Bit-Farm voll'); }
        break;
      }
      // a worker: the camp's own menu
      const ent = farm?.items?.find(x => x.g);
      if (ent && s.camp.workerMenu) {
        bot().expectMenu = true; s.camp.workerMenu(ent.g); wait(2);
        const m = H().menuState(), j = m ? m.items.findIndex(x => !x.disabled && !/zurück|abziehen/i.test(x.label)) : -1;
        if (j >= 0) { notes.push(`Worker: ${m.items[j].label.split(' · ')[0]}`); H().choose(j); wait(3); cov('bitfarm', 'Worker'); }
        while (H().modal) { const mm = H().menuState(); H().choose(Math.max(0, mm.items.findIndex(x => /zurück/i.test(x.label)))); wait(2); if (H().modal) { H().modal = false; break; } }
        bot().expectMenu = false;
      }
      // the Chill-Ecke: a friendly duel
      const chill = s.camp.benches?.list?.find(b => b.id === 'chill_area');
      if (chill) {
        bot().expectMenu = true; s.camp.use('chill_area', chill.place); wait(3);
        const m = H().menuState(), j = m ? m.items.findIndex(x => /duell/i.test(x.label) && !x.disabled) : -1;
        if (j >= 0) { H().choose(j); wait(5); if (H().duel?.isOpen) { const r = skills.duel(); notes.push('Chill-Ecke: ' + r.note); cov('bitfarm', 'Freundschaftsduell'); } }
        else if (m) notes.push(`Chill-Ecke: ${m.items.map(x => x.label).join('/')}`);
        while (H().modal) { const mm = H().menuState(); H().choose(Math.max(0, mm.items.findIndex(x => /zurück/i.test(x.label)))); wait(2); if (H().modal) { H().modal = false; break; } }
        bot().expectMenu = false;
      }
      return res(true, 'bitfarm', notes.join(' · ') || 'keine Entity zum Einziehen');
    },
    // ---- AvA's tank: a maintenance recipe at the cryo tank ----
    tank() {
      const t = nomad.save().tank;
      if (!t || t.dead) return res(true, 'tank', 'kein Tank');
      if (t.cond >= 99) return res(true, 'tank', 'Tank voll');
      const spot = benchSpot('tank');
      if (!spot) return res(false, 'tank', 'Cryo-Tank nicht im Rig');
      const before = t.cond, c = openBench(spot) || (wait(60), openBench(spot));   // a second try (right after a scene change)
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
