// Preise bündeln (#069, Daniel 18.11.2026, Eleganz-Prüfung Punkt 3: „Preise an fünf Stellen“): one place that knows every factor of a
// price, so a new discount counts everywhere at once. No DOM.
//   factors: the gang's Ruf (Ereignis-Baukasten › Ruf › Preise), the mood of the people (Stimmung › Preise %), the danger of the place
//   (Gefahr, Je Gefahrstufe %), the Influencer of a brand (#064). Item values with their maker's Preis come from brands.valueOf.
//   pay(D, save, base, o)  → Δ Leyla pays (base > 0) : rounded, with all factors that make it dearer or cheaper
//   earn(D, save, base, o) → Δ Leyla gets: Ruf and mood work the other way, danger pays more, no Influencer
//   o: { gang, mood (%, 100 = plain), danger (1–5), scale (Je Gefahrstufe as 0.25), brand, markup (shop factor, e.g. 1.5) }
//   factors(D, save, o, buying) → [{ label, f }] for a line like „Ruf ×0,8 · Influencer ×0,8“
import { repPrice } from './reputation.js';
import { brandDiscount } from './brand_perks.js';

export function factors(D, save, o = {}, buying = true) {
  const out = [], rep = o.gang ? repPrice(D, save, o.gang) : 1, mood = (o.mood ?? 100) / 100, k = 1 + (o.scale ?? 0) * ((o.danger ?? 1) - 1);
  if (o.markup && o.markup !== 1) out.push({ label: 'Aufschlag', f: o.markup });
  if (rep !== 1) out.push({ label: `Ruf ${o.gang}`, f: buying ? rep : 1 / rep });
  if (mood !== 1) out.push({ label: 'Stimmung', f: buying ? mood : 1 / mood });
  if (k !== 1) out.push({ label: 'Gefahr', f: k });
  const off = buying && o.brand ? brandDiscount(D, save, o.brand) : 1;
  if (off !== 1) out.push({ label: 'Influencer', f: off, influencer: o.brand });
  return out;
}
const apply = (base, fs) => fs.reduce((v, x) => v * x.f, base);
// rounded before the Influencer (as the road always did): the discount shows as a clean cut of the price the button would have shown
export function pay(D, save, base, o = {}) {
  const fs = factors(D, save, o, true), off = fs.find(x => x.influencer), v = Math.round(apply(base, fs.filter(x => !x.influencer)));
  return off ? Math.round(v * off.f) : v;
}
export const earn = (D, save, base, o = {}) => Math.round(apply(base, factors(D, save, o, false)));
export const factorText = fs => fs.map(x => `${x.label} ×${String(Math.round(x.f * 100) / 100).replace('.', ',')}`).join(' · ');
