# Händler und Vorschuss

Δ verdienen ohne POI-Grind (#182, aus Feedback FB-2).

- **Anlass** (Daniel, FB-2, 23.11.2026): „Wir brauchen eine Möglichkeit Deltas zu verdienen OHNE POI zu grinden. Geld borgen beim Onkel und Items verkaufen an Schraube (viel schlechtere Preise zum Start, aber besser als nichts).“ Entscheidungen per Auswahl: „Wir brauchen ein Händler-Interface“, „Ein Fenster für alle Händler“, alle drei Bremsen, Vorschuss ohne Zinsen, „Es gibt keine Zeitkomponente, aber dafür werden so lange Dinge aus dem Run-Resultat abgezogen, bis keine Schulden mehr da sind“ → ein fester Anteil, Betrag wählbar bis zur Obergrenze.

## Händlerfenster

- **Ein Fenster für alle Händler** (`game/play/trade_ui.js`, `hud.trade`), Logik ohne DOM in `game/trade.js`. Look und Grammatik wie das Questlog: Tabs **Verkaufen | Kaufen** (Q / LB / RB / ←→), Liste mit Preis rechts, Detail mit Wert, Kurs, Sättigung. **A / E** = 1 Stück, **Y / F** (oder Shift+E) = alle, B / Esc schließt. Pausiert wie jedes Fenster.
- **Verkaufen** aus Lager, Kiste und Rucksack (`crafting.sources`), **Kaufen** in den Rucksack bzw. ins Lager (`crafting.give`). Was Leyla verkauft, legt der Händler in seine Ware (teurer zurückkaufbar).
- **Bremsen** (alle in Werkstatt › Händler):
  - **Kurs:** zahlt anfangs „Zahlt“ min % vom Wert (Schraube 35 %), je „Mehr Kurs je“ Δ Umsatz (100) 1 % mehr bis max (70 %). Der Boni-Bus „mehr Δ aus Runs und beim Verkaufen“ (`sell`) zählt obendrauf.
  - **Tageskasse:** 300 Δ pro Tag, füllt sich über Nacht; Leylas Einkäufe gehen hinein. Leer = „hat nur noch X Δ in der Kasse“.
  - **Satt bei Gleichem:** jedes verkaufte Stück desselben Dings −15 % für das nächste (bis 20 %), erholt sich +15 % pro Tag.
- **Ware:** jeden Tag 6–10 Zeilen aus der Tabelle (Chance als Gewicht, Anzahl), gewürfelt aus Händler + Tag (gleicher Tag = gleiche Ware). Verlangt „Verlangt“ % vom Wert (130 %).
- **Kauft:** Kategorien (Schraube: Schrott, Ressourcen, Bauteile, Wertsachen, Waffen- und Drohnenteile, Rüstung, Implantate); nie Gegenstände mit **Unverkäuflich** (`noSell`).
- **Öffnen:** „Reden“ mit der Figur (Händler › Figur) bietet **Handeln** an (`camp_life.js` `talk`).
- Spielstand: `save.trade[<händler>] = { day, cash, stock, sold, volume }`.

## Vorschuss

- **Bei Onkel Sung** (Wirtschaft › Vorschuss › Bei wem): „Reden“ → **Vorschuss** → 100 / 250 / 500 Δ leihen. Die Obergrenze wächst mit dem Vertrauen: jeder abbezahlte Vorschuss schaltet die nächste Zeile frei (Spalte „Ab abbezahlten Vorschüssen“). Ein Vorschuss zur Zeit, **ohne Zinsen, ohne Frist**.
- **Rückzahlung:** von jeder Run-Auszahlung gehen **50 %** (Wirtschaft › Vorschuss › Anteil je Run) an ihn, bis alles bezahlt ist (`repayFromRun` in `scene_runs.js` `endRun`; nach einem k.o. nichts). Die Beute-Bilanz zeigt „An Onkel Sung: −X Δ · noch Y Δ offen“, der Banner ebenso. Im Gespräch auch **Jetzt zurückzahlen** aus den eigenen Δ.
- **HUD:** im Camp „SCHULDEN X Δ“ neben den Δ.
- Spielstand: `save.debt = { lender, amount, taken, day } | null`, `save.debtsPaid`.

## Weitere Händler (#183)

Daniel, 23.11.2026: „Das System gefällt mir richtig gut. Lass uns direkt die anderen Händler auch einbauen.“ Auswahl: alle vier, Bau-Katalog bleibt im Bau-Modus. Händler › **Art**: Camp (Figur), Straße (aus einem Zwischenfall), Orte (Reisekarte). Schlüssel in `save.trade`: Camp = ID, Straße = `id@road` (jedes Mal frisch, kein Tageswechsel), Orte = `id@<Knoten>` (eigene Ware und Kasse je Ort).

- **Sungs Küche** (Camp, Onkel Sung): kauft Zutaten und Gerichte (40–75 %, Kasse 200 Δ), verkauft Zutaten, Gewürze, MRE. Im Gespräch „Handeln“ und „Vorschuss“.
- **Lucky Ferro** (neuer Companion, Händler, Figur aus Code in Gold, Stimme `quirlig`): Companions › **Kommt ab Tag** (3) + **Erster Satz**; beim Ankommen im Camp ab Tag 3 taucht er am Feuer auf (`crew.campArrival` → `joined`, Toast, `camp.replaceCompanions`), einmal je Durchgang (`save.met`). **Luckys Sonderangebote**: zahlt 45–80 % (Glückspilz), Kasse 450 Δ, Ware bunt (Cola, Spritzen, Waffenteile, Implantat, Wertsachen).
- **Händlerkarawane** und **Markenstand** (Straße): Ereignis-Baukasten › Antworten › **Händler**; Antwort „Den Laden ansehen“ (`laden`, Lage Karawane statt des alten „Handeln“) bzw. „Das ganze Sortiment ansehen“ (`laden_marke`, Markenstand). Die Marke kommt aus der Lage (`{brand}` im Text passt), Händler › **Ware der Marke** legt Dinge der Marke aus. Preise mit `pricing.js` (Ruf der Gang, Stimmung, Gefahr, Influencer). Beim Schließen geht die Fahrt weiter (`TradeUI.open(key, tab, { onClose })`).
- **An Orten** (Reisekarte, Knopf im Kopf an der Van-Tür und im Warroom, wo das Rig steht): Händler › **Wo**: nur an POIs, nur in Regionen, Chance je Ort (je Ort und Durchgang fest), offen tagsüber / nachts (20–5 Uhr); geschlossene sagen, wann. **Papier & Pläne** (tagsüber, 40 %: Baupläne, Zettel, Rezepte), **Schwarzmarkt** (nachts, 35 %: Waffenteile, Implantate, Spritzen; zahlt 50–70 %), **Ghostwire** (nachts, 30 %, nur Delta Ring und The Outskirts: Cyberware, Chips, Ghostwire-Ware). Preise mit Ruf der Gang des Orts und Gefahr.
- Quest-Dinge (Tag `quest`) kauft niemand.

## Fernsteuerung und Tests

`nomad.trade()` (Tab, Kasse, Kurs, Listen, letzte Meldung). Tests: `test/trade.test.js` (7; Kurs, satt, Kasse, Ware je Tag, kaufen, Kundschaft, Vorschuss-Stufen, Anteil, Zurückzahlen), `tools/trade_test.mjs` (23; #183: Sungs Küche, Lucky ab Tag 3, Papierhändler am Ort, Karawane mit Weiterfahrt; vorher: Schraube → Handeln, nur Angekauftes, E/F verkaufen, satt, pausiert, Kaufen, Esc, Sung → Vorschuss, Stufen gesperrt, HUD, zurückzahlen, Run-Auszahlung 50 % mit Bilanz).

## Offen / ⚠️ vorläufig

Zahlen (Kurs, Kasse, Sättigung, Ware, Beträge, Anteil) von Ava geschätzt; „Vertrauen“ = abbezahlte Vorschüsse bzw. Umsatz, bis es Vertrauensbäume im Spiel gibt. Mei (Sungs Ast 4 A) fehlt noch, sie braucht den Vertrauensbaum. Luckys verborgene Eigenheit „Lange Finger“ und das Glücksspiel sind noch nicht gebaut. Lucky und die Ortshändler haben Figuren aus Code bzw. keine Figur (PixelLab nur mit Freigabe).
