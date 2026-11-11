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
  props.png    cells 64 x 64, 8 per row (two rows per set): clutter desert, station, industry, ruins, decals, desert2, station2, industry2
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
    ('mall', 'mall', [0, 1, 2, 3]),       # Großmarkt (11.11.2026)
    ('bunker', 'bunker', [0, 1, 2, 3]),   # Bunker 13
    ('marble', 'marble', [0, 1, 2, 3]),   # Ministerium
]
CLUTTER = ['desert', 'station', 'industry', 'ruins', 'desert2', 'station2', 'industry2', 'station3', 'desert3', 'industry3', 'ruins3', 'mall3', 'bunker3', 'ministry3']
# *2 = second round: 16 different things per sheet, *3 = third round in strict orthographic side view (Daniel, 11.11.2026)
DETAILS = ['desert', 'concrete', 'metal', 'ruins']   # embedded details on the fill (stones, pipes, patches)
KEY = {'ruins': (45, 0.01), 'metal': (70, 0.01)}   # background keying per theme: colour tolerance, share of the border


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


def to_floor(cell):
    """Clutter stands on the bottom edge of its cell, centred."""
    bbox = cell.getchannel('A').getbbox()
    if not bbox:
        return cell
    part = cell.crop(bbox)
    out = Image.new('RGBA', (T, T))
    out.alpha_composite(part, ((T - part.width) // 2, T - part.height))
    return out


def key_out(cell, tol=40, share=0.015):
    """Details came with the wall painted behind them: flood the cell from its border through the
    background colours (the ones that make up the border) and make them transparent."""
    from collections import Counter, deque
    cell = cell.copy()
    px, w = cell.load(), cell.width
    box = cell.getchannel('A').getbbox()
    if not box:
        return cell
    x0, y0, x1, y1 = box[0], box[1], box[2] - 1, box[3] - 1   # ring around the painted content (some cells have a transparent margin)
    border = [(x, y) for x in range(x0, x1 + 1) for y in (y0, y0 + 1, y1 - 1, y1)] + [(x, y) for y in range(y0, y1 + 1) for x in (x0, x0 + 1, x1 - 1, x1)]
    opaque = [px[p][:3] for p in border if px[p][3] > 128]
    if len(opaque) < len(border) * 0.3:
        return tidy(cell)   # already cut out, only the sheet's lines and crumbs go
    count = Counter(opaque)
    bg = {c for c, n in count.items() if n >= len(opaque) * share}
    near = lambda c: any(sum(abs(a - b) for a, b in zip(c, g)) < tol for g in bg)
    seen, todo = set(), deque(p for p in border)
    while todo:
        x, y = todo.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < w):
            continue
        seen.add((x, y))
        r, g, b, a = px[x, y]
        edge = x - x0 < 3 or y - y0 < 3 or x1 - x < 3 or y1 - y < 3 or min(x, y) < 3 or max(x, y) > w - 4
        if a > 128 and not near((r, g, b)) and not edge:
            continue
        px[x, y] = (0, 0, 0, 0)
        todo.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return tidy(cell)


def tidy(cell):
    """Remove the sheet's grid lines (long straight black runs) and small crumbs near the cell edge (rivets of the background)."""
    from collections import deque
    px, w = cell.load(), cell.width
    # long straight black lines are the sheet's grid, not part of a detail
    black = lambda x, y: px[x, y][3] > 128 and sum(px[x, y][:3]) < 40
    for x in range(w):
        if sum(black(x, y) for y in range(w)) > w * 0.6:
            for y in range(w):
                if black(x, y): px[x, y] = (0, 0, 0, 0)
    for y in range(w):
        if sum(black(x, y) for x in range(w)) > w * 0.6:
            for x in range(w):
                if black(x, y): px[x, y] = (0, 0, 0, 0)
    seen = set()
    for sy in range(w):
        for sx in range(w):
            if (sx, sy) in seen or px[sx, sy][3] <= 128:
                continue
            blob, todo = [], deque([(sx, sy)])
            while todo:
                x, y = todo.popleft()
                if (x, y) in seen or not (0 <= x < w and 0 <= y < w) or px[x, y][3] <= 128:
                    continue
                seen.add((x, y)); blob.append((x, y))
                todo.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
            if len(blob) < 14 and any(min(x, y) < 10 or max(x, y) > w - 11 for x, y in blob):
                for p in blob: px[p] = (0, 0, 0, 0)
    return cell


def props():
    sets = [(f'clutter_{n}', n) for n in CLUTTER[:4]] + [('decals', 'decal')] + [(f'clutter_{n}', n) for n in CLUTTER[4:]]   # decals stay in rows 8-9
    sets += [(f'details_{n}', f'detail_{n}') for n in DETAILS]
    sets = [st for st in sets if (SRC / f'{st[0]}.png').exists()]
    sheet = Image.new('RGBA', (8 * T, len(sets) * 2 * T))
    names = []
    for i, (file, prefix) in enumerate(sets):
        img = Image.open(SRC / f'{file}.png').convert('RGBA')
        for k in range(16):
            cell = img.crop(((k % 4) * T, (k // 4) * T, (k % 4) * T + T, (k // 4) * T + T))
            if file == 'clutter_desert':
                cell = ground_cut(cell)
            if file.startswith('details_'):
                cell = key_out(cell, *KEY.get(file[8:], (40, 0.015)))
            elif file != 'decals':
                cell = to_floor(cell)
            sheet.alpha_composite(cell, ((k % 8) * T, (i * 2 + k // 8) * T))
            names.append(f'{prefix}_{k}')
    sheet.save(ROOT / 'props.png')
    return names


BIG = ['station', 'industry']   # large clutter, 2 x 2 per sheet a 128 px


def props_big():
    B = 2 * T
    sets = [n for n in BIG if (SRC / f'big_{n}.png').exists()]
    sheet = Image.new('RGBA', (4 * B, max(1, len(sets)) * B))
    names = []
    for i, n in enumerate(sets):
        img = Image.open(SRC / f'big_{n}.png').convert('RGBA')
        for k in range(4):
            cell = img.crop(((k % 2) * B, (k // 2) * B, (k % 2) * B + B, (k // 2) * B + B))
            bbox = cell.getchannel('A').getbbox()
            out = Image.new('RGBA', (B, B))
            if bbox:
                part = cell.crop(bbox)
                out.alpha_composite(part, ((B - part.width) // 2, B - part.height))
            sheet.alpha_composite(out, (k * B, i * B))
            names.append(f'big_{n}_{k}')
    sheet.save(ROOT / 'props_big.png')
    return names


if __name__ == '__main__':
    print('terrain names:', ' '.join(n or '-' for n in terrain()))
    print('props names:', ' '.join(props()))
    print('big names:', ' '.join(props_big()))
