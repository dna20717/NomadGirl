// The camp's life (#017 split from camp.js): wind and fire sound, the companions, their jobs (Questlog).
// Mixed into Camp (game/play/camp.js): the methods keep their `this`, nothing else changes.
import { unlocked } from '../unlocks.js';   // #184
import { nowPlayingFor } from '../now_playing.js';
import { offers, accept, claim, progressOf, qstate } from '../quests.js';
import { figureTexture } from './camp.js';
import { noteTexture } from './camp_board.js';
import { traderOf, traderConfig, advanceConfig, advanceTiers, takeAdvance, debtOf, repay } from '../trade.js';   // #182

export class CampLife {
  // ---------- sound: soft wind with gusts, the fire gets louder (and moves left/right) the closer Leyla comes ----------
  startSound() {
    const s = this.scene, S = this.C.sound || {}, vol = id => (this.D.assets?.[id]?.volume ?? 100) / 100;
    const play = (id, v, loop) => s.cache.audio.exists(id) ? s.sound.add(id, { loop, volume: v }) : null;
    this.wind = S.wind && play(S.wind, (S.windVolume ?? 20) / 100 * vol(S.wind), true);
    this.fireSound = S.fire && play(S.fire, 0, true);
    this.fireBase = vol(S.fire);
    this.wind?.play(); this.fireSound?.play();
    if (this.fireSound) this.fireSound.setSeek?.(Math.random() * 20);   // not always the same crackle
    this.gustAt = s.time.now + this.gustDelay();
    this.startMusic();
  }
  // Leyla Theme, quiet in the background (Camp › Ton › Musik); loaded lazily so the camp is not slower to open
  startMusic() {
    const s = this.scene, S = this.C.sound || {}, id = S.music, A = id && this.D.assets?.[id];
    if (!A?.file || !(S.musicVolume ?? 15)) return;
    const play = () => {
      if (s.camp !== this || this.music || !s.cache.audio.exists(id)) return;   // the scene may have moved on (run, new camp) while loading
      this.musicTarget = (S.musicVolume ?? 15) / 100 * ((A.volume ?? 100) / 100);
      this.musicAt = s.time.now;
      this.music = s.sound.add(id, { loop: true, volume: 0 });
      this.music.play({ loop: true, volume: 0 });
      this.music.setVolume(0);   // fades in through updateSound
      // #117 the cassette; #129 after the welcome (the arrival belongs to the camp, the music comes a breath later)
      s.time.delayedCall(S.cassetteDelay ?? 4500, () => { if (s.camp === this && this.music) nowPlayingFor(this.D.assets, id, s.base || location.href); });
    };
    if (s.cache.audio.exists(id)) return play();
    const base = s.base || location.href;
    s.load.audio(id, [new URL(A.file, base).href, ...(A.alt ? [new URL(A.alt, base).href] : [])]);
    s.load.once('filecomplete-audio-' + id, play);
    s.load.start();
  }
  cam() { return this.scene.cam || this.scene.cameras.main; }
  // #107 Kleinvieh: now and then an animal (Camp › Kleinvieh, the fennec) runs across the camp ground, from one edge of the view to the
  // other; in the evening more often. The animation looks to the right, to the left it is flipped.
  updateCritters(time, dt) {
    const s = this.scene, list = (this.C.critters || []).filter(c => c.look && s.textures.exists(c.look));
    if (!list.length) return;
    const night = this.lightK > 0.3;
    if (!this.critter && time >= (this.critterAt ??= time + 4000)) {
      const c = list[Math.floor(Math.random() * list.length)], info = s.assetInfo(c.look), v = this.cam().worldView;
      if (info) {
        const dir = Math.random() < 0.5 ? 1 : -1, x = dir > 0 ? v.x - 80 : v.right + 80;
        const sp = s.add.sprite(x, this.campY, info.key).setOrigin(info.ox, info.oy).setScale(info.scale).setDepth(6).setFlipX(dir < 0);
        if (info.anim) sp.play(info.anim);
        // with idles (Camp › Kleinvieh › Idles): stop once somewhere in the middle third of the view, play one, run on
        const idles = String(c.idles || '').split(',').map(x => x.trim()).filter(id => s.textures.exists(id));
        const stopAt = idles.length && Math.random() < (c.stopChance ?? 75) / 100 ? v.x + v.width * (0.3 + Math.random() * 0.4) : null;
        this.critter = { sp, dir, info, idles, stopAt, run: info.anim, speed: (c.speed || 380) * (0.85 + Math.random() * 0.3), until: dir > 0 ? v.right + 120 : v.x - 120 };
      }
      const [a, b] = Array.isArray(list[0].every) ? list[0].every : [40, 90], k = night ? Math.max(1, list[0].night || 2) : 1;
      this.critterAt = time + (a + Math.random() * Math.max(0, b - a)) * 1000 / k;
    }
    const C = this.critter;
    if (C?.idleUntil) {   // #107 standing still: one idle animation (or twice), then on
      if (time < C.idleUntil) return;
      C.idleUntil = null; C.sp.setTexture(C.info.key).setOrigin(C.info.ox, C.info.oy).setScale(C.info.scale); if (C.run) C.sp.play(C.run);
    }
    if (C && C.stopAt != null && ((C.dir > 0 && C.sp.x >= C.stopAt) || (C.dir < 0 && C.sp.x <= C.stopAt))) {
      C.stopAt = null;
      const id = C.idles[Math.floor(Math.random() * C.idles.length)], I = s.assetInfo(id), A = this.D.assets[id];
      if (I?.anim) { C.sp.setTexture(I.key).setOrigin(I.ox, I.oy).setScale(I.scale); C.sp.play(I.anim); const loops = 1 + Math.floor(Math.random() * 2); C.idleUntil = time + loops * 1000 * (A.frames || 8) / (A.fps || 8); return; }
    }
    if (C) {
      C.sp.x += C.dir * C.speed * dt / 1000;
      if ((C.dir > 0 && C.sp.x > C.until) || (C.dir < 0 && C.sp.x < C.until)) { C.sp.destroy(); this.critter = null; }
    }
  }
  gustDelay() { const [a, b] = this.C.sound?.gustEvery || [9, 22]; return (a + Math.random() * (b - a)) * 1000; }
  updateSound(time) {
    const s = this.scene, S = this.C.sound || {}, l = s.leyla;
    if (this.music) {
      const k = Math.min(1, (time - this.musicAt) / Math.max(1, (S.musicFadeIn ?? 4) * 1000));
      this.radioK = Math.max(0, Math.min(1, (this.radioK ?? 1) + (s.hud.radio?.playing || s.hud.drive?.musicOn ? -0.02 : 0.01)));   // #090 the radio takes over, the theme fades
      this.music.setVolume(this.musicTarget * k * k * this.radioK);
    }
    if (this.fireSound) {
      const d = Math.abs(l.x - this.geo.fireX), near = S.fireNear ?? 120, range = S.fireRange ?? 1100;
      const k = Math.max(0, Math.min(1, 1 - (d - near) / Math.max(1, range - near)));
      const v = ((S.fireMin ?? 4) + ((S.fireVolume ?? 90) - (S.fireMin ?? 4)) * k * k) / 100 * this.fireBase;
      this.fireSound.setVolume(v);
      this.fireVolume = v;
      if (this.fireSound.setPan) this.fireSound.setPan(Math.max(-0.7, Math.min(0.7, (this.geo.fireX - l.x) / 900)));
    }
    // gaming at the fire: little retro blips from the handheld, chained at random, quiet and far away (Camp › Am Feuer sitzen › Töne)
    const sit = l.state === 'sit' && l.sit, F = this.C.fire?.sit || {}, list = (F.sounds || []).filter(id => s.cache.audio.exists(id));
    const gaming = sit && !sit.up && time - sit.at > (F.downTo ?? 6) * 1000 / (F.fps || 5) && list.length;
    if (!gaming) this.blipAt = 0;
    else if (!this.blipAt) this.blipAt = time + 300;
    else if (time > this.blipAt) {
      const id = list[Math.floor(Math.random() * list.length)], [g0, g1] = F.soundGap || [120, 650];
      const snd = s.sound.add(id, { volume: (F.soundVolume ?? 12) / 100 * (0.7 + Math.random() * 0.3) * ((this.D.assets?.[id]?.volume ?? 100) / 100), detune: (Math.random() - 0.5) * 200 });
      if (snd.setPan) snd.setPan(Math.max(-0.5, Math.min(0.5, (l.x - this.cam().midPoint.x) / 1500)));
      snd.once('complete', () => snd.destroy());
      snd.play();
      const len = (snd.duration || 0.3) * 1000;
      this.blipAt = time + len + g0 + Math.random() * (g1 - g0) + (Math.random() * 100 < (F.soundPause ?? 18) ? 1200 + Math.random() * 1800 : 0);   // now and then a longer pause
    }
    if (time > this.gustAt && (S.gusts || []).length) {
      const id = S.gusts[Math.floor(Math.random() * S.gusts.length)];
      if (s.cache.audio.exists(id)) s.sound.play(id, { volume: (S.gustVolume ?? 14) / 100 * ((this.D.assets?.[id]?.volume ?? 100) / 100) * (0.6 + Math.random() * 0.4) });
      this.gustAt = time + this.gustDelay();
    }
  }

