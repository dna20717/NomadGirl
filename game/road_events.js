// The Ereignis-Baukasten (#054, Daniel 18.11.2026: „mehr Abwechslung in den Ereignissen unterwegs. Bau ein System, aus dem man diese
// Situationen generieren kann“). An incident on the road is put together from parts (data/road_events.json, Welt › Ereignis-Baukasten):
//   Lage (situation): where and what: name and text templates, what stands by the road, who (Gegner-Bausätze), when, how dangerous,
//     which answers fit, its loot
//   Stimmung (mood): how the people are: an adjective and a sentence, prices up or down, risk up or down, friendly and/or hostile
//   Antwort (answer): what Leyla can do: time, fuel, food, Δ, damage, a thing it uses or gives, a loot roll, a risk that it goes wrong
//   Wörter: gangs, cargo, things, creatures for the templates
// Templates: {mood} {place} {region} {brand} {group} {cargo} {thing} {creature} {n} {price}; several variants separated by „|“.
// The danger of the place she drives to makes paying dearer, hurting harder and rewards bigger (Regeln › je Gefahrstufe).
// The result has the shape of a hand-made encounter (Welt › Encounter), so the road, the window and travel.choose take it as it is.
// #055 Ruf, Folgen, Ketten: a situation may belong to a gang (the destination's or any) and only happen in a range of Leyla's Ruf with it;
// the Ruf picks the mood (friends are never met with hostile moods, so they never attack). Answers change the Ruf („rep“), set or clear
// Merker („flag“, „-flag“), give a buff, and may lead to a next situation („antwort>lage“): the next leg brings it, a story over three or
// four legs. Situations with „Nur als Folge“ only come that way, „needs“/„not“ ask for Merker (who was helped turns up again).
// Placeholders also {gang} {rival} {motto}.
// No DOM.
import { mapBrands, valueOf } from './brands.js';
import { brandDiscount, influencer } from './brand_perks.js';
import { gangs, repOf, levelOf, gangOfPlace, repPrice } from './reputation.js';
import { NEED_KEYS, hasNeeds, needBlocked, needTag } from './needs.js';
import { ok as condOk } from './conditions.js';
import { pay, earn } from './pricing.js';

const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
const variants = s => String(s || '').split('|').map(x => x.trim()).filter(Boolean);
const list = s => (Array.isArray(s) ? s : String(s || '').split(',')).map(x => String(x).trim()).filter(Boolean);
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

export const GANG_FROM = [['', 'keine Gang'], ['here', 'die Gang des Ziels (sonst eine zufällige)'], ['any', 'eine zufällige Gang']];
export const ANSWER_WHEN = [['any', 'immer'], ['friendly', 'nur bei freundlicher Stimmung'], ['hostile', 'nur bei feindseliger Stimmung']];

export function eventsConfig(D) {
  const E = D?.roadEvents || {};
  return { share: Math.max(0, Math.min(100, E.share ?? 70)), scale: (E.scale ?? 25) / 100, maxAnswers: Math.max(2, E.maxAnswers ?? 4),
    situations: (E.situations || []).filter(s => s.id), moods: (E.moods || []).filter(m => m.id), answers: (E.answers || []).filter(a => a.id), words: E.words || {} };
}

