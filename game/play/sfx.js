// Sounds from code (Web Audio) and the catalog of sound events (#130, Werkstatt › Ton-Ereignisse, data/sounds.json).
// Every event names a placeholder recipe from code (RECIPES below: filtered noise, pitched envelopes, low thumps, a bit of grit)
// and optionally produced samples (Assets of kind Ton): once a sample is set, it plays instead of the code, nothing else changes.
// Two ways in:
//   scene.sfx('jump', { x })      → the bank of the scene (game/play/scene_events.js), volume from Spiel › Effekte × the event
//   sfxNow('item_equip')          → the same for code without a scene at hand (inventory window), the last scene that played
//   makeSfx(scene, volume).klonk() → the older build/toast sounds; an event with „Ersetzt Code-Ton“ takes them over
// Silent when the game is muted (M, localStorage nomadgirl-mute), when there is no AudioContext or it is not running yet
// (headless tests, before the first click): nothing is queued, nothing throws.

// ---------- recipes (placeholders from code) ----------
// [id, label] for the schema; the functions follow in RECIPES
export const SFX_RECIPES = [
  ['whoosh', 'Hieb: Luftzug'], ['whooshHeavy', 'Hieb: schwerer Luftzug'], ['hitFlesh', 'Treffer: Fleisch'], ['hitMetal', 'Treffer: Metall'], ['block', 'Block (Schild)'],
  ['armor', 'Panzerplatte'], ['wallHit', 'Schlag gegen die Wand'], ['hurt', 'Leyla getroffen'], ['ko', 'Leyla k.o.'], ['death', 'Gegner fällt'], ['deathMachine', 'Maschine geht aus'],
  ['enemyShot', 'Gegner-Schuss (dumpf)'], ['dryFire', 'Leeres Magazin'], ['reload', 'Nachladen'],
  ['stepSand', 'Schritt: Sand'], ['stepStone', 'Schritt: Stein/Beton'], ['stepMetal', 'Schritt: Blech'], ['stepWood', 'Schritt: Holz'],
  ['jump', 'Absprung'], ['airJump', 'Doppelsprung (Implantat)'], ['landSoft', 'Landung weich'], ['landHard', 'Landung hart'], ['dash', 'Dash'], ['slide', 'Rutschen'],
  ['ladder', 'Leitersprosse'], ['ladderSlide', 'Leiter runterrutschen'], ['ledge', 'Kante greifen'],
  ['crate', 'Kiste öffnen'], ['loot', 'Beute aufheben'], ['delta', 'Δ klimpern'], ['equip', 'Ausrüsten'], ['itemPick', 'Ding nehmen'], ['itemPlace', 'Ding ablegen'],
  ['door', 'Tür (Servo)'], ['doorSwing', 'Tür schwingt auf (Knarren)'], ['doorShut', 'Tür fällt zu'], ['doorSlide', 'Schiebetür'], ['doorHitWood', 'Treffer: Holztür'], ['glassHit', 'Treffer: Glas'],
  ['doorBreakWood', 'Holztür zersplittert'], ['doorBreakMetal', 'Metalltür reißt'], ['glassBreak', 'Glas zerspringt'], ['switch', 'Schalter'], ['uiHover', 'UI: Fokus'], ['uiConfirm', 'UI: Bestätigen'], ['uiBack', 'UI: Zurück'], ['uiDeny', 'UI: Geht nicht'],
  ['jingleQuest', 'Jingle: Auftrag erledigt'], ['jingleAchievement', 'Jingle: Achievement'],
  // the older ones (build mode, toasts)
  ['tick', 'Kombo-Takt'], ['klonk', 'Klonk (Schweres setzt auf)'], ['klack', 'Klack (Kupplung)'], ['ratchet', 'Ratsche'], ['coins', 'Münzen (Händler)'], ['lift', 'Hochheben'],
  ['snap', 'Einrasten'], ['nope', 'Passt nicht'], ['fanfare', 'Fanfare'], ['chime', 'Glöckchen (Rezept)'], ['ping', 'Ping (Hinweis)'], ['good', 'Gut'], ['sparkle', 'Glitzern (Secret)'], ['low', 'Dunkles Brummen'],
];
// the methods makeSfx has always had (build mode, HUD toasts, Mega-Rigs): an event can take one over (field „Ersetzt Code-Ton“)
export const SFX_LEGACY = ['tick', 'klonk', 'klack', 'ratchet', 'coins', 'lift', 'snap', 'nope', 'fanfare', 'chime', 'ping', 'good', 'sparkle', 'low'];

