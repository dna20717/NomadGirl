# Konzept: Spielstände mit drei Slots

Stand 20.11.2026, nur Konzept (noch kein Code), Fragen von Daniel beantwortet. Ziel: Leyla kann in **bis zu drei Spielständen** leben, z. B. ein „ernster“ Stand, ein Test-Stand mit Cheats und einer für einen zweiten Menschen am selben Login oder Gerät.

## Entscheidungen (Daniel, 20.11.2026)

| Frage | Entscheidung | Folgen fürs Konzept |
|---|---|---|
| A Achievements | **über alle Spielstände hinweg** | Achievements, Trophäen und ihre Zähler wandern aus dem Stand in einen eigenen Speicher (lokal `nomadgirl-achievements`, online `ach:<hash>`); Boni und gelernte Rezepte daraus gelten in jedem Slot. Beim ersten Start werden die Achievements aller vorhandenen Stände vereinigt (höchster Zähler gewinnt). Die Cockpit-Sticker lesen diesen Speicher. |
| B Feldhandbuch | pro Gerät | wie heute |
| C Namen | „Leyla 1–3“ automatisch, Umbenennen per Tastatur, am Controller aus einer Namensliste | wie Abschnitt 5 |
| D Löschen | **Dialog**, und der zuletzt gelöschte **oder überschriebene** Stand bleibt in einem Vor-Lösch-Zustand | Papierkorb mit genau einem Eintrag; gefüllt beim Löschen, bei „Neues Spiel“ auf einem belegten Slot und beim Kopieren auf einen belegten Slot. Wiederherstellen im Slot-Menü („Zuletzt gelöscht: Leyla 2, Tag 12 · wiederherstellen“) auf einen freien Slot oder mit erneutem Dialog auf einen belegten. Kein Ablaufdatum ⚠️ vorläufig. |
| E Datensets | Ein Stand kann mit jedem Datenset **begonnen** werden, wird danach aber **nur mit Iterationen dieses Sets** gespielt | Der Stand merkt sich `set` (ID des Datensets, `''` = Standard) beim Anlegen. Laden schaltet das Gerät auf dieses Set um (wie `?set=`); spätere Änderungen am Set („Iterationen“) gelten automatisch. Gibt es das Set nicht mehr, sagt das Slot-Menü „Datenset fehlt“ und lädt nicht ⚠️ vorläufig (Alternative: auf Standard umziehen, Daniel fragen). Kopieren behält das Set. |
| F Vorschaubild | **gleich mit** | Schnappschuss beim automatischen Speichern im Camp (kleines WebP, ~6 KB, ohne HUD), lokal im Index, online als eigener KV-Eintrag `shot:<hash>:<n>` (KV-Metadaten sind zu klein). Gehört in Etappe 3/4. |
| G Wechseln | Es gibt kein „Wechseln“: **Man darf überall einen anderen Spielstand laden; gespeichert wird im Camp automatisch** | Pause-Menü überall: „Spielstand laden“. Weil nur im Camp gespeichert wird, verwirft Laden im Run den laufenden Run, der verlassene Stand steht beim nächsten Laden wieder im Camp, ohne k.o.-Strafe ⚠️ vorläufig. Heute schreibt das Spiel auch Run-Stände (`save.run`, abgebrochener Run = k.o.); das entfällt mit dieser Regel. |
| H Schlüssel | **sauber neu** `nomadgirl-save:1..3` | Einmaliger Umzug lokal: `nomadgirl-save` → `nomadgirl-save:1` kopieren, zurücklesen und vergleichen, erst dann den alten Schlüssel löschen. Online analog `save:<hash>` → `save:<hash>:1` im Worker beim ersten Zugriff. Tests, die `nomadgirl-save` lesen, ziehen um. |
| I Export/Import | später | eigenes Ticket nach den Slots |

## 1. Ist-Zustand

**Ein Spielstand pro Login bzw. Browser.**

