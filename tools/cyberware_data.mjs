#!/usr/bin/env node
// Cyberware (#006, Daniel, 13.11.2026): writes the 30 implants, their recipes at the Ripperdoc-Liege, the blueprints for the strong ones
// and the loot entries into the game data. Run once again after changing the table below; values in the workshop win afterwards only
// if this script is not run again. Tiers: 1 = simple (scrap grey), 2 = good (chrome), 3 = perk + flaw (black and gold, warning stripes).
//   node tools/cyberware_data.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { pretty } from './json.js';

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const file = f => path.join(repo, 'projects/nomadgirl/data', f);
const read = f => JSON.parse(fs.readFileSync(file(f), 'utf8'));
const dry = process.argv.includes('--dry');

// id, name, place, tier, size, stats, strain, value, description, ingredients, discovery
const IMPLANTS = [
  // eyes
  ['billig_kameraauge', 'Billig-Kameraauge', 'eyes', 1, [1, 1], { ranged: 4 }, 1, 120, 'Ein Kameramodul in einer Plastikkugel. Fokussiert, wenn man es freundlich bittet.', [['chip', 1], ['schrott', 2]], ['start', 'experiment']],
  ['nachtsicht_optik', 'Nachtsicht-Optik', 'eyes', 1, [1, 1], { ranged: 8 }, 2, 260, 'Cyber-Augen mit Restlichtverstärker. Leyla trifft besser, auch im Dunkeln.', [['chip', 1], ['gluehbirne', 1], ['kabelbaum', 1]], ['experiment']],
  ['zielsucher_linse', 'Zielsucher-Linse', 'eyes', 2, [1, 1], { ranged: 12, crit: 5 }, 3, 620, 'Ein Fadenkreuz direkt auf der Netzhaut. Blinzeln zählt als Zielen.', [['chip', 2], ['kabelbaum', 1], ['technik', 2]], ['experiment', 'found']],
  ['kristallauge', 'Kristallauge', 'eyes', 2, [1, 1], { crit: 12, damage: 5 }, 3, 780, 'Geschliffenes Prisma, sieht Schwachstellen als feine Risse im Licht.', [['juwelenchip', 1], ['chip', 1], ['technik', 2]], ['experiment', 'found']],
  ['tunnelblick_optik', 'Tunnelblick-Optik', 'eyes', 3, [1, 1], { ranged: 35, crit: 15, defense: -15 }, 4, 1600, 'Militärware. Was vorn ist, trifft sie immer. Was von der Seite kommt, sieht sie nie.', [['chip', 3], ['juwelenchip', 1], ['technik', 4]], ['found']],
  // nerves
  ['reflex_booster', 'Reflex-Booster', 'nerves', 1, [1, 1], { speed: 5 }, 2, 300, 'Chip am Rückenmark. Alles fühlt sich ein bisschen langsamer an, nur Leyla nicht.', [['chip', 1], ['kupferkabel', 2]], ['experiment']],
  ['dash_synapse', 'Dash-Synapse', 'nerves', 1, [1, 1], { airDash: 1 }, 2, 280, 'Brückt zwei Nerven kurz. Danach kann Leyla in der Luft noch einmal nach vorn schnellen.', [['chip', 1], ['batteriezelle', 1], ['kupferkabel', 1]], ['start', 'experiment']],
  ['kinetik_rueckenmark', 'Kinetik-Rückenmark', 'nerves', 2, [1, 3], { airDash: 1, dashCooldown: -35, speed: 5 }, 4, 900, 'Eine Wirbelsäule aus Chrom mit eigenem Taktgeber. Dashen fühlt sich an wie Atmen.', [['chip', 2], ['zahnraeder', 2], ['kabelbaum', 2], ['technik', 3]], ['experiment', 'found']],
  ['overclock_chip', 'Overclock-Chip', 'nerves', 3, [1, 1], { speed: 25, dashCooldown: -40, regen: -2 }, 4, 1400, 'Läuft heißer, als er dürfte. Leyla auch. Das Leben sickert dabei langsam aus ihr heraus.', [['chip', 3], ['kuehlmittel', 1], ['technik', 4]], ['found']],
  ['berserker_chip', 'Berserker-Chip', 'nerves', 3, [1, 1], { damage: 40, melee: 20, heal: -50 }, 4, 1500, 'Schaltet die Angst ab und gleich ein paar Heilreflexe mit. Medikits wirken nur noch halb.', [['chip', 2], ['bio', 3], ['technik', 3]], ['found']],
  // arm
  ['cyberarm_mk1', 'Cyberarm Mk I', 'arm', 1, [1, 3], { melee: 10 }, 1, 400, 'Leylas eigener Arm, selbst geflickt. Schlägt härter zu als Fleisch.', [['zahnraeder', 2], ['kabelbaum', 1], ['schrottplatte', 1]], ['experiment']],
  ['hydraulik_arm', 'Hydraulik-Arm', 'arm', 2, [1, 3], { melee: 25 }, 3, 820, 'Aus einem Gabelstapler. Riecht noch nach Lagerhalle.', [['kompressor', 1], ['rohrbogen', 2], ['schrottplatte', 2], ['technik', 2]], ['experiment', 'found']],
  ['klingenarm', 'Klingenarm', 'arm', 2, [1, 3], { melee: 20, crit: 10 }, 3, 880, 'Eine Klinge klappt aus dem Unterarm. Leyla übt noch, sie nicht beim Kochen auszufahren.', [['schrottplatte', 2], ['chip', 1], ['zahnraeder', 1], ['technik', 3]], ['experiment', 'found']],
  ['schuetzenarm', 'Schützenarm', 'arm', 2, [1, 3], { ranged: 18 }, 3, 840, 'Kreisel im Handgelenk halten die Waffe still, auch wenn der Rest von Leyla zittert.', [['zahnraeder', 2], ['chip', 1], ['kabelbaum', 1], ['technik', 2]], ['experiment', 'found']],
  ['presslufthammer_arm', 'Presslufthammer-Arm', 'arm', 3, [1, 3], { melee: 60, speed: -15 }, 5, 1800, 'Schlägt Löcher in Wände und Raider. Wiegt so viel, dass Leyla schief läuft.', [['kompressor', 1], ['schrottplatte', 3], ['autobatterie', 1], ['technik', 4]], ['found']],
  // heart
  ['nano_herzklappe', 'Nano-Herzklappe', 'heart', 1, [1, 2], { health: 10 }, 1, 160, 'Eine Klappe aus Kunststoff. Klickt beim Treppensteigen.', [['schrott', 2], ['kupferkabel', 1], ['bio', 1]], ['start', 'experiment']],
  ['blutfilter', 'Blutfilter', 'heart', 1, [1, 2], { regen: 2 }, 2, 240, 'Wäscht das Blut, während Leyla rennt. Langsam, aber gründlich.', [['rohrbogen', 1], ['bio', 1], ['panzertape', 1]], ['experiment']],
  ['herzpumpe', 'Herzpumpe', 'heart', 2, [1, 2], { health: 25 }, 3, 380, 'Zweites Herz aus Titan. Mehr Ausdauer, tickt leise beim Schlafen.', [['zahnraeder', 1], ['batteriezelle', 1], ['bio', 1], ['technik', 2]], ['experiment', 'found']],
  ['biomonitor', 'Biomonitor', 'heart', 2, [1, 2], { heal: 50, health: 10 }, 2, 520, 'Misst alles und dosiert jede Heilung genau dorthin, wo es wehtut.', [['chip', 1], ['bio', 2], ['technik', 2]], ['experiment', 'found']],
  ['reaktor_herz', 'Reaktor-Herz', 'heart', 3, [1, 2], { health: 80, regen: 3, tankDecay: 30 }, 5, 2000, 'Ein Mikroreaktor statt Herz. Zieht seinen Strom über die Leitungen des Rigs, auch aus AvAs Tank.', [['notstrom', 1], ['kuehlmittel', 1], ['bio', 3], ['technik', 5]], ['found']],
  // legs
  ['sprungfedern', 'Sprungfedern', 'legs', 1, [1, 3], { airJumps: 1 }, 2, 260, 'Zwei Spiralfedern statt Waden. Damit springt Leyla in der Luft noch einmal ab.', [['zahnraeder', 1], ['schrott', 3], ['panzertape', 1]], ['start', 'experiment']],
  ['sprintwaden', 'Sprintwaden', 'legs', 1, [1, 3], { speed: 8 }, 2, 240, 'Leichte Waden mit Laufstreifen. Für die Strecke vom Van bis zum Tresor.', [['rohrbogen', 1], ['kupferkabel', 2], ['schrott', 2]], ['experiment']],
  ['federbeine_mk2', 'Federbeine Mk II', 'legs', 2, [1, 3], { airJumps: 1, jump: 15 }, 3, 760, 'Doppelte Federn und kleine Düsen an der Ferse. Der zweite Sprung trägt weiter.', [['zahnraeder', 2], ['batteriezelle', 1], ['schrottplatte', 1], ['technik', 3]], ['experiment', 'found']],
  ['stossdaempfer_beine', 'Stoßdämpfer-Beine', 'legs', 2, [1, 3], { jump: 8, defense: 8 }, 3, 700, 'Kolben in den Knien schlucken Stürze und Tritte gleichermaßen.', [['kompressor', 1], ['rohrbogen', 1], ['technik', 2]], ['experiment', 'found']],
  ['kaenguru_beine', 'Känguru-Beine', 'legs', 3, [1, 3], { airJumps: 2, jump: 25, speed: 10, health: -30 }, 5, 1700, 'Rückwärts geknickte Hochleistungsbeine. Drei Sprünge in der Luft, dafür ziehen sie Blut aus dem Rest.', [['zahnraeder', 3], ['kompressor', 1], ['bio', 2], ['technik', 4]], ['found']],
  // skin
  ['subdermale_platten', 'Subdermale Platten', 'skin', 1, [2, 2], { defense: 6 }, 2, 320, 'Dünne Panzerplatten unter der Haut. Zieht beim Wetterumschwung.', [['schrottplatte', 2], ['panzertape', 1]], ['experiment']],
  ['dermal_netz', 'Dermal-Netz', 'skin', 1, [2, 2], { defense: 4, health: 10 }, 2, 280, 'Ein Wabennetz in der Haut, leuchtet leicht im Dunkeln.', [['kupferkabel', 2], ['stoffreste', 2], ['bio', 1]], ['experiment']],
  ['faserhaut', 'Faserhaut', 'skin', 2, [2, 2], { defense: 12 }, 3, 740, 'Ballistisches Gewebe statt Unterhaut. Kugeln bleiben stecken, Leyla nicht.', [['stoffreste', 3], ['schrottplatte', 1], ['technik', 3]], ['experiment', 'found']],
  ['heilgel_haut', 'Heilgel-Haut', 'skin', 2, [2, 2], { regen: 3, defense: 4 }, 3, 820, 'Ein Gel voller Nanobots schließt kleine Wunden, bevor Leyla sie bemerkt.', [['bio', 3], ['chip', 1], ['technik', 2]], ['experiment', 'found']],
  ['panzerhaut_titan', 'Panzerhaut Titan', 'skin', 3, [2, 2], { defense: 35, speed: -20, jump: -15 }, 5, 1900, 'Titanschuppen von Kopf bis Fuß. Fast nichts kommt durch, auch Leyla kommt kaum noch hoch.', [['schrottplatte', 4], ['kompressor', 1], ['technik', 5]], ['found']],
];
// symbol sheets by size: each item points to its sheet and cell (art from tools/cyberware_icons.py)
const SHEETS = { '1x1': 'icons_cyberware_1x1', '1x2': 'icons_cyberware_1x2', '1x3': 'icons_cyberware_1x3', '2x2': 'icons_cyberware_2x2' };
const TIER_TAG = { 1: 'einfach', 2: 'gut', 3: 'Perk + Flaw' };

