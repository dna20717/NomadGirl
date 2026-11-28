// CampBuilder v2 (#196): the sky by the hour, behind the world on its own camera. Colours, sun and moon come from the game's day
// (game/road.js skyAt), drawn as dithered pixel bands by game/weather.js; in front of the sky the painted parallax of the desert
// (Welt › Parallax-Sets), darkened by night like in the camp. Over the world lies the light of the hour: warm at golden hour, deep
// blue at night (a multiply veil), so the whole diorama turns with the sun.
import { makeWeather } from '../weather.js';
import { skyAt } from '../road.js';
import { mirroredTexture, mixTint } from '../play/parallax.js';

const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
const int = ([r, g, b]) => (r << 16) | (g << 8) | b;

export class Sky {
  constructor(scene, bg, D, cfg) {
    this.s = scene; this.bg = bg; this.D = D; this.cfg = cfg;
    const W = scene.scale.width, H = scene.scale.height;
    this.k = 4; this.cw = Math.ceil(W / this.k); this.ch = Math.ceil(H / this.k);
    if (scene.textures.exists('cb_sky')) scene.textures.remove('cb_sky');
    this.tex = scene.textures.createCanvas('cb_sky', this.cw, this.ch);
    this.tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.img = scene.add.image(0, 0, 'cb_sky').setOrigin(0).setScale(this.k).setScrollFactor(0).setDepth(-100);
    this.layers = [];
    const P = D.parallax?.[cfg.view?.parallax || 'wueste'];
    if (P) (P.layers || []).forEach((L, i) => {
      const key = L.look && mirroredTexture(scene, L.look);
      if (!key) return;
      const src = scene.textures.get(key).getSourceImage(), k = (L.scale ?? 400) / 100, sf = (L.speed ?? 5) / 100;
      const ts = scene.add.tileSprite(0, 0, W + 4, (src.height - 3) * k, key).setOrigin(0, 1).setTileScale(k).setScrollFactor(0).setDepth(-98.8 + i * 0.05).setAlpha((L.alpha ?? 100) / 100);
      ts.tilePositionY = 3;   // the top rows stay out: the texture wraps there and would draw a thin line across the sky
      this.layers.push({ ts, L, k, sf, off: L.offset || 0 });
    });
    this.night = parseInt(String(P?.nightColor || '#262040').slice(1), 16);
    this.ground = scene.add.rectangle(0, 0, W, H, 0x2a1f2a).setOrigin(0).setScrollFactor(0).setDepth(-98.9);
    this.hour = null; this.weather = null;
  }
  // the hour changed: new colours, a new sun, stars at night
  setHour(h) {
    if (this.hour != null && Math.abs(h - this.hour) < 0.02) return;
    this.hour = h;
    const S = this.S = skyAt(h), alt = S.sun.alt, moon = S.moon.alt > 0 && alt < 0;
    const sunY = 66 - Math.max(-0.4, alt) * 56, moonY = 66 - S.moon.alt * 50;
    this.weather = makeWeather({
      sky: { top: hex(S.top), middle: hex(S.mid), low: hex(S.low), horizon: hex(S.hor), bands: 10, at: 66 },
      sun: moon ? { enabled: true, x: S.moon.x * 100, y: moonY, size: 14, color: '#e8ecf6', color2: '#9aa4c8', stripes: 0, halo: 22 }
        : { enabled: alt > -0.18, x: S.sun.x * 100, y: sunY, size: 24 + Math.round((1 - Math.min(1, Math.abs(alt))) * 12), color: hex(S.sun.col.map(v => Math.min(255, v + 40))), color2: hex(S.sun.col), stripes: alt < 0.3 ? 4 : 0, halo: Math.round(20 + S.warm * 40) },
      // clouds: dark against a dark sky (dusk, night), light against the day
      clouds: { count: 16, color: hex(S.mid.map((v, i) => { const dusk = v * 0.55 + S.top[i] * 0.2, day = v + (255 - v) * 0.55; const k = Math.max(0, Math.min(1, (0.35 - S.dark) / 0.3)) * (1 - S.warm); return dusk + (day - dusk) * k; })),
        light: hex(S.hor.map((v, i) => v * (0.6 + S.warm * 0.4) + (255 - v) * 0.4 * (1 - S.dark))), speed: 1.4, band: [14, 56] },
      glow: { enabled: false },
      stars: { count: Math.round(220 * Math.max(0, S.dark - 0.25) / 0.6), color: '#fff4d8', twinkle: 45, band: [0, 58] },
    });
    // the parallax: darker by night, warmer at golden hour
    const n = Math.max(0, Math.min(1, (S.dark - 0.05) / 0.75)), warm = 0xffc89a;
    for (const { ts, L } of this.layers) {
      let t = mixTint(0xffffff, this.night, Math.min(1, n * (L.night ?? 60) / 100 * 1.4));
      if (S.warm > 0) t = mixTint(t, warm, S.warm * 0.35);
      ts.setTint(t);
    }
    this.ground.setFillStyle(mixTint(mixTint(0x6b4f45, this.night, n * 0.85), 0xd08050, S.warm * 0.25));
    // the light over the world: multiply veil (white = untouched)
    let veil = mixTint(0xffffff, 0x4a4f8a, Math.min(1, S.dark * 1.05));
    if (S.warm > 0) veil = mixTint(veil, 0xffd2a8, S.warm * 0.42);
    this.veil = veil;
    this.dirty = true;
  }
  // every frame: clouds drift, stars twinkle; the parallax follows the camera and sits on the ground line
  update(t, cam, groundY) {
    const ctx = this.tex.getContext();
    this.weather?.sky(ctx, this.cw, this.ch, t / 1000, { x: 0, y: 0, w: this.cw, h: this.ch });
    this.tex.refresh();
    const H = this.s.scale.height, horizon = Math.max(H * 0.42, Math.min(H * 0.98, groundY));
    for (const { ts, L, k, sf, off } of this.layers) {
      ts.y = Math.round(horizon + (L.bottom ?? 0) * Math.min(1, cam.zoom + 0.3));
      ts.tilePositionX = off + (cam.scrollX + cam.width / 2) * sf / k;
    }
    this.ground.y = horizon - 2;
  }
}
export { int as tintInt };
