# Tonliste (#130)

Alle Töne im Spiel, zum Abarbeiten. Daniel, 21.11.2026: „Ton bitte mit stimmungsvollen Platzhaltern besetzen und eine Liste erzeugen, in der Art des Tones und Status (Code vs. produziert) aufgelistet ist, die wir dann abarbeiten können.“

**Status:** `Code-Platzhalter` = Web-Audio-Rezept in `game/play/sfx.js` · `produziert (Datei)` = eigene Aufnahme/KI/Code-Datei unter `projects/nomadgirl/assets/` · `CC0 OwlishMedia` = die erlaubte Ausnahme (`THIRD_PARTY.md`) · `fehlt` = Ereignis und Platzhalter stehen, aber die Stelle im Code löst es noch nicht aus.
**Priorität:** A zuerst (hört man ständig), B bald, C später.

## So kommt ein produzierter Ton ins Spiel

1. Datei nach `projects/nomadgirl/assets/sound/` (.m4a + .ogg als Ersatzdatei, mono, kurz, leise abgemischt; Werkzeug und Herkunft in `docs/assets.md`).
2. Asset der Art **Ton** anlegen: `node tools/ng.js new assets sfx_hit_flesh1 '{"name":"Treffer Fleisch 1","kind":"sound","file":"assets/sound/sfx/hit_flesh1.m4a","alt":"assets/sound/sfx/hit_flesh1.ogg","volume":100,"source":"…","date":"…"}'`
3. Beim Ton-Ereignis eintragen: `node tools/ng.js set sounds hit_flesh samples '["sfx_hit_flesh1","sfx_hit_flesh2"]'` (oder Werkstatt › ASSETS › **Ton-Ereignisse** › Klang › Produziert). Mehrere Dateien = jedes Mal zufällig eine.
4. Fertig: das Spiel spielt die Datei statt des Platzhalters (Lautstärke, Tonhöhe, Schwankung und Abklingzeit des Ereignisses gelten weiter). Kein Code. Zurück zum Platzhalter: Liste leeren.

Ältere Töne (Bau-Modus, Meldungen) laufen über `makeSfx(…).name()`; ein Ereignis mit **Ersetzt Code-Ton** = `name` übernimmt sie, also gilt dort derselbe Weg.

## Effekte (Ton-Ereignisse, `data/sounds.json`)

Lautstärke aller Effekte: Spiel › **Effekte** (an/aus, Lautstärke 60 %, Menü-Töne, Schritte, Schrittlänge, höchstens 10 Töne je 80 ms). M schaltet alles stumm.

### Kampf

