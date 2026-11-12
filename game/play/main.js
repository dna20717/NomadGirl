// Start the game: load the project, then run the room in Phaser.
// Online (Cloudflare worker): the game data come live from the repository (/api/files), so a save in the workshop
// counts after reloading, without waiting for the build. Elsewhere: the delivered files plus the workshop's drafts from this browser.
//   game.html?room=<id>   plays a room-building block; without: the test room from the area "Spiel"
//   game.html?poi=<id>[&seed=<n>]   plays a POI as a generated level (test mode, no savegame); without seed a new one every load
//   game.html?camp        the game: camp ↔ runs with a savegame (online per login, otherwise in this browser); ?camp&new starts over
import { openStore, withDrafts } from '../store.js';
import { cloudFiles } from '../cloud_store.js';
import { browserLoader } from '../browser_loader.js';
import { loadProject } from '../../engine/project.js';
import { PlayScene } from './scene.js';
import { Hud } from './hud.js';
import { installControl } from './control.js';
import { openSave, arrive } from '../save.js';

export async function start(parent, hudRoot, loading) {
  const base = new URL('projects/nomadgirl/', location.href);
  const cloud = await cloudFiles();
  const drafts = cloud ? new Map() : await (await openStore({ project: 'nomadgirl', withoutAssets: true })).all().catch(() => new Map());
  const project = await loadProject(withDrafts(browserLoader(base), cloud ? cloud.files : drafts));
  if (cloud) console.info(`Spieldaten live aus dem Repository (Commit ${cloud.commit.slice(0, 7)})`);
  loading?.data();
  const D = project.data, rooms = D.rooms || {};
  const q = new URLSearchParams(location.search), asked = q.get('room');
  const roomId = [asked, D.game?.testRoom, ...Object.keys(rooms)].find(id => id && rooms[id]?.layout?.length);
  if (!roomId) throw new Error('Kein Raum mit Layout gefunden (Werkstatt › Raum-Bausteine › Layout).');
  if (asked && asked !== roomId) console.warn(`Raum „${asked}“ hat kein Layout, spiele „${roomId}“`);
  const [width, height] = D.game?.resolution || [1920, 1080];
  const hud = new Hud(hudRoot, { workshopDrafts: drafts.size, commit: cloud?.commit });
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width, height, backgroundColor: '#0d0a12',
    pixelArt: !!D.game?.pixelArt, antialias: !D.game?.pixelArt,
    physics: { default: 'arcade', arcade: { gravity: { y: D.game?.gravity ?? 3600 }, debug: true, tileBias: 32 } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    banner: false,
  });
  let args = { project, roomId, base, hud, loading };
  if (q.get('poi') && D.pois?.[q.get('poi')]) args = { ...args, poi: q.get('poi'), seed: Number(q.get('seed')) || 1 + Math.floor(Math.random() * 2 ** 31) };
  if (q.has('camp') && D.camp) {
    const box = await openSave(D);
    if (q.has('new')) await box.reset();   // Neues Spiel › Alles zurücksetzen
    else if (q.has('cycle')) await box.cycle();   // Neues Spiel › Neuer Durchgang: the tech tree stays
    console.info(`Spielstand ${box.where === 'cloud' ? 'online (pro Login)' : 'in diesem Browser'}${box.fresh ? ', neu' : ''}`);
    hud.saveBox = box;
    // a run that was interrupted (page closed) counts as knocked out: the camp starts, the run loot is gone
    const run = box.save.run;
    if (run) { box.save.run = null; box.save.buffs = []; box.save.inv.grids.backpack.items = []; }   // like knocked out
    arrive(box.save, D);   // every arrival in the camp is at dusk (Camp › Zeit › Ankunft um)
    await box.persist();
    args = { ...args, mode: 'camp', box, banner: run ? ['AvA hat dich heimgebracht', 'Der letzte Run wurde abgebrochen.'] : box.fresh ? ['Willkommen im Camp', 'E benutzt Dinge · H zeigt die Steuerung'] : null };
  }
  game.scene.add('play', PlayScene, true, args);
  window.nomad = installControl(game);   // remote control for Ava and tests
  return game;
}
