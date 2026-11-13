# Achievements & Trophäen (#012)

Design: `docs/design.md` › „Achievements & Trophäen“ und › Crafting & Kochen › „Rezepte lernen“ (Design-Session Daniel, 13.11.2026). Vorbild: Badass-Ränge in Borderlands 2.

## Ablauf im Spiel

Achievement erreicht → Toast **Name** (Pokal, gold) → gleich danach **Rezept gelernt: Trophäe** (cyan) → an der Werkstatt aus dem Rezept **einmal** herstellen (danach im Rezeptbuch „Trophäe · hergestellt“) → auf einen **Trophäen-Ständer** in einer **Schatzkammer** stellen → **Bonus aktiv**, Holo-Schild am Ständer leuchtet.

- **Jede ausgestellte Trophäe wirkt**, ohne Obergrenze; der Platz ist die Grenze. Mehrere Schatzkammern zählen alle mit (`displayed` sucht alle Ständer aller Schatzkammern im Rig). Dieselbe Trophäe zweimal zählt einmal.
- **Neuer Durchgang:** Achievements (Zähler, erreicht, hergestellt), ihre Rezepte und alle Trophäen bleiben. ⚠️ vorläufig: Die Trophäen liegen nach dem Aufwachen in einer **Erinnerungskiste** am Lagerfeuer (Boden-Bündel mit `memory: true`, gold, Schild „Erinnerungskiste“) und wirken erst wieder auf einem Ständer. Achievement „Neuer Anfang“ zählt die Durchgänge.
- **Unverkäuflich, nicht zerlegbar:** Trophäen haben Wert 0 und kein Zerlegen; der Händler kauft keine Gegenstände. Experimentieren trifft nie ein Trophäen-Rezept, „Knapp daneben“ verrät keins.
- **Übersicht:** Pause-Menü › **Achievements** (`game/play/achievements_ui.js`): Tabs Alle / Kampf / Erkundung / Cosy / AvA & Tank / Story (LB/RB, Q, Pfeile), Karten mit Trophäen-Symbol (grau, solange offen), Fortschrittsbalken, Trophäe + Bonus, Stand (Rezept gelernt → hergestellt → ausgestellt). Versteckte stehen als „???“ da, bis sie erreicht sind.
- **Tooltip** an einer Trophäe im Inventar: Achievement, Bonus, „Bonus aktiv“ oder der Hinweis, sie aufzustellen.

## Rezepte automatisch lernen

- Zettel, Baupläne, Kochbücher (Gegenstände mit „Bringt Rezept bei“) landen beim Einsammeln **sofort im Rezeptbuch**: Alles Eingesammelte geht in den Rucksack, `scene.invChanged` → `learnNotes()` → `crafting.learnAll` nimmt sie heraus. Toast „Rezept gelernt: Name“.
- Schon bekanntes Rezept → **Wissen** (⚠️ vorläufig, Kochen & Craften › Rezepte lernen › „Bekanntes Rezept gibt Wissen“, 1).
- **Schnellaktion „Lernen“** im Inventar (erste Aktion, X/R bzw. Rechtsklick) für Zettel, die schon in Kiste oder Lager liegen (alte Spielstände).
- Abschaltbar: Kochen & Craften › „Beim Einsammeln lernen“.

## Zähler (`ACHIEVEMENT_COUNTERS` in `game/achievements.js`)

`save.achievements = { counts, done, made, news }`. `bump(D, save, counter, n, tags)` zählt den Zähler und je Tag `counter:tag`; ein Achievement schaut auf `counter` oder mit Filter auf `counter:filter`. `level()` für Zustände (Lichterketten, Rezepte). `news` hält, was vor einem Szenenwechsel erreicht wurde (Run-Ende, Schlafen, Fahren); `scene.campNews()` meldet es im neuen Camp.

| Zähler | Wo | Tags |
|---|---|---|
| kills | `scene.onKill` | Gegner-ID, Familie, Waffe (Nah-/Fernkampf-Slot je nach letztem Treffer), `crit` |
| secrets | `poi_level.js` (brüchige und falsche Wände) | POI |
| secretsAll, pois | `scene.endRun` (geschafft) | POI, Rang |
| tankSafeRuns, knockouts, deltas | `scene.endRun` | |
| harvests | Hydrokultur ernten (`camp.js`) | |
| cooked, crafted, experiments, failures, salvaged | `scene.craftDone` (Kochfenster) | Rezept |
| sleeps, trips | `camp.js` (Schlafen, Fahren) | |
| lights, recipes | Bau-Modus (Kette gehängt), `campNews`, Rezept gelernt | |
| workshops | Bau-Modus › Händler | Werkstatt |
| cycles | `achievements.keepThrough` (neuer Durchgang) | |

