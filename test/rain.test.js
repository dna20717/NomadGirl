// Regen und Wasser (#014): rain in the camp rolled from day and save, the cistern fills faster in the rain, water no longer heals,
// new recipes with water, watering the hydroponics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave } from '../game/save.js';
import { rainOn, rainingAt, rainHours } from '../game/rain.js';
import { level } from '../game/cistern.js';
import { bed, stage, canWater, water } from '../game/garden.js';
import { give, have } from '../game/crafting.js';
import { clockHours } from '../game/tank.js';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;

test('Regen: gewürfelt aus Tag und Spielstand, gleich bei gleichem Spielstand, ungefähr so oft wie eingestellt', () => {
  const s = newSave(D);
  let days = 0;
  for (let d = 1; d <= 400; d++) { const w = rainOn(D, s, d); if (w) { days++; assert.ok(w.to - w.from >= D.camp.rain.hours[0] && w.to - w.from <= D.camp.rain.hours[1]); assert.ok(rainingAt(D, s, w.from)); } }
  assert.ok(days > 400 * D.camp.rain.chance / 100 * 0.6 && days < 400 * D.camp.rain.chance / 100 * 1.4, `${days} Regentage`);
  assert.deepEqual(rainOn(D, s, 17), rainOn(D, structuredClone(s), 17));
  const off = { ...D, camp: { ...D.camp, rain: { ...D.camp.rain, enabled: false } } };
  assert.equal(rainHours(off, s, 0, 24 * 100), 0);
});

test('Zisterne: bei Regen „Bei Regen“-mal schneller, ohne Regen wie bisher', () => {
  const s = newSave(D), ws = 'zisterne', C = D.workshops[ws].cistern;
  let day = 1, w = null;
  while (!(w = rainOn(D, s, day)) || w.to - w.from < 2 || w.to % 24 < w.from % 24) day++;
  s.day = day; s.hour = w.from % 24;
  level(D, s, ws, 'a');
  s.hour = w.from % 24 + 2;
  assert.ok(Math.abs(level(D, s, ws, 'a').water - Math.min(C.max, 2 * C.perHour * C.rain)) < 1e-9, 'zwei Stunden Regen');
  const dry = { ...D, camp: { ...D.camp, rain: { enabled: false } } }, t = newSave(D);
  t.day = 1; t.hour = 8; level(dry, t, ws, 'b'); t.hour = 12;
  assert.ok(Math.abs(level(dry, t, ws, 'b').water - 4 * C.perHour) < 1e-9, 'vier trockene Stunden');
});

test('Frischwasser heilt nicht mehr, ist aber Zutat für mehrere Rezepte', () => {
  assert.equal(D.items.wasser.buff, undefined);
  const uses = Object.values(D.recipes).filter(r => r.ingredients?.some(i => i.item === 'wasser'));
  assert.ok(uses.length >= 4, uses.map(r => r.name).join(', '));
});

test('Hydrokultur gießen: eine Flasche, alles wächst weiter, dann erst wieder nach ein paar Stunden', () => {
  const s = newSave(D), ws = 'hydrokultur', place = 'h', W = D.workshops[ws].garden.water;
  s.day = 2; s.hour = 6;
  bed(D, s, ws, place);
  assert.equal(canWater(D, s, ws, place).ok, have(D, s, 'wasser') > 0);
  give(D, s, 'wasser', 2);
  const n = have(D, s, 'wasser'), p0 = stage(D, s, ws, place, 0).p;
  const r = water(D, s, ws, place);
  assert.ok(r.ok);
  assert.equal(have(D, s, 'wasser'), n - 1);
  assert.ok(stage(D, s, ws, place, 0).p > p0);
  assert.equal(s.watered[place], clockHours(s));
  assert.equal(canWater(D, s, ws, place).ok, false);
  s.hour += W.every;
  assert.equal(canWater(D, s, ws, place).ok, true);
});
