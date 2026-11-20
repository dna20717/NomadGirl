// Spielstände (#126, docs/concepts/save_slots.md, Daniel 20.11.2026): up to three slots, the achievements over all of them, and the
// last deleted or overwritten savegame kept in a Vor-Lösch-Zustand (one entry, no expiry). Browser and Node (storage passed in).
//
//   local (this browser):  nomadgirl-save:<n>  the savegame of slot n      nomadgirl-saves   index { <n>: meta }
//                          nomadgirl-achievements  the global achievements   nomadgirl-trash   { slot, save, meta, why, at }
//                          nomadgirl-shot:<n>  the slot's preview picture (data URL)
//   online (worker, KV per login): /api/save?slot=n, /api/saves (metas), /api/blob?name=achievements|trash|shot<n>
// The old single savegame (nomadgirl-save, online save:<hash>) moves to slot 1 once: copied, read back, compared, then removed
// (Daniel: „sauber neu“). The device remembers its slot (nomadgirl-slot) like its Datenset; ?slot=<n> wins.
// A slot keeps the Datenset it was begun with (meta.set, '' = Standard) and is only played with that set (Daniel: „nur mit Iterationen
// von diesem Datenset“).

export const SLOTS = 3;
export const SLOT_KEY = 'nomadgirl-slot';
export const LEGACY_KEY = 'nomadgirl-save';
export const slotKey = n => `nomadgirl-save:${n}`;
const INDEX = 'nomadgirl-saves', ACH = 'nomadgirl-achievements', TRASH = 'nomadgirl-trash', shotKey = n => `nomadgirl-shot:${n}`;
export const validSlot = n => { const k = Number(n); return Number.isInteger(k) && k >= 1 && k <= SLOTS ? k : null; };
export const slotName = (save, n) => (typeof save?.name === 'string' && save.name.trim()) || `Leyla ${n}`;
export const NAMES = ['Leyla', 'Rostlauf', 'Testlauf', 'Wüstenfuchs', 'Schrottkönigin', 'Nachtfahrt', 'Funkloch', 'Zweiter Versuch', 'Kilometer 7', 'Delta'];   // for the controller (Frage C)

const ls0 = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const parse = t => { try { return t == null ? null : JSON.parse(t); } catch { return null; } };

// the slot this device plays: ?slot=<n>, else the remembered one, else 1
export function activeSlot(search = typeof location !== 'undefined' ? location.search : '', ls = ls0()) {
  const q = validSlot(new URLSearchParams(search).get('slot'));
  if (q) return q;
  try { return validSlot(ls?.getItem(SLOT_KEY)) || 1; } catch { return 1; }
}
export function chooseSlot(n, ls = ls0()) { try { if (validSlot(n)) ls?.setItem(SLOT_KEY, String(n)); } catch { /* private mode */ } }

