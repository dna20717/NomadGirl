#!/usr/bin/env python3
"""#170 (Daniel, 21.11.2026: "Texte sollen niemals in der Grafik sein"): paint baked text out of the pictures.

Every job names a picture and boxes around its text. The original stays next to it as a source
(`<folder>/source/<name>_text.png`, written once, never overwritten), so the script always starts from
the original and can be run again after a box changes. The text itself comes back from code:
Assets › Schrift aus Code (field `labels`, game/labels.js).

Box modes
  heal   pixels that stand out from the box's most frequent colour (or the colour at `ref`) (the letters, plus `grow` pixels around them)
         take the colour of the nearest calm pixel in the same row (else column): the plate, the screen,
         the banner keep their texture, only the strokes go
         options: thr (distance), grow, ref (x, y of the calm colour), colors (only these are letters),
         flat (screens, neon signs: letters take the calm colour itself)
  board  an empty sign board: fill + 1 px frame (for neon letters standing free over a scaffold)

  python3 tools/detext.py            all jobs
  python3 tools/detext.py priceboard only jobs whose file contains the word
"""
import os, sys, shutil
from collections import Counter
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'projects', 'nomadgirl')

# (file, [(mode, x0, y0, x1, y1, options)]) – boxes in picture pixels, x1/y1 exclusive
JOBS = [
    ('assets/pois/wow/wow_priceboard.png', [
        ('heal', 44, 24, 90, 47, {'colors': [(142, 82, 82), (113, 65, 59)], 'grow': 0}),   # SUN on the sun
        ('heal', 18, 123, 68, 141, {}),          # REGULAR
        ('heal', 18, 150, 47, 167, {}),          # PLUS
        ('heal', 18, 175, 67, 194, {}),          # DIESEL
        ('heal', 73, 123, 109, 141, {'flat': True}),         # 4.89
        ('heal', 73, 150, 109, 168, {'flat': True}),         # 6.29
        ('heal', 73, 177, 109, 196, {'flat': True}),         # 6.49
        ('heal', 121, 123, 132, 147, {}),        # small sign on the side
    ]),
    ('assets/pois/wow/landmark_board.png', [
        ('heal', 30, 64, 244, 135, {'thr': 12, 'flat': True}),   # four departure rows
        ('heal', 34, 141, 53, 152, {}),          # V-07
        ('heal', 211, 140, 243, 152, {}),        # DANGER
        ('heal', 203, 48, 235, 59, {}),          # plate top right
        ('heal', 57, 46, 93, 57, {}),            # plate top left
    ]),
    ('assets/pois/wow/landmark_penthouse.png', [
        ('board', 14, 17, 274, 65, {'fill': (34, 28, 26), 'frame': (66, 57, 52)}),   # PENTHOUSE in neon
    ]),
    ('assets/pois/wow/wow_dome.png', [
        ('heal', 133, 125, 201, 159, {}),        # SALE on the banner
    ]),
    ('assets/pois/wow/wow_kiosk.png', [
        ('heal', 180, 6, 223, 25, {'flat': True}),           # PAY HERE RK
    ]),
    ('assets/props/vault/vault_closed.png', [
        ('heal', 30, 37, 69, 61, {}), ('heal', 122, 53, 165, 67, {}), ('heal', 118, 189, 156, 205, {}), ('heal', 38, 191, 64, 204, {}), ('heal', 106, 213, 130, 225, {}),
    ]),
    ('assets/props/vault/vault_open.png', [
        ('heal', 30, 37, 69, 61, {}), ('heal', 122, 53, 165, 67, {}), ('heal', 118, 189, 156, 205, {}), ('heal', 38, 191, 64, 204, {}),
    ]),
    ('assets/camp/notice_board.png', [
        ('heal', 66, 0, 131, 19, {'thr': 30}),            # JOBS
    ]),
    ('assets/workshops/treasury_hall.png', [('heal', 100, 72, 157, 96, {'flat': True})]),        # HALL OF LOOT
    ('assets/workshops/treasury_hall_empty.png', [('heal', 100, 72, 157, 96, {'flat': True})]),
    ('assets/workshops/armory.png', [('heal', 98, 47, 160, 63, {'flat': True})]),                # ARMORY
    ('assets/drive/shrine.png', [('heal', 18, 42, 47, 76, {'thr': 48})]),           # KM 14 on the milestone
    ('assets/camp/kit/mod_tent_b.png', [('heal', 199, 22, 231, 41, {'thr': 34})]),  # 732 on the tent
    ('assets/tiles/tileset00/props_big.png', [('heal', 22, 9, 91, 20, {})]),         # SNACKS on the vending machine
    ('assets/drive/bus.png', [('heal', 168, 15, 207, 24, {})]),                      # destination display
]


