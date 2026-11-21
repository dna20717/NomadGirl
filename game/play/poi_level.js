// Things in a POI level (engine/poi.js welds the rooms, engine/room.js reads the marks):
//   C chests (E: lid opens, the POI's loot lies in front as a bundle)   S switches (E: the nearest door D opens, for good)
//   B brittle walls (a melee hit breaks the whole wall, counts as a secret)   Z goal (E: POI done, time stops, ranking)
//   $ camouflaged brittle walls (look like the wall, break the same)   % fake walls (look like the wall, Leyla walks through, they fade; secrets too)
// After the goal the run is finished; E at the van pays the base money plus the rank bonus (k.o. on the way back = everything gone).
import { rollLoot } from '../inventory.js';
import { chestPart } from '../salvage.js';
import { bonuses as trophyBonuses } from '../achievements.js';
import { rankRun, rankBonus, rankCrate } from '../../engine/poi.js';
import { earn, earnText } from '../earn.js';
import { foeFor, glitchState } from '../glitch_world.js';
import { uniqueEntity } from '../glitchlings.js';
import { stock } from '../crafting.js';

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
    this.drawBrandSign();
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
    this.fuses = this.placeFuse();   // #082 Stromausfall per Schalter
    this.goals = (R.marks.Z || []).map(([x, y]) => ({ x: (x + 0.5) * T, feet: (y + 1) * T, art: s.add.graphics().setDepth(-4), glow: null }));
    for (const z of this.goals) this.drawGoal(z);
    // #057 the KI-Terminal (@): the POI's Terminal-KI, a unique Entity, optional and very hard; one try per run; caught = the terminal is quiet
    const caught = new Set(s.box ? glitchState(s.box.save).caught : []);
    this.terminals = (R.marks['@'] || []).map(([x, y]) => {
      const t = { x: (x + 0.5) * T, feet: (y + 1) * T, ai: this.P.terminalAi || null, art: s.add.graphics().setDepth(-8), done: false, tried: false };
      t.done = !t.ai || caught.has(t.ai);
      this.drawTerminal(t);
      return t;
    });
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
  // the brand of the place (Reisekarte: the logo next to the place, e.g. Delta Petrol at the gas station; Daniel 21.11.2026: „Die
  // Firmenlogos werden in den POI nicht angezeigt“): a pylon sign at the entrance like a real roadside station, logo + name + slogan
  brandOf() {
    const s = this.scene, D = s.data_, save = s.box?.save, at = save?.run?.location ?? save?.location;
    // Daniel 21.11.2026 (Karte Markenschild b: „Marken passend zum Ort“): a POI's own brand wins (Ministerium: the Bureau of Order),
    // POIs › Markenschild aus = no sign (bunker, silo, mine …); else the brand the map put next to the place
    const id = s.args?.brand || this.P.brand || save?.map?.nodes?.find(n => n.id === at)?.brand;
    return id && D.brands?.[id] ? { id, ...D.brands[id] } : null;
  }
  drawBrandSign() {
    const s = this.scene, D = s.data_, LI = s.levelInfo, R = s.room, T = s.T, b = this.brandOf();
    if (!b || !LI?.rooms?.length || this.P.brandSign === false) return;
    const free = (x, y) => R.tiles[y]?.[x] === '.' || R.tiles[y]?.[x] === ' ', solidAt = (x, y) => R.tiles[y]?.[x] === '#';
    // a floor in the first outdoor room (else the entrance room) with 5 tiles of air above, near its left side
    const room = LI.rooms.find(r => !this.indoor(r.id)) || LI.rooms[0];
    let spot = null;
    for (let x = room.x + 4; x < room.x + room.w - 4 && !spot; x++) for (let y = room.y + 5; y < room.y + room.h; y++) {
      if ([0, 1, 2].every(d => solidAt(x - 1 + d, y)) && [1, 2, 3, 4, 5, 6].every(k => [0, 1, 2].every(d => free(x - 1 + d, y - k)))) { spot = [x, y]; break; }
    }
    if (!spot) return;
    const H = this.P.brandSignHeight ?? 4.6, cx = (spot[0] + 1) * T, floor = spot[1] * T, pw = 4 * T, ph = 1.8 * T, top = floor - H * T;
    const col = Phaser.Display.Color.HexStringToColor(b.color || '#fa6a0a').color, g = s.add.graphics().setDepth(-9.5);
    // two steel posts, foot plates, a rusty frame with a neon edge in the brand's colour
    for (const dx of [-0.9, 0.9]) { g.fillStyle(0x23262e).fillRect(cx + dx * T - 7, top + ph, 14, floor - top - ph); g.fillStyle(0x3a3f48).fillRect(cx + dx * T - 7, top + ph, 4, floor - top - ph); g.fillStyle(0x15171c).fillRect(cx + dx * T - 14, floor - 8, 28, 8); }
    g.fillStyle(0x15171c).fillRect(cx - pw / 2 - 8, top - 8, pw + 16, ph + 16);
    g.fillStyle(0x0d0a12).fillRect(cx - pw / 2, top, pw, ph);
    g.lineStyle(4, col, 0.95).strokeRect(cx - pw / 2 + 3, top + 3, pw - 6, ph - 6);
    g.fillStyle(0x6b4a3a, 0.5).fillRect(cx - pw / 2 - 8, top + ph + 4, 18, 4).fillRect(cx + pw / 2 - 30, top - 8, 22, 3);   // rust
    const glow = s.add.ellipse(cx, top + ph / 2, pw * 1.25, ph * 1.9, col, 0.07).setDepth(-9.6).setBlendMode(Phaser.BlendModes.ADD);
    s.tweens.add({ targets: glow, alpha: 0.6, duration: 120, yoyo: true, repeat: -1, repeatDelay: 2600 + Math.random() * 3000 });   // the neon stutters now and then
    const logos = D.worldmap?.logos, L = D.assets?.[logos];
    let tx = cx - pw / 2 + 18;
    if (logos && s.textures.exists(logos) && b.icon != null) {
      const size = ph - 22, img = s.add.image(cx - pw / 2 + 12 + size / 2, top + ph / 2, logos, b.icon).setDepth(-9.4);
      img.setScale(size / (Array.isArray(L?.cell) ? L.cell[1] : L?.cell || 64));
      tx = cx - pw / 2 + 24 + size;
    }
    const maxW = cx + pw / 2 - 14 - tx;
    const name = s.add.text(tx, top + ph * 0.44, b.short || b.name, { fontFamily: 'VT323, monospace', fontSize: '44px', color: '#fef3c0', stroke: b.color || '#fa6a0a', strokeThickness: 5 }).setOrigin(0, 0.5).setDepth(-9.4);
    if (name.width > maxW) name.setScale(maxW / name.width);
    if (b.slogan) { const sl = s.add.text(tx, top + ph * 0.78, b.slogan, { fontFamily: 'VT323, monospace', fontSize: '28px', color: '#ffd541', stroke: '#0d0a12', strokeThickness: 3 }).setOrigin(0, 0.5).setDepth(-9.4); if (sl.width > maxW) sl.setScale(maxW / sl.width); }
    this.sign = { brand: b.id, x: cx, y: top, w: pw, h: ph };
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
  // a switch panel instead of a lever (#052, Daniel 17.11.2026: „alle Hebel, die Türen öffnen, durch Schalter ersetzen, die man erst bedienen
  // kann, wenn man ein Duell ausgetragen hat“): a box on a post with a little screen; a KI lives in it (magenta, glitching) until the duel,
  // then the screen is calm (cyan) and the rocker can be thrown
  // the KI-Terminal: a tall cabinet with a big screen; it sings (a slow wave) while the AI lives in it, it is dark when she is gone
  drawTerminal(t) {
    const g = t.art.clear(), x = t.x, f = t.feet, live = !t.done;
    g.fillStyle(0x060608).fillRect(x - 46, f - 210, 92, 210);
    g.fillStyle(0x333941).fillRect(x - 42, f - 206, 84, 206);
    g.fillStyle(0x4a5462).fillRect(x - 42, f - 206, 84, 5);
    g.fillStyle(0x9cdb43).fillRect(x - 42, f - 30, 84, 4); g.fillStyle(0x060608); for (let i = -40; i < 42; i += 12) g.fillRect(x + i, f - 30, 6, 4);   // the gang's green and black stripes
    g.fillStyle(0x060608).fillRect(x - 34, f - 190, 68, 70); g.fillStyle(live ? 0x1a0f2a : 0x122020).fillRect(x - 31, f - 187, 62, 64);
    if (live) {
      for (let i = 0; i < 31; i++) { const h = Math.round(6 + 10 * Math.abs(Math.sin(i * 0.55))); g.fillStyle(0xbc4a9b).fillRect(x - 30 + i * 2, f - 155 - h / 2, 2, h); }
      g.fillStyle(0x20d6c7).fillRect(x - 12, f - 177, 6, 6).fillRect(x + 6, f - 177, 6, 6);
      if (!t.pulse) t.pulse = this.scene.tweens.add({ targets: t.art, alpha: 0.85, duration: 700, yoyo: true, repeat: -1 });
    } else { g.fillStyle(0x3fe0d0, 0.5).fillRect(x - 20, f - 156, 40, 2); if (t.pulse) { t.pulse.stop(); t.pulse = null; t.art.setAlpha(1); } }
    for (let i = 0; i < 4; i++) g.fillStyle(live ? [0xe43b9a, 0x20d6c7, 0xffd541, 0x9cdb43][i] : 0x4a5462).fillRect(x - 30 + i * 18, f - 108, 8, 8);
  }
  // the Silo-KI's duel (#057): a unique Entity with more Integrität that hardly makes mistakes; won = she moves into the cyberdeck
  terminalDuel(t) {
    const s = this.scene, foe = uniqueEntity(s.data_, t.ai);
    if (!foe || !s.hud.duel) return;
    t.tried = true;
    s.hud.duel.open({ foe, title: 'Glitch-Duell · KI-Terminal', sub: `${this.P.name || 'POI'} · hier wohnt ${foe.name} · sehr schwer`, onDone: r => {
      if (r.won && r.caught) { t.done = true; s.box?.persist?.(); this.drawTerminal(t); }
      s.hud.toast(r.won ? (r.caught ? `Gefangen: ${foe.name}` : `${foe.name} findet keinen Platz`) : r.gaveUp ? 'Duell abgebrochen' : `${foe.name} hat gewonnen`,
        r.won ? (r.caught ? 'Eine einzigartige Entity. Sie wohnt jetzt in deinem Deck' : 'Mach Platz im Deck, Rucksack oder Lager und komm wieder') : 'Sie zieht sich zurück. Versuch es im nächsten Run', r.won ? 'good' : 'info', 4200);
    } });
  }
  drawSwitch(sw) {
    const g = sw.art.clear(), x = sw.x, f = sw.feet, live = !sw.dueled, on = sw.on;
    g.fillStyle(0x24272e).fillRect(x - 5, f - 60, 10, 60);                                   // post
    g.fillStyle(0x060608).fillRect(x - 30, f - 142, 60, 86);                                 // box outline
    g.fillStyle(0x3a3f48).fillRect(x - 27, f - 139, 54, 80);
    g.fillStyle(0x4a5462).fillRect(x - 27, f - 139, 54, 4);
    const scr = live ? 0x3b1730 : on ? 0x12302e : 0x122020, glow = live ? 0xe43b9a : 0x3fe0d0;
    g.fillStyle(0x060608).fillRect(x - 21, f - 131, 42, 30); g.fillStyle(scr).fillRect(x - 19, f - 129, 38, 26);
    if (live) { g.fillStyle(glow).fillRect(x - 11, f - 121, 5, 5).fillRect(x + 6, f - 121, 5, 5).fillRect(x - 8, f - 112, 16, 3); for (let i = 0; i < 4; i++) g.fillStyle(glow, 0.35).fillRect(x - 19, f - 128 + i * 7, 38, 1); }
    else { g.fillStyle(glow).fillRect(x - 13, f - 117, 26, 3); }
    g.fillStyle(0x15141a).fillRect(x - 9, f - 95, 18, 30);                                   // rocker
    g.fillStyle(on ? 0x3fe0d0 : live ? 0x6d758d : 0xb9c0c9).fillRect(x - 7, on ? f - 93 : f - 81, 14, 14);
    g.fillStyle(on ? 0x3fe0d0 : live ? 0xe43b9a : 0xffd27a).fillCircle(x + 19, f - 70, 4);    // lamp
    if (live && !sw.pulse) { sw.pulse = this.scene.tweens.add({ targets: sw.art, alpha: 0.82, duration: 260, yoyo: true, repeat: -1, repeatDelay: 900 }); }
    if (!live && sw.pulse) { sw.pulse.stop(); sw.pulse = null; sw.art.setAlpha(1); }
  }
  // chests are cover (#014): raiders hide behind them, shots stop at them → [{ x, w, top, feet }]
  covers() {
    const T = this.scene.T;
    return this.chests.map(c => {
      const w = c.sprite ? c.sprite.displayWidth * 0.8 : 80, h = c.sprite ? c.sprite.displayHeight * 0.85 : (c.open ? 80 : 64);
      return { x: c.x, w: Math.max(T * 0.6, w), top: c.feet - h, feet: c.feet };
    });
  }
  // #082 the fuse box: in a room after the first (seeded per level, Atmosphäre › Sicherungskasten % je Level), on a wall next to a floor;
  // E switches every lamp in the POI off (only the red emergency lights stay) and back on
  placeFuse() {
    const s = this.scene, R = s.room, T = s.T, LI = s.levelInfo, B = s.data_.game?.atmosphere?.blackout || {}, rooms = LI?.rooms || [];
    if (s.data_.game?.atmosphere?.enabled === false || rooms.length < 2) return [];
    let seed = ((s.box?.save?.run?.seed ?? s.args?.seed ?? LI.seed ?? 1) * 7919 + 13) % 2147483647 || 1; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    if (rnd() * 100 >= (B.chance ?? 60)) return [];
    const solid = (x, y) => '#'.includes(R.tiles[y]?.[x] ?? '#');
    for (let n = 0; n < 6; n++) {
      const r = rooms[1 + Math.floor(rnd() * (rooms.length - 1))];
      const spots = [];
      for (let y = r.y + 1; y < r.y + r.h; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++)
        if (R.tiles[y]?.[x] === '.' && R.tiles[y - 1]?.[x] === '.' && solid(x, y + 1) && (solid(x - 1, y) || solid(x + 1, y))) spots.push([x, y, solid(x - 1, y) ? -1 : 1]);
      if (!spots.length) continue;
      const [x, y, side] = spots[Math.floor(rnd() * spots.length)];
      const f = { x: (x + 0.5) * T, feet: (y + 1) * T, side, on: true, art: s.add.graphics().setDepth(-8) };
      this.drawFuse(f);
      return [f];
    }
    return [];
  }
  drawFuse(f) {
    const g = f.art.clear(), x = f.x + f.side * 14, y = f.feet - 118;
    g.fillStyle(0x1a1c22).fillRect(x - 22, y - 2, 44, 58).fillStyle(0x4a5058).fillRect(x - 20, y, 40, 54).fillStyle(0xd8b430).fillTriangle(x - 7, y + 12, x + 7, y + 12, x, y + 2);
    g.fillStyle(0x0d0a12).fillRect(x - 1, y + 5, 2, 5).fillStyle(0x2a2e36).fillRect(x - 12, y + 20, 24, 28);
    g.fillStyle(f.on ? 0x7dff9a : 0xff4a5c).fillRect(x - 8, f.on ? y + 22 : y + 36, 16, 8);   // the lever: up = on
    g.lineStyle(2, 0x0d0a12).lineBetween(x, y + 54, x, f.feet - 4);
  }
  toggleFuse(f) {
    const s = this.scene;
    f.on = !f.on; this.drawFuse(f);
    s.atmo?.setBlackout(!f.on);
    s.sfx?.('switch'); s.cam?.shake?.(120, 0.003);
    s.hud.toast(f.on ? 'Strom ist wieder da' : 'Stromausfall', f.on ? 'Die Lampen flackern an' : 'Nur noch Notlicht. Die Gegner sehen schlechter, AvAs Scheinwerfer wird wichtig', f.on ? 'info' : 'warn', 3600);
  }
  drawChest(c) {
    const g = c.art.clear(), x = c.x, f = c.feet;
    g.fillStyle(0x6b5030).fillRect(x - 40, f - 54, 80, 54);
    g.fillStyle(0x8a6a44).fillRect(x - 40, f - (c.open ? 80 : 64), 80, c.open ? 14 : 14);
    g.fillStyle(0xd4a72c).fillRect(x - 6, f - 50, 12, 14);
  }
  drawGoal(z) {
    const s = this.scene, g = z.art.clear(), x = z.x, f = z.feet, done = !!this.done;
    // #153 the painted vault (Spiel › Tresor): closed with a cyan core, cracked open with gold pouring out
    const V = s.data_.game?.vault || {}, key = done && V.open && s.textures.exists(V.open) ? V.open : V.look && s.textures.exists(V.look) ? V.look : null;
    if (key) {
      const A = s.data_.assets || {}, pxPerCm = (A[s.data_.leyla?.look?.idle]?.height || 192) / (s.data_.game?.tiles?.leylaCm || 170);
      const src = s.textures.get(key).getSourceImage(), k = (V.cm ?? 230) * pxPerCm / src.height, [cx, cy] = V.core || [src.width / 2, src.height / 2];
      if (!z.pic) z.pic = s.add.image(x, f + 2, key).setOrigin(0.5, 1).setDepth(-6);
      z.pic.setTexture(key).setScale(k).setPosition(x, f + 2);
      const gx = x + (cx - src.width / 2) * k, gy = f + 2 - (src.height - cy) * k, tint = done ? 0xffd27a : 0x3fe0d0;
      if (!z.glow) { z.glow = s.add.image(gx, gy, s.textures.exists('fx_glow') ? 'fx_glow' : '__WHITE').setBlendMode(Phaser.BlendModes.ADD).setDepth(-5).setScale(3).setAlpha(0.5); s.tweens.add({ targets: z.glow, alpha: 0.2, duration: 900, yoyo: true, repeat: -1 }); }
      z.glow.setPosition(gx, gy).setTint(tint).setScale(done ? 5 : 3);
      return;
    }
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
    const T = this.scene.turf;
    const bc = this.chests.find(c => c.bonus && !c.open && close(c)), zg = this.goals.find(close);   // #141 the bonus crate beside the vault: whichever is nearer
    if (bc && (!zg || Math.abs(bc.x - l.x) < Math.abs(zg.x - l.x))) return { text: `Bonus-Kiste öffnen · Rang ${bc.bonus.grade}`, act: () => this.openChest(bc) };
    for (const z of this.goals) if (close(z)) return this.done ? { text: `Geknackt · Abkürzung zum Van: ${this.shortcutWay()}` } : T?.active ? { text: `Tresor der ${T.gang} · nur mit Gewalt`, act: () => T.vault(() => this.finish()) } : { text: 'Tresor knacken · POI abschließen', act: () => this.finish() };
    for (const c of this.chests) if (!c.open && close(c)) return { text: T?.active ? `Kiste der ${T.gang} öffnen` : 'Kiste öffnen', act: () => this.openChest(c) };
    const talk = T?.near(); if (talk) return talk;   // #061
    for (const f of this.fuses || []) if (close(f)) return { text: f.on ? 'Sicherungskasten · Strom aus' : 'Sicherungskasten · Strom an', act: () => this.toggleFuse(f) };   // #082
    for (const sw of this.switches) if (close(sw)) return sw.on ? { text: 'Schalter ist umgelegt' } : sw.dueled ? { text: 'Schalter umlegen', act: () => this.pull(sw) } : { text: 'Schalter hacken · Glitch-Duell', act: () => this.duelAt(sw, 'Schalter', `sw${this.switches.indexOf(sw)}`) };
    for (const t of this.terminals || []) if (close(t)) return t.done ? { text: 'Das Terminal ist still' } : t.tried ? { text: `${t.ai} schweigt · nächster Run` } : { text: `${t.ai} anzapfen · Glitch-Duell (sehr schwer)`, act: () => this.terminalDuel(t) };   // #057
    // KIs in machines (Marken-Clutter marked „KI“, e.g. NomadCola-Automaten): once per run
    for (const h of this.hosts()) if (!h.done && close(h)) return { text: `${h.name} anzapfen · Glitch-Duell`, act: () => this.duelAt(h, h.name, `host${this.hosts().indexOf(h)}`) };
    for (const d of this.doors) if (!d.open && Math.abs((d.x0 + d.x1) / 2 * this.scene.T - l.x) < range * 0.8 && l.feet > d.y0 * this.scene.T && l.feet <= d.y1 * this.scene.T + 4)
      return { text: 'Die Tür geht von dieser Seite nicht auf' };
    return null;
  }

  // the machines with a KI in them: clutter of the POI's Marken-Clutter rows marked „KI“ (art.js brandKit)
  hosts() { return this.hostList ??= (this.scene.props || []).filter(p => p.ai).map(p => ({ x: p.ax ?? p.x + (p.cw || 0) / 2, feet: (p.ay ?? p.y + (p.ch || 0)) - 4, name: String(p.name || 'Automat').replace(/\s*\(.*\)/, ''), done: false })); }
  // a Glitch-Duell against the KI living here (#052): the switch can be thrown afterwards (won or lost), a won duel catches the KI
  duelAt(host, where, key) {
    const s = this.scene, save = s.box?.save, foe = foeFor(s.data_, save, `${this.poi}:${s.levelInfo?.seed ?? s.args?.seed ?? 0}:${key}`);
    if (!s.hud.duel || !foe) { host.dueled = host.done = true; if (host.door !== undefined) this.pull(host); return; }
    s.hud.duel.open({ foe, title: 'Glitch-Duell', sub: `${where} · hier wohnt ${foe.name}`, onDone: r => {
      host.dueled = true; host.done = true;
      if (r.caught) s.box?.persist?.();
      s.hud.toast(r.won ? (r.caught ? `Gefangen: ${foe.name}` : `${foe.name} ist entwischt`) : r.gaveUp ? 'Duell abgebrochen' : `${foe.name} hat gewonnen`,
        host.door !== undefined ? (r.won ? 'Der Schalter gehört dir' : 'Der Schalter lässt sich trotzdem umlegen') : r.won ? (r.caught ? 'Sie wohnt jetzt in deinem Deck' : 'Kein Platz im Deck, Rucksack oder Lager') : 'Sie ist in die Leitungen geflohen',
        r.won ? 'good' : 'info', 3200);
      if (host.door !== undefined) { this.drawSwitch(host); this.pull(host); }
      else {
        s.fx?.sparks?.(host.x, host.feet - 80, r.won ? 0x3fe0d0 : 0xe43b9a, 10);
        // #152 (Daniel 21.11.2026: „Automaten mit besiegten Entitäten droppen Nahrungsloot“): the machine spits out what it still holds
        const table = this.P.machineLoot ?? 'automat_beute';
        if (r.won && table && s.data_.lootTables?.[table] && s.loot) {
          const things = s.lootRoll ? s.lootRoll(table) : [];
          if (things.length) { s.loot.drop(host.x + 40, host.feet, things, 60); s.hud.toast('Der Automat spuckt aus', things.map(t => `${t.n}× ${s.data_[t.a]?.[t.id]?.name || t.id}`).join(' · '), 'loot', 3600); }
        }
      }
    } });
  }

  // where the way back is (#038: stacked POIs have a shaft beside the rooms instead of the tunnel underneath)
  shortcutWay() {
    const st = this.scene.levelInfo?.stack;
    return st === 'tower' ? 'der Schacht neben dem Turm, ganz nach unten' : st === 'deep' ? 'durch die Tür am Schacht, die Leiter hoch' : 'unten durch den Tunnel';
  }

  openChest(c) {
    const s = this.scene;
    c.open = true; this.chestsOpened++;
    s.sfx?.('crate_open', { x: c.x });   // #130
    s.turf?.chestOpened(c);   // #061 seen = theft
    if (c.sprite) { let f = 0; s.time.addEvent({ delay: 70, repeat: c.frames - 1, callback: () => c.sprite.setFrame(Math.min(c.frames - 1, ++f)) }); }
    else this.drawChest(c);
    if (c.bonus) return this.openBonus(c);
    const things = s.lootRoll ? s.lootRoll(this.lootTable) : rollLoot(s.data_, this.lootTable);
    for (const r of earn(s.data_, 'chest')) { const same = things.find(x => x.a === 'items' && x.id === r.id); if (same) same.n += r.n; else things.push(r); }   // #039
    this.salvagePart(things);
    this.treasureFind(things, 'chest');   // #057
    s.fx.sparks(c.x, c.feet - 50, 0xffd27a, 14);
    if (things.length) s.loot?.drop(c.x, c.feet, things, 140);
    else s.hud.toast('Leer …', 'Hier hat schon jemand geplündert', 'info', 2400);
  }
  // #141 the bonus crate opens: the grade's rolls from its table, the glow fades, the Beute-Bilanz names it
  openBonus(c) {
    const s = this.scene, B = c.bonus, things = rollLoot(s.data_, B.table, Math.random, { rolls: B.rolls, pick: B.pick });
    c.pulse?.stop(); s.tweens.add({ targets: c.glow, alpha: 0, duration: 600, onComplete: () => c.glow.destroy() });
    s.fx.sparks(c.x, c.feet - 50, 0xffd27a, 30);
    if (this.done?.crate) { this.done.crate.opened = true; this.done.crate.haul = things.map(t => `${t.id}×${t.n}`); }
    if (things.length) s.loot?.drop(c.x, c.feet, things, 160);
    s.hud.toast(`Bonus-Kiste · Rang ${B.grade}`, `${things.reduce((n, t) => n + t.n, 0)} Dinge${B.pick > 1 ? `, je der beste von ${B.pick}` : ''}`, 'loot', 3200);
  }
  // salvage (#023): a part a wreck still needs, if it lies in this POI (Bergungsprojekte › Fundorte)
  // #057 POI › Fundstücke: a certain thing lies here (a map piece), once per Durchgang and only while Leyla does not have it
  treasureFind(things, where) {
    const s = this.scene, save = s.box?.save, D = s.data_;
    if (!save) return;
    const found = save.found ??= [], st = stock(D, save);
    for (const t of this.P.treasure || []) {
      if (t.where !== where || !D.items?.[t.item] || found.includes(t.item) || (st[t.item] || 0) > 0 || Math.random() * 100 >= (t.chance ?? 100)) continue;
      found.push(t.item); things.push({ a: 'items', id: t.item, n: 1 });
      s.time.delayedCall(700, () => s.hud.toast(`Gefunden: ${D.items[t.item].name}`, D.items[t.item].description || '', 'loot', 5200));
    }
  }
  salvagePart(things, sure = false) {
    const s = this.scene, save = s.box?.save;
    if (!this.poi || !save) return;
    const p = chestPart(s.data_, save, this.poi, Math.random, sure);
    if (!p) return;
    things.push({ a: p.a, id: p.id, n: p.n });
    const name = s.data_.items?.[p.id]?.name || p.id;
    s.time.delayedCall(500, () => s.hud.toast(`Bergungsteil: ${name}`, `Für ${s.data_.salvage?.[p.salvage]?.name || 'das Wrack'}`, 'loot', 3200));
  }
  pull(sw) {
    const s = this.scene;
    sw.on = true; this.drawSwitch(sw);
    s.fx.sparks(sw.x, sw.feet - 120, 0x3fe0d0, 8);
    const d = sw.door;
    if (!d || d.open) return;
    this.openSolid(d);
    s.sfx?.('door_open', { x: sw.x });   // #130
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
      this.secretReward((w.x0 + w.x1) / 2 * T, w.y1 * T);
    }
  }
  // a secret pays out (#039): what Ranking › Ressourcen verdienen gives for it lies where the wall was
  secretReward(x, feet) {
    const s = this.scene, got = earn(s.data_, 'secret');
    if (got.length) s.loot?.drop(x, feet, got, 120);
  }

  // goal reached: time stops, ranking; the bonus is paid at the van
  finish() {
    const s = this.scene, D = s.data_;
    const kills = s.kills, seconds = Math.round(s.elapsed / 1000);
    const r = rankRun(D.ranking, { seconds, par: this.P.parTime, kills, killsMax: this.killsMax, secrets: this.secrets, secretsMax: this.secretsMax });
    this.done = { ...r, seconds, kills, secrets: this.secrets };
    s.cleared = true;   // the clock stops
    // the vault is full (design.md › Ausbaustufe Progression): POIs › Tresor-Beute; a good rank adds the bonus crate beside it (#141)
    const table = this.P.vault || (D.lootTables?.tresor ? 'tresor' : this.lootTable), haul = [];
    const things = [...(s.lootRoll ? s.lootRoll(table) : rollLoot(D, table))];
    this.salvagePart(things, true);   // the vault holds one missing salvage part for sure, if this POI is a Fundort
    this.treasureFind(things, 'vault');   // #057 a map piece of the treasure hunt
    const earned = earn(D, 'rank', { grade: r.grade });   // #039: a good rank gives Wissen extra
    things.push(...earned);
    for (const t of things) { const same = haul.find(h => h.id === t.id); if (same) same.n += t.n; else haul.push({ ...t }); }
    this.done.haul = haul.map(t => `${t.id}×${t.n}`);
    const z = this.goals[0];
    if (z && haul.length) { s.loot?.drop(z.x, z.feet, haul, 200); s.fx.sparks(z.x, z.feet - 60, 0xffd27a, 28); }
    for (const z of this.goals) this.drawGoal(z);
    const crate = this.bonusCrate(r.grade, table);
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
        { label: `Tresor: ${haul.reduce((n, t) => n + t.n, 0)} Dinge`, sub: haul.slice(0, 6).map(t => D.items?.[t.id]?.name || t.id).join(', ') + (haul.length > 6 ? ' …' : '') + (earned.length ? ` · Rang: ${earnText(D, earned)}` : '') },
        ...(crate ? [{ label: `Bonus-Kiste für Rang ${r.grade}`, sub: `Steht leuchtend neben dem Tresor · ${crate.rolls} Würfe${crate.pick > 1 ? `, je der beste von ${crate.pick}` : ''}` }] : []),
        { label: 'Weiter', primary: true, sub: `Zurück zum Van: ${this.shortcutWay()}`, act: () => {} },
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
      this.secretReward((f.x0 + f.x1) / 2 * T, f.y1 * T);
      s.fog?.reveal(true);
    }
  }
  // tiles that still hide what is behind them (fog sight lines): closed doors, brittle walls, fake walls not found yet
  hides(x, y) { return this.fakes.some(f => !f.found && f.set.has(x + ',' + y)); }
  // money for the van: run Δ plus rank bonus
  payout(deltas) { return this.done ? rankBonus(deltas, this.done.bonus).paid : deltas; }

  // #141 the bonus crate: from Ranking › Bonus-Kiste „ab Rang“ on, a glowing chest beside the vault with a better roll (the grade's rolls,
  // „Wählerisch“ keeps the most valuable of several draws) → the crate's plan or null
  bonusCrate(grade, vault) {
    const s = this.scene, D = s.data_, plan = rankCrate(D.ranking, grade), z = this.goals[0], T = s.T;
    if (!plan || !z) return null;
    const table = plan.loot && D.lootTables?.[plan.loot] ? plan.loot : vault;
    // beside the vault: the side with floor under it and room above it
    const tx = Math.floor(z.x / T), ty = Math.floor(z.feet / T) - 1, free = x => s.room.tiles[ty]?.[x] === '.' && s.room.tiles[ty - 1]?.[x] === '.' && '#'.includes(s.room.tiles[ty + 1]?.[x] ?? '#');
    const dx = [3, -3, 4, -4, 2, -2].find(d => free(tx + d)) ?? 3, cx = (tx + dx + 0.5) * T, feet = z.feet;
    const K = D.camp?.chest || {}, info = K.look && s.assetInfo(K.look), frames = D.assets?.[K.look]?.frames || 1;
    const sprite = info ? s.add.sprite(cx, feet, info.key, 0).setOrigin(info.ox, info.oy).setScale(info.scale).setDepth(-3).setTint(0xffe6a0) : null;
    const c = { x: cx, feet, sprite, frames, open: false, art: sprite ? null : s.add.graphics().setDepth(-3), bonus: { ...plan, table } };
    if (!sprite) this.drawChest(c);
    c.glow = s.add.image(cx, feet - 40, s.textures.exists('fx_glow') ? 'fx_glow' : '__WHITE').setBlendMode(Phaser.BlendModes.ADD).setDepth(-4).setScale(2.4).setAlpha(0.65).setTint(0xffd27a);
    c.pulse = s.tweens.add({ targets: c.glow, alpha: 0.25, scale: 2.0, duration: 700, yoyo: true, repeat: -1 });
    s.fx.sparks(cx, feet - 50, 0xffd27a, 20);
    this.chests.push(c);
    this.done.crate = { grade, rolls: plan.rolls, pick: plan.pick, opened: false, haul: [] };
    return plan;
  }

  state() {
    return {
      poi: this.poi, done: this.done, secrets: this.secrets, secretsMax: this.secretsMax, killsMax: this.killsMax,
      chests: this.chests.map(c => ({ x: Math.round(c.x), feet: c.feet, open: c.open, ...(c.bonus ? { bonus: c.bonus.grade } : {}) })),
      switches: this.switches.map(sw => ({ x: Math.round(sw.x), feet: sw.feet, on: sw.on })),
      terminals: (this.terminals || []).map(t => ({ x: Math.round(t.x), feet: t.feet, ai: t.ai, done: t.done, tried: t.tried })),   // #057
      doors: this.doors.map(d => ({ x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1, open: d.open })),
      walls: this.walls.map(w => ({ x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1, open: w.open, kind: w.kind })),
      fakes: this.fakes.map(f => ({ x0: f.x0, x1: f.x1, y0: f.y0, y1: f.y1, found: f.found, alpha: +(f.rts[0]?.alpha ?? 1).toFixed(2) })),
      goals: this.goals.map(z => ({ x: Math.round(z.x), feet: z.feet })),
    };
  }
}