| Ereignis | Art | Auslöser | Status | Prio | Für die Produktion |
|---|---|---|---|---|---|
| `melee_whoosh` Hieb: Luftzug | Kampf | game/play/combat.js:59 | Code-Platzhalter (whoosh) | A | 150–200 ms, trocken, Rohrzange/Machete, 3–4 Varianten |
| `melee_whoosh_heavy` schwerer Luftzug | Kampf | game/play/combat.js:59 (schwerer Hieb, Finisher) | Code-Platzhalter (whooshHeavy) | A | tiefer, 300 ms, Gewicht |
| `hit_flesh` Treffer Fleisch | Kampf | game/play/enemies.js:497 | Code-Platzhalter (hitFlesh) | A | dumpf mit Knack, nicht splattrig, 4+ Varianten; schwer/krit lauter |
| `hit_metal` Treffer Metall | Kampf | game/play/enemies.js:496–497 (Maschinen, Panzer leicht) | Code-Platzhalter (hitMetal) | A | Blech, Schrott, rostig |
| `hit_block` Block am Schild | Kampf | game/play/enemies.js:487 | Code-Platzhalter (block) | B | Schlag auf Blechschild |
| `hit_armor` Panzerplatte bricht | Kampf | game/play/enemies.js:496 | Code-Platzhalter (armor) | B | splitterndes Metall, 400 ms |
| `melee_wall` Hieb gegen Wand | Kampf | game/play/combat.js:71 | Code-Platzhalter (wallHit) | C | Werkzeug auf Beton |
| `enemy_swing` Gegner holt aus | Kampf | game/play/enemies.js:365 | Code-Platzhalter (whoosh, 80 %) | B | gröber (Keule, Rohr) |
| `enemy_shot` Gegner-Schuss | Kampf | game/play/combat.js:180 | Code-Platzhalter (enemyShot) | A | Selbstbau-Waffe, dumpfer als Leylas Schuss |
| `enemy_death` Gegner fällt | Kampf | game/play/enemies.js:581 | Code-Platzhalter (death) | A | Körper in Schutt, zwei Aufschläge; der Schrei kommt aus den Stimmen |
| `enemy_death_machine` Maschine aus | Kampf | game/play/enemies.js:581 | Code-Platzhalter (deathMachine) | B | Funken, fallender Servo |
| `leyla_hurt` Leyla getroffen | Kampf | game/play/scene_events.js:23 | Code-Platzhalter (hurt) | A | dumpfer Schlag; Stöhnen später aus der Stimme |
| `leyla_ko` Leyla k.o. | Kampf | game/play/scene_events.js:25 | Code-Platzhalter (ko) | A | Fall + Welt dumpft weg, 1 s |
| `dry_fire` leeres Magazin | Kampf | game/play/combat.js:102 | Code-Platzhalter (dryFire) | C | Klick-Klack |
| `reload` Nachladen | Kampf | game/play/leyla_combat.js:169 | Code-Platzhalter (reload) | B | Magazin, Schlitten; später je Waffe |
| `combo_tick` Kombo-Takt | Kampf | game/play/leyla_combat.js:78 | Code-Platzhalter (tick) | C | darf synthetisch bleiben |
| Leylas Schuss | Kampf | game/play/combat.js:89, :118, :138 (Waffen › Schuss-Ton) | produziert (`sound_shot`, von Daniel) | – | je Waffe eigener Ton wäre schön (Feld gibt es schon) |

### Bewegung

| Ereignis | Art | Auslöser | Status | Prio | Für die Produktion |
|---|---|---|---|---|---|
| `step_sand` Schritt Sand | Bewegung | game/play/leyla.js:292 (Untergrund: desert, sonst überall) | Code-Platzhalter (stepSand) | A | Stiefel auf Sand, 6+ Varianten |
| `step_stone` Schritt Stein | Bewegung | game/play/leyla.js:292 (concrete, ruins, mall, bunker, marble) | Code-Platzhalter (stepStone) | B | Beton mit Splitt |
| `step_metal` Schritt Blech | Bewegung | game/play/leyla.js:292 (metal, factory, im Rig) | Code-Platzhalter (stepMetal) | B | Riffelblech, hohl |
| `step_wood` Schritt Holz | Bewegung | game/play/leyla.js:292 (noch kein Holz-Set) | Code-Platzhalter (stepWood) | C | sobald es Holzböden gibt |
| `jump` Absprung | Bewegung | game/play/leyla.js:272 | Code-Platzhalter (jump) | A | Abdruck + Kleidung |
| `jump_double` Doppelsprung | Bewegung | game/play/leyla.js:272 | Code-Platzhalter (airJump) | B | Cyberware-Schub |
| `land_soft` Landung weich | Bewegung | game/play/leyla.js:139, :279 | Code-Platzhalter (landSoft) | A | nach Fallhöhe lauter |
| `land_hard` Landung hart | Bewegung | game/play/leyla_moves.js:237 | Code-Platzhalter (landHard) | A | Aufschlag, Geröll |
| `dash` Dash | Bewegung | game/play/leyla_moves.js:18 | Code-Platzhalter (dash) | A | Luftriss, Cyber-Unterton |
| `slide` Rutschen | Bewegung | game/play/leyla_moves.js:37 | Code-Platzhalter (slide) | B | Schleifen, Länge nach Rutschdauer |
| `ladder_step` Leitersprosse | Bewegung | game/play/leyla_moves.js:84 | Code-Platzhalter (ladder) | B | Metallsprosse |
| `ladder_slide` Leiter rutschen | Bewegung | game/play/leyla_moves.js:83 | Code-Platzhalter (ladderSlide) | C | Handschuhe an Holmen |
| `ledge_grab` Kante greifen | Bewegung | game/play/leyla_moves.js:152 | Code-Platzhalter (ledge) | C | Hände packen Kante |

