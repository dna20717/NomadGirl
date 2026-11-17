// Entities (#047, Daniel 16./17.11.2026: „Das Konzept von Software existiert in dieser Welt nicht mehr … spezialisierte KIs, die
// aber alle kleine Eigenarten und Macken haben“; „Namen nach dem Schema wie Marble Sting … ein System, auf dessen Basis man diese
// passiven Companions generieren kann“). No DOM: game, workshop and tests. design.md › Hacking v3: Entities.
//
// The building blocks are in the workshop (area Entities, data/glitchlings.json): two name words (material + edge), talents with the
// workbench they shine in and the effect per bit, quirks, wishes, the machines they live in, how often each strength (1–5 bits) comes,
// and hand-made unique ones (always in every Durchgang). One seed = one set (a Durchgang rolls its own).
//
//   glitchling = { id, name, unique, talent, function, also, brand, bits, effect, stat, value, quirk, quirkKind, wish, home, description }
// brand (#049, Daniel 17.11.2026: „KIs brauchen einen Hersteller“): who builds this kind of AI (Begabung › Hersteller), a unique one may have its own
import { rng } from './worldmap.js';

const words = s => String(s || '').split(/[,|]/).map(x => x.trim()).filter(Boolean);
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const pick = (r, list) => list[Math.floor(r() * list.length)];
const weighted = (r, weights) => { const total = weights.reduce((a, b) => a + b, 0); let k = r() * total; for (let i = 0; i < weights.length; i++) if ((k -= weights[i]) < 0) return i; return 0; };

export function config(D) {
  const G = D.glitchlings || {};
  return { count: G.count ?? 12, bits: G.bitWeights?.length ? G.bitWeights.map(b => b.w || 0) : [40, 30, 18, 9, 3], off: G.off ?? 35, first: words(G.names?.first), second: words(G.names?.second),
    talents: (G.talents || []).filter(t => t.name), quirks: (G.quirks || []).filter(q => q.text), wishes: (G.wishes || []).filter(w => w.text), homes: words(G.homes), unique: (G.unique || []).filter(u => u.name) };
}

// the effect of a talent at a strength: „{n}“ = per bit × bits; in a workbench that is not its own only „Fremd %“ of it (Entities › Fremde Werkbank)
export function effectOf(C, talent, bits, own = true) {
  const t = typeof talent === 'string' ? C.talents.find(x => x.name === talent) : talent;
  if (!t) return { text: '', value: 0 };
  const value = Math.round((t.perBit || 0) * bits * (own ? 1 : C.off / 100) * 10) / 10;
  return { text: String(t.effect || '').replace('{n}', String(value)), value, stat: t.stat || null };
}
const make = (C, o) => {
  const t = C.talents.find(x => x.name === o.talent) || C.talents[0] || {}, e = effectOf(C, t, o.bits);
  return { id: slug(o.name), name: o.name, unique: !!o.unique, talent: t.name || '', function: t.function || null, also: t.also || null, brand: o.brand || t.brand || null, bits: o.bits,
    effect: e.text, stat: e.stat, value: e.value, quirk: o.quirk || '', quirkKind: o.quirkKind || null, wish: o.wish || '', home: o.home || '', description: o.description || '' };
};

// the Entities of one Durchgang: the unique ones marked „immer“ first, the rest rolled; no name and no name word twice
// the maker of an Entity (older ones, e.g. a gift from before #049, by their talent)
export function brandOf(D, g) { return g?.brand || config(D).talents.find(t => t.name === g?.talent)?.brand || null; }

export function generate(D, seed = 1, count = null) {
  const C = config(D), r = rng(seed), n = count ?? C.count, out = [], usedA = new Set(), usedB = new Set(), usedQ = new Set(), usedW = new Set();
  for (const u of C.unique) if (u.always && out.length < n) {
    out.push(make(C, { ...u, unique: true }));
    const [a, b] = u.name.split(/\s+/); usedA.add(a); usedB.add(b);
  }
  const A = () => C.first.filter(w => !usedA.has(w)), B = () => C.second.filter(w => !usedB.has(w));
  let guard = 0;
  while (out.length < n && A().length && B().length && guard++ < 500) {
    const a = pick(r, A()), b = pick(r, B()), name = `${a} ${b}`;
    if (out.some(g => g.name === name)) continue;
    usedA.add(a); usedB.add(b);
    const fresh = (list, used) => { const f = list.filter(x => !used.has(x.text)); return f.length ? f : list; };   // no quirk or wish twice while there are enough
    const q = C.quirks.length ? pick(r, fresh(C.quirks, usedQ)) : null, w = C.wishes.length ? pick(r, fresh(C.wishes, usedW)) : null;
    if (q) usedQ.add(q.text); if (w) usedW.add(w.text);
    out.push(make(C, { name, talent: C.talents.length ? pick(r, C.talents).name : '', bits: 1 + weighted(r, C.bits), quirk: q?.text, quirkKind: q?.kind,
      wish: w?.text || '', home: C.homes.length ? pick(r, C.homes) : '' }));
  }
  return out;
}
