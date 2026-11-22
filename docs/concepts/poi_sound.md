# POI-Ton: Musik, Färbung, Ambience, Akustik, Klangquellen

Design-Session 22.11.2026 (Ava + Daniel, Projekt-Chat). Anlass: Platz 2 der Feinschliff-Liste (`poi_feinschliff.md`): „Ton macht die Hälfte der Atmosphäre“. Ticket: **#180**. Musik-Kanon: claude.ai-Projekt › `leyla-theme.md` (4/4-Fassung), Skripte jetzt auch im Repo unter `tools/music/` (`leyla_poi.py`, `music_engine.py`; braucht numpy, scipy, numba).

## Ist-Stand (22.11.2026)

- **Musik im POI:** Regie aus G3 (#169, `game/play/director.js`) blendet Schichten aus dem **Radio-Synth** (`RadioSynth.setVoices`): Ruhe = Flächen + Bass, Anspannung = + Hats/Melodie, Kampf = alles. Klingt in allen POIs gleich.
- **Gerenderte POI-Schichten** vom 14.11. (`leyla_poi.py`, Seed 1313): `poi_explore`, `poi_tension`, `poi_jitter`, `poi_combat` (je 32 Takte, 120 BPM, 64 s, taktgleich, nahtlos) + `poi_stinger_start`/`_end`. Nie eingebaut.
- **Ambience:** im POI keine (Wind, Böen, Lagerfeuer nur im Camp). **Effekte:** 55 Ton-Ereignisse, meist Code-Platzhalter (`docs/sounds.md`, #130). Schritte kennen Sand/Stein/Blech. Kein Hall, keine Dämpfung.

## Entscheidungen (Daniel, 22.11.2026)

| # | Frage | Entscheidung |
|---|---|---|
| ① | Musik-Basis | **Hybrid:** gerenderte Schichten vom 14.11. als Basis, darüber eine **live erzeugte Färbungs-Schicht** |
| ① | Regie | **Mix:** Ereignisse schalten sofort hoch, die Regie (Spannungswert) entscheidet über das Abklingen |
| ② | Färbung | **Je Region** (5 Färbungen), nicht je POI |
| ③ | Ambience | **Aus der Story:** Klang-Bausteine, abgeleitet je Raum aus den Steckbrief-Feldern |
| ④ | Akustik | **Hall + dumpf:** Hall nach Raumgröße und Material, Töne hinter Wänden/Türen gedämpft, draußen trocken mit Wind |
| ⑤ | Klangquellen | **Alle vier Gruppen:** Technik, Leben, Radios + Durchsagen, Vorboten |
| – | Momente | **Atempause, Wow-Raum und Tresor** bekommen je einen eigenen Ton-Moment |
| – | Ablauf | **Parallel:** Code baut das System (#180), Ava rendert im Projekt-Chat Hörproben der 5 Färbungen und der Momente zum Abnehmen |

## ① Musik-Basis und Regie

**Vier Grundschichten** (gerendert, Dateien, taktgleich 64 s) laufen ab Betreten gleichzeitig los, nur die Lautstärken wechseln. Dadurch bleiben alle Schichten immer im Takt.

| Schicht | Datei | Inhalt | Wann hörbar |
|---|---|---|---|
| Erkundung | `poi_explore` | Drone, Glas-Flächen, FM-Glocken im Picking-Muster, Herzschlag, Glasflöte mit Antwort-Motiv und Hauptthema | immer |
| Spannung | `poi_tension` | Streicher-Tremolo mit reibender kleiner Sekunde, Shepard-Ton, Taiko | Gegner hat Leyla bemerkt |
| Nervosität | `poi_jitter` | zerhackter Akkord, Glitches, Ticks ±6 ms, AvAs Daten-Chirps | Treffer ausgeteilt oder bekommen |
| Puls | `poi_combat` | Four-on-the-floor, Sechzehntel-Bass/-Arp, Lead | Elite, Boss, mehrere Gegner oder Regie-Phase **Spitze** |
| Färbung | live (Web Audio) | Region (siehe ②) | immer, im Kampf leiser |

**Regie = Mix** (`director.js` erweitert):
- **Hochschalten über Ereignisse, sofort** (auf die nächste Achtel quantisiert, Einblenden ≈ 0,5 Takte): bemerkt → Spannung · Treffer (Leyla trifft oder wird getroffen) → + Nervosität · Elite/Boss/≥ 3 kämpfende Gegner/Phase Spitze → + Puls. Erste Stufe spielt `poi_stinger_start`.
- **Abklingen über die Regie:** jede Schicht bleibt, solange der Spannungswert über ihrer Halte-Schwelle liegt (⚠️ Start: Spannung 15, Nervosität 30, Puls 50), danach **3 s Nachlauf** (Daniel 14.11.: Option 1c), dann Ausblenden ≈ 2 Takte. Fällt alles auf Erkundung: `poi_stinger_end`.
- **Jittery** (Daniel 14.11.): Die Nervosität darf auch ohne Treffer kurz anspringen, wenn ein Gegner Leyla knapp verliert oder eine Sirene heult (⚠️ 1 Takt lang).
- Die Radio-Synth-Schichten aus #169 fallen im POI weg (bleiben fürs Rig-Radio). Regie-Wellen, Verstärkung, Phasen bleiben, wie sie sind.

## ② Färbung je Region

Eine live erzeugte Schicht über der Erkundung, im Takt der Grundschichten (120 BPM, gleiche Akkordfolge aus dem Kanon: A1/A2 `Dm C B♭ A Dm F Gm A`, B `B♭ F Gm Dm B♭ C A A`, Takt-Position aus der Wiedergabezeit der Grundschichten). Gewürfelte und dynamische POIs erben die Färbung ihrer Region. ⚠️ Vorschlag, wird mit den Hörproben abgenommen:

| Region | POIs | Färbung | Textur |
|---|---|---|---|
| **Highway** | Mile 7 Gas & Go, Sunny Acres, Funkmast KM 31 | Slide-Gitarre (Karplus-Strong, Brücke zum Camp-Lagerfeuer), spielt Picking-Fetzen und das Antwort-Motiv | Wind, quietschendes Schild, Funkrauschen |
| **Stadtrand** | Delta South Megamall, Delta Heights, P+R Delta Süd, Metro Line 4, Storm Drain 9 | kaputte Kaufhaus-Muzak: leiernde E-Piano/Vibraphon-Akkorde mit Band-Wobble | Lautsprecher-Gong, fernes Stadtbrummen, großer Hallen-Hall |
| **Salt Flats** | Deadlock Bunker 13, Pit 6 | gestrichenes Metall, Morse-Piepen im Rhythmus des Motivs | Geigerzähler-Knistern, Lüftungsbrummen, enger harter Hall |
| **Delta Ring** | Ministry of Order, Delta Crude Refinery | kalte Orgel/Chor-Fläche, Uhrwerk-Ticken auf den Vierteln | Schreibmaschinen-Rhythmus, Dampfventil-Zischen als Akzent |
| **Versteckt** | Silo Zero | tiefer Chor, Theremin-Linie mit dem Hauptthema | Countdown-Piepen, Sub-Brummen |

Perspektivische POIs (Vulkan Heavy Works, Wrack-Ort, Kessler Clinic Tower, NomadCola Plant, Salt Lake Motel) bekommen die Färbung ihrer Region, sobald sie gebaut werden.

## ③ Raum-Ambience aus der Story

Kein handgesetzter Raumton: Jeder Raum mischt sich seinen Ambience-Teppich aus **Klang-Bausteinen**, abgeleitet aus `roomStory(poi, room)` (#160) und dem Level (`terrain.inside`, Raumtyp aus #163, Raum-Geschichte aus #159, Bewohner aus #169).

| Quelle im Steckbrief/Level | Baustein (⚠️ Startliste) |
|---|---|
| draußen | Wind (Stärke nach Region), Böen, ferne Krähen/Insekten |
| drinnen | Raumton (leises Rauschen, nach Raumgröße tiefer) |
| Rolle Technik/Industrie (`story.function`) | Lüftung, Trafo-Brummen, Rohrknacken |
| Verfall ≥ 2 (`story.decay`) | Knarzen, rieselnder Putz, Wind durch Löcher |
| Raum-Geschichte „Überflutet“ | Tropfen, Plätschern |
| Bewohner/Lager (`story.today`, G3) | entferntes Murmeln, Radio leise (siehe ⑤) |
| Wüste kriecht rein (#159) | Sand rieselt an Eingängen/Fenstern |
| Raumtyp Vertikale/Schacht | tiefer Luftzug, Hallfahne |

Übergänge: Raumwechsel blendet in ≈ 1,5 s über. Werkstatt: Bausteine, Regeln und Lautstärken unter **Ton › POI › Ambience**; pro Raum optional Bausteine erzwingen/verbieten (gleiche Logik wie Pflicht-Dinge/Verboten im Steckbrief).

## ④ Akustik

- **Hall je Raum:** Größe aus Breite × Höhe des Raums (klein = trocken, Hallen/Festsaal/Raketenschacht = lang), Klang aus dem Kachel-Set (⚠️ Start: `marble` lang und hell, `metal`/`bunker` kurz und hart-metallisch, `mall` groß und weich, `desert`/draußen fast trocken). Ein Faltungs-Hall (Web Audio `ConvolverNode`) je Hall-Klasse, aus Code erzeugte Impulsantworten, Übergang beim Raumwechsel.
- **Dumpf hinter Wänden:** Töne von Quellen ohne Sichtlinie zu Leyla (die Strahlen des Nebels aus `fog.js` wiederverwenden) laufen durch Tiefpass + leiser; geschlossene Tür = stärker, offene/zerstörte Tür (#174) = schwächer. So verrät ein Gegner hinter der Wand sich, ohne sich zu zeigen.
- **Draußen:** kein Hall, dafür Wind; Töne weit weg verlieren Höhen.
- Gilt für Effekte, Stimmen, Klangquellen und Ambience. Musik bleibt unberührt (außer der Färbung, die den Raum-Hall leicht mitnimmt).

## ⑤ Klangquellen in der Welt

Positionale Quellen mit Abstand und Stereo-Richtung (links/rechts), höchstens ⚠️ 8 gleichzeitig (die nächsten gewinnen).

| Gruppe | Quellen |
|---|---|
| **Technik** | Lampen brummen und knistern beim Flackern (an die Lampen-Verhalten `stutter`/`alarm`/`buzz` in `engine/atmosphere.js` gekoppelt), Automaten, Generatoren, Terminals, Lüfter; Stromausfall (Sicherungskasten) schaltet sie hörbar ab |
| **Leben** | Kleinvieh (Fliegen-Summen nach Schwarmgröße, Ratten-Trippeln, Kakerlaken-Rascheln), Gang-Lager (Murmeln, Lagerfeuer, Schnarchen nachts, Funkgerät) |
| **Radios + Durchsagen** | gefundene Radios spielen einen Sender des Rig-Radios (#090, Saint FM gestört), Lautsprecher bringen die Durchsagen der Storylets (#167) mit Lautsprecher-Filter und Hall |
| **Vorboten** | Funken an kaputten Leitungen, knarzende Böden, Tropfen vor Wasser, ferne Sirene vor der Verstärkung; Ton warnt vor Gefahr und bereitet Punkt 4 der Feinschliff-Liste (Umgebung zum Anfassen) vor |

Quellen hängen an Tags aus dem Dressing (#158: z. B. `leuchtet`, `technik`) und an Objekten aus Level/Leben; neue Quellen ohne Code über Werkstatt › Ton › POI › Klangquellen.

## Besondere Momente

- **Atempause** (Raumtyp aus #163): Grundschichten ziehen sich auf ⚠️ 30 % zurück, dazu leise eine **Camp-Gitarre** mit dem Antwort-Motiv (Karplus-Strong wie im Leyla Theme, im 4/4-Kanon, 120 BPM im Takt). Kampf-Schichten sind dort ohnehin aus (keine Verstärkung in Atempausen).
- **Wow-Raum:** beim ersten Betreten ⚠️ 1 s Stille (Musik und Ambience ducken), dann der vorhandene Stinger und das **Hauptthema** (Teil B) in der Färbung der Region, solange die Kamerafahrt läuft; danach normal weiter.
- **Tresor:** eigener Jingle (⚠️ 2–3 s, Hauptthema Takt 5–8 mit dem Sprung zum F, Glocken + Fläche), ersetzt dort `toast_good`.

## Mischung

- Prioritäten: Durchsagen und AvA ducken Musik und Ambience (⚠️ −8 dB), Kampf duckt Ambience (⚠️ −6 dB) und Färbung (⚠️ −4 dB).
- Ein Bus je Art (Musik, Färbung, Ambience, Quellen, Effekte, Stimmen), alle Lautstärken in den Einstellungen; Stumm-Taste M bleibt.
- Alles in der Werkstatt einstellbar, Spielstände bleiben gültig.

## Hörproben (Ava, Projekt-Chat)

Ava rendert die 5 Färbungen über der Erkundungs-Schicht, Atempause, Wow-Moment und Tresor-Jingle zum Anhören. Nach Daniels OK gehen die Rezepte (Instrumente, Tonhöhen, Rhythmen) als Daten in die Färbungs-Schicht; abgenommene Stems landen unter `projects/nomadgirl/assets/sound/music/`.
