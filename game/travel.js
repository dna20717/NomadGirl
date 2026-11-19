// Incidents on the road (#014, Daniel 13.11.2026: „Mehrere Etappen + Ereignisse (Panne, Händler, Hinterhalt)“). A drive is cut into
// legs (one road each); after every leg an encounter may happen (Reisen › Chance pro 10 km, more at night). An encounter
// (Welt › Encounter) tells what happens and offers choices; a choice costs or gives time, fuel, food, Δ, health, things.
// No DOM.
import { admit, rollPerson, skillText } from './crew.js';
import { usePrisoner, hurtAll, prisonerConfig, addDark } from './prisoners.js';
import { advance } from './save.js';
import { give, take, have } from './crafting.js';
import { rollLoot } from './inventory.js';
import { generateEncounter, eventsConfig } from './road_events.js';
import { addRep, repOf, gangs } from './reputation.js';
import { revealPlace } from './worldmap.js';
import { needBlocked } from './needs.js';
import { setFlag } from './conditions.js';

const isNight = (D, hour) => { const T = D.travel || {}, len = T.dayLength || 24, night = (T.nightShare ?? 40) / 100 * len; return hour >= len - night / 2 || hour < night / 2; };

// chance of an encounter on a leg of km kilometres (Reisen › Chance pro 10 km, nights × (1 + Gefahr nachts %))
export function encounterChance(D, km, hour) {
  const T = D.travel || {}, p = Math.max(0, Math.min(1, (T.encounterChance ?? 15) / 100 * (isNight(D, hour) ? 1 + (T.nightDanger ?? 0) / 100 : 1)));
  return 1 - Math.pow(1 - p, Math.max(0, km) / 10);
}
// roll the encounter of a leg → id or null (weights; „Tageszeit“ day / night / any; only encounters with choices)
export function rollEncounter(D, save, km, rnd = Math.random) {
  if (rnd() >= encounterChance(D, km, save.hour ?? 12)) return null;
  const night = isNight(D, save.hour ?? 12);
  const all = Object.entries(D.encounters || {}).filter(([, e]) => (e.options || []).length && (e.weight ?? 1) > 0 && (!e.time || e.time === 'any' || (e.time === 'night') === night));
  const total = all.reduce((n, [, e]) => n + (e.weight ?? 1), 0);
  let k = rnd() * total;
  for (const [id, e] of all) if ((k -= e.weight ?? 1) < 0) return id;
  return all[0]?.[0] || null;
}
// #054: the incident of a leg as an object: hand-made (Welt › Encounter) or put together by the Ereignis-Baukasten (Regeln › Anteil gewürfelt)
// ctx: { danger, region, place } of the destination
export function pickEncounter(D, save, km, rnd = Math.random, ctx = {}) {
  const night = isNight(D, save.hour ?? 12), full = { ...ctx, night, save };
  // #055: a running story comes first, on the very next leg
  if (save.road?.chain?.step) { const g = generateEncounter(D, rnd, { ...full, chain: save.road.chain }); if (g) return g; save.road.chain = null; }
  const id = rollEncounter(D, save, km, rnd);
  if (!id) return null;
  if (rnd() * 100 < eventsConfig(D).share) { const g = generateEncounter(D, rnd, full); if (g) return g; }
  return handMade(D, save, id, rnd, ctx) || generateEncounter(D, rnd, full);
}
// an incident by id (tests, scene.forceEncounter): 'gen' or 'gen:<Lage>' from the Baukasten, else a hand-made one
export function encounterById(D, save, id, rnd = Math.random, ctx = {}) {
  if (!id) return null;
  if (String(id).startsWith('gen')) return generateEncounter(D, rnd, { ...ctx, save, night: isNight(D, save.hour ?? 12), situation: String(id).split(':')[1] || null });
  return handMade(D, save, id, rnd, ctx, true);
}
// a hand-made encounter with its gang (#055: Encounter › Gang, Ruf von–bis): out of the Ruf range it does not happen (a friend is not
// stopped at a road block), unless forced; its options carry the gang for their Ruf change
function handMade(D, save, id, rnd, ctx, force = false) {
  const E = D.encounters?.[id]; if (!E) return null;
  let gang = null;
  if (E.gang) {
    const ok = n => { const [a, b] = Array.isArray(E.rep) ? E.rep : [-100, 100]; return n >= (a ?? -100) && n <= (b ?? 100); };
    const cand = E.gang === 'here' && ctx.here ? [ctx.here] : gangs(D).map(g => g.name);
    const fit = cand.filter(g => ok(repOf(save, g)));
    if (!fit.length && !force) return null;
    gang = (fit.length ? fit : cand)[Math.floor(rnd() * (fit.length || cand.length))] || null;
  }
  return { id, ...E, gang, options: (E.options || []).map(o => (o.rep && gang ? { ...o, gang } : o)) };
}
// may this choice be taken? → reason or null (enough Δ, fuel, the thing it uses)
export function blocked(D, save, o) {
  if (o.deltas < 0 && (save.deltas || 0) < -o.deltas) return `Zu wenig Δ (${-o.deltas})`;
  if (o.fuel > 0 && (save.fuel || 0) < o.fuel) return 'Zu wenig Sprit';
  if (o.use && have(D, save, o.use) < (o.useCount || 1)) return `Braucht ${o.useCount || 1}× ${D.items?.[o.use]?.name || o.use}`;
  return needBlocked(D, save, o);   // #059 crew, implant, AvA part, rig part, workshop
}
// take a choice → { lines: [what happened], things: [{ id, n }], health (% of max, negative = damage) }
// Risiko (#054): with o.risk % it goes wrong: the extra damage and hours of the failure, no reward (Δ gained, thing, loot), the text of the failure
export function choose(D, save, o, rnd = Math.random) {
  const lines = [], things = [], failed = o.risk > 0 && rnd() * 100 < o.risk, quest = !!D.items?.[o.item]?.tags?.includes('quest');
  if (failed) {
    o = { ...o, health: (o.health || 0) + (o.failHealth || 0), hours: (o.hours || 0) + (o.failHours || 0), result: o.failResult || 'Das ging schief.' };
    if (o.deltas > 0) delete o.deltas;
    if (!quest) delete o.item;   // #057: a quest piece is found also when it hurts (and its Merker counts)
    delete o.loot;
    lines.push('Schiefgegangen');
  }
  if (o.use) { take(D, save, o.use, o.useCount || 1); lines.push(`−${o.useCount || 1} ${D.items?.[o.use]?.name || o.use}`); }
  if (o.hours) { advance(save, o.hours); lines.push(`${o.hours > 0 ? '+' : ''}${o.hours} h`); }
  if (o.fuel) { save.fuel = Math.max(0, Math.round(((save.fuel || 0) - o.fuel) * 10) / 10); lines.push(`${o.fuel > 0 ? '−' : '+'}${Math.abs(o.fuel)} l Sprit`); }
  if (o.food) { save.food = Math.max(0, Math.round(((save.food || 0) - o.food) * 10) / 10); lines.push(`${o.food > 0 ? '−' : '+'}${Math.abs(o.food)} Vorräte`); }
  if (o.deltas) { save.deltas = Math.max(0, (save.deltas || 0) + o.deltas); lines.push(`${o.deltas > 0 ? '+' : '−'}${Math.abs(o.deltas)} Δ`); }
  if (o.item && D.items?.[o.item]) { const n = o.count || 1, rest = give(D, save, o.item, n); things.push({ id: o.item, n: n - rest }); }
  if (o.loot) for (const e of rollLoot(D, o.loot, rnd)) { if (e.a !== 'items') continue; const rest = give(D, save, e.id, e.n); things.push({ id: e.id, n: e.n - rest }); }
  for (const t of things) if (t.n > 0) lines.push(`+${t.n} ${D.items?.[t.id]?.name || t.id}`);
  if (o.health) { save.health = Math.max(1, Math.round((save.health ?? 100) - o.health)); lines.push(`−${o.health} Leben`); }
  // #079 Gefangene: an answer uses one (Ruf for his gang, Dunkelheit), a failed fight or a riot hurts them all
  const used = !failed && o.prisoner ? usePrisoner(D, save, o) : null;
  if (used) { lines.push(`${used.name}${o.prisoner === 'free' ? ' ist frei' : ' ist weg'}`); if (used.rep?.n) lines.push(`Ruf ${used.rep.gang} ${used.rep.n > 0 ? '+' : '−'}${Math.abs(used.rep.n)}`); if (used.dark) lines.push(`+${used.dark} Dunkelheit`); }
  // #085 Aufnahme auf der Reise: a settler from the building blocks joins the crew (Leyla chose this answer)
  const joined = !failed && o.recruit ? admit(D, save, rollPerson(D, Math.floor(rnd() * 2 ** 31))) : null;
  if (joined) lines.push(`${joined.name} ist jetzt in der Crew (${skillText(D, joined)})`);
  if (!failed && o.dark && !o.prisoner) { addDark(save, o.dark); lines.push(`+${o.dark} Dunkelheit`); }
  const hurt = (failed && o.health) || o.hurtPrisoners ? hurtAll(D, save, o.hurtPrisoners || prisonerConfig(D).hurt) : [];
  for (const h of hurt) lines.push(h.died ? `${h.name} hat es nicht überlebt` : `${h.name} verletzt`);
  // #055: consequences that last: Ruf with the gang (also when it went wrong), Merker and buff (only when it worked), the story goes on or ends
  const rep = o.rep && o.gang ? addRep(D, save, o.gang, o.rep) : null;
  if (rep?.n) lines.push(`Ruf ${rep.gang} ${rep.n > 0 ? '+' : '−'}${Math.abs(rep.n)}`);
  const rep2 = o.repRival && o.rival ? addRep(D, save, o.rival, o.repRival) : null;
  if (rep2?.n) lines.push(`Ruf ${rep2.gang} ${rep2.n > 0 ? '+' : '−'}${Math.abs(rep2.n)}`);
  const R = save.road ??= { flags: [], seen: [], chain: null };
  if (!failed || quest) for (const f of String(o.flag || '').split(',').map(x => x.trim()).filter(Boolean)) {
    setFlag(save, f);   // #071 Welt-Merker
  }
  if (!failed && o.buff && D.buffs?.[o.buff] && !(save.buffs ||= []).includes(o.buff)) { save.buffs.push(o.buff); lines.push(`Buff: ${D.buffs[o.buff].name}`); }
  // #057: a hidden place comes onto the map
  const revealed = o.reveal ? revealPlace(D, save, o.reveal) : null;   // seen is seen, also when it went wrong
  if (revealed) lines.push(`Neuer Ort auf der Karte: ${revealed.name}`);
  if (o.chain) R.chain = o.chain.next ? { step: o.chain.next, gang: o.chain.gang, rival: o.chain.rival, n: o.chain.n } : null;
  if (o.once && !R.seen.includes(o.once)) R.seen.push(o.once);   // a situation that happens once per Durchgang
  return { lines, things, text: o.result || '', failed, rep, rep2, revealed, joined, story: R.chain ? 'weiter' : null };
}
