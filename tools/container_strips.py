#!/usr/bin/env python3
"""Shipping containers in three lengths (1, 2, 3 workshop places) from Daniel's picture (open + closed, pixel art ×7).

  python3 tools/container_strips.py [source.png]

Source: projects/nomadgirl/assets/rig/container_source.png (1792 × 1792, two containers above each other, open on top,
closed below, every art pixel 7 × 7 screen pixels). Writes into projects/nomadgirl/assets/rig/:
  container_open_1.png … _3.png, container_closed_1.png … _3.png   (one frame each, 256 high, content at y 73–186 like container_stack)
The 2-place container is the picture as it is (interior x 26–228 = 203 px = about 101 per place). For 1 place a band of
STEP columns is cut out of the middle, for 3 places the same band is repeated. The band starts at the column where
column a and column a + STEP look most alike in both pictures, so the seam stays invisible on roof, wall and bottom rail.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'projects/nomadgirl/assets/rig'
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT / 'container_source.png'
PX, STEP, TOP = 7, 101, 64   # art pixel size, columns per place, rows the art moves down so it sits like container_stack

art = np.array(Image.open(SRC).convert('RGBA'))[PX // 2::PX, PX // 2::PX]   # back to one value per art pixel (256 × 256)
frames = {}
for name, half in (('open', art[0:128]), ('closed', art[128:256])):
    f = np.zeros((256, 256, 4), np.uint8)
    f[TOP:TOP + 128] = half
    frames[name] = f

# the band: the column a in the middle of the wall where a and a + STEP differ least (both pictures, whole height of the art)
rows = slice(73, 187)
def seam(a):
    return sum(np.abs(f[rows, a, :3].astype(int) - f[rows, a + STEP, :3].astype(int)).sum() for f in frames.values())
a = min(range(32, 228 - STEP), key=seam)
print(f'band: columns {a}–{a + STEP - 1} (seam difference {seam(a)})')

for name, f in frames.items():
    variants = {
        1: np.concatenate([f[:, :a], f[:, a + STEP:]], axis=1),
        2: f,
        3: np.concatenate([f[:, :a + STEP], f[:, a:]], axis=1),
    }
    for places, img in variants.items():
        Image.fromarray(img).save(OUT / f'container_{name}_{places}.png', optimize=True)
        print(f'container_{name}_{places}.png', img.shape[1], '×', img.shape[0])
