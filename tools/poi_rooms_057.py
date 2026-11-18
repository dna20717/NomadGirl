#!/usr/bin/env python3
# Usage: python3 tools/poi_rooms_057.py /tmp/silo.json && node tools/merge_rooms.mjs /tmp/silo.json  (afterwards edit the rooms in the workshop)
# Room blocks for #057 (Daniel 18.11.2026, with his picture „Cyberpunk Underground Rocket Silo“: „Kannst du daraus einen spielbaren POI
# machen?“; mindestens 20 Räume, eigene Gang, Silo-KI als optionales Duell, Boss unten). A deep stack: the hatch on the surface, then down
# along the rocket shaft (nose, body, engines) and the rooms around it (barracks, medbay, lab with the cryo tube, control room, generators,
# workshop with the crane, store, ventilation, canteen), at the bottom the flooded launch pad with the boss and the Silo-KI's terminal (@).
# Rules as in tools/poi_rooms_038.py: floor = last row, the three rows above it open at both edges (seams), Leyla is 3 tiles tall and
# jumps ~3; A in the ceiling = the room above hangs here (the column below stays free for the ladder), A in the floor = the room below.
import json, sys
from pathlib import Path

R = {}

def grid(w, h=11, fa=None, ca=None, seams=(True, True)):
    g = [list("#" + "." * (w - 2) + "#") for _ in range(h)]
    g[0] = list("#" * w); g[-1] = list("#" * w)
    if fa is not None:
        for x in (fa if isinstance(fa, (list, tuple)) else [fa]): g[-1][x] = "A"
    if ca is not None:
        for x in (ca if isinstance(ca, (list, tuple)) else [ca]): g[0][x] = "A"
    for y in (h - 4, h - 3, h - 2):
        if seams[0]: g[y][0] = "."
        if seams[1]: g[y][-1] = "."
    return g
def put(g, x, y, s):
    for k, c in enumerate(s):
        assert 0 <= x + k < len(g[0]) and 0 <= y < len(g), (x, y, s)
        g[y][x + k] = c
def col(g, x, y0, y1, c):
    for y in range(y0, y1 + 1): g[y][x] = c
def rect(g, x, y, w, h, c="#"):
    for yy in range(y, y + h): put(g, x, yy, c * w)
def lamps(g, *xs):
    for x in xs: put(g, x, 1, "*")
def block(g, x, w, h=2):
    for y in range(len(g) - 1 - h, len(g) - 1): put(g, x, y, "#" * w)
def feet(g):
    return len(g) - 2
def room(id, meta, g):
    rows = ["".join(r) for r in g]
    assert all(len(r) == len(rows[0]) for r in rows), id
    h = len(rows)
    for x, c in enumerate(rows[0]):
        if c == "A":
            for y in range(1, h - 1):
                assert rows[y][x] not in "#", f"{id}: ladder column {x} blocked at row {y}"
                if rows[y][x] == "=": break
    for x, c in enumerate(rows[-1]):
        if c == "A":
            for y in (h - 2, h - 3, h - 4): assert rows[y][x] in ".*", f"{id}: floor hook {x} covered at row {y}"
    R[id] = {**meta, "size": [len(rows[0]), h], "layout": rows}

NIGHT = {"weather": "nacht", "shade": 30}
B, M, C = "bunker", "metal", "concrete"
N = lambda s: s + " (#057)"

