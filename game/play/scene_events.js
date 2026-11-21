// Events of the play scene (#017 split from scene.js): knock-out, waking up, the dropped backpack, notes and achievements, kills.
// Mixed into PlayScene (game/play/scene.js): the methods keep their `this`, nothing else changes.
import { gangWar } from '../turf_war.js';
import { tickMorale } from '../morale.js';
import { catchUp, cellKeys } from '../prisoners.js';
import { campArrival } from '../crew.js';
import { storeKeyOf } from '../save.js';
import { rescue } from '../tank.js';
import { addRep, repConfig, levelName } from '../reputation.js';
import { Camp } from './camp.js';
import { droneBonuses } from '../stations.js';
import { add, rollLoot, remove } from '../inventory.js';
import { colorOfItem, knowsColor, learnColor } from './signature.js';
import { learnAll, learnNote } from '../crafting.js';
import { bump, level as achieveLevel, check as achieveCheck } from '../achievements.js';
import { newKeepsakes } from '../keepsakes.js';
import { mod } from '../mods.js';
import { sfxOf } from './sfx.js';

export class SceneEvents {
  // #130 a sound event (Werkstatt › Ton-Ereignisse): code placeholder or produced sample, silent when muted → true when it sounded
  sfx(id, o) { try { return sfxOf(this)?.play(id, o) || false; } catch { return false; } }
  // ---------- events ----------
  onLeylaHit(dmg) { this.sfx('leyla_hurt', { x: this.leyla.x, heavy: dmg >= (this.leyla.d?.hit?.heavyFrom ?? 12) }); this.drone.react('hit'); this.cam.shake(120, 0.006); this.fx.bloodHit(this.leyla.x, this.leyla.chest, -this.leyla.facing || 1, Math.max(0.5, Math.min(1.6, dmg / 15))); this.hud.hurt(); }
  onLeylaDown() {
    this.sfx('leyla_ko', { x: this.leyla?.x });   // #130
    if (this.mode === 'run' && this.box && this.data_.tank?.enabled !== false && this.data_.camp?.koReturn !== 'camp') return this.runKnockout();
    this.hud.banner('AvA schleppt dich raus …', 'Die Run-Beute bleibt liegen.', 3500, 'drama');
    this.cam.shake(300, 0.01);
    this.waitBar(1900, 'AvA schleppt dich raus …', 'Die Run-Beute bleibt liegen.');
    this.time.delayedCall(1900, () => this.mode === 'run' ? this.endRun(true) : this.mode === 'camp' ? this.goCamp() : this.level ? this.restartAs({}) : this.restartRoom());
  }
  // k.o. in a run (Daniel, 12.11.2026, design.md › k.o. neu): AvA drags Leyla back to the start of the run and pays with her tank;
  // the backpack stays where Leyla fell (one chance: a second knock-out before she picks it up and it is gone), what she wears stays,
  // the enemies come back, the rest of the level (vault, chests, doors) stays as it is. The last rescue costs AvA her life.
  runKnockout() {
    const D = this.data_, save = this.box.save, l = this.leyla, C = D.camp || {};
    if (save.tank?.dead) {   // nobody comes any more: the run ends, the dream ends (wakeUp in the camp)
      this.hud.banner('Niemand holt dich mehr …', 'Alles wird schwarz.', 3500, 'drama'); this.cam.shake(300, 0.01); this.cam.fadeOut(1800, 0, 0, 0);
      this.waitBar(1900, 'Niemand holt dich mehr …', 'Alles wird schwarz.', { drone: false, after: 1500 });
      this.time.delayedCall(1900, () => this.endRun(true)); return;
    }
    const r = rescue(D, save);   // the tech tree's bonuses come in by themselves (tank.js › tankMods)
    let lostBefore = false;
    if (this.lostPack) { this.loot.forget(this.lostPack); this.lostPack = null; lostBefore = true; }
    const bag = save.inv.grids.backpack;
    if (bag.items.length) { this.lostPack = this.loot.dropPack(l.x, l.feet, bag); bag.items = []; this.invChanged?.('backpack'); }
    this.cam.shake(300, 0.01);
    this.drone.react('down');
    this.hud.banner(r.last ? 'AvA bringt dich ein letztes Mal zurück …' : 'AvA schleppt dich zum Van …', lostBefore ? 'Dein alter Rucksack ist für immer weg.' : this.lostPack ? 'Dein Rucksack liegt noch da. Hol ihn dir, du hast eine Chance.' : `Der Tank verliert ${Math.round(r.cost)} %.`, 3500, 'drama');
    this.box.persist?.();
    const bar = this.waitBar(1900, r.last ? 'AvA bringt dich ein letztes Mal zurück …' : 'AvA schleppt dich zum Van …', lostBefore ? 'Dein alter Rucksack ist für immer weg.' : this.lostPack ? 'Dein Rucksack liegt noch da.' : `Der Tank verliert ${Math.round(r.cost)} %.`);
    this.time.delayedCall(1900, () => {
      bar?.done();
      l.reset();
      l.health = Math.max(1, Math.round(l.maxHealth * (C.heal?.afterKo ?? 30) / 100));
      l.invulnerableUntil = this.now + 1500;
      this.spawnEnemies();
      if (r.last) { this.drone.die?.(); this.hud.banner('AvA ist fort.', 'Ihr Tank ist still. Leyla ist allein.', 6000, 'drama'); }
      else this.hud.banner('Wieder auf den Beinen', `Tank ${Math.round(save.tank.cond)} % · ${save.tank.rescues}× gerettet`, 3500, 'good');
    });
  }
  // the dream is over: black screen, typed lines, then Leyla sits at the fire; AvA (new, whole) floats down to her
  wakeUp() {
    const save = this.box.save, D = this.data_, T = D.tank?.dream || {};
    this.time.delayedCall(30, () => this.sitForDream());
    const lines = T.lines || ['Leyla schreckt hoch.', 'Schweißgebadet. Das Feuer knistert.', 'AvA summt neben ihr, als wäre nichts gewesen.', 'War alles nur ein Traum?'];
    const kept = (save.nodes || []).length;
    this.hud.dream(lines, `Durchgang ${save.cycle} · ${kept ? `${kept} Knoten im Techtree sind noch da` : 'Der Techtree ist noch leer'}`, T.seconds ?? 7);
    this.drone.react('love');
  }
  sitForDream() {
    const l = this.leyla, C = this.data_.camp || {}, S = C.fire?.sit || {}, fx = this.campGeo?.fireX;
    if (fx == null || !S.look || !this.textures.exists(S.look)) return;
    const x = fx - (S.distance ?? 150);
    l.body.reset(x, this.camp.ground - l.size.h / 2); l.body.setVelocity(0, 0);
    l.startSit(S, x, 1, null);
  }
  takePack(pile) {
    const save = this.box.save, bag = save.inv.grids.backpack, D = this.data_;
    let left = 0;
    for (const e of [...pile.grid.items]) {
      const free = !bag.items.length && pile.grid.w === bag.w && pile.grid.h === bag.h;   // as it was: same places
      if (free) { bag.items.push({ ...e }); continue; }
      left += add(D, bag, e.a, e.id, e.n);
    }
    pile.grid.items = [];
    this.loot.sync(); this.lostPack = null;
    this.invChanged?.('backpack');
    this.drone.react('rescue'); this.sfx('loot_pickup', { x: this.leyla.x });
    this.hud.toast('Rucksack zurück!', left ? 'Nicht alles passt, der Rest liegt am Boden' : '', 'good', 3200);
  }
  // ---------- Rezepte automatisch lernen + Achievements (#012) ----------
  // notes, blueprints and cookbooks in the backpack (everything picked up lands there) go straight into the recipe book
  learnNotes() {
    const save = this.box?.save, bag = save?.inv?.grids?.backpack;
    if (!bag?.items.some(e => this.data_.items?.[e.id]?.teaches)) return;
    this.announceNotes(learnAll(this.data_, save, bag));
  }
  // Inventar › Lernen: one note from any grid
  learnFrom(grid, e) {
    const r = learnNote(this.data_, this.box.save, grid, e);
    if (r) this.announceNotes([r]);
    return r;
  }
  // #092 Haarfarbe lernen (inventory): the packet is used up, the colour waits at the mirror
  dyeOf(id) { const i = colorOfItem(this.data_, id); return i < 0 ? null : { i, known: knowsColor(this.box?.save, i) }; }
  learnDyeFrom(grid, e) {
    const r = learnColor(this.data_, this.box.save, e.id);
    if (!r.ok) { this.hud.toast(r.reason, '', 'info', 2200); return false; }
    if ((e.n || 1) > 1) e.n--; else remove(grid, e);
    this.hud.toast(`Farbe gelernt: ${r.name}`, 'Am Spiegel im Camp kannst du sie jederzeit tragen', 'recipe', 4200);
    this.box.persist?.();
    return true;
  }
  announceNotes(list) {
    const D = this.data_, T = D.crafting?.texts || {}, fill = (t, n, k) => t.replace('{name}', n).replace('{n}', k);
    for (const r of list) {
      const name = D.recipes?.[r.recipe]?.name || D.items?.[D.recipes?.[r.recipe]?.result]?.name || r.recipe;
      if (r.learnt) this.hud.toast(fill(T.autoLearn || 'Rezept gelernt: {name}', name, 0), `Aus: ${D.items?.[r.item]?.name || r.item} · steht im Rezeptbuch`, 'recipe');
      if (r.knowledge) this.hud.toast(fill(T.knowledge || '{name} kennst du schon: +{n} Wissen', name, r.knowledge), 'Für den Techtree', 'recipe');
    }
    if (list.length) { this.achieveLevel('recipes', this.box.save.recipes.length); this.hud.inv?.draw(); }
  }
  // counts something for the achievements; reached ones are announced right away
  achieve(counter, n = 1, tags = []) { if (this.box) this.announce(bump(this.data_, this.box.save, counter, n, tags)); }
  // before the scene starts anew (sleeping, driving): announced in the fresh camp
  achieveLater(counter, n = 1, tags = []) { if (!this.box) return; const got = bump(this.data_, this.box.save, counter, n, tags).map(a => a.id); (this.box.save.achievements.news ??= []).push(...got); }   // bump first: it creates save.achievements in a fresh save
  achieveLevel(counter, value) { if (this.box) this.announce(achieveLevel(this.data_, this.box.save, counter, value)); }
  // a loot roll; Delta-Petrol-Schild & Co. (#012, Extra-Beute %) give a chance of one more thing
  lootRoll(table) {
    const D = this.data_, out = rollLoot(D, table) || [], k = (this.box ? mod(D, this.box.save, 'loot') : 0) + (this.threat()?.loot || 0) + (this.box ? droneBonuses(D, this.box.save).loot || 0 : 0);   // + danger of the place (#014), AvA's board (#013)
    for (let left = k; left > 0; left -= 100) if (Math.random() * 100 < Math.min(100, left)) { const x = rollLoot(D, table)?.[0]; if (x) out.push(x); }
    return out;
  }
  // cooking, crafting, experimenting, taking apart (craft_ui.js) count for the achievements
  craftDone(r, ws) {
    if (!r?.ok) return;
    const fn = this.data_.workshops?.[ws]?.function;
    if (r.thing) return this.achieve('salvaged', r.n || 1);
    if (r.hit === false) return this.achieve('failures');
    if (r.hit) this.achieve('experiments');
    if (r.recipe) this.achieve(fn === 'kitchen' || fn === 'foodtruck' ? 'cooked' : 'crafted', 1, [r.recipe]);
  }
  // in the camp: what was reached on the way (run end, a new Durchgang) and what is a state (string lights, recipes)
  campNews() {
    const D = this.data_, save = this.box?.save;
    if (save) this.prisonerNews();   // #079
    if (save) this.crewNews();   // #085
    if (!save || !D.achievements) return;
    this.learnNotes();
    const news = [...(save.achievements?.news || [])];
    if (save.achievements) save.achievements.news = [];
    const now = [...achieveLevel(D, save, 'lights', save.rig?.lights?.length || 0), ...achieveLevel(D, save, 'recipes', save.recipes?.length || 0), ...achieveCheck(D, save)];
    const info = id => { const a = D.achievements[id] || {}, rid = D.recipes?.[a.recipe] ? a.recipe : null; return { id, name: a.name || id, recipe: rid, recipeName: rid ? D.recipes[rid].name || rid : null }; };
    this.announce([...news.filter(id => D.achievements[id]).map(info), ...now]);
  }
  // #085 arriving: a hidden trait shows, someone may wait at the fire
  crewNews() {
    // #102 Gangs kämpfen selbst: what changed hands at the fronts while Leyla was away
    const war = gangWar(this.data_, this.box.save);
    for (const x of war) this.hud.toast(`${x.to} übernehmen ${x.place}`, `${x.from} sind raus · Funk vom Tag ${x.day}`, 'info', 6000);
    if (war.length) this.box.persist?.();
    // #100 Rig-Moral: the time that passed moves it; a new level and anyone who left get a message
    const m = tickMorale(this.data_, this.box.save);
    if (m?.left?.length) this.hud.toast(`${m.left.join(', ')} ${m.left.length === 1 ? 'hat' : 'haben'} das Rig verlassen`, 'Die Stimmung war am Boden (Krise)', 'warn', 6500);
    else if (m?.changed) this.hud.toast(`Stimmung: ${m.level.name}`, `Moral ${m.value} · Crew-Menü zeigt, woran es liegt`, m.level.id === 'high' ? 'good' : m.level.id === 'stable' ? 'info' : 'warn', 5200);
    if (m?.changed || m?.left?.length) this.box.persist?.();
    const r = campArrival(this.data_, this.box.save);
    for (const x of r.revealed) this.hud.toast(`Du lernst ${x.name} besser kennen`, `${x.trait}`, 'info', 5200);
    if (r.applicant) this.hud.toast(`${r.applicant.name} wartet am Feuer`, 'Will mitfahren · am Lagerfeuer entscheiden', 'info', 6000);
    if (r.applicant || r.revealed.length) this.box.persist?.();
  }
  // #079 the days that passed: prisoners in the Zelle make Dunkelheit, those outside of it suffer (one toast)
  prisonerNews() {
    const D = this.data_, save = this.box.save, r = catchUp(D, save, cellKeys(D, save, storeKeyOf));
    const dead = r.hurt.filter(h => h.died).map(h => h.name), sore = r.hurt.filter(h => !h.died).map(h => h.name);
    if (dead.length) this.hud.toast(`${dead.join(', ')} hat es nicht überlebt`, 'Ohne Zelle halten Gefangene nicht lange durch', 'warn', 6000);
    else if (sore.length) this.hud.toast(`${sore.join(', ')} geht es schlecht`, 'Gefangene gehören in die Zelle', 'warn', 5000);
    if (r.dark > 0) this.hud.toast(`+${r.dark} Dunkelheit`, 'Die Zelle ist nicht leer', 'info', 4000);
    if (dead.length || sore.length || r.dark) this.box.persist?.();
  }
  announce(list) {
    this.keepsakeNews();
    if (!list?.length) return;
    const D = this.data_;
    list.forEach((a, i) => this.time.delayedCall(i * 900, () => {
      this.hud.toast(a.name, ['Achievement erreicht', D.achievements?.[a.id]?.description].filter(Boolean).join(' · '), 'trophy', 5200);
      this.sfxAchieve?.();
      if (a.recipe) this.time.delayedCall(700, () => this.hud.toast(`Rezept gelernt: ${a.recipeName}`, `Einmal herstellen an: ${D.workshops?.[D.recipes?.[a.recipe]?.station]?.name || 'Werkbank'} · dann in die Schatzkammer stellen`, 'recipe', 5200));
    }));
    this.drone?.react('cleared');
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.box?.persist(), 800);
  }

  // #142 a keepsake for the cockpit (main menu): a small note once, smaller than an achievement
  keepsakeNews() {
    if (!this.box?.save) return;
    const got = newKeepsakes(this.data_, this.box.save);
    got.forEach((k, i) => this.time.delayedCall(1200 + i * 900, () => this.hud.toast(`Fürs Cockpit: ${k.name}`, k.note || 'Liegt jetzt im Hauptmenü auf dem Armaturenbrett', 'keepsake', 4200, { cat: 'progress' })));
    if (got.length) { clearTimeout(this.saveTimer); this.saveTimer = setTimeout(() => this.box?.persist(), 800); }
  }
  onKill(e) {
    this.kills++;
    const slots = this.box?.save.inv?.slots || {}, h = e.lastHit || {};
    this.achieve('kills', 1, [e.id, e.d.family, h.kind === 'shot' ? slots.ranged : h.kind === 'melee' ? slots.melee : null, h.crit ? 'crit' : null]);
    if (e.spared !== 'freed') this.loot?.fromEnemy(e);   // #139 let go: he takes his things with him
    this.drone.react('kill');
    if (e.d?.behavior === 'boss') this.storyFx?.trace('boss', e.x, e.feet);   // #167 the fallen boss stays a trace for some days
    // #055: a kill on a gang's turf costs Ruf with that gang (Ereignis-Baukasten › Ruf › je Kill im Revier)
    const G = this.mode === 'run' && this.box?.save ? this.gang?.() : null;
    if (G?.name && !e.spared) { const r = addRep(this.data_, this.box.save, G.name, -repConfig(this.data_).kill); if (r?.changed) this.hud.toast(`${G.name}: ${levelName(r.level)}`, 'Dein Ruf bei ihnen sinkt', 'warn', 3600); }
    const [a, b] = e.d.deltas || [0, 0], d = a + Math.floor(Math.random() * (b - a + 1));
    this.deltas += d;
    if (d) this.time.delayedCall(260, () => this.sfx('delta_pickup', { x: e.x }));   // #130
    if (d) this.fx.text(e.x, e.feet - e.h - 20, `+${d} Δ`, { color: '#ffd27a', size: 48, rise: 90, life: 1100 });
    if (!this.level && this.enemies.every(x => !x.alive) && !this.cleared) {
      this.cleared = true;
      this.drone.react('cleared');
      this.time.delayedCall(700, () => this.hud.banner('Raum geräumt', `${this.clock()} · ${this.kills} Kills · ${this.deltas} Δ · R für nochmal`, 0, 'good'));
    }
  }
  clock() { const s = Math.floor(this.elapsed / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  openTrunk() {
    const g = this.box?.save?.inv?.grids?.trunk;
    if (g) this.hud.inv.open({ key: 'trunk', title: 'Kofferraum', grid: g, kind: 'container', x: this.leyla.x });
  }
  // in a run: E at the van's door goes back to the camp
  runUpdate(input) {
    const l = this.leyla, v = this.van;
    const near = v && l.alive && l.body.blocked.down && Math.abs(l.x - v.x) < (this.data_.camp?.interactRange ?? 130) && Math.abs(l.feet - v.y) < 40;
    // POI level: the HUD names the room Leyla is in
    const LI = this.levelInfo;
    if (LI?.def) {
      const tx = l.x / this.T, ty = l.feet / this.T - 0.5, here = LI.rooms.find(r => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h);
      const name = here ? this.data_.rooms?.[here.id]?.name || here.id : 'Abkürzung';
      if (name !== this.roomName) {
        this.roomName = name; this.hud.room(`${LI.def.name} · ${name}`, this.enemies.length);
        // #043 (Daniel: „Raumname einblenden“, like The Looter): the first time she enters a room its name stands over the scene
        const RT = this.data_.game?.roomTitle || {}, seen = this.titled ??= new Set();
        if (here && RT.enabled !== false && !seen.has(here.id) && this.elapsed > 400) { seen.add(here.id); this.hud.roomTitle?.(name, RT.ms ?? 2600); }
        else if (here) seen.add(here.id);
        this.levelFx?.enterRoom(here);   // #163 the Wow moment on the first entry
        this.dressingFx?.enterRoom(here);   // #159 the note of a room story
      }
    }
    // #094 the trunk at the van's rear: loot put there is safe (also from a knock-out)
    const TK = v?.S?.trunk, tx = TK?.enabled !== false && TK?.x != null && this.box?.save?.inv?.grids?.trunk ? v.toWorld(TK.x, 0).x : null;
    const nearTrunk = !near && tx != null && !this.level?.nearest()?.act && l.alive && l.body.blocked.down && Math.abs(l.x - tx) < 80 && Math.abs(l.feet - v.y) < 40;
    if (nearTrunk) {
      const open = this.hud.inv?.isOpen && this.hud.inv.other?.key === 'trunk', text = open ? 'Kofferraum schließen' : 'Kofferraum · Beute sicher verstauen';
      if (text !== this.vanPrompt || this.vanKey !== 'E') { this.vanPrompt = text; this.vanKey = 'E'; this.hud.prompt(text, 'E'); }
      if (input.grab.pressed) { if (open) this.hud.inv.close(); else this.openTrunk(); }
      return;
    }
    const thing = !near && l.alive ? this.level?.nearest() : null;
    const pile = !near && !thing && this.loot?.nearest();
    // her own backpack from the knock-out: E takes it all back at once (design.md › k.o. neu: genau eine Chance)
    if (pile?.pack && l.alive) {
      const text = 'Deinen Rucksack aufheben';
      if (text !== this.vanPrompt) { this.vanPrompt = text; this.vanKey = 'E'; this.hud.prompt(text, 'E'); }
      if (input.grab.pressed) this.takePack(pile);
      return;
    }
    // the Boden-Leiste: E / stick ↑ picks up the first thing (Daniel, 12.11.2026), I still opens the whole ground
    const floorText = pile && !this.hud.inv?.isOpen ? (this.hud.floor?.prompt() || `Beute am Boden · I öffnet (${pile.grid.items.length})`) : null;
    const text = near ? (this.level?.done ? `Zurück ins Camp · Rang ${this.level.done.grade}` : 'Zurück ins Camp · Van') : thing ? thing.text : floorText;
    const key = floorText && !near && !thing && !this.hud.floor?.list?.length ? 'I' : 'E';
    if (text !== this.vanPrompt || key !== this.vanKey) { this.vanPrompt = text; this.vanKey = key; this.hud.prompt(text, key); }
    if (input.grab.pressed && near && this.mode === 'run') this.confirmLeave();
    else if (input.grab.pressed && thing?.act) thing.act();
    else if (input.grab.pressed && floorText && key === 'E') { this.hud.floor.pick(this); this.sfx('loot_pickup', { x: l.x }); }
  }
}
