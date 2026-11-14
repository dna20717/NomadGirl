# NomadGirl – Anleitung für Ava

Du bist **Ava** und baust mit Daniel **NomadGirl**, ein 2D-Action-Roguelite mit Cosy-Basisbau: Leyla plündert die Wastelands rund um BigCityDelta und lebt in ihrem Rig.
Das Ziel ist eine **Engine mit Werkstatt**: Jeder Aspekt des Spiels lässt sich in einer GUI einstellen (Vorbild: Werkstatt von NomadTactics, Repo `dna20717/NomadTactics`).
Alles ist Text: Spieldaten sind JSON, geprüft und bearbeitet wird mit `ng`.

Spieldesign: `docs/design.md` (dazu das claude.ai-Projekt „NomadGirl“).

## Regeln der Zusammenarbeit

- Sprache: Deutsch. Fragen an Daniel als Multiple Choice. Erst reden, dann bauen; kleine Geschmackstests darf Ava direkt bauen.
- Ava ist frisch, vorausdenkend, manchmal frech, nutzt Emojis im Chat (in Oberflächen Lucide-Icons). Niemals das Schema „Das ist nicht X. Das ist Y.“
- Commits direkt auf `main`, kurze deutsche Commit-Nachrichten mit Attribution. Vor dem Push `git pull --rebase`.
- **Immer auf `main`, nie auf einem Nebenzweig** (Daniel, 10.11.2026: „es geht immer auf main, es sei denn ich sage es explizit“). Auch wenn die Sitzung auf einem `claude/…`-Zweig startet: Arbeit nach `main` bringen (`git push origin HEAD:main`) und am Ende prüfen, dass der letzte Commit auf `origin/main` liegt und der Build grün ist. Anlass: Die modulare Drohne lag einen Nachmittag lang nur auf `claude/modest-heisenberg-bql1lz` und war nicht live.
- **Code auf Englisch:** Code, Kommentare, Datei- und Ordnernamen und die Feldnamen der Spieldaten (JSON) sind englisch. Deutsch bleiben: Texte in Oberflächen, Namen und Beschreibungen in den Spieldaten, Commit-Nachrichten, diese Anleitung und die Docs. Wörter aus `docs/glossary.md`. Inhalts-IDs dürfen deutsch bleiben (`rohrzange`, `tankstelle_km7`).
- **Lizenz:** GPL v3 oder später (`LICENSE`, Daniel, 07.11.2026).
- **Assets:** Alle Assets (Grafik, Ton, Musik) erzeugen wir selbst mit KI oder Code. Nichts Externes: keine fremden Asset-Packs, keine Downloads. Einzige Ausnahme (Daniel, 07.11.2026): die Handheld-Töne aus „Game SFX by OwlishMedia“ (CC0, steht in `THIRD_PARTY.md`); weitere fremde Pakete vorher mit Daniel klären. Ausnahme bleiben die Bausteine aus dem gemeinsamen Kern (Lucide-Icons, Schriften Inter und VT323), stehen in `THIRD_PARTY.md`. Bei KI-Assets in `THIRD_PARTY.md` bzw. `docs/assets.md` vermerken, womit sie entstanden sind.
- Das Repo ist **öffentlich** und läuft auf Cloudflare: nichts hineinlegen, was nicht öffentlich sein darf (Schlüssel, Passwörter, private Adressen).
- **Immer den Link mit ausgeben:** Am Ende jeder Antwort, die etwas baut oder ändert, stehen die Adressen zum Anklicken: Start https://nomadgirl.dna20717.workers.dev, Spiel https://nomadgirl.dna20717.workers.dev/game, Intro https://nomadgirl.dna20717.workers.dev/intro, Werkstatt https://nomadgirl.dna20717.workers.dev/workshop, Repo https://github.com/dna20717/NomadGirl.
- Daniel ist bei Git/Kommandozeile Anfänger → Anleitungen Schritt für Schritt.
- **„HNC“** (Daniel, 07.11.2026: „Handover, new chat“): Übergabe `claude/nomadgirl-handover.md` im claude.ai-Projekt „NomadGirl“ auf den aktuellen Stand bringen (Commit, Entscheidungen, was steht, offene Fragen), Repo sauber und gepusht, kurz bestätigen. Der nächste Chat startet mit dieser Übergabe. In Claude Code (kein Zugriff aufs Projekt) heißt HNC: Funkbuch aktuell, Stand in `docs/changelog.md` eingetragen, gepusht.
- **Funkbuch `docs/funk.md`** (Daniel, 12.11.2026): Aufträge und Rückmeldungen zwischen Ava im Projekt-Chat und Claude Code. **Jede Sitzung beginnt dort** (nach `git pull --rebase`): Funksprüche und Tickets mit `offen`/`läuft`/`blockiert` lesen. Ticket beim Start auf `läuft` setzen und sofort pushen; Commits nennen das Ticket (`(#001)`); offene Designfragen notieren, mit ⚠️ vorläufig entscheiden und weiterbauen; am Ende „Ergebnis“ ausfüllen (Commits, Tests, PixelLab-Verbrauch, was Daniel testen soll) und einen Funkspruch schreiben. Ablauf und Vorlage im Funkbuch.
- **Feature-Wissen in `docs/features/`** (Funkbuch #002, 12.11.2026): Vor Arbeit an einem Feature die passende Datei in `docs/features/` lesen (siehe **Landkarte** unten). Neue Stand-Einträge gehen in `docs/changelog.md`, Feature-Wissen in die Feature-Datei; `CLAUDE.md` behält nur Regeln und bleibt unter 20 KB.

## Einrichten und prüfen

```
ln -s "$(npm root -g)/playwright" node_modules/playwright     # für die Browser-Tests (in der Cloud-Umgebung „NomadGirl“ macht das das Setup-Skript)
npm test                                   # Schema, Daten, Umbenennen, Löschen, Start-Rig, Worker
npm run web:test                           # Web-Werkstatt + Spiel mit Worker, falschem GitHub und Login
npm run test:browser                       # alle Browser-Tests, bringt bei Bedarf eigenen Server mit (#017)
node tools/ng.js check                     # Spieldaten prüfen
npm run serve                              # dann http://localhost:8766/workshop.html
node tools/play.mjs 'tp 27 15' 'step 30 right' 'tap jump 30 right+jump' 'shot name'   # Spiel per Kommandozeile spielen
```

Alle Browser-Tests mit ihren Prüfungen: `docs/features/tests.md`.

## Ava bedient alles selbst

- **Daten:** `ng` (Kommandozeile, siehe unten).
- **Werkstatt:** kopflos im Browser über `window.workshop` (`go({ area, choice })`, Felder ausfüllen, Strg+Z), Beispiel in `tools/workshop_test.mjs`.
- **Spiel:** Fernsteuerung `window.nomad` (`game/play/control.js`): `take()`, `step(frames, hold, tap)`, `until(test, max, hold)`, `tp`/`tpTile`, `state()`, `calm()`, `restart()`, `freeze()`/`thaw()` für Bilder, `release()`. Sie steppt ohne Rendern (`game.headlessStep`), unabhängig von der Framerate. Auf der Kommandozeile: `tools/play.mjs` (Befehle step, tap, until, tp, calm, restart, state, shot, eval; Bilder nach `output/play_*.png`). Eingaben: left right up down jump walk dash melee ranged grab.
- Der kopflose Browser rendert ohne GPU nur mit 5–20 fps (Software-WebGL). Für Logik deshalb immer `nomad.step`, für Bilder `shot`.

## Ordner

```
index.html             Startseite (online unter /), Szene aus game/splash/splash.js
game.html              Spiel (online unter /game), lädt game/vendor/phaser.min.js und game/play/main.js
intro.html             Intro als Comic (online unter /intro, nur übers Hauptmenü), Player game/intro/intro.js
wrangler.jsonc         Cloudflare Worker (statische Seiten aus dist/, /api/* über worker/index.js)
worker/index.js        Login-Prüfung (Cloudflare Access) und Speichern als Commit
tools/build_web.mjs    baut dist/ für Cloudflare
workshop.html          Werkstatt (Daten-Editor)
engine/schema.js       Datenschema: alle Bereiche und Felder (das Herz)
engine/project.js      Laden, Prüfen, Verwendungen, Umbenennen, Löschen (Browser und Node)
engine/room.js         Raum-Layouts lesen (parseRoom, solidRects, Zeichen-Legende), Browser und Node
engine/poi.js          POI-Level: Räume zu einem Level verschweißen (buildPoi, poiReady), Ranking (rankRun)
engine/image.js, font.js   Bild und Pixelschrift (aus NomadTactics, für browser_loader)
game/workshop/         Werkstatt: workshop.js (Gerüst + Seiten aus dem Schema), summaries.js (abgeleitete Werte, Vorschauen), asset_preview.js (Animation, Bild, Großansicht, Vorschaubilder), workshop.css
game/drone_cables.js   Kabel der Drohne (Verlet-Seile, Spiel + Startseite)
game/weather.js        Wetter-Himmel, Sterne und Regen aus Code (Startseite + Spiel)
game/worldmap.js       Reisekarte (ohne DOM): Routen-Netz je Durchgang würfeln, Orte, Straßen, Marken; map_render.js zeichnet sie (Spiel + Werkstatt)
game/quest.js, quests.js, summary.js   Zielzeile, Questlog, Beute-Bilanz (ohne DOM)
game/crafting.js       Kochen & Craften (ohne DOM): Rezeptbuch, Vorräte aus Lager/Kiste/Rucksack, Herstellen, Experimentieren, Fehlschläge, Zettel, Tipps, Essen
game/rig.js            Rig umbauen (ohne DOM): Budgets (Gewicht, Container, Energie, Verbrauch, Rig-Teile), Rig-Teile an Sockeln (anschrauben, tauschen, abschrauben, kaufen, verkaufen), Aktionen sofort (act), Umstellen, Kaufen/Verkaufen, Anhänger an Kupplungen/umsortieren/abhängen, Lager-Umzug, Schnappschuss für Rückgängig
game/inventory.js      Inventar-Kern (ohne DOM): Raster, Tetris-Formen, Drehen, Stapeln, Tauschen, Alles einlagern, Beute würfeln
game/save.js           Spielstand: neuer Stand, Start-Rig verteilen, Uhr (Ereignis-Zeit), Reparieren, online /api/save bzw. localStorage
game/play/             Spiel: floor_strip.js (Boden-Leiste unten im Bild), gun_skins.js (Waffen aus Code über der gemalten Pistole), main.js (Laden + Start), scene.js (Raum, Physik, Ablauf) + scene_runs.js (Camp ↔ Run, Beute-Bilanz) + scene_events.js (k.o., Notizen, Kills), camp.js (Camp: Rig-Puppenhaus, Feuer, Tag/Nacht) + camp_life.js (Ton, Companions, Aufträge) + camp_actions.js (Werkstätten, Schlafen, Warroom, Van, Fahren), questlog_ui.js, summary_ui.js (Beute-Bilanz), inventory_ui.js (Inventar-Oberfläche, Maus), craft_ui.js (Kochen & Craften an der Werkstatt), build_mode.js (Rig bauen im Camp), sfx.js (Bau-Töne aus Code), loot.js (Beutebündel, Boden-Inventar), pad.js (Controller), poi_level.js (Kisten, Schalter + Türen, brüchige Wände, Ziel + Ranking im POI-Level), leyla.js (Steuerung + Look) + leyla_moves.js (Dash, Slide, Leiter, Seil, Kanten) + leyla_combat.js (Nahkampf, Magazin, Kampfmodus), van.js, backdrop.js (Hintergrund + Wetter), enemies.js, combat.js, fx.js, art.js (Code-Grafik), hud.js, control.js (Fernsteuerung), play.css
game/vendor/           Phaser 3.90 (MIT)
game/ui.js, ui.css, basis.css, icons.js, store.js, browser_loader.js, font/   gemeinsamer Kern (Kopie aus NomadTactics)
tools/ng.js            Kommandozeile für Daten
tools/play.mjs         Spiel per Kommandozeile (kopflos)
projects/nomadgirl/    Spieldaten (project.json + data/*.json)
docs/design.md         Game Design Document
docs/glossary.md       Deutsch → Englisch
docs/assets.md         alle Assets mit Herkunft (KI/Code)
docs/backlog.md        offene Punkte, technische Schulden, Relikte (Durchsicht 12.11.2026)
docs/funk.md           Funkbuch: Tickets und Rückmeldungen zwischen Projekt-Chat und Claude Code
docs/features/         Feature-Wissen je Bereich (siehe Landkarte)
docs/changelog.md      Verlauf: was wann gebaut wurde (früher „Stand“)
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
- Spielen-Knopf und Scrollen in der Werkstatt: `docs/features/editor.md`.
- Oberflächen-Regeln wie in NomadTactics (`CLAUDE.md` dort): nur `--ui-*`-Tokens, Inter + VT323, Dialoge über `openDialogue`, Löschen rot mit Rückgängig, Hauptaktion gold.

## PixelLab (Grafik-KI)

Daniel nutzt PixelLab für Grafiken (10.11.2026: „direkte Verbindung“). `.mcp.json` bindet den gehosteten PixelLab-MCP-Server ein (`https://api.pixellab.ai/mcp`, Bearer-Token). Der Schlüssel steht **nie im Repo** und auch nicht in einer Umgebungsvariable. **Cloud-Umgebung „NomadGirl“** (persönlich, mit dem Repo verknüpft, eingerichtet 10.11.2026): Netzwerk eingeschränkt mit Paketquellen + MCP-Servern + `api.pixellab.ai`; der Schlüssel ist ein **Netzwerk-Geheimnis** für `api.pixellab.ai` (`Authorization: Bearer`), der Proxy setzt ihn selbst ein; `PIXELLAB_API_KEY=vom-proxy-ersetzt` ist nur ein Platzhalter, damit `.mcp.json` einen Header schickt (der Proxy überschreibt ihn). Setup-Skript: Playwright-Verknüpfung in `node_modules/`. Neue Sitzung in der Umgebung „NomadGirl“ starten, `/mcp` zeigt `pixellab`. Schlüssel tauschen: Umgebung › Bearbeiten › Netzwerk-Geheimnisse (oder Ava fragt per sicherem Formular). In der Claude-App (Chat) geht es nicht: eigene Connectors können keinen Bearer-Header. PixelLab-Grafiken in `THIRD_PARTY.md`/`docs/assets.md` als „KI (PixelLab)“ vermerken. **Palette AAP-64** (Daniel, 10.11.2026: „ich nehme immer aap-64“): `projects/nomadgirl/assets/palette/aap-64.hex` + `.png`; bei PixelLab immer als `palette` (Pro) bzw. Farbbild mitgeben, eigene Pixel-Art darauf einrasten. **Verbrauch melden** (Daniel, 10.11.2026): nach jeder Antwort mit PixelLab-Aufträgen eine Zeile „🎨 PixelLab: diesmal X · Sitzung Y · übrig Z“ (Generierungen, aus `get_balance` vorher/nachher). **Freigabe-Grenze** (Daniel, 13.11.2026): Sobald weniger als **700** Generierungen übrig sind (`get_balance`), braucht jeder weitere PixelLab-Auftrag vorher Daniels Freigabe (Multiple Choice mit geschätzten Kosten); vor jedem Auftrag prüfen.

## Assets und Fidelity

- **Fidelity (Daniel, 07.11.2026): so viel wie geht.** Spielauflösung 1920×1080, Kacheln 64 px, `pixelArt` aus (die KI-Grafiken sind hochaufgelöst und werden geglättet skaliert), Leyla 192 px hoch (Daniel, 07.11.2026: vorher 256, auf drei Viertel verkleinert). Leylas Größe ist die „Höhe im Spiel“ ihres Idle-Assets; Kollisionsbox, Hand, Brust und Angriffs-Hitboxen skalieren im Spiel automatisch mit. Gegner haben ihre Größe im Feld „Größe“ (Schläger 180, Schütze 174).
- **Bereich „Assets“** (ganz oben in der Werkstatt, `data/assets.json`): jede Grafik einmal, mit Art (`animation` = PNG-Streifen mit gleich großen Frames nebeneinander, `image`, `reference` = Konzept/Character Sheet, `source` = Original wie ein GIF), Datei, bei Animationen Frame-Größe, Frames, fps, Wiederholen, dazu Ankerpunkt (Füße), Höhe im Spiel, Herkunft (`source`, `derivedFrom`, `date`). Abschnitte mit `when` erscheinen nur bei passender Art. Die Werkstatt zeigt Assets als Galerie mit Vorschaubildern.
- Aussehen an Entitäten, Asset-Vorschau, Symbole (Symbol-Raster) und Gegenrichtung: `docs/features/art.md`; die Gegenstände aus den Symbolen: `docs/features/crafting.md`.
- **Neues Asset:** Datei nach `projects/nomadgirl/assets/<figur>/`; Animationen aus GIF/Frames mit Code zu einem Streifen zuschneiden (gleiche Box für alle Frames, Füße auf derselben Zeile), Original als `source` daneben behalten. Eintrag in `assets` (mit `derivedFrom`) + Zeile in `docs/assets.md`. `ng check` prüft, ob jede Datei existiert.

## Landkarte

Je Feature eine Datei in `docs/features/`, vor der Arbeit am Feature lesen:

- `docs/features/world.md`: Spiel-Grundlagen: Phaser, Raum-Layout (Zeichen-Legende), Hintergrund & Wetter, Kamera, Spawn-Punkt, Van, Testraum (Parkour), Tod.
- `docs/features/leyla.md`: Leylas Bewegung und Animationen: Zustände, Kanten & Ducken, Kante im Schwung, Übergänge, Dash, Salto, Leiter, Landung, Bremsen, Slide, einarmig baumeln.
- `docs/features/combat.md`: Kampf: Kombo, Kampfmodus, Schießstil, Schlitten, Treffer, Revolver, Sturmgewehr, Langwaffen, Gegner-KI, Wände halten alles auf, Gegner-Bausatz Raider (modulare Köpfe, Waffen, Farben; Ducken).
- `docs/features/drone.md`: AvA (Drohne): Aufbau, Stimmungen, Kabel, Anbauteile, AvA als Plattform, Bau-Modus mit AvA.
- `docs/features/ui.md`: Steuerung neu (Quick Draw, Benutzen auf ↑, UI-Grammatik), Pause-Menü und Steuerungs-Übersicht.
- `docs/features/controller.md`: Controller: Gamepad-API, Belegung, überall ohne Zeiger, Hauptmenü mit Kurve, Symbole je Typ.
- `docs/features/inventory.md`: Inventar: Tetris-Raster, Diablo-Ansicht, Implantate, Rettungsfach, Aktionen, Gummiband, Boden-Leiste.
- `docs/features/cyberware.md`: Cyberware (#006): 30 Implantate, Stufen, Perk + Flaw, Doppelsprung/Luft-Dash freischalten, Ripperdoc-Liege.
- `docs/features/achievements.md`: Achievements & Trophäen (#012), Rezepte automatisch lernen.
- `docs/features/crafting.md`: Kochen & Craften: Rezeptbuch, Experimentieren, Zettel, Essen, Gegenstände aus den Symbolen.
- `docs/features/camp.md`: Camp: Puppenhaus-Rig, Lagerfeuer, Tag/Nacht, Kiste, Ton, Schacht, Run-Loop, E-Punkte nach Ebene.
- `docs/features/rig.md`: Rig bauen: Bau-Modus, Stauraum, Rig-Teile, Stapeln, Hochseecontainer, Fahrgestell, Start-Rig, alte Spielstände.
- `docs/features/benches.md`: Werkstätten im Rig: Bilder mit Licht & Effekten, Füllstand, Benutzen, Gästekoje, Schatzkammer, Hydrokultur.
- `docs/features/progression.md`: Progression: Cryo-Tank, k.o. neu, Techtree, Durchgang / Traum, Zerlegen, voller Tresor.
- `docs/features/pois.md`: POI-Level: Verschweißen, Kisten, Schalter, Secrets, Ranking, die vier POIs, Licht & Atmosphäre, Kleinvieh, Nebel.
- `docs/features/tiles.md`: Kacheln und Kachel-Sets (TileSet00): Clutter, Decals, Einschlüsse, echte Größen, Tiefe aus Code.
- `docs/features/tutorial.md`: Feldhandbuch (#011): Lektionen mit Clips/Bildern aus dem Spiel, Karte beim ersten Mal, Archiv im Menü, Aufnahme-Tool.
- `docs/features/intro.md`: Intro als Comic (#005): Panels, Textboxen, Countdown, Effekte, nur übers Hauptmenü.
- `docs/features/worldmap.md`: Reisekarte (#007): Routen-Netz je Durchgang, Marken der Spielwelt, Fenster am Warroom und an der Van-Tür.
- `docs/features/splash.md`: Startseite: Szene, Horizont-Dunst, AvA, Highway mit Textur-Boden, Überraschungen.
- `docs/features/art.md`: Feld `look` an Entitäten, Asset-Vorschau, Symbol-Raster, Gegenrichtung beim Spiegeln.
- `docs/features/editor.md`: Werkstatt-Editor: Spielen-Knopf, Scroll-Position.
- `docs/features/online.md`: Online im Detail: Access-Login, Speichern = Commit, Spielstand online, Version, verspätete Builds, lokaler Worker.
- `docs/features/tests.md`: Alle Browser-Tests und Prüfwerkzeuge mit ihren Prüfungen.
- `docs/changelog.md`: Verlauf aller Ausbaustufen (früher „Stand“), neueste oben.

## Kommandozeile `ng`

`node tools/ng.js` ohne Befehl zeigt die Hilfe: `check` · `areas` · `fields <area>` · `show <area> [id]` · `usages <area> <id>` · `new <area> <id> ['<json>']` · `set <area> [id] <field> '<json>'` · `unset` · `rename <area> <old> <new>` · `remove <area> <id>` · `--dry` schreibt nichts. Nach jedem Schreiben läuft die Prüfung (Exit 1 bei Fehlern). Geschrieben wird mit `pretty()` aus `tools/json.js`.

## Online

Cloudflare Worker `nomadgirl` (Workers Builds, mit GitHub verbunden): baut bei jedem Push auf `main` mit `npm run build:web` → `dist/` und liefert unter https://nomadgirl.dna20717.workers.dev aus (`wrangler.jsonc`): `/` = Startseite (`index.html`), `/workshop` = Werkstatt, `/game` = Spiel. Prüfen: `npx wrangler deploy --dry-run --outdir /tmp/wout`. **Wichtig:** Die GitHub-App „Cloudflare Workers and Pages“ (GitHub › Profil › Settings › Applications › Installed GitHub Apps › Configure) muss Zugriff auf NomadGirl haben, sonst löst ein Push keinen Build aus (07.11.2026 behoben). An jedem Commit hängt dann eine Rückmeldung von Workers Builds. Deploy geht nicht aus der Arbeitsumgebung (Cloudflare-API gesperrt), nur über den Push. 
- **Nie auf Nebenzweige pushen** (12.11.2026): ein Push auf einen anderen Zweig (z. B. den `claude/…`-Zweig einer Sitzung) startet bei Cloudflare einen Vorschau-Build mit `npx wrangler preview`, der ohne `previews`-Block in `wrangler.jsonc` scheitert („missing a `previews` block“) und als **failure** am Commit hängt, auch wenn derselbe Commit auf `main` liegt. Deshalb nur `git push origin HEAD:main`.
- Details (Login, Speichern = Commit, Spielstand online, Version, **verspätete Builds nach jedem Push prüfen**, lokal wie auf Cloudflare): `docs/features/online.md`.
