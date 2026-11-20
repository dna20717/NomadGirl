// Draws the travel map (#007) on a 2D canvas: the weathered paper (PixelLab), and on it from code BigCityDelta, the roads, the places,
// the brands' billboards, a title cartouche, a compass and Leyla's red pencil around where she can drive. Used by the map window
// (game/play/map_ui.js) and the workshop preview (Reisekarte). Returns the screen position of every place for clicks and the cursor.
import { mapConfig, neighbours, hops } from './worldmap.js';

const KIND = {   // pin colour and a tiny pictogram per POI kind
  gasStation: { color: '#df3e23', glyph: 'pump' }, mall: { color: '#bc4a9b', glyph: 'cart' }, bunker: { color: '#4a5462', glyph: 'hatch' }, government: { color: '#143464', glyph: 'columns' },
  highrise: { color: '#5d6872', glyph: 'tower' }, underground: { color: '#7a4841', glyph: 'stairs' }, factory: { color: '#a36633', glyph: 'chimney' },
  settlement: { color: '#5a8a3a', glyph: 'trailer' }, ruin: { color: '#8a7a5a', glyph: 'mast' },
};
const INK = '#322b28', RED = '#b4202a';
const hashOf = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };

// world km → canvas px, fitted into the paper with a margin (the map is wider than tall)
export function mapView(D, map, W, H) {
  const C = mapConfig(D), S = C.sea, pts = [...map.nodes.map(n => n.pos), C.city, ...(S ? [[S.at[0] - S.size[0] * 0.75, S.at[1] - S.size[1] * 0.8], [S.at[0] - S.size[0] * 0.75, S.at[1] + S.size[1] * 0.8]] : [])];   // #119 the dust sea is on the map
  const x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1]));
  const mx = W * 0.13, my = H * 0.17, k = Math.min((W - 2 * mx) / Math.max(1, x1 - x0), (H - 2 * my) / Math.max(1, y1 - y0));
  const ox = (W - (x1 - x0) * k) / 2 - x0 * k, oy = (H - (y1 - y0) * k) / 2 - y0 * k + H * 0.03;
  return { k, at: p => [ox + p[0] * k, oy + p[1] * k] };
}

