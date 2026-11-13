// Draws the travel map (#007) on a 2D canvas: the weathered paper (PixelLab), and on it from code BigCityDelta, the roads, the places,
// the brands' billboards, a title cartouche, a compass and Leyla's red pencil around where she can drive. Used by the map window
// (game/play/map_ui.js) and the workshop preview (Reisekarte). Returns the screen position of every place for clicks and the cursor.
import { mapConfig, neighbours, hops } from './worldmap.js';

const KIND = {   // pin colour and a tiny pictogram per POI kind
  gasStation: { color: '#df3e23', glyph: 'pump' }, mall: { color: '#bc4a9b', glyph: 'cart' }, bunker: { color: '#4a5462', glyph: 'hatch' }, government: { color: '#143464', glyph: 'columns' },
};
const INK = '#322b28', RED = '#b4202a';
const hashOf = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };

// world km → canvas px, fitted into the paper with a margin (the map is wider than tall)
export function mapView(D, map, W, H) {
  const C = mapConfig(D), pts = [...map.nodes.map(n => n.pos), C.city];
  const x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1]));
  const mx = W * 0.13, my = H * 0.17, k = Math.min((W - 2 * mx) / Math.max(1, x1 - x0), (H - 2 * my) / Math.max(1, y1 - y0));
  const ox = (W - (x1 - x0) * k) / 2 - x0 * k, oy = (H - (y1 - y0) * k) / 2 - y0 * k + H * 0.03;
  return { k, at: p => [ox + p[0] * k, oy + p[1] * k] };
}

