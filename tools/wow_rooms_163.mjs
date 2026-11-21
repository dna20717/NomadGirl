#!/usr/bin/env node
// Wow rooms for all 13 POIs (#163 step 8, Bibel › Wow-Moment: „Code baut jeden Wow-Raum ohne neue Grafik vollständig spielbar“).
// Builds the layouts from the eight ingredients: narrow before wide (a low passage or a shaft before the hall), the largest room of
// the POI (≥ 1.5 screens), a key light on the motif (* over it, POIs › Wow › Schlüssellicht), calm first (enemies only in the far
// part), the reward at the motif (a chest within 4 tiles). Two shapes: a wide hall (POIs side by side) and a tall shaft (tower / deep,
// with the hooks A the stack joins through). Writes rooms.json (rooms by id) and the Wow settings of pois.json.
//   node tools/wow_rooms_163.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pretty } from './json.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../projects/nomadgirl/data');
const rd = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const dry = process.argv.includes('--dry');

// a wide hall W × H: passage (4 high) on the left, the hall, open seams at both sides just above the floor
function hall(W, H, o = {}) {
  const t = Array.from({ length: H }, () => Array(W).fill('#'));
  const set = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) t[y][x] = c; };
  const F = H - 2;   // the row Leyla stands in
  for (let y = 1; y <= F; y++) for (let x = 1; x < W - 1; x++) set(x, y, '.');
  const pass = o.pass ?? 7;
  for (let y = 1; y <= F - 4; y++) for (let x = 1; x <= pass; x++) set(x, y, '#');   // narrow before wide
  for (let y = F - 3; y <= F; y++) { set(0, y, '.'); set(W - 1, y, '.'); }
  // galleries: two heights for the arena part (3 up, then 3 more by a ladder), a high point
  const g1 = Math.round(W * 0.52), g2 = Math.round(W * 0.86);
  for (let x = g1; x <= g2; x++) set(x, F - 3, '=');
  const g3a = Math.round(W * 0.7), g3b = W - 3;
  for (let x = g3a; x <= g3b; x++) set(x, F - 7, '=');
  for (let y = F - 7; y <= F - 4; y++) set(g3a + 2, y, 'H');
  set(g3a + 2, F - 7, 'H');
  // a pillar of steps up to the first gallery from the hall floor (1 + 2 rows), so it is no ladder-only climb
  set(g1 - 2, F, '#'); set(g1 - 1, F, '#'); set(g1 - 1, F - 1, '#');
  // lamps under the ceiling, the key light over the motif
  for (let x = pass + 4; x < W - 2; x += 9) set(x, 1, '*');
  for (let x = 2; x <= pass; x += 4) set(x, F - 3, '*');
  const mx = o.motifX ?? Math.round(W * 0.4);
  set(mx, 1, '*');
  // reward at the motif, enemies only in the far part (calm first)
  set(mx + 2, F, 'C');
  for (const x of [Math.round(W * 0.62), Math.round(W * 0.8)]) set(x, F, '1');
  set(Math.round(W * 0.78), F - 4, '1');
  if (o.start) {   // threshold: the van, the shortcut behind a door with its switch (as in the Vorplatz)
    for (let y = F - 3; y <= F; y++) set(0, y, '#');
    for (let y = 1; y <= F - 4; y++) for (let x = 1; x <= pass; x++) set(x, y, '.');
    for (let y = F - 3; y <= F; y++) set(5, y, 'D');
    for (let x = 1; x <= 5; x++) set(x, F - 4, '#');
    set(3, F, 'S'); set(2, H - 1, '^'); set(12, F, 'L');
    for (const x of [Math.round(W * 0.62), Math.round(W * 0.8)]) set(x, F, '.');
    set(Math.round(W * 0.78), F - 4, '.');
    // the forecourt: a narrow canopy over the van (the frame of the first look), then wide open
    for (let x = 7; x <= 16; x++) set(x, F - 5, '#');
  }
  if (o.pool) {   // the empty pool: a basin between two rims (2 rows), its floor at the hall floor, the loungers drawn by the motif
    const a = Math.round(W * 0.5), b = Math.round(W * 0.84);
    for (const x of [a, b]) { set(x, F, '#'); set(x, F - 1, '#'); }
  }
  return t.map(r => r.join(''));
}

