#!/usr/bin/env python3
"""Polish of two Kachel-Sets without new PixelLab jobs (#131, Daniel 21.11.2026: „stilistisch zum Rest passend, ohne Tokens sinnlos
zu verbrennen“).

1. desert_fine.png: the desert tiles cut from the fine camp ground (camp_ground_fine_source, PixelLab #084), so the outdoor POIs match
   the camp. The 512 px source is made seamless at 448 px (7 tiles) with a vertical min cut; top = rows 48-128 (16 px crust above
   the walking line at 64), fill a = rows 67-131 (sand down to the first sediment line: pillars and walls outdoors become layered sandstone), fill b = the same band three tiles further (variety).
   Cells 64 x 80 like tileset00 (16 px room on top), grid 7 x 3: tops, fills a, fills b.
2. concrete_worn.png: the concrete set with a calmer floor. The red/black checker linoleum (it read as a placeholder) becomes worn,
   dusty brown-grey linoleum; fills are copied unchanged. Grid 4 x 3.

Usage: python3 tools/terrain_polish.py   (prints the cell names for the assets)
"""
from pathlib import Path
from PIL import Image
import numpy as np

A = Path(__file__).resolve().parent.parent / 'projects/nomadgirl/assets'
T, OVER, SURF = 64, 16, 64


def seamless(im, width):
    """cut a horizontally seamless strip of `width` out of im (overlap = im.width - width) along the cheapest vertical seam"""
    a = np.array(im).astype(int)
    H, W = a.shape[:2]
    O = W - width
    L, R = a[:, W - O:], a[:, :O]
    e = np.abs(L[:, :, :3] - R[:, :, :3]).sum(2) + (L[:, :, 3] != R[:, :, 3]) * 300
    c = e.astype(float)
    back = np.zeros_like(e)
    for y in range(1, H):
        for x in range(O):
            lo, hi = max(0, x - 1), min(O, x + 2)
            k = lo + int(np.argmin(c[y - 1, lo:hi]))
            c[y, x] += c[y - 1, k]
            back[y, x] = k
    x = int(np.argmin(c[-1]))
    path = [0] * H
    for y in range(H - 1, -1, -1):
        path[y] = x
        x = back[y, x]
    ov = L.copy()
    for y in range(H):
        ov[y, path[y]:] = R[y, path[y]:]
    return Image.fromarray(np.concatenate([ov, a[:, O:W - O]], 1).astype('uint8'))


def fill_holes(im):
    """the background removal punched holes into light strata: fill them from their neighbours (below the surface only)"""
    a = np.array(im.convert('RGBA')).astype(int)
    H, W = a.shape[:2]
    top = [next((y for y in range(H) if a[y, x, 3] > 128), H) for x in range(W)]
    m = a[:, :, 3] < 128
    for x in range(W):
        m[:top[x] + 1, x] = False
    for _ in range(200):
        if not m.any():
            break
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            src = np.roll(np.roll(a, dy, 0), dx, 1)
            sm = np.roll(np.roll(m, dy, 0), dx, 1)
            f = m & ~sm & (src[:, :, 3] > 128)
            a[f] = src[f]
            m[f] = False
    return Image.fromarray(a.astype('uint8'))


def desert():
    src = fill_holes(Image.open(A / 'tiles/source/camp_ground_fine_source.png'))
    strip = seamless(src, 7 * T)
    n = 7
    sheet = Image.new('RGBA', (n * T, 3 * (T + OVER)))
    names = []
    for i in range(n):
        x = i * T
        top = strip.crop((x, SURF - OVER, x + T, SURF + T))
        fa = strip.crop((x, 67, x + T, 67 + T))   # sand down to the first sediment line: stacked, it reads as layered sandstone
        x2 = (x + 3 * T) % (n * T)
        fb = strip.crop((x2, 67, x2 + T, 67 + T))
        sheet.paste(top, (x, 0))
        sheet.paste(fa, (x, (T + OVER) + OVER))
        sheet.paste(fb, (x, 2 * (T + OVER) + OVER))
    names = [f'desert_fine_top_{i}' for i in range(n)] + [f'desert_fine_fill_a_{i}' for i in range(n)] + [f'desert_fine_fill_b_{i}' for i in range(n)]
    sheet.save(A / 'tiles/tileset00/desert_fine.png')
    return names


