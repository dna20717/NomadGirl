// The drive between two places (#053, Daniel 18.11.2026: „wie bei Keep Driving“; 1a: in Szene setzen, Entscheidung wie bisher im Fenster;
// 2a: das echte Rig; 3c: Landschaft aus Code, mit Licht, Sonnenuntergängen und Wetter; 4c: einstellbar, Standard 30 Sekunden je Etappe).
// The rig (a picture of the camp's rig, rig_snapshot.js) rolls to the right through the landscape of game/road.js; the clock runs with
// the leg, the sky follows it, it rains when it rains (rain.js), dust and fog by region. An incident of the leg comes into view by the road,
// the rig slows down and stops next to it, then the incident's window opens (camp_actions.js); after the choice the rig drives on.
//   hold ok (E / A): faster (Reisen › Fahrt › Vorspulen) · back (Esc / B): straight to the next stop or the end of the leg
//   hud.drive.open({ rig, from, to, legs, seed }) · leg(info, { atStop, end }) · resume() · finish(done) · close()
import { el } from '../ui.js';
import { icon } from '../icons.js';
import { hints } from './ui_nav.js';
import { makeRoad, driveConfig, landscapeOf, legWeather, skyAt, BW, BH, WHEEL_Y } from '../road.js';
import { mapBrands } from '../brands.js';
import { mapConfig } from '../worldmap.js';
import { rainingAt } from '../rain.js';
import { kitLook } from './enemy_kit.js';

const ease = k => k * k * (3 - 2 * k);
const two = n => String(n).padStart(2, '0');

export class DriveUI {
  // host: { scene() }
  constructor(root, host, before = null) {
    this.host = host;
    this.el = el('div', { class: 'dv', hidden: true });
    this.canvas = el('canvas', { class: 'dv-canvas' });
    this.bg = Object.assign(document.createElement('canvas'), { width: BW, height: BH });
    this.hud = el('div', { class: 'dv-hud' });
    this.el.append(this.canvas, this.hud);
    if (before && before.parentNode === root) root.insertBefore(this.el, before); else root.append(this.el);   // under the menu (incidents)
    this.keys = new Set();
    window.addEventListener('keydown', e => {
      if (!this.isOpen || this.host.scene()?.hud?.modal) return;
      const a = { Escape: 'back', Enter: 'ok', ' ': 'ok', e: 'ok', E: 'ok' }[e.key];
      if (!a) return;
      e.preventDefault(); e.stopPropagation();
      if (a === 'ok') this.keys.add('ok'); else if (!e.repeat) this.skip();
    }, true);
    window.addEventListener('keyup', e => { if (['Enter', ' ', 'e', 'E'].includes(e.key)) this.keys.delete('ok'); }, true);
    this.canvas.addEventListener('pointerdown', () => this.keys.add('ptr'));
    window.addEventListener('pointerup', () => this.keys.delete('ptr'));
  }
  get isOpen() { return !this.el.hidden; }

