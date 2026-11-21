# Konzept: Info-Center (Bühne für Einblendungen + Logbuch)

Stand 21.11.2026, Ticket **#129**. Daniel: „Einblendungen ordnen: lass uns ein Information Center konzipieren, um das auch in Zukunft zu vermeiden. In diesem Rahmen können wir auch ein Log für den Spieler aufbereiten, in dem er alle Schritte nachvollziehen kann und ggf. historische Meldungen anschauen kann.“
Baut auf **#070 Meldungs-Kanal + Logbuch** auf (`docs/features/ui.md`). Alles mit ⚠️ ist vorläufig entschieden, offene Fragen am Ende.

**Anlass (Screenshots):** Beim Camp-Start stapeln sich Toast „Willkommen im Camp“, Ziel-Karte, Now-Playing-Kassette, Sprechblase und E-Hinweis. Im Bau-Modus liegt der Willkommens-Toast über den Reitern der Bau-Leiste, die Kassette rechts unten über Bau-Zielen.

## 1. Ist-Zustand: alles, was auf dem Schirm erscheint

Referenz 1920×1080. „Eigner“ = wer das Element setzt.

| # | Element | Code | Platz | Lebensdauer | Bemerkung |
|---|---|---|---|---|---|
| 1 | **Toast** | `hud.toast` `game/play/hud.js:400`, CSS `.hud-toasts` `play.css:74` | oben rechts ab `--toast-top` (unter der Status-Spalte, `hud.js:497`) | 4,2 s Standard, `ms 0` bleibt mit ✕ | 11 Arten (`TOAST_KINDS` `hud.js:19`), max. 5 sichtbar, ab 3 warten `info`/`travel` (`TOAST_MAX`, `WAITS` `hud.js:34`), Duplikat nickt |
| 2 | **Banner** | `hud.banner` `hud.js:368` | wie Toast, etwas größer | 3,5 s, `0` bleibt | ersetzt den vorigen Banner; zählt nicht für `TOAST_MAX` |
| 3 | Toast bei offenem Fenster | `.hud-windowed` `hud.js:437`, `play.css:77` | oben Mitte, kompakt, z 60 | wie 1 | gilt auch für den Bau-Modus: dort liegt er über `.bm-bar` (`play.css:444`, top 10 px, volle Breite) → **Bug Reiter verdeckt** |
| 4 | **Status-Spalte** (Uhr · Ort, Δ, Sprit, Vorräte, AvA, Effekt-Chips, **Ziel-Karte**) | `campEl` `hud.js:489–495`, `goalEl` `hud.js:535`, CSS `.hud-camp` `play.css:141` | Camp oben rechts, Run unten rechts (`play.css:142`) | dauernd | im Bau-Modus versteckt (`play.css:506`) |
| 5 | **E-Hinweis** | `hud.prompt` `hud.js:201`, CSS `play.css:168/719` | unten Mitte, 3 % vom Rand | solange in Reichweite | hinter Fenstern aus (`hud.js:436`) |
| 6 | Vitals, Munition, Dash, Kills, Run-Δ | `hud.js:45–51`, `.hud-top` `play.css:35` | oben links / oben rechts | dauernd | |
| 7 | **Raumtitel** | `hud.roomTitle` `hud.js:355`, `.room-title` `play.css:1058` | Band quer bei 24 % Höhe | ein- und ausblenden | Run, neue Räume (`scene_events.js:227`) |
| 8 | **Radio-Chip** + DJ-Text | `RadioUI` `game/play/radio_ui.js:18`, `.radio-chip` `play.css:1125` | unten rechts (right 20, bottom 12) | dauernd; Durchsage wächst bis `50vw − 260px` (`play.css:1133`) | |
| 9 | **Now-Playing-Kassette** | `nowPlaying` `game/now_playing.js:25` (aus `camp_life.js:32`, `drive_ui.js:78`, Splash) | unten rechts, bottom 64 px, **z 9000** | 5,2 s | eigenes CSS, ignoriert HUD-Zustände → **Bug Bau-Ziele verdeckt** |
| 10 | **Lektions-Tipp** | `Tutorial.showTip` `game/play/tutorial.js:174`, `.tut-tip` `play.css:853` | unten links, bottom 64 | `tutorial.tipSeconds` (9 s) | im Run statt Karte |
| 11 | Lektions-Karte, Menüs, Gespräch (`hud.menu` mit `talk`), Inventar, Kochen, Techtree, Karte, Questlog, Achievements, Glitch-Duell (`glitch_duel_ui.js:20`) | diverse `*_ui.js` | Mitte, Vollbild-Fenster | modal | pausieren das Spiel |
| 12 | **Bau-Meldung** | `build_mode.say` `game/play/build_mode.js:534`, `.bm-msg` `play.css:452` | unten Mitte, bottom 96 | 3,2 s | 52 Aufrufe in `build_*.js`; wird **nicht** geloggt |
| 13 | Koch-Meldung | `craft_ui.say` `game/play/craft_ui.js:310` | im Fenster | bis zur nächsten | nicht geloggt |
| 14 | **Sprechblase Crew** | `camp_life.say/bark` `game/play/camp_life.js:151/175`, Takt `camp.js:1238` | Welt, über dem Kopf | 4 s (`companions.barkTime`), zufällig alle 7–15 s | verdeckt ihr „!“; liegt beim Camp-Start oft über E-Hinweis/Toast-Ecke |
| 15 | AvA-Kaomoji | `drone.js:91/135` | Welt, an AvA | Stimmung | |
| 16 | Gegner-Rufe „?!“, Schaden, Block, „leer“, „+1 Ding“ | `Enemy.say` `game/play/enemies.js:126` → `fx.text` | Welt | steigen auf, ~1 s | bleiben in der Welt (#014) |
| 17 | Fahrt-HUD, Zwischenfälle | `drive_ui.js:30` `.dv-hud` | Vollbild | Fahrt | blendet `.hud-foot`/Prompt aus (`play.css:1115`) |

**Aufrufer:** 103 Stellen `toast`/`banner` in 17 Dateien (am meisten `scene_events.js` 22, `camp_actions.js` 21, `scene.js` 10, `poi_level.js` 9, `hud.js` 9, `turf.js` 8). Arten: info 22, warn 20, good 19, drama 5, travel 4, recipe 4, loot 3, Rest einzeln.

**Logbuch heute:** `save.journal` (`hud.js:386`), Einträge `{ at: clockText, title, sub, kind }`, die neuesten 150; Menü › Logbuch (`hud.js:393`) zeigt 40 als Menüliste ohne Filter. Ein `save.log` gibt es nicht. Bau-, Koch-, Radio- und Gesprächszeilen fehlen; Schritte ohne Toast (Run gestartet, Run-Bilanz, Fahrt, Kauf) auch.

**Ursache in einem Satz:** Jedes Element positioniert sich selbst per `position: fixed`, nur der Toast kennt Fenster (`.hud-windowed`), und niemand weiß, was gerade sonst steht.

## 2. Die Bühne: feste Plätze mit einem Eigner

Ein Container `#stage` über dem Canvas mit CSS-Grid; jedes Element hängt in **genau einer Zone** und positioniert sich nicht mehr selbst. Zonen überlappen per Konstruktion nicht.

```
┌──────────────────────────────────────────────────────────────┐
│ A Vitals            B Ansage (1)              C Status       │
│ (oben links)        (oben Mitte)              (oben rechts)  │
│                                               D Meldungen ≤3 │
│                                               (darunter)     │
│                      W  Welt (Blasen, Zahlen, Rufe)          │
│                                                              │
│ F Lehre (Tipp)       E Aktion (E-Hinweis / Bau-Zeile)  G Medien│
└──────────────────────────────────────────────────────────────┘
                 M  Fenster (Mitte, modal, über allem)
```

| Zone | Eigner | Inhalt | max. | Regel |
|---|---|---|---|---|
| **A Vitals** | `hud` | Leben, Ausdauer, Munition, Dash | – | fix |
| **B Ansage** | Info-Center | Banner (Ankunft, k.o., Raum geräumt, Boss-Phase), **Raumtitel** | 1 | eine zur Zeit, Rest wartet; Raumtitel ist eine Ansage der Art `title` |
| **C Status** | `hud` | Uhr · Ort, Δ, Sprit, Vorräte, AvA, Effekt-Chips, Ziel-Karte | – | Höhe wird gemessen, D beginnt darunter (wie heute `--toast-top`, aber als Grid-Zeile) |
| **D Meldungen** | Info-Center | Toasts | 3 (+1 kritisch) | Vorrang siehe 3 |
| **E Aktion** | Szene / Bau-Modus | E-Hinweis, im Bau-Modus die Bau-Meldung (`bm-msg` zieht hierher) | 1 | Bau-Meldung und E-Hinweis schließen sich aus |
| **F Lehre** | `Tutorial` | Lektions-Tipp | 1 | wartet, solange B steht |
| **G Medien** | Info-Center | Radio-Chip, Kassette, DJ-Durchsage | 1 Karte | Kassette = Medien-Meldung, Radio-Chip schrumpft solange auf das Symbol |
| **W Welt** | Phaser | Sprechblasen, Rufe, Zahlen | – | Blasen meiden die Bildschirm-Rechtecke von B, D, E (Abschnitt 4) |
| **M Fenster** | `ui_nav` | alle Fenster | 1 | setzt den **Kontext** (Abschnitt 4) |

Run: C wandert wie heute nach unten rechts; dann stehen C und G übereinander in einer Spalte (G unter C), D bleibt oben rechts. ⚠️ vorläufig.

## 3. Vorrang, Warteschlange, Zusammenfassen

Jede Meldung bekommt eine **Stufe** (aus der Art, überschreibbar je Aufruf):

| Stufe | Arten heute | Verhalten |
|---|---|---|
| **kritisch** | `drama` (k.o., AvA fort, Boss wütend) | sofort in B; verdrängt eine laufende Ansage; Ton immer |
| **warn** | `warn` | sofort in D; ist D voll, geht die älteste `info` zurück in die Schlange |
| **lohn** | `good`, `loot`, `heal`, `trophy`, `recipe`, `secret` | sofort, wenn Platz; sonst **vorne** in die Schlange |
| **info** | `info`, `travel`, `camp` | Schlange (wie #070) |
| **leise** | Radio-Titel, DJ, Crew-Plaudern, Bau-Hinweise `idle` | nur bei ruhiger Bühne; **verfällt** nach `stale` s statt zu warten; landet trotzdem im Logbuch |

- **Zusammenfassen:** gleicher `key` (Standard: Titel + Untertitel) innerhalb des Sichtfensters nickt und zählt („×3“). Zusätzlich **Gruppen** (`group`): „Beute“ fasst Aufheben innerhalb 1,5 s zu „Beute: Schrott ×2, Kabel“ zusammen, „Ruf“ fasst Ruf-Änderungen eines Abends zusammen. Ein zusammengefasster Eintrag ist im Logbuch **ein** Eintrag mit `n`.
- **Höchstens:** D 3 sichtbar + 1 Platz nur für `warn`/kritisch; B 1; G 1. Die Schlange ist begrenzt (Standard 8); was rausfällt, zählt das Abzeichen „+4 im Logbuch“ am Ende von D (öffnet das Logbuch).
- **Mindeststandzeit:** keine Meldung verschwindet vor 1,2 s, damit nichts flackert.
- **Ton:** einer je Schub (wie heute 120 ms), Stufe `leise` ohne Ton.

## 4. Kontexte und Ducken

Das Info-Center kennt den **Kontext** (eine Zahl wie heute `.hud-windowed`, aber benannt). Je Kontext eine Tabelle, welche Zonen leben und ab welcher Stufe gezeigt wird:

| Kontext | gesetzt von | B Ansage | D Meldungen | G Medien | E Aktion | F Lehre | Blasen |
|---|---|---|---|---|---|---|---|
| `play` | Standard | ja | ja | ja | E-Hinweis | ja | ja |
| `arrive` | Camp-Start, 6 s ⚠️ | Willkommen | nur ab warn, Rest wartet | Kassette erst danach | ja | wartet | **aus** |
| `build` | Bau-Modus | wartet | kompakt **links unter** `.bm-bar`, nie über Reitern, ab lohn | **aus** (Titel nur ins Logbuch) | Bau-Meldung | aus | aus |
| `window` | Inventar, Kochen, Techtree, Karte, Questlog … | wartet | kompakt oben Mitte (wie #017), ab lohn | Chip ohne Kassette | aus | aus | – |
| `talk` | Gespräch (`hud.menu` mit `talk`) | wartet | ab warn | aus | aus | aus | aus |
| `duel` | Glitch-Duell | wartet | ab warn | Chip | aus | aus | – |
| `drive` | Fahrt | Zwischenfall-Ansage | ja | ja | aus | aus | – |
| `cutscene` | Intro, Traum, k.o.-Abblende | nur kritisch | aus | aus | aus | aus | aus |

Beim Verlassen eines Kontexts läuft die Schlange in Vorrangsfolge ab (je 400 ms versetzt, nicht alles auf einmal).

**Auftakt im Camp** (Fall aus dem Screenshot), Ablauf in `arrive`:
1. 0 s: Ansage „Willkommen im Camp“ in B (oben Mitte), Status C baut sich auf, die Ziel-Karte glimmt einmal.
2. 3,5 s: Ansage geht; wartende `info` kommen nacheinander in D.
3. 6 s: Kontext `play`; jetzt erst Kassette (G) und das erste Crew-Plaudern (`companions.barkDelay`).
Der E-Hinweis darf sofort, er steht in E und trifft niemanden.

**Sprechblasen (W):** Blasen werden nach dem Platzieren gegen die Bildschirm-Rechtecke von B, D, E geprüft und rutschen nach oben bzw. werden im Zweifel unterdrückt; eine Blase der Person, deren E-Hinweis gerade steht, darf, die übrigen schweigen (eine Stimme zur Zeit). Gegner-Rufe und Zahlen bleiben frei.

## 5. Bauweise

- **`game/info_center.js`** (ohne DOM, Node-testbar): `post(msg)`, `tick(now)`, `setContext(id)`, `visible()` → `{ B, D, G, queue, dropped }`, `record(entry)` (nur Logbuch). Regeln aus den Daten (Abschnitt 8). Etwa 200 Zeilen.
- **`game/play/stage.js`** (DOM): baut `#stage` mit den Zonen, rendert `visible()`; die bestehenden Elemente (`toastsEl`, `promptEl`, `campEl`, Radio-Chip, Tipp) werden in ihre Zone gehängt statt `position: fixed`. Etwa 150 Zeilen + CSS.
- **Meldung:** `{ title, sub, kind, level?, cat?, key?, group?, zone?, ms?, log = true, ref? }`. `ref` zeigt auf Inhalt (`{ area: 'quests', id }`), damit das Logbuch dorthin springen kann.
- **Rückwärts verträglich:** `hud.toast(title, sub, kind, ms, o)` und `hud.banner(...)` bleiben als dünne Hüllen um `info.post`; `bannerText()`, `toastLog` und `liveToasts()` für die Tests bleiben. Kein Aufrufer muss am ersten Tag geändert werden.
- `nowPlaying()` bekommt eine Option `host`: im Spiel rendert es in G und fragt das Info-Center; Splash/Intro ohne Host wie heute.

### Zuordnung der Aufrufer (Migration)

| Heute | Neu | Kategorie | Hinweis |
|---|---|---|---|
| `hud.banner` (Ankunft, Tageszeit, k.o., Raum geräumt) `scene_events.js:23–55`, `main.js:106`, `camp_salvage.js:144` | Ansage B, Stufe aus Art | Kampf / Camp / System | `drama` = kritisch |
| `hud.roomTitle` `hud.js:355` | Ansage B, Art `title`, `log: false` ⚠️ (der Raum steht im Run-Eintrag) | – | wartet nicht, verfällt nach 2 s |
| Achievement, Rezept, Farbe gelernt `scene_events.js:107–182` | D, lohn | Fortschritt | `ref` auf Achievement/Rezept |
| Auftrag neu/angenommen/erledigt `camp_actions.js:369`, `camp_board.js:106`, `camp_life.js:166`, `hud.js:479` | D, lohn/info | Quest | `ref` Quest |
| Crew: Stimmung, Bewerber, Gefangene `scene_events.js:157–175` | D | Crew | Gefangenen-Tod = warn |
| Revier, Gang-Funk `turf.js`, `scene_events.js:157` | D, info | Reise / Kampf | Gruppe „Ruf“ |
| Händler, Kaufen/Verkaufen `camp_actions.js` | D, info | Handel | |
| Inventar-Hinweise (`notify`), Rucksack voll/zurück `scene_events.js:86` | D, info/lohn | Beute | Gruppe „Beute“ |
| `build_mode.say` (52 Stellen in `build_*.js`) | E im Kontext `build`, `log` nur bei `ok` | Camp | `error`/`idle` gehen nicht ins Logbuch ⚠️ |
| `craft_ui.say` | bleibt im Fenster, `info.record` bei Erfolg/Fehlschlag | Camp | |
| `nowPlaying` `camp_life.js:32`, `drive_ui.js:78` | G, leise | Radio | |
| DJ-Durchsage `radio_ui.js:53` | G, leise | Radio | Gerüchte/Front zusätzlich `record` in Reise |
| Lektions-Tipp `tutorial.js:174` | F | – | wartet auf B |
| Crew-Plaudern `camp_life.js:175` | W, gesteuert über Kontext | – | `log` nur bei „Plaudern“ (Leyla fragt) |
| Cheat, Ton an/aus, Vibration `hud.js:158–173` | D, info | System | |

## 6. Das Logbuch für die Spielerin

**Kategorien** (Lucide-Icon, Farbe aus `--ui-*`): **Quest** (flag), **Beute** (bags: Funde, Rucksack, Kisten, Secrets), **Handel** (Δ: Kauf, Verkauf, Preise), **Kampf** (skull: k.o., Boss, Raum geräumt, Run-Bilanz), **Crew** (people: Stimmung, Bewerber, Gefangene, Gespräche), **Reise** (map: Fahrt, Zwischenfälle, Wetter, Revier, Gerüchte), **Camp** (moon: Bauen, Ernte, Kochen, Werkstätten), **Fortschritt** (trophy: Achievements, Techtree, Rezepte, Implantate), **Radio** (gehörte Titel, aus im Standard-Filter), **System** (settings: Ton, Speichern, Spielstand).

**Was aufgezeichnet wird:**
- alle Meldungen mit `log` (heute schon alle Toasts);
- **Schritte ohne Toast** über `info.record`: Run gestartet (POI, Gefahr, Wetter), Run beendet mit Bilanz aus `game/summary.js` (Rang, Δ, neu Gelerntes), Fahrt von → nach (Sprit, Stunden), Zwischenfall + gewählte Antwort, Kauf/Verkauf mit Betrag, Auftrag angenommen/abgegeben, Crew kommt/geht, Durchgang endet;
- Eintrag: `{ t, at, day, cat, kind, title, sub, n, ref, run }` (`t` = Ereignis-Zeit in Stunden aus `game/save.js`, `run` = POI-ID, wenn im Run).

**Aufbewahren:** `save.journal` bleibt der Ort (Umzug alter Einträge: `cat` aus `kind` abgeleitet, `t` aus `at` geschätzt). Standard **400** Einträge, dazu **wichtige** (Quest, Fortschritt, Crew kommt/geht/stirbt, Durchgang) dauerhaft bis 300 ⚠️. Ein neuer Durchgang setzt einen Trenner „Traum 2 beginnt“ und behält das Logbuch ⚠️ (Leyla erinnert sich, passt zu `docs/design.md` „Alle vergessen, Leyla nicht“). Geschätzt 60–90 KB bei vollem Logbuch, unter `SAVE_MAX` 256 KB, aber spürbar → Kürzen der Untertitel alter Einträge, wenn der Stand 180 KB überschreitet.

**Fenster:** ein Reiter **Logbuch** im Inventar (neben Ausrüstung, Implantate, Van, Werte, wie #104) und Pause-Menü › Logbuch öffnet ihn.
- Kopf: Kategorie-Reiter (Alle · Quest · Beute · … ; Q bzw. LB/RB), rechts Filter „Nur Wichtiges“ und „Dieser Run“, Suchfeld (Tastatur, Maus).
- Liste nach Tagen gruppiert („Tag 4 · Großmarkt“), neueste oben, je Zeile Icon, Uhrzeit, Titel, Untertitel, „×3“; Runs als aufklappbare Gruppe mit ihrer Bilanz als Kopfzeile.
- Auswahl: Detail rechts (alles, was der Eintrag weiß) und **Zeigen** (Y / F) springt per `ref` ins Questlog, Rezeptbuch, Achievements, Karte oder zum Gegenstand.
- Controller: Stick/Steuerkreuz wählt, A klappt auf, X schaltet „Nur Wichtiges“, Y = Zeigen, B zurück; die Suche gibt es nur mit Tastatur ⚠️ (am Controller reichen Filter). Hilfezeile über `hints([...])`, Rahmen `.ui-frame`, Cursor wie im Inventar.
- **„Gerade verpasst“:** das Abzeichen in D („+4 im Logbuch“) und ein Punkt am Reiter zeigen ungelesene Einträge seit dem letzten Öffnen.

## 7. Zugang

- Tastatur: **T** öffnet das Logbuch direkt ⚠️ (frei; neue Taste `log` in `KEYS`, `game/play/scene.js:57`), Esc › Logbuch, I › Reiter.
- Controller: Start › Logbuch, Inventar › LB/RB bis Logbuch. Optional ⚠️ **Select halten** = letzte Meldung erneut zeigen.
- Maus: Klick auf eine Meldung in D öffnet das Logbuch auf diesem Eintrag; Klick auf das Abzeichen ebenso.

## 8. Werkstatt: alles einstellbar

Neuer Bereich **„Meldungen“** (`AREAS.notices`, einzeln, Datei `data/notices.json`, Gruppe GRUNDLAGEN neben `game`, `tutorial`):

| Abschnitt | Felder |
|---|---|
| **Bühne** | Tabelle `zones` (`id` select A–G, `max` number, `compact` checkbox); `stage.toastMax` (3), `stage.queueMax` (8), `stage.minShow` ms (1200), `stage.burst` ms (400) |
| **Arten** | Tabelle `kinds` (`id`, `name`, `icon` Lucide, `sound` select aus `sfx.js`, `level` select kritisch/warn/lohn/info/leise, `cat` select, `ms`, `zone`); ersetzt `TOAST_KINDS` und `WAITS` im Code |
| **Kategorien** | Tabelle `cats` (`id`, `name`, `icon`, `important` checkbox, `inFilter` checkbox = im Standard-Filter sichtbar) |
| **Kontexte** | Tabelle `contexts` (`id`, `minLevel` select, `zones` multi, `bubbles` checkbox); `arrive.seconds` (6) |
| **Gruppen** | Tabelle `groups` (`id`, `name`, `window` ms, `format` text wie „Beute: {list}“) |
| **Logbuch** | `log.keep` (400), `log.keepImportant` (300), `log.acrossCycles` checkbox, `log.cutAt` KB (180), `log.key` text (T) |

Dazu `companions.barkDelay` (s) im Bereich Camp. Prüfungen (`check`): jede Art nennt eine bekannte Kategorie und ein bekanntes Icon, jeder Kontext mindestens eine Zone. Vorschau in `game/workshop/summaries.js`: ein 16:9-Schema der Bühne mit den Zonen und je Kontext, was dort erscheint, plus „Probemeldung abspielen“ je Art.

## 9. Etappen (je eine Sitzung)

1. **Kern ohne DOM:** `game/info_center.js` mit Stufen, Schlange, Zusammenfassen, Kontexten; `hud.toast`/`banner` laufen hindurch, sichtbares Verhalten wie heute. Bereich `notices` mit Arten + Bühne (Daten aus `TOAST_KINDS`). Test `test/info_center.test.js`.
2. **Bühne:** `stage.js` + CSS-Grid; Toasts, Prompt, Status, Radio-Chip, Kassette, Tipp in ihre Zonen. Die drei Screenshot-Fälle sind danach weg. Test `tools/stage_test.mjs`.
3. **Kontexte + Auftakt:** `build`, `window`, `talk`, `duel`, `drive`, `cutscene`, `arrive`; Kassette und DJ als leise Medien-Meldung; Crew-Plaudern und Blasen-Regel; `bm-msg` in Zone E.
4. **Logbuch-Daten:** Eintragsformat mit `cat`/`t`/`ref`/`run`, `info.record` an den Schritten ohne Toast (Run, Fahrt, Handel, Zwischenfall), Aufbewahren, Umzug alter `journal`-Einträge in `repairSave`.
5. **Logbuch-Fenster:** Inventar-Reiter, Filter, Suche, Run-Gruppen, Zeigen per `ref`, Abzeichen „+n im Logbuch“, Taste T.
6. **Aufrufer schärfen:** `cat`, `key`, `group`, `ref` an den 103 Stellen nachtragen (Gruppen Beute und Ruf), Werkstatt-Vorschau der Bühne, Feature-Datei `docs/features/ui.md` nachziehen.

## 10. Tests

- `test/info_center.test.js` (Node): 3 info + 1 warn → warn sofort, eine info wartet; kritisch verdrängt Ansage; Duplikat → `n = 2`, ein Logbuch-Eintrag; Gruppe Beute fasst drei Funde in 1,5 s zusammen; Kontext `build` lässt info warten und gibt sie beim Verlassen versetzt frei; `leise` verfällt nach `stale`; Schlange voll → `dropped` zählt.
- `tools/stage_test.mjs` (Browser, wie `tools/logbook_test.mjs`): sammelt alle sichtbaren Rechtecke der Zonen und prüft **keine Überschneidung** in vier Lagen: frischer Camp-Start (Willkommen + Ziel-Karte + Kassette + E-Hinweis + Plaudern), Bau-Modus offen mit Toast und Musikwechsel (Toast unter `.bm-bar`, keine Kassette), Inventar offen + Achievement, Run mit Tipp + Prompt + DJ-Durchsage. Bilder nach `output/stage_*.png`.
- `tools/logbook_test.mjs` erweitern: Einträge mit Kategorie, Filter „Quest“ zeigt nur Quests, Suche findet einen Untertitel, Run-Gruppe mit Bilanz, Zeigen öffnet das Questlog, Controller-Durchlauf (LB/RB, A, Y, B), Stand nach Neuladen noch da.

## 11. Offene Fragen an Daniel

1. **Wohin mit der Ansage?** a) oben Mitte (Vorschlag) · b) wie heute oben rechts als großer Toast · c) Mitte des Bildes wie der Raumtitel.
2. **Logbuch-Ort:** a) Reiter im Inventar + Pause-Menü (Vorschlag) · b) eigenes Fenster mit Taste T · c) im Questlog als zweiter Reiter.
3. **Logbuch über den Durchgang:** a) bleibt mit Trenner (Vorschlag) · b) beginnt leer, altes Logbuch als Archiv · c) beginnt leer.
4. **Radio im Bau-Modus:** a) Kassette aus, Titel ins Logbuch (Vorschlag) · b) Kassette links unten · c) gar nichts vom Radio.
5. **Bau-Meldungen im Logbuch:** a) nur Erfolge (Vorschlag) · b) alle · c) keine.
