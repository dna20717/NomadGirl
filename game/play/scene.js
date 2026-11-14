// The play scene: builds a room from its layout, places Leyla and the enemies, runs input, physics, combat and HUD.
import { MapUI } from './map_ui.js';
import { placeOf, threatOf } from '../worldmap.js';
import { rescue, update as tankUpdate, phase as tankPhase } from '../tank.js';
import { bonuses } from '../techtree.js';
import { parseRoom, solidRects } from '../../engine/room.js';
import { buildPoi, poiReady } from '../../engine/poi.js';
import { PoiLevel } from './poi_level.js';
import { Pad, PAD_ACTIONS } from './pad.js';
import { Fog } from './fog.js';
import { makeTextures, drawBackground, drawRoom, terrainKits, PLACEHOLDER_COLORS } from './art.js';
import { Leyla } from './leyla.js';
import { Enemy } from './enemies.js';
import { kitAssets } from './enemy_kit.js';
import { uiInput } from './ui_nav.js';
import { Combat } from './combat.js';
import { Fx } from './fx.js';
import { Atmosphere } from './atmosphere.js';
import { Drone } from './drone.js';
import { Van } from './van.js';
import { Backdrop } from './backdrop.js';
import { Camp, campLayout, daytimeAt, drawCampBackground, drawCampGround, travelCost } from './camp.js';
import { raining, rainConfig } from '../rain.js';
import { applyMods, implantBoosts, droneBonuses } from '../stations.js';
import { advance, arrive, clockText, containers, newCycle } from '../save.js';
import { Loot } from './loot.js';
import { InventoryUI } from './inventory_ui.js';
import { FloorStrip } from './floor_strip.js';
import { skinnedLook, SKIN_LOOKS } from './gun_skins.js';
import { gearStats, add, GEAR_KEYS, rollLoot } from '../inventory.js';
import { CraftUI } from './craft_ui.js';
import { TechtreeUI } from './techtree_ui.js';
import { BuildMode } from './build_mode.js';
import { Tutorial } from './tutorial.js';
import { AchievementsUI } from './achievements_ui.js';
import { QuestLogUI } from './questlog_ui.js';
import { SummaryUI } from './summary_ui.js';
import { snapshot as runSnapshot, compare as runCompare } from '../summary.js';
import { use as useThing, learnAll, learnNote } from '../crafting.js';
import { bump, level as achieveLevel, check as achieveCheck, bonuses as trophyBonuses } from '../achievements.js';

const BORROW = { walk: ['run'], airJump: ['jump'], fall: ['jump'], hangOne: ['hang'] };

const KEYS = {
  left: ['A', 'LEFT'], right: ['D', 'RIGHT'], up: ['W', 'UP'], down: ['S', 'DOWN'],
  jump: ['SPACE'], walk: ['SHIFT'], dash: ['L', 'C'], melee: ['J', 'Y'], ranged: ['K', 'X'], grab: ['E'],
  restart: ['BACKSPACE'], reload: ['R'], help: ['ESC'], uiOk: ['ENTER'], uiSend: ['F'], controls: ['H'], debug: ['G'], mute: ['M'], inventory: ['I', 'TAB'], pose: ['P'], build: ['B'], holster: ['Q'], swap: ['V'],
};

export class PlayScene extends Phaser.Scene {
  constructor() { super('play'); }

  // mode: 'test' (a room from the workshop), 'camp' (camp between runs) or 'run' (a POI run from the camp); box = savegame (game/save.js)
  init(args) {
    const { project, roomId, base, hud, mode = 'test', box = null } = args;
    this.args = args;
    this.p = project; this.data_ = project.data; this.roomId = roomId; this.base = base; this.hud = hud; this.mode = mode; this.box = box;
    this.T = this.data_.game?.tileSize || 64;
    this.gravity = this.data_.game?.gravity || 3600;
  }