  // ---------- the trip ----------
  open({ rig, from, to, legs = 1, seed = 1 }) {
    const s = this.host.scene(), D = s.data_;
    this.D = D; this.C = driveConfig(D); this.rig = rig ? this.prepareRig(rig) : null;
    const M = mapConfig(D), logos = () => this.image(D.assets?.[M.logos]?.file);
    logos();
    this.road = makeRoad(D, { seed, logos, brands: mapBrands(D) });
    this.trip = { from, to, legs, seed };
    this.st = { dist: 0, t: 0, dt: 0, v: 0, hour: 12, land: [landscapeOf(D, ''), landscapeOf(D, ''), 0], wet: 0, dust: 0, fog: 0, flash: 0, stop: null };
    this.legInfo = null; this.phase = 'idle'; this.fade = 1; this.steam = 0; this.steamP = []; this.puffs = []; this.say = null; this.lastLeg = null; this.fading = -1.6; this.lit = null; this.litKey = '';
    this.el.hidden = false; this.el.parentNode?.classList.add('dv-on');
    s.cameras?.main?.setVisible(false);   // the camp underneath does not need to be drawn
    s.hud?.banner?.(null);   // an old „Angekommen“ does not ride along
    this.last = performance.now();
    cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(t => this.frame(t));
  }
  // one leg: info { i, n, h0, h1, fuel0, fuel1, km, fromName, toName, region0, region1, stop: { kind, name } | null }
  leg(info, cb) {
    const D = this.D, C = this.C, w = legWeather(D, this.trip.seed, info.i, info.region1 || info.region0, info.h0);
    this.legInfo = { ...info, T: C.seconds, time: 0, cb, weather: w, stopT: info.stop ? C.seconds * C.stopAt : null, said: false, stopped: false };
    this.st.land = [landscapeOf(D, info.region0), landscapeOf(D, info.region1 || info.region0), 0];
    this.phase = 'drive';
    if (this.host.scene()?.script && !this.host.scene()?.showDrive) this.legInfo.time = this.legInfo.T;   // remote control: no waiting
    this.draw();
  }
  // after the incident's window: on we go
  // extra: hours the choice took (a detour), the sky jumps on by them and the rest of the leg runs on from there
  resume(extra = 0) { const L = this.legInfo; if (!L) return; if (extra > 0) L.shift = (L.shift || 0) + extra; L.stopped = true; L.resumeAt = L.time; this.phase = 'drive'; }
  clock() { const h = this.st.hour, hh = Math.floor(h % 24), mm = Math.floor((h % 1) * 60); return `Tag ${Math.floor(h / 24)} · ${two(hh)}:${two(mm)}`; }
  // the last leg is done: fade to black, then the camp at the new place
  finish(done) { this.phase = 'out'; this.fading = 1.4; this.onOut = done; }
  close() { cancelAnimationFrame(this.raf); this.el.hidden = true; this.el.parentNode?.classList.remove('dv-on'); this.legInfo = null; this.phase = 'idle'; this.keys.clear(); this.host.scene()?.cameras?.main?.setVisible(true); }
  // back: straight to the next stop (the incident) or the end of the leg
  skip() {
    const L = this.legInfo; if (!L || this.phase !== 'drive') return;
    if (L.stopT != null && !L.stopped && L.time < L.stopT - this.approach()) L.time = L.stopT - this.approach();
    else if (L.stopT == null || L.stopped) L.time = L.T;
  }
  // pad (scene.padMenus): hold A to go faster, B skips
  nav(u) { if (u.down('ok')) this.keys.add('pad'); else this.keys.delete('pad'); if (u.pressed('back')) this.skip(); }
  // seconds the rig needs to slow down from the right edge to the incident (it comes into view at the edge)
  approach() { const v0 = this.C.speed, d = Math.max(40, BW + 10 - (this.stopX())); return 2 * d / v0; }
  stopX() { const r = this.rigBox(); return r ? r.frontBg + 16 : BW * 0.7; }

  // tests and the remote control
  state() { const L = this.legInfo; return { open: this.isOpen, phase: this.phase, leg: L ? L.i : null, time: L ? Math.round(L.time * 10) / 10 : null, T: L?.T ?? null, stop: L?.stop?.kind || null, hour: Math.round(this.st.hour * 100) / 100, wet: this.st.wet, dust: this.st.dust, rig: !!this.rig, v: Math.round(this.st.v), dist: Math.round(this.st.dist) }; }

