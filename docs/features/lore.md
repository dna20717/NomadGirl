# Lore-Datenbank

Konzerne, Läden und Straßenmarken der Welt (Werkstatt › LORE › Marken, `data/brands.json`, #045).

- **Auftrag** (Daniel, 16.11.2026: „Lass uns die Gelegenheit nutzen, eine Lore-Datenbank in der Werkstatt anzulegen, wo wir Brands sammeln und mit sinnvollen Eigenschaften versehen können … Cyberware auf jeden Fall mitnehmen“). Antworten: **eine Quelle** (die acht Marken der Reisekarte zogen hierher, gleiche IDs), Felder **Grundlagen + Stellung in der Welt + Spielwerte** (keine Fraktion; die kommt mit dem Ruf-System der Karawane), **neue Cyberware-Hersteller** mit Zuordnung aller 30 Implantate.
- **Felder:** Marke (Name, Kurzname für `{brand}` auf der Karte, Slogan, Branche, Farbe, Lore-Text) · Stellung in der Welt (Preisklasse Billig … Elite, Sitz, Mutterkonzern, Zustand aktiv/pleite/Ruine/Untergrund, Ruf auf der Straße verhasst … Kult) · Spielwerte (Qualität %, Preis %, In der Beute %) · Auf der Reisekarte (an/aus, bei welcher POI-Art, Logo im Raster, Gewicht).
- **Spielwerte** (`game/brands.js`): Gegenstände › **Hersteller** (`brand`). **Qualität** stärkt oder schwächt die Boni ihrer Implantate (`gearStats`, Nachteile und Freischaltungen wie Doppelsprung bleiben); **Preis** = Wert ihrer Produkte (`valueOf`: Tooltip, Δ-Summen im Inventar, Aufträge an Stationen); **In der Beute** = Gewicht ihrer Produkte in Beutetabellen (`rollLoot`). Der Tooltip nennt den Hersteller („Kessler Kybernetik · Qualität +15 %“).
- **Reisekarte:** `mapConfig` holt die Marken mit „Auf der Karte“ über `mapBrands` (gleiche Form wie vorher: id, name, short, slogan, kind, icon, color, weight); Reisekarte › Plakate bleibt dort. Alte Spielstände: Plakate und Orte verweisen auf dieselben IDs.
- **Die Marken (16.11.2026):**

| Marke | Branche | Klasse | Sitz | Spielwerte | Produkte |
|---|---|---|---|---|---|
| Delta Petrol | Treibstoff | Mittel | Raffinerie-Ring | – | Karte (Tankstellen) |
| Neon-Nudel | Essen | Billig | Unterstadt | – | Karte (Märkte) |
| Kessler Kybernetik | Cyberware | Elite | Klinikturm Ebene 40 | Q +15, Preis 160, Beute 50 | Herzpumpe, Biomonitor, Kristallauge, Kinetik-Rückenmark, Federbeine Mk II, Reaktor-Herz |
| AtomCola | Getränke | Billig | Abfüllwerk Süd | Beute 120 | Karte |
| Motel Salzsee | Unterkunft | Billig | Salt Flats | – | Karte |
| Ordnungsamt Delta | Behörde | Premium | Ministry of Order | Q +5 | Karte (Ämter) |
| Krähe & Söhne Schrott | Handel & Schrott | Billig | Scrap Desert | Q −10, Preis 70, Beute 140 | Karte (Bunker) |
| Kilometerkönig | Fahrzeuge | Mittel, pleite | Highway-Depots | – | Karte (Tankstellen) |
| NeuroLux | Cyberware | Mittel | Delta Ring | – | Nachtsicht-Optik, Reflex-Booster, Blutfilter, Stoßdämpfer-Beine, Faserhaut, Heilgel-Haut |
| Vulkan Wehrtechnik | Militär | Premium | Bunkerwerk Nordost | Q +10, Preis 130, Beute 70 | Subdermale Platten, Schützenarm, Hydraulik-Arm, Presslufthammer-Arm, Panzerhaut Titan, Tunnelblick-Optik, Zielsucher-Linse |
| Backalley Chrome | Cyberware | Billig, Untergrund | Hinterhöfe der Wastelands | Q −15, Preis 60, Beute 150 | Billig-Kameraauge, Nano-Herzklappe, Sprintwaden, Dermal-Netz, Dash-Synapse, Cyberarm Mk I, Sprungfedern |
| Ghostwire | Cyberware | Premium, Untergrund | unbekannt | Q +5, Preis 120, Beute 80 | Overclock-Chip, Berserker-Chip, Klingenarm, Känguru-Beine |
| CHROMA//KILL | Kosmetik | Mittel, Untergrund | Neon-Viertel | Beute 110 | Hot Wire Pink, Toxic Bloom, Glitch Teal, Molotov Red, Ultraviolence, Hazard Orange |
| Kessler Kosmetik (Mutter: Kessler Kybernetik) | Kosmetik | Elite | Klinikturm Ebene 38 | Q +10, Preis 180, Beute 40 | Kryo Blue, Platinum Elite, Lavender Haze, Bleach Protocol |
| DeltaTint | Kosmetik | Billig | Delta-Drugstores | Q −5, Preis 70, Beute 130 | Brass Halo, Rust Belt, Blackout, Mint Static |

- **Haarfarben** (#044): Leyla › Signaturfarbe › Farben hat eine Spalte **Marke**; der Spiegel zeigt sie unter dem Farbnamen, die Färbemittel heißen „Name · Marke“ (z. B. „Toxic Bloom · CHROMA//KILL“, Daniel: „die Marken sind super“).
- ⚠️ vorläufig (Ava): Namen, Lore-Texte, Zuordnung der Implantate und alle Spielwerte. Ideen: Marken als Fraktionen im Ruf-System (design.md › Die Karawane), Logos für die neuen Marken, Händler mit Markensortiment.
