---
name: nomadpixel
description: Hochwertige Pixel-Art erzeugen (Tilesets mit Autotiles, Charakter-Animationen, Themen-Sets, Foto-zu-Pixel) und NomadPixel-Aufträge aus der Werkstatt-GUI abarbeiten. Nutzen bei Pixel-Art, Sprites, Tiles, Icons, Spritesheets oder wenn der Nutzer Aufträge/Werkstatt/NomadPixel erwähnt.
---

# NomadPixel – Pixel-Art für unsere Spielprojekte

Pixel-Art entsteht als Text-Raster im `.pix`-Format, wird mit `scripts/pixelart.py` gerendert und **jedes Zwischenergebnis wird mit dem Read-Tool angesehen**, bevor es abgegeben wird. Die Qualität entsteht in der Schleife:

> zeichnen → `check` → rendern → **ansehen** → korrigieren → (2–3 Runden) → **Detail-Runde** → abgeben

**Zwei Modi – zuerst feststellen, wo du bist:**
- **Werkstatt-Modus:** Im NomadPixel-Repo (es gibt `auftraege/` und `projekte/`). Aufträge kommen aus der GUI → Abschnitte 1–4.
- **Direkt-Modus:** In einem Spiel-Repo (Skill wurde dorthin installiert, Stilbibel in `.claude/nomadpixel-stil.json`). Grafiken werden für eine laufende Aufgabe gezeichnet und nach den Regeln des Spiels eingebaut → Abschnitt 12.

Pfade unten relativ zur Repo-Wurzel. `PA` = `python3 .claude/skills/nomadpixel/scripts/pixelart.py`.
Abhängigkeiten: Python 3.10+, `pip install pillow numpy`.

## 1. Repo-Struktur

```
.claude/skills/nomadpixel/   dieser Skill: SKILL.md, scripts/pixelart.py, gui/
projekte/<slug>/stil.json    Stilbibel pro Spiel (Palette, Licht, Outline, Stil, Größen)
auftraege/<id>/auftrag.json  Auftrag aus der GUI (+ referenz.jpg, eingabe.pix)
ergebnisse/<id>/             Ergebnis: PNGs, ZIP, .pix, ergebnis.json (Manifest)
```

## 2. Werkstatt-GUI

Start: `python3 .claude/skills/nomadpixel/gui/server.py` → http://localhost:8765 (`--host 0.0.0.0` für LAN).
Die GUI schreibt Aufträge und Stilbibeln als Dateien und zeigt `ergebnisse/` als Galerie. Läuft sie nicht, die Dateien trotzdem direkt bearbeiten: das Format unten ist die Schnittstelle.

## 3. Aufträge abarbeiten („arbeite die Aufträge ab“, „schau in die Aufträge“)

1. Offene Aufträge finden: alle `auftraege/*/auftrag.json` mit `"status": "offen"` (ältester zuerst). `auftraege/_papierkorb/` ignorieren.
2. Pro Auftrag: `status` auf `"arbeit"` setzen (Datei direkt editieren; restliche Felder erhalten).
3. Lesen: `briefing` (Markdown, für Menschen) und `daten` (strukturiert, maßgeblich). Gibt es `daten.projektSlug` und `projekte/<slug>/stil.json`, gilt die Stilbibel; Abweichungen im Auftrag haben Vorrang.
4. Nach Typ arbeiten (Abschnitte 6–9). Typen: `tileset`, `anim`, `set`, `foto`, `pix` (= Änderungswunsch an `eingabe.pix`).
5. Ergebnis ablegen in `ergebnisse/<gleiche id>/` mit Manifest (Abschnitt 4).
6. Auftrag abschließen: `status: "fertig"`, `antwort`: 1–3 Sätze, was geliefert wurde und welche Entscheidungen getroffen wurden (z. B. Farbersatz, Interpretation).
7. Bei echten Unklarheiten, die das Ergebnis grundlegend ändern würden: Rückfrage an den Nutzer statt raten; in `antwort` notieren, wenn mit Annahme weitergearbeitet wurde.
8. Danach `git add auftraege/<id> ergebnisse/<id>` und committen (`NomadPixel: <titel>`). Pushen gemäß CLAUDE.md des Repos.