// shared per AudioContext: one second of noise, a soft clipping curve for grit
const SHARED = new WeakMap();
function shared(c) {
  let s = SHARED.get(c);
  if (s) return s;
  const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; d[i] = w; last = 0.97 * last + 0.03 * w; }
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 3) / Math.tanh(3); }
  s = { noise: b, curve };
  SHARED.set(c, s);
  return s;
}
const env = (g, t, a, peak, len) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.005, len)); };
// a pitched tone with a falling/rising sweep
function tone(c, d, type, f0, f1, t, len, peak, a = 0.004) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(Math.max(1, f0), t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + len);
  env(g, t, a, peak, len); o.connect(g).connect(d); o.start(t); o.stop(t + len + 0.03);
}
// filtered noise: type lowpass/highpass/bandpass, frequency sweep f0 → f1
function noise(c, d, t, len, peak, { type = 'lowpass', f0 = 1000, f1 = f0, q = 0.8, a = 0.003 } = {}) {
  const S = shared(c), n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  n.buffer = S.noise; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(Math.max(20, f0), t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len);
  env(g, t, a, peak, len); n.connect(f).connect(g).connect(d);
  const off = Math.random() * Math.max(0, 1 - len - 0.05); n.start(t, off, len + 0.03);
}
// a low body thump: sine drop plus dark noise
function thump(c, d, t, f0, len, peak) { tone(c, d, 'sine', f0, f0 * 0.45, t, len, peak, 0.003); noise(c, d, t, len * 0.7, peak * 0.6, { f0: 420, f1: 120 }); }
// a bit of dirt: a soft clipper in front of the output
function grit(c, d, amount = 1) { const S = shared(c), w = c.createWaveShaper(), g = c.createGain(); w.curve = S.curve; w.oversample = '2x'; g.gain.value = 1 / (1 + amount * 0.6); w.connect(g).connect(d); return w; }
// a metal ring: a few inharmonic partials that die fast
function ring(c, d, t, base, len, peak, partials = [1, 2.31, 3.47, 5.12]) { partials.forEach((p, i) => tone(c, d, i % 2 ? 'triangle' : 'sine', base * p, base * p * 0.995, t, len / (1 + i * 0.5), peak / (1 + i * 0.8), 0.002)); }

