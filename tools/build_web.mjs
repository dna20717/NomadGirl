#!/usr/bin/env node
// Builds the web version into dist/ (served by Cloudflare as static assets, see wrangler.jsonc).
//   node tools/build_web.mjs
// dist/index.html = start page, dist/workshop.html = workshop (address /workshop), plus game/, engine/ and the game data in projects/nomadgirl/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(repo, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'workshop.html', 'LICENSE']) fs.copyFileSync(path.join(repo, f), path.join(out, f));
for (const dir of ['game', 'engine', 'projects/nomadgirl']) fs.cpSync(path.join(repo, dir), path.join(out, dir), { recursive: true });
let count = 0;
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : count++; };
walk(out);
console.log(`dist/ gebaut: ${count} Dateien`);
