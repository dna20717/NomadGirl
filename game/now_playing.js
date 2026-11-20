// „Now Playing“ als Kassette (#117, Daniel 20.11.2026: „mit PixelLab eine schöne Now-Playing-Karte, vielleicht in Form einer Kassette,
// die eingeblendet wird, wenn Musik wechselt“). A cassette (PixelLab, assets/ui/cassette) slides in at the bottom right, the title is
// written on its label, the reels turn, then it slides away. Plain DOM, so it works on the start page, in the intro and in the game.
//   nowPlaying({ title, artist, cassette, base })   cassette: the asset (Assets › ui_cassette: file, label box, reels), base: URL of the project
const CSS = `
.np-card { position: fixed; right: 18px; bottom: 64px; z-index: 9000; pointer-events: none; display: flex; align-items: center; gap: 12px;
  padding: 10px 16px 10px 10px; border-radius: 14px; background: rgba(20, 16, 26, .97); border: 1px solid #3a2f45; box-shadow: 0 10px 34px rgba(0,0,0,.5);
  transform: translateX(120%); transition: transform .55s cubic-bezier(.2,.9,.25,1.15), opacity .4s; opacity: 0; font-family: Inter, sans-serif; }
.np-card.on { transform: none; opacity: 1; }
.np-tape { position: relative; image-rendering: pixelated; flex: 0 0 auto; }
.np-tape img { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
.np-label { position: absolute; display: flex; align-items: center; justify-content: center; text-align: center; overflow: hidden;
  font-family: VT323, monospace; color: #2b1d2e; line-height: .9; transform: rotate(-1.2deg); }
.np-reel { position: absolute; border-radius: 50%; animation: np-spin 1.6s linear infinite;
  background: conic-gradient(#3a2b3a 0 12%, transparent 12% 33%, #3a2b3a 33% 45%, transparent 45% 66%, #3a2b3a 66% 78%, transparent 78%); opacity: .75; }
@keyframes np-spin { to { transform: rotate(360deg); } }
.np-text { display: grid; gap: 2px; min-width: 0; }
.np-text small { color: #20d6c7; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; }
.np-text b { color: #f2eef7; font-family: VT323, monospace; font-weight: 400; font-size: 26px; line-height: 1; white-space: nowrap; }
.np-text span { color: #8a7d99; font-size: 12px; }
@media (max-width: 600px) { .np-text { display: none; } }`;

let card = null, hideT = 0;
export function nowPlaying({ title, artist = '', cassette = null, base = location.href, scale = 2, ms = 5200 } = {}) {
  if (!title || typeof document === 'undefined') return null;
  if (!document.getElementById('np-css')) { const st = document.createElement('style'); st.id = 'np-css'; st.textContent = CSS; document.head.append(st); }
  card?.remove(); clearTimeout(hideT);
  const C = cassette || {}, [cw, ch] = C.size || [160, 104], k = scale;
  card = document.createElement('div'); card.className = 'np-card';
  const tape = document.createElement('div'); tape.className = 'np-tape'; tape.style.width = `${cw * k}px`; tape.style.height = `${ch * k}px`;
  if (C.file) { const img = document.createElement('img'); img.src = new URL(C.file, base).href; img.alt = ''; tape.append(img); }
  for (const [x, y] of C.reels || []) { const r = document.createElement('i'); r.className = 'np-reel'; const d = (C.reelSize ?? 12) * k; Object.assign(r.style, { left: `${x * k - d / 2}px`, top: `${y * k - d / 2}px`, width: `${d}px`, height: `${d}px` }); tape.append(r); }
  const [lx, ly, lw, lh] = C.label || [24, 19, 112, 21];
  const lab = document.createElement('div'); lab.className = 'np-label'; Object.assign(lab.style, { left: `${lx * k}px`, top: `${ly * k}px`, width: `${lw * k}px`, height: `${lh * k}px`, fontSize: `${Math.round(lh * k * 0.62)}px` });
  lab.textContent = title; tape.append(lab);
  const txt = document.createElement('div'); txt.className = 'np-text';
  txt.innerHTML = '<small>Now playing</small>';
  const b = document.createElement('b'); b.textContent = title; txt.append(b);
  if (artist) { const a = document.createElement('span'); a.textContent = artist; txt.append(a); }
  card.append(tape, txt);
  document.body.append(card);
  requestAnimationFrame(() => requestAnimationFrame(() => card?.classList.add('on')));
  const mine = card;
  hideT = setTimeout(() => { mine.classList.remove('on'); setTimeout(() => mine.remove(), 700); if (card === mine) card = null; }, ms);
  return mine;
}
// the track's card from its asset (Assets › Ton: Titel, Künstler) and the cassette asset
export function nowPlayingFor(A, id, base, cassetteId = 'ui_cassette') {
  const a = A?.[id]; if (!a) return null;
  return nowPlaying({ title: a.title || a.name, artist: a.artist || '', cassette: A[cassetteId], base });
}