// the situations that may happen now (time of day, danger), by weight; id forces one
// (#055) not „only as a follow-up“, Merker needed / forbidden, once per Durchgang, the Ruf with its gang in range
export function situationsFor(D, { night = false, danger = 1, save = null, here = null } = {}) {
  const seen = new Set(save?.road?.seen || []);
  return eventsConfig(D).situations.filter(s => (s.weight ?? 1) > 0 && !s.only && (!s.time || s.time === 'any' || (s.time === 'night') === night) && (s.danger ?? 1) <= danger
    && condOk(D, save, s) && !(s.once && seen.has(s.id)) && (!(s.gang || s.gangName) || gangFor(D, s, save, here, () => 0.5) !== undefined));
}
const inRange = (s, n) => { const [a, b] = Array.isArray(s.rep) ? s.rep : [-100, 100]; return n >= (a ?? -100) && n <= (b ?? 100); };
// the gang of a situation: the destination's („here“) or one whose Ruf fits („any“, or „here“ without a gang); undefined = none fits
function gangFor(D, S, save, here, rnd) {
  if (S.gangName) return inRange(S, repOf(save, S.gangName)) ? S.gangName : undefined;   // #057 a fixed gang
  if (!S.gang) return null;
  if (S.gang === 'here' && here) return inRange(S, repOf(save, here)) ? here : undefined;
  const ok = gangs(D).filter(g => inRange(S, repOf(save, g.name)));
  return ok.length ? pick(rnd, ok).name : undefined;
}
// parse „answer>next“ of a situation's answer list
const answerRefs = S => list(S.answers).map(x => { const [id, next] = x.split('>').map(y => y.trim()); return { id, next: next || null }; });

