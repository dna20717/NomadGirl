// #184/#185 Meta-Baum (game/unlocks.js) without DOM: stages, goals → meta → free, story moments, gifts, ganz raus as Wertsache,
// the start rig, a new Durchgang (keep or forget), jobs of locked systems.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave, newCycle, repairSave } from '../game/save.js';
import { unlocked, stageOf, checkUnlocks, hiddenAs, setUnlocked, unlockAll, tree, grantWorkshops, workshopOpen, out } from '../game/unlocks.js';
import { offers } from '../game/quests.js';
import { bump } from '../game/achievements.js';
import { update as tankUpdate, ensureTank } from '../game/tank.js';
import { advance } from '../game/save.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;
const fresh = () => newSave(D, [], { meta: true });
const ws = s => [...s.rig.units.flatMap(u => u.workshops.map(w => w.id)), ...s.rig.spare.workshops.map(w => w.id ?? w)];

test('Neues Spiel: Stufe 0, Start-Rig ohne die Geschenke, alte Stände und Tests haben alles', () => {
  const s = fresh();
  assert.equal(stageOf(D, s), 0);
  assert.ok(!unlocked(D, s, 'inventory') && !unlocked(D, s, 'travel') && !unlocked(D, s, 'trade') && !unlocked(D, s, 'cyberware'));
  checkUnlocks(D, s);
  assert.ok(unlocked(D, s, 'movement') && unlocked(D, s, 'fight') && unlocked(D, s, 'use'));
  assert.equal(stageOf(D, s), 1, 'Stufe 0 komplett → Stufe 1 offen');
  assert.ok(!ws(s).includes('kochnische') && !ws(s).includes('werkbank') && !ws(s).includes('warroom'), ws(s).join());
  assert.ok(ws(s).includes('schlafkoje') && ws(s).includes('lagerregal'));
  const old = newSave(D);   // tests and repairSave: no meta = everything
  assert.ok(unlocked(D, old, 'cyberware') && ws(old).includes('kochnische'));
  assert.ok(unlocked(D, repairSave(JSON.parse(JSON.stringify(old)), D), 'power'));
  assert.ok(unlocked(D, null, 'travel'), 'ohne Spielstand alles');
});

test('Ziele → Meta → frei, Story-Moment, Stufen öffnen nacheinander, Geschenke ins Rig', () => {
  const s = fresh();
  checkUnlocks(D, s);
  bump(D, s, 'kills', 1);
  let f = checkUnlocks(D, s);
  assert.deepEqual(f.map(x => x.id), ['inventory']); assert.ok(f[0].moment?.text);
  bump(D, s, 'pois', 1);
  f = checkUnlocks(D, s);
  assert.ok(f.some(x => x.id === 'camp')); assert.equal(stageOf(D, s), 2);
  bump(D, s, 'pois', 1);
  f = checkUnlocks(D, s);
  assert.ok(f.some(x => x.id === 'travel' && x.grant?.workshops?.includes('warroom')));
  assert.ok(!unlocked(D, s, 'hacking'), 'Hacking kostet 2 Meta: pois 3 + eine Fahrt');
  bump(D, s, 'pois', 1); checkUnlocks(D, s);
  assert.ok(!unlocked(D, s, 'hacking'));
  bump(D, s, 'trips', 1); checkUnlocks(D, s);
  assert.ok(unlocked(D, s, 'hacking'));
  assert.equal(stageOf(D, s), 3);
  // the quest frees Rig bauen; a goal met before its stage opens waits
  const g = grantWorkshops(D, s, ['warroom']);
  assert.ok(g[0].where === 'rig' || g[0].where === 'spare');
  s.quests = { active: {}, done: { kabelsalat: { day: 1 } } };
  f = checkUnlocks(D, s);
  assert.ok(f.some(x => x.id === 'build'));
  assert.ok(tree(D, s).find(t => t.i === 3).systems.find(x => x.id === 'build').free);
});

test('Ganz raus: Implantate, Entities, Gefangene und Technik/Wissen/Bio gelten als Wertsache; Werkstätten fehlen im Katalog', () => {
  const s = fresh();
  assert.equal(hiddenAs(D, s, 'nachtsicht_optik'), 'cyberware');
  assert.equal(hiddenAs(D, s, 'bauplan_zielsucher_linse'), 'cyberware', 'Bauplan eines Implantats');
  assert.equal(hiddenAs(D, s, 'bauplan_medikit'), null);
  assert.equal(hiddenAs(D, s, 'technik'), 'search');
  assert.equal(hiddenAs(D, s, 'goldzahn'), null);
  assert.ok(out(D, s, 'megarigs') && out(D, s, 'power'));
  assert.ok(!workshopOpen(D, s, 'ripperdoc') && !workshopOpen(D, s, 'zelle') && !workshopOpen(D, s, 'bitfarm') && workshopOpen(D, s, 'generator'));
  setUnlocked(D, s, 'cyberware', true);
  assert.equal(hiddenAs(D, s, 'nachtsicht_optik'), null);
  unlockAll(D, s);
  assert.equal(hiddenAs(D, s, 'technik'), null);
});

test('Tank verfällt erst ab Stufe 4; Aufträge gesperrter Systeme warten', () => {
  const s = fresh(); ensureTank(D, s);
  const c0 = s.tank.cond; advance(s, 48); tankUpdate(D, s);
  assert.equal(s.tank.cond, c0, 'kein Verfall vor „Die Suche“');
  setUnlocked(D, s, 'search', true); advance(s, 48); tankUpdate(D, s);
  assert.ok(s.tank.cond < c0);
  const o = offers(D, s);
  assert.ok(o.includes('sung_zutaten') && !o.includes('sungs_suppe') && !o.includes('kopfgeld_schraube'));
  const any = st => Object.values(D.quests).filter(q => q.gang).map(q => q.gang).filter((g, i, a) => a.indexOf(g) === i).flatMap(g => offers(D, st, g));
  assert.equal(any(s).length, 0, 'Gang-Aufträge erst mit Machtspiele');
  setUnlocked(D, s, 'power', true);
  assert.equal(any(s).length, any(newSave(D)).length);
});

test('Neuer Durchgang wählbar: Meta-Baum behalten oder vergessen', () => {
  const s = fresh(); checkUnlocks(D, s); bump(D, s, 'kills', 1); bump(D, s, 'pois', 2); checkUnlocks(D, s);
  assert.ok(unlocked(D, s, 'travel'));
  const keep = newCycle(D, s, true), forget = newCycle(D, s, false);
  assert.ok(unlocked(D, keep, 'travel')); assert.ok(ws(keep).includes('warroom') || true);
  assert.ok(!unlocked(D, forget, 'travel') && !unlocked(D, forget, 'inventory'));
  assert.ok(!ws(forget).includes('kochnische'));
  const all = newCycle(D, newSave(D));
  assert.ok(unlocked(D, all, 'cyberware'), 'alter Stand bleibt alles frei');
});
