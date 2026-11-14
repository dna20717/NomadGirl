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
  goCamp({ banner = null, fade = 600, keepPlace = false, arriving = false } = {}) {
    if (arriving) { arrive(this.box.save, this.data_); if (banner) banner = [banner[0], banner[1].replace(/^Tag \d+ · \d\d:\d\d/, clockText(this.box.save))]; }
    this.box.save.health = Math.max(1, Math.min(this.leyla.maxHealth, this.box.save.health));
    this.box.persist();
    this.restartAs({ mode: 'camp', banner, startX: keepPlace ? this.leyla.x : null }, fade);
  }
  startRun(poi) {
    const D = this.data_, P = D.pois?.[poi] || {}, R = D.rooms || {}, has = id => R[id]?.layout?.length;
    // rooms with entrance and exit: a generated level (engine/poi.js); otherwise the first room as before
    if (poiReady(D, poi).ok) {
      this.box.save.health = this.leyla.health;
      this.box.save.run = { poi, room: null, seed: P.seed || 1 + Math.floor(Math.random() * 2 ** 31), location: this.box.save.location, danger: this.placeDanger(poi) };
      this.box.persist();
      return this.restartAs({ mode: 'run', roomId: null, banner: [P.name || poi, `${P.gang?.name ? `Revier: ${P.gang.name} · ` : ''}Finde den Tresor · E am Van: zurück ins Camp`] }, 700);   // #016 whose place this is
    }
    const ready = (P.rooms || []).filter(has);
    const room = ready.find(id => R[id].tags?.includes('start')) || ready[0] || [D.camp?.fallbackRoom, D.game?.testRoom].find(has);
    if (!room) return this.hud.menu({ title: 'Noch kein Raum', sub: 'Dieser POI hat noch keinen Raum mit Layout (Werkstatt › Raum-Bausteine).', items: [{ label: 'Zurück', act: () => {} }] });
    this.box.save.health = this.leyla.health;
    this.box.save.run = { poi, room, location: this.box.save.location, danger: this.placeDanger(poi) };
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
    save.run = null;
    this.hud.inv?.close();
    const banner = ko ? ['AvA hat dich heimgebracht', `${clockText(save)} · Der Rucksack ist weg.`, 'drama']
      : rank ? [`Zurück im Camp · Rang ${rank.grade}`, `${clockText(save)} · +${paid} Δ (${this.deltas} + ${rank.bonus} %) · ${this.kills} Kills`, 'good']
      : ['Zurück im Camp', `${clockText(save)} · +${paid} Δ · ${this.kills} Kills`, 'good'];
    this.goCamp({ banner, fade: ko ? 900 : 600, arriving: true });
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

  // ---------- events ----------
  onLeylaHit(dmg) { this.drone.react('hit'); this.cam.shake(120, 0.006); this.fx.bloodHit(this.leyla.x, this.leyla.chest, -this.leyla.facing || 1, Math.max(0.5, Math.min(1.6, dmg / 15))); this.hud.hurt(); }
  onLeylaDown() {
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
    this.drone.react('rescue');
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
    const D = this.data_, out = rollLoot(D, table) || [], k = (this.box ? trophyBonuses(D, this.box.save).loot || 0 : 0) + (this.threat()?.loot || 0) + (this.box ? droneBonuses(D, this.box.save).loot || 0 : 0);   // + danger of the place (#014), AvA's board (#013)
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
    if (!save || !D.achievements) return;
    this.learnNotes();
    const news = [...(save.achievements?.news || [])];
    if (save.achievements) save.achievements.news = [];
    const now = [...achieveLevel(D, save, 'lights', save.rig?.lights?.length || 0), ...achieveLevel(D, save, 'recipes', save.recipes?.length || 0), ...achieveCheck(D, save)];
    const info = id => { const a = D.achievements[id] || {}, rid = D.recipes?.[a.recipe] ? a.recipe : null; return { id, name: a.name || id, recipe: rid, recipeName: rid ? D.recipes[rid].name || rid : null }; };
    this.announce([...news.filter(id => D.achievements[id]).map(info), ...now]);
  }
  announce(list) {
    if (!list?.length) return;
    const D = this.data_;
    list.forEach((a, i) => this.time.delayedCall(i * 900, () => {
      this.hud.toast(a.name, `Achievement erreicht · ${D.achievements?.[a.id]?.description || ''}`, 'trophy', 5200);
      this.sfxAchieve?.();
      if (a.recipe) this.time.delayedCall(700, () => this.hud.toast(`Rezept gelernt: ${a.recipeName}`, `Einmal herstellen an: ${D.workshops?.[D.recipes?.[a.recipe]?.station]?.name || 'Werkbank'} · dann in die Schatzkammer stellen`, 'recipe', 5200));
    }));
    this.drone?.react('cleared');
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.box?.persist(), 800);
  }

  onKill(e) {
    this.kills++;
    const slots = this.box?.save.inv?.slots || {}, h = e.lastHit || {};
    this.achieve('kills', 1, [e.id, e.d.family, h.kind === 'shot' ? slots.ranged : h.kind === 'melee' ? slots.melee : null, h.crit ? 'crit' : null]);
    this.loot?.fromEnemy(e);
    this.drone.react('kill');
    const [a, b] = e.d.deltas || [0, 0], d = a + Math.floor(Math.random() * (b - a + 1));
    this.deltas += d;
    if (d) this.fx.text(e.x, e.feet - e.h - 20, `+${d} Δ`, { color: '#ffd27a', size: 48, rise: 90, life: 1100 });
    if (!this.level && this.enemies.every(x => !x.alive) && !this.cleared) {
      this.cleared = true;
      this.drone.react('cleared');
      this.time.delayedCall(700, () => this.hud.banner('Raum geräumt', `${this.clock()} · ${this.kills} Kills · ${this.deltas} Δ · R für nochmal`, 0, 'good'));
    }
  }
  clock() { const s = Math.floor(this.elapsed / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  // in a run: E at the van's door goes back to the camp
  runUpdate(input) {
    const l = this.leyla, v = this.van;
    const near = v && l.alive && l.body.blocked.down && Math.abs(l.x - v.x) < (this.data_.camp?.interactRange ?? 130) && Math.abs(l.feet - v.y) < 40;
    // POI level: the HUD names the room Leyla is in
    const LI = this.levelInfo;
    if (LI?.def) {
      const tx = l.x / this.T, ty = l.feet / this.T - 0.5, here = LI.rooms.find(r => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h);
      const name = here ? this.data_.rooms?.[here.id]?.name || here.id : 'Abkürzung';
      if (name !== this.roomName) { this.roomName = name; this.hud.room(`${LI.def.name} · ${name}`, this.enemies.length); }
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
    else if (input.grab.pressed && floorText && key === 'E') this.hud.floor.pick(this);
  }

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
    if (this.hud.tut?.isOpen || this.hud.ach?.isOpen || this.hud.paused || this.hud.modal || this.hud.craft?.isOpen || (this.hud.tech?.isOpen || this.hud.map?.isOpen) || this.hud.inv?.isOpen || this.leaving) {
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
