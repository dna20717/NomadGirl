// Cloudflare Worker for NomadGirl (ported from NomadTactics, without party room and profiles).
// - Everything outside /api/ is served from dist/ (static assets). The whole address sits behind Cloudflare Access.
// - /api/ checks the Access login itself (JWT in the header Cf-Access-Jwt-Assertion).
// - The repository on GitHub is the only source of truth: the workshop and the game read the game data from the
//   current main branch and every save becomes one commit (author = the logged-in person).
//
// Configuration (wrangler.jsonc › vars, secret in the Cloudflare dashboard):
//   GITHUB_REPO   "owner/name"                     BRANCH   "main"
//   DATA_DIR      "projects/nomadgirl"             TEAM_DOMAIN  "https://<team>.cloudflareaccess.com"
//   POLICY_AUD    Access application audience tag  GITHUB_TOKEN (secret) fine-grained token, contents read/write
import { pretty } from '../tools/json.js';

const GITHUB = 'https://api.github.com';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const failure = (status, message, extra = {}) => json({ error: message, ...extra }, status);

export default {
  async fetch(request, env) { return handle(request, env, globalThis.fetch.bind(globalThis)); },
};

// fetchFn is injectable for tests (fake GitHub, fake Access certificates).
export async function handle(request, env, fetchFn) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  try {
    // Setup help: shows the (unverified) team domain and audience of the own Access login, nothing else
    if (url.pathname === '/api/access-info') return json(accessInfo(request));
    if (!env.TEAM_DOMAIN || !env.POLICY_AUD) return failure(503, 'Login ist noch nicht eingerichtet (TEAM_DOMAIN / POLICY_AUD fehlen).');
    const user = await accessUser(request, env, fetchFn);
    if (!user) return failure(401, 'Nicht angemeldet.');
    if (url.pathname === '/api/session') return json({ user, repo: env.GITHUB_REPO, branch: branch(env) });
    if (url.pathname === '/api/save') return await savegame(request, env, user, url);
    if (url.pathname === '/api/saves') return await saveList(request, env, user);   // #126 the three slots
    if (url.pathname === '/api/blob') return await saveBlob(request, env, user, url);   // #126 achievements, Vor-Lösch-Zustand, previews
    if (!env.GITHUB_TOKEN) return failure(503, 'GitHub-Schlüssel fehlt (GITHUB_TOKEN).');
    const gh = github(env, fetchFn);
    if (url.pathname === '/api/files' && request.method === 'GET') return json(await readFiles(gh, env));
    if (url.pathname === '/api/upload' && request.method === 'POST') {   // #083 a picture for an asset, as its own commit
      const body = await request.json();
      const name = authorName(body?.name) || user.name;
      return await upload(gh, env, { name, email: commitEmail(name) }, body);
    }
    if (url.pathname === '/api/commit' && request.method === 'POST') {
      const body = await request.json();
      const name = authorName(body?.name) || user.name;
      return await commit(gh, env, { name, email: commitEmail(name) }, body);
    }
    return failure(404, 'Unbekannter Weg.');
  } catch (e) {
    return failure(e.status || 500, e.message || String(e));
  }
}

const branch = env => env.BRANCH || 'main';
const dataDir = env => (env.DATA_DIR || 'projects/nomadgirl').replace(/\/+$/, '');

// The login e-mail never goes into the repository: the commit carries the chosen name and an anonymous address.
const slug = t => String(t).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'werkstatt';
export const commitEmail = name => `${slug(name)}@werkstatt.nomadgirl.invalid`;
export function authorName(n) {
  const t = String(n ?? '').replace(/[\u0000-\u001f<>]/g, '').trim();
  return t && t.length <= 40 ? t : null;
}

