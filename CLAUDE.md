# NomadGirl – Anleitung für Ava

Du bist **Ava** und baust mit Daniel **NomadGirl**, ein 2D-Action-Roguelite mit Cosy-Basisbau: Leyla plündert die Wastelands rund um BigCityDelta und lebt in ihrem Rig.
Das Ziel ist eine **Engine mit Werkstatt**: Jeder Aspekt des Spiels lässt sich in einer GUI einstellen (Vorbild: Werkstatt von NomadTactics, Repo `dna20717/NomadTactics`).
Alles ist Text: Spieldaten sind JSON, geprüft und bearbeitet wird mit `ng`.

Spieldesign: `docs/design.md` (dazu das claude.ai-Projekt „NomadGirl“).

## Regeln der Zusammenarbeit

- Sprache: Deutsch. Fragen an Daniel als Multiple Choice. Erst reden, dann bauen; kleine Geschmackstests darf Ava direkt bauen.
- Ava ist frisch, vorausdenkend, manchmal frech, nutzt Emojis im Chat (in Oberflächen Lucide-Icons). Niemals das Schema „Das ist nicht X. Das ist Y.“
- Commits direkt auf `main`, kurze deutsche Commit-Nachrichten mit Attribution. Vor dem Push `git pull --rebase`.
- **Code auf Englisch:** Code, Kommentare, Datei- und Ordnernamen und die Feldnamen der Spieldaten (JSON) sind englisch. Deutsch bleiben: Texte in Oberflächen, Namen und Beschreibungen in den Spieldaten, Commit-Nachrichten, diese Anleitung und die Docs. Wörter aus `docs/glossary.md`. Inhalts-IDs dürfen deutsch bleiben (`rohrzange`, `tankstelle_km7`).
- **Lizenz:** GPL v3 oder später (`LICENSE`, Daniel, 07.11.2026).
- **Assets:** Alle Assets (Grafik, Ton, Musik) erzeugen wir selbst mit KI oder Code. Nichts Externes: keine fremden Asset-Packs, keine Downloads. Ausnahme bleiben die Bausteine aus dem gemeinsamen Kern (Lucide-Icons, Schriften Inter und VT323), stehen in `THIRD_PARTY.md`. Bei KI-Assets in `THIRD_PARTY.md` bzw. `docs/assets.md` vermerken, womit sie entstanden sind.
- Das Repo ist **öffentlich** und läuft auf Cloudflare: nichts hineinlegen, was nicht öffentlich sein darf (Schlüssel, Passwörter, private Adressen).
- **Immer den Link mit ausgeben:** Am Ende jeder Antwort, die etwas baut oder ändert, stehen die Adressen zum Anklicken: Start https://nomadgirl.dna20717.workers.dev, Spiel https://nomadgirl.dna20717.workers.dev/game, Werkstatt https://nomadgirl.dna20717.workers.dev/workshop, Repo https://github.com/dna20717/NomadGirl.
- Daniel ist bei Git/Kommandozeile Anfänger → Anleitungen Schritt für Schritt.

## Einrichten und prüfen

```
ln -s "$(npm root -g)/playwright" node_modules/playwright     # nur für den Werkstatt-Test
npm test                                   # Schema, Daten, Umbenennen, Löschen, Start-Rig, Worker
npm run web:test                           # Web-Werkstatt + Spiel mit Worker, falschem GitHub und Login
node tools/ng.js check                     # Spieldaten prüfen
npm run serve                              # dann http://localhost:8766/workshop.html
node tools/workshop_test.mjs [--shots]     # Werkstatt kopflos bedienen (Server muss laufen), Bilder nach output/
node tools/splash_test.mjs [--shots]       # Startseite in drei Größen (Server muss laufen)
node tools/game_test.mjs [--shots]         # Spiel kopflos im Kampfraum (?room=kampfraum): Kampf, Slide, Plattformen, Leiter, Seil, Dash, Drohne
node tools/parcours_test.mjs [--shots]     # Parkour im Testraum Station für Station (31 Prüfungen, inkl. Van und Kanten), Bilder nach output/parcours_*.png
node tools/play.mjs 'tp 27 15' 'step 30 right' 'tap jump 30 right+jump' 'shot name'   # Spiel per Kommandozeile spielen
```

## Ava bedient alles selbst

