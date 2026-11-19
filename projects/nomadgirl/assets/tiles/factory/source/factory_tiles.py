"""Kachel-Set „Fabrik“ (factory) für NomadGirl – NomadPixel, 19.11.2026.
Raster wie TileSet00: Felder 64 × 80 (16 px Kruste + 64 px Kachel), 4 Spalten:
Zeile 0 Oberfläche (top_0..3), Zeile 1 Füllung a, Zeile 2 Füllung b.
Alle Kacheln einer Zeile zusammen 256 px breit und links/rechts nahtlos (auch 3→0);
Ziegellagen à 8 px, 8 Lagen je Kachel → senkrecht beliebig stapelbar."""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
W = 256

def h(*a):
    x = 2166136261
    for v in a:
        x = ((x ^ (v & 0xffffffff)) * 16777619) & 0xffffffff
    return x / 0xffffffff

# AAP-64
MORTAR = ["#221c1a", "#322b28", "#423934"]
BR_RED = ["#221c1a", "#322b28", "#5b3138", "#71413b", "#8e5252"]
BR_GRAY = ["#221c1a", "#322b28", "#423934", "#5a4e44", "#796755"]
BR_TAN = ["#322b28", "#423934", "#5a4e44", "#796755", "#a08662"]
BRICK = BR_RED     # dunkel → hell
SOOT = ["#221c1a", "#322b28", "#422433"]
STEEL = ["#242234", "#333941", "#4a5462", "#6d758d", "#8b93af", "#b3b9d1"]
RUST = ["#5b3138", "#71413b", "#bb7547"]
OUT = "#060608"

class G:
    def __init__(s, w, hgt): s.w, s.h = w, hgt; s.p = [[None] * w for _ in range(hgt)]
    def set(s, x, y, c):
        if 0 <= y < s.h: s.p[y][x % s.w] = c
    def get(s, x, y): return s.p[y][x % s.w] if 0 <= y < s.h else None

