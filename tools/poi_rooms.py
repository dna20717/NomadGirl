# Room blocks for Großmarkt Delta-Süd, Bunker 13 and Ministerium für Ordnung (Ava, 11.11.2026, Daniel AFK: "gestalte die anderen POIs").
# python3 tools/poi_rooms.py > /tmp/rooms.json  →  {id: {name, tags, weight, terrain, atmosphere, layout, spawns?, backdrop?}}
# Same rules as tools/poi_rooms_km7.py: floor = last row, Leyla stands one row above it, passages at the bottom 3 rows above the floor
# (left/right edge), jump ≈ 2.7 tiles, double jump ≈ 5. Legend: # wall, = platform, H ladder, o rope, C chest, S switch, D door,
# B brittle wall, $ hidden brittle wall, % fake wall, Z goal, 1 POI enemy, A branch hook (ceiling in main rooms, floor in side rooms),
# ^ / v shortcut (entrance / exit), * lamp, L Leyla (entrance only).
import json, sys

def room(w, h):
    g = [['.'] * w for _ in range(h)]
    for x in range(w): g[0][x] = '#'; g[h - 1][x] = '#'
    for y in range(h): g[y][0] = '#'; g[y][w - 1] = '#'
    return g
def put(g, c, x, y): g[y][x] = c
def rect(g, c, x0, x1, y0, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): g[y][x] = c
def door(g, x):                      # passage at the edge, 3 rows above the floor
    h = len(g)
    for y in (h - 4, h - 3, h - 2): g[y][x] = '.'
def closet(g, x0, x1, h):            # locked closet at the left wall: the shortcut comes up here, the switch opens its door
    rect(g, '#', x0, x1, h - 5, h - 5); rect(g, 'D', x1, x1, h - 4, h - 2)
    put(g, 'S', x0 + 2, h - 2); put(g, '^', x0 + 1, h - 1)
def fl(g): return len(g) - 2            # the row Leyla stands on
out = {}
def add(id, name, g, tags, terrain, atmo, weight=1, **kw):
    out[id] = dict(name=name, tags=tags, weight=weight, terrain=terrain, atmosphere=atmo, size=[len(g[0]), len(g)], layout=[''.join(r) for r in g], **kw)

# ===================== Großmarkt Delta-Süd (mall, M) =====================
# Eingang: Parkplatz vor dem Markt (draußen), Autowracks zum Drüberspringen, Kassenhäuschen mit Abkürzung, Kiste auf dem Bus
g = room(44, 17); f = fl(g)
closet(g, 1, 6, 17)
put(g, 'L', 11, f)
rect(g, '#', 15, 18, f - 1, f); rect(g, '#', 16, 17, f - 2, f - 2)          # Autowrack
rect(g, '#', 24, 32, f - 2, f); rect(g, 'H', 23, 23, f - 4, f)              # Bus mit Leiter aufs Dach
rect(g, '=', 24, 32, f - 3, f - 3); put(g, 'C', 30, f - 4)
rect(g, '#', 36, 38, f - 1, f)                                              # Einkaufswagen-Haufen
put(g, '1', 34, f); put(g, '1', 40, f)
door(g, 43)
add('markt_eingang', 'Markt · Parkplatz', g, ['start'], 'desert', 'wueste_draussen', backdrop={'weather': 'abendglut', 'shade': 25})

# Passage: Ladenzeilen, Galerie oben mit Lücken, Haken für einen Abzweig nach oben
g = room(40, 17); f = fl(g)
door(g, 0); door(g, 39)
rect(g, '=', 3, 12, 9, 9); rect(g, '=', 16, 24, 9, 9); rect(g, '=', 28, 37, 9, 9)   # Galerie
rect(g, 'H', 14, 14, 9, f); rect(g, 'H', 26, 26, 9, f)
put(g, 'A', 20, 0)
for x in (6, 20, 33): put(g, '*', x, 1)
rect(g, '#', 8, 9, f - 1, f); rect(g, '#', 31, 32, f - 1, f)                 # Pflanzkübel
put(g, '1', 12, f); put(g, '1', 22, f); put(g, '1', 34, 8)
add('markt_passage', 'Markt · Passage', g, ['corridor', 'combat'], 'mall', 'markt_neon', weight=3)

