# Balancing

Daniel, 19.11.2026 (#081): „Lass uns Balancing auch versionieren. Erarbeite bitte v1 durch einige Simulationen und identifiziere Choke Points, übermäßigen Grind und Imbalance.“

- **Versioniert als Datenset:** jede Balancing-Fassung ist ein Datenset (#073) im Repo, nur mit dem Unterschied zum Standard: `projects/nomadgirl/sets/balancing_v1/`. Im Hauptmenü unten das aktive Set wechseln, in der Werkstatt laden. Der Standard bleibt, wie er ist, bis Daniel v1 übernimmt.
- **Simulation:** `node tools/balance_sim.mjs [--set balancing_v1] [--runs 60] [--days 40] [--json]`. Ohne Browser, mit den echten Spielmodulen auf den echten Daten.

## Das Modell

Ein typischer Spieler, Tag für Tag, 60 Spieler mit verschiedenen Seeds, je 40 Tage:

- **Ein POI-Run am Tag.** Das Level kommt aus `buildPoi` mit eigenem Seed: echte Gegner, Kisten und Secrets. Die Gefahr steigt alle 4 Tage um eine Stufe (bis 4). Gefahr bringt +25 % Gegner je Stufe.
- **Leistung:**
  - 85 % der Gegner besiegt, 90 % der Kisten offen, 40 % der Secrets gefunden.
  - Der Rang kommt aus `rankRun` mit Zeit = Par.
  - k.o.-Chance je Gefahr: 5 / 10 / 15 / 22 / 30 %. Bei k.o. ist die Beute des Runs weg und der Tank zahlt die Rettung.
- **Beute:** die echten Tabellen (`rollLoot`) der Gegner und des POIs. Ressourcen kommen aus Ranking › Ressourcen verdienen (`earn`: Kiste, Kill, Secret, Rang). Dazu zwei Herstellungen am Tag mit ihrem Nebenergebnis (Werkbank Technik, Küche Bio).
- **Tank:** echter Verfall je Stunde (`tank.update`). Gepflegt wird unter 75 % mit dem besten Rezept, für das die Teile da sind.
- **Techtree:** gekauft, sobald bezahlbar. Der Weg zum Heilmittel kommt zuerst.
- **Nicht im Modell:**
  - Aufträge, Zwischenfälle auf der Straße, Gefangene/Kopfgeld und Verkäufe (alles zusätzliche Δ).
  - Rucksack-Grenzen (es wird alles mitgenommen).
  - Sprit und Vorräte (die Fahrten).

## Standard (Stand 19.11.2026)

| Knoten | Tag (Median) | 90 % bis |
|---|---|---|
| Wartungsklappe, Lebenszeichen | 1 | 2 |
| Thermohülle | 2 | 3 |
| Notreserve | 3 | 4 |
| Kühlkreislauf | 4 | 6 |
| Stasis | 7 | 8 |
| **Heilmittel** | **29** | **33** |

Ressourcen je Tag: Technik 7,7 · Wissen 7,3 · Bio 1,3. Der ganze Baum kostet Technik 50 · Wissen 32 · Bio 37.
Tank: in 3 % der Spiele tot (meist nach einer Rettung im roten Bereich), sonst nie unter 75 % (17× Pflege in 40 Tagen).
Δ: Start 40.000, nach 20 Tagen 42.229.

### Befunde

1. **Choke Point Bio:** Bio kommt fast nur von Mutanten (35 %). 1,3 je Tag gegen 30 fürs Heilmittel: Nach Stasis (Tag 7) wartet der Spieler drei Wochen nur auf Bio. Das ist der größte Grind im Spiel.
2. **Technik und Wissen im Überfluss:** Der Baum bis Stasis ist in einer Woche durch. Danach haben Technik und Wissen keinen Zweck mehr, sie stapeln sich.
3. **Startgeld 40.000 Δ:** Das ist vermutlich ein Testwert. Ein Run bringt rund 100–200 Δ, also macht das Startgeld Δ bedeutungslos: Jede Werkstatt (50–3.000 Δ) und der erste Crawler-Ausbau (6.000) sind ab Tag 1 bezahlbar.
4. **Tank leicht:** Die Pflegeteile kommen reichlich, und der Tank fällt nie spürbar. Er stirbt nur nach mehreren k.o. hintereinander. Das ist für den Anfang gut, als Druckmittel aber schwach.
5. **Grind Mega-Rig:** Mit realistischem Startgeld (v1) hat ein Spieler nach 40 Tagen rund 6.200 Δ. Crawler „Siedlung“ (6.000) kommt also um Tag 40, „Container-Stadt“ (14.000) erst nach etwa 80 Tagen. Aufträge, Kopfgeld und Gefangene bringen zusätzlich Δ, sind hier aber nicht gerechnet.

## Balancing v1 (Datenset `balancing_v1`)

Änderungen gegen den Standard:

- **Startgeld** 40.000 → **600 Δ** (eine erste kleine Werkstatt und Luft für Pflege).
- **Bio:**
  - Mutanten 35 % → **60 %**, 1–2 Bio.
  - Neu: **Kisten 15 %** 1 Bio.
- **Technik:** Kisten 35 % → **25 %**.
- **Wissen:**
  - Rang C 100 % → **50 %**, Rang A 100 % → **50 %**.
  - Secret 1–2 → **1**.
- **Techtree in der Mitte teurer:**

  | Knoten | Kosten |
  |---|---|
  | Thermohülle | 8 Technik + 3 Wissen |
  | Notreserve | 6 Technik + 4 Bio |
  | Kühlkreislauf | 14 Technik + 6 Wissen |
  | Stasis | 18 Technik + 10 Wissen + 8 Bio |
  | Heilmittel | 30 Technik + 30 Wissen + 30 Bio |

  Der ganze Baum kostet damit Technik 79 · Wissen 52 · Bio 42.

### Ergebnis

| Knoten | Standard | **v1** (Median / 90 %) |
|---|---|---|
| Wartungsklappe, Lebenszeichen | 1 | 1–2 / 3 |
| Thermohülle | 2 | **4** / 6 |
| Notreserve | 3 | **4** / 5 |
| Kühlkreislauf | 4 | **8** / 10 |
| Stasis | 7 | **11** / 14 |
| **Heilmittel** | **29** | **17** / 20 |

Ressourcen je Tag: Technik 6,5 · Wissen 5 · Bio 2,9. Alle drei werden ungefähr gleichzeitig knapp, keiner liegt wochenlang herum.
Δ: 600 → rund 1.200 (Tag 10) → 2.700 (Tag 20) → 6.200 (Tag 40). Werkstätten werden so zu echten Entscheidungen: Ripperdoc (900) um Tag 10, Reaktor (3.000) um Tag 20.
Tank: wie im Standard (5 % tot nach Rettungen).

## Ranking-Bonus (#141, 21.11.2026)

Die Simulation rechnet jetzt Rang-Bonus und Bonus-Kiste mit (`rankBonus`, `rankCrate`) und zählt die Ränge. Mit dem Modell (Zeit = Par, 85 % Kills, 40 % Secrets) kommen **B 66 % · A 21 % · S 7 % · C 6 %** heraus.

| | vorher (S 100 / A 75 / B 50 / C 25 / D 10 %) | **#141** (S 50 / A 25 / B 10 %, Kiste ab B) |
|---|---|---|
| Rang-Bonus aufs Run-Geld | +53 % | **+13 %** |
| Δ nach 40 Tagen (Median, 60 Spieler) | 6.214 | **4.828** |
| Bonus-Kisten | – | 31 je Spieler, im Schnitt **157 Δ** Warenwert je Kiste |

Bargeld sinkt um gut ein Fünftel, dafür kommt ungefähr derselbe Wert als Beute (Verkauf, Zerlegen, Ressourcen aus der Tresor-Tabelle). Wer gut spielt, wird stärker belohnt (S-Kiste 4 Würfe, je der beste von 3). Techtree und Tank ändern sich kaum (Ressourcen je Tag ±0,2). ⚠️ Der Mega-Rig-Ausbau rückt beim Bargeld weiter weg, das gehört zu v2.

## Für v2 (offen, ⚠️)

- **Tank als Druck:** Verfall oder Alterung etwas höher (Tank › Rate 0,2 → 0,3), damit Pflege spürbar wird. Vorher prüfen, wie Daniel den Tank spüren will.
- **Mega-Rig-Ausbau:** 6.000 / 14.000 Δ gegen etwa 150 Δ je Tag. Entweder günstiger (4.000 / 9.000) oder mehr Δ-Quellen (Aufträge, Kopfgeld, Revier-Handel) mitrechnen.
- **Ranking-Bonus (#141):** Bonus-% und Kisten-Würfe gegen den Mega-Rig-Ausbau abstimmen; Verkaufen der Kisten-Beute ins Modell nehmen.
- **Simulation erweitern:** Aufträge, Straße, Gefangene, Sprit und Vorräte mitrechnen, die Rucksack-Grenze beachten.