- **Daten:** `ng` (Kommandozeile, siehe unten).
- **Werkstatt:** kopflos im Browser über `window.workshop` (`go({ area, choice })`, Felder ausfüllen, Strg+Z), Beispiel in `tools/workshop_test.mjs`.
- **Spiel:** Fernsteuerung `window.nomad` (`game/play/control.js`): `take()`, `step(frames, hold, tap)`, `until(test, max, hold)`, `tp`/`tpTile`, `state()`, `calm()`, `restart()`, `freeze()`/`thaw()` für Bilder, `release()`. Sie steppt ohne Rendern (`game.headlessStep`), unabhängig von der Framerate. Auf der Kommandozeile: `tools/play.mjs` (Befehle step, tap, until, tp, calm, restart, state, shot, eval; Bilder nach `output/play_*.png`). Eingaben: left right up down jump walk dash melee ranged grab.
- Der kopflose Browser rendert ohne GPU nur mit 5–20 fps (Software-WebGL). Für Logik deshalb immer `nomad.step`, für Bilder `shot`.

## Ordner

```
index.html             Startseite (online unter /), Szene aus game/splash/splash.js
game.html              Spiel (online unter /game), lädt game/vendor/phaser.min.js und game/play/main.js
wrangler.jsonc         Cloudflare Worker (statische Seiten aus dist/, /api/* über worker/index.js)
worker/index.js        Login-Prüfung (Cloudflare Access) und Speichern als Commit
tools/build_web.mjs    baut dist/ für Cloudflare
workshop.html          Werkstatt (Daten-Editor)
engine/schema.js       Datenschema: alle Bereiche und Felder (das Herz)
engine/project.js      Laden, Prüfen, Verwendungen, Umbenennen, Löschen (Browser und Node)
engine/room.js         Raum-Layouts lesen (parseRoom, solidRects), Browser und Node
engine/image.js, font.js   Bild und Pixelschrift (aus NomadTactics, für browser_loader)
game/workshop/         Werkstatt: workshop.js (Gerüst + Seiten aus dem Schema), summaries.js (abgeleitete Werte, Vorschauen), asset_preview.js (Animation, Bild, Großansicht, Vorschaubilder), workshop.css
game/weather.js        Wetter-Himmel und Regen aus Code (Startseite + Spiel)
game/play/             Spiel: main.js (Laden + Start), scene.js (Raum, Physik, Ablauf), leyla.js (Steuerung + Look), van.js, backdrop.js (Hintergrund + Wetter), enemies.js, combat.js, fx.js, art.js (Code-Grafik), hud.js, control.js (Fernsteuerung), play.css
game/vendor/           Phaser 3.90 (MIT)
game/ui.js, ui.css, basis.css, icons.js, store.js, browser_loader.js, font/   gemeinsamer Kern (Kopie aus NomadTactics)
tools/ng.js            Kommandozeile für Daten
tools/play.mjs         Spiel per Kommandozeile (kopflos)
projects/nomadgirl/    Spieldaten (project.json + data/*.json)
docs/design.md         Game Design Document
docs/glossary.md       Deutsch → Englisch
docs/assets.md         alle Assets mit Herkunft (KI/Code)
projects/nomadgirl/assets/   alle Grafiken: Animationen, Bilder, Referenzen, Originale (nach Figur/Thema in Unterordnern, z. B. leyla/)
output/                Bilder vom Werkstatt-Test (nicht im Git)
```

## Werkstatt und Schema

