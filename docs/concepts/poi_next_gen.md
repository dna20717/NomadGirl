# POI: Nächste Generation

Stand 21.11.2026 · Recherche und Vorschlag von Ava, Grundsatzfragen von Daniel entschieden. Ausführliche Fassung mit Quellen: Doc „NomadGirl – POI Design Bible“ (claude.ai), Reiter „Nächste Generation“. Baut auf [`poi_bible.md`](poi_bible.md) und [`poi_steckbriefe.md`](poi_steckbriefe.md) auf. **Beginnt erst, wenn #160, #158, #163 und #159 für alle POIs fertig sind.** Jede Stufe gilt wieder für alle POIs zugleich.

## Entschieden (Daniel, 21.11.2026)

- **Reihenfolge:** G1 Erzählschicht zuerst, dann G2 Struktur, G3 Leben, G4 Hüllen, G5 Kuratieren, G6 Mitbauen.
- **Simulation in G3:** auch zwischen Besuchen. Gruppen wandern, Nester wachsen, Lager ziehen um, während Leyla weg ist (wie Rain World).
- **Leylas Spuren** (geöffnete Kisten, zerstörte Sirenen, gefallene Bosse): verblassen langsam; einige Tage im Durchgang, dann räumen neue Bewohner auf und bauen um.
- **Größe mit Zyklen:** Richtwert 7 Räume je Kreis; große POIs wie Silo Zero dürfen mehrere Kreise haben.

## Neun Schichten

Welt (Weltchronik, Revierkrieg #102) → POI-Geschichte (Steckbrief + Zeitschichten) → Struktur (Zyklus-Graph) → Räume (Bausteine, Raumtypen, Wow-Raum, WFC füllt den Rest) → Hülle (Gebäude-Grammatik) → Dressing (Ort-Typen, Ensembles, Verfall, Tropes, Wüste) → Leben (Lager, Beziehungen, Regie, Storylets) → Kuratieren (Prüfer, Personas, Varianten-Karte) → Daniel (Galerie, Mitbauen, Abnahme). Jede Schicht liest die Schicht darüber.

## Die Stufen

| Stufe | Inhalt | baut auf | Aufwand |
| --- | --- | --- | --- |
| G1 Erzählschicht | Storylets (ein Katalog für Zettel, Durchsagen, Funk, Radio-Gerüchte, Ortsfenster; Splitter-Faden zu AvA als Kette), Tropes als Spuren-Bausteine mit Bedingungen, Zeitschichten je POI (1–3 Zwischenbesitzer, hinterher begründet per Ersetzungs-Grammatik wie Caves of Qud), Revierkrieg schreibt neue Schichten, Leylas Spuren verblassen langsam | #160, #159, #102 | M |
| G2 Struktur | Zyklus-Graph vor den Räumen (Unexplored): 6 Rezepte (Schlüssel und Schloss, versteckte Abkürzung, Einbahn hinunter, Doppelweg, Gefahr und Belohnung, Rückweg verändert), Schlüssel aus der Story (Keycard, Stempel, Ventilrad), Platzhalter spät auflösen, 7 Räume je Kreis | #163, Raumtypen | L |
| G3 Leben | Beziehungstabelle (Gangs, Rivalen, Kleinvieh, Jäger/Beute), Lager statt Spawn-Punkte, Runden durch den POI, **Simulation auch zwischen Besuchen**, Regie Aufbau → Spitze → Ruhe mit Verstärkung (#155), Sirenen und Musik-Schichten, nie Verstärkung in Atempausen | #155, POI-Musik, #163 | L |
| G4 Hüllen | Gebäude-Grammatik in Seitenansicht (Sockel, Etagen, Fensterachsen, Dach), Hülle um die verschweißten Räume, Fenster = Fenster der Räume, Silhouetten für Landmarken und Parallax | #158 (Set je Gebäude) | M |
| G5 Kuratieren | Varianten-Karte je POI (Quality-Diversity, z. B. Vertikalität × Kampfdichte, je Feld die beste Variante), Seeds aus der kuratierten Sammlung, vier Spieltest-Personas über `nomad` (Rennerin, Plünderin, Kämpferin, Erkunderin), Werte in der Galerie | Level-Prüfer (#163) | M |
| G6 Mitbauen | Wave Function Collapse lernt aus den handgebauten Räumen, vervollständigt Teilentwürfe in der Werkstatt; Story/Rolle/Region schalten Kacheln ab (wie das Biom in Bad North); Wege und Kampfräume bleiben handgebaut | alle | L |

## Bewährte Tropes (Spuren-Bausteine für G1)

Letzte Pose · Das letzte Logbuch · Indizienkette (2–3 Dinge ergeben einen Hergang) · Der eingefrorene Moment · Die letzte Stellung · Warnung an der Wand · Der Schrein · Die Natur (bei uns: die Wüste) holt es zurück · Werbung gegen Wirklichkeit · Das Haus läuft weiter (Entity-Gewohnheit) · Neue Ordnung im alten Raum · Kinderspuren (sparsam). Grundsätze nach Smith/Worch („What Happened Here?“, GDC 2010): ziehen statt drücken, man muss etwas übersehen können, kein anonymes Detail, am Kern der Welt festmachen, Requisiten mit zwei Ebenen. Wir meiden Gore um seiner selbst willen, Skelett-Witze am Fließband, Erklärtexte und austauschbare Endzeit-Kulisse. Beispiele und Dosierung je Trope: Doc-Fassung.

## Wo KI hilft und wo nicht

Algorithmen für Wege, Sprünge, Graph und Kollision (exakt, prüfbar); Ava (KI) vorab für Steckbriefe, Storylets, Zettel und Screenshot-Kritik, Daniel segnet ab; PixelLab nur nach Asset-Wunschliste; **keine KI-Generierung zur Laufzeit** (ohne Netz, schnell, reproduzierbar).

## Quellen (Auswahl)

[Dungeon Generation in Unexplored – Boris the Brave](https://www.boristhebrave.com/2021/04/10/dungeon-generation-in-unexplored/) · [Procedurally Generating History in Caves of Qud – GDC Vault](https://gdcvault.com/play/1025379/Procedurally-Generating-History-in-Caves) · [WaveFunctionCollapse – mxgmn](https://github.com/mxgmn/WaveFunctionCollapse) · [Exploring procedural design in Rain World – Unity](https://unity.com/cn/blog/exploring-procedural-design-rain-world) · [Left 4 Dead 2 Director Scripts – Valve](https://developer.valvesoftware.com/wiki/Left_4_Dead_2/Scripting/Director_Scripts) · [Storylets – Emily Short](https://emshort.blog/tag/quality-based-narrative/) · [PCG through Quality Diversity – Gravina et al.](https://ar5iv.labs.arxiv.org/html/1907.04053) · [Automated Playtesting with Procedural Personas – Holmgård et al.](https://ar5iv.arxiv.org/html/1802.06881) · [Harvey Smith on environmental storytelling – Nieman Storyboard](https://niemanstoryboard.org/2011/01/14/harvey-smith-on-environmental-storytelling-and-embedding-narrative/) · [Level Generation Through LLMs – Todd et al.](https://arxiv.org/pdf/2302.05817) · vollständige Liste in der Doc-Fassung.
