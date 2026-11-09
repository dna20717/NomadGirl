// Which build is running: dist/version.json is written by tools/build_web.mjs (commit + build time).
// Locally (without a build) there is none: then it says "lokal".
export async function loadVersion() {
  try {
    const r = await fetch(new URL('../version.json', import.meta.url), { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const v = await r.json();
    const when = v.built ? new Date(v.built).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    return { ...v, short: String(v.commit || '').slice(0, 7), text: `v${String(v.commit || '?').slice(0, 7)}${when ? ' · ' + when : ''}` };
  } catch { return { commit: null, short: 'lokal', text: 'lokal' }; }
}