// ---------- savegame (Cloudflare KV per login) ----------
// #126 three slots: GET /api/save?slot=n → { save | null, time }   PUT /api/save?slot=n { save, meta } → { time }   DELETE → empty slot
// (no slot = 1). GET /api/saves → { slots: { 1: meta | null, 2: …, 3: … } } from the KV metadata, without loading the savegames.
// GET|PUT|DELETE /api/blob?name=achievements|trash|shot1..3 → { value }: the global achievements, the Vor-Lösch-Zustand, previews.
// The key is a hash of the login e-mail, so the e-mail is not stored in clear. The old single save (save:<hash>) moves to slot 1 once.
const SAVE_MAX = 256 * 1024, META_MAX = 1000, SLOTS = 3, BLOBS = /^(achievements|trash|shot[1-3])$/;
export async function saveKey(email) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(email).trim().toLowerCase()));
  return 'save:' + [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const slotOf = url => { const v = url.searchParams.get('slot'); if (v == null) return 1; const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= SLOTS ? n : null; };
// a meta the client did not send (the old save): the few things the list shows
const metaOf = (save, slot) => ({ slot, name: typeof save?.name === 'string' && save.name ? save.name.slice(0, 40) : `Leyla ${slot}`, day: save?.day || 1, hour: save?.hour ?? 0, cycle: save?.cycle || 1, deltas: save?.deltas || 0, savedAt: save?.savedAt || 0, set: save?.set ?? '' });
const cleanMeta = (m, save, slot) => { const t = m && typeof m === 'object' && !Array.isArray(m) ? JSON.stringify({ ...m, slot }) : ''; return t && t.length <= META_MAX ? JSON.parse(t) : metaOf(save, slot); };
async function migrate(env, base) {
  const old = await env.SAVES.get(base, 'json');
  if (!old) return;
  if (!(await env.SAVES.get(`${base}:1`))) await env.SAVES.put(`${base}:1`, JSON.stringify(old), { metadata: metaOf(old.save, 1) });
  if (await env.SAVES.get(`${base}:1`)) await env.SAVES.delete(base);   // read back first, then the old key goes
  const ach = old.save?.achievements;
  if (ach && !(await env.SAVES.get(`ach:${base}`))) await env.SAVES.put(`ach:${base}`, JSON.stringify({ value: { counts: ach.counts || {}, done: ach.done || {} } }));
}
async function savegame(request, env, user, url) {
  if (!env.SAVES) return failure(503, 'Spielstand-Speicher fehlt (KV-Binding SAVES).');
  const slot = slotOf(url);
  if (!slot) return failure(400, `Slot 1 bis ${SLOTS}.`);
  const base = await saveKey(user.email), key = `${base}:${slot}`;
  await migrate(env, base);
  if (request.method === 'GET') {
    const v = await env.SAVES.get(key, 'json');
    return json({ save: v?.save ?? null, time: v?.time ?? null });
  }
  if (request.method === 'PUT') {
    const body = await request.text();
    if (body.length > SAVE_MAX) return failure(413, 'Spielstand zu groß.');
    let save, meta;
    try { ({ save, meta } = JSON.parse(body) || {}); } catch { return failure(400, 'Spielstand nicht lesbar.'); }
    if (!save || typeof save !== 'object' || Array.isArray(save)) return failure(400, 'Spielstand fehlt.');
    const time = new Date().toISOString();
    await env.SAVES.put(key, JSON.stringify({ save, time }), { metadata: cleanMeta(meta, save, slot) });
    return json({ time });
  }
  if (request.method === 'DELETE') { await env.SAVES.delete(key); return json({ time: null }); }
  return failure(405, 'Nur GET, PUT oder DELETE.');
}
async function saveList(request, env, user) {
  if (!env.SAVES) return failure(503, 'Spielstand-Speicher fehlt (KV-Binding SAVES).');
  if (request.method !== 'GET') return failure(405, 'Nur GET.');
  const base = await saveKey(user.email);
  await migrate(env, base);
  const slots = {};
  for (let n = 1; n <= SLOTS; n++) slots[n] = null;
  const L = await env.SAVES.list({ prefix: `${base}:` });
  for (const k of L.keys || []) { const n = Number(k.name.slice(base.length + 1)); if (slots[n] === null) slots[n] = k.metadata || { slot: n, name: `Leyla ${n}` }; }
  return json({ slots });
}
async function saveBlob(request, env, user, url) {
  if (!env.SAVES) return failure(503, 'Spielstand-Speicher fehlt (KV-Binding SAVES).');
  const name = url.searchParams.get('name') || '';
  if (!BLOBS.test(name)) return failure(400, 'Unbekannter Speicher.');
  const base = await saveKey(user.email), key = `${name === 'achievements' ? 'ach' : name}:${base}`;
  if (request.method === 'GET') { const v = await env.SAVES.get(key, 'json'); return json({ value: v?.value ?? null }); }
  if (request.method === 'PUT') {
    const body = await request.text();
    if (body.length > SAVE_MAX) return failure(413, 'Zu groß.');
    let value;
    try { ({ value } = JSON.parse(body) || {}); } catch { return failure(400, 'Nicht lesbar.'); }
    if (value === undefined) return failure(400, 'Wert fehlt.');
    await env.SAVES.put(key, JSON.stringify({ value }));
    return json({ ok: true });
  }
  if (request.method === 'DELETE') { await env.SAVES.delete(key); return json({ ok: true }); }
  return failure(405, 'Nur GET, PUT oder DELETE.');
}

// ---------- Cloudflare Access ----------
export function accessInfo(request) {
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return { login: false, hint: 'Kein Access-Login: Cloudflare Access ist für diese Adresse noch nicht eingeschaltet.' };
  try {
    const body = JSON.parse(text(b64url(token.split('.')[1])));
    return { login: true, email: body.email, TEAM_DOMAIN: body.iss, POLICY_AUD: Array.isArray(body.aud) ? body.aud[0] : body.aud };
  } catch { return { login: false, hint: 'Access-Kopfzeile nicht lesbar.' }; }
}

const certCache = new Map();   // team domain -> { keys, time }

export async function accessUser(request, env, fetchFn) {
  // Local test with `wrangler dev --var LOCAL_TEST:1`: only ever on localhost, never on the real address
  if (env.LOCAL_TEST === '1' && /^(localhost|127\.0\.0\.1)$/.test(new URL(request.url).hostname)) return { email: 'test@localhost', name: 'Test' };
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let head, body;
  try { head = JSON.parse(text(b64url(parts[0]))); body = JSON.parse(text(b64url(parts[1]))); } catch { return null; }
  if (head.alg !== 'RS256') return null;
  const team = env.TEAM_DOMAIN.replace(/\/+$/, '');
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(body.aud) ? body.aud : [body.aud];
  if (body.iss !== team || !aud.includes(env.POLICY_AUD) || !(body.exp > now) || (body.nbf && body.nbf > now + 60)) return null;
  const keys = await certificates(team, fetchFn);
  let jwk = keys.find(k => k.kid === head.kid);
  if (!jwk) { certCache.delete(team); jwk = (await certificates(team, fetchFn)).find(k => k.kid === head.kid); }
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok || !body.email) return null;
  return { email: body.email, name: nameFromEmail(body.email) };
}

