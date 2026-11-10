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
export const ENEMY_FAMILIES = [['mutant', 'Mutant'], ['raider', 'Plünderer'], ['machine', 'Maschine'], ['wildlife', 'Getier'], ['anomaly', 'Anomalie']];
export const ENEMY_BEHAVIORS = [['patrol', 'Patrouille'], ['charger', 'Stürmer'], ['shooter', 'Schütze'], ['ambusher', 'Lauerer'], ['flyer', 'Flieger'], ['boss', 'Boss']];
export const ITEM_CATEGORIES = [['junk', 'Schrott'], ['resource', 'Ressource'], ['ingredient', 'Zutat'], ['food', 'Gericht'], ['component', 'Bauteil'], ['consumable', 'Verbrauchsgut'], ['valuable', 'Wertsache'], ['blueprint', 'Bauplan/Rezept']];
export const BUFF_STATS = [['health', 'Leben'], ['damage', 'Schaden'], ['speed', 'Tempo'], ['defense', 'Abwehr'], ['luck', 'Glück (Beute)'], ['backpack', 'Rucksackplätze'], ['fuel', 'Spritverbrauch']];
export const BUFF_DURATIONS = [['instant', 'Sofort'], ['run', 'Nächster Run'], ['travel', 'Nächste Reise'], ['seconds', 'Sekunden'], ['permanent', 'Dauerhaft']];
export const DISCOVERY = [['experiment', 'Experimentieren'], ['found', 'Fund im POI'], ['companion', 'Tipp von Companion'], ['shop', 'Bei NPCs kaufen'], ['start', 'Von Anfang an']];
export const CONTAINER_KINDS = [['shipping', 'Hochseecontainer'], ['crate', 'Holzkiste'], ['trailer', 'Wohnwagenteil'], ['tank', 'Tank']];
export const WORKSHOP_FUNCTIONS = [['storage', 'Lager'], ['cooling', 'Kühlung'], ['cell', 'Zelle'], ['sleep', 'Schlafen'], ['chill', 'Chillen'], ['drone', 'Drohnen'], ['warroom', 'Planung'], ['kitchen', 'Kochen'], ['foodtruck', 'Verkauf'], ['craft', 'Herstellen'], ['engine', 'Motor'], ['power', 'Energie']];
export const BENCH_FX = [['light', 'Licht'], ['screen', 'Bildschirm'], ['steam', 'Dampf'], ['smoke', 'Rauch'], ['sparks', 'Funken'], ['flame', 'Flamme'], ['blink', 'LED blinkt'], ['twinkle', 'Lichter funkeln'], ['bubbles', 'Blasen'], ['fish', 'Fische'], ['lava', 'Lavalampe'], ['scan', 'Druckkopf'], ['shine', 'Glanz']];
export const BENCH_FX_WHEN = [['always', 'Immer'], ['night', 'Abends'], ['near', 'In der Nähe'], ['use', 'Bei Benutzung']];
export const RIG_SLOTS = [['engine', 'Motor'], ['armor', 'Panzerung'], ['weapon', 'Waffe'], ['roof', 'Dach']];
export const POI_KINDS = [['gasStation', 'Tankstelle'], ['settlement', 'Siedlung'], ['factory', 'Fabrik'], ['bunker', 'Bunker'], ['government', 'Regierungskomplex'], ['mall', 'Einkaufszentrum'], ['ruin', 'Ruine']];
export const POI_SIZES = [['S', 'S'], ['M', 'M'], ['L', 'L'], ['XL', 'XL']];
export const ROOM_TAGS = [['start', 'Eingang'], ['exit', 'Ausgang'], ['combat', 'Kampf'], ['loot', 'Beute'], ['secret', 'Geheimnis'], ['npc', 'NPCs'], ['boss', 'Boss'], ['corridor', 'Gang']];
export const ASSET_KINDS = [['animation', 'Animation'], ['tiles', 'Kacheln'], ['image', 'Bild'], ['sound', 'Ton'], ['icons', 'Symbole'], ['reference', 'Referenz'], ['source', 'Original']];
export const DAYTIME = [['any', 'Immer'], ['day', 'Tag'], ['night', 'Nacht']];
export const DRONE_MOODS = [['idle', 'Normal'], ['kill', 'Gegner erledigt'], ['cleared', 'Raum geräumt'], ['bored', 'Langeweile'], ['alert', 'Gegner in der Nähe'],
  ['curious', 'Neugierig (zufällig)'], ['hit', 'Leyla getroffen'], ['sleep', 'Schlafen'], ['down', 'Leyla k.o.'], ['scan', 'Scannen (zufällig)'], ['lowHealth', 'Wenig Leben'], ['dash', 'Dash'], ['zen', 'Zen (Leyla macht Yoga)']];
export const RANKING_CATEGORIES = [['time', 'Durchlaufzeit'], ['kills', 'Kills in %'], ['secrets', 'Secrets']];

const label = (list, v) => list.find(([k]) => k === v)?.[1] ?? v ?? '';

