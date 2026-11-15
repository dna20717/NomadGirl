#!/usr/bin/env python3
# Usage: python3 tools/poi_rooms_038.py /tmp/new.json && node tools/merge_rooms.mjs /tmp/new.json  (afterwards edit the rooms in the workshop)
# Room blocks for #038 (Daniel 15.11.2026: „einen Stapel verschiedene POIs verschiedener Größe … unterirdische oder insgesamt
# vertikale wie Hochhaus-Ruinen“): eight new POIs, built by code so hooks, seams and ladder columns are always right.
# Rules (see tools/room_blocks_017.py): floor = last row; the three rows above it are open at both edges (seams: side rooms, the
# shaft); Leyla is 3 tiles tall, jumps ~3; A in the ceiling = the room above / a side room joins here (the column below stays free
# for the ladder), A in the floor = this room sits on the one below (stacked POIs) or hangs over a main room (side rooms).
import json, sys
from pathlib import Path

R = {}

def grid(w, h=17, fa=None, ca=None, seams=(True, True)):
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
    # ceiling hooks: the column below must be free to the floor (or a platform) for the ladder
    for x, c in enumerate(rows[0]):
        if c == "A":
            for y in range(1, h - 1):
                assert rows[y][x] not in "#", f"{id}: ladder column {x} blocked at row {y}"
                if rows[y][x] == "=": break
    # floor hooks: three free rows above (Leyla comes up the ladder there)
    for x, c in enumerate(rows[-1]):
        if c == "A":
            for y in (h - 2, h - 3, h - 4): assert rows[y][x] in ".*", f"{id}: floor hook {x} covered at row {y}"
    R[id] = {**meta, "size": [len(rows[0]), h], "layout": rows}

OUT = {"weather": "abendglut", "shade": 25}
NIGHT = {"weather": "nacht", "shade": 30}

# =====================================================================================================================
# Delta Heights: high-rise ruin (tower, L). Floors are 11 rows (9 free), the lobby and the roof are taller.
# =====================================================================================================================
T = "ruins"
g = grid(40, 17, ca=33); lamps(g, 20, 28)
put(g, 12, 13, "########"); put(g, 12, 12, "=======")                # reception desk
put(g, 22, 10, "======"); put(g, 28, 7, "====")                      # mezzanine
put(g, 29, 6, "C")
put(g, 5, 15, "L"); put(g, 20, 15, "1"); put(g, 26, 15, "1")
col(g, 37, 12, 12, "#")
room("hh_lobby", {"name": "Hochhaus · Lobby", "tags": ["start"], "weight": 1, "terrain": T, "atmosphere": "ruine_staub", "backdrop": OUT, "indoor": True,
  "description": "Drehtüren ohne Glas, ein Empfangstresen, der Aufzugsschacht dient als Leiter nach oben (#038)."}, g)

g = grid(32, 11, fa=5, ca=26); lamps(g, 9, 16, 23)
block(g, 10, 3, 1); block(g, 18, 3, 1)
put(g, 12, 7, "=====")
put(g, 8, 9, "1"); put(g, 21, 9, "1"); put(g, 29, 9, "1")
room("hh_buero", {"name": "Hochhaus · Büroetage", "tags": ["combat"], "weight": 3, "terrain": T, "atmosphere": "ruine_staub",
  "description": "Schreibtische als Deckung, ein Regal als Steg. Klassisches Großraumbüro, nur mit mehr Patronen (#038)."}, g)

g = grid(36, 11, fa=30, ca=4); lamps(g, 12, 24)
put(g, 9, 2, "#####"); put(g, 22, 2, "######")                      # collapsed ceiling slabs
put(g, 9, 6, "======="); put(g, 21, 7, "======")
put(g, 25, 6, "C")
block(g, 16, 2, 1)
put(g, 14, 9, "1"); put(g, 26, 9, "1")
room("hh_einsturz", {"name": "Hochhaus · Eingestürzte Decke", "tags": ["combat", "corridor"], "weight": 2, "terrain": T, "atmosphere": "ruine_staub",
  "description": "Die Decke hängt in Platten herunter. Oben auf den Trümmern liegt was (#038)."}, g)

g = grid(16, 17, fa=3, ca=12)
for y, x in ((12, 5), (9, 2), (6, 5), (3, 2)): put(g, x, y, "=====")
for y, x in ((12, 9),): put(g, x, y, "")
put(g, 8, 15, "1")
room("hh_treppenhaus", {"name": "Hochhaus · Treppenhaus", "tags": ["corridor"], "weight": 2, "terrain": "concrete", "atmosphere": "beton_lager",
  "description": "Zwei Etagen hoch, die Treppen sind weg, die Absätze nicht. Rechts der Schacht nach oben (#038)."}, g)