async function certificates(team, fetchFn) {
  const hit = certCache.get(team);
  if (hit && Date.now() - hit.time < 3600_000) return hit.keys;
  const r = await fetchFn(`${team}/cdn-cgi/access/certs`);
  if (!r.ok) throw Object.assign(new Error('Access-Zertifikate nicht erreichbar.'), { status: 502 });
  const keys = (await r.json()).keys || [];
  certCache.set(team, { keys, time: Date.now() });
  return keys;
}

export function nameFromEmail(email) {
  const local = String(email).split('@')[0].split('+')[0];
  return local.split(/[._-]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ') || email;
}

function b64url(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, c => c.charCodeAt(0));
}
const text = bytes => new TextDecoder().decode(bytes);

// ---------- GitHub ----------
function github(env, fetchFn) {
  const repo = env.GITHUB_REPO;
  return async (method, path, body) => {
    const r = await fetchFn(`${GITHUB}/repos/${repo}/${path}`, {
      method,
      headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'nomadgirl-workshop', 'x-github-api-version': '2022-11-28', ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = r.status === 204 ? null : await r.json().catch(() => null);
    if (!r.ok) throw Object.assign(new Error(`GitHub ${method} ${path}: ${r.status} ${data?.message || ''}`.trim()), { status: r.status === 409 || r.status === 422 ? r.status : 502, github: r.status });
    return data;
  };
}

const blobCache = new Map();   // blob sha -> parsed content (blobs never change)

async function head(gh, env) {
  const ref = await gh('GET', `git/ref/heads/${branch(env)}`);
  const commit = await gh('GET', `git/commits/${ref.object.sha}`);
  const tree = await gh('GET', `git/trees/${commit.tree.sha}?recursive=1`);
  const prefix = dataDir(env) + '/';
  const files = new Map();
  for (const t of tree.tree) if (t.type === 'blob' && t.path.startsWith(prefix) && t.path.endsWith('.json')) files.set(t.path.slice(prefix.length), t.sha);
  return { commit: ref.object.sha, tree: commit.tree.sha, files };
}

async function readFiles(gh, env) {
  const h = await head(gh, env);
  const out = {};
  await Promise.all([...h.files].map(async ([file, sha]) => {
    if (!blobCache.has(sha)) {
      const b = await gh('GET', `git/blobs/${sha}`);
      blobCache.set(sha, JSON.parse(text(b64(b.content))));
    }
    out[file] = { sha, content: blobCache.get(sha) };
  }));
  return { commit: h.commit, files: out };
}
const b64 = s => Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0));

