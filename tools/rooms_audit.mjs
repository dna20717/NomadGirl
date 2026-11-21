// Architecture audit of the room blocks (#131/#136, Daniel 21.11.2026: „damit sie wirklich wie echte verlassene Gebäude (für Gaming
// optimiert was Höhen und Breiten angeht) aussehen“; „Ja, aber Hallen hoch lassen“; #138: „Es soll keine schwebenden Plattformen außerhalb
// von Gebäuden geben“). Per room: the clear height over every storey floor (air above a solid run of at least 6 tiles: floors and slabs,
// not furniture or platforms), how much of it is too low (under „min“ tiles: Leyla is 3 tiles tall, passages need 4), the typical storey
// height, halls without a gallery, and outdoors every platform that floats (no wall at an end, nothing under it).
// Rules of thumb in docs/features/pois.md › Architektur.
// Usage: node tools/rooms_audit.mjs [--all] [file]   (default: only rooms with findings; file = another rooms.json, e.g. an old one)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2), all = args.includes('--all'), file = args.find(a => !a.startsWith('--'));
const R = JSON.parse(fs.readFileSync(file || fileURLToPath(new URL('../projects/nomadgirl/data/rooms.json', import.meta.url))));
const SOLID = new Set(['#', '$', 'B', 'A', '^', 'v', '%', 'D']), WALLISH = new Set([...SOLID, 'H']);
const MIN = 4, STOREY = [5, 6], RUN = 6, HALL = 12;
const out = [];
for (const [id, r] of Object.entries(R)) {
  const L = (r.layout || []).map(String);
  if (!L.length) continue;
  const indoor = r.indoor ?? !(r.backdrop?.image || r.backdrop?.weather);
  const h = L.length, w = Math.max(...L.map(x => x.length)), at = (x, y) => L[y]?.[x] ?? '#';
  const solid = (x, y) => SOLID.has(at(x, y));
  // width of the solid run a tile belongs to (floors and slabs are wide, furniture is narrow)
  const run = (x, y) => { if (!solid(x, y)) return 0; let a = x, b = x; while (solid(a - 1, y) && a > 0) a--; while (solid(b + 1, y) && b < w - 1) b++; return b - a + 1; };
  const clears = [];
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w; x++) {
    if (solid(x, y) || run(x, y + 1) < RUN) continue;
    let n = 0, yy = y;
    for (; yy >= 0 && !solid(x, yy); yy--) n++;
    if (!indoor && yy <= 0) { clears.push(99); continue; }   // outdoors the top row is the sky, not a ceiling
    if (n >= 3) clears.push(n);   // under 3 nobody stands there: no floor, just a gap above a slab
  }
  const notes = [];
  // floating platforms outdoors: a run of = needs a wall or ladder at an end, or something solid / a ladder under it
  if (!indoor) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (at(x, y) !== '=' || at(x - 1, y) === '=') continue;
    let e = x; while (at(e + 1, y) === '=') e++;
    let held = WALLISH.has(at(x - 1, y)) || WALLISH.has(at(e + 1, y));
    for (let xx = x; xx <= e && !held; xx++) if (WALLISH.has(at(xx, y + 1))) held = true;
    if (!held) notes.push(`schwebende Plattform Zeile ${y}, Spalte ${x}–${e}`);
  }
  const roofed = clears.filter(c => c < 99).sort((a, b) => a - b), low = roofed.filter(c => c < MIN).length;
  const median = roofed.length ? roofed[roofed.length >> 1] : null, share = clears.length ? Math.round(low / clears.length * 100) : 0;
  if (share >= 25) notes.push(`${share} % der Geschossböden niedriger als ${MIN} Kacheln`);
  // halls stay high (Daniel 21.11.2026) but get a gallery: a walkway (4+ tiles of = or #) 4–11 tiles over the ground floor that hangs on a
  // wall, a ladder or a pillar at one end
  let gallery = false;
  for (let y = h - 6; y >= h - 13 && y > 0 && !gallery; y--) for (let x = 1; x < w - 1 && !gallery; x++) {
    const walk = c => c === '=' || c === '#';
    if (!walk(at(x, y)) || walk(at(x - 1, y))) continue;
    let e = x; while (e < w - 1 && walk(at(e + 1, y))) e++;
    if (e - x + 1 >= 4 && e - x + 1 < w - 2 && (WALLISH.has(at(x - 1, y)) || WALLISH.has(at(e + 1, y)) || WALLISH.has(at(x, y + 1)) || WALLISH.has(at(e, y + 1))) && !solid(x, y + 1)) gallery = true;
  }
  const hall = indoor && median != null && median > HALL;
  if (hall && !gallery) notes.push(`Halle ohne Galerie: lichte Höhe meist ${median} Kacheln`);
  if (all || notes.length) out.push({ id, size: `${w}×${h}`, median, notes: [...notes, ...(all && hall && gallery ? ['Halle mit Galerie'] : []), ...(all && !indoor ? ['draußen'] : [])] });
}
for (const o of out) console.log(`${o.id.padEnd(20)} ${String(o.size).padEnd(8)} Höhe ${o.median ?? 'offen'}  ${o.notes.join(' · ')}`);
console.log(`\n${out.length} Räume ${all ? 'insgesamt' : 'mit Hinweisen'} · Geschosshöhe als Faustregel ${STOREY.join('–')} Kacheln, Durchgänge mindestens ${MIN}, Hallen mit Galerie, draußen nichts Schwebendes`);