// opt: { paper, logos (Image), here, sel, route ([ids], #014), t (s), brands: {id: brand}, reveal }
export function drawMap(ctx, W, H, D, map, opt = {}) {
  const C = mapConfig(D), V = mapView(D, map, W, H), u = Math.min(W / 1200, H / 680), t = opt.t || 0;
  const here = opt.here, near = new Set(neighbours(map, here)), hop = hops(map, here), reveal = opt.reveal ?? C.reveal;
  const known = n => n.id === here || map.visited?.includes(n.id) || map.revealed?.includes(n.id) || (hop[n.id] ?? 99) <= reveal;   // #057 revealed places too
  const brand = id => C.brands.find(b => b.id === id);
  ctx.save();
  // paper (pixel art, scaled sharp) or a plain sheet
  ctx.imageSmoothingEnabled = false;
  if (opt.paper) ctx.drawImage(opt.paper, 0, 0, W, H); else { ctx.fillStyle = '#f4d29c'; ctx.fillRect(0, 0, W, H); }
  ctx.imageSmoothingEnabled = true;
  // BigCityDelta: a grey hatched blob with blocks, "Sperrgebiet" in red
  const [cx, cy] = V.at(C.city), cr = Math.max(26 * u, C.cityRadius * V.k);
  ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = '#8b93af';
  ctx.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, rr = cr * (0.85 + 0.25 * hashOf('c' + i)); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7); } ctx.fill();
  ctx.globalAlpha = 0.7; ctx.fillStyle = '#4a5462';
  for (let i = 0; i < 26; i++) { const a = hashOf('b' + i) * Math.PI * 2, d = Math.sqrt(hashOf('d' + i)) * cr * 0.8, s = (3 + hashOf('s' + i) * 6) * u; ctx.fillRect(cx + Math.cos(a) * d - s / 2, cy + Math.sin(a) * d * 0.7 - s / 2, s, s); }
  ctx.restore();
  label(ctx, C.cityName.toUpperCase(), cx, cy - cr * 0.62 - 6 * u, { size: 30 * u, color: RED, weight: 'bold', spacing: 3 * u });
  label(ctx, 'Sperrgebiet', cx, cy + cr * 0.62 + 16 * u, { size: 17 * u, color: RED, italic: true });
  if (C.sea) drawSea(ctx, C, V, u, t);   // #119
  // roads: a gentle curve per road, dark rim + cream core like an old road map; roads into the unknown dotted
  const P = id => map.nodes.find(n => n.id === id);
  const curve = (a, b) => { const [ax, ay] = V.at(a.pos), [bx, by] = V.at(b.pos), h = hashOf(a.id + b.id) - 0.5, nx = -(by - ay), ny = bx - ax; return [ax, ay, (ax + bx) / 2 + nx * h * 0.25, (ay + by) / 2 + ny * h * 0.25, bx, by]; };
  for (const [ia, ib] of map.edges) {
    const a = P(ia), b = P(ib); if (!a || !b) continue;
    const seen = known(a) || known(b), [ax, ay, qx, qy, bx, by] = curve(a, b);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(qx, qy, bx, by);
    if (seen) { ctx.strokeStyle = '#71413b'; ctx.lineWidth = 6 * u; ctx.setLineDash([]); ctx.stroke(); ctx.strokeStyle = '#f9a31b'; ctx.lineWidth = 3 * u; ctx.stroke(); }
    else { ctx.strokeStyle = 'rgba(113,65,59,.45)'; ctx.lineWidth = 2 * u; ctx.setLineDash([4 * u, 6 * u]); ctx.stroke(); ctx.setLineDash([]); }
  }
  // #089 Revierkrieg: fronts (roads between rival gangs) as a jagged red line with crossed blades in the middle; known roads only
  if (!opt.hideDanger) for (const f of opt.fronts || []) {
    const a = P(f.a), b = P(f.b); if (!a || !b || !(known(a) && known(b))) continue;
    const [ax, ay, qx, qy, bx, by] = curve(a, b), pt = k => [(1 - k) ** 2 * ax + 2 * (1 - k) * k * qx + k * k * bx, (1 - k) ** 2 * ay + 2 * (1 - k) * k * qy + k * k * by];
    ctx.save(); ctx.strokeStyle = 'rgba(190,35,35,.85)'; ctx.lineWidth = 2 * u; ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const k = 0.12 + 0.76 * i / 24, [x, y] = pt(k), [x2, y2] = pt(Math.min(1, k + 0.01)), dx = x2 - x, dy = y2 - y, l = Math.hypot(dx, dy) || 1, z = (i % 2 ? 1 : -1) * 5 * u; ctx.lineTo(x - dy / l * z, y + dx / l * z); }
    ctx.stroke();
    const [mx, my] = pt(0.5), s2 = 7 * u;
    ctx.fillStyle = '#fef3c0'; circle(ctx, mx, my, s2 * 1.3); ctx.strokeStyle = 'rgba(190,35,35,.95)'; ctx.lineWidth = 2.5 * u;
    ctx.beginPath(); ctx.moveTo(mx - s2 * 0.75, my - s2 * 0.75); ctx.lineTo(mx + s2 * 0.75, my + s2 * 0.75); ctx.moveTo(mx + s2 * 0.75, my - s2 * 0.75); ctx.lineTo(mx - s2 * 0.75, my + s2 * 0.75); ctx.stroke();
    ctx.restore();
  }
  // the chosen route: red pencil along the road (Leyla's marker)
  // since #014 along every leg of the way (opt.route: [here, …, sel])
  const way = opt.route?.length > 1 ? opt.route : opt.sel && near.has(opt.sel) ? [here, opt.sel] : null;
  if (way) for (let i = 1; i < way.length; i++) {
    const e = map.edges.find(([x, y]) => (x === way[i - 1] && y === way[i]) || (x === way[i] && y === way[i - 1])) || [way[i - 1], way[i]];   // the road's own bend
    const a = P(e[0]), b = P(e[1]); if (!a || !b) continue;
    const [ax, ay, qx, qy, bx, by] = curve(a, b);
    ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 4 * u; ctx.setLineDash([10 * u, 7 * u]); ctx.lineDashOffset = -t * 30 * u;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(qx, qy, bx, by); ctx.stroke(); ctx.restore();
  }
  // places (labels step aside when they would cover another one)
  const out = {}, taken = [];
  const free = (x, y, w, h) => !taken.some(b => x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y);
  for (const n of map.nodes) {
    const [x, y] = V.at(n.pos), k = n.dock ? { color: '#285cc4', glyph: 'crane' } : KIND[D.pois?.[n.poi]?.kind] || { color: INK }, isKnown = known(n), r = 10 * u;
    out[n.id] = { x, y, r: r * 2.2, known: isKnown, near: near.has(n.id) };
    if (!isKnown) { ctx.fillStyle = 'rgba(50,43,40,.35)'; circle(ctx, x, y, r * 0.8); label(ctx, '?', x, y + 5 * u, { size: 18 * u, color: '#fef3c0' }); continue; }
    // red pencil ring around where she can drive (wobbly, hand drawn)
    if (near.has(n.id)) pencilRing(ctx, x, y, r * 2 + (n.id === opt.sel ? Math.sin(t * 4) * 2 * u : 0), RED, 2.5 * u, n.id);
    ctx.fillStyle = '#fef3c0'; circle(ctx, x, y, r + 2.5 * u);
    ctx.fillStyle = k.color; circle(ctx, x, y, r);
    glyph(ctx, k.glyph, x, y, r);
    // visited: a bold red cross with a dark rim (Daniel, 13.11.2026: „mehr Kontrast“)
    if (map.visited?.includes(n.id) && n.id !== here) { const q = r * 1.35; ctx.save(); ctx.lineCap = 'round';
      for (const [col, lw] of [['#fef3c0', 9 * u], [INK, 6.5 * u], [RED, 3.5 * u]]) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x - q, y - q); ctx.lineTo(x + q, y + q); ctx.moveTo(x + q, y - q); ctx.lineTo(x - q, y + q); ctx.stroke(); }
      ctx.restore(); }
    ctx.save(); ctx.font = `${n.landmark ? 'bold' : 'normal'} ${Math.round((n.landmark ? 26 : 23) * u)}px VT323, monospace`; const tw = ctx.measureText(n.name).width; ctx.restore();
    let ly = y + r + 22 * u;
    for (const dy of [0, -(2 * r + 54 * u), 22 * u, -(2 * r + 76 * u), 44 * u]) if (free(x - tw / 2, y + r + 4 * u + dy, tw, 40 * u)) { ly = y + r + 22 * u + dy; break; }
    taken.push({ x: x - tw / 2, y: ly - 20 * u, w: tw, h: 40 * u });
    label(ctx, n.name, x, ly, { size: (n.landmark ? 26 : 23) * u, color: INK, weight: n.landmark ? 'bold' : 'normal', halo: true });
    if (n.dock) label(ctx, 'Andockpunkt · nur Mega-Rigs', x, ly + 19 * u, { size: 15 * u, color: '#285cc4', italic: true, halo: true });
    else if (!opt.hideDanger) label(ctx, '●'.repeat(n.danger || 1), x, ly + 19 * u, { size: 15 * u, color: RED, halo: true });
    if (n.id === opt.sel) { ctx.strokeStyle = '#ffd541'; ctx.lineWidth = 3 * u; ctx.setLineDash([6 * u, 4 * u]); ctx.lineDashOffset = t * 20; ctx.beginPath(); ctx.arc(x, y, r * 2.7, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
  }
  // billboards along the roads: logo on a post, slogan underneath
  for (const s of map.signs || []) {
    const b = brand(s.brand); if (!b) continue;
    const [x, y] = V.at(s.pos), z = 30 * u;
    ctx.save(); ctx.font = `italic ${Math.round(13 * u)}px VT323, monospace`; const sw = Math.max(z, ctx.measureText(b.slogan || b.name).width * 1.3); ctx.restore();
    if (!free(x - sw / 2, y - z, sw, z + 30 * u) || Object.values(out).some(p => Math.hypot(p.x - x, p.y - y) < 34 * u)) continue;   // never over a place or a name
    taken.push({ x: x - sw / 2, y: y - z, w: sw, h: z + 30 * u });
    ctx.save(); ctx.translate(x, y); ctx.rotate(s.rot || 0);
    ctx.fillStyle = INK; ctx.fillRect(-1.5 * u, 0, 3 * u, 14 * u);
    if (opt.logos && b.icon != null) { const c = b.icon % 4, r = Math.floor(b.icon / 4); ctx.imageSmoothingEnabled = false; ctx.drawImage(opt.logos, c * 64, r * 64, 64, 64, -z / 2, -z, z, z); }
    else { ctx.fillStyle = b.color || RED; ctx.fillRect(-z / 2, -z, z, z * 0.8); }
    label(ctx, b.slogan || b.name, 0, 26 * u, { size: 17 * u, color: INK, italic: true, halo: true });
    ctx.restore();
  }
  // salvage wrecks (#023): a tag with a little truck at their place, known or not (the quest says where); done = base with the van
  for (const [id, w] of Object.entries(map.wrecks || {})) {
    const p = out[id]; if (!p) continue;
    const x = p.x + 22 * u, y = p.y - 26 * u, wd = 34 * u, ht = 20 * u;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.08);
    ctx.fillStyle = INK; ctx.fillRect(-wd / 2 - 2 * u, -ht / 2 - 2 * u, wd + 4 * u, ht + 4 * u);
    ctx.fillStyle = w.done ? '#5daf8d' : '#f9a31b'; ctx.fillRect(-wd / 2, -ht / 2, wd, ht);
    ctx.fillStyle = INK; ctx.fillRect(-11 * u, -5 * u, 13 * u, 8 * u); ctx.fillRect(2 * u, -2 * u, 9 * u, 5 * u);   // truck: box + cab
    circle(ctx, -7 * u, 4 * u, 2.6 * u); circle(ctx, 7 * u, 4 * u, 2.6 * u);
    ctx.restore();
    label(ctx, w.done ? 'BASIS' : 'WRACK', x, y + ht + 4 * u, { size: 14 * u, color: w.done ? '#23674e' : RED, weight: 'bold', halo: true, spacing: 1.2 * u });
  }
  // "Sie sind hier" with the van
  if (out[here]) {
    const { x, y } = out[here], bob = Math.sin(t * 3) * 3 * u;
    ctx.save(); ctx.translate(x, y - 34 * u + bob);
    ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(0, 18 * u); ctx.lineTo(-9 * u, 2 * u); ctx.lineTo(9 * u, 2 * u); ctx.fill();
    ctx.fillStyle = INK; ctx.fillRect(-16 * u, -12 * u, 32 * u, 14 * u); ctx.fillStyle = '#bc4a9b'; ctx.fillRect(-16 * u, -6 * u, 32 * u, 3 * u);
    ctx.fillStyle = '#20d6c7'; ctx.fillRect(6 * u, -10 * u, 7 * u, 5 * u); ctx.fillStyle = INK; circle(ctx, -9 * u, 3 * u, 4 * u); circle(ctx, 9 * u, 3 * u, 4 * u);
    ctx.restore();
    label(ctx, 'SIE SIND HIER', x, y - 56 * u + bob, { size: 15 * u, color: RED, weight: 'bold', halo: true, spacing: 1.5 * u });
  }
  cartouche(ctx, W, H, u, C, brand(C.brands[0]?.id), opt.logos);
  compass(ctx, W - 70 * u, H - 78 * u, 34 * u);
  // scale bar
  const km = 20, bw = km * V.k, sx = 36 * u, sy = H - 34 * u;
  ctx.fillStyle = INK; ctx.fillRect(sx, sy, bw, 4 * u); ctx.fillStyle = '#fef3c0'; ctx.fillRect(sx + bw / 2, sy + 1 * u, bw / 2, 2 * u);
  label(ctx, `0          ${km} km`, sx + bw / 2, sy - 6 * u, { size: 13 * u, color: INK });
  ctx.restore();
  return { places: out, view: V };
}

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function pencilRing(ctx, x, y, r, color, w, seed) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.globalAlpha = 0.85; ctx.beginPath();
  for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2.15 + hashOf(seed) * 6, rr = r * (1 + 0.08 * Math.sin(i * 1.7 + hashOf(seed + 'r') * 9)); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85); }
  ctx.stroke(); ctx.restore();
}
function glyph(ctx, kind, x, y, r) {
  ctx.save(); ctx.fillStyle = '#fef3c0'; ctx.strokeStyle = '#fef3c0'; ctx.lineWidth = Math.max(1, r * 0.16);
  const s = r * 0.55;
  if (kind === 'pump') { ctx.fillRect(x - s * 0.6, y - s, s * 0.9, s * 1.8); ctx.beginPath(); ctx.moveTo(x + s * 0.3, y - s * 0.5); ctx.lineTo(x + s * 0.8, y - s * 0.2); ctx.lineTo(x + s * 0.8, y + s * 0.6); ctx.stroke(); }
  else if (kind === 'crane') { ctx.fillRect(x - s * 0.15, y - s, s * 0.3, s * 1.9); ctx.fillRect(x - s, y - s, s * 1.8, s * 0.3); ctx.beginPath(); ctx.moveTo(x + s * 0.7, y - s * 0.7); ctx.lineTo(x + s * 0.7, y + s * 0.2); ctx.stroke(); ctx.fillRect(x + s * 0.45, y + s * 0.2, s * 0.5, s * 0.35); ctx.fillRect(x - s * 0.7, y + s * 0.7, s * 1.4, s * 0.3); }   // #119 the dock
  else if (kind === 'cart') { ctx.beginPath(); ctx.moveTo(x - s, y - s * 0.6); ctx.lineTo(x - s * 0.6, y + s * 0.4); ctx.lineTo(x + s, y + s * 0.4); ctx.lineTo(x + s * 0.9, y - s * 0.4); ctx.closePath(); ctx.fill(); ctx.fillRect(x - s * 0.5, y + s * 0.6, s * 0.3, s * 0.3); ctx.fillRect(x + s * 0.4, y + s * 0.6, s * 0.3, s * 0.3); }
  else if (kind === 'hatch') { ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.7); ctx.lineTo(x, y - s); ctx.lineTo(x + s, y + s * 0.7); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#4a5462'; ctx.fillRect(x - s * 0.3, y, s * 0.6, s * 0.7); }
  else if (kind === 'columns') { ctx.fillRect(x - s, y - s, s * 2, s * 0.35); for (const dx of [-0.7, 0, 0.7]) ctx.fillRect(x + dx * s - s * 0.15, y - s * 0.6, s * 0.3, s * 1.2); ctx.fillRect(x - s, y + s * 0.65, s * 2, s * 0.3); }
  else if (kind === 'tower') { ctx.fillRect(x - s * 0.55, y - s, s * 1.1, s * 2); ctx.fillStyle = '#5d6872'; for (const yy of [-0.7, -0.2, 0.3]) for (const xx of [-0.3, 0.1]) ctx.fillRect(x + xx * s, y + yy * s, s * 0.22, s * 0.25); }
  else if (kind === 'stairs') { ctx.beginPath(); ctx.moveTo(x - s, y - s * 0.8); for (let i = 0; i < 4; i++) { ctx.lineTo(x - s + (i + 1) * s * 0.5, y - s * 0.8 + i * s * 0.45); ctx.lineTo(x - s + (i + 1) * s * 0.5, y - s * 0.8 + (i + 1) * s * 0.45); } ctx.lineTo(x - s, y + s); ctx.closePath(); ctx.fill(); }
  else if (kind === 'chimney') { ctx.fillRect(x - s, y, s * 2, s * 0.9); ctx.fillRect(x - s * 0.7, y - s, s * 0.35, s); ctx.fillRect(x + s * 0.2, y - s * 0.6, s * 0.35, s * 0.6); }
  else if (kind === 'trailer') { ctx.fillRect(x - s, y - s * 0.4, s * 1.7, s * 0.9); ctx.beginPath(); ctx.arc(x - s * 0.4, y + s * 0.6, s * 0.25, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + s * 0.7, y + s * 0.2, s * 0.35, s * 0.12); }
  else if (kind === 'mast') { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.6, y + s); ctx.moveTo(x, y - s); ctx.lineTo(x - s * 0.6, y + s); ctx.moveTo(x - s * 0.4, y + s * 0.3); ctx.lineTo(x + s * 0.4, y + s * 0.3); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y - s, s * 0.2, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function label(ctx, text, x, y, o = {}) {
  ctx.save();
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 'normal'} ${Math.round(o.size || 16)}px VT323, monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (o.spacing && 'letterSpacing' in ctx) ctx.letterSpacing = `${o.spacing}px`;
  if (o.halo) { ctx.strokeStyle = 'rgba(254,243,192,.85)'; ctx.lineWidth = (o.size || 16) * 0.28; ctx.lineJoin = 'round'; ctx.strokeText(text, x, y); }
  ctx.fillStyle = o.color || INK; ctx.fillText(text, x, y);
  ctx.restore();
}
// title box like the tourism maps of the 60s: "Straßenkarte … · Ausgabe 1962 · überreicht von Delta Petrol" with the sponsor's logo
function cartouche(ctx, W, H, u, C, sponsor, logos) {
  const x = 30 * u, y = 26 * u, w = 330 * u, h = 82 * u;
  ctx.save(); ctx.fillStyle = 'rgba(254,243,192,.92)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = RED; ctx.lineWidth = 3 * u; ctx.strokeRect(x + 4 * u, y + 4 * u, w - 8 * u, h - 8 * u); ctx.lineWidth = 1 * u; ctx.strokeRect(x + 8 * u, y + 8 * u, w - 16 * u, h - 16 * u);
  if (logos && sponsor?.icon != null) { const c = sponsor.icon % 4, r = Math.floor(sponsor.icon / 4); ctx.imageSmoothingEnabled = false; ctx.drawImage(logos, c * 64, r * 64, 64, 64, x + 14 * u, y + 15 * u, 52 * u, 52 * u); }
  ctx.restore();
  ctx.save(); ctx.textAlign = 'left'; ctx.fillStyle = INK;
  ctx.font = `bold ${Math.round(24 * u)}px VT323, monospace`; ctx.fillText(C.title, x + 74 * u, y + 38 * u, w - 84 * u);
  ctx.font = `${Math.round(16 * u)}px VT323, monospace`; ctx.fillStyle = RED; ctx.fillText(C.edition, x + 74 * u, y + 60 * u, w - 84 * u);
  ctx.restore();
}
function compass(ctx, x, y, r) {
  ctx.save(); ctx.translate(x, y);
  for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = i % 2 ? INK : RED; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.2, 0); ctx.lineTo(-r * 0.2, 0); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  label(ctx, 'N', x, y - r - 6, { size: r * 0.55, color: INK, weight: 'bold' });
}

