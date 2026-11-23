// #181 feedback for the test phase: worker/feedback.js against a fake FeedbackBucket, the recorder without DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../worker/index.js';
import { checkFeedback } from '../worker/feedback.js';
import { fakeGitHub, fakeAccess, testEnv, TEAM } from './fake_cloud.js';
import { Recorder } from '../game/feedback/recorder.js';

async function setup() {
  const main = fakeGitHub({ 'README.md': '# NG\n' }), bucket = fakeGitHub({ 'README.md': '# Bucket\n' }, 'dna20717/FeedbackBucket'), access = await fakeAccess();
  const fetchFn = async (url, opt) => String(url).startsWith(TEAM) ? new Response(JSON.stringify(access.certs)) : String(url).includes('/FeedbackBucket/') ? bucket.fetch(url, opt) : main.fetch(url, opt);
  const env = testEnv();
  const call = async (body, email = 'daniel.nomad@example.com') => {
    const headers = email ? { 'cf-access-jwt-assertion': await access.token(email) } : {};
    const r = await handle(new Request('https://ng.example.workers.dev/api/feedback', { method: 'POST', headers, body: JSON.stringify(body) }), env, fetchFn);
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  return { main, bucket, call };
}
const SHOT = 'data:image/webp;base64,' + Buffer.from('RIFFxxxxWEBPVP8 fake').toString('base64');
const BODY = { chip: 'bug', text: 'Gegner trifft mich\ndurch die Wand', where: 'Tankstelle Km 7 · Seed 3 · Raum hall_2', shot: SHOT, reproduce: "node tools/play.mjs 'tp 41 12'",
  context: { mode: 'run', poi: 'tankstelle_km7', seed: 3, room: 'hall_2', health: '34/100', version: 'abc1234', tile: [41, 12] },
  trace: { seconds: 30, fps: { avg: 58, worstMs: 40 }, samples: [{ t: -100, x: 1 }], inputs: [{ t: -30000, held: '' }], events: [{ t: -50, type: 'hit' }], errors: [{ t: -10, message: 'TypeError: x | y', count: 2 }] } };

test('#181 Feedback wird ein Issue in FeedbackBucket, Bild + Spur als Commit dort, NomadGirl bleibt unberührt', async () => {
  const { main, bucket, call } = await setup();
  const before = main.refs.main;
  const r = await call(BODY);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.number, 1);
  const it = bucket.issues[0];
  assert.equal(it.title, 'FB-1 · Bug · Tankstelle Km 7 · Seed 3 · Raum hall_2');
  assert.deepEqual(it.labels, ['nomadgirl', 'bug']);
  assert.match(it.body, /> Gegner trifft mich\n> durch die Wand/);
  assert.match(it.body, /!\[Moment\]\(https:\/\/github\.com\/dna20717\/FeedbackBucket\/blob\/main\/media\/nomadgirl\/FB-1\/moment\.webp\?raw=true\)/);
  assert.match(it.body, /\| POI \| tankstelle_km7 · Seed 3 \|/);
  assert.match(it.body, /node tools\/play\.mjs 'tp 41 12'/);
  assert.match(it.body, /TypeError: x \/ y` \(2×\)/);   // pipes do not break the table / list
  assert.doesNotMatch(it.body, /example\.com/);   // no login e-mail
  const trace = JSON.parse(bucket.fileAt('media/nomadgirl/FB-1/trace.json'));
  assert.equal(trace.trace.fps.avg, 58); assert.equal(trace.shot, undefined); assert.equal(trace.number, 1);
  assert.ok(bucket.fileAt('media/nomadgirl/FB-1/moment.webp'));
  assert.match(bucket.commits.get(bucket.refs.main).message, /^FB-1: Bug/);
  assert.equal(main.refs.main, before);   // NomadGirl got nothing
  // a second one without picture and chip, text only
  const r2 = await call({ text: 'Nur Text', where: 'Camp' });
  assert.equal(r2.data.number, 2);
  assert.equal(bucket.issues[1].title, 'FB-2 · Feedback · Camp');
  assert.equal(bucket.fileAt('media/nomadgirl/FB-2/moment.webp'), undefined);
});

test('#181 Feedback: Prüfung und Login', async () => {
  const { call, bucket } = await setup();
  assert.equal((await call(BODY, null)).status, 401);
  assert.equal((await call({ where: 'x' })).status, 400);   // neither chip nor text
  assert.equal((await call({ chip: 'quatsch' })).status, 400);
  assert.equal((await call({ chip: 'gut', shot: 'data:image/svg+xml;base64,AAAA' })).status, 400);
  assert.equal((await call({ chip: 'gut', shot: 'data:image/webp;base64,' + 'A'.repeat(600000) })).status, 413);
  assert.equal(bucket.issues, undefined);
  assert.equal(checkFeedback({ chip: 'gut' }), null);
});

test('#181 Spur: Fenster der letzten Sekunden, Eingaben nur bei Wechsel, Fehler gebündelt', () => {
  const rec = new Recorder({ seconds: 30, every: 15 });
  const F = 1000 / 60;
  for (let f = 0; f < 60 * 40; f++) rec.frame(f * F, f % 120 < 60 ? ['right'] : ['right', 'jump'], () => ({ f }));
  const d = rec.dump();
  assert.equal(d.seconds, 30);
  assert.ok(d.samples.length >= 119 && d.samples.length <= 121, String(d.samples.length));   // 4 per second
  assert.ok(d.samples[0].t >= -30000 && d.samples.at(-1).t <= 0);
  assert.ok(d.inputs.length >= 30 && d.inputs.length <= 32, String(d.inputs.length));   // a change every second
  assert.equal(d.fps.avg, 60);
  assert.equal(rec.error('boom'), true); assert.equal(rec.error('boom'), false);
  assert.equal(rec.dump().errors[0].count, 2);
});

test('#181 Bild aus Safari (JPEG) bekommt die richtige Endung', async () => {
  const { bucket, call } = await setup();
  const r = await call({ ...BODY, shot: 'data:image/jpeg;base64,' + Buffer.from('jpegdata').toString('base64') });
  assert.equal(r.status, 200);
  assert.ok(bucket.fileAt('media/nomadgirl/FB-1/moment.jpg'));
  assert.match(bucket.issues[0].body, /FB-1\/moment\.jpg\?raw=true/);
});
