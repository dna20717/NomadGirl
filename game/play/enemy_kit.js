// Enemy kits (#004, Daniel, 12.11.2026: „einen menschlichen Raider als Grundlage für unsere Gegner … so modular wie sinnvoll,
// um Köpfe und Waffen flexibel austauschen zu können, ohne dass die Qualität der Animationen drunter leidet“).
//
// A kit (Bereich „Gegner-Bausätze“) is one painted body with animations per weapon class (light, heavy, pistol, long) and state
// (alert, walk, run, crouch, attack …). The animations carry a flat green placeholder instead of a weapon; tools/raider_strips.py
// turns them into a body strip, a hands strip (what lies in front of the weapon) and per frame: grip, angle, head offset.
// Here every combination an enemy needs (kit × weapon × head × skin × gang colour) is put together once per scene into a canvas
// strip: body (colours swapped) → head → weapon (rotated to the frame's grip and angle, its length in cm) → hands.
// The result is cached and played like any animation.

const CLASSES = ['light', 'heavy', 'pistol', 'long'];

// ---------- colours ----------
const hex = c => { const n = parseInt(String(c).replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (!s) return [l * 255, l * 255, l * 255].map(Math.round);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255));
}
// a colour group (Bausatz › Farbtausch: hue range, saturation, lightness) moves to a target colour: hue and saturation of the
// target, lightness keeps its distance to the group's middle (Mitte), so the shading of the painted pixels stays
export function swapper(rules) {
  const live = (rules || []).filter(r => r.to);
  if (!live.length) return null;
  const R = live.map(r => {
    const [th, ts, tl] = rgb2hsl(...hex(r.to));
    return { ...r, th, ts, tl, mid: (r.mid ?? 50) / 100 };
  });
  const cache = new Map();
  return (r, g, b) => {
    const k = r << 16 | g << 8 | b;
    let v = cache.get(k);
    if (v === undefined) {
      v = null;
      const [h, s, l] = rgb2hsl(r, g, b);
      for (const q of R) {
        const inHue = q.hueFrom <= q.hueTo ? h >= q.hueFrom && h <= q.hueTo : h >= q.hueFrom || h <= q.hueTo;
        if (!inHue || s * 100 < (q.satMin ?? 0) || l * 100 < (q.lightMin ?? 0) || l * 100 > (q.lightMax ?? 100)) continue;
        v = hsl2rgb(q.th, Math.min(1, s * (q.ts / Math.max(0.05, q.sat ?? s))), Math.max(0, Math.min(1, l + (q.tl - q.mid))));
        break;
      }
      cache.set(k, v);
    }
    return v;
  };
}
function recolor(ctx, x, y, w, h, swap) {
  if (!swap) return;
  const img = ctx.getImageData(x, y, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const v = swap(d[i], d[i + 1], d[i + 2]);
    if (v) { d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; }
  }
  ctx.putImageData(img, x, y);
}

// ---------- what an enemy wears ----------
// weapon class: Waffen › In der Hand › Klasse, else from the kind (melee → light, ranged → pistol)
export function weaponClass(w, def) {
  if (w?.held?.class && CLASSES.includes(w.held.class)) return w.held.class;
  if (w?.kind === 'ranged') return 'pistol';
  if (w?.kind === 'melee') return w.hands === 2 ? 'heavy' : 'light';
  return def?.behavior === 'shooter' ? 'pistol' : 'light';
}
// the rules for skin and gang colour of one enemy (Gegner › Aussehen: Hautton, Gang-Farbe)
function rulesFor(kit, def) {
  const out = [];
  const skin = (kit.skins || []).find(s => s.name === def.kitSkin), gang = (kit.gangs || []).find(s => s.name === def.kitGang);
  for (const r of kit.swaps || []) {
    const to = r.group === 'skin' ? skin?.color : r.group === 'gang' ? gang?.color : null;
    if (to) out.push({ ...r, to });
  }
  return out;
}

