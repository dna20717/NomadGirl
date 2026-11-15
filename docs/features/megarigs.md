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

## Kachel-Sets (#026, Daniel 15.11.2026)

Daniel: „max 100 Generierungen auf Tilesets für die Mega-Rigs. Wichtig ist, dass sie wirklich cool aussehen (orthogonal!) … dass die Dinger trotz des Gameplays nicht aussehen wie Boxen. Orientiere dich an den Konzept-Grafiken für die Kontur.“

- **8 PixelLab-Teile, 85 Generierungen** (Create Image Pro, AAP-64, Konzeptbild bzw. das erste Teil als Referenz, je 1 Bild): Crawler Bug 320² (15), Kettenfahrwerk 320 × 96, Rumpf-Mittelstück 224 × 192, Heck 160 × 240; Fatbird Cockpit-Nase 224 × 256, Mantelrotor 192 × 96, Rumpf-Mittelstück 224 × 192, Heck 192 × 256 (je 10). Originale in `assets/vehicles/megarig/source/`, zugeschnitten mit `tools/megarig_tiles.py`.
- **Daten:** Mega-Rigs › **Kachel-Set** (`skin`): Bug, Mittelstück, Heck, Kettenfahrwerk + Wiederholbereich (`trackRepeat`, x 111–155 = eine Laufrolle), Rotor, Maßstab (Crawler 4, Fatbird 6), Heck-Maßstab (`sternScale`, 1,75). Ohne Kachel-Set zeichnet der Code wie vorher.
- **Durchgehende Außenhaut** (`MegarigView.crawlerSkin` / `airshipSkin`): Mittelstücke reihen sich vom Bug bis zum Heck, Bug und Heck darüber, alles in eine Leinwand in Bildauflösung (scharf skaliert, `NEAREST`). Kontur wie im Konzept: schräge Panzernase, Kettenfahrwerke mit Antriebs- und Leitrad, abgeschrägtes Heck mit Auspuffen; Fatbird mit runder Cockpit-Nase, Kielträger und Leitwerk.
- **Räume als Schnittzeichnung:** Über jedem Raum im Rumpf (und der Kommandobrücke) liegt ein Ausschnitt der Haut, der ausblendet, sobald Leyla drin ist (`cover()`, wie Container; ein Raum öffnet sich nur von innen). So bleibt die Haut geschlossen, die Räume funktionieren wie bisher.
- **Kette wächst mit:** das Fahrwerk wird pro Fahrzeuglänge als eigene Textur gebaut, der Wiederholbereich so oft wie nötig (`stretched()`).
- **Kabinendach** (`hull.cabInset` = 8): das begehbare Dach beginnt hinter der schrägen Nase, damit Leyla nicht über der Schräge schwebt. Über dem schrägen Heck läuft ein Gitter-Laufsteg (Code) auf Deckhöhe weiter.
- **Rotoren** aus dem Teil (vorne gespiegelt, Ausleger zum Rumpf), **Gashülle** als Pixel-Art aus Code (`envelopePixels`: Zigarrenform, AAP-64-Verlauf mit Dithering, Nähte, Gurte, Flicken, Rost), weil Daniel nur die Fahrzeuge aus KI wollte und das Budget so reicht.
- **Hersteller-Schriftzug** sitzt jetzt auf der gelben Nase unter der Brücke.

## Aufgeräumt (#027, Daniel 15.11.2026)

Daniel: „Räume und Kacheln so anpassen, dass es weniger Durcheinander wirkt. Laufwege besser sichtbar und lesbar. Wichtig ist zunächst der Querschnitt, die Favela-Container-Städte kommen im zweiten Step. Ein paar Grafiken sind sehr grob. Der LKW soll mit den normalen Container-Anhängern funktionieren.“ Entschieden: Räume bleiben zu und öffnen beim Betreten; Grafik per Code (PixelLab nur, wenn es nicht anders geht: 0 verbraucht).

