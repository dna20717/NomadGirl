// Start the game: load the project, then run the room in Phaser.
// Online (Cloudflare worker): the game data come live from the repository (/api/files), so a save in the workshop
// counts after reloading, without waiting for the build. Elsewhere: the delivered files plus the workshop's drafts from this browser.
//   game.html?room=<id>   plays a room-building block; without: the test room from the area "Spiel"
//   game.html?poi=<id>[&seed=<n>]   plays a POI as a generated level (test mode, no savegame); without seed a new one every load
//   megarig.html?id=<id>&stage=<n>   mega rig prototype (#022): Leyla walks a vehicle from the area „Mega-Rigs“, no savegame
//   game.html?camp        the game: camp ↔ runs with a savegame (online per login, otherwise in this browser); ?camp&new starts over
//                         #126 &slot=<n> plays slot 1–3 (else this device's slot); a slot is played with the Datenset it began with
import { unlockConfig } from '../unlocks.js';   // #184
import { poiReady } from '../../engine/poi.js';
import { snapshot as runSnapshot } from '../summary.js';
import { openStore, withDrafts } from '../store.js';
import { cloudFiles } from '../cloud_store.js';
import { browserLoader } from '../browser_loader.js';
import { loadProject } from '../../engine/project.js';
import { applySet, activeSetId } from '../../engine/sets.js';
import { PlayScene } from './scene.js';
import { Hud } from './hud.js';
import { installControl } from './control.js';
import { openSave, arrive } from '../save.js';
import { openStorage, activeSlot, chooseSlot } from '../slots.js';
import { composeKits } from '../vehicle_kit.js';
import { cheatsOn, watchCheatWord, runCheat } from '../cheats.js';
import { installGameFeedback } from './feedback_adapter.js';   // #181 test phase: feedback button

