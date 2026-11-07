# Teile von Dritten

NomadGirl steht unter GPL v3 oder später. Alle Assets (Grafik, Ton, Musik) entstehen im Projekt selbst mit KI oder Code. Von Dritten stammen nur diese Bausteine (Oberfläche und Spiel-Engine), alle mit GPL-verträglichen Lizenzen:

| Was | Wo | Lizenz |
|---|---|---|
| Lucide Icons 0.452.0 | eingebettet in `game/icons.js` | ISC, siehe `game/LUCIDE-LICENSE` |
| Inter | `game/font/` | SIL Open Font License 1.1, siehe `game/font/INTER-OFL.txt` |
| VT323 | `game/font/` | SIL Open Font License 1.1, siehe `game/font/VT323-OFL.txt` |
| Phaser 3.90.0 (Spiel-Engine) | `game/vendor/phaser.min.js` | MIT, siehe `game/vendor/PHASER-LICENSE.md` |

KI-generierte Assets stehen mit Herkunft in [docs/assets.md](docs/assets.md).

Der gemeinsame Oberflächen-Kern (`game/ui.js`, `ui.css`, `basis.css`, `icons.js`, `store.js`, `browser_loader.js`, `engine/image.js`, `engine/font.js`, `tools/json.js`) ist eine Kopie aus NomadTactics bzw. NomadHouse (Daniels eigene Projekte).

## Ausnahme: Game SFX by OwlishMedia (Daniel, 07.11.2026)

Daniel hat dieses Sound-Pack ausdrücklich als Ausnahme von der Regel „nur eigene Assets“ freigegeben.

- **Was:** 20 der 76 Retro-Spielgeräusche aus „8-Bit Sound Effect Pack“ / „Game SFX by OwlishMedia“ (erstellt mit LabChirp), unter `projects/nomadgirl/assets/sound/handheld/` (Assets `sfx_handheld_*`): Leylas Handheld beim Zocken am Lagerfeuer.
- **Woher:** https://opengameart.org/content/8-bit-sound-effect-pack, Autor OwlishMedia.
- **Lizenz:** CC0 laut OpenGameArt. Hinweis: Eine ältere `License.txt` im Original-Zip erlaubte jede Nutzung außer dem Weiterverkauf der Sounds selbst; das Zip, das wir bekommen haben, enthielt keine Lizenzdatei.
- **Bearbeitet:** mit ffmpeg auf mono gebracht, Hoch- und Tiefpass, kurzes Echo (klingt klein und weit weg), als .m4a und .ogg.
