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

## Fernsteuerung und Tests

`nomad.trade()` (Tab, Kasse, Kurs, Listen, letzte Meldung). Tests: `test/trade.test.js` (Kurs, satt, Kasse, Ware je Tag, kaufen, Kundschaft, Vorschuss-Stufen, Anteil, Zurückzahlen), `tools/trade_test.mjs` (16: Schraube → Handeln, nur Angekauftes, E/F verkaufen, satt, pausiert, Kaufen, Esc, Sung → Vorschuss, Stufen gesperrt, HUD, zurückzahlen, Run-Auszahlung 50 % mit Bilanz).

## Offen / ⚠️ vorläufig

Zahlen (Kurs, Kasse, Sättigung, Ware, Beträge, Anteil) von Ava geschätzt; „Vertrauen“ = abbezahlte Vorschüsse bzw. Umsatz, bis es Vertrauensbäume im Spiel gibt. Weitere Händler (POIs, Mei, Ghostwire) nutzen dasselbe Fenster, sobald sie eine Figur oder einen Ort haben.