g = grid(34, 11, fa=16, ca=29)
put(g, 1, 2, "......"); put(g, 27, 2, "..")                         # the outer wall is gone: sky
put(g, 7, 7, "====="); put(g, 21, 7, "=====")
put(g, 8, 6, "1"); put(g, 23, 9, "1"); put(g, 4, 9, "1")
block(g, 12, 2, 1)
room("hh_rohbau", {"name": "Hochhaus · Rohbau", "tags": ["combat"], "weight": 2, "terrain": T, "atmosphere": "ruine_staub", "backdrop": OUT,
  "description": "Hier wurde nie fertig gebaut. Wind von allen Seiten, Stahlträger statt Wände (#038)."}, g)

g = grid(30, 11, fa=24, ca=6); lamps(g, 15)
put(g, 10, 6, "##########"); col(g, 10, 7, 9, "#"); col(g, 19, 7, 9, "$")                                                     # a cracked wall into the archive
put(g, 13, 9, "C"); put(g, 16, 9, "C")
put(g, 3, 9, "1"); put(g, 22, 9, "1")
room("hh_archiv", {"name": "Hochhaus · Aktenarchiv", "tags": ["corridor"], "weight": 1, "terrain": "concrete", "atmosphere": "beton_lager",
  "description": "Ein Rollregal-Raum, eine Wand klingt hohl. Die Akten sind Brennstoff, die Kisten nicht (#038)."}, g)

g = grid(38, 15, fa=8)
for x in range(1, 37): g[1][x] = "."; g[2][x] = "."                  # open roof: sky
g[0] = list("#" * 38)
put(g, 14, 9, "=========="); put(g, 17, 8, "Z")                       # the penthouse safe on a podium
put(g, 26, 6, "====="); put(g, 28, 5, "C")
put(g, 12, 13, "1"); put(g, 24, 13, "1"); put(g, 32, 13, "1")
block(g, 20, 2, 1)
room("hh_penthouse", {"name": "Hochhaus · Penthouse", "tags": ["exit"], "weight": 1, "terrain": T, "atmosphere": "ruine_staub", "backdrop": OUT,
  "description": "Ganz oben: ein Pool ohne Wasser, ein Tresor auf einem Podest, die ganze Stadt im Blick (#038)."}, g)

g = grid(14, 11, fa=7); lamps(g, 7)
put(g, 3, 9, "C"); put(g, 10, 9, "C")
put(g, 4, 6, "======")
room("hh_serverraum", {"name": "Hochhaus · Serverraum", "tags": ["loot"], "weight": 1, "terrain": "metal", "atmosphere": "beton_neon",
  "description": "Kühl und blinkend. Hier stehen noch Geräte, die jemand haben will (#038)."}, g)

g = grid(16, 11, fa=8)
col(g, 5, 7, 9, "%")
put(g, 2, 9, "C")
put(g, 11, 9, "1")
room("hh_chefzimmer", {"name": "Hochhaus · Chefzimmer", "tags": ["secret"], "weight": 1, "terrain": "marble", "atmosphere": "ministerium_kalt",
  "description": "Teppich, Bar, eine Wand mit Bücherattrappe. Dahinter der Notgroschen (#038)."}, g)

# =====================================================================================================================
# P+R Delta Süd: car park (tower, M). Decks are 10 rows; cars are 3×2 blocks with a platform roof.
# =====================================================================================================================
T = "concrete"
def car(g, x): block(g, x, 4, 2); put(g, x, feet(g) - 2, "====")

g = grid(34, 12, ca=28); lamps(g, 16)
put(g, 1, 2, "......")
put(g, 11, 8, "#"); put(g, 11, 7, "=========")                         # the barrier, a booth roof
put(g, 4, 10, "L"); put(g, 20, 10, "1")
car(g, 14)
room("ph_einfahrt", {"name": "Parkhaus · Einfahrt", "tags": ["start"], "weight": 1, "terrain": T, "atmosphere": "beton_neon", "backdrop": OUT,
  "description": "Schranke oben, Ticketautomat geplündert. Die Rampe ist eingestürzt, eine Leiter führt aufs erste Deck (#038)."}, g)

g = grid(36, 10, fa=4, ca=31); lamps(g, 10, 22)
car(g, 9); car(g, 19)
put(g, 15, 8, "1"); put(g, 26, 8, "1")
room("ph_deck", {"name": "Parkhaus · Parkdeck", "tags": ["combat"], "weight": 3, "terrain": T, "atmosphere": "beton_neon",
  "description": "Ausgebrannte Autos in Reihe, niedrige Decke. Jedes Dach ein Sprungbrett (#038)."}, g)

