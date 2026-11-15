#!/usr/bin/env python3
"""Ladder strip (#034/#035): the middle and the broken piece come from the PixelLab ladder (strict front view), the top and the
bottom end are rebuilt from its rails in code, because the generated ones were drawn in perspective (Daniel: „nicht orthogonal,
besonders der oberste Teil“). Writes assets/ladders/ladder_steel.png, 76 px wide:
  rows   0– 38  top: rails straight up with round caps, a mounting plate
  rows  38–118  middle (repeats): mounting plate + 4 rungs, from the picture
  rows 118–198  broken piece, from the picture
  rows 198–240  bottom: rails, one rung, flat foot plates
Run: python3 tools/ladder_parts.py
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'projects/nomadgirl/assets/ladders'
src = np.array(Image.open(ROOT / 'source/ladder_steel.png').convert('RGBA'))[:, 24:100]   # 76 wide like before
W = src.shape[1]
OUT = '#060608'
INK = np.array([6, 6, 8, 255], np.uint8)

mid = src[38:118].copy()
broken = src[118:198].copy()
rails_row = src[60].copy()          # a row between two rungs and outside the plates: just the two rails
plate = src[41:56].copy()           # the mounting plate rows (plates left and right of the rails + rails)
rung = src[68:74].copy()            # one rung with the rails (no plate beside it)

opaque = rails_row[:, 3] > 0
cols = np.where(opaque)[0]
# the two rails: runs of opaque columns
runs, start = [], cols[0]
for a, b in zip(cols, cols[1:]):
    if b != a + 1: runs.append((start, a)); start = b
runs.append((start, cols[-1]))
rails = [r for r in runs if r[1] - r[0] >= 2][:2]

def body(h):
    return np.repeat(rails_row[None, :, :], h, axis=0)

# top: 38 rows of rails, a plate at rows 14–29, caps at the very top (outline, light, rail colours)
top = body(38)
top[14:14 + plate.shape[0]] = plate
for x0, x1 in rails:
    top[0:2, :][:, x0:x1 + 1] = 0               # rounded: the corners fall away
    top[0, x0 + 1:x1] = INK
    top[1, x0:x1 + 1] = INK
    top[2, x0 + 1:x1] = rails_row[x0 + 1:x1]
    top[2, x0] = INK; top[2, x1] = INK

# bottom: 42 rows: rails, a plate, a rung, flat foot plates (5 rows, 3 px wider than the rail on both sides)
bottom = body(42)
bottom[6:6 + plate.shape[0]] = plate
bottom[26:26 + rung.shape[0]] = rung
light, mid_c, dark = np.array([179, 185, 209, 255], np.uint8), np.array([109, 117, 141, 255], np.uint8), np.array([74, 84, 98, 255], np.uint8)
for x0, x1 in rails:
    a, b = max(0, x0 - 4), min(W - 1, x1 + 4)
    bottom[36:42, a:b + 1] = INK
    bottom[37, a + 1:b] = light
    bottom[38:40, a + 1:b] = mid_c
    bottom[40, a + 1:b] = dark
    for bx in (a + 2, b - 2): bottom[38, bx] = INK   # bolts

strip = np.concatenate([top, mid, broken, bottom], axis=0)
Image.fromarray(strip).save(ROOT / 'ladder_steel.png')
print('ladder_steel', strip.shape[1], 'x', strip.shape[0], 'rails', rails)
