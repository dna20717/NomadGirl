# Fennek v2 (Pixel-Auftrag „neu“, Daniel 19.11.2026: „Detaillevel etwas erhöhen und die Ohren beim Laufen animieren“)
# 64x64, 8 Frames Galopp nach rechts. Palette AAP-64, Licht oben links. Textur in Körper-Koordinaten (kein Flimmern).
import sys, math
sys.path.insert(0, ".claude/skills/nomadpixel/scripts")
import zeichnen as Z
Z.T = 64
from zeichnen import C, to_pix, _h

FUR   = ["#71413b", "#bb7547", "#dba463", "#f4d29c"]
CREAM = ["#c7b08b", "#e4d2aa", "#fef3c0"]
EAR   = ["#8e5252", "#f5a097"]
TIP   = ["#322b28", "#71413b"]
PAW   = ["#322b28", "#5a4e44"]
FAR   = ["#71413b", "#71413b", "#bb7547", "#bb7547"]
DARK  = "#060608"
BOB   = [0, -1, -2, -2, -1, 0, 1, 1]
TAU   = 2 * math.pi

def step(ramp, col, d): i = ramp.index(col); return ramp[max(0, min(len(ramp) - 1, i + d))]

def leg(c, x, y, ang, ramp, length=11, front=True):
    lower = ang - max(0, -ang) * 1.3 if front else ang - max(0, ang) * 1.7
    up, lo = length * 0.55, length * 0.5
    kx, ky = x + math.sin(ang) * up, y + math.cos(ang) * up
    px, py = kx + math.sin(lower) * lo, ky + math.cos(lower) * lo
    if py > 61: k = (61 - ky) / max(0.1, py - ky); px, py = kx + (px - kx) * k, ky + (py - ky) * k
    c.thick(x, y, kx, ky, 3.4, ramp)
    c.thick(kx, ky, px, py, 2.4, ramp)
    c.ellipse(round(px + 0.5), round(py), 1.6, 1.0, PAW)          # dark paw
    c.set(round(px + 1.5), round(py) - 1, ramp[-1])               # light toe

def ear_mask(bx, by, length, width, phi):
    # phi: lean from vertical, + = back (to the left); returns mask, direction, centre
    dx, dy = -math.sin(phi), -math.cos(phi)
    cx, cy = bx + dx * length * 0.85, by + dy * length * 0.85
    ang = math.atan2(dy, dx); ca, sa = math.cos(ang), math.sin(ang)
    def m(x, y, a=length, b=width, ox=0.0):
        u, v = (x - cx) * ca + (y - cy) * sa, -(x - cx) * sa + (y - cy) * ca
        # leaf: wider near the base, pointed-round at the tip
        bb = b * (1.0 - 0.35 * max(0.0, u / a))
        return (u / a) ** 2 + ((v - ox) / bb) ** 2 <= 1
    return m, (dx, dy), (cx, cy), ang