// a tall shaft W × H: hook A in the floor (bottom left) and in the ceiling (top right), platforms every 4 rows joined by ladders.
// tower: in from below (floor hook, a low chamber = narrow before wide), out at the top; deep: in from the top through a one-wide
// shaft (narrow before wide), out at the bottom
function shaft(W, H, o = {}) {
  const t = Array.from({ length: H }, () => Array(W).fill('#'));
  const set = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) t[y][x] = c; };
  const F = H - 2, L = 9;
  for (let y = 1; y <= F; y++) for (let x = L; x < W - 1; x++) set(x, y, '.');
  for (let y = F - 3; y <= F; y++) for (let x = 1; x < L; x++) set(x, y, '.');   // the low chamber at the floor hook
  set(4, H - 1, 'A'); set(W - 5, 0, 'A');
  // platforms: rows F-3, F-7 … alternate sides, a ladder up from each level to the next
  const levels = [];
  for (let y = F - 3; y >= (o.deep ? 7 : 3); y -= 4) levels.push(y);
  levels.forEach((y, k) => {
    const left = k % 2 === 0, a = left ? L + 1 : Math.round(W * 0.5), b = left ? Math.round(W * 0.62) : W - 2;
    for (let x = a; x <= b; x++) set(x, y, '=');
    const lx = k === 0 ? L + 2 : Math.round(W * (left ? 0.6 : 0.53));   // the ladder up to this level from the one below (where both overlap)
    const from = k === 0 ? F : levels[k - 1] - 1;
    for (let yy = y; yy <= from; yy++) set(lx, yy, 'H');
  });
  // the top level reaches the ceiling hook (its auto ladder lands on it)
  const top = levels.at(-1);
  for (let x = Math.round(W * 0.5); x <= W - 2; x++) if (t[top][x] === '.') set(x, top, '=');
  if (o.deep) {   // in through the ceiling: a one-wide shaft with a ladder down to the top level, rock around it
    for (let y = 1; y < top - 1; y++) for (let x = W - 9; x <= W - 2; x++) set(x, y, x === W - 5 ? 'H' : '#');
    set(W - 5, top - 1, 'H');
  }
  // lamps, the key light over the motif, the reward at it, enemies away from the way in (calm first)
  const mx = o.motifX ?? Math.round(W * 0.42);
  for (let x = L + 2; x < W - 2; x += 8) if (t[1][x] === '.') set(x, 1, '*');
  for (const y of levels.slice(0, -1)) if (t[y + 1][mx] === '.') { set(mx, y + 1, '*'); break; }
  set(mx + 2, F, 'C');
  const far = o.deep ? levels.slice(0, 2) : levels.slice(-3, -1);   // deep: enemies low (in from the top), tower: high
  far.forEach((y, k) => { const x = k % 2 ? Math.round(W * 0.58) : Math.round(W * 0.4); if (t[y][x] === '=') set(x, y - 1, '1'); });
  if (o.deep) set(Math.round(W * 0.7), F, '1'); else set(Math.round(W * 0.7), levels.at(-1) - 1, '1');
  return t.map(r => r.join(''));
}