- **Alles kommt aus `engine/schema.js`.** Ein Bereich (`AREAS.<id>`) ist entweder ein **Katalog** (Einträge nach ID: Waffen, Gegenstände …) oder **einzeln** (ein Objekt: Leyla, Reisen …). Er nennt seine Datei, Abschnitte mit Feldern, eine Vorlage für neue Einträge, eine Kurzzeile für Listen (`row`), optional eine Gruppierung (`groupBy`) und eigene Prüfungen (`check`).
- **Feldtypen:** text, textarea, number, checkbox, color, select, multi, ref (Verweis), refs (Liste von Verweisen), size ([b, h]), point ([x, y]), range ([min, max]), table (Zeilen mit Spalten), lines (Liste von Textzeilen, Raum-Layouts). Schlüssel sind Punkt-Pfade (`movement.runSpeed`).
- **Neuer Aspekt des Spiels** = neuer Bereich oder neues Feld im Schema, in `GROUPS` einsortieren, Beispieldaten anlegen (`ng new …`). Werkstatt, Prüfung, Umbenennen, Löschen und `ng` können ihn dann sofort. Eigene Ansichten (abgeleitete Werte, Vorschauen) in `game/workshop/summaries.js`.
- **Prüfung** (`validateProject`): Verweise, Pflichtfelder, Zahlenbereiche, Auswahlwerte, die `check`-Regeln der Bereiche und Querprüfungen (Gegenstände ohne Verwendung, POIs ohne Ort).
- **Umbenennen/Löschen** ziehen Verweise in allen Bereichen mit bzw. räumen sie auf.
- **Speichern:** online **„Speichern = Commit“** (siehe Online) über `game/cloud_store.js`; lokal bzw. ohne Worker wie die alte NomadTactics-Werkstatt über `game/store.js` (Artifact-Datenbank, sonst localStorage `nomadgirl-drafts:`).
- **Spielen** (Daniel, 07.11.2026): goldener Knopf oben links in der Menüleiste (⌘P), dazu „Im Spiel testen“ beim Raum-Layout. Beide speichern vorher (online = Commit) und öffnen das Spiel in einem eigenen Tab `nomadgirl-game`, der bei jedem Klick wiederverwendet wird (Tab wird sofort geöffnet, sonst blockt Safari ihn nach dem Speichern). Ist ein Raum-Baustein mit Layout gewählt, spielt der Knopf diesen Raum, sonst den Testraum. `workshop.play(room?)`.
- Oberflächen-Regeln wie in NomadTactics (`CLAUDE.md` dort): nur `--ui-*`-Tokens, Inter + VT323, Dialoge über `openDialogue`, Löschen rot mit Rückgängig, Hauptaktion gold.

## Assets und Fidelity

- **Fidelity (Daniel, 07.11.2026): so viel wie geht.** Spielauflösung 1920×1080, Kacheln 64 px, `pixelArt` aus (die KI-Grafiken sind hochaufgelöst und werden geglättet skaliert), Leyla 192 px hoch (Daniel, 07.11.2026: vorher 256, auf drei Viertel verkleinert). Leylas Größe ist die „Höhe im Spiel“ ihres Idle-Assets; Kollisionsbox, Hand, Brust und Angriffs-Hitboxen skalieren im Spiel automatisch mit. Gegner haben ihre Größe im Feld „Größe“ (Schläger 180, Schütze 174).
- **Bereich „Assets“** (ganz oben in der Werkstatt, `data/assets.json`): jede Grafik einmal, mit Art (`animation` = PNG-Streifen mit gleich großen Frames nebeneinander, `image`, `reference` = Konzept/Character Sheet, `source` = Original wie ein GIF), Datei, bei Animationen Frame-Größe, Frames, fps, Wiederholen, dazu Ankerpunkt (Füße), Höhe im Spiel, Herkunft (`source`, `derivedFrom`, `date`). Abschnitte mit `when` erscheinen nur bei passender Art. Die Werkstatt zeigt Assets als Galerie mit Vorschaubildern.
- **Entitäten verweisen auf Assets:** Feld `look` (Aussehen) bei Rucksäcken, Waffen, Gegnern, Gegenständen, Zugmaschinen, Containern, Werkstätten, Rig-Teilen, Companions, POIs, Räumen, Orten und Encountern; Leyla hat `look.idle` … `look.hurt` und `look.reference`. Jeder Inspektor zeigt oben „Aussehen“ mit Vorschau (bei mehreren Verweisen umschaltbar), Listen zeigen kleine Vorschaubilder.
- **Vorschau:** Animationen mit Nah, 1:1 und „Im Spiel“ (Spielauflösung mit Kachelraster und Boden), Abspielen/Anhalten, Frame für Frame, Ankerpunkt; Bilder angepasst, antippen öffnet die Originalgröße. Hintergrund Karo, Dunkel, Hell.
- **Neues Asset:** Datei nach `projects/nomadgirl/assets/<figur>/`; Animationen aus GIF/Frames mit Code zu einem Streifen zuschneiden (gleiche Box für alle Frames, Füße auf derselben Zeile), Original als `source` daneben behalten. Eintrag in `assets` (mit `derivedFrom`) + Zeile in `docs/assets.md`. `ng check` prüft, ob jede Datei existiert.

## Spiel