def frame(i):
    c = C(); b = BOB[i]; t = i / 8 * TAU
    fn, ff, hn, hf = 0.75 * math.sin(t), 0.75 * math.sin(t - 0.5), -0.8 * math.sin(t), -0.8 * math.sin(t - 0.5)
    sway = math.sin(t + 1.2)
    # far legs
    leg(c, 41, 48 + b, ff, FAR); leg(c, 23, 48 + b, hf, FAR, 12, front=False)
    # tail: bushy, with fur strands along its axis and a dark tip
    ta = 0.25 + sway * 0.18; tx, ty = 13, 42 + b + sway
    c.rellipse(tx, ty, 9.5, 3.8, ta, FUR)
    ca, sa = math.cos(ta), math.sin(ta)
    for y in range(64):
        for x in range(64):
            col = c.get(x, y)
            if col in FUR and abs(x - tx) < 11 and abs(y - ty) < 6:
                u, v = (x - tx) * ca + (y - ty) * sa, -(x - tx) * sa + (y - ty) * ca
                if _h(int(u // 3), int(v + 9), 21) > 0.62: c.set(x, y, step(FUR, col, -1))
                elif _h(int(u // 2), int(v + 9), 23) > 0.8: c.set(x, y, step(FUR, col, 1))
                if u < -6.3: c.set(x, y, TIP[0] if v > 0 or u < -8 else TIP[1])
    # body
    c.rellipse(31, 46 + b, 12, 5.8, -0.06, FUR)
    # fur texture in body coordinates: short strokes along the body, one step darker/lighter
    for y in range(40 + b, 53 + b):
        for x in range(18, 44):
            col = c.get(x, y)
            if col in FUR and ((x - 31) / 12) ** 2 + ((y - 46 - b) / 5.8) ** 2 <= 0.92:
                yy = y - b
                if _h(x // 3, yy, 31) > 0.78: c.set(x, y, step(FUR, col, -1))
                elif _h(x // 2, yy, 37) > 0.86: c.set(x, y, step(FUR, col, 1))
    c.shade_mask(lambda x, y: ((x - 33) / 9) ** 2 + ((y - (50 + b)) / 2.2) ** 2 <= 1, CREAM)   # belly
    for x in range(26, 41, 3): c.set(x, 49 + b, CREAM[2])                                     # soft belly fluff edge
    c.ellipse(41, 45 + b, 5, 5.5, FUR)
    c.ellipse(43, 47 + b, 3, 3.5, CREAM)
    for (x, y) in ((42, 45), (44, 47), (42, 49)): c.set(x, y + b, CREAM[2])                    # chest fluff
    # rim light along the back, dark crease at the hip
    for x in range(22, 38): 
        if c.get(x, 40 + b) in FUR and c.get(x, 39 + b) is None: c.set(x, 41 + b, FUR[3])
    c.line(22, 43 + b, 24, 47 + b, FUR[0])
    # near legs
    leg(c, 40, 48 + b, fn, FUR); leg(c, 24, 48 + b, hn, FUR, 12, front=False)
    # ---- ears: rotate around their roots, lag behind the body (back on the push-off, up on landing)
    swing = 0.5 + 0.5 * math.sin(t - 1.0)
    phi_far, phi_near = 0.32 + 0.36 * (0.5 + 0.5 * math.sin(t - 1.5)), 0.04 + 0.34 * swing
    eb = b
    mf, _, (fcx, fcy), fang = ear_mask(41, 35 + eb, 11, 3.6, phi_far)
    c.shade_mask(lambda x, y: mf(x, y), FAR, fcx, fcy, 11, 11)
    mn, (ndx, ndy), (ncx, ncy), nang = ear_mask(47, 34 + eb, 12, 4.3, phi_near)
    c.shade_mask(lambda x, y: mn(x, y), FUR, ncx, ncy, 12, 12)
    # fur strands on the outside of both ears, in ear coordinates (they turn with the ear, no flicker)
    for (m_, cx_, cy_, ang_, ramp) in ((mf, fcx, fcy, fang, FAR[1:]), (mn, ncx, ncy, nang, FUR)):
        ca_, sa_ = math.cos(ang_), math.sin(ang_)
        for y in range(4, 40):
            for x in range(28, 58):
                col = c.get(x, y)
                if m_(x, y) and col in ramp:
                    u, v = (x - cx_) * ca_ + (y - cy_) * sa_, -(x - cx_) * sa_ + (y - cy_) * ca_
                    if _h(int(u // 3), int(round(v)), 41) > 0.7: c.set(x, y, step(ramp, col, -1))
                    elif _h(int(u // 2), int(round(v)), 43) > 0.84: c.set(x, y, step(ramp, col, 1))
    # inside of the near ear: pink, darker deep inside, white tufts at the inner edge
    for y in range(4, 40):
        for x in range(30, 60):
            if mn(x, y, 9.5, 2.4, 0.4):
                u = (x - ncx) * math.cos(nang) + (y - ncy) * math.sin(nang)
                c.set(x, y, EAR[0] if u < -6 or mn(x, y, 6, 0.6, 0.9) else EAR[1])
    for k in range(3):
        px, py = ncx - ndx * (2 + k * 2) + 2, ncy - ndy * (2 + k * 2)
        c.set(round(px), round(py), CREAM[2])
    # dark tip edge on both ears
    for (cx_, cy_, dx_, dy_, L, ramp) in ((ncx, ncy, ndx, ndy, 12, FUR), (fcx, fcy, -math.sin(phi_far), -math.cos(phi_far), 11, FAR)):
        tx_, ty_ = round(cx_ + dx_ * L * 0.95), round(cy_ + dy_ * L * 0.95)
        if c.get(tx_, ty_) is not None: c.set(tx_, ty_, TIP[0])
    # seam where the near ear lies over the far one
    for y in range(4, 40):
        for x in range(28, 56):
            if not mn(x, y) and c.get(x, y) is not None and y < 34 + b and any(mn(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): c.set(x, y, DARK)
    # head in front of the ear roots
    c.ellipse(46, 39 + b, 7, 6, FUR)
    c.rellipse(52, 41 + b, 4.2, 2.4, 0.18, FUR)
    c.shade_mask(lambda x, y: ((x - 50) / 4) ** 2 + ((y - (43 + b)) / 1.4) ** 2 <= 1, CREAM)   # jaw
    c.shade_mask(lambda x, y: ((x - 47) / 2.5) ** 2 + ((y - (41.5 + b)) / 1.6) ** 2 <= 1, CREAM)  # cheek
    for (x, y) in ((42, 36), (44, 35), (43, 39)): c.set(x, y + b, FUR[3])
    for y in range(33 + b, 46 + b):                      # head fur in head coordinates
        for x in range(39, 54):
            col = c.get(x, y)
            if col in FUR[1:] and _h(x // 2, y - b, 51) > 0.8: c.set(x, y, step(FUR, col, -1))                    # forehead light
    # eye with lid, highlight; tear line; nose with highlight; whiskers
    for (x, y) in ((49, 37), (50, 37), (49, 38), (50, 38), (51, 38), (49, 39), (50, 39)): c.set(x, y + b, DARK)
    c.set(49, 37 + b, "#ffffff"); c.set(50, 38 + b, "#322b28")
    c.line(48, 36 + b, 51, 36 + b, FUR[0])
    c.line(51, 40 + b, 53, 42 + b, FUR[0])
    c.set(56, 40 + b, DARK); c.set(56, 41 + b, DARK); c.set(55, 40 + b, DARK); c.set(55, 39 + b, "#8b93af")
    c.set(54, 43 + b, FUR[0])
    c.outline(DARK)
    for (x0, y0, x1, y1) in ((54, 42, 57, 41), (54, 43, 57, 44)): c.line(x0, y0 + b, x1, y1 + b, CREAM[1])   # whiskers over the outline
    return c

frames = [(f"run_{i + 1}", frame(i)) for i in range(8)]
to_pix(frames, "output/nomadpixel/fennek/fennek2.pix", "size = 64x64\nfps_run = 12\nbg = #2a2034")
s = open("output/nomadpixel/fennek/fennek2.pix").read().replace("[icon ", "[frame ")
open("output/nomadpixel/fennek/fennek2.pix", "w").write(s)