# Food-Court: Tische als Inseln, Brunnen in der Mitte, Imbissbude mit brüchiger Rückwand (Kiste)
g = room(36, 17); f = fl(g)
door(g, 0); door(g, 35)
rect(g, '#', 15, 20, f - 1, f); rect(g, '#', 17, 18, f - 3, f - 2)          # Brunnen
for x in (5, 9, 25, 29): rect(g, '=', x, x + 1, f - 2, f - 2)               # Tische
rect(g, '#', 28, 34, 6, 6); rect(g, '#', 28, 28, 7, 9); rect(g, 'B', 28, 28, 7, 9)   # Imbissbude oben rechts, brüchige Wand
rect(g, '#', 28, 34, 10, 10); put(g, 'C', 32, 9)
rect(g, '=', 21, 27, 11, 11)
put(g, '*', 10, 1); put(g, '*', 24, 1)
put(g, '1', 8, f); put(g, '1', 13, f); put(g, '1', 24, f)
add('markt_foodcourt', 'Markt · Food-Court', g, ['combat'], 'mall', 'markt_neon', weight=3)

# Kaufhaus: zwei Etagen über Rolltreppen (Leitern), Scheinwand im 2. Stock zu einer Umkleide mit Kiste
g = room(34, 23); f = fl(g)
door(g, 0); door(g, 33)
rect(g, '=', 1, 26, 15, 15); rect(g, '=', 7, 32, 8, 8)
rect(g, 'H', 28, 28, 15, f); rect(g, 'H', 5, 5, 8, 14)
rect(g, '#', 27, 32, 2, 2); rect(g, '#', 27, 27, 3, 7); rect(g, '%', 27, 27, 5, 7); put(g, 'C', 30, 7)   # Umkleide hinter Scheinwand
put(g, '*', 12, 1); put(g, '*', 22, 9); put(g, '*', 10, 16)
rect(g, '#', 12, 13, f - 1, f); rect(g, '#', 20, 21, 13, 14)
put(g, '1', 9, f); put(g, '1', 18, f); put(g, '1', 16, 14); put(g, '1', 20, 7)
add('markt_kaufhaus', 'Markt · Kaufhaus', g, ['combat'], 'mall', 'markt_neon', weight=2)

# Lager (Abzweig oben): Hochregale, Kiste, getarnte brüchige Wand mit Tresorkiste
g = room(24, 13); f = fl(g)
put(g, 'A', 12, 12)
rect(g, '=', 2, 8, 8, 8); rect(g, '=', 2, 8, 4, 4); rect(g, 'H', 9, 9, 4, f); put(g, 'C', 4, 3)
rect(g, '#', 18, 22, 6, 6); rect(g, '$', 18, 18, 7, 10); put(g, 'C', 21, 10); put(g, '*', 20, 7)
put(g, '1', 14, f)
add('markt_lager', 'Markt · Hochregallager', g, ['loot', 'secret'], 'mall', 'beton_lager', weight=2)

# Kino (Abzweig oben): Sitzreihen steigen nach rechts an, ganz oben eine Kiste
g = room(22, 13); f = fl(g)
put(g, 'A', 4, 12)
for i in range(4): rect(g, '#', 8 + i * 3, 20, f - i, f)
rect(g, '=', 1, 5, 8, 8); put(g, 'C', 2, 7); put(g, 'C', 19, f - 4)
put(g, '*', 12, 1)
put(g, '1', 12, f - 2)
add('markt_kino', 'Markt · Kino', g, ['loot'], 'mall', 'kino_dunkel', weight=1)

# Büro der Marktleitung (Ausgang): Tresor, Abkürzung in den Keller
g = room(30, 17); f = fl(g)
door(g, 0)
rect(g, '=', 4, 10, 11, 11); rect(g, '=', 13, 19, 8, 8); put(g, 'C', 16, 7)
rect(g, '#', 21, 22, f - 2, f)
put(g, '1', 8, f); put(g, '1', 18, f)
put(g, 'Z', 27, f); put(g, 'v', 25, f + 1); put(g, '*', 25, 1)
add('markt_buero', 'Markt · Büro der Leitung', g, ['exit', 'combat'], 'mall', 'markt_neon')

