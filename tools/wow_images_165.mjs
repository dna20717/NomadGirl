#!/usr/bin/env node
// #165 Wow-Räume in hoher Fidelity: the painted Wow motifs and landmarks (PixelLab, AAP-64, style of the vault V-09) into Assets and
// POIs › Wow / Level-Design, plus the light of every Wow room (darkness, floor, key light, fill light). Run once; idempotent.
//   node tools/wow_images_165.mjs
import fs from 'node:fs';
import { pretty } from './json.js';
const dir = new URL('../projects/nomadgirl/data/', import.meta.url);
const read = f => JSON.parse(fs.readFileSync(new URL(f, dir)));
const write = (f, v) => fs.writeFileSync(new URL(f, dir), pretty(v) + '\n');
const A = read('assets.json'), P = read('pois.json');
const SRC = 'KI (PixelLab, create_image_pro, AAP-64, Stil: Tresor V-09)', DATE = '2026-11-21';
// id → [file, name, canvas, description]
const art = {
  wow_priceboard: ['wow_priceboard.png', 'Wow · Preistafel Mile 7', '192 × 344', 'Preistafel auf zwei Pfosten mit Sonnen-Logo, Regular/Plus/Diesel in LED-Ziffern, Rost und Aufkleber'],
  wow_dome: ['wow_dome.png', 'Wow · Glaskuppel Megamall', '344 × 192', 'Glaskuppel von innen, Eisenrippen, einzelne Scheiben fehlen, zerrissenes Banner „SALE“; hängt unter der Decke'],
  wow_reactor: ['wow_reactor.png', 'Wow · Reaktorkern Bunker 13', '256 × 320', 'Genieteter Reaktorzylinder mit grünen Ringen und grünem Sichtfenster, Rohre, Warnstreifen'],
  wow_clock: ['wow_clock.png', 'Wow · Große Uhr Ministerium', '256 × 256', 'Uhr im Messing-Marmor-Gehäuse mit Adler der Ordnung, römische Ziffern, ohne Sekundenzeiger (der kommt aus Code)'],
  wow_brokenoffice: ['wow_brokenoffice.png', 'Wow · Bruchkante Delta Heights', '344 × 192', 'Abgebrochene Bürodecke mit Bewehrung, zwei Schreibtische mit Röhrenmonitoren, Papier fliegt hinaus'],
  wow_kiosk: ['wow_kiosk.png', 'Wow · Kassenhaus P+R', '344 × 192', 'Kassenhaus auf dem Dach mit Neon „PAY HERE“, Schranke, Kassenautomat, ausgebranntes Auto'],
  wow_cabin: ['wow_cabin.png', 'Wow · Zettelkabine Funkmast', '256 × 256', 'Funkerkabine auf dem Gittermast, offen, die Wand voller Zettel, Funkgerät, Kopfhörer, Hocker'],
  wow_grate: ['wow_grate.png', 'Wow · Gittertor Metro', '256 × 256', 'Verschweißtes Tunneltor im Bogen, Kette mit Schloss, Licht durch die Ritzen, Schlafsäcke davor, leeres Schild'],
  wow_nest: ['wow_nest.png', 'Wow · Glanzberg-Nest Kanal', '344 × 192', 'Hort aus Radkappen, Dosen, CDs, Münzen, Schmuck und Discokugel auf Zweigen, Lumpen und Kabeln'],
  wow_crystals: ['wow_crystals.png', 'Wow · Kristalle Pit 6', '344 × 192', 'Große leuchtende Cyan-Kristalle auf Fels, kleine Splitter, Grubenlampe'],
  wow_flare: ['wow_flare.png', 'Wow · Fackelturm Delta Crude', '192 × 344', 'Fackelturm aus Stahlgitter mit Leitern und Bühne, Flamme oben, Fässer am Fuß'],
  wow_pool: ['wow_pool.png', 'Wow · Pool-Set Sunny Acres', '344 × 192', 'Rettungsschwimmer-Hochsitz, Stapel Liegestühle, Sonnenschirm, Flamingo-Schwimmring, Poolleiter, Kühlbox, Radio'],
  wow_rocket: ['wow_rocket.png', 'Wow · Rakete Silo Zero', '192 × 344', 'Weiß-rote Rakete am Startturm im Silo, Versorgungsarme, Flammengraben'],
  landmark_watertower: ['landmark_watertower.png', 'Landmarke · Wasserturm mit Lächeln', '192 × 344', 'Wasserturm auf vier Beinen, gelber Tank mit Lächel-Gesicht (Sunny Acres)'],
  landmark_headframe: ['landmark_headframe.png', 'Landmarke · Förderturm Pit 6', '192 × 344', 'Förderturm mit Seilscheibe, Maschinenhaus, Cyan-Leuchten aus dem Schacht'],
  landmark_penthouse: ['landmark_penthouse.png', 'Landmarke · Neon „Penthouse“', '344 × 192', 'Neon-Schrift PENTHOUSE auf Stahlgerüst, einzelne Buchstaben dunkel (Delta Heights)'],
  landmark_board: ['landmark_board.png', 'Landmarke · Anzeigetafel Metro', '344 × 192', 'Hängende Abfahrtstafel mit Bernstein-Zeilen, eine rot „DELAYED“, Uhr daneben (Metro Line 4)'],
};
for (const [id, [file, name, canvas, description]] of Object.entries(art))
  A[id] = { name, kind: 'image', file: `assets/pois/wow/${file}`, source: `${SRC.replace('create_image_pro', `create_image_pro ${canvas}`)}, Ränder beschnitten (Code)`, date: DATE, description: `${description} (#165).` };
