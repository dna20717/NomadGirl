# Assets

Alle Assets entstehen im Projekt selbst, mit KI oder Code. Nichts Externes. Jedes Asset steht hier mit Herkunft.

| Datei | Was | Herkunft | Datum |
| --- | --- | --- | --- |
| `assets/leyla/idle.png` | Leyla, Stehen: 8 Frames à 176 × 432 px als Streifen (`leyla_idle`) | aus `idle_source.gif` zugeschnitten (Code) | 07.11.2026 |
| `assets/leyla/idle_source.gif` | Leyla, Stehen: Original-Animation, 8 Frames à 150 ms, 443 × 443 px (`leyla_idle_source`) | KI-generiert (Daniel) | 07.11.2026 |
| `assets/leyla/character_sheet.png` | Character Sheet: Turnarounds, Gesichter, Palette, Details (`leyla_sheet`) | KI-generiert (Daniel) | 07.11.2026 |

Pfade relativ zu `projects/nomadgirl/`. In Klammern die ID im Werkstatt-Bereich „Assets“.

## Ordner

Alle Grafiken liegen unter `projects/nomadgirl/assets/`, nach Figur oder Thema in Unterordnern (`leyla/`, später z. B. `enemies/`, `rig/`). Dort werden sie auch online ausgeliefert, damit die Werkstatt sie zeigen kann.

## In der Werkstatt

Bereich „Assets“ ganz oben: Galerie aller Grafiken, gruppiert nach Art (Animation, Bild, Referenz, Original). Animationen sind Streifen: alle Frames gleich groß nebeneinander in einer PNG-Datei. Entitäten (Leyla, Gegner, Waffen, Items, Rig …) verweisen über „Aussehen“ auf ein Asset und zeigen es im Inspektor.

## Maßstab

Spielauflösung 1920×1080, Kacheln 64 px, Leyla 256 px hoch. Grafiken dürfen größer sein (Leylas Frames sind 432 px hoch) und werden geglättet herunterskaliert.

## Leyla – Stil aus dem Character Sheet

- Pinker Irokesen-/Seitenzopf, rasierte Seite mit Tech-Detail, LED-Streifen am Ohr (cyan).
- Ärmellose taktische Weste, gepolsterte Lagen, cyan Nähte, fingerlose Handschuhe, Gürtel mit Taschen, hohe Kampfstiefel mit cyan Sohlen.
- Neon-Implantat am Oberarm.
- Palette: Neon-Cyan, Dunkelgrau, Mittelgrau, Haut, Hautschatten, Magenta (Haare), Pink (Akzent), Tiefviolett.