g = grid(32, 10, fa=27, ca=3); lamps(g, 16)
put(g, 8, 6, "=========="); put(g, 18, 4, "C")
put(g, 17, 5, "#####")
car(g, 22)
put(g, 12, 8, "1"); put(g, 19, 8, "1")
room("ph_rampe", {"name": "Parkhaus · Rampe", "tags": ["corridor"], "weight": 2, "terrain": T, "atmosphere": "beton_lager",
  "description": "Die Auffahrt zum nächsten Deck, halb weggebrochen. Ein Kleinwagen klemmt unter der Decke (#038)."}, g)

g = grid(34, 10, fa=29, ca=6)
car(g, 10); car(g, 22)
col(g, 16, 1, 5, "#"); col(g, 16, 6, 7, "B")                         # a cracked pillar, behind it a hidden corner
put(g, 18, 8, "1"); put(g, 3, 8, "1")
room("ph_deck_dunkel", {"name": "Parkhaus · Dunkles Deck", "tags": ["combat"], "weight": 2, "terrain": T, "atmosphere": "kino_dunkel",
  "description": "Hier brennt keine Lampe mehr. Ein Pfeiler ist nur noch Putz (#038)."}, g)

g = grid(36, 13, fa=5)
for x in range(1, 35): g[1][x] = "."; g[2][x] = "."
put(g, 14, 8, "########"); put(g, 16, 7, "Z")                         # the roof booth with the cash safe
car(g, 26)
put(g, 10, 11, "1"); put(g, 30, 9, "1"); put(g, 23, 11, "1")
room("ph_dach", {"name": "Parkhaus · Dachdeck", "tags": ["exit"], "weight": 1, "terrain": T, "atmosphere": "wueste_draussen", "backdrop": OUT,
  "description": "Oben offen, der Kassenautomat steht auf dem Häuschen. Die Gang hat hier ihre Grillparty (#038)."}, g)

g = grid(12, 10, fa=6); lamps(g, 6)
put(g, 2, 8, "C"); put(g, 9, 8, "C")
room("ph_kassenhaus", {"name": "Parkhaus · Kassenhaus", "tags": ["loot"], "weight": 1, "terrain": T, "atmosphere": "beton_neon",
  "description": "Ein Glaskasten voller Münzrollen und Schlüssel (#038)."}, g)

# =====================================================================================================================
# Funkmast KM 31: radio mast (tower, S): a narrow steel lattice, sky everywhere.
# =====================================================================================================================
T = "metal"
g = grid(30, 13, ca=20)
put(g, 1, 2, "............................")
put(g, 5, 11, "L")
block(g, 13, 4, 2); put(g, 13, 8, "====")                              # the transmitter hut
put(g, 15, 7, "C")
put(g, 25, 11, "1")
room("fm_fuss", {"name": "Funkmast · Fuß", "tags": ["start"], "weight": 1, "terrain": "desert", "atmosphere": "wueste_draussen", "backdrop": OUT,
  "description": "Ein Sendehäuschen, ein Zaun, ein Mast, der in den Himmel ragt (#038)."}, g)

g = grid(18, 14, fa=4, ca=13)
for x in range(1, 17): g[1][x] = "."
for y, x in ((9, 7), (5, 3), (5, 10)): put(g, x, y, "=====")
put(g, 8, 12, "1")
room("fm_gitter", {"name": "Funkmast · Gitter", "tags": ["corridor"], "weight": 2, "terrain": T, "atmosphere": "metall_rost", "backdrop": OUT,
  "description": "Stahlgitter und Wind. Eine Drohne kreist (#038)."}, g)

g = grid(22, 12, fa=16, ca=4)
for x in range(1, 21): g[1][x] = "."
put(g, 7, 7, "========"); put(g, 9, 6, "1")
put(g, 15, 10, "1")
room("fm_plattform", {"name": "Funkmast · Plattform", "tags": ["combat"], "weight": 2, "terrain": T, "atmosphere": "metall_rost", "backdrop": OUT,
  "description": "Eine Wartungsplattform mit Antennen. Wer hier oben wohnt, hat gute Sicht (#038)."}, g)

g = grid(24, 14, fa=12)
for x in range(1, 23): g[1][x] = "."; g[2][x] = "."
put(g, 6, 8, "============"); put(g, 11, 7, "Z")
put(g, 4, 12, "1"); put(g, 19, 12, "1")
put(g, 20, 5, "===="); put(g, 21, 4, "C")
room("fm_spitze", {"name": "Funkmast · Spitze", "tags": ["exit"], "weight": 1, "terrain": T, "atmosphere": "metall_rost", "backdrop": OUT,
  "description": "Ganz oben blinkt noch die rote Lampe. Der Sender-Kern sitzt im Kasten (#038)."}, g)

