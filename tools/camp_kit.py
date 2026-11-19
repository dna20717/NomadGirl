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
}
out = {}
for name, pick in PICK.items():
    ims = []
    for i in pick:
        im = Image.open(f'{K}/candidates/{name}_{i}.png').convert('RGBA')
        a = im.split()[3].point(lambda v: 255 if v > 40 else 0)
        im.putalpha(a)
        ims.append(im.crop(a.getbbox()))
    w = max(i.width for i in ims); h = max(i.height for i in ims)
    w += w % 2
    sheet = Image.new('RGBA', (w * len(ims), h), (0, 0, 0, 0))
    for n, im in enumerate(ims):
        sheet.paste(im, (n * w + (w - im.width) // 2, h - im.height))
    sheet.save(f'{K}/{name}.png')
    out[name] = {'cell': [w, h], 'grid': [len(ims), 1], 'sizes': [[i.width, i.height] for i in ims]}
print(json.dumps(out))