### Beute & Dinge

| Ereignis | Art | Auslöser | Status | Prio | Für die Produktion |
|---|---|---|---|---|---|
| `loot_pickup` Beute aufheben | Beute | game/play/scene_events.js:262, :89; game/play/inventory_ui.js:828 | Code-Platzhalter (loot) | A | Sack raschelt, Klimpern |
| `delta_pickup` Δ bekommen | Beute | game/play/scene_events.js:206 | Code-Platzhalter (delta) | A | Kronkorken/Scrip, rostig |
| `item_equip` Ausrüsten | Beute | game/play/inventory_ui.js:869, :882, :898 | Code-Platzhalter (equip) | A | Klick-Klack + Gewicht |
| `item_pick` Ding nehmen | Beute | game/play/inventory_ui.js:730 | Code-Platzhalter (itemPick) | C | kaum hörbar |
| `item_place` Ding ablegen | Beute | game/play/inventory_ui.js:771 | Code-Platzhalter (itemPlace) | C | weich |
| `crate_open` Kiste öffnen | Beute | **fehlt** – game/play/poi_level.js:285 (`openChest`) | Code-Platzhalter (crate) | A | rostiger Deckel, Riegel, 1 s |
| Laufend aufsammeln (Stapel) | Beute | **fehlt** – game/play/loot.js:144 (`if (moved)`) → `loot_pickup` | – | B | gleicher Ton |

### Umgebung