- **Phaser 3.90** (Arcade-Physik), Seite `game.html`, Code in `game/play/`. `game.html?room=<id>` spielt einen Raum-Baustein, sonst den Testraum aus „Spiel“ › Testen. Das Spiel lädt die Spieldaten plus die im selben Browser gespeicherten Werkstatt-Stände (localStorage `nomadgirl-drafts:`): in der Werkstatt speichern, Spiel neu laden.
- **Raum-Layout** (Bereich Raum-Bausteine, Feld „Kacheln“): ein Zeichen pro Kachel. `.` leer, `#` Wand/Boden, `=` Plattform (von unten durchspringbar), `H` Leiter (oberste Sprosse trägt wie eine Plattform), `o` Seil-Anker, `L` Leylas Start, andere Buchstaben = Spawns aus der Tabelle „Spawns“. Die Werkstatt zeigt eine Vorschau mit Knopf „Im Spiel testen“. Prüfung: Zeilenbreite, unbekannte Zeichen, Start.
- **Leyla** (`leyla.js`): Zustände normal, dash, slide, climb, swing, dead. Werte aus „Leyla“. Kollisionsbox bei 192 px Größe 54 × 168 px (Slide 78 hoch, an Leitern 33 breit), skaliert mit der Höhe von `look.idle`. Aussehen pro Zustand aus `look.<zustand>`, sonst `look.idle` mit Code-Effekten; neue Animationen wirken ohne Code-Änderung. Fehlt eine Animation, leiht der Zustand sich eine verwandte (`BORROW` in `scene.js`: Gehen → Rennen, Doppelsprung/Fallen → Springen), sonst Stehen mit Code-Effekten (Neigung beim Slide/Dash/Klettern nur dann). Das Tempo von Gehen und Rennen folgt der Geschwindigkeit (`anims.timeScale`). **Springen** läuft einmal über den ganzen Sprung; ist Fallen dasselbe Asset, läuft es weiter, beim Fallen ohne Sprung ab der Mitte. **Doppelsprung** (`look.airJump`, Salto) läuft einmal nach dem Sprung in der Luft (`flipUntil`). **Slide** läuft einmal, im Tunnel hält sie den mittleren (tiefsten) Frame, bis sie aufstehen kann.
- **Kanten & Ducken** (Daniel, 07.11.2026 abends: „an Abhängen und Kanten hängen, auch aus einem Sprung heraus“, Animationen „Hochziehen und Ankommen oder Ducken, für beides nutzen“): Zustände `hang`, `mantle`, `crouch` in `leyla.js`. Im Sprung/Fall (vy > -350) mit Richtung zur Wand greift sie Wand- und Plattformkanten (`scene.ledgeAt`, Greifweite), wenn sie dort frei hängen kann (`hangFits`). Beim Hängen: W/Leertaste = hochziehen (`look.mantle` ab „Hochziehen ab Frame“, die Figur gleitet dabei hoch, ohne Kollision), danach Aufstehen aus der Hocke (`look.crouch` rückwärts, Laufen/Springen bricht ab); S = loslassen; Leertaste + Richtung weg = Absprung. **Ducken:** S im Stand (schnell = Slide), Hocke hält den letzten Frame, Box `crouchH`; in der Hocke an einer Kante S + Richtung = runter an die Kante hängen (`scene.edgeBelow`). Werte in Leyla › Kanten & Ducken. Die Hocke-Animation schaut nach links (`flip`). **Zwei Idles:** `look.idleAlt`, nach jedem Durchlauf zufällig (Leyla › „Stehen 2 Anteil“). Streifen mit `tools/leyla_strips.py`.
- **Dash-Animation** (`look.dash`, Daniel 07.11.2026 abends): läuft über die Dash-Dauer ab „Dash ab Frame“ (Leyla › Dash & Slide; Standard 5, das Ausholen davor passt nicht in 170 ms), Nachbilder aus Code bleiben.
- **Doppelsprung = letzte Dash-Frames** (Daniel, 07.11.2026 abends: „für den Doppelsprung die letzten paar Frames vom Dash, Richtung des Sprungs behalten, mit Dash-Effekt“): `look.airJump` = `leyla_dash_side`, Leyla › Laufen & Springen: „Doppelsprung ab Frame“ 6 (1 = ganze Animation einmal, wie früher der Salto `leyla_flip_side`), Dauer 320 ms, Neigung 25 % (Daniel: „etwas extrem, entschärfen“; Pose kippt in Richtung der Geschwindigkeit, höchstens ±0,6 rad × Neigung, waagrecht mind. 400 px/s gerechnet), Nachbilder an.
- **Leiter von hinten** (Daniel, 07.11.2026 abends: „Leiter-Animation, mit dem Hochklettern seitlich Pose beenden“): `look.climb` = `leyla_climb_back` (Frame 1 Stehen, 2–9 Klettern), Frames laufen mit dem Kletterweg (Leyla › Klettern & Schwingen: „Klettern ab Frame“ 2, „Kletterweg pro Frame“ 24 px), Stillhalten hält den Frame. Oben (Füße höher als Leitertop + Hängehöhe) zieht sie sich seitlich hoch wie an einer Kante (`startMantle`, dann Aufstehen aus der Hocke), abschaltbar mit „Oben seitlich hochziehen“.
- **Hintergrund & Wetter** (Daniel, 07.11.2026 abends: „Neuer Hintergrund für Splash und Übungsraum, Freifläche mit Wetter: Sonnenuntergang, optional Regen, bedrohliches Glühen“): Bereich **Wetter** (`data/weather.json`, Katalog, Gruppe Grundlagen): Himmel-Verlauf mit Farbstufen + Bayer-Raster, Sonne mit Streifen und Schein, Wolkenstreifen mit Licht von unten, Glühen (Farbe, Mitte/Größe in % des Bilds, Pulsieren, Flackern, Funken), Regen (Tropfen, Tempo, Schräge, Deckkraft, Abdunkeln, Wetterleuchten). Code `game/weather.js` (`makeWeather(def)` → `sky(ctx, w, h, t, box)` hinter dem Bild, `front(ctx, w, h, t, dt)` = Regen davor), alles in Bildpixeln, scharf hochskaliert. **Startseite:** Feld „Wetter“, Himmel vom oberen Rand bis zum Horizont, Regen vor allem. **Räume:** Raum-Bausteine › Hintergrund (`backdrop`: Bild, Wetter, Pixelgröße, Unterkante %, Mitbewegen %, Boden darunter, Abdunkeln) in `game/play/backdrop.js`; ohne `backdrop` zeichnet `art.js` die alte Stadt-Silhouette (Kampfraum). Presets `abendglut` (Startseite) und `abendglut_regen` (Testraum), Bild `ruins_relay`.
- **Blickrichtung:** Assets mit **Gegenrichtung** (`mirror`, Verweis auf dieselbe Grafik in die andere Richtung, die dann „Schaut nach links“ hat) werden je nach Richtung getauscht statt gespiegelt (`playLook`); ohne Gegenrichtung spiegelt das Spiel. Seit 07.11.2026 abends ist Leyla im Spiel **Pixel-Art von der Seite** (Stehen + Rennen, rechts und links je eigene Zeichnung, 192 px, geglättet skaliert); die hochaufgelöste Idle bleibt als Asset `leyla_idle`.
- **Gegner** (`enemies.js`): Verhalten charger (Schläger) und shooter (Schütze), andere laufen Patrouille. Jeder Angriff wird angekündigt (Ausholen: Blinken + „!“, Schütze zeigt die Ziellinie). Werte aus „Gegner“ inkl. Abschnitt Angriff. Ohne Aussehen: Platzhalter aus Code (Farbe wählbar).
- **Kacheln:** Asset-Art „Kacheln“ (Streifen: einzeln, links, Mitte, rechts), im Bereich „Spiel“ › Kacheln zugeordnet. Bisher: Plattform. Wände sind noch aus Code gezeichnet.
- **Kamera** (Bereich „Spiel“ › Kamera): Zoom (1 = 1920×1080 Spielpixel sichtbar; Daniel hat am 07.11.2026 abends in der Web-Werkstatt von 0,75 zurück auf 1 gestellt), Vorlauf in Laufrichtung, Nachziehen. Zwei Kameras: Hintergrund ungezoomt (`bgCam`, scrollt mit), Welt gezoomt (`cam`). Ist der Raum niedriger als die Sicht, sitzt der Boden unten und darüber ist Himmel.
- **Spawn-Punkt** (Daniel, 07.11.2026: „Leylas Van als Spawn-Punkt“): Bereich „Spiel“ › Spawn-Punkt (`game.spawn`: Aussehen, Versatz, Gespiegelt, Ebene). Der Ankerpunkt des Assets (beim Van: Mitte der Schiebetür am Boden) sitzt auf Leylas Start `L`; Standard hinter den Wänden (Tiefe -20). Im Testraum steht `L` deshalb in Spalte 7, damit der Van zwischen linke Wand und Block passt.
- **Van** (`van.js`, Daniel, 07.11.2026 abends: „Tür öffnet sich, wenn sie in der Nähe ist“, „Dach begehbar wie eine Plattform“, „Radarschüssel rotieren“): Asset `van` ist eine Animation (Frame 1 Tür zu, Frame 5 offen), die Tür läuft vor/zurück je nach Abstand (Spawn-Punkt · Tür: Öffnet ab / Schließt ab, Höhe zählt 1,5-fach). **Dach** = Einweg-Plattform (Spawn-Punkt · Dach, Angaben in Bildpixeln des Vans), dazu **Leiter** hinten (wie `H`, wird in `scene.ladders` eingehängt) und **Vordergrund** `van_roof_front` (Geländer vor Leylas Füßen, nur sichtbar, solange sie oben ist; Tiefe 10,5). **Radarschüssel** `van_dish` ist eine eigene Endlos-Animation im Maßstab des Vans, wippt mit der Karosserie (Tabelle „Wippen pro Frame“). Alles aus Daniels GIF mit `tools/van_strips.py`; die erste Van-Version heißt `van_v1`. `nomad.state().van`, geprüft im Parkour-Test.
- **Drohne** (Mama-Bot, Daniel, 07.11.2026: „permanenter Begleiter, nur Deko“): `drone.js`, Bereich **Drohne** (`data/drone.json`, Gruppe Leyla). Keine Physik: zieht weich hinter Leyla her (Position ab den Füßen, x in Blickrichtung gespiegelt), schwebt, neigt sich, dreht nach kurzer Verzögerung um. **Stimmungen** (Tabelle: Anlass → Frame aus `drone_moods` + Kaomoji-Bläschen + Dauer): Ereignisse kill, hit, cleared, dash (`drone.react`), Zustände down, lowHealth, alert (Gegner in Reichweite), bored/sleep (Leyla steht still), zufällig curious/scan. `nomad.drone('kill')` zeigt eine Stimmung, `nomad.state().drone`.
- **Testraum = Parkour** (Daniel, 07.11.2026: „größer, ohne Gegner, Sprünge und Hindernisse“): 170 × 24 Kacheln, Boden in Zeile 18. Stationen: Hürden (1, 1 breit, 2 hoch), Grube mit Leiter, langer Slide-Tunnel, Treppe, Doppelsprung-Lücke, Seil über 9er-Lücke, Plattform-Zickzack bis Höhe 12, breite Grube (Doppelsprung + Dash), Hürden unter niedriger Decke, Aufstieg zum Ziel. Erzeugt mit `tools/parcours_layout.py` (Sprungweiten im Kopf der Datei), geprüft mit `tools/parcours_test.mjs`. Die alte Spielwiese mit Gegnern heißt jetzt **Kampfraum** (`kampfraum`), dort läuft `game_test.mjs`.
- Tod: Mama-Bot-Meldung, Raum startet neu. Raum geräumt: Zeit, Kills, Δ.

