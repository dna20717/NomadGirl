#!/usr/bin/env node
// Builds the web version into dist/ (served by Cloudflare as static assets, see wrangler.jsonc).
//   node tools/build_web.mjs
// dist/index.html = start page, dist/workshop.html = workshop (address /workshop), dist/game.html = game (address /game), plus game/, engine/ and the game data in projects/nomadgirl/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(repo, 'dist');

// Guard against stragglers: Cloudflare puts the build live that finishes LAST, not the newest commit.
// On Workers Builds (main only) we stop if main has moved on, so an old hanging build never overwrites a newer one.
// NOMADGIRL_HEAD_CHECK=1 forces the check locally (tests), =0 switches it off.
const GITHUB = 'dna20717/NomadGirl';
async function headOfMain() {
  try {
    const line = execSync(`git ls-remote https://github.com/${GITHUB}.git refs/heads/main`, { timeout: 20000, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (/^[0-9a-f]{40}\s/.test(line)) return { sha: line.slice(0, 40), via: 'git ls-remote' };
  } catch { /* fall through to the API */ }
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB}/commits/main`, { headers: { accept: 'application/vnd.github.sha', 'user-agent': 'nomadgirl-build' }, signal: AbortSignal.timeout(20000) });
    const sha = (await res.text()).trim();
    if (res.ok && /^[0-9a-f]{40}$/.test(sha)) return { sha, via: 'GitHub-API' };
  } catch { /* unknown */ }
  return null;
}
const built = process.env.WORKERS_CI_COMMIT_SHA;
const branch = process.env.WORKERS_CI_BRANCH;
const check = process.env.NOMADGIRL_HEAD_CHECK ?? (built && (!branch || branch === 'main') ? '1' : '0');
if (check === '1' && built) {
  const head = await headOfMain();
  if (!head) console.warn('Kopf von main nicht erreichbar (git ls-remote und GitHub-API), baue trotzdem.');
  else if (head.sha !== built) {
    console.error(`Abbruch: dieser Build ist für ${built.slice(0, 7)}, main steht schon auf ${head.sha.slice(0, 7)} (${head.via}). Der neuere Build geht live, dieser nicht.`);
    process.exit(1);
  } else console.log(`Kopf von main geprüft (${head.via}): ${built.slice(0, 7)} ist aktuell.`);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'workshop.html', 'game.html', 'LICENSE']) fs.copyFileSync(path.join(repo, f), path.join(out, f));
for (const dir of ['game', 'engine', 'projects/nomadgirl']) fs.cpSync(path.join(repo, dir), path.join(out, dir), { recursive: true });
// which build is this (shown on the start page and in the game): on Cloudflare Workers Builds the commit comes from the environment
const sha = process.env.WORKERS_CI_COMMIT_SHA || (() => { try { return execSync('git rev-parse HEAD', { cwd: repo }).toString().trim(); } catch { return 'unbekannt'; } })();
fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({ commit: sha, branch: process.env.WORKERS_CI_BRANCH || null, built: new Date().toISOString() }) + '\n');
// browsers must ask before using a cached file (ETag), so a new build is there on the next reload
fs.writeFileSync(path.join(out, '_headers'), '/*\n  Cache-Control: no-cache\n');
let count = 0;
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : count++; };
walk(out);
console.log(`dist/ gebaut: ${count} Dateien, Version ${sha.slice(0, 7)}`);
