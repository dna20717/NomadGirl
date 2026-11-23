# Freischaltungen (Meta-Baum)

Die Systeme kommen dosiert, Stufe für Stufe (#184, #185). Konzept und alle Entscheidungen: `docs/concepts/freischaltungen.md`.

- **Auftrag** (Daniel, 23.11.2026): „Was wir hier gebaut haben, ist im Grunde der Vertical Slice. Im nächsten Schritt gilt es, die Progression so zu schneiden, dass die Systeme dosiert nach und nach auf den Spieler losgelassen werden.“ Der Meta-Baum ist für den Spieler unsichtbar; er erlebt Ziele und Story-Momente. Zum Testen: **Pause-Menü › Cheats › Meta-Baum**.

## Daten

- **Meta-Baum: Stufen** (`data/unlock_stages.json`, Gruppe Grundlagen): an/aus, **Erster POI** + Seed (Stufe 0 nach „Neues Spiel“), Stufen mit „Öffnet ab“ (so viele Systeme der vorigen Stufe müssen frei sein).
- **Meta-Baum: Freischaltungen** (`data/unlocks.json`, Katalog, je System): Stufe, **Meta-Preis** (0 = das erste erfüllte Ziel reicht), **Gesperrt** (ganz raus / unsichtbar / Teaser / als Quest), Teaser-Text, **Dinge des Systems** (Kategorien, die bis dahin als Wertsache gelten), **Ziele** (Tabelle: Art, Zähler, Anzahl, Auftrag, Merker, Ding, System, Meta), **Story-Moment** (wer, Titel, Satz, Lektion), **Geschenk** (Werkstätten).
- Zielarten: von Anfang an, Zähler (die Achievement-Zähler, gezählt ab Spielbeginn bzw. Durchgang), Auftrag erledigt, Merker, ab Tag, Ding im Lager, anderes System frei, weniger Δ als, Stufe offen.
- Felder an anderen Bereichen: Aufträge, Companions, Händler und Lektionen haben **Erst mit Freischaltung**; Gang-Aufträge brauchen immer „Machtspiele“.

## Die 17 Systeme (Startwerte ⚠️ Ava, Feinschliff nach Daniels Durchspielen)

| Stufe | System | Ziel | Gesperrt | Story-Moment / Geschenk |
|---|---|---|---|---|
| 0 Erwachen | Bewegung, Kampf, Benutzen | von Anfang an | unsichtbar | |
| 1 Plündern | Rucksack & Inventar | 1 Kill oder erste Beute | unsichtbar | AvA: „Schau in deinen Rucksack“ |
| | Ein Platz zum Bleiben | 1 POI geschafft oder 1 k.o. | unsichtbar | AvA |
| 2 Unterwegs | Reisen | 2 POIs | Teaser („Der Van springt noch nicht an“) | Schraube · Warroom |
| | Hacking & Entities | 3 POIs + 1 Fahrt (2 Meta) | ganz raus, Entities als Wertsache | AvA |
| 3 Zuhause | Rig bauen & Werkbank | Auftrag „Kabelsalat“ | als Quest | Schraube · Werkbank |
| | Kochen | Auftrag „Fleisch mit Meinung“ (neu, Sung) | als Quest | Sung · Kochnische |
| | Handel | Questkette „Schraube wird Händler“ (Ware → Kasse → erster Kunde, neu) | als Quest | Schraube |
| | Vorschuss | weniger als 50 Δ | unsichtbar | Sung |
| 4 Die Suche | Techtree, Tank-Verfall, Technik/Wissen/Bio, Zerlegen, Hauptquest | Stufe 4 offen | unsichtbar, Ressourcen als Wertsache | AvA: „der Tank piept“ |
| 5 Karawane | Crew, Bewerber, Moral | Stufe 5 offen | unsichtbar | AvA |
| | Lucky Ferro | nach Crew + ab Tag 3 | unsichtbar | sein erster Satz |
| 6 Machtspiele | Gangs/Ruf, Revierkrieg, Kopfgeld, Dunkelheit, Gefangene, Schwarzmarkt, Ghostwire | 3 Zwischenfälle + 6 POIs (2 Meta) | ganz raus, Gefangene als Wertsache | AvA |
| 7 Giganten | Mega-Rigs & Bergung | 10 POIs | ganz raus | Schraube |
| | Cyberware | 8 POIs, nach der Suche | ganz raus, Implantate + ihre Baupläne als Wertsache | AvA |

## Ablauf im Spiel

- **Neues Spiel** (`?camp&new`): `newSave(D, [], { meta: true })` legt `save.meta` auf Stufe 0 an. Werkstätten, die ein System schenkt (Kochnische, Werkbank, Warroom), fehlen im Start-Rig (`withheld`). Dann startet ein Run im **ersten POI** (Mile 7 Gas & Go, Seed 7), das Camp kommt danach. Die Adresse verliert `new`/`cycle` (`history.replaceState`), ein Neuladen fängt nicht neu an.
- **Einmal pro Sekunde** prüft `scene.unlockTick` die Ziele (`checkUnlocks`), schaltet frei, zeigt den Story-Moment als Toast (Wer: „Satz“ · Geschenke) und stellt Geschenke ins Rig (freier Platz, sonst Schrottplatz).
- **Neuer Durchgang** (Daniel: „beim Neustart wählbar“): Pause-Menü › Neues Spiel › „Neuer Durchgang“ behält den Meta-Baum, „Neuer Durchgang, Erinnerungen vergessen“ (`?cycle=fresh`) beginnt bei 0. Alte Spielstände ohne `save.meta` haben alles frei (`metaOf` → `all`).
- **Automatisierte Browser** (`navigator.webdriver`, alle Playwright-Tests) spielen mit allem frei, außer `localStorage` `nomadgirl-unlocks-test` ist gesetzt (`unlock_test`).
- `save.meta = { points, unlocked, goals, pots, stage, base, all? }`; `base` = Zählerstände beim Start (die Achievement-Zähler sind global über alle Slots).

## Die Türen (eine Abfrage: `unlocked(D, save, id)` in `game/unlocks.js`)

- **Inventar:** I/Select im Camp (`scene.inventoryUpdate`); der Boden im Run geht immer und setzt den Merker `beute`. Implantate-Tab (Cyberware), Cyberdeck-Platz und Deck-Raster (Hacking). Dinge verborgener Systeme (`hiddenAs`): Tooltip nur Name, Marke, „Wertsache · lässt sich verkaufen“, keine Einbau-/Lern-/Benutzen-Aktion.
- **Reisen:** Reisekarte „Hinfahren“ gesperrt mit Teaser (`map_ui.action`), „Hier plündern“ geht immer. Ruf-Zeile, Fronten und Heilmittel-Zielzeile auf der Karte erst mit ihren Systemen.
- **Rig bauen:** `scene.openBuild`, Bau-Knopf im HUD, „Rig umbauen“ im Strom-Menü. Händler-Katalog ohne Werkstätten verborgener Systeme (`workshopOpen`: Ripperdoc, Zelle, Bit-Farm …).
- **Werkstätten:** `camp_actions.use`: Kochen, Werkbank, Heavy-Duty, Ripperdoc, Warroom zeigen vorher nur einen Satz; der Cryo-Tank vor Stufe 4 „AvA schläft“.
- **Handel/Vorschuss:** „Handeln“ im Gespräch, Händler an Orten (Händler › Erst mit Freischaltung; Schwarzmarkt und Ghostwire = Machtspiele), Antworten mit Händler auf der Straße.
- **Die Suche:** Tank-Verfall (`tank.update`), Techtree und Auswerten im Warroom, Skilltree im Pause-Menü, Zerlegen-Tab, Hauptquest und Tank im Questlog, Zielzeile im HUD, „Techtree“ in der Beute-Bilanz.
- **Karawane:** Bewerber (`campArrival`), Crew im Feuer-Menü, Crew-Chip; Lucky kommt mit „lucky“.
- **Hacking:** Schalter gehen von Hand, keine Terminals und KIs zum Anzapfen, Türen nur „aufbrechen oder sprengen“, kein freundliches Duell, kein Worker-Chip.
- **Machtspiele:** Ruf zählt still mit (Daniel); keine Ruf-Toasts, kein „Revier:“ im Run-Banner, keine Gang-Gespräche (`turf.near`), keine Gang-Aufträge, kein Revierkrieg (`gangWar`, `takeover`), keine Gefangenen (`capturable`, Antworten), keine Dunkelheit, keine Gefangenen-Meldungen.
- **Mega-Rigs:** `salvage.open` (keine Wracks, keine Bergungs-Quests, keine Teile in Kisten), kein „Umziehen“.
- **Lektionen:** Feldhandbuch nur für freie Systeme (Kapitel Inventar, Rig bauen, Reisen, Fortschritt + einzelne Lektionen; Feld „Erst mit Freischaltung“).

## Tests

`test/unlocks.test.js` (5): Stufe 0 und Start-Rig, Ziele → Meta → frei mit Stufen und Geschenken, ganz raus als Wertsache und Katalog, Tank erst ab Stufe 4 und Aufträge, Durchgang behalten/vergessen. `tools/unlock_test.mjs` (19): Start im ersten POI, erster Kill → Rucksack, Camp ohne Bau-Modus/Reisen/Handel/Implantate, **Spürhund** (Reisekarte, Inventar, Lagerfeuer, Questlog, Pause-Menü nach Wörtern verborgener Systeme), Cheats › Meta-Baum, alles frei.

## Offen / ⚠️ vorläufig

- Alle Ziele und Zahlen sind Startwerte. Hacking schon in Stufe 2 komplett (Daniel wollte „erstes Hacking“ dort und Entities voll erst in Stufe 7: noch nicht getrennt).
- Gang-Frieden und „Kisten unter Zeugen“ im Run laufen weiter, nur ohne Anzeige; Radio, Storylets und Durchsagen erwähnen Gangs weiter als Namen.
- Story-Momente sind Toasts; Dialoge mit Porträt und Lektionen-Karten zum Moment kommen später.
