// The rig tests check the logic with a fixed setup, whatever the game data says today (Daniel changes the start rig in the
// workshop): the van pulls one trailer, the Wohnanhänger has 3 places, the start rig is van + Wohnanhänger with five workshops.
export function classicRig(D) {
  return {
    ...D,
    tractors: { ...D.tractors, van: { ...D.tractors.van, length: 1 } },
    containers: { ...D.containers, wohnanhaenger: { ...D.containers.wohnanhaenger, places: 3 }, modulanhaenger: { ...D.containers.modulanhaenger, places: 3 } },
    game: { ...D.game, start: { ...D.game.start, containers: ['wohnanhaenger'], workshops: ['schlafkoje', 'warroom', 'kochnische', 'werkbank', 'lagerregal'] } },
  };
}
