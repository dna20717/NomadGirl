// Scaffold of the example data for projects/nomadgirl (placeholder values by feel).
// Writes only files that do not exist yet; --force overwrites everything.
// node tools/scaffolds/nomadgirl_example.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pretty } from '../json.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../projects/nomadgirl');
const force = process.argv.includes('--force');

const FILES = {
  'project.json': { id: 'nomadgirl', name: 'NomadGirl', genre: 'roguelite', data: {} },

  'data/game.json': {
    title: 'NomadGirl', tileSize: 32, gravity: 1800, resolution: [640, 360], pixelArt: true,
    start: { location: 'tankstelle_km7', tractor: 'pickup', containers: ['wohnanhaenger'], workshops: ['schlafkoje', 'kochnische', 'werkbank'], companions: [], fuel: 40, food: 6 },
  },
  'data/economy.json': {
    currency: { name: 'Deltas', symbol: 'Δ', description: 'Offizielle Stadtwährung von BigCityDelta. Außerhalb der Mauern halb wertlos, aber immer noch besser als Kronkorken.' },
    startDeltas: 50,
    rescue: { drone: 'Mama-Bot', losesRunLoot: true, losesEquipped: false, keepPercent: 0, description: 'Mama-Bot sammelt Leyla ein, fliegt sie zum Rig und kommentiert das ausführlich.' },
    foodtruck: { priceFactor: 1.5, maxPerStop: 8 },
  },
  'data/ranking.json': {
    points: { time: 40, kills: 30, secrets: 30 }, timeFalloff: 5,
    grades: [
      { grade: 'F', minPoints: 0, bonus: 0 }, { grade: 'D', minPoints: 30, bonus: 10 }, { grade: 'C', minPoints: 50, bonus: 25 },
      { grade: 'B', minPoints: 70, bonus: 50 }, { grade: 'A', minPoints: 85, bonus: 75 }, { grade: 'S', minPoints: 98, bonus: 100 },
    ],
  },

  'data/leyla.json': {
    name: 'Leyla', health: 100, invulnerableAfterHit: 600,
    description: 'Schrottsammlerin aus den Wastelands rund um BigCityDelta. Wohnt im Rig, plündert, was andere liegen lassen, und kocht erstaunlich gut.',
    movement: { walkSpeed: 120, runSpeed: 220, acceleration: 1400, jumpVelocity: 560, airJumps: 1, coyoteTime: 100, jumpBuffer: 120, dashDistance: 140, dashCooldown: 600, dashInvulnerable: true, slideSpeed: 300, slideDuration: 350, climbSpeed: 90, swingRope: 160, swingBoost: 20 },
    loadout: { melee: 'rohrzange', ranged: 'nagelpistole', backpack: 'schulranzen' },
    sprites: { idle: 'leyla_idle' },
  },
  'data/backpacks.json': {
    schulranzen: { name: 'Schulranzen', size: [4, 3], tier: 1, value: 10, description: 'Pink, mit Glitzer. Aus einer Grundschule in Sektor 4.' },
    wanderrucksack: { name: 'Wanderrucksack', size: [6, 4], tier: 2, value: 80, description: 'Riecht nach Abenteuer und ein bisschen nach Schimmel.' },
    militaerrucksack: { name: 'Militärrucksack', size: [8, 5], tier: 3, value: 250, description: 'Mit Namensschild „Gefr. Kowalski“. Er braucht ihn nicht mehr.' },
  },

  'data/weapons.json': {
    rohrzange: { name: 'Rohrzange', kind: 'melee', tier: 1, damage: 12, cooldown: 380, range: 36, knockback: 120, size: [1, 2], value: 8, description: 'Repariert Leitungen und Meinungen.' },
    machete: { name: 'Machete', kind: 'melee', tier: 2, damage: 18, cooldown: 450, range: 44, knockback: 80, critChance: 10, size: [1, 3], value: 40 },
    schockstab: { name: 'Schockstab', kind: 'melee', tier: 2, damage: 10, cooldown: 500, range: 40, knockback: 200, critChance: 5, size: [1, 2], value: 60, description: 'Ehemals Viehtreiber. Funktioniert auch bei Mutanten.' },
    nagelpistole: { name: 'Nagelpistole', kind: 'ranged', tier: 1, damage: 6, cooldown: 250, range: 320, knockback: 40, ammo: 40, size: [2, 1], value: 15 },
    schrotflinte: { name: 'Schrotflinte', kind: 'ranged', tier: 2, damage: 22, cooldown: 900, range: 180, knockback: 260, ammo: 12, size: [3, 1], value: 90 },
    bastlerdeck: { name: 'Bastler-Deck', kind: 'cyberdeck', tier: 1, damage: 0, cooldown: 3000, range: 200, size: [2, 2], value: 120, description: 'Hacking kommt später. Bis dahin ein sehr teurer Briefbeschwerer.' },
  },
  'data/enemies.json': {
    kriecher: { name: 'Kriecher', family: 'mutant', behavior: 'patrol', health: 25, damage: 8, speed: 70, aggroRange: 180, loot: 'mutanten_beute', deltas: [0, 2], countsForRanking: true, description: 'Schlurft, stöhnt, beißt.' },
    schleimbeisser: { name: 'Schleimbeißer', family: 'mutant', behavior: 'ambusher', health: 35, damage: 14, speed: 160, aggroRange: 90, loot: 'mutanten_beute', deltas: [1, 3], countsForRanking: true, description: 'Hängt an der Decke und wartet.' },
    rattenschwarm: { name: 'Rattenschwarm', family: 'wildlife', behavior: 'charger', health: 15, damage: 4, speed: 200, aggroRange: 220, deltas: [0, 1], countsForRanking: true },
    schlaeger: { name: 'Plünderer-Schläger', family: 'raider', behavior: 'charger', health: 45, damage: 12, speed: 140, aggroRange: 260, weapon: 'machete', loot: 'pluenderer_beute', deltas: [3, 8], countsForRanking: true },
    schuetze: { name: 'Plünderer-Schütze', family: 'raider', behavior: 'shooter', health: 30, damage: 8, speed: 100, aggroRange: 340, weapon: 'nagelpistole', loot: 'pluenderer_beute', deltas: [3, 8], countsForRanking: true },
    wachdrohne: { name: 'Wachdrohne', family: 'machine', behavior: 'flyer', health: 20, damage: 6, speed: 150, aggroRange: 300, loot: 'drohnen_beute', deltas: [2, 5], countsForRanking: true, description: 'Fragt höflich nach dem Ausweis. Schießt dann.' },
    hausmeister: { name: 'Der Hausmeister', family: 'anomaly', behavior: 'boss', health: 600, damage: 25, speed: 90, aggroRange: 500, loot: 'boss_beute', deltas: [80, 120], countsForRanking: true, description: 'Hat das Ministerium nie verlassen. Hat auch nicht vor, es zu tun.' },
  },
  'data/buffs.json': {
    satt: { name: 'Satt', stat: 'health', value: 20, duration: 'run', description: 'Mehr Leben für den nächsten Run.' },
    feurig: { name: 'Feurig', stat: 'damage', value: 15, percent: true, duration: 'run' },
    flink: { name: 'Flink', stat: 'speed', value: 10, percent: true, duration: 'run' },
    ausgeschlafen: { name: 'Ausgeschlafen', stat: 'defense', value: 10, percent: true, duration: 'run' },
    gemuetlich: { name: 'Gemütlich', stat: 'luck', value: 5, percent: true, duration: 'run', description: 'Wer entspannt ist, findet mehr.' },
    erste_hilfe: { name: 'Erste Hilfe', stat: 'health', value: 30, duration: 'instant' },
  },

  'data/items.json': {
    kupferkabel: { name: 'Kupferkabel', category: 'junk', size: [1, 1], stack: 10, value: 2 },
    alte_platine: { name: 'Alte Platine', category: 'junk', size: [1, 1], stack: 5, value: 3 },
    gluehbirne: { name: 'Glühbirne', category: 'junk', size: [1, 1], stack: 5, value: 1, description: 'Heil. Ein kleines Wunder.' },
    kronkorken: { name: 'Kronkorken', category: 'junk', size: [1, 1], stack: 99, value: 0, description: 'Hier nichts wert. Leyla sammelt sie trotzdem.' },
    schrott: { name: 'Schrott', category: 'resource', size: [1, 1], stack: 20, value: 1 },
    stoffreste: { name: 'Stoffreste', category: 'resource', size: [1, 1], stack: 10, value: 1 },
    batteriezelle: { name: 'Batteriezelle', category: 'resource', size: [1, 1], stack: 10, value: 6 },
    mutantenfleisch: { name: 'Mutantenfleisch', category: 'ingredient', size: [1, 1], stack: 5, value: 2, description: 'Besser nicht fragen.' },
    reis: { name: 'Reis', category: 'ingredient', size: [1, 1], stack: 10, value: 2 },
    gewuerzmischung: { name: 'Gewürzmischung', category: 'ingredient', size: [1, 1], stack: 10, value: 4 },
    dosenbohnen: { name: 'Dosenbohnen', category: 'ingredient', size: [1, 1], stack: 6, value: 2 },
    mutanten_curry: { name: 'Mutanten-Curry', category: 'food', size: [1, 1], stack: 3, value: 12, buff: 'feurig', description: 'Scharf genug, um Erinnerungen zu löschen.' },
    bohneneintopf: { name: 'Bohneneintopf', category: 'food', size: [1, 1], stack: 3, value: 6, buff: 'satt' },
    schrottplatte: { name: 'Schrottplatte', category: 'component', size: [2, 2], stack: 4, value: 8 },
    kabelbaum: { name: 'Kabelbaum', category: 'component', size: [1, 2], stack: 4, value: 10 },
    verband: { name: 'Verband', category: 'consumable', size: [1, 1], stack: 5, value: 5, buff: 'erste_hilfe' },
    discokugel: { name: 'Discokugel', category: 'valuable', size: [2, 2], stack: 1, value: 45, description: 'Niemand weiß, warum das funktioniert. Sammler zahlen gut.' },
    zettel_curry: { name: 'Fettiger Notizzettel', category: 'blueprint', size: [1, 1], stack: 1, value: 1, teaches: 'mutanten_curry', description: '„Mehr Gewürz. Immer mehr Gewürz.“' },
  },
  'data/loot.json': {
    kiste_tankstelle: { name: 'Kiste (Tankstelle)', rolls: [1, 3], entries: [
      { item: 'kupferkabel', weight: 5, min: 1, max: 3 }, { item: 'gluehbirne', weight: 2, min: 1, max: 1 }, { item: 'dosenbohnen', weight: 4, min: 1, max: 2 },
      { item: 'kronkorken', weight: 6, min: 2, max: 8 }, { item: 'batteriezelle', weight: 1, min: 1, max: 1 }, { item: 'zettel_curry', weight: 1, min: 1, max: 1 }] },
    mutanten_beute: { name: 'Mutanten-Beute', rolls: [0, 1], entries: [{ item: 'mutantenfleisch', weight: 6, min: 1, max: 1 }, { item: 'stoffreste', weight: 2, min: 1, max: 2 }] },
    pluenderer_beute: { name: 'Plünderer-Beute', rolls: [1, 2], entries: [{ item: 'schrott', weight: 4, min: 1, max: 3 }, { item: 'verband', weight: 2, min: 1, max: 1 }, { item: 'reis', weight: 2, min: 1, max: 2 }, { item: 'gewuerzmischung', weight: 1, min: 1, max: 1 }] },
    drohnen_beute: { name: 'Drohnen-Beute', rolls: [1, 1], entries: [{ item: 'alte_platine', weight: 3, min: 1, max: 1 }, { item: 'batteriezelle', weight: 2, min: 1, max: 1 }, { item: 'kupferkabel', weight: 3, min: 1, max: 2 }] },
    boss_beute: { name: 'Boss-Beute', rolls: [3, 4], entries: [{ item: 'discokugel', weight: 1, min: 1, max: 1 }, { item: 'batteriezelle', weight: 3, min: 2, max: 4 }, { item: 'kabelbaum', weight: 2, min: 1, max: 2 }] },
  },
  'data/recipes.json': {
    mutanten_curry: { name: 'Mutanten-Curry', station: 'kochnische', time: 30, ingredients: [{ item: 'mutantenfleisch', count: 1 }, { item: 'reis', count: 1 }, { item: 'gewuerzmischung', count: 1 }], result: 'mutanten_curry', count: 2, discovery: ['found', 'companion', 'experiment'], hint: 'Fleisch, Reis und etwas, das brennt.' },
    bohneneintopf: { name: 'Bohneneintopf', station: 'kochnische', time: 15, ingredients: [{ item: 'dosenbohnen', count: 2 }], result: 'bohneneintopf', count: 1, discovery: ['start'] },
    schrottplatte: { name: 'Schrottplatte', station: 'werkbank', time: 20, ingredients: [{ item: 'schrott', count: 3 }], result: 'schrottplatte', count: 1, discovery: ['start'] },
    kabelbaum: { name: 'Kabelbaum', station: 'werkbank', time: 25, ingredients: [{ item: 'kupferkabel', count: 3 }, { item: 'alte_platine', count: 1 }], result: 'kabelbaum', count: 1, discovery: ['experiment', 'companion'] },
    verband: { name: 'Verband', station: 'werkbank', time: 10, ingredients: [{ item: 'stoffreste', count: 2 }], result: 'verband', count: 1, discovery: ['start'] },
    discokugel: { name: 'Discokugel', station: 'werkbank', time: 60, ingredients: [{ item: 'gluehbirne', count: 1 }, { item: 'kronkorken', count: 30 }, { item: 'batteriezelle', count: 1 }], result: 'discokugel', count: 1, discovery: ['experiment'], hint: 'Viel zu viele Kronkorken und eine sehr optimistische Glühbirne.' },
  },

  'data/tractors.json': {
    pickup: { name: 'Pickup', pull: 1500, fuelUse: 12, tank: 60, power: 2, length: 1, stack: 1, slots: { engine: 1, armor: 1, weapon: 0 }, value: 400, description: 'Rostig, laut, treu.' },
    lkw: { name: 'LKW', pull: 12000, fuelUse: 30, tank: 300, power: 4, length: 3, stack: 2, slots: { engine: 1, armor: 2, weapon: 2 }, value: 6000, description: 'Ein echtes Rig. Endlich.' },
  },
  'data/containers.json': {
    wohnanhaenger: { name: 'Wohnanhänger', kind: 'trailer', places: 3, weight: 900, value: 300, description: 'Leylas erstes Zuhause. Klein, aber mit Gardinen.' },
    holzkiste: { name: 'Holzkiste', kind: 'crate', places: 1, weight: 250, stackable: true, value: 60 },
    container_20: { name: '20-Fuß-Container', kind: 'shipping', places: 2, weight: 2300, stackable: true, value: 900 },
    container_40: { name: '40-Fuß-Container', kind: 'shipping', places: 3, weight: 3800, stackable: true, value: 1500 },
  },
  'data/workshops.json': {
    schlafkoje: { name: 'Schlafkoje', function: 'sleep', stage: 'mvp', places: 1, power: 0, capacity: 1, buff: 'ausgeschlafen', value: 50 },
    kochnische: { name: 'Kochnische', function: 'kitchen', stage: 'mvp', places: 1, power: -1, value: 80, description: 'Zwei Platten, eine davon geht.' },
    werkbank: { name: 'Werkbank', function: 'craft', stage: 'mvp', places: 1, power: -1, value: 80 },
    generator: { name: 'Generator', function: 'power', stage: '1', places: 1, power: 3, value: 200 },
    waffenkammer: { name: 'Waffenkammer', function: 'storage', stage: '1', places: 1, power: 0, capacity: 12, value: 150 },
    kuehlraum: { name: 'Kühlraum', function: 'cooling', stage: '1', places: 1, power: -2, capacity: 20, value: 250 },
    chill_area: { name: 'Chill Area', function: 'chill', stage: '1', places: 1, power: 0, buff: 'gemuetlich', value: 120, description: 'Sofa, Lichterkette, Plattenspieler.' },
    drohnenwerkstatt: { name: 'Drohnenwerkstatt', function: 'drone', stage: '1', places: 1, power: -2, value: 400, description: 'Hier wird Mama-Bot verbessert. Sie hat Meinungen dazu.' },
    warroom: { name: 'Warroom', function: 'warroom', stage: '1', places: 1, power: -1, value: 300 },
    kueche: { name: 'Küche', function: 'kitchen', stage: '1', places: 2, power: -2, value: 500 },
    foodtruck: { name: 'Foodtruck', function: 'foodtruck', stage: '1', places: 2, power: -1, value: 700, description: 'Jaaa, wirklich.' },
    motorraum: { name: 'Motorraum', function: 'engine', stage: '1', places: 1, power: 0, value: 300 },
    zelle: { name: 'Zelle', function: 'cell', stage: '2', places: 1, power: 0, capacity: 1, value: 200 },
    reaktor: { name: 'Reaktor', function: 'power', stage: '2', places: 2, power: 8, value: 3000 },
  },
  'data/rig_parts.json': {
    v8: { name: 'V8-Motor', slot: 'engine', pull: 1500, fuelUse: 4, value: 900 },
    bleche: { name: 'Angeschweißte Bleche', slot: 'armor', armor: 20, value: 150 },
    stachelgitter: { name: 'Stachelgitter', slot: 'armor', armor: 10, damage: 5, value: 200 },
    dachgeschuetz: { name: 'Dachgeschütz', slot: 'weapon', damage: 30, value: 1200 },
  },
  'data/companions.json': {
    schraube: { name: 'Schraube', role: 'Mechanikerin', stage: '1', workshops: ['werkbank', 'motorraum', 'drohnenwerkstatt'], buffs: [], tips: ['kabelbaum', 'schrottplatte'], description: 'Redet mit Motoren. Die Motoren hören zu.' },
    onkel_sung: { name: 'Onkel Sung', role: 'Koch', stage: '1', workshops: ['kochnische', 'kueche', 'foodtruck'], buffs: ['feurig'], tips: ['mutanten_curry'], description: 'Hat früher in BigCityDelta gekocht. Für wen, sagt er nicht.' },
  },

  'data/pois.json': {
    tankstelle_km7: { name: 'Tankstelle Kilometer 7', kind: 'gasStation', size: 'S', danger: 1, roomCount: [3, 4], rooms: ['vorplatz', 'verkaufsraum', 'lager', 'werkstatthalle'], enemies: ['kriecher', 'rattenschwarm'], loot: 'kiste_tankstelle', parTime: 90, secrets: 1, npcs: true, foodtruck: true, shop: true, description: 'Die letzte Tankstelle vor der Salzebene. Der Kaffee ist furchtbar.' },
    grossmarkt: { name: 'Großmarkt Delta-Süd', kind: 'mall', size: 'M', danger: 2, roomCount: [5, 7], rooms: ['eingangshalle', 'gang', 'verkaufsraum', 'lager', 'treppenhaus', 'werkstatthalle'], enemies: ['kriecher', 'schleimbeisser', 'schlaeger'], loot: 'kiste_tankstelle', parTime: 180, secrets: 2 },
    bunker_13: { name: 'Bunker 13', kind: 'bunker', size: 'L', danger: 4, roomCount: [8, 11], rooms: ['eingangshalle', 'gang', 'treppenhaus', 'tresorraum', 'kontrollraum'], enemies: ['wachdrohne', 'schuetze', 'schlaeger'], loot: 'pluenderer_beute', parTime: 300, secrets: 3 },
    ministerium: { name: 'Ministerium für Ordnung', kind: 'government', size: 'XL', danger: 5, roomCount: [12, 16], rooms: ['eingangshalle', 'gang', 'treppenhaus', 'tresorraum', 'kontrollraum'], enemies: ['wachdrohne', 'schuetze', 'schleimbeisser', 'hausmeister'], loot: 'boss_beute', parTime: 600, secrets: 5, description: 'Riesig, verlassen, tadellos sauber.' },
  },
  'data/rooms.json': {
    vorplatz: { name: 'Vorplatz', size: [40, 17], tags: ['start'], weight: 1 },
    eingangshalle: { name: 'Eingangshalle', size: [30, 17], tags: ['start', 'npc'], weight: 1 },
    verkaufsraum: { name: 'Verkaufsraum', size: [30, 17], tags: ['combat', 'loot'], weight: 3 },
    lager: { name: 'Lager', size: [20, 17], tags: ['loot', 'secret'], weight: 2 },
    werkstatthalle: { name: 'Werkstatthalle', size: [36, 20], tags: ['combat', 'exit'], weight: 1 },
    gang: { name: 'Gang', size: [24, 10], tags: ['corridor', 'combat'], weight: 4 },
    treppenhaus: { name: 'Treppenhaus', size: [14, 34], tags: ['corridor'], weight: 2 },
    tresorraum: { name: 'Tresorraum', size: [18, 12], tags: ['loot', 'secret'], weight: 1 },
    kontrollraum: { name: 'Kontrollraum', size: [40, 22], tags: ['boss', 'exit'], weight: 1 },
  },
  'data/locations.json': {
    tankstelle_km7: { name: 'Tankstelle Kilometer 7', poi: 'tankstelle_km7', position: [12, 8], region: 'Ödland Süd' },
    grossmarkt: { name: 'Großmarkt Delta-Süd', poi: 'grossmarkt', position: [30, 14], region: 'Vorstadt' },
    bunker_13: { name: 'Bunker 13', poi: 'bunker_13', position: [-20, 35], region: 'Salzebene' },
    ministerium: { name: 'Ministerium für Ordnung', poi: 'ministerium', position: [50, 2], region: 'Delta-Ring' },
  },
  'data/encounters.json': {
    strassensperre: { name: 'Straßensperre', weight: 3, time: 'any', enemies: ['schlaeger', 'schuetze'], loot: 'pluenderer_beute', description: 'Wegzoll. Oder auch nicht.' },
    ghulrudel: { name: 'Ghul-Rudel', weight: 2, time: 'night', enemies: ['kriecher', 'schleimbeisser'], loot: 'mutanten_beute' },
    liegengebliebener_lkw: { name: 'Liegengebliebener LKW', weight: 1, time: 'day', enemies: [], loot: 'kiste_tankstelle', description: 'Niemand da. Verdächtig.' },
  },
  'data/sprites.json': {
    leyla_idle: { name: 'Leyla · Stehen', file: 'assets/leyla/idle.png', frameSize: [176, 432], frames: 8, fps: 6.5, loop: true, origin: [88, 428], height: 64,
      source: 'KI-generiert (Daniel, 07.11.2026)', description: 'Idle-Animation, atmet ruhig. Original: art/leyla/idle_source.gif (8 Frames à 150 ms).' },
  },
  'data/travel.json': { speed: 40, foodPerDay: 1, weightFuelFactor: 8, dayLength: 24, nightShare: 40, nightDanger: 50, encounterChance: 15 },
};

for (const [file, content] of Object.entries(FILES)) {
  const full = path.join(root, file);
  if (fs.existsSync(full) && !force) { console.log('bleibt   ' + file); continue; }
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, pretty(content) + '\n');
  console.log('schreibt ' + file);
}