# ===================== Bunker 13 (L) =====================
# Tor: draußen, Sandsäcke, Wachturm mit Kiste, Wachhäuschen mit Abkürzung, das Bunkertor geht per Schalter auf
g = room(42, 17); f = fl(g)
closet(g, 1, 6, 17)
put(g, 'L', 10, f)
rect(g, '#', 14, 16, f - 1, f)                                               # Sandsäcke
rect(g, 'H', 21, 21, 7, f); rect(g, '=', 18, 25, 7, 7); put(g, 'C', 24, 6)    # Wachturm
rect(g, '#', 33, 41, 1, 12); rect(g, 'D', 36, 36, 13, 15); put(g, 'S', 31, f)   # Bunkerfront mit Tor
put(g, '1', 28, f); put(g, '1', 39, f)
door(g, 41)
add('bunker_tor', 'Bunker · Tor', g, ['start'], 'desert', 'wueste_draussen', backdrop={'weather': 'abendglut', 'shade': 30})

# Schleuse: der Rohrblock lässt unten nur einen Schlitz (rutschen), im Block ein Lüftungsschacht hinter einer Scheinwand
g = room(28, 17); f = fl(g)
door(g, 0); door(g, 27)
rect(g, '#', 8, 18, 1, f - 2)
rect(g, '.', 9, 15, 6, 9); rect(g, '%', 8, 8, 7, 9); put(g, 'C', 14, 9); put(g, '*', 12, 6)
rect(g, '=', 2, 7, 10, 10); rect(g, '=', 2, 4, 13, 13)
put(g, '*', 4, 1); put(g, '*', 23, 1)
put(g, '1', 22, f)
add('bunker_schleuse', 'Bunker · Schleuse', g, ['corridor'], 'bunker', 'bunker_rot', weight=2)

# Quartiere: Stockbetten (Plattformen), Spinde, Haken für einen Abzweig
g = room(34, 17); f = fl(g)
door(g, 0); door(g, 33)
for x in (4, 12, 20): rect(g, '=', x, x + 4, f - 3, f - 3); rect(g, '=', x, x + 4, f - 6, f - 6)
rect(g, '#', 27, 28, f - 3, f)
put(g, 'A', 16, 0); put(g, 'A', 30, 0)
put(g, '*', 8, 1); put(g, '*', 24, 1)
put(g, '1', 9, f); put(g, '1', 18, f); put(g, '1', 14, f - 7); put(g, '1', 31, f)
add('bunker_quartiere', 'Bunker · Quartiere', g, ['combat'], 'bunker', 'bunker_rot', weight=3)

# Reaktorhalle: Reaktorblock in der Mitte (zu hoch für einen Sprung), Seil darüber, Galerien, brüchige Wand zur Wartungsnische
g = room(38, 21); f = fl(g)
door(g, 0); door(g, 37)
rect(g, '#', 15, 22, f - 3, f); rect(g, '#', 17, 20, f - 4, f - 4)              # Reaktor
put(g, 'o', 18, 8)
rect(g, '=', 2, 10, 11, 11); rect(g, '=', 27, 35, 11, 11); rect(g, 'H', 11, 11, 11, f); rect(g, 'H', 26, 26, 11, f)
rect(g, '#', 29, 36, 4, 4); rect(g, 'B', 29, 29, 5, 8); rect(g, '#', 29, 36, 9, 9); put(g, 'C', 34, 8)
put(g, '*', 6, 1); put(g, '*', 18, 1); put(g, '*', 32, 5)
put(g, '1', 6, f); put(g, '1', 6, 10); put(g, '1', 31, f); put(g, '1', 13, f)
add('bunker_reaktor', 'Bunker · Reaktorhalle', g, ['combat'], 'bunker', 'bunker_reaktor', weight=2)

