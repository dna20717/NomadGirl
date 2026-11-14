#!/usr/bin/env node
// All browser tests in one go (#017: the local server kept dying between tool calls). Uses a running server on :8766 if there is one,
// else starts its own static server for the run (same files as `npm run serve`), runs every tools/*_test.mjs one after the other,
// prints one line per test and a summary; exit code 1 if any failed.
//   node tools/test_all.mjs [name …]      e.g. node tools/test_all.mjs camp enemy   (default: all)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8766, TIMEOUT = 400_000;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.webm': 'video/webm', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.txt': 'text/plain', '.hex': 'text/plain' };

const up = () => new Promise(ok => { const q = http.get(`http://localhost:${PORT}/game.html`, r => { r.resume(); ok(r.statusCode === 200); }); q.on('error', () => ok(false)); q.setTimeout(1500, () => { q.destroy(); ok(false); }); });
let server = null;
if (!(await up())) {
  server = http.createServer((q, res) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, path.normalize(p));
    if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
    fs.stat(f, (e, st) => {
      if (e || !st.isFile()) { res.writeHead(404); return res.end('nicht gefunden'); }
      const range = q.headers.range && /bytes=(\d*)-(\d*)/.exec(q.headers.range);   // videos (Feldhandbuch-Clips) want ranges
      const type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
      if (range) {
        const a = range[1] ? +range[1] : 0, b = range[2] ? +range[2] : st.size - 1;
        res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 });
        return fs.createReadStream(f, { start: a, end: b }).pipe(res);
      }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
      fs.createReadStream(f).pipe(res);
    });
  });
  await new Promise(ok => server.listen(PORT, ok));
  console.log(`(eigener Server auf :${PORT})`);
}

const want = process.argv.slice(2);
const tests = fs.readdirSync(path.join(root, 'tools')).filter(f => f.endsWith('_test.mjs') && (!want.length || want.some(w => f.startsWith(w)))).sort();
const results = [];
for (const t of tests) {
  const t0 = Date.now();
  const r = await new Promise(ok => {
    const p = spawn(process.execPath, [path.join('tools', t)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
    const kill = setTimeout(() => { p.kill('SIGKILL'); out += '\nZeitüberschreitung'; }, TIMEOUT);
    p.on('close', code => { clearTimeout(kill); ok({ code, out }); });
  });
  const lines = r.out.trim().split('\n'), last = lines.at(-1) || '';
  const fails = lines.filter(l => /✖|✗|FEHLER|^Fehler|Error|Zeitüberschreitung/.test(l));
  const ok = r.code === 0 && !/[1-9]\d* Fehler/.test(last) && !fails.some(l => /✖|✗|FEHLER /.test(l));
  results.push({ t, ok, last, fails });
  console.log(`${ok ? '✔' : '✖'} ${t.replace('.mjs', '').padEnd(22)} ${String(Math.round((Date.now() - t0) / 1000)).padStart(3)} s  ${last.slice(0, 110)}`);
  if (!ok) for (const l of fails.slice(0, 6)) console.log('      ' + l.slice(0, 300));
}
server?.close();
const bad = results.filter(r => !r.ok);
console.log(`\n${results.length - bad.length} von ${results.length} Browser-Tests grün${bad.length ? `, rot: ${bad.map(r => r.t).join(', ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
