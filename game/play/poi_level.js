// Things in a POI level (engine/poi.js welds the rooms, engine/room.js reads the marks):
//   C chests (E: lid opens, the POI's loot lies in front as a bundle)   S switches (E: the nearest door D opens, for good)
//   B brittle walls (a melee hit breaks the whole wall, counts as a secret)   Z goal (E: POI done, time stops, ranking)
//   $ camouflaged brittle walls (look like the wall, break the same)   % fake walls (look like the wall, Leyla walks through, they fade; secrets too)
// After the goal the run is finished; E at the van pays the base money plus the rank bonus (k.o. on the way back = everything gone).
import { rollLoot } from '../inventory.js';
import { bonuses as trophyBonuses } from '../achievements.js';
import { rankRun } from '../../engine/poi.js';

const NEAREST = () => Phaser.Textures.FilterMode.NEAREST;

// connected groups of one tile kind (4-neighbours) → [[[x, y], …], …]
function groups(room, kind) {
  const seen = new Set(), out = [];
  for (const [x0, y0] of room.marks[kind] || []) {
    if (seen.has(x0 + ',' + y0)) continue;
    const g = [], todo = [[x0, y0]];
    seen.add(x0 + ',' + y0);
    while (todo.length) {
      const [x, y] = todo.pop(); g.push([x, y]);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]])
        if (room.tiles[ny]?.[nx] === kind && !seen.has(nx + ',' + ny)) { seen.add(nx + ',' + ny); todo.push([nx, ny]); }
    }
    out.push(g);
  }
  return out;
}
const box = g => { const xs = g.map(p => p[0]), ys = g.map(p => p[1]); return { x0: Math.min(...xs), x1: Math.max(...xs) + 1, y0: Math.min(...ys), y1: Math.max(...ys) + 1 }; };