# Gang: halb geschlossene Schotts (ducken/rutschen), Haken oben
g = room(32, 17); f = fl(g)
door(g, 0); door(g, 31)
for x in (8, 16, 24): rect(g, '#', x, x + 1, 1, f - 2)
put(g, 'A', 20, 0)
put(g, '*', 4, 1); put(g, '*', 12, 1); put(g, '*', 28, 1)
put(g, '1', 12, f); put(g, '1', 20, f); put(g, '1', 28, f)
add('bunker_gang', 'Bunker · Gang', g, ['corridor', 'combat'], 'bunker', 'bunker_rot', weight=3)

# Munitionslager (Abzweig oben)
g = room(20, 13); f = fl(g)
put(g, 'A', 10, 12)
rect(g, '=', 2, 7, 8, 8); rect(g, '=', 12, 17, 8, 8); rect(g, '=', 2, 7, 4, 4)
put(g, 'C', 4, 3); put(g, 'C', 15, 7); put(g, '*', 10, 1)
put(g, '1', 5, f)
add('bunker_lager', 'Bunker · Munitionslager', g, ['loot'], 'bunker', 'bunker_rot', weight=2)

# Archiv (Abzweig oben): Aktenregale, getarnte Wand vor dem Geheimarchiv
g = room(24, 13); f = fl(g)
put(g, 'A', 6, 12)
rect(g, '=', 2, 9, 7, 7)
rect(g, '#', 15, 22, 5, 5); rect(g, '$', 15, 15, 6, f); put(g, 'C', 20, f); put(g, '*', 18, 6)
put(g, '1', 11, f)
add('bunker_archiv', 'Bunker · Archiv', g, ['loot', 'secret'], 'bunker', 'beton_lager', weight=1)

# Kommandozentrale (Ausgang): Konsolen, Tresor, Abkürzung
g = room(34, 19); f = fl(g)
door(g, 0)
rect(g, '#', 6, 9, f - 1, f); rect(g, '#', 14, 17, f - 1, f)
rect(g, '=', 4, 12, 12, 12); rect(g, '=', 16, 24, 8, 8); put(g, 'C', 20, 7)
put(g, '1', 12, f); put(g, '1', 22, f); put(g, '1', 8, 11)
put(g, 'Z', 31, f); put(g, 'v', 28, f + 1)
for x in (8, 20, 29): put(g, '*', x, 1)
add('bunker_kommando', 'Bunker · Kommandozentrale', g, ['exit', 'combat'], 'bunker', 'bunker_rot')

# ===================== Ministerium für Ordnung (XL) =====================
# Vorplatz: Freitreppe, Säulen, Pförtnerloge mit Abkürzung
g = room(42, 19); f = fl(g)
closet(g, 1, 6, 19)
put(g, 'L', 10, f)
for i in range(4): rect(g, '#', 20 + i * 2, 33 - i * 2, f - i, f - i)         # Freitreppe
rect(g, '=', 24, 29, f - 8, f - 8); put(g, 'C', 26, f - 9)                    # Balkon über der Treppe
put(g, '1', 26, f - 4); put(g, '1', 39, f)
door(g, 41)
add('min_vorplatz', 'Ministerium · Freitreppe', g, ['start'], 'desert', 'wueste_draussen', backdrop={'weather': 'abendglut', 'shade': 35})

# Flur: Wartebänke, Türen, Haken
g = room(38, 17); f = fl(g)
door(g, 0); door(g, 37)
rect(g, '=', 3, 9, 11, 11); rect(g, '=', 27, 34, 11, 11); rect(g, '=', 15, 21, 8, 8)
put(g, 'A', 12, 0); put(g, 'A', 30, 0)
for x in (4, 12, 20, 28, 34): put(g, '*', x, 1)
put(g, '1', 10, f); put(g, '1', 22, f); put(g, '1', 33, f)
add('min_flur', 'Ministerium · Flur', g, ['corridor', 'combat'], 'marble', 'ministerium_kalt', weight=4)

# Großraumbüro: Schreibtische, Aktenschrank mit brüchiger Wand
g = room(34, 17); f = fl(g)
door(g, 0); door(g, 33)
for x in (4, 10, 16, 22): rect(g, '=', x, x + 2, f - 2, f - 2)
rect(g, '=', 6, 14, 9, 9); rect(g, '=', 18, 26, 9, 9)
rect(g, '#', 28, 32, 5, 5); rect(g, 'B', 28, 28, 6, 8); rect(g, '#', 28, 32, 9, 9); put(g, 'C', 31, 8)
put(g, '*', 10, 1); put(g, '*', 22, 1)
put(g, '1', 8, f); put(g, '1', 20, f); put(g, '1', 12, 8)
add('min_buero', 'Ministerium · Großraumbüro', g, ['combat'], 'marble', 'ministerium_kalt', weight=3)

