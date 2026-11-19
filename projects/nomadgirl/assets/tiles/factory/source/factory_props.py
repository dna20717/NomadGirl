"""Fabrik-Clutter, Einschlüsse und Decals (64 × 64, streng orthogonal von der Seite) – NomadPixel, 19.11.2026.
Clutter steht auf der Unterkante (y = 63), Licht oben links, Outline #060608."""
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "../../../../../../.claude/skills/nomadpixel/scripts"))
import zeichnen as Z
Z.T = 64
from zeichnen import C
from PIL import Image

OUT = "#060608"
STEEL = ["#242234", "#333941", "#4a5462", "#6d758d", "#8b93af", "#b3b9d1"]
DARK = ["#141013", "#242234", "#333941", "#4a5462"]
RUST = ["#322b28", "#5b3138", "#71413b", "#bb7547", "#dba463"]
RED = ["#3b1725", "#73172d", "#b4202a", "#df3e23", "#f5a097"]
ORANGE = ["#3b1725", "#71413b", "#bb7547", "#fa6a0a", "#f9a31b"]
GREEN = ["#122020", "#24523b", "#23674e", "#328464", "#5daf8d"]
SAND = ["#322b28", "#423934", "#5a4e44", "#796755", "#a08662", "#c7b08b"]
WOOD = ["#322b28", "#5a4e44", "#796755", "#a08662", "#c7b08b"]
YEL = ["#5a4e44", "#bb7547", "#dba463", "#f4d29c"]
GLOW = ["#df3e23", "#fa6a0a", "#f9a31b", "#ffd541", "#fffc40"]
BAY = Z.BAYER4

def h(*a):
    x = 2166136261
    for v in a: x = ((x ^ (v & 0xffffffff)) * 16777619) & 0xffffffff
    return x / 0xffffffff

def cyl(c, x0, y0, x1, y1, ramp, lit=0.3):
    """Senkrechter Zylinder von der Seite: Helligkeit quer, Glanz bei lit (0 = links)."""
    w = x1 - x0 + 1
    n = len(ramp) - 1
    for x in range(x0, x1 + 1):
        u = (x - x0 + 0.5) / w
        f = 1 - min(1, abs(u - lit) / (1 - lit if u > lit else lit + 0.15))
        f = 0.15 + 0.85 * f
        for y in range(y0, y1 + 1):
            v = f * n
            i = int(v + 0.5)
            c.set(x, y, ramp[min(n, i)])

def hcyl(c, x0, y0, x1, y1, ramp, lit=0.3):
    """Waagerechter Zylinder: Helligkeit über y."""
    hh = y1 - y0 + 1; n = len(ramp) - 1
    for y in range(y0, y1 + 1):
        u = (y - y0 + 0.5) / hh
        f = 0.15 + 0.85 * (1 - min(1, abs(u - lit) / (1 - lit if u > lit else lit + 0.15)))
        for x in range(x0, x1 + 1):
            v = f * n
            i = int(v + 0.5)
            c.set(x, y, ramp[min(n, i)])

def box(c, x0, y0, x1, y1, ramp, base=None):
    """Flache Front: Lichtkante oben/links, Schatten unten/rechts."""
    b = base if base is not None else len(ramp) // 2
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            i = b
            if y == y0 or x == x0: i = min(len(ramp) - 1, b + 1)
            if y == y1 or x == x1: i = max(0, b - 1)
            c.set(x, y, ramp[i])

def disc(c, cx, cy, r, ramp, **k): c.ellipse(cx, cy, r, r, ramp, **k)

def ring(c, cx, cy, r0, r1, col):
    for y in range(int(cy - r1 - 1), int(cy + r1 + 2)):
        for x in range(int(cx - r1 - 1), int(cx + r1 + 2)):
            d = math.hypot(x - cx, y - cy)
            if r0 <= d <= r1: c.set(x, y, col)

def rivet(c, x, y):
    c.set(x, y, STEEL[5]); c.set(x + 1, y, STEEL[3]); c.set(x, y + 1, STEEL[3]); c.set(x + 1, y + 1, STEEL[1])