export class PoiLevel {
  // poi: id of the POI (run) or null (a single room in the test mode: chests take the first loot table)
  constructor(scene, poi) {
    const s = scene, R = s.room, T = s.T;
    this.scene = s; this.poi = poi; this.P = s.data_.pois?.[poi] || {};
    this.lootTable = this.P.loot || Object.keys(s.data_.lootTables || {})[0];
    this.secrets = 0; this.done = null; this.chestsOpened = 0;
    this.killsMax = s.enemies.filter(e => e.d.countsForRanking !== false).length;
    this.drawBackWall();
    // doors and brittle walls: solid zones in the scene's solids until opened
    const solidGroup = (g, kind) => {
      const b = box(g), zone = s.add.zone((b.x0 + b.x1) / 2 * T, (b.y0 + b.y1) / 2 * T, (b.x1 - b.x0) * T, (b.y1 - b.y0) * T);
      s.solids.add(zone);
      return { kind, tiles: g, ...b, zone, open: false, art: s.add.graphics().setDepth(-9) };
    };
    this.doors = groups(R, 'D').map(g => solidGroup(g, 'D'));
    this.walls = groups(R, 'B').map(g => solidGroup(g, 'B'));
    for (const d of this.doors) this.drawDoor(d);
    for (const w of this.walls) this.drawWall(w);
    // camouflaged tiles (art.js drawRoom bakes them like the wall around, on a layer above Leyla)
    for (const c of s.camo || []) {
      if (c.kind === '$') this.walls.push({ ...solidGroup(c.tiles, '$'), rts: c.rts });
      else (this.fakes ??= []).push({ tiles: c.tiles, ...box(c.tiles), rts: c.rts, found: false, set: new Set(c.tiles.map(([x, y]) => x + ',' + y)) });
    }
    this.fakes ??= [];
    this.switches = (R.marks.S || []).map(([x, y]) => {
      const cx = (x + 0.5) * T, cy = (y + 1) * T;
      const door = this.doors.slice().sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 * T - cx, (a.y0 + a.y1) / 2 * T - cy) - Math.hypot((b.x0 + b.x1) / 2 * T - cx, (b.y0 + b.y1) / 2 * T - cy))[0] || null;
      const sw = { x: cx, feet: cy, door, on: false, art: s.add.graphics().setDepth(-8) };
      this.drawSwitch(sw);
      return sw;
    });
    // chests: the camp chest's picture (Camp › Kiste), otherwise a box from code
    const K = s.data_.camp?.chest || {}, info = K.look && s.assetInfo(K.look), frames = s.data_.assets?.[K.look]?.frames || 1;
    if (info) s.textures.get(info.key).setFilter(NEAREST());
    this.chests = (R.marks.C || []).map(([x, y]) => {
      const cx = (x + 0.5) * T, feet = (y + 1) * T;
      const sprite = info ? s.add.sprite(cx, feet, info.key, 0).setOrigin(info.ox, info.oy).setScale(info.scale).setDepth(-3) : null;
      const c = { x: cx, feet, sprite, frames, open: false, art: sprite ? null : s.add.graphics().setDepth(-3) };
      if (!sprite) this.drawChest(c);
      return c;
    });
    this.goals = (R.marks.Z || []).map(([x, y]) => ({ x: (x + 0.5) * T, feet: (y + 1) * T, art: s.add.graphics().setDepth(-4), glow: null }));
    for (const z of this.goals) this.drawGoal(z);
    this.secretsMax = this.walls.length + this.fakes.length;
    // Bunker-Schlüsselbund (#012, Bonus „Secrets schimmern“): hidden walls glimmer pink now and then until they are found
    this.shimmer = [];
    if (s.box && trophyBonuses(s.data_, s.box.save).secrets > 0) for (const x of [...this.walls, ...this.fakes]) {
      const [tx, ty] = x.tiles[Math.floor(x.tiles.length / 2)] || [];
      if (tx == null) continue;
      const g = s.add.circle((tx + 0.5) * T, (ty + 0.5) * T, T * 0.45, 0xe45aa8, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(6);
      s.tweens.add({ targets: g, fillAlpha: 0.35, duration: 900, yoyo: true, repeat: -1, repeatDelay: 1400, delay: Math.random() * 1500, onUpdate: () => { if (x.open || x.found) g.setVisible(false); } });
      this.shimmer.push(g);
    }
  }

  // ---------- pictures from code (until there is pixel art) ----------
  // indoor rooms (Raum-Bausteine › Innenraum) and the tunnel get a back wall instead of sky
  drawBackWall() {
    const s = this.scene, LI = s.levelInfo, R = s.room, T = s.T;
    if (!LI?.def) return;
    const outdoor = LI.rooms.filter(r => !this.indoor(r.id));
    const g = s.add.graphics().setDepth(-11);
    let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) {
      if (R.tiles[y][x] === '#' || outdoor.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) continue;
      if (s.terrain?.back(x, y)) continue;   // the Kachel-Set brings its own back wall (art.js drawRoom)
      const px = x * T, py = y * T;
      g.fillStyle(0x14121a + (rnd() < 0.2 ? 0x020202 : 0)).fillRect(px, py, T, T);
      if (y % 3 === 0) g.fillStyle(0x0d0c11).fillRect(px, py, T, 3);
      if (x % 4 === 0) g.fillStyle(0x1a1821).fillRect(px, py, 3, T);
      if (rnd() < 0.04) g.fillStyle(0x221f2a).fillRect(px + 10, py + 20, 30, 18);   // a poster, a vent
    }
  }
  indoor(id) { const r = this.scene.data_.rooms?.[id] || {}; return r.indoor ?? !(r.backdrop?.image || r.backdrop?.weather); }
  drawDoor(d) {
    const T = this.scene.T, g = d.art.clear(), x = d.x0 * T, y = d.y0 * T, w = (d.x1 - d.x0) * T, h = (d.y1 - d.y0) * T;
    g.fillStyle(0x3a3f48).fillRect(x, y, w, h);
    g.fillStyle(0x2a2e35); for (let yy = y + 10; yy < y + h; yy += 22) g.fillRect(x + 4, yy, w - 8, 8);   // shutter slats
    g.fillStyle(0xd4a72c); for (let yy = y + 6; yy < y + h; yy += 44) g.fillRect(x + 2, yy, w - 4, 4);   // warning stripes
    g.fillStyle(0xff4060).fillRect(x + w / 2 - 5, y + h - 30, 10, 10);   // lamp: red = shut
  }
  drawWall(wl) {
    const T = this.scene.T, g = wl.art.clear();
    for (const [tx, ty] of wl.tiles) {
      const px = tx * T, py = ty * T;
      g.fillStyle(0x2b2a2e).fillRect(px, py, T, T);
      g.lineStyle(3, 0x15141a); g.beginPath(); g.moveTo(px + 10, py + 6); g.lineTo(px + 30, py + 26); g.lineTo(px + 22, py + 44); g.lineTo(px + 44, py + 60); g.strokePath();
      g.beginPath(); g.moveTo(px + 30, py + 26); g.lineTo(px + 54, py + 20); g.strokePath();
      g.fillStyle(0x4a4650).fillRect(px + 6, py + 50, 12, 6).fillRect(px + 40, py + 8, 14, 5);
    }
  }
  drawSwitch(sw) {
    const g = sw.art.clear(), x = sw.x, f = sw.feet;
    g.fillStyle(0x3a3f48).fillRect(x - 22, f - 120, 44, 70);
    g.fillStyle(0x15141a).fillRect(x - 6, f - 110, 12, 50);
    g.lineStyle(8, 0xb9c0c9); g.beginPath(); g.moveTo(x, f - 85); g.lineTo(x + (sw.on ? 26 : -26), f - (sw.on ? 128 : 128)); g.strokePath();
    g.fillStyle(sw.on ? 0x3fe0d0 : 0xff4060).fillCircle(x + (sw.on ? 26 : -26), f - 130, 9);
  }
  drawChest(c) {
    const g = c.art.clear(), x = c.x, f = c.feet;
    g.fillStyle(0x6b5030).fillRect(x - 40, f - 54, 80, 54);
    g.fillStyle(0x8a6a44).fillRect(x - 40, f - (c.open ? 80 : 64), 80, c.open ? 14 : 14);
    g.fillStyle(0xd4a72c).fillRect(x - 6, f - 50, 12, 14);
  }
  drawGoal(z) {
    const s = this.scene, g = z.art.clear(), x = z.x, f = z.feet, done = !!this.done;
    // the station's safe: a heavy box with a dial, glowing until it is cracked
    g.fillStyle(0x2f333b).fillRect(x - 60, f - 150, 120, 150);
    g.fillStyle(0x4a505a).fillRect(x - 52, f - 142, 104, 134);
    g.lineStyle(6, done ? 0x3fe0d0 : 0xffd27a).strokeCircle(x, f - 80, 26);
    g.fillStyle(done ? 0x3fe0d0 : 0xffd27a).fillRect(x - 3, f - 104, 6, 20);
    if (!z.glow) {
      z.glow = s.add.image(x, f - 80, s.textures.exists('fx_glow') ? 'fx_glow' : '__WHITE').setBlendMode(Phaser.BlendModes.ADD).setDepth(-5).setScale(3).setAlpha(0.5).setTint(0xffd27a);
      s.tweens.add({ targets: z.glow, alpha: 0.2, duration: 900, yoyo: true, repeat: -1 });
    }
    z.glow.setTint(done ? 0x3fe0d0 : 0xffd27a);
  }

  // ---------- E: the nearest thing within reach → { text, act } ----------
  nearest() {
    const l = this.scene.leyla, range = this.scene.data_.camp?.interactRange ?? 130;
    const close = o => Math.abs(o.x - l.x) < range && Math.abs(o.feet - l.feet) < 60;
    for (const z of this.goals) if (close(z)) return this.done ? { text: 'Geknackt · Abkürzung zum Van: unten durch den Tunnel' } : { text: 'Tresor knacken · POI abschließen', act: () => this.finish() };
    for (const c of this.chests) if (!c.open && close(c)) return { text: 'Kiste öffnen', act: () => this.openChest(c) };
    for (const sw of this.switches) if (close(sw)) return sw.on ? { text: 'Schalter ist umgelegt' } : { text: 'Schalter umlegen', act: () => this.pull(sw) };
    for (const d of this.doors) if (!d.open && Math.abs((d.x0 + d.x1) / 2 * this.scene.T - l.x) < range * 0.8 && l.feet > d.y0 * this.scene.T && l.feet <= d.y1 * this.scene.T + 4)
      return { text: 'Die Tür geht von dieser Seite nicht auf' };
    return null;
  }

  openChest(c) {
    const s = this.scene;
    c.open = true; this.chestsOpened++;
    if (c.sprite) { let f = 0; s.time.addEvent({ delay: 70, repeat: c.frames - 1, callback: () => c.sprite.setFrame(Math.min(c.frames - 1, ++f)) }); }
    else this.drawChest(c);
    const things = s.lootRoll ? s.lootRoll(this.lootTable) : rollLoot(s.data_, this.lootTable);
    s.fx.sparks(c.x, c.feet - 50, 0xffd27a, 14);
    if (things.length) s.loot?.drop(c.x, c.feet, things, 140);
    else s.hud.toast('Leer …', 'Hier hat schon jemand geplündert', 'info', 2400);
  }
  pull(sw) {
    const s = this.scene;
    sw.on = true; this.drawSwitch(sw);
    s.fx.sparks(sw.x, sw.feet - 120, 0x3fe0d0, 8);
    const d = sw.door;
    if (!d || d.open) return;
    this.openSolid(d);
    s.cam.shake(260, 0.004);
    s.tweens.add({ targets: d.art, y: -(d.y1 - d.y0) * s.T + 12, duration: 900, ease: 'Sine.easeInOut' });
    s.hud.toast('Abkürzung offen!', 'Ein Schalter hat eine Tür geöffnet', 'good', 3000);
  }
  openSolid(o) {
    o.open = true;
    for (const [x, y] of o.tiles) this.scene.room.tiles[y][x] = '.';
    this.scene.solids.remove(o.zone, true, true);
  }
  // Leyla's melee box (world px) → breaks brittle walls it touches
  meleeHit(x0, x1, y0, y1) {
    const s = this.scene, T = s.T;
    for (const w of this.walls) {
      if (w.open || x1 < w.x0 * T || x0 > w.x1 * T || y1 < w.y0 * T || y0 > w.y1 * T) continue;
      this.openSolid(w);
      w.art.destroy(); for (const rt of w.rts || []) rt.destroy();
      for (const [tx, ty] of w.tiles) { s.fx.sparks((tx + 0.5) * T, (ty + 0.5) * T, 0x8a8490, 10); s.fx.puff((tx + 0.5) * T, (ty + 1) * T, 0x6b6670); }
      s.cam.shake(200, 0.006);
      this.secrets++;
      s.achieve?.('secrets', 1, [this.poi]);
      s.drone.react('curious');
      s.hud.toast('Geheimnis gefunden!', `${this.secrets} von ${this.secretsMax}`, 'secret', 3200);
    }
  }

  // goal reached: time stops, ranking; the bonus is paid at the van
  finish() {
    const s = this.scene, D = s.data_;
    const kills = s.kills, seconds = Math.round(s.elapsed / 1000);
    const r = rankRun(D.ranking, { seconds, par: this.P.parTime, kills, killsMax: this.killsMax, secrets: this.secrets, secretsMax: this.secretsMax });
    this.done = { ...r, seconds, kills, secrets: this.secrets };
    s.cleared = true;   // the clock stops
    // the vault is full (design.md › Ausbaustufe Progression): POIs › Tresor-Beute, plus one extra roll per 10 % rank bonus
    const table = this.P.vault || (D.lootTables?.tresor ? 'tresor' : this.lootTable), extra = Math.floor((r.bonus || 0) / 10), haul = [];
    const things = [...(s.lootRoll ? s.lootRoll(table) : rollLoot(D, table)), ...Array.from({ length: extra }, () => rollLoot(D, table)[0]).filter(Boolean)];
    for (const t of things) { const same = haul.find(h => h.id === t.id); if (same) same.n += t.n; else haul.push({ ...t }); }
    this.done.haul = haul.map(t => `${t.id}×${t.n}`);
    const z = this.goals[0];
    if (z && haul.length) { s.loot?.drop(z.x, z.feet, haul, 200); s.fx.sparks(z.x, z.feet - 60, 0xffd27a, 28); }
    for (const z of this.goals) this.drawGoal(z);
    s.drone.react('cleared');
    s.cam.flash(300, 255, 210, 122);
    const mm = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, par = this.P.parTime || 0;
    s.hud.menu({
      title: `Rang ${r.grade}`,
      sub: `${this.P.name || 'POI'} geschafft · ${r.points} Punkte · Bonus +${r.bonus} % aufs Run-Geld, ausgezahlt am Van.`,
      items: [
        { label: `Zeit ${mm}`, sub: `Bestzeit ${Math.floor(par / 60)}:${String(par % 60).padStart(2, '0')} · ${r.parts.time} Punkte` },
        { label: `Kills ${kills}/${this.killsMax}`, sub: `${r.parts.kills} Punkte` },
        { label: `Secrets ${this.secrets}/${this.secretsMax}`, sub: `${r.parts.secrets} Punkte` },
        { label: `Tresor: ${haul.reduce((n, t) => n + t.n, 0)} Dinge`, sub: haul.slice(0, 6).map(t => D.items?.[t.id]?.name || t.id).join(', ') + (haul.length > 6 ? ' …' : '') + (extra ? ` · +${extra} für den Rang` : '') },
        { label: 'Weiter', primary: true, sub: 'Zurück zum Van: die Abkürzung führt unten durch den Tunnel', act: () => {} },
      ].map(i => ({ ...i, act: i.act || (() => {}) })),
    });
  }
  // fake walls: as soon as Leyla stands in one, it fades out (Daniel, 11.11.2026: „Leyla läuft einfach hindurch, die Wand blendet weich aus“)
  update(dt = 16) {
    const s = this.scene, l = s.leyla, T = s.T, b = l.body, ms = s.data_.game?.fog?.fakeFade ?? 450;
    for (const f of this.fakes) if (f.found && f.fade < 1) { f.fade = Math.min(1, f.fade + dt / Math.max(1, ms)); for (const rt of f.rts) rt.setAlpha(1 - f.fade * f.fade * (3 - 2 * f.fade)); }
    for (const f of this.fakes) {
      if (f.found || b.right < f.x0 * T || b.left > f.x1 * T || b.bottom < f.y0 * T || b.top > f.y1 * T) continue;
      if (!f.tiles.some(([x, y]) => b.right > x * T && b.left < (x + 1) * T && b.bottom > y * T && b.top < (y + 1) * T)) continue;
      f.found = true; f.fade = 0; this.secrets++; s.achieve?.('secrets', 1, [this.poi]);
      s.drone.react('curious');
      s.hud.toast('Geheimnis gefunden!', `${this.secrets} von ${this.secretsMax}`, 'secret', 3200);
      s.fog?.reveal(true);
    }
  }
  // tiles that still hide what is behind them (fog sight lines): closed doors, brittle walls, fake walls not found yet
  hides(x, y) { return this.fakes.some(f => !f.found && f.set.has(x + ',' + y)); }
  // money for the van: run Δ plus rank bonus
  payout(deltas) { return this.done ? Math.round(deltas * (1 + this.done.bonus / 100)) : deltas; }

  state() {
    return {
      poi: this.poi, done: this.done, secrets: this.secrets, secretsMax: this.secretsMax, killsMax: this.killsMax,
      chests: this.chests.map(c => ({ x: Math.round(c.x), feet: c.feet, open: c.open })),
      switches: this.switches.map(sw => ({ x: Math.round(sw.x), feet: sw.feet, on: sw.on })),
      doors: this.doors.map(d => ({ x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1, open: d.open })),
      walls: this.walls.map(w => ({ x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1, open: w.open, kind: w.kind })),
      fakes: this.fakes.map(f => ({ x0: f.x0, x1: f.x1, y0: f.y0, y1: f.y1, found: f.found, alpha: +(f.rts[0]?.alpha ?? 1).toFixed(2) })),
      goals: this.goals.map(z => ({ x: Math.round(z.x), feet: z.feet })),
    };
  }
}
