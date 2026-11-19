// Gibberish voices (Daniel 19.11.2026: „anstatt Sprachausgabe eine Art von Gibberish, so wie bei Graveyard Keeper, die Sims … dass
// sie sich unterscheiden von Charakter zu Charakter“). Everything from code (Web Audio), nothing to translate: the real text only
// gives the rhythm — every vowel group of a word is a syllable, its vowel colours the sound, consonants before it click or hiss,
// commas and full stops pause, „?“ rises at the end, „!“ is louder. The same line always sounds the same (seeded by the text).
//
//   syllables(text, voice) → [{ t, dur, vowel, onset, pitch (semitones), gain }]        pure, Node and browser (tests)
//   speak(ctx, dest, voice, text, { volume }) → { stop(fade), end }                   schedules the line on an AudioContext
//   sound(ctx, dest, voice, kind, opts)                                               a short noise: Leyla's „hm“, a raider's „hey!“
//   voiceOf(D, who) → voice                                                           a companion's / person's / enemy's voice
//
// D.voices[id] = { name, style: human | beast | robot | glitch, pitch (Hz), range (semitones), speed (syllables/s), formant (%),
//                  breath (%), rasp (%), vibrato (%), volume (%), pool (crew people may roll it) }
export const VOICE_STYLES = [['human', 'Mensch (Vokale)'], ['beast', 'Grob (rau, tief)'], ['robot', 'Roboter (Piepser)'], ['glitch', 'Glitch (Störgeräusch)']];
export const VOICE_SOUNDS = [['hm', 'Hm (nachdenklich)'], ['ha', 'Ha! (entschlossen)'], ['mhm', 'Mhm (zustimmend)'], ['oh', 'Oh? (fragend)'], ['nope', 'Nee (ablehnend)'],
  ['alert', 'Hey! (entdeckt)'], ['hurt', 'Au (getroffen)'], ['die', 'Uuh… (fällt)'], ['taunt', 'Ha-ha (spottet)']];

// vowel formants F1/F2 (Hz) of an average adult voice; „formant“ % shifts them (small head = higher)
const VOWELS = { a: [800, 1200], e: [480, 1900], i: [300, 2300], o: [480, 860], u: [330, 760], ä: [600, 1750], ö: [430, 1500], ü: [300, 1750], y: [300, 1750] };
const PLOSIVE = new Set('pbtdkgqc'), HISS = new Set('szfvxjhß'), SOFT = new Set('mnlrw');
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rnd = (seed, k) => ((hash(`${seed}:${k}`) % 10000) / 10000);

export const DEFAULT_VOICE = { style: 'human', pitch: 180, range: 6, speed: 9, formant: 100, breath: 15, rasp: 0, vibrato: 10, volume: 100 };

// the syllables of a line, in seconds from the start
export function syllables(text, voice = DEFAULT_VOICE) {
  const v = { ...DEFAULT_VOICE, ...voice }, base = 1 / Math.max(2, v.speed), out = [];
  const tokens = String(text || '').toLowerCase().match(/[a-zäöüß]+|[.!?…,;:—–-]+/g) || [];
  const sentenceEnds = [];   // index into out where a sentence ends, with its mark
  let t = 0, n = 0;
  tokens.forEach((tok, w) => {
    if (!/[a-zäöüß]/.test(tok)) {   // punctuation: a pause, and it shapes the last sentence
      const mark = tok.includes('?') ? '?' : tok.includes('!') ? '!' : /[.…]/.test(tok) ? '.' : ',';
      t += mark === ',' ? base * 1.4 : base * 2.6;
      if (mark !== ',' && out.length) sentenceEnds.push({ at: out.length, mark });
      return;
    }
    const groups = [...tok.matchAll(/([^aeiouäöüy]*)([aeiouäöüy]+)/g)].slice(0, 4);
    if (!groups.length) groups.push(['', tok, 'e']);
    groups.forEach((m, k) => {
      const cons = m[1] || '', vow = m[2][0], c = cons.slice(-1);
      const onset = !c ? null : PLOSIVE.has(c) ? 'click' : HISS.has(c) ? 'hiss' : SOFT.has(c) ? 'soft' : 'click';
      const dur = base * (k === 0 ? 1.15 : 0.9) * (0.85 + rnd(tok, k) * 0.3) * (m[2].length > 1 ? 1.25 : 1);
      const pitch = (rnd(`${tok}#${w}`, k) - 0.5) * v.range;
      out.push({ t, dur, vowel: vow, onset, pitch, gain: 0.85 + rnd(tok, k + 9) * 0.25 });
      t += dur + base * 0.08; n++;
    });
    t += base * 0.35;   // between words
  });
  // the melody of each sentence: falls a little; a question rises at its end, an exclamation is louder and a bit higher
  let from = 0;
  for (const e of [...sentenceEnds, { at: out.length, mark: '.' }]) {
    const seg = out.slice(from, e.at);
    seg.forEach((s, k) => { s.pitch -= (k / Math.max(1, seg.length)) * 2; });
    const last = seg[seg.length - 1];
    if (last && e.mark === '?') { last.pitch += 5; last.rise = 4; if (seg.length > 1) seg[seg.length - 2].pitch += 2; }
    if (e.mark === '!') seg.forEach(s => { s.gain *= 1.25; s.pitch += 2; });
    from = e.at;
  }
  return out;
}
export const lineLength = (text, voice) => { const S = syllables(text, voice), l = S[S.length - 1]; return l ? l.t + l.dur : 0; };

