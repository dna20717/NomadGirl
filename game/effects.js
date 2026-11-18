// Effekt-Leiste (#067, Daniel 18.11.2026, Eleganz-Prüfung Punkt 4: „Effekte mit Ablaufzeit ohne Zuhause … den Influencer siehst du nach dem
// Toast nirgends“): everything that is in force right now, from wherever it lives, as one list for the HUD. No DOM.
//   activeEffects(D, save, ctx) → [{ id, label, sub, kind: 'good' | 'bad' | 'info', left (h) | null }]
//   ctx: { run: true, sky (scene.weatherRun), turf (scene.turf.state()) } — what only the scene knows
import { clockHours } from './tank.js';
import { influencer } from './brand_perks.js';
import { powerBoost } from './stations.js';
import { raining } from './rain.js';
import { brandSets } from './brand_perks.js';
import { workers } from './workers.js';

const hoursText = h => h >= 1 ? `${Math.round(h)} h` : `${Math.max(1, Math.round(h * 60))} min`;

export function activeEffects(D, save, ctx = {}) {
  if (!save) return [];
  const out = [], now = clockHours(save);
  // buffs for the next run (cooking, sleeping, resting): they last one run
  for (const b of save.buffs || []) out.push({ id: `buff:${b}`, label: D.buffs?.[b]?.name || b, sub: ctx.run ? 'in diesem Run' : 'für den nächsten Run', kind: 'good', left: null });
  // #064 Influencer
  const I = influencer(D, save);
  if (I) out.push({ id: 'influencer', label: `Influencer: ${D.brands[I.brand].short || I.name}`, sub: `−${I.discount} % auf ${I.name} · noch ${hoursText(I.left)}`, kind: 'good', left: I.left });
  // #013 the regulator in the green band
  const p = powerBoost(save, now);
  if (p) out.push({ id: 'power', label: `Strom +${p} ⚡`, sub: `noch ${hoursText((save.powerBoost.until || now) - now)}`, kind: 'good', left: (save.powerBoost.until || now) - now });
  // #064 Markentreue
  for (const x of brandSets(D, save).list.filter(x => x.on)) out.push({ id: `set:${x.brand}`, label: `Markentreue: ${x.name}`, sub: `${x.n} Teile`, kind: 'good', left: null });
  // #060 Entities at work (one entry, the details are in the Bit-Farm)
  const W = workers(D, save);
  if (W.length) { const off = W.filter(k => k.flaw.factor === 0); out.push({ id: 'workers', label: `${W.length} Worker`, sub: off.length ? `${off.map(k => `${k.g.name}: ${k.flaw.why}`).join(' · ')}` : W.map(k => k.g.name).join(', '), kind: off.length ? 'info' : 'good', left: null }); }
  // #063 weather: in the camp the rain, in a run what the scene measured
  if (ctx.run && ctx.sky) {
    if (ctx.sky.rain) out.push({ id: 'rain', label: 'Regen', sub: 'Gegner hören schlechter', kind: 'info', left: null });
    if (ctx.sky.fog) out.push({ id: 'fog', label: 'Nebel', sub: 'alle sehen weniger', kind: 'info', left: null });
    if (ctx.sky.dust) out.push({ id: 'dust', label: 'Staub', sub: 'kürzere Sicht', kind: 'info', left: null });
  } else if (!ctx.run && raining(D, save)) out.push({ id: 'rain', label: 'Regen', sub: 'die Zisterne füllt sich', kind: 'info', left: null });
  // #061 the gang's peace in a run
  if (ctx.run && ctx.turf?.peace) out.push(ctx.turf.broken ? { id: 'turf', label: `Frieden gebrochen: ${ctx.turf.gang}`, sub: 'sie greifen an', kind: 'bad', left: null }
    : { id: 'turf', label: `Waffenstillstand: ${ctx.turf.gang}`, sub: ctx.turf.friend ? 'Freunde: reden, handeln' : 'Kisten unter Zeugen = Diebstahl', kind: 'good', left: null });
  return out;
}
// a short key for the HUD's redraw (changes when an effect comes, goes or its hours tick)
export const effectsKey = list => list.map(e => `${e.id}:${e.left == null ? '' : Math.ceil(e.left)}:${e.kind}`).join(',');