  // ---------- frame ----------
  frame(now) {
    if (this.el.hidden) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.tick(dt);
    this.draw();
    this.raf = requestAnimationFrame(t => this.frame(t));
  }
  tick(dt) {
    const st = this.st, L = this.legInfo, C = this.C, hud = this.host.scene()?.hud;
    const fast = this.keys.size > 0 && !hud?.modal ? C.fast : 1;
    st.t += dt; st.dt = dt;
    if (this.fading < 0) { this.fade = Math.max(0, this.fade + this.fading * dt); if (this.fade <= 0) this.fading = 0; }
    if (this.phase === 'out') { this.fade = Math.min(1, this.fade + this.fading * dt); st.v *= 0.97; st.dist += st.v * dt; if (this.fade >= 1 && this.onOut) { const f = this.onOut; this.onOut = null; f(); } return; }
    if (!L) { st.v *= 0.95; st.dist += st.v * dt; return; }
    const T = L.T;
    if (this.phase === 'drive') L.time = Math.min(T, L.time + dt * fast);
    const tt = L.time, cruise = C.speed;
    // speed: starts from standing at the first leg, slows down to the incident, speeds up after it
    let v = cruise;
    if (L.i === 0 && tt < 2.5) v = cruise * ease(Math.min(1, 0.15 + tt / 2.5));
    if (L.stopT != null) {
      const ta = this.approach(), a0 = L.stopT - ta;
      if (!L.stopped) {
        if (tt >= a0) {
          if (!st.stop || st.stop.leg !== L.i) { st.stop = { kind: L.stop.kind, leg: L.i, x: BW + 10, cast: this.castOf(L.stop.figures || []) }; if (!L.said) { L.said = true; this.callout(L.stop.name); } }
          const k = Math.min(1, (tt - a0) / ta); v = cruise * (1 - k);
          if (tt >= L.stopT && this.phase === 'drive') { this.phase = 'stop'; v = 0; L.time = L.stopT; L.cb.atStop?.(); }
        }
      } else { const k = Math.min(1, (tt - L.resumeAt) / 2.2); v = cruise * ease(Math.max(0.08, k)); }
      if (this.phase === 'stop') v = 0;
    }
    st.v = v * (this.phase === 'drive' || this.phase === 'stop' ? fast : 1);
    if (this.phase === 'stop') st.v = 0;
    st.dist += st.v * dt;
    if (st.stop) st.stop.x -= st.v * dt;   // the incident stands still on the road
    if (st.stop && st.stop.x < -80) st.stop = null;
    // clock, sky, weather along the leg
    const f = tt / T;
    st.hour = L.h0 + (L.h1 - L.h0) * f + (L.shift || 0);
    st.land[2] = f;
    const D = this.D, save = this.host.scene()?.box?.save;
    const wetNow = save && rainingAt(D, save, st.hour) ? 1 : 0;
    st.wet += (wetNow - st.wet) * Math.min(1, dt * 0.8);
    const storm = L.stop?.kind === 'storm' ? (L.stopped ? Math.max(0, 1 - (tt - L.resumeAt) / 6) : Math.min(1, Math.max(0, (f - 0.35) / (C.stopAt - 0.35)))) : 0;
    st.dust += (Math.max(L.weather.dust, storm) - st.dust) * Math.min(1, dt * 1.5);
    st.fog += (L.weather.fog * (st.hour % 24 < 10 ? 1 : 0.2) - st.fog) * Math.min(1, dt);
    // lightning in the rain now and then
    st.flash = Math.max(0, st.flash - dt * 4);
    if (st.wet > 0.6 && Math.random() < dt * 0.12) { st.flash = 1; this.road.strike(); }
    if (this.phase === 'drive' && L.time >= T) { const cb = L.cb; this.legInfo = null; this.phase = 'idle'; cb.end?.(); }
  }
  // the people of an incident (Encounter › Figuren, else its Gegner): the enemy kits of the game, standing by the road, looking at the rig
  castOf(ids) {
    const s = this.host.scene();
    return ids.map(id => {
      const def = this.D.enemies?.[id]; if (!def?.kit || !s?.textures) return null;
      let look = null; try { look = kitLook(s, def); } catch { look = null; }
      const a = look && (look.anims.alert || look.anims.idle || Object.values(look.anims)[0]);
      if (!a || !s.textures.exists(a.key)) return null;
      return { img: s.textures.get(a.key).getSourceImage(), fw: look.frame[0], fh: look.frame[1], n: a.frames, fps: a.fps, scale: look.scale, ox: look.ox, oy: look.oy };
    }).filter(Boolean);
  }
  drawCast(ctx, W, S) {
    const c = this.st.stop?.cast; if (!c?.length) return;
    const b = this.rigBox(W, W * 9 / 16), u = W / BW, k = b ? b.k : 0.45, feet = (WHEEL_Y - 7) * u;
    this.castBuf ||= document.createElement('canvas');
    c.forEach((f, i) => {
      const h = f.fh * f.scale * k, w = f.fw * f.scale * k, x = (this.st.stop.x + 30 + i * 20) * u + (i % 2) * 5 * u, fr = Math.floor(this.st.t * f.fps + i * 3) % f.n;
      const B = this.castBuf; B.width = f.fw; B.height = f.fh; const x2 = B.getContext('2d');
      x2.clearRect(0, 0, f.fw, f.fh); x2.drawImage(f.img, fr * f.fw, 0, f.fw, f.fh, 0, 0, f.fw, f.fh);
      x2.globalCompositeOperation = 'source-atop';
      if (S.dark > 0.02) { x2.fillStyle = `rgba(14,12,40,${Math.min(0.7, S.dark * 0.75)})`; x2.fillRect(0, 0, f.fw, f.fh); }
      if (S.warm > 0.05) { x2.fillStyle = `rgba(${S.sun.col.join(',')},${0.18 * S.warm})`; x2.fillRect(0, 0, f.fw, f.fh); }
      x2.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.translate(x, feet); ctx.scale(-1, 1);   // facing the rig
      ctx.imageSmoothingEnabled = true; ctx.drawImage(B, -w * f.ox, -h * f.oy, w, h); ctx.restore();
    });
  }
  callout(name) { this.say = { text: `Da vorne: ${name}`, until: this.st.t + 3.5 }; }