// a small summary for the slot list, without the whole savegame
export function slotMeta(D, save, n, extra = {}) {
  if (!save) return null;
  const node = save.map?.nodes?.find?.(x => x.id === save.location);
  return {
    slot: n, name: slotName(save, n), day: save.day || 1, hour: save.hour ?? 0, cycle: save.cycle || 1,
    location: save.location || '', place: D?.locations?.[save.location]?.name || node?.name || save.location || '',
    deltas: save.deltas || 0, playMs: save.playMs || 0, savedAt: save.savedAt || 0, set: save.set ?? '', run: !!save.run, ...extra,
  };
}
export const playTime = ms => { const m = Math.round((ms || 0) / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`; };
export const metaLine = m => m ? [`Tag ${m.day}`, m.cycle > 1 ? `D${m.cycle}` : '', m.place, playTime(m.playMs)].filter(Boolean).join(' · ') : 'leer · Neues Spiel';

// ---------- global achievements: counters keep the highest count, reached ones stay reached (earliest day kept) ----------
export function mergeAchievements(a, b) {
  const out = { counts: { ...(a?.counts || {}) }, done: { ...(a?.done || {}) } };
  for (const [k, n] of Object.entries(b?.counts || {})) out.counts[k] = Math.max(out.counts[k] || 0, Number(n) || 0);
  for (const [id, d] of Object.entries(b?.done || {})) if (!out.done[id]) out.done[id] = d;
  return out;
}
// the global achievements into one savegame (its own `made` and `news` stay: each slot crafts its trophies once)
export function withGlobal(save, G) {
  if (!save || !G) return save;
  const m = mergeAchievements(G, save.achievements);
  save.achievements = { ...(save.achievements || {}), counts: m.counts, done: m.done };
  return save;
}

// ---------- storage: local (this browser) or cloud (worker) ----------
export function localStorageBackend(ls = ls0()) {
  const get = k => parse(ls?.getItem(k)), set = (k, v) => ls?.setItem(k, JSON.stringify(v));
  const index = () => {
    let I = get(INDEX);
    if (!I || typeof I !== 'object') {   // rebuilt from the slots themselves
      I = {};
      for (let n = 1; n <= SLOTS; n++) { const s = get(slotKey(n)); if (s) I[n] = { slot: n, name: slotName(s, n), day: s.day || 1, savedAt: s.savedAt || 0, set: s.set ?? '' }; }
      set(INDEX, I);
    }
    return I;
  };
  const be = {
    where: 'local',
    // the old single savegame moves to slot 1: copied, read back, compared, only then removed
    migrate() {
      const raw = ls?.getItem(LEGACY_KEY);
      if (raw == null) return false;
      if (ls.getItem(slotKey(1)) == null) {
        ls.setItem(slotKey(1), raw);
        if (ls.getItem(slotKey(1)) !== raw) return false;
        const old = parse(raw);
        if (old?.achievements) set(ACH, mergeAchievements(get(ACH), old.achievements));
        const I = get(INDEX) || {}; delete I[1]; set(INDEX, I);   // rebuilt below
        if (Object.keys(I).length === 0) ls.removeItem(INDEX);
      }
      ls.removeItem(LEGACY_KEY);
      return true;
    },
    async list() { const I = index(), out = {}; for (let n = 1; n <= SLOTS; n++) out[n] = I[n] || null; return out; },
    async get(n) { const s = get(slotKey(n)); return { save: s, time: s?.savedAt ? new Date(s.savedAt).toISOString() : null }; },
    async put(n, save, meta) { set(slotKey(n), save); const I = index(); I[n] = meta; set(INDEX, I); return new Date().toISOString(); },
    async del(n) { ls?.removeItem(slotKey(n)); ls?.removeItem(shotKey(n)); const I = index(); delete I[n]; set(INDEX, I); },
    async blob(name) { return name.startsWith('shot') ? ls?.getItem(shotKey(name.slice(4))) ?? null : get(name === 'achievements' ? ACH : TRASH); },
    async setBlob(name, v) {
      const k = name.startsWith('shot') ? shotKey(name.slice(4)) : name === 'achievements' ? ACH : TRASH;
      if (v == null) ls?.removeItem(k); else if (name.startsWith('shot')) ls?.setItem(k, v); else set(k, v);
    },
  };
  return be;
}

export function cloudBackend(base = '', fetchFn = globalThis.fetch) {
  const call = async (path, opts = {}) => {
    const r = await fetchFn(`${base}${path}`, { cache: 'no-store', ...opts, headers: { accept: 'application/json', ...(opts.body ? { 'content-type': 'application/json' } : {}) } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Fehler ${r.status}`);
    return d;
  };
  return {
    where: 'cloud',
    migrate() { return false; },   // the worker moves save:<hash> to slot 1 itself
    async list() { return (await call('/api/saves')).slots || {}; },
    async get(n) { const d = await call(`/api/save?slot=${n}`); return { save: d.save ?? null, time: d.time ?? null }; },
    async put(n, save, meta) { return (await call(`/api/save?slot=${n}`, { method: 'PUT', body: JSON.stringify({ save, meta }) })).time; },
    async del(n) { await call(`/api/save?slot=${n}`, { method: 'DELETE' }); await call(`/api/blob?name=shot${n}`, { method: 'DELETE' }).catch(() => {}); },
    async blob(name) { return (await call(`/api/blob?name=${name}`)).value ?? null; },
    async setBlob(name, v) { await call(`/api/blob?name=${name}`, v == null ? { method: 'DELETE' } : { method: 'PUT', body: JSON.stringify({ value: v }) }); },
  };
}

// which storage: the worker when it answers /api/saves with JSON, else this browser
export async function openStorage(base = '', { fetchFn = globalThis.fetch, ls = ls0() } = {}) {
  try {
    const r = await fetchFn(`${base}/api/saves`, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) return cloudBackend(base, fetchFn);
  } catch { /* no worker */ }
  const be = localStorageBackend(ls);
  try { be.migrate(); } catch { /* full or private: the old key stays and is tried again next time */ }
  return be;
}

// ---------- slot actions (the cockpit menu and the pause menu) ----------
// the Vor-Lösch-Zustand: the last savegame that was deleted or overwritten
async function toTrash(be, n, why) {
  const { save } = await be.get(n);
  if (!save) return false;
  const meta = (await be.list())[n] || { slot: n, name: slotName(save, n), day: save.day || 1 };
  await be.setBlob('trash', { slot: n, save, meta, why, at: Date.now() });
  return true;
}
export async function deleteSlot(be, n) { if (!(await toTrash(be, n, 'gelöscht'))) return false; await be.del(n); return true; }
// copy a slot onto another; an occupied target goes into the Vor-Lösch-Zustand first
export async function copySlot(be, from, to, D = null) {
  const { save } = await be.get(from);
  if (!save || from === to) return false;
  await toTrash(be, to, 'überschrieben');
  const copy = { ...structuredClone(save), name: `${slotName(save, from)} (Kopie)`, savedAt: Date.now() };
  await be.put(to, copy, slotMeta(D, copy, to));
  return true;
}
export async function renameSlot(be, n, name, D = null) {
  const { save } = await be.get(n);
  if (!save) return false;
  save.name = String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24) || `Leyla ${n}`;
  await be.put(n, save, slotMeta(D, save, n));
  return true;
}
export async function trashInfo(be) { const t = await be.blob('trash'); return t?.save ? { slot: t.slot, meta: t.meta, why: t.why, at: t.at } : null; }
// back from the Vor-Lösch-Zustand into slot n (an occupied slot swaps places with it, nothing is lost)
export async function restoreTrash(be, n, D = null) {
  const t = await be.blob('trash');
  if (!t?.save) return false;
  const { save: there } = await be.get(n);
  await be.setBlob('trash', there ? { slot: n, save: there, meta: (await be.list())[n], why: 'getauscht', at: Date.now() } : null);
  await be.put(n, t.save, slotMeta(D, t.save, n));
  return true;
}
