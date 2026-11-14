// Camp ↔ run (#017 split from scene.js): restart, go to the camp, start and end a run (Beute-Bilanz), enemies of the run.
// Mixed into PlayScene (game/play/scene.js): the methods keep their `this`, nothing else changes.
import { placeOf, threatOf } from '../worldmap.js';
import { update as tankUpdate, phase as tankPhase } from '../tank.js';
import { poiReady } from '../../engine/poi.js';
import { Enemy } from './enemies.js';
import { Van } from './van.js';
import { Camp } from './camp.js';
import { advance, arrive, clockText } from '../save.js';
import { snapshot as runSnapshot, compare as runCompare } from '../summary.js';
import { bump, bonuses as trophyBonuses } from '../achievements.js';

export class SceneRuns {
  // ---------- camp ↔ run (savegame) ----------
  restartAs(args, fade = 500) {
    if (this.leaving) return;
    this.leaving = true;
    this.hud.prompt(null);
    const L = this.args.loading;   // Spiel › Ladebalken: the new scene loads and builds, nobody can play meanwhile
    const go = () => {
      if (L && !this.script && !L.visible) L.show({ text: args.banner?.[0] || '', drone: !this.drone?.gone });
      this.scene.restart({ ...this.args, startX: null, banner: null, ...args });
    };
    if (this.script || L?.visible) return go();   // remote control: no waiting for the fade; a wait already shows the bar
    this.cam.fadeOut(fade, 13, 10, 18);
    this.cam.once('camerafadeoutcomplete', go);
  }
  goCamp({ banner = null, fade = 600, keepPlace = false, arriving = false, summary = null } = {}) {
    if (arriving) { arrive(this.box.save, this.data_); if (banner) banner = [banner[0], banner[1].replace(/^Tag \d+ · \d\d:\d\d/, clockText(this.box.save))]; }
    this.box.save.health = Math.max(1, Math.min(this.leyla.maxHealth, this.box.save.health));
    this.box.persist();
    this.restartAs({ mode: 'camp', banner, summary, startX: keepPlace ? this.leyla.x : null }, fade);
  }
  startRun(poi) {
    const D = this.data_, P = D.pois?.[poi] || {}, R = D.rooms || {}, has = id => R[id]?.layout?.length;
    // rooms with entrance and exit: a generated level (engine/poi.js); otherwise the first room as before
    if (poiReady(D, poi).ok) {
      this.box.save.health = this.leyla.health;
      this.box.save.run = { poi, room: null, seed: P.seed || 1 + Math.floor(Math.random() * 2 ** 31), location: this.box.save.location, danger: this.placeDanger(poi), before: runSnapshot(D, this.box.save) };   // before: for the Beute-Bilanz (#017)
      this.box.persist();
      return this.restartAs({ mode: 'run', roomId: null, banner: [P.name || poi, `${P.gang?.name ? `Revier: ${P.gang.name} · ` : ''}Finde den Tresor · E am Van: zurück ins Camp`] }, 700);   // #016 whose place this is
    }
    const ready = (P.rooms || []).filter(has);
    const room = ready.find(id => R[id].tags?.includes('start')) || ready[0] || [D.camp?.fallbackRoom, D.game?.testRoom].find(has);
    if (!room) return this.hud.menu({ title: 'Noch kein Raum', sub: 'Dieser POI hat noch keinen Raum mit Layout (Werkstatt › Raum-Bausteine).', items: [{ label: 'Zurück', act: () => {} }] });
    this.box.save.health = this.leyla.health;
    this.box.save.run = { poi, room, location: this.box.save.location, danger: this.placeDanger(poi), before: runSnapshot(D, this.box.save) };
    this.box.persist();
    this.restartAs({ mode: 'run', roomId: room, banner: [P.name || poi, `${D.rooms?.[room]?.name || room}${ready.length ? '' : ' (Ersatzraum)'} · E am Van: zurück ins Camp`] }, 700);
  }
  // the danger of the place Leyla is at (Reisekarte), else the POI's own
  placeDanger(poi) { const n = placeOf(this.data_, this.box.save); return n?.danger || this.data_.pois?.[poi]?.danger || 1; }
  // what the danger does in this run (game/worldmap.js threatOf): more enemies, tougher, more loot (#014)
  threat() { return this.mode === 'run' && this.box?.save.run ? threatOf(this.data_, this.box.save.run.danger) : null; }
  // back from a run: by van (loot counts) or knocked out (AvA, run loot is lost); buffs are used up
  // at the van in a run: ask first (Daniel, 13.11.2026: „Die Rückkehr ins Camp vom POI braucht eine Bestätigung à la ‚wirklich zurückreisen?‘“)
  confirmLeave() {
    if (this.hud.modal || this.leaving) return;
    if (this.data_.game?.confirmLeave === false) return this.endRun(false);
    const done = this.level?.done, items = this.box?.save.inv.grids.backpack.items.length || 0;
    this.hud.menu({ title: 'Wirklich zurückreisen?', sub: done ? `POI geschafft, Rang ${done.grade}. Die Beute im Rucksack kommt mit ins Camp.` : this.level ? `Der POI ist noch nicht geschafft: kein Ranking. Die Beute im Rucksack (${items}) ist sicher.` : 'Zurück ins Camp, die Beute im Rucksack kommt mit.',
      items: [{ label: 'Hierbleiben', sub: 'Weiter plündern', primary: true, act: () => {} }, { label: 'Zurückreisen', sub: 'Ins Camp', act: () => this.endRun(false) }] });
  }
  endRun(ko) {
    const save = this.box.save, C = this.data_.camp || {}, base = this.data_.leyla?.health ?? 100;
    advance(save, C.clock?.runHours ?? 3);
    if (ko) { save.health = Math.round(base * (C.heal?.afterKo ?? 30) / 100); save.inv.grids.backpack.items = []; }   // AvA only brings Leyla: the backpack stays behind
    let paid = this.level?.payout(this.deltas) ?? this.deltas;
    const rank = !ko && this.level?.done;
    paid = Math.round(paid * (1 + (trophyBonuses(this.data_, save).sell || 0) / 100));   // Rang-S-Abzeichen & Co. (#012)
    if (!ko) { save.health = Math.round(this.leyla.health); save.deltas += paid; }
    // achievements (#012): knocked out, or home safe (the tank never went critical in this run), Δ earned
    const later = list => (save.achievements.news ??= []).push(...list.map(a => a.id));   // announced when the camp is there
    if (ko) later(bump(this.data_, save, 'knockouts'));
    else {
      if (save.tank) tankUpdate(this.data_, save);
      const ph = tankPhase(this.data_, save), critical = ph.dead || ph.index >= (this.data_.tank?.phases?.length || 5);   // the last phase: KRITISCH
      if (!critical) later(bump(this.data_, save, 'tankSafeRuns'));
      if (paid > 0) later(bump(this.data_, save, 'deltas', paid));
      if (rank) later(bump(this.data_, save, 'pois', 1, [this.level.poi, rank.grade]));
      if (rank && this.level.secretsMax > 0 && this.level.secrets >= this.level.secretsMax) later(bump(this.data_, save, 'secretsAll', 1, [this.level.poi]));
    }
    save.buffs = []; save.buffQ = {};
    // Beute-Bilanz (#017): what changed since she drove off
    let summary = null;
    try {
      const R = this.level?.done, P = this.data_.pois?.[save.run?.poi] || {}, sec = R?.seconds ?? Math.round((this.elapsed || 0) / 1000);
      summary = runCompare(this.data_, save, save.run?.before || {}, { ko, poi: P.name || save.run?.poi || '', title: ko ? 'AvA hat dich heimgebracht' : rank ? `Tresor geknackt · Rang ${rank.grade}` : 'Zurück im Camp',
        grade: rank?.grade || null, parts: rank?.parts || null, paid, base: this.deltas, bonus: rank?.bonus || 0, kills: this.kills, killsMax: this.level?.killsMax ?? null,
        secrets: this.level?.secrets ?? 0, secretsMax: this.level?.secretsMax ?? 0, time: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` });
    } catch (e) { console.warn('Bilanz', e); }
    save.run = null;
    this.hud.inv?.close();
    const banner = ko ? ['AvA hat dich heimgebracht', `${clockText(save)} · Der Rucksack ist weg.`, 'drama']
      : rank ? [`Zurück im Camp · Rang ${rank.grade}`, `${clockText(save)} · +${paid} Δ (${this.deltas} + ${rank.bonus} %) · ${this.kills} Kills`, 'good']
      : ['Zurück im Camp', `${clockText(save)} · +${paid} Δ · ${this.kills} Kills`, 'good'];
    this.goCamp({ banner: summary && this.data_.game?.summary !== false ? null : banner, fade: ko ? 900 : 600, arriving: true, summary: this.data_.game?.summary !== false ? summary : null });
  }
  // the gold button of the Beute-Bilanz: straight to where it pays off
  goNext(next) {
    const c = this.camp, hud = this.hud;
    if (!next || !c) return;
    if (next.kind === 'quests') return hud.quests?.open();
    if (next.kind === 'tech') return hud.tech?.open();
    if (next.kind === 'tank') { const ws = c.rigWorkshop?.('tank'); if (ws) return c.use(ws); }
    if (next.kind === 'workshop') { const f = this.data_.workshops?.[next.ws]?.function, ws = c.rigWorkshop?.(f) || next.ws; return c.use(ws); }
  }

  spawnEnemies() {
    const T = this.T;
    for (const e of this.enemies) e.destroy();
    this.enemies = [];
    // danger of the place (#014): some spawns get a second enemy next to them, all are tougher; the same seed gives the same extras
    const Th = this.threat(), list = [...this.room.spawns];
    if (Th?.more > 0 && list.length) {
      let r = (this.box.save.run.seed || 1) >>> 0; const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
      const n = Math.floor(list.length * Th.more) + (rnd() < (list.length * Th.more) % 1 ? 1 : 0);
      for (let i = 0; i < n; i++) { const s = list[Math.floor(rnd() * this.room.spawns.length)]; list.push({ ...s, x: s.x + (rnd() < 0.5 ? -0.6 : 0.6), extra: true }); }
    }
    for (const s of list) {
      const def = this.enemyDef(s.enemy);
      if (!def) continue;
      const e = new Enemy(this, s.enemy, def, [(s.x + 0.5) * T, (s.y + 1) * T]);
      this.physics.add.collider(e.box, this.solids);
      this.physics.add.collider(e.box, this.platforms, null, (box, plat) => e.body.velocity.y >= 0 && e.body.prev.y + e.body.height <= plat.body.top + 2);
      this.enemies.push(e);
    }
  }

  // cover (#014): the chests of the POI level, plus test boxes (nomad / tests) → [{ x, w, top, feet }]
  covers() { return [...(this.level?.covers?.() || []), ...(this.testCovers || [])]; }
  // a sound at (x, y) that carries r px (Spiel › Kampf › Lärm): enemies that hear it come looking (Gegner › Wahrnehmung › Hört)
  noise(x, y, r) {
    if (!(r > 0)) return;
    for (const e of this.enemies) e.hear?.(this.now ?? this.time.now, x, y, r);
    this.lastNoise = { x: Math.round(x), y: Math.round(y), r };
  }
  // one more enemy at a tile (tests, nomad.spawn)
  // an enemy as it fights here: danger of the place (#014) and the POI's gang colour (#016: plunderers from the kit wear it, not
  // mutants, not the boss)
  enemyDef(id) {
    let def = this.data_.enemies?.[id];
    if (!def) return null;
    const Th = this.threat();
    if (Th && (Th.health !== 1 || Th.damage !== 1)) def = { ...def, health: Math.round((def.health ?? 30) * Th.health), damage: Math.round((def.damage ?? 10) * Th.damage) };
    const G = this.gang();
    if (G?.color && def.kit && def.family === 'raider' && def.behavior !== 'boss') def = { ...def, kitGang: G.color };
    return def;
  }
  gang() { const poi = (this.mode === 'run' && this.box?.save?.run?.poi) || this.level?.poi; return poi ? this.data_.pois?.[poi]?.gang || null : null; }
  addEnemy(id, col, row) {
    const def = this.enemyDef(id), T = this.T;
    if (!def) return null;
    const e = new Enemy(this, id, def, [(col + 0.5) * T, (row + 1) * T]);
    this.physics.add.collider(e.box, this.solids);
    this.physics.add.collider(e.box, this.platforms, null, (box, plat) => e.body.velocity.y >= 0 && e.body.prev.y + e.body.height <= plat.body.top + 2);
    this.enemies.push(e);
    return e;
  }

  restartRoom() {
    this.combat.clear();
    this.spawnEnemies();
    this.leyla.reset();
    this.drone.reset();
    this.van?.reset();
    this.kills = 0; this.deltas = 0; this.cleared = false; this.startTime = 0;
    this.hud.room(this.data_.rooms?.[this.roomId]?.name || this.roomId, this.enemies.length);
    this.hud.banner(null);
    this.cam.flash(250, 13, 10, 18);
  }
}
