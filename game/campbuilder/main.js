// CampBuilder v2 (#196): start of the page /campbuilder. Loads the game data like the game (online live from the repository, locally
// with the workshop's drafts), the diorama from its store, then the scene. window.campbuilder is the remote control (tests, Ava).
import { openStore, withDrafts } from '../store.js';
import { cloudFiles } from '../cloud_store.js';
import { browserLoader } from '../browser_loader.js';
import { loadProject } from '../../engine/project.js';
import { BuilderScene } from './scene.js';
import { Input } from './input.js';
import { Tones } from './tones.js';
import { Hud } from './hud.js';
import { openDioramas } from './store.js';
import * as M from './model.js';

export async function start(parent, hudRoot, loading) {
  const base = new URL('projects/nomadgirl/', location.href);
  const cloud = await cloudFiles();
  const drafts = cloud ? new Map() : await (await openStore({ project: 'nomadgirl', withoutAssets: true })).all().catch(() => new Map());
  const project = await loadProject(withDrafts(browserLoader(base), cloud ? cloud.files : drafts));
  loading?.data();
  const D = project.data, C = D.campbuilder || {};
  const q = new URLSearchParams(location.search);
  const mcfg = () => ({ width: C.parcel?.width, grow: C.parcel?.grow, growAt: C.parcel?.growAt, depth: C.parcel?.depth, sky: C.parcel?.sky, maxWidth: C.parcel?.maxWidth, rough: C.hill?.rough });
  const hud = new Hud(hudRoot, base);
  const store = await openDioramas({ slot: Number(q.get('slot')) || C.save?.slot || 1, onSaved: ok => hud.saved(ok) });
  const fresh = () => M.newDiorama(mcfg(), { base: D.terrain?.[C.parcel?.base] ? C.parcel.base : Object.keys(D.terrain || {})[0], seed: 1 + Math.floor(Math.random() * 99999), hour: C.clock?.start ?? 18.2 });
  const saved = q.has('new') ? null : await store.load().catch(() => null);
  const model = (saved && M.fromJSON(saved, mcfg())) || fresh();
  const [width, height] = D.game?.resolution || [1920, 1080];
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width, height, backgroundColor: '#0d0a12', antialias: true, banner: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { mouse: false, touch: false, keyboard: false, gamepad: false },
    callbacks: { postBoot: g => { const r = g.renderer, fix = () => { const m = r.blendModes?.[Phaser.BlendModes.ADD]; if (r.gl && m) m.func = [r.gl.ONE, r.gl.ONE]; }; fix(); r.on?.('restorewebgl', fix); } },
  });
  const input = new Input(null), tones = new Tones(C);
  const args = { project, base, cfg: C, model, input, tones, hud, store, loading, fresh };
  game.scene.add('builder', BuilderScene, true, args);
  const scene = () => game.scene.getScene('builder');
  await new Promise(res => { const t = setInterval(() => { if (scene()?.view) { clearInterval(t); res(); } }, 50); });
  input.bindTouch(game.canvas);
  scene().fresh = () => {
    const s = scene(), m = fresh();
    s.m = m; s.view.destroy(); s.view.m = m; s.view.chunks.clear(); s.view.all(); s.view.update(s.time.now, true);
    s.drawUnder(); s.placeStakes(false); s.cur.x = T2; s.cur.y = -T2; s.setHour(m.hour); store.save(m);
  };
  window.game = game;
  window.campbuilder = control(game, scene, input, store);
  loading?.done?.();
  return game;
}
const T2 = 32;

// the remote control: press and hold buttons, tilt sticks, put the point anywhere, read the state
function control(game, scene, input, store) {
  const V = input.virtual;
  return {
    scene, model: () => scene().m, M,
    press(b) { V.buttons.add(b); }, release(b) { V.buttons.delete(b); }, releaseAll() { V.buttons.clear(); V.left = [0, 0]; V.right = [0, 0]; V.lt = V.rt = 0; },
    stick(x, y) { V.left = [x, y]; }, rstick(x, y) { V.right = [x, y]; }, triggers(lt, rt) { V.lt = lt; V.rt = rt; },
    // the point onto a tile (world tile coordinates), without flying
    at(x, y) { const s = scene(); s.cur.x = x * 64 + 32; s.cur.y = y * 64 + 32; s.cur.vx = s.cur.vy = 0; s.hop = null; },
    // frames without waiting for the browser (logic only; tweens run on the real clock)
    step(n = 1, dt = 16.67) { const s = scene(); for (let i = 0; i < n; i++) { s.tick(dt, s.time.now + i * dt); } },
    state() {
      const s = scene(), m = s.m;
      return { parcel: m.parcel, set: s.set, hour: s.hour, cursor: s.cell(), gesture: s.g?.mode || null, history: m.history.length, future: m.future.length,
        surface: x => M.surface(m, x), zoom: s.cam.zoom, chunks: s.view.chunks.size, bakes: s.view.bakes, notes: s.notes, tones: s.tones.state(), rumbles: input.rumbles || 0,
        metrics: M.metrics(m), hud: { quiet: document.querySelector('.cb-hud')?.classList.contains('quiet'), wheel: s.hud.wheelOpen, menu: s.hud.menuOpen }, where: store.where };
    },
    surface(x) { return M.surface(scene().m, x); },
    save() { return store.save(scene().m); },
  };
}
