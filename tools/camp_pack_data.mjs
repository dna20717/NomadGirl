#!/usr/bin/env node
// #008 Camp-Paket (Daniel, 13.11.2026): writes the new camp data once: assets of the PixelLab pictures, the solar panel as a rig part,
// the cistern workshop + fresh water, exterior clutter per workshop, deco around the fire, stairs, string lights, mood.
// Values in the workshop win afterwards; run again only to restore them.   node tools/camp_pack_data.mjs
import fs from 'node:fs';
import { pretty } from './json.js';
const F = f => `projects/nomadgirl/data/${f}.json`, read = f => JSON.parse(fs.readFileSync(F(f), 'utf8')), write = (f, d) => fs.writeFileSync(F(f), pretty(d) + '\n');
const A = read('assets'), W = read('workshops'), R = read('rig_parts'), C = read('camp'), I = read('items'), RC = read('recipes');
const pl = 'KI (PixelLab, Create Image Pro, AAP-64)', date = '13.11.2026';
const img = (id, name, file, description, extra = {}) => { A[id] = { ...(A[id] || {}), name, kind: 'image', file, source: pl, date, description, ...extra }; };
img('rig_stairs', 'Rig · Klapptreppe', 'assets/rig/stairs.png', 'Klapptreppe aus Gitterrost mit Geländer und Warnstreifen: Aufstieg vom Boden in Container im Erdgeschoss (#008). Oben rechts hängt sie am Container.', { origin: [64, 128] });
img('rig_solar', 'Rig · Solarpaneel', 'assets/rig/solar_panel.png', 'Ein Solarpaneel auf einem kleinen Gestell, steht auf dem Container-Dach (#008).', { origin: [64, 58], height: 72 });
img('ws_cistern', 'Werkstatt · Zisterne', 'assets/workshops/cistern.png', 'Regenwasser-Zisterne: IBC-Tank im Käfig, Plane und Trichter oben, Filterfass, Hahn mit Eimer, Wasserstand (#008).', { origin: [128, 236], source: pl + ', Stilbild Drohnenwerkbank v2' });
for (const [id, name, d] of [['rug', 'Teppich', 'Verblasster Orientteppich vor dem Feuer'], ['chair_a', 'Campingstuhl', 'Orangener Klappstuhl mit Decke'], ['chair_b', 'Campingstuhl (bunt)', 'Klappstuhl mit gestreifter Decke'], ['camp_corner', 'Camp-Ecke', 'Kanister, Kühlbox mit Becher, Sukkulente in der Dose']])
  img(`camp_${id}`, `Camp · ${name}`, `assets/camp/deco/${id}.png`, d + ' (#008, Deko ums Feuer).');
const OUT = { kitchen: 'Abluft mit Ofenrohr', sleep: 'Bullauge mit Vorhang und Pflanzen', warroom: 'Satellitenschüssel mit Warnlicht', tank: 'Kälte-Panel mit Schneeflocke', garden: 'Hängende Töpfe', ac: 'Klimagerät', graffiti: 'Katzen-Graffiti', ripper: 'Neon-Kreuz', craft: 'Werkzeugbrett', treasury: 'Tresorrad mit Vorhängeschloss', cistern: 'Regenrinne mit Fass', storage: 'Kisten unterm Frachtnetz' };
for (const [k, n] of Object.entries(OUT)) if (fs.existsSync(`projects/nomadgirl/assets/rig/exterior/${k}.png`)) img(`out_${k}`, `Außenwand · ${n}`, `assets/rig/exterior/${k}.png`, `Clutter an der Container-Außenwand (#008), passend zur Werkstatt dahinter.`);
// exterior clutter per workshop function (Daniel: „passend zu den Werkbänken, die hinter der jeweiligen Wand stehen“)
const BY = { kitchen: 'kitchen', foodtruck: 'kitchen', sleep: 'sleep', guests: 'sleep', warroom: 'warroom', tank: 'tank', cooling: 'tank', garden: 'garden', cyber: 'ripper', craft: 'craft', drone: 'craft', treasury: 'treasury', cistern: 'cistern', storage: 'storage', power: 'ac', engine: 'ac', chill: 'graffiti', cell: 'graffiti' };
// the cistern (Daniel: „Zisterne-Werkbank, an der man Wasser über Zeit sammelt“)
W.zisterne = { ...(W.zisterne || {}), name: 'Zisterne', function: 'cistern', stage: 'mvp', places: 1, power: 0, value: 300, look: 'ws_cistern',
  description: 'Fängt Regen und Tau, filtert durch Kohle und Sand. Füllt sich, während du schläfst, fährst oder plünderst.',
  cistern: { item: 'wasser', perHour: 0.25, max: 8 },
  fx: W.zisterne?.fx || [{ kind: 'screen', x: 184, y: 80, w: 8, h: 26, color: '#20d6c7', size: 0, rate: 1, when: 'always' }, { kind: 'bubbles', x: 150, y: 70, w: 60, h: 40, color: '#a6fcdb', size: 2, rate: 2, when: 'always' }] };
