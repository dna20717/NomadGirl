// NomadGirl – room layouts. A room's layout is a list of text rows, one character per tile.
// Runs identically in the browser (game, workshop) and in Node (validation, tests).
//
//   .  empty            #  solid (wall, floor)        =  platform (jump through from below, drop with ↓ + jump)
//   H  ladder           o  rope anchor (swinging)     L  Leyla's start
//   C  chest (POI loot)  S  switch (opens the nearest door)  D  door (solid until its switch is pulled)
//   B  brittle wall (melee breaks it, counts as a secret)  Z  goal (E = POI done, ranking)  1  random enemy of the POI
//   A  branch hook (main room: ceiling, branch room: floor)  ^  shortcut comes up here (start room floor)  v  shortcut goes down here (exit room floor)
//   any other letter or digit: spawn point, resolved via the room's spawn table (symbol → enemy)

export const TILE_LEGEND = [
  ['.', 'leer'], ['#', 'Wand/Boden'], ['=', 'Plattform (von unten durchspringbar)'],
  ['H', 'Leiter'], ['o', 'Seil-Anker zum Schwingen'], ['L', 'Leylas Start'],
  ['C', 'Kiste (Beute des POI)'], ['S', 'Schalter (öffnet die nächste Tür)'], ['D', 'Tür (zu, bis ihr Schalter umgelegt ist)'],
  ['B', 'Brüchige Wand (Nahkampf, zählt als Secret)'], ['Z', 'Ziel (E = POI geschafft)'], ['1', 'Zufälliger Gegner des POI'],
  ['A', 'Abzweig (Hauptraum: Decke, Seitenraum: Boden)'], ['^', 'Abkürzung kommt hier hoch (Boden im Eingang)'], ['v', 'Abkürzung geht hier runter (Boden im Ausgang)'],
  ['*', 'Lampe (hängt an der Decke darüber, Art aus der Atmosphäre des Raums)'],
];
// tiles that block like a wall: doors and brittle walls until opened, unused branch/shortcut markers stay wall
export const SOLID_TILES = new Set(['#', 'D', 'B', 'A', '^', 'v']);
// static walls (doors and brittle walls get their own bodies in the game, they open)
export const WALL = new Set(['#', 'A', '^', 'v']);
const FIXED = new Set(TILE_LEGEND.map(([c]) => c));

// → { w, h, rows, solid(x, y), tiles, start: [x, y] | null, spawns: [{ x, y, symbol, enemy }], ladders, anchors, platforms, problems: [text] }
// Coordinates are tile coordinates (column, row). Missing rows/columns count as empty.
export function parseRoom(room = {}) {
  const rows = (room.layout || []).map(r => String(r));
  const spawnMap = Object.fromEntries((room.spawns || []).filter(s => s.symbol).map(s => [s.symbol, s.enemy]));
  const [w0, h0] = room.size || [];
  const w = w0 || Math.max(0, ...rows.map(r => r.length)), h = h0 || rows.length;
  const problems = [], start = [], spawns = [], ladders = [], anchors = [], platforms = [], unknown = new Set();
  const marks = { C: [], S: [], D: [], B: [], Z: [], 1: [], A: [], '^': [], v: [], '*': [] };
  const tiles = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => rows[y]?.[x] ?? '.'));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = tiles[y][x];
    if (c === 'L') start.push([x, y]);
    else if (c === 'H') ladders.push([x, y]);
    else if (c === 'o') anchors.push([x, y]);
    else if (c === '=') platforms.push([x, y]);
    else if (marks[c]) marks[c].push([x, y]);
    else if (!FIXED.has(c)) {
      if (spawnMap[c]) spawns.push({ x, y, symbol: c, enemy: spawnMap[c] });
      else unknown.add(c);
    }
  }
  if (rows.length) {
    if (rows.length !== h) problems.push(['warning', `Layout hat ${rows.length} Zeilen, Größe sagt ${h}`]);
    const wrong = rows.map((r, i) => [i + 1, r.length]).filter(([, n]) => n !== w);
    if (wrong.length) problems.push(['warning', `Layout-Zeilen mit falscher Breite (soll ${w}): ${wrong.slice(0, 5).map(([i, n]) => `Zeile ${i} hat ${n}`).join(', ')}${wrong.length > 5 ? ' …' : ''}`]);
    if (!start.length && (room.tags || ['start']).includes('start')) problems.push(['hint', 'Layout ohne Leylas Start (L)']);
    if (start.length > 1) problems.push(['warning', `Layout hat ${start.length} Starts (L)`]);
    if (unknown.size) problems.push(['error', `Unbekannte Zeichen im Layout: ${[...unknown].map(c => `„${c}“`).join(', ')} (in der Spawn-Tabelle eintragen)`]);
  }
  for (const s of room.spawns || []) if (s.symbol && (s.symbol.length !== 1 || FIXED.has(s.symbol))) problems.push(['error', `Spawn-Zeichen „${s.symbol}“ geht nicht (ein Zeichen, nicht ${[...FIXED].join(' ')})`]);
  if (marks.S.length && !marks.D.length) problems.push(['hint', 'Schalter (S) ohne Tür (D)']);
  if (marks.D.length && !marks.S.length) problems.push(['hint', 'Tür (D) ohne Schalter (S): bleibt zu']);
  if (marks.A.some(([, y]) => y !== 0 && y !== h - 1)) problems.push(['warning', 'Abzweig (A) gehört in die oberste Zeile (Hauptraum) oder die unterste (Seitenraum)']);
  if ([...marks['^'], ...marks.v].some(([, y]) => y !== h - 1)) problems.push(['warning', 'Abkürzung (^ v) gehört in die unterste Zeile (Boden)']);
  const solid = (x, y) => x < 0 || x >= w || y < 0 || y >= h ? true : SOLID_TILES.has(tiles[y][x]);
  return { w, h, rows, tiles, solid, start: start[0] || null, spawns, ladders, anchors, platforms, marks, problems };
}

// Merge solid tiles into few rectangles (greedy: horizontal runs, then stacked runs of equal span) → [{ x, y, w, h }] in tiles
export function solidRects(r) {
  const used = Array.from({ length: r.h }, () => new Array(r.w).fill(false)), out = [];
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    if (used[y][x] || !WALL.has(r.tiles[y][x])) continue;
    let w = 1; while (x + w < r.w && WALL.has(r.tiles[y][x + w]) && !used[y][x + w]) w++;
    let h = 1;
    grow: while (y + h < r.h) { for (let i = 0; i < w; i++) if (!WALL.has(r.tiles[y + h][x + i]) || used[y + h][x + i]) break grow; h++; }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) used[y + j][x + i] = true;
    out.push({ x, y, w, h });
  }
  return out;
}
