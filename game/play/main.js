// Start the game: load the project, then run the room in Phaser.
// Online (Cloudflare worker): the game data come live from the repository (/api/files), so a save in the workshop
// counts after reloading, without waiting for the build. Elsewhere: the delivered files plus the workshop's drafts from this browser.
//   game.html?room=<id>   plays a room-building block; without: the test room from the area "Spiel"
import { openStore, withDrafts } from '../store.js';
import { cloudFiles } from '../cloud_store.js';
import { browserLoader } from '../browser_loader.js';
import { loadProject } from '../../engine/project.js';
import { PlayScene } from './scene.js';
import { Hud } from './hud.js';
import { installControl } from './control.js';

export async function start(parent, hudRoot) {
  const base = new URL('projects/nomadgirl/', location.href);
  const cloud = await cloudFiles();
  const drafts = cloud ? new Map() : await (await openStore({ project: 'nomadgirl', withoutAssets: true })).all().catch(() => new Map());
  const project = await loadProject(withDrafts(browserLoader(base), cloud ? cloud.files : drafts));
  if (cloud) console.info(`Spieldaten live aus dem Repository (Commit ${cloud.commit.slice(0, 7)})`);
  const D = project.data, rooms = D.rooms || {};
  const asked = new URLSearchParams(location.search).get('room');
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
  game.scene.add('play', PlayScene, true, { project, roomId, base, hud });
  window.nomad = installControl(game);   // remote control for Ava and tests
  return game;
}
