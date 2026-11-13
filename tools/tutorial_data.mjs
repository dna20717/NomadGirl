#!/usr/bin/env node
// The lessons of the field guide (#011, Daniel, 13.11.2026: „ein Tutorial ähnlich wie bei Far Cry … feingranulare Lektionen“).
// Writes data/tutorial.json once (the workshop wins afterwards; run again to restore). Media ids: tut_<id> (clip, video) or
// tut_<id>_<n> (slides) — tools/tutorial_capture.mjs records exactly these from the game.   node tools/tutorial_data.mjs
import fs from 'node:fs';
import { pretty } from './json.js';

// [id, chapter, name, media, slide captions (slides) | null, text, trigger, on, mode, after]
const L = [
  // ---- Bewegung
  ['laufen', 'move', 'Laufen und Gehen', 'clip', null, '{k:left} {k:right} laufen. Mit halb geneigtem Stick oder {k:walk} gehalten geht Leyla gemütlich.', 'time', '', 'camp', 2],
  ['springen', 'move', 'Springen', 'clip', null, '{k:jump} springt. Lang gehalten geht es höher, kurz angetippt wird ein Hüpfer daraus.', 'time', '', '', 40],
  ['salto', 'move', 'Salto', 'clip', null, 'In der Luft noch einmal {k:jump}: Salto. Dafür braucht Leyla das passende Implantat vom Ripperdoc.', 'leyla', 'flip', '', 0],
  ['kanten', 'move', 'Kanten greifen', 'clip', null, 'Spring an eine Kante, Leyla greift von selbst zu. {k:up} zieht sie hoch, {k:down} lässt sie einarmig baumeln, noch einmal {k:down} lässt los.', 'leyla', 'hang', '', 0],
  ['leitern', 'move', 'Leitern und Treppen', 'clip', null, 'An einer Leiter klettert Leyla mit {k:up} hinauf. {k:down} rutscht schnell nach unten. Oben zieht sie sich von selbst über die Kante.', 'leyla', 'climb', '', 0],
  ['dash', 'move', 'Dash', 'clip', null, '{k:dash} schießt Leyla ein Stück nach vorn. Danach lädt er sich kurz auf, oben steht dann DASH.', 'time', '', 'run', 15],
  ['slide', 'move', 'Slide', 'clip', null, 'Beim Rennen {k:down}: Leyla rutscht flach weiter und passt unter niedrigen Hindernissen durch.', 'leyla', 'slide', '', 0],
  ['ducken', 'move', 'Ducken und Abspringen', 'clip', null, 'Im Stand {k:down}: Leyla geht in die Hocke. {k:down} mit {k:jump} auf einer dünnen Plattform: sie lässt sich fallen.', 'leyla', 'crouch', '', 0],
  ['seil', 'move', 'Seile', 'clip', null, 'Spring an ein Seil, Leyla hält sich fest und schwingt. {k:jump} lässt mit Schwung los.', 'leyla', 'swing', '', 0],
  // ---- Kampf
  ['nahkampf', 'fight', 'Nahkampf', 'clip', null, '{k:melee} schlägt zu. Im Takt getippt wird eine Kombo daraus, eine Sekunde gehalten ein schwerer Hieb.', 'event', 'alert', '', 0],
  ['schiessen', 'fight', 'Schießen', 'clip', null, '{k:ranged} zieht die Waffe und schießt im selben Zug. Gehalten steckt Leyla sie wieder weg.', 'event', 'alert', '', 0],
  ['nachladen', 'fight', 'Nachladen', 'slides', ['Oben links steht, wie viel Munition noch im Magazin ist.', '{k:reload} lädt nach. Wer leer abdrückt, lädt auch.'], '', 'time', '', 'run', 120],
  ['gegner', 'fight', 'Gegner sehen und hören', 'slides', ['Gegner schauen nach vorn. Ein Ausrufezeichen heißt: entdeckt.', 'In der Nähe hören sie Leyla auch hinter sich. Von hinten bist du im Vorteil.'], '', 'time', '', 'run', 8],
  ['treffer', 'fight', 'Treffer einstecken', 'clip', null, 'Ein Treffer schleudert Leyla zurück. Die Leiste oben links zeigt, wie viel sie noch aushält.', 'event', 'hit', '', 0],
  ['beute', 'fight', 'Beute', 'clip', null, 'Besiegte Gegner lassen etwas fallen. Lauf hin und nimm es mit {k:grab} auf.', 'event', 'kill', '', 0],
  // ---- AvA
  ['gummiband', 'ava', 'AvA am Gummiband', 'clip', null, '{rstick} zieht AvA von Leyla weg: Sie leuchtet dunkle Ecken aus und späht voraus. Loslassen, und sie fliegt zurück.', 'time', '', 'run', 40],
  ['plattform', 'ava', 'AvA als Plattform', 'clip', null, 'Ist AvA draußen, kann Leyla auf ihr stehen oder sich an ihr hochziehen. Ihr Akku hält nur ein paar Sekunden.', 'time', '', 'run', 100],
  ['stimmungen', 'ava', 'AvAs Gesicht', 'slides', ['AvA zeigt, wie es ihr geht: ruhig, neugierig, alarmiert.', 'Ihr Gesicht warnt dich oft, bevor du die Gefahr selbst siehst.'], '', 'time', '', 'camp', 240],
  // ---- Inventar
  ['inventar', 'inventory', 'Das Inventar', 'slides', ['{k:inventory} öffnet das Inventar. Links Leyla mit Waffen, Kleidung und Implantaten.', 'Rechts Rucksack und AvA, oben die Tabs.'], '', 'time', '', 'camp', 60],
  ['raster', 'inventory', 'Formen und Drehen', 'slides', ['Alles hat eine Form. {u:ok} nimmt und legt ab.', '{u:context} dreht, was du in der Hand hast. Passt es nicht, wird der Rahmen rot.'], '', 'window', 'inventory', '', 0],
  ['rueber', 'inventory', 'Rüber und Wegwerfen', 'slides', ['{u:send} schickt ein Ding auf die andere Seite, zum Beispiel in die Kiste.', '{u:send} gehalten wirft es auf den Boden.'], '', 'window', 'other', '', 0],
  ['boden', 'inventory', 'Die Boden-Leiste', 'slides', ['Was neben Leyla am Boden liegt, steht unten in der Boden-Leiste.', 'Liegen mehrere Bündel da, blätterst du mit {u:tabs}.'], '', 'window', 'floor', '', 0],
  ['implantate', 'inventory', 'Implantate', 'slides', ['Implantate stecken in den Feldern um Leyla herum: Augen, Nerven, Arm, Herz, Beine, Haut.', 'Jedes bringt einen Vorteil und einen Haken. Einsetzen kann sie nur der Ripperdoc.'], '', 'window', 'inventory', '', 0],
  // ---- Camp
  ['benutzen', 'camp', 'Dinge benutzen', 'clip', null, 'Unten erscheint ein Hinweis, was hier geht. {k:grab} oder der Stick nach oben benutzt es.', 'time', '', 'camp', 10],
  ['feuer', 'camp', 'Am Lagerfeuer', 'clip', null, 'Am Feuer setzt sich Leyla hin. Die Zeit läuft, sie heilt ein Stück. Aufstehen mit {k:grab} oder einer Richtung.', 'near', 'Lagerfeuer', 'camp', 0],
  ['schlafen', 'camp', 'Schlafen', 'slides', ['In der Koje schläft Leyla bis zum Morgen.', 'Danach ist sie geheilt. Die Nacht kostet Vorräte.'], '', 'near', 'Schlaf', 'camp', 0],
  ['kiste', 'camp', 'Die Kiste', 'slides', ['Die Kiste ist das Lager des Camps.', 'Was hier liegt, bleibt im Camp, auch wenn ein Run schiefgeht.'], '', 'near', 'Kiste', 'camp', 0],
  ['kochen', 'camp', 'Kochen', 'slides', ['Zutaten in den Topf, {u:ok} kocht.', 'Bekannte Rezepte stehen im Buch. {u:send} legt alle Zutaten auf einmal hinein.'], '', 'window', 'kitchen', '', 0],
  ['experimentieren', 'camp', 'Experimentieren', 'slides', ['Unbekannte Mischungen sind Experimente.', 'Treffer werden zu Rezepten, Fehlschläge zu kuriosem Müll.'], '', 'window', 'kitchen', '', 0],
  ['werkbank', 'camp', 'Die Werkbank', 'slides', ['An der Werkbank entstehen Teile, Munition und Ausrüstung aus Schrott.', 'Zettel aus den POIs bringen neue Baupläne.'], '', 'window', 'craft', '', 0],
  ['hydrokultur', 'camp', 'Hydrokultur', 'slides', ['Die Pflanzen wachsen, während Leyla unterwegs ist oder schläft.', 'Ist etwas reif, erntet {k:grab} und pflanzt gleich neu.'], '', 'near', 'Gärtnern', 'camp', 0],
  ['zisterne', 'camp', 'Zisterne', 'slides', ['Die Zisterne fängt Regen und Tau.', '{k:grab} füllt jede volle Flasche Frischwasser ab.'], '', 'near', 'Wasser', 'camp', 0],
  ['ripperdoc', 'camp', 'Ripperdoc', 'slides', ['Auf der Liege setzt der Ripperdoc Implantate ein.', 'Jedes hat seinen Preis: einen Vorteil und einen Haken.'], '', 'window', 'cyber', '', 0],
  // ---- Rig bauen
  ['bauen', 'build', 'Der Bau-Modus', 'slides', ['{k:build} öffnet den Bau-Modus, am Controller hältst du dafür Select.', 'Leyla setzt sich ans Feuer, du steuerst AvA: Sie ist dein Zeiger.'], '', 'time', '', 'camp', 100],
  ['einbauen', 'build', 'Werkstätten einbauen', 'slides', ['Pack eine Werkstatt mit {u:ok} und bring sie an einen freien Platz.', 'Grün heißt: passt. Rot sagt dir, warum nicht.'], '', 'window', 'build', '', 0],
  ['anhaenger', 'build', 'Anhänger und Container', 'slides', ['Anhänger hängst du an eine Kupplung.', 'Stapelbare Container gehen auch obendrauf.'], '', 'window', 'build', '', 0],
  ['solar', 'build', 'Rig-Teile und Solar', 'slides', ['Rig-Teile kommen an die Sockel am Van.', 'Solarpaneele gehören aufs Container-Dach: Strom bei Sonne, nachts aus dem Akku.'], '', 'window', 'build', '', 0],
  ['lichterketten', 'build', 'Lichterketten', 'clip', null, 'Von einem Andockpunkt zum nächsten ziehen: eine Lichterkette. Nachts leuchtet sie über dem Camp.', 'window', 'build', '', 0],
  ['haendler', 'build', 'Der Händler', 'slides', ['{u:send} öffnet den Händler. Gekauftes wird aufs Pad geliefert.', 'Was du aufs Pad legst, verkaufst du. {u:send} gehalten verkauft das Teil in der Hand.'], '', 'window', 'shop', '', 0],
  ['budget', 'build', 'Gewicht, Strom, Plätze', 'slides', ['Oben stehen Gewicht, Anhänger, Energie und Plätze.', 'Wird ein Wert rot, fährt das Rig so nicht los oder eine Werkstatt hat keinen Strom.'], '', 'window', 'build', '', 0],
  // ---- Reisen
  ['karte', 'travel', 'Die Reisekarte', 'slides', ['Die Karte zeigt die Orte dieses Durchgangs.', 'Rot eingekreist: Nachbarorte, eine Straße weit.'], '', 'window', 'map', '', 0],
  ['fahren', 'travel', 'Fahren', 'slides', ['Fahren kostet Sprit und Vorräte, unterwegs vergeht Zeit.', 'Am Ziel steht das Camp neu, mit allem, was am Rig hängt.'], '', 'window', 'map', '', 0],
  ['pluendern', 'travel', 'Plündern', 'slides', ['Am Ort, wo du gerade bist: Hier plündern startet den Run in den POI.'], '', 'window', 'map', '', 0],
  ['warroom', 'travel', 'Der Warroom', 'slides', ['Mit einem Warroom zeigt die Karte Gefahr und Beute.', 'Im Kopf der Karte stehen dann auch Techtree und Auswerten.'], '', 'near', 'Planen', 'camp', 0],
  // ---- Im POI
  ['kisten', 'poi', 'Kisten', 'clip', null, 'Kisten öffnest du mit {k:grab}. Was drin ist, landet in einem Bündel daneben.', 'near', 'Kiste', 'run', 0],
  ['schalter', 'poi', 'Schalter und Türen', 'clip', null, 'Ein Schalter öffnet eine Tür irgendwo im Level. Achte darauf, was sich bewegt.', 'near', 'Schalter', 'run', 0],
  ['waende', 'poi', 'Brüchige Wände', 'clip', null, 'Rissige Wände brechen unter schweren Hieben ({k:melee} halten). Dahinter liegt oft ein Secret.', 'time', '', 'run', 45],
  ['ziel', 'poi', 'Ziel und Ranking', 'slides', ['Am Ausgang endet der Run.', 'Das Ranking zählt Zeit, Kills und Funde. Ein voller Tresor wartet auf die Besten.'], '', 'event', 'cleared', 'run', 0],
  ['ko', 'poi', 'k.o.', 'slides', ['Fällt Leyla, wacht sie am Anfang des Runs wieder auf.', 'Ihr Rucksack liegt, wo sie fiel. Holen kostet nichts, aber der Tank zahlt für jeden k.o.'], '', 'event', 'down', '', 0],
  ['zurueck', 'poi', 'Zurück ins Camp', 'clip', null, 'Am Van fragt das Spiel, ob du zurückreisen willst. Was im Rucksack ist, kommt mit.', 'near', 'Van', 'run', 0],
  // ---- Fortschritt
  ['tank', 'progress', 'AvAs Tank', 'slides', ['Im Cryo-Tank liegt AvAs Körper.', 'Wartung hält ihn stabil, jeder k.o. kostet Zustand.'], '', 'near', 'AvA', 'camp', 0],
  ['techtree', 'progress', 'Der Techtree', 'slides', ['Technik, Wissen und Bio: Funde aus den Runs schalten Knoten frei.', 'Was du hier lernst, bleibt auch im nächsten Durchgang.'], '', 'window', 'tech', '', 0],
  ['durchgang', 'progress', 'Ein neuer Durchgang', 'slides', ['Stirbt AvA, endet der Durchgang. Leyla wacht am Feuer auf.', 'Die Karte ist neu, der Techtree bleibt.'], '', 'event', 'cycle', '', 0],
];

const T = {}, chapters = {};
for (const [id, chapter, name, media, slides, text, trigger, on, mode, after] of L) {
  const order = (chapters[chapter] = (chapters[chapter] || 0) + 1) * 10;
  T[id] = { name, chapter, order, text, media, ...(media === 'clip' ? { clip: `tut_${id}` } : { slides: slides.map((caption, i) => ({ look: `tut_${id}_${i + 1}`, caption })) }), trigger, ...(on ? { on } : {}), ...(mode ? { mode } : {}), ...(after ? { after } : {}) };
}
fs.writeFileSync('projects/nomadgirl/data/tutorial.json', pretty(T) + '\n');
const g = JSON.parse(fs.readFileSync('projects/nomadgirl/data/game.json', 'utf8'));
g.tutorial = { enabled: true, gap: 40, ...(g.tutorial || {}) };
fs.writeFileSync('projects/nomadgirl/data/game.json', pretty(g) + '\n');
console.log(Object.keys(T).length, 'Lektionen,', L.filter(x => x[3] === 'clip').length, 'Clips,', L.filter(x => x[3] === 'slides').reduce((n, x) => n + x[4].length, 0), 'Bilder');