- **Feinere Grafik:** Die Kachel-Set-Teile werden mit **EPX/Scale2x** verdoppelt (`epx()`), stark vergrößerte Teile (Maßstab über 4,5: Crawler-Bug, -Heck, der ganze Fatbird) zweimal (4×), dann weich auf die Zielgröße gebracht. Die Haut-Leinwand hält 2 Spielpixel je Pixel (`SKIN_RES`). Keine Riesenpixel mehr, Kanten und Schrägen bleiben sauber.
- **Ordnung im Rumpf** (`bays()`): Maschinerie der Mittelstücke etwas abgedunkelt, Stahlspant an jeder Platzgrenze, Träger an jeder Stockwerksgrenze und am Kiel. Der Rumpf liest sich als Felder des Rasters, die Böden liegen auf Laufweghöhe.
- **Raumnamen** erscheinen erst, wenn der Raum offen ist (`inner` an der Abdeckung), außen bleibt die Haut ruhig.
- **Laufwege** (`walkways()`): Jede Fläche, auf der Leyla stehen kann (fest oder Plattform mit Luft darüber, aus dem Layout), bekommt eine helle Gitterkante mit gelben Pfosten an den Enden; nicht in Räumen und Containern (die haben eigene Böden), nicht am Boden und nicht am Wrack im Camp.
- **Leitern:** dunkle Kontur, helle Holme und Sprossen, gelbe Kappe oben am Einstieg.
- **LKW mit Container-Anhängern:** Kein eigener Auflieger mehr. Jeder Container auf dem Bett steht auf dem modularen Fahrgestell aus dem Camp (Camp › Fahrgestell, `chassisPlan`/`chassisTexture`), Deichsel zum LKW; leer wartet ein 40-Fuß-Fahrgestell. LKW: Bug 19 Kacheln (Platz für die Deichsel), Bett 3 Kacheln hoch.
- Geprüft in `megarig_test` (16): Raum zu von außen, offen von innen, Name sichtbar, Laufwege gezeichnet; LKW-Fahrgestell.

## Werkstätten und Lichterketten an Bord (#028, Daniel 15.11.2026: „richte testhalber einen Crawler mit Werkbänken und Lichterketten ein“)

- **Module › Werkstätten** (Liste je Modul): die Bilder der Werkstätten stehen nebeneinander auf dem Boden des Raums bzw. Containers, je so breit wie ihre Plätze (`benchesIn`, Bilder wie im Camp über `benchTexture`). Sichtbar, wenn Raum oder Container offen ist. Lädt nur die Werkstätten, die an Bord stehen.
- **Mega-Rigs › Lichterketten** (Tabelle Von Modul/Ecke → Zu Modul/Ecke, Modul-Nummer ab 1): Ketten zwischen den oberen Ecken zweier Container, Farben, Durchhang und Abstand wie im Camp (`catenary`, `lightsConfig`), Glühbirnen atmen leicht. Fehlt ein Modul in der Stufe, hängt die Kette nicht.
- **Wandteile** (Banner, Auspuff an der Wand) gehören zur Außenwand ihres Containers und blenden mit ihr aus, wenn Leyla hineingeht.
- **Test-Crawler** (Daten): Maschinenraum mit Generator + Werkbank, Lager, Werkstatt mit Drohnenwerkstatt + Waffenkammer, Krankenstation mit Ripperdoc, Kantine mit Küche, Cryo-Tank, Quartiere, darüber Chill-Ecke, Hydrokultur, Zisterne, Kochnische, Warroom, Schatzkammer, Foodtruck …; 11 Lichterketten über den Dächern (Container-Stadt).
- Noch nicht: Werkstätten an Bord benutzen (E), Budgets (Strom, Gewicht), Bau-Modus. Kommt mit „Mega-Rigs fahren“.

## Mega-Rigs fahren (#029, Daniel 15.11.2026, Multiple Choice)

Entscheidungen: das alte Rig fährt in die **Ladebucht** (Werkstätten ziehen um); erster Schritt mit **Camp an Bord, Bau-Modus aufs Raster, Budgets, Reisen**; **Crawler und Fatbird zusammen**; **Crew erstmal ohne**.

