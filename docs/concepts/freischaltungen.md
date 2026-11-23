# Freischaltungen: der Meta-Baum

Stand 23.11.2026 · Konzept von Ava (Code) aus dem Gespräch mit Daniel. **Gebaut als #184/#185**, Feature-Wissen in `docs/features/unlocks.md`.

## Anlass

Daniel, 23.11.2026: „Was wir hier gebaut haben, ist im Grunde der Vertical Slice. Im nächsten Schritt gilt es, die Progression so zu schneiden, dass die Systeme dosiert nach und nach auf den Spieler losgelassen werden. Ich würde beinahe so eine Art Meta-Techtree festlegen wollen.“

Avas Befund davor: Das Spiel ist sehr breit (Camp, Rig, Kochen, Craften, Cyberware, Techtree, POIs, Crew, Gangs, Reisen, Hacking, Mega-Rigs, Handel …), und ein neuer Spieler bekommt heute alles auf einmal. Die erste Stunde braucht einen roten Faden.

## Entscheidungen (Daniel, 23.11.2026)

1. **Meta** ist eine eigene Währung für einen eigenen Baum. Sie entsteht nach dem Muster **Ziel erfüllt → Story-Moment → Meta** (Antwort 1C). Mit Meta öffnen sich Systeme.
2. **Ein neuer Baum, für den normalen Spieler unsichtbar.** Der Spieler erlebt Quests und Story-Momente; der Baum zählt im Hintergrund mit. Zum Testen ist er sichtbar: **Pause-Menü › Cheats › Meta-Baum** (alle Stufen, was frei ist, per Klick freischalten oder sperren). Der heutige Techtree im Warroom (Weg zum Heilmittel, Technik/Wissen/Bio) bleibt, wie er ist, und wird selbst ein System mit eigener Stufe.
3. **Stufen, darin frei:** feste Stufen 0, 1, 2 …; innerhalb einer Stufe bestimmt der Spieler die Reihenfolge, je nachdem, welches Ziel er zuerst erfüllt bzw. welche Quest er zuerst angeht. Die nächste Stufe öffnet, wenn genug aus der vorigen frei ist.
4. **Gesperrtes je System einzeln entscheiden** (ganz unsichtbar, Teaser oder als Quest erzählt). Daniels Beispiel, das zum Muster für alle wird: **Schraube hilft, Händler zu werden** ist eine Questkette mit nachhaltiger Belohnung: Danach fährt ein Händler im Team mit.
5. **AvAs Tank ist ab Stufe 0 sichtbar**, sein Verfall startet erst mit der Stufe, die die Pflege freischaltet (Stufe 4).
6. **Stufe 0 spielt im ersten POI** direkt nach dem Intro (einfach, kurz, fester Seed, Vorschlag Mile 7 Gas & Go); danach kommt das Camp.
7. **Reihenfolge der Stufen** wie unten: abgesegnet.

## Die Stufen

Muster für jeden Auslöser: **Ziel** (was der Spieler tut) → **Story-Moment** (wer etwas sagt oder zeigt) → **+Meta** → **frei**. Die Ziele, Szenen und Meta-Mengen sind ⚠️ Vorschläge von Ava.

### Stufe 0 · Erwachen

| System | Was frei wird | Ziel → Story-Moment |
|---|---|---|
| Bewegung | Laufen, Springen, Ducken, Kanten, Leiter, Dash | von Anfang an (Intro → erster POI) |
| Kampf | Nahkampf, Schießen, Nachladen, Kampfmodus | erster Gegner im ersten POI → AvA: „Links! Der hat einen Schraubenschlüssel!“ |
| Benutzen | E an Türen, Schaltern, Leitern | erste Tür |
| AvA | folgt Leyla, warnt, Stimmungen | von Anfang an |
| Tank | sichtbar im HUD, **ohne Verfall** | von Anfang an |

### Stufe 1 · Plündern

| System | Was frei wird | Ziel → Story-Moment |
|---|---|---|
| Rucksack + Inventar | Raster, Drehen, Ausrüsten | erste Kiste → AvA erklärt den Rucksack |
| Tresor + Ranking | Ziel des POIs, Rang, Bonus-Kiste | Tresor im ersten POI → Rang-Karte |
| Rückkehr + k.o. | zurück zum Van, AvAs Rettung | erster Weg zum Van bzw. erster k.o. |
| **Grund-Camp** | Lagerfeuer, Schlafen, Lager, Companions reden | erster Tresor → AvA: „Wir brauchen einen Platz zum Bleiben.“ |

