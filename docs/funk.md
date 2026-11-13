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
- **Status:** fertig (Code, 12.11.) · angelegt 12.11. von Ava
- **Für:** Code
- **Lesen:** `docs/features/benches.md` › Gästekoje + Schatzkammer; `tools/treasury_test.mjs`
- **Auftrag:** Daniel, 12.11.2026, zu beiden bisherigen Schatzkammer-Fassungen (Plünderer-Palette, festgezurrte Palette): „keine. Was ich meine ist eine Art trophy room im Cyberpunk Style.“ Die Werkstatt `schatzkammer` bekommt ein neues Bild: Trophäenraum mit Neon-Vitrinen, beleuchteten Sockeln, Holo-Schildern, Wandhalterungen, die Wertsachen wirken ausgestellt und gepflegt. Mechanik bleibt (Lager nur Wertsachen, wächst mit dem Füllstand, 4 Trophäen-Ständer als eigene Inventare, Dinge in echter Größe). PixelLab, AAP-64, Stil passend zu den anderen Werkstatt-Bildern. Erst **3 Kandidaten** als Vorschau erzeugen und im Ticket verlinken, ⚠️ vorläufig den besten einbauen; Daniel wählt endgültig. Alte Fassungen bleiben als Assets (`ws_treasury_v1`, `ws_treasury_alt`).
- **Fertig, wenn:** neues Bild mit Füllstand-Stufen, Ständer-Positionen passen, `treasury_test` grün, Werkstatt zeigt die Fassungen, PixelLab-Verbrauch gemeldet.
- **Rückfragen:** Welcher Kandidat? → ⚠️ vorläufig Kandidat 1 (zwei Neon-Vitrinen, Lochwand mit Holo-Schildern, Sockel im Spotlicht; passt 1:1 auf die vier Ständer). Kandidat 2 = „Hall of Loot“ mit Laser-Vitrine, Kandidat 3 = schwarzer Lack mit Gold, Teppich und Hocker. Bilder: `projects/nomadgirl/assets/workshops/treasury_candidates/cyber_1.png` … `cyber_3.png` (auch als Assets `ws_treasury_cyber_candidate_1…3` in der Werkstatt).
- **Ergebnis:** Assets `ws_treasury_cyber_empty` + `ws_treasury_cyber` (voll = leere Fassung + nur der Beutehaufen aus einem Edit Pro Flash, damit beim Füllen keine Kanten entstehen), Fächer 124/150/172/194, Ständer neu: Vitrine links 1 × 3, Lochwand 4 × 2, Vitrine rechts 2 × 3, Sockel 2 × 2; Maßstab 78 % (sonst schneidet der Container die Vitrinen ab); Effekte: Spotlicht, Vitrinen-Leuchten, Neon unter der Decke abends, Holo-Schilder funkeln. Alte Fassungen bleiben (`ws_treasury`, `ws_treasury_empty`, `ws_treasury_v1`, `ws_treasury_alt`). `treasury_test` 8/8. PixelLab: 39 Generierungen (3 × 10 + 9). Bitte testen: Camp › Schatzkammer im Rig, Wertsachen auf den Haufen, Trophäen in die Vitrinen.

### #004 Menschlicher Raider als Gegner-Grundlage
- **Status:** fertig (Code, 12.11.) · angelegt 12.11. von Code (Auftrag Daniel im Code-Chat)
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
- **Status:** fertig (Code, 12.11.) · angelegt 12.11. von Code (Auftrag Daniel im Code-Chat)
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
- **Status:** fertig (Code, 13.11.) · angelegt 13.11. von Code (Auftrag Daniel im Code-Chat)
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
- **Status:** fertig (Code, 13.11.) · angelegt 13.11. von Code (Auftrag Daniel im Code-Chat)
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
- **Status:** erledigt (Code, 13.11.) · angelegt 13.11. von Code (Auftrag Daniel im Code-Chat)
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
- **Status:** erledigt (Code, 13.11.) · angelegt 13.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** `docs/features/camp.md`, `rig.md`
- **Auftrag (Daniel, 13.11.2026):** „Die Treppen sind zwar hübsch, aber die Perspektiven sind kaputt. Mach sie direkt frontfacing orthogonal wie alle anderen Sachen. Gleiches trifft leider auch auf den Clutter im Camp zu inklusive des Feuers.“ Hintergrund im Camp „ein wenig epischer, ein wenig mehr wie im Intro, aber ohne dass der Style kaputt geht“. Onkel Sung „deutlich größer als Leyla“. Steht ein Container auf dem Dach: keine Solar-Sockel. Solarpaneel kaufen wie Container und Werkstätten (Drag & Drop). Lichterketten verschwinden, sobald sie teilweise aus dem Bild ragen oder man das Fenster verlässt und zurückkommt.
- **Fertig, wenn:** alles oben sichtbar im Spiel, Tests grün, PixelLab gemeldet.
- **Rückfragen:**
- **Ergebnis:** Details in `docs/features/camp.md` (Feinschliff) und `rig.md` (Solar unter Stapeln). Neu von PixelLab, streng von der Seite mit dem Van als Referenz: Treppe, Solarpaneel, Teppich, zwei Stühle, Ecke, Lagerfeuer (animiert, `campfire_side`), Klimagerät, Kisten, Satellitenschüssel. Horizont aus Code (Camp › Horizont). Onkel Sung 240 px. Lichterketten als Bilder. Lichter ohne Kasten (ADD global rein additiv in `main.js`). Tests: `npm test` 98/98, `cozy_test` 18, alle 27 Browser-Tests grün. PixelLab: diesmal 101 Generierungen, übrig 865. **Bitte testen:** Lichterkette halb aus dem Bild schieben und Fenster wechseln, Nacht am Feuer (kein Lichtkasten mehr), Container auf einen anderen stapeln (Solar-Sockel darunter weg), Solarpaneel beim Händler kaufen und aufs Dach ziehen.
  - ⚠️ Solar kaufen lief schon per Drag & Drop wie bei Containern (Händler liefert aufs Pad, dann aufs Dach ziehen); das Paneel war nur als namenlose Kiste zu sehen. Falls du direkt aus dem Katalog ziehen willst: sag Bescheid.
  - ⚠️ Lichterketten-Fehler war bei mir nicht nachzustellen; die Umstellung auf Bilder plus der Mischmodus-Fix sollten es lösen.

## Archiv

(noch leer)
