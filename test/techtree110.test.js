// Skilltrees (#110): four trees with 20+ nodes, new unlock kinds (workshops, rig parts, Merker), every value reaches the Boni-Bus
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject, validateProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { unlock, techLock, nodesOf, owned } from '../game/techtree.js';
import { mod, gearTotals } from '../game/mods.js';
import { give } from '../game/crafting.js';
import { worldFlags } from '../game/conditions.js';

const P = await loadProject(nodeLoader('projects/nomadgirl')), D = P.data;
const rich = () => { const s = newSave(D); for (const r of Object.values(D.resources)) if (r.item) give(D, s, r.item, 500); return s; };

test('Vier Äste, jeder 20+ Knoten, ungleich viele, alles gültig', () => {
  const n = ['technik', 'wissen', 'bio', 'dunkelheit'].map(t => nodesOf(D, t).length);
  assert.ok(n.every(x => x >= 20), String(n)); assert.ok(new Set(n).size > 1, 'nicht formelhaft');
  assert.equal(validateProject(P).filter(x => x.level === 'error').length, 0);
});
test('Werkstatt erst nach dem Knoten kaufbar', () => {
  const s = rich();
  assert.equal(techLock(D, s, 'workshops', 'bitfarm'), 'Bit-Farm');
  s.nodes = ['lebenszeichen', 'kryptographie'];
  assert.ok(unlock(D, s, 'bitfarm').ok);
  assert.equal(techLock(D, s, 'workshops', 'bitfarm'), null);
  assert.equal(techLock(D, s, 'workshops', 'warroom'), null, 'nicht im Baum = frei');
});
test('Camp- und Leyla-Boni aus dem Baum laufen über den Boni-Bus, Merker werden gesetzt', () => {
  const s = rich(), f0 = mod(D, s, 'fuel'), h0 = gearTotals(D, s).health || 0;
  s.nodes = ['werkzeugwand', 'werkbank2', 'feldsani', 'medkit', 'schlaf'];
  assert.ok(unlock(D, s, 'ladeluft').ok); assert.equal(mod(D, s, 'fuel') - f0, 10);
  assert.ok(unlock(D, s, 'regeneration').ok); assert.equal((gearTotals(D, s).health || 0) - h0, 10);
  s.nodes.push('kartograf'); assert.ok(unlock(D, s, 'funkscanner').ok); assert.ok(worldFlags(s).includes('tt_funkscanner'));
});