- `game/save.js:21` `LOCAL_KEY = 'nomadgirl-save'`, `SAVE_VERSION = 2` (`:22`, ältere Stände fangen neu an).
- `openSave(D, base)` (`game/save.js:440`): fragt zuerst `GET /api/save`. Antwortet der Worker mit JSON, gilt `where = 'cloud'`, sonst `localStorage['nomadgirl-save']`. Gibt eine **Box** zurück: `save` (durch `repairSave`, `:348`), `fresh`, `error`, `seen` (Zeitstempel `savedAt`), `stored()`, `adoptNewer()` (`:461`: ein neuerer Stand aus einem anderen Tab/Gerät gewinnt), `persist()` (`:470`), `reset()` und `cycle()` (`:484–485`).
- `newSave(D, handed)` (`:179`), `newCycle(D, old)` (`:205`): der neue Durchgang behält Techtree, Bergung, Mega-Rigs, Haarfarbe, Geschenke, `handedOut` (Nachreichen einmal pro Spielstand) und Achievements samt Trophäen (`keepThrough`, `game/achievements.js:112`).
- Worker `worker/index.js:32` leitet `/api/save` an `savegame()` (`:68–87`): KV-Binding `SAVES` (`wrangler.jsonc`), Schlüssel `save:<SHA-256 der Login-E-Mail>` (`saveKey`, `:64`), Wert `{ save, time }`, höchstens 256 KB (`SAVE_MAX`), GET/PUT/DELETE. Login über Cloudflare Access (`accessUser`, JWT im Header). Getestet in `test/cloud.test.js:120–130`.
- Einstieg `game/play/main.js:61–84`: `game.html?camp` öffnet die Box, `&new` → `box.reset()`, `&cycle` → `box.cycle()`; ein abgebrochener Run zählt als k.o.; `box.onAdopt` startet das Camp neu, wenn ein anderes Fenster neuer gespeichert hat.
- Größe: ein frischer Stand hat rund **8 KB** JSON (gemessen mit `newSave`), gewachsene Stände geschätzt 30–100 KB.

**Hauptmenü und Menüs heute**

- Cockpit `index.html:48`: Radio-LCD mit festen Einträgen (`Spiel` → `game.html?camp`, Intro, Testraum, Werkstatt, Design-Dok) plus `Datenset` (`:52`). 4 Zeilen sichtbar, ↑/↓, Enter, Gamepad (Stick/Steuerkreuz + A, `index.html:~190–205`). Es gibt kein „Weiter“ und kein „Neues Spiel“, der Eintrag „Spiel“ lädt einfach den einen Stand.
- Sticker im Cockpit lesen `save.achievements.done` aus `/api/save`, sonst aus `localStorage['nomadgirl-save']` (`index.html:171–172`).
- `classic.html:74`: Eintrag `game.html?camp`.
- Pause-Menü (`game/play/hud.js:113`): im Camp „Neues Spiel“ → `confirmNew()` (`:104`): Abbrechen, Neuer Durchgang (`?camp&cycle`), Alles zurücksetzen (`?camp&new`).
- Werkstatt-Spielen-Knopf (`game/workshop/workshop.js:~205`): öffnet `game.html` (Testraum oder Raum) im Tab `nomadgirl-game`, ohne Spielstand.

**Spielstandweit vs. global (heute)**

| Was | Wo | Reichweite |
|---|---|---|
| Rig, Inventar, Uhr, Ort, Δ, Tank, Karte, Techtree, Rezepte, Quests, Ruf | `save.*` | Spielstand |
| Achievements, Trophäen, Zähler | `save.achievements` | Spielstand (überleben Durchgänge) |
| Nachreichen, Geschenke | `save.handedOut`, `save.gifts` | Spielstand |
| Ton aus | `nomadgirl-mute` (`scene.js:260`) | Gerät |
| Schießstil | `nomadgirl-shoot-style` | Gerät |
| Radio-Sender | `nomadgirl-radio` (`radio_ui.js:9`) | Gerät |
| Vibration | `nomad.haptics` (`haptics.js`) | Gerät |
| Rig offen (Bau-Leiste) | `nomadgirl-rig-open` | Gerät |
| Feldhandbuch gesehen / aus | `nomadgirl-tutorial-seen`, `-off` (`tutorial.js:26–27`) | Gerät |
| Cheats freigeschaltet | `nomadgirl-cheats` (`cheats.js:9`) | Gerät, wirken aber auf den laufenden Stand |
| Datenset | `nomadgirl-set` bzw. `?set=` (`engine/sets.js:14`) | Gerät |
| Theme | `nomad.theme` | Gerät |

## 2. Ziel und Begriffe

- **Slot**: Platz 1, 2 oder 3 für genau einen Spielstand. Leer oder belegt.
- **Aktiver Slot**: der Slot, den dieses Gerät gerade spielt. Pro Gerät gemerkt (`localStorage['nomadgirl-slot']`), `?slot=<n>` in der Adresse geht vor (wie `?set=`). Standard 1.
- **Metadaten**: kleine Zusammenfassung je Slot für die Auswahl, ohne den ganzen Stand zu laden.
- Ein Durchgang (Traum) bleibt im selben Slot. Slots sind voneinander unabhängige Leben.

