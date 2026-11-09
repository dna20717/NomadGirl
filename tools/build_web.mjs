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
