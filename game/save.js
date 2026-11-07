// Savegame: everything that lasts between runs (clock, place, rig, Δ, health, buffs, run in progress).
// Online (Cloudflare worker) one savegame per login in KV (/api/save), the same on every device;
// without the worker (local, tests) in this browser (localStorage). Shape:
//   { version, day, hour, location, fuel, food, deltas, health, buffs: [id], rig: { tractor, units: [{ kind, id, workshops: [{ id, at }] }] },
//     companions: [id], run: null | { poi, room, location }, log: [text] }
// Times are hours (18.5 = 18:30). "Ereignis-Zeit": the clock only moves on actions (sleeping, runs, sitting at the fire).

const LOCAL_KEY = 'nomadgirl-save';
export const SAVE_VERSION = 1;

// rig layout from a tractor, containers and workshops: the tractor's own places first, then the containers in order
export function placeWorkshops(D, tractor, containers, workshops) {
  const units = [{ kind: 'tractor', id: tractor, workshops: [] }, ...containers.map(id => ({ kind: 'container', id, workshops: [] }))];
  const cap = u => (u.kind === 'tractor' ? D.tractors?.[u.id]?.places : D.containers?.[u.id]?.places) || 0;
  const free = u => { const used = new Set(); for (const w of u.workshops) for (let i = 0; i < (D.workshops?.[w.id]?.places || 1); i++) used.add(w.at + i); return used; };
  const left = [];
  for (const id of workshops) {
    const need = D.workshops?.[id]?.places || 1;
    let done = false;
    for (const u of units) {
      const used = free(u);
      for (let at = 0; at + need <= cap(u) && !done; at++)
        if ([...Array(need).keys()].every(i => !used.has(at + i))) { u.workshops.push({ id, at }); done = true; }
      if (done) break;
    }
    if (!done) left.push(id);
  }
  return { units, left };
}

export function newSave(D) {
  const S = D.game?.start || {}, C = D.camp?.clock || {};
  const { units } = placeWorkshops(D, S.tractor, S.containers || [], S.workshops || []);
  return {
    version: SAVE_VERSION,
    day: C.startDay ?? 1, hour: C.startHour ?? 18,
    location: S.location || Object.keys(D.locations || {})[0] || null,
    fuel: S.fuel ?? 40, food: S.food ?? 6, deltas: S.deltas ?? 0,
    health: D.leyla?.health ?? 100,
    buffs: [],
    rig: { tractor: S.tractor, units },
    companions: [...(S.companions || [])],
    run: null,
    log: [],
  };
}

// fills gaps of an older savegame (new fields, removed workshops) so the game never trips over it
export function repairSave(save, D) {
  const fresh = newSave(D);
  if (!save || typeof save !== 'object' || save.version !== SAVE_VERSION) return fresh;
  const s = { ...fresh, ...save };
  if (!D.locations?.[s.location]) s.location = fresh.location;
  if (!D.tractors?.[s.rig?.tractor]) s.rig = fresh.rig;
  for (const u of s.rig.units) u.workshops = (u.workshops || []).filter(w => D.workshops?.[w.id]);
  s.buffs = (s.buffs || []).filter(b => D.buffs?.[b]);
  s.companions = (s.companions || []).filter(c => D.companions?.[c]);
  if (s.run && !D.pois?.[s.run.poi]) s.run = null;
  return s;
}

// the clock: day + hour → "Tag 2 · 07:30"
export function clockText(save) {
  const h = Math.floor(save.hour), m = Math.round((save.hour - h) * 60);
  return `Tag ${save.day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function advance(save, hours) {
  const t = save.hour + hours;
  save.day += Math.floor(t / 24); save.hour = Math.round((t % 24) * 4) / 4;
  return save;
}
// hours until the next time the clock shows `hour` (sleeping until the morning)
export function hoursUntil(save, hour) { const d = (hour - save.hour + 24) % 24; return d === 0 ? 24 : d; }

export async function openSave(D, base = '') {
  let where = 'local', stored = null, time = null;
  try {
    const r = await fetch(`${base}/api/save`, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) { const d = await r.json(); where = 'cloud'; stored = d.save; time = d.time; }
  } catch { /* no worker */ }
  if (where === 'local') try { stored = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch { stored = null; }
  const box = {
    where, time,
    save: repairSave(stored, D),
    fresh: !stored,
    error: null,
    // write the savegame (online: KV per login, otherwise this browser); errors are kept, the game goes on
    async persist() {
      const body = JSON.stringify({ save: box.save });
      try {
        if (where === 'cloud') {
          const r = await fetch(`${base}/api/save`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body });
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Fehler ${r.status}`);
          box.time = (await r.json()).time;
        } else { localStorage.setItem(LOCAL_KEY, JSON.stringify(box.save)); box.time = new Date().toISOString(); }
        box.error = null;
      } catch (e) { box.error = e.message; console.warn('Spielstand nicht gespeichert:', e.message); }
      return box;
    },
    async reset() { box.save = newSave(D); box.fresh = true; return box.persist(); },
  };
  return box;
}
