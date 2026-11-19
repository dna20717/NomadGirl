# Kritiker-Runde (NomadPixel)

Wer selbst zeichnet, bewertet sich zu milde. Deshalb prüft vor jeder Abgabe ein **unabhängiger Kritiker**. In Claude Code ist das ein Subagent (Agent-/Task-Werkzeug) mit frischem Kontext. Er bekommt nur die Bilder, die Messwerte und diesen Bogen, keine Zeichenskripte und keine eigene Begründung.

## Ablauf

1. **Unterlagen erzeugen** (im Arbeitsordner):
   - `vergleich.png`: neue Grafik(en) neben 3–4 Referenzen derselben Kategorie aus dem Spiel, vergrößert **und** 1:1
   - `grau.png` (`analyse.py grau`), bei Animationen zusätzlich `onion.png` und den Frame-Streifen
   - Text aus `analyse.py pruefe … --profil <kategorie>`
2. **Kritiker beauftragen.** Dazu sagen, was das Spiel selbst zeichnet (z. B. Kanten, Ecken, Tiefe per Code), was gewollt ist (Material, Thema) und womit der Bestand entstand (z. B. Bildgenerator). Sonst bemängelt er Dinge, die nicht zur Aufgabe gehören. Auftrag sinngemäß:
   > Du bist ein strenger Art Director für Pixel-Art. Bewerte die NEUEN Grafiken im Vergleich zu den REFERENZEN des Spiels nach dem Bogen unten (Noten 1–5, je ein Satz Begründung). Nenne die drei wichtigsten konkreten Verbesserungen (was, wo, wie). 3 = brauchbar, 4 = gut, 5 = von den Referenzen nicht zu unterscheiden. Bilder: <Pfade>. Messwerte: <Text>.
3. **Schwelle:** jede Note ≥ 3 und Durchschnitt ≥ 4. Sonst die Verbesserungen umsetzen und erneut prüfen lassen (neuer Kritiker, höchstens 3 Runden).
4. **Bildschirmfoto im Spiel** mitgeben, wann immer möglich (Kacheln vor dem echten Hintergrund, Objekte neben dem Bestand und der Spielfigur).
5. **Ehrlich berichten:** Endnoten und offene Schwächen in der Antwort bzw. im Auftrag (`answer`) nennen. Wird die Schwelle nach 3 Runden nicht erreicht, trotzdem abgeben und klar sagen, was fehlt.

## Bewertungsbogen

| Kriterium | Was zählt |
|---|---|
| **Silhouette & Lesbarkeit** | Bei 1:1 sofort erkennbar? Klare Umrisse, kein Klumpen |
| **Form & Konstruktion** | Glaubwürdige Proportionen, Anatomie, Perspektive, Volumen |
| **Licht & Helligkeit** | Einheitliche Lichtrichtung, Graustufen lesbar, Teile heben sich ab, Helligkeit passt zum Profil |
| **Stil-Treue** | Passt neben die Referenzen: Rampen, Sättigung, Feinheit, Outline, Detaildichte |
| **Handwerk** | Saubere Kanten, keine Doppelpixel, Struktur folgt der Form |
| **Bewegung** (nur Animation) | Klare Schlüsselposen, Bögen, Gewicht, Nachschwingen, kein Flimmern, stabile Bodenlinie |
| **Wirkung** | Charakter, Charme, wirkt wie gewünscht (lecker, gefährlich, niedlich …) |
