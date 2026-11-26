# Testing-Personas

Fünf Spielerinnen und Spieler, mit denen Ava NomadGirl gezielt durchspielt (Daniel, 26.11.2026: „definiere 3 bis 5 testing personas von Gelegenheitsspielerin über cosy gamer bis zum hardcore zocker“). Grundlage sind die Spielertypen von **Richard Bartle** (1996): **Achiever** (Erfolgsjäger), **Explorer** (Entdecker), **Socializer** (Geselliger), **Killer** (Wettkämpfer). Jede Persona mischt zwei davon.

| ID | Persona | Bartle-Mix | Gerät | Spielt |
|---|---|---|---|---|
| `jana` | Jana, Gelegenheitsspielerin | Socializer > Explorer | Laptop, Tastatur + Touchpad, 1366×768 | 20 min abends |
| `malu` | Malu, Cosy-Gamerin | Socializer + Explorer | Xbox-Controller am TV, 1920×1080 | 1–2 h am Wochenende |
| `ole` | Ole, Entdecker | Explorer > Achiever | Controller, Ultrawide 3440×1440 | lange Sessions, liest alles |
| `deniz` | Deniz, Sammlerin und Optimiererin | Achiever > Explorer | Maus + Tastatur, 2560×1440 | regelmäßig, mit Plan |
| `kai` | Kai, Hardcore-Zocker | Killer + Achiever | Controller, 144 Hz, 1920×1080 | jede freie Minute, Speedruns |

## Jana, Gelegenheitsspielerin (`jana`)

- **Motivation:** abschalten, eine kleine Geschichte, schnelle Erfolgserlebnisse. Liest Tipps nur halb, will nie das Gefühl haben, etwas falsch zu machen.
- **Spielt:** Intro, erster Run im Lehrpfad, zurück ins Camp, einmal kochen, Spiel schließen, am nächsten Tag weiterspielen.
- **Testet:** Einstieg, Lehrpfad, Lesbarkeit der Hinweise, Tastatur ohne Controller, Speichern und Weiterspielen, kleine Bildschirme.
- **Stolpert über:** Tastenkombis, zu viel Text auf einmal, unklare Ziele, Tod ohne Erklärung.
- **Bestanden, wenn:** sie nach 20 Minuten weiß, was sie als Nächstes tun will.

## Malu, Cosy-Gamerin (`malu`)

- **Motivation:** ihr Rig gemütlich machen, kochen, die Crew kennenlernen, Radio hören. Kämpfe sind Mittel zum Zweck.
- **Spielt:** CampMode lange: bauen, Deko, Lichterketten, Werkstätten, Kochen und Craften, Gespräche mit Sung und Schraube, Händler, Tag und Nacht, Radio.
- **Testet:** Bau-Modus mit Controller, Gemütlichkeit, ob das Camp ohne Kampfdruck trägt, Inventar-Tetris in Ruhe.
- **Stolpert über:** fummelige Bau-Steuerung, harte Kämpfe als Pflicht, verlorene Beute beim k.o.
- **Bestanden, wenn:** sie eine halbe Stunde nur im Camp verbringt und es sich wie ihr Zuhause anfühlt.

## Ole, Entdecker (`ole`)

- **Motivation:** jede Ecke sehen, Secrets finden, Lore lesen, Mechaniken ausreizen (an AvA hängen, Dächer, Abkürzungen).
- **Spielt:** POI-Level gründlich, Wände abklopfen, Abkürzungen nehmen, Reisekarte und Zwischenfälle, Lore-Datenbank, Ränder der Welt.
- **Testet:** Secrets und Abkürzungen, Klettern und Kanten, AvA als Plattform, Welt-Logik, Ultrawide.
- **Stolpert über:** unsichtbare Wände, Secrets ohne Hinweis, Wege, die gemeint sind, aber nicht gehen.
- **Bestanden, wenn:** er etwas zeigt, das Daniel selbst noch nicht kannte.

## Deniz, Sammlerin und Optimiererin (`deniz`)

- **Motivation:** Rang S, alle Achievements, volles Rezeptbuch, das effizienteste Rig. Sie rechnet nach.
- **Spielt:** denselben POI mehrmals auf Rang, Händler und Vorschuss durchrechnen, Techtree und Cyberware planen, Inventar sortieren.
- **Testet:** Ranking und Bilanz, Wirtschaft, Techtree, Meta-Baum, Werte im Inventar, Balancing (`docs/balancing.md`).
- **Stolpert über:** undurchsichtige Werte, Zahlen, die nicht stimmen, Exploits, Grind ohne Fortschritt.
- **Bestanden, wenn:** sie eine eigene Strategie hat und begründen kann.

## Kai, Hardcore-Zocker (`kai`)

