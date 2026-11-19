// Verzahnungs-Ansichten (#074): Merker graph and story chains read from the data
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { flagGraph, chainEdges } from '../game/workshop/summaries.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('Merker: wer setzt, wer liest; silo_jagd kommt aus der Quest und öffnet die Händler', () => {
  const G = flagGraph(D), j = G.get('silo_jagd');
  assert.ok(j.set.some(t => /I become death/.test(t)));
  assert.ok(j.read.some(t => /silo_kartenhaendler/.test(t)) && j.read.some(t => /silo_schwarzmarkt/.test(t)));
  assert.ok(G.get('fehde_held').read.some(t => /Nachspiel an der Kreuzung/.test(t)));
});

test('Ketten: jede Folge-Lage gibt es', () => {
  const ids = new Set(D.roadEvents.situations.map(s => s.id)), E = chainEdges(D);
  assert.ok(E.length >= 10);
  for (const e of E) assert.ok(ids.has(e.to), `${e.from} → ${e.to}`);
});
