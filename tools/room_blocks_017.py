# Usage: python3 tools/room_blocks_017.py /tmp/new.json  → then merge into projects/nomadgirl/data/rooms.json (the rooms are in the data now; edit them in the workshop)
# New room blocks for #017 (Daniel 14.11.2026: „Mehr Raum-Bausteine“), built by code so widths and seams are always right.
# Rules: floor = last row; the three rows above it are open at both edges (seams to the next room); Leyla is 3 tiles tall, jumps ~3;
# obstacles on the floor are 2 tiles high; platforms (=) every 2–3 tiles up; A in the ceiling = a side room may hang above.
import json, sys
R = {}
def grid(w, h=17, a=None):
    g = [list("#" + "." * (w - 2) + "#") for _ in range(h)]
    g[0] = list("#" * w); g[-1] = list("#" * w)
    if a is not None: g[0][a] = "A"
    for y in (h - 4, h - 3, h - 2): g[y][0] = "."; g[y][-1] = "."
    return g
def put(g, x, y, s):
    for k, c in enumerate(s):
        assert 0 <= x + k < len(g[0]) and 0 <= y < len(g), (x, y, s)
        g[y][x + k] = c
def col(g, x, y0, y1, c):
    for y in range(y0, y1 + 1): g[y][x] = c
def lamps(g, *xs):
    for x in xs: put(g, x, 1, "*")
def block(g, x, w, h=2):
    for y in range(len(g) - 1 - h, len(g) - 1): put(g, x, y, "#" * w)
def room(id, meta, g):
    rows = ["".join(r) for r in g]
    assert all(len(r) == len(rows[0]) for r in rows), id
    R[id] = {**meta, "size": [len(rows[0]), len(rows)], "layout": rows}

F = 16   # floor row

# --- Tankstelle ---
g = grid(36, a=17); lamps(g, 11, 25)
for x in (5, 25): [put(g, x, y, "####") for y in (3, 4, 5)]          # hanging washing brushes
put(g, 16, 3, "o")                                                   # rope over the foam pit
put(g, 3, 11, "=====" ); put(g, 26, 11, "=====")
put(g, 9, 13, "=====" ); put(g, 11, 12, "C")
block(g, 15, 1); block(g, 29, 1)
put(g, 4, 15, "1"); put(g, 23, 15, "1"); put(g, 32, 15, "1")
room("waschstrasse", {"name": "Waschstraße", "tags": ["corridor", "combat"], "weight": 3, "terrain": "concrete",
  "description": "Eine Waschanlage ohne Wasser. Die Bürsten hängen tief, darüber ein Seil (#017)."}, g)

g = grid(34)
put(g, 5, 4, "=================")                                    # the roof
col(g, 18, 4, 15, "H")                                               # ladder up through the roof
put(g, 23, 11, "=======" ); put(g, 26, 10, "C")
block(g, 5, 2); block(g, 14, 2); block(g, 23, 2)                     # pumps as cover
put(g, 4, 15, "1"); put(g, 21, 15, "1"); put(g, 30, 15, "1")
room("zapfinseln", {"name": "Zapfinseln", "tags": ["combat"], "weight": 3, "terrain": "desert", "backdrop": {"weather": "abendglut", "shade": 20},
  "description": "Drei Zapfinseln unter einem halb eingestürzten Dach. Die Säulen geben Deckung, oben liegt was (#017)."}, g)

g = grid(30, a=6); lamps(g, 9, 17)
put(g, 8, 13, "=====")
put(g, 14, 11, "======")
put(g, 20, 7, "#########"); col(g, 20, 8, 10, "%"); put(g, 20, 11, "#########"); put(g, 27, 10, "C")
block(g, 3, 3); block(g, 23, 2)
put(g, 1, 15, "1"); put(g, 15, 15, "1")
room("reifenlager", {"name": "Reifenlager", "tags": ["corridor"], "weight": 2, "terrain": "concrete", "atmosphere": "beton_lager",
  "description": "Reifenstapel bis unter die Decke. Über zwei Stege erreicht man eine Wand, die hohl klingt (#017)."}, g)

