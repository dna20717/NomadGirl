// The road between two places, drawn by code (#053, Daniel 18.11.2026: „die Reise von POI zu POI ähnlich in Szene setzen wie bei Keep
// Driving … bau richtig tolle Lichteffekte, Sonnenuntergänge und Wetter aus Code ein“). A side view in layers that pass by at their own
// speed: sky by the hour (dithered bands, sun or moon, stars, milky way, clouds lit from below, rays at low sun), the city on the horizon,
// far relief by region (mesas, dunes, ridges, hills, salt flats), hills, things by the road (ruins, wrecks, water towers, billboards of
// the brands, pylons with wires), telegraph poles, the road, tufts in front. Weather: rain with lightning, dust, morning fog, heat haze.
// The incident of a leg stands by the road and comes closer (Welt › Encounter › Am Straßenrand).
//
// No DOM besides canvases: makeRoad(D, opts) → { draw(ctx, W, H, st) } draws into a small pixel canvas (480 × 270 background pixels,
// the caller scales it up sharp); light(ctx, …) and front(ctx, …) draw the big things over the rig (headlights, flares, rain, dust).
// st = { dist (px the rig has rolled), t (s), hour (clock hours), land: [from, to, k], wet, dust, fog, flash, stop: { kind, x } }
export const BW = 480, BH = 270, HORIZON = 148, ROAD = [214, 238], WHEEL_Y = 229;
export const RELIEFS = [['mesas', 'Tafelberge'], ['dunes', 'Dünen'], ['jagged', 'Grate'], ['hills', 'Hügel'], ['flat', 'Salzpfanne']];
export const ROADSIDE = [['', 'nichts am Rand'], ['barrier', 'Straßensperre'], ['creatures', 'Kreaturen mit leuchtenden Augen'], ['truck', 'Liegengebliebener LKW'],
  ['breakdown', 'Panne: Dampf aus dem Motor'], ['trader', 'Händler mit Laternen'], ['storm', 'Staubwand am Horizont'], ['hitchhiker', 'Anhalterin'], ['flare', 'Rauchfackel'],
  ['campfire', 'Lagerfeuer'], ['wreck', 'Rauchendes Autowrack'], ['bus', 'Verlassener Bus'], ['drone', 'Abgestürzte Drohne'], ['shrine', 'Schrein mit Kerzen'], ['tower', 'Blinkender Funkmast'], ['rocks', 'Geröll auf der Straße']];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hex = c => { const n = parseInt(String(c || '#000000').slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, k))));
const css = ([r, g, b], a = 1) => `rgba(${r},${g},${b},${a})`;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };
const hash = (a, b = 0) => { let x = Math.imul((a | 0) ^ 0x9e3779b9, 2654435761) ^ Math.imul((b | 0) + 0x632be5ab, 1597334677); x ^= x >>> 15; x = Math.imul(x, 2246822519); x ^= x >>> 13; return (x >>> 0) / 4294967296; };
// value noise along x, smooth, 0…1
const noise = (x, s = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, s) * (1 - u) + hash(i + 1, s) * u; };

// ---------- configuration (Reisen › Fahrt, Reisen › Landschaften) ----------
export function driveConfig(D) {
  const R = D?.travel?.drive || {};
  return { enabled: R.enabled !== false, seconds: Math.max(3, R.seconds ?? 30), fast: Math.max(1, R.fast ?? 6), speed: R.speed ?? 120, stopAt: clamp((R.stopAt ?? 80) / 100, 0.3, 0.95),
    rigHeight: clamp((R.rigHeight ?? 34) / 100, 0.1, 0.7), rigX: clamp((R.rigX ?? 62) / 100, 0.3, 0.9), rays: (R.rays ?? 70) / 100, flare: (R.flare ?? 60) / 100,
    headlights: (R.headlights ?? 80) / 100, grain: (R.grain ?? 10) / 100, haze: (R.haze ?? 60) / 100, bounce: R.bounce ?? 3,
    avaRope: R.avaRope ?? 46, avaSize: R.avaSize ?? 0.42, silhouettes: R.silhouettes !== false,
    music: Array.isArray(R.music) ? R.music : [], musicVolume: R.musicVolume ?? 40 };   // #117 the fast passages of Daniel's intro music   // #115
}
// #147 (Daniel 21.11.2026: „Auf dem Reise-Bildschirm sind viele Code-Grafiken, dabei haben wir doch jetzt inzwischen eine Menge cooler
// Grafiken und Tiles dafür“): painted pieces of the drive (Reisen › Fahrt › Grafiken). Empty = drawn by code as before.
export const INCIDENT_FX = 'fire = Feuer oben, glow = Lichtschein + Funken, lamp = Laterne oben rechts, blink = Warnblinker, smoke = Rauch';
export function driveArt(D) {
  const A = D?.travel?.drive?.art || {};
  return { road: A.road || null, roadTurn: A.roadTurn !== false, roadSquash: clamp((A.roadSquash ?? 33) / 100, 0.05, 1), ground: A.ground || null, plain: A.plain || null,
    billboard: A.billboard || null, screenAt: A.screenAt || [22, 26], screenSize: A.screenSize || [196, 62], billboardSize: (A.billboardSize ?? 150) / 100,
    pole: A.pole || null, poleCell: A.poleCell || '1', weed: A.weed || null, weedCell: A.weedCell || '1', propGap: Math.max(16, A.propGap ?? 260),
    props: Array.isArray(A.props) ? A.props.filter(p => p?.look) : [], incidents: Array.isArray(A.incidents) ? A.incidents.filter(p => p?.kind && p.look) : [],
    clouds: A.clouds || null, cloudSize: (A.cloudSize ?? 100) / 100, pylon: A.pylon || null };   // #162 painted clouds and pylons
}
const LAND = { region: '', relief: 'mesas', far: '#8e5252', mid: '#a08662', ground: '#dba463', road: '#333941', plants: '#5a4e44', rock: '#71413b',
  ruins: 15, wrecks: 12, towers: 6, signs: 10, plantsN: 30, poles: 1, pylons: 0, city: 20, dust: 15, fog: 10 };
export function landscapeOf(D, region) {
  const rows = D?.travel?.landscapes || [];
  return { ...LAND, ...(rows.find(r => !r.region) || {}), ...(rows.find(r => r.region && r.region === region) || {}) };
}

// ---------- the sky by the hour ----------
// [hour, top, middle, low, horizon, darkness]
const SKY = [
  [0, '#0a0a1c', '#121430', '#1c1f45', '#2a2a55', 0.85], [4.6, '#0d0d24', '#1a1a3c', '#30284e', '#4a3352', 0.8],
  [5.6, '#1a1838', '#3b2a5a', '#8a4a6a', '#e08a6a', 0.55], [6.6, '#2a3a78', '#6a6aa8', '#e8a080', '#ffd08a', 0.22],
  [8.2, '#3a6ab8', '#6a9ad0', '#a8c8e0', '#f0dcb0', 0.04], [12, '#285cc4', '#588dbe', '#9cc4e4', '#e8e6d8', 0],
  [16.6, '#3a5aa0', '#7088c0', '#d8b090', '#f8d090', 0.04], [18.2, '#2a1c4a', '#6a2a5a', '#d8503c', '#ffa050', 0.2],
  [19.2, '#160d2a', '#3a1a48', '#7a2a48', '#c05a40', 0.48], [20.6, '#0c0b22', '#161632', '#24224a', '#3a2c55', 0.75], [24, '#0a0a1c', '#121430', '#1c1f45', '#2a2a55', 0.85]];
export function skyAt(hours) {
  const h = ((hours % 24) + 24) % 24;
  let i = 1; while (i < SKY.length - 1 && SKY[i][0] <= h) i++;
  const a = SKY[i - 1], b = SKY[i], k = (h - a[0]) / (b[0] - a[0]);
  const c = j => mix(hex(a[j]), hex(b[j]), k);
  // the sun from 6 to 19 h, the moon the other way round; alt −1…1 over the horizon, x 0…1 across the sky
  const day = h >= 6 && h <= 19, sunK = (h - 6) / 13, nightK = ((h - 19 + 24) % 24) / 11;
  const sunAlt = day ? Math.sin(Math.PI * sunK) : -Math.sin(Math.PI * clamp(nightK)) * 0.6;
  const moonAlt = day ? -0.5 : Math.sin(Math.PI * clamp(nightK));
  const warm = clamp(1 - Math.abs(sunAlt - 0.04) / 0.32) * (h > 3 && h < 21 ? 1 : 0);
  const sunCol = mix(hex('#fffc40'), hex('#fa6a0a'), clamp(1 - sunAlt / 0.45));
  return { h, top: c(1), mid: c(2), low: c(3), hor: c(4), dark: a[5] + (b[5] - a[5]) * k, sun: { alt: sunAlt, x: 0.12 + 0.76 * clamp(sunK), col: sunCol },
    moon: { alt: moonAlt, x: 0.85 - 0.7 * clamp(nightK) }, warm, evening: h > 12 };
}

// ---------- the road ----------
// the brands for the giant screens (#055): every brand of the Lore with its ads (Marke › Werbung auf Billboards, else the slogan)
export const adBrands = D => Object.entries(D?.brands || {}).filter(([, b]) => b.name && b.billboard !== false)
  .map(([id, b]) => ({ id, name: b.name, slogan: b.slogan || '', lines: String(b.ads || b.slogan || b.name).split('|').map(x => x.trim()).filter(Boolean), color: b.color || '#ffd27a', icon: b.icon ?? null }));

