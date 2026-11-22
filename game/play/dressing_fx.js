// Set dressing stage 2 in the picture (#159): debris of the decay, traces of the room stories, the desert creeping in (sand drifts, green
// in cracks, light through the openings), the back wall layer (darkened, no body) and, in developer mode, learning from corrections
// (K, click a thing, pick a reason → a rule in data/dressing_rules.json for every seed). Logic in engine/dressing_story.js.
import { desertField, desertMarks, planBackWall, levelTales, taleMarks, ruleFrom, RULE_REASONS, hash } from '../../engine/dressing_story.js';
import { landmarkViews } from '../../engine/level_design.js';
import { shaftInLevel } from '../../engine/shaft.js';
import { roomStory } from '../../engine/story.js';
import { openDialogue, el } from '../ui.js';

const shade = (c, k) => ((Math.round((c >> 16 & 255) * k) << 16) | (Math.round((c >> 8 & 255) * k) << 8) | Math.round((c & 255) * k));

export class DressingFx {
  constructor(scene) {
    const s = this.scene = scene, LI = s.levelInfo, D = s.data_;
    this.on = !!LI?.def && s.mode !== 'camp' && !s.megarig;
    if (!this.on) return;
    this.T = s.T; this.D = D; this.seed = s.levelSeed || 0;
    const reg = s.terrain?.reg, spots = s.placeMap?.();
    if (!reg || !spots) { this.on = false; return; }
    const holes = new Set(), holeList = [];
    for (const v of landmarkViews(D, s.levelPoi, LI)) if (v.win) for (let y = v.win.y; y < v.win.y + v.win.h; y++) for (let x = v.win.x; x < v.win.x + v.win.w; x++) { holes.add(x + ',' + y); holeList.push([x, y]); }
    for (const c of shaftInLevel(D, s.levelPoi, LI)?.cells || []) holes.add(c);   // #173 nothing hangs on the back wall where the shaft opens
    this.g = s.add.graphics().setDepth(-9.9);   // on the floors, in front of the tiles
    this.back = s.add.graphics().setDepth(-10.9);   // between the back wall and the world
    this.glow = s.add.graphics().setDepth(-9.85).setBlendMode(Phaser.BlendModes.ADD);
    this.drawDebris(s.dressingPlan?.items || []);
    this.field = desertField(D, s.levelPoi, LI, holeList);
    this.drawDesert(desertMarks(this.field, spots, reg.inside, this.seed));
    this.drawOpenings(LI, holeList);
    // #174 the front doors of the level (engine/doors.js) stand on the back wall: nothing else there, and no more code doors
    const fronts = LI.doors?.front || [];
    for (const f of fronts) for (let y = f.y - 1; y <= f.feet; y++) for (let x = f.x - 1; x <= f.x + f.w; x++) holes.add(x + ',' + y);
    this.backItems = planBackWall(D, s.room, reg, spots, this.seed, holes).filter(b => b.kind !== 'door' || !Object.keys(D.doors || {}).length || D.game?.doors?.enabled === false);
    this.drawBack(this.backItems);
    this.tales = levelTales(D, s.levelPoi, LI, this.seed);
    for (const [i, id] of this.tales) { const T = D.roomStories?.[id]; if (T) this.drawTale(T, LI.rooms[i]); }
    this.noted = new Set();
    // Korrekturen (Entwickler-Modus: Spiel › Set-Dressing Stufe 2 › Entwickler-Modus, or ?dev)
    this.dev = !!(D.game?.dressing?.learn || (typeof location !== 'undefined' && /[?&]dev\b/.test(location.search)));
    if (this.dev) s.input.keyboard?.on('keydown-K', () => this.toggleLearn());
  }
  // ---------- decay: rubble, shards, paper on the floors ----------
  drawDebris(items) {
    const T = this.T, g = this.g;
    for (const it of items.filter(i => i.debris)) {
      const x = it.x * T, y = it.y * T, r = it.seed ?? 0.5;
      g.fillStyle(0x5a4e44, 0.95).fillTriangle(x + 8 + r * 20, y, x + 22 + r * 20, y, x + 16 + r * 20, y - 7 - r * 5);
      g.fillStyle(0x796755, 0.9).fillRect(x + 30 - r * 10, y - 5, 12, 5).fillRect(x + 44 - r * 6, y - 3, 7, 3);
      if (r > 0.5) { g.fillStyle(0xdae0ea, 0.7).fillRect(x + 6 + r * 30, y - 2, 9, 2); this.glow.fillStyle(0xe3e6ff, 0.25).fillRect(x + 40 - r * 20, y - 3, 3, 2); }
      else g.fillStyle(0xc7b08b, 0.85).fillRect(x + 20, y - 2, 10, 2);
    }
  }
  // ---------- the desert creeps in: sand drifts at the wall foot and in corners, green in the cracks ----------
  drawDesert(marks) {
    const T = this.T, g = this.g;
    for (const m of marks) {
      const x = m.x * T, y = m.y * T, s = m.size;
      if (m.kind === 'sand') {
        const w = T * (0.6 + s * 0.9), h = 4 + s * 16, cx = m.corner === 'l' ? x + w * 0.3 : m.corner === 'r' ? x + T - w * 0.3 : x + T / 2;
        g.fillStyle(0xc7b08b, 0.55 + s * 0.4).fillEllipse(cx, y + 2, w, h * 2);
        g.fillStyle(0xe4d2aa, 0.35 * s).fillEllipse(cx - w * 0.1, y, w * 0.6, h);
      } else {
        const px = x + 10 + hash(m.x, m.y, 3) * (T - 20);
        g.lineStyle(2, 0x59c135, 0.8); for (let k = -2; k <= 2; k++) g.lineBetween(px, y, px + k * 3, y - 6 - s * 10 + Math.abs(k) * 2);
        g.lineStyle(1, 0x796755, 0.7).lineBetween(px, y, px - 8, y + 2);
      }
    }
  }
  // light falls in through every opening to the outside (outdoor room next to an indoor one) and through the windows
  drawOpenings(LI, holes) {
    const T = this.T, amp = this.field.amp, D = this.D, glow = this.glow;
    if (amp < 0.1) return;
    const indoor = id => { const r = D.rooms?.[id] || {}; return r.indoor ?? !(r.backdrop?.image || r.backdrop?.weather); };
    const mains = LI.rooms.filter(r => r.band === 'main');
    for (let i = 1; i < mains.length; i++) {
      const a = mains[i - 1], b = mains[i]; if (indoor(a.id) === indoor(b.id) || LI.stack) continue;
      const inR = indoor(a.id) ? a : b, dir = inR === b ? 1 : -1, x = (dir > 0 ? b.x : a.x + a.w) * T, floor = (inR.y + inR.h - 1) * T;
      glow.fillStyle(0xfef3c0, 0.07 * amp + 0.02).fillTriangle(x, floor - 4 * T, x, floor, x + dir * 6 * T, floor);
    }
    const seen = new Set();
    for (const [x, y] of holes) {
      const k = Math.floor(x / 4) + ',' + Math.floor(y / 3); if (seen.has(k)) continue; seen.add(k);
      glow.fillStyle(0xfef3c0, 0.05 * amp + 0.02).fillTriangle(x * T, (y + 3) * T, (x + 4) * T, (y + 3) * T, (x + 6) * T, (y + 6) * T);
    }
  }
  // ---------- back wall layer: darker than the play layer (Spiel › Set-Dressing Stufe 2 › Rückwand dunkler) ----------
  drawBack(items) {
    const T = this.T, g = this.back, k = 1 - (this.D.game?.dressing?.backDim ?? 42) / 100, c = n => shade(n, k);
    for (const b of items) {
      const x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T;
      if (b.kind === 'pipe') { g.fillStyle(c(0x6d758d), 1).fillRect(x, y + 6, w, 14); g.fillStyle(c(0x8b93af), 1).fillRect(x, y + 8, w, 3); for (let xx = x; xx < x + w; xx += T) g.fillStyle(c(0x4a5462), 1).fillRect(xx + 4, y + 3, 8, 20); }
      else if (b.kind === 'duct') { g.fillStyle(c(0x4a5462), 1).fillRect(x + T / 2 - 6, y, 12, h + T); g.fillStyle(c(0x333941), 1).fillRect(x + T / 2 - 12, y + 10, 24, 18); }
      else if (b.kind === 'shelf') { g.fillStyle(c(0x71413b), 1).fillRect(x + 4, y + 18, w - 8, 5).fillRect(x + 4, y + 44, w - 8, 5); for (let i = 0; i < 4; i++) g.fillStyle(c([0xa08662, 0xdba463, 0x796755, 0xc7b08b][i]), 1).fillRect(x + 10 + i * (w - 20) / 4, y + 6, (w - 30) / 4, 12); }
      else if (b.kind === 'poster') { g.fillStyle(c(0xe4d2aa), 1).fillRect(x + 12, y + 4, T - 24, T - 10); g.fillStyle(c([0xb4202a, 0x249fde, 0xf9a31b, 0x59c135][Math.floor(hash(b.x, b.y, 5) * 4)]), 1).fillRect(x + 16, y + 10, T - 32, 22); g.fillStyle(c(0x322b28), 1).fillRect(x + 16, y + 38, T - 34, 3).fillRect(x + 16, y + 44, T - 40, 3); }
      else if (b.kind === 'sign') { g.fillStyle(c(0x14a02e), 1).fillRect(x + 8, y + 14, T - 16, 20); g.fillStyle(c(0xffffff), 1).fillRect(x + 14, y + 22, T - 28, 4); }
      else if (b.kind === 'door') { g.fillStyle(c(0x242234), 1).fillRect(x + 6, y - 4, T - 12, h + 4); g.lineStyle(4, c(0x5a4e44), 1).strokeRect(x + 6, y - 4, T - 12, h + 4); g.fillStyle(c(0xdba463), 1).fillCircle(x + T - 18, y + h / 2, 3); }
      else if (b.kind === 'board') { g.fillStyle(c(0xa08662), 1).fillRect(x + 6, y + 6, w - 12, T - 14); for (let i = 0; i < 5; i++) g.fillStyle(c(0xdae0ea), 1).fillRect(x + 12 + i * (w - 30) / 5, y + 12 + (i % 2) * 12, 16, 12); }
      else if (b.kind === 'box') { g.fillStyle(c(0x4a5462), 1).fillRect(x + 14, y + 8, T - 28, T - 18); g.fillStyle(c(0xf9a31b), 1).fillTriangle(x + T / 2, y + 16, x + T / 2 - 7, y + 30, x + T / 2 + 7, y + 30); }
    }
  }
  // ---------- traces of a room story ----------
  drawTale(Tl, r) {
    const T = this.T, g = this.g, back = this.back, glow = this.glow;
    for (const m of taleMarks(Tl, r, this.scene.room.tiles, this.seed)) {
      const x = m.x * T, y = (m.y + 1) * T, h = hash(m.x, m.y, 9);
      switch (m.kind) {
        case 'soot': back.fillStyle(0x141013, 0.35).fillEllipse(x + T / 2, y - T * 1.4, T * 1.6, T * 1.8); break;
        case 'holes': for (let i = 0; i < 6; i++) { const hx = x + 8 + hash(m.x + i, m.y, 1) * (T - 16), hy = y - T * 1.7 + hash(m.x, m.y + i, 2) * T; back.fillStyle(0x141013, 0.9).fillCircle(hx, hy, 3); back.fillStyle(0x8b93af, 0.5).fillCircle(hx - 1, hy - 1, 1); } break;
        case 'shells': for (let i = 0; i < 5; i++) g.fillStyle(0xdba463, 1).fillRect(x + hash(i, m.x, 3) * T, y - 3, 5, 2); break;
        case 'blood': g.fillStyle(0x73172d, 0.85).fillEllipse(x + T / 2, y - 1, T * (0.7 + h * 0.5), 6); g.fillStyle(0x73172d, 0.7).fillCircle(x + T * 0.9, y - 2, 3); break;
        case 'puddle': g.fillStyle(0x285cc4, 0.45).fillEllipse(x + T / 2, y - 1, T * 1.3, 6); glow.fillStyle(0xa6fcdb, 0.15).fillEllipse(x + T * 0.4, y - 2, T * 0.5, 2); break;
        case 'drip': back.fillStyle(0x23674e, 0.5).fillRect(x + T / 2, y - T * 2, 4, T * 1.8); break;
        case 'algae': back.fillStyle(0x24523b, 0.55).fillRect(x, y - 14, T, 12); g.fillStyle(0x328464, 0.6).fillEllipse(x + T / 2, y - 1, T, 5); break;
        case 'bones': g.lineStyle(3, 0xdae0ea, 0.9).lineBetween(x + 10, y - 3, x + 30, y - 6).lineBetween(x + 36, y - 2, x + 50, y - 4); g.fillStyle(0xdae0ea, 0.9).fillCircle(x + 10, y - 3, 3).fillCircle(x + 30, y - 6, 3); break;
        case 'boards': back.fillStyle(0x71413b, 1).fillRect(x - 6, y - T * 1.6, T + 12, 9).fillRect(x - 4, y - T * 1.1, T + 8, 9); break;
        case 'cartons': g.fillStyle(0xa08662, 1).fillRect(x + 6, y - 14, 20, 14); g.fillStyle(0xc7b08b, 1).fillRect(x + 30, y - 9, 16, 9); g.lineStyle(1, 0x5a4e44, 1).strokeRect(x + 6, y - 14, 20, 14); break;
        case 'camp': g.fillStyle(0x5a4e44, 1); for (let i = 0; i < 5; i++) g.fillCircle(x + 14 + i * 8, y - 3, 4); glow.fillStyle(0xfa6a0a, 0.35).fillCircle(x + 30, y - 6, 12); g.fillStyle(0xf9a31b, 0.9).fillTriangle(x + 24, y - 4, x + 36, y - 4, x + 30, y - 16); break;
        case 'sleep': g.fillStyle(0x23674e, 1).fillRoundedRect(x - T * 0.2, y - 10, T * 1.4, 10, 5); g.fillStyle(0xe4d2aa, 1).fillRoundedRect(x - T * 0.2, y - 12, 16, 8, 3); break;
      }
    }
  }
  // a note of the room story on the first entry (Raum-Geschichten › Logbuch-Zettel)
  enterRoom(here) {
    if (!this.on || !here) return;
    const i = this.scene.levelInfo.rooms.indexOf(here), T = this.D.roomStories?.[this.tales?.get(i)];
    if (!T?.note || this.noted.has(i)) return;
    this.noted.add(i);
    this.scene.hud?.toast?.('Ein Zettel', T.note, 'info', 6000);
  }
  // ---------- Korrekturen: K, then click a thing ----------
  toggleLearn() {
    const s = this.scene;
    this.learning = !this.learning;
    s.hud?.toast?.(this.learning ? 'Korrektur-Modus an' : 'Korrektur-Modus aus', this.learning ? 'Ein Ding anklicken, dann den Grund wählen (K = aus)' : '', 'info', 3000);
    if (this.learning) { this.onClick = p => this.pick(p); s.input.on('pointerdown', this.onClick); } else s.input.off('pointerdown', this.onClick);
  }
  // the planned thing under the pointer → the dialogue with the five reasons
  pick(p) {
    const s = this.scene, T = this.T, cam = s.cam, wp = cam.getWorldPoint(p.x, p.y), tx = wp.x / T, ty = wp.y / T;
    const it = (s.dressingPlan?.items || []).filter(i => !i.debris).find(i => i.hang === 'stand' ? tx >= i.x && tx < i.x + i.w && ty >= i.y - i.h && ty < i.y + 0.2 : Math.abs(tx - i.x - 0.5) < 0.7 && Math.abs(ty - i.y - 0.5) < 1.2);
    if (!it) { s.hud?.toast?.('Kein Ding hier', 'Auf ein eingerichtetes Ding klicken', 'warn', 2000); return; }
    const LI = s.levelInfo, room = LI.rooms.find(r => it.x >= r.x && it.x < r.x + r.w && it.y - 1 >= r.y && it.y - 1 < r.y + r.h), R = this.D.rooms?.[room?.id] || {};
    const role = roomStory(this.D.pois?.[s.levelPoi] || {}, R).role;
    const dlg = openDialogue({ title: `Korrektur: ${it.name}`, icon: 'rules', content: [el('p', {}, `${R.name || room?.id || ''} · Rolle ${role} · Ort ${it.type}`),
      el('div', { class: 'ed-row' }, ...RULE_REASONS.map(([k, label]) => el('button', { class: 'ed-button', onclick: () => { this.learn(k, { thing: it.name, role, place: it.type, poi: s.levelPoi, room: room?.id }); dlg.closeFn(); } }, label)))] });
  }
  async learn(reason, ctx) {
    const s = this.scene, D = this.D, rule = ruleFrom(reason, ctx), all = { ...(D.dressingRules || {}) };
    let n = Object.keys(all).length + 1; while (all['r' + n]) n++;
    all['r' + n] = Object.fromEntries(Object.entries(rule).filter(([, v]) => v !== undefined && v !== ''));
    D.dressingRules = all;
    try { const { openStore } = await import('../store.js'); const st = await openStore({ project: 'nomadgirl', withoutAssets: true }); await st.persist('data/dressing_rules.json', all); } catch { /* no store: this session only */ }
    s.hud?.toast?.('Gelernt', `${rule.name} · gilt ab dem nächsten Laden in allen Seeds (Werkstatt › Korrekturen)`, 'good', 5000);
  }
}