# ---------------------------------------------------------------------------------------------------------------------
# the surface: the blast hatch in the mountains, fences, the radar dish on its tower (start, floor hook down into the silo)
# ---------------------------------------------------------------------------------------------------------------------
g = grid(44, 15, fa=22)
for x in range(1, 43): g[1][x] = "."; g[2][x] = "."
put(g, 3, 13, "L")
rect(g, 15, 5, 14, 1); col(g, 15, 5, 9, "#"); col(g, 28, 5, 9, "#")          # the hatch house
put(g, 16, 9, "============"); put(g, 19, 4, "*")
for x in range(17, 27): g[10][x] = "."
put(g, 34, 9, "======"); col(g, 36, 10, 13, "H"); put(g, 35, 8, "C")          # the radar tower's platform
put(g, 8, 10, "====")
put(g, 10, 13, "1"); put(g, 31, 13, "1")
room("rs_tor", {"name": "Silo · Bunkertor", "tags": ["start"], "weight": 1, "terrain": "desert", "atmosphere": "wueste_draussen", "backdrop": NIGHT,
  "description": N("Ein Betonbau zwischen den Felsen, Stacheldraht, die Radarschüssel dreht sich noch. Unter der Luke geht es neunzig Meter runter.")}, g)

# ---------------------------------------------------------------------------------------------------------------------
# main rooms down the silo (combat / corridor, hooks at both ends)
# ---------------------------------------------------------------------------------------------------------------------
g = grid(34, 11, fa=27, ca=6); lamps(g, 13, 22)
col(g, 16, 1, 6, "#"); col(g, 17, 1, 6, "#"); col(g, 16, 7, 9, "D"); col(g, 17, 7, 9, "D")   # the blast door
put(g, 10, 6, "====="); put(g, 11, 5, "S")
put(g, 23, 9, "1"); put(g, 29, 9, "1")
room("rs_schleuse", {"name": "Silo · Schleuse", "tags": ["corridor"], "weight": 2, "terrain": B, "atmosphere": "bunker_rot",
  "description": N("Das Explosionsschutztor. Der Schalter auf der Empore hackt die Verriegelung.")}, g)

def shaft(id, name, top, desc, fa, ca, weight=2):
    # the rocket in the middle as a solid body, gantries left and right, ladders up the service towers
    g = grid(40, 22, fa=fa, ca=ca); lamps(g, 6, 33)
    bottom = len(g) - 5                                                           # three free rows under the rocket: the floor stays a way
    rect(g, 17, 3 if top else 1, 6, bottom - (3 if top else 1) + 1)
    if top: put(g, 18, 2, "####"); put(g, 19, 1, "##")                           # the nose
    for y in (6, 11, 16): put(g, 4, y, "======="); put(g, 29, y, "=======")
    for y in (8, 13): put(g, 11, y, "======"); put(g, 23, y, "======")
    col(g, 3, 6, 19, "H"); col(g, 36, 6, 19, "H")
    put(g, 6, 5, "1"); put(g, 32, 10, "1"); put(g, 13, 7, "1"); put(g, 26, 12, "1"); put(g, 8, 19, "1")
    put(g, 25, 7, "C") if top else None
    room(id, {"name": name, "tags": ["combat"], "weight": weight, "terrain": M, "atmosphere": "bunker_reaktor", "description": N(desc)}, g)
shaft("rs_schacht_spitze", "Silo · Raketenschacht (Spitze)", True, "Die Spitze der Rakete, umrankt von Wartungsbühnen. Unten im Dunkel summt etwas.", 10, 30)
shaft("rs_schacht_mitte", "Silo · Raketenschacht (Rumpf)", False, "Der Rumpf, so dick wie ein Haus. Die Zero Hour hat ihre Parolen auf das Blech gesprüht.", 30, 10)

g = grid(40, 22, fa=9, ca=30); lamps(g, 6, 33)
rect(g, 17, 1, 6, 12); rect(g, 15, 13, 3, 3); rect(g, 22, 13, 3, 3)               # body and the two engine bells
put(g, 4, 6, "======="); put(g, 29, 6, "======="); put(g, 5, 11, "======"); put(g, 29, 11, "======")
put(g, 10, 16, "====="); put(g, 25, 16, "=====")
col(g, 3, 6, 19, "H"); col(g, 36, 6, 19, "H")
put(g, 7, 5, "1"); put(g, 31, 10, "1"); put(g, 12, 15, "1"); put(g, 27, 19, "1")
room("rs_schacht_fuss", {"name": "Silo · Raketenschacht (Triebwerke)", "tags": ["combat"], "weight": 2, "terrain": M, "atmosphere": "bunker_reaktor",
  "description": N("Die Triebwerksglocken hängen über dem Flammenschacht. Hier riecht es nach altem Treibstoff.")}, g)

