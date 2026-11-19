// Start the game: load the project, then run the room in Phaser.
// Online (Cloudflare worker): the game data come live from the repository (/api/files), so a save in the workshop
// counts after reloading, without waiting for the build. Elsewhere: the delivered files plus the workshop's drafts from this browser.
//   game.html?room=<id>   plays a room-building block; without: the test room from the area "Spiel"
//   game.html?poi=<id>[&seed=<n>]   plays a POI as a generated level (test mode, no savegame); without seed a new one every load
//   megarig.html?id=<id>&stage=<n>   mega rig prototype (#022): Leyla walks a vehicle from the area „Mega-Rigs“, no savegame
//   game.html?camp        the game: camp ↔ runs with a savegame (online per login, otherwise in this browser); ?camp&new starts over
import { openStore, withDrafts } from '../store.js';
import { cloudFiles } from '../cloud_store.js';
import { browserLoader } from '../browser_loader.js';
import { loadProject } from '../../engine/project.js';
import { applySet, activeSetId } from '../../engine/sets.js';
import { PlayScene } from './scene.js';
import { Hud } from './hud.js';
import { installControl } from './control.js';
import { openSave, arrive } from '../save.js';
import { composeKits } from '../vehicle_kit.js';
import { cheatsOn, watchCheatWord, runCheat } from '../cheats.js';

export async function start(parent, hudRoot, loading, opts = {}) {
  const base = new URL('projects/nomadgirl/', location.href);
  const cloud = await cloudFiles();
  const drafts = cloud ? new Map() : await (await openStore({ project: 'nomadgirl', withoutAssets: true })).all().catch(() => new Map());
  const loader = withDrafts(browserLoader(base), cloud ? cloud.files : drafts);
  const project = await loadProject(loader);
  const dataSet = await applySet(project, loader, activeSetId());   // #073 the active Datenset of this device lies over the standard
  if (cloud) console.info(`Spieldaten live aus dem Repository (Commit ${cloud.commit.slice(0, 7)})`);
  loading?.data();
  const D = project.data, rooms = D.rooms || {};
  await composeKits(D, base);   // #076 vehicles from a tileset (the van: rear, niches, strut, cab)
  const q = new URLSearchParams(location.search), asked = q.get('room');
  const roomId = [asked, D.game?.testRoom, ...Object.keys(rooms)].find(id => id && rooms[id]?.layout?.length);
  if (!roomId) throw new Error('Kein Raum mit Layout gefunden (Werkstatt › Raum-Bausteine › Layout).');
  if (asked && asked !== roomId) console.warn(`Raum „${asked}“ hat kein Layout, spiele „${roomId}“`);
  const [width, height] = D.game?.resolution || [1920, 1080];
  window.__nomadData = { commit: cloud?.commit || null, drafts: [...drafts.keys()], set: dataSet ? { id: dataSet.id, name: dataSet.name } : null };   // where the data came from (diag.js, Menü › Optionen)
  const hud = new Hud(hudRoot, { workshopDrafts: drafts.size, commit: cloud?.commit });
  cheatsOn();   // #097: ?cheats=1 is remembered right away (the main menu's link has no query)
  watchCheatWord(() => {   // typing „deltas“: cheats on, and +50.000 Δ into the running savegame
    const sc = hud.scene, save = sc?.box?.save;
    if (save) { runCheat(sc.data_, save, 'deltas50'); sc.box.persist?.(); hud.refresh?.(); }
    hud.toast?.('Cheats freigeschaltet', save ? '+50.000 Δ · mehr im Pause-Menü › Cheats' : 'Pause-Menü › Cheats (im Spiel mit Camp)', 'good', 3600);
  });
  // local workshop drafts change the game in this browser only (Daniel, 18.11.2026: the iPad played 640×360 with zoom 0.5 from an old
  // draft of game.json): say so right away, not only in the controls window; Menü › Optionen can throw them away
  if (dataSet) setTimeout(() => hud.toast(`Datenset: ${dataSet.name}`, `${dataSet.files.length} Dateien weichen vom Standard ab · wechseln im Hauptmenü`, 'info', 6000), 2500);
  if (drafts.size) setTimeout(() => hud.toast('Lokaler Werkstatt-Stand aktiv', `${[...drafts.keys()].join(', ')} · nur in diesem Browser · Menü › Optionen › verwerfen`, 'warn', 9000), 7000);
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width, height, backgroundColor: '#0d0a12',
    pixelArt: !!D.game?.pixelArt, antialias: !D.game?.pixelArt,
    physics: { default: 'arcade', arcade: { gravity: { y: D.game?.gravity ?? 3600 }, debug: true, tileBias: 32 } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    banner: false,
    // pure additive light (#009): Phaser's ADD blends (ONE, DST_ALPHA) and showed the whole square of a glow where the frame's
    // alpha was not 1 (a light box round the campfire); (ONE, ONE) adds only the light. Again after the WebGL context comes back.
    callbacks: { postBoot: g => { const r = g.renderer, fix = () => { const m = r.blendModes?.[Phaser.BlendModes.ADD]; if (r.gl && m) m.func = [r.gl.ONE, r.gl.ONE]; }; fix(); r.on?.('restorewebgl', fix); } },
  });
  let args = { project, roomId, base, hud, loading };
  if (opts.megarig && D.megarigs?.[opts.megarig.id]) args = { ...args, megarig: opts.megarig };
  if (q.get('poi') && D.pois?.[q.get('poi')]) args = { ...args, poi: q.get('poi'), seed: Number(q.get('seed')) || 1 + Math.floor(Math.random() * 2 ** 31) };
  if (q.has('camp') && D.camp) {
    const box = await openSave(D);
    if (q.has('new')) await box.reset();   // Neues Spiel › Alles zurücksetzen
    else if (q.has('cycle')) await box.cycle();   // Neues Spiel › Neuer Durchgang: the tech tree stays
    console.info(`Spielstand ${box.where === 'cloud' ? 'online (pro Login)' : 'in diesem Browser'}${box.fresh ? ', neu' : ''}`);
    hud.saveBox = box;
    // another tab or device saved something newer (Lichterketten, 13.11.2026): this tab takes it over and opens the camp fresh
    box.onAdopt = () => {
      const sc = game.scene.getScene('play');
      if (!sc?.box) return;
      try { if (sc.hud?.build?.active) sc.hud.build.close(); } catch { /* the scene starts fresh anyway */ }
      sc.leaving = false;
      sc.restartAs({ mode: 'camp', banner: ['Neuerer Spielstand geladen', 'aus einem anderen Fenster'] }, 300);
    };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') box.adoptNewer(); });
    window.addEventListener('focus', () => box.adoptNewer());
    // a run that was interrupted (page closed) counts as knocked out: the camp starts, the run loot is gone
    const run = box.save.run;
    if (run) { box.save.run = null; box.save.buffs = []; box.save.buffQ = {}; box.save.inv.grids.backpack.items = []; }   // like knocked out
    arrive(box.save, D);   // every arrival in the camp is at dusk (Camp › Zeit › Ankunft um)
    await box.persist();
    args = { ...args, mode: 'camp', box, banner: run ? ['AvA hat dich heimgebracht', 'Der letzte Run wurde abgebrochen.'] : box.fresh ? ['Willkommen im Camp', 'E benutzt Dinge · H zeigt die Steuerung'] : null };
  }
  game.scene.add('play', PlayScene, true, args);
  window.nomad = installControl(game);   // remote control for Ava and tests
  return game;
}
