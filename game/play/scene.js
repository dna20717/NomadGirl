// The play scene: builds a room from its layout, places Leyla and the enemies, runs input, physics, combat and HUD.
import { parseRoom, solidRects } from '../../engine/room.js';
import { buildPoi, poiReady } from '../../engine/poi.js';
import { PoiLevel } from './poi_level.js';
import { Pad, PAD_ACTIONS } from './pad.js';
import { Fog } from './fog.js';
import { makeTextures, drawBackground, drawRoom, terrainKits, PLACEHOLDER_COLORS } from './art.js';
import { Leyla } from './leyla.js';
import { Enemy } from './enemies.js';
import { Combat } from './combat.js';
import { Fx } from './fx.js';
import { Atmosphere } from './atmosphere.js';
import { Drone } from './drone.js';
import { Van } from './van.js';
import { Backdrop } from './backdrop.js';
import { Camp, campLayout, daytimeAt, drawCampBackground, drawCampGround } from './camp.js';
import { advance, arrive, clockText, containers } from '../save.js';
import { Loot } from './loot.js';
import { InventoryUI } from './inventory_ui.js';
import { gearStats } from '../inventory.js';
import { CraftUI } from './craft_ui.js';
import { BuildMode } from './build_mode.js';
import { use as useThing } from '../crafting.js';

const BORROW = { walk: ['run'], airJump: ['jump'], fall: ['jump'] };

