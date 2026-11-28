# Nachtschicht: Auto-Schleife für ein eigenes Trainingsset

> **Kurswechsel 28.11.2026 (Daniel: „generell auf saubere Pixel-Art trainieren ohne diesen Fokus“):** Erstes Ziel ist ein **Clean-Pixel-LoRA (px8)**: festes 8-px-Raster (1024 px = 128 Pixel), Projektpalette, keine Matschkanten, Codewort `px8`. „Sauber“ ist messbar, daher entscheidet die Prüfstraße `scripts/cleanpx.py` (Raster, Rauschen, Farben, Doppelte, mehrere Motive auf einem Bild) statt eines Geschmacks-Bewerters. Motive: `scripts/cleanpx_motive.py` (Dinge, Wesen, Figuren, Orte; markenfrei). Chargen à 100 laufen tagsüber in Abständen. Stil-LoRAs (Amber v2, später Hausstil) kommen obendrauf. Charge 1: 86/100 bestanden; Ausfälle fast nur Figuren-Sammelbögen („mehrfach“).

Stand 28.11.2026 (Daniel: „10 Bilder erzeugen, nach Qualität gewichten, 100 mal wiederholen, daraus ein eigenes Trainingsset … und das automatisieren“). Entscheidungen vom selben Tag: **eigener Stil-Bewerter**, **Ava steuert per Termin** (Claude-App auf geistopz muss offen sein), **ControlNet erst ohne**.

## Ablauf je Nacht

1. **Motivliste** (`motive.json`): 20–40 Motive je Lauf (Objekte, Figuren, Szenen) mit Prompt und Weg (A+ mit Entwurf, B ohne). Motive wechseln jede Nacht, damit das Set breit bleibt.
2. **Erzeugen** auf geistopz: je Motiv 10 Seeds (Weg A+: Entwurf vorbelichtet, Denoise 0,55–0,7 gestreut; Weg B: txt2img). Bei ~20 s je Bild sind das 10 × 100 = 1000 Bilder in gut 5,5 Stunden, also eine Nacht.
3. **Automatisch vorsortieren** (`nachtschicht.py bewerten`): Teilnoten für Raster, Palette, Farben, Volumen, Stil, Treue zum Entwurf; die besten 3 je Motiv kommen auf einen Kontaktbogen.
4. **Ava sichtet** morgens die Bögen (≈ 100 Kandidaten) und setzt `freigabe` true/false. Daniel bekommt eine Stichprobe zum Daumen-hoch.
5. **Datensatz** (`nachtschicht.py datensatz`): freigegebene Bilder + Bildunterschrift; **immer mit den echten Originalen gemischt**.
6. **Nachtrainieren** in einer eigenen Nacht, danach Stresstest (3 Standardbilder) gegen die Vorversion. Nur übernehmen, wenn besser.

## Was die Recherche sagt

- **Eigene Bilder als Trainingsdaten gehen, aber nur gemischt.** Wird ein Diffusionsmodell immer wieder nur auf eigenen Bildern trainiert („replace“), brechen Qualität oder Vielfalt nach wenigen Runden ein (Modellkollaps). Stabil bleibt es, wenn die echten Daten in jeder Runde dabei bleiben bzw. neue echte Daten nachkommen. Regel für uns: Originale immer im Set, synthetischer Anteil höchstens ~50 %, höchstens 2–3 Runden hintereinander, dann Stresstest.
- **Fertige Qualitäts-Bewerter passen nicht zu unserem Stil.** HPSv2, ImageReward, PickScore und Aesthetic Score sagen menschliche Vorlieben gut voraus, haben aber einen Schönheits-Bias: Gewollt raue oder unkonventionelle Bilder werden bestraft. Darum eigener Bewerter: Nähe zu unseren Referenzen statt „allgemein schön“.
- **Best-of-N mit Auslese** ist die einfache, bewährte Form; das Gewichten nach Präferenz (Diffusion-DPO, SPO) ist der große Bruder, aber für eine 3060 und unsere Datenmenge zu schwer. Später denkbar, wenn wir Hunderte Paare „besser/schlechter“ gesammelt haben.
- **Strukturtreue** löst man mit ControlNet (Kanten, Tiefe, Linien), nicht mit mehr Daten. Gegen „SDXL lässt Dinge weg“ ist das der stärkste Hebel (Union-Modell für SDXL, ~2,5 GB). Verschoben.

## Eichung des Bewerters (wichtig)

Erster Test 28.11. (Ava-Porträt, 5 Varianten): Die reinen Pixel-Messungen setzen den flachen Entwurf **oben** und Avas Favorit A+ **unten**. Ohne Bildmodell taugen sie nur als Filter für Kaputtes (falsches Raster, falsche Farben), nicht als Rangfolge. Darum:
- **Bildmodell nötig** für die Stil-Note: CLIP oder DINOv2 als ONNX auf geistopz ablegen, Ava holt es über die Geräte-Brücke (Dateien bis 400 MB; Pfad in `AVA_BEWERTER`). Aus der Cloud sind Hugging Face und GitHub-Downloads gesperrt.
- **Gewichte eichen**: Jede Freigabe von Ava oder Daniel ist ein Datenpunkt. Nach 2–3 Nächten die Gewichte so einstellen, dass die automatische Rangfolge die Freigaben trifft (einfache logistische Regression über die Teilnoten).

## Offen

- Bildmodell-Datei auf geistopz (Daniel lädt, Vorschlag: CLIP ViT-B/32 als ONNX in fp16, ~170 MB).
- Welcher Stil zuerst: Amber Noir v3 (NomadTape) oder ein NomadGirl-Hausstil.