// POI → wow image, height (tiles), core / text (px in the trimmed image), hung, light; landmark image
const wow = {
  tankstelle_km7: { image: 'wow_priceboard', imageTiles: 9, imageCore: [69, 66], dark: 0, fill: 0, lightRadius: 700, land: 'wow_priceboard' },
  grossmarkt: { image: 'wow_dome', imageTiles: 8, imageHang: true, imageCore: [166, 90], dark: 10, ambient: 60, fill: 50, lightRadius: 1000, land: 'wow_dome' },
  bunker_13: { image: 'wow_reactor', imageTiles: 10, imageCore: [127, 108], dark: 10, ambient: 65, fill: 45, lightRadius: 950, lightStrength: 260, land: 'wow_reactor' },
  ministerium: { image: 'wow_clock', imageTiles: 9, imageCore: [115, 127], dark: 5, ambient: 60, fill: 50, lightRadius: 950, land: 'wow_clock' },
  delta_heights: { image: 'wow_brokenoffice', imageTiles: 8, imageCore: [240, 70], dark: 10, ambient: 60, fill: 40, lightRadius: 900, land: 'landmark_penthouse' },
  parkhaus_sued: { image: 'wow_kiosk', imageTiles: 6, imageCore: [174, 64], dark: 10, ambient: 60, fill: 45, lightRadius: 900, land: 'wow_kiosk' },
  funkmast_km31: { image: 'wow_cabin', imageTiles: 14, imageCore: [81, 88], dark: 10, ambient: 60, fill: 45, lightRadius: 1000 },
  metro_line4: { image: 'wow_grate', imageTiles: 12, imageCore: [128, 150], imageText: [128, 42], dark: 5, ambient: 65, fill: 50, lightRadius: 1000, land: 'landmark_board' },
  storm_drain9: { image: 'wow_nest', imageTiles: 6, imageCore: [148, 60], dark: 5, ambient: 65, fill: 50, lightRadius: 950, lightStrength: 260 },
  pit6: { image: 'wow_crystals', imageTiles: 9, imageCore: [165, 83], dark: 10, ambient: 65, fill: 45, lightRadius: 1000, lightStrength: 260, land: 'landmark_headframe' },
  delta_crude: { image: 'wow_flare', imageTiles: 18, imageCore: [98, 27], dark: 10, ambient: 60, fill: 40, lightRadius: 1000, land: 'wow_flare' },
  sunny_acres: { image: 'wow_pool', imageTiles: 6, imageCore: [172, 100], dark: 0, fill: 0, lightRadius: 800, land: 'landmark_watertower' },
  raketensilo: { image: 'wow_rocket', imageTiles: 24, imageCore: [140, 200], dark: 5, ambient: 65, fill: 50, lightRadius: 1100, lightStrength: 260, land: 'wow_rocket' },
};
for (const [poi, { land, ...w }] of Object.entries(wow)) {
  const p = P[poi]; if (!p?.wow) throw new Error(`POI ${poi} hat keinen Wow-Raum`);
  Object.assign(p.wow, w);
  if (land) p.level = { ...(p.level || {}), landmarkImage: land };
}
// set-dressing around the motif: a little denser, with the things of the motif first (Raum-Bausteine › Set-Dressing)
const R = read('rooms.json');
const dress = {
  vorplatz: [2.5, 'schild, fass, kanister, wrack'], markt_kuppel: [4, 'laden, kasse, regal, automat, bank'], bunker_reaktorkern: [3.5, 'technik, rohr, gefahr, sandsack'],
  min_uhrensaal: [3.5, 'deko, sitz, bild, bank'], hh_bruchkante: [3.5, 'papier, büro, sitz, technik'], ph_nachtdach: [3, 'reifen, schild, müll, licht'],
  fm_zettelkabine: [3.5, 'technik, kabel, werkzeug'], mt_gittertor: [3.5, 'sitz, müll, schild, licht'], kn_glanzberg: [3.5, 'müll, kiste, putz, licht'],
  sm_kristalldom: [2.5, 'stein, licht, kabel'], rf_fackelnacht: [3, 'fass, kanister, rohr, gefahr'], tp_poolparty: [3, 'musik, grün, fass'], rs_raketenblick: [3.5, 'technik, kabel, gefahr, rohr'],
};
for (const [id, [density, prefer]] of Object.entries(dress)) { if (!R[id]) throw new Error(`Raum ${id} fehlt`); R[id].dressing = { ...(R[id].dressing || {}), density, prefer }; }
write('assets.json', A); write('pois.json', P); write('rooms.json', R);
console.log(`${Object.keys(art).length} Bilder in Assets, ${Object.keys(wow).length} Wow-Räume gesetzt`);
