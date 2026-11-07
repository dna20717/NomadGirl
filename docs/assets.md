# Assets

Alle Assets entstehen im Projekt selbst, mit KI oder Code. Nichts Externes. Jedes Asset steht hier mit Herkunft.

| Datei | Was | Herkunft | Datum |
| --- | --- | --- | --- |
| `assets/leyla/idle.png` | Leyla, Stehen: 8 Frames à 176 × 432 px als Streifen (`leyla_idle`) | aus `idle_source.gif` zugeschnitten (Code) | 07.11.2026 |
| `assets/leyla/idle_source.gif` | Leyla, Stehen: Original-Animation, 8 Frames à 150 ms, 443 × 443 px (`leyla_idle_source`) | KI-generiert (Daniel) | 07.11.2026 |
| `assets/leyla/character_sheet.png` | Character Sheet: Turnarounds, Gesichter, Palette, Details (`leyla_sheet`) | KI-generiert (Daniel) | 07.11.2026 |
| `assets/tiles/metal_source.png` | Tileset Metall: Vorschau 256 × 256 px, Blöcke mit glühenden Kanten, Teile um 32 px versetzt (`tileset_metal_source`) | KI-generiert (Daniel) | 07.11.2026 |
| `assets/tiles/platform.png` | Plattform Metall: 4 Kacheln à 64 × 64 (einzeln, links, Mitte, rechts), Inhalt 33 px oben bündig (`platform_metal`) | aus `metal_source.png` geschnitten (Code) | 07.11.2026 |
| `assets/leyla/run_front.png` | Leyla, Rennen nach vorn: 7 Frames à 96 × 256 px als Streifen, Pixel-Art (`leyla_run_front`) | aus `run_front_source.gif` zugeschnitten, Frames 2–8 (Code) | 07.11.2026 |
| `assets/leyla/stand_front.png` | Leyla, Stehen von vorn: 96 × 256 px, Pixel-Art (`leyla_stand_front`) | Frame 1 aus `run_front_source.gif` (Code) | 07.11.2026 |
| `assets/leyla/run_front_source.gif` | Leyla, Rennen nach vorn: Original, 8 Frames à 200 ms, 256 × 256 px (`leyla_run_front_source`) | KI-generiert (Daniel) | 07.11.2026 |
| `assets/leyla/idle_side.png` | Leyla, Stehen seitlich nach rechts: 4 Frames à 84 × 242 px als Streifen, Pixel-Art (`leyla_idle_side`) | aus `idle_side_source.gif` zugeschnitten (Code) | 07.11.2026 |
| `assets/leyla/idle_side_left.png` | Leyla, Stehen seitlich nach links: 4 Frames à 82 × 242 px, Pixel-Art (`leyla_idle_side_left`) | aus `idle_side_left_source.gif` zugeschnitten (Code) | 07.11.2026 |
| `assets/leyla/run_side.png` | Leyla, Rennen seitlich nach rechts: 8 Frames à 152 × 242 px, Pixel-Art (`leyla_run_side`) | aus `run_side_source.gif` zugeschnitten (Code) | 07.11.2026 |
| `assets/leyla/run_side_left.png` | Leyla, Rennen seitlich nach links: 8 Frames à 148 × 242 px, Pixel-Art (`leyla_run_side_left`) | aus `run_side_left_source.gif` zugeschnitten (Code) | 07.11.2026 |
| `assets/leyla/idle_side_source.gif`, `idle_side_left_source.gif` | Leyla, Stehen seitlich rechts/links: Originale, 4 Frames à 200 ms, 256 × 256 px | KI-generiert (Daniel) | 07.11.2026 |
| `assets/leyla/run_side_source.gif`, `run_side_left_source.gif` | Leyla, Rennen seitlich rechts/links: Originale, 8 Frames à 200 ms, 256 × 256 px | KI-generiert (Daniel) | 07.11.2026 |
| `assets/backgrounds/wasteland_sky.png` | Wastelands, Himmel: Verlauf mit Dither, 576 × 324 px (`wasteland_sky`) | KI-generiert (Daniel) | 07.11.2026 |
| `assets/backgrounds/wasteland_far.png` | Wastelands, ferne Skyline, transparent, 576 × 324 px (`wasteland_far`) | KI-generiert (Daniel) | 07.11.2026 |
| `assets/backgrounds/wasteland_ledge.png` | Wastelands, Steg, transparent, 576 × 324 px (`wasteland_ledge`) | KI-generiert (Daniel) | 07.11.2026 |
| `assets/backgrounds/wasteland_near.png` | Wastelands, nahe Skyline, transparent, 576 × 324 px (`wasteland_near`) | KI-generiert (Daniel) | 07.11.2026 |
| (im Spiel gezeichnet) | Himmel, Skyline von BigCityDelta, Wände, Leitern, Seil-Anker, Platzhalter-Plünderer, Nägel, Partikel (`game/play/art.js`) | Code | 07.11.2026 |

Pfade relativ zu `projects/nomadgirl/`. In Klammern die ID im Werkstatt-Bereich „Assets“.

## Ordner

Alle Grafiken liegen unter `projects/nomadgirl/assets/`, nach Figur oder Thema in Unterordnern (`leyla/`, `backgrounds/`, `tiles/`, später z. B. `enemies/`, `rig/`). Dort werden sie auch online ausgeliefert, damit die Werkstatt sie zeigen kann.

## In der Werkstatt

Bereich „Assets“ ganz oben: Galerie aller Grafiken, gruppiert nach Art (Animation, Kacheln, Bild, Referenz, Original). Kacheln sind Streifen wie Animationen, in der Reihenfolge einzeln, links, Mitte, rechts; das Spiel wählt je nach Nachbarn. Welche Kacheln das Spiel nutzt, steht im Bereich „Spiel“ › Kacheln. Animationen sind Streifen: alle Frames gleich groß nebeneinander in einer PNG-Datei. Entitäten (Leyla, Gegner, Waffen, Items, Rig …) verweisen über „Aussehen“ auf ein Asset und zeigen es im Inspektor.

## Maßstab

Spielauflösung 1920×1080, Kacheln 64 px, Leyla 192 px hoch (Höhe im Spiel ihres Idle-Assets). Grafiken dürfen größer sein (Leylas Frames sind 432 px hoch) und werden geglättet herunterskaliert.

## Leyla – Stil aus dem Character Sheet

- Pinker Irokesen-/Seitenzopf, rasierte Seite mit Tech-Detail, LED-Streifen am Ohr (cyan).
- Ärmellose taktische Weste, gepolsterte Lagen, cyan Nähte, fingerlose Handschuhe, Gürtel mit Taschen, hohe Kampfstiefel mit cyan Sohlen.
- Neon-Implantat am Oberarm.
- Palette: Neon-Cyan, Dunkelgrau, Mittelgrau, Haut, Hautschatten, Magenta (Haare), Pink (Akzent), Tiefviolett.

## Pixel-Art

Die Startseiten-Grafiken (Leyla von vorn, Wastelands-Hintergrund) sind Pixel-Art in kleiner Auflösung (Hintergrund 576 × 324) und werden scharf skaliert (`imageSmoothingEnabled = false`). Leyla im Spiel bleibt hochaufgelöst und geglättet.