// the 13 Wow rooms (Bibel › Wow-Räume je POI)
const WOW = {
  tankstelle_km7: { id: 'km7_preistafel', name: 'Vorplatz mit Preistafel', make: () => hall(48, 20, { start: true, motifX: 32 }), terrain: 'desert', atmosphere: 'wueste_draussen', backdrop: { weather: 'abendglut', shade: 15 }, role: 'outdoor', tags: ['start'],
    wow: { at: 'start', motif: 'priceboard', point: [32, 18], text: '9,99', light: '#f9c22b', particles: 'flicker', stinger: 'neon', moment: 'Die Preistafel springt flackernd an, als Leyla den Vorplatz betritt; Zapfinseln im Sonnenuntergang', wish: 'Preistafel, Tankstellendach' },
    story: ['Großer Vorplatz der Tankstelle mit Preistafel am Highway', 'Der letzte Preis blieb stehen, als der Strom ging', 'Die Tafel springt an, wenn jemand kommt; die Vultures halten Abstand', 'Preistafel mit dem absurden letzten Preis über leeren Zapfsäulen, Abendsonne', 'schild, straße, fass', 'bett, büro'] },
  sunny_acres: { id: 'tp_poolparty', name: 'Trailerpark · Poolparty', make: () => hall(48, 20, { pool: true, motifX: 30 }), terrain: 'desert', atmosphere: 'wueste_draussen', backdrop: { weather: 'abendglut', shade: 15 }, role: 'outdoor', tags: ['combat'],
    wow: { at: 'peak', motif: 'pool', point: [32, 18], light: '#fbff86', particles: 'dust', stinger: 'chord', moment: 'Leerer Pool voller Liegestühle, darin Bewaffnete, Schlager aus dem Radio', wish: 'Pool-Set, Liegestühle' },
    story: ['Der große Pool mit Liegewiese', 'Hier tranken sie das letzte Wasser, gemeinsam und geordnet', 'Sunny Side liegen bewaffnet im leeren Becken', 'Leerer Pool voller Liegestühle, darin Bewaffnete mit Sonnenhut', 'grün, musik, fass', 'büro, militär'] },
  funkmast_km31: { id: 'fm_zettelkabine', name: 'Funkmast · Kabine im Wind', make: () => shaft(34, 28, { motifX: 15 }), terrain: 'metal', atmosphere: 'metall_rost', backdrop: { weather: 'abendglut', shade: 15 }, role: 'tech', tags: ['combat'],
    wow: { at: 'peak', motif: 'cabin', point: [15, 26], light: '#7bd5ff', particles: 'paper', stinger: 'drone', moment: 'Oben auf der Spitze: Wind, die Kabine voller Zettel, Blick über die Salt Flats', wish: 'Kabine, Zettelwand' },
    story: ['Wartungskabine hoch oben im Mast', 'Ein Techniker notierte hier jeden Hilferuf, bis keiner mehr kam', 'Die Saints predigen von hier oben; die Zettel flattern im Wind', 'Die Kabine oben im Wind, Wände voller Zettel, Kopfhörer am Haken', 'technik, kabel, kiste', 'grün, laden'] },
  grossmarkt: { id: 'markt_kuppel', name: 'Markt · Passage unter der Kuppel', make: () => hall(50, 22, { motifX: 26 }), terrain: 'mall', atmosphere: 'markt_neon', role: 'shop', tags: ['combat'],
    wow: { at: 'mid', motif: 'dome', point: [26, 20], text: 'SALE −70 %', light: '#c6eaff', particles: 'dust', stinger: 'swell', moment: 'Passage unter der Glaskuppel, Lichtstrahlen auf die stehende Rolltreppe, Barrikade aus Einkaufswagen', wish: 'Kuppel, Rolltreppe' },
    story: ['Zentrale Passage unter der Glaskuppel', 'Hier stand die Menge beim Ausverkauf, bis der Flügel einstürzte', 'Oben die Wagen-Barrikade der Rats, Licht fällt durch die Kuppel', 'Stillstehende Rolltreppe unter SALE-Bannern, Licht von oben', 'laden, bank, deko', 'wrack, bett'] },
  delta_heights: { id: 'hh_bruchkante', name: 'Hochhaus · Bruchkante', make: () => shaft(36, 28, { motifX: 16 }), terrain: 'concrete', atmosphere: 'ruine_staub', backdrop: { weather: 'abendglut', shade: 15 }, role: 'office', tags: ['combat'],
    wow: { at: 'peak', motif: 'brokenoffice', point: [16, 26], light: '#ffd28a', particles: 'paper', stinger: 'drone', moment: 'Ein halbes Büro über dem Abgrund, Wind, Papier weht hinaus', wish: 'Bruchkante, Stahlträger' },
    story: ['Büroetagen, die im Sandsturm halb wegbrachen', 'Die Seite brach weg; die Schreibtische blieben an der Kante', 'Wind und Papier, die Sky Wolves sichern den Aufstieg', 'Ein halbes Büro hängt über dem Abgrund, Schreibtische an der Bruchkante', 'papier, technik, sitz', 'wrack, reifen'] },
  parkhaus_sued: { id: 'ph_nachtdach', name: 'Parkhaus · Nachtdeck', make: () => shaft(38, 26, { motifX: 18 }), terrain: 'concrete', atmosphere: 'beton_neon', backdrop: { weather: 'abendglut', shade: 15 }, role: 'outdoor', tags: ['combat'],
    wow: { at: 'peak', motif: 'kiosk', point: [18, 24], text: 'KASSE', light: '#ff5ab4', particles: 'flicker', stinger: 'neon', moment: 'Das Dach bei Nacht, Kassenhaus im Neon, dahinter die Skyline der Stadt', wish: 'Kassenhaus, Autowracks' },
    story: ['Oberstes Deck unter freiem Himmel', 'Vom Dach sah man den letzten Shuttle in die Stadt fahren', 'Level Five feiern hier, das Kassenhaus leuchtet', 'Das Kassenhaus im Neon, dahinter die Skyline der Stadt', 'reifen, kiste, müll', 'grün, bett'] },
  metro_line4: { id: 'mt_gittertor', name: 'Metro · Das Gittertor', make: () => shaft(36, 28, { deep: true, motifX: 16 }), terrain: 'concrete', atmosphere: 'tunnel_blau', role: 'corridor', tags: ['combat'],
    wow: { at: 'peak', motif: 'grate', point: [16, 26], text: 'BigCityDelta', light: '#fff6d6', particles: 'dust', stinger: 'swell', moment: 'Der verschweißte Tunnel, durch das Gitter fällt das Licht der Stadt, davor Schlaflager', wish: 'Gittertor, Zug' },
    story: ['Tunnelmund vor dem Delta Ring', 'Die Linie wurde gekappt, das Gitter zugeschweißt', 'Schlaflager davor, Fotos am Gitter', 'Bahnsteig voller Schlaflager vor dem verschweißten Tunnel mit der Aufschrift BigCityDelta', 'sitz, müll, schild', 'grün, wrack'] },
  storm_drain9: { id: 'kn_glanzberg', name: 'Kanal · Der Glanzberg', make: () => shaft(36, 28, { deep: true, motifX: 16 }), terrain: 'concrete', atmosphere: 'tunnel_blau', role: 'hall', tags: ['combat'],
    wow: { at: 'peak', motif: 'nest', point: [16, 26], light: '#f9e17a', particles: 'glitter', stinger: 'bell', moment: 'Das Nest im Sammler: ein Berg aus Glänzendem unter dem Lichtschacht', wish: 'Nest' },
    story: ['Tiefes Sammelbecken unter dem Gully', 'Alles, was hinunterfiel, landete hier', 'Ein Berg aus Glänzendem, bewacht', 'Ein Berg aus Glänzendem unter dem Lichtschacht', 'müll, kiste, putz', 'büro, sitz'] },
  bunker_13: { id: 'bunker_reaktorkern', name: 'Bunker · Reaktorkern', make: () => hall(50, 22, { motifX: 25 }), terrain: 'bunker', atmosphere: 'bunker_reaktor', role: 'tech', tags: ['combat'],
    wow: { at: 'peak', motif: 'reactor', point: [25, 20], light: '#5ef08a', particles: 'steam', stinger: 'drone', moment: 'Die Reaktorhalle: grünes Pulsieren, Dampf, die Gang hält Wache', wish: 'Reaktor' },
    story: ['Reaktorhalle, Herz des Bunkers', 'Als die Lüftung ausfiel, lief der Reaktor weiter', 'Die Rust Guard halten Wache am Kern', 'Der Reaktorblock in grünem Pulsieren, Dampf zwischen den Stegen', 'technik, rohr, gefahr', 'grün, bett'] },
  pit6: { id: 'sm_kristalldom', name: 'Mine · Kristalldom', make: () => shaft(38, 28, { deep: true, motifX: 17 }), terrain: 'cave', atmosphere: 'metall_rost', role: 'cave', tags: ['combat'],
    wow: { at: 'peak', motif: 'crystals', point: [17, 26], light: '#5be6ff', particles: 'glitter', stinger: 'bell', moment: 'Die Kristallgrotte: alles leuchtet von unten', wish: 'Kristalle' },
    story: ['Natürlicher Salzdom unter den Stollen', 'Hier stießen sie auf das Leuchten', 'Unberührt, nur das Leuchten wächst', 'Kristalle, die von unten leuchten', 'stein, licht', 'laden, müll, sitz', 0] },
  ministerium: { id: 'min_uhrensaal', name: 'Ministerium · Uhrensaal', make: () => hall(50, 22, { motifX: 25 }), terrain: 'marble', atmosphere: 'ministerium_saal', role: 'hall', tags: ['combat'],
    wow: { at: 'peak', motif: 'clock', point: [25, 20], light: '#ffe9b0', particles: 'dust', stinger: 'bell', moment: 'Der Festsaal: Kronleuchter, die große Uhr, makellose Ordnung', wish: 'Uhr, Kronleuchter' },
    story: ['Großer Saal mit der Uhr des Amts', 'Die Uhr lief weiter, als das Amt ordnungsgemäß schloss', 'Der Hausmeister zieht sie jeden Tag auf', 'Die große Uhr über schnurgeraden Stuhlreihen', 'deko, sitz, bild', 'müll, wrack'] },
  delta_crude: { id: 'rf_fackelnacht', name: 'Raffinerie · Fackel bei Nacht', make: () => hall(50, 22, { motifX: 25 }), terrain: 'metal', atmosphere: 'metall_rost', backdrop: { weather: 'abendglut', shade: 15 }, role: 'outdoor', tags: ['combat'],
    wow: { at: 'peak', motif: 'flare', point: [25, 20], light: '#ff8a3d', particles: 'sparks', stinger: 'swell', moment: 'Nachts über dem Tankfeld: die Fackel brüllt, Funken regnen', wish: 'Fackelturm' },
    story: ['Fackelturm über dem Tankfeld', 'Die Fackel blieb an, als man die Anlage stehen ließ', 'Die Crude Boys brennen darunter Fusel', 'Die Fackel brennt über dem Tankfeld, Funken regnen', 'fass, kanister, technik', 'bett, büro'] },
  raketensilo: { id: 'rs_raketenblick', name: 'Silo · Die Rakete', make: () => shaft(40, 30, { deep: true, motifX: 18 }), terrain: 'metal', atmosphere: 'bunker_reaktor', role: 'hall', tags: ['combat'],
    wow: { at: 'peak', motif: 'rocket', point: [18, 28], text: '00:00:01', light: '#5ef08a', particles: 'steam', stinger: 'drone', moment: 'Die Rakete im Schacht, an der Startrampe leuchtet 00:00:01', wish: 'Rakete, Startrampe' },
    story: ['Der Raketenschacht in voller Höhe', 'Eine Sekunde vor dem Start: angehalten', 'Zero Hour patrouillieren auf den Bühnen', 'Die Rakete im Schacht, die Anzeige 00:00:01', 'technik, kabel, gefahr', 'grün, laden'] },
};

