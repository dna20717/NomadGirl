// Storage of the web workshop on Cloudflare (worker/index.js), ported from NomadTactics.
// The repository is the source: all() reads the game data of the current main branch, saveAll() writes
// all changed files as one commit. Each file remembers the version (blob sha) it was loaded with,
// so the worker can notice when someone else changed it in the meantime (409 with the list of files).
// Without the worker (local, artifact) openCloudStore returns null and the old storage (store.js) is used.
// The author name is kept in this browser (localStorage) until profiles come.

const NAME_KEY = 'nomadgirl-name';
const readName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };

export async function openCloudStore(base = '') {
  let r;
  try { r = await fetch(`${base}/api/session`, { headers: { accept: 'application/json' }, cache: 'no-store' }); } catch { return null; }
  if (r.status === 404 || !(r.headers.get('content-type') || '').includes('json')) return null;   // no worker here
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Anmeldung fehlgeschlagen (${r.status}).`);
  return cloudStore(base, data);
}

// For the game: the current data from the repository, or null (no worker, not logged in, no GitHub key).
export async function cloudFiles(base = '') {
  try {
    const r = await fetch(`${base}/api/files`, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return null;
    const data = await r.json();
    return { commit: data.commit, files: new Map(Object.entries(data.files).map(([f, x]) => [f, x.content])) };
  } catch { return null; }
}

function cloudStore(base, session) {
  const versions = new Map();   // file -> blob sha in the repository (null = new)
  const call = async (path, opt = {}) => {
    const r = await fetch(base + path, { ...opt, cache: 'no-store', headers: { accept: 'application/json', ...(opt.body ? { 'content-type': 'application/json' } : {}) } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || `Fehler ${r.status}`), { status: r.status, conflicts: data.conflicts || [] });
    return data;
  };
  const user = { ...session.user, name: readName() || session.user?.name };
  return {
    kind: 'cloud',
    user,
    repo: session.repo,
    setName(name) {
      const n = String(name).trim().slice(0, 40);
      if (!n) throw new Error('Der Name braucht 1 bis 40 Zeichen.');
      try { localStorage.setItem(NAME_KEY, n); } catch { /* private mode */ }
      this.user = { ...this.user, name: n };
    },
    commit: null,
    async all() {
      const data = await call('/api/files');
      this.commit = data.commit;
      const m = new Map();
      versions.clear();
      for (const [file, x] of Object.entries(data.files)) { versions.set(file, x.sha); m.set(file, x.content); }
      return m;
    },
    // changes: [{ file, content|null }] -> { commit, short, unchanged }
    async saveAll(changes, { force = false } = {}) {
      const base = {};
      for (const c of changes) base[c.file] = versions.get(c.file) ?? null;
      const data = await call('/api/commit', { method: 'POST', body: JSON.stringify({ base, changes, force, name: this.user.name }) });
      for (const [file, sha] of Object.entries(data.files || {})) sha ? versions.set(file, sha) : versions.delete(file);
      this.commit = data.commit;
      return { commit: data.commit, short: String(data.commit || '').slice(0, 7), unchanged: !!data.unchanged };
    },
    async persist(file, content) { return this.saveAll([{ file, content }]); },
    async discard(file) { return this.saveAll([{ file, content: null }]); },
    async loadUp() { throw new Error('Bilder hochladen geht in der Web-Werkstatt noch nicht.'); },
  };
}
