// NomadGirl – mega rigs (#022): truck, crawler and fatbird built from a shared kit on a grid of places.
// Pure geometry, runs in the browser and in Node. buildMegarig() turns a vehicle from the area „Mega-Rigs“ into
// a walkable room layout (engine/room.js legend) plus a list of pieces the game draws (game/play/megarig_view.js).
//
// Grid (Daniel, 14.11.2026: Platz-Raster wie die Container): a place is `grid.place` tiles wide, a story `grid.story` tiles high.
// Stories count from the bottom of the hull: story 0 stands on `hull.under` tiles above the ground (trailer bed, top of the tracks,
// hover height). The first `hull.inside` stories lie inside the hull (rooms = containers without a skin), all above are built on top.
// Heights are in tiles above the ground surface; rows are layout rows (top = 0).

export const MEGARIG_KINDS = [['truck', 'LKW (Sattelzug)'], ['crawler', 'Crawler'], ['airship', 'Fatbird']];
export const ADDON_AT = [['roof', 'Auf dem Dach'], ['wall', 'An der Wand'], ['ground', 'Auf dem Boden']];
export const ADDON_CODE = [['', 'Bild'], ['crane', 'Kran (kletterbar)'], ['mast', 'Antennenmast (kletterbar)'], ['banner', 'Banner'], ['neon', 'Neon-Schild'],
  ['sail', 'Sonnensegel (begehbar)'], ['balcony', 'Balkon (begehbar)'], ['beacon', 'Positionslicht'], ['tower', 'Bohrturm (kletterbar)']];
export const ADDON_WALK = [['', 'nur Deko'], ['platform', 'Oberseite begehbar'], ['ladder', 'Leiter']];

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null && v !== undefined ? Number(v) : d);

