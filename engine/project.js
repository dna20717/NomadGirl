// NomadGirl – project: load, validate, find usages, rename. Runs identically in the browser and in Node.
// Everything is driven by engine/schema.js.
import { AREAS, fields, optionLabel } from './schema.js';

export * from './schema.js';

// Read and write dot paths: get(x, 'movement.walkSpeed')
export const get = (x, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), x);
export function set(x, path, v) {
  const keys = path.split('.'), last = keys.pop();
  let o = x;
  for (const k of keys) o = (o[k] && typeof o[k] === 'object') ? o[k] : (o[k] = {});
  if (v === undefined || v === '' || v === null) delete o[last]; else o[last] = v;
  // clean up empty parent objects
  if (keys.length && !Object.keys(o).length) set(x, keys.join('.'), undefined);
}

export const freeId = (basis, present) => { let i = 1, id = basis; while (present.has(id)) id = `${basis}_${++i}`; return id; };

// p = { def: project.json, paths: { area: file }, data: { area: content } }
export async function loadProject(loader, path = 'project.json') {
  const def = await loader.json(path);
  const p = { def, paths: {}, data: {} };
  for (const [a, A] of Object.entries(AREAS)) {
    const file = def.data?.[a] || A.file;
    p.paths[a] = file;
    try { p.data[a] = await loader.json(file); }
    catch { p.data[a] = {}; }
  }
  return p;
}

// All references of one entry: [{ field, path, value, area }] (tables are resolved per row)
export function references(a, x) {
  const r = [];
  const walk = (fs, obj, prefix) => {
    for (const f of fs) {
      const v = get(obj, f.key);
      if (f.type === 'ref' && v) r.push({ field: f, path: prefix + f.label, value: v, area: f.area, holder: obj, key: f.key });
      if (f.type === 'refs') for (const [i, id] of (v || []).entries()) r.push({ field: f, path: prefix + f.label, value: id, area: f.area, holder: v, key: i });
      if (f.type === 'table') for (const [i, row] of (v || []).entries()) walk(f.columns, row, `${prefix}${f.label} ${i + 1} › `);
    }
  };
  walk(fields(a), x, '');
  return r;
}
const entries = (p, a) => AREAS[a].kind === 'catalog' ? Object.entries(p.data[a] || {}) : [[null, p.data[a] || {}]];

// Validation like `ng check`: messages { kind: error|warning|hint, text, place: { area, id } }
export function validateProject(p) {
  const m = [];
  for (const a of Object.keys(AREAS)) {
    const A = AREAS[a];
    for (const [id, x] of entries(p, a)) {
      const where = A.kind === 'catalog' ? `${A.singular || A.name} „${x?.name || id}“` : A.name;
      const report = (kind, text) => m.push({ kind, text: `${where}: ${text}`, place: { area: a, id } });
      if (!x || typeof x !== 'object') { report('error', 'kein Objekt'); continue; }
      for (const f of fields(a)) {
        const v = get(x, f.key);
        if (f.required && (v == null || v === '')) report(f.type === 'ref' ? 'error' : 'warning', `${f.label} fehlt`);
        if (f.type === 'number' && typeof v === 'number') {
          if (f.min != null && v < f.min) report('warning', `${f.label} ist ${v}, kleiner als ${f.min}`);
          if (f.max != null && v > f.max) report('warning', `${f.label} ist ${v}, größer als ${f.max}`);
        }
        if (f.type === 'range' && Array.isArray(v) && v[0] > v[1]) report('warning', `${f.label}: min ist größer als max`);
        if ((f.type === 'select') && v != null && !f.options.some(([k]) => k === v)) report('error', `${f.label}: unbekannter Wert „${v}“`);
        if (f.type === 'multi') for (const k of v || []) if (!f.options.some(([o]) => o === k)) report('error', `${f.label}: unbekannter Wert „${k}“`);
      }
      for (const r of references(a, x)) if (!p.data[r.area]?.[r.value]) report('error', `${r.path} zeigt auf unbekannte ${AREAS[r.area].singular || AREAS[r.area].name} „${r.value}“`);
      A.check?.(x, report, p, id);
    }
  }
  usageChecks(p, m);
  return m;
}