### Stufe 2 · Unterwegs

| System | Was frei wird | Ziel → Story-Moment |
|---|---|---|
| Reisekarte + Fahrt | Karte, Etappen, Sprit, Vorräte | 2 POIs geschafft → Schraube macht den Van flott |
| Zwischenfälle | Ereignis-Baukasten unterwegs | erste Fahrt |
| Erstes Hacking | ein Entity, ein Duell (bis dahin **ganz raus**) | Datenkristall in einem POI → AvA findet etwas im Netz |

### Stufe 3 · Zuhause

| System | Was frei wird | Ziel → Story-Moment |
|---|---|---|
| Rig bauen | Bau-Modus, Werkstätten umstellen, Händler-Katalog im Bau-Modus | Schraubes Quest „Kabelsalat“ |
| Kochen | Kochnische, Rezeptbuch, Buffs | Quest von Onkel Sung („Sungs Suppe“) |
| Craften | Werkbank, Herstellen, Experimentieren | erste Werkbank im Rig |
| **Handel** | Händlerfenster, Schraube als Händler, Händler an Orten und auf der Straße | **Questkette „Schraube wird Händler“** (siehe unten) |
| Vorschuss | Onkel Sung leiht Δ | erste Pleite (Δ unter einer Schwelle) → Sung bietet an |

### Stufe 4 · Die Suche

| System | Was frei wird | Ziel → Story-Moment |
|---|---|---|
| Tank-Pflege + Verfall | Verfall läuft, Wartung, Rettungen kosten | erster Tank-Alarm (Story, kein echter Verfall vorher) → AvA bekommt Angst |
| Techtree zum Heilmittel | Warroom-Techtree, Hauptquest im Questlog | danach → Warroom zeigt den Weg |
| Ressourcen | Technik, Wissen, Bio, Zerlegen | erster Knoten braucht sie |

### Stufe 5 · Karawane

| System | Was frei wird | Ziel → Story-Moment |
|---|---|---|
| Crew + Siedler | Bewerber am Feuer, Aufnahme, Jobs | erster Bewerber |
| Moral | Rig-Moral, Stimmung | dritter Kopf im Rig |
| Lucky Ferro | Companion + Händler | heute „ab Tag 3“, künftig: Ziel dieser Stufe |
| Vertrauensbäume | Stufen der Kernfiguren | erst gebaut, wenn es sie gibt |

### Stufe 6 · Machtspiele

| System | Was frei wird | Ziel → Story-Moment |
|---|---|---|
| Gangs + Ruf | Ruf-Anzeige, Gang-Aufträge, Frieden | erste Gang-Begegnung |
| Revierkrieg + Fronten | Gangs kämpfen selbst | Ruf bei einer Gang „Freund“ |
| Kopfgeld + Dunkelheit | Gefangene, Zelle, Kopfgeldjäger | erster Gefangener |
| Schwarzmarkt, Ghostwire | Händler an Orten nachts | Lucky kennt jemanden |

### Stufe 7 · Giganten

| System | Was frei wird | Ziel → Story-Moment |
|---|---|---|
| Mega-Rigs + Bergung | Wracks auf der Karte, Bergung, Umziehen | Wrack-Hinweis auf der Karte |
| Cyberware in der Tiefe | Ripperdoc, Stufen, seltene Implantate | Doc Mirela (wenn es sie gibt) |
| Entities voll | Cyberdeck, Bit-Stapel, Kaufen/Tauschen | Ghostwire |

Was jetzt noch nicht eingeordnet ist (Radio, Achievements, Feldhandbuch, Wetter, Kleinvieh …), läuft **immer**: Es hilft oder schmückt, ohne etwas zu verlangen.

## Muster-Quest: Schraube wird Händler

Daniel: „Schraube dabei zu helfen, Händler zu werden, wäre ein tolles Quest mit einer nachhaltigen Belohnung (man hat einen reisenden Händler im Team).“

⚠️ Vorschlag Ava, drei Schritte im Questlog (Auftraggeber Schraube):