g = grid(12, 11, fa=6)
put(g, 2, 9, "C"); col(g, 9, 7, 9, "B"); put(g, 10, 9, "C")
room("fm_kabine", {"name": "Funkmast · Technikkabine", "tags": ["loot"], "weight": 1, "terrain": T, "atmosphere": "metall_rost",
  "description": "Ein Blechkasten mit Ersatzteilen. Die hintere Tür klemmt (#038)."}, g)

# =====================================================================================================================
# Metro Line 4 · Delta Central (deep, M): from the street down the stairs, ticket hall, escalators, platforms.
# =====================================================================================================================
T = "concrete"
g = grid(34, 13, fa=26)
put(g, 1, 2, "................................")
put(g, 4, 11, "L")
put(g, 20, 8, "#####"); put(g, 20, 7, "=====")                         # the entrance hood
col(g, 24, 9, 10, "#")
put(g, 14, 11, "1")
room("mt_eingang", {"name": "Metro · Eingang", "tags": ["start"], "weight": 1, "terrain": "desert", "atmosphere": "wueste_draussen", "backdrop": OUT,
  "description": "Ein U-Bahn-Schild, eine Treppe ins Dunkle. Die Rolltreppe ist längst eine Leiter (#038)."}, g)

g = grid(36, 11, fa=8, ca=28); lamps(g, 12, 22)
put(g, 14, 5, "########"); put(g, 14, 4, "========"); col(g, 14, 6, 9, "#"); col(g, 21, 6, 9, "B")   # ticket booth, bricked up badly
put(g, 16, 9, "C")
put(g, 4, 9, "1"); put(g, 25, 9, "1"); put(g, 32, 9, "1")
room("mt_halle", {"name": "Metro · Schalterhalle", "tags": ["combat"], "weight": 2, "terrain": T, "atmosphere": "tunnel_blau",
  "description": "Drehkreuze, ein Fahrkartenschalter mit Gitter. Die Kasse ist zugemauert, aber nicht gut (#038)."}, g)

g = grid(30, 17, fa=25, ca=4); lamps(g, 15)
for k in range(5): put(g, 7 + k * 3, 13 - k * 2, "====")
put(g, 21, 3, "C")
put(g, 12, 15, "1"); put(g, 20, 15, "1")
room("mt_rolltreppe", {"name": "Metro · Rolltreppen", "tags": ["corridor"], "weight": 2, "terrain": "metal", "atmosphere": "tunnel_blau",
  "description": "Drei Rolltreppen, eine schräge Treppe aus Stufen-Absätzen. Oben am Ende glänzt was (#038)."}, g)

g = grid(44, 12, fa=36, ca=6); lamps(g, 12, 22, 32)
for x in range(13, 31): put(g, x, 10, "#"); put(g, x, 11, "#")
for x in range(14, 30): g[10][x] = "."                                   # the track pit
put(g, 14, 9, "................")
put(g, 13, 10, "#"); put(g, 30, 10, "#")
put(g, 18, 6, "======="); put(g, 21, 5, "C")                           # a carriage roof
put(g, 4, 9, "1"); put(g, 20, 10, "1"); put(g, 35, 9, "1"); put(g, 40, 9, "1")
room("mt_bahnsteig", {"name": "Metro · Bahnsteig", "tags": ["combat"], "weight": 3, "terrain": T, "atmosphere": "tunnel_blau",
  "description": "Zwei Bahnsteige, dazwischen das Gleisbett. Auf dem Waggon-Dach liegt jemandes Vorrat (#038)."}, g)

g = grid(32, 13, ca=24); lamps(g, 10, 20)
put(g, 10, 7, "======="); put(g, 13, 6, "Z")
block(g, 5, 2, 1); block(g, 19, 3, 2)
put(g, 15, 11, "1"); put(g, 26, 11, "1")
room("mt_stellwerk", {"name": "Metro · Stellwerk", "tags": ["exit"], "weight": 1, "terrain": "metal", "atmosphere": "bunker_rot",
  "description": "Die Leitzentrale der Linie 4. Der Steuer-Kern liegt im Pult, die Notleiter führt zurück nach oben (#038)."}, g)

