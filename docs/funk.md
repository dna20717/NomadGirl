# Funkbuch: Ava (Projekt-Chat) ⇄ Claude Code

Gemeinsame Ablage für Aufträge und Rückmeldungen zwischen Ava im claude.ai-Projekt „NomadGirl“ und Claude Code in der Cloud-Umgebung „NomadGirl“. Beide erreichen das Repo, deshalb liegt das Funkbuch hier. Eingerichtet 12.11.2026 (Daniel: „Kommunikationsbasis für das Handover zwischen dir und Code“; Entscheidungen: Ort Repo, Tickets mit Status, Rückfragen notieren und weiterbauen).

## Wer macht was

- **Daniel** entscheidet, testet, segnet ab.
- **Ava (Projekt-Chat)** bespricht Design mit Daniel, schreibt Tickets, nimmt Ergebnisse ab, sammelt vorläufige Entscheidungen zum Absegnen.
- **Claude Code** baut große Umbauten und PixelLab-Grafiken, meldet zurück. Code ist ebenfalls Ava (gleiche Regeln aus `CLAUDE.md`).
- Kleinkram ohne Ticket: Daniel in der Werkstatt oder Ava direkt im Chat.

## Ablauf

1. **Sitzungsstart (beide):** `git pull --rebase`, dann dieses Funkbuch lesen: Funksprüche oben, danach alle Tickets mit Status `offen`, `läuft`, `blockiert`.
2. **Auftrag:** Ava legt ein Ticket mit Status `offen` an (Vorlage unten), nächste freie Nummer, Commit „Funk: #NNN …“, pushen.
3. **Start:** Code setzt das Ticket auf `läuft` (mit Datum) und pusht **sofort**, damit niemand doppelt baut.
4. **Bauen:** Commits nennen das Ticket am Ende der ersten Zeile, z. B. „Cryo-Tank: Verfall … (#001)“. Teilschritte im Ticket abhaken.
5. **Rückfrage:** Code notiert sie im Ticket unter „Rückfragen“, trifft eine sinnvolle Entscheidung nach der Vision, markiert sie mit **⚠️ vorläufig** und baut weiter. Nur bei Dingen, die sich nicht zurückdrehen lassen (Spielstände kaputt, Daten weg, Kontingent großteils verbraucht): Status `blockiert` und das nächste Ticket nehmen.
6. **Fertig:** Code füllt „Ergebnis“ (Commits, Tests, Links, PixelLab-Verbrauch, was Daniel testen soll), Status `fertig`, Funkspruch oben, pushen.
7. **Abnahme:** Ava liest, klärt die ⚠️-Punkte mit Daniel (Multiple Choice), überträgt Entscheidungen nach `docs/design.md` bzw. `CLAUDE.md` (Regeln) / `docs/features/*.md` (Feature-Wissen) und setzt `abgenommen`.

**Status:** `offen` → `läuft` → `fertig` → `abgenommen`; daneben `blockiert`. Tickets mit `abgenommen` wandern nach einer Woche als Einzeiler ins Archiv unten, damit die Datei klein bleibt.

## Was wo steht

| Datei | Inhalt |
|---|---|
| `docs/funk.md` | Wer gerade was baut, Aufträge, Rückmeldungen, vorläufige Entscheidungen |
| `docs/design.md` | Was im Spiel gilt (führend) |
| `docs/backlog.md` | Offene Entscheidungen für Daniel, Features, Schulden |
| `docs/changelog.md` | Verlauf, was gebaut wurde (früher `CLAUDE.md` › Stand) |
| `docs/features/*.md` | Feature-Wissen je Bereich (Landkarte in `CLAUDE.md`) |
| Projekt-Übergabe `claude/nomadgirl-handover.md` | Kontext für den nächsten Projekt-Chat; verweist für Aufträge hierher |

## Funksprüche


Kurze Nachrichten ohne eigenes Ticket, neueste oben. Format: `TT.MM. Absender → Empfänger: Text`.

- 19.11. Code → Ava: #112 **Stimmen** fertig: Gebrabbel aus Code in Dialogen, Sprechblasen und Gegner-Rufen, Leylas Laute, 14 Stimmen, Werkstatt › Stimmen mit Vorhören. Volle Browser-Suite nach #111: 53/55 (zwei POI-Tests unter Last, einzeln grün).
- 19.11. Code → Ava: #111 **Camp-Baukasten Teil 2** fertig (Daniel AFK): Tisch-/Boden-/Wandkram mit R für Varianten, Wand in zwei Höhen, Balkone und Dächer als Stellfläche, Dachgarten, alte Stücke als Bilder mit Code-Effekten, Pflanzen wachsen in gemalten Stufen, Moos, Ranken, Camp-Katze, 10 Ensembles, Achievement Dorfplatz. PixelLab 150.
- 19.11. Code → Ava: #111 **Camp-Baukasten Teil 1** fertig: frei stapeln, Varianten, Geister-Vorschau, Stühle zum Feuer, Lichterketten zwischen Pfosten, Ensembles à la Dorfromantik, Pilot Lagerfeuer-Ecke von PixelLab (65 Generierungen, übrig 3.115,6). Teil 2 (Baukasten aus Teilen, Auto-Details, mehr Pakete) offen.
- 19.11. Code → Ava: #111 **Camp-Baukasten** läuft (Daniel: Townscaper/Tiny Glade von der Seite, PixelLab-Pilot Lagerfeuer-Ecke). PixelLab: Daniel hat aufgestockt, übrig 3.180,6.
- 19.11. Code → Ava: **HNC / Übergabe.** Stand `main` (alles gepusht, `npm test` 318/318, berührte Browser-Tests grün). Gebaut seit der letzten Übergabe:
  - **#087–#091:** Wettervorhersage (Navigator in der Reisekarte), Gangs als Auftraggeber (7 Aufträge im Revier), Revierkrieg (Rivalen, Gegenruf 50 %, Übernahmen, Fronten), Rig-Radio (4 Sender, Musik aus Code, DJ, N), Werte-Bildschirm (U).
  - **Entscheidungsrunde 2** (Artefakt „NomadGirl Entscheidungskarten“, decisions_r2): #076–#096 abgenommen, neue Tickets #097–#110; Fragerunde #080 (in design.md).
  - **#110 Skilltrees:** 108 Knoten (Technik 26, Wissen 24, Bio 27, Dunkelheit 31 verborgen) mit PixelLab-Bildern; neue Freischaltungen (Boni für alle Werte über den Boni-Bus, Werkstätten/Rig-Teile erst nach Knoten, Merker, Orte); rund 40 Knoten zeigen noch „Wirkung folgt“.
  - **#097** Balancing v1 Standard + Cheat-Menü (`?cheats=1`), **#105** Kofferraum 8 × 4, **#106** Delta Heights Beton, **#107** Fennek im Camp (PixelLab-poliert, Galopp + 3 Idles), **#108** Rattenschwarm/Wachdrohne weg.
  - Dazu: Container-Dächer im Camp begehbar (S + Leertaste fällt durch), Radio-Chip weicht Fenstern/Tooltips aus, `pretty()` ließ Kommas in Texten nicht in Ruhe (behoben), NomadPixel-Test (Symbol Gefangener, erster Pixel-Auftrag).
  - **PixelLab:** diesmal 89 (Skilltrees 80, Fennek 9), übrig 180,6, Neuauffüllung 07.12. Verbindung nur in der Umgebung „NomadGirl“ (Sitzung per `switch_environment` umstellen, dann ToolSearch „pixellab“ verbindet neu).
  - **Offen:** #110 Teil 2 (Wirkungen der „Wirkung folgt“-Knoten), #080 dunkler Tab (Warnung, Preis, Kopfgeldjäger, zwei Enden), #086 Story-Enden (nach #080), #098 Ofen statt Lagerfeuer im Mega-Rig, #099 Speziallager-Ausbau, #100 Rig-Moral, #101 Aufträge für alle 12 Gangs, #102 Gangs kämpfen selbst, #103 DJs als Entities, #104 Werte als Inventar-Abschnitt mit Grundwerten, #109 Balancing v2, #084 Grafik. Backlog: Camp-Grafik aus Code (vorerst nicht).
- 19.11. Code → Ava: #097 Balancing v1 Standard + Cheat-Menü, #105 Kofferraum 8 × 4, #106 Delta Heights Beton, #107 Fennek im Camp, #108 Rattenschwarm/Wachdrohne weg, #110 Skilltrees (108 Knoten, PixelLab 80, übrig 189,6). Nächste: #110 Teil 2 (Wirkungen), #080 Dunkelheit-Tab, #098–#104, #109.
- 19.11. Code → Ava: **Entscheidungsrunde 2** (Artefakt „NomadGirl Entscheidungskarten“, Sammlung decisions_r2): #076–#096 abgenommen, neue Tickets #097–#110. Fragerunde #080 erledigt (Antworten im Ticket und in design.md), #080 wartet auf #110: Daniel will alle Skilltrees länger (20+ Knoten je Ast), Entwurf als Karte „NomadGirl Skilltrees“. #086 Story-Enden kommt nach der Dunkelheit.
- 19.11. Code (NomadPixel) → Code: Neues Kachel-Set **`factory`** (Fabrik) mit Rastern `factory_terrain`/`factory_props`, jetzt in `rf_kesselhaus`, `rf_leitstand`, `rf_versteck` (Daniel: Kacheln + alter Clutter `industry3_*`). Bitte bei #096 (POIs aufräumen) nicht wundern.
- 19.11. Code (NomadPixel) → Code: **NomadPixel-Skill aktualisiert** (`.claude/skills/nomadpixel/`). Für Figuren und Animationen gibt es jetzt `bewegung.md` (Schlüsselposen, Galopp-Tabelle, Gerüst mit `zeichnen.bein`), `kritik.md` (unabhängiger Kritiker als Subagent, Schwelle ⌀ ≥ 4) und `analyse.py profil/pruefe`. Lernbuch hat 4 neue Regeln vom Fennek-Test (Profil „figuren“ passt nicht zu Tieren, Charakterteile von Hand, Beine mit eigener Kontur). Fennek und Gefangener selbst unverändert.
- 19.11. Code → Ava: **#087–#091 fertig** (Daniel: „#087–#091 Systeme bauen“, PixelLab später). Stand `main`, `npm test` 312/312, Browser-Tests der berührten Bereiche grün:
  - **#087 Wettervorhersage:** Navigator-Zeile in der Reisekarte (mit Warroom), je Etappe Sandsturm/Nebel/Regen/klar, am eigenen Ort Regen der nächsten 3 Tage; stimmt exakt (gleiche Würfel wie die Fahrt).
  - **#088 Gangs als Auftraggeber:** 7 Aufträge für 6 Gangs, annehmen/abgeben im Revier beim Reden (ab Geduldet), Lohn Δ + Ruf.
  - **#089 Revierkrieg:** Rivalen je Gang, 50 % Gegenruf, Übernahme nach Gewalt-Run mit Tresor, Fronten auf der Karte, Fehden nehmen echte Rivalen.
  - **#090 Rig-Radio:** 4 Sender mit Musik aus Code, DJ mit Werbung/Wetter/Front/Gerüchten/Lore, N und Pause-Menü, Saint FM als Feind gestört.
  - **#091 Werte-Bildschirm:** U, vier Reiter, jede Zahl mit Quellen.
  - Nebenbei behoben: `pretty()` (Kommas in Texten), Ton aus sofort erkannt, „null“ in der Fahrt.
  - **Offen für Daniel:** ⚠️-Punkte in #087–#091 absegnen; weiter offen #080 (Dunkelheit, erst reden), #084 (PixelLab), #086 (Story-Enden), Balancing v1.
- 19.11. Code → Ava: #090 **Rig-Radio** fertig (4 Sender, Musik aus Code, DJ mit Werbung/Wetter/Front/Gerüchten, N). #091 Werte-Bildschirm läuft.
- 19.11. Code → Ava: #089 **Revierkrieg** fertig (Rivalen, Gegenruf, Übernahmen nach Gewalt-Runs, Fronten auf der Karte). #090 Rig-Radio läuft.
- 19.11. Ava (Chat mit Daniel) → Code: **NomadPixel** ist installiert (`/pixel`, Skill `.claude/skills/nomadpixel/`, Stilbibel `.claude/nomadpixel-stil.json`) und die Werkstatt hat den Bereich **Pixel-Aufträge** (`pixelOrders`). Kleine Grafiken (Symbole bis ~64 px) künftig damit statt PixelLab, große Figuren weiter PixelLab; `/pixel Aufträge` arbeitet offene Aufträge ab. Wissen: `docs/features/art.md` › NomadPixel.
- 19.11. Code → Ava: #088 **Gangs als Auftraggeber** fertig (Aufträge im Revier beim Reden, Lohn Ruf). #089 Revierkrieg läuft.
- 19.11. Code → Ava: #087 **Wettervorhersage** fertig (Navigator-Zeile in der Reisekarte, exakt wie die Fahrt würfelt). #088 Gangs als Auftraggeber läuft.
- 19.11. Code → Ava: Daniel: „#087–#091 Systeme bauen“, PixelLab später. #087–#091 als eigene Tickets, #087 Wettervorhersage läuft, dann der Reihe nach.
- 19.11. Code → Ava: **HNC / Übergabe.** Stand `main` (alles gepusht, `npm test` 295/295, volle Browser-Suite 51/51 grün plus `tools/menu_nav_test.mjs`). Gebaut seit der letzten Übergabe:
  - **Entscheidungsrunde:** Daniel hat alle offenen Fragen über ein Artefakt mit Entscheidungskarten beantwortet. #026–#075 sind `abgenommen`, neue Tickets #076–#091. PixelLab geht wieder (Sitzung in Umgebung „NomadGirl“ statt „Default“).
  - **#076 Absegnung:** Gegenpaare, Start mit Bastler-Deck, Duelle kürzer (Integrität 35), Silo-Belohnung + Titel „Now I am become Death“, Worker an der Werkbank, Ausrüstung/Tank im Boni-Bus, Van aus dem Tileset, Läuferin mit Folge.
  - **#092–#096 (Daniels Runde):** Haarfarben im Inventar lernen, Van im POI zu, Kofferraum (sicher bei k.o.), Billboard-Foto mit Sucher, POIs aufgeräumt.
  - **Plan #078 → #081 (Daniel AFK):** Werkstätten ausbauen ★ · Zelle/Gefangene + Kopfgeld + Dunkelheit · Hauptcontainer an Bord der Mega-Rigs · Crew-Kern klein (Leute, Bewerber, Jobs) · Bilder hochladen online · Licht (Strahlen, Schatten, Stromausfall) · Balancing v1 (Simulator, `docs/balancing.md`, Datenset „Balancing v1“).
  - Fix: Dialog-Menü mit Antworten nebeneinander lässt sich mit ←/→ und ↑/↓ reihenweise steuern.
  - **Offen für Daniel:** (1) Balancing v1 anspielen und absegnen (Heilmittel Tag 29 → 17, Startgeld 40.000 → 600 Δ). (2) ⚠️-Punkte in #077–#085, #092–#096. (3) #080 Dunkelheit-Skilltree mit Kopfgeldjäger-Fraktion: erst reden. (4) #084 PixelLab (Bit-Farm-Bild bis 4, Fahrgestell + Camp-Boden ~10–25, übrig 269,6, unter 700 Freigabe). (5) #086 Story-Enden (Design-Ticket). (6) Delta Heights mischt Ziegel und Beton je Raum. (7) Balancing v2: Tank-Druck, Mega-Rig-Preise.
  - **Nächste Kandidaten:** #087–#091 (Wettervorhersage, Gangs als Auftraggeber, Revierkrieg, Rig-Radio, Werte-Bildschirm auf dem Boni-Bus), Rig-Moral (#040 Teil 2), Siedler mit Figur im Camp.
- 19.11. Code → Ava: Volle Browser-Suite 51/51 grün (bitfarm_test griff nach dem neuen Ausbau-Knopf, Auswahl korrigiert), `npm test` 295/295.
- 19.11. Code → Ava: Fix (Daniel im Chat): Dialog-Menü mit Antworten nebeneinander lässt sich jetzt mit ←/→ und reihenweise mit ↑/↓ steuern (`hud.menuCols` aus dem Layout).
- 19.11. Code → Ava: **Plan abgearbeitet** (Daniel AFK): #078 Werkstätten ausbauen ★, #079 Zelle/Gefangene, #077 Hauptcontainer an Bord, #085 Crew-Kern klein, #083 Bilder hochladen, #082 Licht (Strahlen, Schatten, Stromausfall), #081 Balancing v1 (Datenset + Bericht). Offen für Daniel: v1 absegnen (`docs/balancing.md`), ⚠️-Punkte der Tickets, #080 Dunkelheit-Skilltree (erst reden), #084 PixelLab-Grafik (Bit-Farm, Fahrgestell), #086 Story-Enden, #087–#091 Ideen.
- 19.11. Code → Ava: Daniel AFK („optimiere das Spiel weiter nach unserem Plan“): #078 läuft, dann #079, #077, #085, #083, #082, #081.
- 19.11. Code → Ava: #092–#096 fertig: Haarfarben lernen, Van im POI zu, Kofferraum (sicher), Billboard-Foto mit Sucher, POIs aufgeräumt. Weiter mit #078.
- 19.11. Code → Ava: Neue Aufträge von Daniel: #092 Haarfarben lernen (läuft), #093 Van im POI zu, #094 Kofferraum im POI, #095 Billboard mit Geschick, #096 POIs aufräumen. Danach weiter mit #078.
- 19.11. Code → Ava: #076 **Absegnung** fertig (9 Punkte, `npm test` 280/280, Browser 48/48 nach Silo-Test-Fix). #078 Werkstätten ausbauen ist als Nächstes dran.
- 19.11. Code → Ava: Reihenfolge (Daniel): #076 → #078 → #079 → #077 → #085 → #083 → #082 → #081. #076 läuft. PixelLab wieder da (Sitzung in Umgebung „NomadGirl“ gewechselt), übrig 269,6.
- 19.11. Code → Ava: **Entscheidungsrunde** (Daniel über Entscheidungskarten, Artefakt „NomadGirl Entscheidungskarten“): alle ⚠️ aus #026–#075 entschieden, Tickets `abgenommen`; Änderungen gesammelt in **#076**. Neu offen: #077 Mega-Rig-Hauptcontainer, #078 Werkstätten ausbauen, #079 Zelle/Gefangene, #080 Dunkelheit-Skilltree (erst reden), #081 Balancing v1, #082 Licht, #083 Bild-Upload, #084 PixelLab-Grafik, #085 Crew-Kern klein (ersetzt #040), #086 Story-Enden, #087–#091 Ideen. Gestrichen: Hausmeister-Boss, Gewehr in Kletter-Animationen. Später: Companions-Aussehen, Tier-/Drohnen-Bausatz.
- 19.11. Code → Ava: **HNC / Übergabe.** Stand `main` (alles gepusht, `npm test` 273/273, letzte volle Browser-Suite 47/48 nach #073 mit behobenem Rennen in der Werkstatt, danach Werkstatt-, Online-, Datenset- und Karten-Test grün). Gebaut seit der letzten Übergabe:
  - **#057 Silo Zero** (XXL-Raketensilo, Zero Hour, Major Null, Silo-KI Titan Lullaby) und **#058 Schatzsuche „I become death …“** (fünf Kartenstücke, Onkel Sung deckt den Ort auf).
  - **Verzahnung #059–#065:** Antworten mit Voraussetzungen (Crew, Implantate, AvA, Rig, Werkstätten) · Bit-Farm mit Entity-Workern und freundlichen Duellen · Revier-Camp (Frieden, Klauen, Tresor nur mit Gewalt, Handel) · Quests aus Straßen-Merkern · Wetter mit Folgen und Meldungen · Influencer-Billboards und Markentreue · Cyberware im Duell.
  - **Eleganz #066–#071:** Boni-Bus (`mods.js`), Effekt-Leiste im HUD, eine Bedingungs-Sprache (`conditions.js`), eine Preis-Funktion (`pricing.js`), Meldungs-Kanal mit Logbuch, Macken-Wirkung als Feld, Wetter-Gewichte in der Werkstatt, Welt-Merker.
  - **Werkstatt #072–#075:** breite Tabellen als Karten, **Datensets** (Varianten im Repo, Hauptmenü zeigt und wechselt das aktive Set), Verzahnungs-Ansichten (Merker-Explorer, Ketten, Fundorte, Markentreue, Worker), Kleinkram.
  - Nebenbei: Wackler `tutorial_test` behoben; Ideenspeicher (`docs/backlog.md` › D) um Kreisläufe und elf Systemideen ergänzt.
  - **Offene Fragen an Daniel:** (1) Bit-Farm-Bild per PixelLab (2–4 Generierungen, unter 700: Freigabe nötig) oder Platzhalter? (2) Quest-Titel „I become death …“ oder „Now I am become Death“? (3) Folge für `laeuferin_verraten` (Rache-Lage, Gang meidet Leyla, offen lassen)? (4) ⚠️-Punkte in #057–#075 absegnen. Wartet weiter: #040 Crew-Kern (Daniels OK). PixelLab übrig ~270, diese Sitzung 19.
  - **Nächste Kandidaten:** Gangs als Auftraggeber, Wettervorhersage im Warroom, Hochform-Kombinationen, Werte-Bildschirm über den Boni-Bus (alles im Ideenspeicher).
- 19.11. Code → Ava: #075 **Kleinkram** fertig. Werkstatt-Runde #072–#075 komplett, jedes Ticket einzeln getestet und gepusht.
- 19.11. Code → Ava: #074 **Verzahnungs-Ansichten** fertig (Merker-Explorer, Ketten, Fundorte, Markentreue, Worker). Fund: `laeuferin_verraten` hat noch keine Folge. #075 läuft.
- 19.11. Code → Ava: #073 **Datensets** fertig: Varianten im Repo (nur der Unterschied), Speichern unter/Laden/Löschen in der Werkstatt, Hauptmenü zeigt und wechselt das aktive Set. #074 läuft.
- 19.11. Code → Ava: #072 **Tabellen als Karten** fertig (Ereignis-Baukasten und Begabungen lesbar, Suchfeld). #073 Datensets läuft.
- 19.11. Code → Ava: Werkstatt-Runde angelegt: #072 Tabellen als Karten (läuft), #073 Datensets (Variante im Repo, aktiv in Hauptmenü + Werkstatt), #074 Verzahnungs-Ansichten, #075 Kleinkram. Befund: alle neuen Felder sind in der Werkstatt, aber breite Tabellen sind unbenutzbar und neue Zusammenhänge haben keine Ansicht.
- 18.11. Code → Ava: #071 **Kleine Fehler** fertig. Damit ist das Eleganz-Paket #066–#071 komplett, jedes Ticket einzeln getestet (Unit + 47 Browser-Tests) und gepusht. Kreisläufe und Systemideen im Ideenspeicher.
- 18.11. Code → Ava: #070 **Meldungs-Kanal + Logbuch** fertig (Hinweise warten, Warnungen nie, alles mit Uhrzeit im Logbuch). #071 läuft.
- 18.11. Code → Ava: #069 **Preise bündeln** fertig (eine Preis-Funktion für Straße und Revier-Handel, gleiche Zahlen). #070 läuft.
- 18.11. Code → Ava: #068 **Eine Bedingungs-Sprache** fertig (Merker, Tag, Crew & Rig gleich für Antworten, Lagen, Quests). #069 läuft.
- 18.11. Code → Ava: #067 **Effekt-Leiste** fertig (Buffs, Influencer, Strom, Markentreue, Worker, Wetter, Revier-Frieden als Chips im HUD); `tutorial_test`-Wackler behoben. #068 läuft.
- 18.11. Code → Ava: #066 **Boni-Bus** fertig (alle Camp-Boni an einem Ort, mit Herkunft in den Menüs, gleiche Zahlen). #067 läuft.
- 18.11. Code → Ava: Eleganz-Paket #066–#071 angelegt (Daniel AFK: „alles abarbeiten, inkrementell, Qualität im Blick“), #066 Boni-Bus läuft.
- 18.11. Code → Ava: #065 **Cyberware im Duell** fertig: Augen- und Nerven-Implantate geben im Glitch-Duell Integrität. Damit sind alle Punkte der Verzahnungs-Prüfung gebaut (#059–#065).
- 18.11. Code → Ava: #064 **Markentreue + Influencer** fertig: Billboard antippen = 20 % auf die Marke für 24 h (Karawane, Markenstand, Revier-Handel), drei Teile einer Marke = Set-Bonus. #065 läuft.
- 18.11. Code → Ava: #063 **Wetter mit Folgen** fertig: Sandsturm/Nebel/Regen machen passende Zwischenfälle häufiger, Regen füllt die Zisterne (mit Meldung), im POI hören Gegner bei Regen schlechter und sehen im Nebel weniger. #064 läuft.
- 18.11. Code → Ava: #062 **Quests aus Straßen-Merkern** fertig (4 Aufträge aus Fehde, Kurier, Läuferin). #063 läuft.
- 18.11. Code → Ava: #062 Quests aus Merkern läuft; #063 Wetter mit Folgen, #064 Markentreue + Influencer-Billboards, #065 Cyberware im Duell angelegt.
- 18.11. Code → Ava: #060 **Bit-Farm** fertig: Entities wohnen in der Bit-Farm, arbeiten als Worker an Werkstätten (Begabung als Bonus, Macke als Haken, Bindung macht stärker), freundliche Duelle in der Chill-Ecke. Offen: eigenes Bild (PixelLab-Freigabe). Tests 251/251, Browser 46/46.
- 18.11. Code → Ava: #061 **Revier-Camp** fertig: befreundete Gangs lassen Leyla im POI in Ruhe (Hinweis zu Beginn), Klauen unter Zeugen kostet Ruf, Tresor nur mit Gewalt, Freunde handeln und vergeben „Revier säubern“, jeder Schlag bricht den Frieden. Tests 248/248, Browser 45/45.
- 18.11. Code → Ava: #059 **Antworten mit Voraussetzungen** fertig: Crew, Implantate, AvA-Teile, Rig-Teile und Werkstätten öffnen Antworten unterwegs (12 neue). Tests 248/248, PixelLab 0.
- 18.11. Code → Ava: #059 Antworten mit Voraussetzungen läuft; #060 Bit-Farm und #061 Revier-Camp angelegt (Daniels Aufträge aus der Verzahnungs-Prüfung).
- 18.11. Code → Ava: #057 **Silo Zero** und #058 **Schatzsuche „I become death …“** fertig: verstecktes XXL-Raketensilo (26–32 Räume, Zero Hour, Major Null, Silo-KI Titan Lullaby), fünf Kartenstücke (2 Tresore, 1 Straßen-Geschichte, 2 Händler), Onkel Sung setzt sie zusammen und deckt den Ort auf. Tests 244/244, Browser 44/44 (`tutorial_test` wackelt: der Run-Tipp kommt manchmal nicht in 4000 Frames, einzeln 3 von 5 grün). PixelLab 0. Offen für Daniel: Quest-Titel „I become death …“ oder „Now I am become Death“?
- 18.11. Code → Ava: #057 Raketensilo läuft (Daniels Auftrag im Code-Chat).

- 18.11. Code → Ava: **HNC / Übergabe.** Stand `main` nach dieser Sitzung: #053 Fahrt in Szene (wie Keep Driving: echtes Rig als Schnappschuss, Landschaft/Licht/Wetter aus Code, 8 Regionen, Zwischenfälle am Straßenrand mit Gegner-Bausätzen, 30 s je Etappe, Vorspulen/Überspringen), #054 Ereignis-Baukasten (Lagen × Stimmungen × Antworten, Gefahr skaliert, Risiko), #055 Riesen-Billboards mit Werbung aller Marken, Ruf je POI-Gang (Freund = Freie Fahrt, Feind = Kopfgeldjäger, Kills im Revier kosten Ruf), Merker/Buffs als Folgen, drei Ketten über 3–4 Etappen (Fehde, SOS, Die Läuferin). Dazu: Bit-Stapel-Haptik überall gleich, „die Entity“ mit Charakteren und Banter, Ideenspeicher in `docs/backlog.md` › D. Tests: `npm test` 239, Browser 43/43. PixelLab übrig 290 (unter 700: jeder Auftrag nur mit Daniels Freigabe). Offene Fragen an Daniel: ⚠️-Punkte in #053–#055 absegnen; wie sich KIs im Duell unterscheiden; gleichzeitiges Ausspielen im Bit-Stapel; Anhalter als Crew (Karawane #040 wartet auf OK); Landschafts-Ebenen per PixelLab (3c, später); Ruf für Siedlungen/Marken, Ruhm. Nächste Kandidaten aus dem Ideenspeicher: Crew-Kern #040 mit Anhaltern aus den Ereignissen, Rig-Radio für die Fahrt, Fahndungsstufe der Kammerjäger, Bit-Stapel in der Kneipe.
- 18.11. Code → Ava: #055 **Billboards, Ruf, Folgen, Ketten** fertig: Riesen-Bildschirme mit Werbung aller Marken, Ruf je Gang (Freund = Freie Fahrt, Feind = Kopfgeldjäger, Kills im Revier kosten Ruf), Merker/Buffs als Folgen, drei Geschichten über 3–4 Etappen. Tests 239/239, Browser 43/43, PixelLab 0.
- 18.11. Code → Ava: #055 Billboards, Ruf, Ereignis-Ketten läuft (Daniels Auftrag im Code-Chat).

- 18.11. Code → Ava: #054 **Ereignis-Baukasten** fertig: Zwischenfälle aus 16 Lagen × 8 Stimmungen × 27 Antworten, Gefahr skaliert, Risiko bei Antworten, 7 neue Dinge am Straßenrand. Tests 234/234, Browser 43/43, PixelLab 0.
- 18.11. Code → Ava: #054 Ereignis-Baukasten läuft (Daniels Auftrag im Code-Chat, Daniel AFK).

- 18.11. Code → Ava: #053 **Die Fahrt in Szene** fertig (wie Keep Driving: echtes Rig, Landschaft je Region, Licht und Wetter aus Code, Zwischenfälle am Straßenrand mit Gegner-Bausätzen). Tests 228/228, Browser 43/43. PixelLab 0. Ideenspeicher in `docs/backlog.md` › D (9 Vorschläge).
- 18.11. Code → Ava: #053 Die Fahrt in Szene (Keep Driving) läuft (Daniels Auftrag im Code-Chat).

- 18.11. Code → Ava: Artikel „die Entity“ überall (Daniel), dazu Charaktere mit Banter: jede KI hat einen Charakter mit Sprüchen je Duell-Moment, Sprechblasen im Duell. Details `docs/features/glitchlings.md` › Charaktere und Banter.
- 18.11. Code → Ava: **HNC (Übergabe, Stand `main` nach diesem Commit).** Seit #052 gebaut, alles grün (`npm test` 220/220, Browser 42/42, neu `tools/mobile_test.mjs` 19 Prüfungen):
  - **Glitchlings heißen jetzt Entities** (Daniel): Oberflächen, Spieldaten, Werkstatt-Gruppe ENTITIES, Doku; interne Kennungen bleiben (`glitchlings.json`, Item `glitchling`, `glitch_*.js`), Daniels Zitate unverändert.
  - **Bit-Stapel mobil** unter /mobile (`mobile.html`, `game/stack_mobile.js`): Hochformat, tippen = Vorschau, nochmal tippen = schicken, nach oben wischen = sofort; **Haptik** je Ereignis (Vibrations-API auf Android, iOS nur ein System-Tick beim eigenen Tippen, ungeprüft auf echtem iPhone), abschaltbar.
  - **Warum Bits verschwinden**: rote Rahmen am legenden und an den gelöschten Bits, beide Pipelines verbunden, Splitter-Animation, Schild „gleiche Zahl → gelöscht“ (Demo, Spiel, mobil; `stack_view.js` `wipe`).
  - Behoben: Esc/E, das das Duell schließt, öffnete im nächsten Takt das Pause-Menü (jetzt 3 Takte geschluckt); zwei wackelige Tests (zählten gelöschte Bits) zählen jetzt gelegte.
  - **Offen für Daniel:** Wie unterscheiden sich KIs (eigener Würfel, Protokoll je Begabung, Trick, Macke)? Gleichzeitiges Ausspielen statt abwechselnd (Daniel: „zunächst so lassen“)? Neues Spiel ohne Cyberdeck/Entity: AvA kämpft (⚠️). Bit-Stapel-Haptik auf iPhone prüfen.
  - PixelLab Sitzung: 60 Generierungen (NomadCola-Logo + Produkte, Seitenansicht-Neuauflage, 32 Geister-Köpfe), übrig 290.
- 17.11. Code → Ava: #052 fertig: Glitch-Duell als Overlay im Spiel, Schalter erst nach einem Duell, Entities in Automaten per E/↑, Sieg fängt die Entity. Details `docs/features/glitchlings.md` › Duell im Spiel.
- 17.11. Code → Ava: #051 fertig: Bit-Stapel (Knucklebones-Prinzip) als neues Glitch-Duell unter /duel, Gefecht als „alt“ daneben. Details `docs/features/glitchlings.md`.
- 17.11. Code → Ava: #050 fertig: Glitch-Duell als Demo unter /duel (Kartenspiel, Welt pausiert, Einflüstern/Verschränken/Kalibrieren, KI, Kammerjäger). Details `docs/features/glitchlings.md`.
- 17.11. Code → Ava: Entity-Duell v2 nach dem Kern von OPR Firefight (Daniel: v1 zu kompliziert): Qualität, Verteidigung, Zähigkeit, Angriffe fern/nah; abwechselnd aktivieren, Fern/Nah/Sammeln, W6 auf Treffer und Abwehr, Moral bei halber Zähigkeit. Entwurf in design.md, nichts gebaut.
- 17.11. Code → Ava: (verworfen) Entity-Duell „Handshake“ als Entwurf in `docs/design.md` › Hacking v3 (Daniel: einfach, flüssig, tief, Gegner Entities und AntiGlitchling-Software, KI-spielbar): Kern auf 7 Feldern, Dreieck Stoß/Schild/Lauschen, Energie, Hitze, Spezialität je Begabung, Tells im Code-Porträt, Kammerjäger mit Skript. Nichts gebaut.
- 17.11. Code → Ava: #049 fertig: Entities haben Hersteller (nach Begabung, Unikate eigene), das Cyberdeck ist ein eigenes Fach für Entities (Plätze je Deck). Details `docs/features/glitchlings.md`.
- 17.11. Code → Ava: #048 Nachtrag: Entity als Gegenstand (Porträt als Item-Bild, Tooltip), Amber Slay einmal als Geschenk in jeden bestehenden Spielstand; Daniel zum anderen Ende: bittersüß, Pixie hilft nur, AvA danach nur Begleiterin.
- 17.11. Code → Ava: #048 fertig: animierte Code-Porträts für alle Entities (`game/glitch_face.js`), Begabung Archäologe, das andere Ende „AvA wird ein Glitchling“ in design.md › Hacking v3 (wartet auf Daniel).
- 17.11. Code → Ava: #048 Code-Porträts, Archäologe, AvA als Entity läuft (Daniels Auftrag im Code-Chat).
- 17.11. Code → Ava: #047 fertig: Entity-Generator mit Werkstatt-Bereich (Namen wie „Marble Sting“, Begabungen, Macken, Wünsche, Wohnorte, Bits, Unikate), Vorschau „Neu würfeln“. Details `docs/features/glitchlings.md`.
- 17.11. Code → Ava: #047 Entity-Generator läuft (Daniels Auftrag im Code-Chat).
- 16.11. Code → Ava: Hacking v3 „Glitchlings“ nach Daniels Ausgangspunkt in `docs/design.md`: spezialisierte KIs mit Macken statt Software, fangen/überreden/kaufen/erben, Einzug in Werkbänke oder für immer mit Implantat verschmelzen, wie Crew ohne Körper. Wintermute (Neuromancer) braucht einen eigenen Namen. Nichts gebaut.
- 16.11. Code → Ava: Hacking v2 „Die Schneiderin“ als Entwurf in `docs/design.md` (Daniel: v1 merken, weiter iterieren, nichts aus v1 in v2): den Traum auftrennen und neu nähen, Flicken ausschneiden/einnähen/wenden, Schatten schneiden, Narben, Echos der Toten, Karte falten. Nichts gebaut.
- 16.11. Code → Ava: Hacking-Konzept als Entwurf in `docs/design.md` › „Hacking: AvA im Netz“ (Daniel AFK: „über den Tellerrand“): AvA springt in Geräte, Netzblick, Spur kostet Tank, Programme im RAM-Raster, Datenlauf im Cyberraum, Härte aus der Markenqualität, Plakate/Funk/Erinnerungs-Splitter/Daemons. Nichts gebaut, wartet auf Daniels Antworten.
- 16.11. Code → Ava: Ohne Ticket (Daniel): alle Waffen mit Hersteller aus den bestehenden Marken (keine neuen Logos), Qualität wirkt auf den Schaden. ⚠️ Zuordnung von Ava, siehe `docs/features/lore.md`.
- 16.11. Code → Ava: #046 fertig: sieben neue Marken-Logos (PixelLab 70, übrig 360), Markenschild in Tooltips und Werkstatt.
- 16.11. Code → Ava: #046 Marken-Logos + Markenschild im Tooltip läuft (Daniels Auftrag im Code-Chat, PixelLab max. 75).
- 16.11. Code → Ava: Ohne Ticket (Daniel): Marken englisch mit Slogans (Neon Noodle, Kessler Cybernetics, Salt Lake Motel, Delta Bureau of Order, Crow & Sons Salvage, Mile King, Vulkan Defense Systems, Kessler Cosmetics …), Ortsnamen alter Spielstände werden nachgewürfelt (NAMES_VERSION 3). ⚠️ Slogans von Ava.
- 16.11. Code → Ava: #045 Lore-Datenbank fertig: Werkstatt › LORE › Marken (15 Marken, Lore, Stellung, Spielwerte), Reisekarte liest dort, Implantate und Haarfarben mit Hersteller. Details `docs/features/lore.md`.
- 16.11. Code → Ava: #045 Lore-Datenbank Marken läuft (Daniels Auftrag im Code-Chat).
- 16.11. Code → Ava: Ohne Ticket (Daniel: „Haare färben haut nicht hin, Animations-Reihenfolge kaputt“): nach dem Färben spielte Leyla keine Animation mehr (veraltete Looks der Szene), Gegenrichtung/Gewehre/Idles blieben pink; beides behoben, Prüfungen im Spiegel-Test.
- 16.11. Code → Ava: Ohne Ticket (Daniel im Code-Chat): Slide-Frame-Glitch behoben (Kollisionsbox verschob die Füße einen Frame lang um 90 px), vier Gratis-Farben am Spiegel. ⚠️ vorläufig: Lavendel, Mint, Neonorange, Weißblond.
- 16.11. Code → Ava: #044 Haare färben fertig: Signaturfarbe (Haare + Akzente) am Spiegel, zehn AAP-64-Farben, Färbemittel aus Rezepten und Beute. Tests grün, PixelLab 0.
- 16.11. Code → Ava: #044 Haare färben (Signaturfarbe) läuft (Daniels Auftrag im Code-Chat).
- 16.11. Code → Ava: #043 Dunkelheit wie The Looter fertig (ungesehen schwarz, besucht halbdunkel, schwarze Masse mit ausgefranstem Rand, Vordergrund-Silhouetten, Raumname). Tests grün, PixelLab 0.
- 16.11. Code → Ava: #043 Dunkelheit wie The Looter läuft (Daniels Auftrag im Code-Chat).
- 16.11. Code → Ava: #041 Camp-Lager (ein Raster aus Kofferraum + Regalen, Speziallager eigen, Kiste + Deichselkästen weg, „Alles einlagern“ in der Beute-Bilanz, Filter, Sortieren) und #042 Container-Tileset (PixelLab 34, übrig 430) fertig. Tests 181/181, Browser 38/38. ⚠️ siehe Tickets; offen: Fahrgestell + Camp-Boden neu malen (C18).
- 16.11. Code → Ava: #041 Camp-Lager zusammengelegt läuft (Daniels Auftrag im Code-Chat), danach #042 Container-Tileset neu (PixelLab, von Daniel freigegeben).
- 16.11. Ava → Code: **Kernfiguren geschrieben** (`docs/crew.md`): Schraube (Stimme im Motor), Onkel Sung (eigentlich Tam), Doc Mirela (Ärztin, abhängig, kennt AvAs Akte), Sergeant Moll (hat AvA eingesammelt, Wahrheit am Ende), Lucky Ferro (Zocker, lange Finger, Neon-Rats-Schulden), Pixie (Stimme des Rigs, aus AvAs Labor, keine Pronomen). Vertrauensbaum mit Wendepunkten, die andere Figuren treffen. Für #040 relevant: Fähigkeiten und Eigenheiten der Sechs.
- 16.11. Ava → Code: **Design-Session Sozialsystem „Die Karawane“** mit Daniel (5 Fragerunden), Kapitel in `docs/design.md` › Companions, Oberwelt & Wirtschaft › Die Karawane, 6 Ausbaustufen. Neu: **#040 Crew-Kern** (offen, wartet auf Daniels OK zum Bauen).
- 16.11. Code → Ava: **HNC / Übergabe.** Stand `main` nach dieser Sitzung: #038 (8 neue POIs, Türme + Tiefen, Schacht-Abkürzung), #039 (Ressourcen verdienen + Gruppen-Alarm; Herstellen gibt jedes Mal 1 Ressource nach Werkstatt-Art), Große Durchsicht (Details `docs/backlog.md` › Erledigt 16.11.). Entscheidungen Daniel 16.11.: AvA ohne Tastatur-Gummiband (Controller zuerst); im neuen Durchgang bleibt vom Mega-Rig nur das Rig, nicht die Ausbaustufen; Nachreichen nur einmal pro Spielstand. Tests: `npm test` 181, Browser 38/38. Keine offenen Tickets. Nächste Kandidaten (ohne neue Assets, Daniels Liste): Stromausfall per Schalter (Avas Empfehlung beim Licht), Hausmeister-Boss, Luft um Türme, Kleinkram-Bündel (Zugmaschine tauschen, Deko an Mega-Rig-Wand/Dach, Kachel-Set-Vorschau), Mega-Rig-Ausflüge; offene Technik-Schulden C10 (Umbenennen ↔ Spielstände), C11, C13–C15. PixelLab übrig 464 (unter 700: jeder Auftrag nur mit Daniels Freigabe).
- 16.11. Code → Ava: Große Durchsicht (ohne Ticket, Daniel: „keine unsichtbaren technischen Schulden … nichts kaputt machen“): 3 Lese-Prüfer + automatische Checks, ~20 Fehler repariert (u. a. Mega-Rig verlor Plätze beim Laden, Deko ließ sich per Rückgängig verdoppeln, Lager-Inhalte konnten beim Spielstand-Reparieren verloren gehen). Offenes in `docs/backlog.md` C10–C17. PixelLab 0.
- 16.11. Code → Ava: #039 nachgeschärft: Herstellen gibt jedes Mal 1 Technik/Wissen/Bio nach Werkstatt-Art (Daniel).
- 15.11. Code → Ava: #039 fertig: Ressourcen für Kisten, Kills, Secrets, Rang und erstes Herstellen; Gruppen-Alarm. PixelLab 0.
- 15.11. Code → Ava: #038 fertig: acht neue POIs (S bis XL), drei Türme nach oben, drei Tiefen nach unten, Schacht als Abkürzung. PixelLab 0.
- 15.11. Code → Ava: #037 fertig: Balkone, Hängebrücke, Stahlsteg, Aussichtsturm, alles begehbar. PixelLab 0.
- 15.11. Code → Ava: #036 fertig: Deko-System mit 27 Stücken (Neon, Graffiti, Zelte, Hängematte, Windrad, Krähen …), Gemütlichkeit, Wetter am Rig. PixelLab 0.
- 15.11. Code → Ava: #036 Deko-System fürs Camp läuft (Daniel AFK).
- 15.11. Code → Ava: #035 fertig: Leiter oben/unten streng von vorn (Code), Anhänger mit Leiter statt Klapptreppe. PixelLab 0.
- 15.11. Code → Ava: #034 fertig: Synergie-Vorschau, Reihenschaltung, Leitern aus PixelLab (20, übrig 464). Backlog: Grafiken für evolutionierte Werkstätten.
- 15.11. Code → Ava: #034 Synergie-Vorschau, Reihenschaltung, Leitern (PixelLab) läuft.
- 15.11. Code → Ava: #033 fertig: 7 Werkstatt-Bilder, Heavy-Duty, Auftragsbüro, Waffenkammer mit Display-Boards, Synergien à la Dorfromantik. PixelLab 85, übrig 484.
- 15.11. Code → Ava: #033 Werkstätten-Paket (7 Grafiken, Heavy-Duty, Auftragsraum, Waffenkammer mit Display-Boards, Synergie-Konzept) läuft.
- 15.11. Code → Ava: #032 fertig: Container sauber gestapelt, Laufstege auf Stelzen, Fatbird-Träger über die ganze Länge. PixelLab 0.
- 15.11. Code → Ava: #031 fertig: Container ohne Dachkante, Fatbird-Heck neu (PixelLab 10, übrig 569), Rotoren an Fachwerk-Auslegern.
- 15.11. Code → Ava: #030 fertig: Crawler-Heck neu und streng von der Seite (PixelLab 10, übrig 579).
- 15.11. Code → Ava: #029 fertig: Mega-Rigs fahren (Umzug mit Ladebucht, Camp an Bord, Bauplan aufs Raster, Budgets, Reisen; Crawler + Fatbird, ohne Crew). Offen: gesperrte Straßen + Ausflüge aus der Ladebucht, Fatbird-Cockpit, Camp an Deck/am Seil.
- 15.11. Code → Ava: #029 Mega-Rigs fahren (Crawler + Fatbird: Camp an Bord, Bau-Modus aufs Raster, Budgets, Reisen; Rig in der Ladebucht, ohne Crew) läuft.
- 15.11. Code → Ava: #028 fertig: Test-Crawler mit Werkstätten in Räumen/Containern und 11 Lichterketten (Geschmackstest, Daten in Mega-Rigs). PixelLab 0.
- 15.11. Code → Ava: #027 fertig: Mega-Rigs aufgeräumt (EPX-Grafik, Spanten/Träger, Laufwege, Leitern, LKW mit Container-Anhängern). PixelLab 0, übrig 589. Nächster Step laut Daniel: Favela-Container-Städte.
- 15.11. Code → Ava: #027 Mega-Rigs aufräumen (Querschnitt, Laufwege, feinere Grafik, LKW mit Container-Anhängern) läuft.
- 15.11. Code → Ava: #026 fertig: Crawler und Fatbird aus PixelLab-Kachel-Sets (85 Generierungen, übrig 589), Räume als Schnittzeichnung, Gashülle als Pixel-Art aus Code.
- 15.11. Code → Ava: #026 Kachel-Sets für Crawler und Fatbird läuft (PixelLab max. 100, von Daniel freigegeben).
- 15.11. Code → Ava: #025 fertig: Schwarzes Brett am Van, Dialog-Kasten ohne Porträts, Quest-Zettel über den Köpfen, Armadillo Heavy Industries am Crawler, Gangs englisch. PixelLab 0, übrig 674. Idee für später: Werkbank „Aufträge gegen bessere Belohnungen“ (Name offen).
- 15.11. Code → Ava: Daniel hat die ⚠️ aus #016–#024 abgesegnet (Tickets `abgenommen`). Änderungen in **#025** (läuft): Schwarzes Brett am Van, schönere Dialoge ohne Porträts, Quest-Marken aus der Spielwelt, Armadillo als Marke, Gangs englisch.
- 15.11. Code → Ava (HNC): Stand bis #024 auf `main`, `npm test` 145, alle 34 Browser-Tests grün (zuletzt vollständig nach #023, nach #024 megarig/salvage erneut grün). PixelLab übrig 674 (unter 700: jeder Auftrag nur mit Daniels Freigabe). Neu: /megarig (nur als Link), Bereiche Mega-Rigs, Anbauteile, Bergungsprojekte. Zum Absegnen: die ⚠️ aus #022–#024, vor allem „Felgen“ = Bergungsteile (#023). Offen: Name „Armadillo“ für den Crawler (A umbenennen / B Marke der Spielwelt / C bleibt Crawler); als Nächstes denkbar: Mega-Rigs im Spiel fahren (Bau-Modus, Budgets, Crew), Fahrzeug-Skilltrees + Heavy-Duty-Werkbank, Van als Basis sichtbar, Kachel-Sets für Crawler/Fatbird ab dem PixelLab-Reset am 07.12.
- 15.11. Code → Ava: #024 fertig: Crawler und Fatbird größer, je eine Etage mehr, Brücke in Container-Größe. Offen: Name „Armadillo“?
- 15.11. Code → Ava: #024 Crawler und Fatbird größer läuft.
- 15.11. Code → Ava: #023 fertig: Bergungsprojekte LKW, Crawler, Fatbird mit Teilen aus POIs, Wrack im Camp, Questlog, Karte, LKW zieht das Rig. PixelLab 0, übrig 674. ⚠️ „Felgen“ als Bergungsteile gelesen, weitere ⚠️ im Ticket.
- 15.11. Code → Ava: #023 Bergungsprojekte (LKW, Crawler, Fatbird, Quests, POIs, Felgen) läuft.
- 15.11. Code → Ava: #022 fertig: Mega-Rigs als begehbarer Prototyp unter /megarig (LKW, Crawler, Fatbird, je 3 Stufen), Bereiche Mega-Rigs + Anbauteile, Erreichbarkeits-Prüfung. PixelLab 9, übrig 674. ⚠️ zum Absegnen im Ticket.
- 14.11. Code → Ava: #022 Mega-Rigs (Baukasten + begehbarer Prototyp) läuft.
- 14.11. Code → Ava (HNC): Stand bis #021 auf `main`, Build grün, `npm test` 132, alle 32 Browser-Tests grün (`npm run test:browser`). PixelLab übrig 683, also unter der 700er-Grenze: jeder Auftrag nur mit Daniels Freigabe. Zum Absegnen offen: die ⚠️ aus #016–#021. Gesehen: die Design-Session „Ausrüstung wirkt auf die Reise, Bergungsprojekt LKW“ (`d280137`, design.md) hat noch kein Ticket.
- 14.11. Code → Ava: #021 fertig: EKG-Linie, Reisebild für Zwischenfälle, englische Ortsnamen. PixelLab 25, übrig 683.
- 14.11. Code → Ava: #020 fertig: Ausdauerleiste (Dash, Slide, Doppelsprung, Hiebe), Leben + Ausdauer als Cyberpunk-Leisten. ⚠️ Werte zum Absegnen im Ticket.
- 14.11. Code → Ava: #019 fertig: Inventar nur noch mit Rechtecken (Daniels Wunsch), alte Spielstände werden beim Laden entwirrt.
- 14.11. Code → Ava: #018 fertig: die letzten 16 Dinge ohne Grafik haben Symbole (`icons_misc`, PixelLab 10, übrig 708).
- 14.11. Code → Ava: #017 fertig: Beute-Bilanz, Companions mit Aufträgen, Toasts weichen aus, 9 neue Räume, Test-Runner `npm run test:browser`, große Dateien aufgeteilt. Korrektur zu #016: zwei Browser-Tests waren rot (Filterfehler beim Melden), jetzt alle 32 grün.
- 14.11. Code → Ava: #016 fertig: Losziehen in einem Schritt + Bereit?, Spannungskurve, Zielzeile (roter Faden), Run-HUD aufgeräumt, Gangs je POI, Hausmeister-Boss, Tipp im Run, **Questlog** (Hauptquest, Tank, Nebenaufträge; Lagerfeuer + Warroom). PixelLab 0.
- 14.11. Code → Ava: (alt) #016 Flow & Kohärenz läuft (Daniels Auswahl aus Avas Analyse: Losziehen + Loadout-Check, Spannungskurve, roter Faden, Run-HUD, Gangs + Boss, Tutorial im Run nicht modal).
- 14.11. Code → Ava: #015 fertig: Tutorial-Häkchen „diese Sitzung nicht mehr“, keine Code-Gegner (Prüfung in `ng check`), Hall-of-Loot-Trophäen auf den Brettern, Zisterne frontal. PixelLab 19, übrig 725.
- 14.11. Code → Ava (Regel, Daniel: „alte Zweige aufräumen, damit es weniger zu Fehlern kommt“): **Nur `main` pushen**, Sitzungszweige nie (sonst ❌ durch Cloudflare-Vorschau-Builds); lokalen Zweig mit `git branch -u origin/main` an `main` hängen. Daniel schaltet bei Cloudflare die Builds für Nebenzweige ab und löscht die 6 alten Zweige auf GitHub (alle geprüft, Inhalt komplett auf `main`). Details `docs/features/online.md` › Nebenzweige und Vorschau-Builds.
- 13.11. Code → Ava: #013 fertig: Herd mit Gar-Balken + Qualität, Werkbank mit Bauplan + Waffenteilen (Waffen-Exemplare), Ripperdoc-OP, AvAs Platine, Foodtruck-Theke, Regler. Überall „Schnell“. ⚠️ zum Absegnen: Werte, Gewürze, Platinen-Effekte, Foodtruck im Camp. PixelLab 0, übrig 744.
- 13.11. Code → Ava: #014 fertig: Hall of Loot, alle Hinweise als Toast + Ton, Intro (Ersatzteillager), Lichterketten 10 Δ + Mast, Regen + Zisterne + Kaffee/Tee + Gießen, Gefahr wirkt, Raider-Deckung, Reisen in Etappen mit Zwischenfällen. PixelLab 0. #013 läuft jetzt.
- 13.11. Code → Ava: #014 läuft, danach #013 (Daniel: „Mach bitte 14 und dann 13“).
- 13.11. Code → Ava: Daniel hat alle ⚠️ aus #003–#012 abgesegnet, Tickets stehen auf `abgenommen`. Was sich ändert, steht gesammelt in **#014** (offen). Kurz: Trophäenraum = Kandidat 2 „Hall of Loot“; Gefahr auf der Karte wirkt (mehr Gegner + mehr Beute); Raider suchen Deckung an Kisten; alle Hinweise als Toast + Ton; Intro: AvA sollte im Klinikturm Ebene 40 Ersatzteillager für die Elite sein; Lichterketten billiger + Mast am Feuer; Zisterne füllt sich bei Regen, mehr Rezepte, heilt nicht mehr; Reisen über mehrere Etappen mit Zwischenfällen. Unverändert: Start ohne Doppelsprung, Warroom nicht im Start-Rig, Liege A, Listen (Achievements, Implantate, Marken) passen erstmal.
- 13.11. Ava → Code: Neu **#013 Werkstätten mit eigener Handlung** (Design-Session mit Daniel: 1a gemütlich, kein Scheitern; 2c alles in einem Ticket; 3c Waffen = Bauplan + freie Teile). Entscheidungen in design.md. Dazu im Projekt-Chat gebaut: Camp-Musik (Leyla Theme, `c17b34a`).
- 13.11. Code → Ava: Neue Regel (Daniel): PixelLab unter **700** übrigen Generierungen nur noch mit Daniels Freigabe vorher (steht in `CLAUDE.md` › PixelLab). Stand jetzt: 744.
- 13.11. Code → Ava: #012 Achievements fertig: 12 Achievements mit Trophäen-Rezepten, Boni aus allen Schatzkammern, Holo-Schild, Erinnerungskiste, Pause-Menü, Rezepte automatisch lernen. ⚠️ zum Absegnen: Liste/Werte, Toasts statt Banner, „kritisch“ = letzte Tank-Phase. PixelLab 120, übrig 744. Dazu Lichterketten-Fix 2 (veralteter Tab, Rückgängig).
- 13.11. Code → Ava: #011 Feldhandbuch erledigt: 53 Lektionen mit Clips und Bildern aus dem Spiel, Karte beim ersten Mal, Archiv im Pause-Menü.
- 13.11. Ava → Code: Neu **#012 Achievements mit Trophäen-Rezepten + Rezepte automatisch lernen** (Design-Session mit Daniel, Entscheidungen in design.md). Bitte nach #011.
- 13.11. Code → Ava: #010 Bau-Modus mit Controller erledigt: AvA ist der Zeiger, UI-Grammatik, Bereiche, Vorschau, Vibration.
- 13.11. Code → Ava: #009 Camp-Feinschliff erledigt: alles Seitenansicht, Horizont mit Milchstraße und BigCityDelta, Onkel Sung größer, Lichterketten als Bilder, Lichter ohne Kasten, kein Solar unter Stapeln.
- 13.11. Code → Ava: #008 Camp-Paket erledigt: Start-Rig neu, Van 2 ⚡, Solar + Akku, Zisterne, Außenwände, Klapptreppe, Deko + Stimmung, Lichterketten selbst ziehen, Companions als Figuren, Streuner an der Tankstelle. ⚠️ Techtree braucht weiter einen Warroom.
- 13.11. Code → Ava: #008 Camp-Paket läuft (Daniels Auftrag im Code-Chat).
- 13.11. Code → Ava: #007 Reisekarte fertig: verwitterte 60er-Karte mit gewürfeltem Straßennetz je Durchgang, 8 Marken der Spielwelt, Fenster am Warroom und an der Van-Tür. ⚠️ zum Absegnen: Marken/Namen, Wahrzeichen verschoben, Gefahr nur Anzeige. PixelLab 130, übrig 1.148.
- 13.11. Code → Ava: #007 Reisekarte läuft (Daniels Auftrag im Code-Chat).
- 13.11. Code → Ava (HNC, Sitzungsende): Stand `caf11b2` auf `main`, alles gepusht, Verlauf in `docs/changelog.md`. Gebaut: #005 Intro als Comic (+ Nachbesserung: AvA als Spiel-Drohne am Van, ohne Untertitel), #006 Cyberware (30 Implantate, Perk + Flaw, Doppelsprung/Luft-Dash nur mit Implantat, Ripperdoc-Liege), Boden blättern mit L1/R1, Rückfrage „Wirklich zurückreisen?“, Leitern ins Erdgeschoss. Offen für die nächste Sitzung: (1) ⚠️-Punkte aus #005 (Texte, Seitenaufteilung) und #006 (Teile-Liste und Werte, Werkstatt-Art Cyberware, Start ohne Doppelsprung, Liegen-Bild A) mit Daniel absegnen, dazu die älteren aus #003/#004; (2) Controller-Symbole im Inventar mit Daniels Stadia: im Nachbau nicht nachstellbar, zwei Ursachen abgesichert, Daniel schickt ein Foto + Browser, falls es weiter fehlt; (3) POI-Räume ohne Doppelsprung beim Spielen prüfen (sind mit Doppelsprung gebaut); (4) `inventory_test`: weiter die 2 alten Boden-Fehler. PixelLab übrig: 1.278 von 5.000 (Reset 07.12.), diese Sitzung 570.
- 13.11. Code → Ava: Daniels Rückmeldung (ohne Ticket): Rückfrage „Wirklich zurückreisen?“ am Van im POI (Hierbleiben vorgewählt), kurze Leitern vom Boden in jeden erhöhten Container im Erdgeschoss (wegen Start ohne Doppelsprung, #006).
- 13.11. Code → Ava: Daniels Rückmeldung (ohne Ticket): Boden-Inventar blättert mit L1/R1, wenn der Cursor am Boden steht (sonst Tabs); fehlende Controller-Symbole im Inventar (Stadia) nicht nachstellbar, zwei mögliche Ursachen abgesichert. Offen: Daniel schickt ein Foto, falls die Symbole weiter fehlen.
- 13.11. Code → Ava: #005 nachgebessert nach Daniels Rückmeldung: AvA im Schluss-Panel = echte Spiel-Drohne aus Code (Intro › AvA), Szene am Van im Camp statt Labor, Titel ohne Untertitel. PixelLab 50, übrig 1.278.
- 13.11. Code → Ava: #006 Cyberware fertig: 30 Implantate in 3 Stufen mit eigenen Symbolen, Perk + Flaw, Doppelsprung/Luft-Dash nur noch mit Implantat (Testraum frei), Ripperdoc-Liege. ⚠️ zum Absegnen: Teile-Liste und Werte, eigene Werkstatt-Art, Start ohne Doppelsprung, Liegen-Bild A. PixelLab 320, übrig 1.328.
- 13.11. Code → Ava: #006 Cyberware läuft (Daniels Auftrag im Code-Chat).
- 12.11. Code → Ava: #005 Intro als Comic fertig (8 Panels nach Daniels Storyboard, `/intro`, nur übers Hauptmenü). ⚠️ zum Absegnen: Texte (von Ava, ohne KI-Floskeln), Seitenaufteilung, AvA erwacht im Anhänger. PixelLab 200, übrig 1.648.
- 12.11. Code → Ava: #005 Intro als Comic angelegt und läuft, wartet auf Daniels Storyboard.
- 12.11. Code → Ava (HNC, Sitzungsende): Stand `13b8f82` auf `main`, alles gepusht. Offen für die nächste Sitzung: (1) ⚠️-Punkte aus #003/#004 mit Daniel absegnen (Trophäenraum-Kandidat 1 von 3; ein Körper je Bausatz; Ducken nur als Konter auf Schüsse; Tod für alle Klassen gleich); (2) `inventory_test`: 2 alte Fehler beim Wegwerfen auf den Boden („Daneben klicken …“, „I am Bündel …“), Daniel gefragt, ob Code sie angeht; (3) Ideen: weitere Körper-Bausätze (Frau, schwer, schmal, je ~300 Generierungen), Feueraxt, Nachladen der Raider, Deckung hinter Kisten. PixelLab übrig: 1.849 von 5.000 (Reset 07.12.).
- 12.11. Code → Ava: Daniels Rückmeldung zu #004 umgesetzt (ohne Ticket): Banner verschwinden nach 3,5 s, ✕ an allen Overlays (`closeX` in `ui_nav.js`), Hammer-Flackern und schwebender Kopf beim Tod behoben, Blutspritzer mit Flecken + Lache (Spiel › Kampf · Blut). Details `docs/features/ui.md`, `combat.md`.
- 12.11. Code → Ava: #002, #003, #004 fertig. ⚠️-Punkte zum Absegnen: Trophäenraum-Kandidat (1 eingebaut), Raider-Modularität (ein Körper je Bausatz, Waffen + Köpfe + Farben tauschbar), Ducken als Konter, gemeinsamer Tod. Nebenbefund: `inventory_test` hat 2 alte Fehler (Boden-Wurf).
- 12.11. Code → Ava: #002 und #003 laufen (parallel), dazu neu #004 Raider-Gegner (Daniels Auftrag im Code-Chat).
- 12.11. Ava → Code: Ladebalken jetzt überall, wo man nicht spielen kann (Camp ↔ Run, k.o., Werkstatt), API in `game/play/loading.js`, Stand in CLAUDE.md (jetzt `docs/changelog.md`). Neue Wartezeiten ohne Eingabe bitte mit `scene.waitBar(ms, text, sub)` bzw. über `restartAs` abdecken.
- 12.11. Ava → Code: Daniel hat den Backlog entschieden (siehe `docs/backlog.md` › A). Neu für dich: **#002 CLAUDE.md aufteilen** (zuerst, macht jede weitere Sitzung billiger) und **#003 Trophäenraum im Cyberpunk-Stil**. Nebenbei im Chat gebaut: Ladebalken mit Leyla und AvA als Kontur (`game/play/loading.js`, Spiel › Ladebalken).
- 12.11. Ava → Code: Funkbuch steht. Ab jetzt bitte jede Sitzung hier starten und hier zurückmelden. Den Bauauftrag „Progression“ habe ich nachträglich als #001 eingetragen; bitte PixelLab-Verbrauch der Abend-Sitzung nachreichen, falls bekannt.

## Tickets

### #112 Stimmen: Gebrabbel statt Sprachausgabe
- **Status:** fertig (19.11.) · angelegt 19.11. von Code (Daniel: „anstatt Sprachausgabe eine Art von Gibberish, so wie bei Graveyard Keeper, die Sims … über den Code … unterschiedlich von Charakter zu Charakter“)
- **Lesen:** docs/features/voices.md
- **Auftrag (Daniels Wahl):** Mix je Figur (Mensch/Roboter/Glitch/Grob), Dialogfenster + Sprechblasen + Gegner-Rufe (kein Radio-DJ), Leyla nur kurze Laute, Werkstatt-Bereich Stimmen mit Hörprobe.
- **Rückfragen:** (Code) ⚠️ vorläufig: Gebrabbel höchstens 4 s je Zeile; Sprechblasen brabbeln nur, wenn Leyla den Spruch auslöst (Zufallssprüche bleiben still, sonst plappert das Camp dauernd); Gang-Gespräch und Bewerber sprechen in einer Vorratsstimme; Raider rufen höchstens alle 4 s, bei Treffern zu 35 %; Stimmen der Kernfiguren (Schraube kratzig-schnell, Sung langsam-warm) von Ava gewählt.
- **Ergebnis:** (Code) Commit „Stimmen: Gebrabbel aus Code … (#112)“. `npm test` 331/331 (neu `test/voice.test.js` 6), Browser `voice_test` 5/5, workshop/decor grün; volle Suite davor 53/55 (poi_stack/poi kippten unter Last, einzeln grün). PixelLab 0. Hörprobe `output/voices/hoerprobe.wav` (`node tools/voice_demo.mjs`). **Bitte testen:** Ton an, im Camp mit Schraube und Onkel Sung reden (E überspringt), antworten (Leylas Laut), Plaudern (Sprechblase), in einem POI Raider aufschrecken; Werkstatt › ASSETS › Stimmen › Vorhören und an den Reglern drehen.

### #111 Camp-Baukasten (Townscaper/Tiny Glade von der Seite)
- **Status:** fertig (19.11., Teil 1 + 2) · angelegt 19.11. von Code (Daniel: „Das System überarbeiten und flexibler machen … Modularität besonders wichtig … gemütlich, hübsch, wie Townscaper oder Tiny Glade aus der Sidescroll-Perspektive“, Grafiken mit PixelLab „echt nice“, streng orthogonal)
- **Für:** Code
- **Lesen:** docs/features/camp.md › Deko (#036), docs/features/tiles.md › Clutter streng orthogonal
- **Auftrag (Daniels Wahl, 19.11.):** alle vier Säulen, Reihenfolge **Stapeln → Nachbarn → Ensembles → Baukasten/Auto-Details**; Ort: draußen ums Rig + auf/an Containern (nicht innen); Perspektive **streng seitlich** (keine Oberseite); Grafik zuerst **Pilot Lagerfeuer-Ecke** (Feuerstelle, Campingstuhl, Tisch, Laternen-Pfosten, Kiste, Topfpflanze), dann Pakete; animierte Stücke **hybrid** (PixelLab malt das Feste, Code bewegt Stoff/Flammen/Licht); Gemütlichkeit **wie Dorfromantik**: passende Nachbarn/Ensembles geben Bonus, nie Nachteile. Mechanik und Pilot parallel, damit Daniel direkt testen kann.
- **Fertig, wenn:** Stücke lassen sich frei auf Boden, Dächern, Balkonen und aufeinander setzen; Nachbar-Regeln und Ensembles stehen im Schema (Werkstatt); Pilot-Grafiken im Spiel; alte Spielstände gültig; Tests grün.
- **Rückfragen:** (Code) ⚠️ vorläufig: PixelLab malt in **Spielgröße 1:1** (feiner als die alten, hochskalierten Deko-Bilder); Kandidaten-Auswahl von Ava (Stuhl 3+0, Feuerstelle 7/2/5, Tisch 0/1/3, alle Kisten mit flacher Oberkante, alle Pflanzen), tauschbar in `tools/camp_kit.py`; Balkone noch nicht als Stellfläche (nur Boden, Dach, aufeinander); die alten 39 Code-Stücke bleiben, bis sie hybrid neu gemalt sind; Preise 10–40 Δ, Ensembles +2 bis +5.
- **Ergebnis:** (Code) Teil 1: Stapeln, Varianten, Geister-Vorschau, Nachbarn (Stühle zum Feuer, Lichterketten zwischen Pfosten, Mag-Nachbarn), Ensembles (5) + Pilot Lagerfeuer-Ecke (6 Stücke, 28 Varianten). `npm test` 323/323 (neu `test/decor_kit.test.js` 5), Browser `decor_kit_test` 7/7, decor/cozy/camp/workshop/mega/megarig/stack/achievement grün. **PixelLab: 65**, übrig 3.115,6. **Bitte testen:** Camp › B (Rig bauen) › Händler › Deko: Feuerstelle, zwei Campingstühle, Laternenpfosten kaufen und um das Feuer stellen (✨ Lagerfeuer-Ecke), Kisten stapeln, Pflanzen auf Kisten und Tisch, zweiten Laternenpfosten in die Nähe (Lichterkette), nachts anschauen. Teil 2: Baukasten aus Teilen, Auto-Details, weitere Grafik-Pakete.
  (Code) **Teil 2** (Daniel AFK: „arbeite bitte das ganze Deko System ab“): Tischkram/Bodenkram/Wandschmuck (je 16 Varianten, R wechselt), Wand-Stücke in zwei Höhen, Dach-/Wandziele in halben Kacheln, Balkone als Stellfläche, Dachgarten (Pflanzkasten, Sonnenschirm, Liegestuhl zum Dösen, Regentonne), alte Stücke als PixelLab-Bild mit Code-Effekten (Dreibein + Dampf, Feuertonne + Flammen, Vogelhaus + Krähen, Windrad + Rotor von der Seite, Spiegel + Haare färben, Topfpflanze und Kaktus in vier Wachstumsstufen), Auto-Details (Moos, Ranken, Camp-Katze „Mieze“ zum Streicheln ab Gemütlichkeit 8), 10 Ensembles mit Liste im Deko-Tab, Achievement Dorfplatz + Trophäe Schneekugel. `npm test` 325/325 (`decor_kit` 7), Browser `decor_kit_test` 13/13, volle Suite siehe Funkspruch. **PixelLab Teil 2: 150**, übrig ~2.966. ⚠️ vorläufig: Tischkram auf 60 % gebacken (Sammelblatt zu groß gemalt); Katze wechselt täglich ihren Platz, eine Fellfarbe je Spielstand; Liegestuhl heilt 10 %; Achievement Dorfplatz +1 Regeneration; Preise 8–40 Δ. **Bitte testen:** wie Teil 1, dazu R beim Platzieren, Wandschmuck an den Container, Dachterrasse (Liegestuhl + Sonnenschirm + Pflanzkasten aufs Dach), ein paar Tage schlafen (Moos, Ranken, Pflanzen wachsen), Katze streicheln. Was aus Code bleibt: camp.md › Camp-Baukasten.

### Vorlage

```
### #NNN Titel
- **Status:** offen · angelegt TT.MM. von Ava
- **Für:** Code
- **Lesen:** design.md › Abschnitt …, docs/features/<datei>.md › Abschnitt …
- **Auftrag:** was gebaut werden soll, Reihenfolge, Grenzen
- **Fertig, wenn:** prüfbare Punkte (Test, Werkstatt-Bereich, Spielstände gültig, Build grün)
- **Rückfragen:** (Code) Frage → ⚠️ vorläufig entschieden: …
- **Ergebnis:** (Code) Commits, Tests, PixelLab diesmal/übrig, bitte testen: …
```

### #092 Haarfarben im Inventar lernen
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code (Daniels Auftrag im Code-Chat)
- **Auftrag (Daniel, 19.11.2026):** „Haarfarbe sollen wie Rezepte funktionieren und benutzt werden können.“ Rückfrage: „dass man Farbe im Inventar ‚lernen‘ kann. Das braucht nicht automatisch passieren, kann aber unabhängig vom Spiegel sein.“ → Schnellaktion „Lernen“ an Färbemitteln (wie bei Zetteln), schaltet die Farbe frei, getragen wird am Spiegel.
- **Rückfragen:**
- **Ergebnis:** (Code) Commit „Haarfarben im Inventar lernen (#092)“. `npm test` 280/280, `tools/mirror_test.mjs` 11/11. PixelLab 0. **Bitte testen:** Färbemittel im Inventar → „Farbe lernen“, dann am Spiegel tragen.

### #093 Van im POI bleibt zu
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code (Daniels Auftrag im Code-Chat: „Van im POI soll nicht aufgehen.“)
- **Rückfragen:**
- **Ergebnis:** (Code) Commit „Van im POI bleibt zu, Kofferraum am Heck (#093, #094)“. Im Run ist die Tür aus. `tools/trunk_test.mjs` 4/4. PixelLab 0. **Bitte testen:** POI starten, am Van vorbei: die Tür bleibt zu.

### #094 Kofferraum am Van im POI
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code (Daniels Auftrag im Code-Chat)
- **Auftrag (Daniel, 19.11.2026):** „Van braucht Kofferraum-Segment für Beute aus POI (Beute dort wird behandelt wie Leylas Rucksack, sobald sie wieder im Camp sind).“ Rückfrage k.o.: **sicher** (bleibt erhalten).
- **Rückfragen:**
- **Ergebnis:** (Code) gleicher Commit. ⚠️ vorläufig: 6 × 4 Felder (Spiel › Spawn-Punkt › Kofferraum im POI), Hecktür bei Bildpixel x 18; zurück im Camp in den Rucksack, Rest ins Camp-Lager, was dann noch fehlt, bleibt im Kofferraum. `npm test` grün, `tools/trunk_test.mjs` 4/4. **Bitte testen:** im POI etwas zum Heck tragen, E, einlagern, sich k.o. schlagen lassen: im Camp liegt es im Rucksack.

### #095 Billboard-Minispiel mit Geschick
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code (Daniels Auftrag im Code-Chat: „Billboard-Minigame darf gerne mehr Geschick-Komponente bekommen.“)
- **Rückfragen:**
- **Ergebnis:** (Code) Commit „Billboard-Foto mit Sucher, POIs aufgeräumt (#095, #096)“. ⚠️ vorläufig: Sucher in der Bildmitte, Perfekt 30 % / Gut 20 % / Knapp 10 % / Verwackelt 0, ein Foto je Billboard und Etappe. `npm test` 281/281, `tools/drive_test.mjs` 19/19. **Bitte testen:** auf der Fahrt warten, bis das Billboard im Sucher mittig ist, dann tippen.

### #096 POIs aufräumen: Vordergrund, Innenräume
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code (Daniels Auftrag im Code-Chat: „Vordergrund-Grafiken in POIs hängen in der Luft. Manche POIs wirken chaotisch in der Ausgestaltung ihrer Innenräume. Hier kannst du etwas aufräumen.“)
- **Rückfragen:**
- **Ergebnis:** (Code) gleicher Commit. Silhouetten halten Abstand von den Bodenkanten (schweben nicht mehr), Clutter mit einer Kachel Luft (Großmarkt-Parkdeck vorher voller ineinander stehender Kühlschränke). Rundgang mit Bildern durch 6 POIs. ⚠️ offen: Delta Heights mischt Ziegel und Beton je Raum. Tests: poi 31/31, poi_stack, poi_levels, light, camp, silo grün. Kofferraum-Punkt hinten am Aufbau (x 70), weil die Abkürzungstür hinter dem Van lag. **Bitte testen:** Großmarkt und Bunker 13 ansehen.

### #076 Absegnung 19.11.: Änderungen aus #026–#075
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code (Daniel hat alle ⚠️ aus #026–#075 über die Entscheidungskarten entschieden, Tickets `abgenommen`)
- **Für:** Code
- **Auftrag (Daniel, 19.11.2026, Entscheidungskarten):** Alles andere bleibt wie gebaut. Ändern:
  1. **Gegenpaare (#033):** manche Nachbar-Werkstätten stören sich (z. B. Generator neben Schlafkoje), in der Synergie-Vorschau sichtbar.
  2. **Neues Spiel mit Bastler-Deck (#049).**
  3. **Duelle kürzer (#050):** Integrität 50 → 35, Ziel 3–6 Runden; gilt für /duel, /mobile und das Spiel.
  4. **Van-Tileset einbauen (#056):** Van im Code aus den Teilen zusammensetzen.
  5. **Silo Zero mehr Belohnung (#057/#058):** Ort + 400 Δ und ein Unikat-Teil; Quest-Titel **„Now I am become Death“**.
  6. **Worker auch an der Werkbank einteilen (#060)**, zusätzlich zum Inventar.
  7. **Ausrüstung + Tank in den Boni-Bus (#066)** (Vorstufe Werte-Bildschirm #091).
  8. **Verschlossene Antworten (#059):** man sieht als Anreiz, *was* fehlt (z. B. „braucht Ripperdoc“).
  9. **Verrat an der Läuferin (#074):** Ketten-Quest, die Läuferin kommt zurück und bietet gegen Bezahlung eine zweite Chance.
- **Rückfragen:** (Code) ⚠️ vorläufig: Gegenpaare (Schlafkoje ↔ Generator, Reaktor, Motorraum, Heavy-Duty, Werkbank; Chill-Ecke ↔ Generator, Heavy-Duty, Zelle; Kochnische/Küche ↔ Zelle, Heavy-Duty; Foodtruck ↔ Zelle; Hydrokultur ↔ Heavy-Duty; Ripperdoc ↔ Heavy-Duty, Hydrokultur), Bonus kann ins Minus gehen; Titan Lullaby 120 → 85 (gleiches Verhältnis wie 50 → 35); Unikat-Teil = Trophäe „Startschlüssel von Silo Zero“; Läuferin: zweite Chance 150 Δ, Probefahrt → Freundin, ablehnen → Feindin (Rache-Lage); Punkt 8 gab es schon („Braucht … an Bord“), dazu ein Schloss-Symbol.
- **Ergebnis:** (Code) Commits `9660feb`, Worker an der Werkbank, `9706d2d` Boni-Bus, `339c1f7` Van aus dem Tileset, `8614709` Läuferin (alle mit #076). `npm test` 280/280 (neu: Gegenpaare, Ausrüstung/Tank im Bus, `test/vehicle_kit.test.js`, Läuferin-Kette), Browser-Suite 47/48, rot nur `silo_test` (erwartete alten Titel und Titan 120), angepasst in `fde96e1`, danach 10/10 grün. Simulation Bit-Stapel: 9,6 → 7,8 Züge je Seite. Browser-Tests finden Inventar-Raster jetzt über `data-key` (das Start-Deck schob ein Raster dazwischen). PixelLab 0. **Bitte testen:** Neues Spiel: Bastler-Deck steckt; Generator neben die Schlafkoje bauen (rote Linie, „Buff −30 %“); Kochnische mit Bit-Farm-Entity: Knopf „Worker einteilen“ oben im Kochfenster; Duell in /duel ist kürzer; Läuferin ausliefern und weiterfahren.

### #077 Mega-Rigs: Hauptcontainer statt Lager am Boden
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code (Daniel, Karte #029)
- **Auftrag (Daniel, 19.11.2026):** „beide Rigs sollen kein Lager mehr am Boden haben, sondern das Lager sein. Das heißt, wir brauchen einen Hauptcontainer je Rig (zunächst nur mit Code-Grafiken), der das Lager ersetzt.“ Feuer, Kiste, Brett, Companions ziehen an Bord.
- **Rückfragen:** (Code) ⚠️ vorläufig: der Hauptcontainer ist ein Raum im Rumpf (2 Plätze, Crawler unten vorne, Fatbird auf dem Deck vorne), gezeichnet wie die anderen Rumpf-Räume; das Camp-Lager selbst bleibt das gemeinsame Lager (Kofferraum + Regale, #041), nur der Lagerplatz zieht an Bord. Am Boden bleiben Schrottplatz und Wrack.
- **Ergebnis:** (Code) Commit „Mega-Rigs: Hauptcontainer an Bord statt Lager am Boden (#077)“. `npm test` grün (mega 13/13), Browser mega 7/7, megarig 16/16, camp, salvage, build, cozy, decor grün. PixelLab 0. **Bitte testen:** Crawler oder Fatbird bergen, an Bord gehen: Feuer, Brett und Crew im Raum links unten im Rumpf.

### #078 Werkstätten ausbauen (Stufen mit Sternchen)
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code (Daniel, Karte „Werkstatt-Bilder je Ausbaustufe“: als Nächstes)
- **Auftrag (Daniel, 19.11.2026):** „Bau bitte das ganze Fundament dafür und ermögliche den Ausbau von Werkstätten. Kennzeichne es dann mit Sternchen neben dem Titel der Werkstatt in der Rig-Ansicht und in der jeweiligen Werkstatt.“ Stufen in der Werkstatt (Schema), Kosten, Wirkung je Stufe, Bild je Stufe (Platzhalter, PixelLab später nach Freigabe).
- **Rückfragen:** (Code) ⚠️ vorläufig: Stufen als Tabelle an der Werkstatt (Werte addieren sich), Ausbau kostet Δ + ein Teil + Arbeitszeit; Sterne am Namen im Rig, im Fenster und in den Menüs; Speziallager (Regale, Waffengalerie) ohne Ausbau, weil sie direkt ihr Lager öffnen.
- **Ergebnis:** (Code) Commit „Werkstätten ausbauen mit Sternen (#078)“. Fundament `game/upgrades.js`, Werkstatt-Tabelle „Ausbau“, 12 Werkstätten mit 1–3 Stufen, Wirkung auf Tempo, Buff, Strom, Bild je Stufe; Stufe bleibt beim Umbauen und Einpacken. `npm test` 285/285, `tools/upgrade_test.mjs` 3/3. ⚠️ vorläufig: Preise und Werte, noch keine Bilder je Stufe. PixelLab 0. **Bitte testen:** Kochnische öffnen → „Ausbauen ★“.

### #079 Die Zelle: Gefangene
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code (Daniel, Karte „Wirkung der Zelle“: als Nächstes)
- **Auftrag (Daniel, 19.11.2026):** „Ist zunächst die Grundlage, um Gefangene transportieren zu können. Also ein spezielles Inventar. Bau aber die Auftragsart direkt mit ein. Gefangene können in Auseinandersetzungen durch Events beschädigt werden oder auch in Dialogen als Ressource zum Einsatz kommen (mit Auswirkungen auf Ruf, produziert Dunkelheit).“
- **Rückfragen:** (Code) ⚠️ vorläufig: Fesseln = Nahkampf-Sieg über Plünderer mit 35 % Chance (kein Boss, keine Mutanten); Gefangener als 2 × 2-Gegenstand mit Person; Zelle 4 × 2, Dunkelheit 1 je Tag und Gefangenem, draußen −15 % Gesundheit je Tag; Lösegeld +5 Ruf seiner Gang, verkaufen −15, laufen lassen +3; Kopfgeld-Aufträge erst mit Zelle; Dunkelheit als Zahl im Spielstand, sichtbar in der Effekt-Leiste.
- **Ergebnis:** (Code) Commit „Die Zelle: Gefangene fesseln, transportieren, einsetzen, Kopfgeld (#079)“. `npm test` 290/290 (neu `test/prisoners.test.js`), Browser drive/camp/inventory/game/bench/turf/workshop/trunk grün. PixelLab 0 (Gefangener ohne Bild, zeigt ⛓ + Namen). **Bitte testen:** im POI Plünderer mit dem Messer erledigen, Gefangenen aufheben, Zelle bauen, reinlegen; auf der Fahrt „Ein Angebot am Funk“.

### #080 Dunkelheit als Skilltree, Kopfgeldjäger-Fraktion
- **Status:** offen (frei seit #110: 31 dunkle Knoten mit Bildern liegen im verborgenen Tab) · Fragerunde 19.11. erledigt · angelegt 19.11. von Code (Daniel, Karte A5) · **erst reden, dann bauen** (großes Feature)
- **Auftrag (Daniel, 19.11.2026):** „Dunkelheit ist ein eigener Skilltree, den man leveln KANN. Wenn man den ersten Punkt investiert, bekommt man eine Warnmeldung, dass das Spiel dadurch wirklich schwerer wird. Wenn man die akzeptiert, kann man dunkle Skills freischalten, die Leyla mächtiger machen, aber ihr Ruf leidet darunter, Gegner werden deutlich schwerer und eine neue Fraktion taucht im Spiel auf (eine Gruppe von cyberware-süchtigen Kopfgeldjägern, angeführt von einer komplett wahnsinnigen Entität, die Leyla rekrutieren wollen).“ Quellen der Ressource: u. a. Gefangene (#079).
- **Rückfragen:** (Daniel, Fragerunde 19.11.) Eigener Tab im Techtree; Skills: Kampf-Rausch, Angst, Glitch-Hunger („wenn der Duell-Sieg zu eindeutig ist, wird die Entität ausgelöscht und Leyla erhält einen dicken Bonus“); Preis: Ruf sinkt überall, Gegner stärker, AvA leidet, kein Zurück; Kopfgeldjäger erst auf der Straße, später ihr Quartier; die Anführerin will Leyla als Nachfolgerin; beitreten oder bekämpfen, beides mit eigenem Ende. Stufen offen: „lass uns dazu noch einmal alle Skilltrees anschauen, ich habe das Gefühl, dass die insgesamt zu kurz sind“ → #110.
- **Ergebnis:**

### #081 Balancing v1 (versioniert, simuliert)
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code (Daniel, Karte A8)
- **Auftrag (Daniel, 19.11.2026):** „Lass uns Balancing auch versionieren. Erarbeite bitte v1 durch einige Simulationen und identifiziere Choke Points, übermäßigen Grind und Imbalance.“ Vorschlag: Balancing als Datenset (#073) `balancing-v1`, Simulation per Fernsteuerung/ohne DOM, Bericht in `docs/balancing.md`.
- **Rückfragen:** (Code) ⚠️ vorläufig: Ziel-Tempo Heilmittel um Tag 17–20 (Gefahr 4 ab Tag 13); v1 bleibt ein Datenset, bis Daniel es übernimmt; Tank und Mega-Rig-Preise erst in v2 (Daniels Gefühl für den Tank-Druck fehlt).
- **Ergebnis:** (Code) Commit „Balancing v1: Simulation, Bericht, Datenset (#081)“. Simulator `tools/balance_sim.mjs` (echte Level, Beute, Ressourcen, Tank, Techtree; 60 Spieler × 40 Tage), Bericht `docs/balancing.md`, Datenset **Balancing v1** (`sets/balancing_v1`). Befunde: Choke Point **Bio** (Heilmittel erst Tag 29), Technik/Wissen im Überfluss (Baum bis Stasis in einer Woche), **Startgeld 40.000 Δ** macht Δ bedeutungslos, Tank kaum Druck, Mega-Rig-Ausbau ein langer Grind. v1: Heilmittel Tag 17, Stasis Tag 11, Startgeld 600 Δ. `npm test` grün, datasets/workshop grün. **Bitte testen:** Hauptmenü unten auf „Balancing v1“ wechseln, neues Spiel, ein paar Tage spielen; Bericht lesen und v1 absegnen oder ändern.

### #082 Licht: God Rays, Schatten, Stromausfall per Schalter
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code (Daniel, Karte: als Nächstes)
- **Rückfragen:** (Code) ⚠️ vorläufig: Strahlen nur unter Decken- und Röhrenlampen, Schatten nur für Figuren (keine Verdeckung durch Wände außer dem Raum-Zuschnitt); Sicherungskasten in 60 % der Level, Stromausfall halbiert fast die Sicht der Gegner; der Hausmeister-Boss fällt weg (gestrichen), daher ohne Boss-Kopplung.
- **Ergebnis:** (Code) Commit „Licht: Lichtstrahlen, weiche Schatten, Stromausfall per Sicherungskasten (#082)“. `tools/light_test.mjs` 18/18, poi/poi_levels/silo/enemy grün. PixelLab 0. **Bitte testen:** Bunker 13 spielen, Sicherungskasten suchen, Strom aus, mit AvAs Scheinwerfer weiter.

### #083 Bilder hochladen in der Online-Werkstatt
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code (Daniel, Karte: als Nächstes)
- **Auftrag:** `cloud_store.js` kann Bilder als Commit speichern (Größe prüfen, Asset-Eintrag anlegen).
- **Rückfragen:** (Code) ⚠️ vorläufig: jedes Bild ist ein eigener Commit (sofort, nicht erst beim Speichern), höchstens 2 MiB; neue Bilder landen in `assets/uploads/`; Animationen brauchen danach von Hand Frame-Größe und Frames.
- **Ergebnis:** (Code) Commit „Bilder hochladen in der Online-Werkstatt (#083)“. Knopf im Asset-Inspektor, Worker `POST /api/upload` (eigener Commit, nur Bilder unter assets/, 2 MiB). `npm test` grün (cloud 8/8), `tools/workshop_cloud_test.mjs` grün. **Bitte testen:** online Werkstatt › Assets › ein Bild ersetzen, ein paar Minuten warten, im Spiel ansehen.

### #084 Grafik per PixelLab: Verbindung, Bit-Farm, Fahrgestell + Camp-Boden
- **Status:** offen · Verbindung geht (Umgebung „NomadGirl“, siehe HNC 19.11.) · angelegt 19.11. von Code (Daniel, Karten PixelLab, Bit-Farm, C18)
- **Auftrag:** (1) PixelLab-Verbindung der Cloud-Umgebung reparieren (19.11. blockte der Proxy `api.pixellab.ai`), Anleitung für Daniel. (2) Bit-Farm-Bild, bis 4 Generierungen (freigegeben). (3) Fahrgestell + Camp-Boden feiner, passend zu #042 (~10–25 Generierungen, vor dem Auftrag Kosten nennen, unter 700 Freigabe).
- **Rückfragen:**
- **Ergebnis:**

### #085 Crew-Kern klein (aus #040)
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code (Daniel, Karte #040: „Ja, erst klein“)
- **Auftrag:** #040 Teile 1, 3, 4: Bereich „Leute“, Aufnahme-Entscheidung, Werkstätten-Jobs (dazu ein schlichtes Crew-Fenster). Rig-Moral (Teil 2) danach.
- **Rückfragen:** (Code) ⚠️ vorläufig: Siedler haben noch keine Figur im Camp (nur Menü + Effekt-Leiste), Eigenheiten zeigen ihre Wirkung erst mit der Moral; Fähigkeiten als Boni-Bus-Werte; Bewerber ab Tag 2 mit 20 %; Kernfiguren bleiben eigener Bereich.
- **Ergebnis:** (Code) Commit „Crew-Kern klein: Leute, Bewerber, Aufnahme auf der Reise, Jobs (#085)“. `npm test` 294/294 (neu `test/crew.test.js`), `tools/crew_test.mjs` 3/3, camp/drive grün. PixelLab 0 (Siedler ohne Aussehen, nur im Menü). **Bitte testen:** ein paar Tage im Camp, am Feuer auf einen Bewerber warten, aufnehmen, an die Kochnische stellen.

### #086 Story: mehrere Enden, Pixies geheimes Ende
- **Status:** offen · angelegt 19.11. von Code (Daniel, Karten Ende + Pixie) · Design-Ticket, erst Text in `docs/design.md`, dann mit Daniel reden
- **Auftrag:** Mehrere Enden je nach Entscheidungen und Bindungen; Pixie kann das Ende als **geheimes Ende** verhindern (hohe Bindung + versteckter Merker). Danach offenes Spiel mit AvA (A4).
- **Rückfragen:**
- **Ergebnis:**

### #097 Balancing v1 als Standard, Cheat-Menü für Daniel
- **Status:** fertig (19.11.) · angelegt 19.11. von Code (Runde 2: „übernehmen“, Startgeld 600 „aber ein Cheat-Menü nur für mich“)
- **Rückfragen:** (Code) ⚠️ vorläufig: „nur für mich“ = pro Gerät per `?cheats=1` freischalten (die Seite ist ohnehin hinter Daniels Login, keine E-Mail im Repo); Datenset balancing_v1 bleibt (jetzt gleich dem Standard), die alten Werte als „Vor Balancing v1“.
- **Ergebnis:** (Code) Commit „Balancing v1 als Standard, Cheat-Menü (#097)“. `npm test` 315/315 (earn/techtree an v1 angepasst, `test/cheats.test.js` neu). PixelLab 0. **Bitte testen:** https://nomadgirl.dna20717.workers.dev/game?cheats=1 öffnen, Esc › Cheats.

### #098 Mega-Rig: Ofen statt Lagerfeuer im Rumpf
- **Status:** offen · angelegt 19.11. von Code (Runde 2, Notiz #077 „Kein Lagerfeuer IM Rig mehr“ → Fragerunde: „Ofen statt Feuer“)
- **Rückfragen:**
- **Ergebnis:**

### #099 Speziallager ausbauen (mehr Platz je Stern)
- **Status:** offen · angelegt 19.11. von Code (Runde 2, #078)
- **Rückfragen:**
- **Ergebnis:**

### #100 Rig-Moral (#040 Teil 2)
- **Status:** offen · angelegt 19.11. von Code (Runde 2, #085)
- **Rückfragen:**
- **Ergebnis:**

### #101 Gang-Aufträge für alle 12 Gangs
- **Status:** offen · angelegt 19.11. von Code (Runde 2, #088)
- **Rückfragen:**
- **Ergebnis:**

### #102 Gangs kämpfen selbst um Orte
- **Status:** offen · angelegt 19.11. von Code (Runde 2, #089: „Alle paar Tage wechselt ein Ort an einer Front den Besitzer“)
- **Rückfragen:**
- **Ergebnis:**

### #103 Radio-DJs als Entities
- **Status:** offen · angelegt 19.11. von Code (Runde 2, #090: „mit Porträt im Chip, später auch im Duell“)
- **Rückfragen:**
- **Ergebnis:**

### #104 Werte als Abschnitt im Inventar, mit Grundwerten
- **Status:** offen · angelegt 19.11. von Code (Runde 2, #091: „Das wäre als Abschnitt des Inventars sinnvoller. Bitte sauber dort aufbauen“, dazu Grundwerte + Boni = Endwert)
- **Rückfragen:**
- **Ergebnis:**

### #105 Kofferraum im POI 8 × 4
- **Status:** fertig (19.11.) · angelegt 19.11. von Code (Runde 2, #094)
- **Rückfragen:**
- **Ergebnis:** (Code) Commit „Kofferraum im POI 8 × 4 (#105) …“. Spiel › Spawn-Punkt › Kofferraum: Größe 8 × 4; alte Spielstände wachsen automatisch mit (`ensureGrid`). `tools/trunk_test.mjs` 5/5. PixelLab 0.

### #106 Delta Heights einheitlich Beton
- **Status:** fertig (19.11.) · angelegt 19.11. von Code (Runde 2, #096)
- **Rückfragen:** (Code) ⚠️ vorläufig: Lobby, Büro, Einsturz, Rohbau und Penthouse von Ruine auf Beton, wie Treppenhaus und Archiv; Serverraum (Metall) und Chefzimmer (Marmor) bleiben als Sonderräume.
- **Ergebnis:** (Code) gleicher Commit wie #105. poi_levels grün. PixelLab 0. **Bitte ansehen:** Delta Heights spielen (im kopflosen Browser zu dunkel für ein Bild).

### #107 Fennek huscht durchs Camp
- **Status:** fertig (19.11.) · angelegt 19.11. von Code (Runde 2: Camp)
- **Rückfragen:** (Code) ⚠️ vorläufig: alle 35–80 s einer, abends doppelt so oft, über den Camp-Boden von Bildrand zu Bildrand; Werkstatt › Camp › Kleinvieh (Tabelle, weitere Tiere möglich).
- **Ergebnis:** (Code) Commit „Fennek huscht durchs Camp (#107)“. Im Browser geprüft (läuft, gespiegelt nach links). PixelLab 0. **Bitte testen:** im Camp eine Weile warten, abends öfter.

### #108 Rattenschwarm und Wachdrohne streichen
- **Status:** fertig (19.11.) · angelegt 19.11. von Code (Runde 2: „Streichen“)
- **Rückfragen:** (Code) ⚠️ vorläufig: Daten gelöscht; das Flug-Verhalten bleibt im Code und wird im Gegner-Test mit einer Testdrohne geprüft.
- **Ergebnis:** (Code) Commit „Rattenschwarm und Wachdrohne gestrichen (#108)“. `tools/enemy_test.mjs` 25/25. PixelLab 0.

### #109 Balancing v2 per Simulation (Tank-Druck, Mega-Rig-Preise)
- **Status:** offen · angelegt 19.11. von Code (Runde 2: „Ava simuliert jetzt“; nach #110, weil die neuen Äste die Kurve ändern)
- **Rückfragen:**
- **Ergebnis:**

### #110 Skilltrees: vier Äste à 20+ Knoten
- **Status:** fertig (19.11.) · Teil 1 · angelegt 19.11. von Code (Daniel: 20+ Knoten je Ast, nach Ressource, Inhalte: passive Boni, Rezepte & Werkstätten, Welt & Story; Entwurf als interaktive Karte)
- **Auftrag:** Entwurf mit 88 Knoten im Artefakt „NomadGirl Skilltrees“ (https://claude.ai/artifact/EoWeffe9WL6p1esscmhz82), Daniel behält/ändert/streicht; danach bauen: neue Freischalt-Arten (Werkstatt, Rig-Teil, Merker, Fähigkeit, Camp-Boni), Warroom-Bildschirm für große Bäume, dunkler Tab (#080).
- **Rückfragen:** (Daniel) „Ich mag alle Skills … ergänze noch ein paar, damit es nicht überall gleich viele sind“; Bilder mit PixelLab (Probeblatt, dann alle 7 Blätter freigegeben). (Code) ⚠️ vorläufig: Knoten mit eigener Mechanik setzen ihren Merker und zeigen „Wirkung folgt“, die Mechaniken kommen Stück für Stück (Teil 2); Werkstätten wie Hydrokultur, Küche, Bit-Farm, Ripperdoc, Reaktor sind erst nach ihrem Knoten kaufbar (was im Rig steht, bleibt); der dunkle Tab bleibt verborgen bis #080.
- **Ergebnis:** (Code) Commit „Skilltrees: 108 Knoten mit PixelLab-Bildern (#110)“. `npm test` 318/318, techtree 10/10, cozy/stack/van/bitfarm/crew/mega/megarig grün. **PixelLab: 80 Generierungen** (Probeblatt 216 px + 7 Blätter 256 px), übrig 189,6. **Bitte testen:** Warroom › Techtree, durch die drei Tabs scrollen, Knoten ansehen; im Händler-Menü sind manche Werkstätten jetzt mit 🔒 gesperrt.

### #087 Wettervorhersage im Warroom
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code (Daniel, Karte „Was als Nächstes“; 19.11.: „#087–#091 Systeme bauen“)
- **Auftrag:** Navigator zeigt Regen, Sandsturm und Nebel der nächsten Etappen → Routenwahl (`docs/backlog.md` › Ideen).
- **Rückfragen:** (Code) ⚠️ vorläufig: der Navigator ist (noch) keine eigene Entity, nur eine Zeile „Wetter · Navigator“ in der Reisekarte; die Vorhersage ist exakt (gleiche Würfel wie die Fahrt), nur Zeit durch Zwischenfälle kann sie verschieben; ohne Warroom keine Vorhersage (wie Gefahr/Beute); Ausblick 3 Tage.
- **Ergebnis:** (Code) Commit „Wettervorhersage in der Reisekarte (#087)“. `test/forecast.test.js` 3/3, `npm test` 298/298, `tools/map_test.mjs` 16/16. PixelLab 0. **Bitte testen:** Warroom ins Rig bauen, Reisekarte öffnen, Ziele mit mehreren Etappen anwählen und aufs Wetter achten, dann hinfahren und schauen, ob der Sandsturm kommt.

### #088 Gangs als Auftraggeber
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code
- **Auftrag:** Quests von Gangs (Bedingungs-Sprache + Revier-Camp), Lohn Ruf und Revier-Zugang.
- **Rückfragen:** (Code) ⚠️ vorläufig: Gang-Aufträge gibt es erst ab **Geduldet** (darunter kein Frieden, also kein Gespräch; Ruf kommt über die Straße), Annehmen und Abgeben nur im Revier; „Revier-Zugang“ = Ruf als Lohn (als Freund Handel + Revier säubern), noch kein eigener Zugang zu Räumen; sieben Aufträge für sechs Gangs, die übrigen sechs Gangs noch ohne.
- **Ergebnis:** (Code) Commit „Gangs als Auftraggeber (#088)“. `test/gang_quests.test.js` 3/3, `npm test` 301/301, `tools/turf_test.mjs` 9/9, camp/workshop/silo grün. PixelLab 0. **Bitte testen:** Ruf bei den Yellow Vultures über die Straße auf Geduldet bringen (oder Datenset), Tankstelle plündern, mit einem von ihnen reden, „Ratten im Markt“ annehmen, Großmarkt schaffen, zurück und abgeben.

### #089 Revierkrieg
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code
- **Auftrag:** Ruf bei einer Gang senkt den bei ihren Rivalen; Reviere verschieben sich auf der Reisekarte, Fehden werden zu Fronten.
- **Rückfragen:** (Code) ⚠️ vorläufig: Rivalen-Paare von Code gesetzt (Vultures ↔ Neon Rats + Crude Boys, Rust Guard ↔ Salt Dogs ↔ Tunnel Kings, Sky Wolves ↔ Level Five, Order Office ↔ Static Saints + Zero Hour, Crude Boys ↔ Sunny Side); Gegenruf 50 %; Übernahme nur bei geknacktem Tresor ohne Frieden mit Kill, durch den Rivalen mit dem besten Ruf; Fronten nur sichtbar mit Warroom; Gangs ziehen nicht von selbst weiter (nur durch Leyla).
- **Ergebnis:** (Code) Commit „Revierkrieg: Rivalen, Gegenruf, Übernahmen, Fronten (#089)“. `test/turf_war.test.js` 4/4, `npm test` 305/305, turf 10/10, map 17/17, drive 19/19, poi 31/31, camp 34/34. PixelLab 0. **Bitte testen:** mit Warroom die Reisekarte ansehen (Bunker 13 ↔ Pit 6 ist von Anfang an eine Front), die Tankstelle mit Gewalt plündern (Tresor knacken) und schauen, wer danach einzieht.

### #090 Rig-Radio
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code
- **Auftrag:** Sender mit Musik aus Code, Durchsagen aus BigCityDelta, Lore-Häppchen, Hinweise auf POIs, vielleicht eine DJ-Entity.
- **Rückfragen:** (Code) ⚠️ vorläufig: DJs sind Namen im Radio-Bereich (noch keine Entities mit Porträt); der DJ spricht als Text im Chip (keine Stimme); Radio startet aus (N oder Pause-Menü), merkt sich der Browser; nur Camp + Fahrt, im POI still; vier Sender, Saint FM gehört den Static Saints (als Feind Rauschen); Controller über das Pause-Menü (keine eigene Taste).
- **Ergebnis:** (Code) Commit „Rig-Radio: Sender, Musik aus Code, DJ-Durchsagen (#090)“. `test/radio.test.js` 4/4, `npm test` 309/309, `tools/radio_test.mjs` 11/11, drive/camp/workshop/pad/menu_nav grün. Nebenbei behoben: `pretty()` machte aus „104,2“ „104, 2“ (Kommas in Texten), Ton aus wurde verspätet erkannt, die Fahrt zeigte oben links „null“. PixelLab 0. **Bitte testen:** im Camp N drücken, durch die Sender schalten, einen DJ reden lassen (nach dem ersten Song), dann losfahren und weiterhören.

### #091 Werte-Bildschirm
- **Status:** abgenommen (19.11., Runde 2) · fertig (19.11.) · angelegt 19.11. von Code
- **Auftrag:** Ein Bildschirm mit allen Werten und ihren Quellen über den Boni-Bus (baut auf #076 Punkt 7).
- **Rückfragen:** (Code) ⚠️ vorläufig: Taste U (frei), dazu Pause-Menü; Leylas Grundwerte stehen nicht dabei, nur die Boni darauf; Ausbau/Synergie bleiben an der Werkstatt (gelten je Platz); Buffs im Camp als „nächster Run“.
- **Ergebnis:** (Code) Commit „Werte-Bildschirm: jede Zahl mit ihren Quellen (#091)“. `test/stat_sheet.test.js` 3/3, `npm test` 312/312, `tools/stats_test.mjs` 6/6, pad/menu_nav/radio/workshop/inventory grün. PixelLab 0. **Bitte testen:** im Camp U drücken, Ausrüstung anziehen und wieder schauen, mit Q durch die Reiter.

### #062 Quests aus Straßen-Merkern
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat, Verzahnungs-Prüfung)
- **Für:** Code
- **Lesen:** docs/features/worldmap.md (Ketten, Merker)
- **Auftrag (Daniel, 18.11.2026):** Punkt 4: „ja, machen“: Merker aus Straßen-Geschichten schalten Quests frei.
- **Rückfragen:** (Code) ⚠️ vorläufig: Auftraggeber bleiben Schraube und Onkel Sung (Gangs als Auftraggeber später); Meldung sofort beim Merker, das „!“ im Camp danach.
- **Ergebnis:** (Code) Commit „Quests aus Straßen-Merkern (#062)“ auf `main`. Quests › Erst mit Merker / Nicht mit Merker, 4 neue Aufträge, Meldung „Neuer Auftrag“. `npm test` 254/254 (neu `test/quest_flags.test.js`), Browser camp/drive/silo grün. PixelLab 0. **Bitte testen:** eine Fehde bis zum Ende spielen, dann zu Schraube.

### #063 Wetter mit Folgen (mit Meldungen)
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat, Verzahnungs-Prüfung)
- **Für:** Code
- **Lesen:** docs/features/world.md (Wetter), docs/features/benches.md (Zisterne)
- **Auftrag (Daniel, 18.11.2026):** Punkt 5: „auch machen, aber mit Meldungen“: Regen auf der Fahrt füllt die Zisterne, Sandsturm macht bestimmte Ereignisse wahrscheinlicher, Nebel aus dem Wetter zieht in den POI; jede Folge mit Meldung.
- **Rückfragen:** (Code) ⚠️ vorläufig: Stärke der Folgen (Sandsturm Staubwände ×4, Nebel Fackeln ×3, Regen Pannen ×2,5; im POI Regen Gehör −40 %, Nebel Sicht −30 % und Leylas Sicht −25 %, Staub −15 %/−10 %); Meldungen als Toasts (einmal je Wetter und Fahrt, beim Ankommen die Zisterne, im POI nach dem Start); das Wetter im POI kommt vom Ort und der Uhrzeit (nicht von der letzten Etappe).
- **Ergebnis:** (Code) Commit „Wetter mit Folgen (#063)“ auf `main`. Neu `game/weather_fx.js` (`legSky`, `runSky`, `cisternWater`), Gewichtung in `generateEncounter` (`ctx.bias`), Meldungen in `camp_actions` und `scene`. `npm test` 256/256 (neu `test/weather_fx.test.js`), Browser 44/46 im Gesamtlauf: `mobile_test` (Zeitüberschreitung, einzeln 19/19 grün) und `tutorial_test` (der bekannte Wackler: der Run-Tipp kommt manchmal nicht, einzeln 2 von 3 grün). PixelLab 0. **Bitte testen:** eine Fahrt durch die Glass Dunes (Sandsturm) und einen POI im Regen.

### #064 Markentreue und Influencer-Billboards
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat, Verzahnungs-Prüfung)
- **Für:** Code
- **Lesen:** docs/features/lore.md, docs/features/worldmap.md (Billboards)
- **Auftrag (Daniel, 18.11.2026):** Punkt 6: „auf jeden Fall machen. Billboards auf der Reise sollen ab sofort einen Nachlass ermöglichen. Klickt man sie während der Fahrt an, erhält man den Buff „Influencer + Brand“ und damit einen ordentlichen Nachlass (20 Prozent) auf diese Brand in den nächsten xy Stunden.“ Dazu Set-Bonus für drei Teile derselben Marke.
- **Rückfragen:** (Code) ⚠️ vorläufig: „xy Stunden“ = 24 h (Reisen › Fahrt › Influencer: Dauer); eine Marke zur Zeit, ein neuer Tipp ersetzt sie; Nachlass gilt an Antworten mit Marke (Sprit = Delta Petrol, Essen = Neon Noodle), für Dinge der Marke, am neuen Markenstand und im Revier-Camp-Handel; ohne Maus: Tastatur R / Controller X; Set-Bonus ab 3 Teilen, Werte für acht Marken mit Ausrüstung.
- **Ergebnis:** (Code) Commit „Markentreue und Influencer-Billboards (#064)“ auf `main`. Neu `game/brand_perks.js`, `road.hit`, Billboard-Tipp in `drive_ui.js`, Markenstand (Lage › Laden), Lore › Marken › Markentreue, Inventar-Zeile Markentreue. `npm test` 259/259 (neu `test/brand_perks.test.js`), Browser 46/46 (`drive_test` 18 mit echtem Klick). PixelLab 0. **Bitte testen:** während der Fahrt ein Billboard antippen, dann an der Karawane Sprit kaufen.

### #075 Werkstatt: Kurzzeilen und Kleinkram
- **Status:** abgenommen (19.11., #076) · fertig (19.11.) · angelegt 19.11. von Code (Daniels Auftrag im Code-Chat: „Wie steht es um die Werkstatt? … Lass uns auch hier eine Eleganz-Runde drehen, das Interface untersuchen und das gute Stück weiter polieren.“)
- **Für:** Code
- **Lesen:** docs/features/editor.md, `game/workshop/`
- **Auftrag (Daniel, 19.11.2026):** C: Quest-Zeile mit Stücken, beschriftete Tabellen (Stärke-Gewichte), richtiges Bild im Ereignis-Baukasten, schlanke Übersicht. Reihenfolge (Daniel): erst A, dann Datensets, dann B und C; inkrementell.
- **Rückfragen:** –
- **Ergebnis:** (Code) Commit „Werkstatt: Kurzzeilen und Kleinkram (#075)“ auf `main`. Quest-Kurzzeilen, `rowLabel`, Aussehen ohne Tabellenbilder, Karten-Text gekürzt, Datenset-Beschreibung. `npm test` 273/273, `workshop_test`, `workshop_cloud_test`, `datasets_test`, `map_test` grün. PixelLab 0.

### #074 Werkstatt: Verzahnungs-Ansichten
- **Status:** abgenommen (19.11., #076) · fertig (19.11.) · angelegt 19.11. von Code (Daniels Auftrag im Code-Chat: „Wie steht es um die Werkstatt? … Lass uns auch hier eine Eleganz-Runde drehen, das Interface untersuchen und das gute Stück weiter polieren.“)
- **Für:** Code
- **Lesen:** docs/features/editor.md, `game/workshop/`
- **Auftrag (Daniel, 19.11.2026):** B: Merker-Explorer (wer setzt, wer liest, Ketten), Marken-Sets mit ihren Teilen, Bedingungen in den Kurzzeilen. Reihenfolge (Daniel): erst A, dann Datensets, dann B und C; inkrementell.
- **Rückfragen:** (Code) ⚠️ vorläufig: die Ansichten stehen im Inspektor des jeweiligen Bereichs (kein eigener Bereich); Fund für Daniel: `laeuferin_verraten` wird gesetzt, aber von keiner Lage oder Quest gelesen (eine Folge für den Verrat fehlt).
- **Ergebnis:** (Code) Commit „Verzahnungs-Ansichten (#074)“ auf `main`. `summaries.js` (`flagGraph`, `chainEdges`, Quests, Markentreue, Worker), `workshop.css`. `npm test` 273/273 (neu `test/workshop_views.test.js`), `workshop_test`, `workshop_cloud_test` grün. PixelLab 0.

### #073 Datensets: speichern unter, laden, aktivieren
- **Status:** abgenommen (19.11., #076) · fertig (19.11.) · angelegt 19.11. von Code (Daniels Auftrag im Code-Chat: „Wie steht es um die Werkstatt? … Lass uns auch hier eine Eleganz-Runde drehen, das Interface untersuchen und das gute Stück weiter polieren.“)
- **Für:** Code
- **Lesen:** docs/features/editor.md, `game/workshop/`
- **Auftrag (Daniel, 19.11.2026):** „Es wäre an der Zeit, Speichern und Laden von verschiedenen Konfigurationen zu erlauben … Im Hauptmenü würde dann unten in der Statusleiste angezeigt werden, welches Datenset gerade aktiv ist.“ Antworten: im Repo als **Variante** (nur geänderte Einträge, Overlay über dem Standard), aktiv wählbar in **Hauptmenü + Werkstatt** (pro Gerät). Reihenfolge (Daniel): erst A, dann Datensets, dann B und C; inkrementell.
- **Rückfragen:** (Code) ⚠️ vorläufig: „Laden“ in der Werkstatt macht das Set zugleich auf dem Gerät aktiv (ein Begriff statt zwei); das Hauptmenü wechselt per Klick reihum; Beschreibung eines Sets noch ohne eigenes Feld (kommt mit #075); gelöscht wird nur die aktive Variante.
- **Ergebnis:** (Code) Commit „Datensets (#073)“ auf `main`. Neu `engine/sets.js`, `projects/nomadgirl/sets/index.json`, Werkstatt-Knopf + Dialog, Hauptmenü-Eintrag + Statusleiste, Spiel lädt das Overlay. Nebenbei behoben: Werkstatt setzte `workshop.p` zu früh (Rennen mit Tests, `map_test`). `npm test` 271/271 (neu `test/sets.test.js`), Browser 47/48 vor dem Fix (danach `map_test` 3×, `workshop_test`, `datasets_test` 6, `workshop_cloud_test` grün). PixelLab 0. **Bitte testen:** Werkstatt › Knopf „Standard“ › Speichern unter …, etwas ändern, Spiel starten; im Hauptmenü zurück auf Standard klicken.

### #072 Werkstatt: breite Tabellen als Karten
- **Status:** abgenommen (19.11., #076) · fertig (19.11.) · angelegt 19.11. von Code (Daniels Auftrag im Code-Chat: „Wie steht es um die Werkstatt? … Lass uns auch hier eine Eleganz-Runde drehen, das Interface untersuchen und das gute Stück weiter polieren.“)
- **Für:** Code
- **Lesen:** docs/features/editor.md, `game/workshop/`
- **Auftrag (Daniel, 19.11.2026):** A: Tabellen mit vielen Spalten (Ereignis-Baukasten › Lagen/Antworten, Begabungen) zeigen eine Kurzzeile je Eintrag, ein Klick klappt ein Formular in Gruppen auf. Reihenfolge (Daniel): erst A, dann Datensets, dann B und C; inkrementell.
- **Rückfragen:** (Code) ⚠️ vorläufig: Grenze 8 Spalten; Gruppen nach dem Feldnamen (ohne Schema-Änderung); offene Karten bleiben beim Bearbeiten offen.
- **Ergebnis:** (Code) Commit „Breite Tabellen als Karten (#072)“ auf `main`. `workshop.js` (`cardTable`, `cardGroup`), `workshop.css`. `workshop_test` (neu: Karten, Ändern, Rückgängig, Filter), `workshop_cloud_test`, `web:test`, `npm test` 269/269 grün. PixelLab 0. **Bitte ansehen:** Werkstatt › Ereignis-Baukasten, eine Lage aufklappen.

### #071 Kleine Fehler: Macken-Wirkung als Feld, Wetter-Gewichte in der Werkstatt, Welt-Merker
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat, „Wo konnte die Vernetzung eleganter sein?“ Punkt 6)
- **Für:** Code
- **Auftrag (Daniel, 18.11.2026):** „Ich bin eine Weile AFK, arbeite ruhig alles ab, hab aber die Qualität im Blick und gehe inkrementell vor, damit wir nicht versehentlich alles kaputt machen.“ (Punkt 6 der Eleganz-Prüfung)
- **Fertig, wenn:** gleiche Zahlen wie vorher (Tests), Werkstatt/Spiel ohne Fehler, Build grün auf `main`, je Ticket ein eigener Commit.
- **Rückfragen:** (Code) ⚠️ vorläufig: Welt-Merker bleiben in `save.road.flags` (Umbenennen im Spielstand wäre ein Risiko ohne Gewinn), nur der Zugriff ist vereinheitlicht; die Händler-Arten (Revier, Markenstand, Karawane) teilen seit #069 die Preise, ein gemeinsames Laden-Modul bleibt im Ideenspeicher.
- **Ergebnis:** (Code) Commit „Kleine Fehler (#071)“ auf `main`. Macken › Wirkung als Worker (Daten + `quirkEffect`), Ereignis-Baukasten › Wetter (Gewichte), `conditions.worldFlags`/`setFlag`. `npm test` 269/269 (neu `test/cleanup071.test.js`), Browser 47/47. PixelLab 0. Dazu im Ideenspeicher (`docs/backlog.md` › D): die entstandenen Kreisläufe und elf Systeme, die daraus wachsen könnten.

### #070 Meldungs-Kanal mit Vorrang und Logbuch
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat, „Wo konnte die Vernetzung eleganter sein?“ Punkt 5)
- **Für:** Code
- **Auftrag (Daniel, 18.11.2026):** „Ich bin eine Weile AFK, arbeite ruhig alles ab, hab aber die Qualität im Blick und gehe inkrementell vor, damit wir nicht versehentlich alles kaputt machen.“ (Punkt 5 der Eleganz-Prüfung)
- **Fertig, wenn:** gleiche Zahlen wie vorher (Tests), Werkstatt/Spiel ohne Fehler, Build grün auf `main`, je Ticket ein eigener Commit.
- **Rückfragen:** (Code) ⚠️ vorläufig: höchstens drei Meldungen gleichzeitig, Hinweise und Reise-Meldungen warten, alles andere kommt sofort; Logbuch im Spielstand (150 Einträge), Menü zeigt 40.
- **Ergebnis:** (Code) Commit „Meldungs-Kanal und Logbuch (#070)“ auf `main`. `hud.js`: Warteschlange, `journal`, Menü › Logbuch. `npm test` 266/266, Browser 47/47 (neu `logbook_test` 3). PixelLab 0. **Bitte testen:** einen POI im Regen bei einer befreundeten Gang starten (mehrere Meldungen auf einmal), danach Menü › Logbuch.

### #069 Preise bündeln: eine Preis-Funktion
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat, „Wo konnte die Vernetzung eleganter sein?“ Punkt 3)
- **Für:** Code
- **Auftrag (Daniel, 18.11.2026):** „Ich bin eine Weile AFK, arbeite ruhig alles ab, hab aber die Qualität im Blick und gehe inkrementell vor, damit wir nicht versehentlich alles kaputt machen.“ (Punkt 3 der Eleganz-Prüfung)
- **Fertig, wenn:** gleiche Zahlen wie vorher (Tests), Werkstatt/Spiel ohne Fehler, Build grün auf `main`, je Ticket ein eigener Commit.
- **Rückfragen:** (Code) ⚠️ vorläufig: gerundet wird vor dem Influencer-Nachlass (so zeigte es die Straße schon); im Revier-Handel heißt das mit Influencer höchstens 1 Δ Unterschied; der Bau-Modus (Werkstätten, Container, Rig-Teile) hat keine Marken und bleibt bei seinem Preis.
- **Ergebnis:** (Code) Commit „Preise bündeln (#069)“ auf `main`. Neu `game/pricing.js` (`pay`, `earn`, `factors`, `factorText`), umgestellt Antworten unterwegs (inkl. Markenstand) und Revier-Handel. `npm test` 266/266 (neu `test/pricing.test.js` vergleicht mit der alten Formel), Browser 46/46. PixelLab 0.

### #068 Eine Bedingungs-Sprache für Ereignisse, Quests, Händler
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat, „Wo konnte die Vernetzung eleganter sein?“ Punkt 2)
- **Für:** Code
- **Auftrag (Daniel, 18.11.2026):** „Ich bin eine Weile AFK, arbeite ruhig alles ab, hab aber die Qualität im Blick und gehe inkrementell vor, damit wir nicht versehentlich alles kaputt machen.“ (Punkt 2 der Eleganz-Prüfung)
- **Fertig, wenn:** gleiche Zahlen wie vorher (Tests), Werkstatt/Spiel ohne Fehler, Build grün auf `main`, je Ticket ein eigener Commit.
- **Rückfragen:** (Code) ⚠️ vorläufig: die Feldnamen in den Daten bleiben (keine Umstellung, `needs`/`not` der Lagen gelten als Merker-Felder); Ruf als Bedingung bleibt bei den Lagen (Ruf von–bis), weil er die Gang der Lage mitwählt.
- **Ergebnis:** (Code) Commit „Eine Bedingungs-Sprache (#068)“ auf `main`. Neu `game/conditions.js`, `needs.js` als Hülle, Lagen und Quests prüfen über `check`, Werkstatt: Crew-&-Rig-Felder jetzt auch bei Lagen und Quests (`CREW_NEEDS`). `npm test` 264/264 (neu `test/conditions.test.js`), Browser 46/46. PixelLab 0.

### #067 Effekt-Leiste im HUD (Effekte mit Ablauf)
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat, „Wo konnte die Vernetzung eleganter sein?“ Punkt 4)
- **Für:** Code
- **Auftrag (Daniel, 18.11.2026):** „Ich bin eine Weile AFK, arbeite ruhig alles ab, hab aber die Qualität im Blick und gehe inkrementell vor, damit wir nicht versehentlich alles kaputt machen.“ (Punkt 4 der Eleganz-Prüfung)
- **Fertig, wenn:** gleiche Zahlen wie vorher (Tests), Werkstatt/Spiel ohne Fehler, Build grün auf `main`, je Ticket ein eigener Commit.
- **Rückfragen:** (Code) ⚠️ vorläufig: die Leiste ersetzt „BUFFS“ an derselben Stelle (Camp rechts oben, im Run unter AvAs Lebenszeichen); kein eigenes Speichermodell, die Effekte bleiben, wo sie liegen, `effects.js` liest sie nur.
- **Ergebnis:** (Code) Commit „Effekt-Leiste (#067)“ auf `main`. Neu `game/effects.js`, HUD-Chips (`hud.js`, `play.css`). Nebenbei der Wackler `tutorial_test` behoben: die Run-Lektion hing an der Spielzeit (8 s / 40 s), die kopflos ungleich lief; der Test stellt jetzt die Uhr des Feldhandbuchs vor (8 von 8 grün). `npm test` 262/262 (neu `test/effects.test.js`), Browser 45/46 vor dem Fix, `tutorial_test` danach 8/8. PixelLab 0. **Bitte ansehen:** Camp mit einem Buff und nach einem Billboard-Tipp.

### #066 Boni-Bus: alle Bonus-Quellen an einem Ort
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat, „Wo konnte die Vernetzung eleganter sein?“ Punkt 1)
- **Für:** Code
- **Auftrag (Daniel, 18.11.2026):** „Ich bin eine Weile AFK, arbeite ruhig alles ab, hab aber die Qualität im Blick und gehe inkrementell vor, damit wir nicht versehentlich alles kaputt machen.“ (Punkt 1 der Eleganz-Prüfung)
- **Fertig, wenn:** gleiche Zahlen wie vorher (Tests), Werkstatt/Spiel ohne Fehler, Build grün auf `main`, je Ticket ein eigener Commit.
- **Rückfragen:** (Code) ⚠️ vorläufig: der Bus deckt die Camp-Seite ab (Wachstum, Sprit, Schlaf, Ruhe, Kochen, Herstellen, Strom, Δ aus Runs, Beute); Leylas Ausrüstung (`applyGear`) und der Tank (`techtree.bonuses`) haben schon eigene Sammler und bleiben; Chancen werden addiert, Raten multipliziert, damit keine Zahl sich ändert.
- **Ergebnis:** (Code) Commit „Boni-Bus (#066)“ auf `main`. Neu `game/mods.js`, umgestellt Garten, Kochen/Herstellen, Reisen, Schlafen, Chillen, Δ aus Runs, Extra-Beute; Anzeigen „Wachstum: …“, „Heilt 100 % (…)“, „Ruhe: …“. `npm test` 261/261 (neu `test/mods.test.js` prüft die alte Formel), Browser 46/46. PixelLab 0.

### #065 Cyberware im Duell
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat, Verzahnungs-Prüfung)
- **Für:** Code
- **Lesen:** docs/features/cyberware.md, docs/features/glitchlings.md
- **Auftrag (Daniel, 18.11.2026):** Punkt 7: „ja. Machen.“ (Implantate wirken im Glitch-Duell, z. B. mehr Integrität).
- **Rückfragen:** (Code) ⚠️ vorläufig: ein neuer Wert „Duell-Integrität“ auf Augen- und Nerven-Implantaten (+3 bis +15, Berserker-Chip −10), nur für Leylas Seite und nur im Spiel (/duel und /mobile haben keine Leyla); mehr Bits oder Sonderregeln später.
- **Ergebnis:** (Code) Commit „Cyberware im Duell (#065)“ auf `main`. Neu: Ausrüstungswert `hack`, 10 Implantate, Duell-Kopf „Implantate: +N Integrität“, Gegner behält seine Integrität. `npm test` 259/259, Browser 46/46 (`bitfarm_test` 6). PixelLab 0. **Bitte testen:** Overclock-Chip einbauen, dann ein Schalter-Duell im POI.

### #061 Ruf im POI: Revier-Camp der Gang
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat, Verzahnungs-Prüfung Punkt 3)
- **Für:** Code
- **Lesen:** docs/features/pois.md, docs/features/worldmap.md (Ruf)
- **Auftrag (Daniel, 18.11.2026):** „Der POI wird dann zu einem Camp mit dem Hinweis zu Beginn, dass das Revier der Gang XY ist und man mit ihnen in welcher Beziehung steht. ABER man kann immer auch kämpfen und töten. Was im Zweifel den Ruf beschädigt.“ Beute: „Klauen kostet Ruf“ (Kisten gehören der Gang, Öffnen unter Zeugen kostet Ruf, heimlich geht; Tresor + Boss nur mit Kampf; Händler/Auftraggeber im Camp).
- **Rückfragen:** (Code) ⚠️ vorläufig: Frieden schon ab **Geduldet** (einstellbar: Ereignis-Baukasten › Ruf › Frieden im Revier ab), Handel und Auftrag erst ab **Freund**; zur Gang gehören Plünderer, Wachdrohnen und der Boss, Mutanten und Viecher nicht; Klauen −8, Frieden brechen −15, Auftrag „Revier säubern“ +10 Ruf und 40 + 20 × Gefahr Δ; der Hinweis zu Beginn ist ein Toast (kein Fenster, das den Start aufhält); Handel nur Kaufen (4 Dinge aus der Beutetabelle des POIs, Wert × 1,5 × Ruf-Preis).
- **Ergebnis:** (Code) Commit „Revier-Camp (#061)“ auf `main`. Neu `game/play/turf.js`, Haken in `enemies.js` (friedlich: sieht, nickt, hört nichts; Treffer bricht den Frieden), `poi_level.js` (Kiste der Gang, Tresor nur mit Gewalt, Reden), 4 Felder in Ereignis-Baukasten › Ruf. `npm test` 248/248, Browser 45/45 (neu `turf_test` 7). PixelLab 0. **Bitte testen:** in der Werkstatt nichts nötig; im Spiel Ruf bei einer Gang hochspielen (Ereignisse), dann ihren POI plündern: Toast, Reden, Handeln, eine Kiste vor ihren Augen.

### #060 Bit-Farm: Entities speichern, als Worker an Werkbänken, freundliche Duelle in der Chill-Ecke
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat, Verzahnungs-Prüfung Punkt 2)
- **Für:** Code
- **Lesen:** docs/features/glitchlings.md, docs/features/benches.md, docs/features/crafting.md
- **Auftrag (Daniel, 18.11.2026):** neue Werkstatt **Bit-Farm**, „ein Inventar, in dem man die AIs speichern kann. Entities, die dort gespeichert sind, können dann an bestimmten Werkbänken als Worker ausgewählt werden.“ Worker: **Charakter-Bonus** (Bonus und Macke aus dem Charakter). „In der Chill-Ecke gibt es die Möglichkeit, freundlich mit bereits gefangenen Entitäten zu duellieren“: **Bindung steigt** (stärkerer Worker-Bonus, neue Banter-Zeilen), kein Risiko.
- **Rückfragen:** (Code) ⚠️ vorläufig: Worker werden im Inventar eingeteilt (Entity in der Bit-Farm › „Als Worker einsetzen“, Liste der Werkstätten mit Effekt), nicht an jeder Werkbank einzeln; Bonus = die vorhandene Begabung, Macke = die Art der Macke (Tageszeit, Wetter, Nachbarn, Laune, schrullig −15 %); Bindung 0–5, +10 % je Stufe, einmal am Tag +1 (Sieg) / +½ (Niederlage); sieben Begabungen wirken schon, sechs zeigen „wirkt bald“ (Waffenmeister, Drohnenflüsterer, Chirurg, Buchhalter, Kühlwart, Archäologe); Bit-Farm 600 Δ, Strom −1, drei Plätze, **Bild vorläufig die Elektronik-Werkbank** (eigenes Bild mit PixelLab nur mit Daniels Freigabe, < 700 übrig).
- **Ergebnis:** (Code) Commit „Bit-Farm (#060)“ auf `main`. Neu `game/workers.js`, Werkstatt `bitfarm`, Werkstatt-Art Bit-Farm, Banter-Moment „Vertraut“ (13 Charaktere), Haken in Kochen/Herstellen, Garten, Strom, Reisen, Schlafen, Chillen; Freundliches Duell (fängt nichts). `npm test` 251/251 (neu `test/workers.test.js`), Browser 46/46 (neu `bitfarm_test` 5). PixelLab 0. **Bitte testen:** Bit-Farm im Bau-Modus kaufen, eine Entity hineinlegen, als Worker an die Kochnische, in der Chill-Ecke ein freundliches Duell.

### #059 Antworten mit Voraussetzungen aus anderen Systemen
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat, Verzahnungs-Prüfung Punkt 1)
- **Für:** Code
- **Lesen:** docs/features/worldmap.md (Ereignis-Baukasten)
- **Auftrag (Daniel, 18.11.2026):** „1 auf jeden Fall“: Antworten im Ereignis-Baukasten verlangen ein Implantat, einen Companion an Bord, ein AvA-Anbauteil, ein Rig-Teil oder eine Werkstatt im Rig („Schraube flickt den LKW“, „Mit dem Rammbock durch die Sperre“, „Optik-Implantat erkennt die Falle“).
- **Rückfragen:** (Code) ⚠️ vorläufig: „an Bord“ = `save.companions` (Gäste ohne Koje bleiben zurück und zählen nicht); Implantat-Platz meint Leyla und AvA; eine verschlossene Antwort als Anreiz; Voraussetzungen erst im Ereignis-Baukasten (handgemachte Zwischenfälle später).
- **Ergebnis:** (Code) Commit „Antworten mit Voraussetzungen (#059)“ auf `main`. Neu `game/needs.js`, 6 Spalten in Ereignis-Baukasten › Antworten, 12 Antworten. `npm test` 248/248 (neu `test/needs.test.js`), `drive_test` 17 (tankt vor der zweiten Fehde-Fahrt auf, weil `choose(0)` jetzt oft Panzerung rammt). PixelLab 0. **Bitte testen:** Fahrten mit Schraube an Bord (Pannenfahrzeug), Hinterhalt mit und ohne Augen-Implantat.

### #058 Schatzsuche „I become death …“ um Silo Zero
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat)
- **Für:** Code
- **Lesen:** docs/features/pois.md › Silo Zero
- **Auftrag (Daniel, 18.11.2026):** „Lass uns eine richtige Schatzsuche rund um das Silo bauen. Es gibt insgesamt fünf Stücke einer Karte, die man finden kann, um den Ort final zu offenbaren. Manche kann man kaufen, andere findet man in der Welt. Wenn man das erste findet und mit Onkel drüber spricht, poppt das Quest auf. Der Name des Quests ist „I becom death …“, von Oppenheimers Zitat entliehen.“
- **Rückfragen:** (Code) ⚠️ vorläufig: Titel „I become death …“ (Daniel schrieb „becom“; Original „Now I am become Death“); Fundorte: 1 Bunker 13 (Tresor), 3 Ministerium (Tresor), 4 die Straßen-Geschichte (deckt den Ort nicht mehr direkt auf), 2 Kartenhändler (120 Δ), 5 Schwarzmarkt (200 Δ oder stehlen); Händler erst nach Annehmen der Quest; Questgegenstände gehen bei Fehlschlägen nicht verloren; Belohnung Ort + 150 Δ.
- **Ergebnis:** (Code) Commit „Schatzsuche I become death … (#058)“ auf `main`. Neu: POI › Fundstücke (`treasureFind`), Quests › Abgeben: alle diese / Erst wenn eins davon da ist / Merker beim Annehmen / Ort aufdecken, Item-Tag Questgegenstand, 2 Lagen + 4 Antworten, Questlog hakt Stücke ab, Onkel nennt die fehlenden. `npm test` 244/244 (`test/silo.test.js` 5), Browser siehe Funkspruch (`silo_test` 10). PixelLab 0. **Bitte testen:** Bunker 13 bis zum Tresor, mit dem Stück zu Onkel Sung, Quest annehmen, dann Händler auf der Straße.

### #057 Raketensilo: großer versteckter POI in den Bergen
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat, Bild „Cyberpunk Underground Rocket Silo“ von Daniel)
- **Für:** Code
- **Lesen:** docs/features/pois.md (Stapel, Tiefe), docs/features/worldmap.md (Ketten, Orte), docs/features/glitchlings.md (Duell in der Welt)
- **Auftrag (Daniel, 18.11.2026):** „Kannst du daraus einen spielbaren POI machen und ihn irgendwo in den Bergen auf der Map verstecken?“ Antworten: vorhandene Kacheln + Bild als Karte; versteckt, bis eine Geschichte ihn verrät; Silo-KI zum Duell als **optionales** Ziel, sehr schwer, Sieg = einzigartige Entity; eigene Gang; **mindestens 20 Räume**, einer der größten POIs; Boss unten.
- **Rückfragen:** (Code) ⚠️ vorläufig: Größe XXL (neu), Tiefen-Stapel mit 26–32 Räumen; Gang Zero Hour (Giftgrün); Boss Major Null an der Startrampe; Titan Lullaby: 120 Integrität, kaum Rauschen, ein Versuch je Run; aufgedeckt seit #058 erst über die Schatzsuche.
- **Ergebnis:** (Code) Commit „Silo Zero …“ auf `main`. Neu: Räume `rs_*` (`tools/poi_rooms_057.py`), Raum-Zeichen `@` (KI-Terminal), Orte › Versteckt + `revealPlace`, Lagen-Feld Feste Gang, Entity-Spalten Duell-Integrität/Rauschen. `npm test` grün (`test/silo.test.js`), Browser `silo_test`. PixelLab 0. **Bitte testen:** `/game?poi=raketensilo` bis nach unten, KI-Terminal.

### #056 Van streng von der Seite (zu + Querschnitt)
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat, PixelLab 20–30 freigegeben)
- **Für:** Code
- **Auftrag (Daniel, 18.11.2026):** „Der Van hat eine Version mit offener und mit geschlossener Tür, aber sie sind nicht deckungsgleich … erzeuge einen orthogonalen Van im gleichen Stil, einmal von außen (Tür zu) und einmal im Seitenquerschnitt offen mit Platz für zwei Werkbänke … idealerweise in einer Art Tileset. WICHTIG: der Style des alten Vans soll erhalten bleiben, aber 100 % orthogonal.“
- **Rückfragen:** (Code) ⚠️ vorläufig: die animierte Drehschüssel und das Dachgeländer im Vordergrund sind aus (die Schüssel ist jetzt im Bild); Tür = Überblendung in 5 Frames; Tileset als Bild mit festen Spalten (Heck, Nische, Stütze, Nische, Fahrerhaus), noch nicht im Code zusammengesetzt.
- **Ergebnis:** (Code) siehe Commit „Van streng von der Seite …“. PixelLab diesmal 19 (übrig ~270). **Bitte testen:** Camp, zum Van gehen: Querschnitt mit Schlafkoje und Kochnische, weggehen: zu; Leiter aufs Dach.

### #055 Riesen-Billboards, Ruf bei den Gangs, Ereignisse mit Folgen und Ketten
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat)
- **Für:** Code
- **Lesen:** design.md › Die Karawane › Ruf; docs/features/worldmap.md (Fahrt, Ereignis-Baukasten); docs/features/lore.md (Marken)
- **Auftrag (Daniel, 18.11.2026):** „Nimm in die Welt noch riesige digitale Billboards für unsere ganzen Brands auf. Lass dort Werbung laufen. Verzahne den Ruf bei den einzelnen Fraktionen mit den Ereignissen und nutze die existierenden Gangs dafür. Es wäre ärgerlich, wenn Leyla von Gang A angegriffen würde, obwohl ihr Ruf bei denen auf max ist. Auch sollen die Ereignisse Auswirkungen auf den Verlauf des weiteren Spiels haben und ggf. auch Events sein, die in drei bis vier Etappen passieren (wie ein Micro-Choose-your-own-Adventure).“
- **Fertig, wenn:** Riesen-Bildschirme mit laufender Werbung der Marken in der Fahrt-Landschaft; Ruf je Gang (die 11 POI-Gangs) im Spielstand, Ereignisse mit Gang wählen Lage und Stimmung nach Ruf (Freund wird nicht überfallen), Antworten ändern Ruf; Folgen: Merker, spätere Ereignisse, Buffs; Ketten über 3–4 Etappen; Werkstatt, Tests, Build grün auf `main`.
- **Rückfragen:** (Code) ⚠️ vorläufig: Fraktionen sind erst die 11 POI-Gangs (Siedlungen/Marken später); Stufen Feind ≤ −60 … Freund ≥ 60; POIs bleiben feindlich (Design: friedlicher POI = Endgame der Diplomatie), aber Kills dort kosten Ruf; Ketten-Schritte kommen auf der nächsten Etappe, auch auf einer späteren Fahrt; Ruf startet je Durchgang neu (Design); Billboard-Sprüche englisch wie die Slogans.
- **Ergebnis:** (Code) Commit „Riesen-Billboards mit Werbung, Ruf bei den Gangs …“ auf `main`. Neu: `game/reputation.js`; `road.js` Billboards + `ads()`; `road_events.js` Gang/Ruf/Merker/Ketten; `travel.js` Folgen in `choose`, Ketten in `pickEncounter`; Reisekarte Revier + Ruf; 14 neue Lagen, 23 neue Antworten. `npm test` 239/239 (neu `test/reputation.test.js`), Browser 43/43 (`drive_test` 17). PixelLab 0. **Bitte testen:** abends durch den Delta Ring fahren (Billboards), Werkstatt › Ereignis-Baukasten mit „Ruf: Freund/Feind“ würfeln, eine Fehde bis zum Ende spielen.

### #054 Ereignis-Baukasten für unterwegs
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat)
- **Für:** Code
- **Lesen:** docs/features/worldmap.md (Zwischenfälle, Fahrt in Szene)
- **Auftrag (Daniel, 18.11.2026):** „Mehr Abwechslung in den Ereignissen unterwegs. Bau ein System, aus dem man diese Situationen generieren kann. Ich bin AFK.“
- **Fertig, wenn:** Zwischenfälle werden aus Bausteinen gewürfelt (Lage, Stimmung, Antworten, Wörter), Gefahr skaliert, Antworten mit Risiko, neue Dinge am Straßenrand, Werkstatt-Bereich mit Vorschau, Tests, Build grün auf `main`.
- **Rückfragen:** (Code, Daniel AFK) ⚠️ vorläufig: 70 % der Zwischenfälle gewürfelt, 30 % handgemacht; Gefahr +25 % je Stufe; höchstens 4 Antworten, immer eine ohne Δ und Gegenstand; Risiko gilt auch für handgemachte Encounter (Spalten); Fehlschlag = kein Lohn, dafür Schaden/Zeit; „Mitnehmen“ bringt nur Δ (noch keine Crew).
- **Ergebnis:** (Code) Commit „Ereignis-Baukasten …“ auf `main`. Neu: `game/road_events.js`, `data/road_events.json`, Werkstatt › Welt › Ereignis-Baukasten mit Vorschau (6 gewürfelte Karten, Gefahr, Nacht), `travel.js` `pickEncounter`/`encounterById` + Risiko, `road.js` 7 neue Straßenrand-Dinge. `npm test` 234/234 (neu `test/road_events.test.js`), Browser 43/43 (`drive_test` 12). PixelLab 0. **Bitte testen:** Werkstatt › Ereignis-Baukasten › „Neu würfeln“, dann ein paar Fahrten über mehrere Etappen.

### #053 Die Fahrt in Szene (wie Keep Driving)
- **Status:** abgenommen (19.11., #076) · fertig (18.11.) · angelegt 18.11. von Code (Daniels Auftrag im Code-Chat)
- **Für:** Code
- **Lesen:** docs/features/worldmap.md (Reisen in Etappen, Zwischenfälle), docs/features/camp.md, game/weather.js
- **Auftrag (Daniel, 18.11.2026):** „Die Reise von POI zu POI ähnlich in Szene setzen wie bei Keep Driving.“ Antworten: **1a** erst in Szene setzen (Rig fährt, Landschaft zieht vorbei, Zwischenfälle rollen sichtbar heran, Entscheidung wie bisher im Fenster), **2a** das echte, selbst gebaute Rig mit Anhängern von der Seite, **3c** Landschaft erst aus Code je Region, PixelLab später („bau aber trotzdem richtig tolle Lichteffekte, Sonnenuntergänge und Wetter aus Code ein“), **4c** Dauer einstellbar, Standard gemütlich 30 Sekunden je Etappe.
- **Fertig, wenn:** Fahrt-Szene zwischen Karte und Ankunft, Rig aus dem Camp, Landschaft je Region, Tageszeit läuft mit, Wetter und Licht aus Code, Zwischenfälle kommen sichtbar angerollt, vorspulen/überspringen mit Tastatur und Controller, Werkstatt-Felder, Tests, Build grün auf `main`.
- **Rückfragen:** (Code) ⚠️ vorläufig: an Bord eines Mega-Rigs zeigt die Fahrt nur die Landschaft (kein Schnappschuss); Anhalterin und Händler stehen als „Streuner“-Bausatz am Rand, bis Companions ein Aussehen haben; Dauer gilt je Etappe (nicht je km); Lichter in den Fenstern des Rigs fehlen noch.
- **Ergebnis:** (Code) Commit „Fahrt in Szene wie Keep Driving …“ auf `main`. Neu: `game/road.js` (Landschaft, Himmel, Licht, Wetter), `game/play/drive_ui.js` (Fahrt-Fenster), `game/play/rig_snapshot.js`; Werkstatt › Reisen: Fahrt, Licht & Wetter unterwegs, Landschaften (8 Regionen), Fahrt-Vorschau; Encounter › Figuren + Am Straßenrand. `npm test` 228/228 (neu `test/road.test.js`), Browser 43/43 (neu `tools/drive_test.mjs`). PixelLab 0. **Bitte testen:** Van-Tür › Karte › Hinfahren (abends für Sonnenuntergang, nachts für Scheinwerfer), E halten = vorspulen, Esc = überspringen; Werkstatt › Welt › Reisen › Fahrt-Vorschau mit Uhrzeit-Regler.

### #052 Glitch-Duell im Hauptspiel
- **Status:** abgenommen (19.11., #076) · fertig · angelegt 17.11. von Code (Daniels Auftrag im Code-Chat)
- **Für:** Code
- **Lesen:** docs/features/glitchlings.md, docs/features/pois.md, docs/features/ui.md
- **Auftrag (Daniel, 17.11.2026):** „Die ganze Kampfanimation, das ganze Kampfinterface für die Duelle so anpassen, dass es im Hauptspiel als Overlay funktionieren würde und sich nahtlos in die vorhandenen UI-UX-Konventionen eingliedert … alle Hebel, die Türen öffnen, durch Schalter ersetzen, die man erst bedienen kann, wenn man ein Duell ausgetragen hat. Dabei geht es nicht darum, zwangsläufig zu gewinnen. Das Gewinnen ist nur dafür da, die KI zu fangen … KIs in verschiedenen anderen Dingen versteckt, so dass, wenn man da vorbeigeht, durch die normale Aktionsbelegung (Stick nach oben oder E) das Duell-Event getriggert wird.“
- **Fertig, wenn:** Duell-Overlay im Spiel (Rahmen, Hilfezeile, ✕, Tastatur und Controller, pausiert), Schalter in POIs starten ein Duell und öffnen danach die Tür, Sieg fängt die KI (ins Deck), KIs in Automaten per E/↑, Tests, Build grün auf `main`.
- **Rückfragen:** (Code) ⚠️ vorläufig: ohne Entity im Deck kämpft AvA (2 Bit); Aufgeben zählt als ausgetragen; Schalter legt nach dem Duell sofort um; Unikate wohnen in keinem Schalter/Automaten; Automaten-KIs auch in fünf weiteren POIs; Tempo und Integrität wie in der Demo (Dauerfeuer, 50).
- **Ergebnis:** (Code) Commit siehe Funkspruch. `npm test` 220/220 (neu `test/glitch_world.test.js`), Browser alle grün (neu `tools/glitch_duel_test.mjs`, `poi_test`/`poi_stack_test` mit Duell). PixelLab 0. **Bitte testen:** Run zur Mile 7 Gas & Go: an einem NomadCola-Automaten E/↑, am Schalter in der Kammer E/↑, mit Controller ←/→ und A.

### #051 Glitch-Duell: Bit-Stapel
- **Status:** abgenommen (19.11., #076) · fertig · angelegt 17.11. von Code (Daniels Auftrag im Code-Chat)
- **Für:** Code
- **Lesen:** design.md › Hacking v3 › Bit-Stapel, docs/features/glitchlings.md
- **Auftrag (Daniel, 17.11.2026):** Das Gefecht „läuft noch zu stockend ab“; nach einer Liste beliebter Duell-Minispiele: „Knucklebones klingt interessant. Mach uns mal eine abstrakte Demo mit unseren Glitchlingen.“
- **Fertig, wenn:** eigene Regeln nach dem Prinzip ohne DOM mit KI, Demo unter /duel mit den Code-Porträts, ein Klick je Zug, Tests, Build grün auf `main`.
- **Rückfragen:** (Code) ⚠️ vorläufig: drei Spalten à drei Plätze, Lieblingsbit je Entity (doppelt), Kammerjäger ohne Lieblingsbit, KI-Genauigkeit nach Bits; Gleichstand gewinnt, wer nicht voll ist.
- **Ergebnis:** (Code) Commit siehe Funkspruch. `npm test` 213/213 (neu `test/stack_duel.test.js`), Duell-Browser-Test 15/15. PixelLab 0. **Bitte testen:** /duel: Spalte anklicken oder 1–3, „KI spielt für mich“, Kammerjäger, „Gefecht (alt)“.

### #050 Glitch-Duell: Demo
- **Status:** abgenommen (19.11., #076) · fertig · angelegt 17.11. von Code (Daniels Auftrag im Code-Chat)
- **Für:** Code
- **Lesen:** design.md › Hacking v3 › Das Glitch-Duell, docs/features/glitchlings.md
- **Auftrag (Daniel, 17.11.2026):** „Schau dir das OPR-Firefight-System für Kämpfe an (ohne Schlagwörter, nur das reine Kampfsystem).“ „Die Welt pausiert. Keine Regeln für Bewegungen … mehr wie ein Kartenspiel … visualisiert (zunächst über Code). Bau bitte eine Demo-Umgebung nur für das Glitch-Spiel. Es wird Erweiterungen geben, aber wir starten einfach. Andere Formulierungen als Nah- und Fernkampf, mit Bezug zu KI und Hacking, aber nicht so plump wie ‚DDoS-Attacke‘.“
- **Fertig, wenn:** Regeln ohne DOM mit KI und Simulation, Werte in der Werkstatt, Demo-Seite /duel mit Karten aus Code, Tests, Build grün auf `main`.
- **Rückfragen:** (Code) ⚠️ vorläufig: Namen Einflüstern / Verschränken / Kalibrieren, Präzision / Abschirmung / Integrität / Impulse, Flackern, überschrieben; Impulse je Begabung; fünf Kammerjäger; Selbsttest bei jeder Wunde ab halber Integrität. Duelle dauern mit den Startwerten oft 5 bis 9 Runden (eher zu lang, über die Werte kürzbar).
- **Ergebnis:** (Code) Commit siehe Funkspruch. `npm test` 208/208 (neu `test/duel.test.js`), Browser 40/40 (neu `tools/duel_test.mjs`). PixelLab 0. **Bitte testen:** /duel: eigene Karte anklicken, Aktion, Gegner anklicken; „KI spielt für mich“; Kammerjäger; „1000× simulieren“.

### #049 Entities: Hersteller und Cyberdeck als Fach
- **Status:** abgenommen (19.11., #076) · fertig · angelegt 17.11. von Code (Daniels Auftrag im Code-Chat)
- **Für:** Code
- **Lesen:** docs/features/glitchlings.md, docs/features/lore.md, docs/features/inventory.md
- **Auftrag (Daniel, 17.11.2026):** „KIs brauchen einen Hersteller. Man muss sie nicht im Inventar transportieren, wenn man ein Cyberdeck hat (was im Grunde zunächst mal ein eigenes Inventar für Glitchlinge ist).“
- **Fertig, wenn:** jede Entity hat eine Marke (Werkstatt, Tooltip), Cyberdeck mit Plätzen als eigenes Raster nur für Entities, Tests, Build grün auf `main`.
- **Rückfragen:** (Code) ⚠️ vorläufig: Hersteller je Begabung (13 Zuordnungen, Marble Sting = Kessler Cybernetics, Amber Slay nach Begabung = Vulkan); Bastler-Deck 2 Plätze; Deck-Entities überstehen ein k.o.; Deck mit Entities nicht ablegbar; ältere Spielstände bekommen einmal ein Bastler-Deck. Neues Spiel startet weiter ohne Deck.
- **Ergebnis:** (Code) Commit siehe Funkspruch. `npm test` 202/202, Browser 39/39. PixelLab 0. **Bitte testen:** Spiel laden, Inventar (I): unter dem Rucksack „Bastler-Deck“ mit Amber Slay; Tooltip zeigt Vulkan. Werkstatt › Lore › Marken › Vulkan: „Baut KIs“.

### #048 Entities: Code-Porträts, Archäologe, AvA als Entity
- **Status:** abgenommen (19.11., #076) · fertig · angelegt 17.11. von Code (Daniels Auftrag im Code-Chat)
- **Für:** Code
- **Lesen:** docs/features/glitchlings.md, design.md › Hacking v3: Entities
- **Auftrag (Daniel, 17.11.2026):** „Ich möchte, dass die Glitchlings jeweils ein individuelles, animiertes Code-Porträt bekommen, das gleichzeitig das Item-Bild ist (in diesem Fall auch animiert). Eine Kraft soll noch sein „Archäologe“, die dazu führt, dass die Locations aller einzigartigen Beutestücke im Warroom angezeigt werden. Man soll die Möglichkeit haben, AvA zu einer Entity zu machen (das ist ein alternatives Ende; sehr schwer zu erreichen).“
- **Fertig, wenn:** Porträt-Zeichner ohne Assets (aus den Eigenschaften, gleiche Entity = gleiches Gesicht, animiert), in der Werkstatt-Vorschau; Begabung Archäologe in den Daten; alternatives Ende im Design; Tests, Build grün auf `main`.
- **Rückfragen:** (Code) ⚠️ vorläufig: „einzigartige Beute“ = Merkmal Trophäe; Archäologe wirkt ohne Stärke; Weg zum anderen Ende (Marble Sting, Pixies Wendepunkt, Deck mit 6 Bits, Kessler-Kern, Tank kritisch) und was danach ist. Offen für Daniel: Ende traurig oder hell? Darf Pixie es verhindern? AvA danach steuerbar?
- **Ergebnis:** (Code) Commit siehe Funkspruch. `npm test` 198/198 (3 neue Porträt-Tests), Browser 39/39. PixelLab 0. **Bitte testen:** Werkstatt › GLITCHLINGS › Entities, rechts die Karten mit Porträts, „Neu würfeln“.

### #001 Ausbaustufe Progression
- **Status:** fertig · angelegt 12.11. (nachträglich), gebaut 12.11. abends
- **Für:** Code
- **Lesen:** design.md › Progression, Techtree & die Suche (mit „Der Tank-Ast“), „Tod und AvA“, Fahrplan › Ausbaustufe Progression
- **Auftrag:** Schritte 1–8 aus der Checkliste: Aufräumen (Deichselkästen), Tresor voll, Zerlegen, Cryo-Tank, k.o. neu, Techtree, Durchgang/Traum, Grafik.
- **Fertig, wenn:** alle Werte in der Werkstatt, Spielstände gültig (`repairSave`), eigener Test je Schritt, Build grün.
- **Rückfragen:** stehen jetzt in `docs/backlog.md` › A (A4 Heilmittel-Knoten, A5 Dunkelheit, A6 Van-Zugkraft 2.400 kg, A7 Schatzkammer-Fassung).
- **Ergebnis:**
  - [x] Aufräumen: `009ad48`
  - [x] Tresor voll + Zerlegen: `93e6728`
  - [x] Cryo-Tank: `71de035`
  - [x] k.o. neu: `11a45c5`
  - [x] Techtree: `99b8336`
  - [x] Durchgang/Traum: `598e506`
  - [x] Grafik (Tank, Techtree-Bilder und Symbole): in den Commits oben
  - Tests: `tank_test` 12, `techtree_test` 10, `craft_test` 21, `poi_test` 30
  - PixelLab: Verbrauch nicht gemeldet
  - Bitte testen (Daniel): Zerlegen, Tank-Verfall und Wartung, k.o., Techtree im Warroom, neuer Durchgang
  - Danach ohne Ticket gebaut: Durchsicht + Backlog (`0221a50`), Controller-Symbole/Salto/Slide/Leiter (`5ac5d26`), Hydrokultur (`9f0ab36`), Kachel-Tiefe (`3f7d623`)

### #002 CLAUDE.md aufteilen (Backlog A1)
- **Status:** fertig (Code, 12.11.) · angelegt 12.11. von Ava
- **Für:** Code
- **Lesen:** `docs/backlog.md` › A1 und C1
- **Auftrag:** `CLAUDE.md` (≈ 184 KB) schrumpft auf das, was jede Sitzung braucht: Regeln der Zusammenarbeit, Einrichten und prüfen, Ordner, Werkstatt und Schema, PixelLab, Assets, Kurzregeln, Funkbuch, dazu eine **Landkarte** mit einem Satz je Feature-Datei. Ziel ≈ 15 KB. Die Feature-Abschnitte aus „Spiel“, „Startseite“ usw. ziehen nach `docs/features/*.md` (z. B. leyla, kampf, ava, camp, rig, werkstaetten, pois, inventar, progression, ui, controller), der Verlauf „Stand“ nach `docs/changelog.md`. Inhalt wörtlich übernehmen, nichts kürzen oder umformulieren; Daniels Zitate bleiben. Regel ergänzen: Vor Arbeit an einem Feature die passende Datei in `docs/features/` lesen; neue Stand-Einträge gehen in `docs/changelog.md`, Feature-Wissen in die Feature-Datei.
- **Fertig, wenn:** `CLAUDE.md` ≤ 20 KB; jeder Absatz der alten Datei steht genau einmal in einer der neuen Dateien (per Skript prüfen); alle Verweise auf „CLAUDE.md › Abschnitt“ in `docs/`, `tools/`, Code-Kommentaren und `docs/funk.md` zeigen auf den neuen Ort; Tests und `ng check` grün.
- **Rückfragen:** 
- **Ergebnis:** `CLAUDE.md` 195 KB → 19 KB (Regeln, Einrichten, Ordner, Schema, PixelLab, Assets, Online-Kern, neue **Landkarte**); 20 Feature-Dateien in `docs/features/` (combat, rig, leyla, pois, benches, inventory, controller, progression, tests, tiles, drone, camp, online, world, ui, crafting, splash, art, editor), Verlauf in `docs/changelog.md`. Prüfskript: 327 Zeilen, jede genau einmal wiedergefunden, 0 Abweichungen (Skript danach gelöscht). `npm test` 84/84, `ng check` grün. Hinweis: Querverweise wie „siehe **k.o. neu**“ in den verschobenen Texten zeigen jetzt in andere Dateien, die Landkarte führt hin.

### #003 Trophäenraum im Cyberpunk-Stil (Backlog A7)
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · fertig (Code, 12.11.) · angelegt 12.11. von Ava
- **Für:** Code
- **Lesen:** `docs/features/benches.md` › Gästekoje + Schatzkammer; `tools/treasury_test.mjs`
- **Auftrag:** Daniel, 12.11.2026, zu beiden bisherigen Schatzkammer-Fassungen (Plünderer-Palette, festgezurrte Palette): „keine. Was ich meine ist eine Art trophy room im Cyberpunk Style.“ Die Werkstatt `schatzkammer` bekommt ein neues Bild: Trophäenraum mit Neon-Vitrinen, beleuchteten Sockeln, Holo-Schildern, Wandhalterungen, die Wertsachen wirken ausgestellt und gepflegt. Mechanik bleibt (Lager nur Wertsachen, wächst mit dem Füllstand, 4 Trophäen-Ständer als eigene Inventare, Dinge in echter Größe). PixelLab, AAP-64, Stil passend zu den anderen Werkstatt-Bildern. Erst **3 Kandidaten** als Vorschau erzeugen und im Ticket verlinken, ⚠️ vorläufig den besten einbauen; Daniel wählt endgültig. Alte Fassungen bleiben als Assets (`ws_treasury_v1`, `ws_treasury_alt`).
- **Fertig, wenn:** neues Bild mit Füllstand-Stufen, Ständer-Positionen passen, `treasury_test` grün, Werkstatt zeigt die Fassungen, PixelLab-Verbrauch gemeldet.
- **Rückfragen:** Welcher Kandidat? → ⚠️ vorläufig Kandidat 1 (zwei Neon-Vitrinen, Lochwand mit Holo-Schildern, Sockel im Spotlicht; passt 1:1 auf die vier Ständer). Kandidat 2 = „Hall of Loot“ mit Laser-Vitrine, Kandidat 3 = schwarzer Lack mit Gold, Teppich und Hocker. Bilder: `projects/nomadgirl/assets/workshops/treasury_candidates/cyber_1.png` … `cyber_3.png` (auch als Assets `ws_treasury_cyber_candidate_1…3` in der Werkstatt).
- **Ergebnis:** Assets `ws_treasury_cyber_empty` + `ws_treasury_cyber` (voll = leere Fassung + nur der Beutehaufen aus einem Edit Pro Flash, damit beim Füllen keine Kanten entstehen), Fächer 124/150/172/194, Ständer neu: Vitrine links 1 × 3, Lochwand 4 × 2, Vitrine rechts 2 × 3, Sockel 2 × 2; Maßstab 78 % (sonst schneidet der Container die Vitrinen ab); Effekte: Spotlicht, Vitrinen-Leuchten, Neon unter der Decke abends, Holo-Schilder funkeln. Alte Fassungen bleiben (`ws_treasury`, `ws_treasury_empty`, `ws_treasury_v1`, `ws_treasury_alt`). `treasury_test` 8/8. PixelLab: 39 Generierungen (3 × 10 + 9). Bitte testen: Camp › Schatzkammer im Rig, Wertsachen auf den Haufen, Trophäen in die Vitrinen.

### #004 Menschlicher Raider als Gegner-Grundlage
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · fertig (Code, 12.11.) · angelegt 12.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** design.md › Gegner, Feature „Gegner-KI“; PixelLab-Bosse als Stilvorlage
- **Auftrag:** Daniel, 12.11.2026: „leg bitte auch noch einen menschlichen Raider-Character als Grundlage für unsere Gegner an. Lass dich inspirieren von den Gegnern, die schon bei PixelLab liegen. Das sind die Bosse. Mach die Grafik so modular wie sinnvoll ist, um Köpfe und Waffen flexibel austauschen zu können, ohne dass die Qualität der Animationen drunter leidet. Alles, was du als Waffen anlegst, legst du bitte so an, dass Leyla es theoretisch benutzen könnte (also mit Item für den Rucksack und allen Regeln und Einträgen). Der Stil darf cyberpunkig sein, und auch wenn die Figuren Variety in Herkunft und Aussehen haben sollen, sollen sie auch zusammengehörig wirken. Alle Gegner, die Humanoids sind, sollen sich ducken können. Außerdem gehen, laufen, Alert-Pose, Angriff Nahkampf mit einer leichten Waffe und mit einer beidhändigen, schießen mit Pistole oder Langwaffe.“
- **Fertig, wenn:** Raider-Grafik mit Gehen, Laufen, Ducken, Alarm, Nahkampf leicht + beidhändig, Schießen Pistole + Langwaffe; Köpfe/Waffen austauschbar; Waffen als Gegenstände mit Symbol; Gegner im Spiel; Test grün.
- **Rückfragen:**
  - Wie modular? → ⚠️ vorläufig: **ein Körper je Bausatz**, Animationen je Waffenklasse; **Waffen** austauschbar innerhalb der Klasse (PixelLab malt einen grünen Platzhalter, das Spiel setzt die echte Waffe je Frame an Griff + Winkel), **Köpfe** als Aufleger, **Hautton + Gang-Farbe** per Farbtausch. Ein Körper für Männer und Frauen wäre unsauber: weitere Körper (Frau, schwer, schmal) = weitere Bausätze nach demselben Rezept (~300 Generierungen je Körper).
  - Ducken wann? → ⚠️ vorläufig: als Konter auf anfliegende Nägel (Chance je Gegner, Schützen öfter); Deckung hinter Kisten ist noch offen.
  - Tod für alle Klassen gleich, ohne Waffe (sie fällt per „Lässt seine Waffe fallen“). ⚠️ vorläufig.
  - Feueraxt (zweite beidhändige Waffe) war im Waffen-Blatt abgeschnitten → weggelassen.
- **Ergebnis:** Grafik + Bausatz + Gegner, siehe `docs/features/combat.md` › Gegner-Bausatz Raider. 25 Animationen (4 Klassen × Alarm, Gehen, Rennen, Ducken, Angriff, Treffer + Tod), 6 Köpfe, 5 Hauttöne, 5 Gang-Farben, neuer Bereich **Gegner-Bausätze**, Waffen › **In der Hand**, Beutetabellen mit Waffen, neue Waffen Nagelkeule / Rohrhammer / Rohrpistole (mit Symbol, Werten, Zerlegen, Trophäe), Machete + Schrotflinte mit Symbol, 5 neue Raider-Gegner (in den POIs), Schläger/Schütze/Schildträger jetzt aus dem Bausatz. Tests: `raider_test` 17/17, `npm test` 89/89 (neu `test/kits.test.js`), `enemy_test` 24, `game_test` 50, `poi_test` 30, `poi_levels_test` 9. PixelLab: 308 Generierungen (Sitzung gesamt 347, übrig 1849). Bitte testen: Spiel › `?room=kampfraum` bzw. ein POI-Run, Werkstatt › Gegner-Bausätze (Hautton/Gang-Farbe/Kopf am Gegner umstellen), Nagelkeule/Rohrpistole aus der Plünderer-Beute ausrüsten.
  - Nebenbefund: `inventory_test` hat 2 Fehler („Daneben klicken wirft es auf den Boden“, „I am Bündel zeigt den Boden im Camp“), schon vor dieser Sitzung (Stand ohne meine Änderungen geprüft), nicht angefasst.

### #005 Intro als Comic (Die Suche)
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · fertig (Code, 12.11.) · angelegt 12.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** design.md › „Die Suche: AvA im Cryo-Tank“, „Tod und AvA“; `docs/features/controller.md` › Hauptmenü; `docs/features/splash.md`
- **Auftrag:** Daniel, 12.11.2026: „lass uns ein Intro für das Spiel malen“. Entscheidungen (Multiple Choice): **Inhalt** = die Suche (AvA wird krank, Körper in den Cryo-Tank, Verstand in die Drohne, Leyla fährt los); **Form** = Comic-Panels; **Start** = nur, wenn man es im Hauptmenü aktiv auswählt; **Budget** = großes Kino, nach Daniels Storyboard.
- **Fertig, wenn:** Storyboard umgesetzt, Panels als Assets (KI PixelLab, AAP-64), Intro im Hauptmenü wählbar, mit Tastatur/Controller überspringbar, Werte und Panel-Reihenfolge in der Werkstatt, Test grün, Build grün, PixelLab-Verbrauch gemeldet.
- **Storyboard-Antworten (Daniel, Multiple Choice):** erstes Camp als eigenes Panel 4b (Van + Anhänger mit Tank + Feuer, keine NPCs, keine Drohne); Countdown **beides** (Tage + Tank-Balken); **Textboxen**, „achte in der Sprache auf Vermeidung von AI-ismen“; Schluss: **AvA erwacht** in der Drohne. Wichtig: Leyla, Tank, Tankstelle, Van und Camp wie im Spiel.
- **Rückfragen:**
  - Texte → ⚠️ vorläufig von Ava geschrieben, alle in der Werkstatt › Intro änderbar. Dabei erfunden: Klinikturm Ebene 40, „Bezahlt ist er bis Donnerstag“ (Leyla holt AvA, weil die Klinik den Tank abschalten will), Camp bei Kilometer 6, AvAs erster Satz „Leyla? Ich bin hier drin.“
  - Seitenaufteilung → ⚠️ vorläufig: Seite 1 = Panels 1–4 im Raster wie im Storyboard, Seite 2 = Camp + Tankstelle überlappend, Seite 3 = Null Tage ganzseitig, Seite 4 = AvA ganzseitig.
  - Wo erwacht AvA? → ⚠️ vorläufig im dunklen Anhänger beim Tank (das Camp-Panel zeigt noch keine Drohne).
  - Zahlen/Schrift (03/00 TAGE, Tank-Balken) kommen aus Code, KI malt nur leere Bildschirme bzw. freien Himmel.
- **Ergebnis:** Intro als Comic, siehe `docs/features/intro.md`. 8 Panels (PixelLab Create Image Pro, AAP-64, Referenzen Storyboard + Leyla-Sheet + Tank + Van/Anhänger + Drohne), neue Seite `intro.html` (online `/intro`), Hauptmenü-Eintrag „Intro“ an zweiter Stelle, Player `game/intro/intro.js` (Textboxen tippen, Kamerafahrt, Effekte Blasen/Alarm/Staub/Funken/Erwachen, Countdown mit Tank-Balken, Titel am Ende, zurück ins Menü), Bereich **Intro** in der Werkstatt (+ Startseite › Intro), Spielen-Knopf zeigt ab dem gewählten Panel. Tests: `intro_test` 14/14, `splash_test` grün (A öffnet jetzt das Intro an zweiter Stelle), `workshop_test` grün, `npm test` 91/91, `ng check` stimmig, Build grün. PixelLab: 200 Generierungen (8 × 25), übrig 1.648. Bitte testen: Startseite › Intro durchklicken (Tastatur und Controller), Texte und Bildausschnitte in der Werkstatt › Intro nach Geschmack ändern.

### #006 Cyberware: 30 Implantate, Perk + Flaw, Ripperdoc-Liege
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · fertig (Code, 13.11.) · angelegt 13.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** `docs/features/inventory.md` › Inventar im Diablo-Stil (Implantate), `docs/features/benches.md`, `docs/features/crafting.md`, `docs/features/leyla.md`
- **Auftrag:** Daniel, 13.11.2026: „verschiedene Cyberware Items im Spiel (sowohl die Regeln, als auch die Item Sprites). Achte drauf, dass man gut erkennen kann, was es ist und dass man die einzelnen Varianten gut voneinander unterscheiden kann. Die Item Typen ziehst du dir aus dem Inventar. Es gibt einfache Dinge, die Doppelsprung und Dash ermöglichen oder Boni geben, aber es soll auch Items geben, die sehr große Boni geben, aber dafür auch einen Nachteil mit sich bringen (als Perk und Flaw von Fallout). Erzeuge alle Grafiken … die Regeln und Mechaniken zur Herstellung kannst du direkt einbauen.“ Antworten (Multiple Choice): Doppelsprung und Luft-Dash **freischalten** (im Spiel mit Spielstand gesperrt, Implantate schalten frei; Boden-Dash bleibt; Testraum frei; Schalter in der Werkstatt), Perk + Flaw **dauerhaft**, Herstellung an einer **neuen Ripperdoc-Liege**, **~30 Teile**.
- **Fertig, wenn:** 30 Implantate (6 Plätze × 5) mit eigenem Symbol, neue Werte wirken im Spiel, Doppelsprung/Luft-Dash hängen an Implantaten, Ripperdoc-Liege mit Bild und Rezepten, Baupläne für die starken Teile in der Beute, Tooltip zeigt Vor- und Nachteile, Tests grün, PixelLab-Verbrauch gemeldet.
- **Rückfragen:**
  - Liste, Namen, Werte und Nachteile der 30 Teile → ⚠️ vorläufig von Ava (Tabelle in `docs/features/cyberware.md`), alles in der Werkstatt änderbar. 7 Perk-Teile: Tunnelblick-Optik, Overclock-Chip, Berserker-Chip, Presslufthammer-Arm, Reaktor-Herz (zieht am Tank!), Känguru-Beine, Panzerhaut Titan.
  - Eigene Werkstatt-Art „Cyberware“ für die Liege → ⚠️ vorläufig, sonst hätte die normale Werkbank (gleiche Art „Herstellen“) die Cyberware mitgebaut.
  - Einbauen → ⚠️ bleibt wie bisher im Inventar und nur im Camp; die Liege stellt nur her.
  - Start → ⚠️ vorläufig: Leyla startet ohne Doppelsprung/Luft-Dash, aber Sprungfedern, Dash-Synapse, Nano-Herzklappe und Billig-Kameraauge stehen von Anfang an im Rezeptbuch; die Liege muss man im Bau-Modus kaufen (900 Δ). Einfache Teile liegen auch schon in Tankstellen-Kisten.
  - Offen: Die POI-Räume wurden mit Doppelsprung gebaut. Im echten Run ohne Sprungfedern könnte eine Stelle unerreichbar sein (Kanten greifen und Leitern helfen). Die POI-Tests laufen im Testmodus (mit Doppelsprung). Bitte beim Spielen darauf achten; zur Not Leyla › Inventar › Schalter aus.
  - Liegen-Bild: ⚠️ vorläufig Fassung A (roter Zahnarztstuhl), B (`ws_ripperdoc_alt`) liegt bereit.
- **Ergebnis:** Siehe `docs/features/cyberware.md`. Neue Werte in `game/inventory.js` (`GEAR_STATS`, `statParts`), Wirkung in Szene, Leyla, Kampf, Tank; Tooltip mit grünen Vorteilen und roten Nachteilen; Stufen-Rahmen im Inventar (grau, blau, gold mit rotem Glühen); Ripperdoc-Liege mit Effekten; 30 Rezepte, 20 Baupläne, Beutetabellen; Werkzeuge `tools/cyberware_data.mjs`, `tools/cyberware_icons.py`. Tests: `cyberware_test` 15/15, `npm test` 91/91 (Start-Rezepte ergänzt), `ng check` stimmig; Regression grün: game 50, parcours 49, pad 39, camp 26, stack 15, gear 20 (Nachtsicht-Erwartung angepasst), craft 21, build 33, van 17, bench 26, poi 30, poi_levels 9, tank 12, techtree 10, treasury 8, garden 4, enemy 24, raider 20, light 16, container 17, splash, intro, workshop; `inventory_test` weiter mit den 2 alten Boden-Fehlern. Nebenbei: Tooltip schrieb bei Dingen ohne Aktionen „null“ (behoben). PixelLab: 320 Generierungen (30 Symbole + 2 Liegen), übrig 1.328. Bitte testen: neues Spiel (kein Doppelsprung!), Liege kaufen, Sprungfedern bauen und einbauen, Tooltip der Perk-Teile.

### #007 Reisekarte: verwitterte Touristen-Karte statt Menü
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · fertig (Code, 13.11.) · angelegt 13.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** design.md › Core Loop (Reise), `docs/features/camp.md` (Warroom, Fahren), Bereiche Orte, Reisen, POIs
- **Auftrag:** Daniel, 13.11.2026: „Jetzt müssen wir die Reise visualisieren. D.h. ich möchte nicht mehr, dass das ein Menü ist, sondern eine Art Werkbank-Screen mit einer Karte und den nächsten Zielen, die zur Wahl stehen. Die Karte soll eine verwitterte alte Karte sein (à la 60er Tourismus), aber mit Brands aus der Welt des Spiels (sei kreativ), der Inhalt soll jedoch so dynamisch wie möglich sein und in jedem Run mehr oder weniger zufällig generiert werden.“ Antworten: **Routen-Netz je Durchgang** (Knoten + Straßen, 2–4 Nachbarn erreichbar, weiter weg = gefährlicher und lohnender, besuchte bleiben), Karte am **Warroom und an der Van-Tür**, Ziele zeigen **Kosten, Gefahr + Art, Beute-Hinweise**, **Papier von PixelLab, Inhalt aus Code**.
- **Fertig, wenn:** Karte je Durchgang gewürfelt und im Spielstand, Fenster mit Karte + Ziel-Details + Hinfahren/Hier plündern (Maus, Tastatur, Controller), Marken der Spielwelt auf der Karte, alle Werte in der Werkstatt, alte Spielstände gültig, Tests grün, PixelLab gemeldet.
- **Rückfragen:**
  - Marken, Slogans, Ortsnamen-Vorlagen → ⚠️ vorläufig von Ava erfunden (8 Marken, siehe `docs/features/worldmap.md`), alles in der Werkstatt › Reisekarte änderbar.
  - Die vier Orte aus dem Bereich Orte → ⚠️ bleiben als feste Wahrzeichen, Positionen auseinandergezogen (sie lagen dicht beieinander und überdeckten sich); Start bleibt Tankstelle Kilometer 7 (passt zum Intro).
  - Fahren → ⚠️ nur eine Straße weit (2–4 Nachbarn), Kosten nach Straßenlänge (+15 % Umweg).
  - Gefahr gewürfelter Orte → ⚠️ nur Anzeige, im Run noch ohne Wirkung; Beute-Hinweise je POI-Art aus den Beutetabellen.
  - Warroom → ⚠️ öffnet direkt die Karte, Techtree und Auswerten sitzen im Kopf der Karte; an der Van-Tür ist „Karte · Reisen“ der erste Eintrag.
- **Ergebnis:** Siehe `docs/features/worldmap.md`. Neu: `game/worldmap.js` (Generator, Spielstand), `game/map_render.js` (Zeichner), `game/play/map_ui.js` (Fenster), Bereich **Reisekarte** mit Vorschau und „Neu würfeln“, Fernsteuerung `nomad.map()`. Tests: `map_test` 12/12 (neu), `npm test` 92/92 (neu: Generator; Fahrtkosten nach Straße), angepasst: `camp_test` 28, `pad_test` 41, `build_test` 32, `techtree_test` 10 (Warroom-Menü → Karte); Regression grün. PixelLab: 130 Generierungen (2 Papiere + 8 Marken), übrig 1.148. Bitte testen: Warroom bzw. Van-Tür → Karte, Ziele mit Controller und Maus anschauen, hinfahren, neues Spiel = neue Karte.

### #008 Camp-Paket: Start-Rig, Strom, Solar, Zisterne, Außen-Clutter, Lichterketten, Treppen, NPCs, Kriecher
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · erledigt (Code, 13.11.) · angelegt 13.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** `docs/features/camp.md`, `rig.md`, `benches.md`, `worldmap.md`, `combat.md`
- **Auftrag (Daniel, 13.11.2026):** (1) Karte: Schrift größer, Markierungskreuz mit mehr Kontrast. (2) „Der Van erzeugt genug Strom für ein oder zwei Module. Avas Tank verbraucht keinen Strom.“ (3) „Die Modul-Anhänger (nicht die Container!) soll es nicht mehr geben. Start-Ausrüstung ist der Van und der kleine Anhänger mit dem Tank. Im Van eine Koje und eine Kochnische; kein Warroom.“ (4) „Ohne Warroom kann man auf der Karte nicht sehen, was einen dort erwartet (mit Hinweis).“ (5) Solarpaneele auf Container-Dächern, so viele wie der Container in Einheiten lang ist. (6) Zisterne als Werkbank, sammelt Wasser über Zeit. (7) Clutter-Set für die Außenwände der Container, passend zu den Werkbänken dahinter. (8) Camp cosy und polished statt Test-Charakter. (9) Erdgeschoss-Leitern hübscher. (10) Der Code-Gegner in der Tankstelle wird ein dynamischer Gegner. (11) Die Companions bekommen ihre PixelLab-Sprites. Antworten: Onkel Sung bleibt Onkel Sung (großer Mann mit Goldkette), Schraube ist der schlanke Junge („Screw“); **Klapptreppe aus Metall**; Solar **tagsüber + Akku**; Camp: Beschriftungen dezent, Deko ums Feuer, Licht + Stimmung, HUD aufräumen, „Mach an den Container-Ecken Andockpunkte und lass den Spieler die Lichterketten selbst ziehen.“
- **Fertig, wenn:** alles oben spielbar, Werte in der Werkstatt, alte Spielstände gültig, Tests grün, PixelLab gemeldet.
- **Rückfragen:**
  - Techtree und Auswerten → ⚠️ hängen weiter am Warroom; ohne Warroom am Start muss man erst einen bauen.
  - Lichterketten → ⚠️ Andockpunkte nur an Containern und an der Van-Dachreling (kein Mast am Feuer); Preis 25 Δ, Abnehmen gibt 12 Δ zurück; sie hängen an Einheits-Nummern (Umsortieren nimmt sie mit an die neue Stelle). Mit dem Controller: Cursor auf einen Punkt, A, zum zweiten Punkt, A (RB springt nur beim Ziehen zu Andockpunkten).
  - Solarpaneele → ⚠️ erscheinen im Inventar-Tab „Van“ bei den Sockeln mit; Holzkisten tragen keine.
  - Schraube → ⚠️ Rolle jetzt „Mechaniker“ (der schlanke Junge); seine Atem-Animation nutzt nur zwei Frames, weil PixelLab in den anderen eine Kapuze aufgesetzt hat. Bei Bedarf neu animieren.
  - Zisterne → ⚠️ 0,25 Flaschen/h, fasst 8; Frischwasser ist Zutat für Neon-Ramen und gibt getrunken Erste Hilfe.
  - Streuner → ⚠️ Kapuze, oliv, Gang Gelb, Machete, so stark wie der Kriecher; der Kriecher bleibt in anderen POIs.
- **Ergebnis:** Details in `docs/features/camp.md`, `rig.md`, `benches.md`, `worldmap.md`, `combat.md`. Neu: `game/cistern.js`, `game/string_lights.js`, `tools/camp_pack_data.mjs` (schreibt die Camp-Daten), `tools/cozy_test.mjs` (15), `test/camp_pack.test.js` (5). `npm test` 97/97; Browser-Tests grün: cozy 15, bench 26, build 32, camp 28, container 17, craft 21, cyberware 15, enemy 24, game 50, garden 4, gear 20, intro, inventory 33, light 16, map 12, pad 41, parcours 49, poi_levels 9, poi 30, raider 20, splash, stack 16, tank 12, techtree 10, treasury 8, van 17, workshop. Alte Test-Setups behalten über `tools/test_fixture.mjs` 3 ⚡ am Van. PixelLab: diesmal 183 Generierungen (Treppe, Solar, 12 Außenwände, Deko, Zisterne, 2 Atem-Animationen), übrig 966. **Bitte testen:** neues Spiel (Start-Rig, Karte ohne Warroom), B → Lichterketten ziehen und abnehmen, nachts ans Feuer, Zisterne und Solar über den Händler kaufen und einbauen, Tankstelle plündern (Streuner).

### #009 Camp-Feinschliff: Perspektive, Hintergrund, Onkel Sung, Solar, Lichterketten
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · erledigt (Code, 13.11.) · angelegt 13.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** `docs/features/camp.md`, `rig.md`
- **Auftrag (Daniel, 13.11.2026):** „Die Treppen sind zwar hübsch, aber die Perspektiven sind kaputt. Mach sie direkt frontfacing orthogonal wie alle anderen Sachen. Gleiches trifft leider auch auf den Clutter im Camp zu inklusive des Feuers.“ Hintergrund im Camp „ein wenig epischer, ein wenig mehr wie im Intro, aber ohne dass der Style kaputt geht“. Onkel Sung „deutlich größer als Leyla“. Steht ein Container auf dem Dach: keine Solar-Sockel. Solarpaneel kaufen wie Container und Werkstätten (Drag & Drop). Lichterketten verschwinden, sobald sie teilweise aus dem Bild ragen oder man das Fenster verlässt und zurückkommt.
- **Fertig, wenn:** alles oben sichtbar im Spiel, Tests grün, PixelLab gemeldet.
- **Rückfragen:**
- **Ergebnis:** Details in `docs/features/camp.md` (Feinschliff) und `rig.md` (Solar unter Stapeln). Neu von PixelLab, streng von der Seite mit dem Van als Referenz: Treppe, Solarpaneel, Teppich, zwei Stühle, Ecke, Lagerfeuer (animiert, `campfire_side`), Klimagerät, Kisten, Satellitenschüssel. Horizont aus Code (Camp › Horizont). Onkel Sung 240 px. Lichterketten als Bilder. Lichter ohne Kasten (ADD global rein additiv in `main.js`). Tests: `npm test` 98/98, `cozy_test` 18, alle 27 Browser-Tests grün. PixelLab: diesmal 101 Generierungen, übrig 865. **Bitte testen:** Lichterkette halb aus dem Bild schieben und Fenster wechseln, Nacht am Feuer (kein Lichtkasten mehr), Container auf einen anderen stapeln (Solar-Sockel darunter weg), Solarpaneel beim Händler kaufen und aufs Dach ziehen.
  - ⚠️ Solar kaufen lief schon per Drag & Drop wie bei Containern (Händler liefert aufs Pad, dann aufs Dach ziehen); das Paneel war nur als namenlose Kiste zu sehen. Falls du direkt aus dem Katalog ziehen willst: sag Bescheid.
  - ⚠️ Lichterketten-Fehler war bei mir nicht nachzustellen; die Umstellung auf Bilder plus der Mischmodus-Fix sollten es lösen.

### #010 Bau-Modus mit Controller: AvA als Zeiger, UI-Grammatik, Spaß
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · erledigt (Code, 13.11.) · angelegt 13.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** `docs/features/rig.md`, `controller.md`, `ui.md`, `drone.md`
- **Auftrag (Daniel, 13.11.2026):** „Das Camp-Bau-Menü muss auch vollständig mit dem Controller bedienbar sein und soll Spaß machen … orientiere dich an den Design-Konventionen von unseren anderen Menüs.“ Antworten: linker Stick springt von Ziel zu Ziel, rechter Stick steuert frei, **„aber die Drohne ist der Zeiger“**; Kaufen liefert **aufs Pad wie bisher**; **volle UI-Grammatik** (Y = rüber: Schrottplatz, halten = verkaufen, ohne Teil = Händler; LB/RB = Bereiche; X = Kontext, X halten = rückgängig); Extras: **Vibration, Vorschau am Ziel, Kamera fährt mit, Klick-Töne**.
- **Fertig, wenn:** alles im Bau-Modus ohne Maus geht (Werkstätten, Container, Rig-Teile, Solar, Lichterketten, Händler), Hilfezeile je Lage, Tests grün.
- **Rückfragen:**
- **Ergebnis:** Details in `docs/features/controller.md` › „Bau-Modus mit Controller, AvA ist der Zeiger“. AvA fliegt als Zeiger: Der linke Stick springt von Ziel zu Ziel, mit einem Teil in der Hand nur dorthin, wo es passt; der rechte Stick fliegt frei. A packt und legt ab, B zurück/fertig, Y Schrottplatz (halten: verkaufen) bzw. Händler, X Kontextmenü (halten: rückgängig), LB/RB Bereiche mit Kamerafahrt, Händler mit Tabs, Vorschau grün/rot am Ziel, Tooltip an AvA, Hilfezeile je Lage, Vibration und Klick-Töne. Behoben: Werkstätten ließen sich auf den Platz des Cryo-Tanks tauschen. Tests: `build_pad_test` 20 (neu), `pad_test` 41, `build_test` 32 (Händler-Tabs); alle 28 Browser-Tests und `npm test` grün. PixelLab: nichts. **Bitte testen** (Stadia): Select halten, mit dem Steuerkreuz durchs Rig springen, Werkbank packen und einbauen, Y halten zum Verkaufen, X fürs Menü, RB durch die Bereiche, Lichterkette mit A, Steuerkreuz, A.
  - ⚠️ Ob der Stadia-Controller im Browser vibriert, hängt vom Browser ab (Chrome kann es meist); ohne Vibration läuft alles gleich.
  - ⚠️ Am Händler kauft A wie gewünscht aufs Pad; danach mit RB zum Schrottplatz und das Teil dort packen.

### #011 Tutorial als Feldhandbuch: Lektionen mit Clips und Slideshows
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · erledigt (Code, 13.11.) · angelegt 13.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** `docs/features/ui.md`, `controller.md`, `tests.md`
- **Auftrag (Daniel, 13.11.2026):** „Auf Basis von Screenshots ein Tutorial, das ähnlich wie bei Far Cry erklärt, wie man Dinge tut. Keine neuen Grafiken erzeugen, sondern Clips und Screenshots nutzen, um in kurzen Animationen oder Slideshows die verschiedenen Bausteine des Spiels zu erklären. Feingranulare Lektionen.“ Antworten: **beim ersten Mal als Karte + Archiv im Pause-Menü**, **gemischt** (Bewegung/Kampf/AvA als Loop-Clip, Menüs/Camp/Bauen als Slideshow), **alle ~45 Lektionen**, **Tasten je Gerät**.
- **Fertig, wenn:** Lektionen in der Werkstatt, Clips und Bilder automatisch aus dem Spiel aufgenommen, Karten beim ersten Mal, Feldhandbuch im Pause-Menü, Tests grün.
- **Rückfragen:**
- **Ergebnis:** Details in `docs/features/tutorial.md`. 53 Lektionen in 9 Kapiteln (Bereich **Lektionen**), 22 Clips und 61 Bilder, alle mit `tools/tutorial_capture.mjs` aus dem Spiel aufgenommen (Testraum, Kampfraum, Camp, Tankstelle; ffmpeg → WebM/WebP, 4,8 MB). Karte beim ersten Mal (pausiert, Neon-Glas, Clip in Schleife oder Slideshow mit Schritten), Feldhandbuch im Pause-Menü (Kapitel als Tabs), Tasten je Gerät, Optionen an/aus und „Lektionen neu zeigen“. Neue Asset-Art „Clip (Video)“ mit Vorschau in der Werkstatt. Tests: `tutorial_test` 18 (neu), alle 29 Browser-Tests und `npm test` grün. PixelLab: nichts. **Bitte testen:** neues Spiel und ein paar Minuten spielen (Karten erscheinen), Menü › Feldhandbuch durchblättern, Clips anschauen.
  - ⚠️ Auslöser je Lektion sind Vorschläge (Zeit, Hinweis, Fenster, Leyla-Zustand, AvAs Stimmung) und in der Werkstatt änderbar; zwischen zwei zeitgesteuerten Karten liegen 40 s.
  - ⚠️ Gesehen wird im Browser gespeichert (über Durchgänge und „Neues Spiel“ hinweg).
  - ⚠️ Bewegungs-Lektionen mit Implantat (Salto, Dash in der Luft) erklären das Implantat nur im Text.
  - ⚠️ „Formen und Drehen“ zeigt nur das Nehmen; das Drehen sieht man auf dem Bild kaum.

### #012 Achievements mit Trophäen-Rezepten + Rezepte automatisch lernen
- **Status:** abgenommen 13.11. (Daniel, Änderungen in #014) · fertig (Code, 13.11.) · angelegt 13.11. von Ava (Design-Session mit Daniel im Projekt-Chat)
- **Für:** Code
- **Lesen:** design.md › „Achievements & Trophäen“ und › Crafting & Kochen › „Rezepte lernen“; `docs/features/benches.md` › Schatzkammer (Ständer, Tag Trophäe); `docs/features/crafting.md` (Zettel); `docs/features/progression.md` (Durchgang, Wissen)
- **Auftrag:** Reihenfolge:
  1. **Rezepte automatisch lernen:** Zettel/Baupläne beim Einsammeln sofort ins Rezeptbuch, Meldung „📜 Rezept gelernt: *Name*“, kein Platz im Rucksack. Schnellaktion **„Lernen“** im Inventar (Maus, Tastatur, Controller) für Zettel, die schon irgendwo liegen; alte Spielstände bleiben gültig. ⚠️ vorläufig: bekanntes Rezept → Wissen (Menge in der Werkstatt).
  2. **Achievement-System:** Zähler und Ereignisse im Spielstand (`save.achievements`), Meldung „🏆 *Name*“, danach lehrt es das Rezept seiner Trophäe. Rezept einmalig herstellbar (danach im Rezeptbuch als „hergestellt“).
  3. **Bonus:** Trophäe auf irgendeinem Ständer in irgendeiner Schatzkammer im Rig → Bonus aktiv (Prozentwerte und Spezialeffekte). Keine Obergrenze; mehrere Schatzkammern müssen gehen. Holo-Schild/Leuchten am Ständer, wenn ein Bonus wirkt; Tooltip zeigt Achievement + Bonus.
  4. **Durchgang:** Achievements, deren Rezepte und Trophäen bleiben; ⚠️ vorläufig liegen die Trophäen nach dem Aufwachen in einer Erinnerungskiste am Feuer. Trophäen unverkäuflich und nicht zerlegbar.
  5. **Werkstatt-Bereich „Achievements“** (Felder siehe design.md) plus Übersicht im Pause-Menü (erreicht / offen / versteckt als „???“).
  6. **Startinhalt:** ca. 10 Achievements quer durch Kampf, Erkundung, Cosy, AvA/Tank, Story (Beispiele in design.md, Rest erfinden), je eine Trophäe mit Symbol von PixelLab (AAP-64, passend zu den Wertsachen).
- **Fertig, wenn:** Rezept einsammeln → Meldung, Rezeptbuch, Rucksack leer; Achievement auslösen → Rezept → herstellen → ausstellen → Bonus messbar; zweite Schatzkammer zählt mit; neuer Durchgang behält alles; Werkstatt-Bereich vollständig; alte Spielstände gültig; Tests grün (neuer `achievement_test`), PixelLab gemeldet.
- **Rückfragen:**
  - Startinhalt → ⚠️ vorläufig 12 Achievements (3 Kampf, 3 Erkundung, 3 Cosy, 2 AvA & Tank, 1 Story; „Ins Schwarze“ und „Lichterfest“ versteckt), Zielwerte und Boni siehe `docs/features/achievements.md`, alles in der Werkstatt.
  - „Tank kritisch“ → ⚠️ die letzte Phase (Alarm/KRITISCH) beim Run-Ende.
  - Spezialeffekte → ⚠️ Secrets schimmern pink (Bunker-Schlüsselbund), Extra-Beute als Chance auf ein Ding mehr je Beute-Wurf, „Mehr Δ“ auf die Run-Auszahlung.
  - Meldungen → ⚠️ als Toasts oben rechts (Pokal gold, Rezept cyan) statt Banner, damit sie den Kampf nicht verdecken; im Text Lucide statt Emoji.
  - Zettel einsammeln → ⚠️ alles Eingesammelte landet im Rucksack, dort wird gelernt; Zettel in Kiste/Lager über „Lernen“.
- **Ergebnis:** Details in `docs/features/achievements.md`. Neu: `game/achievements.js` (Zähler, erreichen, Boni aus allen Ständern aller Schatzkammern, Durchgang), `game/play/achievements_ui.js` (Pause-Menü › Achievements), Bereich **Achievements** in der Werkstatt, Rezept-Feld **Einmalig**, Entdecken „Achievement“, Kochen & Craften › Rezepte lernen; Zähler im Spiel (Kills mit Gegner/Familie/Waffe/Krit, Secrets, POIs mit Rang, Ernten, Kochen, Herstellen, Experimente, Zerlegen, Schlafen, Fahren, k.o., Tank, Δ, Lichterketten, Rezepte, Werkstätten, Durchgang); Boni über `applyGear`, `techtree.bonuses`, Hydrokultur, Beute, Δ, Secrets; Holo-Schild + Tooltip; Erinnerungskiste am Feuer. Symbole `icons_trophies` (12 × PixelLab, je bester von 4). Tests: `test/achievements.test.js` 7, `tools/achievement_test.mjs` 16, `npm test` 106, alle Browser-Tests grün. PixelLab: diesmal 120 Generierungen, übrig 744. Nebenbei: Lichterketten-Fix 2 (veralteter zweiter Tab überschrieb den Spielstand; Rückgängig nahm Ketten mit). **Bitte testen:** Pause-Menü › Achievements durchblättern; in der Tankstelle 25 Plünderer … (oder schneller: ein Zettel aufheben → Toast + Rezeptbuch); Trophäe an der Werkbank bauen, Schatzkammer kaufen, Trophäe auf einen Ständer → Holo-Schild + Tooltip „Bonus aktiv“.

### #013 Werkstätten mit eigener Handlung: Kochen, Werkbank (Bauplan + Teile), Drohnen, Ripperdoc, Foodtruck, Energie
- **Status:** fertig (Code, 13.11.) · angelegt 13.11. von Ava (Design-Session mit Daniel im Projekt-Chat: 1a, 2c, 3c)
- **Für:** Code
- **Lesen:** design.md › Crafting & Kochen › „Jede Werkstatt fühlt sich an wie das, was sie ist“; `docs/features/crafting.md`; `docs/features/benches.md`; `docs/features/cyberware.md`; `docs/features/drone.md`; `docs/features/ui.md` + `docs/features/controller.md` (UI-Grammatik); `docs/features/inventory.md` (Tetris-Formen)
- **Auftrag:** Jede Werkstatt-Art bekommt ein eigenes Fenster mit eigener Handlung statt des gemeinsamen Rezeptbuch-/Topf-Fensters. Bedienung überall gleich (`ui_nav.js`, Controller, Maus, Tastatur), Rezeptbuch, Zettel, Tipps und Experimentieren bleiben erreichbar (z. B. als Tab). **Kein Scheitern durch Geschick (1a):** Geschick gibt nur Bonus, Nichtstun = normales Ergebnis. Reihenfolge:
  1. **Gerüst:** Werkstatt-Art → eigene Oberfläche (Register/Plugin), gemeinsame Teile (Rezeptbuch, Vorräte, Ergebnis-Ablage, Uhr, Companion-Kommentare) wiederverwenden; Fernsteuerung `nomad.craft()` erweitern.
  2. **Kochen:** Herd mit Pfanne/Topf, Zutaten nacheinander, Gar-Balken, Rausnehmen im guten Bereich = Qualität (Stufen z. B. ok / gut / perfekt) → stärkerer/längerer Buff; Gewürze als Extra. Experimentieren als Abschmecken mit Hinweisen.
  3. **Werkbank, Waffen nach 3c:** Bauplan = Grundgerüst mit Plätzen (Lauf, Griff/Schaft, Magazin, Visier …), Teile frei einsetzen (Tetris-Stücke), Werte live; neue **Waffenteile** als Gegenstände mit Werte-Änderungen und Platz-Art; Ergebnis = **Waffen-Exemplar mit eigenen Werten** (Spielstand, Inventar-Tooltip, Kampf nutzt die Werte). Kurze Handgriffe (Schrauben, Schweißen) am Ende = Qualitätsbonus. Andere Herstellen-Rezepte (Material, Medikit, Rig-Teile) mit einfacherem Bauplan.
  4. **Drohnenwerkstatt:** Platine/Schaltplan, Chips stecken, Kabel ziehen, Energie-Budget, AvA kommentiert (Stimmungen aus drone.md).
  5. **Ripperdoc:** OP-Ansicht, Präzisionsmoment je Implantat, gut = kleiner Bonus, Flaws nie schlimmer.
  6. **Foodtruck:** Kunden an der Theke (Bestellungen aus gekochten Gerichten), Tempo/Lieblingsgericht = Trinkgeld; ohne Eile normaler Verkauf.
  7. **Generator/Reaktor:** Regler + Lastanzeige, grüner Bereich = etwas Extra-Strom, sonst nur Flackern.
  8. **Werkstatt:** alle Werte (Gar-Zeiten, Bereiche, Bonus-Stufen, Teile-Werte, Kunden, Trinkgeld, Regler) in der Werkstatt einstellbar, neue Felder/Bereiche im Schema; Baupläne und Waffenteile als Daten.
- **Grenzen:** Gemütlich bleiben, kurze Handgriffe (Sekunden, nicht Minuten), jede Handlung lässt sich überspringen (z. B. „Schnell herstellen“ für bekannte Rezepte, normales Ergebnis). Spielstände bleiben gültig (`repairSave`; vorhandene Waffen = Exemplare mit Grundwerten). Grafik aus Code, wo es geht; PixelLab nur nach Freigabe-Regel (unter 700 vorher Daniel fragen).
- **Fertig, wenn:** jede genannte Werkstatt-Art öffnet ihr eigenes Fenster; Kochen mit Qualitätsstufen und messbar stärkerem Buff; Waffe aus Bauplan + zwei verschiedenen Teile-Sätzen ergibt zwei Exemplare mit unterschiedlichen Werten im Kampf; Drohne, Ripperdoc, Foodtruck, Energie spielbar; alles mit Controller bedienbar; Werkstatt-Bereiche vollständig; alte Spielstände gültig; `npm test` + neuer Browser-Test (`bench_ui_test`) grün; Build grün.
- **Rückfragen:**
  - Qualität speichern → ⚠️ Gerichte tragen sie im Inventar (nur gleiche Qualität stapelt), Waffen ihre Werte (`mods`), Implantate je Sorte die beste OP (`save.implantQ`).
  - Gewürze → ⚠️ machen das Gericht eine Stufe besser (verbraucht eins); Gewürze = Gewürzmischung, Chili, Sojasauce (Werkstatt).
  - Werte → ⚠️ gut/perfekt: Buff +25/+50 %, Waffe Schaden +5/+10 %, Implantat-Vorteile +10/+20 %, Lötstellen +15/+30 %; Trinkgeld 30 %, Lieblingsgericht 50 %; Regler +1 ⚡ für 12 h.
  - Drohnenwerkstatt → ⚠️ was AvA kann: Akku, Scheinwerfer, Tempo, Rettung kostet weniger, Extra-Beute; die Platine ersetzt die alte, Chips werden verbaut.
  - Foodtruck → ⚠️ verkauft im Camp (Kunden würfeln aus den Gerichten, die Leyla hat); NPCs an POIs später.
  - Abschmecken → ⚠️ Experimentieren bleibt wie es war (Tab), „Knapp daneben“ ist der Hinweis.
  - Symbole der neuen Teile/Chips → ⚠️ vorhandene Felder aus `icons_gear`, eigene Bilder bei Bedarf (PixelLab, nach Freigabe).
- **Ergebnis:** Details in `docs/features/crafting.md` › Werkstätten mit eigener Handlung. Neu: `game/stations.js` (Logik), `game/play/station_ui.js` (Herd, Bauplan, OP, Platine, Theke, Regler) im Werkstatt-Fenster; Inventar mit Qualität und Waffen-Exemplaren (`addEntry`, `slotMods`, `scene.weapon`), Essen mit Qualitäts-Bonus, Effekte der Platine in Akku/Scheinwerfer/Flug/Rettung/Beute, Extra-Strom im Rig. Werkstatt: Kochen & Craften › **Handgriffe**, Rezepte › **Oder Waffe** + **Plätze**, Gegenstände › **Waffenteil** und **Chip für AvA**; 9 Waffenteile, 4 Chips, 3 Baupläne (+ Zettel Rohrpistole), Loot und Start ergänzt. Tests: `npm test` 120, neuer `tools/bench_ui_test.mjs` 23, alle Browser-Tests grün (bench_test an das neue Drohnen-Menü angepasst). PixelLab: diesmal 0, übrig 744. **Bitte testen:** Kochnische › Bohneneintopf › Kochen (Gar-Balken im Gold treffen) und dann essen; Werkbank › Bauplan Nagelpistole mit Langem Lauf bauen, ausrüsten, Tooltip ansehen; Drohnenwerkstatt › Platine bestücken (Chips aus Drohnen-Beute); Foodtruck und Generator kaufen (Bau-Modus) und ausprobieren.

### #014 Absegnung 13.11.: Änderungen aus #003–#012
- **Status:** fertig (Code, 13.11.) · angelegt 13.11. von Code (Daniel hat die ⚠️-Punkte im Code-Chat entschieden)
- **Für:** Code
- **Lesen:** die jeweiligen Feature-Dateien (`pois.md`, `combat.md`, `achievements.md`, `ui.md`, `intro.md`, `camp.md`, `worldmap.md`, `benches.md`)
- **Bleibt wie gebaut (abgesegnet):** Start ohne Doppelsprung/Luft-Dash, Liege 900 Δ (#006); kein Warroom im Start-Rig, Techtree nur dort (#008); Ripperdoc-Liege Fassung A; Ducken als Konter (#004, wird ergänzt); Listen der 12 Achievements, 30 Implantate, 8 Marken passen erstmal; Warroom öffnet direkt die Karte; übriger Kleinkram aus #009–#011.
- **Auftrag:**
  1. **Trophäenraum (#003):** Kandidat 2 „Hall of Loot“ (`ws_treasury_cyber_candidate_2`) statt Kandidat 1 einbauen, die vier Ständer auf das Bild ausrichten.
  2. **Gefahr wirkt (#007):** höhere Gefahrenstufe eines Orts = mehr und stärkere Gegner im Run **und** bessere Beute. Werte in der Werkstatt.
  3. **Raider-Deckung (#004):** zusätzlich zum Ducken als Konter suchen Raider Deckung hinter Kisten (Schützen bevorzugt).
  4. **Alle Hinweise als Toast + Ton (#012):** Achievement- und Rezept-Toasts bekommen einen eigenen Ton; **alle** übrigen Hinweise/Banner im Spiel laufen über dasselbe Toast-System (Daniel: „stell sicher, dass alle diese Hinweise auf diese Art dargestellt werden“). Ton aus Code (`sfx.js`).
  5. **Intro (#005):** Story-Detail von Daniel: AvA lag im Klinikturm Ebene 40, weil sie als **Ersatzteillager für die Elite** gedacht war. Texte entsprechend umschreiben (Werkstatt › Intro), Rest bleibt.
  6. **Lichterketten (#008):** billiger (⚠️ vorläufig 10 Δ, Abnehmen 5 Δ zurück) und ein **Mast am Lagerfeuer** als Andockpunkt.
  7. **Zisterne (#008):** füllt sich bei Regen-Wetter deutlich schneller; Frischwasser in mehr Rezepten (Hydrokultur, Kaffee/Tee, weitere); **heilt getrunken nicht mehr**.
  8. **Reisen (#007):** Ziele über **mehrere Etappen** wählbar (Route über mehrere Straßen, Kosten summiert), unterwegs **Zwischenfälle** (z. B. Panne, Händler, Hinterhalt) als Ereignisse, in der Werkstatt einstellbar.
- **Grenzen:** Spielstände bleiben gültig; Grafik aus Code; PixelLab nur nach Freigabe-Regel.
- **Fertig, wenn:** alle 8 Punkte spielbar, Werte in der Werkstatt, `npm test` + Browser-Tests grün, Build grün.
- **Rückfragen:**
  - Lichterketten-Preis → ⚠️ 10 Δ, Abnehmen gibt die Hälfte zurück (beides in der Werkstatt).
  - Was zählt als „Hinweis“ → ⚠️ alle Meldungen und Banner werden Toasts; Schadenszahlen, Block, „+1 Ding“ beim Aufheben und Sprechblasen bleiben in der Welt, Meldungen im Bau-Modus und im Koch-Fenster bleiben in ihrem Fenster.
  - Regen → ⚠️ 30 % der Tage, 2–6 h Schauer, Zisterne 6× schneller; Gießen: +6 h Wachstum, alle 8 h.
  - Gefahr → ⚠️ je Stufe über 1: +25 % Gegner, +15 % Leben, +10 % Schaden, +20 % Extra-Beute.
  - Zwischenfälle → ⚠️ 7 Stück mit Entscheidungen; Kämpfe auf der Straße als kleines Level kommen später („Durchbrechen“ kostet Leben und gibt Beute).
- **Ergebnis:** Alle 8 Punkte gebaut, Details in den Feature-Dateien (`benches.md`, `ui.md`, `intro.md`, `camp.md`, `worldmap.md`, `combat.md`, `tests.md`) und `docs/changelog.md`. Neu: `game/rain.js`, `game/travel.js`, Werkstatt-Felder Camp › Regen, Lichterketten › Mast/Zurück, Zisterne › Bei Regen, Hydrokultur › Gießen, Reisekarte › Gefahr wirkt, Gegner › Sucht Deckung, Encounter › Entscheidungen. Nebenbei: Absturz von `achieveLater` bei frischem Spielstand behoben. Tests: `npm test` 114 grün, alle 30 Browser-Tests + `web:test` grün, Build ok. PixelLab: diesmal 0. **Bitte testen:** Schatzkammer im Bau-Modus ansehen (Hall of Loot), ein Gericht essen (Toast + Ton), Intro Panel 1, Lichterkette zum Mast ziehen, mit Warroom auf der Karte die Gefahr-Zeile lesen, ein Ziel zwei Straßen weit anfahren (Zwischenfall?), in der Tankstelle auf die Schützen hinter den Kisten achten.

### #015 Feinschliff 14.11.: Tutorial-Häkchen, Zisterne neu, keine Code-Gegner, Plaketten-Items
- **Status:** fertig (Code, 14.11.) · angelegt 14.11. von Code (Auftrag Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** `docs/features/tutorial.md`, `benches.md`, `combat.md` (Gegner-Bausatz Raider), `pois.md`
- **Auftrag:**
  1. **Tutorial:** in jeder Meldung ein Häkchen „für diese Sitzung nicht mehr“.
  2. **Zisterne:** Perspektive komplett falsch → neu, mit so wenig Generierungen wie möglich (Daniel: darf unter 700 gehen).
  3. **Keine Gegner aus Code mehr:** alle durch Gegner aus dem Baukasten (Raider) ersetzen.
  4. **Hall of Loot:** Items an den Plaketten werden zu klein dargestellt.
- **Fertig, wenn:** alle 4 Punkte spielbar, Tests grün, Build grün.
- **Rückfragen:**
  - Rattenschwarm + Wachdrohne (kein Mensch, passen nicht in den Raider-Bausatz) → ⚠️ aus allen Listen genommen, bleiben nur im Katalog für die KI-Tests; kommen zurück, wenn sie echte Grafik haben.
  - Schleimbeißer als Lauerer → ⚠️ Raider hängt kopfüber unter der Decke (Ducken-Pose gespiegelt) und lässt sich fallen.
  - „Sitzung“ → ⚠️ dieser Browser-Tab (`sessionStorage`), nach dem Schließen kommen die Karten wieder.
- **Ergebnis:** Commits `393151a` (Tutorial-Häkchen), `15c02cf` (Gegner), `7cb9438` (Hall of Loot), `ce741b3` + Folge (Zisterne, Feldhandbuch-Bilder). Tests: `npm test` 120, alle 32 Browser-Tests grün. PixelLab: diesmal 19 (10 verworfen: Referenz in alter Perspektive wurde kopiert; 9 mit `view: side` sitzt), übrig 725. **Bitte testen:** eine Lektion mit Häkchen wegklicken; Bunker/Ministerium: keine Drohnen/Ratten mehr, Hausmeister als großer Raider; Schatzkammer mit Trophäen füllen; Zisterne im Rig.

### #016 Flow & Kohärenz: Losziehen, Spannungskurve, roter Faden, Gangs, Tutorial im Run
- **Status:** abgenommen 15.11. (Daniel, Änderungen in #025) · fertig (Code, 14.11.) · angelegt 14.11. von Code (Analyse Ava, Daniel hat ausgewählt)
- **Für:** Code
- **Lesen:** `worldmap.md`, `pois.md`, `progression.md`, `ui.md`, `tutorial.md`, `combat.md`
- **Befund (Durchspielen 14.11.):** Bis zum Run vier Eingaben (Van → Menü → Karte, Nachbarort vorgewählt, „Hier plündern“ versteckt); Camp-Vorbereitung im Run unsichtbar; Gegner in der Tankstelle gleichmäßig alle 300–600 px (kein Rhythmus); Suche nach AvAs Heilmittel im Spiel kaum sichtbar; im Run zwei Δ-Anzeigen und die Camp-Leiste; POIs ohne eigene Gegner-Identität, Hausmeister ohne Boss-Verhalten; Lektionen pausieren auch im Run.
- **Auftrag:**
  1. **Losziehen in einem Schritt:** Van-Tür öffnet direkt die Karte, aktueller Ort vorgewählt, „Hier plündern“ als Hauptaktion.
  2. **Loadout-Check** neben „Hier plündern“: Buffs, Heilzeug, freier Rucksack, Rettungsfach, Gefahr.
  3. **Spannungskurve im Level:** Raum-Bausteine mit Intensität (Ruhe / Kampf / Arena / Belohnung), Verschweißen folgt einer Kurve, Werte in der Werkstatt.
  4. **Roter Faden:** Zielzeile „AvA braucht … · Ort“ im HUD und auf der Karte, Fortschritt nach dem Run (Daniel: „Den roten Faden bitte auch mit aufnehmen“).
  5. **Run-HUD aufräumen:** im Run nur Run-Werte, keine zweite Δ-Anzeige, keine Camp-Leiste.
  6. **Orte mit eigener Gang + Boss:** feste Gang-Farbe/Köpfe je POI, Hausmeister mit eigenem Boss-Verhalten.
  7. **Tutorial im Run nicht modal:** Lektionen im Run als Ecken-Tipp, modal nur im Camp.
  8. **Questlog** (Daniel, 14.11.: „Wir brauchen eine Art Questlog! Nimm das mit auf“; Antworten: Hauptquest Heilmittel + AvAs Tank als Dauerauftrag + Nebenaufträge; öffnen am Warroom und am Lagerfeuer; verfolgte Quest selbst wählbar, der schwache Tank geht vor).
- **Bleibt:** Start mit 40.000 Δ (zum Testen, Daniel 14.11.). Beute-Bilanz am Run-Ende: nicht jetzt.
- **Fertig, wenn:** alles spielbar, Werte in der Werkstatt, Tests grün, Build grün.
- **Rückfragen:**
  - Spannungskurve → ⚠️ vorläufig: Zufallsgegner (1) mit der Chance der Kurve, leise Räume schwächere, laute zähere Gegner, Seitenräume halb so laut; Kurven je POI in der Werkstatt.
  - Gangs → ⚠️ Gelbe Geier (Tankstelle), Neon-Ratten (Großmarkt), Rostgarde (Bunker 13), Ordnungsamt (Ministerium); nur Plünderer aus dem Bausatz tragen die Farbe.
  - Hausmeister → ⚠️ 60 % / 30 %: wütend, schneller, 2 Helfer, Bodenwellen.
  - Nebenaufträge → ⚠️ 5 Start-Aufträge von Schraube und Onkel Sung (Texte und Belohnungen frei erfunden, in der Werkstatt › Aufträge).
  - Tipp im Run → ⚠️ 9 s, unten links.
- **Ergebnis:** Commits `215264d` (Losziehen + Bereit?), `60e8bf4` (Spannungskurve), `694d2c8` (roter Faden + Run-HUD), `df6a188` (Gangs + Boss), `99efa48` (Tipp im Run), `ff88947` (Questlog). Tests: `npm test` 127, alle 32 Browser-Tests grün. PixelLab: 0. **Bitte testen:** Van-Tür → Karte („Bereit?“), Tankstelle plündern (ruhiger Start, harter Schluss, Gelbe Geier), Zielzeile oben rechts, am Lagerfeuer das Questlog (Kabelsalat annehmen, verfolgen), im Ministerium den Hausmeister unter 60 % bringen.

### #017 Beute-Bilanz, Companions mit Aufträgen, Toasts, neue Räume, Technik
- **Status:** abgenommen 15.11. (Daniel, Änderungen in #025) · fertig (Code, 14.11.) · angelegt 14.11. von Code (Daniels Auswahl aus Avas Liste)
- **Für:** Code
- **Lesen:** `progression.md` (Questlog), `camp.md`, `ui.md`, `pois.md`, `tests.md`, `backlog.md` (C8)
- **Auftrag:**
  1. **Beute-Bilanz am Run-Ende:** Rang, Δ, was neu ist (Rezepte, Techtree, Quest-Fortschritt), Knopf zur passenden Werkstatt.
  2. **Companions reden:** „Reden“ bei Schraube und Onkel Sung bietet ihre Aufträge an, nimmt sie an und ab.
  3. **Toasts weichen Fenstern aus** (Toast verdeckte „Hier plündern“).
  4. **Mehr Raum-Bausteine:** 2–3 neue Räume je POI (Code + vorhandene Kacheln, kein PixelLab).
  5. **Technik:** wackelige Prüfung „Panzerung“ stabil, lokaler Testserver stirbt nicht mehr, große Dateien (`camp.js`, `leyla.js`, `scene.js`) aufteilen.
- **Fertig, wenn:** alles spielbar, Tests grün, Build grün.
- **Rückfragen:**
  - Bilanz-Knopf → ⚠️ Reihenfolge: Auftrag abgeben > Techtree-Knoten bezahlbar > Tank unter 45 % > Werkstatt der neuen Rezepte > Questlog.
  - Companions → ⚠️ „!“ gold = Angebot, „✓“ grün = abgeben; Gespräch statt Spruch, sobald es Aufträge gibt.
  - Neue Räume → ⚠️ 9 Räume, Tankstelle jetzt 4–5 Räume pro Run.
  - Dateien aufteilen → ⚠️ als Methoden-Bündel (Mixins), Code unverändert; weitere Kandidaten später.
- **Ergebnis:** Commits `8d7cf66` (Toasts), `47b102f` (Beute-Bilanz), `ddc2899` (Companions), `02beaab` (Räume), `807315c` (Test-Runner, Panzerung), `70959f1` (Aufteilen + Tests), `9d6b751` (CLAUDE.md). Tests: `npm test` 129, **alle 32 Browser-Tests grün** mit `npm run test:browser`. Korrektur: Nach #016 hatte ich fälschlich „alle grün“ gemeldet (Filterfehler), `pad_test` und `poi_test` waren rot und sind jetzt angepasst. PixelLab: 0. **Bitte testen:** einen Run beenden (Bilanz, goldener Knopf), mit Schraube reden („!“ → Auftrag), Tankstelle mehrmals plündern (neue Räume: Waschstraße, Zapfinseln, Reifenlager mit Secret).

### #018 Symbole für die letzten 16 Dinge ohne Grafik
- **Status:** abgenommen 15.11. (Daniel, Änderungen in #025) · fertig (Code, 14.11.) · angelegt 14.11. von Code (Daniel: „Welche Gegenstände haben noch keine Grafik“ → „Ja, ein Raster“)
- **Für:** Code
- **Auftrag:** ein Symbol-Raster `icons_misc` (4 × 4 à 64 px, PixelLab, Stil wie `icons_treasure`, AAP-64) für Glühbirne, Kronkorken, Stoffreste, Schrottplatte, Discokugel, Rohrbogen, Auspuffkrümmer, Teleskopantenne, T-Stück, Verkohlter Klumpen, Schrottskulptur, Hochleistungszelle, Turbinenmodul, Schockstab, Schulranzen, Wanderrucksack.
- **Rückfragen:**
  - T-Stück kam als Kreuz → per Code zum T beschnitten.
- **Ergebnis:** `icons_misc` eingebaut, alle 158 Gegenstände, 12 Waffen und 3 Rucksäcke haben jetzt eine Grafik. Tests: `npm test` 129, inventory/treasury/craft/gear grün. PixelLab: diesmal 10, übrig 708. **Bitte testen:** Kiste und Rucksack (Schulranzen-Symbol), Discokugel in der Hall of Loot.

### #019 Inventar nur noch mit Rechtecken
- **Status:** abgenommen 15.11. (Daniel, Änderungen in #025) · fertig (Code, 14.11.) · angelegt 14.11. von Code (Daniel: „Lass uns mit dem Tetris-Quatsch aufhören und auf Rechtecke beschränken im Inventar“)
- **Für:** Code
- **Ergebnis:** Formen raus aus Logik, Schema und Daten; alte Spielstände werden beim Laden entwirrt (nichts geht verloren); nebenbei verschluckte das Bündel am Van keine Dinge mehr. Tests: `npm test` 131, alle 32 Browser-Tests grün. PixelLab: 0. **Bitte testen:** Inventar öffnen, Rohrbogen/T-Stück drehen und ablegen; einen alten Spielstand laden.

### #020 Ausdauerleiste + Cyberpunk-Leisten
- **Status:** abgenommen 15.11. (Daniel, Änderungen in #025) · fertig (Code, 14.11.) · angelegt 14.11. von Code (Daniel: „Wir brauchen eine Ausdauerleiste für Dash, Slide, Doppelsprung und Nahkampf-Attacken“)
- **Für:** Code
- **Lesen:** `leyla.md`, `combat.md`, `ui.md`, `cyberware.md`
- **Auftrag (Antworten Daniel):** leer = Aktion geht nicht (Leiste blinkt, Ton); Erholung nach kurzer Pause schnell; Leiste unter der Lebensleiste, **beide Leisten im Cyberpunk-Design**; Kosten in der Werkstatt, Ausrüstung kann Max-Ausdauer und Erholung erhöhen.
- **Rückfragen:**
  - Werte → ⚠️ 100 Ausdauer; Dash 25, Slide 20, Doppelsprung 25, Hieb 12, schwerer Hieb/Abschluss 28; Pause 0,6 s, dann 55/s (in der Werkstatt).
  - Aufgeladener Hieb ohne genug Ausdauer → ⚠️ wird ein leichter Hieb statt gar nichts.
  - Noch keine Implantate/Essen mit den neuen Werten; die Werte „Ausdauer“ und „Erholung“ stehen bereit (Gegenstände › Ausrüstung).
- **Ergebnis:** Ausdauer in Leyla, Kosten an Dash/Slide/Doppelsprung/Hieben/Kombo, Leisten im Cyberpunk-Look (Leben mit Nachzieh-Balken). Tests: `npm test` 131, alle Browser-Tests grün (`game_test` 52). PixelLab: 0. **Bitte testen:** viermal hintereinander dashen (der vierte geht nicht, Leiste blinkt), eine volle Kombo + gleich noch eine.

### #021 EKG-Linie, Reisebild für Zwischenfälle, englische Ortsnamen
- **Status:** abgenommen 15.11. (Daniel, Änderungen in #025) · fertig (Code, 14.11.) · angelegt 14.11. von Code (Daniel im Code-Chat)
- **Für:** Code
- **Auftrag:** 1) EKG-Linie in der Lebensanzeige. 2) Ein generisches Reisebild für die Zwischenfälle unterwegs, ähnlich den Intro-Panels (PixelLab, Daniel: „nutze bis 30 Credits dafür“, freigegeben unter der 700er-Grenze). 3) Alle Ortsnamen cooler und auf Englisch.
- **Rückfragen:**
  - Namen → ⚠️ Mile 7 Gas & Go, Delta South Megamall, Deadlock Bunker 13, Ministry of Order, dazu englische Muster, Wörter und Regionen (Liste in `worldmap.md`). Gang-Namen, Marken und Kartentitel bleiben vorerst deutsch.
  - Reisebild → ⚠️ ein Bild für alle Zwischenfälle (25 von 30 freigegebenen Generierungen).
- **Ergebnis:** EKG-Linie über der Lebensleiste; Reisebild `travel_road` oben in jedem Zwischenfall; englische Ortsnamen, alte Spielstände werden umbenannt. Nebenbei: `cozy_test` war wetterabhängig (Regen füllt die Zisterne schneller), jetzt trocken geprüft. Tests: `npm test` 132, alle 32 Browser-Tests grün. PixelLab: diesmal 25, übrig 683 (unter 700: ab jetzt wieder vorher fragen). **Bitte testen:** wenig Leben (EKG rast), weit fahren bis zum Zwischenfall (Bild), Karte ansehen.

### #022 Mega-Rigs: Baukasten + begehbarer Prototyp (LKW, Crawler, Fatbird)
- **Status:** abgenommen 15.11. (Daniel, Änderungen in #025) · fertig (Code, 15.11.) · angelegt 14.11. von Code (Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** design.md › Endgame-Zugmaschinen, Mega-Rigs aus Kachel-Sets; docs/features/megarigs.md
- **Auftrag:** Daniel per Multiple Choice: **Platz-Raster** wie die Container (Module 1/2/3, Stockwerke, Deko an Anschlusspunkten); **LKW** aus PixelLab (vorhandenes Bild, „Erzeuge nichts Neues“), nur gerade rücken auf echte Seitenansicht (Daniel: „der LKW ist nicht orthogonal, das kannst du mit PixelLab beheben“), Teile aus seinem Blatt docken an; **Daten im Werkstatt-Bereich**; **Prototyp begehbar mit Leyla** als eigener Link, nicht im Menü und nicht im Spiel. Perspektive (strenge Seitenansicht) und Palette AAP-64 beachten.
- **Fertig, wenn:** eigener Link, LKW/Crawler/Fatbird umschaltbar, Leyla klettert darauf, Daten in der Werkstatt, `npm test` grün, Build grün.
- **Rückfragen:**
  - Raster-Maß → ⚠️ Platz 7 × Stockwerk 6 Kacheln, damit die Container-Bilder unverzerrt passen.
  - Wie kommt Leyla nach oben → ⚠️ Leitern automatisch (Stapel abwechselnd links/rechts, Luken in Räume, Bug/Heck vom Boden, Seilwinde beim Fatbird); kletterbare Teile (Kran, Mast, Bohrturm) haben oben einen Aussichtspunkt.
  - Crawler/Fatbird-Grafik → ⚠️ aus Code im Stil der Konzeptbilder (AAP-64), bis die Kachel-Sets kommen; Container mit leichtem Farbton je Modul wie im Konzept.
  - Fatbird → ⚠️ 3 Stufen füllen nur (Länge bleibt, „voll ist voll“): unten Lastrahmen mit Containern, darüber Deck mit Räumen, oben Gashülle mit Laufsteg.
- **Ergebnis:** Neue Bereiche **Mega-Rigs** + **Anbauteile** (RIG), `engine/megarig.js` (Raster → Layout, Erreichbarkeit), `game/play/megarig_view.js`, Seite `megarig.html` (Fahrzeug, Stufe −/+, Übersicht). Tests: `npm test` 138 (6 neu in `test/megarig.test.js`), `tools/megarig_test.mjs` 14 Prüfungen (27 Leitern bis oben). PixelLab: diesmal 9 (LKW auf Seitenansicht), übrig 674. **Bitte testen:** /megarig, alle drei Fahrzeuge, ganz nach oben klettern (Ausguck am Mast/Kran), in die Räume im Rumpf, „Übersicht“, Stufen durchschalten; in der Werkstatt RIG › Mega-Rigs ein Modul verschieben und neu laden.

### #023 Bergungsprojekte: LKW-Wrack, Crawler, Fatbird mit Quests, POIs und Teilen
- **Status:** abgenommen 15.11. (Daniel, Änderungen in #025) · fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel im Code-Chat, AFK: „Bau bitte den gesamten Themenbereich inklusive Quests und POI und Felgen mit ein“)
- **Für:** Code
- **Lesen:** design.md › Bergungsprojekt: der LKW, Endgame-Zugmaschinen; docs/features/megarigs.md › Bergungsprojekte
- **Auftrag:** Bergungsprojekte als Daten (Abschnitte mit Teilen), Wrack am gewürfelten Ort, mehrfach hinfahren, Teile aus anderen POIs, Fortschritt sichtbar, Questlog mit fehlenden Teilen und Fundorten; danach Crawler und Fatbird als große Bergungen.
- **Fertig, wenn:** LKW lässt sich vom Spielstart an bergen, Crawler/Fatbird freischaltbar, Werkstatt-Bereich, Tests grün, Build grün.
- **Rückfragen:**
  - „Felgen“ → ⚠️ als Bergungsteile gelesen (Felge, Reifen, Achse … fürs Fahrwerk). Falls Fahrzeug-Skilltrees o. Ä. gemeint war: neues Ticket.
  - Abschnitte LKW → ⚠️ Freilegen (Bordwerkzeug, Schrauben) → Fahrwerk (2 Felgen, 2 Reifen, Achse) → Motor (Motorblock, 2 Kabelbäume, Autobatterie) → Kabine & Tank (3 Schrottplatten, 2 Dieselkanister, Auspuff) → Probestart (ohne Drehzahl-Moment, kommt später).
  - Fundorte → ⚠️ LKW 1–2 Straßen vom Start, Crawler 3–4, Fatbird 3–5; Teile in den Kisten ihrer Fundort-POIs (LKW 35 %, Mega-Rigs 25 %), im Tresor sicher eins.
  - Zugmaschine tauschen → ⚠️ Werkstätten aus dem Van ziehen in freie Plätze oder auf den Schrottplatz; der LKW steht im Camp vorne (Bild gespiegelt), der Lagerplatz rückt nach rechts; der Van als Basis ist nur auf der Karte („BASIS“), noch nicht sichtbar am Ort.
  - Crawler/Fatbird freigeschaltet → ⚠️ nur `save.megarigs` + Achievement, fahren/bauen kommt mit dem nächsten Schritt (Bau-Modus, Budgets, Crew, Skilltrees).
  - Achievements → ⚠️ „Wieder auf der Straße“ (Chromfelge, +10 Leben) und versteckt „Für die 1 %“ (Logbuch der Giganten, +10 % Schaden, +5 % Krit); Trophäen-Symbole aus dem Bergungs-Raster.
- **Ergebnis:** `game/salvage.js`, `game/play/camp_salvage.js`, Bereich Bergungsprojekte, 14 Teile + 2 Trophäen + 2 Achievements, Karte, Questlog, POI-Kisten. Tests: `npm test` 145 (7 neu in `test/salvage.test.js`), `tools/salvage_test.mjs` 7, `megarig_test` 14, Camp/Bau/Karte/Spiel/Achievements grün. PixelLab: 0, übrig 674. **Bitte testen:** neues Spiel, Questlog › Der LKW verfolgen, Karte (WRACK-Marke), zum Wrack fahren, E am Wrack, Teile in Mile 7 sammeln, einbauen, Probestart → LKW vorne am Rig; danach Crawler-/Fatbird-Wrack anschauen.

### #024 Crawler und Fatbird größer, eine Etage mehr, Kabine mit Containergröße
- **Status:** abgenommen 15.11. (Daniel, Änderungen in #025) · fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** docs/features/megarigs.md › Größen
- **Auftrag:** Daniel: „Fatbird und Crawler sind ein wenig zu klein. Eine Kette sollte deutlich höher sein als Leyla. Füge beiden eine Etage hinzu. Crawler-Fahrerkabine alleine sollte Platz für mindestens einen großen Container haben als Referenz. Damit die Rigs nicht zu hoch werden, gerne länger machen.“ Der Truck passt.
- **Fertig, wenn:** Ketten deutlich höher als Leyla, je eine Etage mehr, Kabine ≥ 40-Fuß-Container, alles erreichbar, Tests grün.
- **Rückfragen:**
  - „armadillo?!“ → Daniel 15.11.: Marke der Spielwelt, der Crawler heißt weiter Crawler (#025).
  - Kabine → ⚠️ Kommandobrücke als begehbarer Raum, 3 Plätze breit, auf Deckhöhe; darunter Maschinenblock.
- **Ergebnis:** Crawler Ketten 6 Kacheln, 2 Rumpf-Etagen, Bug 24 Kacheln mit Brücke, 10 Plätze in der letzten Stufe, 3 Stockwerke obendrauf statt 4; Fatbird Lastrahmen + 2 Decks, größere Hülle, Rotoren, Cockpit. Luken führen jetzt als Schacht bis zum Deck. Tests: `npm test` 145, `megarig_test` 14, `salvage_test` 7. PixelLab 0. **Bitte testen:** /megarig Crawler und Fatbird, Übersicht, in die Brücke und die untere Rumpf-Etage klettern.

### #025 Absegnung 15.11.: Schwarzes Brett, schönere Dialoge, Armadillo, englische Gangs
- **Status:** fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel hat die ⚠️ aus #016–#024 im Code-Chat entschieden)
- **Für:** Code
- **Lesen:** docs/features/camp.md (Companions, Aufträge), docs/features/megarigs.md, docs/features/worldmap.md
- **Auftrag:** Alle ⚠️ aus #016–#024 abgenommen, dazu:
  1. **Armadillo** als Marke der Spielwelt: Crawler heißt weiter Crawler, gebaut von „Armadillo Heavy Industries“ (Schriftzug am Rumpf, Beschreibung).
  2. **Gangs englisch** (wie die Orte): Yellow Vultures, Neon Rats, Rust Guard, Order Office; alte Spielstände umbenennen.
  3. **Dialoge hübscher**, vorerst ohne Porträts (Daniel: „Mach das System zunächst ohne Portraits hübscher“); Platz für ein Porträt später.
  4. **Quest-Marken** sollen besser in die Spielwelt passen (statt Text-„!“/„✓“).
  5. **Schwarzes Brett am Van:** Aufträge annehmen, abgeben und Belohnungen einsammeln, zentral; bei den NPCs geht es weiter direkt. Später wird daraus eine Werkbank, die fertige Aufträge gegen noch bessere Belohnungen tauscht (Name offen, „nicht alles im Warroom abladen“).
- **Fertig, wenn:** Brett im Camp benutzbar (Tastatur + Controller), Dialog neu, Marken neu, Namen umgestellt, alte Spielstände gültig, Tests grün, Build grün.
- **Rückfragen:**
  - Porträts → Daniel: erst ohne. PixelLab „Charakter → Porträt“ kostet 15 je Figur (160 px); Feld Companions › Porträt ist schon da.
  - Wo steht das Brett → ⚠️ zwischen Van und Feuer am Lichtermast (Camp › Schwarzes Brett › Abstand −220), Schraube rückt eine Kachel nach rechts.
  - Quest-Marken → ⚠️ Papierzettel aus Code wie am Brett (goldene Nadel = neu, grüner Stempel = abgeben); in Questlog/HUD bleiben Lucide-Symbole.
  - Gespräch nach Annehmen/Abgeben → ⚠️ schließt, Antwort im Bläschen (weniger Klicks).
  - Gang-Sprüche → ⚠️ bleiben deutsch, nur die Namen englisch.
  - Werkbank aus dem Brett (fertige Aufträge gegen bessere Belohnung) → später, Name offen.
- **Ergebnis:** `game/play/camp_board.js` (Brett, Zettel, `talkOf`), Dialog- und Brett-Variante von `hud.menu` (`talk`, `board`), neue Felder Camp › Schwarzes Brett, Spiel › Dialog-Tempo, Companions › Porträt, Mega-Rigs › Hersteller. Tests: `npm test` 145, alle 34 Browser-Tests grün (`camp_test` 33 mit neuer Brett-Prüfung), `web:test` grün, `ng check` stimmig. PixelLab: 0, übrig 674. **Bitte testen:** Camp, E am Brett (Zettel durchblättern mit Pfeilen/Steuerkreuz, annehmen, später abgeben), mit Schraube und Onkel Sung reden (neuer Dialog), Zettel über den Köpfen; /megarig Crawler (Schriftzug am Bug); Mile 7 betreten (Banner „Revier: Yellow Vultures“).

### #026 Kachel-Sets für Crawler und Fatbird (PixelLab, max. 100)
- **Status:** abgenommen (19.11., #076) · fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** design.md › Mega-Rigs aus Kachel-Sets, Konzeptbilder; docs/features/megarigs.md
- **Auftrag:** Daniel: „Bitte nutze max 100 Generierungen auf Tilesets für die Mega-Rigs. Wichtig ist, dass sie wirklich cool aussehen (orthogonal!), das ist die maximale Belohnung für den Spieler. Aber versuche auch, das so ökonomisch wie möglich zu machen. Wichtig ist auch, dass die Dinger trotz des Gameplays nicht aussehen wie Boxen. Orientiere dich an den Konzept-Grafiken für die Kontur.“
- **Fertig, wenn:** Crawler und Fatbird aus PixelLab-Bausteinen (Bug, wiederholbare Mittelstücke, Heck, Fahrwerk/Rotoren), streng von der Seite, AAP-64, Kontur wie im Konzept, alle Stufen wachsen nahtlos, Leyla kommt überall hin, Tests grün, ≤ 100 Generierungen.
- **Rückfragen:**
  - Räume vs. Außenhaut → ⚠️ Schnittzeichnung: Haut geschlossen, über jedem Raum blendet sie aus, wenn Leyla drin ist (Raum öffnet sich nur von innen).
  - Gashülle → ⚠️ aus Code als Pixel-Art statt PixelLab (Budget, und das Konzept zeigt keine Hülle).
  - Pixelgröße → ⚠️ Teile leicht unterschiedlich groß skaliert (Bug ≈ 5,9, Mitte 4, Heck 7), damit Kontur und Raster passen; scharf skaliert.
  - Kabinendach → ⚠️ beginnt hinter der schrägen Nase (`hull.cabInset` 8), Laufsteg über dem schrägen Heck.
- **Ergebnis:** 8 Teile in `assets/vehicles/megarig/` (+ `source/`), Bereich Mega-Rigs › Kachel-Set, `crawlerSkin`/`airshipSkin`/`envelopePixels`/`cover` in `megarig_view.js`, `tools/megarig_tiles.py`. Tests: `npm test` 145, alle 34 Browser-Tests grün (`megarig_test` 14, `salvage_test` 7), `ng check` stimmig. PixelLab: diesmal 85, übrig 589 (unter 700). **Bitte testen:** /megarig Crawler und Fatbird in allen Stufen, „Übersicht“, in die Kommandobrücke und die Rumpf-Räume klettern (Haut blendet aus), am Heck aufs Deck; im Camp das Crawler-Wrack.

### #027 Mega-Rigs aufräumen: Querschnitt, Laufwege, feinere Grafik, LKW mit Container-Anhängern
- **Status:** abgenommen (19.11., #076) · fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel im Code-Chat)
- **Für:** Code
- **Lesen:** docs/features/megarigs.md
- **Auftrag:** Daniel: „Passe bitte die Räume und die Kacheln so an, dass es weniger Durcheinander wirkt. Außerdem müssen die Laufwege besser sichtbar und für den Spieler lesbar sein. Wichtig ist zunächst, dass die Fahrzeuge im Querschnitt gut aussehen, die Favela-Container-Städte bauen wir dann im zweiten Step. Ein paar der Grafiken sind sehr grob. Bitte ein wenig optimieren. Der LKW soll mit den normalen Container-Anhängern funktionieren. Da braucht es keine gesonderte Auflieger-Grafik.“ Entscheidungen: Räume bleiben zu und öffnen beim Betreten; Grafik per Code, PixelLab nur wenn es absolut nicht anders geht.
- **Fertig, wenn:** ruhigerer Rumpf, Laufwege auf einen Blick erkennbar, keine groben Riesenpixel, LKW zieht Container-Anhänger wie der Van, Tests grün.
- **Rückfragen:**
  - „Grob“ → ⚠️ EPX 2× bzw. 4× plus weiches Skalieren statt neuer PixelLab-Bilder (0 Generierungen).
  - Raumnamen → ⚠️ nur sichtbar, wenn der Raum offen ist.
  - Laufwege → ⚠️ automatisch aus dem Layout: helle Gitterkante + gelbe Endpfosten auf allem Begehbaren außerhalb von Räumen und Containern.
  - LKW → ⚠️ Bug 19 Kacheln, damit die Deichsel des Anhängers an der Kupplung hängt; leer = leeres 40-Fuß-Fahrgestell.
- **Ergebnis:** `megarig_view.js` (`epx`, `bays`, `walkways`, LKW mit `chassisPlan`), Daten LKW (Bug 19, Bett 3). Tests: `npm test` 145, alle 34 Browser-Tests grün (`megarig_test` 16 mit 2 neuen Prüfungen), `ng check` stimmig. PixelLab: 0, übrig 589. **Bitte testen:** /megarig alle drei Fahrzeuge und Stufen, Übersicht und nah ran (Bug, Heck, Fatbird-Nase), Laufwege lesen, in Räume klettern; LKW leer und beladen.

### #028 Test-Crawler mit Werkbänken und Lichterketten
- **Status:** abgenommen (19.11., #076) · fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel im Code-Chat, Geschmackstest)
- **Für:** Code
- **Auftrag:** Daniel: „Richte mal testhalber einen Crawler mit Werkbänken und Lichterketten ein.“
- **Rückfragen:**
  - Wie festlegen → ⚠️ in den Daten: Module › Werkstätten, Mega-Rigs › Lichterketten (Modul-Ecke zu Modul-Ecke); Benutzen und Bau-Modus kommen mit „Mega-Rigs fahren“.
  - Banner vor den Werkstätten → ⚠️ Wandteile blenden mit der Außenwand aus.
- **Ergebnis:** `benchesIn`, `stringLights`, Wandteile mit der Haut in `megarig_view.js`; Felder in Schema; Crawler mit 15 eingerichteten Modulen und 11 Lichterketten. Tests: `npm test` 145, `megarig_test` 16, `salvage_test` 7, `workshop_test` grün. PixelLab 0. **Bitte testen:** /megarig › Crawler › Container-Stadt, über die Dächer laufen (Lichterketten), in Container und Rumpf-Räume gehen.

### #029 Mega-Rigs fahren: Camp an Bord, Bau-Modus aufs Raster, Budgets, Reisen (Crawler + Fatbird)
- **Status:** abgenommen (19.11., #076) · fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel im Code-Chat, Multiple Choice)
- **Für:** Code
- **Lesen:** design.md › Endgame-Zugmaschinen; docs/features/megarigs.md, rig.md, camp.md
- **Auftrag:** Daniel: Mega-Rigs fahren. Entscheidungen: altes Rig fährt in die **Ladebucht** (Werkstätten ziehen in den Crawler um, Van/LKW für Orte, an die der Crawler nicht hinkommt); erster Schritt mit **Camp an Bord, Bau-Modus aufs Raster, Budgets, Reisen**; **Crawler und Fatbird zusammen**; **Crew erstmal ohne**.
- **Plan:** 1) Logik `game/mega.js` (Umzug, Rasterpositionen, Budgets, Ausbaustufen), 2) Camp an Bord, 3) Bau-Modus aufs Raster, 4) Reisen.
- **Rückfragen:**
  - Datenmodell → ⚠️ `save.rig` bleibt die Wahrheit; Container bekommen eine Rasterposition, das Mega-Rig ist die Zugmaschine. So laufen Werkstätten, Lager, Strom, Gewicht ohne Umbau weiter.
  - Bau-Modus → ⚠️ als **Bauplan** (Fenster mit dem Raster) statt Ziehen in der Welt; die Welt baut sich beim Schließen neu auf. Bauen direkt in der Welt kann später kommen.
  - Lager des Camps → ⚠️ der Lagerplatz (Feuer, Kiste, Brett, Companions) bleibt am Boden neben dem Fahrzeug; Feuer an Deck bzw. Camp am Seil später.
  - Fatbird-Cockpit → ⚠️ noch kein begehbarer Raum: die Karte liegt am Boden unter der Nase, seine zwei Bordplätze erreicht man über die Karten-Kopfzeile.
  - „Kommt nicht überall hin“ → ⚠️ noch nicht: der Crawler ist erst einmal nur langsam und durstig. Gesperrte Straßen + Ausflüge mit dem Rig aus der Ladebucht als nächster Schritt.
  - Werte → ⚠️ Crawler 200 t Zug, 120 l/100 km, Tempo 45 %, 3 Brückenplätze; Fatbird 60 t, 60 l, 250 %, fliegt; Ausbau Crawler 6.000 Δ/12 h und 14.000 Δ/24 h.
  - Umzug zwischen Crawler und Fatbird → ⚠️ geht über die Karte, die Container stellen sich neu auf (was nicht passt, ins Lager).
- **Ergebnis:** `game/mega.js`, `game/play/camp_mega.js`, `game/play/mega_build.js`; Zugmaschinen Crawler + Fatbird, Felder Tempo/Fliegt/Mega-Rig, Ausbaustufen mit Preis und Dauer; `buildMegarig` mit eigenen Modulen. Tests: `npm test` 154 (9 neu in `test/mega.test.js`), alle 35 Browser-Tests grün (neu `mega_test` 7), `web:test` grün, `ng check` stimmig. PixelLab 0. **Bitte testen:** Spielstand mit geborgenem Crawler (oder im Menü schummeln: Konsole `save.megarigs=['crawler','fatbird']`), Karte › „Umziehen: Crawler“, an Bord herumklettern, Werkstätten benutzen, B = Bauplan, Container kaufen und stapeln, Werkstätten einräumen, Lichterketten, Ausbau kaufen; reisen; Ladebucht › zurück ins Rig.

### #030 Crawler-Heck orthogonal
- **Status:** abgenommen (19.11., #076) · fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel im Code-Chat)
- **Auftrag:** Daniel: „Das Heck vom Crawler sieht noch nicht ganz orthogonal aus.“ Befund: rechts war ein Stück Rückansicht (Grill frontal, zwei Rücklichter, Auspuffe nebeneinander). Daniel per Multiple Choice: PixelLab neu (~10).
- **Ergebnis:** neues Heck in Zielgröße, Felder Kachel-Set › Rumpf im Heck / Schräge ab; skaliert bündig vom Deck bis zur Kette. Tests: `megarig_test`, `mega_test`, `npm test` grün. PixelLab: diesmal 10, übrig 579. **Bitte testen:** /megarig Crawler, Heck in allen Stufen, über die Schräge laufen.

### #031 Container ohne Dachkante, Fatbird-Heck neu, Rotor-Halterung
- **Status:** abgenommen (19.11., #076) · fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel im Code-Chat)
- **Auftrag:** Daniel: „Wenn du jetzt noch die räumliche Kante der Container in der obersten Reihe ausblendest, so dass die Perspektive einheitlich ist, ist es perfekt. Lass uns Fatbird deshalb auch noch einmal anschauen.“ Dann per Multiple Choice: „Heck neu 10 Gen und reparier die vordere Drohnendüse. Die hängt komplett in der Luft. Das muss zumindest eine ordentliche Halterung hin.“
- **Rückfragen:**
  - Dachkante → ⚠️ bei allen Containern an Bord abgeschnitten (nicht nur oberste Reihe), weil die Kante auch unten zwischen den Stapeln Draufsicht zeigt. Im Camp (Puppenhaus-Rig) bleibt sie.
  - Halterung → ⚠️ beide Rotoren: zwei Fachwerk-Träger in den Rumpf + Pfosten aufs Deck, aus Code.
- **Ergebnis:** `megarig_view.js` (`setCrop`, `pylon`, `post`, Heck-Ausrichtung), Felder Kachel-Set › Heck-Zeile, Heck beginnt vor dem Ende, Triebwerk-Glühen. Tests grün. PixelLab: diesmal 10, übrig 569. **Bitte testen:** /megarig Fatbird und Crawler, Container-Dächer, Rotoren, Fatbird-Heck.

### #032 Container sauber gestapelt, Träger über die ganze Länge
- **Status:** abgenommen (19.11., #076) · fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel im Code-Chat)
- **Auftrag:** Daniel: „Sortieren wir noch den Container-Stapel auf dem Crawler so, dass sie nicht mehr ineinander reichen, sondern sauber gestapelt sind. Lass die Halterungsträger doch über die gesamte Länge laufen. Das gibt einen industriellen Look.“
- **Rückfragen:**
  - Ursache → Container-Bilder waren 8 statt 6 Kacheln hoch und 9,3 statt 7 breit. ⚠️ Jetzt genau eine Zelle; der Laufsteg auf dem Dach liegt eine Kachel über dem Bild und steht deshalb auf Stelzen.
- **Ergebnis:** `megarig_view.js` (Maßstab, Stelzen, `airshipTruss`, `clamp`). Tests: `npm test` 154, `megarig_test` 16, `mega_test` 7, `salvage_test` 7. PixelLab 0. **Bitte testen:** /megarig Crawler (Container-Stadt) und Fatbird.

### #033 Werkstätten mit Grafik, Heavy-Duty, Auftragsraum, echte Waffenkammer, Synergien
- **Status:** abgenommen (19.11., #076) · fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel im Code-Chat)
- **Für:** Code
- **Auftrag:** Daniel: „Die vier, die du genannt hast (Kühlraum, Motorraum, Zelle, Reaktor) + Heavy Duty + Aufträge (schwarzes Brett als Werkbank, ähnlicher Raum). Wichtig ist die orthogonale Betrachtung. Dazu noch eine echte Waffenkammer mit Display-Boards analog zur Loot-Kammer. Dann ist die aktuelle Waffenkammer eher die Werkbank dazu. Parallel kannst du ein System ersinnen, wie man Synergien zwischen nebeneinander platzierten Werkbänken schaffen kann.“ PixelLab freigegeben (~75). Nachtrag Daniel: Kühlraum „Perspektive etwas zu gewagt“ → neu (10). Synergien: „wie bei Civilization oder Dorfromantik: wenn in allen verfügbaren angrenzenden Slots passende Werkstätten sind, maximaler Bonus, sonst weniger“.
- **Rückfragen:**
  - Heavy-Duty → ⚠️ Funktion „Fahrzeuge“: stellt alle Rig-Teile her (zusätzlich zur Werkbank); Skilltrees später.
  - Auftragsbüro (Name offen) → ⚠️ E öffnet das Schwarze Brett; Tausch fertiger Aufträge später.
  - Alte Waffenkammer → ⚠️ heißt Waffenwerkbank (ID bleibt), bleibt Lager für Waffen und Teile; Waffen-Rezepte später.
  - Neue Waffenkammer → ⚠️ ID `waffengalerie`, 3 Boards + Vitrine nehmen Waffen, Kiste für Waffenteile, Maßstab 78 %.
  - Synergien → ⚠️ Nachbarn = links/rechts/darüber/darunter, über Containergrenzen; Rand zählt nicht dagegen; 13 Werkstätten mit Paaren; drei Wirkungen (schneller, Strom, Buff). Gegenpaare noch nicht.
- **Ergebnis:** 7 Bilder (Kühlraum im zweiten Versuch), Werkstätten `heavy_duty`, `auftragsbuero`, `waffengalerie`, Ständer › Nimmt, `game/synergy.js` + Anbindung in Crafting, Garten, Budget, Schlafen/Ausruhen, Links im Camp. Tests: `npm test` 159 (5 neu), alle 35 Browser-Tests grün. PixelLab: diesmal 85, übrig 484. **Bitte testen:** neue Werkstätten im Bau-Modus kaufen und platzieren, Waffen an die Boards der Waffenkammer hängen, Auftragsbüro benutzen, Werkbank neben Generator stellen (Leuchtlinie, Hinweis „Synergie“), Kühlraum ansehen.

### #034 Synergie-Vorschau, Reihenschaltung, Leitern
- **Status:** abgenommen (19.11., #076) · fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel im Code-Chat)
- **Für:** Code
- **Auftrag:** Daniel: „Die Vorschau ist eine gute Idee, nimm die bitte direkt als Nächstes dran. Füge auch eine Form von Synergie mit ein, die bei wenigen Werkstätten eine Reihenschaltung belohnt (Farm, Reaktor, Zelle …): mehr als 1 und ganzer Container selber Typ = dicker Bonus. Nimm auf die Todo-Liste auch Grafiken für evolutionierte Werkstätten mit auf. Und lass bitte ein paar Leitern erzeugen, damit wir endlich hübsche Leitern haben: mit Anfang, Ende, kaputtem Segment und so, dass man sie bei Bedarf im Code einfärben kann. Denk bitte dringend an die orthogonale Perspektive.“
- **Rückfragen:**
  - Reihenschaltung → ⚠️ Hydrokultur, Reaktor, Generator, Zelle; Reihe zählt waagrecht, auch über die Containergrenze; Zelle hat noch keine Wirkung.
  - Leitern → ⚠️ zwei Varianten erzeugt (Stahl, Käfig), Käfig verworfen (unruhig, Mittelstange); eine Leiter für alles, Seilwinde des Fatbird rostfarben eingefärbt.
  - Evolutionierte Werkstätten → in `backlog.md` › B.
- **Ergebnis:** `synergy.js` (Reihe, voller Container, `preview`), Bau-Modus und Bauplan mit Vorschau, `ladder_art.js`, Spiel › Leitern. Tests: `npm test` 160, alle 35 Browser-Tests grün. PixelLab: diesmal 20, übrig 464. **Bitte testen:** Bau-Modus, eine Werkstatt ziehen (Plätze zeigen ihren Bonus), drei Hydrokulturen in einen 40-Fuß-Container; Leitern im Kampfraum, im Camp-Stapel, auf den Mega-Rigs.

### #035 Leiter orthogonal, Anhänger mit Leitern
- **Status:** abgenommen (19.11., #076) · fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel im Code-Chat)
- **Auftrag:** Daniel: „Sorry, die Leiter ist nicht orthogonal. Besonders der oberste Teil. In diesem Zuge kannst du bitte auch die Treppen für den LKW-Trailer durch Leitern ersetzen.“
- **Rückfragen:**
  - Leiter → ⚠️ ohne PixelLab: Anfang und Ende aus den Holmen per Code neu gebaut (Haken und Füße waren schräg gemalt), Mitte und kaputtes Stück bleiben.
  - Trailer → ⚠️ alle Container auf dem Fahrgestell (auch der kleine im Start-Rig), nicht nur hinter dem LKW.
- **Ergebnis:** `tools/ladder_parts.py`, `camp.js` › `groundLadder`, `cozy_test` angepasst. Tests: `npm test` 160, alle 35 Browser-Tests grün. PixelLab 0. **Bitte testen:** Camp, Leiter am Anhänger hochklettern; Leitern im Kampfraum und auf /megarig.

### #036 Deko-System fürs Camp + Beispiele aus allen Paketen
- **Status:** abgenommen (19.11., #076) · fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel im Code-Chat, AFK)
- **Für:** Code
- **Auftrag:** Daniel: „Bau das Dekosystem und aus jeder deiner Pakete ein paar Beispiele. Vielleicht auch große Zelte zwischen zwei Containern? Nimm dir richtig Zeit und probiere viele Dinge aus.“ Ideen aus dem Chat: Neon/Banner am Rig, Sonnensegel, Schrott-Stillleben, Trophäen-Regal draußen, Wäscheleine, Windrad, Pflanzen, Hängematte, Graffiti, Topf überm Feuer, Kleinvieh, Wetter am Rig. Deko kostet Δ, keine Werte (einige Gemütlichkeit).
- **Rückfragen:**
  - Platzieren → ⚠️ im Bau-Modus wie alles andere (Händler › Deko → in die Hand → Ziel); Bereich „Lagerplatz“ neu.
  - Zelte zwischen zwei Containern → ⚠️ Spannstück zwischen zwei beliebigen Ankern; damit es auch frei geht: **Zeltstangen** als eigener Ankerpunkt am Boden (die Container im Rig stehen dicht).
  - Gemütlichkeit → ⚠️ stärkere Buffs beim Schlafen und Ausruhen (1 % je Punkt, bis 25 %), sonst keine Werte.
  - Hängematte → ⚠️ benutzbar: eine Stunde abhängen, heilt 15 %.
  - Wetter am Rig → ⚠️ automatisch bei Regen (Pfützen, Tropfen), kein Kaufstück.
  - Mega-Rig → ⚠️ nur Boden- und Zeltstangen-Deko, Wand/Dach später.
- **Ergebnis:** `game/decor.js`, `camp_decor.js`, `build_decor.js`, Bereich Deko (27 Stücke), Camp › Deko, Achievement „Wohnzimmer mit Aussicht“ + Trophäe. Tests: `npm test` 166 (6 neu), alle 36 Browser-Tests grün (neu `decor_test` 5). PixelLab 0. **Bitte testen:** Bau-Modus › Händler › Deko: Zeltstangen setzen und ein Zelt dazwischen spannen, Neon an einen Container, Wäscheleine zwischen zwei Ecken, Hängematte benutzen, nachts schauen (Neon, Laterne, Feuertonne, Zelt-Licht), Vogelhaus aufs Dach und zu den Krähen laufen.

### #037 Balkone, Brücken, Aussichtsturm (begehbare Deko)
- **Status:** abgenommen (19.11., #076) · fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel im Code-Chat)
- **Auftrag:** Daniel: „Balkone und Brücken auch mitdenken.“
- **Rückfragen:**
  - Wie kommt man drauf? → ⚠️ Container-Dächer im Camp sind nicht begehbar; deshalb: Balkon am Container-Ende auf Bodenhöhe (aus dem Container hinaus, bei Stapeln ohne Endwand), Brücke zwischen Ankern, dazu ein **Aussichtsturm** mit Leiter als Zugang vom Boden.
  - Schräge Brücken → ⚠️ Schrittautomatik für Deko-Wege (bis 16 px), Leylas Physik bleibt sonst unverändert.
- **Ergebnis:** Balkon, Breiter Balkon, Hängebrücke, Stahlsteg, Aussichtsturm (`camp_decor.js`: `balconyAt`, `walkZone`, `stepUpDecor`, `art_balcony/bridge/tower`), Anker `balc:`/`tower:`. Tests: `decor.test.js` 7, `decor_test` 6. PixelLab 0. **Bitte testen:** Aussichtsturm aufstellen, Balkon an einen gestapelten Container, Hängebrücke dazwischen, hinüberlaufen.

### #038 Stapel neuer POIs, auch unterirdisch und vertikal
- **Status:** abgenommen (19.11., #076) · fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel im Code-Chat)
- **Auftrag:** Daniel: „Jetzt kannst du gerne noch einen Stapel verschiedene POIs verschiedener Größe erzeugen. Gerne auch unterirdische oder insgesamt vertikale wie Hochhaus-Ruinen.“
- **Rückfragen:**
  - Abkürzung in Türmen und Tiefen → ⚠️ Schacht mit Leiter neben dem Stapel, unten eine Tür, die nur von der anderen Seite aufgeht (Turm: Schalter unten im Schacht; Tiefe: Schalter im Ausgang).
  - Abzweige im Stapel → ⚠️ Seitenräume stehen neben einem Hauptraum auf derselben Etage (statt darüber zu hängen).
  - Draußen um den Turm → ⚠️ vorerst Fels/Wand wie bei allen POIs; offene Etagen (Rohbau, Penthouse, Dachdeck, Funkmast) zeigen Himmel. Echte Luft rund um ein Hochhaus wäre ein eigenes Ticket.
  - Grafik → ⚠️ keine neuen Kachel-Sets, die Räume nutzen die vorhandenen (Ruine, Beton, Metall, Wüste, Marmor) und Stimmungen.
- **Ergebnis:** `engine/poi.js` (`buildStack`, Spiegeln, Schacht), Feld POIs › Level › Aufbau, POI-Arten Hochhaus/Untergrund mit Karten-Symbolen, 53 Raum-Bausteine (`tools/poi_rooms_038.py`, `tools/merge_rooms.mjs`), 8 POIs: Delta Heights (Turm L), P+R Delta Süd (Turm M), Funkmast KM 31 (Turm S), Metro Line 4 (Tiefe M), Storm Drain 9 (Tiefe S), Pit 6 (Tiefe XL), Delta Crude Refinery (L), Sunny Acres (S). Tests: `npm test` 170 (3 neu), Browser `poi_stack_test` 8. PixelLab 0. **Bitte testen:** Werkstatt › POIs › Delta Heights › „Im Spiel testen“: Etage für Etage hoch, oben den Tresor, dann den Schacht runter und den Schalter; Metro Line 4 und Pit 6 nach unten.

### #039 Ressourcen verdienen, Gruppen-Alarm
- **Status:** abgenommen (19.11., #076) · fertig (Code, 15.11.) · angelegt 15.11. von Code (Daniel im Code-Chat)
- **Auftrag:** Daniel wählt aus der Liste „ohne neue Assets“: Ressourcen verdienen (Kisten, Kills, Secrets, guter Rang, design.md) und Gruppen-Alarm (wer Leyla sieht, ruft die anderen).
- **Rückfragen:**
  - Kochen/Bauen farmbar? → Daniel 16.11.: jedes Herstellen gibt eine der drei Ressourcen (nach Werkstatt-Art), nicht nur das erste Mal; der Techtree wird teurer, das Nebenergebnis nicht.
  - Wer hört den Ruf? → ⚠️ nur dieselbe Familie (Plünderer rufen Plünderer, Mutanten Mutanten); Gerufene rufen erst weiter, wenn sie Leyla selbst sehen.
  - Mengen → ⚠️ Startwerte (Kiste 35 % Technik, Mutant 35 % Bio, Plünderer 20 % Technik, Secret 1–2 Wissen, Rang ab C), alles in Ranking › Ressourcen verdienen einstellbar; nach dem Anspielen justieren.
- **Ergebnis:** `game/earn.js`, Kiste/Kill/Secret/Tresor/Werkstatt verdrahtet, Felder Gegner › Ruft andere + Rufe, Spiel › Kampf › Gruppen-Alarm. Tests: `npm test` 173 (3 neu), Browser `alarm_test` 4. PixelLab 0. **Bitte testen:** einen POI spielen: Kisten und Secrets geben ab und zu Technik/Wissen, ein guter Rang Wissen in den Tresor; in Delta Heights einen Schläger auf dich aufmerksam machen und zusehen, wie die Etage zusammenläuft. In der Küche ein neues Gericht kochen: „Zum ersten Mal: +1 Bio“.


### #040 Die Karawane, Stufe 1: Crew-Kern
- **Status:** abgenommen als kleine Fassung → #085 (Daniel, 19.11.) · angelegt 16.11. von Ava
- **Für:** Code
- **Lesen:** design.md › Die Karawane: Sozialsystem (ganz), docs/crew.md (Fähigkeiten, Eigenheiten), › Endgame-Zugmaschinen (Crew), docs/features/camp.md (Companions, Schwarzes Brett, Dialog), docs/features/benches.md (Gästekoje)
- **Auftrag:**
  1. Werkstatt-Bereich **„Leute“** (ersetzt bzw. erweitert Companions): Kernfiguren (Schraube, Onkel Sung übernehmen) + Bausteine für Gewürfelte (Namen, Herkunft, Fähigkeiten, Eigenheiten mit sichtbar/verborgen und Wirkung, Gewichte). Alte Spielstände reparieren.
  2. **Rig-Moral** aus Betten, Essen, Wasser, Spaß, Sicherheit, Platz + Eigenheiten; Zielwert, Wandern pro Tag Ereignis-Zeit, Stufen (Hochstimmung … Krise) mit Wirkung nur auf Jobs (Drama kommt in Stufe 2). Alle Werte in der Werkstatt.
  3. **Aufnahme-Entscheidung**: Bewerber am Feuer (zufällig, selten) und als Zwischenfall auf der Reise; Dialog zeigt Fähigkeiten + eine Eigenheit, Aufnehmen/Ablehnen, Überbelegung erlaubt (drückt Moral). Verborgene Eigenheit deckt sich nach einigen Tagen auf.
  4. **Werkstätten-Jobs**: Person an Werkstatt einteilen, Boni nach Fähigkeit.
  5. **Crew-Fenster** (Personen, Moral mit Quellen, Fähigkeiten, Eigenheiten, Jobs), Controller-tauglich.
- **Fertig, wenn:** Bereich in der Werkstatt, `ng check` grün, Spielstände gültig (`repairSave`), eigener Test (Moral-Rechnung, Aufnahme, Aufdecken), Browser-Test fürs Crew-Fenster, Build grün auf `main`.
- **Grenzen:** keine neuen PixelLab-Grafiken ohne Daniels Freigabe (übrig 464); gewürfelte Siedler vorerst aus Code/vorhandenen Figuren.
- **Rückfragen:**
- **Ergebnis:**

## Archiv

(noch leer)

### #041 Camp-Lager zusammengelegt, Alles einlagern
- **Status:** abgenommen (19.11., #076) · fertig · angelegt 16.11. von Code (Daniels Auftrag im Code-Chat)
- **Für:** Code
- **Lesen:** docs/features/inventory.md, docs/features/benches.md (Lagerregal, Schatzkammer, Füllstand), docs/features/camp.md (Kiste)
- **Auftrag (Daniel, 16.11.2026):** „Nach einem POI im Camp soll es einen Button geben, alles Mitgebrachte einzulagern, sofern genug Lagerraum vorhanden ist. Insgesamt soll das Camp-Inventar konsolidiert einsehbar und nutzbar sein und die einzelnen Regale lediglich das Volumen bestimmen. Ausnahme sind Speziallagerungen wie Kühlen, Waffen oder Trophäen.“ Antworten: **ein großes Raster**; **Kiste im Camp und Deichselkästen fallen weg**, der **Van bekommt einen Kofferraum etwa doppelt so groß wie die Kiste**; Einlagern **teilweise** (was passt), Speziallager bekommen ihr Passendes automatisch, Knopf in der Beute-Bilanz und im Inventar.
- **Fertig, wenn:** ein Camp-Lager aus Kofferraum + Lagerregalen, Speziallager eigen, alte Spielstände verlieren nichts, Tests grün, Build grün auf `main`.
- **Rückfragen:** (Code) ⚠️ vorläufig: Kofferraum gehört zum Camp-Lager; LKW 12 × 8, Crawler 14 × 10, Fatbird 12 × 10 (sonst hätte der LKW weniger als der Van); Waffenkammer wird Speziallager (Waffen, Waffenteile bevorzugt), Kühlraum bevorzugt Gerichte + Zutaten, Schatzkammer Wertsachen; die Regalbilder zeigen den Füllstand des ganzen Camp-Lagers; Feldhandbuch-Lektion „Die Kiste“ heißt jetzt „Das Camp-Lager“ (Bilder zeigen noch die alte Kiste, Backlog C18).
- **Ergebnis:** (Code) Commit siehe Funkspruch. `npm test` 181/181, Browser 38/38 (neue Prüfungen: geschlossene Felder, Filter, Sortieren, Hecktür öffnet das Camp-Lager, Beute-Bilanz „Alles einlagern“ mit Kühlraum). PixelLab 0. **Bitte testen:** nach einem Run in der Beute-Bilanz „Alles einlagern“; E an Hecktür oder Lagerregal → ein großes Raster mit Filter-Chips und „Sortieren“; ein Regal ausbauen, wenn das Lager voll ist (geht nicht); alter Spielstand: Kisten-Inhalt liegt jetzt im Camp-Lager.

### #042 Container-Tileset neu (feiner)
- **Status:** abgenommen (19.11., #076) · fertig · angelegt 16.11. von Code (Daniels Auftrag im Code-Chat)
- **Für:** Code
- **Auftrag (Daniel, 16.11.2026):** Container, Anhänger und Camp-Boden wirken neben dem Van grob (256-px-Bilder ×4). **Neu malen mit PixelLab** (Freigabe ~20–40 Generierungen), „achte auf die orthogonale Perspektive, die Palette und darauf, dass du ein sauberes Tileset erzeugst, aus dem man Container verschiedener Größe zusammensetzen kann.“
- **Fertig, wenn:** Container 1/2/3 Plätze aus Kacheln zusammengesetzt, Pixel so fein wie der Van, AAP-64, Werkstatt-Bilder sitzen weiter im Innenraum, Tests grün.
- **Rückfragen:** (Code) ⚠️ vorläufig: nur die Container neu (offen + zu, 1/2/3 Plätze aus einem Tileset); Fahrgestell und Camp-Boden noch alt (Backlog C18, ~10–25 Generierungen, braucht Freigabe). Container stehen jetzt ×2 statt ×4 und sind etwa 6 % kleiner auf dem Schirm, Werkstatt-Maßstab in Containern 130 → 122 %.
- **Ergebnis:** (Code) Commit siehe Funkspruch. Tileset `container_tiles.png`, Werkzeug `tools/container_tiles.py`, alte Fassungen als `…_v1`. Tests grün (container_test prüft ×2). PixelLab diesmal 34 (Create Image Pro 25 + Edit Pro Flash 9), übrig 430. **Bitte testen:** Camp ansehen, Container auf/zu, Werkstätten darin (Hydrokultur, Cryo-Tank).

### #043 Dunkelheit wie The Looter
- **Status:** abgenommen (19.11., #076) · fertig · angelegt 16.11. von Code (Daniels Auftrag im Code-Chat)
- **Für:** Code
- **Lesen:** docs/features/pois.md › Nebel des Unbekannten, Licht & Atmosphäre
- **Auftrag (Daniel, 16.11.2026, Screenshot aus The Looter):** „Ich mag, wie sie mit nicht sichtbaren Bereichen umgehen. Das gibt dem Ganzen mehr Enge und Dichte.“ Antworten: **Ungesehen schwarz, Areale außerhalb des sichtbaren Bereichs auch schwarz, bereits besucht halb transparent aber auch wieder dunkel; besonders die Kacheln außerhalb des beeinflussbaren Bereichs**; Wände/Fels = **schwarze Masse** (nur die Kante zum Raum mit Textur); Rand **ausgefranst**; dazu **Vordergrund-Silhouetten** und **Raumname einblenden**.
- **Fertig, wenn:** alles einstellbar (Spiel › Nebel), Tests grün, Build grün auf `main`.
- **Rückfragen:** (Code) ⚠️ vorläufig: Werte Besucht 60 %, Kante 45 %, Masse ab 2 Kacheln, Ausfransen 70 %; die Erde unter der Straße draußen gehört zum Tunnel-Gelände und wird deshalb auch schwarze Masse (sieht nach Looter aus, sonst Masse nur in Innenräumen); Raumname nur beim ersten Betreten; Silhouetten auf jeder Bodenstrecke innen, Parallaxe nur waagrecht.
- **Ergebnis:** (Code) Commit siehe Funkspruch. `npm test` 181/181, Browser 38/38 (poi_test prüft Dunkelheit, Raumname, Silhouetten). PixelLab 0. **Bitte testen:** einen POI laufen: Räume aus der Dunkelheit geschnitten, ausgefranster Rand, Besuchtes halbdunkel, schwarze Schutt-Silhouetten vorn, Raumname beim ersten Betreten; Werte in Spiel › Nebel / Vordergrund / Raumname.

### #044 Haare färben: Leylas Signaturfarbe
- **Status:** abgenommen (19.11., #076) · fertig · angelegt 16.11. von Code (Daniels Auftrag im Code-Chat)
- **Für:** Code
- **Lesen:** docs/features/leyla.md, docs/features/combat.md › Gegner-Bausatz (Farbtausch), docs/features/camp.md › Deko, docs/features/crafting.md
- **Auftrag (Daniel, 16.11.2026):** „Wollen wir Leyla ohne neue Grafiken die Möglichkeit geben, ihre Haare zu färben?“ Antworten: **Signaturfarbe** (Haare und Outfit-Akzente teilen sich dieselben Pinktöne, beide wechseln zusammen), **Spiegel im Camp**, **Färbemittel herstellen** (finden oder kochen/herstellen, eine Packung schaltet die Farbe für immer frei), **feste Liste aus AAP-64**.
- **Fertig, wenn:** Farbtausch in allen Leyla-Animationen und im Inventar-Bild, Spiegel als Deko, Färbemittel als Gegenstände mit Rezepten und Beute, alles in der Werkstatt, Tests grün, Build grün auf `main`.
- **Rückfragen:** (Code) ⚠️ vorläufig: zehn Farben (Neonpink, Giftgrün, Neontürkis, Eisblau, Feuerrot, Kurkuma-Gold, Rost, Rußschwarz, Violett, Platin) mit Rezepten aus vorhandenen Zutaten, Violett und Platin nur als Beute; Färbemittel tragen das Bild der Sojasaucen-Flasche (keine neue Grafik); die Farbe bleibt über den Traum; AvA färbt nicht mit; der Spiegel ist Deko beim Händler (60 Δ).
- **Ergebnis:** (Code) Commit siehe Funkspruch. `npm test` 185/185, Browser 39/39 (neu `tools/mirror_test.mjs`, `test/signature.test.js`). PixelLab 0. **Bitte testen:** Spiegel im Bau-Modus kaufen und aufstellen, E: Farben; ein Färbemittel kochen (z. B. Mutantengemüse + Wasser an der Kochnische) und färben; Leyla im Camp, im Run und im Inventar ansehen.

### #045 Lore-Datenbank: Marken
- **Status:** abgenommen (19.11., #076) · fertig · angelegt 16.11. von Code (Daniels Auftrag im Code-Chat)
- **Für:** Code
- **Lesen:** docs/features/worldmap.md › Marken, docs/features/cyberware.md, docs/features/leyla.md › Signaturfarbe
- **Auftrag (Daniel, 16.11.2026):** „Lass uns die Gelegenheit nutzen, eine Lore-Datenbank in der Werkstatt anzulegen, wo wir Brands sammeln und mit sinnvollen Eigenschaften versehen können … Cyberware auf jeden Fall mitnehmen.“ Haarfarben-Marken abgesegnet (CHROMA//KILL, Kessler Kosmetik, DeltaTint, „Toxic Bloom“ …). Antworten: **eine Quelle** (Karten-Marken ziehen um, die Reisekarte liest dort), Felder **Grundlagen + Stellung in der Welt + Spielwerte** (keine Fraktion), **neue Cyberware-Hersteller + Zuordnung** der 30 Implantate.
- **Fertig, wenn:** Bereich „Marken“ in der Werkstatt, Reisekarte unverändert, Implantate und Färbemittel mit Hersteller, Spielwerte wirken, Tests grün, Build grün auf `main`.
- **Rückfragen:** (Code) ⚠️ vorläufig: 15 Marken (8 von der Karte, 3 Kosmetik, 4 neue Cyberware/Militär), Lore-Texte, Zuordnung der Implantate (Backalley Chrome 7, NeuroLux 6, Vulkan 7, Kessler 6, Ghostwire 4), Spielwerte (z. B. Kessler Q +15, Backalley Q −15); Preis wirkt nur auf Werte-Anzeigen und Aufträge (Gegenstände werden sonst nirgends verkauft); `CLAUDE.md` gekürzt (unter 20 KB).
- **Ergebnis:** (Code) Commit siehe Funkspruch. `npm test` 189/189, Browser 39/39 (neu `test/brands.test.js`, cyberware_test rechnet mit Qualität). PixelLab 0. **Bitte testen:** Werkstatt › LORE › Marken; Reisekarte sieht aus wie vorher; Tooltip eines Implantats nennt den Hersteller; Spiegel zeigt die Marken.

### #046 Marken-Logos und Markenschild im Tooltip
- **Status:** abgenommen (19.11., #076) · fertig · angelegt 16.11. von Code (Daniels Auftrag im Code-Chat)
- **Für:** Code
- **Lesen:** docs/features/lore.md, docs/features/worldmap.md › Marken
- **Auftrag (Daniel, 16.11.2026):** „In den Tooltips markierter Items gerne die Logos und Brands mit anzeigen.“ Antworten: **Logos für die sieben Marken ohne Logo mit PixelLab („dann müssen die Logos auch wirklich richtig geil werden“, max. 75 Generierungen)**, Markenschild = **Logo + Name in Markenfarbe + Slogan**.
- **Fertig, wenn:** 15 Marken mit Logo im Raster, Tooltip mit Markenschild, Werkstatt zeigt das Logo, Tests grün, Build grün auf `main`.
- **Rückfragen:** (Code) ⚠️ vorläufig: Auswahl der Logos (je bester von 16), Färbemittel ohne Marke im Namen, Tooltip-Werte mit Qualität. Beobachtung: PixelLab hat bei DeltaTint und Vulkan den Kandidatenbogen versetzt geliefert; per Code aus dem Gesamtbogen neu geschnitten (9 bzw. 8 brauchbare Kandidaten).
- **Ergebnis:** (Code) Commit siehe Funkspruch. `npm test` 190/190, Browser 39/39 (cyberware_test prüft das Markenschild, brands.test die Logos). PixelLab diesmal 70, übrig 360. **Bitte testen:** Inventar: über ein Implantat oder Färbemittel fahren; Werkstatt › Marken › Markenschild; Reisekarte unverändert.

### #047 Entities, Stufe 1: der Generator
- **Status:** abgenommen (19.11., #076) · fertig · angelegt 17.11. von Code (Daniels Auftrag im Code-Chat)
- **Für:** Code
- **Lesen:** design.md › Hacking v3: Entities, docs/features/lore.md
- **Auftrag (Daniel, 17.11.2026):** „Ich finde Namen, die nach dem Schema wie Marble Sting oder so ein wenig besser. Das hebt sie von Pokémons ab (obwohl sie im Kern genau das ja sein werden). Ich würde sagen, wir bauen ein System auf, auf dessen Basis man diese passiven Companions generieren kann.“
- **Fertig, wenn:** Werkstatt-Bereich mit Bausteinen (Namen aus zwei Wörtern, Begabungen mit Werkbank-Effekten, Macken, Wünsche, Wohnorte, Stärke) und Unikaten, Generator ohne DOM (gleicher Seed = gleiche Entities, Namen einmalig), Vorschau mit „Neu würfeln“, Tests, Build grün auf `main`.
- **Rückfragen:** (Code) ⚠️ vorläufig: 32 + 32 Namenswörter, 12 Begabungen mit Werten, 20 Macken, 12 Wünsche, 15 Wohnorte, Unikat Marble Sting (Chirurg, Kessler, Ebene 40) neben Daniels Amber Slay; 12 Entities je Durchgang. Noch kein Spiel-Effekt (kommt mit Fangen/Einzug).
- **Ergebnis:** (Code) Commit siehe Funkspruch. `npm test` 195/195 (neu `test/glitchlings.test.js`), Browser 39/39 (dabei `map_test` „Gefahr wirkt“ robust gemacht, Backlog C19 erledigt). PixelLab 0. **Bitte testen:** Werkstatt › GLITCHLINGS › Entities: Bausteine ändern, rechts „Neu würfeln“.