# Treppenhaus: Zickzack nach oben zur Hausmeisterkammer (Kiste hinter Scheinwand), unten geht es durch
g = room(24, 27); f = fl(g)
door(g, 0); door(g, 23)
for i in range(5):
    y = f - 4 - i * 4
    if i % 2 == 0: rect(g, '=', 2, 12, y, y)
    else: rect(g, '=', 11, 21, y, y)
rect(g, '#', 14, 22, 1, 1); rect(g, '%', 14, 14, 2, 4); rect(g, '#', 14, 22, 5, 5); put(g, 'C', 19, 4); put(g, '*', 18, 2); rect(g, '=', 12, 13, 5, 5)
put(g, '*', 6, 1)
put(g, '1', 6, f); put(g, '1', 16, f - 9)
add('min_treppe', 'Ministerium · Treppenhaus', g, ['corridor'], 'marble', 'ministerium_kalt', weight=2)

# Festsaal: Kronleuchter als Seile über einem Graben aus umgestürzten Bänken, Galerie
g = room(40, 21); f = fl(g)
door(g, 0); door(g, 39)
rect(g, '=', 2, 10, 10, 10); rect(g, '=', 29, 37, 10, 10)
put(g, 'o', 15, 3); put(g, 'o', 25, 3)
rect(g, '#', 13, 27, f - 1, f)
rect(g, 'H', 11, 11, 10, f); rect(g, 'H', 28, 28, 10, f)
put(g, 'A', 20, 0)
put(g, '*', 6, 1); put(g, '*', 33, 1)
put(g, '1', 6, f); put(g, '1', 20, f - 2); put(g, '1', 33, f); put(g, '1', 6, 9)
add('min_saal', 'Ministerium · Festsaal', g, ['combat'], 'marble', 'ministerium_saal', weight=2)

# Archiv (Abzweig oben)
g = room(26, 15); f = fl(g)
put(g, 'A', 13, 14)
for y in (4, 8): rect(g, '=', 2, 10, y, y); rect(g, '=', 16, 24, y, y)
rect(g, 'H', 11, 11, 4, f); rect(g, 'H', 15, 15, 4, f)
put(g, 'C', 4, 3); put(g, 'C', 22, 7); put(g, '*', 13, 1)
put(g, '1', 6, f)
add('min_archiv', 'Ministerium · Archiv', g, ['loot'], 'marble', 'ministerium_kalt', weight=2)

# Asservatenkammer (Abzweig oben): getarnte Wand
g = room(20, 13); f = fl(g)
put(g, 'A', 5, 12)
rect(g, '#', 11, 18, 6, 6); rect(g, '$', 11, 11, 7, f); put(g, 'C', 16, f); put(g, '*', 15, 7)
rect(g, '=', 2, 7, 7, 7); put(g, 'C', 3, 6)
add('min_asservaten', 'Ministerium · Asservatenkammer', g, ['loot', 'secret'], 'marble', 'beton_lager', weight=1)

# Amtszimmer des Hausmeisters (Ausgang, Boss): Tresor hinter dem Schreibtisch, Abkürzung
g = room(36, 21); f = fl(g)
door(g, 0)
rect(g, '=', 4, 10, 13, 13); rect(g, '=', 25, 31, 13, 13); rect(g, '=', 14, 21, 9, 9)
rect(g, '#', 26, 29, f - 1, f)
put(g, 'h', 18, f)
put(g, 'Z', 33, f); put(g, 'v', 31, f + 1)
for x in (8, 18, 28): put(g, '*', x, 1)
add('min_amtszimmer', 'Ministerium · Amtszimmer', g, ['exit', 'boss'], 'marble', 'ministerium_saal', spawns=[{'symbol': 'h', 'enemy': 'hausmeister'}])

json.dump(out, sys.stdout, ensure_ascii=False)
