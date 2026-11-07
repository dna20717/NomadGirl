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
- **Immer den Link mit ausgeben:** Am Ende jeder Antwort, die etwas baut oder ändert, stehen die Adressen zum Anklicken: Start https://nomadgirl.dna20717.workers.dev, Werkstatt https://nomadgirl.dna20717.workers.dev/workshop, Repo https://github.com/dna20717/NomadGirl.
- Daniel ist bei Git/Kommandozeile Anfänger → Anleitungen Schritt für Schritt.

## Einrichten und prüfen

```
ln -s "$(npm root -g)/playwright" node_modules/playwright     # nur für den Werkstatt-Test
npm test                                   # Schema, Daten, Umbenennen, Löschen, Start-Rig
node tools/ng.js check                     # Spieldaten prüfen
npm run serve                              # dann http://localhost:8766/workshop.html
node tools/workshop_test.mjs [--shots]     # Werkstatt kopflos bedienen (Server muss laufen), Bilder nach output/
```

## Ordner

```
index.html             Startseite (online unter /)
wrangler.jsonc         Cloudflare Worker (statische Seiten aus dist/)
tools/build_web.mjs    baut dist/ für Cloudflare
workshop.html          Werkstatt (Daten-Editor)
engine/schema.js       Datenschema: alle Bereiche und Felder (das Herz)
engine/project.js      Laden, Prüfen, Verwendungen, Umbenennen, Löschen (Browser und Node)
engine/image.js, font.js   Bild und Pixelschrift (aus NomadTactics, für browser_loader)
game/workshop/         Werkstatt: workshop.js (Gerüst + Seiten aus dem Schema), summaries.js (abgeleitete Werte, Vorschauen), asset_preview.js (Animation, Bild, Großansicht, Vorschaubilder), workshop.css
game/ui.js, ui.css, basis.css, icons.js, store.js, browser_loader.js, font/   gemeinsamer Kern (Kopie aus NomadTactics)
tools/ng.js            Kommandozeile
projects/nomadgirl/    Spieldaten (project.json + data/*.json)
docs/design.md         Game Design Document
docs/glossary.md       Deutsch → Englisch
docs/assets.md         alle Assets mit Herkunft (KI/Code)
projects/nomadgirl/assets/   alle Grafiken: Animationen, Bilder, Referenzen, Originale (nach Figur/Thema in Unterordnern, z. B. leyla/)
output/                Bilder vom Werkstatt-Test (nicht im Git)
```

## Werkstatt und Schema

- **Alles kommt aus `engine/schema.js`.** Ein Bereich (`AREAS.<id>`) ist entweder ein **Katalog** (Einträge nach ID: Waffen, Gegenstände …) oder **einzeln** (ein Objekt: Leyla, Reisen …). Er nennt seine Datei, Abschnitte mit Feldern, eine Vorlage für neue Einträge, eine Kurzzeile für Listen (`row`), optional eine Gruppierung (`groupBy`) und eigene Prüfungen (`check`).
- **Feldtypen:** text, textarea, number, checkbox, color, select, multi, ref (Verweis), refs (Liste von Verweisen), size ([b, h]), point ([x, y]), range ([min, max]), table (Zeilen mit Spalten). Schlüssel sind Punkt-Pfade (`movement.runSpeed`).
- **Neuer Aspekt des Spiels** = neuer Bereich oder neues Feld im Schema, in `GROUPS` einsortieren, Beispieldaten anlegen (`ng new …`). Werkstatt, Prüfung, Umbenennen, Löschen und `ng` können ihn dann sofort. Eigene Ansichten (abgeleitete Werte, Vorschauen) in `game/workshop/summaries.js`.
- **Prüfung** (`validateProject`): Verweise, Pflichtfelder, Zahlenbereiche, Auswahlwerte, die `check`-Regeln der Bereiche und Querprüfungen (Gegenstände ohne Verwendung, POIs ohne Ort).
- **Umbenennen/Löschen** ziehen Verweise in allen Bereichen mit bzw. räumen sie auf.
- **Speichern:** wie die alte NomadTactics-Werkstatt über `game/store.js` (Artifact-Datenbank, sonst localStorage `nomadgirl-drafts:`). Eine Web-Werkstatt mit „Speichern = Commit“ (Cloudflare Worker wie bei NomadTactics) ist der nächste Schritt, wenn Daniel das will.
- Oberflächen-Regeln wie in NomadTactics (`CLAUDE.md` dort): nur `--ui-*`-Tokens, Inter + VT323, Dialoge über `openDialogue`, Löschen rot mit Rückgängig, Hauptaktion gold.

