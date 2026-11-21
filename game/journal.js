// The Logbuch for the player (#129 Info-Center, Daniel 21.11.2026: „ein Log für den Spieler …, in dem er alle Schritte nachvollziehen kann
// und ggf. historische Meldungen anschauen kann“; answers 21.11.: second tab in the Questlog, starts empty with every Durchgang, radio
// titles go in while the build mode hides the tape, build notes only for successes). No DOM: browser and Node.
//
//   save.journal = [{ at: 'Tag 3 · 14:20', day, title, sub, kind, cat, run (POI id or null), n (same note again) }]
import { clockText } from './save.js';

// categories: id, name, Lucide icon
export const CATS = [
  ['quest', 'Quest', 'flag'], ['loot', 'Beute', 'bags'], ['trade', 'Handel', 'coins'], ['fight', 'Kampf', 'skull'],
  ['crew', 'Crew', 'humans'], ['travel', 'Reise', 'map'], ['camp', 'Camp', 'moon'], ['progress', 'Fortschritt', 'trophy'],
  ['radio', 'Radio', 'music'], ['system', 'System', 'settings'],
];
export const CAT_IDS = CATS.map(c => c[0]);
export const KEEP = 400;
// in the build mode only successes go into the Logbuch (Daniel 21.11.: „Nur Erfolge: gekauft, eingebaut, Ensemble“)
const SUCCESS = new Set(['good', 'trophy', 'loot', 'secret', 'recipe', 'keepsake']);

const BY_KIND = { trophy: 'progress', recipe: 'progress', loot: 'loot', secret: 'loot', travel: 'travel', camp: 'camp', drama: 'fight', heal: 'fight' };
const RULES = [
  [/auftrag|quest|abgeben|erledigt:|bergung/i, 'quest'],
  [/gekauft|verkauft|Δ|handel|preis|bezahlt/i, 'trade'],
  [/k\.o\.|gegner|boss|treffer|geräumt|kampf|rang /i, 'fight'],
  [/crew|gefangen|bewerb|kompan|stimmung|gast/i, 'crew'],
  [/fahrt|karte|ort|revier|ruf |gang|wetter|zwischenfall|unterwegs|angekommen/i, 'travel'],
  [/rezept|achievement|techtree|knoten|implantat|gelernt|freigeschaltet/i, 'progress'],
  [/gebaut|eingebaut|werkstatt|lager|feuer|ernte|gekocht|camp|rig|deko|ensemble/i, 'camp'],
  [/beute|kiste|gefunden|rucksack|secret|aufgehoben/i, 'loot'],
  [/radio|sender|♪/i, 'radio'],
  [/spielstand|gespeichert|ton |vibration|cheat|lektion/i, 'system'],
];
// the category of a note: given by the caller, else from its kind, else from words in its title
export function catOf(kind, title = '', sub = '') {
  if (BY_KIND[kind]) return BY_KIND[kind];
  const t = `${title} ${sub}`;
  for (const [re, c] of RULES) if (re.test(t)) return c;
  return 'system';
}

// one note into the Logbuch; the same note again right after only counts up. → the entry, or null when it does not belong in
export function record(save, title, sub = '', kind = 'info', { cat = null, building = false, run = save?.run?.poi ?? null, success = SUCCESS, keep = KEEP } = {}) {
  if (!save || !title) return null;
  if (building && !success.has(kind)) return null;
  const J = (save.journal ??= []), last = J[J.length - 1];
  if (last && last.title === title && (last.sub || '') === (sub || '')) { last.n = (last.n || 1) + 1; last.at = clockText(save); return last; }
  const e = { at: clockText(save), day: save.day ?? 1, title, sub: sub || '', kind, cat: CAT_IDS.includes(cat) ? cat : catOf(kind, title, sub), run: run || null };
  J.push(e);
  if (J.length > keep) J.splice(0, J.length - keep);
  return e;
}

// older entries (#070: { at, title, sub, kind }) get a category and their day
export function repair(save) {
  for (const e of save?.journal || []) {
    e.cat ??= catOf(e.kind, e.title, e.sub);
    e.day ??= Number(/Tag (\d+)/.exec(e.at || '')?.[1]) || 1;
  }
  return save;
}

// the list for the window: newest first, filtered by category ('all') and a search text; grouped by day
export function view(save, { cat = 'all', q = '' } = {}) {
  const needle = q.trim().toLowerCase();
  const list = (save?.journal || []).map((e, i) => ({ ...e, i, cat: e.cat || catOf(e.kind, e.title, e.sub), day: e.day ?? (Number(/Tag (\d+)/.exec(e.at || '')?.[1]) || 1) }))
    .filter(e => (cat === 'all' || e.cat === cat) && (!needle || `${e.title} ${e.sub}`.toLowerCase().includes(needle))).reverse();
  const days = [];
  for (const e of list) { const d = e.day ?? 1; if (days[days.length - 1]?.day !== d) days.push({ day: d, entries: [] }); days[days.length - 1].entries.push(e); }
  return { list, days, counts: Object.fromEntries(CAT_IDS.map(c => [c, (save?.journal || []).filter(e => (e.cat || catOf(e.kind, e.title, e.sub)) === c).length])) };
}