## 3. Datenmodell

### Metadaten (`slotMeta(D, save)`, ohne DOM, in `game/save.js`)

```
{ slot: 2, name: 'Leyla 2', day: 12, hour: 18.5, cycle: 2, location: 'tankstelle_km7', place: 'Tankstelle km 7',
  deltas: 1840, playMs: 13320000, savedAt: 1763650000000, set: 'schnelle_leyla' | '', version: 2, run: false }
```

- `name` steht im Stand selbst (`save.name`), damit Kopieren und Online-Sync ihn mitnehmen.
- `playMs` ist **neu**: Spielzeit in ms, die Szene zählt sie in `update` (nur wenn nicht pausiert) und `persist` schreibt sie mit.
- `set`: mit welchem Datenset der Stand zuletzt gespielt wurde (für eine Warnung, siehe 4).
- Vorschaubild: ⚠️ vorläufig später (Frage F). Bis dahin zeichnet die Karte ein Symbol aus Ort + Tageszeit.

### Lokal (ohne Worker)

| Schlüssel | Inhalt |
|---|---|
| `nomadgirl-save` | Slot 1 (**unverändert**, also keine Migration nötig) |
| `nomadgirl-save:2`, `nomadgirl-save:3` | Slot 2 und 3 |
| `nomadgirl-saves` | Index `{ active: 1, meta: { 1: {…}, 2: {…} } }` (wird bei jedem `persist` mitgeschrieben, lässt sich aus den Ständen jederzeit neu bauen) |
| `nomadgirl-save-trash` | zuletzt gelöschter Slot `{ slot, save, at }` für Rückgängig |

Den alten Schlüssel als Slot 1 zu behalten, spart die Migration und hält die Tests grün, die `localStorage.getItem('nomadgirl-save')` lesen (`tools/inventory_test.mjs:114`, `camp_test.mjs:149`, `cozy_test.mjs:107`). Alternative mit sauberer Reihe `nomadgirl-save:1..3`: beim ersten Start einmal umkopieren, den alten Schlüssel erst nach erfolgreichem Schreiben löschen (Frage H).

### Online (Worker, KV `SAVES`)

| Schlüssel | Slot |
|---|---|
| `save:<hash>` | 1 (der heutige Schlüssel, bestehende Online-Stände sind sofort Slot 1) |
| `save:<hash>:2`, `save:<hash>:3` | 2, 3 |
| `trash:<hash>` | zuletzt gelöschter Slot (läuft per `expirationTtl` nach 7 Tagen ab) |

- `PUT` schreibt die Metadaten als **KV-Metadaten** mit (`put(key, value, { metadata })`, max. 1024 Byte, passt).
- `GET /api/saves` → `{ slots: { 1: meta|null, 2: …, 3: … } }` über **ein** `SAVES.list({ prefix: 'save:<hash>' })`, ohne die Stände selbst zu laden.
- `GET|PUT|DELETE /api/save?slot=2`; ohne `slot` gilt 1, alte Tabs und das Cockpit laufen also weiter. `slot` außerhalb 1–3 → 400.
- `POST /api/save/copy { from, to }` im Worker (spart den Umweg über den Browser), `POST /api/save/restore` holt `trash:` zurück.
- Der aktive Slot liegt **nicht** im Worker: zwei Geräte dürfen verschiedene Slots spielen.

### Migration

- Online: keine, `save:<hash>` ist Slot 1.
- Lokal: keine (Empfehlung H-A). Der Index `nomadgirl-saves` entsteht beim ersten Öffnen aus den vorhandenen Schlüsseln.
- `SAVE_VERSION` bleibt 2; `name` und `playMs` ergänzt `repairSave` (`name ??= 'Leyla ' + slot`, `playMs ??= 0`).

## 4. Global oder pro Slot