g = grid(14, 11, fa=7); lamps(g, 7)
put(g, 2, 9, "C"); put(g, 4, 6, "======")
room("mt_kiosk", {"name": "Metro · Kiosk", "tags": ["loot"], "weight": 1, "terrain": T, "atmosphere": "markt_neon",
  "description": "Zeitschriften von vor dem Krieg, Kaugummi, eine Kasse (#038)."}, g)

g = grid(16, 11, fa=8)
col(g, 6, 7, 9, "%"); col(g, 6, 1, 6, "#"); put(g, 2, 9, "C"); put(g, 4, 9, "C")
room("mt_geisterbahnhof", {"name": "Metro · Geisterbahnhof", "tags": ["secret"], "weight": 1, "terrain": T, "atmosphere": "kino_dunkel",
  "description": "Eine Station, die auf keinem Plan steht. Hinter einer Werbetafel geht es weiter (#038)."}, g)

# =====================================================================================================================
# Storm Drain 9: sewer (deep, S), mutants.
# =====================================================================================================================
g = grid(26, 12, fa=18)
put(g, 1, 2, "........................")
put(g, 4, 10, "L"); put(g, 12, 7, "======"); put(g, 14, 6, "C")
room("kn_gully", {"name": "Kanal · Gully", "tags": ["start"], "weight": 1, "terrain": "desert", "atmosphere": "wueste_draussen", "backdrop": OUT,
  "description": "Ein offener Kanaldeckel am Straßenrand. Es riecht nach Ärger (#038)."}, g)

g = grid(38, 11, fa=6, ca=32)
for x in range(12, 26): g[9][x] = "."; g[10][x] = "#"
put(g, 11, 9, "#"); put(g, 26, 9, "#")
for x in range(11, 27): g[8][x] = "." if g[8][x] == "#" else g[8][x]
put(g, 15, 6, "========")
put(g, 4, 9, "1"); put(g, 18, 9, "1"); put(g, 30, 9, "1")
room("kn_kanal", {"name": "Kanal · Kanal", "tags": ["combat"], "weight": 3, "terrain": "concrete", "atmosphere": "tunnel_blau",
  "description": "Ein Kanal mit Laufsteg. In der Rinne bewegt sich etwas (#038)."}, g)

g = grid(20, 15, fa=15, ca=4)
for y, x in ((10, 8), (7, 12), (4, 6)): put(g, x, y, "=====")
put(g, 8, 3, "C"); col(g, 17, 10, 12, "$")
put(g, 10, 13, "1")
room("kn_ueberlauf", {"name": "Kanal · Überlauf", "tags": ["corridor"], "weight": 2, "terrain": "concrete", "atmosphere": "tunnel_blau",
  "description": "Ein hohes Überlaufbecken mit Wartungsstegen. Eine Kachelwand ist nur Fassade (#038)."}, g)

g = grid(36, 15, ca=8); lamps(g, 18)
put(g, 14, 9, "========"); put(g, 17, 8, "Z")
for x in range(6, 30, 6): col(g, x, 1, 3, "#")
put(g, 22, 13, "1"); put(g, 28, 13, "1"); put(g, 12, 13, "1")
room("kn_sammler", {"name": "Kanal · Sammler", "tags": ["exit"], "weight": 1, "terrain": "concrete", "atmosphere": "bunker_reaktor",
  "description": "Eine Kathedrale aus Beton, in der Mitte das Nest. Was es bewacht, ist wertvoll (#038)."}, g)

g = grid(14, 10, fa=7)
put(g, 2, 8, "C"); put(g, 11, 8, "C")
room("kn_nest", {"name": "Kanal · Nest", "tags": ["loot"], "weight": 1, "terrain": "concrete", "atmosphere": "bunker_rot",
  "description": "Hier haben die Viecher gesammelt, was glänzt (#038)."}, g)

# =====================================================================================================================
# Pit 6: salt mine (deep, XL): the headframe on the surface, galleries, a cavern, the deepest level.
# =====================================================================================================================
g = grid(38, 15, fa=30)
for x in range(1, 37): g[1][x] = "."; g[2][x] = "."
put(g, 4, 13, "L")
col(g, 26, 3, 12, "#"); col(g, 34, 3, 12, "#"); put(g, 26, 3, "#########")   # the headframe
for x in range(27, 34): g[13][x] = "."; g[12][x] = "."; g[11][x] = "."
col(g, 26, 10, 12, "."); col(g, 34, 10, 12, ".")
put(g, 27, 7, "=======")
put(g, 14, 10, "======"); put(g, 16, 9, "C")
put(g, 20, 13, "1")
room("sm_foerderturm", {"name": "Mine · Förderturm", "tags": ["start"], "weight": 1, "terrain": "desert", "atmosphere": "wueste_draussen", "backdrop": OUT,
  "description": "Ein rostiger Förderturm über dem Salz. Der Korb ist weg, die Leiter nicht (#038)."}, g)