// recipe(c, dest, t, k = pitch factor, o = options of the call) — keep them short and quiet; the event volume does the mixing
export const RECIPES = {
  whoosh: (c, d, t, k) => { noise(c, d, t, 0.17, 0.32, { type: 'bandpass', f0: 500 * k, f1: 2600 * k, q: 1.4, a: 0.05 }); noise(c, d, t + 0.02, 0.12, 0.08, { type: 'highpass', f0: 3000 * k, a: 0.04 }); },
  whooshHeavy: (c, d, t, k) => { noise(c, d, t, 0.28, 0.4, { type: 'bandpass', f0: 260 * k, f1: 1500 * k, q: 1.1, a: 0.09 }); tone(c, d, 'sine', 110 * k, 70 * k, t + 0.05, 0.2, 0.08, 0.06); },
  hitFlesh: (c, d, t, k, o) => { const g = grit(c, d, 1.2), w = 1 + (o.heavy ? 0.4 : 0) + (o.crit ? 0.2 : 0); thump(c, g, t, 140 * k, 0.16 * w, 0.55); noise(c, g, t, 0.06, 0.4 * w, { type: 'bandpass', f0: 1800 * k, f1: 700 * k, q: 0.9 }); noise(c, d, t + 0.01, 0.12, 0.12, { type: 'lowpass', f0: 900, f1: 200 }); },
  hitMetal: (c, d, t, k, o) => { const g = grit(c, d, 0.8); noise(c, g, t, 0.03, 0.4, { type: 'highpass', f0: 2500 * k }); ring(c, d, t, 420 * k * (o.heavy ? 0.8 : 1), 0.32, 0.14); thump(c, d, t, 110 * k, 0.1, 0.3); },
  block: (c, d, t, k) => { noise(c, d, t, 0.025, 0.35, { type: 'highpass', f0: 3200 * k }); ring(c, d, t, 760 * k, 0.22, 0.12, [1, 1.5, 2.76]); thump(c, d, t, 160 * k, 0.07, 0.2); },
  armor: (c, d, t, k) => { const g = grit(c, d, 1.5); noise(c, g, t, 0.05, 0.45, { type: 'bandpass', f0: 2200 * k, f1: 900 * k, q: 1.2 }); ring(c, d, t, 300 * k, 0.4, 0.1, [1, 2.7, 4.1]); thump(c, d, t, 90 * k, 0.18, 0.4); },
  wallHit: (c, d, t, k) => { noise(c, d, t, 0.07, 0.3, { type: 'bandpass', f0: 1400 * k, f1: 500 * k, q: 1 }); thump(c, d, t, 100 * k, 0.1, 0.25); },
  hurt: (c, d, t, k, o) => { const g = grit(c, d, 2), w = o.heavy ? 1.4 : 1; thump(c, g, t, 95 * k, 0.22 * w, 0.6); noise(c, g, t, 0.09, 0.35, { type: 'bandpass', f0: 1200 * k, f1: 400 * k, q: 1.1 }); tone(c, d, 'sawtooth', 70 * k, 45 * k, t, 0.25 * w, 0.05, 0.01); },
  ko: (c, d, t, k) => { const g = grit(c, d, 1.5); thump(c, g, t, 80 * k, 0.45, 0.7); noise(c, g, t + 0.18, 0.3, 0.3, { f0: 600, f1: 90 }); tone(c, d, 'sawtooth', 98 * k, 49 * k, t, 1.1, 0.05, 0.05); tone(c, d, 'sine', 196 * k, 92 * k, t + 0.05, 1.0, 0.06, 0.08); },
  death: (c, d, t, k) => { thump(c, d, t, 120 * k, 0.12, 0.35); thump(c, d, t + 0.32, 80 * k, 0.3, 0.55); noise(c, d, t + 0.34, 0.22, 0.18, { type: 'bandpass', f0: 700, f1: 250, q: 0.7 }); for (let i = 0; i < 3; i++) noise(c, d, t + 0.4 + i * 0.05 + Math.random() * 0.03, 0.03, 0.08, { type: 'bandpass', f0: 2400, q: 2 }); },
  deathMachine: (c, d, t, k) => { const g = grit(c, d, 2); for (let i = 0; i < 6; i++) noise(c, g, t + i * 0.04 + Math.random() * 0.03, 0.02, 0.25, { type: 'highpass', f0: 3500 }); tone(c, g, 'square', 340 * k, 40 * k, t, 0.7, 0.05, 0.01); thump(c, d, t + 0.45, 70 * k, 0.25, 0.45); },
  enemyShot: (c, d, t, k) => { const g = grit(c, d, 2.5); noise(c, g, t, 0.12, 0.55, { f0: 2400 * k, f1: 300 }); tone(c, g, 'sine', 150 * k, 55 * k, t, 0.14, 0.4, 0.002); noise(c, d, t + 0.05, 0.25, 0.06, { type: 'bandpass', f0: 500, q: 0.6, a: 0.04 }); },
  dryFire: (c, d, t, k) => { noise(c, d, t, 0.012, 0.25, { type: 'highpass', f0: 4000 * k }); noise(c, d, t + 0.045, 0.02, 0.18, { type: 'bandpass', f0: 2200 * k, q: 3 }); },
  reload: (c, d, t, k) => { noise(c, d, t, 0.03, 0.2, { type: 'bandpass', f0: 1800 * k, q: 2 }); ring(c, d, t, 900 * k, 0.06, 0.05, [1, 2.2]); noise(c, d, t + 0.16, 0.025, 0.25, { type: 'bandpass', f0: 2600 * k, q: 2.5 }); thump(c, d, t + 0.17, 180 * k, 0.05, 0.15); },
  stepSand: (c, d, t, k, o) => { const w = o.run ? 1 : 0.7; noise(c, d, t, 0.09, 0.22 * w, { type: 'bandpass', f0: 1300 * k, f1: 600 * k, q: 0.7, a: 0.01 }); noise(c, d, t, 0.05, 0.12 * w, { f0: 300 }); },
  stepStone: (c, d, t, k, o) => { const w = o.run ? 1 : 0.7; noise(c, d, t, 0.035, 0.25 * w, { type: 'bandpass', f0: 2600 * k, q: 1.2 }); tone(c, d, 'sine', 160 * k, 90 * k, t, 0.05, 0.12 * w, 0.002); noise(c, d, t + 0.03, 0.04, 0.06 * w, { type: 'highpass', f0: 4500 }); },
  stepMetal: (c, d, t, k, o) => { const w = o.run ? 1 : 0.7; noise(c, d, t, 0.025, 0.2 * w, { type: 'bandpass', f0: 2000 * k, q: 1.5 }); ring(c, d, t, 310 * k * (0.95 + Math.random() * 0.1), 0.18, 0.05 * w, [1, 2.43, 3.9]); thump(c, d, t, 120 * k, 0.06, 0.12 * w); },
  stepWood: (c, d, t, k, o) => { const w = o.run ? 1 : 0.7; noise(c, d, t, 0.04, 0.2 * w, { type: 'bandpass', f0: 750 * k, q: 2 }); tone(c, d, 'triangle', 210 * k, 150 * k, t, 0.06, 0.12 * w, 0.002); },
  jump: (c, d, t, k) => { noise(c, d, t, 0.12, 0.18, { type: 'bandpass', f0: 600 * k, f1: 1700 * k, q: 1, a: 0.02 }); noise(c, d, t, 0.04, 0.1, { f0: 400 }); },
  airJump: (c, d, t, k) => { noise(c, d, t, 0.16, 0.2, { type: 'bandpass', f0: 900 * k, f1: 3200 * k, q: 1.3, a: 0.02 }); tone(c, d, 'sine', 260 * k, 780 * k, t, 0.16, 0.06, 0.02); tone(c, d, 'sawtooth', 130 * k, 390 * k, t, 0.12, 0.015, 0.02); },
  landSoft: (c, d, t, k, o) => { const w = Math.max(0.4, Math.min(1, o.k ?? 1)); noise(c, d, t, 0.1, 0.3 * w, { f0: 900 * k, f1: 200 }); tone(c, d, 'sine', 110 * k, 60 * k, t, 0.08, 0.15 * w); },
  landHard: (c, d, t, k) => { const g = grit(c, d, 1.2); thump(c, g, t, 90 * k, 0.3, 0.7); noise(c, d, t + 0.02, 0.35, 0.22, { type: 'bandpass', f0: 1200, f1: 300, q: 0.6 }); for (let i = 0; i < 4; i++) noise(c, d, t + 0.08 + i * 0.05 + Math.random() * 0.04, 0.02, 0.06, { type: 'bandpass', f0: 3000, q: 3 }); },
  dash: (c, d, t, k) => { noise(c, d, t, 0.22, 0.32, { type: 'bandpass', f0: 1800 * k, f1: 500 * k, q: 1.2, a: 0.015 }); tone(c, d, 'sawtooth', 220 * k, 90 * k, t, 0.2, 0.025, 0.01); tone(c, d, 'sine', 70 * k, 50 * k, t, 0.2, 0.12, 0.02); },
  slide: (c, d, t, k, o) => { const len = Math.max(0.2, Math.min(0.8, (o.ms ?? 350) / 1000)); noise(c, d, t, len, 0.25, { type: 'bandpass', f0: 1600 * k, f1: 500 * k, q: 0.6, a: 0.03 }); noise(c, d, t, len * 0.8, 0.12, { f0: 400, f1: 150, a: 0.02 }); },
  ladder: (c, d, t, k) => { noise(c, d, t, 0.02, 0.14, { type: 'bandpass', f0: 2400 * k, q: 2 }); ring(c, d, t, 520 * k * (0.95 + Math.random() * 0.1), 0.1, 0.035, [1, 2.6]); },
  ladderSlide: (c, d, t, k) => { noise(c, d, t, 0.14, 0.12, { type: 'bandpass', f0: 3200 * k, f1: 2600 * k, q: 3, a: 0.02 }); tone(c, d, 'triangle', 640 * k, 600 * k, t, 0.12, 0.012, 0.02); },
  ledge: (c, d, t, k) => { noise(c, d, t, 0.05, 0.25, { type: 'bandpass', f0: 1500 * k, f1: 800 * k, q: 1 }); thump(c, d, t, 130 * k, 0.06, 0.18); },
  crate: (c, d, t, k) => { const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();   // a creaking lid
    o.type = 'sawtooth'; o.frequency.setValueAtTime(95 * k, t); o.frequency.linearRampToValueAtTime(130 * k, t + 0.35); f.type = 'bandpass'; f.frequency.value = 900 * k; f.Q.value = 6;
    lfo.frequency.value = 23; lg.gain.value = 18; lfo.connect(lg).connect(o.frequency); env(g, t + 0.06, 0.06, 0.08, 0.38); o.connect(f).connect(g).connect(d); o.start(t); o.stop(t + 0.5); lfo.start(t); lfo.stop(t + 0.5);
    noise(c, d, t, 0.02, 0.3, { type: 'bandpass', f0: 2600 * k, q: 3 }); thump(c, d, t + 0.4, 120 * k, 0.12, 0.35); },
  loot: (c, d, t, k) => { noise(c, d, t, 0.06, 0.16, { type: 'bandpass', f0: 2600 * k, q: 1.2, a: 0.01 }); noise(c, d, t + 0.07, 0.07, 0.12, { type: 'bandpass', f0: 1900 * k, q: 1.2, a: 0.01 }); ring(c, d, t + 0.1, 1700 * k, 0.12, 0.03, [1, 1.9]); },
  delta: (c, d, t, k) => { for (let i = 0; i < 3; i++) ring(c, d, t + i * 0.055 + Math.random() * 0.02, (2100 + Math.random() * 500) * k, 0.12, 0.05, [1, 1.83, 2.9]); noise(c, d, t, 0.02, 0.1, { type: 'highpass', f0: 5000 }); },
  equip: (c, d, t, k) => { noise(c, d, t, 0.015, 0.3, { type: 'bandpass', f0: 3000 * k, q: 3 }); noise(c, d, t + 0.07, 0.02, 0.35, { type: 'bandpass', f0: 1900 * k, q: 2.5 }); thump(c, d, t + 0.075, 150 * k, 0.07, 0.25); ring(c, d, t + 0.07, 880 * k, 0.08, 0.03, [1, 2.4]); },
  itemPick: (c, d, t, k) => { noise(c, d, t, 0.04, 0.12, { type: 'bandpass', f0: 2200 * k, f1: 3000 * k, q: 1.5 }); },
  itemPlace: (c, d, t, k) => { noise(c, d, t, 0.03, 0.14, { type: 'bandpass', f0: 1400 * k, q: 1.5 }); tone(c, d, 'sine', 180 * k, 120 * k, t, 0.05, 0.1); },
  door: (c, d, t, k) => { const g = grit(c, d, 1.5); tone(c, g, 'sawtooth', 55 * k, 75 * k, t, 0.9, 0.06, 0.15); noise(c, d, t, 0.9, 0.08, { type: 'bandpass', f0: 600, f1: 1400, q: 1, a: 0.2 }); thump(c, g, t + 0.9, 70 * k, 0.3, 0.5); noise(c, d, t + 0.92, 0.25, 0.1, { type: 'highpass', f0: 3000, a: 0.01 }); },
  // #174 doors: a creaking hinge, a slam, a hiss of a sliding door, splinters, torn metal, shattering glass
  doorSwing: (c, d, t, k) => { const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(140 * k, t); o.frequency.linearRampToValueAtTime(95 * k, t + 0.5); f.type = 'bandpass'; f.frequency.value = 1100 * k; f.Q.value = 7;
    lfo.frequency.value = 31; lg.gain.value = 26; lfo.connect(lg).connect(o.frequency); env(g, t, 0.05, 0.07, 0.55); o.connect(f).connect(g).connect(d); o.start(t); o.stop(t + 0.6); lfo.start(t); lfo.stop(t + 0.6);
    noise(c, d, t, 0.03, 0.2, { type: 'bandpass', f0: 2200 * k, q: 3 }); },
  doorShut: (c, d, t, k) => { const g = grit(c, d, 1); thump(c, g, t, 95 * k, 0.22, 0.6); noise(c, d, t, 0.05, 0.3, { type: 'bandpass', f0: 1800 * k, q: 1.5 }); ring(c, d, t + 0.01, 310 * k, 0.18, 0.04, [1, 2.1]); },
  doorSlide: (c, d, t, k) => { noise(c, d, t, 0.45, 0.12, { type: 'bandpass', f0: 900 * k, f1: 1600 * k, q: 1.2, a: 0.08 }); tone(c, d, 'sine', 220 * k, 260 * k, t, 0.45, 0.03, 0.08); thump(c, d, t + 0.45, 150 * k, 0.08, 0.2); },
  doorHitWood: (c, d, t, k) => { thump(c, d, t, 120 * k, 0.12, 0.45); noise(c, d, t, 0.06, 0.3, { type: 'bandpass', f0: 1100 * k, f1: 600 * k, q: 1.4 }); },
  glassHit: (c, d, t, k) => { noise(c, d, t, 0.05, 0.25, { type: 'highpass', f0: 3500 * k }); ring(c, d, t, 1900 * k, 0.2, 0.05, [1, 2.7, 4.1]); },
  doorBreakWood: (c, d, t, k) => { const g = grit(c, d, 1.4); thump(c, g, t, 90 * k, 0.3, 0.7); for (let i = 0; i < 6; i++) noise(c, d, t + i * 0.035 + Math.random() * 0.02, 0.05, 0.3, { type: 'bandpass', f0: (900 + Math.random() * 1400) * k, q: 2 }); noise(c, d, t + 0.05, 0.4, 0.12, { type: 'lowpass', f0: 1400, f1: 300 }); },
  doorBreakMetal: (c, d, t, k) => { const g = grit(c, d, 1.8); thump(c, g, t, 70 * k, 0.35, 0.7); ring(c, d, t, 240 * k, 0.6, 0.12, [1, 1.37, 2.63, 3.9]); noise(c, d, t, 0.5, 0.18, { type: 'bandpass', f0: 2600 * k, f1: 700 * k, q: 0.8 }); },
  glassBreak: (c, d, t, k) => { noise(c, d, t, 0.08, 0.4, { type: 'highpass', f0: 2500 * k }); for (let i = 0; i < 9; i++) ring(c, d, t + 0.02 + i * 0.03 + Math.random() * 0.03, (2400 + Math.random() * 2600) * k, 0.12, 0.035, [1, 2.4]); noise(c, d, t + 0.1, 0.5, 0.1, { type: 'highpass', f0: 5000 * k, a: 0.02 }); },
  switch: (c, d, t, k) => { noise(c, d, t, 0.02, 0.4, { type: 'bandpass', f0: 1600 * k, q: 2 }); thump(c, d, t, 140 * k, 0.08, 0.3); tone(c, grit(c, d, 3), 'sawtooth', 100 * k, 100 * k, t + 0.03, 0.2, 0.03, 0.01); },
  uiHover: (c, d, t, k) => { noise(c, d, t, 0.012, 0.12, { type: 'bandpass', f0: 4200 * k, q: 4 }); },
  uiConfirm: (c, d, t, k) => { noise(c, d, t, 0.012, 0.18, { type: 'bandpass', f0: 3000 * k, q: 3 }); tone(c, d, 'triangle', 660 * k, 660 * k, t + 0.01, 0.08, 0.06); tone(c, d, 'triangle', 990 * k, 990 * k, t + 0.05, 0.1, 0.05); },
  uiBack: (c, d, t, k) => { noise(c, d, t, 0.012, 0.15, { type: 'bandpass', f0: 2400 * k, q: 3 }); tone(c, d, 'triangle', 620 * k, 410 * k, t + 0.01, 0.1, 0.06); },
  uiDeny: (c, d, t, k) => { const g = grit(c, d, 3); tone(c, g, 'square', 110 * k, 104 * k, t, 0.14, 0.05, 0.004); tone(c, g, 'square', 116 * k, 110 * k, t, 0.14, 0.04, 0.004); },
  jingleQuest: (c, d, t, k) => { const g = grit(c, d, 0.6);   // warm saw chord through a closing filter, a tape-ish wobble on top
    [[220, 0], [277, 0.1], [330, 0.2], [440, 0.32]].forEach(([f, dt]) => { const o = c.createOscillator(), fl = c.createBiquadFilter(), gg = c.createGain(); o.type = 'sawtooth'; o.frequency.value = f * k; o.detune.value = (Math.random() - 0.5) * 14;
      fl.type = 'lowpass'; fl.frequency.setValueAtTime(2400, t + dt); fl.frequency.exponentialRampToValueAtTime(500, t + dt + 0.9); env(gg, t + dt, 0.02, 0.05, 1.0); o.connect(fl).connect(gg).connect(g); o.start(t + dt); o.stop(t + dt + 1.05); });
    noise(c, d, t, 0.5, 0.03, { type: 'highpass', f0: 5000, a: 0.2 }); },
  jingleAchievement: (c, d, t, k) => { const g = grit(c, d, 0.8);   // a synth stab, a rising noise swell and a shimmer
    noise(c, d, t, 0.35, 0.12, { type: 'bandpass', f0: 400, f1: 4000, q: 0.8, a: 0.3 });
    [[262, 0.32], [330, 0.32], [392, 0.32], [523, 0.32], [784, 0.46]].forEach(([f, dt], i) => tone(c, g, i < 4 ? 'sawtooth' : 'square', f * k, f * k, t + dt, 0.7, i < 4 ? 0.035 : 0.025, 0.01));
    thump(c, d, t + 0.32, 80 * k, 0.3, 0.35); ring(c, d, t + 0.46, 2093 * k, 0.6, 0.03, [1, 1.5, 2]); },
  // ---------- the older sounds (build mode and toasts), unchanged ----------
  tick: (c, d, t, k, o) => { const f = 880 * k * Math.pow(1.122, Math.min(5, (o.n ?? 1) - 1)); tone(c, d, 'sine', f, f * 0.99, t, 0.07, 0.18); tone(c, d, 'triangle', f * 2, f * 1.98, t, 0.04, 0.05); },
  klonk: (c, d, t, k, o) => { const r = k * (0.9 + Math.random() * 0.2); tone(c, d, 'square', 150 * r / Math.sqrt(o.weight ?? 1), 60, t, 0.22, 0.25); tone(c, d, 'triangle', 620 * r, 410, t, 0.16, 0.12); noise(c, d, t, 0.12, 0.6, { f0: 900 }); },
  klack: (c, d, t, k) => { tone(c, d, 'square', 1400 * k, 900 * k, t, 0.03, 0.15); tone(c, d, 'square', 1100 * k, 700 * k, t + 0.06, 0.04, 0.18); noise(c, d, t + 0.06, 0.06, 0.3, { f0: 2400 }); },
  ratchet: (c, d, t, k) => { for (let i = 0; i < 3; i++) tone(c, d, 'square', (2200 + Math.random() * 400) * k, 1800 * k, t + i * 0.045, 0.018, 0.05); },
  coins: (c, d, t, k) => { tone(c, d, 'sine', 988 * k, 980 * k, t, 0.09, 0.2); tone(c, d, 'sine', 1319 * k, 1310 * k, t + 0.08, 0.22, 0.2); },
  lift: (c, d, t, k) => { tone(c, d, 'triangle', 240 * k, 420 * k, t, 0.12, 0.08); },
  snap: (c, d, t, k) => { const f = (1300 + Math.random() * 160) * k; tone(c, d, 'triangle', f, f * 0.7, t, 0.035, 0.09); noise(c, d, t, 0.02, 0.08, { f0: 3000 }); },
  nope: (c, d, t, k) => { tone(c, d, 'square', 220 * k, 180 * k, t, 0.09, 0.08); tone(c, d, 'square', 180 * k, 140 * k, t + 0.1, 0.12, 0.08); },
  fanfare: (c, d, t, k) => { [523, 659, 784, 1047].forEach((f, i) => { tone(c, d, 'triangle', f * k, f * k, t + i * 0.09, i === 3 ? 0.55 : 0.12, 0.2); tone(c, d, 'square', f / 2 * k, f / 2 * k, t + i * 0.09, 0.1, 0.03); }); tone(c, d, 'sine', 2093 * k, 2080 * k, t + 0.3, 0.5, 0.05); },
  chime: (c, d, t, k) => { tone(c, d, 'sine', 1175 * k, 1170 * k, t, 0.25, 0.16); tone(c, d, 'sine', 1568 * k, 1560 * k, t + 0.1, 0.35, 0.14); tone(c, d, 'sine', 3136 * k, 3130 * k, t + 0.1, 0.2, 0.02); },
  ping: (c, d, t, k) => { tone(c, d, 'sine', 880 * k, 870 * k, t, 0.14, 0.12); tone(c, d, 'triangle', 1760 * k, 1750 * k, t, 0.06, 0.03); },
  good: (c, d, t, k) => { tone(c, d, 'sine', 660 * k, 660 * k, t, 0.08, 0.12); tone(c, d, 'sine', 990 * k, 990 * k, t + 0.07, 0.16, 0.12); },
  sparkle: (c, d, t, k) => { [1319, 1568, 1976, 2637, 3136].forEach((f, i) => tone(c, d, 'sine', f * k, f * k, t + i * 0.05, 0.18, 0.07)); },
  low: (c, d, t, k) => { tone(c, d, 'sawtooth', 110 * k, 70 * k, t, 0.9, 0.06); tone(c, d, 'sine', 220 * k, 140 * k, t, 0.8, 0.08); noise(c, d, t, 0.4, 0.2, { f0: 300 }); },
};