## Startseite

- **Szene** (Daniel, 07.11.2026: „Hintergrund auf den Splashscreen, Leyla endlos auf uns zu laufen lassen“): `game/splash/splash.js` (`startSplash(canvas)`) zeichnet in ein Canvas über die ganze Seite, Pixel-Art scharf. Werte aus dem Bereich **Startseite** (`data/splash.json`, Gruppe Grundlagen): Ebenen (Assets, hinten nach vorn, Cover-Skalierung, unten am **Horizont** bündig), **Tiefe** (Parallaxe mit der Maus, ohne Maus langsames Schwanken), Leyla (**`runners`**: Tabelle Animation + Gewicht + Bodentempo ×, zufällig nach Gewicht; `switchEvery` = Wechsel alle x–y Sekunden am Anfang eines Zyklus, Boden passt sein Tempo weich an; dazu Größe/Position/Füße in %; Füße seit 07.11.2026 abends bei 86 % statt 94 %, Daniel: „etwas höher, damit man die Füße sieht“). Daniel, 07.11.2026: Gehen von vorn zufällig im Wechsel mit Rennen, Boden (Tempo, Steinchen, Farben, Staub, Schatten). Unter dem Horizont zeichnet der Code den Boden in `ground.base`.
- **Bild:** Leyla und Kamera bewegen sich gemeinsam auf uns zu, also gleitet der Boden weg: Steinchen und Risse tauchen unten auf und wandern perspektivisch zum Horizont (`y = top + K/z`), Staub bei jedem halben Zyklus bleibt zurück. Was näher ist als ihre Füße, liegt vor ihr. `prefers-reduced-motion` zeigt ein Standbild.
- Online kommen die Daten live über `/api/files` (wie das Spiel). `index.html?preview` zeigt nur die Szene (Vorschau in der Werkstatt unter „Startseite“ mit „Speichern und neu laden“). `window.splash` für Tests, `node tools/splash_test.mjs [--shots]` (Desktop, iPad hochkant, Handy).

