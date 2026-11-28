# CampBuilder v2 (Plan, #196)

Ein eigenes Bau-Spielzeug für Camps, getrennt vom Spiel, aber auf seiner Technik. Stand: **Planung**, noch nichts gebaut. Direktive (Daniel, 28.11.2026): „Es muss gut aussehen und sich ausgezeichnet anfühlen.“ Wir gehen direkt hoch poliert ran: genug Assets, dazu der eigene Pixel-Skill für Lücken.

Daniel, 28.11.2026: „genau diese Art von Gefühl haben, wenn man ein Camp aufbaut. Zunächst ohne Ressourcen-Limits. Alles kann sauber platziert werden, snappt aneinander, wächst bei Bedarf durch Dragging, kann eingefärbt werden. Und das nicht nur mit unseren Objekten, sondern auch mit den vielen Dingen aus den Tilesets.“ Dazu: „Bedienung nur mit Controller und ggf. Touch, aber nicht Maus. Idealerweise soll das Bauen einen Zen-Zustand erzeugen.“ Name: **CampBuilder v2**.

Weichen (28.11.2026, Daniel: „B“ auf Avas Paket, mit geänderter Bedienung):

| Weiche | Entscheidung |
|---|---|
| Perspektive | Seitenansicht wie im Spiel, streng orthogonal (Puppenhaus-Querschnitt) |
| Wachsen | Flächen und Linien ziehen, **lebendige Details als Schalter** |
| Leyla | erst ohne, später als Probe-Bewohnerin |
| Bedienung | **Controller zuerst, Touch dazu, keine Maus** |
| Grenzen | keine Ressourcen, kein Geld, keine Plätze-Budgets |

## Was v1 schon kann

