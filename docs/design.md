# NomadGirl – Game Design Document

Stand 07.11.2026 · Entwurf von Daniel, mit Ava überarbeitet. Die Zahlen im Spiel stehen nicht hier, sondern in der Werkstatt (`workshop.html`, Daten unter `projects/nomadgirl/data/`).

## Pitch & Setting

NomadGirl ist ein 2D-Action-Roguelite mit Cosy-Basisbau: Leyla plündert gefährliche Orte und lebt dazwischen in ihrem rollenden Zuhause, dem Rig.

- **Heldin:** Leyla, Schrottsammlerin in den Wastelands rund um BigCityDelta.
- **Rig:** Zu Beginn der Van mit einem leeren Modul-Anhänger (die ersten Werkstätten liegen verpackt bereit), später ein LKW mit gestapelten Containern.
- **Ziel:** Schrott, Ressourcen, Lebensmittel und Ausrüstung sammeln.
- **Gefahr:** Mutanten, Gegner und Dinge, über die man in BigCityDelta lieber nicht spricht.
- **Prinzip:** High Risk, High Reward. Je tiefer Leyla in einen Ort vordringt, desto besser die Beute und desto größer der mögliche Verlust.

## Core Gameplay Loop

```mermaid
flowchart LR
  A["Ankunft am POI<br/>Buffs, Loadout, Companions"] --> B["POI-Run<br/>Kampf und Loot"]
  B --> C{Überlebt?}
  C -- ja --> D["Abschluss<br/>Ranking F bis S"]
  C -- nein --> E["Mama-Bot rettet<br/>Run-Loot ist weg"]
  D --> F["Rig-Phase<br/>Craften, Kochen, Upgraden"]
  E --> F
  F --> G["Reise<br/>Sprit, Zeit, Encounter"]
  G --> A
```

1. **Ankunft:** Leyla erreicht einen POI mit dem Rig. Sie nutzt die Werkstätten für Buffs, stellt ihr Loadout zusammen und spricht mit Companions.
2. **POI-Run:** Leyla betritt den POI. Orte variabler Größe und Gefahr, von der Tankstelle mit NPCs bis zum verlassenen Regierungskomplex.
3. **Abschluss:** Ranking nach Durchlaufzeit, Kills und Secrets. Bei Tod rettet Mama-Bot sie, die Beute des Runs ist verloren.
4. **Rig-Phase:** Ausrüstung upgraden, craften, kochen, mit Companions reden, das Rig ausbauen.
5. **Reise:** Im Navigationssystem des Rigs die nächste Location wählen. Unterwegs können Random Encounters passieren, die sich wie kleine Level spielen.

## POI-Gameplay

Im POI spielt sich NomadGirl wie Dead Cells: schnelle Bewegung, harter Kampf, und jeder Rucksackplatz ist eine Entscheidung.