`daten`-Felder (gemeinsam): `projekt`, `projektSlug`, `palette` (Hex-Liste oder `"auto"`), `paletteName`, `licht`, `outline` (`Dunkle Outline` | `Selektiv (farbig)` | `Keine`), `stil`.
- `tileset`: `perspektive`, `tileGroesse`, `terrains[{n,d}]`, `autotile`, `uebergaenge`, `varianten`, `nahtlos`, `deko`, `notiz`
- `anim`: `charakter`, `beschreibung`, `groesse[w,h]`, `ansicht`, `richtungen`, `animationen[{n,f,fps,loop,note}]`, `varianten`, `notiz`
- `set`: `thema`, `spalten`, `zeilen`, `iconGroesse`, `ansicht`, `hintergrund`, `motive[]`, `ergaenzen` (freie Plätze selbst füllen), `rand`, `einsatz`, `notiz`
- `foto`: `breite`, `farben`, `kontrast`, `saettigung`, `projektpalette`, `hintergrundEntfernen`, `toleranz`, `dithering`, `outlineFoto`, `zweck`, `wichtig`, `notiz`; Foto unter `foto` (Pfad)
- `pix`: Datei `auftraege/<id>/eingabe.pix`

## 4. Ergebnis-Manifest `ergebnisse/<id>/ergebnis.json`

```json
{
  "auftrag": "<id>",
  "titel": "Kurzer Titel für die Galerie",
  "erstellt": "2026-11-19",
  "vorschau": "vorschau.png",
  "notiz": "Was geliefert wurde, Entscheidungen, Hinweise",
  "dateien": [
    {"datei": "<name>_paket.zip", "beschreibung": "Alles in einem"},
    {"datei": "<name>.png", "beschreibung": "1:1 zum Einbauen"},
    {"datei": "<name>.pix", "beschreibung": "Quelle zum Weiterbearbeiten"}
  ]
}
```

Lieferumfang **immer**: PNG in 1:1 (zum Einbauen), eine vergrößerte Vorschau (`vorschau.png`, 2–4×, für Menschen), `.pix`-Quelle und ein ZIP mit allem (Einzel-PNGs in Unterordner). Kein Engine-spezifisches Format, nur PNG + ZIP (+ JSON mit Koordinaten bei Sheets).

## 5. Format `.pix` und Befehle

```
[meta]
size = 16x24        # Standardgröße für Frames ohne Raster
tile = 32           # Tile-Größe        icon = 32   # Icon-Größe für Sets
fps = 6             # pro Animation: fps_walk = 10
bg = #333c57        # GIF-Hintergrund   cols = 4    # Spalten im Set
palette = sweetie16 # optional Preset -> Zeichen 0-9,a-f
mirror = x          # optional global spiegeln (x_odd: Mittelspalte nicht doppeln)

[palette]
. = transparent
K = #1a1c2c   # Outline      (Kommentar braucht ' # ')

[part kopf mirror]  # wiederverwendbares Teil; Flag mirror/mirror_odd nur für dieses
[frame walk1]       # 'walk1', 'walk_2' -> Animation 'walk'
@ beine 2 16        # Platzierung: @ NAME x y [fx] [fy]
[tile gras]         # Tile
[icon apfel]        # Icon eines Sets
[map test]          # Kartenvorschau: 'G = gras' Legende + Raster (1 Zeichen = 1 Tile)
```

Regeln: 1 Zeichen = 1 Pixel; `#` und `@` keine Palettenzeichen; Zeilen gleich breit; Frames einer Animation gleich groß. Raster zuerst, Platzierungen darüber (Reihenfolge = Ebenen). Platzierungen dürfen auf Teile, Frames, Tiles und Icons zeigen.

Bei großen Grafiken (≥ 24 px) das Raster per kleinem Python-Skript mit `scripts/zeichnen.py` erzeugen: Formen mit Kugel-Schattierung (`ellipse`, `rellipse`, `rbox`, `thick`, `shade_mask`), danach Detail-Runde und `outline`. Die Prüfschleife bleibt Pflicht; Details werden gezielt gesetzt, nicht dem Zufall überlassen.