RAMPS = [STEEL, DARK, RUST, RED, ORANGE, GREEN, SAND, WOOD, YEL]
KEEP = set(GLOW) | {"#dae0ea", "#141013", "#14a02e", "#59c135", "#9cdb43", OUT}

def step(col, d):
    for R in RAMPS:
        if col in R:
            return R[max(0, min(len(R) - 1, R.index(col) + d))]
    return col

METALS = STEEL + DARK + RED + ORANGE + GREEN + YEL

def wear(c, seed):
    """Ganze Grafik eine Stufe dunkler; gemalte Rostflecken (Cluster) auf Metall, Dreck am Fuß, wenige Kratzer."""
    import math
    opaque = [(x, y) for y in range(64) for x in range(64) if c.g[y][x] and len(c.g[y][x]) == 7 and c.g[y][x] not in KEEP]
    for x, y in opaque: c.g[y][x] = step(c.g[y][x], -1)
    if not opaque: return
    ys = [p[1] for p in opaque]; bottom = max(ys)
    for x, y in opaque:                                         # Dreck am Fuß
        if y >= bottom - 3 and h(x // 2, seed) < 0.75: c.g[y][x] = step(c.g[y][x], -1)
    edge = [(x, y) for x, y in opaque if c.g[y][x] in METALS and y > (min(ys) + bottom) / 2
            and any(not c.get(x + a, y + b) or c.get(x + a, y + b) == OUT for a, b in ((1, 0), (-1, 0), (0, 1)))]
    for i in range(2 if edge else 0):                           # Rost an Kanten der unteren Hälfte
        x0, y0 = edge[int(h(i, 1, seed) * len(edge))]
        r = 1.2 + h(i, 2, seed) * 1.6
        for y in range(int(y0 - r), int(y0 + r) + 4):
            for x in range(int(x0 - r), int(x0 + r) + 1):
                col = c.get(x, y)
                if col not in METALS: continue
                d = math.hypot(x - x0, (y - y0) * (1.4 if y < y0 else 0.6))
                if d <= r: c.set(x, y, RUST[3] if d < r * 0.45 else RUST[2])
    for x, y in opaque:                                         # Bürstspuren: kurze waagerechte Striche
        col = c.g[y][x]
        if col in METALS and h(x // 3, y, seed + 9) > 0.86:
            c.g[y][x] = step(col, -1 if h(x, y, seed) < 0.7 else 1)
        elif col in SAND + WOOD and h(x // 4, y, seed + 9) > 0.8:
            c.g[y][x] = step(col, -1)
    for i in range(3):                                          # Kratzer
        x0, y0 = opaque[int(h(i, 5, seed) * len(opaque))]
        for k in range(2 + int(h(i, 3, seed) * 3)):
            col = c.get(x0 + k, y0)
            if col in METALS: c.set(x0 + k, y0, step(col, 2))

def finish(c, outline=True, seed=0):
    wear(c, seed or (sum(1 for row in c.g for v in row if v) % 997))
    if outline:
        c.outline(OUT)
        Z.clean(c, OUT)
    return c

# ------------------------------------------------------------------ Clutter
def drum():                                     # Ölfass, 90 cm
    c = C()
    cyl(c, 12, 8, 51, 62, RUST[0:5], lit=0.28)
    for y in (9, 10, 61, 62):                                  # Bördelrand
        for x in range(12, 52): c.set(x, y, RUST[3] if y in (9, 61) else RUST[1])
    for yy in (25, 44):                                        # Sicken
        for x in range(12, 52):
            c.set(x, yy, RUST[1]); c.set(x, yy + 1, RUST[3] if 14 < x < 30 else RUST[2])
    # orange Farbband mit Rautenzeichen (Crude Boys)
    for y in range(30, 41):
        for x in range(13, 51):
            f = 1 - abs((x - 22) / 30)
            c.set(x, y, ORANGE[3] if f > 0.55 else ORANGE[2])
    for k in range(5):
        for x in range(31 - k, 32 + k): c.set(x, 33 + k, "#141013"); c.set(x, 41 - k - 1, "#141013") if k < 4 else None
    # Abplatzer + Rostläufer
    for x in (17, 40, 45):
        for k in range(3 + int(h(x) * 6)): c.set(x, 41 + k, RUST[2])
    c.set(21, 31, RUST[2]); c.set(22, 31, RUST[2]); c.set(44, 38, RUST[2])
    for x in range(14, 50, 7): c.set(x, 8, RUST[4])               # Lichtkante oben
    return finish(c)

def valve():                                    # Rohr mit Handrad, 110 cm
    c = C()
    cyl(c, 26, 6, 37, 62, STEEL[1:5])
    box(c, 22, 56, 41, 62, STEEL, 2)                          # Fußflansch
    box(c, 22, 4, 41, 9, STEEL, 2)                            # Kopfflansch
    for x in (24, 30, 36): rivet(c, x, 58); rivet(c, x, 5)
    box(c, 22, 26, 41, 31, STEEL, 2)                          # Ventilgehäuse
    # Handrad frontal
    cx, cy, r = 31.5, 20, 12
    ring(c, cx, cy, r - 2.6, r, RED[2])
    ring(c, cx, cy, r - 2.6, r - 1.8, RED[1])
    for y in range(int(cy - r), int(cy + r) + 1):            # Licht oben links auf dem Ring
        for x in range(int(cx - r), int(cx + r) + 1):
            d = math.hypot(x - cx, y - cy)
            if r - 1.2 <= d <= r and (x - cx) + (y - cy) < -4: c.set(x, y, RED[3])
    for a in range(0, 360, 60):
        for t in range(3, int(r - 2)):
            c.set(round(cx + math.cos(math.radians(a)) * t), round(cy + math.sin(math.radians(a)) * t), RED[1])
    disc(c, 31.5, 20, 3, STEEL[1:5])
    # Warnanhänger
    c.rect(40, 33, 44, 39, YEL[2]); c.set(40, 33, YEL[3]); c.line(41, 36, 43, 36, "#141013")
    c.line(38, 30, 41, 33, STEEL[2])
    return finish(c)

def conveyor():                                 # Förderband-Stück mit Karton, 80 cm
    c = C()
    for lx in (8, 52):                                        # Beine
        box(c, lx, 40, lx + 3, 62, STEEL, 2)
    c.line(11, 56, 52, 46, STEEL[2], 1)                       # Strebe
    box(c, 4, 34, 59, 41, YEL, 2)                             # Rahmen gelb
    for x in range(6, 58, 8): rivet(c, x, 37)
    for x in range(4, 60):                                    # Gurt oben
        c.set(x, 32, DARK[2]); c.set(x, 33, DARK[1] if x % 4 else DARK[3])
    disc(c, 5, 37, 4.5, STEEL[1:5]); disc(c, 58, 37, 4.5, STEEL[1:5])
    c.set(5, 37, OUT); c.set(58, 37, OUT)
    # Karton auf dem Band
    box(c, 20, 16, 41, 31, SAND, 3)
    for y in range(16, 32): c.set(30, y, SAND[2]); c.set(31, y, SAND[4])  # Klebeband
    c.rect(23, 20, 27, 23, SAND[1])                           # Etikett
    for x in range(23, 28): c.set(x, 20, SAND[5])
    for x in range(34, 39): c.set(x, 26, SAND[2])
    return finish(c)

def cabinet():                                  # Schaltkasten auf Fuß, 100 cm
    c = C()
    box(c, 28, 50, 35, 62, STEEL, 2)                          # Fuß
    box(c, 22, 60, 41, 62, STEEL, 2)
    box(c, 14, 6, 49, 50, STEEL, 2)                           # Gehäuse
    box(c, 17, 9, 46, 47, STEEL, 3)                           # Tür
    for y in range(9, 48):
        c.set(17, y, STEEL[4]); c.set(46, y, STEEL[1])
    # zwei Rundinstrumente
    for gx in (25, 38):
        disc(c, gx, 18, 5, ["#8b93af", "#b3b9d1", "#dae0ea"])
        ring(c, gx, 18, 4.6, 5.6, DARK[1])
        c.line(gx, 18, gx + 3, 15 if gx == 25 else 20, RED[2])
        c.set(gx, 18, OUT)
    # Lampen grün/rot + Schalterreihe
    disc(c, 23, 29, 1.6, ["#14a02e", "#59c135", "#9cdb43"]); disc(c, 29, 29, 1.6, RED[2:])
    for k, x in enumerate(range(22, 43, 5)):
        box(c, x, 34, x + 3, 38, DARK, 1); c.set(x + 1, 34 + (1 if k % 2 else 3), STEEL[5])
    box(c, 42, 25, 44, 31, DARK, 2)                           # Griff
    # Warnschild
    c.rect(35, 40, 42, 45, YEL[2]); c.line(36, 44, 38.5, 41, "#141013"); c.line(38.5, 41, 41, 44, "#141013")
    for x in range(20, 26): c.set(x, 47 - (x % 2), RUST[2])   # Rost unten
    return finish(c)

def gas():                                      # zwei Gasflaschen mit Kette, 100 cm
    c = C()
    for x0, R in ((16, GREEN), (33, STEEL[1:])):
        cyl(c, x0, 12, x0 + 13, 62, R[1:] if R is GREEN else R)
        for y in range(8, 13):                                # Schulter
            w = (y - 7) * 1.4
            for x in range(int(x0 + 6.5 - w), int(x0 + 7.5 + w)): c.set(x, y, R[2])
        box(c, x0 + 4, 3, x0 + 9, 8, STEEL, 3)                # Ventil
        c.set(x0 + 10, 5, STEEL[4]); c.set(x0 + 11, 5, STEEL[2])
        for y in (14, 15):
            for x in range(x0, x0 + 14): c.set(x, y, YEL[2] if y == 14 else YEL[1])
    for x in range(14, 49, 2):                                # Kette
        c.set(x, 30, STEEL[4]); c.set(x + 1, 31, STEEL[2])
    box(c, 47, 26, 49, 34, STEEL, 2)
    return finish(c)

def gear():                                     # großes Zahnrad im Bock, 60 cm
    c = C()
    cx, cy, r = 32, 31, 22
    c.line(24, 55, 29, 44, STEEL[2], 2); c.line(40, 55, 35, 44, STEEL[2], 2)
    box(c, 14, 54, 49, 62, STEEL, 2)
    for x in (17, 45): rivet(c, x, 57)
    g = C()
    for y in range(64):
        for x in range(64):
            a = math.atan2(y - cy, x - cx); d = math.hypot(x - cx, y - cy)
            tooth = (math.cos(a * 12) > 0.25)
            if d <= r - 3 or (d <= r + 1 and tooth):
                g.set(x, y, "#000001")
    g.shade_mask(lambda x, y: g.get(x, y) == "#000001", RUST[1:], cx, cy, r + 4, r + 4)
    for y in range(1, 63):
        for x in range(1, 63):
            if g.get(x, y) and (not g.get(x - 1, y) or not g.get(x, y - 1)) and (x - cx) + (y - cy) < 6:
                g.set(x, y, RUST[4])
    g.outline(OUT)
    for y in range(64):
        for x in range(64):
            if g.get(x, y): c.set(x, y, g.get(x, y))
    ring(c, cx, cy, 11, 13, RUST[1])
    for k in range(6):                                        # Speichenlöcher
        a = math.radians(k * 60 + 30)
        disc(c, cx + math.cos(a) * 15.5, cy + math.sin(a) * 15.5, 2.6, ["#141013", "#141013"])
    disc(c, cx, cy, 6, STEEL[1:5]); disc(c, cx, cy, 2, ["#141013"])
    return finish(c)

def cart():                                     # Werkzeugwagen, 85 cm
    c = C()
    box(c, 10, 18, 53, 56, RED, 2)
    for k, y in enumerate(range(22, 54, 8)):                 # Schubladen
        box(c, 13, y, 50, y + 6, RED, 2)
        box(c, 26, y + 2, 37, y + 3, STEEL, 3)
    box(c, 8, 14, 55, 18, STEEL, 3)                           # Deckplatte
    c.rect(14, 10, 22, 13, DARK[2]); c.rect(15, 10, 21, 10, DARK[3])     # Werkzeug obenauf
    c.line(30, 13, 44, 11, STEEL[4], 1); c.rect(43, 9, 47, 12, STEEL[2])  # Schraubenschlüssel
    c.line(55, 20, 60, 20, STEEL[3]); c.line(60, 20, 60, 30, STEEL[2])    # Griff
    for wx in (15, 48):
        disc(c, wx, 59, 4, DARK); disc(c, wx, 59, 1.5, STEEL[2:5])
    for x in (12, 19, 41): c.set(x, 55, RED[1]); c.set(x + 1, 54, RUST[2])  # Kratzer
    return finish(c)

def tracks():                                   # Stapel Raupenkettenglieder (vom Crawler), 50 cm
    c = C()
    for k, (x0, y0) in enumerate(((5, 49), (11, 35), (3, 21))):
        x1 = x0 + 50
        box(c, x0, y0 + 3, x1, y0 + 13, STEEL, 3)              # Platte
        for x in range(x0 + 1, x1): c.set(x, y0 + 3, STEEL[5] if x < x0 + 30 else STEEL[4])
        for x in range(x0 + 4, x1 - 2, 11):                    # Greifsteg obenauf
            box(c, x, y0, x + 6, y0 + 3, STEEL, 2)
        for x in range(x0 + 7, x1 - 4, 16):                    # Gelenkaugen mit Bolzen
            disc(c, x, y0 + 9, 3, STEEL[2:6]); c.set(x, y0 + 9, "#242234")
        for x in range(x0 + 1, x1): c.set(x, y0 + 13, STEEL[1])
        for y in range(y0 + 4, y0 + 13): c.set(x0, y, STEEL[3]); c.set(x1, y, STEEL[1])
    c.line(24, 26, 32, 26, "#dae0ea"); c.line(29, 24, 32, 26, "#dae0ea"); c.line(29, 28, 32, 26, "#dae0ea")   # Kreide-Pfeil
    return finish(c)

def sacks():                                    # Säcke auf Palette, 60 cm
    c = C()
    for y in (57, 61): box(c, 6, y, 57, y + 2, WOOD, 2)
    for x in (8, 30, 52): box(c, x, 59, x + 4, 60, WOOD, 1)
    for (cx, cy, rx, ry) in ((18, 48, 12, 8), (44, 48, 12, 8), (31, 36, 13, 8)):
        c.ellipse(cx, cy, rx, ry, SAND[1:])
        c.line(cx - rx + 3, cy, cx + rx - 3, cy, SAND[2])          # Naht
        c.set(cx - 2, cy - 4, SAND[5]); c.set(cx - 1, cy - 4, SAND[5])
    c.rect(26, 34, 33, 38, "#4a5462"); c.line(27, 36, 32, 36, "#8b93af")  # Stempel
    return finish(c)

def extinguisher():                             # Feuerlöscher, 60 cm
    c = C()
    cyl(c, 25, 18, 38, 62, RED[1:])
    for y in range(13, 18):
        w = (y - 12) * 1.3
        for x in range(int(31.5 - w), int(32.5 + w)): c.set(x, y, RED[2])
    box(c, 29, 8, 34, 13, DARK, 2); c.line(34, 9, 40, 7, DARK[2])      # Kopf + Hebel
    c.line(29, 12, 22, 20, DARK[1]); c.line(22, 20, 22, 40, DARK[1])     # Schlauch
    c.rect(26, 34, 37, 44, "#dae0ea"); c.rect(27, 36, 36, 37, RED[2]); c.rect(27, 40, 33, 40, DARK[3])
    return finish(c)

def cans():                                     # Kanister gestapelt, 55 cm
    c = C()
    def can(x0, y0, R):
        box(c, x0, y0, x0 + 20, y0 + 25, R, 2)
        c.line(x0 + 3, y0 + 4, x0 + 17, y0 + 21, R[1]); c.line(x0 + 17, y0 + 4, x0 + 3, y0 + 21, R[1])  # X-Prägung
        c.line(x0 + 3, y0 + 3, x0 + 16, y0 + 3, R[3])
        box(c, x0 + 3, y0 - 4, x0 + 11, y0, R, 1)                         # Griff
        c.rect(x0 + 5, y0 - 3, x0 + 9, y0 - 1, None) if False else None
        box(c, x0 + 15, y0 - 3, x0 + 18, y0, DARK, 2)                     # Verschluss
    can(8, 37, RED[:4]); can(32, 37, GREEN[:4]); can(19, 8, ORANGE[1:])
    for x in range(10, 50, 6): c.set(x, 62, RUST[2])
    return finish(c)

def beacon():                                   # Warnlampe auf Ständer, 100 cm
    c = C()
    box(c, 21, 59, 42, 62, YEL, 1)
    for x in (24, 39): rivet(c, x, 60)
    cyl(c, 30, 20, 33, 58, STEEL[1:5])
    box(c, 25, 16, 38, 20, DARK, 2)
    for y in range(4, 16):                                    # Glaskuppel mit Glühen
        w = 6 - max(0, 9 - y) * 0.5 if y < 9 else 6
        for x in range(int(31.5 - w), int(32.5 + w)):
            f = 1 - abs(x - 29.5) / 8
            c.set(x, y, GLOW[min(4, int(1 + f * 3.4))])
    for y in range(6, 15): c.set(28, y, GLOW[4])
    for x in range(26, 38): c.set(x, 10, GLOW[0]) if x % 3 == 0 else None  # Reflektor-Lamellen
    return finish(c)

# ------------------------------------------------------------------ Einschlüsse (flach auf der Wand)
def vent():
    c = C()
    box(c, 14, 20, 49, 43, STEEL, 2)
    for y in range(23, 41, 3):
        for x in range(17, 47): c.set(x, y, DARK[0]); c.set(x, y + 1, STEEL[3] if x < 30 else STEEL[2])
    for (x, y) in ((15, 21), (47, 21), (15, 41), (47, 41)): rivet(c, x, y)
    for k in range(6): c.set(16 + k * 2, 44 + k % 2, RUST[2])
    return finish(c)

def pipe():
    c = C()
    hcyl(c, 0, 26, 63, 37, STEEL[1:5])
    for fx in (14, 46):
        box(c, fx, 23, fx + 4, 40, STEEL, 2)
        rivet(c, fx + 1, 25); rivet(c, fx + 1, 37)
    for x in range(20, 40):
        if h(x, 3) > 0.7: c.set(x, 38, RUST[2]); c.set(x, 39, RUST[1])
    c.rect(28, 30, 34, 33, YEL[2]); c.line(29, 31, 33, 31, "#141013")   # Kennband
    wear(c, 77)
    return c                                                 # endet am Rand: kein Umriss links/rechts
def plate():
    c = C()
    box(c, 16, 24, 47, 39, STEEL, 3)
    for (x, y) in ((17, 25), (45, 25), (17, 37), (45, 37)): rivet(c, x, y)
    c.rect(21, 28, 42, 30, DARK[2]); c.rect(21, 33, 35, 34, DARK[2]); c.rect(37, 33, 42, 34, RED[2])
    return finish(c)

def window():
    c = C()
    box(c, 12, 8, 51, 55, STEEL, 2)
    for y in range(11, 53):                                   # zugemauert mit grauen Steinen
        course = (y - 11) // 5; off = 4 if course % 2 else 0
        for x in range(15, 49):
            m = (y - 11) % 5 == 4 or (x + off) % 10 == 9
            c.set(x, y, "#322b28" if m else ("#5a4e44" if h((x + off) // 10, course) > 0.4 else "#796755"))
    for x in range(15, 49): c.set(x, 11, "#242234")            # Sturz-Schatten
    box(c, 10, 55, 53, 58, STEEL, 3)                           # Sims
    return finish(c)

def conduit():
    c = C()
    cyl(c, 28, 0, 33, 63, STEEL[1:4])
    box(c, 22, 22, 41, 40, STEEL, 2)
    c.rect(26, 27, 37, 29, YEL[2]); c.line(28, 28, 35, 28, "#141013")
    for (x, y) in ((23, 23), (39, 23), (23, 38), (39, 38)): rivet(c, x, y)
    for y in (8, 52): box(c, 26, y, 35, y + 2, STEEL, 3)
    wear(c, 78)
    return c

def crack():
    c = C()
    pts = [(30, 6), (33, 16), (29, 24), (34, 34), (31, 44), (36, 57)]
    for a, b in zip(pts, pts[1:]): c.line(*a, *b, "#141013")
    c.line(33, 16, 41, 20, "#141013"); c.line(31, 44, 23, 50, "#141013")
    for a, b in zip(pts, pts[1:]): c.line(a[0] + 1, a[1], b[0] + 1, b[1], "#423934")
    return c

# ------------------------------------------------------------------ Decals
def d_soot():
    c = C()
    for y in range(64):
        for x in range(64):
            w = 10 + (63 - y) * 0.35                                   # Fahne wird nach oben breiter
            d = math.hypot((x - 32) / w, (y - 44) / 26)
            d += (h(x // 4, y // 4) - 0.5) * 0.25
            if d < 1: c.set(x, y, "#141013" + ("90" if d < 0.4 else ("60" if d < 0.7 else "30")))
    return c

def d_tag():                                    # Crude-Boys-Zeichen: Tropfen im Kreis, gesprüht
    c = C()
    ring(c, 32, 32, 13, 15.5, "#fa6a0a")
    for y in range(20, 44):
        w = max(0, (y - 22) * 0.45) if y < 34 else math.sqrt(max(0, 36 - (y - 36) ** 2))
        for x in range(int(32 - w), int(32 + w) + 1): c.set(x, y, "#fa6a0a")
    for x, l in ((22, 8), (37, 5), (45, 6)):                  # Farbnasen
        for k in range(l): c.set(x, 46 + k - (2 if x == 45 else 0), "#df3e23")
    return c

def d_arrow():                                  # Schablonen-Pfeil, ausgeblichen gelb
    c = C()
    for y in range(28, 36):
        for x in range(10, 42):
            if h(x // 2, y) > 0.15: c.set(x, y, "#dba463")
    for k in range(13):
        for y in range(32 - k, 32 + k):
            if h(k, y) > 0.12: c.set(54 - k, y, "#dba463")
    return c

def d_oil():
    c = C()
    for x0, L in ((26, 30), (31, 44), (37, 22)):
        for k in range(L):
            w = 3 if k < 6 else (2 if k < L - 6 else 1)
            for dx in range(w): c.set(x0 + dx, 10 + k, "#141013c0")
    for x in range(22, 44): c.set(x, 10, "#141013c0"); c.set(x, 11, "#141013c0")
    c.set(32, 30, "#4a5462c0"); c.set(32, 31, "#4a5462c0")
    return c

CLUTTER = [("drum", drum, 95), ("valve", valve, 125), ("conveyor", conveyor, 95), ("cabinet", cabinet, 140),
           ("gas", gas, 140), ("gear", gear, 85), ("cart", cart, 95), ("tracks", tracks, 75),
           ("sacks", sacks, 70), ("extinguisher", extinguisher, 70), ("cans", cans, 70), ("beacon", beacon, 140)]
DETAILS = [vent, pipe, plate, window, conduit, crack]
DECALS = [d_soot, d_tag, d_arrow, d_oil]

def build():
    cells = [f() for _, f, _ in CLUTTER] + [f() for f in DETAILS] + [f() for f in DECALS]
    names = [f"factory_{i}" for i in range(len(CLUTTER))] + [f"detail_factory_{i}" for i in range(len(DETAILS))] + \
            [f"decal_factory_{i}" for i in range(len(DECALS))]
    rows = (len(cells) + 7) // 8
    sheet = Image.new("RGBA", (512, rows * 64), (0, 0, 0, 0))
    for k, c in enumerate(cells):
        for y in range(64):
            for x in range(64):
                col = c.g[y][x]
                if col and col != "#000001":
                    a = int(col[7:9], 16) if len(col) == 9 else 255
                    sheet.putpixel(((k % 8) * 64 + x, (k // 8) * 64 + y), tuple(int(col[i:i + 2], 16) for i in (1, 3, 5)) + (a,))
    names += [""] * (rows * 8 - len(names))
    return sheet, names

if __name__ == "__main__":
    s, names = build()
    s.save(os.path.join(HERE, "factory_props.png"))
    open(os.path.join(HERE, "factory_props_names.txt"), "w").write("\n".join(names))