// one incident from the parts → an encounter ({ id: 'gen:<situation>', generated, name, description, roadside, figures, enemies, options … }) or null
// ctx: { night, danger (1–5), region, place (name of the destination), situation (id, forces it), save (Ruf, Merker), here (gang of the
//   destination), chain ({ step, gang, rival, n } of a running story) }
export function generateEncounter(D, rnd = Math.random, ctx = {}) {
  const C = eventsConfig(D), danger = Math.max(1, Math.min(5, ctx.danger ?? 1)), save = ctx.save || null, chain = ctx.chain || null;
  let S = chain ? C.situations.find(s => s.id === chain.step) : ctx.situation ? C.situations.find(s => s.id === ctx.situation) : null;
  if (!S) {
    const all = situationsFor(D, { night: !!ctx.night, danger, save, here: ctx.here || null });
    if (!all.length) return null;
    const wt = s => (s.weight ?? 1) * (ctx.bias?.[s.roadside] ?? 1);   // #063 the weather of the leg makes some likelier
    let k = rnd() * all.reduce((n, s) => n + wt(s), 0);
    S = all.find(s => (k -= wt(s)) < 0) || all[all.length - 1];
  }
  // the gang and its rival (a running story keeps its gangs); the Ruf with the gang picks the mood
  const gang = chain?.gang ?? gangFor(D, S, save, ctx.here || null, rnd) ?? (S.gangName || (S.gang ? pick(rnd, gangs(D).map(g => g.name).concat('Plünderer')) : null));
  const others = gangs(D).map(g => g.name).filter(g => g !== gang), rival = chain?.rival || (others.length ? pick(rnd, others) : 'Plünderer');
  const lvl = gang ? levelOf(D, repOf(save, gang)) : 'neutral';
  const moodIds = list(S.moods); let moods = moodIds.length ? C.moods.filter(m => moodIds.includes(m.id)) : [];
  const byRep = { freund: m => m.friendly && !m.hostile, geduldet: m => m.friendly, unbeliebt: m => m.hostile, feind: m => m.hostile && !m.friendly }[lvl];
  if (gang && byRep && moods.some(byRep)) moods = moods.filter(byRep);
  const M = moods.length ? pick(rnd, moods) : null;
  const W = C.words, brands = mapBrands(D), word = (s, d) => { const v = variants(s); return pick(rnd, v.length ? v : [d]); };
  const fill = {
    mood: M?.name || '', place: ctx.place || 'die Stadt', region: ctx.region || 'Ödland', brand: brands.length ? (b => b.short || b.name)(pick(rnd, brands)) : 'NomadCola',
    group: gang || word(W.group, 'Plünderer'), gang: gang || word(W.group, 'Plünderer'), rival, motto: gangs(D).find(g => g.name === gang)?.motto || '', cargo: word(W.cargo, 'Ersatzteile'), thing: word(W.thing, 'Schrott'), creature: word(W.creature, 'Kreaturen'), n: String(2 + Math.floor(rnd() * 4)),
  };
  const text = (tpl, extra = {}) => { const v = variants(tpl); if (!v.length) return ''; return pick(rnd, v).replace(/\{(\w+)\}/g, (all, k) => (extra[k] ?? fill[k] ?? all)).replace(/\s+/g, ' ').trim(); };
  // answers: those of the situation that fit the mood, in the situation's order, at most „Antworten höchstens“; always one that costs nothing to try
  const friendly = M ? !!M.friendly : true, hostile = M ? !!M.hostile : true;
  const fits = a => !a.when || a.when === 'any' || (a.when === 'friendly' && friendly) || (a.when === 'hostile' && hostile);
  let A = answerRefs(S).map(r => { const a = C.answers.find(x => x.id === r.id); return a && { ...a, next: r.next }; }).filter(Boolean).filter(fits);
  // #064 a Markenstand sells up to three things of one brand (the Influencer's, if it makes things), cheaper with the Influencer buff
  if (S.shop === 'brand') {
    const makes = b => Object.keys(D.items || {}).filter(id => { const t = D.items[id]; return t.brand === b && (t.value || 0) > 0 && !(t.tags || []).some(x => x === 'quest' || x === 'trophy'); });
    const inf = influencer(D, save), have = Object.keys(D.brands || {}).filter(b => makes(b).length);
    const B = inf && makes(inf.brand).length ? inf.brand : have.length ? pick(rnd, have) : null;
    if (B) {
      fill.brand = D.brands[B].short || D.brands[B].name;
      const pool = makes(B), wares = [];
      while (pool.length && wares.length < 3) wares.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
      A = [...wares.map(id => ({ id: `kauf_${id}`, label: `${D.items[id].name} ({price} Δ)`, when: 'any', deltas: -Math.max(5, Math.round(valueOf(D, D.items[id]) * 1.4)), item: id, count: 1, brand: B,
        result: 'Eingepackt, mit Aufkleber und einem Lächeln, das nichts kostet.|Der Verkäufer scannt deinen Daumen. „Danke für Ihren Einkauf.“' })), ...A];
    }
  }
  const free = a => !(a.deltas < 0) && !a.use && !hasNeeds(a);   // always possible (time and fuel she has; Δ and things maybe not)
  // #059 answers that need someone or something: open ones come first, missing ones only where there is room (greyed, with the reason)
  if (save) { const open = a => !hasNeeds(a) || !needBlocked(D, save, a); A = [...A.filter(a => hasNeeds(a) && open(a)), ...A.filter(a => !hasNeeds(a)), ...A.filter(a => !open(a))]; }
  const locked = save ? A.find(a => hasNeeds(a) && needBlocked(D, save, a)) : null;
  if (A.length > C.maxAnswers) { const keep = A.slice(0, C.maxAnswers); if (!keep.some(free)) { const f = A.find(free); if (f) keep[keep.length - 1] = f; } A = keep; }
  if (locked && !A.includes(locked)) A.push(locked);   // one closed door as a teaser: what a crew member, implant or rig part would open
  const k = 1 + C.scale * (danger - 1), riskAdd = M?.risk ?? 0;
  const inChain = !!chain || A.some(a => a.next);
  const options = A.map(a => {
    const o = { answer: a.id };
    for (const f of ['hours', 'fuel', 'food']) if (a[f]) o[f] = a[f];
    // #069 one price function: Ruf of the gang, mood, danger, Influencer of the brand (#064)
    const brand = a.brand || D.items?.[a.item]?.brand || null, P = { gang, mood: M?.price ?? 100, danger, scale: C.scale, brand };
    if (a.deltas) o.deltas = a.deltas < 0 ? pay(D, save, a.deltas, P) : earn(D, save, a.deltas, P);
    if (o.deltas < 0 && brand && save && brandDiscount(D, save, brand) < 1) o.influencer = brand;
    if (a.health) o.health = Math.round(a.health * k);
    if (a.use) { o.use = a.use; o.useCount = a.useCount || 1; }
    if (a.item) { o.item = a.item; o.count = a.count || 1; }
    if (a.loot) o.loot = a.loot === 'situation' ? S.loot || null : a.loot;
    if (!o.loot) delete o.loot;
    if (a.risk > 0) o.risk = Math.max(0, Math.min(95, Math.round(a.risk + riskAdd)));
    if (a.failHealth) o.failHealth = Math.round(a.failHealth * k);
    if (a.failHours) o.failHours = a.failHours;
    if (a.rep && gang) { o.rep = a.rep; o.gang = gang; }
    if (a.repRival && rival) { o.repRival = a.repRival; o.rival = rival; }
    if (a.flag) o.flag = a.flag;
    if (a.buff) o.buff = a.buff;
    if (a.reveal) o.reveal = a.reveal;
    if (a.prisoner) { o.prisoner = a.prisoner; o.needPrisoner = true; }   // #079 Lösegeld, verkaufen, laufen lassen
    if (a.dark) o.dark = a.dark;
    if (a.hurtPrisoners) o.hurtPrisoners = a.hurtPrisoners;
    if (S.once) o.once = S.id;
    if (inChain) { o.chain = { next: a.next || null, gang, rival, n: (chain?.n || 1) + (a.next ? 1 : 0) }; }
    const extra = { price: String(Math.abs(o.deltas || 0)) };
    o.label = (cap(text(a.label, extra)) || 'Weiter') + (o.influencer ? ` · Influencer −${Math.round((1 - brandDiscount(D, save, o.influencer)) * 100)} %` : '');
    for (const key of NEED_KEYS) if (a[key]) o[key] = a[key];   // #059
    const tag = hasNeeds(o) && save ? needTag(D, save, o) : '';
    if (tag) o.label = `${tag} · ${o.label}`;
    o.result = text(a.result, extra);
    if (o.risk) o.failResult = text(a.failResult, extra) || 'Das ging schief.';
    return o;
  });
  if (!options.length) options.push({ label: 'Weiterfahren', result: '' });
  const figures = list(S.figures).filter(id => D.enemies?.[id]);
  return { id: `gen:${S.id}`, generated: true, situation: S.id, mood: M?.id || null, gang, rival, step: chain ? chain.n : null, once: !!S.once, name: cap(text(S.name)) || 'Zwischenfall', description: [text(S.text), M ? text(M.text) : ''].filter(Boolean).join(' '),
    roadside: S.roadside || '', figures, enemies: figures, time: S.time || 'any', loot: S.loot || null, look: S.look || null, danger, options };
}

