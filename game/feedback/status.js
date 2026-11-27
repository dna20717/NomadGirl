// Feedback board (#194): the status of a report, the same for the worker and the board (no DOM).
// Daniel, 27.11.2026: „offen, in Bearbeitung, bereit zur Abnahme, geschlossen … und dann noch das Abnahme-Häkchen daneben“.
// On GitHub: open issue without label = offen · label in-bearbeitung · label abnahme · closed issue = geschlossen;
// the tick is the label abgenommen and always closes the issue.
export const STATUS = [
  { id: 'offen', label: 'Offen', icon: 'points' },
  { id: 'arbeit', label: 'In Bearbeitung', icon: 'workbench' },
  { id: 'abnahme', label: 'Bereit zur Abnahme', icon: 'auge' },
  { id: 'zu', label: 'Geschlossen', icon: 'check' },
];
export const LABEL = { arbeit: 'in-bearbeitung', abnahme: 'abnahme', accepted: 'abgenommen' };
const OWN = new Set(Object.values(LABEL));
export const statusName = id => STATUS.find(s => s.id === id)?.label || id;
const names = labels => (labels || []).map(l => typeof l === 'string' ? l : l.name);

export function statusOf(issue) {
  const L = names(issue.labels);
  if (issue.state === 'closed') return 'zu';
  if (L.includes(LABEL.abnahme)) return 'abnahme';
  if (L.includes(LABEL.arbeit)) return 'arbeit';
  return 'offen';
}
export const acceptedOf = issue => issue.state === 'closed' && names(issue.labels).includes(LABEL.accepted);

// what to send to GitHub for a change: { status?, accepted? } → { labels, state, state_reason } (or null: nothing changes)
//   the tick: only from „Bereit zur Abnahme“ (or a closed one); ticking closes, unticking goes back to „Bereit zur Abnahme“
export function applyStatus(issue, { status, accepted } = {}) {
  let st = statusOf(issue), acc = acceptedOf(issue);
  if (status && STATUS.some(s => s.id === status)) { st = status; if (st !== 'zu') acc = false; }
  if (accepted === true) { if (st !== 'abnahme' && st !== 'zu') return { error: 'Abnehmen geht erst, wenn die Meldung bereit zur Abnahme ist.' }; acc = true; st = 'zu'; }
  if (accepted === false && acc) { acc = false; st = 'abnahme'; }
  const labels = names(issue.labels).filter(l => !OWN.has(l));
  if (st === 'arbeit') labels.push(LABEL.arbeit);
  if (st === 'abnahme') labels.push(LABEL.abnahme);
  if (acc) labels.push(LABEL.accepted);
  const state = st === 'zu' ? 'closed' : 'open';
  const same = state === issue.state && labels.length === names(issue.labels).length && labels.every(l => names(issue.labels).includes(l));
  if (same) return null;
  return { labels, state, ...(state === 'closed' ? { state_reason: acc ? 'completed' : 'not_planned' } : {}), status: st, accepted: acc };
}

// the parts of an issue body written by worker/feedback.js: the chip line, the quoted text, who sent it
export function parseBody(body = '') {
  const lines = String(body).split('\n'), q = [];
  let i = lines.findIndex(l => l.startsWith('> '));
  if (i >= 0) for (; i < lines.length && lines[i].startsWith('>'); i++) q.push(lines[i].replace(/^> ?/, ''));
  const by = /gemeldet von ([^·<]+?) ·/.exec(body)?.[1]?.trim() || null;
  return { text: q.join('\n'), by, persona: /^Persona /.test(by || '') };
}
// the quoted text replaced (editing on the board), everything else stays
export function replaceText(body = '', text = '') {
  const lines = String(body).split('\n'), quoted = String(text).trim() ? String(text).split('\n').map(l => `> ${l}`) : ['_(kein Text)_'];
  let a = lines.findIndex(l => l.startsWith('> ') || l === '_(kein Text)_');
  if (a < 0) return [lines[0] || '', '', ...quoted, '', ...lines.slice(1)].join('\n');
  let b = a; while (b < lines.length && (lines[b].startsWith('>') || (b === a && lines[b] === '_(kein Text)_'))) b++;
  return [...lines.slice(0, a), ...quoted, ...lines.slice(b)].join('\n');
}