- **Aufbau:** hybrid. Handgebaute Räume werden prozedural zu einem Level zusammengesetzt (Werkstatt: „Raum-Bausteine“ und „POIs“). Die Räume werden **nahtlos** verschweißt wie bei Dead Cells: ein **Hauptweg** vom Eingang (mit dem Van) zum Ausgang, dazu **Abzweige** mit Beute und Secrets, die über dem Hauptweg hängen (Daniel, 10.11.2026).
- **Geheimwege, Schalter, Abkürzungen** (Daniel, 10.11.2026: „wie bei Elden Ring“): Brüchige Wände verstecken Secrets, Türen gehen nur von einer Seite per Schalter auf, und am Ende führt immer eine **Abkürzung** schnell zurück zum Van (Tunnel unter dem Level, oben eine Tür, die man von innen aufmacht).
- **Ende eines Runs:** Ziel erreichen (z. B. den Tresor knacken) = POI geschafft, die Uhr steht, der Rang ist fest. Ausgezahlt wird am Van, also erst nach dem Rückweg: k.o. auf dem Rückweg kostet trotzdem alles. Vorher zum Van = Abbruch, die Beute ist sicher, kein Ranking.
- **Bewegung:** Gehen, Rennen, Springen, Schwingen, Klettern, Dashen, Sliden.
- **Steuerung:** Tastatur oder Controller (Xbox, PlayStation, Stadia, Switch Pro; Belegung in der Werkstatt). Seit 12.11.2026 geht alles auch ohne Maus: Inventar, Kochen und Rig bauen mit Cursor (Select halten = Rig bauen, Select im Bau-Modus = Rig offen/zu). Jedes Ding im Inventar zeigt seine Aktionen (Essen/Heilen/Ausrüsten, Drohne geben, Wegwerfen; Daniel, 12.11.2026). Der rechte Stick zieht Mama-Bot sanft wie an einem Gummiband weg, ihr Scheinwerfer wird zur Tischlampe. Kanten greifen ist verzeihend (etwas über den Händen, etwas daneben, ohne Richtung nach einem Sprung). **Mama-Bot als Tritt:** mit dem rechten Stick rausgezogen (oder kurz danach geparkt) kann Leyla an ihr hochklettern und auf ihr stehen, bis der Akku leer ist (Daniel, 12.11.2026). Unten im Bild zeigt eine **Boden-Leiste** (Scan-Raster im Cyberware-Look, blendet zu den Rändern aus), was in der Nähe liegt; E / Stick ↑ hebt das erste auf, I öffnet alles.
- **Kampf:** Nahkampf, Fernkampf, später optional Hacking über das Cyberdeck.
- **Kampfmodus (Daniel, 11.11.2026, gebaut):** Leyla ist friedlich (Waffe weg, Idles) oder im Kampfmodus mit gezogener Waffe. Automatisch rein, wenn ein Gegner in Sicht kommt, sie getroffen wird oder abdrückt; nach ein paar ruhigen Sekunden steckt sie die Waffe weg. Dazu eine Taste (Q) zum Ziehen und Wegstecken von Hand.
- **Schießstil (Daniel, 11.11.2026, gebaut 11.11.2026 abends, Cells-like als Standard):** als Einstellung (Werkstatt › Spiel › Kampf › Schießstil, dazu Pause-Menü › Optionen) mit zwei Varianten zum Ausprobieren:
  - **Klassisch:** der heutige Stand, Leyla bleibt zum Schießen stehen.
  - **Cells-like (neu, wie Dead Cells):** Schießen im Laufen (Lauftempo dabei ~85 %). Das Spiel sucht das nächste Ziel in Blickrichtung (Kegel ±35°, Reichweite ~9 Kacheln, nur mit freier Sichtlinie); gefunden → das Projektil fliegt schräg genau dorthin, sonst gerade nach vorn. Echte, schnelle Projektile (kein Hitscan): Gegner und Wände können sie noch blocken. Optional ein Ziel-Marker am erfassten Gegner. Alle Werte in der Werkstatt (Kegel, Reichweite, Lauftempo, Kugeltempo, Marker).
  - **Geparkt:** Hybrid mit Zieltaste (Cuphead-/Metroid-Stil: halten = stehen bleiben und in 8 Richtungen bzw. frei zielen) und die Idee „Waffen bestimmen das Verhalten“ (z. B. Gewehr nur angelegt). Wieder aufgreifen, falls Cells-like nicht zündet.
  - **Gegen Dauerfeuer à la Contra:** kleines Magazin, Nachladen als verwundbarer Moment, Gegner, die Nahkampf belohnen (Schild vorn, Ausweichen, Panzerung nur per schwerem Hieb, **gebaut 12.11.2026**), Kombo-Bonus Dash/Hieb → Schuss.
