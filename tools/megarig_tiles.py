#!/usr/bin/env python3
"""Tile sets of the mega rigs (#026): cut the PixelLab pieces in assets/vehicles/megarig/source/ to their content.

The fatbird's middle piece came with white sky in the gaps of its truss: those pixels become transparent.
Run: python3 tools/megarig_tiles.py   (writes assets/vehicles/megarig/<name>.png)
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'projects/nomadgirl/assets/vehicles/megarig'
PIECES = ['crawler_bow', 'crawler_track', 'crawler_mid', 'crawler_stern', 'fatbird_nose', 'fatbird_rotor', 'fatbird_mid', 'fatbird_tail']
KEEP_SIZE = {'crawler_track', 'crawler_mid', 'fatbird_mid'}   # tileable: the canvas is the tile

for name in PIECES:
    a = np.array(Image.open(ROOT / 'source' / f'{name}.png').convert('RGBA'))
    if name == 'fatbird_mid':   # white sky in the truss → transparent (only in the girder band, the neon strip stays)
        y0 = 120
        w = (a[y0:, :, 0] > 200) & (a[y0:, :, 1] > 200) & (a[y0:, :, 2] > 200)
        a[y0:, :, 3][w] = 0
    if name not in KEEP_SIZE:
        ys, xs = np.where(a[:, :, 3] > 0)
        a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(a).save(ROOT / f'{name}.png')
    print(name, a.shape[1], 'x', a.shape[0])
