// Leben im POI (#169 G3): die Lager mit ihren Leuten (Feuerstelle, Schlafsäcke, Vorräte, Nest; gemalt oder aus Code), Runden durch die
// Nachbarräume, Fraktionen, die aufeinander reagieren (kämpfen, meiden, fliehen; moderat, damit Leyla es ausnutzen kann), und was die
// Simulation zwischen den Besuchen erzählt (AvA, Zeitschichten). Logic in engine/ecosystem.js; the run's losses go back into save.life.
import { lifeConfig, lifeAt, initLife, simulate, planLife, attitude, factionOf, recordLosses, newsSince, lifeLine } from '../../engine/ecosystem.js';
import { writeLayer } from '../../engine/history.js';
import { gangOfPlace } from '../reputation.js';

const LAYER_KINDS = new Set(['moved', 'gone', 'nest', 'settle']);
const NEWS_ORDER = ['owner', 'visit', 'moved', 'nest', 'gone', 'settle', 'raided'];

// before the level is parsed: the state of the place (simulated to today), the camps in the level, the layout without the old spawns
export function prepareLife(s, run) {
  const D = s.data_, L = s.levelInfo, C = lifeConfig(D);
  if (!L?.def || !run?.poi || !C.enabled || s.megarig || !(s.mode === 'run' || s.mode === 'test') || D.pois?.[run.poi]?.life?.off) return null;
  const save = s.mode === 'run' ? s.box?.save || null : null;
  const node = save ? (run.location ?? save.location ?? run.poi) : run.poi;
  let S, since;
  if (save) {
    const prev = save.life?.[node];
    since = prev ? (prev.seen ?? prev.day) : null;
    S = lifeAt(D, save, node, run.poi, gangOfPlace(D, save, node));
  } else {
    // test runs (?poi=…&seed=…&days=N): a fresh place, N days later
    S = initLife(D, run.poi, { seed: run.seed || 1 });
    since = s.args?.days ? S.day : null;
    if (s.args?.days) simulate(D, run.poi, S, S.day + s.args.days);
  }
  return { S, plan: planLife(D, run.poi, L, S, run.seed || 1), node, save, since, C };
}