  // ---------- assets ----------
  preload() {
    if (this.args?.loading) this.load.on('progress', p => this.args.loading.progress(p));   // Spiel › Ladebalken
    const A = this.data_.assets || {}, ids = new Set(Object.values(this.data_.leyla?.look || {}));
    for (const e of Object.values(this.data_.enemies || {})) if (e.look) ids.add(e.look);
    const kitted = kitAssets(this.data_, Object.values(this.data_.enemies || {}));   // Gegner-Bausätze (#004): poses, heads, weapons, hands strips
    for (const id of kitted.ids) ids.add(id);
    for (const [key, file] of kitted.extra) if (!this.textures.exists(key)) this.load.image(key, new URL(file, this.base).href);
    for (const [k, id] of Object.entries(this.data_.game?.tiles || {})) if (k !== 'terrain') ids.add(id);
    for (const t of Object.values(this.data_.terrain || {})) for (const id of [t.look, t.props, t.propsBig]) if (id) ids.add(id);   // Kachel-Sets (TileSet00)
    const DR = this.data_.drone || {};
    for (const id of [DR.look, DR.face?.look, DR.face?.glass, ...(DR.parts || []).filter(r => r.on).map(r => r.look)]) if (id) ids.add(id);
    for (const r of this.data_.leyla?.idles || []) if (r.look) ids.add(r.look);
    { const C = this.data_.leyla?.combo || {}; for (const r of C.hits || []) for (const id of [r.look, r.walk]) if (id) ids.add(id); if (C.finisher) ids.add(C.finisher); }   // melee combo (Leyla › Kombo)
    for (const w of Object.values(this.data_.weapons || {})) for (const id of [w.sound, ...Object.values(w.poses || {}).filter(v => typeof v === 'string')]) if (id) ids.add(id);   // Waffen › Posen
    const SP = this.data_.game?.spawn;
    for (const id of [SP?.look, SP?.dish?.look, SP?.roof?.front, this.data_.rooms?.[this.roomId]?.backdrop?.image]) if (id) ids.add(id);
    if (this.data_.camp?.chest?.look) ids.add(this.data_.camp.chest.look);   // chests in POIs too
    if (this.mode === 'run') for (const r of Object.values(this.data_.rooms || {})) if (r.backdrop?.image) ids.add(r.backdrop.image);   // a level wears its entrance's backdrop
    if (this.mode === 'camp') {
      for (const c of this.box?.save.companions || []) if (this.data_.companions?.[c]?.look) ids.add(this.data_.companions[c].look);
      if (this.data_.camp?.fire?.look) ids.add(this.data_.camp.fire.look);
      if (this.data_.camp?.fire?.sit?.look) ids.add(this.data_.camp.fire.sit.look);
      if (this.data_.camp?.chest?.look) ids.add(this.data_.camp.chest.look);
      // every container's look: bought or stacked ones appear while building, without reloading the scene
      for (const c of Object.values(this.data_.containers || {})) for (const k of [c.look, c.lookClosed]) if (k) ids.add(k);
      for (const c of Object.values(this.data_.rigParts || {})) if (c.look) ids.add(c.look);
      // workshop pictures (and the empty shelf), the crate for packed workshops
      for (const w of Object.values(this.data_.workshops || {})) for (const id of [w.look, w.lookEmpty, w.garden?.plants]) if (id) ids.add(id);
      { const T = this.data_.tank || {}; for (const p of T.phases || []) for (const id of [p.look, p.anim, p.hand]) if (id) ids.add(id); if (T.deadLook) ids.add(T.deadLook); }   // the cryo tank in all its phases (tank_view.js)
      // icon sheets of trophies: they stand on the stands of the treasury
      for (const a of ['items', 'weapons']) for (const t of Object.values(this.data_[a] || {})) if (t.tags?.includes('trophy') && t.look && A[t.look]?.kind === 'icons') ids.add(t.look);
      if (this.data_.camp?.yard?.crate?.look) ids.add(this.data_.camp.yard.crate.look);
      if (this.data_.camp?.chassis?.look) ids.add(this.data_.camp.chassis.look);   // modular trailer pieces
      if (this.data_.camp?.ground?.tiles) ids.add(this.data_.camp.ground.tiles);
      // #008 cosy camp: stairs, deco around the fire, solar panels, exterior clutter on the container walls, string lights
      { const C = this.data_.camp || {}; for (const id of [C.stairs?.look, C.solar?.look, ...(C.deco || []).map(d => d.look)]) if (id) ids.add(id); }
      for (const w of Object.values(this.data_.workshops || {})) if (w.outside) ids.add(w.outside);
      const S = this.data_.camp?.sound || {};
      for (const id of [S.wind, S.fire, ...(S.gusts || []), ...(this.data_.camp?.fire?.sit?.sounds || [])]) if (id) ids.add(id);
    }
    for (const id of [...ids]) if (A[id]?.mirror) ids.add(A[id].mirror);   // drawn opposite direction
    for (const id of ids) {
      const a = A[id];
      if (!a?.file) continue;
      const url = new URL(a.file, this.base).href;
      if ((a.kind === 'animation' || a.kind === 'tiles') && a.frameSize) this.load.spritesheet(id, url, { frameWidth: a.frameSize[0], frameHeight: a.frameSize[1] });
      else if (a.kind === 'icons' && a.cell) { const [cw, ch] = Array.isArray(a.cell) ? a.cell : [a.cell, a.cell]; this.load.spritesheet(id, url, { frameWidth: cw, frameHeight: ch }); }
      else if (a.kind === 'image') this.load.image(id, url);
      else if (a.kind === 'sound' && !this.cache.audio.exists(id)) this.load.audio(id, [url, ...(a.alt ? [new URL(a.alt, this.base).href] : [])]);
    }
  }
  // Kachel-Sets per tile: a room's own set, else Spiel › Kacheln › Kachel-Set. In a POI level each tile belongs to the room above/at it,
  // below all rooms lies the tunnel (POIs › Kachel-Set im Tunnel). back(x, y): back wall of indoor rooms and the tunnel.
  // → { at(x, y), back(x, y), idAt(x, y) }
  terrainMap() {
    const D = this.data_, kits = terrainKits(this, D), dflt = D.game?.tiles?.terrain, LI = this.levelInfo;
    const roomSet = id => D.rooms?.[id]?.terrain || dflt;
    const indoor = id => { const r = D.rooms?.[id] || {}; return r.indoor ?? !(r.backdrop?.image || r.backdrop?.weather); };
    const backOf = id => { const t = D.terrain?.[id], k = kits(t?.back?.terrain); return k ? { ...k, shade: t.back.shade } : null; };
    let idAt, inside;
    if (LI?.def) {
      const P = D.pois?.[this.levelPoi] || {}, tunnel = P.tunnelTerrain || roomSet(LI.rooms[0]?.id), cache = new Map();
      const roomAt = (x, y) => {
        const k = x + ',' + y;
        if (cache.has(k)) return cache.get(k);
        const col = LI.rooms.filter(r => x >= r.x && x < r.x + r.w);
        let r = col.find(r => y >= r.y && y < r.y + r.h) || null;
        if (!r && col.length && y < Math.max(...col.map(c => c.y + c.h))) r = col.reduce((a, b) => Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a);
        cache.set(k, r);
        return r;
      };
      idAt = (x, y) => { const r = roomAt(x, y); return r ? roomSet(r.id) : tunnel; };
      inside = (x, y) => { const r = roomAt(x, y); return r ? indoor(r.id) : true; };
    } else {
      const own = roomSet(this.roomId);
      idAt = () => own;
      inside = () => !!D.rooms?.[this.roomId]?.indoor;
    }
    return { idAt, inside, at: (x, y) => kits(idAt(x, y)), back: (x, y) => inside(x, y) ? backOf(idAt(x, y)) : null };
  }
  assetInfo(id) {
    const a = this.data_.assets?.[id];
    if (!a || !this.textures.exists(id)) return null;
    const src = this.textures.get(id).getSourceImage();
    const [fw, fh] = a.kind === 'animation' ? a.frameSize : [src.width, src.height];
    const [ox, oy] = a.origin || [fw / 2, fh];
    if (a.kind === 'animation' && !this.anims.exists(id))
      this.anims.create({ key: id, frames: this.anims.generateFrameNumbers(id, { start: 0, end: (a.frames || 1) - 1 }), frameRate: a.fps || 8, repeat: a.loop === false ? 0 : -1 });
    return { key: id, anim: a.kind === 'animation' ? id : null, scale: (a.height || fh) / fh, ox: ox / fw, oy: oy / fh, flip: !!a.flip };
  }
  lookKey(who) { return this.data_.leyla?.look?.idle && this.textures.exists(this.data_.leyla.look.idle) ? this.data_.leyla.look.idle : 'px'; }
  // Leyla: asset for a state, otherwise idle (marked as fallback so code effects step in)
  lookDuration(state) { const a = this.data_.assets?.[(this.leyla?.d?.look || this.data_.leyla?.look)?.[state]]; return a?.frames && a.fps ? a.frames / a.fps * 1000 : 0; }
  // a state without its own animation borrows a related one (walk → run, double jump → jump), else idle with code effects;
  // walk without its own animation borrows run (Leyla slows its pace down); facing < 0 = left
  playLook(sprite, who, state, facing = 1, start = null) {   // start: frame to continue at (run variants share the step)
    const look = (who === 'leyla' && this.leyla?.d?.look) || this.data_.leyla?.look || {}, A = this.data_.assets || {}, direct = state.startsWith('@') && this.textures.exists(state.slice(1));
    const has = s => s.startsWith('@') ? direct : look[s] && this.textures.exists(look[s]);
    this.looks ??= {};
    const used = has(state) ? state : (BORROW[state] || []).find(has) || 'idle';
    let id = direct ? state.slice(1) : look[used] || look.idle;   // '@<asset>' plays an asset directly (random idles, sitting)
    const a = A[id], m = a?.mirror;
    if (m && this.textures.exists(m) && (facing < 0) !== !!a.flip) id = m;
    let info = this.looks[id] ??= this.assetInfo(id) || { key: 'px', scale: 60, ox: 0.5, oy: 1, flip: false };
    // the ranged weapon brings its own look from code over the painted gun (Waffen › Aussehen aus Code, gun_skins.js)
    const base = direct ? state.slice(1) : look[used];
    const skin = who === 'leyla' && SKIN_LOOKS.some(k => look[k] && look[k] === base) && this.weapon('ranged')?.skin;
    if (skin && info.anim) { const k = skinnedLook(this, id, skin); if (k) info = this.looks[k] ??= { ...info, key: k, anim: k }; }
    if (sprite.texture.key !== info.key || (info.anim && sprite.anims.currentAnim?.key !== info.anim)) {
      sprite.setOrigin(info.ox, info.oy);
      // falling without a jump: a shared jump animation starts in its second half
      const mid = used === 'fall' && look.fall === look.jump ? Math.floor((A[id]?.frames || 1) / 2) : 0;
      const n = A[id]?.frames || 1;
      if (info.anim) sprite.play({ key: info.anim, startFrame: start != null ? Math.max(0, Math.min(n - 1, start)) : mid }, true); else sprite.setTexture(info.key);
    }
    return { ...info, used, fallback: used === 'idle' && state !== 'idle' || !has(used) };
  }
  enemyLook(def, shape = 'raider') {
    const info = def.look && this.assetInfo(def.look);
    if (info) return info;
    const color = PLACEHOLDER_COLORS[def.placeholderColor] ? def.placeholderColor : 'rust';
    // placeholders from code (art.js): raider, blob (ambusher, wildlife), drone (flyer)
    if (shape === 'blob') return { key: `enemy_blob_${color}`, scale: (def.height ?? 110) / 120, ox: 0.5, oy: 1, flip: false };
    if (shape === 'drone') return { key: `enemy_drone_${color}`, scale: (def.height ?? 90) / 96, ox: 0.5, oy: 1, flip: false };
    return { key: `raider_${def.behavior === 'shooter' ? 'gun' : 'melee'}_${color}`, scale: (def.height ?? 220) / 240, ox: 66 / 150, oy: 1, flip: false };
  }
  // the weapon in a slot; a copy from the bench brings its own values (#013, inv.slotMods)
  weapon(slot) { const id = this.box ? this.box.save.inv?.slots?.[slot] : this.testSlots?.[slot] || this.data_.leyla?.loadout?.[slot]; const def = this.data_.weapons?.[id] || null, mods = this.box?.save.inv?.slotMods?.[slot];
    if (!def || !mods) return def;
    const key = id + JSON.stringify(mods), C = (this.weaponCache ??= {});   // the same object while nothing changes (leyla.js compares it)
    if (C[slot]?.key !== key || C[slot].def !== def) C[slot] = { key, def, w: applyMods(def, mods) };
    return C[slot].w; }
  // V / L3: the next ranged weapon from the backpack into the hand, the old one into the backpack (Daniel, 12.11.2026: „wir proben den Switch“);
  // in a test room without a savegame: through all ranged weapons
  swapRanged() {
    const D = this.data_, W = D.weapons || {}, l = this.leyla, say = t => this.hud.toast(t, '', 'warn', 2600);
    let next;
    if (!this.box) {
      const all = Object.keys(W).filter(id => W[id].kind === 'ranged'), cur = this.testSlots?.ranged || D.leyla?.loadout?.ranged;
      next = all[(all.indexOf(cur) + 1) % all.length];
      (this.testSlots ??= {}).ranged = next;
    } else {
      const inv = this.box.save.inv, bag = inv.grids.backpack, e = bag.items.find(x => x.a === 'weapons' && W[x.id]?.kind === 'ranged');
      if (!e) return say('Keine zweite Fernkampfwaffe im Rucksack');
      const old = inv.slots.ranged, oldMods = inv.slotMods?.ranged;
      bag.items.splice(bag.items.indexOf(e), 1);
      if (old && add(D, bag, 'weapons', old, 1, { mods: oldMods || null }) > 0) this.loot?.throwDown({ a: 'weapons', id: old, n: 1, r: 0, ...(oldMods ? { mods: oldMods } : {}) });
      inv.slots.ranged = next = e.id;
      inv.slotMods ??= {}; if (e.mods) inv.slotMods.ranged = e.mods; else delete inv.slotMods.ranged;   // the copy's own values (#013)
      this.invChanged?.('backpack');
    }
    l.loadWeapon();
    say(W[next]?.name || next);
    this.drone?.react('gearBetter');
  }

