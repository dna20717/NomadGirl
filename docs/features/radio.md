# Rig-Radio (#090)

Daniel, 19.11.2026: „#087–#091 Systeme bauen“. Aus dem Ideenspeicher: „Sender mit Musik aus Code, Durchsagen aus BigCityDelta, Lore-Häppchen, Hinweise auf POIs, vielleicht eine DJ-Entity mit Banter.“

- **Wo:** im Camp (CampMode) und auf der Fahrt (TravelMode), im POI (ActionMode) still: das Radio steht im Rig. Ton aus (M) = still. Chip unten rechts („Radio aus · N“, sonst Sender, Frequenz, Songtitel), beim Reden klappt er auf und zeigt den DJ-Text. Das Leyla-Theme im Camp blendet aus, solange das Radio spielt.
- **Bedienung:** **N** = nächster Sender, nach dem letzten aus; Klick auf den Chip ebenso; **Pause-Menü › Radio** listet alle Sender und Aus (Controller). An/aus und Sender merkt sich der Browser (`localStorage nomadgirl-radio`).
- **Ablauf:** Song (Länge aus Radio › Länge eines Songs) → DJ redet (Radio › DJ redet, Musik leiser) → nächster Song. Senderwechsel knistert.
- **Musik aus Code:** `game/radio.js` › `song(D, station, seed)` macht 4 Takte à 16 Schritte (Pad-Akkorde nach einer Akkordfolge, Bass, Lead, Drums je Stil), gleicher Seed = gleicher Song; Titel aus zwei Wortlisten. `game/radio_audio.js` (`RadioSynth`) spielt sie mit Oszillatoren und Rauschen über einen Radio-Bandpass mit leisem Rauschen, Look-ahead-Planer (50 ms, 0,3 s voraus), Ducking beim Reden, Knistern beim Wechsel. Stile: **Synthwave** (Sägezahn, Arpeggio, Four-on-the-floor), **Wüsten-Folk** (gezupft, Shaker), **Glitch** (schnell, Stotter-Lead, gebrochene Drums), **Nachtsender** (Flächen, Glocken, keine Drums).
- **Durchsagen** (`talk`, `talkPool`): Senderkennung, **Werbung** aus Lore › Marken (Werbung `|`-getrennt oder Slogan; pleite Marken werben weiter, mit Zusatz), **Wetter** aus dem Navigator (#087, Regen heute/morgen), **Frontbericht** aus dem Revierkrieg (#089, Fronten auf der Karte), **Gerücht** über unbesuchte Orte mit Beute-Hinweis, **Lore-Häppchen**. Gewichte je Art (Radio › Durchsagen › Anteile), Zeilen mit Platzhaltern.
- **Gang-Sender:** Radio › Sender › Gang: als Feind dieser Gang nur Rauschen mit Text (Radio › Gestört). Saint FM gehört den Static Saints („Wir senden. Du empfängst.“).
- **Werkstatt** › Welt › **Radio** (`data/radio.json`): an/aus, Lautstärke, Song-Länge, Redezeit, Sender (ID, Name, Frequenz, Stil, Tempo, Tonart, Tonleiter, DJ, Spruch, Gang), Durchsagen, Songtitel-Wörter.
- Fernsteuerung: `game.scene.getScene('play').hud.radio.state()` (on, station, playing, allowed, seg, chip), `.next()`, `.set(i|null)`.
- Tests: `test/radio.test.js`, `tools/radio_test.mjs` (11 Prüfungen).