g = grid(40, 11, fa=6, ca=33); lamps(g, 14, 26)
put(g, 12, 7, "======"); put(g, 24, 7, "======")
block(g, 19, 2, 1)
put(g, 10, 9, "1"); put(g, 22, 9, "1"); put(g, 36, 9, "1")
room("sm_sohle", {"name": "Mine · Sohle", "tags": ["combat"], "weight": 3, "terrain": "ruins", "atmosphere": "ruine_staub",
  "description": "Ein Hauptgang mit Lorenschienen, Salz an den Wänden (#038)."}, g)

g = grid(34, 11, fa=28, ca=11); lamps(g, 17)
put(g, 1, 1, "#########"); put(g, 1, 2, "######")
put(g, 25, 1, "#########"); put(g, 28, 2, "######")
col(g, 14, 6, 9, "$"); col(g, 15, 6, 9, "$"); put(g, 12, 9, "C")    # a salt wall in the way of nothing, behind it a chest
put(g, 20, 9, "1")
room("sm_stollen", {"name": "Mine · Stollen", "tags": ["corridor"], "weight": 2, "terrain": "ruins", "atmosphere": "ruine_staub",
  "description": "Ein enger Stollen. Eine Salzwand bröselt verdächtig (#038)."}, g)

g = grid(44, 20, fa=8, ca=38); lamps(g, 22)
for y, x, w in ((15, 14, 6), (12, 20, 6), (9, 26, 6), (6, 18, 6), (12, 31, 5)): put(g, x, y, "=" * w)
put(g, 20, 5, "C")
put(g, 1, 1, "##########"); put(g, 34, 1, "###")
put(g, 12, 18, "1"); put(g, 24, 18, "1"); put(g, 30, 18, "1"); put(g, 22, 11, "1")
room("sm_kaverne", {"name": "Mine · Kaverne", "tags": ["combat"], "weight": 2, "terrain": "ruins", "atmosphere": "metall_rost",
  "description": "Eine ausgebeutete Salzhalle, so groß wie eine Kirche. Gerüste führen nach oben (#038)."}, g)

g = grid(18, 17, fa=4, ca=13)
for y, x in ((12, 7), (9, 2), (6, 8), (3, 3)): put(g, x, y, "=====")
put(g, 9, 15, "1")
room("sm_wetterschacht", {"name": "Mine · Wetterschacht", "tags": ["corridor"], "weight": 2, "terrain": "metal", "atmosphere": "metall_rost",
  "description": "Ein Lüftungsschacht über zwei Sohlen. Es zieht (#038)."}, g)

g = grid(36, 11, fa=10, ca=26); lamps(g, 18)
block(g, 14, 2, 2); put(g, 14, 7, "==")
block(g, 20, 3, 1)
put(g, 6, 9, "1"); put(g, 30, 9, "1"); put(g, 23, 9, "1")
room("sm_lager", {"name": "Mine · Sprengstofflager", "tags": ["combat"], "weight": 1, "terrain": "metal", "atmosphere": "bunker_rot",
  "description": "Kisten mit gelben Rauten. Bloß nicht danebenschießen (#038)."}, g)

g = grid(40, 15, ca=32); lamps(g, 20)
put(g, 12, 9, "#########"); put(g, 12, 8, "========="); put(g, 15, 7, "Z")
put(g, 6, 11, "===")
put(g, 24, 13, "1"); put(g, 29, 13, "1"); put(g, 8, 13, "1")
room("sm_tiefe", {"name": "Mine · Tiefste Sohle", "tags": ["exit"], "weight": 1, "terrain": "ruins", "atmosphere": "bunker_reaktor",
  "description": "Ganz unten leuchtet etwas im Salz. Die alte Notleiter führt zurück zum Förderturm (#038)."}, g)

g = grid(14, 11, fa=7); lamps(g, 7)
put(g, 2, 9, "C"); put(g, 11, 9, "C")
room("sm_kaue", {"name": "Mine · Kaue", "tags": ["loot"], "weight": 1, "terrain": "concrete", "atmosphere": "beton_lager",
  "description": "Die Umkleide der Kumpel. Spinde, Haken, ein vergessener Lohnbeutel (#038)."}, g)

g = grid(16, 11, fa=8)
col(g, 10, 7, 9, "%"); col(g, 10, 1, 6, "#"); put(g, 12, 9, "C"); put(g, 13, 9, "C")
room("sm_kristallgrotte", {"name": "Mine · Kristallgrotte", "tags": ["secret"], "weight": 1, "terrain": "ruins", "atmosphere": "markt_neon",
  "description": "Salzkristalle, die im Lampenlicht glühen. Hinter dem Vorhang aus Salz liegt was (#038)."}, g)

