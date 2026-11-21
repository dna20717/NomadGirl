// Small helpers the traits share (#139).

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
export const hexColor = (c, fallback = 0xff3040) => { const n = parseInt(String(c || '').replace('#', ''), 16); return Number.isFinite(n) ? n : fallback; };

// a straight line from (x, y) in direction ang: stops at the first wall or chest, or on Leyla → { end, onLeyla, blocked }
export function trace(scene, x, y, ang, max = 1800) {
  const dx = Math.cos(ang), dy = Math.sin(ang), l = scene.leyla, b = l?.body, covers = scene.covers?.() || [];
  for (let d = 6; d <= max; d += 6) {
    const px = x + dx * d, py = y + dy * d;
    if (scene.pointSolid(px, py)) return { end: { x: px, y: py }, onLeyla: false, blocked: 'wall' };
    if (covers.some(c => px > c.x - c.w / 2 && px < c.x + c.w / 2 && py > c.top && py < c.feet)) return { end: { x: px, y: py }, onLeyla: false, blocked: 'cover' };
    if (l?.alive && px > b.left && px < b.right && py > b.top && py < b.bottom) return { end: { x: px, y: py }, onLeyla: true, blocked: null };
  }
  return { end: { x: x + dx * max, y: y + dy * max }, onLeyla: false, blocked: null };
}

// the kit enemies of the POI that may come as help (weakest first), without bosses and without the ones that have this trait
export function poiPool(scene, without = '') {
  const D = scene.data_, poi = scene.box?.save?.run?.poi || scene.levelPoi || scene.level?.poi;
  const list = (D.pois?.[poi]?.enemies || []).filter(id => D.enemies?.[id]?.kit && D.enemies[id].behavior !== 'boss' && !(without && (D.enemies[id].traits || []).includes(without)));
  return list.sort((a, b) => (D.enemies[a].health ?? 30) - (D.enemies[b].health ?? 30));
}

// a siren from code: a square wave sweeping up and down (Web Audio only, silent elsewhere)
export function siren(scene, ms = 3200) {
  try {
    const ctx = scene.sound?.context;
    if (!ctx || scene.sound.mute || ctx.state !== 'running') return;
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), depth = ctx.createGain(), v = ctx.createGain(), t = ctx.currentTime;
    o.type = 'square'; o.frequency.value = 680; lfo.frequency.value = 1.6; depth.gain.value = 220;
    lfo.connect(depth).connect(o.frequency);
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(0.06 * (scene.sound.volume ?? 1), t + 0.2); v.gain.linearRampToValueAtTime(0, t + ms / 1000);
    o.connect(v).connect(scene.sound.destination || ctx.destination);
    o.start(t); lfo.start(t); o.stop(t + ms / 1000 + 0.05); lfo.stop(t + ms / 1000 + 0.05);
  } catch { /* no audio */ }
}
