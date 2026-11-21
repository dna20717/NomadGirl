# Konzept: Gegner-Baukasten 2 (Verhalten aus Bausteinen, Elite, Gangs, Bosse)

Stand 21.11.2026, Ticket **#133**. Daniel: „Bitte überlege, was wir noch an Gegnern und Verhalten brauchen könnten, das man über einen effizienten Baukasten und Upgrades für existierende Baukästen abbilden kann.“
Grundlage: `docs/features/combat.md` (Gegner-KI, Raider-Bausatz, Deckung, Boss-Phasen, Gruppen-Alarm), `game/play/enemies.js`, `engine/schema.js:723` (Bereiche `enemies`, `kits`). Backlog E7 („14 Gegner sind fast nur Nahkampf/Schützen“). Alles mit ⚠️ ist vorläufig, offene Fragen am Ende.

## 1. Was es gibt

**Gegner (14):** Kriecher, Streuner, Keulenschwinger, Panzerwache (Patrouille) · Schläger, Schildträger, Brecher (Stürmer) · Schütze, Gewehrschütze, Schrotflinter, Pistolero (Schütze) · Schleimbeißer (Lauerer) · Hausmeister, Major Null (Boss). Alle aus dem **Raider-Bausatz**; Flieger hat keinen Gegner und keine Grafik mehr (#015).

**Bausteine, die schon da sind** (alle im Bereich Gegner einstellbar):

| Schicht | Heute | Code |
|---|---|---|
| Wahrnehmung | Sicht (Reichweite, Kegel, hinter sich), Gehör (Lärm × %), Reaktion, Gedächtnis, Suche, Gruppen-Alarm mit Rufen | `sees` `enemies.js:75`, `hear` `:89`, `callOthers` `:100` |
| Bewegung | Patrouille, Sprung hoch/runter, Flughöhe | `patrol` `:283`, `walk`, `hop`, `flyTo` |
| Angriff | Hieb, Sturmangriff, Schuss (Salve), Sturzflug, Fallen von der Decke; Ausholen, Pause, Abstand, Geschosstempo | `startWindup` `:324`, `release` `:344`, `strike` `:373` |
| Konter | Schild vorn, Ausweichen, Panzerplatten, Ducken, Deckung an Kisten | `watchDodge` `:385`, `watchDuck` `:403`, `takeCover` `:419`, `hit` `:473` |
| Boss | Phasen (ab %, Ruf, Tempo, Ausholen, Verstärkung, Bodenwelle) | `enterPhase` `:525`, `helpers` `:543`, `wave` `:548` |
| Aussehen | Bausatz × Waffe × Kopf × Hautton × Gang-Farbe, Größe | `game/play/enemy_kit.js` |
| Umfeld | Gefahr des Orts (mehr, zäher, mehr Beute), Gang des POIs färbt Plünderer | `threatOf` `game/worldmap.js:170`, `scene.enemyDef` |

**Grafik vorhanden:** Raider-Körper in 4 Waffenklassen (leicht, beidhändig, Pistole, Langwaffe) × Alarm, Gehen, Rennen, Ducken, Angriff, Treffer + Tod für alle (`assets/raider/`), 6 Köpfe (Dreads, Gasmaske, Helm, Kapuze, Irokese, Dutt), 5 Hauttöne, 6 Gang-Farben, 12 Waffen in der Hand; Fennek (64 px, zu klein für einen Gegner), AvA-Hülle (gehört Leyla, nicht als Feind), Code-Effekte in `fx.js`.

**Grenze:** Das Verhalten steckt als `kind`-Weichen in einer 640-Zeilen-Klasse. Jeder neue Gegnertyp heißt heute neue Weichen in `update`, `engage`, `release`. Dieser Weg ist zu Ende.

## 2. Leitidee: Vorlage + Bausteine (Traits)

- `behavior` bleibt als **Vorlage** (setzt die Grundwerte wie heute).
- Neu: Feld **`traits`** (multi) mit Bausteinen; jeder Baustein bringt **einen Abschnitt** im Schema mit `when: x => x.traits?.includes('<id>')` (dasselbe Muster wie Abschnitt Boss) und **eine Datei** `game/play/traits/<id>.js`.
- **Schnittstelle** (Haken, die `Enemy` an festen Stellen ruft; ein Baustein implementiert nur, was er braucht):

```js
export default {
  id: 'medic',
  init(e, cfg) {},                       // nach dem Konstruktor
  think(e, time, dt, l) { return false }, // vor engage: true = Baustein hat diesen Frame übernommen
  onAlarm(e, time) {}, onSee(e, time, l) {},
  onHit(e, time, dmg, info) { return dmg }, // darf Schaden ändern (Panzer, Schild)
  onDeath(e, time) {}, onAllyDeath(e, ally, time) {},
  draw(e, time, g) {},                   // Laser, Markierung, Aura (Code-Grafik)
};
```

- `enemies.js` bekommt nur die Haken (~40 Zeilen) und ein Register `game/play/traits/index.js`; die heutigen Konter (Schild, Ausweichen, Ducken, Deckung) ziehen später als Bausteine um, ohne Datenänderung (Felder bleiben unter `counter.*`).
- **Gruppen** (`game/play/enemy_group.js`, ~100 Zeilen): der Raum kennt seine Gegner; Rollen `group.role` = `leader`, `front`, `flank`, `back`, `support`. Rollen wirken auf Abstand und Platz (Front vor Rückendeckung, Flanke sucht den anderen Weg zu Leyla).

## 3. Neue Bausteine

Je Baustein: Felder · Code · Grafik · Wert. Größen gegen Leyla 192 px; streng orthografische Seitenansicht, Füße auf einer Zeile, Palette AAP-64.

### 3.1 Scharfschütze `sniper` ⭐
- **Verhalten:** steht weit weg (gern oben), zeigt einen **Laser**, der Leyla mit Verzögerung folgt, schießt nach Aufschalten einmal hart. Die Linie endet an Wänden und Kisten (`combat.blockedAt`); Deckung bricht das Aufschalten, ein Treffer auch. Glitzern am Visier, solange er sie nicht sieht.
- **Felder:** `sniper.lock` ms (1400), `sniper.track` °/s (90), `sniper.damage` % (250), `sniper.color` color, `sniper.breakOnHit` checkbox.
- **Code:** ~80 Zeilen, nutzt `drawAim` `enemies.js:339` und `enemyShot`.
- **Grafik:** Bausatz Langwaffe (vorhanden) + neue Waffe „Langgewehr“ (ein Bild, PixelLab oder aus dem Sturmgewehr abgeleitet), Laser aus Code.
- **Wert:** hoch. Zwingt zu Deckung und Wegwahl, bricht das Stehen-und-Schießen.

### 3.2 Werfer `grenadier` ⭐
- **Verhalten:** wirft in hohem Bogen (Granate, Molotow, Säure); am Boden erscheint die **Landemarke** (Kreis aus Code), nach `fuse` platzt es. Hält Abstand, wirft bevorzugt über Kisten auf Leute in Deckung.
- **Felder:** `throw.item` select (granate, molotow, saeure), `throw.fuse` ms (900), `throw.radius` px (140), `throw.damage` %, `throw.count`, `throw.burn` s (Molotow: Feuerfläche).
- **Code:** ~120 Zeilen (ballistischer Bogen, Abprallen an Kacheln, Explosion an Wänden geschnitten über `combat.zone`). Explosionen öffnen brüchige Wände ⚠️.
- **Grafik:** Bausatz leicht/Angriff als Wurf (vorhanden), Wurfkörper aus Code oder als Symbol aus `items` (Granate gibt es dann auch für Leyla). Optional später eigene Pose `throw`.
- **Wert:** hoch. Vertreibt aus der Deckung, macht Räume dynamisch.

### 3.3 Sanitäter `medic` ⭐
- **Verhalten:** hält sich hinten (`back`), heilt Verbündete im Umkreis, läuft zu einem Gefallenen und **holt ihn zurück** (kniet = Ducken-Pose, Tod-Animation rückwärts, steht mit `reviveHp` %). Gefallene liegen dafür `bodyTime` s. Ziel Nr. 1 für die Spielerin.
- **Felder:** `medic.heal` pro s, `medic.range` px, `medic.reviveTime` ms (2200), `medic.reviveHp` % (40), `medic.bodyTime` s (8), `medic.max` (2).
- **Code:** ~110 Zeilen; Leichen bleiben als „liegend“ statt gelöscht (`die` `enemies.js:574`), Kill-Zählung erst beim endgültigen Tod.
- **Grafik:** komplett vorhanden (Ducken, Tod rückwärts, Kapuze + Gang-Farbe Weiß/Rot neu als Farbe im Bausatz); Armbinde mit Kreuz als Code-Overlay.
- **Wert:** hoch, fast kostenlos.

### 3.4 Alarmgeber `alarm` ⭐
- **Verhalten:** sieht er Leyla, läuft er zu einem **Alarmpunkt** (Raum-Zeichen, Sirene an der Wand) oder bläst ins Horn. Nach `alarm.time` heult die Sirene: alle im POI sind alarmiert, aus Türen kommen `alarm.adds` Gegner. Wer ihn vorher erwischt, hat Ruhe. Die Sirene ist zerschießbar/hackbar (Hacking-Konzept `docs/design.md`). **Gebaut** (#139/#155): Verstärkung aus der nächsten Tür außer Sicht, Sirene zerschießbar (Spiel › Kampf › Sirene: Leben), Hacken später.
- **Felder:** `alarm.time` ms (2500), `alarm.adds` (2), `alarm.radius` (ganzer POI), `alarm.flee` checkbox (rennt weg statt zu kämpfen).
- **Code:** ~90 Zeilen + ein Zeichen in der Raum-Legende (`engine/room.js`) für den Alarmpunkt.
- **Grafik:** Bausatz Pistole/Rennen (vorhanden), Sirene als Code-Grafik oder ein kleines PixelLab-Objekt; Rundumlicht aus Code (rotes Drehen über `atmosphere`).
- **Wert:** hoch, belohnt Schleichen und Prioritäten.

### 3.5 ~~Hund `hound`~~ (gestrichen, Daniel 21.11.: „Keine Hunde als Gegner. Niemals!“)
- **Verhalten:** im Rudel, sehr schnell, springt Leyla in Bögen an, umkreist, weicht nach einem Biss zurück, flieht bei wenig Leben. Kommt mit einem Hundeführer (`leader`): stirbt der Führer, werden die Hunde wild oder laufen weg.
- **Felder:** `pack.size`, `pack.leap` px, `pack.circle` px, `pack.flee` %.
- **Code:** ~110 Zeilen; Körperbox liegend breit (neue Form `beast`).
- **Grafik: neu.** Mutierter Hund, Schulterhöhe ~80 px, Körper ~150 px lang (Kopf auf ~100 px), Idle, Rennen, Sprung, Biss, Treffer, Tod: 6 Animationen PixelLab.
- **Wert:** mittel–hoch. Nahkampf-Druck, den die Raider nicht haben; teuer in Grafik.

### 3.6 Drohnen-Schwarm `swarm`
- **Verhalten:** 4–8 kleine Drohnen kreisen (Boids) um einen Träger oder ein Nest, stoßen einzeln herab (Sturzflug, vorhanden). Schaden klein, Masse. Ein Störsender-Implantat oder Hack nimmt sie aus.
- **Felder:** `swarm.count`, `swarm.orbit` px, `swarm.diveEvery` ms, `swarm.hp`.
- **Code:** ~120 Zeilen (Flieger-Basis ist da).
- **Grafik: neu, klein.** Drohne ~44 px, 2–4 Frames Rotor (PixelLab-Objekt) oder ganz aus Code; muss sich klar von AvA unterscheiden (kantig, rotes Auge).
- **Wert:** mittel. Bringt die Luft zurück ins Spiel.

### 3.7 Geschütz `turret`
- **Verhalten:** fest an Wand oder Decke, schwenkt, Kegel sichtbar, feuert Salven; zerstörbar, später hackbar (schießt dann auf Gegner).
- **Felder:** `turret.sweep` °, `turret.sweepSpeed`, `turret.mount` select (Boden, Wand, Decke).
- **Code:** ~90 Zeilen. **Grafik:** ein PixelLab-Objekt (~96 px) + Mündungsfeuer aus Code.
- **Wert:** mittel. Rätsel-Gegner für Raumgestaltung, Brücke zum Hacking.

### 3.8 Weitere Bausteine (klein, ohne neue Grafik)

| Baustein | Was | Felder | Code |
|---|---|---|---|
| `rammer` (Stürmer-Upgrade) | Sturmangriff bremst nicht, prallt an der Wand ab und **taumelt** (Strafe fürs Ausweichen) | `charge.through`, `charge.wallStun` ms | ~50 |
| `shieldwall` (Schild-Upgrade) | Schildträger stellen sich vor Schützen (`front`), Schüsse hinter ihnen prallen ab | `group.cover` px | ~60 |
| `lurker2` (Lauerer-Upgrade) | lauert auch **im Schrott am Boden** oder **hinter Türen**, springt bei Nähe auf | `lurk.where` select (Decke, Boden, Tür), `lurk.trigger` px | ~60 |
| `surrender` | unter `at` % Leben mit Chance: wirft die Waffe weg, kniet. E: gefangen nehmen (#079 Gefangene), laufen lassen (+Ruf), erledigen (−Ruf) | `surrender.at`, `surrender.chance` | ~90, nutzt `game/prisoners.js`, `game/reputation.js` |
| `leader` | Aura (+Tempo/−Ausholen) für Gruppe; fällt er, würfeln die anderen Flucht/Ergeben | `aura.speed`, `aura.windup`, `aura.range`, `morale.break` % | ~70 |
| `berserk` | unter `at` % schneller, kein Ausweichen mehr, rot glühend | `berserk.at`, `berserk.speed` | ~30 |
| `coward` | flieht bei Sicht zu Freunden oder zum Alarmpunkt, lässt Beute fallen | `flee.at`, `flee.drop` | ~40 |
| `bomber` | rennt auf Leyla zu, zündet nach `fuse` (Mutant mit Gaskanister) | `throw.*` wiederverwendet | ~50 |

## 4. Elite-Zusätze (Upgrades für alle bestehenden Gegner)

Neuer Katalog **„Gegner-Zusätze“** (`AREAS.enemyMods`, `data/enemy_mods.json`): je Eintrag `name` (Vorsilbe, z. B. „Gepanzerter“), `health` %, `damage` %, `speed` %, `traits` (fügt Bausteine hinzu), `counter` (z. B. `armor: 2`), `look.outline` color, `look.fx` select (Glut, Funken, Schatten, Frost), `loot` %, `deltas` %, `rarity`. Code `game/play/enemy_mods.js` ~120 Zeilen, wirkt in `scene.enemyDef`; Grafik **nur Code** (Umriss, Partikel aus `fx.js`, Namensschild).

| Zusatz | Wirkung |
|---|---|
| Gepanzert | 2 Platten, −15 % Tempo |
| Brennend | Treffer setzen Leyla 3 s in Brand, Feuerspur beim Rennen |
| Flink | +35 % Tempo, −30 % Ausholen, weicht 30 % aus |
| Zäh | +80 % Leben, Ausholen +10 % |
| Explosiv | platzt beim Tod (Werfer-Explosion) |
| Schattig | unsichtbar bis 300 px, im Licht sichtbar (Lampe/Hack) |
| Vampir | heilt sich mit jedem Treffer |
| Rufer | `alarm` + `leader` |
| Kopfgeld | Elite-Jäger einer verhassten Gang (Ruf Feind, `docs/design.md` Ruf), doppelte Beute, nennt Leyla beim Namen |

**Wann:** Gefahr des Orts gibt die Chance je Spawn (`worldmap.threat.elite` % je Stufe, neues Feld), POI und Gang können feste Zusätze geben, Kopfgeld kommt über den Ruf.

## 5. Gang-Ausrüstung (die 12 Gangs)

Neue Felder an **POIs › Gang**: `gang.loadout` (Tabelle: `enemy` ref, `weapon` ref, `head` text, `mod` ref, `chance` %), `gang.traits` (multi, gelten für alle ihre Plünderer), `gang.mod` (ref, Haus-Zusatz). ⚠️ Später eigener Katalog `gangs`, wenn Gangs auf der Karte wandern.

| Gang (POI) | Handschrift | Bausteine / Zusatz |
|---|---|---|
| Yellow Vultures (Tankstelle) | Schrot, Molotow | Werfer (Molotow), Brennend |
| Neon Rats (Großmarkt) | schnell, aus dem Regal | Lauerer Boden, Flink, Schwarm |
| Rust Guard (Bunker 13) | Mauer aus Schilden | Schildwall, Gepanzert, Alarmgeber |
| Order Office (Ministerium) | Bürokratie mit Zielfernrohr | Scharfschütze, Alarmgeber („Nummer ziehen“), Geschütz |
| Sky Wolves (Delta Heights) | von oben | Scharfschütze, Flanke über Plattformen |
| Level Five (Parkhaus Süd) | Drohnen im Parkdeck | Schwarm + Anführer, Feigling |
| Static Saints (Funkmast) | Drohnen, Störfunk | Schwarm, Geschütz, Störsender (AvA aus) ⚠️ |
| Tunnel Kings (Metro) | Dunkelheit | Lauerer Tür, Schattig |
| Salt Dogs (Pit 6) | Salz in die Wunde | Berserker, Blutung, Rammer |
| Crude Boys (Delta Crude) | Öl und Feuer | Werfer, Bomber, Explosiv |
| Sunny Side (Sunny Acres) | lächelnde Sekte | Sanitäter, Ergeben, Anführer |
| Zero Hour (Raketensilo) | Elite | Rufer, Explosiv, Gepanzert, Major Null |

## 6. Wetter und Revier

Neue Felder im Bereich **Wetter** je Wetterlage: `enemies.sight` %, `enemies.hearing` %, `enemies.speed` % (Regen: Gehör −30 %, wie Backlog „Run im Regen“; Nebel: Sicht −40 %, Laser länger sichtbar; Staub: Kegel −20 %; Nacht: Sicht −25 %, Schattig stärker). Revier (#061, `game/turf_war.js`): Bandenkrieg → Reaktion −30 %, Waffenstillstand → friedlich bis zum ersten Schuss (gibt es). Code ~40 Zeilen in `scene.enemyDef`.

## 7. Bosse als Phasen-Skripte

Ein Boss ist ein Gegner mit Bausteinen; seine Phasen schalten **Züge** und **Arena-Ereignisse** um.

- Schema `boss.moves` (Tabelle): `id`, `trait` select (jeder Baustein oder Angriffsart), `weight`, `cooldown` ms, `from` (ab Phase).
- `boss.phases` bekommt zusätzlich: `moves` (multi aus `boss.moves`), `arena` select (`lights_off`, `doors_adds`, `countdown`, `floor_wave`, `fog`), `banner` text (geht über das Info-Center, #129).
- Code: `game/play/traits/boss.js` (~120 Zeilen) wählt gewichtet den nächsten Zug; Arena-Ereignisse in `scene_events.js` (~80 Zeilen).

**Hausmeister (Ministerium, offen):** Phase 1 Hieb, Hieb, Sturmangriff (`rammer`, rammt Spinde). 60 % „RUHE IM FLUR!“: Licht aus (`lights_off`, nur Taschenlampen-Kegel), schiebt den **Putzwagen** (Rammer mit Hindernis), Bodenwelle. 30 % „FEIERABEND!“: Feuerlöscher als Werfer (Nebelwolke statt Explosion), aus den Bürotüren kommen Order-Office-Schützen (`doors_adds`). Grafik: Bausatz + Gasmaske (da), Putzwagen und Löscher als Code/1 Objekt.

**Major Null (Raketensilo):** Phase 1 Rohrhammer + Granaten. 60 % „T MINUS SECHZIG!“: **Countdown** in Ansage-Zone; bei 0 Druckwelle über den ganzen Raum, nur Deckung hinter Kisten schützt (nutzt `scene.covers()`). Geschütze an der Wand schalten sich ein. 30 % „ZÜNDUNG!“: Rufer + zwei Elite-Raider, Bodenwelle, Countdown kürzer.

## 8. Grafik-Regeln

- **Seitenansicht streng orthografisch**, nach rechts gemalt, Gegenrichtung per Spiegeln (`docs/features/art.md`), Füße auf derselben Zeile, Ankerpunkt Füße.
- **Maßstab** (Leyla 192 px ≈ 170 cm): Menschen 174–190 (Bausatz `height` 182), Brecher/Bosse 220–260, Hund ~100 hoch / ~150 lang, Schwarmdrohne ~44, Geschütz ~96, Sirene ~64.
- **Wiederverwenden vor Malen:** Köpfe (ein Bild je Kopf) und Waffen (ein Bild je Waffe) sind billig; neue Körper sind teuer. Neue Bausatz-Zustände `throw` und `revive` nur, wenn die geliehenen Posen nicht tragen (Fallback Angriff bzw. Ducken).
- **PixelLab:** vor jedem Auftrag `get_balance`; unter 700 übrig braucht es Daniels Freigabe. Neue Assets in `docs/assets.md` als „KI (PixelLab)“, Palette AAP-64.

## 9. Rangliste Wert / Aufwand

| Rang | Baustein | Wert | Aufwand | neue Grafik |
|---|---|---|---|---|
| 1 | Scharfschütze | hoch | S | 1 Waffe |
| 2 | Sanitäter | hoch | S–M | keine |
| 3 | Elite-Zusätze | hoch (×14 Gegner) | M | keine |
| 4 | Alarmgeber | hoch | M | Sirene (Code) |
| 5 | Werfer | hoch | M | keine |
| 6 | Trait-Haken + Gruppenrollen | Grundlage | M | keine |
| 7 | Ergeben + Anführer | mittel (Systeme verknüpfen) | M | keine |
| 8 | Boss-Skripte Hausmeister/Major Null | hoch | M–L | 1–2 Objekte |
| 9 | Gang-Ausrüstung + Wetter | mittel | S | keine |
| 10 | Rammer, Schildwall, Lauerer 2, Berserker, Feigling | mittel | je S | keine |
| 11 | Geschütz | mittel | M | 1 Objekt |
| 12 | Schwarm | mittel | M | klein |
| 13 | ~~Hund~~ | gestrichen | | |

## 10. Erste Scheibe: vier Gegner aus vorhandener Grafik

1. **Scharfschützin „Visier“** (Order Office, Sky Wolves): Bausatz Langwaffe, Kopf Helm, Bausteine `sniper`; 28 Leben, Schaden 9 × 250 %.
2. **Werfer „Brandsatz“** (Yellow Vultures, Crude Boys): Bausatz leicht, Kopf Irokese, `grenadier` mit Molotow; 34 Leben.
3. **Sanitäterin „Flickerin“** (Sunny Side, Rust Guard): Bausatz Pistole (Rohrpistole), Kopf Kapuze, `medic`; 30 Leben, hält sich hinten.
4. **Alarmposten „Sirene“** (Rust Guard, Order Office, Zero Hour): Bausatz Pistole, Kopf Gasmaske, `alarm` + `coward`; 26 Leben; dazu Alarmpunkt-Zeichen in 3 Räumen.

Reihenfolge: Etappe 1 Haken + Register + `sniper` · Etappe 2 `medic` + `alarm` · Etappe 3 `grenadier` · Etappe 4 Elite-Zusätze · Etappe 5 Boss-Skripte. Jede Etappe: Schema-Abschnitt, Beispieldaten mit `ng new`, Eintrag in mindestens einem POI, Feature-Datei `docs/features/combat.md`.

## 11. Tests

`tools/enemy_traits_test.mjs` (wie `tools/enemy_test.mjs`, Testraum, `nomad.spawn`, `nomad.step`):
- Scharfschütze: Laser folgt, Kiste dazwischen bricht das Aufschalten, ohne Deckung trifft der Schuss nach `lock`.
- Sanitäter: Gefallener steht nach `reviveTime` mit `reviveHp` auf; wird der Sanitäter vorher getroffen, bricht es ab; Kills zählen erst beim endgültigen Tod.
- Alarm: nach `alarm.time` sind alle Gegner im POI im Alarm und `adds` erschienen; stirbt er vorher, nichts.
- Werfer: Schaden im Radius, keiner hinter einer Wand, Landemarke vor der Explosion sichtbar.
- Elite: Gepanzert hat 2 Platten, Werte gegen `enemyDef` gerechnet. Node-Test `test/enemy_mods.test.js` für die Rechnung ohne Browser.
- Boss: Phasenwechsel schaltet Züge um, Countdown-Druckwelle trifft ohne Deckung, nicht mit.

## 12. Antworten Daniel 21.11.2026

1 a (Scheibe Visier, Brandsatz, Flickerin, Sirene) · 2 c (nie Hunde, Drohnen gern) · 3 a (Ergeben ja) · 4: nichts bauen, erst klären, was Gang-Ausrüstung ist · 5: Granaten gleich mit, als Skill mit Abklingzeit (#140).

**21.11.2026 abends (#155):** Ergeben a (alle Plünderer mit kleiner Chance: 15 % unter 25 % Leben, Spiel › Kampf, je Gegner überschreibbar) · Sirene a (zerschießbar durch Schüsse, Hiebe, Explosionen; Hacken später, Haken `hackSiren`) · Verstärkung a (aus der nächsten Tür außer Sicht, sonst Rand, sonst neben der Sirene) · Gang-Ausrüstung a („Ja, so bauen“: `gang.traits`, `gang.loadout`, dazu `gang.throwItem`; ⚠️ `gang.mod` erst mit den Gegner-Zusätzen).

**Gebaut (#155), nur mit vorhandenen Bausteinen, Waffen und Köpfen** (Waffe/Kopf/Baustein mit Chance je Gegner):

| Gang | Bausteine für alle | Ausrüstung |
|---|---|---|
| Yellow Vultures | – | Schütze Schrotflinte 50 %, Pistolero Schrotflinte 30 %, Streuner Werfer 25 % (Molotow), Irokese 40 % |
| Neon Rats | Feigling | Kapuze 40 %, Schrotflinter Nagelpistole 30 %, Gewehrschütze Rohrpistole 25 % |
| Rust Guard | – | Stachelhelm 60 %, Schütze Alarmgeber 25 %, Pistolero Sanitäter 15 %, Schläger Rohrhammer 25 % |
| Order Office | – | Gewehrschütze Scharfschütze 30 %, Schütze Alarmgeber 30 %, Gasmaske 35 % |
| Sky Wolves | – | Gewehrschütze Scharfschütze 40 %, Schrotflinter Sturmgewehr 30 %, Dreads 40 % |
| Level Five | Feigling | Dutt 50 %, Pistolero Nagelpistole 30 %, Keulenschwinger Machete 30 % |
| Static Saints | – | Schütze Alarmgeber 40 %, Gasmaske 50 %, Pistolero Nagelpistole 30 % |
| Tunnel Kings | – | Schläger Nagelkeule 40 %, Kapuze 60 %, Pistolero Feigling 30 % |
| Salt Dogs | – | Schläger Rohrhammer 30 %, Irokese 60 %, Gewehrschütze Schrotflinte 30 % |
| Crude Boys | – | Schläger Werfer 25 %, Pistolero Werfer 20 % (Molotow), Gasmaske 50 % |
| Sunny Side | Ergibt sich (30 %/50 %) | Pistolero Sanitäter 25 %, Kapuze 50 %, Keulenschwinger Machete 30 % |
| Zero Hour | – | Schütze Alarmgeber 25 %, Gewehrschütze Scharfschütze 15 %, Keulenschwinger Rohrhammer 30 %, Stachelhelm 70 % |

Was aus der Tabelle oben noch fehlt (Schwarm, Geschütz, Lauerer, Schildwall, Berserker, Blutung, Rammer, Bomber, Anführer, Zusätze wie Brennend, Flink, Gepanzert, Schattig, Explosiv), kommt mit den Bausteinen bzw. dem Katalog Gegner-Zusätze.

## 12a. Ursprüngliche Fragen

1. **Erste Scheibe:** a) Scharfschütze, Werfer, Sanitäter, Alarmgeber (Vorschlag) · b) lieber gleich Elite-Zusätze für alle · c) erst die Boss-Skripte.
2. **Hund (neue Grafik, ~6 Animationen):** a) jetzt bestellen · b) nach der ersten Scheibe · c) gar nicht, Mutanten bleiben menschlich.
3. **Ergeben:** a) Gefangennehmen/Laufen lassen/Erledigen mit Ruf-Folgen · b) nur Laufen lassen · c) kein Ergeben.
4. **Gangs:** a) Felder an POIs › Gang (Vorschlag) · b) gleich eigener Katalog `gangs`.
5. **Granaten auch für Leyla?** a) ja, gleiche Daten · b) nur Gegner.
