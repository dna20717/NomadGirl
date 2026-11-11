#!/usr/bin/env python3
"""TileSet00: cut the PixelLab sources into the terrain sheet and the props sheet.

Sources (assets/tiles/tileset00/source/, all 64-px based, AAP-64):
  <theme>.png          256 x 256 texture, surface on top, seamless left/right
  clutter_<set>.png    4 x 4 clutter sprites a 64 px (standing, bottom = ground)
  decals.png           4 x 4 flat decals a 64 px
The 64 first-round candidates live in assets/tiles/tileset00/candidates/ (kept on purpose).

Output:
  terrain.png  cells 64 x 80 (16 px room above the tile for crust, grass, rubble),
               per theme two rows of 8: top 0-3, fill a 0-3 | fill b 0-3, (free)
  props.png    cells 64 x 64, 8 per row: clutter sets, then decals
Prints the cell names in sheet order (for the "names" of the icons asset).

Usage: python3 tools/tileset00.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'projects/nomadgirl/assets/tiles/tileset00'
SRC = ROOT / 'source'
T, OVER = 64, 16

# theme: source file, source columns (4 tiles across)
THEMES = [
    ('desert', 'desert', [0, 1, 2, 3]),
    ('concrete', 'floor', [0, 1, 2, 3]),
    ('concrete_wall', 'wall', [1, 2, 1, 2]),   # framed source: only the inner columns
    ('metal', 'metal', [0, 1, 2, 3]),
    ('ruins', 'ruins', [0, 1, 2, 3]),
]
CLUTTER = ['desert', 'station', 'industry', 'ruins']


def surface_row(img):
    """First row that is (nearly) fully opaque across the inner columns = where Leyla stands."""
    a = img.getchannel('A')
    w = img.width
    for y in range(img.height):
        if sum(1 for x in range(8, w - 8) if a.getpixel((x, y)) > 200) > (w - 16) * 0.9:
            return y
    return 0


def frame_top(img):
    """Framed sources (wall) have a bevel on top: skip transparent margin only."""
    bbox = img.getchannel('A').getbbox()
    return bbox[1] if bbox else 0


def terrain():
    sheet = Image.new('RGBA', (8 * T, len(THEMES) * 2 * (T + OVER)))
    names = []
    for i, (theme, src, cols) in enumerate(THEMES):
        img = Image.open(SRC / f'{src}.png').convert('RGBA')
        lift = frame_top(img) if src == 'wall' else surface_row(img)
        rows = [lift, lift + T, lift + 2 * T]   # top, fill a, fill b
        if rows[-1] + T > img.height:
            rows[-1] = img.height - T - (4 if src == 'wall' else 2)
        y0 = i * 2 * (T + OVER)
        cells = [('top', rows[0], True)] + [('fill_a', rows[1], False), ('fill_b', rows[2], False)]
        slot = 0
        for kind, sy, over in cells:
            for k, c in enumerate(cols):
                top = sy - OVER if over else sy
                tile = img.crop((c * T, top, c * T + T, sy + T))
                cx, cy = (slot % 8) * T, y0 + (slot // 8) * (T + OVER)
                sheet.alpha_composite(tile, (cx, cy + (0 if over else OVER)))
                names.append(f'{theme}_{kind}_{k}')
                slot += 1
        while slot < 16:
            names.append(''); slot += 1
        print(f'{theme}: surface at {lift}, rows {rows}')
    sheet.save(ROOT / 'terrain.png')
    return names


def ground_cut(img):
    """Desert clutter came with a slab of ground under it: cut from the first full-width row down."""
    a = img.getchannel('A')
    for y in range(20, T):
        if sum(1 for x in range(T) if a.getpixel((x, y)) > 200) >= T - 4:
            out = Image.new('RGBA', (T, T))
            out.alpha_composite(img.crop((0, 0, T, y)), (0, T - y))
            return out
    return img


def props():
    sets = [(f'clutter_{n}', n) for n in CLUTTER] + [('decals', 'decal')]
    sheet = Image.new('RGBA', (8 * T, len(sets) * 2 * T))
    names = []
    for i, (file, prefix) in enumerate(sets):
        img = Image.open(SRC / f'{file}.png').convert('RGBA')
        for k in range(16):
            cell = img.crop(((k % 4) * T, (k // 4) * T, (k % 4) * T + T, (k // 4) * T + T))
            if file == 'clutter_desert':
                cell = ground_cut(cell)
            sheet.alpha_composite(cell, ((k % 8) * T, (i * 2 + k // 8) * T))
            names.append(f'{prefix}_{k}')
    sheet.save(ROOT / 'props.png')
    return names


if __name__ == '__main__':
    print('terrain names:', ' '.join(n or '-' for n in terrain()))
    print('props names:', ' '.join(props()))
