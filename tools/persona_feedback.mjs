// Testing-Personas (docs/testing_personas.md) report through the real feedback form (#181), like Daniel and Steven
// (Daniel, 26.11.2026: „ihre Befunde posten sie wie ich oder Steven über das Formular, damit es konsistent ist“).
//
// 1) Report: headless game with the persona's screen and device, optional steps, then F8 → chip → text → „Abschicken“ (real clicks
//    and keys in the real dialog). With a worker behind GAME_URL the form sends it itself; without one the request the form makes is
//    caught and kept as output/persona/<time>_<persona>/payload.json.
//      node tools/persona_feedback.mjs --persona ole --chip bug --text "…" [--url <game url>] [--do "<js before the report>"] [--live]
// 2) Post a kept report into a clone of FeedbackBucket (Ava creates the issue first and passes its number):
//      node tools/persona_feedback.mjs --post <payload.json> --number <n> --bucket ../feedbackbucket
//    writes media/nomadgirl/FB-<n>/trace.json + moment.* and prints title, labels and body (same issueBody as the worker) to issue.md.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { issueBody, shotName } from '../worker/feedback.js';

export const PERSONAS = {
  jana: { name: 'Jana', viewport: [1366, 768], pad: false },
  malu: { name: 'Malu', viewport: [1920, 1080], pad: true },
  ole: { name: 'Ole', viewport: [1720, 720], pad: true },   // ultrawide 21:9
  deniz: { name: 'Deniz', viewport: [1600, 900], pad: false },
  kai: { name: 'Kai', viewport: [1920, 1080], pad: true },
};
const CHIP_LABEL = { gut: 'Gut', schlecht: 'Schlecht', bug: 'Bug', idee: 'Idee', verwirrend: 'Verwirrend' };

const args = process.argv.slice(2), opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; }, flag = k => args.includes('--' + k);

if (opt('post')) post(); else await report();

async function report() {
  const id = opt('persona'), P = PERSONAS[id], chip = opt('chip'), text = opt('text') || '';
  if (!P) throw new Error(`--persona: ${Object.keys(PERSONAS).join(', ')}`);
  if (chip && !CHIP_LABEL[chip]) throw new Error(`--chip: ${Object.keys(CHIP_LABEL).join(', ')}`);
  if (!chip && !text.trim()) throw new Error('--chip oder --text');
  const url = opt('url') || process.env.GAME_URL || 'http://localhost:8766/game.html?camp';
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: P.viewport[0], height: P.viewport[1] } });
  page.on('pageerror', e => console.log('Seitenfehler:', e.message));
  if (P.pad) await page.addInitScript(() => {   // the persona plays with a controller (an idle Xbox pad, so the trace and the form know it)
    const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [pad, null, null, null];
  });
  let caught = null;
  if (!flag('live')) await page.route('**/api/feedback', async r => {   // no worker here: keep exactly what the form sends
    caught = r.request().postDataJSON();
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ number: 0, url: '' }) });
  });
  await page.goto(url);
  await page.waitForFunction(() => { try { return window.nomad?.state?.() && window.nomadFeedback; } catch { return false; } }, null, { timeout: 60000 });
  const steps = opt('do');
  await page.evaluate(async js => { nomad.take(); nomad.step(30); if (js) await eval(js); nomad.step(60); nomad.release(); }, steps || '');
  await page.waitForTimeout(1500);   // a moment of real frames, so the picture and the trace are live
  await page.keyboard.press('F8');
  await page.waitForSelector('.fb-text', { timeout: 15000 });
  if (chip) await page.click(`.fb-chip[data-chip="${chip}"]`);
  if (text) { await page.click('.fb-text'); await page.keyboard.type(text, { delay: 2 }); }
  await page.click('.fb-send');
  await page.waitForFunction(() => !document.querySelector('.fb-text'), null, { timeout: 30000 });
  if (!flag('live')) {
    if (!caught) throw new Error('Das Formular hat nichts geschickt');
    const dir = path.join('output', 'persona', `${new Date().toISOString().replace(/[:.]/g, '-')}_${id}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'payload.json'), JSON.stringify({ ...caught, persona: id }, null, 1));
    console.log(`Befund von ${P.name} (${caught.chip || '–'} · ${caught.where}) → ${dir}/payload.json`);
  } else console.log(`Befund von ${P.name} an den Worker geschickt`);
  await browser.close();
}

function post() {
  const file = opt('post'), n = Number(opt('number')), bucket = opt('bucket');
  if (!n || !bucket) throw new Error('--number und --bucket');
  const b = JSON.parse(fs.readFileSync(file, 'utf8')), P = PERSONAS[b.persona];
  const repo = 'dna20717/FeedbackBucket', dir = `media/nomadgirl/FB-${n}`, abs = path.join(bucket, dir);
  fs.mkdirSync(abs, { recursive: true });
  const { persona, ...form } = b;
  fs.writeFileSync(path.join(abs, 'trace.json'), JSON.stringify({ ...form, shot: undefined, number: n }, null, 1) + '\n');
  if (b.shot) fs.writeFileSync(path.join(abs, shotName(b.shot)), Buffer.from(b.shot.replace(/^data:[^,]*,/, ''), 'base64'));
  const head = `${CHIP_LABEL[b.chip] || 'Feedback'} · ${b.where || 'unterwegs'}`;
  const body = issueBody(form, { name: `Persona ${P?.name || persona} (Ava)` }, { number: n, repo, dir });
  const out = path.join(path.dirname(file), 'issue.md');
  fs.writeFileSync(out, `title: FB-${n} · ${head}\nlabels: nomadgirl${b.chip ? ', ' + b.chip : ''}, persona\n\n${body}\n`);
  console.log(`FB-${n}: Bild und Spur in ${abs}, Issue-Text in ${out}`);
}