# --- Großmarkt ---
g = grid(38, a=18); lamps(g, 5, 18, 32)
put(g, 11, 8, "=============")
put(g, 3, 11, "=====" ); put(g, 28, 11, "=======")
put(g, 12, 13, "=====" ); put(g, 15, 12, "C")
block(g, 6, 3); block(g, 27, 3)                                      # burnt-out cars
put(g, 2, 15, "1"); put(g, 19, 15, "1"); put(g, 34, 15, "1")
room("markt_parkdeck", {"name": "Markt · Parkdeck", "tags": ["corridor", "combat"], "weight": 2, "terrain": "concrete", "atmosphere": "beton_lager",
  "description": "Das obere Parkdeck. Ausgebrannte Autos als Deckung, Rampen nach oben (#017)."}, g)

g = grid(32); lamps(g, 4, 14, 24)
put(g, 2, 8, "=============="); col(g, 15, 8, 15, "H")
put(g, 23, 11, "#########"); put(g, 27, 10, "C")      # gallery
put(g, 18, 13, "====")                                               # step up to it
block(g, 4, 2)
put(g, 8, 15, "1"); put(g, 20, 15, "1"); put(g, 28, 15, "1")
room("markt_spielhalle", {"name": "Markt · Spielhalle", "tags": ["combat"], "weight": 2, "terrain": "mall", "atmosphere": "markt_neon",
  "description": "Automaten blinken noch. Links eine Galerie mit Leiter, rechts eine zweite über einen Tritt (#017)."}, g)

# --- Bunker 13 ---
g = grid(34, a=17); lamps(g, 6, 16, 28)
put(g, 8, 9, "=======" ); put(g, 23, 9, "======")
block(g, 21, 7); put(g, 26, 13, "C")                                 # serving counter with a chest on it
block(g, 3, 2); block(g, 11, 2)
put(g, 7, 15, "1"); put(g, 17, 15, "1"); put(g, 31, 15, "1")
room("bunker_kantine", {"name": "Bunker · Kantine", "tags": ["combat"], "weight": 2, "terrain": "bunker", "atmosphere": "bunker_rot",
  "description": "Lange Tische, umgekippte Bänke. Auf der Essensausgabe steht noch eine Kiste (#017)."}, g)

g = grid(28); lamps(g, 6, 16)
put(g, 10, 5, "o"); put(g, 18, 5, "o")
put(g, 2, 11, "====" ); put(g, 21, 11, "====")
block(g, 6, 3); block(g, 15, 3)
put(g, 2, 15, "1"); put(g, 23, 15, "1")
room("bunker_lueftung", {"name": "Bunker · Lüftung", "tags": ["corridor"], "weight": 2, "terrain": "bunker", "atmosphere": "bunker_reaktor",
  "description": "Riesige Ventilatoren, Stege und Seile. Unten zieht es (#017)."}, g)

# --- Ministerium ---
g = grid(36, a=17); lamps(g, 5, 16, 30)
put(g, 5, 11, "=========" ); put(g, 22, 11, "=========")
for x in (6, 12, 22, 28): block(g, x, 2)                             # rows of chairs
put(g, 2, 15, "1"); put(g, 17, 15, "1"); put(g, 33, 15, "1")
room("min_wartesaal", {"name": "Ministerium · Wartesaal", "tags": ["corridor", "combat"], "weight": 3, "terrain": "marble", "atmosphere": "ministerium_kalt",
  "description": "Stuhlreihen, eine Nummernanzeige, die seit Jahren 404 zeigt. Bitte ziehen Sie eine Nummer (#017)."}, g)

g = grid(34); lamps(g, 6, 17, 28)
put(g, 3, 7, "============="); col(g, 16, 7, 15, "H")
put(g, 22, 10, "###########"); put(g, 25, 9, "C")   # gallery
put(g, 17, 13, "====")                                               # step up to it
block(g, 5, 3); block(g, 26, 3)
put(g, 2, 15, "1"); put(g, 20, 15, "1"); put(g, 31, 15, "1")
room("min_registratur", {"name": "Ministerium · Registratur", "tags": ["combat"], "weight": 2, "terrain": "marble", "atmosphere": "ministerium_kalt",
  "description": "Akten bis zur Decke. Zwei Galerien, eine mit Leiter, eine über einen Tritt (#017)."}, g)

json.dump(R, open(sys.argv[1], 'w'), ensure_ascii=False)
print(len(R), "Räume")
for k, r in R.items(): print("\n" + k); print("\n".join(r["layout"]))
