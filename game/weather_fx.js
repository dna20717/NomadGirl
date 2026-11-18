// Wetter mit Folgen (#063, Daniel 18.11.2026: „auch machen, aber mit Meldungen“): the weather that only looked nice now does something,
// and every effect says so in a message. No DOM.
//   on the road  rain fills the cistern (it always did in event time; now there is a message on arrival); a sandstorm makes dust walls,
//                wrecks and creatures likelier, morning fog flares and road blocks, rain breakdowns (the weight of situations by what
//                stands by the road)
//   in a POI     rain: steps drown in the patter (enemies hear less); fog: they see less, and so does Leyla; dust: a little less sight
import { legWeather } from './road.js';
import { rainingAt, rainHours } from './rain.js';
import { clockHours } from './tank.js';

// what the weather does to the situations on the road (× weight, by Lage › Am Straßenrand)
export const ROAD_BIAS = {
  dust: { storm: 4, wreck: 2, creatures: 1.5, drone: 1.5 },
  fog: { flare: 3, barrier: 1.5, hitchhiker: 1.5 },
  wet: { breakdown: 2.5, truck: 1.5, campfire: 0.4 },
};
// the sky of one leg: { dust, fog, wet, bias, line } (line = the message, '' when the weather is plain)
export function legSky(D, save, seed, i, region, h0, h1) {
  const w = legWeather(D, seed, i, region, h0), wet = rainHours(D, save, h0, h1) > 0 || rainingAt(D, save, h0);
  const kinds = [w.dust > 0 && 'dust', w.fog > 0 && 'fog', wet && 'wet'].filter(Boolean), bias = {};
  for (const k of kinds) for (const [r, f] of Object.entries(ROAD_BIAS[k])) bias[r] = (bias[r] ?? 1) * f;
  const line = [w.dust > 0 && 'Sandsturm auf der Strecke: Staubwände, Wracks und Viecher häufiger', w.fog > 0 && 'Morgennebel: Rauchfackeln und Sperren tauchen spät auf', wet && 'Regen unterwegs: Pannen häufiger, die Zisterne füllt sich'].filter(Boolean);
  return { dust: w.dust, fog: w.fog, wet, bias, kinds, line: line.join(' · ') };
}
// the cisterns of the rig: water now (to compare before and after a drive)
export function cisternWater(D, save, level) {
  let n = 0;
  (save.rig?.units || []).forEach((u, ui) => (u.workshops || []).forEach(w => { if (D.workshops?.[w.id]?.function === 'cistern') n += level(D, save, w.id, `${ui}:${w.at}`).water; }));
  return n;
}
// the weather over a POI when the run starts → { rain, fog, dust, hear (×), sight (×), fogSight (×), line }
export function runSky(D, save, region) {
  const h = clockHours(save), seed = ((save.map?.seed ?? 1) * 31 + (save.day || 1)) | 0;
  const w = legWeather(D, seed, 99, region || '', h), rain = rainingAt(D, save, h);
  const fog = w.fog > 0, dust = !fog && w.dust > 0;
  const out = { rain, fog, dust, hear: rain ? 0.6 : 1, sight: fog ? 0.7 : dust ? 0.85 : 1, fogSight: fog ? 0.75 : dust ? 0.9 : 1 };
  out.line = [rain && 'Regen: deine Schritte gehen im Prasseln unter, Gegner hören schlechter', fog && 'Nebel zieht in die Gänge: Gegner sehen schlechter, du auch', dust && 'Staub hängt in der Luft: die Sicht ist etwas kürzer'].filter(Boolean).join(' · ');
  return out;
}