// ---------- areas ----------
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
      { title: 'Ton', when: x => x.kind === 'sound', fields: [text('alt', 'Ersatzdatei', { hint: 'Gleicher Ton in einem zweiten Format (z. B. .ogg zur .m4a); das Spiel nimmt, was der Browser kann' }),
        num('volume', 'Grundlautstärke', { unit: '%', min: 0, max: 200, hint: 'Gleicht laute und leise Aufnahmen aus' })] },
      { title: 'Herkunft', fields: [text('source', 'Erzeugt mit', { hint: 'KI-Werkzeug oder Code' }), ref('derivedFrom', 'Abgeleitet von', 'assets', { hint: 'z. B. Streifen aus einem Original-GIF' }), text('date', 'Datum')] },
    ],
    check: (x, report, p) => {
      if (x.file && p.exists && !p.exists(x.file)) report('error', `Datei ${x.file} fehlt`);
      if (x.alt && p.exists && !p.exists(x.alt)) report('error', `Ersatzdatei ${x.alt} fehlt`);
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
        size('resolution', 'Auflösung', { unit: 'px', hint: 'Interne Auflösung, wird skaliert' }), bool('pixelArt', 'Pixel-Art (scharf skalieren)')] },
      { title: 'Controller', fields: [bool('gamepad.enabled', 'Controller an', { hint: 'Gamepad-API des Browsers: Xbox, PlayStation, Stadia (Bluetooth-Modus), Switch Pro … mit Standard-Belegung. Die Knöpfe heißen hier nach ihrer Lage, die Hilfe im Spiel zeigt die Symbole des angeschlossenen Controllers' }),
        ref('gamepad.icons', 'Symbole', 'assets', { hint: 'Asset der Art „Symbole“ mit Namen je Knopf: <typ>_0 … <typ>_11 (Reihenfolge der Gamepad-API), <typ>_dpad, <typ>_stick; Typen xbox, ps, switch, stadia. Ohne Symbol: Text' }),
        select('gamepad.symbols', 'Symbole von', PAD_KINDS, { hint: 'Automatisch nach dem Namen, den der Controller meldet; zum Testen fest einstellbar (Stadia meldet sich manchmal ohne Namen)' }),
        num('gamepad.deadzone', 'Totzone', { unit: '%', min: 0, max: 90, hint: 'So weit muss der Stick geneigt sein, bevor Leyla läuft' }),
        num('gamepad.walkTilt', 'Gehen bis', { unit: '%', min: 0, max: 100, hint: 'Stick nur bis hier geneigt = gehen statt rennen (0 = aus)' }),
        ...PAD_ACTIONS.map(([a, n]) => multi(`gamepad.map.${a}`, n, PAD_BUTTONS))] },
      { title: 'Kamera', fields: [num('camera.zoom', 'Zoom', { min: 0.3, max: 2, step: 0.05, hint: '1 = 1920×1080 Spielpixel sichtbar, 0,75 = weiter raus (mehr sichtbar), über 1 = näher ran' }),
        num('camera.lookAhead', 'Vorlauf', { unit: 'px', min: 0, hint: 'So weit schaut die Kamera in Laufrichtung voraus' }), num('camera.follow', 'Nachziehen', { min: 0.01, max: 1, step: 0.01, hint: '1 = klebt an Leyla, kleiner = weicher' })] },
      { title: 'Kacheln', fields: [ref('tiles.platform', 'Plattform', 'assets', { hint: 'Asset der Art „Kacheln“ mit 4 Frames: einzeln, links, Mitte, rechts. Leer = aus Code gezeichnet' })] },
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
      { title: 'Testen', fields: [ref('testRoom', 'Testraum', 'rooms', { hint: 'Diesen Raum startet „Spiel“ auf der Startseite (MVP Movement & Kampf)' })] },
      { title: 'Start', fields: [ref('start.location', 'Startort', 'locations'), ref('start.tractor', 'Zugmaschine', 'tractors'), refs('start.containers', 'Container', 'containers'),
        table('start.inventory', 'Start-Inventar', [select('where', 'Wo', [['backpack', 'Rucksack'], ['chest', 'Kiste im Camp'], ['storage', 'Erstes Lager (sonst Kiste)']]), ref('item', 'Gegenstand', 'items'), ref('weapon', 'Waffe', 'weapons'), ref('backpack', 'Rucksack', 'backpacks'), num('count', 'Anzahl', { min: 1 })],
          { hint: 'Pro Zeile ein Gegenstand, eine Waffe oder ein Rucksack. Platz suchen die Dinge sich selbst' }),
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
      { title: 'Drohne', fields: [bool('drone.show', 'Zeigen', { hint: 'Mama-Bot schwebt neben Leyla und zeigt zufällige Stimmungen (Gesicht + Kaomoji aus dem Bereich Drohne)' }),
        point('drone.at', 'Position', { unit: '%', hint: 'Mitte der Drohne in % des Bildschirms (breit); schmal rückt sie mit Leyla zur Mitte' }), num('drone.height', 'Größe', { unit: '% der Höhe', min: 2, max: 50 }),
        range('drone.every', 'Neue Stimmung alle', { unit: 's' }), num('drone.bob', 'Schweben', { unit: '% der Höhe', min: 0, step: 0.1 }),
        text('drone.moods', 'Stimmungen', { hint: 'Anlässe aus der Tabelle der Drohne, mit Komma getrennt' })] },
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
  economy: {
    name: 'Wirtschaft', icon: 'coins', file: 'data/economy.json', kind: 'single',
    hint: 'Währung, Startgeld und was beim Tod passiert.',
    sections: [
      { title: 'Währung', fields: [text('currency.name', 'Name'), text('currency.symbol', 'Symbol'), num('startDeltas', 'Startgeld', { unit: 'Δ', min: 0 }), area_('currency.description', 'Hintergrund')] },
      { title: 'Tod', fields: [text('rescue.drone', 'Rettungsdrohne'), bool('rescue.losesRunLoot', 'Run-Beute geht verloren'), bool('rescue.losesEquipped', 'Ausgerüstetes geht verloren'),
        num('rescue.keepPercent', 'Mama-Bot rettet', { unit: '%', min: 0, max: 100, hint: 'Anteil der Run-Beute, den Mama-Bot mitbringt (später über Drohnen-Upgrades)' }), area_('rescue.description', 'Ablauf')] },
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
    hint: 'Leylas Drohne: fliegt immer hinter ihr her, reine Deko ohne Physik. Stimmungen zeigen ein Gesicht (Frame aus dem Aussehen) und optional ein Kaomoji-Bläschen. Zeiten in Millisekunden bzw. Sekunden.',
    sections: [
      { title: 'Drohne', fields: [NAME, ref('look', 'Aussehen', 'assets', { hint: 'Animation mit einem Frame pro Stimmung (Tempo 0)' }), num('height', 'Höhe im Spiel', { unit: 'px', min: 8, hint: 'Leer = Höhe aus dem Asset' }),
        bool('enabled', 'Fliegt mit'), select('layer', 'Ebene', [['behind', 'Hinter Leyla'], ['front', 'Vor Leyla']]), DESCRIPTION] },
      { title: 'Flug', fields: [point('follow.offset', 'Position', { unit: 'px', hint: 'Von Leylas Füßen aus: x hinter ihr (in Blickrichtung gespiegelt), y nach oben negativ' }),
        num('follow.smooth', 'Nachziehen', { min: 0.01, max: 1, step: 0.01, hint: '1 = klebt an der Position, kleiner = träger' }), num('follow.bob', 'Schweben', { unit: 'px', min: 0, hint: 'Auf und ab' }),
        num('follow.bobSpeed', 'Schwebe-Tempo', { unit: 'Hz', min: 0, step: 0.05 }), num('follow.tilt', 'Neigung', { unit: '°', min: 0, hint: 'Neigt sich beim Fliegen in Flugrichtung' }),
        num('follow.turnDelay', 'Umdrehen nach', { unit: 'ms', min: 0, hint: 'So lange wartet sie, bevor sie Leylas neuer Richtung folgt' })] },
      { title: 'Stimmungen', fields: [table('moods', 'Stimmungen', [select('mood', 'Anlass', DRONE_MOODS), num('frame', 'Frame', { min: 0 }), text('kaomoji', 'Kaomoji'), num('duration', 'Dauer ms', { min: 0 })],
        { hint: 'Frame zählt ab 0. Ohne Kaomoji nur das Gesicht. Dauer 0 = solange der Anlass gilt' })] },
      { title: 'Verhalten', fields: [num('idle.boredAfter', 'Langeweile nach', { unit: 's', min: 0, hint: 'Leyla steht still' }), num('idle.sleepAfter', 'Einschlafen nach', { unit: 's', min: 0 }), num('idle.zenAfter', 'Zen nach', { unit: 's', min: 0, hint: 'So lange hält Leyla die Yoga-Pose, dann macht die Drohne mit' }),
        range('idle.randomEvery', 'Zufällige Stimmung alle', { unit: 's', hint: 'Neugierig oder Scannen, während Leyla unterwegs ist' }), num('alertRange', 'Gegner bemerken ab', { unit: 'px', min: 0 }),
        num('lowHealth', 'Wenig Leben unter', { unit: '%', min: 0, max: 100 })] },
      { title: 'Im Camp frei fliegen', fields: [bool('roam.enabled', 'Frei fliegen', { hint: 'Daniel: im Camp fliegt die Drohne frei herum statt Leyla zu folgen' }), range('roam.every', 'Neues Ziel alle', { unit: 's' }),
        range('roam.height', 'Flughöhe', { unit: 'px über dem Boden' }), num('roam.visitLeyla', 'Besucht Leyla', { unit: '%', min: 0, max: 100, hint: 'Wie oft das neue Ziel Leyla ist' }), num('roam.smooth', 'Trägheit', { min: 0.005, max: 1, step: 0.005, hint: 'Kleiner = gemütlicher' })] },
      { title: 'Bläschen', fields: [bool('bubble.show', 'Kaomoji zeigen'), num('bubble.size', 'Schriftgröße', { unit: 'px', min: 8 }), color('bubble.color', 'Schrift'), color('bubble.background', 'Hintergrund')] },
    ],
    check: (x, report, p) => {
      const a = p.data?.assets?.[x.look], n = a?.frames || 1;
      for (const m of x.moods || []) if (a && (m.frame ?? 0) >= n) report('error', `Stimmung ${label(DRONE_MOODS, m.mood)}: Frame ${m.frame} gibt es nicht (Aussehen hat ${n})`);
      if (!(x.moods || []).some(m => m.mood === 'idle')) report('hint', 'Stimmung „Normal“ fehlt, dann zeigt sie Frame 0');
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
        bool('movement.airJumpGhosts', 'Doppelsprung-Nachbilder', { hint: 'Nachbilder wie beim Dash' }), num('movement.coyoteTime', 'Coyote Time', { unit: 'ms', min: 0, hint: 'Springen kurz nach der Kante erlaubt' }),
        num('movement.jumpBuffer', 'Sprungpuffer', { unit: 'ms', min: 0 })] },
      { title: 'Dash & Slide', fields: [num('movement.dashDistance', 'Dash-Weite', { unit: 'px', min: 0 }), num('movement.dashCooldown', 'Dash-Abklingzeit', { unit: 'ms', min: 0 }), num('movement.dashFromFrame', 'Dash ab Frame', { min: 1, hint: 'Ausholen davor wird übersprungen; ab hier läuft die Animation über die Dash-Dauer' }),
        bool('movement.dashInvulnerable', 'Unverwundbar beim Dash'), num('movement.slideSpeed', 'Slide-Tempo', { unit: 'px/s', min: 0 }), num('movement.slideDuration', 'Slide-Dauer', { unit: 'ms', min: 0 })] },
      { title: 'Klettern & Schwingen', fields: [num('movement.climbSpeed', 'Klettern', { unit: 'px/s', min: 0 }), num('movement.climbFromFrame', 'Klettern ab Frame', { min: 1, hint: 'Frames davor (z. B. Stehen) werden übersprungen; die Frames laufen mit dem Kletterweg' }), num('movement.climbStep', 'Kletterweg pro Frame', { unit: 'px', min: 1 }),
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
        num('movement.mantleTime', 'Hochziehen', { unit: 'ms', min: 50 }), num('movement.mantleFromFrame', 'Hochziehen ab Frame', { min: 1, hint: 'Die ersten Frames der Animation (Stehen, Arme hoch) werden übersprungen' }),
        num('movement.standUpTime', 'Aufstehen', { unit: 'ms', min: 0, hint: 'Nach dem Hochziehen aus der Hocke; Laufen oder Springen bricht ab' }),
        num('movement.crouchTime', 'In die Hocke', { unit: 'ms', min: 0, hint: 'Ducken: S im Stand halten. In der Hocke an einer Kante nochmal S = runter an die Kante hängen' })] },
      { title: 'Aussehen', fields: [ref('look.idle', 'Stehen', 'assets'), ref('look.idleAlt', 'Stehen 2', 'assets', { hint: 'Zweite Idle, wechselt zufällig mit Stehen (nach jedem Durchlauf)' }),
        num('idleAltChance', 'Stehen 2 Anteil', { unit: '%', min: 0, max: 100, hint: 'Wie oft nach einem Durchlauf Stehen 2 kommt' }), ref('look.walk', 'Gehen', 'assets'), ref('look.run', 'Rennen', 'assets'),
        ref('look.jump', 'Springen', 'assets'), ref('look.airJump', 'Doppelsprung', 'assets', { hint: 'Läuft einmal beim Sprung in der Luft' }), ref('look.fall', 'Fallen', 'assets', { hint: 'Gleiches Asset wie Springen: läuft dann einfach weiter, beim Fallen ohne Sprung ab der Mitte' }), ref('look.dash', 'Dash', 'assets'), ref('look.slide', 'Slide', 'assets'),
        ref('look.climb', 'Klettern', 'assets'), ref('look.land', 'Harte Landung', 'assets', { hint: 'Nur nach weiten Sprüngen oder tiefen Stürzen (Leyla › Harte Landung)' }), ref('look.brake', 'Bremsen', 'assets', { hint: 'Nach einem Sprint, wenn die Richtung losgelassen wird (Leyla › Bremsen)' }), ref('look.crouch', 'Ducken', 'assets', { hint: 'Läuft einmal in die Hocke und hält den letzten Frame; rückwärts = Aufstehen nach dem Hochziehen' }),
        ref('look.hang', 'Hängen', 'assets', { hint: 'An einer Kante, Schleife' }), ref('look.mantle', 'Hochziehen', 'assets', { hint: 'An der Kante hoch, ab „Hochziehen ab Frame“' }), ref('look.hurt', 'Treffer', 'assets'), ref('look.reference', 'Referenz', 'assets', { hint: 'Character Sheet, Konzept' })] },
      { title: 'Start-Ausrüstung', fields: [ref('loadout.melee', 'Nahkampf', 'weapons'), ref('loadout.ranged', 'Fernkampf', 'weapons'), ref('loadout.cyberdeck', 'Cyberdeck', 'weapons'), ref('loadout.backpack', 'Rucksack', 'backpacks')] },
      { title: 'Waffe ziehen', fields: [bool('armed.enabled', 'Automatisch ziehen', { hint: 'Daniel: zieht die Pistole, sobald sie nicht rennt; Rennen, Springen, Dash steckt sie weg' }),
        ref('look.draw', 'Ziehen', 'assets'), ref('look.aim', 'Zielen', 'assets'), ref('look.aimWalk', 'Gehen mit Waffe', 'assets'), ref('look.shoot', 'Schießen', 'assets'), ref('look.shootWalk', 'Schießen im Gehen', 'assets'),
        num('armed.drawTime', 'Ziehen dauert', { unit: 'ms', min: 0, hint: 'Endet mit der Pistole vor der Brust' }), num('armed.extendTime', 'Arme ausstrecken', { unit: 'ms', min: 0, hint: 'Vor dem ersten Schuss aus der Brust-Haltung' }),
        num('armed.aimHold', 'Im Anschlag bleiben', { unit: 'ms', min: 0, hint: 'Nach Schuss oder Nachladen, dann wieder vor die Brust' }), num('armed.lowerTime', 'Arme senken', { unit: 'ms', min: 0 }), num('armed.drawFromFrame', 'Ziehen ab Frame', { min: 1, hint: 'Die ersten Frames sind noch Stehen' }),
        point('armed.muzzle', 'Mündung', { unit: 'px', hint: 'Von Leylas Füßen aus (bei 192 px Größe): x nach vorn, y nach oben; dort startet der Schuss' }), bool('armed.inCamp', 'Auch im Camp'),
        bool('armed.flashLight', 'Mündungslicht', { hint: 'Kurzer Lichtblitz beim Schuss, beleuchtet die Umgebung' }), color('armed.flashColor', 'Lichtfarbe'), num('armed.flashRadius', 'Lichtradius', { unit: 'px', min: 0 }),
        num('armed.flashTime', 'Blitz dauert', { unit: 'ms', min: 10 }), ref('look.reload', 'Nachladen', 'assets'), ref('look.reloadWalk', 'Nachladen im Gehen', 'assets'), ref('look.work', 'An der Werkstatt', 'assets', { hint: 'Daniel: solange sie im Camp an einer Werkstatt steht (von hinten)' })] },
      { title: 'Nahkampf', fields: [ref('look.meleeLight', 'Leicht (Stand)', 'assets'), ref('look.meleeLightWalk', 'Leicht (Gehen)', 'assets'), ref('look.meleeHeavy', 'Schwer (Stand)', 'assets', { hint: 'Enthält auch das Aufladen (Schleife)' }), ref('look.meleeHeavyWalk', 'Schwer (Gehen)', 'assets'),
        num('melee.chargeTime', 'Schwer ab Halten', { unit: 'ms', min: 0, hint: 'Daniel: mindestens 3 Sekunden J halten, beim Loslassen kommt der schwere Hieb' }), num('melee.chargeAfter', 'Aufladen zeigen ab', { unit: 'ms', min: 0 }), range('melee.chargeLoop', 'Aufladen Frames'),
        num('melee.lightTime', 'Leicht dauert', { unit: 'ms' }), num('melee.lightHit', 'Leicht trifft bei', { min: 0, max: 1, step: 0.05, hint: 'Anteil der Dauer' }),
        num('melee.lightWalkTime', 'Leicht im Gehen dauert', { unit: 'ms' }), num('melee.lightWalkFrom', 'Leicht im Gehen ab Frame', { min: 1 }), num('melee.lightWalkHit', 'Leicht im Gehen trifft bei', { min: 0, max: 1, step: 0.05 }),
        num('melee.heavyTime', 'Schwer dauert', { unit: 'ms' }), num('melee.heavyFrom', 'Schwer ab Frame', { min: 1, hint: 'Nach dem Aufladen' }), num('melee.heavyHit', 'Schwer trifft bei', { min: 0, max: 1, step: 0.05 }),
        num('melee.heavyWalkTime', 'Schwer im Gehen dauert', { unit: 'ms' }), num('melee.heavyWalkFrom', 'Schwer im Gehen ab Frame', { min: 1 }), num('melee.heavyWalkHit', 'Schwer im Gehen trifft bei', { min: 0, max: 1, step: 0.05 }),
        num('melee.heavyDamage', 'Schwer: Schaden', { unit: '%', min: 100 }), num('melee.heavyRange', 'Schwer: Reichweite +', { unit: 'px', min: 0 }), num('melee.heavyKnockback', 'Schwer: Rückstoß +', { min: 0 })] },
      { title: 'Yoga', fields: [ref('look.yoga', 'Yoga-Pose', 'assets', { hint: 'Daniel: mit P auslösen, beim Auflösen rückwärts' }), num('yoga.fps', 'Hinein (fps)', { min: 1 }), num('yoga.backFps', 'Zurück (fps)', { min: 1, hint: 'Rückwärts, wenn sie die Pose auflöst' }), num('yoga.holdFrom', 'Halten ab Frame', { min: 1, hint: 'Ab hier atmet sie in einer Schleife bis zum letzten Frame' })] },
      { title: 'Zufällige Idles', fields: [table('idles', 'Idles', [ref('look', 'Animation', 'assets'), num('weight', 'Gewicht', { min: 0 })],
          { hint: 'Daniel: „Idle-Animationen zufällig abspielen, wenn sie länger nicht bewegt wurde“. Läuft einmal, danach wieder Stehen. Sitzen am Feuer zählt nicht' }),
        range('idleAfter', 'Nach Stillstand', { unit: 's', hint: 'Zufällig zwischen den Werten, danach jedes Mal neu gewürfelt' })] },
      { title: 'Inventar', fields: [num('inventory.pickupRange', 'Boden-Reichweite', { unit: 'px', min: 20, hint: 'Beute in dieser Nähe erscheint im Boden-Inventar (wie bei XCOM)' }),
        bool('inventory.autoStack', 'Stapel automatisch auffüllen', { hint: 'Stapelbares, das schon im Rucksack ist, wird beim Drüberlaufen eingesammelt, solange Platz im Stapel ist' }),
        num('inventory.cell', 'Feldgröße', { unit: 'px', min: 24, max: 96, hint: 'Größe eines Rasterfelds auf dem Bildschirm' }),
        num('inventory.dropSpread', 'Beute streut', { unit: 'px', min: 0, hint: 'Wie weit Beutebündel von besiegten Gegnern wegspringen' })] },
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
      { title: 'Waffe', fields: [NAME, LOOK, ICON, select('kind', 'Art', WEAPON_KINDS, { required: true }), num('tier', 'Stufe', { min: 1, max: 5 }),
        text('glyph', 'Kürzel', { hint: 'Platzhalter im Inventar: 1–3 Zeichen oder ein Emoji' }), DESCRIPTION] },
      { title: 'Werte', fields: [num('damage', 'Schaden', { min: 0 }), num('cooldown', 'Abklingzeit', { unit: 'ms', min: 0 }), num('range', 'Reichweite', { unit: 'px', min: 0 }),
        num('knockback', 'Rückstoß', { unit: 'px/s', min: 0 }), num('critChance', 'Krit-Chance', { unit: '%', min: 0, max: 100 }), num('ammo', 'Munition', { min: 0, hint: 'Leer = unendlich' }),
        num('projectileSpeed', 'Geschosstempo', { unit: 'px/s', min: 0, hint: 'Nur Fernkampf: so schnell fliegt das Geschoss' }), ref('sound', 'Schuss-Ton', 'assets', { hint: 'Asset der Art Ton' }),
        num('magazine', 'Magazin', { unit: 'Schuss', min: 1, hint: 'Nur Fernkampf: so viele Schuss, dann nachladen (R, leer = automatisch). Munition = Vorrat insgesamt' }), num('reloadTime', 'Nachladen dauert', { unit: 'ms', min: 0 })] },
      { title: 'Rucksack & Handel', fields: [size('size', 'Größe', { unit: 'Felder' }), VALUE] },
    ],
    check: iconCheck,
  },
  enemies: {
    name: 'Gegner', singular: 'Gegner', icon: 'skull', file: 'data/enemies.json', kind: 'catalog', groupBy: { key: 'family', options: ENEMY_FAMILIES },
    hint: 'Mutanten, Plünderer, Maschinen und „vielleicht noch Gefährlicheres“.',
    template: { name: 'Neuer Gegner', family: 'mutant', behavior: 'patrol', health: 30, damage: 8, speed: 80, aggroRange: 200, deltas: [1, 4], countsForRanking: true },
    row: x => `${label(ENEMY_BEHAVIORS, x.behavior)} · ${x.health ?? 0} Leben · ${x.damage ?? 0} Schaden`,
    sections: [
      { title: 'Gegner', fields: [NAME, LOOK, select('family', 'Familie', ENEMY_FAMILIES), select('behavior', 'Verhalten', ENEMY_BEHAVIORS), DESCRIPTION] },
      { title: 'Werte', fields: [num('health', 'Leben', { min: 1 }), num('damage', 'Schaden', { min: 0 }), num('speed', 'Tempo', { unit: 'px/s', min: 0 }),
        num('aggroRange', 'Bemerkt Leyla ab', { unit: 'px', min: 0 }), ref('weapon', 'Waffe', 'weapons', { hint: 'Optional, sonst Körperangriff' })] },
      { title: 'Angriff', fields: [num('attack.windup', 'Ausholen', { unit: 'ms', min: 0, hint: 'So lange blinkt die Warnung, bevor der Angriff kommt (Zeit zum Ausweichen)' }),
        num('attack.cooldown', 'Pause danach', { unit: 'ms', min: 0 }), num('attack.range', 'Angriff ab', { unit: 'px', min: 0, hint: 'Abstand zu Leyla, ab dem angegriffen wird (Schütze: Wunschabstand)' }),
        num('attack.projectileSpeed', 'Geschosstempo', { unit: 'px/s', min: 0, hint: 'Nur Schützen: Gegnergeschosse sind langsamer als Leylas, damit man ausweichen kann' }),
        num('height', 'Größe', { unit: 'px', min: 1, hint: 'Höhe der Figur im Spiel (Leyla: 192)' }), select('placeholderColor', 'Platzhalter-Farbe', [['rust', 'Rost'], ['olive', 'Oliv'], ['violet', 'Violett'], ['steel', 'Stahl']], { hint: 'Solange es kein Aussehen gibt' })] },
      { title: 'Beute', fields: [ref('loot', 'Beutetabelle', 'lootTables'), range('deltas', 'Deltas', { unit: 'Δ' }), bool('countsForRanking', 'Zählt für Kills %')] },
    ],
  },
  buffs: {
    name: 'Buffs', singular: 'Buff', icon: 'flash', file: 'data/buffs.json', kind: 'catalog',
    hint: 'Wirkungen von Gerichten, Companions und Werkstätten. Ein Buff ändert einen Wert für eine bestimmte Dauer.',
    template: { name: 'Neuer Buff', stat: 'health', value: 10, percent: false, duration: 'run' },
    row: x => `${label(BUFF_STATS, x.stat)} ${x.value >= 0 ? '+' : ''}${x.value ?? 0}${x.percent ? ' %' : ''} · ${label(BUFF_DURATIONS, x.duration)}`,
    sections: [{ title: 'Buff', fields: [NAME, select('stat', 'Wert', BUFF_STATS), num('value', 'Änderung'), bool('percent', 'in Prozent'),
      select('duration', 'Dauer', BUFF_DURATIONS), num('seconds', 'Sekunden', { min: 0, hint: 'Nur bei Dauer „Sekunden“' }), DESCRIPTION] }],
  },

  items: {
    name: 'Gegenstände', singular: 'Gegenstand', icon: 'item', file: 'data/items.json', kind: 'catalog', groupBy: { key: 'category', options: ITEM_CATEGORIES },
    hint: 'Alles, was in den Rucksack passt: Schrott, Ressourcen, Zutaten, Gerichte, Bauteile. Viel Junk, viele Kombinationen.',
    template: { name: 'Neuer Gegenstand', category: 'junk', size: [1, 1], stack: 1, value: 1 },
    row: x => `${label(ITEM_CATEGORIES, x.category)} · ${(x.size || [1, 1]).join('×')} · ${x.value ?? 0} Δ`,
    sections: [
      { title: 'Gegenstand', fields: [NAME, LOOK, ICON, select('category', 'Kategorie', ITEM_CATEGORIES), DESCRIPTION] },
      { title: 'Rucksack & Handel', fields: [size('size', 'Größe', { unit: 'Felder', hint: 'Rechteck im Raster; eine Form (unten) hat Vorrang' }),
        lines('shape', 'Form', { hint: 'Tetris-Form: eine Zeile pro Reihe, # = belegt, . = frei (z. B. „#.“ / „##“ für ein L). Leer = Rechteck aus „Größe“. Im Spiel mit Rechtsklick drehbar' }),
        num('stack', 'Stapel', { min: 1 }), text('glyph', 'Kürzel', { hint: 'Platzhalter im Inventar, solange es kein Aussehen gibt: 1–3 Zeichen oder ein Emoji' }), VALUE] },
      { title: 'Wirkung', fields: [ref('buff', 'Buff beim Essen/Benutzen', 'buffs'), ref('teaches', 'Bringt Rezept bei', 'recipes', { hint: 'Für Baupläne und Kochbücher' })] },
    ],
    check: (x, report, p) => {
      iconCheck(x, report, p);
      if (x.shape?.length) { const w = Math.max(...x.shape.map(r => r.length)); if (!x.shape.join('').includes('#')) report('error', 'Form ohne belegtes Feld (#)'); if (x.shape.some(r => /[^#. ]/.test(r))) report('error', 'Form: nur # und . erlaubt'); if (w > 6 || x.shape.length > 6) report('warning', 'Form größer als 6 × 6'); }
      if (x.category === 'blueprint' && !x.teaches) report('warning', 'Bauplan ohne Rezept'); if (x.category === 'food' && !x.buff) report('hint', 'Gericht ohne Buff'); },
  },
  lootTables: {
    name: 'Beutetabellen', singular: 'Beutetabelle', icon: 'chest', file: 'data/loot.json', kind: 'catalog',
    hint: 'Was in Kisten, bei Gegnern und in Encountern liegt. Pro Wurf wird ein Eintrag nach Gewicht gezogen.',
    template: { name: 'Neue Beutetabelle', rolls: [1, 2], entries: [] },
    row: x => `${(x.entries || []).length} Einträge · ${(x.rolls || []).join('–')} Würfe`,
    sections: [{ title: 'Beutetabelle', fields: [NAME, range('rolls', 'Würfe'),
      table('entries', 'Einträge', [ref('item', 'Gegenstand', 'items'), num('weight', 'Gewicht', { min: 0 }), num('min', 'min', { min: 1 }), num('max', 'max', { min: 1 })]), DESCRIPTION] }],
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
        ref('result', 'Ergebnis', 'items'), ref('part', 'Oder Rig-Teil', 'rigParts', { hint: 'Statt eines Gegenstands entsteht ein Rig-Teil: es landet auf dem Schrottplatz und wird im Bau-Modus (B) an den Van gezogen' }), num('count', 'Anzahl', { min: 1 })] },
      { title: 'Entdecken', fields: [multi('discovery', 'Wie man es lernt', DISCOVERY), area_('hint', 'Hinweis', { hint: 'Was Companions oder Notizzettel andeuten' })] },
    ],
    check: (x, report) => {
      if (!(x.ingredients || []).length) report('error', 'Rezept ohne Zutaten');
      if (!x.result && !x.part) report('warning', 'Rezept ohne Ergebnis (Gegenstand oder Rig-Teil)');
      if (x.result && x.part) report('warning', 'Gegenstand und Rig-Teil: das Rig-Teil gewinnt');
      if ((x.ingredients || []).some(i => i.item === x.result)) report('warning', 'Ergebnis ist auch Zutat');
      const kinds = (x.ingredients || []).map(i => i.item); if (new Set(kinds).size !== kinds.length) report('warning', 'Eine Zutat steht doppelt in der Liste (Anzahl erhöhen)');
    },
  },
  crafting: {
    name: 'Kochen & Craften', icon: 'workbench', file: 'data/crafting.json', kind: 'single',
    hint: 'An Kochnische, Küche und Werkbank im Camp (E): Rezeptbuch links, Experimentieren in der Mitte. Ein Treffer landet im Rezeptbuch, ein Fehlschlag ergibt kuriosen Müll. Zutaten kommen aus Lager, Kiste und Rucksack, Ergebnisse gehen in den Rucksack (sonst Kiste, Lager, Boden). Rezepte selbst stehen im Bereich Rezepte.',
    sections: [
      { title: 'Experimentieren', fields: [num('slots', 'Zutaten im Topf', { min: 1, max: 8, hint: 'Wie viele verschiedene Zutaten man zusammenwerfen kann' }),
        num('experimentMinutes', 'Ein Versuch dauert', { unit: 'min', min: 0, hint: 'Bei einem Fehlschlag; ein Treffer dauert so lang wie das Rezept' }),
        bool('exactCounts', 'Genaue Mengen', { hint: 'An: nur die genaue Menge jeder Zutat trifft. Aus: die richtigen Zutaten in mindestens der richtigen Menge treffen, verbraucht wird nur, was das Rezept braucht' }),
        num('failConsume', 'Fehlschlag verbraucht', { unit: '%', min: 0, max: 100, hint: 'Anteil der Zutaten im Topf, der bei einem Fehlschlag weg ist (mindestens 1 je Zutat)' }),
        bool('nearMiss', 'Knapp daneben melden', { hint: 'Fehlt nur eine Zutat (oder eine ist zu viel), sagt das Spiel „Knapp daneben“' }),
        bool('consumeNotes', 'Zettel verbrauchen', { hint: 'Notizzettel, Baupläne und Kochbücher verschwinden beim Lesen' })] },
      { title: 'Fehlschläge', fields: [table('failures', 'Kurioser Müll', [select('function', 'Werkstatt-Art', WORKSHOP_FUNCTIONS), ref('item', 'Gegenstand', 'items'), num('weight', 'Gewicht', { min: 0 }), num('min', 'min', { min: 1 }), num('max', 'max', { min: 1 })],
        { hint: 'Was bei einem Fehlschlag herauskommt, gezogen nach Gewicht. Zeilen ohne Werkstatt-Art gelten überall' })] },
      { title: 'Texte', fields: [text('texts.hit', 'Treffer', { hint: '{name} = Ergebnis' }), text('texts.learnt', 'Neues Rezept', { hint: '{name} = Rezept' }), text('texts.miss', 'Fehlschlag', { hint: '{name} = Müll' }),
        text('texts.near', 'Knapp daneben'), text('texts.read', 'Zettel gelesen', { hint: '{name} = Rezept' })] },
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
      bool('carries', 'Trägt obendrauf', { hint: 'Auf dem Dach darf ein stapelbarer Container stehen. Wie hoch, bestimmt die Zugmaschine (Stapelhöhe)' }), VALUE, DESCRIPTION] },
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
      { title: 'Werkstatt', fields: [NAME, LOOK, select('function', 'Funktion', WORKSHOP_FUNCTIONS), STAGE, DESCRIPTION] },
      { title: 'Werte', fields: [num('places', 'Plätze', { min: 1, max: 3 }), num('power', 'Energie', { unit: '⚡', hint: '+ liefert, − braucht' }), num('capacity', 'Kapazität', { min: 0, hint: 'Lagerplätze, Betten …' }),
        ref('buff', 'Buff', 'buffs', { hint: 'z. B. Schlafzimmer oder Chill Area' }), size('grid', 'Lager-Raster', { unit: 'Felder', hint: 'Ist dieser Platz ein Inventar (Lager, Kühlraum, Waffenkammer): Größe des Rasters. Leer = kein Lager' }), VALUE] },
      { title: 'Aussehen im Rig', fields: [num('scale', 'Maßstab', { unit: '%', min: 30, max: 200, hint: 'Korrektur zum gemeinsamen Maßstab der Werkstatt-Bilder (Camp › Rig-Ansicht), z. B. wenn ein Bild etwas zu groß gemalt ist' }),
        num('fit', 'Breite im Platz', { unit: '%', min: 30, max: 200, hint: 'Nur ohne gemeinsamen Maßstab: wie breit das Bild im Platz steht (100 = so breit wie der Platz), höchstens so hoch wie der Innenraum' }),
        ref('lookEmpty', 'Aussehen leer', 'assets', { hint: 'Für Lager: dieselbe Grafik leer, deckungsgleich. Je voller das Lager, desto mehr Fächer zeigt das Spiel aus dem Aussehen (voll), von unten nach oben' }),
        table('fill', 'Fächer', [num('y', 'Oberkante', { unit: 'Bildpixel', min: 0 })], { hint: 'Wo die Fächer anfangen (Bildpixel von oben, von oben nach unten sortiert). Das unterste Fach füllt sich zuerst' })] },
      { title: 'Licht & Effekte', fields: [table('fx', 'Effekte', [select('kind', 'Art', BENCH_FX), num('x', 'x'), num('y', 'y'), num('w', 'Breite'), num('h', 'Höhe'), color('color', 'Farbe'), num('size', 'Größe'), num('rate', 'Tempo'), select('when', 'Wann', BENCH_FX_WHEN), num('idle', 'Sonst %', { min: 0, max: 100 })],
        { hint: 'Alles in Bildpixeln des Aussehens (x/y = linke obere Ecke, Breite/Höhe = Bereich). Licht: Größe = Radius, Tempo = Flackern %. Bildschirm: Tempo = Zeilen pro Sekunde. Dampf/Rauch/Blasen: Tempo = pro Sekunde. Funken: Tempo = Schauer pro Minute. LED: Tempo = Blinken pro Sekunde. Lichter funkeln: findet die hellen Punkte im Bereich selbst. Fische: Tempo = Anzahl. Druckkopf: fährt im Bereich hin und her. Glanz: läuft alle „Tempo“ Sekunden über den Bereich. Wann: Immer, abends, wenn Leyla nah ist oder bei Benutzung; „Sonst %“ = Stärke, solange es nicht zutrifft' })] },
      { title: 'Benutzen', fields: [text('rest.verb', 'Knopf', { hint: 'Für Chill Area, Drohnenwerkstatt & Co.: Was Leyla hier macht (z. B. „Fernsehen und abhängen“). Leer = nur Infos' }), num('rest.hours', 'Dauer', { unit: 'h', min: 0 }),
        num('rest.heal', 'Heilt', { unit: '%', min: 0, max: 100 }), text('rest.banner', 'Meldung danach'), bool('rest.drone', 'Mama-Bot dockt an', { hint: 'Die Drohne fliegt zur Werkstatt und setzt sich drauf, solange Leyla hier ist' })] },
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
      { title: 'Im Rig', fields: [refs('workshops', 'Betreibt', 'workshops'), refs('buffs', 'Gibt Buffs', 'buffs'), refs('tips', 'Kennt Rezepte', 'recipes')] },
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
      { title: 'Rig-Ansicht', fields: [num('rig.placeWidth', 'Breite pro Platz', { unit: 'Kacheln', min: 2 }), num('rig.height', 'Raumhöhe', { unit: 'px', min: 200 }), num('rig.benchScale', 'Maßstab der Werkstatt-Bilder', { unit: '× Bildpixel', min: 0, step: 0.01, hint: 'Alle Werkstatt-Bilder im Rig gleich groß gepixelt (1 = ein Bildpixel ist ein Spielpixel). Leer oder 0 = jedes Bild passt sich in seinen Platz ein' }), num('rig.gap', 'Abstand zwischen Containern', { unit: 'Kacheln', min: 0, hint: 'Nur für den Platz, den das Rig im Camp freihält; Anhänger aus Code hängen mit der Deichsel aneinander' }),
        num('rig.open.near', 'Öffnet in der Nähe', { unit: 'px', min: 0, hint: 'Container mit „Aussehen geschlossen“ blenden auf, wenn Leyla höchstens so weit links oder rechts davon ist (und auf seiner Etage). 0 = nur wenn sie davor steht' }),
        num('rig.open.fade', 'Aufblenden dauert', { unit: 'ms', min: 0 }), num('rig.open.lights', 'Licht bei geschlossen', { unit: '%', min: 0, max: 100, hint: 'Wie viel vom Raumlicht durch die geschlossene Hülle scheint' }),
        num('rig.lift', 'Boden über der Straße', { unit: 'px', min: 20, hint: 'Anhänger aus Code: so hoch steht der Boden auf dem Fahrgestell' }), num('rig.drawbar', 'Deichsel', { unit: 'px', min: 40, hint: 'Anhänger aus Code: Länge der Deichsel bis zur Kupplung' }),
        num('rig.boxAt', 'Deichselkasten bei', { unit: '%', min: 0, max: 100, hint: 'Wo der Kasten auf der Deichsel sitzt (0 = am Aufbau, 100 = an der Kupplung); E dort öffnet den Stauraum des Anhängers' }),
        num('rig.trunkAt', 'Kofferraum bei', { unit: '%', min: 0, max: 100, hint: 'E-Punkt für den Stauraum der Zugmaschine, von links über die Breite des Vans' }),
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
        num('sound.fireMin', 'Feuer von weitem', { unit: '%', min: 0, max: 100 }), num('sound.fireRange', 'Hörweite', { unit: 'px', min: 50 }), num('sound.fireNear', 'Voll ab', { unit: 'px', min: 0, hint: 'Näher als das: volle Lautstärke' })] },
      { title: 'Companions', fields: [range('companions.at', 'Stehen von – bis', { unit: 'Kacheln vom Van' }), range('companions.barkEvery', 'Sprüche alle', { unit: 's' }), num('companions.barkTime', 'Bläschen zeigen', { unit: 's', min: 1 })] },
      { title: 'Zeit', fields: [num('clock.startDay', 'Start-Tag', { min: 1 }), num('clock.startHour', 'Start-Uhrzeit', { unit: 'h', min: 0, max: 23.99, step: 0.25 }),
        num('clock.arriveHour', 'Ankunft im Camp um', { unit: 'h', min: 0, max: 23.99, step: 0.25, hint: 'Daniel: „Camp startet immer in der Dämmerung“. Beim Laden, nach einem Run und nach dem Fahren springt die Uhr vor bis zu dieser Uhrzeit. Leer = Uhr läuft nur mit den Aktionen' }),
        num('clock.wakeHour', 'Aufwachen um', { unit: 'h', min: 0, max: 23 }), num('clock.runHours', 'Ein Run dauert', { unit: 'h', min: 0, step: 0.25 }),
        num('clock.fireHours', 'Am Feuer sitzen', { unit: 'h', min: 0, step: 0.25 })] },
      { title: 'Tag & Nacht', fields: [table('daytime', 'Tageszeiten', [num('from', 'Ab Uhr'), ref('weather', 'Wetter', 'weather'), num('shade', 'Abdunkeln %', { min: 0, max: 90 }), num('light', 'Licht %', { min: 0, max: 100 }), text('name', 'Name')],
        { hint: 'Ab dieser Uhrzeit gilt die Zeile (bis zur nächsten). Abdunkeln legt die Nacht über die Welt; Licht = wie stark Lagerfeuer und Fenster scheinen (tagsüber 0)' })] },
      { title: 'Heilen', fields: [num('heal.sleep', 'Schlafen', { unit: '%', min: 0, max: 100 }), num('heal.fire', 'Am Feuer', { unit: '%', min: 0, max: 100 }), num('heal.afterKo', 'Nach k.o.', { unit: '%', min: 1, max: 100, hint: 'Mit so viel Leben bringt Mama-Bot Leyla zurück' })] },
      { title: 'Bedienen', fields: [num('interactRange', 'E-Reichweite', { unit: 'px', min: 20 }), ref('fallbackRoom', 'Ersatzraum', 'rooms', { hint: 'Für POIs, deren Raum-Bausteine noch kein Layout haben' })] },
    ],
    check: (x, report, p) => {
      const rows = [...(x.daytime || [])].sort((a, b) => (a.from ?? 0) - (b.from ?? 0));
      if (!rows.length) report('warning', 'Keine Tageszeiten: das Camp nimmt das erste Wetter');
      for (const r of rows) if (r.weather && !p.data.weather?.[r.weather]) report('error', `Wetter ${r.weather} fehlt`);
      if (x.fallbackRoom && !p.data.rooms?.[x.fallbackRoom]?.layout?.length) report('warning', 'Ersatzraum hat kein Layout');
    },
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
        num('view.shake', 'Wackeln beim Einrasten', { unit: '%', min: 0, max: 200 }), num('view.volume', 'Lautstärke der Bau-Töne', { unit: '%', min: 0, max: 100 })] },
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
      { title: 'Aufbau', fields: [range('roomCount', 'Räume', { hint: 'Wie viele Räume zusammengesetzt werden' }), refs('rooms', 'Raum-Bausteine', 'rooms'), refs('enemies', 'Gegner', 'enemies', { hint: 'Für das Zeichen 1 im Layout: ein zufälliger dieser Gegner' }), ref('loot', 'Kisten-Beute', 'lootTables', { hint: 'Für Kisten (C) in den Räumen' })] },
      { title: 'Level', fields: [num('branchChance', 'Abzweige', { unit: '%', min: 0, max: 100, hint: 'Chance je Abzweig-Haken (A in der Decke eines Hauptraums), dass ein Seitenraum (Merkmal Beute/Geheimnis, A im Boden) darüber hängt. Leer = 60' }),
        bool('shortcut', 'Abkürzung zum Van', { hint: 'Tunnel unter allen Räumen: v im Boden des Ausgangs → ^ im Boden des Eingangs. Aus = kein Tunnel. Leer = an' }),
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
  rooms: {
    name: 'Raum-Bausteine', singular: 'Raum', icon: 'tile', file: 'data/rooms.json', kind: 'catalog',
    hint: 'Handgebaute Räume, aus denen POIs zusammengesetzt werden. Das Layout ist Text: ein Zeichen pro Kachel. Später kommt ein Level-Editor dazu.',
    template: { name: 'Neuer Raum', size: [30, 17], tags: ['combat'], weight: 1 },
    row: x => `${(x.size || []).join('×')} · ${(x.tags || []).map(t => label(ROOM_TAGS, t)).join(', ')}${x.layout ? ' · Layout' : ''}`,
    sections: [
      { title: 'Raum', fields: [NAME, LOOK, size('size', 'Größe', { unit: 'Kacheln' }), multi('tags', 'Merkmale', ROOM_TAGS), num('weight', 'Häufigkeit', { min: 0 }),
        bool('indoor', 'Innenraum', { hint: 'Im POI-Level: Rückwand statt Himmel. Leer = Innenraum, wenn der Raum keinen eigenen Hintergrund hat' }), DESCRIPTION] },
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
    hint: 'Zufallsbegegnungen auf der Reise. Spielen sich wie kleine Level.',
    template: { name: 'Neuer Encounter', weight: 1, time: 'any', enemies: [] },
    row: x => `${label(DAYTIME, x.time)} · Gewicht ${x.weight ?? 0}`,
    sections: [{ title: 'Encounter', fields: [NAME, LOOK, num('weight', 'Gewicht', { min: 0 }), select('time', 'Tageszeit', DAYTIME), refs('enemies', 'Gegner', 'enemies'), ref('loot', 'Beute', 'lootTables'), DESCRIPTION] }],
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
  ['GRUNDLAGEN', ['game', 'splash', 'weather', 'economy', 'ranking']],
  ['LEYLA', ['leyla', 'drone', 'backpacks']],
  ['KAMPF', ['weapons', 'enemies', 'buffs']],
  ['BEUTE & CRAFTING', ['items', 'lootTables', 'recipes', 'crafting']],
  ['RIG', ['camp', 'build', 'tractors', 'containers', 'workshops', 'rigParts', 'companions']],
  ['WELT', ['pois', 'rooms', 'locations', 'encounters', 'travel']],
];

export const optionLabel = label;
export const fields = a => AREAS[a].sections.flatMap(s => s.fields);
