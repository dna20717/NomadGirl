// What Leyla does in the camp (#017 split from camp.js): use a workshop, sleep, sit by the fire, the warroom, the van door, driving.
// Mixed into Camp (game/play/camp.js): the methods keep their `this`, nothing else changes.
import { ensureMap, placeOf } from '../worldmap.js';
import { rollEncounter, choose, blocked } from '../travel.js';
import { potsOf, stage, ripe, harvest, STAGES, canWater, waterOf, water } from '../garden.js';
import { level as cisternLevel, tap as cisternTap } from '../cistern.js';
import { clockText, advance, hoursUntil } from '../save.js';
import { passengers } from '../rig.js';
import { occupancy } from '../inventory.js';
import { de, VERB, SOON, costLine } from './camp.js';

export class CampActions {
  // ---------- actions ----------
  use(id, place = null) {
    const def = this.D.workshops?.[id] || {}, s = this.scene;
    if (this.noPower && def.power < 0 && def.function !== 'warroom' && def.function !== 'tank')
      return s.hud.menu({ title: def.name || id, sub: `Kein Strom: das Rig erzeugt ${this.budget.power.made} ⚡ und braucht ${this.budget.power.used} ⚡. Generator einbauen oder Verbraucher ausbauen (B: Rig umbauen).`,
        items: [{ label: 'Rig umbauen', primary: true, act: () => s.openBuild() }, { label: 'Zurück', act: () => {} }] });
    if (def.function === 'sleep') return this.sleep(def);
    if (def.function === 'warroom') return this.warroom();
    if (['kitchen', 'craft', 'cyber', 'tank', 'foodtruck', 'power'].includes(def.function)) { s.hud.inv?.close(); return s.hud.craft?.open(id); }   // #013: foodtruck counter, regulator
    if (def.function === 'drone') {   // AvA's board (#013) or her rest (Werkstätten › Benutzen)
      s.hud.inv?.close();
      if (!def.rest?.verb) return s.hud.craft?.open(id);
      return s.hud.menu({ title: def.name || id, sub: def.description || '', items: [{ label: 'Platine bestücken', sub: 'Chips stecken, Kabel löten: AvA wird besser', primary: true, act: () => s.hud.craft?.open(id) },
        { label: def.rest.verb, act: () => this.restMenu(id, def, place, (this.box.save.companions || []).map(c => this.D.companions?.[c]).filter(c => c?.workshops?.includes(id)).map(c => c.name)) }, { label: 'Zurück', act: () => {} }] });
    }
    if (def.function === 'garden') return this.garden(id, def, place);
    if (def.function === 'cistern') return this.cistern(id, def, place);
    if (def.function === 'guests') {   // who sleeps here: the guests in order, as many as there are beds in all guest bunks
      const P = passengers(this.D, this.box.save), nm = c => this.D.companions?.[c]?.name || c, waiting = Object.entries(this.box.save.waiting || {});
      return s.hud.menu({ title: def.name || id, sub: [def.description, P.guests.length ? `Gäste an Bord: ${P.riding.map(nm).join(', ') || '–'} · ${P.beds} ${P.beds === 1 ? 'Bett' : 'Betten'} im Rig.` : `${P.beds} ${P.beds === 1 ? 'Bett' : 'Betten'} frei für Fahrgäste.`,
        P.staying.length ? `Kein Bett für ${P.staying.map(nm).join(', ')}: ${P.staying.length > 1 ? 'sie bleiben' : 'bleibt'} beim nächsten Fahren hier.` : null,
        waiting.length ? 'Wartet: ' + waiting.map(([loc, ids]) => `${ids.map(nm).join(', ')} bei ${placeOf(this.D, this.box.save, loc)?.name || loc}`).join(' · ') : null].filter(Boolean).join(' '), items: [{ label: 'Zurück', act: () => {} }] });
    }
    const who = (this.box.save.companions || []).map(c => this.D.companions?.[c]).filter(c => c?.workshops?.includes(id)).map(c => c.name);
    if (def.rest?.verb) return this.restMenu(id, def, place, who);
    s.hud.menu({ title: def.name || id, sub: [def.description, who.length ? `Betreut von ${who.join(' und ')}.` : null, SOON[def.function] || 'Funktion kommt später.'].filter(Boolean).join(' '),
      items: [{ label: 'Zurück', act: () => {} }] });
  }
  // hydroponics (game/garden.js): what grows, how long until ripe, E harvests the ripe pots into the camp inventories
  garden(id, def, place) {
    const s = this.scene, D = this.D, save = this.box.save, key = place || id, P = potsOf(D, id);
    const rows = (def.garden?.crops || []).map((c, ci) => {
      const mine = P.map((p, i) => ({ p, i })).filter(({ p }) => (Number(p.crop) || 1) - 1 === ci).map(({ i }) => stage(D, save, id, key, i));
      if (!mine.length) return null;
      const r = mine.filter(x => x.stage === STAGES - 1).length, left = Math.min(...mine.filter(x => x.stage < STAGES - 1).map(x => (1 - x.p) * (c.hours || 24)));
      return `${c.name}: ${r ? `${r} reif` : ''}${r && r < mine.length ? ' · ' : ''}${r < mine.length ? `noch ~${Math.max(1, Math.ceil(left))} h` : ''}`;
    }).filter(Boolean);
    const n = ripe(D, save, id, key);
    s.hud.menu({ title: def.name || id, sub: [def.description, ...rows].filter(Boolean).join(' · '),
      items: [{ label: n ? `Ernten (${n})` : 'Noch nichts reif', primary: !!n, disabled: n ? null : 'Wächst noch', act: () => {
        const r = harvest(D, save, id, key);
        const got = r.got.reduce((n, g) => n + g.n, 0); if (got) s.achieve?.('harvests', 1);
        for (const l of r.left) s.loot?.throwDown({ a: 'items', id: l.id, n: l.n, r: 0 });
        this.box.persist?.();
        s.hud.toast(r.got.length ? 'Geerntet' : 'Nichts geerntet', r.got.map(g => `+${g.n} ${D.items?.[g.id]?.name || g.id}`).join(' · '), r.got.length ? 'loot' : 'info', 3000);
        s.drone?.react('curious');
        this.benches?.list.forEach(b => { if (b.plants) b.plantSig = null; });
      } }, (() => { const c = canWater(D, save, id, key), W = waterOf(D, id), nm = D.items?.[W.item]?.name || W.item;
        return W.hours && D.items?.[W.item] ? { label: `Gießen (1 ${nm}${c.have ? ` · ${c.have} da` : ''})`, sub: `Alles wächst ${de(W.hours)} h weiter`, disabled: c.ok ? null : c.why, act: () => {
          const r = water(D, save, id, key);
          this.box.persist?.();
          s.hud.toast(r.ok ? 'Gegossen' : 'Geht nicht', r.ok ? `Die Pflanzen wachsen ${de(r.hours)} h weiter` : r.why, r.ok ? 'good' : 'warn', 2800);
          if (r.ok) s.drone?.react('happy');
          this.benches?.list.forEach(b => { if (b.plants) b.plantSig = null; });
        } } : null; })(), { label: 'Zurück', act: () => {} }].filter(Boolean) });
  }
  // the cistern (game/cistern.js): how full it is, E fills bottles into the camp inventories
  cistern(id, def, place) {
    const s = this.scene, D = this.D, save = this.box.save, key = place || id, L = cisternLevel(D, save, id, key), name = D.items?.[L.item]?.name || L.item;
    const left = L.full >= L.max ? 'voll' : `nächste Flasche in ~${Math.max(1, Math.ceil((1 - (L.water % 1)) / Math.max(0.01, L.perHour)))} h`;
    s.hud.menu({ title: def.name || id, sub: [def.description, `${L.full} von ${L.max} Flaschen · ${left}`].filter(Boolean).join(' · '),
      items: [{ label: L.full ? `Abfüllen (${L.full})` : 'Noch zu wenig Wasser', primary: !!L.full, disabled: L.full ? null : 'Sammelt noch', act: () => {
        const r = cisternTap(D, save, id, key);
        this.box.persist?.();
        s.hud.toast(r.got ? `+${r.got} ${name}` : 'Kein Platz im Rucksack', '', r.got ? 'loot' : 'warn', 2600);
        s.drone?.react('happy');
      } }, { label: 'Zurück', act: () => {} }] });
  }
  // a workshop to spend time at (Werkstätten › Benutzen): Chill Area, Drohnenwerkstatt … time passes, heals, gives its buff;
  // AvA can fly over and dock on the bench while it happens
  restMenu(id, def, place, who) {
    const s = this.scene, save = this.box.save, R = def.rest, buff = def.buff && this.D.buffs?.[def.buff]?.name;
    const facts = [R.hours ? `${de(R.hours)} h` : null, R.heal ? `heilt ${R.heal} %` : null, buff ? `danach ${buff}` : null].filter(Boolean).join(' · ');
    s.hud.menu({ title: def.name || id, sub: [def.description, who.length ? `Betreut von ${who.join(' und ')}.` : null, facts].filter(Boolean).join(' '),
      items: [{ label: R.verb, primary: true, act: () => {
        const done = () => {
          this.resting = null;
          advance(save, R.hours || 0);
          if (R.heal) save.health = Math.min(s.leyla.maxHealth, s.leyla.health + s.leyla.maxHealth * R.heal / 100);
          if (def.buff && !save.buffs.includes(def.buff)) save.buffs.push(def.buff);
          s.goCamp({ banner: [R.banner || def.name || id, clockText(save) + (buff ? ' · ' + buff : '')], fade: 700, keepPlace: true });
        };
        this.resting = place;   // the bench's "Bei Benutzung" effects run meanwhile
        const dock = R.drone && place && this.benches?.dockOf(place);
        if (dock && s.drone) { s.drone.dock = { ...dock, until: s.time.now + 3200 }; s.drone.react('cleared'); s.time.delayedCall(3000, done); }
        else s.time.delayedCall(1400, done);
      } }, { label: 'Zurück', act: () => {} }] });
  }
  // the van door (#016, Daniel 14.11.2026: Losziehen in einem Schritt): straight to the map with this place chosen; the van's own
  // workshops (bunk, kitchen) sit as buttons in its header
  vanMenu(ids) {
    const extras = ids.map(w => { const d = this.D.workshops?.[w.id] || {}; return { label: VERB[d.function] || d.name || w.id, icon: d.function === 'sleep' ? 'moon' : d.function === 'kitchen' ? 'light' : 'workbench', act: () => this.use(w.id) }; });
    this.openMap({ extras, sel: this.box.save.location });
  }
  // Loadout-Check next to „Hier plündern“ (#016): what Leyla takes along, each line ok or a warning
  loadout() {
    const D = this.D, save = this.box.save, inv = save.inv || {}, G = inv.grids || {}, l = this.scene.leyla, out = [];
    const max = l?.maxHealth || 100, hp = Math.round(Math.min(max, save.health ?? max));
    out.push({ icon: 'heart', label: 'Leben', value: `${hp}/${max}`, warn: hp < max * 0.6 });
    const wn = id => { const w = D.weapons?.[id] || D.weapons?.[String(id).split('#')[0]]; return w?.name || null; };
    const mel = wn(inv.slots?.melee), rng = wn(inv.slots?.ranged);
    out.push({ icon: 'weapon', label: 'Waffen', value: [mel, rng].filter(Boolean).join(' · ') || 'keine', warn: !mel && !rng });
    const heal = Object.values(G.backpack?.items || []).filter(e => { const t = D[e.a]?.[e.id]; const b = t?.buff && D.buffs?.[t.buff]; return b?.stat === 'health' || t?.heal; }).reduce((n, e) => n + (e.n || 1), 0);
    out.push({ icon: 'plus', label: 'Heilung', value: heal ? `${heal}× im Rucksack` : 'nichts dabei', warn: !heal });
    const bp = G.backpack;
    if (bp) { const used = occupancy(D, bp).size, all = bp.w * bp.h, free = Math.round((1 - used / Math.max(1, all)) * 100); out.push({ icon: 'bags', label: 'Rucksack', value: `${free} % frei`, warn: free < 35 }); }
    const buffs = (save.buffs || []).map(b => D.buffs?.[b]?.name || b);
    out.push({ icon: 'star', label: 'Buffs', value: buffs.length ? buffs.join(' · ') : 'keine (Kochen, Schlafen)', warn: !buffs.length, soft: true });
    const pocket = G.drone; if (pocket) out.push({ icon: 'armor', label: 'AvAs Rettungsfach', value: pocket.items.length ? `${pocket.items.length} gesichert` : 'leer', soft: true });
    return out;
  }
    sleep(def) {
    const s = this.scene, box = this.box, save = box.save, C = this.C, max = s.leyla.maxHealth;
    const h = hoursUntil(save, C.clock?.wakeHour ?? 7);
    s.hud.menu({ title: def.name || 'Schlafen', sub: `Schlafen bis ${String(C.clock?.wakeHour ?? 7).padStart(2, '0')}:00 (${h} h). Heilt ${C.heal?.sleep ?? 100} %.${def.buff ? ` Danach: ${this.D.buffs?.[def.buff]?.name || def.buff} für den nächsten Run.` : ''}`,
      items: [{ label: 'Schlafen', primary: true, act: () => {
        advance(save, h);
        save.health = Math.min(max, Math.max(save.health, s.leyla.health) + max * (C.heal?.sleep ?? 100) / 100);
        if (def.buff && !save.buffs.includes(def.buff)) save.buffs.push(def.buff);
        s.drone.react('sleep');
        s.achieveLater?.('sleeps');
        s.goCamp({ banner: ['Guten Morgen, Leyla', `${clockText(save)}${def.buff ? ' · ' + (this.D.buffs?.[def.buff]?.name || def.buff) : ''}`], fade: 900 });
      } }, { label: 'Noch nicht', act: () => {} }] });
  }
  // Leyla sits down next to the fire on the side she came from, facing the flames, and games (Camp › Am Feuer sitzen).
  // Standing up after a while: the time moves on and the fire heals; without a sit animation straight to that.
  sitDown() {
    const s = this.scene, l = s.leyla, S = this.C.fire?.sit || {}, side = l.x >= this.geo.fireX ? 1 : -1;
    const rest = () => {
      const save = this.box.save, C = this.C, max = l.maxHealth;
      advance(save, C.clock?.fireHours ?? 1);
      save.health = Math.min(max, l.health + max * (C.heal?.fire ?? 25) / 100);
      s.goCamp({ banner: ['Knistern und Funken', clockText(save)], fade: 600, keepPlace: true });
    };
    if (!S.look || !s.textures.exists(S.look)) return rest();
    l.startSit(S, this.geo.fireX + side * (S.distance ?? 150), -side, sat => { if (sat >= (S.minSeconds ?? 3)) rest(); });
  }
  fireMenu() {
    const s = this.scene, n = s.hud.quests?.log()?.offers?.length || 0, ready = (s.hud.quests?.log()?.active || []).filter(q => q.ready).length;
    s.hud.menu({ title: 'Lagerfeuer', sub: 'Knistern, Funken, Zeit zum Nachdenken.', items: [
      { label: 'Hinsetzen', sub: 'Die Zeit vergeht, das Feuer heilt', primary: true, act: () => this.sitDown() },
      { label: 'Questlog', sub: [ready ? `${ready} zum Abgeben` : null, n ? `${n} neue Angebote` : null].filter(Boolean).join(' · ') || 'Die Suche, AvAs Tank, Aufträge', act: () => s.hud.quests?.open(ready ? 'active' : n ? 'offers' : 'active') },
      { label: 'Zurück', act: () => {} }] });
  }
  // Warroom: the travel map (#007) with the POI here, the places to drive to, and the techtree / Auswerten in its header
  warroom() {
    const s = this.scene, D = this.D, save = this.box.save, extras = [];
    if (Object.keys(D.techtree || {}).length) extras.push({ label: 'Techtree', icon: 'tree', act: () => { s.hud.inv?.close(); s.hud.tech?.open(); } });
    const wr = this.rigWorkshop('warroom') || Object.keys(D.workshops || {}).find(k => D.workshops[k].function === 'warroom');
    if (wr) extras.push({ label: 'Auswerten', icon: 'research', act: () => { s.hud.inv?.close(); s.hud.craft?.open(wr, 'salvage'); } });
    extras.push({ label: 'Questlog', icon: 'list', act: () => { s.hud.inv?.close(); s.hud.quests?.open(); } });   // #016
    this.openMap({ extras });
  }
  // the first built-in workshop of a kind (function) anywhere in the rig, or null
  rigWorkshop(fn) { for (const u of this.box.save.rig.units) for (const w of u.workshops || []) if (this.D.workshops?.[w.id]?.function === fn) return w.id; return null; }
  // the travel map at the warroom and at the van door (Daniel: „Beides“)
  openMap(opts = {}) { const s = this.scene; s.hud.inv?.close(); ensureMap(this.D, this.box.save); s.hud.map?.open(opts); }
  // why the rig cannot drive (too heavy, too little fuel)
  driveBlocked(t) { const save = this.box.save; return this.tooHeavy ? `Rig zu schwer (${this.budget.weight} von ${this.budget.pull} kg)` : t.fuel > save.fuel ? 'Zu wenig Sprit' : null; }
  plunderHere() { const here = placeOf(this.D, this.box.save); if (here?.poi && this.D.pois?.[here.poi]) this.scene.startRun(here.poi); }
  // driving (#014: several legs, an encounter may happen after each one; Welt › Encounter, Reisen › Chance pro 10 km)
  drive(id, t) {
    const save = this.box.save, legs = t.legs?.length ? t.legs : [{ from: save.location, to: id, km: t.km, hours: t.hours, fuel: t.fuel, food: t.food }];
    this.driving = { id, t, legs, log: [], from: save.location };
    this.nextLeg(0);
  }
  nextLeg(i) {
    const save = this.box.save, D = this.D, R = this.driving, s = this.scene;
    if (!R) return;
    if (i >= R.legs.length) return this.arrive();
    const L = R.legs[i];
    advance(save, L.hours);
    save.fuel = Math.max(0, Math.round((save.fuel - L.fuel) * 10) / 10);
    save.food = Math.max(0, Math.round((save.food - L.food) * 10) / 10);
    if (save.map && L.to !== R.id && !save.map.visited.includes(L.to)) save.map.visited.push(L.to);   // passed through
    // under remote control (nomad, tests) no random encounters, unless forced (scene.forceEncounter = id) or wanted (scene.randomEncounters)
    const enc = s.forceEncounter || (s.script && !s.randomEncounters ? null : rollEncounter(D, save, L.km));
    s.forceEncounter = null;
    const E = enc && D.encounters?.[enc];
    if (!E) return this.nextLeg(i + 1);
    s.achieveLater?.('encounters');
    const where = placeOf(D, save, L.to)?.name || L.to, opts = E.options || [];
    const pick = o => { const r = choose(D, save, o); R.log.push(`${E.name}: ${[r.text, r.lines.join(', ')].filter(Boolean).join(' ')}`);
      s.hud.toast(E.name, [r.text, r.lines.join(' · ')].filter(Boolean).join(' · '), o.health || o.deltas < 0 || o.fuel > 0 ? 'warn' : 'travel', 4200);
      this.box.persist?.(); s.time.delayedCall(s.script ? 0 : 120, () => this.nextLeg(i + 1)); };
    const fallback = opts.find(o => !blocked(D, save, o)) || opts[opts.length - 1];
    const look = (E.look && D.assets?.[E.look]?.file) ? E.look : D.travel?.encounterLook, file = look && D.assets?.[look]?.file;   // #021 comic panel
    s.hud.menu({ image: file ? new URL(file, s.base).href : null, title: E.name, sub: [E.description, `Etappe ${i + 1} von ${R.legs.length} · kurz vor ${where} · ${clockText(save)}`].filter(Boolean).join(' · '),
      items: opts.map(o => ({ label: o.label || 'Weiter', sub: costLine(D, o), disabled: blocked(D, save, o), primary: o === opts[0], act: () => pick(o) })),
      onClose: () => pick(fallback) });
  }
  arrive() {
    const save = this.box.save, D = this.D, R = this.driving, id = R.id, t = R.t, from = R.from;
    this.driving = null;
    // guests without a bed wait where they are; whoever waits at the new place comes back aboard
    const P = passengers(D, save);
    save.waiting ||= {};
    if (P.staying.length) { save.waiting[from] = [...new Set([...(save.waiting[from] || []), ...P.staying])]; save.companions = save.companions.filter(c => !P.staying.includes(c)); }
    const back = save.waiting[id] || [];
    if (back.length) { save.companions = [...new Set([...save.companions, ...back])]; delete save.waiting[id]; }
    save.location = id;
    this.scene.achieveLater?.('trips');
    if (save.map && !save.map.visited.includes(id)) save.map.visited.push(id);
    const left = P.staying.map(c => D.companions?.[c]?.name || c), met = back.map(c => D.companions?.[c]?.name || c);
    this.scene.goCamp({ banner: [`Angekommen: ${placeOf(D, save, id)?.name || id}`, [`${clockText(save)} · ${t.km} km${R.legs.length > 1 ? ` in ${R.legs.length} Etappen` : ''} · −${de(t.fuel)} l Sprit`, left.length ? `${left.join(', ')} wartet bei ${placeOf(D, save, from)?.name || from}` : '', met.length ? `${met.join(', ')} steigt wieder ein` : ''].filter(Boolean).join(' · '), 'travel'], fade: 900, arriving: true });
  }
}