export class Life {
  constructor(scene, prep) {
    const s = this.scene = scene;
    this.on = !!prep;
    this.kills = {}; this.feuds = 0; this.feudKills = 0; this.log = [];
    if (!this.on) return;
    Object.assign(this, prep);
    this.D = s.data_; this.T = s.T; this.R = this.C.director;
    this.camps = prep.plan.camps;
    const owner = this.S.owner;
    // everybody gets a faction: the camps' people from the plan, the sentries and specialists by family (raiders belong to the owner)
    for (const e of s.enemies) if (!e.life) e.life = { faction: factionOf(this.D, { family: e.d.family, gang: e.d.family === 'raider' ? owner : null, owner }), gang: e.d.family === 'raider' ? owner : null };
    for (const e of s.enemies) if (e.life?.role) { e.M.patrol = e.life.role === 'sit' ? 30 : e.life.role === 'guard' ? 90 : e.M.patrol; e.facing = (e.life.cx * this.T > e.x ? 1 : -1); }
    this.g = s.add.graphics().setDepth(-3.3);
    this.props = [];
    for (const c of this.camps) this.drawCamp(c);
    this.tell();
  }
  // ---------- the camp itself ----------
  drawCamp(c) {
    const PROP_IMG = this.D.life?.images || {};
    const s = this.scene, T = this.T, g = this.g, floor = (c.y + 1) * T, x0 = c.x0 * T, x1 = (c.x1 + 1) * T, mid = (c.cx + 0.5) * T;
    const put = (key, x, h, flip = false) => {
      if (!key || !s.textures.exists(key)) return false;
      const img = s.add.image(x, floor + 4, key).setOrigin(0.5, 1).setDepth(-3.2); img.setScale(h / img.height); if (flip) img.setFlipX(true);
      this.props.push(img); return true;
    };
    c.fire = null;
    if (c.props.includes('nest')) { if (!put(PROP_IMG.nest, mid, T * 1.9)) this.codeNest(mid, floor); c.glow = { x: mid, y: floor - T * 0.5, color: 0x9cdb43 }; this.lamp(mid, floor - T * 0.5, 0x9cdb43, 260, 0.45, 'pulse'); return; }
    if (c.props.includes('fire')) { if (!put(PROP_IMG.fire, mid, T * 1.6)) this.codeFire(mid, floor, c.props.includes('bags')); c.fire = { x: mid, y: floor - 26 }; this.lamp(mid, floor - T * 0.6, 0xfa8a2a, 420, 0.85, 'flicker'); }
    else if (c.props.includes('bags')) this.codeBags(mid, floor);
    if (c.props.includes('stash') && x1 - x0 > T * 4) put(PROP_IMG.stash, Math.min(x1 - T, mid + T * 2.4), T * 1.5, mid > (x0 + x1) / 2) || this.codeStash(Math.min(x1 - T, mid + T * 2.4), floor);
    // the gang's colour on a rag over the camp (who lives here, readable at a glance)
    if (c.gang) { const G = Object.values(this.D.pois || {}).find(p => p.gang?.name === c.gang)?.gang, col = { Gelb: 0xf9a31b, Orange: 0xfa6a0a, Magenta: 0xbc4a9b, Cyan: 0x20d6c7, Blutrot: 0x73172d, Giftgrün: 0x9cdb43 }[G?.color] ?? 0xdae0ea;
      g.fillStyle(0x221c1a, 1).fillRect(x0 + 8, floor - T * 1.9, 4, T * 1.9); g.fillStyle(col, 0.9).fillTriangle(x0 + 12, floor - T * 1.85, x0 + 12 + T * 0.7, floor - T * 1.6, x0 + 12, floor - T * 1.35); }
  }
  // the camp lights its part of the room in the light map (game/play/atmosphere.js): fire flickers, the nest pulses
  lamp(x, y, color, radius, strength, behavior) {
    const s = this.scene, A = s.atmo; if (!A?.lights) return;
    const halo = s.add.image(x, y, s.fx.glowKey()).setBlendMode(Phaser.BlendModes.ADD).setDepth((A.depth ?? 14) + 0.5).setTint(color).setDisplaySize(radius * 0.5, radius * 0.5);
    A.lights.push({ kind: 'bulb', x, y, c: [color >> 16 & 255, color >> 8 & 255, color & 255], radius, strength, behavior, seed: Math.round(x) * 7 + 3, clip: null, halo, haloA: 0.35, f: 1, camp: true });
  }
  codeFire(x, y, bags) {
    const g = this.g;
    for (let i = -2; i <= 2; i++) g.fillStyle(0x5a4e44, 1).fillEllipse(x + i * 13, y - 5, 14, 9);
    g.fillStyle(0x322b28, 1).fillRect(x - 22, y - 14, 44, 5);
    if (bags) this.codeBags(x, y);
  }
  codeBags(x, y) {
    const g = this.g, T = this.T;
    for (const [dx, c] of [[-T * 1.6, 0x24523b], [T * 1.4, 0x71413b]]) { g.fillStyle(c, 1).fillRoundedRect(x + dx - 34, y - 14, 68, 14, 6); g.fillStyle(0xdae0ea, 0.5).fillRoundedRect(x + dx + (dx < 0 ? -34 : 18), y - 13, 16, 10, 4); }
  }
  codeStash(x, y) {
    const g = this.g;
    g.fillStyle(0x71413b, 1).fillRect(x - 30, y - 40, 40, 40); g.fillStyle(0x8e5252, 1).fillRect(x - 20, y - 66, 30, 26);
    g.fillStyle(0x1a7a3e, 1).fillRoundedRect(x + 14, y - 30, 20, 30, 3); g.lineStyle(2, 0x221c1a, 1).strokeRect(x - 30, y - 40, 40, 40);
  }
  codeNest(x, y) {
    const g = this.g;
    g.fillStyle(0x422433, 1).fillEllipse(x, y - 16, 150, 38); g.fillStyle(0x5b3138, 1).fillEllipse(x - 20, y - 24, 70, 26);
    for (const dx of [-40, 6, 44]) g.fillStyle(0x9cdb43, 0.75).fillEllipse(x + dx, y - 30, 22, 28);
  }
  // ---------- what changed while she was away: AvA says it, a time layer remembers it ----------
  tell() {
    if (this.since == null) return;
    const news = newsSince(this.S, this.since);
    if (this.save) for (const x of news) if (LAYER_KINDS.has(x.kind)) writeLayer(this.save, this.node, { by: x.kind, gang: x.gang, day: x.day });
    const top = NEWS_ORDER.map(k => news.find(x => x.kind === k)).find(Boolean);
    this.news = news.map(x => x.kind);
    if (!top) return;
    const text = lifeLine(this.D, top.kind, { gang: top.gang || 'Fremde', place: this.D.pois?.[this.scene.levelPoi]?.name || '' });
    this.said = text;
    if (text) this.scene.time.delayedCall(5200, () => { if (this.scene.storyFx?.avaSay) this.scene.storyFx.avaSay(text, 0); else this.scene.hud?.toast?.('AvA', text, 'ava', 6000, { cat: 'story' }); });
  }
  // ---------- every frame (from Enemy.update): feuds between factions, rounds ----------
  // true = this frame belongs to life (the enemy's own state machine waits)
  think(e, time, dt, l) {
    if (!this.on || !e.life) return false;
    const free = ['patrol', 'alert', 'search', 'feud'].includes(e.state);
    if (!free) { if (e.foe) e.foe = null; return false; }
    // Leyla first, when she is close enough to notice in the middle of a fight
    if (e.seeing && (e.state !== 'feud' || Math.abs(l.x - e.x) < e.S.sight * this.R.notice / 100)) { if (e.state === 'feud') { e.foe = null; e.state = 'alert'; e.until = time + e.S.react; } return false; }
    if (time >= (e.lifeLook ?? 0)) { e.lifeLook = time + 160; this.look(e, time); }
    if (e.foe) return this.feud(e, time, dt);
    if (e.state === 'patrol' && e.life.role === 'round') return this.round(e, time);
    return false;
  }
  // the nearest one of another faction it can see, and what it wants with it
  look(e, time) {
    if (e.foe && (!e.foe.alive || time > e.foeUntil)) { e.foe = null; if (e.state === 'feud') { e.state = 'patrol'; e.home = { x: e.x, y: e.body.center.y }; } }
    if (e.foe) return;
    let best = null, bd = Infinity, how = null;
    for (const o of this.scene.enemies) {
      if (o === e || !o.alive || !o.life) continue;
      const a = attitude(this.C, e.life.faction, o.life.faction, { gangA: e.life.gang, gangB: o.life.gang });
      if (a === 'ignore') continue;
      const d = Math.abs(o.x - e.x);
      if (d > e.S.sight * 0.9 || Math.abs(o.feet - e.feet) > 220 || d >= bd || !this.scene.lineFree(e.x, e.eyeY, o.x, o.eyeY)) continue;
      best = o; bd = d; how = a;
    }
    if (!best) return;
    e.foe = best; e.foeHow = how; e.foeUntil = time + (how === 'fight' ? 12000 : 2600); e.state = 'feud';
    if (!e.feuding) { e.feuding = true; this.feuds++; this.log.push({ t: Math.round(time), a: e.id, b: best.id, how }); if (this.log.length > 30) this.log.shift(); }
    e.say(how === 'fight' ? ['Die da!', 'Unser Revier!', 'Raus hier!', 'Kreeesch!'][e.life.faction === 'mutants' ? 3 : this.feuds % 3] : how === 'flee' ? 'Weg hier!' : '…', how === 'fight' ? '#ff8a5c' : '#8b949e');
  }
  feud(e, time) {
    const o = e.foe, dx = o.x - e.x, dir = Math.sign(dx) || 1, speed = e.d.speed ?? 120;
    if (e.foeHow !== 'fight') { e.walk(-dir, speed * (e.foeHow === 'flee' ? 1.15 : 0.5), e.M.drop); e.facing = -dir; return true; }
    const shot = e.attackKind === 'shot', range = shot ? Math.min(560, e.a.range ?? 520) : (e.a.range ?? 140);
    e.facing = dir;
    if (Math.abs(dx) > range * 0.9) { e.walk(dir, speed * 0.8, e.M.drop); return true; }
    e.stop();
    if (time >= (e.feudAt ?? 0)) {
      e.feudAt = time + (e.a.cooldown ?? 1300) + 400;
      const dmg = Math.max(1, Math.round((e.d.damage ?? 10) * this.R.feudDamage / 100));
      if (shot) { const g = this.scene.add.graphics().setDepth(9); g.lineStyle(3, 0xffd27a, 0.9).lineBetween(e.x + dir * 30, e.chest, o.x, o.chest); this.scene.time.delayedCall(70, () => g.destroy()); this.scene.sfx?.('enemy_shot', { x: e.x }); }
      else { this.scene.fx.text(e.x + dir * 40, e.chest - 30, '✕', { color: '#ffd27a', size: 36, rise: 20 }); this.scene.sfx?.('enemy_swing', { x: e.x }); }
      this.scene.time.delayedCall(shot ? 60 : 160, () => this.hurt(o, dmg, e, dir));
    }
    return true;
  }
  hurt(o, dmg, by, dir) {
    if (!o.alive || !by.alive) return;
    const s = this.scene, time = s.now ?? s.time.now;
    o.hp -= dmg; o.barUntil = time + 2500;
    s.fx.text(o.x, o.body.top - 10, String(dmg), { color: '#c9b3a0', size: 34 });
    s.fx.bloodHit?.(o.x - dir * o.w * 0.25, o.chest, dir, 0.6, { machine: o.d.family === 'machine' });
    // hit back (or run): it answers the one who hit it, unless it already fights Leyla
    if (['patrol', 'alert', 'search', 'feud'].includes(o.state) && o.foe !== by) {
      const a = attitude(this.C, o.life.faction, by.life.faction, { gangA: o.life.gang, gangB: by.life.gang });
      o.foe = by; o.foeHow = a === 'flee' || a === 'avoid' ? 'flee' : 'fight'; o.foeUntil = time + 9000; o.state = 'feud';
    }
    if (o.hp <= 0) { o.feudKill = by.id; this.feudKills++; o.die(time, dir); }
  }
  // a round: from the camp along the floor to one end, a pause, to the other end, back to the fire
  round(e, time) {
    const T = this.T, [a, b] = e.life.route;
    if (time < (e.roundWait ?? 0)) { e.stop(); return true; }
    e.roundDir ??= 1;
    const goal = ((e.roundDir > 0 ? b : a) + 0.5) * T;
    if (Math.abs(goal - e.x) < 14 || e.stuck) {
      e.roundDir *= -1; e.roundWait = time + 1800 + ((e.rounds || 0) % 3) * 700; e.rounds = (e.rounds || 0) + 1; e.stuck = false; e.stop();
      return true;
    }
    e.walk(Math.sign(goal - e.x), (e.d.speed ?? 120) * 0.35);
    return true;
  }
  // a death: the camp lost one (by Leyla or by the others)
  died(e) { if (e.life?.camp) this.kills[e.life.camp] = (this.kills[e.life.camp] || 0) + 1; }
  // the end of the run: the losses go into the place's state
  commit() {
    if (!this.on || !this.save) return;
    recordLosses(this.D, this.S, this.kills);
    this.S.seen = this.S.day;
    this.kills = {};
  }
  update(time) {
    if (!this.on) return;
    // the fire itself from code (also over a painted fire: the flames move)
    const g = this.flames ??= this.scene.add.graphics().setDepth(-3.1); g.clear();
    for (const c of this.camps) if (c.fire) for (let i = 0; i < 5; i++) {
      const k = (time / 90 + i * 1.7) % 1, x = c.fire.x + Math.sin(time / 110 + i * 2) * 8 + (i - 2) * 5, y = c.fire.y + 14 - k * 34;
      g.fillStyle([0xffd541, 0xf9a31b, 0xfa6a0a][i % 3], 0.85 * (1 - k)).fillCircle(x, y, 9 * (1 - k) + 3);
    }
  }
  state() {
    if (!this.on) return { on: false };
    const S = this.S, r = Math.round, E = this.scene.enemies;
    return { on: true, node: this.node, day: S.day, owner: S.owner, camps: this.camps.map(c => ({ id: c.id, type: c.type, name: c.name, faction: c.faction, gang: c.gang, room: c.room, x0: c.x0, x1: c.x1, y: c.y, cx: c.cx, route: c.route, strength: c.strength,
      members: E.filter(e => e.life?.camp === c.id).map(e => ({ id: e.id, x: r(e.x), alive: e.alive, state: e.state, role: e.life.role, rounds: e.rounds || 0, faction: e.life.faction })) })),
      state: S.camps.map(c => ({ id: c.id, type: c.type, gang: c.gang, strength: c.strength, pos: c.pos })), log: S.log.slice(-8), news: this.news || [], said: this.said || null,
      props: this.props.map(p => p.texture.key), feuds: this.feuds, feudKills: this.feudKills, feudLog: this.log.slice(-8), kills: { ...this.kills }, sentries: this.plan.sentries.length, removed: this.plan.removed };
  }
}
