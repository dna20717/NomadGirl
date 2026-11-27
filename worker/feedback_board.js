// Feedback board (#194): read and edit the reports in FeedbackBucket. Everybody with a login may (Daniel, 27.11.2026:
// „sehen und editieren sollen es alle können“). Same token as worker/feedback.js.
//   GET  /api/feedback/list            → { repo, items: [{ number, title, status, accepted, chip, where, text, by, persona, created, updated, comments }] }
//   GET  /api/feedback/item?n=7        → { …item, body, url, files: ['moment.webp', 'trace.json'], comments: [{ by, at, body }] }
//   GET  /api/feedback/file?n=7&f=…    → the picture or trace.json from media/nomadgirl/FB-7/
//   POST /api/feedback/update { n, status?, accepted?, text?, comment? } → the item as in the list
import { statusOf, acceptedOf, applyStatus, parseBody, replaceText, statusName } from '../game/feedback/status.js';

const GITHUB = 'https://api.github.com';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const failure = (status, message) => json({ error: message }, status);
const CHIPS = ['gut', 'schlecht', 'bug', 'idee', 'verwirrend'];
const FILE = /^(moment\.(webp|png|jpg)|trace\.json)$/;
const TYPES = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', json: 'application/json; charset=utf-8' };

function gh(env, fetchFn) {
  const repo = env.FEEDBACK_REPO || 'dna20717/FeedbackBucket';
  const req = (method, path, body, accept = 'application/vnd.github+json') => fetchFn(`${GITHUB}/repos/${repo}/${path}`, {
    method, headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept, 'user-agent': 'nomadgirl-feedback', 'x-github-api-version': '2022-11-28', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const call = async (method, path, body) => {
    const r = await req(method, path, body), data = r.status === 204 ? null : await r.json().catch(() => null);
    if (!r.ok) throw Object.assign(new Error(`FeedbackBucket: GitHub ${method} ${path.split('?')[0]}: ${r.status} ${data?.message || ''}`.trim()), { status: r.status === 404 ? 404 : 502 });
    return data;
  };
  return { repo, req, call };
}

const names = labels => (labels || []).map(l => typeof l === 'string' ? l : l.name);
export function itemOf(issue) {
  const p = parseBody(issue.body), L = names(issue.labels);
  return {
    number: issue.number, title: issue.title, status: statusOf(issue), accepted: acceptedOf(issue),
    chip: CHIPS.find(c => L.includes(c)) || null, where: String(issue.title || '').split(' · ').slice(2).join(' · '),
    text: p.text, by: p.by, persona: p.persona || L.includes('persona'),
    created: issue.created_at || null, updated: issue.updated_at || null, comments: issue.comments ?? 0,
  };
}

export async function feedbackBoard(request, env, user, url, fetchFn) {
  const { repo, req, call } = gh(env, fetchFn), way = url.pathname.slice('/api/feedback/'.length);
  const num = v => { const n = Number(v); if (!Number.isInteger(n) || n < 1) throw Object.assign(new Error('Welche Meldung? (n fehlt)'), { status: 400 }); return n; };
  if (way === 'list' && request.method === 'GET') {
    const out = [];
    for (let page = 1; page <= 5; page++) {
      const list = await call('GET', `issues?state=all&labels=nomadgirl&per_page=100&sort=created&direction=desc&page=${page}`);
      out.push(...list.filter(i => !i.pull_request).map(itemOf));
      if (list.length < 100) break;
    }
    return json({ repo, items: out });
  }
  if (way === 'item' && request.method === 'GET') {
    const n = num(url.searchParams.get('n')), issue = await call('GET', `issues/${n}`);
    const [comments, dir] = await Promise.all([
      issue.comments ? call('GET', `issues/${n}/comments?per_page=100`) : [],
      call('GET', `contents/media/nomadgirl/FB-${n}`).catch(() => []),
    ]);
    return json({ ...itemOf(issue), body: issue.body || '', url: issue.html_url || `https://github.com/${repo}/issues/${n}`,
      files: (Array.isArray(dir) ? dir : []).map(f => f.name).filter(f => FILE.test(f)),
      comments: comments.map(c => ({ by: c.user?.login || '?', at: c.created_at || null, body: c.body || '' })) });
  }
  if (way === 'file' && request.method === 'GET') {
    const n = num(url.searchParams.get('n')), f = url.searchParams.get('f') || '';
    if (!FILE.test(f)) return failure(400, 'Diese Datei gibt es hier nicht.');
    const r = await req('GET', `contents/media/nomadgirl/FB-${n}/${f}`, null, 'application/vnd.github.raw');
    if (!r.ok) return failure(r.status === 404 ? 404 : 502, `FB-${n}/${f}: ${r.status}`);
    return new Response(await r.arrayBuffer(), { headers: { 'content-type': TYPES[f.split('.').pop()], 'cache-control': 'private, max-age=3600' } });
  }
  if (way === 'update' && request.method === 'POST') {
    const b = await request.json().catch(() => null) || {}, n = num(b.n), issue = await call('GET', `issues/${n}`), who = user?.name || 'jemand';
    const patch = {}, notes = [];
    const st = applyStatus(issue, { status: b.status, accepted: b.accepted });
    if (st?.error) return failure(400, st.error);
    if (st) {
      Object.assign(patch, { labels: st.labels, state: st.state, ...(st.state_reason ? { state_reason: st.state_reason } : {}) });
      notes.push(st.accepted ? '✅ Abgenommen und geschlossen' : `Status: **${statusName(st.status)}**`);
    }
    if (typeof b.text === 'string' && b.text.trim() !== parseBody(issue.body).text.trim()) { patch.body = replaceText(issue.body, b.text.slice(0, 4000)); notes.push('Text bearbeitet'); }
    const comment = typeof b.comment === 'string' ? b.comment.trim().slice(0, 4000) : '';
    if (!notes.length && !comment) return json(itemOf(issue));
    const done = Object.keys(patch).length ? await call('PATCH', `issues/${n}`, patch) : issue;
    // one comment that says what happened and who did it (the token writes for everybody)
    await call('POST', `issues/${n}/comments`, { body: [comment, notes.length ? `<sub>${notes.join(' · ')} · ${who} über das Feedback-Board</sub>` : `<sub>${who} über das Feedback-Board</sub>`].filter(Boolean).join('\n\n') });
    return json(itemOf({ ...issue, ...done, ...patch, comments: (issue.comments || 0) + 1 }));
  }
  return failure(404, 'Unbekannter Weg.');
}
