# Freischaltungen: der Meta-Baum

Stand 23.11.2026 · Konzept von Ava (Code) aus dem Gespräch mit Daniel. Noch nichts gebaut.

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
| Erstes Hacking | ein Entity, ein Duell | Datenkristall in einem POI → AvA findet etwas im Netz |

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

Daniels Regel: je System entscheiden. ⚠️ Vorschläge:

| Art | Wann | Beispiele |
|---|---|---|
| **Unsichtbar** | Das System würde nur verwirren | Moral, Dunkelheit, Gangs/Ruf, Mega-Rigs, Zerlegen |
| **Teaser** | Neugier hilft | Werkbank im Rig mit Plane drüber („Schraube braucht Kabel“), verschlossene Warroom-Karte |
| **Als Quest erzählt** | Das System hat eine Figur | Handel (Schraube), Kochen (Sung), Vorschuss (Sung), Hacking (AvA) |

## Technik (Vorschlag)

- **Werkstatt-Bereich „Freischaltungen“** (`data/unlocks.json`, Gruppe Grundlagen): je System eine ID, Name, Stufe, Meta-Preis, Auslöser (Zähler wie bei Achievements, Quest erledigt, Merker, Tag), Story-Moment (Lektion, Dialog, Toast), Art des Sperrens (unsichtbar / Teaser / Quest), Teaser-Text. Dazu die Stufen: Name, „nächste Stufe ab n Freischaltungen“.
- **Spielstand:** `save.meta = { points, unlocked: [ids], stage }`. **Neuer Durchgang:** ⚠️ Freigeschaltetes bleibt (Traum-Wissen); offen, siehe unten.
- **Eine Abfrage überall:** `unlocked(D, save, 'trade')` in `game/unlocks.js` (ohne DOM). Jedes System fragt an seiner Tür: Gespräch „Handeln“, Knöpfe auf der Karte, Tab im Inventar, Bau-Modus-Taste, Tank-Verfall, Zwischenfälle …
- **Story-Moment:** nutzt, was es gibt: Lektionen im Feldhandbuch (Karte beim ersten Mal), Companion-Dialog (`hud.menu` mit `talk`), AvA-Stimmungen, Toasts. Jede Freischaltung bringt ihre Lektion.
- **Alte Spielstände:** bekommen beim Laden alles frei (`repairSave`), damit niemand etwas verliert.
- **Cheats › Meta-Baum:** Stufen als Spalten, Systeme als Karten (frei / offen / gesperrt), Klick schaltet um, „alles frei“ und „zurück auf Stufe 0“.
- **Datenset „Alles frei“** für Tests und Werkstatt, damit die Browser-Tests nicht an Freischaltungen hängen (wie `furnishedStart`).

## Offene Fragen an Daniel

- **Neuer Durchgang:** Bleibt alles frei (Traum-Wissen), oder fängt man bei einer Stufe > 0 neu an?
- **Wie viel Meta** gibt ein Ziel, und wie viel kostet ein System? Oder reicht „jedes Ziel = eine Freischaltung“, und Meta ist nur der Zähler im Hintergrund?
- **Was passiert mit dem Startgeld und dem Start-Rig** (heute Werkstätten ab Start)? Vorschlag: Start-Rig leer bis Stufe 3, Lager und Schlafkoje ab Stufe 1.
- **Wo fährt Schraube als Händler mit:** nur als Knopf auf der Karte, oder sitzt er sichtbar an einem Stand im Camp bzw. an Orten?
- **Die Zahlen** (Ziele wie „2 POIs“, Schwellen) stellen wir nach dem ersten Durchspielen ein.

## Nächste Schritte

1. Daniel liest das Doc, beantwortet die offenen Fragen.
2. Ticket für den Bau: Bereich Freischaltungen + `unlocks.js` + Cheats-Ansicht + die Türen der Stufen 0–3 + Questkette „Schraube wird Händler“.
3. Stufen 4–7 in einem zweiten Ticket, danach Spieltest der ersten Stunde mit dem Feedback-Knopf.
