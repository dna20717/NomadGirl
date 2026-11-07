// The play scene: builds a room from its layout, places Leyla and the enemies, runs input, physics, combat and HUD.
import { parseRoom, solidRects } from '../../engine/room.js';
import { makeTextures, drawBackground, drawRoom, PLACEHOLDER_COLORS } from './art.js';
import { Leyla } from './leyla.js';
import { Enemy } from './enemies.js';
import { Combat } from './combat.js';
import { Fx } from './fx.js';
import { Drone } from './drone.js';

const KEYS = {
  left: ['A', 'LEFT'], right: ['D', 'RIGHT'], up: ['W', 'UP'], down: ['S', 'DOWN'],
  jump: ['SPACE'], walk: ['SHIFT'], dash: ['L', 'C'], melee: ['J', 'Y'], ranged: ['K', 'X'], grab: ['E'],
  restart: ['R'], help: ['H', 'ESC'], debug: ['G'],
};

export class PlayScene extends Phaser.Scene {
  constructor() { super('play'); }

  init({ project, roomId, base, hud }) {
    this.p = project; this.data_ = project.data; this.roomId = roomId; this.base = base; this.hud = hud;
    this.T = this.data_.game?.tileSize || 64;
    this.gravity = this.data_.game?.gravity || 3600;
  }

  // ---------- assets ----------
  preload() {
    const A = this.data_.assets || {}, ids = new Set(Object.values(this.data_.leyla?.look || {}));
    for (const e of Object.values(this.data_.enemies || {})) if (e.look) ids.add(e.look);
    for (const id of Object.values(this.data_.game?.tiles || {})) ids.add(id);
    if (this.data_.drone?.look) ids.add(this.data_.drone.look);
    for (const id of [...ids]) if (A[id]?.mirror) ids.add(A[id].mirror);   // drawn opposite direction
    for (const id of ids) {
      const a = A[id];
      if (!a?.file) continue;
      const url = new URL(a.file, this.base).href;
      if ((a.kind === 'animation' || a.kind === 'tiles') && a.frameSize) this.load.spritesheet(id, url, { frameWidth: a.frameSize[0], frameHeight: a.frameSize[1] });
      else if (a.kind === 'image') this.load.image(id, url);
    }
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
  // walk without its own animation borrows run (Leyla slows its pace down); facing < 0 = left
  playLook(sprite, who, state, facing = 1) {
    const look = this.data_.leyla?.look || {}, A = this.data_.assets || {}, has = s => look[s] && this.textures.exists(look[s]);
    this.looks ??= {};
    const used = has(state) ? state : state === 'walk' && has('run') ? 'run' : 'idle';
    let id = look[used] || look.idle;
    const a = A[id], m = a?.mirror;
    if (m && this.textures.exists(m) && (facing < 0) !== !!a.flip) id = m;
    const info = this.looks[id] ??= this.assetInfo(id) || { key: 'px', scale: 60, ox: 0.5, oy: 1, flip: false };
    if (sprite.texture.key !== info.key || (info.anim && sprite.anims.currentAnim?.key !== info.anim)) {
      sprite.setOrigin(info.ox, info.oy);
      if (info.anim) sprite.play(info.anim, true); else sprite.setTexture(info.key);
    }
    return { ...info, used, fallback: used !== state && used !== 'run' || !has(used) };
  }
  enemyLook(def) {
    const info = def.look && this.assetInfo(def.look);
    if (info) return info;
    const color = PLACEHOLDER_COLORS[def.placeholderColor] ? def.placeholderColor : 'rust';
    return { key: `raider_${def.behavior === 'shooter' ? 'gun' : 'melee'}_${color}`, scale: (def.height ?? 220) / 240, ox: 66 / 150, oy: 1, flip: false };
  }
  weapon(slot) { return this.data_.weapons?.[this.data_.leyla?.loadout?.[slot]] || null; }

  // ---------- world ----------
  create() {
    makeTextures(this);
    this.fx = new Fx(this);
    this.combat = new Combat(this);
    const def = this.data_.rooms?.[this.roomId];
    this.room = parseRoom(def || {});
    const T = this.T, R = this.room, W = R.w * T, H = R.h * T;
    this.physics.world.setBounds(0, 0, W, H);
    // background (sky, skyline) on its own unzoomed camera, the world on a zoomable camera above it
    const before = new Set(this.children.list);
    drawBackground(this, W, H);
    const background = this.children.list.filter(o => !before.has(o));
    this.bgCam = this.cameras.main;
    this.cam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.cam.ignore(background);
    this.bgCam.ignore([...before]);
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, o => this.bgCam.ignore(o));
    const tiles = Object.fromEntries(Object.entries(this.data_.game?.tiles || {}).map(([k, id]) => [k, this.textures.exists(id) ? id : null]));
    drawRoom(this, R, T, tiles);

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
    this.leyla = new Leyla(this, this.data_, [(start[0] + 0.5) * T, (start[1] + 1) * T]);
    this.drone = new Drone(this, this.data_);
    this.physics.add.collider(this.leyla.box, this.solids);
    this.physics.add.collider(this.leyla.box, this.platforms, null, (box, plat) => {
      const l = this.leyla, b = l.body;
      return l.state !== 'climb' && l.state !== 'swing' && this.time.now >= l.dropUntil && b.velocity.y >= 0 && b.prev.y + b.height <= plat.body.top + 2;
    });
    this.enemies = [];
    this.spawnEnemies();

    const cam = this.cam, C = this.data_.game?.camera || {};
    cam.setZoom(C.zoom || 1);
    // room lower than the view (zoomed out): floor stays at the bottom edge, sky above
    const viewH = this.scale.height / (C.zoom || 1);
    cam.setBounds(0, Math.min(0, H - viewH), W, Math.max(H, viewH));
    cam.startFollow(this.leyla.box, false, C.follow ?? 0.12, C.follow ?? 0.12);
    cam.fadeIn(400, 13, 10, 18);

    this.keys = {};
    for (const [name, list] of Object.entries(KEYS)) this.keys[name] = list.map(k => this.input.keyboard.addKey(k));
    this.input.keyboard.on('keydown', () => this.hud.firstKey());
    this.physics.world.drawDebug = false;
    this.physics.world.debugGraphic?.setVisible(false);
    this.startTime = 0; this.kills = 0; this.deltas = 0; this.cleared = false; this.hitstopUntil = 0;
    this.hud.room(def?.name || this.roomId, this.enemies.length);
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
    this.kills = 0; this.deltas = 0; this.cleared = false; this.startTime = 0;
    this.hud.room(this.data_.rooms?.[this.roomId]?.name || this.roomId, this.enemies.length);
    this.hud.banner(null);
    this.cam.flash(250, 13, 10, 18);
  }