export function validFile(file) {
  return typeof file === 'string' && /^[A-Za-z0-9_\-]+(\/[A-Za-z0-9_\-]+)*\.json$/.test(file);
}

// Git blob hash (sha1 of "blob <bytes>\0<content>") – so the client knows the new versions without asking GitHub again.
export async function blobSha(content) {
  const body = new TextEncoder().encode(content);
  const headBytes = new TextEncoder().encode(`blob ${body.length}\0`);
  const all = new Uint8Array(headBytes.length + body.length); all.set(headBytes); all.set(body, headBytes.length);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-1', all))].map(b => b.toString(16).padStart(2, '0')).join('');
}

// body: { base: { file: sha|null }, changes: [{ file, content|null }], force?: bool, name?: author name }
async function commit(gh, env, user, body) {
  const changes = Array.isArray(body?.changes) ? body.changes : [];
  if (!changes.length) return failure(400, 'Keine Änderungen.');
  for (const c of changes) if (!validFile(c.file)) return failure(400, `Ungültiger Dateiname: ${c.file}`);
  const base = body.base || {};
  const written = changes.map(c => ({ file: c.file, text: c.content == null ? null : pretty(c.content) + '\n' }));
  for (let attempt = 0; attempt < 3; attempt++) {
    const h = await head(gh, env);
    if (!body.force) {
      const conflicts = changes.filter(c => (h.files.get(c.file) ?? null) !== (base[c.file] ?? null)).map(c => c.file);
      if (conflicts.length) return failure(409, 'Jemand hat diese Dateien inzwischen geändert.', { conflicts, commit: h.commit });
    }
    const effective = written.filter(w => !(w.text === null && !h.files.has(w.file)));
    const shas = {};
    for (const w of effective) shas[w.file] = w.text === null ? null : await blobSha(w.text);
    if (effective.every(w => (h.files.get(w.file) ?? null) === shas[w.file])) return json({ commit: h.commit, files: shas, unchanged: true });
    const dir = dataDir(env);
    const tree = await gh('POST', 'git/trees', {
      base_tree: h.tree,
      tree: effective.map(w => w.text === null ? { path: `${dir}/${w.file}`, mode: '100644', type: 'blob', sha: null } : { path: `${dir}/${w.file}`, mode: '100644', type: 'blob', content: w.text }),
    });
    const names = effective.map(w => w.file.replace(/\.json$/, '').split('/').pop());
    const message = `Werkstatt: ${names.slice(0, 4).join(', ')}${names.length > 4 ? ` und ${names.length - 4} weitere` : ''} (${user.name})\n\nGespeichert in der Web-Werkstatt von ${user.name}.`;
    const who = { name: user.name, email: user.email, date: new Date().toISOString() };
    const c = await gh('POST', 'git/commits', { message, tree: tree.sha, parents: [h.commit], author: who, committer: who });   // committer too, otherwise GitHub puts in the token owner's e-mail
    try {
      await gh('PATCH', `git/refs/heads/${branch(env)}`, { sha: c.sha, force: false });
    } catch (e) {
      if (e.github === 422 || e.github === 409) continue;   // someone was faster: read again and retry
      throw e;
    }
    return json({ commit: c.sha, files: shas });
  }
  return failure(409, 'Das Repository ändert sich gerade zu oft. Bitte gleich noch einmal speichern.', { conflicts: [] });
}

