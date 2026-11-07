// Web workshop on Cloudflare: login check and saving as commits (worker/index.js against a fake GitHub).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, nameFromEmail, validFile, blobSha, authorName } from '../worker/index.js';
import { fakeGitHub, fakeAccess, cloudFetch, testEnv, TEAM } from './fake_cloud.js';
import { pretty } from '../tools/json.js';

const START = { 'projects/nomadgirl/project.json': pretty({ name: 'NG' }) + '\n', 'projects/nomadgirl/data/weapons.json': pretty({ rohrzange: { name: 'Rohrzange', damage: 1 } }) + '\n', 'README.md': '# x\n' };

async function setup() {
  const g = fakeGitHub({ ...START }), access = await fakeAccess();
  const fetchFn = cloudFetch(g, access), env = testEnv();
  const call = async (path, { email = 'daniel.nomad@example.com', method = 'GET', body, token } = {}) => {
    const headers = {};
    const t = token !== undefined ? token : email ? await access.token(email) : null;
    if (t) headers['cf-access-jwt-assertion'] = t;
    const r = await handle(new Request('https://ng.example.workers.dev' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, fetchFn);
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  return { g, access, env, call, fetchFn };
}
const W = 'data/weapons.json';

test('Ohne gültige Anmeldung kein Zugriff, statische Seiten gehen immer', async () => {
  const { call, access, env, fetchFn } = await setup();
  assert.equal((await call('/api/files', { email: null })).status, 401);
  assert.equal((await call('/api/files', { token: 'a.b.c' })).status, 401);
  assert.equal((await call('/api/files', { token: await access.token('x@y.de', { aud: 'falsch' }) })).status, 401);
  assert.equal((await call('/api/files', { token: await access.token('x@y.de', { iss: 'https://boese.cloudflareaccess.com' }) })).status, 401);
  assert.equal((await call('/api/files', { token: await access.token('x@y.de', { exp: 1000 }) })).status, 401);
  const forged = (await access.token('daniel@x.de')).split('.'); forged[1] = Buffer.from(JSON.stringify({ email: 'evil@x.de', aud: ['aud-test-123'], iss: TEAM, exp: 9e9 })).toString('base64url');
  assert.equal((await call('/api/files', { token: forged.join('.') })).status, 401);
  const page = await handle(new Request('https://ng.example.workers.dev/game'), env, fetchFn);
  assert.equal(await page.text(), 'asset');
  const noLogin = await handle(new Request('https://ng.example.workers.dev/api/files'), { ...env, POLICY_AUD: '' }, fetchFn);
  assert.equal(noLogin.status, 503);
  const noKey = await handle(new Request('https://ng.example.workers.dev/api/files', { headers: { 'cf-access-jwt-assertion': await access.token('daniel@x.de') } }), { ...env, GITHUB_TOKEN: '' }, fetchFn);
  assert.equal(noKey.status, 503);
  // the local test door only opens on localhost
  const far = await handle(new Request('https://ng.example.workers.dev/api/session'), { ...env, LOCAL_TEST: '1' }, fetchFn);
  assert.equal(far.status, 401);
});

test('Sitzung und Dateien aus dem Repository', async () => {
  const { call } = await setup();
  const s = await call('/api/session');
  assert.equal(s.status, 200);
  assert.deepEqual(s.data.user, { email: 'daniel.nomad@example.com', name: 'Daniel Nomad' });
  assert.equal(s.data.repo, 'dna20717/NomadGirl');
  const f = await call('/api/files');
  assert.deepEqual(Object.keys(f.data.files).sort(), [W, 'project.json']);
  assert.equal(f.data.files[W].content.rohrzange.damage, 1);
  assert.equal(f.data.files[W].sha, await blobSha(START['projects/nomadgirl/' + W]));
});

test('Speichern wird ein Commit mit Autor, Konflikte werden erkannt', async () => {
  const { g, call } = await setup();
  const f = await call('/api/files');
  const base = { [W]: f.data.files[W].sha, 'data/neu.json': null };
  const r = await call('/api/commit', { method: 'POST', body: { base, changes: [{ file: W, content: { rohrzange: { name: 'Rohrzange', damage: 2 } } }, { file: 'data/neu.json', content: { a: 1 } }] } });
  assert.equal(r.status, 200);
  assert.equal(g.refs.main, r.data.commit);
  assert.match(g.fileAt('projects/nomadgirl/' + W), /"damage": 2/);
  assert.equal(g.fileAt('README.md'), '# x\n');   // everything else stays untouched
  const c = g.commits.get(r.data.commit);
  assert.equal(c.author.name, 'Daniel Nomad'); assert.equal(c.author.email, 'daniel-nomad@werkstatt.nomadgirl.invalid');   // the login e-mail stays private
  assert.deepEqual(c.committer, c.author);
  assert.match(c.message, /^Werkstatt: weapons, neu \(Daniel Nomad\)/);
  assert.equal(r.data.files[W], await blobSha(g.fileAt('projects/nomadgirl/' + W)));

  // Saving with the old version → conflict, nothing written
  const old = await call('/api/commit', { method: 'POST', body: { base, changes: [{ file: W, content: { x: 9 } }] } });
  assert.equal(old.status, 409); assert.deepEqual(old.data.conflicts, [W]);
  assert.match(g.fileAt('projects/nomadgirl/' + W), /"damage": 2/);
  // … unless forced
  const forced = await call('/api/commit', { method: 'POST', body: { base, force: true, changes: [{ file: W, content: { x: 9 } }] } });
  assert.equal(forced.status, 200); assert.match(g.fileAt('projects/nomadgirl/' + W), /"x": 9/);

  // Deleting a file
  const del = await call('/api/commit', { method: 'POST', body: { base: { 'data/neu.json': r.data.files['data/neu.json'] }, changes: [{ file: 'data/neu.json', content: null }] } });
  assert.equal(del.status, 200); assert.equal(g.fileAt('projects/nomadgirl/data/neu.json'), undefined);
});

test('Name aus der Werkstatt steht im Commit, die E-Mail bleibt anonym', async () => {
  const { g, call } = await setup();
  const f = await call('/api/files');
  const r = await call('/api/commit', { method: 'POST', body: { name: 'Daniel', base: { 'project.json': f.data.files['project.json'].sha }, changes: [{ file: 'project.json', content: { name: 'NG 2' } }] } });
  const c = g.commits.get(r.data.commit);
  assert.equal(c.author.name, 'Daniel'); assert.equal(c.author.email, 'daniel@werkstatt.nomadgirl.invalid');
  assert.match(c.message, /\(Daniel\)/);
  assert.equal(authorName(''), null); assert.equal(authorName('x'.repeat(41)), null); assert.equal(authorName(' Ava <a@b> '), 'Ava a@b');
});

test('Gleichzeitiger fremder Commit auf anderer Datei: Werkstatt baut neu auf und gewinnt', async () => {
  const { g, call } = await setup();
  const f = await call('/api/files');
  g.raceOnce = true;
  const r = await call('/api/commit', { method: 'POST', body: { base: { 'project.json': f.data.files['project.json'].sha }, changes: [{ file: 'project.json', content: { name: 'NG 3' } }] } });
  assert.equal(r.status, 200);
  assert.equal(g.fileAt('projects/nomadgirl/race.json'), '{}\n');   // the other commit stays
  assert.match(g.fileAt('projects/nomadgirl/project.json'), /NG 3/);
});

test('Gleicher Inhalt erzeugt keinen leeren Commit, ungültige Pfade werden abgelehnt', async () => {
  const { g, call } = await setup();
  const f = await call('/api/files'), before = g.refs.main;
  const same = await call('/api/commit', { method: 'POST', body: { base: { [W]: f.data.files[W].sha }, changes: [{ file: W, content: { rohrzange: { name: 'Rohrzange', damage: 1 } } }] } });
  assert.equal(same.status, 200); assert.equal(same.data.unchanged, true); assert.equal(g.refs.main, before);
  for (const bad of ['../README.md', '/etc/x.json', 'a/../b.json', 'x.js', '']) assert.equal(validFile(bad), false, bad);
  assert.equal((await call('/api/commit', { method: 'POST', body: { changes: [{ file: '../README.md', content: {} }] } })).status, 400);
  assert.equal(nameFromEmail('anna-lena+ng@web.de'), 'Anna Lena');
  const info = await call('/api/access-info');
  assert.equal(info.data.POLICY_AUD, 'aud-test-123'); assert.equal(info.data.login, true);
  assert.equal((await call('/api/access-info', { email: null })).data.login, false);
});
