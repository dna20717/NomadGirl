// Rig-Radio (#090, Daniel 19.11.2026: „#087–#091 Systeme bauen“; Ideenspeicher: „Sender mit Musik aus Code, Durchsagen aus BigCityDelta,
// Lore-Häppchen, Hinweise auf POIs, vielleicht eine DJ-Entity mit Banter“). No DOM, no audio: the stations, a song as notes (played by
// game/radio_audio.js), and what the DJ says between the songs. The talk knows the game: brand ads (Lore › Marken › Werbung), the
// navigator's rain (#087), the fronts of the turf war (#089), rumours about places on the travel map, lines from the workshop.
// Everything from the area „Radio“ (data/radio.json).
import { storyContext, eligible, fill as storyFill } from '../engine/storylets.js';
import { entityFrom } from './glitchlings.js';
import { rainOutlook } from './weather_fx.js';
import { fronts } from './turf_war.js';
import { repOf, levelOf } from './reputation.js';
import { placeOf } from './worldmap.js';
import { ITEM_CATEGORIES, optionLabel } from '../engine/schema.js';
import { RADIO_TALK } from './radio_kinds.js';
export { RADIO_STYLES, RADIO_TALK, RADIO_SCALES, RADIO_KEYS } from './radio_kinds.js';

const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], pentatonic: [0, 3, 5, 7, 10] };
const STYLE = {   // defaults per style: tempo, how busy, which voices
  synth: { bpm: 96, scale: 'minor', drums: 'four', lead: 'arp' },
  dust: { bpm: 78, scale: 'dorian', drums: 'shaker', lead: 'pluck' },
  glitch: { bpm: 128, scale: 'minor', drums: 'broken', lead: 'stutter' },
  ambient: { bpm: 60, scale: 'pentatonic', drums: null, lead: 'bells' },
};

export function radioConfig(D) {
  const R = D?.radio || {};
  const st = (R.stations || []).filter(s => s.id && s.name).map(s => ({ ...s, style: STYLE[s.style] ? s.style : 'synth' }));
  return { enabled: R.enabled !== false, volume: (R.volume ?? 35) / 100, song: Array.isArray(R.song) ? R.song : [45, 75], talk: R.talkSeconds ?? 9,
    talkEvery: Math.max(1, R.talkEvery ?? 1), weights: Object.fromEntries((R.weights || []).filter(w => w.kind).map(w => [w.kind, Number(w.weight) || 0])),
    lines: R.lines || {}, words: { a: R.titleA || [], b: R.titleB || [] }, stations: st, jammed: R.jammed || 'Rauschen. {gang} senden nicht für Leute wie dich.' };
}

// #103 Radio-DJs als Entities (Daniel 19.11.2026: „mit Porträt im Chip, später auch im Duell“): every station's DJ is a full Entity
// (Radio › Sender › DJ-Begabung, DJ-Bits), its face from its name, its quirk the DJ line. → Entity or null without a DJ
export function djOf(D, st) {
  if (!st?.dj) return null;
  const T = (D?.glitchlings?.talents || []).filter(t => t?.name), byStyle = { synth: 0, dust: 1, glitch: 2, ambient: 3 }[st.style] ?? 0;
  const talent = st.djTalent && T.some(t => t.name === st.djTalent) ? st.djTalent : T.length ? T[byStyle % T.length].name : '';
  const g = entityFrom(D, { name: st.dj, talent, bits: Math.max(1, Math.min(5, Number(st.djBits) || 3)), quirk: st.djLine || '', home: st.name, character: 'DJ' });
  return { ...g, id: `dj_${st.id}`, dj: st.id, ...(st.gang ? { gang: st.gang } : {}) };
}
// a tiny seeded random (mulberry32), so a song with the same seed is the same song
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, list) => list[Math.floor(r() * list.length)];

export function songTitle(D, seed) {
  const W = radioConfig(D).words, r = rng(seed * 7 + 3);
  const a = W.a.length ? pick(r, W.a) : 'Rostiger', b = W.b.length ? pick(r, W.b) : 'Mond';
  return `${a} ${b}`;
}

