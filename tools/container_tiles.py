#!/usr/bin/env python3
"""Shipping containers as a tileset (#042, Daniel 16.11.2026: „ein sauberes Tileset, aus dem man Container verschiedener Größe
zusammensetzen kann“), twice as fine as the first ones (every art pixel ×2 on screen instead of ×4, like the van).

  python3 tools/container_tiles.py

Sources (PixelLab, AAP-64, strict side view): projects/nomadgirl/assets/rig/source/container_hd_open.png and _closed.png,
512 × 228, a 2-place container (open: long side missing, interior visible; closed: the same shell with its wall).
The tileset `container_tiles.png` has two rows (open, closed), each: left end | one place (STEP columns) | right end.
A container with n places = left end + (n − 1) × place + right end (both ends together are the smallest container, 1 place). The place band starts at the column where column a and
column a + STEP look most alike in both pictures, so the seam stays invisible on roof, wall and bottom rail.
Writes container_open_1…3.png and container_closed_1…3.png (512 high, the container's bottom at row 372 like the old 186 × 2).
The closed source is PixelLab's closed left half (Edit Pro Flash of the open one) with its wall repeated over the right half, the
frame of the right end from the open one (put together in code, see docs/assets.md).
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'projects/nomadgirl/assets/rig'
SRC = OUT / 'source'
STEP, TOP, H = 190, 153, 512   # columns per place (interior x 66–446 = 2 × 190), first content row (bottom row 219 → 372 = old 186 × 2), frame height (old 256 × 2)
IN0, IN1 = 66, 446              # interior of the 2-place source (inner edges of the corner posts)

pics = {k: np.array(Image.open(SRC / f'container_hd_{k}.png').convert('RGBA')) for k in ('open', 'closed')}
w = pics['open'].shape[1]
# hard alpha: pixel art has no half-transparent pixels
for p in pics.values(): p[..., 3] = np.where(p[..., 3] >= 128, 255, 0)

def seam(a):
    return sum(np.abs(p[:, a, :].astype(int) - p[:, a + STEP, :].astype(int)).sum() for p in pics.values())
a = min(range(IN0 + 4, IN1 - STEP - 4), key=seam)   # the band lies inside the wall, away from the posts
print(f'place band: columns {a}–{a + STEP - 1} (seam difference {seam(a)})')

# the tileset: per row left end (0…a-1), one place (a…a+STEP-1), right end (a+STEP…w-1), 4 px gap between the tiles
left, right = a, w - a - STEP
sheet = np.zeros((2 * pics['open'].shape[0] + 4, left + STEP + right + 8, 4), np.uint8)
for r, k in enumerate(('open', 'closed')):
    p = pics[k]; y = r * (p.shape[0] + 4)
    sheet[y:y + p.shape[0], 0:left] = p[:, :a]
    sheet[y:y + p.shape[0], left + 4:left + 4 + STEP] = p[:, a:a + STEP]
    sheet[y:y + p.shape[0], left + STEP + 8:] = p[:, a + STEP:]
Image.fromarray(sheet).save(OUT / 'container_tiles.png', optimize=True)
print('container_tiles.png', sheet.shape[1], '×', sheet.shape[0], f'(ends {left} + {right}, place {STEP})')

def build(k, n):
    p = pics[k]
    body = np.concatenate([p[:, :a]] + [p[:, a:a + STEP]] * (n - 1) + [p[:, a + STEP:]], axis=1)
    f = np.zeros((H, body.shape[1], 4), np.uint8)
    f[TOP:TOP + p.shape[0]] = body
    return f

for k in pics:
    for n in (1, 2, 3):
        f = build(k, n)
        Image.fromarray(f).save(OUT / f'container_{k}_{n}.png', optimize=True)
        print(f'container_{k}_{n}.png', f.shape[1], '×', f.shape[0])
for n in (1, 2, 3): print(f'{n} place(s): interior x {IN0}–{IN1 - STEP * (2 - n)}, y {TOP + 37}–{TOP + 197}, deck {TOP + 20}, width {w + STEP * (n - 2)}')