def source_of(path):
    d, f = os.path.split(path)
    return os.path.join(d, 'source', f.replace('.png', '_text.png'))


def heal(px, w, h, x0, y0, x1, y1, thr=60, grow=1, ref=None, colors=None, flat=False):
    box = [(x, y) for y in range(y0, y1) for x in range(x0, x1)]
    # the calm colour: the most frequent one in the box (or the pixel at `ref`); a see-through plate counts too
    med = px[ref] if ref else Counter(px[k] for k in box).most_common(1)[0][0]
    if med[3]:   # on an opaque plate nothing see-through around it turns opaque
        box = [k for k in box if px[k][3]]
    dist = lambda p, q: (sum((p[c] - q[c]) ** 2 for c in range(3)) + (p[3] - q[3]) ** 2) ** 0.5
    if colors:   # only these colours are letters (the sun keeps its shading)
        text = {k for k in box if any(dist(px[k], (*c, 255)) < 12 for c in colors)}
    else:
        text = {k for k in box if dist(px[k], med) > thr}
    inside = set(box)
    for _ in range(grow):
        text |= {(x + dx, y + dy) for x, y in text for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (x + dx, y + dy) in inside}
    if flat:   # screens and neon signs: just the empty plate
        for k in text:
            px[k] = med
        return len(text)
    src = {k: px[k] for k in box}
    for (x, y) in text:
        got = None
        for r in range(1, max(x1 - x0, y1 - y0)):
            for c in ((x - r, y), (x + r, y)) if r % 2 else ((x + r, y), (x - r, y)):
                if c in src and c not in text:
                    got = src[c]; break
            if got: break
            for c in ((x, y - r), (x, y + r)):
                if c in src and c not in text:
                    got = src[c]; break
            if got: break
        if got:
            px[x, y] = got
    return len(text)


def board(px, x0, y0, x1, y1, fill, frame):
    for y in range(y0, y1):
        for x in range(x0, x1):
            edge = x in (x0, x1 - 1) or y in (y0, y1 - 1)
            px[x, y] = (*(frame if edge else fill), 255)
    for x in range(x0 + 6, x1 - 6, 24):   # rivets along the top and bottom
        px[x, y0 + 2] = (*frame, 255); px[x, y1 - 3] = (*frame, 255)


def main(words):
    for rel, boxes in JOBS:
        if words and not any(w in rel for w in words):
            continue
        path = os.path.join(ROOT, rel); src = source_of(path)
        if not os.path.exists(src):
            os.makedirs(os.path.dirname(src), exist_ok=True); shutil.copyfile(path, src)
        im = Image.open(src).convert('RGBA'); px = im.load(); n = 0
        for mode, x0, y0, x1, y1, o in boxes:
            if mode == 'heal':
                n += heal(px, im.width, im.height, x0, y0, x1, y1, o.get('thr', 60), o.get('grow', 1), o.get('ref'), o.get('colors'), o.get('flat', False))
            else:
                board(px, x0, y0, x1, y1, o['fill'], o['frame']); n += (x1 - x0) * (y1 - y0)
        im.save(path)
        print(f'{rel}: {n} px, original {os.path.relpath(src, ROOT)}')


if __name__ == '__main__':
    main(sys.argv[1:])