g = grid(36, 11, fa=29, ca=6); lamps(g, 12, 24)
for x in (9, 15, 21): block(g, x, 4, 1); put(g, x, 7, "====")                     # bunk beds
put(g, 11, 6, "C")
put(g, 18, 9, "1"); put(g, 27, 9, "1"); put(g, 32, 9, "1")
room("rs_kaserne", {"name": "Silo · Kaserne", "tags": ["combat"], "weight": 2, "terrain": B, "atmosphere": "beton_lager",
  "description": N("Stockbetten in Reih und Glied. Die Zero Hour schläft hier in Schichten, wenn sie schläft.")}, g)

g = grid(32, 11, fa=6, ca=26); lamps(g, 10, 20)
block(g, 11, 4, 1); block(g, 19, 4, 1); put(g, 13, 6, "====")
put(g, 22, 9, "1"); put(g, 28, 9, "1")
room("rs_krankenstation", {"name": "Silo · Krankenstation", "tags": ["combat"], "weight": 2, "terrain": C, "atmosphere": "ministerium_kalt",
  "description": N("Weiße Kacheln, ein rotes Kreuz, OP-Liegen. Das Lazarett für den Tag danach.")}, g)

g = grid(36, 13, fa=29, ca=6); lamps(g, 14, 24)
rect(g, 10, 1, 4, 7)                                                            # the cryo tube hangs from the ceiling
put(g, 18, 8, "======="); put(g, 22, 7, "C")
put(g, 16, 11, "1"); put(g, 30, 11, "1")
room("rs_labor", {"name": "Silo · Kryolabor", "tags": ["combat"], "weight": 2, "terrain": M, "atmosphere": "markt_neon",
  "description": N("Eine violett leuchtende Röhre, darin eine Gestalt. AvA will nicht hinsehen.")}, g)

g = grid(34, 11, fa=6, ca=27); lamps(g, 11, 22)
block(g, 9, 3, 1); block(g, 15, 3, 1); block(g, 21, 3, 1); put(g, 12, 6, "========")
put(g, 18, 9, "1"); put(g, 30, 9, "1")
room("rs_kontrollraum", {"name": "Silo · Kontrollraum", "tags": ["corridor"], "weight": 2, "terrain": M, "atmosphere": "beton_neon",
  "description": N("Bildschirme in drei Reihen, auf allen derselbe Countdown. Er steht.")}, g)

g = grid(38, 13, fa=31, ca=6); lamps(g, 15, 26)
rect(g, 10, 9, 8, 3); rect(g, 22, 9, 8, 3)                                      # two generators to climb over
put(g, 15, 6, "=========="); put(g, 20, 5, "C")
put(g, 13, 8, "1"); put(g, 34, 11, "1"); put(g, 20, 11, "1")
room("rs_generator", {"name": "Silo · Generatorhalle", "tags": ["combat"], "weight": 2, "terrain": M, "atmosphere": "metall_rost",
  "description": N("Zwei Dieselgeneratoren so groß wie Lastwagen. Einer läuft noch und hält alles am Leben.")}, g)

g = grid(36, 11, fa=6, ca=29); lamps(g, 13, 23)
block(g, 11, 3, 2); block(g, 14, 3, 1); block(g, 22, 4, 2); put(g, 22, 6, "====")
put(g, 12, 6, "==="); put(g, 13, 5, "C")
put(g, 18, 9, "1"); put(g, 31, 9, "1")
room("rs_lager", {"name": "Silo · Munitionslager", "tags": ["combat"], "weight": 2, "terrain": B, "atmosphere": "bunker_rot",
  "description": N("Gelb-schwarze Kisten bis unter die Decke. Bloß nicht danebenschießen.")}, g)

