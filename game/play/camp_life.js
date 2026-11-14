// The camp's life (#017 split from camp.js): wind and fire sound, the companions, their jobs (Questlog).
// Mixed into Camp (game/play/camp.js): the methods keep their `this`, nothing else changes.
import { offers, accept, claim, progressOf, qstate } from '../quests.js';
import { figureTexture } from './camp.js';

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
    };
    if (s.cache.audio.exists(id)) return play();
    const base = s.base || location.href;
    s.load.audio(id, [new URL(A.file, base).href, ...(A.alt ? [new URL(A.alt, base).href] : [])]);
    s.load.once('filecomplete-audio-' + id, play);
    s.load.start();
  }
  cam() { return this.scene.cam || this.scene.cameras.main; }
  gustDelay() { const [a, b] = this.C.sound?.gustEvery || [9, 22]; return (a + Math.random() * (b - a)) * 1000; }
  updateSound(time) {
    const s = this.scene, S = this.C.sound || {}, l = s.leyla;
    if (this.music) {
      const k = Math.min(1, (time - this.musicAt) / Math.max(1, (S.musicFadeIn ?? 4) * 1000));
      this.music.setVolume(this.musicTarget * k * k);
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
      const sprite = info ? s.add.sprite(x, this.ground, info.key).setOrigin(info.ox, info.oy).setScale(info.scale) : s.add.image(x, this.ground, figureTexture(s, 'comp_' + id, def.color, def.role)).setOrigin(0.5, 1).setScale(h / 75);
      if (info?.anim) sprite.play(info.anim);
      sprite.setDepth(-3).setFlipX(x > this.geo.fireX);
      const bubble = s.add.text(x, this.ground - h - 16, '', { fontFamily: 'VT323, monospace', fontSize: '30px', color: '#17111f', backgroundColor: '#f2eef7', padding: { x: 10, y: 4 }, wordWrap: { width: 420 }, align: 'center' }).setOrigin(0.5, 1).setDepth(25).setAlpha(0);
      // #017: a gold „!“ over the head when they have a job for Leyla, a green „✓“ when she can hand one in
      const mark = s.add.text(x, this.ground - h - 14, '', { fontFamily: 'VT323, monospace', fontSize: '54px', color: '#ffd27a', stroke: '#0d0a12', strokeThickness: 8 }).setOrigin(0.5, 1).setDepth(24);
      s.tweens.add({ targets: mark, y: mark.y - 10, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const c = { id, def, x, sprite, bubble, mark, h, until: 0, last: -1 };
      const spot = { x, w: 70, name: def.name || id, hint: 'Reden', act: () => this.talk(c) };
      c.spot = spot;
      this.hotspots.push(spot);
      return c;
    });
    this.questMarks();
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
      const J = this.jobsOf(c);
      c.mark.setText(J.ready.length ? '✓' : J.offer.length ? '!' : '').setColor(J.ready.length ? '#9cdb43' : '#ffd27a');
      c.spot.hint = J.ready.length ? 'Reden · Auftrag abgeben' : J.offer.length ? 'Reden · neuer Auftrag' : 'Reden';
    }
  }
  say(c, text) { c.bubble.setText(text).setAlpha(1); c.until = this.scene.time.now + Math.max(4000, text.length * 70); }
  talk(c) {
    const D = this.D, save = this.box.save, s = this.scene, J = this.jobsOf(c), name = c.def.name || c.id;
    if (!J.offer.length && !J.ready.length && !J.active.length) return this.bark(c, true);
    const done = () => { s.box.persist(); this.questMarks(); s.hud.campKey = null; s.hud.goalAt = 0; };
    const items = [
      ...J.ready.map(id => ({ label: `Abgeben: ${D.quests[id].name}`, sub: 'Erledigt', primary: true, act: () => {
        const q = D.quests[id], r = claim(D, save, id);
        if (r.ok) { this.say(c, r.line || 'Danke, Leyla.'); s.hud.toast(`Erledigt: ${q.name}`, r.got.join(' · '), 'good'); }
        done();
      } })),
      ...J.offer.map(id => ({ label: `Auftrag: ${D.quests[id].name}`, sub: 'Neu', primary: !J.ready.length, act: () => {
        const q = D.quests[id], R = q.reward || {}, rew = [R.deltas ? `${R.deltas} Δ` : null, ...(R.items || []).map(x => `${x.count || 1}× ${D.items?.[x.item]?.name || x.item}`)].filter(Boolean).join(' · ');
        this.say(c, q.text || '');
        s.hud.menu({ title: `${name}: ${q.name}`, sub: `„${q.text || ''}“${rew ? `  Belohnung: ${rew}` : ''}`, items: [
          { label: 'Annehmen', primary: true, act: () => { accept(D, save, id); this.say(c, 'Gut. Ich verlass mich auf dich.'); s.hud.toast(`Auftrag angenommen: ${q.name}`, `${name} · steht im Questlog`, 'info'); done(); } },
          { label: 'Später', act: () => this.say(c, 'Überleg es dir.') }] });
      } })),
      ...J.active.map(id => ({ label: `Wie läuft „${D.quests[id].name}“?`, sub: `${progressOf(D, save, id).n} / ${progressOf(D, save, id).target}`, act: () => { const p = progressOf(D, save, id); this.say(c, p.n ? `${p.n} von ${p.target}. Weiter so.` : 'Noch nichts? Ich warte.'); } })),
      { label: 'Plaudern', act: () => this.bark(c, true) },
      { label: 'Zurück', act: () => {} }];
    s.hud.menu({ title: name, sub: c.def.role || '', items });
  }
  bark(c, now = false) {
    const lines = c.def.lines || [];
    if (!lines.length) return;
    let i = Math.floor(Math.random() * lines.length);
    if (lines.length > 1 && i === c.last) i = (i + 1) % lines.length;
    c.last = i;
    c.bubble.setText(lines[i]).setAlpha(1);
    c.until = this.scene.time.now + (this.C.companions?.barkTime ?? 4) * 1000 + (now ? 1000 : 0);
  }
}