// everything the scene must load for the kits of these enemies
export function kitAssets(D, enemies) {
  const ids = new Set(), extra = [];
  for (const e of enemies) {
    const kit = D.kits?.[e.kit];
    if (!kit) continue;
    const cls = weaponClass(D.weapons?.[e.weapon], e);
    for (const p of kit.poses || []) if ((p.class === cls || p.class === 'any') && p.look) ids.add(p.look);
    const head = (kit.heads || []).find(h => h.id === e.kitHead);
    if (head?.look) ids.add(head.look);
    const w = D.weapons?.[e.weapon];
    if (w?.held?.look) ids.add(w.held.look);
  }
  for (const id of ids) { const a = D.assets?.[id]; if (a?.hands) extra.push([`${id}#hands`, a.hands]); }
  return { ids, extra };
}

// ---------- build ----------
// → { anims: { state: { key, frames, fps, loop } }, ox, oy, scale, flip: false, cls } or null (then the old look)
export function kitLook(scene, def) {
  const D = scene.data_, kit = D.kits?.[def.kit];
  if (!kit) return null;
  const w = D.weapons?.[def.weapon] || null, cls = weaponClass(w, def);
  const poses = (kit.poses || []).filter(p => (p.class === cls || p.class === 'any') && p.look && scene.textures.exists(p.look));
  if (!poses.length) return null;
  const tag = [def.kit, cls, def.weapon || '-', def.kitHead || '-', def.kitSkin || '-', def.kitGang || '-'].join('|');
  scene.kitCache ??= new Map();
  if (scene.kitCache.has(tag)) return scene.kitCache.get(tag);
  const A = D.assets || {}, swap = swapper(rulesFor(kit, def));
  const head = (kit.heads || []).find(h => h.id === def.kitHead && h.look && scene.textures.exists(h.look));
  const weapon = heldSprite(scene, w, kit);
  const anims = {};
  let ref = null;
  for (const p of poses) {
    const a = A[p.look];
    if (!a?.frameSize) continue;
    const [fw, fh] = a.frameSize, n = a.frames || 1, src = scene.textures.get(p.look).getSourceImage();
    const hands = scene.textures.exists(`${p.look}#hands`) ? scene.textures.get(`${p.look}#hands`).getSourceImage() : null;
    const key = `kit:${tag}:${p.state}`;
    if (!scene.textures.exists(key)) {
      const tex = scene.textures.createCanvas(key, fw * n, fh), ctx = tex.getContext();
      ctx.imageSmoothingEnabled = false;
      const off = (kit.offsets || []).find(o => o.class === cls)?.offset || [0, 0];   // Bausatz › Griff-Versatz je Klasse
      for (let i = 0; i < n; i++) {
        const L0 = a.layers?.[i] || {}, x = i * fw, L = L0.grip ? { ...L0, grip: [L0.grip[0] + off[0], L0.grip[1] + off[1]] } : L0;
        if (weapon && L.grip && L.back) drawHeld(ctx, weapon, x + L.grip[0], L.grip[1], L.angle || 0);
        ctx.drawImage(src, x, 0, fw, fh, x, 0, fw, fh);
        if (head) {
          const hsrc = scene.textures.get(head.look).getSourceImage(), at = head.at || [0, 0], off = L.head || [0, 0];
          if (L.headAngle) {   // falling over (death): the head turns with the body around its centre (Bausatz › Kopf-Drehpunkt)
            const pv = kit.headPivot || [at[0] + hsrc.width / 2, at[1] + hsrc.height / 2];
            ctx.save(); ctx.translate(x + pv[0] + off[0], pv[1] + off[1]); ctx.rotate(-L.headAngle * Math.PI / 180);
            ctx.drawImage(hsrc, at[0] - pv[0], at[1] - pv[1]); ctx.restore();
          } else ctx.drawImage(hsrc, x + at[0] + off[0], at[1] + off[1]);
        }
        recolor(ctx, x, 0, fw, fh, swap);   // body and head; the weapon keeps its colours
        if (weapon && L.grip && !L.back) drawHeld(ctx, weapon, x + L.grip[0], L.grip[1], L.angle || 0);
        if (hands) {
          const c2 = document.createElement('canvas'); c2.width = fw; c2.height = fh;
          const x2 = c2.getContext('2d'); x2.drawImage(hands, x, 0, fw, fh, 0, 0, fw, fh);
          recolor(x2, 0, 0, fw, fh, swap);
          ctx.drawImage(c2, x, 0);
        }
        tex.add(i, 0, x, 0, fw, fh);
      }
      tex.refresh();
      scene.anims.create({ key, frames: Array.from({ length: n }, (_, i) => ({ key, frame: i })), frameRate: a.fps || 10, repeat: a.loop === false ? 0 : -1 });
    }
    anims[p.state] = { key, frames: n, fps: a.fps || 10, loop: a.loop !== false, layers: a.layers || [] };
    ref ??= a;
  }
  const [fw, fh] = ref.frameSize, [ox, oy] = ref.origin || [fw / 2, fh];
  const look = { anims, cls, kit: def.kit, ox: ox / fw, oy: oy / fh, flip: false, scale: (def.height || kit.height || 180) / (kit.figure || fh),
    offset: (kit.offsets || []).find(o => o.class === cls)?.offset, key: anims.alert?.key || Object.values(anims)[0].key, anim: anims.alert?.key || Object.values(anims)[0].key, muzzle: weapon?.muzzle, frame: [fw, fh] };
  scene.kitCache.set(tag, look);
  return look;
}