- **Steuerung neu (Design-Session Daniel, 12.11.2026, gebaut 12.11.2026 vormittags):** Anlass: „Ich tue mich mit der Steuerung schwer … Inventare und Menüs haben keine einheitliche Identität in der Handhabung … schießen und Waffe ziehen ist clunky“.
  - **X = Nahkampf, Y = Fernkampf** (Tastatur J / K). **Quick Draw (1b):** Y schießt immer sofort; ist die Waffe weg, zieht Leyla sie in einer schnellen Hüftbewegung und schießt im selben Zug (~120 ms), kein eigener Zieh-Schritt mehr. **Y halten = wegstecken** (nach ~0,5 s; der Schuss vom Drücken ist schon raus). Ein Hieb mit gezogener Waffe steckt sie nicht weg. Leer abdrücken lädt nach, RB bleibt Nachladen.
  - **Kein automatisches Ziehen mehr (2b):** nur noch per Knopf; nach Ruhe steckt sie weiter von selbst weg.
  - **Benutzen (3a) auf Stick ↑** (gebaut als Neigen, Ava nach Daniels „direkt loslegen“; Vorschlag Ava: Neigen statt Drücken, nur deutlicher Ruck über ~70 %, nur im Stand/Gehen; steht ein E-Hinweis im Bild, gewinnt Benutzen vor der Leiter). Tastatur: E bleibt, ↑/W zusätzlich. L3 wird frei.
  - **Fenster pausieren immer (4)**, auch im Run (zunächst).
  - **Menüs & Inventare (5b, zunächst):** getrennte Fenster, aber eine UI-Grammatik: gleicher Rahmen (Titel + Tabs oben, Hilfezeile mit Tasten-Symbolen unten), gleiche Tasten (A/E nehmen, B/Esc eine Ebene zurück, X Kontext, LB/RB Tabs, Start Pause, Select/I Inventar), gleicher goldener Cursor mit Maus, Pfeiltasten und Stick. Ein gemeinsames Fenster mit Tabs bleibt Idee für später. Fenster-Tasten sind fest (unabhängig von der Spiel-Belegung): Pfeile/WASD bzw. Stick/Steuerkreuz wählen, E/Enter/Leertaste bzw. A nehmen, Esc bzw. B zurück, R bzw. X Kontext (drehen, raus), F bzw. Y rüber, Q bzw. LB/RB Tabs. Der Bau-Modus bleibt ein Modus (läuft weiter, Maus), hat aber Rahmen und Hilfezeile, B schließt.
- **Wände halten alles auf (Daniel, 12.11.2026, gebaut):** Hiebe, Schüsse und Gegner-Angriffe gehen nie durch Wände, geschlossene Türen oder brüchige Wände, auch wenn die Grafik hineinragt. An der Wand bleibt die Waffe an der Brust (der Schuss gibt nur Funken), bei einem Hieb rutscht Leyla ein Stück zurück, damit die Pose passt.
- **Gegner-KI (Daniel, 12.11.2026, gebaut):** aus Bausteinen, alle Werte im Bereich Gegner.
  - **Wahrnehmung:** Sicht nur mit freier Sichtlinie und im Blickwinkel (dicht dahinter spüren sie Leyla auch), **Gehör** (Schüsse tragen weit, Nahkampf kurz, durch Wände die Hälfte), Gedächtnis: verlieren sie Leyla, suchen sie an der letzten Stelle, schauen sich um und geben dann auf.
  - **Verhalten:** Patrouille (läuft, beißt), Stürmer (Sturmangriff), Schütze (hält Abstand, schießt nur mit freier Linie, die Ziellinie endet an der Wand), Lauerer (hängt an der Decke, fällt herab, kämpft dann am Boden), Flieger (schwebt über Leyla, schießt oder stößt herab), Boss vorerst wie ein Stürmer. Gegner nehmen kleine Stufen im Sprung und springen beim Verfolgen ein paar Kacheln tief.
  - **Konter:** Schild vorn (von vorn prallen Schüsse und leichte Hiebe ab, ein schwerer Treffer öffnet die Deckung, dreht sich langsam um), Ausweichen (hüpft vor Nägeln und Hieben weg), Panzerung (leichte Treffer kratzen, schwere brechen Platten). Neue Gegner: Plünderer mit Schild, Panzerwache.
  - **Offen:** eigenes Boss-Verhalten für den Hausmeister, Gruppen-Alarm (Daniel hat erst einmal Sicht + Gehör gewählt), Gegner-Grafiken.
