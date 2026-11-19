# Werkstatt-Editor

Bedienung der Werkstatt (Daten-Editor): Spielen-Knopf und Scroll-Verhalten. Die Grundregeln zu Schema und Speichern stehen in `CLAUDE.md` › Werkstatt und Schema.

- **Spielen** (Daniel, 07.11.2026): goldener Knopf oben links in der Menüleiste (⌘P), dazu „Im Spiel testen“ beim Raum-Layout. Beide speichern vorher (online = Commit) und öffnen das Spiel in einem eigenen Tab `nomadgirl-game`, der bei jedem Klick wiederverwendet wird (Tab wird sofort geöffnet, sonst blockt Safari ihn nach dem Speichern). Ist ein Raum-Baustein mit Layout gewählt, spielt der Knopf diesen Raum, sonst den Testraum. `workshop.play(room?)`.
- **Scrollen bleibt stehen** (Daniel, 08.11.2026: „der Scrollzustand soll immer dort gehalten werden, wo ich gerade in der Navigation unterwegs bin“): `draw()` baut alles neu und setzt danach die Scroll-Positionen zurück: die Bereichsleiste links immer, die Eintragsliste solange man im selben Bereich bleibt (Eintrag anklicken springt nicht mehr nach oben), der Inspektor bei Bearbeiten im selben Eintrag; ein neuer Bereich beginnt oben, ein neuer Eintrag zeigt den Inspektor von oben. Aktiver Bereich und Eintrag werden bei Bedarf ins Bild gerückt. Geprüft in `workshop_test.mjs`.

## Breite Tabellen als Karten (#072)

Daniel, 19.11.2026: „Lass uns auch hier eine Eleganz-Runde drehen, das Interface untersuchen und das gute Stück weiter polieren.“ Tabellen mit mehr als 8 Spalten (Ereignis-Baukasten › Lagen und Antworten, Entities › Begabungen …) zeigen je Zeile eine **Karte**: Kurzzeile mit erster Spalte (ID), Titel/Knopf und bis zu fünf gefüllten Werten; ein Klick klappt das Formular auf, gegliedert in **Grundlage**, **Wann und für wen** (Tageszeit, Gewicht, Gefahr, Gang, Ruf-Bereich, Merker, Braucht …), **Kosten und Lohn**, **Folgen** (Ruf, Merker, Buff, Ort, Marke, Texte danach). Ab 7 Zeilen ein **Suchfeld**. Die Editoren der Zellen sind dieselben wie in der Tabelle (`cardTable` in `game/workshop/workshop.js`, Gruppen `cardGroup`). Schmale Tabellen bleiben Tabellen. Test in `tools/workshop_test.mjs` (Karten, Ändern, Rückgängig, Filter).

## Datensets (#073)

Daniel, 19.11.2026: „Es wäre an der Zeit, Speichern und Laden von verschiedenen Konfigurationen zu erlauben … Im Hauptmenü würde dann unten in der Statusleiste angezeigt werden, welches Datenset gerade aktiv ist.“ Antworten: im Repo als **Variante**, aktiv wählbar in **Hauptmenü + Werkstatt**, pro Gerät.

- **Ablage** (`engine/sets.js`): `projects/nomadgirl/sets/index.json` = `[{ id, name, description, files }]`; `sets/<id>/data/<datei>.json` = nur der Unterschied zum Standard (Kataloge: Eintrag ersetzt, `null` löscht; Einzelbereiche: tief gemischt, `null` löscht einen Schlüssel). `diffArea`/`mergeArea` sind Umkehrungen (Test `test/sets.test.js`).
- **Aktiv** pro Gerät: `localStorage["nomadgirl-set"]`, `?set=<id>` (oder `?set=standard`) geht vor. Das Spiel lädt Standard + Overlay (`applySet` in `game/play/main.js`, Toast „Datenset: …“, `__nomadData.set`).
- **Werkstatt:** Knopf mit dem Namen des Sets in der Kopfleiste (gold, wenn eine Variante aktiv ist) → Dialog **Datensets**: Liste (Standard + Varianten), **Laden** (speichert vorher, macht es aktiv, lädt neu), **Speichern unter …** (die jetzigen Daten, auch Ungespeichertes, werden eine neue Variante; der Standard bleibt), **Löschen** (nur die aktive Variante). Mit aktiver Variante speichert die Werkstatt nur den Unterschied in deren Ordner und hält `files` im Index aktuell; online wie immer als Commit auf `main`.
- **Hauptmenü:** Eintrag **Datenset: …** (Klick oder Controller-A: nächstes Set) und unten in der Statusleiste „Datenset: …“. Liest online `/api/files`, lokal die Werkstatt-Entwürfe, sonst `sets/index.json`.
- Tests: `tools/datasets_test.mjs` (lokal: Speichern unter, Spiel, Hauptmenü, zurück zum Standard), `tools/workshop_cloud_test.mjs` (online: nur der Unterschied als Commit, Index, Hauptmenü, Spiel über `/api/files`).

## Verzahnungs-Ansichten (#074)

Was die Systeme verbindet, sichtbar im Inspektor (`game/workshop/summaries.js`, nur lesend):
- **Ereignis-Baukasten › Merker (n):** jeder Welt-Merker mit „setzt“ (Antworten, Quests beim Annehmen), „löscht“, „braucht“ und „nicht mit“ (Lagen, Quests); rot, wenn ihn niemand setzt oder niemand liest (`flagGraph`). Erster Fund: `laeuferin_verraten` wird gesetzt, aber nirgends gelesen.
- **Ereignis-Baukasten › Geschichten-Ketten (n):** jede Kette vom Anfang an, „Lage —Antwort→ Lage“ (`chainEdges`).
- **Quests › Wann und wo:** Bedingungen (Merker, Tag, Vorgänger, Crew & Rig, setzt Merker) und bei Stücken, wo jedes liegt (POI-Fundstücke mit Kiste/Tresor und Chance, Antworten unterwegs mit Preis); rot, wenn ein Stück nirgends zu finden ist.
- **Marken › Markentreue:** Set-Bonus, wie viele Teile gleichzeitig tragbar sind (ein Teil je Platz, Waffen), Teile je Platz; Warnung, wenn der Bonus nicht erreichbar ist.
- **Werkstätten › Worker:** welche Begabungen hier voll arbeiten (Werkbank oder „Auch“) und mit wie viel Prozent Fremde; die Bit-Farm erklärt sich.
- Tests: `test/workshop_views.test.js`, `tools/workshop_test.mjs`.

## Kleinkram (#075)

- Quests mit Stücken heißen in der Liste „5 Stücke abgeben“, Merker-Quests sagen „nach Merker …“.
- Tabellen können Zeilen benennen (`rowLabel` im Schema): Entities › Stärke zeigt „1 Bit … 5 Bits“.
- „Aussehen“ zeigt kein Bild aus einer Tabellenzeile mehr, wenn der Bereich eine eigene Vorschau hat (Ereignis-Baukasten zeigte das Silo).
- Übersichtskarten zeigen höchstens vier Zeilen Text, der ganze Text steht im Tooltip.
- Datensets › Speichern unter …: Name und Beschreibung (steht in der Liste und im Hauptmenü).

- **Erklärungen antippen** (Daniel, 19.11.2026: Tooltips gehen am iPad nicht): das ⓘ an einem Feld ist ein Knopf und klappt die Erklärung unter dem Feld auf (`hintToggle` in `workshop.js`); mit Maus zeigt Überfahren sie weiter als Tooltip. Bis 980 px Breite (iPad hochkant) werden die drei Spalten schmaler (`workshop.css`).