// the weapon as it lies in its icon cell (Waffen › In der Hand: Feld, Griff, Spitze, Länge), scaled to the kit's pixels per cm
function heldSprite(scene, w, kit) {
  const H = w?.held;
  if (!H?.look || !scene.textures.exists(H.look)) return null;
  const tex = scene.textures.get(H.look), fr = tex.get(H.icon ?? 0);
  if (!fr) return null;
  const src = tex.getSourceImage(), cw = fr.cutWidth, ch = fr.cutHeight;
  // the drawn part of the cell (trimmed box) gives the length
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d'); x.drawImage(src, fr.cutX, fr.cutY, cw, ch, 0, 0, cw, ch);
  const d = x.getImageData(0, 0, cw, ch).data;
  let x0 = cw, x1 = 0;
  for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) if (d[(yy * cw + xx) * 4 + 3]) { x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); }
  const drawn = Math.max(1, x1 - x0 + 1), pxPerCm = (kit.figure || 240) / (kit.cm || 180);
  const s = (H.cm || 60) * pxPerCm / drawn;
  const grip = H.grip || [x0, ch / 2], tip = H.tip || [x1, grip[1]];
  const axis = Math.atan2(tip[1] - grip[1], tip[0] - grip[0]);
  const muzzle = H.muzzle || tip;
  return { img: c, s, grip, axis, muzzle: { along: Math.hypot(muzzle[0] - grip[0], muzzle[1] - grip[1]) * s, rot: Math.atan2(muzzle[1] - grip[1], muzzle[0] - grip[0]) - axis } };
}
function drawHeld(ctx, W, gx, gy, angleDeg) {
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(angleDeg * Math.PI / 180 - W.axis);
  ctx.scale(W.s, W.s);
  ctx.drawImage(W.img, -W.grip[0], -W.grip[1]);
  ctx.restore();
}