- **Inventar:** Slots für Nahkampf, Fernkampf, Cyberdeck und Rucksack. Der Rucksack ist ein Raster im Diablo-Stil; Gegenstände haben Tetris-Formen und lassen sich drehen, die Kapazität wächst mit der Qualität des Rucksacks. Bedienung nur mit der Maus, das Spiel läuft dabei weiter. Beute liegt als Bündel am Boden (Boden-Inventar wie bei XCOM); Stapelbares, das Leyla schon trägt, sammelt sie im Vorbeilaufen ein. Kisten und Lagerplätze im Rig sind ebenfalls Inventare.
- **Geld:** Deltas durch Kills, Kisten und Co.

### Tod und Mama-Bot

Stirbt Leyla, ist die Beute aus dem aktuellen Run verloren. Mama-Bot, ihre Drohne, rettet sie und bringt sie zurück zum Rig. Alles andere bleibt erhalten: Rig, Upgrades, Rezepte und Deltas auf dem Konto. Später kann Mama-Bot über Drohnen-Upgrades einen Teil der Beute mitretten.

### Ranking

Nach einem abgeschlossenen POI gibt jede Kategorie eigene Punkte, die Summe ergibt den Rang von F bis S.

| Kategorie | Misst |
| --- | --- |
| Durchlaufzeit | Wie schnell der POI geschafft wurde (gegen die Bestzeit des POI) |
| Kills | Anteil besiegter Gegner in Prozent |
| Secrets | Anteil gefundener Geheimnisse |

Das Basisgeld aus dem Run ist immer sicher. Der Rang gibt einen Deltas-Bonus obendrauf (F = kein Bonus, S = größter Bonus). Wer stirbt, schließt den POI nicht ab und bekommt kein Ranking.

## Rig & Werkstätten

Das Rig ist Leylas Zuhause, Werkstatt und Fahrzeug zugleich. Es wird im Querschnitt gezeigt wie ein Puppenhaus.

- **Zugmaschine:** Leylas Van zum Start (mit zwei eigenen Werkstatt-Plätzen: Schlafkoje und Warroom), später LKW. Bestimmt Zugkraft, Spritverbrauch und wie viele Container hintereinander und übereinander passen.
- **Slots:** Motor, Panzerung, Waffen, Dach (Rig-Teile). Rig-Teile sind Bauteile wie Werkstätten: beim Händler kaufen oder an der Werkbank aus Gegenständen herstellen, sie liegen auf dem Schrottplatz und werden beim Rig bauen an die Sockel am Van geschraubt. Die Dachbox auf dem Dach vergrößert den Kofferraum. Im Inventar zeigt der Tab der Zugmaschine, was eingebaut ist.
- **Eigener Stauraum:** Die Zugmaschine hat einen kleinen Kofferraum, jeder Anhänger einen Deichselkasten, damit Leyla auch ohne Lager-Werkstatt ein paar Sachen verstauen kann. Das Lagerregal bleibt das große, allgemeine Lagermodul.
- **Payload:** Container (Hochseecontainer, Holzkisten, Wohnwagenteile). Anfangs knapp, mit stärkerer Zugmaschine horizontal und vertikal stapelbar. Je nach Größe fasst ein Container eine, zwei oder drei Werkstätten. Gestapelt wird auf Anhänger ohne Dachaufbau (und auf Container): der obere Container ist begehbar, Leyla kommt per Leiter oder Doppelsprung hoch. Die Stapelhöhe kommt von der Zugmaschine (Van 2).
- **Budgets:** Zugkraft begrenzt das Gewicht, Energie (Lichtmaschine, Generator, Reaktor) begrenzt die Werkstätten, das Gewicht erhöht den Spritverbrauch, die Stapelhöhe kann Routen sperren.

Werkstätten: Waffenkammer, Kühlraum, Zelle, Schlafzimmer, Chill Area, Drohnenwerkstatt, Warroom, Küche, Foodtruck (jaaa, wirklich), Motorraum, Reaktor. Perspektivisch: Automatisierung der Herstellung.