def concrete():
    T00 = Image.open(A / 'tiles/tileset00/terrain.png').convert('RGBA')
    cell = lambda i: T00.crop(((i % 8) * T, (i // 8) * (T + OVER), (i % 8 + 1) * T, (i // 8 + 1) * (T + OVER)))
    sheet = Image.new('RGBA', (4 * T, 3 * (T + OVER)))
    for i in range(4):
        top = np.array(cell(16 + i)).astype(float)
        rgb = top[:, :, :3]
        lum = rgb.mean(2, keepdims=True)
        red = (rgb[:, :, 0] - rgb[:, :, 1:].mean(2)) > 40   # the red squares
        # worn linoleum: the checker fades into two close dusty tones, the red keeps a faint warm cast
        out = rgb.copy()
        out[red] = np.clip(lum[red] * 0.35 + np.array([96, 80, 70]) * 0.65, 0, 255)
        dark = (~red) & (lum[:, :, 0] < 70) & (top[:, :, 3] > 0)
        out[dark] = np.clip(lum[dark] * 0.4 + np.array([70, 62, 56]) * 0.6, 0, 255)
        top[:, :, :3] = out
        sheet.paste(Image.fromarray(top.astype('uint8')), (i * T, 0))
        sheet.paste(cell(20 + i), (i * T, T + OVER))
        sheet.paste(cell(24 + i), (i * T, 2 * (T + OVER)))
    sheet.save(A / 'tiles/tileset00/concrete_worn.png')
    return [f'concrete_worn_top_{i}' for i in range(4)] + [f'concrete_worn_fill_a_{i}' for i in range(4)] + [f'concrete_worn_fill_b_{i}' for i in range(4)]


def tile2d(src_name, size=T, roll=(0, 0)):
    """#144: a texture made seamless in both directions (min cut sideways, then on the transposed picture) → size x size;
    roll shifts the source first (another variant of the same texture)"""
    im = Image.open(A / 'tiles/source' / src_name).convert('RGBA')
    if roll != (0, 0): im = Image.fromarray(np.roll(np.roll(np.array(im), roll[1], 0), roll[0], 1))
    im = seamless(im, size)
    im = seamless(im.transpose(Image.Transpose.TRANSPOSE), size).transpose(Image.Transpose.TRANSPOSE)
    return im.crop((0, 0, size, size))


BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def dither_into(a, b, start=0.25, end=1.0):
    """#156 (Daniel 21.11.2026: „sanftere Übergänge zwischen den Schichten“): picture a fades into b from top to bottom with an
    ordered (Bayer) dither, pixel-art style: rows above `start` stay a, from `end` on everything is b"""
    A_, B_ = np.array(a.convert('RGBA')), np.array(b.convert('RGBA'))
    H, W = A_.shape[:2]
    out = A_.copy()
    for y in range(H):
        w = min(1.0, max(0.0, (y / (H - 1) - start) / max(1e-6, end - start)))
        for x in range(W):
            if BAYER[y % 4, x % 4] < w: out[y, x] = B_[y, x]
    return Image.fromarray(out)


def from_strip(src_name, out_name, prefix, fill_a, fill_b, shift_b=3, n=7, rust=False, deep=None, deep_a=False, soft=False, soft_top=False):
    """#138 (Daniel 21.11.2026: „Beides mit PixelLab neu malen“): a PixelLab cross-section strip (512 x 256, walking line at y=64) cut into
    a Kachel-Set: seamless at n tiles, tops = rows 48-128, fill a / fill b = 64 rows from fill_a / fill_b (fill b shifted by shift_b tiles)"""
    src = fill_holes(Image.open(A / 'tiles/source' / src_name))
    strip = seamless(src, n * T)
    sheet = Image.new('RGBA', (n * T, 3 * (T + OVER)))
    for i in range(n):
        x = i * T
        top = strip.crop((x, SURF - OVER, x + T, SURF + T))
        if soft_top and deep:   # #156 the slab under the floor melts into the wall texture in its lower half
            tex0 = tile2d(deep, roll=[(0, 0), (40, 24), (20, 56)][i % 3])
            body = dither_into(top.crop((0, OVER, T, OVER + T)), tex0, 0.45, 1.0)
            top.paste(body, (0, OVER))
        sheet.paste(top, (x, 0))
        sheet.paste(strip.crop((x, fill_a, x + T, fill_a + T)), (x, (T + OVER) + OVER))
        x2 = (x + shift_b * T) % (n * T)
        if deep:   # #144 the rock below: one texture that repeats without seams in both directions (concrete: 3 panels mixed)
            tex = tile2d(deep, roll=[(0, 0), (40, 24), (20, 56)][i % 3] if deep_a else (0, 0))
            sheet.paste(tex, (x, 2 * (T + OVER) + OVER))
            if deep_a: sheet.paste(tex, (x, (T + OVER) + OVER))
            elif soft:   # #156 the layer under the crust melts into the rock below instead of ending in a hard line
                sheet.paste(dither_into(strip.crop((x, fill_a, x + T, fill_a + T)), tex, 0.2, 0.95), (x, (T + OVER) + OVER))
        else:
            sheet.paste(strip.crop((x2, fill_b, x2 + T, fill_b + T)), (x, 2 * (T + OVER) + OVER))
    if rust:   # bright red rebar read as glitches: rust brown from the same palette (AAP-64)
        a = np.array(sheet)
        for src_c, dst in (((180, 32, 42), (113, 65, 59)), ((223, 62, 35), (142, 82, 82))):
            m = (a[:, :, 0] == src_c[0]) & (a[:, :, 1] == src_c[1]) & (a[:, :, 2] == src_c[2])
            a[m, :3] = dst
        sheet = Image.fromarray(a)
    sheet.save(A / 'tiles/tileset00' / out_name)
    return [f'{prefix}_top_{i}' for i in range(n)] + [f'{prefix}_fill_a_{i}' for i in range(n)] + [f'{prefix}_fill_b_{i}' for i in range(n)]


if __name__ == '__main__':
    import sys
    if 'px' in sys.argv:
        # #144 (Daniel 21.11.2026: „Die Schichten machen so keinen Sinn“): surface from the strip, right under it the strip's first layer
        # once (fill a, desert), deeper the seamless rock (fill b); concrete walls are the seamless concrete all the way
        print('desert_px', from_strip('desert_px_source.png', 'desert_px.png', 'desert_px', 128, 192, 0, deep='sandstone_tex_source.png', soft=True))
        print('concrete_px', from_strip('concrete_px_source.png', 'concrete_px.png', 'concrete_px', 102, 102, 3, rust=True, deep='concrete_tex_source.png', deep_a=True, soft_top=True))
        print('cave_px', from_strip('cave_px_source.png', 'cave_px.png', 'cave_px', 128, 192, 0, deep='cave_tex_source.png', soft=True))
        sys.exit(0)
    print('desert_fine', desert())
    print('concrete_worn', concrete())
