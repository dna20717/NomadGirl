// Feedback for the test phase (#181): ties game/feedback/ to NomadGirl. Everything the feedback kit knows about the game is here:
// once per frame the held inputs and a small state into the trace, pause/resume, the picture, the place, the line to replay it.
import { installFeedback } from '../feedback/index.js';
import { loadVersion } from '../version.js';

export function installGameFeedback(game, D) {
  const scene = () => game.scene.getScene('play');
  let version = null; loadVersion().then(v => { version = v; });
  const r = n => Math.round(n);
  const windowOf = h => h.modal ? `Menü: ${h.menuTitle || ''}` : h.paused ? 'Steuerung' : h.inv?.isOpen ? 'Inventar' : h.craft?.isOpen ? 'Kochen' : h.map?.isOpen ? 'Reisekarte'
    : h.tech?.isOpen ? 'Techtree' : h.build?.active ? 'Rig bauen' : h.drive?.isOpen ? 'Fahrt' : h.duel?.isOpen ? 'Duell' : h.tut?.isOpen ? 'Feldhandbuch' : h.quests?.isOpen ? 'Questlog' : h.trade?.isOpen ? 'Händler' : null;
  // the small state 4× per second: enough to see what happened and to put Leyla there again
  const sample = s => {
    const l = s.leyla; if (!l?.body) return null;
    const near = (s.enemies || []).filter(e => e.alive !== false && e.state !== 'dead' && Math.abs((e.x ?? e.body?.center.x ?? 0) - l.x) < 1600)
      .slice(0, 8).map(e => ({ id: e.id, state: e.state, x: r(e.x ?? e.body.center.x), feet: r(e.feet ?? e.body.bottom), hp: e.hp }));
    return { mode: s.mode, room: s.roomId, x: r(l.x), feet: r(l.feet), tile: [Math.floor(l.x / s.T), Math.round(l.feet / s.T)], vx: r(l.body.velocity.x), vy: r(l.body.velocity.y),
      state: l.state, facing: l.facing, health: r(l.health), ammo: l.ammo, mag: l.mag, armed: l.armed, kills: s.kills, enemies: near,
      prompt: s.hud?.promptText || null, window: s.hud ? windowOf(s.hud) : null, music: s.director?.state?.()?.phase ?? undefined };
  };
  let prev = {};
  const held = s => Object.entries(s.lastInput || {}).filter(([, v]) => v?.down).map(([k]) => k);
  const fb = installFeedback({
    pause() {
      const s = scene(), h = s?.hud; if (!h) return;
      // Select + Start also opened the inventory / pause menu this frame: close them again, swallow the release
      if (h.modal && h.menuTitle === 'Pause') h.closeMenu();
      if (h.paused) h.toggleHelp(false);
      s.selFired = true; s.thFired = true;
      h.feedbackOpen = true;
      if (s.input?.keyboard) { s.input.keyboard.enabled = false; s.input.keyboard.resetKeys?.(); }
    },
    resume() {
      const s = scene(), h = s?.hud; if (!h) return;
      h.feedbackOpen = false; h.feedbackSwallow = 8;   // the A / B / Start that closed the window must not act in the game
      if (s.input?.keyboard) { s.input.keyboard.enabled = true; s.input.keyboard.resetKeys?.(); }
    },
    shot(width = 640) {
      return new Promise(res => {
        const R = game.renderer; if (!R?.snapshot) return res(null);
        const t = setTimeout(() => res(null), 1500);   // under the remote control the loop sleeps: no picture then
        R.snapshot(img => {
          clearTimeout(t);
          try { const c = document.createElement('canvas'); c.width = width; c.height = Math.round(width * img.height / img.width); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); let d = c.toDataURL('image/webp', 0.6); if (!d.startsWith('data:image/webp')) d = c.toDataURL('image/jpeg', 0.7); res(d); }   // Safari cannot write WebP (PNG ≈ 290 KB), JPEG instead
          catch { res(null); }
        });
      });
    },
    context() {
      const s = scene(), l = s?.leyla, box = s?.box;
      return { mode: s?.mode, poi: s?.levelPoi || null, seed: s?.levelSeed || null, room: s?.mode === 'camp' ? null : s?.roomId, place: s?.roomDef?.name || null,
        tile: l ? [Math.floor(l.x / s.T), Math.round(l.feet / s.T)] : null, health: l ? `${r(l.health)}/${l.maxHealth}` : null,
        window: s?.hud ? windowOf(s.hud) : null, cycle: box?.save?.cycle ?? null, day: box?.save?.day ?? null, slot: window.__nomadData?.slot ?? null,
        version: version?.short || 'lokal', data: window.__nomadData?.commit?.slice(0, 7) || null, set: window.__nomadData?.set?.id || null,
        pad: s?.pad?.kind || null, screen: `${innerWidth}×${innerHeight}`, browser: navigator.userAgent.match(/(Firefox|Edg|Chrome|Safari)\/[\d.]+/)?.[0] || null, url: location.pathname + location.search };
    },
    where() {
      const s = scene(); if (!s) return '';
      const poi = s.levelPoi ? D.pois?.[s.levelPoi]?.name || s.levelPoi : null;
      return [poi || s.roomDef?.name || (s.mode === 'camp' ? 'Camp' : s.roomId), s.levelSeed ? `Seed ${s.levelSeed}` : null, s.roomId && poi ? `Raum ${s.roomId}` : null].filter(Boolean).join(' · ');
    },
    reproduce() {
      const s = scene(), l = s?.leyla; if (!s || !l) return null;
      const q = s.levelPoi ? `?poi=${s.levelPoi}&seed=${s.levelSeed}` : s.mode === 'camp' ? '?camp' : `?room=${s.roomId}`;
      return `GAME_URL='http://localhost:8766/game.html${q}' node tools/play.mjs 'tp ${Math.floor(l.x / s.T)} ${Math.round(l.feet / s.T)}' 'shot fb'`;
    },
  }, D.game?.feedback || {});
  // once per frame (also when the remote control steps without rendering)
  game.events.on('poststep', () => {
    const s = scene(); if (!s?.leyla?.body || s.hud?.feedbackOpen) return;
    const t = s.now ?? performance.now();
    fb.rec.frame(t, held(s), () => sample(s));
    const h = s.hud, now = { mode: s.mode, room: s.roomId, window: h ? windowOf(h) : null, kills: s.kills, health: r(s.leyla.health), alive: s.leyla.alive };
    if (prev.mode !== undefined) {
      if (now.mode !== prev.mode) fb.rec.event(t, 'mode', { from: prev.mode, to: now.mode });
      if (now.room !== prev.room) fb.rec.event(t, 'room', { from: prev.room, to: now.room });
      if (now.window !== prev.window) fb.rec.event(t, 'window', { to: now.window });
      if (now.kills > prev.kills) fb.rec.event(t, 'kill', { kills: now.kills });
      if (now.health < prev.health) fb.rec.event(t, 'hit', { health: now.health, lost: prev.health - now.health });
      if (prev.alive && !now.alive) fb.rec.event(t, 'down');
    }
    prev = now;
  });
  return fb;
}