### Camp (Daniel, 07.11.2026 abends)

- **Ansicht:** begehbar im Side-Scroll (Leyla läuft durchs Camp und ins aufgeschnittene Rig, E benutzt Dinge). Umbauen passiert im Camp selbst (B oder Warroom › Rig umbauen), siehe „Rig bauen“.
- **Wann:** vor und nach jedem POI-Run, immer dort, wo das Rig gerade steht.
- **Zeit:** Ereignis-Zeit. Die Uhr springt nur bei Aktionen: Schlafen bis zum Morgen, am Feuer sitzen, Fahren, ein Run kostet Stunden; Kochen und Craften kosten Minuten.
- **Loop:** Im Warroom das Ziel wählen (hier plündern oder hinfahren, kostet Sprit, Vorräte, Zeit). Zurück per Van (E am Van im POI) oder Ausgang; k.o. = Mama-Bot bringt Leyla ins Camp, die Run-Beute ist weg.
- **Look:** Lagerfeuer, Tag/Nacht mit dem Wetter-System, Companions mit Sprüchen in Bläschen (zum Testen von Anfang an dabei: Schraube und Onkel Sung). Grafik erst aus Code, KI-Bilder rasten später per „Aussehen“ ein.
- **Spielstand:** online pro Login, auf allen Geräten gleich.
- **Lieferung:** 1) Camp begehbar + Werkstätten + Schlafen + Loop + Spielstand online ✔, 2) Beute + Rucksack-Raster (Tetris-Formen) ✔, 3) Kochen/Craften (Rezeptbuch + Experimentieren) ✔, 4) Bau-Ansicht (Werkstätten umstellen, kaufen, Container an-/abhängen, Budgets) ✔. Damit ist der Camp-Plan komplett (08.11.2026).

### Rig bauen (Daniel, 08.11.2026 morgens: „muss sich anfühlen wie das Bauen eines Rigs und weniger wie ein Menü“)

- **Ort:** direkt im Camp. B zoomt sanft raus auf Schrottplatz, Rig und Van, die Budget-Leiste (wie vorher) fährt oben rein; B, Esc oder „Fertig“ zoomt zurück.
- **Haptik:** Ziehen mit Gewicht. Das Teil hängt an der Maus, pendelt (schwere Teile träger), rastet mit Klonk, Staub und Wackeln ein, die Federn des Anhängers wippen nach.
- **Anhänger:** echte Silhouette: Rahmen, Achsen mit Rädern und Kotflügeln, Deichsel mit Kupplung und Stützrad, hinten eine Öse für den nächsten. Innen weiter das Puppenhaus. Daniels Bild-Anhänger bleibt, wie er ist.
- **Ankoppeln:** Anhänger packen und an eine Kupplung ziehen (hinter den Van, zwischen zwei Anhänger, ans Ende); klack.
- **Schrottplatz links beim Schacht:** ausgebaute Werkstätten auf Paletten, abgehängte Anhänger parken kleiner dahinter. Dort der **Händler-Platz**: Teil draufziehen = verkaufen, Gekauftes (Katalog über „Händler“ oder Klick aufs Schild) wird dort geliefert.
- **Sofort echt:** jede Aktion zählt gleich (Δ und Zeit). Danach läuft Leyla hin und schraubt kurz (Zeitraffer, man kann weiterbauen, sie arbeitet die Liste ab). **Rückgängig** nimmt die letzte Aktion zurück, solange Leyla sie noch nicht festgeschraubt hat.

## Crafting & Kochen

Rezepte: aus x A, y B (und z C) wird D, in einer bestimmten Werkstatt. Es gibt viele Gegenstände, viel Junk und viele Kombinationen, manche logisch, manche sonderbar.

Rezepte entdecken:

- **Experimentieren:** Zutaten frei kombinieren. Ein Treffer landet im Rezeptbuch, ein Fehlschlag ergibt kuriosen Müll.
- **Funde im POI:** Bauanleitungen, Kochbücher, Notizzettel.
- **Companions:** verraten Rezepte oder geben vage Hinweise.
- **NPCs:** Händler verkaufen Rezepte.

