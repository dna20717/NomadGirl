# Bewegungs-Handbuch (NomadPixel)

Animationen entstehen aus **Schlüsselposen auf einem Gerüst**, nicht Frame für Frame aus Einzelteilen.
Werkzeuge: `zeichnen.bein(c, start, winkel, laengen, radien, rampe)` (Gliedmaßen aus Gelenkwinkeln),
`zeichnen.kapsel` (Rumpf, Hals, Schwanzsegmente), `pixelart.py onion` (Bewegung prüfen), `gif`.

Winkel: 0° = senkrecht nach unten, positiv = nach vorn (Blickrichtung), jedes Glied relativ zum vorigen.

## Grundregeln (immer)

1. **Erst Posen, dann Zwischenbilder.** Schlüsselposen festlegen (Kontakt, tiefster Punkt, Durchschwung, höchster Punkt bzw. Flugphasen), als Strichmännchen/Skelett rendern und als `onion` ansehen, **bevor** Fell, Kleidung oder Details kommen.
2. **Bögen:** Kopf, Hüfte, Pfoten bewegen sich auf Bögen, nicht auf geraden Linien.
3. **Volumen bleibt:** Strecken und Stauchen (±10–15 % Rumpflänge) ja, aber die Fläche bleibt ungefähr gleich.
4. **Nachschwingen:** Ohren, Schwanz, Haare, Riemen folgen dem Körper **1–2 Frames später** und schwingen über.
5. **Gewicht:** Beim Landen sinkt der Körper (1–2 px), beim Abdrücken hebt er sich. Die Bodenlinie (Füße auf Kontakt) bleibt in allen Frames auf derselben Zeile.
6. **Nah und fern:** Gliedmaßen auf der fernen Seite eine Rampenstufe dunkler und um 1 Frame phasenverschoben, damit Beine nicht verschmelzen.
7. **Silhouette in jedem Frame lesbar** (1:1 ansehen). Kein Frame darf wie ein Klumpen aussehen.
8. **Kein Flimmern:** Konturen ruhiger Teile (Kopf, Rumpfoberseite) bleiben von Frame zu Frame stabil; nur bewegte Teile ändern sich.

## Gehen, Zweibeiner (8 Frames, 8–10 fps)

| Frame | Pose | Körper (y) |
|---|---|---|
| 1 | Kontakt rechts vorn: Fersen auf, Beine maximal gespreizt | 0 |
| 2 | Tiefpunkt: vorderes Knie beugt, Gewicht übernimmt | +1 bis +2 |
| 3 | Durchschwung: hinteres Bein schwingt am Standbein vorbei | 0 |
| 4 | Hochpunkt: Standbein gestreckt, Körper oben | −1 |
| 5–8 | wie 1–4 mit anderem Bein | |

Arme gegengleich zu den Beinen, Kopf nickt minimal (0–1 px) einen Frame nach dem Körper.

## Rennen, Zweibeiner (6–8 Frames, 10–14 fps)

Vorlage 10–15°, Flugphase (kein Fuß am Boden) in 1–2 Frames, Arme angewinkelt und kräftig, Körper-Auf-und-Ab 2–3 px, Kontakt immer unter dem Körperschwerpunkt.

## Galopp, Vierbeiner wie Fuchs, Hund, Katze (8 Frames, 12–16 fps)

Hundeartige galoppieren „rotierend“ mit **zwei Flugphasen**: gestreckt (Beine weit auseinander) und gesammelt (alle Beine unter dem Bauch). Startwerte (Grad, Oberschenkel/Unterschenkel; Pfote leicht nach vorn abknicken):

| Frame | Phase | Hinterbein | Vorderbein | Rumpflänge | Rücken | y |
|---|---|---|---|---|---|---|
| 1 | gestreckte Flugphase | −50 / +20 | +55 / −10 | 1,12 | leicht durchhängend | −2 |
| 2 | Vorderpfote landet | −30 / +30 | +20 / 0 | 1,05 | gerade | 0 |
| 3 | Vorderbein trägt, Hinterbein schwingt vor | −5 / +40 | −5 / +10 | 0,98 | gerade | +1 |
| 4 | Vorderbein drückt ab | +25 / −10 | −35 / +25 | 0,90 | leicht rund | 0 |
| 5 | gesammelte Flugphase | +45 / −40 | −25 / +80 | 0,85 | rund gekrümmt | −2 |
| 6 | Hinterpfote landet | +35 / −15 | −10 / +70 | 0,90 | rund | 0 |
| 7 | Hinterbein trägt, Vorderbein greift aus | +5 / 0 | +30 / −20 | 0,98 | gerade | +1 |
| 8 | Hinterbein drückt ab | −25 / +15 | +50 / −15 | 1,08 | gestreckt | −1 |

Ferne Beine: dieselben Winkel einen Frame früher, eine Stufe dunkler. Kopf bleibt fast ruhig (Gegenbewegung zum Rumpf, max. 1 px), Ohren und Schwanz schwingen 1–2 Frames nach. Rumpf: zwei Kapseln (Brust, Becken) mit Abstand = Rumpflänge, Rücken als Bogen darüber.

## Idle / Atmen (4–6 Frames, 4–6 fps)

Brust hebt sich 1 px, Schultern folgen; dazu ein seltenes Detail (Blinzeln, Ohrzucken, Schwanzwischen) als eigener kurzer Ablauf. Nicht alles gleichzeitig bewegen.

## Angriff (5–8 Frames, 12–16 fps)

Ausholen (2–3 Frames, langsam, Gewicht nach hinten) → Schlag (1 Frame, Wischspur/Schmierbild statt Zwischenpose) → Treffpunkt (1 Frame halten) → Nachschwung und Rückkehr (2–3 Frames). Timing ist wichtiger als Zahl der Frames.

## Hintergrund-Figuren (Kleinvieh, Statisten)

Dunkler und gedeckter als Vordergrundfiguren (Stil-Profil „figuren“ prüfen), weniger Lichter, damit sie nicht vom Spielgeschehen ablenken. Bewegung trotzdem sauber: gerade bei kleinen Tieren fällt ein steifer Lauf sofort auf.