const R = rd('rooms.json'), P = rd('pois.json');
for (const [poi, w] of Object.entries(WOW)) {
  const layout = w.make(), [fn, moment, today, keyImage, must, never, decay] = w.story;
  R[w.id] = { name: w.name, tags: w.tags, weight: 0, type: 'wow', role: w.role, terrain: w.terrain, atmosphere: w.atmosphere, ...(w.backdrop ? { backdrop: w.backdrop } : {}),
    description: `Wow-Raum (#163): ${w.wow.moment}.`, size: [layout[0].length, layout.length], layout,
    story: { function: fn, moment, today, keyImage, must, never, ...(decay != null ? { decay } : {}) } };
  if (!P[poi].rooms.includes(w.id)) P[poi].rooms.push(w.id);
  P[poi].wow = { room: w.id, ...w.wow, lightStrength: 220, music: 35 };
}
if (dry) { for (const w of Object.values(WOW)) console.log(w.id + '\n' + R[w.id].layout.join('\n')); process.exit(0); }
fs.writeFileSync(path.join(dir, 'rooms.json'), pretty(R) + '\n');
fs.writeFileSync(path.join(dir, 'pois.json'), pretty(P) + '\n');
console.log('Wow-Räume geschrieben:', Object.values(WOW).map(w => w.id).join(', '));