// which voice speaks: the speaker's own (companions, people, enemies, Leyla), else one from the pool, picked by the name
export function voiceOf(D, who = {}) {
  const V = D?.voices || {};
  const id = who.voice || D?.companions?.[who.id]?.voice || D?.enemies?.[who.id]?.voice;
  if (id && V[id]) return { id, ...V[id] };
  const pool = Object.entries(V).filter(([, x]) => x.pool && (x.style || 'human') === (who.style || 'human'));
  if (!pool.length) return { id: null, ...DEFAULT_VOICE };
  const [pid, p] = pool[hash(String(who.name || who.id || '?')) % pool.length];
  return { id: pid, ...p };
}

// ---------- Web Audio ----------
let noiseBuf = null;
const noise = c => {
  if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
};
const shaper = (c, amount) => { const ws = c.createWaveShaper(), k = amount * 40, n = 1024, curve = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = (1 + k) * x / (1 + k * Math.abs(x)); } ws.curve = curve; return ws; };
const env = (g, t, a, len, peak) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + Math.max(a, len - 0.03)); g.gain.linearRampToValueAtTime(0.0001, t + len); };

// one syllable into `bus`, starting at absolute time t
function syllable(c, bus, v, s, t, nodes) {
  const style = v.style || 'human', f0 = (v.pitch || 180) * Math.pow(2, s.pitch / 12), k = (v.formant || 100) / 100, len = Math.max(0.05, s.dur);
  const peak = 0.22 * s.gain;
  if (style === 'robot') {   // a beep that slides: AvA's chirps
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'square'; f.type = 'bandpass'; f.frequency.value = 1800 * k; f.Q.value = 0.8;
    const up = s.rise ? 1.5 : 1 + (s.pitch % 2 ? 0.25 : -0.18);
    o.frequency.setValueAtTime(f0 * 2, t); o.frequency.exponentialRampToValueAtTime(f0 * 2 * up, t + len * 0.8);
    env(g, t, 0.006, len * 0.85, peak * 1.8); o.connect(f).connect(g).connect(bus); o.start(t); o.stop(t + len + 0.05); nodes.push(o);
    return;
  }
  if (style === 'glitch') {   // stepped random pitches and crackle
    const o = c.createOscillator(), g = c.createGain(); o.type = 'square';
    for (let i = 0; i * 0.025 < len; i++) o.frequency.setValueAtTime(f0 * (1 + rnd(s.vowel + s.t, i) * 2.5), t + i * 0.025);
    env(g, t, 0.003, len, peak * 1.3); o.connect(g).connect(bus); o.start(t); o.stop(t + len + 0.05); nodes.push(o);
    const n = noise(c), ng = c.createGain(), hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
    env(ng, t, 0.002, len * 0.4, peak * 0.9); n.connect(hp).connect(ng).connect(bus); n.start(t); n.stop(t + len); nodes.push(n);
    return;
  }
  // human / beast: a buzzing source through two vowel filters
  const [F1, F2] = VOWELS[s.vowel] || VOWELS.e;
  const o = c.createOscillator(), src = c.createGain(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain(), lp = c.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0 * (s.onset === 'soft' ? 0.94 : 1), t); o.frequency.linearRampToValueAtTime(f0 * (s.rise ? Math.pow(2, s.rise / 12) : 0.97), t + len);
  if (v.vibrato) { const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.5; lg.gain.value = f0 * (v.vibrato / 100) * 0.03; lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + len + 0.05); nodes.push(lfo); }
  f1.type = f2.type = 'bandpass'; f1.frequency.value = F1 * k; f2.frequency.value = F2 * k; f1.Q.value = 6; f2.Q.value = 9;
  lp.type = 'lowpass'; lp.frequency.value = 3600 * k;
  const g1 = c.createGain(), g2 = c.createGain(); g1.gain.value = 1; g2.gain.value = 0.6;
  o.connect(src); src.connect(f1).connect(g1).connect(lp); src.connect(f2).connect(g2).connect(lp);
  let tail = lp;
  const rasp = (v.rasp || 0) / 100 + (style === 'beast' ? 0.35 : 0);
  if (rasp > 0) {   // vocal fry: a fast wobble of the loudness and a little grit
    const ws = shaper(c, rasp), wg = c.createGain(); wg.gain.value = 1 / (1 + rasp * 2.2); tail.connect(ws).connect(wg); tail = wg;   // the grit, not louder
    const am = c.createOscillator(), ag = c.createGain(); am.frequency.value = 38 + rasp * 30; ag.gain.value = rasp * 0.5; am.connect(ag).connect(src.gain); am.start(t); am.stop(t + len + 0.05); nodes.push(am);
  }
  tail.connect(g).connect(bus);
  env(g, t + (s.onset === 'click' ? 0.012 : 0), s.onset === 'soft' ? 0.04 : 0.018, len, peak * 2.4);
  o.start(t); o.stop(t + len + 0.06); nodes.push(o);
  // breath, and the consonant in front
  const breath = (v.breath ?? 15) / 100;
  if (breath > 0 || s.onset === 'hiss' || s.onset === 'click') {
    const n = noise(c), nf = c.createBiquadFilter(), ng = c.createGain();
    nf.type = s.onset === 'hiss' ? 'highpass' : 'bandpass'; nf.frequency.value = s.onset === 'hiss' ? 4200 : F2 * k; nf.Q.value = 1.2;
    if (s.onset === 'hiss') env(ng, t, 0.01, 0.07, peak * 0.9);
    else if (s.onset === 'click') env(ng, t, 0.002, 0.018, peak * 1.6);
    else env(ng, t, 0.02, len, peak * breath * 1.5);
    n.connect(nf).connect(ng).connect(bus); n.start(t); n.stop(t + len + 0.05); nodes.push(n);
  }
}