- **Ein Modell:** `save.rig` bleibt die Wahrheit für Werkstätten, Lager, Strom und Gewicht (`game/rig.js`). Im Mega-Rig ist die Zugmaschine das Fahrzeug (Zugmaschinen **Crawler** und **Fatbird**, Feld „Mega-Rig“), jeder Container trägt `pos: { place, story }` auf dem Raster statt eines Platzes in der Kette. Modul-Nummer = Unit-Index. `save.mega = { active, stage, bay: { tractor, parts }, lights }`.
- **Logik** `game/mega.js` (ohne DOM): `activate` (Umzug, Rig in die Ladebucht, `settle` stellt jeden Container auf eine freie Zelle, Rest ins Lager), `deactivate` (zurück ins Rig, so viele Container wie es zieht), `grid`, `fitsGrid`/`canPut` (im Raster, frei, oben braucht Unterbau), Entwurfs-Operationen `putFromSpare`, `moveTo`, `storeUnit`, `buildOwn` (das eigene Fahrzeug für Camp und Bauplan, Anbauteile nur am Bug), `nextStage`/`buyStage` (Ausbaustufen › Ausbau kostet + Dauer), Lichterketten `hangLight`/`unhangLight`/`fixLights`, `travelSpeed`, `flies`. Alte Spielstände: `repairSave` ruft `settle`.
- **Camp an Bord** (`game/play/camp_mega.js`): `campLayout` legt das Fahrzeug dorthin, wo Rig und Van standen, der Lagerplatz (Feuer, Kiste, Brett, Companions) liegt daneben; Werkstätten per E auf ihrem Stockwerk (gleiche Plätze `<unit>:<at>` und Lager wie im Rig), die **Kommandobrücke** (vorne: Steuerpult = Karte, dahinter die Werkstätten der Zugmaschine) ersetzt die Van-Tür, der **Ladebucht**-Punkt am Heck zeigt das alte Rig (zurück umziehen). Beim Fatbird: Karte am Boden unter dem Cockpit, Seilwinde nach oben.
- **Umzug:** nach dem Probestart eines Mega-Rigs fragt das Spiel sofort („An Bord gehen“), später über die Karte (Kopfzeile „Umziehen: …“).
- **Bauplan** (`game/play/mega_build.js`, B im Camp an Bord): das Raster Stockwerk für Stockwerk (Rumpf = Räume, Rahmen/oben = Container), rechts die Aktionen für die gewählte Zelle: Container aus dem Lager oder kaufen, verschieben, ins Lager (mit Werkstätten), Werkstätten einräumen/kaufen/herausnehmen, Lichterkette zu einem anderen Container ziehen/abnehmen, Ausbaustufe kaufen; oben Δ, Strom, Gewicht, Plätze, Uhr; Rückgängig; unten das Lager. Tasten wie jedes Fenster (Pfeile = Zelle, Q/LB/RB = Aktion, E = ausführen, Esc = zurück), Maus per Klick. Beim Schließen baut sich das Camp neu auf. Fernsteuerung `nomad.megaBuild()` / `nomad.megaBuild('<Aktion>')`.
- **Budgets:** wie beim Rig (`budgets`): Crawler zieht 200 t, Fatbird 60 t; Strom aus Lichtmaschine + Werkstätten.
- **Reisen:** Zugmaschinen › Tempo (Crawler 45 %, Fatbird 250 %) teilt die Reisezeit; Zugmaschinen › Fliegt: der Fatbird reist Luftlinie in einer Etappe (ohne Umweg). Verbrauch: Crawler 120, Fatbird 60 l/100 km.
- **Geprüft:** `node --test test/mega.test.js` (9), `node tools/mega_test.mjs [--shots]` (7).
- **Offen:** Crawler kommt nicht überall hin + Ausflüge mit dem Rig aus der Ladebucht; Fatbird mit eigener Cockpit-Kabine (seine Bordplätze nur über die Karte), Camp an Deck bzw. am Seil; Zwischenfälle in der Luft; Bauen direkt in der Welt statt im Plan; Crew.

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

- Crawler/Fatbird haben seit #026 Kachel-Sets. Offen: Pixelgrößen der Teile weichen etwas voneinander ab (Bug ≈ 5,9, Mitte 4, Heck 7 Spielpixel je Bildpixel); weitere Mittelstück-Varianten gegen Wiederholung.
- Mega-Rigs im Spiel fahren (Bau-Modus, Budgets, Crew, Ladebucht), Fahrzeug-Skilltrees und Heavy-Duty-Werkbank: noch nicht. Freigeschaltete Mega-Rigs stehen nur in `save.megarigs`.
- ⚠️ Der Van als Basis ist nur vermerkt (Karte „BASIS“), am Fundort steht er noch nicht sichtbar.