// a song as notes: 4 bars of 16 steps, looped; { bpm, steps: 64, events: [{ step, voice, note (MIDI), len (steps), vel }], title }
// voices: pad (chords), bass, lead, kick, snare, hat, noise
export function song(D, station, seed) {
  const S = STYLE[station.style] || STYLE.synth, r = rng(seed), scale = SCALES[station.scale] || SCALES[S.scale] || SCALES.minor;
  const root = 45 + Number(station.key ?? Math.floor(rng(seed + 11)() * 12)) % 12, bpm = station.bpm || S.bpm;
  const deg = (d, oct = 0) => root + 12 * (oct + Math.floor(d / scale.length)) + scale[((d % scale.length) + scale.length) % scale.length];
  const prog = pick(r, [[0, 5, 3, 4], [0, 3, 4, 3], [0, 6, 5, 4], [0, 4, 5, 3], [0, 2, 3, 4]]).map(d => Math.min(d, scale.length - 1));
  const ev = [], add = (step, voice, note, len, vel = 1) => ev.push({ step, voice, note, len, vel });
  for (let bar = 0; bar < 4; bar++) {
    const d = prog[bar], b0 = bar * 16;
    // pad: the chord (1-3-5 of the scale degree), whole bar
    if (station.style !== 'glitch' || bar % 2 === 0) for (const k of [0, 2, 4]) add(b0, 'pad', deg(d + k, 1), station.style === 'glitch' ? 32 : 16, 0.5);
    // bass
    const bassSteps = { synth: [0, 3, 6, 8, 11, 14], dust: [0, 8, 10], glitch: [0, 2, 5, 7, 8, 13], ambient: [0] }[station.style];
    for (const s of bassSteps) add(b0 + s, 'bass', deg(d, s === 10 ? 0 : -1) + (s === 10 ? 7 : 0), station.style === 'ambient' ? 16 : 2, 0.9);
    // lead
    if (S.lead === 'arp') for (let s = 0; s < 16; s += 2) add(b0 + s, 'lead', deg(d + [0, 2, 4, 7][(s / 2) % 4], 2), 1, 0.45);
    if (S.lead === 'pluck') for (const s of [0, 3, 6, 8, 11, 14]) if (r() < 0.8) add(b0 + s, 'lead', deg(d + pick(r, [0, 2, 4, 5]), 1), 3, 0.6);
    if (S.lead === 'stutter') for (let s = 0; s < 16; s++) if (r() < 0.32) add(b0 + s, 'lead', deg(d + pick(r, [0, 1, 4, 7, 8]), 2), 1, 0.5);
    if (S.lead === 'bells') for (const s of [0, 6, 10]) if (r() < 0.6) add(b0 + s, 'lead', deg(d + pick(r, [0, 2, 4, 7]), 2), 8, 0.35);
    // drums
    if (S.drums === 'four') { for (const s of [0, 4, 8, 12]) add(b0 + s, 'kick', 0, 1); for (const s of [4, 12]) add(b0 + s, 'snare', 0, 1, 0.7); for (let s = 2; s < 16; s += 4) add(b0 + s, 'hat', 0, 1, 0.4); }
    if (S.drums === 'shaker') { add(b0, 'kick', 0, 1, 0.7); add(b0 + 8, 'kick', 0, 1, 0.5); for (let s = 0; s < 16; s += 2) add(b0 + s, 'hat', 0, 1, s % 4 ? 0.25 : 0.4); }
    if (S.drums === 'broken') { for (let s = 0; s < 16; s++) { if (r() < 0.22 || s === 0) add(b0 + s, 'kick', 0, 1, 0.9); else if (r() < 0.15) add(b0 + s, 'snare', 0, 1, 0.6); if (r() < 0.5) add(b0 + s, 'hat', 0, 1, 0.3); } if (r() < 0.5) add(b0 + 12, 'noise', 0, 4, 0.4); }
  }
  return { bpm, steps: 64, events: ev.sort((a, b) => a.step - b.step), title: songTitle(D, seed), seed };
}

// placeholders {x} in a line
const fill = (t, v) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
const linesOf = (C, kind) => (C.lines?.[kind] || []).filter(Boolean);