„v1“ ist der Camp-Baukasten im Spiel (`docs/features/camp.md` › Deko, Camp-Baukasten #111, Farbe #114, Ziehen zum Wachsen #116, Innen-Deko #118). Daniel wollte schon am 19.11. „etwas Gemütliches, das hübsch aussieht, wie Townscaper oder Tiny Glade aus der Sidescroll-Perspektive“. Vorhanden und wiederverwendbar:

- **66 Deko-Stücke** (`data/decor.json`), viele mit 8–16 Varianten (R wechselt), Spiegeln, Tragflächen, Stapeln, Nachbarn, Haken für Licht und Flammen.
- **12 Ensembles** (`data/decor_sets.json`): Gruppen, die sich erkennen und belohnen (✨ + goldenes Funkeln).
- **Ziehen zum Wachsen** (`build_grow.js`): Höhe, Breite, Stapel, Stufe für Stufe mit Mittelstücken (`drawModular`).
- **Pinsel** (`build_paint.js`, `paintPixels`): Umfärben mit Licht und Schatten, AAP-64.
- **Auto-Details:** Moos, Ranken, Katze, Krähen, Lichterketten zwischen Pfosten.
- **Bau-Raster** in halben Kacheln um AvA, **AvA als Zeiger** mit Controller (`build_mode.js`), Vibration (`buzz`), Töne aus Code (`sfx.js`).
- **Kacheln:** 12 Kachel-Sets (`data/terrain.json`) mit Oberfläche, Füllungen, **160 Clutter-, 112 Decal- und 163 Prop-Feldern**; `autotile.js` leitet fehlende Kachel-Fälle aus Code ab (Enden, Unterseiten, Dächer, Nähte); `engine/dressing.js` verteilt Clutter nach Regeln (Ort-Typen Boden, Dach, Kante, Ecke, Wand).
- **Atmosphäre:** Himmel und Wetter (`weather.js`), Licht aus Code, Tiefe aus Code (Kontaktschatten, AO), Seile (`drone_cables.js`, `string_lights.js`), Radio-Musik aus Code.

v2 nimmt das alles aus dem Spielkreislauf heraus (kein Spielstand, kein Händler, keine Budgets) und baut darauf die Zen-Schicht.

## Gelernt: Wie die Vorbilder das Gefühl machen

- **Townscaper** (Oskar Stålberg): gebaut wird auf den **Ecken** eines Rasters, gezeichnet auf dem **dualen Raster** (eine Zelle je Ecke, Marching Cubes auf einem schiefen Viereck-Raster), Details kommen aus **Wave Function Collapse**. Folge: Jeder Klick ist gültig, das Ergebnis sieht immer gut aus, gleiche Eingabe gibt gleiche Form. Das „Plopp“ ist ein einfacher Ton mit wechselnder Tonhöhe. Man soll zuschauen, wie sich die Szene setzt.
- **Tiny Glade** (Pounce Light, Anastasia Opara + Tomasz Stachowiak): entstand aus einem prozeduralen **Mauer-Generator**. Man zeichnet Linien, die Mauern ordnen sich von selbst um. Die Welt reagiert auf Zusammenhang: Ein Weg in eine Mauer macht einen Torbogen. Fenster verschmelzen, Dächer passen sich an. Die Entwickler waren selbst überrascht, dass Leute „Mauern zeichnen“ spielen wollen.
- **Cloud Gardens** (Noio, Kingdom-Macher): postapokalyptische Dioramen, Pflanzen wachsen, wo man Schrott hinstellt. Ziel laut Noio: „fill you with satisfaction without the frustration“. Liegt sehr nah an unserer Wasteland-Stimmung.
- **Summerhouse** (Friedemann, Berlin, Mitgründer von Islanders): ohne Ziele, ohne Bedingungen; Stücke werden aneinander und aufeinander gesteckt; lebt von einer ganz bestimmten Sommer-Atmosphäre.
- **Unpacking** (Witch Beam): GDC „'Unpacking' Zen“ über **subtraktives Design** ohne Scheitern und ohne Punkte; über 14.000 Foley-Töne, von 75.000 geplanten auf unter 15.000 gedrückt, weil Gegenstände auf weichem Untergrund oft gleich klingen. Der **Untergrund bestimmt den Klang**.
- **Zen allgemein:** Druckelemente (Ziele, Zeitlimits, Game Over, Lebensbalken) fallen weg; geringe kognitive Last; Material-Klänge erden; klares Feedback über Bild, Ton und Haptik zugleich (Tetris Effect). Spiele, die ausdrücklich „Meditation“ sein wollen, wirken laut Kritik oft schwächer als Spiele, die einfach Druck weglassen.

## Die Zen-Regeln für v2

1. **Nie Nein.** Kein Rot, kein „geht nicht“. Wo ein Stück nicht hinpasst, rutscht der Geist zum nächsten Platz, an dem es passt. Das Bauen lässt immer eine Antwort zu.
2. **Bauen klingt wie Musik.** Jedes Einrasten spielt einen Ton aus einer Pentatonik (darin klingt jede Folge harmonisch), beim Ziehen steigt er Stufe für Stufe. Das Material wählt die Klangfarbe (Metall, Holz, Stoff, Erde, Glas), der Untergrund färbt ihn mit (Unpacking). Ein neues Ensemble löst einen Akkord aus.
3. **Leise Oberfläche.** Keine Zahlen, kein Geld, keine Meldungstexte. Nach ein paar Sekunden ohne Eingabe blendet alles aus, was nicht Welt ist. Namen und Hilfen erscheinen nur auf Nachfrage.
4. **Die Welt antwortet.** Krähen landen auf dem neuen Dach, die Katze sucht sich eine Tragfläche, Lichter gehen in der Dämmerung an, Moos und Rost wachsen nach, Wind bewegt Stoffe.
5. **Nichts springt.** Alles gleitet mit Easing: der Zeiger, die Kamera, das Stück in der Hand. Abgesetzte Stücke ploppen mit Squash & Stretch und setzen sich, Staub rieselt.
6. **Rückgängig ist Zurückspulen.** Halten spult Schritt für Schritt zurück (Band-Geräusch, die Stücke fliegen rückwärts), Wiederholen spult vor. Kein Schritt geht verloren.
7. **Eine Hand, eine Geste.** Keine tiefen Menüs. Auswahl über ein Rad, Bauen über Halten und Ziehen.
8. **Gleiche Eingabe, gleiches Bild.** Varianten, Clutter und Details hängen an einem Samen aus der Position. Zurückspulen und neu setzen ergibt dasselbe, nichts würfelt beim Wiederholen neu.

## Technik-Tricks: viel Welt aus wenig Grafik

| Trick | Vorbild | Haben wir | Neu für v2 |
|---|---|---|---|
| **Duales Raster** (Marching Squares): man malt Zellen „voll/leer“, gezeichnet werden die Ecken mit 16 Fällen | Townscaper | `autotile.js` leitet Enden, Unterseiten, Nähte aus den Kachel-Sets ab | Boden, Hügel, Plattformen **malen** statt Räume tippen; jedes Kachel-Set wird zum Pinsel |
| **Drei- und Neun-Teilung**: Anfang, Mittelstück wiederholt, Ende | überall | Mittelstücke (`drawModular`), Neon-Rahmen | für alles Lange: Zäune, Planen, Stege, Kabelkanäle |
| **Umfärben mit Erhalt von Licht und Schatten** | Townscaper-Farben | `paintPixels`, `dye` | für jedes Stück und jede Kachel, Paletten-Rampen aus AAP-64 |
| **Varianten + Spiegeln + Samen aus der Position** | Townscaper | `hash`, Varianten, `f` | eine Grafik ergibt viele Looks, stabil |
| **Regel-Dressing**: Kleinkram verteilt sich nach Ort-Typ | Tiny Glade, Cloud Gardens | `engine/dressing.js`, 160 Clutter-Felder | Schalter „lebendige Details“: Ränder bekommen Steine, Wände Decals, Ecken Kram |
| **Reaktion auf Zusammenhang** | Tiny Glade (Weg + Mauer = Tor) | Lichterkette zwischen Pfosten, Ensembles | Regeln: Leiter lehnt sich an, Plane spannt sich zwischen Stangen, Zaun bekommt ein Tor, wo ein Weg durchgeht |
| **Bewegung aus Code** | alle | Wackeln, Flackern, Rotor, Verlet-Seile | Bewegung beim Absetzen (Nachfedern), Wind über alles |
| **Licht und Tiefe aus Code** | Tiny Glade | Glow, Kontaktschatten, AO, Tag/Nacht | Uhr frei drehbar (Abendrot zum Bauen) |
| **Klang aus Code** | Townscaper, Unpacking | `sfx.js` (Web Audio) | Pentatonik, Material-Familien, Untergrund, Raumhall |
| **Magnetisches Einrasten** | Summerhouse | Bau-Raster, Ziele | Andockpunkte bewerten (Fläche, Kante, Anker), der Zeiger wird sanft hingezogen |
| **Haptik** | Tetris Effect | `buzz` | weiche, kurze Impulse je Stufe, stärker beim Einrasten |

Fundus ohne eine neue Grafik: 66 Deko-Stücke mit Varianten, 160 Clutter-, 112 Decal-, 163 Prop-Felder aus den Kachel-Sets, 12 Kachel-Sets als Boden-Pinsel, Container und Werkstatt-Bilder. Neue Grafik braucht es erst für Lücken, die beim Spielen auffallen.

## Bedienung

**Controller** (Belegung ⚠️ vorläufig, nach der UI-Grammatik aus `docs/features/ui.md`):

| Eingabe | Wirkung |
|---|---|
| Linker Stick | AvA fliegt frei, mit Magnet zu Andockpunkten |
| Steuerkreuz | springt zum nächsten Andockpunkt in der Richtung |
| Rechter Stick | Kamera schieben |
| LT / RT | Zoom raus / rein (weich) |
| A | absetzen bzw. aufnehmen; **A halten + Stick** = ziehen (wachsen, Boden malen, Linie spannen) |
| B | Stück zurück ins Rad, Zeiger leer |
| X | Variante wechseln (halten = rückwärts) |
| Y halten | Farbrad auf dem rechten Stick, loslassen färbt |
| LB halten | Bau-Rad (Kategorien und Stücke) auf dem rechten Stick |
| RB | Kopieren: das Stück unter AvA in die Hand |
| Select halten | Zurückspulen; Start = Menü (Speichern, Uhr, Wetter, Details an/aus, Fotomodus) |

**Touch:** unten eine Leiste mit dem Bau-Rad als Fächer; Stück aus dem Fächer in die Welt ziehen, tippen setzt das gewählte Stück, gedrückt halten auf einem Stück nimmt es auf, Griffe ziehen lässt wachsen, zwei Finger schieben und zoomen, Farbtupfer antippen und dann Stücke antippen. Zurückspulen über einen Halte-Knopf.

**Maus:** gibt es nicht. Für die Tests bekommt die Seite eine Fernsteuerung wie `window.nomad` (`window.campbuilder`), die Controller-Eingaben einspielt.

## Was man bauen kann

Das Rad ordnet automatisch aus den Daten, neue Stücke in der Werkstatt erscheinen sofort:

- **Boden**: jedes Kachel-Set als Pinsel (Wüste, Beton, Metall, Ruinen …), malen und wegradieren, Plattformen.
- **Rig**: Container in allen Längen, offen und zu, gestapelt, Werkstatt-Bilder als Einrichtung (ohne Funktion).
- **Deko**: alles aus `decor.json`, mit Varianten, Wachsen und Farben.
- **Kram**: Clutter und Props aus den Kachel-Sets als einzelne Stücke.
- **Aufkleber**: Decals auf Wände, Container und Felsen.
- **Licht & Leben**: Lampen, Lichterketten, Feuer, Pflanzen, Tiere.

## Bauplan (Architektur)

- **Seite** `campbuilder.html` → online `/campbuilder` (wie `/megarig`), Phaser wie das Spiel.
- **Code** `game/campbuilder/`: `main.js` (Start), `stage.js` (Bühne, Himmel, Wetter, Kamera), `cursor.js` (AvA, Magnet), `snap.js` (Andockpunkte, „nie Nein“), `wheel.js` (Bau- und Farbrad), `tones.js` (Pentatonik, Material, Untergrund), `rewind.js`, `control.js` (Fernsteuerung).
- **Modell ohne DOM** `game/campbuilder/model.js`: ein Diorama als JSON (Samen, Boden-Raster je Kachel-Set, Stückliste mit Ort, Variante, Größe, Farbe), dazu die Schritt-Liste fürs Zurückspulen. Node-Tests wie bei `decor.js`.
- **Werkstatt-Bereich** `campbuilder` (einzeln, `data/campbuilder.json`, Gruppe Welt): Bühnenbreite, Magnet-Radius, Easing, Tonleiter und Grundton, Klang je Material, HUD-Ausblenden nach, Haptik-Stärke, Farbleiste, Kategorien. Je Deko-Stück optional **Material** (für den Klang).
- **Wiederverwenden:** Zeichnen aus `camp_decor.js`, Logik aus `decor.js` (Tragflächen, Stapel, Nachbarn, Ensembles) ohne Preise, `autotile.js`, `dressing.js`, `paintPixels`, `pad.js`, `sfx.js`, `weather.js`, `string_lights.js`.
- **Größtes Risiko:** `camp_decor.js` (84 KB) ist ein Mixin der Camp-Szene und liest `save.rig`. Stufe 0 klärt, ob ein schlanker Adapter reicht (das Diorama spielt einen Spielstand vor) oder ob das Zeichnen in ein eigenes Modul wandern muss, das Camp und CampBuilder teilen. ⚠️ vorläufig: erst Adapter, umbauen nur, wenn es klemmt.
- **Speichern:** lokal (localStorage `nomadgirl-diorama:`), dazu Export/Import als JSON-Datei. Online später.

## Ausbaustufen

0. **Gefühlstest** (eine Sitzung): leere Bühne mit Himmel und Abendlicht, Wüsten-Boden mit dem Controller malen (duales Raster), AvA als Zeiger mit Magnet, Plopp-Ton in der Pentatonik, Vibration. Daniel testet nur das Gefühl.
1. **Deko frei:** Bau-Rad, alle Deko-Stücke, Ziehen zum Wachsen, Varianten, Stapeln, „nie Nein“.
2. **Tileset-Fundus:** Clutter, Props und Decals als Stücke, alle Kachel-Sets als Pinsel, Farbrad für alles.
3. **Zen-Schicht:** Material-Klänge, Akkorde bei Ensembles, HUD blendet aus, Zurückspulen, die Welt antwortet (Krähen, Katze, Moos, Wind), lebendige Details.
4. **Rig und Leute:** Container und Werkstatt-Bilder, Leyla als Probe-Bewohnerin, Fotomodus, Touch voll.
5. **Rückweg ins Spiel:** was sich bewährt, wandert in den Bau-Modus im CampMode (mit Grenzen).

## Entscheidungen (Daniel, 28.11.2026)

1. **Bühne:** wachsende Parzelle. In v3 kann sie sich vielleicht durch Gameplay erweitern.
2. **Zeiger:** freier Flug für v2, aber **Leyla mitdenken** (Kanten zum Klettern usw., siehe unten).
3. **Klang:** gemischt, musikalische Töne + Material-Geräusch.
4. **Speichern:** **online**, angelehnt an das bestehende Speichersystem (siehe unten).
5. **Gemütlichkeit:** zunächst unsichtbar, aber eine **Metrik** wird mitgebaut, für v3.

## Leyla mitdenken

Jedes Diorama soll von Anfang an begehbar sein, auch wenn Leyla erst in Stufe 4 hineinkommt:

- Das Modell hält zu jedem Stück seine **Lauf-Daten**: Tragflächen als Einweg-Plattformen, feste Körper, **Kanten** zum Hochziehen (wie `scene.ledgeAt`), Leitern und Treppen (`ladders`), Balkone und Stege. Das Meiste gibt es schon an den Deko-Stücken (Tragfläche, Haken, Begehbar, Klettern).
- Boden aus dem dualen Raster ergibt dieselben festen Rechtecke wie ein Raum (`solidRects`), Kanten entstehen an jeder Oberkante mit Luft darüber.
- Im Bau zeigt ein Schalter „Wege“ dezent, wo Leyla stehen, klettern und springen kann (Reichweiten aus `leyla.json`: Sprunghöhe, Kante greifen). Unerreichbare Flächen bleiben erlaubt (nie Nein), nur ohne Markierung.
- Die Probe-Bewohnerin in Stufe 4 nutzt die echte Leyla aus dem Spiel (`leyla.js`), keine Nachbildung.

## Online speichern

Angelehnt an Spielstand online (`docs/features/online.md`): KV `nomadgirl-saves`, Schlüssel aus dem Login.

- Neu im Worker: `GET/PUT/DELETE /api/diorama?slot=1..N` (Schlüssel `diorama:<hash>:<n>`, Kurzinfo als KV-Metadaten: Name, Stückzahl, Datum), `GET /api/dioramas` (alle Kurzinfos), Vorschaubild über `/api/blob?name=dshot<n>`. ⚠️ vorläufig 6 Plätze, 256 KB je Diorama.
- Ohne Worker (lokal, Tests) localStorage `nomadgirl-diorama:<n>` wie `game/slots.js`.
- Gespeichert wird von selbst (ein paar Sekunden nach dem letzten Schritt, leise), kein Speichern-Knopf nötig. Dazu Export/Import als Datei.

## Metrik für v3

Unsichtbar mitgerechnet und im Diorama gespeichert (`metrics`), lesbar über die Fernsteuerung: Gemütlichkeit wie im Camp (`cozyParts`: Stücke, Nachbarn, Ensembles, Wohnzellen), dazu Vielfalt (Arten, Farben), Dichte je Kachel, Licht bei Nacht, begehbare Fläche, Bauzeit und Schritte. Daraus kann v3 Ziele, Erweiterungen der Parzelle oder einen Rückweg ins Spiel ableiten.

## Quellen

- Townscaper-Technik: [Game Developer: How Townscaper works](https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making), [Boris the Brave: How does Planet work](https://boristhebrave.com/2022/12/18/how-does-planet-work), [Boris the Brave: Editable WFC](https://www.boristhebrave.com/2022/04/25/editable-wfc/), [80.lv: WFC für Dioramen](https://80.lv/articles/using-wave-function-collapse-algorithm-for-dioramas/?amp=1)
- Duales Raster: [Red Blob Games: Autotile](https://www.redblobgames.com/articles/autotile/claude/), [Boris the Brave: Quarter-Tile Autotiling](https://www.boristhebrave.com/2023/05/31/quarter-tile-autotiling/), [Excalibur: Dual Tilemap](https://excaliburjs.com/blog/Dual%20Tilemap%20Autotiling%20Technique)
- Tiny Glade: [80.lv: Interview Pounce Light](https://80.lv/articles/exclusive-tiny-glade-developers-discuss-bevy-proceduralism-publishers-cozy-games), [80.lv: Mauer-Generator](https://80.lv/articles/a-procedural-wall-generator-made-with-bevy-engine), [PC Gamer](https://pcgamer.com/games/city-builder/tiny-glade-wont-stop-delighting-me-with-new-discoveries)
- Cloud Gardens: [Destructoid](https://www.destructoid.com/cloud-gardens-is-a-chill-game-about-creating-overgrown-dioramas/), [Wikipedia](https://en.wikipedia.org/wiki/Cloud_Gardens_(video_game))
- Summerhouse: [GameStar](https://www.gamestar.de/artikel/summerhouse-100000-mal-auf-steam-verkauft,3411194.html), [Wikipedia](https://en.wikipedia.org/wiki/Summerhouse_(video_game))
- Unpacking: [Game Developer: Design-Säulen](https://www.gamedeveloper.com/design/unpacking-the-design-pillars-of-a-chill-puzzle-game), [Audiokinetic: Foley](https://www.audiokinetic.com/en/blog/unpacking-the-fun-behind-the-foley), [GDC Vault](https://gdcvault.com/play/1027728/-Unpacking-The-Fun-Behind)
- Zen und Flow: [MIT Press Reader: Reflective Games](https://thereader.mitpress.mit.edu/the-quiet-power-of-reflective-games/), [Game Developer: Flow](https://gamedeveloper.com/design/designing-games-with-flow-in-mind)