for (const [id, w] of Object.entries(W)) { const k = BY[w.function]; if (k && A[`out_${k}`] && !w.outside) w.outside = `out_${k}`; }
// fresh water: the cistern's harvest, a drink and an ingredient
I.wasser = { ...(I.wasser || {}), name: 'Frischwasser', look: 'icons_gear', icon: 54, category: 'ingredient', size: [1, 1], stack: 5, value: 4, buff: 'erste_hilfe',
  description: 'Gefiltertes Regenwasser in der Feldflasche. Schmeckt nach Blech, ist aber sauber.' };
RC.neon_ramen = { ...RC.neon_ramen, ingredients: [...RC.neon_ramen.ingredients.filter(i => i.item !== 'wasser'), { item: 'wasser', count: 1 }] };
// the solar panel: a rig part on the container roofs
R.solarpaneel = { ...(R.solarpaneel || {}), name: 'Solarpaneel', slot: 'solar', look: 'rig_solar', size: [2, 1], value: 220, weight: 40, pull: 0, armor: 0, damage: 0, fuelUse: 0,
  description: 'Liefert tagsüber Strom und lädt den Akku für die Nacht. Gehört aufs Container-Dach.' };
// camp: deco, stairs, string lights, mood, solar
C.deco = C.deco?.length ? C.deco : [{ look: 'camp_rug', x: -10, y: 4, scale: 2.2 }, { look: 'camp_chair_a', x: -170, y: 0, scale: 2.4 }, { look: 'camp_chair_b', x: 170, y: 0, scale: 2.4, flip: true }, { look: 'camp_camp_corner', x: 330, y: 0, scale: 2.2 }];
C.stairs = { ...(C.stairs || {}), look: 'rig_stairs' };
C.lights = { enabled: true, max: 12, sag: 18, spacing: 34, colors: '#ffd541, #e86a73, #20d6c7, #9cdb43', price: 25, ...(C.lights || {}) };
C.mood = { vignette: 35, warm: 30, fireflies: 18, smoke: true, ...(C.mood || {}) };
C.solar = { look: 'rig_solar', power: 1, battery: 6, day: [7, 19], price: 220, weight: 40, ...(C.solar || {}) };
C.rig = { ...(C.rig || {}), outsideScale: C.rig?.outsideScale ?? 2 };
for (const [f, d] of [['assets', A], ['workshops', W], ['rig_parts', R], ['camp', C], ['items', I], ['recipes', RC]]) write(f, d);
console.log('Camp-Paket geschrieben:', Object.keys(OUT).filter(k => A[`out_${k}`]).length, 'Außenwände,', Object.values(W).filter(w => w.outside).length, 'Werkstätten mit Außenwand');
