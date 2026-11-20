// Die Karawane, Stufe 1: Crew-Kern klein (#085 aus #040, Daniel 19.11.2026: „Ja, erst klein“: Leute, Aufnahme, Werkstätten-Jobs;
// die Rig-Moral kommt danach). design.md › Die Karawane: Sozialsystem. No DOM.
//
// Werkstatt › Leute (data/people.json): Bausteine für gewürfelte Siedler (Vornamen, Beinamen, Herkunft), Fähigkeiten (je eine Werkstatt-
// Funktion und ein Wert des Boni-Bus, Stufe 1–3), Eigenheiten (sichtbar oder verborgen, Gewicht, Wirkung als Text), Chancen.
// save.crew = [{ id, name, origin, skills: { id: level }, traits: [visible, hidden], seen (the hidden one shows), day (joined), job }]
// save.applicant = a person waiting at the fire (Bewerber), or null
//   job = '<unit>:<at>' a workshop in the rig; the person works there: her skill for that workshop's function adds to the Boni-Bus.

import { jobFactor } from './morale.js';
const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const lines = v => (Array.isArray(v) ? v : String(v || '').split('\n')).map(x => String(x).trim()).filter(Boolean);
const pickW = (rnd, list) => { const sum = list.reduce((n, x) => n + Math.max(0, x.weight ?? 1), 0); let r = rnd() * sum; for (const x of list) { r -= Math.max(0, x.weight ?? 1); if (r <= 0) return x; } return list[list.length - 1]; };

export function peopleConfig(D) {
  const P = D?.people || {};
  return {
    first: lines(P.first), nick: lines(P.nick), origins: lines(P.origins),
    skills: (P.skills || []).filter(s => s?.id), traits: (P.traits || []).filter(t => t?.id),
    fireChance: P.fireChance ?? 20, fireFromDay: P.fireFromDay ?? 2, revealDays: Math.max(1, P.revealDays ?? 3), maxSkill: 3, skillsPer: P.skillsPer ?? [1, 2],
  };
}
export const crew = save => (save.crew ??= []);

// one settler from the building blocks → a person (not yet in the crew)
export function rollPerson(D, seed = Math.floor(Math.random() * 2 ** 31)) {
  const C = peopleConfig(D), rnd = rng(seed), pick = a => a[Math.floor(rnd() * a.length)];
  const name = [pick(C.first.length ? C.first : ['Jo']), C.nick.length && rnd() < 0.6 ? `„${pick(C.nick)}“` : null].filter(Boolean).join(' ');
  const n = C.skillsPer[0] + Math.floor(rnd() * (C.skillsPer[1] - C.skillsPer[0] + 1)), skills = {};
  const pool = [...C.skills];
  for (let i = 0; i < n && pool.length; i++) { const s = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; skills[s.id] = 1 + Math.floor(rnd() * rnd() * C.maxSkill); }
  const open = C.traits.filter(t => !t.hidden), secret = C.traits.filter(t => t.hidden);
  const traits = [open.length ? pickW(rnd, open).id : null, secret.length ? pickW(rnd, secret).id : null].filter(Boolean);
  return { id: `c${seed.toString(36)}`, name, origin: C.origins.length ? pick(C.origins) : '', skills, traits, seen: false, day: null, job: null };
}
const trait = (D, id) => peopleConfig(D).traits.find(t => t.id === id) || null;
const skill = (D, id) => peopleConfig(D).skills.find(s => s.id === id) || null;
// what Leyla knows about her: the skills, the visible trait, the hidden one only once it showed
export function known(D, p) {
  return {
    skills: Object.entries(p.skills || {}).map(([id, lv]) => ({ id, name: skill(D, id)?.name || id, level: lv })),
    traits: (p.traits || []).map((id, i) => ({ id, ...(trait(D, id) || { name: id }), shown: i === 0 || p.seen })).filter(t => t.shown),
    hidden: (p.traits || []).length > 1 && !p.seen,
  };
}
export const skillText = (D, p) => known(D, p).skills.map(s => `${s.name} ${'●'.repeat(s.level)}`).join(' · ') || 'keine besondere Fähigkeit';

