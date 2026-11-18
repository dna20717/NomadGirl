#!/usr/bin/env python3
# Leyla's van strictly from the side (Daniel, 18.11.2026: „orthogonaler Van im gleichen Stil, einmal von außen (Tür zu) und einmal im
# Seitenquerschnitt offen mit Platz für zwei Werkbänke … idealerweise eine Art Tileset“). From the two PixelLab pictures (the cutaway is
# an inpaint of the closed one, so both lie on top of each other pixel for pixel) this builds:
#   van_side_closed.png / van_side_open.png   the two states (ground line removed, the ladder put back onto the cut edge)
#   van_side.png                              5 frames: closed → open as a cross-fade (the door „opens“ without anything jumping)
#   van_side_kit.png                          the tileset: row 1 closed, row 2 open, same columns (rear | bay 1 | strut | bay 2 | cab)
#   python3 tools/van_side.py
from PIL import Image
import numpy as np, colorsys, os
D = os.path.join(os.path.dirname(__file__), '..', 'projects', 'nomadgirl', 'assets', 'vehicles')
A = np.array(Image.open(os.path.join(D, 'van_side_source.png')).convert('RGBA'))
B = np.array(Image.open(os.path.join(D, 'van_side_cut_source.png')).convert('RGBA'))
for X in (A, B): X[171:, :, 3] = 0   # the ground line under the wheels
# the ladder stays on the cut edge: its light, unsaturated rails and rungs and their dark outline from the closed picture
lum = lambda p: 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
m = np.zeros(A.shape[:2], bool)
for y in range(50, 130):
    for x in range(36, 52):
        r, g, b, a = A[y, x]
        if a > 10 and lum(A[y, x]) >= 82 and colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[1] < 0.35: m[y, x] = True
m2 = m.copy()
for y in range(50, 130):
    for x in range(36, 52):
        if not m[y, x] and A[y, x, 3] > 10 and lum(A[y, x]) < 40 and (m[y, x - 1] or m[y, x + 1] or m[y - 1, x] or m[y + 1, x]): m2[y, x] = True
B[m2] = A[m2]
Image.fromarray(A).save(os.path.join(D, 'van_side_closed.png'))
Image.fromarray(B).save(os.path.join(D, 'van_side_open.png'))
# door strip: cross-fade in 5 steps (only the box differs, the rest stays byte for byte)
h, w = A.shape[:2]
strip = Image.new('RGBA', (w * 5, h))
for i in range(5):
    k = i / 4
    F = (A.astype(float) * (1 - k) + B.astype(float) * k).round().astype(np.uint8)
    strip.paste(Image.fromarray(F), (i * w, 0))
strip.save(os.path.join(D, 'van_side.png'))
kit = Image.new('RGBA', (w, h * 2)); kit.paste(Image.fromarray(A), (0, 0)); kit.paste(Image.fromarray(B), (0, h))
kit.save(os.path.join(D, 'van_side_kit.png'))
print('ok', w, h)
