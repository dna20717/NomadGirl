# Camp-Baukasten (#111): builds the piece sheets from the PixelLab candidates.
# Each sheet is one row of equal cells, every variant cropped to its content, feet on the bottom row, centred.
# Run from the repo root: python3 tools/camp_kit.py  → assets/camp/kit/<piece>.png and prints cell sizes for data/assets.json
from PIL import Image
import os, json
K = 'projects/nomadgirl/assets/camp/kit'
# piece: candidate indices in the order they become variants (Daniel can swap them here)
PICK = {
  'chair':   [3, 0],
  'pit':     [7, 2, 5],
  'table':   [0, 1, 3],
  'lantern': [0],
  'crate':   [0, 1, 2, 5, 6, 7, 9, 11, 12, 14],
  'plant':   [0, 1, 2, 3, 4, 5, 6, 7, 8],
  # second round (Daniel AFK: „arbeite das ganze Deko-System ab“)
  'planter':    [0, 1, 2, 3],
  'umbrella':   [0],
  'lounger':    [0, 1, 2, 3],
  'rainbarrel': [0, 1, 2],
  'cat':        [10, 13, 1, 3, 7, 9, 0, 14],
  'tripod':     [1, 0, 3],
  'firebarrel': [0, 1, 2, 4, 7, 8],
  'birdhouse':  [0],
  'windmast':   [0],
  'mirror':     [1, 0, 3],
  'plant_grow':  [0, 1, 2, 3],
  'cactus_grow': [0, 1, 2, 3],
  # #114: one PixelLab sheet split into two pieces: (source sheet, cells)
  'wall_windows': ('wall_modules', [0, 1, 2, 3, 7, 8, 9, 10, 12, 13, 14, 15]),
  'wall_doors':   ('wall_modules', [4, 5, 6, 11]),
  'inside_items': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  # 4 x 4 sheets: the candidate is one picture, the numbers are its cells (row by row)
  'table_items':  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  'wall_items':   [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  'ground_items': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  # 19.11.2026 (Daniel: „viele Deko-Elemente ohne Grafik“): the fixed code pieces get pictures
  'neon_symbols': ('neon', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  'neon_frames':  ('neon', [12, 13, 14, 15]),
  'graffiti':     [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  'banners':      ('banner', [0, 1, 2, 3, 4, 5, 6, 7]),
  'poles':        [0, 1, 2],
  'trophies':     [0, 1, 2],
  'tower':        [0],
  'balcony_a':    ('balcony', [0]),
  'balcony_b':    ('balcony', [1]),
}
GRID = {'wall_modules': (4, 4), 'inside_items': (4, 4), 'table_items': (4, 4), 'wall_items': (4, 4), 'ground_items': (4, 4), 'plant_grow': (4, 1), 'cactus_grow': (4, 1),
        'neon': (4, 4), 'graffiti': (4, 4), 'banner': (4, 2), 'poles': (3, 1), 'trophies': (3, 1), 'balcony': (1, 2)}
# baked size (hard pixels): the 4 x 4 sheets were painted bigger than life, tabletop things must fit on a table
SCALE = {'table_items': 0.6}
out = {}
for name, pick in PICK.items():
    ims = []
    srcname = name
    if isinstance(pick, tuple): srcname, pick = pick
    for i in pick:
        if srcname in GRID:
            src = Image.open(f'{K}/candidates/{srcname}_0.png').convert('RGBA'); gx, gy = GRID[srcname]; cw = src.width // gx; ch = src.height // gy
            im = src.crop(((i % gx) * cw, (i // gx) * ch, (i % gx + 1) * cw, (i // gx + 1) * ch))
        else:
            im = Image.open(f'{K}/candidates/{name}_{i}.png').convert('RGBA')
        a = im.split()[3].point(lambda v: 255 if v > 40 else 0)
        im.putalpha(a)
        im = im.crop(a.getbbox())
        if name in SCALE: im = im.resize((max(1, round(im.width * SCALE[name])), max(1, round(im.height * SCALE[name]))), Image.NEAREST)
        ims.append(im)
    w = max(i.width for i in ims); h = max(i.height for i in ims)
    w += w % 2
    sheet = Image.new('RGBA', (w * len(ims), h), (0, 0, 0, 0))
    for n, im in enumerate(ims):
        sheet.paste(im, (n * w + (w - im.width) // 2, h - im.height))
    sheet.save(f'{K}/{name}.png')
    out[name] = {'cell': [w, h], 'grid': [len(ims), 1], 'sizes': [[i.width, i.height] for i in ims]}
print(json.dumps(out))