// Cross checks that need the whole project
function usageChecks(p, m) {
  const used = new Set();
  for (const a of Object.keys(AREAS)) for (const [, x] of entries(p, a)) for (const r of references(a, x)) used.add(r.area + ':' + r.value);
  for (const [id, x] of Object.entries(p.data.items || {})) {
    const inRecipe = Object.values(p.data.recipes || {}).some(r => r.result === id || (r.ingredients || []).some(i => i.item === id));
    if (!used.has('items:' + id) && !inRecipe) m.push({ kind: 'hint', text: `Gegenstand „${x.name || id}“ kommt nirgends vor (keine Beute, kein Rezept)`, place: { area: 'items', id } });
  }
  // no enemies drawn from code in the game (Daniel, 14.11.2026: „stell sicher, dass die nicht mehr auftauchen“): whoever spawns must come from a kit
  for (const a of ['pois', 'rooms', 'encounters']) for (const [eid, x] of entries(p, a)) for (const r of references(a, x)) {
    const e = r.area === 'enemies' && p.data.enemies?.[r.value];
    if (e && !e.kit) m.push({ kind: 'error', text: `${AREAS[a].singular || AREAS[a].name} „${x.name || eid}“: Gegner „${e.name || r.value}“ ist aus Code gezeichnet (kein Bausatz) und darf nicht auftauchen`, place: { area: a, id: eid } });
  }
  for (const [id, x] of Object.entries(p.data.pois || {})) if (!Object.values(p.data.locations || {}).some(l => l.poi === id)) m.push({ kind: 'hint', text: `POI „${x.name || id}“ hat noch keinen Ort auf der Oberwelt`, place: { area: 'pois', id } });
}

// Where is area:id used? → [{ area, id, name, path }]
export function usages(p, area, id) {
  const r = [];
  for (const a of Object.keys(AREAS)) for (const [eid, x] of entries(p, a)) for (const ref of references(a, x))
    if (ref.area === area && ref.value === id) r.push({ area: a, id: eid, name: AREAS[a].kind === 'catalog' ? (x.name || eid) : AREAS[a].name, path: ref.path });
  return r;
}

// Rename an entry; references in all areas follow. Returns the areas that changed.
export function renameEntry(p, area, old, new_) {
  const o = p.data[area];
  if (!o?.[old]) throw new Error(`${area}: „${old}“ gibt es nicht`);
  if (o[new_]) throw new Error(`${area}: „${new_}“ gibt es schon`);
  const changed = new Set([area]);
  const copy = {}; for (const [k, v] of Object.entries(o)) copy[k === old ? new_ : k] = v;
  p.data[area] = copy;
  for (const a of Object.keys(AREAS)) for (const [, x] of entries(p, a)) for (const r of references(a, x))
    if (r.area === area && r.value === old) { if (r.field.type === 'refs') r.holder[r.key] = new_; else set(r.holder, r.key, new_); changed.add(a); }
  return [...changed];
}

// Remove an entry; references are cleared (refs lists shrink, table rows keep their row but lose the value). Returns changed areas.
export function removeEntry(p, area, id) {
  const changed = new Set([area]);
  delete p.data[area][id];
  for (const a of Object.keys(AREAS)) for (const [, x] of entries(p, a)) for (const r of references(a, x).reverse())
    if (r.area === area && r.value === id) { if (r.field.type === 'refs') r.holder.splice(r.key, 1); else set(r.holder, r.key, undefined); changed.add(a); }
  return [...changed];
}

// Short text for an entry in lists
export function rowText(p, a, x) { try { return AREAS[a].row?.(x, p) ?? ''; } catch { return ''; } }
export { optionLabel };
