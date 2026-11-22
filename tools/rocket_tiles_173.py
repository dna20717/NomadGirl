#!/usr/bin/env python3
"""#173 (Daniel, 22.11.2026: „Mach aus der Grafik ein Tileset und mach die Rakete so hoch wie das Silo selbst“):
the rocket of Silo Zero as segments that the game stacks over the whole depth of the silo (engine/shaft.js, game/play/shaft_fx.js).

Inputs: the PixelLab originals in assets/pois/rocket/source/pl_*.png (Create Image Pro 128 × 128, AAP-64, style wow_rocket.png).
Outputs in assets/pois/rocket/:
  rocket_nose.png              nose cone, Scale2x (its cylinder was about half as wide as the hull's)
  rocket_body_{plain,stripes,hatch,patched}.png   hull, cropped to one seamless vertical period (the row after the last one looks like the first)
  rocket_ring.png              interstage ring (gunmetal, hazard band)
  rocket_engine.png            tail: fins and three nozzles, Scale2x
  rocket_pad.png               launch pad: clamps, slab, flame deflector
  rocket_tower.png             umbilical tower (lattice, ladder, service platform), seamless vertically
Every colour stays on AAP-64 (blends snap back). The columns of the cylinder in every picture go to POIs › Schacht-Motiv › Segmente.
  python3 tools/rocket_tiles_173.py
"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'projects', 'nomadgirl', 'assets')
DIR = os.path.join(ROOT, 'pois', 'rocket')
SRC = os.path.join(DIR, 'source')
PAL = [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in open(os.path.join(ROOT, 'palette', 'aap-64.hex')).read().split()]


def snap(c):
    return min(PAL, key=lambda p: (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)


def load(name):
    return Image.open(os.path.join(SRC, name)).convert('RGBA')


def scale2x(im):
    """EPX/Scale2x: doubles pixel art without new colours, edges stay crisp but lose the staircase."""
    w, h = im.size
    px = im.load()
    out = Image.new('RGBA', (w * 2, h * 2))
    po = out.load()
    for y in range(h):
        for x in range(w):
            P = px[x, y]
            A = px[x, y - 1] if y > 0 else P
            B = px[x + 1, y] if x < w - 1 else P
            C = px[x - 1, y] if x > 0 else P
            D = px[x, y + 1] if y < h - 1 else P
            e0 = A if C == A and C != D and A != B else P
            e1 = B if A == B and A != C and B != D else P
            e2 = C if D == C and D != B and C != A else P
            e3 = D if B == D and B != A and D != C else P
            po[2 * x, 2 * y] = e0
            po[2 * x + 1, 2 * y] = e1
            po[2 * x, 2 * y + 1] = e2
            po[2 * x + 1, 2 * y + 1] = e3
    return out


def row_diff(px, w, a, b, x0, x1):
    d = 0
    for x in range(x0, x1):
        p, q = px[x, a], px[x, b]
        d += sum((p[i] - q[i]) ** 2 for i in range(4))
    return d


def seamless(im, x0, x1, min_period):
    """one vertical period [a, a + P): row a + P (what would follow) looks most like row a, so copies stack without a seam"""
    w, h = im.size
    px = im.load()
    best = None
    for P in range(min_period, h):
        for a in range(0, h - P - 1):
            d = (row_diff(px, w, a, a + P, x0, x1) + row_diff(px, w, a + 1, a + P + 1, x0, x1)) / P ** 0.25
            if best is None or d < best[0]:
                best = (d, a, P)
    _, a, P = best
    return im.crop((0, a, w, a + P)), a, P


def main():
    jobs = {}
    # hull: the cylinder lies in columns 7..120 (outline included), the dark margin goes
    for name, src in (('plain', 'pl_body_1.png'), ('stripes', 'pl_body_0.png'), ('hatch', 'pl_body_2.png'), ('patched', 'pl_body_3.png')):
        im = load(src).crop((7, 0, 121, 128))
        out, a, P = seamless(im, 0, im.width, 96)
        out.save(os.path.join(DIR, f'rocket_body_{name}.png'))
        jobs[f'body_{name}'] = (out.size, f'rows {a}..{a + P - 1}')
    nose = load('pl_nose_0.png')
    nose = scale2x(nose.crop(nose.getbbox()))
    nose.save(os.path.join(DIR, 'rocket_nose.png')); jobs['nose'] = (nose.size, 'Scale2x')
    eng = scale2x(load('pl_engine_2.png'))
    eng = eng.crop(eng.getbbox()); eng.save(os.path.join(DIR, 'rocket_engine.png')); jobs['engine'] = (eng.size, 'Scale2x')
    ring = load('pl_ring_2.png'); ring = ring.crop(ring.getbbox()); ring.save(os.path.join(DIR, 'rocket_ring.png')); jobs['ring'] = (ring.size, '')
    pad = load('pl_pad_1.png'); pad = pad.crop(pad.getbbox()); pad.save(os.path.join(DIR, 'rocket_pad.png')); jobs['pad'] = (pad.size, '')
    # tower: without the loose pipe on the far left (it does not repeat), one seamless period of the lattice
    tw = load('pl_tower_1.png').crop((10, 0, 127, 128))
    out, a, P = seamless(tw, 0, 90, 100)
    out.save(os.path.join(DIR, 'rocket_tower.png')); jobs['tower'] = (out.size, f'rows {a}..{a + P - 1}')
    for k, v in jobs.items():
        print(k, *v)


if __name__ == '__main__':
    main()