// → { W, H, G, rows, layout, start, x0, len, places, stage, pieces, problems }
export function buildMegarig(data, id, stageIndex = null) {
  const V = data?.megarigs?.[id];
  if (!V) return null;
  const problems = [];
  const P = num(V.grid?.place, 7), S = num(V.grid?.story, 6), H0 = V.hull || {};
  const stages = V.stages?.length ? V.stages : [{ name: 'Start', mids: 1, top: 1 }];
  const si = Math.max(0, Math.min(stages.length - 1, stageIndex ?? stages.length - 1)), stage = stages[si];
  const kind = V.kind || 'crawler', under = num(H0.under, kind === 'truck' ? 3 : 4), inside = num(H0.inside, kind === 'truck' ? 0 : 1);
  const frames = num(H0.frame, 0), segPlaces = num(H0.segPlaces, 2), mids = Math.max(0, num(stage.mids, 1));
  const front = num(H0.front, 8), back = num(H0.back, 3), places = mids * segPlaces, len = front + places * P + back;
  const top = Math.max(0, num(stage.top, 1)), stories = inside + top;
  const envelope = kind === 'airship' ? num(H0.envelope, 9) : 0;
  const margin = 16, sky = 8, groundRows = 3;
  const W = margin * 2 + len, contentH = under + stories * S + envelope + (kind === 'crawler' ? 6 : 0);
  const H = sky + contentH + groundRows, G = H - groundRows, x0 = margin;
  const tiles = Array.from({ length: H }, (_, y) => Array.from({ length: W }, () => (y >= G ? '#' : '.')));
  const rowOf = h => Math.round(G - h);   // the tile row whose top edge sits at height h
  const set = (x, y, c, keep = null) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < G && !(keep && keep.includes(tiles[y][x]))) tiles[y][x] = c; };
  const fill = (x, y, w, h, c, keep) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c, keep); };
  const ladder = (x, yTop, yBottom) => { for (let y = yTop; y <= yBottom; y++) set(x, y, 'H'); };
  const pieces = [];
  const placeX = p => x0 + front + p * P;
  const floorH = s => under + s * S;   // floor surface height of story s
  const slab = s => rowOf(floorH(s));   // row of the floor slab of story s

  // ---------- the raw vehicle ----------
  const hullTop = floorH(inside);   // deck surface on top of the hull
  pieces.push({ type: 'hull', kind, x: x0, len, front, back, under, inside, frames, P, S, hullTop, G, places, paint: V.paint || {}, look: H0.look || null,
    lookScale: num(H0.lookScale, 4), lookOffset: H0.lookOffset || [0, 0], envelope, stage: si });
  if (kind === 'truck') {
    // trailer bed: one solid slab at the deck height from the fifth wheel to the end; the cab image stands in front (walk rects from the data)
    fill(x0 + front - 1, slab(0), places * P + back + 1, 1, '#');
    ladder(x0 + len - 2, slab(0), G - 1);
  } else if (kind === 'crawler') {
    // hull body: stories inside the hull are solid plating, rooms cut into it; deck on top; a bridge on the cab
    for (let s = 0; s < inside; s++) fill(x0 + front, rowOf(floorH(s + 1)) + 1, places * P, S - 1, '#');
    for (let s = 0; s <= inside; s++) fill(x0 + 2, slab(s), len - 2, 1, '#');
    // cab: bridge room one story above the deck, open to walk through
    const cabTop = hullTop + S;
    fill(x0 + 2, rowOf(hullTop) + 1, front - 2, inside * S - 1, '#');   // cab block below the deck
    fill(x0 + 2, rowOf(cabTop), front - 3, 1, '=');   // cab roof
    ladder(x0 + front - 2, rowOf(cabTop), slab(inside) - 1);
    // the bridge (#024, Daniel: „Fahrerkabine alleine sollte Platz für mindestens einen großen Container haben“): a room behind the nose
    pieces.push({ type: 'bridge', x: x0 + 5, w: front - 7, y: rowOf(cabTop) + 1, floorRow: slab(inside), name: H0.bridge || 'Kommandobrücke' });
    // the back end and ladders from the ground
    fill(x0 + len - back, rowOf(hullTop) + 1, back, inside * S - 1, '#');
    ladder(x0 + len - 1, slab(inside), G - 1);
    ladder(x0 + 1, slab(inside), G - 1);
  } else if (kind === 'airship') {
    // fuselage: frame stories (open girders, containers hang there), then closed decks; the gas envelope rides on top
    for (let s = 0; s <= inside; s++) fill(x0 + 2, slab(s), len - 3, 1, s < frames ? '=' : '#');
    for (let s = frames; s < inside; s++) fill(x0 + front, rowOf(floorH(s + 1)) + 1, places * P, S - 1, '#');
    fill(x0 + 2, rowOf(hullTop) + 1, front - 2, (inside - frames) * S - 1, '#');
    fill(x0 + len - back, rowOf(hullTop) + 1, back - 1, (inside - frames) * S - 1, '#');
    // winch: a rope ladder from the frame to the ground in the middle
    ladder(x0 + front + Math.floor(places * P / 2), slab(0), G - 1);
    // rotor nacelles front and back on outriggers: walkable tops
    const ry = rowOf(hullTop + 4), rw = 11;   // #024: bigger rotors
    fill(x0 - 7, ry, rw, 1, '=');
    fill(x0 + len - 4, ry, rw, 1, '=');
    pieces.push({ type: 'rotor', x: x0 - 7, w: rw, y: ry }, { type: 'rotor', x: x0 + len - 4, w: rw, y: ry });
    // envelope catwalk + ladder up its back
    const cat = rowOf(hullTop + envelope);
    fill(x0 + front, cat, places * P, 1, '=');
    ladder(x0 + len - back - 1, cat, slab(0) - 1);   // one long ladder: frame → decks → envelope
  }
  // extra walk rects from the data (truck cab roof, steps): x from the front, y = height above the ground, in tiles
  for (const w of V.walk || []) {
    const k = w.kind === 'ladder' ? 'H' : w.kind === 'solid' ? '#' : '=';
    const wx = x0 + num(w.x, 0), top = rowOf(num(w.y, 0) + num(w.h, 1));
    if (k === 'H') ladder(wx, top, rowOf(num(w.y, 0)) - 1);
    else fill(wx, top, Math.max(1, num(w.w, 1)), Math.max(1, num(w.h, 1)), k);
  }

  // ---------- modules (containers and rooms) ----------
  const placed = [];
  for (const [i, m] of (V.modules || []).entries()) {
    if (num(m.from, 0) > si) continue;
    const C = data.containers?.[m.container];
    if (!C) { problems.push(['error', `Modul ${i + 1}: Container „${m.container}“ fehlt`]); continue; }
    const n = num(C.places, 1), p = num(m.place, 0), s = num(m.story, 0);
    if (p < 0 || p + n > places) continue;   // not built yet at this stage (fewer segments)
    if (s >= stories || s < 0) continue;
    const insideHull = s < inside, shell = m.shell ?? !insideHull;
    const clash = placed.find(o => o.s === s && o.p < p + n && p < o.p + o.n);
    if (clash) { problems.push(['warning', `Modul ${i + 1} überlappt Modul ${clash.i + 1}`]); continue; }
    placed.push({ i, p, n, s, insideHull, shell, container: m.container, name: m.name || C.name, color: m.color || null });
  }
  const at = new Map(placed.flatMap(o => Array.from({ length: o.n * P }, (_, k) => [`${o.s}:${placeX(o.p) + k}`, o])));
  for (const o of placed) {
    const x = placeX(o.p), w = o.n * P, fr = slab(o.s), roof = slab(o.s + 1);
    pieces.push({ type: o.shell ? 'container' : 'room', x, w, y: roof + 1, h: S - 1, floorRow: fr, story: o.s, inside: o.insideHull, container: o.container, name: o.name, places: o.n, color: o.color });
    if (o.insideHull) {
      fill(x, roof + 1, w, S - 1, '.', ['H']);   // cut the room out of the hull plating (ladders stay)
      // hatch: a shaft from the deck down into the room, through every hull story above it
      ladder(x + (o.p % 2 ? w - 2 : 1), slab(inside), fr - 1);
    } else {
      fill(x, fr, w, 1, '=', ['#', 'H']);
      fill(x, roof, w, 1, '=', ['#', 'H']);   // the roof: walkable, the floor of the story above
      // way up from the floor below: a ladder at one end that stands on something
      const below = o.s <= inside;   // stands on the deck (or the trailer bed)
      const cands = o.s % 2 ? [x + w - 2, x + 1] : [x + 1, x + w - 2];
      const lx = cands.find(cx => below || at.has(`${o.s - 1}:${cx}`));
      if (lx !== undefined && o.s > inside) ladder(lx, fr, slab(o.s - 1) - 1);
      else if (lx === undefined) problems.push(['warning', `${o.name} (Stockwerk ${o.s}) hat keinen Weg nach oben: darunter steht nichts`]);
    }
  }

  // ---------- add-ons (shared kit) ----------
  for (const [i, a] of (V.addons || []).entries()) {
    if (num(a.from, 0) > si) continue;
    const A = data.rigAddons?.[a.addon];
    if (!A) { problems.push(['error', `Anbauteil ${i + 1}: „${a.addon}“ fehlt`]); continue; }
    const p = num(a.place, 0), s = num(a.story, 0);
    if (p < -1 || p > places) continue;
    if (s > stories) continue;
    const cx = (p < 0 ? x0 + front / 2 : placeX(p) + P / 2) + num(a.shift, 0);
    const h = floorH(s), w = num(A.size?.[0], 2), hh = num(A.size?.[1], 2);
    const where = a.at || A.at || 'roof';
    const base = where === 'wall' ? h + S / 2 : h;
    pieces.push({ type: 'addon', id: a.addon, code: A.code || '', look: A.look || null, crop: A.crop || null, flip: !!a.flip, cx, base: rowOf(base), w, h: hh, at: where, color: a.color || A.color || null, text: a.text || A.text || '' });
    const walk = A.walk || '';
    // a roof part needs something to stand on (deck, container roof, trailer bed)
    if (where === 'roof' && !['#', '=', 'H'].includes(tiles[rowOf(base)]?.[Math.round(cx)])) problems.push(['warning', `Anbauteil ${i + 1} (${A.name || a.addon}) steht auf Luft: Platz ${p}, Stockwerk ${s}`]);
    if (walk === 'ladder') {   // climbable: a small platform on top, a lookout
      ladder(Math.round(cx), rowOf(base + hh), rowOf(base) - 1);
      fill(Math.round(cx - Math.max(3, w) / 2), rowOf(base + hh), Math.max(3, Math.round(w)), 1, '=', ['#', 'H']);
    }
    else if (walk === 'platform') fill(Math.round(cx - w / 2), rowOf(base + hh), Math.max(1, Math.round(w)), 1, '=', ['#', 'H']);
  }

  const start = [6, G - 1];
  tiles[start[1]][start[0]] = 'L';
  const rows = tiles.map(r => r.join(''));
  // reachability (design.md: „Der Bau-Modus prüft die Erreichbarkeit“): every module needs a way there from the ground
  const seen = reach(tiles, start);
  for (const pc of pieces.filter(q => q.type === 'container' || q.type === 'room')) {
    const ok = Array.from({ length: pc.w }, (_, k) => pc.x + k).some(x => seen.has(`${x},${pc.floorRow - 1}`));
    pc.reachable = ok;
    if (!ok) problems.push(['warning', `${pc.name} (Platz ${(pc.x - x0 - front) / P}, Stockwerk ${pc.story}) ist nicht erreichbar`]);
  }
  return { W, H, G, rows, layout: rows, start, x0, len, places, stories, stage: si, stageName: stage.name || `Stufe ${si + 1}`, stages: stages.map(s => s.name), pieces, problems, P, S, kind };
}

