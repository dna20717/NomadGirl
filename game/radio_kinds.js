// Choices of the area „Radio“ (#090), without imports so engine/schema.js can use them (game/radio.js imports the schema).
export const RADIO_STYLES = [['synth', 'Synthwave (Neon, Arpeggio)'], ['dust', 'Wüsten-Folk (gezupft, Shaker)'], ['glitch', 'Glitch (schnell, kaputt)'], ['ambient', 'Nachtsender (Flächen, keine Drums)']];
export const RADIO_TALK = [['ident', 'Senderkennung'], ['ad', 'Werbung (Marken)'], ['weather', 'Wetter (Navigator)'], ['war', 'Frontbericht (Revierkrieg)'], ['tip', 'Gerücht (Orte)'], ['lore', 'Lore']];
export const RADIO_SCALES = [['minor', 'Moll'], ['major', 'Dur'], ['dorian', 'Dorisch'], ['pentatonic', 'Pentatonik']];
export const RADIO_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((k, i) => [String(i), k]);