  // ---------- queries for Leyla, enemies and projectiles ----------
  tileAt(px, py) { return this.room.tiles[Math.floor(py / this.T)]?.[Math.floor(px / this.T)] ?? '#'; }
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
    this.time.delayedCall(1900, () => this.restartRoom());
  }
  onKill(e) {
    this.kills++;
    this.drone.react('kill');
    const [a, b] = e.d.deltas || [0, 0], d = a + Math.floor(Math.random() * (b - a + 1));
    this.deltas += d;
    if (d) this.fx.text(e.x, e.feet - e.h - 20, `+${d} Δ`, { color: '#ffd27a', size: 48, rise: 90, life: 1100 });
    if (this.enemies.every(x => !x.alive) && !this.cleared) {
      this.cleared = true;
      this.drone.react('cleared');
      this.time.delayedCall(700, () => this.hud.banner('Raum geräumt', `${this.clock()} · ${this.kills} Kills · ${this.deltas} Δ · R für nochmal`));
    }
  }
  clock() { const s = Math.floor(this.elapsed / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  // ---------- loop ----------
  readInput() {
    if (this.script) return this.script();   // remote control (game/play/control.js)
    const J = Phaser.Input.Keyboard.JustDown, i = {};
    for (const [name, keys] of Object.entries(this.keys)) {
      let pressed = false;
      for (const k of keys) if (J(k)) pressed = true;   // every key once per frame
      i[name] = { down: keys.some(k => k.isDown), pressed };
    }
    return i;
  }

  update(time, delta) {
    const input = this.readInput();
    if (input.help.pressed) this.hud.toggleHelp();
    if (input.debug.pressed) { const w = this.physics.world; w.drawDebug = !w.drawDebug; if (!w.debugGraphic) w.createDebugGraphic(); w.debugGraphic.clear().setVisible(w.drawDebug); }
    if (input.restart.pressed) this.restartRoom();
    if (this.hud.paused) { this.physics.world.pause(); return; }
    if (time < this.hitstopUntil) return;
    if (this.physics.world.isPaused) this.physics.world.resume();
    const dt = Math.min(delta, 50);
    if (!this.startTime) this.startTime = time;
    if (!this.cleared) this.elapsed = time - this.startTime;

    this.leyla.update(time, dt, input);
    this.drone.update(time, dt);
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
    this.hud.update(this, time);
  }
}