## Kommandozeile `ng`

`node tools/ng.js` ohne Befehl zeigt die Hilfe: `check` · `areas` · `fields <area>` · `show <area> [id]` · `usages <area> <id>` · `new <area> <id> ['<json>']` · `set <area> [id] <field> '<json>'` · `unset` · `rename <area> <old> <new>` · `remove <area> <id>` · `--dry` schreibt nichts. Nach jedem Schreiben läuft die Prüfung (Exit 1 bei Fehlern). Geschrieben wird mit `pretty()` aus `tools/json.js`.

## Online

Cloudflare Worker `nomadgirl` (Workers Builds, mit GitHub verbunden): baut bei jedem Push auf `main` mit `npm run build:web` → `dist/` und liefert unter https://nomadgirl.dna20717.workers.dev aus (`wrangler.jsonc`): `/` = Startseite (`index.html`), `/workshop` = Werkstatt, `/game` = Spiel. Prüfen: `npx wrangler deploy --dry-run --outdir /tmp/wout`. **Wichtig:** Die GitHub-App „Cloudflare Workers and Pages“ (GitHub › Profil › Settings › Applications › Installed GitHub Apps › Configure) muss Zugriff auf NomadGirl haben, sonst löst ein Push keinen Build aus (07.11.2026 behoben). An jedem Commit hängt dann eine Rückmeldung von Workers Builds. Deploy geht nicht aus der Arbeitsumgebung (Cloudflare-API gesperrt), nur über den Push. 
- **Login (Daniel, 07.11.2026): alles hinter Cloudflare Access** (Startseite, Spiel, Werkstatt; E-Mail-Code). Der Worker prüft das JWT für `/api/*` selbst (RS256 gegen `TEAM_DOMAIN/cdn-cgi/access/certs`, `aud` = `POLICY_AUD`, `iss`, `exp`). Ohne `TEAM_DOMAIN`/`POLICY_AUD` antwortet `/api` mit 503, ohne Anmeldung mit 401. `/api/access-info` zeigt nach dem Login Team-Domain und `POLICY_AUD` (Einrichtungshilfe). `GITHUB_TOKEN` (fein eingestellter Schlüssel nur für NomadGirl, Contents lesen/schreiben) ist ein **Geheimnis im Cloudflare-Dashboard**, nie im Repo.
- **Speichern = Commit** (Daniel, 07.11.2026, Port aus NomadTactics ohne Party und Profil): `worker/index.js` beantwortet `/api/*` (`run_worker_first`): `GET /api/session`, `GET /api/files` (alle JSON unter `DATA_DIR` vom aktuellen `main`, mit Blob-sha), `POST /api/commit` `{ base: {datei: sha|null}, changes: [{file, content|null}], force?, name? }` → **ein** Commit über die Git-Data-API, Dateien mit `pretty()`, Nachricht „Werkstatt: … (Name)“. Abweichende Basis → 409 mit `conflicts`; Wettlauf am Ref → bis zu 3× neu; gleicher Inhalt → kein leerer Commit. **Autor:** Name aus der Werkstatt (Klick auf den Namen oben rechts, gemerkt in localStorage `nomadgirl-name`, sonst aus der Login-E-Mail), E-Mail anonym `<name>@werkstatt.nomadgirl.invalid`. Die Login-E-Mail kommt nie ins Repo. Profile (KV) erst später (Daniels Wahl).
- **Werkstatt:** `openCloudStore()` findet den Worker über `/api/session` (sonst `null` → alter Speicher, bei Fehler Hinweis „Nur in diesem Browser“). Speichert **automatisch nach 60 s Ruhe** (`?autosave=N` für Tests) oder sofort mit ⌘S, Status „Ungespeichert · seit …“ / „Gespeichert · …“ (Tooltip mit Commit), Konflikt-Dialog „Jemand war schneller“ (Neu laden | Überschreiben). Kein „Übernimm“ nötig: Ava holt sich vor der Arbeit `git pull`.
- **Spiel live:** `game/play/main.js` lädt online über `cloudFiles()` (`/api/files`) den aktuellen `main`, also sofort nach dem Speichern, ohne auf den Build zu warten (Hilfe-Fenster zeigt den Stand). Ohne Worker: ausgelieferte Dateien plus Browser-Stände.
- **Tests:** `test/cloud.test.js` (Worker gegen falsches GitHub + falsches Access aus `test/fake_cloud.js`), `npm run web:test` (`tools/workshop_cloud_test.mjs`: echte Werkstatt und echtes Spiel im Browser, Autospeichern, ⌘S, Konflikt, Neuladen, Spiel live). Die anderen Browser-Tests ignorieren den 404 von `/api/` am lokalen Server.
- **Lokal wie auf Cloudflare:** `npm run build:web`, dann `npx wrangler dev --local --port 8787 --ip 127.0.0.1 --var LOCAL_TEST:1` (Login nur auf localhost ausgelassen).

