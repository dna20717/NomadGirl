# Feedback-Knopf (Testphase)

Feedback mitten im Spiel, konkreter als „dieses Level war gut“ (#181).

- **Auftrag** (Daniel, 23.11.2026): „Ich möchte Feedback während des Spiels sammeln, aber konkreter als ‚dieses Level hat mir gut gefallen‘. Wenn der Xbox-Button geklickt wird, soll der Gamestate pausiert werden und der Spieler soll textuell beschreiben können, was gut oder schlecht gewesen ist.“ Danach: „Später wird diese Funktion nicht in diesem Umfang im Spiel sein. Es ist jetzt nur für die Testphase … Ich will ja immer noch ein Spiel machen und keine Feedback-Solution entwickeln ;-)“.
- **Entscheidungen** (Planung im Chat 23.11.): Bilder statt Video, dann nur **ein Bild vom Moment** (die Spur nützt Ava mehr: Sie spielt die Stelle selbst nach). Ablage in einem **privaten Repo** `dna20717/FeedbackBucket`, damit `main` schlank bleibt. Code autark in NomadGirl. Jeder Spieler (hinter dem Access-Login) darf melden.

## Ablauf

1. **Auslöser:** Home-Taste am Controller (Gamepad-Index 16; Windows fängt die Xbox-Taste oft für die Game Bar ab), **Select + Start zusammen** (kommt immer an), Taste **F8**. Ein Pause-Menü, das Start dabei geöffnet hat, geht wieder zu.
2. **Pause:** `hud.feedbackOpen` hält das Spiel an wie jedes Fenster (`scene.update`), die Tastatur von Phaser ist aus, Tasten im Fenster erreichen das Spiel nicht. Nach dem Schließen schluckt das Spiel 8 Frames lang alle Tasten-Flanken (`hud.feedbackSwallow`).
3. **Fenster** (`game/feedback/dialog.js`): Bild vom Moment, Chips **Gut · Schlecht · Bug · Idee · Verwirrend** (Lucide-Icons), Text optional. Controller: Steuerkreuz/Stick wählen, A nimmt (Chip an/aus, Textfeld, Knopf), B bricht ab, Start schickt ab. Tastatur: Esc, Strg+Enter. Abschicken geht, sobald ein Chip oder Text da ist.
4. **Senden** (`send.js`): `POST /api/feedback`. Ohne Worker (lokal, offline) wartet das Feedback in diesem Browser (`localStorage` `nomadgirl-feedback-queue`, höchstens 5, zur Not ohne Bild) und geht beim nächsten Start oder nach dem nächsten erfolgreichen Senden raus.
5. **Worker** (`worker/feedback.js`): legt ein Issue in FeedbackBucket an (`FB-<n> · <Art> · <Ort>`, Labels `nomadgirl` + Art), schreibt `media/nomadgirl/FB-<n>/moment.webp` + `trace.json` als einen Commit dort und füllt das Issue: Text, Bild, Tabelle (Modus, POI + Seed, Raum, Kachel, Leben, Fenster, Durchgang, Version, Datenset, Controller, Browser, fps), **Nachspiel-Zeile** für `tools/play.mjs`, Spur-Zusammenfassung, letzte Fehler. Keine E-Mail im Issue. Grenzen: Bild 400 KB, Spur 1 MB.
6. **JS-Fehler:** unten links „Da lief was schief.“ mit **Melden** (öffnet mit Chip Bug), je Fehlertext einmal pro Sitzung, verschwindet nach 9 s. Fehler und `console.error` landen immer in der Spur.

## Spur (`recorder.js`)

Ohne DOM, die letzten **30 s**: alle 15 Frames ein kleiner Zustand (Modus, Raum, Position, Kachel, Tempo, Zustand, Leben, Munition, Kills, Gegner in der Nähe, Hinweis, offenes Fenster), Eingaben nur bei Wechsel (`{ t, held: 'right+jump' }`, aus `scene.lastInput`), Ereignisse (Modus, Raum, Fenster, Kill, Treffer, k.o.), Fehler gebündelt, fps (Schnitt + schlimmster Frame). Zeiten in ms relativ zum Moment des Drückens. Typisch: Bild ≈ 30 KB, Spur ≈ 30 KB.

## Dateien

```
game/feedback/index.js       installFeedback(adapter, config): Auslöser, Fehler-Hinweis, Ablauf
game/feedback/recorder.js    Spur (ohne DOM)
game/feedback/dialog.js      Fenster
game/feedback/send.js        Senden + Warteschlange
game/feedback/feedback.css   nur --ui-*-Tokens
game/play/feedback_adapter.js   alles, was das Kit über NomadGirl weiß (Pause, Bild, Ort, Nachspiel-Zeile, Spur je Frame)
worker/feedback.js           /api/feedback → FeedbackBucket
```

**Rausnehmen nach der Testphase:** `game/feedback/`, `feedback_adapter.js`, `worker/feedback.js` löschen; in `main.js` die zwei Zeilen, in `scene.js` den Block `#181`, in `worker/index.js` die Route, im Schema den Abschnitt „Feedback (Testphase)“.

## Einstellungen

Spiel › **Feedback (Testphase)**: an/aus, Controller-Knopf (Vorgabe Home 16), Select + Start, Taste (F8), Spur-Sekunden (30), jeder n-te Frame (15), Bildbreite (640), bei JS-Fehler anbieten.

## Einrichten (online)

Der Worker nutzt denselben `GITHUB_TOKEN` wie die Werkstatt. Der fein abgestufte Token braucht zusätzlich Zugriff auf **FeedbackBucket** mit **Contents** und **Issues: Read and write**. Ziel ändern: Variable `FEEDBACK_REPO` (`owner/name`).

## Abarbeiten (Ava)

Issues in FeedbackBucket lesen (GitHub-Werkzeuge, Repo per `add_repo`), `trace.json` und Bild aus `media/nomadgirl/FB-<n>/`, Stelle mit der Nachspiel-Zeile ansehen. Commits in NomadGirl nennen `FB-<n>` ausgeschrieben (nicht `#<n>`, das wäre ein Funk-Ticket bzw. ein NomadGirl-Issue).

## Tests

`test/feedback.test.js` (Worker gegen falsches GitHub: Issue + Commit in FeedbackBucket, NomadGirl unberührt, Prüfung, Login; Spur-Fenster), `tools/feedback_test.mjs` (19: Spur 30 s, F8 pausiert, Bild, Tasten erreichen Leyla nicht, Esc, Select + Start ohne Pause-Menü, Steuerkreuz/A/Start, Warteschlange ohne Worker, FB-7 mit Worker + Warteschlange geleert, JS-Fehler-Hinweis, einmal je Fehler).
