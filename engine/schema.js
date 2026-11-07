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
export const ASSET_KINDS = [['animation', 'Animation'], ['tiles', 'Kacheln'], ['image', 'Bild'], ['reference', 'Referenz'], ['source', 'Original']];
export const DAYTIME = [['any', 'Immer'], ['day', 'Tag'], ['night', 'Nacht']];
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
        num('height', 'Höhe im Spiel', { unit: 'px', min: 1, hint: 'Auf diese Höhe wird das Bild bzw. ein Frame im Spiel skaliert' }), bool('flip', 'Schaut nach links', { hint: 'Wenn die Grafik nach links schaut; das Spiel spiegelt dann umgekehrt' })] },
      { title: 'Herkunft', fields: [text('source', 'Erzeugt mit', { hint: 'KI-Werkzeug oder Code' }), ref('derivedFrom', 'Abgeleitet von', 'assets', { hint: 'z. B. Streifen aus einem Original-GIF' }), text('date', 'Datum')] },
    ],
    check: (x, report, p) => {
      if (x.file && p.exists && !p.exists(x.file)) report('error', `Datei ${x.file} fehlt`);
      if (x.kind === 'tiles' && (!x.frameSize || !x.frames)) report('error', 'Kacheln ohne Frame-Größe oder Frames');
      if (x.kind === 'animation') {
        if (x.file && !/\.(png|webp)$/i.test(x.file)) report('warning', 'Animationen sind PNG-Streifen');
        if (!x.frameSize || !x.frames) report('error', 'Animation ohne Frame-Größe oder Frames');
        const [w, h] = x.frameSize || [], [ox, oy] = x.origin || [];
        if (x.origin && w && (ox < 0 || ox > w || oy < 0 || oy > h)) report('warning', 'Ankerpunkt liegt außerhalb des Frames');
      }
      if (x.derivedFrom === undefined && x.kind === 'animation' && !x.source) report('hint', 'Herkunft fehlt');
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
      { title: 'Testen', fields: [ref('testRoom', 'Testraum', 'rooms', { hint: 'Diesen Raum startet „Spiel“ auf der Startseite (MVP Movement & Kampf)' })] },
      { title: 'Start', fields: [ref('start.location', 'Startort', 'locations'), ref('start.tractor', 'Zugmaschine', 'tractors'), refs('start.containers', 'Container', 'containers'),
        refs('start.workshops', 'Werkstätten', 'workshops'), refs('start.companions', 'Companions', 'companions'), num('start.fuel', 'Sprit', { unit: 'l', min: 0 }), num('start.food', 'Vorräte', { unit: 'Rationen', min: 0 })] },
    ],
    check: (x, report, p) => {
      const D = p.data, s = x.start || {};
      const places = (s.containers || []).reduce((n, c) => n + (D.containers?.[c]?.places || 0), 0);
      const used = (s.workshops || []).reduce((n, w) => n + (D.workshops?.[w]?.places || 0), 0);
      if (used > places) report('error', `Start-Werkstätten brauchen ${used} Plätze, die Start-Container haben ${places}`);
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
      { title: 'Hintergrund', fields: [refs('background', 'Ebenen', 'assets', { hint: 'Von hinten nach vorn. Alle gleich groß; die erste deckt alles, die anderen sind transparent' }),
        num('horizon', 'Horizont', { unit: '% der Höhe', min: 30, max: 100, hint: 'Hier endet der Hintergrund unten; darunter zeichnet die Startseite den Boden, auf dem Leyla rennt' }),
        num('parallax', 'Tiefe', { unit: '%', min: 0, max: 10, step: 0.5, hint: 'So weit verschieben sich die Ebenen mit Maus bzw. Neigen gegeneinander (vorderste am meisten). 0 = starr' })] },
      { title: 'Leyla', fields: [ref('runner', 'Animation', 'assets', { hint: 'Asset der Art „Animation“; Tempo und Ankerpunkt kommen von dort' }),
        num('runnerHeight', 'Größe', { unit: '% der Höhe', min: 10, max: 100, hint: 'Höhe eines Frames im Verhältnis zur Bildschirmhöhe' }),
        num('runnerX', 'Position', { unit: '% der Breite', min: 0, max: 100, hint: 'Wo Leyla steht (auf breiten Bildschirmen); auf schmalen immer in der Mitte' }),
        num('runnerFeet', 'Füße', { unit: '% der Höhe', min: 50, max: 100, hint: 'Auf welcher Höhe ihre Füße stehen (100 = unterer Rand)' })] },
      { title: 'Boden', fields: [num('ground.speed', 'Tempo', { unit: 'm/s', min: 0, max: 30, step: 0.5, hint: 'Wie schnell der Boden unter ihr auf uns zukommt. 0 = steht' }),
        num('ground.specks', 'Steinchen', { min: 0, max: 400, hint: 'Wie viele Steinchen und Risse gleichzeitig im Bild sind' }),
        color('ground.base', 'Farbe Boden', { hint: 'Am besten die Bodenfarbe der vordersten Ebene' }), color('ground.color', 'Farbe Steinchen'), bool('ground.dust', 'Staubwölkchen', { hint: 'Kleine Wolken bei jedem Schritt' }), bool('ground.shadow', 'Schatten unter Leyla')] },
    ],
    check: (x, report, p) => {
      const A = p.data.assets || {};
      if (x.runner && A[x.runner] && A[x.runner].kind !== 'animation') report('error', 'Leyla braucht ein Asset der Art „Animation“');
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

  leyla: {
    name: 'Leyla', icon: 'person', file: 'data/leyla.json', kind: 'single',
    hint: 'Alle Werte der Spielfigur. Tempo in Pixel pro Sekunde, Zeiten in Millisekunden.',
    sections: [
      { title: 'Allgemein', fields: [NAME, num('health', 'Leben', { min: 1 }), num('invulnerableAfterHit', 'Unverwundbar nach Treffer', { unit: 'ms', min: 0 }), DESCRIPTION] },
      { title: 'Laufen & Springen', fields: [num('movement.walkSpeed', 'Gehen', { unit: 'px/s', min: 0 }), num('movement.runSpeed', 'Rennen', { unit: 'px/s', min: 0 }),
        num('movement.acceleration', 'Beschleunigung', { unit: 'px/s²', min: 0 }), num('movement.jumpVelocity', 'Sprungkraft', { unit: 'px/s', min: 0 }),
        num('movement.airJumps', 'Luftsprünge', { min: 0, hint: '1 = Doppelsprung' }), num('movement.coyoteTime', 'Coyote Time', { unit: 'ms', min: 0, hint: 'Springen kurz nach der Kante erlaubt' }),
        num('movement.jumpBuffer', 'Sprungpuffer', { unit: 'ms', min: 0 })] },
      { title: 'Dash & Slide', fields: [num('movement.dashDistance', 'Dash-Weite', { unit: 'px', min: 0 }), num('movement.dashCooldown', 'Dash-Abklingzeit', { unit: 'ms', min: 0 }),
        bool('movement.dashInvulnerable', 'Unverwundbar beim Dash'), num('movement.slideSpeed', 'Slide-Tempo', { unit: 'px/s', min: 0 }), num('movement.slideDuration', 'Slide-Dauer', { unit: 'ms', min: 0 })] },
      { title: 'Klettern & Schwingen', fields: [num('movement.climbSpeed', 'Klettern', { unit: 'px/s', min: 0 }), num('movement.swingRope', 'Seillänge', { unit: 'px', min: 0 }), num('movement.swingBoost', 'Schwung-Boost', { unit: '%', min: 0 })] },
      { title: 'Aussehen', fields: [ref('look.idle', 'Stehen', 'assets'), ref('look.walk', 'Gehen', 'assets'), ref('look.run', 'Rennen', 'assets'),
        ref('look.jump', 'Springen', 'assets'), ref('look.fall', 'Fallen', 'assets'), ref('look.dash', 'Dash', 'assets'), ref('look.slide', 'Slide', 'assets'),
        ref('look.climb', 'Klettern', 'assets'), ref('look.hurt', 'Treffer', 'assets'), ref('look.reference', 'Referenz', 'assets', { hint: 'Character Sheet, Konzept' })] },
      { title: 'Start-Ausrüstung', fields: [ref('loadout.melee', 'Nahkampf', 'weapons'), ref('loadout.ranged', 'Fernkampf', 'weapons'), ref('loadout.cyberdeck', 'Cyberdeck', 'weapons'), ref('loadout.backpack', 'Rucksack', 'backpacks')] },
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
    sections: [{ title: 'Rucksack', fields: [NAME, LOOK, size('size', 'Raster', { unit: 'Felder' }), num('tier', 'Stufe', { min: 1, max: 5 }), VALUE, DESCRIPTION] }],
  },

  weapons: {
    name: 'Waffen', singular: 'Waffe', icon: 'weapon', file: 'data/weapons.json', kind: 'catalog', groupBy: { key: 'kind', options: WEAPON_KINDS },
    hint: 'Nahkampf, Fernkampf und Cyberdecks (Hacking, später). Leyla trägt je eine davon in ihren Slots.',
    template: { name: 'Neue Waffe', kind: 'melee', damage: 10, cooldown: 400, range: 40, knockback: 100, size: [1, 2], tier: 1, value: 20 },
    row: x => `${label(WEAPON_KINDS, x.kind)} · ${x.damage ?? 0} Schaden · ${x.cooldown ?? 0} ms`,
    sections: [
      { title: 'Waffe', fields: [NAME, LOOK, select('kind', 'Art', WEAPON_KINDS, { required: true }), num('tier', 'Stufe', { min: 1, max: 5 }), DESCRIPTION] },
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
      { title: 'Rucksack & Handel', fields: [size('size', 'Größe', { unit: 'Felder' }), num('stack', 'Stapel', { min: 1 }), VALUE] },
      { title: 'Wirkung', fields: [ref('buff', 'Buff beim Essen/Benutzen', 'buffs'), ref('teaches', 'Bringt Rezept bei', 'recipes', { hint: 'Für Baupläne und Kochbücher' })] },
    ],
    check: (x, report) => { if (x.category === 'blueprint' && !x.teaches) report('warning', 'Bauplan ohne Rezept'); if (x.category === 'food' && !x.buff) report('hint', 'Gericht ohne Buff'); },
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
      { title: 'Payload', fields: [num('length', 'Plätze hintereinander', { min: 0 }), num('stack', 'Stapelhöhe', { min: 1 })] },
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
        ref('buff', 'Buff', 'buffs', { hint: 'z. B. Schlafzimmer oder Chill Area' }), VALUE] },
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
    ],
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
  ['GRUNDLAGEN', ['game', 'splash', 'economy', 'ranking']],
  ['LEYLA', ['leyla', 'backpacks']],
  ['KAMPF', ['weapons', 'enemies', 'buffs']],
  ['BEUTE & CRAFTING', ['items', 'lootTables', 'recipes']],
  ['RIG', ['tractors', 'containers', 'workshops', 'rigParts', 'companions']],
  ['WELT', ['pois', 'rooms', 'locations', 'encounters', 'travel']],
];

export const optionLabel = label;
export const fields = a => AREAS[a].sections.flatMap(s => s.fields);