g = grid(40, 14, fa=33, ca=6); lamps(g, 14, 26)
put(g, 18, 2, "############"); col(g, 26, 3, 6, "#"); put(g, 22, 7, "======")         # the crane on its rail, the hook over a pallet
block(g, 13, 5, 1)
put(g, 9, 12, "1"); put(g, 30, 12, "1"); put(g, 24, 6, "1")
room("rs_werkstatt", {"name": "Silo · Werkstatt mit Kran", "tags": ["combat"], "weight": 2, "terrain": M, "atmosphere": "metall_rost",
  "description": N("Ein gelber Kran hängt über einer Palette mit Raketenteilen. Hier schrauben sie am Countdown.")}, g)

g = grid(18, 20, fa=4, ca=13)
for y, x in ((15, 7), (12, 2), (9, 8), (6, 3), (3, 9)): put(g, x, y, "=====")
put(g, 9, 18, "1")
room("rs_lueftung", {"name": "Silo · Lüftungsschacht", "tags": ["corridor"], "weight": 2, "terrain": M, "atmosphere": "tunnel_blau",
  "description": N("Ein riesiger Ventilator dreht sich langsam. Es zieht nach unten.")}, g)

g = grid(22, 22, fa=17, ca=4)
for y, x in ((18, 8), (15, 13), (12, 6), (9, 11), (6, 5), (3, 12)): put(g, x, y, "=====")
put(g, 10, 20, "1"); put(g, 7, 11, "1")
room("rs_treppenhaus", {"name": "Silo · Treppenhaus", "tags": ["corridor"], "weight": 2, "terrain": C, "atmosphere": "beton_lager",
  "description": N("Gitterstufen im Zickzack, sechs Etagen tief. Wer hier fällt, fällt lange.")}, g)

g = grid(34, 11, fa=27, ca=6); lamps(g, 12, 22)
block(g, 10, 6, 1); block(g, 19, 6, 1); put(g, 11, 6, "====")
put(g, 16, 9, "1"); put(g, 30, 9, "1")
room("rs_kantine", {"name": "Silo · Kantine", "tags": ["combat"], "weight": 1, "terrain": B, "atmosphere": "beton_lager",
  "description": N("Lange Tische, Blechteller, ein Speiseplan von vor dem Krieg: Freitag Fisch.")}, g)

g = grid(36, 11, fa=6, ca=29); lamps(g, 18)
put(g, 10, 6, "=========="); put(g, 22, 6, "=========="); put(g, 14, 5, "C")
col(g, 20, 1, 5, "#")
put(g, 12, 9, "1"); put(g, 26, 9, "1"); put(g, 32, 9, "1")
room("rs_galerie", {"name": "Silo · Wartungsgalerie", "tags": ["corridor"], "weight": 2, "terrain": M, "atmosphere": "metall_rost",
  "description": N("Ein Laufsteg rund um den Schacht, durch die Gitter sieht man die Rakete.")}, g)

g = grid(38, 13, fa=31, ca=6); lamps(g, 13, 25)
block(g, 9, 4, 2); block(g, 26, 4, 2); put(g, 15, 7, "========")
put(g, 18, 6, "C"); put(g, 22, 11, "1"); put(g, 12, 11, "1"); put(g, 34, 11, "1")
room("rs_serverraum", {"name": "Silo · Serverraum", "tags": ["combat"], "weight": 2, "terrain": M, "atmosphere": "beton_neon",
  "description": N("Schrankreihen voller Bänder. Irgendwo darin denkt jemand nach.")}, g)

