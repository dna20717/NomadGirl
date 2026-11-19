// Datensets (#073, Daniel 19.11.2026: „Es wäre an der Zeit, Speichern und Laden von verschiedenen Konfigurationen zu erlauben … Im Hauptmenü
// würde dann unten in der Statusleiste angezeigt werden, welches Datenset gerade aktiv ist“; Antworten: im Repo als Variante, aktiv in
// Hauptmenü + Werkstatt, pro Gerät). Browser and Node.
//
// A set is a VARIANT of the standard data: only what differs.
//   sets/index.json                      [{ id, name, description, files }]   the list and the data files each set changes (the workshop keeps it)
//   sets/<id>/data/<file>.json           the overlay of one data file
//     catalog areas: { id: entry | null }   an entry replaces the standard one, null removes it
//     single areas:  a partial object       merged deep (objects merge, arrays and values replace, null removes)
// The game loads the standard, then the overlay of the active set (this device: localStorage „nomadgirl-set“, or ?set=<id>).
import { AREAS } from './schema.js';

export const SET_INDEX = 'sets/index.json';
export const SET_KEY = 'nomadgirl-set';
export const setFile = (id, file) => `sets/${id}/${file}`;
export const slugSet = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// overlay → data
export function mergeArea(kind, base, over) {
  if (!over || !isObj(over)) return base;
  if (kind === 'catalog') {
    const out = { ...(base || {}) };
    for (const [id, x] of Object.entries(over)) { if (x === null) delete out[id]; else out[id] = structuredClone(x); }
    return out;
  }
  return deepMerge(base, over);
}
function deepMerge(base, over) {
  if (!isObj(over)) return over === undefined ? base : structuredClone(over);
  const out = isObj(base) ? { ...base } : {};
  for (const [k, v] of Object.entries(over)) { if (v === null) delete out[k]; else out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : structuredClone(v); }
  return out;
}
// data → overlay (only what differs from the standard; undefined = nothing differs)
export function diffArea(kind, base, cur) {
  base = base || {}; cur = cur || {};
  if (kind === 'catalog') {
    const out = {};
    for (const [id, x] of Object.entries(cur)) if (!same(base[id], x)) out[id] = x;
    for (const id of Object.keys(base)) if (!(id in cur)) out[id] = null;
    return Object.keys(out).length ? out : undefined;
  }
  return deepDiff(base, cur);
}
function deepDiff(base, cur) {
  if (!isObj(base) || !isObj(cur)) return same(base, cur) ? undefined : cur;
  const out = {};
  for (const [k, v] of Object.entries(cur)) { const d = deepDiff(base[k], v); if (d !== undefined) out[k] = d; }
  for (const k of Object.keys(base)) if (!(k in cur)) out[k] = null;
  return Object.keys(out).length ? out : undefined;
}

export const areaOfFile = (project, file) => Object.keys(project.paths).find(a => project.paths[a] === file) || null;

// the list of sets (none = [])
export async function listSets(loader) { try { const L = await loader.json(SET_INDEX); return Array.isArray(L) ? L.filter(s => s?.id) : []; } catch { return []; } }

// apply a set to a loaded project (in place) → { id, name, files: [changed files] } or null when unknown
export async function applySet(project, loader, id) {
  if (!id) return null;
  const meta = (await listSets(loader)).find(s => s.id === id);
  if (!meta) return null;
  const files = [];
  const only = Array.isArray(meta.files) ? new Set(meta.files) : null;   // the set says which files it has (no guessing, no 404s)
  for (const [a, A] of Object.entries(AREAS)) {
    const file = project.paths[a];
    if (only && !only.has(file)) continue;
    let over;
    try { over = await loader.json(setFile(id, file)); } catch { continue; }
    project.data[a] = mergeArea(A.kind, project.data[a], over);
    files.push(file);
  }
  project.set = { id, name: meta.name || id, description: meta.description || '', files };
  return project.set;
}
// the overlays of a set from the standard and the current data → [{ file, content }] (content null = no difference, file can go)
export function setChanges(project, base, id) {
  return Object.entries(AREAS).map(([a, A]) => ({ file: setFile(id, project.paths[a]), content: diffArea(A.kind, base[a], project.data[a]) ?? null }));
}
// the active set of this device (browser): ?set=<id> wins, then localStorage
export function activeSetId(search = typeof location !== 'undefined' ? location.search : '') {
  const q = new URLSearchParams(search).get('set');
  if (q != null) return q === 'standard' ? '' : q;
  try { return localStorage.getItem(SET_KEY) || ''; } catch { return ''; }
}
export function chooseSet(id) { try { if (id) localStorage.setItem(SET_KEY, id); else localStorage.removeItem(SET_KEY); } catch { /* private mode */ } }
