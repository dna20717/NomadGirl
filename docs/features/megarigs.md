# Mega-Rigs und Bergung: LKW, Crawler, Fatbird (#022, #023)

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

## Größen (#024, Daniel 15.11.2026)

Daniel: „Eine Kette sollte deutlich höher sein als Leyla. Füge beiden eine Etage hinzu. Crawler-Fahrerkabine alleine sollte Platz für mindestens einen großen Container haben. Damit die Rigs nicht zu hoch werden, gerne länger machen.“ Der Truck passt.

- **Crawler:** Ketten 6 Kacheln hoch (doppelt so hoch wie Leyla) mit großen Laufrollen und Stützrollen; **2 Etagen im Rumpf** (Räume mit Luken-Schacht bis zum Deck); Bug 24 Kacheln mit der **Kommandobrücke** (Raum so breit wie ein 40-Fuß-Container: Konsolen, Kapitänsstuhl, Frontscheibe); 3/4/5 Mittelstücke (6/8/10 Plätze), 1/2/3 Stockwerke obendrauf.
- **Fatbird:** Schwebehöhe 6, Lastrahmen + **2 Decks**, Gashülle 13 Kacheln, Rotoren 11 Kacheln breit, größeres Cockpit, 8 Plätze.

## Hersteller (#025, Daniel 15.11.2026)

- Feld **Hersteller** (`brand`) an jedem Mega-Rig: Marke der Spielwelt als Schablonen-Schriftzug am Rumpf (`MegarigView.stencil`, zweizeilig ab drei Wörtern, Farbe „Dunkel“ des Lacks). Der Crawler stammt von **Armadillo Heavy Industries** (Daniel auf „armadillo?!“: Marke der Spielwelt, der Typ heißt weiter Crawler); der Schriftzug sitzt unter dem Dreieck-Logo am Maschinenblock. Auch in der Beschreibung und im Text des Bergungsprojekts.

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

## Bergungsprojekte (#023)

Daniel, 15.11.2026 (AFK): „Bau bitte den gesamten Themenbereich inklusive Quests und POI und Felgen mit ein“. Design: `docs/design.md` › Bergungsprojekt: der LKW, Endgame-Zugmaschinen.

- **Daten:** RIG › **Bergungsprojekte** (`data/salvage.json`): LKW (ab Spielstart), Crawler und Fatbird (nach dem LKW). Abschnitte als Tabelle (Abschnitt, Teil, Anzahl, Fundorte = POIs, Einbau-Stunden), Fundort-Abstand vom Start (`hops`), Belohnung Zugmaschine oder Mega-Rig, Kisten-Chance, Wrack-Aussehen.
- **Teile** (⚠️ „Felgen“ als Bergungsteile gelesen): 14 neue Gegenstände (Felge, Reifen, Achse, Motorblock, Dieselkanister, Auspuff, Kettenglied, Laufrolle, Hydraulikzylinder, Rotorblatt, Ballonstoff, Gasventil, Bordrechner, Bordwerkzeug), Symbole `icons_salvage` aus `tools/salvage_icons.py` (Ausschnitte aus dem LKW-Teileblatt + Code, AAP-64). Dazu vorhandene Teile (Schrauben, Kabelbaum, Autobatterie, Schrottplatte, Rohrbogen, Chip, Turbinenmodul).
- **Fundort je Durchgang** (`game/salvage.js` › `ensureSites`): aus dem Seed der Karte gewürfelt, so viele Straßen vom Start wie eingestellt, auf der Reisekarte als **WRACK**-Marke (fertig: **BASIS**), auch an noch unbekannten Orten.
- **POIs:** Fehlt ein Teil, liegt es mit `chestChance` % in einer Kiste seiner Fundort-POIs, im **Tresor** des Fundorts sicher (`chestPart`, `poi_level.js` › `salvagePart`, Meldung „Bergungsteil“).
- **Camp:** Am Fundort steht das Wrack **am Ende des Camps** (Camp wird breiter). LKW = das PixelLab-Bild verrostet und schräg, Crawler/Fatbird = ihre echte Mega-Rig-Zeichnung verkleinert, eingesunken, rostig. Schild mit Prozent. **E:** Bergungsliste des Abschnitts (Teile, Vorrat, Fundorte), **Einbauen** nimmt alles Passende aus Lager, Kiste und Rucksack und kostet Zeit; Abschnitte nacheinander. Am Ende **Probestart**.
- **Belohnung:** LKW wird Zugmaschine (`swapTractor`, Werkstätten aus dem Van ziehen ins Rig oder auf den Schrottplatz), der Van bleibt als Basis (`save.base`), im Camp steht vorne der LKW (Bild der Zugmaschine, der Lagerplatz rückt nach rechts). Crawler/Fatbird: `save.megarigs`.
- **Questlog:** jede offene Bergung als Zeile mit Abschnitten, Fortschritt, Fundorten; „Verfolgen“ macht die Zielzeile zum nächsten Teil („LKW: Fahrwerk · Felge 0/2 · Mile 7 Gas & Go“).
- **Neuer Durchgang:** Eingebautes und fertige Bergungen bleiben, der LKW zieht weiter, Fundorte werden neu gewürfelt.
- **Achievements:** „Wieder auf der Straße“ (LKW, Trophäe Chromfelge, +10 Leben) und versteckt „Für die 1 %“ (Crawler und Fatbird, Trophäe Logbuch der Giganten, +10 % Schaden, +5 % Krit). Zähler `salvage` (Filter Projekt, `tractor`, `megarig`).
- **Prüfen:** `node --test test/salvage.test.js` (7), `node tools/salvage_test.mjs [--shots]` (7, Bilder `output/salvage_*.png`).

## Offen

- ⚠️ Crawler/Fatbird aus Code, bis die Kachel-Sets kommen (frühestens nach dem PixelLab-Reset am 07.12., nur mit Daniels Freigabe).
- Mega-Rigs im Spiel fahren (Bau-Modus, Budgets, Crew, Ladebucht), Fahrzeug-Skilltrees und Heavy-Duty-Werkbank: noch nicht. Freigeschaltete Mega-Rigs stehen nur in `save.megarigs`.
- ⚠️ Der Van als Basis ist nur vermerkt (Karte „BASIS“), am Fundort steht er noch nicht sichtbar.