1. **„Ein Stand braucht Ware“:** 10 Schrott-Dinge bringen (Kupferkabel, Platinen …). Schraube: „Wenn wir das schon alles schleppen, kann ich es auch verkaufen.“
2. **„Eine Kasse“:** eine Registrierkasse bzw. ein Geldkasten aus einem POI (neuer Quest-Gegenstand, vorhandenes Symbol oder aus Code).
3. **„Der erste Kunde“:** Bei der nächsten Karawane auf der Straße handelt Schraube mit (Zwischenfall als Folge).

**Belohnung:** das Händlerfenster mit Schraube, im Camp und **unterwegs** (bei jedem Halt an einem Ort ein Knopf „Handeln: Schraube“). Dazu: Händler an Orten und auf der Straße erscheinen ab jetzt (vorher fahren Karawanen nur vorbei). +Meta.

## Gesperrtes je System

Daniels Regel: je System entscheiden. Dazu (Daniel, 23.11.2026): „Ich würde sogar noch einen Schritt weitergehen und einige Systeme (Hacking und Cyberware, Mega-Rigs …) nicht einmal teasern und aus dem UI so lange raushalten.“

| Art | Wann | Systeme |
|---|---|---|
| **Ganz raus** (Daniel) | bis zur Freischaltung keine Spur in der Oberfläche | **Hacking + Entities**, **Cyberware**, **Mega-Rigs + Bergung**, **Machtspiele** (Gangs/Ruf, Revierkrieg, Kopfgeld, Dunkelheit, Gefangene/Zelle) |
| **Unsichtbar** (⚠️ Ava) | würde nur verwirren | Moral, Zerlegen, Ressourcen Technik/Wissen/Bio bis Stufe 4 |
| **Teaser** (⚠️ Ava) | Neugier hilft | Werkbank im Rig mit Plane drüber („Schraube braucht Kabel“), verschlossene Warroom-Karte |
| **Als Quest erzählt** | das System hat eine Figur | Handel (Schraube), Kochen (Sung), Vorschuss (Sung) |

### „Ganz raus“ heißt überall raus

Damit ein System wirklich weg ist, schweigt es an jeder Stelle, bis es frei ist:

- **Inventar:** keine Implantat-Slots (Cyberware), kein Cyberdeck-Tab, keine Entities, kein Gefangenen-Platz.
- **Camp und Bau-Modus:** Ripperdoc-Liege, Serverschrank, Zelle fehlen im Händler-Katalog und im Rig; kein „Umziehen“ in Mega-Rigs, kein freundliches Duell am Feuer.
- **Reisekarte und Straße:** keine Wracks, keine Bergung, keine Fronten, keine Gang-Ketten, keine Kopfgeldjäger, keine Ghostwire- und Schwarzmarkt-Händler.
- **HUD und Fenster:** keine Ruf-Anzeige, keine Dunkelheit, keine Bergungs-Quests im Questlog, keine Duell-Knöpfe.
- **Radio, Storylets, Aufträge, Achievements, Lektionen, Steuerungs-Hilfe:** keine Zeile, die auf das System zeigt (Achievements des Systems zählen erst ab der Freischaltung oder bleiben verdeckt).
- **Startseite und Intro** bleiben, wie sie sind (Stimmung, keine Mechanik).

**Dinge verborgener Systeme in Beute und Ware** (Daniel: „Als Wertsache“): Implantate, Programme, Entities, Baupläne dafür tauchen weiter auf, gelten aber als **Wertsache**: Tooltip nur mit Name, Marke und „Wertsache · lässt sich verkaufen“, kein Slot, keine Erklärung, keine Werte. Mit der Freischaltung werden sie benutzbar, wo sie liegen. ⚠️ Ava: Händler zahlen dafür den Wertsachen-Kurs; ein Zettel im Spiel darf sie „seltsame Technik“ nennen.

⚠️ Offen: **Gangs im Hintergrund.** Gangs sind auch heute schon Gegner in POIs und Figuren auf der Straße. Vorschlag: Sie bleiben als Gegner und Namen da, der **Ruf zählt still mit**, aber Anzeige, Gang-Aufträge, Frieden, Ketten und Revierkrieg kommen erst mit „Machtspiele“.

## Technik (Vorschlag)

