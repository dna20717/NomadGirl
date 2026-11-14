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
import { ACHIEVEMENT_COUNTERS, ACHIEVEMENT_SPECIALS, ACHIEVEMENT_CATEGORIES } from '../game/achievements.js';

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
const TROPHY_GEAR = [['defense', 'Abwehr %'], ['health', 'Leben'], ['damage', 'Schaden %'], ['melee', 'Nahkampf %'], ['ranged', 'Fernkampf %'], ['crit', 'Krit-Chance %'], ['speed', 'Tempo %'],
  ['jump', 'Sprungkraft %'], ['dashCooldown', 'Dash-Abklingzeit %'], ['regen', 'Heilt sich (LP/10 s)'], ['heal', 'Heilung %'], ['droneBattery', 'AvA-Akku %'], ['tankDecay', 'Tank: Verfall %']];
export const TECH_BONUS = [['tankDecay', 'Tank: Verfall %'], ['tankRescue', 'Tank: Rettung kostet %'], ['tankAccel', 'Tank: Beschleunigung %'],
  ['tankStatus', 'Tank-Anzeige im Run (1 = an)'], ['droneBattery', 'AvA: Akku %'], ['health', 'Leyla: Leben'], ['damage', 'Leyla: Schaden %']];
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
export const ITEM_TAGS = [['trophy', 'Trophäe']];
export const ITEM_CATEGORIES = [['junk', 'Schrott'], ['resource', 'Ressource'], ['ingredient', 'Zutat'], ['food', 'Gericht'], ['component', 'Bauteil'], ['consumable', 'Verbrauchsgut'], ['valuable', 'Wertsache'], ['blueprint', 'Bauplan/Rezept'], ['armor', 'Rüstung'], ['implant', 'Implantat'], ['dronepart', 'Drohnenteil'], ['progress', 'Fortschritt'], ['weaponpart', 'Waffenteil']];
// where a thing is worn (Daniel, 10.11.2026: Inventar im Diablo-Stil): Leyla's head + armor, implants in her body, parts on AvA
export const WEAR_SLOTS = [['head', 'Kopf'], ['armor', 'Rüstung'], ['eyes', 'Implantat: Augen'], ['nerves', 'Implantat: Nerven'], ['arm', 'Implantat: Cyberarm'], ['heart', 'Implantat: Herz'], ['legs', 'Implantat: Beine'], ['skin', 'Implantat: Haut'],
  ['bow', 'Drohne: Bug'], ['tail', 'Drohne: Heck'], ['core', 'Drohne: Kern'], ['module', 'Drohne: Modul']];
