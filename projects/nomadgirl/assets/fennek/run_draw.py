# Fennek (Pixel-Auftrag „neu“) – 64x64, 8 Frames Galopp, seitlich nach rechts. NomadPixel Direkt-Modus, Palette AAP-64, Licht oben links.
import sys, math
sys.path.insert(0, ".claude/skills/nomadpixel/scripts")
import zeichnen as Z
Z.T = 64
from zeichnen import C

FUR   = ["#71413b", "#bb7547", "#dba463", "#f4d29c"]
CREAM = ["#c7b08b", "#e4d2aa", "#fef3c0"]
EAR   = ["#8e5252", "#f5a097"]
TIP   = ["#322b28", "#71413b"]
DARK  = "#060608"
FAR   = ["#71413b", "#71413b", "#bb7547", "#bb7547"]   # legs on the far side, a step darker

BOB  = [0, -1, -2, -2, -1, 0, 1, 1]
# gallop: (front near, front far, hind near, hind far) leg angles in radians, + = forward
def legs(i):
    t = i / 8 * 2 * math.pi
    return (0.75 * math.sin(t), 0.75 * math.sin(t - 0.5), -0.8 * math.sin(t), -0.8 * math.sin(t - 0.5))

def leg(c, x, y, ang, ramp, length=11, front=True):
    # upper part swings, the lower part folds: a front paw flicks back when the leg reaches back,
    # a hind paw tucks in when the leg swings forward (no straight X under the belly)
    lower = ang - max(0, -ang) * 1.3 if front else ang - max(0, ang) * 1.7
    up, lo = length * 0.55, length * 0.5
    kx, ky = x + math.sin(ang) * up, y + math.cos(ang) * up
    px, py = kx + math.sin(lower) * lo, ky + math.cos(lower) * lo
    if py > 61: k = (61 - ky) / max(0.1, py - ky); px, py = kx + (px - kx) * k, ky + (py - ky) * k   # ground
    c.thick(x, y, kx, ky, 3.4, ramp)
    c.thick(kx, ky, px, py, 2.4, ramp)
    c.ellipse(round(px + 0.5), round(py), 1.6, 1.0, ramp)
    return px, py

def frame(i):
    c = C(); b = BOB[i]; fn, ff, hn, hf = legs(i)
    sway = math.sin(i / 8 * 2 * math.pi + 1.2)
    # far legs first
    leg(c, 41, 48 + b, ff, FAR); leg(c, 23, 48 + b, hf, FAR, 12, front=False)
    # bushy tail with a dark tip
    ta = 0.25 + sway * 0.18
    tx, ty = 13, 42 + b + sway
    c.rellipse(tx, ty, 9, 3.6, ta, FUR)
    c.rellipse(tx - math.cos(ta) * 7, ty - math.sin(ta) * 7, 3.2, 2.6, ta, TIP)
    # body and chest
    c.rellipse(31, 46 + b, 12, 5.8, -0.06, FUR)
    c.shade_mask(lambda x, y: ((x - 33) / 9) ** 2 + ((y - (50 + b)) / 2.2) ** 2 <= 1, CREAM)   # cream belly
    c.ellipse(41, 45 + b, 5, 5.5, FUR)
    c.ellipse(43, 47 + b, 3, 3.5, CREAM)
    # near legs
    leg(c, 40, 48 + b, fn, FUR); leg(c, 24, 48 + b, hn, FUR, 12, front=False)
    # head, snout
    c.ellipse(46, 39 + b, 7, 6, FUR)
    c.rellipse(52, 41 + b, 4.2, 2.4, 0.18, FUR)
    c.shade_mask(lambda x, y: ((x - 50) / 4) ** 2 + ((y - (43 + b)) / 1.4) ** 2 <= 1, CREAM)   # cream jaw
    # ears: big, leaning back, bobbing a bit behind the body
    eb = b + (1 if i in (2, 3) else 0)
    def ear(bx0, bx1, by, tx_, ty_, ramp):
        def m(x, y):
            # triangle (bx0,by) (bx1,by) (tx_,ty_)
            d = (by - ty_)
            if d == 0 or not (ty_ <= y <= by): return False
            f = (y - ty_) / d
            xl = tx_ + (bx0 - tx_) * f; xr = tx_ + (bx1 - tx_) * f
            return xl - 0.5 <= x <= xr + 0.5
        c.shade_mask(m, ramp)
        return m
    # big leaf-shaped ears, leaning back; the near one shows its pink inside
    c.rellipse(40, 25 + eb, 10, 3.4, math.pi / 2 + 0.32, FAR)
    ang = math.pi / 2 + 0.12; ca, sa = math.cos(ang), math.sin(ang); ecx, ecy = 48, 23 + eb
    near = lambda x, y: (((x - ecx) * ca + (y - ecy) * sa) / 10.5) ** 2 + ((-(x - ecx) * sa + (y - ecy) * ca) / 4.0) ** 2 <= 1
    c.rellipse(ecx, ecy, 10.5, 4.0, ang, FUR)
    c.rellipse(47.6, 24 + eb, 7.5, 2.0, ang, [EAR[0], EAR[1], EAR[1]])
    c.rellipse(48.4, 25 + eb, 6, 0.8, ang, [EAR[0]])
    # dark seam where the near ear lies over the far one
    for y in range(8, 36):
        for x in range(30, 52):
            if not near(x, y) and c.get(x, y) is not None and y < 33 + b and any(near(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): c.set(x, y, DARK)
    # the head sits in front of the ear roots
    c.ellipse(46, 39 + b, 7, 6, FUR)
    c.rellipse(52, 41 + b, 4.2, 2.4, 0.18, FUR)
    c.shade_mask(lambda x, y: ((x - 50) / 4) ** 2 + ((y - (43 + b)) / 1.4) ** 2 <= 1, CREAM)
    # big dark eye with a highlight, the dark tear line, nose
    for (x, y) in ((49, 37), (50, 37), (49, 38), (50, 38), (51, 38), (49, 39), (50, 39)): c.set(x, y + b, DARK)
    c.set(49, 37 + b, "#ffffff")
    c.line(51, 40 + b, 53, 42 + b, FUR[0])
    c.set(56, 40 + b, DARK); c.set(56, 41 + b, DARK); c.set(55, 40 + b, DARK)
    # fur strokes along the back (move with the body, so they do not flicker)
    c.line(24, 42 + b, 36, 42 + b, FUR[2])   # soft light along the back
    for (x, y) in ((22, 44), (26, 45), (30, 45)): c.set(x, y + b, FUR[1])
    c.outline(DARK)
    return c

frames = [(f"run_{i + 1}", frame(i)) for i in range(8)]
# write a .pix with frames
from zeichnen import to_pix
to_pix(frames, "output/nomadpixel/fennek/fennek.pix", "size = 64x64\nfps_run = 12\nbg = #2a2034")
s = open("output/nomadpixel/fennek/fennek.pix").read().replace("[icon ", "[frame ")
open("output/nomadpixel/fennek/fennek.pix", "w").write(s)
