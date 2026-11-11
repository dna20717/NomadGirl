# Layouts der Tankstelle Kilometer 7 (Ava, 10.11.2026). python3 tools/poi_rooms_km7.py → JSON {raum: [zeilen]}
# Höhe 17, Boden = unterste Zeile (16), Leyla steht auf Zeile 15. Sprung 2,7 Kacheln hoch, Doppelsprung ~5.
# Hauptraum-Durchgänge: Zeilen 13–15 am linken/rechten Rand offen.
import json, sys
H = 17
def room(w):
    g = [['.'] * w for _ in range(H)]
    for x in range(w): g[0][x] = '#'; g[H - 1][x] = '#'
    for y in range(H): g[y][0] = '#'; g[y][w - 1] = '#'
    return g
def put(g, c, x, y): g[y][x] = c
def rect(g, c, x0, x1, y0, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): g[y][x] = c
def door(g, x):                      # Durchgang am Rand
    for y in (13, 14, 15): g[y][x] = '.'
out = {}

# Vorplatz (Eingang): Abstellkammer links mit Abkürzung (^), Schalter und Tür; Van; Zapfsäulen-Dach mit Kiste
g = room(40)
rect(g, '#', 1, 6, 12, 12)            # Dach der Kammer
rect(g, '#', 6, 6, 12, 15)            # rechte Kammerwand …
rect(g, 'D', 6, 6, 13, 15)            # … ist die Tür
put(g, 'S', 4, 15); put(g, '^', 2, 16)
put(g, 'L', 13, 15)
rect(g, 'H', 22, 22, 9, 15)           # Leiter aufs Tankstellendach
rect(g, '=', 23, 33, 9, 9)
put(g, 'C', 28, 8)
rect(g, '#', 26, 26, 13, 15); rect(g, '#', 30, 30, 13, 15)   # Zapfsäulen
put(g, '1', 33, 15); put(g, '1', 36, 15)
door(g, 39)
out['vorplatz'] = g

# Verkaufsraum: Regale, Theke, Abzweig nach oben (A), Geheimfach hinter getarnter brüchiger Wand
g = room(30)
door(g, 0); door(g, 29)
put(g, 'A', 6, 0)
rect(g, '=', 9, 13, 12, 12)
rect(g, '=', 14, 19, 9, 9)
rect(g, '#', 20, 28, 5, 5); rect(g, '#', 20, 28, 9, 9); rect(g, '#', 28, 28, 5, 9)
rect(g, '$', 20, 20, 6, 8); put(g, 'C', 25, 8); put(g, '*', 24, 6)   # getarnte brüchige Wand (Daniel, 11.11.2026)
rect(g, '#', 16, 18, 14, 15)          # Theke
put(g, '1', 12, 15); put(g, '1', 22, 15); put(g, '1', 26, 15)
out['verkaufsraum'] = g

# Lager (Seitenraum, Abzweig im Boden): Regale mit Kiste, Hinterzimmer hinter einer Scheinwand
g = room(20)
put(g, 'A', 10, 16)
rect(g, '=', 2, 7, 12, 12); put(g, 'C', 4, 11)
rect(g, '#', 15, 18, 12, 12); rect(g, '%', 15, 15, 13, 15); put(g, 'C', 17, 15)   # Scheinwand (Daniel, 11.11.2026)
rect(g, '=', 12, 14, 9, 9)
put(g, '1', 6, 15)
out['lager'] = g

# Werkstatthalle (Ausgang): Hebebühnen, Block mit Seil darüber, Ziel (Z) hinten, Abkürzung runter (v)
g = room(36)
door(g, 0)
rect(g, '=', 5, 9, 12, 12)
rect(g, '=', 11, 16, 9, 9)
rect(g, '#', 18, 22, 12, 15)
put(g, 'o', 20, 4)
put(g, '1', 8, 15); put(g, '1', 14, 15); put(g, '1', 26, 15); put(g, '1', 29, 15)
put(g, 'Z', 33, 15); put(g, 'v', 31, 16)
out['werkstatthalle'] = g

json.dump({k: [''.join(r) for r in v] for k, v in out.items()}, sys.stdout, ensure_ascii=False)
