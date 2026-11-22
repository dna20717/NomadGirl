# POIs: Was noch fehlt, damit sie richtig geil werden

Stand 22.11.2026 · Ava (Code) nach der Runde #160–#172 (Story, Level-Design, Dressing, Wow-Räume, G1–G4). Daniels Auftrag: „Mach eine Liste, was uns noch fehlt, damit die POIs richtig geil werden.“ Sortiert nach Wirkung pro Aufwand; **Top 5** zuerst.

## Top 5

| # | Was | Warum es zählt | Aufwand |
| --- | --- | --- | --- |
| 1 | **Echter Spieltest durch Daniel** (je POI ein Run, Notizen per Karte) | Alles seit #158 ist nur kopflos geprüft: Lesbarkeit, Kamera, Dichte, Regie und Musik hat noch kein Mensch gespielt. Erst danach lohnt Feinschliff wirklich. | S (Daniel) |
| 2 | **Ton im POI**: Ambience je Ort (Brummen im Bunker, Wind auf dem Dach, Tropfen im Kanal, Muzak in der Mall), Schritte je Untergrund, Hall je Raumgröße, Musik-Schichten mit Stil je POI | Ton macht die Hälfte der Atmosphäre; heute sind 55 Ton-Ereignisse Platzhalter (#130), die Musik-Schichten (#169) klingen überall gleich. | M |
| 3 | **Bosse und Höhepunkte je POI** mit eigener Mechanik (Amtsleiter im Ministerium, Silo-Kommandant, Nest-Mutter im Kanal …) | Nur 3 Boss-Räume; der Tresor ist das Ziel, der Weg dorthin hat keinen Gegenspieler mit Gesicht. | L |
| 4 | **Umgebung zum Anfassen**: zerbrechliches Clutter (Glas, Kisten, Flaschen), Gefahren (Strom im Wasser, Gas + Funken, einstürzende Böden), Physik-Objekte (Fässer rollen, explodieren), Traversal-Momente (Seilrutsche, fahrender Aufzug, Förderband) | Die Räume sehen jetzt echt aus, reagieren aber kaum. Interaktion macht aus Kulisse einen Spielplatz und passt zu Leylas Granaten und Wende-Wurf. | M–L |
| 5 | **Mehr Raum-Bausteine je POI** (heute ≈ 9 Räume je POI, 123 gesamt) | Zyklus-Graph, Rhythmus und Story würfeln gut, aber aus wenig Material: nach ein paar Runs kennt man die Räume. Ziel ≈ 15 je POI, mit G6 (WFC) halb automatisch. | M (mit G6) |

## Was die Levelkarten zeigen (Megamall und Silo Zero, Seed 1)

- **Megamall:** Die Hülle macht aus dem Level endlich ein Gebäude, aber die drei Obergeschosse sind reine Fassade mit gleichförmigen Fenstern; gespielt wird fast nur auf einem langen Erdgeschoss plus Tunnel. Mehr begehbare Etagen (Galerien, Rolltreppen) würden die Mall-Fantasie tragen.
- **Silo Zero:** schöner Abstieg mit der Rakete als Höhepunkt kurz vor dem Tresor; das Gestein zwischen den Räumen ist aber eine große, gleichmäßige Fläche, und darin steht auf vielen Kacheln die Zahl **„07“** (gebackene Schrift im Kachel-Set, gegen die neue Regel).
- **Ordnungsreihen wiederholen sich:** dieselbe Werkbank fünfmal nebeneinander (#159 „Ordnung“); Reihen brauchen Varianten oder Lücken mit Abwechslung.

## Aussehen

- **Fassaden-Module gemalt** (#172, läuft): die Hüllen aus Code wirken flach.
- **Ein Kachel-Set je Gebäude** konsequent: Delta Heights mischt noch Ziegel und Beton von Raum zu Raum.
- **Gemalte Kipp-Varianten** für den Verfall (#159 kippt per Drehen/Spiegeln aus Code).
- **Lager kennen das Dressing nicht** (#169): Lager-Requisiten können sich mit Ensembles überlappen.
- **Schlüssel-Requisiten gemalt** (#168, heute aus Code): Keycard, Stempel, Ventilrad, Parkschein … (Wunschliste `docs/assets.md`).
- **Fehlende Landmarken** gemalt: Funkmast-Spitze, Lichtschacht, Kronleuchter, Zug, Startrampe.
- **Tief drinnen dunkler** (#159 Rest) und **Fensterblick mit Parallax** (heute statisch).
- **Wetter im POI**: Regen und Sand fallen durch Dachlöcher und kaputte Fenster, Pfützen wachsen.
- **Techtree-Bilder mit Text** neu malen (`tt_nodes_2/3/4/7`, #170).

## Spielgefühl

- **Treffer und Zerstörung**: Funken, Splitter, Staub an Wänden, Löcher bleiben (passt zu Leylas Spuren #167).
- **Kamera-Momente** außer dem Wow-Raum: kurzer Zoom beim Betreten großer Hallen, Blick nach unten an Abgründen.
- **Lesbarkeit prüfen**: Hülle, Rückwand, Tropes, Lager und Licht übereinander; Spielfläche muss sofort lesbar bleiben (Kontrast-Prüfer).

## Leben und Inhalt

- **G5 Kuratieren**: Varianten-Karte je POI + vier Spieltest-Personas (Rennerin, Plünderin, Kämpferin, Erkunderin) spielen per `nomad` automatisch und messen Spaß-Werte; nur gute Seeds kommen ins Spiel.
- **G6 Mitbauen**: WFC lernt aus den handgebauten Räumen und vervollständigt Entwürfe in der Werkstatt (hilft Punkt 5).
- **Runden über Leitern** und **Wandern über die Reisekarte** (#169 Reste): Gruppen ziehen sichtbar von Ort zu Ort.
- **Belohnungen mit Geschichte**: je POI ein paar einzigartige Fundstücke/Trophäen aus der Story (Stempel des Amtsleiters, Raketen-Schlüssel), die im Rig ausgestellt werden.
- **NPCs, die nicht kämpfen**: Händler im Lager, Gefangene (#079), Überlebende mit Auftrag; das Ergeben (#155) bekommt eine Folge.
- **Nebenziele im Run**: „Rette X“, „Sabotiere die Sirenen“, „Hole die Akte“, aus Storylets (#167) gewürfelt.

## Technik

- **Leistung auf echter Hardware** mit Hülle, Lagern, Licht und Partikeln (kopflos nicht messbar).
- **Ladezeit** der POIs mit allen neuen Bildern.
- **Speicherstände** über viele Tage (Ökosystem, Spuren, Zeitschichten) auf Größe prüfen.