// muzzle of the drawn weapon in world space for the frame on screen (shots start there)
export function kitMuzzle(enemy) {
  const L = enemy.look, sp = enemy.sprite, st = enemy.kitState && L.anims[enemy.kitState];
  if (!L?.anims || !st || !L.muzzle) return null;
  const f0 = st.layers[Number(sp.frame?.name) || 0] || st.layers[0];
  if (!f0?.grip) return null;
  const off = L.offset || [0, 0], f = { ...f0, grip: [f0.grip[0] + off[0], f0.grip[1] + off[1]] };
  const a = (f.angle || 0) * Math.PI / 180 + L.muzzle.rot, fx = f.grip[0] + Math.cos(a) * L.muzzle.along, fy = f.grip[1] + Math.sin(a) * L.muzzle.along;
  const [fw, fh] = L.frame, s = L.scale, dir = sp.flipX ? -1 : 1;
  return { x: sp.x + dir * (fx - L.ox * fw) * s, y: sp.y + (fy - L.oy * fh) * s };
}

// ---------- which frame now ----------
// loops (alert, walk, run) run as Phaser animations; one-shots are set frame by frame from the time they started:
// melee attack = wind up to „Ausholen bis Frame“ during the warning, the rest on the strike; shot = recoil after the shot;
// crouch holds its last frame; hit and death once.
export function kitShow(e, time) {
  const L = e.look, A = L.anims, b = e.body, sp = e.sprite, K = e.scene.data_.kits?.[L.kit] || {};
  const melee = e.attackKind !== 'shot';
  let st, t0 = 0, from = 0;
  if (e.state === 'dead') { st = 'death'; t0 = e.diedAt; }
  else if (e.state === 'duck') { st = 'crouch'; t0 = e.duckAt; }
  else if (A.hit && time < (e.hitAt ?? -1e9) + A.hit.frames / A.hit.fps * 1000) { st = 'hit'; t0 = e.hitAt; }
  else if (e.state === 'windup' && melee) st = 'windup';
  else if (melee && (e.state === 'strike' || (e.state === 'recover' && e.strikeAt && time - e.strikeAt < 600))) { st = 'attack'; t0 = e.strikeAt; from = K.windupFrame ?? 3; }
  else if (!melee && e.shotAt && A.attack && time - e.shotAt < A.attack.frames / A.attack.fps * 1000) { st = 'attack'; t0 = e.shotAt; }
  else {
    const v = Math.abs(b.velocity.x), run = (e.d.speed ?? 120) * 0.65;
    st = !b.blocked.down && e.kind !== 'flyer' ? 'alert' : v > run ? 'run' : v > 10 ? 'walk' : 'alert';
  }
  // windup: the first frames of the attack, spread over the warning
  if (st === 'windup') {
    const a = A.attack;
    if (!a) st = 'alert';
    else {
      const k = Math.min(a.frames - 1, K.windupFrame ?? 3), p = 1 - Math.max(0, e.windupEnd - time) / (e.a.windup || 1);
      return set(e, 'attack', Math.min(k, Math.floor(p * (k + 1))));
    }
  }
  if (!A[st]) st = st === 'run' && A.walk ? 'walk' : st === 'crouch' || st === 'death' || st === 'hit' ? (A.alert ? 'alert' : Object.keys(A)[0]) : A.alert ? 'alert' : Object.keys(A)[0];
  const a = A[st];
  if (st === 'alert' || st === 'walk' || st === 'run') {
    e.kitState = st;
    if (sp.anims.currentAnim?.key !== a.key || !sp.anims.isPlaying) sp.play(a.key, true);
    sp.anims.timeScale = st === 'alert' ? 1 : Math.max(0.5, Math.min(1.6, Math.abs(b.velocity.x) / ((e.d.speed ?? 120) * (st === 'run' ? 1 : 0.4))));
    return;
  }
  const f = from + Math.floor(Math.max(0, time - (t0 || time)) / 1000 * a.fps);
  return set(e, st, Math.min(a.frames - 1, f));
}
function set(e, st, i) {
  const a = e.look.anims[st], sp = e.sprite;
  e.kitState = st;
  if (sp.anims.isPlaying) sp.anims.stop();
  if (sp.texture.key !== a.key) sp.setTexture(a.key, i); else sp.setFrame(i);
}