| Ereignis | Art | Auslöser | Status | Prio | Für die Produktion |
|---|---|---|---|---|---|
| `switch` Schalter / Sicherung | Umgebung | game/play/poi_level.js:221 | Code-Platzhalter (switch) | B | Kippschalter + Brummen |
| `door_open` Tür fährt auf | Umgebung | **fehlt** – game/play/poi_level.js:320 (`pull`) | Code-Platzhalter (door) | B | Servo/Rolltor 0,9 s |
| Wind (Schleife) | Umgebung | game/play/camp_life.js:12–16 (Camp › Ton) | produziert (`sound_wind`, von Daniel) | – | – |
| Böen | Umgebung | game/play/camp_life.js:108 | produziert (`sound_wind2`, `sound_wind3`, von Daniel) | – | – |
| Lagerfeuer (Schleife, nach Abstand) | Umgebung | game/play/camp_life.js:12–16 | produziert (`sound_campfire`, von Daniel) | – | – |
| Handheld am Lagerfeuer | Umgebung | game/play/camp_life.js:92–102 (Lagerfeuer › Sitzen › Töne) | CC0 OwlishMedia (20 Dateien `sfx_handheld_*`) | – | Ausnahme laut `THIRD_PARTY.md` |
| Gegner-Rufe, Gebrabbel | Stimme | game/play/voices.js, game/voice.js (#112) | Code (Stimmen-Motor) | – | docs/features/voices.md |
| Leylas Laute im Dialog | Stimme | game/play/voices.js (`leyla`) | Code | – | – |

### UI und Meldungen

| Ereignis | Art | Auslöser | Status | Prio | Für die Produktion |
|---|---|---|---|---|---|
| `ui_hover` Fokus | UI | game/play/sfx.js `installUiSounds` (Zeiger über Knopf); **fehlt** für Tastatur/Controller: game/play/hud.js:278 (`focus`) | Code-Platzhalter (uiHover) | B | winziger Tick |
| `ui_confirm` Bestätigen | UI | game/play/sfx.js (Klick); **fehlt** für E/A-Taste: game/play/hud.js:285 (`choose`) | Code-Platzhalter (uiConfirm) | B | Doppel-Klick, warm |
| `ui_back` Zurück | UI | game/play/sfx.js (Schließen, Zurück, Abbrechen) | Code-Platzhalter (uiBack) | B | fallend |
| `ui_deny` Geht nicht | UI | game/play/sfx.js (gesperrter Knopf) | Code-Platzhalter (uiDeny) | B | kurzes Summen |
| `ui_nope` Passt nicht | UI | build_mode.js, scene.js:674 (Ausdauer leer) | Code-Platzhalter (nope) | C | – |
| `jingle_quest` Auftrag erledigt | Jingle | **fehlt** – game/play/hud.js:479, game/play/camp_board.js:114 | Code-Platzhalter (jingleQuest) | A | warmes Motiv 2 s, Leyla-Theme |
| `jingle_achievement` Achievement | Jingle | Meldung „trophy“ (hud.js:20 → fanfare), z. B. scene_events.js:186 | Code-Platzhalter (jingleAchievement, ersetzt fanfare) | A | Synth-Stab mit Anlauf, 1,2 s |
| `toast_chime` Rezept gelernt | Jingle | Meldung „recipe“ | Code-Platzhalter (chime) | C | – |
| `toast_ping` Hinweis | Jingle | Meldungen „info“, „travel“, „camp“ | Code-Platzhalter (ping) | C | – |
| `toast_good` Gut | Jingle | Meldungen „good“, „heal“, „loot“ | Code-Platzhalter (good) | C | – |
| `toast_secret` Secret | Jingle | Meldung „secret“ | Code-Platzhalter (sparkle) | C | – |
| `toast_drama` Drama | Jingle | Meldung „drama“ (k.o., AvA fort) | Code-Platzhalter (low) | B | – |

### Bauen

| Ereignis | Art | Auslöser | Status | Prio |
|---|---|---|---|---|
| `build_klonk` Klonk | Bauen | build_mode.js:967 u. a. | Code-Platzhalter (klonk) | C |
| `build_klack` Kupplung | Bauen | build_mode.js, scene.js:788 | Code-Platzhalter (klack) | C |
| `build_ratchet` Ratsche | Bauen | build_mode.js:1064 | Code-Platzhalter (ratchet) | C |
| `build_snap` Einrasten | Bauen | build_mode.js, build_select.js, build_decor.js | Code-Platzhalter (snap) | C |
| `build_lift` Hochheben | Bauen | build_mode.js:772 | Code-Platzhalter (lift) | C |
| `trade_coins` Händler | Bauen | build_mode.js:970, build_decor.js | Code-Platzhalter (coins) | C |

## Musik und Radio

| Ton | Art | Auslöser | Status |
|---|---|---|---|
| Leyla Theme (Camp, Schleife) | Musik | game/play/camp_life.js:29 (Camp › Ton › Musik) | produziert (`music_leyla_camp`, Code: tools/music/leyla_theme_camp.py) |
| Hauptmenü-Musik | Musik | game/splash/splash.js:116 (Startseite › Musik) | produziert (`intro_theme`, KI-Musik von Daniel) |
| Intro-Musik | Musik | game/intro/intro.js:72 | produziert (`intro_theme`) |
| Fahrt-Musik | Musik | game/play/drive_ui.js:75 (Reisen › Musik) | produziert (`drive_a`, `drive_b`, KI-Musik von Daniel) |
| Rig-Radio: Songs, Rauschen, DJ | Musik | game/radio_audio.js, game/play/radio_ui.js (#090) | Code (Synth) |

## Noch nicht vertont (Ideen)

Motor/Fahrgeräusch auf der Reisekarte und in der Fahrt, AvA-Surren und Scheinwerfer, Glitch-Duell (Karten, Treffer, Sieg), Kochen & Craften (Brutzeln, Werkbank), Cryo-Tank, Regen und Donner, Kleinvieh. Neue Ereignisse: `node tools/ng.js new sounds <id> '{…}'` und an der Stelle im Code `scene.sfx('<id>', { x })` bzw. `sfxNow('<id>')`.