const items = read('items.json'), recipes = read('recipes.json'), loot = read('loot.json'), workshops = read('workshops.json');
const cell = {};
for (const [id, name, wear, tier, size, stats, strain, value, description, ingredients, discovery] of IMPLANTS) {
  const key = size.join('x'), icon = (cell[key] = (cell[key] ?? -1) + 1);
  const old = items[id] || {};
  // taking it apart gives back half of the parts (never progress: Technik, Wissen, Bio), so it never pays to build and scrap
  const parts = ingredients.filter(([k]) => !['technik', 'wissen', 'bio'].includes(k));
  let salvage = parts.map(([item, n]) => ({ item, count: Math.floor(n / 2) })).filter(s => s.count > 0);
  if (!salvage.length && parts.length && ingredients.length > 1) salvage = [{ item: parts[0][0], count: 1 }];
  items[id] = { name, look: SHEETS[key], icon, category: 'implant', wear, tier, stats, strain, size, stack: 1, value, description,
    ...(old.tags ? { tags: old.tags } : {}), ...(salvage.length ? { salvageAt: 'werkbank', salvage } : {}) };
  delete items[id].glyph;
  recipes[id] = { name, station: 'ripperdoc', time: [0, 60, 120, 240][tier], ingredients: ingredients.map(([item, count]) => ({ item, count })), result: id, count: 1, discovery,
    hint: `${TIER_TAG[tier]} · ${name}` };
  // the strong ones (and the good ones as a second way) come as blueprints from the loot
  if (discovery.includes('found')) {
    items[`bauplan_${id}`] = { name: `Bauplan: ${name}`, category: 'blueprint', size: [1, 1], stack: 1, value: tier === 3 ? 120 : 45, teaches: id, look: 'icons_gear', icon: 61,
      description: tier === 3 ? 'Schwarzmarkt-Schaltplan, mit Blut statt Tinte unterschrieben. Für die Ripperdoc-Liege.' : 'Ein zerknitterter Schaltplan für die Ripperdoc-Liege.',
      salvageAt: 'warroom', salvage: [{ item: 'wissen', count: tier }] };
  }
}
// Ripperdoc-Liege: a new workshop in the rig where Leyla builds cyberware (#006, Daniel: „Neue Ripperdoc-Liege“)
workshops.ripperdoc = { ...(workshops.ripperdoc || {}), name: 'Ripperdoc-Liege', function: 'cyber', stage: '1', places: 1, power: -2, value: 900,
  description: 'Ein Zahnarztstuhl mit OP-Lampe und Roboterarmen. Hier baut Leyla Cyberware, eingebaut wird im Inventar.', look: 'ws_ripperdoc',
  fx: workshops.ripperdoc?.fx?.length ? workshops.ripperdoc.fx : [
    { kind: 'light', x: 128, y: 64, w: 46, h: 8, color: '#e8fff6', size: 80, rate: 4, when: 'always' },   // OP lamp
    { kind: 'screen', x: 184, y: 89, w: 36, h: 31, color: '#3fe0d0', size: 0, rate: 2, when: 'always' },   // body scan
    { kind: 'screen', x: 178, y: 128, w: 20, h: 6, color: '#3fe0d0', size: 0, rate: 3, when: 'always' },
    { kind: 'screen', x: 170, y: 95, w: 6, h: 18, color: '#5cf28a', size: 0, rate: 1, when: 'always' },
    { kind: 'bubbles', x: 34, y: 128, w: 30, h: 16, color: '#a6fcdb', size: 2, rate: 3, when: 'always' },   // eyes in jars
    { kind: 'blink', x: 197, y: 74, w: 4, h: 4, color: '#ff4a6a', size: 3, rate: 1, when: 'always' },
    { kind: 'sparks', x: 112, y: 100, w: 30, h: 8, color: '#9ff7ff', size: 3, rate: 30, when: 'use', idle: 0 },   // the robot arms at work
    { kind: 'smoke', x: 120, y: 98, w: 10, h: 4, color: '#c2b9cc', size: 6, rate: 2, when: 'use', idle: 0 },
  ] };
