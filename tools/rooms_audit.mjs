// Architecture audit of the room blocks (#131, Daniel 21.11.2026: „damit sie wirklich wie echte verlassene Gebäude (für Gaming optimiert
// was Höhen und Breiten angeht) aussehen“). Per room: the clear height over every walkable floor tile (air above solid), how much of the
// floor is too low (under „min“ tiles: Leyla is 3 tiles tall, a jump needs 4+), the typical storey height, wide rooms without any
// floor in between. Rules of thumb in docs/features/pois.md › Architektur.
// Usage: node tools/rooms_audit.mjs [--all]   (default: only rooms with findings)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../projects/nomadgirl/data/', import.meta.url));
const R = JSON.parse(fs.readFileSync(root + 'rooms.json'));
const SOLID = new Set(['#', '$', 'B', 'A', '^', 'v', '%']);
const MIN = 4, STOREY = [5, 6], all = process.argv.includes('--all');
const out = [];
for (const [id, r] of Object.entries(R)) {
  const L = (r.layout || []).map(String);
  if (!L.length) continue;
  const h = L.length, w = Math.max(...L.map(x => x.length)), at = (x, y) => L[y]?.[x] ?? '#';
  const solid = (x, y) => SOLID.has(at(x, y)), floor = (x, y) => !solid(x, y) && (solid(x, y + 1) || at(x, y + 1) === '=');
  const clears = [];
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w; x++) if (floor(x, y)) {
    let n = 0;
    for (let yy = y; yy >= 0 && !solid(x, yy); yy--) n++;
    clears.push(n === y + 1 && !solid(x, 0) ? 99 : n);   // open to the sky above the room: no ceiling
  }
  if (!clears.length) continue;
  const roofed = clears.filter(c => c < 99).sort((a, b) => a - b), low = roofed.filter(c => c < MIN).length;
  const median = roofed.length ? roofed[roofed.length >> 1] : null, share = Math.round(low / clears.length * 100);
  const notes = [];
  if (share >= 25) notes.push(`${share} % des Bodens niedriger als ${MIN} Kacheln`);
  if (median != null && median > 12 && (r.indoor ?? true)) notes.push(`Halle: lichte Höhe meist ${median} Kacheln`);
  if (all || notes.length) out.push({ id, name: r.name, size: `${w}×${h}`, median, notes });
}
for (const o of out) console.log(`${o.id.padEnd(20)} ${String(o.size).padEnd(8)} Höhe ${o.median ?? 'offen'}  ${o.notes.join(' · ')}`);
console.log(`\n${out.length} Räume ${all ? 'insgesamt' : 'mit Hinweisen'} · Geschosshöhe als Faustregel ${STOREY.join('–')} Kacheln, Durchgänge mindestens ${MIN}`);