// what can be said right now, per kind → [text]; save may be null (workshop preview)
export function talkPool(D, save, station, r = Math.random) {
  const C = radioConfig(D), out = {}, v = { station: station.name, freq: station.freq || '', dj: station.dj || 'die Stimme', djLine: station.djLine || '' };
  out.ident = linesOf(C, 'ident').map(t => fill(t, v));
  // ads: every brand with ads (Lore › Marken › Werbung, „|“) or a slogan; bankrupt brands still advertise
  out.ad = Object.values(D.brands || {}).flatMap(b => {
    const ads = String(b.ads || '').split('|').map(x => x.trim()).filter(Boolean).concat(b.slogan ? [b.slogan] : []);
    return ads.map(ad => fill(pick(r, linesOf(C, 'ad').length ? linesOf(C, 'ad') : ['{brand}: „{ad}“']), { ...v, brand: b.name, ad, slogan: b.slogan || ad }) + (b.status === 'bankrupt' || b.status === 'pleite' ? ' (Die Firma gibt es nicht mehr. Die Werbung läuft weiter.)' : ''));
  });
  if (save) {
    const O = rainOutlook(D, save, 2), rain = O.find(x => x.rain), hh = h => String(Math.floor(h)).padStart(2, '0');
    const when = rain ? `${rain.day === save.day ? 'Heute' : 'Morgen'} Regen von ${hh(rain.rain.from)} bis ${hh(rain.rain.to)} Uhr` : 'Heute und morgen trocken';
    out.weather = linesOf(C, 'weather').map(t => fill(t, { ...v, forecast: when }));
    const F = fronts(D, save);
    out.war = F.length ? F.map(f => fill(pick(r, linesOf(C, 'war').length ? linesOf(C, 'war') : ['{a} gegen {b}.']), { ...v, a: f.ga, b: f.gb, place: placeOf(D, save, f.a)?.name || '', place2: placeOf(D, save, f.b)?.name || '' })) : [];
    // #102 what changed hands lately (the gangs fight on their own)
    for (const x of (save.turfWar?.log || []).filter(x => (save.day || 1) - x.day <= 3)) out.war.push(`Eilmeldung von der Front: ${x.to} haben ${x.place} übernommen. ${x.from} lecken ihre Wunden.`);
    const m = save.map, seen = new Set(m?.visited || []);
    const rumours = (m?.nodes || []).filter(n => !seen.has(n.id) && (n.hints || []).length && placeOf(D, save, n.id)?.name);
    out.tip = rumours.map(n => fill(pick(r, linesOf(C, 'tip').length ? linesOf(C, 'tip') : ['In {place} soll {hint} liegen.']), { ...v, place: placeOf(D, save, n.id).name, hint: optionLabel(ITEM_CATEGORIES, pick(r, n.hints)) || 'was liegen' }));
    // #167 Storylets › Radio-Gerücht: places she has not seen yet, with their story (who holds them, what happened there)
    for (const n of (m?.nodes || []).filter(n => !seen.has(n.id) && n.poi)) { const ctx = storyContext(D, save, n), [hit] = eligible(D, ctx, 'rumor'); if (hit) out.tip.push(storyFill(D, ctx, hit[1].text)); }
  }
  out.lore = linesOf(C, 'lore').map(t => fill(t, v));
  return out;
}
// one talk segment: { kind, text } (weights from Radio › Anteile, kinds without lines are skipped)
export function talk(D, save, station, r = Math.random) {
  const C = radioConfig(D), pool = talkPool(D, save, station, r);
  const kinds = RADIO_TALK.map(([k]) => k).filter(k => pool[k]?.length && (C.weights[k] ?? 1) > 0);
  if (!kinds.length) return { kind: 'ident', text: `${station.name}${station.freq ? ` · ${station.freq}` : ''}` };
  let w = r() * kinds.reduce((n, k) => n + (C.weights[k] ?? 1), 0);
  const kind = kinds.find(k => (w -= (C.weights[k] ?? 1)) < 0) || kinds[kinds.length - 1];
  const t = pick(r, pool[kind]);
  return { kind, text: t.charAt(0).toUpperCase() + t.slice(1) };
}
// a gang's station is jammed for her enemies (Radio › Sender › Gang)
export function jammed(D, save, station) {
  if (!station?.gang || !save) return null;
  return levelOf(D, repOf(save, station.gang)) === 'feind' ? fill(radioConfig(D).jammed, { gang: station.gang }) : null;
}
