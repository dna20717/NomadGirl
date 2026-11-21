// NomadGirl – data schema. Single source of truth for every editable aspect of the game.
// The workshop (GUI), the validation, renaming and the command line `ng` all read from here:
// a new area or a new field is added once in this file and shows up everywhere.
//
// Area:  { name, singular?, icon, file, kind: 'catalog' | 'single', hint, sections: [{ title, fields }], template?, row?, groupBy?, check? }
//   catalog = object of entries by ID (weapons, items …), single = one object (Leyla, travel rules …)
// Field: { key (dot path), label, type, unit?, hint?, min?, max?, step?, options?, area? (reference target), columns? (table), required? }
//   types: text, textarea, number, checkbox, color, select, multi (several of fixed options), ref, refs, size ([w, h]), point ([x, y]), range ([min, max]), table,
//          lines (list of text rows, edited as monospaced text: room layouts)
import { parseRoom, TILE_LEGEND } from './room.js';
import { buildPoi, poiReady } from './poi.js';
import { PAD_BUTTONS, PAD_ACTIONS, PAD_KINDS } from '../game/play/pad.js';
import { LAMP_KINDS, LIGHT_BEHAVIORS } from './atmosphere.js';
import { MEGARIG_KINDS, ADDON_AT, ADDON_CODE, ADDON_WALK, megarigProblems } from './megarig.js';
import { ACHIEVEMENT_COUNTERS, ACHIEVEMENT_SPECIALS, ACHIEVEMENT_CATEGORIES } from '../game/achievements.js';
import { REP_LEVELS } from '../game/reputation.js';
import { RADIO_STYLES, RADIO_TALK, RADIO_SCALES, RADIO_KEYS } from '../game/radio_kinds.js';
import { VOICE_STYLES, VOICE_SOUNDS } from '../game/voice.js';
import { DECOR_PLACES, DECOR_ARTS, DECOR_CARRY, DECOR_EXTRAS, DECOR_USES, DECOR_GROW, DECOR_INSIDE_ROWS } from '../game/decor.js';
import { MOMENTS } from '../game/banter.js';
import { EARN_WHEN } from '../game/earn.js';
import { RELIEFS, ROADSIDE } from '../game/road.js';
import { ANSWER_WHEN, GANG_FROM, eventProblems } from '../game/road_events.js';
import { SFX_RECIPES, SFX_LEGACY } from '../game/play/sfx.js';
import { TRAIT_OPTIONS, THROW_ITEMS } from '../game/play/traits/ids.js';

const text = (key, label, o = {}) => ({ key, label, type: 'text', ...o });
const area_ = (key, label, o = {}) => ({ key, label, type: 'textarea', ...o });
const num = (key, label, o = {}) => ({ key, label, type: 'number', ...o });
const bool = (key, label, o = {}) => ({ key, label, type: 'checkbox', ...o });
const color = (key, label, o = {}) => ({ key, label, type: 'color', ...o });
const select = (key, label, options, o = {}) => ({ key, label, type: 'select', options, ...o });
const multi = (key, label, options, o = {}) => ({ key, label, type: 'multi', options, ...o });
const ref = (key, label, area, o = {}) => ({ key, label, type: 'ref', area, ...o });
const refs = (key, label, area, o = {}) => ({ key, label, type: 'refs', area, ...o });
const size = (key, label, o = {}) => ({ key, label, type: 'size', ...o });
const point = (key, label, o = {}) => ({ key, label, type: 'point', ...o });
const range = (key, label, o = {}) => ({ key, label, type: 'range', ...o });
const table = (key, label, columns, o = {}) => ({ key, label, type: 'table', columns, ...o });
const lines = (key, label, o = {}) => ({ key, label, type: 'lines', ...o });

const NAME = text('name', 'Name', { required: true });
const DESCRIPTION = area_('description', 'Beschreibung');
const VALUE = num('value', 'Wert', { unit: 'Δ', min: 0, hint: 'Verkaufswert in Deltas' });
// what a trophy can give (Achievements › Bonus): Leyla's gear values (game/inventory.js › GEAR_STATS) plus the tank
export const TROPHY_GEAR = [['defense', 'Abwehr %'], ['health', 'Leben'], ['damage', 'Schaden %'], ['melee', 'Nahkampf %'], ['ranged', 'Fernkampf %'], ['crit', 'Krit-Chance %'], ['speed', 'Tempo %'],
  ['jump', 'Sprungkraft %'], ['dashCooldown', 'Dash-Abklingzeit %'], ['regen', 'Heilt sich (LP/10 s)'], ['heal', 'Heilung %'], ['droneBattery', 'AvA-Akku %'], ['tankDecay', 'Tank: Verfall %'], ['hack', 'Duell-Integrität']];
export const TECH_BONUS = [['tankDecay', 'Tank: Verfall %'], ['tankRescue', 'Tank: Rettung kostet %'], ['tankAccel', 'Tank: Beschleunigung %'],
  ['tankStatus', 'Tank-Anzeige im Run (1 = an)'], ['droneBattery', 'AvA: Akku %'], ['health', 'Leyla: Leben'], ['damage', 'Leyla: Schaden %'],
  // #110 every value of the Boni-Bus: Leyla's gear values and the camp
  ['defense', 'Leyla: Abwehr %'], ['melee', 'Leyla: Nahkampf %'], ['ranged', 'Leyla: Fernkampf %'], ['crit', 'Leyla: Krit-Chance %'], ['speed', 'Leyla: Tempo %'],
  ['jump', 'Leyla: Sprungkraft %'], ['regen', 'Leyla: heilt sich (LP/10 s)'], ['heal', 'Leyla: Heilung %'], ['stamina', 'Leyla: Ausdauer'], ['staminaRegen', 'Leyla: Erholung %'],
  ['hack', 'Duell-Integrität'], ['growth', 'Camp: Wachstum %'], ['fuel', 'Camp: Spritersparnis %'], ['sleepHeal', 'Camp: Schlaf heilt %'], ['rest', 'Camp: Ruhe %'],
  ['perfect', 'Camp: perfekt kochen %'], ['refund', 'Camp: Zutat zurück %'], ['power', 'Camp: Strom ⚡'], ['sell', 'Camp: mehr Δ aus Runs %'], ['loot', 'Camp: Extra-Beute %']];
const LOOK = ref('look', 'Aussehen', 'assets', { hint: 'Grafik aus dem Bereich Assets' });
const ICON = num('icon', 'Symbol', { min: 0, hint: 'Nur bei Aussehen der Art „Symbole“: welches Feld im Raster (0 = oben links, zeilenweise). Am einfachsten rechts in der Vorschau anklicken' });
// an entry whose look is an icon sheet must name a cell that exists
const iconCheck = (x, report, p) => {
  const a = p.data?.assets?.[x.look];
  if (a?.kind !== 'icons') { if (x.icon !== undefined && a) report('hint', 'Symbol gilt nur bei Aussehen der Art „Symbole“'); return; }
  const [c, r] = a.grid || [];
  if (x.icon === undefined) report('warning', 'Aussehen ist ein Symbol-Raster, aber kein Symbol gewählt');
  else if (c && r && x.icon >= c * r) report('error', `Symbol ${x.icon} gibt es nicht (Raster hat ${c * r})`);
};
const STAGE = select('stage', 'Ausbaustufe', [['mvp', 'MVP'], ['1', 'Stufe 1'], ['2', 'Stufe 2']], { hint: 'Wann das ins Spiel kommt' });

// ---------- fixed option lists ----------
export const WEAPON_KINDS = [['melee', 'Nahkampf'], ['ranged', 'Fernkampf'], ['cyberdeck', 'Cyberdeck']];
export const HELD_CLASSES = [['light', 'Nahkampf leicht'], ['heavy', 'Nahkampf beidhändig'], ['pistol', 'Pistole'], ['long', 'Langwaffe']];
export const KIT_STATES = [['alert', 'Alarm'], ['walk', 'Gehen'], ['run', 'Rennen'], ['crouch', 'Ducken'], ['attack', 'Angriff'], ['hit', 'Treffer'], ['death', 'Tod']];
export const ENEMY_FAMILIES = [['mutant', 'Mutant'], ['raider', 'Plünderer'], ['machine', 'Maschine'], ['wildlife', 'Getier'], ['anomaly', 'Anomalie']];
export const ENEMY_BEHAVIORS = [['patrol', 'Patrouille'], ['charger', 'Stürmer'], ['shooter', 'Schütze'], ['ambusher', 'Lauerer'], ['flyer', 'Flieger'], ['boss', 'Boss']];
// tags on things (Daniel, 11.11.2026: „mach ein Tag trophy“): trophy = may hang on a trophy stand in the treasury
export const ITEM_TAGS = [['trophy', 'Trophäe'], ['quest', 'Questgegenstand (#057: nicht verkaufen, nicht zerlegen)']];
// Entities (#047): kinds of quirks
export const GLITCH_QUIRKS = [['odd', 'schrullig'], ['mood', 'Laune'], ['time', 'Tageszeit'], ['weather', 'Wetter'], ['neighbour', 'Nachbarn']];
// Lore › Marken (#045)
export const BRAND_SECTORS = [['cyber', 'Cyberware'], ['military', 'Militär'], ['cosmetics', 'Kosmetik'], ['fuel', 'Treibstoff'], ['food', 'Essen'], ['drink', 'Getränke'], ['vehicle', 'Fahrzeuge'], ['trade', 'Handel & Schrott'], ['lodging', 'Unterkunft'], ['authority', 'Behörde'], ['medical', 'Medizin'], ['other', 'Sonstiges']];
export const BRAND_TIERS = [['cheap', 'Billig'], ['mid', 'Mittel'], ['premium', 'Premium'], ['elite', 'Elite']];
export const BRAND_STATUS = [['active', 'aktiv'], ['bankrupt', 'pleite'], ['ruin', 'Ruine'], ['underground', 'Untergrund']];
export const BRAND_STREET = [['hated', 'verhasst'], ['feared', 'gefürchtet'], ['neutral', 'egal'], ['liked', 'beliebt'], ['cult', 'Kult']];
export const ITEM_CATEGORIES = [['junk', 'Schrott'], ['resource', 'Ressource'], ['ingredient', 'Zutat'], ['food', 'Gericht'], ['component', 'Bauteil'], ['consumable', 'Verbrauchsgut'], ['valuable', 'Wertsache'], ['blueprint', 'Bauplan/Rezept'], ['armor', 'Rüstung'], ['implant', 'Implantat'], ['dronepart', 'Drohnenteil'], ['progress', 'Fortschritt'], ['weaponpart', 'Waffenteil'], ['glitchling', 'Entity'], ['prisoner', 'Gefangener']];
// where a thing is worn (Daniel, 10.11.2026: Inventar im Diablo-Stil): Leyla's head + armor, implants in her body, parts on AvA
export const WEAR_SLOTS = [['head', 'Kopf'], ['armor', 'Rüstung'], ['eyes', 'Implantat: Augen'], ['nerves', 'Implantat: Nerven'], ['arm', 'Implantat: Cyberarm'], ['heart', 'Implantat: Herz'], ['legs', 'Implantat: Beine'], ['skin', 'Implantat: Haut'],
  ['bow', 'Drohne: Bug'], ['tail', 'Drohne: Heck'], ['core', 'Drohne: Kern'], ['module', 'Drohne: Modul']];
export const IMPLANT_SLOTS = ['eyes', 'nerves', 'arm', 'heart', 'legs', 'skin'];
export const BUFF_STATS = [['health', 'Leben'], ['damage', 'Schaden'], ['speed', 'Tempo'], ['defense', 'Abwehr'], ['luck', 'Glück (Beute)'], ['backpack', 'Rucksackplätze'], ['fuel', 'Spritverbrauch']];
export const BUFF_DURATIONS = [['instant', 'Sofort'], ['run', 'Nächster Run'], ['travel', 'Nächste Reise'], ['seconds', 'Sekunden'], ['permanent', 'Dauerhaft']];
export const DISCOVERY = [['experiment', 'Experimentieren'], ['found', 'Fund im POI'], ['companion', 'Tipp von Companion'], ['shop', 'Bei NPCs kaufen'], ['start', 'Von Anfang an'], ['techtree', 'Knoten im Techtree'], ['achievement', 'Achievement']];
export const CONTAINER_KINDS = [['shipping', 'Hochseecontainer'], ['crate', 'Holzkiste'], ['trailer', 'Wohnwagenteil'], ['tank', 'Tank']];
export const PART_SLOTS_SCHEMA = [['lauf', 'Lauf'], ['griff', 'Griff'], ['schaft', 'Schaft'], ['magazin', 'Magazin'], ['visier', 'Visier'], ['klinge', 'Klinge'], ['kern', 'Kern']];
export const WORKSHOP_FUNCTIONS = [['tank', 'Cryo-Tank'], ['garden', 'Hydrokultur'], ['cistern', 'Zisterne'], ['storage', 'Lager'], ['guests', 'Gäste'], ['treasury', 'Schatzkammer'], ['cooling', 'Kühlung'], ['cell', 'Zelle'], ['sleep', 'Schlafen'], ['chill', 'Chillen'], ['drone', 'Drohnen'], ['warroom', 'Planung'], ['kitchen', 'Kochen'], ['foodtruck', 'Verkauf'], ['craft', 'Herstellen'], ['cyber', 'Cyberware (Ripperdoc)'], ['engine', 'Motor'], ['power', 'Energie'], ['armory', 'Waffenkammer'], ['vehicle', 'Fahrzeuge (Heavy-Duty)'], ['jobs', 'Aufträge'], ['bitfarm', 'Bit-Farm (Entities)']];
export const BENCH_FX = [['light', 'Licht'], ['screen', 'Bildschirm'], ['steam', 'Dampf'], ['smoke', 'Rauch'], ['sparks', 'Funken'], ['flame', 'Flamme'], ['blink', 'LED blinkt'], ['twinkle', 'Lichter funkeln'], ['bubbles', 'Blasen'], ['fish', 'Fische'], ['lava', 'Lavalampe'], ['scan', 'Druckkopf'], ['shine', 'Glanz']];
export const BENCH_FX_WHEN = [['always', 'Immer'], ['night', 'Abends'], ['near', 'In der Nähe'], ['use', 'Bei Benutzung']];
// #071 what a quirk does to an Entity at work (game/workers.js flawOf)
export const QUIRK_EFFECTS = [['', 'nach Art'], ['night', 'arbeitet nur nachts (20–6 Uhr)'], ['fullmoon', 'jeder 7. Tag: nichts'], ['rain', 'bei Regen: nichts'], ['generator', 'Generator im Rig: halb'],
  ['drone', 'Drohnenwerkstatt im Rig: halb'], ['jealous', 'andere Worker: halb'], ['mood', 'jeder 4. Tag keine Lust'], ['odd', 'lenkt sich ab: −15 %'], ['none', 'keine']];
export const RIG_SLOTS = [['engine', 'Motor'], ['armor', 'Panzerung'], ['weapon', 'Waffe'], ['roof', 'Dach'], ['solar', 'Solar (Container-Dach)']];
// #068 one condition language (game/conditions.js): the crew & rig needs, the same fields wherever something can be required
// (Ereignis-Baukasten › Antworten and Lagen, Quests › Bedingung); without a value they ask for nothing
const CREW_NEEDS = () => [ref('needCompanion', 'Braucht: Companion', 'companions', { hint: '#059/#068: nur mit diesem Companion an Bord; sonst grau mit Grund bzw. nicht im Angebot' }),
  select('needWear', 'Braucht: Implantat/AvA-Teil', [['', '–'], ...WEAR_SLOTS], { hint: 'irgendein Teil an diesem Platz (Leyla oder AvA)' }),
  ref('needItem', 'Braucht: genau dieses Teil', 'items', { hint: 'eingebaut bei Leyla oder AvA' }), select('needRigSlot', 'Braucht: Rig-Teil am Slot', [['', '–'], ...RIG_SLOTS]),
  ref('needRigPart', 'Braucht: genau dieses Rig-Teil', 'rigParts'), select('needWorkshop', 'Braucht: Werkstatt im Rig', [['', '–'], ...WORKSHOP_FUNCTIONS])];
export const POI_KINDS = [['gasStation', 'Tankstelle'], ['settlement', 'Siedlung'], ['factory', 'Fabrik'], ['bunker', 'Bunker'], ['government', 'Regierungskomplex'], ['mall', 'Einkaufszentrum'], ['ruin', 'Ruine'], ['highrise', 'Hochhaus'], ['underground', 'Untergrund']];
export const POI_SIZES = [['S', 'S'], ['M', 'M'], ['L', 'L'], ['XL', 'XL'], ['XXL', 'XXL']];
export const ROOM_TAGS = [['start', 'Eingang'], ['exit', 'Ausgang'], ['combat', 'Kampf'], ['loot', 'Beute'], ['secret', 'Geheimnis'], ['npc', 'NPCs'], ['boss', 'Boss'], ['corridor', 'Gang']];
export const PIXEL_TYPES = [['icons', 'Symbole (Raster)'], ['image', 'Einzelbild / Objekt'], ['tiles', 'Kacheln'], ['animation', 'Animation'], ['photo', 'Foto → Pixel'], ['edit', 'Überarbeiten']];
export const PIXEL_STATUS = [['open', 'Offen'], ['working', 'In Arbeit'], ['done', 'Fertig'], ['question', 'Rückfrage']];
// #130 Ton-Ereignisse: what kind of sound, and the order for production
export const SOUND_KINDS = [['combat', 'Kampf'], ['move', 'Bewegung'], ['loot', 'Beute & Dinge'], ['world', 'Umgebung'], ['ui', 'UI'], ['jingle', 'Jingle'], ['build', 'Bauen']];
export const SOUND_PRIORITIES = [['a', 'A · zuerst'], ['b', 'B · bald'], ['c', 'C · später']];
export const ASSET_KINDS = [['animation', 'Animation'], ['tiles', 'Kacheln'], ['image', 'Bild'], ['video', 'Clip (Video)'], ['sound', 'Ton'], ['icons', 'Symbole'], ['reference', 'Referenz'], ['source', 'Original']];
// tutorial (#011): chapters of the field guide and what makes a lesson show up the first time
export const TUT_CHAPTERS = [['move', 'Bewegung'], ['fight', 'Kampf'], ['ava', 'AvA'], ['inventory', 'Inventar'], ['camp', 'Camp'], ['build', 'Rig bauen'], ['travel', 'Reisen'], ['poi', 'Im POI'], ['progress', 'Fortschritt']];
export const TUT_TRIGGERS = [['', 'nie (nur Feldhandbuch)'], ['time', 'nach Zeit'], ['near', 'Hinweis sichtbar'], ['window', 'Fenster offen'], ['leyla', 'Leyla-Zustand'], ['event', 'Ereignis']];
export const TUT_MODES = [['', 'überall'], ['camp', 'im Camp'], ['run', 'im POI']];
export const DAYTIME = [['any', 'Immer'], ['day', 'Tag'], ['night', 'Nacht']];
export const DRONE_MOODS = [['idle', 'Normal'], ['kill', 'Gegner erledigt'], ['cleared', 'Raum geräumt'], ['bored', 'Langeweile'], ['alert', 'Gegner in der Nähe'],
  ['curious', 'Neugierig (zufällig)'], ['hit', 'Leyla getroffen'], ['sleep', 'Schlafen'], ['down', 'Leyla k.o.'], ['scan', 'Scannen (zufällig)'], ['lowHealth', 'Wenig Leben'], ['dash', 'Dash'], ['zen', 'Zen (Leyla macht Yoga)'],
  ['gearBetter', 'Inventar: bessere Ausrüstung'], ['gearWorse', 'Inventar: schlechtere Ausrüstung'], ['gearOff', 'Inventar: Slot geleert'], ['dronePart', 'Inventar: Teil an AvA'],
  ['rescue', 'Inventar: ins Rettungsfach'], ['rescueFood', 'Inventar: Essen ins Rettungsfach'], ['valuable', 'Inventar: Wertsache eingepackt'], ['bagFull', 'Inventar: Rucksack fast voll'], ['invIdle', 'Inventar: lange offen'],
  ['love', 'Nahe beim Cryo-Tank'], ['tankWeak', 'Tank schwach (im Run)']];

const label = (list, v) => list.find(([k]) => k === v)?.[1] ?? v ?? '';

// ---------- areas ----------
// Zerlegen ohne Farming (Daniel, 12.11.2026: „ich baue das Glas, um es dann zu zerlegen, darf nicht funktionieren“).
// Rules: a craftable thing never gives back more of any ingredient than its recipe takes (per piece, every recipe),
// its salvage is worth less than the ingredients, failure junk from experiments has no salvage, salvage never loops.
const SALVAGE_FIELDS = [ref('salvageAt', 'Zerlegen an', 'workshops', { hint: 'Werkstatt, an der man das Ding zerlegt (Technik meist Werkbank, Wissen Warroom, Bio Kochnische). Leer = Werkbank' }),
  table('salvage', 'Ergibt', [ref('item', 'Gegenstand', 'items'), num('count', 'Anzahl', { min: 1 })], { hint: 'Bestandteile beim Zerlegen: Bauteile oder direkt Fortschritt (Technik, Wissen, Bio). Leer = nicht zerlegbar. Gegen Farming (Daniel, 12.11.2026): was man herstellen kann, gibt nie mehr zurück, als im Rezept steckt, und nie Fortschritt; Fehlschlag-Müll ist nicht zerlegbar' })];
export function salvageProblems(p, id, area = 'items') {
  const items = p?.data?.items || {}, x = p?.data?.[area]?.[id]; if (!x) return [];
  const out = [], sv = (x.salvage || []).filter(s => s?.item), val = k => Number(items[k]?.value) || 0;
  const add = (kind, text) => out.push({ kind, text });
  if (sv.some(s => s.item === id)) add('error', 'Zerlegt sich in sich selbst');
  if (x.category === 'progress' && sv.length) add('warning', 'Fortschritt (Technik, Wissen, Bio) sollte sich nicht zerlegen lassen');
  for (const [rid, r] of Object.entries(p?.data?.recipes || {})) {
    if (area !== 'items' || r?.result !== id || r.part) continue;
    const n = Math.max(1, Number(r.count) || 1), ing = Object.fromEntries((r.ingredients || []).map(i => [i.item, Number(i.count) || 0]));
    for (const s of sv) if ((Number(s.count) || 0) * n > (ing[s.item] || 0)) add('error', `Farming: aus Rezept „${r.name || rid}“ kommt beim Zerlegen mehr ${items[s.item]?.name || s.item} heraus, als hineingeht${items[s.item]?.category === 'progress' ? ' (Hergestelltes gibt nie Fortschritt)' : ''}`);
    const back = sv.reduce((a, s) => a + (Number(s.count) || 0) * n * val(s.item), 0), cost = Object.entries(ing).reduce((a, [k, c]) => a + c * val(k), 0);
    if (sv.length && back > 0 && back >= cost) add('error', `Farming: Zerlegen bringt mehr Wert zurück (${back} Δ), als Rezept „${r.name || rid}“ kostet (${cost} Δ)`);
  }
  if (area === 'items' && sv.length && (p?.data?.crafting?.failures || []).some(f => f?.item === id)) add('error', 'Fehlschlag-Müll darf nicht zerlegbar sein (sonst Farming über Experimente)');
  const seen = new Set(), walk = k => { for (const s of items[k]?.salvage || []) { if (s?.item === id) return true; if (s?.item && !seen.has(s.item)) { seen.add(s.item); if (walk(s.item)) return true; } } return false; };
  if (area === 'items' && sv.length && walk(id)) add('error', 'Zerlegen dreht sich im Kreis (ein Bestandteil zerlegt sich wieder hierzu)');
  const back = sv.reduce((a, s) => a + (Number(s.count) || 0) * val(s.item), 0), own = Number(x.value) || 0;
  if (sv.length && back > Math.max(1, own) * 1.5) add('hint', `Zerlegen bringt deutlich mehr (${back} Δ) als Verkaufen (${own} Δ)`);
  return out;
}

export const AREAS = {
  assets: {
    name: 'Assets', singular: 'Asset', icon: 'image', file: 'data/assets.json', kind: 'catalog', gallery: true, groupBy: { key: 'kind', options: ASSET_KINDS },
    hint: 'Alle Grafiken des Spiels: Animationen (Streifen), Bilder, Referenzen (Konzepte, Character Sheets) und Originale. Dateien liegen unter projects/nomadgirl/assets/. Entitäten wie Leyla, Gegner oder Items verweisen über „Aussehen“ hierher. Alles entsteht mit KI oder Code.',
    template: { name: 'Neues Asset', kind: 'image', file: 'assets/' },
    row: x => x.kind === 'animation' ? `${x.frames ?? 1} Frames · ${x.fps ?? 0} fps · ${(x.frameSize || []).join('×')} px` : label(ASSET_KINDS, x.kind),
    sections: [
      { title: 'Asset', fields: [NAME, select('kind', 'Art', ASSET_KINDS, { required: true }), text('file', 'Datei', { required: true, hint: 'Pfad im Projekt, z. B. assets/leyla/idle.png' }), DESCRIPTION] },
      { title: 'Frames', when: x => x.kind === 'animation' || x.kind === 'tiles', fields: [size('frameSize', 'Frame-Größe', { unit: 'px' }), num('frames', 'Frames', { min: 1, hint: 'Kacheln: Streifen in der Reihenfolge einzeln, links, Mitte, rechts' })] },
      { title: 'Symbol-Raster', when: x => x.kind === 'icons', fields: [size('cell', 'Feldgröße', { unit: 'px' }), size('grid', 'Raster', { unit: 'Felder', hint: 'Spalten × Zeilen' }),
        lines('names', 'Namen', { hint: 'Ein Name pro Feld, zeilenweise von oben links; erscheinen beim Auswählen' })] },
      { title: 'Animation', when: x => x.kind === 'animation', fields: [num('fps', 'Tempo', { unit: 'fps', min: 0, step: 0.5 }), bool('loop', 'Wiederholen')] },
      { title: 'Im Spiel', when: x => x.kind === 'animation' || x.kind === 'image', fields: [point('origin', 'Ankerpunkt', { unit: 'px', hint: 'Wo die Füße stehen (bei Animationen im Frame): Dieser Punkt sitzt im Spiel auf dem Boden' }),
        num('height', 'Höhe im Spiel', { unit: 'px', min: 1, hint: 'Auf diese Höhe wird das Bild bzw. ein Frame im Spiel skaliert' }), bool('flip', 'Schaut nach links', { hint: 'Wenn die Grafik nach links schaut; das Spiel spiegelt dann umgekehrt' }),
        ref('mirror', 'Gegenrichtung', 'assets', { hint: 'Dieselbe Grafik in die andere Blickrichtung (eigene Zeichnung statt gespiegelt). Leer = das Spiel spiegelt' })] },
      { title: 'Schlitten', when: x => x.kind === 'animation', fields: [table('slide', 'Schlitten', [num('frame', 'Frame', { min: 0, hint: '1 = erster Frame, 0 = alle' }), point('from', 'Von', { unit: 'px' }), point('to', 'Bis', { unit: 'px' })],
          { hint: 'Daniel, 11.11.2026: Bei jedem Schuss fährt der Schlitten der Waffe kurz zurück, ohne neue Grafik. Kasten um den Schlitten in Bildpixeln des Frames (oben links bis unten rechts); was darin gemalt ist, rutscht zurück, vorn schaut der Lauf raus' }),
        num('slideShift', 'Schlitten zurück', { unit: 'px', min: 0, hint: 'Bildpixel; 3 = dezent' })] },
      { title: 'Ebenen (Gegner-Bausatz)', when: x => x.kind === 'animation' && (x.layers || x.hands), fields: [text('hands', 'Hände davor', { hint: 'Streifen mit dem, was vor der Waffe liegt (Finger am Griff), gleiche Frames. tools/raider_strips.py' }),
        table('layers', 'Je Frame', [num('frame', 'Frame', { min: 1 }), point('grip', 'Griff', { unit: 'px' }), num('angle', 'Winkel', { unit: '°' }), bool('back', 'Waffe hinten'), point('head', 'Kopf', { unit: 'px' }), num('headAngle', 'Kopf gedreht', { unit: '°' })],
          { hint: 'Gemessen am grünen Platzhalter: Griff und Richtung (Griff → Spitze); Kopf = Versatz gegenüber der Grundpose' })] },
      { title: 'Ton', when: x => x.kind === 'sound', fields: [text('alt', 'Ersatzdatei', { hint: 'Gleicher Ton in einem zweiten Format (z. B. .ogg zur .m4a); das Spiel nimmt, was der Browser kann' }),
        num('volume', 'Grundlautstärke', { unit: '%', min: 0, max: 200, hint: 'Gleicht laute und leise Aufnahmen aus' }),
        text('title', 'Titel', { hint: '#117 Steht auf der Now-Playing-Kassette, wenn die Musik wechselt (leer = Name)' }), text('artist', 'Künstler')] },
      { title: 'Kassette (Now Playing)', when: x => !!x.reels, fields: [size('size', 'Bildgröße', { unit: 'px' }), text('label', 'Etikett x, y, b, h', { hint: 'Bildpixel' }), num('reelSize', 'Spulen-Größe', { unit: 'px', min: 2 })] },
      { title: 'Herkunft', fields: [text('source', 'Erzeugt mit', { hint: 'KI-Werkzeug oder Code' }), ref('derivedFrom', 'Abgeleitet von', 'assets', { hint: 'z. B. Streifen aus einem Original-GIF' }), text('date', 'Datum')] },
    ],
    check: (x, report, p) => {
      if (x.file && p.exists && !p.exists(x.file)) report('error', `Datei ${x.file} fehlt`);
      if (x.alt && p.exists && !p.exists(x.alt)) report('error', `Ersatzdatei ${x.alt} fehlt`);
      if (x.hands && p.exists && !p.exists(x.hands)) report('error', `Datei ${x.hands} fehlt`);
      if (x.kind === 'sound' && x.file && !/\.(m4a|mp3|ogg|wav)$/i.test(x.file)) report('warning', 'Töne sind .m4a, .mp3, .ogg oder .wav');
      if (x.kind === 'tiles' && (!x.frameSize || !x.frames)) report('error', 'Kacheln ohne Frame-Größe oder Frames');
      if (x.kind === 'icons' && (!x.cell || !x.grid)) report('error', 'Symbol-Raster ohne Feldgröße oder Raster');
      if (x.kind === 'icons' && x.names?.length && x.grid && x.names.length > x.grid[0] * x.grid[1]) report('warning', 'Mehr Namen als Felder im Raster');
      if (x.kind === 'animation') {
        if (x.file && !/\.(png|webp)$/i.test(x.file)) report('warning', 'Animationen sind PNG-Streifen');
        if (!x.frameSize || !x.frames) report('error', 'Animation ohne Frame-Größe oder Frames');
        const [w, h] = x.frameSize || [], [ox, oy] = x.origin || [];
        if (x.origin && w && (ox < 0 || ox > w || oy < 0 || oy > h)) report('warning', 'Ankerpunkt liegt außerhalb des Frames');
      }
      if (x.derivedFrom === undefined && x.kind === 'animation' && !x.source) report('hint', 'Herkunft fehlt');
      const m = x.mirror && p.data?.assets?.[x.mirror];
      if (m && !!m.flip === !!x.flip) report('warning', 'Gegenrichtung schaut in dieselbe Richtung (Feld „Schaut nach links“)');
      if (m && x.kind === 'animation' && m.kind !== 'animation') report('warning', 'Gegenrichtung ist keine Animation');
    },
  },
  game: {
    name: 'Spiel', icon: 'settings', file: 'data/game.json', kind: 'single',
    hint: 'Grundwerte für das ganze Spiel: Maßstab, Physik, Auflösung und womit Leyla startet.',
    sections: [
      { title: 'Leitern', fields: [ref('ladder.look', 'Leiter-Bild', 'assets', { hint: '#034 (Daniel: „hübsche Leitern mit Anfang, Ende, kaputtem Segment, einfärbbar“): ein senkrechter Streifen, Teile per Zeilen. Leer = Leitern aus Code' }),
        range('ladder.top', 'Anfang', { unit: 'Bildzeilen' }), range('ladder.mid', 'Mitte (wiederholt)', { unit: 'Bildzeilen' }), range('ladder.broken', 'Kaputtes Stück', { unit: 'Bildzeilen' }), range('ladder.bottom', 'Ende', { unit: 'Bildzeilen' }),
        num('ladder.width', 'Breite', { unit: '% einer Kachel', min: 30, max: 200 }), num('ladder.brokenChance', 'Kaputt', { unit: '% je Leiter', min: 0, max: 100, hint: 'So viele Leitern (ab 3 Kacheln) haben irgendwo ein kaputtes Stück' }),
        color('ladder.tint', 'Färbung', { hint: 'Grundfarbe (Bild ist grau, wird eingefärbt). Leer = grau' }), color('ladder.ropeTint', 'Färbung Seilwinde', { hint: 'Fatbird: die Leiter zum Boden' })] },
      { title: 'Technik', fields: [text('title', 'Titel'), num('tileSize', 'Kachelgröße', { unit: 'px', min: 8 }), num('gravity', 'Schwerkraft', { unit: 'px/s²', min: 0 }),
        num('typeSpeed', 'Dialog-Tempo', { unit: 'Zeichen/s', min: 0, hint: 'So schnell tippt sich eine Zeile im Dialog mit den Companions aus (#025). 0 = sofort ganz. E zeigt die Zeile sofort ganz' }),
        bool('confirmLeave', 'Rückfrage beim Abreisen', { hint: 'Daniel, 13.11.2026: am Van im POI fragt das Spiel „Wirklich zurückreisen?“. Aus = sofort zurück ins Camp' }),
        size('resolution', 'Auflösung', { unit: 'px', hint: 'Interne Auflösung, wird skaliert' }), bool('pixelArt', 'Pixel-Art (scharf skalieren)')] },
      { title: 'Stimmen', fields: [bool('voice.enabled', 'Gebrabbel an', { hint: 'Daniel, 19.11.2026: statt Sprachausgabe Gebrabbel aus Code (Werkstatt › Stimmen), nichts zu übersetzen' }),
        num('voice.volume', 'Lautstärke', { unit: '%', min: 0, max: 200 }), num('voice.bubbles', 'Sprechblasen', { unit: '% der Lautstärke', min: 0, max: 200, hint: 'Im Camp leiser, je weiter Leyla weg ist' }),
        num('voice.max', 'Höchstens', { unit: 's je Zeile', min: 1, hint: 'Lange Zeilen brabbeln nur so lange' }), bool('voice.leyla', 'Leyla macht Laute', { hint: 'Beim Antworten im Dialog ein kurzes Hm, Ha!, Mhm …' }),
        bool('voice.barks', 'Gegner rufen', { hint: 'Raider rufen, wenn sie Leyla entdecken, getroffen werden oder fallen' }), num('voice.barkGap', 'Rufe höchstens alle', { unit: 's je Gegner', min: 0 }), num('voice.barkChance', 'Ruft bei Treffer', { unit: '%', min: 0, max: 100 })] },
      { title: 'Effekte', fields: [bool('sfx.enabled', 'Effekt-Töne an', { hint: '#130: Kampf, Bewegung, Beute und Menüs (Werkstatt › Ton-Ereignisse). M schaltet allen Ton aus' }),
        num('sfx.volume', 'Lautstärke', { unit: '%', min: 0, max: 200, hint: 'Gilt für alle Ton-Ereignisse; jedes hat dazu seine eigene' }), bool('sfx.ui', 'Menü-Töne', { hint: 'Fokus, Bestätigen, Zurück, Geht nicht in den Fenstern' }),
        bool('sfx.footsteps', 'Schritte', { hint: 'Je nach Untergrund (Ton-Ereignisse › Untergrund)' }), num('sfx.stride', 'Schrittlänge beim Rennen', { unit: 'px', min: 40 }), num('sfx.strideWalk', 'Schrittlänge beim Gehen', { unit: 'px', min: 40 }),
        num('sfx.burst', 'Höchstens gleichzeitig', { unit: 'Töne je 80 ms', min: 1, hint: 'Viele Treffer auf einmal: nur so viele klingen' })] },
      { title: 'Beute-Bilanz', fields: [bool('summary', 'Bilanz nach dem Run', { hint: '#017: zurück im Camp eine Karte mit Rang, Δ, Mitgebrachtem, Neuem (Rezepte, Techtree, Aufträge, Tank) und einem Knopf zur passenden Station. Aus = nur der Banner wie früher' })] },
      { title: 'Zielzeile', fields: [bool('quest.enabled', 'Zielzeile zeigen', { hint: '#016 roter Faden: im HUD, auf der Karte und nach dem Run steht der nächste Schritt zum Heilmittel bzw. der Tank, wenn er schwach ist' }),
        ref('quest.goal', 'Endziel', 'techtree', { hint: 'Knoten, auf den alles hinläuft. Leer = heilmittel' }), num('quest.tankWarn', 'Tank zuerst unter', { unit: '%', min: 0, max: 100, hint: 'Unter diesem Zustand zeigt die Zielzeile den Tank statt des Techtrees. Leer = 45' })] },
      { title: 'Tutorial', fields: [bool('tutorial.enabled', 'Lektionen beim ersten Mal', { hint: '#011: Karte mit Clip, wenn man etwas zum ersten Mal sieht oder kann. Spieler können sie unter Menü › Optionen abschalten' }), num('tutorial.gap', 'Abstand zwischen zwei Karten', { unit: 's', min: 0 }),
        bool('tutorial.runTips', 'Im Run als Tipp', { hint: '#016: im Run kommen Lektionen als kleiner Tipp in der Ecke, das Spiel läuft weiter (Klick auf „Mehr“ öffnet die Karte). Fenster-Lektionen bleiben Karten. Aus = überall Karten' }),
        num('tutorial.tipSeconds', 'Tipp bleibt', { unit: 's', min: 2, hint: 'Leer = 9' })] },
      { title: 'Controller', fields: [bool('gamepad.enabled', 'Controller an', { hint: 'Gamepad-API des Browsers: Xbox, PlayStation, Stadia (Bluetooth-Modus), Switch Pro … mit Standard-Belegung. Die Knöpfe heißen hier nach ihrer Lage, die Hilfe im Spiel zeigt die Symbole des angeschlossenen Controllers' }),
        ref('gamepad.icons', 'Symbole', 'assets', { hint: 'Asset der Art „Symbole“ (tools/pad_icons.py): <typ>_0 … <typ>_9 je Controller (xbox, stadia, ps, switch), dazu für alle gleich stick_l, stick_r, stick_l_up … stick_l_press, stick_r_press, dpad, dpad_up …' }), num('gamepad.iconSize', 'Symbol-Größe', { unit: 'px', min: 16, max: 64, hint: 'So hoch erscheinen die Knöpfe in Hinweisen und Hilfe (Standard 32)' }),
        select('gamepad.symbols', 'Symbole von', PAD_KINDS, { hint: 'Automatisch nach dem Namen, den der Controller meldet; zum Testen fest einstellbar (Stadia meldet sich manchmal ohne Namen)' }),
        num('gamepad.deadzone', 'Totzone', { unit: '%', min: 0, max: 90, hint: 'So weit muss der Stick geneigt sein, bevor Leyla läuft' }),
        num('gamepad.walkTilt', 'Gehen bis', { unit: '%', min: 0, max: 100, hint: 'Stick nur bis hier geneigt = gehen statt rennen (0 = aus)' }),
        num('gamepad.useTilt', 'Benutzen ab', { unit: '%', min: 0, max: 100, hint: 'Daniel, 12.11.2026: Benutzen = linken Stick deutlich nach oben antippen (Knopf „Linker Stick ↑“), zählt nur mit E-Hinweis im Bild, im Stand oder Gehen; der Hinweis schlägt die Leiter. Leer = 70' }),
        num('gamepad.throwHold', 'Wegwerfen: rüber-Knopf halten', { unit: 'ms', min: 0, hint: 'Inventar: Y (Tastatur F) getippt = auf die andere Seite, so lange gehalten = auf den Boden werfen. 0 = aus. Leer = 450' }),
        num('gamepad.buildHold', 'Rig bauen: Inventar-Knopf halten', { unit: 'ms', min: 0, hint: 'Daniel, 12.11.2026: im Camp öffnet der Inventar-Knopf (Select) gehalten den Bau-Modus, getippt wie immer das Inventar. Im Bau-Modus schaltet er Rig offen/zu. 0 = aus. Leer = 500' }),
        bool('gamepad.rumble', 'Vibration', { hint: 'Daniel, 13.11.2026 (#010): kurzes Rumpeln im Bau-Modus beim Springen, Packen, Ablegen und Verkaufen, wo der Browser es kann. Aus = still' }),
        bool('gamepad.useUp', 'Benutzen auch mit ↑ / W', { hint: 'Tastatur: W / ↑ wirkt wie E, solange ein E-Hinweis zu sehen ist (auch der Stick ↑). Aus = nur E bzw. der Knopf aus der Belegung' }),
        ...PAD_ACTIONS.map(([a, n]) => multi(`gamepad.map.${a}`, n, PAD_BUTTONS))] },
      { title: 'Nebel', fields: [bool('fog.enabled', 'Dunkelheit wie The Looter', { hint: '#043 (Daniel, 16.11.2026: „mehr Enge und Dichte“): nur innen. Ungesehen schwarz, in Sicht klar, besucht halbdunkel; Wände und Fels außerhalb des bespielbaren Bereichs sind schwarze Masse mit ausgefranstem Rand' }),
        num('fog.density', 'Ungesehen', { unit: '%', min: 0, max: 100, hint: 'Luft, die Leyla noch nie gesehen hat (100 = schwarz)' }), num('fog.secretDensity', 'Hinter Secrets', { unit: '%', min: 0, max: 100, hint: 'Luft, die nur durch Scheinwand oder brüchige Wand erreichbar ist' }),
        num('fog.remembered', 'Besucht', { unit: '%', min: 0, max: 100, hint: 'Schon gesehen, gerade nicht in Sicht: halb durchsichtig, aber wieder dunkel' }),
        num('fog.walls', 'Kante', { unit: '%', min: 0, max: 100, hint: 'Die erste Wand-Kachel neben der Luft: so viel dunkler als die Luft daneben (die Textur der Kante bleibt sichtbar)' }),
        num('fog.mass', 'Masse ab', { unit: 'Kacheln', min: 1, max: 6, hint: 'So weit von der Luft weg, die Leyla erreichen kann, wird alles schwarze Masse (Wände, Fels, unerreichbare Luft)' }),
        num('fog.ragged', 'Ausfransen', { unit: '%', min: 0, max: 100, hint: 'Rand wie verkohltes Papier: 0 = weicher Verlauf' }), num('fog.grain', 'Körnung', { unit: 'px je Kachel', min: 2, max: 32, hint: 'Wie fein der Rand gezeichnet wird (16 = 4 Weltpixel)' }),
        num('fog.sight', 'Sicht', { unit: 'Kacheln', min: 1, hint: 'Sichtlinien von Leylas Augen, Wände halten sie auf' }), num('fog.fade', 'Aufdecken dauert', { unit: 'ms', min: 0 }),
        num('fog.fakeFade', 'Scheinwand blendet aus', { unit: 'ms', min: 0 }), color('fog.color', 'Farbe'),
        bool('fog.earth', 'Erde unter der Oberfläche', { hint: '#132: unter dem Boden des Eingangs zeigt die Dunkelheit Erdschichten statt Schwarz (aus = schwarz)' }), text('fog.earthColors', 'Erdschichten', { hint: 'Farben von oben nach unten, mit Komma' }), color('fog.earthStones', 'Steine'), num('fog.earthDepth', 'Erde bis', { unit: 'Kacheln', min: 1, hint: 'Ab hier nur noch die Farbe der Dunkelheit' })] },
      { title: 'Vordergrund', fields: [bool('foreground.enabled', 'Silhouetten im Vordergrund', { hint: '#043: schwarze Schutt-, Kisten-, Rohr- und Fass-Umrisse vor dem Boden der Innenräume, mit Parallaxe' }),
        range('foreground.every', 'Abstand', { unit: 'Kacheln', hint: 'Zwischen zwei Silhouetten (zufällig in diesem Bereich)' }), range('foreground.height', 'Höhe', { unit: 'Kacheln', hint: 'Über den Boden hinaus' }),
        num('foreground.parallax', 'Parallaxe', { unit: '%', min: 100, max: 160, hint: '100 = mit der Welt, mehr = näher an der Kamera' }), num('foreground.alpha', 'Deckkraft', { unit: '%', min: 0, max: 100 }), color('foreground.color', 'Farbe')] },
      { title: 'Raumname', fields: [bool('roomTitle.enabled', 'Raumname einblenden', { hint: '#043: beim ersten Betreten eines Raums im POI sein Name als Titel (Raum-Bausteine › Name)' }), num('roomTitle.ms', 'Steht', { unit: 'ms', min: 500 })] },
      { title: 'Kampf', fields: [select('combat.shootStyle', 'Schießstil', [['classic', 'Klassisch (zum Schießen stehen oder gehen)'], ['cells', 'Cells-like (Schießen im Rennen, Zielhilfe)']], { hint: 'Daniel, 11.11.2026 (design.md): zwei Varianten zum Ausprobieren. Im Spiel umschaltbar unter Menü › Optionen (gilt dann nur in diesem Browser)' }),
        num('combat.runSpeed', 'Tempo mit Waffe', { unit: '%', min: 10, max: 100, hint: 'Cells-like: Renntempo mit gezogener Waffe' }),
        num('combat.cone', 'Zielkegel', { unit: '°', min: 0, max: 89, hint: 'Cells-like: ± um die Blickrichtung' }), num('combat.range', 'Zielweite', { unit: 'Kacheln', min: 0 }),
        num('combat.bulletSpeed', 'Kugeltempo', { unit: 'px/s', min: 0, hint: 'Cells-like; leer = Tempo der Waffe' }), bool('combat.marker', 'Ziel-Marker', { hint: 'Ecken um den Gegner, den der nächste Schuss trifft' }), color('combat.markerColor', 'Marker-Farbe'),
        num('combat.noiseShot', 'Lärm: Schuss', { unit: 'px', min: 0, hint: 'So weit hören Gegner Leylas Schüsse (× ihr „Hört“, durch Wände die Hälfte). Leer = 900' }),
        num('combat.noiseMelee', 'Lärm: Nahkampf', { unit: 'px', min: 0, hint: 'Treffer, Block, Hieb gegen die Wand. Leer = 380' }),
        num('combat.alarmRange', 'Gruppen-Alarm: Rufweite', { unit: 'px', min: 0, hint: '#039: Wer Leyla entdeckt, ruft Gegner derselben Familie in dieser Weite (× ihr „Ruft andere“). Gerufene schauen nach, wo sie war; wer sie dann sieht, ruft weiter. 0 = aus. Leer = 900' }),
        num('combat.alarmDelay', 'Gruppen-Alarm: Verzögerung', { unit: 'ms', min: 0, hint: 'So lange, bis die Gerufenen reagieren (dazu etwas je Entfernung). Leer = 350' })] },
      { title: 'Kampf · Blut', fields: [bool('combat.blood.enabled', 'Blutspritzer', { hint: 'Daniel, 12.11.2026: „mehr Treffer-Feedback in Form von Blutspritzern“. Spritzer in Schlagrichtung (mehr bei mehr Schaden und Krits), roter Nebel, Tropfen bleiben am Boden und laufen Wände runter, beim Tod eine Lache. Maschinen sprühen Funken und Öl. Aus = die alten kleinen Partikel' }),
        num('combat.blood.amount', 'Menge', { unit: '%', min: 0, max: 400, hint: 'Leer = 100' }), bool('combat.blood.decals', 'Bleibt liegen', { hint: 'Flecken am Boden und an Wänden' }),
        num('combat.blood.stay', 'Verblasst nach', { unit: 's', min: 1, hint: 'Leer = 20' }), num('combat.blood.max', 'Höchstens', { unit: 'Flecken', min: 10, hint: 'Ältere verschwinden zuerst. Leer = 160' }),
        color('combat.blood.color', 'Farbe', { hint: 'Leer = dunkles Rot' })] },
      { title: 'Kamera', fields: [num('camera.zoom', 'Zoom', { min: 0.3, max: 2, step: 0.05, hint: '1 = 1920×1080 Spielpixel sichtbar, 0,75 = weiter raus (mehr sichtbar), über 1 = näher ran' }),
        num('camera.lookAhead', 'Vorlauf', { unit: 'px', min: 0, hint: 'So weit schaut die Kamera in Laufrichtung voraus' }), num('camera.lookUp', 'Blick nach oben im Run', { unit: 'px', hint: '#132: so weit über Leyla liegt die Bildmitte in POIs (mehr Raum oben, weniger Dunkel unten)' }), num('camera.skyAbove', 'Himmel über dem Level', { unit: 'px', min: 0, hint: 'So weit darf die Kamera im Run über die Oberkante des Levels steigen' }), num('camera.follow', 'Nachziehen', { min: 0.01, max: 1, step: 0.01, hint: '1 = klebt an Leyla, kleiner = weicher' })] },
      { title: 'Kacheln', fields: [ref('tiles.platform', 'Plattform', 'assets', { hint: 'Asset der Art „Kacheln“ mit 4 Frames: einzeln, links, Mitte, rechts. Leer = aus Code gezeichnet' }),
        ref('tiles.terrain', 'Kachel-Set', 'terrain', { hint: 'Wände und Böden in allen Räumen ohne eigenes Kachel-Set. Leer = aus Code gezeichnet' }),
        bool('tiles.depth', 'Tiefe aus Code', { hint: 'Licht, Schatten und Masse für alle Kachel-Sets (Kachel-Sets › Tiefe); aus = flach wie früher' }), num('tiles.leylaCm', 'Leyla ist groß', { unit: 'cm', min: 50, hint: 'Maßstab für Clutter-Größen: Leylas Höhe im Spiel (Asset Stehen) entspricht so vielen Zentimetern. Leer = 170' })] },
      { title: 'Atmosphäre', fields: [bool('atmosphere.enabled', 'Licht & Atmosphäre', { hint: 'Dunkelheit mit Lampen, Glühen, Farbstimmung, Staub, Funken, Tropfen und Bodennebel (Bereich Atmosphäre). Aus = alles gleich hell wie früher. Nicht im Camp' }),
        ref('atmosphere.default', 'Standard', 'atmosphere', { hint: 'Für Räume, deren Raum-Baustein und Kachel-Set keine Atmosphäre nennen. Leer = keine' }),
        num('atmosphere.scale', 'Lichtkarte grob', { unit: '×', min: 1, max: 16, hint: 'Die Lichtkarte wird in 1/n der Auflösung gerechnet und weich hochskaliert. Größer = schneller und weicher. Leer = 4' }),
        num('atmosphere.leyla.radius', 'Licht um Leyla', { unit: 'px', min: 0, hint: 'Kleiner Schein um Leyla, damit sie im Dunkeln nie ganz verschwindet' }), num('atmosphere.leyla.strength', 'Licht um Leyla', { unit: '%', min: 0, max: 100 }),
        num('atmosphere.rays', 'Lichtstrahlen', { unit: '%', min: 0, max: 100, hint: '#082 (God Rays): sichtbare Lichtkegel unter Decken- und Röhrenlampen, mit leichtem Flimmern. 0 = aus. Leer = 22' }),
        num('atmosphere.shadows', 'Schatten', { unit: '%', min: 0, max: 100, hint: '#082: weiche Schatten unter Leyla und Gegnern, vom hellsten Licht weggeschoben. 0 = aus. Leer = 55' }),
        num('atmosphere.blackout.chance', 'Sicherungskasten', { unit: '% je Level', min: 0, max: 100, hint: '#082 Stromausfall: ein Kasten im POI schaltet alle Lampen aus, nur Notlicht bleibt (rot). Leer = 60' }),
        num('atmosphere.blackout.sight', 'Gegner sehen im Dunkeln', { unit: '%', min: 0, max: 100, hint: 'so viel ihrer Sichtweite bleibt bei Stromausfall. Leer = 55' }),
        num('atmosphere.depth', 'Ebene', { hint: 'Tiefe der Lichtkarte: alles darunter wird abgedunkelt (Leyla 10, schwebende Zahlen 20). Leer = 14' })] },
      { title: 'Spawn-Punkt', fields: [bool('spawn.enabled', 'Zeigen'), ref('spawn.look', 'Aussehen', 'assets', { hint: 'Bild oder Animation; der Ankerpunkt des Assets sitzt auf Leylas Start (L im Raum-Layout)' }),
        point('spawn.offset', 'Versatz', { unit: 'px', hint: 'Verschiebt das Bild gegenüber dem Start (x nach rechts, y nach unten)' }), bool('spawn.flip', 'Gespiegelt'),
        select('spawn.layer', 'Ebene', [['behindWalls', 'Hinter Wänden'], ['front', 'Vor Wänden, hinter Leyla']], { hint: 'Hinter Wänden: Wände verdecken das Bild, wenn es hineinragt' })] },
      { title: 'Spawn-Punkt · Tür', fields: [bool('spawn.door.enabled', 'Tür bewegt sich', { hint: 'Animation des Aussehens: erster Frame zu, letzter offen; läuft vor oder zurück' }),
        num('spawn.door.openRange', 'Öffnet ab', { unit: 'px', min: 0, hint: 'Abstand Leyla – Ankerpunkt (Höhe zählt 1,5-fach)' }),
        num('spawn.door.closeRange', 'Schließt ab', { unit: 'px', min: 0, hint: 'Etwas größer als „Öffnet ab“, sonst flattert die Tür' }),
        num('spawn.door.fps', 'Tempo', { unit: 'fps', min: 1, hint: 'Leer = fps des Assets' })] },
      { title: 'Spawn-Punkt · Kofferraum im POI', fields: [bool('spawn.trunk.enabled', 'Kofferraum im POI', { hint: '#094 (Daniel 19.11.2026): am Heck des Vans Beute sicher verstauen, auch bei k.o.; zurück im Camp kommt sie in den Rucksack (Rest ins Camp-Lager, was dann noch fehlt, bleibt im Kofferraum)' }),
        num('spawn.trunk.x', 'Hecktür bei', { unit: 'Bildpixel x', hint: 'x im Bild des Aussehens, dort zeigt E „Kofferraum“' }), size('spawn.trunk.size', 'Größe', { unit: 'Felder' })] },
      { title: 'Spawn-Punkt · Dach', fields: [bool('spawn.roof.enabled', 'Begehbar', { hint: 'Plattform wie „=“: von unten durchspringbar, S + Leertaste fällt durch' }),
        range('spawn.roof.x', 'Von – bis', { unit: 'Bildpixel', hint: 'x im Bild des Aussehens (Frame 1, ohne Spiegeln)' }),
        num('spawn.roof.y', 'Höhe', { unit: 'Bildpixel', hint: 'y im Bild, auf dieser Zeile stehen Leylas Füße' }),
        ref('spawn.roof.front', 'Vordergrund', 'assets', { hint: 'Gleich große Frames wie der Van, liegt vor Leyla, solange sie oben ist (z. B. das Geländer vorn)' }),
        bool('spawn.ladder.enabled', 'Leiter', { hint: 'Klettern wie „H“: W/E hoch, oben aufs Dach' }),
        num('spawn.ladder.x', 'Leiter x', { unit: 'Bildpixel', hint: 'Mitte der Leiter im Bild' }),
        range('spawn.ladder.y', 'Leiter von – bis', { unit: 'Bildpixel', hint: 'Oben (Dach) bis unten (Boden)' })] },
      { title: 'Spawn-Punkt · Radarschüssel', fields: [ref('spawn.dish.look', 'Aussehen', 'assets', { hint: 'Animation, dreht sich endlos; Maßstab wie der Van' }),
        point('spawn.dish.at', 'Position', { unit: 'Bildpixel', hint: 'Wo der Ankerpunkt der Schüssel auf dem Van sitzt' }),
        num('spawn.dish.speed', 'Tempo', { unit: '×', min: 0, step: 0.1 }),
        table('spawn.bob', 'Wippen pro Frame', [num('dx', 'x'), num('dy', 'y')], { hint: 'Bildpixel je Frame der Tür-Animation (Zeile 1 = Frame 1): die Karosserie federt, die Schüssel federt mit' })] },
      { title: 'Ladebalken', fields: [ref('loading.leyla', 'Leyla', 'assets', { hint: 'Daniel, 12.11.2026: beim Laden und überall, wo man nicht spielen kann (Camp ↔ Run, k.o., Werkstatt), laufen Leyla und AvA als Kontur von links nach rechts. Animation, deren Umriss gezeichnet wird. Leer = leyla_run_side' }),
        ref('loading.drone', 'AvA', 'assets', { hint: 'Bild, dessen Umriss vor Leyla schwebt. Leer = drone_hull' }),
        color('loading.color', 'Farbe Leyla und Balken'), color('loading.accent', 'Farbe AvA'),
        num('loading.height', 'Größe', { unit: 'px', min: 24, hint: 'Höhe von Leyla auf dem Bildschirm. Leer = 96' }),
        num('loading.width', 'Breite', { unit: '% Bildbreite', min: 20, max: 100, hint: 'Leer = 70' }),
        text('loading.text', 'Text', { hint: 'Steht links unter dem Balken, rechts die Prozent, wenn der Anlass keinen eigenen Text hat (Run-Start nennt den POI, k.o. das Banner). Leer = nur Prozent' })] },
      { title: 'Testen', fields: [ref('testRoom', 'Testraum', 'rooms', { hint: 'Diesen Raum startet „Spiel“ auf der Startseite (MVP Movement & Kampf)' })] },
      { title: 'Start', fields: [ref('start.location', 'Startort', 'locations'), ref('start.tractor', 'Zugmaschine', 'tractors'), refs('start.containers', 'Container', 'containers'),
        table('start.inventory', 'Start-Inventar', [select('where', 'Wo', [['backpack', 'Rucksack'], ['storage', 'Camp-Lager']]), ref('item', 'Gegenstand', 'items'), ref('weapon', 'Waffe', 'weapons'), ref('backpack', 'Rucksack', 'backpacks'), num('count', 'Anzahl', { min: 1 })],
          { hint: 'Pro Zeile ein Gegenstand, eine Waffe oder ein Rucksack. Platz suchen die Dinge sich selbst' }),
        table('start.later', 'Nachreichen', [select('where', 'Wo', [['backpack', 'Rucksack'], ['storage', 'Camp-Lager']]), ref('item', 'Gegenstand', 'items'), ref('weapon', 'Waffe', 'weapons'), ref('backpack', 'Rucksack', 'backpacks'), num('count', 'Anzahl', { min: 1 }), bool('force', 'Platz machen', { hint: 'Wer es noch nicht hat, bekommt es; passt es nicht, fliegen die neuesten Dinge raus' })],
          { hint: 'Jeder Spielstand (neu oder alt) bekommt das genau einmal, z. B. eine Test-Waffe. Passt es nicht, kommt es beim nächsten Laden' }),
        refs('start.workshops', 'Werkstätten', 'workshops', { hint: 'Werden der Reihe nach verteilt: erst in die Plätze der Zugmaschine, dann in die Container' }), refs('start.spare', 'Verpackt auf dem Schrottplatz', 'workshops', { hint: 'Liegen am Start in Kisten auf dem Schrottplatz und werden im Bau-Modus eingebaut. Werkstätten, die oben keinen Platz finden, landen auch hier' }), refs('start.companions', 'Companions', 'companions'), num('start.fuel', 'Sprit', { unit: 'l', min: 0 }), num('start.food', 'Vorräte', { unit: 'Rationen', min: 0 })] },
    ],
    check: (x, report, p) => {
      const D = p.data, s = x.start || {};
      const places = (D.tractors?.[s.tractor]?.places || 0) + (s.containers || []).reduce((n, c) => n + (D.containers?.[c]?.places || 0), 0);
      const used = (s.workshops || []).reduce((n, w) => n + (D.workshops?.[w]?.places || 0), 0);
      if (used > places) report('error', `Start-Werkstätten brauchen ${used} Plätze, Zugmaschine und Start-Container haben ${places}`);
      const power = (D.tractors?.[s.tractor]?.power || 0) + (s.workshops || []).reduce((n, w) => n + (D.workshops?.[w]?.power || 0), 0);
      if (power < 0) report('warning', `Start-Rig hat zu wenig Energie (${power} ⚡)`);
      const weight = (s.containers || []).reduce((n, c) => n + (D.containers?.[c]?.weight || 0), 0), pull = D.tractors?.[s.tractor]?.pull;
      if (pull != null && weight > pull) report('error', `Start-Container wiegen ${weight} kg, die Zugmaschine zieht ${pull} kg`);
    },
  },
  splash: {
    name: 'Startseite', icon: 'image', file: 'data/splash.json', kind: 'single',
    hint: 'Die Startseite (online unter /) ist seit #123/#124 der Blick aus dem Van-Cockpit (Abschnitt Cockpit), die alte Szene mit Leyla, die endlos auf uns zurennt, läuft unter /classic weiter. Hintergrund aus Ebenen gilt für beide. Pixel-Art wird scharf skaliert.',
    sections: [
      { title: 'Hintergrund', fields: [refs('background', 'Ebenen', 'assets', { hint: 'Von hinten nach vorn. Alle gleich groß; mit Wetter darf auch die erste transparent sein' }),
        table('front', 'Ebenen davor', [ref('look', 'Bild', 'assets'), num('scale', 'Maßstab', { unit: '% der Hintergrund-Pixel', min: 10 }), num('bottom', 'Unterkante', { unit: 'Bildpixel unter dem Horizont' }), num('alpha', 'Deckkraft', { unit: '%', min: 0, max: 100 })], { hint: '#115: gemalte Parallax-Ebenen (Welt › Parallax-Sets) vor dem Bild, nahtlos gespiegelt, folgen der Maus stärker' }),
        ref('music', 'Musik', 'assets', { hint: '#117 Läuft im Hauptmenü als Schleife (ab der ersten Taste / dem ersten Klick, so wollen es die Browser)' }), num('musicVolume', 'Musik-Lautstärke', { unit: '%', min: 0, max: 100 }),
        table('beams', 'Suchscheinwerfer', [point('at', 'Ansatz', { unit: 'Bildpixel' }), num('angle', 'Richtung', { unit: '° von senkrecht' }), num('swing', 'Schwenk', { unit: '°', min: 0 }), num('length', 'Länge', { unit: 'Bildpixel', min: 10 }), num('alpha', 'Helligkeit', { unit: '%', min: 0, max: 100 })], { hint: '#117: Lichtkegel aus der Skyline, schwenken über den Himmel und rucken ab und zu' }),
        table('skyline', 'Skyline', [point('at', 'Punkt', { unit: 'Bildpixel' })], { hint: '#117: Linienzug über den Dächern von links nach rechts; die Suchscheinwerfer leuchten nur darüber (hinter den Gebäuden)' }), ref('weather', 'Wetter', 'weather', { hint: 'Himmel hinter den Ebenen, Regen davor' }),
        num('horizon', 'Horizont', { unit: '% der Höhe', min: 30, max: 100, hint: 'Hier endet der Hintergrund unten; darunter zeichnet die Startseite den Boden, auf dem Leyla rennt' }),
        num('parallax', 'Tiefe', { unit: '%', min: 0, max: 10, step: 0.5, hint: 'So weit verschieben sich die Ebenen mit Maus bzw. Neigen gegeneinander (vorderste am meisten). 0 = starr' })] },
      { title: 'Leyla', fields: [table('runners', 'Animationen', [ref('look', 'Animation', 'assets'), num('weight', 'Gewicht', { min: 0 }), num('speed', 'Bodentempo ×', { min: 0 })],
          { hint: 'Zufällig gewählt nach Gewicht (2 = doppelt so oft wie 1). Bodentempo × multipliziert das Tempo vom Boden, z. B. 0,5 fürs Gehen. Tempo und Ankerpunkt kommen vom Asset' }),
        range('switchEvery', 'Wechseln alle', { unit: 's', hint: 'Nach so vielen Sekunden wechselt sie zufällig die Gangart. Leer = nur beim Laden der Seite' }),
        num('runnerHeight', 'Größe', { unit: '% der Höhe', min: 10, max: 100, hint: 'Höhe eines Frames im Verhältnis zur Bildschirmhöhe' }),
        num('runnerX', 'Position', { unit: '% der Breite', min: 0, max: 100, hint: 'Wo Leyla steht (auf breiten Bildschirmen); auf schmalen immer in der Mitte' }),
        num('runnerFeet', 'Füße', { unit: '% der Höhe', min: 50, max: 100, hint: 'Auf welcher Höhe ihre Füße stehen (100 = unterer Rand)' })] },
      { title: 'Boden', fields: [num('ground.speed', 'Tempo', { unit: 'm/s', min: 0, max: 30, step: 0.5, hint: 'Wie schnell der Boden unter ihr auf uns zukommt. 0 = steht' }),
        num('ground.specks', 'Steinchen', { min: 0, max: 400, hint: 'Wie viele Steinchen und Risse gleichzeitig im Bild sind' }),
        color('ground.base', 'Farbe Boden', { hint: 'Am besten die Bodenfarbe der vordersten Ebene' }), color('ground.color', 'Farbe Steinchen'), bool('ground.dust', 'Staubwölkchen', { hint: 'Kleine Wolken bei jedem Schritt' }), bool('ground.shadow', 'Schatten unter Leyla'),
        ref('ground.texture', 'Textur', 'assets', { hint: 'Bild von oben (Draufsicht), kachelbar nach oben/unten, z. B. eine Straße. Rollt perspektivisch ab, in Bildpixeln. Leer = einfarbiger Boden mit Steinchen' }),
        num('ground.width', 'Breite der Textur', { unit: 'm', min: 0.5, max: 20, step: 0.1, hint: 'So breit liegt das Texturbild auf dem Boden; daneben wiederholt sich der linke bzw. rechte Rand' }),
        num('ground.edge', 'Rand zum Wiederholen', { unit: 'px', min: 1, max: 64, hint: 'So viele Spalten links und rechts im Texturbild wiederholen sich seitlich (z. B. Sand neben der Straße)' }),
        num('ground.shift', 'Versatz seitlich', { unit: 'm', min: -10, max: 10, step: 0.1, hint: 'Schiebt die Textur nach rechts (+) oder links (−), z. B. damit Leyla auf ihrer Spur läuft' }),
        color('ground.fog', 'Dunst in der Ferne', { hint: 'Zum Horizont hin geht der Boden in diese Farbe über (Horizont-Farbe des Bilds)' }),
        num('ground.fogFrom', 'Dunst ab', { unit: 'm', min: 1, max: 40, step: 0.5, hint: 'Ab dieser Entfernung beginnt der Dunst, am Horizont ist er voll' })] },
      { title: 'Kurve', fields: [bool('curve.enabled', 'Kurve mit Stick und Pfeiltasten', { hint: 'Daniel, 11.11.2026: Stick waagrecht lässt Leyla eine Kurve laufen. Sie bleibt, die Straße biegt sich sanft, ohne Eingabe wird sie wieder gerade' }),
        num('curve.pan', 'Stärkste Kurve', { unit: '% Breite', min: 0, max: 20, step: 0.5, hint: 'So weit wandert der Horizont zur Seite; das Bild wird dafür etwas größer' }),
        num('curve.in', 'Einlenken', { unit: '/s', min: 0.1, step: 0.1, hint: 'Wie schnell die Kurve kommt' }), num('curve.out', 'Begradigen', { unit: '/s', min: 0.1, step: 0.1, hint: 'Wie schnell sie ohne Eingabe wieder gerade wird' })] },
      { title: 'Drohne', fields: [bool('drone.show', 'Zeigen', { hint: 'AvA schwebt neben Leyla und zeigt zufällige Stimmungen (Gesicht + Kaomoji aus dem Bereich Drohne)' }),
        point('drone.at', 'Position', { unit: '%', hint: 'Mitte der Drohne in % des Bildschirms (breit); schmal rückt sie mit Leyla zur Mitte' }), num('drone.height', 'Größe', { unit: '% der Höhe', min: 2, max: 50 }),
        range('drone.every', 'Neue Stimmung alle', { unit: 's' }), num('drone.bob', 'Schweben', { unit: '% der Höhe', min: 0, step: 0.1 }),
        text('drone.moods', 'Stimmungen', { hint: 'Anlässe aus der Tabelle der Drohne, mit Komma getrennt' })] },
      { title: 'Intro', fields: [num('intro.typing', 'Schreibtempo', { unit: 'Zeichen/s', min: 5, max: 400, hint: 'So schnell erscheinen die Textboxen im Intro (Bereich Intro)' }),
        num('intro.appear', 'Panel erscheint in', { unit: 's', min: 0, step: 0.05 }), num('intro.dim', 'Alte Panels abdunkeln', { unit: '%', min: 0, max: 90, hint: 'Damit das aktuelle Panel heraussticht' }),
        num('intro.cameraZoom', 'Kamerafahrt', { unit: '%', min: 0, max: 30, hint: 'So weit zoomt bzw. schwenkt die Kamera über die ganze Zeit eines Panels' }), num('intro.cameraTime', 'Dauer der Kamerafahrt', { unit: 's', min: 1 }),
        ref('intro.music', 'Musik', 'assets', { hint: '#117 Asset der Art Ton; startet mit dem Intro (oder mit der ersten Taste, wenn der Browser Ton sperrt), blendet beim Verlassen aus' }), num('intro.musicVolume', 'Musik-Lautstärke', { unit: '%', min: 0, max: 100 }),
        text('intro.title', 'Titel am Ende', { hint: 'Erscheint nach dem letzten Panel, dann geht es zurück ins Hauptmenü' }), text('intro.subtitle', 'Untertitel am Ende')] },
      { title: 'Horizont-Dunst', fields: [bool('haze.enabled', 'Zeigen', { hint: 'Weicher Übergang zwischen Kulisse und Boden: Hitzeflimmern, Pixel-Raster, warmer Dunst' }),
        num('haze.fade', 'Übergang', { unit: 'Bildpixel', min: 0, hint: 'So hoch reicht der Boden mit Raster ins Bild' }), num('haze.band', 'Flimmer-Höhe', { unit: 'Bildpixel', min: 0 }),
        num('haze.shimmer', 'Flimmern', { unit: 'Bildpixel', min: 0, step: 0.5, hint: 'Wie weit die Zeilen seitlich zittern' }), num('haze.speed', 'Flimmer-Tempo', { min: 0, step: 0.1 }),
        num('haze.glow', 'Dunst', { unit: '%', min: 0, max: 100 }), color('haze.color', 'Dunst-Farbe', { hint: 'Leer = Horizont-Farbe des Wetters' })] },
      { title: 'Cockpit (Hauptmenü aus dem Van, #124)', fields: [
        ref('cockpit.shell', 'Hülle', 'assets', { hint: 'Daniel 20.11.2026: „Blick aus dem Cockpit des Vans“. Dach, Säulen, Armaturenbrett; die Scheibe ist durchsichtig. Alle Punkte unten in Pixeln dieses Bildes (384 × 216)' }),
        ref('cockpit.wheel.look', 'Lenkrad', 'assets'), point('cockpit.wheel.at', 'Lenkrad: Mitte', { unit: 'px' }), num('cockpit.wheel.turn', 'Lenkrad: Einschlag', { unit: '°', min: 0, max: 360, hint: 'So weit dreht es bei vollem Lenken' }), num('cockpit.wheel.scale', 'Lenkrad: Maßstab', { unit: '%', min: 10, max: 400 }),
        ref('cockpit.cluster.look', 'Instrumente', 'assets'), point('cockpit.cluster.at', 'Instrumente: Mitte', { unit: 'px' }), num('cockpit.cluster.scale', 'Instrumente: Maßstab', { unit: '%', min: 10, max: 400 }),
        table('cockpit.cluster.needles', 'Zeiger', [point('at', 'Achse', { unit: 'px im Instrumenten-Bild' }), num('length', 'Länge', { unit: 'px', min: 1 }), select('kind', 'Zeigt', [['speed', 'Tempo'], ['rpm', 'Drehzahl'], ['fuel', 'Tank']])], { hint: 'Aus Code gezeichnet: zittern mit der Straße, springen bei Schlaglöchern' }),
        ref('cockpit.radio.look', 'Radio', 'assets'), point('cockpit.radio.at', 'Radio: Mitte', { unit: 'px' }), num('cockpit.radio.scale', 'Radio: Maßstab', { unit: '%', min: 10, max: 400 }), point('cockpit.radio.lcd', 'Radio: Display oben links', { unit: 'px im Radio-Bild', hint: 'Dort läuft das Menü' }), size('cockpit.radio.lcdSize', 'Radio: Display-Größe', { unit: 'px' }),
        ref('cockpit.mirror.look', 'Rückspiegel', 'assets'), point('cockpit.mirror.at', 'Rückspiegel: Mitte', { unit: 'px' }), num('cockpit.mirror.scale', 'Rückspiegel: Maßstab', { unit: '%', min: 10, max: 400 }),
        ref('cockpit.visor.look', 'Sonnenblende Fahrer', 'assets'), point('cockpit.visor.at', 'Sonnenblende: Mitte', { unit: 'px', hint: 'Leer = hochgeklappt (nicht zu sehen)' }), num('cockpit.visor.scale', 'Sonnenblende: Maßstab', { unit: '%', min: 10, max: 400 }), select('cockpit.visor.counter', 'Sonnenblende: freischalten mit', [['', '– immer da –'], ...ACHIEVEMENT_COUNTERS]), num('cockpit.visor.target', 'Sonnenblende: Ziel', { min: 1 }), text('cockpit.visor.note', 'Sonnenblende: Meldung'),
        table('cockpit.hang', 'Hängt am Spiegel', [ref('look', 'Bild', 'assets'), point('from', 'Aufhängung', { unit: 'px' }), num('length', 'Schnur', { unit: 'px', min: 0 }), num('scale', 'Maßstab', { unit: '%', min: 10, max: 400 }), select('counter', 'Freischalten: Zähler', [['', '– immer da –'], ...ACHIEVEMENT_COUNTERS]), text('filter', 'Filter'), num('target', 'Ziel', { min: 1 }), text('note', 'Meldung')], { hint: 'Pendeln mit Lenken und Schlaglöchern. #142: mit Zähler erst nach einem Ereignis im Spiel (wie Achievements, Meldung im Spiel)' }),
        table('cockpit.clutter', 'Kram (Clutter)', [ref('look', 'Bild', 'assets'), point('at', 'Steht bei', { unit: 'px, Mitte unten' }), num('scale', 'Maßstab', { unit: '%', min: 10, max: 400 }), num('depth', 'Ebene', { hint: '0 = auf dem Armaturenbrett, 1 = vor dem Lenkrad' }), bool('wobble', 'Wackelt'), select('counter', 'Freischalten: Zähler', [['', '– immer da –'], ...ACHIEVEMENT_COUNTERS]), text('filter', 'Filter'), num('target', 'Ziel', { min: 1 }), text('note', 'Meldung')], { hint: 'Daniel: „so, dass wir es später um Clutter ergänzen können“. Jede Zeile ein Stück; Ebene 0 liegt hinter dem Lenkrad. #142 (Daniel 21.11.: „basierend auf Ereignissen im Spiel, mit einer kleinen Unlock-Meldung“): mit Zähler + Ziel erscheint das Stück erst, wenn die Achievement-Zähler (über alle Spielstände) es erreichen; das Spiel meldet es einmal' }),
        table('cockpit.stickers', 'Aufkleber-Plätze', [point('at', 'Mitte', { unit: 'px' }), num('size', 'Größe', { unit: 'px', min: 6 }), num('turn', 'Drehung', { unit: '°' })], { hint: 'Erreichte Achievements kleben hier als Sticker (Bild der Trophäe mit weißem Rand); der Reihe nach' }),
        ref('cockpit.billboard', 'Billboard', 'assets'), point('cockpit.board', 'Billboard: Werbefläche oben links', { unit: 'px im Billboard-Bild' }), size('cockpit.boardSize', 'Billboard: Werbefläche', { unit: 'px' }),
        ref('cockpit.poster', 'Anzeige: Bild', 'assets'), text('cockpit.tagline', 'Anzeige: Untertitel'),
        bool('cockpit.ads', 'Werbung der Marken', { hint: '#143 (Daniel 21.11.): Die Billboards werben im Wechsel für die Marken der Lore (Logo, Name in Markenfarbe, Slogan aus dem Bereich Marken). Leer = an' }), num('cockpit.adEvery', 'Eigene Anzeige jedes n-te Billboard', { min: 1, hint: 'Leer = 3' }), ref('cockpit.adLogos', 'Logos', 'assets', { hint: 'Leer = map_logos (Feld Logo an der Marke = Zelle)' }),
        ref('cockpit.road', 'Straße', 'assets', { hint: 'Boden-Textur fürs Cockpit (16 m breit, rechte Spur)' }),
        num('cockpit.glass.specks', 'Scheibe: Staubkörner', { min: 0, max: 40000, hint: '#125: Schmutz auf der Windschutzscheibe aus Code (leer = 9000)' }), num('cockpit.glass.drops', 'Scheibe: Tropfenspuren', { min: 0, max: 200, hint: 'Leer = 22' }),
        num('cockpit.glass.bugs', 'Scheibe: Insekten', { min: 0, max: 60, hint: 'Leer = 7' }), num('cockpit.glass.seed', 'Scheibe: Zufall', { min: 0, hint: 'Andere Zahl = anders verteilter Schmutz (leer = 124)' })] },
    ],
    check: (x, report, p) => {
      const A = p.data.assets || {};
      for (const r of x.runners || []) if (A[r.look] && A[r.look].kind !== 'animation') report('error', `${r.look}: Leyla braucht ein Asset der Art „Animation“`);
      if (!(x.runners || []).some(r => r.look && (r.weight ?? 1) > 0)) report('hint', 'Keine Animation für Leyla');
      for (const id of x.background || []) if (A[id] && A[id].kind !== 'image') report('warning', `Ebene ${id} ist kein Bild`);
      if (!(x.background || []).length) report('hint', 'Kein Hintergrund: die Startseite zeigt nur die Farbe der Oberfläche');
    },
  },
  intro: {
    name: 'Intro', singular: 'Panel', icon: 'image', file: 'data/intro.json', kind: 'catalog',
    hint: 'Das Intro als Comic (Daniel, 12.11.2026, nach seinem Storyboard): Panels erscheinen nacheinander auf Comic-Seiten, mit Textboxen, Kamerafahrt und Effekten aus Code. Startet nur über das Hauptmenü (online unter /intro); „Spielen“ zeigt es ab dem gewählten Panel. Weiter: Enter, Leertaste, Klick, A; zurück: ←, LB; überspringen: Esc, B. Einstellungen für alle Panels unter Startseite › Intro',
    sections: [
      { title: 'Panel', fields: [NAME, num('page', 'Seite', { min: 1, required: true, hint: 'Comic-Seite; eine neue Seite blättert um' }), num('order', 'Reihenfolge', { min: 0, hint: 'Innerhalb der Seite, kleinere zuerst' }),
        { ...LOOK, hint: 'Bild aus dem Bereich Assets (Art „Bild“), füllt den Rahmen' },
        point('at', 'Position', { unit: '% der Seite', hint: 'Linke obere Ecke des Rahmens auf der Seite (16:9)' }), size('size', 'Größe', { unit: '% der Seite' }),
        select('camera', 'Kamerafahrt', [['none', 'Keine'], ['in', 'Langsam heran'], ['out', 'Langsam weg'], ['left', 'Schwenk nach links'], ['right', 'Schwenk nach rechts'], ['up', 'Schwenk nach oben']]),
        select('effect', 'Effekt', [['none', 'Keiner'], ['bubbles', 'Blasen im Tank'], ['alarm', 'Alarm (rotes Licht, Wackeln)'], ['dust', 'Staub im Licht'], ['embers', 'Funken vom Feuer'], ['searchlight', 'Suchscheinwerfer'], ['glitch', 'Erwachen (Flackern, Licht)']]),
        point('effectAt', 'Effekt-Ort', { unit: '% des Panels', hint: 'Mitte des Effekts (Tank, Feuer, Lampe); leer = Mitte' }),
        table('beams', 'Scheinwerfer', [point('at', 'Lampe', { unit: '% des Bilds' })], { hint: '#117 Effekt „Suchscheinwerfer“: von diesen gemalten Lampen huschen Lichtkegel über den Himmel (folgen der Kamerafahrt)' }),
        num('hold', 'Automatisch weiter nach', { unit: 's', min: 0, step: 0.5, hint: 'Wenn der Text fertig ist. 0 = nur per Taste' })] },
      { title: 'Text', fields: [table('captions', 'Textboxen', [select('speaker', 'Wer', [['', 'Erzähler'], ['Leyla', 'Leyla'], ['AvA', 'AvA']]), text('text', 'Text'),
          select('at', 'Ecke', [['tl', 'oben links'], ['tr', 'oben rechts'], ['bl', 'unten links'], ['br', 'unten rechts']])],
        { hint: 'Nacheinander, Buchstabe für Buchstabe. Erzähler = gelbe Box, Leyla und AvA = Sprechbox mit Namen' })] },
      { title: 'AvA', fields: [bool('drone.show', 'AvA zeigen', { hint: 'Die Drohne wie im Spiel (Hülle, Gesicht, Glanz und angebaute Teile aus dem Bereich Drohne), aus Code ins Bild gesetzt' }),
        point('drone.at', 'Mitte', { unit: '% des Panels' }), num('drone.size', 'Größe', { unit: '% der Panelhöhe', min: 5, max: 100 }),
        num('drone.wake', 'Wacht auf nach', { unit: 's', min: 0, step: 0.1, hint: 'Bis dahin ist der Bildschirm dunkel, dann flackert das Gesicht an' }),
        num('drone.face', 'Gesicht', { min: 0, hint: 'Frame aus Drohne › Gesicht (0 normal, 2 fröhlich, 6 neugierig …)' }), bool('drone.flip', 'Gespiegelt', { hint: 'Schaut nach links' })] },
      { title: 'Anzeige', fields: [text('display.text', 'Großer Text', { hint: 'z. B. „03“; leer = keine Anzeige' }), text('display.sub', 'Darunter', { hint: 'z. B. „TAGE“' }),
        num('display.bar', 'Balken', { unit: '%', min: 0, max: 100, hint: 'Tank-Zustand wie im Spiel; leer = kein Balken. Unter 15 % blinkt er' }),
        point('display.at', 'Mitte', { unit: '% des Panels' }), num('display.size', 'Größe', { unit: '% der Panelhöhe', min: 5, max: 80 }),
        select('display.style', 'Stil', [['alarm', 'Warnung (rot)'], ['holo', 'Hologramm (cyan)']])] },
    ],
    template: { name: 'Neues Panel', page: 1, order: 1, at: [3, 4], size: [45, 44], camera: 'in', effect: 'none', hold: 0, captions: [] },
    row: x => [`Nr. ${x.order ?? 0}`, x.display?.text ? `Anzeige ${x.display.text}` : '', x.captions?.length ? x.captions.length + (x.captions.length > 1 ? ' Texte' : ' Text') : ''].filter(Boolean).join(' · '),
    groupBy: { key: 'page', options: [[1, 'Seite 1'], [2, 'Seite 2'], [3, 'Seite 3'], [4, 'Seite 4']] },
    check: (x, report, p) => {
      const a = p.data?.assets?.[x.look];
      if (!x.look) report('warning', 'Kein Bild');
      else if (a && a.kind !== 'image') report('warning', `${x.look} ist kein Bild`);
      const [ax, ay] = x.at || [0, 0], [w, h] = x.size || [0, 0];
      if (!(w > 0 && h > 0)) report('error', 'Größe fehlt');
      else if (ax + w > 100.5 || ay + h > 100.5) report('warning', 'Panel ragt über die Seite');
    },
  },
  economy: {
    name: 'Wirtschaft', icon: 'coins', file: 'data/economy.json', kind: 'single',
    hint: 'Währung, Startgeld und was beim Tod passiert.',
    sections: [
      { title: 'Währung', fields: [text('currency.name', 'Name', { hint: 'Noch ohne Wirkung: das Spiel schreibt überall „Δ“' }), text('currency.symbol', 'Symbol', { hint: 'Noch ohne Wirkung: das Spiel schreibt überall „Δ“' }), num('startDeltas', 'Startgeld', { unit: 'Δ', min: 0 }), area_('currency.description', 'Hintergrund')] },
      { title: 'Tod (noch ohne Wirkung: der k.o. steht unter Camp › Heilen)', fields: [text('rescue.drone', 'Rettungsdrohne'), bool('rescue.losesRunLoot', 'Run-Beute geht verloren'), bool('rescue.losesEquipped', 'Ausgerüstetes geht verloren'),
        num('rescue.keepPercent', 'AvA rettet', { unit: '%', min: 0, max: 100, hint: 'Anteil der Run-Beute, den AvA mitbringt (später über Drohnen-Upgrades)' }), area_('rescue.description', 'Ablauf')] },
      { title: 'Foodtruck (noch ohne Wirkung: kommt mit dem Verkauf)', fields: [num('foodtruck.priceFactor', 'Preisfaktor', { step: 0.05, min: 0, hint: 'Verkaufspreis = Wert × Faktor' }), num('foodtruck.maxPerStop', 'Max. Verkäufe pro Halt', { min: 0 })] },
    ],
  },
  renames: {
    name: 'Umbenennungen', icon: 'history', file: 'data/renames.json', kind: 'single', noSets: true,
    hint: 'Backlog C10 (#125): Jedes Umbenennen in der Werkstatt oder mit „ng rename“ landet hier. Beim Laden eines Spielstands zieht das Spiel alte IDs auf die neuen nach (Gegenstände, Rezepte, Buffs, Quests, Werkstätten …), damit nichts still verschwindet. Zeilen löschen = alte Spielstände verlieren diese ID wieder.',
    sections: [
      { title: 'Protokoll', fields: [table('log', 'Umbenennungen', [text('area', 'Bereich'), text('from', 'Alte ID'), text('to', 'Neue ID'), text('date', 'Datum')], { hint: 'Älteste oben; Ketten (a → b → c) werden in Reihenfolge angewandt' })] },
    ],
    check: (x, report, p) => {
      for (const r of x.log || []) {
        if (!AREAS[r.area]) report('warning', `Umbenennung ${r.from} → ${r.to}: Bereich „${r.area}“ gibt es nicht`);
        else if (!r.from || !r.to) report('warning', `Umbenennung im Bereich ${r.area} ohne alte oder neue ID`);
      }
    },
  },
  ranking: {
    name: 'Ranking', icon: 'star', file: 'data/ranking.json', kind: 'single',
    hint: 'Nach einem abgeschlossenen POI gibt jede Kategorie Punkte. Die Summe ergibt den Rang, der Rang einen Deltas-Bonus auf das sichere Basisgeld. Wer stirbt, bekommt kein Ranking.',
    sections: [
      { title: 'Kategorien', fields: [num('points.time', 'Durchlaufzeit', { unit: 'Punkte', min: 0, hint: 'Volle Punkte bei Bestzeit des POI oder schneller' }), num('points.kills', 'Kills', { unit: 'Punkte', min: 0, hint: 'Anteil besiegter Gegner × Punkte' }),
        num('points.secrets', 'Secrets', { unit: 'Punkte', min: 0, hint: 'Anteil gefundener Secrets × Punkte' }), num('timeFalloff', 'Zeit-Abfall', { unit: '%/10 s', min: 0, hint: 'Punktabzug je 10 s über der Bestzeit' })] },
      { title: 'Ränge', fields: [table('grades', 'Ränge', [text('grade', 'Rang'), num('minPoints', 'ab Punkten', { min: 0 }), num('bonus', 'Bonus %', { min: 0 }), num('crateRolls', 'Bonus-Kiste: Würfe', { min: 0 }), num('cratePick', 'Wählerisch', { min: 1 })],
        { hint: 'Von schlecht nach gut sortiert. Bonus % kommt aufs Run-Geld (am Van). #141: Ab dem Rang unter Bonus-Kiste steht neben dem Tresor eine leuchtende Kiste mit so vielen Würfen; Wählerisch = je Wurf so viele Einträge ziehen und den wertvollsten behalten' })] },
      { title: 'Bonus-Kiste', fields: [bool('bonusCrate.enabled', 'Bonus-Kiste', { hint: '#141: nach dem Tresor, bei gutem Rang' }), select('bonusCrate.minGrade', 'ab Rang', [['F', 'F'], ['D', 'D'], ['C', 'C'], ['B', 'B'], ['A', 'A'], ['S', 'S']]),
        ref('bonusCrate.loot', 'Beutetabelle', 'lootTables', { hint: 'Leer = die Tresor-Beute des POIs' })] },
      { title: 'Ressourcen verdienen', fields: [table('earn', 'Regeln', [select('when', 'Wofür', EARN_WHEN), ref('item', 'Gegenstand', 'items'), num('chance', 'Chance', { unit: '%', min: 0, max: 100 }), num('min', 'Min', { min: 0 }), num('max', 'Max', { min: 0 }), select('grade', 'ab Rang', [['', '–'], ['F', 'F'], ['D', 'D'], ['C', 'C'], ['B', 'B'], ['A', 'A'], ['S', 'S']]), select('function', 'An Werkstatt-Art', [['', 'alle übrigen'], ...WORKSHOP_FUNCTIONS])],
        { hint: '#039 (design.md: Ressourcen-Rohstoffe für erledigte Aktionen). Jede passende Zeile würfelt für sich: Kisten legen es dazu, besiegte Gegner lassen es fallen (alle bzw. nach Familie, Bosse), Secrets dort, wo die Wand war, der Rang in den Tresor („ab Rang“), Herstellen bei jedem Mal als Nebenergebnis, direkt ins Lager (Daniel 16.11.2026: Ressourcen gegen Fortschritt tauschen, nicht inflationär, weil der Techtree teurer wird, das Nebenergebnis nicht); Zeilen mit Werkstatt-Art gehen dort vor, Zeilen ohne gelten für alle übrigen' })] },
    ],
    check: (x, report) => {
      const g = x.grades || [];
      for (let i = 1; i < g.length; i++) if ((g[i].minPoints ?? 0) <= (g[i - 1].minPoints ?? 0)) report('warning', `Rang ${g[i].grade} braucht nicht mehr Punkte als ${g[i - 1].grade}`);
      const max = (x.points?.time || 0) + (x.points?.kills || 0) + (x.points?.secrets || 0);
      if (g.length && g.at(-1).minPoints > max) report('error', `Rang ${g.at(-1).grade} braucht ${g.at(-1).minPoints} Punkte, es gibt aber nur ${max}`);
      if (x.bonusCrate?.minGrade && !g.some(r => r.grade === x.bonusCrate.minGrade)) report('warning', `Bonus-Kiste ab Rang ${x.bonusCrate.minGrade}: den Rang gibt es nicht`);
      for (const r of x.earn || []) { if ((r.max ?? r.min ?? 1) < (r.min ?? 1)) report('warning', `Ressourcen verdienen: ${r.item} hat Max unter Min`); if (r.when === 'rank' && !r.grade) report('hint', `Ressourcen verdienen: ${r.item} für den Rang ohne „ab Rang“ gilt schon ab F`); }
    },
  },

  weather: {
    name: 'Wetter', singular: 'Wetter', icon: 'rain', file: 'data/weather.json', kind: 'catalog',
    hint: 'Himmel aus Code hinter transparenten Hintergrundbildern (Startseite, Räume): Farbverlauf mit Pixel-Raster, Sonne, Wolken, bedrohliches Glühen, Regen davor. Positionen in % des Hintergrundbilds, Größen in Bildpixeln.',
    template: { name: 'Neues Wetter', sky: { top: '#140c26', middle: '#4a1d4a', low: '#b2413c', horizon: '#f5a052', bands: 9 }, sun: { enabled: true }, glow: { enabled: true }, rain: { enabled: false } },
    row: x => [x.sun?.enabled !== false && 'Sonne', x.glow?.enabled !== false && 'Glühen', x.rain?.enabled && 'Regen'].filter(Boolean).join(' · ') || 'nur Himmel',
    sections: [
      { title: 'Himmel', fields: [NAME, color('sky.top', 'Oben'), color('sky.middle', 'Mitte'), color('sky.low', 'Unten'), color('sky.horizon', 'Horizont'),
        num('sky.bands', 'Farbstufen', { min: 2, hint: 'Stufen des Verlaufs, dazwischen Pixel-Raster' }),
        num('sky.at', 'Horizont-Höhe', { unit: '%', hint: 'Wo der Verlauf die Horizont-Farbe erreicht, vom oberen Bildrand. Leer = Mitte der Sonne' }), DESCRIPTION] },
      { title: 'Sonne', fields: [bool('sun.enabled', 'Zeigen'), num('sun.x', 'Position x', { unit: '%' }), num('sun.y', 'Mitte y', { unit: '%', hint: 'Vom oberen Bildrand; auch der Horizont des Verlaufs. Die Ruinen davor verdecken den Rest' }),
        num('sun.size', 'Radius', { unit: 'Bildpixel', min: 2 }), color('sun.color', 'Farbe oben'), color('sun.color2', 'Farbe unten'), num('sun.stripes', 'Streifen', { min: 0 }), num('sun.halo', 'Schein', { unit: '%', min: 0 })] },
      { title: 'Wolken', fields: [num('clouds.count', 'Anzahl', { min: 0 }), color('clouds.color', 'Farbe'), color('clouds.light', 'Licht von unten'), num('clouds.speed', 'Tempo', { unit: 'Bildpixel/s' }),
        range('clouds.band', 'Höhe von – bis', { unit: '%' })] },
      { title: 'Glühen', fields: [bool('glow.enabled', 'Zeigen', { hint: 'Bedrohliches Glühen hinter dem Horizont, pulsiert und flackert, Funken steigen auf' }), color('glow.color', 'Farbe'),
        point('glow.at', 'Mitte', { unit: '%' }), size('glow.size', 'Größe', { unit: '%' }), num('glow.strength', 'Stärke', { unit: '%', min: 0 }), num('glow.pulse', 'Pulsieren', { unit: 's', min: 0 }),
        num('glow.flicker', 'Flackern', { unit: '%', min: 0 }), num('glow.embers', 'Funken', { min: 0 })] },
      { title: 'Regen', fields: [bool('rain.enabled', 'Regen'), num('rain.amount', 'Tropfen', { min: 0 }), num('rain.speed', 'Tempo', { unit: 'Bildpixel/s', min: 0 }), num('rain.angle', 'Schräge', { unit: '°' }),
        num('rain.length', 'Länge', { unit: 'Bildpixel', min: 1 }), color('rain.color', 'Farbe'), num('rain.opacity', 'Deckkraft', { unit: '%', min: 0, max: 100 }),
        num('rain.darken', 'Himmel abdunkeln', { unit: '%', min: 0, max: 100 }), num('rain.flash', 'Wetterleuchten', { unit: 'pro Minute', min: 0 })] },
      { title: 'Sterne', fields: [num('stars.count', 'Anzahl', { min: 0, hint: '0 = keine (tagsüber)' }), color('stars.color', 'Farbe'), num('stars.twinkle', 'Funkeln', { unit: '%', min: 0, max: 100 }),
        range('stars.band', 'Höhe von – bis', { unit: '%' })] },
    ],
  },

  drone: {
    name: 'Drohne', icon: 'air', file: 'data/drone.json', kind: 'single',
    hint: 'Leylas Drohne: fliegt immer hinter ihr her, reine Deko ohne Physik. Gebaut aus Ebenen (Daniel, 10.11.2026: „modulare Drohne“): Kabel hinten, Hülle, Gesicht auf dem Bildschirm, Glanz darüber, Anbauteile davor oder dahinter. Alle Punkte in Bildpixeln der Hülle. Zeiten in Millisekunden bzw. Sekunden.',
    sections: [
      { title: 'Drohne', fields: [NAME, ref('voice', 'Stimme', 'voices', { hint: 'AvAs Piepser (Stil Roboter)' }), ref('look', 'Hülle', 'assets', { hint: 'Bild der Drohne ohne Gesicht, Ankerpunkt = Mitte des Körpers. Ältere Drohnen: Animation mit einem Frame pro Stimmung' }), num('height', 'Höhe im Spiel', { unit: 'px', min: 8, hint: 'Leer = Höhe aus dem Asset' }),
        bool('enabled', 'Fliegt mit'), select('layer', 'Ebene', [['behind', 'Hinter Leyla'], ['front', 'Vor Leyla']]), DESCRIPTION] },
      { title: 'Gesicht', fields: [ref('face.look', 'Gesichter', 'assets', { hint: 'Animation mit einem Gesicht pro Frame, Ankerpunkt = Mitte des Glases. Leer = die Hülle selbst wechselt den Frame (alte Drohne)' }),
        ref('face.glass', 'Glanz', 'assets', { hint: 'Spiegelung auf dem Glas, liegt über dem Gesicht (gleiche Fläche und Ankerpunkt wie die Hülle)' }), point('face.screen', 'Bildschirm-Mitte', { unit: 'px', hint: 'In Bildpixeln der Hülle' }),
        num('face.lookShift', 'Augen wandern', { unit: 'px', min: 0, step: 0.5, hint: 'So weit rutscht das Gesicht zu Leyla bzw. zum nächsten Gegner' }), num('face.flicker', 'Flimmern', { unit: '%', min: 0, max: 100, hint: 'Alter Bildschirm: Helligkeit zuckt leicht' }),
        num('face.blink.frame', 'Blinzeln: Frame', { min: 0 }), range('face.blink.every', 'Blinzeln alle', { unit: 's' }), num('face.blink.duration', 'Blinzeln dauert', { unit: 'ms', min: 0, hint: 'Nur beim Gesicht „Normal“' })] },
      { title: 'Flug', fields: [point('follow.offset', 'Position', { unit: 'px', hint: 'Von Leylas Füßen aus: x hinter ihr (in Blickrichtung gespiegelt), y nach oben negativ' }),
        num('follow.smooth', 'Nachziehen', { min: 0.01, max: 1, step: 0.01, hint: '1 = klebt an der Position, kleiner = träger' }), num('follow.bob', 'Schweben', { unit: 'px', min: 0, hint: 'Auf und ab' }),
        num('follow.bobSpeed', 'Schwebe-Tempo', { unit: 'Hz', min: 0, step: 0.05 }), num('follow.tilt', 'Neigung', { unit: '°', min: 0, hint: 'Neigt sich beim Fliegen in Flugrichtung' }),
        num('follow.turnDelay', 'Umdrehen nach', { unit: 'ms', min: 0, hint: 'So lange wartet sie, bevor sie Leylas neuer Richtung folgt' })] },
      { title: 'Antigrav-Ring', fields: [point('ring.at', 'Mitte', { unit: 'px' }), size('ring.size', 'Größe', { unit: 'px' }), color('ring.color', 'Farbe'),
        num('ring.glow', 'Leuchten', { unit: '%', min: 0, max: 200 }), num('ring.pulse', 'Pulsieren', { unit: 'Hz', min: 0, step: 0.1 }), num('ring.dash', 'Beim Dash', { unit: '%', min: 0, hint: 'Leuchten beim Dash und schnellen Flug' })] },
      { title: 'Kabel', fields: [table('cables', 'Kabel', [point('at', 'Hängt an', { unit: 'px' }), point('to', 'Schlaufe bis', { unit: 'px', hint: 'Leer = loses Ende' }), num('length', 'Länge', { unit: 'px', min: 1 }), color('color', 'Farbe'), num('width', 'Dicke', { unit: 'px', min: 1 })],
        { hint: 'Hängen unter der Drohne und schwingen mit (aus Code). Punkte in Bildpixeln der Hülle' }),
        num('cable.segments', 'Glieder', { min: 2, max: 24 }), num('cable.gravity', 'Schwerkraft', { unit: 'px/s²', min: 0 }), num('cable.damping', 'Dämpfung', { min: 0.5, max: 1, step: 0.01, hint: 'Kleiner = beruhigt sich schneller' }),
        num('cable.swing', 'Mitschwingen', { unit: '%', min: 0, hint: 'Wie stark der Flug die Kabel mitreißt' }), color('cable.outline', 'Umriss')] },
      { title: 'Anbauteile', fields: [table('parts', 'Anbauteile', [text('name', 'Name'), ref('look', 'Aussehen', 'assets'), point('at', 'Sitzt bei', { unit: 'px', hint: 'Ankerpunkt des Teils sitzt hier (Bildpixel der Hülle)' }),
        select('layer', 'Ebene', [['front', 'Vor der Hülle'], ['behind', 'Hinter der Hülle']]), bool('on', 'Angebaut'), ref('item', 'Gegenstand', 'items')],
        { hint: 'Mit Gegenstand: sichtbar, solange dieser Gegenstand im Inventar an AvA steckt („Angebaut“ zählt dann nicht). Ohne: „Angebaut“ entscheidet' })] },
      { title: 'Plattform', fields: [bool('platform.enabled', 'Leyla kann auf AvA stehen', { hint: 'Daniel, 12.11.2026: „Leyla kann dran hochklettern und auf ihr stehen, bis der Akku alle ist“. Nur solange sie mit dem rechten Stick rausgezogen ist oder danach parkt' }),
        num('platform.park', 'Parkt nach dem Loslassen', { unit: 'ms', min: 0, hint: 'So lange bleibt sie stehen, bevor sie zurückfliegt; 0 = sofort zurück' }), num('platform.battery', 'Akku', { unit: 's', min: 0.5, step: 0.5, hint: 'So lange trägt sie Leyla' }),
        num('platform.recharge', 'Aufladen', { unit: 's', min: 0.5, step: 0.5, hint: 'Von leer bis voll, solange sie niemanden trägt' }), num('platform.cooldown', 'Erholt sich ab', { unit: 'ms', min: 0, hint: 'Nach leerem Akku so lange keine Plattform' }),
        num('platform.width', 'Breite', { unit: 'px', min: 40 }), num('platform.inset', 'Oberkante unter dem Scheitel', { unit: 'px', hint: 'Wie tief die Standfläche unter ihrer Oberkante liegt' }), num('platform.sag', 'Sinkt beim Tragen', { unit: 'px/s', min: 0, hint: 'Je leerer der Akku, desto mehr' }),
        bool('platform.fly', 'Schweben mit Leyla', { hint: 'Steht Leyla auf ihr, bewegt der rechte Stick beide (Daniel, 12.11.2026: „kurz schweben ist ok, aber mit dem Gewicht nicht lange“)' }),
        num('platform.flySpeed', 'Schweben: Tempo', { unit: 'px/s', min: 0 }), num('platform.flyUp', 'Schweben: nach oben', { unit: '%', min: 0, max: 100, hint: 'Steigen ist mit Last langsamer' }),
        num('platform.flyDrain', 'Schweben: Akku-Verbrauch', { unit: '×', min: 1, step: 0.5, hint: 'So viel schneller leert sich der Akku beim Schweben' }),
        num('platform.snap', 'Aufsteigen: Fangbereich', { unit: 'px', min: 0, hint: 'Leyla in der Luft mit den Füßen bis so weit unter der Standfläche (obere Hälfte): sie steht sofort drauf' }),
        text('platform.hangPart', 'Hängen am Anbauteil', { hint: 'Name aus der Tabelle Anbauteile (leer = Greifarm): dort hält Leyla sich fest' }), point('platform.hangAt', 'Griff ohne Teil', { unit: 'px', hint: 'Bildpixel der Hülle, wenn das Teil fehlt' }),
        num('platform.grab', 'Hängen: Fangbereich', { unit: 'px', min: 0, hint: 'So nah müssen Leylas Hände am Griff sein (in der Luft greift sie von selbst)' })] },
      { title: 'Gummiband', fields: [bool('leash.enabled', 'Rechter Stick zieht AvA', { hint: 'Daniel, 12.11.2026: „sanft, wie an einem Gummiband; je weiter weg, desto höher der Widerstand; loslassen = zurück“' }),
        num('leash.reach', 'Reichweite', { unit: 'px', min: 0, hint: 'So weit kommt sie bei voll gedrücktem Stick von ihrer Position weg' }), num('leash.stiffness', 'Widerstand', { min: 0.1, step: 0.1, hint: 'Größer = am Anfang leicht, nach außen immer zäher' }),
        num('leash.smooth', 'Nachziehen', { min: 0.01, max: 1, step: 0.01, hint: 'Wie schnell sie dem Stick folgt (außen langsamer)' }), bool('leash.aimLight', 'Scheinwerfer folgt dem Stick', { hint: 'Der Lichtkegel zeigt in Stick-Richtung, solange gezogen wird' }),
        num('leash.aimHold', 'Licht bleibt nach Loslassen', { unit: 'ms', min: 0 })] },
      { title: 'Scheinwerfer', fields: [text('spot.part', 'Anbauteil', { hint: 'Name aus der Tabelle Anbauteile: solange dieses Teil an AvA steckt, leuchtet sie Leyla den Weg (Daniel, 11.11.2026: „mit Spielwert“). Leer = Suchscheinwerfer' }),
        point('spot.at', 'Linse', { unit: 'px', hint: 'Wo das Licht austritt, in Bildpixeln der Hülle' }), num('spot.range', 'Reichweite', { unit: 'px', min: 0 }), num('spot.angle', 'Öffnung', { unit: '°', min: 2, max: 170 }),
        num('spot.tilt', 'Nach unten', { unit: '°', hint: 'Neigung des Kegels unter die Waagrechte, in Blickrichtung' }), num('spot.strength', 'Stärke', { unit: '%', min: 0, max: 200 }), color('spot.color', 'Farbe'),
        num('spot.glow', 'Schein an der Linse', { unit: '%', min: 0, max: 200 })] },
      { title: 'Rettungsfach', fields: [text('rescue.name', 'Name'), size('rescue.size', 'Größe', { unit: 'Felder', hint: 'Daniel, 10.11.2026: was hier liegt, übersteht ein k.o., AvA bringt es heim' })] },
      { title: 'Stimmungen', fields: [table('moods', 'Stimmungen', [select('mood', 'Anlass', DRONE_MOODS), num('frame', 'Gesicht', { min: 0 }), text('kaomoji', 'Kaomoji'), text('fallback', 'Ersatz ohne Sonderzeichen', { hint: '#134: zeigt AvA, wenn dem Gerät eine Schrift für das Kaomoji fehlt; leer = automatisch' }), num('duration', 'Dauer ms', { min: 0 })],
        { hint: 'Gesicht = Frame der Gesichter (ab 0). Ohne Kaomoji nur das Gesicht. Dauer 0 = solange der Anlass gilt' })] },
      { title: 'Verhalten', fields: [num('idle.boredAfter', 'Langeweile nach', { unit: 's', min: 0, hint: 'Leyla steht still' }), num('idle.sleepAfter', 'Einschlafen nach', { unit: 's', min: 0 }), num('idle.zenAfter', 'Zen nach', { unit: 's', min: 0, hint: 'So lange hält Leyla die Yoga-Pose, dann macht die Drohne mit' }),
        range('idle.randomEvery', 'Zufällige Stimmung alle', { unit: 's', hint: 'Neugierig oder Scannen, während Leyla unterwegs ist' }), num('alertRange', 'Gegner bemerken ab', { unit: 'px', min: 0 }),
        num('lowHealth', 'Wenig Leben unter', { unit: '%', min: 0, max: 100 })] },
      { title: 'Im Camp frei fliegen', fields: [bool('roam.enabled', 'Frei fliegen', { hint: 'Daniel: im Camp fliegt die Drohne frei herum statt Leyla zu folgen' }), range('roam.every', 'Neues Ziel alle', { unit: 's' }),
        range('roam.height', 'Flughöhe', { unit: 'px über dem Boden' }), num('roam.visitLeyla', 'Besucht Leyla', { unit: '%', min: 0, max: 100, hint: 'Wie oft das neue Ziel Leyla ist' }), num('roam.visitTank', 'Besucht den Tank', { unit: '%', min: 0, max: 100, hint: 'Wie oft sie zu ihrem Körper im Cryo-Tank fliegt (dort zeigt sie ihr liebevolles Gesicht)' }), num('roam.smooth', 'Trägheit', { min: 0.005, max: 1, step: 0.005, hint: 'Kleiner = gemütlicher' })] },
      { title: 'Bläschen', fields: [bool('bubble.show', 'Kaomoji zeigen'), num('bubble.size', 'Schriftgröße', { unit: 'px', min: 8 }), color('bubble.color', 'Schrift'), color('bubble.background', 'Hintergrund')] },
    ],
    check: (x, report, p) => {
      const a = p.data?.assets?.[x.face?.look || x.look], n = a?.frames || 1;
      for (const m of x.moods || []) if (a && (m.frame ?? 0) >= n) report('error', `Stimmung ${label(DRONE_MOODS, m.mood)}: Gesicht ${m.frame} gibt es nicht (hat ${n})`);
      if (a && x.face?.blink?.frame != null && x.face.blink.frame >= n) report('error', `Blinzeln: Gesicht ${x.face.blink.frame} gibt es nicht (hat ${n})`);
      if (!(x.moods || []).some(m => m.mood === 'idle')) report('hint', 'Stimmung „Normal“ fehlt, dann zeigt sie Frame 0');
      (x.parts || []).forEach((r, i) => { if (r.on && !r.look) report('warning', `Anbauteil ${r.name || i + 1}: angebaut, aber ohne Aussehen`); });
    },
  },
  leyla: {
    name: 'Leyla', icon: 'person', file: 'data/leyla.json', kind: 'single',
    hint: 'Alle Werte der Spielfigur. Tempo in Pixel pro Sekunde, Zeiten in Millisekunden.',
    sections: [
      { title: 'Allgemein', fields: [NAME, num('health', 'Leben', { min: 1 }), num('invulnerableAfterHit', 'Unverwundbar nach Treffer', { unit: 'ms', min: 0 }), DESCRIPTION, ref('voice', 'Stimme', 'voices', { hint: 'Leyla brabbelt nicht, sie macht beim Antworten kurze Laute (Hm, Ha!, Mhm, Oh?, Nö) in dieser Stimme' })] },
      { title: 'Signaturfarbe', fields: [range('signature.hue', 'Farbton der Signatur', { unit: '°', hint: '#044 (Daniel, 16.11.2026: Haare färben ohne neue Grafik): Haare und Outfit-Akzente teilen sich dieselben Pinktöne; alle Pixel in diesem Farbton wechseln zusammen die Farbe (am Spiegel im Camp)' }),
        num('signature.satMin', 'Sättigung ab', { unit: '%', min: 0, max: 100, hint: 'Grautöne darunter bleiben' }), num('signature.sat', 'Sättigung der Signatur', { unit: '%', min: 5, max: 100, hint: 'Wie satt das gemalte Pink ist; die neue Farbe behält das Verhältnis' }),
        num('signature.mid', 'Mitte Helligkeit', { unit: '%', min: 0, max: 100, hint: 'Die Schattierung bleibt: jeder Ton behält seinen Abstand zu dieser Mitte' }),
        table('signature.colors', 'Farben', [text('name', 'Name'), color('color', 'Farbe'), ref('item', 'Färbemittel', 'items'), ref('brand', 'Marke', 'brands')], { hint: 'Die erste Zeile ist Leyla wie gemalt (ohne Farbe). Mit Färbemittel: eine Packung schaltet die Farbe am Spiegel für immer frei; ohne = von Anfang an' })] },
      { title: 'Laufen & Springen', fields: [num('movement.walkSpeed', 'Gehen', { unit: 'px/s', min: 0 }), num('movement.runSpeed', 'Rennen', { unit: 'px/s', min: 0 }),
        num('movement.acceleration', 'Beschleunigung', { unit: 'px/s²', min: 0 }), num('movement.jumpVelocity', 'Sprungkraft', { unit: 'px/s', min: 0 }),
        num('movement.airJumps', 'Luftsprünge', { min: 0, hint: '1 = Doppelsprung' }), num('movement.airJumpFromFrame', 'Doppelsprung ab Frame', { min: 1, hint: '1 = ganze Animation einmal; größer = nur die Frames ab hier, über die Doppelsprung-Dauer (z. B. die letzten Dash-Frames)' }),
        num('movement.airJumpTime', 'Doppelsprung-Dauer', { unit: 'ms', min: 50, hint: 'Nur mit „ab Frame“ > 1' }), num('movement.airJumpTilt', 'Doppelsprung-Neigung', { unit: '%', min: 0, hint: 'Pose neigt sich in die Sprungrichtung (100 = ganz)' }),
        bool('movement.airJumpGhosts', 'Doppelsprung-Nachbilder', { hint: 'Nachbilder wie beim Dash' }),
        num('movement.airJumpSpin', 'Salto: Umdrehungen', { min: 0, hint: 'Doppelsprung als Salto (12.11.2026): die Kugel-Frames drehen sich im Code so oft um den Körper-Mittelpunkt; 0 = aus' }),
        range('movement.airJumpTuck', 'Salto: Kugel-Frames', { hint: 'Von–bis (1 = erster Frame): davor rollt sie sich ein, danach öffnet sie sich' }), range('movement.airJumpPhase', 'Salto: Drehen von–bis', { unit: '%', hint: 'Anteil der Doppelsprung-Dauer, in dem sie sich dreht' }),
        num('movement.airJumpPivot', 'Salto: Drehpunkt über den Füßen', { unit: 'Bildpixel', min: 0 }), num('movement.coyoteTime', 'Coyote Time', { unit: 'ms', min: 0, hint: 'Springen kurz nach der Kante erlaubt' }),
        num('movement.jumpBuffer', 'Sprungpuffer', { unit: 'ms', min: 0 })] },
      { title: 'Ausdauer', fields: [bool('stamina.enabled', 'Ausdauer an', { hint: '#020 (Daniel, 14.11.2026): Dash, Slide, Doppelsprung und Nahkampf kosten Ausdauer; ist sie leer, geht die Aktion nicht (Leiste blinkt, kurzer Ton)' }),
        num('stamina.max', 'Ausdauer', { min: 1, hint: 'Leer = 100; Ausrüstung kann mehr geben (Wert „Ausdauer“)' }),
        num('stamina.delay', 'Erholt sich nach', { unit: 'ms', min: 0, hint: 'So lange nach der letzten Ausdauer-Aktion passiert nichts. Leer = 600' }),
        num('stamina.regen', 'Erholung', { unit: '/s', min: 0, hint: 'So viel Ausdauer pro Sekunde danach. Leer = 55 (voll in knapp 2 s); Ausrüstung „Erholung“ in % obendrauf' }),
        num('stamina.costs.dash', 'Kosten: Dash', { min: 0 }), num('stamina.costs.slide', 'Kosten: Slide', { min: 0 }), num('stamina.costs.airJump', 'Kosten: Doppelsprung', { min: 0 }),
        num('stamina.costs.melee', 'Kosten: Hieb', { min: 0, hint: 'Jeder leichte Hieb und jeder Kombo-Hieb, auch in der Luft' }), num('stamina.costs.heavy', 'Kosten: schwerer Hieb', { min: 0, hint: 'Aufgeladener Hieb und Kombo-Abschluss' })] },
      { title: 'Dash & Slide', fields: [num('movement.dashDistance', 'Dash-Weite', { unit: 'px', min: 0 }), num('movement.dashCooldown', 'Dash-Abklingzeit', { unit: 'ms', min: 0 }), num('movement.dashFromFrame', 'Dash ab Frame', { min: 1, hint: 'Ausholen davor wird übersprungen; ab hier läuft die Animation über die Dash-Dauer' }),
        bool('movement.dashInvulnerable', 'Unverwundbar beim Dash'), num('movement.slideSpeed', 'Slide-Tempo', { unit: 'px/s', min: 0 }), num('movement.slideDuration', 'Slide-Dauer', { unit: 'ms', min: 0 }),
        range('movement.slideLoop', 'Slide: Schleife (Frames)', { hint: 'Frames davor = Hineinrutschen, danach = Aufstehen; die Schleife läuft, solange sie rutscht (auch im Tunnel). Leer = wie früher (einmal, im Tunnel mittlerer Frame)' }),
        num('movement.slideIn', 'Slide: Hineinrutschen', { unit: 'ms', min: 0 }), num('movement.slideOut', 'Slide: Aufstehen', { unit: 'ms', min: 0, hint: 'Die letzten ms des Slides zeigen das Aufstehen' }), num('movement.slideFps', 'Slide: Schleife fps', { min: 1 })] },
      { title: 'Klettern & Schwingen', fields: [num('movement.climbSpeed', 'Klettern', { unit: 'px/s', min: 0 }), num('movement.climbFromFrame', 'Klettern ab Frame', { min: 1, hint: 'Frames davor (z. B. Stehen) werden übersprungen; die Frames laufen mit dem Kletterweg' }), num('movement.climbStep', 'Kletterweg pro Frame', { unit: 'px', min: 1, hint: 'Ein Klettertakt (8 Frames) hebt sie um einen Tritt: bei 8 px = 64 px, eine Kachel' }), num('movement.ladderSlide', 'Runterrutschen', { unit: 'px/s', min: 0, hint: '↓ an der Leiter rutscht, beschleunigt bis zu diesem Tempo (mit Aussehen „Leiter runterrutschen“ in der U-Boot-Pose, sonst bleibt der Kletter-Frame stehen); 0 = runterklettern' }),
        num('movement.ladderSlideIn', 'Rutschen: Einnehmen (Frames)', { min: 0, hint: 'Leyla › Aussehen › Leiter runterrutschen: so viele Frames zum Einnehmen der Pose, danach Schleife' }), num('movement.ladderSlideFps', 'Rutschen: fps', { min: 1 }),
        bool('movement.ladderMantle', 'Oben seitlich hochziehen', { hint: 'Oben an der Leiter zieht sie sich hoch wie an einer Kante und steht aus der Hocke auf' }), num('movement.swingRope', 'Seillänge', { unit: 'px', min: 0 }), num('movement.swingBoost', 'Schwung-Boost', { unit: '%', min: 0 })] },
      { title: 'Harte Landung', fields: [num('movement.landMinDrop', 'Ab Fallhöhe', { unit: 'px', min: 0, hint: 'Vom höchsten Punkt bis zur Landung (64 px = 1 Kachel)' }),
        num('movement.landMinDistance', 'Oder ab Sprungweite', { unit: 'px', min: 0, hint: 'Waagrecht in der Luft zurückgelegt' }),
        num('movement.landTime', 'Dauer', { unit: 'ms', min: 50 }), num('movement.landFromFrame', 'Landung ab Frame', { min: 1, hint: 'Frames davor (Fallen) werden übersprungen' }),
        num('movement.landCancel', 'Abbrechen ab', { unit: '%', min: 0, max: 100, hint: 'Ab hier brechen Laufen, Springen und Dash die Landung ab' })] },
      { title: 'Bremsen', fields: [bool('brake.enabled', 'Bremsen', { hint: 'Richtung loslassen nach einem echten Sprint am Boden: Leyla rutscht mit Staub aus und kommt zum Stehen (Aussehen › Bremsen)' }),
        num('brake.minSpeed', 'Ab Tempo', { unit: '% vom Rennen', min: 0, max: 100 }), num('brake.minRun', 'Nach Rennen von mind.', { unit: 'ms', min: 0, hint: 'Kurzes Antippen bremst nicht' }),
        num('brake.time', 'Dauer', { unit: 'ms', min: 100 }), num('brake.slide', 'Rutschen bis', { unit: '% der Dauer', min: 5, max: 100, hint: 'Bis hier fällt das Tempo gleichmäßig auf 0, danach steht sie (die letzten Frames)' }),
        num('brake.fromFrame', 'Bremsen ab Frame', { min: 1, hint: 'Frame 1 ist noch Rennen' }), num('brake.cancel', 'Weiterlaufen ab', { unit: '%', min: 0, max: 100, hint: 'Ab hier bricht dieselbe Richtung das Bremsen ab; Gegenrichtung, Springen und Dash sofort' })] },
      { title: 'Kanten & Ducken', fields: [bool('movement.ledgeGrab', 'Kanten greifen', { hint: 'Im Sprung oder Fall an Wand- und Plattformkanten hängen bleiben (Richtung zur Wand halten)' }),
        num('movement.ledgeReach', 'Greifweite', { unit: 'px', min: 0, hint: 'So weit dürfen die Hände unter der Kante sein' }),
        num('movement.mantleTime', 'Hochziehen', { unit: 'ms', min: 50 }), bool('movement.oneArmTap', 'Hängen: ↓ = einarmig', { hint: 'Daniel, 12.11.2026: beim Hängen einmal ↓ antippen = sie baumelt an einem Arm, nochmal ↓ = loslassen. Aus = ↓ lässt gleich los' }), bool('movement.droneOneArm', 'An AvA einarmig', { hint: 'Daniel, 12.11.2026: an AvA hängt sie immer an einem Arm (Leyla › Aussehen › Einarmig hängen)' }),
        bool('movement.vault', 'Kante im Schwung nehmen', { hint: 'Daniel, 11.11.2026: trifft der Sprung die Kante zu hoch zum Hängen, nimmt Leyla sie parkourmäßig: die ersten Hochzieh-Frames fallen weg, mit gehaltener Richtung rennt sie oben gleich weiter' }),
        num('movement.ledgeUp', 'Greifen nach oben', { unit: 'px', min: 0, hint: 'So weit darf die Kante über den Händen sein, sie greift trotzdem (Daniel, 12.11.2026: „zu fummelig“). Früher 8' }),
        num('movement.ledgeSide', 'Greifen zur Seite', { unit: 'px', min: 0, hint: 'So weit darf die Kante neben ihr sein, sie wird rangezogen. Früher 6' }),
        num('movement.ledgeRising', 'Greifen im Steigen', { unit: 'px/s', min: 0, hint: 'Greift schon, solange sie langsamer als das steigt. Früher 350' }),
        bool('movement.ledgeAuto', 'Greifen ohne Richtung', { hint: 'Fliegt oder schaut sie auf eine Kante zu, greift sie auch ohne gehaltene Richtung; ↓ gehalten greift nie' }),
        num('movement.vaultFrom', 'Schwung ab', { unit: 'px', min: 0, hint: 'So weit über der Hänge-Position (Füße, bei 192 px Größe) nimmt sie die Kante im Schwung statt zu hängen; Hängen greift ab ca. 77 px' }),
        num('movement.vaultTime', 'Schwung dauert', { unit: 'ms', min: 50, hint: 'Bei der Schwelle; je höher sie schon ist, desto kürzer' }), num('movement.mantleFromFrame', 'Hochziehen ab Frame', { min: 1, hint: 'Die ersten Frames der Animation (Stehen, Arme hoch) werden übersprungen' }),
        num('movement.standUpTime', 'Aufstehen', { unit: 'ms', min: 0, hint: 'Nach dem Hochziehen aus der Hocke; Laufen oder Springen bricht ab' }),
        num('movement.crouchTime', 'In die Hocke', { unit: 'ms', min: 0, hint: 'Ducken: S im Stand halten. In der Hocke an einer Kante nochmal S = runter an die Kante hängen' })] },
      { title: 'Aussehen', fields: [ref('look.idle', 'Stehen', 'assets'), ref('look.idleAlt', 'Stehen 2', 'assets', { hint: 'Zweite Idle, wechselt zufällig mit Stehen (nach jedem Durchlauf)' }),
        num('idleAltChance', 'Stehen 2 Anteil', { unit: '%', min: 0, max: 100, hint: 'Wie oft nach einem Durchlauf Stehen 2 kommt' }), ref('look.walk', 'Gehen', 'assets'), ref('look.run', 'Rennen', 'assets'),
        ref('look.jump', 'Springen', 'assets'), ref('look.airJump', 'Doppelsprung', 'assets', { hint: 'Läuft einmal beim Sprung in der Luft' }), ref('look.fall', 'Fallen', 'assets', { hint: 'Gleiches Asset wie Springen: läuft dann einfach weiter, beim Fallen ohne Sprung ab der Mitte' }), ref('look.dash', 'Dash', 'assets'), ref('look.slide', 'Slide', 'assets'),
        ref('look.climb', 'Klettern', 'assets'), ref('look.ladderSlide', 'Leiter runterrutschen', 'assets', { hint: 'U-Boot-Pose: Hände und Füße außen an den Holmen (Klettern & Schwingen › Rutschen)' }), ref('look.land', 'Harte Landung', 'assets', { hint: 'Nur nach weiten Sprüngen oder tiefen Stürzen (Leyla › Harte Landung)' }), ref('look.brake', 'Bremsen', 'assets', { hint: 'Nach einem Sprint, wenn die Richtung losgelassen wird (Leyla › Bremsen)' }), ref('look.crouch', 'Ducken', 'assets', { hint: 'Läuft einmal in die Hocke und hält den letzten Frame; rückwärts = Aufstehen nach dem Hochziehen' }),
        ref('look.hang', 'Hängen', 'assets', { hint: 'An einer Kante, Schleife' }), ref('look.hangOne', 'Einarmig hängen', 'assets', { hint: 'An AvA und nach ↓ beim Hängen; Ankerpunkt so, dass die Hand dort sitzt, wo beim Hängen die Hände sind' }), ref('look.mantle', 'Hochziehen', 'assets', { hint: 'An der Kante hoch, ab „Hochziehen ab Frame“' }), ref('look.hurt', 'Treffer', 'assets'), ref('look.reference', 'Referenz', 'assets', { hint: 'Character Sheet, Konzept' })] },
      { title: 'Start-Ausrüstung', fields: [ref('loadout.melee', 'Nahkampf', 'weapons'), ref('loadout.ranged', 'Fernkampf', 'weapons'), ref('loadout.cyberdeck', 'Cyberdeck', 'weapons'), ref('loadout.backpack', 'Rucksack', 'backpacks'),
        refs('loadout.wear', 'Angelegt', 'items', { hint: 'Kopf, Rüstung, Implantate und Drohnenteile, die Leyla und AvA am Anfang tragen (je Platz eins)' })] },
      { title: 'Waffe ziehen', fields: [bool('armed.enabled', 'Automatisch ziehen', { hint: 'Daniel: zieht die Pistole im Kampfmodus, sobald sie nicht rennt (Cells-like: auch im Rennen); Springen, Dash steckt sie weg' }),
        ref('look.draw', 'Ziehen', 'assets'), ref('look.aim', 'Zielen', 'assets'), ref('look.aimWalk', 'Gehen mit Waffe', 'assets'), ref('look.shoot', 'Schießen', 'assets'), ref('look.shootWalk', 'Schießen im Gehen', 'assets'),
        ref('look.runGun', 'Rennen mit Waffe', 'assets', { hint: 'Schießstil Cells-like: sie rennt mit gestreckten Armen weiter, Schüsse blitzen nur und der Schlitten zuckt' }),
        ref('look.runReady', 'Rennen, Waffe an der Brust', 'assets', { hint: 'Daniel: im Kampfmodus ohne Schuss die Arme vor der Brust; nach einem Schuss „Im Anschlag bleiben“ lang' }),
        ref('look.runDraw', 'Rennen, Hand am Holster', 'assets', { hint: 'Ziehen und Wegstecken im Rennen: erste Hälfte Hand am Holster, dann an der Brust' }),
        ref('look.runReload', 'Rennen + Nachladen 1', 'assets'), ref('look.runReload2', 'Rennen + Nachladen 2', 'assets', { hint: 'Zweite Hälfte des Nachladens' }),
        num('armed.holsterTime', 'Wegstecken dauert', { unit: 'ms', min: 0, hint: 'Daniel: Wegstecken = Ziehen rückwärts (Kampfmodus vorbei, Q); 0 = sofort weg' }),
        point('armed.muzzleRun', 'Mündung im Rennen', { unit: 'px', hint: 'Wie Mündung, für Rennen mit Waffe' }),
        bool('armed.recoil', 'Schlitten zuckt', { hint: 'Daniel, 11.11.2026: bei jedem Schuss fährt der Schlitten zurück (Assets › Schlitten, ohne neue Grafik)' }), num('armed.recoilTime', 'Schlitten hinten', { unit: 'ms', min: 0 }),
        bool('armed.quickDraw', 'Quick Draw', { hint: 'Daniel, 12.11.2026: Schießen (Y / K) mit weggesteckter Waffe zieht sie aus der Hüfte und schießt im selben Zug. Aus = erster Druck zieht nur' }),
        num('armed.quickDrawTime', 'Quick Draw dauert', { unit: 'ms', min: 0, hint: 'So schnell läuft das Ziehen beim Quick Draw, dann kommt der Schuss. Leer = 120' }),
        num('armed.drawTime', 'Ziehen dauert', { unit: 'ms', min: 0, hint: 'Endet mit der Pistole vor der Brust (Ziehen per Q / ohne Quick Draw)' }), num('armed.extendTime', 'Arme ausstrecken', { unit: 'ms', min: 0, hint: 'Vor dem ersten Schuss aus der Brust-Haltung' }),
        num('armed.aimHold', 'Im Anschlag bleiben', { unit: 'ms', min: 0, hint: 'Nach Schuss oder Nachladen, dann wieder vor die Brust' }), num('armed.lowerTime', 'Arme senken', { unit: 'ms', min: 0 }), num('armed.drawFromFrame', 'Ziehen ab Frame', { min: 1, hint: 'Die ersten Frames sind noch Stehen' }),
        point('armed.muzzle', 'Mündung', { unit: 'px', hint: 'Von Leylas Füßen aus (bei 192 px Größe): x nach vorn, y nach oben; dort startet der Schuss' }), bool('armed.inCamp', 'Auch im Camp'),
        bool('armed.flashLight', 'Mündungslicht', { hint: 'Kurzer Lichtblitz beim Schuss, beleuchtet die Umgebung' }), color('armed.flashColor', 'Lichtfarbe'), num('armed.flashRadius', 'Lichtradius', { unit: 'px', min: 0 }),
        num('armed.flashTime', 'Blitz dauert', { unit: 'ms', min: 10 }), ref('look.reload', 'Nachladen', 'assets'), ref('look.reloadWalk', 'Nachladen im Gehen', 'assets'), ref('look.work', 'An der Werkstatt', 'assets', { hint: 'Daniel: solange sie im Camp an einer Werkstatt steht (von hinten)' })] },
      { title: 'Treffer', fields: [bool('hit.enabled', 'Treffer-Animation', { hint: 'Daniel, 11.11.2026: Leyla zuckt, wenn sie getroffen wird. Die Grafik hat keine Effekte, Blitz, Ring, Striche und Hitstop kommen aus dem Code' }),
        ref('look.hit', 'Treffer leicht', 'assets'), ref('look.hitHeavy', 'Treffer schwer', 'assets'), num('hit.heavyFrom', 'Schwer ab Schaden', { min: 0, hint: 'Daniel: beide Varianten hängen vom Schaden ab. Darunter leicht (Kriecher 8, Schütze 8, Drohne 6), ab hier schwer (Schläger 12, Schleimbeißer 14, Boss 25)' }),
        bool('hit.scale', 'Wucht folgt dem Schaden', { hint: 'Innerhalb jeder Variante: Dauer, Hitstop, Rückstoß und Effekte wachsen mit dem Schaden' }), num('hit.fullAt', 'Volle Wucht bei', { unit: 'Schaden', min: 1, hint: 'So viel Schaden = Faktor 1; halb so viel = 0,5 (kleinster), anderthalbmal = 1,5 (größter)' }),
        num('hit.time', 'Leicht dauert', { unit: 'ms', min: 50 }), num('hit.heavyTime', 'Schwer dauert', { unit: 'ms', min: 50 }),
        num('hit.inFrames', 'Treffer sitzt nach', { unit: 'Frames', min: 1, hint: 'So viele Frames bis zur Treffer-Pose …' }), num('hit.inTime', 'in', { unit: 'ms', min: 0, hint: '… in dieser Zeit (schnell, egal aus welcher Haltung), der Rest ist Aufrichten' }),
        num('hit.cancelAfter', 'Abbrechen ab', { unit: '%', min: 0, max: 100, hint: 'Ab hier brechen Laufen, Springen, Dash, Angriff die Animation ab' }),
        num('hit.flash', 'Weißer Blitz', { unit: 'ms', min: 0 }), num('hit.hitstop', 'Hitstop', { unit: 'ms', min: 0, hint: 'Schwer: × 1,6' })] },
      { title: 'Übergänge', fields: [num('transition.idleAfter', 'Stehen erst nach', { unit: 'ms', min: 0, hint: 'Daniel, 11.11.2026: zwischen zwei Bewegungen blitzt kein Stehen auf. Nach Gehen oder Rennen läuft der Schritt so lange weiter, erst dann steht sie' }), num('transition.idleAfterAir', 'Nach der Landung', { unit: 'ms', min: 0, hint: 'So lange bleibt der letzte Sprung-Frame nach der Landung, bevor sie steht' }),
        table('transitions', 'Ausnahmen', [ref('from', 'Von', 'assets'), ref('to', 'Nach', 'assets'), num('frame', 'Start bei Frame', { min: 1 })],
          { hint: 'Regeln im Code: Rennen und seine Varianten sowie Gehen mit und ohne Waffe behalten ihren Platz im Schritt. Hier nur Fälle, in denen „Nach“ mittendrin einsetzen soll (Gegenrichtung zählt mit)' })] },
      { title: 'Kampfmodus', fields: [bool('fight.enabled', 'Kampfmodus an', { hint: 'Daniel, 11.11.2026: Leyla ist friedlich oder im Kampfmodus mit gezogener Waffe. Aus = wie früher: die Waffe ist immer bereit' }),
        bool('fight.auto', 'Automatisch ziehen', { hint: 'An = ein Gegner in Sicht zieht die Waffe. Daniel, 12.11.2026: aus, gezogen wird nur per Knopf; ein Gegner in Sicht hält die gezogene Waffe draußen, nach der Ruhe steckt sie sie weg' }),
        num('fight.holdToHolster', 'Wegstecken: halten', { unit: 'ms', min: 0, hint: 'Schießen (Y / K) so lange halten = Waffe wegstecken (der Schuss vom Drücken ist schon raus). 0 = aus. Q auf der Tastatur geht weiter. Leer = 500' }),
        num('fight.sight', 'Sicht', { unit: 'Kacheln', min: 0, hint: 'So nah muss ein Gegner sein (mit freier Sichtlinie)' }), num('fight.calm', 'Ruhe bis weg', { unit: 's', min: 0, hint: 'So lange ohne Gegner in Sicht, Treffer oder Schuss, dann steckt sie die Waffe weg' }),
        bool('fight.onHit', 'Treffer zieht', { hint: 'Ein Treffer bringt sie in den Kampfmodus' }), num('fight.redraw', 'Wieder im Anschlag', { unit: 'ms', min: 0, hint: 'Nach Sprung, Dash oder Slide innerhalb dieser Zeit ist die Waffe ohne Ziehen wieder da' })] },
      { title: 'Nahkampf', fields: [ref('look.meleeLight', 'Leicht (Stand)', 'assets'), ref('look.meleeLightWalk', 'Leicht (Gehen)', 'assets'), ref('look.meleeHeavy', 'Schwer (Stand)', 'assets', { hint: 'Enthält auch das Aufladen (Schleife)' }), ref('look.meleeHeavyWalk', 'Schwer (Gehen)', 'assets'),
        num('melee.chargeTime', 'Schwer ab Halten', { unit: 'ms', min: 0, hint: 'Daniel: J halten, beim Loslassen kommt der schwere Hieb (seit der Kombo 1 s, vorher 3 s)' }), num('melee.chargeAfter', 'Aufladen zeigen ab', { unit: 'ms', min: 0 }), range('melee.chargeLoop', 'Aufladen Frames'),
        num('melee.lightTime', 'Leicht dauert', { unit: 'ms' }), num('melee.lightHit', 'Leicht trifft bei', { min: 0, max: 1, step: 0.05, hint: 'Anteil der Dauer' }),
        num('melee.lightWalkTime', 'Leicht im Gehen dauert', { unit: 'ms' }), num('melee.lightWalkFrom', 'Leicht im Gehen ab Frame', { min: 1 }), num('melee.lightWalkHit', 'Leicht im Gehen trifft bei', { min: 0, max: 1, step: 0.05 }),
        num('melee.heavyTime', 'Schwer dauert', { unit: 'ms' }), num('melee.heavyFrom', 'Schwer ab Frame', { min: 1, hint: 'Nach dem Aufladen' }), num('melee.heavyHit', 'Schwer trifft bei', { min: 0, max: 1, step: 0.05 }),
        num('melee.heavyWalkTime', 'Schwer im Gehen dauert', { unit: 'ms' }), num('melee.heavyWalkFrom', 'Schwer im Gehen ab Frame', { min: 1 }), num('melee.heavyWalkHit', 'Schwer im Gehen trifft bei', { min: 0, max: 1, step: 0.05 }),
        num('melee.heavyDamage', 'Schwer: Schaden', { unit: '%', min: 100 }), num('melee.heavyRange', 'Schwer: Reichweite +', { unit: 'px', min: 0 }), num('melee.heavyKnockback', 'Schwer: Rückstoß +', { min: 0 }),
        num('melee.wallGap', 'An der Wand: Abstand', { unit: 'px', min: 0, hint: 'Daniel, 12.11.2026: Hiebe gehen nie durch Wände; steht sie näher an einer Wand, als die Hieb-Pose vorragt (ab ihrer Mitte, bei 192 px Größe), rutscht sie zurück. 0 = aus. Leer = 96' }),
        num('melee.wallSlide', 'An der Wand: Zurückrutschen', { unit: 'ms', min: 0, hint: 'Leer = 120' })] },
      { title: 'Kombo', fields: [bool('combo.enabled', 'Kombo durch Antippen', { hint: 'Daniel, 11.11.2026: J antippen = Kombo. Die ersten drei Hiebe zufällig aus der Liste, nie zweimal derselbe, der vierte ist der Abschluss, bei perfektem Takt kommt als fünfter ein aufgesetzter Schuss' }),
        table('combo.hits', 'Zufällige Hiebe', [ref('look', 'Stand', 'assets'), ref('walk', 'Im Gehen', 'assets'), bool('trail', 'Hieb-Spur aus Code'), bool('trailUp', 'Spur nach oben'), num('from', 'Ab Frame', { min: 1 }), num('time', 'Dauer', { unit: 'ms', min: 50 }), num('hit', 'Trifft bei', { min: 0, max: 1, step: 0.05 }), num('beat', 'Takt bei', { min: 0, max: 1, step: 0.05 }), num('damage', 'Schaden', { unit: '%', min: 0 }), num('step', 'Schritt', { unit: 'px/s', min: 0 })],
          { hint: 'Takt bei = Anteil der Dauer, ab dem der nächste Hieb startet; wer genau dann tippt, trifft den Takt' }),
        ref('combo.finisher', 'Abschluss', 'assets'), num('combo.finisherFrom', 'Abschluss ab Frame', { min: 1 }), num('combo.finisherTime', 'Abschluss dauert', { unit: 'ms', min: 50 }), num('combo.finisherHit', 'Abschluss trifft bei', { min: 0, max: 1, step: 0.05 }), num('combo.finisherBeat', 'Abschluss: Takt bei', { min: 0, max: 1, step: 0.05 }),
        num('combo.finisherDamage', 'Abschluss: Schaden', { unit: '%', min: 0 }), num('combo.finisherRange', 'Abschluss: Reichweite +', { unit: 'px', min: 0 }), num('combo.finisherKnockback', 'Abschluss: Rückstoß +', { min: 0 }),
        num('combo.perfect', 'Takt-Fenster', { unit: 'ms', min: 0, hint: 'So weit darf das Antippen vor oder nach dem Takt liegen' }), num('combo.misses', 'Fehler erlaubt', { min: 0, hint: 'So viele Taps dürfen den Takt verfehlen, der Schuss kommt trotzdem' }), num('combo.window', 'Kombo hält nach dem Hieb', { unit: 'ms', min: 0, hint: 'Danach beginnt sie wieder mit Hieb 1' }),
        bool('combo.shot', 'Perfekter Takt: Schuss als fünfter', { hint: 'Braucht eine Fernkampfwaffe mit Patrone im Magazin' }), num('combo.shotTime', 'Schuss dauert', { unit: 'ms', min: 50 }), num('combo.shotDamage', 'Schuss: Schaden', { unit: '%', min: 0, hint: 'vom Schaden der Fernkampfwaffe' }), num('combo.shotRange', 'Schuss: Reichweite', { unit: 'px', min: 0 }), num('combo.shotKnockback', 'Schuss: Rückstoß', { min: 0 }),
        bool('combo.show', 'Takt anzeigen', { hint: 'Dezenter Ring neben Leyla, der sich zum Takt schließt, Punkte für die Hiebe' }), color('combo.color', 'Farbe'), color('combo.perfectColor', 'Farbe bei Treffer')] },
      { title: 'Yoga', fields: [ref('look.yoga', 'Yoga-Pose', 'assets', { hint: 'Daniel: mit P auslösen, beim Auflösen rückwärts' }), num('yoga.fps', 'Hinein (fps)', { min: 1 }), num('yoga.backFps', 'Zurück (fps)', { min: 1, hint: 'Rückwärts, wenn sie die Pose auflöst' }), num('yoga.holdFrom', 'Halten ab Frame', { min: 1, hint: 'Ab hier atmet sie in einer Schleife bis zum letzten Frame' })] },
      { title: 'Zufällige Idles', fields: [table('idles', 'Idles', [ref('look', 'Animation', 'assets'), num('weight', 'Gewicht', { min: 0 })],
          { hint: 'Daniel: „Idle-Animationen zufällig abspielen, wenn sie länger nicht bewegt wurde“. Läuft einmal, danach wieder Stehen. Sitzen am Feuer zählt nicht' }),
        range('idleAfter', 'Nach Stillstand', { unit: 's', hint: 'Zufällig zwischen den Werten, danach jedes Mal neu gewürfelt' })] },
      { title: 'Inventar', fields: [num('inventory.pickupRange', 'Boden-Reichweite', { unit: 'px', min: 20, hint: 'Beute in dieser Nähe erscheint im Boden-Inventar (wie bei XCOM)' }),
        bool('inventory.floorStrip.enabled', 'Boden-Leiste unten', { hint: 'Daniel, 12.11.2026: was in Boden-Reichweite liegt, steht unten im Bild; E / Stick ↑ hebt das erste auf, I öffnet alles' }),
        num('inventory.floorStrip.max', 'Boden-Leiste: höchstens', { min: 1, hint: 'So viele Dinge zeigt die Leiste, das nächste zuerst' }), num('inventory.floorStrip.slots', 'Boden-Leiste: Felder', { min: 1, hint: 'So viele Felder hat das Raster mindestens (leere blenden mit aus)' }),
        num('inventory.floorStrip.cell', 'Boden-Leiste: Feldgröße', { unit: 'px', min: 24 }), num('inventory.floorStrip.fade', 'Boden-Leiste: Ausblenden', { unit: '%', min: 0, max: 50, hint: 'So breit blendet das Raster zu den Rändern hin aus' }),
        bool('inventory.autoStack', 'Stapel automatisch auffüllen', { hint: 'Stapelbares, das schon im Rucksack ist, wird beim Drüberlaufen eingesammelt, solange Platz im Stapel ist' }),
        num('inventory.cell', 'Feldgröße', { unit: 'px', min: 24, max: 96, hint: 'Größe eines Rasterfelds auf dem Bildschirm' }),
        num('inventory.dropSpread', 'Beute streut', { unit: 'px', min: 0, hint: 'Wie weit Beutebündel von besiegten Gegnern wegspringen' }),
        ref('inventory.portrait', 'Leyla im Inventar', 'assets', { hint: 'Bild von vorn in der Mitte des Inventars (Daniel, 10.11.2026: Diablo-Stil)' }), num('inventory.portraitScale', 'Maßstab', { min: 0.5, max: 4, step: 0.5, hint: 'Ganze oder halbe Schritte bleiben pixelscharf' }),
        num('inventory.strainMax', 'Belastung höchstens', { min: 0, hint: 'Summe der Belastung aller Implantate' }),
        bool('abilities.gated', 'Doppelsprung und Luft-Dash nur mit Implantat', { hint: 'Cyberware (#006, Daniel, 13.11.2026): im Spiel mit Spielstand schalten Implantate (Beine, Nerven) Doppelsprung und Luft-Dash frei; im Testraum geht immer alles. Aus = wie früher' }),
        table('inventory.implants', 'Implantat-Plätze', [select('slot', 'Platz', WEAR_SLOTS.filter(w => IMPLANT_SLOTS.includes(w[0]))), text('name', 'Name'), point('at', 'Am Körper', { unit: 'Bildpixel', hint: 'Punkt im Bild „Leyla im Inventar“' }), select('side', 'Seite', [['left', 'Links'], ['right', 'Rechts']])],
          { hint: 'Ansicht „Implantate“: je Platz ein Feld links oder rechts neben Leyla mit Linie zum Punkt am Körper' })] },
      // #140 (Daniel, 21.11.2026: „Granaten sind nicht numerisch vorhanden, sondern ein extra Skill mit einem Cooldown“)
      { title: 'Granate (Skill)', fields: [bool('grenade.enabled', 'Granate an', { hint: 'Leer = an. Taste T, Controller: rechten Stick drücken (Spiel › Controller)' }),
        num('grenade.charges', 'Ladungen', { min: 1, hint: 'So viele hintereinander. Leer = 3' }),
        num('grenade.cooldown', 'Abklingzeit', { unit: 's', min: 0, hint: 'Leer = 180' }),
        select('grenade.refill', 'Auffüllen', [['all', 'alle zusammen, Abklingzeit ab dem ersten Wurf'], ['each', 'einzeln, je Ladung eine Abklingzeit']], { hint: 'Leer = alle zusammen' }),
        select('grenade.item', 'Wirft', THROW_ITEMS, { hint: 'Derselbe Code wie beim Werfer (game/play/throwables.js). Leer = Granate' }),
        num('grenade.fuse', 'Zündzeit', { unit: 'ms', min: 0, hint: 'Ab dem ersten Aufkommen. Leer = 900' }), num('grenade.radius', 'Radius', { unit: 'px', min: 10, hint: 'Leer = 160' }),
        num('grenade.damage', 'Schaden', { min: 0, hint: 'In der Mitte, am Rand die Hälfte. Leer = 40' }), num('grenade.burn', 'Brennt', { unit: 's', min: 0, hint: 'Molotow, Säure. Leer = 3' }),
        point('grenade.velocity', 'Wurf', { unit: 'px/s', hint: 'Abwurf nach vorn und oben. Leer = [620, -900]; mit ↑ gehalten höher, mit ↓ flach' }),
        num('grenade.throwTime', 'Wurf dauert', { unit: 'ms', min: 0, hint: 'Ausholen bis Loslassen. Leer = 220' }),
        point('grenade.hand', 'Wurfhand', { unit: 'px', hint: 'Über den Füßen, nach vorn (bei 192 px Leyla). Leer = [30, 170]' }),
        ref('grenade.look', 'Wurf-Oberkörper', 'assets', { hint: 'Animation nur mit Oberkörper (Beine durchsichtig), wird über Stehen, Gehen, Rennen und Springen gelegt. Leer = Platzhalter aus Code' })] },
    ],
    check: (x, report, p) => {
      const W = p.data.weapons || {};
      for (const k of ['melee', 'ranged', 'cyberdeck']) { const id = x.loadout?.[k]; if (id && W[id] && W[id].kind !== k) report('warning', `Start-Ausrüstung ${k}: „${W[id].name}“ ist keine ${label(WEAPON_KINDS, k)}-Waffe`); }
      if ((x.movement?.runSpeed ?? 0) < (x.movement?.walkSpeed ?? 0)) report('warning', 'Rennen ist langsamer als Gehen');
    },
  },
  backpacks: {
    name: 'Rucksäcke', singular: 'Rucksack', icon: 'bags', file: 'data/backpacks.json', kind: 'catalog',
    hint: 'Rucksäcke sind Raster im Diablo-Stil. Gegenstände belegen Felder nach ihrer Größe. Bessere Ausrüstung = mehr Platz.',
    template: { name: 'Neuer Rucksack', size: [6, 4], tier: 1, value: 50 },
    row: x => `${(x.size || []).join('×')} · Stufe ${x.tier ?? '–'}`,
    sections: [{ title: 'Rucksack', fields: [NAME, LOOK, ICON, size('size', 'Raster', { unit: 'Felder' }), size('bag', 'Platz als Gegenstand', { unit: 'Felder', hint: 'So viel Platz braucht der Rucksack selbst in einem Lager (Standard 2 × 3)' }),
      num('tier', 'Stufe', { min: 1, max: 5 }), text('glyph', 'Kürzel', { hint: 'Platzhalter im Inventar' }), VALUE, DESCRIPTION] }],
    check: iconCheck,
  },

  weapons: {
    name: 'Waffen', singular: 'Waffe', icon: 'weapon', file: 'data/weapons.json', kind: 'catalog', groupBy: { key: 'kind', options: WEAPON_KINDS },
    hint: 'Nahkampf, Fernkampf und Cyberdecks (Hacking, später). Leyla trägt je eine davon in ihren Slots.',
    template: { name: 'Neue Waffe', kind: 'melee', damage: 10, cooldown: 400, range: 40, knockback: 100, size: [1, 2], tier: 1, value: 20 },
    row: x => `${label(WEAPON_KINDS, x.kind)} · ${x.damage ?? 0} Schaden · ${x.cooldown ?? 0} ms`,
    check: (x, report) => { if (!x.brand) report('hint', 'Ohne Hersteller (Lore › Marken)'); },
    sections: [
      { title: 'Waffe', fields: [NAME, LOOK, ICON, multi('tags', 'Tags', ITEM_TAGS), select('kind', 'Art', WEAPON_KINDS, { required: true }), num('tier', 'Stufe', { min: 1, max: 5 }),
        text('glyph', 'Kürzel', { hint: 'Platzhalter im Inventar: 1–3 Zeichen oder ein Emoji' }), DESCRIPTION,
        ref('brand', 'Hersteller', 'brands', { hint: 'Daniel, 16.11.2026: „Alle Waffen im Spiel brauchen auch eine Brand“. Qualität der Marke wirkt auf den Schaden, Preis auf den Wert, „In der Beute“ auf die Häufigkeit' }),
        select('skin', 'Aussehen aus Code', [['', 'wie gemalt'], ['revolver', 'Revolver']], { hint: 'Nur Fernkampf, Test (Daniel, 12.11.2026): legt eine Waffe aus Code über die gemalte Pistole in den Posen mit ausgestreckten Armen. An der Brust bleibt vorerst die gemalte' })] },
      { title: 'Entities', when: x => x.kind === 'cyberdeck', fields: [num('glitchSlots', 'Plätze', { min: 0, max: 8, hint: 'Ein Cyberdeck ist ein eigenes Inventar für Entities (#049, Daniel 17.11.2026): so viele trägt Leyla darin, ohne Platz im Rucksack' })] },
      { title: 'Werte', fields: [num('damage', 'Schaden', { min: 0 }), num('cooldown', 'Abklingzeit', { unit: 'ms', min: 0 }), num('range', 'Reichweite', { unit: 'px', min: 0 }),
        num('knockback', 'Rückstoß', { unit: 'px/s', min: 0 }), num('critChance', 'Krit-Chance', { unit: '%', min: 0, max: 100 }), num('ammo', 'Munition', { min: 0, hint: 'Leer = unendlich' }),
        num('projectileSpeed', 'Geschosstempo', { unit: 'px/s', min: 0, hint: 'Nur Fernkampf: so schnell fliegt das Geschoss' }), ref('sound', 'Schuss-Ton', 'assets', { hint: 'Asset der Art Ton' }),
        num('magazine', 'Magazin', { unit: 'Schuss', min: 1, hint: 'Nur Fernkampf: so viele Schuss, dann nachladen (R, leer = automatisch). Munition = Vorrat insgesamt' }), num('reloadTime', 'Nachladen dauert', { unit: 'ms', min: 0 })] },
      { title: 'Posen (Leyla)', fields: [ref('posesFrom', 'Posen von', 'weapons', { hint: 'Daniel, 12.11.2026: „neue Waffen, die entweder Kurzwaffe oder Langwaffe sind, sollten einfach sein“. Eine neue Langwaffe leiht sich die Posen vom Sturmgewehr, eigene Felder unten gehen vor' }), ref('poses.draw', 'Ziehen', 'assets', { hint: 'Daniel, 12.11.2026: eine Waffe kann eigene Posen für Leyla mitbringen (Sturmgewehr). Leer = Leylas eigene (Leyla › Waffe ziehen). Rückwärts = wegstecken' }),
        ref('poses.aim', 'Zielen', 'assets'), ref('poses.shoot', 'Schießen', 'assets'), ref('poses.aimWalk', 'Gehen mit Waffe', 'assets'), ref('poses.shootWalk', 'Schießen im Gehen', 'assets'),
        ref('poses.reload', 'Nachladen', 'assets'), ref('poses.reloadWalk', 'Nachladen im Gehen', 'assets'),
        ref('poses.runGun', 'Rennen mit Waffe', 'assets'), ref('poses.runReady', 'Rennen, Waffe bereit', 'assets'), ref('poses.runDraw', 'Rennen, Ziehen', 'assets'),
        ref('poses.runReload', 'Rennen + Nachladen 1', 'assets'), ref('poses.runReload2', 'Rennen + Nachladen 2', 'assets'),
        point('poses.muzzle', 'Mündung', { unit: 'px', hint: 'Wie Leyla › Waffe ziehen › Mündung, für diese Waffe' }), point('poses.muzzleRun', 'Mündung im Rennen', { unit: 'px' }),
        bool('muzzleFlash', 'Mündungsfeuer aus Code', { hint: 'Daniel, 12.11.2026: für Posen ohne gemalten Blitz; sitzt genau an der Mündung' }), num('kick', 'Rückstoß', { unit: 'px', min: 0, hint: 'So weit ruckt Leyla beim Schuss kurz zurück' })] },
      { title: 'In der Hand', fields: [select('held.class', 'Klasse', HELD_CLASSES, { hint: 'Daniel, 12.11.2026 (#004): welche Posen ein Gegner aus dem Bausatz damit spielt. Leer = Nahkampf leicht bzw. Pistole' }),
        num('hands', 'Hände', { min: 1, max: 2, hint: '2 = beidhändig (Nahkampf schwer, Langwaffe). Leer = 1' }),
        ref('held.look', 'Bild', 'assets', { hint: 'Symbol-Raster mit der Waffe von der Seite, Spitze bzw. Mündung nach rechts (meist dasselbe wie Aussehen)' }), num('held.icon', 'Feld', { min: 0, hint: '0 = oben links, zeilenweise' }),
        point('held.grip', 'Griff', { unit: 'px', hint: 'Wo die Hand greift, in Pixeln des Felds (beidhändig: Mitte zwischen den Händen)' }),
        point('held.tip', 'Spitze', { unit: 'px', hint: 'Klinge bzw. Lauf zeigt vom Griff hierhin; wird auf die Richtung des Platzhalters in jedem Frame gedreht' }),
        point('held.muzzle', 'Mündung', { unit: 'px', hint: 'Nur Fernkampf: hier startet der Schuss. Leer = Spitze' }),
        num('held.cm', 'Länge', { unit: 'cm', min: 1, hint: 'Gemalte Länge der Waffe; der Bausatz rechnet sie mit der Körpergröße in Pixel um' })] },
      { title: 'Rucksack & Handel', fields: [size('size', 'Größe', { unit: 'Felder' }), VALUE] },
      { title: 'Waffenteil', when: x => x.category === 'weaponpart', fields: [select('part.slot', 'Platz', PART_SLOTS_SCHEMA, { hint: 'Daniel, 13.11.2026 (#013, 3c): ein Bauplan hat Plätze, Leyla setzt die Teile frei ein. Jedes Teil ändert die Werte der Waffe' }),
        select('part.kind', 'Nur für', [['', 'Nah- und Fernkampf'], ['melee', 'Nahkampf'], ['ranged', 'Fernkampf']]),
        num('part.damage', 'Schaden', { unit: '%' }), num('part.cooldown', 'Abklingzeit', { unit: '%', hint: 'Negativ = schneller' }), num('part.range', 'Reichweite', { unit: '%' }),
        num('part.crit', 'Krit-Chance', { unit: '%-Punkte' }), num('part.magazine', 'Magazin', { unit: 'Schuss' }), num('part.reload', 'Nachladen', { unit: '%', hint: 'Negativ = schneller' }), num('part.knockback', 'Rückstoß', { unit: '%' })] },
      { title: 'Chip für AvA', fields: [select('chip.stat', 'Wirkt auf', [['', '—'], ['battery', 'Akku (Plattform)'], ['spot', 'Scheinwerfer'], ['speed', 'Fliegt schneller'], ['rescue', 'Rettung kostet weniger'], ['loot', 'Extra-Beute']], { hint: '#013: steckt man an der Drohnenwerkstatt auf AvAs Platine' }),
        num('chip.value', 'Wert', { unit: '%' }), num('chip.power', 'Energie', { min: 0, hint: 'Die Platine hat ein Energie-Budget (Kochen & Craften › Handgriffe › Drohnen-Platine)' })] },
      { title: 'Zerlegen', fields: SALVAGE_FIELDS },
    ],
    check: (x, report, p, id) => {
      iconCheck(x, report, p); for (const m of salvageProblems(p, id, 'weapons')) report(m.kind, m.text);
      if (x.held?.look && p.data?.assets?.[x.held.look]?.kind !== 'icons') report('warning', 'In der Hand › Bild ist kein Symbol-Raster');
    },
  },
  enemies: {
    name: 'Gegner', singular: 'Gegner', icon: 'skull', file: 'data/enemies.json', kind: 'catalog', groupBy: { key: 'family', options: ENEMY_FAMILIES },
    hint: 'Mutanten, Plünderer, Maschinen und „vielleicht noch Gefährlicheres“.',
    template: { name: 'Neuer Gegner', family: 'mutant', behavior: 'patrol', health: 30, damage: 8, speed: 80, aggroRange: 200, deltas: [1, 4], countsForRanking: true },
    row: x => `${label(ENEMY_BEHAVIORS, x.behavior)} · ${x.health ?? 0} Leben · ${x.damage ?? 0} Schaden`,
    sections: [
      { title: 'Gegner', fields: [NAME, LOOK, select('family', 'Familie', ENEMY_FAMILIES), select('behavior', 'Verhalten', ENEMY_BEHAVIORS), DESCRIPTION, ref('voice', 'Stimme', 'voices', { hint: 'Rufe im Kampf (Entdeckt, Getroffen, Fällt) (Werkstatt › Stimmen). Leer = eine Stimme aus dem Vorrat, nach dem Namen gewählt' })] },
      { title: 'Aussehen aus dem Bausatz', fields: [ref('kit', 'Bausatz', 'kits', { hint: 'Daniel, 12.11.2026 (#004): Körper aus dem Bausatz, die Waffe kommt aus „Waffe“ (Waffen › In der Hand). Geht vor „Aussehen“' }),
        text('kitHead', 'Kopf', { hint: 'ID aus Gegner-Bausätze › Köpfe; leer = gemalter Kopf' }), text('kitSkin', 'Hautton', { hint: 'Name aus Bausatz › Hauttöne; leer = wie gemalt' }),
        text('kitGang', 'Gang-Farbe', { hint: 'Name aus Bausatz › Gang-Farben; leer = wie gemalt' })] },
      { title: 'Werte', fields: [num('health', 'Leben', { min: 1 }), num('damage', 'Schaden', { min: 0 }), num('speed', 'Tempo', { unit: 'px/s', min: 0 }),
        ref('weapon', 'Waffe', 'weapons', { hint: 'Optional, sonst Körperangriff' })] },
      { title: 'Wahrnehmung', fields: [num('aggroRange', 'Sieht Leyla bis', { unit: 'px', min: 0, hint: 'Nur mit freier Sichtlinie (Wände, geschlossene Türen und brüchige Wände halten den Blick auf)' }),
        num('sense.cone', 'Blickwinkel', { unit: '°', min: 0, max: 360, hint: 'Ganzer Winkel in Blickrichtung. Leer = 140, Flieger 360 (sieht rundum)' }),
        num('sense.behind', 'Spürt hinter sich', { unit: 'px', min: 0, hint: 'So nah bemerkt er Leyla auch hinter sich. Leer = 140' }),
        num('sense.hearing', 'Hört', { unit: '%', min: 0, hint: 'Lärm (Spiel › Kampf › Lärm) trägt so weit × diesen Anteil, durch Wände die Hälfte. 0 = taub. Leer = 100' }),
        num('sense.react', 'Reaktion', { unit: 'ms', min: 0, hint: 'Steht kurz mit „?!“, bevor er loslegt. Leer = 300' }),
        num('sense.lost', 'Verliert sie nach', { unit: 'ms', min: 0, hint: 'So lange ohne Sicht, dann sucht er an der letzten Stelle. Leer = 900' }),
        num('sense.search', 'Sucht', { unit: 'ms', min: 0, hint: 'So lange schaut er sich dort um, dann gibt er auf („…“) und patrouilliert wieder. Leer = 5000' }),
        num('sense.call', 'Ruft andere', { unit: '%', min: 0, hint: '#039 Gruppen-Alarm: sieht er Leyla (oder trifft sie ihn), ruft er seine Familie in Spiel › Kampf › Rufweite × diesen Anteil herbei, durch Wände die Hälfte. 0 = ruft nicht. Leer = 100' }),
        text('sense.shouts', 'Rufe', { hint: 'Was er dabei ruft, mit | getrennt (zufällig). Leer = „Da!“' })] },
      { title: 'Bewegung', fields: [num('move.patrol', 'Patrouille', { unit: 'px', min: 0, hint: 'Läuft so weit um seinen Platz hin und her. 0 = steht. Leer = 200' }),
        num('move.jump', 'Springt hoch bis', { unit: 'Kacheln', min: 0, hint: 'Stufen bis zu dieser Höhe nimmt er im Sprung. Leer = 1' }),
        num('move.drop', 'Springt runter bis', { unit: 'Kacheln', min: 0, hint: 'Beim Verfolgen und Suchen springt er so tief runter (Patrouille nie). Leer = 3' }),
        num('move.flyHeight', 'Flughöhe über Leyla', { unit: 'px', min: 0, hint: 'Nur Flieger. Leer = 230' })] },
      { title: 'Angriff', fields: [select('attack.kind', 'Angriff', [['', 'nach Verhalten'], ['melee', 'Hieb'], ['lunge', 'Sturmangriff'], ['shot', 'Schuss'], ['dive', 'Sturzflug'], ['drop', 'Von der Decke fallen']],
          { hint: 'Leer = Patrouille: Hieb, Stürmer/Boss: Sturmangriff, Schütze: Schuss, Lauerer: fallen (danach Sturmangriff), Flieger: Schuss mit Geschosstempo, sonst Sturzflug' }),
        num('attack.burst', 'Salve', { unit: 'Schuss', min: 1, hint: 'Nur Schuss: so viele Geschosse kurz hintereinander. Leer = 1' }),
        num('attack.windup', 'Ausholen', { unit: 'ms', min: 0, hint: 'So lange blinkt die Warnung, bevor der Angriff kommt (Zeit zum Ausweichen)' }),
        num('attack.cooldown', 'Pause danach', { unit: 'ms', min: 0 }), num('attack.range', 'Angriff ab', { unit: 'px', min: 0, hint: 'Abstand zu Leyla, ab dem angegriffen wird (Schütze: Wunschabstand)' }),
        num('attack.projectileSpeed', 'Geschosstempo', { unit: 'px/s', min: 0, hint: 'Nur Schützen: Gegnergeschosse sind langsamer als Leylas, damit man ausweichen kann' }),
        num('height', 'Größe', { unit: 'px', min: 1, hint: 'Höhe der Figur im Spiel (Leyla: 192)' }), select('placeholderColor', 'Platzhalter-Farbe', [['rust', 'Rost'], ['olive', 'Oliv'], ['violet', 'Violett'], ['steel', 'Stahl']], { hint: 'Solange es kein Aussehen gibt' }),
        select('placeholderShape', 'Platzhalter-Form', [['', 'nach Verhalten'], ['raider', 'Figur'], ['blob', 'Klumpen'], ['drone', 'Drohne']], { hint: 'Leer = Lauerer Klumpen, Flieger Drohne, sonst Figur' })] },
      { title: 'Konter', fields: [bool('counter.shield', 'Schild vorn', { hint: 'Schüsse und leichte Hiebe von vorn prallen ab („Block“), ein schwerer Hieb, der Kombo-Abschluss oder der aufgesetzte Schuss öffnen die Deckung. Von hinten trifft alles' }),
        num('counter.shieldTurn', 'Dreht sich langsam', { unit: 'ms', min: 0, hint: 'Mit Schild: so lange braucht er zum Umdrehen (Zeit, um hinter ihn zu kommen). Leer = 650' }),
        num('counter.shieldStagger', 'Deckung offen', { unit: 'ms', min: 0, hint: 'So lange nach einem schweren Treffer. Leer = 900' }),
        num('counter.dodge', 'Weicht aus', { unit: '%', min: 0, max: 100, hint: 'Chance je anfliegendem Nagel und je Hieb von Leyla, dass er weghüpft' }),
        num('counter.dodgeCooldown', 'Ausweichen alle', { unit: 'ms', min: 0, hint: 'Leer = 1400' }), num('counter.dodgeDistance', 'Ausweichen weit', { unit: 'px', min: 0, hint: 'Leer = 200' }),
        num('counter.armor', 'Panzerung', { unit: 'Platten', min: 0, hint: 'Jeder schwere Treffer bricht eine Platte; solange eine hält, machen leichte Treffer nur „Leichte Treffer“ Schaden' }),
        num('counter.armorChip', 'Leichte Treffer', { unit: '%', min: 0, max: 100, hint: 'Anteil Schaden durch die Panzerung. Leer = 15' }),
        num('counter.duck', 'Duckt sich', { unit: '%', min: 0, max: 100, hint: 'Daniel, 12.11.2026 (#004): „alle Gegner, die Humanoide sind, sollen sich ducken können“. Chance je anfliegendem Nagel auf Brusthöhe; geduckt fliegt er drüber. Leer = 0' }),
        num('counter.duckTime', 'Geduckt', { unit: 'ms', min: 0, hint: 'So lange bleibt er unten. Leer = 700' }),
        num('counter.duckEvery', 'Ducken alle', { unit: 'ms', min: 0, hint: 'Leer = 1200' }),
        num('counter.cover', 'Sucht Deckung', { unit: '%', min: 0, max: 100, hint: 'Daniel, 13.11.2026 (#014): Raider suchen Deckung hinter Kisten. Chance, im Kampf hinter eine nahe Kiste zu laufen; dort duckt er sich und taucht nur zum Schießen auf. Kisten halten Schüsse auf' }),
        num('counter.coverRange', 'Deckung bis', { unit: 'px', min: 0, hint: 'So weit läuft er höchstens zu einer Kiste. Leer = 420' }),
        num('counter.coverTime', 'Bleibt unten', { unit: 'ms', min: 0, hint: 'So lange zwischen zwei Schüssen geduckt. Leer = 1400' })] },
      { title: 'Boss', when: x => x.behavior === 'boss', fields: [table('boss.phases', 'Phasen', [num('at', 'ab Leben', { unit: '%', min: 0, max: 100 }), text('say', 'Ruft'), num('speed', 'schneller', { unit: '%' }), num('windup', 'kürzer ausholen', { unit: '%', min: 0, max: 90 }), num('adds', 'Verstärkung', { min: 0 }), bool('wave', 'Bodenwelle')],
          { hint: '#016: fällt sein Leben unter „ab Leben“, brüllt er, wird schneller, holt kürzer aus, ruft Verstärkung (schwächere Gegner des POIs, in Gang-Farbe) und schlägt ab dann nach jedem Hieb eine Bodenwelle in beide Richtungen, über die Leyla springen muss' }),
        num('boss.waveSpeed', 'Bodenwelle Tempo', { unit: 'px/s', min: 0, hint: 'Leer = 620' }), num('boss.waveDamage', 'Bodenwelle Schaden', { unit: '%', min: 0, hint: 'Anteil seines Schadens. Leer = 60' })] },
      // #139 Bausteine (docs/concepts/enemy_kit.md › 2): each picked trait shows its own section below (game/play/traits/<id>.js)
      { title: 'Bausteine', fields: [multi('traits', 'Bausteine', TRAIT_OPTIONS, { hint: '#139: Verhalten aus Bausteinen, zusätzlich zum Verhalten oben. Jeder Baustein bringt unten seinen eigenen Abschnitt mit' })] },
      { title: 'Scharfschütze', when: x => (x.traits || []).includes('sniper'), fields: [num('sniper.lock', 'Aufschalten', { unit: 'ms', min: 0, hint: 'So lange muss der Laser auf Leyla liegen, dann fällt der Schuss. Leer = 1400' }),
        num('sniper.track', 'Laser folgt mit', { unit: '°/s', min: 1, hint: 'Wie schnell der Laser ihr nachschwenkt (die Verzögerung). Leer = 90' }),
        num('sniper.damage', 'Schuss-Schaden', { unit: '%', min: 0, hint: 'Anteil seines Schadens für den einen harten Schuss. Leer = 250' }),
        num('sniper.speed', 'Geschosstempo', { unit: 'px/s', min: 1, hint: 'Leer = 2600' }), color('sniper.color', 'Laserfarbe'),
        bool('sniper.breakOnHit', 'Treffer bricht das Aufschalten', { hint: 'Leer = an. Deckung (Wand, Kiste) dazwischen bricht es immer' })] },
      { title: 'Werfer', when: x => (x.traits || []).includes('grenadier'), fields: [select('throw.item', 'Wirft', THROW_ITEMS, { hint: 'Granate prallt ab und platzt nach der Zündzeit; Molotow und Säure zerspringen und lassen eine Fläche zurück' }),
        num('throw.fuse', 'Zündzeit', { unit: 'ms', min: 0, hint: 'Granate: ab dem ersten Aufkommen. Leer = 900' }), num('throw.radius', 'Radius', { unit: 'px', min: 10, hint: 'Wände und Kisten halten die Explosion auf. Leer = 140' }),
        num('throw.damage', 'Schaden', { unit: '%', min: 0, hint: 'Anteil seines Schadens in der Mitte (am Rand die Hälfte). Leer = 100' }),
        num('throw.count', 'Je Wurf', { min: 1, hint: 'So viele auf einmal, nebeneinander. Leer = 1' }), num('throw.burn', 'Brennt', { unit: 's', min: 0, hint: 'Molotow und Säure: so lange bleibt die Fläche. Leer = 3' })] },
      { title: 'Sanitäter', when: x => (x.traits || []).includes('medic'), fields: [num('medic.heal', 'Heilt', { unit: 'LP/s', min: 0, hint: 'Verbündete in Reichweite. Leer = 2' }), num('medic.range', 'Reichweite', { unit: 'px', min: 0, hint: 'Leer = 420' }),
        num('medic.reviveTime', 'Zurückholen dauert', { unit: 'ms', min: 0, hint: 'So lange kniet er am Gefallenen; ein Treffer bricht es ab. Leer = 2200' }),
        num('medic.reviveHp', 'Steht auf mit', { unit: '%', min: 1, max: 100, hint: 'Leer = 40' }),
        num('medic.bodyTime', 'Gefallene liegen', { unit: 's', min: 0, hint: 'So lange kann er sie holen; der Kill zählt erst danach. Leer = 8' }),
        num('medic.max', 'Holt höchstens', { min: 0, hint: 'So oft je Sanitäter. Leer = 2' })] },
      { title: 'Alarmgeber', when: x => (x.traits || []).includes('alarm'), fields: [num('alarm.time', 'Auslösen dauert', { unit: 'ms', min: 0, hint: 'So lange kurbelt er an der Sirene (Raum-Zeichen !), ohne Sirene bläst er ins Horn. Leer = 2500' }),
        num('alarm.adds', 'Verstärkung', { min: 0, hint: 'So viele Gegner kommen dazu. Leer = 2' }),
        ref('alarm.addEnemy', 'Verstärkung durch', 'enemies', { hint: 'Leer = die schwächsten Bausatz-Gegner des POIs' }),
        num('alarm.radius', 'Reichweite', { unit: 'px', min: 0, hint: '0 = der ganze POI. Leer = 0' }), bool('alarm.flee', 'Rennt danach weg', { hint: 'Nach dem Alarm flieht er (mit Baustein Feigling: wie ein Feigling)' })] },
      { title: 'Feigling', when: x => (x.traits || []).includes('coward'), fields: [num('flee.at', 'Flieht ab', { unit: '% Leben', min: 0, max: 100, hint: 'Leer = 35. Nach einem Alarm mit „Rennt danach weg“ sofort' }),
        num('flee.drop', 'Lässt Beute fallen', { unit: '%', min: 0, max: 100, hint: 'Chance, dass er beim Losrennen seine Beute fallen lässt. Leer = 50' })] },
      { title: 'Ergibt sich', when: x => (x.traits || []).includes('surrender'), fields: [num('surrender.at', 'Ergibt sich ab', { unit: '% Leben', min: 1, max: 100, hint: 'Einmal gewürfelt, wenn sein Leben darunter fällt. Leer = 30' }),
        num('surrender.chance', 'Chance', { unit: '%', min: 0, max: 100, hint: 'Leer = 50. Dann wirft er die Waffe weg und kniet; E: gefangen nehmen, laufen lassen, erledigen' }),
        num('surrender.repFree', 'Ruf fürs Laufenlassen', { min: 0, hint: 'Bei der Gang des POIs. Leer = 3' }), num('surrender.repKill', 'Ruf fürs Erledigen', { min: 0, hint: 'Abzug bei der Gang, zusätzlich zum Kill. Leer = 5' })] },
      { title: 'Beute', fields: [ref('loot', 'Beutetabelle', 'lootTables'), range('deltas', 'Deltas', { unit: 'Δ' }), bool('countsForRanking', 'Zählt für Kills %'),
        num('dropWeapon', 'Lässt seine Waffe fallen', { unit: '%', min: 0, max: 100, hint: '#004: Chance, dass seine Waffe (Werte › Waffe) mit der Beute liegt, damit Leyla sie benutzen kann. Leer = 0' })] },
    ],
    check: (x, report, p) => {
      const K = x.kit && p.data?.kits?.[x.kit];
      if (!K) return;
      if (x.kitHead && !(K.heads || []).some(h => h.id === x.kitHead)) report('error', `Kopf ${x.kitHead} gibt es im Bausatz nicht`);
      if (x.kitSkin && !(K.skins || []).some(h => h.name === x.kitSkin)) report('error', `Hautton ${x.kitSkin} gibt es im Bausatz nicht`);
      if (x.kitGang && !(K.gangs || []).some(h => h.name === x.kitGang)) report('error', `Gang-Farbe ${x.kitGang} gibt es im Bausatz nicht`);
    },
  },
  kits: {
    name: 'Gegner-Bausätze', singular: 'Bausatz', icon: 'person', file: 'data/kits.json', kind: 'catalog',
    hint: 'Daniel, 12.11.2026 (#004): ein gemalter Körper mit Animationen je Waffenklasse; Köpfe, Waffen und Farben sind austauschbar, ohne neue Animationen. Die Animationen tragen einen grünen Platzhalter statt der Waffe (tools/raider_strips.py), das Spiel setzt die echte Waffe je Frame an Griff und Winkel.',
    template: { name: 'Neuer Bausatz', cm: 180, height: 180, poses: [], heads: [], swaps: [], skins: [], gangs: [] },
    row: x => `${(x.poses || []).length} Animationen · ${(x.heads || []).length} Köpfe · ${(x.skins || []).length} Hauttöne`,
    sections: [
      { title: 'Bausatz', fields: [NAME, DESCRIPTION, num('cm', 'Körpergröße', { unit: 'cm', min: 50, hint: 'Maßstab für die Waffen (Waffen › In der Hand › Länge)' }),
        num('figure', 'Figur im Frame', { unit: 'px', min: 1, hint: 'So hoch ist die Figur in den Animationen gemalt (Scheitel bis Sohle)' }),
        num('height', 'Höhe im Spiel', { unit: 'px', min: 1, hint: 'Standard, wenn der Gegner keine Größe hat (Leyla: 192)' }),
        point('headPivot', 'Kopf-Drehpunkt', { unit: 'px', hint: 'Mitte des Kopfs in der Grundpose (Pixel im Frame); darum dreht sich ein Kopf-Aufleger, wenn der Körper umfällt' }),
        num('windupFrame', 'Ausholen bis Frame', { min: 0, hint: 'Nahkampf: während der Warnung laufen die Frames bis hier (0 = erster), beim Hieb der Rest. Leer = 3' })] },
      { title: 'Animationen', fields: [table('poses', 'Animationen', [select('class', 'Klasse', [...HELD_CLASSES, ['any', 'alle Klassen']]), select('state', 'Zustand', KIT_STATES), ref('look', 'Animation', 'assets')],
        { hint: 'Je Waffenklasse: Alarm (Stehen im Kampf), Gehen, Rennen, Ducken (letzter Frame hält), Angriff (Hieb bzw. Schuss)' })] },
      { title: 'Köpfe', fields: [table('heads', 'Köpfe', [text('id', 'ID'), text('name', 'Name'), ref('look', 'Bild', 'assets'), point('at', 'Sitzt bei', { unit: 'px' })],
        { hint: 'Ein Kopf ist ein Bild, das in der Grundpose genau auf dem Kopf liegt (oben links bei „Sitzt bei“, Pixel im Frame); in jedem Frame wandert es mit dem gemessenen Kopf. Ohne Bild = der gemalte Kopf' })] },
      { title: 'Farbtausch', fields: [table('swaps', 'Farbgruppen', [select('group', 'Gruppe', [['skin', 'Haut'], ['gang', 'Gang-Farbe']]), num('hueFrom', 'Farbton von', { unit: '°' }), num('hueTo', 'bis', { unit: '°' }),
          num('satMin', 'Sättigung ab', { unit: '%' }), num('lightMin', 'Helligkeit ab', { unit: '%' }), num('lightMax', 'bis', { unit: '%' }), num('sat', 'Sättigung Mitte', { unit: '0–1' }), num('mid', 'Helligkeit Mitte', { unit: '%' })],
          { hint: 'Welche gemalten Pixel zu Haut bzw. Gang-Farbe gehören. Sie bekommen Farbton und Sättigung der Wunschfarbe; die Helligkeit behält ihren Abstand zur Mitte (Schatten bleiben)' }),
        table('skins', 'Hauttöne', [text('name', 'Name'), color('color', 'Farbe')], { hint: 'Leer = wie gemalt' }),
        table('gangs', 'Gang-Farben', [text('name', 'Name'), color('color', 'Farbe')], { hint: 'Neon-Besatz der Kleidung; leer = wie gemalt (Magenta)' })] },
      { title: 'Waffe in der Hand', fields: [table('offsets', 'Griff-Versatz', [select('class', 'Klasse', HELD_CLASSES), point('offset', 'Versatz', { unit: 'px' })],
        { hint: 'Verschiebt die Waffe je Klasse in allen Frames (Pixel im Frame, nach rechts schauend). Für Animationen, in denen der Platzhalter von der Hand weggerutscht ist' })] },
    ],
    check: (x, report, p) => {
      const A = p.data?.assets || {};
      for (const r of x.poses || []) if (r.look && A[r.look]?.kind !== 'animation') report('error', `${r.class}/${r.state}: keine Animation`);
      for (const c of ['light', 'heavy', 'pistol', 'long']) if ((x.poses || []).some(r => r.class === c) && !(x.poses || []).some(r => r.class === c && r.state === 'alert')) report('warning', `Klasse ${c} ohne Alarm-Pose`);
    },
  },
  buffs: {
    name: 'Buffs', singular: 'Buff', icon: 'flash', file: 'data/buffs.json', kind: 'catalog',
    hint: 'Wirkungen von Gerichten, Companions und Werkstätten. Ein Buff ändert einen Wert für eine bestimmte Dauer.',
    template: { name: 'Neuer Buff', stat: 'health', value: 10, percent: false, duration: 'run' },
    row: x => `${label(BUFF_STATS, x.stat)} ${x.value >= 0 ? '+' : ''}${x.value ?? 0}${x.percent ? ' %' : ''} · ${label(BUFF_DURATIONS, x.duration)}`,
    sections: [{ title: 'Buff', fields: [NAME, select('stat', 'Wert', BUFF_STATS), num('value', 'Änderung'), bool('percent', 'in Prozent'),
      select('duration', 'Dauer', BUFF_DURATIONS), num('seconds', 'Sekunden', { min: 0, hint: 'Nur bei Dauer „Sekunden“' }), DESCRIPTION] }],
  },

  resources: {
    name: 'Ressourcen', singular: 'Ressource', icon: 'points', file: 'data/resources.json', kind: 'catalog',
    hint: 'Upgrade-Ressourcen für den Techtree (design.md › Progression): Technik, Wissen, Bio … Jede ist ein Gegenstand in der Welt (Kategorie Fortschritt), bezahlt wird aus Lager, Kiste und Rucksack. Versteckte Ressourcen (z. B. „Dunkelheit“) sind unter der Haube vorgesehen und erscheinen nicht als Tab.',
    template: { name: 'Neue Ressource', color: '#20d6c7', order: 9 },
    row: x => `${x.item ? '' : 'ohne Gegenstand · '}${x.hidden ? 'versteckt' : 'Tab ' + (x.order ?? 0)}`,
    sections: [{ title: 'Ressource', fields: [NAME, ref('item', 'Gegenstand', 'items', { hint: 'Das Ding in der Welt, das man im Techtree ausgibt' }), color('color', 'Farbe'),
      num('order', 'Reihenfolge der Tabs'), bool('hidden', 'Versteckt', { hint: 'Kein Tab, nicht im Spiel sichtbar (vorgesehen: Dunkelheit)' }),
      num('darkness', 'Mehr je Stufe', { unit: '%', hint: 'Nur „Dunkelheit“: so viel mehr der anderen Ressourcen je Stufe (noch ohne Wirkung)' }),
      text('source', 'Woher', { hint: 'Kurz, wo man sie bekommt; steht in der Zielzeile (#016), z. B. „Zerlegen an der Werkbank“' }), DESCRIPTION] }],
  },

  techtree: {
    name: 'Techtree', singular: 'Knoten', icon: 'tree', file: 'data/techtree.json', kind: 'catalog', groupBy: { key: 'tab', area: 'resources' },
    hint: 'Knoten im Warroom (design.md › Progression): kosten Ressourcen, bleiben über alle Durchgänge, schalten Rezepte und Boni frei. Position = Spalte und Zeile im Baum (horizontal, Spalte 0 links); Linien kommen aus „Braucht“.',
    template: { name: 'Neuer Knoten', pos: [0, 0], cost: [], requires: [] },
    row: x => `${(x.cost || []).map(c => `${c.count}× ${c.resource}`).join(' + ') || 'gratis'} · Spalte ${x.pos?.[0] ?? 0}`,
    sections: [
      { title: 'Knoten', fields: [NAME, LOOK, ICON, ref('tab', 'Tab', 'resources', { required: true, hint: 'Unter welcher Ressource der Knoten steht' }), point('pos', 'Position', { unit: 'Spalte, Zeile' }), DESCRIPTION] },
      { title: 'Kosten & Voraussetzungen', fields: [table('cost', 'Kosten', [ref('resource', 'Ressource', 'resources'), num('count', 'Menge', { min: 1 })]),
        refs('requires', 'Braucht', 'techtree', { hint: 'Erst wenn diese Knoten freigeschaltet sind' })] },
      { title: 'Schaltet frei', fields: [refs('recipes', 'Rezepte', 'recipes', { hint: 'Am besten mit Entdecken „Knoten im Techtree“' }),
        table('bonus', 'Boni', [select('stat', 'Wert', TECH_BONUS), num('value', 'Änderung')], { hint: 'Passive Boni, gelten sofort und in jedem Durchgang. Prozent: −15 = 15 % weniger' }),
        refs('workshops', 'Werkstätten', 'workshops', { hint: '#110: erst kaufbar, wenn dieser Knoten freigeschaltet ist (was schon im Rig steht, bleibt)' }),
        refs('rigParts', 'Rig-Teile', 'rigParts', { hint: '#110: erst kaufbar mit diesem Knoten' }),
        text('flags', 'Merker', { hint: '#110: Welt-Merker beim Freischalten (Komma), z. B. für Zwischenfälle, Quests, Orte (Bedingungs-Sprache)' }),
        ref('reveal', 'Ort aufdecken', 'locations', { hint: '#110: ein Ort kommt auf die Reisekarte' }),
        bool('soon', 'Wirkung folgt', { hint: '#110: die eigentliche Wirkung ist noch nicht gebaut; im Warroom steht „Wirkung folgt“' })] },
    ],
    check: (x, report, p) => {
      const T = p.data.techtree || {};
      for (const r of x.requires || []) if (r === x.id) report('error', 'Knoten braucht sich selbst');
      const seen = new Set(), walk = id => { if (seen.has(id)) return id === x.id; seen.add(id); return (T[id]?.requires || []).some(walk); };
      if ((x.requires || []).some(walk)) report('error', 'Voraussetzungen drehen sich im Kreis');
      for (const c of x.cost || []) if (p.data.resources?.[c.resource] && !p.data.resources[c.resource].item && !p.data.resources[c.resource].hidden) report('warning', `Ressource „${c.resource}“ hat keinen Gegenstand`);
    },
  },

  items: {
    name: 'Gegenstände', singular: 'Gegenstand', icon: 'item', file: 'data/items.json', kind: 'catalog', groupBy: { key: 'category', options: ITEM_CATEGORIES },
    hint: 'Alles, was in den Rucksack passt: Schrott, Ressourcen, Zutaten, Gerichte, Bauteile. Viel Junk, viele Kombinationen.',
    template: { name: 'Neuer Gegenstand', category: 'junk', size: [1, 1], stack: 1, value: 1 },
    row: x => `${label(ITEM_CATEGORIES, x.category)} · ${(x.size || [1, 1]).join('×')} · ${x.value ?? 0} Δ`,
    sections: [
      { title: 'Gegenstand', fields: [NAME, LOOK, ICON, select('category', 'Kategorie', ITEM_CATEGORIES), multi('tags', 'Tags', ITEM_TAGS, { hint: 'Trophäe = darf an einen Trophäen-Ständer in der Schatzkammer' }), DESCRIPTION] },
      { title: 'Rucksack & Handel', fields: [size('size', 'Größe', { unit: 'Felder', hint: 'Rechteck im Raster (Daniel, 14.11.2026: nur noch Rechtecke, keine Tetris-Formen). Im Spiel mit Rechtsklick drehbar' }),
        num('stack', 'Stapel', { min: 1 }), text('glyph', 'Kürzel', { hint: 'Platzhalter im Inventar, solange es kein Aussehen gibt: 1–3 Zeichen oder ein Emoji' }), VALUE,
        ref('brand', 'Hersteller', 'brands', { hint: '#045: Marke aus der Lore-Datenbank. Ihre Spielwerte wirken: Qualität auf die Boni (Implantate), Preis auf den Wert, „In der Beute“ auf die Häufigkeit' })] },
      { title: 'Wirkung', fields: [ref('buff', 'Buff beim Essen/Benutzen', 'buffs'), ref('teaches', 'Bringt Rezept bei', 'recipes', { hint: 'Für Baupläne und Kochbücher' })] },
      { title: 'Ausrüstung', fields: [select('wear', 'Trägt man als', [['', '—'], ...WEAR_SLOTS], { hint: 'Kopf und Rüstung an Leyla, Implantate in ihrem Körper (nur im Camp einbauen), Teile an AvA' }),
        select('tier', 'Stufe', [['', '—'], [1, 'Einfach'], [2, 'Gut'], [3, 'Perk + Flaw']], { hint: 'Cyberware (#006): Stufe 3 = sehr großer Vorteil mit Nachteil (negativer Wert), wie Traits in Fallout. Rahmen im Inventar: grau, cyan, gold' }),
        num('stats.defense', 'Abwehr', { unit: '%', hint: 'Weniger Schaden, zählt mit Buffs zusammen (höchstens 90 %). Negative Werte sind Nachteile (rot im Tooltip)' }), num('stats.health', 'Leben', { unit: 'LP' }), num('stats.damage', 'Schaden', { unit: '%' }), num('stats.speed', 'Tempo', { unit: '%' }),
        num('stats.melee', 'Nahkampf', { unit: '%', hint: 'Nur Nahkampf-Schaden, zusätzlich zu Schaden' }), num('stats.ranged', 'Fernkampf', { unit: '%', hint: 'Nur Fernkampf-Schaden, zusätzlich zu Schaden' }),
        num('stats.crit', 'Krit-Chance', { unit: '%', hint: 'Kommt zur Krit-Chance der Waffe dazu (Krit = doppelter Schaden)' }), num('stats.jump', 'Sprungkraft', { unit: '%' }),
        num('stats.dashCooldown', 'Dash-Abklingzeit', { unit: '%', hint: 'Negativ = schneller wieder bereit' }), num('stats.hack', 'Duell-Integrität', { hint: '#065: so viel mehr Integrität im Glitch-Duell im Spiel (Augen- und Nerven-Implantate); negativ = Nachteil' }),
        num('stats.airJumps', 'Sprünge in der Luft', { hint: 'Doppelsprung: 1 = einer in der Luft. Mit Leyla › Fähigkeiten › nur mit Implantat kommt er nur von hier' }),
        num('stats.airDash', 'Luft-Dash', { min: 0, max: 1, hint: '1 = Leyla darf in der Luft dashen (mit Leyla › Fähigkeiten › nur mit Implantat). Am Boden geht der Dash immer' }),
        num('stats.regen', 'Heilt sich', { unit: 'LP/10 s', step: 0.5, hint: 'Negativ = Leben sickert (nie unter 1 LP)' }), num('stats.heal', 'Heilung', { unit: '%', hint: 'Wirkung von Medikits und Heil-Essen' }),
        num('stats.stamina', 'Ausdauer', { hint: '#020: mehr Ausdauer (Leyla › Ausdauer)' }), num('stats.staminaRegen', 'Erholung', { unit: '%', hint: '#020: Ausdauer kommt schneller zurück' }),
        num('stats.droneBattery', 'AvA-Akku', { unit: '%' }), num('stats.tankDecay', 'Tank-Verfall', { unit: '%', hint: 'Positiv = der Cryo-Tank verfällt schneller (ein Nachteil)' }),
        num('strain', 'Belastung', { min: 0, hint: 'Nur Implantate: zusammen höchstens Leyla › Inventar › Belastung höchstens' }),
        ref('partLook', 'An der Drohne', 'assets', { hint: 'Nur Drohnenteile: Bild an AvA (Drohne › Anbauteile, Spalte Gegenstand)' }),
        num('battery', 'AvA: mehr Akku', { unit: '%', hint: 'Nur Drohnenteile (Daniel, 12.11.2026: „bessere Teile machen die Drohne stärker“): so viel länger trägt sie Leyla, zählt über alle Teile zusammen' })] },
      { title: 'Zerlegen', fields: SALVAGE_FIELDS },
    ],
    check: (x, report, p, id) => {
      iconCheck(x, report, p);
      for (const m of salvageProblems(p, id)) report(m.kind, m.text);
      if (x.wear && !['armor', 'implant', 'dronepart'].includes(x.category)) report('hint', 'Trägt man, ist aber keine Rüstung, kein Implantat und kein Drohnenteil');
      if (['armor', 'implant', 'dronepart'].includes(x.category) && !x.wear) report('warning', 'Ausrüstung ohne „Trägt man als“');
      if (x.shape) report('hint', 'Feld „Form“ wird nicht mehr benutzt (nur noch Rechtecke aus „Größe“)');
      if (x.category === 'blueprint' && !x.teaches) report('warning', 'Bauplan ohne Rezept'); if (x.category === 'food' && !x.buff) report('hint', 'Gericht ohne Buff'); },
  },
  lootTables: {
    name: 'Beutetabellen', singular: 'Beutetabelle', icon: 'chest', file: 'data/loot.json', kind: 'catalog',
    hint: 'Was in Kisten, bei Gegnern und in Encountern liegt. Pro Wurf wird ein Eintrag nach Gewicht gezogen.',
    template: { name: 'Neue Beutetabelle', rolls: [1, 2], entries: [] },
    row: x => `${(x.entries || []).length} Einträge · ${(x.rolls || []).join('–')} Würfe`,
    sections: [{ title: 'Beutetabelle', fields: [NAME, range('rolls', 'Würfe'),
      table('entries', 'Einträge', [ref('item', 'Gegenstand', 'items'), ref('weapon', 'oder Waffe', 'weapons'), num('weight', 'Gewicht', { min: 0 }), num('min', 'min', { min: 1 }), num('max', 'max', { min: 1 })]), DESCRIPTION] }],
    check: (x, report) => { if (!(x.entries || []).length) report('warning', 'Beutetabelle ist leer'); },
  },
  recipes: {
    name: 'Rezepte', singular: 'Rezept', icon: 'workbench', file: 'data/recipes.json', kind: 'catalog',
    hint: 'Crafting und Kochen: aus x A, y B (und z C) wird D. Manche Rezepte sind logisch, manche sonderbar.',
    template: { name: 'Neues Rezept', station: '', ingredients: [], result: '', count: 1, time: 10, discovery: ['experiment'] },
    row: (x, p) => `${(x.ingredients || []).map(i => `${i.count}× ${p?.data.items?.[i.item]?.name || i.item}`).join(' + ') || '–'} → ${x.part ? p?.data.rigParts?.[x.part]?.name || x.part : p?.data.items?.[x.result]?.name || x.result || '?'}`,
    sections: [
      { title: 'Rezept', fields: [NAME, ref('station', 'Werkstatt', 'workshops', { required: true }), num('time', 'Dauer', { unit: 'min', min: 0, hint: 'Spielzeit: die Uhr springt beim Kochen/Herstellen um so viele Minuten weiter (Ereignis-Zeit)' })] },
      { title: 'Zutaten → Ergebnis', fields: [table('ingredients', 'Zutaten', [ref('item', 'Gegenstand', 'items'), num('count', 'Anzahl', { min: 1 })]),
        ref('result', 'Ergebnis', 'items'), ref('part', 'Oder Rig-Teil', 'rigParts', { hint: 'Statt eines Gegenstands entsteht ein Rig-Teil: es landet auf dem Schrottplatz und wird im Bau-Modus (B) an den Van gezogen' }), num('count', 'Anzahl', { min: 1 }),
        ref('weapon', 'Oder Waffe', 'weapons', { hint: '#013 (Daniel, 3c): ein Bauplan für eine Waffe. Mit Plätzen setzt Leyla an der Werkbank Waffenteile ein; jede gebaute Waffe ist ein Exemplar mit eigenen Werten' }),
        table('slots', 'Plätze (Bauplan)', [select('slot', 'Platz', PART_SLOTS_SCHEMA), bool('required', 'Muss')], { hint: 'Leer = keine Teile, nur der Handgriff am Ende' }),
        num('tank', 'Oder Tank-Wartung', { unit: '%', min: 0, max: 100, hint: 'Statt eines Ergebnisses: so viel Zustand bekommt der Cryo-Tank zurück (Werkstatt-Art Cryo-Tank)' }), num('tankUpTo', 'Hilft bis Phase', { min: 1, max: 6, hint: 'Ist der Tank schlechter als diese Phase, hilft die Wartung nicht mehr (ein Leck klebt man nicht). Leer = immer' })] },
      { title: 'Entdecken', fields: [multi('discovery', 'Wie man es lernt', DISCOVERY), area_('hint', 'Hinweis', { hint: 'Was Companions oder Notizzettel andeuten' }),
        bool('once', 'Einmalig', { hint: 'Lässt sich nur ein einziges Mal herstellen (Trophäen der Achievements); danach steht es im Rezeptbuch als „hergestellt“' })] },
    ],
    check: (x, report, p) => {
      if (!(x.ingredients || []).length) report('error', 'Rezept ohne Zutaten');
      // #125 (Backlog C13): Herstellen gibt eine Ressource nebenbei; gibt Zerlegen des Ergebnisses alle Zutaten zurück, wird daraus eine Endlos-Quelle
      const made = x.weapon ? p?.data.weapons?.[x.weapon] : x.result ? p?.data.items?.[x.result] : null, back = {};
      for (const g of made?.salvage || []) if (g?.item) back[g.item] = (back[g.item] || 0) + (Number(g.count) || 1) * (x.weapon ? 1 : x.count || 1);
      if (made?.salvage?.length && (x.ingredients || []).length && x.ingredients.every(i => (back[i.item] || 0) >= (i.count || 1))) report('warning', 'Herstellen und wieder Zerlegen gibt alle Zutaten zurück: endlos Ressourcen nebenbei');
      if (!x.result && !x.part && !x.tank && !x.weapon) report('warning', 'Rezept ohne Ergebnis (Gegenstand, Waffe, Rig-Teil oder Tank-Wartung)');
      if (x.result && x.part) report('warning', 'Gegenstand und Rig-Teil: das Rig-Teil gewinnt');
      if ((x.ingredients || []).some(i => i.item === x.result)) report('warning', 'Ergebnis ist auch Zutat');
      const kinds = (x.ingredients || []).map(i => i.item); if (new Set(kinds).size !== kinds.length) report('warning', 'Eine Zutat steht doppelt in der Liste (Anzahl erhöhen)');
    },
  },
  quests: {
    name: 'Aufträge', singular: 'Auftrag', icon: 'list', file: 'data/quests.json', kind: 'catalog', groupBy: { key: 'giver' },
    hint: 'Nebenaufträge im Questlog (#016, Daniel 14.11.2026: „Wir brauchen eine Art Questlog!“). Ein Auftrag zählt ab dem Annehmen einen Zähler hoch (wie Achievements) oder will Dinge abgegeben haben. Die Hauptquest (Heilmittel) und AvAs Tank kommen aus Techtree und Cryo-Tank. Geöffnet am Warroom und am Lagerfeuer.',
    template: { name: 'Neuer Auftrag', counter: 'kills', target: 5, reward: { deltas: 50 } },
    row: (x, p) => `${x.gang || p?.data.companions?.[x.giver]?.name || 'ohne Auftraggeber'} · ${x.counter ? `${x.target || 1}× ${ACHIEVEMENT_COUNTERS.find(c => c[0] === x.counter)?.[1]?.replace(/ \(.*$/, '') || x.counter}${x.filter ? ' · ' + x.filter : ''}` : x.pieces?.length ? `${x.pieces.length} Stücke abgeben` : `${x.count || 1}× ${p?.data.items?.[x.item]?.name || x.item || '?'} abgeben`}${x.needsFlag ? ` · nach Merker ${x.needsFlag}` : ''}`,
    sections: [
      { title: 'Auftrag', fields: [NAME, ref('giver', 'Auftraggeber', 'companions'), text('gang', 'Gang', { hint: '#088 Gangs als Auftraggeber: statt einer Begleiterin vergibt eine Gang den Auftrag (Name wie POI › Gang). Annehmen und Abgeben nur in ihrem Revier, beim Reden mit einem von ihnen' }),
        select('minRep', 'Ab Ruf', [['', 'Geduldet (Standard)'], ...REP_LEVELS.filter(([k]) => k === 'freund')], { hint: '#088: erst ab diesem Ruf bei der Gang im Angebot. Unter Geduldet gibt es keinen Frieden, also kein Gespräch' }), area_('text', 'Text', { hint: 'Was der Auftraggeber sagt' }), area_('done', 'Beim Abgeben', { hint: 'Sein Satz, wenn Leyla den Auftrag abgibt' }),
        ref('after', 'Nach Auftrag', 'quests', { hint: 'Erst im Angebot, wenn dieser Auftrag erledigt ist' }), num('minDay', 'Ab Tag', { min: 1 })] },
      { title: 'Ziel', fields: [select('counter', 'Zähler', [['', '– Dinge abgeben –'], ...ACHIEVEMENT_COUNTERS], { hint: 'Was das Spiel zählt (ab dem Annehmen). Leer = Dinge abgeben' }), text('filter', 'Filter', { hint: 'Wie bei Achievements: Gegner, Familie, POI, Rang, Rezept …' }), num('target', 'Ziel', { min: 1 }),
        ref('item', 'Abgeben: Ding', 'items'), num('count', 'Abgeben: Anzahl', { min: 1 }),
        refs('pieces', 'Abgeben: alle diese', 'items', { hint: '#057 Schatzsuche: je eins von jedem (z. B. fünf Kartenstücke); statt „Abgeben: Ding“' }),
        text('needsFlag', 'Erst mit Merker', { hint: '#062: erst im Angebot, wenn alle diese Merker gesetzt sind (Komma), z. B. aus einer Straßen-Geschichte (Ereignis-Baukasten › Antworten › Merker)' }),
        text('notFlag', 'Nicht mit Merker', { hint: 'nicht mehr im Angebot, sobald einer dieser Merker gesetzt ist' }),
        ...CREW_NEEDS(),
        bool('whenHas', 'Erst wenn eins davon da ist', { hint: '#057: im Angebot erst, wenn Leyla eines der Stücke hat (sie spricht den Auftraggeber darauf an)' }),
        text('flag', 'Merker beim Annehmen', { hint: '#057: setzt einen Merker für den Ereignis-Baukasten (z. B. Händler, die Stücke verkaufen, tauchen erst dann auf)' })] },
      { title: 'Belohnung', fields: [ref('reward.reveal', 'Ort aufdecken', 'locations', { hint: '#057: ein versteckter Ort kommt auf die Reisekarte' }), num('reward.rep', 'Ruf bei der Gang', { min: 0, max: 100, hint: '#088: nur bei Aufträgen mit Gang' }), num('reward.deltas', 'Deltas', { unit: 'Δ', min: 0 }), table('reward.items', 'Dinge', [ref('item', 'Ding', 'items'), num('count', 'Anzahl', { min: 1 })], { hint: 'Kommen in die Kiste im Camp, ist sie voll, in den Rucksack' })] },
    ],
    check: (x, report, p) => { if (!x.counter && !x.item && !(x.pieces || []).length) report('warning', 'Weder Zähler noch Ding zum Abgeben');
      if (x.gang && !Object.values(p?.data?.pois || {}).some(o => o.gang?.name === x.gang)) report('error', `Gang „${x.gang}“ hat kein Revier (kein POI mit dieser Gang)`);
      if (x.gang && x.giver) report('warning', 'Gang und Auftraggeber zugleich: die Gang vergibt ihn');
      if (x.reward?.rep && !x.gang) report('warning', 'Ruf als Belohnung braucht eine Gang'); if (!x.reward?.deltas && !(x.reward?.items || []).length && !x.reward?.reveal && !x.reward?.rep) report('hint', 'Keine Belohnung'); },
  },

  achievements: {
    name: 'Achievements', singular: 'Achievement', icon: 'trophy', file: 'data/achievements.json', kind: 'catalog', groupBy: { key: 'category', options: ACHIEVEMENT_CATEGORIES },
    hint: 'Achievements & Trophäen (#012, design.md): erreicht → Meldung „🏆 Name“ → das Rezept der Trophäe ist gelernt → an der Werkstatt einmal herstellen → auf einen Trophäen-Ständer in einer Schatzkammer stellen → der Bonus wirkt, solange sie irgendwo im Rig ausgestellt ist. Achievements, Rezepte und Trophäen bleiben über alle Durchgänge.',
    template: { name: 'Neues Achievement', category: 'combat', counter: 'kills', target: 10, bonus: [] },
    row: (x, p) => `${x.hidden ? '🔒 ' : ''}${x.target || 1}× ${ACHIEVEMENT_COUNTERS.find(c => c[0] === x.counter)?.[1]?.replace(/ \(.*$/, '') || x.counter || '?'}${x.filter ? ' · ' + x.filter : ''} → ${p?.data.items?.[p?.data.recipes?.[x.recipe]?.result]?.name || x.recipe || 'kein Rezept'}`,
    sections: [
      { title: 'Achievement', fields: [NAME, area_('description', 'Text', { hint: 'Was man dafür tun muss (bei versteckten erst nach dem Erreichen sichtbar)' }), select('category', 'Art', ACHIEVEMENT_CATEGORIES),
        bool('hidden', 'Versteckt', { hint: 'Steht in der Übersicht als „???“, bis es erreicht ist' }), num('order', 'Reihenfolge', { hint: 'In der Übersicht, kleiner = weiter oben' })] },
      { title: 'Bedingung', fields: [select('counter', 'Zähler', ACHIEVEMENT_COUNTERS, { required: true, hint: 'Was das Spiel zählt. Ein Ereignis ist ein Zähler mit Zielwert 1' }),
        text('filter', 'Filter', { hint: 'Nur ein Teil des Zählers: Gegner-ID, Familie (raider, mutant …), Waffen-ID, crit, POI-ID, Rang (S, A …) oder Rezept-ID. Leer = alles' }),
        num('target', 'Zielwert', { min: 1 })] },
      { title: 'Trophäe & Rezept', fields: [ref('recipe', 'Rezept der Trophäe', 'recipes', { hint: 'Wird beim Erreichen gelernt. Im Rezept: Ergebnis = die Trophäe (Gegenstand mit Tag Trophäe), Einmalig an, Entdecken „Achievement“' })] },
      { title: 'Bonus', fields: [table('bonus', 'Bonus, solange ausgestellt', [select('stat', 'Wert', [...TROPHY_GEAR, ...ACHIEVEMENT_SPECIALS]), num('value', 'Änderung')],
        { hint: 'Wirkt, solange die Trophäe auf irgendeinem Trophäen-Ständer im Rig steht, ohne Obergrenze. Prozentwerte: +5 = 5 % mehr' })] },
    ],
    check: (x, report, p) => {
      const r = p.data?.recipes?.[x.recipe], t = r && p.data?.items?.[r.result];
      if (!x.recipe) report('warning', 'Kein Rezept: das Achievement gibt keine Trophäe');
      else if (r && !r.once) report('warning', 'Rezept der Trophäe ist nicht „Einmalig“');
      if (t && !(t.tags || []).includes('trophy')) report('error', 'Die Trophäe braucht den Tag Trophäe, sonst passt sie auf keinen Ständer');
      if (!(x.bonus || []).length) report('hint', 'Ohne Bonus');
    },
  },
  crafting: {
    name: 'Kochen & Craften', icon: 'workbench', file: 'data/crafting.json', kind: 'single',
    hint: 'An Kochnische, Küche und Werkbank im Camp (E): Rezeptbuch links, Experimentieren in der Mitte. Ein Treffer landet im Rezeptbuch, ein Fehlschlag ergibt kuriosen Müll. Zutaten kommen aus Lager, Kiste und Rucksack, Ergebnisse gehen in den Rucksack (sonst Kiste, Lager, Boden). Rezepte selbst stehen im Bereich Rezepte.',
    sections: [
      { title: 'Handgriffe', fields: [
        num('stations.cook.seconds', 'Herd: Gar-Balken', { unit: 's', min: 0.5, hint: 'Daniel, 13.11.2026 (#013, 1a): jede Werkstatt hat ihre Handlung, Geschick gibt nur Bonus. So lange läuft der Gar-Balken; wer nicht drückt, nimmt am Ende normal raus' }),
        range('stations.cook.good', 'Herd: guter Bereich', { unit: '%' }), range('stations.cook.perfect', 'Herd: perfekter Bereich', { unit: '%' }),
        num('stations.cook.bonus.1', 'Bonus gut', { unit: '% Buff', min: 0 }), num('stations.cook.bonus.2', 'Bonus perfekt', { unit: '% Buff', min: 0 }),
        text('stations.cook.spices', 'Gewürze', { hint: 'Gegenstände, mit Komma; eins davon vor dem Gar-Balken macht das Gericht eine Stufe besser (verbraucht eins)' }),
        num('stations.bench.seconds', 'Werkbank: Handgriff', { unit: 's', min: 0.3 }), num('stations.bench.steps', 'Werkbank: Handgriffe je Waffe', { min: 1, max: 4 }),
        num('stations.bench.good', 'Werkbank: gut bis', { unit: '% daneben' }), num('stations.bench.perfect', 'Werkbank: perfekt bis', { unit: '% daneben' }),
        num('stations.bench.bonus.1', 'Werkbank: Schaden gut', { unit: '%' }), num('stations.bench.bonus.2', 'Werkbank: Schaden perfekt', { unit: '%' }),
        num('stations.surgery.seconds', 'Ripperdoc: Schnitt', { unit: 's', min: 0.3 }), num('stations.surgery.bonus.1', 'Ripperdoc: Implantat gut', { unit: '% Vorteil' }), num('stations.surgery.bonus.2', 'Ripperdoc: Implantat perfekt', { unit: '% Vorteil' }),
        num('stations.drone.power', 'Drohnen-Platine: Energie', { min: 1 }), num('stations.drone.slots', 'Drohnen-Platine: Plätze', { min: 1, max: 8 }),
        num('stations.drone.bonus.1', 'Platine: Lötstelle gut', { unit: '%' }), num('stations.drone.bonus.2', 'Platine: Lötstelle perfekt', { unit: '%' }),
        num('stations.truck.customers', 'Foodtruck: Kunden', { min: 1 }), num('stations.truck.patience', 'Foodtruck: Geduld', { unit: 's', min: 1 }), num('stations.truck.price', 'Foodtruck: Preis', { unit: '% vom Wert' }),
        num('stations.truck.tip', 'Foodtruck: Trinkgeld schnell', { unit: '%' }), num('stations.truck.favourite', 'Foodtruck: Lieblingsgericht', { unit: '%' }),
        num('stations.power.seconds', 'Regler: Dauer', { unit: 's', min: 1 }), range('stations.power.band', 'Regler: grüner Bereich', { unit: '%' }), num('stations.power.drift', 'Regler: Unruhe'),
        num('stations.power.need', 'Regler: nötig im Grünen', { unit: '%' }), num('stations.power.extra', 'Regler: Extra-Strom', { unit: '⚡' }), num('stations.power.hours', 'Regler: hält', { unit: 'h' })] },
      { title: 'Zerlegen', fields: [num('salvageTime', 'Zerlegen dauert', { unit: 'min', min: 0, hint: 'Je Stück, an Werkbank, Kochnische und Warroom (Gegenstände › Zerlegen)' })] },
      { title: 'Experimentieren', fields: [num('slots', 'Zutaten im Topf', { min: 1, max: 8, hint: 'Wie viele verschiedene Zutaten man zusammenwerfen kann' }),
        num('experimentMinutes', 'Ein Versuch dauert', { unit: 'min', min: 0, hint: 'Bei einem Fehlschlag; ein Treffer dauert so lang wie das Rezept' }),
        bool('exactCounts', 'Genaue Mengen', { hint: 'An: nur die genaue Menge jeder Zutat trifft. Aus: die richtigen Zutaten in mindestens der richtigen Menge treffen, verbraucht wird nur, was das Rezept braucht' }),
        num('failConsume', 'Fehlschlag verbraucht', { unit: '%', min: 0, max: 100, hint: 'Anteil der Zutaten im Topf, der bei einem Fehlschlag weg ist (mindestens 1 je Zutat)' }),
        bool('nearMiss', 'Knapp daneben melden', { hint: 'Fehlt nur eine Zutat (oder eine ist zu viel), sagt das Spiel „Knapp daneben“' }),
        bool('consumeNotes', 'Zettel verbrauchen', { hint: 'Notizzettel, Baupläne und Kochbücher verschwinden beim Lesen' })] },
      { title: 'Rezepte lernen', fields: [bool('autoLearn', 'Beim Einsammeln lernen', { hint: 'Zettel, Baupläne und Kochbücher landen sofort im Rezeptbuch statt im Rucksack (#012). Was schon in Kiste oder Lager liegt: Schnellaktion „Lernen“ im Inventar' }),
        num('knownKnowledge', 'Bekanntes Rezept gibt Wissen', { min: 0, hint: 'Ein Zettel für ein Rezept, das Leyla schon kennt, wird zu so viel Wissen (Techtree)' })] },
      { title: 'Fehlschläge', fields: [table('failures', 'Kurioser Müll', [select('function', 'Werkstatt-Art', WORKSHOP_FUNCTIONS), ref('item', 'Gegenstand', 'items'), num('weight', 'Gewicht', { min: 0 }), num('min', 'min', { min: 1 }), num('max', 'max', { min: 1 })],
        { hint: 'Was bei einem Fehlschlag herauskommt, gezogen nach Gewicht. Zeilen ohne Werkstatt-Art gelten überall' })] },
      { title: 'Texte', fields: [text('texts.hit', 'Treffer', { hint: '{name} = Ergebnis' }), text('texts.learnt', 'Neues Rezept', { hint: '{name} = Rezept' }), text('texts.miss', 'Fehlschlag', { hint: '{name} = Müll' }),
        text('texts.near', 'Knapp daneben'), text('texts.read', 'Zettel gelesen', { hint: '{name} = Rezept' }), text('texts.autoLearn', 'Rezept gelernt (Einsammeln)', { hint: '{name} = Rezept' }), text('texts.knowledge', 'Schon bekannt', { hint: '{name} = Rezept, {n} = Wissen' })] },
    ],
    check: (x, report) => { if (!(x.failures || []).length) report('warning', 'Keine Fehlschläge: ein misslungener Versuch ergibt nichts'); },
  },

  tractors: {
    name: 'Zugmaschinen', singular: 'Zugmaschine', icon: 'vehicle', file: 'data/tractors.json', kind: 'catalog',
    hint: 'Das Fahrzeug vorne am Rig. Zugkraft begrenzt das Gewicht der Container, Länge und Höhe begrenzen, wie viele angehängt und gestapelt werden.',
    template: { name: 'Neue Zugmaschine', pull: 2000, fuelUse: 10, tank: 60, length: 2, stack: 1, slots: { engine: 1, armor: 1, weapon: 0 }, value: 500 },
    row: x => `${x.pull ?? 0} kg Zugkraft · ${x.length ?? 0}×${x.stack ?? 0} Plätze`,
    sections: [
      { title: 'Zugmaschine', fields: [NAME, LOOK, DESCRIPTION, VALUE] },
      { title: 'Leistung', fields: [num('pull', 'Zugkraft', { unit: 'kg', min: 0 }), num('fuelUse', 'Verbrauch', { unit: 'l/100 km', min: 0 }), num('tank', 'Tank', { unit: 'l', min: 0 }),
        num('power', 'Lichtmaschine', { unit: '⚡', min: 0, hint: 'Energie für Werkstätten ohne Generator' }),
        num('speed', 'Tempo', { unit: '%', min: 10, hint: '#029: Reisezeit im Verhältnis zum Van (100 %). Crawler langsam, Fatbird schnell' }),
        bool('air', 'Fliegt', { hint: '#029: reist Luftlinie über die Karte, ohne Straßen (Fatbird)' }),
        ref('megarig', 'Mega-Rig', 'megarigs', { hint: '#029: diese Zugmaschine ist ein Mega-Rig; Container stehen auf seinem Raster statt in einer Reihe' })] },
      { title: 'Payload', fields: [num('places', 'Werkstatt-Plätze im Fahrzeug', { min: 0, max: 3, hint: 'Eigene Plätze wie ein kleiner Container (Van: Schlafkoje + Warroom). Im Camp per E an der Tür' }),
        num('length', 'Plätze hintereinander', { min: 0 }), num('stack', 'Stapelhöhe', { min: 1, hint: 'Wie viele Etagen übereinander: 1 = nicht stapeln, 2 = ein Container auf jedem Anhänger, der „Trägt obendrauf“ hat' })] },
      { title: 'Stauraum', fields: [size('storage', 'Eigener Stauraum', { unit: 'Felder', hint: 'Kleines Inventar im Fahrzeug selbst (Van: Kofferraum), auch ohne Anhänger. Im Camp per E an der Hecktür. Leer = keiner' }),
        text('storageName', 'Name', { hint: 'z. B. Kofferraum' })] },
      { title: 'Blick durch die Tür', fields: [range('door.x', 'Türöffnung von – bis', { unit: 'Bildpixel', hint: 'Waagrecht im Bild des Aussehens (letzter Frame = Tür offen). Durch die offene Tür sieht man die Werkstatt dahinter, am Rand abgeschnitten' }),
        range('door.y', 'Türöffnung oben – unten', { unit: 'Bildpixel', hint: 'Unten = Boden im Fahrzeug, darauf steht die Werkstatt' }), num('door.place', 'Platz hinter der Tür', { min: 0, max: 2, hint: '0 = erster Werkstatt-Platz im Fahrzeug, 1 = zweiter …' }),
        color('door.backdrop', 'Innenraum dahinter', { hint: 'Farbe hinter dem Bild, wo die Werkstatt durchsichtig ist; leer = keine (der Querschnitt hat seinen Innenraum selbst)' }),
        num('door.enter', 'Einsteigen bei', { unit: 'Bildpixel x', hint: '#056: mit Nischen steigt Leyla hier ein (Fahrertür): E öffnet die Karte; die Werkbänke in den Nischen haben eigene E-Punkte' }),
        table('door.bays', 'Nischen im Querschnitt', [range('x', 'von – bis', { unit: 'Bildpixel' }), range('y', 'oben – unten (Boden)', { unit: 'Bildpixel' }), num('place', 'Platz', { min: 0, max: 2 })],
          { hint: '#056 (Daniel, 18.11.2026: Van streng von der Seite, zu und im Querschnitt): je Nische eine Werkstatt, sie blendet mit dem Bild auf. Statt der Türöffnung oben' })] },
      { title: 'Aus dem Tileset', fields: [ref('kit.asset', 'Tileset', 'assets', { hint: '#076: Zeile 1 zu, Zeile 2 Querschnitt, gleiche Spalten. Das Spiel setzt das Fahrzeug daraus zusammen: Heck, Nische 1, dann je weiterem Werkstatt-Platz Stütze + Nische 2, Fahrerhaus. Nischen, Tür und Einsteigen rechnet es selbst aus. Leer = das Aussehen so, wie es ist' }),
        num('kit.rear', 'Heck bis', { unit: 'Bildpixel x', min: 1 }), num('kit.bay', 'Nische 1 bis', { unit: 'Bildpixel x', min: 1 }), num('kit.strut', 'Stütze bis', { unit: 'Bildpixel x', min: 1 }), num('kit.bay2', 'Nische 2 bis (danach Fahrerhaus)', { unit: 'Bildpixel x', min: 1 })] },
      { title: 'Slots', fields: [num('slots.engine', 'Motor', { min: 0 }), num('slots.armor', 'Panzerung', { min: 0 }), num('slots.weapon', 'Waffen', { min: 0 }),
        num('slots.roof', 'Dach', { min: 0, hint: 'Für Dachbox und Ähnliches' })] },
    ],
  },
  containers: {
    name: 'Container', singular: 'Container', icon: 'box', file: 'data/containers.json', kind: 'catalog', groupBy: { key: 'kind', options: CONTAINER_KINDS },
    hint: 'Payload des Rigs. Je nach Größe fasst ein Container eine, zwei oder drei Werkstätten.',
    template: { name: 'Neuer Container', kind: 'crate', places: 1, weight: 300, value: 100 },
    row: x => `${label(CONTAINER_KINDS, x.kind)} · ${x.places ?? 0} ${x.places === 1 ? 'Platz' : 'Plätze'} · ${x.weight ?? 0} kg`,
    sections: [{ title: 'Container', fields: [NAME, LOOK, select('kind', 'Art', CONTAINER_KINDS), num('places', 'Werkstatt-Plätze', { min: 1, max: 5, hint: 'Bei „Länge ziehbar“: so lang kommt er neu' }),
      range('resize', 'Länge ziehbar', { unit: 'Plätze', hint: '#113 (Daniel, 19.11.2026: „Container nur noch insgesamt kaufen und über Ziehen die Anzahl der Slots bestimmen, ohne Aufpreis“): im Bau-Modus am hinteren Ende ziehen. Leer = feste Länge' }),
      num('weightBase', 'Gewicht ohne Plätze', { unit: 'kg', min: 0, hint: 'Ziehbar: Gewicht = dies + je Platz' }), num('weightPerPlace', 'Gewicht je Platz', { unit: 'kg', min: 0 }),
      bool('noShop', 'Nicht beim Händler', { hint: '#113: nur noch ein Container wird gekauft, die anderen Größen gibt es nur noch in alten Spielständen und im Start-Rig' }),
      bool('tiles', 'Aus Container-Kacheln', { hint: 'Das Bild entsteht im Spiel aus Camp › Container-Kacheln (jede Länge, Höhe einstellbar); Innenraum und Trennwand wie beim 2-Platz-Bild' }),
      num('weight', 'Gewicht', { unit: 'kg', min: 0 }), bool('stackable', 'Stapelbar', { hint: 'Darf oben auf einem anderen Anhänger oder Container stehen' }),
      bool('carries', 'Trägt obendrauf', { hint: 'Auf dem Dach darf ein stapelbarer Container stehen. Wie hoch, bestimmt die Zugmaschine (Stapelhöhe)' }), VALUE, DESCRIPTION,
      bool('retired', 'Ausgemustert', { hint: 'Daniel, 13.11.2026: „Die Modul-Anhänger soll es nicht mehr geben“. Nicht kaufbar, nicht im Start; alte Spielstände bekommen stattdessen „Ersetzt durch“ (mit denselben Werkstätten)' }), ref('replacedBy', 'Ersetzt durch', 'containers')] },
      { title: 'Fahrgestell', fields: [bool('chassis', 'Auf Fahrgestell', { hint: 'Steht der Container nicht auf einem anderen, setzt das Camp ihn automatisch auf ein Fahrgestell in seiner Länge (Camp › Fahrgestell). Gestapelt steht er ohne' })] },
      { title: 'Geschlossen', fields: [ref('lookClosed', 'Aussehen geschlossen', 'assets', { hint: 'Dieselbe Hülle zu, deckungsgleich mit dem Aussehen. Im Camp ist der Container dann zu und blendet auf, wenn Leyla in der Nähe ist, im Bau-Modus oder mit dem Knopf „Rig offen“ (Camp › Rig-Ansicht › Auf- und Zublenden). Leer = immer offen' })] },
      { title: 'Innenraum im Camp', fields: [range('inside.x', 'Innenraum von – bis', { unit: 'Bildpixel', hint: 'Waagrecht im Bild des Aussehens (ungespiegelt). Die Werkstätten teilen sich diese Breite' }),
        range('inside.y', 'Innenraum oben – Boden', { unit: 'Bildpixel', hint: 'Der Boden ist eine Plattform: Leyla kann hineinspringen' }), bool('flip', 'Gespiegelt', { hint: 'Zusätzlich zu „Schaut nach links“ des Assets' }),
        num('deck', 'Dachkante', { unit: 'Bildpixel', hint: 'Höhe im Bild, auf der ein gestapelter Container steht (seine Unterkante = Ankerpunkt seines Bilds). Leer = Oberkante des Bilds' }),
        range('divider.x', 'Trennwand aus dem Bild: Spalten', { unit: 'Bildpixel', hint: 'Ausschnitt aus dem Aussehen (ungespiegelt), der zwischen zwei Werkstätten steht, z. B. der Eckpfosten. Leer = keine Trennwand' }), range('divider.y', 'Trennwand: Zeilen', { unit: 'Bildpixel', hint: 'Die untere Zeile ist der Fuß' }), text('divider.keep', 'Trennwand: nur diese Spalten', { hint: 'Kommagetrennt, z. B. 18,19,21,25,26 = schmaler Pfosten mit beiden Kanten. Leer = alle' }), num('divider.foot', 'Trennwand: Fuß bei', { unit: 'Bildpixel', hint: 'Zeile im Bild, auf der der Fuß steht: zwischen Rückwand und Vorderkante des Bodens heißt, die Wand ragt nur ein Stück nach vorn und Leyla läuft vorne vorbei. Leer = Vorderkante' }), num('divider.shadow', 'Trennwand: Schatten', { unit: '%', min: 0, max: 100, hint: 'Schatten am Fuß auf dem Boden und an der Rückwand daneben, 0 = keiner' }), num('divider.back', 'Trennwand: Rückwand bei', { unit: 'Bildpixel', hint: 'Zeile der Fuge zwischen Rückwand und Boden (bis dahin reicht der Schatten an der Wand)' }), num('benchInset', 'Werkstätten nach hinten', { unit: 'px', min: 0, hint: 'Ist der Boden im Bild gemalt (mit Tiefe), stehen die Werkstatt-Bilder so weit hinter seiner Vorderkante. Leer = Camp › Boden im Innenraum, falls „Boden zeichnen“ an ist' }), bool('floorStrip', 'Boden zeichnen', { hint: 'Malt im Innenraum den Boden mit Tiefe (Camp › Boden im Innenraum), für Container, deren Bild keinen eigenen Boden hat' }), num('benchScale', 'Maßstab der Werkstätten', { unit: '%', min: 30, max: 300, hint: 'Korrektur zum gemeinsamen Maßstab der Werkstatt-Bilder (Camp › Rig-Ansicht) in diesem Container, z. B. 130 in den hohen Hochseecontainern. Leer = 100' }), bool('cropAbove', 'Dachaufbau abschneiden', { hint: 'Steht etwas obendrauf, wird das Bild über der Dachkante weggeschnitten (Kisten, Antennen, Schüssel), damit der Container direkt auf dem Dach sitzt. Standard an' })] }],
  },
  workshops: {
    name: 'Werkstätten', singular: 'Werkstatt', icon: 'factory', file: 'data/workshops.json', kind: 'catalog', groupBy: { key: 'function', options: WORKSHOP_FUNCTIONS },
    hint: 'Räume im Rig. Belegen Plätze in Containern und brauchen oder liefern Energie.',
    template: { name: 'Neue Werkstatt', function: 'storage', places: 1, power: 0, stage: 'mvp', value: 100 },
    row: x => `${label(WORKSHOP_FUNCTIONS, x.function)} · ${x.places ?? 1} Pl. · ${x.power > 0 ? '+' : ''}${x.power ?? 0} ⚡`,
    sections: [
      { title: 'Werkstatt', fields: [NAME, LOOK, select('function', 'Funktion', WORKSHOP_FUNCTIONS), STAGE, DESCRIPTION,
        bool('fixed', 'Fest eingebaut', { hint: 'Daniel, 12.11.2026 (Cryo-Tank): kann nicht verkauft, ausgebaut oder umgestellt werden' })] },
      { title: 'Werte', fields: [num('places', 'Plätze', { min: 1, max: 3 }), num('power', 'Energie', { unit: '⚡', hint: '+ liefert, − braucht' }), num('capacity', 'Kapazität', { min: 0, hint: 'Lagerplätze, Betten …' }),
        ref('buff', 'Buff', 'buffs', { hint: 'z. B. Schlafzimmer oder Chill Area' }), size('grid', 'Lager-Raster', { unit: 'Felder', hint: 'Ist dieser Platz ein Lager: Größe des Rasters. Ein Lagerregal gibt seine Felder ins gemeinsame Camp-Lager (#041), ein Speziallager bleibt ein eigenes Inventar. Leer = kein Lager' }),
        bool('ownStorage', 'Speziallager', { hint: '#041 (Daniel, 16.11.2026: „Ausnahme sind Speziallagerungen wie Kühlen, Waffen oder Trophäen“): eigenes Inventar statt Felder fürs Camp-Lager (Kühlraum, Waffenkammer, Schatzkammer)' }),
        multi('prefers', 'Einlagern bevorzugt', [...ITEM_CATEGORIES, ...WEAPON_KINDS], { hint: '#041: „Alles einlagern“ legt diese Arten zuerst hierher (Kühlraum: Gerichte und Zutaten, Waffenkammer: Waffen), was nicht passt, kommt ins Camp-Lager' }), VALUE] },
      { title: 'Außenwand', fields: [ref('outside', 'Außenwand', 'assets', { hint: 'Daniel, 13.11.2026: Clutter an der Container-Außenwand, passend zur Werkstatt dahinter (Abluftrohr der Küche, Bullauge der Koje …). Sitzt auf der geschlossenen Hülle über diesem Platz und blendet mit ihr aus' }),
        point('outsideAt', 'Außenwand bei', { unit: '% des Platzes', hint: 'Mitte des Bilds: waagrecht über dem Platz, senkrecht zwischen Decke und Boden. Leer = 50 / 38' })] },
      { title: 'Aussehen im Rig', fields: [num('scale', 'Maßstab', { unit: '%', min: 30, max: 200, hint: 'Korrektur zum gemeinsamen Maßstab der Werkstatt-Bilder (Camp › Rig-Ansicht), z. B. wenn ein Bild etwas zu groß gemalt ist' }),
        num('fit', 'Breite im Platz', { unit: '%', min: 30, max: 200, hint: 'Nur ohne gemeinsamen Maßstab: wie breit das Bild im Platz steht (100 = so breit wie der Platz), höchstens so hoch wie der Innenraum' }),
        ref('lookEmpty', 'Aussehen leer', 'assets', { hint: 'Für Lager: dieselbe Grafik leer, deckungsgleich. Je voller das Lager, desto mehr Fächer zeigt das Spiel aus dem Aussehen (voll), von unten nach oben' }),
        table('fill', 'Fächer', [num('y', 'Oberkante', { unit: 'Bildpixel', min: 0 })], { hint: 'Wo die Fächer anfangen (Bildpixel von oben, von oben nach unten sortiert). Das unterste Fach füllt sich zuerst' })] },
      { title: 'Zisterne', when: x => x.function === 'cistern', fields: [ref('cistern.item', 'Gefäß', 'items', { hint: 'Was E an der Zisterne abfüllt (eine volle Flasche je Einheit)' }),
        num('cistern.perHour', 'Sammelt', { unit: 'je h', min: 0, hint: 'Wasser in Flaschen pro Stunde Ereignis-Zeit (Schlafen, Fahren, Runs …)' }), num('cistern.max', 'Fasst', { unit: 'Flaschen', min: 1 }),
        num('cistern.rain', 'Bei Regen', { unit: '× schneller', min: 1, hint: 'Während es im Camp regnet (Camp › Regen), sammelt sie so viel schneller (#014)' })] },
      { title: 'Hydrokultur', when: x => x.function === 'garden', fields: [ref('garden.plants', 'Pflanzen-Raster', 'assets', { hint: 'Asset der Art „Symbole“: je Sorte eine Zeile, je Wachstumsstufe eine Spalte (Keimling, jung, groß, reif)' }),
        table('garden.crops', 'Sorten', [text('name', 'Name'), ref('item', 'Ernte', 'items'), num('hours', 'Reif nach', { unit: 'h', min: 0.1 }), num('count', 'Menge', { min: 1 }), num('row', 'Zeile im Raster', { min: 1 })], { hint: 'Wächst in Ereignis-Zeit (Schlafen, Fahren, Runs …); reif = E an der Hydrokultur erntet und pflanzt neu' }),
        ref('garden.water.item', 'Gießen mit', 'items', { hint: 'Daniel, 13.11.2026: Wasser auch für die Hydrokultur (#014). Eine Flasche aus Rucksack, Kiste oder Lager; leer = kein Gießen' }),
        num('garden.water.hours', 'Gießen bringt', { unit: 'h', min: 0, hint: 'So viele Stunden wachsen alle Töpfe, die noch nicht reif sind, sofort weiter' }), num('garden.water.every', 'Wieder gießen nach', { unit: 'h', min: 0 }),
        table('garden.pots', 'Töpfe', [num('x', 'x', { unit: 'Bildpixel' }), num('y', 'Topfrand y', { unit: 'Bildpixel' }), num('crop', 'Sorte', { min: 1, hint: 'Zeile in „Sorten“' })], { hint: 'Wo die Pflanzen aus dem Bild wachsen (Mitte des Topfs, Oberkante)' }),
        num('garden.size', 'Pflanzen-Größe', { unit: 'Bildpixel', min: 4, hint: 'So hoch erscheint ein Feld des Rasters im Bild der Werkstatt' })] },
      { title: 'Schatzkammer & Trophäen', fields: [multi('accept', 'Lager nimmt nur', ITEM_CATEGORIES, { hint: 'Kategorien, die ins Lager-Raster dürfen (leer = alles). Schatzkammer: Wertsachen' }),
        table('stands', 'Trophäen-Ständer', [text('name', 'Name'), size('grid', 'Raster', { unit: 'Felder' }), num('x', 'x'), num('y', 'y'), num('w', 'Breite'), num('h', 'Höhe'), select('align', 'Steht', [['bottom', 'unten (Regal, Sockel)'], ['top', 'oben (Haken)']]),
          num('cell', 'Feldgröße', { min: 0, unit: 'px', hint: 'Bildpixel je Feld beim Ausstellen; leer = so groß, wie die Fläche hergibt. Darf größer sein als die Fläche (Dinge ragen dann über)' }),
          text('rows', 'Reihen auf', { hint: 'je Raster-Reihe (oben → unten) das Regalbrett: Boden-y, optional @x+Breite; mit ; trennen, z. B. „49@37+56; 92@37+56“. Leer = Reihen gleichmäßig in der Fläche' }),
          text('accept', 'Nimmt', { hint: '#033: leer = nur Trophäen; sonst Arten mit Komma, z. B. „melee, ranged“ für Waffen an Display-Boards' })],
          { hint: 'Daniel, 11.11.2026: Platz an der Wand für Trophäen, jeder Ständer ist ein eigenes Inventar und zeigt jedes Ding in seiner echten Größe. x/y/Breite/Höhe = Fläche im Aussehen (Bildpixel); nur Dinge mit Tag „Trophäe“' })] },
      { title: 'Ausbau', fields: [table('upgrades', 'Stufen (★, ★★, ★★★)', [text('name', 'Name'), num('deltas', 'Preis', { unit: 'Δ', min: 0 }), ref('item', 'Teil', 'items'), num('count', 'Anzahl', { min: 1 }), num('hours', 'Arbeit', { unit: 'h', min: 0 }),
        num('speed', 'Schneller', { unit: '%' }), num('quality', 'Buff stärker', { unit: '%' }), num('power', 'Strom', { unit: '⚡', hint: 'positiv = erzeugt mehr, negativ = braucht mehr' }), num('rows', '+ Reihen Lager', { min: 0, hint: '#099 Speziallager: so viele Reihen kommen zum eigenen Lager-Raster dazu' }), ref('look', 'Bild ab dieser Stufe', 'assets'), text('description', 'Beschreibung')],
        { hint: '#078 (Daniel 19.11.2026: „ermögliche den Ausbau von Werkstätten … mit Sternchen neben dem Titel“): eine Zeile je Stufe, die Werte zählen zusammen. Ausbauen im Werkstatt-Fenster bzw. -Menü' })] },
      { title: 'Synergie', fields: [refs('synergy.partners', 'Passt zu', 'workshops', { hint: '#033 (Daniel: „wie bei Civilization oder Dorfromantik“): Werkstätten, die als direkte Nachbarn (links, rechts, darüber, darunter) den Bonus bringen' }),
        refs('synergy.foes', 'Stört sich mit', 'workshops', { hint: '#076 Gegenpaare: direkte Nachbarn, die den Bonus senken (bis ins Minus: langsamer, weniger Strom, schwächerer Buff)' }),
        select('synergy.effect', 'Wirkung', [['', 'keine'], ['speed', 'Schneller (Herstellen, Kochen, Wachsen)'], ['power', 'Mehr Strom'], ['quality', 'Stärkerer Buff']]),
        num('synergy.max', 'Höchstens', { min: 0, hint: 'Bei allen angrenzenden Plätzen passend belegt: % (schneller, Buff) bzw. ⚡ (Strom). Sonst anteilig: passende Nachbarn / angrenzende Plätze' }),
        num('synergy.chain', 'Reihe: je weitere', { min: 0, hint: '#034 Reihenschaltung: so viel mehr für jede weitere gleiche Werkstatt direkt daneben in derselben Reihe (auch über die Containergrenze)' }),
        num('synergy.full', 'Ganzer Container', { min: 0, hint: 'Dazu, wenn der ganze Container (mindestens zwei) nur diese Werkstatt enthält: der dicke Bonus' })] },
      { title: 'Licht & Effekte', fields: [table('fx', 'Effekte', [select('kind', 'Art', BENCH_FX), num('x', 'x'), num('y', 'y'), num('w', 'Breite'), num('h', 'Höhe'), color('color', 'Farbe'), num('size', 'Größe'), num('rate', 'Tempo'), select('when', 'Wann', BENCH_FX_WHEN), num('idle', 'Sonst %', { min: 0, max: 100 })],
        { hint: 'Alles in Bildpixeln des Aussehens (x/y = linke obere Ecke, Breite/Höhe = Bereich). Licht: Größe = Radius, Tempo = Flackern %. Bildschirm: Tempo = Zeilen pro Sekunde. Dampf/Rauch/Blasen: Tempo = pro Sekunde. Funken: Tempo = Schauer pro Minute. LED: Tempo = Blinken pro Sekunde. Lichter funkeln: findet die hellen Punkte im Bereich selbst. Fische: Tempo = Anzahl. Druckkopf: fährt im Bereich hin und her. Glanz: läuft alle „Tempo“ Sekunden über den Bereich. Wann: Immer, abends, wenn Leyla nah ist oder bei Benutzung; „Sonst %“ = Stärke, solange es nicht zutrifft' })] },
      { title: 'Benutzen', fields: [text('rest.verb', 'Knopf', { hint: 'Für Chill Area, Drohnenwerkstatt & Co.: Was Leyla hier macht (z. B. „Fernsehen und abhängen“). Leer = nur Infos' }), num('rest.hours', 'Dauer', { unit: 'h', min: 0 }),
        num('rest.heal', 'Heilt', { unit: '%', min: 0, max: 100 }), text('rest.banner', 'Meldung danach'), bool('rest.drone', 'AvA dockt an', { hint: 'Die Drohne fliegt zur Werkstatt und setzt sich drauf, solange Leyla hier ist' })] },
    ],
  },
  rigParts: {
    name: 'Rig-Teile', singular: 'Rig-Teil', icon: 'anvil', file: 'data/rig_parts.json', kind: 'catalog', groupBy: { key: 'slot', options: RIG_SLOTS },
    hint: 'Motoren, Panzerung, Waffen und Dachaufbauten für die Slots der Zugmaschine. Rig-Teile sind Bauteile wie Werkstätten: kaufen beim Händler oder an der Werkbank herstellen (Rezept mit „Oder Rig-Teil“), sie liegen auf dem Schrottplatz und werden im Bau-Modus (B) an die Sockel am Van gezogen.',
    template: { name: 'Neues Rig-Teil', slot: 'engine', pull: 0, armor: 0, damage: 0, fuelUse: 0, size: [2, 2], value: 200 },
    row: x => `${label(RIG_SLOTS, x.slot)} · ${(x.size || [1, 1]).join('×')} · ${x.value ?? 0} Δ`,
    sections: [{ title: 'Rig-Teil', fields: [NAME, LOOK, select('slot', 'Slot', RIG_SLOTS), num('pull', 'Zugkraft +', { unit: 'kg' }), num('armor', 'Panzerung +'), num('damage', 'Schaden'),
      num('fuelUse', 'Verbrauch ±', { unit: 'l/100 km' }), num('storageRows', 'Stauraum +', { unit: 'Reihen', min: 0, hint: 'Macht den Stauraum der Zugmaschine um so viele Reihen höher (Dachbox)' }), VALUE, DESCRIPTION] },
      { title: 'Aussehen aus Code', fields: [size('size', 'Größe', { unit: 'Felder', hint: 'Solange es kein Aussehen gibt: Kasten aus Code, ein Feld = 34 × 30 px' }), text('glyph', 'Kürzel', { hint: '1–3 Zeichen oder ein Emoji auf dem Kasten' }), color('color', 'Farbe')] }],
  },
  megarigs: {
    name: 'Mega-Rigs', singular: 'Mega-Rig', icon: 'vehicle', file: 'data/megarigs.json', kind: 'catalog', groupBy: { key: 'kind', options: MEGARIG_KINDS },
    hint: 'Große Fahrzeuge aus dem Baukasten (#022): LKW, Crawler, Fatbird. Nur das rohe Fahrzeug ist eigen, Module (Container, Räume) und Anbauteile sind ein gemeinsamer Baukasten auf einem Raster aus Plätzen. Prototyp zum Begehen: megarig.html?id=<ID>.',
    template: { name: 'Neues Mega-Rig', kind: 'crawler', grid: { place: 7, story: 6 }, hull: { under: 4, inside: 1, front: 10, back: 4, segPlaces: 2 }, stages: [{ name: 'Rohbau', mids: 1, top: 1 }], modules: [], addons: [] },
    row: x => `${label(MEGARIG_KINDS, x.kind)} · ${(x.stages || []).length} Ausbaustufen · ${(x.modules || []).length} Module`,
    check: (x, report, p, id) => { for (const [k, t] of megarigProblems(p.data, id)) report(k, t); },
    sections: [
      { title: 'Hauptcontainer', fields: [bool('hub.enabled', 'Hauptcontainer', { hint: '#077 (Daniel 19.11.2026: „kein Lager mehr am Boden, sondern das Lager sein“): ein Raum im Rumpf, in dem Feuer, Schwarzes Brett und Crew wohnen; kein Container kann hierhin. Aus Code gezeichnet' }),
        text('hub.name', 'Name'), num('hub.place', 'Platz', { min: 0, hint: '0 = erster Platz hinter dem Bug' }), num('hub.story', 'Stockwerk', { min: 0, hint: 'im Rumpf (unter „Stockwerke im Rumpf“)' }), num('hub.places', 'Breite', { unit: 'Plätze', min: 1, max: 4 })] },
      { title: 'Mega-Rig', fields: [NAME, select('kind', 'Art', MEGARIG_KINDS), ref('tractor', 'Zugmaschine', 'tractors', { hint: 'Werte (Zugkraft, Verbrauch, Slots) kommen von dieser Zugmaschine' }),
        text('brand', 'Hersteller', { hint: 'Marke der Spielwelt als Schriftzug am Rumpf (#025), z. B. Armadillo Heavy Industries. Leer = kein Schriftzug' }), DESCRIPTION] },
      { title: 'Raster', fields: [num('grid.place', 'Platz breit', { unit: 'Kacheln', min: 2, hint: 'Ein Werkstatt-Platz. 7 passt zu den Container-Bildern (gleicher Maßstab wie hoch)' }),
        num('grid.story', 'Stockwerk hoch', { unit: 'Kacheln', min: 4, hint: 'Boden bis Boden. 6 = Innenraum 5 Kacheln, Leyla passt gut hinein' })] },
      { title: 'Rohes Fahrzeug', fields: [ref('hull.look', 'Aussehen', 'assets', { hint: 'Bild des rohen Fahrzeugs (LKW: Zugmaschine). Leer = aus Code im Stil der Art' }),
        num('hull.lookScale', 'Maßstab des Bilds', { min: 0.5, step: 0.25, hint: 'Bildpixel → Spielpixel' }), point('hull.lookOffset', 'Versatz des Bilds', { unit: 'px', hint: 'Vom vorderen Ende am Boden aus' }),
        num('hull.under', 'Unter dem ersten Stockwerk', { unit: 'Kacheln', min: 1, hint: 'LKW: Höhe der Ladefläche, Crawler: Höhe der Ketten, Fatbird: Schwebehöhe' }),
        num('hull.inside', 'Stockwerke im Rumpf', { min: 0, hint: 'So viele Stockwerke liegen im Rumpf (Räume = Container ohne Außenhaut), alles darüber wird obendrauf gebaut' }),
        num('hull.frame', 'Davon offener Lastrahmen', { min: 0, hint: 'Fatbird: die unteren Stockwerke im Rumpf sind ein offener Rahmen, in dem Container hängen' }),
        text('hull.bridge', 'Name der Brücke', { hint: 'Crawler: der Raum vorne im Rumpf. Leer = Kommandobrücke' }), num('hull.front', 'Bug', { unit: 'Kacheln', min: 2, hint: 'Kabine/Cockpit vor dem ersten Platz' }), num('hull.back', 'Heck', { unit: 'Kacheln', min: 1 }),
        num('hull.cabInset', 'Kabinendach ab', { unit: 'Kacheln', min: 2, hint: 'Crawler: das begehbare Kabinendach beginnt so weit hinter der Spitze (hinter der schrägen Nase des Bilds)' }),
        num('hull.segPlaces', 'Plätze je Mittelstück', { min: 1, hint: 'Das wiederholbare Segment: so viele Plätze kommen je Mittelstück dazu' }),
        num('hull.envelope', 'Gashülle', { unit: 'Kacheln', min: 0, hint: 'Nur Fatbird: Höhe der Hülle über dem Rumpf, oben ein Laufsteg' })] },
      { title: 'Kachel-Set', fields: [ref('skin.bow', 'Bug', 'assets', { hint: '#026: Bild des Bugs (Kabine/Cockpit), rechts offen. Leer = Rumpf aus Code' }),
        ref('skin.mid', 'Mittelstück', 'assets', { hint: 'Wiederholbares Rumpfstück, reiht sich vom Bug bis zum Heck' }), ref('skin.stern', 'Heck', 'assets', { hint: 'Bild des Hecks, links offen' }),
        ref('skin.track', 'Kettenfahrwerk', 'assets', { hint: 'Crawler: ein ganzes Fahrwerk; der Wiederholbereich wird verlängert' }), range('skin.trackRepeat', 'Wiederholbereich der Kette', { unit: 'Bildpixel', hint: 'Von – bis (x im Bild), eine Laufrolle lang' }),
        ref('skin.rotor', 'Rotor', 'assets', { hint: 'Fatbird: Mantelrotor-Gondel, Ausleger links; vorne gespiegelt' }),
        num('skin.scale', 'Maßstab', { min: 1, step: 0.25, hint: 'Bildpixel → Spielpixel für Mittelstück und Fahrwerk (der Bug passt sich der Rumpfhöhe an)' }),
        num('skin.sternScale', 'Heck-Maßstab', { min: 0.5, step: 0.05, hint: 'Crawler: Heck so viel größer als das Mittelstück (1,75), nur ohne „Rumpf im Heck“' }),
        range('skin.sternBody', 'Rumpf im Heck von – bis', { unit: 'Bildpixel', hint: '#030: Zeilen im Heck-Bild, die vom Deck bis zur Kettenoberkante reichen; das Heck skaliert sich darauf' }),
        point('skin.sternAlign', 'Heck-Zeile = Mittelstück-Zeile', { unit: 'Bildpixel', hint: '#031 Fatbird: diese Zeile im Heck (z. B. das Neonband) liegt auf jener Zeile im Mittelstück' }), num('skin.sternInset', 'Heck beginnt vor dem Ende', { unit: 'Kacheln', min: 0 }), num('skin.sternGlow', 'Triebwerk-Glühen in Zeile', { unit: 'Bildpixel', min: 0 }),
        num('skin.sternSlope', 'Schräge ab', { unit: 'Bildpixel', hint: 'Ab hier fällt das Dach des Hecks ab; darüber läuft ein Gitter-Laufsteg auf Deckhöhe weiter' })] },
      { title: 'Lack', fields: [color('paint.main', 'Grundfarbe'), color('paint.dark', 'Dunkel'), color('paint.trim', 'Kanten/Rost'), color('paint.neon', 'Neon'), color('paint.light', 'Positionslichter')] },
      { title: 'Ausbaustufen', fields: [table('stages', 'Ausbaustufen', [text('name', 'Name'), num('mids', 'Mittelstücke', { min: 0 }), num('top', 'Stockwerke obendrauf', { min: 0 }), num('price', 'Ausbau kostet', { unit: 'Δ', min: 0, hint: '#029: im Spiel per Bau-Modus' }), num('hours', 'Dauer', { unit: 'h', min: 0 })],
        { hint: 'Wie das Fahrzeug wächst: Mittelstücke machen es länger (mehr Plätze), Stockwerke obendrauf höher. Im Prototyp per Regler' })] },
      { title: 'Module', fields: [table('modules', 'Module', [ref('container', 'Container', 'containers'), num('place', 'Platz', { min: 0 }), num('story', 'Stockwerk', { min: 0 }),
        bool('shell', 'Außenhaut'), num('from', 'Ab Stufe', { min: 0 }), text('name', 'Name'), color('color', 'Farbton'), refs('workshops', 'Werkstätten', 'workshops')],
        { hint: 'Container und Räume auf dem Raster. Platz 0 = erster Platz hinter dem Bug, Stockwerk 0 = unterstes. Im Rumpf ohne Außenhaut = Raum. Ab Stufe: 0 = erste Ausbaustufe. Farbton färbt das Container-Bild ein (leer = wie gemalt)' })] },
      { title: 'Lichterketten', fields: [table('lights', 'Lichterketten', [num('from', 'Von Modul', { min: 1 }), select('fromCorner', 'Ecke', [['0', 'links'], ['1', 'rechts']]), num('to', 'Zu Modul', { min: 1 }), select('toCorner', 'Ecke', [['0', 'links'], ['1', 'rechts']])],
        { hint: '#028: Ketten zwischen den oberen Ecken zweier Container (Modul-Nummer wie in der Liste oben, ab 1). Farben, Durchhang und Abstand wie im Camp (Camp › Lichterketten). Fehlt ein Modul in der Stufe, hängt die Kette nicht' })] },
      { title: 'Anbauteile', fields: [table('addons', 'Anbauteile', [ref('addon', 'Teil', 'rigAddons'), num('place', 'Platz', { min: -1, hint: '-1 = über dem Bug' }), num('story', 'Stockwerk', { min: 0 }),
        select('at', 'Wo', ADDON_AT), num('shift', 'Versatz', { unit: 'Kacheln' }), bool('flip', 'Gespiegelt'), num('from', 'Ab Stufe', { min: 0 }), text('text', 'Text'), color('color', 'Farbe')],
        { hint: 'Teile aus dem gemeinsamen Baukasten an Anschlusspunkten: Dach (Stockwerk = auf dessen Boden), Wand (Mitte des Stockwerks)' })] },
      { title: 'Wege am rohen Fahrzeug', fields: [table('walk', 'Begehbar', [select('kind', 'Art', [['platform', 'Plattform'], ['solid', 'Fest'], ['ladder', 'Leiter']]),
        num('x', 'x', { unit: 'Kacheln' }), num('y', 'Höhe', { unit: 'Kacheln' }), num('w', 'Breite', { unit: 'Kacheln' }), num('h', 'Höhe (Dicke)', { unit: 'Kacheln' })],
        { hint: 'Für Bild-Fahrzeuge (LKW): wo Leyla am Bild stehen und klettern kann. x vom Bug, Höhe über dem Boden' })] },
    ],
  },
  salvage: {
    name: 'Bergungsprojekte', singular: 'Bergungsprojekt', icon: 'vehicle', file: 'data/salvage.json', kind: 'catalog',
    hint: 'Wracks, die Leyla über mehrere Besuche wieder flott macht (#023, design.md › Bergungsprojekt). Der Fundort wird je Durchgang gewürfelt (Abstand vom Start), das Wrack steht dort am Ende des Camps. Die Teile liegen in anderen POIs. Was eingebaut ist, bleibt, auch über den Durchgang.',
    template: { name: 'Neue Bergung', hops: [1, 2], steps: [], chestChance: 30 },
    row: x => `${new Set((x.steps || []).map(s => s.step)).size} Abschnitte · ${(x.steps || []).reduce((n, s) => n + (s.count || 1), 0)} Teile${x.tractor ? ' · Zugmaschine ' + x.tractor : x.megarig ? ' · Mega-Rig ' + x.megarig : ''}`,
    check: (x, report, p) => {
      if (!x.tractor && !x.megarig) report('warning', 'Weder Zugmaschine noch Mega-Rig als Belohnung');
      if (!(x.steps || []).length) report('warning', 'Keine Abschnitte');
      for (const [i, r] of (x.steps || []).entries()) if (r.item && !(r.where || []).length && !x.anywhere) report('hint', `Zeile ${i + 1}: ${p.data.items?.[r.item]?.name || r.item} hat keinen Fundort (POI)`);
    },
    sections: [
      { title: 'Bergung', fields: [NAME, area_('text', 'Erster Satz', { hint: 'Was Leyla sagt, wenn sie das Wrack zum ersten Mal sieht' }), DESCRIPTION, ref('after', 'Nach', 'salvage', { hint: 'Erst wenn diese Bergung fertig ist (Crawler und Fatbird nach dem LKW)' }),
        range('hops', 'Fundort: Straßen vom Start', { hint: 'Je Durchgang gewürfelt: ein Ort so viele Straßen vom Start entfernt (LKW 1–2, Mega-Rigs weiter draußen)' }), num('minCycle', 'Ab Durchgang', { min: 1, hint: 'Leer = ab dem ersten (design.md: „in jedem Durchgang möglich, im ersten sehr schwer“)' })] },
      { title: 'Belohnung', fields: [ref('tractor', 'Neue Zugmaschine', 'tractors', { hint: 'Ersetzt den Van vorne am Rig. Der Van bleibt am Fundort als Basis' }), ref('megarig', 'Mega-Rig', 'megarigs', { hint: 'Wird freigeschaltet (Crawler, Fatbird)' }),
        area_('finale', 'Probestart', { hint: 'Text beim letzten Abschnitt' })] },
      { title: 'Abschnitte', fields: [table('steps', 'Teile je Abschnitt', [text('step', 'Abschnitt'), ref('item', 'Teil', 'items'), num('count', 'Anzahl', { min: 1 }), refs('where', 'Fundorte', 'pois'), num('hours', 'Einbau', { unit: 'h', min: 0 })],
        { hint: 'Zeilen mit demselben Abschnitt gehören zusammen, Reihenfolge = Bauabschnitte. Die Teile liegen in den Kisten der Fundorte (solange sie fehlen), im Tresor des Fundorts sicher eines' })] },
      { title: 'Beute', fields: [num('chestChance', 'Chance je Kiste', { unit: '%', min: 0, max: 100, hint: 'Wie oft eine Kiste im Fundort-POI ein fehlendes Teil enthält' }), bool('anywhere', 'Teile auch überall', { hint: 'Auch in POIs ohne Eintrag als Fundort (mit halber Chance)' })] },
      { title: 'Wrack im Camp', fields: [ref('look', 'Aussehen', 'assets', { hint: 'Bild des Wracks (LKW: die Zugmaschine). Leer = aus Code' }), num('width', 'Breite', { unit: 'Kacheln', min: 6, hint: 'So viel Platz bekommt das Wrack am Ende des Camps' }), num('scale', 'Maßstab', { min: 0.5, step: 0.25 }),
        select('art', 'Wrack aus Code', [['', '–'], ['crawler', 'Crawler'], ['airship', 'Fatbird']])] },
    ],
  },
  rigAddons: {
    name: 'Anbauteile', singular: 'Anbauteil', icon: 'build', file: 'data/rig_addons.json', kind: 'catalog', groupBy: { key: 'at', options: ADDON_AT },
    hint: 'Gemeinsamer Baukasten für alle Mega-Rigs (#022): Schüssel, Antennen, Auspuff, Kran, Banner, Neon … Bild (Ausschnitt aus einem Teileblatt) oder aus Code.',
    template: { name: 'Neues Anbauteil', at: 'roof', size: [2, 2] },
    row: x => `${label(ADDON_AT, x.at)} · ${(x.size || [1, 1]).join('×')} Kacheln${x.code ? ' · ' + label(ADDON_CODE, x.code) : ''}`,
    sections: [{ title: 'Anbauteil', fields: [NAME, select('at', 'Sitzt', ADDON_AT), size('size', 'Größe', { unit: 'Kacheln' }), select('walk', 'Begehbar', ADDON_WALK), DESCRIPTION] },
      { title: 'Aussehen', fields: [ref('look', 'Bild', 'assets'), point('crop.at', 'Ausschnitt ab', { unit: 'Bildpixel', hint: 'Oben links im Teileblatt' }), size('crop.size', 'Ausschnitt Größe', { unit: 'Bildpixel' }),
        select('code', 'Aus Code', ADDON_CODE, { hint: 'Ohne Bild: aus Code gezeichnet' }), color('color', 'Farbe'), text('text', 'Text', { hint: 'Neon-Schild, Banner' })] }],
  },
  parallax: {
    name: 'Parallax-Sets', singular: 'Parallax-Set', icon: 'layers', file: 'data/parallax.json', kind: 'catalog',
    hint: '#115 (Daniel, 19.11.2026: „Die Parallax-Hintergründe überall können bitte in hübsch umgesetzt werden. Modular. Auch ein paar schwarze Vordergrund-Formen“): gemalte Ebenen vor dem Himmel aus Code, je Region (Reisen › Landschaften), im Camp, auf der Fahrt, in POIs draußen und auf der Startseite. Ebenen lassen sich zwischen Sets mischen.',
    template: { name: 'Neues Parallax-Set', layers: [], nightColor: '#262040' },
    row: x => `${(x.layers || []).length} Ebenen${x.fg?.look ? ' · Vordergrund' : ''}`,
    sections: [{ title: 'Set', fields: [NAME, DESCRIPTION, table('layers', 'Ebenen', [ref('look', 'Bild', 'assets'), num('speed', 'Tempo', { unit: '%', min: 0, max: 100 }), num('bottom', 'Unterkante', { unit: 'px ab Horizont' }), num('scale', 'Maßstab', { unit: '%', min: 10 }), num('night', 'Nachts dunkler', { unit: '%', min: 0, max: 100 }), num('alpha', 'Deckkraft', { unit: '%', min: 0, max: 100 }), num('offset', 'Versatz', { unit: 'Bildpixel' })], { hint: 'Von fern nach nah. Tempo 0 = steht mit dem Himmel, 100 = läuft mit der Welt. Bilder mit transparentem Himmel, werden gespiegelt wiederholt' }), color('nightColor', 'Farbe der Nacht', { hint: 'Dahin dunkeln die Ebenen nachts' })] },
      { title: 'Vordergrund', fields: [ref('fg.look', 'Silhouetten', 'assets', { hint: 'Symbol-Raster mit schwarzen Formen' }), text('fg.cells', 'Nur diese Felder', { hint: 'Mit Komma, 1 = erstes; leer = alle' }),
        num('fg.speed', 'Tempo', { unit: '%', min: 100, hint: 'Über 100: schneller als die Welt, ganz vorne' }), range('fg.gap', 'Abstand', { unit: 'px' }), range('fg.size', 'Größe', { unit: '%' }),
        num('fg.drop', 'Tiefer als der Boden', { unit: 'px' }), num('fg.alpha', 'Deckkraft', { unit: '%', min: 0, max: 100 })] },
      { title: 'Ebene bis zum Camp', fields: [ref('plain.look', 'Bild', 'assets', { hint: 'Gemalte Ebene zwischen Horizont und Camp-Boden (#084), waagrecht nahtlos, deckend. Leer = Bänder und Dünen aus Code' }),
        num('plain.scale', 'Maßstab', { unit: '%', min: 10 }), num('plain.speed', 'Tempo', { unit: '%', min: 0, max: 100 }), num('plain.top', 'Oberkante', { unit: 'px ab Horizont' }), num('plain.night', 'Nachts dunkler', { unit: '%', min: 0, max: 100 })] }],
  },
  voices: {
    name: 'Stimmen', singular: 'Stimme', icon: 'loudspeaker', file: 'data/voices.json', kind: 'catalog', groupBy: { key: 'style', options: VOICE_STYLES },
    hint: 'Gebrabbel statt Sprachausgabe (Daniel, 19.11.2026: „so wie bei Graveyard Keeper, die Sims … dass sie sich unterscheiden von Charakter zu Charakter“). Alles aus Code: der echte Text gibt nur den Rhythmus, seine Vokale die Klangfarbe; „?“ hebt die Stimme, „!“ macht sie lauter. Figuren wählen eine Stimme (Feld „Stimme“), Leute aus der Crew und Fremde bekommen eine aus dem Vorrat.',
    template: { name: 'Neue Stimme', style: 'human', pitch: 180, range: 6, speed: 9, formant: 100, breath: 15, rasp: 0, vibrato: 10, volume: 100, pool: true },
    row: x => `${label(VOICE_STYLES, x.style)} · ${x.pitch ?? 180} Hz · ${x.speed ?? 9} Silben/s${x.pool ? ' · Vorrat' : ''}`,
    sections: [{ title: 'Stimme', fields: [NAME, select('style', 'Stil', VOICE_STYLES, { required: true }), DESCRIPTION, bool('pool', 'Im Vorrat', { hint: 'Crew-Leute, Gangs und Fremde ohne eigene Stimme bekommen eine aus dem Vorrat ihres Stils (fest nach dem Namen)' }),
        text('sample', 'Probesatz', { hint: 'Was der Knopf „Vorhören“ sagt' })] },
      { title: 'Klang', fields: [num('pitch', 'Tonhöhe', { unit: 'Hz', min: 40, max: 900, hint: 'Männer um 110, Frauen um 210, Kinder 300+' }), num('range', 'Melodie', { unit: 'Halbtöne', min: 0, max: 24 }),
        num('speed', 'Tempo', { unit: 'Silben/s', min: 2, max: 25 }), num('formant', 'Kopfgröße', { unit: '%', min: 50, max: 200, hint: 'Verschiebt die Vokale: unter 100 groß und dumpf, über 100 klein und hell' }),
        num('breath', 'Hauchig', { unit: '%', min: 0, max: 100 }), num('rasp', 'Kratzig', { unit: '%', min: 0, max: 100 }), num('vibrato', 'Vibrato', { unit: '%', min: 0, max: 100 }), num('volume', 'Lautstärke', { unit: '%', min: 0, max: 200 })] }],
  },
  sounds: {
    name: 'Ton-Ereignisse', singular: 'Ton-Ereignis', icon: 'loudspeaker', file: 'data/sounds.json', kind: 'catalog', groupBy: { key: 'kind', options: SOUND_KINDS },
    hint: '#130: jeder Effekt-Ton im Spiel (Hieb, Treffer, Schritte, Beute, Menüs, Jingles). Bis ein produzierter Ton da ist, spielt ein Platzhalter aus Code (Rezept). Sobald unter „Produziert“ ein Asset der Art Ton steht, spielt das, ohne Code-Änderung. Die ID ist der Name, unter dem das Spiel den Ton auslöst (Liste: docs/sounds.md).',
    template: { name: 'Neues Ton-Ereignis', kind: 'world', recipe: 'ping', volume: 100, pitch: 100, vary: 50, cooldown: 0, priority: 'b' },
    row: x => `${label(SOUND_KINDS, x.kind)} · ${x.samples?.length ? `produziert (${x.samples.length})` : `Code: ${label(SFX_RECIPES, x.recipe) || x.recipe || '–'}`}${x.mute ? ' · stumm' : ''}`,
    sections: [{ title: 'Ereignis', fields: [NAME, select('kind', 'Art', SOUND_KINDS, { required: true }), DESCRIPTION, text('trigger', 'Auslöser', { hint: 'Wo im Code der Ton kommt (Datei:Zeile), für die Liste' }),
        select('priority', 'Priorität', SOUND_PRIORITIES, { hint: 'Für die Produktion: A zuerst' }), area_('notes', 'Für die Produktion', { hint: 'Wie der echte Ton klingen soll (Länge, Material, Stimmung)' })] },
      { title: 'Klang', fields: [select('recipe', 'Platzhalter aus Code', SFX_RECIPES, { hint: 'Spielt, solange kein produzierter Ton da ist' }),
        refs('samples', 'Produziert', 'assets', { hint: 'Assets der Art Ton; mehrere = zufällig einer. Leer = Platzhalter aus Code' }),
        num('volume', 'Lautstärke', { unit: '%', min: 0, max: 300 }), num('pitch', 'Tonhöhe', { unit: '%', min: 25, max: 400, hint: '100 = wie gebaut' }),
        num('vary', 'Schwankt um', { unit: 'Cent ±', min: 0, max: 1200, hint: 'Jedes Mal ein wenig anders (100 Cent = ein Halbton)' }), num('cooldown', 'Höchstens alle', { unit: 'ms', min: 0, hint: 'Kommt der Ton öfter, bleibt er still' }),
        bool('mute', 'Stumm'), select('replaces', 'Ersetzt Code-Ton', SFX_LEGACY.map(x => [x, label(SFX_RECIPES, x)]), { hint: 'Ältere Töne aus dem Bau-Modus und den Meldungen: dieses Ereignis spielt statt ihrer' })] },
      { title: 'Untergrund (Schritte)', when: x => x.kind === 'move', fields: [refs('terrains', 'Auf Kachel-Sets', 'terrain', { hint: 'Schritte auf diesen Kachel-Sets klingen so' }),
        bool('rig', 'Im Rig und am Van', { hint: 'Schritte im Camp über dem Boden (Container, Treppen, Deck)' }), bool('stepDefault', 'Sonst überall', { hint: 'Wenn kein anderer Schritt passt' })] }],
    check: (x, report, p) => {
      for (const a of x.samples || []) if (p.data.assets?.[a] && p.data.assets[a].kind !== 'sound') report('error', `„${a}“ ist kein Ton`);
      if (!x.recipe && !(x.samples || []).length) report('warning', 'Weder Platzhalter noch produzierter Ton: bleibt still');
    },
  },
  decor: {
    name: 'Deko', singular: 'Deko-Stück', icon: 'star', file: 'data/decor.json', kind: 'catalog', groupBy: { key: 'place', options: DECOR_PLACES },
    hint: '#036 (Daniel: „das Dekosystem“): Kosmetik fürs Camp, beim Händler im Bau-Modus kaufen und in der Welt platzieren. Keine Werte, nur Gemütlichkeit (stärkere Buffs beim Schlafen und Ausruhen, Camp › Deko).',
    template: { name: 'Neues Deko-Stück', art: 'neon', place: 'wall', value: 20, cozy: 1, size: [2, 1] },
    row: x => `${label(DECOR_ARTS, x.art)} · ${label(DECOR_PLACES, x.place)} · ${x.value ?? 0} Δ${x.cozy ? ` · +${x.cozy} Gemütlichkeit` : ''}`,
    sections: [{ title: 'Deko', fields: [NAME, select('art', 'Art', DECOR_ARTS), select('place', 'Sitzt', DECOR_PLACES), VALUE, num('cozy', 'Gemütlichkeit', { min: 0 }), DESCRIPTION] },
      { title: 'Aussehen', fields: [size('size', 'Größe', { unit: 'Kacheln', hint: 'Breite × Höhe; bei Zelt und Segel: Höhe = wie tief es hängt' }), color('color', 'Farbe'), text('colors', 'Farben', { hint: 'Mehrere mit Komma (Wäsche, Streifen)' }),
        text('text', 'Text', { hint: 'Neon, Banner, Graffiti; mehrere mit | (zufällig je Ort)' }), ref('addon', 'Ausschnitt von', 'rigAddons', { hint: 'Art „Ausschnitt“: das Bild dieses Anbauteils' }),
        refs('items', 'Fundstücke', 'items', { hint: 'Art „Kiste mit Fundstücken“: diese Symbole' }), ref('look', 'Symbol-Raster', 'assets', { hint: 'Art „Bild aus einem Symbol-Raster“: aus diesem Raster … Auch für Neon (Rahmen, Feld = Symbol), Zeltstange (Varianten), Turm und Balkon (Bild; Haken = Plattform bzw. Boden, beim Turm x = Leiter)' }), num('icon', 'Symbol', { min: 0, hint: '… dieses Feld (0 = erstes); Höhe = Größe-Höhe' }), num('growDays', 'Wächst in Tagen', { min: 1, hint: 'Pflanze: Tage je Stufe' })] },
      { title: 'Baukasten', fields: [
        num('scale', 'Maßstab', { unit: '%', min: 10, hint: '#111 Art „Bild mit Varianten“: 100 = so groß wie gemalt (PixelLab malt in Spielgröße, Leyla 170 cm = 192 px)' }),
        num('variant', 'Start-Variante', { min: 0, hint: 'Welches Feld zuerst kommt (0 = erstes); so teilen sich zwei Stücke ein Raster' }),
        bool('flip', 'Darf gespiegelt werden', { hint: 'Jedes platzierte Stück würfelt Variante und Richtung' }),
        bool('growStages', 'Wächst (Felder = Stufen)', { hint: 'Statt zu würfeln: Feld 1, 2, 3 … nach „Wächst in Tagen“' }),
        select('carry', 'Tragfläche', DECOR_CARRY, { hint: 'Kann man etwas draufstellen? Oberkante des Bilds (Kisten) oder in fester Höhe (Tisch)' }),
        num('top', 'Höhe der Tragfläche', { unit: 'Bildpixel', min: 0, hint: 'Bei „in fester Höhe“: vom Boden bis zur Platte' }),
        bool('stack', 'Lässt sich draufstellen', { hint: 'Darf auf anderen Stücken mit Tragfläche stehen' }),
        text('tags', 'Tags', { hint: 'Mit Komma, z. B. „feuer, licht“. Nachbarn und Ensembles erkennen Stücke daran' }),
        table('likes', 'Mag Nachbarn', [text('tag', 'Tag'), num('cozy', 'Bonus', { min: 0 })], { hint: 'Steht ein Stück mit diesem Tag nah dabei (Camp › Deko › Nachbarn bis), gibt es den Bonus. Nie Abzüge (Dorfromantik)' }),
        text('faces', 'Dreht sich zu', { hint: 'Tag: das Stück schaut zum nächsten Stück mit diesem Tag (der Stuhl zum Feuer). Das Bild schaut nach rechts' }),
        bool('linkLights', 'Lichterkette zu Nachbarn', { hint: 'Zwei solche Stücke nah beieinander spannen von selbst eine Lichterkette (Camp › Deko › Lichterkette bis)' }),
        point('hook', 'Haken', { unit: 'Bildpixel', hint: 'Wo die Lichterkette bzw. das Licht sitzt (von oben links im Feld)' }),
        select('extra', 'Effekt', DECOR_EXTRAS, { hint: 'Aus Code: Flammen, Licht, Dampf, Rotor am Haken' }),
        text('lightVariants', 'Effekt nur bei Varianten', { hint: 'Mit Komma, 1 = erste (z. B. nur Kerze und Öllampe im Tischkram); leer = alle' }),
        table('hooks', 'Haken je Variante', [point('at', 'Haken', { unit: 'Bildpixel' })], { hint: 'Zeile 1 = Variante 1 …; leer = der Haken oben' }),
        num('rotor', 'Rotor-Länge', { unit: 'Bildpixel', min: 4 }),
        select('use', 'Benutzen', DECOR_USES, { hint: 'E am Stück' }), text('useHint', 'Knopf-Text', { hint: 'Ausruhen: z. B. „Dösen“' }), num('heal', 'Heilt', { unit: '%', min: 0 }),
        point('areaAt', 'Zettel-Fläche oben links', { unit: 'Bildpixel', hint: 'Schwarzes Brett (#128): wo die Auftrags-Zettel hängen' }), size('areaSize', 'Zettel-Fläche Größe', { unit: 'Bildpixel' }),
        bool('matchWall', 'Nimmt die Farbe des Containers an', { hint: '#114 Wand-Module: das Stück Wellblech im Bild wird wie der Container gestrichen' }), bool('foot', 'Steht unten an der Wand', { hint: 'Türen und Tore: auf dem Boden des Containers statt in zwei Höhen' }),
        bool('crows', 'Lockt Krähen an', { hint: 'Wie das Vogelhaus: Krähen sitzen darauf und auf Ecken' }), bool('shadow', 'Schatten am Boden', { hint: 'Aus = kein Kontaktschatten (Standard: an)' })] },
      { title: 'Wachsen', fields: [   // #116 (Daniel: „Dinge wie Laterne so designen, dass man die Ziehen-Funktion benutzen kann“)
        select('insideRow', 'Innen: Reihe', DECOR_INSIDE_ROWS, { hint: '#118 Nur bei „Im Container“: Decke und Boden nur in freien Plätzen, Rückwand auch hinter Werkstätten' }),
        select('grow', 'Ziehen zum Wachsen', DECOR_GROW, { hint: 'Im Bau-Modus am goldenen Griff ziehen. Höhe: Kopf + Mittelstücke + Fuß; Breite: Enden + Abschnitte (und etwas Höhe); Stapel: mehr Stück übereinander' }),
        range('growRange', 'Stufen', { hint: 'Wie viele Mittelstücke (bzw. Abschnitte, Kisten) mindestens und höchstens' }), num('growStart', 'Stufe beim Kaufen', { min: 0 }),
        range('growRange2', 'Höhen-Stufen', { hint: 'Nur „Breite“: wie oft das Wand-Band (Mittelstück y) zusätzlich höher macht, 1 = wie gemalt' }), num('growStart2', 'Höhen-Stufe beim Kaufen', { min: 0 }),
        table('slices', 'Mittelstück je Variante', [num('y0', 'Zeile ab'), num('y1', 'bis'), num('x0', 'Spalte ab'), num('x1', 'bis')], { hint: 'Bildpixel im Feld (tools/camp_modules.py schreibt sie). Zeile 1 = Variante 1; eine Zeile gilt für alle' }),
        num('growLight', 'Licht je Stufe', { unit: '%', min: 0, hint: 'Ein höherer Pfosten leuchtet weiter' }),
        num('growView', 'Weitblick je Stufe', { unit: '%', min: 0, hint: 'Turm: oben zoomt die Kamera je Etage so viel weiter raus' })] }],
    // art and place must go together, else the camp cannot draw or anchor it (Aufräumen 16.11.2026)
    check: (x, report) => {
      const need = { ladder: ['climb'], stairs: ['climb'], pole: ['ground'], tower: ['ground'], balcony: ['side'], bridge: ['span'], tent: ['span'], sail: ['span'], line: ['span'], hammock: ['span'], pennants: ['span'], canopy: ['span'] }[x.art];
      if (need && !need.includes(x.place)) report('error', `Art „${label(DECOR_ARTS, x.art)}“ geht nur ${need.map(p => label(DECOR_PLACES, p)).join(' / ')}`);
      if (x.place === 'span' && need == null && x.art) report('warning', `Art „${label(DECOR_ARTS, x.art)}“ hängt nicht zwischen zwei Punkten`);
      if (x.art === 'sprite' && !x.look) report('error', 'Bild mit Varianten braucht ein Symbol-Raster');
      if (x.carry === 'fixed' && !x.top) report('warning', 'Tragfläche in fester Höhe ohne Höhe');
      if ((x.grow === 'up' || x.grow === 'side') && !x.slices?.length && x.art !== 'ladder') report('error', 'Wachsen braucht ein Mittelstück (Zeilen bzw. Spalten)');
      if (x.place === 'free' && x.art !== 'sprite') report('warning', '„Frei“ ist für Bilder mit Varianten gedacht');
    },
  },
  decorSets: {
    name: 'Ensembles', singular: 'Ensemble', icon: 'particles', file: 'data/decor_sets.json', kind: 'catalog',
    hint: '#111 Camp-Baukasten (Daniel 19.11.2026: „wie Dorfromantik: wenn Tiles zusammenpassen, gibt es einen Bonus, aber keine Nachteile“). Stehen die Stücke mit diesen Tags nah beieinander (auf dem Boden oder demselben Dach, auch gestapelt), entsteht das Ensemble: Name, Funkeln und Gemütlichkeit obendrauf.',
    template: { name: 'Neues Ensemble', within: 6, cozy: 3, needs: [{ tag: 'feuer', count: 1 }] },
    row: x => `${(x.needs || []).map(n => `${n.count ?? 1}× ${n.tag}`).join(' + ')} · +${x.cozy ?? 0} Gemütlichkeit`,
    sections: [{ title: 'Ensemble', fields: [NAME, DESCRIPTION, table('needs', 'Braucht', [text('tag', 'Tag'), num('count', 'Anzahl', { min: 1 })], { hint: 'Tags aus RIG › Deko › Baukasten' }),
      num('within', 'Innerhalb', { unit: 'Kacheln', min: 1 }), num('cozy', 'Gemütlichkeit', { min: 0 })] }],
    check: (x, report, p) => {
      const tags = new Set(Object.values(p?.data?.decor || {}).flatMap(d => String(d.tags || '').split(',').map(t => t.trim()).filter(Boolean)));
      for (const n of x.needs || []) if (n.tag && !tags.has(n.tag)) report('warning', `Kein Deko-Stück hat den Tag „${n.tag}“`);
    },
  },
  pixelOrders: {
    name: 'Pixel-Aufträge', singular: 'Pixel-Auftrag', icon: 'brush', file: 'data/pixel_orders.json', kind: 'catalog', lookOptional: true, noSets: true, groupBy: { key: 'status', options: PIXEL_STATUS },
    hint: 'Grafik-Wünsche an Claude (NomadPixel, Daniel 19.11.2026): rechts Schritt für Schritt ausfüllen, speichern, dann in Claude Code „/pixel Aufträge“. Die fertigen Grafiken erscheinen als Assets im Auftrag.',
    template: { name: 'Neuer Pixel-Auftrag', type: 'icons', status: 'open', size: [32, 32] },
    row: x => `${label(PIXEL_TYPES, x.type)} · ${label(PIXEL_STATUS, x.status)}${x.motifs?.length ? ` · ${x.motifs.length} Motive` : ''}`,
    sections: [
      { title: 'Auftrag', fields: [NAME, select('type', 'Art', PIXEL_TYPES, { required: true }), select('status', 'Status', PIXEL_STATUS, { required: true }),
        area_('brief', 'Was gebraucht wird', { hint: 'Wofür, wo im Spiel, Stimmung, Must-haves' }), lines('motifs', 'Motive', { hint: 'eine Zeile je Grafik, z. B. „Angelrute“' })] },
      { title: 'Format', fields: [size('size', 'Größe', { unit: 'px', hint: 'je Grafik bzw. Feld; Symbole 32 × 32' }), size('grid', 'Raster', { unit: 'Felder', hint: 'Spalten × Zeilen bei Symbolen/Kacheln' }),
        num('frames', 'Frames', { min: 1, hint: 'nur bei Animationen' }), num('variants', 'Varianten', { min: 1, max: 3, hint: 'Entwürfe je Motiv zur Auswahl' }), text('view', 'Ansicht', { hint: 'z. B. frontal, diagonal, von der Seite' })] },
      { title: 'Vorlage', fields: [refs('references', 'Vorbilder', 'assets', { hint: 'Stil-Vorbilder oder Foto (Asset der Art Referenz)' }), ref('target', 'Ziel-Raster', 'assets', { hint: 'bestehendes Symbol-Raster, in dessen freie Felder die Grafiken sollen' })] },
      { title: 'Ergebnis', fields: [refs('results', 'Ergebnis-Assets', 'assets'), area_('answer', 'Antwort von Claude'), text('date', 'Erledigt am'),
        ref('favorite', 'Favorit', 'assets', { hint: 'bei Varianten: die gewählte' }), select('feedback', 'Rückmeldung', [['ok', 'Passt'], ['change', 'Nachbessern']]),
        area_('feedbackNote', 'Was soll anders werden?'), bool('learned', 'Ins Lernbuch übernommen')] },
    ],
    check: (x, report) => {
      if (!x.brief && !x.motifs?.length) report('hint', 'Beschreibung oder Motive fehlen');
      if (x.status === 'done' && !x.results?.length) report('warning', 'Fertig, aber ohne Ergebnis-Assets');
    },
  },
  people: {
    name: 'Leute', icon: 'humans', file: 'data/people.json', kind: 'single',
    hint: '#085 Crew-Kern (Die Karawane, design.md): Bausteine für gewürfelte Siedler, ihre Fähigkeiten (Jobs an Werkstätten) und Eigenheiten. Kernfiguren wie Schraube und Onkel Sung stehen unter Companions.',
    sections: [
      { title: 'Namen und Herkunft', fields: [lines('first', 'Vornamen', { hint: 'eine Zeile je Name' }), lines('nick', 'Beinamen', { hint: '„Rost“, „Doc“ … (60 % bekommen einen)' }), lines('origins', 'Herkunft', { hint: 'ein Satz je Zeile' })] },
      { title: 'Fähigkeiten', fields: [table('skills', 'Fähigkeiten', [text('id', 'ID'), text('name', 'Name'), text('functions', 'Werkstatt-Funktionen', { hint: 'mit Komma, z. B. kitchen,foodtruck' }),
        select('stat', 'Wirkt auf', [['perfect', 'Perfekt kochen %'], ['refund', 'Zutat zurück %'], ['sleepHeal', 'Schlaf heilt %'], ['rest', 'Ruhe %'], ['growth', 'Wachstum %'], ['power', 'Strom ⚡'], ['sell', 'Mehr Δ aus Runs %'], ['loot', 'Extra-Beute %'], ['fuel', 'Spritersparnis %']]),
        num('perLevel', 'Je Stufe'), text('description', 'Beschreibung')], { hint: 'eine Person mit Job an einer Werkstatt dieser Funktion bringt Stufe × „Je Stufe“ in den Boni-Bus' }),
        size('skillsPer', 'Fähigkeiten je Person', { hint: 'von – bis' })] },
      { title: 'Eigenheiten', fields: [table('traits', 'Eigenheiten', [text('id', 'ID'), text('name', 'Name'), bool('hidden', 'Verborgen'), num('weight', 'Gewicht', { min: 0 }), text('effect', 'Wirkung'), text('description', 'Beschreibung')],
        { hint: 'jede Person hat eine sichtbare und eine verborgene; die verborgene zeigt sich nach „Aufdecken nach“ Tagen. Wirkungen auf Moral kommen mit der Rig-Moral' })] },
      { title: 'Aufnahme', fields: [num('fireChance', 'Bewerber am Feuer', { unit: '% je Ankunft', min: 0, max: 100 }), num('fireFromDay', 'Bewerber ab Tag', { min: 1, hint: 'der Ruf muss sich erst herumsprechen' }), num('revealDays', 'Verborgene Eigenheit nach', { unit: 'Tagen', min: 1 })] },
      { title: 'Moral', fields: [   // #100 Rig-Moral (design.md › Rig-Moral + Eigenheiten), leer = Standardwert
        num('morale.base', 'Grundstimmung', { min: 0, max: 100, hint: 'Leer = 50. Darauf kommen die Quellen; die Moral wandert pro Tag Ereignis-Zeit zum Ergebnis' }), num('morale.drift', 'Wandert je Tag', { min: 1, max: 100, hint: 'Leer = 15 Punkte' }),
        num('morale.bed', 'Ein Bett für jeden', { hint: 'Leer = +10' }), num('morale.noBed', 'Je fehlendes Bett', { hint: 'Leer = −12' }),
        num('morale.food', 'Vorräte reichen', { hint: 'Leer = +8 (Feinschmecker zählen doppelt)' }), num('morale.hunger', 'Vorräte knapp', { hint: 'Leer = −15' }), num('morale.foodPer', 'Reicht ab Rationen je Kopf', { min: 0, hint: 'Leer = 2' }),
        num('morale.water', 'Zisterne', { hint: 'Leer = +5' }), num('morale.fun', 'Chill-Ecke', { hint: 'Leer = +10' }), num('morale.cheer', 'Je Frohnatur', { hint: 'Leer = +5' }),
        num('morale.safe', 'Bewaffnet', { hint: 'Leer = +8 (Waffenkammer oder Rig-Waffe; Angsthasen zählen doppelt)' }), num('morale.danger', 'Je Gefahrenstufe am Ort über 1', { hint: 'Leer = −4' }),
        num('morale.crowd', 'Je Kopf mehr als Werkstatt-Plätze', { hint: 'Leer = −5 (Einzelgänger zählen doppelt)' }), num('morale.thief', 'Je Hamster (verborgen)', { hint: 'Leer = −5' }),
        num('morale.high', 'Hochstimmung ab', { min: 0, max: 100, hint: 'Leer = 75' }), num('morale.tense', 'Stabil ab', { min: 0, max: 100, hint: 'Leer = 40, darunter angespannt' }), num('morale.crisis', 'Angespannt ab', { min: 0, max: 100, hint: 'Leer = 20, darunter Krise' }),
        num('morale.jobHigh', 'Jobs in Hochstimmung', { unit: '%', hint: 'Leer = +25' }), num('morale.jobTense', 'Jobs angespannt', { unit: '%', hint: 'Leer = −25 (in der Krise bringen Jobs nichts)' }), num('morale.leave', 'Krise: jemand geht', { unit: '% je Tag', min: 0, max: 100, hint: 'Leer = 30' })] },
    ],
  },
  companions: {
    name: 'Companions', singular: 'Companion', icon: 'humans', file: 'data/companions.json', kind: 'catalog',
    hint: 'Leben im Rig, betreiben Werkstätten, geben Buffs und Rezept-Tipps. Eigene Quests kommen in Ausbaustufe 2.',
    template: { name: 'Neuer Companion', role: '', workshops: [], buffs: [], tips: [], stage: '1' },
    row: x => x.role || '',
    sections: [
      { title: 'Companion', fields: [NAME, LOOK, ref('voice', 'Stimme', 'voices', { hint: 'Gebrabbel im Dialog (Werkstatt › Stimmen). Leer = eine Stimme aus dem Vorrat, nach dem Namen gewählt' }), ref('portrait', 'Porträt', 'assets', { hint: 'Kopf in Nahaufnahme für den Dialog (#025). Leer = Initialen in der Farbe des Companions' }), text('role', 'Rolle'), STAGE, DESCRIPTION] },
      { title: 'Im Rig', fields: [bool('passenger', 'Fährt als Gast mit', { hint: 'Braucht beim Fahren einen freien Platz in einer Gästekoje (Werkstatt-Funktion Gäste, Kapazität = Betten), sonst bleibt der Companion am Ort und wartet dort' }), refs('workshops', 'Betreibt', 'workshops'), refs('buffs', 'Gibt Buffs', 'buffs'), refs('tips', 'Kennt Rezepte', 'recipes')] },
      { title: 'Im Camp', fields: [lines('lines', 'Sprüche', { hint: 'Eine Zeile pro Spruch, erscheint als Bläschen (zufällig und per E)' }),
        lines('craftLines.hit', 'Beim Kochen/Craften: Treffer', { hint: 'Sagt der Companion, wenn an seiner Werkstatt etwas gelingt (eine Zeile pro Spruch)' }),
        lines('craftLines.miss', 'Beim Kochen/Craften: Fehlschlag'),
        color('color', 'Platzhalter-Farbe', { hint: 'Solange es kein Aussehen gibt, steht hier eine Figur aus Code' }), num('height', 'Größe', { unit: 'px', min: 40 })] },
    ],
  },

  camp: {
    name: 'Camp', icon: 'tracks', file: 'data/camp.json', kind: 'single',
    hint: 'Das Camp vor und nach jedem Run: Leyla läuft im Side-Scroll durchs Camp und ins aufgeschnittene Rig (wie ein Puppenhaus) und benutzt die Werkstätten mit E. Zeit springt nur bei Aktionen (Ereignis-Zeit). Grafik vorerst aus Code, Aussehen der Container und Werkstätten rastet später ein.',
    sections: [
      { title: 'Platz', fields: [NAME, num('campWidth', 'Camp rechts vom Van', { unit: 'Kacheln', min: 8, hint: 'Freifläche mit Lagerfeuer und Companions' }), num('margin', 'Rand links vom Rig', { unit: 'Kacheln', min: 2 }),
        num('height', 'Höhe', { unit: 'Kacheln', min: 8 }), ref('ground.tiles', 'Boden-Kacheln', 'assets', { hint: 'Asset der Art Kacheln, Frames: 0 Oberfläche, 1 Füllung, 2 Kante mit Wand links, 3 Säule, 4 Wand links, 5 Wand rechts, 6 und 7 Oberfläche mit Gras. Leer = Erde aus Code' }), ref('ground.strip', 'Boden-Streifen (fein)', 'assets', { hint: 'Bild, das sich waagrecht nahtlos wiederholt (#084), ×1 scharf. Ankerpunkt y = Zeile der Lauffläche. Hat Vorrang vor den Boden-Kacheln; Schacht-Kanten zeichnet der Code' }), color('ground.deep', 'Tiefe unter dem Streifen', { hint: 'Fels unterhalb des Boden-Streifens' }),
        color('ground.color', 'Boden'), color('ground.top', 'Bodenkante'), color('ground.far', 'Ebene in der Ferne'), num('horizon', 'Horizont', { unit: '%', min: 20, max: 95, hint: 'Vom oberen Bildschirmrand' }), DESCRIPTION] },
      { title: 'Rand', fields: [   // #117 (Daniel: „das Camp soll nach unten, links und rechts nicht im Nichts enden“)
        num('edge.ground', 'Boden über den Rand', { unit: 'Kacheln', min: 0, hint: 'So weit laufen die Boden-Kacheln links und rechts über die Welt hinaus' }),
        num('edge.fade', 'Dunkelheit unten', { unit: 'px', min: 50, hint: 'Unter dem Boden: Erde, die in dieser Tiefe schwarz wird (wie in den POIs)' }),
        ref('edge.egg', 'Easter Egg', 'assets', { hint: 'Ein Bild tief unter dem Camp, kaum zu sehen; spielt nie eine Rolle' }), num('edge.eggAt', 'Easter Egg bei', { unit: 'Kacheln ab dem Lagerplatz' }),
        num('edge.eggScale', 'Easter Egg: Maßstab', { unit: '%', min: 10 }), num('edge.eggAlpha', 'Easter Egg: Sichtbarkeit', { unit: '%', min: 0, max: 100 })] },
      { title: 'Schrottplatz', fields: [bool('yard.enabled', 'Zeigen', { hint: 'Daniel: Lager beim Bauen = Schrottplatz links beim Schacht. Ausgebaute Werkstätten stehen auf Paletten, abgehängte Anhänger parken dahinter' }),
        num('yard.width', 'Breite', { unit: 'Kacheln', min: 4 }), bool('yard.dealer', 'Händler-Platz', { hint: 'Hier abstellen = verkaufen; Gekauftes wird hier geliefert' }), text('yard.dealerName', 'Name am Schild'),
        num('yard.dealerWidth', 'Breite Händler-Platz', { unit: 'px', min: 80 }), num('yard.palletScale', 'Werkstätten auf Paletten', { unit: '% Größe', min: 20, max: 100, hint: 'Noch ohne Wirkung: verpackte Werkstätten stehen als Kisten auf dem Schrottplatz' }), num('yard.partScale', 'Rig-Teile im Regal', { unit: '% Größe', min: 20, max: 200 }),
        num('yard.parkScale', 'Geparkte Anhänger', { unit: '% Größe', min: 20, max: 100 })] },
      { title: 'Verpackte Werkstätten', fields: [ref('yard.crate.look', 'Kiste', 'assets', { hint: 'Ausgebaute Werkstätten liegen auf dem Schrottplatz verpackt in Kisten. Grafik der Kiste mit Label; leer = Platzhalter aus Code' }),
        num('yard.crate.height', 'Höhe', { unit: 'px', min: 40 }), point('yard.crate.labelAt', 'Label Mitte', { unit: 'Bildpixel', hint: 'Wo auf der Kiste das Label sitzt; dort steht der Name der Werkstatt' }), size('yard.crate.labelSize', 'Label Größe', { unit: 'Bildpixel' }),
        num('yard.crate.fontSize', 'Schriftgröße', { unit: 'px', min: 8 }), color('yard.crate.ink', 'Schriftfarbe')] },
      { title: 'Schacht', fields: [bool('shaft.enabled', 'Zeigen', { hint: 'Daniel: Andeutung eines Schachts nach unten, links im Camp, nicht betretbar' }), num('shaft.at', 'Ab Spalte', { unit: 'Kacheln', min: 1 }),
        num('shaft.width', 'Breite', { unit: 'Kacheln', min: 1 }), color('shaft.color', 'Dunkelheit'), color('shaft.glow', 'Glühen von unten', { hint: 'Leer = nichts' }), num('shaft.frameHeight', 'Förderturm', { unit: 'px', min: 0, hint: 'Holzgerüst mit Rolle und Seil über dem Schacht, 0 = keins' })] },
      { title: 'Fahrgestell', fields: [ref('chassis.look', 'Teile', 'assets', { hint: 'Daniels modularer Anhänger: ein Bild mit Deichsel + Rahmen, Mittelstück, Achse und Heck nebeneinander (Deichsel links). Das Camp setzt daraus für jeden Container mit „Auf Fahrgestell“ eins in seiner Länge zusammen, Deichsel zum Van' }),
        num('chassis.res', 'Auflösung', { min: 1, max: 4, hint: '#084: wie viel feiner die Teile gemalt sind als die Container (2 = doppelt so viele Pixel). Alle Bildpixel-Angaben hier gelten im Teile-Bild' }),
        range('chassis.drawbar', 'Deichsel', { unit: 'Bildpixel x', hint: 'von – bis (bis = erste Spalte danach)' }), range('chassis.beam', 'Rahmen vorn', { unit: 'Bildpixel x', hint: 'Rahmen hinter der Deichsel; davon kommt so viel dazu, wie zur Containerlänge fehlt' }),
        range('chassis.middle', 'Mittelstück', { unit: 'Bildpixel x', hint: 'wird wiederholt, bis das Fahrgestell so lang ist wie der Container' }), range('chassis.axle', 'Achse', { unit: 'Bildpixel x' }), range('chassis.rear', 'Heck', { unit: 'Bildpixel x' }),
        range('chassis.rows', 'Höhe', { unit: 'Bildpixel y', hint: 'Ladefläche (oben, darauf steht der Container) bis unter die Räder (Boden)' }), num('chassis.couple', 'Kupplung auf', { unit: 'Bildpixel y' }), num('chassis.beamRows', 'Träger dahinter', { unit: 'Bildpixel', min: 0, hint: 'So viele Zeilen von oben aus dem Mittelstück liegen als durchgehender Träger hinter dem ganzen Fahrgestell und füllen die Lücken zwischen den Teilen. 0 = aus' }),
        num('chassis.frontMin', 'Rahmen vorn mindestens', { unit: 'Bildpixel', min: 0, hint: 'Bei zwei Achsen: so viel Rahmen bleibt vorn, der Rest kommt als Mittelstücke zwischen die Achsen' }),
        num('chassis.axles.1', 'Achsen bei 1 Platz', { min: 1, max: 3 }), num('chassis.axles.2', 'Achsen bei 2 Plätzen', { min: 1, max: 3 }), num('chassis.axles.3', 'Achsen bei 3 Plätzen', { min: 1, max: 3 })] },
      { title: 'Gemütlichkeit', fields: [
        table('deco', 'Deko ums Feuer', [ref('look', 'Bild', 'assets'), num('x', 'x', { unit: 'px' }), num('y', 'y', { unit: 'px' }), num('scale', 'Maßstab', { step: 0.1 }), bool('flip', 'Gespiegelt'), bool('front', 'Vor Leyla')],
          { hint: 'Daniel, 13.11.2026: „cosy, wenig Test-Charakter“. x/y relativ zum Lagerfeuer (Boden), Maßstab der Bildpixel' }),
        ref('stairs.look', 'Klapptreppe', 'assets', { hint: 'Aufstieg vom Boden in Container im Erdgeschoss (statt der Leiter aus Code), Leyla klettert wie auf einer Leiter' }),
        num('stairs.landing', 'Treppe: Podest oben', { unit: 'Bildpixel y', min: 0, hint: 'Diese Zeile des Bilds liegt auf Höhe des Containerbodens' }), num('stairs.feet', 'Treppe: Füße', { unit: 'Bildpixel y', min: 1 }), num('stairs.at', 'Treppe: Podest-Mitte', { unit: 'Bildpixel x', min: 0 }),
        num('mood.vignette', 'Dunkler Rand', { unit: '%', min: 0, max: 100 }), num('mood.warm', 'Warmes Licht', { unit: '%', min: 0, max: 100, hint: 'Warmer Schimmer übers Camp abends und nachts' }),
        num('mood.fireflies', 'Glühwürmchen', { min: 0, max: 60, hint: 'Abends und nachts um das Feuer' }), bool('mood.smoke', 'Rauch aus dem Ofenrohr', { hint: 'Steigt aus Außenwänden mit Küche' })] },
      { title: 'Horizont', fields: [num('epic.milkyWay', 'Milchstraße', { unit: '%', min: 0, max: 100, hint: 'Daniel, 13.11.2026: „ein wenig epischer, mehr wie im Intro“. Nachts ein Sternenband quer über den Himmel, 0 = aus' }),
        num('epic.cityAt', 'BigCityDelta bei', { unit: '× Breite', min: 0, max: 1, step: 0.01 }), num('epic.cityHeight', 'BigCityDelta Höhe', { unit: '% Bildhöhe', min: 5, max: 50 }),
        color('epic.city', 'Stadt'), color('epic.cityRim', 'Stadt Lichtkante'), color('epic.farRidge', 'Ferne Berge'), color('epic.farRim', 'Ferne Berge Kante'), color('epic.nearRidge', 'Nahe Hügel'), color('epic.nearRim', 'Nahe Hügel Kante')] },
      { title: 'Regen', fields: [bool('rain.enabled', 'Regen im Camp', { hint: 'Daniel, 13.11.2026: „Regen füllt sie“ (#014). An manchen Tagen regnet es ein paar Stunden (gewürfelt aus Tag und Spielstand, gleicher Spielstand = gleiches Wetter); die Zisterne füllt sich dann schneller' }),
        num('rain.chance', 'Regentage', { unit: '%', min: 0, max: 100, hint: 'Wie oft ein Tag einen Schauer hat' }), range('rain.hours', 'Dauer', { unit: 'h', hint: 'Von … bis Stunden' }),
        ref('rain.look', 'Regen wie bei', 'weather', { hint: 'Von diesem Wetter kommt der Regen (Menge, Farbe, Winkel); der Himmel bleibt der der Tageszeit' })] },
      { title: 'Lichterketten', fields: [bool('lights.enabled', 'Lichterketten', { hint: 'Daniel, 13.11.2026: „Mach an den Container-Ecken Andockpunkte und lass den Spieler die Lichterketten selbst ziehen“. Im Bau-Modus von Andockpunkt zu Andockpunkt ziehen (oder zweimal klicken), Klick auf die Mitte einer Kette nimmt sie ab (ein Teil vom Preis zurück)' }),
        num('lights.max', 'Höchstens', { min: 0, max: 30 }), num('lights.sag', 'Durchhang', { unit: 'px', min: 0, max: 80, hint: 'Dazu hängen lange Ketten 7 % ihrer Länge durch' }), num('lights.spacing', 'Lampen alle', { unit: 'px', min: 12 }),
        text('lights.colors', 'Farben', { hint: 'Mit Komma getrennt, z. B. #ffd541, #e86a73, #20d6c7' }), num('lights.price', 'Preis', { unit: 'Δ', min: 0 }),
        num('lights.back', 'Zurück beim Abnehmen', { unit: '%', min: 0, max: 100, hint: 'Anteil vom Preis, den man beim Abnehmen zurückbekommt' }),
        bool('lights.mast', 'Mast am Lagerfeuer', { hint: 'Daniel, 13.11.2026: ein Mast am Feuer als zusätzlicher Andockpunkt (#014)' }),
        num('lights.mastOffset', 'Mast neben dem Feuer', { unit: 'px', hint: 'Abstand zur Feuermitte, negativ = links' }), num('lights.mastHeight', 'Mast-Höhe', { unit: 'px', min: 60 })] },
      { title: 'Solar & Akku', fields: [ref('solar.look', 'Solarpaneel', 'assets'), num('solar.power', 'Strom je Paneel', { unit: '⚡', min: 0, step: 0.5, hint: 'Tagsüber' }),
        num('solar.battery', 'Akku je Paneel', { unit: '⚡·h', min: 0, hint: 'Daniel: tagsüber + Akku. Überschuss am Tag lädt den Akku, nachts liefern die Paneele aus dem Akku, bis er leer ist' }),
        range('solar.day', 'Sonne von – bis', { unit: 'Uhr' }), num('solar.price', 'Preis', { unit: 'Δ', min: 0 }), num('solar.weight', 'Gewicht', { unit: 'kg', min: 0 })] },
      { title: 'Rig-Ansicht', fields: [num('rig.placeWidth', 'Breite pro Platz', { unit: 'Kacheln', min: 2 }), num('rig.outsideScale', 'Maßstab Außenwand', { unit: '×', min: 0.5, step: 0.1, hint: 'Clutter an den Container-Außenwänden (Werkstätten › Außenwand)' }), num('rig.height', 'Raumhöhe', { unit: 'px', min: 200 }), num('rig.benchScale', 'Maßstab der Werkstatt-Bilder', { unit: '× Bildpixel', min: 0, step: 0.01, hint: 'Alle Werkstatt-Bilder im Rig gleich groß gepixelt (1 = ein Bildpixel ist ein Spielpixel). Leer oder 0 = jedes Bild passt sich in seinen Platz ein' }), num('rig.gap', 'Abstand zwischen Containern', { unit: 'Kacheln', min: 0, hint: 'Nur für den Platz, den das Rig im Camp freihält; Anhänger aus Code hängen mit der Deichsel aneinander' }),
        num('rig.open.near', 'Öffnet in der Nähe', { unit: 'px', min: 0, hint: 'Container mit „Aussehen geschlossen“ blenden auf, wenn Leyla höchstens so weit links oder rechts davon ist (und auf seiner Etage). 0 = nur wenn sie davor steht' }),
        num('rig.open.fade', 'Aufblenden dauert', { unit: 'ms', min: 0 }), num('rig.open.lights', 'Licht bei geschlossen', { unit: '%', min: 0, max: 100, hint: 'Wie viel vom Raumlicht durch die geschlossene Hülle scheint' }),
        num('rig.lift', 'Boden über der Straße', { unit: 'px', min: 20, hint: 'Anhänger aus Code: so hoch steht der Boden auf dem Fahrgestell' }), num('rig.drawbar', 'Deichsel', { unit: 'px', min: 40, hint: 'Anhänger aus Code: Länge der Deichsel bis zur Kupplung' }),
        bool('rig.roofWalk', 'Dächer begehbar', { hint: 'Daniel 19.11.2026: auf jedem freien Container-Dach eine Plattform wie „=“ (von unten durchspringen, S + Leertaste fällt runter). Aus = nur Balkone, Brücken, Turm' }),
        num('rig.trunkAt', 'Kofferraum bei', { unit: '%', min: 0, max: 100, hint: 'E-Punkt für den Stauraum der Zugmaschine (öffnet das Camp-Lager, #041), von links über die Breite des Vans' }),
        bool('rig.groundLadder', 'Leiter ins Erdgeschoss', { hint: 'Daniel, 13.11.2026: ohne Doppelsprung braucht jeder erhöhte Container im Erdgeschoss ein paar Sprossen vom Boden. Aus = keine' }),
        num('rig.groundLadderAt', 'Leiter ins Erdgeschoss bei', { unit: '%', min: 0, max: 100, hint: 'Von links über den Innenraum des Containers; Standard 92 = am hinteren Ende, damit sie nicht neben der Leiter zum Stapel steht' }),
        num('rig.ladderAt', 'Leiter zum Stapel bei', { unit: '%', min: 0, max: 100, hint: 'Wo die Leiter in einen gestapelten Container hochführt: von links über die Breite des Anhängers darunter; liegt sie neben dem Container oben, rückt sie unter seinen Boden' }),
        num('rig.sameFloor', 'Werkstatt: gleiche Ebene bis', { unit: 'px', min: 0, hint: 'E-Punkt und Arbeitsmodus einer Werkstatt gelten nur, wenn Leylas Füße höchstens so weit über oder unter dem Boden ihres Containers sind. Leer = 40' }), num('rig.reachUp', 'E-Punkte unten bis', { unit: 'px', min: 50, hint: 'Steht Leyla höher über dem Boden (z. B. im oberen Container oder auf dem Van-Dach), gelten die E-Punkte unten nicht' }),
        color('rig.wall', 'Wand'), color('rig.inside', 'Innen'), color('rig.light', 'Licht'), bool('rig.labels', 'Namen anzeigen')] },
      { title: 'Boden im Innenraum', fields: [num('rig.floor.depth', 'Bodentiefe', { unit: 'px', min: 0, hint: 'Für Werkstatt-Bilder mit leichter Draufsicht (low top-down): ein Streifen Boden mit Tiefe vor der Rückwand, auf dem die hinteren Füße stehen. Nur in Containern mit „Boden zeichnen“. 0 = aus' }),
        num('rig.floor.inset', 'Werkstätten nach hinten', { unit: 'px', min: 0, hint: 'So weit stehen die Werkstatt-Bilder hinter der Bodenkante, an der Leyla läuft' }),
        color('rig.floor.color', 'Bodenfarbe'), num('rig.floor.seam', 'Fugen alle', { unit: 'px', min: 0, hint: 'Senkrechte Fugen im Bodenblech, 0 = keine' })] },
      { title: 'Lagerfeuer', fields: [bool('fire.enabled', 'Zeigen'), ref('fire.look', 'Aussehen', 'assets', { hint: 'Animation, Ankerpunkt = Mitte am Boden. Leer = Flammen aus Code' }), num('fire.at', 'Abstand vom Van', { unit: 'Kacheln', min: 1 }),
        num('fire.radius', 'Lichtradius', { unit: 'px', min: 0 }), color('fire.color', 'Lichtfarbe'), num('fire.strength', 'Lichtstärke', { unit: '%', min: 0, max: 200, hint: 'Bei Licht 100 % der Tageszeit' }),
        num('fire.pool', 'Lichtkegel am Boden', { unit: 'px', min: 0, hint: 'Breite des warmen Scheins auf dem Boden, 0 = aus' }), num('fire.flicker', 'Flackern', { unit: '%', min: 0, max: 100 }), num('fire.lift', 'Lichtmitte über dem Boden', { unit: 'px', min: 0 })] },
      { title: 'Ofen im Mega-Rig', fields: [ref('fire.stove.look', 'Aussehen', 'assets', { hint: '#098 (Daniel 19.11.2026: „Kein Lagerfeuer IM Rig mehr“ → „Ofen statt Feuer“): im Hauptcontainer eines Mega-Rigs steht statt des Lagerfeuers ein Ofen. Bild mit Ankerpunkt Mitte am Boden; leer = gusseiserner Ofen aus Code' }),
        num('fire.stove.radius', 'Ofen: Lichtradius', { unit: 'px', min: 0, hint: 'Leer = 60 % des Lagerfeuers' }), num('fire.stove.pipe', 'Ofen: Rohr nach oben', { unit: 'px', min: 0, hint: 'Leer = 260' })] },
      { title: 'Am Feuer sitzen', fields: [ref('fire.sit.look', 'Animation', 'assets', { hint: 'Daniel: Leyla sitzt am Feuer und zockt, gespiegelt je nach Seite. E setzt sie hin, E oder Laufen steht auf' }),
        num('fire.sit.distance', 'Abstand zum Feuer', { unit: 'px', min: 0 }), num('fire.sit.downTo', 'Hinsetzen bis Frame', { min: 1 }), range('fire.sit.loop', 'Schleife Frames'),
        num('fire.sit.upFrom', 'Aufstehen ab Frame', { min: 1 }), refs('fire.sit.sounds', 'Töne beim Zocken', 'assets', { hint: 'Daniel: zufällig verketten, leise, klein und weit weg. Laufen, solange sie zockt' }),
        range('fire.sit.soundGap', 'Abstand zwischen Tönen', { unit: 'ms' }), num('fire.sit.soundPause', 'Längere Pause', { unit: '%', min: 0, max: 100, hint: 'Wie oft nach einem Ton 1–3 s Ruhe kommen' }), num('fire.sit.soundVolume', 'Lautstärke', { unit: '%', min: 0, max: 100 }), num('fire.sit.fps', 'Tempo', { unit: 'fps', min: 1 }), num('fire.sit.minSeconds', 'Zeit vergeht ab', { unit: 's', min: 0, hint: 'Wer so lange sitzt, bekommt beim Aufstehen „Am Feuer sitzen“ (Zeit + Heilen)' })] },
      { title: 'Licht aus dem Van', fields: [bool('vanLight.enabled', 'Zeigen', { hint: 'Abends und nachts (Licht % der Tageszeit) quillt Licht aus der offenen Schiebetür' }), color('vanLight.color', 'Farbe'),
        num('vanLight.strength', 'Stärke', { unit: '%', min: 0, max: 200 }), num('vanLight.width', 'Breite in der Tür', { unit: 'px', min: 10 }), num('vanLight.height', 'Höhe in der Tür', { unit: 'px', min: 10 }),
        num('vanLight.lift', 'Mitte über dem Boden', { unit: 'px', min: 0 }), num('vanLight.pool', 'Lichtkegel am Boden', { unit: 'px', min: 0 }), num('vanLight.spill', 'Kegel versetzt', { unit: 'px' })] },
      { title: 'Camp-Lager', fields: [text('storage.name', 'Name', { hint: '#041: Kofferraum und alle Lagerregale bilden zusammen EIN Lager; die Regale bestimmen nur das Volumen. Speziallager (Werkstätten › Speziallager) bleiben eigene Inventare' }),
        num('storage.width', 'Breite des Rasters', { unit: 'Felder', min: 4, max: 16, hint: 'Die Höhe ergibt sich aus der Summe der Felder; die letzte Reihe ist nur so weit offen, wie Felder da sind' })] },
      { title: 'Kiste (in POIs)', fields: [ref('chest.look', 'Aussehen', 'assets', { hint: 'Kisten in den POI-Leveln. Animation: erster Frame zu, letzter offen. Die Kiste im Camp gibt es seit #041 nicht mehr (ihr Inhalt zog ins Camp-Lager)' })] },
      { title: 'Kleinvieh', fields: [table('critters', 'Tiere', [ref('look', 'Animation', 'assets'), range('every', 'Alle', { unit: 's' }), num('speed', 'Tempo', { unit: 'px/s', min: 20 }), num('night', 'Abends öfter', { unit: '×', min: 1 }), text('idles', 'Idles', { hint: 'Asset-IDs (Komma): bleibt in der Bildmitte stehen und spielt eine davon' }), num('stopChance', 'Bleibt stehen', { unit: '%', min: 0, max: 100 })],
        { hint: '#107 (Daniel 19.11.2026: der Fennek huscht durchs Camp): ab und zu läuft ein Tier über den Camp-Boden, von einem Bildrand zum anderen. Die Animation schaut nach rechts, nach links wird sie gespiegelt' })] },
      { title: 'Ton', fields: [ref('sound.wind', 'Wind', 'assets', { hint: 'Läuft leise in Schleife' }), num('sound.windVolume', 'Wind-Lautstärke', { unit: '%', min: 0, max: 100 }),
        refs('sound.gusts', 'Böen', 'assets', { hint: 'Kommen ab und zu dazu, zufällig' }), range('sound.gustEvery', 'Böen alle', { unit: 's' }), num('sound.gustVolume', 'Böen-Lautstärke', { unit: '%', min: 0, max: 100 }),
        ref('sound.fire', 'Lagerfeuer', 'assets', { hint: 'Wird lauter, je näher Leyla den Flammen kommt, und klingt von links oder rechts' }), num('sound.fireVolume', 'Feuer ganz nah', { unit: '%', min: 0, max: 100 }),
        num('sound.fireMin', 'Feuer von weitem', { unit: '%', min: 0, max: 100 }), num('sound.fireRange', 'Hörweite', { unit: 'px', min: 50 }), num('sound.fireNear', 'Voll ab', { unit: 'px', min: 0, hint: 'Näher als das: volle Lautstärke' }),
        ref('sound.music', 'Musik', 'assets', { hint: 'Läuft leise im Hintergrund in Schleife (Leyla Theme). Lädt erst, wenn das Camp steht. M schaltet allen Ton aus' }), num('sound.musicVolume', 'Musik-Lautstärke', { unit: '%', min: 0, max: 100, hint: 'Dezent: um 15' }), num('sound.cassetteDelay', 'Kassette nach', { unit: 'ms', min: 0, hint: '#129: die Now-Playing-Kassette kommt erst nach dem Willkommen' }),
        num('sound.musicFadeIn', 'Musik einblenden', { unit: 's', min: 0, hint: 'So lange wird sie beim Betreten des Camps lauter' })] },
      { title: 'Farben', fields: [lines('paint.colors', 'Farben', { hint: '#114 Farbe wie Townscaper: der Pinsel im Bau-Modus (P). Eine Farbe je Zeile (#rrggbb, am besten aus AAP-64)' }),
        num('paint.keepSat', 'Bunt bleibt ab', { unit: '% Sättigung', min: 0, max: 100, hint: 'Pixel, die bunter sind (Warnstreifen, Rost, Schilder), behalten ihre Farbe' }), num('paint.strength', 'Deckkraft', { unit: '%', min: 0, max: 100 })] },
      { title: 'Container-Kacheln', fields: [ref('containers.tiles', 'Kacheln', 'assets', { hint: '#113: das Kachelbild (oben offen, unten zu): linkes Ende | ein Platz | rechtes Ende, je 4 px Abstand (tools/container_tiles.py)' }),
        size('containers.ends', 'Enden', { unit: 'px', hint: 'Breite linkes und rechtes Ende' }), num('containers.step', 'Ein Platz', { unit: 'px', min: 1 }), num('containers.rows', 'Zeilen je Kachel', { unit: 'px', min: 1 }),
        num('containers.top', 'Oberkante im Frame', { unit: 'px', min: 0 }), num('containers.frame', 'Frame-Höhe', { unit: 'px', min: 1 }),
        num('containers.height', 'Höhe', { unit: '%', min: 100, max: 250, hint: 'Daniel, 19.11.2026: „Die Container könnten größer sein, sie erscheinen mir niedrig“. Die Wand wächst in der Mitte (Band unten), Werkbänke bleiben gleich groß' }),
        range('containers.band', 'Wiederholtes Band', { unit: 'Kachelzeilen', hint: 'Diese Zeilen der Wand werden für die Höhe wiederholt (senkrechte Rillen: nahtlos)' }), num('containers.inner', 'Innenhöhe', { unit: 'Bildpixel', min: 1, hint: 'Bezug für die Höhe in %' })] },
      { title: 'Deko', fields: [num('decor.max', 'Höchstens', { min: 1, hint: '#036: so viele Deko-Stücke im Camp' }), num('decor.back', 'Zurück beim Verkaufen', { unit: '%', min: 0, max: 100 }),
        num('decor.cozyMax', 'Gemütlichkeit wirkt bis', { unit: '%', min: 0, hint: 'Jeder Punkt Gemütlichkeit macht die Buffs von Schlafen und Ausruhen 1 % stärker, höchstens so viel' }),
        range('decor.ground', 'Boden von – bis', { unit: 'Kacheln ab dem Lagerplatz', hint: 'Wo Boden-Deko stehen darf (negativ = Richtung Rig)' }),
        num('decor.homeMin', 'Wohnen ab', { unit: 'Innen-Stücke', min: 1, hint: '#118 So viele Innen-Deko-Stücke machen einen freien Platz zur Wohnzelle' }), num('decor.homeCozy', 'Wohnen: Bonus', { unit: 'Gemütlichkeit', min: 0 }),
        num('decor.rear', 'Hinter dem Rig', { unit: 'Kacheln', min: 0, hint: '#117 Platz für Deko hinter dem letzten Container; sie wandert mit, wenn das Rig länger wird (das Camp ist so viel länger)' }),
        num('decor.stackMax', 'Stapel höchstens', { min: 1, hint: '#111: so viele Stücke übereinander' }), num('decor.near', 'Nachbarn bis', { unit: 'Kacheln', min: 0, step: 0.5, hint: 'Mag-Nachbarn und „Dreht sich zu“ wirken bis hier' }),
        num('decor.linkMax', 'Lichterkette bis', { unit: 'Kacheln', min: 1, hint: 'Pfosten mit „Lichterkette zu Nachbarn“ verbinden sich bis zu diesem Abstand' }),
        num('decor.mossDays', 'Moos nach', { unit: 'Tagen', min: 0, hint: '#111 Auto-Details: Moos wächst am Fuß von Stücken, die so lange stehen (0 = nie)' }),
        num('decor.ivyDays', 'Ranken nach', { unit: 'Tagen', min: 0, hint: 'Ranken klettern an Kisten und Tischen neben Pflanzen hoch, jeden Tag ein Stück' }),
        ref('decor.cat', 'Katze', 'assets', { hint: 'Symbol-Raster mit Katzen; eine je Spielstand' }), text('decor.catName', 'Name der Katze'),
        num('decor.catCozy', 'Katze ab Gemütlichkeit', { min: 0, hint: 'So gemütlich muss das Camp sein, damit sie kommt' })] },
      { title: 'Schwarzes Brett', fields: [bool('board.enabled', 'Schwarzes Brett', { hint: 'Daniel, 15.11.2026 (#025): am Van Aufträge annehmen, abgeben und Belohnungen einsammeln, zentral für alle Companions. Bei ihnen direkt geht es weiter. Später eine Werkbank, die fertige Aufträge gegen bessere Belohnungen tauscht' }),
        text('board.name', 'Name'), num('board.offset', 'Abstand zum Feuer', { unit: 'px', hint: 'Negativ = links vom Feuer, Richtung Van. −220 = am Mast' }),
        num('board.lift', 'Oberkante über dem Boden', { unit: 'px', min: 60 }), num('board.width', 'Breite', { unit: 'px', min: 60 }), num('board.height', 'Höhe', { unit: 'px', min: 40 }),
        ref('board.decor', 'Als Deko', 'decor', { hint: '#128: das Brett ist ein Deko-Stück, das man im Bau-Modus umsetzt; jeder Spielstand bekommt einmal eins geschenkt (vor dem Feuer). Leer = festes Brett' }), num('board.at', 'Geschenktes Brett bei', { unit: 'Kacheln ab dem Lagerplatz' }),
        ref('board.look', 'Bild', 'assets', { hint: '#084: gemaltes Brett, Füße auf dem Ankerpunkt. Leer = Brett aus Code (dann gelten Oberkante, Breite, Höhe)' }), num('board.scale', 'Maßstab', { unit: '%', min: 10 }),
        point('board.areaAt', 'Zettel-Fläche oben links', { unit: 'Bildpixel' }), size('board.areaSize', 'Zettel-Fläche Größe', { unit: 'Bildpixel' })] },
      { title: 'Companions', fields: [range('companions.at', 'Stehen von – bis', { unit: 'Kacheln vom Van' }), range('companions.barkEvery', 'Sprüche alle', { unit: 's' }), num('companions.barkTime', 'Bläschen zeigen', { unit: 's', min: 1 })] },
      { title: 'Zeit', fields: [num('clock.startDay', 'Start-Tag', { min: 1 }), num('clock.startHour', 'Start-Uhrzeit', { unit: 'h', min: 0, max: 23.99, step: 0.25 }),
        num('clock.arriveHour', 'Ankunft im Camp um', { unit: 'h', min: 0, max: 23.99, step: 0.25, hint: 'Daniel: „Camp startet immer in der Dämmerung“. Beim Laden, nach einem Run und nach dem Fahren springt die Uhr vor bis zu dieser Uhrzeit. Leer = Uhr läuft nur mit den Aktionen' }),
        num('clock.wakeHour', 'Aufwachen um', { unit: 'h', min: 0, max: 23 }), num('clock.runHours', 'Ein Run dauert', { unit: 'h', min: 0, step: 0.25 }),
        num('clock.fireHours', 'Am Feuer sitzen', { unit: 'h', min: 0, step: 0.25 })] },
      { title: 'Tag & Nacht', fields: [table('daytime', 'Tageszeiten', [num('from', 'Ab Uhr'), ref('weather', 'Wetter', 'weather'), num('shade', 'Abdunkeln %', { min: 0, max: 90 }), num('light', 'Licht %', { min: 0, max: 100 }), text('name', 'Name')],
        { hint: 'Ab dieser Uhrzeit gilt die Zeile (bis zur nächsten). Abdunkeln legt die Nacht über die Welt; Licht = wie stark Lagerfeuer und Fenster scheinen (tagsüber 0)' })] },
      { title: 'Heilen', fields: [num('heal.sleep', 'Schlafen', { unit: '%', min: 0, max: 100 }), num('heal.fire', 'Am Feuer', { unit: '%', min: 0, max: 100 }), num('heal.afterKo', 'Nach k.o.', { unit: '%', min: 1, max: 100, hint: 'Mit so viel Leben bringt AvA Leyla zurück' }), select('koReturn', 'k.o. im Run', [['', 'AvA bringt Leyla an den Run-Start (Tank zahlt)'], ['camp', 'Zurück ins Camp (wie früher)']], { hint: 'Ohne Cryo-Tank immer zurück ins Camp' })] },
      { title: 'Bedienen', fields: [num('interactRange', 'E-Reichweite', { unit: 'px', min: 20 }), ref('fallbackRoom', 'Ersatzraum', 'rooms', { hint: 'Für POIs, deren Raum-Bausteine noch kein Layout haben' })] },
    ],
    check: (x, report, p) => {
      const rows = [...(x.daytime || [])].sort((a, b) => (a.from ?? 0) - (b.from ?? 0));
      if (!rows.length) report('warning', 'Keine Tageszeiten: das Camp nimmt das erste Wetter');
      for (const r of rows) if (r.weather && !p.data.weather?.[r.weather]) report('error', `Wetter ${r.weather} fehlt`);
      if (x.fallbackRoom && !p.data.rooms?.[x.fallbackRoom]?.layout?.length) report('warning', 'Ersatzraum hat kein Layout');
    },
  },

  tank: {
    name: 'Cryo-Tank', icon: 'heart', file: 'data/tank.json', kind: 'single',
    hint: 'Daniel, 12.11.2026: AvA ist ein kleines Mädchen, ihr Körper liegt im Cryo-Tank, ihr Verstand ist in der Drohne geparkt. Der Tank verfällt in Ereignis-Zeit, immer schneller; Wartung = Rezepte an der Werkstatt mit Funktion Cryo-Tank (Rezepte › Oder Tank-Wartung). Jede Rettung beim k.o. kostet Zustand, ist er zu niedrig, stirbt AvA bei der letzten Rettung. Ohne Pflege etwa 10 Runs.',
    sections: [
      { title: 'Tank', fields: [bool('enabled', 'An'), ref('workshop', 'Werkstatt', 'workshops', { hint: 'Steht von Anfang an im kleinsten Container, auch in alten Spielständen' }), ref('container', 'Im Container', 'containers'),
        num('start', 'Zustand am Anfang', { unit: '%', min: 1, max: 100 }), text('deadName', 'Name, wenn tot'), DESCRIPTION] },
      { title: 'Verfall', fields: [num('rate', 'Grundrate', { unit: '% je Stunde', min: 0, hint: 'Verfall je Stunde Ereignis-Zeit bei vollem Tank' }),
        num('accel', 'Beschleunigung', { min: 0, hint: 'Je schlechter der Zustand, desto schneller: × (1 + Beschleunigung × (100 − Zustand) / 100)' }),
        num('aging', 'Alterung', { unit: 'je Tag', min: 0, hint: 'Je länger der Durchgang dauert, desto schneller: × (1 + Tage × Alterung)' }),
        num('rescue', 'Rettung kostet', { unit: '%', min: 0, max: 100, hint: 'Beim k.o.; liegt der Zustand darunter, ist es die letzte Rettung' })] },
      { title: 'Phasen', fields: [table('phases', 'Phasen', [text('name', 'Name'), num('from', 'ab Zustand', { unit: '%', min: 0, max: 100 }), ref('look', 'Aussehen', 'assets'),
        num('battery', 'AvA: Akku −', { unit: '%', min: 0, max: 100 }), num('glitch', 'AvA: Glitches', { unit: '%', min: 0, max: 100 }), num('flicker', 'AvA: Scheinwerfer flackert', { unit: '%', min: 0, max: 100 }),
        ref('anim', 'Schleife', 'assets', { hint: 'Animation genau über dem Bild (gleiche Größe)' }), ref('hand', 'Hand', 'assets', { hint: 'Bild der Phase mit ihrer Hand am Glas, wird ab und zu weich eingeblendet' }), text('status', 'Anzeige'), num('face', 'Gesicht', { min: 0, hint: 'Frame aus den Gesichtern der Drohne' })], { hint: 'Von oben nach unten: die erste Zeile, deren „ab“ der Zustand erreicht. Danach „tot“ bei 0 %' }),
        ref('deadLook', 'Aussehen tot', 'assets')] },
      { title: 'Anzeige', fields: [point('screen.text', 'Text-Anzeige Mitte', { unit: 'Bildpixel' }), size('screen.textSize', 'Text-Anzeige Größe', { unit: 'Bildpixel' }), color('screen.color', 'Textfarbe'),
        point('screen.face', 'Gesicht Mitte', { unit: 'Bildpixel' }), num('screen.faceScale', 'Gesicht Maßstab', { unit: '%', min: 10 }),
        area_('screen.lines', 'Zeilen im Wechsel', { hint: 'Eine Zeile je Absatz; {zustand}, {phase}, {tage}, {stunden} werden ersetzt' })] },
      { title: 'Traum (neuer Durchgang)', fields: [lines('dream.lines', 'Zeilen', { hint: 'Ist AvA tot, beginnt ein neuer Durchgang: diese Zeilen erscheinen nacheinander auf Schwarz, die letzte groß. Leer = Standard' }),
        num('dream.seconds', 'Dauer', { unit: 's', min: 2 })] },
      { title: 'Leben im Tank', fields: [point('glass.at', 'Glas oben links', { unit: 'Bildpixel' }), size('glass.size', 'Glas Größe', { unit: 'Bildpixel' }), num('bubbles', 'Bläschen', { unit: 'je Sekunde', min: 0 }), color('glow', 'Leuchten'),
        num('heartEvery', 'Herz ans Glas malen alle', { unit: 's', min: 0, hint: 'Ab Phase 2 (beschlagen) malt ein Finger von innen ein Herz in die beschlagene Scheibe' }), num('handEvery', 'Hand am Glas alle', { unit: 's', min: 0, hint: 'Bild je Phase unter Phasen › Hand' }),
        num('love', 'AvA verliebt bis', { unit: 'px', min: 0, hint: 'So nah am Tank zeigt die Drohne ihr liebevolles Gesicht' })] },
    ],
  },

  build: {
    name: 'Rig-Bau', icon: 'build', file: 'data/build.json', kind: 'single',
    hint: 'Rig bauen direkt im Camp (B oder Warroom › Rig umbauen): die Kamera zoomt raus, Werkstätten und Anhänger zieht man mit der Maus (sie pendeln und rasten mit Klonk ein), jede Aktion zählt sofort (Δ und Zeit), Leyla läuft hin und schraubt, „Rückgängig“ solange sie nicht fertig ist. Schrottplatz und Händler-Platz beim Schacht (Camp › Schrottplatz). Preise = Wert der Werkstätten und Container. Budgets: Gewicht gegen Zugkraft, Anzahl Anhänger gegen „Plätze hintereinander“ der Zugmaschine, Energie.',
    sections: [
      { title: 'Kaufen & Verkaufen', fields: [multi('stages', 'Kaufbar', [['mvp', 'MVP'], ['1', 'Stufe 1'], ['2', 'Stufe 2']], { hint: 'Werkstätten dieser Ausbaustufen stehen im Laden' }),
        num('sellFactor', 'Verkaufen bringt', { unit: '% vom Wert', min: 0, max: 100 })] },
      { title: 'Zeit', fields: [num('minutes.move', 'Werkstatt umstellen', { unit: 'min', min: 0 }), num('minutes.buy', 'Kaufen und anliefern', { unit: 'min', min: 0 }),
        num('minutes.container', 'Container an-/abhängen', { unit: 'min', min: 0, hint: 'Auch beim Umsortieren' }),
        num('minutes.part', 'Rig-Teil an-/abschrauben', { unit: 'min', min: 0, hint: 'An den Sockeln am Van im Bau-Modus' }),
        num('minutes.stack', 'Container stapeln', { unit: 'min', min: 0, hint: 'Einen Container auf einen Anhänger oder Container setzen (Abnehmen kostet „Container an-/abhängen“)' })] },
      { title: 'Bau-Modus', fields: [num('view.minZoom', 'Kleinster Zoom', { unit: '%', min: 10, max: 100, hint: 'B zoomt so weit raus, dass Schrottplatz, Rig und Van ins Bild passen, aber nicht weiter' }),
        num('view.groundAt', 'Boden auf Höhe', { unit: '% vom Bild', min: 40, max: 95 }), num('view.zoomTime', 'Zoom dauert', { unit: 'ms', min: 0 }),
        num('view.swing', 'Pendeln', { unit: '%', min: 0, max: 300, hint: 'Wie stark ein Teil an der Maus schwingt (schwere Teile schwingen träger)' }),
        num('view.snap', 'Ankuppeln ab', { unit: 'px', min: 40, hint: 'So nah muss ein Anhänger an eine Kupplung' }),
        num('view.shake', 'Wackeln beim Einrasten', { unit: '%', min: 0, max: 200 }), num('view.volume', 'Lautstärke der Bau-Töne', { unit: '%', min: 0, max: 100 }),
        num('view.cursorSpeed', 'Bau-Cursor: Tempo (Controller, Tastatur)', { unit: 'px/s', min: 100, max: 4000, hint: 'Gehalten ab 450 ms fast doppelt so schnell' }),
        num('view.signalSide', 'AvA Funkreichweite: seitlich', { unit: 'px', min: 0, max: 4000, hint: '#121: so weit über Hof und Deko-Boden hinaus, dann unsichtbare Wand (Standard 900)' }),
        num('view.signalUp', 'AvA Funkreichweite: nach oben', { unit: 'px', min: 400, max: 8000, hint: 'Über dem Boden (Standard 2600); nach unten endet sie am Boden' }),
        num('view.signalWarn', 'AvA Funkreichweite: Warnung ab', { unit: 'px', min: 0, max: 1000, hint: 'So weit vor dem Rand erscheint das rote ! (Standard 260)' }),
        range('view.zoomSteps', 'Zoom-Stufen: Rig / Detail', { unit: '% des Spiel-Zooms', hint: '#117 Dazu die Übersicht (alles im Bild). Mausrad, LT / RT, + / −' }),
        bool('grid.enabled', 'Bau-Raster um AvA', { hint: '#116 Scan-Raster wie die Boden-Leiste: zeigt, wo man bauen kann; aus = nur die Marken' }),
        num('grid.cell', 'Bau-Raster: Zelle', { unit: '% einer Kachel', min: 10, max: 200 }), num('grid.radius', 'Bau-Raster: Reichweite', { unit: 'Kacheln', min: 1, max: 20 }), num('grid.alpha', 'Bau-Raster: Deckkraft', { unit: '%', min: 0, max: 100 }),
        bool('view.leylaFire', 'Leyla setzt sich ans Feuer', { hint: 'Daniel, 12.11.2026: „im Bau-Modus nur noch die Drohne steuern, Leyla setzt sich ans Feuer“. AvA erledigt dann auch das Werkeln' }),
        bool('view.droneBuilds', 'AvA trägt die Teile', { hint: 'Sie fliegt dem Zeiger bzw. Bau-Cursor nach, ein gepacktes Teil hängt unter ihr' }),
        num('view.droneAbove', 'AvA über dem Zeiger', { unit: 'px', min: 0 }), num('view.droneFollow', 'AvA folgt', { unit: '%', min: 1, max: 100, hint: 'Wie schnell sie dem Zeiger folgt' })] },
      { title: 'Werkeln', fields: [bool('work.enabled', 'Leyla werkelt', { hint: 'An: nach jedem Einrasten läuft Leyla hin und schraubt, „Rückgängig“ nur, solange sie nicht fertig ist. Aus (Daniel, 09.11.2026): alles sofort, „Rückgängig“ für jede Aktion bis „Fertig“' }), num('work.seconds', 'Leyla schraubt', { unit: 's', min: 0, hint: 'Nach jedem Einrasten läuft sie hin und schraubt so lange; solange sie nicht fertig ist, geht „Rückgängig“' }),
        num('work.perHour', 'Dazu pro Stunde Bauzeit', { unit: 's', min: 0 })] },
      { title: 'Rig-Teile am Van', fields: [
        point('sockets.engine', 'Motor', { unit: '%', hint: 'Mitte des Sockels: x = % der Van-Breite von links, y = % der Van-Höhe über dem Boden. Mehrere Slots derselben Art stehen nebeneinander' }),
        point('sockets.armor', 'Panzerung', { unit: '%' }), point('sockets.weapon', 'Waffe', { unit: '%' }), point('sockets.roof', 'Dach', { unit: '%' }),
        size('sockets.size', 'Sockel-Größe', { unit: 'px' }),
        multi('sockets.visible', 'Im Camp sichtbar', [['engine', 'Motor'], ['armor', 'Panzerung'], ['weapon', 'Waffe'], ['roof', 'Dach']], { hint: 'Eingebaute Teile dieser Slots sieht man auch außerhalb des Bau-Modus am Van' })] },
      { title: 'Regeln', fields: [bool('rules.power', 'Ohne Strom keine Arbeit', { hint: 'Ist die Energie unter 0, gehen Werkstätten, die Energie brauchen, im Camp nicht (Kochen, Werkbank …)' }),
        bool('rules.weight', 'Zu schwer: nicht fahren', { hint: 'Wiegen die Container mehr, als die Zugmaschine zieht, bleibt das Rig stehen' })] },
    ],
  },

  pois: {
    name: 'POIs', singular: 'POI', icon: 'building', file: 'data/pois.json', kind: 'catalog', groupBy: { key: 'kind', options: POI_KINDS },
    hint: 'Orte zum Plündern. Hybrid gebaut: handgebaute Räume werden prozedural zusammengesetzt.',
    template: { name: 'Neuer POI', kind: 'gasStation', size: 'S', danger: 1, rooms: [], enemies: [], parTime: 120, secrets: 1 },
    row: x => `${label(POI_KINDS, x.kind)} · ${x.size} · Gefahr ${'●'.repeat(x.danger || 0)}`,
    sections: [
      { title: 'POI', fields: [NAME, LOOK, select('kind', 'Art', POI_KINDS), select('size', 'Größe', POI_SIZES), num('danger', 'Gefahr', { min: 1, max: 5 }), DESCRIPTION] },
      { title: 'Aufbau', fields: [range('roomCount', 'Räume', { hint: 'Wie viele Räume zusammengesetzt werden' }), refs('rooms', 'Raum-Bausteine', 'rooms'), refs('enemies', 'Gegner', 'enemies', { hint: 'Für das Zeichen 1 im Layout: ein zufälliger dieser Gegner' }), ref('loot', 'Kisten-Beute', 'lootTables', { hint: 'Für Kisten (C) in den Räumen' }), ref('vault', 'Tresor-Beute', 'lootTables', { hint: 'Liegt im Tresor am Ziel (Z), ein guter Rang stellt die Bonus-Kiste daneben (Ranking › Bonus-Kiste, #141). Leer = Tabelle „tresor“' })] },
      { title: 'Gang', fields: [text('gang.name', 'Name', { hint: '#016: Wem dieser Ort gehört. Steht beim Betreten als Toast („Revier der …“)' }), text('gang.color', 'Gang-Farbe', { hint: 'Name einer Gang-Farbe aus dem Gegner-Bausatz (Magenta, Cyan, Orange, Gelb, Blutrot). Alle Plünderer aus dem Bausatz tragen hier diese Farbe (nicht Mutanten, nicht der Boss)' }), area_('gang.motto', 'Spruch'), text('gang.rivals', 'Rivalen', { hint: '#089 Revierkrieg: Namen anderer Gangs (Komma), gilt in beide Richtungen. Ruf bei der einen kostet Ruf bei der anderen; Straßen zwischen ihren Orten werden Fronten' })] },
      { title: 'Fundstücke', fields: [table('treasure', 'Fundstücke', [ref('item', 'Ding', 'items'), select('where', 'Wo', [['vault', 'im Tresor'], ['chest', 'in einer Kiste']]), num('chance', 'Chance', { unit: '%', min: 1, max: 100 })],
        { hint: '#057 Schatzsuche: ein bestimmtes Ding liegt hier, einmal je Durchgang und nur, solange Leyla es nicht hat (z. B. ein Kartenstück im Tresor)' })] },
      { title: 'KI-Terminal', fields: [text('terminalAi', 'Terminal-KI', { hint: '#057: Name einer Entity aus Entities › Unikate; sie wohnt im KI-Terminal (@ im Raum-Baustein). Glitch-Duell optional, gewonnen = sie zieht ins Cyberdeck (einmal je Spielstand)' })] },
      { title: 'Level', fields: [text('curve', 'Spannungskurve', { hint: 'Intensität in % vom Eingang bis zum Ausgang, mit Komma, z. B. „30, 70, 20, 85, 100“: so wahrscheinlich wird ein Zufallsgegner (1) in einem Raum auf dem Hauptweg gesetzt; unter 50 % nur die schwächere Hälfte der Gegner, ab 85 % die zähere. Seitenräume halb so laut. Leer = jede 1 ist ein Gegner' }), num('branchChance', 'Abzweige', { unit: '%', min: 0, max: 100, hint: 'Chance je Abzweig-Haken (A in der Decke eines Hauptraums), dass ein Seitenraum (Merkmal Beute/Geheimnis, A im Boden) darüber hängt. Leer = 60' }),
        select('stack', 'Aufbau', [['', 'Nebeneinander (Hauptweg von links nach rechts)'], ['tower', 'Turm: vom Eingang nach oben'], ['deep', 'Tiefe: vom Eingang nach unten']], { hint: '#038: Turm/Tiefe stapelt die Haupträume übereinander: A im Boden des oberen Raums sitzt über A in der Decke des unteren, eine Leiter verbindet sie. Seitenräume (Beute/Geheimnis) stehen neben einem Hauptraum auf derselben Etage. Die Abkürzung ist ein Schacht neben dem Stapel mit einer Tür unten, die nur von der anderen Seite aufgeht' }),
        bool('shortcut', 'Abkürzung zum Van', { hint: 'Nebeneinander: Tunnel unter allen Räumen, v im Boden des Ausgangs → ^ im Boden des Eingangs. Turm/Tiefe: Schacht mit Leiter neben dem Stapel. Aus = keine Abkürzung. Leer = an' }),
        ref('tunnelTerrain', 'Kachel-Set im Tunnel', 'terrain', { hint: 'Wände und Rückwand der Abkürzung. Leer = Kachel-Set des Eingangs' }),
        ref('tunnelAtmosphere', 'Atmosphäre im Tunnel', 'atmosphere', { hint: 'Licht und Stimmung der Abkürzung. Leer = Atmosphäre des Kachel-Sets im Tunnel' }),
        num('seed', 'Fester Seed', { min: 0, hint: 'Zum Testen: immer dasselbe Level. Leer/0 = jeder Run neu gewürfelt' })] },
      { title: 'Marken-Clutter', wide: true, fields: [table('brandProps', 'Marken-Clutter', [ref('look', 'Symbol-Raster', 'assets'), text('name', 'Symbol'), num('cm', 'Höhe', { unit: 'cm', min: 1 }), num('chance', 'Chance', { unit: '%', min: 0, max: 100 }), bool('ai', 'KI')], { hint: 'Daniel, 17.11.2026: Dinge einer Marke, die in diesem POI auf freiem Boden stehen (z. B. NomadCola-Automaten an Tankstellen). Symbol = Name im Raster, Höhe in echten cm, Chance je freier Bodenkachel. KI = darin wohnt eine Entity: E / ↑ davor startet ein Glitch-Duell (#052)' })] },
      { title: 'Ranking', fields: [num('parTime', 'Bestzeit', { unit: 's', min: 0 }), num('secrets', 'Secrets', { min: 0, hint: 'Im Level zählen die brüchigen Wände (B); diese Zahl gilt nur für POIs ohne Level' })] },
      { title: 'Leben (noch ohne Wirkung)', fields: [bool('npcs', 'NPCs vor Ort'), bool('foodtruck', 'Foodtruck-Verkauf möglich'), bool('shop', 'Händler')] },
    ],
    check: (x, report, p, id) => {
      for (const r of String(x.gang?.rivals || '').split(',').map(v => v.trim()).filter(Boolean)) if (!Object.values(p?.data?.pois || {}).some(o => o.gang?.name === r)) report('warning', `Rivale „${r}“ ist keine Gang (POI › Gang › Name)`);   // #089
      if (x.gang?.color && !Object.values(p.data.kits || {}).some(K => (K.gangs || []).some(g => g.name === x.gang.color))) report('warning', `Gang-Farbe „${x.gang.color}“ gibt es in keinem Gegner-Bausatz`);
      const R = p.data.rooms || {};
      if (!(x.rooms || []).some(r => R[r]?.tags?.includes('start'))) report('warning', 'Kein Raum mit Eingang');
      if (!(x.rooms || []).some(r => R[r]?.tags?.includes('exit'))) report('warning', 'Kein Raum mit Ausgang');
      const ready = poiReady(p.data, id);
      if (!ready.ok) report('hint', `Noch nicht spielbar als Level: ${ready.why}`);
      else for (const t of buildPoi(p.data, id, 1).problems) report('hint', `Level: ${t}`);
    },
  },
  terrain: {
    name: 'Kachel-Sets', singular: 'Kachel-Set', icon: 'tile', file: 'data/terrain.json', kind: 'catalog',
    hint: 'Wände und Böden der Räume (# im Layout) aus einem Symbol-Raster mit 64-px-Kacheln (TileSet00): Oberfläche, Füllung, Kanten aus Code, Clutter oben drauf, Decals auf der Wand und eine Rückwand für Innenräume. Raum-Bausteine wählen ihr Set, sonst gilt Spiel › Kacheln › Kachel-Set.',
    template: { name: 'Neues Kachel-Set', look: 'tileset00', top: [], fill: [], edge: { color: '#060608', width: 2, shade: 40, shadeWidth: 3 }, clutterChance: 20, decalChance: 6 },
    row: x => `${(x.top || []).length} Oberflächen · ${(x.fill || []).length + (x.fill2 || []).length} Füllungen · ${(x.clutter || []).length} Clutter · ${(x.decals || []).length} Decals`,
    sections: [
      { title: 'Tiefe', fields: [num('depth.mass', 'Masse: höchstens dunkler', { unit: '%', min: 0, max: 90, hint: 'Fels dunkelt unter der Oberfläche nach unten ab (Licht von oben links, Daniel 12.11.2026: „wirkt flach, wie an die Wand geklebt“)' }),
        num('depth.step', 'Masse: je Kachel tiefer', { unit: '%', min: 0 }), num('depth.rim', 'Lichtkante links/oben', { unit: '%', min: 0 }), color('depth.rimColor', 'Lichtfarbe'),
        num('depth.shade', 'Schatten rechts/unten', { unit: '%', min: 0 }), num('depth.lip', 'Lippe unter der Kruste', { unit: '%', min: 0 }),
        num('depth.cast', 'Schlagschatten auf die Rückwand', { unit: '%', min: 0 }), num('depth.castX', 'Schlagschatten Breite', { unit: 'px', min: 0 }), num('depth.castY', 'Schlagschatten Höhe', { unit: 'px', min: 0 }),
        num('depth.ao', 'Rückwand: Ecken dunkler', { unit: '%', min: 0 }), num('depth.aoSize', 'Rückwand: Eckenschatten breit', { unit: 'px', min: 0 }),
        num('depth.drop', 'Draußen: Schatten in die Luft', { unit: '%', min: 0, hint: 'Wände und Überhänge werfen einen weichen Schatten nach rechts unten auf den Hintergrund' }), num('depth.dropSize', 'Draußen: Schatten breit', { unit: 'px', min: 0 }),
        num('depth.prop', 'Clutter: Kontaktschatten', { unit: '%', min: 0 })] },
      { title: 'Kacheln', fields: [NAME, DESCRIPTION, ref('look', 'Raster', 'assets', { hint: 'Asset der Art „Symbole“: Feldbreite = Kachelgröße, was höher ist, ragt nach oben über die Kachel (Kruste, Moos, Schutt)' }),
        lines('top', 'Oberfläche', { hint: 'Namen aus dem Raster, eine pro Zeile: Kacheln mit Luft darüber. Nebeneinander der Reihe nach (x mod Anzahl), dann schließen nahtlose Streifen sauber an' }),
        lines('fill', 'Füllung', { hint: 'Kacheln mit Wand darüber, der Reihe nach wie die Oberfläche' }),
        lines('fill2', 'Füllung darunter', { hint: 'Wechselt sich zeilenweise mit der Füllung ab; leer = immer Füllung' })] },
      { title: 'Kanten', fields: [color('edge.color', 'Umriss'), num('edge.width', 'Umriss', { unit: 'px', min: 0 }),
        num('edge.shade', 'Schatten', { unit: '%', min: 0, max: 100, hint: 'Abdunkeln innen neben dem Umriss' }), num('edge.shadeWidth', 'Schatten', { unit: 'px', min: 0 })] },
      { title: 'Rückwand', fields: [ref('back.terrain', 'Rückwand aus', 'terrain', { hint: 'In Innenräumen (Raum-Bausteine › Innenraum) und im Tunnel liegt die Füllung dieses Sets abgedunkelt hinter allem. Leer = dunkle Wand aus Code' }),
        num('back.shade', 'Abdunkeln', { unit: '%', min: 0, max: 100 })] },
      { title: 'Clutter & Decals', fields: [ref('props', 'Raster', 'assets', { hint: 'Asset der Art „Symbole“ mit Clutter (steht auf dem unteren Rand) und Decals' }),
        num('clutterChance', 'Clutter', { unit: '%', min: 0, max: 100, hint: 'Chance je Oberflächen-Kachel mit Wand links und rechts und freier Luft darüber' }),
        lines('clutter', 'Clutter', { hint: 'Namen aus dem Raster, eine pro Zeile; doppelt = häufiger' }),
        num('decalChance', 'Decals', { unit: '%', min: 0, max: 100, hint: 'Chance je Kachel' }), lines('decals', 'Decals', { hint: 'Namen aus dem Raster, eine pro Zeile' }),
        num('detailChance', 'Einschlüsse', { unit: '%', min: 0, max: 100, hint: 'Chance je Füllungs-Kachel: Steine, Rohre, Flicken liegen flach auf der Wand und brechen die Wiederholung' }),
        lines('details', 'Einschlüsse', { hint: 'Namen aus dem Raster, eine pro Zeile' }),
        ref('propsBig', 'Großer Clutter · Raster', 'assets', { hint: 'Asset der Art „Symbole“ mit Feldern für Dinge über zwei Kacheln (z. B. 128 × 128)' }),
        num('bigChance', 'Großer Clutter', { unit: '%', min: 0, max: 100, hint: 'Chance je Platz: zwei Oberflächen-Kacheln nebeneinander, darüber zwei Kacheln Luft' }),
        lines('bigClutter', 'Großer Clutter', { hint: 'Namen aus dem Großer-Clutter-Raster, eine pro Zeile' }),
        table('sizes', 'Größen', [text('name', 'Name'), num('cm', 'Höhe', { unit: 'cm', min: 1 })], { hint: 'Echte Höhe je Clutter (Name aus einem der Raster); das Spiel skaliert pixelscharf, Leyla = Spiel › Kacheln › Leyla ist groß. Ohne Zeile: so groß wie im Raster gemalt' }),
        num('sizeMax', 'Höchstens vergrößern', { unit: '%', min: 100, max: 400, hint: 'Deckel für das Vergrößern, damit Pixel nicht zu klobig werden. Leer = 200' }),
        num('seed', 'Zufall', { min: 0, hint: 'Andere Zahl = andere Verteilung (gleich bleibt gleich)' })] },
      { title: 'Licht', fields: [ref('atmosphere', 'Atmosphäre', 'atmosphere', { hint: 'Licht und Stimmung in Räumen mit diesem Set (Raum-Bausteine können sie überschreiben). Leer = Spiel › Atmosphäre › Standard' }),
        table('glows', 'Leuchtet', [text('name', 'Name'), color('color', 'Farbe'), point('at', 'Mitte', { unit: 'px', hint: 'Im Feld des Rasters, von oben links' }), size('size', 'Größe', { unit: 'px' }),
          num('strength', 'Stärke', { unit: '%', min: 0, max: 200 }), num('light', 'Licht', { unit: 'px', min: 0, hint: 'Radius des Lichts in die Umgebung, 0 = nur Schein' }), select('behavior', 'Verhalten', LIGHT_BEHAVIORS)],
          { hint: 'Clutter, der selbst leuchtet (Automaten, Kühlschränke, Bildschirme): Schein über der Stelle und Licht in die Umgebung. Name aus einem der Raster' })] },
    ],
    check: (x, report, p) => {
      const names = id => { const a = p.data.assets?.[id]; return a?.kind === 'icons' ? new Set(a.names || []) : null; };
      const T = names(x.look), P = names(x.props);
      if (x.look && !T) report('error', 'Raster ist kein Asset der Art „Symbole“');
      if (x.props && !P) report('error', 'Clutter-Raster ist kein Asset der Art „Symbole“');
      if (!(x.top || []).length || !(x.fill || []).length) report('warning', 'Oberfläche oder Füllung fehlt');
      for (const k of ['top', 'fill', 'fill2']) for (const n of x[k] || []) if (T && !T.has(n)) report('error', `„${n}“ gibt es im Raster nicht`);
      for (const k of ['clutter', 'decals', 'details']) for (const n of x[k] || []) if (P && !P.has(n)) report('error', `„${n}“ gibt es im Clutter-Raster nicht`);
      const B = names(x.propsBig);
      if (x.propsBig && !B) report('error', 'Großer-Clutter-Raster ist kein Asset der Art „Symbole“');
      for (const n of x.bigClutter || []) if (B && !B.has(n)) report('error', `„${n}“ gibt es im Großer-Clutter-Raster nicht`);
      for (const r of x.sizes || []) if (!(P?.has(r.name) || B?.has(r.name))) report('warning', `Größe für „${r.name}“: gibt es in keinem Raster`);
      for (const r of x.glows || []) if (!(P?.has(r.name) || B?.has(r.name))) report('warning', `Leuchtet: „${r.name}“ gibt es in keinem Raster`);
    },
  },
  atmosphere: {
    name: 'Atmosphäre', singular: 'Atmosphäre', icon: 'light', file: 'data/atmosphere.json', kind: 'catalog',
    hint: 'Licht und Stimmung in Räumen und POI-Levels (Daniel, 11.11.2026: „Atmosphäre und Beleuchtung, damit alles nicht so blank wirkt“): Dunkelheit, Lampen an der Decke, Farbstimmung, Vignette, Staub, Funken, Tropfen, Bodennebel. Kachel-Sets und Raum-Bausteine wählen ihre Atmosphäre. Alles aus Code.',
    template: { name: 'Neue Atmosphäre', light: { ambient: 60, color: '#c8c8d8', vignette: 30 }, lamps: [], dust: { count: 0 }, sparks: { perMinute: 0 }, drips: { perMinute: 0 }, fog: { count: 0 } },
    row: x => `Helligkeit ${x.light?.ambient ?? 100} % · ${(x.lamps || []).length ? (x.lamps || []).map(l => label(LAMP_KINDS, l.kind)).join(', ') : 'ohne Lampen'}${x.dust?.count ? ' · Staub' : ''}${x.sparks?.perMinute ? ' · Funken' : ''}${x.drips?.perMinute ? ' · Tropfen' : ''}${x.fog?.count ? ' · Nebel' : ''}`,
    sections: [
      { title: 'Licht', fields: [NAME, num('light.ambient', 'Helligkeit', { unit: '%', min: 0, max: 100, hint: 'Grundhelligkeit ohne Lampen. 100 = keine Dunkelheit (draußen am Tag), 40 = stimmungsvoll dunkel' }),
        color('light.color', 'Farbstimmung', { hint: 'Farbe des Raums: die Welt wird damit eingefärbt (Weiß = neutral). Wüste warm, Beton kalt-grünlich, Metall rostig, Tunnel blau' }),
        num('light.vignette', 'Vignette', { unit: '%', min: 0, max: 100, hint: 'Ränder des Bilds dunkler' }), DESCRIPTION] },
      { title: 'Lampen', fields: [table('lamps', 'Lampen', [select('kind', 'Art', LAMP_KINDS), color('color', 'Farbe'), num('every', 'Abstand', { unit: 'Kacheln', min: 1 }), num('offset', 'Versatz', { unit: 'Kacheln', min: 0, hint: 'Leer = halber Abstand' }),
          num('chance', 'Chance', { unit: '%', min: 0, max: 100 }), num('radius', 'Reichweite', { unit: 'px', min: 0 }), num('strength', 'Stärke', { unit: '%', min: 0, max: 200 }), select('behavior', 'Verhalten', LIGHT_BEHAVIORS)],
        { hint: 'Hängen automatisch an Decken (Wand mit zwei Kacheln Luft darunter), je Raum alle „Abstand“ Kacheln, Chance je Platz. * im Layout hängt die erste Zeile fest an die Decke darüber' })] },
      { title: 'Staub', fields: [num('dust.count', 'Teilchen', { min: 0, max: 400, hint: 'Auf dem Bildschirm zugleich. 0 = kein Staub' }), color('dust.color', 'Farbe'), num('dust.size', 'Größe', { unit: 'px', min: 1 }),
        point('dust.drift', 'Treiben', { unit: 'px/s', hint: 'x, y; draußen z. B. Sand im Wind' }), num('dust.alpha', 'Deckkraft', { unit: '%', min: 0, max: 100 }), bool('dust.inLight', 'Nur im Licht', { hint: 'Staub sieht man nur im Lichtkegel der Lampen' })] },
      { title: 'Funken', fields: [num('sparks.perMinute', 'Funken', { unit: 'pro Minute', min: 0, hint: 'An Wänden im Bild sprühen zufällig Funken (kaputte Kabel). Kaputte Lampen sprühen sowieso' }), color('sparks.color', 'Farbe')] },
      { title: 'Tropfen', fields: [num('drips.perMinute', 'Tropfen', { unit: 'pro Minute', min: 0, hint: 'Wasser tropft von Decken im Bild' }), color('drips.color', 'Farbe')] },
      { title: 'Bodennebel', fields: [num('fog.count', 'Schwaden', { min: 0, max: 40, hint: 'Auf dem Bildschirm zugleich, liegen auf den Böden' }), color('fog.color', 'Farbe'), num('fog.alpha', 'Deckkraft', { unit: '%', min: 0, max: 100 }),
        num('fog.height', 'Höhe', { unit: 'px', min: 8 }), num('fog.speed', 'Tempo', { unit: 'px/s' })] },
      { title: 'Kleinvieh', fields: [num('critters.flies', 'Fliegen-Schwärme', { min: 0, max: 20, hint: 'Daniel, 11.11.2026: Fliegen, Kakerlaken und andere Kleinigkeiten aus Code. Kleine Knäuel über dem Boden im Bild, stieben auseinander, wenn Leyla durchrennt' }), color('critters.flyColor', 'Fliegen-Farbe'),
        num('critters.moths', 'Motten je Lampe', { min: 0, max: 8, step: 0.5, hint: 'Kreisen um brennende Lampen und stoßen dagegen' }), color('critters.mothColor', 'Motten-Farbe'),
        num('critters.roaches', 'Kakerlaken', { min: 0, max: 40, hint: 'Auf den Böden im Bild, flüchten vor Leyla in die Ritzen' }), color('critters.roachColor', 'Kakerlaken-Farbe'),
        num('critters.rats', 'Ratten', { unit: 'pro Minute', min: 0, hint: 'Ab und zu rennt eine über den Boden' }), color('critters.ratColor', 'Ratten-Farbe'),
        num('critters.papers', 'Papierfetzen', { min: 0, max: 30, hint: 'Liegen am Boden, der Luftzug schiebt sie, Leyla wirbelt sie auf' }), color('critters.paperColor', 'Papier-Farbe'), num('critters.draft', 'Luftzug', { unit: 'px/s', min: 0 }), num('critters.size', 'Größe', { unit: '%', min: 50, max: 400, hint: 'Pixelgröße der Tierchen und Fetzen (100 = 1 Spielpixel je Punkt, Standard 200)' })] },
    ],
  },
  rooms: {
    name: 'Raum-Bausteine', singular: 'Raum', icon: 'tile', file: 'data/rooms.json', kind: 'catalog',
    hint: 'Handgebaute Räume, aus denen POIs zusammengesetzt werden. Das Layout ist Text: ein Zeichen pro Kachel. Später kommt ein Level-Editor dazu.',
    template: { name: 'Neuer Raum', size: [30, 17], tags: ['combat'], weight: 1 },
    row: x => `${(x.size || []).join('×')} · ${(x.tags || []).map(t => label(ROOM_TAGS, t)).join(', ')}${x.layout ? ' · Layout' : ''}`,
    sections: [
      { title: 'Raum', fields: [NAME, LOOK, size('size', 'Größe', { unit: 'Kacheln' }), multi('tags', 'Merkmale', ROOM_TAGS), num('weight', 'Häufigkeit', { min: 0 }),
        ref('terrain', 'Kachel-Set', 'terrain', { hint: 'Wände und Böden dieses Raums. Leer = Spiel › Kacheln › Kachel-Set' }),
        bool('indoor', 'Innenraum', { hint: 'Im POI-Level: Rückwand statt Himmel. Leer = Innenraum, wenn der Raum keinen eigenen Hintergrund hat' }),
        ref('atmosphere', 'Atmosphäre', 'atmosphere', { hint: 'Licht und Stimmung dieses Raums (z. B. Lager dunkler). Leer = Atmosphäre des Kachel-Sets' }), DESCRIPTION] },
      { title: 'Hintergrund', fields: [ref('backdrop.parallax', 'Parallax-Set', 'parallax', { hint: '#115: gemalte Ebenen statt Bild; leer = Bild bzw. das Set der Region (draußen)' }), bool('backdrop.parallaxNear', 'Auch die nahe Ebene', { hint: 'Sonst in POIs nur ferne Ebenen (die nahe sieht neben Requisiten aus wie Spielwelt)' }), num('backdrop.veil', 'Dunst', { unit: '%', min: 0, max: 100, hint: 'Schleier über den Ebenen (Standard 35)' }), num('backdrop.horizon', 'Horizont', { unit: '% der Bildhöhe' }), select('backdrop.outdoor', 'Draußen', [['', 'nach dem Bild'], ['yes', 'ja: Set der Region + Vordergrund'], ['no', 'nein']], { hint: 'Draußen-Räume bekommen das Set ihrer Region und schwarze Vordergrund-Silhouetten' }), ref('backdrop.image', 'Bild', 'assets', { hint: 'Pixel-Art mit transparentem Himmel, scharf auf ganze Pixel skaliert; leer = Stadt-Silhouette aus Code' }),
        ref('backdrop.weather', 'Wetter', 'weather', { hint: 'Himmel dahinter, Regen davor' }), num('backdrop.pixel', 'Pixelgröße', { unit: 'px', min: 1, hint: 'Leer = passend zur Bildhöhe' }),
        num('backdrop.bottom', 'Unterkante', { unit: '%', hint: 'Wo die Unterkante des Bilds sitzt, wenn die Kamera ganz unten ist (100 = Bildschirmrand)' }), num('backdrop.scroll', 'Mitbewegen', { unit: '%', min: 0, hint: 'Parallaxe mit der Kamera' }),
        color('backdrop.ground', 'Boden darunter', { hint: 'Füllt unter dem Bild; leer = Farbe der untersten Bildzeile' }), num('backdrop.shade', 'Abdunkeln im Raum', { unit: '%', min: 0, max: 100 })] },
      { title: 'Layout', fields: [lines('layout', 'Kacheln', { hint: 'Ein Zeichen pro Kachel: ' + TILE_LEGEND.map(([c, n]) => `${c} ${n}`).join(' · ') + ' · andere Buchstaben = Spawns aus der Tabelle' }),
        table('spawns', 'Spawns', [text('symbol', 'Zeichen'), ref('enemy', 'Gegner', 'enemies')], { hint: 'Welcher Gegner zu welchem Buchstaben im Layout gehört' })] },
    ],
    check: (x, report) => { for (const [kind, text] of parseRoom(x).problems) report(kind, text); },
  },
  locations: {
    name: 'Oberwelt-Orte', singular: 'Ort', icon: 'map', file: 'data/locations.json', kind: 'catalog',
    hint: 'Punkte auf der Oberweltkarte rund um BigCityDelta. Jeder Ort zeigt auf einen POI.',
    template: { name: 'Neuer Ort', poi: '', position: [0, 0], region: '' },
    row: (x, p) => [p?.data.pois?.[x.poi]?.name || x.poi || '–', x.region].filter(Boolean).join(' · '),
    sections: [{ title: 'Ort', fields: [NAME, LOOK, ref('poi', 'POI', 'pois', { required: true }), point('position', 'Position', { unit: 'km' }), text('region', 'Region'), DESCRIPTION,
      bool('hidden', 'Versteckt', { hint: '#057: nicht auf der Reisekarte, bis ein Ereignis ihn verrät (Ereignis-Baukasten › Antworten › Ort aufdecken); dann mit Straßen zum nächsten Ort und dorthin, wo Leyla gerade ist. Nie der erste Ort (Start)' })] }],
  },
  encounters: {
    name: 'Encounter', singular: 'Encounter', icon: 'flash', file: 'data/encounters.json', kind: 'catalog',
    hint: 'Zwischenfälle auf der Reise (#014, Daniel, 13.11.2026: „Mehrere Etappen + Ereignisse (Panne, Händler, Hinterhalt)“). Nach jeder Etappe kann einer passieren (Reisen › Chance pro 10 km, nachts mehr); er erzählt, was los ist, und bietet Entscheidungen an. Jede kostet oder bringt Zeit, Sprit, Vorräte, Δ, Leben oder Dinge.',
    template: { name: 'Neuer Encounter', weight: 1, time: 'any', enemies: [], options: [{ label: 'Weiterfahren' }] },
    row: x => `${label(DAYTIME, x.time)} · Gewicht ${x.weight ?? 0} · ${(x.options || []).length} Entscheidungen`,
    sections: [{ title: 'Encounter', fields: [NAME, LOOK, num('weight', 'Gewicht', { min: 0 }), select('time', 'Tageszeit', DAYTIME), refs('enemies', 'Gegner', 'enemies', { hint: 'Noch ohne Wirkung: ein Kampf auf der Straße als kleines Level kommt später' }), ref('loot', 'Beute', 'lootTables'), DESCRIPTION,
        refs('figures', 'Figuren am Straßenrand', 'enemies', { hint: '#053: wer in der Fahrt-Szene am Rand steht (Gegner-Bausätze in Rig-Größe, schauen zum Rig); leer = die Gegner' }),
        select('gang', 'Gang', GANG_FROM, { hint: '#055: wessen Leute das sind; außerhalb des Ruf-Bereichs passiert er nicht (ein Freund wird nicht angehalten)' }), range('rep', 'Ruf von–bis'),
        select('roadside', 'Am Straßenrand', ROADSIDE, { hint: '#053: was in der Fahrt-Szene am Rand steht und näher kommt, bevor das Rig hält und das Fenster aufgeht (aus Code gezeichnet)' })] },
      { title: 'Entscheidungen', fields: [table('options', 'Entscheidungen', [text('label', 'Knopf'), num('hours', 'Zeit', { unit: 'h' }), num('fuel', 'Sprit', { unit: 'l', hint: 'positiv = kostet' }),
        num('food', 'Vorräte', { hint: 'positiv = kostet' }), num('deltas', 'Δ', { hint: 'negativ = zahlen' }), num('health', 'Schaden', { unit: 'Leben', min: 0 }),
        ref('use', 'Verbraucht', 'items'), num('useCount', 'Wie viele', { min: 1 }), ref('item', 'Gibt', 'items'), num('count', 'Anzahl', { min: 1 }), ref('loot', 'Beute-Wurf', 'lootTables'), text('result', 'Danach'),
        num('risk', 'Risiko', { unit: '%', min: 0, max: 95, hint: '#054: so oft geht es schief: kein Gewinn, dafür der Schaden und die Zeit des Fehlschlags' }), num('failHealth', 'Fehlschlag: Schaden', { unit: 'Leben', min: 0 }), num('failHours', 'Fehlschlag: Zeit', { unit: 'h', min: 0 }), text('failResult', 'Fehlschlag: Text'), num('rep', 'Ruf', { hint: 'bei der Gang des Encounters, −100 … 100' })],
        { hint: 'Die erste ist hervorgehoben; wer das Fenster schließt, nimmt die erste, die geht. Ausgegraut, wenn Δ, Sprit oder der verbrauchte Gegenstand fehlen' })] }],
  },
  roadEvents: {
    name: 'Ereignis-Baukasten', icon: 'flash', file: 'data/road_events.json', kind: 'single',
    hint: '#054 (Daniel, 18.11.2026: „mehr Abwechslung in den Ereignissen unterwegs. Bau ein System, aus dem man diese Situationen generieren kann“). Ein Zwischenfall wird aus Bausteinen gewürfelt: eine Lage (wo, was, wer), eine Stimmung (wie die Leute drauf sind) und die Antworten, die dazu passen. Platzhalter in allen Texten: {mood} {place} {region} {brand} {group} {cargo} {thing} {creature} {n}, in Antworten {price}; mehrere Varianten mit „|“. Die Gefahr des Ziels macht Zahlen teurer, Schaden härter und Lohn größer.',
    sections: [
      { title: 'Regeln', fields: [num('share', 'Anteil gewürfelt', { unit: '%', min: 0, max: 100, hint: 'so viele Zwischenfälle kommen aus dem Baukasten, der Rest sind die handgemachten (Welt › Encounter)' }),
        num('scale', 'Je Gefahrstufe', { unit: '%', min: 0, hint: 'ab Gefahr 2: Preise, Schaden und Lohn wachsen um so viel je Stufe' }), num('maxAnswers', 'Antworten höchstens', { min: 2, max: 6 })] },
      { title: 'Lagen', fields: [table('situations', 'Lagen', [text('id', 'ID'), text('name', 'Titel', { hint: 'Varianten mit |' }), select('roadside', 'Am Straßenrand', ROADSIDE),
        text('figures', 'Figuren', { hint: 'Gegner-IDs mit Komma; stehen in Rig-Größe am Rand' }), select('time', 'Tageszeit', DAYTIME), num('weight', 'Gewicht', { min: 0 }), num('danger', 'Ab Gefahr', { min: 1, max: 5 }),
        text('text', 'Text', { hint: 'Varianten mit |' }), select('shop', 'Laden', [['', '–'], ['brand', 'Markenstand (Waren einer Marke)']], { hint: '#064: verkauft bis zu drei Dinge einer Marke (die des Influencer-Buffs, wenn sie Waren hat), mit Nachlass' }), text('answers', 'Antworten', { hint: 'IDs mit Komma, in dieser Reihenfolge (die erste ist hervorgehoben); „antwort>lage“ = danach kommt auf der nächsten Etappe diese Lage (Kette)' }), text('moods', 'Stimmungen', { hint: 'IDs mit Komma; leer = ohne Stimmung (niemand da)' }),
        text('gangName', 'Feste Gang', { hint: '#057: Name einer bestimmten Gang (POI › Gang), statt „Gang“ unten' }),
        select('gang', 'Gang', GANG_FROM, { hint: '#055: wessen Leute das sind; ihr Ruf wählt die Stimmung (Freund: nur freundliche, Feind: nur feindselige) und ändert sich mit den Antworten' }),
        range('rep', 'Ruf von–bis', { hint: 'nur, wenn Leylas Ruf bei der Gang in diesem Bereich liegt (−100 … 100); leer = immer' }),
        text('needs', 'Braucht Merker', { hint: 'mit Komma; alle müssen gesetzt sein (z. B. „hank_geholfen“)' }), text('not', 'Nicht bei Merker', { hint: 'mit Komma' }),
        bool('only', 'Nur als Folge', { hint: 'kommt nur über eine Antwort „…>diese Lage“ (Kettenschritt)' }), bool('once', 'Einmal je Durchgang'),
        ref('loot', 'Beute', 'lootTables', { hint: 'für Antworten mit Beute „situation“' }), ref('look', 'Bild', 'assets', { hint: 'Comic-Bild im Fenster; leer = Reisen › Bild für Zwischenfälle' }), ...CREW_NEEDS()])] },
      { title: 'Stimmungen', fields: [table('moods', 'Stimmungen', [text('id', 'ID'), text('name', 'Wort', { hint: 'Adjektiv mit -e: „gierige“, für {mood}' }), text('text', 'Satz', { hint: 'hängt an den Text der Lage; Varianten mit |' }),
        num('price', 'Preise', { unit: '%', min: 10 }), num('risk', 'Risiko', { unit: '± %' }), bool('friendly', 'Freundlich'), bool('hostile', 'Feindselig')],
        { hint: 'Antworten „nur bei freundlicher/feindseliger Stimmung“ erscheinen nur, wenn die Stimmung das ist; beides geht (verzweifelt)' })] },
      { title: 'Antworten', fields: [table('answers', 'Antworten', [text('id', 'ID'), text('label', 'Knopf', { hint: 'Varianten mit |, {price} = Δ nach Stimmung und Gefahr' }), select('when', 'Wann', ANSWER_WHEN),
        num('hours', 'Zeit', { unit: 'h' }), num('fuel', 'Sprit', { unit: 'l', hint: 'positiv = kostet, negativ = bekommt' }), num('food', 'Vorräte', { hint: 'positiv = kostet' }), num('deltas', 'Δ', { hint: 'negativ = zahlen' }),
        num('health', 'Schaden', { unit: 'Leben', min: 0 }), ref('use', 'Verbraucht', 'items'), num('useCount', 'Wie viele', { min: 1 }), ref('item', 'Gibt', 'items'), num('count', 'Anzahl', { min: 1 }),
        text('loot', 'Beute-Wurf', { hint: 'ID einer Beutetabelle oder „situation“ = die der Lage' }), num('risk', 'Risiko', { unit: '%', min: 0, max: 95 }), num('failHealth', 'Fehlschlag: Schaden', { unit: 'Leben', min: 0 }),
        num('failHours', 'Fehlschlag: Zeit', { unit: 'h', min: 0 }), text('result', 'Danach', { hint: 'Varianten mit |' }), text('failResult', 'Fehlschlag', { hint: 'Varianten mit |' }),
        num('rep', 'Ruf', { hint: '#055: −100 … 100, Änderung des Rufs bei der Gang der Lage (auch wenn es schiefgeht)' }), num('repRival', 'Ruf Rivalen', { hint: 'Änderung bei der rivalisierenden Gang ({rival}), z. B. in einer Fehde' }), text('flag', 'Merker', { hint: 'setzen; „-name“ löscht; mehrere mit Komma (nur wenn es klappt)' }),
        ref('buff', 'Buff', 'buffs', { hint: 'wirkt im nächsten Run (nur wenn es klappt)' }), ref('reveal', 'Ort aufdecken', 'locations', { hint: '#057: ein versteckter Ort (Orte › Versteckt) kommt auf die Reisekarte (auch wenn es schiefgeht: gesehen ist gesehen)' }), bool('recruit', 'Nimmt jemanden in die Crew auf', { hint: '#085: ein gewürfelter Siedler kommt in die Crew (nur wenn es klappt)' }), select('prisoner', 'Gefangener', [['', '–'], ['ransom', 'gegen Lösegeld zu seiner Gang (Ruf +5)'], ['sell', 'an andere verkaufen (Ruf seiner Gang −15)'], ['free', 'laufen lassen (Ruf +3, keine Dunkelheit)']], { hint: '#079: die Antwort braucht einen Gefangenen an Bord und nimmt einen (den gesündesten, von der Gang der Lage, wenn es einen gibt)' }),
        num('dark', 'Dunkelheit', { min: 0, hint: '#079: so viel Dunkelheit bringt die Antwort (leer = Gefangene › Je Einsatz)' }), num('hurtPrisoners', 'Gefangene verletzt', { unit: '%', min: 0, max: 100, hint: '#079: alle Gefangenen verlieren so viel Gesundheit (Unruhe, Beschuss)' }),
        ...CREW_NEEDS(), ref('brand', 'Marke', 'brands', { hint: '#064: Δ, die hier bezahlt werden, gehen an diese Marke (Influencer-Nachlass)' })])] },
      { title: 'Gefangene', fields: [num('prisoners.chance', 'Fesseln: Chance', { unit: '%', min: 0, max: 100, hint: '#079: ein Plünderer, im Nahkampf besiegt, bleibt gefesselt liegen und wird wie Beute aufgehoben (kein Boss)' }),
        num('prisoners.perDay', 'Dunkelheit je Tag in der Zelle', { min: 0 }), num('prisoners.outside', 'Außerhalb der Zelle: Gesundheit je Tag', { unit: '%', min: 0, hint: 'Rucksack, Kofferraum, Camp-Lager: sie leiden' }),
        num('prisoners.useDark', 'Dunkelheit je Einsatz', { min: 0, hint: 'Lösegeld, verkaufen; ein toter Gefangener bringt sie auch' }), num('prisoners.hurt', 'Schaden bei einem Fehlschlag', { unit: '%', min: 0, max: 100, hint: 'eine riskante Antwort ging schief und hat Leyla verletzt: die Gefangenen auch' }),
        lines('prisoners.names', 'Namen', { hint: 'eine Zeile je Name' })] },
      { title: 'Ruf', fields: [num('rep.enemy', 'Feind bis', { min: -100, max: 0 }), num('rep.disliked', 'Unbeliebt bis', { min: -100, max: 0 }), num('rep.tolerated', 'Geduldet ab', { min: 0, max: 100 }), num('rep.friend', 'Freund ab', { min: 0, max: 100 }),
        num('rep.price', 'Preise', { unit: '% bei ±100', min: 0, max: 90, hint: 'Freunde zahlen weniger, Feinde mehr' }), num('rep.kill', 'Je Kill im Revier', { min: 0, hint: 'so viel Ruf kostet ein Kill in einem POI der Gang' }),
        select('rep.peace', 'Frieden im Revier ab', [['geduldet', 'Geduldet'], ['freund', 'Freund'], ['neutral', 'Neutral']], { hint: '#061: ab dieser Stufe wird der POI zum Revier-Camp: die Gang greift nicht an; Freunde handeln und haben einen Auftrag' }),
        num('rep.breakPeace', 'Frieden brechen kostet', { min: 0, hint: 'Ruf, wenn Leyla einen von ihnen angreift oder den Tresor knackt' }), num('rep.theft', 'Beim Klauen gesehen', { min: 0, hint: 'Ruf je Kiste, die einer von ihnen öffnen sieht' }),
        num('rep.job', 'Auftrag: Ruf', { min: 0, hint: 'Ruf für „Revier säubern“' }),
        num('rep.rivalShare', 'Rivalen: Gegenruf', { unit: '%', min: 0, max: 100, hint: '#089 Revierkrieg: was Leyla bei einer Gang gewinnt, verliert sie bei deren Rivalen (und umgekehrt), zu diesem Anteil. 0 = aus' }),
        bool('rep.takeover', 'Rivalen übernehmen Orte', { hint: '#089: kämpft Leyla sich durch einen Ort einer Gang (kein Frieden, Tresor geknackt), zieht die Rivalen-Gang ein, bei der sie am besten dasteht' }),
        num('rep.warEvery', 'Krieg alle … Tage', { min: 0, hint: '#102 Gangs kämpfen selbst: so oft kann ein Ort an einer Front den Besitzer wechseln (0 = nie). Leer = 3' }), num('rep.warChance', 'Krieg: Chance je Mal', { unit: '%', min: 0, max: 100, hint: 'Leer = 60. Wer mehr Orte hält, gewinnt eher' })] },
      { title: 'Wetter', fields: [table('weather', 'Wetter macht wahrscheinlicher', [select('kind', 'Wetter', [['dust', 'Sandsturm'], ['fog', 'Morgennebel'], ['wet', 'Regen']]), select('roadside', 'Am Straßenrand', ROADSIDE), num('factor', 'Gewicht ×', { min: 0, max: 10 })],
        { hint: '#063/#071: das Wetter einer Etappe ändert das Gewicht der Lagen nach dem, was am Straßenrand steht (×1 = gleich, ×0,4 = seltener). Leer = die eingebauten Werte' })] },
      { title: 'Wörter', fields: [text('words.group', 'Banden {group}', { hint: 'mit |' }), text('words.cargo', 'Ladung {cargo}', { hint: 'mit |, „ein Laster mit …“' }),
        text('words.thing', 'Dinge {thing}', { hint: 'mit |, „ein Feuer aus …“' }), text('words.creature', 'Kreaturen {creature}', { hint: 'mit |, Mehrzahl' })] },
    ],
    check: (x, report, P) => { for (const m of eventProblems(P.data || {})) report(/keine Antwort/.test(m) ? 'warning' : 'error', m); },
  },
  tutorial: {
    name: 'Lektionen', singular: 'Lektion', icon: 'help', file: 'data/tutorial.json', kind: 'catalog', groupBy: { key: 'chapter', options: TUT_CHAPTERS },
    hint: 'Das Feldhandbuch (#011, Daniel, 13.11.2026: „ein Tutorial ähnlich wie bei Far Cry … Clips und Screenshots … feingranulare Lektionen“). Beim ersten Mal erscheint die Karte (pausiert), danach steht sie im Pause-Menü › Feldhandbuch. Clips und Bilder nimmt tools/tutorial_capture.mjs aus dem Spiel auf.',
    template: { name: 'Neue Lektion', chapter: 'move', order: 99, text: '', media: 'slides', trigger: '' },
    row: x => `${label(TUT_CHAPTERS, x.chapter)} · ${x.media === 'clip' ? 'Clip' : 'Bilder'} · ${label(TUT_TRIGGERS, x.trigger || '')}${x.on ? ' ' + x.on : ''}`,
    sections: [
      { title: 'Lektion', fields: [NAME, select('chapter', 'Kapitel', TUT_CHAPTERS), num('order', 'Reihenfolge', { min: 0 }),
        area_('text', 'Text', { hint: 'Tasten als Platzhalter, je Gerät als Taste oder Controller-Symbol: {k:jump} Spiel-Aktion (jump, dash, melee, ranged, reload, holster, grab, up, down, left, right, walk, inventory, build, help), {u:ok} Fenster-Aktion (ok, back, context, send, tabs, move), {stick}, {rstick}' })] },
      { title: 'Bilder', fields: [select('media', 'Art', [['clip', 'Clip (Schleife)'], ['slides', 'Slideshow']]), ref('clip', 'Clip', 'assets', { hint: 'Asset der Art „Clip (Video)“' }),
        table('slides', 'Bilder', [ref('look', 'Bild', 'assets'), text('caption', 'Untertitel')], { hint: 'Eine Seite je Zeile, Untertitel mit Platzhaltern wie im Text' })] },
      { title: 'Beim ersten Mal', fields: [select('trigger', 'Auslöser', TUT_TRIGGERS), select('mode', 'Wo', TUT_MODES),
        text('on', 'Bei', { hint: 'Hinweis sichtbar: Text im E-Hinweis (Teilwort, z. B. Kiste). Fenster: inventory, other, floor, build, shop, map, kitchen, craft, cyber, tech. Leyla: climb, hang, slide, crouch, swing, dash, flip. Ereignis: AvAs Stimmung (alert, kill, hit, cleared, down) oder cycle' }),
        num('after', 'Frühestens nach', { unit: 's', min: 0, hint: 'Sekunden im Camp bzw. im POI' })] },
    ],
    check: (x, report, P) => {
      if (x.media === 'clip' && x.clip && P.data?.assets?.[x.clip] && P.data.assets[x.clip].kind !== 'video') report('warning', 'Clip ist kein Video-Asset');
    },
  },
  worldmap: {
    name: 'Reisekarte', icon: 'map', file: 'data/worldmap.json', kind: 'single',
    hint: 'Die Reise als verwitterte Touristen-Karte der 60er (#007, Daniel, 13.11.2026). Jeder Durchgang würfelt ein Straßennetz um BigCityDelta: die Orte (Bereich Orte) bleiben als Wahrzeichen, dazu kommen gewürfelte Orte aus den POI-Arten unten, mit Namen, Region, Gefahr (wächst mit der Entfernung), Beute-Hinweisen und Marke. Leyla fährt immer eine Straße weit. Am Warroom und an der Van-Tür',
    sections: [
      { title: 'Welt', fields: [range('count', 'Gewürfelte Orte', { hint: 'Zusätzlich zu den Wahrzeichen aus dem Bereich Orte' }), num('radius', 'Radius', { unit: 'km', min: 20 }), num('gap', 'Mindestabstand', { unit: 'km', min: 2 }),
        point('city', 'BigCityDelta liegt bei', { unit: 'km' }), text('cityName', 'Name der Stadt'), num('cityRadius', 'Stadtgebiet', { unit: 'km', min: 0, hint: 'Hier wird nichts gewürfelt' }),
        bool('sea.enabled', 'Staubozean', { hint: '#119 Ausgetrockneter Ozean, nur mit einem Mega-Rig zu überqueren: harte Sperre von Anfang an, Andockpunkt am Ufer' }), text('sea.name', 'Staubozean: Name'), point('sea.at', 'Staubozean: Mitte', { unit: 'km' }), size('sea.size', 'Staubozean: Halbachsen', { unit: 'km' }),
        text('sea.warn', 'Staubozean: Warnung'), text('sea.dock', 'Andockpunkt: Name'), num('sea.dockAngle', 'Andockpunkt: Richtung', { unit: '° (0 = Osten, 90 = Süden)' }),
        num('dangerStep', 'Gefahr +1 alle', { unit: 'km', min: 5, hint: 'Je weiter vom Start, desto gefährlicher (und lohnender)' }),
        num('threat.enemies', 'Gefahr: mehr Gegner', { unit: '% je Stufe', min: 0, hint: 'Daniel, 13.11.2026: Gefahr wirkt (#014). Jede Stufe über 1 bringt so viel mehr Gegner in den Run' }), num('threat.health', 'Gefahr: Gegner-Leben', { unit: '% je Stufe', min: 0 }),
        num('threat.damage', 'Gefahr: Gegner-Schaden', { unit: '% je Stufe', min: 0 }), num('threat.loot', 'Gefahr: Extra-Beute', { unit: '% je Stufe', min: 0, hint: 'Chance auf ein Ding mehr je Beute-Wurf (Kisten, Gegner, Tresor)' }), num('detour', 'Umwege', { unit: '%', min: 0, hint: 'Straßen sind so viel länger als die Luftlinie' }),
        num('reveal', 'Namen sichtbar bis', { unit: 'Straßen', min: 0, hint: 'Orte weiter weg erscheinen als „?“, bis Leyla näher kommt' })] },
      { title: 'Orte', fields: [table('kinds', 'POI-Arten', [ref('poi', 'POI', 'pois'), num('weight', 'Gewicht', { min: 0 }), text('names', 'Namen')],
          { hint: 'Namen mit | getrennt, Platzhalter: {km} Entfernung zur Stadt, {nr} Nummer, {word} Ortswort, {office} Amt, {region}, {brand} Kurzname der Marke' }),
        text('words', 'Ortswörter', { hint: 'Mit Komma getrennt, für {word}' }), text('offices', 'Ämter', { hint: 'Für {office}' }),
        text('regions', 'Regionen', { hint: 'Mit Komma getrennt, im Kreis um die Stadt verteilt (beginnend im Westen, gegen den Uhrzeigersinn über Norden)' })] },
      { title: 'Plakate', fields: [num('signs', 'Plakate', { min: 0, max: 30, hint: 'Marken-Plakate an den Straßen. Die Marken selbst stehen seit #045 in Lore › Marken (dort „Auf der Karte“)' })] },
      { title: 'Aussehen', fields: [ref('paper', 'Papier', 'assets'), ref('logos', 'Logos', 'assets', { hint: 'Symbol-Raster mit den Marken-Logos' }), text('title', 'Titel'), text('edition', 'Ausgabe')] },
    ],
    check: (x, report, p) => {
      if (!(x.kinds || []).length) report('hint', 'Keine POI-Arten: es gibt nur die Wahrzeichen aus dem Bereich Orte');
    },
  },
  glitchlings: {
    name: 'Entities', icon: 'brain', file: 'data/glitchlings.json', kind: 'single',
    hint: '#047 (Daniel, 16./17.11.2026: „Software gibt es nicht mehr, nur spezialisierte KIs mit Eigenarten und Macken“; „Namen wie Marble Sting“; „ein System, auf dessen Basis man diese passiven Companions generieren kann“). Bausteine für den Generator (game/glitchlings.js); jeder Durchgang würfelt seine eigenen. Design: design.md › Hacking v3.',
    sections: [
      { title: 'Generator', fields: [num('count', 'Je Durchgang', { min: 1, max: 40, hint: 'So viele Entities gibt es in einem Durchgang (die Unikate mit „immer“ zählen mit)' }),
        table('bitWeights', 'Stärke', [num('w', 'Gewicht', { min: 0 })], { rowLabel: i => `${i + 1} ${i ? 'Bits' : 'Bit'}`, hint: 'Zeile 1 = 1 Bit … Zeile 5 = 5 Bits: wie oft jede Stärke gewürfelt wird' }),
        num('off', 'Fremde Werkbank', { unit: '%', min: 0, max: 100, hint: 'In einer Werkbank, die nicht zu ihrer Begabung passt, wirkt eine Entity nur so stark' })] },
      { title: 'Namen', fields: [area_('names.first', 'Erstes Wort', { hint: 'Material, Farbe, Stoff (Marble, Amber, Velvet …), mit Komma getrennt. Name = erstes + zweites Wort, jedes Wort je Durchgang nur einmal' }),
        area_('names.second', 'Zweites Wort', { hint: 'Kante, Geräusch, Tat (Sting, Slay, Hex …)' })] },
      { title: 'Begabungen', wide: true, fields: [table('talents', 'Begabungen', [text('name', 'Name'), select('function', 'Werkbank', WORKSHOP_FUNCTIONS), select('also', 'Auch', WORKSHOP_FUNCTIONS), ref('brand', 'Hersteller', 'brands'), text('effect', 'Effekt'), num('perBit', 'Je Bit', { min: 0 }), text('stat', 'Wert'), num('remote', 'Einflüstern', { min: 0, max: 6 }), num('link', 'Verschränken', { min: 0, max: 6 })],
        { hint: 'Effekt mit {n} = „Je Bit“ × Stärke. In „Werkbank“ und „Auch“ wirkt er voll. „Wert“ ist der Schlüssel, den das Spiel später ausliest (perfect, refund, growth, power …). Je Bit 0 = wirkt ohne Stärke (Archäologe). Der Wert bestimmt auch, was das Code-Porträt trägt. Hersteller = wer diese Art KI baut (#049), Unikate können einen eigenen haben' })] },
      { title: 'Macken & Wünsche', wide: true, fields: [table('quirks', 'Macken', [text('text', 'Macke'), select('kind', 'Art', GLITCH_QUIRKS), select('effect', 'Wirkung als Worker', QUIRK_EFFECTS, { hint: '#060/#071: was die Macke an der Werkbank tut; leer = nach Art (schrullig −15 %)' })], { hint: 'Jede Entity hat eine; immer ein Haken mit Charme' }),
        table('wishes', 'Wünsche', [text('text', 'Wunsch')], { hint: 'Was er will, um freiwillig mitzukommen (Überreden, kommt mit Stufe 2)' }),
        area_('homes', 'Wohnorte', { hint: 'Maschinen, in denen Entities in POIs wohnen, mit Komma getrennt' })] },
      { title: 'Duell', fields: [table('duel.quality', 'Präzision je Bits', [num('q', 'Präzision', { min: 2, max: 6 })], { hint: 'Zeile 1 = 1 Bit … Zeile 5 = 5 Bits: trifft bei W6 ≥ diesem Wert (Glitch-Duell #050, Kern von OPR Firefight). Impulse je Begabung stehen bei den Begabungen (Einflüstern, Verschränken)' }),
        num('duel.defense.cheap', 'Abschirmung Billig', { min: 2, max: 6, hint: 'Abschirmung nach der Stufe des Herstellers: wehrt einen Treffer ab bei W6 ≥ diesem Wert' }), num('duel.defense.mid', 'Abschirmung Mittel', { min: 2, max: 6 }),
        num('duel.defense.premium', 'Abschirmung Premium', { min: 2, max: 6 }), num('duel.defense.elite', 'Abschirmung Elite', { min: 2, max: 6 }),
        num('duel.tough', 'Integrität', { unit: '+ Bits', min: 0, hint: 'Gefecht: Integrität = Bits + dieser Wert (so viele Wunden, dann überschrieben)' }), num('duel.stackHp', 'Bit-Stapel: Integrität', { min: 1, hint: 'Startwert beider Seiten im Bit-Stapel, Wertung Dauerfeuer (Wertung Heilen: 25)' }), num('duel.team', 'Deck in der Demo', { min: 1, max: 3 })] },
      { title: 'Kammerjäger', wide: true, fields: [table('hunters', 'Kammerjäger', [text('id', 'ID'), text('name', 'Name'), ref('brand', 'Hersteller', 'brands'), num('quality', 'Präzision', { min: 2, max: 6 }), num('defense', 'Abschirmung', { min: 2, max: 6 }),
        num('tough', 'Integrität', { min: 1 }), num('remote', 'Einflüstern', { min: 0 }), num('link', 'Verschränken', { min: 0 }), text('description', 'Beschreibung')],
        { hint: 'Anti-Entity-Software der Konzerne: Gegner im Glitch-Duell, mit festen Werten. Demo: /duel' })] },
      { title: 'Charaktere', wide: true, fields: [table('characters', 'Charaktere', [text('id', 'ID'), text('name', 'Name'), text('description', 'Wesen'), ...MOMENTS.map(([k, n]) => text(k, n))],
          { hint: 'Daniel, 18.11.2026: jede KI hat einen Charakter mit Sprüchen für die Momente im Duell (mehrere mit | trennen). Erzeugte Entities bekommen einen nach ihrem Namen, Unikate ihren eigenen (Spalte Charakter), kammerjaeger und ava sind fest vergeben' }),
        num('banter.chance', 'Banter-Chance', { unit: '%', min: 0, max: 100, hint: 'Wie oft nach einem Zug jemand etwas sagt (Knapp, Start und Ende immer)' })] },
      { title: 'Unikate', wide: true, fields: [table('unique', 'Unikate', [text('name', 'Name'), text('talent', 'Begabung'), text('character', 'Charakter'), ref('brand', 'Hersteller', 'brands'), num('bits', 'Bits', { min: 1, max: 5 }), text('quirk', 'Macke'), text('wish', 'Wunsch'), text('home', 'Wohnort'), bool('always', 'Immer'), text('description', 'Beschreibung'),
        num('duelHp', 'Integrität im Duell', { min: 10, hint: '#057: mehr als die übliche Integrität (Duell › Integrität), z. B. die Silo-KI' }), num('duelNoise', 'Patzer im Duell', { unit: '%', min: 0, max: 50, hint: 'wie oft sie danebenliegt; leer = nach Bits, 2 = fast fehlerfrei' })],
        { hint: 'Handgemachte Entities (z. B. Amber Slay). „Immer“ = in jedem Durchgang dabei' })] },
    ],
    check: (x, report) => {
      const T = new Set((x.talents || []).map(t => t.name));
      for (const u of x.unique || []) { if (!T.has(u.talent)) report('warning', `Unikat ${u.name}: Begabung „${u.talent}“ gibt es nicht`); if (String(u.name || '').trim().split(/\s+/).length !== 2) report('hint', `Unikat ${u.name}: Namen haben zwei Wörter`); }
      for (const t of x.talents || []) if (!t.brand) report('hint', `Begabung ${t.name}: kein Hersteller`);
      const C = new Set((x.characters || []).map(c => c.id));
      for (const u of x.unique || []) if (u.character && !C.has(u.character)) report('warning', `Unikat ${u.name}: Charakter „${u.character}“ gibt es nicht`);
      for (const id of ['kammerjaeger', 'ava']) if (x.characters?.length && !C.has(id)) report('hint', `Charakter „${id}“ fehlt (Kammerjäger bzw. AvA sprechen dann nicht)`);
      for (const t of x.talents || []) if (t.perBit && !String(t.effect || '').includes('{n}')) report('hint', `Begabung ${t.name}: Effekt ohne {n}, „Je Bit“ wirkt nicht`);
    },
  },
  brands: {
    name: 'Marken', singular: 'Marke', icon: 'sign', file: 'data/brands.json', kind: 'catalog', groupBy: { key: 'sector', options: BRAND_SECTORS },
    hint: 'Lore-Datenbank (#045, Daniel 16.11.2026: „Brands sammeln und mit sinnvollen Eigenschaften versehen“): Konzerne, Läden, Straßenmarken der Welt. Gegenstände nennen ihren Hersteller; die Reisekarte holt ihre Marken von hier.',
    template: { name: 'Neue Marke', sector: 'trade', tier: 'mid', status: 'active', street: 'neutral', quality: 0, price: 100, loot: 100 },
    row: x => [label(BRAND_SECTORS, x.sector), label(BRAND_TIERS, x.tier), x.status && x.status !== 'active' ? label(BRAND_STATUS, x.status) : null, x.map?.on ? 'auf der Karte' : null].filter(Boolean).join(' · '),
    sections: [
      { title: 'Marke', fields: [NAME, text('short', 'Kurzname', { hint: 'Für Ortsnamen auf der Karte ({brand}) und kurze Etiketten' }), text('slogan', 'Slogan'), text('ads', 'Werbung auf Billboards', { hint: '#055: Sprüche für die Riesen-Bildschirme an der Straße, mehrere mit |; leer = der Slogan' }), select('sector', 'Branche', BRAND_SECTORS), color('color', 'Farbe'),
        num('icon', 'Logo', { min: 0, hint: '#046: Feld im Symbol-Raster „Logos“ (Reisekarte › Aussehen). Zeigt sich auf der Karte, auf Plakaten und im Markenschild der Tooltips' }),
        area_('description', 'Lore', { hint: 'Was man in BigCityDelta über sie weiß (und was man lieber nicht weiß)' })] },
      { title: 'Stellung in der Welt', fields: [select('tier', 'Preisklasse', BRAND_TIERS), text('seat', 'Sitz', { hint: 'z. B. BigCityDelta, Klinikturm Ebene 40 · Salt Flats · unbekannt' }), ref('parent', 'Mutterkonzern', 'brands'),
        select('status', 'Zustand', BRAND_STATUS), select('street', 'Ruf auf der Straße', BRAND_STREET)] },
      { title: 'Spielwerte', fields: [num('quality', 'Qualität', { unit: '%', min: -50, max: 100, hint: 'Ihre Implantate: die Boni (nicht die Nachteile) um so viel stärker oder schwächer' }),
        num('price', 'Preis', { unit: '%', min: 10, max: 500, hint: 'Wert ihrer Produkte (Tooltip, Δ-Summen, Aufträge); 100 = wie eingetragen' }),
        num('loot', 'In der Beute', { unit: '%', min: 0, max: 300, hint: 'Wie oft ihre Produkte in Beutetabellen fallen; 100 = wie eingetragen, 0 = nie' })] },
      { title: 'Markentreue', fields: [select('set.stat', 'Set-Bonus', [['', '–'], ...TROPHY_GEAR], { hint: '#064: wer so viele Teile dieser Marke trägt (Waffen, Ausrüstung, Implantate, AvA-Teile), bekommt diesen Wert dazu' }),
        num('set.value', 'Wert', {}), num('set.count', 'Ab Teilen', { min: 2, max: 8, hint: 'Standard 3' })] },
      { title: 'Auf der Reisekarte', fields: [bool('map.on', 'Auf der Karte', { hint: 'Steht an passenden Orten und als Plakat an den Straßen' }), select('map.kind', 'Bei', [['', 'überall'], ['gasStation', 'Tankstelle'], ['mall', 'Markt'], ['bunker', 'Bunker'], ['government', 'Amt']]),
        num('map.weight', 'Gewicht', { min: 0 })] },
    ],
    check: (x, report, p) => {
      const L = p.data?.assets?.[p.data?.worldmap?.logos];
      if (x.icon != null && L?.grid && x.icon >= L.grid[0] * L.grid[1]) report('warning', `Logo ${x.icon} gibt es nicht`);
      if (x.map?.on && x.icon == null) report('hint', 'Auf der Karte ohne Logo');
      if (x.map?.on && !x.short) report('hint', 'Auf der Karte ohne Kurzname');
    },
  },
  radio: {
    name: 'Radio', icon: 'music', file: 'data/radio.json', kind: 'single',
    hint: 'Rig-Radio (#090): Sender mit Musik aus Code und einem DJ, der zwischen den Songs redet: Werbung der Marken, Wetter vom Navigator, Frontberichte aus dem Revierkrieg, Gerüchte über Orte, Lore. Läuft im Camp und auf der Fahrt (N schaltet um, auch im Pause-Menü). Platzhalter: {station} {freq} {dj} {djLine} · Werbung {brand} {ad} {slogan} · Wetter {forecast} · Front {a} {b} {place} {place2} · Gerücht {place} {hint}',
    sections: [
      { title: 'Radio', fields: [bool('enabled', 'Radio im Spiel'), num('volume', 'Lautstärke', { unit: '%', min: 0, max: 100 }), range('song', 'Länge eines Songs', { unit: 's' }),
        num('talkSeconds', 'DJ redet', { unit: 's', min: 3 }), num('talkEvery', 'Reden nach jedem n-ten Song', { min: 1 }),
        text('jammed', 'Gestört (Feind der Gang)', { hint: 'Steht statt des Senders, wenn Leyla Feind der Gang ist, der er gehört. {gang}' })] },
      { title: 'Sender', fields: [table('stations', 'Sender', [text('id', 'ID'), text('name', 'Name'), text('freq', 'Frequenz'), select('style', 'Stil', RADIO_STYLES), num('bpm', 'Tempo', { unit: 'bpm', min: 40, max: 200 }),
        select('key', 'Tonart', [['', 'gewürfelt'], ...RADIO_KEYS]), select('scale', 'Tonleiter', [['', 'nach Stil'], ...RADIO_SCALES]), text('dj', 'DJ'), text('djLine', 'DJ-Spruch'), text('djTalent', 'DJ-Begabung', { hint: '#103 der DJ ist eine Entity: Begabung aus Entities › Begabungen (Name), leer = nach Stil' }), num('djBits', 'DJ-Bits', { min: 1, max: 5, hint: 'Stärke der DJ-Entity, leer = 3' }), text('gang', 'Gang', { hint: 'gehört dieser Gang: als Feind nur Rauschen' })])] },
      { title: 'Durchsagen', fields: [table('weights', 'Anteile', [select('kind', 'Art', RADIO_TALK), num('weight', 'Gewicht', { min: 0 })]),
        lines('lines.ident', 'Senderkennung'), lines('lines.ad', 'Werbung', { hint: 'eine Zeile wird gewürfelt, {ad} ist ein Spruch der Marke (Lore › Marken › Werbung oder Slogan)' }), lines('lines.weather', 'Wetter'),
        lines('lines.war', 'Frontbericht'), lines('lines.tip', 'Gerücht'), lines('lines.lore', 'Lore-Häppchen')] },
      { title: 'Songtitel', fields: [lines('titleA', 'Erstes Wort'), lines('titleB', 'Zweites Wort')] },
    ],
    check: (x, report) => { const ids = (x.stations || []).map(s => s.id); if (new Set(ids).size !== ids.length) report('error', 'Zwei Sender mit derselben ID'); if (x.enabled !== false && !ids.length) report('warning', 'Radio an, aber kein Sender'); },
  },

  travel: {
    name: 'Reisen', icon: 'world_icon', file: 'data/travel.json', kind: 'single',
    hint: 'Was das Fahren kostet: Sprit, Vorräte und Zeit. Nachts ist es gefährlicher.',
    sections: [
      { title: 'Bild', fields: [ref('encounterLook', 'Bild für Zwischenfälle', 'assets', { hint: '#021: steht oben im Fenster jedes Zwischenfalls (wie ein Comic-Panel aus dem Intro); ein Encounter mit eigenem Aussehen nimmt seins' })] },
      { title: 'Kosten', fields: [num('speed', 'Reisetempo', { unit: 'km/h', min: 1 }), num('foodPerDay', 'Vorräte pro Tag und Kopf', { unit: 'Rationen', min: 0 }),
        num('weightFuelFactor', 'Mehrverbrauch je Tonne', { unit: '%', min: 0 })] },
      { title: 'Tag & Nacht', fields: [num('dayLength', 'Tageslänge', { unit: 'Spiel-h', min: 1 }), num('nightShare', 'Anteil Nacht', { unit: '%', min: 0, max: 100 }), num('nightDanger', 'Gefahr nachts', { unit: '%', min: 0 })] },
      { title: 'Encounter', fields: [num('encounterChance', 'Chance pro 10 km', { unit: '%', min: 0, max: 100 })] },
      { title: 'Vorhersage', fields: [bool('forecast.enabled', 'Wettervorhersage', { hint: '#087: der Navigator in der Reisekarte zeigt Regen, Sandsturm und Nebel jeder Etappe der Route, am eigenen Ort den Regen der nächsten Tage. Er würfelt wie die Fahrt, die Vorhersage stimmt also' }),
        bool('forecast.warroom', 'Nur mit Warroom', { hint: 'ohne Warroom im Rig keine Vorhersage (wie Gefahr und Beute)' }), num('forecast.days', 'Tage voraus', { min: 1, max: 7, hint: 'Regen-Ausblick am eigenen Ort' })] },
      { title: 'Fahrt', fields: [bool('drive.enabled', 'Fahrt zeigen', { hint: '#053 (Daniel, 18.11.2026: „wie bei Keep Driving“): zwischen Karte und Ankunft rollt das Rig durch die Landschaft, Zwischenfälle stehen am Straßenrand. Aus = sofort da wie früher' }),
        num('drive.seconds', 'Dauer je Etappe', { unit: 's', min: 3, hint: 'Daniel: gemütlich, Standard 30' }), num('drive.influencer.scan', 'Influencer: Scan-Dauer', { unit: 's', min: 0.3, step: 0.1, hint: '#115: so lange muss AvA über dem Billboard schweben' }), refs('drive.music', 'Musik', 'assets', { hint: '#117 Ton-Assets (Loops), je Fahrt der nächste; nicht, solange das Radio läuft' }), num('drive.musicVolume', 'Musik-Lautstärke', { unit: '%', min: 0, max: 100 }), num('drive.avaRope', 'AvA: Gummiband', { unit: '% der Bildbreite', min: 10, max: 100 }), num('drive.avaSize', 'AvA: Größe', { min: 0.1, step: 0.05 }), bool('drive.silhouettes', 'Vordergrund-Silhouetten', { hint: '#115: schwarze Formen der Region ganz vorne (Parallax-Set › Vordergrund)' }), num('drive.layerScale', 'Gemalte Ebenen: Maßstab', { unit: '%', min: 1 }), num('drive.influencer.discount', 'Influencer: Nachlass', { unit: '%', min: 0, max: 90, hint: '#064: ein Billboard während der Fahrt antippen = Buff „Influencer“ für diese Marke, so viel billiger (Standard 20)' }), num('drive.influencer.perfect', 'Influencer: perfektes Foto', { unit: '% des Nachlasses', min: 0, hint: '#095 Sucher: Billboard genau in der Mitte (Standard 150 = 30 % statt 20 %)' }), num('drive.influencer.edge', 'Influencer: knapp im Bild', { unit: '% des Nachlasses', min: 0, hint: 'Billboard am Rand des Suchers (Standard 50); daneben = verwackelt, nichts' }), num('drive.influencer.frame', 'Influencer: Sucher-Breite', { unit: '% der Billboard-Breite', min: 30, hint: 'Breiter = leichter (Standard 100)' }), num('drive.influencer.hours', 'Influencer: Dauer', { unit: 'h', min: 1, hint: 'Standard 24' }), num('drive.fast', 'Vorspulen', { unit: '×', min: 1, hint: 'E / A halten (Maus: gedrückt halten); Esc / B springt zum nächsten Halt' }),
        num('drive.speed', 'Tempo im Bild', { unit: 'Bildpixel/s', min: 10 }), num('drive.stopAt', 'Zwischenfall bei', { unit: '% der Etappe', min: 30, max: 95 }),
        num('drive.rigHeight', 'Rig-Höhe', { unit: '% des Bildes', min: 10, max: 70, hint: 'lange Rigs werden kleiner, damit sie ins Bild passen' }), num('drive.rigX', 'Rig-Front bei', { unit: '% von links', min: 30, max: 90 }),
        num('drive.bounce', 'Federn', { unit: 'px', min: 0, hint: 'jeder Anhänger federt für sich, etwas nach dem Van' })] },
      { title: 'Licht & Wetter unterwegs', fields: [num('drive.rays', 'Lichtstrahlen', { unit: '%', min: 0, max: 100, hint: 'bei tiefer Sonne' }), num('drive.flare', 'Lens Flare', { unit: '%', min: 0, max: 100 }),
        num('drive.headlights', 'Scheinwerfer', { unit: '%', min: 0, max: 100, hint: 'ab der Dämmerung, dazu rote Rücklichter' }), num('drive.haze', 'Hitzeflimmern', { unit: '%', min: 0, max: 100, hint: 'mittags über dem Horizont' }),
        num('drive.grain', 'Filmkorn', { unit: '%', min: 0, max: 100 })] },
      { title: 'Landschaften', fields: [table('landscapes', 'Landschaft je Region', [text('region', 'Region', { hint: 'wie in Reisekarte › Regionen; leer = für alle anderen' }), ref('parallax', 'Parallax-Set', 'parallax', { hint: '#115: gemalte Ebenen für Fahrt, Camp und POIs draußen in dieser Region' }), select('relief', 'Relief', RELIEFS),
        color('far', 'Berge'), color('mid', 'Hügel'), color('ground', 'Boden'), color('rock', 'Felsen'), color('plants', 'Pflanzen'), color('road', 'Asphalt'),
        num('ruins', 'Ruinen', { unit: '%', min: 0 }), num('wrecks', 'Wracks', { unit: '%', min: 0 }), num('towers', 'Türme', { unit: '%', min: 0 }), num('signs', 'Plakate', { unit: '%', min: 0 }),
        num('plantsN', 'Kakteen', { unit: '%', min: 0 }), num('poles', 'Masten', { min: 0, max: 1 }), num('pylons', 'Hochspannung', { min: 0, max: 1 }), num('city', 'Stadt am Horizont', { unit: '%', min: 0, max: 100 }), num('screens', 'Riesen-Billboards', { unit: '%', min: 0, max: 100, hint: '#055: Chance je Abschnitt für einen Bildschirm mit Werbung der Marken' }),
        num('dust', 'Staub', { unit: '% der Etappen', min: 0, max: 100 }), num('fog', 'Morgennebel', { unit: '% der Etappen', min: 0, max: 100 })],
        { hint: 'Aus Code gezeichnet (Daniel: 3c, PixelLab später). Die Dinge am Rand: je Abschnitt eine Chance in % (zusammen höchstens 100), Plakate zeigen die Marken der Lore. Die Etappe blendet von der Landschaft des Startorts in die des Ziels' })] },
    ],
  },
};

// Navigation: groups of areas in the order of the design document
export const GROUPS = [
  ['ASSETS', ['assets', 'pixelOrders', 'voices', 'sounds']],
  ['GRUNDLAGEN', ['game', 'splash', 'intro', 'tutorial', 'weather', 'economy', 'ranking', 'renames']],
  ['LEYLA', ['leyla', 'drone', 'backpacks']],
  ['KAMPF', ['weapons', 'enemies', 'kits', 'buffs']],
  ['BEUTE & CRAFTING', ['items', 'lootTables', 'recipes', 'crafting']],
  ['ACHIEVEMENTS & AUFTRÄGE', ['achievements', 'quests']],
  ['PROGRESSION', ['techtree', 'resources']],
  ['RIG', ['tank', 'camp', 'build', 'tractors', 'containers', 'workshops', 'rigParts', 'decor', 'decorSets', 'megarigs', 'rigAddons', 'salvage', 'people', 'companions']],
  ['WELT', ['worldmap', 'parallax', 'pois', 'rooms', 'terrain', 'atmosphere', 'locations', 'encounters', 'roadEvents', 'travel', 'radio']],
  ['LORE', ['brands']],
  ['ENTITIES', ['glitchlings']],
];

export const optionLabel = label;
export const fields = a => AREAS[a].sections.flatMap(s => s.fields);
