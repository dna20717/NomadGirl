// #190 ④ AvA's tank warns when it slips into a worse phase (persona test #189: „Neuer Anfang“ around day 11 without one message)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { newSave } from '../game/save.js';
import { tankWarning, phase, ensureTank } from '../game/tank.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('Tank: eine Warnung je schlechterer Phase, Wartung setzt zurück, letzter Tag', () => {
  const s = newSave(D, [], {});
  const t = ensureTank(D, s);
  t.cond = 95; assert.equal(tankWarning(D, s), null, 'stabil: nichts');
  t.cond = 55;
  const w = tankWarning(D, s);
  assert.ok(w && w.title.includes(phase(D, s).name) && /Tage/.test(w.sub), JSON.stringify(w));
  assert.equal(tankWarning(D, s), null, 'dieselbe Phase nur einmal');
  t.cond = 15; assert.ok(tankWarning(D, s), 'Lecks oder Alarm: wieder eine Warnung');
  t.cond = 90; assert.equal(tankWarning(D, s), null, 'nach der Wartung still …');
  t.cond = 55; assert.ok(tankWarning(D, s), '… und beim nächsten Abrutschen wieder');
  t.cond = 2; tankWarning(D, s);
  const last = tankWarning(D, s);
  assert.ok(!last || /letzter Tag/.test(last.title), 'unter einem Tag Rest: „letzter Tag“ höchstens einmal');
  t.dead = true; assert.equal(tankWarning(D, s), null, 'tot: keine Warnung mehr');
});

// #190 ⑤ (persona test #189: AvA said „⚠️ Entwurf: Neue Farben an den Wänden …“): no draft marker in texts the player reads
test('Spieldaten: kein „⚠️ Entwurf“ in Texten', async () => {
  const fs = await import('node:fs');
  const hits = [];
  for (const f of fs.readdirSync('projects/nomadgirl/data').filter(f => f.endsWith('.json'))) {
    const raw = fs.readFileSync(`projects/nomadgirl/data/${f}`, 'utf8');
    for (const m of raw.matchAll(/"[^"]*⚠️ ?Entwurf[^"]*"/g)) hits.push(`${f}: ${m[0].slice(0, 80)}`);
  }
  assert.deepEqual(hits, []);
});