// loot: simple ones in early boxes, blueprints of the good ones with raiders, the black-market ones in vaults and with bosses
const put = (table, item, weight, min = 1, max = 1) => {
  const t = loot[table]; if (!t) return;
  t.entries = (t.entries || []).filter(e => e.item !== item);
  t.entries.push({ item, weight, min, max });
};
for (const [id, , , tier, , , , , , , discovery] of IMPLANTS) {
  if (tier === 1) { put('kiste_tankstelle', id, 1); put('pluenderer_beute', id, 1); }
  if (tier === 2 && discovery.includes('found')) { put('pluenderer_beute', `bauplan_${id}`, 1); put('tresor', `bauplan_${id}`, 1); put('drohnen_beute', id, 1); }
  if (tier === 3) { put('tresor', `bauplan_${id}`, 1); put('boss_beute', `bauplan_${id}`, 2); put('boss_beute', id, 1); }
}
if (dry) { console.log(`${IMPLANTS.length} Implantate, ${Object.keys(items).filter(k => k.startsWith('bauplan_') && items[k].teaches in items).length} Baupläne (Probelauf)`); process.exit(0); }
for (const [f, d] of [['items.json', items], ['recipes.json', recipes], ['loot.json', loot], ['workshops.json', workshops]]) fs.writeFileSync(file(f), pretty(d) + '\n');
console.log(`${IMPLANTS.length} Implantate, Rezepte an der Ripperdoc-Liege, Baupläne und Beute geschrieben.`);