  // ---------- the rig ----------
  // the picture of the rig once: wheels (where the tyres touch the bottom), the front for the headlights, the back for the tail lights
  prepareRig(r) {
    const c = r.img, x = c.getContext('2d', { willReadFrequently: true }), d = x.getImageData(0, 0, r.w, r.h).data, A = (i, y) => d[(y * r.w + i) * 4 + 3] > 40;
    const wheels = [], bottom = Math.min(r.h - 1, Math.round(r.ground) - 1);
    for (let i = 0; i < r.w;) {
      if (!A(i, bottom)) { i++; continue; }
      let j = i; while (j < r.w && A(j, bottom)) j++;
      const w = j - i; if (w >= 10) wheels.push({ x: (i + j) / 2, r: Math.min(r.h * 0.16, w * 0.95) });
      i = j;
    }
    const topAt = i => { for (let y = 0; y < r.h; y++) if (A(Math.max(0, Math.min(r.w - 1, i)), y)) return y; return r.h; };
    const frontTop = topAt(r.w - 6), backTop = topAt(4);
    return { ...r, wheels, lampY: r.ground - (r.ground - frontTop) * 0.36, tailY: r.ground - (r.ground - backTop) * 0.25, spin: 0 };
  }
  // where the rig sits on screen: right end at Reisen › Fahrt › Rig-Position, wheels on the road
  rigBox(W = this.canvas.width || 1920, H = this.canvas.height || 1080) {
    const r = this.rig; if (!r) return null;
    const u = W / BW, k = Math.min(H * this.C.rigHeight / r.h, W * 0.62 / r.w), x1 = W * this.C.rigX, y = WHEEL_Y * u;
    return { k, x0: x1 - r.w * k, x1, y, u, frontBg: x1 / u };
  }
  // the rig in the light of the hour: dark at night, warm at sunset, white in a flash (cached while the light stays the same)
  litRig(S) {
    const r = this.rig, key = [S.h.toFixed(1), Math.round(this.st.flash * 4), Math.round(this.st.wet * 4)].join();
    if (this.lit && this.litKey === key) return this.lit;
    const c = this.lit || Object.assign(document.createElement('canvas'), { width: r.w, height: r.h }), x = c.getContext('2d');
    x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, r.w, r.h); x.drawImage(r.img, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    if (S.warm > 0.05) { const sunLeft = S.sun.x < 0.6, g = x.createLinearGradient(sunLeft ? 0 : r.w, 0, sunLeft ? r.w : 0, 0); g.addColorStop(0, `rgba(${S.sun.col.join(',')},${0.32 * S.warm})`); g.addColorStop(1, `rgba(${S.sun.col.join(',')},${0.08 * S.warm})`); x.fillStyle = g; x.fillRect(0, 0, r.w, r.h); }
    if (S.dark > 0.02) { x.fillStyle = `rgba(14,12,40,${Math.min(0.72, S.dark * 0.78)})`; x.fillRect(0, 0, r.w, r.h); }
    if (this.st.wet > 0.1) { x.fillStyle = `rgba(40,44,70,${0.18 * this.st.wet})`; x.fillRect(0, 0, r.w, r.h); }
    if (this.st.flash > 0.1) { x.fillStyle = `rgba(230,225,255,${0.5 * this.st.flash})`; x.fillRect(0, 0, r.w, r.h); }
    this.lit = c; this.litKey = key;
    return c;
  }
  drawRig(ctx, W, H, S) {
    const r = this.rig, b = this.rigBox(W, H); if (!r || !b) return null;
    const st = this.st, img = this.litRig(S), C = this.C, run = Math.min(1, st.v / Math.max(1, C.speed));
    // shadow on the road
    ctx.fillStyle = `rgba(8,6,14,${0.35 * (1 - S.dark * 0.5)})`; ctx.beginPath(); ctx.ellipse((b.x0 + b.x1) / 2, b.y + 2 * b.u * 0.4, (b.x1 - b.x0) * 0.52, 3.2 * b.u, 0, 0, Math.PI * 2); ctx.fill();
    // every unit sways on its own springs, the trailers a little after the van
    const cuts = [0, ...r.cuts, r.w], amp = C.bounce * (W / 1920) * (0.25 + 0.75 * run);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';   // the rig's art is scaled down smooth, like in the camp (pixelArt off)
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], z = cuts[i + 1], lag = (cuts.length - 2 - i) * 0.35;
      const bump = Math.max(0, Math.sin((st.dist / 37) - lag * 3) * Math.sin(st.dist / 91 + i)) ** 6 * 2.2;
      const dy = Math.round((Math.sin(st.t * 9.5 - lag * 2.4 + i) * 0.5 + Math.sin(st.t * 3.1 - lag) * 0.5 - bump) * amp);
      ctx.drawImage(img, a, 0, z - a, r.h, Math.round(b.x0 + a * b.k), Math.round(b.y - r.ground * b.k + dy), Math.ceil((z - a) * b.k), Math.round(r.h * b.k));
    }
    // wheels turn: spokes over the hubs, faster with the speed
    r.spin += st.v * st.dt / 6;
    ctx.save();
    for (const w of r.wheels) {
      const cx = b.x0 + w.x * b.k, cy = b.y - w.r * b.k, R = w.r * b.k * 0.55;
      ctx.strokeStyle = `rgba(14,12,22,${0.35 + 0.2 * run})`; ctx.lineWidth = Math.max(1.5, R * 0.16);
      ctx.beginPath(); for (let j = 0; j < 4; j++) { const a = r.spin / Math.max(4, w.r * b.k * 0.05) + j * Math.PI / 2; ctx.moveTo(cx + Math.cos(a) * R * 0.25, cy + Math.sin(a) * R * 0.25); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); } ctx.stroke();
      if (run > 0.4) { ctx.strokeStyle = `rgba(160,150,170,${0.12 * run})`; ctx.lineWidth = Math.max(1, R * 0.1); ctx.beginPath(); ctx.arc(cx, cy, w.r * b.k * 0.85, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.restore();
    // dust from the wheels (dry), spray (wet)
    this.puffs ||= [];
    if (st.v > 10) for (const w of r.wheels) if (Math.random() < st.dt * 14 * run) this.puffs.push({ x: b.x0 + w.x * b.k - w.r * b.k * 0.6, y: b.y - 4, vx: -(40 + Math.random() * 60) * b.u * 0.3, vy: -(10 + Math.random() * 25) * b.u * 0.2, life: 0, max: 0.8 + Math.random() * 0.8, s: (2 + Math.random() * 3) * b.u * 0.5 });
    const dustCol = this.st.wet > 0.4 ? '200,210,235' : '219,164,99';
    for (const p of this.puffs) { p.life += st.dt; p.x += (p.vx - st.v * b.u * 0.5) * st.dt; p.y += p.vy * st.dt; p.vy *= 0.97; const a = Math.max(0, 1 - p.life / p.max) * (0.35 - S.dark * 0.2); ctx.fillStyle = `rgba(${dustCol},${a})`; const sz = p.s * (1 + p.life * 2); ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz); }
    this.puffs = this.puffs.filter(p => p.life < p.max);
    // the breakdown: steam from the engine while slowing down and standing
    const L = this.legInfo;
    if ((L?.stop?.kind === 'breakdown' && this.st.stop) || this.steam > 0) {
      this.steam = this.phase === 'stop' || (this.st.stop && !L?.stopped) ? 1 : Math.max(0, (this.steam || 0) - st.dt * 0.4);
      (this.steamP ||= []);
      if (Math.random() < st.dt * 22 * this.steam) this.steamP.push({ x: b.x1 - (40 + Math.random() * 30) * b.k, y: b.y - (r.ground - r.lampY) * b.k * 1.5, vx: (Math.random() - 0.4) * 20 * b.u, vy: -(18 + Math.random() * 14) * b.u, life: 0 });
      for (const p of this.steamP) { p.life += st.dt; p.x += (p.vx - st.v * b.u * 0.5) * st.dt; p.y += p.vy * st.dt; p.vy *= 0.985; const sz = (2 + p.life * 9) * b.u; ctx.fillStyle = `rgba(225,225,235,${Math.max(0, 0.22 * (1 - p.life / 1.6))})`; ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill(); }
      this.steamP = this.steamP.filter(p => p.life < 1.6);
    }
    return { front: b.x1 - 2 * b.k, lampY: b.y - (r.ground - r.lampY) * b.k, back: b.x0 + 3 * b.k, tailY: b.y - (r.ground - r.tailY) * b.k };
  }

  // ---------- drawing ----------
  draw() {
    if (this.el.hidden || !this.road) return;
    // one canvas pixel per screen pixel (Daniel, 18.11.2026: „unscharf und verwaschen“: the canvas was 1.5 × the window and the browser
    // stretched it soft onto Retina/4K screens); the background pixels are scaled up sharp in here, nothing is stretched afterwards
    const c = this.canvas, box = c.getBoundingClientRect(), dpr = Math.min(3, devicePixelRatio || 1), W = Math.min(3840, Math.round((box.width || innerWidth) * dpr)), H = Math.round(W * 9 / 16);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext('2d'), st = this.st, S = skyAt(st.hour);
    this.road.draw(this.bg.getContext('2d'), st);
    ctx.imageSmoothingEnabled = false;
    // heat haze at noon: the rows just over the horizon wobble a little (Reisen › Fahrt › Hitzeflimmern)
    const haze = this.C.haze * Math.max(0, Math.sin(Math.PI * ((st.hour % 24) - 9) / 8)) * (1 - st.wet) * (S.dark < 0.1 ? 1 : 0);
    if (haze > 0.05) {
      const u = W / BW;
      ctx.drawImage(this.bg, 0, 0, BW, 120, 0, 0, W, 120 * u);
      for (let y = 120; y < 172; y++) { const o = Math.sin(st.t * 6 + y * 0.9) * haze * 1.2 * (1 - Math.abs(y - 150) / 26); ctx.drawImage(this.bg, 0, y, BW, 1, Math.round(o * u), y * u, W, Math.ceil(u)); }
      ctx.drawImage(this.bg, 0, 172, BW, BH - 172, 0, 172 * u, W, (BH - 172) * u);
    } else ctx.drawImage(this.bg, 0, 0, W, H);
    this.road.ads(ctx, W, H, st);   // #055 giant screens of the brands
    this.drawCast(ctx, W, S);
    const lamps = this.drawRig(ctx, W, H, S);
    this.road.light(ctx, W, H, st, lamps);
    this.road.front(ctx, W, H, st);
    if (this.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${this.fade})`; ctx.fillRect(0, 0, W, H); }
    this.drawHud(S);
  }
  drawHud() {
    const L = this.legInfo || this.lastLeg, T = this.trip;
    if (this.legInfo) this.lastLeg = this.legInfo;
    if (!L || !T) return;
    const h = this.st.hour, day = Math.floor(h / 24), hh = Math.floor(h % 24), mm = Math.floor((h % 1) * 60);
    const f = Math.min(1, L.time / L.T), fuel = L.fuel0 + (L.fuel1 - L.fuel0) * f, total = ((L.i + f) / Math.max(1, T.legs)) * 100;
    const key = [L.i, hh, mm, Math.round(fuel * 10), Math.round(total), this.say && this.say.until > this.st.t ? this.say.text : '', this.phase].join('|');
    if (key === this.hudKey) return;
    this.hudKey = key;
    const dots = Array.from({ length: T.legs + 1 }, (_, i) => el('i', { class: 'dv-dot' + (i <= L.i ? ' done' : ''), style: `left:${(i / Math.max(1, T.legs)) * 100}%` }));
    this.hud.replaceChildren(
      el('div', { class: 'dv-top' },
        el('div', { class: 'dv-where' }, icon('map', 18), el('b', {}, T.from), el('span', {}, ' → '), el('b', {}, T.to),
          T.legs > 1 ? el('small', {}, `Etappe ${L.i + 1} von ${T.legs} · kurz vor ${L.toName}`) : null),
        el('div', { class: 'dv-stats' }, el('span', {}, icon('clock', 16), ` Tag ${day} · ${two(hh)}:${two(mm)}`), el('span', {}, icon('drop', 16), ` ${fuel.toFixed(1).replace('.', ',')} l`))),
      this.say && this.say.until > this.st.t ? el('div', { class: 'dv-say' }, icon('warning', 18), this.say.text) : null,
      el('div', { class: 'dv-bottom' },
        el('div', { class: 'dv-track' }, el('div', { class: 'dv-fill', style: `width:${total}%` }), ...dots, el('span', { class: 'dv-van', style: `left:${total}%` }, icon('vehicle', 16))),
        this.phase === 'stop' ? null : hints([['ok', 'vorspulen (halten)'], ['back', 'überspringen']])));
  }
  image(file) {
    if (!file) return null;
    this.imgs ||= {};
    if (!this.imgs[file]) { const i = new Image(); i.src = new URL(file, this.host.scene().base).href; this.imgs[file] = i; }
    const i = this.imgs[file]; return i.complete && i.naturalWidth ? i : null;
  }
}
