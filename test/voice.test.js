// #112 Gebrabbel (game/voice.js): syllables from the real text, the melody of a sentence, which voice speaks, Leyla's noises.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProject } from '../engine/project.js';
import { nodeLoader } from '../tools/loader.js';
import { syllables, lineLength, voiceOf, answerSound, DEFAULT_VOICE } from '../game/voice.js';

const D = (await loadProject(nodeLoader('projects/nomadgirl'))).data;

test('Silben folgen dem Text: Vokalgruppen, Pausen, gleich bei gleichem Satz', () => {
  const S = syllables('Hallo Leyla, schön dich zu sehen.');
  assert.equal(S.length, 2 + 2 + 1 + 1 + 1 + 2);   // hal-lo ley-la schön dich zu se-hen
  assert.deepEqual(syllables('Hallo Leyla, schön dich zu sehen.'), S, 'gleicher Satz, gleiches Gebrabbel');
  assert.notDeepEqual(syllables('Kiste').map(s => s.vowel), syllables('Hallo').map(s => s.vowel));
  for (let i = 1; i < S.length; i++) assert.ok(S[i].t > S[i - 1].t, 'Silben nacheinander');
  const plain = lineLength('Ja ja ja ja'), comma = lineLength('Ja, ja, ja, ja');
  assert.ok(comma > plain, 'Kommas machen Pausen');
});

test('Satzmelodie: Frage steigt am Ende, Ausruf lauter', () => {
  const q = syllables('Kommst du mit?'), s = syllables('Kommst du mit.');
  assert.ok(q.at(-1).pitch > s.at(-1).pitch + 3 && q.at(-1).rise > 0);
  const e = syllables('Kommst du mit!');
  assert.ok(e.at(-1).gain > s.at(-1).gain);
  assert.equal(syllables('?!').length, 0, 'nur Satzzeichen: keine Silben');
});

test('Tempo der Stimme: schnelle Stimmen sind kürzer', () => {
  assert.ok(lineLength('Das ist ein langer Satz mit vielen Worten.', { ...DEFAULT_VOICE, speed: 16 }) < lineLength('Das ist ein langer Satz mit vielen Worten.', { ...DEFAULT_VOICE, speed: 6 }));
});

test('Wer spricht: eigene Stimme, sonst fest aus dem Vorrat nach dem Namen und Stil', () => {
  assert.equal(voiceOf(D, { id: 'schraube', name: 'Schraube' }).id, 'schraube');
  assert.equal(voiceOf(D, { voice: D.leyla.voice }).id, 'leyla');
  const a = voiceOf(D, { name: 'Ronja Rost' }), b = voiceOf(D, { name: 'Ronja Rost' });
  assert.equal(a.id, b.id); assert.ok(D.voices[a.id].pool); assert.equal(a.style, 'human');
  assert.equal(voiceOf(D, { name: 'Schläger#3', style: 'beast' }).style, 'beast');
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].map(n => voiceOf(D, { name: `Siedler ${n}` }).id);
  assert.ok(new Set(names).size >= 3, 'Fremde klingen verschieden');
});

test('Alle Companions und Leyla haben eine Stimme, AvA piept', () => {
  for (const [id, c] of Object.entries(D.companions)) assert.ok(D.voices[c.voice], id);
  assert.ok(D.voices[D.leyla.voice]);
  assert.equal(D.voices[D.drone.voice].style, 'robot');
});

test('Leylas Laute passen zur Antwort', () => {
  assert.equal(answerSound('Annehmen'), 'mhm');
  assert.equal(answerSound('Später'), 'nope');
  assert.equal(answerSound('Tschüss'), 'hm');
  assert.equal(answerSound('Wie läuft „Ratten“?'), 'oh');
  assert.equal(answerSound('Rammbock!'), 'ha');
});