# ---------------------------------------------------------------------------------------------------------------------
# the bottom: the flooded launch pad, the boss (k = Major Null), the goal and the Silo-KI's terminal (@, optional)
# ---------------------------------------------------------------------------------------------------------------------
g = grid(48, 16, ca=10); lamps(g, 18, 30)
rect(g, 20, 1, 8, 5)                                                              # the rocket's nozzle above the pad
put(g, 4, 9, "======"); put(g, 38, 9, "======"); put(g, 39, 8, "@")
put(g, 6, 8, "Z")
put(g, 24, 14, "k"); put(g, 14, 14, "1"); put(g, 33, 14, "1")
room("rs_startrampe", {"name": "Silo · Startrampe", "tags": ["exit", "boss"], "weight": 1, "terrain": M, "atmosphere": "bunker_reaktor",
  "spawns": [{"symbol": "k", "enemy": "major_null"}],
  "description": N("Der Flammenschacht, knöcheltief unter Wasser. Major Null wartet. Oben auf der Bühne: das Terminal der Silo-KI.")}, g)

# ---------------------------------------------------------------------------------------------------------------------
# side rooms (loot / secret), they dock through the open seams next to a main room
# ---------------------------------------------------------------------------------------------------------------------
def side(id, name, tags, atmo, desc, w, build):
    g = grid(w, 11); build(g)
    room(id, {"name": name, "tags": tags, "weight": 1, "terrain": B if "loot" in tags else M, "atmosphere": atmo, "description": N(desc)}, g)
side("rs_waffenkammer", "Silo · Waffenkammer", ["loot"], "bunker_rot", "Gewehrständer, leer bis auf zwei. Und die Kisten darunter.", 16,
  lambda g: (lamps(g, 8), put(g, 3, 9, "C"), put(g, 12, 9, "C")))
side("rs_funkraum", "Silo · Funkraum", ["loot"], "beton_neon", "Von hier sendet der Countdown in die Berge. Ein Notizbuch voller Frequenzen.", 14,
  lambda g: (lamps(g, 7), put(g, 4, 6, "===="), put(g, 5, 5, "C"), put(g, 10, 9, "C")))
side("rs_vorrat", "Silo · Vorratsraum", ["loot"], "beton_lager", "Konserven für dreißig Jahre. Die Hälfte ist noch da.", 14,
  lambda g: (lamps(g, 7), put(g, 3, 9, "C"), put(g, 10, 9, "C")))
side("rs_archiv", "Silo · Archiv", ["loot"], "ministerium_kalt", "Aktenschränke mit Stempeln: STRENG GEHEIM. Einer klemmt.", 16,
  lambda g: (lamps(g, 8), block(g, 4, 3, 1), put(g, 4, 7, "==="), put(g, 5, 6, "C"), put(g, 12, 9, "C")))
side("rs_offiziersmesse", "Silo · Offiziersmesse", ["loot"], "kino_dunkel", "Ledersessel, ein Billardtisch, Whisky im Schrank. Die Offiziere hatten es besser.", 18,
  lambda g: (lamps(g, 9), block(g, 7, 4, 1), put(g, 3, 9, "C"), put(g, 15, 9, "C")))
def secret(g, x):
    col(g, x, 7, 9, "%"); col(g, x, 1, 6, "#")
side("rs_kryokammer", "Silo · Kryokammer", ["secret"], "markt_neon", "Hinter einer Scheinwand: drei weitere Röhren, zwei leer.", 16,
  lambda g: (secret(g, 10), put(g, 12, 9, "C"), put(g, 13, 9, "C")))
side("rs_bunker_privat", "Silo · Privatbunker", ["secret"], "bunker_reaktor", "Der Kommandant wollte überleben, auch wenn sonst keiner überlebt.", 16,
  lambda g: (col(g, 6, 7, 9, "$"), col(g, 6, 1, 6, "#"), put(g, 9, 9, "C"), put(g, 12, 9, "C")))
side("rs_wartungsnische", "Silo · Wartungsnische", ["loot"], "metall_rost", "Ein Werkzeugwagen, eine Kiste Ersatzteile, eine Tasse kalter Kaffee.", 12,
  lambda g: (lamps(g, 6), put(g, 3, 9, "C")))

out = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/poi_rooms_057.json")
out.write_text(json.dumps(R, ensure_ascii=False))
print(len(R), "Räume →", out)