// the problems of the parts for the check (Prüfung): unknown answers, moods, figures; situations without a free answer
export function eventProblems(D) {
  const C = eventsConfig(D), out = [];
  for (const s of C.situations) {
    for (const { id, next } of answerRefs(s)) {
      if (!C.answers.some(a => a.id === id)) out.push(`Lage „${s.id}“: Antwort „${id}“ gibt es nicht`);
      if (next && !C.situations.some(x => x.id === next)) out.push(`Lage „${s.id}“: Folge „${next}“ gibt es nicht`);
    }
    if (s.only && !C.situations.some(x => answerRefs(x).some(r => r.next === s.id))) out.push(`Lage „${s.id}“: „Nur als Folge“, aber keine Antwort führt hierher`);
    for (const id of list(s.moods)) if (!C.moods.some(m => m.id === id)) out.push(`Lage „${s.id}“: Stimmung „${id}“ gibt es nicht`);
    for (const id of list(s.figures)) if (!D.enemies?.[id]) out.push(`Lage „${s.id}“: Figur „${id}“ ist kein Gegner`);
    const A = answerRefs(s).map(r => C.answers.find(a => a.id === r.id)).filter(Boolean);
    if (A.length && !A.some(a => !(a.deltas < 0) && !a.use && (!a.when || a.when === 'any'))) out.push(`Lage „${s.id}“: keine Antwort, die immer geht (ohne Δ und Gegenstand)`);
  }
  return out;
}
