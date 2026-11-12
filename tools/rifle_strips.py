#!/usr/bin/env python3
"""Leyla with the generic assault rifle + hanging from one arm (Daniel, 12.11.2026).

Reads the raw PixelLab frames (*_source.png in assets/leyla/, one frame after another, all the same size,
feet on the same row), picks the frames, snaps every pixel to Leyla's own colours (her standing, running,
aiming and shooting strips), cuts the transparent columns away that no frame uses and writes the strips.
Prints frame size, frame count and the anchor (feet) for assets.json.

    python3 tools/rifle_strips.py
"""
import os
from collections import deque
from PIL import Image

L = os.path.join(os.path.dirname(__file__), '..', 'projects', 'nomadgirl', 'assets', 'leyla')
PALETTE_FROM = ['idle_side.png', 'run_side.png', 'aim_side.png', 'shoot_side.png', 'walk_side.png', 'reload_side.png']

# out: (source, frame size, frames to take, anchor x in the source frame, anchor y)
# anchors: the source frames were built by placing the original frame with its left edge at a fixed x
# (aim 30 → 30 + 59.5, idle 50 → 50 + 43.5, walk 50 → 50 + 56, run 30 → 30 + 76, hang 36 → 36 + 47 and 6 rows lower)
STRIPS = {
    'rifle_draw_side': ('rifle_draw_side_source.png', (208, 244), range(0, 7), 93.5, 242),
    'rifle_aim_side': ('rifle_aim_side_source.png', (208, 244), range(0, 5), 89.5, 242),
    'rifle_shoot_side': ('rifle_shoot_side_source.png', (208, 244), [1, 2, 3, 4], 89.5, 242),
    'rifle_reload_side': ('rifle_reload_side_source.png', (208, 244), range(0, 23), 89.5, 242),
    'rifle_aim_walk_side': ('rifle_aim_walk_side_source.png', (208, 244), range(0, 8), 106, 242),
    'rifle_run_gun_side': ('rifle_run_gun_side_source.png', (208, 244), range(0, 8), 106, 242),
    'rifle_run_ready_side': ('rifle_run_ready_side_source.png', (208, 244), range(0, 8), 106, 242),
    'hang_one_arm_side': ('hang_one_arm_side_source.png', (160, 256), range(0, 8), 83, 254),
}


def palette():
    cols = set()
    for f in PALETTE_FROM:
        im = Image.open(os.path.join(L, f)).convert('RGBA')
        cols |= {p[:3] for p in im.getdata() if p[3] >= 128}
    return sorted(cols)


def snap(im, pal, cache):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < 128:
                px[x, y] = (0, 0, 0, 0)
                continue
            c = cache.get((r, g, b))
            if c is None:
                c = cache[(r, g, b)] = min(pal, key=lambda q: (q[0] - r) ** 2 * 3 + (q[1] - g) ** 2 * 4 + (q[2] - b) ** 2 * 2)
            px[x, y] = (*c, 255)
    return im


def components(im):
    px, (w, h), seen, out = im.load(), im.size, set(), []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and (x, y) not in seen:
                q, c = deque([(x, y)]), []
                seen.add((x, y))
                while q:
                    a, b = q.popleft()
                    c.append((a, b))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            n = (a + dx, b + dy)
                            if 0 <= n[0] < w and 0 <= n[1] < h and n not in seen and px[n][3]:
                                seen.add(n)
                                q.append(n)
                out.append(c)
    return sorted(out, key=len, reverse=True)


def mend(f, pad):
    """PixelLab cuts a muzzle that reaches the right edge and lets it come in again at the left edge (the 'artefacts behind Leyla'):
    pieces touching the left edge go back to the right, behind the barrel; specks of 1-3 pixels go."""
    out = Image.new('RGBA', (f.width + pad, f.height))
    out.paste(f, (0, 0))
    src, px = f.load(), out.load()
    for c in components(f)[1:]:
        for x, y in c:
            px[x, y] = (0, 0, 0, 0)
        if len(c) <= 3:
            continue
        dx = f.width if min(x for x, _ in c) == 0 and len(c) < 300 else 0
        for x, y in c:
            px[x + dx, y] = src[x, y]
    return out


def main():
    pal, cache = palette(), {}
    for out, (src, (fw, fh), take, ax, ay) in STRIPS.items():
        S = Image.open(os.path.join(L, src)).convert('RGBA')
        frames = [mend(snap(S.crop((i * fw, 0, (i + 1) * fw, fh)), pal, cache), 48) for i in take]
        fw += 48
        boxes = [f.getbbox() for f in frames if f.getbbox()]
        x0, x1 = min(b[0] for b in boxes), max(b[2] for b in boxes)
        x0, x1 = max(0, x0 - 1), min(fw, x1 + 1)
        w = x1 - x0
        strip = Image.new('RGBA', (w * len(frames), fh))
        for i, f in enumerate(frames):
            strip.paste(f.crop((x0, 0, x1, fh)), (i * w, 0))
        strip.save(os.path.join(L, out + '.png'))
        print(f'{out}: frameSize [{w}, {fh}], frames {len(frames)}, origin [{ax - x0}, {ay}]')


if __name__ == '__main__':
    main()