| Was | Empfehlung | Grund |
|---|---|---|
| Achievements, Trophäen, ihre Rezepte | **pro Slot** (wie heute) | sie geben Boni und Rezepte, also Spielwerte; ein Test-Stand mit Cheats soll den echten nicht freischalten |
| Sticker im Cockpit | Vereinigung aller Slots | das Cockpit zeigt „was Leyla je geschafft hat“, ohne Spielwirkung |
| Ton, Schießstil, Radio, Vibration, Theme, Rig offen | **Gerät** (wie heute) | Vorlieben der Person am Gerät |
| Feldhandbuch gesehen | **Gerät** | die Person kennt die Lektion schon; „Lektionen neu zeigen“ gibt es in Optionen |
| Cheats freigeschaltet | Gerät; Wirkung nur auf den aktiven Slot | wie heute |
| Datenset | Gerät; der Slot merkt sich `meta.set` | lädt ein Slot mit anderem Set, fragt das Spiel „Mit Datenset X gespielt, jetzt Y. Trotzdem laden / Set wechseln“ (Frage E) |
| Nachreichen, Geschenke, Durchgänge | pro Slot | stehen schon im Stand |

## 5. UI/UX

### Cockpit-Hauptmenü (Radio-LCD, `index.html`)

Der Eintrag „Spiel“ öffnet im LCD eine **zweite Ebene** (gleiche Zeilen, gleiche Steuerung, 4 sichtbar):

```
▶ 1 · Leyla          Tag 12 · D2 · Tankstelle km 7 · 3:42 h
  2 · Testlauf       Tag 3 · Werkstatt-Set · 0:20 h
  3 · leer           Neues Spiel
  ‹ Zurück
```

- **Enter / A** auf belegtem Slot: Weiter (`game.html?camp&slot=n`, macht ihn aktiv). Auf leerem Slot: Neues Spiel (`&slot=n&new`).
- **→ / X** (bzw. Rechtsklick) auf einem Slot: Aktionen in einer dritten Ebene: Weiter · Umbenennen · Kopieren nach … · Neuer Durchgang · **Löschen** (rot) · Zurück.
- **← / B**: eine Ebene zurück. Der Lenkrad-Einschlag mit ←/→ bleibt nur auf der obersten Ebene (in Slot-Ebenen gehören ←/→ dem Menü).
- **Löschen**: im LCD rot, zweiter Druck nötig („Wirklich? A“), danach eine Zeile **„Rückgängig“** für 10 s ganz oben (holt den Papierkorb zurück).
- **Kopieren nach …**: Zielauswahl der anderen beiden Slots; ein belegtes Ziel ist rot markiert und braucht Bestätigung (ebenfalls mit Rückgängig über den Papierkorb).
- **Umbenennen**: mit Tastatur ein kleines Eingabefeld über dem LCD (`openDialogue`, max. 20 Zeichen). Mit Controller eine Namensliste zum Durchblättern (Frage C).
- Metadaten kommen online aus `/api/saves`, lokal aus `nomadgirl-saves`. Der aktive Slot ist gold markiert.
- Sticker: Vereinigung über alle Slots (ersetzt `index.html:171–172`).
- `window.cockpitMenu` bekommt `slots()` und `level()` für die Tests.

### Klassische Startseite (`classic.html`)

Unter „Spiel“ drei kleine Knöpfe „1 · 2 · 3“ mit Kurzzeile, Verwaltung nur im Cockpit und im Spiel.

### Pause-Menü (`hud.js`)

- Neu im Camp: **„Spielstand wechseln“** (Unterzeile: aktiver Name + Slot). Öffnet die Slot-Liste als `hud.menu` (Controller kann das schon). Auswahl → `persist()`, dann `game.html?camp&slot=n`. Im Run ausgegraut mit Hinweis „Nur im Camp“ (Frage G).
- „Neues Spiel“ (`confirmNew`) wirkt auf den aktiven Slot; Unterzeile nennt ihn („Slot 2 · Testlauf“). `?camp&new`/`&cycle` bekommen `&slot=n`.
- Kopfzeile des Pause-Menüs: `sub` zeigt „Slot 2 · Testlauf“.

### Werkstatt

- Spielen-Knopf bleibt ohne Spielstand (Testraum/Raum), unverändert.
- Ein späterer Knopf „Im Camp testen“ nimmt den aktiven Slot. Der wiederverwendete Tab `nomadgirl-game` lädt mit `&slot=` neu, damit `adoptNewer` nie zwei Slots vermischt.

## 6. Online-Fälle