## Boni

Tabelle „Bonus, solange ausgestellt“: Leylas Ausrüstungs-Werte (Abwehr, Leben, Schaden, Nahkampf, Fernkampf, Krit, Tempo, Sprungkraft, Dash-Abklingzeit, Heilt sich, Heilung, AvA-Akku, Tank-Verfall) zählen in `scene.applyGear` wie Ausrüstung; Tank-Verfall, Tank-Rettung und AvA-Akku über `techtree.bonuses` (also auch in `tank.js`). Spezialeffekte: **growth** (`garden.stage`, Hydrokultur schneller), **loot** (`scene.lootRoll`: Chance auf ein Extra-Ding je Beute-Wurf), **sell** (mehr Δ am Run-Ende), **secrets** (unentdeckte Secret-Wände schimmern pink, `poi_level.js`).

**Holo-Schild** (`benches.js` › `showTrophies`): Eine Trophäe, deren Bonus wirkt, bekommt einen goldenen Schein und darüber ein Hologramm mit dem Bonus; beides pulsiert.

## Startinhalt (`tools/achievement_data.mjs`)

12 Achievements, je eine Trophäe (2 × 2, Tag Trophäe, Symbol aus `icons_trophies`) und ein Rezept `trophaee_<id>` (Einmalig, Entdecken „Achievement“, 45 min, Zutaten meist aus dem Zerlegen):

| Achievement | Art | Bedingung | Trophäe | Bonus |
|---|---|---|---|---|
| Plünderer-Plage | Kampf | 25 Plünderer | Raider-Maske | +5 % Schaden |
| Revolverheldin | Kampf | 30 Kills mit dem Trommelrevolver | Messing-Patrone | +5 % Krit |
| Ins Schwarze (versteckt) | Kampf | 25 Kills mit Krit | Blech-Zielscheibe | +6 % Fernkampf |
| Schatzsucherin | Erkundung | alle Secrets im Bunker 13 in einem Run | Bunker-Schlüsselbund | Secrets schimmern |
| Streckenkennerin | Erkundung | 10 POIs geschafft | Delta-Petrol-Schild | +10 % Extra-Beute |
| Bestnote | Erkundung | 3 × Rang S | Rang-S-Abzeichen | +10 % Δ aus Runs |
| Grüner Daumen | Cosy | 25 Ernten | Goldene Gießkanne | Hydrokultur +25 % schneller |
| Sterneköchin | Cosy | 20 Gerichte gekocht | Goldener Wok (Kochnische) | +15 % Heilung |
| Lichterfest (versteckt) | Cosy | 6 Lichterketten | Neon-Herz | heilt 1 LP / 10 s |
| Gut gekühlt | AvA & Tank | 10 Runs ohne kritischen Tank (letzte Phase) | AvAs erstes Bild | −10 % Tank-Verfall |
| Nie allein | AvA & Tank | 3 × k.o. | AvAs Notfall-Chip | −15 % Rettungskosten |
| Neuer Anfang | Story | ein neuer Durchgang | Traumfänger | +10 Leben |

⚠️ vorläufig: Liste, Zielwerte und Boni sind Avas Vorschlag, alles in der Werkstatt änderbar.

## Werkstatt

Bereich **Achievements** (Gruppe ACHIEVEMENTS, nach Art gruppiert): Name, Text, Art, Versteckt, Reihenfolge; Bedingung (Zähler, Filter, Zielwert); Rezept der Trophäe; Bonus-Tabelle. Prüfung: Rezept fehlt / nicht einmalig, Trophäe ohne Tag Trophäe (Fehler). Rezepte haben das neue Feld **Einmalig**, Entdecken kennt **Achievement**.

## Tests

`node --test test/achievements.test.js` (7) und `node tools/achievement_test.mjs [--shots]` (16): Zettel einsammeln, „Lernen“, Kills mit Filter, Toasts, einmal herstellen, zwei Schatzkammern, Bonus + Holo + Tooltip, Pause-Menü, Durchgang mit Erinnerungskiste, Werkstatt-Bereich.