export async function start(parent, hudRoot, loading, opts = {}) {
  const base = new URL('projects/nomadgirl/', location.href);
  const cloud = await cloudFiles();
  const drafts = cloud ? new Map() : await (await openStore({ project: 'nomadgirl', withoutAssets: true })).all().catch(() => new Map());
  const loader = withDrafts(browserLoader(base), cloud ? cloud.files : drafts);
  const project = await loadProject(loader);
  // #126 a slot keeps the Datenset it was begun with (Daniel 20.11.2026: „nur mit Iterationen von diesem Datenset“); a new slot takes
  // this device's set (#073). Without the camp (test room, POI) the device's set as before.
  const q0 = new URLSearchParams(location.search), camp = q0.has('camp');
  const storage = camp ? await openStorage() : null, slot = camp ? activeSlot() : null;
  const slotSet = camp && !q0.has('new') ? (await storage.list().catch(() => ({})))[slot]?.set : undefined;
  const setId = slotSet ?? activeSetId();
  const dataSet = await applySet(project, loader, setId);   // #073 the Datenset lies over the standard
  if (setId && !dataSet) throw new Error(`Datenset „${setId}“ fehlt: ${camp ? `Spielstand ${slot} wurde damit begonnen und lässt sich ohne es nicht laden.` : 'im Hauptmenü ein anderes wählen.'}`);
  if (cloud) console.info(`Spieldaten live aus dem Repository (Commit ${cloud.commit.slice(0, 7)})`);
  loading?.data();
  const D = project.data, rooms = D.rooms || {};
  await composeKits(D, base);   // #076 vehicles from a tileset (the van: rear, niches, strut, cab)
  const q = new URLSearchParams(location.search), asked = q.get('room');
  const roomId = [asked, D.game?.testRoom, ...Object.keys(rooms)].find(id => id && rooms[id]?.layout?.length);
  if (!roomId) throw new Error('Kein Raum mit Layout gefunden (Werkstatt › Raum-Bausteine › Layout).');
  if (asked && asked !== roomId) console.warn(`Raum „${asked}“ hat kein Layout, spiele „${roomId}“`);
  const [width, height] = D.game?.resolution || [1920, 1080];
  window.__nomadData = { commit: cloud?.commit || null, drafts: [...drafts.keys()], set: dataSet ? { id: dataSet.id, name: dataSet.name } : null, slot };   // where the data came from (diag.js, Menü › Optionen)
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
  if (q.get('poi') && D.pois?.[q.get('poi')]) args = { ...args, poi: q.get('poi'), seed: Number(q.get('seed')) || 1 + Math.floor(Math.random() * 2 ** 31), brand: q.get('brand') || null, days: Number(q.get('days')) || 0 };   // #169 ?days=N: the place N days later   // ?brand=delta_petrol: the sign at the entrance
  if (q.has('camp') && D.camp) {
    const box = await openSave(D, '', { be: storage, slot, set: setId });
    chooseSlot(slot);   // this device goes on with this slot
    // #126 Frage F: the slot's preview, a small snapshot of the camp when it saves (at most once a minute, without the HUD: that is DOM)
    const persist0 = box.persist.bind(box);
    let shotAt = 0;
    box.persist = async force => {
      const r = await persist0(force), sc = game.scene.getScene('play');
      const cam = sc?.cameras?.main, settled = cam && !cam.fadeEffect?.isRunning && cam.fadeEffect?.alpha !== 1 && sc.time.now > 4000;   // not while the camp fades in
      if (sc?.mode === 'camp' && settled && !box.error && Date.now() - shotAt > 60000 && game.renderer?.snapshot) {
        shotAt = Date.now();
        game.renderer.snapshot(img => {
          try { const c = document.createElement('canvas'); c.width = 320; c.height = 180; c.getContext('2d').drawImage(img, 0, 0, 320, 180); box.shot(c.toDataURL('image/webp', 0.7)); } catch { /* no picture this time */ }
        });
      }
      return r;
    };
    if (q.has('new')) await box.reset();   // Neues Spiel › Alles zurücksetzen
    else if (q.has('cycle')) await box.cycle(q.get('cycle') !== 'fresh');   // Neues Spiel › Neuer Durchgang: the tech tree stays; #184 ?cycle=fresh: the Meta-Baum starts at 0 too
    if (q.has('new') || q.has('cycle')) { try { const u = new URL(location.href); u.searchParams.delete('new'); u.searchParams.delete('cycle'); history.replaceState(null, '', u); } catch { /* old browser */ } }   // a reload must not start over again
    // #184 Stufe 0 (Daniel 23.11.2026: „Erster POI“): a brand-new game (Meta-Baum at 0) begins right in the first POI, the camp comes after it
    let firstRun = false;
    const UC = unlockConfig(D), m0 = box.save.meta;
    if ((q.has('new') || q.has('cycle')) && m0 && !m0.all && !(m0.unlocked || []).includes('camp') && UC.firstPoi && poiReady(D, UC.firstPoi).ok) {
      const node = box.save.map?.nodes?.find(n => n.id === box.save.location);
      box.save.run = { poi: UC.firstPoi, room: null, seed: UC.firstSeed || 1, location: box.save.location, danger: node?.danger || 1, before: runSnapshot(D, box.save), first: true };
      firstRun = true;
    }
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
    const run = firstRun ? null : box.save.run;
    if (run) { box.save.run = null; box.save.buffs = []; box.save.buffQ = {}; box.save.inv.grids.backpack.items = []; }   // like knocked out
    if (!firstRun) arrive(box.save, D);   // every arrival in the camp is at dusk (Camp › Zeit › Ankunft um)
    await box.persist();
    args = { ...args, mode: 'camp', box, banner: run ? ['AvA hat dich heimgebracht', 'Der letzte Run wurde abgebrochen.'] : box.fresh ? ['Willkommen im Camp', 'E benutzt Dinge · H zeigt die Steuerung'] : null };
    if (firstRun) args = { ...args, mode: 'run', roomId: null, banner: [D.pois[UC.firstPoi]?.name || UC.firstPoi, 'Wo bin ich? AvA? … AvA!'] };   // #184
  }
  game.scene.add('play', PlayScene, true, args);
  window.nomad = installControl(game);   // remote control for Ava and tests
  window.nomadFeedback = installGameFeedback(game, D);   // #181 test phase: F8 / home button / Select + Start
  // #194 „Hier spielen“ from the feedback board: ?tp=col,row puts Leyla where the report was sent
  const tp = (q.get('tp') || '').split(',').map(Number);
  if (tp.length === 2 && tp.every(Number.isFinite)) { const t0 = Date.now(), at = () => { const s = game.scene.getScene('play'); if (s?.leyla?.body && s.room) window.nomad.tpTile(tp[0], tp[1]); else if (Date.now() - t0 < 20000) setTimeout(at, 200); }; setTimeout(at, 300); }
  return game;
}
