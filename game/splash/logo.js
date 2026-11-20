// Das Logo im Hauptmenü (#120, Daniel 20.11.2026: „asphaltartige Beschaffenheit, den gelben Strich in der Mitte wie der Mittelstreifen
// der amerikanischen Fahrbahn, eine Ecke herausgebrochen, Schlaglöcher … dazu den Van von oben, wie er auf dieser Straße fährt (am rechten
// Ende des Schriftzugs)“; „Van, Drohne und Schriftzug einzeln, damit wir es verändern können; dynamisch, Spaß beim Anschauen; der Staub
// darf animiert sein“). Four PixelLab pieces (Startseite › Logo): the asphalt wordmark, a piece of road that leaves the L, the van and AvA
// from above. Code tilts it (slightly rising), lets the van rock and creep along the road, dust puffs roll out behind it and drift over
// the letters, AvA hovers over the van with her shadow and now and then flies a lap over the logo; the sunset rim breathes. Hovering the
// logo revs the van (a burst of dust).
//   startLogo(host, { A, base, cfg }) → { stop }   host: the element whose image is replaced by the canvas
export async function startLogo(host, { A, base, cfg = {} }) {
  const load = id => new Promise(res => { const f = A?.[id]?.file; if (!f) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = new URL(f, base).href; });
  const [word, road, van, drone] = await Promise.all([cfg.word || 'ui_logo_word', cfg.road || 'ui_logo_road', cfg.van || 'ui_logo_van', cfg.drone || 'ui_logo_drone'].map(load));
  if (!word) return null;
  const K = 2;                                   // drawing scale: whole pixels stay square when the picture is tilted
  const ang = (cfg.angle ?? -10) * Math.PI / 180, RK = cfg.roadScale ?? 2;
  const line = cfg.line ?? 80, roadLine = cfg.roadLine ?? 31.5, cut = cfg.roadFrom ?? 128;   // the yellow line in the word / in the road; where the road piece starts
  const rw = road ? (road.width - cut) * RK : 0, W = word.width + rw - 6, H = word.height;
  const pad = Math.ceil(Math.abs(Math.sin(ang)) * W / 2) + 40;
  const cv = document.createElement('canvas'); cv.width = (W + 80) * K; cv.height = (H + pad * 2) * K;
  cv.className = 'logo-canvas'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'NomadGirl');
  host.replaceChildren(cv);
  const ctx = cv.getContext('2d');
  const puffs = [], rnd = Math.random;
  let last = performance.now(), rev = 0, lap = -1, nextLap = performance.now() + 7000, raf = 0, alive = true;
  host.addEventListener('pointerenter', () => { rev = 1; });
  const roadY = line - roadLine * RK, x0 = word.width - 6;   // road piece: its yellow line on the word's
  const VS = cfg.vanScale ?? 1.5, DS = cfg.droneScale ?? 1.5, vanW = van ? van.width * VS : 0, vanH = van ? van.height * VS : 0, dw = drone ? drone.width * DS : 0, dh = drone ? drone.height * DS : 0;
  const frame = now => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000; last = now;
    rev = Math.max(0, rev - dt * 0.9);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.translate((W + 80) / 2, H / 2 + pad); ctx.rotate(ang); ctx.translate(-W / 2, -H / 2);
    // the sunset rim breathes: a soft warm glow behind the letters
    ctx.save(); ctx.globalAlpha = 0.25 + 0.12 * Math.sin(t * 1.3); ctx.filter = 'blur(10px)'; ctx.drawImage(word, 0, 0); ctx.restore();
    if (road) ctx.drawImage(road, cut, 0, road.width - cut, road.height, x0, roadY, rw, road.height * RK);
    ctx.drawImage(word, 0, 0);
    // the van creeps along the road and back, rocks on the potholes; revving pushes it forward
    const vx = x0 + (rw - vanW) * (0.25 + 0.2 * Math.sin(t * 0.35) + 0.25 * rev), vy = line - vanH / 2 + Math.sin(t * 9) * 0.6 * (1 + rev * 2) + (Math.sin(t * 2.3) > 0.97 ? -1 : 0);
    // dust: puffs from the rear wheels drift back over the letters, grow and fade
    const rate = 22 + 80 * rev;
    for (let n = 0; n < rate * dt; n++) puffs.push({ x: vx + 10, y: line + (rnd() < 0.5 ? -1 : 1) * (vanH * 0.3 + rnd() * 6), vx: -(30 + rnd() * 50) * (1 + rev), vy: (rnd() - 0.5) * 14, r: 2 + rnd() * 3, a: 0, life: 1.2 + rnd() * 1.4, c: rnd() < 0.5 ? '#dba463' : rnd() < 0.5 ? '#c7b08b' : '#a08662' });
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]; p.a += dt; if (p.a > p.life) { puffs.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 0.8; p.r += dt * 7;
      const k = p.a / p.life;
      ctx.globalAlpha = 0.32 * (1 - k) * Math.min(1, p.a * 5) * Math.max(0, Math.min(1, (p.x - x0 + 6) / 50)); ctx.fillStyle = p.c;   // fades out before the letters: the word stays readable
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.arc(p.x + p.r * 0.6, p.y - p.r * 0.35, p.r * 0.7, 0, Math.PI * 2); ctx.arc(p.x - p.r * 0.5, p.y + p.r * 0.3, p.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (van) { ctx.fillStyle = 'rgba(6,6,8,.35)'; ctx.fillRect(Math.round(vx + 12), Math.round(vy + vanH - 18), vanW - 24, 8); ctx.drawImage(van, Math.round(vx), Math.round(vy), vanW, vanH); }
    // AvA: hovers over the van, now and then flies a lap over the logo (an ellipse around the letters)
    if (drone) {
      if (lap < 0 && now > nextLap) lap = 0;
      let dx = vx + vanW * 0.45 + Math.sin(t * 1.7) * 10, dy = line - vanH * 1.05 + Math.cos(t * 1.3) * 6;
      if (lap >= 0) {
        lap += dt / 5.5;
        const a = lap * Math.PI * 2, e = Math.sin(Math.min(1, lap) * Math.PI);   // ease out of and back into her spot
        dx = dx + (W * 0.45 * (Math.cos(a + Math.PI) + 1) * -1) * e; dy = dy + Math.sin(a) * H * 0.55 * e;
        if (lap >= 1) { lap = -1; nextLap = now + 9000 + rnd() * 9000; }
      }
      const h = 26 + Math.sin(t * 2) * 3;   // height above the road: her shadow sits lower and smaller
      ctx.fillStyle = 'rgba(6,6,8,.28)'; ctx.beginPath(); ctx.ellipse(dx + dw / 2, dy + dh / 2 + h, dw * 0.32, dh * 0.14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(drone, Math.round(dx), Math.round(dy), dw, dh);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { canvas: cv, stop: () => { alive = false; cancelAnimationFrame(raf); }, rev: () => { rev = 1; } };
}