- **Werkstatt-Bereich „Freischaltungen“** (`data/unlocks.json`, Gruppe Grundlagen): je System eine ID, Name, Stufe, Meta-Preis, Auslöser (Zähler wie bei Achievements, Quest erledigt, Merker, Tag), Story-Moment (Lektion, Dialog, Toast), Art des Sperrens (unsichtbar / Teaser / Quest), Teaser-Text. Dazu die Stufen: Name, „nächste Stufe ab n Freischaltungen“.
- **Spielstand:** `save.meta = { points, unlocked: [ids], stage }`. **Neuer Durchgang:** wählbar (bleibt oder zurück auf 0), siehe Runde 2.
- **Eine Abfrage überall:** `unlocked(D, save, 'trade')` in `game/unlocks.js` (ohne DOM). Jedes System fragt an seiner Tür: Gespräch „Handeln“, Knöpfe auf der Karte, Tab im Inventar, Bau-Modus-Taste, Tank-Verfall, Zwischenfälle …
- **Story-Moment:** nutzt, was es gibt: Lektionen im Feldhandbuch (Karte beim ersten Mal), Companion-Dialog (`hud.menu` mit `talk`), AvA-Stimmungen, Toasts. Jede Freischaltung bringt ihre Lektion.
- **Alte Spielstände:** bekommen beim Laden alles frei (`repairSave`), damit niemand etwas verliert.
- **Cheats › Meta-Baum:** Stufen als Spalten, Systeme als Karten (frei / offen / gesperrt), Klick schaltet um, „alles frei“ und „zurück auf Stufe 0“.
- **„Ganz raus“ technisch:** jedes Fenster und jede Tabelle fragt `unlocked()`; Beute fragt `hiddenAs(D, save, item)` und zeigt verborgene Dinge als Wertsache. Ein Prüfwerkzeug (Browser-Test) läuft Stufe 0–3 ab und sucht in DOM und Texten nach Wörtern der verborgenen Systeme (Implantat, Cyberdeck, Ruf, Bergung …).
- **Datenset „Alles frei“** für Tests und Werkstatt, damit die Browser-Tests nicht an Freischaltungen hängen (wie `furnishedStart`).

## Entschieden in Runde 2 (Daniel, 23.11.2026)

- **Neuer Durchgang:** „beim Neustart wählbar“: Beim neuen Durchgang fragt das Spiel, ob die Freischaltungen bleiben (Traum-Wissen) oder ob es bei Stufe 0 losgeht. Neues Spiel (alles zurücksetzen) beginnt immer bei 0.
- **Meta als Preis:** „vom System abhängig“: Freischaltungen haben einen eigenen Meta-Preis (0 = das Ziel schaltet direkt frei). Kleine Systeme gehen direkt, große (Hacking, Cyberware, Mega-Rigs) sammeln Meta aus mehreren Zielen.
- **Schraube:** „ist von Anfang an dabei, aber er wird erst später zum Händler“: Schraube steht ab dem Grund-Camp am Feuer (Reden, Sprüche, Aufträge); „Handeln“ gibt es erst nach der Questkette „Schraube wird Händler“.
- **Gangs:** „still mitzählen“: Gangs bleiben als Gegner und Namen, der Ruf zählt unsichtbar mit; Anzeige, Gang-Aufträge, Frieden, Ketten und Revierkrieg kommen mit „Machtspiele“.

## Entschieden in Runde 3 (Daniel, 23.11.2026)

- **Start-Rig: nur das Nötigste.** Van + Wohnanhänger mit Schlafkoje und Lagerregal. Kochnische (Geschenk von Sung mit seiner Quest), Werkbank (von Schraube mit „Kabelsalat“) und Warroom (mit dem Reisen) kommen mit ihrer Freischaltung ins Rig bzw. auf den Schrottplatz.
- **Zahlen: Startwerte von Ava** in der Werkstatt (Bereich Freischaltungen), Feinschliff nach Daniels erstem Durchspielen.

Damit sind alle Fragen beantwortet.

## Nächste Schritte

1. ~~Daniel beantwortet die offenen Fragen~~ (erledigt, Runden 2 und 3).
2. Ticket #184: Bereich Freischaltungen + `unlocks.js` + Cheats-Ansicht + die Türen der Stufen 0–3 + Questkette „Schraube wird Händler“.
3. Ticket #185: Stufen 4–7 inklusive „ganz raus“, danach Spieltest der ersten Stunde mit dem Feedback-Knopf.
