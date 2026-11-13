// Browser tests that check the rig logic step by step play with a fixed setup, whatever the game data says today
// (same as test/fixture.js): the van pulls one trailer, the Wohnanhänger has 3 places, start rig = van + Wohnanhänger.
// The setup goes in as workshop drafts (localStorage "nomadgirl-drafts:<file>"), which the game lays over the data files.
import fs from 'node:fs';

const read = f => JSON.parse(fs.readFileSync(new URL(`../projects/nomadgirl/${f}`, import.meta.url), 'utf8'));
export async function classicRig(page) {
  const tractors = read('data/tractors.json'), containers = read('data/containers.json'), game = read('data/game.json');
  tractors.van.length = 1; tractors.van.pull = 1500; tractors.van.power = 3;   // #008: the van makes 2 ⚡, the old setup counted on 3
  containers.wohnanhaenger.places = 3; containers.modulanhaenger.places = 3;
  game.start.containers = ['wohnanhaenger'];
  game.start.workshops = ['schlafkoje', 'warroom', 'kochnische', 'werkbank', 'lagerregal']; game.start.spare = [];
  const build = read('data/build.json'); build.work = { ...build.work, enabled: true };   // the tests also check Leyla's screwing jobs
  const tank = { ...read('data/tank.json'), enabled: false };   // the cryo tank has its own test (tank_test.mjs)
  const drafts = { 'data/tractors.json': tractors, 'data/containers.json': containers, 'data/game.json': game, 'data/build.json': build, 'data/tank.json': tank };
  await page.addInitScript(d => { for (const [f, x] of Object.entries(d)) localStorage.setItem('nomadgirl-drafts:' + f, JSON.stringify(x)); }, drafts);
}

// The furnished start rig of 08.11.2026 (van + Wohnanhänger with Kochnische and Werkbank + Holzkiste with the Lagerregal):
// since 09.11.2026 Daniel starts with an empty Modul-Anhänger, the camp, crafting and inventory tests still need the workshops.
export async function furnishedStart(page) {
  const game = read('data/game.json');
  game.start.containers = ['wohnanhaenger', 'holzkiste'];
  game.start.workshops = ['schlafkoje', 'warroom', 'kochnische', 'werkbank', 'lagerregal']; game.start.spare = [];
  const tank = { ...read('data/tank.json'), enabled: false }, tractors = read('data/tractors.json');
  tractors.van.power = 3;   // #008: the van makes 2 ⚡; this setup (warroom, kitchenette, workbench) needs 3
  await page.addInitScript(([g, t, tr]) => { localStorage.setItem('nomadgirl-drafts:data/game.json', JSON.stringify(g)); localStorage.setItem('nomadgirl-drafts:data/tank.json', JSON.stringify(t)); localStorage.setItem('nomadgirl-drafts:data/tractors.json', JSON.stringify(tr)); }, [game, tank, tractors]);
}