// speak a line: returns a handle; stop(fade) ends it early (the player skipped the typing)
export function speak(c, dest, voice, text, opts = {}) {
  const v = { ...DEFAULT_VOICE, ...voice }, S = syllables(text, v), t0 = c.currentTime + 0.03, nodes = [];
  const bus = c.createGain(), gv = ((v.volume ?? 100) / 100) * (opts.volume ?? 1); bus.gain.value = Number.isFinite(gv) ? Math.max(0, gv) : 0.5;
  if (opts.radio) { const hp = c.createBiquadFilter(), lp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500; lp.type = 'lowpass'; lp.frequency.value = 2800; bus.connect(hp).connect(lp).connect(dest); }
  else bus.connect(dest);
  const max = opts.max ?? 8;   // a long line babbles a few seconds, not the whole paragraph
  for (const s of S) if (s.t < max) syllable(c, bus, v, s, t0 + s.t, nodes);
  const last = S.filter(s => s.t < max).pop(), end = t0 + (last ? last.t + last.dur : 0);
  let done = false;
  const stop = (fade = 0.08) => {
    if (done) return; done = true;
    const now = c.currentTime;
    try { bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(bus.gain.value, now); bus.gain.linearRampToValueAtTime(0.0001, now + fade); } catch { /* closed */ }
    setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch { /* already */ } } try { bus.disconnect(); } catch { /* gone */ } }, (fade + 0.05) * 1000);
  };
  setTimeout(() => { if (!done) { done = true; try { bus.disconnect(); } catch { /* gone */ } } }, (end - c.currentTime + 0.3) * 1000);
  return { stop, end, syllables: S.length };
}

// short noises: what Leyla says when she answers, what a raider shouts
const SOUNDS = { hm: 'hmm.', ha: 'ha!', mhm: 'mhm.', oh: 'oh?', nope: 'nö.', alert: 'hej!', hurt: 'au!', die: 'uuuh…', taunt: 'haha!' };
export function sound(c, dest, voice, kind, opts = {}) { return speak(c, dest, voice, SOUNDS[kind] || kind, opts); }
// which of Leyla's noises fits an answer: a question → „oh?“, refusing → „nö“, agreeing → „mhm“, leaving → „hm“, the rest → „ha!“
export function answerSound(label = '') {
  const l = String(label).toLowerCase();
  if (/\?$/.test(l) || /^wie |^was |^wo |^warum /.test(l)) return 'oh';
  if (/ablehn|nein|nicht|später|zurück|tschüss|abbrechen/.test(l)) return /tschüss|zurück/.test(l) ? 'hm' : 'nope';
  if (/annehm|ja\b|gut|ok|abgeben|kaufen|nehmen|aufnehmen/.test(l)) return 'mhm';
  return 'ha';
}