| Befehl | Zweck |
|---|---|
| `PA check F` | immer zuerst |
| `PA preview F [--name N]` | Raster + 1:1 → **ansehen** |
| `PA render F [--name N] [--scale 12]` | PNG |
| `PA gif F [--anim A]` | ein GIF pro Animation |
| `PA onion F --anim A` | Vorher-Geist (rot) / Nachher-Geist (blau): Bewegung prüfen |
| `PA sheet F [--scale 1]` | Spritesheet (Zeile pro Animation) + `.json` |
| `PA tileset F [--cols 8] [--scale 1]` | Tileset-PNG + `.json` |
| `PA tilecheck F [--name N]` | Tiles 3×3 gekachelt: Nähte prüfen |
| `PA map F [--name M]` | Karte aus Tiles rendern |
| `PA autotile F --fill T --base T --edge C [--inner C] [--shadow C] [--border 2] [--radius 3] [--blob]` | Übergangs-Tiles + Demo-Karte |
| `PA iconset F [--cols 4] [--scale 1] [--split DIR]` | Set-Raster + `.json`, optional Einzel-PNGs |
| `PA contact F [--scale 4]` | Prüfbogen: jedes Icon auf dunklem + hellem Grund |
| `PA setcheck F` | Konsistenz: Größe, Rand, Zentrierung, Farben, Outline, Helligkeit |
| `PA refcheck F --ref RASTER.png [--cell 32]` | Detaildichte und Farbstufen im Vergleich zu bestehenden Icons des Spiels |
| `PA palcheck F --pal-file PALETTE` | alle Farben aus der Projektpalette? (.hex, .png, .json oder `--palette "#hex,…"`) |
| `PA outline F --char C [--name N] [--diagonal]` | automatische Outline |
| `PA fromimg BILD --width 48 [...]` | Foto → `.pix` |
| `PA palettes` | Presets: sweetie16, pico8, endesga16, gameboy |

## 6. Tilesets

1. Perspektive, Tile-Größe, Palette, Terrains aus Auftrag/Stilbibel.
2. Je Terrain ein Grund-Tile: Fläche ruhig, Akzente unregelmäßig, nichts am Rand, das beim Kacheln Muster bildet. `tilecheck` → ansehen → Nähte/Wiederholungen beseitigen. Varianten laut Auftrag.
3. Übergänge:
   - **Top-down:** `autotile --blob` (47 Tiles inkl. Innenecken; Bits N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128; Namen `<fill>_bNNN`), ohne `--blob` 16er-Set (N=1 E=2 S=4 W=8). `--edge` Kante, `--inner` Randlicht, `--shadow` Schlagschatten.
   - **Side-Scroller:** Kanten sind richtungsabhängig. Eigene Plattform-Logik pro Blob-Maske schreiben: oben eine dicke Lauffläche/Leiste (z. B. Kante–Glanz–Material–Schatten, 3–4 px), Seiten 1–2 px, unten Schattenabschluss, Außenecken abrunden, Innenecken so schließen, dass Leiste und Seitenstreifen der Nachbarn nahtlos ineinanderlaufen.
4. Demo-Karte rendern und ansehen; Ecken/Kanten nachschärfen.
5. Deko-Objekte als Tiles derselben Größe; Objekte stehen auf der Unterkante (keine Luft zum Boden).
6. Vorschau: eine kleine **Szene** aus Boden + Deko + schlichtem Hintergrund zeigt die Wirkung am besten.

## 7. Charakter-Animationen

1. Teile (`[part]`): Kopf, Körper, Beine, Arme, Ausrüstung. Symmetrisches mit `mirror`, Licht danach asymmetrisch.
2. Frames aus Teilen zusammensetzen (`@ teil x y`), Bewegung über Offsets und Teil-Varianten: Proportionen bleiben stabil.
3. Faustregeln: Idle 2–4 Frames (1 px Atmen), Walk 4–8 (Kontakt, Passing, gespiegelt), Run 6–8 mit Vorlage, Attack: Ausholen (lang) → Schlag (1 Frame, Schmierbild) → Nachschwung, Hurt 2, Death 4–8. Kopf in Schritt-Frames 1 px tiefer, Arme gegengleich zu Beinen.
4. `onion` ansehen (flüssig? Kontur flimmert nicht?), dann `gif`.
5. Richtungen: Seite einmal zeichnen, Gegenrichtung per `fx`; Top-down: unten/oben/Seite(+fx).
6. Lieferung: `sheet --scale 1` + json, GIFs, Vorschau.

## 8. Themen-Sets (gleicher Stil, festes Raster)

