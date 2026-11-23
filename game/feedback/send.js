// Feedback for the test phase (#181): sending. POST /api/feedback (worker/feedback.js) → { number, url }.
// Without the worker (locally, offline, error) the feedback waits in this browser and goes out on the next start.
const QUEUE = 'nomadgirl-feedback-queue';
const read = () => { try { return JSON.parse(localStorage.getItem(QUEUE) || '[]'); } catch { return []; } };
const write = list => {
  for (let l = list; l.length; l = l.slice(1)) {   // too big for the storage: the oldest go first, then the pictures
    try { localStorage.setItem(QUEUE, JSON.stringify(l)); return l.length; } catch { /* full */ }
    try { localStorage.setItem(QUEUE, JSON.stringify(l.map(x => ({ ...x, shot: null })))); return l.length; } catch { /* still full */ }
  }
  try { localStorage.removeItem(QUEUE); } catch { /* private mode */ }
  return 0;
};

export const queued = () => read();

async function post(payload, url) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error(data?.error || `HTTP ${r.status}`), { status: r.status });
  return data;
}

// → { number, url, message } or { queued: true, message }
export async function sendFeedback(payload, url = '/api/feedback') {
  try {
    const r = await post(payload, url);
    flushQueue(url);
    return { ...r, message: `Danke! Gesendet als FB-${r.number}` };
  } catch (e) {
    if (e.status === 400 || e.status === 413) throw e;   // the server says the feedback itself is wrong: no point in waiting
    write([...read(), { ...payload, queuedAt: new Date().toISOString() }].slice(-5));
    return { queued: true, message: e.status === 404 || e.status === 401 || e.status === 503 ? 'Kein Server hier: gespeichert, geht online später raus' : 'Gerade kein Netz: gespeichert, geht später raus' };
  }
}

let flushing = false;
export async function flushQueue(url = '/api/feedback') {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const item of read()) {
      try { await post(item, url); sent++; write(read().filter(x => x.queuedAt !== item.queuedAt)); }
      catch (e) { if (e.status === 400 || e.status === 413) write(read().filter(x => x.queuedAt !== item.queuedAt)); else break; }
    }
  } finally { flushing = false; }
  return sent;
}