def bricks(g, y0, rows, seed, soot=0.0):
    """Ziegelwand ab Zeile y0, rows Pixelzeilen. Lage 8 px (7 Stein + 1 Fuge), Stein 32 px (31 + 1)."""
    for y in range(y0, y0 + rows):
        ly = y - y0
        course = ly // 8
        cy = ly % 8
        off = 16 if course % 2 else 0
        for x in range(W):
            bx = (x + off) % W
            bi = bx // 32
            cx = bx % 32
            if cy == 7 or cx == 31:                       # Fuge, tief
                g.set(x, y, MORTAR[1] if (cy == 7 and cx != 31) else MORTAR[0])
                continue
            t = h(bi, course, seed)                        # Ziegelsorte je Stein
            tg = h(bi, course, seed + 5)
            R = BR_RED if tg < 0.88 or course == 7 else (BR_GRAY if tg < 0.97 else BR_TAN)
            base = 3 if h(bi, course, seed + 1) < 0.45 else 2
            if soot and h(bi // 2, course // 2, seed + 7) < soot:
                base = max(1, base - 1)
            c = base
            if cy == 0 and cx < 30: c = base + 1                            # Licht oben
            if cx == 0 and cy < 6: c = base + 1                             # Licht links
            if cy == 6 or cx == 30: c = base - 1                            # Schatten unten/rechts
            chip = h(bi, course, seed + 3)
            if chip < 0.18 and ((cx < 3 and cy < 2) or (cx > 27 and cy > 4)):
                c = None
            if c is not None and 1 <= cy <= 5 and 2 <= cx <= 28 and h(bx // 3, ly, seed + 11) > 0.93:
                c = max(0, c - 1)
            g.set(x, y, MORTAR[2] if c is None else R[c])

def darker(col, d=1):
    for R in (BR_RED, BR_GRAY, BR_TAN):
        if col in R: return R[max(0, R.index(col) - d)]
    if col in MORTAR: return MORTAR[0]
    return col

def soot_drip(g, x, y0, length, seed):
    """Rußfahne, die unter der Stahlkante herabläuft (verdunkelt eine Stufe)."""
    for k in range(length):
        w = 3 if k < length * 0.4 else (2 if k < length * 0.75 else 1)
        for dx in range(w):
            if h(x, k, dx, seed) < 0.85 - k / length * 0.4:
                g.set(x + dx, y0 + k, darker(g.get(x + dx, y0 + k)))

def floor_plate(g, y0, seed):
    """Riffelblech-Lauffläche (Zeilen y0..y0+5) über einem genieteten Träger (y0+6..y0+10)."""
    for y in range(y0, y0 + 6):
        for x in range(W):
            g.set(x, y, STEEL[2])
    g_top = y0
    for x in range(W): g.set(x, g_top, STEEL[4] if h(x // 5, 1, seed) > 0.25 else STEEL[3])   # Kante oben
    # Tränen-Riffel: kurze Diagonalen, abwechselnd / und \
    for ry, y in enumerate(range(y0 + 1, y0 + 5, 2)):
        for x in range(ry * 3, W, 6):
            if (x // 6 + ry) % 2 == 0:
                g.set(x, y, STEEL[4]); g.set(x + 1, y + 1, STEEL[1])
            else:
                g.set(x + 1, y, STEEL[4]); g.set(x, y + 1, STEEL[1])
    for x in range(W): g.set(x, y0 + 5, STEEL[1])
    # Träger (Doppel-T von vorn: Flansch oben, Steg, Flansch unten)
    prof = [STEEL[5], STEEL[4], STEEL[0], STEEL[2], STEEL[2], STEEL[2], STEEL[2], STEEL[1], STEEL[0], STEEL[4], STEEL[3], STEEL[1], STEEL[0]]
    for k, c in enumerate(prof):
        for x in range(W): g.set(x, y0 + 6 + k, c)
    for x in range(W):                                                        # Stoß + Laschen alle 64 px
        if x % 64 in (31, 32):
            for k in range(2, 8): g.set(x, y0 + 6 + k, STEEL[0] if x % 64 == 31 else STEEL[3])
    for x in range(6, W, 12):                                                 # Nieten im Steg
        if x % 64 in range(26, 38): continue
        g.set(x, y0 + 10, STEEL[5]); g.set(x + 1, y0 + 10, STEEL[3]); g.set(x, y0 + 11, STEEL[3]); g.set(x + 1, y0 + 11, STEEL[0])
    # Rost: Fahnen am Träger und Flecken im Blech
    for x in range(W):
        if h(x, 9, seed) > 0.965:
            L = 2 + int(h(x, 3, seed) * 5)
            for k in range(L):
                g.set(x, y0 + 13 + k, RUST[2] if k == 0 else (RUST[1] if k < L - 1 else RUST[0]))
        if h(x // 4, 5, seed) > 0.9 and h(x, 6, seed) > 0.3:
            g.set(x, y0 + 3, RUST[1])
    # Schlagschatten des Trägers auf die Ziegel
    for x in range(W):
        for k, yy in enumerate((y0 + 19, y0 + 20, y0 + 21)):
            g.set(x, yy, darker(g.get(x, yy), 3 if k == 0 else (2 if k == 1 else 1)))

def crust(g, seed):
    """16 px über der Lauffläche: flacher Dreck, Schrauben, Kiesel, Ölpfütze – nur am Boden."""
    for x in range(W):
        hgt = 0
        if h(x // 9, 1, seed) > 0.55: hgt = 1
        if h(x // 5, 2, seed) > 0.86: hgt = 2
        for k in range(hgt):
            y = 15 - k
            g.set(x, y, SOOT[1] if k else SOOT[2])
        if hgt and h(x, 4, seed) > 0.75: g.set(x, 15 - hgt + 1, MORTAR[2])
    # ein paar Schrauben/Muttern und Kiesel
    for i in range(10):
        x = int(h(i, 7, seed) * W)
        if h(i, 8, seed) < 0.5:
            g.set(x, 14, STEEL[3]); g.set(x + 1, 14, STEEL[2]); g.set(x, 15, STEEL[1]); g.set(x + 1, 15, STEEL[1])
        else:
            g.set(x, 15, MORTAR[2]); g.set(x + 1, 15, SOOT[2]); g.set(x, 14, MORTAR[2])
    # Ölpfütze mit Glanz
    x0 = int(h(1, 9, seed) * (W - 20))
    for x in range(x0, x0 + 14):
        g.set(x, 15, "#141013")
        if x in (x0 + 4, x0 + 5): g.set(x, 15, "#4a5462")

PLASTER = ["#423934", "#5a4e44", "#796755", "#a08662"]

def plaster(g, seed, n):
    """Reste von Putz auf den Ziegeln: unregelmäßige Flecken, Lichtkante oben links, dunkle Abbruchkante."""
    import math
    for i in range(n):
        cx = int(h(i, 1, seed) * W); cy = 30 + int(h(i, 2, seed) * 34)
        rx, ry = 8 + h(i, 3, seed) * 12, 5 + h(i, 4, seed) * 6
        def inside(x, y):
            dx = ((x - cx + W // 2) % W) - W // 2
            wob = 1 + 0.28 * math.sin(dx * 0.7 + i) + 0.18 * math.sin(y * 1.3 + i * 2)
            return (dx / rx) ** 2 + ((y - cy) / ry) ** 2 <= wob and 18 <= y <= 77
        for y in range(16, 80):
            for x in range(cx - 30, cx + 30):
                if not inside(x, y): continue
                c = 2
                if not inside(x, y - 1) or not inside(x - 1, y): c = 3
                elif not inside(x, y + 1) or not inside(x + 1, y): c = 1
                elif h(x // 4, y // 2, seed + i) > 0.9: c = 1
                g.set(x, y, PLASTER[c])
                if not inside(x, y + 1):
                    g.set(x, y + 1, MORTAR[0])          # Schatten der Abbruchkante

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

def grime(g, seed, n):
    """Weiche Rußwolken (eine Stufe dunkler, Rand gedithert), ausgebesserte Steine, fehlende Ziegel."""
    import math
    for i in range(n):
        cx = int(h(i, 1, seed) * W); cy = 28 + int(h(i, 2, seed) * 40)
        rx, ry = 18 + h(i, 3, seed) * 16, 10 + h(i, 4, seed) * 8
        for y in range(17, 79):
            ly = y - 16; course = ly // 8; off = 16 if course % 2 else 0
            for x in range(cx - 40, cx + 40):
                bx = (x + off) % W; bi = bx // 32
                mx = bi * 32 + 15 - off                       # Steinmitte
                dx = ((mx - cx + W // 2) % W) - W // 2
                d = math.sqrt((dx / rx) ** 2 + ((16 + course * 8 + 3 - cy) / ry) ** 2)
                if d < 1 and (d < 0.6 or h(bi, course, seed + i) > d):
                    col = g.get(x, y)
                    if col not in MORTAR: g.set(x, y, darker(col))
    # fehlende Ziegel (Loch mit Schatten oben, Licht unten innen)
    for i in range(n - 1):
        course = 2 + int(h(i, 5, seed) * 5); y = 16 + course * 8
        off = 16 if course % 2 else 0
        bx = int(h(i, 6, seed) * 8) * 32 - off
        for yy in range(y, y + 7):
            for xx in range(bx, bx + 31):
                g.set(xx, yy, MORTAR[0] if yy < y + 2 else (MORTAR[1] if yy < y + 6 else MORTAR[2]))

def column(g, x0, y0, y1):
    """Senkrechte Stahlstütze (Doppel-T von vorn), 12 px breit, Nieten, Rost am Fuß der Laschen."""
    prof = [STEEL[0], STEEL[4], STEEL[3], STEEL[1], STEEL[2], STEEL[2], STEEL[2], STEEL[2], STEEL[2], STEEL[2], STEEL[1], STEEL[1], STEEL[3], STEEL[2], STEEL[1], STEEL[0]]
    for y in range(y0, y1):
        for k, c in enumerate(prof): g.set(x0 + k, y, c)
        if (y - 16) % 32 in (6, 22):
            g.set(x0 + 6, y, STEEL[5]); g.set(x0 + 9, y, STEEL[5]); g.set(x0 + 6, y + 1, STEEL[1]); g.set(x0 + 9, y + 1, STEEL[1])
        if (y - 16) % 32 == 26 and h(x0, y, 3) > 0.4:
            for k in range(4): g.set(x0 + 7, y + k, RUST[2 - min(1, k)])
    for y in range(y0, y1):                                    # Schatten rechts auf die Ziegel
        g.set(x0 + 16, y, darker(g.get(x0 + 16, y), 2)); g.set(x0 + 17, y, darker(g.get(x0 + 17, y), 1))

def build():
    sheet = Image.new("RGBA", (W, 80 * 3), (0, 0, 0, 0))
    rows = []
    # Oberfläche
    g = G(W, 80)
    bricks(g, 16, 64, seed=1, soot=0.35)
    grime(g, 21, 2)
    column(g, 152, 16, 80)
    floor_plate(g, 16, seed=2)
    for x in (37, 101, 170, 229):
        soot_drip(g, x, 38, 18 + int(h(x, 1, 2) * 10), seed=x)
    crust(g, 3)
    rows.append(g)
    # Füllung a + b
    for seed, soot in ((4, 0.22), (5, 0.3)):
        g = G(W, 80)
        bricks(g, 16, 64, seed=seed, soot=soot)
        grime(g, seed * 7, 2 if seed == 4 else 3)
        column(g, 152, 16, 80)
        rows.append(g)
    for r, g in enumerate(rows):
        for y in range(80):
            for x in range(W):
                c = g.p[y][x]
                if c: sheet.putpixel((x, r * 80 + y), tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    return sheet

if __name__ == "__main__":
    s = build()
    s.save(os.path.join(HERE, "factory_terrain_strip.png"))
    # Raster wie TileSet00: 4 Spalten 64 × 80
    s.save(os.path.join(HERE, "factory_terrain.png"))