## Assets und Fidelity

- **Fidelity (Daniel, 07.11.2026): so viel wie geht.** Spielauflösung 1920×1080, Kacheln 64 px, `pixelArt` aus (die KI-Grafiken sind hochaufgelöst und werden geglättet skaliert), Leyla 256 px hoch. Alle Pixelwerte (Tempo, Sprungkraft, Reichweiten …) sind auf diesen Maßstab ausgelegt.
- **Bereich „Assets“** (ganz oben in der Werkstatt, `data/assets.json`): jede Grafik einmal, mit Art (`animation` = PNG-Streifen mit gleich großen Frames nebeneinander, `image`, `reference` = Konzept/Character Sheet, `source` = Original wie ein GIF), Datei, bei Animationen Frame-Größe, Frames, fps, Wiederholen, dazu Ankerpunkt (Füße), Höhe im Spiel, Herkunft (`source`, `derivedFrom`, `date`). Abschnitte mit `when` erscheinen nur bei passender Art. Die Werkstatt zeigt Assets als Galerie mit Vorschaubildern.
- **Entitäten verweisen auf Assets:** Feld `look` (Aussehen) bei Rucksäcken, Waffen, Gegnern, Gegenständen, Zugmaschinen, Containern, Werkstätten, Rig-Teilen, Companions, POIs, Räumen, Orten und Encountern; Leyla hat `look.idle` … `look.hurt` und `look.reference`. Jeder Inspektor zeigt oben „Aussehen“ mit Vorschau (bei mehreren Verweisen umschaltbar), Listen zeigen kleine Vorschaubilder.
- **Vorschau:** Animationen mit Nah, 1:1 und „Im Spiel“ (Spielauflösung mit Kachelraster und Boden), Abspielen/Anhalten, Frame für Frame, Ankerpunkt; Bilder angepasst, antippen öffnet die Originalgröße. Hintergrund Karo, Dunkel, Hell.
- **Neues Asset:** Datei nach `projects/nomadgirl/assets/<figur>/`; Animationen aus GIF/Frames mit Code zu einem Streifen zuschneiden (gleiche Box für alle Frames, Füße auf derselben Zeile), Original als `source` daneben behalten. Eintrag in `assets` (mit `derivedFrom`) + Zeile in `docs/assets.md`. `ng check` prüft, ob jede Datei existiert.

## Kommandozeile `ng`

`node tools/ng.js` ohne Befehl zeigt die Hilfe: `check` · `areas` · `fields <area>` · `show <area> [id]` · `usages <area> <id>` · `new <area> <id> ['<json>']` · `set <area> [id] <field> '<json>'` · `unset` · `rename <area> <old> <new>` · `remove <area> <id>` · `--dry` schreibt nichts. Nach jedem Schreiben läuft die Prüfung (Exit 1 bei Fehlern). Geschrieben wird mit `pretty()` aus `tools/json.js`.

## Online

Cloudflare Worker `nomadgirl` (Workers Builds, mit GitHub verbunden): baut bei jedem Push auf `main` mit `npm run build:web` → `dist/` und liefert unter https://nomadgirl.dna20717.workers.dev aus (`wrangler.jsonc`): `/` = Startseite (`index.html`), `/workshop` = Werkstatt. Prüfen: `npx wrangler deploy --dry-run --outdir /tmp/wout`. Deploy geht nicht aus der Arbeitsumgebung (Cloudflare-API gesperrt), nur über den Push. Die Werkstatt speichert online vorerst im Browser (localStorage); „Speichern = Commit“ kommt wie bei NomadTactics über `worker/index.js`, Cloudflare Access und das Geheimnis `GITHUB_TOKEN` im Dashboard.

## Stand

- 07.11.2026: Bereich „Assets“ (Galerie, Vorschauen, `look` an allen Entitäten), Fidelity 1920×1080 / Kachel 64 / Leyla 256 px.
- 07.11.2026: Leyla idle (8 Frames, KI) als erstes Sprite, Character Sheet als Referenz.
- 07.11.2026: Repo-Gerüst, Werkstatt mit 21 Bereichen in 6 Gruppen (jetzt 22 in 7), Beispieldaten (Platzhalter nach Gefühl), `ng`, Tests. Das Spiel selbst (Phaser 3) kommt mit dem MVP „Movement & Kampf“.