1. **Stil zuerst festlegen** und als Kommentar in `[meta]` notieren: Palette (Rampen pro Material: Schatten/Basis/Licht/Glanz), Outline-Regel, Lichtrichtung, Ansicht (Waffen/Werkzeuge diagonal 45° von unten links nach oben rechts, Essen/Tränke frontal), Mindest-Rand, Füllgrad (Motive nutzen ca. 50–80 % der Fläche).
2. Motivliste aus dem Auftrag; bei `ergaenzen` freie Plätze mit passenden, gut unterscheidbaren Motiven füllen.
3. 2–3 **Leit-Icons** zuerst zeichnen, `contact` ansehen; erst wenn die sitzen, den Rest.
4. Wiederkehrendes als `[part]` (Griffe, Flaschen, Teller) – das hält den Stil zusammen.
5. `setcheck` laufen lassen, Hinweise abarbeiten (Ausreißer bei Größe/Helligkeit sind manchmal gewollt: dann bewusst lassen). `contact` auf dunklem und hellem Grund prüfen: Lesbarkeit auf beiden?
6. Lieferung: `iconset --scale 1` + json, `--split` Einzel-PNGs, Prüfbogen als Vorschau.

## 9. Foto → Pixel-Art

1. `PA fromimg <foto> --width <breite> --colors <farben> --contrast <k> --saturation <s> --simplify 1` mit den Werten aus `daten`; `--palette "#hex,#hex,…"` mit `daten.palette`, wenn `projektpalette`; `--removebg --tol <toleranz>`, `--outline auto`, `--dither` laut Auftrag.
2. Die Automatik liefert den Startpunkt. Rendern, Vergleichsbild Original | Pixel anlegen, ansehen.
3. **Von Hand verfeinern** – hier entsteht die Qualität: Augen (Pupille + 1 px Glanz), Nase, Mund klar; Rauschen in Flächen glätten; `wichtig`-Merkmale betonen; Konturen begradigen; Farben reduzieren.
4. Echte Personen freundlich-stilisiert darstellen, keine bloßstellende Karikatur.

## 10. Detail-Runde (Pflicht ab 24 px, vor der Abgabe)

Nach den Form- und Licht-Runden, wenn Silhouette und Schattierung sitzen. Ziel: die Feinstruktur der bestehenden Grafiken des Projekts erreichen, ohne Unruhe.

1. **Messen:** Gibt es Referenzgrafiken im Spiel (Stilbibel `referenzen`), `PA refcheck <datei> --ref <raster.png>`. Ziel: Detaildichte im Referenzbereich (Spanne wird angezeigt). Ohne Referenz: 0,45–0,60 als Richtwert für 32 px.
2. **Materialstruktur** je Material passend (`zeichnen.py`):
   - Holz/Fasern/Haare: `grain` entlang der Wuchsrichtung
   - Fleisch, Gestein, Pilzhaut, Rost: `speckle` (Dichte 0,15–0,25)
   - Glas/Flüssigkeit: senkrechte Schlieren, 2–5 Bläschen, eine helle Glanzkante
   - Metall: 1–2 Kratzer, harte Glanzkante, dunkle Fuge zwischen Teilen
3. **Innenlinien:** Wo Bauteile aneinanderstoßen (Hut/Lamellen, Deckel/Glas, Griff/Klinge), mit `inner_line` eine dunkle Fuge in der Schattenfarbe des oberen Teils setzen.
4. **Licht verfeinern:** 1–3 Mikro-Reflexe (einzelne helle Pixel) auf der Lichtseite; `rim` als Randlicht auf der Schattenseite, wenn eine Lichtquelle im Bild ist (Glow, Neon, Feuer).
5. **Erzähldetails:** 1–2 kleine Dinge, die eine Geschichte erzählen (Etikett mit Gekritzel, Chiliflocken, Brandzeichen, Kerbe, Dampf, Krümel).
6. **Gegenprüfen:** Nach der Runde erneut `refcheck` + ansehen in 1:1 **und** vergrößert. Zu unruhig (über dem Referenzbereich) → Strukturdichte senken oder Flächen beruhigen. Prüfen, dass Struktur nicht auf fremde Materialien übergreift (Rampen sauber trennen: keine Farbe in zwei Rampen, die verschieden behandelt werden).
7. Schlichte Objekte dürfen bewusst weniger Farbstufen haben; das in `antwort`/Notiz kurz begründen.

## 11. Handwerk – Checkliste bei jedem Ansehen

- Silhouette bei 1:1 klar lesbar?
- Lichtrichtung überall gleich (Standard oben links)?
- Hue-Shifting: Schatten kühler, Lichter wärmer statt nur dunkler/heller
- Kein Pillow-Shading, kein Banding, keine Jaggies, keine verwaisten Einzelpixel
- Selektive Outline: außen dunkel, an Lichtkanten farbig
- 4–16 Farben pro Grafik, Palette projektweit einheitlich; fehlt eine gewünschte Farbe (z. B. reines Schwarz), die nächstliegende nehmen und in `antwort` erwähnen
- Animationen: Volumen konstant, Kontur flimmert nicht
- Objekte stehen auf der Unterkante, Icons halten den Mindest-Rand