export function makeRoad(D, { seed = 1, logos = null, brands = [], adBrandList = null, art = null } = {}) {
  const adList = adBrandList || adBrands(D);
  let screens = [];
  const sky = document.createElement('canvas'); sky.width = BW; sky.height = BH;
  const sctx = sky.getContext('2d');
  let skyKey = '';
  const stars = Array.from({ length: 140 }, (_, i) => ({ x: hash(i, seed + 1) * BW, y: hash(i, seed + 2) * HORIZON * 0.95, p: hash(i, 9) * 9, big: hash(i, 5) < 0.08, milk: hash(i, 6) }));
  const clouds = Array.from({ length: 16 }, (_, i) => ({ x: hash(i, seed + 3), y: 14 + hash(i, seed + 4) * 70, w: 24 + hash(i, 7) * 80, h: 2 + Math.floor(hash(i, 8) * 3), v: 0.4 + hash(i, 10) }));
  const drops = [], motes = [], weeds = [];
  let bolt = null;

  // ---------- #147 painted pieces (Reisen › Fahrt › Grafiken) ----------
  // draw() paints into a canvas n device pixels per background pixel: the code's pixels stay chunky, the painted art is drawn finer
  const ART = driveArt(D);
  let n = 1;
  const imgOf = id => { if (!id || !art) return null; const i = art(id); return i && i.complete !== false && (i.naturalWidth || i.width) ? i : null; };
  // load everything once up front, so the code look shows only for a moment
  if (art) for (const id of [ART.road, ART.ground, ART.plain, ART.billboard, ART.pole, ART.weed, ART.clouds, ART.pylon, ...ART.props.map(p => p.look), ...ART.incidents.map(p => p.look)]) imgOf(id);
  const cellsOf = s => String(s ?? '').split(',').map(x => x.trim()).filter(Boolean);
  // one picture of an asset: a cell of a symbol grid (number from 1 or its name), a frame of an animation, or the whole image;
  // h = its height in the world (the asset's „Höhe im Spiel“, else its pixels)
  function sprite(id, cell = 1, t = 0) {
    const A = D.assets?.[id], img = imgOf(id);
    if (!A || !img) return null;
    if (A.grid && A.cell) {
      const N = A.grid[0] * A.grid[1], byName = (A.names || []).indexOf(String(cell)), i = byName >= 0 ? byName : clamp(Math.round(Number(cell) || 1) - 1, 0, N - 1);
      return { img, sx: (i % A.grid[0]) * A.cell[0], sy: Math.floor(i / A.grid[0]) * A.cell[1], sw: A.cell[0], sh: A.cell[1], h: A.cell[1] };
    }
    if (A.frameSize) { const f = A.frames > 1 ? Math.floor(t * (A.fps || 8)) % A.frames : 0; return { img, sx: f * A.frameSize[0], sy: 0, sw: A.frameSize[0], sh: A.frameSize[1], h: A.height || A.frameSize[1] }; }
    return { img, sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight, h: A.height || img.naturalHeight };
  }
  // the light of the hour on painted pixels, as tone() does to the code's colours: haze by depth, night, warm evening, rain, dust, fog
  function shade(b, w, h, depth, S, st) {
    b.globalCompositeOperation = 'source-atop';
    if (depth > 0) { b.fillStyle = css(S.hor, depth * 0.55); b.fillRect(0, 0, w, h); }
    const tint = tone('#808080', depth, S, st);
    b.fillStyle = `rgba(${Math.round(tint[0] * 0.25)},${Math.round(tint[1] * 0.25)},${Math.round(tint[2] * 0.3)},${Math.min(0.9, S.dark * (1 - depth * 0.2))})`; b.fillRect(0, 0, w, h);   // near things darker at night than the far haze
    if (S.warm > 0) { b.fillStyle = `rgba(250,106,10,${S.warm * 0.12})`; b.fillRect(0, 0, w, h); }
    if (st.wet) { b.fillStyle = `rgba(58,60,80,${st.wet * 0.22})`; b.fillRect(0, 0, w, h); }
    if (st.dust) { b.fillStyle = css(mix(hex('#c7b08b'), S.hor, 0.3).map(v => v * (1 - S.dark * 0.7)), st.dust * (0.15 + depth * 0.5)); b.fillRect(0, 0, w, h); }
    if (st.fog) { b.fillStyle = css(mix([200, 205, 215], S.hor, 0.4).map(v => v * (1 - S.dark * 0.6)), st.fog * (0.1 + depth * 0.6)); b.fillRect(0, 0, w, h); }
    b.globalCompositeOperation = 'source-over';
  }
  const lightKey = (S, st) => [S.h.toFixed(1), Math.round((st.wet || 0) * 5), Math.round((st.dust || 0) * 5), Math.round((st.fog || 0) * 5), Math.round((st.flash || 0) * 2), n].join();
  // a sprite in the light of the hour, w × h background pixels standing on `bottom`; cached while the light stays the same
  const spriteBuf = new Map(); let spriteKey = '';
  function put(ctx, sp, x, bottom, w, h, depth, S, st, flip = false) {
    if (!sp || w < 0.5 || h < 0.5) return;
    const lk = lightKey(S, st);
    if (lk !== spriteKey) { spriteBuf.clear(); spriteKey = lk; }
    const pw = Math.max(1, Math.round(w * n)), ph = Math.max(1, Math.round(h * n)), key = [sp.img.src || sp.img.width, sp.sx, sp.sy, pw, ph, depth].join();
    let b = spriteBuf.get(key);
    if (!b) {
      b = document.createElement('canvas'); b.width = pw; b.height = ph;
      const c = b.getContext('2d'); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(sp.img, sp.sx, sp.sy, sp.sw, sp.sh, 0, 0, pw, ph); shade(c, pw, ph, depth, S, st);
      if (spriteBuf.size > 400) spriteBuf.clear();
      spriteBuf.set(key, b);
    }
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (flip) { ctx.translate(x * 2 + w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(b, x, bottom - h, w, h); ctx.restore();
  }
  // a painted strip repeated sideways across the picture (mirrored every other time unless it is seamless), w × h background pixels a
  // piece, bottom at `bottom`, passing at speed p; the shaded piece is cached while the light stays the same
  const stripCache = new Map(), sids = new WeakMap(); let stripKey = '', sidN = 0;
  const sid = o => { if (!sids.has(o)) sids.set(o, ++sidN); return sids.get(o); };
  function strip(ctx, src, { sx = 0, sy = 0, sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, w, h, bottom, p, depth, S, st, mirror = true }) {
    const pw = Math.round(w * n), ph = Math.ceil(h * n);
    if (pw < 2 || ph < 2) return;
    const lk = lightKey(S, st);
    if (lk !== stripKey) { stripCache.clear(); stripKey = lk; }
    const key = [sid(src), sx, sy, sw, sh, pw, ph, depth, mirror].join();
    let b = stripCache.get(key);
    if (!b) {
      b = document.createElement('canvas'); b.width = mirror ? pw * 2 : pw; b.height = ph;
      const c = b.getContext('2d'); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(src, sx, sy, sw, sh, 0, 0, pw, ph);
      if (mirror) { c.save(); c.translate(pw * 2, 0); c.scale(-1, 1); c.drawImage(src, sx, sy, sw, sh, 0, 0, pw, ph); c.restore(); }
      shade(c, b.width, ph, depth, S, st);
      stripCache.set(key, b);
    }
    const period = b.width, off = ((Math.round(st.dist * p * n) % period) + period) % period;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    for (let x = -off; x < BW * n; x += period) ctx.drawImage(b, x / n, bottom - h, period / n, ph / n);
    ctx.restore();
  }
  const glowAt = (ctx, gx, gy, r, col, a) => { const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(gx - r, gy - r, r * 2, r * 2); };
  // the plain between the horizon and the road: the region's Parallax-Set › Ebene, else Fahrt › Grafiken › Ebene
  function paintedPlain(ctx, st, S, L) {
    const P = L.parallax && D.parallax?.[L.parallax], img = imgOf(P?.plain?.look || ART.plain);
    if (!img) return false;
    const top = HORIZON - 4, bottom = ROAD[0] + 2, h = bottom - top, w = img.naturalWidth * h / img.naturalHeight;
    strip(ctx, img, { w, h, bottom, p: 0.22, depth: 0.22, S, st });
    return true;
  }
  // the road: a strip seen from above (the cockpit's), turned along the drive and foreshortened into the band
  let roadRot = null, roadSrc = null;
  function paintedRoad(ctx, st, S) {
    const img = imgOf(ART.road);
    if (!img) return false;
    let src = img;
    if (ART.roadTurn) {
      if (roadSrc !== img) { roadRot = document.createElement('canvas'); roadRot.width = img.naturalHeight; roadRot.height = img.naturalWidth; const c = roadRot.getContext('2d'); c.translate(roadRot.width, 0); c.rotate(Math.PI / 2); c.drawImage(img, 0, 0); roadSrc = img; }
      src = roadRot;
    }
    const h = ROAD[1] - ROAD[0], sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    strip(ctx, src, { w: sw * (h / sh) / ART.roadSquash, h, bottom: ROAD[1], p: 1, depth: 0, S, st, mirror: false });
    return true;
  }
  // the ground in front of the road: the camp's cut through the earth (surface row = its anchor), darker rock below it
  function paintedGround(ctx, st, S, L, ws) {
    const A = D.assets?.[ART.ground], img = imgOf(ART.ground);
    if (!img) return false;
    const top = Math.min(img.naturalHeight - 4, A?.origin?.[1] ?? 0), sh = img.naturalHeight - top, h = sh * ws;
    ctx.fillStyle = css(tone(D.camp?.ground?.deep || '#141013', 0, S, st)); ctx.fillRect(0, ROAD[1], BW, BH - ROAD[1]);
    strip(ctx, img, { sy: top, sh, w: img.naturalWidth * ws, h, bottom: ROAD[1] + h, p: 1, depth: 0, S, st, mirror: false });
    return true;
  }
  // things on the far shoulder (Fahrt › Grafiken › Am Straßenrand): one slot every „Abstand“ world pixels, the row by its chance among the
  // rows of the region's Parallax-Set; a slot keeps its pick while it passes
  const picks = new Map();
  function roadside(ctx, st, S, ws) {
    if (!ART.props.length) return;
    const gap = ART.propGap * ws, off = st.dist, first = Math.floor((off - 60) / gap);
    for (const k of picks.keys()) if (k < first - 4) picks.delete(k);
    for (let i = first; i * gap - off < BW + 60; i++) {
      if (!picks.has(i)) {
        const [A, B, kk] = st.land, Lc = hash(i, seed + 77) < kk ? B : A, rows = ART.props.filter(r => !r.parallax || r.parallax === Lc.parallax);
        const sum = rows.reduce((a, r) => a + (r.chance ?? 30), 0);
        let roll = hash(i, seed + 81) * Math.max(100, sum);
        const r = sum ? rows.find(r => (roll -= (r.chance ?? 30)) < 0) : null, cells = r ? cellsOf(r.cells) : [];
        picks.set(i, r ? { r, cell: cells.length ? cells[Math.floor(hash(i, seed + 82) * cells.length)] : 1, flip: hash(i, seed + 83) < 0.5, dx: hash(i, seed + 80) * gap * 0.6 } : null);
      }
      const pk = picks.get(i); if (!pk) continue;
      const sp = sprite(pk.r.look, pk.cell, st.t); if (!sp) continue;
      const k = ws * (pk.r.size ?? 100) / 100, h = sp.h * k, w = sp.sw * h / sp.sh;
      put(ctx, sp, i * gap - off + pk.dx, ROAD[0] + 2, w, h, 0.04, S, st, pk.flip);
    }
  }
  // an incident drawn from Fahrt › Grafiken › Zwischenfälle (one row = one picture, at the world's scale), its effects from code
  function incidentPainted(ctx, kind, x0, S, st, ws) {
    const rows = ART.incidents.filter(r => r.kind === kind), t = st.t, y = ROAD[0] + 9;
    const parts = rows.map(r => ({ r, sp: sprite(r.look, r.cell ?? 1, t) }));
    if (!parts.length || parts.some(p => !p.sp)) return false;
    for (const { r, sp } of parts) {
      const k = ws * (r.size ?? 100) / 100, h = sp.h * k, w = sp.sw * h / sp.sh, x = x0 + (r.dx ?? 0) * ws;
      put(ctx, sp, x, y, w, h, 0, S, st, !!r.flip);
      for (const fx of cellsOf(r.fx)) incidentFx(ctx, fx, x, y - h, w, h, S, t);
    }
    return true;
  }
  function incidentFx(ctx, fx, x, top, w, h, S, t) {
    const cx = x + w / 2;
    if (fx === 'fire') {   // flames out of a barrel, a pool of light
      const f = 0.7 + 0.3 * Math.sin(t * 23) * Math.sin(t * 7);
      glowAt(ctx, cx, top, 10 + w * 1.6, '255,140,40', 0.35 * f);
      for (let j = 0; j < 4; j++) { const fw = Math.max(1, Math.round(w * 0.5 - j * 1.2)); ctx.fillStyle = j < 2 ? `rgb(255,${130 + 60 * f},40)` : `rgb(255,${200 + 40 * f},90)`; ctx.fillRect(Math.round(cx - fw / 2 + Math.sin(t * 9 + j) * 0.6), Math.round(top - 1 - j * 1.5 - f), fw, 2); }
    } else if (fx === 'glow') {   // a campfire's warm light and sparks
      const f = 0.7 + 0.3 * Math.sin(t * 19) * Math.sin(t * 6.3);
      glowAt(ctx, cx, top + h * 0.7, 20 + w * 1.5, '255,150,60', 0.4 * f);
      for (let i = 0; i < 6; i++) { const life = (t * 0.7 + i / 6) % 1; ctx.fillStyle = `rgba(255,200,90,${1 - life})`; ctx.fillRect(Math.round(cx + Math.sin(t * 2 + i * 4) * 3 * life), Math.round(top - life * 20), 1, 1); }
    } else if (fx === 'lamp') {   // a lantern up on its pole
      const f = 0.8 + 0.2 * Math.sin(t * 5 + x), lx = x + w * 0.63, ly = top + h * 0.2;
      glowAt(ctx, lx, ly, 6 + w * 0.6, '255,190,80', 0.35 * f * (0.4 + S.dark));
    } else if (fx === 'blink') {   // hazard lights at both ends
      if (Math.sin(t * 6) > 0) for (const bx of [x + 1, x + w - 2]) { glowAt(ctx, bx, top + h * 0.62, 9, '255,170,40', 0.6); ctx.fillStyle = 'rgb(255,190,60)'; ctx.fillRect(Math.round(bx), Math.round(top + h * 0.62), 1, 1); }
    } else if (fx === 'smoke') {   // smoke rising from the top
      for (let i = 0; i < 8; i++) { const life = (t * 0.3 + i / 8) % 1, r = 1 + life * 4; ctx.fillStyle = `rgba(70,64,72,${0.4 * (1 - life)})`; ctx.beginPath(); ctx.arc(cx + w * 0.2 + life * 8 + Math.sin(t + i) * 1.5, top - life * 26, r, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  function drawSky(S, wet) {
    const key = [S.h.toFixed(2), Math.round(wet * 10)].join();
    if (key === skyKey) return;
    skyKey = key;
    const img = sctx.createImageData(BW, BH), stops = [[0, S.top], [0.42, S.mid], [0.78, S.low], [1, S.hor]];
    const grey = [70, 72, 92];
    const at = k => { for (let i = 1; i < stops.length; i++) if (k <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (k - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); return S.hor; };
    const bands = 12;
    for (let y = 0; y < BH; y++) {
      const k = clamp(y / HORIZON) * (bands - 1), lo = Math.floor(k), f = k - lo;
      let ca = at(lo / (bands - 1)), cb = at(Math.min(bands - 1, lo + 1) / (bands - 1));
      if (wet > 0) { const gr = grey.map(v => v * (1 - S.dark * 0.75)); ca = mix(ca, mix(gr, ca, 0.35), wet * 0.7); cb = mix(cb, mix(gr, cb, 0.35), wet * 0.7); }
      for (let x = 0; x < BW; x++) {
        const col = f * 16 > BAYER[(y & 3) * 4 + (x & 3)] ? cb : ca, o = (y * BW + x) * 4;
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    sctx.putImageData(img, 0, 0);
  }

  // colour of a thing in the landscape: far things fade into the horizon, evening tints it warm, night darkens it, dust and fog veil it
  function tone(c, depth, S, st) {
    let r = mix(hex(c), S.hor, depth * 0.7);
    if (S.warm > 0) r = mix(r, mix(hex('#b4202a'), hex('#fa6a0a'), 0.5), S.warm * 0.22 * (1 - depth * 0.5));
    r = mix(r, [14, 12, 32], S.dark * (0.97 - depth * 0.2));
    if (st.wet) r = mix(r, [58, 60, 80].map(v => v * (1 - S.dark * 0.7)), st.wet * 0.35 * (0.4 + depth));
    if (st.dust) r = mix(r, mix(hex('#c7b08b'), S.hor, 0.3).map(v => v * (1 - S.dark * 0.7)), st.dust * (0.3 + depth * 0.7));
    if (st.fog) r = mix(r, mix([200, 205, 215], S.hor, 0.4).map(v => v * (1 - S.dark * 0.6)), st.fog * (0.2 + depth * 0.8));
    return r;
  }

  // height of the relief at world x (layer coordinates), by the region's kind
  function relief(kind, x, s, H) {
    switch (kind) {
      case 'dunes': return H * (0.55 * noise(x / 70, s) + 0.3 * noise(x / 26, s + 1) + 0.15 * noise(x / 9, s + 2));
      case 'jagged': return H * ((1 - Math.abs(2 * noise(x / 34, s) - 1)) * 0.75 + 0.25 * noise(x / 7, s + 1));
      case 'hills': return H * (0.75 * noise(x / 110, s) + 0.25 * noise(x / 30, s + 1));
      case 'flat': return H * 0.12 * noise(x / 160, s) + 1;
      default: { const m = smooth(0.5, 0.56, noise(x / 62, s)) * (0.55 + 0.45 * noise(x / 23, s + 5)); return H * (0.12 + 0.75 * m + 0.06 * noise(x / 12, s + 1)) + (m > 0.98 ? 0 : 0.08 * H * noise(x / 5, s + 2)); }
    }
  }
  // the region of a world x at layer speed p: from and to are blended along the leg (k of the leg at the rig, later things are nearer to)
  const landAt = (st, xs) => { const [A, B, k] = st.land; return hash(Math.floor(xs / 40), seed + 77) < k + (xs - BW * 0.6) / 2400 ? B : A; };

  function drawLayer(ctx, st, S, { p, base, H, depth, s, color, kind = null, rim = true }) {
    const off = st.dist * p;
    for (let x = 0; x < BW; x++) {
      const L = landAt(st, x / Math.max(0.05, p)), k = kind || L.relief, h = Math.round(relief(k, x + off, s, H));
      if (h <= 0) continue;
      const c = tone(L[color] || color, depth, S, st);
      ctx.fillStyle = css(c); ctx.fillRect(x, base - h, 1, h + 1);
      // the side towards the sun catches its light; the top edge glows at low sun
      if (rim && S.sun.alt > -0.1 && S.dark < 0.7) {
        const hn = relief(k, x + off + (S.sun.x < 0.5 ? -1 : 1), s, H), lit = hn < h - 0.4;
        ctx.fillStyle = css(mix(c, S.sun.col, (lit ? 0.35 : 0.12) * (0.4 + S.warm) * (1 - S.dark)));
        ctx.fillRect(x, base - h, 1, lit ? 2 : 1);
      }
    }
  }

  // ---------- things by the road (pixel silhouettes) ----------
  function ruin(ctx, x, y, w, h, c, lit, r) {
    // a broken building: a block with a jagged top, dark window holes, now and then a lit one at night
    for (let i = 0; i < w; i++) { const cut = Math.floor(noise(i / 3, r * 7) * h * 0.45); ctx.fillStyle = css(c); ctx.fillRect(x + i, y - h + cut, 1, h - cut); }
    for (let wy = y - h + 6; wy < y - 4; wy += 6) for (let wx = x + 2; wx < x + w - 3; wx += 5) {
      if (wy < y - h + Math.floor(noise((wx - x) / 3, r * 7) * h * 0.45) + 2) continue;
      const on = lit > 0.35 && hash(wx * 7 + wy, r) < 0.14;
      ctx.fillStyle = on ? `rgba(255,190,90,${0.6 + 0.4 * lit})` : css(mix(c, [0, 0, 0], 0.45)); ctx.fillRect(wx, wy, 2, 3);
    }
  }
  function wreck(ctx, x, y, c, r) {
    const tilt = hash(r, 3) < 0.5 ? 1 : 0;
    ctx.fillStyle = css(c); ctx.fillRect(x, y - 5 - tilt, 18, 4); ctx.fillRect(x + 4, y - 9 - tilt, 9, 4);
    ctx.fillStyle = css(mix(c, [0, 0, 0], 0.5)); ctx.fillRect(x + 2, y - 2, 4, 2); if (hash(r, 4) < 0.6) ctx.fillRect(x + 12, y - 2, 4, 2);
    ctx.fillStyle = css(mix(c, [140, 170, 200], 0.25)); ctx.fillRect(x + 6, y - 8 - tilt, 5, 2);
  }
  function tower(ctx, x, y, c) {
    ctx.fillStyle = css(c); ctx.fillRect(x + 1, y - 26, 1, 26); ctx.fillRect(x + 9, y - 26, 1, 26); ctx.fillRect(x + 1, y - 14, 9, 1);
    ctx.fillRect(x - 1, y - 38, 13, 12); ctx.fillRect(x + 1, y - 40, 9, 2);
    ctx.fillStyle = css(mix(c, [255, 255, 255], 0.12)); ctx.fillRect(x - 1, y - 33, 13, 1);
  }
  function cactus(ctx, x, y, c, r) {
    const h = 6 + Math.floor(hash(r, 2) * 8);
    ctx.fillStyle = css(c); ctx.fillRect(x, y - h, 2, h);
    if (h > 8) { ctx.fillRect(x - 2, y - h + 3, 2, 3); ctx.fillRect(x - 2, y - h + 1, 1, 2); ctx.fillRect(x + 2, y - h + 5, 2, 2); ctx.fillRect(x + 3, y - h + 3, 1, 2); }
  }
  function bush(ctx, x, y, c, r, n = 6) {
    ctx.fillStyle = css(c);
    for (let i = 0; i < n; i++) ctx.fillRect(x + Math.floor(hash(r, i) * 7) - 3, y - 1 - Math.floor(hash(r, i + 9) * 3), 2, 2);
  }
  function billboard(ctx, x, y, c, b, S, t) {
    const lit = S.dark > 0.35;
    ctx.fillStyle = css(mix(c, [0, 0, 0], 0.4)); ctx.fillRect(x + 3, y - 18, 1, 18); ctx.fillRect(x + 22, y - 18, 1, 18);
    const face = mix(hex(b?.color || '#ffd27a'), [20, 18, 30], 0.15 + S.dark * 0.5);
    ctx.fillStyle = css(mix(c, [0, 0, 0], 0.3)); ctx.fillRect(x - 1, y - 33, 28, 16);
    ctx.fillStyle = css(face); ctx.fillRect(x, y - 32, 26, 14);
    const lg = typeof logos === 'function' ? logos() : logos;
    if (lg && b?.icon != null) { const cx = b.icon % 4, cy = Math.floor(b.icon / 4); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1 - S.dark * 0.45; ctx.drawImage(lg, cx * 64, cy * 64, 64, 64, x + 7, y - 32, 13, 13); ctx.globalAlpha = 1; }
    if (lit) {   // two lamps on the board at night, flickering a little
      const f = 0.75 + 0.25 * Math.sin(t * 17 + x);
      const g = ctx.createRadialGradient(x + 13, y - 34, 0, x + 13, y - 34, 18); g.addColorStop(0, `rgba(255,230,160,${0.35 * f})`); g.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 6, y - 50, 38, 34);
      ctx.fillStyle = `rgba(255,240,190,${f})`; ctx.fillRect(x + 6, y - 34, 2, 1); ctx.fillRect(x + 18, y - 34, 2, 1);
    }
  }
  function turbine(ctx, x, y, c, t, r) {
    ctx.fillStyle = css(c); ctx.fillRect(x, y - 34, 1, 34);
    const a0 = t * (0.4 + hash(r, 1)) + r;
    for (let i = 0; i < 3; i++) { const a = a0 + i * 2.094; for (let k = 1; k < 11; k++) ctx.fillRect(Math.round(x + Math.cos(a) * k), Math.round(y - 34 + Math.sin(a) * k), 1, 1); }
  }
  // a city on the horizon: blocks, a few towers with red lamps, windows and neon at night
  function city(ctx, st, S, L, t) {
    const off = st.dist * 0.012, k = (L.city ?? 20) / 100;
    if (k <= 0) return;
    for (let x = 0; x < BW; x++) {
      const wx = x + off, cell = Math.floor(wx / 7), on = noise(wx / 160, seed + 31);
      if (on < 1 - k * 0.9) continue;
      const h = Math.round(4 + hash(cell, seed + 32) * 22 * on + (hash(cell, seed + 33) < 0.06 ? 16 : 0));
      const c = tone('#4a5462', 0.85, S, st);
      ctx.fillStyle = css(c); ctx.fillRect(x, HORIZON - h, 1, h);
      if (S.dark > 0.3 && hash(Math.floor(wx), Math.floor(t * 0.5) + cell) < 0.05 * S.dark) { ctx.fillStyle = hash(cell, 4) < 0.5 ? 'rgba(255,90,200,.9)' : 'rgba(80,240,255,.9)'; ctx.fillRect(x, HORIZON - h + 2 + Math.floor(hash(wx, 3) * (h - 3)), 1, 1); }
      if (h > 20 && Math.floor(wx) % 7 === 3 && S.dark > 0.2 && Math.sin(t * 3 + cell) > 0) { ctx.fillStyle = 'rgba(255,60,60,1)'; ctx.fillRect(x, HORIZON - h - 1, 1, 1); }
    }
    if (S.dark > 0.3) {   // the glow of the city over the horizon
      const g = ctx.createLinearGradient(0, HORIZON - 40, 0, HORIZON); g.addColorStop(0, 'rgba(255,80,160,0)'); g.addColorStop(1, `rgba(255,80,160,${0.12 * S.dark * k})`);
      ctx.fillStyle = g; ctx.fillRect(0, HORIZON - 40, BW, 40);
    }
  }

  // the incident of the leg by the road: drawn where the road will stop the rig (x in background pixels on screen)
  function incident(ctx, kind, x0, S, t) {
    // drawn at the rig's size (people as tall as Leyla next to the van), standing on the road's far edge
    const k = 1.7, y = ROAD[0] + 9, x = x0;
    ctx.save(); ctx.translate(x0, y); ctx.scale(k, k); ctx.translate(-x0, -y);
    incidentArt(ctx, kind, x, y, S, t);
    ctx.restore();
  }
  function incidentArt(ctx, kind, x, y, S, t) {
    const dark = c => css(mix(hex(c), [12, 10, 24], S.dark * 0.6));
    const glow = (gx, gy, r, col, a) => { const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(gx - r, gy - r, r * 2, r * 2); };
    if (kind === 'barrier') {
      ctx.fillStyle = dark('#5a4e44'); for (let i = 0; i < 5; i++) ctx.fillRect(x + i * 6, y - 7 + (i % 2), 5, 7 - (i % 2));
      ctx.fillStyle = dark('#b4202a'); ctx.fillRect(x - 2, y - 11, 34, 2); ctx.fillStyle = dark('#fffc40'); for (let i = 0; i < 34; i += 6) ctx.fillRect(x - 2 + i, y - 11, 3, 2);
      ctx.fillStyle = dark('#322b28'); ctx.fillRect(x + 36, y - 9, 6, 9);   // a burning barrel
      const f = 0.7 + 0.3 * Math.sin(t * 23) * Math.sin(t * 7);
      glow(x + 39, y - 12, 26, '255,140,40', 0.35 * f); ctx.fillStyle = `rgba(255,${180 + 60 * f},60,1)`; ctx.fillRect(x + 37, y - 12 - Math.round(2 * f), 4, 3);
    } else if (kind === 'creatures') {   // eyes in the scrub behind the road; the creatures themselves stand by the road (Figuren)
      for (let i = 0; i < 7; i++) {
        const fx = x + 6 + i * 7 + Math.round(Math.sin(t * 0.7 + i) * 2), fy = y - 10 - (i % 3) * 3;
        ctx.fillStyle = dark('#24523b'); ctx.fillRect(fx - 3, fy - 1, 7, 4);
        if (Math.sin(t * 1.3 + i * 2.1) > -0.85) { ctx.fillStyle = 'rgba(160,255,90,1)'; ctx.fillRect(fx - 1, fy, 1, 1); ctx.fillRect(fx + 1, fy, 1, 1); glow(fx, fy, 4, '160,255,90', 0.45); }
      }
    } else if (kind === 'truck') {
      ctx.fillStyle = dark('#4a5462'); ctx.fillRect(x, y - 14, 30, 11); ctx.fillStyle = dark('#73172d'); ctx.fillRect(x + 30, y - 12, 10, 9); ctx.fillRect(x + 32, y - 15, 7, 3);
      ctx.fillStyle = dark('#141013'); for (const wx of [x + 3, x + 12, x + 33]) ctx.fillRect(wx, y - 3, 5, 3);
      ctx.fillStyle = dark('#a6fcdb'); ctx.fillRect(x + 34, y - 11, 4, 3);
      if (Math.sin(t * 6) > 0) { glow(x, y - 6, 10, '255,170,40', 0.6); glow(x + 40, y - 6, 10, '255,170,40', 0.6); ctx.fillStyle = 'rgb(255,190,60)'; ctx.fillRect(x - 1, y - 6, 2, 2); ctx.fillRect(x + 40, y - 6, 2, 2); }
      ctx.fillStyle = 'rgba(200,200,210,.5)'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 36 + Math.round(Math.sin(t + i) * 2), y - 18 - i * 3 - (t * 6 % 3), 2, 2);
    } else if (kind === 'trader') {
      ctx.fillStyle = dark('#5b3138'); ctx.fillRect(x, y - 12, 26, 9); ctx.fillStyle = dark('#e86a73'); for (let i = 0; i < 26; i += 4) ctx.fillRect(x + i, y - 16, 2, 4);
      ctx.fillStyle = dark('#fad6b8'); for (let i = 1; i < 26; i += 4) ctx.fillRect(x + i, y - 16, 2, 4);
      ctx.fillStyle = dark('#141013'); ctx.fillRect(x + 3, y - 3, 5, 3); ctx.fillRect(x + 18, y - 3, 5, 3);
      for (let i = 0; i < 4; i++) { const lx = x + 2 + i * 7, ly = y - 18 + (i % 2); const f = 0.8 + 0.2 * Math.sin(t * 5 + i); ctx.fillStyle = `rgba(255,200,90,${f})`; ctx.fillRect(lx, ly, 1, 2); glow(lx, ly, 7, '255,190,80', 0.25 * f); }
    } else if (kind === 'hitchhiker') {
      ctx.fillStyle = dark('#4a5462'); ctx.fillRect(x + 14, y - 18, 1, 18); ctx.fillStyle = dark('#df3e23'); ctx.fillRect(x + 10, y - 20, 9, 4);
      ctx.fillStyle = dark('#bb7547'); ctx.fillRect(x - 4, y - 4, 4, 4);
    } else if (kind === 'campfire') {   // a fire of tyres and pallets, sparks rising, a pool of warm light
      const f = 0.7 + 0.3 * Math.sin(t * 19) * Math.sin(t * 6.3);
      glow(x + 8, y - 4, 34, '255,150,60', 0.4 * f);
      ctx.fillStyle = dark('#322b28'); ctx.fillRect(x, y - 3, 17, 3); ctx.fillRect(x + 2, y - 5, 4, 2); ctx.fillRect(x + 11, y - 5, 4, 2);
      for (let j = 0; j < 6; j++) { const w = 9 - j * 1.5, hh = Math.round(2 * f + Math.sin(t * 13 + j) * 0.8); ctx.fillStyle = j < 2 ? `rgb(255,${120 + 60 * f},40)` : j < 4 ? `rgb(255,${180 + 50 * f},70)` : 'rgb(255,240,170)'; ctx.fillRect(Math.round(x + 8.5 - w / 2 + Math.sin(t * 7 + j) * 0.6), y - 4 - j * 2 - hh, Math.max(1, Math.round(w)), 2 + hh); }
      for (let i = 0; i < 6; i++) { const life = (t * 0.7 + i / 6) % 1; ctx.fillStyle = `rgba(255,200,90,${1 - life})`; ctx.fillRect(Math.round(x + 8 + Math.sin(t * 2 + i * 4) * 4 * life), Math.round(y - 10 - life * 26), 1, 1); }
      ctx.fillStyle = dark('#5a4e44'); ctx.fillRect(x - 10, y - 3, 6, 3); ctx.fillRect(x + 22, y - 3, 7, 3);   // seats: crates
    } else if (kind === 'wreck') {   // a car on its roof, wheels in the air, smoke
      ctx.fillStyle = dark('#73172d'); ctx.fillRect(x, y - 7, 26, 6); ctx.fillRect(x + 6, y - 2, 13, 2);
      ctx.fillStyle = dark('#141013'); ctx.fillRect(x + 3, y - 11, 5, 4); ctx.fillRect(x + 18, y - 11, 5, 4);
      ctx.fillStyle = dark('#a6fcdb'); ctx.fillRect(x + 8, y - 2, 4, 1);
      for (let i = 0; i < 8; i++) { const life = (t * 0.3 + i / 8) % 1, r = 1 + life * 3.5; ctx.fillStyle = `rgba(70,64,72,${0.4 * (1 - life)})`; ctx.beginPath(); ctx.arc(x + 20 + life * 8 + Math.sin(t + i) * 1.5, y - 10 - life * 24, r, 0, Math.PI * 2); ctx.fill(); }
      if (Math.sin(t * 9) > 0.6) { ctx.fillStyle = 'rgb(255,190,80)'; ctx.fillRect(x + 22, y - 6, 2, 2); glow(x + 23, y - 5, 6, '255,160,60', 0.4); }
    } else if (kind === 'bus') {   // an old bus, doors open, a dim light inside now and then
      ctx.fillStyle = dark('#f9a31b'); ctx.fillRect(x, y - 16, 44, 13); ctx.fillStyle = dark('#141013'); ctx.fillRect(x + 4, y - 3, 6, 3); ctx.fillRect(x + 32, y - 3, 6, 3);
      for (let i = 0; i < 6; i++) { const lit = S.dark > 0.3 && Math.sin(t * 0.9 + i * 1.7) > 0.85; ctx.fillStyle = lit ? 'rgba(170,230,255,.9)' : dark('#242234'); ctx.fillRect(x + 3 + i * 6, y - 14, 4, 4); }
      ctx.fillStyle = dark('#141013'); ctx.fillRect(x + 38, y - 13, 4, 10); ctx.fillStyle = dark('#b4202a'); ctx.fillRect(x, y - 7, 44, 1);
    } else if (kind === 'drone') {   // a courier drone nose down in the sand, sparks, a blinking SOS light
      ctx.save(); ctx.translate(x + 10, y - 6); ctx.rotate(0.5);
      ctx.fillStyle = dark('#4a5462'); ctx.fillRect(-9, -3, 18, 6); ctx.fillStyle = dark('#20d6c7'); ctx.fillRect(-2, -1, 4, 2);
      ctx.fillStyle = dark('#333941'); ctx.fillRect(-12, -5, 6, 1); ctx.fillRect(6, -5, 6, 1); ctx.restore();
      const sos = [1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0][Math.floor(t * 4) % 12];
      if (sos) { ctx.fillStyle = 'rgb(255,70,70)'; ctx.fillRect(x + 16, y - 10, 2, 2); glow(x + 17, y - 9, 8, '255,60,60', 0.5); }
      if (Math.random() < 0.3) { ctx.fillStyle = 'rgb(180,240,255)'; ctx.fillRect(x + 4 + Math.round(Math.random() * 10), y - 8 - Math.round(Math.random() * 6), 1, 1); }
    } else if (kind === 'shrine') {   // a little shrine by a mile stone: photos, a figure, candles
      ctx.fillStyle = dark('#5a4e44'); ctx.fillRect(x, y - 12, 12, 12); ctx.fillStyle = dark('#423934'); ctx.fillRect(x - 1, y - 14, 14, 2);
      ctx.fillStyle = dark('#c7b08b'); ctx.fillRect(x + 4, y - 10, 4, 6);
      for (let i = 0; i < 5; i++) { const f = 0.7 + 0.3 * Math.sin(t * 11 + i * 3); const cx = x - 6 + i * 6, cy = y - 2; ctx.fillStyle = dark('#fef3c0'); ctx.fillRect(cx, cy, 1, 2); ctx.fillStyle = `rgba(255,${190 + 40 * f},90,1)`; ctx.fillRect(cx, cy - 1, 1, 1); glow(cx, cy - 1, 6, '255,190,90', 0.3 * f); }
    } else if (kind === 'tower') {   // a radio mast, blinking in a pattern that is no accident
      ctx.fillStyle = dark('#4a5462'); ctx.fillRect(x + 5, y - 44, 1, 44); for (let i = 0; i < 44; i += 6) { ctx.fillRect(x + 3, y - i - 1, 5, 1); ctx.fillRect(x + 4, y - i - 4, 1, 3); ctx.fillRect(x + 6, y - i - 4, 1, 3); }
      ctx.fillRect(x + 1, y - 40, 9, 1); ctx.fillRect(x + 2, y - 36, 7, 1);
      const on = [1, 1, 0, 1, 0, 0, 1, 0][Math.floor(t * 3) % 8];
      if (on) { ctx.fillStyle = 'rgb(255,90,200)'; ctx.fillRect(x + 5, y - 46, 1, 2); glow(x + 5, y - 45, 12, '255,90,200', 0.55); }
    } else if (kind === 'rocks') {   // a landslide across the road
      for (let i = 0; i < 11; i++) { const mid = 1 - Math.abs(i - 5) / 6, w = 4 + Math.floor(hash(i, 3) * 6), h = Math.round(3 + mid * 9 + hash(i, 4) * 4); ctx.fillStyle = dark(i % 2 ? '#71413b' : '#5a4e44'); ctx.fillRect(x + i * 4, y - h, w, h); ctx.fillStyle = dark('#8e5252'); ctx.fillRect(x + i * 4, y - h, w, 1); }
    } else if (kind === 'flare') {
      const f = 0.6 + 0.4 * Math.sin(t * 31) * Math.sin(t * 13);
      glow(x, y - 2, 30, '255,40,40', 0.45 * f); ctx.fillStyle = 'rgb(255,120,110)'; ctx.fillRect(x - 1, y - 2, 2, 2);
      ctx.fillStyle = 'rgba(230,90,90,.35)'; for (let i = 0; i < 7; i++) ctx.fillRect(x + Math.round(Math.sin(t * 0.8 + i) * 3 - i * 1.5), y - 6 - i * 4, 3 + i, 3);
    }
  }

  // the Sandsturm: a towering, churning wall of dust from x to the right edge, darker at its foot
  function dustWall(ctx, x0, S, st, t) {
    const col = mix(hex('#bb7547'), S.hor, 0.25).map(v => Math.round(v * (1 - S.dark * 0.7))), deep = col.map(v => Math.round(v * 0.62));
    for (let x = Math.max(0, Math.floor(x0 - 60)); x < BW; x++) {
      const k = Math.min(1, (x - x0 + 60) / 120), top = Math.round(30 + 60 * (1 - k) + 22 * noise((x + t * 30) / 26, seed + 90) + 10 * noise((x - t * 50) / 9, seed + 91));
      const g = ctx.createLinearGradient(0, top, 0, ROAD[1]); g.addColorStop(0, css(col, 0)); g.addColorStop(0.18, css(col, 0.75 * k)); g.addColorStop(1, css(deep, 0.95 * k));
      ctx.fillStyle = g; ctx.fillRect(x, top, 1, ROAD[1] - top);
    }
  }
  // #115 the region's painted layers, half size in background pixels (the road is chunkier than the camp), mirrored repeat, toned like the
  // code landscape: haze by depth, warm evening, dark night, rain, dust and fog veil them. → drawn?
  // near = the layers faster than 8 % (#147): they stand along the far side of the road instead of the code's hills and things
  function painted(ctx, st, S, L, near = false) {
    const P = L.parallax && D.parallax?.[L.parallax];
    if (!P || !art) return false;
    const layers = (P.layers || []).filter(l => near ? (l.speed ?? 5) > 8 : (l.speed ?? 5) <= 8).map(l => ({ l, img: imgOf(l.look) })).filter(x => x.img);
    if (!layers.length) return false;
    layers.forEach(({ l, img }, i) => {
      const k = (l.scale ?? 300) / 100 * (D.travel?.drive?.layerScale ?? 11) / 100 * (near ? (D.travel?.drive?.nearScale ?? 70) / 100 : 1), w = img.naturalWidth * k, h = img.naturalHeight * k;
      if (w < 4 || h < 4) return;
      const depth = near ? 0.06 : Math.max(0, 0.75 - i * 0.3), bottom = near ? ROAD[0] + 3 : HORIZON + 1 + Math.round((l.bottom ?? 0) * k * 0.25), p = near ? 0.55 : (l.speed ?? 5) / 100 * 0.6;
      strip(ctx, img, { w, h, bottom, p, depth, S, st });
    });
    return true;
  }
  // st.ws: background pixels per world pixel (the rig's scale on screen, so props and people match Leyla and the van)
  // n: device pixels per background pixel of ctx (the caller's canvas is BW·n × BH·n)
  function draw(ctx, st, scale = 1) {
    n = Math.max(1, scale);
    ctx.save(); ctx.setTransform(n, 0, 0, n, 0, 0);
    drawScene(ctx, st);
    ctx.restore();
  }
  function drawScene(ctx, st) {
    const S = skyAt(st.hour), t = st.t, [A, B, k] = st.land, L = k < 0.5 ? A : B, ws = st.ws || 0.15;
    drawSky(S, st.wet || 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sky, 0, 0);
    if (st.flash > 0) { ctx.fillStyle = `rgba(210,200,255,${0.55 * st.flash})`; ctx.fillRect(0, 0, BW, HORIZON + 10); }
    // stars and the milky way at night
    const night = smooth(0.35, 0.75, S.dark) * (1 - (st.wet || 0) * 0.9) * (1 - (st.dust || 0));
    if (night > 0) {
      for (const s of stars) {
        const x = Math.round((s.x - st.dist * 0.002) % BW + BW) % BW, tw = 0.55 + 0.45 * Math.sin(t * (1.1 + s.p * 0.3) + s.p * 7);
        ctx.fillStyle = `rgba(255,244,216,${night * tw})`; ctx.fillRect(x, Math.round(s.y), 1, 1);
        if (s.big) { ctx.fillStyle = `rgba(255,244,216,${night * tw * 0.4})`; ctx.fillRect(x - 1, Math.round(s.y), 3, 1); ctx.fillRect(x, Math.round(s.y) - 1, 1, 3); }
      }
      for (let i = 0; i < 260; i++) {   // the milky way: a diagonal band of faint dots
        const u = hash(i, seed + 50), x = Math.round(u * BW), y = Math.round(10 + u * 70 + (hash(i, seed + 51) - 0.5) * 26);
        ctx.fillStyle = `rgba(190,180,255,${night * 0.18 * hash(i, 52)})`; ctx.fillRect(x, y, 1, 1);
      }
    }
    // moon
    if (S.moon.alt > 0 && S.dark > 0.2) {
      const mx = Math.round(BW * S.moon.x), my = Math.round(HORIZON - 12 - S.moon.alt * 95), a = smooth(0.2, 0.6, S.dark) * (1 - (st.wet || 0) * 0.7);
      const g = ctx.createRadialGradient(mx, my, 2, mx, my, 34); g.addColorStop(0, `rgba(200,210,255,${0.22 * a})`); g.addColorStop(1, 'rgba(200,210,255,0)');
      ctx.fillStyle = g; ctx.fillRect(mx - 34, my - 34, 68, 68);
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (dx * dx + dy * dy <= 36 && (dx + 3) * (dx + 3) + (dy - 1) * (dy - 1) > 26) { ctx.fillStyle = `rgba(255,250,225,${a})`; ctx.fillRect(mx + dx, my + dy, 1, 1); }
    }
    // sun: big and striped near the horizon, small and white up high; rays fan out at low sun
    const sx = Math.round(BW * S.sun.x), sy = Math.round(HORIZON + 4 - S.sun.alt * 120), R = Math.round(8 + 14 * clamp(1 - S.sun.alt / 0.5));
    const veil = 1 - (st.wet || 0) * 0.85 - (st.dust || 0) * 0.5 - (st.fog || 0) * 0.4;
    if (S.sun.alt > -0.08 && veil > 0) {
      const g = ctx.createRadialGradient(sx, sy, R * 0.5, sx, sy, R * 5); g.addColorStop(0, css(S.sun.col, 0.45 * veil)); g.addColorStop(1, css(S.sun.col, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, BW, HORIZON + 30);
      const top = mix(hex('#fffc40'), S.sun.col, 0.3), bottom = mix(S.sun.col, hex('#b4202a'), S.warm * 0.6);
      for (let dy = -R; dy <= R; dy++) {
        const y = sy + dy; if (y > HORIZON + 1) break;
        const half = Math.round(Math.sqrt(Math.max(0, R * R - dy * dy))), kk = (dy + R) / (2 * R);
        if (dy > 0 && S.warm > 0.3) { const band = R / 5, i = Math.floor(dy / band); if (dy - i * band < Math.min(band - 1, i * 0.9)) continue; }
        ctx.fillStyle = css(mix(top, bottom, Math.round(kk * 5) / 5), veil); ctx.fillRect(sx - half, y, half * 2, 1);
      }
    }
    // clouds: dark bodies, lit from below by a low sun, slowly drifting against the drive
    const cDark = mix(mix(S.top, S.mid, 0.5), [30, 20, 40], 0.4), cLight = S.warm > 0.1 ? mix(S.sun.col, hex('#f5a097'), 0.4) : mix([255, 255, 255], S.hor, 0.3);
    const cloudCells = ART.clouds ? (D.assets?.[ART.clouds]?.grid || [1, 1]).reduce((a, b) => a * b, 1) : 0;
    for (const [ci, c] of clouds.entries()) {
      const x = Math.round(((c.x * (BW + 160) - st.dist * 0.03 * c.v - t * 1.5 * c.v) % (BW + 160) + (BW + 160)) % (BW + 160) - 80), y = Math.round(c.y);
      const day = 1 - S.dark;
      if (cloudCells) {   // #162 painted clouds (Fahrt › Grafiken › Wolken), toned by the hour like everything painted
        const sp = sprite(ART.clouds, 1 + ci % cloudCells, t);
        if (sp) { const w = c.w * 0.9 * ART.cloudSize, h = w * sp.sh / sp.sw; ctx.save(); ctx.globalAlpha = 0.92 * (1 - S.dark * 0.5); put(ctx, sp, x, y + h * 0.6, w, h, 0.6, S, st, ci % 2 === 1); ctx.restore(); continue; }
      }
      ctx.fillStyle = css(mix(cDark, mix([235, 235, 245], S.hor, 0.3), day * 0.7 * (1 - S.warm * 0.6)), 0.9); ctx.fillRect(x, y, Math.round(c.w), c.h);
      ctx.fillRect(x + 6, y - 1, Math.round(c.w * 0.5), 1);
      ctx.fillStyle = css(cLight, (0.25 + 0.6 * S.warm) * (1 - S.dark * 0.8)); ctx.fillRect(x + 3, y + c.h, Math.round(c.w * 0.75), 1);
    }
    // crepuscular rays from a low sun (Reisen › Fahrt › Lichtstrahlen)
    const rays = driveConfig(D).rays * smooth(0.5, 0.05, S.sun.alt) * (S.sun.alt > -0.12 ? 1 : 0) * clamp(veil);
    if (rays > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.05 + 0.9 * hash(i, seed + 60)) + Math.sin(t * 0.2 + i) * 0.03, len = 260, wdt = 0.05 + 0.05 * hash(i, 61);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, len); g.addColorStop(0, css(S.sun.col, 0.16 * rays * (0.6 + 0.4 * Math.sin(t * 0.7 + i * 2)))); g.addColorStop(1, css(S.sun.col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, len, Math.PI + a - wdt, Math.PI + a + wdt); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // lightning: a bolt somewhere over the horizon
    if (bolt && st.flash > 0.3) {
      ctx.fillStyle = `rgba(240,235,255,${st.flash})`;
      let bx = bolt.x, by = 0; while (by < HORIZON - 6) { ctx.fillRect(bx, by, 1, 3); by += 3; bx += Math.round((hash(by, bolt.s) - 0.5) * 4); if (hash(by, bolt.s + 1) < 0.08) { let cx = bx, cy = by; for (let j = 0; j < 6; j++) { cx += hash(j, cy) < 0.5 ? -1 : 1; cy += 2; ctx.fillRect(cx, cy, 1, 2); } } }
    }
    // #115 painted parallax layers of the region (Welt › Parallax-Sets) instead of the city and the far relief from code
    if (!painted(ctx, st, S, L)) {
      city(ctx, st, S, L, t);
      drawLayer(ctx, st, S, { p: 0.03, base: HORIZON + 1, H: 46, depth: 0.85, s: seed + 11, color: 'far' });
    }
    // the plain between the hills and the road: dithered, lighter towards the horizon (salt flats shine); #147 painted over it when there is art
    const plain = !!art && !!(imgOf(L.parallax && D.parallax?.[L.parallax]?.plain?.look) || imgOf(ART.plain));
    for (let y = HORIZON + 1; y < BH; y++) {
      const kk = (y - HORIZON) / (BH - HORIZON), c = tone(L.ground, 0.75 * (1 - kk) + 0.05, S, st), c2 = tone(L.ground, 0.75 * (1 - kk) + 0.12, S, st);
      if (plain) { ctx.fillStyle = css(c); ctx.fillRect(0, y, BW, 1); continue; }   // #147 under the painted plain: no dither, no pebbles
      for (let x = 0; x < BW; x += 4) { ctx.fillStyle = css(BAYER[(y & 3) * 4 + ((x >> 2) & 3)] < 6 ? c2 : c); ctx.fillRect(x, y, 4, 1); }
      if (y < ROAD[0] && !plain) {   // pebbles and scrub on the plain: every row passes at its own speed, slow far away, fast near the road
        const pp = 0.03 + 0.9 * Math.pow(kk / ((ROAD[0] - HORIZON) / (BH - HORIZON)), 1.6), o = st.dist * pp, dot = tone(L.plants, 0.75 * (1 - kk), S, st);
        ctx.fillStyle = css(dot, 0.7);
        for (let x = 0; x < BW; x++) if (hash(Math.floor(x + o), y * 131 + seed) < 0.012 + kk * 0.02) ctx.fillRect(x, y, kk > 0.3 ? 2 : 1, 1);
      }
    }
    if (L.relief === 'flat' && S.dark < 0.6) {   // mirage over the salt: a mirrored, shimmering stripe of the sky
      for (let y = 0; y < 6; y++) { const off = Math.round(Math.sin(t * 3 + y) * 2); ctx.globalAlpha = 0.35 * (1 - y / 6) * (1 - S.dark); ctx.drawImage(sky, 0, HORIZON - 4 - y, BW, 1, off, HORIZON + 2 + y, BW, 1); }
      ctx.globalAlpha = 1;
    }
    if (plain) paintedPlain(ctx, st, S, L);
    // #147 the region's near painted layers stand in for the code's hills and the things in the middle distance
    const nearArt = !!art && !!(L.parallax && (D.parallax?.[L.parallax]?.layers || []).some(l => (l.speed ?? 5) > 8 && imgOf(l.look)));
    if (!nearArt) drawLayer(ctx, st, S, { p: 0.14, base: 176, H: 24, depth: 0.45, s: seed + 12, color: 'mid', kind: L.relief === 'flat' ? 'flat' : L.relief === 'jagged' ? 'jagged' : 'hills' });
    // giant digital billboards of the brands (#055, Daniel: „riesige digitale Billboards für unsere ganzen Brands … lass dort Werbung laufen“):
    // a steel frame on two masts towering over the plain; the picture on the screen is drawn sharp by ads() over the scaled background
    screens = [];
    if (adList.length) {
      const off = st.dist * 0.1, cw = 230;
      for (let ci = Math.floor((off - 120) / cw); ci * cw - off < BW + 40; ci++) {
        const x = Math.round(ci * cw - off + hash(ci, seed + 71) * 60), Lc = landAt(st, x / 0.1 + st.dist);
        if (hash(ci, seed + 70) * 100 >= (Lc.screens ?? 25)) continue;
        const w = 64 + Math.floor(hash(ci, seed + 72) * 3) * 8, h = Math.round(w * 0.55), y = 66 + Math.floor(hash(ci, seed + 73) * 14), base = 180;
        const board = imgOf(ART.billboard);
        if (board) {   // #147 the painted billboard (the cockpit's): the screen rect of the art gets the ads
          const B = adList[Math.floor(hash(ci, seed + 74) * adList.length)], [ax, ay] = ART.screenAt, [aw, ah] = ART.screenSize;
          const sw = w * ART.billboardSize, s = sw / aw, bw = board.naturalWidth * s, bh = board.naturalHeight * s, foot = base + 2, sy = foot - bh + ay * s;
          put(ctx, { img: board, sx: 0, sy: 0, sw: board.naturalWidth, sh: board.naturalHeight }, x - ax * s, foot, bw, bh, 0.3, S, st);
          if (S.dark > 0.2) { const g = ctx.createRadialGradient(x + sw / 2, foot, 2, x + sw / 2, foot, sw * 0.7); g.addColorStop(0, css(hex(B.color), 0.22 * S.dark)); g.addColorStop(1, css(hex(B.color), 0)); ctx.fillStyle = g; ctx.fillRect(x - sw, foot - sw, sw * 3, sw * 1.4); }
          screens.push({ x, y: sy, w: sw, h: ah * s, brand: B, ph: hash(ci, seed + 75) * 20, ci });
          continue;
        }
        const steel = tone('#242234', 0.4, S, st), lit = tone('#4a5462', 0.35, S, st), B = adList[Math.floor(hash(ci, seed + 74) * adList.length)];
        ctx.fillStyle = css(steel);
        for (const mx of [x + Math.round(w * 0.25), x + Math.round(w * 0.75)]) { ctx.fillRect(mx - 1, y + h, 3, base - y - h); for (let yy = y + h + 6; yy < base; yy += 8) { ctx.fillRect(mx - 3, yy, 7, 1); } }
        ctx.fillRect(x - 2, y - 2, w + 4, h + 4); ctx.fillStyle = css(lit); ctx.fillRect(x - 2, y - 2, w + 4, 1); ctx.fillRect(x + 4, y + h + 2, w - 8, 2);
        ctx.fillStyle = css(mix(hex(B.color), [8, 6, 14], 0.82)); ctx.fillRect(x, y, w, h);
        // red aircraft lamps on top, the screen's light on the ground at night
        if (Math.sin(t * 2.2 + ci) > 0) { ctx.fillStyle = 'rgb(255,60,60)'; ctx.fillRect(x - 2, y - 4, 1, 2); ctx.fillRect(x + w + 1, y - 4, 1, 2); }
        if (S.dark > 0.2) { const g = ctx.createRadialGradient(x + w / 2, base, 2, x + w / 2, base, w * 0.9); g.addColorStop(0, css(hex(B.color), 0.22 * S.dark)); g.addColorStop(1, css(hex(B.color), 0)); ctx.fillStyle = g; ctx.fillRect(x - w, base - w, w * 3, w * 1.4); }
        screens.push({ x, y, w, h, brand: B, ph: hash(ci, seed + 75) * 20, ci });
      }
    }
    // things in the middle distance (p 0.35)
    const midOff = st.dist * 0.35, cw = 46;
    const brandsOn = brands.filter(b => b.icon != null);
    if (nearArt) painted(ctx, st, S, L, true);
    else for (let ci = Math.floor((midOff - 60) / cw); ci * cw - midOff < BW + 20; ci++) {
      const x = Math.round(ci * cw - midOff + hash(ci, seed + 20) * 20), Lc = landAt(st, x / 0.35 + st.dist), r = hash(ci, seed + 21) * 100, y = 196;
      const c = tone(Lc.rock, 0.3, S, st), lit = S.dark;
      let acc = 0;
      if (r < (acc += Lc.ruins)) ruin(ctx, x, y, 14 + Math.floor(hash(ci, 3) * 18), 10 + Math.floor(hash(ci, 4) * 22), tone('#5a4e44', 0.3, S, st), lit, ci);
      else if (r < (acc += Lc.wrecks)) wreck(ctx, x, y, tone(hash(ci, 5) < 0.5 ? '#73172d' : '#285cc4', 0.35, S, st), ci);
      else if (r < (acc += Lc.towers)) (hash(ci, 6) < 0.5 ? tower : (cx, xx, yy, cc) => turbine(cx, xx, yy, cc, t, ci))(ctx, x, y, tone('#4a5462', 0.3, S, st));
      else if (r < (acc += Lc.signs) && brandsOn.length) billboard(ctx, x, y, tone('#322b28', 0.25, S, st), brandsOn[Math.floor(hash(ci, 7) * brandsOn.length)], S, t);
      else if (r < (acc += Lc.plantsN)) { cactus(ctx, x, y, tone(Lc.plants, 0.3, S, st), ci); bush(ctx, x + 9, y, tone(Lc.plants, 0.3, S, st), ci); }
      else if (r < acc + 15) { ctx.fillStyle = css(c); ctx.fillRect(x, y - 4, 7, 4); ctx.fillRect(x + 2, y - 6, 4, 2); }
    }
    // pylons with sagging wires (p 0.45)
    if ((L.pylons ?? 0) > 0) {
      const off = st.dist * 0.45, gap = 96, c = tone('#333941', 0.3, S, st), ys = [];
      ctx.fillStyle = css(c);
      const psp = ART.pylon ? sprite(ART.pylon, 1, t) : null;
      for (let i = Math.floor((off - gap) / gap); i * gap - off < BW + gap; i++) {
        const x = Math.round(i * gap - off); ys.push(x);
        if (psp) { const h = 40, w = psp.sw * h / psp.sh; put(ctx, psp, x - w / 2, 205, w, h, 0.45, S, st); continue; }   // #162 the painted pylon, wires stay code
        ctx.fillRect(x, 168, 1, 36); ctx.fillRect(x - 3, 170, 7, 1); ctx.fillRect(x - 2, 175, 5, 1); ctx.fillRect(x - 1, 180, 1, 24); ctx.fillRect(x + 1, 180, 1, 24);
      }
      ctx.strokeStyle = css(c, 0.8); ctx.lineWidth = 1; ctx.beginPath();
      for (let j = 0; j + 1 < ys.length; j++) for (const dy of [170, 175]) { ctx.moveTo(ys[j] - 3 + (dy === 175 ? 1 : 0), dy + 0.5); ctx.quadraticCurveTo((ys[j] + ys[j + 1]) / 2, dy + 9, ys[j + 1] - 3 + (dy === 175 ? 1 : 0), dy + 0.5); }
      ctx.stroke();
    }
    // tumbleweeds (dry regions, with dust or wind)
    if ((st.dust || 0) > 0.1 || L.relief === 'dunes') {
      while (weeds.length < 2) weeds.push({ x: BW + 20 + Math.random() * 300, v: 10 + Math.random() * 20, ph: Math.random() * 6 });
      for (const w of weeds) {
        w.x -= ((st.v || 0) * 0.7 + w.v * (1 + (st.dust || 0) * 2)) * (st.dt || 0);   // rolls against the drive, faster in the wind
        if (w.x < -20) { w.x = BW + 20 + Math.random() * 400; w.v = 10 + Math.random() * 20; }
        const y = 210 - Math.abs(Math.sin(t * 4 + w.ph)) * 4, sp = sprite(ART.weed, ART.weedCell);
        if (sp) {   // #147 the painted tumbleweed, rolling
          const hh = sp.h * ws, ww = sp.sw * hh / sp.sh;
          ctx.save(); ctx.translate(w.x, y - hh * 0.4); ctx.rotate(-t * 5 - w.ph); put(ctx, sp, -ww / 2, hh / 2, ww, hh, 0.05, S, st); ctx.restore();
          continue;
        }
        ctx.fillStyle = css(tone('#796755', 0.1, S, st));
        for (let i = 0; i < 12; i++) { const a = i * 0.55 - t * 6; ctx.fillRect(Math.round(w.x + Math.cos(a) * 3), Math.round(y - 3 + Math.sin(a) * 3), 1, 1); }
        ctx.fillRect(Math.round(w.x) - 1, Math.round(y) - 4, 2, 2);
      }
    }
    // telegraph poles with two wires right by the road (p 0.8)
    if ((L.poles ?? 1) > 0) {
      const off = st.dist * 0.8, gap = 70, c = tone('#423934', 0.08, S, st), xs = [], sp = sprite(ART.pole, ART.poleCell);
      // #147 a painted pole (the black silhouette of a power pole): the wires hang from its cross arm
      const ph = 44, pw = sp ? sp.sw * ph / sp.sh : 0, arm = sp ? [Math.round(pw * 0.3), 172 + Math.round(ph * 0.1)] : [4, 174];
      for (let i = Math.floor((off - gap) / gap); i * gap - off < BW + gap; i++) {
        const x = Math.round(i * gap - off); xs.push(x);
        if (sp) { put(ctx, sp, x - pw / 2, 172 + ph, pw, ph, 0.08, S, st); continue; }
        ctx.fillStyle = css(c); ctx.fillRect(x, 172, 2, 41); ctx.fillRect(x - 4, 175, 10, 1); ctx.fillRect(x - 4, 174, 1, 1); ctx.fillRect(x + 5, 174, 1, 1);
      }
      ctx.strokeStyle = css(c, 0.9); ctx.lineWidth = sp ? 0.5 : 1; ctx.beginPath();
      for (let j = 0; j + 1 < xs.length; j++) for (const dx of sp ? [-arm[0], arm[0]] : [-4, 5]) { ctx.moveTo(xs[j] + dx + 0.5, arm[1] + 0.5); ctx.quadraticCurveTo((xs[j] + xs[j + 1]) / 2, arm[1] + 9, xs[j + 1] + dx + 0.5, arm[1] + 0.5); }
      ctx.stroke(); ctx.lineWidth = 1;
    }
    roadside(ctx, st, S, ws);   // #147 painted things on the far shoulder
    // the road: shoulder, asphalt with grain and patches, the dashed middle line (p 1)
    const roff = st.dist, asphalt = tone(L.road, 0, S, st), dash = tone('#ffd541', 0, S, st), edge = tone('#c7b08b', 0.02, S, st);
    const roadArt = paintedRoad(ctx, st, S);
    if (!roadArt) {
    ctx.fillStyle = css(edge); ctx.fillRect(0, ROAD[0], BW, 2);
    ctx.fillStyle = css(asphalt); ctx.fillRect(0, ROAD[0] + 2, BW, ROAD[1] - ROAD[0] - 4);
    for (let x = 0; x < BW; x++) {
      const wx = Math.floor(x + roff);
      if (hash(wx, seed + 40) < 0.25) { ctx.fillStyle = css(mix(asphalt, [0, 0, 0], 0.22)); ctx.fillRect(x, ROAD[0] + 3 + Math.floor(hash(wx, 41) * 20), 1, 1); }
      if (noise(wx / 30, seed + 42) > 0.9) { ctx.fillStyle = css(mix(asphalt, [10, 10, 14], 0.3)); ctx.fillRect(x, ROAD[0] + 6 + Math.floor(noise(wx / 13, 43) * 10), 1, 2); }
      if (((wx % 24) + 24) % 24 < 12) { ctx.fillStyle = css(dash, 1 - S.dark * 0.5); ctx.fillRect(x, 225, 1, 1); }
    }
    }
    if (st.wet > 0.1) {   // wet asphalt mirrors the sky
      ctx.globalAlpha = 0.18 * st.wet; ctx.drawImage(sky, 0, HORIZON - 30, BW, 22, 0, ROAD[0] + 3, BW, ROAD[1] - ROAD[0] - 6); ctx.globalAlpha = 1;
    }
    if (!roadArt) { ctx.fillStyle = css(mix(asphalt, edge, 0.5)); ctx.fillRect(0, ROAD[1] - 2, BW, 2); }
    // the incident stands on the road's far lane (over the asphalt); a dust storm is a wall rolling in from the right
    if (st.stop?.kind === 'storm' && st.stop.x != null) dustWall(ctx, st.stop.x, S, st, t);
    else if (st.stop?.kind && st.stop.x != null && !incidentPainted(ctx, st.stop.kind, Math.round(st.stop.x), S, st, ws)) incident(ctx, st.stop.kind, Math.round(st.stop.x), S, t);
    // the near ground below the road and tufts in front (p 1.5, dark); #147 the camp's painted ground instead
    const fo = st.dist * 1.5, fc = tone(L.ground, 0, S, st).map(v => Math.round(v * 0.62)), tuft = tone(L.plants, 0, S, st).map(v => Math.round(v * 0.55));
    const groundArt = paintedGround(ctx, st, S, L, ws);
    if (!groundArt) { ctx.fillStyle = css(fc); ctx.fillRect(0, ROAD[1], BW, BH - ROAD[1]); }
    if (!groundArt) for (let x = -8; x < BW + 8; x++) {
      const wx = Math.floor(x + fo);
      if (hash(wx, seed + 44) < 0.02) {   // a tuft of grass: blades fanning out
        ctx.fillStyle = css(tuft); const hh = 6 + Math.floor(hash(wx, 46) * 9);
        for (let i = -3; i <= 3; i++) { const bh = Math.max(2, hh - Math.abs(i) * 2 - Math.floor(hash(wx, i + 9) * 3)); ctx.fillRect(x + i + Math.round(i * 0.4), BH - 3 - bh, 1, bh); }
        ctx.fillRect(x - 3, BH - 4, 7, 4);
      }
      if (hash(wx, seed + 45) < 0.012) { ctx.fillStyle = css(fc.map(v => v * 0.7)); ctx.fillRect(x, BH - 12, 10, 12); ctx.fillRect(x + 2, BH - 15, 6, 3); }
    }
    // fog lies in bands over the plain
    if (st.fog > 0) for (let i = 0; i < 4; i++) { const y = HORIZON + 8 + i * 16, o = ((t * (4 + i) + st.dist * 0.1 * (i + 1)) % BW); ctx.fillStyle = css(mix([210, 215, 225], S.hor, 0.4).map(v => v * (1 - S.dark * 0.6)), 0.18 * st.fog);
      for (let x = -BW; x < BW * 2; x += 120) ctx.fillRect(Math.round(x - o), y + Math.round(Math.sin(x + i) * 3), 90, 6); }
  }

  // ---------- the ads on the giant screens, sharp at full resolution (#055) ----------
  // a slide every few seconds: the logo with the brand's name, then its lines (Marke › Werbung) as a running or typed text; a glitch
  // between slides, scanlines, a little sun glare by day and a glow round the screen at night
  const adBuf = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  function ads(ctx, W, H, st) {
    if (!adBuf || !screens.length) return;
    const u = W / BW, S = skyAt(st.hour), lg = typeof logos === 'function' ? logos() : logos;
    for (const sc of screens) {
      const x = Math.round(sc.x * u), y = Math.round(sc.y * u), w = Math.round(sc.w * u), h = Math.round(sc.h * u), B = sc.brand, col = hex(B.color);
      if (x > W || x + w < 0) continue;
      adBuf.width = w; adBuf.height = h;
      const c = adBuf.getContext('2d'), n = B.lines.length + 1, period = 3.6, T = st.t * 1 + sc.ph, k = Math.floor(T / period), f = (T % period) / period, slide = k % n;
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, css(mix(col, [10, 8, 20], 0.55))); g.addColorStop(1, css(mix(col, [4, 3, 10], 0.85)));
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      if (slide === 0) {   // the logo and the name
        const z = Math.round(h * 0.62), pulse = 1 + 0.04 * Math.sin(T * 5);
        if (lg && B.icon != null) { c.imageSmoothingEnabled = false; const cx = B.icon % 4, cy = Math.floor(B.icon / 4); c.drawImage(lg, cx * 64, cy * 64, 64, 64, w / 2 - z * pulse / 2, h * 0.06, z * pulse, z * pulse); }
        c.font = `${Math.round(h * 0.24)}px VT323, monospace`; c.fillStyle = css(mix(col, [255, 255, 255], 0.55)); c.shadowColor = css(col); c.shadowBlur = h * 0.12;
        c.fillText(B.name.toUpperCase(), w / 2, h * 0.86); c.shadowBlur = 0;
      } else {   // a line: long ones run through, short ones type themselves
        const line = B.lines[slide - 1], size = Math.round(h * 0.42);
        c.font = `${size}px VT323, monospace`;
        const tw = c.measureText(line).width, hue = mix(col, [255, 255, 255], 0.35 + 0.25 * Math.sin(T * 3));
        c.fillStyle = css(hue); c.shadowColor = css(col); c.shadowBlur = h * 0.15;
        if (tw > w * 0.9) { c.textAlign = 'left'; c.fillText(line, w - f * (tw + w * 1.1), h * 0.52); }
        else { const shown = line.slice(0, Math.max(0, Math.ceil(line.length * Math.min(1, f * 3)))); c.fillText(shown + (f < 0.33 && Math.floor(T * 6) % 2 ? '_' : ''), w / 2, h * 0.52); }
        c.shadowBlur = 0;
        c.fillStyle = css(col, 0.9); c.fillRect(0, h - Math.max(2, h * 0.06), w * f, Math.max(2, h * 0.06));   // the slide's progress
      }
      // scanlines and a few dead pixels
      c.fillStyle = 'rgba(0,0,0,.22)'; for (let yy = 0; yy < h; yy += 3) c.fillRect(0, yy, w, 1);
      if (S.dark < 0.4) { c.fillStyle = `rgba(255,250,230,${0.16 * (1 - S.dark)})`; c.fillRect(0, 0, w, h); }   // sun on the glass
      // a glitch at the change of slides: slices shifted, the colours split
      const glitch = f < 0.06 || (hash(k, sc.ci + 99) < 0.15 && Math.abs(f - 0.5) < 0.02);
      ctx.save(); ctx.globalAlpha = Math.max(0.15, 1 - 0.75 * Math.max(st.dust || 0, st.fog || 0) - 0.3 * (st.wet || 0));   // dust, fog and rain veil it
      if (glitch) {
        for (let yy = 0; yy < h; yy += Math.max(2, Math.round(h / 9))) { const sh = Math.round((hash(yy, Math.floor(st.t * 30)) - 0.5) * w * 0.14), sl = Math.max(2, Math.round(h / 9)); ctx.drawImage(adBuf, 0, yy, w, sl, x + sh, y + yy, w, sl); }
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.35; ctx.drawImage(adBuf, x + 3, y);
      } else ctx.drawImage(adBuf, x, y);
      ctx.restore();
      // the glow round the screen, stronger at night
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(x + w / 2, y + h / 2, h * 0.3, x + w / 2, y + h / 2, w * 0.9); gl.addColorStop(0, css(col, 0.1 + 0.22 * S.dark)); gl.addColorStop(1, css(col, 0));
      ctx.fillStyle = gl; ctx.fillRect(x + w / 2 - w * 0.9, y + h / 2 - w * 0.9, w * 1.8, w * 1.8); ctx.restore();   // the whole circle (#147: flatter screens)
    }
  }

  // ---------- over the rig, at full resolution ----------
  // lights: headlights and the road they light, the sun's glow and lens flare (lighter compositing)
  function light(ctx, W, H, st, rig) {
    const S = skyAt(st.hour), u = W / BW, C = driveConfig(D);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (rig && C.headlights > 0 && S.dark > 0.15) {
      const a = smooth(0.15, 0.6, S.dark) * C.headlights, hx = rig.front, hy = rig.lampY;
      const g = ctx.createLinearGradient(hx, 0, hx + W * 0.5, 0); g.addColorStop(0, `rgba(255,236,190,${0.42 * a})`); g.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(hx, hy - 6 * u * 0.3); ctx.lineTo(hx + W * 0.55, hy - 30 * u); ctx.lineTo(hx + W * 0.55, WHEEL_Y * u + 22 * u); ctx.lineTo(hx, hy + 6 * u * 0.3); ctx.closePath(); ctx.fill();
      const p = ctx.createRadialGradient(hx + W * 0.16, WHEEL_Y * u, 0, hx + W * 0.16, WHEEL_Y * u, W * 0.2); p.addColorStop(0, `rgba(255,230,180,${0.28 * a})`); p.addColorStop(1, 'rgba(255,230,180,0)');
      ctx.fillStyle = p; ctx.save(); ctx.translate(0, WHEEL_Y * u); ctx.scale(1, 0.18); ctx.fillRect(hx - W * 0.05, -W * 0.3 / 0.18 * 0.18 - W, W * 0.5, W * 2); ctx.restore();
      const l = ctx.createRadialGradient(hx, hy, 0, hx, hy, 14 * u); l.addColorStop(0, `rgba(255,250,230,${0.9 * a})`); l.addColorStop(1, 'rgba(255,250,230,0)');
      ctx.fillStyle = l; ctx.fillRect(hx - 14 * u, hy - 14 * u, 28 * u, 28 * u);
      if (st.wet > 0.1) { const r = ctx.createLinearGradient(0, WHEEL_Y * u, 0, WHEEL_Y * u + 9 * u); r.addColorStop(0, `rgba(255,236,190,${0.3 * a * st.wet})`); r.addColorStop(1, 'rgba(255,236,190,0)'); ctx.fillStyle = r; ctx.fillRect(hx, WHEEL_Y * u, W * 0.45, 9 * u); }
      // tail lights, red
      const tg = ctx.createRadialGradient(rig.back, rig.tailY, 0, rig.back, rig.tailY, 10 * u); tg.addColorStop(0, `rgba(255,40,40,${0.8 * a})`); tg.addColorStop(1, 'rgba(255,40,40,0)');
      ctx.fillStyle = tg; ctx.fillRect(rig.back - 10 * u, rig.tailY - 10 * u, 20 * u, 20 * u);
    }
    // the sun's flare: a glow, a horizontal streak and ghosts across the picture (Reisen › Fahrt › Lens Flare)
    const veil = clamp(1 - (st.wet || 0) * 0.9 - (st.dust || 0) * 0.6 - (st.fog || 0) * 0.5);
    if (C.flare > 0 && S.sun.alt > -0.05 && S.sun.alt < 0.6 && veil > 0) {
      const sx = W * S.sun.x, sy = (HORIZON + 4 - S.sun.alt * 120) * u, a = C.flare * veil * smooth(0.6, 0.15, S.sun.alt);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 90 * u); g.addColorStop(0, css(S.sun.col, 0.35 * a)); g.addColorStop(1, css(S.sun.col, 0));
      ctx.fillStyle = g; ctx.fillRect(sx - 90 * u, sy - 90 * u, 180 * u, 180 * u);
      const s = ctx.createLinearGradient(sx - W * 0.5, 0, sx + W * 0.5, 0); s.addColorStop(0, 'rgba(255,200,150,0)'); s.addColorStop(0.5, `rgba(255,220,170,${0.25 * a})`); s.addColorStop(1, 'rgba(255,200,150,0)');
      ctx.fillStyle = s; ctx.fillRect(sx - W * 0.5, sy - 1.5 * u, W, 3 * u);
      const cx = W / 2, cy = H / 2;
      [[0.35, 10, '255,170,90'], [0.65, 5, '120,220,255'], [1.15, 16, '255,120,200'], [1.45, 7, '255,220,120']].forEach(([f, r, col], i) => {
        const gx = sx + (cx - sx) * f * 2, gy = sy + (cy - sy) * f * 2, gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, r * u);
        gr.addColorStop(0, `rgba(${col},${0.1 * a})`); gr.addColorStop(0.7, `rgba(${col},${0.06 * a})`); gr.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, r * u, 0, Math.PI * 2); ctx.fill();
        if (i === 2) { ctx.strokeStyle = `rgba(${col},${0.08 * a})`; ctx.lineWidth = 2; ctx.stroke(); }
      });
    }
    ctx.restore();
  }
  // in front: rain streaks slanted by the speed, dust blowing by, a vignette and film grain
  function front(ctx, W, H, st) {
    const u = W / BW, S = skyAt(st.hour), C = driveConfig(D);
    if (st.wet > 0.02) {
      const n = Math.round(260 * st.wet), slant = 0.25 + (st.v || 0) / 300;
      while (drops.length < n) drops.push({ x: Math.random() * W, y: Math.random() * H, k: 0.5 + Math.random() * 0.8 });
      drops.length = n;
      ctx.strokeStyle = `rgba(190,205,240,${0.35 + 0.2 * S.dark})`; ctx.lineWidth = Math.max(1, u * 0.5); ctx.beginPath();
      for (const d of drops) {
        const vy = 900 * d.k * u / 4, vx = -vy * slant;
        d.x += vx * st.dt; d.y += vy * st.dt;
        if (d.y > H) { d.y = -20; d.x = Math.random() * (W * 1.4); }
        if (d.x < -20) d.x += W + 40;
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - vx * 0.03, d.y - vy * 0.03);
      }
      ctx.stroke();
      // splashes on the road
      ctx.fillStyle = 'rgba(200,215,245,.5)';
      for (let i = 0; i < 18 * st.wet; i++) { const x = Math.random() * W, y = (ROAD[0] + 3 + Math.random() * 20) * u; ctx.fillRect(x, y, 2 * u, u * 0.6); }
    }
    if (st.dust > 0.02) {
      const n = Math.round(320 * st.dust), col = mix(hex('#dba463'), S.hor, 0.3).map(v => Math.round(v * (1 - S.dark * 0.6)));
      while (motes.length < n) motes.push({ x: Math.random() * W, y: Math.random() * H, k: 0.4 + Math.random(), s: Math.random() });
      motes.length = n;
      for (const m of motes) {
        m.x -= ((st.v || 0) * u * 1.6 + 260 * u * m.k * st.dust) * st.dt; m.y += Math.sin(st.t * 2 + m.s * 9) * 0.6;
        if (m.x < -10) { m.x = W + Math.random() * 60; m.y = Math.random() * H; }
        ctx.fillStyle = css(col, 0.25 + 0.4 * m.s); ctx.fillRect(m.x, m.y, (2 + m.k * 6) * u * 0.5, Math.max(1, u * 0.5));
      }
      ctx.fillStyle = css(col, 0.22 * st.dust); ctx.fillRect(0, 0, W, H);
    }
    if (st.flash > 0) { ctx.fillStyle = `rgba(220,215,255,${0.25 * st.flash})`; ctx.fillRect(0, 0, W, H); }
    // vignette
    const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.95); v.addColorStop(0, 'rgba(6,5,10,0)'); v.addColorStop(1, `rgba(6,5,10,${0.45 + 0.25 * S.dark})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // grain
    if (C.grain > 0) { for (let i = 0; i < 220 * C.grain; i++) { ctx.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${0.05 * C.grain * 3})` : `rgba(0,0,0,${0.08 * C.grain * 3})`; ctx.fillRect(Math.random() * W, Math.random() * H, u * 0.5, u * 0.5); } }
  }
  // a new bolt for a lightning flash
  const strike = () => { bolt = { x: Math.round(40 + Math.random() * (BW - 80)), s: Math.floor(Math.random() * 1e6) }; };
  // #064 which giant screen is at this canvas pixel (the canvas is W wide) → { brand, x, y, w, h } or null
  const hit = (px, py, W) => { const u = W / BW, m = 6 * u; return screens.find(sc => px >= sc.x * u - m && px <= (sc.x + sc.w) * u + m && py >= sc.y * u - m && py <= (sc.y + sc.h) * u + m) || null; };
  return { draw, light, front, strike, ads, hit, sky: skyAt, get screens() { return screens; } };
}

// the weather of a leg: dust and fog by region and hour (the same leg always the same), the Sandsturm brings its own wall of dust
export function legWeather(D, seed, leg, region, hour) {
  const L = landscapeOf(D, region), h = ((hour % 24) + 24) % 24;
  return { dust: hash(seed, leg * 7 + 1) * 100 < (L.dust ?? 0) ? 0.35 + hash(seed, leg * 7 + 2) * 0.4 : 0,
    fog: h > 4 && h < 10 && hash(seed, leg * 7 + 3) * 100 < (L.fog ?? 0) ? 0.4 + hash(seed, leg * 7 + 4) * 0.5 : 0 };
}