// Which cells can Leyla reach from her start? Coarse model of her moves: walk, fall, jump up to 2 tiles high and 3 wide,
// climb ladders, drop through platforms. → Set of "x,y" cells she can stand in (or hang on a ladder).
export function reach(tiles, start, jumpUp = 2, jumpFar = 3) {
  const h = tiles.length, w = tiles[0]?.length || 0;
  const t = (x, y) => (x < 0 || x >= w || y < 0 || y >= h ? '#' : tiles[y][x]);
  const solid = (x, y) => t(x, y) === '#';
  const free = (x, y) => !solid(x, y);
  const stand = (x, y) => free(x, y) && (t(x, y) === 'H' || solid(x, y + 1) || t(x, y + 1) === '=' || t(x, y + 1) === 'H');
  const land = (x, y) => { while (y < h && free(x, y) && !stand(x, y)) y++; return stand(x, y) ? [x, y] : null; };
  const seen = new Set(), todo = [];
  const push = c => { if (c && !seen.has(c[0] + ',' + c[1])) { seen.add(c[0] + ',' + c[1]); todo.push(c); } };
  push(land(start[0], start[1]));
  while (todo.length) {
    const [x, y] = todo.pop();
    for (const d of [-1, 1]) if (free(x + d, y)) push(land(x + d, y));
    if (t(x, y) === 'H' || t(x, y - 1) === 'H') { if (free(x, y - 1)) push([x, y - 1]); }
    if (t(x, y + 1) === 'H') push([x, y + 1]);
    if (t(x, y + 1) === '=' || t(x, y + 1) === 'H') { if (free(x, y + 2)) push(land(x, y + 2)); }   // drop through
    for (let up = 1; up <= jumpUp; up++) {   // jump: straight up through empty cells or platforms, then sideways
      if (solid(x, y - up)) break;
      for (let dx = -jumpFar; dx <= jumpFar; dx++) {
        let clear = true;
        for (let i = 1; i <= Math.abs(dx); i++) if (solid(x + Math.sign(dx) * i, y - up)) { clear = false; break; }
        if (clear && stand(x + dx, y - up)) push([x + dx, y - up]);
      }
    }
    for (const dx of [-3, -2, 2, 3]) {   // jump across at the same height or lower
      let clear = true;
      for (let i = 1; i <= Math.abs(dx); i++) if (solid(x + Math.sign(dx) * i, y - 1)) { clear = false; break; }
      if (clear && free(x + dx, y)) push(land(x + dx, y));
    }
  }
  return seen;
}

// validation for the area „Mega-Rigs“: the modules fit, the stages make sense
export function megarigProblems(data, id) {
  const V = data?.megarigs?.[id];
  if (!V) return [];
  const out = [];
  for (let i = 0; i < (V.stages?.length || 1); i++) {
    const b = buildMegarig(data, id, i);
    for (const [k, t] of b?.problems || []) out.push([k, `${b.stageName}: ${t}`]);
  }
  return [...new Map(out.map(p => [p[1], p])).values()];
}
