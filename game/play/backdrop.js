// Room background from the data (Raum-Bausteine › Hintergrund): a pixel-art picture with a transparent sky,
// the weather drawn by code behind it (game/weather.js) and rain in front of the world.
// Everything is drawn in background pixels and scaled up sharp (NEAREST), whole pixels only.
import { makeWeather } from '../weather.js';

export class Backdrop {
  // call inside the background block (objects go to bgCam); front() later for the rain (objects go to the world camera)
  constructor(scene, bd, roomH) {
    const W = scene.scale.width, H = scene.scale.height, D = scene.data_;
    this.scene = scene; this.bd = bd; this.roomH = roomH;
    const img = bd.image && scene.textures.exists(bd.image) ? scene.textures.get(bd.image) : null;
    const iw = img?.getSourceImage().width || 640, ih = img?.getSourceImage().height || 360;
    this.k = Math.max(1, bd.pixel || Math.ceil(H / ih));          // screen pixels per background pixel
    this.iw = iw; this.ih = ih;
    this.cw = Math.ceil(W / this.k) + 2; this.ch = Math.ceil(H / this.k) + 2;
    let wx = bd.weather && D.weather?.[bd.weather];
    // rain in the camp (game/rain.js, #014): the sky of the time of day, with the rain of another weather (Camp › Regen › Himmel)
    if (wx && bd.rain) wx = { ...wx, rain: { ...(D.weather?.[bd.rain]?.rain || wx.rain || {}), enabled: true } };
    this.weather = wx ? makeWeather(wx) : null;
    if (this.weather) {
      if (scene.textures.exists('backdrop_sky')) scene.textures.remove('backdrop_sky');
      this.sky = scene.textures.createCanvas('backdrop_sky', this.cw, this.ch);
      this.sky.setFilter(Phaser.Textures.FilterMode.NEAREST);
      scene.add.image(0, 0, 'backdrop_sky').setOrigin(0).setScrollFactor(0).setScale(this.k).setDepth(-100);
    } else {
      scene.add.rectangle(0, 0, W, H, 0x1a1030).setOrigin(0).setScrollFactor(0).setDepth(-100);
    }
    if (img) {
      img.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.pic = scene.add.image(0, 0, bd.image).setOrigin(0.5, 1).setScale(this.k).setScrollFactor(0).setDepth(-98);
      // below the picture: ground colour (the bottom row of the picture, or „Boden“)
      const src = img.getSourceImage(), c = document.createElement('canvas'); c.width = 1; c.height = 1;
      const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(src, Math.floor(iw / 2), ih - 1, 1, 1, 0, 0, 1, 1);
      const [r, g, b] = cx.getImageData(0, 0, 1, 1).data;
      const ground = bd.ground ? parseInt(bd.ground.slice(1), 16) : (r << 16 | g << 8 | b);
      this.under = scene.add.rectangle(0, 0, W, H, ground).setOrigin(0).setScrollFactor(0).setDepth(-98.5);
    }
    // dark back wall of the room, so the tiles stand out
    scene.add.rectangle(0, 0, scene.physics.world.bounds.width, roomH, 0x0d0a12, (bd.shade ?? 20) / 100).setOrigin(0).setDepth(-90);
    this.place();
  }

  // the picture: bottom edge at „Unterkante“ % of the screen while the camera is at the bottom, moves a little with the camera
  place() {
    const s = this.scene, W = s.scale.width, H = s.scale.height, cam = s.cam || s.cameras.main;
    const f = (this.bd.scroll ?? 4) / 100, maxY = Math.max(0, this.roomH - H);
    const x = W / 2 - (cam.scrollX || 0) * f * 0.5, y = H * (this.bd.bottom ?? 100) / 100 + (maxY - (cam.scrollY || 0)) * f;
    this.x = Math.round(x / this.k) * this.k; this.y = Math.round(y / this.k) * this.k;
    this.pic?.setPosition(this.x, this.y);
    this.under?.setPosition(0, this.y - this.k);
  }

  front() {
    if (!this.weather?.rain) return;
    if (this.scene.textures.exists('backdrop_rain')) this.scene.textures.remove('backdrop_rain');
    this.rain = this.scene.textures.createCanvas('backdrop_rain', this.cw, this.ch);
    this.rain.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.rainImg = this.scene.add.image(0, 0, 'backdrop_rain').setOrigin(0).setScrollFactor(0).setScale(this.k).setDepth(40);
  }

  update(time, dt) {
    this.place();
    const t = time / 1000;
    if (this.sky) {
      // box = where the picture sits, in background pixels of the sky canvas
      const box = { x: (this.x - this.iw * this.k / 2) / this.k, y: (this.y - this.ih * this.k) / this.k, w: this.iw, h: this.ih };
      this.weather.sky(this.sky.getContext(), this.cw, this.ch, t, box);
      this.sky.refresh();
    }
    if (this.rain) {
      const c = this.rain.getContext(); c.clearRect(0, 0, this.cw, this.ch);
      this.weather.front(c, this.cw, this.ch, t, dt / 1000);
      this.rain.refresh();
    }
  }
}
