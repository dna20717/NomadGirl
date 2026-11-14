# Mega-Rigs: LKW, Crawler, Fatbird (#022)

Prototyp zum Begehen unter **/megarig** (`megarig.html?id=lkw|crawler|fatbird&stage=0..2`), absichtlich nicht im Menü und nicht im Spiel (Daniel, 14.11.2026: „brauchen wir weder im Menü noch im Spiel, sondern als Link“). Design: `docs/design.md` › Endgame-Zugmaschinen, Mega-Rigs aus Kachel-Sets.

## Entscheidungen (Daniel, 14.11.2026, Multiple Choice)

- **Platz-Raster** wie die Container: Module sind 1, 2 oder 3 Plätze breit und stehen in Stockwerken; Deko dockt an Anschlusspunkte (Dach, Wand).
- **LKW: Teile andocken.** Die Zugmaschine ist ein Bild (PixelLab, vorhandenes Objekt, nur auf strenge Seitenansicht gerückt: Daniel „der LKW ist nicht orthogonal“), die Teile aus seinem Blatt (Kisten, Räder, Schüssel, Antennen, Auspuffe, Generator, Leiter, Bleche, Warnschild) sind Anbauteile für alle Fahrzeuge.
- **Daten im Werkstatt-Bereich:** RIG › **Mega-Rigs** (`data/megarigs.json`) und RIG › **Anbauteile** (`data/rig_addons.json`).
- **Begehbar mit Leyla:** echte Steuerung und Physik.
- **Perspektive und Palette:** alles streng von der Seite, Code-Grafik auf einem 4-px-Raster mit AAP-64-Farben (Daniel: „achte bei den Mega-Rigs auf die Perspektive und die richtige Palette“).

## Raster

- **Platz** = `grid.place` Kacheln breit (7), **Stockwerk** = `grid.story` Kacheln hoch (6, Innenraum 5 Kacheln). 7 × 6 passt zu den Container-Bildern in echtem Seitenverhältnis (Bild-Dach y 83 bis Unterkante y 187 = ein Stockwerk plus Bodenplatte, Maßstab ≈ 4,3).
- Stockwerke zählen ab dem Rumpfboden: Stockwerk 0 steht `hull.under` Kacheln über dem Boden (LKW: Ladefläche, Crawler: Ketten, Fatbird: Schwebehöhe). Die ersten `hull.inside` Stockwerke liegen **im Rumpf**, alles darüber wird **obendrauf** gebaut.
- **Räume = Container ohne Außenhaut** (Daniel: „genau so“): Modul im Rumpf mit Außenhaut aus. Der Rumpf ist sonst Panzerung (fest), ein Raum wird herausgeschnitten und bekommt eine Luke (Leiter vom Deck darüber).
- **Länge wächst mit Mittelstücken:** Bug (`hull.front`) + Mittelstücke × `hull.segPlaces` Plätze + Heck (`hull.back`). Ausbaustufen (`stages`) legen Mittelstücke und Stockwerke obendrauf fest; Module und Anbauteile haben „Ab Stufe“.
- **Fatbird:** `hull.frame` = die unteren Stockwerke im Rumpf sind ein offener Lastrahmen (Container hängen darin), darüber die geschlossenen Decks, oben die Gashülle (`hull.envelope`) mit Laufsteg; Länge bleibt gleich (voll ist voll), die Stufen füllen nur.

## Wege und Erreichbarkeit

- `engine/megarig.js` › `buildMegarig(data, id, stage)` baut ein Raum-Layout (Legende aus `engine/room.js`): Böden der Module sind Plattformen, Decks fest, Leitern automatisch (Stapel: an einem Ende abwechselnd links/rechts, nur wenn darunter etwas steht; Räume: Luke; vom Boden: Bug und Heck, Fatbird: Seilwinde in der Mitte).
- **Kletterbare Anbauteile** (Kran, Antennenmast, Bohrturm, Leiter) bekommen oben eine kleine Plattform: Aussichtspunkte. Sonnensegel und Balkone sind begehbar.
- **Wege am rohen Fahrzeug** für Bild-Fahrzeuge (LKW): Tabelle `walk` (Kabinendach, Leiter an der Kabine).
- **Erreichbarkeit** (design.md: „Der Bau-Modus prüft die Erreichbarkeit“): `reach()` läuft grob Leylas Bewegungen ab (gehen, fallen, Sprung 2 Kacheln hoch und 3 weit, Leitern, durch Plattformen fallen). Unerreichbare Module, Anbauteile auf Luft und Überlappungen meldet `ng check` als Warnung.

## Zeichnen

`game/play/megarig_view.js`: LKW = Bild + Auflieger aus Code mit Rädern aus dem Teileblatt; Crawler = zwei Kettenfahrwerke, Rumpf mit Platten, Rost, Warnstreifen, Kabine mit schräger Nase, Brückenfenster, Dreiecks-Logo; Fatbird = silberne Gashülle mit Neon-Band, Rumpf, Cockpit, offener Lastrahmen, vier Mantelrotoren an Auslegern, blaue Schwebe-Düsen, Seilwinde als Strickleiter. Container nutzen die Camp-Bilder (offen, zu bei Abstand, Farbton je Modul), Räume aus Code (Rückwand, Rippen, Lampen, Name). Anbauteile: Bild-Ausschnitt (`crop`) oder Code (`code`).

## Prüfen

- `node --test test/megarig.test.js`: alle Stufen ohne Probleme und erreichbar, Wachstum, Raster, Räume im Rumpf, Warnung bei fehlendem Unterbau, `reach()`, Anbauteile.
- `node tools/megarig_test.mjs [--shots]`: jede Stufe lädt, Leyla klettert jede Leiter bis oben (27 Leitern), Container öffnen sich, Übersicht zoomt.

## Offen

- ⚠️ Crawler/Fatbird aus Code, bis die Kachel-Sets kommen (frühestens nach dem PixelLab-Reset am 07.12., nur mit Daniels Freigabe).
- Bau-Modus für Mega-Rigs, Budgets, Crew, Bergungs-Zustände je Segment: noch nicht.