// ---------- the bank of a scene ----------
const BUFFERS = new Map();   // url → AudioBuffer | Promise | 'failed' (produced samples, shared by all scenes)
let current = null;          // the bank that played last (sfxNow)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class Bank {
  constructor(scene) { this.scene = scene; this.last = {}; this.recent = []; this.calls = {}; this.played = []; }
  get D() { return this.scene.data_ || {}; }
  get S() { return this.D.game?.sfx || {}; }
  ctx() {
    const s = this.scene, c = s.sound?.context;
    if (!c || s.muted || s.sound.mute || c.state !== 'running') return null;   // suspended: nothing is queued for later
    return c;
  }
  dest(c) { const d = this.scene.sound?.destination; return d && d.context === c ? d : c.destination; }   // through Phaser's master (mute, volume)
  // the event as it plays: the catalog entry, else a bare recipe of the same name
  resolve(id) {
    const ev = this.D.sounds?.[id] || (RECIPES[id] ? { recipe: id } : null);
    if (!ev) return null;
    const A = this.D.assets || {}, samples = (ev.samples || []).filter(a => A[a]?.kind === 'sound' && A[a].file);
    return { id, ev, recipe: RECIPES[ev.recipe || id] ? ev.recipe || id : null, samples };
  }
  // play an event → true when a sound started
  play(id, o = {}) {
    try {
      this.calls[id] = (this.calls[id] || 0) + 1;
      current = this;
      const S = this.S, r = this.resolve(id);
      if (!r || S.enabled === false || r.ev.mute) return false;
      if (r.ev.kind === 'ui' && S.ui === false) return false;
      const s = this.scene, now = s.now ?? s.time?.now ?? performance.now(), cd = r.ev.cooldown ?? 0;
      if (cd && now - (this.last[id] ?? -1e9) < cd) return false;
      const c = this.ctx(); if (!c) return false;
      const wall = performance.now();
      this.recent = this.recent.filter(x => wall - x < 80);
      if (this.recent.length >= (S.burst ?? 10)) return false;   // a fast headless step or a pile of hits: a few at a time
      this.last[id] = now; this.recent.push(wall);
      let vol = (S.volume ?? 60) / 100 * (r.ev.volume ?? 100) / 100 * (o.vol ?? 1) * (o.base ?? 1);
      const vary = r.ev.vary ?? 0, k = (r.ev.pitch ?? 100) / 100 * Math.pow(2, (Math.random() * 2 - 1) * vary / 1200) * (o.pitch ?? 1);
      // where it happens: a little left/right, quieter far off screen
      let pan = 0;
      const cam = s.cameras?.main;
      if (o.x != null && cam?.worldView?.width) {
        const half = cam.worldView.width / 2, dx = o.x - (cam.worldView.x + half);
        pan = clamp(dx / half, -1, 1) * 0.55;
        if (Math.abs(dx) > half) vol *= clamp(1 - (Math.abs(dx) - half) / (half * 2), 0.15, 1);
      }
      if (vol <= 0.0005) return false;
      const t = c.currentTime + 0.005, g = c.createGain();
      g.gain.value = vol;
      let out = g;
      if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p).connect(this.dest(c)); } else g.connect(this.dest(c));
      setTimeout(() => { try { g.disconnect(); } catch { /* gone */ } }, 4000);
      const sample = r.samples.length ? r.samples[Math.floor(Math.random() * r.samples.length)] : null, buf = sample && this.buffer(c, sample);
      if (buf) {
        const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = k; src.connect(out); src.start(t);
        this.note(id, 'sample', sample);
        return true;
      }
      if (!r.recipe) return false;
      RECIPES[r.recipe](c, out, t, k, o);
      this.note(id, 'code', r.recipe);
      return true;
    } catch (err) {
      if (!this.warned) { this.warned = true; console.warn('sfx', id, err); }
      return false;
    }
  }
  note(id, via, what) { this.played.push({ id, via, what }); if (this.played.length > 40) this.played.shift(); }
  // a produced sample: decoded once (fetch + decodeAudioData); the first call plays the code placeholder while it loads
  buffer(c, assetId) {
    const a = this.D.assets?.[assetId], base = this.scene.base || (typeof location !== 'undefined' ? location.href : '');
    if (!a?.file) return null;
    let url; try { url = new URL(a.file, base).href; } catch { return null; }
    const b = BUFFERS.get(url);
    if (b && b !== 'failed' && !(b instanceof Promise)) return b;
    if (!b && typeof fetch === 'function') {
      BUFFERS.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(x => c.decodeAudioData(x))
        .then(buf => { BUFFERS.set(url, buf); return buf; }).catch(() => BUFFERS.set(url, 'failed')));
    }
    return null;
  }
  // load every produced sample of the catalog ahead (small files), so the first hit already sounds right
  preload() {
    const c = this.scene.sound?.context;
    if (!c || this.preloaded) return;
    this.preloaded = true;
    for (const ev of Object.values(this.D.sounds || {})) for (const a of ev.samples || []) if (this.D.assets?.[a]?.kind === 'sound') this.buffer(c, a);
  }
  // footsteps: the event of the surface under her feet (Ton-Ereignisse › Untergrund), the rig and the van count as metal
  surface(x, feet) {
    const s = this.scene, D = this.D, T = s.T || 64;
    let terrain = null, rig = false;
    if (s.mode === 'camp' && s.campGeo?.floor != null) rig = feet < s.campGeo.floor * T - 8;
    if (!rig) try { terrain = s.terrain?.idAt?.(Math.floor(x / T), Math.floor(feet / T)) || null; } catch { terrain = null; }
    const steps = Object.entries(D.sounds || {}).filter(([, e]) => e.kind === 'move' && (e.terrains?.length || e.rig || e.stepDefault));
    const hit = steps.find(([, e]) => rig ? e.rig : terrain && e.terrains?.includes(terrain)) || steps.find(([, e]) => e.stepDefault);
    return hit?.[0] || 'step_sand';
  }
  step(x, feet, run) { return this.play(this.surface(x, feet), { x, run }); }
}

