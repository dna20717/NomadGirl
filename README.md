# NomadGirl

2D-Action-Roguelite mit Cosy-Basisbau. Leyla lebt in den Wastelands rund um BigCityDelta in ihrem Rig, plündert Tankstellen, Bunker und verlassene Regierungskomplexe und kocht zwischendurch Mutanten-Curry.

Das Projekt ist als **Engine mit Werkstatt** gebaut: Jeder Aspekt des Spiels (Leyla, Waffen, Gegner, Gegenstände, Rezepte, Rig, POIs, Oberwelt, Ranking …) lässt sich in einer GUI einstellen.

- Spieldesign: [docs/design.md](docs/design.md)
- Anleitung für die Zusammenarbeit mit Ava: [CLAUDE.md](CLAUDE.md)

## Werkstatt starten

```
npm run serve
```

Dann im Browser http://localhost:8766/workshop.html öffnen.

## Prüfen auf der Kommandozeile

```
npm test
node tools/ng.js check
node tools/ng.js areas
```

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `engine/` | Datenschema und Projekt-Logik (läuft im Browser und in Node) |
| `game/workshop/` | Werkstatt |
| `game/` | gemeinsamer Oberflächen-Kern (aus NomadTactics) |
| `projects/nomadgirl/` | Spieldaten als JSON |
| `tools/` | Kommandozeile `ng`, Werkstatt-Test, Gerüste |
| `docs/` | Design-Doc, Glossar |