// take her in (the applicant at the fire, or someone from the road) → the person
export function admit(D, save, p) {
  const q = { ...p, day: save.day ?? 1, seen: false, job: null };
  crew(save).push(q);
  if (save.applicant?.id === p.id) save.applicant = null;
  return q;
}
export function dismiss(save, id) { const L = crew(save), i = L.findIndex(p => p.id === id); if (i >= 0) L.splice(i, 1); }
export function reject(save) { save.applicant = null; }

// arriving in the camp: maybe someone waits at the fire (Ruf zieht an); hidden traits show after a few days → { applicant, revealed: [{ name, trait }] }
export function campArrival(D, save, rnd = Math.random) {
  const C = peopleConfig(D), out = { applicant: null, revealed: [] };
  for (const p of crew(save)) if (!p.seen && (p.traits || []).length > 1 && (save.day ?? 1) - (p.day ?? 1) >= C.revealDays) { p.seen = true; out.revealed.push({ name: p.name, trait: trait(D, p.traits[1])?.name || p.traits[1] }); }
  if (!save.applicant && C.skills.length && (save.day ?? 1) >= C.fireFromDay && rnd() * 100 < C.fireChance) { save.applicant = rollPerson(D, Math.floor(rnd() * 2 ** 31)); out.applicant = save.applicant; }
  return out;
}

// ---------- jobs ----------
export function setJob(save, id, place) {
  for (const p of crew(save)) if (place && p.job === place) p.job = null;   // one person per workshop
  const p = crew(save).find(x => x.id === id);
  if (p) p.job = place || null;
  return p;
}
const benchAt = (save, place) => { const [ui, at] = String(place || '').split(':').map(Number); return save?.rig?.units?.[ui]?.workshops?.find(w => w.at === at) || null; };
// what a person brings at a workshop: her best skill for its function → { skill, level, stat, value } or null
export function jobEffect(D, save, p, place = p.job) {
  const w = benchAt(save, place), fn = w && D.workshops?.[w.id]?.function;
  if (!fn) return null;
  let best = null;
  for (const [id, lv] of Object.entries(p.skills || {})) {
    const s = skill(D, id);
    if (!s || !String(s.functions || '').split(',').map(x => x.trim()).includes(fn)) continue;
    const value = (Number(s.perLevel) || 0) * lv;
    if (!best || value > best.value) best = { skill: s.name || id, level: lv, stat: s.stat, value };
  }
  return best;
}
// for the Boni-Bus (mods.js): every person at work → [{ name, stat, value }]; a job at a workshop that is gone counts nothing
export function crewBonuses(D, save) {
  const k = jobFactor(D, save);   // #100 Rig-Moral: Hochstimmung stronger, angespannt weaker, Krise nothing
  return crew(save).filter(p => p.job).map(p => ({ p, e: jobEffect(D, save, p) })).filter(x => x.e?.stat && x.e.value && k > 0).map(x => ({ name: x.p.name, stat: x.e.stat, value: Math.round(x.e.value * k * 10) / 10 }));
}
// beds: sleeping places in the rig (Schlafkoje 1, Gästekoje its capacity) against heads (Leyla + crew): over is allowed (#040), shown
export function heads(D, save) {
  const beds = (save?.rig?.units || []).flatMap(u => u.workshops || []).reduce((n, w) => { const d = D.workshops?.[w.id]; return n + (d?.function === 'sleep' ? 1 : d?.function === 'guests' ? (d.capacity || 1) : 0); }, 0);
  return { heads: 1 + crew(save).length, beds };
}
// „2 Köpfe · 1 Bett“
export const headsText = H => `${H.heads} ${H.heads === 1 ? 'Kopf' : 'Köpfe'} · ${H.beds} ${H.beds === 1 ? 'Bett' : 'Betten'}${H.heads > H.beds ? ' · zu wenig Betten' : ''}`;