// the bank of a scene (made once, also installs the menu sounds)
export function sfxOf(scene) {
  if (!scene) return null;
  if (!scene.__sfxBank) { scene.__sfxBank = new Bank(scene); scene.__sfxBank.preload(); installUiSounds(); }
  current = scene.__sfxBank;
  return scene.__sfxBank;
}
// play on the scene that played last (for windows without a scene at hand)
export function sfxNow(id, o) { try { return current?.play(id, o) || false; } catch { return false; } }

// ---------- menu sounds (DOM windows of the game: pause menu, dialogues, stations, duel) ----------
// hover/focus a button → ui_hover, click → ui_confirm (close/back buttons → ui_back), a disabled one → ui_deny.
// The inventory has its own sounds (take, place, equip), the workshop does not load this file.
let uiInstalled = false;
function installUiSounds() {
  if (uiInstalled || typeof document === 'undefined') return;
  uiInstalled = true;
  const btn = ev => { const b = ev.target?.closest?.('button, [role="menuitem"], [role="button"]'); return b && !b.closest('.inv') ? b : null; };
  const back = b => /schließen|zurück|abbrechen|später|tschüss/i.test(`${b.title || ''} ${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`.slice(0, 80)) || b.classList.contains('hud-close');
  let hovered = null;
  document.addEventListener('pointerover', ev => { const b = btn(ev); if (b === hovered) return; hovered = b; if (b && !b.disabled) sfxNow('ui_hover'); }, true);
  document.addEventListener('pointerdown', ev => { const b = btn(ev); if (b?.disabled || b?.getAttribute('aria-disabled') === 'true') sfxNow('ui_deny'); }, true);
  document.addEventListener('click', ev => { const b = btn(ev); if (b && !b.disabled) sfxNow(back(b) ? 'ui_back' : 'ui_confirm'); }, true);
}