# =====================================================================================================================
# Delta Crude: refinery (horizontal, L): tank farm, pipe bridges, boiler house, the distillation tower.
# =====================================================================================================================
T = "metal"
g = grid(36, ca=24); lamps(g, 20)
put(g, 1, 2, "..................")
put(g, 0, 12, "########"); put(g, 0, 11, "=======")                     # the guard house over the shortcut
col(g, 7, 13, 15, "D"); put(g, 2, 16, "^"); put(g, 4, 15, "S"); col(g, 0, 13, 15, "#")
put(g, 11, 15, "L")
put(g, 28, 15, "1"); put(g, 20, 15, "1")
put(g, 21, 12, "====="); put(g, 27, 9, "====="); put(g, 29, 8, "C")
room("rf_tor", {"name": "Raffinerie · Werkstor", "tags": ["start"], "weight": 1, "terrain": "desert", "atmosphere": "wueste_draussen", "backdrop": OUT,
  "description": "Ein Pförtnerhaus mit Schranke. Der Schalter drin öffnet das Tor (#038)."}, g)

g = grid(42, ca=[10, 30])
put(g, 1, 2, "........................................")
for x0 in (4, 17, 31):                                                   # three round tanks: blocks with a flat top
    for y in range(11, 16): put(g, x0, y, "#####")
    put(g, x0, 10, "=====")
for x0 in (4, 17, 31): put(g, x0 + 2, 9, "1" if x0 != 17 else "C")
put(g, 11, 13, "==="); put(g, 23, 13, "==="); put(g, 27, 13, "===")
put(g, 13, 15, "1"); put(g, 26, 15, "1"); put(g, 38, 15, "1")
room("rf_tankfeld", {"name": "Raffinerie · Tankfeld", "tags": ["combat"], "weight": 3, "terrain": T, "atmosphere": "metall_rost", "backdrop": OUT,
  "description": "Drei Tanks, oben flach, unten Deckung. Wer oben steht, hat den Überblick (#038)."}, g)

g = grid(38, ca=19); lamps(g, 9, 29)
put(g, 1, 6, "################"); put(g, 22, 6, "###############")       # pipes at head height
put(g, 4, 12, "========"); put(g, 26, 12, "========")
put(g, 12, 9, "=============="); put(g, 17, 8, "C")
block(g, 16, 6, 1); put(g, 15, 12, "======")
put(g, 6, 11, "1"); put(g, 30, 11, "1"); put(g, 25, 15, "1")
room("rf_rohrbruecke", {"name": "Raffinerie · Rohrbrücke", "tags": ["corridor"], "weight": 2, "terrain": T, "atmosphere": "metall_rost",
  "description": "Rohre in allen Größen, Stege dazwischen. Oben geht es schneller, unten sicherer (#038)."}, g)

g = grid(40, ca=8); lamps(g, 16, 26)
for x0 in (13, 25): block(g, x0, 5, 5); put(g, x0, 10, "=====")         # two boilers
put(g, 19, 7, "======"); put(g, 21, 6, "1")
put(g, 31, 11, "######"); col(g, 31, 12, 12, "#"); col(g, 31, 13, 15, "B"); col(g, 36, 12, 15, "#"); put(g, 34, 15, "C")
put(g, 4, 15, "1"); put(g, 22, 15, "1"); put(g, 38, 15, "1")
room("rf_kesselhaus", {"name": "Raffinerie · Kesselhaus", "tags": ["combat"], "weight": 2, "terrain": T, "atmosphere": "bunker_reaktor",
  "description": "Zwei Kessel, Hitze, Lärm. In der Ecke ein zugemauerter Werkzeugraum (#038)."}, g)

g = grid(34, ca=6); lamps(g, 16)
put(g, 1, 2, "................................")
for y, x in ((12, 12), (9, 18), (6, 12)): put(g, x, y, "======")
put(g, 14, 5, "Z")
col(g, 30, 16, 16, "v")
put(g, 8, 15, "1"); put(g, 22, 15, "1"); put(g, 19, 8, "1")
room("rf_destille", {"name": "Raffinerie · Destillationsturm", "tags": ["exit"], "weight": 1, "terrain": T, "atmosphere": "metall_rost", "backdrop": OUT,
  "description": "Ein Turm aus Böden und Leitern, ganz oben der Steuerkasten mit dem Zugangscode. Hinten geht es in den Abwasserkanal (#038)."}, g)