  // ---------- world ----------
  create() {
    if (this.args?.loading) this.events.once('postupdate', () => this.args.loading.done());
    this.camp = null; this.vanPrompt = null;   // the scene object is reused on restart (camp ↔ run)
    this.sound.stopAll(); this.sound.removeAll();   // camp sounds belong to one visit
    try { this.sound.mute = localStorage.getItem('nomadgirl-mute') === '1'; } catch { /* private mode */ }
    makeTextures(this);
    this.pad ??= new Pad(this.data_.game?.gamepad);   // kept over restarts (camp ↔ run)
    this.hud.pad = this.pad;
    const PI = this.data_.assets?.[this.data_.game?.gamepad?.icons];
    this.hud.padIcons = PI?.kind === 'icons' && PI.file ? { url: new URL(PI.file, this.base).href, grid: PI.grid, cell: Array.isArray(PI.cell) ? PI.cell : [PI.cell, PI.cell], names: PI.names || [], size: this.data_.game?.gamepad?.iconSize } : null;
    // if the picture does not load (Daniel, 13.11.2026, Stadia: „keine Symbole“), the HUD falls back to the button letters instead of empty gaps
    if (this.hud.padIcons && !this.hud.padIcons.checked) { const I = this.hud.padIcons, img = new Image(); I.checked = true; img.onerror = () => { I.broken = true; this.hud.padSig = null; }; img.src = I.url; }
    this.fx = new Fx(this);
    this.combat = new Combat(this);
    let def = this.data_.rooms?.[this.roomId];
    // AvA died: a new Durchgang begins, Leyla wakes up at the fire (design.md › „War alles nur ein Traum?“)
    this.dreaming = false;
    if (this.mode === 'camp' && this.box?.save.tank?.dead) { this.box.save = newCycle(this.data_, this.box.save); this.dreaming = true; this.box.persist?.(); this.hud.tut?.event('cycle'); }
    if (this.mode === 'camp') {
      this.campGeo = campLayout(this.data_, this.box.save, this.T);
      const day = daytimeAt(this.data_.camp, this.box.save.hour);
      this.rain = raining(this.data_, this.box.save);
      def = { name: placeOf(this.data_, this.box.save)?.name || 'Camp', layout: this.campGeo.layout, backdrop: { weather: day.weather || Object.keys(this.data_.weather || {})[0], shade: 0, rain: this.rain ? rainConfig(this.data_).look : null } };
    }
    // a run in a POI: the rooms welded to one level (engine/poi.js), same seed = same level
    const run = this.mode === 'run' ? this.box.save.run : this.mode === 'test' && this.args.poi ? { poi: this.args.poi, seed: this.args.seed } : null;
    this.levelInfo = run?.seed ? buildPoi(this.data_, run.poi, run.seed) : null;
    if (this.levelInfo?.def) def = this.levelInfo.def;
    this.levelPoi = run?.poi || null;
    this.roomDef = def;
    this.room = parseRoom(def || {});
    const T = this.T, R = this.room, W = R.w * T, H = R.h * T;
    this.physics.world.setBounds(0, 0, W, H);
    // background (sky, skyline) on its own unzoomed camera, the world on a zoomable camera above it
    if (this.onAdded) this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdded);
    this.onAdded = null;
    const before = new Set(this.children.list);
    const bd = def?.backdrop;
    if (bd?.image || bd?.weather) this.backdrop = new Backdrop(this, bd, H); else drawBackground(this, W, H);
    if (this.mode === 'camp') drawCampBackground(this, this.data_.camp || {});
    const background = this.children.list.filter(o => !before.has(o));
    this.bgCam = this.cameras.main;
    this.cam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.cam.ignore(background);
    this.bgCam.ignore([...before]);
    if (!this.onAdded) { this.onAdded = o => this.bgCam.ignore(o); this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdded); }   // once: the scene object is reused on restart
    const tiles = Object.fromEntries(Object.entries(this.data_.game?.tiles || {}).filter(([k]) => k !== 'terrain').map(([k, id]) => [k, this.textures.exists(id) ? id : null]));
    this.terrain = this.terrainMap();
    const CG = this.data_.camp?.ground;
    let drawn = null;
    if (!(this.mode === 'camp' && drawCampGround(this, this.data_, this.campGeo, T)))
      drawn = drawRoom(this, R, T, tiles, this.mode === 'camp' ? { ground: CG?.color || '#4a3628', top: CG?.top || '#8a6440', hide: this.campGeo.hidden } : null, this.terrain);

    this.solids = this.physics.add.staticGroup();
    for (const r of solidRects(R)) this.solids.add(this.add.zone((r.x + r.w / 2) * T, (r.y + r.h / 2) * T, r.w * T, r.h * T));
    // ladders: vertical runs; their top tile works like a platform
    this.ladders = [];
    const seen = new Set();
    for (const [x, y] of R.ladders) {
      if (seen.has(x + ',' + y)) continue;
      let y1 = y; while (R.tiles[y1 + 1]?.[x] === 'H') { seen.add(x + ',' + (y1 + 1)); y1++; }
      this.ladders.push({ cx: (x + 0.5) * T, x0: x * T, x1: (x + 1) * T, top: y * T, bottom: (y1 + 1) * T, tx: x, ty: y });
    }
    this.platformTiles = new Set([...R.platforms.map(([x, y]) => x + ',' + y), ...this.ladders.map(l => l.tx + ',' + l.ty)]);
    this.platforms = this.physics.add.staticGroup();
    for (const key of this.platformTiles) {
      const [x, y] = key.split(',').map(Number), z = this.add.zone((x + 0.5) * T, y * T + 8, T, 16);
      this.platforms.add(z);
      Object.assign(z.body.checkCollision, { down: false, left: false, right: false });
    }
    this.anchors = R.anchors.map(([x, y]) => ({ x: (x + 0.5) * T, y: (y + 0.5) * T }));
    this.rope = this.add.graphics().setDepth(9);

    const start = R.start || [2, R.h - 2];
    // spawn point (Leyla's van): decoration, its anchor sits on Leyla's start; door, roof and dish in van.js
    const S = this.data_.game?.spawn;
    this.van = S?.enabled !== false && S?.look && this.assetInfo(S.look) ? new Van(this, S, [(start[0] + 0.5) * T, (start[1] + 1) * T]) : null;
    this.spawnArt = this.van?.sprite;
    // buffs from the savegame count in a run (health, defense, damage)
    this.mods = {};
    this.gearMods = null; this.applyGear();   // worn gear and implants count everywhere
    if (this.mode === 'run') for (const b of this.box.save.buffs) { const d = this.data_.buffs?.[b]; if (d?.stat) this.mods[d.stat] = (this.mods[d.stat] || 0) + Math.round((d.value || 0) * (1 + (this.box.save.buffQ?.[b] || 0) / 100)); }
    const feet = [(start[0] + 0.5) * T, (start[1] + 1) * T];
    if (this.args.startX) feet[0] = this.args.startX;
    this.leyla = new Leyla(this, this.data_, feet);
    if (this.box) this.leyla.health = Math.max(1, Math.min(this.leyla.maxHealth, this.box.save.health + (this.mode === 'run' ? this.mods.health || 0 : 0)));
    this.drone = new Drone(this, this.data_);
    if (this.box?.save.tank?.dead) { this.drone.gone = true; this.drone.sprite.setVisible(false); }   // AvA is gone until the next Durchgang
    this.lostPack = null;
    this.van?.reset();
    if (this.mode === 'camp') { const G = this.box.save.ground ??= {}; this.loot = new Loot(this, G[this.box.save.location] ??= []); }
    else this.loot = this.mode === 'run' ? new Loot(this) : null;
    this.setupInventory();
    if (this.mode === 'camp') this.camp = new Camp(this, this.box, this.campGeo);
    if (this.mode === 'camp' && this.box) this.time.delayedCall(this.script ? 0 : 1400, () => this.campNews());
    this.drone.roamArea = this.mode === 'camp' ? { x0: 6 * this.T, x1: (this.campGeo.W - 2) * this.T, ground: this.campGeo.floor * this.T } : null;
    this.drone.roamTo = null;
    this.backdrop?.front();
    this.physics.add.collider(this.leyla.box, this.solids);
    this.drone.makePlatform?.();   // AvA as a platform (Drohne › Plattform)
    this.physics.add.collider(this.leyla.box, this.platforms, null, (box, plat) => {
      const l = this.leyla, b = l.body;
      return l.state !== 'climb' && l.state !== 'swing' && this.time.now >= l.dropUntil && b.velocity.y >= 0 && b.prev.y + b.height <= plat.body.top + 2;
    });
    this.enemies = [];
    this.spawnEnemies();
    // chests, switches + doors, brittle walls, goal (game/play/poi_level.js): in POI levels and in single rooms that have them
    const M = R.marks || {};
    this.camo = drawn?.camo || [];
    this.level = this.mode !== 'camp' && (this.levelInfo?.def || ['C', 'S', 'D', 'B', 'Z', '%', '$'].some(k => M[k]?.length)) ? new PoiLevel(this, run?.poi || null) : null;
    this.props = drawn?.props || [];
    this.fog = new Fog(this);   // soft fog of war indoors (Spiel › Nebel)

    const cam = this.cam, C = this.data_.game?.camera || {};
    cam.setZoom(C.zoom || 1);
    // room lower than the view (zoomed out): floor stays at the bottom edge, sky above
    const viewH = this.scale.height / (C.zoom || 1);
    cam.setBounds(0, Math.min(0, H - viewH), W, Math.max(H, viewH));
    cam.startFollow(this.leyla.box, false, C.follow ?? 0.12, C.follow ?? 0.12);
    cam.fadeIn(400, 13, 10, 18);
    // light & atmosphere (game/play/atmosphere.js): darkness with lamps, glow, colour mood, dust, sparks, drips, fog
    this.atmo = new Atmosphere(this, this.props);

    this.keys = {};
    for (const [name, list] of Object.entries(KEYS)) this.keys[name] = list.map(k => this.input.keyboard.addKey(k));
    this.input.keyboard.on('keydown', () => this.hud.firstKey());
    this.physics.world.drawDebug = false;
    this.physics.world.debugGraphic?.setVisible(false);
    this.startTime = 0; this.kills = 0; this.deltas = 0; this.cleared = false; this.hitstopUntil = 0;
    this.hud.room(def?.name || this.roomId, this.enemies.length);
    this.hud.mode(this.mode, this.box?.save, this.data_);
    if (this.mode === 'run') this.hud.room(`${this.data_.pois?.[this.box.save.run?.poi]?.name || ''} · ${def?.name || this.roomId}`, this.enemies.length);
    if (this.args.summary && this.mode === 'camp') { const S = this.args.summary; this.args.summary = null; this.time.delayedCall(450, () => this.hud.sum?.open(S)); }
    if (this.args.banner) { const [t, sub, kind] = this.args.banner; this.hud.banner(t, sub, 4200, kind || (this.mode === 'camp' ? 'camp' : 'travel')); }
    if (this.mode === 'camp' && this.rain && !this.hud.toldRain && !/regnet/.test(this.args.banner?.[0] || '')) this.hud.toast('Es regnet', 'Die Zisterne füllt sich schneller', 'camp', 3600);
    if (this.mode === 'camp') this.hud.toldRain = !!this.rain;
    else this.hud.banner(null);
    this.leaving = false; this.roomName = null;
    if (this.dreaming) this.wakeUp();
  }

  // worn gear and implants (inv.wear) on top of the buffs: swap the old sums for the new ones, AvA shows her parts
  applyGear() {
    const g = this.box ? { ...gearStats(this.data_, this.box.save.inv?.wear, implantBoosts(this.data_, this.box.save)) } : {};
    if (this.box) { const b = bonuses(this.data_, this.box.save); for (const k of ['health', 'damage']) if (b[k]) g[k] = (g[k] || 0) + b[k]; }   // Techtree: passive bonuses count like gear
    if (this.box) { const b = trophyBonuses(this.data_, this.box.save); for (const k of GEAR_KEYS) if (b[k] && k !== 'tankDecay' && k !== 'droneBattery') g[k] = (g[k] || 0) + b[k]; }   // trophies on the stands (#012)
    for (const k of GEAR_KEYS) { const v = (this.mods[k] || 0) - (this.gearMods?.[k] || 0) + (g[k] || 0); if (v) this.mods[k] = v; else delete this.mods[k]; }
    this.gearMods = g;
    // Cyberware (#006, Daniel, 13.11.2026: Implantate „ermöglichen Doppelsprung und Dash“): with a savegame and Leyla › Fähigkeiten › nur mit Implantat
    // the double jump and the air dash come only from implants; the test room keeps everything
    const gated = this.box && this.data_.leyla?.abilities?.gated !== false;
    this.ability = gated ? { airJumps: Math.max(0, g.airJumps || 0), airDash: (g.airDash || 0) > 0 } : null;
    if (this.leyla) { this.leyla.airJumps = Math.min(this.leyla.airJumps, this.leyla.maxAirJumps); if (!this.leyla.canAirDash) this.leyla.airDash = false; }
    if (this.leyla) this.leyla.health = Math.min(this.leyla.health, this.leyla.maxHealth);
    this.drone?.refreshParts();
  }

  // ---------- inventory (game/play/inventory_ui.js, game/inventory.js) ----------
  setupInventory() {
    this.hud.scene = this;
    if (!this.box) return;
    const hud = this.hud;
    hud.floor ??= new FloorStrip(hud.root, this.data_);   // Boden-Leiste (floor_strip.js)
    hud.floor.D = this.data_; hud.floor.sig = null;
    hud.inv ??= new InventoryUI(hud.root, {
      get D() { return hud.scene.data_; },
      save: () => hud.scene.box.save,
      changed: key => hud.scene.invChanged(key),
      equipChanged: slot => { const sc = hud.scene; if (slot === 'ranged') sc.leyla.loadWeapon(); },
      throwDown: e => hud.scene.loot ? hud.scene.loot.throwDown(e) : null,
      padActive: () => { const p = hud.scene.pad; if (!(p?.active && p.kind)) return false; hud.padHelp?.(p, PAD_ACTIONS); return true; },
      use: (id, q) => hud.scene.useThing(id, q),
      learn: (g, e) => hud.scene.learnFrom(g, e),
      canThrow: () => !!hud.scene.loot,
      inCamp: () => hud.scene.mode === 'camp',
      gearChanged: () => hud.scene.applyGear(),
      react: mood => hud.scene.drone?.react(mood),
      rigChanged: () => hud.scene.camp?.drawRig(),
      notify: (text, kind = 'warn') => hud.toast(text, '', kind, 2600),
    });
    hud.inv.close();
    // cooking and crafting at the workshops in the camp (game/play/craft_ui.js)
    hud.craft ??= new CraftUI(hud.root, {
      get D() { return hud.scene.data_; },
      save: () => hud.scene.box.save,
      changed: r => { hud.scene.craftDone(r, hud.craft.ws); clearTimeout(hud.scene.saveTimer); hud.scene.saveTimer = setTimeout(() => hud.scene.box?.persist(), 600); },
      leftover: (id, n, a = 'items', x = {}) => hud.scene.loot?.throwDown({ a, id, n, r: 0, ...x }),
      react: mood => hud.scene.drone?.react(mood),
      closed: () => hud.scene.craftClosed(),
    });
    hud.craft.el.hidden = true;
    // the tech tree in the warroom (game/play/techtree_ui.js)
    hud.tech ??= new TechtreeUI(hud.root, {
      get D() { return hud.scene.data_; },
      save: () => hud.scene.box.save,
      changed: () => { clearTimeout(hud.scene.saveTimer); hud.scene.saveTimer = setTimeout(() => hud.scene.box?.persist(), 400); hud.scene.applyGear?.(); },
      notify: (text, kind = 'info') => hud.toast(text, '', kind, 3200),
      closed: () => {},
    });
    hud.tech.close(); hud.tech.el.hidden = true;
    // the field guide (#011, game/play/tutorial.js): a card the first time, Menü › Feldhandbuch
    hud.tut ??= new Tutorial(hud.root, { scene: () => hud.scene, hud });
    hud.ach ??= new AchievementsUI(hud.root, { scene: () => hud.scene });   // Menü › Achievements (#012)
    hud.sum ??= new SummaryUI(hud.root, { scene: () => hud.scene, go: next => hud.scene.goNext?.(next) });   // Beute-Bilanz (#017)
    hud.quests ??= new QuestLogUI(hud.root, { scene: () => hud.scene, toast: (t, sub, kind) => hud.toast(t, sub, kind), changed: () => { hud.campKey = null; hud.goalAt = 0; hud.scene.camp?.questMarks?.(); } });   // Questlog (#016)
    // the travel map (#007, game/play/map_ui.js): warroom and van door
    hud.map ??= new MapUI(hud.root, {
      get D() { return hud.scene.data_; }, get base() { return hud.scene.base; },
      save: () => hud.scene.box.save,
      cost: id => travelCost(hud.scene.data_, hud.scene.box.save, id),
      blocked: t => hud.scene.camp?.driveBlocked(t) ?? null,
      drive: (id, t) => hud.scene.camp?.drive(id, t),
      plunder: () => hud.scene.camp?.plunderHere(),
      loadout: () => hud.scene.camp?.loadout?.() || [],
      intel: () => !!hud.scene.camp?.rigWorkshop('warroom'),   // without a warroom the map does not tell danger and loot (Daniel, 13.11.2026)
      closed: () => {},
    });
    hud.map.close(); hud.map.el.hidden = true;
    // building the rig right in the camp (game/play/build_mode.js): B in the camp or Warroom › Rig umbauen
    hud.build ??= new BuildMode(hud.root, { scene: () => hud.scene });
    hud.build.reset();
  }
  openBuild() {
    if (this.mode !== 'camp' || !this.box || this.hud.build.active) return;
    this.hud.inv?.close();
    this.hud.closeMenu?.();
    this.hud.build.open();
  }
  // the sky changed since the camp was drawn: another time of day, or the rain started or stopped (#014)
  skyChanged() { const save = this.box.save; return daytimeAt(this.data_.camp || {}, save.hour)?.name !== this.camp?.day?.name || raining(this.data_, save) !== !!this.rain; }
  skyBanner() {
    const save = this.box.save, wet = raining(this.data_, save);
    if (wet !== !!this.rain) return wet ? ['Es regnet', `${clockText(save)} · Die Zisterne füllt sich schneller`, 'camp'] : ['Der Regen hört auf', clockText(save), 'camp'];
    return [daytimeAt(this.data_.camp || {}, save.hour)?.name || 'Die Zeit vergeht', clockText(save)];
  }
  // building finished: save; the clock may have moved into another time of day (light, sky) → camp fresh at the same spot
  buildClosed() {
    const C = this.data_.camp || {}, save = this.box.save;
    this.box.persist();
    if (this.camp && this.skyChanged()) this.time.delayedCall(this.script ? 0 : 700, () => this.goCamp({ banner: this.skyBanner(), fade: 500, keepPlace: true }));
    // the rig got taller than the camp (container stacked on a container on its chassis): camp fresh at the same spot, now high enough
    else if (this.camp && this.campGeo && campLayout(this.data_, save, this.T).H !== this.campGeo.H) this.time.delayedCall(this.script ? 0 : 300, () => this.goCamp({ fade: 300, keepPlace: true }));
  }
  // the cooking/crafting panel closed: the clock may have moved into another time of day (light, sky) → camp fresh at the same spot
  craftClosed() {
    const C = this.data_.camp || {}, save = this.box.save;
    this.box.persist();
    if (this.camp && this.skyChanged()) this.goCamp({ banner: this.skyBanner(), fade: 500, keepPlace: true });
  }
  // eating or using a thing from the inventory (Gegenstände › Buff beim Essen/Benutzen): heals now or waits as a buff for the next run
  useThing(id, q = 0) {
    const D = this.data_, save = this.box.save, l = this.leyla, r = useThing(D, save, id, { health: l.health, maxHealth: l.maxHealth, q });
    if (!r.ok) return r;
    if (r.heal) { r.heal *= Math.max(0, 1 + (this.mods.heal || 0) / 100); l.health = Math.min(l.maxHealth, l.health + r.heal); save.health = Math.round(l.health); }   // Heilung % from implants
    const b = D.buffs?.[r.buff] || {};
    const bv = Math.round((b.value || 0) * (1 + (r.bonus || 0) / 100));   // a good / perfect dish (#013)
    if (this.mode === 'run' && !r.heal && b.stat) { this.mods[b.stat] = (this.mods[b.stat] || 0) + bv; if (b.stat === 'health') l.health = Math.min(l.maxHealth, l.health + bv); }
    this.hud.toast(r.heal ? `+${Math.round(r.heal)} Leben` : `${b.name || r.buff}${r.bonus ? ` +${r.bonus} %` : ''}`, r.heal ? '' : this.mode === 'camp' ? 'Wirkt im nächsten Run' : (b.description || ''), 'heal', 2600);
    return r;
  }
  // something moved in an inventory: ground bundles appear or vanish, the savegame is written soon after
  invChanged(key) {
    this.learnNotes();
    const o = this.hud.inv?.other;
    if (this.loot && o?.kind === 'floor') this.loot.sync(o.pile);
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.box?.persist(), 1200);
    if (key) this.hud.inv?.draw();
  }
  // the ground: one bundle at a time; with several in reach L1/R1 (cursor on the ground) or the arrows in the header page through them
  // (Daniel, 13.11.2026: „Boden-Inventar scrollbar mit Schulterbuttons, das macht es einfacher, wenn da viel Zeug liegt“)
  openFloor(page = 0) {
    const all = this.loot.inReach(), n = all.length, i = n ? ((page % n) + n) % n : 0, pile = n ? all[i] : this.loot.floor();
    const inv = this.hud.inv, keep = inv.isOpen && inv.other?.kind === 'floor';
    inv.open({ key: 'floor', title: this.loot.piles.includes(pile) ? 'Boden · Beute' : 'Boden', grid: pile.grid, kind: 'floor', pile, page: i, pages: Math.max(1, n),
      flip: d => this.openFloor(i + d) }, keep ? {} : undefined);
  }
  // camp: the chest or a storage place
  openContainer(key) {
    const c = containers(this.data_, this.box.save).find(x => x.key === key);
    if (!c) return;
    // the treasury: its trophy stands open with it, each one an inventory of its own
    const all = containers(this.data_, this.box.save), g = k => this.box.save.inv.grids[k];
    const extra = all.filter(x => x.parent === key && g(x.key)).map(x => ({ key: x.key, title: x.name.split(' · ').pop(), grid: g(x.key), accept: x.accept }));
    this.hud.inv.open({ key, title: c.name, grid: g(key), kind: 'container', x: this.leyla.x, accept: c.accept, extra });
  }
  inventoryUpdate(input) {
    const inv = this.hud.inv;
    if (!inv) return;
    if (input.inventory.pressed) {
      if (inv.isOpen) inv.close(); else if (this.mode === 'run' || this.loot?.nearest()) this.openFloor(); else inv.open();
    }
    if (!inv.isOpen) return;
    const o = inv.other;
    // the ground follows Leyla: another bundle comes into reach
    if (this.loot && o?.kind === 'floor' && !inv.held) {
      // the shown bundle stays while it is in reach (L1/R1 may have paged to another one); out of reach = the nearest one again
      const all = this.loot.inReach(), at = all.indexOf(o.pile);
      if (at < 0 && (all.length || this.loot.piles.includes(o.pile))) this.openFloor();
      else if (at >= 0 && (all.length !== o.pages || at !== o.page)) this.openFloor(at);
    }
    // walked away from a chest or a shelf
    if (o?.kind === 'container' && Math.abs(this.leyla.x - o.x) > (this.data_.camp?.interactRange ?? 130) * 2) inv.open(null);
  }

  // Spiel › Ladebalken during a wait without input (k.o.): after a short beat the bar runs over the rest of the wait.
  // Whoever ends the wait calls done() or restarts the scene (restartAs keeps the bar open).
  waitBar(ms, text, sub, { drone = true, after = 350 } = {}) {
    const L = this.args.loading;
    if (!L || this.script) return null;
    this.time.delayedCall(after, () => L.show({ text, sub, drone, ms: Math.max(100, ms - after) }));
    return L;
  }

  // ---------- queries for Leyla, enemies and projectiles ----------
  tileAt(px, py) { return this.room.tiles[Math.floor(py / this.T)]?.[Math.floor(px / this.T)] ?? '#'; }
  // free line of sight between two points (walls only, steps of a quarter tile)
  lineFree(x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (this.T / 4));
    for (let i = 1; i < n; i++) if (this.pointSolid(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false;
    return true;
  }
  // shooting style (Spiel › Kampf; Pause-Menü › Optionen overrides it in this browser): 'classic' | 'cells'
  shootRules() { return this.data_.game?.combat || {}; }
  shootStyle() {
    let o = null;
    try { o = localStorage.getItem('nomadgirl-shoot-style'); } catch { /* private mode */ }
    return o === 'classic' || o === 'cells' ? o : this.shootRules().shootStyle || 'classic';
  }
  cellsLike() { return this.shootStyle() === 'cells'; }
  pointSolid(px, py) { return this.room.solid(Math.floor(px / this.T), Math.floor(py / this.T)); }
  rectFree(x, y, w, h) {
    const T = this.T;
    for (let ty = Math.floor(y / T); ty <= Math.floor((y + h - 1) / T); ty++)
      for (let tx = Math.floor(x / T); tx <= Math.floor((x + w - 1) / T); tx++) if (this.room.solid(tx, ty)) return false;
    return true;
  }
  groundAt(px, py) { const tx = Math.floor(px / this.T), ty = Math.floor(py / this.T); return this.room.solid(tx, ty) || this.platformTiles.has(tx + ',' + ty); }
  onPlatform(x, feet) {
    const ty = Math.floor((feet + 4) / this.T);
    for (const dx of [-30, 0, 30]) if (this.platformTiles.has(Math.floor((x + dx) / this.T) + ',' + ty)) return true;
    return false;
  }
  // ledge for the hands: in front of Leyla (dir) a ground tile (wall or platform) with free space above it,
  // its top edge between handY - 8 and handY + reach; returns the wall face x, the edge y and the direction to the wall
  // up = the edge may be this far above the hands, side = this far beside her (both make grabbing forgiving, Leyla › Kanten & Ducken)
  ledgeAt(x, handY, dir, reach, halfW, up = 8, side = 6) {
    const T = this.T, ground = (c, r) => this.room.solid(c, r) || this.platformTiles.has(c + ',' + r);
    const near = Math.floor((x + dir * (halfW + 6)) / T), far = Math.floor((x + dir * (halfW + Math.max(6, side))) / T);
    for (let cx = near; dir > 0 ? cx <= far : cx >= far; cx += dir) {
      for (let r = Math.floor((handY - up) / T); r * T <= handY + reach; r++) {
        if (r * T < handY - up) continue;
        if (ground(cx, r) && !ground(cx, r - 1) && !ground(cx - dir, r) && !this.room.solid(cx - dir, r - 1))
          return { x: dir > 0 ? cx * T : (cx + 1) * T, y: r * T, dir };
      }
      if (ground(cx, Math.floor(handY / T))) break;   // a wall in between: no grabbing through it
    }
    return this.drone?.ledgeFor?.(x, handY, dir, reach, halfW, up, side) || null;   // AvA's edge
  }
  // edge of the ground Leyla stands on, in direction dir (for climbing down): hanging there she faces back to it
  edgeBelow(x, feet, dir, halfW) {
    const T = this.T, r = Math.floor((feet + 2) / T), ground = (c, rr) => this.room.solid(c, rr) || this.platformTiles.has(c + ',' + rr);
    const cq = Math.floor((x + dir * halfW) / T);
    for (const c of [cq, cq - dir]) {
      if (!ground(c, r) || ground(c + dir, r) || this.room.solid(c + dir, r - 1)) continue;
      const ex = dir > 0 ? (c + 1) * T : c * T;
      if (Math.abs(ex - x) <= halfW + 48) return { x: ex, y: r * T, dir: -dir };
    }
    return null;
  }
  ladderAt(x, feet) { return this.ladders.find(l => x > l.x0 - 8 && x < l.x1 + 8 && feet >= l.top - 6 && feet <= l.bottom + 6) || null; }
  anchorNear(x, y, max) {
    let best = null, bd = max;
    for (const a of this.anchors) { const d = Math.hypot(a.x - x, a.y - y); if (d <= bd) { best = a; bd = d; } }
    return best;
  }
  hitstop(time, ms) { this.hitstopUntil = time + ms; this.physics.world.pause(); }

  // ---------- loop ----------
  readInput() {
    const J = Phaser.Input.Keyboard.JustDown, i = this.script ? this.script() : {};   // remote control (game/play/control.js)
    if (!this.script) for (const [name, keys] of Object.entries(this.keys)) {
      let pressed = false;
      for (const k of keys) if (J(k)) pressed = true;   // every key once per frame
      i[name] = { down: keys.some(k => k.isDown), pressed };
    }
    // controller (game/play/pad.js): adds to the keyboard, same action names
    const pad = this.pad?.poll();
    const kb = {}; for (const [k, v] of Object.entries(i)) kb[k] = { ...v };
    this.ui = uiInput(kb, pad);   // window keys (ui_nav.js): one grammar for menus, inventory, cooking, building
    // inventory open: the controller drives its cursor (padMenus), Leyla only hears the keyboard; Select / Start still close
    const invPad = this.hud.inv?.isOpen && !this.hud.paused && !this.hud.modal;
    // Select in the camp (Daniel, 12.11.2026: „Rig-Bau-Modus = Select“): tap = inventory (on release), hold = build the rig
    const selHold = this.mode === 'camp' && pad?.kind && !this.hud.inv?.isOpen && !this.hud.build?.active && !this.hud.modal && !this.hud.craft?.isOpen && !(this.hud.tech?.isOpen || this.hud.map?.isOpen);
    if (pad?.kind) for (const name of Object.keys(i)) { if (invPad && name !== 'inventory' && name !== 'help') continue; if (name === 'inventory' && (selHold || this.hud.build?.active)) continue; i[name].down ||= pad.down(name); i[name].pressed ||= pad.pressed(name) && !(pad.viaUp?.has(name) && !this.useByUp()); }
    if (selHold) {
      const hold = this.data_.game?.gamepad?.buildHold ?? 500, now = this.now ?? 0;
      if (pad.down('inventory')) {
        this.selAt ??= now;
        if (!this.selFired && now - this.selAt >= hold && hold > 0) { this.selFired = true; i.build = { down: true, pressed: true }; }
      } else { if (this.selAt != null && !this.selFired) i.inventory.pressed = true; this.selAt = null; this.selFired = false; }
    } else if (!pad?.down('inventory')) { this.selAt = null; this.selFired = false; }
    // use by „up“ (Daniel, 12.11.2026, 3a): W / ↑ / the stick flicked up counts as E while an E prompt is on screen and Leyla stands or walks;
    // then it does not start a ladder (the prompt wins)
    if (i.up?.pressed && !i.grab.pressed && this.useByUp()) { i.grab.pressed = true; i.up.pressed = false; }
    else if (i.grab.pressed && pad?.viaUp?.has('grab')) i.up.pressed = false;
    this.hud.padHelp(pad, PAD_ACTIONS);
    return i;
  }
  useByUp() {
    const l = this.leyla, h = this.hud, G = this.data_.game?.gamepad || {};
    if (G.useUp === false || !l?.alive || h.modal || h.paused || h.inv?.isOpen || h.craft?.isOpen || (h.tech?.isOpen || h.map?.isOpen) || h.build?.active) return false;
    if (!h.promptText || (h.promptKey || 'E') !== 'E' || h.promptEl?.hidden) return false;
    return l.state === 'normal' && (l.body.blocked.down || l.body.touching.down) && Math.abs(l.body.velocity.x) <= (l.m.walkSpeed ?? 240) * 1.15;
  }
  // windows (ui_nav.js, Daniel 12.11.2026: one grammar): move, ok, back, context, send, tabs; keyboard and controller alike
  padMenus(input, dt = 16) {
    const u = this.ui, hud = this.hud, p = this.pad;
    if (!u) return;
    const eat = () => { for (const k of ['jump', 'grab', 'dash', 'up', 'down', 'left', 'right', 'melee', 'ranged', 'reload', 'holster']) if (input[k]) input[k].pressed = false; };
    if (hud.tut?.isOpen) { hud.tut.nav(u); eat(); input.help.pressed = false; return; }   
    if (hud.sum?.isOpen) { hud.sum.nav(u); eat(); input.help.pressed = false; return; }   // Beute-Bilanz (#017)
    if (hud.quests?.isOpen) { hud.quests.nav(u); eat(); input.help.pressed = false; return; }   // Questlog (#016)
    if (hud.ach?.isOpen) { hud.ach.nav(u); eat(); input.help.pressed = false; return; }   // Menü › Achievements (#012)   // the field guide card / archive (#011)
    if (hud.paused && !hud.modal) { if (u.pressed('ok') || u.pressed('back')) { hud.toggleHelp(false); eat(); input.help.pressed = false; } return; }
    if (hud.modal) {
      if (p?.kind) {   // the keyboard runs the menu through its own keys (hud.menuKey)
        if (p.uiNow.has('down') && !p.uiPrev.has('down')) hud.menuMove(1);
        else if (p.uiNow.has('up') && !p.uiPrev.has('up')) hud.menuMove(-1);
        else if (p.uiNow.has('ok') && !p.uiPrev.has('ok')) hud.choose(hud.menuIndex);
        else if ((p.uiNow.has('back') && !p.uiPrev.has('back')) || p.pressed('help')) hud.closeMenu();
      }
      eat(); input.help.pressed = false;
      return;
    }
    if (hud.map?.isOpen) {
      if (u.pressed('back')) { hud.map.close(); input.help.pressed = false; }
      else hud.map.nav(u);
    }
    if (hud.tech?.isOpen) {
      if (u.pressed('back')) { hud.tech.close(); input.help.pressed = false; }
      else hud.tech.nav(u);
      eat(); return;
    }
    if (hud.craft?.isOpen) {
      if (u.pressed('back')) { hud.craft.close(); input.help.pressed = false; }
      else hud.craft.nav?.(u);
      eat(); return;
    }
    if (hud.inv?.isOpen && !hud.paused) { hud.inv.padNav(u, this.now ?? performance.now()); if (u.pressed('back')) input.help.pressed = false; eat(); return; }
    if (hud.build?.active) hud.build.nav(u, p, dt);   // cursor for controller and keyboard (build_mode.js)
  }

  toggleMute() {
    this.sound.mute = !this.sound.mute;
    try { localStorage.setItem('nomadgirl-mute', this.sound.mute ? '1' : '0'); } catch { /* private mode */ }
    this.hud.banner(this.sound.mute ? 'Ton aus' : 'Ton an', 'M schaltet um', 1600);
  }

  update(time, delta) {
    this.now = time;   // the loop's clock (hits, shots and Leyla run on it; scene.time.now is another clock)
    let input = this.readInput();
    this.padMenus(input, Math.min(delta, 50));
    this.hud.tut?.tick(performance.now()); this.hud.tut?.poll(this.now);   // field guide (#011)
    // Esc / Start: closes what is open (inventory, controls), otherwise the pause menu (Daniel, 11.11.2026: controls hidden in a menu)
    if (input.help.pressed) {
      if (this.hud.inv?.isOpen && !this.hud.paused) this.hud.inv.close();
      else if (this.hud.paused) this.hud.toggleHelp(false);
      else if (!this.hud.modal && !this.hud.craft?.isOpen && !(this.hud.tech?.isOpen || this.hud.map?.isOpen) && !this.hud.build?.active && !this.leaving) this.hud.pauseMenu();
    }
    if (input.controls?.pressed && !this.hud.modal) this.hud.toggleHelp();
    if (input.mute.pressed) this.toggleMute();
    if (input.debug.pressed) { const w = this.physics.world; w.drawDebug = !w.drawDebug; if (!w.debugGraphic) w.createDebugGraphic(); w.debugGraphic.clear().setVisible(w.drawDebug); }
    if (input.restart.pressed && this.mode === 'test' && this.level) this.restartAs({});   // doors, chests, walls: fresh room
    else if (input.restart.pressed && this.mode !== 'camp' && !this.level) this.restartRoom();
    const building = this.hud.build?.active;
    if (input.swap?.pressed && !building && !this.hud.modal && !this.hud.paused && !this.hud.inv?.isOpen && !this.hud.craft?.isOpen && !(this.hud.tech?.isOpen || this.hud.map?.isOpen) && this.leyla.alive) this.swapRanged();
    if (input.build?.pressed && building) this.hud.build.close();
    else if (input.build?.pressed && this.mode === 'camp' && !this.hud.modal && !this.hud.paused && !this.leaving && !this.hud.craft?.isOpen && !(this.hud.tech?.isOpen || this.hud.map?.isOpen)) this.openBuild();
    // every window pauses the game (Daniel, 12.11.2026: „Fenster pausieren immer, auch im Run“): menus, controls, cooking and the inventory
    let invDone = false;
    if (this.hud.inv?.isOpen && !this.hud.paused && !this.hud.modal && !this.leaving) { this.inventoryUpdate(input); invDone = true; }
    if (this.hud.tut?.isOpen || this.hud.ach?.isOpen || this.hud.quests?.isOpen || this.hud.sum?.isOpen || this.hud.paused || this.hud.modal || this.hud.craft?.isOpen || (this.hud.tech?.isOpen || this.hud.map?.isOpen) || this.hud.inv?.isOpen || this.leaving) {
      // cooking, crafting, a menu: the workshops keep glowing, steaming and sparking behind the window
      if (this.camp && !this.hud.paused && !this.leaving) { this.camp.benches?.update(time, Math.min(delta, 50)); this.camp.lid?.(Math.min(delta, 50)); }
      this.physics.world.pause(); this.hud.update(this, time); return;
    }
    if (time < this.hitstopUntil) return;
    if (this.physics.world.isPaused) this.physics.world.resume();
    const dt = Math.min(delta, 50);
    if (!this.startTime) this.startTime = time;
    if (!this.cleared) this.elapsed = time - this.startTime;

    if (this.hud.build?.active) input = this.hud.build.drive(input, dt);   // building: Leyla walks to her jobs by herself
    this.leyla.update(time, dt, input);
    // Heilt sich (implants, LP per 10 s; negative = a flaw that drains, never below 1 LP)
    const regen = this.mods?.regen || 0, l = this.leyla;
    if (regen && l.alive && !this.hud.paused) {
      l.health = regen > 0 ? Math.min(l.maxHealth, l.health + regen * dt / 10000) : Math.max(Math.min(l.health, 1), l.health + regen * dt / 10000);
    }
    this.level?.update?.(dt);
    this.fog?.update(dt);
    this.drone.update(time, dt);
    this.van?.update(dt);
    if (this.camp) this.camp.update(time, dt, input);
    else if (this.mode === 'run' || this.level) this.runUpdate(input);
    this.loot?.update(time);
    this.hud.floor?.update(this);
    if (!invDone) this.inventoryUpdate(input);   // (closed this frame already: do not open it again with the same key)
    for (const e of this.enemies) e.update(time, dt, this.leyla);
    this.combat.update(time, dt);

    // rope while swinging
    this.rope.clear();
    if (this.leyla.state === 'swing') { const h = this.leyla.hand(); this.rope.lineStyle(5, 0xb9a27a).lineBetween(this.leyla.anchor.x, this.leyla.anchor.y, h.x, h.y); }
    else for (const a of this.anchors) {
      const near = this.leyla.alive && Math.hypot(a.x - this.leyla.x, a.y - this.leyla.hand().y) <= (this.data_.leyla?.movement?.swingRope ?? 320);
      if (near && !this.leyla.body.blocked.down) this.rope.lineStyle(3, 0x3fe0d0, 0.6 + 0.3 * Math.sin(time / 80)).strokeCircle(a.x, a.y, 30);
    }
    const cam = this.cam;
    cam.followOffset.x += (-this.leyla.facing * (this.data_.game?.camera?.lookAhead ?? 160) - cam.followOffset.x) * Math.min(1, dt / 400);
    this.bgCam.setScroll(cam.worldView.x, cam.worldView.y);   // parallax follows the world camera
    this.backdrop?.update(time, dt);
    this.atmo?.update(time, dt);
    this.hud.build?.update(time, dt);
    this.hud.update(this, time);
  }
}

// Split (#017, backlog C8): camp ↔ run and the events live in their own files
import { SceneRuns } from './scene_runs.js';
import { SceneEvents } from './scene_events.js';
for (const M of [SceneRuns, SceneEvents]) for (const k of Object.getOwnPropertyNames(M.prototype)) if (k !== 'constructor') Object.defineProperty(PlayScene.prototype, k, Object.getOwnPropertyDescriptor(M.prototype, k));
