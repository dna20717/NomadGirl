// Rig-Moral (#100, #040 Teil 2; design.md › Die Karawane › Rig-Moral + Eigenheiten). No DOM.
// One shared mood of the crew from what the rig gives them: Betten, Essen, Wasser, Spaß, Sicherheit, Platz (heads against the rig),
// coloured by the traits of every person. It wanders towards its target by Ereignis-Zeit (no jumps). Levels: Hochstimmung (jobs
// stronger), Stabil, Angespannt (jobs weaker), Krise (jobs give nothing, someone may leave). Without crew there is no morale.
//   save.morale = { value 0–100, at (absolute hour of the last update) }
// Werte in Werkstatt › Leute › Moral (data/people.json › morale).
import { crew, heads } from './crew.js';

export function moraleConfig(D) {
  const M = D?.people?.morale || {};
  return {
    base: M.base ?? 50, drift: M.drift ?? 15, bed: M.bed ?? 10, noBed: M.noBed ?? 12, food: M.food ?? 8, hunger: M.hunger ?? 15, foodPer: M.foodPer ?? 2,
    water: M.water ?? 5, fun: M.fun ?? 10, safe: M.safe ?? 8, danger: M.danger ?? 4, crowd: M.crowd ?? 5, cheer: M.cheer ?? 5, thief: M.thief ?? 5,
    high: M.high ?? 75, tense: M.tense ?? 40, crisis: M.crisis ?? 20, jobHigh: M.jobHigh ?? 25, jobTense: M.jobTense ?? -25, leave: M.leave ?? 30,
  };
}
export const LEVELS = [['high', 'Hochstimmung'], ['stable', 'Stabil'], ['tense', 'Angespannt'], ['crisis', 'Krise']];
const traitCount = (save, id) => crew(save).filter(p => (p.traits || []).includes(id)).length;
const fns = (D, save) => (save?.rig?.units || []).flatMap(u => u.workshops || []).map(w => D.workshops?.[w.id]?.function).filter(Boolean);

// where the target comes from → { target, parts: [{ label, value }] } (no crew: null)
export function moraleTarget(D, save) {
  if (!crew(save).length) return null;
  const M = moraleConfig(D), H = heads(D, save), F = fns(D, save), parts = [], add = (label, value) => { if (value) parts.push({ label, value: Math.round(value) }); };
  parts.push({ label: 'Grundstimmung', value: M.base });
  // Betten
  if (H.beds >= H.heads) add('Ein Bett für jeden', M.bed); else add(`${H.heads - H.beds} ${H.heads - H.beds === 1 ? 'Bett fehlt' : 'Betten fehlen'}`, -M.noBed * (H.heads - H.beds));
  // Essen (Feinschmecker: zählt doppelt)
  const gourmet = 1 + traitCount(save, 'feinschmecker'), food = save.food || 0;
  if (food >= H.heads * M.foodPer) add(`Vorräte reichen (${food} für ${H.heads})`, M.food * gourmet);
  else if (food < H.heads) add(`Vorräte knapp (${food} für ${H.heads})`, -M.hunger * gourmet);
  // Wasser, Spaß
  if (F.includes('cistern')) add('Zisterne', M.water);
  if (F.includes('chill')) add('Chill-Ecke', M.fun);
  const cheer = traitCount(save, 'frohnatur'); if (cheer) add(`Frohnatur${cheer > 1 ? ` ×${cheer}` : ''}`, M.cheer * cheer);
  // Sicherheit (Angsthase: zählt doppelt): Waffen im Rig gegen die Gefahr am Ort
  const scared = 1 + traitCount(save, 'angsthase'), armed = F.includes('armory') || (save.rig?.parts?.weapon || []).some(Boolean);
  if (armed) add('Bewaffnet', M.safe * scared);
  const node = save.map?.nodes?.find?.(n => n.id === save.location), danger = Number(node?.danger ?? D.locations?.[save.location]?.danger ?? 0) || 0;
  if (danger > 1) add(`Gefahr am Ort (Stufe ${danger})`, -M.danger * (danger - 1) * scared);
  // Platz (Einzelgänger: zählt doppelt): Köpfe gegen die Plätze im Rig
  const places = (save.rig?.units || []).reduce((n, u) => n + (u.workshops || []).length, 0), loner = 1 + traitCount(save, 'einzelgaenger');
  if (H.heads > places) add('Eng im Rig', -M.crowd * (H.heads - places) * loner);
  // verborgene Eigenheiten wirken, auch bevor Leyla sie kennt
  const thieves = traitCount(save, 'hamster'); if (thieves) add('Vorräte verschwinden', -M.thief * thieves);
  const target = Math.max(0, Math.min(100, parts.reduce((n, p) => n + p.value, 0)));
  return { target, parts };
}
export function levelOf(D, value) {
  const M = moraleConfig(D);
  const id = value >= M.high ? 'high' : value >= M.tense ? 'stable' : value >= M.crisis ? 'tense' : 'crisis';
  return { id, name: LEVELS.find(l => l[0] === id)[1], jobs: id === 'high' ? M.jobHigh : id === 'tense' ? M.jobTense : id === 'crisis' ? -100 : 0 };
}
// the morale now (without moving it) → { value, target, level, parts } or null without crew
export function morale(D, save) {
  const T = moraleTarget(D, save);
  if (!T) return null;
  const value = save.morale?.value ?? T.target;
  return { value: Math.round(value), target: T.target, parts: T.parts, level: levelOf(D, value) };
}
// time passed: the value wanders towards the target (drift per day); in a crisis someone may leave each full day
// → { value, target, level, changed, left: [names] }
export function tickMorale(D, save, rnd = Math.random) {
  const T = moraleTarget(D, save), now = (save.day || 1) * 24 + (save.hour || 0);
  if (!T) { delete save.morale; return null; }
  const M = moraleConfig(D), st = save.morale ??= { value: T.target, at: now }, before = levelOf(D, st.value).id;
  const days = Math.max(0, now - (st.at ?? now)) / 24, step = M.drift * days, left = [];
  st.value = st.value < T.target ? Math.min(T.target, st.value + step) : Math.max(T.target, st.value - step);
  st.value = Math.round(st.value * 10) / 10;
  if (levelOf(D, st.value).id === 'crisis') for (let d = 0; d < Math.floor(days) && crew(save).length; d++) if (rnd() * 100 < M.leave) {
    const L = crew(save), i = Math.floor(rnd() * L.length), p = L.splice(i, 1)[0]; left.push(p.name);
  }
  st.at = now;
  const level = levelOf(D, st.value);
  return { value: Math.round(st.value), target: T.target, level, changed: level.id !== before, left };
}
// the jobs' factor for the Boni-Bus: 1.25 in Hochstimmung, 0.75 angespannt, 0 in der Krise
export function jobFactor(D, save) { const m = morale(D, save); return m ? Math.max(0, 1 + m.level.jobs / 100) : 1; }
