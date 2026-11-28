# NomadPixel-Lernbuch: NomadGirl

Was bei Grafiken für NomadGirl funktioniert und was nicht. **Vor jedem Auftrag lesen.** Neue Einträge oben, mit Datum und Quelle (Daniels Rückmeldung oder eigene Prüfung).

## Regeln

- 28.11.2026 (Probe NomadPixel × SDXL, Stresstest Ava/UFO/Wohnzimmer, `docs/proben/2026-11-28_nomadpixel_sdxl/`): **Flache Code-Entwürfe nie flach an SDXL geben.** Mit Pixel Art XL bei Denoise 0,4–0,65 bleibt das Bild so flach wie der Entwurf (0,4 ändert fast nichts, 0,65 verliert Augen und Leitungen). Erst **vorbelichten** (Weichzeichnen ~3 px, Licht von oben links, leichtes Korn), dann Denoise ~0,6: Komposition und Figur bleiben Avas, SDXL liefert Volumen, Licht und Textur (Weg „A+“, klarer Sieger beim Porträt).
- 28.11.2026 (Probe): Formen im Entwurf müssen eindeutig sein. Der als Dreieck gezeichnete UFO-Lichtkegel wurde bei A+ zu einer Kuppelhütte; Lichtkegel lieber als weichen, hellen Verlauf anlegen.
- 28.11.2026 (Probe): Weg B (SDXL-Rohling → `fromimg` auf AAP-64 → Feinschliff) ist stark bei Szenen (Wohnzimmer, Landschaft), driftet aber inhaltlich (Strommasten verschwanden) und Gesichter werden bei 64 px fleckig. Porträts unter ~96 px brauchen echte Handarbeit an Augen, Nase, Mund; die Automatik (Mehrheitsfilter + `clean`) reicht dort nicht.
- 28.11.2026 (Probe): Nach `fromimg` hat ein SDXL-Bild schnell 30–48 Farben. Für Szenen ok, für Figuren und Symbole auf 12–20 reduzieren (`--colors`), sonst passt es nicht zum Bestand.

- 19.11.2026 (Relief-Licht, Fabrik-Objekte): Objekte ab 32 px mit `relief.py` bauen (Höhenkarte → Licht, Glanz, Schatten, Abnutzung); Kritiker: flach 2,3 → Relief 3,3–3,4. Schatten warm, Lichter zwei Stufen unter Weiß, Struktur sparsam (≤ 0,3), Abnutzung `alter` 0,6–0,9.
- 19.11.2026 (Kachel-Set Fabrik, 3 Kritiker-Runden 2,6 → 2,7 → 2,7): Code-Pixel-Art-Clutter wirkt neben dem gemalten PixelLab-Clutter (TileSet00) fremd: zu sauber, zu flach. Für Clutter, der neben dem Bestand steht, dichte gemalte Textur, kräftige Rost-Verläufe und echtes Volumen nötig; sonst lieber den vorhandenen Clutter nehmen oder PixelLab.
- 19.11.2026 (Kachel-Set Fabrik): Kacheln immer im echten Spiel vor dem Himmel prüfen (Bildschirmfoto). Die Ziegelwand verschwand zuerst im Sonnenuntergang; Wand muss sich in der Helligkeit klar vom Hintergrund absetzen.
- 19.11.2026 (Kachel-Set Fabrik): Akzentsteine (grau, sandig) höchstens ~10 % und zufällig je Stein, nie in Gruppen je Lage, sonst entstehen waagerechte Streifen im Kachelraster. Senkrechte Stahlstütze höchstens alle 4 Kacheln.
- 19.11.2026 (Fennek-Test, 3 Kritiker-Runden): Das Profil „figuren“ misst gemalte, hochaufgelöste Figuren (Leyla, Raider). Für 64-px-Pixel-Art-Tiere nicht als Maßstab nehmen; ein Wüstentier bleibt sandig hell. Figuren dunkler ziehen hat den Fennek zur „Hyäne“ gemacht.
- 19.11.2026 (Fennek-Test): Kopf, Ohren, Schwanz von Hand gestalten und am Bewegungsgerüst befestigen. Rein geometrische Köpfe verlieren den Charme.
- 19.11.2026 (Fennek-Test): Beine je auf eigener Ebene mit eigener Kontur; ferne Beine nur eine Stufe dunkler (fast schwarz verklumpt sie).
- 19.11.2026 (Fennek-Test): Fellflecken in normierten Körperkoordinaten, sonst springen sie beim Strecken.
- 19.11.2026 (Stiltest, Daniel: „etwas glatter als PixelLab“): Detail-Runde ist Pflicht; Ziel-Detaildichte wie die Küchen-Symbole 0,51–0,63 (`refcheck`).
- 19.11.2026 (Farbrampen gemessen): Holz, Stoff und Pappe sind in NomadGirl **entsättigt sandig** (Rampe sand-1: #322b28 → #fad6b8), kein kräftiges Braun. Metall = stahl-1, Fleisch = braun-1, Mutanten-Glow = türkis/grün.
- 19.11.2026 (Graustufen-Check): Nebeneinanderliegende Bauteile müssen sich in Graustufen unterscheiden (Paprika neben Fleisch war gleich hell → Paprika heller).
- 19.11.2026: Struktur (Sprenkel, Maserung) nur auf dem eigenen Material; keine Farbe in zwei Rampen, die unterschiedlich behandelt werden (Curry sprang aufs Holz über).
- 19.11.2026: Werkzeuge diagonal brauchen ≥ 25 % Füllgrad und einen kräftigen Griff (≥ 3 px), sonst wirken sie neben den bestehenden Symbolen mickrig.
- 19.11.2026: In Flüssigkeiten wenig Rauschen (Sprenkel-Dichte ≤ 0,06), Objekte darin mit dunklem Rand absetzen.

## Rückmeldungen

<!-- Claude trägt hier Daniels Rückmeldungen aus der Werkstatt ein: Datum · Auftrag · 👍/✏️ · was daraus folgt -->