**Im Spiel (08.11.2026):** E an Kochnische, Küche oder Werkbank öffnet Rezeptbuch und Topf. Zutaten kommen aus Lager, Kiste und Rucksack. Experimentieren: die richtigen Zutaten in mindestens der richtigen Menge treffen (abschaltbar: genaue Mengen), ein Treffer landet im Rezeptbuch, ein Fehlschlag ergibt kuriosen Müll je Werkstatt-Art (Verkohlter Klumpen, Graue Pampe, Kabelsalat, Schrottskulptur); fehlt nur eine Zutat, heißt es „Knapp daneben“. Zettel aus dem POI liest man im Rezeptbuch, Companions im Camp geben vage Tipps und kommentieren ihre Werkstatt. Gerichte isst man im Inventar (Feld „Benutzen“). Alles einstellbar im Bereich „Kochen & Craften“.

Gekochte Gerichte geben Buffs für den nächsten Run, versorgen Companions auf Reisen oder werden im Foodtruck verkauft.

## Companions, Oberwelt & Wirtschaft

- **Companions** leben im Rig: Sie betreiben Werkstätten (Koch im Foodtruck, Mechanikerin in der Drohnenwerkstatt), geben Buffs und Rezepttipps. Eigene Quests und Storylines kommen in Ausbaustufe 2. Vorerst kommen sie nicht mit in die POIs.
- **Reisen** kostet Sprit (mehr bei schwerem Rig), Vorräte (pro Kopf und Tag) und Zeit (Tag-Nacht-Wechsel, nachts gefährlicher).
- **Währung:** Deltas, die offizielle und halb wertlose Stadtwährung von BigCityDelta.
- **Foodtruck:** An POIs mit NPCs verkauft Leyla selbst gekochte Gerichte.

## Look & Feel

![Leyla – Character Sheet](../projects/nomadgirl/assets/leyla/character_sheet.png)

Weird Cyberpunk mit Augenzwinkern: humorvoll, aber niemals albern. In und um das Rig herrscht Cosy-Stimmung.

- **Perspektive:** reine Side-Scroll-Ansicht ohne Neigung.
- **Proportionen:** realistisch.
- **Rig:** Querschnitt wie ein Puppenhaus.
- **Kontrast:** draußen rau und gefährlich, drinnen warm und gemütlich.
- **Fidelity:** so hoch wie möglich. 1920×1080, Kacheln 64 px, Leyla 192 px hoch (drei Kacheln), Kamera-Zoom 0,75 (in der Werkstatt einstellbar), hochaufgelöste KI-Grafiken statt Low-Res-Pixel-Art.
- **Leyla:** pinker Irokese, ärmellose Tech-Weste, Neon-Cyan-Akzente (Details und Palette in `docs/assets.md`).

## Technik

- **Ziel:** eine Engine, in der alle Aspekte des Spiels über die Werkstatt (GUI) gesteuert werden. Vorbild: die Werkstatt von NomadTactics.
- **Sprache:** JavaScript als ES-Module ohne Build-Schritt, wie NomadTactics. Gemeinsamer Kern (`ui.js`, `ui.css`, `basis.css`, `icons.js`, `store.js`) als Kopie.
- **Spiel:** Phaser 3.90 im Browser als Vendor-Datei (`game/vendor/phaser.min.js`), Arcade-Physik. Seite `game.html`, Code in `game/play/`. (Phaser 4 ist inzwischen erschienen; ein Umstieg wäre später möglich.)
- **Daten:** JSON unter `projects/nomadgirl/`, Schema in `engine/schema.js`.
- **Lizenz:** GPL v3 oder später. Alle Assets erzeugen wir selbst mit KI, nichts Externes.
- **Online:** Cloudflare Worker, https://nomadgirl.dna20717.workers.dev

## Fahrplan

### MVP: Movement & Kampf