const KEYS = {
  left: ['A', 'LEFT'], right: ['D', 'RIGHT'], up: ['W', 'UP'], down: ['S', 'DOWN'],
  jump: ['SPACE'], walk: ['SHIFT'], dash: ['L', 'C'], melee: ['J', 'Y'], ranged: ['K', 'X'], grab: ['E'],
  restart: ['BACKSPACE'], reload: ['R'], help: ['ESC'], controls: ['H'], debug: ['G'], mute: ['M'], inventory: ['I', 'TAB'], pose: ['P'], build: ['B'], holster: ['Q'],
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
    const A = this.data_.assets || {}, ids = new Set(Object.values(this.data_.leyla?.look || {}));
    for (const e of Object.values(this.data_.enemies || {})) if (e.look) ids.add(e.look);
    for (const [k, id] of Object.entries(this.data_.game?.tiles || {})) if (k !== 'terrain') ids.add(id);
    for (const t of Object.values(this.data_.terrain || {})) for (const id of [t.look, t.props, t.propsBig]) if (id) ids.add(id);   // Kachel-Sets (TileSet00)
    const DR = this.data_.drone || {};
    for (const id of [DR.look, DR.face?.look, DR.face?.glass, ...(DR.parts || []).filter(r => r.on).map(r => r.look)]) if (id) ids.add(id);
    for (const r of this.data_.leyla?.idles || []) if (r.look) ids.add(r.look);
    { const C = this.data_.leyla?.combo || {}; for (const r of C.hits || []) for (const id of [r.look, r.walk]) if (id) ids.add(id); if (C.finisher) ids.add(C.finisher); }   // melee combo (Leyla › Kombo)
    for (const w of Object.values(this.data_.weapons || {})) if (w.sound) ids.add(w.sound);
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
      for (const w of Object.values(this.data_.workshops || {})) for (const id of [w.look, w.lookEmpty]) if (id) ids.add(id);
      // icon sheets of trophies: they stand on the stands of the treasury
      for (const a of ['items', 'weapons']) for (const t of Object.values(this.data_[a] || {})) if (t.tags?.includes('trophy') && t.look && A[t.look]?.kind === 'icons') ids.add(t.look);
      if (this.data_.camp?.yard?.crate?.look) ids.add(this.data_.camp.yard.crate.look);
      if (this.data_.camp?.chassis?.look) ids.add(this.data_.camp.chassis.look);   // modular trailer pieces
      if (this.data_.camp?.ground?.tiles) ids.add(this.data_.camp.ground.tiles);
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
  lookDuration(state) { const a = this.data_.assets?.[this.data_.leyla?.look?.[state]]; return a?.frames && a.fps ? a.frames / a.fps * 1000 : 0; }
  // a state without its own animation borrows a related one (walk → run, double jump → jump), else idle with code effects;
  // walk without its own animation borrows run (Leyla slows its pace down); facing < 0 = left
  playLook(sprite, who, state, facing = 1, start = null) {   // start: frame to continue at (run variants share the step)
    const look = this.data_.leyla?.look || {}, A = this.data_.assets || {}, direct = state.startsWith('@') && this.textures.exists(state.slice(1));
    const has = s => s.startsWith('@') ? direct : look[s] && this.textures.exists(look[s]);
    this.looks ??= {};
    const used = has(state) ? state : (BORROW[state] || []).find(has) || 'idle';
    let id = direct ? state.slice(1) : look[used] || look.idle;   // '@<asset>' plays an asset directly (random idles, sitting)
    const a = A[id], m = a?.mirror;
    if (m && this.textures.exists(m) && (facing < 0) !== !!a.flip) id = m;
    const info = this.looks[id] ??= this.assetInfo(id) || { key: 'px', scale: 60, ox: 0.5, oy: 1, flip: false };
    if (sprite.texture.key !== info.key || (info.anim && sprite.anims.currentAnim?.key !== info.anim)) {
      sprite.setOrigin(info.ox, info.oy);
      // falling without a jump: a shared jump animation starts in its second half
      const mid = used === 'fall' && look.fall === look.jump ? Math.floor((A[id]?.frames || 1) / 2) : 0;
      const n = A[id]?.frames || 1;
      if (info.anim) sprite.play({ key: info.anim, startFrame: start != null ? Math.max(0, Math.min(n - 1, start)) : mid }, true); else sprite.setTexture(info.key);
    }
    return { ...info, used, fallback: used === 'idle' && state !== 'idle' || !has(used) };
  }
  enemyLook(def) {
    const info = def.look && this.assetInfo(def.look);
    if (info) return info;
    const color = PLACEHOLDER_COLORS[def.placeholderColor] ? def.placeholderColor : 'rust';
    return { key: `raider_${def.behavior === 'shooter' ? 'gun' : 'melee'}_${color}`, scale: (def.height ?? 220) / 240, ox: 66 / 150, oy: 1, flip: false };
  }
  weapon(slot) { const id = this.box ? this.box.save.inv?.slots?.[slot] : this.data_.leyla?.loadout?.[slot]; return this.data_.weapons?.[id] || null; }

  // ---------- world ----------
  create() {
    this.camp = null; this.vanPrompt = null;   // the scene object is reused on restart (camp ↔ run)
    this.sound.stopAll(); this.sound.removeAll();   // camp sounds belong to one visit
    try { this.sound.mute = localStorage.getItem('nomadgirl-mute') === '1'; } catch { /* private mode */ }
    makeTextures(this);
    this.pad ??= new Pad(this.data_.game?.gamepad);   // kept over restarts (camp ↔ run)
    this.hud.pad = this.pad;
    const PI = this.data_.assets?.[this.data_.game?.gamepad?.icons];
    this.hud.padIcons = PI?.kind === 'icons' && PI.file ? { url: new URL(PI.file, this.base).href, grid: PI.grid, cell: Array.isArray(PI.cell) ? PI.cell : [PI.cell, PI.cell], names: PI.names || [] } : null;
    this.fx = new Fx(this);
    this.combat = new Combat(this);
    let def = this.data_.rooms?.[this.roomId];
    if (this.mode === 'camp') {
      this.campGeo = campLayout(this.data_, this.box.save, this.T);
      const day = daytimeAt(this.data_.camp, this.box.save.hour);
      def = { name: this.data_.locations?.[this.box.save.location]?.name || 'Camp', layout: this.campGeo.layout, backdrop: { weather: day.weather || Object.keys(this.data_.weather || {})[0], shade: 0 } };
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
    if (this.mode === 'run') for (const b of this.box.save.buffs) { const d = this.data_.buffs?.[b]; if (d?.stat) this.mods[d.stat] = (this.mods[d.stat] || 0) + (d.value || 0); }
    const feet = [(start[0] + 0.5) * T, (start[1] + 1) * T];
    if (this.args.startX) feet[0] = this.args.startX;
    this.leyla = new Leyla(this, this.data_, feet);
    if (this.box) this.leyla.health = Math.max(1, Math.min(this.leyla.maxHealth, this.box.save.health + (this.mode === 'run' ? this.mods.health || 0 : 0)));
    this.drone = new Drone(this, this.data_);
    this.van?.reset();
    if (this.mode === 'camp') { const G = this.box.save.ground ??= {}; this.loot = new Loot(this, G[this.box.save.location] ??= []); }
    else this.loot = this.mode === 'run' ? new Loot(this) : null;
    this.setupInventory();
    if (this.mode === 'camp') this.camp = new Camp(this, this.box, this.campGeo);
    this.drone.roamArea = this.mode === 'camp' ? { x0: 6 * this.T, x1: (this.campGeo.W - 2) * this.T, ground: this.campGeo.floor * this.T } : null;
    this.drone.roamTo = null;
    this.backdrop?.front();
    this.physics.add.collider(this.leyla.box, this.solids);
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
    if (this.args.banner) { this.hud.banner(...this.args.banner); this.time.delayedCall(2800, () => this.hud.banner(null)); }
    else this.hud.banner(null);
    this.leaving = false; this.roomName = null;
  }

  // worn gear and implants (inv.wear) on top of the buffs: swap the old sums for the new ones, Mama-Bot shows her parts
  applyGear() {
    const g = this.box ? gearStats(this.data_, this.box.save.inv?.wear) : {};
    for (const k of ['defense', 'health', 'damage', 'speed']) { const v = (this.mods[k] || 0) - (this.gearMods?.[k] || 0) + (g[k] || 0); if (v) this.mods[k] = v; else delete this.mods[k]; }
    this.gearMods = g;
    if (this.leyla) this.leyla.health = Math.min(this.leyla.health, this.leyla.maxHealth);
    this.drone?.refreshParts();
  }

  // ---------- inventory (game/play/inventory_ui.js, game/inventory.js) ----------
  setupInventory() {
    this.hud.scene = this;
    if (!this.box) return;
    const hud = this.hud;
    hud.inv ??= new InventoryUI(hud.root, {
      get D() { return hud.scene.data_; },
      save: () => hud.scene.box.save,
      changed: key => hud.scene.invChanged(key),
      equipChanged: slot => { const sc = hud.scene; if (slot === 'ranged') sc.leyla.loadWeapon(); },
      throwDown: e => hud.scene.loot ? hud.scene.loot.throwDown(e) : null,
      use: id => hud.scene.useThing(id),
      inCamp: () => hud.scene.mode === 'camp',
      gearChanged: () => hud.scene.applyGear(),
      react: mood => hud.scene.drone?.react(mood),
      rigChanged: () => hud.scene.camp?.drawRig(),
      notify: text => hud.scene.fx.text(hud.scene.leyla.x, hud.scene.leyla.feet - hud.scene.leyla.height - 30, text, { color: '#ffd27a', size: 34, rise: 40, life: 1100 }),
    });
    hud.inv.close();
    // cooking and crafting at the workshops in the camp (game/play/craft_ui.js)
    hud.craft ??= new CraftUI(hud.root, {
      get D() { return hud.scene.data_; },
      save: () => hud.scene.box.save,
      changed: () => { clearTimeout(hud.scene.saveTimer); hud.scene.saveTimer = setTimeout(() => hud.scene.box?.persist(), 600); },
      leftover: (id, n) => hud.scene.loot?.throwDown({ a: 'items', id, n, r: 0 }),
      closed: () => hud.scene.craftClosed(),
    });
    hud.craft.el.hidden = true;
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
  // building finished: save; the clock may have moved into another time of day (light, sky) → camp fresh at the same spot
  buildClosed() {
    const C = this.data_.camp || {}, save = this.box.save;
    this.box.persist();
    if (this.camp && daytimeAt(C, save.hour)?.name !== this.camp.day?.name) this.time.delayedCall(this.script ? 0 : 700, () => this.goCamp({ banner: [daytimeAt(C, save.hour)?.name || 'Die Zeit vergeht', clockText(save)], fade: 500, keepPlace: true }));
    // the rig got taller than the camp (container stacked on a container on its chassis): camp fresh at the same spot, now high enough
    else if (this.camp && this.campGeo && campLayout(this.data_, save, this.T).H !== this.campGeo.H) this.time.delayedCall(this.script ? 0 : 300, () => this.goCamp({ fade: 300, keepPlace: true }));
  }
  // the cooking/crafting panel closed: the clock may have moved into another time of day (light, sky) → camp fresh at the same spot
  craftClosed() {
    const C = this.data_.camp || {}, save = this.box.save;
    this.box.persist();
    if (this.camp && daytimeAt(C, save.hour)?.name !== this.camp.day?.name) this.goCamp({ banner: [daytimeAt(C, save.hour)?.name || 'Die Zeit vergeht', clockText(save)], fade: 500, keepPlace: true });
  }
  // eating or using a thing from the inventory (Gegenstände › Buff beim Essen/Benutzen): heals now or waits as a buff for the next run
  useThing(id) {
    const D = this.data_, save = this.box.save, l = this.leyla, r = useThing(D, save, id, { health: l.health, maxHealth: l.maxHealth });
    if (!r.ok) return r;
    if (r.heal) { l.health = Math.min(l.maxHealth, l.health + r.heal); save.health = Math.round(l.health); }
    const b = D.buffs?.[r.buff] || {};
    if (this.mode === 'run' && !r.heal && b.stat) { this.mods[b.stat] = (this.mods[b.stat] || 0) + (b.value || 0); if (b.stat === 'health') l.health = Math.min(l.maxHealth, l.health + (b.value || 0)); }
    this.fx.text(l.x, l.feet - l.height - 30, r.heal ? `+${Math.round(r.heal)} Leben` : `${b.name || r.buff}${this.mode === 'camp' ? ' · nächster Run' : ''}`, { color: '#7aff9a', size: 34, rise: 50, life: 1300 });
    return r;
  }
  // something moved in an inventory: ground bundles appear or vanish, the savegame is written soon after
  invChanged(key) {
    const o = this.hud.inv?.other;
    if (this.loot && o?.kind === 'floor') this.loot.sync(o.pile);
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.box?.persist(), 1200);
    if (key) this.hud.inv?.draw();
  }
  openFloor() {
    const pile = this.loot.floor();
    this.hud.inv.open({ key: 'floor', title: this.loot.piles.includes(pile) ? 'Boden · Beute' : 'Boden', grid: pile.grid, kind: 'floor', pile });
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
      const near = this.loot.nearest();
      if (near && near !== o.pile && !(o.pile.grid.items.length && this.loot.piles.includes(o.pile) && this.loot.nearest() === o.pile)) this.openFloor();
      else if (!near && this.loot.piles.includes(o.pile)) this.openFloor();
    }
    // walked away from a chest or a shelf
    if (o?.kind === 'container' && Math.abs(this.leyla.x - o.x) > (this.data_.camp?.interactRange ?? 130) * 2) inv.open(null);
  }

  // ---------- camp ↔ run (savegame) ----------
  restartAs(args, fade = 500) {
    if (this.leaving) return;
    this.leaving = true;
    this.hud.prompt(null);
    const go = () => this.scene.restart({ ...this.args, startX: null, banner: null, ...args });
    if (this.script) return go();   // remote control: no waiting for the fade
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
      this.box.save.run = { poi, room: null, seed: P.seed || 1 + Math.floor(Math.random() * 2 ** 31), location: this.box.save.location };
      this.box.persist();
      return this.restartAs({ mode: 'run', roomId: null, banner: [P.name || poi, 'Finde den Tresor · E am Van: zurück ins Camp'] }, 700);
    }
    const ready = (P.rooms || []).filter(has);
    const room = ready.find(id => R[id].tags?.includes('start')) || ready[0] || [D.camp?.fallbackRoom, D.game?.testRoom].find(has);
    if (!room) return this.hud.menu({ title: 'Noch kein Raum', sub: 'Dieser POI hat noch keinen Raum mit Layout (Werkstatt › Raum-Bausteine).', items: [{ label: 'Zurück', act: () => {} }] });
    this.box.save.health = this.leyla.health;
    this.box.save.run = { poi, room, location: this.box.save.location };
    this.box.persist();
    this.restartAs({ mode: 'run', roomId: room, banner: [P.name || poi, `${D.rooms?.[room]?.name || room}${ready.length ? '' : ' (Ersatzraum)'} · E am Van: zurück ins Camp`] }, 700);
  }
  // back from a run: by van (loot counts) or knocked out (Mama-Bot, run loot is lost); buffs are used up
  endRun(ko) {
    const save = this.box.save, C = this.data_.camp || {}, base = this.data_.leyla?.health ?? 100;
    advance(save, C.clock?.runHours ?? 3);
    if (ko) { save.health = Math.round(base * (C.heal?.afterKo ?? 30) / 100); save.inv.grids.backpack.items = []; }   // Mama-Bot only brings Leyla: the backpack stays behind
    const paid = this.level?.payout(this.deltas) ?? this.deltas, rank = !ko && this.level?.done;
    if (!ko) { save.health = Math.round(this.leyla.health); save.deltas += paid; }
    save.buffs = [];
    save.run = null;
    this.hud.inv?.close();
    const banner = ko ? ['Mama-Bot hat dich heimgebracht', `${clockText(save)} · Der Rucksack ist weg.`]
      : rank ? [`Zurück im Camp · Rang ${rank.grade}`, `${clockText(save)} · +${paid} Δ (${this.deltas} + ${rank.bonus} %) · ${this.kills} Kills`]
      : ['Zurück im Camp', `${clockText(save)} · +${paid} Δ · ${this.kills} Kills`];
    this.goCamp({ banner, fade: ko ? 900 : 600, arriving: true });
  }

  spawnEnemies() {
    const T = this.T;
    for (const e of this.enemies) e.destroy();
    this.enemies = [];
    for (const s of this.room.spawns) {
      const def = this.data_.enemies?.[s.enemy];
      if (!def) continue;
      const e = new Enemy(this, s.enemy, def, [(s.x + 0.5) * T, (s.y + 1) * T]);
      this.physics.add.collider(e.box, this.solids);
      this.physics.add.collider(e.box, this.platforms, null, (box, plat) => e.body.velocity.y >= 0 && e.body.prev.y + e.body.height <= plat.body.top + 2);
      this.enemies.push(e);
    }
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
  ledgeAt(x, handY, dir, reach, halfW) {
    const T = this.T, cx = Math.floor((x + dir * (halfW + 6)) / T), ground = (c, r) => this.room.solid(c, r) || this.platformTiles.has(c + ',' + r);
    for (let r = Math.floor((handY - 8) / T); r * T <= handY + reach; r++) {
      if (r * T < handY - 8) continue;
      if (ground(cx, r) && !ground(cx, r - 1) && !ground(cx - dir, r) && !this.room.solid(cx - dir, r - 1))
        return { x: dir > 0 ? cx * T : (cx + 1) * T, y: r * T, dir };
    }
    return null;
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
  onLeylaHit(dmg) { this.drone.react('hit'); this.cam.shake(120, 0.006); this.fx.blood(this.leyla.x, this.leyla.chest, 10); this.hud.hurt(); }
  onLeylaDown() {
    this.hud.banner('Mama-Bot schleppt dich raus …', 'Die Run-Beute bleibt liegen.');
    this.cam.shake(300, 0.01);
    this.time.delayedCall(1900, () => this.mode === 'run' ? this.endRun(true) : this.mode === 'camp' ? this.goCamp() : this.level ? this.restartAs({}) : this.restartRoom());
  }
  onKill(e) {
    this.kills++;
    this.loot?.fromEnemy(e);
    this.drone.react('kill');
    const [a, b] = e.d.deltas || [0, 0], d = a + Math.floor(Math.random() * (b - a + 1));
    this.deltas += d;
    if (d) this.fx.text(e.x, e.feet - e.h - 20, `+${d} Δ`, { color: '#ffd27a', size: 48, rise: 90, life: 1100 });
    if (!this.level && this.enemies.every(x => !x.alive) && !this.cleared) {
      this.cleared = true;
      this.drone.react('cleared');
      this.time.delayedCall(700, () => this.hud.banner('Raum geräumt', `${this.clock()} · ${this.kills} Kills · ${this.deltas} Δ · R für nochmal`));
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
    const text = near ? (this.level?.done ? `Zurück ins Camp · Rang ${this.level.done.grade}` : 'Zurück ins Camp · Van') : thing ? thing.text : pile && !this.hud.inv?.isOpen ? `Beute am Boden · I öffnet (${pile.grid.items.length})` : null;
    if (text !== this.vanPrompt) { this.vanPrompt = text; this.hud.prompt(text, pile && !near && !thing ? 'I' : 'E'); }
    if (input.grab.pressed && near && this.mode === 'run') this.endRun(false);
    else if (input.grab.pressed && thing?.act) thing.act();
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
    // inventory open: the controller drives its cursor (padMenus), Leyla only hears the keyboard; Select / Start still close
    const invPad = this.hud.inv?.isOpen && !this.hud.paused && !this.hud.modal;
    if (pad?.kind) for (const name of Object.keys(i)) { if (invPad && name !== 'inventory' && name !== 'help') continue; i[name].down ||= pad.down(name); i[name].pressed ||= pad.pressed(name); }
    this.hud.padHelp(pad, PAD_ACTIONS);
    return i;
  }
  // controller in menus and windows: d-pad/stick choose, bottom button takes, right button goes back
  padMenus(input) {
    const p = this.pad, hud = this.hud;
    if (!p?.kind) return;
    if (hud.paused && !hud.modal) { if (p.pressed('jump') || p.pressed('grab')) { hud.toggleHelp(false); input.jump.pressed = input.grab.pressed = false; } return; }
    if (hud.modal) {
      if (p.pressed('down')) hud.menuMove(1);
      else if (p.pressed('up')) hud.menuMove(-1);
      else if (p.pressed('jump')) hud.choose(hud.menuIndex);
      else if (p.pressed('dash') || p.pressed('help')) hud.closeMenu();
      for (const k of ['jump', 'grab', 'dash', 'up', 'down', 'help']) input[k].pressed = false;
      return;
    }
    if (p.pressed('dash') && hud.craft?.isOpen) { hud.craft.close(); input.dash.pressed = false; }
    else if (hud.inv?.isOpen && !hud.paused) hud.inv.padNav(p);
  }

  toggleMute() {
    this.sound.mute = !this.sound.mute;
    try { localStorage.setItem('nomadgirl-mute', this.sound.mute ? '1' : '0'); } catch { /* private mode */ }
    this.hud.banner(this.sound.mute ? 'Ton aus' : 'Ton an', 'M schaltet um'); this.time.delayedCall(1200, () => this.hud.banner(null));
  }

  update(time, delta) {
    this.now = time;   // the loop's clock (hits, shots and Leyla run on it; scene.time.now is another clock)
    let input = this.readInput();
    this.padMenus(input);
    // Esc / Start: closes what is open (inventory, controls), otherwise the pause menu (Daniel, 11.11.2026: controls hidden in a menu)
    if (input.help.pressed) {
      if (this.hud.inv?.isOpen && !this.hud.paused) this.hud.inv.close();
      else if (this.hud.paused) this.hud.toggleHelp(false);
      else if (!this.hud.modal && !this.hud.craft?.isOpen && !this.hud.build?.active && !this.leaving) this.hud.pauseMenu();
    }
    if (input.controls?.pressed && !this.hud.modal) this.hud.toggleHelp();
    if (input.mute.pressed) this.toggleMute();
    if (input.debug.pressed) { const w = this.physics.world; w.drawDebug = !w.drawDebug; if (!w.debugGraphic) w.createDebugGraphic(); w.debugGraphic.clear().setVisible(w.drawDebug); }
    if (input.restart.pressed && this.mode === 'test' && this.level) this.restartAs({});   // doors, chests, walls: fresh room
    else if (input.restart.pressed && this.mode !== 'camp' && !this.level) this.restartRoom();
    const building = this.hud.build?.active;
    if (input.build?.pressed && building) this.hud.build.close();
    else if (input.build?.pressed && this.mode === 'camp' && !this.hud.modal && !this.hud.paused && !this.leaving && !this.hud.craft?.isOpen) this.openBuild();
    if (this.hud.paused || this.hud.modal || this.hud.craft?.isOpen || this.leaving) {
      // cooking, crafting, a menu: the workshops keep glowing, steaming and sparking behind the window
      if (this.camp && !this.hud.paused && !this.leaving) this.camp.benches?.update(time, Math.min(delta, 50));
      this.physics.world.pause(); this.hud.update(this, time); return;
    }
    if (time < this.hitstopUntil) return;
    if (this.physics.world.isPaused) this.physics.world.resume();
    const dt = Math.min(delta, 50);
    if (!this.startTime) this.startTime = time;
    if (!this.cleared) this.elapsed = time - this.startTime;

    if (this.hud.build?.active) input = this.hud.build.drive(input, dt);   // building: Leyla walks to her jobs by herself
    this.leyla.update(time, dt, input);
    this.level?.update?.(dt);
    this.fog?.update(dt);
    this.drone.update(time, dt);
    this.van?.update(dt);
    if (this.camp) this.camp.update(time, dt, input);
    else if (this.mode === 'run' || this.level) this.runUpdate(input);
    this.loot?.update(time);
    this.inventoryUpdate(input);
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
