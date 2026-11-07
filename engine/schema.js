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
export const RIG_SLOTS = [['engine', 'Motor'], ['armor', 'Panzerung'], ['weapon', 'Waffe']];
export const POI_KINDS = [['gasStation', 'Tankstelle'], ['settlement', 'Siedlung'], ['factory', 'Fabrik'], ['bunker', 'Bunker'], ['government', 'Regierungskomplex'], ['mall', 'Einkaufszentrum'], ['ruin', 'Ruine']];
export const POI_SIZES = [['S', 'S'], ['M', 'M'], ['L', 'L'], ['XL', 'XL']];
export const ROOM_TAGS = [['start', 'Eingang'], ['exit', 'Ausgang'], ['combat', 'Kampf'], ['loot', 'Beute'], ['secret', 'Geheimnis'], ['npc', 'NPCs'], ['boss', 'Boss'], ['corridor', 'Gang']];
export const ASSET_KINDS = [['animation', 'Animation'], ['tiles', 'Kacheln'], ['image', 'Bild'], ['sound', 'Ton'], ['reference', 'Referenz'], ['source', 'Original']];
export const DAYTIME = [['any', 'Immer'], ['day', 'Tag'], ['night', 'Nacht']];
export const DRONE_MOODS = [['idle', 'Normal'], ['kill', 'Gegner erledigt'], ['cleared', 'Raum geräumt'], ['bored', 'Langeweile'], ['alert', 'Gegner in der Nähe'],
  ['curious', 'Neugierig (zufällig)'], ['hit', 'Leyla getroffen'], ['sleep', 'Schlafen'], ['down', 'Leyla k.o.'], ['scan', 'Scannen (zufällig)'], ['lowHealth', 'Wenig Leben'], ['dash', 'Dash']];
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
        table('start.inventory', 'Start-Inventar', [select('where', 'Wo', [['backpack', 'Rucksack'], ['chest', 'Kiste im Camp'], ['storage', 'Erstes Lager']]), ref('item', 'Gegenstand', 'items'), ref('weapon', 'Waffe', 'weapons'), ref('backpack', 'Rucksack', 'backpacks'), num('count', 'Anzahl', { min: 1 })],
          { hint: 'Pro Zeile ein Gegenstand, eine Waffe oder ein Rucksack. Platz suchen die Dinge sich selbst' }),
        refs('start.workshops', 'Werkstätten', 'workshops', { hint: 'Werden der Reihe nach verteilt: erst in die Plätze der Zugmaschine, dann in die Container' }), refs('start.companions', 'Companions', 'companions'), num('start.fuel', 'Sprit', { unit: 'l', min: 0 }), num('start.food', 'Vorräte', { unit: 'Rationen', min: 0 })] },
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
        color('ground.base', 'Farbe Boden', { hint: 'Am besten die Bodenfarbe der vordersten Ebene' }), color('ground.color', 'Farbe Steinchen'), bool('ground.dust', 'Staubwölkchen', { hint: 'Kleine Wolken bei jedem Schritt' }), bool('ground.shadow', 'Schatten unter Leyla')] },
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
      { title: 'Verhalten', fields: [num('idle.boredAfter', 'Langeweile nach', { unit: 's', min: 0, hint: 'Leyla steht still' }), num('idle.sleepAfter', 'Einschlafen nach', { unit: 's', min: 0 }),
        range('idle.randomEvery', 'Zufällige Stimmung alle', { unit: 's', hint: 'Neugierig oder Scannen, während Leyla unterwegs ist' }), num('alertRange', 'Gegner bemerken ab', { unit: 'px', min: 0 }),
        num('lowHealth', 'Wenig Leben unter', { unit: '%', min: 0, max: 100 })] },
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
      { title: 'Kanten & Ducken', fields: [bool('movement.ledgeGrab', 'Kanten greifen', { hint: 'Im Sprung oder Fall an Wand- und Plattformkanten hängen bleiben (Richtung zur Wand halten)' }),
        num('movement.ledgeReach', 'Greifweite', { unit: 'px', min: 0, hint: 'So weit dürfen die Hände unter der Kante sein' }),
        num('movement.mantleTime', 'Hochziehen', { unit: 'ms', min: 50 }), num('movement.mantleFromFrame', 'Hochziehen ab Frame', { min: 1, hint: 'Die ersten Frames der Animation (Stehen, Arme hoch) werden übersprungen' }),
        num('movement.standUpTime', 'Aufstehen', { unit: 'ms', min: 0, hint: 'Nach dem Hochziehen aus der Hocke; Laufen oder Springen bricht ab' }),
        num('movement.crouchTime', 'In die Hocke', { unit: 'ms', min: 0, hint: 'Ducken: S im Stand halten. In der Hocke an einer Kante nochmal S = runter an die Kante hängen' })] },
      { title: 'Aussehen', fields: [ref('look.idle', 'Stehen', 'assets'), ref('look.idleAlt', 'Stehen 2', 'assets', { hint: 'Zweite Idle, wechselt zufällig mit Stehen (nach jedem Durchlauf)' }),
        num('idleAltChance', 'Stehen 2 Anteil', { unit: '%', min: 0, max: 100, hint: 'Wie oft nach einem Durchlauf Stehen 2 kommt' }), ref('look.walk', 'Gehen', 'assets'), ref('look.run', 'Rennen', 'assets'),
        ref('look.jump', 'Springen', 'assets'), ref('look.airJump', 'Doppelsprung', 'assets', { hint: 'Läuft einmal beim Sprung in der Luft' }), ref('look.fall', 'Fallen', 'assets', { hint: 'Gleiches Asset wie Springen: läuft dann einfach weiter, beim Fallen ohne Sprung ab der Mitte' }), ref('look.dash', 'Dash', 'assets'), ref('look.slide', 'Slide', 'assets'),
        ref('look.climb', 'Klettern', 'assets'), ref('look.land', 'Harte Landung', 'assets', { hint: 'Nur nach weiten Sprüngen oder tiefen Stürzen (Leyla › Harte Landung)' }), ref('look.crouch', 'Ducken', 'assets', { hint: 'Läuft einmal in die Hocke und hält den letzten Frame; rückwärts = Aufstehen nach dem Hochziehen' }),
        ref('look.hang', 'Hängen', 'assets', { hint: 'An einer Kante, Schleife' }), ref('look.mantle', 'Hochziehen', 'assets', { hint: 'An der Kante hoch, ab „Hochziehen ab Frame“' }), ref('look.hurt', 'Treffer', 'assets'), ref('look.reference', 'Referenz', 'assets', { hint: 'Character Sheet, Konzept' })] },
      { title: 'Start-Ausrüstung', fields: [ref('loadout.melee', 'Nahkampf', 'weapons'), ref('loadout.ranged', 'Fernkampf', 'weapons'), ref('loadout.cyberdeck', 'Cyberdeck', 'weapons'), ref('loadout.backpack', 'Rucksack', 'backpacks')] },
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
    sections: [{ title: 'Rucksack', fields: [NAME, LOOK, size('size', 'Raster', { unit: 'Felder' }), size('bag', 'Platz als Gegenstand', { unit: 'Felder', hint: 'So viel Platz braucht der Rucksack selbst in einem Lager (Standard 2 × 3)' }),
      num('tier', 'Stufe', { min: 1, max: 5 }), text('glyph', 'Kürzel', { hint: 'Platzhalter im Inventar' }), VALUE, DESCRIPTION] }],
  },

  weapons: {
    name: 'Waffen', singular: 'Waffe', icon: 'weapon', file: 'data/weapons.json', kind: 'catalog', groupBy: { key: 'kind', options: WEAPON_KINDS },
    hint: 'Nahkampf, Fernkampf und Cyberdecks (Hacking, später). Leyla trägt je eine davon in ihren Slots.',
    template: { name: 'Neue Waffe', kind: 'melee', damage: 10, cooldown: 400, range: 40, knockback: 100, size: [1, 2], tier: 1, value: 20 },
    row: x => `${label(WEAPON_KINDS, x.kind)} · ${x.damage ?? 0} Schaden · ${x.cooldown ?? 0} ms`,
    sections: [
      { title: 'Waffe', fields: [NAME, LOOK, select('kind', 'Art', WEAPON_KINDS, { required: true }), num('tier', 'Stufe', { min: 1, max: 5 }),
        text('glyph', 'Kürzel', { hint: 'Platzhalter im Inventar: 1–3 Zeichen oder ein Emoji' }), DESCRIPTION] },
      { title: 'Werte', fields: [num('damage', 'Schaden', { min: 0 }), num('cooldown', 'Abklingzeit', { unit: 'ms', min: 0 }), num('range', 'Reichweite', { unit: 'px', min: 0 }),
        num('knockback', 'Rückstoß', { unit: 'px/s', min: 0 }), num('critChance', 'Krit-Chance', { unit: '%', min: 0, max: 100 }), num('ammo', 'Munition', { min: 0, hint: 'Leer = unendlich' }),
        num('projectileSpeed', 'Geschosstempo', { unit: 'px/s', min: 0, hint: 'Nur Fernkampf: so schnell fliegt das Geschoss' })] },
      { title: 'Rucksack & Handel', fields: [size('size', 'Größe', { unit: 'Felder' }), VALUE] },
    ],
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
      { title: 'Gegenstand', fields: [NAME, LOOK, select('category', 'Kategorie', ITEM_CATEGORIES), DESCRIPTION] },
      { title: 'Rucksack & Handel', fields: [size('size', 'Größe', { unit: 'Felder', hint: 'Rechteck im Raster; eine Form (unten) hat Vorrang' }),
        lines('shape', 'Form', { hint: 'Tetris-Form: eine Zeile pro Reihe, # = belegt, . = frei (z. B. „#.“ / „##“ für ein L). Leer = Rechteck aus „Größe“. Im Spiel mit Rechtsklick drehbar' }),
        num('stack', 'Stapel', { min: 1 }), text('glyph', 'Kürzel', { hint: 'Platzhalter im Inventar, solange es kein Aussehen gibt: 1–3 Zeichen oder ein Emoji' }), VALUE] },
      { title: 'Wirkung', fields: [ref('buff', 'Buff beim Essen/Benutzen', 'buffs'), ref('teaches', 'Bringt Rezept bei', 'recipes', { hint: 'Für Baupläne und Kochbücher' })] },
    ],
    check: (x, report) => {
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
    row: (x, p) => `${(x.ingredients || []).map(i => `${i.count}× ${p?.data.items?.[i.item]?.name || i.item}`).join(' + ') || '–'} → ${p?.data.items?.[x.result]?.name || x.result || '?'}`,
    sections: [
      { title: 'Rezept', fields: [NAME, ref('station', 'Werkstatt', 'workshops', { required: true }), num('time', 'Dauer', { unit: 's', min: 0 })] },
      { title: 'Zutaten → Ergebnis', fields: [table('ingredients', 'Zutaten', [ref('item', 'Gegenstand', 'items'), num('count', 'Anzahl', { min: 1 })]),
        ref('result', 'Ergebnis', 'items', { required: true }), num('count', 'Anzahl', { min: 1 })] },
      { title: 'Entdecken', fields: [multi('discovery', 'Wie man es lernt', DISCOVERY), area_('hint', 'Hinweis', { hint: 'Was Companions oder Notizzettel andeuten' })] },
    ],
    check: (x, report) => {
      if (!(x.ingredients || []).length) report('error', 'Rezept ohne Zutaten');
      if ((x.ingredients || []).some(i => i.item === x.result)) report('warning', 'Ergebnis ist auch Zutat');
    },
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
        num('length', 'Plätze hintereinander', { min: 0 }), num('stack', 'Stapelhöhe', { min: 1 })] },
      { title: 'Slots', fields: [num('slots.engine', 'Motor', { min: 0 }), num('slots.armor', 'Panzerung', { min: 0 }), num('slots.weapon', 'Waffen', { min: 0 })] },
    ],
  },
  containers: {
    name: 'Container', singular: 'Container', icon: 'box', file: 'data/containers.json', kind: 'catalog', groupBy: { key: 'kind', options: CONTAINER_KINDS },
    hint: 'Payload des Rigs. Je nach Größe fasst ein Container eine, zwei oder drei Werkstätten.',
    template: { name: 'Neuer Container', kind: 'crate', places: 1, weight: 300, value: 100 },
    row: x => `${label(CONTAINER_KINDS, x.kind)} · ${x.places ?? 0} ${x.places === 1 ? 'Platz' : 'Plätze'} · ${x.weight ?? 0} kg`,
    sections: [{ title: 'Container', fields: [NAME, LOOK, select('kind', 'Art', CONTAINER_KINDS), num('places', 'Werkstatt-Plätze', { min: 1, max: 3 }),
      num('weight', 'Gewicht', { unit: 'kg', min: 0 }), bool('stackable', 'Stapelbar'), VALUE, DESCRIPTION] }],
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
    ],
  },
  rigParts: {
    name: 'Rig-Teile', singular: 'Rig-Teil', icon: 'anvil', file: 'data/rig_parts.json', kind: 'catalog', groupBy: { key: 'slot', options: RIG_SLOTS },
    hint: 'Motoren, Panzerung und Waffen für die Slots der Zugmaschine.',
    template: { name: 'Neues Rig-Teil', slot: 'engine', pull: 0, armor: 0, damage: 0, fuelUse: 0, value: 200 },
    row: x => label(RIG_SLOTS, x.slot),
    sections: [{ title: 'Rig-Teil', fields: [NAME, LOOK, select('slot', 'Slot', RIG_SLOTS), num('pull', 'Zugkraft +', { unit: 'kg' }), num('armor', 'Panzerung +'), num('damage', 'Schaden'),
      num('fuelUse', 'Verbrauch ±', { unit: 'l/100 km' }), VALUE, DESCRIPTION] }],
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
      { title: 'Schacht', fields: [bool('shaft.enabled', 'Zeigen', { hint: 'Daniel: Andeutung eines Schachts nach unten, links im Camp, nicht betretbar' }), num('shaft.at', 'Ab Spalte', { unit: 'Kacheln', min: 1 }),
        num('shaft.width', 'Breite', { unit: 'Kacheln', min: 1 }), color('shaft.color', 'Dunkelheit'), color('shaft.glow', 'Glühen von unten', { hint: 'Leer = nichts' }), num('shaft.frameHeight', 'Förderturm', { unit: 'px', min: 0, hint: 'Holzgerüst mit Rolle und Seil über dem Schacht, 0 = keins' })] },
      { title: 'Rig-Ansicht', fields: [num('rig.placeWidth', 'Breite pro Platz', { unit: 'Kacheln', min: 2 }), num('rig.height', 'Raumhöhe', { unit: 'px', min: 200 }), num('rig.gap', 'Abstand zwischen Containern', { unit: 'Kacheln', min: 0 }),
        color('rig.wall', 'Wand'), color('rig.inside', 'Innen'), color('rig.light', 'Licht'), bool('rig.labels', 'Namen anzeigen')] },
      { title: 'Lagerfeuer', fields: [bool('fire.enabled', 'Zeigen'), ref('fire.look', 'Aussehen', 'assets', { hint: 'Animation, Ankerpunkt = Mitte am Boden. Leer = Flammen aus Code' }), num('fire.at', 'Abstand vom Van', { unit: 'Kacheln', min: 1 }),
        num('fire.radius', 'Lichtradius', { unit: 'px', min: 0 }), color('fire.color', 'Lichtfarbe'), num('fire.strength', 'Lichtstärke', { unit: '%', min: 0, max: 200, hint: 'Bei Licht 100 % der Tageszeit' }),
        num('fire.pool', 'Lichtkegel am Boden', { unit: 'px', min: 0, hint: 'Breite des warmen Scheins auf dem Boden, 0 = aus' }), num('fire.flicker', 'Flackern', { unit: '%', min: 0, max: 100 }), num('fire.lift', 'Lichtmitte über dem Boden', { unit: 'px', min: 0 })] },
      { title: 'Am Feuer sitzen', fields: [ref('fire.sit.look', 'Animation', 'assets', { hint: 'Daniel: Leyla sitzt am Feuer und zockt, gespiegelt je nach Seite. E setzt sie hin, E oder Laufen steht auf' }),
        num('fire.sit.distance', 'Abstand zum Feuer', { unit: 'px', min: 0 }), num('fire.sit.downTo', 'Hinsetzen bis Frame', { min: 1 }), range('fire.sit.loop', 'Schleife Frames'),
        num('fire.sit.upFrom', 'Aufstehen ab Frame', { min: 1 }), num('fire.sit.fps', 'Tempo', { unit: 'fps', min: 1 }), num('fire.sit.minSeconds', 'Zeit vergeht ab', { unit: 's', min: 0, hint: 'Wer so lange sitzt, bekommt beim Aufstehen „Am Feuer sitzen“ (Zeit + Heilen)' })] },
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

  pois: {
    name: 'POIs', singular: 'POI', icon: 'building', file: 'data/pois.json', kind: 'catalog', groupBy: { key: 'kind', options: POI_KINDS },
    hint: 'Orte zum Plündern. Hybrid gebaut: handgebaute Räume werden prozedural zusammengesetzt.',
    template: { name: 'Neuer POI', kind: 'gasStation', size: 'S', danger: 1, rooms: [], enemies: [], parTime: 120, secrets: 1 },
    row: x => `${label(POI_KINDS, x.kind)} · ${x.size} · Gefahr ${'●'.repeat(x.danger || 0)}`,
    sections: [
      { title: 'POI', fields: [NAME, LOOK, select('kind', 'Art', POI_KINDS), select('size', 'Größe', POI_SIZES), num('danger', 'Gefahr', { min: 1, max: 5 }), DESCRIPTION] },
      { title: 'Aufbau', fields: [range('roomCount', 'Räume', { hint: 'Wie viele Räume zusammengesetzt werden' }), refs('rooms', 'Raum-Bausteine', 'rooms'), refs('enemies', 'Gegner', 'enemies'), ref('loot', 'Kisten-Beute', 'lootTables')] },
      { title: 'Ranking', fields: [num('parTime', 'Bestzeit', { unit: 's', min: 0 }), num('secrets', 'Secrets', { min: 0 })] },
      { title: 'Leben', fields: [bool('npcs', 'NPCs vor Ort'), bool('foodtruck', 'Foodtruck-Verkauf möglich'), bool('shop', 'Händler')] },
    ],
    check: (x, report, p) => {
      const R = p.data.rooms || {};
      if (!(x.rooms || []).some(r => R[r]?.tags?.includes('start'))) report('warning', 'Kein Raum mit Eingang');
      if (!(x.rooms || []).some(r => R[r]?.tags?.includes('exit'))) report('warning', 'Kein Raum mit Ausgang');
    },
  },
  rooms: {
    name: 'Raum-Bausteine', singular: 'Raum', icon: 'tile', file: 'data/rooms.json', kind: 'catalog',
    hint: 'Handgebaute Räume, aus denen POIs zusammengesetzt werden. Das Layout ist Text: ein Zeichen pro Kachel. Später kommt ein Level-Editor dazu.',
    template: { name: 'Neuer Raum', size: [30, 17], tags: ['combat'], weight: 1 },
    row: x => `${(x.size || []).join('×')} · ${(x.tags || []).map(t => label(ROOM_TAGS, t)).join(', ')}${x.layout ? ' · Layout' : ''}`,
    sections: [
      { title: 'Raum', fields: [NAME, LOOK, size('size', 'Größe', { unit: 'Kacheln' }), multi('tags', 'Merkmale', ROOM_TAGS), num('weight', 'Häufigkeit', { min: 0 }), DESCRIPTION] },
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
  ['BEUTE & CRAFTING', ['items', 'lootTables', 'recipes']],
  ['RIG', ['camp', 'tractors', 'containers', 'workshops', 'rigParts', 'companions']],
  ['WELT', ['pois', 'rooms', 'locations', 'encounters', 'travel']],
];

export const optionLabel = label;
export const fields = a => AREAS[a].sections.flatMap(s => s.fields);
