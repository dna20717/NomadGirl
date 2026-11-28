// CampBuilder v2 (#196): where a diorama lives. Online (Cloudflare worker) per login in the KV store of the savegames, as the blob
// „diorama<n>“ (Daniel, 28.11.2026: „definitiv online, angelehnt an das Speichersystem, was schon existiert“); without a worker
// (local, tests) in this browser. A copy always stays in this browser too, so nothing is lost when the net is gone.
//   const st = await openDioramas(); await st.load() → json | null · st.save(model) · st.where
import { openStorage } from '../slots.js';
import { toJSON } from './model.js';

const LOCAL = n => `nomadgirl-diorama:${n}`;
export async function openDioramas({ slot = 1, onSaved = null } = {}) {
  let be = null;
  try { be = await openStorage(); } catch { be = null; }
  const cloud = be?.where === 'cloud' ? be : null, name = `diorama${slot}`;
  const local = { get() { try { return JSON.parse(localStorage.getItem(LOCAL(slot)) || 'null'); } catch { return null; } }, set(v) { try { localStorage.setItem(LOCAL(slot), JSON.stringify(v)); } catch { /* full or private */ } } };
  return {
    where: cloud ? 'cloud' : 'local',
    async load() {
      const l = local.get();
      if (!cloud) return l;
      try { const v = await cloud.blob(name); if (v && (!l || (v.savedAt || 0) >= (l.savedAt || 0))) return v; } catch { /* offline: the copy here */ }
      return l;
    },
    async save(model) {
      const v = { ...toJSON(model), savedAt: Date.now() };
      local.set(v);
      let ok = true;
      if (cloud) try { await cloud.setBlob(name, v); } catch { ok = false; }
      onSaved?.(ok, v);
      return ok;
    },
    async clear() { try { localStorage.removeItem(LOCAL(slot)); } catch { /* ignore */ } if (cloud) try { await cloud.setBlob(name, null); } catch { /* ignore */ } },
  };
}
