#!/usr/bin/env node
// #169 G3 Leben: writes data/life.json from the defaults in engine/ecosystem.js (once; run again to reset). Lines of history.json for
// the new time layers (by.moved, by.gone, by.nest, by.settle) are added if missing.
import fs from 'node:fs';
import { LIFE } from '../engine/ecosystem.js';
import { pretty } from './json.js';

const dir = new URL('../projects/nomadgirl/data/', import.meta.url);
const NOTES = {
  'Gang-Lager': 'Feuerstelle, Schlafsäcke, Vorräte: hier wohnen sie',
  Spähtrupp: 'Rivalen auf Erkundung, bleiben ein paar Tage',
  Nest: 'Mutanten, wachsen und teilen sich',
  'Plünderer-Lager': 'ohne Gang, wenn niemand den Ort hält',
};
const life = { enabled: true, nestEnemy: 'kriecher', relations: LIFE.relations.map(r => ({ ...r })), campTypes: LIFE.campTypes.map(c => ({ ...c, note: NOTES[c.name] })), sim: { ...LIFE.sim }, director: { ...LIFE.director }, lines: LIFE.lines.map(l => ({ ...l })) };
for (const c of life.campTypes) delete c.note;
fs.writeFileSync(new URL('life.json', dir), pretty(life) + '\n');

const hist = JSON.parse(fs.readFileSync(new URL('history.json', dir), 'utf8'));
const add = { 'by.moved': 'Tag {day}: {name} schlugen ihr Lager woanders auf. Die alte Feuerstelle ist kalt.|Tag {day}: {name} zogen ein Stockwerk weiter, nachdem jemand bei ihnen aufgeräumt hatte.',
  'by.gone': 'Tag {day}: von {name} blieb nur ein Haufen kalter Asche.|Tag {day}: {name} gaben den Ort auf.',
  'by.nest': 'Tag {day}: in den dunklen Ecken wuchs etwas, das sammelt.|Tag {day}: das Nest teilte sich.',
  'by.settle': 'Tag {day}: {name} richteten sich neu ein, mit frischer Feuerstelle.|Tag {day}: nach ein paar stillen Tagen kamen {name}.' };
hist.grammar ??= [];
for (const [symbol, text] of Object.entries(add)) if (!hist.grammar.some(g => g.symbol === symbol)) hist.grammar.push({ symbol, text });
fs.writeFileSync(new URL('history.json', dir), pretty(hist) + '\n');
console.log('life.json + history.json (Grammatik by.moved/gone/nest/settle)');