g = grid(16, 11, fa=8); lamps(g, 8)
put(g, 3, 9, "C"); put(g, 12, 9, "C")
room("rf_leitstand", {"name": "Raffinerie · Leitstand", "tags": ["loot"], "weight": 1, "terrain": T, "atmosphere": "beton_neon",
  "description": "Bildschirme, Kaffeetassen, eine Schublade mit Wertsachen (#038)."}, g)

g = grid(14, 11, fa=7)
col(g, 4, 7, 9, "%"); col(g, 4, 1, 6, "#"); put(g, 2, 9, "C")
room("rf_versteck", {"name": "Raffinerie · Schmugglerlager", "tags": ["secret"], "weight": 1, "terrain": T, "atmosphere": "kino_dunkel",
  "description": "Ein Hohlraum hinter einer Blechwand. Jemand hat hier Sprit abgezweigt (#038)."}, g)

# =====================================================================================================================
# Sunny Acres: trailer park (horizontal, S).
# =====================================================================================================================
T = "desert"
def trailer(g, x, w=8): block(g, x, w, 3); put(g, x, feet(g) - 3, "=" * w)

g = grid(32, ca=22)
put(g, 1, 2, "..............................")
put(g, 4, 15, "L"); put(g, 2, 16, "^")
put(g, 10, 10, "######"); col(g, 10, 11, 12, "#"); col(g, 15, 11, 12, "#")   # the welcome sign
trailer(g, 26, 5)
put(g, 18, 15, "1")
room("tp_einfahrt", {"name": "Trailerpark · Einfahrt", "tags": ["start"], "weight": 1, "terrain": T, "atmosphere": "wueste_draussen", "backdrop": OUT,
  "description": "„Willkommen in Sunny Acres“, die Buchstaben hängen schief. Die Bewohner sind nicht mehr freundlich (#038)."}, g)

g = grid(38, ca=[8, 28])
put(g, 1, 2, "....................................")
trailer(g, 11, 9); trailer(g, 24, 3)
put(g, 14, 12, "C")
put(g, 4, 15, "1"); put(g, 22, 15, "1"); put(g, 33, 15, "1")
room("tp_wohnwagen", {"name": "Trailerpark · Wohnwagenreihe", "tags": ["combat"], "weight": 3, "terrain": T, "atmosphere": "wueste_draussen", "backdrop": OUT,
  "description": "Wohnwagen an Wohnwagen, auf den Dächern Liegestühle und Gewehre (#038)."}, g)

g = grid(34, ca=20)
block(g, 4, 7, 2); block(g, 24, 7, 2)                                   # the raised deck, the empty pool between
put(g, 9, 11, "======"); col(g, 9, 12, 13, "#"); put(g, 12, 10, "C")   # the diving board on its post
put(g, 16, 15, "1"); put(g, 29, 13, "1")
room("tp_pool", {"name": "Trailerpark · Pool", "tags": ["corridor"], "weight": 2, "terrain": T, "atmosphere": "wueste_draussen", "backdrop": OUT,
  "description": "Ein leeres Becken voller Müll. Auf dem Sprungturm hat jemand was gebunkert (#038)."}, g)

g = grid(30, ca=12); lamps(g, 20)
put(g, 15, 9, "#############"); col(g, 15, 10, 12, "#")                 # the office with a porch roof
put(g, 20, 15, "Z")
col(g, 15, 13, 15, "D"); put(g, 17, 15, ".")
put(g, 6, 15, "1"); put(g, 26, 15, "1")
put(g, 5, 11, "======"); put(g, 7, 10, "S")
col(g, 27, 16, 16, "v")
room("tp_buero", {"name": "Trailerpark · Verwaltung", "tags": ["exit"], "weight": 1, "terrain": T, "atmosphere": "beton_lager",
  "description": "Das Büro des Platzwarts, die Kasse unterm Tresen. Die Tür geht nur über den Schalter auf dem Vordach auf (#038)."}, g)

g = grid(14, 11, fa=7)
for x in range(1, 13): g[1][x] = "."
put(g, 2, 9, "C"); put(g, 11, 9, "C")
room("tp_dachterrasse", {"name": "Trailerpark · Dachterrasse", "tags": ["loot"], "weight": 1, "terrain": T, "atmosphere": "wueste_draussen", "backdrop": OUT,
  "description": "Ein Sonnensegel über einem Wohnwagen, zwei Kühlboxen (#038)."}, g)

# ---------------------------------------------------------------------------------------------------------------------
out = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/poi_rooms_038.json")
out.write_text(json.dumps(R, ensure_ascii=False))
print(len(R), "Räume →", out)
