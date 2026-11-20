# Backlog: offene Punkte, technische Schulden, Relikte

Stand: 20.11.2026 (Aufräumen #125). Frühere Durchsichten: 12.11. und 16.11. (unten). Offene Aufträge stehen als Tickets im Funkbuch (`docs/funk.md`), hier nur, was (noch) kein Ticket hat.

## A. Entscheidungen

Alle Punkte aus A1–A8 sind entschieden (12.11. und 19.11.2026): A1 erledigt (#002), A2/A3 bleiben so, A4 Abspann + offenes Spiel, A5 → Skilltree Dunkelheit (#080), A6 2.400 kg, A7 Trophäenraum (#003), A8 Balancing versioniert (#081/#097, v2 = #109).

**Neu offen (20.11.2026):**

| # | Thema | Worum es geht | Vorschlag Ava |
|---|---|---|---|
| A9 | ~~Spielstand-Plätze~~ | gebaut in #126 | offen daraus: Konflikt-Schutz im Worker (409), Offline-Puffer, Export/Import (Frage I: später) |
| A10 | **Cockpit-Reste** (#123/#124) | Fahrer-Sonnenblende `ck_visor` und 10 Kram-Stücke liegen fertig im Bereich Assets, sind aber nicht platziert; das Billboard steht links, weil die Sonnenblende rechts verdeckt | Daniel platziert nach Geschmack in Startseite › Cockpit (Vorschau zeigt jetzt das Cockpit) oder sagt „Ava, setz sie“ |
| A11 | **Billboard-Werbung für Lore-Marken** im Cockpit | Idee aus #124 | in den Ideenspeicher oder Ticket |

## B. Offene Features ohne Ticket

- **Zugmaschine tauschen** im Bau-Modus (Van ↔ LKW) fehlt; heute wechselt die Zugmaschine nur über Bergung und Mega-Rig (`swapTractor`).
- **Companions** sind noch Figuren aus Code ohne Aussehen (Daniel 19.11.: später).
- **AvA:** Akku aus einem Drohnenteil (Kern), wie man Anbauteile freischaltet.
- **Kachel-Sets:** Vorschau eines Sets in der Werkstatt, großer Clutter für Wüste und Ruine.
- **Waffen:** weitere Langwaffen per „Posen von“.
- **design.md, offene Fragen:** Ranking-Bonus pro Rang, das „vielleicht noch Gefährlichere“, Feinschliff nach dem ersten Anspielen.
- **Grafiken für weiterentwickelte Werkstätten** (Daniel 15.11., #034): je Ausbaustufe ein eigenes Bild (PixelLab, streng frontal, gleiche Box).
- **Camp-Grafik aus Code** (Daniel 19.11.: „streichen wir das für jetzt“): Rest-Stücke ohne Bild; mit #111 sind viele hybrid neu gemalt, siehe `docs/features/camp.md` › Camp-Baukasten.
- **Fahrgestell `trailer_chassis` und Camp-Boden** noch grob (gehört zu Ticket #084).

Erledigt bzw. gestrichen seit dem 16.11.: Foodtruck-Theke mit Kunden (#013), Rattenschwarm und Wachdrohne gestrichen (#108), Zelle (#079), Licht (#082), Bild-Upload (#083), Werkstatt-Stufen (#078).

## C. Technische Schulden

**Abgearbeitet am 20.11.2026 (#125):**

| # | Stelle | Wie gelöst |
|---|---|---|
| C2 | Gummiband im `pad_test` | Kein Fehler im Spiel: die Totzone lässt von halbem Stick ≈ 0,4 übrig, und AvAs Ruheplatz hinter Leyla mischt sich mit (1 − Neigung) ein, daher 187 px. Ausreißer beim vollen Stick kamen vom freien Herumfliegen im Camp (bis 3.500 px weit weg). Test rechnet jetzt das exakte Ziel und startet AvA nah: wieder streng. |
| C3 | „GPU stall due to ReadPixels“ | Deko-Höhe liest ein Bild in einem Zug statt pixelweise; Ladebild, Mega-Rig-Ansicht und Gegner-Bausatz lesen auf der CPU. Die übrigen Meldungen stammen aus Phaser, das Canvas-Texturen (Schrift, Kacheln) in die Software-Grafik des kopflosen Browsers lädt; im echten Browser mit GPU nicht relevant. |
| C4 | `anim_audit` Dash gegen Wand | Ein Dash zählt jetzt als Bewegung für „Stehen erst nach“; Audit sauber. |
| C10 | Umbenennen ↔ Spielstände | Protokoll in **Grundlagen › Umbenennungen** (`data/renames.json`), Spielstände ziehen beim Laden mit (`followRenames`), Test `test/renames.test.js`; `docs/features/editor.md`. |
| C11 | Farben in `play.css` | 578 feste Farben laufen über 27 Tokens `--ng-*` (eigene Spielpalette, getrennt von den `--ui-*`-Themes der Werkstatt). Rückwärts eingesetzt ergibt sich exakt die alte Datei. Seltene Farben (196 verschiedene, je 1–4× benutzt, zusammen 321 Stellen) bleiben direkt: eigene Tokens lohnen sich dafür nicht. |
| C13 | Herstellen → Zerlegen | Werkstatt warnt, wenn Zerlegen eines Ergebnisses alle Zutaten zurückgibt (Endlos-Quelle); heute kein Fall. Tausch-Wege (Schrott → Technik) bleiben gewollt. |
| C14 | Deko/Synergie | Dach-Deko unter einem aufgestapelten Container geht ins Lager (nur der überbaute Teil, `roofCovered`); Synergie-Nachbarn stimmen auch für Stapel ab Höhe 3. |
| C15 | Mega-Rig | Lichterketten des Camps kommen beim Einsteigen mit Δ zurück (wie Abhängen); ein E-Punkt `benchSpot` für Rig und Mega-Rig. |
| C18 | Alte Bilder | Lektion „Das Camp-Lager“ neu aufgenommen (Kofferraum); Aufnahmen ohne Kassette und Meldungen. Fahrgestell/Camp-Boden → #084. |
| – | Cockpit | `cockpit.glass` im Schema (Startseite › Cockpit › Scheibe), Werkstatt-Vorschau zeigt Cockpit und Klassisch. |
| – | `ng check` | „Entity“-Hülle zählt nicht mehr als ungenutzter Gegenstand: „Alles stimmig“. |

**Bewusst so gelassen:**

| # | Stelle | Warum |
|---|---|---|
| C5 | Container-Stauraum im Code | bleibt, falls Stauraum an Containern zurückkommt |
| C6 | Gemeinsamer Kern | unbenutzte Exporte aus NomadTactics, bewusst gleich gehalten |
| C9 | Test-Fixtures | feste alte Aufstellung für stabile Tests |
| C12 | Zufallsfunktionen | eine gemeinsame würde alle gewürfelten Level, Karten, Wracks verändern |
| C16 | Toter Spielstand (`save.log`, `dreams`, `base` …) | harmlos, `dreams`/`base` für später |
| A2/A3 | 17 alte Assets, Rohmaterial | Daniel 12.11.: erstmal so lassen |

Früher erledigt: C1 (#002), C7, C8 (#017), C17, C19.

## D. Ideenspeicher (Daniel, 18.11.2026: „Alle deine Vorschläge kommen in den Ideenspeicher“)

Ideen ohne Auftrag. Wer eine angeht, macht daraus ein Ticket im Funkbuch und streicht sie hier.

- **Straßen-Ereignisse:** zwischen zwei Orten der Reisekarte passiert etwas (Anhalter als künftige Crew, Händlerkonvoi, Hinterhalt, Wrack zum Bergen, wilde Entity im Funkmast).
- **Crew-Kern Teil 2 (#040):** Rig-Moral, Siedler mit Figur im Camp (Teil 1 gebaut als #085).
- **Fahndungsstufe:** jede gefangene Entity macht die Kammerjäger aufmerksamer; ab einer Stufe jagen sie Leyla im Run (Duell oder echte Gegner).
- **Bit-Stapel in der Kneipe:** NPCs spielen um Einsätze (Teile, Rezepte, Gerüchte über POIs).
- **Entities mit Camp-Jobs:** Entities im Deck steuern Werkstätten, ihr Charakter färbt die Arbeit (die Diva schlampt, der Bürokrat sortiert).
- **Fotomodus:** AvA als Kamera, Rig und Camp festhalten und teilen.
- **Täglicher Run:** ein Tages-Seed für alle mit Ranking.

### Aus der Verzahnung (#057–#071, Daniel 18.11.2026: „Liste Synergien und Systeme auf, die auf diese Weise entstanden sind und das Gameplay ergänzen könnten“)

Schon entstandene Kreisläufe (zum Ausbalancieren und Erzählen):
- **Schatzsuche-Kreislauf:** Straßen-Geschichte → Kartenstück → Onkels Quest → Händler (Merker) → Silo Zero → Titan Lullaby gefangen → als Navigator-Worker in der Bit-Farm (weniger Sprit) → mehr Reisen.
- **Ruf-Kreislauf:** Antworten heben Ruf → Revier-Camp (Frieden, Handel, Auftrag) → Revier-Handel mit Ruf- und Influencer-Rabatt → Klauen kostet Ruf → Kopfgeldjäger.
- **Crew und Rig öffnen die Straße:** jede Werkstatt, jedes Implantat, jeder Companion bringt neue Antworten (Ripperdoc versorgt Verletzte → Ruf).
- **Duell-Kreislauf:** Implantate (Duell-Integrität) → mehr Siege → mehr Entities → Worker → bessere Werkstätten.
- **Wetter-Kreislauf:** Regen → Zisterne → Garten (Gärtner) → Kochen (Koch: perfekt) → stärkere Buffs → Run im Regen (Gegner hören schlechter).
- **Marken-Kreislauf:** Billboard → Influencer → Markenstand → Set-Bonus → Marken-Build.

Neue Systeme, die daraus wachsen könnten:
- **Influencer-Karriere:** viele Billboard-Tipps → Follower-Stufe → Sponsor-Pakete einer Marke, Ärger mit der Konkurrenz-Marke.
- **Lieblingsmarken der Gangs:** wer die Marke einer Gang trägt (Markentreue), startet mit mehr Ruf bei ihr.
- **Hochform:** bestimmte Kombinationen in der Effekt-Leiste (perfektes Gericht + Gemütlich + Influencer) geben einen Bonus-Effekt.
- **Bindung 5:** eine treue Entity hilft im Duell mit einem Spezialzug; wer sie lange nicht besucht, verliert Bindung.
- **Logbuch als Chronik:** Leyla kommentiert Einträge; am Ende eines Durchgangs ein Comic-Rückblick mit der Intro-Engine.
- **Märkte:** Angebot und Preise je Ort, der Influencer verschiebt die Nachfrage, der Foodtruck verkauft im Revier-Camp.
- **Companions reden über die Welt:** Sprüche nach Merkern, Crew und Wetter (dieselbe Bedingungs-Sprache).

## Erledigt bei der Durchsicht (16.11.2026, Daniel: „keine unsichtbaren technischen Schulden … nichts kaputt machen“)

Automatische Prüfungen (Exporte, Mixin-Kollisionen, Felder ohne Wirkung, Daten ohne Feld, Listener, Speicher-Zugriffe, Docs-Verweise, Assets, Build) und drei unabhängige Lese-Prüfungen (Mega-Rigs, Deko/Synergie/Ressourcen/POI-Stapel, Spielstand). Repariert, jeweils mit Test:
- **Einheiten-Nummern** (`game/reindex.js`): verlässt eine Einheit das Rig außerhalb des Bau-Entwurfs (Spielstand-Reparatur, Mega-Rig ordnet sich, Aussteigen), ziehen Lager-Raster, Lichterketten, Deko, Mega-Lichter, Garten/Zisterne/Gießen mit; Lager der Einheit, die geht, werden in Kiste/Kofferraum/Bündel am Van gerettet statt verloren. Auch Werkstätten, die es nicht mehr gibt, verlieren ihren Inhalt nicht mehr. Beim Umbauen zieht Hydrokultur/Zisterne mit ihrer Werkstatt um.
- **Mega-Rig:** Positionen an Bord gingen bei jedem Laden verloren (die Prüfung in `settle` war umgedreht und löschte gerade die gültigen); Aussteigen ließ den Tank-Container zurück (beim nächsten Laden gab es dann zwei) und stapelte nicht, der große Kofferraum verlor beim Aussteigen, was nicht passte; Zugmaschinen-Bergung an Bord tauschte die Mega-Zugmaschine aus (jetzt in die Ladebucht); Teile der alten Zugmaschine zählten an Bord mit; gekaufte Ausbaustufe ließ sich per Rückgängig erstatten; eine kaputte Verknüpfung Mega-Rig ↔ Zugmaschine in den Daten führt jetzt zurück ins alte Rig.
- **Bau-Modus/Deko:** Rückgängig mit einem Stück in der Hand verdoppelte Deko (unbegrenzt Δ) bzw. ließ sie verschwinden; Schließen mit einem Stück in der Hand löschte es; Anker `pole:`/`balc:`/`tower:` zeigten nach dem Abnehmen auf falsche Stücke (unsichtbare, unlöschbare Zelte); jedes Kontextmenü hinterließ einen Maus-Listener.
- **Spielstand:** eine umbenannte Zugmaschine setzte das ganze Rig zurück (jetzt wird nur die Zugmaschine getauscht); möglicher Absturz am Run-Ende ohne Achievements-Daten.
- **Ressourcen:** Boss-/Kill-Ressourcen nach einem k.o. nicht mehr ein zweites Mal (einmal je Spawn und Run); `kill_anomaly` wählbar.
- **POI-Stapel:** ein Seitenraum, höher als der oberste Raum, hätte das Level abstürzen lassen.
- **Werkstatt:** Felder ohne Wirkung sind markiert (Tod, Foodtruck, Währung, POI › Leben, Paletten); `hull.bridge` und Tank-Beschreibung bearbeitbar; Deko prüft Art ↔ Platz; Datenreste (Solarpaneel-Gewicht, Rezept-Beschreibung) bereinigt; 7 tote Exporte entfernt.

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