  // ---------- companions ----------
  placeCompanions() {
    const s = this.scene, D = this.D, ids = this.box.save.companions || [], [a, b] = this.geo.companionX;
    this.companions = ids.map((id, i) => {
      const def = D.companions?.[id] || {}, x = ids.length > 1 ? a + (b - a) * i / (ids.length - 1) : (a + b) / 2;
      const info = def.look && s.assetInfo(def.look);
      const h = def.height ?? 170;
      const sprite = info ? s.add.sprite(x, (this.campY ?? this.ground), info.key).setOrigin(info.ox, info.oy).setScale(info.scale) : s.add.image(x, (this.campY ?? this.ground), figureTexture(s, 'comp_' + id, def.color, def.role)).setOrigin(0.5, 1).setScale(h / 75);
      if (info?.anim) sprite.play(info.anim);
      sprite.setDepth(-3).setFlipX(x > this.geo.fireX);
      const bubble = s.add.text(x, (this.campY ?? this.ground) - h - 16, '', { fontFamily: 'VT323, monospace', fontSize: '30px', color: '#17111f', backgroundColor: '#f2eef7', padding: { x: 10, y: 4 }, wordWrap: { width: 420 }, align: 'center' }).setOrigin(0.5, 1).setDepth(25).setAlpha(0);
      // #017: a mark over the head when they have a job for Leyla; #025: a little pinned note (gold pin = offer, green stamp = hand in)
      const mark = s.add.image(x, (this.campY ?? this.ground) - h - 14, noteTexture(s, 'offer')).setOrigin(0.5, 1).setDepth(24).setVisible(false);
      s.tweens.add({ targets: mark, y: mark.y - 10, angle: { from: -6, to: 6 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const c = { id, def, x, sprite, bubble, mark, h, until: 0, last: -1 };
      const spot = { x, w: 70, floor: this.geo.campFloor != null ? this.campY : undefined, name: def.name || id, hint: 'Reden', act: () => this.talk(c) };
      c.spot = spot;
      this.hotspots.push(spot);
      return c;
    });
    this.questMarks();
  }
  // #183 someone joined (Lucky at the fire): the figures again, all spread over the place
  replaceCompanions() {
    for (const c of this.companions || []) { c.sprite.destroy(); c.bubble.destroy(); c.mark.destroy(); const i = this.hotspots.indexOf(c.spot); if (i >= 0) this.hotspots.splice(i, 1); }
    this.placeCompanions();
  }
  // ---------- companions with jobs (#017, Questlog) ----------
  jobsOf(c) {
    const D = this.D, save = this.box.save, Q = qstate(save);
    const offer = offers(D, save).filter(id => D.quests[id].giver === c.id);
    const active = Object.keys(Q.active).filter(id => D.quests?.[id]?.giver === c.id);
    return { offer, ready: active.filter(id => progressOf(D, save, id).ready), active: active.filter(id => !progressOf(D, save, id).ready) };
  }
  questMarks() {
    for (const c of this.companions || []) {
      const J = this.jobsOf(c), kind = J.ready.length ? 'ready' : J.offer.length ? 'offer' : null;
      c.mark.setVisible(!!kind);
      if (kind) c.mark.setTexture(noteTexture(this.scene, kind));
      c.markKind = kind;
      c.spot.hint = J.ready.length ? 'Reden · Auftrag abgeben' : J.offer.length ? 'Reden · neuer Auftrag' : 'Reden';
    }
  }
  say(c, text) { c.bubble.setText(text).setAlpha(1); c.until = this.scene.time.now + Math.max(4000, text.length * 70); this.babble(c, text); }
  // #112 Gebrabbel: the bubble speaks, quieter the further Leyla is
  babble(c, text) { this.scene.hud?.voice?.()?.bubble(text, { id: c.id, name: c.def?.name || c.id, voice: c.def?.voice }, c.x ?? c.sprite?.x); }
  // #025: a conversation in the dialogue box (name plate, colour, room for a portrait later), not a plain menu
  talk(c) {
    const D = this.D, save = this.box.save, s = this.scene, J = this.jobsOf(c), who = this.talkOf(c.id);
    const tid = unlocked(D, save, D.traders?.[traderOf(D, c.id)]?.unlock || 'trade') ? traderOf(D, c.id) : null, A = advanceConfig(D), lends = A.on && A.lender === c.id && unlocked(D, save, 'advance');   // #182 Händler, Vorschuss; #184 erst frei
    if (!J.offer.length && !J.ready.length && !J.active.length && !tid && !lends) return this.bark(c, true);
    const rew = q => { const R = q.reward || {}; return [R.reveal ? 'Ein Ort auf der Karte' : null, R.deltas ? `${R.deltas} Δ` : null, ...(R.items || []).map(x => `${x.count || 1}× ${D.items?.[x.item]?.name || x.item}`)].filter(Boolean).join(' · '); };
    const items = [
      ...J.ready.map(id => ({ label: `Abgeben: ${D.quests[id].name}`, sub: rew(D.quests[id]), primary: true, icon: 'check', act: () => {
        this.claimOne(id);   // the giver thanks in the speech bubble
      } })),
      ...J.offer.map(id => ({ label: `Auftrag: ${D.quests[id].name}`, sub: 'Neu', primary: !J.ready.length, icon: 'sign', act: () => {
        const q = D.quests[id], R = rew(q);
        s.hud.menu({ title: q.name, sub: q.text || '', talk: { ...who, note: 'offer' }, items: [
          { label: 'Annehmen', sub: R ? `Belohnung: ${R}` : '', primary: true, icon: 'check', act: () => { accept(D, save, id); s.hud.toast(`Auftrag angenommen: ${q.name}`, `${who.name} · steht im Questlog`, 'info'); this.jobsChanged(); this.say(c, 'Gut. Ich verlass mich auf dich.'); } },
          { label: 'Später', icon: 'clock', act: () => this.say(c, 'Überleg es dir.') }] });
      } })),
      ...J.active.map(id => ({ label: `Wie läuft „${D.quests[id].name}“?`, sub: `${progressOf(D, save, id).n} / ${progressOf(D, save, id).target}`, icon: 'help', act: () => { const p = progressOf(D, save, id); this.say(c, p.missing?.length ? `${p.n} von ${p.target}. Es fehlt noch: ${p.missing.map(x => D.items?.[x]?.name || x).join(', ')}.` : p.n ? `${p.n} von ${p.target}. Weiter so.` : 'Noch nichts? Ich warte.'); } })),
      ...(tid ? [{ label: 'Handeln', sub: traderConfig(D, tid).name, icon: 'coins', primary: !J.ready.length && !J.offer.length, act: () => setTimeout(() => s.hud.trade?.open(tid), 0) }] : []),
      ...(lends ? [this.advanceItem(c, who, !J.ready.length && !J.offer.length && !tid)] : []),
      { label: 'Plaudern', icon: 'speechBubble', act: () => this.bark(c, true) },
      { label: 'Tschüss', icon: 'x', act: () => {} }];
    const greet = (J.ready.length ? 'Na? Sieht aus, als hättest du was für mich.' : J.offer.length ? 'Gut, dass du kommst. Ich hab da was.' : tid ? 'Was brauchst du? Oder was willst du loswerden?' : 'Und, wie läuft es da draußen?');
    s.hud.menu({ title: who.name, sub: greet, items, talk: who });
  }
  // #182 Vorschuss (Daniel 23.11.2026, FB-2): without interest and deadline; a share of every run's payout goes back until it is paid
  advanceItem(c, who, primary) {
    const D = this.D, save = this.box.save, s = this.scene, A = advanceConfig(D), debt = debtOf(save);
    const done = text => { this.box.persist?.(); s.hud.campKey = null; this.say(c, text); };
    const open = () => {
      const d = debtOf(save), back = d ? Math.min(d.amount, save.deltas || 0) : 0;
      s.hud.menu({ title: 'Vorschuss', sub: d ? `Offen: ${d.amount} Δ von ${d.taken} Δ. ${A.share} % jeder Run-Auszahlung gehen an ${who.name}, bis alles bezahlt ist.` : (D.economy?.advance?.offer || `Ohne Zinsen. ${A.share} % jeder Run-Auszahlung gehen zurück, bis alles bezahlt ist.`), talk: who, items: [
        ...(d ? [{ label: back ? `Jetzt zurückzahlen: ${back} Δ` : 'Jetzt zurückzahlen', sub: back ? (back < d.amount ? `Danach noch ${d.amount - back} Δ offen` : 'Damit ist alles bezahlt') : 'Du hast gerade keine Δ', disabled: !back, primary: !!back, icon: 'coins',
          act: () => { const r = repay(D, save, back); if (r.ok) { s.hud.toast(r.done ? 'Vorschuss abbezahlt' : `${r.n} Δ zurückgezahlt`, r.done ? `${who.name} ist zufrieden` : `Noch ${r.left} Δ offen`, 'good'); done(r.done ? 'Quitt. Siehst du, so einfach geht das.' : 'Danke. Der Rest läuft über die Runs.'); } } }] : []),
        ...advanceTiers(D, save).map(t => ({ label: `${t.amount} Δ leihen`, sub: t.ok ? `Zurück: ${A.share} % jeder Run-Auszahlung` : t.reason, disabled: !t.ok, icon: 'coins',
          act: () => { const r = takeAdvance(D, save, t.amount); if (r.ok) { s.hud.toast(`Vorschuss: +${t.amount} Δ`, `${A.share} % jeder Run-Auszahlung gehen an ${who.name}`, 'info', 5000); done('Hier. Und jetzt geh und bring was Anständiges mit.'); } } })),
        { label: 'Lieber nicht', icon: 'x', act: () => {} }] });
    };
    return { label: debt ? `Vorschuss: noch ${debt.amount} Δ offen` : 'Vorschuss', sub: debt ? 'Zurückzahlen' : 'Δ leihen, ohne Zinsen', icon: 'coins', primary, act: () => setTimeout(open, 0) };
  }
  bark(c, now = false) {
    const lines = c.def.lines || [];
    if (!lines.length) return;
    let i = Math.floor(Math.random() * lines.length);
    if (lines.length > 1 && i === c.last) i = (i + 1) % lines.length;
    c.last = i;
    c.bubble.setText(lines[i]).setAlpha(1);
    if (now) this.babble(c, lines[i]);   // random barks stay quiet, the one Leyla asked for speaks
    c.until = this.scene.time.now + (this.C.companions?.barkTime ?? 4) * 1000 + (now ? 1000 : 0);
  }
}
