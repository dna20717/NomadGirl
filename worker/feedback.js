// Feedback for the test phase (#181): POST /api/feedback → an issue in the private repo FeedbackBucket, the picture and the trace
// as one commit there (media/nomadgirl/FB-<n>/). NomadGirl's own repository gets nothing. Same token as the workshop
// (GITHUB_TOKEN, fine-grained: FeedbackBucket with Contents + Issues read/write). FEEDBACK_REPO overrides the target.
// body: { chip, text, where, context, reproduce, trace, shot: dataURL|null, at } → { number, url }
const GITHUB = 'https://api.github.com';
const CHIPS = { gut: '👍 Gut', schlecht: '👎 Schlecht', bug: '🐞 Bug', idee: '💡 Idee', verwirrend: '😵 Verwirrend' };
export const FEEDBACK_SHOT_MAX = 400 * 1024, FEEDBACK_TRACE_MAX = 1024 * 1024;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const failure = (status, message) => json({ error: message }, status);
const clean = (t, n) => String(t ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, n);
function api(env, fetchFn) {
  const repo = env.FEEDBACK_REPO || 'dna20717/FeedbackBucket';
  const call = async (method, path, body) => {
    const r = await fetchFn(`${GITHUB}/repos/${repo}/${path}`, {
      method,
      headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'nomadgirl-feedback', 'x-github-api-version': '2022-11-28', ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = r.status === 204 ? null : await r.json().catch(() => null);
    if (!r.ok) throw Object.assign(new Error(`FeedbackBucket: GitHub ${method} ${path}: ${r.status} ${data?.message || ''}`.trim()), { status: 502, github: r.status });
    return data;
  };
  return { call, repo };
}

export const shotName = d => `moment.${/^data:image\/(\w+)/.exec(d)?.[1]?.replace('jpeg', 'jpg') || 'webp'}`;

export function checkFeedback(b) {
  if (!b || typeof b !== 'object') return 'Kein Feedback.';
  if (b.chip != null && !CHIPS[b.chip]) return `Unbekannte Art: ${b.chip}`;
  if (!b.chip && !String(b.text || '').trim()) return 'Bitte eine Art wählen oder etwas schreiben.';
  if (b.shot != null && !/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(b.shot)) return 'Bild ungültig.';
  if (b.shot && b.shot.length * 3 / 4 > FEEDBACK_SHOT_MAX) return 'Bild zu groß.';
  if (JSON.stringify(b.trace ?? null).length > FEEDBACK_TRACE_MAX) return 'Spur zu groß.';
  return null;
}

const cell = v => String(v ?? '–').replace(/\|/g, '/').replace(/\n/g, ' ');
export function issueBody(b, user, { number, repo, dir }) {
  const c = b.context || {}, t = b.trace || {}, link = f => `https://github.com/${repo}/blob/main/${dir}/${f}`;
  const rows = [['Modus', c.mode], ['POI', c.poi && `${c.poi} · Seed ${c.seed}`], ['Raum', c.room], ['Ort', c.place], ['Kachel', c.tile?.join(', ')], ['Leben', c.health], ['Fenster', c.window],
    ['Durchgang / Tag', c.cycle != null ? `${c.cycle} / ${c.day ?? '–'}` : null], ['Slot', c.slot], ['Version', c.version], ['Daten', c.data], ['Datenset', c.set], ['Controller', c.pad], ['Bildschirm', c.screen], ['Browser', c.browser], ['Adresse', c.url],
    ['fps', t.fps ? `${t.fps.avg} (schlimmster Frame ${t.fps.worstMs} ms)` : null]].filter(([, v]) => v != null && v !== '');
  const errors = (t.errors || []).slice(-5);
  return [
    `**${CHIPS[b.chip] || 'Feedback'}** · ${cell(b.where)}`,
    '',
    b.text ? b.text.split('\n').map(l => `> ${l}`).join('\n') : '_(kein Text)_',
    '',
    b.shot ? `![Moment](${link(shotName(b.shot))}?raw=true)` : '_(kein Bild)_',
    '',
    '| | |', '|---|---|', ...rows.map(([k, v]) => `| ${k} | ${cell(v)} |`),
    '',
    b.reproduce ? `**Nachspielen**\n\`\`\`sh\n${clean(b.reproduce, 600)}\n\`\`\`` : '',
    `**Spur** (${t.seconds ?? '?'} s): [trace.json](${link('trace.json')}) · ${t.samples?.length ?? 0} Zustände, ${t.inputs?.length ?? 0} Eingabe-Wechsel, ${t.events?.length ?? 0} Ereignisse, ${t.errors?.length ?? 0} Fehler`,
    errors.length ? `\n**Fehler**\n${errors.map(e => `- \`${cell(e.message).slice(0, 300)}\`${e.count > 1 ? ` (${e.count}×)` : ''}`).join('\n')}` : '',
    '',
    `<sub>FB-${number} · gemeldet von ${cell(user.name)} · ${cell(b.at || new Date().toISOString())}</sub>`,
  ].join('\n');
}

export async function feedback(b, env, user, fetchFn) {
  const bad = checkFeedback(b);
  if (bad) return failure(bad.includes('groß') ? 413 : 400, bad);
  b = { ...b, text: clean(b.text, 4000), where: clean(b.where, 200) };
  const { call, repo } = api(env, fetchFn);
  const head = `${CHIPS[b.chip]?.replace(/^\S+ /, '') || 'Feedback'} · ${b.where || 'unterwegs'}`;
  const issue = await call('POST', 'issues', { title: `FB · ${head}`, body: '_wird angelegt …_', labels: ['nomadgirl', ...(b.chip ? [b.chip] : [])] });
  const n = issue.number, dir = `media/nomadgirl/FB-${n}`;
  // picture + trace as one commit in the bucket
  const files = [{ path: `${dir}/trace.json`, mode: '100644', type: 'blob', content: JSON.stringify({ ...b, shot: undefined, number: n }, null, 1) + '\n' }];
  if (b.shot) { const blob = await call('POST', 'git/blobs', { content: b.shot.replace(/^data:[^,]*,/, ''), encoding: 'base64' }); files.push({ path: `${dir}/${shotName(b.shot)}`, mode: '100644', type: 'blob', sha: blob.sha }); }
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await call('GET', 'git/ref/heads/main'), parent = await call('GET', `git/commits/${ref.object.sha}`);
    const tree = await call('POST', 'git/trees', { base_tree: parent.tree.sha, tree: files });
    const who = { name: 'NomadGirl Feedback', email: 'feedback@nomadgirl.invalid', date: new Date().toISOString() };
    const c = await call('POST', 'git/commits', { message: `FB-${n}: ${head}`, tree: tree.sha, parents: [ref.object.sha], author: who, committer: who });
    try { await call('PATCH', 'git/refs/heads/main', { sha: c.sha, force: false }); break; }
    catch (e) { if ((e.github === 422 || e.github === 409) && attempt < 2) continue; throw e; }
  }
  await call('PATCH', `issues/${n}`, { title: `FB-${n} · ${head}`, body: issueBody(b, user, { number: n, repo, dir }) });
  return json({ number: n, url: issue.html_url || `https://github.com/${repo}/issues/${n}` });
}