// ---------- the older API: little sounds for building the rig and the toasts ----------
// klonk when something heavy sits down, klack of a coupling, ratchet while Leyla screws, coins at the dealer …
// volume: the caller's (Bau › Lautstärke der Bau-Töne). An event with „Ersetzt Code-Ton“ = this name takes the call over
// (its sample, recipe and volume), so produced sounds slot in here without touching the build mode.
export function makeSfx(scene, volume = 0.5) {
  const api = {};
  const ctx = () => { const c = scene.sound?.context; return c && !scene.sound.mute && !scene.muted && c.state === 'running' ? c : null; };
  for (const name of SFX_LEGACY) {
    api[name] = (arg) => {
      try {
        const D = scene.data_ || {}, take = Object.entries(D.sounds || {}).find(([, e]) => e.replaces === name);
        const opts = name === 'tick' ? { n: arg ?? 1 } : name === 'klonk' ? { weight: arg ?? 1 } : {};
        if (take) return sfxOf(scene).play(take[0], { ...opts, base: volume / Math.max(0.01, (D.game?.sfx?.volume ?? 60) / 100) });
        const c = ctx(); if (!c) return;
        const g = c.createGain(); g.gain.value = volume;
        const d = scene.sound?.destination?.context === c ? scene.sound.destination : c.destination;
        g.connect(d); setTimeout(() => { try { g.disconnect(); } catch { /* gone */ } }, 3000);
        RECIPES[name](c, g, c.currentTime, 1, opts);
      } catch { /* no audio */ }
    };
  }
  return api;
}