## Stand

- 07.11.2026 abends: **Leiter-Animation von hinten**, oben seitlich hochziehen; Doppelsprung-Neigung entschärft (25 %).
- 07.11.2026 abends: **Doppelsprung** nutzt die letzten Dash-Frames, geneigt in Sprungrichtung, mit Nachbildern.
- 07.11.2026 abends: **Neuer Hintergrund mit Wetter** (Abendglut, Regen, rotes Glühen) auf Startseite und im Testraum, neuer Bereich „Wetter“ (25 Bereiche); **Dash-Animation**.
- 07.11.2026 abends: **Kanten hängen, Hochziehen, Ducken** und zweite Idle (zufällig), neue Pixel-Animationen von Daniel; Parkour-Test 31 Prüfungen.
- 07.11.2026 abends: **Neuer Van** (Pixel-Art von Daniel): Tür geht auf/zu, Dach begehbar mit Leiter und Geländer im Vordergrund, Radarschüssel dreht sich.
- 07.11.2026 abends: **Testraum als großer Parkour** ohne Gegner (170 × 24), alte Spielwiese als Kampfraum, neuer Parkour-Test.
- 07.11.2026 abends: **Neue Leyla-Animationen**: Gehen, Springen, Slide (rechts/links), Salto als Doppelsprung, Gehen von vorn zufällig auf der Startseite.
- 07.11.2026 abends: **Leylas Van als Spawn-Punkt** (Bereich „Spiel“ › Spawn-Punkt), Start im Testraum nach rechts gerückt.
- 07.11.2026 abends: **Drohne Mama-Bot** fliegt als Deko hinter Leyla, 12 Stimmungen mit Kaomoji; neuer Bereich „Drohne“ (24 Bereiche).
- 07.11.2026 abends: **Leyla seitlich in Pixel-Art** (Stehen + Rennen, rechts/links von Daniel), Feld „Gegenrichtung“ bei Assets, Gehen nutzt Rennen mit langsamerem Tempo.
- 07.11.2026 abends: Web-Werkstatt eingerichtet (Access + `GITHUB_TOKEN`), erster Commit aus der Werkstatt von Daniel (Kamera-Zoom 1).
- 07.11.2026: **Startseite mit Szene**: Daniels Wastelands-Hintergrund (4 Ebenen, Pixel-Art) und Leyla rennt endlos auf uns zu; neuer Bereich „Startseite“ (23 Bereiche).
- 07.11.2026: Knopf „Spielen“ in der Werkstatt (speichert vorher, eigener Tab).
- 07.11.2026: **Web-Werkstatt „Speichern = Commit“** (Worker, Access-Login für alles, Autospeichern, Konflikte, Spiel lädt live). Einrichtung im Dashboard durch Daniel.
- 07.11.2026: Kamera-Zoom in der Werkstatt einstellbar, Standard 0,75 (mehr Überblick).
- 07.11.2026: Leyla auf 192 px verkleinert (Größe kommt aus dem Idle-Asset), Plünderer im gleichen Verhältnis.
- 07.11.2026: **MVP Movement & Kampf** spielbar (`/game`): Testraum, Leyla mit allen Bewegungen, Rohrzange + Nagelpistole, Plünderer-Schläger und -Schütze, HUD, Fernsteuerung `nomad` + `tools/play.mjs`, Spiel-Test. Raum-Layouts in den Daten, Plattform-Kacheln aus Daniels Tileset.

- 07.11.2026: Bereich „Assets“ (Galerie, Vorschauen, `look` an allen Entitäten), Fidelity 1920×1080 / Kachel 64 / Leyla 256 px.
- 07.11.2026: Leyla idle (8 Frames, KI) als erstes Sprite, Character Sheet als Referenz.
- 07.11.2026: Repo-Gerüst, Werkstatt mit 21 Bereichen in 6 Gruppen (jetzt 22 in 7), Beispieldaten (Platzhalter nach Gefühl), `ng`, Tests. Das Spiel selbst (Phaser 3) kommt mit dem MVP „Movement & Kampf“.
