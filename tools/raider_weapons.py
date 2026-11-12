#!/usr/bin/env python3
# Raider-Waffen (#004): schneidet die Waffen aus den PixelLab-Reihen (assets/raider/source/weapons_*.png)
# in ein Symbol-Raster 4 x 2 à 128 x 64 (assets/raider/icons_raider_weapons.png). Das Feld ist zugleich das
# Inventar-Symbol und die Waffe in der Hand der Gegner (Waffen › In der Hand: Feld, Griff, Länge).
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = 'projects/nomadgirl/assets/raider/source/'
OUT = 'projects/nomadgirl/assets/raider/icons_raider_weapons.png'
CELL = (128, 64)
# (Quelle, Index der Teile nach Fläche absteigend sortiert?) → wir wählen nach Lage: (Datei, x-Bereich, y-Bereich)
PICK = [
    ('machete',     'weapons_melee.png', (0, 256), (0, 64)),
    ('nagelkeule',  'weapons_melee.png', (0, 256), (56, 128)),
    ('rohrhammer',  'weapons_melee.png', (256, 512), (0, 64)),
    ('nagelpistole', 'weapons_guns.png', (0, 128), (0, 128)),
    ('rohrpistole', 'weapons_guns.png', (128, 256), (0, 128)),
    ('schrotflinte', 'weapons_guns.png', (256, 384), (0, 128)),
    ('sturmgewehr', 'weapons_guns.png', (384, 512), (0, 128)),
]

def parts(img):
    a = np.array(img)[:, :, 3] > 0
    lab, n = ndimage.label(a, structure=np.ones((3, 3)))
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        size = (lab[sl] == i).sum()
        out.append((size, sl, i))
    return lab, out

def main():
    sheet = Image.new('RGBA', (CELL[0] * 4, CELL[1] * 2))
    info = {}
    cache = {}
    for k, (name, f, xr, yr) in enumerate(PICK):
        if f not in cache:
            img = Image.open(SRC + f).convert('RGBA')
            cache[f] = (img, *parts(img))
        img, lab, ps = cache[f]
        # all parts whose centre lies in the range and that are not tiny crumbs
        keep = np.zeros(lab.shape, bool)
        for size, sl, i in ps:
            cy, cx = (sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2
            if xr[0] <= cx < xr[1] and yr[0] <= cy < yr[1] and size >= 12:
                keep |= lab == i
        ys, xs = np.where(keep)
        box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        a = np.array(img); a[~keep] = 0
        crop = Image.fromarray(a).crop(box)
        s = min(1, (CELL[0] - 4) / crop.width, (CELL[1] - 4) / crop.height)
        if s < 1: crop = crop.resize((max(1, round(crop.width * s)), max(1, round(crop.height * s))), Image.NEAREST)
        cx, cy = (k % 4) * CELL[0], (k // 4) * CELL[1]
        ox, oy = cx + (CELL[0] - crop.width) // 2, cy + (CELL[1] - crop.height) // 2
        sheet.alpha_composite(crop, (ox, oy))
        info[name] = dict(cell=k, box=[ox - cx, oy - cy, crop.width, crop.height], scale=round(s, 3))
    sheet.save(OUT)
    for n, v in info.items(): print(n, v)

if __name__ == '__main__':
    main()