## 12. Direkt-Modus im Spiel-Repo (`/pixel <was gebraucht wird>`)

Für den Fall „Baue Feature X und erzeuge dir die Grafiken mit /pixel“. Die Spielregeln haben immer Vorrang vor diesem Skill.

**Aufträge aus der Spiel-Werkstatt (`/pixel Aufträge`):** Nennt die Stilbibel unter `auftraege` einen Bereich/eine Datei (NomadGirl: Bereich `pixelOrders`, Datei `projects/nomadgirl/data/pixel_orders.json`), dort alle Einträge mit Status `open` abarbeiten (ältester zuerst): Status auf `working` setzen, zeichnen wie unten, Ergebnisse als Assets anlegen, im Auftrag `results` (Asset-IDs), `answer` (1–3 Sätze, nicht-technisch) und `date` setzen, Status `done`. Unklarheiten: Status `question` und die Frage in `answer`. Vorlagen stehen in `references` (Stil-Vorbilder oder Foto-Asset), ein Ziel-Raster in `target`. Daten mit dem Werkzeug des Spiels schreiben (NomadGirl: `node tools/ng.js set pixelOrders <id> <feld> '<json>'`).

1. **Regeln des Spiels lesen:** `CLAUDE.md`/`AGENTS.md` und die dort genannte Grafik-/Asset-Doku. Herausfinden: Palette, Größen und Raster (z. B. Symbol-Raster 8×8 à 32 px), Ablageordner, Dateinamen-Sprache, wie Assets registriert werden (z. B. Daten-JSON), wo die Herkunft vermerkt wird, welche Prüfungen/Tests laufen müssen, Branch- und Commit-Regeln.
2. **Stilbibel laden:** `.claude/nomadpixel-stil.json` (Palette bzw. `paletteDatei`, `outline`, `licht`, `stil`, `referenzen` = Pfade zu bestehenden Grafiken im Repo, `hinweise`). Fehlt sie: aus den Spielregeln und vorhandenen Grafiken ableiten und anlegen.
3. **Bedarf festlegen:** Welche Grafiken braucht die Aufgabe, in welcher Größe, wo werden sie angezeigt? Vorhandenes bevorzugen: freie Felder in bestehenden Rastern füllen oder ein Raster fortsetzen, statt neue Dateien zu erfinden, wenn das Spiel so arbeitet. Bei Grafiken über 64 px oder sehr vielen Grafiken (> 16) kurz Rückmeldung an den Nutzer mit Plan und Umfang.
4. **Arbeitsdateien** (Skripte, Zwischenstände, Vorschauen) in einen ignorierten Ordner (z. B. `output/nomadpixel/` oder `/tmp`), nie lose ins Repo.
5. **Zeichnen** mit Prüfschleife und Detail-Runde (Abschnitte 6–10). Pflicht vor dem Einbau:
   - `PA palcheck … --pal-file <paletteDatei>` → alle Farben aus der Projektpalette
   - `PA refcheck … --ref <referenz>` → Detaildichte im Bereich der bestehenden Grafiken
   - Vergleichsbild: neue Grafiken neben 3–4 Referenzen, vergrößert **und** in 1:1, ansehen
6. **Einbauen** genau nach den Spielregeln: Datei an den richtigen Ort, registrieren (Daten/Manifest), Verweise setzen. Die `.pix`-Quelle und ggf. das Zeichenskript als Original daneben ablegen, wenn das Spiel Originale aufbewahrt (z. B. `<name>_source.pix`).
7. **Herkunft vermerken**, wie das Spiel es verlangt, als: `NomadPixel (Claude Code, Text-Pixel-Art, Palette <Name>, .pix-Quelle)` mit Datum.
8. **Prüfen:** Prüfbefehle und Tests des Spiels laufen lassen; ein Bild der Grafik **im Spiel** ansehen, wenn das Spiel das ermöglicht.
9. **Berichten:** kurz und nicht-technisch, mit Vergleichsbild. Committen/pushen nach den Regeln des Spiels.

Aktualisieren: Der Skill wird aus dem NomadPixel-Repo installiert (`werkzeuge/installieren.py`). In `.claude/skills/nomadpixel/VERSION` steht, welche NomadPixel-Version installiert ist.
