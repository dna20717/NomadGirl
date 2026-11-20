// NomadGirl – rename log (Backlog C10, #125): which ids were renamed, for savegames. No imports (game/save.js uses it without the schema).

// area → { old: final } for the ids that no longer exist (chains followed; only targets that exist count)
export function renameMap(data) {
  const out = {};
  for (const r of data?.renames?.log || []) if (r?.area && r.from && r.to) (out[r.area] ||= {})[r.from] = r.to;
  for (const [a, m] of Object.entries(out)) {
    for (const from of Object.keys(m)) {
      let to = m[from]; const seen = new Set([from]);
      while (m[to] && !data[a]?.[to] && !seen.has(to)) { seen.add(to); to = m[to]; }
      if (data[a]?.[from] || !data[a]?.[to]) delete m[from]; else m[from] = to;
    }
    if (!Object.keys(m).length) delete out[a];
  }
  return out;
}