- [x] Gehen, Rennen, Springen (Coyote Time, Sprungpuffer, Doppelsprung, kurzer Hüpfer beim Loslassen)
- [x] Dash (auch in der Luft, unverwundbar) und Slide (unter Hindernissen durch)
- [x] Klettern (Leitern) und Schwingen (Seil-Anker, Pendel mit Schwung-Boost)
- [x] Ein Nahkampfangriff (Rohrzange), ein Fernkampfangriff (Nagelpistole)
- [x] Ein Testraum mit zwei Gegnertypen: Plünderer-Schläger (stürmt, holt aus) und Plünderer-Schütze (hält Abstand, zielt sichtbar)
- [x] Alle Werte kommen aus der Werkstatt (Leyla, Waffen, Gegner, Raum-Bausteine, Kacheln); gespeicherte Werkstatt-Stände gelten beim nächsten Laden des Spiels
- [ ] Feinschliff nach dem ersten Anspielen (Daniel)
- [ ] Weitere Leyla-Animationen (Gehen, Rennen, Springen, Dash …) einklinken

**Steuerung (Tastatur):** A/D bzw. ←/→ laufen (Shift: gehen), Leertaste springen, L/C Dash, S/↓ beim Rennen Slide, S + Leertaste durch Plattform fallen, W/↑ klettern bzw. Seil greifen (auch E), J/Y Nahkampf, K/X Fernkampf, R Neustart, H Hilfe, G Hitboxen.

**Platzhalter:** Leyla hat bisher nur die Idle-Animation; Laufen, Springen, Dash, Slide, Klettern und Schwingen zeigt das Spiel mit Code-Effekten (Squash & Stretch, Neigung, Nachbilder, Blinken). Die Plünderer sind aus Code gezeichnet, bis sie ein Aussehen bekommen.

### Ausbaustufe 1: Der Loop

Ein POI mit Ranking, Rucksack-Raster, Tod mit Mama-Bot, Rig mit zwei bis drei Werkstätten, einfache Oberweltkarte mit Sprit.

- [x] Camp begehbar: Rig als Puppenhaus, Van mit Schlafkoje + Warroom, Lagerfeuer, Companions, Tag/Nacht (07.11.2026)
- [x] Loop Camp → Warroom → Run → Van/k.o. → Camp, Ereignis-Zeit, Sprit und Vorräte beim Fahren, Buffs aus dem Schlaf für den nächsten Run
- [x] Spielstand online pro Login (Cloudflare KV), ohne Worker im Browser
- [x] Beute + Rucksack-Raster (Tetris-Formen, nur Maus), Boden-Inventar im Run, Kiste und Lagerregal im Camp (07.11.2026)
- [x] Kochen & Craften (Rezeptbuch, Experimentieren, Zettel, Companion-Tipps, Essen)
- [x] Bau-Ansicht (Umstellen, Kaufen/Verkaufen, Container, Budgets Gewicht/Energie/Länge; Zugmaschine tauschen folgt)
- [x] Rig-Teile an Sockeln im Bau-Modus (kaufen, herstellen, verkaufen), Kofferraum und Deichselkästen
- [x] Rig bauen 2.0: im Camp mit Ziehen, Pendeln, Einrasten, Schrottplatz + Händler, sofort echt, Leyla schraubt, Rückgängig
- [x] POIs aus Raum-Bausteinen zusammensetzen: Tankstelle KM7 als erstes Level mit Kisten, Secrets, Schalter-Tür, Ziel, Ranking und Abkürzung (10.11.2026); Großmarkt, Bunker, Ministerium brauchen noch Raum-Layouts

### Ausbaustufe 2

Companion-Quests und Storylines, Hacking, Automatisierung, mehr Container und Zugmaschinen.

## Offene Fragen

- [ ] Wie hoch ist der Ranking-Bonus pro Rang? (Platzhalter in der Werkstatt)
- [ ] Was macht die Zelle im Rig?
- [ ] Was ist das „vielleicht noch Gefährlichere“ in den Wastelands?
- [ ] Gibt es eine übergeordnete Story oder ein Endziel?
