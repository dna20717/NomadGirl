// #115 Billboard-Scan (Daniel 19.11.2026: „Billboards nicht mehr fotografieren, sondern AvA scannen. Man kann sie bewegen (Gummiband)“;
// Wahl: „AvA am Gummiband“). AvA hovers over the van on an elastic cable. Grab her (mouse/touch) and pull her over a billboard's
// screen, or hold R / X: she pulls herself towards the billboard in view and you keep her on it. While she is over the screen a ring
// fills (Reisen › Fahrt › Influencer: Scan-Dauer); staying on gives „Perfekt“, slipping off once „Gut“, more often „Knapp“. Let go and
// she snaps back. One scan per billboard and leg; the reward is the old photo's (brand_perks.js becomeInfluencer). Mixed into DriveUI.
import { BW } from '../road.js';
import { becomeInfluencer, influencerConfig } from '../brand_perks.js';

const GRADES = { perfect: 'Perfekter Scan', good: 'Guter Scan', edge: 'Knapper Scan' };

export class DriveScan {
  // where AvA rests: over the van's cab
  avaHome(W, H) { const b = this.rigBox(W, H); return b ? { x: b.x1 - (this.C.avaAt ?? 0.18) * (b.x1 - b.x0), y: b.y - (b.y - H * 0.22) * 0.72 } : { x: W * 0.6, y: H * 0.45 }; }
  scanStep(dt, W, H) {
    const home = this.avaHome(W, H), A = (this.ava ||= { x: home.x, y: home.y, vx: 0, vy: 0, held: false, p: 0, slips: 0, on: false, ci: null });
    const I = influencerConfig(this.D), u = W / BW, rope = (this.C.avaRope ?? 46) / 100 * W;
    const sc = this.phase === 'drive' ? this.visibleAd() : null, open = sc && !this.shotAt(sc);
    // where she wants to be: the pointer while held, the billboard while R / X is held, else home
    let tx = home.x, ty = home.y;
    if (A.held && A.ptr) { tx = A.ptr.x; ty = A.ptr.y; }
    else if (this.keys.has('scan') && open) { tx = (sc.x + sc.w / 2) * u + Math.sin(this.st.t * 2.3) * sc.w * u * 0.32; ty = (sc.y + sc.h / 2) * u; }
    // the rubber band: beyond its length it pulls back hard
    const dx = tx - home.x, dy = ty - home.y, d = Math.hypot(dx, dy);
    if (d > rope) { tx = home.x + dx / d * rope; ty = home.y + dy / d * rope; }
    const k = A.held ? 60 : 26, damp = A.held ? 11 : 7;
    A.vx += ((tx - A.x) * k - A.vx * damp) * dt; A.vy += ((ty - A.y) * k - A.vy * damp) * dt;
    A.x += A.vx * dt; A.y += A.vy * dt;
    // scanning: over the screen of the billboard in view
    if (A.ci != null && (!sc || sc.ci !== A.ci)) this.scanLost();
    if (!open) { A.on = false; return; }
    const over = A.x > sc.x * u && A.x < (sc.x + sc.w) * u && A.y > (sc.y - 4) * u && A.y < (sc.y + sc.h + 4) * u;
    if (over && A.ci !== sc.ci) { A.ci = sc.ci; A.p = 0; A.slips = 0; }
    if (A.ci === sc.ci) {
      if (over) A.p = Math.min(1, A.p + dt / Math.max(0.3, (I.scan ?? 1.4)));
      else { if (A.on) A.slips++; A.p = Math.max(0, A.p - dt * 0.35); }
      A.on = over;
      if (A.p >= 1) this.scanDone(sc, A.slips === 0 ? 'perfect' : A.slips === 1 ? 'good' : 'edge');
    }
  }
  // the billboard rolled out of view during a scan: more than 60 % still counts as a close one
  scanLost() { const A = this.ava; if (A.p > 0.6 && A.sc) this.scanDone(A.sc, 'edge'); A.ci = null; A.p = 0; A.slips = 0; A.on = false; }
  scanDone(sc, grade) {
    const s = this.host.scene(), save = s?.box?.save, D = this.D, I = influencerConfig(D), A = this.ava;
    (this.shots ??= new Set()).add(sc.ci);
    A.ci = null; A.p = 0; A.held = false; A.on = false;
    this.ping = { sc, t: 0, miss: false };
    if (!save || !sc.brand?.id) return;
    const r = becomeInfluencer(D, save, sc.brand.id, grade === 'perfect' ? I.perfect / 100 : grade === 'edge' ? I.edge / 100 : 1);
    if (!r) return;
    s.hud.toast(`${GRADES[grade]} · Influencer: ${r.name}`, `${r.renewed ? 'Verlängert' : 'AvA hat es geteilt'}: ${r.discount} % Nachlass auf ${r.name} für ${r.hours} h`, 'good', 4200);
    s.box.persist?.();
  }
  // pointer: grabbing AvA (near her, or anywhere while a billboard is in view) starts the pull; → handled
  scanGrab(e) {
    if (this.phase !== 'drive') return false;
    const p = this.canvasPoint(e), A = this.ava; if (!A) return false;
    const sc = this.visibleAd(), near = Math.hypot(p.x - A.x, p.y - A.y) < (this.canvas.width / BW) * 26;
    if (!near && !(sc && !this.shotAt(sc))) return false;
    A.held = true; A.ptr = p;
    return true;
  }
  scanMove(e) { if (this.ava?.held) this.ava.ptr = this.canvasPoint(e); }
  scanRelease() { if (this.ava) this.ava.held = false; }
  canvasPoint(e) { const c = this.canvas, r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / (r.width || 1), y: (e.clientY - r.top) * c.height / (r.height || 1) }; }
  // AvA, her rubber band to the van, the scan beam and the ring
  drawAva(ctx, W, H, S) {
    const A = this.ava; if (!A || this.phase === 'stop') return;
    const D = this.D, u = W / BW, home = this.avaHome(W, H), hull = this.image(D.assets?.[D.drone?.look]?.file), rope = Math.hypot(A.x - home.x, A.y - home.y);
    const tense = Math.min(1, rope / ((this.C.avaRope ?? 46) / 100 * W));
    // the band: from the van roof, thinner and redder the more it stretches, sagging when slack
    const b = this.rigBox(W, H), ax = home.x, ay = b ? home.y + (b.y - home.y) * 0.55 : home.y + 40 * u, mx = (ax + A.x) / 2, my = (ay + A.y) / 2 + (1 - tense) * 26 * u;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = `rgb(${Math.round(40 + 200 * tense)},${Math.round(200 - 110 * tense)},${Math.round(210 - 120 * tense)})`; ctx.lineWidth = Math.max(1.5, (3.2 - 1.8 * tense) * u / 2.5);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, A.x, A.y); ctx.stroke();
    const sc = this.phase === 'drive' && this.visibleAd();
    if (sc && A.ci === sc.ci && A.on) {   // the beam onto the screen
      ctx.fillStyle = `rgba(63,224,208,${0.18 + 0.1 * Math.sin(this.st.t * 20)})`;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(sc.x * u, (sc.y + sc.h) * u); ctx.lineTo((sc.x + sc.w) * u, (sc.y + sc.h) * u); ctx.closePath(); ctx.fill();
    }
    const k = (this.C.avaSize ?? 0.42) * u;
    if (hull) { const a = D.assets[D.drone.look], [ox, oy] = a.origin || [hull.width / 2, hull.height / 2]; ctx.imageSmoothingEnabled = false; ctx.drawImage(hull, A.x - ox * k, A.y - oy * k, hull.width * k, hull.height * k); }
    else { ctx.fillStyle = '#bc4a9b'; ctx.beginPath(); ctx.arc(A.x, A.y, 10 * u, 0, Math.PI * 2); ctx.fill(); }
    if (A.p > 0) {   // the ring
      ctx.strokeStyle = 'rgba(20,16,19,0.7)'; ctx.lineWidth = 5 * u / 2; ctx.beginPath(); ctx.arc(A.x, A.y, 22 * u, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = A.slips ? (A.slips > 1 ? '#ffb070' : '#ffe8a0') : '#7dffb0'; ctx.lineWidth = 4 * u / 2;
      ctx.beginPath(); ctx.arc(A.x, A.y, 22 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * A.p); ctx.stroke();
    }
    ctx.restore();
  }
}