// #119 the dust sea: a dried-out ocean bed (pale, cracked, salt rims, a wreck or two), a red barrier along its shore with warning
// triangles, its name and the warning in red (Reisekarte › Staubozean)
function drawSea(ctx, C, V, u, t) {
  const S = C.sea, [cx, cy] = V.at(S.at), rx = S.size[0] * V.k, ry = S.size[1] * V.k, rim = i => 0.92 + 0.14 * hashOf('sea' + i);
  const pt = (a, k = 1) => [cx + Math.cos(a) * rx * k * rim(Math.round(a / (Math.PI * 2) * 40) % 40), cy + Math.sin(a) * ry * k * rim(Math.round(a / (Math.PI * 2) * 40) % 40)];
  ctx.save();
  const shape = (k = 1) => { ctx.beginPath(); for (let i = 0; i <= 40; i++) { const [x, y] = pt(i / 40 * Math.PI * 2, k); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); };
  // the bed: pale sand to grey towards the deep middle
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
  g.addColorStop(0, 'rgba(139,147,175,.55)'); g.addColorStop(0.7, 'rgba(228,210,170,.75)'); g.addColorStop(1, 'rgba(244,210,156,.6)');
  shape(); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(113,65,59,.6)'; ctx.lineWidth = 2 * u; ctx.stroke();
  // old shore lines (where the water stood) and cracks
  ctx.setLineDash([3 * u, 5 * u]); ctx.strokeStyle = 'rgba(113,65,59,.35)'; for (const k of [0.8, 0.6]) { shape(k); ctx.stroke(); } ctx.setLineDash([]);
  shape(); ctx.clip();
  ctx.strokeStyle = 'rgba(66,57,52,.45)'; ctx.lineWidth = 1.2 * u;
  for (let i = 0; i < 46; i++) {
    let x = cx + (hashOf('cx' + i) - 0.5) * rx * 2, y = cy + (hashOf('cy' + i) - 0.5) * ry * 2;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s2 = 0; s2 < 4; s2++) { x += (hashOf(`k${i}${s2}`) - 0.5) * 34 * u; y += (hashOf(`l${i}${s2}`) - 0.5) * 22 * u; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // wrecks: a ship's hull lying on its side, a sunken tanker's bow
  for (const [i, wx, wy, s] of [[0, -0.35, 0.15, 1], [1, 0.25, -0.3, 0.8]]) {
    const x = cx + wx * rx, y = cy + wy * ry, w = 30 * u * s, h = 9 * u * s;
    ctx.fillStyle = 'rgba(66,57,52,.7)'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w * 0.8, y); ctx.lineTo(x + w, y - h); ctx.lineTo(x - w * 0.7, y - h * 0.6); ctx.closePath(); ctx.fill();
    ctx.fillRect(x - w * 0.2, y - h * 2, 3 * u * s, h * 1.4);
    if (i === 0) { ctx.fillRect(x + w * 0.2, y - h * 1.7, 2 * u * s, h * 1.1); }
  }
  ctx.restore();
  // the hard barrier: a red dashed line just off the shore, warning triangles along it
  ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 3 * u; ctx.setLineDash([10 * u, 6 * u]); ctx.lineDashOffset = -t * 6;
  ctx.beginPath(); for (let i = 0; i <= 40; i++) { const [x, y] = pt(i / 40 * Math.PI * 2, 1.06); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
  for (const a of [-1.1, -0.35, 0.45, 1.2]) {
    const [x, y] = pt(a, 1.06), s = 9 * u;
    ctx.fillStyle = '#fef3c0'; ctx.strokeStyle = RED; ctx.lineWidth = 2.5 * u;
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s * 0.8); ctx.lineTo(x - s, y + s * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = RED; ctx.fillRect(x - 1 * u, y - s * 0.35, 2 * u, s * 0.6); ctx.fillRect(x - 1 * u, y + s * 0.4, 2 * u, 2 * u);
  }
  ctx.restore();
  label(ctx, S.name.toUpperCase(), cx, cy - ry * 0.1, { size: 28 * u, color: '#4a5462', weight: 'bold', spacing: 4 * u, italic: true });
  label(ctx, S.warn, cx, cy + ry * 0.12, { size: 18 * u, color: RED, italic: true, halo: true });
  label(ctx, 'Sperrgebiet für kleine Fahrzeuge', cx, cy + ry * 0.12 + 20 * u, { size: 14 * u, color: RED, halo: true });
}