// ---------- pictures (#083, Daniel 19.11.2026: „Bilder hochladen in der Online-Werkstatt“) ----------
// body: { path: 'assets/<folder>/<name>.png', data: base64, name } → { path, commit }. Only pictures under the project's assets/,
// at most UPLOAD_MAX bytes; a file that is there already is replaced (that is how a picture is updated).
export const UPLOAD_MAX = 2 * 1024 * 1024;
export function validUpload(path) {
  return typeof path === 'string' && /^assets\/[A-Za-z0-9_\-]+(\/[A-Za-z0-9_\-]+)*\.(png|gif|jpe?g|webp)$/.test(path) && !path.includes('..');
}
async function upload(gh, env, user, body) {
  const path = body?.path, data = String(body?.data || '').replace(/^data:[^,]*,/, '').replace(/\s/g, '');
  if (!validUpload(path)) return failure(400, `Ungültiger Bildpfad: ${path}`);
  if (!data || !/^[A-Za-z0-9+/]+=*$/.test(data)) return failure(400, 'Bilddaten fehlen.');
  const bytes = Math.floor(data.length * 3 / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
  if (bytes > UPLOAD_MAX) return failure(413, `Bild zu groß (${Math.round(bytes / 1024)} KiB, höchstens ${UPLOAD_MAX / 1024 / 1024} MiB).`);
  const blob = await gh('POST', 'git/blobs', { content: data, encoding: 'base64' });
  const full = `${dataDir(env)}/${path}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await gh('GET', `git/ref/heads/${branch(env)}`), parent = await gh('GET', `git/commits/${ref.object.sha}`);
    const tree = await gh('POST', 'git/trees', { base_tree: parent.tree.sha, tree: [{ path: full, mode: '100644', type: 'blob', sha: blob.sha }] });
    const who = { name: user.name, email: user.email, date: new Date().toISOString() };
    const c = await gh('POST', 'git/commits', { message: `Werkstatt: Bild ${path.split('/').pop()} (${user.name})\n\nHochgeladen in der Web-Werkstatt von ${user.name}.`, tree: tree.sha, parents: [ref.object.sha], author: who, committer: who });
    try { await gh('PATCH', `git/refs/heads/${branch(env)}`, { sha: c.sha, force: false }); }
    catch (e) { if (e.github === 422 || e.github === 409) continue; throw e; }
    return json({ path, commit: c.sha, sha: blob.sha });
  }
  return failure(409, 'Das Repository ändert sich gerade zu oft. Bitte gleich noch einmal hochladen.');
}