export const IMPLANT_SLOTS = ['eyes', 'nerves', 'arm', 'heart', 'legs', 'skin'];
export const DRONE_SLOTS = ['bow', 'tail', 'core', 'module'];
export const BUFF_STATS = [['health', 'Leben'], ['damage', 'Schaden'], ['speed', 'Tempo'], ['defense', 'Abwehr'], ['luck', 'Glück (Beute)'], ['backpack', 'Rucksackplätze'], ['fuel', 'Spritverbrauch']];
export const BUFF_DURATIONS = [['instant', 'Sofort'], ['run', 'Nächster Run'], ['travel', 'Nächste Reise'], ['seconds', 'Sekunden'], ['permanent', 'Dauerhaft']];
export const DISCOVERY = [['experiment', 'Experimentieren'], ['found', 'Fund im POI'], ['companion', 'Tipp von Companion'], ['shop', 'Bei NPCs kaufen'], ['start', 'Von Anfang an'], ['techtree', 'Knoten im Techtree'], ['achievement', 'Achievement']];
export const CONTAINER_KINDS = [['shipping', 'Hochseecontainer'], ['crate', 'Holzkiste'], ['trailer', 'Wohnwagenteil'], ['tank', 'Tank']];
export const PART_SLOTS_SCHEMA = [['lauf', 'Lauf'], ['griff', 'Griff'], ['schaft', 'Schaft'], ['magazin', 'Magazin'], ['visier', 'Visier'], ['klinge', 'Klinge'], ['kern', 'Kern']];
export const WORKSHOP_FUNCTIONS = [['tank', 'Cryo-Tank'], ['garden', 'Hydrokultur'], ['cistern', 'Zisterne'], ['storage', 'Lager'], ['guests', 'Gäste'], ['treasury', 'Schatzkammer'], ['cooling', 'Kühlung'], ['cell', 'Zelle'], ['sleep', 'Schlafen'], ['chill', 'Chillen'], ['drone', 'Drohnen'], ['warroom', 'Planung'], ['kitchen', 'Kochen'], ['foodtruck', 'Verkauf'], ['craft', 'Herstellen'], ['cyber', 'Cyberware (Ripperdoc)'], ['engine', 'Motor'], ['power', 'Energie']];
export const BENCH_FX = [['light', 'Licht'], ['screen', 'Bildschirm'], ['steam', 'Dampf'], ['smoke', 'Rauch'], ['sparks', 'Funken'], ['flame', 'Flamme'], ['blink', 'LED blinkt'], ['twinkle', 'Lichter funkeln'], ['bubbles', 'Blasen'], ['fish', 'Fische'], ['lava', 'Lavalampe'], ['scan', 'Druckkopf'], ['shine', 'Glanz']];
export const BENCH_FX_WHEN = [['always', 'Immer'], ['night', 'Abends'], ['near', 'In der Nähe'], ['use', 'Bei Benutzung']];
export const RIG_SLOTS = [['engine', 'Motor'], ['armor', 'Panzerung'], ['weapon', 'Waffe'], ['roof', 'Dach'], ['solar', 'Solar (Container-Dach)']];
export const POI_KINDS = [['gasStation', 'Tankstelle'], ['settlement', 'Siedlung'], ['factory', 'Fabrik'], ['bunker', 'Bunker'], ['government', 'Regierungskomplex'], ['mall', 'Einkaufszentrum'], ['ruin', 'Ruine']];
export const POI_SIZES = [['S', 'S'], ['M', 'M'], ['L', 'L'], ['XL', 'XL']];
export const ROOM_TAGS = [['start', 'Eingang'], ['exit', 'Ausgang'], ['combat', 'Kampf'], ['loot', 'Beute'], ['secret', 'Geheimnis'], ['npc', 'NPCs'], ['boss', 'Boss'], ['corridor', 'Gang']];
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
export const RANKING_CATEGORIES = [['time', 'Durchlaufzeit'], ['kills', 'Kills in %'], ['secrets', 'Secrets']];

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
        num('volume', 'Grundlautstärke', { unit: '%', min: 0, max: 200, hint: 'Gleicht laute und leise Aufnahmen aus' })] },
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
      { title: 'Technik', fields: [text('title', 'Titel'), num('tileSize', 'Kachelgröße', { unit: 'px', min: 8 }), num('gravity', 'Schwerkraft', { unit: 'px/s²', min: 0 }),
        bool('confirmLeave', 'Rückfrage beim Abreisen', { hint: 'Daniel, 13.11.2026: am Van im POI fragt das Spiel „Wirklich zurückreisen?“. Aus = sofort zurück ins Camp' }),
        size('resolution', 'Auflösung', { unit: 'px', hint: 'Interne Auflösung, wird skaliert' }), bool('pixelArt', 'Pixel-Art (scharf skalieren)')] },
      { title: 'Zielzeile', fields: [bool('quest.enabled', 'Zielzeile zeigen', { hint: '#016 roter Faden: im HUD, auf der Karte und nach dem Run steht der nächste Schritt zum Heilmittel bzw. der Tank, wenn er schwach ist' }),
        ref('quest.goal', 'Endziel', 'techtree', { hint: 'Knoten, auf den alles hinläuft. Leer = heilmittel' }), num('quest.tankWarn', 'Tank zuerst unter', { unit: '%', min: 0, max: 100, hint: 'Unter diesem Zustand zeigt die Zielzeile den Tank statt des Techtrees. Leer = 45' })] },
      { title: 'Tutorial', fields: [bool('tutorial.enabled', 'Lektionen beim ersten Mal', { hint: '#011: Karte mit Clip, wenn man etwas zum ersten Mal sieht oder kann. Spieler können sie unter Menü › Optionen abschalten' }), num('tutorial.gap', 'Abstand zwischen zwei Karten', { unit: 's', min: 0 })] },
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
      { title: 'Nebel', fields: [bool('fog.enabled', 'Nebel des Unbekannten', { hint: 'Daniel, 11.11.2026: nur in Innenräumen und nur über Luft, die Leyla erreichen kann; was sie einmal gesehen hat, bleibt aufgedeckt. Fels und Unerreichbares bleiben sichtbar' }),
        num('fog.density', 'Dichte', { unit: '%', min: 0, max: 100, hint: 'Dunkler Dunst, Umrisse bleiben erkennbar' }), num('fog.secretDensity', 'Hinter Secrets', { unit: '%', min: 0, max: 100, hint: 'Luft, die nur durch Scheinwand oder brüchige Wand erreichbar ist' }),
        num('fog.walls', 'Wände', { unit: '%', min: 0, max: 100, hint: 'Wände bekommen so viel vom Nebel ihrer klarsten Nachbar-Luft' }),
        num('fog.sight', 'Sicht', { unit: 'Kacheln', min: 1, hint: 'Sichtlinien von Leylas Augen, Wände halten sie auf' }), num('fog.fade', 'Aufdecken dauert', { unit: 'ms', min: 0 }),
        num('fog.fakeFade', 'Scheinwand blendet aus', { unit: 'ms', min: 0 }), color('fog.color', 'Farbe')] },
      { title: 'Kampf', fields: [select('combat.shootStyle', 'Schießstil', [['classic', 'Klassisch (zum Schießen stehen oder gehen)'], ['cells', 'Cells-like (Schießen im Rennen, Zielhilfe)']], { hint: 'Daniel, 11.11.2026 (design.md): zwei Varianten zum Ausprobieren. Im Spiel umschaltbar unter Menü › Optionen (gilt dann nur in diesem Browser)' }),
        num('combat.runSpeed', 'Tempo mit Waffe', { unit: '%', min: 10, max: 100, hint: 'Cells-like: Renntempo mit gezogener Waffe' }),
        num('combat.cone', 'Zielkegel', { unit: '°', min: 0, max: 89, hint: 'Cells-like: ± um die Blickrichtung' }), num('combat.range', 'Zielweite', { unit: 'Kacheln', min: 0 }),
        num('combat.bulletSpeed', 'Kugeltempo', { unit: 'px/s', min: 0, hint: 'Cells-like; leer = Tempo der Waffe' }), bool('combat.marker', 'Ziel-Marker', { hint: 'Ecken um den Gegner, den der nächste Schuss trifft' }), color('combat.markerColor', 'Marker-Farbe'),
        num('combat.noiseShot', 'Lärm: Schuss', { unit: 'px', min: 0, hint: 'So weit hören Gegner Leylas Schüsse (× ihr „Hört“, durch Wände die Hälfte). Leer = 900' }),
        num('combat.noiseMelee', 'Lärm: Nahkampf', { unit: 'px', min: 0, hint: 'Treffer, Block, Hieb gegen die Wand. Leer = 380' })] },
      { title: 'Kampf · Blut', fields: [bool('combat.blood.enabled', 'Blutspritzer', { hint: 'Daniel, 12.11.2026: „mehr Treffer-Feedback in Form von Blutspritzern“. Spritzer in Schlagrichtung (mehr bei mehr Schaden und Krits), roter Nebel, Tropfen bleiben am Boden und laufen Wände runter, beim Tod eine Lache. Maschinen sprühen Funken und Öl. Aus = die alten kleinen Partikel' }),
        num('combat.blood.amount', 'Menge', { unit: '%', min: 0, max: 400, hint: 'Leer = 100' }), bool('combat.blood.decals', 'Bleibt liegen', { hint: 'Flecken am Boden und an Wänden' }),
        num('combat.blood.stay', 'Verblasst nach', { unit: 's', min: 1, hint: 'Leer = 20' }), num('combat.blood.max', 'Höchstens', { unit: 'Flecken', min: 10, hint: 'Ältere verschwinden zuerst. Leer = 160' }),
        color('combat.blood.color', 'Farbe', { hint: 'Leer = dunkles Rot' })] },
      { title: 'Kamera', fields: [num('camera.zoom', 'Zoom', { min: 0.3, max: 2, step: 0.05, hint: '1 = 1920×1080 Spielpixel sichtbar, 0,75 = weiter raus (mehr sichtbar), über 1 = näher ran' }),
        num('camera.lookAhead', 'Vorlauf', { unit: 'px', min: 0, hint: 'So weit schaut die Kamera in Laufrichtung voraus' }), num('camera.follow', 'Nachziehen', { min: 0.01, max: 1, step: 0.01, hint: '1 = klebt an Leyla, kleiner = weicher' })] },
      { title: 'Kacheln', fields: [ref('tiles.platform', 'Plattform', 'assets', { hint: 'Asset der Art „Kacheln“ mit 4 Frames: einzeln, links, Mitte, rechts. Leer = aus Code gezeichnet' }),
        ref('tiles.terrain', 'Kachel-Set', 'terrain', { hint: 'Wände und Böden in allen Räumen ohne eigenes Kachel-Set. Leer = aus Code gezeichnet' }),
        bool('tiles.depth', 'Tiefe aus Code', { hint: 'Licht, Schatten und Masse für alle Kachel-Sets (Kachel-Sets › Tiefe); aus = flach wie früher' }), num('tiles.leylaCm', 'Leyla ist groß', { unit: 'cm', min: 50, hint: 'Maßstab für Clutter-Größen: Leylas Höhe im Spiel (Asset Stehen) entspricht so vielen Zentimetern. Leer = 170' })] },
      { title: 'Atmosphäre', fields: [bool('atmosphere.enabled', 'Licht & Atmosphäre', { hint: 'Dunkelheit mit Lampen, Glühen, Farbstimmung, Staub, Funken, Tropfen und Bodennebel (Bereich Atmosphäre). Aus = alles gleich hell wie früher. Nicht im Camp' }),
        ref('atmosphere.default', 'Standard', 'atmosphere', { hint: 'Für Räume, deren Raum-Baustein und Kachel-Set keine Atmosphäre nennen. Leer = keine' }),
        num('atmosphere.scale', 'Lichtkarte grob', { unit: '×', min: 1, max: 16, hint: 'Die Lichtkarte wird in 1/n der Auflösung gerechnet und weich hochskaliert. Größer = schneller und weicher. Leer = 4' }),
        num('atmosphere.leyla.radius', 'Licht um Leyla', { unit: 'px', min: 0, hint: 'Kleiner Schein um Leyla, damit sie im Dunkeln nie ganz verschwindet' }), num('atmosphere.leyla.strength', 'Licht um Leyla', { unit: '%', min: 0, max: 100 }),
        num('atmosphere.depth', 'Ebene', { hint: 'Tiefe der Lichtkarte: alles darunter wird abgedunkelt (Leyla 10, schwebende Zahlen 20). Leer = 14' })] },
      { title: 'Spawn-Punkt', fields: [bool('spawn.enabled', 'Zeigen'), ref('spawn.look', 'Aussehen', 'assets', { hint: 'Bild oder Animation; der Ankerpunkt des Assets sitzt auf Leylas Start (L im Raum-Layout)' }),
        point('spawn.offset', 'Versatz', { unit: 'px', hint: 'Verschiebt das Bild gegenüber dem Start (x nach rechts, y nach unten)' }), bool('spawn.flip', 'Gespiegelt'),
        select('spawn.layer', 'Ebene', [['behindWalls', 'Hinter Wänden'], ['front', 'Vor Wänden, hinter Leyla']], { hint: 'Hinter Wänden: Wände verdecken das Bild, wenn es hineinragt' })] },
      { title: 'Spawn-Punkt · Tür', fields: [bool('spawn.door.enabled', 'Tür bewegt sich', { hint: 'Animation des Aussehens: erster Frame zu, letzter offen; läuft vor oder zurück' }),
        num('spawn.door.openRange', 'Öffnet ab', { unit: 'px', min: 0, hint: 'Abstand Leyla – Ankerpunkt (Höhe zählt 1,5-fach)' }),
        num('spawn.door.closeRange', 'Schließt ab', { unit: 'px', min: 0, hint: 'Etwas größer als „Öffnet ab“, sonst flattert die Tür' }),
        num('spawn.door.fps', 'Tempo', { unit: 'fps', min: 1, hint: 'Leer = fps des Assets' })] },
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
        table('start.inventory', 'Start-Inventar', [select('where', 'Wo', [['backpack', 'Rucksack'], ['chest', 'Kiste im Camp'], ['storage', 'Erstes Lager (sonst Kiste)']]), ref('item', 'Gegenstand', 'items'), ref('weapon', 'Waffe', 'weapons'), ref('backpack', 'Rucksack', 'backpacks'), num('count', 'Anzahl', { min: 1 })],
          { hint: 'Pro Zeile ein Gegenstand, eine Waffe oder ein Rucksack. Platz suchen die Dinge sich selbst' }),
        table('start.later', 'Nachreichen', [select('where', 'Wo', [['backpack', 'Rucksack'], ['chest', 'Kiste im Camp']]), ref('item', 'Gegenstand', 'items'), ref('weapon', 'Waffe', 'weapons'), ref('backpack', 'Rucksack', 'backpacks'), num('count', 'Anzahl', { min: 1 }), bool('force', 'Platz machen', { hint: 'Wer es noch nicht hat, bekommt es; passt es nicht, fliegen die neuesten Dinge raus' })],
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
    hint: 'Die Startseite (online unter /): Hintergrund aus Ebenen, Leyla rennt endlos auf uns zu, der Boden fliegt unter ihr durch. Pixel-Art wird scharf skaliert.',
    sections: [
      { title: 'Hintergrund', fields: [refs('background', 'Ebenen', 'assets', { hint: 'Von hinten nach vorn. Alle gleich groß; mit Wetter darf auch die erste transparent sein' }), ref('weather', 'Wetter', 'weather', { hint: 'Himmel hinter den Ebenen, Regen davor' }),
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
        text('intro.title', 'Titel am Ende', { hint: 'Erscheint nach dem letzten Panel, dann geht es zurück ins Hauptmenü' }), text('intro.subtitle', 'Untertitel am Ende')] },
      { title: 'Horizont-Dunst', fields: [bool('haze.enabled', 'Zeigen', { hint: 'Weicher Übergang zwischen Kulisse und Boden: Hitzeflimmern, Pixel-Raster, warmer Dunst' }),
        num('haze.fade', 'Übergang', { unit: 'Bildpixel', min: 0, hint: 'So hoch reicht der Boden mit Raster ins Bild' }), num('haze.band', 'Flimmer-Höhe', { unit: 'Bildpixel', min: 0 }),
        num('haze.shimmer', 'Flimmern', { unit: 'Bildpixel', min: 0, step: 0.5, hint: 'Wie weit die Zeilen seitlich zittern' }), num('haze.speed', 'Flimmer-Tempo', { min: 0, step: 0.1 }),
        num('haze.glow', 'Dunst', { unit: '%', min: 0, max: 100 }), color('haze.color', 'Dunst-Farbe', { hint: 'Leer = Horizont-Farbe des Wetters' })] },
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
      { title: 'Währung', fields: [text('currency.name', 'Name'), text('currency.symbol', 'Symbol'), num('startDeltas', 'Startgeld', { unit: 'Δ', min: 0 }), area_('currency.description', 'Hintergrund')] },
      { title: 'Tod', fields: [text('rescue.drone', 'Rettungsdrohne'), bool('rescue.losesRunLoot', 'Run-Beute geht verloren'), bool('rescue.losesEquipped', 'Ausgerüstetes geht verloren'),
        num('rescue.keepPercent', 'AvA rettet', { unit: '%', min: 0, max: 100, hint: 'Anteil der Run-Beute, den AvA mitbringt (später über Drohnen-Upgrades)' }), area_('rescue.description', 'Ablauf')] },
      { title: 'Foodtruck', fields: [num('foodtruck.priceFactor', 'Preisfaktor', { step: 0.05, min: 0, hint: 'Verkaufspreis = Wert × Faktor' }), num('foodtruck.maxPerStop', 'Max. Verkäufe pro Halt', { min: 0 })] },
    ],
  },
  ranking: {
    name: 'Ranking', icon: 'star', file: 'data/ranking.json', kind: 'single',
    hint: 'Nach einem abgeschlossenen POI gibt jede Kategorie Punkte. Die Summe ergibt den Rang, der Rang einen Deltas-Bonus auf das sichere Basisgeld. Wer stirbt, bekommt kein Ranking.',
    sections: [
      { title: 'Kategorien', fields: [num('points.time', 'Durchlaufzeit', { unit: 'Punkte', min: 0, hint: 'Volle Punkte bei Bestzeit des POI oder schneller' }), num('points.kills', 'Kills', { unit: 'Punkte', min: 0, hint: 'Anteil besiegter Gegner × Punkte' }),
        num('points.secrets', 'Secrets', { unit: 'Punkte', min: 0, hint: 'Anteil gefundener Secrets × Punkte' }), num('timeFalloff', 'Zeit-Abfall', { unit: '%/10 s', min: 0, hint: 'Punktabzug je 10 s über der Bestzeit' })] },
      { title: 'Ränge', fields: [table('grades', 'Ränge', [text('grade', 'Rang'), num('minPoints', 'ab Punkten', { min: 0 }), num('bonus', 'Bonus %', { min: 0 })], { hint: 'Von schlecht nach gut sortiert' })] },
    ],
    check: (x, report) => {
      const g = x.grades || [];
      for (let i = 1; i < g.length; i++) if ((g[i].minPoints ?? 0) <= (g[i - 1].minPoints ?? 0)) report('warning', `Rang ${g[i].grade} braucht nicht mehr Punkte als ${g[i - 1].grade}`);
      const max = (x.points?.time || 0) + (x.points?.kills || 0) + (x.points?.secrets || 0);
      if (g.length && g.at(-1).minPoints > max) report('error', `Rang ${g.at(-1).grade} braucht ${g.at(-1).minPoints} Punkte, es gibt aber nur ${max}`);
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
      { title: 'Drohne', fields: [NAME, ref('look', 'Hülle', 'assets', { hint: 'Bild der Drohne ohne Gesicht, Ankerpunkt = Mitte des Körpers. Ältere Drohnen: Animation mit einem Frame pro Stimmung' }), num('height', 'Höhe im Spiel', { unit: 'px', min: 8, hint: 'Leer = Höhe aus dem Asset' }),
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
      { title: 'Stimmungen', fields: [table('moods', 'Stimmungen', [select('mood', 'Anlass', DRONE_MOODS), num('frame', 'Gesicht', { min: 0 }), text('kaomoji', 'Kaomoji'), num('duration', 'Dauer ms', { min: 0 })],
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
      { title: 'Allgemein', fields: [NAME, num('health', 'Leben', { min: 1 }), num('invulnerableAfterHit', 'Unverwundbar nach Treffer', { unit: 'ms', min: 0 }), DESCRIPTION] },
      { title: 'Laufen & Springen', fields: [num('movement.walkSpeed', 'Gehen', { unit: 'px/s', min: 0 }), num('movement.runSpeed', 'Rennen', { unit: 'px/s', min: 0 }),
        num('movement.acceleration', 'Beschleunigung', { unit: 'px/s²', min: 0 }), num('movement.jumpVelocity', 'Sprungkraft', { unit: 'px/s', min: 0 }),
        num('movement.airJumps', 'Luftsprünge', { min: 0, hint: '1 = Doppelsprung' }), num('movement.airJumpFromFrame', 'Doppelsprung ab Frame', { min: 1, hint: '1 = ganze Animation einmal; größer = nur die Frames ab hier, über die Doppelsprung-Dauer (z. B. die letzten Dash-Frames)' }),
        num('movement.airJumpTime', 'Doppelsprung-Dauer', { unit: 'ms', min: 50, hint: 'Nur mit „ab Frame“ > 1' }), num('movement.airJumpTilt', 'Doppelsprung-Neigung', { unit: '%', min: 0, hint: 'Pose neigt sich in die Sprungrichtung (100 = ganz)' }),
        bool('movement.airJumpGhosts', 'Doppelsprung-Nachbilder', { hint: 'Nachbilder wie beim Dash' }),
        num('movement.airJumpSpin', 'Salto: Umdrehungen', { min: 0, hint: 'Doppelsprung als Salto (12.11.2026): die Kugel-Frames drehen sich im Code so oft um den Körper-Mittelpunkt; 0 = aus' }),
        range('movement.airJumpTuck', 'Salto: Kugel-Frames', { hint: 'Von–bis (1 = erster Frame): davor rollt sie sich ein, danach öffnet sie sich' }), range('movement.airJumpPhase', 'Salto: Drehen von–bis', { unit: '%', hint: 'Anteil der Doppelsprung-Dauer, in dem sie sich dreht' }),
        num('movement.airJumpPivot', 'Salto: Drehpunkt über den Füßen', { unit: 'Bildpixel', min: 0 }), num('movement.coyoteTime', 'Coyote Time', { unit: 'ms', min: 0, hint: 'Springen kurz nach der Kante erlaubt' }),
        num('movement.jumpBuffer', 'Sprungpuffer', { unit: 'ms', min: 0 })] },
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
    sections: [
      { title: 'Waffe', fields: [NAME, LOOK, ICON, multi('tags', 'Tags', ITEM_TAGS), select('kind', 'Art', WEAPON_KINDS, { required: true }), num('tier', 'Stufe', { min: 1, max: 5 }),
        text('glyph', 'Kürzel', { hint: 'Platzhalter im Inventar: 1–3 Zeichen oder ein Emoji' }), DESCRIPTION,
        select('skin', 'Aussehen aus Code', [['', 'wie gemalt'], ['revolver', 'Revolver']], { hint: 'Nur Fernkampf, Test (Daniel, 12.11.2026): legt eine Waffe aus Code über die gemalte Pistole in den Posen mit ausgestreckten Armen. An der Brust bleibt vorerst die gemalte' })] },
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
      { title: 'Gegner', fields: [NAME, LOOK, select('family', 'Familie', ENEMY_FAMILIES), select('behavior', 'Verhalten', ENEMY_BEHAVIORS), DESCRIPTION] },
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
        num('sense.search', 'Sucht', { unit: 'ms', min: 0, hint: 'So lange schaut er sich dort um, dann gibt er auf („…“) und patrouilliert wieder. Leer = 5000' })] },
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
        table('bonus', 'Boni', [select('stat', 'Wert', TECH_BONUS), num('value', 'Änderung')], { hint: 'Passive Boni, gelten sofort und in jedem Durchgang. Prozent: −15 = 15 % weniger' })] },
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
      { title: 'Rucksack & Handel', fields: [size('size', 'Größe', { unit: 'Felder', hint: 'Rechteck im Raster; eine Form (unten) hat Vorrang' }),
        lines('shape', 'Form', { hint: 'Tetris-Form: eine Zeile pro Reihe, # = belegt, . = frei (z. B. „#.“ / „##“ für ein L). Leer = Rechteck aus „Größe“. Im Spiel mit Rechtsklick drehbar' }),
        num('stack', 'Stapel', { min: 1 }), text('glyph', 'Kürzel', { hint: 'Platzhalter im Inventar, solange es kein Aussehen gibt: 1–3 Zeichen oder ein Emoji' }), VALUE] },
      { title: 'Wirkung', fields: [ref('buff', 'Buff beim Essen/Benutzen', 'buffs'), ref('teaches', 'Bringt Rezept bei', 'recipes', { hint: 'Für Baupläne und Kochbücher' })] },
      { title: 'Ausrüstung', fields: [select('wear', 'Trägt man als', [['', '—'], ...WEAR_SLOTS], { hint: 'Kopf und Rüstung an Leyla, Implantate in ihrem Körper (nur im Camp einbauen), Teile an AvA' }),
        select('tier', 'Stufe', [['', '—'], [1, 'Einfach'], [2, 'Gut'], [3, 'Perk + Flaw']], { hint: 'Cyberware (#006): Stufe 3 = sehr großer Vorteil mit Nachteil (negativer Wert), wie Traits in Fallout. Rahmen im Inventar: grau, cyan, gold' }),
        num('stats.defense', 'Abwehr', { unit: '%', hint: 'Weniger Schaden, zählt mit Buffs zusammen (höchstens 90 %). Negative Werte sind Nachteile (rot im Tooltip)' }), num('stats.health', 'Leben', { unit: 'LP' }), num('stats.damage', 'Schaden', { unit: '%' }), num('stats.speed', 'Tempo', { unit: '%' }),
        num('stats.melee', 'Nahkampf', { unit: '%', hint: 'Nur Nahkampf-Schaden, zusätzlich zu Schaden' }), num('stats.ranged', 'Fernkampf', { unit: '%', hint: 'Nur Fernkampf-Schaden, zusätzlich zu Schaden' }),
        num('stats.crit', 'Krit-Chance', { unit: '%', hint: 'Kommt zur Krit-Chance der Waffe dazu (Krit = doppelter Schaden)' }), num('stats.jump', 'Sprungkraft', { unit: '%' }),
        num('stats.dashCooldown', 'Dash-Abklingzeit', { unit: '%', hint: 'Negativ = schneller wieder bereit' }),
        num('stats.airJumps', 'Sprünge in der Luft', { hint: 'Doppelsprung: 1 = einer in der Luft. Mit Leyla › Fähigkeiten › nur mit Implantat kommt er nur von hier' }),
        num('stats.airDash', 'Luft-Dash', { min: 0, max: 1, hint: '1 = Leyla darf in der Luft dashen (mit Leyla › Fähigkeiten › nur mit Implantat). Am Boden geht der Dash immer' }),
        num('stats.regen', 'Heilt sich', { unit: 'LP/10 s', step: 0.5, hint: 'Negativ = Leben sickert (nie unter 1 LP)' }), num('stats.heal', 'Heilung', { unit: '%', hint: 'Wirkung von Medikits und Heil-Essen' }),
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
      if (x.shape?.length) { const w = Math.max(...x.shape.map(r => r.length)); if (!x.shape.join('').includes('#')) report('error', 'Form ohne belegtes Feld (#)'); if (x.shape.some(r => /[^#. ]/.test(r))) report('error', 'Form: nur # und . erlaubt'); if (w > 6 || x.shape.length > 6) report('warning', 'Form größer als 6 × 6'); }
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
    check: (x, report) => {
      if (!(x.ingredients || []).length) report('error', 'Rezept ohne Zutaten');
      if (!x.result && !x.part && !x.tank && !x.weapon) report('warning', 'Rezept ohne Ergebnis (Gegenstand, Waffe, Rig-Teil oder Tank-Wartung)');
      if (x.result && x.part) report('warning', 'Gegenstand und Rig-Teil: das Rig-Teil gewinnt');
      if ((x.ingredients || []).some(i => i.item === x.result)) report('warning', 'Ergebnis ist auch Zutat');
      const kinds = (x.ingredients || []).map(i => i.item); if (new Set(kinds).size !== kinds.length) report('warning', 'Eine Zutat steht doppelt in der Liste (Anzahl erhöhen)');
    },
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
        num('power', 'Lichtmaschine', { unit: '⚡', min: 0, hint: 'Energie für Werkstätten ohne Generator' })] },
      { title: 'Payload', fields: [num('places', 'Werkstatt-Plätze im Fahrzeug', { min: 0, max: 3, hint: 'Eigene Plätze wie ein kleiner Container (Van: Schlafkoje + Warroom). Im Camp per E an der Tür' }),
        num('length', 'Plätze hintereinander', { min: 0 }), num('stack', 'Stapelhöhe', { min: 1, hint: 'Wie viele Etagen übereinander: 1 = nicht stapeln, 2 = ein Container auf jedem Anhänger, der „Trägt obendrauf“ hat' })] },
      { title: 'Stauraum', fields: [size('storage', 'Eigener Stauraum', { unit: 'Felder', hint: 'Kleines Inventar im Fahrzeug selbst (Van: Kofferraum), auch ohne Anhänger. Im Camp per E an der Hecktür. Leer = keiner' }),
        text('storageName', 'Name', { hint: 'z. B. Kofferraum' })] },
      { title: 'Blick durch die Tür', fields: [range('door.x', 'Türöffnung von – bis', { unit: 'Bildpixel', hint: 'Waagrecht im Bild des Aussehens (letzter Frame = Tür offen). Durch die offene Tür sieht man die Werkstatt dahinter, am Rand abgeschnitten' }),
        range('door.y', 'Türöffnung oben – unten', { unit: 'Bildpixel', hint: 'Unten = Boden im Fahrzeug, darauf steht die Werkstatt' }), num('door.place', 'Platz hinter der Tür', { min: 0, max: 2, hint: '0 = erster Werkstatt-Platz im Fahrzeug, 1 = zweiter …' }),
        color('door.backdrop', 'Innenraum dahinter', { hint: 'Farbe hinter dem Bild, wo die Werkstatt durchsichtig ist' })] },
      { title: 'Slots', fields: [num('slots.engine', 'Motor', { min: 0 }), num('slots.armor', 'Panzerung', { min: 0 }), num('slots.weapon', 'Waffen', { min: 0 }),
        num('slots.roof', 'Dach', { min: 0, hint: 'Für Dachbox und Ähnliches' })] },
    ],
  },
  containers: {
    name: 'Container', singular: 'Container', icon: 'box', file: 'data/containers.json', kind: 'catalog', groupBy: { key: 'kind', options: CONTAINER_KINDS },
    hint: 'Payload des Rigs. Je nach Größe fasst ein Container eine, zwei oder drei Werkstätten.',
    template: { name: 'Neuer Container', kind: 'crate', places: 1, weight: 300, value: 100 },
    row: x => `${label(CONTAINER_KINDS, x.kind)} · ${x.places ?? 0} ${x.places === 1 ? 'Platz' : 'Plätze'} · ${x.weight ?? 0} kg`,
    sections: [{ title: 'Container', fields: [NAME, LOOK, select('kind', 'Art', CONTAINER_KINDS), num('places', 'Werkstatt-Plätze', { min: 1, max: 3 }),
      num('weight', 'Gewicht', { unit: 'kg', min: 0 }), bool('stackable', 'Stapelbar', { hint: 'Darf oben auf einem anderen Anhänger oder Container stehen' }),
      bool('carries', 'Trägt obendrauf', { hint: 'Auf dem Dach darf ein stapelbarer Container stehen. Wie hoch, bestimmt die Zugmaschine (Stapelhöhe)' }), VALUE, DESCRIPTION,
      bool('retired', 'Ausgemustert', { hint: 'Daniel, 13.11.2026: „Die Modul-Anhänger soll es nicht mehr geben“. Nicht kaufbar, nicht im Start; alte Spielstände bekommen stattdessen „Ersetzt durch“ (mit denselben Werkstätten)' }), ref('replacedBy', 'Ersetzt durch', 'containers')] },
      { title: 'Stauraum', fields: [size('storage', 'Eigener Stauraum', { unit: 'Felder', hint: 'Kleines Inventar am Anhänger selbst (Deichselkasten), unabhängig von den Werkstätten. Im Camp per E an der Deichsel. Abhängen und Verkaufen nur, wenn er leer ist. Leer = keiner' }),
        text('storageName', 'Name', { hint: 'z. B. Deichselkasten' })] },
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
        ref('buff', 'Buff', 'buffs', { hint: 'z. B. Schlafzimmer oder Chill Area' }), size('grid', 'Lager-Raster', { unit: 'Felder', hint: 'Ist dieser Platz ein Inventar (Lager, Kühlraum, Waffenkammer): Größe des Rasters. Leer = kein Lager' }), VALUE] },
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
          text('rows', 'Reihen auf', { hint: 'je Raster-Reihe (oben → unten) das Regalbrett: Boden-y, optional @x+Breite; mit ; trennen, z. B. „49@37+56; 92@37+56“. Leer = Reihen gleichmäßig in der Fläche' })],
          { hint: 'Daniel, 11.11.2026: Platz an der Wand für Trophäen, jeder Ständer ist ein eigenes Inventar und zeigt jedes Ding in seiner echten Größe. x/y/Breite/Höhe = Fläche im Aussehen (Bildpixel); nur Dinge mit Tag „Trophäe“' })] },
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
  companions: {
    name: 'Companions', singular: 'Companion', icon: 'humans', file: 'data/companions.json', kind: 'catalog',
    hint: 'Leben im Rig, betreiben Werkstätten, geben Buffs und Rezept-Tipps. Eigene Quests kommen in Ausbaustufe 2.',
    template: { name: 'Neuer Companion', role: '', workshops: [], buffs: [], tips: [], stage: '1' },
    row: x => x.role || '',
    sections: [
      { title: 'Companion', fields: [NAME, LOOK, text('role', 'Rolle'), STAGE, DESCRIPTION] },
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
        num('height', 'Höhe', { unit: 'Kacheln', min: 8 }), ref('ground.tiles', 'Boden-Kacheln', 'assets', { hint: 'Asset der Art Kacheln, Frames: 0 Oberfläche, 1 Füllung, 2 Kante mit Wand links, 3 Säule, 4 Wand links, 5 Wand rechts, 6 und 7 Oberfläche mit Gras. Leer = Erde aus Code' }),
        color('ground.color', 'Boden'), color('ground.top', 'Bodenkante'), color('ground.far', 'Ebene in der Ferne'), num('horizon', 'Horizont', { unit: '%', min: 20, max: 95, hint: 'Vom oberen Bildschirmrand' }), DESCRIPTION] },
      { title: 'Schrottplatz', fields: [bool('yard.enabled', 'Zeigen', { hint: 'Daniel: Lager beim Bauen = Schrottplatz links beim Schacht. Ausgebaute Werkstätten stehen auf Paletten, abgehängte Anhänger parken dahinter' }),
        num('yard.width', 'Breite', { unit: 'Kacheln', min: 4 }), bool('yard.dealer', 'Händler-Platz', { hint: 'Hier abstellen = verkaufen; Gekauftes wird hier geliefert' }), text('yard.dealerName', 'Name am Schild'),
        num('yard.dealerWidth', 'Breite Händler-Platz', { unit: 'px', min: 80 }), num('yard.palletScale', 'Werkstätten auf Paletten', { unit: '% Größe', min: 20, max: 100 }), num('yard.partScale', 'Rig-Teile im Regal', { unit: '% Größe', min: 20, max: 200 }),
        num('yard.parkScale', 'Geparkte Anhänger', { unit: '% Größe', min: 20, max: 100 })] },
      { title: 'Verpackte Werkstätten', fields: [ref('yard.crate.look', 'Kiste', 'assets', { hint: 'Ausgebaute Werkstätten liegen auf dem Schrottplatz verpackt in Kisten. Grafik der Kiste mit Label; leer = Platzhalter aus Code' }),
        num('yard.crate.height', 'Höhe', { unit: 'px', min: 40 }), point('yard.crate.labelAt', 'Label Mitte', { unit: 'Bildpixel', hint: 'Wo auf der Kiste das Label sitzt; dort steht der Name der Werkstatt' }), size('yard.crate.labelSize', 'Label Größe', { unit: 'Bildpixel' }),
        num('yard.crate.fontSize', 'Schriftgröße', { unit: 'px', min: 8 }), color('yard.crate.ink', 'Schriftfarbe')] },
      { title: 'Schacht', fields: [bool('shaft.enabled', 'Zeigen', { hint: 'Daniel: Andeutung eines Schachts nach unten, links im Camp, nicht betretbar' }), num('shaft.at', 'Ab Spalte', { unit: 'Kacheln', min: 1 }),
        num('shaft.width', 'Breite', { unit: 'Kacheln', min: 1 }), color('shaft.color', 'Dunkelheit'), color('shaft.glow', 'Glühen von unten', { hint: 'Leer = nichts' }), num('shaft.frameHeight', 'Förderturm', { unit: 'px', min: 0, hint: 'Holzgerüst mit Rolle und Seil über dem Schacht, 0 = keins' })] },
      { title: 'Fahrgestell', fields: [ref('chassis.look', 'Teile', 'assets', { hint: 'Daniels modularer Anhänger: ein Bild mit Deichsel + Rahmen, Mittelstück, Achse und Heck nebeneinander (Deichsel links). Das Camp setzt daraus für jeden Container mit „Auf Fahrgestell“ eins in seiner Länge zusammen, Deichsel zum Van' }),
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
        num('rig.boxAt', 'Deichselkasten bei', { unit: '%', min: 0, max: 100, hint: 'Wo der Kasten auf der Deichsel sitzt (0 = am Aufbau, 100 = an der Kupplung); E dort öffnet den Stauraum des Anhängers' }),
        num('rig.trunkAt', 'Kofferraum bei', { unit: '%', min: 0, max: 100, hint: 'E-Punkt für den Stauraum der Zugmaschine, von links über die Breite des Vans' }),
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
      { title: 'Am Feuer sitzen', fields: [ref('fire.sit.look', 'Animation', 'assets', { hint: 'Daniel: Leyla sitzt am Feuer und zockt, gespiegelt je nach Seite. E setzt sie hin, E oder Laufen steht auf' }),
        num('fire.sit.distance', 'Abstand zum Feuer', { unit: 'px', min: 0 }), num('fire.sit.downTo', 'Hinsetzen bis Frame', { min: 1 }), range('fire.sit.loop', 'Schleife Frames'),
        num('fire.sit.upFrom', 'Aufstehen ab Frame', { min: 1 }), refs('fire.sit.sounds', 'Töne beim Zocken', 'assets', { hint: 'Daniel: zufällig verketten, leise, klein und weit weg. Laufen, solange sie zockt' }),
        range('fire.sit.soundGap', 'Abstand zwischen Tönen', { unit: 'ms' }), num('fire.sit.soundPause', 'Längere Pause', { unit: '%', min: 0, max: 100, hint: 'Wie oft nach einem Ton 1–3 s Ruhe kommen' }), num('fire.sit.soundVolume', 'Lautstärke', { unit: '%', min: 0, max: 100 }), num('fire.sit.fps', 'Tempo', { unit: 'fps', min: 1 }), num('fire.sit.minSeconds', 'Zeit vergeht ab', { unit: 's', min: 0, hint: 'Wer so lange sitzt, bekommt beim Aufstehen „Am Feuer sitzen“ (Zeit + Heilen)' })] },
      { title: 'Licht aus dem Van', fields: [bool('vanLight.enabled', 'Zeigen', { hint: 'Abends und nachts (Licht % der Tageszeit) quillt Licht aus der offenen Schiebetür' }), color('vanLight.color', 'Farbe'),
        num('vanLight.strength', 'Stärke', { unit: '%', min: 0, max: 200 }), num('vanLight.width', 'Breite in der Tür', { unit: 'px', min: 10 }), num('vanLight.height', 'Höhe in der Tür', { unit: 'px', min: 10 }),
        num('vanLight.lift', 'Mitte über dem Boden', { unit: 'px', min: 0 }), num('vanLight.pool', 'Lichtkegel am Boden', { unit: 'px', min: 0 }), num('vanLight.spill', 'Kegel versetzt', { unit: 'px' })] },
      { title: 'Kiste', fields: [bool('chest.enabled', 'Zeigen'), ref('chest.look', 'Aussehen', 'assets', { hint: 'Animation: erster Frame zu, letzter offen. E öffnet und schließt' }),
        num('chest.at', 'Abstand vom Van', { unit: 'Kacheln' }), bool('chest.flip', 'Gespiegelt'), size('chest.grid', 'Raster', { unit: 'Felder', hint: 'Die Kiste ist ein Inventar' })] },
      { title: 'Ton', fields: [ref('sound.wind', 'Wind', 'assets', { hint: 'Läuft leise in Schleife' }), num('sound.windVolume', 'Wind-Lautstärke', { unit: '%', min: 0, max: 100 }),
        refs('sound.gusts', 'Böen', 'assets', { hint: 'Kommen ab und zu dazu, zufällig' }), range('sound.gustEvery', 'Böen alle', { unit: 's' }), num('sound.gustVolume', 'Böen-Lautstärke', { unit: '%', min: 0, max: 100 }),
        ref('sound.fire', 'Lagerfeuer', 'assets', { hint: 'Wird lauter, je näher Leyla den Flammen kommt, und klingt von links oder rechts' }), num('sound.fireVolume', 'Feuer ganz nah', { unit: '%', min: 0, max: 100 }),
        num('sound.fireMin', 'Feuer von weitem', { unit: '%', min: 0, max: 100 }), num('sound.fireRange', 'Hörweite', { unit: 'px', min: 50 }), num('sound.fireNear', 'Voll ab', { unit: 'px', min: 0, hint: 'Näher als das: volle Lautstärke' }),
        ref('sound.music', 'Musik', 'assets', { hint: 'Läuft leise im Hintergrund in Schleife (Leyla Theme). Lädt erst, wenn das Camp steht. M schaltet allen Ton aus' }), num('sound.musicVolume', 'Musik-Lautstärke', { unit: '%', min: 0, max: 100, hint: 'Dezent: um 15' }),
        num('sound.musicFadeIn', 'Musik einblenden', { unit: 's', min: 0, hint: 'So lange wird sie beim Betreten des Camps lauter' })] },
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
        num('start', 'Zustand am Anfang', { unit: '%', min: 1, max: 100 }), text('deadName', 'Name, wenn tot')] },
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
      { title: 'Aufbau', fields: [range('roomCount', 'Räume', { hint: 'Wie viele Räume zusammengesetzt werden' }), refs('rooms', 'Raum-Bausteine', 'rooms'), refs('enemies', 'Gegner', 'enemies', { hint: 'Für das Zeichen 1 im Layout: ein zufälliger dieser Gegner' }), ref('loot', 'Kisten-Beute', 'lootTables', { hint: 'Für Kisten (C) in den Räumen' }), ref('vault', 'Tresor-Beute', 'lootTables', { hint: 'Liegt im Tresor am Ziel (Z), dazu je 10 % Rang-Bonus ein Extra-Wurf. Leer = Tabelle „tresor“' })] },
      { title: 'Level', fields: [text('curve', 'Spannungskurve', { hint: 'Intensität in % vom Eingang bis zum Ausgang, mit Komma, z. B. „30, 70, 20, 85, 100“: so wahrscheinlich wird ein Zufallsgegner (1) in einem Raum auf dem Hauptweg gesetzt; unter 50 % nur die schwächere Hälfte der Gegner, ab 85 % die zähere. Seitenräume halb so laut. Leer = jede 1 ist ein Gegner' }), num('branchChance', 'Abzweige', { unit: '%', min: 0, max: 100, hint: 'Chance je Abzweig-Haken (A in der Decke eines Hauptraums), dass ein Seitenraum (Merkmal Beute/Geheimnis, A im Boden) darüber hängt. Leer = 60' }),
        bool('shortcut', 'Abkürzung zum Van', { hint: 'Tunnel unter allen Räumen: v im Boden des Ausgangs → ^ im Boden des Eingangs. Aus = kein Tunnel. Leer = an' }),
        ref('tunnelTerrain', 'Kachel-Set im Tunnel', 'terrain', { hint: 'Wände und Rückwand der Abkürzung. Leer = Kachel-Set des Eingangs' }),
        ref('tunnelAtmosphere', 'Atmosphäre im Tunnel', 'atmosphere', { hint: 'Licht und Stimmung der Abkürzung. Leer = Atmosphäre des Kachel-Sets im Tunnel' }),
        num('seed', 'Fester Seed', { min: 0, hint: 'Zum Testen: immer dasselbe Level. Leer/0 = jeder Run neu gewürfelt' })] },
      { title: 'Ranking', fields: [num('parTime', 'Bestzeit', { unit: 's', min: 0 }), num('secrets', 'Secrets', { min: 0, hint: 'Im Level zählen die brüchigen Wände (B); diese Zahl gilt nur für POIs ohne Level' })] },
      { title: 'Leben', fields: [bool('npcs', 'NPCs vor Ort'), bool('foodtruck', 'Foodtruck-Verkauf möglich'), bool('shop', 'Händler')] },
    ],
    check: (x, report, p, id) => {
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
      { title: 'Hintergrund', fields: [ref('backdrop.image', 'Bild', 'assets', { hint: 'Pixel-Art mit transparentem Himmel, scharf auf ganze Pixel skaliert; leer = Stadt-Silhouette aus Code' }),
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
    row: (x, p) => `${p?.data.pois?.[x.poi]?.name || x.poi || '–'} · ${x.region || ''}`,
    sections: [{ title: 'Ort', fields: [NAME, LOOK, ref('poi', 'POI', 'pois', { required: true }), point('position', 'Position', { unit: 'km' }), text('region', 'Region'), DESCRIPTION] }],
  },
  encounters: {
    name: 'Encounter', singular: 'Encounter', icon: 'flash', file: 'data/encounters.json', kind: 'catalog',
    hint: 'Zwischenfälle auf der Reise (#014, Daniel, 13.11.2026: „Mehrere Etappen + Ereignisse (Panne, Händler, Hinterhalt)“). Nach jeder Etappe kann einer passieren (Reisen › Chance pro 10 km, nachts mehr); er erzählt, was los ist, und bietet Entscheidungen an. Jede kostet oder bringt Zeit, Sprit, Vorräte, Δ, Leben oder Dinge.',
    template: { name: 'Neuer Encounter', weight: 1, time: 'any', enemies: [], options: [{ label: 'Weiterfahren' }] },
    row: x => `${label(DAYTIME, x.time)} · Gewicht ${x.weight ?? 0} · ${(x.options || []).length} Entscheidungen`,
    sections: [{ title: 'Encounter', fields: [NAME, LOOK, num('weight', 'Gewicht', { min: 0 }), select('time', 'Tageszeit', DAYTIME), refs('enemies', 'Gegner', 'enemies', { hint: 'Noch ohne Wirkung: ein Kampf auf der Straße als kleines Level kommt später' }), ref('loot', 'Beute', 'lootTables'), DESCRIPTION] },
      { title: 'Entscheidungen', fields: [table('options', 'Entscheidungen', [text('label', 'Knopf'), num('hours', 'Zeit', { unit: 'h' }), num('fuel', 'Sprit', { unit: 'l', hint: 'positiv = kostet' }),
        num('food', 'Vorräte', { hint: 'positiv = kostet' }), num('deltas', 'Δ', { hint: 'negativ = zahlen' }), num('health', 'Schaden', { unit: 'Leben', min: 0 }),
        ref('use', 'Verbraucht', 'items'), num('useCount', 'Wie viele', { min: 1 }), ref('item', 'Gibt', 'items'), num('count', 'Anzahl', { min: 1 }), ref('loot', 'Beute-Wurf', 'lootTables'), text('result', 'Danach')],
        { hint: 'Die erste ist hervorgehoben; wer das Fenster schließt, nimmt die erste, die geht. Ausgegraut, wenn Δ, Sprit oder der verbrauchte Gegenstand fehlen' })] }],
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
        num('dangerStep', 'Gefahr +1 alle', { unit: 'km', min: 5, hint: 'Je weiter vom Start, desto gefährlicher (und lohnender)' }),
        num('threat.enemies', 'Gefahr: mehr Gegner', { unit: '% je Stufe', min: 0, hint: 'Daniel, 13.11.2026: Gefahr wirkt (#014). Jede Stufe über 1 bringt so viel mehr Gegner in den Run' }), num('threat.health', 'Gefahr: Gegner-Leben', { unit: '% je Stufe', min: 0 }),
        num('threat.damage', 'Gefahr: Gegner-Schaden', { unit: '% je Stufe', min: 0 }), num('threat.loot', 'Gefahr: Extra-Beute', { unit: '% je Stufe', min: 0, hint: 'Chance auf ein Ding mehr je Beute-Wurf (Kisten, Gegner, Tresor)' }), num('detour', 'Umwege', { unit: '%', min: 0, hint: 'Straßen sind so viel länger als die Luftlinie' }),
        num('reveal', 'Namen sichtbar bis', { unit: 'Straßen', min: 0, hint: 'Orte weiter weg erscheinen als „?“, bis Leyla näher kommt' })] },
      { title: 'Orte', fields: [table('kinds', 'POI-Arten', [ref('poi', 'POI', 'pois'), num('weight', 'Gewicht', { min: 0 }), text('names', 'Namen')],
          { hint: 'Namen mit | getrennt, Platzhalter: {km} Entfernung zur Stadt, {nr} Nummer, {word} Ortswort, {office} Amt, {region}, {brand} Kurzname der Marke' }),
        text('words', 'Ortswörter', { hint: 'Mit Komma getrennt, für {word}' }), text('offices', 'Ämter', { hint: 'Für {office}' }),
        text('regions', 'Regionen', { hint: 'Mit Komma getrennt, im Kreis um die Stadt verteilt (beginnend im Westen, gegen den Uhrzeigersinn über Norden)' })] },
      { title: 'Marken', fields: [table('brands', 'Marken', [text('id', 'ID'), text('name', 'Name'), text('short', 'Kurz'), text('slogan', 'Slogan'), select('kind', 'Bei', [['', 'überall'], ['gasStation', 'Tankstelle'], ['mall', 'Markt'], ['bunker', 'Bunker'], ['government', 'Amt']]), num('icon', 'Logo', { min: 0 }), color('color', 'Farbe'), num('weight', 'Gewicht', { min: 0 })],
          { hint: 'Logo = Feld im Symbol-Raster „Logos“. Marken stehen an passenden Orten und als Plakate an den Straßen' }), num('signs', 'Plakate', { min: 0, max: 30 })] },
      { title: 'Aussehen', fields: [ref('paper', 'Papier', 'assets'), ref('logos', 'Logos', 'assets', { hint: 'Symbol-Raster mit den Marken-Logos' }), text('title', 'Titel'), text('edition', 'Ausgabe')] },
    ],
    check: (x, report, p) => {
      for (const b of x.brands || []) if (!b.id) report('error', `Marke „${b.name || '?'}“ ohne ID`);
      if (!(x.kinds || []).length) report('hint', 'Keine POI-Arten: es gibt nur die Wahrzeichen aus dem Bereich Orte');
      const L = p.data?.assets?.[x.logos]; for (const b of x.brands || []) if (L?.grid && b.icon >= L.grid[0] * L.grid[1]) report('warning', `${b.name}: Logo ${b.icon} gibt es nicht`);
    },
  },
  travel: {
    name: 'Reisen', icon: 'world_icon', file: 'data/travel.json', kind: 'single',
    hint: 'Was das Fahren kostet: Sprit, Vorräte und Zeit. Nachts ist es gefährlicher.',
    sections: [
      { title: 'Kosten', fields: [num('speed', 'Reisetempo', { unit: 'km/h', min: 1 }), num('foodPerDay', 'Vorräte pro Tag und Kopf', { unit: 'Rationen', min: 0 }),
        num('weightFuelFactor', 'Mehrverbrauch je Tonne', { unit: '%', min: 0 })] },
      { title: 'Tag & Nacht', fields: [num('dayLength', 'Tageslänge', { unit: 'Spiel-h', min: 1 }), num('nightShare', 'Anteil Nacht', { unit: '%', min: 0, max: 100 }), num('nightDanger', 'Gefahr nachts', { unit: '%', min: 0 })] },
      { title: 'Encounter', fields: [num('encounterChance', 'Chance pro 10 km', { unit: '%', min: 0, max: 100 })] },
    ],
  },
};

// Navigation: groups of areas in the order of the design document
export const GROUPS = [
  ['ASSETS', ['assets']],
  ['GRUNDLAGEN', ['game', 'splash', 'intro', 'tutorial', 'weather', 'economy', 'ranking']],
  ['LEYLA', ['leyla', 'drone', 'backpacks']],
  ['KAMPF', ['weapons', 'enemies', 'kits', 'buffs']],
  ['BEUTE & CRAFTING', ['items', 'lootTables', 'recipes', 'crafting']],
  ['ACHIEVEMENTS', ['achievements']],
  ['PROGRESSION', ['techtree', 'resources']],
  ['RIG', ['tank', 'camp', 'build', 'tractors', 'containers', 'workshops', 'rigParts', 'companions']],
  ['WELT', ['worldmap', 'pois', 'rooms', 'terrain', 'atmosphere', 'locations', 'encounters', 'travel']],
];

export const optionLabel = label;
export const fields = a => AREAS[a].sections.flatMap(s => s.fields);
