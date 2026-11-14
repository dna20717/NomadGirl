# Backlog: offene Punkte, technische Schulden, Relikte

Stand: 12.11.2026 abends (Durchsicht von Ava). Kleinigkeiten sind schon behoben (unten „Erledigt bei der Durchsicht“), der Rest wartet auf Daniels Entscheidung.

## A. Entscheidungen, die Daniel treffen muss

**Entschieden 12.11.2026 abends (Daniel):** A1 machen (Funkbuch #002) · A2, A3 erstmal so lassen · A4 Abspann, danach offenes Spiel mit AvA als spielbarer Figur (design.md) · A6 ja, 2.400 kg bleiben · A7 keine der beiden Fassungen: ein **Trophäenraum im Cyberpunk-Stil** (Funkbuch #003). Offen: A5, A8.

| # | Thema | Worum es geht | Vorschlag Ava |
|---|---|---|---|
| A1 | **CLAUDE.md ist 184 KB groß** | Jede Sitzung lädt die ganze Datei (grob 50.000 Tokens), bevor die Arbeit beginnt. Der Großteil ist Feature-Beschreibung und Verlauf („Stand“). | Aufteilen: CLAUDE.md behält Regeln, Ordner, Tests und Kurzregeln (≈ 15 KB); die Feature-Abschnitte ziehen nach `docs/features/*.md` (Leyla, Kampf, Camp, Rig, POIs, Inventar, Progression …), der Verlauf nach `docs/changelog.md`. |
| A2 | **17 Assets ohne Verwendung** (≈ 2,7 MB) | Alte Fassungen, die wir bewusst behalten haben: `leyla_idle` (hochaufgelöste Idle), `wasteland_sky/far/ledge/near` (alte Startseite), `drone_moods` (alte Drohne), `van_v1`, `leyla_flip_side` (alter Salto), `container_stack`, `ws_warroom_table`, `ws_metal_bench`, `ws_chill_area`, `ws_food_kitchen`, `ws_drone_bench`, `ws_sleep_bunk`, `ws_generator_bench`, `ws_treasury_v1`. | (a) in einen Ordner `assets/_archiv/` verschieben und in der Werkstatt als Art „Original“ führen, (b) löschen (Git behält sie in der Geschichte), (c) so lassen. Ava empfiehlt (b). |
| A3 | **Rohmaterial im Repo** (≈ 2,4 MB) | Rohframes von PixelLab: `workshops/cryotank/source/` (59 Dateien, 2,1 MB), `tiles/tileset00/candidates/`, `leyla/*_source.png`, `techtree/source/`. Gebraucht nur, wenn wir die Streifen neu schneiden. | Behalten (Skripte brauchen sie). Falls das Repo zu groß wird: auslagern. |
| A4 | **Heilmittel-Knoten** | Steht im Techtree (30 Bio, 20 Wissen, 20 Technik), hat aber keine Wirkung. | Endziel mit kleinem Abspann, danach geht das Spiel weiter. |
| A5 | **„Dunkelheit“** | Ressource ist angelegt (versteckt, „Mehr je Stufe“ 50 %), ohne Wirkung. | Als Schwierigkeitsstufe beim Plündern wählbar machen. |
| A6 | **Van-Zugkraft 2.400 kg** | Wegen des Tank-Containers erhöht (vorher 1.500), sonst war der Start „zu schwer“. | Bestätigen oder den Tank-Container leichter machen. |
| A7 | **Schatzkammer-Fassung** | Neu: Palette mit Tasche voller Scheine. Alternative `ws_treasury_alt` (festgezurrte Palette). | Daniel wählt. |
| A8 | **Kosten im Techtree, Tank-Tempo** | Alles Platzhalter-Werte (Tank ohne Pflege ≈ 10 Tage). Erst nach dem Anspielen sinnvoll. | Anspielen, dann justieren. |

## B. Offene Features (aus CLAUDE.md und design.md gesammelt)

- **Foodtruck:** „Verkaufen kommt später“ (Werkstatt ohne Funktion).
- **Zugmaschine tauschen** im Bau-Modus fehlt (Van ↔ LKW).
- **Gegner:** Boss-Verhalten Hausmeister, Gruppen-Alarm, echte Gegner-Grafiken (alle Gegner sind noch Platzhalter aus Code); To-do **Gegnerbaukasten für Sprites** (design.md, noch zu definieren).
- **Companions** sind noch Figuren aus Code ohne Aussehen.
- **AvA:** Akku aus einem Drohnenteil (Kern), Tastatur-Steuerung für das Gummiband (heute nur rechter Stick), wie man Anbauteile freischaltet.
- **Kachel-Sets:** Vorschau eines Sets in der Werkstatt, großer Clutter für Wüste und Ruine.
- **Licht:** Lichtstrahlen (God Rays), Schatten/Verdeckung, Stromausfall-Event per Schalter.
- **Waffen:** Gewehr in Kletter-/Sprung-Animationen malen (statt Bild auf dem Rücken), weitere Langwaffen per „Posen von“.
- **Web-Werkstatt:** Bilder hochladen geht online noch nicht (`cloud_store.js`).
- **design.md, offene Fragen:** Ranking-Bonus pro Rang, was macht die Zelle im Rig, das „vielleicht noch Gefährlichere“, Feinschliff nach dem ersten Anspielen.
- **Ressourcen verdienen:** design.md nennt Ressourcen für Kisten, Kills, Secrets, Kochen, Bauen, guten Rang. Gebaut sind bisher Zerlegen und der Tresor.

## C. Technische Schulden

| # | Stelle | Problem | Aufwand |
|---|---|---|---|
| C1 | CLAUDE.md | siehe A1 | mittel |
| C2 | `tools/pad_test.mjs` Gummiband | Bei halbem Stick landet AvA manchmal bei 187 px statt ≈ 290 px. Ursache nicht gefunden; die Prüfung ist gelockert (> 40 % der Reichweite). Im Spiel nicht aufgefallen. | klein bis mittel |
| C3 | Camp im kopflosen Browser | Chrome meldet einmal „GPU stall due to ReadPixels“. Eine Leselücke ist behoben (`backdrop.js`); die Meldung kommt wohl von einer Stelle, die eine WebGL-Textur zurückliest. Nur Leistung, kein Fehler. | klein |
| C4 | `anim_audit.mjs` | Ein Fall bleibt: Dash um Dash gegen eine Wand lässt kurz „Stehen“ aufblitzen. | klein |
| C5 | Container-Stauraum im Code | Deichselkästen sind raus, der Code (E-Punkt, Umzug der Raster `rig:<n>`) bleibt, falls Stauraum an Containern zurückkommt. `test/stack.test.js` gibt dem 20-Fuß-Container dafür im Test Stauraum. | – (bewusst) |
| C6 | Gemeinsamer Kern | `game/ui.js` (`showMenu`, `askText`, `uiColor`), `icons.js` (`ICON_NAMES`), `browser_loader.js` (`asCanvas`) haben unbenutzte Exporte: Kopie aus NomadTactics, bewusst gleich gehalten. | – |
| C7 | Unbenutzte Exporte | `weatherDefaults` (weather.js), `AREAS_WITH_THINGS` (inventory.js), `DRONE_SLOTS`, `RANKING_CATEGORIES` (schema.js). Harmlos, beim nächsten Umbau mitnehmen. | klein |
| C8 | ~~Große Dateien~~ erledigt (#017): `camp.js` 1.437 → 1.100 (+ `camp_life.js`, `camp_actions.js`), `scene.js` 1.088 → 752 (+ `scene_runs.js`, `scene_events.js`), `leyla.js` 1.057 → 539 (+ `leyla_moves.js`, `leyla_combat.js`); Methoden-Bündel werden in die Klasse eingehängt (Ende der Hauptdatei), Code unverändert. Altes Problem: | `camp.js` und `leyla.js` je ≈ 1.000 sehr lange Zeilen, `scene.js` ≈ 850. Lesbar, aber Kandidaten zum Aufteilen (Camp: Zeichnen/Hotspots/Menüs; Leyla: Bewegung/Kampf/Aussehen). | mittel |
| C9 | Test-Fixtures | Rig-Tests spielen mit einer festen alten Aufstellung (`classicRig`, `furnishedStart`, Tank aus). Gut für stabile Tests, prüft aber nicht Daniels aktuellen Start. | – (bewusst) |

## Erledigt bei der Durchsicht (12.11.2026)

- `tools/_poi_shots.mjs` gelöscht (liegengebliebenes Hilfsskript, nirgends benutzt).
- `relearn` aus `game/techtree.js` entfernt (unbenutzt, `newCycle` macht das selbst); ein toter Aufruf `this.tankMods?.()` in `scene.js` raus.
- Camp-Texte „Das Lager füllt sich mit Schritt 2“ und „Chillen gibt bald einen Buff“ ersetzt (veraltet).
- Werkstatt: **Camp › Heilen › k.o. im Run** (Run-Start oder wie früher ins Camp) und **Cryo-Tank › Traum** (Zeilen, Dauer) sind jetzt einstellbar; vorher standen die Werte nur im Code.
- Prüf-Hinweis „Fettiger Notizzettel: Zerlegen bringt mehr als Verkaufen“ behoben (Wert 2 Δ), `ng check` meldet jetzt „Alles stimmig“.
- `backdrop.js` liest sein Pixel mit `willReadFrequently` (weniger GPU-Bremse).
- CLAUDE.md: veraltete Stellen korrigiert (Deichselkasten, Staufach, Goldhaufen, „Neues Spiel“, Tod im Run, Kiste „vorerst leer“, Test-Zahlen von craft/poi/tank/techtree, Controller-Belegung vom 10.11.).
- design.md: Progression als gebaut markiert, Leyla-Animationen abgehakt, Techtree-Frage präzisiert.
- Konsolen-Durchlauf (Camp, Run, Testraum, Kampfraum, Bunker, Ministerium, Werkstatt, Startseite): keine Fehler.