// opt: { paper, logos (Image), here, sel, t (s), brands: {id: brand}, reveal }
export function drawMap(ctx, W, H, D, map, opt = {}) {
  const C = mapConfig(D), V = mapView(D, map, W, H), u = Math.min(W / 1200, H / 680), t = opt.t || 0;
  const here = opt.here, near = new Set(neighbours(map, here)), hop = hops(map, here), reveal = opt.reveal ?? C.reveal;
  const known = n => n.id === here || map.visited?.includes(n.id) || (hop[n.id] ?? 99) <= reveal;
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
  // the chosen route: red pencil along the road (Leyla's marker)
  if (opt.sel && near.has(opt.sel)) {
    const [ax, ay, qx, qy, bx, by] = curve(P(here), P(opt.sel));
    ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 4 * u; ctx.setLineDash([10 * u, 7 * u]); ctx.lineDashOffset = -t * 30 * u;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(qx, qy, bx, by); ctx.stroke(); ctx.restore();
  }
  // places (labels step aside when they would cover another one)
  const out = {}, taken = [];
  const free = (x, y, w, h) => !taken.some(b => x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y);
  for (const n of map.nodes) {
    const [x, y] = V.at(n.pos), k = KIND[D.pois?.[n.poi]?.kind] || { color: INK }, isKnown = known(n), r = 10 * u;
    out[n.id] = { x, y, r: r * 2.2, known: isKnown, near: near.has(n.id) };
    if (!isKnown) { ctx.fillStyle = 'rgba(50,43,40,.35)'; circle(ctx, x, y, r * 0.8); label(ctx, '?', x, y + 5 * u, { size: 18 * u, color: '#fef3c0' }); continue; }
    // red pencil ring around where she can drive (wobbly, hand drawn)
    if (near.has(n.id)) pencilRing(ctx, x, y, r * 2 + (n.id === opt.sel ? Math.sin(t * 4) * 2 * u : 0), RED, 2.5 * u, n.id);
    ctx.fillStyle = '#fef3c0'; circle(ctx, x, y, r + 2.5 * u);
    ctx.fillStyle = k.color; circle(ctx, x, y, r);
    glyph(ctx, k.glyph, x, y, r);
    if (map.visited?.includes(n.id) && n.id !== here) { ctx.strokeStyle = INK; ctx.lineWidth = 2.5 * u; ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke(); }
    ctx.save(); ctx.font = `${n.landmark ? 'bold' : 'normal'} ${Math.round((n.landmark ? 19 : 17) * u)}px VT323, monospace`; const tw = ctx.measureText(n.name).width; ctx.restore();
    let ly = y + r + 18 * u;
    for (const dy of [0, -(2 * r + 44 * u), 18 * u, -(2 * r + 62 * u), 36 * u]) if (free(x - tw / 2, y + r + 4 * u + dy, tw, 32 * u)) { ly = y + r + 18 * u + dy; break; }
    taken.push({ x: x - tw / 2, y: ly - 16 * u, w: tw, h: 32 * u });
    label(ctx, n.name, x, ly, { size: (n.landmark ? 19 : 17) * u, color: INK, weight: n.landmark ? 'bold' : 'normal', halo: true });
    label(ctx, '●'.repeat(n.danger || 1), x, ly + 15 * u, { size: 11 * u, color: RED, halo: true });
    if (n.id === opt.sel) { ctx.strokeStyle = '#ffd541'; ctx.lineWidth = 3 * u; ctx.setLineDash([6 * u, 4 * u]); ctx.lineDashOffset = t * 20; ctx.beginPath(); ctx.arc(x, y, r * 2.7, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
  }
  // billboards along the roads: logo on a post, slogan underneath
  for (const s of map.signs || []) {
    const b = brand(s.brand); if (!b) continue;
    const [x, y] = V.at(s.pos), z = 30 * u;
    ctx.save(); ctx.font = `italic ${Math.round(13 * u)}px VT323, monospace`; const sw = Math.max(z, ctx.measureText(b.slogan || b.name).width); ctx.restore();
    if (!free(x - sw / 2, y - z, sw, z + 30 * u) || Object.values(out).some(p => Math.hypot(p.x - x, p.y - y) < 34 * u)) continue;   // never over a place or a name
    taken.push({ x: x - sw / 2, y: y - z, w: sw, h: z + 30 * u });
    ctx.save(); ctx.translate(x, y); ctx.rotate(s.rot || 0);
    ctx.fillStyle = INK; ctx.fillRect(-1.5 * u, 0, 3 * u, 14 * u);
    if (opt.logos && b.icon != null) { const c = b.icon % 4, r = Math.floor(b.icon / 4); ctx.imageSmoothingEnabled = false; ctx.drawImage(opt.logos, c * 64, r * 64, 64, 64, -z / 2, -z, z, z); }
    else { ctx.fillStyle = b.color || RED; ctx.fillRect(-z / 2, -z, z, z * 0.8); }
    label(ctx, b.slogan || b.name, 0, 24 * u, { size: 13 * u, color: INK, italic: true, halo: true });
    ctx.restore();
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
  else if (kind === 'cart') { ctx.beginPath(); ctx.moveTo(x - s, y - s * 0.6); ctx.lineTo(x - s * 0.6, y + s * 0.4); ctx.lineTo(x + s, y + s * 0.4); ctx.lineTo(x + s * 0.9, y - s * 0.4); ctx.closePath(); ctx.fill(); ctx.fillRect(x - s * 0.5, y + s * 0.6, s * 0.3, s * 0.3); ctx.fillRect(x + s * 0.4, y + s * 0.6, s * 0.3, s * 0.3); }
  else if (kind === 'hatch') { ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.7); ctx.lineTo(x, y - s); ctx.lineTo(x + s, y + s * 0.7); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#4a5462'; ctx.fillRect(x - s * 0.3, y, s * 0.6, s * 0.7); }
  else if (kind === 'columns') { ctx.fillRect(x - s, y - s, s * 2, s * 0.35); for (const dx of [-0.7, 0, 0.7]) ctx.fillRect(x + dx * s - s * 0.15, y - s * 0.6, s * 0.3, s * 1.2); ctx.fillRect(x - s, y + s * 0.65, s * 2, s * 0.3); }
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