- **Motivation:** Kampf, Tempo, Bestzeiten, Duelle, Schwierigkeit. Er will gegen das Spiel gewinnen.
- **Spielt:** ActionMode auf Bestzeit, Kombos, Dash, Würfe, Wende-Wurf, Glitch-Duell (/duel, /mobile).
- **Testet:** Gegner-KI, Hitboxen, Eingaben unter Stress, Controller-Reaktion, Performance.
- **Stolpert über:** Input-Lag, Animationen, die Eingaben schlucken, zu leichte Gegner, Cheese-Strategien.
- **Bestanden, wenn:** er einen Run neu startet, weil er ihn schneller schaffen will.

## Befunde melden: übers Formular

Daniel, 26.11.2026: „ihre Befunde posten sie wie ich oder Steven über das Formular, damit es konsistent ist.“ Personas schreiben **keine** Issues von Hand. Jeder Befund geht durch den Feedback-Knopf im Spiel (#181): F8, Chip, Text, Abschicken. So haben ihre Meldungen dasselbe Bild vom Moment, dieselbe 30-s-Spur, dieselbe Nachspiel-Zeile und dieselbe Form wie die von Menschen.

**Werkzeug:** `tools/persona_feedback.mjs` spielt im kopflosen Browser, öffnet das echte Formular mit F8, klickt den Chip, tippt den Text und drückt „Abschicken“. Der Text stammt von der Persona, in ihrer Stimme und mit ihrem Gerät (Bildschirmgröße, Controller ja/nein).

```
node tools/persona_feedback.mjs --persona ole --chip bug --text "…" [--url 'http://localhost:8766/game.html?poi=tankstelle_km7&seed=7'] [--do "nomad.tpTile(58, 24)"]
```

- **Online-Worker erreichbar** (mit Login): das Formular schickt direkt an `/api/feedback`, das Issue entsteht wie bei Daniel und Steven.
- **In der Cloud-Sitzung** (kein Login): das Werkzeug fängt genau die Anfrage des Formulars ab und legt sie unter `output/persona/<zeit>_<persona>/payload.json` ab. Mit `--post <payload> --number <n> --bucket <Klon von FeedbackBucket>` schreibt es Bild und Spur nach `media/nomadgirl/FB-<n>/` und den Issue-Text mit derselben Funktion wie der Worker (`issueBody` aus `worker/feedback.js`) nach `issue.md`. Ava legt das Issue an (Labels `nomadgirl`, Chip, `persona`), pusht den Klon und setzt den Text ein.
- **Gemeldet von** „Persona Ole (Ava)“, damit jede Meldung als Persona erkennbar bleibt.
- Personas melden, was ihnen als dieser Spielertyp auffällt, nicht alles, was Ava im Code sieht. Code-Befunde gehören ins Funkbuch.

## Testpilot (#191)

Eine sechste „Persona“ ohne Spielertyp: **`pilot`** geht bei jedem Camp-Besuch alle Systeme durch, für die es eine Fähigkeit gibt, und reist bei jeder zweiten Abfahrt. Läuft **nur auf Zuruf** (Daniel, 26.11.2026):

```
npm run testpilot                                     # 2 h Spielzeit, ~10–15 Rechenminuten
node tools/persona_bot.mjs --persona pilot --hours 5  # länger
```

- **Fähigkeiten** (`tools/persona_bot/skills.js`), alle über die echten Fenster und ihre Funktionen: **Reisen** (Karte am Van, ein Nachbarort mit POI zuerst, Fahrt vorspulen, Zwischenfälle beantworten), **Bauen** (eine Werkstatt aus dem Schrottplatz in einen Platz des Rigs ziehen, mit dem Zeiger des Bau-Modus; Leyla schraubt), **Kochen** (ein fertiges Rezept an der Kochnische), **Zerlegen** (an der Werkbank, gibt Technik), **Techtree** (der erste bezahlbare Knoten), **Tank warten** (ein Wartungsrezept am Cryo-Tank). Seit #192 auch **Duell** (KI-Automaten und KI-Terminals im Run: ein paar echte Züge, dann zu Ende), **Handel** (bei Schraube verkaufen und kaufen), **Crew** (Bewerber aufnehmen, Job geben) und **Rückwand-Türen** in der Wegfindung. Dazu wie alle Personas Runs, Kampf, Beute, Händler-Fenster, Schlafen.
- **Prüfer** (`tools/persona_bot/checks.js`) laufen nach jedem Häppchen bei allen Personas mit: ein HUD-Teil je Art (Wurf-Anzeige, Boden-Leiste, Notizen), Level-Texturen wachsen nicht von Camp zu Camp, Raider-Cache in seiner Grenze, Werte im Rahmen (Δ, Leben, Tank), nichts bewegt sich (Softlock), **Spielstand speichern + laden** ohne Verlust (alle 10 Spielminuten), JS-Fehler.
- **Abdeckung:** `output/persona_play/<persona>/report.md` und `coverage.json`: was berührt wurde (Fenster, Menüpunkte, Rezepte, Knoten, Orte, POIs, Zwischenfälle, Umbauten) und was es gibt, aber nie berührt wurde.
- Befunde prüft Ava wie bei den Personas und meldet sie dann übers Formular.
