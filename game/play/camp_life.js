// The camp's life (#017 split from camp.js): wind and fire sound, the companions, their jobs (Questlog).
// Mixed into Camp (game/play/camp.js): the methods keep their `this`, nothing else changes.
import { offers, accept, claim, progressOf, qstate } from '../quests.js';
import { figureTexture } from './camp.js';
import { noteTexture } from './camp_board.js';

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
      // #017: a mark over the head when they have a job for Leyla; #025: a little pinned note (gold pin = offer, green stamp = hand in)
      const mark = s.add.image(x, this.ground - h - 14, noteTexture(s, 'offer')).setOrigin(0.5, 1).setDepth(24).setVisible(false);
      s.tweens.add({ targets: mark, y: mark.y - 10, angle: { from: -6, to: 6 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
      const J = this.jobsOf(c), kind = J.ready.length ? 'ready' : J.offer.length ? 'offer' : null;
      c.mark.setVisible(!!kind);
      if (kind) c.mark.setTexture(noteTexture(this.scene, kind));
      c.markKind = kind;
      c.spot.hint = J.ready.length ? 'Reden · Auftrag abgeben' : J.offer.length ? 'Reden · neuer Auftrag' : 'Reden';
    }
  }
  say(c, text) { c.bubble.setText(text).setAlpha(1); c.until = this.scene.time.now + Math.max(4000, text.length * 70); }
  // #025: a conversation in the dialogue box (name plate, colour, room for a portrait later), not a plain menu
  talk(c) {
    const D = this.D, save = this.box.save, s = this.scene, J = this.jobsOf(c), who = this.talkOf(c.id);
    if (!J.offer.length && !J.ready.length && !J.active.length) return this.bark(c, true);
    const rew = q => { const R = q.reward || {}; return [R.deltas ? `${R.deltas} Δ` : null, ...(R.items || []).map(x => `${x.count || 1}× ${D.items?.[x.item]?.name || x.item}`)].filter(Boolean).join(' · '); };
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
      ...J.active.map(id => ({ label: `Wie läuft „${D.quests[id].name}“?`, sub: `${progressOf(D, save, id).n} / ${progressOf(D, save, id).target}`, icon: 'help', act: () => { const p = progressOf(D, save, id); this.say(c, p.n ? `${p.n} von ${p.target}. Weiter so.` : 'Noch nichts? Ich warte.'); } })),
      { label: 'Plaudern', icon: 'speechBubble', act: () => this.bark(c, true) },
      { label: 'Tschüss', icon: 'x', act: () => {} }];
    const greet = (J.ready.length ? 'Na? Sieht aus, als hättest du was für mich.' : J.offer.length ? 'Gut, dass du kommst. Ich hab da was.' : 'Und, wie läuft es da draußen?');
    s.hud.menu({ title: who.name, sub: greet, items, talk: who });
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