- **Zwei Geräte, verschiedene Slots**: kein Konflikt, jeder Schlüssel für sich.
- **Zwei Geräte/Tabs, gleicher Slot**: heute prüft nur der Client (`adoptNewer` vor `persist`), dazwischen bleibt ein Fenster für „letzter gewinnt“. Vorschlag: `PUT` schickt `base` (das `savedAt`, auf dem der Tab aufbaut). Ist das gespeicherte `savedAt` größer, antwortet der Worker **409** mit dem neueren Stand; der Client übernimmt ihn wie heute (`onAdopt`, Banner „Neuerer Spielstand geladen“). `force` (Neues Spiel, Kopieren) überspringt die Prüfung.
- **`adoptNewer` je Slot**: vergleicht nur denselben Slot; ein Tab auf Slot 1 reagiert nie auf Slot 2.
- **Offline-Fallback**: heute fällt `openSave` bei Netzfehler still auf localStorage zurück und spielt dann einen alten lokalen Stand. Vorschlag: Hat dieses Gerät schon einmal online gespeichert (`nomadgirl-online` = 1), zeigt das Spiel bei Netzfehler ein Banner „Offline, Spielstand wird später hochgeladen“, schreibt in `nomadgirl-save:cloud:<slot>` und lädt beim nächsten erfolgreichen Kontakt hoch, falls dessen `savedAt` neuer ist (sonst gewinnt der Online-Stand, der lokale wandert in den Papierkorb).
- **Größe**: 3 × max. 256 KB pro Login in KV (KV erlaubt bis 25 MiB pro Wert, Grenze bleibt unsere). Lokal teilen sich Stände (3 × ~100 KB) die ~5 MB des Browsers mit den Werkstatt-Entwürfen (`nomadgirl-drafts:*`, können groß sein). `QuotaExceededError` landet schon heute in `box.error`; neu zeigt das HUD dazu einen Toast.
- **Datenschutz**: Schlüssel bleiben Hashes der E-Mail, Metadaten enthalten nur Spielinhalte.

## 7. Umsetzung in Etappen

| # | Inhalt | Aufwand | Tests |
|---|---|---|---|
| 1 | **Kern** `game/save.js`: `slotKey(slot)`, `openSave(D, base, slot)`, `slotMeta`, Index, `listSlots`, `copySlot`, `deleteSlot`/`restoreSlot` (lokal), `name`/`playMs` in `repairSave`, `activeSlot()`/`chooseSlot()` wie in `engine/sets.js` | ½ Tag | `test/save_slots.test.js`: Meta aus Stand, Slot 1 = alter Schlüssel, Index neu bauen, Kopieren, Löschen + Rückgängig, Slot 4 abgelehnt (localStorage-Attrappe in Node) |
| 2 | **Worker**: `?slot`, `/api/saves` mit KV-Metadaten, `copy`, `restore`, Papierkorb mit TTL; 409 bei `base` | ½ Tag | `test/cloud.test.js` erweitern: alter Weg = Slot 1, Slots getrennt, Liste ohne Stände, 400 für Slot 0/4, 409 bei altem `base`, fremder Login sieht nichts; Fake-KV um `list` und `metadata` ergänzen |
| 3 | **Spiel**: `main.js` liest `?slot`, Spielzeit zählen, Pause-Menü „Spielstand wechseln“, `confirmNew` je Slot, Kopfzeile | ½ Tag | `tools/slots_test.mjs` (neu): Slot 2 neu anlegen, Slot 1 unberührt, wechseln über Pause-Menü, `adoptNewer` mischt keine Slots |
| 4 | **Cockpit-LCD**: zweite/dritte Ebene, Karten-Zeilen, Löschen rot + Rückgängig, Kopieren, Umbenennen, Controller, Sticker-Vereinigung; `classic.html` | 1 Tag | `tools/slots_test.mjs`: Menü mit Tastatur und Fake-Gamepad (wie `splash_test`), Rückgängig nach Löschen, Name erscheint; `splash_test` weiter grün |
| 5 | **Online-Feinschliff**: Offline-Puffer, Datenset-Warnung, ggf. Vorschaubild | ½–1 Tag | `tools/workshop_cloud_test.mjs` (lokaler Worker): zwei Slots online, 409-Übernahme, Offline → Hochladen |

Zusammen etwa **3–3½ Tage**. Nach jeder Etappe `npm test`, `npm run test:browser`, Doku in `docs/features/online.md` (Spielstand online) und `docs/features/ui.md` (Pause-Menü), Changelog-Eintrag.

## 8. Offene Fragen an Daniel

Alle beantwortet am 20.11.2026, siehe **Entscheidungen** oben. Wo die Abschnitte 3–7 davon abweichen, gelten die Entscheidungen.
