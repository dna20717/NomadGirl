// The rig tests check the logic with a fixed setup, whatever the game data says today (Daniel changes the start rig in the
// workshop; since 09.11.2026 he starts with an empty Modul-Anhänger): the van pulls one trailer, the Wohnanhänger has 3 places, the start rig is van + Wohnanhänger with five workshops.
export function classicRig(D) {
  return {
    ...D,
    tractors: { ...D.tractors, van: { ...D.tractors.van, length: 1, pull: 1500 } },
    containers: { ...D.containers, wohnanhaenger: { ...D.containers.wohnanhaenger, places: 3 }, modulanhaenger: { ...D.containers.modulanhaenger, places: 3 } },
    tank: { ...D.tank, enabled: false },   // the cryo tank has its own tests (tank.test.js)
    game: { ...D.game, start: { ...D.game.start, containers: ['wohnanhaenger'], workshops: ['schlafkoje', 'warroom', 'kochnische', 'werkbank', 'lagerregal'], spare: [] } },
  };
}
