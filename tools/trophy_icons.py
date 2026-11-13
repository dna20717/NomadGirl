#!/usr/bin/env python3
"""#012 Trophäen-Symbole: builds assets/items/icons_trophies.png (4 x 3 cells of 128 px) from the chosen PixelLab candidates.

  python3 tools/trophy_icons.py <folder with 00.png … 11.png>

Each picture is cut to its visible pixels (some candidates show two objects side by side: CROP keeps one), scaled by whole pixels
(nearest) to fill the cell as far as it goes, and stands on the cell's lower edge. The raw candidates are kept next to the sheet as
icons_trophies_source.png (same order). Order = order of the achievements (tools/achievement_data.mjs).
"""
import sys
from pathlib import Path
from PIL import Image

SRC = Path(sys.argv[1])
OUT = Path('projects/nomadgirl/assets/items')
CELL, COLS, ROWS, PAD = 128, 4, 3, 6
CROP = {1: (0, 0, 64, 128), 5: (0, 0, 64, 128)}   # Messing-Patrone, Rang-S-Abzeichen: the left one of two

sheet = Image.new('RGBA', (CELL * COLS, CELL * ROWS))
raw = Image.new('RGBA', (CELL * COLS, CELL * ROWS))
for i in range(COLS * ROWS):
    im = Image.open(SRC / f'{i:02d}.png').convert('RGBA')
    raw.paste(im, ((i % COLS) * CELL, (i // COLS) * CELL))
    if i in CROP:
        im = im.crop(CROP[i])
    box = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    if box:
        im = im.crop(box)
    k = max(1, min((CELL - 2 * PAD) // im.width, (CELL - 2 * PAD) // im.height))
    if k > 1:
        im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    x = (i % COLS) * CELL + (CELL - im.width) // 2
    y = (i // COLS) * CELL + CELL - PAD - im.height
    sheet.alpha_composite(im, (x, y))
sheet.save(OUT / 'icons_trophies.png')
raw.save(OUT / 'icons_trophies_source.png')
print('icons_trophies.png', sheet.size)
