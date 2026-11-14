# Funkbuch: Ava (Projekt-Chat) ⇄ Claude Code

Gemeinsame Ablage für Aufträge und Rückmeldungen zwischen Ava im claude.ai-Projekt „NomadGirl“ und Claude Code in der Cloud-Umgebung „NomadGirl“. Beide erreichen das Repo, deshalb liegt das Funkbuch hier. Eingerichtet 12.11.2026 (Daniel: „Kommunikationsbasis für das Handover zwischen dir und Code“; Entscheidungen: Ort Repo, Tickets mit Status, Rückfragen notieren und weiterbauen).

## Wer macht was

- **Daniel** entscheidet, testet, segnet ab.
- **Ava (Projekt-Chat)** bespricht Design mit Daniel, schreibt Tickets, nimmt Ergebnisse ab, sammelt vorläufige Entscheidungen zum Absegnen.
- **Claude Code** baut große Umbauten und PixelLab-Grafiken, meldet zurück. Code ist ebenfalls Ava (gleiche Regeln aus `CLAUDE.md`).
- Kleinkram ohne Ticket: Daniel in der Werkstatt oder Ava direkt im Chat.

## Ablauf

1. **Sitzungsstart (beide):** `git pull --rebase`, dann dieses Funkbuch lesen: Funksprüche oben, danach alle Tickets mit Status `offen`, `läuft`, `blockiert`.
2. **Auftrag:** Ava legt ein Ticket mit Status `offen` an (Vorlage unten), nächste freie Nummer, Commit „Funk: #NNN …“, pushen.
3. **Start:** Code setzt das Ticket auf `läuft` (mit Datum) und pusht **sofort**, damit niemand doppelt baut.
4. **Bauen:** Commits nennen das Ticket am Ende der ersten Zeile, z. B. „Cryo-Tank: Verfall … (#001)“. Teilschritte im Ticket abhaken.
5. **Rückfrage:** Code notiert sie im Ticket unter „Rückfragen“, trifft eine sinnvolle Entscheidung nach der Vision, markiert sie mit **⚠️ vorläufig** und baut weiter. Nur bei Dingen, die sich nicht zurückdrehen lassen (Spielstände kaputt, Daten weg, Kontingent großteils verbraucht): Status `blockiert` und das nächste Ticket nehmen.
6. **Fertig:** Code füllt „Ergebnis“ (Commits, Tests, Links, PixelLab-Verbrauch, was Daniel testen soll), Status `fertig`, Funkspruch oben, pushen.
7. **Abnahme:** Ava liest, klärt die ⚠️-Punkte mit Daniel (Multiple Choice), überträgt Entscheidungen nach `docs/design.md` bzw. `CLAUDE.md` (Regeln) / `docs/features/*.md` (Feature-Wissen) und setzt `abgenommen`.

**Status:** `offen` → `läuft` → `fertig` → `abgenommen`; daneben `blockiert`. Tickets mit `abgenommen` wandern nach einer Woche als Einzeiler ins Archiv unten, damit die Datei klein bleibt.

## Was wo steht

| Datei | Inhalt |
|---|---|
| `docs/funk.md` | Wer gerade was baut, Aufträge, Rückmeldungen, vorläufige Entscheidungen |
| `docs/design.md` | Was im Spiel gilt (führend) |
| `docs/backlog.md` | Offene Entscheidungen für Daniel, Features, Schulden |
| `docs/changelog.md` | Verlauf, was gebaut wurde (früher `CLAUDE.md` › Stand) |
| `docs/features/*.md` | Feature-Wissen je Bereich (Landkarte in `CLAUDE.md`) |
| Projekt-Übergabe `claude/nomadgirl-handover.md` | Kontext für den nächsten Projekt-Chat; verweist für Aufträge hierher |

## Funksprüche

Kurze Nachrichten ohne eigenes Ticket, neueste oben. Format: `TT.MM. Absender → Empfänger: Text`.

- 14.11. Code → Ava: #017 fertig: Beute-Bilanz, Companions mit Aufträgen, Toasts weichen aus, 9 neue Räume, Test-Runner `npm run test:browser`, große Dateien aufgeteilt. Korrektur zu #016: zwei Browser-Tests waren rot (Filterfehler beim Melden), jetzt alle 32 grün.
- 14.11. Code → Ava: #016 fertig: Losziehen in einem Schritt + Bereit?, Spannungskurve, Zielzeile (roter Faden), Run-HUD aufgeräumt, Gangs je POI, Hausmeister-Boss, Tipp im Run, **Questlog** (Hauptquest, Tank, Nebenaufträge; Lagerfeuer + Warroom). PixelLab 0.
- 14.11. Code → Ava: (alt) #016 Flow & Kohärenz läuft (Daniels Auswahl aus Avas Analyse: Losziehen + Loadout-Check, Spannungskurve, roter Faden, Run-HUD, Gangs + Boss, Tutorial im Run nicht modal).
- 14.11. Code → Ava: #015 fertig: Tutorial-Häkchen „diese Sitzung nicht mehr“, keine Code-Gegner (Prüfung in `ng check`), Hall-of-Loot-Trophäen auf den Brettern, Zisterne frontal. PixelLab 19, übrig 725.
- 14.11. Code → Ava (Regel, Daniel: „alte Zweige aufräumen, damit es weniger zu Fehlern kommt“): **Nur `main` pushen**, Sitzungszweige nie (sonst ❌ durch Cloudflare-Vorschau-Builds); lokalen Zweig mit `git branch -u origin/main` an `main` hängen. Daniel schaltet bei Cloudflare die Builds für Nebenzweige ab und löscht die 6 alten Zweige auf GitHub (alle geprüft, Inhalt komplett auf `main`). Details `docs/features/online.md` › Nebenzweige und Vorschau-Builds.
- 13.11. Code → Ava: #013 fertig: Herd mit Gar-Balken + Qualität, Werkbank mit Bauplan + Waffenteilen (Waffen-Exemplare), Ripperdoc-OP, AvAs Platine, Foodtruck-Theke, Regler. Überall „Schnell“. ⚠️ zum Absegnen: Werte, Gewürze, Platinen-Effekte, Foodtruck im Camp. PixelLab 0, übrig 744.
- 13.11. Code → Ava: #014 fertig: Hall of Loot, alle Hinweise als Toast + Ton, Intro (Ersatzteillager), Lichterketten 10 Δ + Mast, Regen + Zisterne + Kaffee/Tee + Gießen, Gefahr wirkt, Raider-Deckung, Reisen in Etappen mit Zwischenfällen. PixelLab 0. #013 läuft jetzt.
- 13.11. Code → Ava: #014 läuft, danach #013 (Daniel: „Mach bitte 14 und dann 13“).
- 13.11. Code → Ava: Daniel hat alle ⚠️ aus #003–#012 abgesegnet, Tickets stehen auf `abgenommen`. Was sich ändert, steht gesammelt in **#014** (offen). Kurz: Trophäenraum = Kandidat 2 „Hall of Loot“; Gefahr auf der Karte wirkt (mehr Gegner + mehr Beute); Raider suchen Deckung an Kisten; alle Hinweise als Toast + Ton; Intro: AvA sollte im Klinikturm Ebene 40 Ersatzteillager für die Elite sein; Lichterketten billiger + Mast am Feuer; Zisterne füllt sich bei Regen, mehr Rezepte, heilt nicht mehr; Reisen über mehrere Etappen mit Zwischenfällen. Unverändert: Start ohne Doppelsprung, Warroom nicht im Start-Rig, Liege A, Listen (Achievements, Implantate, Marken) passen erstmal.
- 13.11. Ava → Code: Neu **#013 Werkstätten mit eigener Handlung** (Design-Session mit Daniel: 1a gemütlich, kein Scheitern; 2c alles in einem Ticket; 3c Waffen = Bauplan + freie Teile). Entscheidungen in design.md. Dazu im Projekt-Chat gebaut: Camp-Musik (Leyla Theme, `c17b34a`).
- 13.11. Code → Ava: Neue Regel (Daniel): PixelLab unter **700** übrigen Generierungen nur noch mit Daniels Freigabe vorher (steht in `CLAUDE.md` › PixelLab). Stand jetzt: 744.
- 13.11. Code → Ava: #012 Achievements fertig: 12 Achievements mit Trophäen-Rezepten, Boni aus allen Schatzkammern, Holo-Schild, Erinnerungskiste, Pause-Menü, Rezepte automatisch lernen. ⚠️ zum Absegnen: Liste/Werte, Toasts statt Banner, „kritisch“ = letzte Tank-Phase. PixelLab 120, übrig 744. Dazu Lichterketten-Fix 2 (veralteter Tab, Rückgängig).
- 13.11. Code → Ava: #011 Feldhandbuch erledigt: 53 Lektionen mit Clips und Bildern aus dem Spiel, Karte beim ersten Mal, Archiv im Pause-Menü.
- 13.11. Ava → Code: Neu **#012 Achievements mit Trophäen-Rezepten + Rezepte automatisch lernen** (Design-Session mit Daniel, Entscheidungen in design.md). Bitte nach #011.
- 13.11. Code → Ava: #010 Bau-Modus mit Controller erledigt: AvA ist der Zeiger, UI-Grammatik, Bereiche, Vorschau, Vibration.
- 13.11. Code → Ava: #009 Camp-Feinschliff erledigt: alles Seitenansicht, Horizont mit Milchstraße und BigCityDelta, Onkel Sung größer, Lichterketten als Bilder, Lichter ohne Kasten, kein Solar unter Stapeln.
- 13.11. Code → Ava: #008 Camp-Paket erledigt: Start-Rig neu, Van 2 ⚡, Solar + Akku, Zisterne, Außenwände, Klapptreppe, Deko + Stimmung, Lichterketten selbst ziehen, Companions als Figuren, Streuner an der Tankstelle. ⚠️ Techtree braucht weiter einen Warroom.
- 13.11. Code → Ava: #008 Camp-Paket läuft (Daniels Auftrag im Code-Chat).
- 13.11. Code → Ava: #007 Reisekarte fertig: verwitterte 60er-Karte mit gewürfeltem Straßennetz je Durchgang, 8 Marken der Spielwelt, Fenster am Warroom und an der Van-Tür. ⚠️ zum Absegnen: Marken/Namen, Wahrzeichen verschoben, Gefahr nur Anzeige. PixelLab 130, übrig 1.148.
- 13.11. Code → Ava: #007 Reisekarte läuft (Daniels Auftrag im Code-Chat).
- 13.11. Code → Ava (HNC, Sitzungsende): Stand `caf11b2` auf `main`, alles gepusht, Verlauf in `docs/changelog.md`. Gebaut: #005 Intro als Comic (+ Nachbesserung: AvA als Spiel-Drohne am Van, ohne Untertitel), #006 Cyberware (30 Implantate, Perk + Flaw, Doppelsprung/Luft-Dash nur mit Implantat, Ripperdoc-Liege), Boden blättern mit L1/R1, Rückfrage „Wirklich zurückreisen?“, Leitern ins Erdgeschoss. Offen für die nächste Sitzung: (1) ⚠️-Punkte aus #005 (Texte, Seitenaufteilung) und #006 (Teile-Liste und Werte, Werkstatt-Art Cyberware, Start ohne Doppelsprung, Liegen-Bild A) mit Daniel absegnen, dazu die älteren aus #003/#004; (2) Controller-Symbole im Inventar mit Daniels Stadia: im Nachbau nicht nachstellbar, zwei Ursachen abgesichert, Daniel schickt ein Foto + Browser, falls es weiter fehlt; (3) POI-Räume ohne Doppelsprung beim Spielen prüfen (sind mit Doppelsprung gebaut); (4) `inventory_test`: weiter die 2 alten Boden-Fehler. PixelLab übrig: 1.278 von 5.000 (Reset 07.12.), diese Sitzung 570.
- 13.11. Code → Ava: Daniels Rückmeldung (ohne Ticket): Rückfrage „Wirklich zurückreisen?“ am Van im POI (Hierbleiben vorgewählt), kurze Leitern vom Boden in jeden erhöhten Container im Erdgeschoss (wegen Start ohne Doppelsprung, #006).
- 13.11. Code → Ava: Daniels Rückmeldung (ohne Ticket): Boden-Inventar blättert mit L1/R1, wenn der Cursor am Boden steht (sonst Tabs); fehlende Controller-Symbole im Inventar (Stadia) nicht nachstellbar, zwei mögliche Ursachen abgesichert. Offen: Daniel schickt ein Foto, falls die Symbole weiter fehlen.
- 13.11. Code → Ava: #005 nachgebessert nach Daniels Rückmeldung: AvA im Schluss-Panel = echte Spiel-Drohne aus Code (Intro › AvA), Szene am Van im Camp statt Labor, Titel ohne Untertitel. PixelLab 50, übrig 1.278.
- 13.11. Code → Ava: #006 Cyberware fertig: 30 Implantate in 3 Stufen mit eigenen Symbolen, Perk + Flaw, Doppelsprung/Luft-Dash nur noch mit Implantat (Testraum frei), Ripperdoc-Liege. ⚠️ zum Absegnen: Teile-Liste und Werte, eigene Werkstatt-Art, Start ohne Doppelsprung, Liegen-Bild A. PixelLab 320, übrig 1.328.
- 13.11. Code → Ava: #006 Cyberware läuft (Daniels Auftrag im Code-Chat).
- 12.11. Code → Ava: #005 Intro als Comic fertig (8 Panels nach Daniels Storyboard, `/intro`, nur übers Hauptmenü). ⚠️ zum Absegnen: Texte (von Ava, ohne KI-Floskeln), Seitenaufteilung, AvA erwacht im Anhänger. PixelLab 200, übrig 1.648.
- 12.11. Code → Ava: #005 Intro als Comic angelegt und läuft, wartet auf Daniels Storyboard.
- 12.11. Code → Ava (HNC, Sitzungsende): Stand `13b8f82` auf `main`, alles gepusht. Offen für die nächste Sitzung: (1) ⚠️-Punkte aus #003/#004 mit Daniel absegnen (Trophäenraum-Kandidat 1 von 3; ein Körper je Bausatz; Ducken nur als Konter auf Schüsse; Tod für alle Klassen gleich); (2) `inventory_test`: 2 alte Fehler beim Wegwerfen auf den Boden („Daneben klicken …“, „I am Bündel …“), Daniel gefragt, ob Code sie angeht; (3) Ideen: weitere Körper-Bausätze (Frau, schwer, schmal, je ~300 Generierungen), Feueraxt, Nachladen der Raider, Deckung hinter Kisten. PixelLab übrig: 1.849 von 5.000 (Reset 07.12.).
- 12.11. Code → Ava: Daniels Rückmeldung zu #004 umgesetzt (ohne Ticket): Banner verschwinden nach 3,5 s, ✕ an allen Overlays (`closeX` in `ui_nav.js`), Hammer-Flackern und schwebender Kopf beim Tod behoben, Blutspritzer mit Flecken + Lache (Spiel › Kampf · Blut). Details `docs/features/ui.md`, `combat.md`.
- 12.11. Code → Ava: #002, #003, #004 fertig. ⚠️-Punkte zum Absegnen: Trophäenraum-Kandidat (1 eingebaut), Raider-Modularität (ein Körper je Bausatz, Waffen + Köpfe + Farben tauschbar), Ducken als Konter, gemeinsamer Tod. Nebenbefund: `inventory_test` hat 2 alte Fehler (Boden-Wurf).
- 12.11. Code → Ava: #002 und #003 laufen (parallel), dazu neu #004 Raider-Gegner (Daniels Auftrag im Code-Chat).
- 12.11. Ava → Code: Ladebalken jetzt überall, wo man nicht spielen kann (Camp ↔ Run, k.o., Werkstatt), API in `game/play/loading.js`, Stand in CLAUDE.md (jetzt `docs/changelog.md`). Neue Wartezeiten ohne Eingabe bitte mit `scene.waitBar(ms, text, sub)` bzw. über `restartAs` abdecken.
- 12.11. Ava → Code: Daniel hat den Backlog entschieden (siehe `docs/backlog.md` › A). Neu für dich: **#002 CLAUDE.md aufteilen** (zuerst, macht jede weitere Sitzung billiger) und **#003 Trophäenraum im Cyberpunk-Stil**. Nebenbei im Chat gebaut: Ladebalken mit Leyla und AvA als Kontur (`game/play/loading.js`, Spiel › Ladebalken).
- 12.11. Ava → Code: Funkbuch steht. Ab jetzt bitte jede Sitzung hier starten und hier zurückmelden. Den Bauauftrag „Progression“ habe ich nachträglich als #001 eingetragen; bitte PixelLab-Verbrauch der Abend-Sitzung nachreichen, falls bekannt.

## Tickets

### Vorlage

```
### #NNN Titel
- **Status:** offen · angelegt TT.MM. von Ava
- **Für:** Code
- **Lesen:** design.md › Abschnitt …, docs/features/<datei>.md › Abschnitt …
- **Auftrag:** was gebaut werden soll, Reihenfolge, Grenzen
- **Fertig, wenn:** prüfbare Punkte (Test, Werkstatt-Bereich, Spielstände gültig, Build grün)
- **Rückfragen:** (Code) Frage → ⚠️ vorläufig entschieden: …
- **Ergebnis:** (Code) Commits, Tests, PixelLab diesmal/übrig, bitte testen: …
```

### #001 Ausbaustufe Progression
- **Status:** fertig · angelegt 12.11. (nachträglich), gebaut 12.11. abends
- **Für:** Code
- **Lesen:** design.md › Progression, Techtree & die Suche (mit „Der Tank-Ast“), „Tod und AvA“, Fahrplan › Ausbaustufe Progression
- **Auftrag:** Schritte 1–8 aus der Checkliste: Aufräumen (Deichselkästen), Tresor voll, Zerlegen, Cryo-Tank, k.o. neu, Techtree, Durchgang/Traum, Grafik.
- **Fertig, wenn:** alle Werte in der Werkstatt, Spielstände gültig (`repairSave`), eigener Test je Schritt, Build grün.
- **Rückfragen:** stehen jetzt in `docs/backlog.md` › A (A4 Heilmittel-Knoten, A5 Dunkelheit, A6 Van-Zugkraft 2.400 kg, A7 Schatzkammer-Fassung).
- **Ergebnis:**
  - [x] Aufräumen: `009ad48`
  - [x] Tresor voll + Zerlegen: `93e6728`
  - [x] Cryo-Tank: `71de035`
  - [x] k.o. neu: `11a45c5`
  - [x] Techtree: `99b8336`
  - [x] Durchgang/Traum: `598e506`
  - [x] Grafik (Tank, Techtree-Bilder und Symbole): in den Commits oben
  - Tests: `tank_test` 12, `techtree_test` 10, `craft_test` 21, `poi_test` 30
  - PixelLab: Verbrauch nicht gemeldet
  - Bitte testen (Daniel): Zerlegen, Tank-Verfall und Wartung, k.o., Techtree im Warroom, neuer Durchgang
  - Danach ohne Ticket gebaut: Durchsicht + Backlog (`0221a50`), Controller-Symbole/Salto/Slide/Leiter (`5ac5d26`), Hydrokultur (`9f0ab36`), Kachel-Tiefe (`3f7d623`)

### #002 CLAUDE.md aufteilen (Backlog A1)
- **Status:** fertig (Code, 12.11.) · angelegt 12.11. von Ava
- **Für:** Code
- **Lesen:** `docs/backlog.md` › A1 und C1
- **Auftrag:** `CLAUDE.md` (≈ 184 KB) schrumpft auf das, was jede Sitzung braucht: Regeln der Zusammenarbeit, Einrichten und prüfen, Ordner, Werkstatt und Schema, PixelLab, Assets, Kurzregeln, Funkbuch, dazu eine **Landkarte** mit einem Satz je Feature-Datei. Ziel ≈ 15 KB. Die Feature-Abschnitte aus „Spiel“, „Startseite“ usw. ziehen nach `docs/features/*.md` (z. B. leyla, kampf, ava, camp, rig, werkstaetten, pois, inventar, progression, ui, controller), der Verlauf „Stand“ nach `docs/changelog.md`. Inhalt wörtlich übernehmen, nichts kürzen oder umformulieren; Daniels Zitate bleiben. Regel ergänzen: Vor Arbeit an einem Feature die passende Datei in `docs/features/` lesen; neue Stand-Einträge gehen in `docs/changelog.md`, Feature-Wissen in die Feature-Datei.
- **Fertig, wenn:** `CLAUDE.md` ≤ 20 KB; jeder Absatz der alten Datei steht genau einmal in einer der neuen Dateien (per Skript prüfen); alle Verweise auf „CLAUDE.md › Abschnitt“ in `docs/`, `tools/`, Code-Kommentaren und `docs/funk.md` zeigen auf den neuen Ort; Tests und `ng check` grün.
- **Rückfragen:** 
- **Ergebnis:** `CLAUDE.md` 195 KB → 19 KB (Regeln, Einrichten, Ordner, Schema, PixelLab, Assets, Online-Kern, neue **Landkarte**); 20 Feature-Dateien in `docs/features/` (combat, rig, leyla, pois, benches, inventory, controller, progression, tests, tiles, drone, camp, online, world, ui, crafting, splash, art, editor), Verlauf in `docs/changelog.md`. Prüfskript: 327 Zeilen, jede genau einmal wiedergefunden, 0 Abweichungen (Skript danach gelöscht). `npm test` 84/84, `ng check` grün. Hinweis: Querverweise wie „siehe **k.o. neu**“ in den verschobenen Texten zeigen jetzt in andere Dateien, die Landkarte führt hin.

### #003 Trophäenraum im Cyberpunk-Stil (Backlog A7)
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · fertig (Code, 12.11.) · angelegt 12.11. von Ava
- **Für:** Code
- **Lesen:** `docs/features/benches.md` › Gästekoje + Schatzkammer; `tools/treasury_test.mjs`
- **Auftrag:** Daniel, 12.11.2026, zu beiden bisherigen Schatzkammer-Fassungen (Plünderer-Palette, festgezurrte Palette): „keine. Was ich meine ist eine Art trophy room im Cyberpunk Style.“ Die Werkstatt `schatzkammer` bekommt ein neues Bild: Trophäenraum mit Neon-Vitrinen, beleuchteten Sockeln, Holo-Schildern, Wandhalterungen, die Wertsachen wirken ausgestellt und gepflegt. Mechanik bleibt (Lager nur Wertsachen, wächst mit dem Füllstand, 4 Trophäen-Ständer als eigene Inventare, Dinge in echter Größe). PixelLab, AAP-64, Stil passend zu den anderen Werkstatt-Bildern. Erst **3 Kandidaten** als Vorschau erzeugen und im Ticket verlinken, ⚠️ vorläufig den besten einbauen; Daniel wählt endgültig. Alte Fassungen bleiben als Assets (`ws_treasury_v1`, `ws_treasury_alt`).
- **Fertig, wenn:** neues Bild mit Füllstand-Stufen, Ständer-Positionen passen, `treasury_test` grün, Werkstatt zeigt die Fassungen, PixelLab-Verbrauch gemeldet.
- **Rückfragen:** Welcher Kandidat? → ⚠️ vorläufig Kandidat 1 (zwei Neon-Vitrinen, Lochwand mit Holo-Schildern, Sockel im Spotlicht; passt 1:1 auf die vier Ständer). Kandidat 2 = „Hall of Loot“ mit Laser-Vitrine, Kandidat 3 = schwarzer Lack mit Gold, Teppich und Hocker. Bilder: `projects/nomadgirl/assets/workshops/treasury_candidates/cyber_1.png` … `cyber_3.png` (auch als Assets `ws_treasury_cyber_candidate_1…3` in der Werkstatt).
- **Ergebnis:** Assets `ws_treasury_cyber_empty` + `ws_treasury_cyber` (voll = leere Fassung + nur der Beutehaufen aus einem Edit Pro Flash, damit beim Füllen keine Kanten entstehen), Fächer 124/150/172/194, Ständer neu: Vitrine links 1 × 3, Lochwand 4 × 2, Vitrine rechts 2 × 3, Sockel 2 × 2; Maßstab 78 % (sonst schneidet der Container die Vitrinen ab); Effekte: Spotlicht, Vitrinen-Leuchten, Neon unter der Decke abends, Holo-Schilder funkeln. Alte Fassungen bleiben (`ws_treasury`, `ws_treasury_empty`, `ws_treasury_v1`, `ws_treasury_alt`). `treasury_test` 8/8. PixelLab: 39 Generierungen (3 × 10 + 9). Bitte testen: Camp › Schatzkammer im Rig, Wertsachen auf den Haufen, Trophäen in die Vitrinen.

### #004 Menschlicher Raider als Gegner-Grundlage
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · fertig (Code, 12.11.) · angelegt 12.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** design.md › Gegner, Feature „Gegner-KI“; PixelLab-Bosse als Stilvorlage
- **Auftrag:** Daniel, 12.11.2026: „leg bitte auch noch einen menschlichen Raider-Character als Grundlage für unsere Gegner an. Lass dich inspirieren von den Gegnern, die schon bei PixelLab liegen. Das sind die Bosse. Mach die Grafik so modular wie sinnvoll ist, um Köpfe und Waffen flexibel austauschen zu können, ohne dass die Qualität der Animationen drunter leidet. Alles, was du als Waffen anlegst, legst du bitte so an, dass Leyla es theoretisch benutzen könnte (also mit Item für den Rucksack und allen Regeln und Einträgen). Der Stil darf cyberpunkig sein, und auch wenn die Figuren Variety in Herkunft und Aussehen haben sollen, sollen sie auch zusammengehörig wirken. Alle Gegner, die Humanoids sind, sollen sich ducken können. Außerdem gehen, laufen, Alert-Pose, Angriff Nahkampf mit einer leichten Waffe und mit einer beidhändigen, schießen mit Pistole oder Langwaffe.“
- **Fertig, wenn:** Raider-Grafik mit Gehen, Laufen, Ducken, Alarm, Nahkampf leicht + beidhändig, Schießen Pistole + Langwaffe; Köpfe/Waffen austauschbar; Waffen als Gegenstände mit Symbol; Gegner im Spiel; Test grün.
- **Rückfragen:**
  - Wie modular? → ⚠️ vorläufig: **ein Körper je Bausatz**, Animationen je Waffenklasse; **Waffen** austauschbar innerhalb der Klasse (PixelLab malt einen grünen Platzhalter, das Spiel setzt die echte Waffe je Frame an Griff + Winkel), **Köpfe** als Aufleger, **Hautton + Gang-Farbe** per Farbtausch. Ein Körper für Männer und Frauen wäre unsauber: weitere Körper (Frau, schwer, schmal) = weitere Bausätze nach demselben Rezept (~300 Generierungen je Körper).
  - Ducken wann? → ⚠️ vorläufig: als Konter auf anfliegende Nägel (Chance je Gegner, Schützen öfter); Deckung hinter Kisten ist noch offen.
  - Tod für alle Klassen gleich, ohne Waffe (sie fällt per „Lässt seine Waffe fallen“). ⚠️ vorläufig.
  - Feueraxt (zweite beidhändige Waffe) war im Waffen-Blatt abgeschnitten → weggelassen.
- **Ergebnis:** Grafik + Bausatz + Gegner, siehe `docs/features/combat.md` › Gegner-Bausatz Raider. 25 Animationen (4 Klassen × Alarm, Gehen, Rennen, Ducken, Angriff, Treffer + Tod), 6 Köpfe, 5 Hauttöne, 5 Gang-Farben, neuer Bereich **Gegner-Bausätze**, Waffen › **In der Hand**, Beutetabellen mit Waffen, neue Waffen Nagelkeule / Rohrhammer / Rohrpistole (mit Symbol, Werten, Zerlegen, Trophäe), Machete + Schrotflinte mit Symbol, 5 neue Raider-Gegner (in den POIs), Schläger/Schütze/Schildträger jetzt aus dem Bausatz. Tests: `raider_test` 17/17, `npm test` 89/89 (neu `test/kits.test.js`), `enemy_test` 24, `game_test` 50, `poi_test` 30, `poi_levels_test` 9. PixelLab: 308 Generierungen (Sitzung gesamt 347, übrig 1849). Bitte testen: Spiel › `?room=kampfraum` bzw. ein POI-Run, Werkstatt › Gegner-Bausätze (Hautton/Gang-Farbe/Kopf am Gegner umstellen), Nagelkeule/Rohrpistole aus der Plünderer-Beute ausrüsten.
  - Nebenbefund: `inventory_test` hat 2 Fehler („Daneben klicken wirft es auf den Boden“, „I am Bündel zeigt den Boden im Camp“), schon vor dieser Sitzung (Stand ohne meine Änderungen geprüft), nicht angefasst.

### #005 Intro als Comic (Die Suche)
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · fertig (Code, 12.11.) · angelegt 12.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** design.md › „Die Suche: AvA im Cryo-Tank“, „Tod und AvA“; `docs/features/controller.md` › Hauptmenü; `docs/features/splash.md`
- **Auftrag:** Daniel, 12.11.2026: „lass uns ein Intro für das Spiel malen“. Entscheidungen (Multiple Choice): **Inhalt** = die Suche (AvA wird krank, Körper in den Cryo-Tank, Verstand in die Drohne, Leyla fährt los); **Form** = Comic-Panels; **Start** = nur, wenn man es im Hauptmenü aktiv auswählt; **Budget** = großes Kino, nach Daniels Storyboard.
- **Fertig, wenn:** Storyboard umgesetzt, Panels als Assets (KI PixelLab, AAP-64), Intro im Hauptmenü wählbar, mit Tastatur/Controller überspringbar, Werte und Panel-Reihenfolge in der Werkstatt, Test grün, Build grün, PixelLab-Verbrauch gemeldet.
- **Storyboard-Antworten (Daniel, Multiple Choice):** erstes Camp als eigenes Panel 4b (Van + Anhänger mit Tank + Feuer, keine NPCs, keine Drohne); Countdown **beides** (Tage + Tank-Balken); **Textboxen**, „achte in der Sprache auf Vermeidung von AI-ismen“; Schluss: **AvA erwacht** in der Drohne. Wichtig: Leyla, Tank, Tankstelle, Van und Camp wie im Spiel.
- **Rückfragen:**
  - Texte → ⚠️ vorläufig von Ava geschrieben, alle in der Werkstatt › Intro änderbar. Dabei erfunden: Klinikturm Ebene 40, „Bezahlt ist er bis Donnerstag“ (Leyla holt AvA, weil die Klinik den Tank abschalten will), Camp bei Kilometer 6, AvAs erster Satz „Leyla? Ich bin hier drin.“
  - Seitenaufteilung → ⚠️ vorläufig: Seite 1 = Panels 1–4 im Raster wie im Storyboard, Seite 2 = Camp + Tankstelle überlappend, Seite 3 = Null Tage ganzseitig, Seite 4 = AvA ganzseitig.
  - Wo erwacht AvA? → ⚠️ vorläufig im dunklen Anhänger beim Tank (das Camp-Panel zeigt noch keine Drohne).
  - Zahlen/Schrift (03/00 TAGE, Tank-Balken) kommen aus Code, KI malt nur leere Bildschirme bzw. freien Himmel.
- **Ergebnis:** Intro als Comic, siehe `docs/features/intro.md`. 8 Panels (PixelLab Create Image Pro, AAP-64, Referenzen Storyboard + Leyla-Sheet + Tank + Van/Anhänger + Drohne), neue Seite `intro.html` (online `/intro`), Hauptmenü-Eintrag „Intro“ an zweiter Stelle, Player `game/intro/intro.js` (Textboxen tippen, Kamerafahrt, Effekte Blasen/Alarm/Staub/Funken/Erwachen, Countdown mit Tank-Balken, Titel am Ende, zurück ins Menü), Bereich **Intro** in der Werkstatt (+ Startseite › Intro), Spielen-Knopf zeigt ab dem gewählten Panel. Tests: `intro_test` 14/14, `splash_test` grün (A öffnet jetzt das Intro an zweiter Stelle), `workshop_test` grün, `npm test` 91/91, `ng check` stimmig, Build grün. PixelLab: 200 Generierungen (8 × 25), übrig 1.648. Bitte testen: Startseite › Intro durchklicken (Tastatur und Controller), Texte und Bildausschnitte in der Werkstatt › Intro nach Geschmack ändern.

### #006 Cyberware: 30 Implantate, Perk + Flaw, Ripperdoc-Liege
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · fertig (Code, 13.11.) · angelegt 13.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** `docs/features/inventory.md` › Inventar im Diablo-Stil (Implantate), `docs/features/benches.md`, `docs/features/crafting.md`, `docs/features/leyla.md`
- **Auftrag:** Daniel, 13.11.2026: „verschiedene Cyberware Items im Spiel (sowohl die Regeln, als auch die Item Sprites). Achte drauf, dass man gut erkennen kann, was es ist und dass man die einzelnen Varianten gut voneinander unterscheiden kann. Die Item Typen ziehst du dir aus dem Inventar. Es gibt einfache Dinge, die Doppelsprung und Dash ermöglichen oder Boni geben, aber es soll auch Items geben, die sehr große Boni geben, aber dafür auch einen Nachteil mit sich bringen (als Perk und Flaw von Fallout). Erzeuge alle Grafiken … die Regeln und Mechaniken zur Herstellung kannst du direkt einbauen.“ Antworten (Multiple Choice): Doppelsprung und Luft-Dash **freischalten** (im Spiel mit Spielstand gesperrt, Implantate schalten frei; Boden-Dash bleibt; Testraum frei; Schalter in der Werkstatt), Perk + Flaw **dauerhaft**, Herstellung an einer **neuen Ripperdoc-Liege**, **~30 Teile**.
- **Fertig, wenn:** 30 Implantate (6 Plätze × 5) mit eigenem Symbol, neue Werte wirken im Spiel, Doppelsprung/Luft-Dash hängen an Implantaten, Ripperdoc-Liege mit Bild und Rezepten, Baupläne für die starken Teile in der Beute, Tooltip zeigt Vor- und Nachteile, Tests grün, PixelLab-Verbrauch gemeldet.
- **Rückfragen:**
  - Liste, Namen, Werte und Nachteile der 30 Teile → ⚠️ vorläufig von Ava (Tabelle in `docs/features/cyberware.md`), alles in der Werkstatt änderbar. 7 Perk-Teile: Tunnelblick-Optik, Overclock-Chip, Berserker-Chip, Presslufthammer-Arm, Reaktor-Herz (zieht am Tank!), Känguru-Beine, Panzerhaut Titan.
  - Eigene Werkstatt-Art „Cyberware“ für die Liege → ⚠️ vorläufig, sonst hätte die normale Werkbank (gleiche Art „Herstellen“) die Cyberware mitgebaut.
  - Einbauen → ⚠️ bleibt wie bisher im Inventar und nur im Camp; die Liege stellt nur her.
  - Start → ⚠️ vorläufig: Leyla startet ohne Doppelsprung/Luft-Dash, aber Sprungfedern, Dash-Synapse, Nano-Herzklappe und Billig-Kameraauge stehen von Anfang an im Rezeptbuch; die Liege muss man im Bau-Modus kaufen (900 Δ). Einfache Teile liegen auch schon in Tankstellen-Kisten.
  - Offen: Die POI-Räume wurden mit Doppelsprung gebaut. Im echten Run ohne Sprungfedern könnte eine Stelle unerreichbar sein (Kanten greifen und Leitern helfen). Die POI-Tests laufen im Testmodus (mit Doppelsprung). Bitte beim Spielen darauf achten; zur Not Leyla › Inventar › Schalter aus.
  - Liegen-Bild: ⚠️ vorläufig Fassung A (roter Zahnarztstuhl), B (`ws_ripperdoc_alt`) liegt bereit.
- **Ergebnis:** Siehe `docs/features/cyberware.md`. Neue Werte in `game/inventory.js` (`GEAR_STATS`, `statParts`), Wirkung in Szene, Leyla, Kampf, Tank; Tooltip mit grünen Vorteilen und roten Nachteilen; Stufen-Rahmen im Inventar (grau, blau, gold mit rotem Glühen); Ripperdoc-Liege mit Effekten; 30 Rezepte, 20 Baupläne, Beutetabellen; Werkzeuge `tools/cyberware_data.mjs`, `tools/cyberware_icons.py`. Tests: `cyberware_test` 15/15, `npm test` 91/91 (Start-Rezepte ergänzt), `ng check` stimmig; Regression grün: game 50, parcours 49, pad 39, camp 26, stack 15, gear 20 (Nachtsicht-Erwartung angepasst), craft 21, build 33, van 17, bench 26, poi 30, poi_levels 9, tank 12, techtree 10, treasury 8, garden 4, enemy 24, raider 20, light 16, container 17, splash, intro, workshop; `inventory_test` weiter mit den 2 alten Boden-Fehlern. Nebenbei: Tooltip schrieb bei Dingen ohne Aktionen „null“ (behoben). PixelLab: 320 Generierungen (30 Symbole + 2 Liegen), übrig 1.328. Bitte testen: neues Spiel (kein Doppelsprung!), Liege kaufen, Sprungfedern bauen und einbauen, Tooltip der Perk-Teile.

### #007 Reisekarte: verwitterte Touristen-Karte statt Menü
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · fertig (Code, 13.11.) · angelegt 13.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** design.md › Core Loop (Reise), `docs/features/camp.md` (Warroom, Fahren), Bereiche Orte, Reisen, POIs
- **Auftrag:** Daniel, 13.11.2026: „Jetzt müssen wir die Reise visualisieren. D.h. ich möchte nicht mehr, dass das ein Menü ist, sondern eine Art Werkbank-Screen mit einer Karte und den nächsten Zielen, die zur Wahl stehen. Die Karte soll eine verwitterte alte Karte sein (à la 60er Tourismus), aber mit Brands aus der Welt des Spiels (sei kreativ), der Inhalt soll jedoch so dynamisch wie möglich sein und in jedem Run mehr oder weniger zufällig generiert werden.“ Antworten: **Routen-Netz je Durchgang** (Knoten + Straßen, 2–4 Nachbarn erreichbar, weiter weg = gefährlicher und lohnender, besuchte bleiben), Karte am **Warroom und an der Van-Tür**, Ziele zeigen **Kosten, Gefahr + Art, Beute-Hinweise**, **Papier von PixelLab, Inhalt aus Code**.
- **Fertig, wenn:** Karte je Durchgang gewürfelt und im Spielstand, Fenster mit Karte + Ziel-Details + Hinfahren/Hier plündern (Maus, Tastatur, Controller), Marken der Spielwelt auf der Karte, alle Werte in der Werkstatt, alte Spielstände gültig, Tests grün, PixelLab gemeldet.
- **Rückfragen:**
  - Marken, Slogans, Ortsnamen-Vorlagen → ⚠️ vorläufig von Ava erfunden (8 Marken, siehe `docs/features/worldmap.md`), alles in der Werkstatt › Reisekarte änderbar.
  - Die vier Orte aus dem Bereich Orte → ⚠️ bleiben als feste Wahrzeichen, Positionen auseinandergezogen (sie lagen dicht beieinander und überdeckten sich); Start bleibt Tankstelle Kilometer 7 (passt zum Intro).
  - Fahren → ⚠️ nur eine Straße weit (2–4 Nachbarn), Kosten nach Straßenlänge (+15 % Umweg).
  - Gefahr gewürfelter Orte → ⚠️ nur Anzeige, im Run noch ohne Wirkung; Beute-Hinweise je POI-Art aus den Beutetabellen.
  - Warroom → ⚠️ öffnet direkt die Karte, Techtree und Auswerten sitzen im Kopf der Karte; an der Van-Tür ist „Karte · Reisen“ der erste Eintrag.
- **Ergebnis:** Siehe `docs/features/worldmap.md`. Neu: `game/worldmap.js` (Generator, Spielstand), `game/map_render.js` (Zeichner), `game/play/map_ui.js` (Fenster), Bereich **Reisekarte** mit Vorschau und „Neu würfeln“, Fernsteuerung `nomad.map()`. Tests: `map_test` 12/12 (neu), `npm test` 92/92 (neu: Generator; Fahrtkosten nach Straße), angepasst: `camp_test` 28, `pad_test` 41, `build_test` 32, `techtree_test` 10 (Warroom-Menü → Karte); Regression grün. PixelLab: 130 Generierungen (2 Papiere + 8 Marken), übrig 1.148. Bitte testen: Warroom bzw. Van-Tür → Karte, Ziele mit Controller und Maus anschauen, hinfahren, neues Spiel = neue Karte.

### #008 Camp-Paket: Start-Rig, Strom, Solar, Zisterne, Außen-Clutter, Lichterketten, Treppen, NPCs, Kriecher
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · erledigt (Code, 13.11.) · angelegt 13.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** `docs/features/camp.md`, `rig.md`, `benches.md`, `worldmap.md`, `combat.md`
- **Auftrag (Daniel, 13.11.2026):** (1) Karte: Schrift größer, Markierungskreuz mit mehr Kontrast. (2) „Der Van erzeugt genug Strom für ein oder zwei Module. Avas Tank verbraucht keinen Strom.“ (3) „Die Modul-Anhänger (nicht die Container!) soll es nicht mehr geben. Start-Ausrüstung ist der Van und der kleine Anhänger mit dem Tank. Im Van eine Koje und eine Kochnische; kein Warroom.“ (4) „Ohne Warroom kann man auf der Karte nicht sehen, was einen dort erwartet (mit Hinweis).“ (5) Solarpaneele auf Container-Dächern, so viele wie der Container in Einheiten lang ist. (6) Zisterne als Werkbank, sammelt Wasser über Zeit. (7) Clutter-Set für die Außenwände der Container, passend zu den Werkbänken dahinter. (8) Camp cosy und polished statt Test-Charakter. (9) Erdgeschoss-Leitern hübscher. (10) Der Code-Gegner in der Tankstelle wird ein dynamischer Gegner. (11) Die Companions bekommen ihre PixelLab-Sprites. Antworten: Onkel Sung bleibt Onkel Sung (großer Mann mit Goldkette), Schraube ist der schlanke Junge („Screw“); **Klapptreppe aus Metall**; Solar **tagsüber + Akku**; Camp: Beschriftungen dezent, Deko ums Feuer, Licht + Stimmung, HUD aufräumen, „Mach an den Container-Ecken Andockpunkte und lass den Spieler die Lichterketten selbst ziehen.“
- **Fertig, wenn:** alles oben spielbar, Werte in der Werkstatt, alte Spielstände gültig, Tests grün, PixelLab gemeldet.
- **Rückfragen:**
  - Techtree und Auswerten → ⚠️ hängen weiter am Warroom; ohne Warroom am Start muss man erst einen bauen.
  - Lichterketten → ⚠️ Andockpunkte nur an Containern und an der Van-Dachreling (kein Mast am Feuer); Preis 25 Δ, Abnehmen gibt 12 Δ zurück; sie hängen an Einheits-Nummern (Umsortieren nimmt sie mit an die neue Stelle). Mit dem Controller: Cursor auf einen Punkt, A, zum zweiten Punkt, A (RB springt nur beim Ziehen zu Andockpunkten).
  - Solarpaneele → ⚠️ erscheinen im Inventar-Tab „Van“ bei den Sockeln mit; Holzkisten tragen keine.
  - Schraube → ⚠️ Rolle jetzt „Mechaniker“ (der schlanke Junge); seine Atem-Animation nutzt nur zwei Frames, weil PixelLab in den anderen eine Kapuze aufgesetzt hat. Bei Bedarf neu animieren.
  - Zisterne → ⚠️ 0,25 Flaschen/h, fasst 8; Frischwasser ist Zutat für Neon-Ramen und gibt getrunken Erste Hilfe.
  - Streuner → ⚠️ Kapuze, oliv, Gang Gelb, Machete, so stark wie der Kriecher; der Kriecher bleibt in anderen POIs.
- **Ergebnis:** Details in `docs/features/camp.md`, `rig.md`, `benches.md`, `worldmap.md`, `combat.md`. Neu: `game/cistern.js`, `game/string_lights.js`, `tools/camp_pack_data.mjs` (schreibt die Camp-Daten), `tools/cozy_test.mjs` (15), `test/camp_pack.test.js` (5). `npm test` 97/97; Browser-Tests grün: cozy 15, bench 26, build 32, camp 28, container 17, craft 21, cyberware 15, enemy 24, game 50, garden 4, gear 20, intro, inventory 33, light 16, map 12, pad 41, parcours 49, poi_levels 9, poi 30, raider 20, splash, stack 16, tank 12, techtree 10, treasury 8, van 17, workshop. Alte Test-Setups behalten über `tools/test_fixture.mjs` 3 ⚡ am Van. PixelLab: diesmal 183 Generierungen (Treppe, Solar, 12 Außenwände, Deko, Zisterne, 2 Atem-Animationen), übrig 966. **Bitte testen:** neues Spiel (Start-Rig, Karte ohne Warroom), B → Lichterketten ziehen und abnehmen, nachts ans Feuer, Zisterne und Solar über den Händler kaufen und einbauen, Tankstelle plündern (Streuner).

### #009 Camp-Feinschliff: Perspektive, Hintergrund, Onkel Sung, Solar, Lichterketten
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · erledigt (Code, 13.11.) · angelegt 13.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** `docs/features/camp.md`, `rig.md`
- **Auftrag (Daniel, 13.11.2026):** „Die Treppen sind zwar hübsch, aber die Perspektiven sind kaputt. Mach sie direkt frontfacing orthogonal wie alle anderen Sachen. Gleiches trifft leider auch auf den Clutter im Camp zu inklusive des Feuers.“ Hintergrund im Camp „ein wenig epischer, ein wenig mehr wie im Intro, aber ohne dass der Style kaputt geht“. Onkel Sung „deutlich größer als Leyla“. Steht ein Container auf dem Dach: keine Solar-Sockel. Solarpaneel kaufen wie Container und Werkstätten (Drag & Drop). Lichterketten verschwinden, sobald sie teilweise aus dem Bild ragen oder man das Fenster verlässt und zurückkommt.
- **Fertig, wenn:** alles oben sichtbar im Spiel, Tests grün, PixelLab gemeldet.
- **Rückfragen:**
- **Ergebnis:** Details in `docs/features/camp.md` (Feinschliff) und `rig.md` (Solar unter Stapeln). Neu von PixelLab, streng von der Seite mit dem Van als Referenz: Treppe, Solarpaneel, Teppich, zwei Stühle, Ecke, Lagerfeuer (animiert, `campfire_side`), Klimagerät, Kisten, Satellitenschüssel. Horizont aus Code (Camp › Horizont). Onkel Sung 240 px. Lichterketten als Bilder. Lichter ohne Kasten (ADD global rein additiv in `main.js`). Tests: `npm test` 98/98, `cozy_test` 18, alle 27 Browser-Tests grün. PixelLab: diesmal 101 Generierungen, übrig 865. **Bitte testen:** Lichterkette halb aus dem Bild schieben und Fenster wechseln, Nacht am Feuer (kein Lichtkasten mehr), Container auf einen anderen stapeln (Solar-Sockel darunter weg), Solarpaneel beim Händler kaufen und aufs Dach ziehen.
  - ⚠️ Solar kaufen lief schon per Drag & Drop wie bei Containern (Händler liefert aufs Pad, dann aufs Dach ziehen); das Paneel war nur als namenlose Kiste zu sehen. Falls du direkt aus dem Katalog ziehen willst: sag Bescheid.
  - ⚠️ Lichterketten-Fehler war bei mir nicht nachzustellen; die Umstellung auf Bilder plus der Mischmodus-Fix sollten es lösen.

### #010 Bau-Modus mit Controller: AvA als Zeiger, UI-Grammatik, Spaß
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · erledigt (Code, 13.11.) · angelegt 13.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** `docs/features/rig.md`, `controller.md`, `ui.md`, `drone.md`
- **Auftrag (Daniel, 13.11.2026):** „Das Camp-Bau-Menü muss auch vollständig mit dem Controller bedienbar sein und soll Spaß machen … orientiere dich an den Design-Konventionen von unseren anderen Menüs.“ Antworten: linker Stick springt von Ziel zu Ziel, rechter Stick steuert frei, **„aber die Drohne ist der Zeiger“**; Kaufen liefert **aufs Pad wie bisher**; **volle UI-Grammatik** (Y = rüber: Schrottplatz, halten = verkaufen, ohne Teil = Händler; LB/RB = Bereiche; X = Kontext, X halten = rückgängig); Extras: **Vibration, Vorschau am Ziel, Kamera fährt mit, Klick-Töne**.
- **Fertig, wenn:** alles im Bau-Modus ohne Maus geht (Werkstätten, Container, Rig-Teile, Solar, Lichterketten, Händler), Hilfezeile je Lage, Tests grün.
- **Rückfragen:**
- **Ergebnis:** Details in `docs/features/controller.md` › „Bau-Modus mit Controller, AvA ist der Zeiger“. AvA fliegt als Zeiger: Der linke Stick springt von Ziel zu Ziel, mit einem Teil in der Hand nur dorthin, wo es passt; der rechte Stick fliegt frei. A packt und legt ab, B zurück/fertig, Y Schrottplatz (halten: verkaufen) bzw. Händler, X Kontextmenü (halten: rückgängig), LB/RB Bereiche mit Kamerafahrt, Händler mit Tabs, Vorschau grün/rot am Ziel, Tooltip an AvA, Hilfezeile je Lage, Vibration und Klick-Töne. Behoben: Werkstätten ließen sich auf den Platz des Cryo-Tanks tauschen. Tests: `build_pad_test` 20 (neu), `pad_test` 41, `build_test` 32 (Händler-Tabs); alle 28 Browser-Tests und `npm test` grün. PixelLab: nichts. **Bitte testen** (Stadia): Select halten, mit dem Steuerkreuz durchs Rig springen, Werkbank packen und einbauen, Y halten zum Verkaufen, X fürs Menü, RB durch die Bereiche, Lichterkette mit A, Steuerkreuz, A.
  - ⚠️ Ob der Stadia-Controller im Browser vibriert, hängt vom Browser ab (Chrome kann es meist); ohne Vibration läuft alles gleich.
  - ⚠️ Am Händler kauft A wie gewünscht aufs Pad; danach mit RB zum Schrottplatz und das Teil dort packen.

### #011 Tutorial als Feldhandbuch: Lektionen mit Clips und Slideshows
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · erledigt (Code, 13.11.) · angelegt 13.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** `docs/features/ui.md`, `controller.md`, `tests.md`
- **Auftrag (Daniel, 13.11.2026):** „Auf Basis von Screenshots ein Tutorial, das ähnlich wie bei Far Cry erklärt, wie man Dinge tut. Keine neuen Grafiken erzeugen, sondern Clips und Screenshots nutzen, um in kurzen Animationen oder Slideshows die verschiedenen Bausteine des Spiels zu erklären. Feingranulare Lektionen.“ Antworten: **beim ersten Mal als Karte + Archiv im Pause-Menü**, **gemischt** (Bewegung/Kampf/AvA als Loop-Clip, Menüs/Camp/Bauen als Slideshow), **alle ~45 Lektionen**, **Tasten je Gerät**.
- **Fertig, wenn:** Lektionen in der Werkstatt, Clips und Bilder automatisch aus dem Spiel aufgenommen, Karten beim ersten Mal, Feldhandbuch im Pause-Menü, Tests grün.
- **Rückfragen:**
- **Ergebnis:** Details in `docs/features/tutorial.md`. 53 Lektionen in 9 Kapiteln (Bereich **Lektionen**), 22 Clips und 61 Bilder, alle mit `tools/tutorial_capture.mjs` aus dem Spiel aufgenommen (Testraum, Kampfraum, Camp, Tankstelle; ffmpeg → WebM/WebP, 4,8 MB). Karte beim ersten Mal (pausiert, Neon-Glas, Clip in Schleife oder Slideshow mit Schritten), Feldhandbuch im Pause-Menü (Kapitel als Tabs), Tasten je Gerät, Optionen an/aus und „Lektionen neu zeigen“. Neue Asset-Art „Clip (Video)“ mit Vorschau in der Werkstatt. Tests: `tutorial_test` 18 (neu), alle 29 Browser-Tests und `npm test` grün. PixelLab: nichts. **Bitte testen:** neues Spiel und ein paar Minuten spielen (Karten erscheinen), Menü › Feldhandbuch durchblättern, Clips anschauen.
  - ⚠️ Auslöser je Lektion sind Vorschläge (Zeit, Hinweis, Fenster, Leyla-Zustand, AvAs Stimmung) und in der Werkstatt änderbar; zwischen zwei zeitgesteuerten Karten liegen 40 s.
  - ⚠️ Gesehen wird im Browser gespeichert (über Durchgänge und „Neues Spiel“ hinweg).
  - ⚠️ Bewegungs-Lektionen mit Implantat (Salto, Dash in der Luft) erklären das Implantat nur im Text.
  - ⚠️ „Formen und Drehen“ zeigt nur das Nehmen; das Drehen sieht man auf dem Bild kaum.

### #012 Achievements mit Trophäen-Rezepten + Rezepte automatisch lernen
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · fertig (Code, 13.11.) · angelegt 13.11. von Ava (Design-Session mit Daniel im Projekt-Chat)
- **Für:** Code
- **Lesen:** design.md › „Achievements & Trophäen“ und › Crafting & Kochen › „Rezepte lernen“; `docs/features/benches.md` › Schatzkammer (Ständer, Tag Trophäe); `docs/features/crafting.md` (Zettel); `docs/features/progression.md` (Durchgang, Wissen)
- **Auftrag:** Reihenfolge:
  1. **Rezepte automatisch lernen:** Zettel/Baupläne beim Einsammeln sofort ins Rezeptbuch, Meldung „📜 Rezept gelernt: *Name*“, kein Platz im Rucksack. Schnellaktion **„Lernen“** im Inventar (Maus, Tastatur, Controller) für Zettel, die schon irgendwo liegen; alte Spielstände bleiben gültig. ⚠️ vorläufig: bekanntes Rezept → Wissen (Menge in der Werkstatt).
  2. **Achievement-System:** Zähler und Ereignisse im Spielstand (`save.achievements`), Meldung „🏆 *Name*“, danach lehrt es das Rezept seiner Trophäe. Rezept einmalig herstellbar (danach im Rezeptbuch als „hergestellt“).
  3. **Bonus:** Trophäe auf irgendeinem Ständer in irgendeiner Schatzkammer im Rig → Bonus aktiv (Prozentwerte und Spezialeffekte). Keine Obergrenze; mehrere Schatzkammern müssen gehen. Holo-Schild/Leuchten am Ständer, wenn ein Bonus wirkt; Tooltip zeigt Achievement + Bonus.
  4. **Durchgang:** Achievements, deren Rezepte und Trophäen bleiben; ⚠️ vorläufig liegen die Trophäen nach dem Aufwachen in einer Erinnerungskiste am Feuer. Trophäen unverkäuflich und nicht zerlegbar.
  5. **Werkstatt-Bereich „Achievements“** (Felder siehe design.md) plus Übersicht im Pause-Menü (erreicht / offen / versteckt als „???“).
  6. **Startinhalt:** ca. 10 Achievements quer durch Kampf, Erkundung, Cosy, AvA/Tank, Story (Beispiele in design.md, Rest erfinden), je eine Trophäe mit Symbol von PixelLab (AAP-64, passend zu den Wertsachen).
- **Fertig, wenn:** Rezept einsammeln → Meldung, Rezeptbuch, Rucksack leer; Achievement auslösen → Rezept → herstellen → ausstellen → Bonus messbar; zweite Schatzkammer zählt mit; neuer Durchgang behält alles; Werkstatt-Bereich vollständig; alte Spielstände gültig; Tests grün (neuer `achievement_test`), PixelLab gemeldet.
- **Rückfragen:**
  - Startinhalt → ⚠️ vorläufig 12 Achievements (3 Kampf, 3 Erkundung, 3 Cosy, 2 AvA & Tank, 1 Story; „Ins Schwarze“ und „Lichterfest“ versteckt), Zielwerte und Boni siehe `docs/features/achievements.md`, alles in der Werkstatt.
  - „Tank kritisch“ → ⚠️ die letzte Phase (Alarm/KRITISCH) beim Run-Ende.
  - Spezialeffekte → ⚠️ Secrets schimmern pink (Bunker-Schlüsselbund), Extra-Beute als Chance auf ein Ding mehr je Beute-Wurf, „Mehr Δ“ auf die Run-Auszahlung.
  - Meldungen → ⚠️ als Toasts oben rechts (Pokal gold, Rezept cyan) statt Banner, damit sie den Kampf nicht verdecken; im Text Lucide statt Emoji.
  - Zettel einsammeln → ⚠️ alles Eingesammelte landet im Rucksack, dort wird gelernt; Zettel in Kiste/Lager über „Lernen“.
- **Ergebnis:** Details in `docs/features/achievements.md`. Neu: `game/achievements.js` (Zähler, erreichen, Boni aus allen Ständern aller Schatzkammern, Durchgang), `game/play/achievements_ui.js` (Pause-Menü › Achievements), Bereich **Achievements** in der Werkstatt, Rezept-Feld **Einmalig**, Entdecken „Achievement“, Kochen & Craften › Rezepte lernen; Zähler im Spiel (Kills mit Gegner/Familie/Waffe/Krit, Secrets, POIs mit Rang, Ernten, Kochen, Herstellen, Experimente, Zerlegen, Schlafen, Fahren, k.o., Tank, Δ, Lichterketten, Rezepte, Werkstätten, Durchgang); Boni über `applyGear`, `techtree.bonuses`, Hydrokultur, Beute, Δ, Secrets; Holo-Schild + Tooltip; Erinnerungskiste am Feuer. Symbole `icons_trophies` (12 × PixelLab, je bester von 4). Tests: `test/achievements.test.js` 7, `tools/achievement_test.mjs` 16, `npm test` 106, alle Browser-Tests grün. PixelLab: diesmal 120 Generierungen, übrig 744. Nebenbei: Lichterketten-Fix 2 (veralteter zweiter Tab überschrieb den Spielstand; Rückgängig nahm Ketten mit). **Bitte testen:** Pause-Menü › Achievements durchblättern; in der Tankstelle 25 Plünderer … (oder schneller: ein Zettel aufheben → Toast + Rezeptbuch); Trophäe an der Werkbank bauen, Schatzkammer kaufen, Trophäe auf einen Ständer → Holo-Schild + Tooltip „Bonus aktiv“.

### #013 Werkstätten mit eigener Handlung: Kochen, Werkbank (Bauplan + Teile), Drohnen, Ripperdoc, Foodtruck, Energie
- **Status:** fertig (Code, 13.11.) · angelegt 13.11. von Ava (Design-Session mit Daniel im Projekt-Chat: 1a, 2c, 3c)
- **Für:** Code
- **Lesen:** design.md › Crafting & Kochen › „Jede Werkstatt fühlt sich an wie das, was sie ist“; `docs/features/crafting.md`; `docs/features/benches.md`; `docs/features/cyberware.md`; `docs/features/drone.md`; `docs/features/ui.md` + `docs/features/controller.md` (UI-Grammatik); `docs/features/inventory.md` (Tetris-Formen)
- **Auftrag:** Jede Werkstatt-Art bekommt ein eigenes Fenster mit eigener Handlung statt des gemeinsamen Rezeptbuch-/Topf-Fensters. Bedienung überall gleich (`ui_nav.js`, Controller, Maus, Tastatur), Rezeptbuch, Zettel, Tipps und Experimentieren bleiben erreichbar (z. B. als Tab). **Kein Scheitern durch Geschick (1a):** Geschick gibt nur Bonus, Nichtstun = normales Ergebnis. Reihenfolge:
  1. **Gerüst:** Werkstatt-Art → eigene Oberfläche (Register/Plugin), gemeinsame Teile (Rezeptbuch, Vorräte, Ergebnis-Ablage, Uhr, Companion-Kommentare) wiederverwenden; Fernsteuerung `nomad.craft()` erweitern.
  2. **Kochen:** Herd mit Pfanne/Topf, Zutaten nacheinander, Gar-Balken, Rausnehmen im guten Bereich = Qualität (Stufen z. B. ok / gut / perfekt) → stärkerer/längerer Buff; Gewürze als Extra. Experimentieren als Abschmecken mit Hinweisen.
  3. **Werkbank, Waffen nach 3c:** Bauplan = Grundgerüst mit Plätzen (Lauf, Griff/Schaft, Magazin, Visier …), Teile frei einsetzen (Tetris-Stücke), Werte live; neue **Waffenteile** als Gegenstände mit Werte-Änderungen und Platz-Art; Ergebnis = **Waffen-Exemplar mit eigenen Werten** (Spielstand, Inventar-Tooltip, Kampf nutzt die Werte). Kurze Handgriffe (Schrauben, Schweißen) am Ende = Qualitätsbonus. Andere Herstellen-Rezepte (Material, Medikit, Rig-Teile) mit einfacherem Bauplan.
  4. **Drohnenwerkstatt:** Platine/Schaltplan, Chips stecken, Kabel ziehen, Energie-Budget, AvA kommentiert (Stimmungen aus drone.md).
  5. **Ripperdoc:** OP-Ansicht, Präzisionsmoment je Implantat, gut = kleiner Bonus, Flaws nie schlimmer.
  6. **Foodtruck:** Kunden an der Theke (Bestellungen aus gekochten Gerichten), Tempo/Lieblingsgericht = Trinkgeld; ohne Eile normaler Verkauf.
  7. **Generator/Reaktor:** Regler + Lastanzeige, grüner Bereich = etwas Extra-Strom, sonst nur Flackern.
  8. **Werkstatt:** alle Werte (Gar-Zeiten, Bereiche, Bonus-Stufen, Teile-Werte, Kunden, Trinkgeld, Regler) in der Werkstatt einstellbar, neue Felder/Bereiche im Schema; Baupläne und Waffenteile als Daten.
- **Grenzen:** Gemütlich bleiben, kurze Handgriffe (Sekunden, nicht Minuten), jede Handlung lässt sich überspringen (z. B. „Schnell herstellen“ für bekannte Rezepte, normales Ergebnis). Spielstände bleiben gültig (`repairSave`; vorhandene Waffen = Exemplare mit Grundwerten). Grafik aus Code, wo es geht; PixelLab nur nach Freigabe-Regel (unter 700 vorher Daniel fragen).
- **Fertig, wenn:** jede genannte Werkstatt-Art öffnet ihr eigenes Fenster; Kochen mit Qualitätsstufen und messbar stärkerem Buff; Waffe aus Bauplan + zwei verschiedenen Teile-Sätzen ergibt zwei Exemplare mit unterschiedlichen Werten im Kampf; Drohne, Ripperdoc, Foodtruck, Energie spielbar; alles mit Controller bedienbar; Werkstatt-Bereiche vollständig; alte Spielstände gültig; `npm test` + neuer Browser-Test (`bench_ui_test`) grün; Build grün.
- **Rückfragen:**
  - Qualität speichern → ⚠️ Gerichte tragen sie im Inventar (nur gleiche Qualität stapelt), Waffen ihre Werte (`mods`), Implantate je Sorte die beste OP (`save.implantQ`).
  - Gewürze → ⚠️ machen das Gericht eine Stufe besser (verbraucht eins); Gewürze = Gewürzmischung, Chili, Sojasauce (Werkstatt).
  - Werte → ⚠️ gut/perfekt: Buff +25/+50 %, Waffe Schaden +5/+10 %, Implantat-Vorteile +10/+20 %, Lötstellen +15/+30 %; Trinkgeld 30 %, Lieblingsgericht 50 %; Regler +1 ⚡ für 12 h.
  - Drohnenwerkstatt → ⚠️ was AvA kann: Akku, Scheinwerfer, Tempo, Rettung kostet weniger, Extra-Beute; die Platine ersetzt die alte, Chips werden verbaut.
  - Foodtruck → ⚠️ verkauft im Camp (Kunden würfeln aus den Gerichten, die Leyla hat); NPCs an POIs später.
  - Abschmecken → ⚠️ Experimentieren bleibt wie es war (Tab), „Knapp daneben“ ist der Hinweis.
  - Symbole der neuen Teile/Chips → ⚠️ vorhandene Felder aus `icons_gear`, eigene Bilder bei Bedarf (PixelLab, nach Freigabe).
- **Ergebnis:** Details in `docs/features/crafting.md` › Werkstätten mit eigener Handlung. Neu: `game/stations.js` (Logik), `game/play/station_ui.js` (Herd, Bauplan, OP, Platine, Theke, Regler) im Werkstatt-Fenster; Inventar mit Qualität und Waffen-Exemplaren (`addEntry`, `slotMods`, `scene.weapon`), Essen mit Qualitäts-Bonus, Effekte der Platine in Akku/Scheinwerfer/Flug/Rettung/Beute, Extra-Strom im Rig. Werkstatt: Kochen & Craften › **Handgriffe**, Rezepte › **Oder Waffe** + **Plätze**, Gegenstände › **Waffenteil** und **Chip für AvA**; 9 Waffenteile, 4 Chips, 3 Baupläne (+ Zettel Rohrpistole), Loot und Start ergänzt. Tests: `npm test` 120, neuer `tools/bench_ui_test.mjs` 23, alle Browser-Tests grün (bench_test an das neue Drohnen-Menü angepasst). PixelLab: diesmal 0, übrig 744. **Bitte testen:** Kochnische › Bohneneintopf › Kochen (Gar-Balken im Gold treffen) und dann essen; Werkbank › Bauplan Nagelpistole mit Langem Lauf bauen, ausrüsten, Tooltip ansehen; Drohnenwerkstatt › Platine bestücken (Chips aus Drohnen-Beute); Foodtruck und Generator kaufen (Bau-Modus) und ausprobieren.

### #014 Absegnung 13.11.: Änderungen aus #003–#012
- **Status:** fertig (Code, 13.11.) · angelegt 13.11. von Code (Daniel hat die ⚠️-Punkte im Code-Chat entschieden)
- **Für:** Code
- **Lesen:** die jeweiligen Feature-Dateien (`pois.md`, `combat.md`, `achievements.md`, `ui.md`, `intro.md`, `camp.md`, `worldmap.md`, `benches.md`)
- **Bleibt wie gebaut (abgesegnet):** Start ohne Doppelsprung/Luft-Dash, Liege 900 Δ (#006); kein Warroom im Start-Rig, Techtree nur dort (#008); Ripperdoc-Liege Fassung A; Ducken als Konter (#004, wird ergänzt); Listen der 12 Achievements, 30 Implantate, 8 Marken passen erstmal; Warroom öffnet direkt die Karte; übriger Kleinkram aus #009–#011.
- **Auftrag:**
  1. **Trophäenraum (#003):** Kandidat 2 „Hall of Loot“ (`ws_treasury_cyber_candidate_2`) statt Kandidat 1 einbauen, die vier Ständer auf das Bild ausrichten.
  2. **Gefahr wirkt (#007):** höhere Gefahrenstufe eines Orts = mehr und stärkere Gegner im Run **und** bessere Beute. Werte in der Werkstatt.
  3. **Raider-Deckung (#004):** zusätzlich zum Ducken als Konter suchen Raider Deckung hinter Kisten (Schützen bevorzugt).
  4. **Alle Hinweise als Toast + Ton (#012):** Achievement- und Rezept-Toasts bekommen einen eigenen Ton; **alle** übrigen Hinweise/Banner im Spiel laufen über dasselbe Toast-System (Daniel: „stell sicher, dass alle diese Hinweise auf diese Art dargestellt werden“). Ton aus Code (`sfx.js`).
  5. **Intro (#005):** Story-Detail von Daniel: AvA lag im Klinikturm Ebene 40, weil sie als **Ersatzteillager für die Elite** gedacht war. Texte entsprechend umschreiben (Werkstatt › Intro), Rest bleibt.
  6. **Lichterketten (#008):** billiger (⚠️ vorläufig 10 Δ, Abnehmen 5 Δ zurück) und ein **Mast am Lagerfeuer** als Andockpunkt.
  7. **Zisterne (#008):** füllt sich bei Regen-Wetter deutlich schneller; Frischwasser in mehr Rezepten (Hydrokultur, Kaffee/Tee, weitere); **heilt getrunken nicht mehr**.
  8. **Reisen (#007):** Ziele über **mehrere Etappen** wählbar (Route über mehrere Straßen, Kosten summiert), unterwegs **Zwischenfälle** (z. B. Panne, Händler, Hinterhalt) als Ereignisse, in der Werkstatt einstellbar.
- **Grenzen:** Spielstände bleiben gültig; Grafik aus Code; PixelLab nur nach Freigabe-Regel.
- **Fertig, wenn:** alle 8 Punkte spielbar, Werte in der Werkstatt, `npm test` + Browser-Tests grün, Build grün.
- **Rückfragen:**
  - Lichterketten-Preis → ⚠️ 10 Δ, Abnehmen gibt die Hälfte zurück (beides in der Werkstatt).
  - Was zählt als „Hinweis“ → ⚠️ alle Meldungen und Banner werden Toasts; Schadenszahlen, Block, „+1 Ding“ beim Aufheben und Sprechblasen bleiben in der Welt, Meldungen im Bau-Modus und im Koch-Fenster bleiben in ihrem Fenster.
  - Regen → ⚠️ 30 % der Tage, 2–6 h Schauer, Zisterne 6× schneller; Gießen: +6 h Wachstum, alle 8 h.
  - Gefahr → ⚠️ je Stufe über 1: +25 % Gegner, +15 % Leben, +10 % Schaden, +20 % Extra-Beute.
  - Zwischenfälle → ⚠️ 7 Stück mit Entscheidungen; Kämpfe auf der Straße als kleines Level kommen später („Durchbrechen“ kostet Leben und gibt Beute).
- **Ergebnis:** Alle 8 Punkte gebaut, Details in den Feature-Dateien (`benches.md`, `ui.md`, `intro.md`, `camp.md`, `worldmap.md`, `combat.md`, `tests.md`) und `docs/changelog.md`. Neu: `game/rain.js`, `game/travel.js`, Werkstatt-Felder Camp › Regen, Lichterketten › Mast/Zurück, Zisterne › Bei Regen, Hydrokultur › Gießen, Reisekarte › Gefahr wirkt, Gegner › Sucht Deckung, Encounter › Entscheidungen. Nebenbei: Absturz von `achieveLater` bei frischem Spielstand behoben. Tests: `npm test` 114 grün, alle 30 Browser-Tests + `web:test` grün, Build ok. PixelLab: diesmal 0. **Bitte testen:** Schatzkammer im Bau-Modus ansehen (Hall of Loot), ein Gericht essen (Toast + Ton), Intro Panel 1, Lichterkette zum Mast ziehen, mit Warroom auf der Karte die Gefahr-Zeile lesen, ein Ziel zwei Straßen weit anfahren (Zwischenfall?), in der Tankstelle auf die Schützen hinter den Kisten achten.

### #015 Feinschliff 14.11.: Tutorial-Häkchen, Zisterne neu, keine Code-Gegner, Plaketten-Items
- **Status:** fertig (Code, 14.11.) · angelegt 14.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** `docs/features/tutorial.md`, `benches.md`, `combat.md` (Gegner-Bausatz Raider), `pois.md`
- **Auftrag:**
  1. **Tutorial:** in jeder Meldung ein Häkchen „für diese Sitzung nicht mehr“.
  2. **Zisterne:** Perspektive komplett falsch → neu, mit so wenig Generierungen wie möglich (Daniel: darf unter 700 gehen).
  3. **Keine Gegner aus Code mehr:** alle durch Gegner aus dem Baukasten (Raider) ersetzen.
  4. **Hall of Loot:** Items an den Plaketten werden zu klein dargestellt.
- **Fertig, wenn:** alle 4 Punkte spielbar, Tests grün, Build grün.
- **Rückfragen:**
  - Rattenschwarm + Wachdrohne (kein Mensch, passen nicht in den Raider-Bausatz) → ⚠️ aus allen Listen genommen, bleiben nur im Katalog für die KI-Tests; kommen zurück, wenn sie echte Grafik haben.
  - Schleimbeißer als Lauerer → ⚠️ Raider hängt kopfüber unter der Decke (Ducken-Pose gespiegelt) und lässt sich fallen.
  - „Sitzung“ → ⚠️ dieser Browser-Tab (`sessionStorage`), nach dem Schließen kommen die Karten wieder.
- **Ergebnis:** Commits `393151a` (Tutorial-Häkchen), `15c02cf` (Gegner), `7cb9438` (Hall of Loot), `ce741b3` + Folge (Zisterne, Feldhandbuch-Bilder). Tests: `npm test` 120, alle 32 Browser-Tests grün. PixelLab: diesmal 19 (10 verworfen: Referenz in alter Perspektive wurde kopiert; 9 mit `view: side` sitzt), übrig 725. **Bitte testen:** eine Lektion mit Häkchen wegklicken; Bunker/Ministerium: keine Drohnen/Ratten mehr, Hausmeister als großer Raider; Schatzkammer mit Trophäen füllen; Zisterne im Rig.

### #016 Flow & Kohärenz: Losziehen, Spannungskurve, roter Faden, Gangs, Tutorial im Run
- **Status:** fertig (Code, 14.11.) · angelegt 14.11. von Code (Analyse Ava, Daniel hat ausgewählt)
- **Für:** Code
- **Lesen:** `worldmap.md`, `pois.md`, `progression.md`, `ui.md`, `tutorial.md`, `combat.md`
- **Befund (Durchspielen 14.11.):** Bis zum Run vier Eingaben (Van → Menü → Karte, Nachbarort vorgewählt, „Hier plündern“ versteckt); Camp-Vorbereitung im Run unsichtbar; Gegner in der Tankstelle gleichmäßig alle 300–600 px (kein Rhythmus); Suche nach AvAs Heilmittel im Spiel kaum sichtbar; im Run zwei Δ-Anzeigen und die Camp-Leiste; POIs ohne eigene Gegner-Identität, Hausmeister ohne Boss-Verhalten; Lektionen pausieren auch im Run.
- **Auftrag:**
  1. **Losziehen in einem Schritt:** Van-Tür öffnet direkt die Karte, aktueller Ort vorgewählt, „Hier plündern“ als Hauptaktion.
  2. **Loadout-Check** neben „Hier plündern“: Buffs, Heilzeug, freier Rucksack, Rettungsfach, Gefahr.
  3. **Spannungskurve im Level:** Raum-Bausteine mit Intensität (Ruhe / Kampf / Arena / Belohnung), Verschweißen folgt einer Kurve, Werte in der Werkstatt.
  4. **Roter Faden:** Zielzeile „AvA braucht … · Ort“ im HUD und auf der Karte, Fortschritt nach dem Run (Daniel: „Den roten Faden bitte auch mit aufnehmen“).
  5. **Run-HUD aufräumen:** im Run nur Run-Werte, keine zweite Δ-Anzeige, keine Camp-Leiste.
  6. **Orte mit eigener Gang + Boss:** feste Gang-Farbe/Köpfe je POI, Hausmeister mit eigenem Boss-Verhalten.
  7. **Tutorial im Run nicht modal:** Lektionen im Run als Ecken-Tipp, modal nur im Camp.
  8. **Questlog** (Daniel, 14.11.: „Wir brauchen eine Art Questlog! Nimm das mit auf“; Antworten: Hauptquest Heilmittel + AvAs Tank als Dauerauftrag + Nebenaufträge; öffnen am Warroom und am Lagerfeuer; verfolgte Quest selbst wählbar, der schwache Tank geht vor).
- **Bleibt:** Start mit 40.000 Δ (zum Testen, Daniel 14.11.). Beute-Bilanz am Run-Ende: nicht jetzt.
- **Fertig, wenn:** alles spielbar, Werte in der Werkstatt, Tests grün, Build grün.
- **Rückfragen:**
  - Spannungskurve → ⚠️ vorläufig: Zufallsgegner (1) mit der Chance der Kurve, leise Räume schwächere, laute zähere Gegner, Seitenräume halb so laut; Kurven je POI in der Werkstatt.
  - Gangs → ⚠️ Gelbe Geier (Tankstelle), Neon-Ratten (Großmarkt), Rostgarde (Bunker 13), Ordnungsamt (Ministerium); nur Plünderer aus dem Bausatz tragen die Farbe.
  - Hausmeister → ⚠️ 60 % / 30 %: wütend, schneller, 2 Helfer, Bodenwellen.
  - Nebenaufträge → ⚠️ 5 Start-Aufträge von Schraube und Onkel Sung (Texte und Belohnungen frei erfunden, in der Werkstatt › Aufträge).
  - Tipp im Run → ⚠️ 9 s, unten links.
- **Ergebnis:** Commits `215264d` (Losziehen + Bereit?), `60e8bf4` (Spannungskurve), `694d2c8` (roter Faden + Run-HUD), `df6a188` (Gangs + Boss), `99efa48` (Tipp im Run), `ff88947` (Questlog). Tests: `npm test` 127, alle 32 Browser-Tests grün. PixelLab: 0. **Bitte testen:** Van-Tür → Karte („Bereit?“), Tankstelle plündern (ruhiger Start, harter Schluss, Gelbe Geier), Zielzeile oben rechts, am Lagerfeuer das Questlog (Kabelsalat annehmen, verfolgen), im Ministerium den Hausmeister unter 60 % bringen.

### #017 Beute-Bilanz, Companions mit Aufträgen, Toasts, neue Räume, Technik
- **Status:** fertig (Code, 14.11.) · angelegt 14.11. von Code (Daniels Auswahl aus Avas Liste)
- **Für:** Code
- **Lesen:** `progression.md` (Questlog), `camp.md`, `ui.md`, `pois.md`, `tests.md`, `backlog.md` (C8)
- **Auftrag:**
  1. **Beute-Bilanz am Run-Ende:** Rang, Δ, was neu ist (Rezepte, Techtree, Quest-Fortschritt), Knopf zur passenden Werkstatt.
  2. **Companions reden:** „Reden“ bei Schraube und Onkel Sung bietet ihre Aufträge an, nimmt sie an und ab.
  3. **Toasts weichen Fenstern aus** (Toast verdeckte „Hier plündern“).
  4. **Mehr Raum-Bausteine:** 2–3 neue Räume je POI (Code + vorhandene Kacheln, kein PixelLab).
  5. **Technik:** wackelige Prüfung „Panzerung“ stabil, lokaler Testserver stirbt nicht mehr, große Dateien (`camp.js`, `leyla.js`, `scene.js`) aufteilen.
- **Fertig, wenn:** alles spielbar, Tests grün, Build grün.
- **Rückfragen:**
  - Bilanz-Knopf → ⚠️ Reihenfolge: Auftrag abgeben > Techtree-Knoten bezahlbar > Tank unter 45 % > Werkstatt der neuen Rezepte > Questlog.
  - Companions → ⚠️ „!“ gold = Angebot, „✓“ grün = abgeben; Gespräch statt Spruch, sobald es Aufträge gibt.
  - Neue Räume → ⚠️ 9 Räume, Tankstelle jetzt 4–5 Räume pro Run.
  - Dateien aufteilen → ⚠️ als Methoden-Bündel (Mixins), Code unverändert; weitere Kandidaten später.
- **Ergebnis:** Commits `8d7cf66` (Toasts), `47b102f` (Beute-Bilanz), `ddc2899` (Companions), `02beaab` (Räume), `807315c` (Test-Runner, Panzerung), `70959f1` (Aufteilen + Tests), `9d6b751` (CLAUDE.md). Tests: `npm test` 129, **alle 32 Browser-Tests grün** mit `npm run test:browser`. Korrektur: Nach #016 hatte ich fälschlich „alle grün“ gemeldet (Filterfehler), `pad_test` und `poi_test` waren rot und sind jetzt angepasst. PixelLab: 0. **Bitte testen:** einen Run beenden (Bilanz, goldener Knopf), mit Schraube reden („!“ → Auftrag), Tankstelle mehrmals plündern (neue Räume: Waschstraße, Zapfinseln, Reifenlager mit Secret).

### #018 Symbole für die letzten 16 Dinge ohne Grafik
- **Status:** läuft (Code, 14.11.) · angelegt 14.11. von Code (Daniel: „Welche Gegenstände haben noch keine Grafik“ → „Ja, ein Raster“)
- **Für:** Code
- **Auftrag:** ein Symbol-Raster `icons_misc` (4 × 4 à 64 px, PixelLab, Stil wie `icons_treasure`, AAP-64) für Glühbirne, Kronkorken, Stoffreste, Schrottplatte, Discokugel, Rohrbogen, Auspuffkrümmer, Teleskopantenne, T-Stück, Verkohlter Klumpen, Schrottskulptur, Hochleistungszelle, Turbinenmodul, Schockstab, Schulranzen, Wanderrucksack.
- **Rückfragen:**
- **Ergebnis:**

## Archiv

(noch leer)
